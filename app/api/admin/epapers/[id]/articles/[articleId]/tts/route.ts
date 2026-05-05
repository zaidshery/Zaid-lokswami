import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import { getAdminSession } from '@/lib/auth/admin';
import EPaper from '@/lib/models/EPaper';
import EPaperArticle from '@/lib/models/EPaperArticle';
import {
  buildEpaperStoryTtsText,
  ensureTtsAsset,
  findReadyManualTtsAsset,
  findCurrentTtsAsset,
} from '@/lib/server/ttsAssets';

type RouteContext = {
  params: Promise<{ id: string; articleId: string }>;
};

type SerializableTtsAsset = {
  id: string;
  status: string;
  provider: string;
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
    provider: String(source.provider || ''),
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
    console.error('MongoDB unavailable for admin e-paper TTS route:', error);
    return 'Shared admin TTS controls are unavailable right now.';
  }
}

async function loadStorySource(paperId: string, storyId: string) {
  if (!Types.ObjectId.isValid(paperId) || !Types.ObjectId.isValid(storyId)) {
    return null;
  }

  const [paper, story] = await Promise.all([
    EPaper.findById(paperId).select('_id title cityName publishDate'),
    EPaperArticle.findOne({ _id: storyId, epaperId: paperId }).select(
      '_id epaperId pageNumber title excerpt contentHtml'
    ),
  ]);

  if (!paper || !story) {
    return null;
  }

  return {
    paperId: String(paper._id),
    storyId: String(story._id),
    paperTitle: String(paper.title || '').trim(),
    cityName: String(paper.cityName || '').trim(),
    publishDate:
      paper.publishDate instanceof Date
        ? paper.publishDate.toISOString()
        : String(paper.publishDate || '').trim(),
    pageNumber: Math.max(1, Number(story.pageNumber || 1)),
    title: String(story.title || '').trim(),
    excerpt: String(story.excerpt || '').trim(),
    contentHtml: String(story.contentHtml || '').trim(),
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

    const mongoError = await requireMongoBackedTts();
    if (mongoError) {
      return NextResponse.json(
        { success: false, error: mongoError },
        { status: 503 }
      );
    }

    const { id, articleId } = await context.params;
    const story = await loadStorySource(id.trim(), articleId.trim());

    if (!story) {
      return NextResponse.json(
        { success: false, error: 'Story not found' },
        { status: 404 }
      );
    }

    const manualAsset = await findReadyManualTtsAsset({
      sourceType: 'epaperArticle',
      sourceId: story.storyId,
      variant: 'epaper_story',
      actor: admin,
    });
    if (manualAsset?.audioUrl) {
      return NextResponse.json({
        success: true,
        data: {
          variant: 'epaper_story',
          eligible: true,
          ready: true,
          asset: serializeTtsAsset(manualAsset),
          message: 'Manual story listen audio is ready.',
        },
      });
    }

    const text = buildEpaperStoryTtsText({
      title: story.title,
      excerpt: story.excerpt,
      contentHtml: story.contentHtml,
    });
    if (!text) {
      return NextResponse.json({
        success: true,
        data: {
          variant: 'epaper_story',
          eligible: false,
          ready: false,
          asset: null,
          message: 'Save readable text for this story before generating listen audio.',
        },
      });
    }

    const current = await findCurrentTtsAsset({
      sourceType: 'epaperArticle',
      sourceId: story.storyId,
      sourceParentId: story.paperId,
      variant: 'epaper_story',
      title: story.title || story.paperTitle,
      text,
    });
    const asset = serializeTtsAsset(current.asset);
    const ready = Boolean(asset?.status === 'ready' && asset.audioUrl);

    return NextResponse.json({
      success: true,
      data: {
        variant: 'epaper_story',
        eligible: true,
        ready,
        asset,
        message: ready
          ? 'Story listen audio is ready for the current saved text.'
          : asset?.lastError || 'No reusable story listen audio exists for the current saved text yet.',
      },
    });
  } catch (error) {
    console.error('Failed to load admin e-paper TTS status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load story TTS status.' },
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

    const mongoError = await requireMongoBackedTts();
    if (mongoError) {
      return NextResponse.json(
        { success: false, error: mongoError },
        { status: 503 }
      );
    }

    const { id, articleId } = await context.params;
    const story = await loadStorySource(id.trim(), articleId.trim());

    if (!story) {
      return NextResponse.json(
        { success: false, error: 'Story not found' },
        { status: 404 }
      );
    }

    const text = buildEpaperStoryTtsText({
      title: story.title,
      excerpt: story.excerpt,
      contentHtml: story.contentHtml,
    });
    if (!text) {
      return NextResponse.json(
        {
          success: false,
          error: 'Save readable text for this story before generating listen audio.',
        },
        { status: 400 }
      );
    }

    const forceRegenerate = req.nextUrl.searchParams.get('force') !== '0';
    const result = await ensureTtsAsset({
      sourceType: 'epaperArticle',
      sourceId: story.storyId,
      sourceParentId: story.paperId,
      variant: 'epaper_story',
      title: story.title || story.paperTitle,
      text,
      forceRegenerate,
      actor: admin,
      metadata: {
        source: 'admin-epaper-page-editor',
        paperTitle: story.paperTitle,
        cityName: story.cityName,
        publishDate: story.publishDate,
        pageNumber: story.pageNumber,
      },
    });

    if (!result.asset || result.asset.status !== 'ready' || !result.asset.audioUrl) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Unable to generate story listen audio right now.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        variant: 'epaper_story',
        eligible: true,
        ready: true,
        asset: serializeTtsAsset(result.asset),
        message: result.reused
          ? 'Story listen audio is already ready for the current saved text.'
          : 'Story listen audio generated successfully.',
      },
    });
  } catch (error) {
    console.error('Failed to generate admin e-paper TTS:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate story listen audio.' },
      { status: 500 }
    );
  }
}
