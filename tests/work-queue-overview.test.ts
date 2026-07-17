import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEditorialReadiness } from '@/lib/workflow/readiness';

const getAllWorkflowDeskItemsMock = vi.fn();
vi.mock('@/lib/admin/articleWorkflowOverview', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin/articleWorkflowOverview')>('@/lib/admin/articleWorkflowOverview');
  return { ...actual, getAllWorkflowDeskItems: getAllWorkflowDeskItemsMock };
});

const ready = buildEditorialReadiness({ contentType: 'story', title: 'Ready', category: 'Regional', mediaUrl: '/story.jpg' });
const base = {
  publicationType: null,
  version: 1,
  category: 'Regional',
  author: 'Reporter',
  priority: 'normal' as const,
  assignedToId: '', assignedToEmail: '', assignedToName: '',
  createdById: 'reporter-1', createdByEmail: 'reporter@example.com', createdByName: 'Reporter',
  dueAt: null, scheduledFor: null, commentsCount: 0, readiness: ready,
  deskHref: '/admin/work', reporterSummary: null, copyEditorSummary: null,
};

describe('normalized work queue overview', () => {
  beforeEach(() => {
    getAllWorkflowDeskItemsMock.mockResolvedValue([
      { ...base, contentType: 'story', id: 'mine', title: 'My story', status: 'changes_requested', assignedToId: 'reporter-1', editHref: '/admin/stories/mine/edit', updatedAt: '2026-07-16T08:00:00Z' },
      { ...base, contentType: 'article', id: 'my-article', title: 'My article handoff', status: 'submitted', editHref: '/admin/articles/my-article/edit', updatedAt: '2026-07-16T08:30:00Z' },
      { ...base, contentType: 'article', id: 'approval', title: 'Approval item', status: 'ready_for_approval', createdById: 'copy-1', createdByEmail: 'copy@example.com', editHref: '/admin/articles/approval/edit', updatedAt: '2026-07-16T09:00:00Z' },
      { ...base, contentType: 'video', id: 'overdue', title: 'Overdue video', status: 'assigned', dueAt: '2020-01-01T00:00:00Z', assignedToId: 'copy-1', assignedToEmail: 'copy@example.com', editHref: '/admin/videos/overdue/edit', updatedAt: '2026-07-15T09:00:00Z' },
      { ...base, contentType: 'article', id: 'breaking', title: 'Breaking article', status: 'copy_edit', priority: 'normal', isBreaking: true, createdById: 'copy-1', createdByEmail: 'copy@example.com', assignedToId: 'copy-1', editHref: '/admin/articles/breaking/edit', updatedAt: '2026-07-14T09:00:00Z' },
    ]);
  });

  it('returns role-aware view counts and URL-filtered views for an admin', async () => {
    const { getWorkQueueOverview } = await import('@/lib/admin/workQueue');
    const admin = { id: 'admin-1', email: 'desk@example.com', name: 'Desk', role: 'admin' as const };
    const overview = await getWorkQueueOverview(admin, { view: 'approval' });
    expect(overview.items.map((item) => item.id)).toEqual(['approval']);
    expect(overview.viewCounts.approval).toBe(1);
    expect(overview.viewCounts.overdue).toBe(1);
    expect(overview.viewCounts.unassigned).toBe(2);
    const all = await getWorkQueueOverview(admin, { view: 'all' });
    expect(all.items.find((item) => item.id === 'breaking')?.availableActions).toContain('fast_publish');
  });

  it('does not expose other desks records to a reporter', async () => {
    const { getWorkQueueOverview } = await import('@/lib/admin/workQueue');
    const reporter = { id: 'reporter-1', email: 'reporter@example.com', name: 'Reporter', role: 'reporter' as const };
    const overview = await getWorkQueueOverview(reporter, { view: 'all' });
    expect(overview.items.map((item) => item.id)).toEqual(['my-article', 'mine']);
  });
});
