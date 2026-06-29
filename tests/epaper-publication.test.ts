import { describe, expect, it } from 'vitest';
import {
  EMAGAZINE_GLOBAL_CITY_NAME,
  EMAGAZINE_GLOBAL_CITY_SLUG,
  formatPublicationIssueLabel,
  getPublicationIssueDateRange,
  normalizePublicationCityScope,
  normalizePublicationIssueDate,
  normalizePublicationIssueMonth,
} from '@/lib/utils/epaperPublication';
import {
  buildPublicEpaperMongoQuery,
  parsePublicEpaperFilters,
} from '@/lib/utils/publicEpaperFilters';

describe('e-paper publication cadence helpers', () => {
  it('keeps e-paper dates daily while normalizing e-magazines to monthly issue anchors', () => {
    expect(normalizePublicationIssueDate('2026-05-18', 'epaper')).toBe('2026-05-18');
    expect(normalizePublicationIssueDate('2026-05-18', 'emagazine')).toBe('2026-05-01');
    expect(normalizePublicationIssueDate('2026-05', 'emagazine')).toBe('2026-05-01');
    expect(normalizePublicationIssueMonth('2026-05-18')).toBe('2026-05');
    expect(formatPublicationIssueLabel('2026-05-18', 'emagazine')).toBe('May 2026');
  });

  it('builds monthly database ranges for e-magazines', () => {
    const range = getPublicationIssueDateRange('2026-05-18', 'emagazine');

    expect(range?.$gte.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(range?.$lt.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('normalizes e-magazines to a global monthly scope', () => {
    expect(
      normalizePublicationCityScope({
        publicationType: 'emagazine',
        citySlug: 'indore',
        cityName: 'Indore',
      })
    ).toEqual({
      citySlug: EMAGAZINE_GLOBAL_CITY_SLUG,
      cityName: EMAGAZINE_GLOBAL_CITY_NAME,
      isGlobal: true,
    });
  });

  it('treats e-magazine date filters as month filters in public APIs', () => {
    const params = new URLSearchParams({
      publicationType: 'emagazine',
      citySlug: 'indore',
      date: '2026-05-18',
    });
    const parsed = parsePublicEpaperFilters(params);

    expect('error' in parsed).toBe(false);
    if ('error' in parsed) return;

    expect(parsed.filters.date).toBe('');
    expect(parsed.filters.parsedDate).toBeNull();
    expect(parsed.filters.month).toBe('2026-05');
    expect(parsed.filters.citySlug).toBe('');

    const query = buildPublicEpaperMongoQuery(parsed.filters, {
      status: 'published',
    });
    expect(query).toMatchObject({
      publicationType: 'emagazine',
      status: 'published',
      publishDate: {
        $gte: new Date('2026-05-01T00:00:00.000Z'),
        $lt: new Date('2026-06-01T00:00:00.000Z'),
      },
    });
  });
});
