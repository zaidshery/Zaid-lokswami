import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminSessionFromReqMock = vi.fn();

vi.mock('@/lib/auth/admin', () => ({
  getAdminSessionFromReq: getAdminSessionFromReqMock,
}));

describe('/api/admin/articles/assist route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no admin session exists', async () => {
    getAdminSessionFromReqMock.mockResolvedValue(null);

    const { POST } = await import('@/app/api/admin/articles/assist/route');
    const response = await POST(
      new Request('http://localhost/api/admin/articles/assist', {
        method: 'POST',
        body: JSON.stringify({}),
      }) as unknown as NextRequest
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns 403 for roles without article access', async () => {
    getAdminSessionFromReqMock.mockResolvedValue({
      id: 'reporter-1',
      email: 'reporter@example.com',
      name: 'Reporter',
      role: 'reporter',
    });

    const { POST } = await import('@/app/api/admin/articles/assist/route');
    const response = await POST(
      new Request('http://localhost/api/admin/articles/assist', {
        method: 'POST',
        body: JSON.stringify({ title: 'Story' }),
      }) as unknown as NextRequest
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ success: false, error: 'Forbidden' });
  });

  it('returns suggestions, readiness, and patches for valid create payloads', async () => {
    getAdminSessionFromReqMock.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
    });

    const { POST } = await import('@/app/api/admin/articles/assist/route');
    const response = await POST(
      new Request('http://localhost/api/admin/articles/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'create',
          title: 'Indore metro airport route update',
          summary: '',
          content: '<p>Indore metro work near the airport route has a new traffic plan.</p>',
          category: 'City',
          author: 'Desk',
          image: '/uploads/metro.jpg',
          seo: {},
        }),
      }) as unknown as NextRequest
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual({
      suggestions: expect.any(Array),
      readiness: expect.objectContaining({
        score: expect.any(Number),
        items: expect.any(Array),
      }),
      patches: expect.arrayContaining([
        expect.objectContaining({
          field: 'seoSlug',
          currentValue: '',
          suggestedValue: 'indore-metro-airport-route-update',
        }),
      ]),
    });
  });

  it('returns 400 for malformed request bodies', async () => {
    getAdminSessionFromReqMock.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
    });

    const { POST } = await import('@/app/api/admin/articles/assist/route');
    const response = await POST(
      new Request('http://localhost/api/admin/articles/assist', {
        method: 'POST',
        body: 'not-json',
      }) as unknown as NextRequest
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
  });
});
