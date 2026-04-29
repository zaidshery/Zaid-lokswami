import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import {
  getGeminiTtsRuntimeConfig,
  isGeminiTtsConfigured,
  synthesizeGeminiSpeech,
} from '@/lib/ai/geminiTts';
import { GEMINI_TTS_MAX_TOTAL_CHARS } from '@/lib/constants/tts';
import connectDB from '@/lib/db/mongoose';
import Article from '@/lib/models/Article';
import { buildArticleFullTtsText, queueTtsAsset } from '@/lib/server/ttsAssets';
import { getStoredArticleById } from '@/lib/storage/articlesFile';
import {
  buildStoredTtsAudioUrl,
  hasStoredTtsAudioAtRelativePath,
  saveTtsAudioBuffer,
} from '@/lib/utils/ttsStorage';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ArticleListenSource = {
  id: string;
  title: string;
  summary: string;
  content: string;
};

function clampTtsText(value: string, maxChars: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  return trimmed.slice(0, maxChars).trim();
}

function hashValue(value: string) {
  return crypto.createHash('sha1').update(value).digest('hex');
}

function buildArticleTtsRelativePath(input: {
  articleId: string;
  text: string;
  languageCode: string;
  model: string;
  voice: string;
}) {
  const safeArticleId =
    input.articleId
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || hashValue(input.articleId);
  const versionHash = hashValue(
    JSON.stringify({
      variant: 'article_full',
      text: input.text,
      languageCode: input.languageCode,
      model: input.model,
      voice: input.voice,
      provider: 'gemini',
    })
  );

  return `article/${safeArticleId}/article_full/${versionHash}.wav`;
}

async function shouldUseFileStore() {
  if (!process.env.MONGODB_URI) {
    return true;
  }

  try {
    await connectDB();
    return false;
  } catch (error) {
    console.error('MongoDB unavailable for article TTS route, using file store.', error);
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

async function synthesizeArticleListenAudio(input: {
  text: string;
  languageCode?: string;
  voice?: string;
}) {
  const synthesized = await synthesizeGeminiSpeech({
    text: input.text,
    languageCode: input.languageCode,
    voice: input.voice,
  });

  if (synthesized.mode === 'unavailable') {
    throw new Error(synthesized.reason);
  }

  return synthesized;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const articleId = id.trim();
    const body = (await req.json().catch(() => ({}))) as {
      languageCode?: string;
      voice?: string;
    };
    const languageCode =
      typeof body.languageCode === 'string' ? body.languageCode.trim() : '';
    const voice = typeof body.voice === 'string' ? body.voice.trim() : '';
    const runtime = getGeminiTtsRuntimeConfig();

    if (!articleId) {
      return NextResponse.json(
        { success: false, error: 'Invalid article ID' },
        { status: 400 }
      );
    }

    if (!isGeminiTtsConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Gemini TTS is not configured. Set GEMINI_API_KEY.' },
        { status: 501 }
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

    const sourceText = clampTtsText(
      buildArticleFullTtsText({
        title: article.title,
        summary: article.summary,
        content: article.content,
      }),
      GEMINI_TTS_MAX_TOTAL_CHARS
    );

    if (!sourceText) {
      return NextResponse.json(
        { success: false, error: 'No article text is available for listen mode.' },
        { status: 400 }
      );
    }

    const resolvedLanguageCode = languageCode || 'hi-IN';
    const relativePath = buildArticleTtsRelativePath({
      articleId: article.id,
      text: sourceText,
      languageCode: resolvedLanguageCode,
      model: runtime.model,
      voice: runtime.defaultVoice,
    });

    try {
      if (await hasStoredTtsAudioAtRelativePath(relativePath)) {
        return NextResponse.json({
          success: true,
          data: {
            status: 'ready',
            provider: 'gemini',
            model: runtime.model,
            voice: runtime.defaultVoice,
            mimeType: 'audio/wav',
            chunkCount: 1,
            audioUrl: await buildStoredTtsAudioUrl(relativePath),
          },
        });
      }
    } catch (error) {
      console.error('Stored article TTS lookup failed, generating fresh audio:', error);
    }

    if (process.env.TTS_ASYNC_QUEUE_ENABLED !== '0' && !useFileStore) {
      const queued = await queueTtsAsset({
        sourceType: 'article',
        sourceId: article.id,
        variant: 'article_full',
        title: article.title,
        text: sourceText,
        languageCode: resolvedLanguageCode,
        ...(voice ? { voice } : {}),
        metadata: {
          requestPath: `/api/articles/${article.id}/tts`,
        },
      });

      if (queued.asset?.status === 'ready' && queued.asset.audioUrl) {
        return NextResponse.json({
          success: true,
          data: {
            status: 'ready',
            provider: 'gemini',
            model: queued.asset.model,
            voice: queued.asset.voice,
            mimeType: queued.asset.mimeType,
            chunkCount: queued.asset.chunkCount,
            audioUrl: queued.asset.audioUrl,
          },
        });
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            status: queued.status,
            provider: 'gemini',
            model: queued.asset?.model || runtime.model,
            voice: queued.asset?.voice || runtime.defaultVoice,
            mimeType: 'audio/wav',
            jobId: queued.asset?._id?.toString(),
            retryAfterSeconds: queued.status === 'failed' ? 60 : 10,
            ...(queued.error ? { error: queued.error } : {}),
          },
        },
        { status: queued.status === 'failed' ? 200 : 202 }
      );
    }

    const synthesized = await synthesizeArticleListenAudio({
      text: sourceText,
      languageCode: resolvedLanguageCode,
      ...(voice ? { voice } : {}),
    });

    if (synthesized.mode === 'gemini' && synthesized.audioBase64) {
      try {
        const saved = await saveTtsAudioBuffer({
          buffer: Buffer.from(synthesized.audioBase64, 'base64'),
          targetDir: relativePath.split('/').slice(0, -1).join('/'),
          targetName: relativePath.split('/').pop() || 'article.wav',
        });

        return NextResponse.json({
          success: true,
          data: {
            status: 'ready',
            ...synthesized,
            audioBase64: undefined,
            audioUrl: saved.audioUrl,
          },
        });
      } catch (error) {
        console.error('Failed to store article TTS audio, returning inline audio:', error);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        status: synthesized.mode === 'gemini' ? 'ready' : 'failed',
        ...synthesized,
      },
    });
  } catch (error) {
    console.error('Article TTS route failed:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error && error.message.trim()
            ? error.message
            : 'Failed to synthesize article audio.',
      },
      { status: 500 }
    );
  }
}
