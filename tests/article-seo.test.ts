import { describe, expect, it } from 'vitest';
import {
  analyzeArticleSeo,
  buildArticleGooglePreview,
  buildArticlePublicPath,
  buildNewsArticleJsonLd,
  normalizeArticleSlug,
  resolveUniqueArticleSlug,
} from '@/lib/seo/articleSeo';

describe('article SEO helpers', () => {
  it('normalizes and uniquifies public article slugs', async () => {
    expect(normalizeArticleSlug('Big Local News! 2026')).toBe('big-local-news-2026');

    const slug = await resolveUniqueArticleSlug('Big Local News', async (candidate) =>
      candidate === 'big-local-news'
    );

    expect(slug).toBe('big-local-news-2');
    expect(buildArticlePublicPath({ id: 'article-1', slug })).toBe(
      '/main/article/big-local-news-2'
    );
  });

  it('scores keyword, image, schema, and linking readiness', () => {
    const analysis = analyzeArticleSeo({
      title: 'Indore Metro update reaches readers',
      summary: 'Indore Metro work has a fresh update with traffic and timeline details.',
      content:
        '<p>Indore Metro construction entered a new phase today.</p><h2>Indore Metro route</h2><p><a href="/main/article/older-story">Background</a></p><img src="/x.jpg">',
      slug: 'indore-metro-update',
      hasFeaturedImage: true,
      hasSourceOrExternalLink: true,
      seo: {
        metaTitle: 'Indore Metro update reaches readers',
        metaDescription:
          'Indore Metro construction has a fresh update with traffic, timeline, and public movement details for local readers.',
        focusKeyword: 'Indore Metro',
        featuredImageAlt: 'Indore Metro construction update',
        includeInNewsSitemap: true,
      },
    });

    expect(analysis.score).toBeGreaterThan(80);
    expect(analysis.missingInlineImageAltCount).toBe(1);
    expect(analysis.items.find((item) => item.label === 'Internal article link added')?.done).toBe(
      true
    );
  });

  it('builds Google preview and NewsArticle JSON-LD from the same SEO values', () => {
    const preview = buildArticleGooglePreview({
      id: 'abc123',
      slug: 'indore-metro-update',
      title: 'Article title',
      summary: 'Article summary',
      image: '/image.jpg',
      seo: {
        metaTitle: 'SEO title',
        metaDescription: 'SEO description',
      },
      siteUrl: 'https://lokswami.com/',
    });

    expect(preview).toEqual(
      expect.objectContaining({
        title: 'SEO title',
        description: 'SEO description',
        url: 'https://lokswami.com/main/article/indore-metro-update',
      })
    );

    const jsonLd = buildNewsArticleJsonLd({
      id: 'abc123',
      slug: 'indore-metro-update',
      title: 'Article title',
      summary: 'Article summary',
      image: '/image.jpg',
      category: 'National',
      author: 'Desk',
      publishedAt: '2026-05-06T09:00:00.000Z',
      updatedAt: '2026-05-06T10:00:00.000Z',
      siteUrl: 'https://lokswami.com',
      seo: {
        metaTitle: 'SEO title',
        metaDescription: 'SEO description',
        authorProfileUrl: 'https://lokswami.com/authors/desk',
      },
    });

    expect(jsonLd).toEqual(
      expect.objectContaining({
        '@type': 'NewsArticle',
        headline: 'SEO title',
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': 'https://lokswami.com/main/article/indore-metro-update',
        },
      })
    );
    expect(jsonLd.author).toEqual([
      {
        '@type': 'Person',
        name: 'Desk',
        url: 'https://lokswami.com/authors/desk',
      },
    ]);
  });
});
