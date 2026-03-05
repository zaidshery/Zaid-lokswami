import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import EPaper from '@/lib/models/EPaper';
import EPaperArticle from '@/lib/models/EPaperArticle';
import { verifyAdminToken } from '@/lib/auth/adminToken';
import {
  deleteAssetFile,
  parsePublishDate,
} from '@/lib/utils/epaperStorage';
import {
  getCityNameFromSlug,
  normalizeCityName,
  normalizeCitySlug,
} from '@/lib/constants/epaperCities';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type EpaperPage = {
  pageNumber: number;
  imagePath: string;
  width: number | undefined;
  height: number | undefined;
};

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
        imagePath: typeof source.imagePath === 'string' ? source.imagePath : '',
        width: toOptionalPositiveInt(source.width),
        height: toOptionalPositiveInt(source.height),
      } satisfies EpaperPage;
    })
    .filter((page): page is EpaperPage => Boolean(page))
    .sort((a, b) => a.pageNumber - b.pageNumber);
}

function mapEpaper(epaper: unknown) {
  const source = asObject(epaper);
  const publishDate = new Date(String(source.publishDate || ''));
  const pages = normalizePages(source.pages);
  return {
    _id: String(source._id || ''),
    citySlug: String(source.citySlug || ''),
    cityName: String(source.cityName || ''),
    title: String(source.title || ''),
    publishDate: Number.isNaN(publishDate.getTime()) ? '' : publishDate.toISOString().slice(0, 10),
    pdfPath: firstNonEmptyString(source.pdfPath, source.pdfUrl),
    thumbnailPath: firstNonEmptyString(source.thumbnailPath, source.thumbnail),
    pageCount: Math.max(toPositiveInt(source.pageCount), pages.length),
    pages,
    status: source.status === 'published' ? 'published' : 'draft',
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

function normalizePageCount(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 0;
  return Math.min(1000, Math.floor(parsed));
}

function buildPages(
  pageCount: number,
  currentPages: Array<{ pageNumber: number; imagePath?: string; width?: number; height?: number }>
) {
  const byPage = new Map<number, (typeof currentPages)[number]>();
  for (const page of currentPages) {
    if (!Number.isFinite(page.pageNumber) || page.pageNumber < 1) continue;
    byPage.set(page.pageNumber, page);
  }

  return Array.from({ length: pageCount }, (_, index) => {
    const pageNumber = index + 1;
    const existing = byPage.get(pageNumber);
    return {
      pageNumber,
      imagePath: existing?.imagePath || '',
      width: existing?.width,
      height: existing?.height,
    };
  });
}

function resolveCityName(citySlug: string, inputCityName: string) {
  const normalizedInputName = normalizeCityName(inputCityName);
  if (normalizedInputName) return normalizedInputName;
  const mapped = getCityNameFromSlug(citySlug);
  if (mapped) return mapped;
  return inputCityName.trim();
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const admin = verifyAdminToken(req);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();
    const { id } = await context.params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid e-paper ID' },
        { status: 400 }
      );
    }

    const [epaper, articleCount] = await Promise.all([
      EPaper.findById(id).lean(),
      EPaperArticle.countDocuments({ epaperId: id }),
    ]);

    if (!epaper) {
      return NextResponse.json(
        { success: false, error: 'E-paper not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...mapEpaper(epaper),
        articleCount,
      },
    });
  } catch (error) {
    console.error('Failed to fetch e-paper:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch e-paper' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const admin = verifyAdminToken(req);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();
    const { id } = await context.params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid e-paper ID' },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const source = typeof body === 'object' && body ? (body as Record<string, unknown>) : {};

    const current = await EPaper.findById(id).lean();
    if (!current) {
      return NextResponse.json(
        { success: false, error: 'E-paper not found' },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};

    if (typeof source.title === 'string') {
      const title = source.title.trim();
      if (!title) {
        return NextResponse.json(
          { success: false, error: 'title cannot be empty' },
          { status: 400 }
        );
      }
      updates.title = title;
    }

    if (typeof source.status === 'string') {
      const status = source.status.trim().toLowerCase();
      if (status !== 'draft' && status !== 'published') {
        return NextResponse.json(
          { success: false, error: 'Invalid status' },
          { status: 400 }
        );
      }
      updates.status = status;
    }

    if (typeof source.citySlug === 'string') {
      const citySlug = normalizeCitySlug(source.citySlug);
      if (!citySlug) {
        return NextResponse.json(
          { success: false, error: 'Invalid citySlug' },
          { status: 400 }
        );
      }
      updates.citySlug = citySlug;

      const cityName = resolveCityName(
        citySlug,
        typeof source.cityName === 'string' ? source.cityName : String(current.cityName || '')
      );
      if (!cityName) {
        return NextResponse.json(
          { success: false, error: 'cityName is required' },
          { status: 400 }
        );
      }
      updates.cityName = cityName;
    } else if (typeof source.cityName === 'string') {
      const cityName = resolveCityName(String(current.citySlug || ''), source.cityName);
      if (!cityName) {
        return NextResponse.json(
          { success: false, error: 'cityName is required' },
          { status: 400 }
        );
      }
      updates.cityName = cityName;
    }

    if (typeof source.publishDate === 'string') {
      const publishDate = parsePublishDate(source.publishDate);
      if (!publishDate) {
        return NextResponse.json(
          { success: false, error: 'publishDate must be valid (YYYY-MM-DD)' },
          { status: 400 }
        );
      }
      updates.publishDate = publishDate;
    }

    const requestedPageCount = normalizePageCount(source.pageCount);
    if (requestedPageCount > 0) {
      updates.pageCount = requestedPageCount;
      updates.pages = buildPages(
        requestedPageCount,
        Array.isArray(current.pages) ? current.pages : []
      );
    }

    const updated = await EPaper.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).lean();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'E-paper not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'E-paper updated successfully',
      data: mapEpaper(updated),
    });
  } catch (error: unknown) {
    const isDuplicateKeyError =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 11000;
    if (isDuplicateKeyError) {
      return NextResponse.json(
        { success: false, error: 'An e-paper for this city/date already exists' },
        { status: 409 }
      );
    }

    console.error('Failed to update e-paper:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update e-paper' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const admin = verifyAdminToken(req);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();
    const { id } = await context.params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid e-paper ID' },
        { status: 400 }
      );
    }

    const epaper = await EPaper.findById(id).lean();
    if (!epaper) {
      return NextResponse.json(
        { success: false, error: 'E-paper not found' },
        { status: 404 }
      );
    }

    await Promise.all([
      EPaper.deleteOne({ _id: id }),
      EPaperArticle.deleteMany({ epaperId: id }),
    ]);

    const pageImagePaths = Array.isArray(epaper.pages)
      ? epaper.pages
          .map((entry) =>
            typeof entry === 'object' && entry !== null && 'imagePath' in entry
              ? String((entry as { imagePath?: unknown }).imagePath || '')
              : ''
          )
          .filter(Boolean)
      : [];
    const epaperSource = asObject(epaper);

    await Promise.all(
      [
        firstNonEmptyString(epaperSource.pdfPath, epaperSource.pdfUrl),
        firstNonEmptyString(epaperSource.thumbnailPath, epaperSource.thumbnail),
        ...pageImagePaths,
      ].map((assetPath) => deleteAssetFile(assetPath).catch(() => undefined))
    );

    return NextResponse.json({
      success: true,
      message: 'E-paper and associated assets deleted',
    });
  } catch (error) {
    console.error('Failed to delete e-paper:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete e-paper' },
      { status: 500 }
    );
  }
}
