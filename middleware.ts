import { NextResponse } from 'next/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { LOKSWAMI_SESSION_COOKIE } from '@/lib/auth/cookies';
import { getJwtSecretOrNull } from '@/lib/auth/jwtSecret';
import { resolveRouteGuardDecision } from '@/lib/auth/routeGuards';
import { getLoginLimiter } from '@/lib/security/getRateLimiter';
import { getIpRateLimitKey } from '@/lib/security/ipUtils';
import { logApiRequestFromMiddleware } from '@/lib/security/requestLogger';
import { isAdminRole } from '@/lib/auth/roles';

async function getSessionToken(request: NextRequest) {
  const secret = getJwtSecretOrNull();
  if (!secret) {
    return null;
  }

  return getToken({
    req: request,
    secret,
    cookieName: LOKSWAMI_SESSION_COOKIE,
  });
}

/** Protects admin and signed-in reader routes with the active NextAuth session. */
export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const startedAt = Date.now();

  try {
    const { pathname } = request.nextUrl;
    const isApiRequest = pathname.startsWith('/api/');
    
    // Skip middleware processing for large file upload routes
    // Bypass body processing to allow large multipart uploads
    const isLargeUploadRoute = 
      pathname === '/api/admin/epapers/upload' ||
      pathname === '/api/admin/upload' ||
      pathname.includes('/api/admin/epapers/') && pathname.includes('/pages');
    
    if (isLargeUploadRoute) {
      // For upload routes, bypass middleware auth checks entirely to avoid "disturbed body" errors in Next.js 15
      // The individual route handlers (e.g. /api/admin/upload) must perform their own authentication checks
      return NextResponse.next();
    }
    
    let session: Awaited<ReturnType<typeof getSessionToken>> = null;

    function scheduleRequestLog(response: NextResponse) {
      if (isApiRequest) {
        event.waitUntil(
          logApiRequestFromMiddleware({
            request,
            responseStatus: response.status,
            startedAt,
            session,
          })
        );
      }

      return response;
    }

    // Rate limit login/signin endpoints
    const isAuthEndpoint = pathname === '/signin' || pathname === '/login';
    if (isAuthEndpoint) {
      const loginLimiter = getLoginLimiter();
      const ipKey = getIpRateLimitKey(request, 'login');
      const result = loginLimiter.check(ipKey);

      if (!result.allowed) {
        const retryAfter = result.retryAfter || 900; // 15 minutes default
        return scheduleRequestLog(new NextResponse(
          JSON.stringify({
            error: 'Too many login attempts',
            message: `Please try again in ${retryAfter} seconds`,
            retryAfter,
          }),
          {
            status: 429, // Too Many Requests
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(retryAfter),
            },
          }
        ));
      }
    }

    session = await getSessionToken(request);
    const email = typeof session?.email === 'string' ? session.email.trim() : '';
    const userId = typeof session?.userId === 'string' ? session.userId.trim() : '';

    const decision = resolveRouteGuardDecision({
      pathname,
      searchParams: request.nextUrl.searchParams,
      isAuthenticated: Boolean(email || userId),
      role: session?.role,
      isActive: session?.isActive !== false,
    });

    if (decision.action === 'redirect') {
      return scheduleRequestLog(NextResponse.redirect(
        new URL(decision.location, request.url),
        decision.status ?? 302
      ));
    }

    return scheduleRequestLog(NextResponse.next());
  } catch (error) {
    console.error('Middleware auth check failed:', error);
    return NextResponse.next();
  }
}

export const config = {
  runtime: 'nodejs',
  matcher: [
    '/admin/:path*',
    // Exclude specific upload routes from middleware to prevent "disturbed body" errors in Next.js 15
    '/api/admin/((?!upload|epapers/upload).*)',
    '/api/((?!admin).*)',
    '/login',
    '/signin',
    '/main/account/:path*',
    '/main/saved/:path*',
    '/main/preferences/:path*',
  ],
};
