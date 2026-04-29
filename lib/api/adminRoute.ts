import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, type AdminSessionIdentity } from '@/lib/auth/admin';
import type { AdminRole } from '@/lib/auth/roles';
import { logAdminMutationRequest } from '@/lib/security/auditLogger';

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'CSRF_BLOCKED'
  | 'FORBIDDEN'
  | 'INTERNAL_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR';

export type AdminApiContext = {
  admin: AdminSessionIdentity;
  requestId: string;
  startedAt: number;
};

type AdminApiOptions = {
  authorize?: (role: AdminRole, admin: AdminSessionIdentity) => boolean;
  mutation?: boolean;
};

type AdminApiHandler<TContext> = (
  request: NextRequest,
  routeContext: TContext,
  context: AdminApiContext
) => Promise<Response> | Response;

const WRITE_METHODS = new Set(['DELETE', 'PATCH', 'POST', 'PUT']);

function getRequestUrl(request: NextRequest) {
  try {
    return new URL(request.url);
  } catch {
    return new URL('http://localhost');
  }
}

function getRequestOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get('x-forwarded-host')?.trim();
  const host = forwardedHost || request.headers.get('host')?.trim();
  if (!host) return '';

  const forwardedProto = request.headers.get('x-forwarded-proto')?.trim();
  const requestUrl = getRequestUrl(request);
  const protocol = forwardedProto || requestUrl.protocol.replace(':', '') || 'http';
  return `${protocol}://${host}`;
}

function getPayloadForAudit(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return Promise.resolve(undefined);
  }

  return request
    .clone()
    .json()
    .then((payload) =>
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : undefined
    )
    .catch(() => undefined);
}

function isSameOriginWrite(request: NextRequest) {
  const method = request.method.toUpperCase();
  if (!WRITE_METHODS.has(method)) return true;

  const secFetchSite = request.headers.get('sec-fetch-site')?.trim().toLowerCase();
  if (secFetchSite === 'cross-site') return false;

  const origin = request.headers.get('origin')?.trim();
  if (!origin) return true;

  const expectedOrigin = getRequestOrigin(request);
  if (!expectedOrigin) return true;

  try {
    return new URL(origin).origin === new URL(expectedOrigin).origin;
  } catch {
    return false;
  }
}

export function apiError(
  error: string,
  status: number,
  code: ApiErrorCode,
  requestId?: string
) {
  return NextResponse.json(
    {
      success: false,
      error,
      code,
      ...(requestId ? { requestId } : {}),
    },
    { status }
  );
}

export function apiSuccess<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    init
  );
}

export function withAdminApi<TContext = Record<string, never>>(
  handler: AdminApiHandler<TContext>,
  options: AdminApiOptions = {}
) {
  return async function adminApiRoute(request: NextRequest, routeContext?: TContext) {
    const startedAt = Date.now();
    const requestId = randomUUID();
    const requestDataPromise = options.mutation ? getPayloadForAudit(request) : Promise.resolve(undefined);
    let admin: AdminSessionIdentity | null = null;
    let response: Response | undefined;
    let errorMessage: string | undefined;

    try {
      admin = await getAdminSession();
      if (!admin) {
        response = apiError('Unauthorized', 401, 'UNAUTHORIZED', requestId);
        return response;
      }

      if (options.authorize && !options.authorize(admin.role, admin)) {
        response = apiError('Forbidden', 403, 'FORBIDDEN', requestId);
        return response;
      }

      if (options.mutation && !isSameOriginWrite(request)) {
        response = apiError('Cross-site admin writes are not allowed', 403, 'CSRF_BLOCKED', requestId);
        return response;
      }

      response = await handler(request, routeContext ?? ({} as TContext), {
        admin,
        requestId,
        startedAt,
      });
      return response;
    } catch (error) {
      errorMessage =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Unexpected admin API failure';
      console.error('Admin API route failed:', error);
      response = apiError('Internal server error', 500, 'INTERNAL_ERROR', requestId);
      return response;
    } finally {
      if (response) {
        response.headers.set('x-request-id', requestId);
        response.headers.set('server-timing', `app;dur=${Date.now() - startedAt}`);
      }

      if (options.mutation && admin) {
        const statusCode = response?.status || 500;
        await logAdminMutationRequest({
          request,
          userId: admin.id,
          userEmail: admin.email,
          userRole: admin.role,
          statusCode,
          duration: Date.now() - startedAt,
          requestData: await requestDataPromise,
          responseStatus:
            statusCode >= 500
              ? 'error'
              : statusCode >= 400
                ? 'rejected'
                : 'success',
          errorMessage,
        });
      }
    }
  };
}
