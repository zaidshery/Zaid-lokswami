import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import Article from '@/lib/models/Article';
import SocialPost from '@/lib/models/SocialPost';
import Story from '@/lib/models/Story';
import { getAdminSession } from '@/lib/auth/admin';
import { isSuperAdminRole } from '@/lib/auth/roles';
import { getStoredArticleById } from '@/lib/storage/articlesFile';
import { getStoredStoryById } from '@/lib/storage/storiesFile';
import { upsertStoredSocialPostByStoryAndPlatform } from '@/lib/storage/socialPostsFile';
import { buildSocialDraftSeed, canGenerateSocialDrafts } from '@/lib/server/socialPostDrafts';

type StoryDraftSource = {
  _id?: unknown;
  title?: unknown;
  category?: unknown;
  author?: unknown;
  thumbnail?: unknown;
  linkedArticleId?: unknown;
  videoProduction?: unknown;
};

type ArticleDraftSource = {
  _id?: unknown;
  title?: unknown;
  summary?: unknown;
  sourceStoryId?: unknown;
};

function canGenerate(role: string | null | undefined) {
  return role === 'admin' || isSuperAdminRole(role);
}

function asStoryDraftSource(value: unknown): StoryDraftSource | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return null;
  }

  return value as StoryDraftSource;
}

function asArticleDraftSource(value: unknown): ArticleDraftSource | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return null;
  }

  return value as ArticleDraftSource;
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

export async function POST(req: NextRequest) {
  try {
    const user = await getAdminSession();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!canGenerate(user.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { storyId?: string };
    const storyId = typeof body.storyId === 'string' ? body.storyId.trim() : '';
    if (!storyId) {
      return NextResponse.json(
        { success: false, error: 'storyId is required' },
        { status: 400 }
      );
    }

    const useFileStore = await shouldUseFileStore();
    const story = asStoryDraftSource(
      useFileStore
      ? await getStoredStoryById(storyId)
      : !Types.ObjectId.isValid(storyId)
        ? null
        : await Story.findById(storyId).lean()
    );

    const articleId =
      story && typeof story.linkedArticleId === 'string'
        ? story.linkedArticleId.trim()
        : '';
    const article = asArticleDraftSource(
      articleId
        ? useFileStore
          ? await getStoredArticleById(articleId)
          : !Types.ObjectId.isValid(articleId)
            ? null
            : await Article.findById(articleId).lean()
        : null
    );

    const generationError = canGenerateSocialDrafts({
      story: story
        ? {
            _id: typeof story._id === 'string' ? story._id : String(story._id || ''),
            title: typeof story.title === 'string' ? story.title : '',
            category: typeof story.category === 'string' ? story.category : '',
            author: typeof story.author === 'string' ? story.author : '',
            thumbnail: typeof story.thumbnail === 'string' ? story.thumbnail : '',
            linkedArticleId: articleId,
            videoProduction:
              typeof story.videoProduction === 'object' && story.videoProduction
                ? (story.videoProduction as NonNullable<
                    Parameters<typeof canGenerateSocialDrafts>[0]['story']
                  >['videoProduction'])
                : undefined,
          }
        : null,
      article: article
        ? {
            _id: typeof article._id === 'string' ? article._id : String(article._id || ''),
            title: typeof article.title === 'string' ? article.title : '',
            summary: typeof article.summary === 'string' ? article.summary : '',
            sourceStoryId:
              typeof article.sourceStoryId === 'string' ? article.sourceStoryId : '',
          }
        : null,
    });

    if (generationError) {
      return NextResponse.json({ success: false, error: generationError }, { status: 400 });
    }

    const seedRecords = buildSocialDraftSeed({
      story: {
        _id: typeof story!._id === 'string' ? story!._id : String(story!._id || ''),
        title: typeof story!.title === 'string' ? story!.title : '',
        category: typeof story!.category === 'string' ? story!.category : '',
        author: typeof story!.author === 'string' ? story!.author : '',
        thumbnail: typeof story!.thumbnail === 'string' ? story!.thumbnail : '',
        linkedArticleId: articleId,
        videoProduction: story!.videoProduction as NonNullable<
          Parameters<typeof buildSocialDraftSeed>[0]['story']['videoProduction']
        >,
      },
      article: {
        _id: typeof article!._id === 'string' ? article!._id : String(article!._id || ''),
        title: typeof article!.title === 'string' ? article!.title : '',
        summary: typeof article!.summary === 'string' ? article!.summary : '',
        sourceStoryId:
          typeof article!.sourceStoryId === 'string' ? article!.sourceStoryId : '',
      },
      actor: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    if (useFileStore) {
      const records = await Promise.all(
        seedRecords.map((seed) =>
          upsertStoredSocialPostByStoryAndPlatform(seed.sourceStoryId, seed.platform, seed)
        )
      );

      return NextResponse.json({ success: true, data: records });
    }

    const records = await Promise.all(
      seedRecords.map((seed) =>
        SocialPost.findOneAndUpdate(
          {
            sourceStoryId: seed.sourceStoryId,
            platform: seed.platform,
          },
          {
            $set: {
              sourceArticleId: seed.sourceArticleId,
              status: seed.status,
              caption: seed.caption,
              hashtags: seed.hashtags,
              thumbnailUrl: seed.thumbnailUrl,
              videoUrl: seed.videoUrl,
              lastError: '',
              updatedAt: new Date(),
            },
            $setOnInsert: {
              createdAt: new Date(),
              createdBy: seed.createdBy,
            },
          },
          { upsert: true, new: true, runValidators: true }
        ).lean()
      )
    );

    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    console.error('Error generating social drafts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate social drafts' },
      { status: 500 }
    );
  }
}
