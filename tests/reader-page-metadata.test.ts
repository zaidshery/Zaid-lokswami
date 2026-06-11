import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildCategoryPageMetadata,
  buildEpaperPageMetadata,
  buildLatestPageMetadata,
  buildStoriesPageMetadata,
  buildStoryPageMetadata,
  buildVideoPageMetadata,
  buildVideosPageMetadata,
} from '@/lib/seo/readerPageMetadata';

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

describe('reader page metadata', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://lokswami.com/';
  });

  afterEach(() => {
    if (typeof originalSiteUrl === 'undefined') {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      return;
    }
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  });

  it('builds latest page metadata on the production domain', () => {
    const metadata = buildLatestPageMetadata();

    expect(metadata).toEqual(
      expect.objectContaining({
        title: 'Latest Hindi News and Breaking Headlines | Lokswami',
        description: expect.stringContaining('Hindi news updates'),
        alternates: {
          canonical: 'https://lokswami.com/main/latest',
        },
        twitter: expect.objectContaining({
          card: 'summary_large_image',
        }),
      })
    );
  });

  it('builds videos page metadata on the production domain', () => {
    const metadata = buildVideosPageMetadata();

    expect(metadata).toEqual(
      expect.objectContaining({
        title: 'Hindi News Videos and Shorts | Lokswami',
        alternates: {
          canonical: 'https://lokswami.com/main/videos',
        },
      })
    );
  });

  it('builds stories page metadata on the production domain', () => {
    const metadata = buildStoriesPageMetadata();

    expect(metadata).toEqual(
      expect.objectContaining({
        title: 'Visual Stories and Quick Updates | Lokswami',
        alternates: {
          canonical: 'https://lokswami.com/main/stories',
        },
      })
    );
  });

  it('builds story-specific metadata with a deep-link canonical URL', () => {
    const metadata = buildStoryPageMetadata({
      storyId: 'story-123',
      title: 'City monsoon visual update',
      description: 'Swipe through the latest Lokswami visual monsoon update.',
      category: 'Weather',
      image: '/api/og/story?id=story-123',
    });

    expect(metadata).toEqual(
      expect.objectContaining({
        title: 'City monsoon visual update | Lokswami Story',
        description: 'Swipe through the latest Lokswami visual monsoon update.',
        alternates: {
          canonical: 'https://lokswami.com/main/stories?story=story-123',
        },
      })
    );
  });

  it('builds video-specific metadata with a deep-link canonical URL', () => {
    const metadata = buildVideoPageMetadata({
      videoId: 'video-123',
      title: 'Indore headlines in 60 seconds',
      description: 'Watch the top Lokswami headlines from Indore in one quick video.',
      category: 'Politics',
      image: '/api/og/video?id=video-123',
    });

    expect(metadata).toEqual(
      expect.objectContaining({
        title: 'Indore headlines in 60 seconds | Lokswami Video',
        description: 'Watch the top Lokswami headlines from Indore in one quick video.',
        alternates: {
          canonical: 'https://lokswami.com/main/videos?video=video-123',
        },
      })
    );
  });

  it('builds e-paper metadata with only meaningful archive filters in the canonical URL', () => {
    const metadata = buildEpaperPageMetadata({
      city: 'indore',
      publishDate: '2026-03-27',
    });

    expect(metadata).toEqual(
      expect.objectContaining({
        title: 'Indore E-Paper for 27 March 2026 | Lokswami',
        alternates: {
          canonical: 'https://lokswami.com/main/epaper?city=indore&date=2026-03-27',
        },
      })
    );
  });

  it('builds clean e-paper issue metadata without duplicating the edition title', () => {
    const metadata = buildEpaperPageMetadata({
      city: 'indore',
      publishDate: '2026-05-22',
      paperId: 'paper-1',
      issueTitle: 'Indore Edition - Lokswami E-paper - 22/05/2026',
      issueCityName: 'Indore',
    });

    expect(metadata).toEqual(
      expect.objectContaining({
        title: 'Lokswami Indore E-Paper - 22 May 2026',
        description: expect.stringContaining('22 May 2026 Indore Lokswami e-paper'),
      })
    );
  });

  it('builds story-specific e-paper metadata with a deep-link canonical URL', () => {
    const metadata = buildEpaperPageMetadata({
      city: 'indore',
      publishDate: '2026-05-22',
      paperId: 'paper-1',
      page: 7,
      storyToken: 'front-lead',
      storyTitle: 'Front page civic lead',
      storyExcerpt: 'A focused story excerpt for the shared e-paper article.',
      issueCityName: 'Indore',
    });

    expect(metadata).toEqual(
      expect.objectContaining({
        title: 'Front page civic lead | Lokswami E-Paper',
        description: 'A focused story excerpt for the shared e-paper article.',
        alternates: {
          canonical:
            'https://lokswami.com/main/epaper?paper=paper-1&city=indore&date=2026-05-22&page=7&story=front-lead',
        },
      })
    );
  });

  it('marks unknown category slugs as noindex while keeping known categories indexable', () => {
    const known = buildCategoryPageMetadata('politics');
    const unknown = buildCategoryPageMetadata('custom-desk');

    expect(known).toEqual(
      expect.objectContaining({
        title: 'Politics News | Lokswami',
        alternates: {
          canonical: 'https://lokswami.com/main/category/politics',
        },
        robots: expect.objectContaining({
          index: true,
          follow: true,
        }),
      })
    );

    expect(unknown).toEqual(
      expect.objectContaining({
        title: 'Custom Desk News | Lokswami',
        robots: expect.objectContaining({
          index: false,
          follow: true,
        }),
      })
    );
  });
});
