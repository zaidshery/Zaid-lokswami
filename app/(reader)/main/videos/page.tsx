import type { Metadata } from 'next';
import {
  buildVideoPageMetadata,
  buildVideosPageMetadata,
} from '@/lib/seo/readerPageMetadata';
import { getPublicVideoForMetadata } from '@/lib/server/publicVideoMetadata';
import { resolveRequestOrigin } from '@/lib/server/requestOrigin';
import VideosPageClient, {
  type PublicCursor,
  type PublicVideoFeedItem,
} from './VideosPageClient';

const VIDEOS_LIMIT = 20;

type VideosLatestResponse = {
  items?: PublicVideoFeedItem[];
  limit?: number;
  hasMore?: boolean;
  nextCursor?: PublicCursor | null;
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function parseLimit(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return VIDEOS_LIMIT;
  return parsed;
}

function toSingleString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function mapMetadataVideoToFeedItem(
  video: NonNullable<Awaited<ReturnType<typeof getPublicVideoForMetadata>>>
): PublicVideoFeedItem {
  return {
    _id: video.id,
    title: video.title,
    description: video.description,
    thumbnail: video.thumbnail,
    videoUrl: video.videoUrl,
    duration: video.duration,
    category: video.category,
    isShort: video.isShort,
    isPublished: true,
    shortsRank: 0,
    views: video.views,
    publishedAt: video.publishedAt,
  };
}

async function fetchInitialVideosFeed() {
  try {
    const origin = await resolveRequestOrigin();
    const response = await fetch(`${origin}/api/v1/public/videos?limit=${VIDEOS_LIMIT}`, {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return {
        items: [] as PublicVideoFeedItem[],
        limit: VIDEOS_LIMIT,
        hasMore: false,
        nextCursor: null as PublicCursor | null,
      };
    }

    const payload = (await response.json()) as VideosLatestResponse;
    return {
      items: Array.isArray(payload.items) ? payload.items : [],
      limit: parseLimit(payload.limit),
      hasMore: Boolean(payload.hasMore),
      nextCursor:
        payload.nextCursor &&
        typeof payload.nextCursor.publishedAt === 'string' &&
        typeof payload.nextCursor.id === 'string'
          ? payload.nextCursor
          : null,
    };
  } catch {
    return {
      items: [] as PublicVideoFeedItem[],
      limit: VIDEOS_LIMIT,
      hasMore: false,
      nextCursor: null as PublicCursor | null,
    };
  }
}

async function resolveSelectedVideo(searchParams?: Promise<Record<string, string | string[] | undefined>>) {
  const resolvedParams = searchParams ? await searchParams : {};
  const selectedVideoId = toSingleString(resolvedParams.video).trim();
  const selectedVideo = selectedVideoId
    ? await getPublicVideoForMetadata(selectedVideoId)
    : null;

  return {
    selectedVideoId,
    selectedVideo,
  };
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { selectedVideo } = await resolveSelectedVideo(searchParams);
  if (!selectedVideo) {
    return buildVideosPageMetadata();
  }

  return buildVideoPageMetadata({
    videoId: selectedVideo.id,
    title: selectedVideo.title,
    description: selectedVideo.description,
    category: selectedVideo.category,
    image: selectedVideo.thumbnail,
  });
}

export default async function VideosPage({ searchParams }: PageProps) {
  const { selectedVideoId, selectedVideo } = await resolveSelectedVideo(searchParams);
  const initial = await fetchInitialVideosFeed();
  const initialItems =
    selectedVideo && !initial.items.some((item) => item._id === selectedVideo.id)
      ? [mapMetadataVideoToFeedItem(selectedVideo), ...initial.items]
      : initial.items;

  return (
    <VideosPageClient
      initialItems={initialItems}
      initialLimit={initial.limit}
      initialHasMore={initial.hasMore}
      initialNextCursor={initial.nextCursor}
      initialSelectedVideoId={selectedVideo ? selectedVideo.id : selectedVideoId}
    />
  );
}
