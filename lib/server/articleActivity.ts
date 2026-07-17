import 'server-only';

import type { AdminSessionIdentity } from '@/lib/auth/admin';
import type { WorkflowActorRef, WorkflowStatus } from '@/lib/workflow/types';
import { resolveArticleWorkflow } from '@/lib/workflow/article';
import {
  listContentActivity,
  recordContentActivity,
  type ContentActivityActor,
  type ContentActivityItem,
} from '@/lib/server/contentActivity';

type ArticleActivitySource = {
  _id?: unknown;
  title?: unknown;
  author?: unknown;
  publishedAt?: unknown;
  updatedAt?: unknown;
  workflow?: unknown;
  revisions?: unknown[];
};

type BuildArticleActivityMessageInput = {
  action: string;
  toStatus?: WorkflowStatus | null;
  assignedTo?: WorkflowActorRef | null;
  rejectionReason?: string | null;
};

function parseDate(value: unknown) {
  if (!value) return null;

  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toSerializableActor(actor: WorkflowActorRef | null | undefined): ContentActivityActor | null {
  if (!actor?.id && !actor?.name && !actor?.email) {
    return null;
  }

  return {
    id: actor?.id || '',
    name: actor?.name || '',
    email: actor?.email || '',
    role: actor?.role || null,
  };
}

function createDerivedActivity(
  input: Omit<ContentActivityItem, 'source'>
): ContentActivityItem {
  return {
    ...input,
    source: 'derived',
  };
}

export function buildArticleActivityMessage(input: BuildArticleActivityMessageInput) {
  switch (input.action) {
    case 'created':
      if (input.toStatus === 'submitted') return 'Article created and submitted for review.';
      if (input.toStatus === 'published') return 'Article created and published.';
      return 'Article draft created.';
    case 'saved':
      return 'Article content updated.';
    case 'submit':
      return 'Article submitted for review.';
    case 'assign':
      return input.assignedTo?.name
        ? `Article assigned to ${input.assignedTo.name}.`
        : 'Article assigned to the desk.';
    case 'start_review':
      return 'Editorial review started.';
    case 'move_to_copy_edit':
      return 'Article moved to copy edit.';
    case 'request_changes':
      return input.rejectionReason?.trim()
        ? `Changes requested: ${input.rejectionReason.trim()}`
        : 'Article returned for reporting or desk changes.';
    case 'mark_ready_for_approval':
      return 'Article marked ready for admin approval.';
    case 'approve':
      return 'Article approved for publish.';
    case 'reject':
      return input.rejectionReason?.trim()
        ? `Article rejected: ${input.rejectionReason.trim()}`
        : 'Article rejected and returned for changes.';
    case 'schedule':
      return 'Article scheduled for publish.';
    case 'publish':
      return 'Article published.';
    case 'fast_publish':
      return 'Article urgently published with an audited desk exception.';
    case 'archive':
      return 'Article archived.';
    case 'restore_revision':
      return 'Revision restored.';
    default:
      return 'Article activity recorded.';
  }
}

export async function recordArticleActivity(input: {
  articleId: string;
  actor?: Pick<AdminSessionIdentity, 'id' | 'name' | 'email' | 'role'> | null;
  action: string;
  fromStatus?: WorkflowStatus | null;
  toStatus?: WorkflowStatus | null;
  message?: string;
  metadata?: Record<string, unknown>;
}) {
  await recordContentActivity({
    contentType: 'article',
    contentId: input.articleId,
    action: input.action,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    actor: input.actor,
    message: input.message,
    metadata: input.metadata,
  });
}

export function deriveArticleActivity(
  article: ArticleActivitySource | null | undefined,
  limit = 40
) {
  if (!article) {
    return [] as ContentActivityItem[];
  }

  const articleId = String(article._id || '').trim();
  const workflow = resolveArticleWorkflow(article);
  const timeline: ContentActivityItem[] = [];
  const seen = new Set<string>();

  const pushIfValid = (entry: Omit<ContentActivityItem, 'source'>) => {
    const createdAt = parseDate(entry.createdAt)?.toISOString();
    if (!createdAt) return;

    const dedupeKey = `${entry.action}:${createdAt}:${entry.message}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    timeline.push(
      createDerivedActivity({
        ...entry,
        createdAt,
      })
    );
  };

  const revisions = Array.isArray(article.revisions) ? article.revisions : [];
  revisions.forEach((revision, index) => {
    const source =
      typeof revision === 'object' && revision ? (revision as Record<string, unknown>) : {};
    const savedAt = parseDate(source.savedAt);
    if (!savedAt) return;

    pushIfValid({
      id:
        (typeof source._id === 'string' && source._id.trim()) ||
        `derived-save-${savedAt.toISOString()}-${index}`,
      contentType: 'article',
      contentId: articleId,
      parentId: '',
      action: 'saved',
      fromStatus: null,
      toStatus: workflow.status,
      actor: null,
      message: 'Revision snapshot saved before changes.',
      metadata: {
        revisionId: String(source._id || '').trim(),
        revisionTitle: String(source.title || '').trim(),
      },
      createdAt: savedAt.toISOString(),
    });
  });

  workflow.comments.forEach((comment, index) => {
    pushIfValid({
      id: comment.id || `derived-comment-${comment.createdAt.toISOString()}-${index}`,
      contentType: 'article',
      contentId: articleId,
      parentId: '',
      action: comment.kind,
      fromStatus: null,
      toStatus: workflow.status,
      actor: toSerializableActor(comment.author),
      message: comment.body,
      metadata: {
        kind: comment.kind,
      },
      createdAt: comment.createdAt.toISOString(),
    });
  });

  if (workflow.submittedAt) {
    pushIfValid({
      id: `derived-submit-${workflow.submittedAt.toISOString()}`,
      contentType: 'article',
      contentId: articleId,
      parentId: '',
      action: 'submit',
      fromStatus: 'draft',
      toStatus: 'submitted',
      actor: toSerializableActor(workflow.createdBy),
      message: buildArticleActivityMessage({ action: 'submit', toStatus: 'submitted' }),
      metadata: {},
      createdAt: workflow.submittedAt.toISOString(),
    });
  }

  if (workflow.approvedAt) {
    pushIfValid({
      id: `derived-approve-${workflow.approvedAt.toISOString()}`,
      contentType: 'article',
      contentId: articleId,
      parentId: '',
      action: 'approve',
      fromStatus: 'ready_for_approval',
      toStatus: 'approved',
      actor: toSerializableActor(workflow.reviewedBy),
      message: buildArticleActivityMessage({ action: 'approve', toStatus: 'approved' }),
      metadata: {},
      createdAt: workflow.approvedAt.toISOString(),
    });
  }

  if (workflow.rejectedAt) {
    pushIfValid({
      id: `derived-reject-${workflow.rejectedAt.toISOString()}`,
      contentType: 'article',
      contentId: articleId,
      parentId: '',
      action: 'reject',
      fromStatus: null,
      toStatus: 'rejected',
      actor: toSerializableActor(workflow.reviewedBy),
      message: buildArticleActivityMessage({
        action: 'reject',
        toStatus: 'rejected',
        rejectionReason: workflow.rejectionReason,
      }),
      metadata: {
        rejectionReason: workflow.rejectionReason,
      },
      createdAt: workflow.rejectedAt.toISOString(),
    });
  }

  if (workflow.publishedAt) {
    pushIfValid({
      id: `derived-publish-${workflow.publishedAt.toISOString()}`,
      contentType: 'article',
      contentId: articleId,
      parentId: '',
      action: 'publish',
      fromStatus: workflow.scheduledFor ? 'scheduled' : 'approved',
      toStatus: 'published',
      actor: null,
      message: buildArticleActivityMessage({ action: 'publish', toStatus: 'published' }),
      metadata: {},
      createdAt: workflow.publishedAt.toISOString(),
    });
  }

  const updatedAt = parseDate(article.updatedAt);
  if (timeline.length === 0 && updatedAt) {
    pushIfValid({
      id: `derived-update-${updatedAt.toISOString()}`,
      contentType: 'article',
      contentId: articleId,
      parentId: '',
      action: 'saved',
      fromStatus: null,
      toStatus: workflow.status,
      actor: null,
      message: 'Article updated.',
      metadata: {},
      createdAt: updatedAt.toISOString(),
    });
  }

  return timeline
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, Math.max(limit, 1));
}

export async function listArticleActivity(input: {
  articleId: string;
  article?: ArticleActivitySource | null;
  limit?: number;
}) {
  const recorded = await listContentActivity({
    contentType: 'article',
    contentId: input.articleId,
    limit: input.limit,
  });

  if (recorded.length > 0) {
    return recorded;
  }

  return deriveArticleActivity(input.article, input.limit);
}
