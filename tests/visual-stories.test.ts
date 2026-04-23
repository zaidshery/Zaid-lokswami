import { describe, expect, it } from 'vitest';
import { mapLiveStoriesToVisualStories } from '@/lib/content/visualStories';

describe('visual stories mapping', () => {
  it('preserves uploaded gallery assets for public story playback', () => {
    const stories = mapLiveStoriesToVisualStories([
      {
        _id: 'story-1',
        title: 'Gallery Story',
        caption: 'A full gallery story',
        thumbnail: 'https://cdn.example.com/cover.jpg',
        mediaType: 'video',
        mediaUrl: 'https://cdn.example.com/lead-video.mp4',
        mediaAssets: [
          {
            id: 'image-1',
            kind: 'image',
            url: 'https://cdn.example.com/image-1.jpg',
            key: 'stories/images/image-1.jpg',
            mimeType: 'image/jpeg',
            sizeBytes: 1024,
            storageProvider: 'do-spaces',
            originalFileName: 'image-1.jpg',
            order: 0,
            createdAt: '2026-04-20T10:00:00.000Z',
          },
          {
            id: 'video-1',
            kind: 'video',
            url: 'https://cdn.example.com/video-1.mp4',
            key: 'stories/videos/video-1.mp4',
            mimeType: 'video/mp4',
            sizeBytes: 10 * 1024 * 1024,
            storageProvider: 'do-spaces',
            originalFileName: 'video-1.mp4',
            order: 1,
            createdAt: '2026-04-20T10:01:00.000Z',
          },
        ],
      },
    ]);

    expect(stories).toHaveLength(1);
    expect(stories[0]?.mediaAssets.map((asset) => asset.id)).toEqual(['image-1', 'video-1']);
    expect(stories[0]?.thumbnail).toBe('https://cdn.example.com/image-1.jpg');
    expect(stories[0]?.mediaUrl).toBe('https://cdn.example.com/video-1.mp4');
  });

  it('builds a fallback gallery for legacy public stories without mediaAssets', () => {
    const stories = mapLiveStoriesToVisualStories([
      {
        _id: 'legacy-story',
        title: 'Legacy Story',
        thumbnail: 'https://cdn.example.com/legacy-cover.jpg',
        mediaType: 'video',
        mediaUrl: 'https://cdn.example.com/legacy-video.mp4',
      },
    ]);

    expect(stories).toHaveLength(1);
    expect(stories[0]?.mediaAssets).toHaveLength(2);
    expect(stories[0]?.mediaAssets.map((asset) => asset.kind)).toEqual(['image', 'video']);
    expect(stories[0]?.mediaAssets.map((asset) => asset.id)).toEqual([
      'legacy-story-image-fallback',
      'legacy-story-video-fallback',
    ]);
  });
});
