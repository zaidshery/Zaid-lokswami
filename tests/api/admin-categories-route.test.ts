import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminSessionFromReqMock = vi.fn();
const connectDBMock = vi.fn();

const findOneMock = vi.fn();
const saveMock = vi.fn();
const CategoryMock = vi.fn().mockImplementation(() => ({
  save: saveMock,
}));

Object.assign(CategoryMock, {
  findOne: findOneMock,
});

vi.mock('@/lib/auth/admin', () => ({
  getAdminSessionFromReq: getAdminSessionFromReqMock,
}));

vi.mock('@/lib/db/mongoose', () => ({
  default: connectDBMock,
}));

vi.mock('@/lib/models/Category', () => ({
  default: CategoryMock,
}));

describe('/api/admin/categories POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MONGODB_URI = 'mongodb://example.com/test';
    connectDBMock.mockResolvedValue(undefined);
  });

  it('prevents reporters from creating categories', async () => {
    getAdminSessionFromReqMock.mockResolvedValue({
      id: 'reporter-1',
      email: 'reporter@example.com',
      name: 'Reporter',
      role: 'reporter',
    });

    const { POST } = await import('@/app/api/admin/categories/route');
    const response = await POST(
      new Request('http://localhost/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Investigations' }),
      }) as unknown as NextRequest
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({
      success: false,
      error: 'Forbidden',
    });
    expect(connectDBMock).not.toHaveBeenCalled();
    expect(findOneMock).not.toHaveBeenCalled();
    expect(CategoryMock).not.toHaveBeenCalled();
    expect(saveMock).not.toHaveBeenCalled();
  });
});
