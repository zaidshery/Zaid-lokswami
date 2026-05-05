import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import {
  isGeminiTtsConfigured,
  synthesizeGeminiSpeech,
} from '@/lib/ai/geminiTts';
import { GEMINI_TTS_MAX_TOTAL_CHARS } from '@/lib/constants/tts';
import connectDB from '@/lib/db/mongoose';
import EPaper from '@/lib/models/EPaper';
import EPaperArticle from '@/lib/models/EPaperArticle';
import {
  buildEpaperStoryTtsText,
  ensureTtsAsset,
  findReadyManualTtsAsset,
} from '@/lib/server/ttsAssets';
import { getStoredEPaperById } from '@/lib/storage/epapersFile';

type RouteContext = {
  params: Promise<{ id: string; articleId: string }>;
};

type EpaperStoryListenSource = {
  paperId: string;
  storyId: string;
  paperTitle: string;
  cityName: string;
  publishDate: string;
  pageNumber: number;
  title: string;
  excerpt: string;
  contentHtml: string;
};

function clampTtsText(value: string, maxChars: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  return trimmed.slice(0, maxChars).trim();
}

async function shouldUseFileStore() {
  if (!process.env.MONGODB_URI) {
    return true;
  }

  try {
    await connectDB();
    return false;
  } catch (error) {
    console.error('MongoDB unavailable for e-paper TTS route, using file store.', error);
    return true;
  }
}

function mapStoredStory(
  paper: NonNullable<Awaited<ReturnType<typeof getStoredEPaperById>>>,
  articleId: string
) {
  const hotspots = Array.isArray(paper.articleHotspots) ? paper.articleHotspots : [];

  for (let index = 0; index < hotspots.length; index += 1) {
    const hotspot = hotspots[index];
    const derivedId = `${paper._id}-${String(hotspot.id || index + 1)}`;
    if (derivedId !== articleId) continue;

    return {
      paperId: String(paper._id),
      storyId: derivedId,
      paperTitle: String(paper.title || '').trim(),
      cityName: String(paper.city || '').trim(),
      publishDate: String(paper.publishDate || '').trim(),
      pageNumber: Math.max(1, Number(hotspot.page || 1)),
      title: String(hotspot.title || '').trim() || `Story ${index + 1}`,
      excerpt: String(hotspot.text || '').trim(),
      contentHtml: '',
    } satisfies EpaperStoryListenSource;
  }

  return null;
}

async function loadEpaperStoryForListen(params: {
  paperId: string;
  articleId: string;
  useFileStore: boolean;
}) {
  if (params.useFileStore) {
    const stored = await getStoredEPaperById(params.paperId);
    if (!stored) return null;
    return mapStoredStory(stored, params.articleId);
  }

  if (!Types.ObjectId.isValid(params.paperId) || !Types.ObjectId.isValid(params.articleId)) {
    return null;
  }

  const epaper = await EPaper.findById(params.paperId)
    .select('_id title cityName publishDate status');
  if (!epaper || epaper.status !== 'published') {
    return null;
  }

  const story = await EPaperArticle.findOne({
    _id: params.articleId,
    epaperId: params.paperId,
  }).select('_id epaperId pageNumber title excerpt contentHtml');

  if (!story) {
    return null;
  }

  return {
    paperId: String(epaper._id),
    storyId: String(story._id),
    paperTitle: String(epaper.title || '').trim(),
    cityName: String(epaper.cityName || '').trim(),
    publishDate:
      epaper.publishDate instanceof Date
        ? epaper.publishDate.toISOString()
        : String(epaper.publishDate || '').trim(),
    pageNumber: Math.max(1, Number(story.pageNumber || 1)),
    title: String(story.title || '').trim(),
    excerpt: String(story.excerpt || '').trim(),
    contentHtml: String(story.contentHtml || '').trim(),
  } satisfies EpaperStoryListenSource;
}

async function synthesizeEpaperStoryAudio(input: {
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
    const { id, articleId } = await context.params;
    const paperId = id.trim();
    const storyId = articleId.trim();
    const body = (await req.json().catch(() => ({}))) as {
      languageCode?: string;
      voice?: string;
    };
    const languageCode =
      typeof body.languageCode === 'string' ? body.languageCode.trim() : '';
    const voice = typeof body.voice === 'string' ? body.voice.trim() : '';

    if (!paperId || !storyId) {
      return NextResponse.json(
        { success: false, error: 'Invalid e-paper story ID' },
        { status: 400 }
      );
    }

    const useFileStore = await shouldUseFileStore();
    const story = await loadEpaperStoryForListen({
      paperId,
      articleId: storyId,
      useFileStore,
    });

    if (!story) {
      return NextResponse.json(
        { success: false, error: 'Story not found' },
        { status: 404 }
      );
    }

    if (!useFileStore) {
      const manualAsset = await findReadyManualTtsAsset({
        sourceType: 'epaperArticle',
        sourceId: story.storyId,
        variant: 'epaper_story',
      });
      if (manualAsset?.audioUrl) {
        return NextResponse.json({
          success: true,
          data: {
            provider: 'manual',
            model: manualAsset.model,
            voice: manualAsset.voice,
            mimeType: manualAsset.mimeType,
            chunkCount: manualAsset.chunkCount,
            audioUrl: manualAsset.audioUrl,
          },
        });
      }
    }

    const sourceText = clampTtsText(
      buildEpaperStoryTtsText({
        title: story.title,
        excerpt: story.excerpt,
        contentHtml: story.contentHtml,
      }),
      GEMINI_TTS_MAX_TOTAL_CHARS
    );

    if (!sourceText) {
      return NextResponse.json(
        { success: false, error: 'Readable text is not available for this story yet.' },
        { status: 400 }
      );
    }

    if (!isGeminiTtsConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Gemini TTS is not configured. Set GEMINI_API_KEY.' },
        { status: 501 }
      );
    }

    if (!useFileStore) {
      try {
        const result = await ensureTtsAsset({
          sourceType: 'epaperArticle',
          sourceId: story.storyId,
          sourceParentId: story.paperId,
          variant: 'epaper_story',
          title: story.title || story.paperTitle,
          text: sourceText,
          ...(languageCode ? { languageCode } : {}),
          ...(voice ? { voice } : {}),
          metadata: {
            source: 'epaper-reader',
            paperTitle: story.paperTitle,
            cityName: story.cityName,
            publishDate: story.publishDate,
            pageNumber: story.pageNumber,
          },
        });

        if (result.asset?.status === 'ready' && result.asset.audioUrl) {
          return NextResponse.json({
            success: true,
            data: {
              provider: 'gemini',
              model: result.asset.model,
              voice: result.asset.voice,
              mimeType: result.asset.mimeType,
              chunkCount: result.asset.chunkCount,
              audioUrl: result.asset.audioUrl,
            },
          });
        }

        if (result.error) {
          console.error(
            'Shared e-paper TTS asset unavailable, falling back to direct synthesis:',
            result.error
          );
        }
      } catch (error) {
        console.error(
          'Shared e-paper TTS asset generation failed, falling back to direct synthesis:',
          error
        );
      }
    }

    const synthesized = await synthesizeEpaperStoryAudio({
      text: sourceText,
      ...(languageCode ? { languageCode } : {}),
      ...(voice ? { voice } : {}),
    });

    return NextResponse.json({
      success: true,
      data: synthesized,
    });
  } catch (error) {
    console.error('E-paper story TTS route failed:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error && error.message.trim()
            ? error.message
            : 'Failed to synthesize e-paper story audio.',
      },
      { status: 500 }
    );
  }
}
