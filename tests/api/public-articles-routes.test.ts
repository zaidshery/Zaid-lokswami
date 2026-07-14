import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const connectDBMock = vi.fn();
const listAllStoredArticlesMock = vi.fn();
const getStoredArticleByIdMock = vi.fn();
const getStoredArticleByIdOrSlugMock = vi.fn();
const articleFindMock = vi.fn();

vi.mock('@/lib/db/mongoose', () => ({
  default: connectDBMock,
}));

vi.mock('@/lib/models/Article', () => ({
  default: {
    find: articleFindMock,
    findById: vi.fn(),
    findOne: vi.fn(),
  },
}));

vi.mock('@/lib/storage/articlesFile', () => ({
  getStoredArticleById: getStoredArticleByIdMock,
  getStoredArticleByIdOrSlug: getStoredArticleByIdOrSlugMock,
  listAllStoredArticles: listAllStoredArticlesMock,
}));

describe('public article routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MONGODB_URI;
    getStoredArticleByIdOrSlugMock.mockImplementation((token: string) =>
      getStoredArticleByIdMock(token)
    );
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
        slug: 'published-slug',
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
    expect(response.headers.get('cache-control')).toContain('s-maxage=120');
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toEqual(
      expect.objectContaining({
        id: 'published-1',
        slug: 'published-slug',
        title: 'Published article',
        content: 'Published content',
      })
    );
  });

  it('bounds the Mongo latest-feed query while preserving legacy publication and cursor output', async () => {
    process.env.MONGODB_URI = 'mongodb://example.test/lokswami';
    connectDBMock.mockResolvedValue(undefined);

    const selectedDocuments = [
      {
        _id: '665000000000000000000004',
        slug: 'legacy-published',
        title: 'Legacy published article',
        summary: 'Legacy summary',
        image: '/legacy.jpg',
        category: 'Politics',
        author: 'Archive Desk',
        publishedAt: new Date('2026-05-09T09:00:00.000Z'),
        updatedAt: new Date('2026-05-09T09:30:00.000Z'),
        views: 14,
        isBreaking: true,
        isTrending: false,
        editorial: {},
      },
      ...[3, 2, 1, 0, -1].map((suffix, index) => ({
        _id: `66500000000000000000000${suffix < 0 ? 9 : suffix}`,
        slug: `published-${index}`,
        title: `Published article ${index}`,
        summary: `Published summary ${index}`,
        image: `/published-${index}.jpg`,
        category: 'General',
        author: 'News Desk',
        publishedAt: new Date(`2026-05-09T0${8 - index}:00:00.000Z`),
        updatedAt: new Date(`2026-05-09T0${8 - index}:30:00.000Z`),
        views: index,
        isBreaking: false,
        isTrending: false,
        editorial: {},
        workflow: { status: 'published' },
      })),
    ];
    const leanMock = vi.fn().mockResolvedValue(selectedDocuments);
    const limitMock = vi.fn().mockReturnValue({ lean: leanMock });
    const sortMock = vi.fn().mockReturnValue({ limit: limitMock });
    const selectMock = vi.fn().mockReturnValue({ sort: sortMock });
    articleFindMock.mockReturnValue({ select: selectMock });

    const { GET } = await import('@/app/api/articles/latest/route');
    const response = await GET(
      new Request(
        'http://localhost/api/articles/latest?limit=5&cursorPublishedAt=2026-05-09T10%3A00%3A00.000Z&cursorId=665000000000000000000005'
      ) as unknown as NextRequest
    );
    const payload = await response.json();

    expect(connectDBMock).toHaveBeenCalledTimes(1);
    expect(articleFindMock).toHaveBeenCalledTimes(1);
    const mongoFilter = articleFindMock.mock.calls[0]?.[0] as {
      $and: Array<Record<string, unknown>>;
    };
    expect(mongoFilter.$and[0]).toEqual(
      expect.objectContaining({
        $or: expect.arrayContaining([
          { 'workflow.status': 'published' },
          expect.objectContaining({ $and: expect.any(Array) }),
        ]),
      })
    );
    const cursorFilter = mongoFilter.$and.find((entry) => {
      const clauses = entry.$or;
      return Array.isArray(clauses) && clauses.some((clause) => {
        const publishedAt = (clause as { publishedAt?: { $lt?: Date } }).publishedAt;
        return publishedAt?.$lt instanceof Date;
      });
    }) as {
      $or: [
        { publishedAt: { $lt: Date } },
        { $and: [{ publishedAt: Date }, { _id: { $lt: { toString(): string } } }] },
      ];
    };
    expect(cursorFilter.$or[0].publishedAt.$lt.toISOString()).toBe(
      '2026-05-09T10:00:00.000Z'
    );
    expect(cursorFilter.$or[1].$and[1]._id.$lt.toString()).toBe(
      '665000000000000000000005'
    );

    const projection = String(selectMock.mock.calls[0]?.[0] || '');
    expect(projection).not.toMatch(/(?:^|\s)content(?:\s|$)/);
    expect(projection).toContain('editorial');
    expect(projection).toContain('workflow');
    expect(sortMock).toHaveBeenCalledWith({ publishedAt: -1, _id: -1 });
    expect(limitMock).toHaveBeenCalledWith(6);
    expect(leanMock).toHaveBeenCalledTimes(1);

    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        limit: 5,
        hasMore: true,
        nextCursor: {
          publishedAt: '2026-05-09T05:00:00.000Z',
          id: '665000000000000000000000',
        },
      })
    );
    expect(payload.items).toHaveLength(5);
    expect(payload.items[0]).toEqual({
      _id: '665000000000000000000004',
      id: '665000000000000000000004',
      slug: 'legacy-published',
      title: 'Legacy published article',
      summary: 'Legacy summary',
      content: '',
      image: '/legacy.jpg',
      category: 'Politics',
      author: 'Archive Desk',
      publishedAt: '2026-05-09T09:00:00.000Z',
      views: 14,
      isBreaking: true,
      isTrending: false,
    });
  });

  it('returns 404 for unpublished public article detail requests', async () => {
    getStoredArticleByIdOrSlugMock.mockResolvedValue({
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

  it('resolves public article detail by current slug', async () => {
    getStoredArticleByIdOrSlugMock.mockResolvedValue({
      _id: 'published-1',
      slug: 'published-slug',
      previousSlugs: [],
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
    });

    const { GET } = await import('@/app/api/articles/[id]/route');
    const response = await GET(
      new Request('http://localhost/api/articles/published-slug') as unknown as Request,
      { params: Promise.resolve({ id: 'published-slug' }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toEqual(
      expect.objectContaining({
        _id: 'published-1',
        slug: 'published-slug',
      })
    );
  });
});
