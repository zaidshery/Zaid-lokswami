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
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  UploadCloud,
  Volume2,
} from 'lucide-react';
import { CmsWorkflowPriorityBadge, CmsWorkflowStatusBadge } from '@/components/admin/CmsWorkflowStatusBadge';
import { getAuthHeader } from '@/lib/auth/clientToken';
import type {
  EPaperArticleRecord,
  EPaperPageReviewStatus,
  EPaperRecord,
} from '@/lib/types/epaper';
import { detectHotspotsFromImageClient } from '@/lib/utils/epaperHotspotDetectionClient';
import {
  recognizeEpaperCropTextLocally,
  type EpaperCropTextOcrResult,
} from '@/lib/utils/epaperLocalOcrClient';
import { formatUiDate, formatUiDateTime } from '@/lib/utils/dateFormat';
import {
  buildEpaperPageQualitySignal,
  getEpaperPageQualityTone,
} from '@/lib/utils/epaperQualitySignals';
import {
  buildEpaperSuggestionQuality,
  type EpaperSuggestionWarning,
} from '@/lib/utils/epaperSuggestionQuality';
import { uploadEpaperAssetDirect } from '@/lib/utils/epaperDirectUploadClient';

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
type CropPaddingMode = 'tight' | 'normal' | 'loose';
type HotspotSuggestion = {
  id: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  coverImagePath: string;
  hotspot: Hotspot;
  confidence: number;
  warnings: EpaperSuggestionWarning[];
  selected: boolean;
  ignored: boolean;
};

type DraftArticleInput = {
  title: string;
  excerpt: string;
  contentHtml: string;
  coverImagePath: string;
};

type ManagedTtsAsset = {
  id?: string;
  status?: string;
  provider?: string;
  audioUrl?: string;
  voice?: string;
  model?: string;
  languageCode?: string;
  mimeType?: string;
  generatedAt?: string;
  updatedAt?: string;
  lastVerifiedAt?: string;
  lastError?: string;
  chunkCount?: number;
  charCount?: number;
};

type StoryTtsResponse = {
  eligible?: boolean;
  ready?: boolean;
  asset?: ManagedTtsAsset | null;
  message?: string;
};

type StoryTtsState = {
  eligible: boolean;
  ready: boolean;
  asset: ManagedTtsAsset | null;
  message: string;
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

function buildStoryListenSignature(
  article: Pick<EPaperArticleRecord, 'title' | 'excerpt' | 'contentHtml'>
) {
  return [
    String(article.title || '').trim(),
    String(article.excerpt || '').trim(),
    String(article.contentHtml || '').trim(),
  ].join('\n::\n');
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

function toContentHtmlInput(text: string) {
  const value = String(text || '').trim();
  if (!value) return '';
  return /<[a-z][\s\S]*>/i.test(value) ? value : toHtmlParagraph(value);
}

function hasReadableContentInput(value: string) {
  return Boolean(
    String(value || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function formatProductionStatusLabel(status: string | null | undefined) {
  return String(status || 'draft_upload')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function productionTone(status: string | null | undefined) {
  switch (status) {
    case 'published':
      return 'bg-emerald-100 text-emerald-700';
    case 'ready_to_publish':
      return 'bg-blue-100 text-blue-700';
    case 'qa_review':
    case 'hotspot_mapping':
    case 'ocr_review':
    case 'pages_ready':
      return 'bg-amber-100 text-amber-700';
    case 'archived':
      return 'bg-zinc-200 text-zinc-700';
    default:
      return 'bg-zinc-100 text-zinc-700';
  }
}

function formatPageReviewStatusLabel(status: string | null | undefined) {
  switch (status) {
    case 'needs_attention':
      return 'Needs Attention';
    case 'ready':
      return 'Ready';
    case 'pending':
    default:
      return 'Pending';
  }
}

function pageReviewTone(status: string | null | undefined) {
  switch (status) {
    case 'ready':
      return 'bg-emerald-100 text-emerald-700';
    case 'needs_attention':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-amber-100 text-amber-700';
  }
}

function confidenceTone(confidence: number) {
  if (confidence >= 80) return 'bg-emerald-100 text-emerald-700';
  if (confidence >= 60) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

function warningTone(warning: EpaperSuggestionWarning) {
  return warning.severity === 'blocking'
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-amber-200 bg-amber-50 text-amber-700';
}

function hasBlockingSuggestionWarning(suggestion: HotspotSuggestion) {
  return suggestion.warnings.some((warning) => warning.severity === 'blocking');
}

function canCreateSuggestionDraft(suggestion: HotspotSuggestion) {
  return suggestion.selected && !suggestion.ignored && !hasBlockingSuggestionWarning(suggestion);
}

function canPreviewImagePath(value: string | undefined) {
  const path = String(value || '').trim();
  return Boolean(path && (path.startsWith('/') || /^https?:\/\//i.test(path) || /^data:image\//i.test(path)));
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
  const [croppingTarget, setCroppingTarget] = useState('');
  const [cropOcrTarget, setCropOcrTarget] = useState('');
  const [cropOcrMessages, setCropOcrMessages] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [suggestions, setSuggestions] = useState<HotspotSuggestion[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [storyTtsById, setStoryTtsById] = useState<Record<string, StoryTtsState>>({});
  const [savedStoryTtsSignatures, setSavedStoryTtsSignatures] = useState<Record<string, string>>({});
  const [loadingStoryTtsIds, setLoadingStoryTtsIds] = useState<Record<string, boolean>>({});
  const [pageReviewStatus, setPageReviewStatus] = useState<EPaperPageReviewStatus>('pending');
  const [pageReviewNote, setPageReviewNote] = useState('');
  const [savingPageReview, setSavingPageReview] = useState(false);

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
  const readiness = epaper?.readiness;
  const productionStatus = epaper?.productionStatus || 'draft_upload';
  const pageQuality = useMemo(
    () =>
      buildEpaperPageQualitySignal({
        pageNumber,
        page: pageImageMeta,
        articles,
      }),
    [articles, pageImageMeta, pageNumber]
  );
  const activeSuggestionCount = useMemo(
    () => suggestions.filter((suggestion) => !suggestion.ignored).length,
    [suggestions]
  );
  const selectedSuggestionCount = useMemo(
    () => suggestions.filter((suggestion) => canCreateSuggestionDraft(suggestion)).length,
    [suggestions]
  );
  const unresolvedSuggestionWarningCount = useMemo(
    () =>
      suggestions.filter(
        (suggestion) => !suggestion.ignored && suggestion.warnings.length > 0
      ).length,
    [suggestions]
  );
  const pageReadyBlockers = useMemo(() => {
    const blockers: string[] = [];
    if (!articles.length) blockers.push('map at least one story');
    if (unreadableArticleCount > 0) {
      blockers.push(
        `${unreadableArticleCount} mapped stor${
          unreadableArticleCount === 1 ? 'y needs' : 'ies need'
        } readable text`
      );
    }
    if (activeSuggestionCount > 0) {
      blockers.push(
        `${activeSuggestionCount} OCR suggestion${
          activeSuggestionCount === 1 ? ' is' : 's are'
        } still unresolved`
      );
    }
    return blockers;
  }, [activeSuggestionCount, articles.length, unreadableArticleCount]);
  const manualDraftNeedsHeadline = Boolean(draftHotspot) && !draftInput.title.trim();
  const manualDraftNeedsBody =
    Boolean(draftHotspot) && !hasReadableContentInput(draftInput.contentHtml);
  const canCreateManualDraft = Boolean(
    draftHotspot && draftInput.title.trim() && hasReadableContentInput(draftInput.contentHtml)
  );

  useEffect(() => {
    setPageReviewStatus(pageImageMeta?.reviewStatus || 'pending');
    setPageReviewNote(pageImageMeta?.reviewNote || '');
  }, [pageImageMeta?.reviewNote, pageImageMeta?.reviewStatus, pageNumber]);

  const fetchStoryTtsStatus = useCallback(
    async (storyId: string): Promise<StoryTtsState> => {
      try {
        const response = await fetch(
          `/api/admin/epapers/${encodeURIComponent(epaperId)}/articles/${encodeURIComponent(storyId)}/tts`,
          {
            headers: { ...getAuthHeader() },
            cache: 'no-store',
          }
        );
        const payload = (await response.json().catch(() => ({}))) as {
          success?: boolean;
          data?: StoryTtsResponse;
        };

        if (!response.ok || !payload.success || !payload.data) {
          return {
            eligible: false,
            ready: false,
            asset: null,
            message: 'Story listen audio status is unavailable.',
          };
        }

        return {
          eligible: Boolean(payload.data.eligible),
          ready: Boolean(payload.data.ready),
          asset: payload.data.asset || null,
          message: String(payload.data.message || '').trim(),
        };
      } catch {
        return {
          eligible: false,
          ready: false,
          asset: null,
          message: 'Story listen audio status is unavailable.',
        };
      }
    },
    [epaperId]
  );

  const loadStoryTtsStatuses = useCallback(
    async (records: EPaperArticleRecord[]) => {
      if (!records.length) {
        setStoryTtsById({});
        return;
      }

      const entries = await Promise.all(
        records.map(async (article) => [article._id, await fetchStoryTtsStatus(article._id)] as const)
      );

      setStoryTtsById(Object.fromEntries(entries));
    },
    [fetchStoryTtsStatus]
  );

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
      const nextArticles = Array.isArray(articlesPayload.data) ? articlesPayload.data : [];
      setArticles(nextArticles);
      setSavedStoryTtsSignatures(
        Object.fromEntries(
          nextArticles.map((article) => [article._id, buildStoryListenSignature(article)])
        )
      );
      void loadStoryTtsStatuses(nextArticles);
    } catch (err: unknown) {
      setError(toErrorMessage(err, 'Failed to load page editor data'));
      setEpaper(null);
      setArticles([]);
      setSavedStoryTtsSignatures({});
      setStoryTtsById({});
    } finally {
      setLoading(false);
    }
  }, [epaperId, loadStoryTtsStatuses, pageNumber]);

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
    setDraftInput((current) => ({ ...current, coverImagePath: '' }));
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
        contentHtml: toContentHtmlInput(payload.contentHtml || ''),
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
    if (!hasReadableContentInput(draftInput.contentHtml)) {
      setError('Clean Hindi body is required');
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

  const loadSuggestionAsDraft = (suggestion: HotspotSuggestion) => {
    setDraftHotspot(suggestion.hotspot);
    setDraftInput({
      title: suggestion.title,
      excerpt: suggestion.excerpt,
      contentHtml: suggestion.contentHtml,
      coverImagePath: suggestion.coverImagePath,
    });
  };

  const cropHotspotImage = async (
    target: string,
    hotspot: Hotspot | null,
    title: string,
    paddingMode: CropPaddingMode,
    onCrop: (coverImagePath: string) => void
  ) => {
    if (!hotspot) {
      setError('Select a hotspot box before cropping');
      return;
    }

    setCroppingTarget(target);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`/api/admin/epapers/${epaperId}/crop-hotspot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          pageNumber,
          hotspot: toFixedHotspot(hotspot),
          title,
          paddingMode,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        coverImagePath?: string;
        data?: { coverImagePath?: string; width?: number; height?: number };
      };
      const coverImagePath = String(payload.coverImagePath || payload.data?.coverImagePath || '').trim();
      if (!response.ok || !payload.success || !coverImagePath) {
        throw new Error(payload.error || 'Failed to crop hotspot image');
      }

      onCrop(coverImagePath);
      setNotice(
        `${paddingMode === 'tight' ? 'Tight' : paddingMode === 'normal' ? 'Margin' : 'Loose'} clipping image created. Save the draft/story to keep the new cover path.`
      );
    } catch (err: unknown) {
      setError(toErrorMessage(err, 'Failed to crop hotspot image'));
    } finally {
      setCroppingTarget('');
    }
  };

  const setCropOcrMessage = (target: string, message: string) => {
    setCropOcrMessages((current) => ({
      ...current,
      [target]: message,
    }));
  };

  const clearCropOcrMessage = (target: string) => {
    setCropOcrMessages((current) => {
      const next = { ...current };
      delete next[target];
      return next;
    });
  };

  const extractTextFromCropImage = async (
    target: string,
    imagePath: string | undefined,
    onExtract: (result: EpaperCropTextOcrResult) => void
  ) => {
    const source = String(imagePath || '').trim();
    if (!canPreviewImagePath(source)) {
      const message = 'Crop image required before text extraction.';
      setCropOcrMessage(target, message);
      setError(message);
      return;
    }

    setCropOcrTarget(target);
    setCropOcrMessage(target, 'Extracting...');
    setError('');
    setNotice('');

    try {
      const result = await recognizeEpaperCropTextLocally(source, { language: 'hin+eng' });
      onExtract(result);
      const message = 'Text extracted. Review OCR text before creating draft.';
      setCropOcrMessage(target, message);
      setNotice(message);
    } catch (err: unknown) {
      const message = 'Could not read crop. Paste text manually.';
      setCropOcrMessage(target, message);
      setError(toErrorMessage(err, message));
    } finally {
      setCropOcrTarget('');
    }
  };

  const clearDraftSelection = () => {
    setDraftHotspot(null);
    setDraftInput((current) => ({ ...current, coverImagePath: '' }));
    clearCropOcrMessage('manual');
  };

  const toggleSuggestionSelection = (id: string) => {
    setSuggestions((current) =>
      current.map((suggestion) => {
        if (suggestion.id !== id) return suggestion;
        if (suggestion.ignored || hasBlockingSuggestionWarning(suggestion)) return suggestion;
        return {
          ...suggestion,
          selected: !suggestion.selected,
        };
      })
    );
  };

  const toggleSuggestionIgnored = (id: string) => {
    setSuggestions((current) =>
      current.map((suggestion) => {
        if (suggestion.id !== id) return suggestion;
        const ignored = !suggestion.ignored;
        return {
          ...suggestion,
          ignored,
          selected: ignored ? false : suggestion.selected,
        };
      })
    );
  };

  const updateSuggestionField = (
    id: string,
    key: 'title' | 'excerpt' | 'contentHtml',
    value: string
  ) => {
    setSuggestions((current) =>
      current.map((suggestion) => {
        if (suggestion.id !== id) return suggestion;

        const updated = {
          ...suggestion,
          [key]: value,
        };
        const quality = buildEpaperSuggestionQuality({
          title: updated.title,
          excerpt: updated.excerpt,
          contentHtml: updated.contentHtml,
          hotspot: updated.hotspot,
          existingStories: articles,
        });

        return {
          ...updated,
          confidence: quality.confidence,
          warnings: quality.warnings,
          selected:
            !updated.ignored &&
            updated.selected &&
            quality.warnings.every((warning) => warning.severity !== 'blocking'),
        };
      })
    );
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
        const excerpt = sourceText.slice(0, 240);
        const contentHtml = sourceText;
        const nextHotspot = toFixedHotspot({
          x: Number.isFinite(x) ? x : 0,
          y: Number.isFinite(y) ? y : 0,
          w: Number.isFinite(w) ? w : 0.1,
          h: Number.isFinite(h) ? h : 0.1,
        });
        const quality = buildEpaperSuggestionQuality({
          title: safeTitle,
          excerpt,
          contentHtml,
          hotspot: nextHotspot,
          existingStories: articles,
        });

        return {
          id: `ocr-${Date.now()}-${index + 1}`,
          title: safeTitle,
          excerpt,
          contentHtml,
          coverImagePath: '',
          hotspot: nextHotspot,
          confidence: quality.confidence,
          warnings: quality.warnings,
          selected: quality.shouldSelect,
          ignored: false,
        };
      });

      setSuggestions(mapped);
      if (mapped[0]) {
        loadSuggestionAsDraft(mapped[0]);
      }
      const engineLabel = detection.engine === 'local' ? 'local free OCR' : 'server OCR fallback';
      setNotice(
        mapped.length > 0
          ? `Detected ${mapped.length} hotspot suggestions using ${engineLabel}. ${mapped.filter((item) => item.selected).length} ready for draft creation.`
          : `No hotspot suggestions found using ${engineLabel}.`
      );
    } catch (err: unknown) {
      setSuggestions([]);
      setError(toErrorMessage(err, 'Failed to auto-detect hotspots'));
    } finally {
      setAutoDetecting(false);
    }
  };

  const createSelectedSuggestions = async () => {
    const selectedSuggestions = suggestions.filter((suggestion) =>
      canCreateSuggestionDraft(suggestion)
    );

    if (selectedSuggestions.length === 0) {
      setError('Select at least one clean OCR suggestion before creating drafts');
      return;
    }

    setCreatingSuggestions(true);
    setError('');
    setNotice('');

    let successCount = 0;
    const failures: string[] = [];
    const successfulIds: string[] = [];
    for (let index = 0; index < selectedSuggestions.length; index += 1) {
      const suggestion = selectedSuggestions[index];
      try {
        await createArticleRequest({
          title: suggestion.title,
          excerpt: suggestion.excerpt,
          contentHtml: suggestion.contentHtml,
          coverImagePath: suggestion.coverImagePath,
          hotspot: suggestion.hotspot,
        });
        successCount += 1;
        successfulIds.push(suggestion.id);
      } catch (err: unknown) {
        failures.push(toErrorMessage(err, `Suggestion ${index + 1} failed`));
      }
    }

    if (successCount > 0) {
      setNotice(`Created ${successCount} draft stor${successCount === 1 ? 'y' : 'ies'} from selected OCR suggestions.`);
      setSuggestions((current) =>
        current.filter((suggestion) => !successfulIds.includes(suggestion.id))
      );
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
          contentHtml: toContentHtmlInput(article.contentHtml || ''),
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

  const savePageReview = async () => {
    if (pageReviewStatus === 'ready' && pageReadyBlockers.length > 0) {
      setError(`Resolve before marking ready: ${pageReadyBlockers.join('; ')}`);
      return;
    }

    setSavingPageReview(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`/api/admin/epapers/${epaperId}/pages`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          pages: [
            {
              pageNumber,
              reviewStatus: pageReviewStatus,
              reviewNote: pageReviewNote,
            },
          ],
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to save page review');
      }

      setNotice(payload?.message || `Page ${pageNumber} review updated`);
      await fetchData();
    } catch (err: unknown) {
      setError(toErrorMessage(err, 'Failed to save page review'));
    } finally {
      setSavingPageReview(false);
    }
  };

  const regenerateStoryTts = async (article: EPaperArticleRecord) => {
    setLoadingStoryTtsIds((current) => ({ ...current, [article._id]: true }));
    setError('');
    setNotice('');

    try {
      const response = await fetch(
        `/api/admin/epapers/${encodeURIComponent(epaperId)}/articles/${encodeURIComponent(article._id)}/tts?force=1`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeader(),
          },
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        data?: StoryTtsResponse;
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || 'Failed to generate story listen audio');
      }

      setStoryTtsById((current) => ({
        ...current,
        [article._id]: {
          eligible: Boolean(payload.data?.eligible),
          ready: Boolean(payload.data?.ready),
          asset: payload.data?.asset || null,
          message: String(payload.data?.message || '').trim(),
        },
      }));
      setNotice(`Story listen audio updated for "${article.title.trim() || 'Untitled story'}".`);
    } catch (err: unknown) {
      setError(toErrorMessage(err, 'Failed to generate story listen audio'));
    } finally {
      setLoadingStoryTtsIds((current) => {
        const next = { ...current };
        delete next[article._id];
        return next;
      });
    }
  };

  const uploadManualStoryAudio = async (article: EPaperArticleRecord, file: File | null) => {
    if (!file) return;

    setLoadingStoryTtsIds((current) => ({ ...current, [article._id]: true }));
    setError('');
    setNotice('');

    try {
      const uploaded = await uploadEpaperAssetDirect({
        kind: 'epaper_story_audio',
        file,
        authHeaders: getAuthHeader(),
        epaperId,
        articleId: article._id,
      });
      const ttsAsset = uploaded.ttsAsset && typeof uploaded.ttsAsset === 'object'
        ? (uploaded.ttsAsset as ManagedTtsAsset)
        : null;

      setStoryTtsById((current) => ({
        ...current,
        [article._id]: {
          eligible: true,
          ready: Boolean(ttsAsset?.audioUrl || uploaded.asset.mediaUrl),
          asset: ttsAsset || {
            status: 'ready',
            provider: 'manual',
            audioUrl: uploaded.asset.mediaUrl,
            mimeType: uploaded.asset.mediaMimeType,
          },
          message: 'Manual story listen audio is ready.',
        },
      }));
      setNotice(`Manual audio uploaded for "${article.title.trim() || 'Untitled story'}".`);
    } catch (err: unknown) {
      setError(toErrorMessage(err, 'Failed to upload manual story audio'));
    } finally {
      setLoadingStoryTtsIds((current) => {
        const next = { ...current };
        delete next[article._id];
        return next;
      });
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
      setSavedStoryTtsSignatures((current) => {
        const next = { ...current };
        delete next[articleId];
        return next;
      });
      setStoryTtsById((current) => {
        const next = { ...current };
        delete next[articleId];
        return next;
      });
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

      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Edition context
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${productionTone(
                  productionStatus
                )}`}
              >
                {formatProductionStatusLabel(productionStatus)}
              </span>
              {epaper.productionAssignee ? (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                  Desk owner {epaper.productionAssignee.name}
                </span>
              ) : (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                  No desk owner yet
                </span>
              )}
              {epaper.qaCompletedAt ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  QA closed {formatUiDateTime(epaper.qaCompletedAt, formatUiDate(epaper.qaCompletedAt))}
                </span>
              ) : null}
              {pageImageMeta?.reviewedBy ? (
                <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                  Reviewed by {pageImageMeta.reviewedBy.name}
                </span>
              ) : null}
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${pageReviewTone(
                  pageReviewStatus
                )}`}
              >
                Page QA {formatPageReviewStatusLabel(pageReviewStatus)}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${getEpaperPageQualityTone(
                  pageQuality.level
                )}`}
              >
                Extraction {pageQuality.label}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <p>
              Readiness:{' '}
              <span className="font-semibold text-gray-900">
                {readiness?.status === 'ready'
                  ? 'Ready'
                  : readiness?.status === 'needs-review'
                    ? 'Needs review'
                    : 'Blocked'}
              </span>
            </p>
            <p className="mt-1">
              Page {pageNumber}: <span className="font-semibold text-gray-900">{articles.length}</span> mapped stories
            </p>
          </div>
        </div>

        {readiness?.blockers.length ? (
          <p className="mt-3 text-xs text-red-600">
            Open blockers: {readiness.blockers.join(' | ')}
          </p>
        ) : null}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
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
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Extraction Quality</p>
          <p
            className={`mt-2 text-2xl font-bold ${
              pageQuality.level === 'good'
                ? 'text-emerald-700'
                : pageQuality.level === 'critical'
                  ? 'text-red-700'
                  : 'text-amber-700'
            }`}
          >
            {pageQuality.label}
          </p>
          <p className="mt-1 text-xs text-gray-600">
            Text coverage {pageQuality.textCoveragePercent}% on this page.
          </p>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Page QA</p>
            <h2 className="mt-2 text-lg font-semibold text-gray-900">Reviewer note and status</h2>
            <p className="mt-1 text-sm text-gray-600">
              Capture OCR issues, missing story mapping, and whether this page is clear for edition QA.
            </p>
          </div>
          {pageImageMeta?.reviewedAt || pageImageMeta?.reviewedBy ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              {pageImageMeta?.reviewedBy ? <p>Reviewer {pageImageMeta.reviewedBy.name}</p> : null}
              {pageImageMeta?.reviewedAt ? (
                <p className={pageImageMeta?.reviewedBy ? 'mt-1' : ''}>
                  Last reviewed {formatUiDateTime(pageImageMeta.reviewedAt, formatUiDate(pageImageMeta.reviewedAt))}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
          <label>
            <span className="mb-1 block text-xs font-semibold text-gray-600">Review status</span>
            <select
              value={pageReviewStatus}
              onChange={(event) => setPageReviewStatus(event.target.value as EPaperPageReviewStatus)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
              disabled={savingPageReview}
            >
              <option value="pending">Pending</option>
              <option value="needs_attention">Needs attention</option>
              <option value="ready">Ready</option>
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold text-gray-600">Reviewer note</span>
            <textarea
              value={pageReviewNote}
              onChange={(event) => setPageReviewNote(event.target.value)}
              rows={3}
              placeholder="Example: OCR still weak on lower-right column, one hotspot missing under masthead."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
              disabled={savingPageReview}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void savePageReview()}
            disabled={savingPageReview}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {savingPageReview ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save Page QA
          </button>
          {unreadableArticleCount > 0 ? (
            <p className="text-xs text-amber-700">
              {unreadableArticleCount} mapped stor{unreadableArticleCount === 1 ? 'y still needs' : 'ies still need'} OCR review.
            </p>
          ) : activeSuggestionCount > 0 ? (
            <p className="text-xs text-amber-700">
              Resolve {activeSuggestionCount} OCR suggestion{activeSuggestionCount === 1 ? '' : 's'} before marking this page ready.
            </p>
          ) : (
            <p className="text-xs text-emerald-700">All mapped stories on this page have readable text.</p>
          )}
        </div>

        {pageReviewStatus === 'ready' && pageReadyBlockers.length > 0 ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p className="font-semibold">Ready status is blocked until:</p>
            <ul className="mt-2 space-y-1">
              {pageReadyBlockers.map((blocker) => (
                <li key={blocker}>- {blocker}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {pageQuality.issues.length > 0 ? (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Quality signals</p>
            <ul className="mt-2 space-y-1 text-sm text-gray-700">
              {pageQuality.issues.map((issue) => (
                <li key={issue}>- {issue}</li>
              ))}
            </ul>
          </div>
        ) : null}
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
                key={suggestion.id}
                className={`pointer-events-none absolute border-2 border-dashed ${
                  suggestion.ignored
                    ? 'border-gray-400 bg-gray-500/10'
                    : suggestion.selected
                      ? 'border-emerald-500 bg-emerald-500/20'
                      : 'border-amber-500 bg-amber-500/20'
                }`}
                style={hotspotStyle(suggestion.hotspot)}
                title={suggestion.title || `Suggestion ${index + 1}`}
              >
                <span
                  className={`absolute -left-px -top-5 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold text-white ${
                    suggestion.ignored
                      ? 'bg-gray-600'
                      : suggestion.selected
                        ? 'bg-emerald-600'
                        : 'bg-amber-600'
                  }`}
                >
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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Smart extraction desk
                </p>
                <h2 className="mt-1 text-base font-semibold text-gray-900">Detect Stories</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  {selectedSuggestionCount} selected
                </span>
                {unresolvedSuggestionWarningCount > 0 ? (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                    {unresolvedSuggestionWarningCount} need review
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 text-xs font-semibold text-gray-700 sm:grid-cols-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                1. Detect Stories
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                2. Review Suggestions
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                3. Create Selected Drafts
              </div>
            </div>

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
                {autoDetecting ? 'Detecting...' : 'Detect Stories'}
              </button>

              <button
                type="button"
                onClick={() => void createSelectedSuggestions()}
                disabled={creatingSuggestions || selectedSuggestionCount === 0}
                className="inline-flex items-center gap-1.5 rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {creatingSuggestions ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Create Selected Drafts
              </button>
            </div>

            {suggestions.length > 0 ? (
              <p className="mt-2 text-[11px] text-gray-600">
                {suggestions.length} OCR suggestion{suggestions.length === 1 ? '' : 's'} found.
                Selected green boxes are ready for draft creation.
              </p>
            ) : null}

            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Manual Draft</p>
                  <p className="text-xs text-gray-600">
                    Use the drawn box or an OCR suggestion, then save as a draft story.
                  </p>
                </div>
                {draftHotspot ? (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                    Box selected
                  </span>
                ) : null}
              </div>

              {draftHotspot ? (
                <div className="sticky top-2 z-10 mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-emerald-900">Selected area ready</p>
                      <p className="mt-1 text-xs text-emerald-800">
                        This exact area will be cropped. Adjust selection if needed.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={clearDraftSelection}
                      className="rounded-md border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                    >
                      Clear Selection
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void cropHotspotImage(
                          'manual:tight',
                          draftHotspot,
                          draftInput.title,
                          'tight',
                          (coverImagePath) =>
                            setDraftInput((current) => ({ ...current, coverImagePath }))
                        )
                      }
                      disabled={Boolean(croppingTarget)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {croppingTarget === 'manual:tight' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Crop Tight
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void cropHotspotImage(
                          'manual:normal',
                          draftHotspot,
                          draftInput.title,
                          'normal',
                          (coverImagePath) =>
                            setDraftInput((current) => ({ ...current, coverImagePath }))
                        )
                      }
                      disabled={Boolean(croppingTarget)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {croppingTarget === 'manual:normal' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Crop With Margin
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-gray-600">Headline</span>
                  <input
                    type="text"
                    value={draftInput.title}
                    onChange={(event) =>
                      setDraftInput((current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="Headline"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-gray-600">Short summary</span>
                  <input
                    type="text"
                    value={draftInput.excerpt}
                    onChange={(event) =>
                      setDraftInput((current) => ({ ...current, excerpt: event.target.value }))
                    }
                    placeholder="Short summary"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-gray-600">Crop / cover image path</span>
                  <input
                    type="text"
                    value={draftInput.coverImagePath}
                    onChange={(event) =>
                      setDraftInput((current) => ({ ...current, coverImagePath: event.target.value }))
                    }
                    placeholder="Crop / cover image path"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                  />
                </label>
                {canPreviewImagePath(draftInput.coverImagePath) ? (
                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                    <Image
                      src={draftInput.coverImagePath}
                      alt="Manual draft clipping preview"
                      width={420}
                      height={220}
                      unoptimized
                      className="h-auto max-h-48 w-full object-contain"
                    />
                    <div className="flex flex-wrap gap-2 border-t border-gray-200 bg-gray-50 p-2">
                      <button
                        type="button"
                        onClick={() =>
                          setNotice('This crop is ready. Create or save the story to keep it.')
                        }
                        className="rounded-md bg-primary-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-700"
                      >
                        Use this crop
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void extractTextFromCropImage(
                            'manual',
                            draftInput.coverImagePath,
                            (result) =>
                              setDraftInput((current) => ({
                                ...current,
                                title: result.title || current.title,
                                excerpt: result.excerpt || current.excerpt,
                                contentHtml: result.contentHtml || current.contentHtml,
                              }))
                          )
                        }
                        disabled={Boolean(cropOcrTarget)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-primary-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {cropOcrTarget === 'manual' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        {cropOcrTarget === 'manual' ? 'Extracting...' : 'Extract Text From Crop'}
                      </button>
                      {draftHotspot ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              void cropHotspotImage(
                                'manual:tight',
                                draftHotspot,
                                draftInput.title,
                                'tight',
                                (coverImagePath) =>
                                  setDraftInput((current) => ({ ...current, coverImagePath }))
                              )
                            }
                            disabled={Boolean(croppingTarget)}
                            className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            Try tighter
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void cropHotspotImage(
                                'manual:normal',
                                draftHotspot,
                                draftInput.title,
                                'normal',
                                (coverImagePath) =>
                                  setDraftInput((current) => ({ ...current, coverImagePath }))
                              )
                            }
                            disabled={Boolean(croppingTarget)}
                            className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            Try with margin
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setDraftInput((current) => ({ ...current, coverImagePath: '' }));
                          clearCropOcrMessage('manual');
                        }}
                        className="rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                      >
                        Clear crop
                      </button>
                    </div>
                    {cropOcrMessages.manual ? (
                      <p className="border-t border-gray-200 bg-white px-3 py-2 text-[11px] font-semibold text-gray-600">
                        {cropOcrMessages.manual}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-gray-600">Clean Hindi body</span>
                  <textarea
                    value={draftInput.contentHtml}
                    onChange={(event) =>
                      setDraftInput((current) => ({ ...current, contentHtml: event.target.value }))
                    }
                    placeholder="Clean Hindi body"
                    rows={6}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                  />
                </label>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {draftHotspot && (manualDraftNeedsHeadline || manualDraftNeedsBody) ? (
                  <p className="w-full rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                    {manualDraftNeedsHeadline
                      ? 'Headline required before creating draft'
                      : 'Clean Hindi body required before creating draft'}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => void createArticle()}
                  disabled={creating || !canCreateManualDraft}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Create Draft Story
                </button>
                <button
                  type="button"
                  onClick={clearDraftSelection}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Clear Selection
                </button>
              </div>
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
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">Review Suggestions</h3>
                  <p className="text-xs text-gray-600">
                    {selectedSuggestionCount} of {suggestions.length} ready for draft creation.
                  </p>
                </div>

                {suggestions.map((suggestion, index) => {
                  const blocked = hasBlockingSuggestionWarning(suggestion);
                  const suggestionOcrTarget = `suggestion:${suggestion.id}`;
                  return (
                    <article
                      key={suggestion.id}
                      className={`rounded-lg border p-3 ${
                        suggestion.ignored
                          ? 'border-gray-200 bg-gray-50 opacity-75'
                          : blocked
                            ? 'border-red-200 bg-red-50/40'
                            : suggestion.selected
                              ? 'border-emerald-200 bg-emerald-50/50'
                              : 'border-amber-200 bg-amber-50/50'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <label className="flex min-w-0 flex-1 items-start gap-2">
                          <input
                            type="checkbox"
                            checked={suggestion.selected}
                            disabled={suggestion.ignored || blocked}
                            onChange={() => toggleSuggestionSelection(suggestion.id)}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-600"
                          />
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold text-gray-500">
                              S{index + 1}
                            </span>
                            <span className="block truncate text-sm font-semibold text-gray-900">
                              {suggestion.title || 'Untitled OCR suggestion'}
                            </span>
                          </span>
                        </label>

                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${confidenceTone(
                              suggestion.confidence
                            )}`}
                          >
                            {suggestion.confidence >= 70 ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            {suggestion.confidence}%
                          </span>
                          {suggestion.ignored ? (
                            <span className="rounded-full bg-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-700">
                              Ignored
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {suggestion.warnings.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {suggestion.warnings.map((warning) => (
                            <span
                              key={`${suggestion.id}-${warning.code}`}
                              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${warningTone(
                                warning
                              )}`}
                            >
                              {warning.label}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-3 space-y-2">
                        <input
                          type="text"
                          value={suggestion.title}
                          onChange={(event) =>
                            updateSuggestionField(suggestion.id, 'title', event.target.value)
                          }
                          placeholder="Headline"
                          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-600"
                        />
                        <textarea
                          rows={2}
                          value={suggestion.excerpt}
                          onChange={(event) =>
                            updateSuggestionField(suggestion.id, 'excerpt', event.target.value)
                          }
                          placeholder="Short summary"
                          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-600"
                        />
                        <textarea
                          rows={3}
                          value={suggestion.contentHtml}
                          onChange={(event) =>
                            updateSuggestionField(suggestion.id, 'contentHtml', event.target.value)
                          }
                          placeholder="Clean Hindi body"
                          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-600"
                        />
                      </div>

                      {canPreviewImagePath(suggestion.coverImagePath) ? (
                        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
                          <Image
                            src={suggestion.coverImagePath}
                            alt={`Suggestion ${index + 1} clipping preview`}
                            width={360}
                            height={180}
                            unoptimized
                            className="h-auto max-h-40 w-full object-contain"
                          />
                          <div className="flex flex-wrap gap-2 border-t border-gray-200 bg-gray-50 p-2">
                            <button
                              type="button"
                              onClick={() =>
                                setNotice(
                                  `Suggestion S${index + 1} crop is ready for draft creation.`
                                )
                              }
                              className="rounded-md bg-primary-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-700"
                            >
                              Use this crop
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void extractTextFromCropImage(
                                  suggestionOcrTarget,
                                  suggestion.coverImagePath,
                                  (result) =>
                                    setSuggestions((current) =>
                                      current.map((item) =>
                                        item.id === suggestion.id
                                          ? {
                                              ...item,
                                              title: result.title || item.title,
                                              excerpt: result.excerpt || item.excerpt,
                                              contentHtml: result.contentHtml || item.contentHtml,
                                            }
                                          : item
                                      )
                                    )
                                )
                              }
                              disabled={Boolean(cropOcrTarget)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-primary-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {cropOcrTarget === suggestionOcrTarget ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : null}
                              {cropOcrTarget === suggestionOcrTarget
                                ? 'Extracting...'
                                : 'Extract Text From Crop'}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void cropHotspotImage(
                                  `suggestion:${suggestion.id}:tight`,
                                  suggestion.hotspot,
                                  suggestion.title,
                                  'tight',
                                  (coverImagePath) =>
                                    setSuggestions((current) =>
                                      current.map((item) =>
                                        item.id === suggestion.id ? { ...item, coverImagePath } : item
                                      )
                                    )
                                )
                              }
                              disabled={Boolean(croppingTarget)}
                              className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              Try tighter
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void cropHotspotImage(
                                  `suggestion:${suggestion.id}:normal`,
                                  suggestion.hotspot,
                                  suggestion.title,
                                  'normal',
                                  (coverImagePath) =>
                                    setSuggestions((current) =>
                                      current.map((item) =>
                                        item.id === suggestion.id ? { ...item, coverImagePath } : item
                                      )
                                    )
                                )
                              }
                              disabled={Boolean(croppingTarget)}
                              className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              Try with margin
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSuggestions((current) =>
                                  current.map((item) =>
                                    item.id === suggestion.id
                                      ? { ...item, coverImagePath: '' }
                                      : item
                                  )
                                );
                                clearCropOcrMessage(suggestionOcrTarget);
                              }}
                              className="rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                            >
                              Clear crop
                            </button>
                          </div>
                          {cropOcrMessages[suggestionOcrTarget] ? (
                            <p className="border-t border-gray-200 bg-white px-3 py-2 text-[11px] font-semibold text-gray-600">
                              {cropOcrMessages[suggestionOcrTarget]}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void cropHotspotImage(
                              `suggestion:${suggestion.id}:tight`,
                              suggestion.hotspot,
                              suggestion.title,
                              'tight',
                              (coverImagePath) =>
                                setSuggestions((current) =>
                                  current.map((item) =>
                                    item.id === suggestion.id ? { ...item, coverImagePath } : item
                                  )
                                )
                            )
                          }
                          disabled={Boolean(croppingTarget)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {croppingTarget === `suggestion:${suggestion.id}:tight` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          Crop Tight
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void cropHotspotImage(
                              `suggestion:${suggestion.id}:normal`,
                              suggestion.hotspot,
                              suggestion.title,
                              'normal',
                              (coverImagePath) =>
                                setSuggestions((current) =>
                                  current.map((item) =>
                                    item.id === suggestion.id ? { ...item, coverImagePath } : item
                                  )
                                )
                            )
                          }
                          disabled={Boolean(croppingTarget)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {croppingTarget === `suggestion:${suggestion.id}:normal` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          Crop With Margin
                        </button>
                        <button
                          type="button"
                          onClick={() => loadSuggestionAsDraft(suggestion)}
                          className="rounded-md border border-primary-200 bg-white px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50"
                        >
                          Use / Edit Manually
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleSuggestionIgnored(suggestion.id)}
                          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                        >
                          {suggestion.ignored ? 'Restore' : 'Ignore'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            {articles.map((article, index) => {
              const isSaving = savingId === article._id;
              const isDeleting = deletingId === article._id;
              const articleOcrTarget = `article:${article._id}`;
              const isLoadingTts = Boolean(loadingStoryTtsIds[article._id]);
              const storyTts = storyTtsById[article._id];
              const storyHasReadableText = Boolean(
                String(article.contentHtml || '').trim() || String(article.excerpt || '').trim()
              );
              const storyTtsNeedsSave =
                buildStoryListenSignature(article) !== (savedStoryTtsSignatures[article._id] || '');
              const storyTtsStatus = storyTtsNeedsSave
                ? 'dirty'
                : !storyTts?.eligible
                  ? (storyHasReadableText ? 'missing' : 'disabled')
                  : storyTts.ready && storyTts.asset?.audioUrl
                    ? 'ready'
                    : storyTts.asset?.status || 'missing';
              return (
                <div
                  key={article._id}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-600">Article {index + 1}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <CmsWorkflowStatusBadge status={article.workflow?.status} />
                        {article.workflow?.assignedTo?.name ? (
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700">
                            Assigned to {article.workflow.assignedTo.name}
                          </span>
                        ) : null}
                        {article.workflow?.priority ? (
                          <CmsWorkflowPriorityBadge priority={article.workflow.priority} showPrefix />
                        ) : null}
                      </div>
                    </div>
                    {article.workflow?.createdBy?.name ? (
                      <p className="text-[11px] text-gray-500">
                        Created by {article.workflow.createdBy.name}
                      </p>
                    ) : null}
                  </div>
                  {article.workflow?.rejectionReason ? (
                    <p className="mt-2 text-xs text-red-600">
                      Rejection note: {article.workflow.rejectionReason}
                    </p>
                  ) : null}
                  <div className="mt-2 space-y-2">
                    <input
                      type="text"
                      value={article.title}
                      onChange={(event) =>
                        updateArticleField(article._id, 'title', event.target.value)
                      }
                      placeholder="Headline"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                    />
                    <input
                      type="text"
                      value={article.excerpt || ''}
                      onChange={(event) =>
                        updateArticleField(article._id, 'excerpt', event.target.value)
                      }
                      placeholder="Short summary"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                    />
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        value={article.coverImagePath || ''}
                        onChange={(event) =>
                          updateArticleField(article._id, 'coverImagePath', event.target.value)
                        }
                        placeholder="Crop / cover image path"
                        className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void cropHotspotImage(
                              `article:${article._id}:tight`,
                              article.hotspot,
                              article.title,
                              'tight',
                              (coverImagePath) =>
                                updateArticleField(article._id, 'coverImagePath', coverImagePath)
                            )
                          }
                          disabled={isSaving || isDeleting || Boolean(croppingTarget)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {croppingTarget === `article:${article._id}:tight` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          Crop Tight
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void cropHotspotImage(
                              `article:${article._id}:normal`,
                              article.hotspot,
                              article.title,
                              'normal',
                              (coverImagePath) =>
                                updateArticleField(article._id, 'coverImagePath', coverImagePath)
                            )
                          }
                          disabled={isSaving || isDeleting || Boolean(croppingTarget)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {croppingTarget === `article:${article._id}:normal` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          Crop With Margin
                        </button>
                      </div>
                    </div>
                    {canPreviewImagePath(article.coverImagePath) ? (
                      <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                        <Image
                          src={String(article.coverImagePath || '')}
                          alt={`${article.title || 'E-paper story'} clipping preview`}
                          width={420}
                          height={220}
                          unoptimized
                          className="h-auto max-h-48 w-full object-contain"
                        />
                        <div className="flex flex-wrap gap-2 border-t border-gray-200 bg-gray-50 p-2">
                          <button
                            type="button"
                            onClick={() =>
                              setNotice('This crop is ready. Save the story to keep it.')
                            }
                            className="rounded-md bg-primary-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-700"
                          >
                            Use this crop
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void extractTextFromCropImage(
                                articleOcrTarget,
                                article.coverImagePath,
                                (result) => {
                                  updateArticleField(article._id, 'title', result.title || article.title);
                                  updateArticleField(
                                    article._id,
                                    'excerpt',
                                    result.excerpt || article.excerpt || ''
                                  );
                                  updateArticleField(
                                    article._id,
                                    'contentHtml',
                                    result.contentHtml || article.contentHtml || ''
                                  );
                                }
                              )
                            }
                            disabled={isSaving || isDeleting || Boolean(cropOcrTarget)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-primary-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {cropOcrTarget === articleOcrTarget ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            {cropOcrTarget === articleOcrTarget
                              ? 'Extracting...'
                              : 'Extract Text From Crop'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void cropHotspotImage(
                                `article:${article._id}:tight`,
                                article.hotspot,
                                article.title,
                                'tight',
                                (coverImagePath) =>
                                  updateArticleField(article._id, 'coverImagePath', coverImagePath)
                              )
                            }
                            disabled={isSaving || isDeleting || Boolean(croppingTarget)}
                            className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            Try tighter
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void cropHotspotImage(
                                `article:${article._id}:normal`,
                                article.hotspot,
                                article.title,
                                'normal',
                                (coverImagePath) =>
                                  updateArticleField(article._id, 'coverImagePath', coverImagePath)
                              )
                            }
                            disabled={isSaving || isDeleting || Boolean(croppingTarget)}
                            className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            Try with margin
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              updateArticleField(article._id, 'coverImagePath', '');
                              clearCropOcrMessage(articleOcrTarget);
                            }}
                            className="rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                          >
                            Clear crop
                          </button>
                        </div>
                        {cropOcrMessages[articleOcrTarget] ? (
                          <p className="border-t border-gray-200 bg-white px-3 py-2 text-[11px] font-semibold text-gray-600">
                            {cropOcrMessages[articleOcrTarget]}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    <textarea
                      rows={4}
                      value={article.contentHtml || ''}
                      onChange={(event) =>
                        updateArticleField(article._id, 'contentHtml', event.target.value)
                      }
                      placeholder="Clean Hindi body"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                    />
                  </div>

                  <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Volume2 className="h-4 w-4 text-primary-600" />
                          <p className="text-sm font-semibold text-gray-900">Story Listen Audio</p>
                        </div>
                        <p className="mt-1 text-xs text-gray-700">
                          {storyTtsNeedsSave
                            ? 'Save this story first. Listen audio follows the last saved title and readable text.'
                            : storyTtsStatus === 'ready'
                              ? 'Reusable story listen audio is ready.'
                              : storyTtsStatus === 'failed'
                                ? 'The last story listen-audio generation failed. Try again.'
                                : storyTtsStatus === 'stale'
                                  ? 'The saved story listen-audio asset needs regeneration.'
                                  : storyTtsStatus === 'disabled'
                                    ? 'Add an excerpt or article text, then save before generating.'
                                    : 'No reusable story listen audio is ready yet for the current saved text.'}
                        </p>
                        {storyTts?.asset?.generatedAt ? (
                          <p className="mt-1 text-xs text-gray-500">
                            Last generated: {storyTts.asset.generatedAt}
                          </p>
                        ) : null}
                        {storyTts?.asset?.voice || storyTts?.asset?.model ? (
                          <p className="mt-1 text-xs text-gray-500">
                            {[storyTts?.asset?.voice, storyTts?.asset?.model].filter(Boolean).join(' | ')}
                          </p>
                        ) : null}
                        {storyTts?.asset?.lastError ? (
                          <p className="mt-1 text-xs text-amber-700">{storyTts.asset.lastError}</p>
                        ) : null}
                        {storyTts?.asset?.audioUrl ? (
                          <a
                            href={storyTts.asset.audioUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 block truncate text-xs font-medium text-primary-700 hover:underline"
                          >
                            {storyTts.asset.audioUrl}
                          </a>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 ${
                          isSaving || isDeleting || isLoadingTts ? 'pointer-events-none opacity-70' : ''
                        }`}>
                          {isLoadingTts ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UploadCloud className="h-3.5 w-3.5" />
                          )}
                          Upload Audio
                          <input
                            type="file"
                            accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4"
                            disabled={isSaving || isDeleting || isLoadingTts}
                            onChange={(event) => {
                              const file = event.target.files?.[0] || null;
                              event.currentTarget.value = '';
                              void uploadManualStoryAudio(article, file);
                            }}
                            className="sr-only"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void regenerateStoryTts(article)}
                          disabled={isSaving || isDeleting || isLoadingTts || storyTtsNeedsSave || !storyHasReadableText}
                          className="inline-flex items-center gap-1.5 rounded-md border border-primary-200 bg-white px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isLoadingTts ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                          {storyTts?.asset?.audioUrl ? 'Regenerate Audio' : 'Generate Audio'}
                        </button>
                      </div>
                    </div>
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
