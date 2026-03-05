'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Heart,
  Play,
  SlidersHorizontal,
  Share2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import formatNumber from '@/lib/utils/formatNumber';

const VIEWPORT_HEIGHT_CLASS = 'h-[calc(100dvh-12.9rem)] md:h-[calc(100dvh-13.4rem)]';
const IMMERSIVE_VIEWPORT_HEIGHT_CLASS = 'h-vh-dvh h-dvh';
const SHORTS_SETTINGS_KEY = 'lokswami.shorts.settings.v1';
const PLAYBACK_SPEED_OPTIONS = [0.5, 1, 1.25, 1.5, 2] as const;
const QUALITY_OPTIONS = [
  { id: 'auto-360p', label: 'Auto (360p)' },
  { id: '720p', label: '720p' },
  { id: '1080p', label: '1080p' },
] as const;

type PlaybackSpeed = (typeof PLAYBACK_SPEED_OPTIONS)[number];
type QualityOption = (typeof QUALITY_OPTIONS)[number]['id'];
type SettingsPanelView = 'main' | 'playback-speed' | 'quality';

type ShortsSettings = {
  autoAdvance: boolean;
  captions: boolean;
  defaultVolume: number;
  muteByDefault: boolean;
  playbackSpeed: PlaybackSpeed;
  quality: QualityOption;
  dataSaver: boolean;
};

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
  onReachEnd?: () => void;
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

function clampVolume(value: number) {
  if (!Number.isFinite(value)) return 70;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizePlaybackSpeed(value: unknown): PlaybackSpeed {
  const numeric = Number(value);
  if (PLAYBACK_SPEED_OPTIONS.includes(numeric as PlaybackSpeed)) {
    return numeric as PlaybackSpeed;
  }
  return 1;
}

function normalizeQualityOption(value: unknown): QualityOption {
  const candidate = String(value || '').trim();
  if (QUALITY_OPTIONS.some((option) => option.id === candidate)) {
    return candidate as QualityOption;
  }
  return 'auto-360p';
}

function formatPlaybackSpeedLabel(speed: PlaybackSpeed) {
  if (speed === 1) return '1x / Normal';
  return `${speed}x`;
}

function formatQualityLabel(quality: QualityOption) {
  return QUALITY_OPTIONS.find((option) => option.id === quality)?.label || 'Auto (360p)';
}

function normalizeShortsSettings(source: unknown): ShortsSettings {
  if (!source || typeof source !== 'object') {
    return {
      autoAdvance: true,
      captions: true,
      defaultVolume: 70,
      muteByDefault: true,
      playbackSpeed: 1,
      quality: 'auto-360p',
      dataSaver: false,
    };
  }

  const raw = source as Record<string, unknown>;

  return {
    autoAdvance: raw.autoAdvance !== false,
    captions: raw.captions !== false,
    defaultVolume: clampVolume(Number(raw.defaultVolume)),
    muteByDefault: raw.muteByDefault !== false,
    playbackSpeed: normalizePlaybackSpeed(raw.playbackSpeed),
    quality: normalizeQualityOption(raw.quality),
    dataSaver: raw.dataSaver === true,
  };
}

export default function VideoShortsFeed({
  videos,
  language,
  immersiveMode = false,
  onReachEnd,
}: VideoShortsFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const iframeRefs = useRef<Array<HTMLIFrameElement | null>>([]);
  const actionPillRef = useRef<HTMLDivElement | null>(null);
  const settingsPanelRef = useRef<HTMLDivElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const didSwipeRef = useRef(false);
  const isAnimatingRef = useRef(false);
  const hasUnlockedAudioRef = useRef(false);
  const hasHydratedSettingsRef = useRef(false);
  const lastAutoReachEndLengthRef = useRef(-1);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsPanelView, setSettingsPanelView] = useState<SettingsPanelView>('main');
  const [isVolumeExpanded, setIsVolumeExpanded] = useState(false);
  const [settings, setSettings] = useState<ShortsSettings>(() =>
    normalizeShortsSettings(null)
  );
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
    if (!onReachEnd || videos.length === 0) return;
    if (activeIndex < Math.max(0, videos.length - 2)) return;
    if (lastAutoReachEndLengthRef.current === videos.length) return;

    lastAutoReachEndLengthRef.current = videos.length;
    onReachEnd();
  }, [activeIndex, onReachEnd, videos.length]);

  useEffect(() => {
    setIsPaused(false);
  }, [activeIndex]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem(SHORTS_SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as unknown;
        const next = normalizeShortsSettings(parsed);
        setSettings(next);
        // Always start muted to satisfy mobile autoplay policies.
        setIsMuted(true);
      }
    } catch {
      // Ignore invalid persisted settings.
    } finally {
      hasHydratedSettingsRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!hasHydratedSettingsRef.current || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SHORTS_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage write errors.
    }
  }, [settings]);

  useEffect(() => {
    if (!isSettingsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSettingsOpen]);

  useEffect(() => {
    if (!isSettingsOpen || typeof document === 'undefined') return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (settingsPanelRef.current?.contains(target)) return;
      if (actionPillRef.current?.contains(target)) return;
      setIsSettingsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isSettingsOpen]);

  useEffect(() => {
    if (!settings.muteByDefault) return;
    setIsMuted(true);
  }, [settings.muteByDefault]);

  const updateSettings = useCallback(
    (updater: (previous: ShortsSettings) => ShortsSettings) => {
      setSettings((previous) => updater(previous));
    },
    []
  );

  const applyNativeVideoPreferences = useCallback(
    (video: HTMLVideoElement | null, mutedState: boolean) => {
      if (!video) return;
      video.playbackRate = settings.playbackSpeed;
      video.defaultPlaybackRate = settings.playbackSpeed;
      video.volume = settings.defaultVolume / 100;
      video.muted = mutedState;
    },
    [settings.defaultVolume, settings.playbackSpeed]
  );

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diff < 60) {
      return language === 'hi' ? `${diff} \u092e\u093f\u0928\u091f \u092a\u0939\u0932\u0947` : `${diff} min ago`;
    }

    if (diff < 1440) {
      const hours = Math.floor(diff / 60);
      return language === 'hi' ? `${hours} \u0918\u0902\u091f\u0947 \u092a\u0939\u0932\u0947` : `${hours} hours ago`;
    }

    const days = Math.floor(diff / 1440);
    return language === 'hi' ? `${days} \u0926\u093f\u0928 \u092a\u0939\u0932\u0947` : `${days} days ago`;
  };

  const renderTime = (dateString: string) =>
    isHydrated ? formatTime(dateString) : language === 'hi' ? '\u0939\u093e\u0932 \u0939\u0940 \u092e\u0947\u0902' : 'recently';

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
  const effectiveMuted = isMuted || !hasUnlockedAudioRef.current;

  const viewportHeightClass = immersiveMode
    ? IMMERSIVE_VIEWPORT_HEIGHT_CLASS
    : VIEWPORT_HEIGHT_CLASS;
  const actionPillPositionClass = 'right-3 md:right-6 bottom-[92px] md:bottom-[120px]';
  const settingsPanelPositionClass = 'right-[60px] md:right-[84px] bottom-[92px] md:bottom-[120px]';
  const shellClass = immersiveMode
    ? 'h-vh-dvh w-full'
    : 'mx-auto w-full max-w-none lg:max-w-[480px]';
  const feedClass = immersiveMode
    ? `scrollbar-hide ${viewportHeightClass} w-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain rounded-none border-0 bg-black shadow-none touch-pan-y`
    : `scrollbar-hide ${viewportHeightClass} snap-y snap-mandatory overflow-y-auto overscroll-y-contain rounded-none border-0 bg-zinc-950 shadow-none lg:rounded-[28px] lg:border lg:border-zinc-800 lg:shadow-[0_34px_80px_rgba(0,0,0,0.55)]`;
  const actionIconButtonClass =
    'inline-flex h-10 w-10 items-center justify-center text-white/90 opacity-80 transition-opacity duration-200 hover:opacity-100 active:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90 focus-visible:ring-offset-2 focus-visible:ring-offset-black md:h-12 md:w-12';
  const settingsRowClass =
    'flex h-12 w-full items-center justify-between rounded-xl px-3 text-left transition-colors hover:bg-white/5 active:bg-white/10 md:h-14 md:px-4';

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
    hasUnlockedAudioRef.current = true;
    setIsMuted(false);

    const current = videos[activeIndex];
    if (!current) return;

    const isYouTube = Boolean(getYouTubeId(current.videoUrl));
    if (isYouTube) {
      const iframe = iframeRefs.current[activeIndex];
      if (!iframe) return;

      sendYouTubeCommand(iframe, 'unMute');
      sendYouTubeCommand(iframe, 'playVideo');
      setIsPaused(false);
      return;
    }

    const video = videoRefs.current[activeIndex];
    if (!video) return;

    // User tap unlock: unmute and explicitly re-play for mobile browsers.
    applyNativeVideoPreferences(video, false);
    video.muted = false;
    void video.play().catch(() => undefined);
    setIsPaused(false);
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
        sendYouTubeCommand(iframe, effectiveMuted ? 'mute' : 'unMute');
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
      applyNativeVideoPreferences(video, effectiveMuted);
      void video.play().catch(() => undefined);
      setIsPaused(false);
      return;
    }

    video.pause();
    setIsPaused(true);
  };

  const scrollToIndex = useCallback((index: number) => {
    if (!videos.length) return;
    if (index > videos.length - 1) {
      onReachEnd?.();
    }

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
  }, [onReachEnd, videos.length]);

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
        applyNativeVideoPreferences(video, effectiveMuted);
        if (isPaused) {
          video.pause();
          return;
        }

        void video.play().catch(() => undefined);
        return;
      }

      applyNativeVideoPreferences(video, true);
      video.pause();
      video.currentTime = 0;
    });

    iframeRefs.current.forEach((iframe, index) => {
      if (!iframe) return;
      if (index === activeIndex) {
        sendYouTubeCommand(iframe, isPaused ? 'pauseVideo' : 'playVideo');
        if (!isPaused) {
          sendYouTubeCommand(iframe, effectiveMuted ? 'mute' : 'unMute');
        }
        return;
      }

      sendYouTubeCommand(iframe, 'mute');
      sendYouTubeCommand(iframe, 'pauseVideo');
    });
  }, [activeIndex, applyNativeVideoPreferences, effectiveMuted, isPaused, videos.length]);

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
    applyNativeVideoPreferences(element, effectiveMuted);
    const resolvedDuration =
      Number.isFinite(element.duration) && element.duration > 0 ? element.duration : fallbackDuration;

    setDurationById((prev) => {
      if (prev[videoId] === resolvedDuration) return prev;
      return { ...prev, [videoId]: resolvedDuration };
    });
  };

  const handleVideoDurationChange = (videoId: string, fallbackDuration: number, event: React.SyntheticEvent<HTMLVideoElement>) => {
    const element = event.currentTarget;
    applyNativeVideoPreferences(element, effectiveMuted);
    const resolvedDuration =
      Number.isFinite(element.duration) && element.duration > 0 ? element.duration : fallbackDuration;

    setDurationById((prev) => {
      if (prev[videoId] === resolvedDuration) return prev;
      return { ...prev, [videoId]: resolvedDuration };
    });
  };

  const handleVideoEnded = (index: number) => {
    if (index !== activeIndex) return;
    if (settings.autoAdvance) {
      scrollToIndex(activeIndex + 1);
      return;
    }
    setIsPaused(true);
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
    applyNativeVideoPreferences(element, effectiveMuted);
    const nextCurrentTime = Number.isFinite(element.currentTime) ? element.currentTime : 0;
    const nextDuration = Number.isFinite(element.duration) && element.duration > 0 ? element.duration : 0;

    setCurrentTimeById((prev) => ({ ...prev, [videoId]: nextCurrentTime }));
    if (nextDuration > 0) {
      setDurationById((prev) => ({ ...prev, [videoId]: nextDuration }));
    }
    setIsPaused(false);
  };

  const openSettingsPanel = () => {
    setIsVolumeExpanded(false);
    setSettingsPanelView('main');
    setIsSettingsOpen(true);
  };

  const closeSettingsPanel = () => {
    setIsSettingsOpen(false);
    setIsVolumeExpanded(false);
    setSettingsPanelView('main');
  };

  useEffect(() => {
    if (!immersiveMode || typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;
    const previousRootBg = root.style.backgroundColor;
    const previousBodyBg = body.style.backgroundColor;

    root.style.backgroundColor = '#000';
    body.style.backgroundColor = '#000';

    return () => {
      root.style.backgroundColor = previousRootBg;
      body.style.backgroundColor = previousBodyBg;
    };
  }, [immersiveMode]);

  if (!videos.length) {
    return (
      <div className="mx-auto max-w-[470px] rounded-3xl border border-zinc-200 bg-white px-6 py-14 text-center shadow-[0_20px_55px_rgba(0,0,0,0.08)] dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {language === 'hi' ? '\u0915\u094b\u0908 \u0936\u0949\u0930\u094d\u091f\u094d\u0938 \u0909\u092a\u0932\u092c\u094d\u0927 \u0928\u0939\u0940\u0902 \u0939\u0948' : 'No shorts available right now'}
        </p>
      </div>
    );
  }

  const sectionClass = immersiveMode
    ? 'fixed inset-0 z-40 h-vh-dvh h-dvh w-full overflow-hidden bg-black overscroll-none'
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
                            sendYouTubeCommand(iframe, effectiveMuted ? 'mute' : 'unMute');
                          }
                          return;
                        }

                        sendYouTubeCommand(iframe, 'mute');
                        sendYouTubeCommand(iframe, 'pauseVideo');
                      }}
                      title={video.title}
                      src={`https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&playsinline=1&controls=0&mute=1&loop=1&playlist=${youtubeId}&autoplay=${index === activeIndex ? 1 : 0}&rel=0&modestbranding=1`}
                      className="absolute inset-0 h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      ref={(el) => {
                        videoRefs.current[index] = el;
                        if (el) {
                          el.defaultMuted = true;
                        }
                      }}
                      src={video.videoUrl}
                      poster={video.thumbnail}
                      className="absolute inset-0 h-full w-full object-cover"
                      loop={!settings.autoAdvance}
                      muted={effectiveMuted}
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
                      onEnded={() => handleVideoEnded(index)}
                    />
                  )}
                </div>

                {!immersiveMode ? (
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                ) : null}

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

                {!immersiveMode && settings.captions ? (
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
                      {language === 'hi' ? '\u092a\u0942\u0930\u0940 \u0916\u092c\u0930' : 'Read Story'}
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
          <div
            ref={actionPillRef}
            className={`absolute z-30 pointer-events-auto ${actionPillPositionClass}`}
            data-swipe-ignore="true"
          >
            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/40 p-2 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md md:gap-4 md:p-3">
              <button
                type="button"
                onClick={handleLike}
                className={`${actionIconButtonClass} ${likedIds[activeVideo.id] ? 'opacity-100 text-red-400' : ''}`}
                aria-label={language === 'hi' ? '\u0932\u093e\u0907\u0915' : 'Like'}
                data-swipe-ignore="true"
              >
                <Heart
                  className={`h-[22px] w-[22px] md:h-[26px] md:w-[26px] ${
                    likedIds[activeVideo.id] ? 'fill-current' : ''
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={handleMuteToggle}
                className={actionIconButtonClass}
                aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                data-swipe-ignore="true"
              >
                {isMuted ? (
                  <VolumeX className="h-[22px] w-[22px] md:h-[26px] md:w-[26px]" />
                ) : (
                  <Volume2 className="h-[22px] w-[22px] md:h-[26px] md:w-[26px]" />
                )}
              </button>

              <button
                type="button"
                onClick={handleShare}
                className={actionIconButtonClass}
                aria-label={language === 'hi' ? '\u0936\u0947\u092f\u0930 \u0915\u0930\u0947\u0902' : 'Share'}
                data-swipe-ignore="true"
              >
                <Share2 className="h-[22px] w-[22px] md:h-[26px] md:w-[26px]" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isSettingsOpen) {
                    closeSettingsPanel();
                    return;
                  }
                  openSettingsPanel();
                }}
                className={actionIconButtonClass}
                aria-label={language === 'hi' ? '\u0938\u0947\u091f\u093f\u0902\u0917\u094d\u0938' : 'Settings'}
                data-swipe-ignore="true"
              >
                <SlidersHorizontal className="h-[22px] w-[22px] md:h-[26px] md:w-[26px]" />
              </button>
            </div>
          </div>
        ) : null}

        {isSettingsOpen && activeVideo ? (
          <div
            ref={settingsPanelRef}
            role="dialog"
            aria-modal="false"
            aria-label={language === 'hi' ? '\u0935\u0940\u0921\u093f\u092f\u094b \u0938\u0947\u091f\u093f\u0902\u0917\u094d\u0938' : 'Video settings'}
            className={`absolute z-40 w-[280px] max-w-[calc(100vw-4.5rem)] rounded-2xl border border-white/10 bg-black/70 p-2 shadow-lg backdrop-blur-md md:w-[340px] md:max-w-[calc(100vw-8rem)] ${settingsPanelPositionClass}`}
            data-swipe-ignore="true"
          >
            <div className="max-h-[280px] overflow-y-auto md:max-h-[340px]">
              <div key={settingsPanelView} className="origin-bottom-right space-y-1 transition-all duration-200 ease-out">
                {settingsPanelView === 'main' ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        updateSettings((prev) => ({ ...prev, autoAdvance: !prev.autoAdvance }))
                      }
                      className={settingsRowClass}
                    >
                      <span className="inline-flex items-center gap-2.5 text-sm text-white md:text-base">
                        <Clock3 className="h-5 w-5 md:h-6 md:w-6" />
                        {language === 'hi' ? '\u0911\u091f\u094b \u090f\u0921\u0935\u093e\u0902\u0938' : 'Auto-advance'}
                      </span>
                      <span
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                          settings.autoAdvance ? 'bg-red-500' : 'bg-zinc-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                            settings.autoAdvance ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        updateSettings((prev) => ({ ...prev, captions: !prev.captions }))
                      }
                      className={settingsRowClass}
                    >
                      <span className="inline-flex items-center gap-2.5 text-sm text-white md:text-base">
                        <Eye className="h-5 w-5 md:h-6 md:w-6" />
                        {language === 'hi' ? '\u0915\u0948\u092a\u094d\u0936\u0928' : 'Captions'}
                      </span>
                      <span
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                          settings.captions ? 'bg-red-500' : 'bg-zinc-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                            settings.captions ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsVolumeExpanded((prev) => !prev)}
                      className={settingsRowClass}
                    >
                      <span className="inline-flex items-center gap-2.5 text-sm text-white md:text-base">
                        <Volume2 className="h-5 w-5 md:h-6 md:w-6" />
                        {language === 'hi' ? '\u0921\u093f\u092b\u0949\u0932\u094d\u091f \u0935\u0949\u0932\u094d\u092f\u0942\u092e' : 'Default volume'}
                      </span>
                      <span className="inline-flex items-center gap-2 text-xs text-white/60 md:text-sm">
                        {settings.defaultVolume}%
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </button>

                    {isVolumeExpanded ? (
                      <div className="rounded-xl px-3 pb-2 pt-1 md:px-4">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={settings.defaultVolume}
                          onChange={(event) => {
                            const nextVolume = clampVolume(Number(event.target.value));
                            updateSettings((prev) => ({ ...prev, defaultVolume: nextVolume }));
                          }}
                          className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/20 accent-red-500"
                          aria-label={language === 'hi' ? '\u0921\u093f\u092b\u0949\u0932\u094d\u091f \u0935\u0949\u0932\u094d\u092f\u0942\u092e' : 'Default volume'}
                        />
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() =>
                        updateSettings((prev) => ({ ...prev, muteByDefault: !prev.muteByDefault }))
                      }
                      className={settingsRowClass}
                    >
                      <span className="inline-flex items-center gap-2.5 text-sm text-white md:text-base">
                        <VolumeX className="h-5 w-5 md:h-6 md:w-6" />
                        {language === 'hi' ? '\u092e\u094d\u092f\u0942\u091f \u092c\u093e\u0908 \u0921\u093f\u092b\u0949\u0932\u094d\u091f' : 'Mute by default'}
                      </span>
                      <span
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                          settings.muteByDefault ? 'bg-red-500' : 'bg-zinc-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                            settings.muteByDefault ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsVolumeExpanded(false);
                        setSettingsPanelView('playback-speed');
                      }}
                      className={settingsRowClass}
                    >
                      <span className="inline-flex items-center gap-2.5 text-sm text-white md:text-base">
                        <Play className="h-5 w-5 md:h-6 md:w-6" />
                        {language === 'hi' ? '\u092a\u094d\u0932\u0947\u092c\u0948\u0915 \u0938\u094d\u092a\u0940\u0921' : 'Playback speed'}
                      </span>
                      <span className="inline-flex items-center gap-2 text-xs text-white/60 md:text-sm">
                        {formatPlaybackSpeedLabel(settings.playbackSpeed)}
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsVolumeExpanded(false);
                        setSettingsPanelView('quality');
                      }}
                      className={settingsRowClass}
                    >
                      <span className="inline-flex items-center gap-2.5 text-sm text-white md:text-base">
                        <SlidersHorizontal className="h-5 w-5 md:h-6 md:w-6" />
                        {language === 'hi' ? '\u0915\u094d\u0935\u093e\u0932\u093f\u091f\u0940' : 'Quality'}
                      </span>
                      <span className="inline-flex items-center gap-2 text-xs text-white/60 md:text-sm">
                        {formatQualityLabel(settings.quality)}
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </button>
                  </>
                ) : null}

                {settingsPanelView === 'playback-speed' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setSettingsPanelView('main')}
                      className={settingsRowClass}
                    >
                      <span className="inline-flex items-center gap-2.5 text-sm text-white md:text-base">
                        <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
                        {language === 'hi' ? '\u092a\u094d\u0932\u0947\u092c\u0948\u0915 \u0938\u094d\u092a\u0940\u0921' : 'Playback speed'}
                      </span>
                    </button>

                    {PLAYBACK_SPEED_OPTIONS.map((speed) => (
                      <button
                        key={speed}
                        type="button"
                        onClick={() => {
                          updateSettings((prev) => ({ ...prev, playbackSpeed: speed }));
                          setSettingsPanelView('main');
                        }}
                        className={`${settingsRowClass} ${
                          settings.playbackSpeed === speed ? 'bg-white/10 text-white' : 'text-white/90'
                        }`}
                      >
                        <span className="text-sm md:text-base">{formatPlaybackSpeedLabel(speed)}</span>
                        {settings.playbackSpeed === speed ? <Check className="h-4 w-4 md:h-5 md:w-5" /> : null}
                      </button>
                    ))}
                  </>
                ) : null}

                {settingsPanelView === 'quality' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setSettingsPanelView('main')}
                      className={settingsRowClass}
                    >
                      <span className="inline-flex items-center gap-2.5 text-sm text-white md:text-base">
                        <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
                        {language === 'hi' ? '\u0915\u094d\u0935\u093e\u0932\u093f\u091f\u0940' : 'Quality'}
                      </span>
                    </button>

                    {QUALITY_OPTIONS.map((qualityOption) => (
                      <button
                        key={qualityOption.id}
                        type="button"
                        onClick={() => {
                          updateSettings((prev) => ({ ...prev, quality: qualityOption.id }));
                          setSettingsPanelView('main');
                        }}
                        className={`${settingsRowClass} ${
                          settings.quality === qualityOption.id ? 'bg-white/10 text-white' : 'text-white/90'
                        }`}
                      >
                        <span className="text-sm md:text-base">{qualityOption.label}</span>
                        {settings.quality === qualityOption.id ? <Check className="h-4 w-4 md:h-5 md:w-5" /> : null}
                      </button>
                    ))}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {immersiveMode && activeVideo && settings.captions ? (
          <div className="pointer-events-none absolute bottom-16 left-0 right-0 z-20 px-4 pb-[env(safe-area-inset-bottom)] md:bottom-20 md:px-8">
            <div className="overflow-hidden whitespace-nowrap pr-20 md:pr-24">
              <p className="truncate whitespace-nowrap overflow-hidden text-sm font-medium text-white md:text-base lg:text-lg">
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


