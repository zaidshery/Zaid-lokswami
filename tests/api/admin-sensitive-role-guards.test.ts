import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAdminSession: vi.fn(),
  getAdminSessionFromReq: vi.fn(),
}));

vi.mock('@/lib/auth/admin', () => ({
  getAdminSession: mocks.getAdminSession,
  getAdminSessionFromReq: mocks.getAdminSessionFromReq,
}));

vi.mock('@/lib/db/mongoose', () => ({ default: vi.fn() }));
vi.mock('@/lib/models/ContactMessage', () => ({ default: {} }));
vi.mock('@/lib/storage/contactMessagesFile', () => ({
  listStoredContactMessages: vi.fn(),
  getStoredContactMessageById: vi.fn(),
  updateStoredContactMessageWorkflow: vi.fn(),
}));

const reporter = {
  id: 'reporter-1',
  email: 'reporter@example.com',
  name: 'Reporter',
  username: 'reporter@example.com',
  role: 'reporter' as const,
};

describe('sensitive admin API role guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAdminSession.mockResolvedValue(reporter);
    mocks.getAdminSessionFromReq.mockResolvedValue(reporter);
  });

  it('prevents reporters from reading or changing contact inbox PII', async () => {
    const listRoute = await import('@/app/api/admin/contact-messages/route');
    const itemRoute = await import('@/app/api/admin/contact-messages/[id]/route');

    const listResponse = await listRoute.GET(
      new NextRequest('http://localhost/api/admin/contact-messages')
    );
    const detailResponse = await itemRoute.GET(
      new NextRequest('http://localhost/api/admin/contact-messages/contact-1')
    );
    const updateResponse = await itemRoute.PATCH(
      new NextRequest('http://localhost/api/admin/contact-messages/contact-1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'resolved' }),
        headers: { 'content-type': 'application/json' },
      })
    );

    expect(listResponse.status).toBe(403);
    expect(detailResponse.status).toBe(403);
    expect(updateResponse.status).toBe(403);
  });

  it('prevents reporters from changing election results or graphics', async () => {
    const resultsRoute = await import('@/app/api/admin/elections/results/route');
    const uploadRoute = await import('@/app/api/admin/elections/upload/route');
    const deleteRoute = await import('@/app/api/admin/elections/delete/route');

    const resultsRead = await resultsRoute.GET(
      new NextRequest('http://localhost/api/admin/elections/results')
    );
    const resultsWrite = await resultsRoute.POST(
      new NextRequest('http://localhost/api/admin/elections/results', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      })
    );
    const graphicUpload = await uploadRoute.POST(
      new NextRequest('http://localhost/api/admin/elections/upload', { method: 'POST' })
    );
    const graphicDelete = await deleteRoute.DELETE(
      new NextRequest('http://localhost/api/admin/elections/delete', {
        method: 'DELETE',
        body: JSON.stringify({ stateId: 'wb' }),
        headers: { 'content-type': 'application/json' },
      })
    );

    expect(resultsRead.status).toBe(403);
    expect(resultsWrite.status).toBe(403);
    expect(graphicUpload.status).toBe(403);
    expect(graphicDelete.status).toBe(403);
  });
});
