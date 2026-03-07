import { NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import Article from '@/lib/models/Article';
import EPaper from '@/lib/models/EPaper';
import Story from '@/lib/models/Story';
import Video from '@/lib/models/Video';

type SuggestionPayload = {
  latestEpaper: { title: string; date: string; url: string } | null;
  trendingVideo: { title: string; thumbnail: string; url: string } | null;
  topStory: { title: string; thumbnail: string; url: string; durationSeconds?: number } | null;
  breakingArticle: { title: string; url: string } | null;
};

type EPaperSuggestionDoc = {
  _id?: unknown;
  title?: string;
  publishDate?: Date | string;
};

type VideoSuggestionDoc = {
  _id?: unknown;
  title?: string;
  thumbnail?: string;
};

type StorySuggestionDoc = {
  _id?: unknown;
  title?: string;
  thumbnail?: string;
  durationSeconds?: number;
};

type ArticleSuggestionDoc = {
  _id?: unknown;
  title?: string;
};

function normalizeId(value: unknown) {
  if (typeof value === 'string') return value;
  if (
    value &&
    typeof value === 'object' &&
    'toString' in value &&
    typeof value.toString === 'function'
  ) {
    return value.toString();
  }
  return '';
}

function normalizeDate(value: Date | string | undefined) {
  const date =
    value instanceof Date
      ? value
      : typeof value === 'string'
        ? new Date(value)
        : new Date();

  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function nonEmpty(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      globalThis.setTimeout(() => {
        reject(new Error(`${label} timed out after ${ms}ms`));
      }, ms);
    }),
  ]);
}

export async function GET() {
  try {
    await withTimeout(connectDB(), 5000, 'MongoDB connection');

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      latestEpaperDoc,
      trendingVideoDoc,
      fallbackVideoDoc,
      latestMojoDoc,
      breakingArticleDoc,
    ] = await withTimeout(
      Promise.all([
        EPaper.findOne({ status: 'published' })
          .sort({ publishDate: -1 })
          .select('title publishDate')
          .lean() as Promise<EPaperSuggestionDoc | null>,
        Video.findOne({
          isPublished: true,
          publishedAt: { $gte: startOfToday },
        })
          .sort({ views: -1, publishedAt: -1 })
          .select('title thumbnail')
          .lean() as Promise<VideoSuggestionDoc | null>,
        Video.findOne({ isPublished: true })
          .sort({ publishedAt: -1 })
          .select('title thumbnail')
          .lean() as Promise<VideoSuggestionDoc | null>,
        Story.findOne({ isPublished: true })
          .sort({ publishedAt: -1 })
          .select('title thumbnail durationSeconds')
          .lean() as Promise<StorySuggestionDoc | null>,
        Article.findOne({ isBreaking: true })
          .sort({ publishedAt: -1 })
          .select('title')
          .lean() as Promise<ArticleSuggestionDoc | null>,
      ]),
      5000,
      'AI suggestions query'
    );

    const latestEpaperId = normalizeId(latestEpaperDoc?._id);
    const effectiveTrendingVideo = trendingVideoDoc || fallbackVideoDoc;
    const breakingArticleId = normalizeId(breakingArticleDoc?._id);

    const payload: SuggestionPayload = {
      latestEpaper:
        latestEpaperDoc && latestEpaperId
          ? {
              title: nonEmpty(latestEpaperDoc.title, 'आज का अखबार'),
              date: normalizeDate(latestEpaperDoc.publishDate),
              url: `/main/epaper?paper=${encodeURIComponent(latestEpaperId)}`,
            }
          : null,
      trendingVideo:
        effectiveTrendingVideo
          ? {
              title: nonEmpty(effectiveTrendingVideo.title, 'आज का वायरल वीडियो'),
              thumbnail: nonEmpty(effectiveTrendingVideo.thumbnail, '/placeholders/video.svg'),
              url: '/main/videos',
            }
          : null,
      topStory:
        latestMojoDoc
          ? {
              title: nonEmpty(latestMojoDoc.title, 'आज का Mojo'),
              thumbnail: nonEmpty(latestMojoDoc.thumbnail, '/placeholders/story.svg'),
              url: '/main/ftaftaf',
              durationSeconds:
                typeof latestMojoDoc.durationSeconds === 'number'
                  ? latestMojoDoc.durationSeconds
                  : undefined,
            }
          : null,
      breakingArticle:
        breakingArticleDoc && breakingArticleId
          ? {
              title: nonEmpty(breakingArticleDoc.title, 'ब्रेकिंग खबर'),
              url: `/main/article/${encodeURIComponent(breakingArticleId)}`,
            }
          : null,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('[AI Suggestions] Failed to load suggestions:', error);
    return NextResponse.json({
      latestEpaper: null,
      trendingVideo: null,
      topStory: null,
      breakingArticle: null,
    });
  }
}
