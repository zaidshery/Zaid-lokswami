import { headers } from 'next/headers';
import {
  normalizeMetadataQuery,
  parseArchiveMonth,
  resolvePublicEpaperCityFilter,
  type EPaperCityFilter,
} from '@/lib/utils/publicEpaperFilters';
import EPaperPageClient, {
  type PublicCursor,
  type PublicEPaperListItem,
} from './EPaperPageClient';

const EPAPER_LIMIT = 20;

type LatestListResponse = {
  items?: PublicEPaperListItem[];
  limit?: number;
  hasMore?: boolean;
  nextCursor?: PublicCursor | null;
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function parseLimit(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return EPAPER_LIMIT;
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

function toSingleString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function resolveInitialFilters(params: Record<string, string | string[] | undefined>) {
  const cityRaw = toSingleString(params.city).trim().toLowerCase();
  const dateRaw = toSingleString(params.date).trim();
  const monthRaw = toSingleString(params.month).trim();
  const queryRaw = toSingleString(params.query || params.q).trim();

  const city = resolvePublicEpaperCityFilter(cityRaw);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : '';
  const month = date ? '' : parseArchiveMonth(monthRaw);
  const query = normalizeMetadataQuery(queryRaw);

  return {
    city,
    date,
    month,
    query,
  };
}

async function fetchInitialEPapers(
  city: EPaperCityFilter,
  publishDate: string,
  archiveMonth: string,
  queryText: string
) {
  try {
    const origin = await resolveRequestOrigin();
    const query = new URLSearchParams({ limit: String(EPAPER_LIMIT) });
    if (city !== 'all') {
      query.set('citySlug', city);
    }
    if (publishDate) {
      query.set('date', publishDate);
    }
    if (!publishDate && archiveMonth) {
      query.set('month', archiveMonth);
    }
    if (queryText) {
      query.set('query', queryText);
    }

    const response = await fetch(`${origin}/api/epapers/latest?${query.toString()}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        items: [] as PublicEPaperListItem[],
        limit: EPAPER_LIMIT,
        hasMore: false,
        nextCursor: null as PublicCursor | null,
      };
    }

    const payload = (await response.json()) as LatestListResponse;
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
      items: [] as PublicEPaperListItem[],
      limit: EPAPER_LIMIT,
      hasMore: false,
      nextCursor: null as PublicCursor | null,
    };
  }
}

export default async function EPaperPage({ searchParams }: PageProps) {
  const resolvedParams = searchParams ? await searchParams : {};
  const filters = resolveInitialFilters(resolvedParams);
  const initial = await fetchInitialEPapers(
    filters.city,
    filters.date,
    filters.month,
    filters.query
  );

  return (
    <EPaperPageClient
      initialItems={initial.items}
      initialLimit={initial.limit}
      initialHasMore={initial.hasMore}
      initialNextCursor={initial.nextCursor}
      initialCity={filters.city}
      initialPublishDate={filters.date}
      initialArchiveMonth={filters.month}
      initialSearchQuery={filters.query}
    />
  );
}
