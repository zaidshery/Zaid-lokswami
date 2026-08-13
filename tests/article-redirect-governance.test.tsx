import { createElement } from 'react';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolvePublicArticleToken: vi.fn(),
  getPublicArticleByResolution: vi.fn(),
  listRelatedPublicArticles: vi.fn(),
  permanentRedirect: vi.fn(),
  notFound: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('@/lib/server/publicArticles', () => ({
  resolvePublicArticleToken: mocks.resolvePublicArticleToken,
  getPublicArticleByResolution: mocks.getPublicArticleByResolution,
  listRelatedPublicArticles: mocks.listRelatedPublicArticles,
  PublicArticleResolutionError: class PublicArticleResolutionError extends Error {},
}));

vi.mock('next/navigation', () => ({
  permanentRedirect: mocks.permanentRedirect,
  notFound: mocks.notFound,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next-auth/jwt', () => ({ getToken: mocks.getToken }));

vi.mock('@/app/(reader)/main/article/[id]/ArticleDetailClient', () => ({
  default: () => createElement('main', null, 'article'),
}));

const resolved = {
  kind: 'previous' as const,
  source: 'file' as const,
  article: {
    id: '507f1f77bcf86cd799439011',
    slug: 'current-story',
    previousSlugs: ['previous-story'],
    title: 'Current Story',
    summary: 'Summary',
    image: '/story.jpg',
    category: 'City',
    author: 'Desk',
    publishedAt: '2026-08-12T09:00:00.000Z',
    updatedAt: '2026-08-12T10:00:00.000Z',
    seo: {},
    href: '/main/article/current-story',
  },
  authoritativePath: '/main/article/current-story',
  isExactAuthority: false,
};

describe('reader redirect governance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolvePublicArticleToken.mockResolvedValue(resolved);
    mocks.permanentRedirect.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT_308');
    });
    mocks.notFound.mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND');
    });
  });

  it('redirects a previous slug directly to final authority with safe queries', async () => {
    const ArticlePage = (await import('@/app/(reader)/main/article/[id]/page')).default;
    await expect(
      ArticlePage({
        params: Promise.resolve({ id: 'previous-story' }),
        searchParams: Promise.resolve({ ref: 'home', _rsc: 'internal' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT_308');
    expect(mocks.permanentRedirect).toHaveBeenCalledWith(
      '/main/article/current-story?ref=home'
    );
    expect(mocks.getPublicArticleByResolution).not.toHaveBeenCalled();
  });

  it('redirects a published Object ID and case variant without a chain', async () => {
    const ArticlePage = (await import('@/app/(reader)/main/article/[id]/page')).default;
    for (const [token, kind] of [
      ['507f1f77bcf86cd799439011', 'legacyId'],
      ['CURRENT-STORY', 'current'],
    ] as const) {
      mocks.resolvePublicArticleToken.mockResolvedValueOnce({ ...resolved, kind });
      await expect(
        ArticlePage({ params: Promise.resolve({ id: token }) })
      ).rejects.toThrow('NEXT_REDIRECT_308');
      expect(mocks.permanentRedirect).toHaveBeenLastCalledWith(
        '/main/article/current-story'
      );
    }
  });

  it('renders an exact same-ID/current-slug authority without redirecting to itself', async () => {
    const sameIdArticle = {
      ...resolved.article,
      slug: resolved.article.id,
      previousSlugs: [],
      href: `/main/article/${resolved.article.id}`,
      content: '<p>Same-ID article body</p>',
    };
    const sameIdResolution = {
      ...resolved,
      kind: 'current' as const,
      article: sameIdArticle,
      authoritativePath: sameIdArticle.href,
      isExactAuthority: true,
    };
    mocks.resolvePublicArticleToken.mockResolvedValue(sameIdResolution);
    mocks.getPublicArticleByResolution.mockResolvedValue({
      article: sameIdArticle,
      source: 'file',
    });
    mocks.listRelatedPublicArticles.mockResolvedValue({ items: [], source: 'file', limit: 20 });
    const ArticlePage = (await import('@/app/(reader)/main/article/[id]/page')).default;

    const element = await ArticlePage({
      params: Promise.resolve({ id: sameIdArticle.id }),
    });

    expect(element).toBeTruthy();
    expect(mocks.permanentRedirect).not.toHaveBeenCalled();
    expect(mocks.getPublicArticleByResolution).toHaveBeenCalledWith(sameIdResolution);
  });

  it('redirects a same-ID/current-slug case variant once to different authoritative casing', async () => {
    const sameIdArticle = {
      ...resolved.article,
      slug: resolved.article.id,
      previousSlugs: [],
      href: `/main/article/${resolved.article.id}`,
    };
    mocks.resolvePublicArticleToken.mockResolvedValue({
      ...resolved,
      kind: 'current',
      article: sameIdArticle,
      authoritativePath: sameIdArticle.href,
      isExactAuthority: false,
    });
    const incomingToken = sameIdArticle.id.toUpperCase();
    const ArticlePage = (await import('@/app/(reader)/main/article/[id]/page')).default;

    await expect(
      ArticlePage({
        params: Promise.resolve({ id: incomingToken }),
        searchParams: Promise.resolve({ ref: 'case-test', _rsc: 'internal' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT_308');

    expect(mocks.permanentRedirect).toHaveBeenCalledTimes(1);
    expect(mocks.permanentRedirect).toHaveBeenCalledWith(
      `${sameIdArticle.href}?ref=case-test`
    );
    expect(mocks.permanentRedirect).not.toHaveBeenCalledWith(
      `/main/article/${incomingToken}?ref=case-test`
    );
  });

  it('makes the legacy route one permanent redirect to final authority', async () => {
    const LegacyPage = (await import('@/app/(reader)/article/[id]/page')).default;
    await expect(
      LegacyPage({
        params: Promise.resolve({ id: '507f1f77bcf86cd799439011' }),
        searchParams: Promise.resolve({ campaign: 'print', __nextFallback: '1' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT_308');
    expect(mocks.permanentRedirect).toHaveBeenCalledWith(
      '/main/article/current-story?campaign=print'
    );
  });

  it('uses a real not-found boundary for missing and malformed tokens', async () => {
    mocks.resolvePublicArticleToken.mockResolvedValue({ kind: 'missing' });
    const ArticlePage = (await import('@/app/(reader)/main/article/[id]/page')).default;
    await expect(
      ArticlePage({ params: Promise.resolve({ id: '%E0%A4%A' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.permanentRedirect).not.toHaveBeenCalled();
  });

  it.each(['ambiguous', 'unavailable'] as const)(
    'surfaces %s resolution as a server failure without redirecting',
    async (kind) => {
      mocks.resolvePublicArticleToken.mockResolvedValue({ kind });
      const ArticlePage = (await import('@/app/(reader)/main/article/[id]/page')).default;
      await expect(
        ArticlePage({ params: Promise.resolve({ id: 'current-story' }) })
      ).rejects.toThrow();
      expect(mocks.permanentRedirect).not.toHaveBeenCalled();
    }
  );
});

describe('article-only trailing slash governance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolvePublicArticleToken.mockResolvedValue(resolved);
  });

  it('redirects once to slashless path, preserving public queries only', async () => {
    const { middleware } = await import('@/middleware');
    const event = { waitUntil: vi.fn() };
    const response = await middleware(
      new NextRequest(
        'https://lokswami.com/main/article/current-story/?ref=home&_rsc=internal&__nextFallback=1'
      ),
      event as never
    );
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://lokswami.com/main/article/current-story?ref=home'
    );
    expect(mocks.getToken).not.toHaveBeenCalled();
  });

  it('does not guess a slashless replacement for an unknown trailing-slash token', async () => {
    mocks.resolvePublicArticleToken.mockResolvedValue({ kind: 'missing' });
    const { middleware } = await import('@/middleware');
    const event = { waitUntil: vi.fn() };
    const response = await middleware(
      new NextRequest('https://lokswami.com/main/article/unknown-story/'),
      event as never
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(mocks.getToken).not.toHaveBeenCalled();
  });

  it('leaves slashless article and unrelated trailing-slash routes alone', async () => {
    const { middleware } = await import('@/middleware');
    const event = { waitUntil: vi.fn() };
    const articleResponse = await middleware(
      new NextRequest('https://lokswami.com/main/article/current-story'),
      event as never
    );
    expect(articleResponse.status).toBe(200);
    expect(articleResponse.headers.get('location')).toBeNull();
    expect(mocks.getToken).not.toHaveBeenCalled();
  });
});
