import type { Metadata } from 'next';
import { buildLatestPageMetadata } from '@/lib/seo/readerPageMetadata';
import { parsePublicArticlesPayload } from '@/lib/content/publicArticles';
import { resolveRequestOrigin } from '@/lib/server/requestOrigin';
import LatestFeedClient, { type LatestFeedApiItem, type LatestFeedCursor } from './LatestFeedClient';

const LATEST_PAGE_LIMIT = 20;

export const metadata: Metadata = buildLatestPageMetadata();

async function fetchInitialLatestFeed() {
  const empty = {
    items: [] as LatestFeedApiItem[],
    limit: LATEST_PAGE_LIMIT,
    hasMore: false,
    nextCursor: null as LatestFeedCursor | null,
  };

  try {
    const origin = await resolveRequestOrigin();
    const fetchFeed = async (path: string) => {
      const response = await fetch(path, { next: { revalidate: 60 } });
      const payload = await response.json().catch(() => null);
      if (!response.ok) return null;
      return parsePublicArticlesPayload(payload, LATEST_PAGE_LIMIT);
    };

    const v1Feed = await fetchFeed(
      `${origin}/api/v1/public/articles?limit=${LATEST_PAGE_LIMIT}`
    );

    if (v1Feed?.items.length || v1Feed?.hasMore) {
      return v1Feed;
    }

    const legacyFeed = await fetchFeed(
      `${origin}/api/articles/latest?limit=${LATEST_PAGE_LIMIT}`
    );

    return legacyFeed || empty;
  } catch {
    return empty;
  }
}

export default async function LatestNewsPage() {
  const initial = await fetchInitialLatestFeed();

  return (
    <LatestFeedClient
      initialItems={initial.items}
      initialLimit={initial.limit}
      initialHasMore={initial.hasMore}
      initialNextCursor={initial.nextCursor}
    />
  );
}
