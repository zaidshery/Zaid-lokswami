import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import EPaper from '@/lib/models/EPaper';
import {
  getCityNameFromSlug,
  getCitySlugFromName,
  isEPaperCitySlug,
} from '@/lib/constants/epaperCities';
import { parsePublishDate } from '@/lib/utils/epaperStorage';
import { listStoredEPapers } from '@/lib/storage/epapersFile';

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
    const citySlug = (searchParams.get('citySlug') || '').trim().toLowerCase();
    const date = (searchParams.get('date') || '').trim();
    const limit = parsePositiveInt(searchParams.get('limit'), 20, 100);
    const page = parsePositiveInt(searchParams.get('page'), 1, 500);

    const requestedStatus = (searchParams.get('status') || 'published').trim().toLowerCase();
    if (requestedStatus && requestedStatus !== 'published') {
      return NextResponse.json(
        { success: false, error: 'Public endpoint only supports published e-papers' },
        { status: 400 }
      );
    }

    let parsedDateFilter: Date | null = null;

    if (citySlug) {
      if (!isEPaperCitySlug(citySlug)) {
        return NextResponse.json(
          { success: false, error: 'Invalid citySlug' },
          { status: 400 }
        );
      }
    }

    if (date) {
      const parsedDate = parsePublishDate(date);
      if (!parsedDate) {
        return NextResponse.json(
          { success: false, error: 'Invalid date. Use YYYY-MM-DD.' },
          { status: 400 }
        );
      }
      parsedDateFilter = parsedDate;
    }

    if (await shouldUseFileStore()) {
      const cityName = citySlug ? getCityNameFromSlug(citySlug) : '';
      const publishDate = parsedDateFilter ? parsedDateFilter.toISOString().slice(0, 10) : null;
      const { data: fileRows, total } = await listStoredEPapers({
        city: cityName || null,
        publishDate,
        limit,
        page,
      });

      const data = fileRows.map((row) => {
        const safe = JSON.parse(JSON.stringify(row)) as Record<string, unknown>;
        return mapStoredRecord(safe);
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
    }

    const query: Record<string, unknown> = { status: 'published' };
    if (citySlug) {
      query.citySlug = citySlug;
    }
    if (parsedDateFilter) {
      const next = new Date(parsedDateFilter);
      next.setUTCDate(next.getUTCDate() + 1);
      query.publishDate = { $gte: parsedDateFilter, $lt: next };
    }

    const skip = (page - 1) * limit;
    const [records, total] = await Promise.all([
      EPaper.find(query).sort({ publishDate: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      EPaper.countDocuments(query),
    ]);

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
