import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import Video from '@/lib/models/Video';
import { listAllStoredVideos } from '@/lib/storage/videosFile';
import { cursorPage } from '@/lib/utils/cursorPage';

type PublicShortItem = {
  _id: string;
  title: string;
  description: string;
  thumbnail: string;
  videoUrl: string;
  duration: number;
  category: string;
  isShort: boolean;
  isPublished: boolean;
  shortsRank: number;
  views: number;
  createdAt: string;
  publishedAt: string;
  updatedAt: string;
};

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

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapShortItem(input: Record<string, unknown>): PublicShortItem | null {
  const id =
    typeof input._id === 'string'
      ? input._id
      : input._id
        ? String(input._id)
        : typeof input.id === 'string'
          ? input.id
          : '';
  const title = String(input.title || '').trim();
  const category = String(input.category || '').trim();

  if (!id || !title || !category) return null;

  // Shorts cursor uses createdAt; when absent we map from publishedAt.
  const publishedAt = toIsoDate(input.publishedAt);
  const createdAt = toIsoDate(input.createdAt || publishedAt);

  return {
    _id: id,
    title,
    description: String(input.description || ''),
    thumbnail: String(input.thumbnail || ''),
    videoUrl: String(input.videoUrl || ''),
    duration: Math.max(1, Math.floor(toNumber(input.duration, 1))),
    category,
    isShort: true,
    isPublished: input.isPublished === false ? false : true,
    shortsRank: Math.floor(toNumber(input.shortsRank, 0)),
    views: Math.max(0, Math.floor(toNumber(input.views, 0))),
    createdAt,
    publishedAt,
    updatedAt: toIsoDate(input.updatedAt || publishedAt),
  };
}

async function shouldUseFileStore() {
  if (!process.env.MONGODB_URI) return true;

  try {
    await connectDB();
    return false;
  } catch (error) {
    console.error('MongoDB unavailable for public shorts latest route, using file store.', error);
    return true;
  }
}

export async function GET(req: NextRequest) {
  try {
    // Developer note:
    // First: /api/shorts/latest?limit=20
    // Next:  /api/shorts/latest?limit=20&cursorPublishedAt=...&cursorId=...
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get('limit');
    const cursorPublishedAt = searchParams.get('cursorPublishedAt');
    const cursorId = searchParams.get('cursorId');

    if (await shouldUseFileStore()) {
      const rows = await listAllStoredVideos();
      const result = await cursorPage<PublicShortItem>({
        arrayItems: rows.filter(
          (item) => item.isPublished !== false && Boolean(item.isShort)
        ),
        limit,
        dateField: 'createdAt',
        fallbackDateFields: ['publishedAt'],
        cursorPublishedAt,
        cursorId,
        mapItem: (raw) => mapShortItem(asObject(raw)),
      });
      return NextResponse.json(result);
    }

    const result = await cursorPage<PublicShortItem>({
      model: Video,
      mongoFilter: { isPublished: true, isShort: true },
      mongoProjection:
        '_id title description thumbnail videoUrl duration category isShort isPublished shortsRank views createdAt publishedAt updatedAt',
      limit,
      dateField: 'createdAt',
      fallbackDateFields: ['publishedAt'],
      cursorPublishedAt,
      cursorId,
      mapItem: (raw) => mapShortItem(asObject(raw)),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch public shorts latest feed:', error);
    return NextResponse.json(
      { items: [], limit: 20, hasMore: false, nextCursor: null },
      { status: 500 }
    );
  }
}
