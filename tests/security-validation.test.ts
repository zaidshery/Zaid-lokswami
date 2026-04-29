import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  isValidObjectId,
  isValidString,
  sanitizeString,
  isValidUrl,
  isValidSlug,
  isValidInteger,
  isValidEnum,
  isValidArray,
  sanitizeHtmlText,
  isValidMongoQuery,
  isValidRole,
  normalizePhoneNumber,
  isValidPhoneNumber,
  createValidationResult,
  addValidationError,
  validateRequiredField,
} from '@/lib/security/validation';
import {
  validateStringField,
  validateEmailField,
  validateObjectIdField,
  validateIntegerField,
  validateEnumField,
} from '@/lib/security/validateRequest';

describe('Email Validation', () => {
  it('should validate valid emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('john.doe@company.co.uk')).toBe(true);
    expect(isValidEmail('test+tag@example.com')).toBe(true);
  });

  it('should reject invalid emails', () => {
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(123)).toBe(false);
  });

  it('should reject emails that are too long', () => {
    const longEmail = 'a'.repeat(300) + '@example.com';
    expect(isValidEmail(longEmail)).toBe(false);
  });
});

describe('MongoDB ObjectID Validation', () => {
  it('should validate valid ObjectIDs', () => {
    expect(isValidObjectId('507f1f77bcf86cd799439011')).toBe(true);
    expect(isValidObjectId('507F1F77BCF86CD799439011')).toBe(true);
  });

  it('should reject invalid ObjectIDs', () => {
    expect(isValidObjectId('507f1f77bcf86cd79943901')).toBe(false); // too short
    expect(isValidObjectId('507f1f77bcf86cd7994390111')).toBe(false); // too long
    expect(isValidObjectId('507f1f77bcf86cd799439g11')).toBe(false); // invalid char
    expect(isValidObjectId('')).toBe(false);
    expect(isValidObjectId(null)).toBe(false);
  });
});

describe('String Validation', () => {
  it('should validate strings within bounds', () => {
    expect(isValidString('hello')).toBe(true);
    expect(isValidString('x', 1, 10)).toBe(true);
    expect(isValidString('hello world', 1, 20)).toBe(true);
  });

  it('should reject strings outside bounds', () => {
    expect(isValidString('', 1, 10)).toBe(false); // empty
    expect(isValidString('x'.repeat(100), 1, 50)).toBe(false); // too long
    expect(isValidString(123 as unknown as string)).toBe(false);
  });

  it('should sanitize strings', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
    expect(sanitizeString('   ')).toBe('');
    expect(sanitizeString(123 as unknown as string)).toBe('');
  });
});

describe('URL Validation', () => {
  it('should validate valid URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://example.com/path')).toBe(true);
  });

  it('should reject invalid URLs', () => {
    expect(isValidUrl('not-a-url')).toBe(false);
    expect(isValidUrl('ftp://example.com')).toBe(false); // FTP not allowed
    expect(isValidUrl('javascript:alert("xss")')).toBe(false);
    expect(isValidUrl('')).toBe(false);
  });
});

describe('Slug Validation', () => {
  it('should validate valid slugs', () => {
    expect(isValidSlug('hello-world')).toBe(true);
    expect(isValidSlug('my-article-123')).toBe(true);
    expect(isValidSlug('single')).toBe(true);
  });

  it('should reject invalid slugs', () => {
    expect(isValidSlug('Hello-World')).toBe(false); // uppercase
    expect(isValidSlug('hello_world')).toBe(false); // underscore
    expect(isValidSlug('hello-')).toBe(false); // ends with hyphen
    expect(isValidSlug('-hello')).toBe(false); // starts with hyphen
    expect(isValidSlug('hello world')).toBe(false); // space
  });
});

describe('Integer Validation', () => {
  it('should validate integers within range', () => {
    expect(isValidInteger(42)).toBe(true);
    expect(isValidInteger(0, 0, 100)).toBe(true);
    expect(isValidInteger(100, 0, 100)).toBe(true);
  });

  it('should reject non-integers', () => {
    expect(isValidInteger(42.5)).toBe(false);
    expect(isValidInteger('42')).toBe(false);
    expect(isValidInteger(null)).toBe(false);
  });

  it('should reject integers outside range', () => {
    expect(isValidInteger(150, 0, 100)).toBe(false);
    expect(isValidInteger(-1, 0, 100)).toBe(false);
  });
});

describe('Enum Validation', () => {
  const roles = ['admin', 'user', 'guest'] as const;

  it('should validate enum values', () => {
    expect(isValidEnum('admin', roles)).toBe(true);
    expect(isValidEnum('user', roles)).toBe(true);
  });

  it('should reject invalid enum values', () => {
    expect(isValidEnum('invalid', roles)).toBe(false);
    expect(isValidEnum('ADMIN', roles)).toBe(false);
  });
});

describe('Array Validation', () => {
  it('should validate arrays within bounds', () => {
    expect(isValidArray([])).toBe(true);
    expect(isValidArray([1, 2, 3], 1, 10)).toBe(true);
  });

  it('should reject non-arrays', () => {
    expect(isValidArray('not-an-array')).toBe(false);
    expect(isValidArray(null)).toBe(false);
  });

  it('should reject arrays outside bounds', () => {
    expect(isValidArray([1, 2, 3], 5, 10)).toBe(false);
    expect(isValidArray([1, 2, 3], 0, 2)).toBe(false);
  });
});

describe('HTML Text Sanitization', () => {
  it('should remove HTML tags', () => {
    expect(sanitizeHtmlText('<p>Hello</p>')).toBe('pHello/p');
    expect(sanitizeHtmlText('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
  });

  it('should remove javascript: protocol', () => {
    expect(sanitizeHtmlText('javascript:alert("xss")')).toBe('alert("xss")');
  });

  it('should limit length', () => {
    const longText = 'a'.repeat(20000);
    expect(sanitizeHtmlText(longText).length).toBe(10000);
  });
});

describe('MongoDB Query Validation', () => {
  it('should allow valid queries', () => {
    expect(isValidMongoQuery({ name: 'John' })).toBe(true);
    expect(isValidMongoQuery({ age: 25, email: 'john@example.com' })).toBe(true);
  });

  it('should reject queries with $ operators', () => {
    expect(isValidMongoQuery({ $ne: null })).toBe(false);
    expect(isValidMongoQuery({ name: { $regex: 'test' } })).toBe(false);
  });

  it('should allow primitives', () => {
    expect(isValidMongoQuery('string')).toBe(true);
    expect(isValidMongoQuery(123)).toBe(true);
    expect(isValidMongoQuery(null)).toBe(true);
  });

  it('should recursively validate nested objects', () => {
    expect(isValidMongoQuery({ user: { name: 'John' } })).toBe(true);
    expect(isValidMongoQuery({ user: { $set: { name: 'John' } } })).toBe(false);
  });
});

describe('Role Validation', () => {
  const validRoles = ['admin', 'reporter', 'viewer'] as const;

  it('should validate valid roles', () => {
    expect(isValidRole('admin', validRoles)).toBe(true);
  });

  it('should reject invalid roles', () => {
    expect(isValidRole('invalid', validRoles)).toBe(false);
    expect(isValidRole(null, validRoles)).toBe(false);
  });
});

describe('Phone Number Validation', () => {
  it('should normalize phone numbers', () => {
    expect(normalizePhoneNumber('123-456-7890')).toBe('1234567890');
    expect(normalizePhoneNumber('+1 (234) 567-8900')).toBe('+12345678900');
  });

  it('should validate phone numbers', () => {
    expect(isValidPhoneNumber('1234567890')).toBe(true);
    expect(isValidPhoneNumber('+12345678900')).toBe(true);
  });

  it('should reject invalid phone numbers', () => {
    expect(isValidPhoneNumber('123')).toBe(false); // too short
    expect(isValidPhoneNumber('a'.repeat(20))).toBe(false); // no digits
  });
});

describe('Validation Result Builder', () => {
  it('should create empty validation result', () => {
    const result = createValidationResult();
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('should add validation errors', () => {
    let result = createValidationResult();
    result = addValidationError(result, 'email', 'Invalid email');
    result = addValidationError(result, 'password', 'Too short');

    expect(result.isValid).toBe(false);
    expect(result.errors.email).toBe('Invalid email');
    expect(result.errors.password).toBe('Too short');
  });

  it('should validate required fields', () => {
    let result = createValidationResult();
    result = validateRequiredField(result, 'name', '', 'Name');

    expect(result.isValid).toBe(false);
    expect(result.errors.name).toContain('required');
  });
});

describe('Request Validation Helpers', () => {
  it('should validate string fields', () => {
    const result1 = validateStringField('hello', 1, 100);
    expect(result1.value).toBe('hello');
    expect(result1.error).toBeUndefined();

    const result2 = validateStringField('', 1, 100);
    expect(result2.value).toBeNull();
    expect(result2.error).toBeDefined();
  });

  it('should validate email fields', () => {
    const result1 = validateEmailField('user@example.com');
    expect(result1.value).toBe('user@example.com');
    expect(result1.error).toBeUndefined();

    const result2 = validateEmailField('invalid');
    expect(result2.value).toBeNull();
    expect(result2.error).toBeDefined();
  });

  it('should validate ObjectID fields', () => {
    const result1 = validateObjectIdField('507f1f77bcf86cd799439011');
    expect(result1.value).toBe('507f1f77bcf86cd799439011');

    const result2 = validateObjectIdField('invalid');
    expect(result2.value).toBeNull();
    expect(result2.error).toBeDefined();
  });

  it('should validate integer fields', () => {
    const result1 = validateIntegerField(42, 0, 100);
    expect(result1.value).toBe(42);

    const result2 = validateIntegerField(150, 0, 100);
    expect(result2.value).toBeNull();
    expect(result2.error).toBeDefined();
  });

  it('should validate enum fields', () => {
    const roles = ['admin', 'user'] as const;

    const result1 = validateEnumField('admin', roles);
    expect(result1.value).toBe('admin');

    const result2 = validateEnumField('invalid', roles);
    expect(result2.value).toBeNull();
    expect(result2.error).toBeDefined();
  });
});
