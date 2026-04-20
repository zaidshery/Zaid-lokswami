import { describe, expect, it } from 'vitest';
import { validateStoryVideoSelection } from '@/lib/storage/storyVideoUpload';
import { validateStoryVideoFile } from '@/lib/utils/storyVideoUploadClient';

describe('story video upload validation', () => {
  it('accepts MP4 files up to 100 MB', () => {
    const file = {
      name: 'clip.mp4',
      type: 'video/mp4',
      size: 100 * 1024 * 1024,
    } as File;

    expect(validateStoryVideoFile(file)).toBeNull();
    expect(
      validateStoryVideoSelection({
        fileName: 'clip.mp4',
        fileType: 'video/mp4',
        fileSize: 100 * 1024 * 1024,
      })
    ).toBeNull();
  });

  it('rejects MP4 files above 100 MB', () => {
    const file = {
      name: 'clip.mp4',
      type: 'video/mp4',
      size: 101 * 1024 * 1024,
    } as File;

    expect(validateStoryVideoFile(file)).toBe('Video must be 100 MB or smaller.');
    expect(
      validateStoryVideoSelection({
        fileName: 'clip.mp4',
        fileType: 'video/mp4',
        fileSize: 101 * 1024 * 1024,
      })
    ).toBe('Video must be 100 MB or smaller.');
  });
});
