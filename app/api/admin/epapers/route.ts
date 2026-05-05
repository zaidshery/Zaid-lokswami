import { Types } from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import EPaper from '@/lib/models/EPaper';
import EPaperArticle from '@/lib/models/EPaperArticle';
import { getAdminSession } from '@/lib/auth/admin';
import { canViewPage } from '@/lib/auth/permissions';
import {
  getCityNameFromSlug,
  getCitySlugFromName,
  isEPaperCitySlug,
  normalizeCitySlug,
} from '@/lib/constants/epaperCities';
import { listStoredEPapers } from '@/lib/storage/epapersFile';
import { parsePublishDate } from '@/lib/utils/epaperStorage';
import {
  type EpaperUploadedAsset,
  verifyEpaperAssetUpload,
} from '@/lib/storage/epaperAssetUpload';
import { buildEpaperImageAutomationUpdates } from '@/lib/server/epaperImageAutomation';
import {
  buildEpaperAutomationInfo,
  buildEpaperReadiness,
} from '@/lib/utils/epaperAdminReadiness';
import { resolveEpaperCoverImagePath } from '@/lib/utils/epaperCover';
import { resolveEpaperProduction } from '@/lib/workflow/epaper';
import { isEPaperPageReviewStatus } from '@/lib/types/epaper';

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

function mapCreatedEpaper(epaper: unknown) {
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
    pdfPublicId: firstNonEmptyString(source.pdfPublicId),
    pdfFormat: firstNonEmptyString(source.pdfFormat),
    thumbnailPath: resolveEpaperCoverImagePath({
      thumbnailPath: source.thumbnailPath,
      thumbnail: source.thumbnail,
      pages,
    }),
    pageCount: toPositiveInt(source.pageCount),
    pages,
    status: source.status === 'published' ? 'published' : 'draft',
    sourceType: firstNonEmptyString(source.sourceType),
    sourceLabel: firstNonEmptyString(source.sourceLabel),
    sourceUrl: firstNonEmptyString(source.sourceUrl),
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

async function verifyAssetReference(kind: 'epaper_pdf' | 'epaper_thumbnail', value: unknown) {
  const source = asObject(value);
  const mediaKey = firstNonEmptyString(source.mediaKey, source.publicId);
  if (!mediaKey) {
    throw new Error(kind === 'epaper_pdf' ? 'Verified PDF asset is required' : 'Verified thumbnail asset is required');
  }

  return verifyEpaperAssetUpload({
    kind,
    mediaKey,
    expectedSize: toPositiveInt(source.mediaSizeBytes),
    expectedFileType: firstNonEmptyString(source.mediaMimeType),
    expectedFileName: firstNonEmptyString(source.fileName),
  });
}

async function verifyPageImageReferences(value: unknown) {
  if (!Array.isArray(value)) return [];

  const verified: Array<{
    pageNumber: number;
    asset: EpaperUploadedAsset;
    width?: number;
    height?: number;
  }> = [];

  for (let index = 0; index < value.length; index += 1) {
    const source = asObject(value[index]);
    const pageNumber = toPositiveInt(source.pageNumber) || index + 1;
    if (!pageNumber || pageNumber > 1000) {
      throw new Error('Each page image needs a valid pageNumber');
    }

    const mediaKey = firstNonEmptyString(source.mediaKey, source.publicId);
    if (!mediaKey) {
      throw new Error(`Verified page image asset is required for page ${pageNumber}`);
    }

    const asset = await verifyEpaperAssetUpload({
      kind: 'epaper_page_image',
      mediaKey,
      expectedSize: toPositiveInt(source.mediaSizeBytes),
      expectedFileType: firstNonEmptyString(source.mediaMimeType),
      expectedFileName: firstNonEmptyString(source.fileName),
    });

    verified.push({
      pageNumber,
      asset,
      width: toOptionalPositiveInt(source.width),
      height: toOptionalPositiveInt(source.height),
    });
  }

  return verified;
}

export async function GET(req: NextRequest) {
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

    const fileResult =
      !status || status === 'all' || status === 'published'
        ? await listStoredEPapers({
            city: citySlug ? getCityNameFromSlug(citySlug) : null,
            publishDate: date || null,
            limit: isUnbounded ? Number.MAX_SAFE_INTEGER : effectiveLimit,
            page: effectivePage,
          })
        : { data: [], total: 0 };

    const createFileResponse = () =>
      NextResponse.json({
        success: true,
        data: fileResult.data.map((row) => {
          const item = {
            _id: row._id,
            citySlug: getCitySlugFromName(row.city),
            cityName: row.city,
            title: row.title,
            publishDate: row.publishDate,
            pdfPath: row.pdfUrl,
            thumbnailPath: row.thumbnail,
            pageCount: Number(row.pages) || 1,
            pages: [],
            status: 'published' as const,
            pagesWithImage: 0,
            pagesMissingImage: Number(row.pages) || 1,
            sourceType: 'legacy' as const,
            sourceLabel: 'Legacy file store',
            sourceUrl: row.pdfUrl,
            createdAt: row.publishedAt,
            updatedAt: row.updatedAt,
          };
          const production = resolveEpaperProduction({
            status: 'published',
          });

          return {
            ...item,
            articleCount: 0,
            productionStatus: production.productionStatus,
            productionAssignee: production.productionAssignee,
            productionNotes: [],
            qaCompletedAt: null,
            readiness: buildEpaperReadiness({ epaper: item, articles: [] }),
            automation: buildEpaperAutomationInfo(item),
          };
        }),
        pagination: {
          total: fileResult.total,
          page: effectivePage,
          limit: isUnbounded ? fileResult.total : effectiveLimit,
          pages: isUnbounded ? 1 : Math.ceil(fileResult.total / effectiveLimit),
        },
      });

    try {
      await connectDB();
    } catch (error) {
      console.error('Mongo unavailable for admin e-papers, using file store:', error);
      return createFileResponse();
    }

    const total = await EPaper.countDocuments(query);
    if (total === 0 && fileResult.total > 0) {
      return createFileResponse();
    }

    const skip = (effectivePage - 1) * effectiveLimit;
    let recordsQuery = EPaper.find(query).sort({ publishDate: -1, createdAt: -1 }).skip(skip);
    if (!isUnbounded) {
      recordsQuery = recordsQuery.limit(effectiveLimit);
    }

    const records = await recordsQuery.lean();

    const data = records.map((record) => {
      const item = asObject(record);
          const pages = normalizePages(item.pages);
      const pageCount = Math.max(toPositiveInt(item.pageCount), pages.length);
      const pagesWithImage = pages.filter((pageItem) =>
        Boolean(String(pageItem.imagePath || '').trim())
      ).length;
      const production = resolveEpaperProduction({
        productionStatus: item.productionStatus,
        productionAssignee: item.productionAssignee,
        productionNotes: item.productionNotes,
        qaCompletedAt: item.qaCompletedAt,
        status: item.status,
      });

        return {
          _id: String(item._id),
          citySlug: String(item.citySlug || ''),
          cityName: String(item.cityName || ''),
          title: String(item.title || ''),
        publishDate: toIsoDate(item.publishDate),
        pdfPath: firstNonEmptyString(item.pdfPath, item.pdfUrl),
        thumbnailPath: resolveEpaperCoverImagePath({
          thumbnailPath: item.thumbnailPath,
          thumbnail: item.thumbnail,
          pages,
        }),
          pageCount,
          pages,
          status: item.status === 'published' ? 'published' : 'draft',
          productionStatus: production.productionStatus,
          productionAssignee: production.productionAssignee,
          productionNotes: production.productionNotes.map((note) => ({
            ...note,
            createdAt: note.createdAt.toISOString(),
          })),
          qaCompletedAt: production.qaCompletedAt?.toISOString() || null,
          pagesWithImage,
          pagesMissingImage: Math.max(0, pageCount - pagesWithImage),
          sourceType: firstNonEmptyString(item.sourceType),
          sourceLabel: firstNonEmptyString(item.sourceLabel),
          sourceUrl: firstNonEmptyString(item.sourceUrl),
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      });

    const epaperIds = data.map((item) => item._id).filter(Boolean);
    const articleStats =
      epaperIds.length > 0
        ? await EPaperArticle.aggregate<{
            _id: string;
            articleCount: number;
            pagesWithHotspots: number[];
            articlesWithReadableText: number;
          }>([
            {
              $match: {
                epaperId: {
                  $in: epaperIds.map((value) => new Types.ObjectId(value)),
                },
              },
            },
            {
              $group: {
                _id: '$epaperId',
                articleCount: { $sum: 1 },
                pagesWithHotspots: { $addToSet: '$pageNumber' },
                articlesWithReadableText: {
                  $sum: {
                    $cond: [
                      {
                        $or: [
                          { $gt: [{ $strLenCP: { $ifNull: ['$contentHtml', ''] } }, 0] },
                          { $gt: [{ $strLenCP: { $ifNull: ['$excerpt', ''] } }, 0] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ])
        : [];
    const articleStatsById = new Map(
      articleStats.map((row) => [
        String(row._id),
        {
          articleCount: Number(row.articleCount || 0),
          pagesWithHotspots: Array.isArray(row.pagesWithHotspots)
            ? row.pagesWithHotspots
                .map((value) => Number(value || 0))
                .filter((value) => Number.isFinite(value) && value > 0)
            : [],
          articlesWithReadableText: Number(row.articlesWithReadableText || 0),
        },
      ])
    );

    const enriched = data.map((item) => {
      const stats = articleStatsById.get(item._id) || {
        articleCount: 0,
        pagesWithHotspots: [],
        articlesWithReadableText: 0,
      };
      const readiness = buildEpaperReadiness({
        epaper: item,
        articles: Array.from({ length: stats.articleCount }, (_, index) => ({
          pageNumber: stats.pagesWithHotspots[index] || stats.pagesWithHotspots[0] || 1,
          excerpt: index < stats.articlesWithReadableText ? 'text-ready' : '',
          contentHtml: '',
          coverImagePath: '',
        })),
      });
      const production = resolveEpaperProduction({
        productionStatus: item.productionStatus,
        productionAssignee: item.productionAssignee,
        productionNotes: item.productionNotes,
        qaCompletedAt: item.qaCompletedAt,
        status: item.status,
        readiness,
      });

      return {
        ...item,
        productionStatus: production.productionStatus,
        productionAssignee: production.productionAssignee,
        productionNotes: production.productionNotes.map((note) => ({
          ...note,
          createdAt: note.createdAt.toISOString(),
        })),
        qaCompletedAt: production.qaCompletedAt?.toISOString() || null,
        articleCount: stats.articleCount,
        readiness,
        automation: buildEpaperAutomationInfo(item),
      };
    });

    return NextResponse.json({
      success: true,
      data: enriched,
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

export async function POST(req: NextRequest) {
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

    const body = await req.json().catch(() => ({}));
    const source = typeof body === 'object' && body ? (body as Record<string, unknown>) : {};
    const citySlug = normalizeCitySlug(String(source.citySlug || ''));
    const cityName = firstNonEmptyString(source.cityName, getCityNameFromSlug(citySlug));
    const title = String(source.title || '').trim();
    const publishDate = parsePublishDate(String(source.publishDate || ''));
    const statusInput = String(source.status || '').trim().toLowerCase();
    const requestedPageCount = toPositiveInt(source.pageCount);

    if (!citySlug) {
      return NextResponse.json({ success: false, error: 'citySlug is required and must be valid' }, { status: 400 });
    }
    if (!cityName) {
      return NextResponse.json({ success: false, error: 'cityName is required' }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ success: false, error: 'title is required' }, { status: 400 });
    }
    if (!publishDate) {
      return NextResponse.json({ success: false, error: 'publishDate must be valid (YYYY-MM-DD or DD-MM-YYYY)' }, { status: 400 });
    }
    if (requestedPageCount > 1000) {
      return NextResponse.json({ success: false, error: 'pageCount is too high (max 1000)' }, { status: 400 });
    }
    if (statusInput && statusInput !== 'draft' && statusInput !== 'published') {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }

    const [pdfAsset, thumbnailAsset, pageImageAssets] = await Promise.all([
      verifyAssetReference('epaper_pdf', source.pdfAsset),
      verifyAssetReference('epaper_thumbnail', source.thumbnailAsset),
      verifyPageImageReferences(source.pageImageAssets),
    ]);

    const highestPageImageNumber = pageImageAssets.reduce(
      (max, item) => Math.max(max, item.pageNumber),
      0
    );
    const pageCount = Math.max(requestedPageCount, highestPageImageNumber);
    if (pageCount < 1) {
      return NextResponse.json(
        { success: false, error: 'pageCount is required when page images are not included in the create request' },
        { status: 400 }
      );
    }

    await connectDB();
    const existing = await EPaper.findOne({ citySlug, publishDate }).select('_id').lean();
    if (existing) {
      return NextResponse.json(
        { success: false, error: `E-paper already exists for ${citySlug} on ${publishDate.toISOString().slice(0, 10)}` },
        { status: 409 }
      );
    }

    const pages = Array.from({ length: pageCount }, (_, index) => ({
      pageNumber: index + 1,
      imagePath: '',
      width: undefined as number | undefined,
      height: undefined as number | undefined,
    }));

    for (const pageAsset of pageImageAssets) {
      pages[pageAsset.pageNumber - 1] = {
        pageNumber: pageAsset.pageNumber,
        imagePath: pageAsset.asset.mediaUrl,
        width: pageAsset.width,
        height: pageAsset.height,
      };
    }

    const status = statusInput === 'published' ? 'published' : 'draft';
    const automationUpdates = buildEpaperImageAutomationUpdates({
      pageCount,
      pages,
      currentThumbnailPath: thumbnailAsset.mediaUrl,
      currentProductionStatus: 'draft_upload',
      currentStatus: status,
    });
    const pdfFormat = pdfAsset.mediaKey.split('.').pop()?.toLowerCase() || 'pdf';

    const epaper = await EPaper.create({
      citySlug,
      cityName,
      title,
      publishDate,
      pdfPath: pdfAsset.mediaUrl,
      pdfPublicId: pdfAsset.mediaKey,
      pdfFormat,
      thumbnailPath: thumbnailAsset.mediaUrl,
      pageCount,
      pages,
      status,
      productionStatus: status === 'published'
        ? 'published'
        : automationUpdates.productionStatus || 'draft_upload',
      sourceType: 'manual-upload',
      sourceLabel: 'Direct Spaces upload',
      sourceUrl: pdfAsset.mediaUrl,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'E-paper created successfully',
        data: mapCreatedEpaper(epaper.toObject()),
      },
      { status: 201 }
    );
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

    const message = error instanceof Error && error.message.trim()
      ? error.message
      : 'Failed to create e-paper';
    const status =
      /required|valid|must be|too high|max|asset|upload|file|key|size|content type/i.test(message)
        ? 400
        : 500;

    console.error('Failed to create direct-upload e-paper:', error);
    return NextResponse.json(
      { success: false, error: status === 500 ? 'Failed to create e-paper' : message },
      { status }
    );
  }
}

