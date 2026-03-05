import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import Video from '@/lib/models/Video';
import { verifyAdminToken } from '@/lib/auth/adminToken';
import { NEWS_CATEGORIES } from '@/lib/constants/newsCategories';
import {
  createStoredVideo,
  listStoredVideos,
} from '@/lib/storage/videosFile';

const VIDEO_CATEGORIES = NEWS_CATEGORIES.map((category) => category.nameEn);
const FILE_STORE_UNBOUNDED_LIMIT = Number.MAX_SAFE_INTEGER;

function parsePositiveInt(value: string | null, fallback: number, max = 100) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function parseListLimit(value: string | null, fallback: number, max = 200) {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'all') return null;

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function parseBooleanParam(value: string | null): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function isValidCategory(value: string) {
  return VIDEO_CATEGORIES.includes(value);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getYouTubeId(value: string) {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.replace('www.', '').toLowerCase();

    if (host === 'youtu.be') return url.pathname.slice(1) || null;
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') return url.searchParams.get('v');
      if (url.pathname.startsWith('/shorts/')) return url.pathname.split('/')[2] || null;
      if (url.pathname.startsWith('/embed/')) return url.pathname.split('/')[2] || null;
    }

    return null;
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '';
}

function normalizeVideoInput(body: unknown) {
  const source = typeof body === 'object' && body ? (body as Record<string, unknown>) : {};

  const title = typeof source.title === 'string' ? source.title.trim() : '';
  const description = typeof source.description === 'string' ? source.description.trim() : '';
  const thumbnail = typeof source.thumbnail === 'string' ? source.thumbnail.trim() : '';
  const videoUrl = typeof source.videoUrl === 'string' ? source.videoUrl.trim() : '';
  const category = typeof source.category === 'string' ? source.category.trim() : '';
  const duration = Number.parseInt(String(source.duration ?? ''), 10);
  const shortsRank = Number.isFinite(Number(source.shortsRank))
    ? Number.parseInt(String(source.shortsRank), 10)
    : 0;
  const isShort = Boolean(source.isShort);
  const isPublished =
    typeof source.isPublished === 'boolean' ? source.isPublished : true;

  const publishedAt =
    typeof source.publishedAt === 'string' || source.publishedAt instanceof Date
      ? new Date(source.publishedAt)
      : new Date();

  return {
    title,
    description,
    thumbnail,
    videoUrl,
    category,
    duration,
    shortsRank: Number.isFinite(shortsRank) ? shortsRank : 0,
    isShort,
    isPublished,
    publishedAt: Number.isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
  };
}

async function shouldUseFileStore() {
  if (!process.env.MONGODB_URI) return true;

  try {
    await connectDB();
    return false;
  } catch (error) {
    console.error('MongoDB unavailable for videos route, using file store.', error);
    return true;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const user = verifyAdminToken(req);
    const isAdmin = Boolean(user);

    const category = searchParams.get('category');
    const type = searchParams.get('type'); // all | shorts | standard
    const search = (searchParams.get('search') || '').trim();
    const sort = searchParams.get('sort'); // latest | trending | shorts
    const publishedParam = parseBooleanParam(searchParams.get('published'));
    const effectivePublished =
      typeof publishedParam === 'boolean' ? publishedParam : isAdmin ? undefined : true;
    const limit = parseListLimit(searchParams.get('limit'), 20, 200);
    const page = parsePositiveInt(searchParams.get('page'), 1, 100000);
    const isUnbounded = limit === null;
    const effectivePage = isUnbounded ? 1 : page;
    const effectiveLimit = isUnbounded ? FILE_STORE_UNBOUNDED_LIMIT : limit;

    if (await shouldUseFileStore()) {
      const { data, total } = await listStoredVideos({
        category,
        type,
        published: effectivePublished,
        search,
        sort,
        limit: effectiveLimit,
        page: effectivePage,
      });

      return NextResponse.json({
        success: true,
        data,
        pagination: {
          total,
          page: effectivePage,
          limit: isUnbounded ? total : effectiveLimit,
          pages: isUnbounded ? 1 : Math.ceil(total / effectiveLimit),
        },
      });
    }

    const query: Record<string, unknown> = {};
    if (category && category !== 'all') {
      query.category = category;
    }

    if (type === 'shorts') {
      query.isShort = true;
    } else if (type === 'standard') {
      query.isShort = false;
    }

    if (typeof effectivePublished === 'boolean') {
      query.isPublished = effectivePublished;
    }

    if (search) {
      const safeSearch = escapeRegex(search);
      query.$or = [
        { title: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    let sortQuery: Record<string, 1 | -1> = { publishedAt: -1 };
    if (sort === 'trending') {
      sortQuery = { views: -1, publishedAt: -1 };
    } else if (sort === 'shorts' || type === 'shorts') {
      sortQuery = { shortsRank: -1, publishedAt: -1 };
    }

    const skip = (effectivePage - 1) * effectiveLimit;
    let videosQuery = Video.find(query).sort(sortQuery).skip(skip);
    if (!isUnbounded) {
      videosQuery = videosQuery.limit(effectiveLimit);
    }

    const videos = await videosQuery.lean();

    const total = await Video.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: videos,
      pagination: {
        total,
        page: effectivePage,
        limit: isUnbounded ? total : effectiveLimit,
        pages: isUnbounded ? 1 : Math.ceil(total / effectiveLimit),
      },
    });
  } catch (error) {
    console.error('Error fetching videos:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch videos' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = verifyAdminToken(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const input = normalizeVideoInput(body);

    if (!input.title || !input.description || !input.videoUrl || !input.category) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!isValidCategory(input.category)) {
      return NextResponse.json(
        { success: false, error: 'Invalid category' },
        { status: 400 }
      );
    }

    if (!Number.isFinite(input.duration) || input.duration < 1) {
      return NextResponse.json(
        { success: false, error: 'Invalid duration' },
        { status: 400 }
      );
    }

    const youtubeId = getYouTubeId(input.videoUrl);
    if (!youtubeId) {
      return NextResponse.json(
        { success: false, error: 'Video URL must be a valid YouTube URL' },
        { status: 400 }
      );
    }

    const resolvedThumbnail = input.thumbnail || `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;

    if (await shouldUseFileStore()) {
      const stored = await createStoredVideo({
        title: input.title,
        description: input.description,
        thumbnail: resolvedThumbnail,
        videoUrl: input.videoUrl,
        duration: input.duration,
        category: input.category,
        isShort: input.isShort,
        isPublished: input.isPublished,
        shortsRank: input.shortsRank,
        views: 0,
        publishedAt: input.publishedAt.toISOString(),
      });

      return NextResponse.json(
        {
          success: true,
          message: 'Video uploaded successfully',
          data: stored,
        },
        { status: 201 }
      );
    }

    const video = new Video({
      title: input.title,
      description: input.description,
      thumbnail: resolvedThumbnail,
      videoUrl: input.videoUrl,
      duration: input.duration,
      category: input.category,
      isShort: input.isShort,
      isPublished: input.isPublished,
      shortsRank: input.shortsRank,
      views: 0,
      publishedAt: input.publishedAt,
      updatedAt: new Date(),
    });

    const savedVideo = await video.save();

    return NextResponse.json(
      {
        success: true,
        message: 'Video uploaded successfully',
        data: savedVideo,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('Error creating video:', error);
    const message =
      process.env.NODE_ENV !== 'production'
        ? getErrorMessage(error) || 'Failed to create video'
        : 'Failed to create video';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
