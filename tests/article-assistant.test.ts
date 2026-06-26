import { describe, expect, it } from 'vitest';
import {
  buildArticleAssistResult,
  suggestArticleFocusKeyword,
  suggestArticleSecondaryKeywords,
  summarizeArticleReadiness,
} from '@/lib/utils/articleAssistant';

describe('article assistant helpers', () => {
  it('suggests deterministic packaging fields for Hindi copy', () => {
    const result = buildArticleAssistResult({
      mode: 'create',
      title: 'इंदौर में सड़क निर्माण कार्य तेज',
      summary: '',
      content:
        '<p>इंदौर नगर निगम ने सड़क निर्माण कार्य तेज किया। अधिकारियों ने कहा कि यातायात व्यवस्था के लिए नया डायवर्जन लागू रहेगा।</p>',
      category: 'City',
      author: 'Desk',
      image: '/uploads/story.jpg',
      seoSlug: '',
      seo: {},
      language: 'hi',
    });

    expect(result.patches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'summary' }),
        expect.objectContaining({ field: 'seoTitle' }),
        expect.objectContaining({ field: 'featuredImageAlt' }),
      ])
    );
    expect(result.readiness.items.some((item) => item.id === 'seo')).toBe(true);
    expect(result.suggestions.find((item) => item.id === 'social-copy')?.value).toContain(
      'इंदौर'
    );
  });

  it('keeps empty articles blocked instead of inventing publish-ready content', () => {
    const result = buildArticleAssistResult({
      mode: 'create',
      title: '',
      summary: '',
      content: '',
      category: '',
      author: '',
      image: '',
      seo: {},
      isBreaking: true,
      breakingAudioReady: false,
      requireBreakingAudio: true,
    });
    const summary = summarizeArticleReadiness(result.readiness);

    expect(result.readiness.score).toBeLessThan(50);
    expect(result.readiness.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'title', status: 'blocked' }),
        expect.objectContaining({ id: 'summary', status: 'blocked' }),
        expect.objectContaining({ id: 'content', status: 'blocked' }),
        expect.objectContaining({ id: 'category', status: 'blocked' }),
        expect.objectContaining({ id: 'author', status: 'blocked' }),
        expect.objectContaining({ id: 'image', status: 'blocked' }),
        expect.objectContaining({ id: 'breaking-audio', status: 'blocked' }),
      ])
    );
    expect(summary.canSend).toBe(false);
    expect(summary.blockers.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        'Headline',
        'Summary',
        'Article body',
        'Category',
        'Author',
        'Featured image',
        'Breaking audio',
      ])
    );
  });

  it('only blocks breaking audio when final publish requires it', () => {
    const base = {
      mode: 'create' as const,
      title: 'Breaking headline ready',
      summary:
        'This summary has enough detail for readers and desk editors before publication.',
      content:
        '<p>This article body contains enough verified copy for the readiness model to accept the main story package before final desk review and publication.</p>',
      category: 'City',
      author: 'Desk',
      image: '/uploads/story.jpg',
      seo: {},
      isBreaking: true,
      breakingAudioReady: false,
    };

    expect(
      buildArticleAssistResult(base).readiness.items.find((item) => item.id === 'breaking-audio')
    ).toEqual(expect.objectContaining({ status: 'warning' }));
    expect(
      buildArticleAssistResult({ ...base, requireBreakingAudio: true }).readiness.items.find(
        (item) => item.id === 'breaking-audio'
      )
    ).toEqual(expect.objectContaining({ status: 'blocked' }));
  });

  it('keeps SEO, source, and heading gaps as warnings when critical fields pass', () => {
    const result = buildArticleAssistResult({
      mode: 'create',
      title: 'Indore civic update reaches residents',
      summary:
        'The civic update gives residents clear information about road changes, public access, and the next administrative steps.',
      content:
        '<p>Indore officials shared a detailed civic update for residents, with enough verified background to support publication after desk review and packaging checks.</p>',
      category: 'City',
      author: 'Desk',
      image: '/uploads/civic.jpg',
      seo: {},
    });
    const summary = summarizeArticleReadiness(result.readiness);

    expect(summary.canSend).toBe(true);
    expect(summary.blockers).toHaveLength(0);
    expect(summary.warnings.map((item) => item.id)).toEqual(
      expect.arrayContaining(['seo', 'source', 'headings'])
    );
  });

  it('respects existing editor-entered values and suggests keyword support', () => {
    const result = buildArticleAssistResult({
      mode: 'edit',
      title: 'Indore metro update for airport route',
      summary: 'The airport route update includes traffic changes and station planning details.',
      content:
        '<h2>Traffic plan</h2><p>Indore metro work continues near the airport route with new traffic management.</p><a href="/main/article/old-story">Earlier update</a>',
      category: 'City',
      author: 'Desk',
      image: '/uploads/metro.jpg',
      seoSlug: 'indore-metro-update',
      seo: {
        metaTitle: 'Indore metro update',
        metaDescription: 'Existing description',
        focusKeyword: 'metro',
        featuredImageAlt: 'Metro workers in Indore',
      },
      breakingAudioReady: true,
    });

    expect(result.patches).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'seoSlug' })])
    );
    expect(result.patches).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'secondaryKeywords' })])
    );
    expect(result.readiness.score).toBeGreaterThan(60);
  });

  it('extracts stable keyword suggestions from English text', () => {
    expect(suggestArticleFocusKeyword('Metro route metro station airport update')).toBe('Metro');
    expect(suggestArticleSecondaryKeywords('Metro route station airport update', 'Metro')).toBe(
      'route, station, airport, update'
    );
  });
});
