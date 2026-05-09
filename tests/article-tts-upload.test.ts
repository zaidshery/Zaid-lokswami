import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildDigitalOceanSpacesPublicUrlMock = vi.fn();
const createDigitalOceanSpacesBrowserUploadTargetMock = vi.fn();
const verifyDigitalOceanSpacesUploadedObjectMock = vi.fn();

vi.mock('@/lib/utils/digitalOceanSpaces', () => ({
  buildDigitalOceanSpacesPublicUrl: buildDigitalOceanSpacesPublicUrlMock,
  createDigitalOceanSpacesBrowserUploadTarget: createDigitalOceanSpacesBrowserUploadTargetMock,
  verifyDigitalOceanSpacesUploadedObject: verifyDigitalOceanSpacesUploadedObjectMock,
}));

describe('article manual TTS uploads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildDigitalOceanSpacesPublicUrlMock.mockImplementation(
      (key: string) => `https://cdn.example.com/${key}`
    );
    createDigitalOceanSpacesBrowserUploadTargetMock.mockImplementation(
      ({ key, contentType }: { key: string; contentType: string }) => ({
        publicId: key,
        secureUrl: `https://cdn.example.com/${key}`,
        uploadUrl: `https://origin.example.com/${key}`,
        uploadHeaders: { 'Content-Type': contentType },
        expiresAt: '2026-05-09T12:00:00.000Z',
      })
    );
  });

  it('validates article audio selection before creating upload targets', async () => {
    const {
      ARTICLE_TTS_UPLOAD_MAX_BYTES,
      validateArticleTtsUploadSelection,
    } = await import('@/lib/storage/articleTtsUpload');

    expect(
      validateArticleTtsUploadSelection({
        articleId: 'article-1',
        fileName: 'listen.mp3',
        fileType: 'audio/mpeg',
        fileSize: 1024,
      })
    ).toBeNull();

    expect(
      validateArticleTtsUploadSelection({
        articleId: 'article-1',
        fileName: 'listen.txt',
        fileType: 'text/plain',
        fileSize: 1024,
      })
    ).toBe('Article audio must be MP3, WAV, or M4A.');

    expect(
      validateArticleTtsUploadSelection({
        articleId: 'article-1',
        fileName: 'listen.wav',
        fileType: 'audio/wav',
        fileSize: ARTICLE_TTS_UPLOAD_MAX_BYTES + 1,
      })
    ).toBe('Article audio must be 50MB or smaller.');
  });

  it('builds stable article manual audio object keys', async () => {
    const { buildArticleTtsObjectKey } = await import('@/lib/storage/articleTtsUpload');

    expect(
      buildArticleTtsObjectKey({
        articleId: '665000000000000000000001',
        fileName: 'Manual Listen.m4a',
        fileType: 'audio/mp4',
        fileSize: 2048,
      })
    ).toMatch(
      /^lokswami\/tts\/article\/665000000000000000000001\/manual\/\d{8}T\d{6}Z-[a-f0-9-]+-manual-listen\.m4a$/
    );
  });

  it('rejects invalid article audio prefixes before verification', async () => {
    const { verifyArticleTtsUpload } = await import('@/lib/storage/articleTtsUpload');

    await expect(
      verifyArticleTtsUpload({
        mediaKey: 'lokswami/tts/epaperArticle/story-1/manual/listen.mp3',
        expectedSize: 1024,
        expectedFileType: 'audio/mpeg',
        expectedFileName: 'listen.mp3',
      })
    ).rejects.toThrow('Uploaded article audio key is invalid.');
    expect(verifyDigitalOceanSpacesUploadedObjectMock).not.toHaveBeenCalled();
  });

  it('verifies completed article audio uploads through Spaces', async () => {
    const { verifyArticleTtsUpload } = await import('@/lib/storage/articleTtsUpload');
    const mediaKey = 'lokswami/tts/article/article-1/manual/listen.mp3';
    verifyDigitalOceanSpacesUploadedObjectMock.mockResolvedValue({
      publicId: mediaKey,
      bytes: 4096,
      contentType: 'audio/mpeg',
    });

    await expect(
      verifyArticleTtsUpload({
        mediaKey,
        expectedSize: 4096,
        expectedFileType: 'audio/mpeg',
        expectedFileName: 'listen.mp3',
      })
    ).resolves.toEqual({
      mediaUrl: `https://cdn.example.com/${mediaKey}`,
      mediaKey,
      mediaSizeBytes: 4096,
      mediaMimeType: 'audio/mpeg',
      storageProvider: 'do-spaces',
    });

    expect(verifyDigitalOceanSpacesUploadedObjectMock).toHaveBeenCalledWith({ key: mediaKey });
  });
});
