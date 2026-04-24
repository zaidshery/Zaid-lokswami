import { describe, expect, it } from 'vitest';
import {
  STORY_VIDEO_MAX_BYTES,
  validateStoryVideoSelection,
} from '@/lib/storage/storyVideoUpload';
import { validateStoryVideoFile } from '@/lib/utils/storyVideoUploadClient';

describe('story video upload validation', () => {
  it('accepts non-empty MP4 files up to 1.9 GB', () => {
    const file = {
      name: 'clip.mp4',
      type: 'video/mp4',
      size: STORY_VIDEO_MAX_BYTES,
    } as File;

    expect(validateStoryVideoFile(file)).toBeNull();
    expect(
      validateStoryVideoSelection({
        fileName: 'clip.mp4',
        fileType: 'video/mp4',
        fileSize: STORY_VIDEO_MAX_BYTES,
      })
    ).toBeNull();
  });

  it('rejects empty MP4 files', () => {
    const file = {
      name: 'clip.mp4',
      type: 'video/mp4',
      size: 0,
    } as File;

    expect(validateStoryVideoFile(file)).toBe('Video size is invalid.');
    expect(
      validateStoryVideoSelection({
        fileName: 'clip.mp4',
        fileType: 'video/mp4',
        fileSize: 0,
      })
    ).toBe('Video size is invalid.');
  });

  it('rejects MP4 files above 1.9 GB', () => {
    const file = {
      name: 'clip.mp4',
      type: 'video/mp4',
      size: STORY_VIDEO_MAX_BYTES + 1,
    } as File;

    expect(validateStoryVideoFile(file)).toBe('Video must be 1.9 GB or smaller.');
    expect(
      validateStoryVideoSelection({
        fileName: 'clip.mp4',
        fileType: 'video/mp4',
        fileSize: STORY_VIDEO_MAX_BYTES + 1,
      })
    ).toBe('Video must be 1.9 GB or smaller.');
  });
});
