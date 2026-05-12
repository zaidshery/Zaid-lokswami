import { longPublicCache } from '@/lib/api/cache';
import { apiSuccessResponse } from '@/lib/api/response';
import { listPublicCategories } from '@/lib/server/publicTaxonomy';

const PUBLIC_CATEGORIES_CACHE_HEADERS = longPublicCache({
  sMaxAge: 3600,
  staleWhileRevalidate: 86400,
});

export async function GET() {
  return apiSuccessResponse(
    { items: listPublicCategories() },
    {
      headers: PUBLIC_CATEGORIES_CACHE_HEADERS,
      meta: { source: 'static' },
    }
  );
}
