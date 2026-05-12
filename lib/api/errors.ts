export const API_ERROR_CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  CONFLICT: 'CONFLICT',
  FORBIDDEN: 'FORBIDDEN',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

export type SerializedApiError = {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
};

type ApiErrorOptions = {
  code?: ApiErrorCode;
  status?: number;
  details?: unknown;
  cause?: unknown;
  exposeDetails?: boolean;
};

const STATUS_TO_CODE: Record<number, ApiErrorCode> = {
  400: API_ERROR_CODES.BAD_REQUEST,
  401: API_ERROR_CODES.UNAUTHORIZED,
  403: API_ERROR_CODES.FORBIDDEN,
  404: API_ERROR_CODES.NOT_FOUND,
  405: API_ERROR_CODES.METHOD_NOT_ALLOWED,
  409: API_ERROR_CODES.CONFLICT,
  422: API_ERROR_CODES.VALIDATION_ERROR,
  429: API_ERROR_CODES.RATE_LIMITED,
  500: API_ERROR_CODES.INTERNAL_ERROR,
};

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function normalizeStatus(status: number | undefined) {
  if (!Number.isFinite(status)) return 500;
  const next = Math.floor(Number(status));
  return next >= 400 && next <= 599 ? next : 500;
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;
  readonly exposeDetails: boolean;

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = normalizeStatus(options.status);
    this.code = options.code ?? STATUS_TO_CODE[this.status] ?? API_ERROR_CODES.INTERNAL_ERROR;
    this.details = options.details;
    this.exposeDetails = Boolean(options.exposeDetails);

    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function apiErrorFromUnknown(
  error: unknown,
  fallback: ApiErrorOptions & { message?: string } = {}
): ApiError {
  if (isApiError(error)) return error;

  const message =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : fallback.message || 'Internal server error';

  return new ApiError(message, {
    code: fallback.code,
    status: fallback.status ?? 500,
    details: fallback.details,
    cause: error,
    exposeDetails: fallback.exposeDetails,
  });
}

export function serializeApiError(error: ApiError): SerializedApiError {
  const canExposeDetails = error.exposeDetails && !isProduction();

  return {
    code: error.code,
    message:
      error.status >= 500 && isProduction()
        ? 'Internal server error'
        : error.message,
    ...(canExposeDetails && error.details !== undefined
      ? { details: error.details }
      : {}),
  };
}
