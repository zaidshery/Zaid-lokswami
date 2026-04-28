'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MoreHorizontal,
  MessageSquare,
  Volume2,
  Save,
  Trash2,
  UploadCloud,
  PencilRuler,
} from 'lucide-react';
import DateInputField from '@/components/ui/DateInputField';
import { getAuthHeader } from '@/lib/auth/clientToken';
import type {
  EPaperArticleRecord,
  EPaperPageReviewStatus,
  EPaperRecord,
} from '@/lib/types/epaper';
import { formatUiDate, formatUiDateTime } from '@/lib/utils/dateFormat';
import { buildEpaperEditionQualitySummary } from '@/lib/utils/epaperQualitySignals';
import { getAllowedEpaperProductionTransitions } from '@/lib/workflow/transitions';
import type { EPaperProductionStatus } from '@/lib/workflow/types';

type EpaperResponse = {
  success: boolean;
  error?: string;
  data?: EPaperRecord & { articleCount?: number };
};

type ArticlesResponse = {
  success: boolean;
  error?: string;
  data?: EPaperArticleRecord[];
};

type TeamOptionsResponse = {
  success?: boolean;
  error?: string;
  data?: AssignableUserOption[];
};

type ProductionActivityResponse = {
  success?: boolean;
  error?: string;
  data?: ProductionActivityItem[];
};

type TtsStatus = 'pending' | 'ready' | 'failed' | 'stale';

type TtsAssetRecord = {
  _id: string;
  sourceId: string;
  sourceParentId?: string;
  variant: 'epaper_story';
  status: TtsStatus;
  audioUrl?: string;
  lastError?: string;
};

type TtsAssetsResponse = {
  success?: boolean;
  data?: {
    assets?: TtsAssetRecord[];
  };
};

type AssignableUserOption = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type ProductionActivityItem = {
  id?: string;
  action?: string;
  message?: string;
  createdAt?: string | null;
  source?: 'audit' | 'derived';
  actor?: {
    name?: string;
    email?: string;
    role?: string | null;
  } | null;
  toStatus?: string | null;
};

type PageFilter = 'all' | 'needs-work' | 'missing-image' | 'missing-hotspots' | 'pending-qa';

const PRODUCTION_ACTION_LABELS: Partial<Record<EPaperProductionStatus, string>> = {
  pages_ready: 'Mark Pages Ready',
  ocr_review: 'Start OCR Review',
  hotspot_mapping: 'Move To Hotspot Mapping',
  qa_review: 'Move To QA Review',
  ready_to_publish: 'Mark Ready To Publish',
  published: 'Publish Edition',
  archived: 'Archive Edition',
};

const EPAPER_WORKFLOW_STEPS: EPaperProductionStatus[] = [
  'draft_upload',
  'pages_ready',
  'ocr_review',
  'hotspot_mapping',
  'qa_review',
  'ready_to_publish',
  'published',
];

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

function editionStatusTone(status: string | null | undefined) {
  return status === 'published'
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-slate-100 text-slate-700';
}

function pageChipTone(kind: 'good' | 'warn' | 'danger' | 'neutral' | 'publish') {
  switch (kind) {
    case 'good':
      return 'bg-emerald-100 text-emerald-700';
    case 'warn':
      return 'bg-amber-100 text-amber-700';
    case 'danger':
      return 'bg-red-100 text-red-700';
    case 'publish':
      return 'bg-blue-100 text-blue-700';
    case 'neutral':
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

export default function AdminEPaperDetailPage() {
  const params = useParams();
  const router = useRouter();
  const epaperId = String(params.id || '');

  const [epaper, setEpaper] = useState<EPaperRecord | null>(null);
  const [articles, setArticles] = useState<EPaperArticleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);
  const [uploadingPage, setUploadingPage] = useState<number | null>(null);
  const [generatingPages, setGeneratingPages] = useState(false);
  const [runningOcrAutomation, setRunningOcrAutomation] = useState(false);
  const [runningTtsTarget, setRunningTtsTarget] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [epaperTtsByStoryId, setEpaperTtsByStoryId] = useState<Record<string, TtsAssetRecord>>({});

  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [publishDate, setPublishDate] = useState('');
  const [productionStatus, setProductionStatus] =
    useState<EPaperProductionStatus>('draft_upload');
  const [productionAssigneeId, setProductionAssigneeId] = useState('');
  const [productionNote, setProductionNote] = useState('');
  const [productionActivity, setProductionActivity] = useState<ProductionActivityItem[]>([]);
  const [isUpdatingProduction, setIsUpdatingProduction] = useState(false);
  const [isLoadingProductionActivity, setIsLoadingProductionActivity] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUserOption[]>([]);
  const [isLoadingAssignableUsers, setIsLoadingAssignableUsers] = useState(false);
  const [selectedPageNumbers, setSelectedPageNumbers] = useState<number[]>([]);
  const [pageFilter, setPageFilter] = useState<PageFilter>('all');
  const [bulkReviewStatus, setBulkReviewStatus] = useState<EPaperPageReviewStatus>('ready');
  const [bulkReviewNote, setBulkReviewNote] = useState('');
  const [isApplyingBulkReview, setIsApplyingBulkReview] = useState(false);

  const loadEpaperTtsAssets = useCallback(async () => {
    if (!epaperId) {
      setEpaperTtsByStoryId({});
      return;
    }

    try {
      const params = new URLSearchParams({
        sourceType: 'epaperArticle',
        sourceParentId: epaperId,
        variant: 'epaper_story',
        limit: 'all',
      });
      const response = await fetch(`/api/admin/tts/assets?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = (await response.json().catch(() => ({}))) as TtsAssetsResponse;
      if (!response.ok || !data.success || !Array.isArray(data.data?.assets)) {
        return;
      }

      const nextMap: Record<string, TtsAssetRecord> = {};
      for (const asset of data.data.assets) {
        if (!nextMap[asset.sourceId]) {
          nextMap[asset.sourceId] = asset;
        }
      }
      setEpaperTtsByStoryId(nextMap);
    } catch {
      // Keep e-paper admin usable even if TTS overview fails to load.
    }
  }, [epaperId]);

  const loadAssignableUsers = useCallback(async () => {
    if (!epaperId) {
      setAssignableUsers([]);
      return;
    }

    setIsLoadingAssignableUsers(true);
    try {
      const response = await fetch('/api/admin/team/options', {
        headers: { ...getAuthHeader() },
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => ({}))) as TeamOptionsResponse;

      if (!response.ok || !payload.success || !Array.isArray(payload.data)) {
        throw new Error(payload.error || 'Failed to load assignable team members');
      }

      setAssignableUsers(payload.data);
    } catch {
      setAssignableUsers([]);
    } finally {
      setIsLoadingAssignableUsers(false);
    }
  }, [epaperId]);

  const loadProductionActivity = useCallback(async () => {
    if (!epaperId) {
      setProductionActivity([]);
      return;
    }

    setIsLoadingProductionActivity(true);
    try {
      const response = await fetch(`/api/admin/epapers/${epaperId}/activity`, {
        headers: { ...getAuthHeader() },
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => ({}))) as ProductionActivityResponse;

      if (!response.ok || !payload.success || !Array.isArray(payload.data)) {
        throw new Error(payload.error || 'Failed to load e-paper activity');
      }

      setProductionActivity(payload.data);
    } catch {
      setProductionActivity([]);
    } finally {
      setIsLoadingProductionActivity(false);
    }
  }, [epaperId]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [epaperRes, articlesRes] = await Promise.all([
        fetch(`/api/admin/epapers/${epaperId}`, {
          headers: { ...getAuthHeader() },
        }),
        fetch(`/api/admin/epapers/${epaperId}/articles`, {
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
      setTitle(epaperPayload.data.title || '');
      setStatus(epaperPayload.data.status || 'draft');
      setPublishDate(epaperPayload.data.publishDate || '');
      setProductionStatus(epaperPayload.data.productionStatus || 'draft_upload');
      setProductionAssigneeId(epaperPayload.data.productionAssignee?.id || '');
      await Promise.all([loadEpaperTtsAssets(), loadProductionActivity()]);
    } catch (err: unknown) {
      setError(toErrorMessage(err, 'Failed to load e-paper'));
      setEpaper(null);
      setArticles([]);
      setEpaperTtsByStoryId({});
      setProductionActivity([]);
    } finally {
      setLoading(false);
    }
  }, [epaperId, loadEpaperTtsAssets, loadProductionActivity]);

  useEffect(() => {
    if (!epaperId) return;
    void fetchData();
  }, [epaperId, fetchData]);

  useEffect(() => {
    if (!epaperId) return;
    void loadAssignableUsers();
  }, [epaperId, loadAssignableUsers]);

  useEffect(() => {
    if (!epaper) {
      setSelectedPageNumbers([]);
      return;
    }

    const validPages = new Set(
      Array.from({ length: Math.max(1, epaper.pageCount) }, (_, index) => index + 1)
    );
    setSelectedPageNumbers((current) =>
      current.filter((pageNumber) => validPages.has(pageNumber))
    );
  }, [epaper]);

  const hotspotsByPage = useMemo(() => {
    const map = new Map<number, number>();
    for (const article of articles) {
      const page = Number(article.pageNumber || 0);
      if (!page) continue;
      map.set(page, (map.get(page) || 0) + 1);
    }
    return map;
  }, [articles]);

  const ttsSummary = useMemo(() => {
    let eligible = 0;
    let ready = 0;
    let stale = 0;
    let failed = 0;

    for (const article of articles) {
      const hasReadableText = Boolean(
        String(article.contentHtml || '').trim() || String(article.excerpt || '').trim()
      );
      if (!hasReadableText) continue;

      eligible += 1;
      const asset = epaperTtsByStoryId[article._id];
      if (asset?.status === 'ready' && asset.audioUrl) {
        ready += 1;
      } else if (asset?.status === 'stale') {
        stale += 1;
      } else if (asset?.status === 'failed') {
        failed += 1;
      }
    }

    return {
      eligible,
      ready,
      stale,
      failed,
      missing: Math.max(0, eligible - ready - stale - failed),
    };
  }, [articles, epaperTtsByStoryId]);

  const ttsByPage = useMemo(() => {
    const map = new Map<number, { eligible: number; ready: number }>();
    for (const article of articles) {
      const page = Number(article.pageNumber || 0);
      if (!page) continue;

      const hasReadableText = Boolean(
        String(article.contentHtml || '').trim() || String(article.excerpt || '').trim()
      );
      const current = map.get(page) || { eligible: 0, ready: 0 };
      if (hasReadableText) {
        current.eligible += 1;
        const asset = epaperTtsByStoryId[article._id];
        if (asset?.status === 'ready' && asset.audioUrl) {
          current.ready += 1;
        }
      }
      map.set(page, current);
    }
    return map;
  }, [articles, epaperTtsByStoryId]);

  const editionQualitySummary = useMemo(() => {
    if (!epaper) {
      return buildEpaperEditionQualitySummary({
        pageCount: 1,
        pages: [],
        articles: [],
      });
    }

    return buildEpaperEditionQualitySummary({
      pageCount: epaper.pageCount,
      pages: epaper.pages,
      articles,
    });
  }, [articles, epaper]);

  const saveMeta = async () => {
    if (!epaper) return;
    setSavingMeta(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`/api/admin/epapers/${epaper._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          title: title.trim(),
          status,
          publishDate,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to save metadata');
      }

      setNotice('E-paper metadata updated');
      await fetchData();
    } catch (err: unknown) {
      setError(toErrorMessage(err, 'Failed to save metadata'));
    } finally {
      setSavingMeta(false);
    }
  };

  const onPageImageUpload = async (pageNumber: number, file: File | null) => {
    if (!epaper || !file) return;

    setUploadingPage(pageNumber);
    setError('');
    setNotice('');

    try {
      const body = new FormData();
      body.append('pageNumber', String(pageNumber));
      body.append('image', file);

      const response = await fetch(`/api/admin/epapers/${epaper._id}/pages`, {
        method: 'PUT',
        headers: {
          ...getAuthHeader(),
        },
        body,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to upload page image');
      }

      setNotice(`Page ${pageNumber} image updated`);
      await fetchData();
    } catch (err: unknown) {
      setError(toErrorMessage(err, 'Failed to upload page image'));
    } finally {
      setUploadingPage(null);
    }
  };

  const deletePaper = async () => {
    if (!epaper) return;
    setDeleting(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/epapers/${epaper._id}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeader(),
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to delete e-paper');
      }
      router.push('/admin/epapers');
    } catch (err: unknown) {
      setError(toErrorMessage(err, 'Failed to delete e-paper'));
      setDeleting(false);
    }
  };

  const generatePageImages = async () => {
    if (!epaper) return;
    setGeneratingPages(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(
        `/api/admin/epapers/${epaper._id}/generate-page-images`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
          },
          body: JSON.stringify({ pageCount: epaper.pageCount }),
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to generate page images');
      }

      if (payload?.warning) {
        setNotice(String(payload.warning));
      } else {
        setNotice('Page images generated successfully');
      }
      await fetchData();
    } catch (err: unknown) {
      setError(toErrorMessage(err, 'Failed to generate page images'));
    } finally {
      setGeneratingPages(false);
    }
  };

  const generateStoryAudio = async (pageNumber?: number) => {
    if (!epaper) return;

    const target = pageNumber ? `page-${pageNumber}` : 'all';
    setRunningTtsTarget(target);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`/api/admin/epapers/${epaper._id}/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          ...(pageNumber ? { pageNumber } : {}),
          forceRegenerate: true,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        data?: {
          result?: {
            processed?: number;
            ready?: number;
            failed?: number;
            skipped?: number;
          };
        };
      };

      if (!response.ok || !payload.success || !payload.data?.result) {
        throw new Error(payload.error || 'Failed to generate story audio');
      }

      const result = payload.data.result;
      setNotice(
        pageNumber
          ? `Page ${pageNumber} story audio updated. ${result.ready || 0} ready, ${result.failed || 0} failed, ${result.skipped || 0} skipped.`
          : `Edition story audio updated. ${result.ready || 0} ready, ${result.failed || 0} failed, ${result.skipped || 0} skipped.`
      );
      await loadEpaperTtsAssets();
    } catch (err: unknown) {
      setError(toErrorMessage(err, 'Failed to generate story audio'));
    } finally {
      setRunningTtsTarget('');
    }
  };

  const runOcrAutomation = async (pageNumbersToProcess: number[] = []) => {
    if (!epaper) return;

    setRunningOcrAutomation(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`/api/admin/epapers/${epaper._id}/ocr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          pageNumbers: pageNumbersToProcess,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        message?: string;
        data?: {
          storiesCreated?: number;
          pagesFailed?: number;
          audioReady?: number;
        };
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to run OCR automation');
      }

      setNotice(
        `${pageNumbersToProcess.length ? `Selected page OCR finished. ` : ''}${payload.message || 'OCR automation finished'} ${
          payload.data?.audioReady
            ? `${payload.data.audioReady} story audio file${payload.data.audioReady === 1 ? '' : 's'} ready.`
            : ''
        }${payload.data?.pagesFailed ? ` ${payload.data.pagesFailed} page(s) need manual OCR review.` : ''}`.trim()
      );
      await fetchData();
    } catch (err: unknown) {
      setError(toErrorMessage(err, 'Failed to run OCR automation'));
    } finally {
      setRunningOcrAutomation(false);
    }
  };

  const updateProductionDesk = async (nextStatus?: EPaperProductionStatus) => {
    if (!epaper) return;

    setIsUpdatingProduction(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`/api/admin/epapers/${epaper._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          ...(nextStatus ? { productionStatus: nextStatus } : {}),
          assignedToId: productionAssigneeId,
          note: productionNote.trim(),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as EpaperResponse & {
        message?: string;
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || 'Failed to update e-paper production');
      }

      setEpaper(payload.data);
      setProductionStatus(payload.data.productionStatus || 'draft_upload');
      setProductionAssigneeId(payload.data.productionAssignee?.id || '');
      setProductionNote('');
      setNotice(payload.message || 'E-paper production updated');
      await loadProductionActivity();
    } catch (err: unknown) {
      setError(toErrorMessage(err, 'Failed to update e-paper production'));
    } finally {
      setIsUpdatingProduction(false);
    }
  };

  const toggleSelectedPage = (pageNumber: number) => {
    setSelectedPageNumbers((current) =>
      current.includes(pageNumber)
        ? current.filter((value) => value !== pageNumber)
        : [...current, pageNumber].sort((left, right) => left - right)
    );
  };

  const toggleSelectAllPages = (pageNumbers: number[]) => {
    setSelectedPageNumbers((current) =>
      current.length === pageNumbers.length ? [] : pageNumbers
    );
  };

  const applyBulkPageReview = async () => {
    if (!epaper || selectedPageNumbers.length === 0) {
      setError('Select at least one page first.');
      return;
    }

    if (bulkReviewStatus === 'needs_attention' && !bulkReviewNote.trim()) {
      setError('Add a reviewer note before marking pages as needing attention.');
      return;
    }

    setIsApplyingBulkReview(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`/api/admin/epapers/${epaper._id}/pages`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          pages: selectedPageNumbers.map((pageNumber) => ({
            pageNumber,
            reviewStatus: bulkReviewStatus,
            reviewNote: bulkReviewNote.trim(),
          })),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to update selected pages');
      }

      setNotice(
        `Updated ${selectedPageNumbers.length} page${
          selectedPageNumbers.length === 1 ? '' : 's'
        } to ${formatPageReviewStatusLabel(bulkReviewStatus)}.`
      );
      setBulkReviewNote('');
      setSelectedPageNumbers([]);
      await fetchData();
    } catch (err: unknown) {
      setError(toErrorMessage(err, 'Failed to update selected pages'));
    } finally {
      setIsApplyingBulkReview(false);
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
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || 'E-paper not found'}
        </div>
      </div>
    );
  }

  const pages = editionQualitySummary.pageSignals.map(({ pageNumber, page, quality }) => ({
    pageNumber,
    page,
    quality,
    hotspotCount: hotspotsByPage.get(pageNumber) || 0,
    tts: ttsByPage.get(pageNumber) || { eligible: 0, ready: 0 },
  }));
  const pageReviewSummary = {
    ready: editionQualitySummary.counts.readyQa,
    needsAttention: editionQualitySummary.counts.needsAttentionQa,
    pending: editionQualitySummary.counts.pendingQa,
  };
  const pageQualitySummary = {
    good: editionQualitySummary.counts.good,
    watch: editionQualitySummary.counts.watch,
    critical: editionQualitySummary.counts.critical,
    lowTextPages: editionQualitySummary.counts.lowTextPages,
  };
  const readiness = epaper.readiness;
  const automation = epaper.automation;
  const activeProductionStatus = productionStatus || epaper.productionStatus || 'draft_upload';
  const allowedProductionTransitions = getAllowedEpaperProductionTransitions(activeProductionStatus);
  const publishBlockers = Array.from(
    new Set([...(readiness?.blockers || []), ...editionQualitySummary.publishBlockers])
  );
  const hasDeskChanges =
    productionNote.trim().length > 0 ||
    productionAssigneeId !== String(epaper.productionAssignee?.id || '');
  const pageCoverage = readiness?.pageImageCoveragePercent ?? 0;
  const hotspotCoverage = readiness?.hotspotCoveragePercent ?? 0;
  const textCoverage = readiness?.textCoveragePercent ?? 0;
  const pageNumbers = pages.map((entry) => entry.pageNumber);
  const allPagesSelected = pageNumbers.length > 0 && selectedPageNumbers.length === pageNumbers.length;
  const missingImagePages = new Set(readiness?.missingImagePages || []);
  const missingHotspotPages = new Set(readiness?.missingHotspotPages || []);
  const visiblePages = pages.filter(({ pageNumber, page, quality }) => {
    if (pageFilter === 'missing-image') return missingImagePages.has(pageNumber);
    if (pageFilter === 'missing-hotspots') return missingHotspotPages.has(pageNumber);
    if (pageFilter === 'pending-qa') return (page?.reviewStatus || 'pending') === 'pending';
    if (pageFilter === 'needs-work') {
      return (
        quality.level !== 'good' ||
        missingImagePages.has(pageNumber) ||
        missingHotspotPages.has(pageNumber) ||
        (page?.reviewStatus || 'pending') !== 'ready'
      );
    }
    return true;
  });
  const pageFilterOptions: Array<{
    value: PageFilter;
    label: string;
    count: number;
  }> = [
    { value: 'all', label: 'All', count: pages.length },
    {
      value: 'needs-work',
      label: 'Needs Work',
      count: pages.filter(
        ({ pageNumber, page, quality }) =>
          quality.level !== 'good' ||
          missingImagePages.has(pageNumber) ||
          missingHotspotPages.has(pageNumber) ||
          (page?.reviewStatus || 'pending') !== 'ready'
      ).length,
    },
    { value: 'missing-image', label: 'Missing Image', count: missingImagePages.size },
    { value: 'missing-hotspots', label: 'No Hotspots', count: missingHotspotPages.size },
    {
      value: 'pending-qa',
      label: 'Pending QA',
      count: pages.filter(({ page }) => (page?.reviewStatus || 'pending') === 'pending').length,
    },
  ];

  return (
    <div className="epaper-production-desk min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/admin/epapers"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to E-Papers
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/ai?ttsVariant=epaper_story&ttsSourceType=epaperArticle&ttsSourceParentId=${encodeURIComponent(String(epaper._id || ''))}`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100"
            >
              <Volume2 className="h-3.5 w-3.5" />
              TTS Ops
            </Link>
            <a
              href={`/api/public/epapers/${encodeURIComponent(String(epaper._id || ''))}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
            >
              Open PDF
            </a>
          </div>
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

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(300px,1fr)]">
          <main className="order-2 min-w-0 space-y-4 xl:order-1">
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Edition workspace
                  </p>
                  <h1 className="mt-2 break-words text-2xl font-bold text-gray-900">
                    {epaper.title}
                  </h1>
                  <p className="mt-1 text-sm text-gray-600">
                    {epaper.cityName} ({epaper.citySlug}) |{' '}
                    {formatUiDate(epaper.publishDate, epaper.publishDate)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${editionStatusTone(
                      epaper.status
                    )}`}
                  >
                    {epaper.status === 'published' ? 'Published' : 'Draft'}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${productionTone(
                      activeProductionStatus
                    )}`}
                  >
                    {formatProductionStatusLabel(activeProductionStatus)}
                  </span>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto pb-1">
                <div className="flex min-w-max items-center gap-2">
                  {EPAPER_WORKFLOW_STEPS.map((step, index) => {
                    const activeIndex = EPAPER_WORKFLOW_STEPS.indexOf(activeProductionStatus);
                    const isCurrent = step === activeProductionStatus;
                    const isComplete =
                      activeIndex >= 0 && index < activeIndex && activeProductionStatus !== 'archived';
                    return (
                      <div key={step} className="flex items-center gap-2">
                        <div
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${
                            isCurrent
                              ? 'border-primary-200 bg-primary-50 text-primary-700'
                              : isComplete
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-gray-200 bg-gray-50 text-gray-600'
                          }`}
                        >
                          {isComplete ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                          {formatProductionStatusLabel(step)}
                        </div>
                        {index < EPAPER_WORKFLOW_STEPS.length - 1 ? (
                          <div className="h-px w-5 bg-gray-200" />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Batch actions
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    Manage page generation, audio, selection, and review state from one place.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void generatePageImages()}
                    disabled={generatingPages || automation?.pageImageGenerationAvailable === false}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
                    title={
                      automation?.pageImageGenerationReason ||
                      'Requires EPAPER_ENABLE_PAGE_IMAGE_GENERATION=1 and server converter binary'
                    }
                  >
                    {generatingPages ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UploadCloud className="h-3.5 w-3.5" />
                    )}
                    Generate Images
                  </button>
                  <button
                    type="button"
                    onClick={() => void generateStoryAudio()}
                    disabled={runningTtsTarget !== ''}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {runningTtsTarget === 'all' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Volume2 className="h-3.5 w-3.5" />
                    )}
                    Generate Audio
                  </button>
                  <button
                    type="button"
                    onClick={() => void runOcrAutomation()}
                    disabled={runningOcrAutomation}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {runningOcrAutomation ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <PencilRuler className="h-3.5 w-3.5" />
                    )}
                    Run OCR
                  </button>
                  <button
                    type="button"
                    onClick={() => void runOcrAutomation(selectedPageNumbers)}
                    disabled={runningOcrAutomation || selectedPageNumbers.length === 0}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {runningOcrAutomation ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <PencilRuler className="h-3.5 w-3.5" />
                    )}
                    OCR Selected
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSelectAllPages(pageNumbers)}
                    className="inline-flex min-h-10 items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    {allPagesSelected ? 'Clear Selection' : 'Select All'}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[180px_minmax(0,1fr)_auto]">
                <label>
                  <span className="mb-1 block text-xs font-semibold text-gray-600">
                    Review status
                  </span>
                  <select
                    value={bulkReviewStatus}
                    onChange={(event) =>
                      setBulkReviewStatus(event.target.value as EPaperPageReviewStatus)
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                    disabled={isApplyingBulkReview}
                  >
                    <option value="pending">Pending</option>
                    <option value="needs_attention">Needs attention</option>
                    <option value="ready">Ready</option>
                  </select>
                </label>

                <label>
                  <span className="mb-1 block text-xs font-semibold text-gray-600">
                    Shared reviewer note
                  </span>
                  <textarea
                    value={bulkReviewNote}
                    onChange={(event) => setBulkReviewNote(event.target.value)}
                    rows={2}
                    placeholder="Applied to every selected page."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                    disabled={isApplyingBulkReview}
                  />
                </label>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => void applyBulkPageReview()}
                    disabled={isApplyingBulkReview || selectedPageNumbers.length === 0}
                    className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-md bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70 lg:w-auto"
                  >
                    {isApplyingBulkReview ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    Apply To {selectedPageNumbers.length || 0}
                  </button>
                </div>
              </div>

              <p className="mt-3 text-xs text-gray-500">
                Selected pages:{' '}
                {selectedPageNumbers.length > 0 ? selectedPageNumbers.join(', ') : 'none'}
              </p>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Edition pages
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-gray-900">
                    {epaper.pageCount} pages
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Click any page card to open page editing and OCR/hotspot review.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <p className="font-bold text-emerald-700">{pageQualitySummary.good}</p>
                    <p className="text-gray-500">Healthy</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <p className="font-bold text-amber-700">{pageQualitySummary.watch}</p>
                    <p className="text-gray-500">Watch</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <p className="font-bold text-red-700">{pageQualitySummary.critical}</p>
                    <p className="text-gray-500">Recheck</p>
                  </div>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                {pageFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPageFilter(option.value)}
                    className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      pageFilter === option.value
                        ? 'border-primary-200 bg-primary-50 text-primary-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {option.label}
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
                      {option.count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {visiblePages.map(({ pageNumber, page, hotspotCount, tts, quality }) => {
                  const hasImage = Boolean(page?.imagePath);
                  const isUploading = uploadingPage === pageNumber;
                  const isSelected = selectedPageNumbers.includes(pageNumber);
                  const editHref = `/admin/epapers/${epaper._id}/page/${pageNumber}`;
                  const statusChips = [
                    {
                      label: hasImage ? 'Uploaded' : 'Image Missing',
                      tone: hasImage ? 'good' : 'danger',
                    },
                    quality.mappedStories > 0 && quality.unreadableStories === 0
                      ? { label: 'OCR Ready', tone: 'good' }
                      : { label: 'Needs Review', tone: quality.level === 'critical' ? 'danger' : 'warn' },
                    page?.reviewStatus === 'pending' || !page?.reviewStatus
                      ? { label: 'Pending QA', tone: 'warn' }
                      : {
                          label: formatPageReviewStatusLabel(page.reviewStatus),
                          tone: page.reviewStatus === 'ready' ? 'good' : 'danger',
                        },
                    epaper.status === 'published'
                      ? { label: 'Published', tone: 'publish' }
                      : null,
                  ].filter(Boolean) as Array<{
                    label: string;
                    tone: 'good' | 'warn' | 'danger' | 'neutral' | 'publish';
                  }>;

                  return (
                    <article
                      key={pageNumber}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (hasImage) {
                          router.push(editHref);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (hasImage && (event.key === 'Enter' || event.key === ' ')) {
                          event.preventDefault();
                          router.push(editHref);
                        }
                      }}
                      className={`group flex min-h-full cursor-pointer flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                        isSelected
                          ? 'border-primary-300 ring-2 ring-primary-100'
                          : 'border-gray-200'
                      } ${!hasImage ? 'cursor-default' : ''}`}
                    >
                      <div className="relative aspect-[3/4] bg-gray-100">
                        {page?.imagePath ? (
                          <Image
                            src={page.imagePath}
                            alt={`Page ${pageNumber}`}
                            fill
                            unoptimized
                            className="object-contain"
                            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 45vw, 22vw"
                          />
                        ) : (
                          <div className="flex h-full flex-col items-center justify-center px-5 text-center text-sm text-gray-500">
                            <UploadCloud className="mb-2 h-7 w-7 text-gray-400" />
                            Page image missing
                          </div>
                        )}
                        <div className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-gray-900 shadow-sm">
                          Page {pageNumber}
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col p-4">
                        <div className="flex items-start justify-between gap-2">
                          <label
                            className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectedPage(pageNumber)}
                              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            Select
                          </label>

                          <details
                            className="relative"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <summary className="flex min-h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 [&::-webkit-details-marker]:hidden">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Page actions</span>
                            </summary>
                            <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-gray-200 bg-white p-2 text-xs shadow-lg">
                              <Link
                                href={editHref}
                                className={`block rounded-md px-3 py-2 font-semibold hover:bg-gray-100 ${
                                  hasImage ? 'text-gray-700' : 'pointer-events-none text-gray-400'
                                }`}
                                aria-disabled={!hasImage}
                              >
                                View / Edit page
                              </Link>
                              <Link
                                href={editHref}
                                className={`block rounded-md px-3 py-2 font-semibold hover:bg-gray-100 ${
                                  hasImage ? 'text-gray-700' : 'pointer-events-none text-gray-400'
                                }`}
                                aria-disabled={!hasImage}
                              >
                                OCR / hotspot review
                              </Link>
                              <label className="block cursor-pointer rounded-md px-3 py-2 font-semibold text-gray-700 hover:bg-gray-100">
                                {isUploading ? 'Uploading...' : 'Replace image'}
                                <input
                                  type="file"
                                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                                  className="hidden"
                                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                                    const file = event.target.files?.[0] || null;
                                    void onPageImageUpload(pageNumber, file);
                                    event.target.value = '';
                                  }}
                                  disabled={isUploading}
                                />
                              </label>
                              <button
                                type="button"
                                onClick={() => void generateStoryAudio(pageNumber)}
                                disabled={runningTtsTarget !== '' || tts.eligible === 0}
                                className="block w-full rounded-md px-3 py-2 text-left font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400"
                              >
                                {runningTtsTarget === `page-${pageNumber}`
                                  ? 'Generating audio...'
                                  : 'Generate page audio'}
                              </button>
                            </div>
                          </details>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {statusChips.map((chip) => (
                            <span
                              key={`${pageNumber}-${chip.label}`}
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${pageChipTone(
                                chip.tone
                              )}`}
                            >
                              {chip.label}
                            </span>
                          ))}
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-gray-600">
                          <div>
                            <p className="font-semibold text-gray-900">{hotspotCount}</p>
                            <p>Hotspots</p>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {quality.textCoveragePercent}%
                            </p>
                            <p>Text</p>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {tts.ready}/{tts.eligible}
                            </p>
                            <p>Audio</p>
                          </div>
                        </div>

                        {quality.issues[0] ? (
                          <p className="mt-3 line-clamp-2 text-xs text-gray-600">
                            {quality.issues[0]}
                          </p>
                        ) : (
                          <p className="mt-3 text-xs text-gray-500">
                            Page is clear enough for the next desk check.
                          </p>
                        )}

                        {page?.reviewNote ? (
                          <p className="mt-2 line-clamp-2 text-xs text-gray-500">
                            Note: {page.reviewNote}
                          </p>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
              {visiblePages.length === 0 ? (
                <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
                  No pages match this filter.
                </div>
              ) : null}
            </section>
          </main>

          <aside className="order-1 min-w-0 space-y-4 xl:order-2">
            <div className="xl:sticky xl:top-6 xl:space-y-4">
              <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="bg-gray-50">
                  {epaper.thumbnailPath ? (
                    <div className="relative aspect-[3/4] max-h-[520px] w-full">
                      <Image
                        src={epaper.thumbnailPath}
                        alt={epaper.title}
                        fill
                        unoptimized
                        className="object-contain"
                        sizes="(max-width: 1280px) 100vw, 25vw"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-[3/4] items-center justify-center text-sm text-gray-500">
                      No cover preview
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Cover preview
                  </p>
                  <h2 className="mt-2 break-words text-lg font-bold text-gray-900">
                    {epaper.title}
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {formatUiDate(epaper.publishDate, epaper.publishDate)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${editionStatusTone(
                        status
                      )}`}
                    >
                      {status === 'published' ? 'Published' : 'Draft'}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${productionTone(
                        activeProductionStatus
                      )}`}
                    >
                      {formatProductionStatusLabel(activeProductionStatus)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <p className="font-bold text-gray-900">{epaper.pageCount}</p>
                      <p className="text-gray-500">Pages</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <p className="font-bold text-gray-900">{articles.length}</p>
                      <p className="text-gray-500">Stories</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {allowedProductionTransitions.map((nextStatus) => {
                      const isBlockedReadyToPublish =
                        nextStatus === 'ready_to_publish' && publishBlockers.length > 0;

                      return (
                        <button
                          key={nextStatus}
                          type="button"
                          onClick={() => void updateProductionDesk(nextStatus)}
                          disabled={isUpdatingProduction || isBlockedReadyToPublish}
                          className={`inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-70 ${
                            nextStatus === 'published'
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : nextStatus === 'ready_to_publish'
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-primary-600 text-white hover:bg-primary-700'
                          }`}
                        >
                          {isUpdatingProduction ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : nextStatus === 'published' ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <PencilRuler className="h-3.5 w-3.5" />
                          )}
                          {PRODUCTION_ACTION_LABELS[nextStatus] ||
                            formatProductionStatusLabel(nextStatus)}
                        </button>
                      );
                    })}
                    {allowedProductionTransitions.length === 0 ? (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600">
                        No workflow action available.
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:mt-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Quick checks
                </p>
                <div className="mt-4 space-y-3">
                  {[
                    ['Page images', pageCoverage, `${readiness?.pagesWithImage || 0}/${epaper.pageCount}`],
                    ['Hotspots', hotspotCoverage, `${readiness?.pagesWithHotspots || 0}/${epaper.pageCount}`],
                    [
                      'Readable text',
                      textCoverage,
                      `${readiness?.articlesWithReadableText || 0}/${readiness?.mappedArticles || 0}`,
                    ],
                    [
                      'Story audio',
                      ttsSummary.eligible > 0 ? Math.round((ttsSummary.ready / ttsSummary.eligible) * 100) : 0,
                      `${ttsSummary.ready}/${ttsSummary.eligible}`,
                    ],
                  ].map(([label, value, caption]) => (
                    <div key={String(label)}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-gray-700">{label}</span>
                        <span className="text-gray-500">{caption}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-primary-600"
                          style={{ width: `${Number(value)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {publishBlockers.length ? (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    <p className="font-semibold">Publish blockers</p>
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      {publishBlockers.slice(0, 3).map((blocker) => (
                        <li key={blocker}>{blocker}</li>
                      ))}
                    </ul>
                    {readiness?.missingImagePages?.length ? (
                      <button
                        type="button"
                        onClick={() => setPageFilter('missing-image')}
                        className="mt-3 rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-left text-xs font-semibold text-red-700 hover:bg-red-50"
                      >
                        Missing image pages: {readiness.missingImagePages.join(', ')}
                      </button>
                    ) : null}
                    {readiness?.missingHotspotPages?.length ? (
                      <button
                        type="button"
                        onClick={() => setPageFilter('missing-hotspots')}
                        className="mt-2 rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-left text-xs font-semibold text-red-700 hover:bg-red-50"
                      >
                        Missing hotspot pages: {readiness.missingHotspotPages.join(', ')}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
                    <p className="font-semibold">No critical blockers</p>
                    <p className="mt-1">Edition checks are clear for the current stage.</p>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                    <p className="font-bold text-emerald-700">{pageReviewSummary.ready}</p>
                    <p className="text-gray-500">Ready</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                    <p className="font-bold text-amber-700">{pageReviewSummary.pending}</p>
                    <p className="text-gray-500">Pending</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                    <p className="font-bold text-red-700">{pageReviewSummary.needsAttention}</p>
                    <p className="text-gray-500">Issues</p>
                  </div>
                </div>
              </section>

              <section className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:mt-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Workflow actions
                </p>
                <div className="mt-3 space-y-3">
                  <label>
                    <span className="mb-1 block text-xs font-semibold text-gray-600">
                      Production assignee
                    </span>
                    <select
                      value={productionAssigneeId}
                      onChange={(event) => setProductionAssigneeId(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                      disabled={isLoadingAssignableUsers || isUpdatingProduction}
                    >
                      <option value="">Unassigned</option>
                      {assignableUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.role})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span className="mb-1 block text-xs font-semibold text-gray-600">
                      Production note
                    </span>
                    <textarea
                      value={productionNote}
                      onChange={(event) => setProductionNote(event.target.value)}
                      rows={4}
                      placeholder="Capture OCR issues, missing pages, hotspot QA notes, or publish blockers."
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => void updateProductionDesk()}
                    disabled={isUpdatingProduction || !hasDeskChanges}
                    className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isUpdatingProduction ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <MessageSquare className="h-3.5 w-3.5" />
                    )}
                    Save Desk Update
                  </button>
                </div>
              </section>

              <details className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:mt-0">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Metadata
                </summary>
                <div className="mt-3 space-y-3">
                  <label>
                    <span className="mb-1 block text-xs font-semibold text-gray-600">Title</span>
                    <input
                      type="text"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-semibold text-gray-600">
                      Publish Date
                    </span>
                    <DateInputField
                      value={publishDate}
                      onChange={setPublishDate}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-semibold text-gray-600">Status</span>
                    <select
                      value={status}
                      onChange={(event) => setStatus(event.target.value as 'draft' | 'published')}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => void saveMeta()}
                    disabled={savingMeta}
                    className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-md bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {savingMeta ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    Save Metadata
                  </button>
                </div>
              </details>

              <details className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:mt-0">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Diagnostics and activity
                </summary>
                <div className="mt-3 space-y-3">
                  {automation ? (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                      <p>
                        Source:{' '}
                        <span className="font-semibold text-gray-900">
                          {automation.sourceLabel || automation.sourceType}
                        </span>
                      </p>
                      {automation.sourceHost ? <p className="mt-1">Host: {automation.sourceHost}</p> : null}
                      <p className="mt-1">
                        Auto page images:{' '}
                        <span className="font-semibold text-gray-900">
                          {automation.pageImageGenerationAvailable ? 'Available' : 'Manual / blocked'}
                        </span>
                      </p>
                      {automation.pageImageGenerationReason ? (
                        <p className="mt-2">{automation.pageImageGenerationReason}</p>
                      ) : null}
                    </div>
                  ) : null}

                  {readiness?.warnings?.length ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                        Review notes
                      </p>
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-700">
                        {readiness.warnings.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {publishBlockers.length > 1 ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                        All blockers
                      </p>
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-red-700">
                        {publishBlockers.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-gray-700">Activity timeline</p>
                      <button
                        type="button"
                        onClick={() => void loadProductionActivity()}
                        disabled={isLoadingProductionActivity}
                        className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isLoadingProductionActivity ? 'Refreshing...' : 'Refresh'}
                      </button>
                    </div>
                    <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                      {isLoadingProductionActivity ? (
                        <div className="flex items-center justify-center py-8 text-gray-500">
                          <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                      ) : productionActivity.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-600">
                          No production activity yet.
                        </div>
                      ) : (
                        productionActivity.map((item, index) => (
                          <div
                            key={item.id || `${item.action || 'activity'}-${item.createdAt || index}`}
                            className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                          >
                            <p className="text-sm font-semibold text-gray-900">
                              {item.message || formatProductionStatusLabel(item.toStatus)}
                            </p>
                            <p className="mt-1 text-xs text-gray-600">
                              {item.actor?.name || item.actor?.email || 'System'}
                              {item.actor?.role ? ` (${item.actor.role})` : ''}
                            </p>
                            <p className="mt-2 text-[11px] text-gray-500">
                              {formatUiDateTime(
                                item.createdAt,
                                formatUiDate(item.createdAt, '')
                              ) || 'Unknown time'}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void deletePaper()}
                    disabled={deleting}
                    className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {deleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Delete E-Paper
                  </button>
                </div>
              </details>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
