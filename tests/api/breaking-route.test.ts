import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const connectDBMock = vi.fn();
const listAllStoredArticlesMock = vi.fn();

vi.mock('@/lib/db/mongoose', () => ({
  default: connectDBMock,
}));

vi.mock('@/lib/models/Article', () => ({
  default: {
    find: vi.fn(),
  },
}));

vi.mock('@/lib/storage/articlesFile', () => ({
  listAllStoredArticles: listAllStoredArticlesMock,
}));

describe('/api/breaking route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MONGODB_URI;
  });

  it('exposes breaking audio only when stored metadata matches the current ticker script', async () => {
    const { buildBreakingTtsExpectation } = await import('@/lib/server/breakingTts');
    const readyExpected = buildBreakingTtsExpectation({
      title: 'Heavy rain alert',
      city: 'Bhopal',
    });
    const staleExpected = buildBreakingTtsExpectation({
      title: 'Old headline',
      city: 'Indore',
    });

    listAllStoredArticlesMock.mockResolvedValue([
      {
        _id: 'article-ready',
        slug: 'heavy-rain-alert',
        title: 'Heavy rain alert',
        category: 'City',
        reporterMeta: { locationTag: 'Bhopal' },
        publishedAt: '2026-05-23T10:00:00.000Z',
        views: 10,
        isBreaking: true,
        breakingTts: {
          audioUrl: 'https://cdn.example.com/ready.mp3',
          textHash: readyExpected.textHash,
          languageCode: 'en-IN',
          voice: 'manual',
          model: 'manual',
          mimeType: 'audio/mpeg',
          generatedAt: '2026-05-23T10:01:00.000Z',
        },
      },
      {
        _id: 'article-stale',
        slug: 'updated-headline',
        title: 'Updated headline',
        category: 'City',
        reporterMeta: { locationTag: 'Indore' },
        publishedAt: '2026-05-23T09:00:00.000Z',
        views: 1,
        isBreaking: true,
        breakingTts: {
          audioUrl: 'https://cdn.example.com/stale.mp3',
          textHash: staleExpected.textHash,
          languageCode: 'en-IN',
          voice: 'manual',
          model: 'manual',
          mimeType: 'audio/mpeg',
          generatedAt: '2026-05-23T09:01:00.000Z',
        },
      },
    ]);

    const { GET } = await import('@/app/api/breaking/route');
    const response = await GET(
      new Request('http://localhost/api/breaking?limit=10') as unknown as NextRequest
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'article-ready',
          city: 'Bhopal',
          ttsAudioUrl: 'https://cdn.example.com/ready.mp3',
          ttsReady: true,
        }),
        expect.objectContaining({
          id: 'article-stale',
          city: 'Indore',
        }),
      ])
    );
    const stale = payload.items.find((item: { id: string }) => item.id === 'article-stale');
    expect(stale.ttsAudioUrl).toBeUndefined();
    expect(stale.ttsReady).toBeUndefined();
  });
});
