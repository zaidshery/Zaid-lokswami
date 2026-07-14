import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminSessionFromReqMock = vi.fn();
const connectDBMock = vi.fn();
const contactAggregateMock = vi.fn();
const advertiseAggregateMock = vi.fn();
const articleFindMock = vi.fn();
const articleLeanMock = vi.fn();

vi.mock('@/lib/auth/admin', () => ({
  getAdminSessionFromReq: getAdminSessionFromReqMock,
}));

vi.mock('@/lib/db/mongoose', () => ({
  default: connectDBMock,
}));

vi.mock('@/lib/models/ContactMessage', () => ({
  default: { aggregate: contactAggregateMock },
}));

vi.mock('@/lib/models/AdvertiseInquiry', () => ({
  default: { aggregate: advertiseAggregateMock },
}));

vi.mock('@/lib/models/Article', () => ({
  default: { find: articleFindMock },
}));

const ADMIN_SESSION = {
  id: 'admin-1',
  email: 'desk@example.com',
  name: 'Desk',
  role: 'admin' as const,
};

const SUPER_ADMIN_SESSION = {
  id: 'super-1',
  email: 'boss@example.com',
  name: 'Boss',
  role: 'super_admin' as const,
};

function request(path: string): NextRequest {
  return new Request(`http://localhost${path}`) as unknown as NextRequest;
}

describe('Business Value analytics authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectDBMock.mockResolvedValue(undefined);
    contactAggregateMock.mockResolvedValue([]);
    advertiseAggregateMock.mockResolvedValue([]);
    articleLeanMock.mockResolvedValue([]);
    articleFindMock.mockReturnValue({ lean: articleLeanMock });
  });

  it('requires authentication on both data routes', async () => {
    getAdminSessionFromReqMock.mockResolvedValue(null);
    const valueRoute = await import('@/app/api/admin/analytics/value-scoring/route');
    const pagesRoute = await import('@/app/api/admin/analytics/top-lead-pages/route');

    const [valueResponse, pagesResponse] = await Promise.all([
      valueRoute.GET(request('/api/admin/analytics/value-scoring?days=30')),
      pagesRoute.GET(request('/api/admin/analytics/top-lead-pages?days=30')),
    ]);

    expect(valueResponse.status).toBe(401);
    expect(pagesResponse.status).toBe(401);
    expect(connectDBMock).not.toHaveBeenCalled();
  });

  it('forbids a normal admin before accessing Business Value data', async () => {
    getAdminSessionFromReqMock.mockResolvedValue(ADMIN_SESSION);
    const valueRoute = await import('@/app/api/admin/analytics/value-scoring/route');
    const pagesRoute = await import('@/app/api/admin/analytics/top-lead-pages/route');

    const [valueResponse, pagesResponse] = await Promise.all([
      valueRoute.GET(request('/api/admin/analytics/value-scoring?days=30')),
      pagesRoute.GET(request('/api/admin/analytics/top-lead-pages?days=30')),
    ]);

    expect(valueResponse.status).toBe(403);
    expect(pagesResponse.status).toBe(403);
    expect(connectDBMock).not.toHaveBeenCalled();
  });

  it('lets a Super Admin read both Business Value data sets', async () => {
    getAdminSessionFromReqMock.mockResolvedValue(SUPER_ADMIN_SESSION);
    const valueRoute = await import('@/app/api/admin/analytics/value-scoring/route');
    const pagesRoute = await import('@/app/api/admin/analytics/top-lead-pages/route');

    const [valueResponse, pagesResponse] = await Promise.all([
      valueRoute.GET(request('/api/admin/analytics/value-scoring?days=30')),
      pagesRoute.GET(request('/api/admin/analytics/top-lead-pages?days=30')),
    ]);

    expect(valueResponse.status).toBe(200);
    expect(pagesResponse.status).toBe(200);
    expect(connectDBMock).toHaveBeenCalledTimes(2);
  });
});
