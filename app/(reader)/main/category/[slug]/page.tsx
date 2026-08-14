import { unstable_cache } from 'next/cache';
import type { PublicArticleApiItem } from '@/lib/content/publicArticles';
import { listPublicArticles } from '@/lib/server/publicArticles';
import CategoryPageClient from './CategoryPageClient';

type PageContext = {
  params: Promise<{ slug: string }>;
};

const CATEGORY_FEED_LIMIT = 40;

const getCachedCategoryArticles = unstable_cache(
  async (slug: string) => {
    try {
      const result = await listPublicArticles({
        category: slug,
        limit: CATEGORY_FEED_LIMIT,
      });
      return (result.items || []) as unknown as PublicArticleApiItem[];
    } catch {
      return [] as PublicArticleApiItem[];
    }
  },
  ['reader-category-feed'],
  { revalidate: 60, tags: ['articles', 'category-feed'] }
);

export default async function CategoryPage(context: PageContext) {
  const { slug: rawSlug } = await context.params;
  const slug = decodeURIComponent(rawSlug || '').toLowerCase();
  const initialItems = await getCachedCategoryArticles(slug);

  return <CategoryPageClient slug={slug} initialItems={initialItems} />;
}
