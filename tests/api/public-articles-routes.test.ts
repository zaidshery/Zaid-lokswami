import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const connectDBMock = vi.fn();
const listAllStoredArticlesMock = vi.fn();
const getStoredArticleByIdMock = vi.fn();

vi.mock('@/lib/db/mongoose', () => ({
  default: connectDBMock,
}));

vi.mock('@/lib/models/Article', () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock('@/lib/storage/articlesFile', () => ({
  getStoredArticleById: getStoredArticleByIdMock,
  listAllStoredArticles: listAllStoredArticlesMock,
}));

describe('public article routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MONGODB_URI;
  });

  it('excludes unpublished articles from the latest feed', async () => {
    listAllStoredArticlesMock.mockResolvedValue([
      {
        _id: 'draft-1',
        title: 'Draft article',
        summary: 'Draft summary',
        content: 'Draft content',
        image: '/draft.jpg',
        category: 'General',
        author: 'Reporter',
        publishedAt: '2026-04-13T10:00:00.000Z',
        views: 0,
        isBreaking: false,
        isTrending: false,
        workflow: {
          status: 'draft',
        },
      },
      {
        _id: 'published-1',
        title: 'Published article',
        summary: 'Published summary',
        content: 'Published content',
        image: '/published.jpg',
        category: 'General',
        author: 'Desk',
        publishedAt: '2026-04-13T09:00:00.000Z',
        views: 12,
        isBreaking: false,
        isTrending: false,
        workflow: {
          status: 'published',
        },
      },
    ]);

    const { GET } = await import('@/app/api/articles/latest/route');
    const response = await GET(
      new Request('http://localhost/api/articles/latest?limit=20') as unknown as NextRequest
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('s-maxage=60');
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toEqual(
      expect.objectContaining({
        id: 'published-1',
        title: 'Published article',
      })
    );
  });

  it('returns 404 for unpublished public article detail requests', async () => {
    getStoredArticleByIdMock.mockResolvedValue({
      _id: 'draft-1',
      title: 'Draft article',
      summary: 'Draft summary',
      content: 'Draft content',
      image: '/draft.jpg',
      category: 'General',
      author: 'Reporter',
      publishedAt: '2026-04-13T10:00:00.000Z',
      workflow: {
        status: 'draft',
      },
    });

    const { GET } = await import('@/app/api/articles/[id]/route');
    const response = await GET(
      new Request('http://localhost/api/articles/draft-1') as unknown as Request,
      { params: Promise.resolve({ id: 'draft-1' }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({
      success: false,
      error: 'Article not found',
    });
  });
});
