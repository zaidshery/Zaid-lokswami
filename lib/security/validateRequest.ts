/**
 * Request Validation Middleware
 * Validates request body, query params, and path params
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  isValidMongoQuery,
  isValidString,
  sanitizeString,
  createValidationResult,
  addValidationError,
} from './validation';

/**
 * Response structure for validation errors
 */
export interface ValidationErrorResponse {
  error: 'VALIDATION_ERROR' | 'INVALID_JSON' | 'INVALID_CONTENT_TYPE';
  message: string;
  timestamp: string;
  fields?: Record<string, string>;
  details?: string;
}

/**
 * Validate JSON body of request
 * @param request NextRequest object
 * @returns Parsed JSON or null if invalid
 */
export async function validateJsonBody(
  request: NextRequest
): Promise<{ body: unknown; error?: ValidationErrorResponse }> {
  const contentType = request.headers.get('content-type');

  // Check content type
  if (!contentType?.includes('application/json')) {
    return {
      body: null,
      error: {
        error: 'INVALID_CONTENT_TYPE',
        message: 'Content-Type must be application/json',
        timestamp: new Date().toISOString(),
        details: `Received: ${contentType}`,
      },
    };
  }

  try {
    const body = await request.json();

    // Validate body is an object
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return {
        body: null,
        error: {
          error: 'INVALID_JSON',
          message: 'Request body must be a JSON object',
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Check for MongoDB injection attempts
    if (!isValidMongoQuery(body)) {
      return {
        body: null,
        error: {
          error: 'VALIDATION_ERROR',
          message: 'Invalid query parameters detected',
          timestamp: new Date().toISOString(),
          details: 'Query operators starting with $ are not allowed',
        },
      };
    }

    return { body };
  } catch (error) {
    const message = error instanceof SyntaxError ? error.message : 'Invalid JSON in request body';
    return {
      body: null,
      error: {
        error: 'INVALID_JSON',
        message,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

/**
 * Validate query parameters
 * @param request NextRequest object
 * @param allowedParams Array of allowed parameter names
 * @returns Validated query object or null if invalid
 */
export function validateQueryParams(
  request: NextRequest,
  allowedParams?: string[]
): { params: Record<string, string>; error?: ValidationErrorResponse } {
  const params: Record<string, string> = {};
  const result = createValidationResult();

  // Convert URLSearchParams to object
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    // Check allowlist if provided
    if (allowedParams && !allowedParams.includes(key)) {
      addValidationError(result, key, `Parameter not allowed: ${key}`);
      continue;
    }

    // Validate value is a string
    if (typeof value !== 'string') {
      addValidationError(result, key, `Invalid value type for parameter: ${key}`);
      continue;
    }

    // Sanitize value
    params[key] = sanitizeString(value);
  }

  if (!result.isValid) {
    return {
      params: {},
      error: {
        error: 'VALIDATION_ERROR',
        message: 'Invalid query parameters',
        timestamp: new Date().toISOString(),
        fields: result.errors,
      },
    };
  }

  return { params };
}

/**
 * Validate string field with length constraints
 * @param value Value to validate
 * @param minLength Minimum length
 * @param maxLength Maximum length
 * @param fieldName Field name for error messages
 * @returns Validated string or null
 */
export function validateStringField(
  value: unknown,
  minLength = 1,
  maxLength = 1000,
  fieldName = 'field'
): { value: string | null; error?: string } {
  if (!isValidString(value, minLength, maxLength)) {
    if (typeof value !== 'string') {
      return { value: null, error: `${fieldName} must be a string` };
    }
    if (value.trim().length < minLength) {
      return { value: null, error: `${fieldName} must be at least ${minLength} characters` };
    }
    if (value.trim().length > maxLength) {
      return { value: null, error: `${fieldName} must be at most ${maxLength} characters` };
    }
  }

  return { value: sanitizeString(value) };
}

/**
 * Validate email field
 * @param value Value to validate
 * @param fieldName Field name for error messages
 * @returns Validated email or null
 */
export function validateEmailField(
  value: unknown,
  fieldName = 'email'
): { value: string | null; error?: string } {
  if (typeof value !== 'string') {
    return { value: null, error: `${fieldName} must be a string` };
  }

  const sanitized = sanitizeString(value);

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized)) {
    return { value: null, error: `${fieldName} must be a valid email address` };
  }

  if (sanitized.length > 254) {
    return { value: null, error: `${fieldName} is too long` };
  }

  return { value: sanitized };
}

/**
 * Validate ObjectID field
 * @param value Value to validate
 * @param fieldName Field name for error messages
 * @returns Validated ObjectID or null
 */
export function validateObjectIdField(
  value: unknown,
  fieldName = 'id'
): { value: string | null; error?: string } {
  if (typeof value !== 'string') {
    return { value: null, error: `${fieldName} must be a string` };
  }

  const sanitized = sanitizeString(value).trim();

  // Validate MongoDB ObjectID (24 hex characters)
  if (!/^[0-9a-f]{24}$/i.test(sanitized)) {
    return { value: null, error: `${fieldName} must be a valid ID` };
  }

  return { value: sanitized };
}

/**
 * Validate integer field
 * @param value Value to validate
 * @param min Minimum value
 * @param max Maximum value
 * @param fieldName Field name for error messages
 * @returns Validated integer or null
 */
export function validateIntegerField(
  value: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  fieldName = 'value'
): { value: number | null; error?: string } {
  if (!Number.isInteger(value)) {
    return { value: null, error: `${fieldName} must be an integer` };
  }

  const num = value as number;
  if (num < min || num > max) {
    return { value: null, error: `${fieldName} must be between ${min} and ${max}` };
  }

  return { value: num };
}

/**
 * Validate enum field
 * @param value Value to validate
 * @param allowedValues Array of allowed values
 * @param fieldName Field name for error messages
 * @returns Validated enum value or null
 */
export function validateEnumField(
  value: unknown,
  allowedValues: readonly string[],
  fieldName = 'field'
): { value: string | null; error?: string } {
  if (typeof value !== 'string') {
    return { value: null, error: `${fieldName} must be a string` };
  }

  const sanitized = sanitizeString(value);

  if (!allowedValues.includes(sanitized)) {
    return {
      value: null,
      error: `${fieldName} must be one of: ${allowedValues.join(', ')}`,
    };
  }

  return { value: sanitized };
}

/**
 * Create a validation error response
 * @param fields Field validation errors
 * @param message Overall error message
 * @returns NextResponse with 400 status and error details
 */
export function createValidationErrorResponse(
  fields: Record<string, string>,
  message = 'Validation failed'
): NextResponse {
  const response: ValidationErrorResponse = {
    error: 'VALIDATION_ERROR',
    message,
    timestamp: new Date().toISOString(),
    fields,
  };

  return NextResponse.json(response, { status: 400 });
}

/**
 * Create a generic validation error response
 * @param message Error message
 * @param errorType Type of error
 * @returns NextResponse with 400 status
 */
export function createErrorResponse(
  message: string,
  errorType: ValidationErrorResponse['error'] = 'VALIDATION_ERROR'
): NextResponse {
  const response: ValidationErrorResponse = {
    error: errorType,
    message,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, { status: 400 });
}

/**
 * Log validation failure (can be extended for monitoring)
 * @param endpoint API endpoint
 * @param error Error type
 * @param details Additional details
 */
export function logValidationFailure(
  endpoint: string,
  error: string,
  details?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  console.warn(
    JSON.stringify({
      type: 'VALIDATION_FAILURE',
      timestamp,
      endpoint,
      error,
      ...details,
    })
  );
}
