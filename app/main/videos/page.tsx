'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Clock3, Film, Play, Smartphone, TrendingUp } from 'lucide-react';
import { useAppStore } from '@/lib/store/appStore';
import { videos as mockVideos } from '@/lib/mock/data';
import { resolveNewsCategory } from '@/lib/constants/newsCategories';
import ArticleMetaRow from '@/app/components/content/ArticleMetaRow';
import VideoShortsFeed, { type ShortsVideoItem } from '@/app/components/content/VideoShortsFeed';

type ViewMode = 'feed' | 'shorts';
type SortMode = 'latest' | 'trending';

const FALLBACK_VIDEO_URL = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
const FALLBACK_THUMBNAIL = '/logo-wordmark-final.png';
const USE_REMOTE_DEMO_MEDIA =
  process.env.NEXT_PUBLIC_USE_REMOTE_DEMO_MEDIA === 'true';
const UNSPLASH_IMAGE_HOST = /^https:\/\/images\.unsplash\.com\//i;

const categoryLabels: Record<string, { hi: string; en: string }> = {
  national: { hi: 'राष्ट्रीय', en: 'National' },
  international: { hi: 'अंतरराष्ट्रीय', en: 'International' },
  sports: { hi: 'खेल', en: 'Sports' },
  entertainment: { hi: 'मनोरंजन', en: 'Entertainment' },
  tech: { hi: 'टेक', en: 'Tech' },
  business: { hi: 'बिजनेस', en: 'Business' },
};

interface VideoItem extends ShortsVideoItem {
  isShort: boolean;
  isPublished: boolean;
}

function normalizeCategory(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}

function safeNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function safeString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function getCategoryLabel(category: string, language: 'hi' | 'en') {
  const resolved = resolveNewsCategory(category);
  if (!resolved) return category;
  return language === 'hi' ? resolved.name : resolved.nameEn;
}

function isPdfThumbnail(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('data:application/pdf') || normalized.endsWith('.pdf');
}

function getYouTubeId(value: string) {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.replace('www.', '').toLowerCase();

    if (host === 'youtu.be') return url.pathname.slice(1) || null;
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') return url.searchParams.get('v');
      if (url.pathname.startsWith('/shorts/')) return url.pathname.split('/')[2] || null;
      if (url.pathname.startsWith('/embed/')) return url.pathname.split('/')[2] || null;
    }

    return null;
  } catch {
    return null;
  }
}

function getYouTubeThumbnail(value: string) {
  const id = getYouTubeId(value);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '';
}

function resolveThumbnail(thumbnail: string, videoUrl: string) {
  const normalized = thumbnail.trim();
  if (normalized && !isPdfThumbnail(normalized)) {
    if (!USE_REMOTE_DEMO_MEDIA && UNSPLASH_IMAGE_HOST.test(normalized)) {
      return '/placeholders/news-16x9.svg';
    }
    return normalized;
  }
  return getYouTubeThumbnail(videoUrl) || FALLBACK_THUMBNAIL;
}

function mapApiVideo(raw: unknown): VideoItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;

  const id = safeString(source._id, safeString(source.id));
  const title = safeString(source.title).trim();
  const thumbnail = safeString(source.thumbnail).trim();
  const videoUrl = safeString(source.videoUrl, FALLBACK_VIDEO_URL);
  const category = safeString(source.category).trim();

  if (!id || !title || !category) return null;

  return {
    id,
    title,
    description: safeString(source.description, ''),
    thumbnail: resolveThumbnail(thumbnail, videoUrl),
    videoUrl,
    duration: Math.max(1, Math.floor(safeNumber(source.duration, 1))),
    category,
    views: Math.max(0, Math.floor(safeNumber(source.views, 0))),
    publishedAt: safeString(source.publishedAt, new Date().toISOString()),
    isShort: Boolean(source.isShort),
    isPublished: source.isPublished === false ? false : true,
    shortsRank: Math.floor(safeNumber(source.shortsRank, 0)),
  };
}

function buildFallbackVideos(): VideoItem[] {
  return mockVideos.map((video) => ({
    id: video.id,
    title: video.title,
    description: '',
    thumbnail: resolveThumbnail(video.thumbnail, FALLBACK_VIDEO_URL),
    videoUrl: FALLBACK_VIDEO_URL,
    duration: video.duration,
    category: video.category,
    views: video.views || 0,
    publishedAt: video.publishedAt,
    isShort: Boolean(video.isShort),
    isPublished: true,
    shortsRank: 0,
  }));
}

function isCompactShortsViewport() {
  if (typeof window === 'undefined') return false;

  const width = window.innerWidth;
  const height = window.innerHeight;
  const shortestSide = Math.min(width, height);
  const ua = window.navigator.userAgent.toLowerCase();
  const isIPad =
    /\bipad\b/.test(ua) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  const isAndroidTablet = ua.includes('android') && !ua.includes('mobile');
  const hasTouchPoints = window.navigator.maxTouchPoints > 0;
  const isCoarsePointer =
    typeof window.matchMedia === 'function' ? window.matchMedia('(pointer: coarse)').matches : false;
  const hasNoHover =
    typeof window.matchMedia === 'function' ? window.matchMedia('(hover: none)').matches : false;

  if (isIPad || isAndroidTablet) return true;

  if (isCoarsePointer || hasNoHover || hasTouchPoints) return shortestSide <= 1024;

  // Desktop fallback for emulator windows.
  return width <= 820;
}

export default function VideosPage() {
  const language = useAppStore((state) => state.language);
  const setImmersiveVideoMode = useAppStore((state) => state.setImmersiveVideoMode);

  const [activeCategory, setActiveCategory] = useState('all');
  const [activeFilter, setActiveFilter] = useState<SortMode>('latest');
  const [viewMode, setViewMode] = useState<ViewMode>('feed');
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateViewport = () => {
      setIsCompactViewport(isCompactShortsViewport());
    };

    setIsHydrated(true);
    updateViewport();
    setViewMode((prev) => (isCompactShortsViewport() ? 'shorts' : prev));
    window.addEventListener('resize', updateViewport);

    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    let active = true;

    const loadVideos = async () => {
      setIsLoading(true);
      setLoadError('');

      try {
        const response = await fetch('/api/admin/videos?limit=300&published=true');
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to load videos');
        }

        const mapped = Array.isArray(data.data)
          ? (data.data as unknown[])
              .map(mapApiVideo)
              .filter((item): item is VideoItem => item !== null)
          : [];

        if (!active) return;

        if (mapped.length) {
          setVideos(mapped);
        } else {
          setVideos(buildFallbackVideos());
          setLoadError(language === 'hi' ? 'डेमो वीडियो दिखाए जा रहे हैं' : 'Showing demo videos');
        }
      } catch {
        if (!active) return;

        setVideos(buildFallbackVideos());
        setLoadError(
          language === 'hi'
            ? 'CMS वीडियो लोड नहीं हो पाए, डेमो वीडियो दिख रहे हैं'
            : 'Could not load CMS videos, showing demo videos'
        );
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadVideos();
    return () => {
      active = false;
    };
  }, [language]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diff < 60) {
      return language === 'hi' ? `${diff} मिनट पहले` : `${diff} min ago`;
    }

    if (diff < 1440) {
      const hours = Math.floor(diff / 60);
      return language === 'hi' ? `${hours} घंटे पहले` : `${hours} hours ago`;
    }

    const days = Math.floor(diff / 1440);
    return language === 'hi' ? `${days} दिन पहले` : `${days} days ago`;
  };

  const renderTime = (dateString: string) =>
    isHydrated ? formatTime(dateString) : language === 'hi' ? 'हाल ही में' : 'recently';

  const categoryOptions = useMemo(() => {
    const unique = new Map<string, string>();
    videos.forEach((video) => {
      const key = normalizeCategory(video.category);
      if (!unique.has(key)) unique.set(key, video.category);
    });

    return [
      { id: 'all', name: language === 'hi' ? 'सभी' : 'All' },
      ...Array.from(unique.entries()).map(([id, label]) => ({
        id,
        name: getCategoryLabel(label, language),
      })),
    ];
  }, [videos, language]);

  const filteredVideos = useMemo(() => {
    return videos.filter((video) => {
      if (activeCategory === 'all') return true;
      return normalizeCategory(video.category) === activeCategory;
    });
  }, [videos, activeCategory]);

  const sortedVideos = useMemo(() => {
    const list = [...filteredVideos];
    list.sort((a, b) => {
      if (activeFilter === 'trending') return b.views - a.views;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
    return list;
  }, [filteredVideos, activeFilter]);

  const shortsVideos = useMemo(() => {
    const list = sortedVideos.filter((video) => video.isShort);
    list.sort((a, b) => {
      if (b.shortsRank !== a.shortsRank) return b.shortsRank - a.shortsRank;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
    return list;
  }, [sortedVideos]);

  const shortsFeed = shortsVideos.length ? shortsVideos : sortedVideos;
  const featuredVideo = sortedVideos[0];
  const otherVideos = sortedVideos.slice(1);
  const isCompactShortsMode = isCompactViewport && viewMode === 'shorts';

  useEffect(() => {
    setImmersiveVideoMode(isCompactShortsMode);
    return () => setImmersiveVideoMode(false);
  }, [isCompactShortsMode, setImmersiveVideoMode]);

  return (
    <div className={isCompactShortsMode ? 'space-y-0' : 'space-y-5'}>
      {!isCompactShortsMode ? (
        <>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            <span className="h-8 w-1 rounded-full bg-red-600" />
            {language === 'hi' ? 'वीडियो' : 'Videos'}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {viewMode === 'shorts'
              ? language === 'hi'
                ? 'शॉर्ट्स मोड: फुल स्क्रीन स्वाइप वीडियो'
                : 'Shorts mode: full-screen swipe video feed'
              : language === 'hi'
              ? 'ताज़ा वीडियो समाचार देखें'
              : 'Watch latest video news'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setViewMode('feed')}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'feed'
                ? 'bg-red-600 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            <Film className="h-4 w-4" />
            {language === 'hi' ? 'फीड' : 'Feed'}
          </button>

          <button
            onClick={() => setViewMode('shorts')}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'shorts'
                ? 'bg-red-600 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            <Smartphone className="h-4 w-4" />
            {language === 'hi' ? 'शॉर्ट्स' : 'Shorts'}
          </button>

          <button
            onClick={() => setActiveFilter('latest')}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeFilter === 'latest'
                ? 'bg-red-600 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            <Clock3 className="h-4 w-4" />
            {language === 'hi' ? 'ताज़ा' : 'Latest'}
          </button>

          <button
            onClick={() => setActiveFilter('trending')}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeFilter === 'trending'
                ? 'bg-red-600 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            {language === 'hi' ? 'ट्रेंडिंग' : 'Trending'}
          </button>
        </div>
          </div>

          <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
            {categoryOptions.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  activeCategory === category.id
                    ? 'bg-red-600 text-white'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="hidden">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-base font-extrabold tracking-tight">
              {language === 'hi' ? 'शॉर्ट्स' : 'Shorts'}
            </h1>

            <div className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-900 p-1">
              <button
                onClick={() => setViewMode('feed')}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                {language === 'hi' ? 'फीड' : 'Feed'}
              </button>
              <button
                onClick={() => setViewMode('shorts')}
                className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
              >
                {language === 'hi' ? 'शॉर्ट्स' : 'Shorts'}
              </button>
            </div>
          </div>

          <div className="mt-3 scrollbar-hide flex gap-2 overflow-x-auto pb-0.5">
            <button
              onClick={() => setActiveFilter('latest')}
              className={`flex-shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                activeFilter === 'latest'
                  ? 'border-red-500 bg-red-500 text-white'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-200'
              }`}
            >
              {language === 'hi' ? 'ताज़ा' : 'Latest'}
            </button>

            <button
              onClick={() => setActiveFilter('trending')}
              className={`flex-shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                activeFilter === 'trending'
                  ? 'border-red-500 bg-red-500 text-white'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-200'
              }`}
            >
              {language === 'hi' ? 'ट्रेंडिंग' : 'Trending'}
            </button>

            {categoryOptions.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex-shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  activeCategory === category.id
                    ? 'border-white bg-white text-zinc-900'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-200'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {loadError && !isCompactShortsMode ? (
        <div
          className={`rounded-lg px-4 py-2 text-sm ${
            isCompactShortsMode
              ? 'border border-orange-500/40 bg-orange-500/10 text-orange-200'
              : 'border border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300'
          }`}
        >
          {loadError}
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-3">
          <div className="h-10 w-44 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-[48vh] animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-48 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
            ))}
          </div>
        </div>
      ) : !sortedVideos.length ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {language === 'hi' ? 'वीडियो उपलब्ध नहीं हैं' : 'No videos available'}
          </p>
        </div>
      ) : viewMode === 'shorts' ? (
        <div
            className={
              isCompactShortsMode
                ? 'bg-black px-0 py-0'
                : '-mx-4 bg-gradient-to-b from-zinc-200/40 to-transparent px-2 py-1 dark:from-zinc-900/70 sm:-mx-6 sm:px-4 lg:-mx-8'
            }
          >
          {!shortsVideos.length && !isCompactShortsMode ? (
            <p
              className={`pb-2 text-center text-xs font-medium ${
                isCompactShortsMode ? 'text-zinc-300' : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {language === 'hi'
                ? 'शॉर्ट्स टैग नहीं मिले, सामान्य वीडियो शॉर्ट्स मोड में दिखाए जा रहे हैं'
                : 'No shorts-tagged videos found, showing regular videos in shorts mode'}
            </p>
          ) : null}
          <VideoShortsFeed
            videos={shortsFeed}
            language={language}
            immersiveMode={isCompactShortsMode}
          />
        </div>
      ) : (
        <div className="space-y-5">
          {featuredVideo ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="group relative aspect-video cursor-pointer overflow-hidden rounded-2xl"
            >
              <Link
                href={`/main/search?q=${encodeURIComponent(featuredVideo.title)}`}
                className="absolute inset-0 z-10"
                aria-label={featuredVideo.title}
              />

              <Image
                src={featuredVideo.thumbnail}
                alt={featuredVideo.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                sizes="(max-width: 1024px) 100vw, 1100px"
                unoptimized
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />

              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600/85 transition-transform group-hover:scale-110">
                  <Play className="ml-0.5 h-7 w-7 text-white" fill="white" />
                </div>
              </div>

              <div className="absolute left-4 top-4 flex items-center gap-2">
                <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                  {getCategoryLabel(featuredVideo.category, language)}
                </span>
                {featuredVideo.isShort ? (
                  <span className="rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                    {language === 'hi' ? 'शॉर्ट्स' : 'Shorts'}
                  </span>
                ) : null}
              </div>

              <div className="absolute bottom-4 right-4 rounded bg-black/70 px-2 py-1 text-sm text-white">
                {formatDuration(featuredVideo.duration)}
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-5">
                <h2 className="line-clamp-2 text-xl font-bold text-white md:text-2xl">
                  {featuredVideo.title}
                </h2>
                <ArticleMetaRow
                  article={{
                    id: featuredVideo.id,
                    title: featuredVideo.title,
                    views: featuredVideo.views || 0,
                  }}
                  timeText={renderTime(featuredVideo.publishedAt)}
                  language={language}
                  className="mt-3"
                  compact
                  withBorder={false}
                  inverted
                  showWhatsAppText
                  readHref={`/main/search?q=${encodeURIComponent(featuredVideo.title)}`}
                  sharePath={`/main/search?q=${encodeURIComponent(featuredVideo.title)}`}
                />
              </div>
            </motion.div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {otherVideos.map((video, index) => (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="group"
              >
                <div className="relative aspect-video overflow-hidden rounded-xl">
                  <Link
                    href={`/main/search?q=${encodeURIComponent(video.title)}`}
                    className="absolute inset-0 z-10"
                    aria-label={video.title}
                  />
                  <Image
                    src={video.thumbnail}
                    alt={video.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                    sizes="(max-width: 768px) 100vw, 300px"
                    unoptimized
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600">
                      <Play className="ml-0.5 h-5 w-5 text-white" fill="white" />
                    </div>
                  </div>

                  {video.isShort ? (
                    <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                      {language === 'hi' ? 'शॉर्ट्स' : 'Shorts'}
                    </span>
                  ) : null}

                  <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">
                    {formatDuration(video.duration)}
                  </div>
                </div>

                <div className="mt-3">
                  <Link href={`/main/search?q=${encodeURIComponent(video.title)}`} className="block">
                    <h3 className="line-clamp-2 text-sm font-semibold text-zinc-900 transition-colors group-hover:text-red-600 dark:text-zinc-100 dark:group-hover:text-red-400">
                      {video.title}
                    </h3>
                  </Link>

                  <div className="mt-1">
                    <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {getCategoryLabel(video.category, language)}
                    </span>
                  </div>

                  <ArticleMetaRow
                    article={{ id: video.id, title: video.title, views: video.views || 0 }}
                    timeText={renderTime(video.publishedAt)}
                    language={language}
                    className="mt-2"
                    compact
                    withBorder
                    showWhatsAppText
                    readHref={`/main/search?q=${encodeURIComponent(video.title)}`}
                    sharePath={`/main/search?q=${encodeURIComponent(video.title)}`}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
