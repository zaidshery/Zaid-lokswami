import type { AdminSessionIdentity } from '@/lib/auth/admin';
import { canTransitionEpaperProduction } from '@/lib/workflow/transitions';
import {
  createWorkflowMeta,
  isEpaperProductionStatus,
  isWorkflowCommentKind,
  type EPaperProductionStatus,
  type WorkflowActorRef,
  type WorkflowComment,
  type WorkflowMeta,
} from '@/lib/workflow/types';

export type EpaperProductionMeta = {
  productionStatus: EPaperProductionStatus;
  productionAssignee: WorkflowActorRef | null;
  productionNotes: WorkflowComment[];
  qaCompletedAt: Date | null;
};

function parseOptionalDate(value: unknown): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function cryptoRandomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeActorRef(value: unknown): WorkflowActorRef | null {
  const source = typeof value === 'object' && value ? (value as Record<string, unknown>) : null;
  const id = typeof source?.id === 'string' ? source.id.trim() : '';
  const name = typeof source?.name === 'string' ? source.name.trim() : '';
  const email = typeof source?.email === 'string' ? source.email.trim() : '';
  const role = source?.role;

  if (!id || !name || !email || typeof role !== 'string') {
    return null;
  }

  return {
    id,
    name,
    email,
    role: role as WorkflowActorRef['role'],
  };
}

function normalizeNotes(value: unknown): WorkflowComment[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      const source =
        typeof entry === 'object' && entry ? (entry as Record<string, unknown>) : null;
      if (!source) return null;

      const author = normalizeActorRef(source.author);
      const body = typeof source.body === 'string' ? source.body.trim() : '';
      if (!author || !body) return null;

      return {
        id: typeof source.id === 'string' && source.id.trim() ? source.id : cryptoRandomId(),
        body,
        kind: isWorkflowCommentKind(source.kind) ? source.kind : 'comment',
        author,
        createdAt: parseOptionalDate(source.createdAt) ?? new Date(),
      } satisfies WorkflowComment;
    })
    .filter((entry): entry is WorkflowComment => Boolean(entry));
}

function inferFallbackStatus(source: {
  status?: unknown;
  readiness?: {
    status?: unknown;
    pagesMissingImage?: unknown;
    mappedArticles?: unknown;
    articlesWithReadableText?: unknown;
  } | null;
}) {
  if (source.status === 'published') {
    return 'published' as const;
  }

  const readiness = source.readiness;
  if (!readiness) {
    return 'draft_upload' as const;
  }

  if (readiness.status === 'ready') {
    return 'ready_to_publish' as const;
  }

  const pagesMissingImage = Number(readiness.pagesMissingImage || 0);
  const mappedArticles = Number(readiness.mappedArticles || 0);
  const readableArticles = Number(readiness.articlesWithReadableText || 0);

  if (pagesMissingImage > 0) {
    return 'draft_upload' as const;
  }

  if (mappedArticles === 0) {
    return 'pages_ready' as const;
  }

  if (readableArticles < mappedArticles) {
    return 'hotspot_mapping' as const;
  }

  return 'hotspot_mapping' as const;
}

export function toWorkflowActorRef(
  actor: Pick<AdminSessionIdentity, 'id' | 'name' | 'email' | 'role'>
): WorkflowActorRef {
  return {
    id: actor.id,
    name: actor.name,
    email: actor.email,
    role: actor.role,
  };
}

export function resolveEpaperProduction(source: {
  productionStatus?: unknown;
  productionAssignee?: unknown;
  productionNotes?: unknown;
  qaCompletedAt?: unknown;
  status?: unknown;
  readiness?: {
    status?: unknown;
    pagesMissingImage?: unknown;
    mappedArticles?: unknown;
    articlesWithReadableText?: unknown;
  } | null;
}): EpaperProductionMeta {
  const fallbackStatus = inferFallbackStatus({
    status: source.status,
    readiness: source.readiness,
  });

  const storedStatus = isEpaperProductionStatus(source.productionStatus)
    ? source.productionStatus
    : fallbackStatus;

  return {
    productionStatus:
      storedStatus === 'qa_review' ? 'hotspot_mapping' : storedStatus,
    productionAssignee: normalizeActorRef(source.productionAssignee),
    productionNotes: normalizeNotes(source.productionNotes),
    qaCompletedAt: parseOptionalDate(source.qaCompletedAt),
  };
}

export function resolveEpaperArticleWorkflow(source: {
  workflow?: unknown;
  updatedAt?: unknown;
  createdAt?: unknown;
}): WorkflowMeta {
  const workflow =
    typeof source.workflow === 'object' && source.workflow
      ? (source.workflow as Record<string, unknown>)
      : null;

  return createWorkflowMeta({
    ...workflow,
    status: workflow?.status === 'published' ? 'published' : workflow?.status === 'submitted' ? 'submitted' : 'draft',
    priority: workflow?.priority === 'urgent' || workflow?.priority === 'high' || workflow?.priority === 'low'
      ? workflow.priority
      : 'normal',
    createdBy: normalizeActorRef(workflow?.createdBy),
    assignedTo: normalizeActorRef(workflow?.assignedTo),
    reviewedBy: normalizeActorRef(workflow?.reviewedBy),
    submittedAt: parseOptionalDate(workflow?.submittedAt),
    approvedAt: parseOptionalDate(workflow?.approvedAt),
    rejectedAt: parseOptionalDate(workflow?.rejectedAt),
    publishedAt: parseOptionalDate(workflow?.publishedAt),
    scheduledFor: parseOptionalDate(workflow?.scheduledFor),
    dueAt: parseOptionalDate(workflow?.dueAt),
    rejectionReason: typeof workflow?.rejectionReason === 'string' ? workflow.rejectionReason : '',
    comments: normalizeNotes(workflow?.comments),
  });
}

export function applyEpaperProductionUpdate(input: {
  currentProduction: EpaperProductionMeta;
  actor: Pick<AdminSessionIdentity, 'id' | 'name' | 'email' | 'role'>;
  nextStatus?: EPaperProductionStatus;
  assignedTo?: WorkflowActorRef | null;
  note?: string;
}) {
  const actorRef = toWorkflowActorRef(input.actor);
  const fromStatus = input.currentProduction.productionStatus;
  const toStatus = input.nextStatus || fromStatus;

  if (
    input.nextStatus &&
    input.nextStatus !== fromStatus &&
    !canTransitionEpaperProduction(fromStatus, input.nextStatus)
  ) {
    throw new Error(`Cannot move e-paper from ${fromStatus} to ${input.nextStatus}.`);
  }

  const trimmedNote = String(input.note || '').trim();
  const nextNotes = input.currentProduction.productionNotes.slice();
  if (trimmedNote) {
    nextNotes.push({
      id: cryptoRandomId(),
      body: trimmedNote,
      kind:
        fromStatus === 'qa_review' && toStatus === 'hotspot_mapping'
          ? 'revision_request'
          : 'comment',
      author: actorRef,
      createdAt: new Date(),
    });
  }

  return {
    fromStatus,
    toStatus,
    nextProduction: {
      productionStatus: toStatus,
      productionAssignee:
        input.assignedTo !== undefined
          ? input.assignedTo
          : input.currentProduction.productionAssignee,
      productionNotes: nextNotes,
      qaCompletedAt:
        toStatus === 'ready_to_publish'
          ? new Date()
          : toStatus === 'hotspot_mapping'
            ? null
            : input.currentProduction.qaCompletedAt,
    } satisfies EpaperProductionMeta,
  };
}
