import Article from '@/lib/models/Article';
import Story from '@/lib/models/Story';
import type { CreateArticleInput } from '@/lib/storage/articlesFile';
import {
  findStoredArticleBySourceStoryId,
  getStoredArticleById,
} from '@/lib/storage/articlesFile';
import {
  getStoredStoryById,
  updateStoredStory,
} from '@/lib/storage/storiesFile';
import {
  getLinkedArticleStatusFromWorkflowStatus,
  isStoryReadyForArticleDrafting,
  type LinkedArticleStatus,
} from '@/lib/content/newsroomPublishing';
import {
  derivePrimaryStoryMedia,
  normalizeStoryMediaAssets,
} from '@/lib/content/storyMedia';
import { resolveStoryWorkflow } from '@/lib/workflow/story';

type StoryRecord = {
  _id?: unknown;
  title?: unknown;
  caption?: unknown;
  category?: unknown;
  author?: unknown;
  thumbnail?: unknown;
  mediaAssets?: unknown;
  reporterMeta?: unknown;
  workflow?: unknown;
  isPublished?: unknown;
  publishedAt?: unknown;
  updatedAt?: unknown;
  linkedArticleId?: unknown;
  linkedArticleStatus?: unknown;
};

export async function getStoryRecordForArticleLinking(params: {
  useFileStore: boolean;
  storyId: string;
}) {
  const { useFileStore, storyId } = params;
  if (useFileStore) {
    return getStoredStoryById(storyId);
  }

  return (await Story.findById(storyId).lean()) as StoryRecord | null;
}

export async function getPrimaryArticleForStory(params: {
  useFileStore: boolean;
  storyId: string;
}) {
  const { useFileStore, storyId } = params;
  if (!storyId.trim()) return null;

  if (useFileStore) {
    return findStoredArticleBySourceStoryId(storyId);
  }

  return Article.findOne({ sourceStoryId: storyId }).sort({ updatedAt: -1, _id: -1 }).lean();
}

export async function syncStoryLinkedArticle(params: {
  useFileStore: boolean;
  storyId: string;
  articleId: string;
  articleStatus: string | null | undefined;
}) {
  const { useFileStore, storyId, articleId, articleStatus } = params;
  const linkedStatus = getLinkedArticleStatusFromWorkflowStatus(articleStatus);

  if (useFileStore) {
    return updateStoredStory(storyId, {
      linkedArticleId: articleId,
      linkedArticleStatus: linkedStatus,
    });
  }

  return (await Story.findByIdAndUpdate(
    storyId,
    {
      $set: {
        linkedArticleId: articleId,
        linkedArticleStatus: linkedStatus,
        updatedAt: new Date(),
      },
    },
    { new: true }
  ).lean()) as StoryRecord | null;
}

export async function clearStoryLinkedArticle(params: {
  useFileStore: boolean;
  storyId: string;
  articleId?: string;
}) {
  const { useFileStore, storyId, articleId } = params;
  if (!storyId.trim()) return null;

  if (useFileStore) {
    const story = await getStoredStoryById(storyId);
    if (!story) return null;
    if (articleId && story.linkedArticleId && story.linkedArticleId !== articleId) {
      return story;
    }
    return updateStoredStory(storyId, {
      linkedArticleId: '',
      linkedArticleStatus: 'not_created',
    });
  }

  const story = (await Story.findById(storyId).lean()) as StoryRecord | null;
  if (!story) return null;
  if (articleId && typeof story.linkedArticleId === 'string' && story.linkedArticleId !== articleId) {
    return story;
  }

  return (await Story.findByIdAndUpdate(
    storyId,
    {
      $set: {
        linkedArticleId: '',
        linkedArticleStatus: 'not_created' satisfies LinkedArticleStatus,
        updatedAt: new Date(),
      },
    },
    { new: true }
  ).lean()) as StoryRecord | null;
}

export function buildArticlePrefillFromStory(
  story: StoryRecord
): Pick<
  CreateArticleInput,
  'title' | 'summary' | 'content' | 'image' | 'category' | 'author' | 'reporterMeta'
> & {
  sourceStoryId: string;
  sourceStoryTitle: string;
} {
  const mediaAssets = normalizeStoryMediaAssets(story.mediaAssets);
  const derivedPrimary = derivePrimaryStoryMedia(
    mediaAssets,
    typeof story.thumbnail === 'string' ? story.thumbnail.trim() : ''
  );
  const primaryImage =
    mediaAssets.find((asset) => asset.kind === 'image')?.url ||
    derivedPrimary.thumbnail ||
    '';

  return {
    sourceStoryId: typeof story._id === 'string' ? story._id : String(story._id || ''),
    sourceStoryTitle:
      typeof story.title === 'string' ? story.title.trim() : '',
    title: typeof story.title === 'string' ? story.title.trim() : '',
    summary: typeof story.caption === 'string' ? story.caption.trim() : '',
    content: '',
    image: primaryImage,
    category:
      typeof story.category === 'string' && story.category.trim()
        ? story.category.trim()
        : 'General',
    author:
      typeof story.author === 'string' && story.author.trim()
        ? story.author.trim()
        : 'Desk',
    reporterMeta:
      typeof story.reporterMeta === 'object' && story.reporterMeta
        ? (story.reporterMeta as CreateArticleInput['reporterMeta'])
        : undefined,
  };
}

export function validateStoryForArticleCreation(story: StoryRecord | null) {
  if (!story) {
    return 'Source story not found';
  }

  const workflow = resolveStoryWorkflow({
    workflow:
      typeof story.workflow === 'object' && story.workflow
        ? (story.workflow as Record<string, unknown>)
        : null,
    isPublished:
      typeof story.isPublished === 'boolean' ? story.isPublished : undefined,
    publishedAt: story.publishedAt,
    updatedAt: story.updatedAt,
  });

  if (!isStoryReadyForArticleDrafting(workflow.status)) {
    return 'Only submitted or desk-stage stories can create linked articles.';
  }

  if (
    typeof story.linkedArticleId === 'string' &&
    story.linkedArticleId.trim()
  ) {
    return 'A primary article has already been created for this story.';
  }

  return null;
}

export async function resolveArticleSourceStoryTitle(params: {
  useFileStore: boolean;
  sourceStoryId: string;
}) {
  const { useFileStore, sourceStoryId } = params;
  if (!sourceStoryId.trim()) return '';

  const story = await getStoryRecordForArticleLinking({
    useFileStore,
    storyId: sourceStoryId,
  });
  if (!story || typeof story.title !== 'string') return '';
  return story.title.trim();
}

export async function getStoredArticleSourceStory(articleId: string) {
  const article = await getStoredArticleById(articleId);
  if (!article?.sourceStoryId) return null;
  return getStoredStoryById(article.sourceStoryId);
}
