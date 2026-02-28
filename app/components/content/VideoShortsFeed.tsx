'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Clock3,
  Eye,
  Heart,
  Play,
  Share2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import formatNumber from '@/lib/utils/formatNumber';

const VIEWPORT_HEIGHT_CLASS = 'h-[calc(100dvh-12.9rem)] md:h-[calc(100dvh-13.4rem)]';
const IMMERSIVE_VIEWPORT_HEIGHT_CLASS = 'h-dvh';

export interface ShortsVideoItem {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  videoUrl: string;
  duration: number;
  category: string;
  views: number;
  publishedAt: string;
  shortsRank: number;
}

interface VideoShortsFeedProps {
  videos: ShortsVideoItem[];
  language: 'hi' | 'en';
  immersiveMode?: boolean;
}

function getYouTubeId(urlString: string) {
  try {
    const url = new URL(urlString);
    const host = url.hostname.replace('www.', '');

    if (host === 'youtu.be') {
      return url.pathname.slice(1) || null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') return url.searchParams.get('v');

      if (url.pathname.startsWith('/shorts/')) {
        return url.pathname.split('/')[2] || null;
      }

      if (url.pathname.startsWith('/embed/')) {
        return url.pathname.split('/')[2] || null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function formatPlaybackTime(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '00:00';
  }

  const safeTotalSeconds = Math.floor(totalSeconds);
  const hours = Math.floor(safeTotalSeconds / 3600);
  const minutes = Math.floor((safeTotalSeconds % 3600) / 60);
  const seconds = safeTotalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
      seconds
    ).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function VideoShortsFeed({
  videos,
  language,
  immersiveMode = false,
}: VideoShortsFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const iframeRefs = useRef<Array<HTMLIFrameElement | null>>([]);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const didSwipeRef = useRef(false);
  const isAnimatingRef = useRef(false);
  const hasUnlockedAudioRef = useRef(false);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({});
  const [isHydrated, setIsHydrated] = useState(false);
  const [currentTimeById, setCurrentTimeById] = useState<Record<string, number>>({});
  const [durationById, setDurationById] = useState<Record<string, number>>({});

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (activeIndex <= videos.length - 1) return;
    setActiveIndex(Math.max(0, videos.length - 1));
  }, [videos.length, activeIndex]);

  useEffect(() => {
    setIsPaused(false);
  }, [activeIndex]);

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

  const activeVideo = videos[activeIndex];

  const activeReadHref = useMemo(() => {
    if (!activeVideo) return '/main/videos';
    return `/main/search?q=${encodeURIComponent(activeVideo.title)}`;
  }, [activeVideo]);
  const activePlaybackTime = activeVideo ? currentTimeById[activeVideo.id] ?? 0 : 0;
  const activePlaybackDuration = activeVideo
    ? durationById[activeVideo.id] ?? Math.max(0, activeVideo.duration || 0)
    : 0;
  const activePlaybackLabel = `${formatPlaybackTime(activePlaybackTime)} / ${formatPlaybackTime(
    activePlaybackDuration
  )}`;

  const viewportHeightClass = immersiveMode
    ? IMMERSIVE_VIEWPORT_HEIGHT_CLASS
    : VIEWPORT_HEIGHT_CLASS;
  const actionRailPositionClass = immersiveMode
    ? 'right-3 top-1/2 -translate-y-1/2 md:right-6'
    : 'right-3 top-1/2 -translate-y-1/2';
  const shellClass = immersiveMode
    ? 'h-dvh w-full'
    : 'mx-auto w-full max-w-none lg:max-w-[480px]';
  const feedClass = immersiveMode
    ? `scrollbar-hide ${viewportHeightClass} w-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain rounded-none border-0 bg-black shadow-none touch-pan-y`
    : `scrollbar-hide ${viewportHeightClass} snap-y snap-mandatory overflow-y-auto overscroll-y-contain rounded-none border-0 bg-zinc-950 shadow-none lg:rounded-[28px] lg:border lg:border-zinc-800 lg:shadow-[0_34px_80px_rgba(0,0,0,0.55)]`;

  const sendYouTubeCommand = (
    iframe: HTMLIFrameElement | null,
    command: 'playVideo' | 'pauseVideo' | 'mute' | 'unMute'
  ) => {
    iframe?.contentWindow?.postMessage(
      JSON.stringify({
        event: 'command',
        func: command,
        args: [],
      }),
      '*'
    );
  };

  const unlockActiveAudio = () => {
    if (!isMuted) return;

    hasUnlockedAudioRef.current = true;
    setIsMuted(false);

    const current = videos[activeIndex];
    if (!current) return;

    const isYouTube = Boolean(getYouTubeId(current.videoUrl));
    if (isYouTube) {
      const iframe = iframeRefs.current[activeIndex];
      if (!iframe) return;

      sendYouTubeCommand(iframe, 'unMute');
      if (isPaused) {
        sendYouTubeCommand(iframe, 'playVideo');
        setIsPaused(false);
      }
      return;
    }

    const video = videoRefs.current[activeIndex];
    if (!video) return;

    video.muted = false;
    if (isPaused) {
      void video.play().catch(() => undefined);
      setIsPaused(false);
    }
  };

  const toggleActivePlayback = () => {
    const current = videos[activeIndex];
    if (!current) return;

    const isYouTube = Boolean(getYouTubeId(current.videoUrl));
    if (isYouTube) {
      const iframe = iframeRefs.current[activeIndex];
      if (!iframe) return;

      if (isPaused) {
        sendYouTubeCommand(iframe, 'playVideo');
        sendYouTubeCommand(iframe, isMuted ? 'mute' : 'unMute');
        setIsPaused(false);
        return;
      }

      sendYouTubeCommand(iframe, 'pauseVideo');
      setIsPaused(true);
      return;
    }

    const video = videoRefs.current[activeIndex];
    if (!video) return;

    if (isPaused) {
      video.muted = isMuted;
      void video.play().catch(() => undefined);
      setIsPaused(false);
      return;
    }

    video.pause();
    setIsPaused(true);
  };

  const scrollToIndex = useCallback((index: number) => {
    const bounded = Math.max(0, Math.min(index, videos.length - 1));
    const target = cardRefs.current[bounded];
    const container = feedRef.current;
    if (!target || !container) return;

    const targetTop = target.offsetTop;
    const start = container.scrollTop;
    const distance = targetTop - start;
    const duration = 420;
    const startedAt = performance.now();

    isAnimatingRef.current = true;

    const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    const step = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      container.scrollTop = start + distance * easeInOut(progress);

      if (progress < 1) {
        requestAnimationFrame(step);
        return;
      }

      isAnimatingRef.current = false;
    };

    requestAnimationFrame(step);
  }, [videos.length]);

  useEffect(() => {
    const root = feedRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const idx = Number((entry.target as HTMLElement).dataset.index ?? 0);
          if (Number.isFinite(idx)) setActiveIndex(idx);
        }
      },
      { root, threshold: 0.72 }
    );

    cardRefs.current.forEach((card) => {
      if (card) observer.observe(card);
    });

    return () => observer.disconnect();
  }, [videos.length]);

  useEffect(() => {
    const root = feedRef.current;
    if (!root) return;

    const onWheel = (event: WheelEvent) => {
      if (isAnimatingRef.current) return;
      if (Math.abs(event.deltaY) < 10) return;

      event.preventDefault();
      scrollToIndex(activeIndex + (event.deltaY > 0 ? 1 : -1));
    };

    root.addEventListener('wheel', onWheel, { passive: false });
    return () => root.removeEventListener('wheel', onWheel);
  }, [activeIndex, scrollToIndex]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      scrollToIndex(activeIndex + (event.key === 'ArrowDown' ? 1 : -1));
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, scrollToIndex]);

  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      if (index === activeIndex) {
        video.muted = isMuted;
        if (isPaused) {
          video.pause();
          return;
        }

        void video.play().catch(() => undefined);
        return;
      }

      video.pause();
      video.currentTime = 0;
    });

    iframeRefs.current.forEach((iframe, index) => {
      if (!iframe) return;
      if (index === activeIndex) {
        sendYouTubeCommand(iframe, isPaused ? 'pauseVideo' : 'playVideo');
        if (!isPaused) {
          sendYouTubeCommand(iframe, isMuted ? 'mute' : 'unMute');
        }
        return;
      }

      sendYouTubeCommand(iframe, 'mute');
      sendYouTubeCommand(iframe, 'pauseVideo');
    });
  }, [activeIndex, isMuted, isPaused, videos.length]);

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    touchStartRef.current = touch
      ? { x: touch.clientX, y: touch.clientY }
      : null;
    didSwipeRef.current = false;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaY = touchStartRef.current.y - touch.clientY;
    const deltaX = touchStartRef.current.x - touch.clientX;
    touchStartRef.current = null;

    if (Math.abs(deltaY) < 36 || Math.abs(deltaY) < Math.abs(deltaX)) return;
    didSwipeRef.current = true;
    scrollToIndex(activeIndex + (deltaY > 0 ? 1 : -1));
  };

  const handleSurfaceToggle = (index: number) => {
    if (didSwipeRef.current) {
      didSwipeRef.current = false;
      return;
    }

    if (index !== activeIndex) return;

    if (!hasUnlockedAudioRef.current && isMuted) {
      unlockActiveAudio();
      return;
    }

    toggleActivePlayback();
  };

  const handleShare = async () => {
    if (!activeVideo || typeof window === 'undefined') return;

    const url = `${window.location.origin}${activeReadHref}`;
    const text = `${activeVideo.title} ${url}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: activeVideo.title, text, url });
        return;
      } catch {
        // User canceled native share; fallback below.
      }
    }

    const whatsapp = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsapp, '_blank', 'noopener,noreferrer');
  };

  const handleLike = () => {
    if (!activeVideo) return;
    setLikedIds((prev) => ({ ...prev, [activeVideo.id]: !prev[activeVideo.id] }));
  };

  const handleMuteToggle = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (!nextMuted) {
      hasUnlockedAudioRef.current = true;
      unlockActiveAudio();
    }
  };

  const handleVideoLoadedMetadata = (videoId: string, fallbackDuration: number, event: React.SyntheticEvent<HTMLVideoElement>) => {
    const element = event.currentTarget;
    const resolvedDuration =
      Number.isFinite(element.duration) && element.duration > 0 ? element.duration : fallbackDuration;

    setDurationById((prev) => {
      if (prev[videoId] === resolvedDuration) return prev;
      return { ...prev, [videoId]: resolvedDuration };
    });
  };

  const handleVideoDurationChange = (videoId: string, fallbackDuration: number, event: React.SyntheticEvent<HTMLVideoElement>) => {
    const element = event.currentTarget;
    const resolvedDuration =
      Number.isFinite(element.duration) && element.duration > 0 ? element.duration : fallbackDuration;

    setDurationById((prev) => {
      if (prev[videoId] === resolvedDuration) return prev;
      return { ...prev, [videoId]: resolvedDuration };
    });
  };

  const handleVideoTimeUpdate = (videoId: string, index: number, event: React.SyntheticEvent<HTMLVideoElement>) => {
    if (index !== activeIndex) return;
    const element = event.currentTarget;
    const nextCurrentTime = Number.isFinite(element.currentTime) ? element.currentTime : 0;

    setCurrentTimeById((prev) => {
      if (Math.abs((prev[videoId] ?? 0) - nextCurrentTime) < 0.25) return prev;
      return { ...prev, [videoId]: nextCurrentTime };
    });
  };

  const handleVideoPause = (index: number) => {
    if (index !== activeIndex) return;
    setIsPaused(true);
  };

  const handleVideoPlay = (videoId: string, index: number, event: React.SyntheticEvent<HTMLVideoElement>) => {
    if (index !== activeIndex) return;
    const element = event.currentTarget;
    const nextCurrentTime = Number.isFinite(element.currentTime) ? element.currentTime : 0;
    const nextDuration = Number.isFinite(element.duration) && element.duration > 0 ? element.duration : 0;

    setCurrentTimeById((prev) => ({ ...prev, [videoId]: nextCurrentTime }));
    if (nextDuration > 0) {
      setDurationById((prev) => ({ ...prev, [videoId]: nextDuration }));
    }
    setIsPaused(false);
  };

  if (!videos.length) {
    return (
      <div className="mx-auto max-w-[470px] rounded-3xl border border-zinc-200 bg-white px-6 py-14 text-center shadow-[0_20px_55px_rgba(0,0,0,0.08)] dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {language === 'hi' ? 'कोई शॉर्ट्स उपलब्ध नहीं है' : 'No shorts available right now'}
        </p>
      </div>
    );
  }

  const sectionClass = immersiveMode
    ? 'fixed inset-0 z-40 h-dvh w-full overflow-hidden bg-black'
    : 'relative';

  return (
    <section className={sectionClass} data-swipe-ignore={immersiveMode ? 'true' : undefined}>
      <div className={shellClass}>
        <div
          ref={feedRef}
          className={feedClass}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {videos.map((video, index) => {
            const youtubeId = getYouTubeId(video.videoUrl);
            const readHref = `/main/search?q=${encodeURIComponent(video.title)}`;

            return (
              <article
                key={video.id}
                data-index={index}
                ref={(el) => {
                  cardRefs.current[index] = el;
                }}
                className={`relative ${viewportHeightClass} snap-start snap-always overflow-hidden`}
              >
                <div className="absolute inset-0 bg-black">
                  {youtubeId ? (
                    <iframe
                      ref={(el) => {
                        iframeRefs.current[index] = el;
                      }}
                      onLoad={() => {
                        const iframe = iframeRefs.current[index];
                        if (!iframe) return;

                        if (index === activeIndex) {
                          sendYouTubeCommand(
                            iframe,
                            isPaused ? 'pauseVideo' : 'playVideo'
                          );
                          if (!isPaused) {
                            sendYouTubeCommand(iframe, isMuted ? 'mute' : 'unMute');
                          }
                          return;
                        }

                        sendYouTubeCommand(iframe, 'mute');
                        sendYouTubeCommand(iframe, 'pauseVideo');
                      }}
                      title={video.title}
                      src={`https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&playsinline=1&controls=0&mute=1&loop=1&playlist=${youtubeId}&autoplay=${index === activeIndex ? 1 : 0}&rel=0&modestbranding=1`}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      ref={(el) => {
                        videoRefs.current[index] = el;
                      }}
                      src={video.videoUrl}
                      poster={video.thumbnail}
                      className="h-full w-full object-cover"
                      loop
                      muted={isMuted}
                      playsInline
                      preload={index <= activeIndex + 1 ? 'metadata' : 'none'}
                      autoPlay={index === activeIndex}
                      onLoadedMetadata={(event) =>
                        handleVideoLoadedMetadata(video.id, video.duration, event)
                      }
                      onDurationChange={(event) =>
                        handleVideoDurationChange(video.id, video.duration, event)
                      }
                      onTimeUpdate={(event) => handleVideoTimeUpdate(video.id, index, event)}
                      onPause={() => handleVideoPause(index)}
                      onPlay={(event) => handleVideoPlay(video.id, index, event)}
                    />
                  )}
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                {immersiveMode ? (
                  <button
                    type="button"
                    onClick={() => handleSurfaceToggle(index)}
                    className="absolute inset-0 z-10 cursor-default bg-transparent"
                    aria-label={isPaused ? 'Play video' : 'Pause video'}
                  />
                ) : null}

                {immersiveMode && index === activeIndex && isPaused ? (
                  <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                    <div className="rounded-full bg-black/55 p-4 text-white backdrop-blur">
                      <Play className="h-8 w-8 fill-current" />
                    </div>
                  </div>
                ) : null}

                {immersiveMode && index === activeIndex && isPaused ? (
                  <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 md:top-6">
                    <div className="animate-[fadeIn_180ms_ease-out] rounded-full border border-white/20 bg-black/55 text-sm text-white backdrop-blur-sm md:text-base">
                      <span className="inline-flex px-3 py-1 md:px-4 md:py-2">
                        {activePlaybackLabel}
                      </span>
                    </div>
                  </div>
                ) : null}

                {!immersiveMode ? (
                  <>
                <div className="absolute left-3 top-3 hidden items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur md:inline-flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  {video.category}
                </div>

                <div className="absolute bottom-0 left-0 right-0 hidden px-4 pt-4 pb-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] md:block md:px-5 md:pt-5 md:pb-[calc(4rem+env(safe-area-inset-bottom)+0.85rem)] xl:p-5">
                  <div className="max-w-[85%]">
                    <h2 className="line-clamp-3 text-xl font-black leading-tight text-white md:text-2xl">
                      {video.title}
                    </h2>

                    <p className="mt-2 line-clamp-2 text-sm text-zinc-200 md:line-clamp-3 md:text-base">
                      {video.description}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-300 md:text-sm">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 className="h-3.5 w-3.5" />
                        {renderTime(video.publishedAt)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Eye className="h-3.5 w-3.5" />
                        {formatNumber(video.views)}
                      </span>
                      <span>{Math.floor(video.duration / 60)} min</span>
                    </div>

                    <Link
                      href={readHref}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-red-300 transition-colors hover:text-red-200"
                    >
                      {language === 'hi' ? 'पूरी खबर' : 'Read Story'}
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
                  </>
                ) : null}
              </article>
            );
          })}
        </div>

        {activeVideo ? (
          <div className={`pointer-events-none absolute z-20 ${actionRailPositionClass}`}>
            <div className="pointer-events-auto flex flex-col items-center gap-2 rounded-2xl border border-white/15 bg-black/40 p-2 backdrop-blur md:p-2.5">
              <button
                type="button"
                onClick={handleLike}
                className={`rounded-full p-2.5 transition-colors ${
                  likedIds[activeVideo.id]
                    ? 'bg-red-500 text-white'
                    : 'bg-white/15 text-white hover:bg-white/25'
                }`}
                aria-label={language === 'hi' ? 'लाइक' : 'Like'}
              >
                <Heart className={`h-5 w-5 ${likedIds[activeVideo.id] ? 'fill-current' : ''}`} />
              </button>

              <button
                type="button"
                onClick={handleMuteToggle}
                className="rounded-full bg-white/15 p-2.5 text-white transition-colors hover:bg-white/25"
                aria-label={isMuted ? 'Unmute video' : 'Mute video'}
              >
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="rounded-full bg-white/15 p-2.5 text-white transition-colors hover:bg-white/25"
                aria-label={language === 'hi' ? 'शेयर करें' : 'Share'}
              >
                <Share2 className="h-5 w-5" />
              </button>

              <Link
                href={activeReadHref}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600"
                aria-label={language === 'hi' ? 'पूरी खबर' : 'Read Story'}
              >
                <ArrowUpRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        ) : null}

        {immersiveMode && activeVideo ? (
          <div className="pointer-events-none absolute bottom-16 left-0 right-0 z-20 px-4 pb-[env(safe-area-inset-bottom)] md:bottom-20 md:px-8">
            <div className="overflow-hidden whitespace-nowrap pr-16 md:pr-24">
              <p className="truncate text-sm font-medium text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)] md:text-base lg:text-lg">
                {activeVideo.title}
              </p>
            </div>
          </div>
        ) : null}

        {!immersiveMode ? (
          <div className="pointer-events-none absolute right-3 top-3 z-20 hidden rounded-full bg-black/45 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur md:block">
            {activeIndex + 1} / {videos.length}
          </div>
        ) : null}

        {!immersiveMode ? (
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 hidden -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur md:block">
            {language === 'hi'
              ? '\u090a\u092a\u0930 \u0938\u094d\u0935\u093e\u0907\u092a \u0915\u0930\u0947\u0902'
              : 'Swipe Up'}
          </div>
        ) : null}
      </div>
    </section>
  );
}

