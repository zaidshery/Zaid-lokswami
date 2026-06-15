import type { AdminRole } from '@/lib/auth/roles';

export const WORKFLOW_CONTENT_TYPES = [
  'article',
  'story',
  'video',
  'epaper',
  'epaperArticle',
] as const;

export const WORKFLOW_STATUSES = [
  'draft',
  'submitted',
  'assigned',
  'in_review',
  'copy_edit',
  'changes_requested',
  'ready_for_approval',
  'approved',
  'scheduled',
  'published',
  'rejected',
  'archived',
] as const;

export const WORKFLOW_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export const WORKFLOW_COMMENT_KINDS = [
  'comment',
  'revision_request',
  'approval_note',
  'rejection_note',
] as const;

export const EPAPER_PRODUCTION_STATUSES = [
  'draft_upload',
  'pages_ready',
  'ocr_review',
  'hotspot_mapping',
  'qa_review',
  'ready_to_publish',
  'published',
  'archived',
] as const;

export type WorkflowContentType = (typeof WORKFLOW_CONTENT_TYPES)[number];
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];
export type WorkflowPriority = (typeof WORKFLOW_PRIORITIES)[number];
export type WorkflowCommentKind = (typeof WORKFLOW_COMMENT_KINDS)[number];
export type EPaperProductionStatus = (typeof EPAPER_PRODUCTION_STATUSES)[number];
export type ContentActivityStatus = WorkflowStatus | EPaperProductionStatus;

export type WorkflowTransitionRequirement =
  | 'assignedTo'
  | 'rejectionReason'
  | 'scheduledFor';

export type WorkflowActorRef = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
};

export type WorkflowComment = {
  id: string;
  body: string;
  kind: WorkflowCommentKind;
  author: WorkflowActorRef;
  createdAt: Date;
};

export type WorkflowMeta = {
  status: WorkflowStatus;
  priority: WorkflowPriority;
  createdBy: WorkflowActorRef | null;
  assignedTo: WorkflowActorRef | null;
  reviewedBy: WorkflowActorRef | null;
  submittedAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  publishedAt: Date | null;
  scheduledFor: Date | null;
  dueAt: Date | null;
  rejectionReason: string;
  comments: WorkflowComment[];
};

const workflowStatusSet = new Set<string>(WORKFLOW_STATUSES);
const workflowPrioritySet = new Set<string>(WORKFLOW_PRIORITIES);
const workflowCommentKindSet = new Set<string>(WORKFLOW_COMMENT_KINDS);
const epaperProductionStatusSet = new Set<string>(EPAPER_PRODUCTION_STATUSES);

export function isWorkflowStatus(value: unknown): value is WorkflowStatus {
  return typeof value === 'string' && workflowStatusSet.has(value);
}

export function isWorkflowPriority(value: unknown): value is WorkflowPriority {
  return typeof value === 'string' && workflowPrioritySet.has(value);
}

export function isWorkflowCommentKind(value: unknown): value is WorkflowCommentKind {
  return typeof value === 'string' && workflowCommentKindSet.has(value);
}

export function isEpaperProductionStatus(
  value: unknown
): value is EPaperProductionStatus {
  return typeof value === 'string' && epaperProductionStatusSet.has(value);
}

export function createWorkflowMeta(
  overrides: Partial<WorkflowMeta> = {}
): WorkflowMeta {
  return {
    status: overrides.status ?? 'draft',
    priority: overrides.priority ?? 'normal',
    createdBy: overrides.createdBy ?? null,
    assignedTo: overrides.assignedTo ?? null,
    reviewedBy: overrides.reviewedBy ?? null,
    submittedAt: overrides.submittedAt ?? null,
    approvedAt: overrides.approvedAt ?? null,
    rejectedAt: overrides.rejectedAt ?? null,
    publishedAt: overrides.publishedAt ?? null,
    scheduledFor: overrides.scheduledFor ?? null,
    dueAt: overrides.dueAt ?? null,
    rejectionReason: overrides.rejectionReason ?? '',
    comments: overrides.comments ?? [],
  };
}
