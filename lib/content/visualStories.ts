import type { Article, Story } from '@/lib/mock/data';
import {
  createStoryMediaAsset,
  derivePrimaryStoryMedia,
  normalizeStoryMediaAssets,
  type StoryMediaAsset,
} from '@/lib/content/storyMedia';

export type VisualStory = Story & {
  href?: string;
  mediaAssets: StoryMediaAsset[];
};

const USE_REMOTE_DEMO_MEDIA =
  process.env.NEXT_PUBLIC_USE_REMOTE_DEMO_MEDIA === 'true';
const UNSPLASH_IMAGE_HOST = /^https:\/\/images\.unsplash\.com\//i;
const LOCAL_STORY_FALLBACK = '/placeholders/story-9x16.svg';

function extractYouTubeId(value: string) {
  const raw = value.trim();
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();

    if (host === 'youtu.be') {
      return (parsed.pathname.split('/').filter(Boolean)[0] || '').replace(/[^a-zA-Z0-9_-]/g, '');
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname === '/watch') {
        return (parsed.searchParams.get('v') || '').replace(/[^a-zA-Z0-9_-]/g, '');
      }
      if (parsed.pathname.startsWith('/shorts/') || parsed.pathname.startsWith('/embed/')) {
        return (parsed.pathname.split('/')[2] || '').replace(/[^a-zA-Z0-9_-]/g, '');
      }
    }

    if (host === 'img.youtube.com' || host.endsWith('.ytimg.com') || host === 'ytimg.com') {
      const segments = parsed.pathname.split('/').filter(Boolean);
      const viIndex = segments.findIndex((segment) => segment === 'vi' || segment === 'vi_webp');
      if (viIndex !== -1) {
        return (segments[viIndex + 1] || '').replace(/[^a-zA-Z0-9_-]/g, '');
      }
    }
  } catch {
    return '';
  }

  return '';
}

function toStableYouTubeThumbnail(value: string) {
  const id = extractYouTubeId(value);
  if (!id) return value.trim();
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

function normalizeStoryThumbnail(value: string) {
  const media = toStableYouTubeThumbnail(value);
  if (!media) return '';
  if (!USE_REMOTE_DEMO_MEDIA && UNSPLASH_IMAGE_HOST.test(media)) {
    return LOCAL_STORY_FALLBACK;
  }
  return media;
}

function buildStoryTitle(article: Article) {
  const title = (article.title || '').trim();
  if (!title) return 'Story';
  return title.length > 48 ? `${title.slice(0, 48).trim()}...` : title;
}

function buildFallbackMediaAssets(options: {
  storyId: string;
  thumbnail: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
}) {
  const thumbnail = normalizeStoryThumbnail(options.thumbnail);
  const mediaUrl = options.mediaUrl.trim();
  const assets: StoryMediaAsset[] = [];

  if (thumbnail) {
    assets.push(
      createStoryMediaAsset({
        id: `${options.storyId}-image-fallback`,
        kind: 'image',
        url: thumbnail,
        key: '',
        mimeType: '',
        sizeBytes: 0,
        storageProvider: '',
        originalFileName: '',
        order: 0,
      })
    );
  }

  if (options.mediaType === 'video' && mediaUrl) {
    assets.push(
      createStoryMediaAsset({
        id: `${options.storyId}-video-fallback`,
        kind: 'video',
        url: mediaUrl,
        key: '',
        mimeType: mediaUrl.toLowerCase().endsWith('.mp4') ? 'video/mp4' : '',
        sizeBytes: 0,
        storageProvider: '',
        originalFileName: '',
        order: assets.length,
      })
    );
  } else if (!assets.length && mediaUrl) {
    assets.push(
      createStoryMediaAsset({
        id: `${options.storyId}-primary-image-fallback`,
        kind: 'image',
        url: normalizeStoryThumbnail(mediaUrl),
        key: '',
        mimeType: '',
        sizeBytes: 0,
        storageProvider: '',
        originalFileName: '',
        order: 0,
      })
    );
  }

  return assets;
}

function normalizeVisualStoryMediaAssets(input: unknown) {
  const normalized = normalizeStoryMediaAssets(input).map((asset) => ({
    ...asset,
    url: asset.kind === 'image' ? normalizeStoryThumbnail(asset.url) : asset.url.trim(),
  }));

  return normalized
    .filter((asset) => Boolean(asset.url))
    .sort((left, right) => left.order - right.order)
    .map((asset, index) => ({
      ...asset,
      order: index,
    }));
}

export function buildVisualStoriesFromArticles(
  articles: Article[],
  limit = 10
): VisualStory[] {
  const sorted = [...articles].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const stories: VisualStory[] = [];
  const seen = new Set<string>();

  for (const article of sorted) {
    const image = normalizeStoryThumbnail(article.image || '');
    if (!image) continue;

    const dedupeKey = `${image}|${article.title.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    stories.push({
      id: `story-${article.id}`,
      title: buildStoryTitle(article),
      caption: article.summary,
      thumbnail: image,
      mediaType: 'image',
      mediaUrl: image,
      mediaAssets: [
        createStoryMediaAsset({
          id: `story-${article.id}-image`,
          kind: 'image',
          url: image,
          key: '',
          mimeType: 'image/jpeg',
          sizeBytes: 0,
          storageProvider: '',
          originalFileName: '',
          order: 0,
        }),
      ],
      linkLabel: 'Read Story',
      category: article.category,
      author: article.author?.name || 'Desk',
      durationSeconds: 6,
      priority: 0,
      views: article.views || 0,
      publishedAt: article.publishedAt,
      viewed: false,
      href: `/main/article/${encodeURIComponent(article.id)}`,
    });

    if (stories.length >= limit) break;
  }

  return stories;
}

type ApiStory = {
  _id?: string;
  id?: string;
  title?: string;
  caption?: string;
  thumbnail?: string;
  mediaType?: 'image' | 'video' | string;
  mediaUrl?: string;
  linkUrl?: string;
  linkLabel?: string;
  category?: string;
  author?: string;
  durationSeconds?: number;
  priority?: number;
  views?: number;
  publishedAt?: string;
  isPublished?: boolean;
  mediaAssets?: unknown;
};

function parseVideoHostFromUrl(value: string) {
  try {
    const parsed = new URL(value.trim());
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    return host;
  } catch {
    return '';
  }
}

function isLikelyVideoUrl(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;

  if (
    normalized.includes('youtube.com/watch') ||
    normalized.includes('youtube.com/shorts/') ||
    normalized.includes('youtu.be/') ||
    normalized.includes('youtube.com/embed/') ||
    normalized.includes('vimeo.com/')
  ) {
    return true;
  }

  return /\.(mp4|webm|mov|m4v|m3u8)(\?|#|$)/i.test(normalized);
}

function normalizeMediaType(
  rawMediaType: ApiStory['mediaType'],
  mediaUrl: string,
  linkUrl: string
): 'image' | 'video' {
  const normalizedMediaType = String(rawMediaType || '')
    .trim()
    .toLowerCase();

  if (normalizedMediaType === 'video') return 'video';

  if (isLikelyVideoUrl(mediaUrl)) return 'video';

  // Some stories keep external video URL in linkUrl; infer video for playback.
  const linkHost = parseVideoHostFromUrl(linkUrl);
  if (isLikelyVideoUrl(linkUrl) || linkHost === 'youtube.com' || linkHost === 'youtu.be') {
    return 'video';
  }

  return 'image';
}

function normalizeHref(rawValue: string, title: string) {
  const value = rawValue.trim();
  if (!value) return `/main/search?q=${encodeURIComponent(title)}`;

  if (
    value.startsWith('/') ||
    value.startsWith('http://') ||
    value.startsWith('https://')
  ) {
    return value;
  }

  return `/main/search?q=${encodeURIComponent(title)}`;
}

function normalizeDuration(value: number | undefined, mediaType: 'image' | 'video') {
  const fallback = mediaType === 'video' ? 8 : 6;
  if (!Number.isFinite(value)) return fallback;
  return Math.max(2, Math.min(180, Number(value)));
}

export function mapLiveStoriesToVisualStories(
  rows: ApiStory[],
  limit = 20
): VisualStory[] {
  const mapped = rows
    .map((row, index) => {
      const id = row._id || row.id || `live-story-${index}`;
      const title = (row.title || '').trim();
      const linkUrl = (row.linkUrl || '').trim();
      const rawMediaUrl = (row.mediaUrl || '').trim();
      const inferredThumb = toStableYouTubeThumbnail(rawMediaUrl || linkUrl);
      const mediaType = normalizeMediaType(row.mediaType, rawMediaUrl, linkUrl);
      const mediaSource =
        mediaType === 'video' ? rawMediaUrl || linkUrl : rawMediaUrl;
      const mediaAssets = normalizeVisualStoryMediaAssets(row.mediaAssets);
      const effectiveMediaAssets = mediaAssets.length
        ? mediaAssets
        : buildFallbackMediaAssets({
            storyId: id,
            thumbnail: String(row.thumbnail || '').trim() || inferredThumb,
            mediaType,
            mediaUrl: mediaSource || '',
          });
      const derivedPrimary = derivePrimaryStoryMedia(
        effectiveMediaAssets,
        normalizeStoryThumbnail(row.thumbnail || '') ||
          normalizeStoryThumbnail(inferredThumb)
      );
      const thumbnail = derivedPrimary.thumbnail;
      const mediaUrl = derivedPrimary.mediaUrl;
      const isPublished = row.isPublished === false ? false : true;

      if (!id || !title || !thumbnail || !isPublished) return null;

      const story: VisualStory = {
        id,
        title,
        caption: (row.caption || '').trim(),
        thumbnail,
        mediaType: derivedPrimary.mediaType,
        mediaUrl,
        mediaAssets: effectiveMediaAssets,
        linkUrl,
        linkLabel: (row.linkLabel || '').trim(),
        category: (row.category || 'General').trim(),
        author: (row.author || 'Desk').trim(),
        durationSeconds: normalizeDuration(row.durationSeconds, mediaType),
        priority: Number.isFinite(row.priority) ? Number(row.priority) : 0,
        views: Number.isFinite(row.views) ? Number(row.views) : 0,
        publishedAt: row.publishedAt || new Date().toISOString(),
        href: normalizeHref((row.linkUrl || '').trim(), title),
        viewed: false,
      };

      return story;
    })
    .filter((item): item is VisualStory => item !== null)
    .sort((a, b) => {
      const byPriority = (b.priority || 0) - (a.priority || 0);
      if (byPriority !== 0) return byPriority;
      return new Date(b.publishedAt || '').getTime() - new Date(a.publishedAt || '').getTime();
    });

  const unique = new Set<string>();
  const stories: VisualStory[] = [];

  for (const story of mapped) {
    if (unique.has(story.id)) continue;
    unique.add(story.id);
    stories.push(story);
    if (stories.length >= limit) break;
  }

  return stories;
}
