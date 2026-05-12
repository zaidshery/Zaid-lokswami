import { NextRequest, NextResponse } from 'next/server';
import { publicJsonCacheHeaders } from '@/lib/api/cache';
import connectDB from '@/lib/db/mongoose';
import { normalizeStoryMediaAssets } from '@/lib/content/storyMedia';
import Story from '@/lib/models/Story';
import { listAllStoredStories } from '@/lib/storage/storiesFile';

const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 5;
const MAX_LIMIT = 100;
const STORIES_CACHE_HEADERS = publicJsonCacheHeaders({
  sMaxAge: 60,
  staleWhileRevalidate: 300,
});

type PublicStoryItem = {
  _id: string;
  title: string;
  caption: string;
  thumbnail: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  linkUrl: string;
  linkLabel: string;
  category: string;
  author: string;
  durationSeconds: number;
  priority: number;
  views: number;
  publishedAt: string;
  isPublished: boolean;
  mediaAssets: ReturnType<typeof normalizeStoryMediaAssets>;
};

function parseLimit(raw: string | null) {
  const parsed = Number.parseInt(raw || '', 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, parsed));
}

function asObject(value: unknown) {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function toIsoDate(value: unknown) {
  const parsed = new Date(
    value instanceof Date || typeof value === 'string' || typeof value === 'number'
      ? value
      : Date.now()
  );
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapStoryItem(input: Record<string, unknown>): PublicStoryItem | null {
  const id =
    typeof input._id === 'string'
      ? input._id
      : input._id
        ? String(input._id)
        : typeof input.id === 'string'
          ? input.id
          : '';
  const title = String(input.title || '').trim();
  const thumbnail = String(input.thumbnail || '').trim();

  if (!id || !title || !thumbnail) return null;

  return {
    _id: id,
    title,
    caption: String(input.caption || '').trim(),
    thumbnail,
    mediaType: input.mediaType === 'video' ? 'video' : 'image',
    mediaUrl: String(input.mediaUrl || '').trim(),
    linkUrl: String(input.linkUrl || '').trim(),
    linkLabel: String(input.linkLabel || '').trim(),
    category: String(input.category || 'General').trim() || 'General',
    author: String(input.author || 'Desk').trim() || 'Desk',
    durationSeconds: Math.max(2, Math.min(180, Math.floor(toFiniteNumber(input.durationSeconds, 6)))),
    priority: Math.floor(toFiniteNumber(input.priority, 0)),
    views: Math.max(0, Math.floor(toFiniteNumber(input.views, 0))),
    publishedAt: toIsoDate(input.publishedAt),
    isPublished: input.isPublished === false ? false : true,
    mediaAssets: normalizeStoryMediaAssets(input.mediaAssets),
  };
}

function compareStories(a: PublicStoryItem, b: PublicStoryItem) {
  const byPriority = b.priority - a.priority;
  if (byPriority !== 0) return byPriority;

  const byDate = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  if (byDate !== 0) return byDate;

  return b._id.localeCompare(a._id);
}

async function shouldUseFileStore() {
  if (!process.env.MONGODB_URI) return true;

  try {
    await connectDB();
    return false;
  } catch (error) {
    console.error('MongoDB unavailable for public stories latest route, using file store.', error);
    return true;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseLimit(searchParams.get('limit'));

    if (await shouldUseFileStore()) {
      const rows = await listAllStoredStories();
      const items = rows
        .map((row) => mapStoryItem(asObject(row)))
        .filter(
          (item): item is PublicStoryItem =>
            item !== null && item.isPublished
        )
        .sort(compareStories)
        .slice(0, limit);

      return NextResponse.json({ items, limit }, { headers: STORIES_CACHE_HEADERS });
    }

    const docs = await Story.find({ isPublished: true })
      .select(
        '_id title caption thumbnail mediaType mediaUrl linkUrl linkLabel category author durationSeconds priority views publishedAt isPublished mediaAssets'
      )
      .sort({ priority: -1, publishedAt: -1, _id: -1 })
      .limit(limit)
      .lean();

    const items = docs
      .map((doc) => mapStoryItem(asObject(doc)))
      .filter((item): item is PublicStoryItem => Boolean(item));

    return NextResponse.json({ items, limit }, { headers: STORIES_CACHE_HEADERS });
  } catch (error) {
    console.error('Failed to fetch public stories latest feed:', error);
    return NextResponse.json({ items: [], limit: DEFAULT_LIMIT }, { status: 500 });
  }
}
