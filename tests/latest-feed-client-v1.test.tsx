import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchPublicArticlesPage: vi.fn(),
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

vi.mock('@/components/ui/HeroCard', () => ({
  default: ({ article }: { article: { title: string } }) =>
    createElement('div', { 'data-testid': 'hero-card' }, article.title),
}));

vi.mock('@/components/ui/NewsCard', () => ({
  default: ({ article }: { article: { title: string } }) =>
    createElement('article', { 'data-testid': 'news-card' }, article.title),
}));

describe('LatestFeedClient v1 article integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads more stories through the v1 public articles helper with legacy fallback enabled', async () => {
    mocks.fetchPublicArticlesPage.mockResolvedValue({
      items: [
        {
          id: 'article-2',
          slug: 'second-story',
          title: 'Second Story',
          summary: 'Second summary',
          image: '/second.jpg',
          category: 'Politics',
          author: 'Desk',
          publishedAt: '2026-05-09T09:00:00.000Z',
        },
      ],
      limit: 1,
      hasMore: false,
      nextCursor: null,
    });

    const LatestFeedClient = (await import('@/app/(reader)/main/latest/LatestFeedClient'))
      .default;

    render(
      createElement(LatestFeedClient, {
        initialItems: [
          {
            id: 'article-1',
            slug: 'lead-story',
            title: 'Lead Story',
            summary: 'Lead summary',
            image: '/lead.jpg',
            category: 'Politics',
            author: 'Desk',
            publishedAt: '2026-05-09T10:00:00.000Z',
          },
        ],
        initialLimit: 1,
        initialHasMore: true,
        initialNextCursor: {
          publishedAt: '2026-05-09T10:00:00.000Z',
          id: 'article-1',
        },
      })
    );

    await userEvent.click(screen.getByRole('button', { name: /load more/i }));

    expect(mocks.fetchPublicArticlesPage).toHaveBeenCalledWith(
      {
        limit: 1,
        cursor: {
          publishedAt: '2026-05-09T10:00:00.000Z',
          id: 'article-1',
        },
      },
      { fallbackToLegacyLatest: true }
    );
    expect(await screen.findByText('Second Story')).toBeInTheDocument();
  });
});
