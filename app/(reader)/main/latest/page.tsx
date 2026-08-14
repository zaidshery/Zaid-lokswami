import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { buildLatestPageMetadata } from '@/lib/seo/readerPageMetadata';
import { listPublicArticles } from '@/lib/server/publicArticles';
import type { LatestFeedApiItem, LatestFeedCursor } from './LatestFeedClient';
import LatestFeedClient from './LatestFeedClient';

const LATEST_PAGE_LIMIT = 20;

export const metadata: Metadata = buildLatestPageMetadata();

const getCachedLatestFeed = unstable_cache(
  async () => {
    try {
      const result = await listPublicArticles({
        limit: LATEST_PAGE_LIMIT,
      });

      return {
        items: (result.items || []) as unknown as LatestFeedApiItem[],
        limit: result.limit || LATEST_PAGE_LIMIT,
        hasMore: Boolean(result.hasMore),
        nextCursor: (result.nextCursor || null) as LatestFeedCursor | null,
      };
    } catch {
      return {
        items: [] as LatestFeedApiItem[],
        limit: LATEST_PAGE_LIMIT,
        hasMore: false,
        nextCursor: null as LatestFeedCursor | null,
      };
    }
  },
  ['reader-latest-feed'],
  { revalidate: 60, tags: ['articles', 'latest-feed'] }
);

export default async function LatestNewsPage() {
  const initial = await getCachedLatestFeed();

  return (
    <LatestFeedClient
      initialItems={initial.items}
      initialLimit={initial.limit}
      initialHasMore={initial.hasMore}
      initialNextCursor={initial.nextCursor}
    />
  );
}
