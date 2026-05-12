import { ApiError, API_ERROR_CODES } from '@/lib/api/errors';

export type ValidationIssue = {
  path: string;
  message: string;
  code?: string;
};

export type ValidationResult<TData> =
  | { success: true; data: TData; issues: [] }
  | { success: false; data: null; issues: ValidationIssue[]; error: ApiError };

type SafeParseResult<TData> =
  | { success: true; data: TData }
  | { success: false; error: unknown };

export type ValidationSchema<TData> =
  | { safeParse: (input: unknown) => SafeParseResult<TData> }
  | { parse: (input: unknown) => TData }
  | ((input: unknown) => TData);

export type QueryObject = Record<string, string | string[]>;

function issuePath(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((part) => String(part)).join('.');
  }
  if (typeof value === 'string') return value;
  return '';
}

export function formatValidationIssues(error: unknown): ValidationIssue[] {
  const maybeIssueSource =
    error && typeof error === 'object'
      ? (error as { issues?: unknown; errors?: unknown; message?: unknown })
      : null;
  const rawIssues = Array.isArray(maybeIssueSource?.issues)
    ? maybeIssueSource.issues
    : Array.isArray(maybeIssueSource?.errors)
      ? maybeIssueSource.errors
      : [];

  const issues = rawIssues
    .map((issue): ValidationIssue | null => {
      const item =
        issue && typeof issue === 'object'
          ? (issue as { path?: unknown; message?: unknown; code?: unknown })
          : null;
      if (!item) return null;
      const formatted: ValidationIssue = {
        path: issuePath(item.path),
        message: String(item.message || 'Invalid value'),
      };
      if (item.code) {
        formatted.code = String(item.code);
      }
      return formatted;
    })
    .filter((issue): issue is ValidationIssue => Boolean(issue));

  if (issues.length) return issues;

  return [
    {
      path: '',
      message:
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : 'Invalid request payload',
    },
  ];
}

function failedValidation(error: unknown): ValidationResult<never> {
  const issues = formatValidationIssues(error);
  return {
    success: false,
    data: null,
    issues,
    error: new ApiError('Validation failed', {
      status: 422,
      code: API_ERROR_CODES.VALIDATION_ERROR,
      details: issues,
      exposeDetails: true,
      cause: error,
    }),
  };
}

export function validateInput<TData>(
  input: unknown,
  schema: ValidationSchema<TData>
): ValidationResult<TData> {
  try {
    if (typeof schema === 'function') {
      return { success: true, data: schema(input), issues: [] };
    }

    if ('safeParse' in schema) {
      const result = schema.safeParse(input);
      if (result.success) {
        return { success: true, data: result.data, issues: [] };
      }
      return failedValidation(result.error);
    }

    return { success: true, data: schema.parse(input), issues: [] };
  } catch (error) {
    return failedValidation(error);
  }
}

export function queryToObject(source: URLSearchParams): QueryObject {
  const output: QueryObject = {};

  source.forEach((value, key) => {
    const current = output[key];
    if (current === undefined) {
      output[key] = value;
    } else if (Array.isArray(current)) {
      current.push(value);
    } else {
      output[key] = [current, value];
    }
  });

  return output;
}

export function getSearchParams(source: URL | URLSearchParams | Request | string) {
  if (source instanceof URLSearchParams) return source;
  if (source instanceof URL) return source.searchParams;
  if (typeof source === 'string') return new URL(source, 'http://localhost').searchParams;
  return new URL(source.url).searchParams;
}

export function parseQuery<TData = QueryObject>(
  source: URL | URLSearchParams | Request | string,
  schema?: ValidationSchema<TData>
): ValidationResult<TData | QueryObject> {
  const query = queryToObject(getSearchParams(source));
  if (!schema) return { success: true, data: query, issues: [] };
  return validateInput(query, schema);
}

export async function parseJsonBody<TData = unknown>(
  request: Request,
  schema?: ValidationSchema<TData>
): Promise<ValidationResult<TData | unknown>> {
  try {
    const body = await request.json();
    if (!schema) return { success: true, data: body, issues: [] };
    return validateInput(body, schema);
  } catch (error) {
    return failedValidation(error);
  }
}
