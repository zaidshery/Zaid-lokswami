import type { AdminRole } from '@/lib/auth/roles';
import type { WorkflowMeta } from '@/lib/workflow/types';

export function validateFastPublish(input: {
  role: AdminRole;
  workflow: WorkflowMeta;
  isBreaking?: boolean;
  reason?: unknown;
}) {
  if (input.role !== 'admin' && input.role !== 'super_admin') {
    return 'Only an admin can use urgent publishing.';
  }
  if (input.workflow.status === 'published' || input.workflow.status === 'archived') {
    return 'This item cannot use urgent publishing from its current state.';
  }
  if (input.workflow.priority !== 'urgent' && !input.isBreaking) {
    return 'Urgent publishing requires urgent priority or an approved breaking-news flag.';
  }
  if (typeof input.reason !== 'string' || input.reason.trim().length < 10) {
    return 'Add an urgent-publish reason of at least 10 characters.';
  }
  return null;
}
