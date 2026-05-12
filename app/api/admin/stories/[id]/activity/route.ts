import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import Story from '@/lib/models/Story';
import { getAdminSession } from '@/lib/auth/admin';
import { canReadContent } from '@/lib/auth/permissions';
import { listStoryActivity } from '@/lib/server/storyActivity';
import { getStoredStoryById } from '@/lib/storage/storiesFile';
import { resolveStoryWorkflow } from '@/lib/workflow/story';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type LeanStoryRecord = Record<string, unknown> & {
  author?: string;
  isPublished?: boolean;
  workflow?: Record<string, unknown> | null;
  publishedAt?: string | Date;
  updatedAt?: string | Date;
};

async function shouldUseFileStore() {
  if (!process.env.MONGODB_URI) return true;

  try {
    await connectDB();
    return false;
  } catch (error) {
    console.error('MongoDB unavailable for story activity route, using file store.', error);
    return true;
  }
}

function buildStoryPermissionRecord(story: {
  author?: unknown;
  isPublished?: unknown;
  workflow?: unknown;
  publishedAt?: unknown;
  updatedAt?: unknown;
}) {
  return {
    legacyAuthorName: typeof story.author === 'string' ? story.author : '',
    workflow: resolveStoryWorkflow({
      workflow:
        typeof story.workflow === 'object' && story.workflow
          ? (story.workflow as Record<string, unknown>)
          : null,
      isPublished: story.isPublished,
      publishedAt: story.publishedAt,
      updatedAt: story.updatedAt,
    }),
  };
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAdminSession();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    if (await shouldUseFileStore()) {
      const story = await getStoredStoryById(id);
      if (!story) {
        return NextResponse.json({ success: false, error: 'Story not found' }, { status: 404 });
      }

      if (!canReadContent(user, buildStoryPermissionRecord(story), { allowViewerRead: true })) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }

      const activity = await listStoryActivity({ storyId: id, story });
      return NextResponse.json({ success: true, data: activity });
    }

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'Invalid story ID' }, { status: 400 });
    }

    const story = (await Story.findById(id).lean()) as LeanStoryRecord | null;
    if (!story) {
      return NextResponse.json({ success: false, error: 'Story not found' }, { status: 404 });
    }

    if (!canReadContent(user, buildStoryPermissionRecord(story), { allowViewerRead: true })) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const activity = await listStoryActivity({ storyId: id, story });
    return NextResponse.json({ success: true, data: activity });
  } catch (error) {
    console.error('Error fetching story activity:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch story activity' },
      { status: 500 }
    );
  }
}
