import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import { getAdminSession } from '@/lib/auth/admin';
import { canEditContent, canReadContent, canViewPage } from '@/lib/auth/permissions';
import Article from '@/lib/models/Article';
import { resolveArticleWorkflow } from '@/lib/workflow/article';
import {
  buildArticleFullTtsText,
  ensureTtsAsset,
  findCurrentTtsAsset,
} from '@/lib/server/ttsAssets';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type SerializableTtsAsset = {
  id: string;
  status: string;
  audioUrl: string;
  voice: string;
  model: string;
  languageCode: string;
  mimeType: string;
  generatedAt: string;
  updatedAt: string;
  lastVerifiedAt: string;
  lastError: string;
  chunkCount: number;
  charCount: number;
};

function serializeTtsAsset(asset: unknown): SerializableTtsAsset | null {
  if (!asset || typeof asset !== 'object') return null;

  const source = asset as Record<string, unknown>;
  return {
    id: String(source._id || ''),
    status: String(source.status || ''),
    audioUrl: String(source.audioUrl || ''),
    voice: String(source.voice || ''),
    model: String(source.model || ''),
    languageCode: String(source.languageCode || ''),
    mimeType: String(source.mimeType || ''),
    generatedAt: source.generatedAt instanceof Date
      ? source.generatedAt.toISOString()
      : String(source.generatedAt || ''),
    updatedAt: source.updatedAt instanceof Date
      ? source.updatedAt.toISOString()
      : String(source.updatedAt || ''),
    lastVerifiedAt: source.lastVerifiedAt instanceof Date
      ? source.lastVerifiedAt.toISOString()
      : String(source.lastVerifiedAt || ''),
    lastError: String(source.lastError || ''),
    chunkCount: Number(source.chunkCount || 0),
    charCount: Number(source.charCount || 0),
  };
}

async function requireMongoBackedTts() {
  if (!process.env.MONGODB_URI?.trim()) {
    return 'Shared admin TTS controls require MongoDB.';
  }

  try {
    await connectDB();
    return '';
  } catch (error) {
    console.error('MongoDB unavailable for admin article TTS route:', error);
    return 'Shared admin TTS controls are unavailable right now.';
  }
}

async function loadArticleSource(articleId: string) {
  if (!Types.ObjectId.isValid(articleId)) {
    return null;
  }

  const article = await Article.findById(articleId).select(
    '_id title summary content author workflow updatedAt publishedAt'
  );
  if (!article) {
    return null;
  }

  return {
    id: String(article._id),
    title: String(article.title || '').trim(),
    summary: String(article.summary || '').trim(),
    content: String(article.content || '').trim(),
    author: String(article.author || '').trim(),
    workflow: resolveArticleWorkflow({
      workflow: article.workflow,
      updatedAt: article.updatedAt,
      publishedAt: article.publishedAt,
    }),
  };
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!canViewPage(admin.role, 'articles')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const mongoError = await requireMongoBackedTts();
    if (mongoError) {
      return NextResponse.json(
        { success: false, error: mongoError },
        { status: 503 }
      );
    }

    const { id } = await context.params;
    const articleId = id.trim();
    const article = await loadArticleSource(articleId);

    if (!article) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }
    if (
      !canReadContent(
        admin,
        { legacyAuthorName: article.author, workflow: article.workflow },
        { allowViewerRead: true }
      )
    ) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const text = buildArticleFullTtsText(article);
    if (!text) {
      return NextResponse.json({
        success: true,
        data: {
          variant: 'article_full',
          eligible: false,
          ready: false,
          asset: null,
          message: 'Save article title, summary, and content before generating listen audio.',
        },
      });
    }

    const current = await findCurrentTtsAsset({
      sourceType: 'article',
      sourceId: article.id,
      variant: 'article_full',
      title: article.title,
      text,
    });
    const asset = serializeTtsAsset(current.asset);
    const ready = Boolean(asset?.status === 'ready' && asset.audioUrl);

    return NextResponse.json({
      success: true,
      data: {
        variant: 'article_full',
        eligible: true,
        ready,
        asset,
        message: ready
          ? 'Article listen audio is ready for the current saved text.'
          : asset?.lastError || 'No reusable article listen audio exists for the current saved text yet.',
      },
    });
  } catch (error) {
    console.error('Failed to load admin article TTS status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load article TTS status.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!canViewPage(admin.role, 'article_edit')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const mongoError = await requireMongoBackedTts();
    if (mongoError) {
      return NextResponse.json(
        { success: false, error: mongoError },
        { status: 503 }
      );
    }

    const { id } = await context.params;
    const articleId = id.trim();
    const article = await loadArticleSource(articleId);

    if (!article) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }
    if (!canEditContent(admin, { legacyAuthorName: article.author, workflow: article.workflow })) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const text = buildArticleFullTtsText(article);
    if (!text) {
      return NextResponse.json(
        {
          success: false,
          error: 'Save article title, summary, and content before generating listen audio.',
        },
        { status: 400 }
      );
    }

    const forceRegenerate = req.nextUrl.searchParams.get('force') !== '0';
    const result = await ensureTtsAsset({
      sourceType: 'article',
      sourceId: article.id,
      variant: 'article_full',
      title: article.title,
      text,
      forceRegenerate,
      actor: admin,
      metadata: {
        source: 'admin-article-edit',
      },
    });

    if (!result.asset || result.asset.status !== 'ready' || !result.asset.audioUrl) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Unable to generate article listen audio right now.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        variant: 'article_full',
        eligible: true,
        ready: true,
        asset: serializeTtsAsset(result.asset),
        message: result.reused
          ? 'Article listen audio is already ready for the current saved text.'
          : 'Article listen audio generated successfully.',
      },
    });
  } catch (error) {
    console.error('Failed to generate admin article TTS:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate article listen audio.' },
      { status: 500 }
    );
  }
}
