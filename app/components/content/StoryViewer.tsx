'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
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
  return Math.max(2, Math.min(30, Number(value)));
}

function isExternalHref(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('http://') || normalized.startsWith('https://');
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
  const [isMuted, setIsMuted] = useState(true);
  const [mediaErrors, setMediaErrors] = useState<Record<string, boolean>>({});
  const [videoDurationMs, setVideoDurationMs] = useState<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wheelLockUntilRef = useRef(0);

  const boundedInitialIndex = Math.min(
    Math.max(initialIndex, 0),
    Math.max(stories.length - 1, 0)
  );

  const activeStory = stories[activeIndex];
  const storyHref = (activeStory?.href || activeStory?.linkUrl || '').trim();
  const hasStoryHref = Boolean(storyHref);
  const ctaLabel = (activeStory?.linkLabel || '').trim() || 'Read Full Story';

  const durationMs = useMemo(() => {
    const fallback = normalizeDurationSeconds(activeStory?.durationSeconds) * 1000;
    if (activeStory?.mediaType === 'video' && videoDurationMs && videoDurationMs > 1000) {
      return Math.min(videoDurationMs, 30000);
    }
    return fallback;
  }, [activeStory?.durationSeconds, activeStory?.mediaType, videoDurationMs]);

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
  }, [boundedInitialIndex, goToIndex, isOpen]);

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
    if (!isOpen || !activeStory || isPaused) return;
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
  }, [activeStory, activeStory?.id, durationMs, goNext, isOpen, isPaused]);

  useEffect(() => {
    if (!isOpen || activeStory?.mediaType !== 'video') return;
    const video = videoRef.current;
    if (!video) return;

    if (isPaused) {
      video.pause();
    } else {
      video.play().catch(() => {
        setMediaErrors((prev) => ({ ...prev, [activeStory.id]: true }));
      });
    }
  }, [activeStory?.id, activeStory?.mediaType, isOpen, isPaused]);

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
        if (dy < 0) goNext();
        if (dy > 0) goPrev();
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
            className="relative h-full w-full touch-pan-y overflow-hidden"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <div className="absolute inset-0">
              {activeStory.mediaType === 'video' &&
              activeStory.mediaUrl &&
              !mediaErrors[activeStory.id] ? (
                <video
                  ref={videoRef}
                  src={activeStory.mediaUrl}
                  className="h-full w-full object-cover"
                  playsInline
                  autoPlay
                  muted={isMuted}
                  onEnded={goNext}
                  onError={onMediaError}
                  onLoadedMetadata={onVideoMetadata}
                />
              ) : mediaErrors[activeStory.id] ? (
                <div className="flex h-full w-full items-center justify-center bg-zinc-900 px-8 text-center">
                  <p className="text-lg font-semibold text-zinc-100">{activeStory.title}</p>
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
                <div
                  className={`${
                    variant === 'reel'
                      ? 'rounded-xl border border-white/15 bg-black/35 px-2 py-1.5 backdrop-blur'
                      : ''
                  }`}
                >
                  <div className="flex gap-1">
                  {stories.map((story, index) => {
                    const width =
                      index < activeIndex ? 100 : index === activeIndex ? progress * 100 : 0;
                    return (
                      <div
                        key={`story-progress-${story.id}`}
                        className={`flex-1 overflow-hidden rounded-full ${
                          variant === 'reel' ? 'h-1.5 bg-white/20' : 'h-1 bg-white/25'
                        }`}
                      >
                        <div
                          className={`h-full rounded-full transition-[width] duration-100 ${
                            index === activeIndex && variant === 'reel'
                              ? 'bg-gradient-to-r from-pink-400 via-orange-300 to-yellow-300'
                              : 'bg-white'
                          }`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-white">
                  <div className="min-w-0">
                    <p className={`truncate font-semibold ${variant === 'reel' ? 'text-base' : 'text-sm'}`}>
                      {activeStory.category || 'Visual Story'}
                    </p>
                    <p className="truncate text-xs text-white/80">
                      {activeStory.author || 'Desk'} / {activeIndex + 1}/{stories.length}
                    </p>
                    {variant === 'reel' ? (
                      <p className="truncate text-[11px] text-white/65">
                        Swipe up/down or tap top/bottom
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    {variant !== 'reel' ? (
                      <>
                        {activeStory.mediaType === 'video' ? (
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
                      </>
                    ) : null}
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
              </div>

              <div
                className={`grid flex-1 ${
                  variant === 'reel' ? 'grid-cols-1 grid-rows-2' : 'grid-cols-2'
                }`}
              >
                <button
                  type="button"
                  className="h-full w-full bg-transparent"
                  onClick={goPrev}
                  aria-label="Previous story"
                />
                <button
                  type="button"
                  className="h-full w-full bg-transparent"
                  onClick={goNext}
                  aria-label="Next story"
                />
              </div>

              <div
                className={`relative z-20 ${
                  variant === 'reel'
                    ? 'px-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-3 sm:px-4'
                    : 'px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pt-6'
                }`}
              >
                <div
                  className={`${
                    variant === 'reel'
                      ? 'max-w-[calc(100%-4.8rem)] rounded-2xl border border-white/15 bg-black/45 px-3 py-3 backdrop-blur-sm'
                      : ''
                  }`}
                >
                  {variant === 'reel' ? (
                    <p className="mb-1.5 inline-flex rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white/90">
                      @{(activeStory.author || 'desk').replace(/\s+/g, '').toLowerCase()}
                    </p>
                  ) : null}
                  <h2 className={`max-w-3xl font-black leading-tight text-white ${variant === 'reel' ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'}`}>
                    {activeStory.title}
                  </h2>
                  {activeStory.caption ? (
                    <p className={`mt-2 max-w-3xl leading-relaxed text-white/85 ${variant === 'reel' ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'}`}>
                      {activeStory.caption}
                    </p>
                  ) : null}

                  {hasStoryHref ? (
                    <div className={`mt-3 flex flex-wrap items-center gap-3 ${variant === 'reel' ? '' : 'mt-4'}`}>
                      {isExternalHref(storyHref) ? (
                        <a
                          href={storyHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={onClose}
                          className={`inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/15 font-semibold text-white backdrop-blur transition hover:bg-white/25 ${
                            variant === 'reel' ? 'px-4 py-2 text-xs' : 'px-5 py-2.5 text-sm'
                          }`}
                        >
                          {ctaLabel}
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : (
                        <Link
                          href={storyHref}
                          onClick={onClose}
                          className={`inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/15 font-semibold text-white backdrop-blur transition hover:bg-white/25 ${
                            variant === 'reel' ? 'px-4 py-2 text-xs' : 'px-5 py-2.5 text-sm'
                          }`}
                        >
                          {ctaLabel}
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {variant === 'reel' ? (
              <>
                <div className="absolute bottom-[max(5rem,env(safe-area-inset-bottom)+3.6rem)] right-3 z-20 flex flex-col items-center gap-2.5">
                  {activeStory.mediaType === 'video' ? (
                    <button
                      type="button"
                      onClick={() => setIsMuted((prev) => !prev)}
                      className="rounded-full border border-white/40 bg-black/35 p-2.5 text-white backdrop-blur transition hover:bg-black/55"
                      aria-label={isMuted ? 'Unmute' : 'Mute'}
                    >
                      {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setIsPaused((prev) => !prev)}
                    className="rounded-full border border-white/40 bg-black/35 p-2.5 text-white backdrop-blur transition hover:bg-black/55"
                    aria-label={isPaused ? 'Resume story' : 'Pause story'}
                  >
                    {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  </button>
                  {hasStoryHref ? (
                    isExternalHref(storyHref) ? (
                      <a
                        href={storyHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={onClose}
                        className="inline-flex items-center gap-1 rounded-full border border-white/35 bg-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur hover:bg-white/25"
                      >
                        Open
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <Link
                        href={storyHref}
                        onClick={onClose}
                        className="inline-flex items-center gap-1 rounded-full border border-white/35 bg-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur hover:bg-white/25"
                      >
                        Open
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    )
                  ) : null}
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
                  className="absolute right-3 bottom-24 z-20 hidden rounded-full border border-white/40 bg-black/35 p-2 text-white backdrop-blur transition hover:bg-black/55 md:block"
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
