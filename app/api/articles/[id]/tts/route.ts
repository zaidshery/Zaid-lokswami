import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import Article from '@/lib/models/Article';
import {
  buildArticleFullTtsText,
  findReadyManualTtsAsset,
} from '@/lib/server/ttsAssets';
import { getStoredArticleById } from '@/lib/storage/articlesFile';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ArticleListenSource = {
  id: string;
  title: string;
  summary: string;
  content: string;
};

async function shouldUseFileStore() {
  if (!process.env.MONGODB_URI) {
    return true;
  }

  try {
    await connectDB();
    return false;
  } catch (error) {
    console.error('MongoDB unavailable for article manual TTS route, using file store.', error);
    return true;
  }
}

async function loadArticleForListen(id: string, useFileStore: boolean) {
  if (useFileStore) {
    const stored = await getStoredArticleById(id);
    if (!stored) return null;

    return {
      id: stored._id,
      title: stored.title,
      summary: stored.summary,
      content: stored.content,
    } satisfies ArticleListenSource;
  }

  if (!Types.ObjectId.isValid(id)) {
    return null;
  }

  const article = await Article.findById(id).select('_id title summary content');

  if (!article) {
    return null;
  }

  return {
    id: String(article._id),
    title: String(article.title || '').trim(),
    summary: String(article.summary || '').trim(),
    content: String(article.content || '').trim(),
  } satisfies ArticleListenSource;
}

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const articleId = id.trim();

    if (!articleId) {
      return NextResponse.json(
        { success: false, error: 'Invalid article ID' },
        { status: 400 }
      );
    }

    const useFileStore = await shouldUseFileStore();
    const article = await loadArticleForListen(articleId, useFileStore);

    if (!article) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    const sourceText = buildArticleFullTtsText({
      title: article.title,
      summary: article.summary,
      content: article.content,
    });

    if (!sourceText) {
      return NextResponse.json(
        { success: false, error: 'No article text is available for listen mode.' },
        { status: 400 }
      );
    }

    if (useFileStore) {
      return NextResponse.json(
        { success: false, error: 'Manual article audio has not been uploaded yet.' },
        { status: 404 }
      );
    }

    const manualAsset = await findReadyManualTtsAsset({
      sourceType: 'article',
      sourceId: article.id,
      variant: 'article_full',
    });

    if (!manualAsset?.audioUrl) {
      return NextResponse.json(
        { success: false, error: 'Manual article audio has not been uploaded yet.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        status: 'ready',
        provider: 'manual',
        model: manualAsset.model,
        voice: manualAsset.voice,
        mimeType: manualAsset.mimeType,
        chunkCount: manualAsset.chunkCount || 1,
        audioUrl: manualAsset.audioUrl,
      },
    });
  } catch (error) {
    console.error('Article manual TTS route failed:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error && error.message.trim()
            ? error.message
            : 'Failed to load article audio.',
      },
      { status: 500 }
    );
  }
}
