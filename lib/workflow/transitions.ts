import type {
  EPaperProductionStatus,
  WorkflowStatus,
  WorkflowTransitionRequirement,
} from '@/lib/workflow/types';

const WORKFLOW_TRANSITIONS: Record<WorkflowStatus, readonly WorkflowStatus[]> = {
  draft: ['submitted', 'archived'],
  submitted: ['assigned', 'in_review', 'changes_requested', 'rejected'],
  assigned: ['assigned', 'in_review', 'changes_requested', 'rejected'],
  in_review: ['assigned', 'copy_edit', 'ready_for_approval', 'changes_requested', 'rejected'],
  copy_edit: ['assigned', 'ready_for_approval', 'changes_requested', 'rejected'],
  changes_requested: ['submitted', 'archived'],
  ready_for_approval: ['assigned', 'approved', 'changes_requested', 'rejected'],
  approved: ['scheduled', 'published'],
  scheduled: ['published', 'draft'],
  published: ['archived', 'draft'],
  rejected: ['draft', 'submitted'],
  archived: [],
};

const EPAPER_PRODUCTION_TRANSITIONS: Record<
  EPaperProductionStatus,
  readonly EPaperProductionStatus[]
> = {
  draft_upload: ['pages_ready'],
  pages_ready: ['ocr_review'],
  ocr_review: ['hotspot_mapping'],
  hotspot_mapping: ['qa_review'],
  qa_review: ['ready_to_publish'],
  ready_to_publish: ['published'],
  published: ['archived'],
  archived: [],
};

export function getAllowedWorkflowTransitions(
  status: WorkflowStatus
): readonly WorkflowStatus[] {
  return WORKFLOW_TRANSITIONS[status];
}

export function canTransitionWorkflow(
  fromStatus: WorkflowStatus,
  toStatus: WorkflowStatus
): boolean {
  return WORKFLOW_TRANSITIONS[fromStatus].includes(toStatus);
}

export function getWorkflowTransitionRequirements(
  fromStatus: WorkflowStatus,
  toStatus: WorkflowStatus
): readonly WorkflowTransitionRequirement[] {
  if (!canTransitionWorkflow(fromStatus, toStatus)) {
    return [];
  }

  switch (toStatus) {
    case 'assigned':
      return ['assignedTo'];
    case 'changes_requested':
    case 'rejected':
      return ['rejectionReason'];
    case 'scheduled':
      return ['scheduledFor'];
    default:
      return [];
  }
}

export function isTerminalWorkflowStatus(status: WorkflowStatus): boolean {
  return status === 'published' || status === 'archived';
}

export function getAllowedEpaperProductionTransitions(
  status: EPaperProductionStatus
): readonly EPaperProductionStatus[] {
  return EPAPER_PRODUCTION_TRANSITIONS[status];
}

export function canTransitionEpaperProduction(
  fromStatus: EPaperProductionStatus,
  toStatus: EPaperProductionStatus
): boolean {
  return EPAPER_PRODUCTION_TRANSITIONS[fromStatus].includes(toStatus);
}

export function isTerminalEpaperProductionStatus(
  status: EPaperProductionStatus
): boolean {
  return status === 'published' || status === 'archived';
}
