import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildDigitalOceanSpacesPublicUrlMock = vi.fn();
const createDigitalOceanSpacesBrowserUploadTargetMock = vi.fn();
const verifyDigitalOceanSpacesUploadedObjectMock = vi.fn();

vi.mock('@/lib/utils/digitalOceanSpaces', () => ({
  buildDigitalOceanSpacesPublicUrl: buildDigitalOceanSpacesPublicUrlMock,
  createDigitalOceanSpacesBrowserUploadTarget: createDigitalOceanSpacesBrowserUploadTargetMock,
  verifyDigitalOceanSpacesUploadedObject: verifyDigitalOceanSpacesUploadedObjectMock,
}));

describe('breaking manual TTS uploads', () => {
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
        expiresAt: '2026-05-23T12:00:00.000Z',
      })
    );
  });

  it('validates breaking audio selection before creating upload targets', async () => {
    const {
      BREAKING_TTS_UPLOAD_MAX_BYTES,
      validateBreakingTtsUploadSelection,
    } = await import('@/lib/storage/breakingTtsUpload');

    expect(
      validateBreakingTtsUploadSelection({
        articleId: 'article-1',
        fileName: 'headline.mp3',
        fileType: 'audio/mpeg',
        fileSize: 1024,
      })
    ).toBeNull();

    expect(
      validateBreakingTtsUploadSelection({
        articleId: 'article-1',
        fileName: 'headline.txt',
        fileType: 'text/plain',
        fileSize: 1024,
      })
    ).toBe('Breaking audio must be MP3, WAV, or M4A.');

    expect(
      validateBreakingTtsUploadSelection({
        articleId: 'article-1',
        fileName: 'headline.wav',
        fileType: 'audio/wav',
        fileSize: BREAKING_TTS_UPLOAD_MAX_BYTES + 1,
      })
    ).toBe('Breaking audio must be 50MB or smaller.');
  });

  it('builds breaking-specific article object keys', async () => {
    const { buildBreakingTtsObjectKey } = await import('@/lib/storage/breakingTtsUpload');

    expect(
      buildBreakingTtsObjectKey({
        articleId: '665000000000000000000001',
        fileName: 'Breaking Headline.m4a',
        fileType: 'audio/mp4',
        fileSize: 2048,
      })
    ).toMatch(
      /^lokswami\/tts\/article\/665000000000000000000001\/breaking\/\d{8}T\d{6}Z-[a-f0-9-]+-breaking-headline\.m4a$/
    );
  });

  it('rejects invalid breaking audio prefixes before verification', async () => {
    const { verifyBreakingTtsUpload } = await import('@/lib/storage/breakingTtsUpload');

    await expect(
      verifyBreakingTtsUpload({
        mediaKey: 'lokswami/tts/article/article-1/manual/listen.mp3',
        expectedSize: 1024,
        expectedFileType: 'audio/mpeg',
        expectedFileName: 'listen.mp3',
      })
    ).rejects.toThrow('Uploaded breaking audio key is invalid.');
    expect(verifyDigitalOceanSpacesUploadedObjectMock).not.toHaveBeenCalled();
  });

  it('verifies completed breaking audio uploads through Spaces', async () => {
    const { verifyBreakingTtsUpload } = await import('@/lib/storage/breakingTtsUpload');
    const mediaKey = 'lokswami/tts/article/article-1/breaking/headline.mp3';
    verifyDigitalOceanSpacesUploadedObjectMock.mockResolvedValue({
      publicId: mediaKey,
      bytes: 4096,
      contentType: 'audio/mpeg',
    });

    await expect(
      verifyBreakingTtsUpload({
        mediaKey,
        expectedSize: 4096,
        expectedFileType: 'audio/mpeg',
        expectedFileName: 'headline.mp3',
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
