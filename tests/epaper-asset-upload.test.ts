import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildDigitalOceanSpacesPublicUrlMock = vi.fn();
const createDigitalOceanSpacesBrowserUploadTargetMock = vi.fn();
const verifyDigitalOceanSpacesUploadedObjectMock = vi.fn();

vi.mock('@/lib/utils/digitalOceanSpaces', () => ({
  buildDigitalOceanSpacesPublicUrl: buildDigitalOceanSpacesPublicUrlMock,
  createDigitalOceanSpacesBrowserUploadTarget: createDigitalOceanSpacesBrowserUploadTargetMock,
  verifyDigitalOceanSpacesUploadedObject: verifyDigitalOceanSpacesUploadedObjectMock,
}));

describe('e-paper direct Spaces asset uploads', () => {
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
        expiresAt: '2026-05-05T12:00:00.000Z',
      })
    );
  });

  it('validates supported asset type, size, and required metadata', async () => {
    const {
      validateEpaperAssetSelection,
      EPAPER_AUDIO_UPLOAD_MAX_BYTES,
    } = await import('@/lib/storage/epaperAssetUpload');

    expect(
      validateEpaperAssetSelection({
        kind: 'epaper_pdf',
        fileName: 'indore-edition.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
        citySlug: 'Indore',
        publishDate: '2026-05-05',
      })
    ).toBeNull();

    expect(
      validateEpaperAssetSelection({
        kind: 'epaper_page_image',
        fileName: 'page-1.png',
        fileType: 'image/png',
        fileSize: 1024,
        citySlug: 'indore',
        publishDate: '2026-05-05',
      })
    ).toBe('Valid pageNumber is required for page image uploads.');

    expect(
      validateEpaperAssetSelection({
        kind: 'epaper_story_audio',
        fileName: 'listen.mp3',
        fileType: 'audio/mpeg',
        fileSize: EPAPER_AUDIO_UPLOAD_MAX_BYTES + 1,
        articleId: 'story-1',
      })
    ).toBe('Story audio must be 50MB or smaller.');
  });

  it('builds stable Spaces prefixes for edition assets and manual story audio', async () => {
    const { buildEpaperAssetObjectKey } = await import('@/lib/storage/epaperAssetUpload');

    expect(
      buildEpaperAssetObjectKey({
        kind: 'epaper_pdf',
        fileName: 'Daily Indore.pdf',
        fileType: 'application/pdf',
        fileSize: 2048,
        citySlug: 'Indore',
        publishDate: '05-05-2026',
      })
    ).toMatch(
      /^lokswami\/epapers\/indore\/2026-05-05\/pdf\/\d{8}T\d{6}Z-[a-f0-9-]+-daily-indore\.pdf$/
    );

    expect(
      buildEpaperAssetObjectKey({
        kind: 'epaper_page_image',
        fileName: 'Page 2.webp',
        fileType: 'image/webp',
        fileSize: 2048,
        citySlug: 'ujjain',
        publishDate: '2026-05-05',
        pageNumber: 2,
      })
    ).toMatch(
      /^lokswami\/epapers\/ujjain\/2026-05-05\/pages\/002-\d{8}T\d{6}Z-[a-f0-9-]+-page-2\.webp$/
    );

    expect(
      buildEpaperAssetObjectKey({
        kind: 'epaper_story_audio',
        fileName: 'Manual Listen.m4a',
        fileType: 'audio/mp4',
        fileSize: 2048,
        articleId: 'story-1',
      })
    ).toMatch(
      /^lokswami\/tts\/epaperArticle\/story-1\/manual\/\d{8}T\d{6}Z-[a-f0-9-]+-manual-listen\.m4a$/
    );
  });

  it('rejects invalid object prefixes before saving verified metadata', async () => {
    const { verifyEpaperAssetUpload } = await import('@/lib/storage/epaperAssetUpload');

    await expect(
      verifyEpaperAssetUpload({
        kind: 'epaper_pdf',
        mediaKey: 'lokswami/articles/wrong-place/edition.pdf',
        expectedFileName: 'edition.pdf',
        expectedFileType: 'application/pdf',
        expectedSize: 1024,
      })
    ).rejects.toThrow('Uploaded e-paper asset key is invalid.');
    expect(verifyDigitalOceanSpacesUploadedObjectMock).not.toHaveBeenCalled();
  });

  it('verifies completed uploads through a Spaces HEAD check', async () => {
    const { verifyEpaperAssetUpload } = await import('@/lib/storage/epaperAssetUpload');
    const mediaKey = 'lokswami/epapers/indore/2026-05-05/pages/001-page-1.jpg';
    verifyDigitalOceanSpacesUploadedObjectMock.mockResolvedValue({
      publicId: mediaKey,
      bytes: 4096,
      contentType: 'image/jpeg',
    });

    await expect(
      verifyEpaperAssetUpload({
        kind: 'epaper_page_image',
        mediaKey,
        expectedFileName: 'page-1.jpg',
        expectedFileType: 'image/jpeg',
        expectedSize: 4096,
      })
    ).resolves.toEqual({
      kind: 'epaper_page_image',
      mediaUrl: `https://cdn.example.com/${mediaKey}`,
      mediaKey,
      mediaSizeBytes: 4096,
      mediaMimeType: 'image/jpeg',
      storageProvider: 'do-spaces',
    });

    expect(verifyDigitalOceanSpacesUploadedObjectMock).toHaveBeenCalledWith({ key: mediaKey });
  });
});
