import { shortPublicCache } from '@/lib/api/cache';
import { ApiError, API_ERROR_CODES } from '@/lib/api/errors';
import { apiErrorResponse, apiSuccessResponse, paginationMeta } from '@/lib/api/response';
import { parseQuery } from '@/lib/api/validation';
import { listPublicArticles, normalizePublicArticleLimit } from '@/lib/server/publicArticles';

const PUBLIC_SEARCH_CACHE_HEADERS = shortPublicCache({
  sMaxAge: 60,
  staleWhileRevalidate: 300,
});

function getQueryValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

export async function GET(request: Request) {
  try {
    const query = parseQuery(request);
    if (!query.success) {
      return apiErrorResponse(query.error);
    }

    const term = String(getQueryValue(query.data.q) || getQueryValue(query.data.query) || '').trim();
    if (term.length < 2) {
      return apiErrorResponse(
        new ApiError('Search query must be at least 2 characters', {
          code: API_ERROR_CODES.VALIDATION_ERROR,
          status: 422,
        })
      );
    }

    const limit = normalizePublicArticleLimit(getQueryValue(query.data.limit));
    const result = await listPublicArticles({
      limit,
      query: term,
      category: String(getQueryValue(query.data.category) || '').trim(),
      city: String(getQueryValue(query.data.city) || '').trim(),
      cursorPublishedAt: String(getQueryValue(query.data.cursorPublishedAt) || '').trim(),
      cursorId: String(getQueryValue(query.data.cursorId) || '').trim(),
    });

    return apiSuccessResponse(
      {
        items: result.items,
        query: term,
        filters: result.filters,
      },
      {
        headers: PUBLIC_SEARCH_CACHE_HEADERS,
        meta: {
          source: result.source,
          ...paginationMeta({
            limit: result.limit,
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
          }),
        },
      }
    );
  } catch (error) {
    console.error('Failed to search API v1 public articles:', error);

    return apiErrorResponse(
      new ApiError('Failed to search articles', {
        code: API_ERROR_CODES.INTERNAL_ERROR,
        status: 500,
        cause: error,
      })
    );
  }
}
