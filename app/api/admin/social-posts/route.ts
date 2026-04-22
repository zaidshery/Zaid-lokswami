import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import SocialPost from '@/lib/models/SocialPost';
import { getAdminSession } from '@/lib/auth/admin';
import { isCopyEditorRole, isSuperAdminRole } from '@/lib/auth/roles';
import {
  normalizeSocialPlatform,
  normalizeSocialPostStatus,
} from '@/lib/content/newsroomPublishing';
import { getSocialAutomationPublicConfig } from '@/lib/server/socialAutomation';
import { listStoredSocialPosts } from '@/lib/storage/socialPostsFile';

function canReadSocialPosts(role: string | null | undefined) {
  return role === 'admin' || isSuperAdminRole(role) || isCopyEditorRole(role);
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

export async function GET(req: NextRequest) {
  try {
    const user = await getAdminSession();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!canReadSocialPosts(user.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const filters = {
      storyId: searchParams.get('storyId') || undefined,
      articleId: searchParams.get('articleId') || undefined,
      platform:
        searchParams.get('platform') && searchParams.get('platform') !== 'all'
          ? normalizeSocialPlatform(searchParams.get('platform'))
          : ('all' as const),
      status:
        searchParams.get('status') && searchParams.get('status') !== 'all'
          ? normalizeSocialPostStatus(searchParams.get('status'))
          : ('all' as const),
    };

    if (await shouldUseFileStore()) {
      const posts = await listStoredSocialPosts(filters);
      return NextResponse.json({
        success: true,
        data: posts,
        meta: {
          automation: getSocialAutomationPublicConfig(),
        },
      });
    }

    const query: Record<string, unknown> = {};
    if (filters.storyId) query.sourceStoryId = filters.storyId;
    if (filters.articleId) query.sourceArticleId = filters.articleId;
    if (filters.platform !== 'all') query.platform = filters.platform;
    if (filters.status !== 'all') query.status = filters.status;

    const posts = await SocialPost.find(query)
      .sort({ updatedAt: -1, _id: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: posts,
      meta: {
        automation: getSocialAutomationPublicConfig(),
      },
    });
  } catch (error) {
    console.error('Error fetching social posts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch social posts' },
      { status: 500 }
    );
  }
}
