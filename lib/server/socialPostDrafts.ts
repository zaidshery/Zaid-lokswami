import type { AdminRole } from '@/lib/auth/roles';
import {
  SOCIAL_PLATFORMS,
  type SocialPlatform,
  type SocialPostStatus,
  type StoryVideoProduction,
} from '@/lib/content/newsroomPublishing';

type MinimalStory = {
  _id: string;
  title: string;
  category?: string;
  author?: string;
  thumbnail?: string;
  linkedArticleId?: string;
  videoProduction?: StoryVideoProduction;
};

type MinimalArticle = {
  _id: string;
  title: string;
  summary?: string;
  sourceStoryId?: string;
};

export function buildSocialDraftCaption(input: {
  story: MinimalStory;
  article: MinimalArticle | null;
  platform: SocialPlatform;
}) {
  const headline = input.article?.title?.trim() || input.story.title.trim();
  const summary = input.article?.summary?.trim() || '';
  if (input.platform === 'youtube') {
    return [headline, summary].filter(Boolean).join('\n\n');
  }
  return [headline, summary].filter(Boolean).join(' - ');
}

export function buildSocialDraftHashtags(category: string | undefined) {
  const cleanedCategory = (category || '').trim().replace(/\s+/g, '');
  return ['#Lokswami', cleanedCategory ? `#${cleanedCategory}` : '', '#News']
    .filter(Boolean)
    .join(' ');
}

export function canGenerateSocialDrafts(params: {
  story: MinimalStory | null;
  article: MinimalArticle | null;
}) {
  if (!params.story) return 'Source story not found';
  if (!params.story.linkedArticleId) {
    return 'Create the primary article before generating social drafts.';
  }
  if (!params.article) {
    return 'Linked article not found.';
  }

  const videoProduction = params.story.videoProduction;
  if (!videoProduction || !videoProduction.masterExportUrl.trim()) {
    return 'Upload the final edited video export before generating social drafts.';
  }

  if (
    videoProduction.status !== 'ready_to_publish' &&
    videoProduction.status !== 'published'
  ) {
    return 'Video production must be ready to publish before generating social drafts.';
  }

  return null;
}

export function buildSocialDraftSeed(params: {
  story: MinimalStory;
  article: MinimalArticle;
  actor: {
    id: string;
    name: string;
    email: string;
    role: AdminRole;
  };
}) {
  const videoProduction = params.story.videoProduction!;
  return SOCIAL_PLATFORMS.map((platform) => ({
    sourceStoryId: params.story._id,
    sourceArticleId: params.article._id,
    platform,
    status: 'draft' as SocialPostStatus,
    caption: buildSocialDraftCaption({
      story: params.story,
      article: params.article,
      platform,
    }),
    hashtags: buildSocialDraftHashtags(params.story.category),
    thumbnailUrl:
      videoProduction.thumbnailUrl.trim() ||
      params.story.thumbnail ||
      '',
    videoUrl: videoProduction.masterExportUrl.trim(),
    scheduledAt: null,
    publishedAt: null,
    externalPostId: '',
    externalUrl: '',
    lastError: '',
    createdBy: params.actor,
  }));
}
