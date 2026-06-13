import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { buildEpaperPageMetadata } from '@/lib/seo/readerPageMetadata';
import {
  getPublicEpaperForMetadata,
  getPublicEpaperStoryForMetadata,
} from '@/lib/server/publicEpaperMetadata';
import { listPublicEpaperFeed } from '@/lib/server/publicEpaperFeed';
import { parseUiDateInput } from '@/lib/utils/dateFormat';
import {
  parsePublicEpaperFilters,
  resolvePublicEpaperCityFilter,
  type EPaperCityFilter,
} from '@/lib/utils/publicEpaperFilters';
import EPaperPageClient, {
  type PublicCursor,
  type PublicEPaperListItem,
} from './EPaperPageClient';

const EPAPER_LIMIT = 12;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function parseLimit(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return EPAPER_LIMIT;
  return parsed;
}

function toSingleString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function parsePositiveInt(value: string | string[] | undefined) {
  const parsed = Number.parseInt(toSingleString(value).trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 0;
  return Math.floor(parsed);
}

function resolveInitialFilters(params: Record<string, string | string[] | undefined>) {
  const cityRaw = toSingleString(params.city).trim().toLowerCase();
  const dateRaw = toSingleString(params.date).trim();

  const city = resolvePublicEpaperCityFilter(cityRaw);
  const parsedDate = parseUiDateInput(dateRaw);
  const date =
    typeof parsedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsedDate) ? parsedDate : '';

  return {
    city,
    date,
  };
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const resolvedParams = searchParams ? await searchParams : {};
  const filters = resolveInitialFilters(resolvedParams);
  const paperId = toSingleString(resolvedParams.paper).trim();
  const requestedPage = parsePositiveInt(resolvedParams.page);
  const storyToken = toSingleString(resolvedParams.story).trim();
  const shouldResolveIssue = Boolean(paperId || filters.city !== 'all' || filters.date);
  const issue = shouldResolveIssue
    ? await getPublicEpaperForMetadata({
        id: paperId,
        citySlug: filters.city === 'all' ? '' : filters.city,
        publishDate: filters.date,
      })
    : null;
  const story =
    storyToken && (issue?.id || paperId)
      ? await getPublicEpaperStoryForMetadata({
          epaperId: issue?.id || paperId,
          storyToken,
        })
      : null;
  const resolvedPage = requestedPage || story?.pageNumber || 0;
  const ogParams = new URLSearchParams();
  if (issue?.id || paperId) {
    ogParams.set('paper', issue?.id || paperId);
  }
  if (issue?.citySlug || filters.city !== 'all') {
    ogParams.set('city', issue?.citySlug || filters.city);
  }
  if (issue?.publishDate || filters.date) {
    ogParams.set('date', issue?.publishDate || filters.date);
  }
  if (resolvedPage > 0) {
    ogParams.set('page', String(resolvedPage));
  }
  if (story?.slug || storyToken) {
    ogParams.set('story', story?.slug || storyToken);
  }

  return buildEpaperPageMetadata({
    city: issue?.citySlug || filters.city,
    publishDate: issue?.publishDate || filters.date,
    paperId: issue?.id || paperId,
    page: resolvedPage,
    storyToken: story?.slug || storyToken,
    issueTitle: issue?.title,
    issueCityName: issue?.cityName,
    storyTitle: story?.title,
    storyExcerpt: story?.excerpt,
    storyPage: story?.pageNumber,
    image: `/api/og/epaper${ogParams.size ? `?${ogParams.toString()}` : ''}`,
  });
}

async function listInitialEPapers(city: EPaperCityFilter, publishDate: string) {
  const query = new URLSearchParams();
  if (city !== 'all') {
    query.set('citySlug', city);
  }
  if (publishDate) {
    query.set('date', publishDate);
  }
  const parsed = parsePublicEpaperFilters(query);
  if ('error' in parsed) {
    throw new Error(parsed.error);
  }

  return listPublicEpaperFeed({
    filters: parsed.filters,
    limit: EPAPER_LIMIT,
  });
}

const listCachedDefaultEPapers = unstable_cache(
  () => listInitialEPapers('all', ''),
  ['public-epaper-feed-first-page-v1'],
  { revalidate: 300 }
);

async function fetchInitialEPapers(city: EPaperCityFilter, publishDate: string) {
  try {
    const payload =
      city === 'all' && !publishDate
        ? await listCachedDefaultEPapers()
        : await listInitialEPapers(city, publishDate);
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
  // Force trigger rebuild of epaper client layout after modifications v3
  const resolvedParams = searchParams ? await searchParams : {};
  const filters = resolveInitialFilters(resolvedParams);
  const initial = await fetchInitialEPapers(filters.city, filters.date);

  return (
    <EPaperPageClient
      initialItems={initial.items}
      initialLimit={initial.limit}
      initialHasMore={initial.hasMore}
      initialNextCursor={initial.nextCursor}
      initialCity={filters.city}
      initialPublishDate={filters.date}
    />
  );
}
