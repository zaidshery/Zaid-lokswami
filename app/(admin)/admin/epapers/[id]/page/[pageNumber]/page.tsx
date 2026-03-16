'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ArrowLeft, Loader2, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import { getAuthHeader } from '@/lib/auth/clientToken';
import type { EPaperArticleRecord, EPaperRecord } from '@/lib/types/epaper';
import { detectHotspotsFromImageClient } from '@/lib/utils/epaperHotspotDetectionClient';

type EpaperResponse = {
  success: boolean;
  error?: string;
  data?: EPaperRecord;
};

type ArticlesResponse = {
  success: boolean;
  error?: string;
  data?: EPaperArticleRecord[];
};

type DrawPoint = { x: number; y: number };
type Hotspot = { x: number; y: number; w: number; h: number };
type HotspotSuggestion = {
  title: string;
  excerpt: string;
  contentHtml: string;
  hotspot: Hotspot;
};

type DraftArticleInput = {
  title: string;
  excerpt: string;
  contentHtml: string;
  coverImagePath: string;
};

type DetectHotspotCandidate = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  w?: number;
  h?: number;
  title?: string;
  text?: string;
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function toFixedHotspot(hotspot: Hotspot): Hotspot {
  return {
    x: Number(clamp01(hotspot.x).toFixed(6)),
    y: Number(clamp01(hotspot.y).toFixed(6)),
    w: Number(Math.max(0.0001, Math.min(1 - hotspot.x, hotspot.w)).toFixed(6)),
    h: Number(Math.max(0.0001, Math.min(1 - hotspot.y, hotspot.h)).toFixed(6)),
  };
}

function normalizeHotspotFromPoints(start: DrawPoint, end: DrawPoint): Hotspot {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const right = Math.max(start.x, end.x);
  const bottom = Math.max(start.y, end.y);

  return toFixedHotspot({
    x: left,
    y: top,
    w: right - left,
    h: bottom - top,
  });
}

function hotspotStyle(hotspot: Hotspot) {
  return {
    left: `${hotspot.x * 100}%`,
    top: `${hotspot.y * 100}%`,
    width: `${hotspot.w * 100}%`,
    height: `${hotspot.h * 100}%`,
  };
}

function parsePageNumber(raw: string | string[] | undefined) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

function buildDraftInput(): DraftArticleInput {
  return {
    title: '',
    excerpt: '',
    contentHtml: '',
    coverImagePath: '',
  };
}

function toHtmlParagraph(text: string) {
  if (!text.trim()) return '';
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  return `<p>${escaped.replace(/\n/g, '<br/>')}</p>`;
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export default function EPaperPageHotspotEditor() {
  const params = useParams();
  const epaperId = String(params.id || '');
  const pageNumber = parsePageNumber(params.pageNumber);

  const previewRef = useRef<HTMLDivElement | null>(null);

  const [epaper, setEpaper] = useState<EPaperRecord | null>(null);
  const [articles, setArticles] = useState<EPaperArticleRecord[]>([]);
  const [draftInput, setDraftInput] = useState<DraftArticleInput>(buildDraftInput);
  const [draftHotspot, setDraftHotspot] = useState<Hotspot | null>(null);
  const [drawStart, setDrawStart] = useState<DrawPoint | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<DrawPoint | null>(null);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [autoDetecting, setAutoDetecting] = useState(false);
  const [creatingSuggestions, setCreatingSuggestions] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [suggestions, setSuggestions] = useState<HotspotSuggestion[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const pageImageMeta = useMemo(() => {
    if (!epaper) return null;
    return epaper.pages.find((item) => item.pageNumber === pageNumber) || null;
  }, [epaper, pageNumber]);
  const pageImagePath = String(pageImageMeta?.imagePath || '');
  const pageImageWidth = pageImageMeta?.width || 1200;
  const pageImageHeight = pageImageMeta?.height || 1600;
  const readableArticleCount = useMemo(
    () =>
      articles.filter((article) => {
        return Boolean(String(article.contentHtml || '').trim() || String(article.excerpt || '').trim());
      }).length,
    [articles]
  );
  const unreadableArticleCount = Math.max(0, articles.length - readableArticleCount);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [epaperRes, articlesRes] = await Promise.all([
        fetch(`/api/admin/epapers/${epaperId}`, {
          headers: { ...getAuthHeader() },
        }),
        fetch(`/api/admin/epapers/${epaperId}/articles?pageNumber=${pageNumber}`, {
          headers: { ...getAuthHeader() },
        }),
      ]);

      const epaperPayload = (await epaperRes.json()) as EpaperResponse;
      const articlesPayload = (await articlesRes.json()) as ArticlesResponse;

      if (!epaperRes.ok || !epaperPayload.success || !epaperPayload.data) {
        throw new Error(epaperPayload.error || 'Failed to load e-paper');
      }

      setEpaper(epaperPayload.data);
      setArticles(Array.isArray(articlesPayload.data) ? articlesPayload.data : []);
    } catch (err: unknown) {
      setError(toErrorMessage(err, 'Failed to load page editor data'));
      setEpaper(null);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [epaperId, pageNumber]);

  useEffect(() => {
    if (!epaperId) return;
    setSuggestions([]);
    setDraftHotspot(null);
    void fetchData();
  }, [epaperId, fetchData]);

  const toNormalizedPoint = (event: ReactPointerEvent<HTMLDivElement>): DrawPoint | null => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: clamp01((event.clientX - rect.left) / rect.width),
      y: clamp01((event.clientY - rect.top) / rect.height),
    };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pageImagePath) return;
    if ((event.target as HTMLElement).closest('[data-hotspot-id]')) return;

    const point = toNormalizedPoint(event);
    if (!point) return;

    setDrawStart(point);
    setDrawCurrent(point);
    setDraftHotspot(null);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawStart) return;
    const point = toNormalizedPoint(event);
    if (!point) return;
    setDrawCurrent(point);
  };

  const finishDraw = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawStart) return;
    const point = toNormalizedPoint(event) || drawCurrent || drawStart;
    const next = normalizeHotspotFromPoints(drawStart, point);

    setDrawStart(null);
    setDrawCurrent(null);

    if (next.w < 0.01 || next.h < 0.01) {
      return;
    }
    setDraftHotspot(next);
  };

  const createArticleRequest = async (payload: {
    title: string;
    excerpt?: string;
    contentHtml?: string;
    coverImagePath?: string;
    hotspot: Hotspot;
  }) => {
    const response = await fetch(`/api/admin/epapers/${epaperId}/articles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({
        pageNumber,
        title: payload.title.trim(),
        excerpt: payload.excerpt || '',
        contentHtml: payload.contentHtml || '',
        coverImagePath: (payload.coverImagePath || '').trim(),
        hotspot: toFixedHotspot(payload.hotspot),
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body?.error || 'Failed to create article');
    }
    return body;
  };

  const createArticle = async () => {
    if (!draftHotspot) {
      setError('Draw a hotspot first');
      return;
    }
    if (!draftInput.title.trim()) {
      setError('Article title is required');
      return;
    }

    setCreating(true);
    setError('');
    setNotice('');

    try {
      await createArticleRequest({
        title: draftInput.title.trim(),
        excerpt: draftInput.excerpt,
        contentHtml: draftInput.contentHtml,
        coverImagePath: draftInput.coverImagePath,
        hotspot: draftHotspot,
      });

      setNotice('Article created');
      setDraftInput(buildDraftInput());
      setDraftHotspot(null);
      await fetchData();
    } catch (err: unknown) {
      setError(toErrorMessage(err, 'Failed to create article'));
    } finally {
      setCreating(false);
    }
  };

  const runAutoDetect = async () => {
    if (!pageImagePath) {
      setError('Page image is required for auto-detection');
      return;
    }

    setAutoDetecting(true);
    setError('');
    setNotice('');

    try {
      const detection = await detectHotspotsFromImageClient({
        thumbnail: pageImagePath,
        authHeaders: getAuthHeader(),
        maxPages: 1,
        localLanguage: 'hin+eng',
      });

      const mapped: HotspotSuggestion[] = detection.hotspots.map((hotspot, index) => {
        const candidate = hotspot as unknown as DetectHotspotCandidate;
        const xRaw = Number(candidate.x);
        const yRaw = Number(candidate.y);
        const wRaw = Number(candidate.width ?? candidate.w ?? 0);
        const hRaw = Number(candidate.height ?? candidate.h ?? 0);
        const x = xRaw > 1 ? xRaw / 100 : xRaw;
        const y = yRaw > 1 ? yRaw / 100 : yRaw;
        const w = wRaw > 1 ? wRaw / 100 : wRaw;
        const h = hRaw > 1 ? hRaw / 100 : hRaw;
        const safeTitle = String(candidate.title || '').trim() || `Story ${index + 1}`;
        const sourceText = String(candidate.text || '').trim();

        return {
          title: safeTitle,
          excerpt: sourceText.slice(0, 240),
          contentHtml: sourceText ? toHtmlParagraph(sourceText) : '',
          hotspot: toFixedHotspot({
            x: Number.isFinite(x) ? x : 0,
            y: Number.isFinite(y) ? y : 0,
            w: Number.isFinite(w) ? w : 0.1,
            h: Number.isFinite(h) ? h : 0.1,
          }),
        };
      });

      setSuggestions(mapped);
      if (mapped[0]) {
        setDraftHotspot(mapped[0].hotspot);
        setDraftInput({
          title: mapped[0].title,
          excerpt: mapped[0].excerpt,
          contentHtml: mapped[0].contentHtml,
          coverImagePath: '',
        });
      }
      const engineLabel = detection.engine === 'local' ? 'local free OCR' : 'server OCR fallback';
      setNotice(
        mapped.length > 0
          ? `Detected ${mapped.length} hotspot suggestions using ${engineLabel}.`
          : `No hotspot suggestions found using ${engineLabel}.`
      );
    } catch (err: unknown) {
      setSuggestions([]);
      setError(toErrorMessage(err, 'Failed to auto-detect hotspots'));
    } finally {
      setAutoDetecting(false);
    }
  };

  const createAllSuggestions = async () => {
    if (suggestions.length === 0) {
      setError('No suggestions to create');
      return;
    }

    setCreatingSuggestions(true);
    setError('');
    setNotice('');

    let successCount = 0;
    const failures: string[] = [];
    for (let index = 0; index < suggestions.length; index += 1) {
      const suggestion = suggestions[index];
      try {
        await createArticleRequest({
          title: suggestion.title,
          excerpt: suggestion.excerpt,
          contentHtml: suggestion.contentHtml,
          hotspot: suggestion.hotspot,
        });
        successCount += 1;
      } catch (err: unknown) {
        failures.push(toErrorMessage(err, `Suggestion ${index + 1} failed`));
      }
    }

    if (successCount > 0) {
      setNotice(`Created ${successCount} article(s) from suggestions.`);
      setSuggestions([]);
      setDraftHotspot(null);
      await fetchData();
    }
    if (failures.length > 0) {
      setError(failures.slice(0, 2).join(' | '));
    }

    setCreatingSuggestions(false);
  };

  const updateArticleField = (
    articleId: string,
    key: keyof EPaperArticleRecord | 'hotspot.x' | 'hotspot.y' | 'hotspot.w' | 'hotspot.h',
    value: string
  ) => {
    setArticles((current) =>
      current.map((article) => {
        if (article._id !== articleId) return article;
        if (key === 'hotspot.x' || key === 'hotspot.y' || key === 'hotspot.w' || key === 'hotspot.h') {
          const parsed = Number.parseFloat(value);
          const numeric = Number.isFinite(parsed) ? parsed : 0;
          const hotspot = { ...article.hotspot };
          if (key === 'hotspot.x') hotspot.x = numeric;
          if (key === 'hotspot.y') hotspot.y = numeric;
          if (key === 'hotspot.w') hotspot.w = numeric;
          if (key === 'hotspot.h') hotspot.h = numeric;
          return { ...article, hotspot: toFixedHotspot(hotspot) };
        }

        return {
          ...article,
          [key]: value,
        };
      })
    );
  };

  const saveArticle = async (article: EPaperArticleRecord) => {
    setSavingId(article._id);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`/api/admin/articles/${article._id}?kind=epaper`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          title: article.title.trim(),
          excerpt: article.excerpt || '',
          contentHtml: article.contentHtml || '',
          coverImagePath: article.coverImagePath || '',
          pageNumber,
          hotspot: toFixedHotspot(article.hotspot),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to update article');
      }

      setNotice('Article updated');
      await fetchData();
    } catch (err: unknown) {
      setError(toErrorMessage(err, 'Failed to update article'));
    } finally {
      setSavingId('');
    }
  };

  const deleteArticle = async (articleId: string) => {
    setDeletingId(articleId);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/admin/articles/${articleId}?kind=epaper`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeader(),
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to delete article');
      }
      setNotice('Article deleted');
      setArticles((current) => current.filter((item) => item._id !== articleId));
    } catch (err: unknown) {
      setError(toErrorMessage(err, 'Failed to delete article'));
    } finally {
      setDeletingId('');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-7 w-7 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!epaper) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <Link
          href="/admin/epapers"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to E-Papers
        </Link>
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || 'E-paper not found'}
        </div>
      </div>
    );
  }

  if (!pageImagePath) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <Link
          href={`/admin/epapers/${epaperId}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to E-Paper
        </Link>
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Page {pageNumber} does not have an image yet. Upload the page image first.
        </div>
      </div>
    );
  }

  const draftPreview =
    drawStart && drawCurrent ? normalizeHotspotFromPoints(drawStart, drawCurrent) : null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/admin/epapers/${epaperId}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to E-Paper
        </Link>
        <p className="text-sm text-gray-700">
          {epaper.title} | Page {pageNumber}
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Mapped stories</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{articles.length}</p>
          <p className="mt-1 text-xs text-gray-600">Hotspots already created on this page.</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Readable text</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{readableArticleCount}</p>
          <p className="mt-1 text-xs text-gray-600">Stories with full text or excerpt ready.</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Needs OCR review</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{unreadableArticleCount}</p>
          <p className="mt-1 text-xs text-gray-600">Mapped stories still missing readable text.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <p className="mb-2 text-xs font-semibold text-gray-600">
            Draw hotspot rectangles directly on the page image.
          </p>
          <div
            ref={previewRef}
            className="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={finishDraw}
            onPointerCancel={() => {
              setDrawStart(null);
              setDrawCurrent(null);
            }}
          >
            <Image
              src={pageImagePath}
              alt={`Page ${pageNumber}`}
              width={pageImageWidth}
              height={pageImageHeight}
              unoptimized
              className="block h-auto w-full object-contain"
              draggable={false}
            />

            {articles.map((article, index) => (
              <div
                key={article._id}
                data-hotspot-id={article._id}
                className="absolute border-2 border-primary-600 bg-primary-500/15"
                style={hotspotStyle(article.hotspot)}
                title={article.title || `Article ${index + 1}`}
              >
                <span className="absolute -left-px -top-5 rounded-sm bg-primary-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {index + 1}
                </span>
              </div>
            ))}

            {suggestions.map((suggestion, index) => (
              <div
                key={`suggestion-${index + 1}`}
                className="pointer-events-none absolute border-2 border-amber-500 border-dashed bg-amber-500/20"
                style={hotspotStyle(suggestion.hotspot)}
                title={suggestion.title || `Suggestion ${index + 1}`}
              >
                <span className="absolute -left-px -top-5 rounded-sm bg-amber-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  S{index + 1}
                </span>
              </div>
            ))}

            {draftPreview ? (
              <div
                className="pointer-events-none absolute border-2 border-emerald-600 bg-emerald-500/20"
                style={hotspotStyle(draftPreview)}
              />
            ) : null}

            {draftHotspot ? (
              <div
                className="pointer-events-none absolute border-2 border-amber-600 bg-amber-500/20"
                style={hotspotStyle(draftHotspot)}
              />
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Create Article From Drawn Hotspot</h2>
            <p className="mt-1 text-xs text-gray-600">
              Draw on image first. The amber box will be used for new article.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void runAutoDetect()}
                disabled={autoDetecting || creatingSuggestions}
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {autoDetecting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {autoDetecting ? 'Detecting...' : 'Auto Detect Hotspots (Free OCR)'}
              </button>

              <button
                type="button"
                onClick={() => void createAllSuggestions()}
                disabled={creatingSuggestions || suggestions.length === 0}
                className="inline-flex items-center gap-1.5 rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {creatingSuggestions ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Create All Suggestions
              </button>
            </div>

            {suggestions.length > 0 ? (
              <p className="mt-2 text-[11px] text-amber-700">
                {suggestions.length} suggestion(s) ready. Boxes marked as `S1`, `S2`, ...
              </p>
            ) : null}

            <div className="mt-3 space-y-2">
              <input
                type="text"
                value={draftInput.title}
                onChange={(event) =>
                  setDraftInput((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Article title"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
              />
              <input
                type="text"
                value={draftInput.excerpt}
                onChange={(event) =>
                  setDraftInput((current) => ({ ...current, excerpt: event.target.value }))
                }
                placeholder="Excerpt (optional)"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
              />
              <input
                type="text"
                value={draftInput.coverImagePath}
                onChange={(event) =>
                  setDraftInput((current) => ({ ...current, coverImagePath: event.target.value }))
                }
                placeholder="Cover image path (optional)"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
              />
              <textarea
                value={draftInput.contentHtml}
                onChange={(event) =>
                  setDraftInput((current) => ({ ...current, contentHtml: event.target.value }))
                }
                placeholder="Article HTML content"
                rows={6}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
              />
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void createArticle()}
                disabled={creating}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Create Article
              </button>
              <button
                type="button"
                onClick={() => setDraftHotspot(null)}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
              >
                Clear Drawn Box
              </button>
            </div>

            {draftHotspot ? (
              <p className="mt-2 text-[11px] text-gray-600">
                x:{' '}
                <span className="font-semibold text-gray-800">{draftHotspot.x.toFixed(3)}</span>{' '}
                y: <span className="font-semibold text-gray-800">{draftHotspot.y.toFixed(3)}</span>{' '}
                w: <span className="font-semibold text-gray-800">{draftHotspot.w.toFixed(3)}</span>{' '}
                h: <span className="font-semibold text-gray-800">{draftHotspot.h.toFixed(3)}</span>
              </p>
            ) : null}

            {suggestions.length > 0 ? (
              <div className="mt-3 space-y-1 rounded-md border border-amber-200 bg-amber-50 p-2">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={`pick-suggestion-${index + 1}`}
                    type="button"
                    onClick={() => {
                      setDraftHotspot(suggestion.hotspot);
                      setDraftInput({
                        title: suggestion.title,
                        excerpt: suggestion.excerpt,
                        contentHtml: suggestion.contentHtml,
                        coverImagePath: '',
                      });
                    }}
                    className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs text-amber-900 hover:bg-amber-100"
                  >
                    <span className="truncate pr-2">
                      S{index + 1}: {suggestion.title}
                    </span>
                    <span className="font-semibold">Use</span>
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            {articles.map((article, index) => {
              const isSaving = savingId === article._id;
              const isDeleting = deletingId === article._id;
              return (
                <div
                  key={article._id}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <p className="text-xs font-semibold text-gray-600">Article {index + 1}</p>
                  <div className="mt-2 space-y-2">
                    <input
                      type="text"
                      value={article.title}
                      onChange={(event) =>
                        updateArticleField(article._id, 'title', event.target.value)
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                    />
                    <input
                      type="text"
                      value={article.excerpt || ''}
                      onChange={(event) =>
                        updateArticleField(article._id, 'excerpt', event.target.value)
                      }
                      placeholder="Excerpt"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                    />
                    <input
                      type="text"
                      value={article.coverImagePath || ''}
                      onChange={(event) =>
                        updateArticleField(article._id, 'coverImagePath', event.target.value)
                      }
                      placeholder="Cover image path"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                    />
                    <textarea
                      rows={4}
                      value={article.contentHtml || ''}
                      onChange={(event) =>
                        updateArticleField(article._id, 'contentHtml', event.target.value)
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                    <label>
                      <span className="mb-1 block font-semibold text-gray-600">x</span>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.001}
                        value={article.hotspot.x}
                        onChange={(event) =>
                          updateArticleField(article._id, 'hotspot.x', event.target.value)
                        }
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 outline-none focus:border-primary-600"
                      />
                    </label>
                    <label>
                      <span className="mb-1 block font-semibold text-gray-600">y</span>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.001}
                        value={article.hotspot.y}
                        onChange={(event) =>
                          updateArticleField(article._id, 'hotspot.y', event.target.value)
                        }
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 outline-none focus:border-primary-600"
                      />
                    </label>
                    <label>
                      <span className="mb-1 block font-semibold text-gray-600">w</span>
                      <input
                        type="number"
                        min={0.001}
                        max={1}
                        step={0.001}
                        value={article.hotspot.w}
                        onChange={(event) =>
                          updateArticleField(article._id, 'hotspot.w', event.target.value)
                        }
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 outline-none focus:border-primary-600"
                      />
                    </label>
                    <label>
                      <span className="mb-1 block font-semibold text-gray-600">h</span>
                      <input
                        type="number"
                        min={0.001}
                        max={1}
                        step={0.001}
                        value={article.hotspot.h}
                        onChange={(event) =>
                          updateArticleField(article._id, 'hotspot.h', event.target.value)
                        }
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 outline-none focus:border-primary-600"
                      />
                    </label>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void saveArticle(article)}
                      disabled={isSaving || isDeleting}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteArticle(article._id)}
                      disabled={isSaving || isDeleting}
                      className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}

            {articles.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-600">
                No articles on this page yet. Draw a box and create one.
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
