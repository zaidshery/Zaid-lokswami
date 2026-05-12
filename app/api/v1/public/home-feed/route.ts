import { shortPublicCache } from '@/lib/api/cache';
import { ApiError, API_ERROR_CODES } from '@/lib/api/errors';
import { apiErrorResponse, apiSuccessResponse } from '@/lib/api/response';
import { getPublicHomeFeed } from '@/lib/server/publicHomeFeed';

const HOME_FEED_CACHE_HEADERS = shortPublicCache({
  sMaxAge: 60,
  staleWhileRevalidate: 300,
});

export async function GET() {
  try {
    const result = await getPublicHomeFeed();

    return apiSuccessResponse(result.feed, {
      headers: HOME_FEED_CACHE_HEADERS,
      meta: {
        source: result.source,
        limits: result.limits,
      },
    });
  } catch (error) {
    console.error('Failed to load public home feed:', error);

    return apiErrorResponse(
      new ApiError('Failed to load home feed', {
        code: API_ERROR_CODES.INTERNAL_ERROR,
        status: 500,
        cause: error,
      })
    );
  }
}
