import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import Article from '@/lib/models/Article';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import {
  normalizeCopyEditorMeta,
  normalizeReporterMeta,
  validateCopyEditorMeta,
  validateReporterMeta,
} from '@/lib/content/newsroomMetadata';
import {
  canCreateContent,
  canReadContent,
  canTransitionContent,
  canViewPage,
  isAssignedContent,
  isOwnContent,
} from '@/lib/auth/permissions';
import { isReporterDeskRole } from '@/lib/auth/roles';
import { ensureBreakingTtsForArticle } from '@/lib/server/breakingTts';
import {
  createStoredArticle,
  listAllStoredArticles,
  updateStoredArticle,
} from '@/lib/storage/articlesFile';
import {
  normalizeArticleSourceType,
} from '@/lib/content/newsroomPublishing';
import {
  buildArticleActivityMessage,
  recordArticleActivity,
} from '@/lib/server/articleActivity';
import {
  getPrimaryArticleForStory,
  getStoryRecordForArticleLinking,
  syncStoryLinkedArticle,
  validateStoryForArticleCreation,
} from '@/lib/server/newsroomStoryLinks';
import { resolveArticleOgImageUrl } from '@/lib/utils/articleMedia';
import {
  isValidArticleSlug,
  normalizeArticleSeo,
  resolveUniqueArticleSlug,
} from '@/lib/seo/articleSeo';
import {
  resolveArticleWorkflow,
  toWorkflowActorRef,
} from '@/lib/workflow/article';
import { isWorkflowStatus } from '@/lib/workflow/types';
const FILE_STORE_UNBOUNDED_LIMIT = Number.MAX_SAFE_INTEGER;

type CreateIntent = 'draft' | 'submit' | 'publish';

type ArticleLike = {
  _id?: string;
  id?: string;
  author?: string;
  publishedAt?: string | Date;
  updatedAt?: string | Date;
  workflow?: unknown;
  sourceType?: string;
  sourceStoryId?: string;
  sourceStoryTitle?: string;
};

const REVIEW_QUEUE_STATUSES = new Set([
  'submitted',
  'assigned',
  'in_review',
  'copy_edit',
  'changes_requested',
  'ready_for_approval',
  'approved',
  'scheduled',
]);

type NormalizedSeo = {
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
  canonicalUrl: string;
  focusKeyword: string;
  secondaryKeywords: string;
  featuredImageAlt: string;
  featuredImageCaption: string;
  imageCredit: string;
  authorProfileUrl: string;
  includeInNewsSitemap: boolean;
  majorUpdateNote: string;
};

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function parseListLimit(value: string | null, fallback: number) {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'all') return null;

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '';
}

function normalizeCreateIntent(value: unknown): CreateIntent {
  return value === 'draft' || value === 'submit' ? value : 'publish';
}

function normalizeScope(value: string | null) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'mine' || normalized === 'assigned' || normalized === 'review'
    ? normalized
    : 'all';
}

function matchesActorValue(candidate: string | null | undefined, expected: string | null) {
  if (!candidate || !expected) return false;
  return candidate.trim().toLowerCase() === expected.trim().toLowerCase();
}

function resolveArticleRecord(article: ArticleLike, createdBy?: ReturnType<typeof toWorkflowActorRef>) {
  const workflow = resolveArticleWorkflow({
    workflow: article.workflow,
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
    createdBy,
  });

  return {
    ...article,
    workflow,
  };
}

function buildArticlePermissionRecord(article: ReturnType<typeof resolveArticleRecord>) {
  return {
    workflow: article.workflow,
    legacyAuthorName: typeof article.author === 'string' ? article.author : '',
  };
}

function matchesListFilters(
  article: ReturnType<typeof resolveArticleRecord>,
  user: NonNullable<Awaited<ReturnType<typeof getAdminSessionFromReqFromReq>>>,
  filters: {
    scope: 'all' | 'mine' | 'assigned' | 'review';
    workflowStatus: string;
    assignedTo: string | null;
    createdBy: string | null;
  }
) {
  const permissionRecord = buildArticlePermissionRecord(article);

  if (!canReadContent(user, permissionRecord, { allowViewerRead: true })) {
    return false;
  }

  if (filters.scope === 'mine' && !isOwnContent(user, permissionRecord)) {
    return false;
  }

  if (filters.scope === 'assigned' && !isAssignedContent(user, permissionRecord)) {
    return false;
  }

  if (
    filters.scope === 'review' &&
    !REVIEW_QUEUE_STATUSES.has(article.workflow.status)
  ) {
    return false;
  }

  if (filters.workflowStatus && article.workflow.status !== filters.workflowStatus) {
    return false;
  }

  if (
    filters.assignedTo &&
    !matchesActorValue(article.workflow.assignedTo?.id, filters.assignedTo) &&
    !matchesActorValue(article.workflow.assignedTo?.email, filters.assignedTo)
  ) {
    return false;
  }

  if (
    filters.createdBy &&
    !matchesActorValue(article.workflow.createdBy?.id, filters.createdBy) &&
    !matchesActorValue(article.workflow.createdBy?.email, filters.createdBy)
  ) {
    return false;
  }

  return true;
}

function buildInitialWorkflow(
  intent: CreateIntent,
  user: NonNullable<Awaited<ReturnType<typeof getAdminSessionFromReqFromReq>>>
) {
  const actor = toWorkflowActorRef(user);
  const now = new Date();

  if (intent === 'draft') {
    return {
      status: 'draft' as const,
      priority: 'normal' as const,
      createdBy: actor,
    };
  }

  if (intent === 'submit') {
    return {
      status: 'submitted' as const,
      priority: 'normal' as const,
      createdBy: actor,
      submittedAt: now,
    };
  }

  return {
    status: 'published' as const,
    priority: 'normal' as const,
    createdBy: actor,
    publishedAt: now,
  };
}

function normalizeSeo(input: unknown): NormalizedSeo {
  return normalizeArticleSeo(input);
}

function isValidAbsoluteHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function shouldUseFileStore() {
  if (!process.env.MONGODB_URI) {
    return true;
  }

  try {
    await connectDB();
    return false;
  } catch (error) {
    console.error('MongoDB unavailable for articles route, using file store.', error);
    return true;
  }
}

function normalizeArticleInput(body: unknown) {
  const source = typeof body === 'object' && body ? (body as Record<string, unknown>) : {};
  const image = typeof source.image === 'string' ? source.image.trim() : '';
  const seo = normalizeSeo(source.seo);
  if (!seo.ogImage && image) {
    seo.ogImage = resolveArticleOgImageUrl({ image });
  }

  return {
    title: typeof source.title === 'string' ? source.title.trim() : '',
    slug: typeof source.slug === 'string' ? source.slug.trim() : '',
    summary: typeof source.summary === 'string' ? source.summary.trim() : '',
    content: typeof source.content === 'string' ? source.content.trim() : '',
    image,
    category: typeof source.category === 'string' ? source.category.trim() : '',
    author: typeof source.author === 'string' ? source.author.trim() : '',
    isBreaking: Boolean(source.isBreaking),
    isTrending: Boolean(source.isTrending),
    seo,
    reporterMeta: normalizeReporterMeta(source.reporterMeta),
    copyEditorMeta: normalizeCopyEditorMeta(source.copyEditorMeta),
    sourceStoryId:
      typeof source.sourceStoryId === 'string' ? source.sourceStoryId.trim() : '',
    sourceType: normalizeArticleSourceType(
      typeof source.sourceStoryId === 'string' && source.sourceStoryId.trim()
        ? 'story'
        : source.sourceType
    ),
  };
}

function validateArticleInput(input: ReturnType<typeof normalizeArticleInput>) {
  if (
    !input.title ||
    !input.summary ||
    !input.content ||
    !input.image ||
    !input.category ||
    !input.author
  ) {
    return 'Missing required fields';
  }

  if (input.title.length > 200) {
    return 'Title is too long (max 200 characters)';
  }

  if (input.slug && !isValidArticleSlug(input.slug)) {
    return 'SEO slug must use lowercase letters, numbers, and hyphens only';
  }

  if (input.summary.length > 500) {
    return 'Summary is too long (max 500 characters)';
  }

  if (input.seo.metaTitle && input.seo.metaTitle.length > 160) {
    return 'SEO title is too long (max 160 characters)';
  }

  if (input.seo.metaDescription && input.seo.metaDescription.length > 320) {
    return 'SEO description is too long (max 320 characters)';
  }

  if (input.seo.canonicalUrl && !isValidAbsoluteHttpUrl(input.seo.canonicalUrl)) {
    return 'Canonical URL must be a valid absolute URL';
  }

  if (input.seo.authorProfileUrl && !isValidAbsoluteHttpUrl(input.seo.authorProfileUrl)) {
    return 'Author profile URL must be a valid absolute URL';
  }

  if (input.seo.ogImage && !isValidAbsoluteHttpUrl(input.seo.ogImage) && !input.seo.ogImage.startsWith('/')) {
    return 'OG image must be an absolute URL or local path';
  }

  const reporterMetaError = validateReporterMeta(input.reporterMeta);
  if (reporterMetaError) {
    return reporterMetaError;
  }

  const copyEditorMetaError = validateCopyEditorMeta(input.copyEditorMeta);
  if (copyEditorMetaError) {
    return copyEditorMetaError;
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAdminSessionFromReq(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!canViewPage(user.role, 'articles')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const requestedScope = normalizeScope(searchParams.get('scope'));
    const effectiveScope =
      isReporterDeskRole(user.role) && requestedScope === 'all' ? 'mine' : requestedScope;
    const workflowStatus = String(searchParams.get('workflowStatus') || '').trim().toLowerCase();
    const assignedTo = String(searchParams.get('assignedTo') || '').trim() || null;
    const createdBy = String(searchParams.get('createdBy') || '').trim() || null;
    const limit = parseListLimit(searchParams.get('limit'), 10);
    const page = parsePositiveInt(searchParams.get('page'), 1);
    const isUnbounded = limit === null;
    const effectivePage = isUnbounded ? 1 : page;
    const effectiveLimit = isUnbounded ? FILE_STORE_UNBOUNDED_LIMIT : limit;

    const allStoredArticles = await listAllStoredArticles();
    const filteredStoredArticles = allStoredArticles
      .filter((article) => (category && category !== 'all' ? article.category === category : true))
      .map((article) => resolveArticleRecord(article))
      .filter((article) =>
        matchesListFilters(article, user, {
          scope: effectiveScope,
          workflowStatus: isWorkflowStatus(workflowStatus) ? workflowStatus : '',
          assignedTo,
          createdBy,
        })
      )
      .sort(
        (left, right) =>
          new Date(String(right.updatedAt || right.publishedAt || 0)).getTime() -
          new Date(String(left.updatedAt || left.publishedAt || 0)).getTime()
      );

    const paginatedStoredArticles = isUnbounded
      ? filteredStoredArticles
      : filteredStoredArticles.slice(
          (effectivePage - 1) * effectiveLimit,
          (effectivePage - 1) * effectiveLimit + effectiveLimit
        );

    const createFileResponse = () =>
      NextResponse.json({
        success: true,
        data: paginatedStoredArticles,
        pagination: {
          total: filteredStoredArticles.length,
          page: effectivePage,
          limit: isUnbounded ? filteredStoredArticles.length : effectiveLimit,
          pages: isUnbounded ? 1 : Math.ceil(filteredStoredArticles.length / effectiveLimit),
        },
      });

    if (await shouldUseFileStore()) {
      return createFileResponse();
    }

    const query: Record<string, unknown> = {};
    if (category && category !== 'all') {
      query.category = category;
    }

    const mongoArticles = (await Article.find(query)
      .sort({ updatedAt: -1, publishedAt: -1, _id: -1 })
      .lean()) as ArticleLike[];

    const filteredMongoArticles = mongoArticles
      .map((article) => resolveArticleRecord(article))
      .filter((article) =>
        matchesListFilters(article, user, {
          scope: effectiveScope,
          workflowStatus: isWorkflowStatus(workflowStatus) ? workflowStatus : '',
          assignedTo,
          createdBy,
        })
      );

    const total = filteredMongoArticles.length;
    if (total === 0 && filteredStoredArticles.length > 0) {
      return createFileResponse();
    }

    const articles = isUnbounded
      ? filteredMongoArticles
      : filteredMongoArticles.slice(
          (effectivePage - 1) * effectiveLimit,
          (effectivePage - 1) * effectiveLimit + effectiveLimit
        );

    return NextResponse.json({
      success: true,
      data: articles,
      pagination: {
        total,
        page: effectivePage,
        limit: isUnbounded ? total : effectiveLimit,
        pages: isUnbounded ? 1 : Math.ceil(total / effectiveLimit),
      },
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch articles' },
      { status: 500 }
    );
  }
}
export async function POST(req: NextRequest) {
  try {
    // Read JSON body FIRST to avoid disturbed/locked body errors in Next.js 15
    const body = await req.json();

    const user = await getAdminSessionFromReq(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    if (!canViewPage(user.role, 'article_create')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }
    if (!canCreateContent(user.role, 'article')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const intent = normalizeCreateIntent((body as Record<string, unknown>)?.intent);
    const input = normalizeArticleInput(body);
    const validationError = validateArticleInput(input);
    const workflow = buildInitialWorkflow(intent, user);
    const useFileStore = await shouldUseFileStore();

    if (
      intent === 'publish' &&
      !canTransitionContent(
        user,
        {
          workflow: {
            status: 'approved',
          },
        },
        'publish'
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'You do not have permission to publish articles directly.',
        },
        { status: 403 }
      );
    }

    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 }
      );
    }

    let sourceStoryTitle = '';
    if (input.sourceStoryId) {
      if (user.role === 'reporter') {
        return NextResponse.json(
          {
            success: false,
            error: 'Reporters cannot create linked articles directly from story packages.',
          },
          { status: 403 }
        );
      }

      const sourceStory = await getStoryRecordForArticleLinking({
        useFileStore,
        storyId: input.sourceStoryId,
      });
      const storyValidationError = validateStoryForArticleCreation(sourceStory);
      if (storyValidationError) {
        return NextResponse.json(
          { success: false, error: storyValidationError },
          { status: 400 }
        );
      }

      const existingPrimaryArticle = await getPrimaryArticleForStory({
        useFileStore,
        storyId: input.sourceStoryId,
      });
      if (existingPrimaryArticle) {
        return NextResponse.json(
          {
            success: false,
            error: 'A primary linked article already exists for this story.',
          },
          { status: 409 }
        );
      }

      sourceStoryTitle =
        sourceStory && typeof sourceStory.title === 'string'
          ? sourceStory.title.trim()
          : '';
    }

    let resolvedSlug = '';
    if (useFileStore) {
      const existingArticles = await listAllStoredArticles();
      resolvedSlug = await resolveUniqueArticleSlug(
        input.slug || input.seo.metaTitle || input.title,
        async (candidate) =>
          existingArticles.some(
            (article) =>
              article.slug === candidate || (article.previousSlugs || []).includes(candidate)
          )
      );
    } else {
      resolvedSlug = await resolveUniqueArticleSlug(
        input.slug || input.seo.metaTitle || input.title,
        async (candidate) => Boolean(await Article.exists({ slug: candidate }))
      );
    }

    if (useFileStore) {
      const stored = await createStoredArticle({
        ...input,
        slug: resolvedSlug,
        sourceType: input.sourceStoryId ? 'story' : input.sourceType,
        sourceStoryTitle,
        workflow: {
          ...workflow,
          submittedAt: workflow.submittedAt?.toISOString() || null,
          publishedAt: workflow.publishedAt?.toISOString() || null,
        },
      });
      try {
        const breakingTts =
          stored.workflow.status === 'published'
            ? await ensureBreakingTtsForArticle(stored)
            : null;
        if (breakingTts) {
          const updated = await updateStoredArticle(
            stored._id,
            { breakingTts },
            { skipRevision: true }
          );
          if (updated) {
            stored.breakingTts = updated.breakingTts ?? breakingTts;
          } else {
            stored.breakingTts = breakingTts;
          }
        }
      } catch (ttsError) {
        console.error('Failed to cache breaking TTS after article create:', ttsError);
      }

      await recordArticleActivity({
        articleId: stored._id,
        actor: user,
        action: 'created',
        toStatus: stored.workflow.status,
        message: buildArticleActivityMessage({
          action: 'created',
          toStatus: stored.workflow.status,
        }),
        metadata: {
          intent,
          priority: stored.workflow.priority,
          createdById: stored.workflow.createdBy?.id || '',
        },
      });

      if (stored.sourceStoryId) {
        await syncStoryLinkedArticle({
          useFileStore,
          storyId: stored.sourceStoryId,
          articleId: stored._id,
          articleStatus: stored.workflow.status,
        });
      }

      return NextResponse.json({ success: true, data: stored }, { status: 201 });
    }

    const article = new Article({
      ...input,
      slug: resolvedSlug,
      previousSlugs: [],
      sourceType: input.sourceStoryId ? 'story' : input.sourceType,
      sourceStoryTitle,
      views: 0,
      publishedAt: new Date(),
      updatedAt: new Date(),
      workflow,
    });

    await article.save();
    try {
      const breakingTts =
        workflow.status === 'published'
          ? await ensureBreakingTtsForArticle(article.toObject())
          : null;
      if (breakingTts) {
        article.breakingTts = {
          ...breakingTts,
          generatedAt: new Date(breakingTts.generatedAt),
        };
        await article.save();
      }
    } catch (ttsError) {
      console.error('Failed to cache breaking TTS after article create:', ttsError);
    }

    await recordArticleActivity({
      articleId: String(article._id),
      actor: user,
      action: 'created',
      toStatus: workflow.status,
      message: buildArticleActivityMessage({
        action: 'created',
        toStatus: workflow.status,
      }),
      metadata: {
        intent,
        priority: workflow.priority,
        createdById: workflow.createdBy?.id || '',
      },
    });

    if (article.sourceStoryId) {
      await syncStoryLinkedArticle({
        useFileStore,
        storyId: article.sourceStoryId,
        articleId: String(article._id),
        articleStatus: workflow.status,
      });
    }

    return NextResponse.json({ success: true, data: article }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating article:', error);
    const message =
      process.env.NODE_ENV !== 'production'
        ? getErrorMessage(error) || 'Failed to create article'
        : 'Failed to create article';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

