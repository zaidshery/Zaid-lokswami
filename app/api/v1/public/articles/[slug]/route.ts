import { mediumPublicCache } from '@/lib/api/cache';
import { ApiError, API_ERROR_CODES } from '@/lib/api/errors';
import { apiErrorResponse, apiSuccessResponse } from '@/lib/api/response';
import { getPublicArticleBySlug } from '@/lib/server/publicArticles';

type RouteContext = {
  params: Promise<{ slug: string }>;
};

const PUBLIC_ARTICLE_DETAIL_CACHE_HEADERS = mediumPublicCache({
  sMaxAge: 120,
  staleWhileRevalidate: 600,
});

export async function GET(_: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const article = await getPublicArticleBySlug(slug);

    if (!article) {
      return apiErrorResponse(
        new ApiError('Article not found', {
          code: API_ERROR_CODES.NOT_FOUND,
          status: 404,
        }),
        {
          headers: PUBLIC_ARTICLE_DETAIL_CACHE_HEADERS,
        }
      );
    }

    return apiSuccessResponse(article.article, {
      headers: PUBLIC_ARTICLE_DETAIL_CACHE_HEADERS,
      meta: {
        source: article.source,
      },
    });
  } catch (error) {
    console.error('Failed to load API v1 public article detail:', error);

    return apiErrorResponse(
      new ApiError('Failed to load article', {
        code: API_ERROR_CODES.INTERNAL_ERROR,
        status: 500,
        cause: error,
      })
    );
  }
}
