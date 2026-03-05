import { headers } from 'next/headers';
import VideosPageClient, {
  type PublicCursor,
  type PublicVideoFeedItem,
} from './VideosPageClient';

const VIDEOS_LIMIT = 20;

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

function normalizeBaseUrl(raw: string) {
  const fallback = 'http://localhost:3000';
  if (!raw) return fallback;
  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return fallback;
  }
}

async function resolveRequestOrigin() {
  const headerStore = await headers();
  const forwardedHost = headerStore.get('x-forwarded-host');
  const host = forwardedHost || headerStore.get('host');
  const forwardedProto = headerStore.get('x-forwarded-proto');

  if (host) {
    const proto =
      forwardedProto || (host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
    return `${proto}://${host}`;
  }

  return normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL || '');
}

async function fetchInitialVideosFeed() {
  try {
    const origin = await resolveRequestOrigin();
    const response = await fetch(`${origin}/api/videos/latest?limit=${VIDEOS_LIMIT}`, {
      cache: 'no-store',
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
