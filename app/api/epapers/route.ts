import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import EPaper from '@/lib/models/EPaper';
import {
  getCityNameFromSlug,
  getCitySlugFromName,
} from '@/lib/constants/epaperCities';
import { listAllStoredEPapers } from '@/lib/storage/epapersFile';
import {
  buildPublicEpaperMongoQuery,
  matchesPublicEpaperMetadata,
  parsePublicEpaperFilters,
} from '@/lib/utils/publicEpaperFilters';

type EpaperPage = {
  pageNumber: number;
  imagePath: string;
  width: number | undefined;
  height: number | undefined;
};

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function toDateLabel(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
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

function toPositiveInt(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 0;
  return Math.floor(parsed);
}

function toOptionalPositiveInt(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return undefined;
  return Math.floor(parsed);
}

function normalizePages(value: unknown): EpaperPage[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      const source = asObject(entry);
      const pageNumber = toPositiveInt(source.pageNumber);
      if (!pageNumber) return null;
      return {
        pageNumber,
        imagePath:
          typeof source.imagePath === 'string' ? source.imagePath : '',
        width: toOptionalPositiveInt(source.width),
        height: toOptionalPositiveInt(source.height),
      } satisfies EpaperPage;
    })
    .filter((page): page is EpaperPage => Boolean(page))
    .sort((a, b) => a.pageNumber - b.pageNumber);
}

async function shouldUseFileStore() {
  if (!process.env.MONGODB_URI) return true;

  try {
    await connectDB();
    return false;
  } catch (error) {
    console.error('MongoDB unavailable for public e-papers route, using file store.', error);
    return true;
  }
}

function mapStoredRecord(record: Record<string, unknown>) {
  const cityName = String(record.city || '');
  const citySlug = getCitySlugFromName(cityName);
  const pageCount = Math.max(toPositiveInt(record.pages), 1);

  return {
    _id: String(record._id || ''),
    citySlug: citySlug || '',
    cityName,
    title: String(record.title || ''),
    publishDate: toDateLabel(record.publishDate),
    thumbnailPath: firstNonEmptyString(record.thumbnailPath, record.thumbnail),
    pdfPath: firstNonEmptyString(record.pdfPath, record.pdfUrl),
    status: 'published' as const,
    pageCount,
    pagesWithImage: 0,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parsePositiveInt(searchParams.get('limit'), 20, 100);
    const page = parsePositiveInt(searchParams.get('page'), 1, 500);

    const requestedStatus = (searchParams.get('status') || 'published').trim().toLowerCase();
    if (requestedStatus && requestedStatus !== 'published') {
      return NextResponse.json(
        { success: false, error: 'Public endpoint only supports published e-papers' },
        { status: 400 }
      );
    }

    const filterResult = parsePublicEpaperFilters(searchParams);
    if ('error' in filterResult) {
      return NextResponse.json(
        { success: false, error: filterResult.error },
        { status: 400 }
      );
    }
    const { filters } = filterResult;

    const cityName = filters.citySlug ? getCityNameFromSlug(filters.citySlug) : '';
    const publishDate = filters.parsedDate
      ? filters.parsedDate.toISOString().slice(0, 10)
      : null;
    const storedRows = await listAllStoredEPapers();
    const filteredRows = storedRows.filter((row) => {
      if (cityName && row.city !== cityName) return false;
      if (publishDate && row.publishDate !== publishDate) return false;
      if (!publishDate && filters.month && !String(row.publishDate || '').startsWith(`${filters.month}-`)) {
        return false;
      }
      if (
        filters.query &&
        !matchesPublicEpaperMetadata(
          {
            title: row.title,
            cityName: row.city,
            citySlug: getCitySlugFromName(row.city),
            publishDate: row.publishDate,
          },
          filters.query
        )
      ) {
        return false;
      }
      return true;
    });
    filteredRows.sort((a, b) => {
      const byPublishDate =
        new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime();
      if (byPublishDate !== 0) return byPublishDate;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
    const start = (page - 1) * limit;
    const pagedRows = filteredRows.slice(start, start + limit);

    const createFileResponse = () =>
      NextResponse.json({
        success: true,
        data: pagedRows.map((row) => {
          const safe = JSON.parse(JSON.stringify(row)) as Record<string, unknown>;
          return mapStoredRecord(safe);
        }),
        pagination: {
          total: filteredRows.length,
          page,
          limit,
          pages: Math.ceil(filteredRows.length / limit),
        },
      });

    if (await shouldUseFileStore()) {
      return createFileResponse();
    }

    const query = buildPublicEpaperMongoQuery(filters, { status: 'published' });

    const total = await EPaper.countDocuments(query);
    if (total === 0 && filteredRows.length > 0) {
      return createFileResponse();
    }

    const skip = (page - 1) * limit;
    const records = await EPaper.find(query)
      .sort({ publishDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const data = records.map((record) => {
      const item = asObject(record);
      const pages = normalizePages(item.pages);
      const pageCount = Math.max(toPositiveInt(item.pageCount), pages.length);
      const pagesWithImage = pages.filter((pageItem) => Boolean(String(pageItem.imagePath || '').trim())).length;

      return {
        _id: String(item._id),
        citySlug: String(item.citySlug || ''),
        cityName: String(item.cityName || ''),
        title: String(item.title || ''),
        publishDate: toDateLabel(item.publishDate),
        thumbnailPath: firstNonEmptyString(item.thumbnailPath, item.thumbnail),
        pdfPath: firstNonEmptyString(item.pdfPath, item.pdfUrl),
        status: 'published',
        pageCount,
        pagesWithImage,
      };
    });

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to list public e-papers:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list e-papers' },
      { status: 500 }
    );
  }
}
