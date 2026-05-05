import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import EPaper from '@/lib/models/EPaper';
import EPaperArticle from '@/lib/models/EPaperArticle';
import User from '@/lib/models/User';
import { getAdminSession } from '@/lib/auth/admin';
import { canViewPage } from '@/lib/auth/permissions';
import {
  deleteAssetFile,
  parsePublishDate,
} from '@/lib/utils/epaperStorage';
import { resolveEpaperCoverImagePath } from '@/lib/utils/epaperCover';
import {
  getCityNameFromSlug,
  normalizeCityName,
  normalizeCitySlug,
} from '@/lib/constants/epaperCities';
import {
  buildEpaperAutomationInfo,
  buildEpaperReadiness,
} from '@/lib/utils/epaperAdminReadiness';
import { buildEpaperEditionQualitySummary } from '@/lib/utils/epaperQualitySignals';
import {
  applyEpaperProductionUpdate,
  resolveEpaperProduction,
} from '@/lib/workflow/epaper';
import { canTransitionEpaperProduction, getAllowedEpaperProductionTransitions } from '@/lib/workflow/transitions';
import { isEpaperProductionStatus } from '@/lib/workflow/types';
import {
  buildEpaperActivityMessage,
  recordEpaperActivity,
} from '@/lib/server/epaperActivity';
import { isEPaperPageReviewStatus } from '@/lib/types/epaper';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type EpaperPage = {
  pageNumber: number;
  imagePath: string;
  width: number | undefined;
  height: number | undefined;
  reviewStatus: 'pending' | 'needs_attention' | 'ready';
  reviewNote: string;
  reviewedAt: string | null;
  reviewedBy: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
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
        reviewStatus: isEPaperPageReviewStatus(source.reviewStatus)
          ? source.reviewStatus
          : 'pending',
        reviewNote: typeof source.reviewNote === 'string' ? source.reviewNote.trim() : '',
        reviewedAt:
          source.reviewedAt instanceof Date
            ? source.reviewedAt.toISOString()
            : typeof source.reviewedAt === 'string' && source.reviewedAt.trim()
            ? source.reviewedAt
            : null,
        reviewedBy:
          typeof source.reviewedBy === 'object' &&
          source.reviewedBy !== null &&
          typeof (source.reviewedBy as { id?: unknown }).id === 'string'
            ? {
                id: String((source.reviewedBy as { id?: unknown }).id || ''),
                name: String((source.reviewedBy as { name?: unknown }).name || ''),
                email: String((source.reviewedBy as { email?: unknown }).email || ''),
                role: String((source.reviewedBy as { role?: unknown }).role || ''),
              }
            : null,
      } satisfies EpaperPage;
    })
    .filter((page): page is EpaperPage => Boolean(page))
    .sort((a, b) => a.pageNumber - b.pageNumber);
}

function mapEpaper(epaper: unknown) {
  const source = asObject(epaper);
  const publishDate = new Date(String(source.publishDate || ''));
  const pages = normalizePages(source.pages);
  const production = resolveEpaperProduction({
    productionStatus: source.productionStatus,
    productionAssignee: source.productionAssignee,
    productionNotes: source.productionNotes,
    qaCompletedAt: source.qaCompletedAt,
    status: source.status,
  });
  return {
    _id: String(source._id || ''),
    citySlug: String(source.citySlug || ''),
    cityName: String(source.cityName || ''),
    title: String(source.title || ''),
    publishDate: Number.isNaN(publishDate.getTime()) ? '' : publishDate.toISOString().slice(0, 10),
    pdfPath: firstNonEmptyString(source.pdfPath, source.pdfUrl),
    thumbnailPath: resolveEpaperCoverImagePath({
      thumbnailPath: source.thumbnailPath,
      thumbnail: source.thumbnail,
      pages,
    }),
    pageCount: Math.max(toPositiveInt(source.pageCount), pages.length),
    pages,
    status: source.status === 'published' ? 'published' : 'draft',
    productionStatus: production.productionStatus,
    productionAssignee: production.productionAssignee,
    productionNotes: production.productionNotes.map((note) => ({
      ...note,
      createdAt: note.createdAt.toISOString(),
    })),
    qaCompletedAt: production.qaCompletedAt?.toISOString() || null,
    sourceType: firstNonEmptyString(source.sourceType),
    sourceLabel: firstNonEmptyString(source.sourceLabel),
    sourceUrl: firstNonEmptyString(source.sourceUrl),
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

function compactMetadata(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry === null || entry === undefined) return false;
      if (typeof entry === 'string') return entry.trim().length > 0;
      if (Array.isArray(entry)) return entry.length > 0;
      return true;
    })
  );
}

async function resolveAssignee(assignedToId: string) {
  const normalized = assignedToId.trim();
  if (!normalized) return null;

  const query = Types.ObjectId.isValid(normalized)
    ? { _id: normalized }
    : { email: normalized.toLowerCase() };
  const assignee = await User.findOne(query).select('_id name email role').lean();
  if (!assignee || typeof assignee.role !== 'string' || assignee.role === 'reader') {
    return null;
  }

  return {
    id: String(assignee._id || ''),
    name: String(assignee.name || '').trim() || String(assignee.email || '').trim(),
    email: String(assignee.email || '').trim(),
    role: assignee.role,
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

function normalizeQualityArticles(value: unknown[]) {
  return value.map((entry) => {
    const source = asObject(entry);
    return {
      _id: String(source._id || ''),
      epaperId: String(source.epaperId || ''),
      pageNumber: Number(source.pageNumber || 0),
      excerpt: String(source.excerpt || ''),
      contentHtml: String(source.contentHtml || ''),
      coverImagePath: String(source.coverImagePath || ''),
      title: String(source.title || ''),
      slug: String(source.slug || ''),
      hotspot: { x: 0, y: 0, w: 0, h: 0 },
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
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    if (!canViewPage(admin.role, 'epapers')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
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

    const [epaper, articles] = await Promise.all([
      EPaper.findById(id).lean(),
      EPaperArticle.find({ epaperId: id })
        .select('pageNumber excerpt contentHtml coverImagePath')
        .lean(),
    ]);

    if (!epaper) {
      return NextResponse.json(
        { success: false, error: 'E-paper not found' },
        { status: 404 }
      );
    }

    const mapped = mapEpaper(epaper);
    const normalizedArticles = normalizeQualityArticles(
      Array.isArray(articles) ? articles : []
    );
    const readiness = buildEpaperReadiness({
      epaper: mapped,
      articles: normalizedArticles,
    });
    const production = resolveEpaperProduction({
      productionStatus: epaper.productionStatus,
      productionAssignee: epaper.productionAssignee,
      productionNotes: epaper.productionNotes,
      qaCompletedAt: epaper.qaCompletedAt,
      status: epaper.status,
      readiness,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...mapped,
        productionStatus: production.productionStatus,
        productionAssignee: production.productionAssignee,
        productionNotes: production.productionNotes.map((note) => ({
          ...note,
          createdAt: note.createdAt.toISOString(),
        })),
        qaCompletedAt: production.qaCompletedAt?.toISOString() || null,
        articleCount: normalizedArticles.length,
        pagesWithImage: readiness.pagesWithImage,
        pagesMissingImage: readiness.pagesMissingImage,
        readiness,
        automation: buildEpaperAutomationInfo(mapped),
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
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    if (!canViewPage(admin.role, 'epapers')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
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
    const previousMapped = mapEpaper(current);

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
      if (status === 'published') {
        updates.productionStatus = 'published';
      }
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

    await recordEpaperActivity({
      epaperId: id,
      actor: admin,
      action: 'metadata_update',
      fromStatus: previousMapped.productionStatus as never,
      toStatus: mapEpaper(updated).productionStatus as never,
      message: buildEpaperActivityMessage({ action: 'metadata_update' }),
      metadata: {
        changedFields: Object.keys(updates),
      },
    });

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

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    if (!canViewPage(admin.role, 'epapers')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
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

    const [current, articles] = await Promise.all([
      EPaper.findById(id).lean(),
      EPaperArticle.find({ epaperId: id })
        .select('pageNumber excerpt contentHtml coverImagePath')
        .lean(),
    ]);

    if (!current) {
      return NextResponse.json(
        { success: false, error: 'E-paper not found' },
        { status: 404 }
      );
    }

    const mapped = mapEpaper(current);
    const normalizedArticles = normalizeQualityArticles(
      Array.isArray(articles) ? articles : []
    );
    const readiness = buildEpaperReadiness({
      epaper: mapped,
      articles: normalizedArticles,
    });
    const editionQuality = buildEpaperEditionQualitySummary({
      pageCount: mapped.pageCount,
      pages: mapped.pages,
      articles: normalizedArticles,
    });
    const currentProduction = resolveEpaperProduction({
      productionStatus: current.productionStatus,
      productionAssignee: current.productionAssignee,
      productionNotes: current.productionNotes,
      qaCompletedAt: current.qaCompletedAt,
      status: current.status,
      readiness,
    });

    const nextStatus =
      typeof source.productionStatus === 'string' && isEpaperProductionStatus(source.productionStatus)
        ? source.productionStatus
        : undefined;
    const note =
      typeof source.note === 'string'
        ? source.note.trim()
        : typeof source.productionNote === 'string'
          ? source.productionNote.trim()
          : '';
    const hasAssigneeField = Object.prototype.hasOwnProperty.call(source, 'assignedToId');

    if (!nextStatus && !note && !hasAssigneeField) {
      return NextResponse.json(
        { success: false, error: 'No production updates were provided' },
        { status: 400 }
      );
    }

    if (
      nextStatus &&
      nextStatus !== currentProduction.productionStatus &&
      !canTransitionEpaperProduction(currentProduction.productionStatus, nextStatus)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot move production from ${currentProduction.productionStatus} to ${nextStatus}`,
        },
        { status: 400 }
      );
    }

    const publishBlockers = Array.from(
      new Set([...readiness.blockers, ...editionQuality.publishBlockers])
    );

    if (nextStatus === 'ready_to_publish' && publishBlockers.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `This edition still has blockers: ${publishBlockers.join(' ')}`,
        },
        { status: 400 }
      );
    }

    let assignedTo = undefined as Awaited<ReturnType<typeof resolveAssignee>> | undefined;
    if (hasAssigneeField) {
      const assignedToId = String(source.assignedToId || '').trim();
      if (!assignedToId) {
        assignedTo = null;
      } else {
        assignedTo = await resolveAssignee(assignedToId);
        if (!assignedTo) {
          return NextResponse.json(
            { success: false, error: 'Valid assignedToId is required' },
            { status: 400 }
          );
        }
      }
    }

    const { fromStatus, toStatus, nextProduction } = applyEpaperProductionUpdate({
      currentProduction,
      actor: admin,
      nextStatus,
      assignedTo,
      note,
    });

    const updated = await EPaper.findByIdAndUpdate(
      id,
      {
        productionStatus: nextProduction.productionStatus,
        productionAssignee: nextProduction.productionAssignee,
        productionNotes: nextProduction.productionNotes,
        qaCompletedAt: nextProduction.qaCompletedAt,
        ...(toStatus === 'published' ? { status: 'published' } : {}),
      },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'E-paper not found' },
        { status: 404 }
      );
    }

    const action =
      nextStatus && nextStatus !== fromStatus
        ? nextStatus
        : hasAssigneeField
          ? 'assign'
          : 'note';

    await recordEpaperActivity({
      epaperId: id,
      actor: admin,
      action,
      fromStatus: fromStatus as never,
      toStatus: toStatus as never,
      message: buildEpaperActivityMessage({
        action,
        toStatus,
        assignedTo: nextProduction.productionAssignee,
      }),
      metadata: compactMetadata({
        assignedToId: nextProduction.productionAssignee?.id || '',
        assignedToName: nextProduction.productionAssignee?.name || '',
        note,
        readinessStatus: readiness.status,
        blockers: publishBlockers,
        allowedNextStatuses: getAllowedEpaperProductionTransitions(toStatus),
      }),
    });

    const mappedUpdated = mapEpaper(updated);
    const nextReadiness = buildEpaperReadiness({
      epaper: mappedUpdated,
      articles: normalizedArticles,
    });
    const nextProductionResolved = resolveEpaperProduction({
      productionStatus: updated.productionStatus,
      productionAssignee: updated.productionAssignee,
      productionNotes: updated.productionNotes,
      qaCompletedAt: updated.qaCompletedAt,
      status: updated.status,
      readiness: nextReadiness,
    });

    return NextResponse.json({
      success: true,
      message: buildEpaperActivityMessage({
        action,
        toStatus,
        assignedTo: nextProduction.productionAssignee,
      }),
      data: {
        ...mappedUpdated,
        productionStatus: nextProductionResolved.productionStatus,
        productionAssignee: nextProductionResolved.productionAssignee,
        productionNotes: nextProductionResolved.productionNotes.map((note) => ({
          ...note,
          createdAt: note.createdAt.toISOString(),
        })),
        qaCompletedAt: nextProductionResolved.qaCompletedAt?.toISOString() || null,
        articleCount: normalizedArticles.length,
        pagesWithImage: nextReadiness.pagesWithImage,
        pagesMissingImage: nextReadiness.pagesMissingImage,
        readiness: nextReadiness,
        automation: buildEpaperAutomationInfo(mappedUpdated),
      },
    });
  } catch (error) {
    console.error('Failed to update e-paper production:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update e-paper production' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    if (!canViewPage(admin.role, 'epapers')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
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
