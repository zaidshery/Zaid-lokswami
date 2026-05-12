import { beforeEach, describe, expect, it, vi } from 'vitest';

const connectDBMock = vi.fn();
const listAllStoredArticlesMock = vi.fn();
const getStoredArticleByIdOrSlugMock = vi.fn();

vi.mock('@/lib/db/mongoose', () => ({
  default: connectDBMock,
}));

vi.mock('@/lib/models/Article', () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
  },
}));

vi.mock('@/lib/storage/articlesFile', () => ({
  getStoredArticleByIdOrSlug: getStoredArticleByIdOrSlugMock,
  listAllStoredArticles: listAllStoredArticlesMock,
}));

const publishedBase = {
  summary: 'Story summary',
  image: '/story.jpg',
  author: 'Desk',
  views: 10,
  isBreaking: false,
  isTrending: false,
  workflow: { status: 'published' },
};

describe('public articles service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MONGODB_URI;
  });

  it('lists published articles with category, city, and cursor filters from the file store', async () => {
    listAllStoredArticlesMock.mockResolvedValue([
      {
        ...publishedBase,
        _id: 'article-3',
        slug: 'third-story',
        title: 'Third Story',
        category: 'Politics',
        publishedAt: '2026-05-09T08:00:00.000Z',
        updatedAt: '2026-05-09T08:30:00.000Z',
        reporterMeta: { locationTag: 'Indore' },
      },
      {
        ...publishedBase,
        _id: 'article-2',
        slug: 'second-story',
        title: 'Second Story',
        category: 'Politics',
        publishedAt: '2026-05-09T09:00:00.000Z',
        updatedAt: '2026-05-09T09:30:00.000Z',
        reporterMeta: { locationTag: 'Indore' },
      },
      {
        ...publishedBase,
        _id: 'article-1',
        slug: 'lead-story',
        title: 'Lead Story',
        category: 'Politics',
        publishedAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:30:00.000Z',
        reporterMeta: { locationTag: 'Indore' },
      },
      {
        ...publishedBase,
        _id: 'sports-1',
        slug: 'sports-story',
        title: 'Sports Story',
        category: 'Sports',
        publishedAt: '2026-05-09T11:00:00.000Z',
        updatedAt: '2026-05-09T11:30:00.000Z',
        reporterMeta: { locationTag: 'Indore' },
      },
      {
        ...publishedBase,
        _id: 'bhopal-1',
        slug: 'bhopal-story',
        title: 'Bhopal Story',
        category: 'Politics',
        publishedAt: '2026-05-09T12:00:00.000Z',
        updatedAt: '2026-05-09T12:30:00.000Z',
        reporterMeta: { locationTag: 'Bhopal' },
      },
      {
        ...publishedBase,
        _id: 'draft-1',
        slug: 'draft-story',
        title: 'Draft Story',
        category: 'Politics',
        publishedAt: '2026-05-09T13:00:00.000Z',
        updatedAt: '2026-05-09T13:30:00.000Z',
        reporterMeta: { locationTag: 'Indore' },
        workflow: { status: 'draft' },
      },
    ]);

    const { listPublicArticles } = await import('@/lib/server/publicArticles');
    const result = await listPublicArticles({
      limit: 1,
      category: 'politics',
      city: 'indore',
      cursorPublishedAt: '2026-05-09T10:00:00.000Z',
      cursorId: 'article-1',
    });

    expect(result.source).toBe('file');
    expect(connectDBMock).not.toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'article-2',
        slug: 'second-story',
        city: 'Indore',
        href: '/main/article/second-story',
      })
    );
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toEqual({
      publishedAt: '2026-05-09T09:00:00.000Z',
      id: 'article-2',
    });
  });

  it('searches published articles across public text fields from the file store', async () => {
    listAllStoredArticlesMock.mockResolvedValue([
      {
        ...publishedBase,
        _id: 'article-1',
        slug: 'indore-budget',
        title: 'Indore Budget',
        summary: 'Municipal budget update',
        category: 'Politics',
        publishedAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:30:00.000Z',
        reporterMeta: { locationTag: 'Indore' },
      },
      {
        ...publishedBase,
        _id: 'article-2',
        slug: 'sports-wrap',
        title: 'Sports Wrap',
        summary: 'Daily match report',
        category: 'Sports',
        publishedAt: '2026-05-09T09:00:00.000Z',
        updatedAt: '2026-05-09T09:30:00.000Z',
        reporterMeta: { locationTag: 'Bhopal' },
      },
    ]);

    const { listPublicArticles } = await import('@/lib/server/publicArticles');
    const result = await listPublicArticles({
      limit: 10,
      query: 'budget',
    });

    expect(result.filters).toEqual({ query: 'budget' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'article-1',
        title: 'Indore Budget',
      })
    );
  });

  it('returns public article detail by slug without leaking workflow metadata', async () => {
    getStoredArticleByIdOrSlugMock.mockResolvedValue({
      ...publishedBase,
      _id: 'article-1',
      slug: 'lead-story',
      previousSlugs: ['old-lead-story'],
      title: 'Lead Story',
      content: 'Full story body',
      category: 'Politics',
      publishedAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:30:00.000Z',
      reporterMeta: { locationTag: 'Indore' },
      seo: {
        metaTitle: 'Lead Story SEO',
        metaDescription: 'SEO description',
      },
    });

    const { getPublicArticleBySlug } = await import('@/lib/server/publicArticles');
    const result = await getPublicArticleBySlug('lead-story');

    expect(result?.source).toBe('file');
    expect(result?.article).toEqual(
      expect.objectContaining({
        id: 'article-1',
        previousSlugs: ['old-lead-story'],
        content: 'Full story body',
        city: 'Indore',
      })
    );
    expect(result?.article).not.toHaveProperty('workflow');
  });
});
