import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import EPaper from '@/lib/models/EPaper';
import EPaperArticle from '@/lib/models/EPaperArticle';
import { getAdminSession } from '@/lib/auth/admin';
import { canViewPage } from '@/lib/auth/permissions';
import {
  buildEpaperActivityMessage,
  recordEpaperActivity,
} from '@/lib/server/epaperActivity';
import { ensureEpaperStoryAudio } from '@/lib/server/epaperStoryAudioAutomation';
import { applyEpaperWorkflowAutomation } from '@/lib/server/epaperWorkflowAutomation';
import { generateArticleHotspotsFromThumbnail } from '@/lib/utils/epaperOcrAssist';
import {
  normalizeHotspot,
  resolveUniqueSlug,
} from '@/lib/utils/epaperArticles';

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

function toHtmlParagraph(value: string) {
  const paragraphs = value
    .split(/\n{2,}/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  return paragraphs
    .map((paragraph) => `<p>${paragraph.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
    .join('');
}

function toHotspot(input: DetectedHotspot) {
  const xRaw = Number(input.x);
  const yRaw = Number(input.y);
  const wRaw = Number(input.width ?? input.w ?? 0);
  const hRaw = Number(input.height ?? input.h ?? 0);

  return normalizeHotspot({
    x: Number.isFinite(xRaw) && xRaw > 1 ? xRaw / 100 : xRaw,
    y: Number.isFinite(yRaw) && yRaw > 1 ? yRaw / 100 : yRaw,
    w: Number.isFinite(wRaw) && wRaw > 1 ? wRaw / 100 : wRaw,
    h: Number.isFinite(hRaw) && hRaw > 1 ? hRaw / 100 : hRaw,
  });
}

function normalizePageNumbers(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => Number.parseInt(String(entry ?? ''), 10))
        .filter((entry) => Number.isFinite(entry) && entry > 0)
        .map((entry) => Math.floor(entry))
    )
  ).sort((left, right) => left - right);
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!canViewPage(admin.role, 'epaper_edit')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'Invalid e-paper ID' }, { status: 400 });
    }

    const epaper = await EPaper.findById(id).lean();
    if (!epaper) {
      return NextResponse.json({ success: false, error: 'E-paper not found' }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as { pageNumbers?: unknown };
    const requestedPageNumbers = normalizePageNumbers(body.pageNumbers);
    const requestedPageSet = new Set(requestedPageNumbers);

    const existingArticles = await EPaperArticle.find({ epaperId: id })
      .select('pageNumber')
      .lean();
    const pagesWithStories = new Set(
      existingArticles.map((article) => Number(article.pageNumber || 0)).filter(Boolean)
    );
    const pages = (Array.isArray(epaper.pages) ? epaper.pages : []).filter((page) => {
      if (requestedPageSet.size === 0) return true;
      return requestedPageSet.has(Number(page?.pageNumber || 0));
    });

    const result = {
      pagesChecked: 0,
      pagesSkipped: 0,
      pagesFailed: 0,
      storiesCreated: 0,
      audioReady: 0,
      failures: [] as string[],
      selectedPages: requestedPageNumbers,
    };

    for (const page of pages) {
      const pageNumber = Number(page?.pageNumber || 0);
      const imagePath = String(page?.imagePath || '').trim();
      if (!pageNumber || !imagePath || pagesWithStories.has(pageNumber)) {
        result.pagesSkipped += 1;
        continue;
      }

      result.pagesChecked += 1;
      try {
        const hotspots = await generateArticleHotspotsFromThumbnail(imagePath);
        for (let index = 0; index < hotspots.length; index += 1) {
          const candidate = hotspots[index] as DetectedHotspot;
          const sourceText = String(candidate.text || '').trim();
          const title =
            String(candidate.title || '').trim() || `Page ${pageNumber} Story ${index + 1}`;
          const slug = await resolveUniqueSlug(title, async (candidateSlug) => {
            const existing = await EPaperArticle.exists({ epaperId: id, slug: candidateSlug });
            return Boolean(existing);
          });

          const created = await EPaperArticle.create({
            epaperId: id,
            pageNumber,
            title,
            slug,
            excerpt: sourceText.slice(0, 240),
            contentHtml: sourceText ? toHtmlParagraph(sourceText) : '',
            coverImagePath: '',
            hotspot: toHotspot(candidate),
          });
          result.storiesCreated += 1;

          const audio = await ensureEpaperStoryAudio({
            paper: epaper,
            story: created.toObject(),
            actor: admin,
            source: 'admin-epaper-ocr-automation',
          }).catch(() => ({ attempted: true, ready: false }));

          if (audio.attempted && audio.ready) {
            result.audioReady += 1;
          }
        }
      } catch (error) {
        result.pagesFailed += 1;
        result.failures.push(
          `Page ${pageNumber}: ${
            error instanceof Error && error.message.trim()
              ? error.message
              : 'OCR detection failed'
          }`
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

    if (result.audioReady > 0) {
      await recordEpaperActivity({
        epaperId: id,
        actor: admin,
        action: 'story_audio_generated',
        message: buildEpaperActivityMessage({ action: 'story_audio_generated' }),
        metadata: {
          count: result.audioReady,
          source: 'admin-epaper-ocr-automation',
        },
      });
    }

    const workflow = await applyEpaperWorkflowAutomation({
      epaperId: id,
      actor: admin,
      reason: 'OCR detection created mapped story boxes.',
    });

    return NextResponse.json({
      success: true,
      message:
        result.storiesCreated > 0
          ? `Created ${result.storiesCreated} OCR story box${result.storiesCreated === 1 ? '' : 'es'}.`
          : 'No new OCR story boxes were created.',
      data: {
        ...result,
        workflow,
      },
    });
  } catch (error) {
    console.error('Failed to run e-paper OCR automation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run e-paper OCR automation' },
      { status: 500 }
    );
  }
}
