export const STORY_VIDEO_MIN_BYTES = 1;
export const STORY_VIDEO_MAX_BYTES = Math.round(1.9 * 1024 * 1024 * 1024);

export function validateStoryVideoFile(file: File) {
  const normalizedType = String(file.type || '').trim().toLowerCase();
  const normalizedName = String(file.name || '').trim().toLowerCase();

  if (normalizedType !== 'video/mp4' && !normalizedName.endsWith('.mp4')) {
    return 'Video must be an MP4 file.';
  }

  if (file.size < STORY_VIDEO_MIN_BYTES) {
    return 'Video size is invalid.';
  }

  if (file.size > STORY_VIDEO_MAX_BYTES) {
    return 'Video must be 1.9 GB or smaller.';
  }

  return null;
}

export function formatStoryVideoSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';

  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function getStoryVideoDisplayName(mediaUrl: string, fallback = 'story-video.mp4') {
  try {
    const parsed = new URL(mediaUrl);
    const segments = parsed.pathname.split('/').filter(Boolean);
    return decodeURIComponent(segments[segments.length - 1] || fallback);
  } catch {
    return fallback;
  }
}

export function uploadFileToSignedUrl(options: {
  file: File;
  uploadUrl: string;
  uploadHeaders?: Record<string, string>;
  onProgress?: (progress: number) => void;
}) {
  const { file, uploadUrl, uploadHeaders = {}, onProgress } = options;
  const corsHelpMessage =
    'Direct video upload to DigitalOcean Spaces was blocked. Add your site origin to the bucket CORS rules and allow PUT, GET, and HEAD with the Content-Type header.';

  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', uploadUrl);

    Object.entries(uploadHeaders).forEach(([key, value]) => {
      request.setRequestHeader(key, value);
    });

    request.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable || !onProgress) return;
      const progress = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
      onProgress(progress);
    });

    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }

      if (request.status === 0) {
        reject(new Error(corsHelpMessage));
        return;
      }

      reject(new Error(`Video upload failed (${request.status}).`));
    });

    request.addEventListener('error', () => {
      reject(new Error(corsHelpMessage));
    });

    request.addEventListener('abort', () => {
      reject(new Error('Video upload was cancelled.'));
    });

    request.send(file);
  });
}
