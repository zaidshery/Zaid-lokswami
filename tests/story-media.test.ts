import { describe, expect, it } from 'vitest';
import {
  createStoryMediaAsset,
  derivePrimaryStoryMedia,
  normalizeStoryMediaAssets,
  validateStoryMediaAssets,
} from '@/lib/content/storyMedia';

describe('story media helpers', () => {
  it('requires at least one image and one video for a complete package', () => {
    const assets = [
      createStoryMediaAsset({
        kind: 'image',
        url: 'https://cdn.example.com/image-1.jpg',
        key: '',
        mimeType: 'image/jpeg',
        sizeBytes: 1200,
        storageProvider: 'do-spaces',
        originalFileName: 'image-1.jpg',
        order: 0,
      }),
    ];

    expect(
      validateStoryMediaAssets(assets, {
        requireCompletePackage: true,
      })
    ).toBe('At least 1 video is required for this story.');
  });

  it('rejects packages above the configured image and video caps', () => {
    const images = Array.from({ length: 6 }, (_, index) =>
      createStoryMediaAsset({
        kind: 'image',
        url: `https://cdn.example.com/image-${index}.jpg`,
        key: '',
        mimeType: 'image/jpeg',
        sizeBytes: 1200,
        storageProvider: 'do-spaces',
        originalFileName: `image-${index}.jpg`,
        order: index,
      })
    );

    expect(validateStoryMediaAssets(images)).toBe('You can upload up to 5 images per story.');
  });

  it('rejects packages above the configured total video size cap', () => {
    const videos = Array.from({ length: 6 }, (_, index) =>
      createStoryMediaAsset({
        kind: 'video',
        url: `https://cdn.example.com/video-${index}.mp4`,
        key: `stories/videos/2026/04/20/video-${index}.mp4`,
        mimeType: 'video/mp4',
        sizeBytes: 90 * 1024 * 1024,
        storageProvider: 'do-spaces',
        originalFileName: `video-${index}.mp4`,
        order: index,
      })
    );

    expect(validateStoryMediaAssets(videos)).toBe('Total video size must be 500 MB or smaller per story.');
  });

  it('derives the primary story thumbnail and lead video from the asset list', () => {
    const assets = normalizeStoryMediaAssets([
      {
        id: 'image-1',
        kind: 'image',
        url: 'https://cdn.example.com/image-1.jpg',
        key: '',
        mimeType: 'image/jpeg',
        sizeBytes: 1000,
        storageProvider: 'do-spaces',
        originalFileName: 'image-1.jpg',
        order: 0,
        createdAt: '2026-04-18T00:00:00.000Z',
      },
      {
        id: 'video-1',
        kind: 'video',
        url: 'https://cdn.example.com/video-1.mp4',
        key: 'stories/videos/2026/04/18/video-1.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 1500,
        storageProvider: 'do-spaces',
        originalFileName: 'video-1.mp4',
        order: 1,
        createdAt: '2026-04-18T00:01:00.000Z',
      },
    ]);

    expect(derivePrimaryStoryMedia(assets)).toEqual({
      thumbnail: 'https://cdn.example.com/image-1.jpg',
      mediaType: 'video',
      mediaUrl: 'https://cdn.example.com/video-1.mp4',
      mediaKey: 'stories/videos/2026/04/18/video-1.mp4',
      mediaSizeBytes: 1500,
      mediaMimeType: 'video/mp4',
      storageProvider: 'do-spaces',
    });
  });
});
