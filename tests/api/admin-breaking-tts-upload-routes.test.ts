import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminSessionMock = vi.fn();
const connectDBMock = vi.fn();
const articleFindByIdMock = vi.fn();
const createBreakingTtsUploadTargetMock = vi.fn();
const parseBreakingTtsAssetSizeMock = vi.fn();
const validateBreakingTtsUploadSelectionMock = vi.fn();
const verifyBreakingTtsUploadMock = vi.fn();
const saveManualTtsAssetMock = vi.fn();

vi.mock('@/lib/auth/admin', () => ({
  getAdminSession: getAdminSessionMock,
  getAdminSessionFromReq: getAdminSessionMock,
}));

vi.mock('@/lib/db/mongoose', () => ({
  default: connectDBMock,
}));

vi.mock('@/lib/models/Article', () => ({
  default: {
    findById: articleFindByIdMock,
  },
}));

vi.mock('@/lib/storage/breakingTtsUpload', () => ({
  createBreakingTtsUploadTarget: createBreakingTtsUploadTargetMock,
  parseBreakingTtsAssetSize: parseBreakingTtsAssetSizeMock,
  validateBreakingTtsUploadSelection: validateBreakingTtsUploadSelectionMock,
  verifyBreakingTtsUpload: verifyBreakingTtsUploadMock,
}));

vi.mock('@/lib/server/ttsAssets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/ttsAssets')>();
  return {
    ...actual,
    saveManualTtsAsset: saveManualTtsAssetMock,
  };
});

function createJsonRequest(url: string, body: Record<string, unknown>) {
  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function mockBreakingArticle(articleId: string) {
  const article = {
    _id: articleId,
    title: 'Heavy rain alert',
    author: 'Desk',
    reporterMeta: { locationTag: 'Bhopal' },
    workflow: { status: 'approved' },
    isBreaking: true,
    breakingTts: null,
    updatedAt: new Date('2026-05-23T11:00:00.000Z'),
    publishedAt: new Date('2026-05-23T10:00:00.000Z'),
    toObject: vi.fn(() => ({
      _id: articleId,
      title: 'Heavy rain alert',
      author: 'Desk',
      reporterMeta: { locationTag: 'Bhopal' },
      workflow: { status: 'approved' },
      isBreaking: true,
      breakingTts: null,
      updatedAt: new Date('2026-05-23T11:00:00.000Z'),
      publishedAt: new Date('2026-05-23T10:00:00.000Z'),
    })),
    save: vi.fn().mockResolvedValue(undefined),
  };

  articleFindByIdMock.mockReturnValue({
    select: vi.fn().mockResolvedValue(article),
  });
  return article;
}

describe('breaking manual TTS direct upload admin routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminSessionMock.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
    });
    connectDBMock.mockResolvedValue(undefined);
    parseBreakingTtsAssetSizeMock.mockImplementation((value: unknown) => Number(value || 0));
    validateBreakingTtsUploadSelectionMock.mockReturnValue(null);
  });

  it('initializes signed upload targets for editable breaking audio', async () => {
    const articleId = '665000000000000000000001';
    mockBreakingArticle(articleId);
    createBreakingTtsUploadTargetMock.mockReturnValue({
      mediaKey: `lokswami/tts/article/${articleId}/breaking/headline.mp3`,
      mediaUrl: `https://cdn.example.com/lokswami/tts/article/${articleId}/breaking/headline.mp3`,
      uploadUrl: 'https://origin.example.com/signed-put',
      uploadHeaders: { 'Content-Type': 'audio/mpeg' },
      expiresAt: '2026-05-23T12:00:00.000Z',
    });

    const { POST } = await import('@/app/api/admin/uploads/breaking-tts/init/route');
    const response = await POST(
      createJsonRequest('http://localhost/api/admin/uploads/breaking-tts/init', {
        articleId,
        fileName: 'headline.mp3',
        fileType: 'audio/mpeg',
        fileSize: 1024,
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(createBreakingTtsUploadTargetMock).toHaveBeenCalledWith({
      articleId,
      fileName: 'headline.mp3',
      fileType: 'audio/mpeg',
      fileSize: 1024,
    });
    expect(payload.data.uploadUrl).toBe('https://origin.example.com/signed-put');
  });

  it('saves a breaking_headline TTS asset and updates Article.breakingTts', async () => {
    const articleId = '665000000000000000000001';
    const mediaKey = `lokswami/tts/article/${articleId}/breaking/headline.mp3`;
    const article = mockBreakingArticle(articleId);
    verifyBreakingTtsUploadMock.mockResolvedValue({
      mediaUrl: `https://cdn.example.com/${mediaKey}`,
      mediaKey,
      mediaSizeBytes: 4096,
      mediaMimeType: 'audio/mpeg',
      storageProvider: 'do-spaces',
    });
    saveManualTtsAssetMock.mockResolvedValue({
      _id: 'tts-breaking-1',
      status: 'ready',
      provider: 'manual',
      audioUrl: `https://cdn.example.com/${mediaKey}`,
      voice: 'manual-upload',
      model: 'manual-upload',
      languageCode: 'manual',
      mimeType: 'audio/mpeg',
      generatedAt: new Date('2026-05-23T12:00:00.000Z'),
      updatedAt: new Date('2026-05-23T12:01:00.000Z'),
      lastVerifiedAt: new Date('2026-05-23T12:02:00.000Z'),
      chunkCount: 1,
      charCount: 24,
    });

    const { POST } = await import('@/app/api/admin/uploads/breaking-tts/complete/route');
    const response = await POST(
      createJsonRequest('http://localhost/api/admin/uploads/breaking-tts/complete', {
        articleId,
        mediaKey,
        expectedSize: 4096,
        expectedFileType: 'audio/mpeg',
        expectedFileName: 'headline.mp3',
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(verifyBreakingTtsUploadMock).toHaveBeenCalledWith({
      mediaKey,
      expectedSize: 4096,
      expectedFileType: 'audio/mpeg',
      expectedFileName: 'headline.mp3',
    });
    expect(saveManualTtsAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'article',
        sourceId: articleId,
        variant: 'breaking_headline',
        title: 'Heavy rain alert',
        text: 'Bhopal: Heavy rain alert',
        audioUrl: `https://cdn.example.com/${mediaKey}`,
        mimeType: 'audio/mpeg',
        mediaKey,
      })
    );
    expect(article.breakingTts).toEqual(
      expect.objectContaining({
        audioUrl: `https://cdn.example.com/${mediaKey}`,
        voice: 'manual',
        model: 'manual',
        mimeType: 'audio/mpeg',
      })
    );
    expect(article.save).toHaveBeenCalled();
    expect(payload.data.breakingTts.audioUrl).toBe(`https://cdn.example.com/${mediaKey}`);
    expect(payload.data.script).toBe('Bhopal: Heavy rain alert');
  });
});
