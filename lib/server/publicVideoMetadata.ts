import { Types } from 'mongoose';
import { isMongoAvailable } from '@/lib/db/mongoAvailability';
import Video from '@/lib/models/Video';
import { getStoredVideoById } from '@/lib/storage/videosFile';

export type PublicVideoMetadata = {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  videoUrl: string;
  duration: number;
  category: string;
  isShort: boolean;
  views: number;
  publishedAt: string;
};

type PublicVideoSource = {
  _id?: string;
  id?: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  videoUrl?: string;
  duration?: number;
  category?: string;
  isShort?: boolean;
  isPublished?: boolean;
  views?: number;
  publishedAt?: string | Date;
};

function getYouTubeId(value: string) {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();

    if (host === 'youtu.be') return url.pathname.slice(1) || '';
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') return url.searchParams.get('v') || '';
      if (url.pathname.startsWith('/shorts/')) return url.pathname.split('/')[2] || '';
      if (url.pathname.startsWith('/embed/')) return url.pathname.split('/')[2] || '';
    }
  } catch {
    return '';
  }

  return '';
}

function resolveThumbnail(thumbnail: string, videoUrl: string) {
  const normalizedThumbnail = thumbnail.trim();
  if (normalizedThumbnail) return normalizedThumbnail;

  const youTubeId = getYouTubeId(videoUrl);
  if (youTubeId) return `https://img.youtube.com/vi/${youTubeId}/hqdefault.jpg`;

  return '/lokswami-share-preview.png';
}

function toIsoDate(value: unknown) {
  const parsed = new Date(
    value instanceof Date || typeof value === 'string' || typeof value === 'number'
      ? value
      : Date.now()
  );
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

function toPublicVideo(input: PublicVideoSource | null | undefined): PublicVideoMetadata | null {
  if (!input) return null;

  const id =
    typeof input._id === 'string'
      ? input._id
      : input._id
        ? String(input._id)
        : typeof input.id === 'string'
          ? input.id
          : '';
  const title = String(input.title || '').trim();

  if (!id || !title || input.isPublished === false) return null;

  const videoUrl = String(input.videoUrl || '').trim();

  return {
    id,
    title,
    description: String(input.description || '').trim(),
    thumbnail: resolveThumbnail(String(input.thumbnail || ''), videoUrl),
    videoUrl,
    duration: Math.max(1, Math.floor(Number(input.duration) || 1)),
    category: String(input.category || 'Videos').trim() || 'Videos',
    isShort: Boolean(input.isShort),
    views: Math.max(0, Math.floor(Number(input.views) || 0)),
    publishedAt: toIsoDate(input.publishedAt),
  };
}

async function getMongoVideo(id: string) {
  if (!(await isMongoAvailable({ label: 'public video metadata lookup' }))) {
    return null;
  }

  try {
    if (!Types.ObjectId.isValid(id)) return null;

    const record = await Video.findOne({ _id: id, isPublished: true })
      .select('_id title description thumbnail videoUrl duration category isShort isPublished views publishedAt')
      .lean<PublicVideoSource | null>();

    return toPublicVideo(record);
  } catch (error) {
    console.error('Failed to load public video metadata from MongoDB, falling back.', error);
    return null;
  }
}

async function getStoredVideo(id: string) {
  const record = await getStoredVideoById(id);
  return toPublicVideo(record || null);
}

export async function getPublicVideoForMetadata(id: string): Promise<PublicVideoMetadata | null> {
  const normalizedId = id.trim();
  if (!normalizedId) return null;

  const mongoRecord = await getMongoVideo(normalizedId);
  if (mongoRecord) return mongoRecord;

  return getStoredVideo(normalizedId);
}
