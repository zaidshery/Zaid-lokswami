import { describe, expect, it } from 'vitest';
import { validateFastPublish } from '@/lib/workflow/fastPublish';
import { applyArticleWorkflowAction } from '@/lib/workflow/article';
import { createWorkflowMeta } from '@/lib/workflow/types';

const actor = { id: 'admin-1', name: 'Admin Desk', email: 'desk@example.com', role: 'admin' as const };

describe('audited urgent publishing exception', () => {
  it('requires admin authority, urgent or breaking context, and a written reason', () => {
    const workflow = createWorkflowMeta({ status: 'copy_edit', priority: 'normal' });
    expect(validateFastPublish({ role: 'copy_editor', workflow, isBreaking: true, reason: 'Confirmed urgent desk reason' })).toContain('Only an admin');
    expect(validateFastPublish({ role: 'admin', workflow, reason: 'Confirmed urgent desk reason' })).toContain('urgent priority');
    expect(validateFastPublish({ role: 'admin', workflow: createWorkflowMeta({ priority: 'urgent' }), reason: 'short' })).toContain('at least 10');
    expect(validateFastPublish({ role: 'admin', workflow, isBreaking: true, reason: 'Confirmed urgent desk reason' })).toBeNull();
  });

  it('publishes from a nonstandard editorial state and records the exception reason', () => {
    const currentWorkflow = createWorkflowMeta({ status: 'copy_edit', priority: 'urgent', scheduledFor: new Date() });
    const result = applyArticleWorkflowAction({
      action: 'fast_publish',
      actor,
      currentWorkflow,
      comment: 'Breaking public-safety update approved by desk.',
    });
    expect(result.toStatus).toBe('published');
    expect(result.nextWorkflow.publishedAt).toBeInstanceOf(Date);
    expect(result.nextWorkflow.approvedAt).toBeInstanceOf(Date);
    expect(result.nextWorkflow.scheduledFor).toBeNull();
    expect(result.nextWorkflow.comments.at(-1)).toMatchObject({
      body: 'Breaking public-safety update approved by desk.',
      kind: 'approval_note',
    });
  });
});
