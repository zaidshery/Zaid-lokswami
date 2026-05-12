import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import Video from '@/lib/models/Video';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import { canReadContent } from '@/lib/auth/permissions';
import { listVideoActivity } from '@/lib/server/videoActivity';
import { getStoredVideoById } from '@/lib/storage/videosFile';
import { resolveVideoWorkflow } from '@/lib/workflow/video';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type LeanVideoRecord = Record<string, unknown> & {
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
    console.error('MongoDB unavailable for video activity route, using file store.', error);
    return true;
  }
}

function buildVideoPermissionRecord(video: {
  isPublished?: unknown;
  workflow?: unknown;
  publishedAt?: unknown;
  updatedAt?: unknown;
}) {
  return {
    workflow: resolveVideoWorkflow({
      workflow:
        typeof video.workflow === 'object' && video.workflow
          ? (video.workflow as Record<string, unknown>)
          : null,
      isPublished: video.isPublished,
      publishedAt: video.publishedAt,
      updatedAt: video.updatedAt,
    }),
  };
}

export async function GET(_req: Request, context: RouteContext) {
  try {
    const user = await getAdminSessionFromReq(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    if (await shouldUseFileStore()) {
      const video = await getStoredVideoById(id);
      if (!video) {
        return NextResponse.json({ success: false, error: 'Video not found' }, { status: 404 });
      }

      if (!canReadContent(user, buildVideoPermissionRecord(video), { allowViewerRead: true })) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }

      const activity = await listVideoActivity({ videoId: id, video });
      return NextResponse.json({ success: true, data: activity });
    }

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'Invalid video ID' }, { status: 400 });
    }

    const video = (await Video.findById(id).lean()) as LeanVideoRecord | null;
    if (!video) {
      return NextResponse.json({ success: false, error: 'Video not found' }, { status: 404 });
    }

    if (!canReadContent(user, buildVideoPermissionRecord(video), { allowViewerRead: true })) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const activity = await listVideoActivity({ videoId: id, video });
    return NextResponse.json({ success: true, data: activity });
  } catch (error) {
    console.error('Error fetching video activity:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch video activity' },
      { status: 500 }
    );
  }
}
