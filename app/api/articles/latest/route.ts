import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import Article from '@/lib/models/Article';
import { listAllStoredArticles } from '@/lib/storage/articlesFile';

const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 5;
const MAX_LIMIT = 50;

type FeedArticle = {
  _id: string;
  id: string;
  title: string;
  summary: string;
  content: string;
  image: string;
  category: string;
  author: string;
  publishedAt: string;
  views: number;
  isBreaking: boolean;
  isTrending: boolean;
};

type Cursor = {
  publishedAt: string;
  id: string;
  date: Date;
};

function parseLimit(raw: string | null) {
  const parsed = Number.parseInt(raw || '', 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, parsed));
}

function parseCursor(
  cursorPublishedAt: string | null,
  cursorId: string | null
): Cursor | null {
  if (!cursorPublishedAt || !cursorId) {
    return null;
  }

  const cursorDate = new Date(cursorPublishedAt);
  if (Number.isNaN(cursorDate.getTime())) {
    return null;
  }

  const id = cursorId.trim();
  if (!id) {
    return null;
  }

  return {
    publishedAt: cursorDate.toISOString(),
    id,
    date: cursorDate,
  };
}

function normalizeDate(value: unknown) {
  const parsed = new Date(
    typeof value === 'string' || typeof value === 'number' || value instanceof Date
      ? value
      : Date.now()
  );
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

function normalizeFeedArticle(source: unknown): FeedArticle | null {
  const input =
    typeof source === 'object' && source ? (source as Record<string, unknown>) : null;
  if (!input) return null;

  const id = String(input._id || '').trim() || String(input.id || '').trim();
  const title = String(input.title || '').trim();
  const summary = String(input.summary || '').trim();
  const content = String(input.content || '').trim();
  const image = String(input.image || '').trim();
  const category = String(input.category || '').trim();
  const author = String(input.author || '').trim();
  const publishedAt = normalizeDate(input.publishedAt);
  const viewsRaw =
    typeof input.views === 'number' ? input.views : Number(input.views || 0);

  if (!id || !title || !summary || !image) {
    return null;
  }

  return {
    _id: id,
    id,
    title,
    summary,
    content,
    image,
    category: category || 'General',
    author: author || 'Editor',
    publishedAt,
    views: Number.isFinite(viewsRaw) ? viewsRaw : 0,
    isBreaking: Boolean(input.isBreaking),
    isTrending: Boolean(input.isTrending),
  };
}

function getSortTime(article: Pick<FeedArticle, 'publishedAt'>) {
  const parsed = new Date(article.publishedAt).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareFeedArticles(a: FeedArticle, b: FeedArticle) {
  const byDate = getSortTime(b) - getSortTime(a);
  if (byDate !== 0) return byDate;
  return b._id.localeCompare(a._id);
}

function applyCursorFilter(items: FeedArticle[], cursor: Cursor | null) {
  if (!cursor) return items;
  const cursorTime = cursor.date.getTime();
  return items.filter((item) => {
    const itemTime = getSortTime(item);
    if (itemTime < cursorTime) return true;
    if (itemTime > cursorTime) return false;
    return item._id < cursor.id;
  });
}

function buildPagedResponse(items: FeedArticle[], limit: number) {
  const hasMore = items.length > limit;
  const pageItems = items.slice(0, limit);
  const last = pageItems[pageItems.length - 1];
  const nextCursor =
    hasMore && last
      ? {
          publishedAt: last.publishedAt,
          id: last._id,
        }
      : null;

  return {
    items: pageItems,
    limit,
    hasMore,
    nextCursor,
  };
}

async function shouldUseFileStore() {
  if (!process.env.MONGODB_URI) {
    return true;
  }

  try {
    await connectDB();
    return false;
  } catch (error) {
    console.error('MongoDB unavailable for public latest feed, using file store.', error);
    return true;
  }
}

async function listFromMongo(limit: number, cursor: Cursor | null) {
  const query: Record<string, unknown> = {};

  if (cursor && Types.ObjectId.isValid(cursor.id)) {
    query.$or = [
      { publishedAt: { $lt: cursor.date } },
      {
        publishedAt: cursor.date,
        _id: { $lt: new Types.ObjectId(cursor.id) },
      },
    ];
  }

  const docs = await Article.find(query)
    .select(
      '_id title summary content image category author publishedAt views isBreaking isTrending'
    )
    .sort({ publishedAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

  const normalized = docs
    .map((doc) => normalizeFeedArticle(doc))
    .filter((item): item is FeedArticle => Boolean(item));

  return buildPagedResponse(normalized, limit);
}

async function listFromFileStore(limit: number, cursor: Cursor | null) {
  const stored = await listAllStoredArticles();
  const normalized = stored
    .map((item) => normalizeFeedArticle(item))
    .filter((item): item is FeedArticle => Boolean(item))
    .sort(compareFeedArticles);

  const filtered = applyCursorFilter(normalized, cursor);
  const sliced = filtered.slice(0, limit + 1);
  return buildPagedResponse(sliced, limit);
}

export async function GET(req: NextRequest) {
  try {
    // Developer note:
    // First page: /api/articles/latest?limit=20
    // Next page: /api/articles/latest?limit=20&cursorPublishedAt=...&cursorId=...
    const { searchParams } = new URL(req.url);
    const limit = parseLimit(searchParams.get('limit'));
    const cursor = parseCursor(
      searchParams.get('cursorPublishedAt'),
      searchParams.get('cursorId')
    );

    if (await shouldUseFileStore()) {
      const payload = await listFromFileStore(limit, cursor);
      return NextResponse.json(payload);
    }

    const payload = await listFromMongo(limit, cursor);
    return NextResponse.json(payload);
  } catch (error) {
    console.error('Failed to load public latest feed:', error);
    return NextResponse.json(
      {
        items: [],
        limit: DEFAULT_LIMIT,
        hasMore: false,
        nextCursor: null,
      },
      { status: 500 }
    );
  }
}
