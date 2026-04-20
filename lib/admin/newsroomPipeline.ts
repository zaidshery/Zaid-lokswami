import connectDB from '@/lib/db/mongoose';
import Article from '@/lib/models/Article';
import SocialPost from '@/lib/models/SocialPost';
import Story from '@/lib/models/Story';
import {
  isStoryReadyForArticleCreation,
  normalizeLinkedArticleStatus,
  normalizeSocialPostStatus,
  normalizeStoryVideoProduction,
  type SocialPostStatus,
} from '@/lib/content/newsroomPublishing';
import { listAllStoredArticles } from '@/lib/storage/articlesFile';
import { listStoredSocialPosts } from '@/lib/storage/socialPostsFile';
import { listAllStoredStories } from '@/lib/storage/storiesFile';
import { resolveArticleWorkflow } from '@/lib/workflow/article';
import { resolveStoryWorkflow } from '@/lib/workflow/story';

type PipelineStorySource = {
  _id?: unknown;
  category?: unknown;
  author?: unknown;
  workflow?: unknown;
  isPublished?: unknown;
  publishedAt?: unknown;
  updatedAt?: unknown;
  linkedArticleId?: unknown;
  linkedArticleStatus?: unknown;
  videoProduction?: unknown;
};

type PipelineArticleSource = {
  _id?: unknown;
  category?: unknown;
  author?: unknown;
  sourceType?: unknown;
  sourceStoryId?: unknown;
  workflow?: unknown;
  publishedAt?: unknown;
  updatedAt?: unknown;
};

type PipelineSocialPostSource = {
  sourceStoryId?: unknown;
  status?: unknown;
};

export type NewsroomPipelineAnalytics = {
  source: 'mongodb' | 'file' | 'hybrid';
  filters: {
    applied: NewsroomPipelineFilters;
    options: {
      categories: string[];
      reporters: string[];
    };
  };
  totals: {
    stories: number;
    approvedStories: number;
    articles: number;
    linkedArticles: number;
    directArticles: number;
    socialPosts: number;
  };
  pipeline: {
    storiesSubmitted: number;
    approvedStories: number;
    linkedArticleCreated: number;
    linkedArticlePublished: number;
    videoStarted: number;
    videoReady: number;
    socialDrafted: number;
    socialPublished: number;
    fullyDistributed: number;
  };
  socialStatuses: Record<SocialPostStatus, number>;
  bottlenecks: {
    awaitingArticle: number;
    awaitingVideo: number;
    awaitingSocialDrafts: number;
    awaitingSocialPublish: number;
  };
};

export type NewsroomPipelineRange = '7d' | '30d' | '90d' | '365d' | 'all';

export type NewsroomPipelineFilters = {
  range: NewsroomPipelineRange;
  category: string;
  reporter: string;
};

const DEFAULT_NEWSROOM_PIPELINE_FILTERS: NewsroomPipelineFilters = {
  range: 'all',
  category: '',
  reporter: '',
};

function shouldUseFileStore() {
  return !process.env.MONGODB_URI?.trim();
}

function hasDataSignal(params: {
  stories: PipelineStorySource[];
  articles: PipelineArticleSource[];
  socialPosts: PipelineSocialPostSource[];
}) {
  return params.stories.length > 0 || params.articles.length > 0 || params.socialPosts.length > 0;
}

function createEmptySocialStatusCounts(): Record<SocialPostStatus, number> {
  return {
    draft: 0,
    approved: 0,
    scheduled: 0,
    publishing: 0,
    published: 0,
    failed: 0,
  };
}

function normalizeFilterText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeMatchKey(value: string) {
  return value.trim().toLowerCase();
}

function normalizePipelineRange(value: unknown): NewsroomPipelineRange {
  switch (value) {
    case '7d':
    case '30d':
    case '90d':
    case '365d':
    case 'all':
      return value;
    default:
      return DEFAULT_NEWSROOM_PIPELINE_FILTERS.range;
  }
}

export function normalizeNewsroomPipelineFilters(
  input?: {
    range?: unknown;
    category?: unknown;
    reporter?: unknown;
  }
): NewsroomPipelineFilters {
  return {
    range: normalizePipelineRange(input?.range),
    category: normalizeFilterText(input?.category),
    reporter: normalizeFilterText(input?.reporter),
  };
}

function resolveActorSummary(actor: unknown) {
  if (!actor || typeof actor !== 'object') {
    return {
      id: '',
      name: '',
      email: '',
    };
  }

  const record = actor as Record<string, unknown>;
  return {
    id: normalizeFilterText(record.id),
    name: normalizeFilterText(record.name),
    email: normalizeFilterText(record.email),
  };
}

function getReporterLabel(input: { workflow?: unknown; author?: unknown }) {
  const actor = resolveActorSummary(
    input.workflow && typeof input.workflow === 'object'
      ? (input.workflow as Record<string, unknown>).createdBy
      : undefined
  );
  return actor.name || normalizeFilterText(input.author) || actor.email || actor.id;
}

function collectDistinctSorted(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right, 'en', { sensitivity: 'base' }));
}

function resolveRelevantDate(...values: unknown[]) {
  for (const value of values) {
    if (!value) continue;
    const date = value instanceof Date ? value : new Date(String(value));
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  return null;
}

function getRangeWindowStart(range: NewsroomPipelineRange, now: Date) {
  if (range === 'all') return null;
  const days = Number.parseInt(range.replace('d', ''), 10);
  if (Number.isNaN(days) || days <= 0) return null;
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  return start;
}

function matchesReporterFilter(
  reporterFilter: string,
  input: { workflow?: unknown; author?: unknown }
) {
  if (!reporterFilter) return true;
  const target = normalizeMatchKey(reporterFilter);
  const actor = resolveActorSummary(
    input.workflow && typeof input.workflow === 'object'
      ? (input.workflow as Record<string, unknown>).createdBy
      : undefined
  );
  const candidates = [
    actor.name,
    normalizeFilterText(input.author),
    actor.email,
    actor.id,
  ]
    .map((value) => normalizeMatchKey(value))
    .filter(Boolean);

  return candidates.includes(target);
}

function matchesCategoryFilter(categoryFilter: string, category: unknown) {
  if (!categoryFilter) return true;
  return normalizeMatchKey(categoryFilter) === normalizeMatchKey(normalizeFilterText(category));
}

function matchesDateRange(
  range: NewsroomPipelineRange,
  date: Date | null,
  now: Date
) {
  const windowStart = getRangeWindowStart(range, now);
  if (!windowStart) return true;
  if (!date) return false;
  return date >= windowStart && date <= now;
}

export function summarizeNewsroomPipeline(params: {
  stories: PipelineStorySource[];
  articles: PipelineArticleSource[];
  socialPosts: PipelineSocialPostSource[];
  source: NewsroomPipelineAnalytics['source'];
  filters?: Partial<NewsroomPipelineFilters>;
  now?: Date;
}): NewsroomPipelineAnalytics {
  const appliedFilters = normalizeNewsroomPipelineFilters(params.filters);
  const now = params.now ?? new Date();
  const filterOptions = {
    categories: collectDistinctSorted([
      ...params.stories.map((story) => normalizeFilterText(story.category)),
      ...params.articles.map((article) => normalizeFilterText(article.category)),
    ]),
    reporters: collectDistinctSorted([
      ...params.stories.map((story) =>
        getReporterLabel({ workflow: story.workflow, author: story.author })
      ),
      ...params.articles.map((article) =>
        getReporterLabel({ workflow: article.workflow, author: article.author })
      ),
    ]),
  };

  const filteredStories = params.stories.filter((story) => {
    const storyDate = resolveRelevantDate(story.updatedAt, story.publishedAt);
    return (
      matchesDateRange(appliedFilters.range, storyDate, now) &&
      matchesCategoryFilter(appliedFilters.category, story.category) &&
      matchesReporterFilter(appliedFilters.reporter, {
        workflow: story.workflow,
        author: story.author,
      })
    );
  });
  const filteredStoryIds = new Set(
    filteredStories
      .map((story) =>
        typeof story._id === 'string' ? story._id.trim() : String(story._id || '').trim()
      )
      .filter(Boolean)
  );
  const filteredArticles = params.articles.filter((article) => {
    const sourceType = typeof article.sourceType === 'string' ? article.sourceType : 'direct';
    if (sourceType === 'story') {
      const storyId =
        typeof article.sourceStoryId === 'string' ? article.sourceStoryId.trim() : '';
      return storyId ? filteredStoryIds.has(storyId) : false;
    }

    const articleDate = resolveRelevantDate(article.updatedAt, article.publishedAt);
    return (
      matchesDateRange(appliedFilters.range, articleDate, now) &&
      matchesCategoryFilter(appliedFilters.category, article.category) &&
      matchesReporterFilter(appliedFilters.reporter, {
        workflow: article.workflow,
        author: article.author,
      })
    );
  });
  const filteredSocialPosts = params.socialPosts.filter((post) => {
    const storyId =
      typeof post.sourceStoryId === 'string' ? post.sourceStoryId.trim() : '';
    return storyId ? filteredStoryIds.has(storyId) : false;
  });
  const socialStatuses = createEmptySocialStatusCounts();
  const postsByStoryId = new Map<string, SocialPostStatus[]>();

  for (const post of filteredSocialPosts) {
    const storyId =
      typeof post.sourceStoryId === 'string' ? post.sourceStoryId.trim() : '';
    if (!storyId) continue;

    const status = normalizeSocialPostStatus(post.status);
    socialStatuses[status] += 1;
    const existing = postsByStoryId.get(storyId) || [];
    existing.push(status);
    postsByStoryId.set(storyId, existing);
  }

  const linkedArticles = filteredArticles.filter(
    (article) =>
      (typeof article.sourceType === 'string' ? article.sourceType : '') === 'story' &&
      typeof article.sourceStoryId === 'string' &&
      article.sourceStoryId.trim()
  );
  const directArticles = filteredArticles.filter(
    (article) =>
      (typeof article.sourceType === 'string' ? article.sourceType : 'direct') !== 'story'
  );

  let storiesSubmitted = 0;
  let approvedStories = 0;
  let linkedArticleCreated = 0;
  let linkedArticlePublished = 0;
  let videoStarted = 0;
  let videoReady = 0;
  let socialDrafted = 0;
  let socialPublished = 0;
  let fullyDistributed = 0;
  let awaitingArticle = 0;
  let awaitingVideo = 0;
  let awaitingSocialDrafts = 0;
  let awaitingSocialPublish = 0;

  for (const story of filteredStories) {
    const storyId = typeof story._id === 'string' ? story._id.trim() : String(story._id || '').trim();
    const workflow = resolveStoryWorkflow({
      workflow: story.workflow,
      isPublished: typeof story.isPublished === 'boolean' ? story.isPublished : undefined,
      publishedAt: story.publishedAt,
      updatedAt: story.updatedAt,
    });

    if (
      workflow.status === 'submitted' ||
      workflow.status === 'assigned' ||
      workflow.status === 'in_review' ||
      workflow.status === 'copy_edit' ||
      workflow.status === 'changes_requested' ||
      workflow.status === 'ready_for_approval'
    ) {
      storiesSubmitted += 1;
    }

    if (!isStoryReadyForArticleCreation(workflow.status)) {
      continue;
    }

    approvedStories += 1;

    const hasLinkedArticle =
      typeof story.linkedArticleId === 'string' && story.linkedArticleId.trim().length > 0;
    const linkedStatus = normalizeLinkedArticleStatus(story.linkedArticleStatus);
    const videoProduction = normalizeStoryVideoProduction(story.videoProduction);
    const hasVideoStarted = videoProduction.status !== 'not_started';
    const isVideoReady =
      videoProduction.status === 'ready_to_publish' ||
      videoProduction.status === 'published' ||
      Boolean(videoProduction.masterExportUrl.trim());
    const socialForStory = storyId ? postsByStoryId.get(storyId) || [] : [];
    const hasSocialDrafts = socialForStory.length > 0;
    const hasPublishedSocial = socialForStory.includes('published');

    if (hasLinkedArticle) {
      linkedArticleCreated += 1;
    } else {
      awaitingArticle += 1;
    }

    if (linkedStatus === 'published') {
      linkedArticlePublished += 1;
    }

    if (hasVideoStarted) {
      videoStarted += 1;
    }

    if (isVideoReady) {
      videoReady += 1;
    }

    if (hasSocialDrafts) {
      socialDrafted += 1;
    }

    if (hasPublishedSocial) {
      socialPublished += 1;
    }

    if (hasLinkedArticle && !hasVideoStarted) {
      awaitingVideo += 1;
    }

    if (hasLinkedArticle && isVideoReady && !hasSocialDrafts) {
      awaitingSocialDrafts += 1;
    }

    if (hasSocialDrafts && !hasPublishedSocial) {
      awaitingSocialPublish += 1;
    }

    if (linkedStatus === 'published' && isVideoReady && hasPublishedSocial) {
      fullyDistributed += 1;
    }
  }

  return {
    source: params.source,
    filters: {
      applied: appliedFilters,
      options: filterOptions,
    },
    totals: {
      stories: filteredStories.length,
      approvedStories,
      articles: filteredArticles.length,
      linkedArticles: linkedArticles.length,
      directArticles: directArticles.length,
      socialPosts: filteredSocialPosts.length,
    },
    pipeline: {
      storiesSubmitted,
      approvedStories,
      linkedArticleCreated,
      linkedArticlePublished,
      videoStarted,
      videoReady,
      socialDrafted,
      socialPublished,
      fullyDistributed,
    },
    socialStatuses,
    bottlenecks: {
      awaitingArticle,
      awaitingVideo,
      awaitingSocialDrafts,
      awaitingSocialPublish,
    },
  };
}

async function loadStoriesFromMongo(): Promise<PipelineStorySource[]> {
  return (await Story.find({})
    .select(
      '_id category author workflow isPublished publishedAt updatedAt linkedArticleId linkedArticleStatus videoProduction'
    )
    .lean()) as PipelineStorySource[];
}

async function loadArticlesFromMongo(): Promise<PipelineArticleSource[]> {
  return (await Article.find({})
    .select('_id category author sourceType sourceStoryId workflow publishedAt updatedAt')
    .lean()) as PipelineArticleSource[];
}

async function loadSocialPostsFromMongo(): Promise<PipelineSocialPostSource[]> {
  return (await SocialPost.find({})
    .select('sourceStoryId status')
    .lean()) as PipelineSocialPostSource[];
}

export async function getNewsroomPipelineAnalytics(
  filters?: Partial<NewsroomPipelineFilters>
): Promise<NewsroomPipelineAnalytics> {
  const fileData = await Promise.all([
    listAllStoredStories(),
    listAllStoredArticles(),
    listStoredSocialPosts(),
  ]);

  if (shouldUseFileStore()) {
    return summarizeNewsroomPipeline({
      stories: fileData[0],
      articles: fileData[1],
      socialPosts: fileData[2],
      source: 'file',
      filters,
    });
  }

  try {
    await connectDB();

    const mongoData = await Promise.all([
      loadStoriesFromMongo(),
      loadArticlesFromMongo(),
      loadSocialPostsFromMongo(),
    ]);

    const stories = mongoData[0].length ? mongoData[0] : fileData[0];
    const articles = mongoData[1].length ? mongoData[1] : fileData[1];
    const socialPosts = mongoData[2].length ? mongoData[2] : fileData[2];
    const source: NewsroomPipelineAnalytics['source'] =
      mongoData[0].length && mongoData[1].length && (mongoData[2].length || fileData[2].length === 0)
        ? 'mongodb'
        : hasDataSignal({
              stories: mongoData[0],
              articles: mongoData[1],
              socialPosts: mongoData[2],
            })
          ? 'hybrid'
          : 'file';

    return summarizeNewsroomPipeline({
      stories,
      articles,
      socialPosts,
      source,
      filters,
    });
  } catch (error) {
    console.error('MongoDB unavailable for newsroom pipeline analytics, using file store.', error);
    return summarizeNewsroomPipeline({
      stories: fileData[0],
      articles: fileData[1],
      socialPosts: fileData[2],
      source: 'file',
      filters,
    });
  }
}
