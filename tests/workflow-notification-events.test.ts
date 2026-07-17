import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkflowMeta } from '@/lib/workflow/types';

const createWorkflowNotificationMock = vi.fn();
const connectDBMock = vi.fn();
const leanMock = vi.fn();
const selectMock = vi.fn(() => ({ lean: leanMock }));
const findMock = vi.fn(() => ({ select: selectMock }));

vi.mock('@/lib/storage/workflowNotifications', () => ({ createWorkflowNotification: createWorkflowNotificationMock }));
vi.mock('@/lib/db/mongoose', () => ({ default: connectDBMock }));
vi.mock('@/lib/models/User', () => ({ default: { find: findMock } }));

const admin = { id: 'admin-1', name: 'Desk', email: 'desk@example.com', role: 'admin' as const };
const reporter = { id: 'reporter-1', name: 'Reporter', email: 'reporter@example.com', role: 'reporter' as const };
const copyEditor = { id: 'copy-1', name: 'Copy', email: 'copy@example.com', role: 'copy_editor' as const };

describe('workflow notification recipients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MONGODB_URI;
    createWorkflowNotificationMock.mockImplementation(async (input) => input);
  });

  it('notifies the confirmed assignee with bilingual copy', async () => {
    const { notifyWorkflowEvent } = await import('@/lib/server/workflowNotificationEvents');
    const workflow = createWorkflowMeta({ createdBy: reporter, assignedTo: copyEditor });
    await notifyWorkflowEvent({ contentType: 'story', contentId: 'story-1', title: 'City update', href: '/admin/stories/story-1/edit', action: 'assign', workflow, actor: admin });
    expect(createWorkflowNotificationMock).toHaveBeenCalledOnce();
    expect(createWorkflowNotificationMock).toHaveBeenCalledWith(expect.objectContaining({
      recipientEmail: 'copy@example.com',
      eventType: 'assigned',
      message: expect.stringContaining('assigned'),
      messageHi: expect.any(String),
      href: '/admin/stories/story-1/edit',
    }));
  });

  it('notifies active admins for ready-for-approval handoff and excludes the actor', async () => {
    process.env.MONGODB_URI = 'mongodb://example.test/newsroom';
    leanMock.mockResolvedValue([
      { _id: { toString: () => 'admin-1' }, email: 'desk@example.com' },
      { _id: { toString: () => 'admin-2' }, email: 'chief@example.com' },
    ]);
    const { notifyWorkflowEvent } = await import('@/lib/server/workflowNotificationEvents');
    await notifyWorkflowEvent({ contentType: 'article', contentId: 'article-1', title: 'Approval item', href: '/admin/articles/article-1/edit', action: 'mark_ready_for_approval', workflow: createWorkflowMeta({ createdBy: reporter, assignedTo: copyEditor }), actor: admin });
    expect(findMock).toHaveBeenCalledWith(expect.objectContaining({ isActive: { $ne: false } }));
    expect(createWorkflowNotificationMock).toHaveBeenCalledOnce();
    expect(createWorkflowNotificationMock).toHaveBeenCalledWith(expect.objectContaining({ recipientEmail: 'chief@example.com', eventType: 'ready_for_approval' }));
  });
});
