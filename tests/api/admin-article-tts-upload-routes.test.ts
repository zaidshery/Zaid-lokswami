import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminSessionMock = vi.fn();
const connectDBMock = vi.fn();
const articleFindByIdMock = vi.fn();
const createArticleTtsUploadTargetMock = vi.fn();
const parseArticleTtsAssetSizeMock = vi.fn();
const validateArticleTtsUploadSelectionMock = vi.fn();
const verifyArticleTtsUploadMock = vi.fn();
const buildArticleFullTtsTextMock = vi.fn();
const saveManualTtsAssetMock = vi.fn();

vi.mock('@/lib/auth/admin', () => ({
  getAdminSession: getAdminSessionMock,
}));

vi.mock('@/lib/db/mongoose', () => ({
  default: connectDBMock,
}));

vi.mock('@/lib/models/Article', () => ({
  default: {
    findById: articleFindByIdMock,
  },
}));

vi.mock('@/lib/storage/articleTtsUpload', () => ({
  createArticleTtsUploadTarget: createArticleTtsUploadTargetMock,
  parseArticleTtsAssetSize: parseArticleTtsAssetSizeMock,
  validateArticleTtsUploadSelection: validateArticleTtsUploadSelectionMock,
  verifyArticleTtsUpload: verifyArticleTtsUploadMock,
}));

vi.mock('@/lib/server/ttsAssets', () => ({
  buildArticleFullTtsText: buildArticleFullTtsTextMock,
  saveManualTtsAsset: saveManualTtsAssetMock,
}));

function createJsonRequest(url: string, body: Record<string, unknown>) {
  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function mockArticle(articleId: string) {
  articleFindByIdMock.mockReturnValue({
    select: vi.fn().mockResolvedValue({
      _id: articleId,
      title: 'Manual Audio Story',
      summary: 'Short summary',
      content: 'Full article text',
      author: 'Desk',
      workflow: { status: 'published' },
      updatedAt: new Date('2026-05-09T11:00:00.000Z'),
      publishedAt: new Date('2026-05-09T10:00:00.000Z'),
    }),
  });
}

describe('article manual TTS direct upload admin routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminSessionMock.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
    });
    connectDBMock.mockResolvedValue(undefined);
    parseArticleTtsAssetSizeMock.mockImplementation((value: unknown) => Number(value || 0));
    validateArticleTtsUploadSelectionMock.mockReturnValue(null);
    buildArticleFullTtsTextMock.mockReturnValue('Manual Audio Story. Short summary. Full article text');
  });

  it('initializes signed upload targets for editable article audio', async () => {
    const articleId = '665000000000000000000001';
    mockArticle(articleId);
    createArticleTtsUploadTargetMock.mockReturnValue({
      mediaKey: `lokswami/tts/article/${articleId}/manual/listen.mp3`,
      mediaUrl: `https://cdn.example.com/lokswami/tts/article/${articleId}/manual/listen.mp3`,
      uploadUrl: 'https://origin.example.com/signed-put',
      uploadHeaders: { 'Content-Type': 'audio/mpeg' },
      expiresAt: '2026-05-09T12:00:00.000Z',
    });

    const { POST } = await import('@/app/api/admin/uploads/article-tts/init/route');
    const response = await POST(
      createJsonRequest('http://localhost/api/admin/uploads/article-tts/init', {
        articleId,
        fileName: 'listen.mp3',
        fileType: 'audio/mpeg',
        fileSize: 1024,
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(createArticleTtsUploadTargetMock).toHaveBeenCalledWith({
      articleId,
      fileName: 'listen.mp3',
      fileType: 'audio/mpeg',
      fileSize: 1024,
    });
    expect(payload.data.uploadUrl).toBe('https://origin.example.com/signed-put');
  });

  it('saves a manual article TTS asset after upload verification', async () => {
    const articleId = '665000000000000000000001';
    const mediaKey = `lokswami/tts/article/${articleId}/manual/listen.mp3`;
    mockArticle(articleId);
    verifyArticleTtsUploadMock.mockResolvedValue({
      mediaUrl: `https://cdn.example.com/${mediaKey}`,
      mediaKey,
      mediaSizeBytes: 4096,
      mediaMimeType: 'audio/mpeg',
      storageProvider: 'do-spaces',
    });
    saveManualTtsAssetMock.mockResolvedValue({
      _id: 'tts-article-1',
      status: 'ready',
      provider: 'manual',
      audioUrl: `https://cdn.example.com/${mediaKey}`,
      voice: 'manual-upload',
      model: 'manual-upload',
      languageCode: 'manual',
      mimeType: 'audio/mpeg',
      generatedAt: new Date('2026-05-09T12:00:00.000Z'),
      updatedAt: new Date('2026-05-09T12:01:00.000Z'),
      lastVerifiedAt: new Date('2026-05-09T12:02:00.000Z'),
      chunkCount: 1,
      charCount: 48,
    });

    const { POST } = await import('@/app/api/admin/uploads/article-tts/complete/route');
    const response = await POST(
      createJsonRequest('http://localhost/api/admin/uploads/article-tts/complete', {
        articleId,
        mediaKey,
        expectedSize: 4096,
        expectedFileType: 'audio/mpeg',
        expectedFileName: 'listen.mp3',
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(verifyArticleTtsUploadMock).toHaveBeenCalledWith({
      mediaKey,
      expectedSize: 4096,
      expectedFileType: 'audio/mpeg',
      expectedFileName: 'listen.mp3',
    });
    expect(saveManualTtsAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'article',
        sourceId: articleId,
        variant: 'article_full',
        title: 'Manual Audio Story',
        text: 'Manual Audio Story. Short summary. Full article text',
        audioUrl: `https://cdn.example.com/${mediaKey}`,
        mimeType: 'audio/mpeg',
        mediaKey,
      })
    );
    expect(payload.data.ttsAsset).toEqual(
      expect.objectContaining({
        id: 'tts-article-1',
        status: 'ready',
        provider: 'manual',
        audioUrl: `https://cdn.example.com/${mediaKey}`,
      })
    );
  });
});
