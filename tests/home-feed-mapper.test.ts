import { describe, expect, it } from 'vitest';
import { mapHomeFeedToHomePageState } from '@/lib/content/homeFeed';

describe('home feed mapper', () => {
  it('maps the v1 home-feed envelope into homepage article and e-paper state', () => {
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
        epaper: {
          id: 'paper-1',
          citySlug: 'indore',
          cityName: 'Indore',
          title: 'Indore Edition',
          publishDate: '2026-05-09',
          thumbnailPath: '/paper.jpg',
          pageCount: 12,
        },
        emagazine: {
          id: 'magazine-1',
          publicationType: 'emagazine',
          citySlug: 'global',
          cityName: 'Lokswami',
          title: 'Lokswami E-Magazine - May 2026',
          publishDate: '2026-05-01',
          thumbnailPath: '/magazine.jpg',
          pageCount: 36,
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
    expect(result?.epaper).toEqual(
      expect.objectContaining({
        _id: 'paper-1',
        citySlug: 'indore',
        pageCount: 12,
      })
    );
    expect(result?.emagazine).toEqual(
      expect.objectContaining({
        _id: 'magazine-1',
        publicationType: 'emagazine',
        pageCount: 36,
      })
    );
  });

  it('maps legacy e-paper thumbnail fields into the homepage cover path', () => {
    const result = mapHomeFeedToHomePageState({
      success: true,
      data: {
        epaper: {
          id: 'paper-legacy',
          citySlug: 'indore',
          cityName: 'Indore',
          title: 'Legacy Indore Edition',
          publishDate: '2026-05-10',
          thumbnail: '/legacy-paper-cover.jpg',
          pageCount: 8,
        },
      },
    });

    expect(result?.epaper).toEqual(
      expect.objectContaining({
        _id: 'paper-legacy',
        thumbnailPath: '/legacy-paper-cover.jpg',
      })
    );
  });
});
