import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import { canEditContent, canViewPage } from '@/lib/auth/permissions';
import connectDB from '@/lib/db/mongoose';
import Article from '@/lib/models/Article';
import { serializeManagedTtsAsset } from '@/lib/server/articleTtsManual';
import {
  buildBreakingTtsRecordingScript,
  saveBreakingTtsMetadata,
} from '@/lib/server/breakingTts';
import { saveManualTtsAsset } from '@/lib/server/ttsAssets';
import {
  parseBreakingTtsAssetSize,
  verifyBreakingTtsUpload,
} from '@/lib/storage/breakingTtsUpload';
import { resolveArticleWorkflow } from '@/lib/workflow/article';

export const runtime = 'nodejs';

function getArticleLocation(article: unknown) {
  const source =
    article && typeof article === 'object' ? (article as Record<string, unknown>) : {};
  const direct =
    typeof source.city === 'string'
      ? source.city.trim()
      : typeof source.cityName === 'string'
        ? source.cityName.trim()
        : typeof source.locationTag === 'string'
          ? source.locationTag.trim()
          : '';
  if (direct) return direct;

  const reporterMeta =
    source.reporterMeta && typeof source.reporterMeta === 'object'
      ? (source.reporterMeta as Record<string, unknown>)
      : null;
  return typeof reporterMeta?.locationTag === 'string'
    ? reporterMeta.locationTag.trim()
    : '';
}

async function loadEditableBreakingArticle(
  admin: NonNullable<Awaited<ReturnType<typeof getAdminSessionFromReq>>>,
  articleId: string
) {
  if (!Types.ObjectId.isValid(articleId)) {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, error: 'Article not found' }, { status: 404 }),
    };
  }

  const article = await Article.findById(articleId).select(
    '_id title author workflow reporterMeta isBreaking breakingTts updatedAt publishedAt'
  );
  if (!article) {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, error: 'Article not found' }, { status: 404 }),
    };
  }

  if (
    !canEditContent(admin, {
      legacyAuthorName: String(article.author || ''),
      workflow: resolveArticleWorkflow({
        workflow: article.workflow,
        updatedAt: article.updatedAt,
        publishedAt: article.publishedAt,
      }),
    })
  ) {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }),
    };
  }

  if (!article.isBreaking) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, error: 'Mark this article as breaking news before uploading breaking audio.' },
        { status: 400 }
      ),
    };
  }

  return { ok: true as const, article };
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminSessionFromReq(req);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!canViewPage(admin.role, 'article_edit')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const articleId = String(body.articleId || '').trim();
    const mediaKey = String(body.mediaKey || '').trim();
    if (!articleId) {
      return NextResponse.json(
        { success: false, error: 'articleId is required for breaking audio uploads.' },
        { status: 400 }
      );
    }
    if (!mediaKey) {
      return NextResponse.json(
        { success: false, error: 'Uploaded breaking audio key is required.' },
        { status: 400 }
      );
    }

    const articleResult = await loadEditableBreakingArticle(admin, articleId);
    if (!articleResult.ok) {
      return articleResult.response;
    }

    const article = articleResult.article;
    const articleObject =
      typeof article.toObject === 'function' ? article.toObject() : article;
    const script = buildBreakingTtsRecordingScript(articleObject);
    if (!script) {
      return NextResponse.json(
        {
          success: false,
          error: 'Save a breaking headline before uploading breaking audio.',
        },
        { status: 400 }
      );
    }

    const asset = await verifyBreakingTtsUpload({
      mediaKey,
      expectedSize: parseBreakingTtsAssetSize(body.expectedSize),
      expectedFileType: typeof body.expectedFileType === 'string' ? body.expectedFileType.trim() : '',
      expectedFileName: typeof body.expectedFileName === 'string' ? body.expectedFileName.trim() : '',
    });

    const ttsAsset = await saveManualTtsAsset({
      sourceType: 'article',
      sourceId: String(article._id),
      variant: 'breaking_headline',
      title: String(article.title || ''),
      text: script,
      audioUrl: asset.mediaUrl,
      mimeType: asset.mediaMimeType,
      mediaKey: asset.mediaKey,
      actor: admin,
      metadata: {
        source: 'admin-manual-breaking-audio-upload',
      },
    });

    const breakingTts = await saveBreakingTtsMetadata({
      title: String(article.title || ''),
      city: getArticleLocation(articleObject),
      audioUrl: asset.mediaUrl,
      mimeType: asset.mediaMimeType,
    });

    article.breakingTts = {
      ...breakingTts,
      generatedAt: new Date(breakingTts.generatedAt),
    };
    article.updatedAt = new Date();
    await article.save();

    return NextResponse.json({
      success: true,
      message: 'Manual breaking news audio uploaded successfully',
      data: {
        asset,
        ttsAsset: serializeManagedTtsAsset(ttsAsset),
        breakingTts,
        script,
      },
    });
  } catch (error) {
    console.error('Error completing breaking audio upload:', error);
    const message = error instanceof Error ? error.message : 'Failed to verify breaking audio upload';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
