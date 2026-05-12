import type { Metadata } from 'next';
import { buildVideosPageMetadata } from '@/lib/seo/readerPageMetadata';
import { resolveRequestOrigin } from '@/lib/server/requestOrigin';
import VideosPageClient, {
  type PublicCursor,
  type PublicVideoFeedItem,
} from './VideosPageClient';

const VIDEOS_LIMIT = 20;

export const metadata: Metadata = buildVideosPageMetadata();

type VideosLatestResponse = {
  items?: PublicVideoFeedItem[];
  limit?: number;
  hasMore?: boolean;
  nextCursor?: PublicCursor | null;
};

function parseLimit(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return VIDEOS_LIMIT;
  return parsed;
}

async function fetchInitialVideosFeed() {
  try {
    const origin = await resolveRequestOrigin();
    const response = await fetch(`${origin}/api/v1/public/videos?limit=${VIDEOS_LIMIT}`, {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return {
        items: [] as PublicVideoFeedItem[],
        limit: VIDEOS_LIMIT,
        hasMore: false,
        nextCursor: null as PublicCursor | null,
      };
    }

    const payload = (await response.json()) as VideosLatestResponse;
    return {
      items: Array.isArray(payload.items) ? payload.items : [],
      limit: parseLimit(payload.limit),
      hasMore: Boolean(payload.hasMore),
      nextCursor:
        payload.nextCursor &&
        typeof payload.nextCursor.publishedAt === 'string' &&
        typeof payload.nextCursor.id === 'string'
          ? payload.nextCursor
          : null,
    };
  } catch {
    return {
      items: [] as PublicVideoFeedItem[],
      limit: VIDEOS_LIMIT,
      hasMore: false,
      nextCursor: null as PublicCursor | null,
    };
  }
}

export default async function VideosPage() {
  const initial = await fetchInitialVideosFeed();

  return (
    <VideosPageClient
      initialItems={initial.items}
      initialLimit={initial.limit}
      initialHasMore={initial.hasMore}
      initialNextCursor={initial.nextCursor}
    />
  );
}
