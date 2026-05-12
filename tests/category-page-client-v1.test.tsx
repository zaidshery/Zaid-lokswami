import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchPublicArticlesPage: vi.fn(),
  fetchMergedLiveArticles: vi.fn(),
}));

vi.mock('@/lib/store/appStore', () => ({
  useAppStore: () => ({ language: 'en' }),
}));

vi.mock('@/lib/content/publicArticles', async () => {
  const actual = await vi.importActual<typeof import('@/lib/content/publicArticles')>(
    '@/lib/content/publicArticles'
  );
  return {
    ...actual,
    fetchPublicArticlesPage: mocks.fetchPublicArticlesPage,
  };
});

vi.mock('@/lib/content/liveArticles', async () => {
  const actual = await vi.importActual<typeof import('@/lib/content/liveArticles')>(
    '@/lib/content/liveArticles'
  );
  return {
    ...actual,
    fetchMergedLiveArticles: mocks.fetchMergedLiveArticles,
  };
});

vi.mock('@/components/ui/HeroCard', () => ({
  default: ({ article }: { article: { title: string } }) =>
    createElement('div', { 'data-testid': 'hero-card' }, article.title),
}));

vi.mock('@/components/ui/NewsCard', () => ({
  default: ({ article }: { article: { title: string } }) =>
    createElement('article', { 'data-testid': 'news-card' }, article.title),
}));

describe('CategoryPageClient v1 article integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchPublicArticlesPage.mockResolvedValue(null);
    mocks.fetchMergedLiveArticles.mockResolvedValue([]);
  });

  it('renders initial v1 category items without falling back to legacy latest fetches', async () => {
    const CategoryPageClient = (
      await import('@/app/(reader)/main/category/[slug]/CategoryPageClient')
    ).default;

    render(
      createElement(CategoryPageClient, {
        slug: 'politics',
        initialItems: [
          {
            id: 'article-1',
            slug: 'lead-story',
            title: 'Political Lead',
            summary: 'Lead summary',
            image: '/lead.jpg',
            category: 'Politics',
            author: 'Desk',
            publishedAt: '2026-05-09T10:00:00.000Z',
          },
        ],
      })
    );

    expect(screen.getByTestId('hero-card')).toHaveTextContent('Political Lead');
    expect(mocks.fetchPublicArticlesPage).not.toHaveBeenCalled();
    expect(mocks.fetchMergedLiveArticles).not.toHaveBeenCalled();
  });
});
