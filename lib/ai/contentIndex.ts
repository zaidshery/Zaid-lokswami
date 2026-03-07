import connectDB from '@/lib/db/mongoose';
import type { ContentType } from '@/lib/ai/contentEmbedder';
import Article from '@/lib/models/Article';
import EPaper from '@/lib/models/EPaper';
import Story from '@/lib/models/Story';
import Video from '@/lib/models/Video';

export interface IndexedContent {
  id: string;
  type: ContentType;
  title: string;
  description: string;
  category: string;
  thumbnail: string;
  url: string;
  date: string;
  embedding: number[];
  similarityScore?: number;
  durationSeconds?: number;
  authorName?: string;
  views?: number;
  tags?: string[];
}

type ArticleIndexDoc = {
  _id?: unknown;
  title?: string;
  summary?: string;
  category?: string;
  image?: string;
  publishedAt?: Date | string;
  embedding?: number[];
  aiSummary?: string;
  author?: string;
  views?: number;
  isBreaking?: boolean;
  isTrending?: boolean;
};

type EPaperIndexDoc = {
  _id?: unknown;
  title?: string;
  cityName?: string;
  publishDate?: Date | string;
  thumbnailPath?: string;
  thumbnail?: string;
  embedding?: number[];
  aiSummary?: string;
};

type VideoIndexDoc = {
  _id?: unknown;
  title?: string;
  description?: string;
  category?: string;
  thumbnail?: string;
  publishedAt?: Date | string;
  embedding?: number[];
  aiSummary?: string;
  duration?: number;
  views?: number;
};

type StoryIndexDoc = {
  _id?: unknown;
  title?: string;
  caption?: string;
  category?: string;
  thumbnail?: string;
  publishedAt?: Date | string;
  embedding?: number[];
  aiSummary?: string;
  views?: number;
  author?: string;
  mediaType?: 'image' | 'video';
  durationSeconds?: number;
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

function normalizeEmbedding(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
}

function nonEmpty(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function compactTags(values: Array<string | undefined>) {
  return values.map((value) => nonEmpty(value)).filter(Boolean);
}

export async function fetchAllIndexedContent(): Promise<IndexedContent[]> {
  await connectDB();
  const results: IndexedContent[] = [];

  try {
    const articles = (await Article.find({})
      .sort({ publishedAt: -1 })
      .limit(50)
      .select(
        '+embedding title summary category image publishedAt aiSummary author views isBreaking isTrending'
      )
      .lean()) as ArticleIndexDoc[];

    articles.forEach((article) => {
      const id = normalizeId(article._id);
      const title = nonEmpty(article.title);

      if (!id || !title) {
        return;
      }

      results.push({
        id,
        type: 'article',
        title,
        description: nonEmpty(article.aiSummary, nonEmpty(article.summary)),
        category: nonEmpty(article.category, 'News'),
        thumbnail: nonEmpty(article.image, '/placeholders/news-16x9.svg'),
        url: `/main/article/${encodeURIComponent(id)}`,
        date: normalizeDate(article.publishedAt),
        embedding: normalizeEmbedding(article.embedding),
        authorName: nonEmpty(article.author, 'Lokswami'),
        views: typeof article.views === 'number' ? article.views : 0,
        tags: compactTags([
          nonEmpty(article.category, 'News'),
          article.isBreaking ? 'breaking' : '',
          article.isTrending ? 'trending' : '',
        ]),
      });
    });
  } catch (error) {
    console.warn('[ContentIndex] Articles fetch failed:', error);
  }

  try {
    const epapers = (await EPaper.find({ status: 'published' })
      .sort({ publishDate: -1 })
      .limit(20)
      .select('+embedding title cityName publishDate thumbnailPath thumbnail aiSummary')
      .lean()) as EPaperIndexDoc[];

    epapers.forEach((epaper) => {
      const id = normalizeId(epaper._id);
      const title = nonEmpty(epaper.title);

      if (!id || !title) {
        return;
      }

      results.push({
        id,
        type: 'epaper',
        title,
        description: nonEmpty(
          epaper.aiSummary,
          nonEmpty(epaper.cityName, 'Digital newspaper edition')
        ),
        category: 'E-Paper',
        thumbnail: nonEmpty(
          epaper.thumbnailPath,
          nonEmpty(epaper.thumbnail, '/placeholders/epaper.svg')
        ),
        url: `/main/epaper?paper=${encodeURIComponent(id)}`,
        date: normalizeDate(epaper.publishDate),
        embedding: normalizeEmbedding(epaper.embedding),
        tags: compactTags(['epaper', nonEmpty(epaper.cityName)]),
      });
    });
  } catch (error) {
    console.warn('[ContentIndex] E-papers fetch failed:', error);
  }

  try {
    const videos = (await Video.find({ isPublished: true })
      .sort({ publishedAt: -1 })
      .limit(20)
      .select('+embedding title description category thumbnail publishedAt aiSummary duration views')
      .lean()) as VideoIndexDoc[];

    videos.forEach((video) => {
      const id = normalizeId(video._id);
      const title = nonEmpty(video.title);

      if (!id || !title) {
        return;
      }

      results.push({
        id,
        type: 'video',
        title,
        description: nonEmpty(video.aiSummary, nonEmpty(video.description)),
        category: nonEmpty(video.category, 'Videos'),
        thumbnail: nonEmpty(video.thumbnail, '/placeholders/video.svg'),
        url: '/main/videos',
        date: normalizeDate(video.publishedAt),
        embedding: normalizeEmbedding(video.embedding),
        durationSeconds: typeof video.duration === 'number' ? video.duration : undefined,
        views: typeof video.views === 'number' ? video.views : 0,
        tags: compactTags([
          nonEmpty(video.category, 'Videos'),
          typeof video.duration === 'number' ? `${video.duration}s` : '',
          'video',
        ]),
      });
    });
  } catch (error) {
    console.warn('[ContentIndex] Videos fetch failed:', error);
  }

  try {
    const stories = (await Story.find({ isPublished: true })
      .sort({ publishedAt: -1, priority: -1 })
      .limit(20)
      .select(
        '+embedding title caption category thumbnail publishedAt aiSummary views author mediaType durationSeconds'
      )
      .lean()) as StoryIndexDoc[];

    stories.forEach((story) => {
      const id = normalizeId(story._id);
      const title = nonEmpty(story.title);

      if (!id || !title) {
        return;
      }

      results.push({
        id,
        type: 'story',
        title,
        description: nonEmpty(story.aiSummary, nonEmpty(story.caption)),
        category: nonEmpty(story.category, 'Mojo'),
        thumbnail: nonEmpty(story.thumbnail, '/placeholders/story.svg'),
        url: '/main/ftaftaf',
        date: normalizeDate(story.publishedAt),
        embedding: normalizeEmbedding(story.embedding),
        durationSeconds:
          typeof story.durationSeconds === 'number' ? story.durationSeconds : undefined,
        views: typeof story.views === 'number' ? story.views : 0,
        authorName: nonEmpty(story.author, 'Lokswami Desk'),
        tags: compactTags([
          nonEmpty(story.category, 'Mojo'),
          nonEmpty(story.mediaType, 'video'),
          'mojo',
          'short',
        ]),
      });
    });
  } catch (error) {
    console.warn('[ContentIndex] Stories fetch failed:', error);
  }

  return results;
}
