import { describe, expect, it } from 'vitest';
import {
  parseArticleEditorialTimestamp,
  resolveArticleEditorialFlags,
} from '@/lib/content/articleEditorial';

describe('article editorial flag windows', () => {
  it('interprets newsroom datetime-local values in Asia/Calcutta', () => {
    expect(parseArticleEditorialTimestamp('2026-07-13T12:00')).toBe(
      new Date('2026-07-13T12:00:00+05:30').getTime()
    );
  });

  it('automatically hides breaking before start and after expiry', () => {
    const now = new Date('2026-07-13T12:00:00+05:30').getTime();
    expect(resolveArticleEditorialFlags({
      isBreaking: true,
      editorial: { breakingStartsAt: '2026-07-13T12:30', breakingExpiresAt: '2026-07-13T13:30' },
    }, now).isBreaking).toBe(false);
    expect(resolveArticleEditorialFlags({
      isBreaking: true,
      editorial: { breakingStartsAt: '2026-07-13T11:30', breakingExpiresAt: '2026-07-13T11:59' },
    }, now).isBreaking).toBe(false);
    expect(resolveArticleEditorialFlags({
      isBreaking: true,
      editorial: { breakingStartsAt: '2026-07-13T11:30', breakingExpiresAt: '2026-07-13T12:30' },
    }, now).isBreaking).toBe(true);
  });

  it('automatically hides expired trending while preserving legacy flags without windows', () => {
    const now = new Date('2026-07-13T12:00:00+05:30').getTime();
    expect(resolveArticleEditorialFlags({
      isTrending: true,
      editorial: { trendingExpiresAt: '2026-07-13T11:59' },
    }, now).isTrending).toBe(false);
    expect(resolveArticleEditorialFlags({ isTrending: true }, now).isTrending).toBe(true);
  });
});
