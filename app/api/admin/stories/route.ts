import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import Story from '@/lib/models/Story';
import { verifyAdminToken } from '@/lib/auth/adminToken';
import {
  createStoredStory,
  listStoredStories,
} from '@/lib/storage/storiesFile';
const FILE_STORE_UNBOUNDED_LIMIT = Number.MAX_SAFE_INTEGER;

function parsePositiveInt(value: string | null, fallback: number, max = 200) {
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

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toBoundedDuration(value: unknown, fallback = 6) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(2, Math.min(180, parsed));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '';
}

function normalizeStoryInput(body: unknown) {
  const source = typeof body === 'object' && body ? (body as Record<string, unknown>) : {};

  const title = typeof source.title === 'string' ? source.title.trim() : '';
  const caption = typeof source.caption === 'string' ? source.caption.trim() : '';
  const thumbnail = typeof source.thumbnail === 'string' ? source.thumbnail.trim() : '';
  const mediaType: 'image' | 'video' =
    source.mediaType === 'video' ? 'video' : 'image';
  const mediaUrl = typeof source.mediaUrl === 'string' ? source.mediaUrl.trim() : '';
  const linkUrl = typeof source.linkUrl === 'string' ? source.linkUrl.trim() : '';
  const linkLabel = typeof source.linkLabel === 'string' ? source.linkLabel.trim() : '';
  const category = typeof source.category === 'string' ? source.category.trim() : 'General';
  const author = typeof source.author === 'string' ? source.author.trim() : 'Desk';
  const priority = Number.parseInt(String(source.priority ?? 0), 10);
  const views = Number.parseInt(String(source.views ?? 0), 10);
  const durationSeconds = toBoundedDuration(source.durationSeconds, 6);
  const isPublished =
    typeof source.isPublished === 'boolean' ? source.isPublished : true;

  const publishedAt =
    typeof source.publishedAt === 'string' || source.publishedAt instanceof Date
      ? new Date(source.publishedAt)
      : new Date();

  return {
    title,
    caption,
    thumbnail,
    mediaType,
    mediaUrl,
    linkUrl,
    linkLabel,
    category: category || 'General',
    author: author || 'Desk',
    priority: Number.isFinite(priority) ? priority : 0,
    views: Number.isFinite(views) ? Math.max(0, views) : 0,
    durationSeconds,
    isPublished,
    publishedAt: Number.isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
  };
}

function validateStoryInput(input: ReturnType<typeof normalizeStoryInput>) {
  if (!input.title || !input.thumbnail) {
    return 'Title and thumbnail are required';
  }

  if (input.title.length > 140) {
    return 'Title is too long (max 140 characters)';
  }

  if (input.caption.length > 300) {
    return 'Caption is too long (max 300 characters)';
  }

  if (input.mediaType === 'video' && !input.mediaUrl) {
    return 'Media URL is required for video stories';
  }

  if (input.linkUrl.length > 500) {
    return 'Link URL is too long';
  }

  return null;
}

async function shouldUseFileStore() {
  if (!process.env.MONGODB_URI) return true;

  try {
    await connectDB();
    return false;
  } catch (error) {
    console.error('MongoDB unavailable for stories route, using file store.', error);
    return true;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const user = verifyAdminToken(req);
    const isAdmin = Boolean(user);

    const category = searchParams.get('category');
    const search = (searchParams.get('search') || '').trim();
    const sort = searchParams.get('sort'); // latest | priority | trending
    const publishedParam = parseBooleanParam(searchParams.get('published'));
    const effectivePublished =
      typeof publishedParam === 'boolean' ? publishedParam : isAdmin ? undefined : true;
    const limit = parseListLimit(searchParams.get('limit'), 20, 200);
    const page = parsePositiveInt(searchParams.get('page'), 1, 100000);
    const isUnbounded = limit === null;
    const effectivePage = isUnbounded ? 1 : page;
    const effectiveLimit = isUnbounded ? FILE_STORE_UNBOUNDED_LIMIT : limit;

    if (await shouldUseFileStore()) {
      const { data, total } = await listStoredStories({
        category,
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

    if (typeof effectivePublished === 'boolean') {
      query.isPublished = effectivePublished;
    }

    if (search) {
      const safeSearch = escapeRegex(search);
      query.$or = [
        { title: { $regex: safeSearch, $options: 'i' } },
        { caption: { $regex: safeSearch, $options: 'i' } },
        { category: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    let sortQuery: Record<string, 1 | -1> = { publishedAt: -1 };
    if (sort === 'priority') {
      sortQuery = { priority: -1, publishedAt: -1 };
    } else if (sort === 'trending') {
      sortQuery = { views: -1, publishedAt: -1 };
    }

    const skip = (effectivePage - 1) * effectiveLimit;
    let storiesQuery = Story.find(query).sort(sortQuery).skip(skip);
    if (!isUnbounded) {
      storiesQuery = storiesQuery.limit(effectiveLimit);
    }
    const stories = await storiesQuery.lean();
    const total = await Story.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: stories,
      pagination: {
        total,
        page: effectivePage,
        limit: isUnbounded ? total : effectiveLimit,
        pages: isUnbounded ? 1 : Math.ceil(total / effectiveLimit),
      },
    });
  } catch (error) {
    console.error('Error fetching stories:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stories' },
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
    const input = normalizeStoryInput(body);
    const validationError = validateStoryInput(input);

    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 }
      );
    }

    if (await shouldUseFileStore()) {
      const stored = await createStoredStory({
        ...input,
        publishedAt: input.publishedAt.toISOString(),
      });
      return NextResponse.json(
        { success: true, data: stored, message: 'Story created successfully' },
        { status: 201 }
      );
    }

    const story = new Story({
      ...input,
      updatedAt: new Date(),
    });
    const saved = await story.save();

    return NextResponse.json(
      { success: true, data: saved, message: 'Story created successfully' },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('Error creating story:', error);
    const message =
      process.env.NODE_ENV !== 'production'
        ? getErrorMessage(error) || 'Failed to create story'
        : 'Failed to create story';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
