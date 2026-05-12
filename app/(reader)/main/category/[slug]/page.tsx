import { parsePublicArticlesPayload } from '@/lib/content/publicArticles';
import type { PublicArticleApiItem } from '@/lib/content/publicArticles';
import { resolveRequestOrigin } from '@/lib/server/requestOrigin';
import CategoryPageClient from './CategoryPageClient';

type PageContext = {
  params: Promise<{ slug: string }>;
};

const CATEGORY_FEED_LIMIT = 120;

async function fetchInitialCategoryFeed(slug: string) {
  try {
    const origin = await resolveRequestOrigin();
    const fetchFeed = async (path: string) => {
      const response = await fetch(path, { next: { revalidate: 60 } });
      const payload = await response.json().catch(() => null);
      if (!response.ok) return [] as PublicArticleApiItem[];
      return parsePublicArticlesPayload(payload, CATEGORY_FEED_LIMIT).items;
    };

    const query = new URLSearchParams({
      limit: String(CATEGORY_FEED_LIMIT),
      category: slug,
    });
    const v1Items = await fetchFeed(
      `${origin}/api/v1/public/articles?${query.toString()}`
    );

    if (v1Items.length) return v1Items;

    return fetchFeed(`${origin}/api/articles/latest?limit=${CATEGORY_FEED_LIMIT}`);
  } catch {
    return [] as PublicArticleApiItem[];
  }
}

export default async function CategoryPage(context: PageContext) {
  const { slug: rawSlug } = await context.params;
  const slug = decodeURIComponent(rawSlug || '').toLowerCase();
  const initialItems = await fetchInitialCategoryFeed(slug);

  return <CategoryPageClient slug={slug} initialItems={initialItems} />;
}
