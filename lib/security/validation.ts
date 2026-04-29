/**
 * Input Validation Utilities
 * Centralized validators to prevent injection attacks and malformed data
 */

/**
 * Email validation (RFC 5322 simplified)
 * @param email Email string to validate
 * @returns true if valid email format
 */
export function isValidEmail(email: unknown): email is string {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  
  // Basic RFC 5322 simplified pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(trimmed)) return false;
  if (trimmed.length > 254) return false; // RFC 5321
  if (trimmed.split('@')[0].length > 64) return false; // Local part max 64 chars
  
  return true;
}

/**
 * Validate MongoDB ObjectID (24 hex characters)
 * @param id ID to validate
 * @returns true if valid MongoDB ObjectID
 */
export function isValidObjectId(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  return /^[0-9a-f]{24}$/i.test(id.trim());
}

/**
 * Validate string length and type
 * @param value Value to validate
 * @param minLength Minimum length (default 1)
 * @param maxLength Maximum length (default 1000)
 * @returns true if valid
 */
export function isValidString(
  value: unknown,
  minLength = 1,
  maxLength = 1000
): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length >= minLength && trimmed.length <= maxLength;
}

/**
 * Sanitize string: trim whitespace and normalize
 * @param value String to sanitize
 * @returns Trimmed string
 */
export function sanitizeString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, 10000); // Limit to 10KB
}

/**
 * Validate URL format (http/https only)
 * @param url URL to validate
 * @returns true if valid HTTP/HTTPS URL
 */
export function isValidUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate slug (lowercase alphanumeric with hyphens)
 * @param slug Slug to validate
 * @returns true if valid slug
 */
export function isValidSlug(slug: unknown): slug is string {
  if (typeof slug !== 'string') return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim());
}

/**
 * Validate integer within range
 * @param value Value to validate
 * @param min Minimum value (default: Number.MIN_SAFE_INTEGER)
 * @param max Maximum value (default: Number.MAX_SAFE_INTEGER)
 * @returns true if valid integer in range
 */
export function isValidInteger(
  value: unknown,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER
): boolean {
  if (!Number.isInteger(value)) return false;
  const num = value as number;
  return num >= min && num <= max;
}

/**
 * Validate enum value
 * @param value Value to check
 * @param allowedValues Array of allowed values
 * @returns true if value is in allowed list
 */
export function isValidEnum<T>(value: unknown, allowedValues: readonly T[]): value is T {
  return allowedValues.includes(value as T);
}

/**
 * Validate array of items
 * @param value Value to validate
 * @param minLength Minimum array length (default 0)
 * @param maxLength Maximum array length (default 1000)
 * @returns true if valid array
 */
export function isValidArray(
  value: unknown,
  minLength = 0,
  maxLength = 1000
): value is unknown[] {
  if (!Array.isArray(value)) return false;
  return value.length >= minLength && value.length <= maxLength;
}

/**
 * Remove XSS-vulnerable patterns from HTML strings
 * Note: For user-generated HTML, use a proper HTML sanitizer library (DOMPurify, sanitize-html)
 * This is for basic text sanitization only
 * @param text Text to sanitize
 * @returns Sanitized text
 */
export function sanitizeHtmlText(text: unknown): string {
  if (typeof text !== 'string') return '';
  
  return text
    .trim()
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .slice(0, 10000); // Limit to 10KB
}

/**
 * Validate MongoDB query to prevent injection
 * Ensures keys don't start with $
 * @param obj Object to validate
 * @returns true if safe for MongoDB query
 */
export function isValidMongoQuery(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) {
    return true; // Primitives are safe
  }

  if (Array.isArray(obj)) {
    return obj.every((item) => isValidMongoQuery(item));
  }

  // Check that no keys start with $ (prevents injection operators)
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$')) {
      return false;
    }
    // Recursively check nested objects
    if (typeof (obj as Record<string, unknown>)[key] === 'object') {
      if (!isValidMongoQuery((obj as Record<string, unknown>)[key])) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Validate role against allowed roles
 * @param role Role to validate
 * @param allowedRoles Array of allowed roles
 * @returns true if role is valid
 */
export function isValidRole(
  role: unknown,
  allowedRoles: readonly string[]
): boolean {
  if (typeof role !== 'string') return false;
  return allowedRoles.includes(role);
}

/**
 * Normalize phone number (remove non-digits, keep + prefix)
 * @param phone Phone number to normalize
 * @returns Normalized phone number
 */
export function normalizePhoneNumber(phone: unknown): string {
  if (typeof phone !== 'string') return '';
  
  const cleaned = phone.replace(/\D/g, '');
  const withPlus = phone.includes('+') ? '+' + cleaned : cleaned;
  
  // Valid phone: 7-15 digits (E.164 standard)
  if (cleaned.length < 7 || cleaned.length > 15) {
    return '';
  }
  
  return withPlus;
}

/**
 * Validate phone number
 * @param phone Phone number to validate
 * @returns true if valid phone format
 */
export function isValidPhoneNumber(phone: unknown): boolean {
  if (typeof phone !== 'string') return false;
  const normalized = normalizePhoneNumber(phone);
  return normalized.length > 0;
}

/**
 * Create a validation result object
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Create empty validation result
 */
export function createValidationResult(): ValidationResult {
  return {
    isValid: true,
    errors: {},
  };
}

/**
 * Add validation error
 */
export function addValidationError(
  result: ValidationResult,
  field: string,
  message: string
): ValidationResult {
  result.isValid = false;
  result.errors[field] = message;
  return result;
}

/**
 * Validate required field
 */
export function validateRequiredField(
  result: ValidationResult,
  field: string,
  value: unknown,
  fieldName?: string
): ValidationResult {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return addValidationError(result, field, `${fieldName || field} is required`);
  }
  return result;
}
