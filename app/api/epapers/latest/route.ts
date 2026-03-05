import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import EPaper from '@/lib/models/EPaper';
import {
  getCityNameFromSlug,
  getCitySlugFromName,
  isEPaperCitySlug,
} from '@/lib/constants/epaperCities';
import { parsePublishDate } from '@/lib/utils/epaperStorage';
import { listAllStoredEPapers } from '@/lib/storage/epapersFile';
import { cursorPage } from '@/lib/utils/cursorPage';

type PublicEPaperItem = {
  _id: string;
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

function asObject(value: unknown) {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
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

function mapMongoItem(raw: Record<string, unknown>): PublicEPaperItem | null {
  const id =
    typeof raw._id === 'string' ? raw._id : raw._id ? String(raw._id) : '';
  if (!id) return null;

  const pages = normalizePages(raw.pages);
  const pageCount = Math.max(toPositiveInt(raw.pageCount), pages.length, 1);
  const publishDate = toDateLabel(raw.publishDate);
  const editionDate = toIsoDate(raw.publishDate || raw.publishedAt || raw.createdAt);

  return {
    _id: id,
    citySlug: String(raw.citySlug || ''),
    cityName: String(raw.cityName || ''),
    title: String(raw.title || ''),
    publishDate,
    thumbnailPath: String(raw.thumbnailPath || ''),
    pdfPath: String(raw.pdfPath || ''),
    status: 'published',
    pageCount,
    pagesWithImage: pages.filter((page) => Boolean(page.imagePath.trim())).length,
    editionDate,
    // nextCursor.publishedAt still maps to editionDate timeline by helper.
    publishedAt: editionDate,
  };
}

function mapFileItem(raw: Record<string, unknown>): PublicEPaperItem | null {
  const id = typeof raw._id === 'string' ? raw._id : raw._id ? String(raw._id) : '';
  if (!id) return null;

  const publishDateRaw = String(raw.publishDate || '').trim();
  const publishDate = publishDateRaw || toDateLabel(raw.publishedAt);
  const editionDate = toIsoDate(raw.publishDate || raw.publishedAt);
  const cityName = String(raw.city || '');

  return {
    _id: id,
    citySlug: getCitySlugFromName(cityName),
    cityName,
    title: String(raw.title || ''),
    publishDate,
    thumbnailPath: String(raw.thumbnail || ''),
    pdfPath: String(raw.pdfUrl || ''),
    status: 'published',
    pageCount: Math.max(toPositiveInt(raw.pages), 1),
    pagesWithImage: 0,
    editionDate,
    publishedAt: toIsoDate(raw.publishedAt || editionDate),
  };
}

async function shouldUseFileStore() {
  if (!process.env.MONGODB_URI) return true;

  try {
    await connectDB();
    return false;
  } catch (error) {
    console.error('MongoDB unavailable for public e-papers latest route, using file store.', error);
    return true;
  }
}

function buildMongoFilters(searchParams: URLSearchParams) {
  const citySlug = (searchParams.get('citySlug') || '').trim().toLowerCase();
  const date = (searchParams.get('date') || '').trim();

  if (citySlug && !isEPaperCitySlug(citySlug)) {
    return { error: 'Invalid citySlug' } as const;
  }

  let parsedDate: Date | null = null;
  if (date) {
    parsedDate = parsePublishDate(date);
    if (!parsedDate) {
      return { error: 'Invalid date. Use YYYY-MM-DD.' } as const;
    }
  }

  const query: Record<string, unknown> = { status: 'published' };
  if (citySlug) {
    query.citySlug = citySlug;
  }
  if (parsedDate) {
    const next = new Date(parsedDate);
    next.setUTCDate(next.getUTCDate() + 1);
    query.publishDate = { $gte: parsedDate, $lt: next };
  }

  return { query, citySlug, parsedDate } as const;
}

export async function GET(req: NextRequest) {
  try {
    // Developer note:
    // First: /api/epapers/latest?limit=20
    // Next:  /api/epapers/latest?limit=20&cursorPublishedAt=...&cursorId=...
    const { searchParams } = new URL(req.url);
    const filters = buildMongoFilters(searchParams);
    if ('error' in filters) {
      return NextResponse.json(
        { items: [], limit: 20, hasMore: false, nextCursor: null },
        { status: 400 }
      );
    }

    const limit = searchParams.get('limit');
    const cursorPublishedAt = searchParams.get('cursorPublishedAt');
    const cursorId = searchParams.get('cursorId');

    if (await shouldUseFileStore()) {
      const cityNameFilter = filters.citySlug
        ? getCityNameFromSlug(filters.citySlug)
        : '';
      const dateFilter = filters.parsedDate
        ? filters.parsedDate.toISOString().slice(0, 10)
        : '';

      const rows = await listAllStoredEPapers();
      const filtered = rows.filter((item) => {
        if (cityNameFilter && item.city !== cityNameFilter) return false;
        if (dateFilter && item.publishDate !== dateFilter) return false;
        return true;
      });

      const result = await cursorPage<PublicEPaperItem>({
        arrayItems: filtered,
        limit,
        // Logical dateField for e-paper cursoring is editionDate.
        dateField: 'editionDate',
        fallbackDateFields: ['publishDate', 'publishedAt'],
        cursorPublishedAt,
        cursorId,
        mapItem: (raw) => mapFileItem(asObject(raw)),
      });

      return NextResponse.json(result);
    }

    const result = await cursorPage<PublicEPaperItem>({
      model: EPaper,
      mongoFilter: filters.query,
      mongoProjection:
        '_id citySlug cityName title publishDate thumbnailPath pdfPath status pageCount pages createdAt',
      limit,
      // Logical dateField for e-paper cursoring is editionDate.
      dateField: 'editionDate',
      fallbackDateFields: ['publishDate', 'publishedAt'],
      // In Mongo, editionDate maps to publishDate.
      mongoDateField: 'publishDate',
      cursorPublishedAt,
      cursorId,
      mapItem: (raw) => mapMongoItem(asObject(raw)),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch public e-papers latest feed:', error);
    return NextResponse.json(
      { items: [], limit: 20, hasMore: false, nextCursor: null },
      { status: 500 }
    );
  }
}
