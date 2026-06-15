import { Types } from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import EPaper from '@/lib/models/EPaper';
import EPaperArticle from '@/lib/models/EPaperArticle';
import EPaperOcrSuggestion from '@/lib/models/EPaperOcrSuggestion';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import { canEditEpaper } from '@/lib/auth/permissions';
import { resolveUniqueSlug } from '@/lib/utils/epaperArticles';
import {
  assertEpaperDraftEditable,
  invalidateEpaperQa,
} from '@/lib/server/epaperWorkflowPolicy';
import {
  buildEpaperActivityMessage,
  recordEpaperActivity,
} from '@/lib/server/epaperActivity';
import { logEpaperMetric } from '@/lib/server/epaperObservability';

type RouteContext = { params: Promise<{ id: string; suggestionId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = await getAdminSessionFromReq(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!canEditEpaper(admin.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const { id, suggestionId } = await context.params;
  if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(suggestionId)) {
    return NextResponse.json({ success: false, error: 'Invalid ID.' }, { status: 400 });
  }

  await connectDB();
  const [epaper, suggestion] = await Promise.all([
    EPaper.findById(id).lean(),
    EPaperOcrSuggestion.findOne({ _id: suggestionId, epaperId: id }),
  ]);
  if (!epaper || !suggestion) {
    return NextResponse.json({ success: false, error: 'Suggestion not found.' }, { status: 404 });
  }
  try {
    assertEpaperDraftEditable(epaper);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Edition is immutable.' },
      { status: 409 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: unknown;
    note?: unknown;
  };
  const action = String(body.action || '').trim();
  if (action !== 'accept' && action !== 'reject') {
    return NextResponse.json(
      { success: false, error: 'Action must be accept or reject.' },
      { status: 400 }
    );
  }

  if (action === 'reject') {
    suggestion.status = 'rejected';
    suggestion.reviewedById = admin.id;
    suggestion.reviewedAt = new Date();
    suggestion.duplicateReason =
      String(body.note || '').trim() || suggestion.duplicateReason;
    await suggestion.save();
    await recordEpaperActivity({
      epaperId: id,
      actor: admin,
      action: 'ocr_suggestion_rejected',
      message: buildEpaperActivityMessage({
        action: 'ocr_suggestion_rejected',
      }),
      metadata: {
        suggestionId,
        pageNumber: suggestion.pageNumber,
      },
    });
    logEpaperMetric('ocr_suggestion_reviewed', {
      epaperId: id,
      suggestionId,
      pageNumber: suggestion.pageNumber,
      decision: 'rejected',
    });
    return NextResponse.json({ success: true, data: suggestion });
  }

  if (suggestion.status === 'suppressed') {
    return NextResponse.json(
      { success: false, error: 'Suppressed duplicate suggestions cannot be accepted.' },
      { status: 409 }
    );
  }
  if (suggestion.createdArticleId) {
    return NextResponse.json(
      { success: false, error: 'This suggestion has already been accepted.' },
      { status: 409 }
    );
  }

  const slug = await resolveUniqueSlug(suggestion.title, async (candidate) =>
    Boolean(await EPaperArticle.exists({ epaperId: id, slug: candidate }))
  );
  const article = await EPaperArticle.create({
    epaperId: id,
    pageNumber: suggestion.pageNumber,
    title: suggestion.title,
    slug,
    excerpt: suggestion.excerpt,
    contentHtml: suggestion.contentHtml,
    coverImagePath: '',
    hotspot: suggestion.hotspot,
  });
  suggestion.status = 'accepted';
  suggestion.reviewedById = admin.id;
  suggestion.reviewedAt = new Date();
  suggestion.createdArticleId = new Types.ObjectId(String(article._id));
  await suggestion.save();

  const pages = (epaper.pages || []).map((page) =>
    Number(page.pageNumber || 0) === suggestion.pageNumber
      ? {
          ...page,
          reviewStatus: 'pending',
          reviewedAt: null,
          reviewedBy: null,
        }
      : page
  );
  await EPaper.findByIdAndUpdate(id, { pages });
  await invalidateEpaperQa({
    epaperId: id,
    actor: admin,
    reason: 'An OCR suggestion was accepted.',
    pageNumbers: [suggestion.pageNumber],
  });
  await recordEpaperActivity({
    epaperId: id,
    actor: admin,
    action: 'ocr_suggestion_accepted',
    message: buildEpaperActivityMessage({
      action: 'ocr_suggestion_accepted',
    }),
    metadata: {
      suggestionId,
      articleId: String(article._id),
      pageNumber: suggestion.pageNumber,
    },
  });
  logEpaperMetric('ocr_suggestion_reviewed', {
    epaperId: id,
    suggestionId,
    pageNumber: suggestion.pageNumber,
    decision: 'accepted',
  });

  return NextResponse.json({
    success: true,
    message: 'OCR suggestion accepted and mapped story created.',
    data: { suggestion, article },
  });
}
