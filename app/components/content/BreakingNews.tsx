'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Volume2, VolumeX } from 'lucide-react';
import { useAppStore } from '@/lib/store/appStore';
import Container from '../common/Container';
import styles from './BreakingNews.module.css';
import { breakingNews as mockBreakingNews } from '@/lib/mock/data';
import {
  normalizeBreakingNewsItem,
  sortBreakingNewsItems,
  type BreakingNewsItem,
} from '@/lib/types/breaking';

type BreakingApiPayload = {
  items?: unknown;
};

interface BreakingNewsProps {
  items?: BreakingNewsItem[];
  // Backward compatibility for existing usage.
  news?: BreakingNewsItem[];
  speedSeconds?: number;
  pauseOnHover?: boolean;
  showTime?: boolean;
}

const MIN_SPEED_SECONDS = 8;
const MAX_SPEED_SECONDS = 120;
const BREAKING_LIMIT = 10;
const STORAGE_KEY = 'lokswami.breaking.cache.v1';
const CACHE_TTL_MS = 120_000;

let memoryCache: {
  at: number;
  items: BreakingNewsItem[];
} | null = null;

function normalizeList(value: unknown): BreakingNewsItem[] {
  if (!Array.isArray(value)) return [];
  const mapped = value
    .map((item) => normalizeBreakingNewsItem(item))
    .filter((item): item is BreakingNewsItem => Boolean(item));
  return sortBreakingNewsItems(mapped);
}

function mockFallbackList(): BreakingNewsItem[] {
  return sortBreakingNewsItems(
    mockBreakingNews
      .map((item) =>
        normalizeBreakingNewsItem({
          id: item.id,
          title: item.title,
          priority: item.priority,
          href: `/main/article/${encodeURIComponent(item.id)}`,
        })
      )
      .filter((item): item is BreakingNewsItem => Boolean(item))
  );
}

function readLocalCache() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; items?: unknown };
    const at = Number(parsed.at);
    const items = normalizeList(parsed.items);
    if (!Number.isFinite(at) || !items.length) return null;
    return { at, items };
  } catch {
    return null;
  }
}

function writeLocalCache(items: BreakingNewsItem[]) {
  if (typeof window === 'undefined' || !items.length) return;
  try {
    const payload = JSON.stringify({ at: Date.now(), items });
    window.localStorage.setItem(STORAGE_KEY, payload);
  } catch {
    // Ignore quota/privacy errors.
  }
}

function formatTickerTime(value: string | undefined, language: 'hi' | 'en') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function buildItemHref(item: BreakingNewsItem) {
  const explicit = (item.href || '').trim();
  if (explicit) return explicit;
  return `/main/article/${encodeURIComponent(item.id)}`;
}

function isCacheFresh(timestamp: number) {
  return Date.now() - timestamp < CACHE_TTL_MS;
}

function tinyCategoryLabel(value: string | undefined) {
  const category = (value || '').trim();
  if (!category) return '';
  return category.length > 12 ? `${category.slice(0, 12).trim()}...` : category;
}

function getUiLang(): 'hi' | 'en' | 'unknown' {
  if (typeof window === 'undefined') return 'unknown';

  const normalize = (value: string | null | undefined): 'hi' | 'en' | 'unknown' => {
    const next = (value || '').trim().toLowerCase();
    if (!next) return 'unknown';
    if (next.startsWith('hi')) return 'hi';
    if (next.startsWith('en')) return 'en';
    return 'unknown';
  };

  const htmlLang = normalize(window.document?.documentElement?.lang);
  if (htmlLang !== 'unknown') return htmlLang;

  try {
    const storageLang = normalize(window.localStorage.getItem('lang'));
    if (storageLang !== 'unknown') return storageLang;
  } catch {
    // Ignore storage access errors.
  }

  const navigatorLang = normalize(window.navigator?.language);
  if (navigatorLang !== 'unknown') return navigatorLang;

  return 'unknown';
}

function getTtsLang(text: string): 'hi-IN' | 'en-IN' {
  const uiLang = getUiLang();
  if (uiLang === 'hi') return 'hi-IN';
  if (uiLang === 'en') return 'en-IN';

  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  return hasDevanagari ? 'hi-IN' : 'en-IN';
}

export default function BreakingNews({
  items,
  news,
  speedSeconds = 40,
  pauseOnHover = true,
  showTime = false,
}: BreakingNewsProps) {
  const { language } = useAppStore();
  const [soundOn, setSoundOn] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [sequenceWidth, setSequenceWidth] = useState(0);
  const [repeatCount, setRepeatCount] = useState(2);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchedItems, setFetchedItems] = useState<BreakingNewsItem[]>([]);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const topItemIdRef = useRef<string>('');
  const hasEnabledSoundRef = useRef(false);
  const userActivatedRef = useRef(false);
  const soundOnRef = useRef(false);
  const speechQueueRef = useRef<string[]>([]);
  const speechIndexRef = useRef(0);
  const speechSessionRef = useRef(0);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  const externalProvided = items !== undefined || news !== undefined;
  const externalItems = useMemo(
    () => normalizeList((items && items.length ? items : news) || []),
    [items, news]
  );
  const fallbackItems = useMemo(() => mockFallbackList(), []);

  const resolvedItems = useMemo(() => {
    if (externalProvided) return externalItems;
    if (fetchedItems.length) return fetchedItems;
    return [];
  }, [externalItems, externalProvided, fetchedItems]);

  const clampedSpeedSeconds = useMemo(
    () =>
      Math.max(
        MIN_SPEED_SECONDS,
        Math.min(MAX_SPEED_SECONDS, Number.isFinite(speedSeconds) ? speedSeconds : 40)
      ),
    [speedSeconds]
  );

  const shouldAnimate =
    !prefersReducedMotion &&
    resolvedItems.length > 1 &&
    sequenceWidth > 0 &&
    repeatCount >= 2;

  const buildSpokenHeadline = useCallback((item: BreakingNewsItem | undefined) => {
    if (!item) return '';
    const cityPrefix = item.city ? `${item.city}: ` : '';
    const title = (item.title || '').trim();
    return `${cityPrefix}${title}`.trim();
  }, []);

  const playBeep = useCallback(async () => {
    if (typeof window === 'undefined') return false;

    if (!audioRef.current) {
      const audio = new Audio('/sounds/breaking.mp3');
      audio.preload = 'auto';
      audio.volume = 0.65;
      audioRef.current = audio;
    }

    const audio = audioRef.current;
    try {
      audio.currentTime = 0;
      await audio.play();
      return true;
    } catch (error) {
      console.warn('Ticker sound play failed:', error);
      return false;
    }
  }, []);

  const canUseSpeech = useCallback(() => {
    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof window.SpeechSynthesisUtterance !== 'undefined'
    );
  }, []);

  const cancelSpeechQueue = useCallback(() => {
    speechSessionRef.current += 1;
    speechQueueRef.current = [];
    speechIndexRef.current = 0;

    if (!canUseSpeech()) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // No-op
    }
  }, [canUseSpeech]);

  const pickPreferredVoice = useCallback((targetLang: string) => {
    if (!canUseSpeech()) return null;
    const voices = voicesRef.current.length
      ? voicesRef.current
      : window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    const langLower = targetLang.toLowerCase();
    const baseLang = langLower.split('-')[0];
    const femaleKeywords = [
      'female',
      'woman',
      'zira',
      'susan',
      'hazel',
      'heera',
      'neha',
      'priya',
      'kavya',
      'siri',
    ];
    const maleKeywords = [
      'male',
      'man',
      'david',
      'mark',
      'ravi',
      'george',
      'alex',
      'daniel',
      'james',
    ];

    const ranked = voices
      .map((voice) => {
        const voiceLang = (voice.lang || '').toLowerCase();
        const name = (voice.name || '').toLowerCase();
        let score = 0;

        if (voiceLang === langLower) score += 120;
        else if (voiceLang.startsWith(`${baseLang}-`)) score += 95;
        else if (voiceLang.startsWith(baseLang)) score += 85;

        for (const keyword of femaleKeywords) {
          if (name.includes(keyword)) score += 24;
        }
        for (const keyword of maleKeywords) {
          if (name.includes(keyword)) score -= 32;
        }

        if (name.includes('microsoft')) score += 4;
        if (name.includes('google')) score += 2;
        if (voice.default) score += 1;

        return { voice, score };
      })
      .sort((a, b) => b.score - a.score);

    return ranked[0]?.voice || null;
  }, [canUseSpeech]);

  const speakNextInQueue = useCallback(
    (sessionId: number) => {
      if (!soundOnRef.current || !canUseSpeech()) return;
      if (sessionId !== speechSessionRef.current) return;

      const text = speechQueueRef.current[speechIndexRef.current];
      if (!text) return;

      const synth = window.speechSynthesis;
      const targetLang = getTtsLang(text);

      const utterance = new window.SpeechSynthesisUtterance(text);
      utterance.lang = targetLang;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      const matchedVoice = pickPreferredVoice(targetLang);
      if (matchedVoice) utterance.voice = matchedVoice;

      utterance.onend = () => {
        if (sessionId !== speechSessionRef.current) return;
        speechIndexRef.current += 1;
        speakNextInQueue(sessionId);
      };

      utterance.onerror = () => {
        if (sessionId !== speechSessionRef.current) return;
        speechIndexRef.current += 1;
        speakNextInQueue(sessionId);
      };

      try {
        synth.speak(utterance);
      } catch (error) {
        console.warn('Ticker speech failed:', error);
      }
    },
    [canUseSpeech, pickPreferredVoice]
  );

  const startSpeechQueue = useCallback(
    (itemsToRead: BreakingNewsItem[]) => {
      if (!soundOnRef.current || !userActivatedRef.current || !canUseSpeech()) return;

      const queue = itemsToRead
        .map((item) => buildSpokenHeadline(item))
        .filter((value) => value.length > 0);
      if (!queue.length) return;

      const synth = window.speechSynthesis;
      synth.cancel();

      speechQueueRef.current = queue;
      speechIndexRef.current = 0;
      speechSessionRef.current += 1;
      speakNextInQueue(speechSessionRef.current);
    },
    [buildSpokenHeadline, canUseSpeech, speakNextInQueue]
  );

  const fetchBreakingItems = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const response = await fetch(`/api/breaking?limit=${BREAKING_LIMIT}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as BreakingApiPayload;
      const apiItems = normalizeList(payload.items);
      const nextItems = apiItems.length ? apiItems : fallbackItems;
      setFetchedItems(nextItems);
      memoryCache = { at: Date.now(), items: nextItems };
      writeLocalCache(nextItems);
    } catch (error) {
      console.warn('Failed loading /api/breaking, using fallback:', error);

      const local = readLocalCache();
      const nextItems = local?.items?.length ? local.items : fallbackItems;
      setFetchedItems(nextItems);
      memoryCache = { at: Date.now(), items: nextItems };
    } finally {
      setIsLoading(false);
    }
  }, [fallbackItems]);

  const measureTrack = useCallback(() => {
    const viewport = viewportRef.current;
    const measure = measureRef.current;
    if (!viewport || !measure) return;

    const nextSequenceWidth = Math.ceil(measure.scrollWidth);
    const viewportWidth = Math.ceil(viewport.clientWidth);
    if (!nextSequenceWidth || !viewportWidth) return;

    const minimumRepeats = Math.ceil((viewportWidth * 2) / nextSequenceWidth) + 1;
    setSequenceWidth(nextSequenceWidth);
    setRepeatCount(Math.max(2, minimumRepeats));
  }, []);

  useEffect(() => {
    if (externalProvided) {
      setIsLoading(false);
      return;
    }

    const warmMemory = memoryCache?.items?.length ? memoryCache : null;
    if (warmMemory?.items.length) {
      setFetchedItems(warmMemory.items);
      if (!isCacheFresh(warmMemory.at)) setIsLoading(true);
      void fetchBreakingItems(false);
      return;
    }

    const warmLocal = readLocalCache();
    if (warmLocal?.items.length) {
      setFetchedItems(warmLocal.items);
      memoryCache = warmLocal;
      if (!isCacheFresh(warmLocal.at)) setIsLoading(true);
      void fetchBreakingItems(false);
      return;
    }

    void fetchBreakingItems(true);
  }, [externalProvided, fetchBreakingItems]);

  useEffect(() => {
    if (externalProvided) return;

    const timer = window.setInterval(() => {
      void fetchBreakingItems(false);
    }, 90_000);

    return () => window.clearInterval(timer);
  }, [externalProvided, fetchBreakingItems]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setPrefersReducedMotion(query.matches);

    apply();
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', apply);
      return () => query.removeEventListener('change', apply);
    }

    query.addListener(apply);
    return () => query.removeListener(apply);
  }, []);

  useEffect(() => {
    if (!canUseSpeech()) return;

    const synth = window.speechSynthesis;
    const refreshVoices = () => {
      voicesRef.current = synth.getVoices();
    };

    refreshVoices();

    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', refreshVoices);
      return () => {
        synth.removeEventListener('voiceschanged', refreshVoices);
      };
    }

    const previous = synth.onvoiceschanged;
    synth.onvoiceschanged = refreshVoices;
    return () => {
      synth.onvoiceschanged = previous || null;
    };
  }, [canUseSpeech]);

  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  useEffect(() => {
    measureTrack();
  }, [measureTrack, resolvedItems, showTime, soundOn]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const measure = measureRef.current;
    if (!viewport || !measure || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      measureTrack();
    });

    observer.observe(viewport);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [measureTrack]);

  useEffect(() => {
    const topId = resolvedItems[0]?.id || '';
    if (!topId) {
      topItemIdRef.current = '';
      return;
    }

    if (!topItemIdRef.current) {
      topItemIdRef.current = topId;
      return;
    }

    if (
      soundOn &&
      hasEnabledSoundRef.current &&
      topId !== topItemIdRef.current
    ) {
      void playBeep();
    }

    topItemIdRef.current = topId;
  }, [playBeep, resolvedItems, soundOn]);

  useEffect(() => {
    if (!soundOn || !userActivatedRef.current) return;
    startSpeechQueue(resolvedItems);
  }, [resolvedItems, soundOn, startSpeechQueue]);

  const toggleSound = useCallback(async () => {
    userActivatedRef.current = true;

    if (soundOn) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      cancelSpeechQueue();
      setSoundOn(false);
      return;
    }

    const played = await playBeep();
    if (!played) {
      setSoundOn(false);
      return;
    }

    hasEnabledSoundRef.current = true;
    setSoundOn(true);
  }, [cancelSpeechQueue, playBeep, soundOn]);

  if (!resolvedItems.length && !isLoading) return null;

  const renderSequence = (keyPrefix: string) =>
    resolvedItems.map((item, index) => {
      const cityPrefix = item.city ? `${item.city}: ` : '';
      const timeLabel = showTime ? formatTickerTime(item.createdAt, language) : '';
      const categoryLabel = tinyCategoryLabel(item.category);

      return (
        <span
          key={`${keyPrefix}-${item.id}-${index}`}
          className="inline-flex h-full min-w-0 items-center"
        >
          <Link
            href={buildItemHref(item)}
            className="group inline-flex h-7 min-w-0 items-center gap-1.5 rounded-md px-2 text-sm font-semibold leading-none text-white/95 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90 focus-visible:ring-offset-2 focus-visible:ring-offset-[#8b1218] md:h-8"
          >
            {categoryLabel ? (
              <span className="inline-flex flex-shrink-0 rounded-full border border-white/30 bg-white/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.03em] text-white/85">
                {categoryLabel}
              </span>
            ) : null}
            {timeLabel ? (
              <time className="hidden flex-shrink-0 text-[11px] font-medium text-white/70 sm:inline">
                {timeLabel}
              </time>
            ) : null}
            <span className="whitespace-nowrap">
              {cityPrefix}
              {item.title}
            </span>
          </Link>
          {index < resolvedItems.length - 1 ? (
            <span className="mx-2 select-none text-white/45 leading-none" aria-hidden="true">
              {'\u2022'}
            </span>
          ) : null}
        </span>
      );
    });

  return (
    <div
      className="fixed left-0 right-0 top-0 z-[60] w-full border-b border-red-950/50 bg-gradient-to-r from-[#7f1116] via-[#97131a] to-[#7f1116] shadow-[inset_0_-1px_0_rgba(255,255,255,0.08),inset_0_1px_0_rgba(0,0,0,0.28),0_8px_24px_rgba(0,0,0,0.22)]"
      role="region"
      aria-label={
        language === 'hi'
          ? '\u092c\u094d\u0930\u0947\u0915\u093f\u0902\u0917 \u0928\u094d\u092f\u0942\u091c \u091f\u093f\u0915\u0930'
          : 'Breaking News ticker'
      }
    >
      <Container>
        <div className="flex h-9 items-center gap-2 md:h-11 md:gap-3">
          <div className="flex h-full items-center">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white px-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-red-600 ring-1 ring-white/30 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.15)] md:h-8 md:gap-2 md:px-2.5 md:text-xs">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.22)] md:h-3 md:w-3" />
              LIVE
            </span>
          </div>

          <div
            ref={viewportRef}
            className={`relative min-w-0 flex-1 overflow-hidden ${styles.viewport} ${
              pauseOnHover ? styles.pausable : ''
            }`}
            aria-live="polite"
          >
            {isLoading && !resolvedItems.length ? (
              <div className="flex h-7 items-center md:h-8">
                <div className="h-3.5 w-[62%] animate-pulse rounded-full bg-white/20" />
              </div>
            ) : shouldAnimate ? (
              <div
                className={`${styles.track} ${styles.animate}`}
                style={
                  {
                    '--ticker-duration': `${clampedSpeedSeconds}s`,
                    '--ticker-distance': `${sequenceWidth}px`,
                  } as CSSProperties
                }
              >
                {Array.from({ length: repeatCount }).map((_, repeatIndex) => (
                  <div
                    key={`repeat-${repeatIndex}`}
                    className={styles.sequence}
                    aria-hidden={repeatIndex > 0}
                  >
                    {renderSequence(`repeat-${repeatIndex}`)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex min-w-0 items-center">
                {renderSequence('static').slice(0, 1)}
              </div>
            )}

            <div className={styles.fadeLeft} aria-hidden="true" />
            <div className={styles.fadeRight} aria-hidden="true" />
          </div>

          <button
            type="button"
            onClick={() => {
              void toggleSound();
            }}
            className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/90 backdrop-blur-sm transition hover:border-white/35 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90 focus-visible:ring-offset-2 focus-visible:ring-offset-[#8b1218] md:h-8 md:w-8"
            aria-label={
              soundOn
                ? 'Disable breaking sound and voice'
                : 'Enable breaking sound and voice'
            }
            title={
              soundOn
                ? 'Disable breaking sound and voice'
                : 'Enable breaking sound and voice'
            }
          >
            {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>
        </div>

        <div ref={measureRef} className={styles.measure} aria-hidden="true">
          <div className={styles.sequence}>{renderSequence('measure')}</div>
        </div>
      </Container>
    </div>
  );
}

