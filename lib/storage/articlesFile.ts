import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { type BreakingTtsMetadata, normalizeBreakingTtsMetadata } from '@/lib/types/breaking';
import {
  createEmptyCopyEditorMeta,
  createEmptyReporterMeta,
  normalizeCopyEditorMeta,
  normalizeReporterMeta,
  type CopyEditorMeta,
  type ReporterMeta,
} from '@/lib/content/newsroomMetadata';
import {
  normalizeArticleSourceType,
  type ArticleSourceType,
} from '@/lib/content/newsroomPublishing';
import {
  createWorkflowMeta,
  isWorkflowCommentKind,
  isWorkflowPriority,
  isWorkflowStatus,
  type WorkflowActorRef,
  type WorkflowCommentKind,
  type WorkflowPriority,
  type WorkflowStatus,
} from '@/lib/workflow/types';
import { resolveArticleOgImageUrl } from '@/lib/utils/articleMedia';

export interface ArticleSeo {
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
  canonicalUrl: string;
}

export interface StoredArticleRevision {
  _id: string;
  title: string;
  summary: string;
  content: string;
  image: string;
  category: string;
  author: string;
  isBreaking: boolean;
  isTrending: boolean;
  seo: ArticleSeo;
  reporterMeta: ReporterMeta;
  copyEditorMeta: CopyEditorMeta;
  savedAt: string;
}

export interface StoredWorkflowComment {
  id: string;
  body: string;
  kind: WorkflowCommentKind;
  author: WorkflowActorRef;
  createdAt: string;
}

export interface StoredWorkflowMeta {
  status: WorkflowStatus;
  priority: WorkflowPriority;
  createdBy: WorkflowActorRef | null;
  assignedTo: WorkflowActorRef | null;
  reviewedBy: WorkflowActorRef | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  publishedAt: string | null;
  scheduledFor: string | null;
  dueAt: string | null;
  rejectionReason: string;
  comments: StoredWorkflowComment[];
}

export interface StoredArticle {
  _id: string;
  title: string;
  summary: string;
  content: string;
  image: string;
  category: string;
  author: string;
  publishedAt: string;
  updatedAt: string;
  views: number;
  isBreaking: boolean;
  isTrending: boolean;
  seo: ArticleSeo;
  revisions: StoredArticleRevision[];
  breakingTts?: BreakingTtsMetadata | null;
  workflow: StoredWorkflowMeta;
  reporterMeta: ReporterMeta;
  copyEditorMeta: CopyEditorMeta;
  sourceType: ArticleSourceType;
  sourceStoryId: string;
  sourceStoryTitle: string;
}

export interface CreateArticleInput {
  title: string;
  summary: string;
  content: string;
  image: string;
  category: string;
  author: string;
  isBreaking?: boolean;
  isTrending?: boolean;
  seo?: Partial<ArticleSeo>;
  workflow?: Partial<StoredWorkflowMeta>;
  reporterMeta?: Partial<ReporterMeta>;
  copyEditorMeta?: Partial<CopyEditorMeta>;
  sourceType?: ArticleSourceType;
  sourceStoryId?: string;
  sourceStoryTitle?: string;
}

type UpdateArticleInput = Partial<CreateArticleInput> & {
  views?: number;
  publishedAt?: string;
  seo?: Partial<ArticleSeo>;
  breakingTts?: BreakingTtsMetadata | null;
  workflow?: Partial<StoredWorkflowMeta>;
  reporterMeta?: Partial<ReporterMeta>;
  copyEditorMeta?: Partial<CopyEditorMeta>;
};

const dataDir = path.resolve(process.cwd(), 'data');
const dataPath = path.join(dataDir, 'articles.json');
const MAX_STORED_REVISIONS = 30;
const USE_REMOTE_DEMO_MEDIA =
  process.env.NEXT_PUBLIC_USE_REMOTE_DEMO_MEDIA === 'true';
const UNSPLASH_IMAGE_HOST = /^https:\/\/images\.unsplash\.com\//i;
const LOCAL_NEWS_FALLBACK_IMAGE = '/placeholders/news-16x9.svg';

function createId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function emptySeo(): ArticleSeo {
  return {
    metaTitle: '',
    metaDescription: '',
    ogImage: '',
    canonicalUrl: '',
  };
}

function normalizeMediaUrl(input: unknown, fallback = LOCAL_NEWS_FALLBACK_IMAGE) {
  const value = typeof input === 'string' ? input.trim() : '';
  if (!value) return fallback;
  if (!USE_REMOTE_DEMO_MEDIA && UNSPLASH_IMAGE_HOST.test(value)) {
    return fallback;
  }
  return value;
}

function normalizeSeo(input: unknown): ArticleSeo {
  const source = typeof input === 'object' && input ? (input as Record<string, unknown>) : {};
  return {
    metaTitle: typeof source.metaTitle === 'string' ? source.metaTitle.trim() : '',
    metaDescription: typeof source.metaDescription === 'string' ? source.metaDescription.trim() : '',
    ogImage: normalizeMediaUrl(source.ogImage, ''),
    canonicalUrl: typeof source.canonicalUrl === 'string' ? source.canonicalUrl.trim() : '',
  };
}

function normalizeOptionalDateString(value: unknown) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeWorkflowComment(input: unknown): StoredWorkflowComment | null {
  const source = typeof input === 'object' && input ? (input as Record<string, unknown>) : null;
  if (!source) return null;

  const authorSource =
    typeof source.author === 'object' && source.author
      ? (source.author as Record<string, unknown>)
      : null;
  const body = typeof source.body === 'string' ? source.body.trim() : '';
  const authorId = typeof authorSource?.id === 'string' ? authorSource.id.trim() : '';
  const authorName = typeof authorSource?.name === 'string' ? authorSource.name.trim() : '';
  const authorEmail = typeof authorSource?.email === 'string' ? authorSource.email.trim() : '';
  const authorRole = authorSource?.role;

  if (!body || !authorId || !authorName || !authorEmail || typeof authorRole !== 'string') {
    return null;
  }

  return {
    id: typeof source.id === 'string' && source.id.trim() ? source.id : createId(),
    body,
    kind: isWorkflowCommentKind(source.kind) ? source.kind : 'comment',
    author: {
      id: authorId,
      name: authorName,
      email: authorEmail,
      role: authorRole as WorkflowActorRef['role'],
    },
    createdAt: normalizeOptionalDateString(source.createdAt) || new Date().toISOString(),
  };
}

function normalizeWorkflowMeta(input: unknown): StoredWorkflowMeta {
  const source = typeof input === 'object' && input ? (input as Record<string, unknown>) : {};
  const workflow = createWorkflowMeta({
    status: isWorkflowStatus(source.status) ? source.status : 'published',
    priority: isWorkflowPriority(source.priority) ? source.priority : 'normal',
  });

  const comments = Array.isArray(source.comments)
    ? source.comments
        .map((comment) => normalizeWorkflowComment(comment))
        .filter((comment): comment is StoredWorkflowComment => Boolean(comment))
    : [];

  return {
    status: workflow.status,
    priority: workflow.priority,
    createdBy:
      typeof source.createdBy === 'object' && source.createdBy
        ? (source.createdBy as WorkflowActorRef)
        : null,
    assignedTo:
      typeof source.assignedTo === 'object' && source.assignedTo
        ? (source.assignedTo as WorkflowActorRef)
        : null,
    reviewedBy:
      typeof source.reviewedBy === 'object' && source.reviewedBy
        ? (source.reviewedBy as WorkflowActorRef)
        : null,
    submittedAt: normalizeOptionalDateString(source.submittedAt),
    approvedAt: normalizeOptionalDateString(source.approvedAt),
    rejectedAt: normalizeOptionalDateString(source.rejectedAt),
    publishedAt: normalizeOptionalDateString(source.publishedAt),
    scheduledFor: normalizeOptionalDateString(source.scheduledFor),
    dueAt: normalizeOptionalDateString(source.dueAt),
    rejectionReason:
      typeof source.rejectionReason === 'string' ? source.rejectionReason.trim() : '',
    comments,
  };
}

function withSeoOgFallback(seo: ArticleSeo, image: string) {
  if (seo.ogImage || !image) return seo;
  return {
    ...seo,
    ogImage: resolveArticleOgImageUrl({ image }),
  };
}

function normalizeRevision(input: unknown): StoredArticleRevision | null {
  const source = typeof input === 'object' && input ? (input as Record<string, unknown>) : null;
  if (!source) return null;

  const title = typeof source.title === 'string' ? source.title : '';
  const summary = typeof source.summary === 'string' ? source.summary : '';
  const content = typeof source.content === 'string' ? source.content : '';
  const image = normalizeMediaUrl(source.image);
  const category = typeof source.category === 'string' ? source.category : '';
  const author = typeof source.author === 'string' ? source.author : '';

  if (!title || !summary || !content || !image || !category || !author) {
    return null;
  }

  return {
    _id: typeof source._id === 'string' && source._id.trim() ? source._id : createId(),
    title,
    summary,
    content,
    image,
    category,
    author,
    isBreaking: Boolean(source.isBreaking),
    isTrending: Boolean(source.isTrending),
    seo: withSeoOgFallback(normalizeSeo(source.seo), image),
    reporterMeta: normalizeReporterMeta(source.reporterMeta),
    copyEditorMeta: normalizeCopyEditorMeta(source.copyEditorMeta),
    savedAt:
      typeof source.savedAt === 'string' && source.savedAt.trim()
        ? source.savedAt
        : new Date().toISOString(),
  };
}

function normalizeStoredArticle(input: unknown): StoredArticle | null {
  const source = typeof input === 'object' && input ? (input as Record<string, unknown>) : null;
  if (!source) return null;

  const title = typeof source.title === 'string' ? source.title : '';
  const summary = typeof source.summary === 'string' ? source.summary : '';
  const content = typeof source.content === 'string' ? source.content : '';
  const image = normalizeMediaUrl(source.image);
  const category = typeof source.category === 'string' ? source.category : '';
  const author = typeof source.author === 'string' ? source.author : '';

  if (!title || !summary || !content || !image || !category || !author) {
    return null;
  }

  const viewsRaw =
    typeof source.views === 'number' ? source.views : Number(source.views);

  const revisions = Array.isArray(source.revisions)
    ? source.revisions
        .map((revision) => normalizeRevision(revision))
        .filter((revision): revision is StoredArticleRevision => Boolean(revision))
        .slice(-MAX_STORED_REVISIONS)
    : [];

  return {
    _id: typeof source._id === 'string' && source._id.trim() ? source._id : createId(),
    title,
    summary,
    content,
    image,
    category,
    author,
    isBreaking: Boolean(source.isBreaking),
    isTrending: Boolean(source.isTrending),
    views: Number.isFinite(viewsRaw) ? viewsRaw : 0,
    publishedAt:
      typeof source.publishedAt === 'string' && source.publishedAt.trim()
        ? source.publishedAt
        : new Date().toISOString(),
    updatedAt:
      typeof source.updatedAt === 'string' && source.updatedAt.trim()
        ? source.updatedAt
        : new Date().toISOString(),
    seo: withSeoOgFallback(normalizeSeo(source.seo), image),
    revisions,
    breakingTts: normalizeBreakingTtsMetadata(source.breakingTts),
    workflow: normalizeWorkflowMeta(source.workflow),
    reporterMeta: normalizeReporterMeta(source.reporterMeta),
    copyEditorMeta: normalizeCopyEditorMeta(source.copyEditorMeta),
    sourceType: normalizeArticleSourceType(source.sourceType),
    sourceStoryId:
      typeof source.sourceStoryId === 'string' ? source.sourceStoryId.trim() : '',
    sourceStoryTitle:
      typeof source.sourceStoryTitle === 'string'
        ? source.sourceStoryTitle.trim()
        : '',
  };
}

function createRevisionSnapshot(article: StoredArticle): StoredArticleRevision {
  return {
    _id: createId(),
    title: article.title,
    summary: article.summary,
    content: article.content,
    image: article.image,
    category: article.category,
    author: article.author,
    isBreaking: article.isBreaking,
    isTrending: article.isTrending,
    seo: article.seo || emptySeo(),
    reporterMeta: article.reporterMeta || createEmptyReporterMeta(),
    copyEditorMeta: article.copyEditorMeta || createEmptyCopyEditorMeta(),
    savedAt: new Date().toISOString(),
  };
}

async function readAllArticles(): Promise<StoredArticle[]> {
  try {
    const raw = await fs.readFile(dataPath, 'utf-8');
    const parsed = JSON.parse(raw || '[]');
    const normalized = Array.isArray(parsed)
      ? parsed
          .map((item) => normalizeStoredArticle(item))
          .filter((item): item is StoredArticle => Boolean(item))
      : [];
    return normalized;
  } catch {
    return [];
  }
}

async function writeAllArticles(articles: StoredArticle[]) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataPath, JSON.stringify(articles, null, 2), 'utf-8');
}

export async function listStoredArticles(params: {
  category?: string | null;
  limit: number;
  page: number;
}) {
  const { category, limit, page } = params;
  const all = await readAllArticles();

  let filtered = all;
  if (category && category !== 'all') {
    filtered = filtered.filter((item) => item.category === category);
  }

  filtered.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const start = (page - 1) * limit;
  const data = filtered.slice(start, start + limit);

  return { data, total: filtered.length };
}

export async function listAllStoredArticles() {
  return readAllArticles();
}

export async function getStoredArticleById(id: string) {
  const all = await readAllArticles();
  return all.find((item) => item._id === id) || null;
}

export async function findStoredArticleBySourceStoryId(sourceStoryId: string) {
  const normalized = sourceStoryId.trim();
  if (!normalized) return null;

  const all = await readAllArticles();
  return all.find((item) => item.sourceStoryId === normalized) || null;
}

export async function listStoredArticleRevisions(id: string) {
  const article = await getStoredArticleById(id);
  if (!article) return null;

  return [...article.revisions].sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );
}

export async function createStoredArticle(input: CreateArticleInput) {
  const now = new Date().toISOString();
  const all = await readAllArticles();

  const article: StoredArticle = {
    _id: createId(),
    title: input.title,
    summary: input.summary,
    content: input.content,
    image: normalizeMediaUrl(input.image),
    category: input.category,
    author: input.author,
    isBreaking: Boolean(input.isBreaking),
    isTrending: Boolean(input.isTrending),
    views: 0,
    publishedAt: now,
    updatedAt: now,
    seo: withSeoOgFallback(normalizeSeo(input.seo), normalizeMediaUrl(input.image)),
    revisions: [],
    breakingTts: null,
    workflow: normalizeWorkflowMeta(input.workflow),
    reporterMeta: normalizeReporterMeta(input.reporterMeta),
    copyEditorMeta: normalizeCopyEditorMeta(input.copyEditorMeta),
    sourceType: normalizeArticleSourceType(input.sourceType),
    sourceStoryId:
      typeof input.sourceStoryId === 'string' ? input.sourceStoryId.trim() : '',
    sourceStoryTitle:
      typeof input.sourceStoryTitle === 'string'
        ? input.sourceStoryTitle.trim()
        : '',
  };

  all.push(article);
  await writeAllArticles(all);
  return article;
}

export async function updateStoredArticle(
  id: string,
  updates: UpdateArticleInput,
  options?: {
    skipRevision?: boolean;
  }
) {
  const all = await readAllArticles();
  const index = all.findIndex((item) => item._id === id);
  if (index === -1) return null;

  const current = all[index];
  const nextSeo =
    updates.seo !== undefined
      ? normalizeSeo({ ...current.seo, ...updates.seo })
      : current.seo;

  const nextImage =
    updates.image !== undefined
      ? normalizeMediaUrl(updates.image)
      : current.image;

  const next: StoredArticle = {
    ...current,
    ...updates,
    image: nextImage,
    seo: withSeoOgFallback(nextSeo, nextImage),
    isBreaking:
      updates.isBreaking !== undefined ? updates.isBreaking : current.isBreaking,
    isTrending:
      updates.isTrending !== undefined ? updates.isTrending : current.isTrending,
    updatedAt: new Date().toISOString(),
    workflow:
      updates.workflow !== undefined
        ? normalizeWorkflowMeta({ ...current.workflow, ...updates.workflow })
        : current.workflow,
    reporterMeta:
      updates.reporterMeta !== undefined
        ? normalizeReporterMeta({ ...current.reporterMeta, ...updates.reporterMeta })
        : current.reporterMeta,
    copyEditorMeta:
      updates.copyEditorMeta !== undefined
        ? normalizeCopyEditorMeta({
            ...current.copyEditorMeta,
            ...updates.copyEditorMeta,
          })
        : current.copyEditorMeta,
    sourceType:
      updates.sourceType !== undefined
        ? normalizeArticleSourceType(updates.sourceType)
        : current.sourceType,
    sourceStoryId:
      typeof updates.sourceStoryId === 'string'
        ? updates.sourceStoryId.trim()
        : current.sourceStoryId,
    sourceStoryTitle:
      typeof updates.sourceStoryTitle === 'string'
        ? updates.sourceStoryTitle.trim()
        : current.sourceStoryTitle,
  };

  const hasContentChange =
    current.title !== next.title ||
    current.summary !== next.summary ||
    current.content !== next.content ||
    current.image !== next.image ||
    current.category !== next.category ||
    current.author !== next.author ||
    current.isBreaking !== next.isBreaking ||
    current.isTrending !== next.isTrending ||
    current.seo.metaTitle !== next.seo.metaTitle ||
    current.seo.metaDescription !== next.seo.metaDescription ||
    current.seo.ogImage !== next.seo.ogImage ||
    current.seo.canonicalUrl !== next.seo.canonicalUrl ||
    current.reporterMeta.locationTag !== next.reporterMeta.locationTag ||
    current.reporterMeta.sourceInfo !== next.reporterMeta.sourceInfo ||
    current.reporterMeta.sourceConfidential !== next.reporterMeta.sourceConfidential ||
    current.reporterMeta.reporterNotes !== next.reporterMeta.reporterNotes ||
    current.copyEditorMeta.proofreadComplete !== next.copyEditorMeta.proofreadComplete ||
    current.copyEditorMeta.factCheckStatus !== next.copyEditorMeta.factCheckStatus ||
    current.copyEditorMeta.headlineStatus !== next.copyEditorMeta.headlineStatus ||
    current.copyEditorMeta.imageOptimizationStatus !== next.copyEditorMeta.imageOptimizationStatus ||
    current.copyEditorMeta.copyEditorNotes !== next.copyEditorMeta.copyEditorNotes ||
    current.copyEditorMeta.returnForChangesReason !==
      next.copyEditorMeta.returnForChangesReason;

  if (hasContentChange && !options?.skipRevision) {
    const snapshot = createRevisionSnapshot(current);
    next.revisions = [...current.revisions, snapshot].slice(-MAX_STORED_REVISIONS);
  } else {
    next.revisions = current.revisions;
  }

  all[index] = next;
  await writeAllArticles(all);
  return next;
}

export async function restoreStoredArticleRevision(
  id: string,
  revisionId: string
) {
  const all = await readAllArticles();
  const index = all.findIndex((item) => item._id === id);
  if (index === -1) return null;

  const current = all[index];
  const revision = current.revisions.find((item) => item._id === revisionId);
  if (!revision) return null;

  const snapshot = createRevisionSnapshot(current);
  const restored: StoredArticle = {
    ...current,
    title: revision.title,
    summary: revision.summary,
    content: revision.content,
    image: revision.image,
    category: revision.category,
    author: revision.author,
    isBreaking: revision.isBreaking,
    isTrending: revision.isTrending,
    seo: normalizeSeo(revision.seo),
    reporterMeta: normalizeReporterMeta(revision.reporterMeta),
    copyEditorMeta: normalizeCopyEditorMeta(revision.copyEditorMeta),
    updatedAt: new Date().toISOString(),
    revisions: [...current.revisions, snapshot].slice(-MAX_STORED_REVISIONS),
  };

  all[index] = restored;
  await writeAllArticles(all);
  return restored;
}

export async function deleteStoredArticle(id: string) {
  const all = await readAllArticles();
  const index = all.findIndex((item) => item._id === id);
  if (index === -1) return false;

  all.splice(index, 1);
  await writeAllArticles(all);
  return true;
}
