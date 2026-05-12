import { describe, expect, it } from 'vitest';
import { mapHomeFeedToHomePageState } from '@/lib/content/homeFeed';

describe('home feed mapper', () => {
  it('maps the v1 home-feed envelope into homepage article, story, and e-paper state', () => {
    const result = mapHomeFeedToHomePageState({
      success: true,
      data: {
        hero: [
          {
            id: 'article-1',
            slug: 'lead-story',
            title: 'Lead Story',
            summary: 'Lead summary',
            image: '/lead.jpg',
            category: 'Regional',
            author: 'News Desk',
            publishedAt: '2026-05-09T10:00:00.000Z',
            views: 20,
            isBreaking: true,
          },
        ],
        latest: [
          {
            id: 'article-2',
            slug: 'latest-story',
            title: 'Latest Story',
            summary: 'Latest summary',
            image: '/latest.jpg',
            category: 'National',
            author: 'Reporter',
            publishedAt: '2026-05-09T09:00:00.000Z',
            views: 8,
          },
        ],
        trending: [
          {
            id: 'article-1',
            slug: 'lead-story',
            title: 'Lead Story',
            summary: 'Lead summary',
            image: '/lead.jpg',
            category: 'Regional',
            author: 'News Desk',
            publishedAt: '2026-05-09T10:00:00.000Z',
            views: 20,
            isTrending: true,
          },
        ],
        stories: [
          {
            id: 'story-1',
            title: 'Visual Story',
            caption: 'Story caption',
            thumbnail: '/story.jpg',
            mediaType: 'image',
            mediaUrl: '/story.jpg',
            linkUrl: '/main/article/lead-story',
            category: 'Regional',
            publishedAt: '2026-05-09T10:30:00.000Z',
            priority: 5,
          },
        ],
        epaper: {
          id: 'paper-1',
          citySlug: 'indore',
          cityName: 'Indore',
          title: 'Indore Edition',
          publishDate: '2026-05-09',
          thumbnailPath: '/paper.jpg',
          pageCount: 12,
        },
      },
    });

    expect(result).not.toBeNull();
    expect(result?.articles.map((article) => article.id)).toEqual([
      'article-1',
      'article-2',
    ]);
    expect(result?.articles[0]).toEqual(
      expect.objectContaining({
        title: 'Lead Story',
        slug: 'lead-story',
        author: expect.objectContaining({ name: 'News Desk' }),
      })
    );
    expect(result?.stories[0]).toEqual(
      expect.objectContaining({
        id: 'story-1',
        title: 'Visual Story',
        href: '/main/article/lead-story',
      })
    );
    expect(result?.epaper).toEqual(
      expect.objectContaining({
        _id: 'paper-1',
        citySlug: 'indore',
        pageCount: 12,
      })
    );
  });
});
