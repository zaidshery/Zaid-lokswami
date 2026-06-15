import { Types } from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import EPaper from '@/lib/models/EPaper';
import EPaperArticle from '@/lib/models/EPaperArticle';
import TtsAsset from '@/lib/models/TtsAsset';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import { canEditEpaper } from '@/lib/auth/permissions';
import {
  buildEpaperActivityMessage,
  recordEpaperActivity,
} from '@/lib/server/epaperActivity';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const admin = await getAdminSessionFromReq(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!canEditEpaper(admin.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, error: 'Invalid e-paper ID.' }, { status: 400 });
  }

  await connectDB();
  const source = await EPaper.findById(id).lean();
  if (!source) {
    return NextResponse.json({ success: false, error: 'E-paper not found.' }, { status: 404 });
  }
  if (source.status !== 'published' || source.productionStatus !== 'published') {
    return NextResponse.json(
      { success: false, error: 'Only a published edition can be revised.' },
      { status: 409 }
    );
  }

  const familyId = String(source.familyId || source._id);
  await EPaper.updateOne(
    { _id: source._id, familyId: { $in: ['', null] } },
    { familyId, revisionNumber: Number(source.revisionNumber || 1) }
  );
  const existingDraft = await EPaper.findOne({
    familyId,
    status: 'draft',
    productionStatus: { $ne: 'archived' },
  }).lean();
  if (existingDraft) {
    return NextResponse.json(
      {
        success: false,
        error: 'A draft revision already exists for this edition.',
        data: { revisionId: String(existingDraft._id) },
      },
      { status: 409 }
    );
  }

  const latest = await EPaper.findOne({ familyId })
    .sort({ revisionNumber: -1 })
    .select('revisionNumber')
    .lean();
  const revisionNumber = Number(latest?.revisionNumber || source.revisionNumber || 1) + 1;
  const pages = (source.pages || []).map((page) => ({
    ...page,
    reviewStatus: 'pending',
    reviewNote: '',
    reviewedAt: null,
    reviewedBy: null,
  }));
  const revision = await EPaper.create({
    citySlug: source.citySlug,
    cityName: source.cityName,
    title: source.title,
    publishDate: source.publishDate,
    pdfPath: source.pdfPath,
    pdfPublicId: source.pdfPublicId,
    pdfFormat: source.pdfFormat,
    thumbnailPath: source.thumbnailPath,
    pdfUrl: source.pdfUrl,
    thumbnail: source.thumbnail,
    pageCount: source.pageCount,
    pages,
    status: 'draft',
    familyId,
    revisionNumber,
    isCurrentRevision: false,
    supersedesId: source._id,
    productionStatus: 'qa_review',
    productionAssignee: source.productionAssignee,
    productionNotes: [],
    qaCompletedAt: null,
    sourceType: source.sourceType,
    sourceLabel: source.sourceLabel,
    sourceUrl: source.sourceUrl,
  });

  const sourceArticles = await EPaperArticle.find({ epaperId: source._id }).lean();
  const articleIdMap = new Map<string, string>();
  for (const sourceArticle of sourceArticles) {
    const cloned = await EPaperArticle.create({
      epaperId: revision._id,
      pageNumber: sourceArticle.pageNumber,
      title: sourceArticle.title,
      slug: sourceArticle.slug,
      excerpt: sourceArticle.excerpt,
      contentHtml: sourceArticle.contentHtml,
      coverImagePath: sourceArticle.coverImagePath,
      videoUrl: sourceArticle.videoUrl,
      hotspot: sourceArticle.hotspot,
      workflow: sourceArticle.workflow,
    });
    articleIdMap.set(String(sourceArticle._id), String(cloned._id));
  }

  const manualAssets = await TtsAsset.find({
    sourceParentId: String(source._id),
    sourceType: 'epaperArticle',
    provider: 'manual',
    status: 'ready',
  }).lean();
  for (const asset of manualAssets) {
    const nextSourceId = articleIdMap.get(String(asset.sourceId || ''));
    if (!nextSourceId) continue;
    await TtsAsset.create({
      sourceType: asset.sourceType,
      sourceId: nextSourceId,
      sourceParentId: String(revision._id),
      variant: asset.variant,
      title: asset.title,
      textHash: asset.textHash,
      contentVersionHash: asset.contentVersionHash,
      languageCode: asset.languageCode,
      voice: asset.voice,
      provider: asset.provider,
      model: asset.model,
      mimeType: asset.mimeType,
      audioUrl: asset.audioUrl,
      storageMode: asset.storageMode,
      status: asset.status,
      chunkCount: asset.chunkCount,
      charCount: asset.charCount,
      generatedAt: asset.generatedAt,
      lastVerifiedAt: asset.lastVerifiedAt,
      failureCount: asset.failureCount,
      lastError: asset.lastError,
      metadata: {
        ...(asset.metadata || {}),
        clonedFromEpaperId: String(source._id),
        clonedFromAssetId: String(asset._id),
      },
    });
  }

  await recordEpaperActivity({
    epaperId: String(revision._id),
    actor: admin,
    action: 'revision_created',
    fromStatus: 'published',
    toStatus: 'qa_review',
    message: buildEpaperActivityMessage({ action: 'revision_created' }),
    metadata: {
      familyId,
      revisionNumber,
      supersedesId: String(source._id),
    },
  });

  return NextResponse.json(
    {
      success: true,
      message: `Draft revision ${revisionNumber} created.`,
      data: {
        revisionId: String(revision._id),
        familyId,
        revisionNumber,
      },
    },
    { status: 201 }
  );
}
