import crypto from 'crypto';
import { Types } from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import EPaper from '@/lib/models/EPaper';
import EPaperArticle from '@/lib/models/EPaperArticle';
import EPaperOcrSuggestion from '@/lib/models/EPaperOcrSuggestion';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import { canEditEpaper } from '@/lib/auth/permissions';
import {
  buildEpaperActivityMessage,
  recordEpaperActivity,
} from '@/lib/server/epaperActivity';
import { logEpaperMetric } from '@/lib/server/epaperObservability';
import { assertEpaperDraftEditable } from '@/lib/server/epaperWorkflowPolicy';
import { generateArticleHotspotsFromThumbnail } from '@/lib/utils/epaperOcrAssist';
import { normalizeHotspot } from '@/lib/utils/epaperArticles';
import {
  buildEpaperSuggestionQuality,
  getEpaperHotspotOverlapRatio,
} from '@/lib/utils/epaperSuggestionQuality';

type RouteContext = { params: Promise<{ id: string }> };
type Hotspot = { x: number; y: number; w: number; h: number };
type DetectedHotspot = {
  title?: unknown;
  text?: unknown;
  x?: unknown;
  y?: unknown;
  w?: unknown;
  width?: unknown;
  h?: unknown;
  height?: unknown;
};

function normalizePageNumbers(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => Math.floor(Number(entry)))
        .filter((entry) => Number.isFinite(entry) && entry > 0 && entry <= 1000)
    )
  ).sort((left, right) => left - right);
}

function toHtmlParagraph(value: string) {
  return value
    .split(/\n{2,}/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p>${paragraph.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
    )
    .join('');
}

function toHotspot(input: DetectedHotspot): Hotspot {
  const x = Number(input.x);
  const y = Number(input.y);
  const width = Number(input.width ?? input.w ?? 0);
  const height = Number(input.height ?? input.h ?? 0);
  return normalizeHotspot({
    x: Number.isFinite(x) && x > 1 ? x / 100 : x,
    y: Number.isFinite(y) && y > 1 ? y / 100 : y,
    w: Number.isFinite(width) && width > 1 ? width / 100 : width,
    h: Number.isFinite(height) && height > 1 ? height / 100 : height,
  });
}

function normalizeTitle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleSimilarity(left: string, right: string) {
  const a = normalizeTitle(left);
  const b = normalizeTitle(right);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= b.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1)
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
}

function buildFingerprint(input: {
  pageNumber: number;
  title: string;
  hotspot: Hotspot;
}) {
  return crypto
    .createHash('sha256')
    .update(
      [
        input.pageNumber,
        normalizeTitle(input.title),
        input.hotspot.x.toFixed(3),
        input.hotspot.y.toFixed(3),
        input.hotspot.w.toFixed(3),
        input.hotspot.h.toFixed(3),
      ].join('|')
    )
    .digest('hex');
}

export async function GET(request: NextRequest, context: RouteContext) {
  const admin = await getAdminSessionFromReq(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!canEditEpaper(admin.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, error: 'Invalid e-paper ID' }, { status: 400 });
  }

  await connectDB();
  const pageNumber = Math.floor(Number(request.nextUrl.searchParams.get('pageNumber') || 0));
  const status = request.nextUrl.searchParams.get('status')?.trim();
  const query: Record<string, unknown> = { epaperId: id };
  if (pageNumber > 0) query.pageNumber = pageNumber;
  if (status) query.status = status;

  const suggestions = await EPaperOcrSuggestion.find(query)
    .sort({ pageNumber: 1, createdAt: -1 })
    .lean();
  return NextResponse.json({ success: true, data: suggestions });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const startedAt = Date.now();
  try {
    const admin = await getAdminSessionFromReq(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!canEditEpaper(admin.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'Invalid e-paper ID' }, { status: 400 });
    }
    await connectDB();
    const epaper = await EPaper.findById(id).lean();
    if (!epaper) {
      return NextResponse.json({ success: false, error: 'E-paper not found' }, { status: 404 });
    }
    try {
      assertEpaperDraftEditable(epaper);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Edition is immutable.' },
        { status: 409 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as { pageNumbers?: unknown };
    const requestedPages = normalizePageNumbers(body.pageNumbers);
    const requestedSet = new Set(requestedPages);
    const pages = (epaper.pages || []).filter((page) => {
      const pageNumber = Number(page.pageNumber || 0);
      return (
        (!requestedSet.size || requestedSet.has(pageNumber)) &&
        (page.pageType || 'editorial') === 'editorial'
      );
    });
    const existingStories = await EPaperArticle.find({ epaperId: id })
      .select('pageNumber title hotspot')
      .lean();
    const runId = crypto.randomUUID();
    const result = {
      runId,
      pagesChecked: 0,
      pagesSkipped: 0,
      pagesFailed: 0,
      suggestionsCreated: 0,
      suggestionsUpdated: 0,
      suggestionsSuppressed: 0,
      failures: [] as string[],
    };

    for (const page of pages) {
      const pageNumber = Number(page.pageNumber || 0);
      const imagePath = String(page.imagePath || '').trim();
      if (!pageNumber || !imagePath) {
        result.pagesSkipped += 1;
        continue;
      }

      result.pagesChecked += 1;
      try {
        const detections = await generateArticleHotspotsFromThumbnail(imagePath);
        const pageStories = existingStories.filter(
          (story) => Number(story.pageNumber || 0) === pageNumber
        );

        for (let index = 0; index < detections.length; index += 1) {
          const detection = detections[index] as DetectedHotspot;
          const text = String(detection.text || '').trim();
          const title =
            String(detection.title || '').trim() || `Page ${pageNumber} Story ${index + 1}`;
          const hotspot = toHotspot(detection);
          const excerpt = text.slice(0, 240);
          const contentHtml = text ? toHtmlParagraph(text) : '';
          const quality = buildEpaperSuggestionQuality({
            title,
            excerpt,
            contentHtml,
            hotspot,
            existingStories: pageStories,
          });

          const maxTitleSimilarity = pageStories.reduce(
            (maximum, story) =>
              Math.max(maximum, titleSimilarity(title, String(story.title || ''))),
            0
          );
          const maxOverlap = pageStories.reduce(
            (maximum, story) =>
              story.hotspot
                ? Math.max(maximum, getEpaperHotspotOverlapRatio(hotspot, story.hotspot))
                : maximum,
            0
          );
          const duplicateReason =
            maxOverlap >= 0.65
              ? `Overlaps an existing story by ${Math.round(maxOverlap * 100)}%.`
              : maxTitleSimilarity >= 0.9
                ? `Matches an existing headline by ${Math.round(maxTitleSimilarity * 100)}%.`
                : '';
          const fingerprint = buildFingerprint({ pageNumber, title, hotspot });
          const existing = await EPaperOcrSuggestion.findOne({
            epaperId: id,
            pageNumber,
            fingerprint,
          });
          const status = duplicateReason ? 'suppressed' : existing?.status || 'pending';

          if (existing) {
            existing.runId = runId;
            existing.title = title;
            existing.excerpt = excerpt;
            existing.contentHtml = contentHtml;
            existing.hotspot = hotspot;
            existing.confidence = quality.confidence;
            existing.warnings = quality.warnings;
            existing.duplicateReason = duplicateReason;
            if (existing.status !== 'accepted' && existing.status !== 'rejected') {
              existing.status = status;
            }
            await existing.save();
            result.suggestionsUpdated += 1;
          } else {
            await EPaperOcrSuggestion.create({
              epaperId: id,
              pageNumber,
              runId,
              fingerprint,
              title,
              excerpt,
              contentHtml,
              hotspot,
              confidence: quality.confidence,
              warnings: quality.warnings,
              duplicateReason,
              status,
            });
            result.suggestionsCreated += 1;
          }
          if (duplicateReason) result.suggestionsSuppressed += 1;
        }
      } catch (error) {
        result.pagesFailed += 1;
        result.failures.push(
          `Page ${pageNumber}: ${error instanceof Error ? error.message : 'OCR failed'}`
        );
      }
    }

    await recordEpaperActivity({
      epaperId: id,
      actor: admin,
      action: 'ocr_auto_detected',
      message: buildEpaperActivityMessage({ action: 'ocr_auto_detected' }),
      metadata: result,
    });
    logEpaperMetric('ocr_run_completed', {
      epaperId: id,
      runId,
      pagesChecked: result.pagesChecked,
      pagesFailed: result.pagesFailed,
      suggestionsCreated: result.suggestionsCreated,
      suggestionsUpdated: result.suggestionsUpdated,
      suggestionsSuppressed: result.suggestionsSuppressed,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      success: true,
      message: `${result.suggestionsCreated} new OCR suggestion${
        result.suggestionsCreated === 1 ? '' : 's'
      } added for review.`,
      data: result,
    });
  } catch (error) {
    console.error('Failed to run e-paper OCR:', error);
    logEpaperMetric('ocr_run_failed', {
      reason: error instanceof Error ? error.message : 'unknown_error',
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { success: false, error: 'Failed to run e-paper OCR.' },
      { status: 500 }
    );
  }
}
