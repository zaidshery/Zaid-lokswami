import 'server-only';

import EPaper from '@/lib/models/EPaper';
import EPaperArticle from '@/lib/models/EPaperArticle';
import {
  buildEpaperActivityMessage,
  recordEpaperActivity,
} from '@/lib/server/epaperActivity';
import { buildEpaperReadiness } from '@/lib/utils/epaperAdminReadiness';
import type { EPaperArticleRecord, EPaperRecord } from '@/lib/types/epaper';
import type { AdminSessionIdentity } from '@/lib/auth/admin';
import type { EPaperProductionStatus } from '@/lib/workflow/types';

type Actor = Pick<AdminSessionIdentity, 'id' | 'name' | 'email' | 'role'>;

function normalizeArticleForReadiness(article: Record<string, unknown>): EPaperArticleRecord {
  return {
    _id: String(article._id || ''),
    epaperId: String(article.epaperId || ''),
    pageNumber: Number(article.pageNumber || 0),
    title: String(article.title || ''),
    slug: String(article.slug || ''),
    excerpt: String(article.excerpt || ''),
    contentHtml: String(article.contentHtml || ''),
    coverImagePath: String(article.coverImagePath || ''),
    hotspot: { x: 0, y: 0, w: 0, h: 0 },
  };
}

function normalizeEpaperForReadiness(epaper: Record<string, unknown>): EPaperRecord {
  const pages = Array.isArray(epaper.pages) ? epaper.pages : [];
  return {
    _id: String(epaper._id || ''),
    citySlug: String(epaper.citySlug || ''),
    cityName: String(epaper.cityName || ''),
    title: String(epaper.title || ''),
    publishDate:
      epaper.publishDate instanceof Date
        ? epaper.publishDate.toISOString().slice(0, 10)
        : String(epaper.publishDate || ''),
    pdfPath: String(epaper.pdfPath || ''),
    thumbnailPath: String(epaper.thumbnailPath || ''),
    pageCount: Math.max(1, Number(epaper.pageCount || 0)),
    pages: pages.map((page) => {
      const source = typeof page === 'object' && page ? (page as Record<string, unknown>) : {};
      return {
        pageNumber: Number(source.pageNumber || 0),
        imagePath: String(source.imagePath || ''),
        width: Number(source.width || 0) || undefined,
        height: Number(source.height || 0) || undefined,
      };
    }),
    status: epaper.status === 'published' ? 'published' : 'draft',
  };
}

function resolveAutomatedNextStatus(input: {
  currentStatus: EPaperProductionStatus;
  readiness: ReturnType<typeof buildEpaperReadiness>;
}) {
  const { currentStatus, readiness } = input;
  if (currentStatus === 'published' || currentStatus === 'archived') return null;
  if (currentStatus === 'ready_to_publish') return null;

  if (currentStatus === 'draft_upload' && readiness.pagesMissingImage === 0) {
    return 'pages_ready' as const;
  }

  if (currentStatus === 'pages_ready' && readiness.mappedArticles > 0) {
    return 'ocr_review' as const;
  }

  if (currentStatus === 'ocr_review' && readiness.mappedArticles > 0) {
    return 'hotspot_mapping' as const;
  }

  if (
    currentStatus === 'hotspot_mapping' &&
    readiness.mappedArticles > 0 &&
    readiness.pagesMissingHotspots === 0 &&
    readiness.articlesMissingReadableText === 0
  ) {
    return 'qa_review' as const;
  }

  return null;
}

export async function applyEpaperWorkflowAutomation(input: {
  epaperId: string;
  actor: Actor;
  reason: string;
}) {
  const [epaper, articles] = await Promise.all([
    EPaper.findById(input.epaperId).lean<Record<string, unknown> | null>(),
    EPaperArticle.find({ epaperId: input.epaperId })
      .select('_id epaperId pageNumber title slug excerpt contentHtml coverImagePath')
      .lean<Record<string, unknown>[]>(),
  ]);

  if (!epaper) {
    return { changed: false, nextStatus: null };
  }

  const currentStatus = String(epaper.productionStatus || 'draft_upload') as EPaperProductionStatus;
  const readiness = buildEpaperReadiness({
    epaper: normalizeEpaperForReadiness(epaper),
    articles: articles.map(normalizeArticleForReadiness),
  });
  const nextStatus = resolveAutomatedNextStatus({ currentStatus, readiness });

  if (!nextStatus || nextStatus === currentStatus) {
    return { changed: false, nextStatus: null };
  }

  await EPaper.findByIdAndUpdate(
    input.epaperId,
    { productionStatus: nextStatus },
    { runValidators: true }
  );

  await recordEpaperActivity({
    epaperId: input.epaperId,
    actor: input.actor,
    action: nextStatus,
    fromStatus: currentStatus,
    toStatus: nextStatus,
    message: buildEpaperActivityMessage({
      action: nextStatus,
      toStatus: nextStatus,
    }),
    metadata: {
      automated: true,
      reason: input.reason,
      readinessStatus: readiness.status,
    },
  });

  return { changed: true, nextStatus };
}
