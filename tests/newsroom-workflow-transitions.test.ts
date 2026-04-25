import { describe, expect, it } from 'vitest';
import {
  canTransitionWorkflow,
  getAllowedWorkflowTransitions,
  getWorkflowTransitionRequirements,
} from '@/lib/workflow/transitions';

describe('newsroom workflow transitions', () => {
  it('supports the new copy-desk handoff states', () => {
    expect(getAllowedWorkflowTransitions('assigned')).toContain('assigned');
    expect(getAllowedWorkflowTransitions('submitted')).toContain('in_review');
    expect(getAllowedWorkflowTransitions('in_review')).toContain('assigned');
    expect(getAllowedWorkflowTransitions('copy_edit')).toContain('assigned');
    expect(getAllowedWorkflowTransitions('copy_edit')).toContain('changes_requested');
    expect(getAllowedWorkflowTransitions('copy_edit')).toContain('ready_for_approval');
    expect(getAllowedWorkflowTransitions('changes_requested')).toContain('submitted');
    expect(getAllowedWorkflowTransitions('ready_for_approval')).toContain('approved');
  });

  it('requires a reason when changes are requested', () => {
    expect(canTransitionWorkflow('copy_edit', 'changes_requested')).toBe(true);
    expect(getWorkflowTransitionRequirements('copy_edit', 'changes_requested')).toContain(
      'rejectionReason'
    );
  });

  it('keeps publish behind the approval path', () => {
    expect(canTransitionWorkflow('copy_edit', 'published')).toBe(false);
    expect(canTransitionWorkflow('ready_for_approval', 'published')).toBe(false);
    expect(canTransitionWorkflow('approved', 'published')).toBe(true);
  });
});
