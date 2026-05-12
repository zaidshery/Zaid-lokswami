import { beforeEach, describe, expect, it, vi } from 'vitest';

const listPublicArticlesMock = vi.fn();
const getPublicArticleBySlugMock = vi.fn();

vi.mock('@/lib/server/publicArticles', () => ({
  getPublicArticleBySlug: getPublicArticleBySlugMock,
  listPublicArticles: listPublicArticlesMock,
  normalizePublicArticleLimit: (value: unknown) => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) ? parsed : 20;
  },
}));

describe('API v1 public article routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a standard envelope for the filtered public article list', async () => {
    listPublicArticlesMock.mockResolvedValue({
      items: [
        {
          id: 'article-1',
          _id: 'article-1',
          slug: 'lead-story',
          title: 'Lead Story',
          summary: 'Lead summary',
          image: '/lead.jpg',
          category: 'Politics',
          author: 'Desk',
          publishedAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:30:00.000Z',
          views: 10,
          isBreaking: false,
          isTrending: true,
          city: 'Indore',
          href: '/main/article/lead-story',
        },
      ],
      source: 'file',
      limit: 10,
      filters: { category: 'politics', city: 'indore' },
      hasMore: false,
      nextCursor: null,
    });

    const { GET } = await import('@/app/api/v1/public/articles/route');
    const response = await GET(
      new Request('http://localhost/api/v1/public/articles?limit=10&category=politics&city=indore')
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('s-maxage=60');
    expect(listPublicArticlesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 10,
        category: 'politics',
        city: 'indore',
      })
    );
    expect(payload).toEqual({
      success: true,
      data: {
        items: expect.any(Array),
        filters: { category: 'politics', city: 'indore' },
      },
      meta: {
        source: 'file',
        pagination: {
          limit: 10,
          hasMore: false,
          nextCursor: null,
        },
      },
      error: null,
    });
  });

  it('returns a standard 404 envelope for missing article details', async () => {
    getPublicArticleBySlugMock.mockResolvedValue(null);

    const { GET } = await import('@/app/api/v1/public/articles/[slug]/route');
    const response = await GET(new Request('http://localhost/api/v1/public/articles/missing'), {
      params: Promise.resolve({ slug: 'missing' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({
      success: false,
      data: null,
      meta: null,
      error: {
        code: 'NOT_FOUND',
        message: 'Article not found',
      },
    });
  });

  it('returns a standard envelope for public article search', async () => {
    listPublicArticlesMock.mockResolvedValue({
      items: [
        {
          id: 'article-1',
          _id: 'article-1',
          slug: 'indore-budget',
          title: 'Indore Budget',
          summary: 'Budget summary',
          image: '/budget.jpg',
          category: 'Politics',
          author: 'Desk',
          publishedAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:30:00.000Z',
          views: 10,
          isBreaking: false,
          isTrending: false,
          city: 'Indore',
          href: '/main/article/indore-budget',
        },
      ],
      source: 'file',
      limit: 5,
      filters: { query: 'budget', city: 'indore' },
      hasMore: false,
      nextCursor: null,
    });

    const { GET } = await import('@/app/api/v1/public/search/route');
    const response = await GET(
      new Request('http://localhost/api/v1/public/search?q=budget&city=indore&limit=5')
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('s-maxage=60');
    expect(listPublicArticlesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'budget',
        city: 'indore',
        limit: 5,
      })
    );
    expect(payload).toEqual({
      success: true,
      data: {
        items: expect.any(Array),
        query: 'budget',
        filters: { query: 'budget', city: 'indore' },
      },
      meta: {
        source: 'file',
        pagination: {
          limit: 5,
          hasMore: false,
          nextCursor: null,
        },
      },
      error: null,
    });
  });

  it('rejects public article search terms that are too short', async () => {
    const { GET } = await import('@/app/api/v1/public/search/route');
    const response = await GET(new Request('http://localhost/api/v1/public/search?q=a'));
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(listPublicArticlesMock).not.toHaveBeenCalled();
    expect(payload.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Search query must be at least 2 characters',
    });
  });
});
