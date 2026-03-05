'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Newspaper,
  Share2,
  X,
} from 'lucide-react';
import {
  EPAPER_CITY_OPTIONS,
  type EPaperCitySlug,
} from '@/lib/constants/epaperCities';
import { useAppStore } from '@/lib/store/appStore';
import { renderPdfPagePreviewFromUrl } from '@/lib/utils/pdfThumbnailClient';
import type { EPaperArticleRecord, EPaperRecord } from '@/lib/types/epaper';

export type PublicCursor = {
  publishedAt: string;
  id: string;
};

export type PublicEPaperListItem = {
  _id: string;
  citySlug: string;
  cityName: string;
  title: string;
  publishDate: string;
  thumbnailPath: string;
  pdfPath: string;
  status: 'published';
  pageCount: number;
  pagesWithImage?: number;
  editionDate?: string;
  publishedAt?: string;
};

type LatestListResponse = {
  items?: PublicEPaperListItem[];
  limit?: number;
  hasMore?: boolean;
  nextCursor?: PublicCursor | null;
  error?: string;
};

type DetailResponse = {
  success: boolean;
  error?: string;
  data?: EPaperRecord & { articles: EPaperArticleRecord[] };
};

type EPaperPageClientProps = {
  initialItems: PublicEPaperListItem[];
  initialLimit: number;
  initialHasMore: boolean;
  initialNextCursor: PublicCursor | null;
  initialCity: EPaperCitySlug;
  initialPublishDate: string;
};

const COPY = {
  en: {
    title: 'Interactive E-Paper',
    subtitle: 'Tap on highlighted areas to read mapped stories.',
    publishDate: 'Publish date',
    clearDate: 'Clear',
    city: 'City',
    pages: 'pages',
    noThumbnail: 'No thumbnail',
    noPaper: 'No published e-paper for this city yet.',
    openPdf: 'Open PDF',
    shareWhatsApp: 'Share',
    pageMissingPrefix: 'Page image missing: rendering fallback from PDF for page',
    noPreview: 'No preview available for this page.',
    noArticle: 'No article content available.',
    story: 'Story',
    previous: 'Previous page',
    next: 'Next page',
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',
    close: 'Close viewer',
    storiesOnPage: 'Stories on this page',
    noStories: 'No mapped stories on this page.',
    showingDate: 'Showing date',
  },
  hi: {
    title: '\u0907\u0902\u091f\u0930\u090f\u0915\u094d\u091f\u093f\u0935 \u0908-\u092a\u0947\u092a\u0930',
    subtitle:
      '\u0939\u093e\u0907\u0932\u093e\u0907\u091f \u0915\u093f\u090f \u0917\u090f \u090f\u0930\u093f\u092f\u093e \u092a\u0930 \u091f\u0948\u092a \u0915\u0930\u0915\u0947 \u0938\u094d\u091f\u094b\u0930\u0940 \u092a\u0922\u093c\u0947\u0902\u0964',
    publishDate: 'Publish date',
    clearDate: 'Clear',
    city: '\u0936\u0939\u0930',
    pages: '\u092a\u0947\u091c',
    noThumbnail:
      '\u0925\u0902\u092c\u0928\u0947\u0932 \u0909\u092a\u0932\u092c\u094d\u0927 \u0928\u0939\u0940\u0902',
    noPaper:
      '\u0907\u0938 \u0936\u0939\u0930 \u0915\u0947 \u0932\u093f\u090f \u0905\u092d\u0940 \u0915\u094b\u0908 \u092a\u094d\u0930\u0915\u093e\u0936\u093f\u0924 \u0908-\u092a\u0947\u092a\u0930 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964',
    openPdf: 'PDF \u0916\u094b\u0932\u0947\u0902',
    shareWhatsApp: '\u0936\u0947\u092f\u0930',
    pageMissingPrefix:
      '\u092a\u0947\u091c \u0907\u092e\u0947\u091c \u092e\u093f\u0938\u093f\u0902\u0917 \u0939\u0948: \u092a\u0947\u091c \u0915\u0947 \u0932\u093f\u090f PDF \u092b\u0949\u0932\u092c\u0948\u0915 \u0930\u0947\u0902\u0921\u0930 \u0939\u094b \u0930\u0939\u093e \u0939\u0948',
    noPreview:
      '\u0907\u0938 \u092a\u0947\u091c \u0915\u093e \u092a\u094d\u0930\u0940\u0935\u094d\u092f\u0942 \u0909\u092a\u0932\u092c\u094d\u0927 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964',
    noArticle:
      '\u0907\u0938 \u0938\u094d\u091f\u094b\u0930\u0940 \u0915\u0940 \u0938\u093e\u092e\u0917\u094d\u0930\u0940 \u0909\u092a\u0932\u092c\u094d\u0927 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964',
    story: '\u0938\u094d\u091f\u094b\u0930\u0940',
    previous: 'Previous page',
    next: 'Next page',
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',
    close: 'Close viewer',
    storiesOnPage: 'Stories on this page',
    noStories: 'No mapped stories on this page.',
    showingDate: 'Showing date',
  },
} as const;

const EPAPER_LAST_PAGE_STORAGE_KEY = 'lokswami_epaper_last_page_v1';
const MIN_PREVIEW_ZOOM = 1;
const MAX_PREVIEW_ZOOM = 2.2;
const PREVIEW_ZOOM_STEP = 0.2;

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function clampPage(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function isAbortError(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error && error.name === 'AbortError') return true;
  if (typeof error === 'object' && error !== null && 'name' in error) {
    return (error as { name?: unknown }).name === 'AbortError';
  }
  return false;
}

function buildEpaperPdfProxyUrl(epaperId: string) {
  const id = epaperId.trim();
  if (!id) return '';
  return `/api/public/epapers/${encodeURIComponent(id)}/pdf`;
}

function readSavedPagesFromStorage() {
  if (typeof window === 'undefined') return {} as Record<string, number>;
  try {
    const raw = window.localStorage.getItem(EPAPER_LAST_PAGE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const cleaned: Record<string, number> = {};
    for (const [paperId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!paperId.trim()) continue;
      const page = Number.parseInt(String(value), 10);
      if (Number.isFinite(page) && page > 0) {
        cleaned[paperId] = Math.floor(page);
      }
    }
    return cleaned;
  } catch {
    return {};
  }
}

function getSavedPageForPaper(paperId: string) {
  if (!paperId.trim()) return 0;
  const pages = readSavedPagesFromStorage();
  const saved = pages[paperId];
  return Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : 0;
}

function saveLastPageForPaper(paperId: string, pageNumber: number) {
  if (typeof window === 'undefined') return;
  if (!paperId.trim()) return;
  const safePage = Number.isFinite(pageNumber) && pageNumber > 0 ? Math.floor(pageNumber) : 1;
  try {
    const all = readSavedPagesFromStorage();
    all[paperId] = safePage;
    window.localStorage.setItem(EPAPER_LAST_PAGE_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Ignore localStorage write errors.
  }
}

function mergeUniquePapers(
  current: PublicEPaperListItem[],
  incoming: PublicEPaperListItem[]
) {
  const seen = new Set<string>();
  const merged: PublicEPaperListItem[] = [];

  [...current, ...incoming].forEach((item) => {
    const key = String(item._id || '').trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  });

  return merged;
}

export default function EPaperPageClient({
  initialItems,
  initialLimit,
  initialHasMore,
  initialNextCursor,
  initialCity,
  initialPublishDate,
}: EPaperPageClientProps) {
  const language = useAppStore((state) => state.language);
  const t = COPY[language];
  const [selectedCity, setSelectedCity] = useState<EPaperCitySlug>(initialCity);
  const [selectedPublishDate, setSelectedPublishDate] = useState(initialPublishDate);
  const [epapers, setEpapers] = useState<PublicEPaperListItem[]>(
    Array.isArray(initialItems) ? initialItems : []
  );
  const [loadingList, setLoadingList] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreList, setHasMoreList] = useState(initialHasMore);
  const [nextCursor, setNextCursor] = useState<PublicCursor | null>(initialNextCursor);
  const [listLimit] = useState(
    Number.isFinite(initialLimit) && initialLimit > 0 ? initialLimit : 20
  );
  const [hasInitializedListEffect, setHasInitializedListEffect] = useState(false);
  const [error, setError] = useState('');

  const [activePaper, setActivePaper] = useState<(EPaperRecord & { articles: EPaperArticleRecord[] }) | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [activeArticle, setActiveArticle] = useState<EPaperArticleRecord | null>(null);

  const [pdfFallbackPreview, setPdfFallbackPreview] = useState('');
  const [loadingFallback, setLoadingFallback] = useState(false);
  const [fallbackError, setFallbackError] = useState('');
  const [previewZoom, setPreviewZoom] = useState(1);

  const [pendingPaperId, setPendingPaperId] = useState('');
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreLockRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paper = (params.get('paper') || '').trim();
    const page = Number.parseInt(params.get('page') || '', 10);

    if (paper) {
      setPendingPaperId(paper);
    }

    if (Number.isFinite(page) && page > 0) {
      setActivePage(Math.floor(page));
    }
  }, []);

  useEffect(() => {
    if (!hasInitializedListEffect) {
      setHasInitializedListEffect(true);
      return;
    }

    let cancelled = false;

    const loadFilteredFirstPage = async () => {
      setLoadingList(true);
      setError('');
      try {
        const query = new URLSearchParams({
          citySlug: selectedCity,
          limit: String(listLimit),
        });
        if (selectedPublishDate) {
          query.set('date', selectedPublishDate);
        }

        const response = await fetch(`/api/epapers/latest?${query.toString()}`, {
          cache: 'no-store',
        });
        const payload = (await response.json()) as LatestListResponse;
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load e-papers');
        }
        if (cancelled) return;

        const items = Array.isArray(payload.items) ? payload.items : [];
        setEpapers(items);
        setHasMoreList(Boolean(payload.hasMore));
        setNextCursor(
          payload.nextCursor &&
            typeof payload.nextCursor.publishedAt === 'string' &&
            typeof payload.nextCursor.id === 'string'
            ? payload.nextCursor
            : null
        );
      } catch (err: unknown) {
        if (cancelled || isAbortError(err)) return;
        setError(toErrorMessage(err, 'Failed to load e-papers'));
        setEpapers([]);
        setHasMoreList(false);
        setNextCursor(null);
      } finally {
        if (!cancelled) {
          setLoadingList(false);
        }
      }
    };

    void loadFilteredFirstPage();
    return () => {
      cancelled = true;
    };
  }, [
    selectedCity,
    selectedPublishDate,
    listLimit,
  ]);

  const loadMorePapers = async () => {
    if (loadMoreLockRef.current || isLoadingMore || !hasMoreList) return;

    loadMoreLockRef.current = true;
    setIsLoadingMore(true);
    setError('');
    try {
      const query = new URLSearchParams({
        citySlug: selectedCity,
        limit: String(listLimit),
      });
      if (selectedPublishDate) {
        query.set('date', selectedPublishDate);
      }
      if (nextCursor?.publishedAt && nextCursor.id) {
        query.set('cursorPublishedAt', nextCursor.publishedAt);
        query.set('cursorId', nextCursor.id);
      }

      const response = await fetch(`/api/epapers/latest?${query.toString()}`, {
        cache: 'no-store',
      });
      const payload = (await response.json()) as LatestListResponse;
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load more e-papers');
      }

      const incoming = Array.isArray(payload.items) ? payload.items : [];
      if (incoming.length) {
        setEpapers((current) => mergeUniquePapers(current, incoming));
      }
      setHasMoreList(Boolean(payload.hasMore));
      setNextCursor(
        payload.nextCursor &&
          typeof payload.nextCursor.publishedAt === 'string' &&
          typeof payload.nextCursor.id === 'string'
          ? payload.nextCursor
          : null
      );
    } catch (err: unknown) {
      if (!isAbortError(err)) {
        setError(toErrorMessage(err, 'Failed to load more e-papers'));
      }
    } finally {
      setIsLoadingMore(false);
      loadMoreLockRef.current = false;
    }
  };

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (!firstEntry?.isIntersecting) return;
        if (activePaper) return;
        if (loadMoreLockRef.current || isLoadingMore || !hasMoreList) return;
        void loadMorePapers();
      },
      {
        root: null,
        rootMargin: '320px 0px',
        threshold: 0.01,
      }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [activePaper, hasMoreList, isLoadingMore, loadMorePapers]);

  const openPaper = async (paperId: string, initialPage?: number) => {
    setError('');
    try {
      const response = await fetch(`/api/epapers/${paperId}`);
      const payload = (await response.json()) as DetailResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || 'Failed to open e-paper');
      }

      const explicitInitialPage =
        Number.isFinite(initialPage) && Number(initialPage) > 0 ? Math.floor(Number(initialPage)) : 0;
      const savedPage = explicitInitialPage ? 0 : getSavedPageForPaper(paperId);
      const pageToOpen = explicitInitialPage || savedPage || 1;

      setActivePaper(payload.data);
      setActivePage(
        clampPage(pageToOpen, 1, Math.max(1, Number(payload.data.pageCount || 1)))
      );
      setActiveArticle(null);
      setPreviewZoom(1);
      setPdfFallbackPreview('');
      setFallbackError('');
    } catch (err: unknown) {
      setError(toErrorMessage(err, 'Failed to open e-paper'));
    }
  };

  useEffect(() => {
    if (!pendingPaperId) return;
    if (loadingList) return;
    const exists = epapers.some((item) => item._id === pendingPaperId);
    if (exists) {
      void openPaper(pendingPaperId, activePage);
      setPendingPaperId('');
      return;
    }

    void openPaper(pendingPaperId, activePage);
    setPendingPaperId('');
  }, [pendingPaperId, epapers, loadingList, activePage]);

  useEffect(() => {
    if (!activePaper) return;
    const maxPages = Math.max(1, Number(activePaper.pageCount || 1));
    saveLastPageForPaper(activePaper._id, clampPage(activePage, 1, maxPages));
  }, [activePaper, activePage]);

  const activePageImage = useMemo(() => {
    if (!activePaper) return '';
    const page = activePaper.pages.find((item) => item.pageNumber === activePage);
    return String(page?.imagePath || '');
  }, [activePaper, activePage]);

  const pageArticles = useMemo(() => {
    if (!activePaper) return [];
    return activePaper.articles.filter((item) => item.pageNumber === activePage);
  }, [activePaper, activePage]);

  const activePageMeta = useMemo(() => {
    if (!activePaper) return null;
    return activePaper.pages.find((item) => item.pageNumber === activePage) || null;
  }, [activePaper, activePage]);
  const previewSrc = activePageImage || pdfFallbackPreview;
  const previewIsDataUrl = previewSrc.startsWith('data:');
  const previewWidth = activePageMeta?.width || 1200;
  const previewHeight = activePageMeta?.height || 1600;
  const pdfProxyUrl = useMemo(() => {
    if (!activePaper) return '';
    return buildEpaperPdfProxyUrl(String(activePaper._id || ''));
  }, [activePaper]);
  const pdfUrlForOpen = pdfProxyUrl;

  useEffect(() => {
    let cancelled = false;
    const loadFallback = async () => {
      if (!activePaper) return;
      if (activePageImage) {
        setPdfFallbackPreview('');
        setFallbackError('');
        setLoadingFallback(false);
        return;
      }

      setLoadingFallback(true);
      setFallbackError('');
      try {
        if (!pdfProxyUrl) {
          throw new Error('PDF URL is missing');
        }
        const rendered = await renderPdfPagePreviewFromUrl(pdfProxyUrl, {
          page: activePage,
          targetWidth: 1600,
        });
        if (cancelled) return;
        setPdfFallbackPreview(rendered.dataUrl);
      } catch (err: unknown) {
        if (cancelled) return;
        setPdfFallbackPreview('');
        setFallbackError(toErrorMessage(err, 'Failed to render PDF page'));
      } finally {
        if (!cancelled) setLoadingFallback(false);
      }
    };

    void loadFallback();
    return () => {
      cancelled = true;
    };
  }, [activePaper, activePage, activePageImage, pdfProxyUrl]);

  useEffect(() => {
    if (!activePaper) return;

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActivePaper(null);
        setActiveArticle(null);
        return;
      }

      if (event.key === 'ArrowLeft') {
        setActivePage((current) => clampPage(current - 1, 1, Math.max(1, activePaper.pageCount)));
      }

      if (event.key === 'ArrowRight') {
        setActivePage((current) => clampPage(current + 1, 1, Math.max(1, activePaper.pageCount)));
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeydown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [activePaper]);

  const openPdfInNewTab = () => {
    if (!pdfUrlForOpen) return;
    const opened = window.open(pdfUrlForOpen, '_blank', 'noopener,noreferrer');
    if (!opened) {
      window.location.href = pdfUrlForOpen;
    }
  };

  const shareActivePaperOnWhatsApp = async () => {
    if (!activePaper) return;

    const params = new URLSearchParams({
      paper: activePaper._id,
      city: activePaper.citySlug,
      page: String(activePage),
    });
    if (activePaper.publishDate) {
      params.set('date', activePaper.publishDate);
    }

    const shareUrl = `${window.location.origin}/main/epaper?${params.toString()}`;
    const shareText = `${activePaper.title}\n${shareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: activePaper.title,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (error: unknown) {
        if (isAbortError(error)) return;
      }
    }

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    const opened = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    if (!opened) {
      window.location.href = whatsappUrl;
    }
  };

  return (
    <div className="relative pb-2 md:pb-4">
      <div className="pointer-events-none absolute -top-10 right-3 h-44 w-44 rounded-full bg-orange-200/30 blur-3xl dark:bg-orange-900/12 sm:-top-12 sm:right-6 sm:h-56 sm:w-56" />
      <div className="pointer-events-none absolute top-[24rem] -left-12 h-52 w-52 rounded-full bg-cyan-200/28 blur-3xl dark:bg-cyan-900/12 sm:top-[27rem] sm:h-64 sm:w-64" />

      <section className="cnp-surface p-3.5 sm:p-4 md:p-5">
        <div className="mb-4 grid grid-cols-1 gap-3 border-b border-zinc-200/80 pb-3 dark:border-zinc-800 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0 hidden sm:block">
            <h1 className="text-lg font-extrabold tracking-tight text-gray-900 dark:text-zinc-100 sm:text-2xl">{t.title}</h1>
            <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-zinc-400 sm:text-sm">{t.subtitle}</p>
          </div>

          <div className="w-full justify-self-start sm:w-auto sm:justify-self-end">
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-white/80 p-2 dark:border-zinc-800 dark:bg-zinc-900/70 sm:hidden">
              <div className="relative min-w-0 flex-1">
                <input
                  type="date"
                  value={selectedPublishDate}
                  onChange={(event) => setSelectedPublishDate(event.target.value)}
                  aria-label={t.publishDate}
                  className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2.5 pr-8 text-xs outline-none focus:border-primary-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-primary-400"
                />
                {selectedPublishDate ? (
                  <button
                    type="button"
                    onClick={() => setSelectedPublishDate('')}
                    aria-label={t.clearDate}
                    className="absolute inset-y-0 right-1 inline-flex w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              <select
                value={selectedCity}
                onChange={(event) => setSelectedCity(event.target.value as EPaperCitySlug)}
                aria-label={t.city}
                className="h-9 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2.5 text-sm outline-none focus:border-primary-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-primary-400"
              >
                {EPAPER_CITY_OPTIONS.map((city) => (
                  <option key={city.slug} value={city.slug}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="hidden w-full flex-wrap items-center gap-2.5 sm:flex sm:w-auto sm:justify-end">
              <label className="flex w-full flex-col gap-1 text-sm font-medium text-gray-700 dark:text-zinc-300 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 sm:text-sm sm:normal-case sm:tracking-normal">
                  {t.publishDate}
                </span>
                <input
                  type="date"
                  value={selectedPublishDate}
                  onChange={(event) => setSelectedPublishDate(event.target.value)}
                  className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-primary-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-primary-400 sm:w-[170px] sm:min-w-[170px]"
                />
              </label>

              {selectedPublishDate ? (
                <button
                  type="button"
                  onClick={() => setSelectedPublishDate('')}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-300 px-2.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {t.clearDate}
                </button>
              ) : null}

              <label className="flex w-full flex-col gap-1 text-sm font-medium text-gray-700 dark:text-zinc-300 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 sm:text-sm sm:normal-case sm:tracking-normal">
                  {t.city}
                </span>
                <select
                  value={selectedCity}
                  onChange={(event) => setSelectedCity(event.target.value as EPaperCitySlug)}
                  className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-primary-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-primary-400 sm:w-[168px] sm:min-w-[168px]"
                >
                  {EPAPER_CITY_OPTIONS.map((city) => (
                    <option key={city.slug} value={city.slug}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {selectedPublishDate ? (
          <div className="mb-3">
            <span className="inline-flex items-center rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-300">
              {t.showingDate}: {formatDateLabel(selectedPublishDate)}
            </span>
          </div>
        ) : null}

        {loadingList ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-primary-600" />
          </div>
        ) : epapers.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white px-5 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900 sm:py-12">
            <Newspaper className="mx-auto h-10 w-10 text-gray-400 dark:text-zinc-500" />
            <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">{t.noPaper}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
              {epapers.map((paper) => (
                <button
                  key={paper._id}
                  type="button"
                  onClick={() => void openPaper(paper._id)}
                  className="cnp-card cnp-card-hover min-w-0 overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/70 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                >
                  <div className="aspect-[3/4] overflow-hidden bg-gray-100 dark:bg-zinc-800 sm:aspect-[4/5]">
                    {paper.thumbnailPath ? (
                      <div className="relative h-full w-full">
                        <Image
                          src={paper.thumbnailPath}
                          alt={paper.title}
                          fill
                          unoptimized
                          className="object-cover"
                          sizes="(max-width: 767px) 50vw, (max-width: 1279px) 33vw, 25vw"
                        />
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-zinc-400">
                        {t.noThumbnail}
                      </div>
                    )}
                  </div>
                  <div className="p-2.5 sm:p-3">
                    <h2 className="line-clamp-2 text-xs font-semibold text-gray-900 dark:text-zinc-100 sm:text-sm">{paper.title}</h2>
                    <p className="mt-1 line-clamp-2 text-[11px] text-gray-600 dark:text-zinc-400 sm:text-xs">
                      {paper.cityName} | {formatDateLabel(paper.publishDate)} | {paper.pageCount} {t.pages}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {hasMoreList ? (
              <div className="text-center">
                <div ref={loadMoreSentinelRef} className="h-px w-full" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => {
                    void loadMorePapers();
                  }}
                  disabled={isLoadingMore}
                  className="rounded-full border border-zinc-300 bg-white px-8 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-red-700/70 dark:hover:bg-zinc-800 dark:hover:text-red-300"
                >
                  {isLoadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            ) : (
              <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">No more posts</p>
            )}
          </div>
        )}
      </section>

      {activePaper ? (
        <div className="fixed inset-0 z-[95] bg-black/75 p-0 backdrop-blur-[1.5px] sm:p-4">
          <div className="mx-auto flex h-full w-full max-w-[1180px] flex-col overflow-hidden border border-gray-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 sm:h-[calc(100dvh-2rem)] sm:rounded-2xl">
            <div className="border-b border-gray-200 bg-white/95 px-3 py-2.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95 sm:px-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-zinc-100">{activePaper.title}</p>
                  <p className="truncate text-xs text-gray-600 dark:text-zinc-400">
                    {activePaper.cityName} | {formatDateLabel(activePaper.publishDate)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setActivePage((current) =>
                        clampPage(current - 1, 1, Math.max(1, activePaper.pageCount))
                      )
                    }
                    aria-label={t.previous}
                    disabled={activePage <= 1}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <span className="min-w-[72px] rounded-md border border-gray-200 px-2 py-1 text-center text-xs font-semibold text-gray-700 dark:border-zinc-700 dark:text-zinc-300">
                    {activePage} / {activePaper.pageCount}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setActivePage((current) =>
                        clampPage(current + 1, 1, Math.max(1, activePaper.pageCount))
                      )
                    }
                    aria-label={t.next}
                    disabled={activePage >= activePaper.pageCount}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  <div className="hidden items-center gap-1 rounded-md border border-gray-300 px-1 py-0.5 md:flex dark:border-zinc-700">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewZoom((current) =>
                          Math.max(MIN_PREVIEW_ZOOM, Number((current - PREVIEW_ZOOM_STEP).toFixed(2)))
                        )
                      }
                      aria-label={t.zoomOut}
                      disabled={previewZoom <= MIN_PREVIEW_ZOOM}
                      className="inline-flex h-6 w-6 items-center justify-center rounded text-sm font-bold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      -
                    </button>
                    <span className="min-w-[48px] text-center text-[11px] font-semibold text-gray-700 dark:text-zinc-300">
                      {Math.round(previewZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewZoom((current) =>
                          Math.min(MAX_PREVIEW_ZOOM, Number((current + PREVIEW_ZOOM_STEP).toFixed(2)))
                        )
                      }
                      aria-label={t.zoomIn}
                      disabled={previewZoom >= MAX_PREVIEW_ZOOM}
                      className="inline-flex h-6 w-6 items-center justify-center rounded text-sm font-bold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={openPdfInNewTab}
                    disabled={!pdfUrlForOpen}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-primary-200 bg-primary-50 px-2.5 text-xs font-semibold text-primary-700 transition hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-300 dark:hover:bg-primary-900/40"
                  >
                    <span className="hidden sm:inline">{t.openPdf}</span>
                    <span className="sm:hidden">PDF</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void shareActivePaperOnWhatsApp();
                    }}
                    aria-label={t.shareWhatsApp}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span>{t.shareWhatsApp}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActivePaper(null);
                      setActiveArticle(null);
                    }}
                    aria-label={t.close}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-700 transition hover:bg-gray-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {!activePageImage ? (
              <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700 sm:px-4 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                {t.pageMissingPrefix} {activePage}.
              </div>
            ) : null}

            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="relative overflow-auto overscroll-contain bg-gradient-to-b from-zinc-100 via-white to-zinc-100 p-2 [-webkit-overflow-scrolling:touch] sm:p-3 md:p-4 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
                {loadingFallback ? (
                  <div className="flex h-full min-h-48 items-center justify-center">
                    <Loader2 className="h-7 w-7 animate-spin text-primary-600" />
                  </div>
                ) : fallbackError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                    {fallbackError}
                  </div>
                ) : activePageImage || pdfFallbackPreview ? (
                  <div className="mx-auto flex min-h-full w-full max-w-[980px] items-start justify-center">
                    <div className="w-fit rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="relative mx-auto w-fit">
                        {previewIsDataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={previewSrc}
                            alt={`Page ${activePage}`}
                            style={{
                              maxHeight: `calc((100dvh - 210px) * ${previewZoom})`,
                            }}
                            className="block h-auto w-auto object-contain"
                          />
                        ) : (
                          <Image
                            src={previewSrc}
                            alt={`Page ${activePage}`}
                            width={previewWidth}
                            height={previewHeight}
                            unoptimized
                            style={{
                              maxHeight: `calc((100dvh - 210px) * ${previewZoom})`,
                            }}
                            className="block h-auto w-auto object-contain"
                          />
                        )}

                        {pageArticles.map((article, index) => (
                          <button
                            key={article._id}
                            type="button"
                            onClick={() => setActiveArticle(article)}
                            className="absolute rounded-[2px] border border-primary-700 bg-primary-500/20 transition hover:bg-primary-500/30"
                            style={{
                              left: `${article.hotspot.x * 100}%`,
                              top: `${article.hotspot.y * 100}%`,
                              width: `${article.hotspot.w * 100}%`,
                              height: `${article.hotspot.h * 100}%`,
                            }}
                            title={article.title || `${t.story} ${index + 1}`}
                          >
                            <span className="sr-only">{article.title || `${t.story} ${index + 1}`}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                    {t.noPreview}
                  </div>
                )}

                <div className="mt-3 rounded-lg border border-gray-200 bg-white/90 p-3 dark:border-zinc-800 dark:bg-zinc-900/75 lg:hidden">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {t.storiesOnPage}
                    </p>
                    <p className="text-xs font-medium text-gray-700 dark:text-zinc-300">
                      {activePage} / {activePaper.pageCount}
                    </p>
                  </div>

                  {pageArticles.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-600 dark:border-zinc-700 dark:text-zinc-400">
                      {t.noStories}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {pageArticles.map((article, index) => (
                        <button
                          key={`${article._id}-mobile`}
                          type="button"
                          onClick={() => setActiveArticle(article)}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left transition hover:border-primary-300 hover:bg-primary-50/70 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/25"
                        >
                          <span className="block text-[11px] font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
                            {t.story} {index + 1}
                          </span>
                          <span className="mt-1 block text-sm font-medium text-gray-900 dark:text-zinc-100">
                            {article.title || `${t.story} ${index + 1}`}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <aside className="hidden min-h-0 border-l border-gray-200 bg-gray-50/80 dark:border-zinc-800 dark:bg-zinc-900/70 lg:flex lg:flex-col">
                <div className="border-b border-gray-200 px-3 py-3 dark:border-zinc-800">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {t.storiesOnPage}
                  </p>
                  <p className="mt-1 text-xs font-medium text-gray-700 dark:text-zinc-300">
                    {activePage} / {activePaper.pageCount}
                  </p>
                </div>

                <div className="flex-1 overflow-auto p-3">
                  {pageArticles.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-600 dark:border-zinc-700 dark:text-zinc-400">
                      {t.noStories}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {pageArticles.map((article, index) => (
                        <button
                          key={`${article._id}-side`}
                          type="button"
                          onClick={() => setActiveArticle(article)}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left transition hover:border-primary-300 hover:bg-primary-50/70 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/25"
                        >
                          <span className="block text-[11px] font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
                            {t.story} {index + 1}
                          </span>
                          <span className="mt-1 block text-sm font-medium text-gray-900 dark:text-zinc-100">
                            {article.title || `${t.story} ${index + 1}`}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </div>
        </div>
      ) : null}

      {activeArticle ? (
        <div className="fixed inset-0 z-[100] bg-black/45 p-3">
          <div className="mx-auto max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 shadow-xl sm:p-4 md:p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h3 className="text-xl font-bold text-gray-900 dark:text-zinc-100">{activeArticle.title}</h3>
              <button
                type="button"
                onClick={() => setActiveArticle(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {activeArticle.coverImagePath ? (
              <div className="mb-3 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-950">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeArticle.coverImagePath}
                  alt={activeArticle.title}
                  className="h-auto max-h-80 w-full object-cover"
                />
              </div>
            ) : null}

            {activeArticle.excerpt ? (
              <p className="mb-3 text-sm font-medium text-gray-700 dark:text-zinc-300">{activeArticle.excerpt}</p>
            ) : null}

            {activeArticle.contentHtml ? (
              <article
                className="prose prose-sm max-w-none text-gray-800 dark:prose-invert dark:text-zinc-200"
                dangerouslySetInnerHTML={{ __html: activeArticle.contentHtml }}
              />
            ) : (
              <p className="text-sm text-gray-600 dark:text-zinc-400">{t.noArticle}</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

