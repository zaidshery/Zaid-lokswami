const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

function normalizeHost(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, '');
}

function extractFromPath(pathname: string, prefix: string) {
  if (!pathname.startsWith(prefix)) return null;
  const value = pathname.slice(prefix.length).split('/')[0] || '';
  return value.trim();
}

/** Extracts the 11-character YouTube video / stream ID from any YouTube URL format. */
export function extractYouTubeVideoId(input: string): string | null {
  const value = (input || '').trim();
  if (!value) return null;

  if (YOUTUBE_ID_PATTERN.test(value)) {
    return value;
  }

  let url: URL;
  try {
    const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    url = new URL(normalized);
  } catch {
    return null;
  }

  const host = normalizeHost(url.hostname);
  let candidate = '';

  if (host === 'youtu.be') {
    candidate = url.pathname.split('/').filter(Boolean)[0] || '';
  } else if (
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'youtube-nocookie.com'
  ) {
    if (url.pathname === '/watch') {
      candidate = url.searchParams.get('v') || '';
    } else {
      candidate =
        extractFromPath(url.pathname, '/live/') ||
        extractFromPath(url.pathname, '/shorts/') ||
        extractFromPath(url.pathname, '/embed/') ||
        extractFromPath(url.pathname, '/v/') ||
        '';
    }
  }

  candidate = candidate.trim().split('?')[0].split('&')[0];
  return YOUTUBE_ID_PATTERN.test(candidate) ? candidate : null;
}

/** Checks if a given input string or URL is a YouTube Live stream. */
export function isYouTubeLiveUrl(input: string): boolean {
  const value = (input || '').trim().toLowerCase();
  if (!value) return false;

  if (value.includes('/live/')) return true;
  if (value.includes('live=1') || value.includes('is_live=true')) return true;

  return false;
}

/** Generates high-quality YouTube thumbnail image URLs for a video/live stream. */
export function getYouTubeThumbnail(
  input: string,
  quality: 'max' | 'hq' | 'mq' | 'default' = 'hq'
): string {
  const videoId = extractYouTubeVideoId(input);
  if (!videoId) return '';

  switch (quality) {
    case 'max':
      return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
    case 'mq':
      return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
    case 'default':
      return `https://i.ytimg.com/vi/${videoId}/default.jpg`;
    case 'hq':
    default:
      return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  }
}

export function buildYouTubeWatchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export interface YouTubeEmbedOptions {
  autoplay?: boolean;
  isLive?: boolean;
  mute?: boolean;
  controls?: boolean;
  playsinline?: boolean;
  enablejsapi?: boolean;
}

export function buildYouTubeEmbedUrl(
  videoId: string,
  options: YouTubeEmbedOptions = {}
) {
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    playsinline: options.playsinline !== false ? '1' : '0',
    controls: options.controls !== false ? '1' : '0',
    autoplay: options.autoplay ? '1' : '0',
  });

  if (options.mute) {
    params.set('mute', '1');
  }

  if (options.enablejsapi !== false) {
    params.set('enablejsapi', '1');
  }

  if (options.isLive) {
    params.set('live', '1');
  }

  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}
