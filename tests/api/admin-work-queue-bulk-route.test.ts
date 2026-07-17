import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminSessionMock = vi.fn();
const dispatchWorkQueueCommandMock = vi.fn();
vi.mock('@/lib/auth/admin', () => ({ getAdminSession: getAdminSessionMock }));
vi.mock('@/lib/server/workQueueCommands', () => ({ dispatchWorkQueueCommand: dispatchWorkQueueCommandMock }));

describe('PATCH /api/admin/work-queue/bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminSessionMock.mockResolvedValue({ id: 'admin-1', email: 'desk@example.com', name: 'Desk', role: 'admin' });
  });

  it('returns per-item mixed success and conflict results', async () => {
    dispatchWorkQueueCommandMock
      .mockResolvedValueOnce(Response.json({ success: true }, { status: 200 }))
      .mockResolvedValueOnce(Response.json({ success: false, error: 'This item changed. Refresh and retry.' }, { status: 409 }));
    const { PATCH } = await import('@/app/api/admin/work-queue/bulk/route');
    const response = await PATCH(new Request('http://localhost/api/admin/work-queue/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignedToId: 'copy-1',
        priority: 'high',
        items: [
          { contentType: 'article', id: 'a1', expectedVersion: 2 },
          { contentType: 'story', id: 's1', expectedVersion: 5 },
        ],
      }),
    }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ success: false, partial: true, data: { succeeded: 1, failed: 1 } });
    expect(payload.data.results).toEqual([
      expect.objectContaining({ id: 'a1', success: true, status: 200 }),
      expect.objectContaining({ id: 's1', success: false, status: 409, error: expect.stringContaining('Refresh') }),
    ]);
  });
});
