import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
}));

vi.mock('@/lib/auth/admin', () => ({ getAdminSessionFromReq: mocks.session }));
vi.mock('@/lib/pankhida/storage', () => ({
  readPankhidaConfig: mocks.read,
  writePankhidaConfig: mocks.write,
}));

const url = 'http://localhost/api/admin/pankhida';
const admin = { id: 'admin-1', role: 'admin' };
const reporter = { id: 'reporter-1', role: 'reporter' };

describe('Pankhida 2026 CMS settings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue(admin);
    mocks.read.mockResolvedValue({ status: 'upcoming', youtubeUrl: '', description: '', updatedAt: '' });
    mocks.write.mockImplementation(async (value) => value);
  });

  it('restricts reading and writing to newsroom settings managers', async () => {
    const route = await import('@/app/api/admin/pankhida/route');
    mocks.session.mockResolvedValueOnce(null);
    expect((await route.GET(new NextRequest(url))).status).toBe(401);
    mocks.session.mockResolvedValue(reporter);
    expect((await route.GET(new NextRequest(url))).status).toBe(403);
    expect((await route.PUT(new NextRequest(url, { method: 'PUT', body: '{}' }))).status).toBe(403);
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it('rejects live mode without a valid YouTube URL', async () => {
    const route = await import('@/app/api/admin/pankhida/route');
    const response = await route.PUT(new NextRequest(url, {
      method: 'PUT',
      body: JSON.stringify({ status: 'live', youtubeUrl: 'https://example.com/live/dQw4w9WgXcQ' }),
    }));
    expect(response.status).toBe(400);
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it('saves a valid stream for the public event page', async () => {
    const route = await import('@/app/api/admin/pankhida/route');
    const response = await route.PUT(new NextRequest(url, {
      method: 'PUT',
      body: JSON.stringify({ status: 'live', youtubeUrl: 'https://youtube.com/live/dQw4w9WgXcQ', description: 'Event coverage' }),
    }));
    expect(response.status).toBe(200);
    expect(mocks.write).toHaveBeenCalledWith(expect.objectContaining({ status: 'live', description: 'Event coverage' }));
  });
});
