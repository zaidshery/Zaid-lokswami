import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminSessionFromReqMock = vi.fn();
const getAudienceAnalyticsSummaryMock = vi.fn();

vi.mock('@/lib/auth/admin', () => ({
  getAdminSessionFromReq: getAdminSessionFromReqMock,
}));

vi.mock('@/lib/admin/audienceAnalytics', () => ({
  getAudienceAnalyticsSummary: getAudienceAnalyticsSummaryMock,
}));

describe('/api/admin/articles/trending-signal GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    getAdminSessionFromReqMock.mockResolvedValue(null);
    const { GET } = await import('@/app/api/admin/articles/trending-signal/route');

    const response = await GET(
      new Request('http://localhost/api/admin/articles/trending-signal?category=City') as unknown as NextRequest
    );

    expect(response.status).toBe(401);
    expect(getAudienceAnalyticsSummaryMock).not.toHaveBeenCalled();
  });

  it('returns an evidence-backed seven-day section signal', async () => {
    getAdminSessionFromReqMock.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    getAudienceAnalyticsSummaryMock.mockResolvedValue({
      source: 'file',
      current: {
        sectionTrends: [
          {
            label: 'City',
            currentEvents: 84,
            previousEvents: 60,
            deltaEvents: 24,
            currentSessions: 51,
            previousSessions: 42,
            deltaSessions: 9,
          },
        ],
      },
    });
    const { GET } = await import('@/app/api/admin/articles/trending-signal/route');

    const response = await GET(
      new Request('http://localhost/api/admin/articles/trending-signal?category=City') as unknown as NextRequest
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.available).toBe(true);
    expect(payload.data.reason).toContain('84 page views across 51 sessions');
    expect(payload.data.reason).toContain('+24 versus the previous seven days');
    expect(getAudienceAnalyticsSummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        start: expect.any(Date),
        end: expect.any(Date),
        previousStart: expect.any(Date),
        previousEnd: expect.any(Date),
      })
    );
  });

  it('does not invent a reason when the selected section has no signal', async () => {
    getAdminSessionFromReqMock.mockResolvedValue({ id: 'copy-1', role: 'copy_editor' });
    getAudienceAnalyticsSummaryMock.mockResolvedValue({
      source: 'file',
      current: { sectionTrends: [] },
    });
    const { GET } = await import('@/app/api/admin/articles/trending-signal/route');

    const response = await GET(
      new Request('http://localhost/api/admin/articles/trending-signal?category=Science') as unknown as NextRequest
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toEqual({
      available: false,
      reason: '',
      detail: 'No seven-day audience signal is available for Science.',
    });
  });
});
