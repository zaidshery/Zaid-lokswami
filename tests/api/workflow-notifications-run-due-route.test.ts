import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getAllWorkflowDeskItemsMock = vi.fn();
const createWorkflowNotificationMock = vi.fn();
const connectDBMock = vi.fn();
const leanMock = vi.fn();
const selectMock = vi.fn(() => ({ lean: leanMock }));
const findMock = vi.fn(() => ({ select: selectMock }));

vi.mock('@/lib/admin/articleWorkflowOverview', () => ({ getAllWorkflowDeskItems: getAllWorkflowDeskItemsMock }));
vi.mock('@/lib/storage/workflowNotifications', () => ({ createWorkflowNotification: createWorkflowNotificationMock }));
vi.mock('@/lib/db/mongoose', () => ({ default: connectDBMock }));
vi.mock('@/lib/models/User', () => ({ default: { find: findMock } }));

const overdue = {
  contentType: 'article', publicationType: null, id: 'article-1', title: 'Late item', status: 'assigned',
  dueAt: '2020-01-01T00:00:00.000Z', assignedToId: 'copy-1', assignedToEmail: 'copy@example.com',
  editHref: '/admin/articles/article-1/edit',
};

describe('POST workflow overdue notification job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_CRON_SECRET = 'test-cron-secret';
    delete process.env.CRON_SECRET;
    delete process.env.MONGODB_URI;
    getAllWorkflowDeskItemsMock.mockResolvedValue([overdue]);
    createWorkflowNotificationMock.mockImplementation(async (input) => input);
  });

  afterEach(() => {
    delete process.env.ADMIN_CRON_SECRET;
    delete process.env.MONGODB_URI;
  });

  it('protects execution with the shared cron secret', async () => {
    const { POST } = await import('@/app/api/admin/workflow-notifications/jobs/run-due/route');
    const response = await POST(new Request('http://localhost/api/admin/workflow-notifications/jobs/run-due', { method: 'POST', headers: { 'x-cron-secret': 'wrong' } }) as never);
    expect(response.status).toBe(403);
    expect(createWorkflowNotificationMock).not.toHaveBeenCalled();
  });

  it('uses a daily dedupe key and skips inactive Mongo recipients', async () => {
    process.env.MONGODB_URI = 'mongodb://example.test/newsroom';
    leanMock.mockResolvedValue([]);
    const { POST } = await import('@/app/api/admin/workflow-notifications/jobs/run-due/route');
    const inactiveResponse = await POST(new Request('http://localhost/api/admin/workflow-notifications/jobs/run-due', { method: 'POST', headers: { 'x-cron-secret': 'test-cron-secret' } }) as never);
    expect(await inactiveResponse.json()).toMatchObject({ data: { candidates: 1, created: 0, skippedInactive: 1 } });

    delete process.env.MONGODB_URI;
    const activeResponse = await POST(new Request('http://localhost/api/admin/workflow-notifications/jobs/run-due', { method: 'POST', headers: { 'x-cron-secret': 'test-cron-secret' } }) as never);
    expect(activeResponse.status).toBe(200);
    expect(createWorkflowNotificationMock).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'overdue',
      dedupeKey: expect.stringMatching(/^article:article-1:overdue:\d{4}-\d{2}-\d{2}:copy@example\.com$/),
    }));
  });
});
