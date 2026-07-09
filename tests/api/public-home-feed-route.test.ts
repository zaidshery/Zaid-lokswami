import { beforeEach, describe, expect, it, vi } from 'vitest';

const getPublicHomeFeedMock = vi.fn();

vi.mock('@/lib/server/publicHomeFeed', () => ({
  getPublicHomeFeed: getPublicHomeFeedMock,
}));

describe('GET /api/v1/public/home-feed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the standard v1 response envelope with public cache headers', async () => {
    getPublicHomeFeedMock.mockResolvedValue({
      source: 'file',
      limits: {
        hero: 5,
        latest: 12,
        trending: 5,
        breaking: 10,
        videos: 6,
        shorts: 8,
      },
      feed: {
        generatedAt: '2026-05-09T11:00:00.000Z',
        hero: [],
        latest: [],
        trending: [],
        breaking: [],
        videos: [],
        shorts: [],
        epaper: null,
        emagazine: null,
      },
    });

    const { GET } = await import('@/app/api/v1/public/home-feed/route');
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('s-maxage=120');
    expect(payload).toEqual({
      success: true,
      data: {
        generatedAt: '2026-05-09T11:00:00.000Z',
        hero: [],
        latest: [],
        trending: [],
        breaking: [],
        videos: [],
        shorts: [],
        epaper: null,
        emagazine: null,
      },
      meta: {
        source: 'file',
        limits: {
          hero: 5,
          latest: 12,
          trending: 5,
          breaking: 10,
          videos: 6,
          shorts: 8,
        },
      },
      error: null,
    });
  });
});
