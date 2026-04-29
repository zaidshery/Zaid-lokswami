import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import SocialPost from '@/lib/models/SocialPost';
import { getAdminSession } from '@/lib/auth/admin';
import { isSuperAdminRole } from '@/lib/auth/roles';
import {
  getStoredSocialPostById,
  updateStoredSocialPost,
} from '@/lib/storage/socialPostsFile';
import {
  dispatchSocialPostToAutomation,
  getSocialAutomationConfig,
  getSocialAutomationPublicConfig,
} from '@/lib/server/socialAutomation';

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

function normalizeDispatchPost(value: unknown) {
  const source =
    typeof value === 'object' && value ? (value as Record<string, unknown>) : null;
  if (!source) return null;

  const sourceStoryId =
    typeof source.sourceStoryId === 'string' ? source.sourceStoryId.trim() : '';
  const platform = typeof source.platform === 'string' ? source.platform.trim() : '';
  const videoUrl = typeof source.videoUrl === 'string' ? source.videoUrl.trim() : '';
  if (!sourceStoryId || !platform || !videoUrl) return null;

  return {
    _id: typeof source._id === 'string' ? source._id.trim() : String(source._id || '').trim(),
    sourceStoryId,
    sourceArticleId:
      typeof source.sourceArticleId === 'string' ? source.sourceArticleId.trim() : '',
    platform: platform as 'youtube' | 'facebook' | 'instagram',
    status: typeof source.status === 'string' ? source.status.trim() : 'draft',
    caption: typeof source.caption === 'string' ? source.caption.trim() : '',
    hashtags: typeof source.hashtags === 'string' ? source.hashtags.trim() : '',
    thumbnailUrl:
      typeof source.thumbnailUrl === 'string' ? source.thumbnailUrl.trim() : '',
    videoUrl,
    scheduledAt:
      typeof source.scheduledAt === 'string' ? source.scheduledAt : null,
  };
}

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getAdminSession();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!canManageSocialPosts(user.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const automationConfig = getSocialAutomationConfig();
    if (!automationConfig.enabled) {
      return NextResponse.json(
        {
          success: false,
          error:
            automationConfig.provider === 'manual'
              ? 'Automation is currently in manual mode. Configure n8n or a generic webhook first.'
              : 'Automation webhook is not configured.',
        },
        { status: 400 }
      );
    }

    const useFileStore = await shouldUseFileStore();
    const record = normalizeDispatchPost(
      useFileStore
        ? await getStoredSocialPostById(id)
        : !Types.ObjectId.isValid(id)
          ? null
          : await SocialPost.findById(id).lean()
    );

    if (!record) {
      return NextResponse.json({ success: false, error: 'Social post not found' }, { status: 404 });
    }

    if (record.status !== 'approved' && record.status !== 'scheduled' && record.status !== 'failed') {
      return NextResponse.json(
        {
          success: false,
          error: 'Approve or schedule the social post before sending it to automation.',
        },
        { status: 400 }
      );
    }

    const actor = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    try {
      const dispatch = await dispatchSocialPostToAutomation({
        post: record,
        actor,
      });
      const updates = {
        status: 'publishing' as const,
        lastError: '',
        automationProvider: dispatch.provider,
        automationDispatchedAt: new Date().toISOString(),
        automationExecutionId: dispatch.executionId,
        automationExecutionUrl: dispatch.executionUrl,
        ...(dispatch.externalUrl ? { externalUrl: dispatch.externalUrl } : {}),
      };

      if (useFileStore) {
        const updated = await updateStoredSocialPost(id, updates);
        return NextResponse.json({
          success: true,
          data: updated,
          meta: {
            automation: getSocialAutomationPublicConfig(),
          },
        });
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

      return NextResponse.json({
        success: true,
        data: updated,
        meta: {
          automation: getSocialAutomationPublicConfig(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Automation dispatch failed';
      const failureUpdates = {
        status: 'failed' as const,
        lastError: message,
        automationProvider: automationConfig.provider,
      };

      if (useFileStore) {
        const updated = await updateStoredSocialPost(id, failureUpdates);
        return NextResponse.json(
          { success: false, error: message, data: updated },
          { status: 502 }
        );
      }

      const updated = await SocialPost.findByIdAndUpdate(
        id,
        {
          $set: {
            ...failureUpdates,
            updatedAt: new Date(),
          },
        },
        { new: true, runValidators: true }
      ).lean();

      return NextResponse.json(
        { success: false, error: message, data: updated },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error('Error dispatching social post:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to dispatch social post' },
      { status: 500 }
    );
  }
}
