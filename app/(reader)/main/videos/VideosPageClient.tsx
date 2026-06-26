'use client';

import Link from 'next/link';
import { startTransition, useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';
import {
  BookmarkPlus,
  Captions,
  ChevronLeft,
  Clock3,
  Grid2X2,
  Heart,
  ListVideo,
  Loader2,
  Play,
  Search,
  Share2,
  Smartphone,
  Volume2,
  VolumeX,
  Zap,
  SlidersHorizontal,
} from 'lucide-react';
import ReaderImage from '@/components/ui/ReaderImage';
import VideoPlayer from '@/components/ui/VideoPlayer';
import VideoShortsFeed, { type ShortsVideoItem } from '@/components/ui/VideoShortsFeed';
import { resolveNewsCategory } from '@/lib/constants/newsCategories';
import { useAppStore } from '@/lib/store/appStore';
import formatNumber from '@/lib/utils/formatNumber';
import { buildVideoReaderPath } from '@/lib/utils/readerContentPaths';
import { extractYouTubeVideoId } from '@/lib/utils/youtube';

const FALLBACK_VIDEO_URL = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
const FALLBACK_THUMBNAIL = '/lokswami-share-preview.png';
const VIDEO_LIKES_KEY = 'lokswami.video.likes.v1';
const VIDEO_WATCH_LATER_KEY = 'lokswami.video.watch-later.v1';
const VIDEO_PROGRESS_PREFIX = 'lokswami.video.progress.v1:';
const PLAYER_SPEED_OPTIONS = [1, 1.25, 1.5, 2] as const;

type ViewMode = 'feed' | 'shorts';
type SortMode = 'latest' | 'trending';
type StoredProgressEntry = {
  currentTime: number;
  duration: number;
  updatedAt: string;
};

export type PublicCursor = {
  publishedAt: string;
  id: string;
};

export type PublicVideoFeedItem = {
  _id: string;
  title: string;
  description: string;
  thumbnail: string;
  videoUrl: string;
  duration: number;
  category: string;
  isShort: boolean;
  isPublished: boolean;
  shortsRank: number;
  views: number;
  createdAt?: string;
  publishedAt: string;
  updatedAt?: string;
};

type VideoItem = ShortsVideoItem & {
  isShort: boolean;
  isPublished: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type VideosLatestResponse = {
  items?: PublicVideoFeedItem[];
  limit?: number;
  hasMore?: boolean;
  nextCursor?: PublicCursor | null;
};

type VideosPageClientProps = {
  initialItems: PublicVideoFeedItem[];
  initialLimit: number;
  initialHasMore: boolean;
  initialNextCursor: PublicCursor | null;
  initialSelectedVideoId?: string;
};

function safeString(value: unknown, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseLimit(value: unknown, fallback = 20) {
  const parsed = Math.floor(safeNumber(value, fallback));
  return parsed > 0 ? parsed : fallback;
}

function normalizeCategory(value: string) {
  return safeString(value).toLowerCase();
}

function getCategoryLabel(value: string, language: 'hi' | 'en') {
  const resolved = resolveNewsCategory(value);
  if (!resolved) return value || (language === 'hi' ? 'वीडियो' : 'Video');
  return language === 'hi' ? resolved.name : resolved.nameEn;
}

function isPdfThumbnail(value: string) {
  return /\.pdf($|[?#])/i.test(value) || /\/pdf\//i.test(value);
}

function formatDurationLabel(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatPlaybackSpeedLabel(speed: number) {
  return speed === 1 ? '1x' : `${speed}x`;
}

function formatCompactViews(value: number, language: 'hi' | 'en') {
  const safeValue = Math.max(0, Math.floor(value || 0));
  try {
    return new Intl.NumberFormat(language === 'hi' ? 'en-IN' : 'en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(safeValue);
  } catch {
    return formatNumber(safeValue, language === 'hi' ? 'en-IN' : 'en-US');
  }
}

function formatRelativeTime(value: string, language: 'hi' | 'en') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return language === 'hi' ? 'अभी' : 'Now';
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) {
    return language === 'hi' ? 'अभी' : 'Now';
  }

  if (diffMinutes < 60) {
    return language === 'hi' ? `${diffMinutes} मिनट पहले` : `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return language === 'hi' ? `${diffHours} घंटे पहले` : `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return language === 'hi' ? `${diffDays} दिन पहले` : `${diffDays}d ago`;
  }

  return date.toLocaleDateString(language === 'hi' ? 'en-IN' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: diffDays > 365 ? 'numeric' : undefined,
  });
}

function getYouTubeThumbnail(videoUrl: string) {
  const videoId = extractYouTubeVideoId(videoUrl);
  if (!videoId) return '';
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function resolveThumbnail(item: Pick<PublicVideoFeedItem, 'thumbnail' | 'videoUrl'>) {
  const thumbnail = safeString(item.thumbnail);
  if (thumbnail && !isPdfThumbnail(thumbnail)) {
    return thumbnail;
  }

  return getYouTubeThumbnail(item.videoUrl) || FALLBACK_THUMBNAIL;
}

function mapApiVideo(item: PublicVideoFeedItem): VideoItem {
  return {
    id: safeString(item._id),
    title: safeString(item.title, 'Lokswami Video'),
    description: safeString(item.description),
    thumbnail: resolveThumbnail(item),
    videoUrl: safeString(item.videoUrl, FALLBACK_VIDEO_URL),
    duration: Math.max(1, Math.floor(safeNumber(item.duration, 1))),
    category: safeString(item.category, 'regional'),
    views: Math.max(0, Math.floor(safeNumber(item.views, 0))),
    publishedAt: safeString(item.publishedAt, new Date().toISOString()),
    shortsRank: Math.max(0, Math.floor(safeNumber(item.shortsRank, 0))),
    isPublished: item.isPublished !== false,
    isShort: Boolean(item.isShort),
    createdAt: safeString(item.createdAt),
    updatedAt: safeString(item.updatedAt),
  };
}

function buildFallbackVideos(language: 'hi' | 'en'): VideoItem[] {
  const now = new Date();
  const baseDate = now.toISOString();

  return [
    {
      id: 'fallback-lead-video',
      title:
        language === 'hi'
          ? 'लोकस्वामी वीडियो डेस्क: आज की मुख्य खबरें'
          : 'Lokswami Video Desk: Today’s lead updates',
      description:
        language === 'hi'
          ? 'फीड खाली होने पर यह अस्थायी वीडियो दिखाई देता है, ताकि प्लेयर लेआउट काम करता रहे।'
          : 'Temporary fallback video used only when the live feed is empty, so the player layout still works.',
      thumbnail: FALLBACK_THUMBNAIL,
      videoUrl: FALLBACK_VIDEO_URL,
      duration: 225,
      category: 'regional',
      views: 1240,
      publishedAt: baseDate,
      shortsRank: 0,
      isPublished: true,
      isShort: false,
      createdAt: baseDate,
      updatedAt: baseDate,
    },
    {
      id: 'fallback-short-video',
      title:
        language === 'hi'
          ? '60 सेकंड में बड़ी खबर'
          : 'Big update in 60 seconds',
      description:
        language === 'hi'
          ? 'शॉर्ट्स मोड के लिए छोटा डेमो आइटम।'
          : 'Short demo item for the shorts mode.',
      thumbnail: FALLBACK_THUMBNAIL,
      videoUrl: FALLBACK_VIDEO_URL,
      duration: 60,
      category: 'national',
      views: 3210,
      publishedAt: new Date(now.getTime() - 1000 * 60 * 75).toISOString(),
      shortsRank: 1,
      isPublished: true,
      isShort: true,
      createdAt: baseDate,
      updatedAt: baseDate,
    },
    {
      id: 'fallback-queue-video',
      title:
        language === 'hi'
          ? 'अगला वीडियो: लोकल से नेशनल तक'
          : 'Up next: From local to national',
      description:
        language === 'hi'
          ? 'क्यू सेक्शन के लिए अतिरिक्त उदाहरण।'
          : 'Extra example item for the queue section.',
      thumbnail: FALLBACK_THUMBNAIL,
      videoUrl: FALLBACK_VIDEO_URL,
      duration: 310,
      category: 'business',
      views: 980,
      publishedAt: new Date(now.getTime() - 1000 * 60 * 60 * 6).toISOString(),
      shortsRank: 0,
      isPublished: true,
      isShort: false,
      createdAt: baseDate,
      updatedAt: baseDate,
    },
  ];
}

function mergeUniqueVideos(currentItems: VideoItem[], incomingItems: VideoItem[]) {
  const merged = new Map<string, VideoItem>();

  for (const item of currentItems) {
    if (item.id) {
      merged.set(item.id, item);
    }
  }

  for (const item of incomingItems) {
    if (!item.id) continue;
    const existing = merged.get(item.id);
    merged.set(item.id, existing ? { ...existing, ...item } : item);
  }

  return Array.from(merged.values());
}

function sortVideos(items: VideoItem[], sortMode: SortMode) {
  return [...items].sort((left, right) => {
    if (sortMode === 'trending') {
      const viewDelta = right.views - left.views;
      if (viewDelta !== 0) return viewDelta;
    }

    const dateDelta =
      new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime();
    if (dateDelta !== 0) return dateDelta;

    if (sortMode === 'trending') {
      return right.shortsRank - left.shortsRank;
    }

    return left.title.localeCompare(right.title);
  });
}

function matchesVideoSearch(item: VideoItem, query: string) {
  const normalized = safeString(query).toLowerCase();
  if (!normalized) return true;

  return [item.title, item.description, item.category].some((value) =>
    safeString(value).toLowerCase().includes(normalized)
  );
}

function buildQueueVideos(items: VideoItem[], selectedId: string) {
  if (!items.length) return [];
  const selectedIndex = items.findIndex((item) => item.id === selectedId);

  if (selectedIndex < 0) {
    return items;
  }

  return [...items.slice(selectedIndex + 1), ...items.slice(0, selectedIndex)].filter(
    (item) => item.id !== selectedId
  );
}

function readStoredIdMap(storageKey: string) {
  if (typeof window === 'undefined') return {};

  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || '{}') as Record<
      string,
      boolean
    >;
    return Object.fromEntries(
      Object.entries(parsed).filter(([key, value]) => safeString(key) && Boolean(value))
    );
  } catch {
    return {};
  }
}

function readStoredProgress(videos: VideoItem[]) {
  if (typeof window === 'undefined') return {};

  const progressById: Record<string, StoredProgressEntry> = {};

  for (const video of videos) {
    try {
      const raw = window.localStorage.getItem(`${VIDEO_PROGRESS_PREFIX}:${video.id}`);
      if (!raw) continue;

      const parsed = JSON.parse(raw) as Partial<StoredProgressEntry>;
      const currentTime = Math.max(0, safeNumber(parsed.currentTime, 0));
      const duration = Math.max(0, safeNumber(parsed.duration, video.duration));

      if (currentTime <= 0 && duration <= 0) continue;

      progressById[video.id] = {
        currentTime,
        duration,
        updatedAt: safeString(parsed.updatedAt, new Date().toISOString()),
      };
    } catch {
      // Ignore invalid local storage values.
    }
  }

  return progressById;
}

function isCompactShortsViewport() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 767px)').matches;
}

export default function VideosPageClient({
  initialItems,
  initialLimit,
  initialHasMore,
  initialNextCursor,
  initialSelectedVideoId = '',
}: VideosPageClientProps) {
  const language = useAppStore((state) => state.language);
  const setImmersiveVideoMode = useAppStore((state) => state.setImmersiveVideoMode);

  const initialVideos = initialItems.length
    ? initialItems.map(mapApiVideo)
    : buildFallbackVideos(language);
  const initialSelectedVideo = initialVideos.find((item) => item.id === initialSelectedVideoId);

  const [videos, setVideos] = useState<VideoItem[]>(initialVideos);
  const [selectedVideoId, setSelectedVideoId] = useState(
    initialSelectedVideo?.id || initialVideos[0]?.id || ''
  );
  const [mobileExpandedVideoId, setMobileExpandedVideoId] = useState(
    initialSelectedVideoId || ''
  );
  const [viewMode, setViewMode] = useState<ViewMode>(
    initialSelectedVideo?.isShort ? 'shorts' : 'feed'
  );
  const [sortMode, setSortMode] = useState<SortMode>('latest');
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [hasMore, setHasMore] = useState(Boolean(initialHasMore));
  const [nextCursor, setNextCursor] = useState<PublicCursor | null>(initialNextCursor);
  const [cursorLimit, setCursorLimit] = useState(parseLimit(initialLimit));
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({});
  const [watchLaterIds, setWatchLaterIds] = useState<Record<string, boolean>>({});
  const [resumeProgressById, setResumeProgressById] = useState<
    Record<string, StoredProgressEntry>
  >({});
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [playbackRate, setPlaybackRate] =
    useState<(typeof PLAYER_SPEED_OPTIONS)[number]>(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeDuration, setActiveDuration] = useState(0);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isOptionsExpanded, setIsOptionsExpanded] = useState(false);
  const [initialStartTime, setInitialStartTime] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsSubscribed(window.localStorage.getItem('lokswami.subscribed') === 'true');
    }
  }, []);

  const toggleSubscribed = () => {
    setIsSubscribed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('lokswami.subscribed', String(next));
      }
      return next;
    });
  };

  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    setIsHydrated(true);
    setIsCompactViewport(isCompactShortsViewport());

    if (typeof window === 'undefined') return undefined;

    const searchParams = new URLSearchParams(window.location.search);
    const t = searchParams.get('t');
    if (t) {
      const seconds = parseInt(t, 10);
      if (seconds > 0) {
        setInitialStartTime(seconds);
      }
    }

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updateViewport = () => {
      setIsCompactViewport(mediaQuery.matches);
    };

    updateViewport();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateViewport);
      return () => {
        mediaQuery.removeEventListener('change', updateViewport);
      };
    }

    mediaQuery.addListener(updateViewport);
    return () => {
      mediaQuery.removeListener(updateViewport);
    };
  }, []);

  useEffect(() => {
    const nextVideos = initialItems.length
      ? initialItems.map(mapApiVideo)
      : buildFallbackVideos(language);
    setVideos((currentVideos) => {
      if (!currentVideos.length) return nextVideos;
      return currentVideos;
    });
  }, [initialItems, language]);

  useEffect(() => {
    if (!isHydrated) return;

    setLikedIds(readStoredIdMap(VIDEO_LIKES_KEY));
    setWatchLaterIds(readStoredIdMap(VIDEO_WATCH_LATER_KEY));
    setResumeProgressById(readStoredProgress(videos));
  }, [isHydrated, videos]);

  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(VIDEO_LIKES_KEY, JSON.stringify(likedIds));
    } catch {
      // Ignore storage issues.
    }
  }, [isHydrated, likedIds]);

  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(VIDEO_WATCH_LATER_KEY, JSON.stringify(watchLaterIds));
    } catch {
      // Ignore storage issues.
    }
  }, [isHydrated, watchLaterIds]);

  const categoryOptions = ['all', ...new Set(videos.map((item) => normalizeCategory(item.category)))];

  const filteredVideos = sortVideos(
    videos.filter((item) => {
      const matchesCategory =
        activeCategory === 'all' || normalizeCategory(item.category) === activeCategory;
      return matchesCategory && matchesVideoSearch(item, deferredSearchQuery);
    }),
    sortMode
  );

  const allSortedVideos = sortVideos(videos, sortMode);
  const feedVideos = filteredVideos.filter((item) => !item.isShort);
  const shortsVideos = filteredVideos.filter((item) => item.isShort);
  const visiblePool = viewMode === 'shorts' ? shortsVideos : feedVideos;

  useEffect(() => {
    if (!visiblePool.length) return;
    if (visiblePool.some((item) => item.id === selectedVideoId)) return;
    setSelectedVideoId(visiblePool[0].id);
  }, [selectedVideoId, visiblePool]);

  const selectedVideo =
    videos.find((item) => item.id === selectedVideoId) ||
    visiblePool[0] ||
    allSortedVideos[0] ||
    null;
  const selectedVideoIsYouTube = Boolean(
    selectedVideo && extractYouTubeVideoId(selectedVideo.videoUrl)
  );

  const playbackPool = visiblePool.length ? visiblePool : allSortedVideos;
  const queueVideos = selectedVideo ? buildQueueVideos(playbackPool, selectedVideo.id) : [];
  const shortsFeed = shortsVideos.length ? shortsVideos : videos.filter((item) => item.isShort);
  const isCompactShortsMode = isCompactViewport && viewMode === 'shorts';
  const selectedProgress = selectedVideo ? resumeProgressById[selectedVideo.id] : undefined;
  const progressCurrent = currentTime || selectedProgress?.currentTime || 0;
  const progressDuration =
    activeDuration || selectedProgress?.duration || selectedVideo?.duration || 0;
  const progressPercent =
    progressDuration > 0 ? Math.min(100, (progressCurrent / progressDuration) * 100) : 0;
  const mobileFeedVideos = feedVideos;
  const mobileFeaturedVideo =
    mobileFeedVideos.find((item) => item.id === selectedVideoId) || mobileFeedVideos[0] || null;
  const mobileFeaturedProgress = mobileFeaturedVideo
    ? resumeProgressById[mobileFeaturedVideo.id]
    : undefined;
  const mobileFeaturedProgressCurrent =
    mobileFeaturedVideo && mobileFeaturedVideo.id === selectedVideo?.id
      ? progressCurrent
      : mobileFeaturedProgress?.currentTime || 0;
  const mobileFeaturedProgressDuration =
    mobileFeaturedVideo && mobileFeaturedVideo.id === selectedVideo?.id
      ? progressDuration || mobileFeaturedVideo.duration
      : mobileFeaturedProgress?.duration || mobileFeaturedVideo?.duration || 0;
  const mobileFeaturedProgressPercent =
    mobileFeaturedProgressDuration > 0
      ? Math.min(100, (mobileFeaturedProgressCurrent / mobileFeaturedProgressDuration) * 100)
      : 0;
  const mobileFeaturedIsYouTube = Boolean(
    mobileFeaturedVideo && extractYouTubeVideoId(mobileFeaturedVideo.videoUrl)
  );
  const mobileShortsPreview = shortsFeed.slice(0, 4);

  useEffect(() => {
    setImmersiveVideoMode(isCompactShortsMode);
    return () => {
      setImmersiveVideoMode(false);
    };
  }, [isCompactShortsMode, setImmersiveVideoMode]);

  useEffect(() => {
    if (!selectedVideo || typeof window === 'undefined') return;
    const nextHref = buildVideoReaderPath(selectedVideo.id);
    window.history.replaceState(null, '', nextHref);
  }, [selectedVideo]);

  useEffect(() => {
    if (!selectedVideo) return;
    const storedProgress = resumeProgressById[selectedVideo.id];
    setCurrentTime(storedProgress?.currentTime || 0);
    setActiveDuration(storedProgress?.duration || selectedVideo.duration || 0);
    setIsPaused(false);
  }, [resumeProgressById, selectedVideo]);

  const loadMoreVideos = useCallback(async () => {
    if (isLoadingMore || !hasMore || !nextCursor) return;

    setIsLoadingMore(true);
    setLoadError('');

    try {
      const params = new URLSearchParams({
        limit: String(cursorLimit),
        cursorPublishedAt: nextCursor.publishedAt,
        cursorId: nextCursor.id,
      });

      const response = await fetch(`/api/v1/public/videos?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Video feed request failed with ${response.status}`);
      }

      const payload = (await response.json()) as VideosLatestResponse;
      const incomingItems = Array.isArray(payload.items) ? payload.items.map(mapApiVideo) : [];

      setVideos((currentVideos) => mergeUniqueVideos(currentVideos, incomingItems));
      setCursorLimit(parseLimit(payload.limit, cursorLimit));
      setHasMore(Boolean(payload.hasMore));
      setNextCursor(
        payload.nextCursor &&
          safeString(payload.nextCursor.id) &&
          safeString(payload.nextCursor.publishedAt)
          ? payload.nextCursor
          : null
      );
    } catch {
      setLoadError(language === 'hi' ? 'वीडियो फिर से लोड नहीं हो पाए।' : 'Could not load more videos.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [cursorLimit, hasMore, isLoadingMore, language, nextCursor]);

  useEffect(() => {
    if (viewMode !== 'feed' || !hasMore || isLoadingMore) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const node = loadMoreSentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        if (!nextCursor) return;

        void loadMoreVideos();
      },
      { rootMargin: '240px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadMoreVideos, nextCursor, viewMode]);

  function handleVideoSelect(
    nextVideoId: string,
    nextMode?: ViewMode,
    openMobilePlayer = false
  ) {
    const nextVideo = videos.find((item) => item.id === nextVideoId);
    if (!nextVideo) return;

    startTransition(() => {
      setSelectedVideoId(nextVideoId);
      setMobileExpandedVideoId(
        openMobilePlayer && !nextVideo.isShort ? nextVideoId : ''
      );
      setCurrentTime(0);
      setInitialStartTime(0);
      setActiveDuration(nextVideo.duration || 0);
      setIsPaused(false);

      if (nextMode) {
        setViewMode(nextMode);
      }
    });

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('video', nextVideoId);
      url.searchParams.delete('t'); // Clear timestamp on video switch
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);

      if ((nextMode || viewMode) === 'feed') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  function cyclePlaybackSpeed() {
    const currentIndex = PLAYER_SPEED_OPTIONS.findIndex((value) => value === playbackRate);
    const nextIndex = currentIndex >= PLAYER_SPEED_OPTIONS.length - 1 ? 0 : currentIndex + 1;
    setPlaybackRate(PLAYER_SPEED_OPTIONS[nextIndex]);
  }

  function toggleLiked(targetVideoId = selectedVideo?.id) {
    if (!targetVideoId) return;
    setLikedIds((current) => ({
      ...current,
      [targetVideoId]: !current[targetVideoId],
    }));
  }

  function toggleWatchLater(targetVideoId = selectedVideo?.id) {
    if (!targetVideoId) return;
    setWatchLaterIds((current) => {
      const nextValue = !current[targetVideoId];
      if (!nextValue) {
        const nextState = { ...current };
        delete nextState[targetVideoId];
        return nextState;
      }

      return {
        ...current,
        [targetVideoId]: true,
      };
    });
  }

  async function shareActiveVideo(targetVideo = selectedVideo) {
    if (!targetVideo || typeof window === 'undefined') return;

    const roundedTime = Math.floor(currentTime);
    const timeParam = targetVideo.id === selectedVideo?.id && roundedTime > 0 ? `&t=${roundedTime}` : '';
    const url = `${window.location.origin}${buildVideoReaderPath(targetVideo.id)}${timeParam}`;
    const nativeShareText = `Lokswami News - ${targetVideo.title}`;
    const shareText = `${nativeShareText}\n${url}`;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: targetVideo.title,
          text: nativeShareText,
          url,
        });
        return;
      } catch {
        // Continue to fallback copy/share options.
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(shareText);
        return;
      } catch {
        // Continue to WhatsApp fallback.
      }
    }

    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      '_blank',
      'noopener,noreferrer'
    );
  }

  function handleTimeChange(nextCurrentTime: number, nextDuration: number) {
    if (!selectedVideo) return;

    const safeCurrentTime = Math.max(0, nextCurrentTime);
    const safeDuration = Math.max(0, nextDuration || selectedVideo.duration || 0);

    setCurrentTime(safeCurrentTime);
    setActiveDuration(safeDuration);
    setResumeProgressById((current) => ({
      ...current,
      [selectedVideo.id]: {
        currentTime: safeCurrentTime,
        duration: safeDuration,
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  function advanceToNextVideo() {
    if (!selectedVideo) return;

    const nextVideo =
      queueVideos[0] ||
      buildQueueVideos(allSortedVideos, selectedVideo.id)[0] ||
      null;

    if (!nextVideo) {
      setIsPaused(true);
      return;
    }

    handleVideoSelect(
      nextVideo.id,
      nextVideo.isShort ? 'shorts' : 'feed',
      isCompactViewport && !nextVideo.isShort
    );
  }

  function handleViewModeChange(nextMode: ViewMode) {
    if (nextMode === viewMode) return;

    const nextPool =
      nextMode === 'shorts'
        ? shortsFeed
        : feedVideos.length
          ? feedVideos
          : videos.filter((item) => !item.isShort);

    setViewMode(nextMode);

    if (selectedVideo && nextPool.some((item) => item.id === selectedVideo.id)) {
      return;
    }

    const nextVideo = nextPool[0];
    if (nextVideo) {
      handleVideoSelect(nextVideo.id, nextMode);
    }
  }

  const copy =
    language === 'hi'
      ? {
          eyebrow: 'लोकस्वामी वीडियो डेस्क',
          title: 'वीडियो डेस्क',
          subtitle: 'मुख्य वीडियो, छोटे अपडेट और अगली कतार एक ही जगह।',
          searchPlaceholder: 'वीडियो, कैटेगरी या टॉपिक खोजें',
          feed: 'Feed',
          shorts: 'Shorts',
          latest: 'Latest',
          trending: 'Trending',
          all: 'सभी',
          nowPlaying: 'अभी चल रहा है',
          selected: 'Selected',
          upNext: 'Up next',
          about: 'वीडियो के बारे में',
          showMore: 'पूरा देखें',
          showLess: 'कम करें',
          noResults: 'इस फिल्टर में कोई वीडियो नहीं मिला।',
          retry: 'फिर कोशिश करें',
          loadMore: 'और वीडियो लोड करें',
          loading: 'लोड हो रहा है',
          videos: 'वीडियो',
          views: 'views',
          like: 'Like',
          liked: 'Liked',
          share: 'Share',
          save: 'Watch later',
          saved: 'Saved',
          autoplay: 'Autoplay',
          speed: 'Speed',
          captions: 'CC',
          soundOn: 'Sound on',
          muted: 'Muted',
          resume: 'Resume',
          backToFeed: 'Back to feed',
          shortsNote: 'इसी फीड से निकले तेज़ वर्टिकल अपडेट्स।',
          openShorts: 'खोलें',
          watchNow: 'अभी देखें',
          hidePlayer: 'प्लेयर छुपाएँ',
          shortPicks: 'शॉर्ट पिक्स',
        }
      : {
          eyebrow: 'Lokswami video desk',
          title: 'Video Desk',
          subtitle: 'Lead videos, quick shorts, and the next queue in one place.',
          searchPlaceholder: 'Search videos, category, or topic',
          feed: 'Feed',
          shorts: 'Shorts',
          latest: 'Latest',
          trending: 'Trending',
          all: 'All',
          nowPlaying: 'Now playing',
          selected: 'Selected',
          upNext: 'Up next',
          about: 'About this video',
          showMore: 'Show more',
          showLess: 'Show less',
          noResults: 'No videos match this filter yet.',
          retry: 'Try again',
          loadMore: 'Load more videos',
          loading: 'Loading',
          videos: 'videos',
          views: 'views',
          like: 'Like',
          liked: 'Liked',
          share: 'Share',
          save: 'Watch later',
          saved: 'Saved',
          autoplay: 'Autoplay',
          speed: 'Speed',
          captions: 'CC',
          soundOn: 'Sound on',
          muted: 'Muted',
  resume: 'Resume',
          backToFeed: 'Back to feed',
          shortsNote: 'Quick vertical updates pulled from the same feed.',
          openShorts: 'Open',
          watchNow: 'Watch now',
        };

  if (isCompactShortsMode) {
    return (
      <section className="min-h-screen bg-[#080809] text-white">
        <div className="mx-auto flex w-full max-w-[430px] items-center justify-between px-3 pb-3 pt-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#ff6b5f]">
              {copy.eyebrow}
            </p>
            <h1 className="mt-1 text-base font-semibold">{copy.shorts}</h1>
          </div>

          <button
            type="button"
            onClick={() => handleViewModeChange('feed')}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white"
          >
            {copy.backToFeed}
          </button>
        </div>

        <VideoShortsFeed
          videos={shortsFeed}
          language={language}
          immersiveMode
          onReachEnd={hasMore ? () => void loadMoreVideos() : undefined}
        />
      </section>
    );
  }

  if (isCompactViewport) {
    const isMobileFeaturedPlayerOpen =
      Boolean(mobileFeaturedVideo) && mobileExpandedVideoId === mobileFeaturedVideo?.id;
    const mobileFeaturedDescription = safeString(
      mobileFeaturedVideo?.description || mobileFeaturedVideo?.title
    );
    const feedVideosFiltered = filteredVideos.filter((item) => !item.isShort);
    const mobileFeedQueue = mobileFeaturedVideo
      ? buildQueueVideos(feedVideosFiltered, mobileFeaturedVideo.id)
      : [];

    return (
      <section className="-mx-3 w-[calc(100%+1.5rem)] bg-white text-zinc-950 dark:bg-[#0f0f0f] dark:text-white sm:-mx-5 sm:w-[calc(100%+2.5rem)]">
        <div className="mx-auto w-full max-w-[480px]">

          {/* Mobile Header: Single Row containing Feed, Shorts, Search Bar, Option */}
          {!isMobileFeaturedPlayerOpen && (
            <div className="sticky top-[var(--reader-top-chrome-height)] z-30 border-b border-zinc-200 bg-white/95 px-3 py-2 shadow-[0_8px_20px_rgba(0,0,0,0.08)] backdrop-blur dark:border-white/5 dark:bg-[#0f0f0f]/95 dark:shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
              <div className="flex items-center justify-between gap-2">
                {/* Tabs: Feed & Shorts */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleViewModeChange('feed')}
                    className={`flex items-center gap-1 shrink-0 rounded-full px-2.5 py-1.5 text-xs font-semibold transition ${
                      viewMode === 'feed'
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15'
                    }`}
                  >
                    <Play className={`h-3 w-3 ${viewMode === 'feed' ? 'fill-current' : ''}`} />
                    {copy.feed}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleViewModeChange('shorts')}
                    className={`flex items-center gap-1 shrink-0 rounded-full px-2.5 py-1.5 text-xs font-semibold transition ${
                      viewMode === 'shorts'
                        ? 'bg-[#ff3b30] text-white'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15'
                    }`}
                  >
                    <Zap className="h-3 w-3 fill-current" />
                    {copy.shorts}
                  </button>
                </div>

                {/* Search Bar */}
                <div className="flex-1 relative min-w-0">
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={language === 'hi' ? 'खोजें...' : 'Search...'}
                    className="w-full rounded-full border border-zinc-200 bg-zinc-100 py-1.5 pl-8 pr-7 text-xs text-zinc-900 outline-none transition-all placeholder:text-zinc-400 hover:bg-zinc-200 focus:border-zinc-300 focus:bg-zinc-100 dark:border-transparent dark:bg-white/10 dark:text-white dark:placeholder:text-white/40 dark:hover:bg-white/15 dark:focus:border-white/20 dark:focus:bg-white/15"
                    aria-label={copy.searchPlaceholder}
                  />
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500 dark:text-white/50" />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 hover:bg-zinc-200 dark:hover:bg-white/10"
                    >
                      <svg className="h-3.5 w-3.5 text-zinc-500 dark:text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Option Button */}
                <button
                  type="button"
                  onClick={() => setIsOptionsExpanded(prev => !prev)}
                  className={`p-1.5 rounded-full transition-colors active:scale-95 flex items-center justify-center shrink-0 border ${
                    isOptionsExpanded
                      ? 'border-zinc-300 bg-zinc-200 text-zinc-950 dark:border-white/30 dark:bg-white/20 dark:text-white'
                      : 'border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:border-transparent dark:bg-white/10 dark:text-white/90 dark:hover:bg-white/15'
                  }`}
                  aria-label="Options"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
              </div>

              {/* Expandable Options Panel (Category Filter + Sort Mode) */}
              {isOptionsExpanded && (
                <div className="mt-2.5 animate-in space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 fade-in slide-in-from-top-1 duration-150 dark:border-white/10 dark:bg-white/5">
                  {/* Sorting Options */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-white/55">
                      {language === 'hi' ? 'क्रमबद्ध करें' : 'Sort Mode'}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSortMode('latest')}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          sortMode === 'latest'
                            ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                            : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-white/10 dark:text-white/80 dark:hover:bg-white/15'
                        }`}
                      >
                        {copy.latest}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSortMode('trending')}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          sortMode === 'trending'
                            ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                            : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-white/10 dark:text-white/80 dark:hover:bg-white/15'
                        }`}
                      >
                        {copy.trending}
                      </button>
                    </div>
                  </div>

                  {/* Category Options */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-white/55">
                      {language === 'hi' ? 'श्रेणियाँ' : 'Categories'}
                    </p>
                    <div className="scrollbar-hide flex max-h-32 flex-wrap gap-2 overflow-y-auto pr-1">
                      {categoryOptions.map((category) => {
                        const isActive = activeCategory === category;
                        const label =
                          category === 'all' ? copy.all : getCategoryLabel(category, language);

                        return (
                          <button
                            key={category}
                            type="button"
                            onClick={() => setActiveCategory(category)}
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                              isActive
                                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-white/10 dark:text-white/85 dark:hover:bg-white/15'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Main Video Section */}
          <div className="space-y-0">
            {isMobileFeaturedPlayerOpen && mobileFeaturedVideo && (
              <div
                className="sticky top-[var(--reader-top-chrome-height)] z-[45] isolate aspect-video w-full border-b border-white/10 bg-black shadow-[0_14px_34px_rgba(0,0,0,0.48)]"
                data-testid="mobile-sticky-video-player"
              >
                <VideoPlayer
                  key={`${mobileFeaturedVideo.id}:${initialStartTime}`}
                  videoId={mobileFeaturedVideo.id}
                  title={mobileFeaturedVideo.title}
                  src={mobileFeaturedVideo.videoUrl}
                  poster={mobileFeaturedVideo.thumbnail}
                  fallbackDuration={mobileFeaturedVideo.duration}
                  isActive
                  isPaused={isPaused}
                  isMuted={isMuted}
                  autoAdvance={autoAdvance}
                  playbackRate={playbackRate}
                  defaultVolume={isMuted ? 0 : 1}
                  captionsEnabled={captionsEnabled}
                  shouldPersistProgress
                  startTime={initialStartTime}
                  className="rounded-none"
                  onPausedChange={setIsPaused}
                  onMutedChange={setIsMuted}
                  onTimeChange={handleTimeChange}
                  onEnded={() => {
                    if (!autoAdvance) {
                      setIsPaused(true);
                      return;
                    }
                    advanceToNextVideo();
                  }}
                  onPlaybackRateChange={(speed) => {
                    const matched = PLAYER_SPEED_OPTIONS.find((option) => option === speed);
                    if (matched) {
                      setPlaybackRate(matched);
                    }
                  }}
                  onCaptionsChange={setCaptionsEnabled}
                />

                <button
                  type="button"
                  onClick={() => setMobileExpandedVideoId('')}
                  className="absolute top-3 left-3 z-50 p-2 bg-black/60 hover:bg-black/80 rounded-full backdrop-blur transition-all active:scale-90"
                  aria-label="Back to list"
                >
                  <ChevronLeft className="h-5 w-5 text-white" />
                </button>
              </div>
            )}

            {mobileFeaturedVideo && (isMobileFeaturedPlayerOpen || viewMode === 'feed') && (
              <div className={`${isMobileFeaturedPlayerOpen ? 'block' : 'hidden'} bg-white dark:bg-[#0f0f0f]`}>
                <div className="px-4 pt-3.5">
                  <h1 className="break-words text-lg font-bold leading-snug text-zinc-950 dark:text-white">
                    {mobileFeaturedVideo.title}
                  </h1>
                </div>

                <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center text-white font-extrabold text-sm shadow-inner shrink-0">
                      L
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 truncate text-sm font-bold text-zinc-950 dark:text-white">
                        Lokswami News
                        <span className="h-3 w-3 rounded-full bg-blue-500 flex items-center justify-center text-[8px] font-black text-white shrink-0">✓</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-white/50">2.4M subscribers</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={toggleSubscribed}
                    className={`rounded-full px-4 py-2 text-xs font-bold transition active:scale-95 duration-200 ${
                      isSubscribed
                        ? 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15'
                        : 'bg-zinc-900 text-white shadow hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-white/90'
                    }`}
                  >
                    {isSubscribed ? 'Subscribed' : 'Subscribe'}
                  </button>
                </div>

                <div
                  className="scrollbar-hide flex gap-2 overflow-x-auto border-b border-zinc-200 px-4 py-3 dark:border-white/5"
                  data-reader-scroll="x"
                >
                  <button
                    type="button"
                    onClick={() => toggleLiked(mobileFeaturedVideo.id)}
                    className={`flex items-center gap-1.5 shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition active:scale-95 ${
                      likedIds[mobileFeaturedVideo.id]
                        ? 'bg-[#ff3b30]/15 text-[#ff453a] border border-[#ff453a]/20'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15'
                    }`}
                  >
                    <Heart className={`h-3.5 w-3.5 ${likedIds[mobileFeaturedVideo.id] ? 'fill-current' : ''}`} />
                    <span>{likedIds[mobileFeaturedVideo.id] ? copy.liked : copy.like}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void shareActiveVideo(mobileFeaturedVideo)}
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-200 active:scale-95 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span>{copy.share}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleWatchLater(mobileFeaturedVideo.id)}
                    className={`flex items-center gap-1.5 shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition active:scale-95 ${
                      watchLaterIds[mobileFeaturedVideo.id]
                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15'
                    }`}
                  >
                    <BookmarkPlus className="h-3.5 w-3.5" />
                    <span>{watchLaterIds[mobileFeaturedVideo.id] ? copy.saved : copy.save}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAutoAdvance((current) => !current)}
                    className={`flex items-center gap-1.5 shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition active:scale-95 ${
                      autoAdvance
                        ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15'
                    }`}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span>Autoplay: {autoAdvance ? 'On' : 'Off'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={cyclePlaybackSpeed}
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-200 active:scale-95 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                  >
                    <span>Speed: {formatPlaybackSpeedLabel(playbackRate)}</span>
                  </button>

                  {!mobileFeaturedIsYouTube ? (
                    <button
                      type="button"
                      onClick={() => setCaptionsEnabled((current) => !current)}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition active:scale-95 ${
                        captionsEnabled
                          ? 'border border-purple-500/20 bg-purple-500/15 text-purple-400'
                          : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15'
                      }`}
                    >
                      <Captions className="h-3.5 w-3.5" />
                      <span>CC: {captionsEnabled ? 'On' : 'Off'}</span>
                    </button>
                  ) : null}
                </div>

                <div className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setIsDescriptionExpanded((p) => !p)}
                    aria-expanded={isDescriptionExpanded}
                    className="block w-full cursor-pointer rounded-xl bg-zinc-50 p-3 text-left text-xs leading-relaxed text-zinc-700 transition-colors duration-150 hover:bg-zinc-100 active:bg-zinc-200 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/8 dark:active:bg-white/10"
                  >
                    <div className="mb-1 flex items-center justify-between font-bold text-zinc-950 dark:text-white">
                      <div className="flex gap-2">
                        <span>{formatCompactViews(mobileFeaturedVideo.views, language)} views</span>
                        <span>•</span>
                        <span>{formatRelativeTime(mobileFeaturedVideo.publishedAt, language)}</span>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-red-400">
                        {isDescriptionExpanded ? copy.showLess : copy.showMore}
                      </span>
                    </div>

                    <p className={`whitespace-pre-wrap break-words leading-relaxed ${isDescriptionExpanded ? '' : 'line-clamp-2'}`}>
                      {mobileFeaturedDescription}
                    </p>

                    {isDescriptionExpanded && (
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-200 pt-3 text-[10px] text-zinc-500 dark:border-white/5 dark:text-white/50">
                        <span>Category: {getCategoryLabel(mobileFeaturedVideo.category, language)}</span>
                        <span>•</span>
                        <span>Duration: {formatDurationLabel(mobileFeaturedVideo.duration)}</span>
                        <span>•</span>
                        <span>Progress: {formatDurationLabel(mobileFeaturedProgressCurrent)}</span>
                      </div>
                    )}
                  </button>
                </div>

                {mobileFeaturedProgressCurrent > 0 && (
                  <div className="px-4 pb-3">
                    <div className="h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10">
                      <div className="h-full bg-red-600 rounded-full" style={{ width: `${mobileFeaturedProgressPercent}%` }} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {viewMode === 'feed' && (
              <div className="bg-white dark:bg-[#0f0f0f]">
                {isMobileFeaturedPlayerOpen ? (
                  <div className="border-t border-zinc-200 px-4 py-4 dark:border-white/5">
                    <h2 className="mb-3.5 text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-white/50">
                      {copy.upNext}
                    </h2>

                    {mobileFeedQueue.length === 0 ? (
                      <p className="py-6 text-center text-xs text-zinc-400 dark:text-white/40">No recommendations found</p>
                    ) : (
                      <div className="space-y-4">
                        {mobileFeedQueue.map((video) => {
                          const savedProgress = resumeProgressById[video.id];
                          const savedPercent = savedProgress?.duration
                            ? Math.min(100, (savedProgress.currentTime / savedProgress.duration) * 100)
                            : 0;

                          return (
                            <button
                              key={video.id}
                              type="button"
                              onClick={() => {
                                handleVideoSelect(video.id, 'feed', true);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="flex w-full gap-3 text-left group"
                            >
                              <div className="relative aspect-video w-[130px] shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-white/5 dark:bg-black/40">
                                <ReaderImage
                                  src={video.thumbnail}
                                  alt={video.title}
                                  fill
                                  sizes="130px"
                                  className="object-cover group-hover:scale-105 transition duration-200"
                                />
                                <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[10px] font-bold text-white">
                                  {formatDurationLabel(video.duration)}
                                </span>
                              </div>

                              <div className="min-w-0 flex-1 flex flex-col justify-center">
                                <h3 className="line-clamp-2 text-xs font-bold leading-snug text-zinc-950 transition-colors group-hover:text-red-600 dark:text-white dark:group-hover:text-red-400">
                                  {video.title}
                                </h3>
                                <p className="mt-1 flex items-center gap-1 text-[10px] text-zinc-500 dark:text-white/50">
                                  <span>Lokswami News</span>
                                  <span>•</span>
                                  <span>{getCategoryLabel(video.category, language)}</span>
                                </p>
                                <p className="text-[10px] text-zinc-400 dark:text-white/40">
                                  {formatCompactViews(video.views, language)} views • {formatRelativeTime(video.publishedAt, language)}
                                </p>

                                {savedPercent > 0 && (
                                  <div className="mt-1.5 w-16">
                                    <div className="h-[2px] overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10">
                                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${savedPercent}%` }} />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6 pt-2">
                    {filteredVideos.filter(v => !v.isShort).length === 0 ? (
                      <div className="py-12 text-center text-sm text-zinc-400 dark:text-white/40">{copy.noResults}</div>
                    ) : (
                      filteredVideos.filter(v => !v.isShort).map((video, idx) => {
                        const shouldShowShorts = idx === 1 && mobileShortsPreview.length > 0;
                        const savedProgress = resumeProgressById[video.id];
                        const savedPercent = savedProgress?.duration
                          ? Math.min(100, (savedProgress.currentTime / savedProgress.duration) * 100)
                          : 0;

                        return (
                          <div key={video.id} className="space-y-6">
                            <button
                              type="button"
                              onClick={() => {
                                handleVideoSelect(video.id, 'feed', true);
                              }}
                              className="w-full text-left group block"
                            >
                              <div className="relative aspect-video w-full overflow-hidden border-y border-zinc-200 bg-zinc-100 dark:border-white/5 dark:bg-black/40">
                                <ReaderImage
                                  src={video.thumbnail}
                                  alt={video.title}
                                  fill
                                  sizes="(max-width: 480px) 100vw, 480px"
                                  className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
                                />
                                <span className="absolute bottom-2.5 right-2.5 rounded bg-black/80 px-2 py-0.5 text-xs font-bold text-white tracking-wider">
                                  {formatDurationLabel(video.duration)}
                                </span>

                                {savedPercent > 0 && (
                                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                                    <div className="h-full bg-red-600" style={{ width: `${savedPercent}%` }} />
                                  </div>
                                )}

                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-600/40">
                                    <Play className="ml-1 h-5 w-5 fill-current" />
                                  </div>
                                </div>
                              </div>

                              <div className="flex gap-3 px-4 pt-3 pb-1">
                                <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center text-white font-extrabold text-sm shrink-0 shadow">
                                  L
                                </div>

                                <div className="min-w-0 flex-1">
                                  <h3 className="line-clamp-2 text-sm font-bold leading-snug text-zinc-950 transition-colors group-hover:text-red-600 dark:text-white dark:group-hover:text-red-400">
                                    {video.title}
                                  </h3>
                                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-white/50">
                                    <span className="font-semibold text-zinc-700 dark:text-white/70">Lokswami News</span>
                                    <span>•</span>
                                    <span>{getCategoryLabel(video.category, language)}</span>
                                  </p>
                                  <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-white/40">
                                    {formatCompactViews(video.views, language)} views • {formatRelativeTime(video.publishedAt, language)}
                                  </p>
                                </div>
                              </div>
                            </button>

                            {shouldShowShorts && (
                              <section className="my-2 border-y border-zinc-200 bg-zinc-50 py-4 dark:border-white/5 dark:bg-[#0a0a0a]">
                                <div className="flex items-center justify-between px-4 mb-3">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1 bg-[#ff3b30] rounded-lg">
                                      <Zap className="h-4 w-4 text-white fill-current" />
                                    </div>
                                    <h2 className="text-sm font-extrabold tracking-tight text-zinc-950 dark:text-white">
                                      Lokswami Shorts
                                    </h2>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleViewModeChange('shorts')}
                                    className="text-xs font-bold text-red-500 hover:text-red-400"
                                  >
                                    View All
                                  </button>
                                </div>

                                <div
                                  className="scrollbar-hide flex gap-3 overflow-x-auto px-4 pb-1"
                                  data-reader-scroll="x"
                                >
                                  {mobileShortsPreview.map((short) => (
                                    <button
                                      key={short.id}
                                      type="button"
                                      onClick={() => handleVideoSelect(short.id, 'shorts')}
                                      className="w-[140px] shrink-0 text-left block group"
                                    >
                                      <div className="relative aspect-[9/16] overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 shadow-md dark:border-white/5 dark:bg-black/40">
                                        <ReaderImage
                                          src={short.thumbnail}
                                          alt={short.title}
                                          fill
                                          sizes="140px"
                                          className="object-cover group-hover:scale-105 transition duration-300"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                                        <div className="absolute bottom-2 left-2 right-2">
                                          <p className="line-clamp-2 text-xs font-bold leading-snug text-white drop-shadow">
                                            {short.title}
                                          </p>
                                          <p className="text-[10px] text-white/70 mt-1 drop-shadow">
                                            {formatCompactViews(short.views, language)} views
                                          </p>
                                        </div>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </section>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}

            {viewMode === 'shorts' && !isCompactShortsMode && (
              <div className="bg-white px-4 py-4 dark:bg-[#0f0f0f]">
                <div className="grid grid-cols-2 gap-3">
                  {shortsFeed.map((short) => (
                    <button
                      key={short.id}
                      type="button"
                      onClick={() => handleVideoSelect(short.id, 'shorts')}
                      className="w-full text-left block group"
                    >
                      <div className="relative aspect-[9/16] overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 shadow-md dark:border-white/5 dark:bg-black/40">
                        <ReaderImage
                          src={short.thumbnail}
                          alt={short.title}
                          fill
                          sizes="180px"
                          className="object-cover group-hover:scale-105 transition duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                        <div className="absolute bottom-3 left-3 right-3">
                          <p className="line-clamp-2 text-xs font-bold leading-snug text-white drop-shadow">
                            {short.title}
                          </p>
                          <p className="text-[10px] text-white/70 mt-1.5 drop-shadow">
                            {formatCompactViews(short.views, language)} views
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={loadMoreSentinelRef} className="h-4" />

            {loadError && (
              <p className="mt-4 text-center text-xs text-[#ff3b30]">{loadError}</p>
            )}

            {hasMore && viewMode === 'feed' && !isMobileFeaturedPlayerOpen && (
              <div className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => void loadMoreVideos()}
                  disabled={isLoadingMore}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white px-4 text-sm font-bold text-zinc-800 transition hover:bg-zinc-100 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                >
                  {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isLoadingMore ? copy.loading : copy.loadMore}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-[#0a0a0b] dark:text-white">
      <div className="mx-auto w-full max-w-[430px] px-3 pb-[calc(var(--reader-bottom-nav-space)+1rem)] pt-3">
        <div className="space-y-4">
          <header className="rounded-[28px] border border-zinc-200 bg-white px-4 py-4 shadow-[0_22px_55px_rgba(0,0,0,0.1)] dark:border-white/8 dark:bg-[#151518] dark:shadow-[0_22px_55px_rgba(0,0,0,0.34)]">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#241515] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#ff6b5f]">
              <Smartphone className="h-3.5 w-3.5" />
              {copy.eyebrow}
            </div>

            <h1 className="mt-3 text-[2rem] font-black leading-none text-zinc-950 dark:text-white">
              Lokswami videos
            </h1>
            <p className="mt-2 max-w-[28ch] text-sm leading-6 text-zinc-600 dark:text-white/66">{copy.subtitle}</p>

            <label className="mt-4 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-white/8 dark:bg-[#0f0f12]">
              <Search className="h-4 w-4 text-zinc-500 dark:text-white/50" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={copy.searchPlaceholder}
                className="w-full bg-transparent text-sm text-zinc-950 outline-none placeholder:text-zinc-400 dark:text-white dark:placeholder:text-white/38"
                aria-label={copy.searchPlaceholder}
              />
            </label>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => handleViewModeChange('feed')}
                className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-semibold transition ${
                  viewMode === 'feed'
                    ? 'border-[#ff6257] bg-[#ff6257] text-white'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-white/8 dark:bg-[#101013] dark:text-white/72'
                }`}
              >
                <ListVideo className="h-4 w-4" />
                {copy.feed}
              </button>

              <button
                type="button"
                onClick={() => handleViewModeChange('shorts')}
                className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-semibold transition ${
                  viewMode === 'shorts'
                    ? 'border-[#ff6257] bg-[#ff6257] text-white'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-white/8 dark:bg-[#101013] dark:text-white/72'
                }`}
              >
                <Grid2X2 className="h-4 w-4" />
                {copy.shorts}
              </button>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setSortMode('latest')}
                className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full px-3 text-xs font-semibold uppercase tracking-[0.18em] ${
                  sortMode === 'latest'
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                    : 'bg-zinc-100 text-zinc-600 dark:bg-white/7 dark:text-white/72'
                }`}
              >
                <Clock3 className="h-3.5 w-3.5" />
                {copy.latest}
              </button>

              <button
                type="button"
                onClick={() => setSortMode('trending')}
                className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full px-3 text-xs font-semibold uppercase tracking-[0.18em] ${
                  sortMode === 'trending'
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                    : 'bg-zinc-100 text-zinc-600 dark:bg-white/7 dark:text-white/72'
                }`}
              >
                <Zap className="h-3.5 w-3.5" />
                {copy.trending}
              </button>
            </div>

            <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
              {categoryOptions.map((category) => {
                const isActive = activeCategory === category;
                const label =
                  category === 'all'
                    ? copy.all
                    : getCategoryLabel(category, language);

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${
                      isActive
                        ? 'bg-[#202a45] text-white'
                        : 'bg-zinc-100 text-zinc-600 dark:bg-white/6 dark:text-white/68'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </header>

          {selectedVideo ? (
            <article className="overflow-hidden rounded-[30px] border border-zinc-200 bg-white shadow-[0_20px_48px_rgba(0,0,0,0.1)] dark:border-white/8 dark:bg-[#16161a] dark:shadow-[0_20px_48px_rgba(0,0,0,0.34)]">
              <VideoPlayer
                key={`${selectedVideo.id}:${initialStartTime}`}
                videoId={selectedVideo.id}
                title={selectedVideo.title}
                src={selectedVideo.videoUrl}
                poster={selectedVideo.thumbnail}
                fallbackDuration={selectedVideo.duration}
                isActive
                isPaused={isPaused}
                isMuted={isMuted}
                autoAdvance={autoAdvance}
                playbackRate={playbackRate}
                defaultVolume={isMuted ? 0 : 1}
                captionsEnabled={captionsEnabled}
                shouldPersistProgress
                startTime={initialStartTime}
                onPausedChange={setIsPaused}
                onMutedChange={setIsMuted}
                onTimeChange={handleTimeChange}
                onEnded={() => {
                  if (!autoAdvance) {
                    setIsPaused(true);
                    return;
                  }
                  advanceToNextVideo();
                }}
                onPlaybackRateChange={(speed) => {
                  const matched = PLAYER_SPEED_OPTIONS.find((option) => option === speed);
                  if (matched) {
                    setPlaybackRate(matched);
                  }
                }}
                onCaptionsChange={setCaptionsEnabled}
              />

              <div className="space-y-4 px-4 pb-4 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#ff6257]/16 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ff877e]">
                    {copy.nowPlaying}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600 dark:bg-white/7 dark:text-white/72">
                    {getCategoryLabel(selectedVideo.category, language)}
                  </span>
                  {selectedVideo.isShort ? (
                    <span className="rounded-full bg-[#202a45] px-2.5 py-1 text-[11px] font-semibold text-[#c8d7ff]">
                      {copy.shorts}
                    </span>
                  ) : null}
                </div>

                <div>
                  <h2 className="text-[1.35rem] font-black leading-tight text-zinc-950 dark:text-white">
                    {selectedVideo.title}
                  </h2>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-white/58">
                    <span>{formatCompactViews(selectedVideo.views, language)} {copy.views}</span>
                    <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-white/24" />
                    <span>{formatRelativeTime(selectedVideo.publishedAt, language)}</span>
                    <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-white/24" />
                    <span>{formatDurationLabel(progressDuration || selectedVideo.duration)}</span>
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/7 dark:bg-[#101014]">
                  <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500 dark:text-white/58">
                    <span>{copy.resume}</span>
                    <span>
                      {formatDurationLabel(progressCurrent)} /{' '}
                      {formatDurationLabel(progressDuration || selectedVideo.duration)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/8">
                    <div
                      className="h-full rounded-full bg-[#ff6257] transition-[width]"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => toggleLiked()}
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-semibold ${
                      likedIds[selectedVideo.id]
                        ? 'border-[#ff6257]/40 bg-[#2a1618] text-white'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/8 dark:bg-[#101014] dark:text-white/80'
                    }`}
                  >
                    <Heart
                      className={`h-4 w-4 ${likedIds[selectedVideo.id] ? 'fill-current text-[#ff6257]' : ''}`}
                    />
                    {likedIds[selectedVideo.id] ? copy.liked : copy.like}
                  </button>

                  <button
                    type="button"
                    onClick={() => void shareActiveVideo()}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-700 dark:border-white/8 dark:bg-[#101014] dark:text-white/80"
                  >
                    <Share2 className="h-4 w-4" />
                    {copy.share}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleWatchLater()}
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-semibold ${
                      watchLaterIds[selectedVideo.id]
                        ? 'border-[#9fbbff]/40 bg-[#131b2e] text-white'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/8 dark:bg-[#101014] dark:text-white/80'
                    }`}
                  >
                    <BookmarkPlus className="h-4 w-4" />
                    {watchLaterIds[selectedVideo.id] ? copy.saved : copy.save}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAutoAdvance((current) => !current)}
                    className={`flex min-h-11 items-center justify-between rounded-2xl px-3 text-sm font-semibold ${
                      autoAdvance
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                        : 'bg-zinc-100 text-zinc-700 dark:bg-white/7 dark:text-white/76'
                    }`}
                  >
                    <span>{copy.autoplay}</span>
                    <span>{autoAdvance ? 'On' : 'Off'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={cyclePlaybackSpeed}
                    className="flex min-h-11 items-center justify-between rounded-2xl bg-zinc-100 px-3 text-sm font-semibold text-zinc-700 dark:bg-white/7 dark:text-white/80"
                  >
                    <span>{copy.speed}</span>
                    <span>{formatPlaybackSpeedLabel(playbackRate)}</span>
                  </button>

                  {!selectedVideoIsYouTube ? (
                    <button
                      type="button"
                      onClick={() => setCaptionsEnabled((current) => !current)}
                      className={`flex min-h-11 items-center justify-between rounded-2xl px-3 text-sm font-semibold ${
                        captionsEnabled
                          ? 'bg-[#202a45] text-white'
                          : 'bg-zinc-100 text-zinc-700 dark:bg-white/7 dark:text-white/76'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Captions className="h-4 w-4" />
                        {copy.captions}
                      </span>
                      <span>{captionsEnabled ? 'On' : 'Off'}</span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setIsMuted((current) => !current)}
                    className="flex min-h-11 items-center justify-between rounded-2xl bg-zinc-100 px-3 text-sm font-semibold text-zinc-700 dark:bg-white/7 dark:text-white/80"
                  >
                    <span className="flex items-center gap-2">
                      {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                      {isMuted ? copy.muted : copy.soundOn}
                    </span>
                    <span>{isMuted ? 'Off' : 'On'}</span>
                  </button>
                </div>

                <details className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-600 dark:border-white/7 dark:bg-[#101014] dark:text-white/70">
                  <summary className="cursor-pointer list-none font-semibold text-zinc-950 dark:text-white">
                    {copy.about}
                  </summary>
                  <div className="pt-3">
                    <p className="leading-6 text-zinc-600 dark:text-white/70">
                      {selectedVideo.description || selectedVideo.title}
                    </p>

                    <Link
                      href={buildVideoReaderPath(selectedVideo.id)}
                      className="mt-3 inline-flex items-center gap-2 rounded-full bg-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-800 dark:bg-white/7 dark:text-white"
                    >
                      <Play className="h-3.5 w-3.5" />
                      {copy.selected}
                    </Link>
                  </div>
                </details>
              </div>
            </article>
          ) : null}

          <section className="rounded-[30px] border border-zinc-200 bg-white px-3 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.1)] dark:border-white/8 dark:bg-[#141418] dark:shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
            <div className="mb-3 flex items-center justify-between px-1">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#ff6b5f]">
                  {copy.upNext}
                </p>
                <h2 className="mt-1 text-lg font-bold text-zinc-950 dark:text-white">
                  {queueVideos.length} {copy.videos}
                </h2>
              </div>

              {loadError ? (
                <button
                  type="button"
                  onClick={() => void loadMoreVideos()}
                  className="rounded-full bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700 dark:bg-white/8 dark:text-white"
                >
                  {copy.retry}
                </button>
              ) : null}
            </div>

            {!visiblePool.length ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500 dark:border-white/10 dark:bg-[#101014] dark:text-white/56">
                {copy.noResults}
              </div>
            ) : null}

            <div className="space-y-3">
              {queueVideos.map((video) => {
                const savedProgress = resumeProgressById[video.id];
                const savedPercent =
                  savedProgress?.duration
                    ? Math.min(100, (savedProgress.currentTime / savedProgress.duration) * 100)
                    : 0;

                return (
                  <button
                    key={video.id}
                    type="button"
                    onClick={() => handleVideoSelect(video.id, video.isShort ? 'shorts' : 'feed')}
                    className="flex w-full gap-3 rounded-[24px] border border-zinc-200 bg-zinc-50 p-2 text-left transition hover:border-zinc-300 dark:border-white/8 dark:bg-[#0f0f12] dark:hover:border-white/16"
                  >
                    <div className="relative w-[42%] shrink-0 overflow-hidden rounded-[18px] bg-black">
                      <div className="relative aspect-video">
                        <ReaderImage
                          src={video.thumbnail}
                          alt={video.title}
                          fill
                          sizes="180px"
                          className="object-cover"
                        />
                      </div>
                      <span className="absolute bottom-2 right-2 rounded-md bg-black/76 px-1.5 py-1 text-[10px] font-semibold text-white">
                        {formatDurationLabel(video.duration)}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 py-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-zinc-950 dark:text-white">
                          {video.title}
                        </h3>
                        {video.isShort ? (
                          <span className="shrink-0 rounded-full bg-[#202a45] px-2 py-1 text-[10px] font-semibold text-[#c8d7ff]">
                            {copy.shorts}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 text-[11px] text-zinc-500 dark:text-white/48">
                        {getCategoryLabel(video.category, language)}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 dark:text-white/48">
                        <span>{formatCompactViews(video.views, language)} {copy.views}</span>
                        <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-white/18" />
                        <span>{formatRelativeTime(video.publishedAt, language)}</span>
                      </div>

                      {savedPercent > 0 ? (
                        <div className="mt-3">
                          <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-zinc-500 dark:text-white/46">
                            <span>{copy.resume}</span>
                            <span>{Math.round(savedPercent)}%</span>
                          </div>
                          <div className="h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/8">
                            <div
                              className="h-full rounded-full bg-[#ff6257]"
                              style={{ width: `${savedPercent}%` }}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            <div ref={loadMoreSentinelRef} className="h-2" />

            {loadError ? (
              <p className="mt-3 text-center text-xs text-[#ff8a82]">{loadError}</p>
            ) : null}

            {hasMore ? (
              <button
                type="button"
                onClick={() => void loadMoreVideos()}
                disabled={isLoadingMore}
                className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-zinc-300 bg-zinc-100 px-4 text-sm font-semibold text-zinc-800 disabled:opacity-60 dark:border-white/8 dark:bg-white/6 dark:text-white"
              >
                {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isLoadingMore ? copy.loading : copy.loadMore}
              </button>
            ) : null}
          </section>
        </div>
      </div>
    </section>
  );
}
