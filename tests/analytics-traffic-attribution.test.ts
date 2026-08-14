import { describe, expect, it } from 'vitest';
import { parseTrafficSource } from '@/lib/analytics/trafficSource';

describe('SEO Phase 6 - Newsroom Analytics Traffic Attribution', () => {
  it('classifies empty referrer as direct traffic', () => {
    const res = parseTrafficSource({
      currentUrl: 'https://lokswami.com/main/article/indore-swachh-city',
      referrerUrl: '',
    });

    expect(res.channel).toBe('direct');
    expect(res.source).toBe('direct');
    expect(res.medium).toBe('none');
    expect(res.isInitialAcquisition).toBe(true);
  });

  it('classifies Google Search referrer as organic_search', () => {
    const res = parseTrafficSource({
      currentUrl: 'https://lokswami.com/main/article/indore-swachh-city',
      referrerUrl: 'https://www.google.co.in/',
    });

    expect(res.channel).toBe('organic_search');
    expect(res.source).toBe('google');
    expect(res.medium).toBe('organic');
    expect(res.isInitialAcquisition).toBe(true);
  });

  it('classifies WhatsApp/Social referrers correctly', () => {
    const whatsapp = parseTrafficSource({
      currentUrl: 'https://lokswami.com/main/article/indore-swachh-city',
      referrerUrl: 'https://api.whatsapp.com/',
    });
    expect(whatsapp.channel).toBe('social');
    expect(whatsapp.source).toBe('whatsapp');

    const facebook = parseTrafficSource({
      currentUrl: 'https://lokswami.com/main/article/indore-swachh-city',
      referrerUrl: 'https://m.facebook.com/',
    });
    expect(facebook.channel).toBe('social');
    expect(facebook.source).toBe('facebook');
  });

  it('parses UTM parameters and attributes campaigns', () => {
    const res = parseTrafficSource({
      currentUrl:
        'https://lokswami.com/main/article/indore-swachh-city?utm_source=whatsapp&utm_medium=social&utm_campaign=morning_bulletin',
      referrerUrl: '',
    });

    expect(res.channel).toBe('social');
    expect(res.source).toBe('whatsapp');
    expect(res.campaign).toBe('morning_bulletin');
  });

  it('preserves existing acquisition source during internal navigation', () => {
    const existing = {
      channel: 'organic_search' as const,
      source: 'google',
      medium: 'organic',
      isInitialAcquisition: true,
    };

    const res = parseTrafficSource({
      currentUrl: 'https://lokswami.com/main/article/next-story',
      referrerUrl: 'https://lokswami.com/main/article/first-story',
      existingSessionSource: existing,
    });

    expect(res.channel).toBe('organic_search');
    expect(res.source).toBe('google');
    expect(res.isInitialAcquisition).toBe(false);
  });
});
