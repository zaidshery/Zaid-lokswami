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

export function classifyVideoAspectRatio(
  width: number,
  height: number
): { aspectRatio: '9:16' | '16:9' | '1:1' | 'unknown'; isShort: boolean } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { aspectRatio: 'unknown', isShort: false };
  }

  // Vertical format (e.g. 9:16 or roughly 1:1.3+ ratio)
  if (height >= width * 1.2) {
    return { aspectRatio: '9:16', isShort: true };
  }

  // Landscape format (e.g. 16:9 or roughly 1.3:1+ ratio)
  if (width >= height * 1.2) {
    return { aspectRatio: '16:9', isShort: false };
  }

  // Square format (within 15% tolerance)
  if (Math.abs(width - height) <= Math.min(width, height) * 0.15) {
    return { aspectRatio: '1:1', isShort: false };
  }

  return { aspectRatio: 'unknown', isShort: false };
}

export function generateVideoSlug(title: string): string {
  const normalized = String(title || '')
    .trim()
    .toLowerCase()
    // Replace non-alphanumeric characters (except Hindi/Unicode letters, matras, and numbers) with hyphens
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
    // Remove leading and trailing hyphens
    .replace(/^-+|-+$/g, '');

  if (!normalized) {
    return `video-${Date.now()}`;
  }

  // Keep slug length manageable for URL routes
  return normalized.slice(0, 100).replace(/-+$/, '');
}

export interface ExtractedVideoMetadata {
  duration: number;
  width: number;
  height: number;
  aspectRatio: '9:16' | '16:9' | '1:1' | 'unknown';
  isShort: boolean;
  posterBlob: Blob | null;
  posterDataUrl: string;
  posterFile: File | null;
}

export function extractVideoMetadataAndPoster(
  file: File,
  captureTimeSeconds = 1.0
): Promise<ExtractedVideoMetadata> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      resolve({
        duration: 0,
        width: 0,
        height: 0,
        aspectRatio: 'unknown',
        isShort: false,
        posterBlob: null,
        posterDataUrl: '',
        posterFile: null,
      });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    let hasCleanedUp = false;
    const cleanup = () => {
      if (hasCleanedUp) return;
      hasCleanedUp = true;
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
      video.remove();
    };

    // Safety timeout in case video metadata fails to load (e.g. corrupt file)
    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve({
        duration: 0,
        width: 0,
        height: 0,
        aspectRatio: 'unknown',
        isShort: false,
        posterBlob: null,
        posterDataUrl: '',
        posterFile: null,
      });
    }, 12000);

    video.onloadedmetadata = () => {
      const rawDuration = video.duration;
      const duration = Number.isFinite(rawDuration) && rawDuration > 0
        ? Math.round(rawDuration)
        : 0;
      const width = video.videoWidth || 0;
      const height = video.videoHeight || 0;
      const { aspectRatio, isShort } = classifyVideoAspectRatio(width, height);

      // Pick a suitable frame to capture (avoid black starting frame if video is long enough)
      const seekTarget = duration > 2
        ? Math.min(captureTimeSeconds, duration - 0.5)
        : 0.2;

      const handleSeeked = () => {
        window.clearTimeout(timeoutId);
        try {
          const canvas = document.createElement('canvas');
          const canvasWidth = width || 720;
          const canvasHeight = height || 1280;
          canvas.width = canvasWidth;
          canvas.height = canvasHeight;

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);
            const posterDataUrl = canvas.toDataURL('image/jpeg', 0.88);

            canvas.toBlob(
              (blob) => {
                cleanup();
                const posterBlob = blob || null;
                const posterFile = posterBlob
                  ? new File(
                      [posterBlob],
                      `${file.name.replace(/\.[^/.]+$/, '')}-thumb.jpg`,
                      { type: 'image/jpeg' }
                    )
                  : null;

                resolve({
                  duration,
                  width,
                  height,
                  aspectRatio,
                  isShort,
                  posterBlob,
                  posterDataUrl,
                  posterFile,
                });
              },
              'image/jpeg',
              0.88
            );
            return;
          }
        } catch {
          // Canvas draw/security fallback
        }

        cleanup();
        resolve({
          duration,
          width,
          height,
          aspectRatio,
          isShort,
          posterBlob: null,
          posterDataUrl: '',
          posterFile: null,
        });
      };

      video.onseeked = handleSeeked;

      // Handle cases where seeking fails or isn't needed
      try {
        video.currentTime = seekTarget;
      } catch {
        handleSeeked();
      }
    };

    video.onerror = () => {
      window.clearTimeout(timeoutId);
      cleanup();
      resolve({
        duration: 0,
        width: 0,
        height: 0,
        aspectRatio: 'unknown',
        isShort: false,
        posterBlob: null,
        posterDataUrl: '',
        posterFile: null,
      });
    };
  });
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
