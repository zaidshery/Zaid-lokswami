import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminSessionMock = vi.fn();
const connectDBMock = vi.fn();
const articleFindByIdMock = vi.fn();
const articleFindOneAndUpdateMock = vi.fn();
const ensureBreakingTtsForArticleMock = vi.fn();
const resolveReusableBreakingTtsMock = vi.fn();
const originalMongoUri = process.env.MONGODB_URI;

vi.mock('@/lib/auth/admin', () => ({
  getAdminSessionFromReq: getAdminSessionMock,
}));

vi.mock('@/lib/db/mongoose', () => ({
  default: connectDBMock,
}));

vi.mock('@/lib/models/Article', () => ({
  default: {
    findById: articleFindByIdMock,
    findOneAndUpdate: articleFindOneAndUpdateMock,
  },
}));

vi.mock('@/lib/server/breakingTts', () => ({
  ensureBreakingTtsForArticle: ensureBreakingTtsForArticleMock,
  resolveReusableBreakingTts: resolveReusableBreakingTtsMock,
}));

vi.mock('@/lib/storage/articlesFile', () => ({
  getStoredArticleById: vi.fn(),
  isArticleVersionConflictError: vi.fn(() => false),
  updateStoredArticle: vi.fn(),
}));

const CURRENT_TTS = {
  audioUrl: 'https://cdn.example.com/current.mp3',
  textHash: 'current-hash',
  languageCode: 'hi-IN',
  voice: 'manual',
  model: 'manual',
  mimeType: 'audio/mpeg',
  generatedAt: '2026-07-14T08:00:00.000Z',
};

function createArticle(version = 4) {
  const plain = {
    _id: '665000000000000000000001',
    version,
    title: 'Breaking headline',
    author: 'Desk',
    reporterMeta: { locationTag: 'Bhopal' },
    workflow: { status: 'approved' },
    isBreaking: true,
    breakingTts: CURRENT_TTS,
    updatedAt: new Date('2026-07-14T08:00:00.000Z'),
    publishedAt: new Date('2026-07-14T07:00:00.000Z'),
  };
  return {
    ...plain,
    toObject: vi.fn(() => plain),
  };
}

function createRequest(expectedVersion: number) {
  return new NextRequest(
    `http://localhost/api/admin/articles/665000000000000000000001/breaking-tts?force=1&expectedVersion=${expectedVersion}`,
    { method: 'POST' }
  );
}

describe('/api/admin/articles/[id]/breaking-tts route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MONGODB_URI = 'mongodb://example.test/lokswami';
    connectDBMock.mockResolvedValue(undefined);
    getAdminSessionMock.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
    });
  });

  afterEach(() => {
    if (originalMongoUri === undefined) {
      delete process.env.MONGODB_URI;
    } else {
      process.env.MONGODB_URI = originalMongoUri;
    }
  });

  it('atomically advances the article version when refreshed metadata changes', async () => {
    const article = createArticle();
    const refreshedTts = {
      ...CURRENT_TTS,
      audioUrl: 'https://cdn.example.com/refreshed.mp3',
      generatedAt: '2026-07-14T09:00:00.000Z',
    };
    const updated = {
      ...article,
      version: 5,
      breakingTts: refreshedTts,
      updatedAt: new Date('2026-07-14T09:00:00.000Z'),
      toObject: vi.fn(() => ({
        ...article.toObject(),
        version: 5,
        breakingTts: refreshedTts,
      })),
    };
    articleFindByIdMock.mockResolvedValue(article);
    ensureBreakingTtsForArticleMock.mockResolvedValue(refreshedTts);
    articleFindOneAndUpdateMock.mockResolvedValue(updated);
    resolveReusableBreakingTtsMock.mockReturnValue(refreshedTts);

    const { POST } = await import('@/app/api/admin/articles/[id]/breaking-tts/route');
    const response = await POST(createRequest(4), {
      params: Promise.resolve({ id: '665000000000000000000001' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(articleFindOneAndUpdateMock).toHaveBeenCalledWith(
      {
        _id: '665000000000000000000001',
        isBreaking: true,
        version: 4,
      },
      expect.objectContaining({
        $set: expect.objectContaining({
          breakingTts: expect.objectContaining({
            audioUrl: 'https://cdn.example.com/refreshed.mp3',
          }),
        }),
        $inc: { version: 1 },
      }),
      { new: true, runValidators: true }
    );
    expect(payload.data.version).toBe(5);
  });

  it('does not advance the version when refresh metadata is unchanged', async () => {
    const article = createArticle();
    articleFindByIdMock.mockResolvedValue(article);
    ensureBreakingTtsForArticleMock.mockResolvedValue(CURRENT_TTS);

    const { POST } = await import('@/app/api/admin/articles/[id]/breaking-tts/route');
    const response = await POST(createRequest(4), {
      params: Promise.resolve({ id: '665000000000000000000001' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(articleFindOneAndUpdateMock).not.toHaveBeenCalled();
    expect(payload.data.version).toBe(4);
  });
});
