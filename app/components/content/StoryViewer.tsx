'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type TouchEvent,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Pause,
  Play,
  Share2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { VisualStory } from '@/lib/content/visualStories';

interface StoryViewerProps {
  stories: VisualStory[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onStoryViewed?: (storyId: string) => void;
  variant?: 'story' | 'reel';
}

function normalizeDurationSeconds(value: number | undefined) {
  if (!Number.isFinite(value)) return 6;
  return Math.max(2, Math.min(180, Number(value)));
}

function formatTimeLabel(ms: number) {
  const safeMs = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const totalSeconds = Math.floor(safeMs / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function isExternalHref(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('http://') || normalized.startsWith('https://');
}

function getYouTubeEmbedUrl(value: string, muted: boolean) {
  const raw = value.trim();
  if (!raw) return '';

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return '';
  }

  const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  let id = '';

  if (host === 'youtu.be') {
    id = parsed.pathname.slice(1);
  } else if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (parsed.pathname === '/watch') {
      id = parsed.searchParams.get('v') || '';
    } else if (parsed.pathname.startsWith('/shorts/')) {
      id = parsed.pathname.split('/')[2] || '';
    } else if (parsed.pathname.startsWith('/embed/')) {
      id = parsed.pathname.split('/')[2] || '';
    }
  }

  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeId) return '';

  const params = new URLSearchParams({
    enablejsapi: '1',
    autoplay: '1',
    mute: muted ? '1' : '0',
    controls: '0',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    iv_load_policy: '3',
    fs: '0',
    loop: '1',
    playlist: safeId,
  });

  return `https://www.youtube.com/embed/${safeId}?${params.toString()}`;
}

export default function StoryViewer({
  stories,
  initialIndex,
  isOpen,
  onClose,
  onStoryViewed,
  variant = 'story',
}: StoryViewerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [mediaErrors, setMediaErrors] = useState<Record<string, boolean>>({});
  const [videoDurationMs, setVideoDurationMs] = useState<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const wheelLockUntilRef = useRef(0);
  const hasUnlockedAudioRef = useRef(false);

  const boundedInitialIndex = Math.min(
    Math.max(initialIndex, 0),
    Math.max(stories.length - 1, 0)
  );

  const activeStory = stories[activeIndex];
  const storyHref = (activeStory?.href || activeStory?.linkUrl || '').trim();
  const hasStoryHref = Boolean(storyHref);
  const ctaLabel = (activeStory?.linkLabel || '').trim() || 'Read Full Story';
  const effectiveMuted = variant === 'reel' ? (isMuted || !hasUnlockedAudioRef.current) : isMuted;
  const youtubeEmbedUrl = useMemo(
    () => getYouTubeEmbedUrl(activeStory?.mediaUrl || '', effectiveMuted),
    [activeStory?.mediaUrl, effectiveMuted]
  );
  const isYouTubeStory = Boolean(youtubeEmbedUrl);
  const canUseNativeVideo =
    activeStory?.mediaType === 'video' &&
    Boolean(activeStory.mediaUrl) &&
    !mediaErrors[activeStory.id] &&
    !isYouTubeStory;

  const durationMs = useMemo(() => {
    const fallback = normalizeDurationSeconds(activeStory?.durationSeconds) * 1000;
    if (
      activeStory?.mediaType === 'video' &&
      !isYouTubeStory &&
      videoDurationMs &&
      videoDurationMs > 1000
    ) {
      return videoDurationMs;
    }
    return fallback;
  }, [activeStory?.durationSeconds, activeStory?.mediaType, isYouTubeStory, videoDurationMs]);
  const elapsedMs = Math.round(progress * durationMs);

  const goToIndex = useCallback(
    (index: number) => {
      if (!stories.length) return;
      const bounded = Math.max(0, Math.min(index, stories.length - 1));
      setActiveIndex(bounded);
      setProgress(0);
      setVideoDurationMs(null);
    },
    [stories.length]
  );

  const goNext = useCallback(() => {
    if (!stories.length) return;
    if (activeIndex >= stories.length - 1) {
      onClose();
      return;
    }
    goToIndex(activeIndex + 1);
  }, [activeIndex, goToIndex, onClose, stories.length]);

  const goPrev = useCallback(() => {
    if (!stories.length) return;
    goToIndex(activeIndex - 1);
  }, [activeIndex, goToIndex, stories.length]);

  useEffect(() => {
    if (!isOpen) return;
    goToIndex(boundedInitialIndex);
    setIsPaused(false);
    if (variant === 'reel') {
      hasUnlockedAudioRef.current = false;
      setIsMuted(true);
    }
  }, [boundedInitialIndex, goToIndex, isOpen, variant]);

  const sendYouTubeCommand = useCallback(
    (command: 'playVideo' | 'pauseVideo' | 'mute' | 'unMute') => {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({
          event: 'command',
          func: command,
          args: [],
        }),
        '*'
      );
    },
    []
  );

  useEffect(() => {
    if (!isOpen || !activeStory) return;
    onStoryViewed?.(activeStory.id);
  }, [activeStory, isOpen, onStoryViewed]);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
      }
      if (event.key === 'ArrowDown' && variant === 'reel') {
        event.preventDefault();
        goNext();
      }
      if (event.key === 'ArrowUp' && variant === 'reel') {
        event.preventDefault();
        goPrev();
      }
      if (event.key === ' ') {
        event.preventDefault();
        setIsPaused((prev) => !prev);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNext, goPrev, isOpen, onClose, variant]);

  useEffect(() => {
    if (!isOpen || variant !== 'reel') return;

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 16) return;
      const now = Date.now();
      if (now < wheelLockUntilRef.current) return;
      wheelLockUntilRef.current = now + 420;

      event.preventDefault();
      if (event.deltaY > 0) {
        goNext();
      } else {
        goPrev();
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [goNext, goPrev, isOpen, variant]);

  useEffect(() => {
    if (!isOpen || !activeStory || isPaused || canUseNativeVideo) return;
    const step = 60 / durationMs;
    let hasAdvanced = false;

    const timer = window.setInterval(() => {
      setProgress((prev) => {
        const next = Math.min(1, prev + step);
        if (next >= 1 && !hasAdvanced) {
          hasAdvanced = true;
          window.setTimeout(() => goNext(), 0);
        }
        return next;
      });
    }, 60);

    return () => window.clearInterval(timer);
  }, [
    activeStory,
    activeStory?.id,
    canUseNativeVideo,
    durationMs,
    goNext,
    isOpen,
    isPaused,
  ]);

  useEffect(() => {
    if (!isOpen || activeStory?.mediaType !== 'video' || isYouTubeStory) return;
    const video = videoRef.current;
    if (!video) return;
    video.muted = effectiveMuted;

    if (isPaused) {
      video.pause();
    } else {
      video.play().catch(() => {
        // Autoplay can be blocked by device/browser policy; keep video, just pause.
        setIsPaused(true);
      });
    }
  }, [activeStory?.id, activeStory?.mediaType, effectiveMuted, isOpen, isPaused, isYouTubeStory]);

  useEffect(() => {
    if (!isOpen || activeStory?.mediaType !== 'video' || !isYouTubeStory) return;
    if (isPaused) {
      sendYouTubeCommand('pauseVideo');
      return;
    }
    sendYouTubeCommand(effectiveMuted ? 'mute' : 'unMute');
    sendYouTubeCommand('playVideo');
  }, [
    activeStory?.id,
    activeStory?.mediaType,
    effectiveMuted,
    isOpen,
    isPaused,
    isYouTubeStory,
    sendYouTubeCommand,
  ]);

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const touchStart = touchStartRef.current;
    const touchEnd = event.changedTouches[0];
    touchStartRef.current = null;
    if (!touchStart || !touchEnd) return;

    const dx = touchEnd.clientX - touchStart.x;
    const dy = touchEnd.clientY - touchStart.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (variant === 'reel') {
      if (absDy > 56 && absDy > absDx) {
        event.preventDefault();
        if (dy < 0) goNext();
        if (dy > 0) goPrev();
        return;
      }
      return;
    }

    if (absDy > 72 && dy > 0 && absDy > absDx) {
      onClose();
      return;
    }

    if (absDx > 40 && absDx > absDy) {
      if (dx < 0) goNext();
      if (dx > 0) goPrev();
    }
  };

  const onMediaError = () => {
    if (!activeStory) return;
    setMediaErrors((prev) => ({ ...prev, [activeStory.id]: true }));
  };

  const onVideoMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    if (Number.isFinite(video.duration) && video.duration > 0) {
      setVideoDurationMs(video.duration * 1000);
    }
  };

  const onVideoTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const duration = Number.isFinite(video.duration) ? video.duration * 1000 : 0;
    if (duration > 0) {
      const current = Number.isFinite(video.currentTime) ? video.currentTime * 1000 : 0;
      setProgress(Math.min(1, current / duration));
    }
  };

  const onShare = useCallback(async () => {
    if (!activeStory) return;

    const fallbackUrl = `${window.location.origin}/main/stories?story=${encodeURIComponent(activeStory.id)}`;
    const targetUrl = storyHref ? new URL(storyHref, window.location.origin).toString() : fallbackUrl;
    const shareData = {
      title: activeStory.title,
      text: activeStory.caption || activeStory.title,
      url: targetUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(targetUrl);
        return;
      }
    } catch {
      // Ignore clipboard errors and use prompt fallback.
    }

    window.prompt('Copy link', targetUrl);
  }, [activeStory, storyHref]);

  const canMuteStory = activeStory.mediaType === 'video';
  const togglePlayPause = () => setIsPaused((prev) => !prev);
  const toggleMuted = () => {
    if (!canMuteStory) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (nextMuted) {
      if (isYouTubeStory) {
        sendYouTubeCommand('mute');
      } else if (videoRef.current) {
        videoRef.current.muted = true;
      }
      return;
    }

    hasUnlockedAudioRef.current = true;
    if (isYouTubeStory) {
      sendYouTubeCommand('unMute');
      sendYouTubeCommand('playVideo');
      setIsPaused(false);
      return;
    }

    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    void video.play().catch(() => undefined);
    setIsPaused(false);
  };

  return (
    <AnimatePresence>
      {isOpen && activeStory ? (
        <motion.div
          key="story-viewer-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`fixed inset-0 z-[90] ${
            variant === 'reel' ? 'bg-gradient-to-b from-black via-zinc-950 to-black' : 'bg-black'
          }`}
        >
          <div
            className="relative h-[100dvh] min-h-[100dvh] w-full touch-pan-y overflow-hidden"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <div className="absolute inset-0">
              {activeStory.mediaType === 'video' &&
              isYouTubeStory ? (
                <iframe
                  key={`${activeStory.id}-youtube`}
                  ref={iframeRef}
                  src={youtubeEmbedUrl}
                  className="h-full w-full"
                  title={activeStory.title}
                  onLoad={() => {
                    if (isPaused) {
                      sendYouTubeCommand('pauseVideo');
                      return;
                    }
                    sendYouTubeCommand(effectiveMuted ? 'mute' : 'unMute');
                    sendYouTubeCommand('playVideo');
                  }}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen={false}
                />
              ) : canUseNativeVideo ? (
                <video
                  ref={videoRef}
                  src={activeStory.mediaUrl}
                  className="h-full w-full object-cover"
                  poster={activeStory.thumbnail}
                  preload="metadata"
                  playsInline
                  autoPlay
                  muted={effectiveMuted}
                  defaultMuted={variant === 'reel'}
                  onEnded={goNext}
                  onError={onMediaError}
                  onLoadedMetadata={onVideoMetadata}
                  onTimeUpdate={onVideoTimeUpdate}
                />
              ) : mediaErrors[activeStory.id] ? (
                <div className="relative h-full w-full">
                  <Image
                    src={activeStory.thumbnail}
                    alt={activeStory.title}
                    fill
                    className="object-cover"
                    sizes="100vw"
                    priority
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/55 px-8 text-center">
                    <p className="text-lg font-semibold text-zinc-100">{activeStory.title}</p>
                  </div>
                </div>
              ) : (
                <Image
                  src={activeStory.thumbnail}
                  alt={activeStory.title}
                  fill
                  className="object-cover"
                  sizes="100vw"
                  priority
                  onError={onMediaError}
                />
              )}
              <div
                className={`absolute inset-0 ${
                  variant === 'reel'
                    ? 'bg-gradient-to-b from-black/75 via-black/35 to-black/85'
                    : 'bg-gradient-to-b from-black/70 via-black/20 to-black/75'
                }`}
              />
            </div>

            <div className="relative z-10 flex h-full flex-col">
              <div
                className={`${
                  variant === 'reel'
                    ? 'px-3 pb-2 pt-[max(0.6rem,env(safe-area-inset-top))] sm:px-4'
                    : 'px-3 pb-2 pt-3 sm:px-4 sm:pt-4'
                }`}
              >
                {variant !== 'reel' ? (
                  <div className="flex gap-1">
                    {stories.map((story, index) => {
                      const width =
                        index < activeIndex ? 100 : index === activeIndex ? progress * 100 : 0;
                      return (
                        <div
                          key={`story-progress-${story.id}`}
                          className="h-1 flex-1 overflow-hidden rounded-full bg-white/25"
                        >
                          <div
                            className="h-full rounded-full bg-white transition-[width] duration-100"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {variant === 'reel' ? (
                  <div className="mt-3 flex justify-end text-white">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-full border border-white/40 bg-black/35 p-2 text-white transition hover:bg-black/55"
                      aria-label="Close story viewer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center justify-between gap-3 text-white">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {activeStory.category || 'Visual Story'}
                      </p>
                      <p className="truncate text-xs text-white/80">
                        {activeStory.author || 'Desk'} / {activeIndex + 1}/{stories.length}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {activeStory.mediaType === 'video' && !isYouTubeStory ? (
                        <button
                          type="button"
                          onClick={() => setIsMuted((prev) => !prev)}
                          className="rounded-full border border-white/40 bg-black/35 p-2 text-white transition hover:bg-black/55"
                          aria-label={isMuted ? 'Unmute' : 'Mute'}
                        >
                          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setIsPaused((prev) => !prev)}
                        className="rounded-full border border-white/40 bg-black/35 p-2 text-white transition hover:bg-black/55"
                        aria-label={isPaused ? 'Resume story' : 'Pause story'}
                      >
                        {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full border border-white/40 bg-black/35 p-2 text-white transition hover:bg-black/55"
                        aria-label="Close story viewer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div
                className={`grid flex-1 ${
                  variant === 'reel' ? 'grid-cols-3' : 'grid-cols-2'
                }`}
              >
                <button
                  type="button"
                  className="h-full w-full bg-transparent"
                  onClick={goPrev}
                  aria-label="Previous story"
                />
                {variant === 'reel' ? (
                  <>
                    <button
                      type="button"
                      className="h-full w-full bg-transparent"
                      onClick={togglePlayPause}
                      aria-label={isPaused ? 'Resume story' : 'Pause story'}
                    />
                    <button
                      type="button"
                      className="h-full w-full bg-transparent"
                      onClick={goNext}
                      aria-label="Next story"
                    />
                  </>
                ) : (
                  <button
                    type="button"
                    className="h-full w-full bg-transparent"
                    onClick={goNext}
                    aria-label="Next story"
                  />
                )}
              </div>

              {variant !== 'reel' ? (
                <div className="relative z-20 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pt-6">
                  <h2 className="max-w-3xl text-xl font-black leading-tight text-white sm:text-2xl">
                    {activeStory.title}
                  </h2>
                  {activeStory.caption ? (
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/85 sm:text-base">
                      {activeStory.caption}
                    </p>
                  ) : null}

                  {hasStoryHref ? (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      {isExternalHref(storyHref) ? (
                        <a
                          href={storyHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={onClose}
                          className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/15 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25"
                        >
                          {ctaLabel}
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : (
                        <Link
                          href={storyHref}
                          onClick={onClose}
                          className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/15 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25"
                        >
                          {ctaLabel}
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {variant === 'reel' ? (
              <>
                <div className="absolute right-3 bottom-[max(4.5rem,calc(env(safe-area-inset-bottom)+2.5rem))] z-30 flex flex-col gap-3 sm:right-4 md:bottom-16">
                  <button
                    type="button"
                    onClick={onShare}
                    className="rounded-2xl border border-white/20 bg-black/35 p-2.5 text-white shadow-[0_10px_28px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:bg-black/50 sm:p-3 md:p-3.5"
                    aria-label="Share story"
                  >
                    <Share2 className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={toggleMuted}
                    disabled={!canMuteStory}
                    className="rounded-2xl border border-white/20 bg-black/35 p-2.5 text-white shadow-[0_10px_28px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:bg-black/50 disabled:cursor-not-allowed disabled:opacity-50 sm:p-3 md:p-3.5"
                    aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                  >
                    {isMuted ? <VolumeX className="h-4 w-4 sm:h-5 sm:w-5" /> : <Volume2 className="h-4 w-4 sm:h-5 sm:w-5" />}
                  </button>
                </div>

                <div className="pointer-events-none absolute bottom-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.35rem))] left-1/2 z-30 -translate-x-1/2 rounded-full border border-white/25 bg-black/45 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur md:text-xs">
                  {formatTimeLabel(elapsedMs)} / {formatTimeLabel(durationMs)}
                </div>

                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute right-3 top-24 z-20 hidden rounded-full border border-white/40 bg-black/35 p-2 text-white backdrop-blur transition hover:bg-black/55 md:block"
                  aria-label="Previous story"
                >
                  <ChevronUp className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-3 bottom-28 z-20 hidden rounded-full border border-white/40 bg-black/35 p-2 text-white backdrop-blur transition hover:bg-black/55 md:block"
                  aria-label="Next story"
                >
                  <ChevronDown className="h-5 w-5" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute left-2 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/40 bg-black/35 p-2 text-white backdrop-blur transition hover:bg-black/55 md:block"
                  aria-label="Previous story"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-2 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/40 bg-black/35 p-2 text-white backdrop-blur transition hover:bg-black/55 md:block"
                  aria-label="Next story"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
