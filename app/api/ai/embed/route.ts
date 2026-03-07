import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import Article from '@/lib/models/Article';
import EPaper from '@/lib/models/EPaper';
import Story from '@/lib/models/Story';
import Video from '@/lib/models/Video';
import { verifyAdminToken } from '@/lib/auth/adminToken';
import {
  embedContent,
  generateContentSummary,
  type ContentType,
  type EmbeddableContent,
} from '@/lib/ai/contentEmbedder';

type EmbedRequestType = ContentType | 'all';

type EmbedRequestBody = {
  type?: EmbedRequestType;
  id?: string;
  embedAll?: boolean;
};

type TrainingSummary = {
  total: number;
  trained: number;
  percent: number;
};

type TrainingStatusResponse = Record<ContentType, TrainingSummary> & {
  overall: TrainingSummary;
};

type TrainingRunResult = {
  processed: number;
  updated: number;
  failed: number;
  errors: string[];
};

type ArticleTrainDoc = {
  _id?: unknown;
  title?: string;
  summary?: string;
  content?: string;
  category?: string;
  image?: string;
  publishedAt?: Date | string;
  author?: string;
};

type EPaperTrainDoc = {
  _id?: unknown;
  title?: string;
  cityName?: string;
  publishDate?: Date | string;
  thumbnailPath?: string;
  thumbnail?: string;
};

type VideoTrainDoc = {
  _id?: unknown;
  title?: string;
  description?: string;
  category?: string;
  thumbnail?: string;
  publishedAt?: Date | string;
  duration?: number;
  isShort?: boolean;
};

type StoryTrainDoc = {
  _id?: unknown;
  title?: string;
  caption?: string;
  category?: string;
  thumbnail?: string;
  publishedAt?: Date | string;
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

function toPercent(trained: number, total: number) {
  if (!total) return 0;
  return Math.round((trained / total) * 100);
}

async function getTrainingSummary(
  model: {
    countDocuments: (filter?: Record<string, unknown>) => Promise<number>;
  },
  filter: Record<string, unknown> = {}
): Promise<TrainingSummary> {
  const [total, trained] = await Promise.all([
    model.countDocuments(filter),
    model.countDocuments({
      ...filter,
      embeddingGeneratedAt: { $ne: null },
    }),
  ]);

  return {
    total,
    trained,
    percent: toPercent(trained, total),
  };
}

async function getTrainingStatus(): Promise<TrainingStatusResponse> {
  const [article, epaper, video, story] = await Promise.all([
    getTrainingSummary(Article),
    getTrainingSummary(EPaper, { status: 'published' }),
    getTrainingSummary(Video, { isPublished: true }),
    getTrainingSummary(Story, { isPublished: true }),
  ]);

  const overallTotal = article.total + epaper.total + video.total + story.total;
  const overallTrained =
    article.trained + epaper.trained + video.trained + story.trained;

  return {
    article,
    epaper,
    video,
    story,
    overall: {
      total: overallTotal,
      trained: overallTrained,
      percent: toPercent(overallTrained, overallTotal),
    },
  };
}

function toArticleContent(doc: ArticleTrainDoc): EmbeddableContent | null {
  const id = normalizeId(doc._id);
  const title = nonEmpty(doc.title);

  if (!id || !title) return null;

  return {
    _id: id,
    type: 'article',
    title,
    description: nonEmpty(
      doc.summary,
      typeof doc.content === 'string' ? doc.content.slice(0, 240) : ''
    ),
    category: nonEmpty(doc.category, 'News'),
    date: normalizeDate(doc.publishedAt),
    url: `/main/article/${encodeURIComponent(id)}`,
    thumbnail: nonEmpty(doc.image, '/placeholders/news-16x9.svg'),
    tags: [nonEmpty(doc.category, 'News'), nonEmpty(doc.author, 'Lokswami')],
  };
}

function toEPaperContent(doc: EPaperTrainDoc): EmbeddableContent | null {
  const id = normalizeId(doc._id);
  const title = nonEmpty(doc.title);

  if (!id || !title) return null;

  return {
    _id: id,
    type: 'epaper',
    title,
    description: nonEmpty(doc.cityName, 'Digital newspaper edition'),
    category: 'E-Paper',
    date: normalizeDate(doc.publishDate),
    url: `/main/epaper?paper=${encodeURIComponent(id)}`,
    thumbnail: nonEmpty(doc.thumbnailPath, nonEmpty(doc.thumbnail, '/placeholders/epaper.svg')),
    tags: ['epaper', nonEmpty(doc.cityName, 'Lokswami')],
  };
}

function toVideoContent(doc: VideoTrainDoc): EmbeddableContent | null {
  const id = normalizeId(doc._id);
  const title = nonEmpty(doc.title);

  if (!id || !title) return null;

  return {
    _id: id,
    type: 'video',
    title,
    description: nonEmpty(doc.description),
    category: nonEmpty(doc.category, 'Videos'),
    date: normalizeDate(doc.publishedAt),
    url: `/main/videos`,
    thumbnail: nonEmpty(doc.thumbnail, '/placeholders/video.svg'),
    tags: [
      nonEmpty(doc.category, 'Videos'),
      doc.isShort ? 'short' : 'video',
      typeof doc.duration === 'number' ? `${doc.duration}s` : '',
    ].filter(Boolean),
  };
}

function toStoryContent(doc: StoryTrainDoc): EmbeddableContent | null {
  const id = normalizeId(doc._id);
  const title = nonEmpty(doc.title);

  if (!id || !title) return null;

  return {
    _id: id,
    type: 'story',
    title,
    description: nonEmpty(doc.caption),
    category: nonEmpty(doc.category, 'Short'),
    date: normalizeDate(doc.publishedAt),
    url: `/main/stories?story=${encodeURIComponent(id)}`,
    thumbnail: nonEmpty(doc.thumbnail, '/placeholders/story.svg'),
    tags: [nonEmpty(doc.category, 'Short'), 'ftaftaf'],
  };
}

async function trainArticles(id?: string, embedAll?: boolean): Promise<TrainingRunResult> {
  const docs = (
    id
      ? [await Article.findById(id).select('title summary content category image publishedAt author').lean()]
      : await Article.find({})
          .sort({ publishedAt: -1 })
          .select('title summary content category image publishedAt author')
          .lean()
  ) as Array<ArticleTrainDoc | null>;

  const result: TrainingRunResult = {
    processed: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };

  for (const doc of docs) {
    if (!doc) continue;
    result.processed += 1;

    try {
      const content = toArticleContent(doc);
      if (!content) {
        throw new Error('Article content is incomplete.');
      }

      const aiSummary = (await generateContentSummary(content, 'hi')).trim();
      const embedding = await embedContent({
        ...content,
        description: aiSummary || content.description,
      });

      await Article.findByIdAndUpdate(content._id, {
        $set: {
          aiSummary,
          embedding,
          embeddingGeneratedAt: new Date(),
        },
      });

      result.updated += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push(
        `[article:${normalizeId(doc._id)}] ${error instanceof Error ? error.message : 'Embedding failed'}`
      );
      if (!embedAll && id) break;
    }
  }

  return result;
}

async function trainEPapers(id?: string, embedAll?: boolean): Promise<TrainingRunResult> {
  const docs = (
    id
      ? [await EPaper.findById(id).select('title cityName publishDate thumbnailPath thumbnail').lean()]
      : await EPaper.find({ status: 'published' })
          .sort({ publishDate: -1 })
          .select('title cityName publishDate thumbnailPath thumbnail')
          .lean()
  ) as Array<EPaperTrainDoc | null>;

  const result: TrainingRunResult = {
    processed: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };

  for (const doc of docs) {
    if (!doc) continue;
    result.processed += 1;

    try {
      const content = toEPaperContent(doc);
      if (!content) {
        throw new Error('E-paper content is incomplete.');
      }

      const aiSummary = (await generateContentSummary(content, 'hi')).trim();
      const embedding = await embedContent({
        ...content,
        description: aiSummary || content.description,
      });

      await EPaper.findByIdAndUpdate(content._id, {
        $set: {
          aiSummary,
          embedding,
          embeddingGeneratedAt: new Date(),
        },
      });

      result.updated += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push(
        `[epaper:${normalizeId(doc._id)}] ${error instanceof Error ? error.message : 'Embedding failed'}`
      );
      if (!embedAll && id) break;
    }
  }

  return result;
}

async function trainVideos(id?: string, embedAll?: boolean): Promise<TrainingRunResult> {
  const docs = (
    id
      ? [await Video.findById(id).select('title description category thumbnail publishedAt duration isShort').lean()]
      : await Video.find({ isPublished: true })
          .sort({ publishedAt: -1 })
          .select('title description category thumbnail publishedAt duration isShort')
          .lean()
  ) as Array<VideoTrainDoc | null>;

  const result: TrainingRunResult = {
    processed: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };

  for (const doc of docs) {
    if (!doc) continue;
    result.processed += 1;

    try {
      const content = toVideoContent(doc);
      if (!content) {
        throw new Error('Video content is incomplete.');
      }

      const aiSummary = (await generateContentSummary(content, 'hi')).trim();
      const embedding = await embedContent({
        ...content,
        description: aiSummary || content.description,
      });

      await Video.findByIdAndUpdate(content._id, {
        $set: {
          aiSummary,
          embedding,
          embeddingGeneratedAt: new Date(),
        },
      });

      result.updated += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push(
        `[video:${normalizeId(doc._id)}] ${error instanceof Error ? error.message : 'Embedding failed'}`
      );
      if (!embedAll && id) break;
    }
  }

  return result;
}

async function trainStories(id?: string, embedAll?: boolean): Promise<TrainingRunResult> {
  const docs = (
    id
      ? [await Story.findById(id).select('title caption category thumbnail publishedAt').lean()]
      : await Story.find({ isPublished: true })
          .sort({ priority: -1, publishedAt: -1 })
          .select('title caption category thumbnail publishedAt')
          .lean()
  ) as Array<StoryTrainDoc | null>;

  const result: TrainingRunResult = {
    processed: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };

  for (const doc of docs) {
    if (!doc) continue;
    result.processed += 1;

    try {
      const content = toStoryContent(doc);
      if (!content) {
        throw new Error('Story content is incomplete.');
      }

      const aiSummary = (await generateContentSummary(content, 'hi')).trim();
      const embedding = await embedContent({
        ...content,
        description: aiSummary || content.description,
      });

      await Story.findByIdAndUpdate(content._id, {
        $set: {
          aiSummary,
          embedding,
          embeddingGeneratedAt: new Date(),
        },
      });

      result.updated += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push(
        `[story:${normalizeId(doc._id)}] ${error instanceof Error ? error.message : 'Embedding failed'}`
      );
      if (!embedAll && id) break;
    }
  }

  return result;
}

async function runTraining(
  type: ContentType,
  id?: string,
  embedAll?: boolean
): Promise<TrainingRunResult> {
  if (type === 'article') return trainArticles(id, embedAll);
  if (type === 'epaper') return trainEPapers(id, embedAll);
  if (type === 'video') return trainVideos(id, embedAll);
  return trainStories(id, embedAll);
}

export async function GET(req: NextRequest) {
  const admin = verifyAdminToken(req);
  if (!admin) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    await connectDB();
    const status = await getTrainingStatus();

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('[AI Embed] Failed to load training status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load training status' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const admin = verifyAdminToken(req);
  if (!admin) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    await connectDB();

    const body = (await req.json().catch(() => ({}))) as EmbedRequestBody;
    const type = body.type;
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    const embedAll = Boolean(body.embedAll);

    if (!type) {
      return NextResponse.json(
        { success: false, error: 'type is required' },
        { status: 400 }
      );
    }

    if (type !== 'all' && !embedAll && !id) {
      return NextResponse.json(
        { success: false, error: 'Provide id or set embedAll=true' },
        { status: 400 }
      );
    }

    if (type === 'all' && !embedAll) {
      return NextResponse.json(
        { success: false, error: 'Use embedAll=true for type=all' },
        { status: 400 }
      );
    }

    const results: Partial<Record<ContentType, TrainingRunResult>> = {};

    if (type === 'all') {
      results.article = await runTraining('article', '', true);
      results.epaper = await runTraining('epaper', '', true);
      results.video = await runTraining('video', '', true);
      results.story = await runTraining('story', '', true);
    } else {
      results[type] = await runTraining(type, id, embedAll);
    }

    const status = await getTrainingStatus();

    return NextResponse.json({
      success: true,
      message: 'Embedding completed',
      data: {
        results,
        status,
      },
    });
  } catch (error) {
    console.error('[AI Embed] Training failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Embedding failed',
      },
      { status: 500 }
    );
  }
}
