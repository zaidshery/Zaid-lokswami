import { NextResponse } from 'next/server';
import { ApiError, apiErrorFromUnknown, serializeApiError } from '@/lib/api/errors';

export type ApiPaginationMeta = {
  limit?: number;
  page?: number;
  total?: number;
  hasMore?: boolean;
  nextCursor?: unknown;
};

export type ApiResponseMeta = Record<string, unknown> & {
  pagination?: ApiPaginationMeta;
};

export type ApiSuccessEnvelope<TData> = {
  success: true;
  data: TData;
  meta: ApiResponseMeta | null;
  error: null;
};

export type ApiErrorEnvelope = {
  success: false;
  data: null;
  meta: ApiResponseMeta | null;
  error: ReturnType<typeof serializeApiError>;
};

type ApiResponseOptions = {
  headers?: HeadersInit;
  meta?: ApiResponseMeta | null;
  status?: number;
};

export function createSuccessEnvelope<TData>(
  data: TData,
  meta: ApiResponseMeta | null = null
): ApiSuccessEnvelope<TData> {
  return {
    success: true,
    data,
    meta,
    error: null,
  };
}

export function createErrorEnvelope(
  error: ApiError,
  meta: ApiResponseMeta | null = null
): ApiErrorEnvelope {
  return {
    success: false,
    data: null,
    meta,
    error: serializeApiError(error),
  };
}

export function apiSuccessResponse<TData>(
  data: TData,
  options: ApiResponseOptions = {}
) {
  return NextResponse.json(createSuccessEnvelope(data, options.meta ?? null), {
    status: options.status ?? 200,
    headers: options.headers,
  });
}

export function apiErrorResponse(
  error: unknown,
  options: ApiResponseOptions = {}
) {
  const apiError = apiErrorFromUnknown(error);

  return NextResponse.json(createErrorEnvelope(apiError, options.meta ?? null), {
    status: options.status ?? apiError.status,
    headers: options.headers,
  });
}

export function paginationMeta(pagination: ApiPaginationMeta): ApiResponseMeta {
  return { pagination };
}
