import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import SocialPost from '@/lib/models/SocialPost';
import { getAdminSession } from '@/lib/auth/admin';
import { isSuperAdminRole } from '@/lib/auth/roles';
import {
  normalizeSocialPlatform,
  normalizeSocialPostStatus,
} from '@/lib/content/newsroomPublishing';
import {
  getStoredSocialPostById,
  updateStoredSocialPost,
} from '@/lib/storage/socialPostsFile';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function canManageSocialPosts(role: string | null | undefined) {
  return role === 'admin' || isSuperAdminRole(role);
}

async function shouldUseFileStore() {
  if (!process.env.MONGODB_URI) return true;

  try {
    await connectDB();
    return false;
  } catch {
    return true;
  }
}

function normalizeOptionalDateString(value: unknown) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeUpdates(body: unknown) {
  const source = typeof body === 'object' && body ? (body as Record<string, unknown>) : {};
  const updates: Record<string, unknown> = {};

  if (typeof source.caption === 'string') updates.caption = source.caption.trim();
  if (typeof source.hashtags === 'string') updates.hashtags = source.hashtags.trim();
  if (typeof source.thumbnailUrl === 'string') {
    updates.thumbnailUrl = source.thumbnailUrl.trim();
  }
  if (typeof source.videoUrl === 'string') updates.videoUrl = source.videoUrl.trim();
  if (typeof source.externalPostId === 'string') {
    updates.externalPostId = source.externalPostId.trim();
  }
  if (typeof source.externalUrl === 'string') updates.externalUrl = source.externalUrl.trim();
  if (typeof source.lastError === 'string') updates.lastError = source.lastError.trim();
  if (source.platform !== undefined) updates.platform = normalizeSocialPlatform(source.platform);
  if (source.status !== undefined) updates.status = normalizeSocialPostStatus(source.status);
  if (source.scheduledAt !== undefined) {
    updates.scheduledAt = normalizeOptionalDateString(source.scheduledAt);
  }
  if (source.publishedAt !== undefined) {
    updates.publishedAt = normalizeOptionalDateString(source.publishedAt);
  }

  return updates;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getAdminSession();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!canManageSocialPosts(user.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const updates = normalizeUpdates(await req.json());
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid updates provided' },
        { status: 400 }
      );
    }

    if (await shouldUseFileStore()) {
      const existing = await getStoredSocialPostById(id);
      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Social post not found' },
          { status: 404 }
        );
      }
      const updated = await updateStoredSocialPost(id, updates);
      return NextResponse.json({ success: true, data: updated || existing });
    }

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid social post ID' },
        { status: 400 }
      );
    }

    const updated = await SocialPost.findByIdAndUpdate(
      id,
      {
        $set: {
          ...updates,
          updatedAt: new Date(),
        },
      },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Social post not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating social post:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update social post' },
      { status: 500 }
    );
  }
}
