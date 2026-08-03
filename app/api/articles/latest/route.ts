import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { publicJsonCacheHeaders } from '@/lib/api/cache';
import connectDB from '@/lib/db/mongoose';
import { isPubliclyPublishedArticle } from '@/lib/content/articlePublication';
import Article from '@/lib/models/Article';
import { listAllStoredArticles } from '@/lib/storage/articlesFile';
import { resolveArticleEditorialFlags } from '@/lib/content/articleEditorial';
import { WORKFLOW_STATUSES } from '@/lib/workflow/types';

const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 5;
const MAX_LIMIT = 200;

type FeedArticle = {
  _id: string;
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  image: string;
  category: string;
  author: string;
  authorMeta?: {
    name?: string;
    avatar?: string;
    programName?: string;
  };
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

function normalizeAuthorMeta(input: Record<string, unknown>) {
  const seo =
    typeof input.seo === 'object' && input.seo
      ? (input.seo as Record<string, unknown>)
      : null;
  if (!seo) return undefined;

  const hasFields =
    seo.authorDisplayNameSet === true ||
    Boolean(seo.authorDisplayName || seo.authorAvatarUrl || seo.authorProgramName);
  if (!hasFields) return undefined;

  return {
    name: typeof seo.authorDisplayName === 'string' ? seo.authorDisplayName.trim() : '',
    avatar: typeof seo.authorAvatarUrl === 'string' ? seo.authorAvatarUrl.trim() : '',
    programName: typeof seo.authorProgramName === 'string' ? seo.authorProgramName.trim() : '',
  };
}

function normalizeFeedArticle(source: unknown): FeedArticle | null {
  const input =
    typeof source === 'object' && source ? (source as Record<string, unknown>) : null;
  if (!input) return null;

  const id = String(input._id || '').trim() || String(input.id || '').trim();
  const slug = String(input.slug || '').trim();
  const title = String(input.title || '').trim();
  const summary = String(input.summary || '').trim();
  const content = String(input.content || '').trim();
  const image = String(input.image || '').trim();
  const category = String(input.category || '').trim();
  const author = String(input.author || '').trim();
  const publishedAt = normalizeDate(input.publishedAt);
  const viewsRaw =
    typeof input.views === 'number' ? input.views : Number(input.views || 0);
  const activeFlags = resolveArticleEditorialFlags(input);

  if (!id || !title || !summary || !image) {
    return null;
  }

  const authorMeta = normalizeAuthorMeta(input);

  return {
    _id: id,
    id,
    slug,
    title,
    summary,
    content,
    image,
    category: category || 'General',
    author: author || 'Editor',
    ...(authorMeta ? { authorMeta } : {}),
    publishedAt,
    views: Number.isFinite(viewsRaw) ? viewsRaw : 0,
    isBreaking: activeFlags.isBreaking,
    isTrending: activeFlags.isTrending,
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

function buildMongoPublicationFilter() {
  return {
    $or: [
      { 'workflow.status': 'published' },
      {
        $and: [
          // Articles created before workflow metadata was introduced are
          // public when they have a publication/update timestamp. Invalid
          // legacy status values follow the same fallback in
          // isPubliclyPublishedArticle.
          { 'workflow.status': { $nin: [...WORKFLOW_STATUSES] } },
          {
            $or: [
              { publishedAt: { $exists: true, $ne: null } },
              { updatedAt: { $exists: true, $ne: null } },
            ],
          },
        ],
      },
    ],
  };
}

function buildMongoCursorFilter(cursor: Cursor | null) {
  if (!cursor) return null;

  const equalDateIdFilter = Types.ObjectId.isValid(cursor.id)
    ? { _id: { $lt: new Types.ObjectId(cursor.id) } }
    : {
        $expr: {
          $lt: [{ $toString: '$_id' }, cursor.id],
        },
      };

  return {
    $or: [
      { publishedAt: { $lt: cursor.date } },
      {
        $and: [{ publishedAt: cursor.date }, equalDateIdFilter],
      },
    ],
  };
}

function buildMongoFeedFilter(cursor: Cursor | null) {
  const filters: Record<string, unknown>[] = [
    buildMongoPublicationFilter(),
    { title: { $type: 'string', $regex: /\S/ } },
    { summary: { $type: 'string', $regex: /\S/ } },
    { image: { $type: 'string', $regex: /\S/ } },
  ];
  const cursorFilter = buildMongoCursorFilter(cursor);
  if (cursorFilter) filters.push(cursorFilter);

  return { $and: filters };
}

async function listFromMongo(limit: number, cursor: Cursor | null) {
  const docs = await Article.find(buildMongoFeedFilter(cursor))
    .select(
      // Feed cards do not consume the article body. normalizeFeedArticle keeps
      // the legacy `content` response key (as an empty string) so older clients
      // retain the same payload shape without loading full documents.
      '_id slug title summary image category author publishedAt updatedAt views isBreaking isTrending editorial workflow'
    )
    .sort({ publishedAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

  const normalized = docs
    .filter((doc) => isPubliclyPublishedArticle(doc))
    .map((doc) => normalizeFeedArticle(doc))
    .filter((item): item is FeedArticle => Boolean(item))
    .sort(compareFeedArticles);

  return buildPagedResponse(normalized, limit);
}

async function listFromFileStore(limit: number, cursor: Cursor | null) {
  const stored = await listAllStoredArticles();
  const normalized = stored
    .filter((item) => isPubliclyPublishedArticle(item))
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
      return NextResponse.json(payload, {
        headers: publicJsonCacheHeaders({ sMaxAge: 120, staleWhileRevalidate: 600 }),
      });
    }

    const payload = await listFromMongo(limit, cursor);
    return NextResponse.json(payload, {
      headers: publicJsonCacheHeaders({ sMaxAge: 120, staleWhileRevalidate: 600 }),
    });
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
