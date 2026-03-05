import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import EPaper from '@/lib/models/EPaper';
import { verifyAdminToken } from '@/lib/auth/adminToken';
import { isEPaperCitySlug } from '@/lib/constants/epaperCities';
import { parsePublishDate } from '@/lib/utils/epaperStorage';

type EpaperPage = {
  pageNumber: number;
  imagePath: string;
  width: number | undefined;
  height: number | undefined;
};

function parsePageParam(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function parseListLimit(value: string | null, fallback: number, max: number) {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'all') return null;

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function toIsoDate(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function asObject(value: unknown) {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
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

export async function GET(req: NextRequest) {
  try {
    const admin = verifyAdminToken(req);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const citySlug = (searchParams.get('citySlug') || '').trim().toLowerCase();
    const status = (searchParams.get('status') || '').trim().toLowerCase();
    const date = (searchParams.get('date') || '').trim();
    const limit = parseListLimit(searchParams.get('limit'), 20, 200);
    const page = parsePageParam(searchParams.get('page'), 1, 500);
    const isUnbounded = limit === null;
    const effectivePage = isUnbounded ? 1 : page;
    const effectiveLimit = isUnbounded ? 0 : limit;

    const query: Record<string, unknown> = {};

    if (citySlug) {
      if (!isEPaperCitySlug(citySlug)) {
        return NextResponse.json(
          { success: false, error: 'Invalid city slug' },
          { status: 400 }
        );
      }
      query.citySlug = citySlug;
    }

    if (status) {
      if (status !== 'draft' && status !== 'published') {
        return NextResponse.json(
          { success: false, error: 'Invalid status filter' },
          { status: 400 }
        );
      }
      query.status = status;
    }

    if (date) {
      const parsedDate = parsePublishDate(date);
      if (!parsedDate) {
        return NextResponse.json(
          { success: false, error: 'Invalid date. Use YYYY-MM-DD.' },
          { status: 400 }
        );
      }

      const next = new Date(parsedDate);
      next.setUTCDate(next.getUTCDate() + 1);
      query.publishDate = { $gte: parsedDate, $lt: next };
    }

    const skip = (effectivePage - 1) * effectiveLimit;
    let recordsQuery = EPaper.find(query).sort({ publishDate: -1, createdAt: -1 }).skip(skip);
    if (!isUnbounded) {
      recordsQuery = recordsQuery.limit(effectiveLimit);
    }

    const [records, total] = await Promise.all([
      recordsQuery.lean(),
      EPaper.countDocuments(query),
    ]);

    const data = records.map((record) => {
      const item = asObject(record);
      const pages = normalizePages(item.pages);
      const pageCount = Math.max(toPositiveInt(item.pageCount), pages.length);
      const pagesWithImage = pages.filter((pageItem) =>
        Boolean(String(pageItem.imagePath || '').trim())
      ).length;

      return {
        _id: String(item._id),
        citySlug: String(item.citySlug || ''),
        cityName: String(item.cityName || ''),
        title: String(item.title || ''),
        publishDate: toIsoDate(item.publishDate),
        pdfPath: String(item.pdfPath || ''),
        thumbnailPath: String(item.thumbnailPath || ''),
        pageCount,
        pages,
        status: item.status === 'published' ? 'published' : 'draft',
        pagesWithImage,
        pagesMissingImage: Math.max(0, pageCount - pagesWithImage),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        total,
        page: effectivePage,
        limit: isUnbounded ? total : effectiveLimit,
        pages: isUnbounded ? 1 : Math.ceil(total / effectiveLimit),
      },
    });
  } catch (error) {
    console.error('Failed to list e-papers:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list e-papers' },
      { status: 500 }
    );
  }
}
