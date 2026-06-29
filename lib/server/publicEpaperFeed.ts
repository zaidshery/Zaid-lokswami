import {
  getCityNameFromSlug,
  getCitySlugFromName,
} from '@/lib/constants/epaperCities';
import {
  isMongoAvailable,
  reportMongoUnavailable,
} from '@/lib/db/mongoAvailability';
import EPaper from '@/lib/models/EPaper';
import { listAllStoredEPapers } from '@/lib/storage/epapersFile';
import { resolveEpaperCoverImagePath } from '@/lib/utils/epaperCover';
import {
  buildPublicEpaperMongoQuery,
  matchesPublicEpaperMetadata,
  type PublicEpaperFilterState,
} from '@/lib/utils/publicEpaperFilters';
import { normalizeEPaperPublicationType } from '@/lib/types/epaper';
import {
  cursorPage,
  type CursorPageResult,
} from '@/lib/utils/cursorPage';

export type PublicEpaperFeedItem = {
  _id: string;
  publicationType: 'epaper' | 'emagazine';
  citySlug: string;
  cityName: string;
  title: string;
  publishDate: string;
  thumbnailPath: string;
  pdfPath: string;
  status: 'published';
  pageCount: number;
  pagesWithImage: number;
  editionDate: string;
  publishedAt: string;
};

type PublicEpaperFeedInput = {
  filters: PublicEpaperFilterState;
  limit?: unknown;
  cursorPublishedAt?: string | null;
  cursorId?: string | null;
};

const DEFAULT_QUERY_TIMEOUT_MS = 2000;

function parsePositiveEnvInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

function asObject(value: unknown) {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function toIsoDate(value: unknown) {
  const parsed = new Date(
    value instanceof Date || typeof value === 'string' || typeof value === 'number'
      ? value
      : Date.now()
  );
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

function toDateLabel(value: unknown) {
  const date = new Date(
    value instanceof Date || typeof value === 'string' || typeof value === 'number'
      ? value
      : Date.now()
  );
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function toPositiveInt(value: unknown, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function normalizePages(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asObject(entry))
    .map((entry) => ({
      pageNumber: toPositiveInt(entry.pageNumber),
      imagePath: String(entry.imagePath || ''),
    }))
    .filter((entry) => entry.pageNumber > 0);
}

function mapMongoItem(raw: Record<string, unknown>): PublicEpaperFeedItem | null {
  const id =
    typeof raw._id === 'string' ? raw._id : raw._id ? String(raw._id) : '';
  if (!id) return null;

  const pages = normalizePages(raw.pages);
  const pageCount = Math.max(toPositiveInt(raw.pageCount), pages.length, 1);
  const publishDate = toDateLabel(raw.publishDate);
  const editionDate = toIsoDate(raw.publishDate || raw.publishedAt || raw.createdAt);

  return {
    _id: id,
    publicationType: normalizeEPaperPublicationType(raw.publicationType),
    citySlug: String(raw.citySlug || ''),
    cityName: String(raw.cityName || ''),
    title: String(raw.title || ''),
    publishDate,
    thumbnailPath: resolveEpaperCoverImagePath({
      thumbnailPath: raw.thumbnailPath,
      thumbnail: raw.thumbnail,
      pages,
    }),
    pdfPath: firstNonEmptyString(raw.pdfPath, raw.pdfUrl),
    status: 'published',
    pageCount,
    pagesWithImage: pages.filter((page) => Boolean(page.imagePath.trim())).length,
    editionDate,
    publishedAt: editionDate,
  };
}

function mapFileItem(raw: Record<string, unknown>): PublicEpaperFeedItem | null {
  const id = typeof raw._id === 'string' ? raw._id : raw._id ? String(raw._id) : '';
  if (!id) return null;

  const publishDateRaw = String(raw.publishDate || '').trim();
  const publishDate = publishDateRaw || toDateLabel(raw.publishedAt);
  const editionDate = toIsoDate(raw.publishDate || raw.publishedAt);
  const cityName = String(raw.city || '');

  return {
    _id: id,
    publicationType: 'epaper',
    citySlug: getCitySlugFromName(cityName),
    cityName,
    title: String(raw.title || ''),
    publishDate,
    thumbnailPath: firstNonEmptyString(raw.thumbnailPath, raw.thumbnail),
    pdfPath: firstNonEmptyString(raw.pdfPath, raw.pdfUrl),
    status: 'published',
    pageCount: Math.max(toPositiveInt(raw.pages), 1),
    pagesWithImage: 0,
    editionDate,
    publishedAt: toIsoDate(raw.publishedAt || editionDate),
  };
}

async function listFromFileStore(
  input: PublicEpaperFeedInput
): Promise<CursorPageResult<PublicEpaperFeedItem>> {
  if (input.filters.publicationType !== 'epaper') {
    return cursorPage<PublicEpaperFeedItem>({
      arrayItems: [],
      limit: input.limit,
      dateField: 'editionDate',
      fallbackDateFields: ['publishDate', 'publishedAt'],
      cursorPublishedAt: input.cursorPublishedAt,
      cursorId: input.cursorId,
      mapItem: (raw) => mapFileItem(asObject(raw)),
    });
  }

  const cityNameFilter = input.filters.citySlug
    ? getCityNameFromSlug(input.filters.citySlug)
    : '';
  const dateFilter = input.filters.parsedDate
    ? input.filters.parsedDate.toISOString().slice(0, 10)
    : '';
  const rows = await listAllStoredEPapers();

  const filtered = rows.filter((item) => {
    if (cityNameFilter && item.city !== cityNameFilter) return false;
    if (dateFilter && item.publishDate !== dateFilter) return false;
    if (
      !dateFilter &&
      input.filters.month &&
      !String(item.publishDate || '').startsWith(`${input.filters.month}-`)
    ) {
      return false;
    }
    if (
      input.filters.query &&
      !matchesPublicEpaperMetadata(
        {
          title: item.title,
          cityName: item.city,
          citySlug: getCitySlugFromName(item.city),
          publishDate: item.publishDate,
        },
        input.filters.query
      )
    ) {
      return false;
    }
    return true;
  });

  return cursorPage<PublicEpaperFeedItem>({
    arrayItems: filtered,
    limit: input.limit,
    dateField: 'editionDate',
    fallbackDateFields: ['publishDate', 'publishedAt'],
    cursorPublishedAt: input.cursorPublishedAt,
    cursorId: input.cursorId,
    mapItem: (raw) => mapFileItem(asObject(raw)),
  });
}

export async function listPublicEpaperFeed(
  input: PublicEpaperFeedInput
): Promise<CursorPageResult<PublicEpaperFeedItem>> {
  const mongoAvailable = await isMongoAvailable({
    label: 'public e-papers latest feed',
  });
  if (!mongoAvailable) {
    return listFromFileStore(input);
  }

  try {
    const queryTimeoutMs = parsePositiveEnvInt(
      'MONGODB_PUBLIC_QUERY_TIMEOUT_MS',
      DEFAULT_QUERY_TIMEOUT_MS
    );
    return await withTimeout(
      cursorPage<PublicEpaperFeedItem>({
        model: EPaper,
        mongoFilter: buildPublicEpaperMongoQuery(input.filters, {
          status: 'published',
          isCurrentRevision: { $ne: false },
        }),
        mongoProjection:
          '_id publicationType citySlug cityName title publishDate thumbnailPath thumbnail pdfPath pdfUrl status pageCount pages createdAt',
        limit: input.limit,
        dateField: 'editionDate',
        fallbackDateFields: ['publishDate', 'publishedAt'],
        mongoDateField: 'publishDate',
        cursorPublishedAt: input.cursorPublishedAt,
        cursorId: input.cursorId,
        mapItem: (raw) => mapMongoItem(asObject(raw)),
      }),
      queryTimeoutMs,
      'Public e-paper feed query'
    );
  } catch (error) {
    reportMongoUnavailable(error, 'public e-papers latest feed');
    console.error(
      'MongoDB query failed for public e-papers latest feed, using file store.',
      error
    );
    return listFromFileStore(input);
  }
}
