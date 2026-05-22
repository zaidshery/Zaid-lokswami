import { describe, expect, it } from 'vitest';
import {
  buildArticleWhatsAppShareText,
  buildEpaperIssueShareText,
  buildEpaperSharePath,
  buildEpaperStoryShareText,
} from '@/lib/utils/articleShare';

describe('article and e-paper share helpers', () => {
  it('builds article share text with source, category, summary, and CTA', () => {
    const text = buildArticleWhatsAppShareText({
      title: 'Indore civic update reaches readers',
      summary: 'Officials shared the latest traffic and public service details.',
      category: 'Regional',
      articleUrl: 'https://lokswami.com/main/article/indore-civic-update',
    });

    expect(text.split('\n')).toEqual([
      'Lokswami | Regional',
      'Indore civic update reaches readers',
      'Officials shared the latest traffic and public service details.',
      'Read full story: https://lokswami.com/main/article/indore-civic-update',
    ]);
  });

  it('keeps e-paper share paths short and issue-focused', () => {
    expect(
      buildEpaperSharePath({
        paperId: 'epaper-1',
        page: 6,
        story: 'front-page-story',
      })
    ).toBe('/main/epaper?paper=epaper-1&page=6&story=front-page-story');
  });

  it('builds e-paper issue and story share text with clear CTAs', () => {
    const issueText = buildEpaperIssueShareText({
      title: 'Lokswami - Indore Edition',
      cityLabel: 'Indore',
      dateLabel: '22/05/26',
      issueUrl: 'https://lokswami.com/main/epaper?paper=epaper-1&page=1',
    });
    const storyText = buildEpaperStoryShareText({
      title: 'Mapped story headline',
      paperTitle: 'Lokswami - Indore Edition',
      excerpt: 'A short readable excerpt from the e-paper story.',
      page: 3,
      storyUrl: 'https://lokswami.com/main/epaper?paper=epaper-1&page=3&story=story-1',
    });

    expect(issueText).toContain('Open e-paper: https://lokswami.com/main/epaper?paper=epaper-1&page=1');
    expect(storyText).toContain('Lokswami - Indore Edition | Page 3');
    expect(storyText).toContain('Read in e-paper: https://lokswami.com/main/epaper?paper=epaper-1&page=3&story=story-1');
  });
});
