/**
 * Example: API Route with Validation
 * 
 * This demonstrates how to use the validation utilities in a real API route.
 * Copy this pattern to other endpoints that need input validation.
 * 
 * Usage:
 * 1. Import validation helpers
 * 2. Call validateJsonBody() to parse and validate request body
 * 3. Validate individual fields using helpers
 * 4. Return 400 on validation errors
 * 5. Log validation failures for monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/db/mongoose';
import Article from '@/lib/models/Article';
import {
  validateJsonBody,
  validateStringField,
  validateObjectIdField,
  validateEnumField,
  createValidationErrorResponse,
  logValidationFailure,
} from '@/lib/security/validateRequest';

// Example 1: Creating an article (POST /api/admin/articles)
export async function exampleCreateArticle(request: NextRequest) {
  // Validate authentication
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse and validate request body
  const { body: rawBody, error: bodyError } = await validateJsonBody(request);
  if (bodyError) {
    logValidationFailure('/api/admin/articles', 'INVALID_JSON', {
      userId: session.user.id,
      error: bodyError.message,
    });
    return NextResponse.json(bodyError, { status: 400 });
  }

  const body = rawBody as Record<string, unknown>;
  const errors: Record<string, string> = {};

  // Validate title (required, 1-200 chars)
  const titleValidation = validateStringField(body.title, 1, 200, 'title');
  if (titleValidation.error) {
    errors.title = titleValidation.error;
  }

  // Validate content (required, 10-50000 chars)
  const contentValidation = validateStringField(body.content, 10, 50000, 'content');
  if (contentValidation.error) {
    errors.content = contentValidation.error;
  }

  // Validate category (required, from enum)
  const validCategories = ['news', 'sports', 'politics', 'business', 'tech'] as const;
  const categoryValidation = validateEnumField(body.category, validCategories, 'category');
  if (categoryValidation.error) {
    errors.category = categoryValidation.error;
  }

  // If any validation errors, return 400
  if (Object.keys(errors).length > 0) {
    logValidationFailure('/api/admin/articles', 'VALIDATION_ERROR', {
      userId: session.user.id,
      errors,
    });
    return createValidationErrorResponse(errors, 'Article validation failed');
  }

  // Connect to database
  await connectDB();

  // Create article with validated data
  try {
    const article = new Article({
      title: titleValidation.value,
      content: contentValidation.value,
      category: categoryValidation.value,
      createdBy: session.user.id,
    });

    await article.save();

    return NextResponse.json(article, { status: 201 });
  } catch (error) {
    console.error('Error creating article:', error);
    return NextResponse.json({ error: 'Failed to create article' }, { status: 500 });
  }
}

// Example 2: Updating an article (PUT /api/admin/articles/[id])
export async function exampleUpdateArticle(request: NextRequest, id: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate article ID from path parameter
  const idValidation = validateObjectIdField(id, 'article id');
  if (idValidation.error) {
    logValidationFailure(`/api/admin/articles/${id}`, 'INVALID_ID', {
      userId: session.user.id,
      id,
    });
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: idValidation.error },
      { status: 400 }
    );
  }

  // Parse and validate request body
  const { body: rawBody, error: bodyError } = await validateJsonBody(request);
  if (bodyError) {
    return NextResponse.json(bodyError, { status: 400 });
  }

  const body = rawBody as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  // Validate optional fields
  if (body.title !== undefined) {
    const titleValidation = validateStringField(body.title, 1, 200, 'title');
    if (titleValidation.error) {
      errors.title = titleValidation.error;
    } else {
      updates.title = titleValidation.value;
    }
  }

  if (body.content !== undefined) {
    const contentValidation = validateStringField(body.content, 10, 50000, 'content');
    if (contentValidation.error) {
      errors.content = contentValidation.error;
    } else {
      updates.content = contentValidation.value;
    }
  }

  if (Object.keys(errors).length > 0) {
    logValidationFailure(`/api/admin/articles/${id}`, 'VALIDATION_ERROR', {
      userId: session.user.id,
      errors,
    });
    return createValidationErrorResponse(errors, 'Article validation failed');
  }

  // Update database
  await connectDB();

  try {
    const article = await Article.findByIdAndUpdate(idValidation.value, updates, {
      new: true,
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    return NextResponse.json(article);
  } catch (error) {
    console.error('Error updating article:', error);
    return NextResponse.json({ error: 'Failed to update article' }, { status: 500 });
  }
}

/**
 * PATTERN SUMMARY
 * ================
 *
 * 1. AUTHENTICATE
 *    Check that user is logged in and has permission
 *
 * 2. VALIDATE BODY
 *    Use validateJsonBody() to parse and check JSON
 *
 * 3. VALIDATE FIELDS
 *    For each field:
 *    - Use appropriate validator (email, string, enum, etc)
 *    - Collect all errors in an object
 *    - Check errors.length > 0 to decide to return 400
 *
 * 4. LOG FAILURES
 *    Use logValidationFailure() to track patterns
 *
 * 5. SANITIZE
 *    Validated values are already sanitized
 *    Use the .value property from validators
 *
 * 6. PROCESS
 *    Only proceed with validated data
 *
 * 7. RETURN ERRORS
 *    Use createValidationErrorResponse() for 400 responses
 *
 * VALIDATORS TO USE
 * ==================
 *
 * String fields:       validateStringField(value, min, max, fieldName)
 * Email fields:        validateEmailField(value, fieldName)
 * ID fields:           validateObjectIdField(value, fieldName)
 * Integer fields:      validateIntegerField(value, min, max, fieldName)
 * Enum fields:         validateEnumField(value, allowedValues, fieldName)
 * Custom logic:        Use validation.ts helpers (isValidEmail, etc)
 *
 * COMMON PATTERNS
 * ================
 *
 * Required field:
 *   if (!value) {
 *     errors.field = 'Field is required';
 *   }
 *
 * Optional field:
 *   if (value !== undefined) {
 *     const result = validateStringField(value, ...);
 *     if (result.error) errors.field = result.error;
 *     else updates.field = result.value;
 *   }
 *
 * Array of items:
 *   if (!Array.isArray(value)) errors.field = 'Must be an array';
 *   else if (value.length === 0) errors.field = 'Cannot be empty';
 *   else updates.field = value;
 *
 * Response formats:
 *   Error:   createValidationErrorResponse(errors, message)
 *   Success: NextResponse.json(result, { status: 201 })
 */
