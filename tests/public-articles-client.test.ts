import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildPublicArticlesPath,
  fetchPublicArticlesPage,
  mapPublicArticlesToUiArticles,
  parsePublicArticlesPayload,
} from '@/lib/content/publicArticles';

describe('public article client helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parses standard v1 envelopes and maps them into reader UI articles', () => {
    const page = parsePublicArticlesPayload(
      {
        success: true,
        data: {
          items: [
            {
              id: 'article-1',
              slug: 'lead-story',
              title: 'Lead Story',
              summary: 'Lead summary',
              image: '/lead.jpg',
              category: 'Politics',
              author: 'Desk',
              publishedAt: '2026-05-09T10:00:00.000Z',
              views: 12,
            },
          ],
        },
        meta: {
          pagination: {
            limit: 20,
            hasMore: true,
            nextCursor: {
              publishedAt: '2026-05-09T10:00:00.000Z',
              id: 'article-1',
            },
          },
        },
      },
      20
    );

    expect(page.hasMore).toBe(true);
    expect(page.nextCursor?.id).toBe('article-1');
    expect(mapPublicArticlesToUiArticles(page.items)[0]).toEqual(
      expect.objectContaining({
        id: 'article-1',
        slug: 'lead-story',
        title: 'Lead Story',
        author: expect.objectContaining({ name: 'Desk' }),
      })
    );
  });

  it('builds filtered v1 paths and falls back to legacy latest when requested', async () => {
    expect(
      buildPublicArticlesPath({
        limit: 10,
        category: 'politics',
        city: 'indore',
        cursor: {
          publishedAt: '2026-05-09T10:00:00.000Z',
          id: 'article-1',
        },
      })
    ).toBe(
      '/api/v1/public/articles?limit=10&category=politics&city=indore&cursorPublishedAt=2026-05-09T10%3A00%3A00.000Z&cursorId=article-1'
    );

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: vi.fn().mockResolvedValue({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          items: [
            {
              _id: 'legacy-1',
              title: 'Legacy Story',
              summary: 'Legacy summary',
              image: '/legacy.jpg',
              publishedAt: '2026-05-09T09:00:00.000Z',
            },
          ],
          limit: 10,
          hasMore: false,
          nextCursor: null,
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const page = await fetchPublicArticlesPage(
      { limit: 10 },
      { fallbackToLegacyLatest: true }
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/public/articles?limit=10'
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/articles/latest?limit=10'
    );
    expect(page?.items[0]?._id).toBe('legacy-1');
  });
});
