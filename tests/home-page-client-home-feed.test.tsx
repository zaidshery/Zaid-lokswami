import { createElement, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchHomeFeedForHomePage: vi.fn(),
  fetchMergedLiveArticles: vi.fn(),
  fetchLiveStories: vi.fn(),
}));

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) =>
    createElement('img', { alt, src }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) => createElement('a', { href, ...props }, children),
}));

vi.mock('framer-motion', () => {
  const motionComponent = (tag: string) => {
    const MotionMock = ({
      children,
      ...props
    }: Record<string, unknown> & { children?: ReactNode }) => {
      const forwardedProps = { ...props };
      delete forwardedProps.initial;
      delete forwardedProps.animate;
      delete forwardedProps.transition;
      delete forwardedProps.viewport;
      delete forwardedProps.whileInView;
      return createElement(tag, forwardedProps, children);
    };
    MotionMock.displayName = `MotionMock(${tag})`;
    return MotionMock;
  };

  return {
    motion: {
      div: motionComponent('div'),
      section: motionComponent('section'),
      article: motionComponent('article'),
    },
  };
});

vi.mock('@/lib/store/appStore', () => ({
  useAppStore: () => ({ language: 'en' }),
}));

vi.mock('@/lib/content/homeFeed', async () => {
  const actual = await vi.importActual<typeof import('@/lib/content/homeFeed')>(
    '@/lib/content/homeFeed'
  );
  return {
    ...actual,
    fetchHomeFeedForHomePage: mocks.fetchHomeFeedForHomePage,
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

vi.mock('@/lib/content/liveStories', () => ({
  fetchLiveStories: mocks.fetchLiveStories,
}));

vi.mock('@/lib/utils/articleMedia', () => ({
  buildArticleImageVariantUrl: (value: string) => value,
}));

vi.mock('@/components/ui/HeroCarousel', () => ({
  default: ({ articles }: { articles: Array<{ title: string }> }) =>
    createElement(
      'div',
      { 'data-testid': 'hero-carousel' },
      articles.map((article) => article.title).join('|')
    ),
}));

vi.mock('@/components/ui/StoriesRail', () => ({
  default: ({ stories }: { stories: Array<{ title: string }> }) =>
    createElement(
      'div',
      { 'data-testid': 'stories-rail' },
      stories.map((story) => story.title).join('|')
    ),
}));

vi.mock('@/components/ui/NewsCard', () => ({
  default: ({ article }: { article: { title: string } }) =>
    createElement('article', { 'data-testid': 'news-card' }, article.title),
}));

vi.mock('@/components/ui/DesktopHeroEpaperCard', () => ({
  default: ({ editionLabel }: { editionLabel: string }) =>
    createElement('div', { 'data-testid': 'epaper-card' }, editionLabel),
}));

vi.mock('@/components/ui/NewsPoll', () => ({
  default: () => createElement('div', { 'data-testid': 'news-poll' }),
}));

describe('HomePageClient v1 home-feed integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchHomeFeedForHomePage.mockResolvedValue(null);
    mocks.fetchMergedLiveArticles.mockResolvedValue([]);
    mocks.fetchLiveStories.mockResolvedValue([]);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({}),
      })
    );
  });

  it('renders initial v1 home-feed state through the existing homepage slots', async () => {
    const HomePageClient = (await import('@/app/(reader)/main/HomePageClient'))
      .default;

    render(
      createElement(HomePageClient, {
        initialHomeFeed: {
          articles: [
            {
              id: 'article-1',
              slug: 'lead-story',
              title: 'Lead Story From Feed',
              summary: 'Lead summary',
              image: '/lead.jpg',
              category: 'Regional',
              author: { id: 'desk', name: 'Desk', avatar: '/logo-icon-final.png' },
              publishedAt: '2026-05-09T10:00:00.000Z',
              views: 20,
              isTrending: true,
            },
            {
              id: 'article-2',
              slug: 'latest-story',
              title: 'Second Story From Feed',
              summary: 'Latest summary',
              image: '/latest.jpg',
              category: 'National',
              author: {
                id: 'reporter',
                name: 'Reporter',
                avatar: '/logo-icon-final.png',
              },
              publishedAt: '2026-05-09T09:00:00.000Z',
              views: 8,
            },
            {
              id: 'article-3',
              title: 'Third Story From Feed',
              summary: 'Third summary',
              image: '/third.jpg',
              category: 'National',
              author: {
                id: 'reporter',
                name: 'Reporter',
                avatar: '/logo-icon-final.png',
              },
              publishedAt: '2026-05-09T08:00:00.000Z',
              views: 7,
            },
            {
              id: 'article-4',
              title: 'Fourth Story From Feed',
              summary: 'Fourth summary',
              image: '/fourth.jpg',
              category: 'National',
              author: {
                id: 'reporter',
                name: 'Reporter',
                avatar: '/logo-icon-final.png',
              },
              publishedAt: '2026-05-09T07:00:00.000Z',
              views: 6,
            },
            {
              id: 'article-5',
              title: 'Fifth Story From Feed',
              summary: 'Fifth summary',
              image: '/fifth.jpg',
              category: 'National',
              author: {
                id: 'reporter',
                name: 'Reporter',
                avatar: '/logo-icon-final.png',
              },
              publishedAt: '2026-05-09T06:00:00.000Z',
              views: 5,
            },
            {
              id: 'article-6',
              title: 'Latest Story From Feed',
              summary: 'Sixth summary',
              image: '/sixth.jpg',
              category: 'National',
              author: {
                id: 'reporter',
                name: 'Reporter',
                avatar: '/logo-icon-final.png',
              },
              publishedAt: '2026-05-09T05:00:00.000Z',
              views: 4,
            },
          ],
          stories: [
            {
              id: 'story-1',
              title: 'Story From Feed',
              thumbnail: '/story.jpg',
              mediaType: 'image',
              mediaUrl: '/story.jpg',
              mediaAssets: [],
            },
          ],
          epaper: {
            _id: 'paper-1',
            citySlug: 'indore',
            cityName: 'Indore',
            title: 'Indore Edition',
            publishDate: '2026-05-09',
            thumbnailPath: '/paper.jpg',
            pageCount: 12,
          },
        },
      })
    );

    expect(screen.getByTestId('hero-carousel')).toHaveTextContent(
      'Lead Story From Feed'
    );
    expect(screen.getByTestId('stories-rail')).toHaveTextContent('Story From Feed');
    expect(screen.getAllByTestId('news-card').some((node) =>
      node.textContent?.includes('Latest Story From Feed')
    )).toBe(true);
    expect(screen.getByTestId('epaper-card')).toHaveTextContent('Indore Edition');
    expect(mocks.fetchHomeFeedForHomePage).not.toHaveBeenCalled();
    expect(mocks.fetchMergedLiveArticles).not.toHaveBeenCalled();
    expect(mocks.fetchLiveStories).not.toHaveBeenCalled();
  });
});
