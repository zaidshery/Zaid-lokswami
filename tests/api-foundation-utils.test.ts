import { describe, expect, it } from 'vitest';
import {
  longPublicCache,
  mediumPublicCache,
  noStore,
  shortPublicCache,
} from '@/lib/api/cache';
import { API_ERROR_CODES, ApiError, serializeApiError } from '@/lib/api/errors';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
  paginationMeta,
} from '@/lib/api/response';
import { parseQuery, validateInput } from '@/lib/api/validation';

describe('api foundation utilities', () => {
  it('builds reusable cache header presets without changing existing callers', () => {
    expect(noStore()['Cache-Control']).toContain('no-store');
    expect(shortPublicCache()['Cache-Control']).toContain('s-maxage=30');
    expect(mediumPublicCache()['Cache-Control']).toContain('s-maxage=300');
    expect(longPublicCache()['Cache-Control']).toContain('s-maxage=3600');
  });

  it('creates standard success and error envelopes', () => {
    const meta = paginationMeta({ limit: 20, hasMore: false });
    expect(createSuccessEnvelope([{ id: 'article-1' }], meta)).toEqual({
      success: true,
      data: [{ id: 'article-1' }],
      meta,
      error: null,
    });

    const error = new ApiError('Missing article', {
      status: 404,
      code: API_ERROR_CODES.NOT_FOUND,
    });

    expect(createErrorEnvelope(error)).toEqual({
      success: false,
      data: null,
      meta: null,
      error: serializeApiError(error),
    });
  });

  it('supports lightweight validation without requiring a schema dependency', () => {
    const result = parseQuery('http://localhost/api/news?limit=20&tag=city&tag=crime');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        limit: '20',
        tag: ['city', 'crime'],
      });
    }

    const failed = validateInput({ limit: 'too-large' }, () => {
      throw new Error('limit must be numeric');
    });

    expect(failed.success).toBe(false);
    if (!failed.success) {
      expect(failed.error.status).toBe(422);
      expect(failed.issues[0]?.message).toBe('limit must be numeric');
    }
  });
});
