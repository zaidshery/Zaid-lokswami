'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Save,
  Trash2,
  UploadCloud,
  PencilRuler,
} from 'lucide-react';
import DateInputField from '@/components/ui/DateInputField';
import { getAuthHeader } from '@/lib/auth/clientToken';
import type { EPaperArticleRecord, EPaperRecord } from '@/lib/types/epaper';
import { formatUiDate } from '@/lib/utils/dateFormat';

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

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
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
  const [deleting, setDeleting] = useState(false);

  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [publishDate, setPublishDate] = useState('');

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
    } catch (err: unknown) {
      setError(toErrorMessage(err, 'Failed to load e-paper'));
      setEpaper(null);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [epaperId]);

  useEffect(() => {
    if (!epaperId) return;
    void fetchData();
  }, [epaperId, fetchData]);

  const hotspotsByPage = useMemo(() => {
    const map = new Map<number, number>();
    for (const article of articles) {
      const page = Number(article.pageNumber || 0);
      if (!page) continue;
      map.set(page, (map.get(page) || 0) + 1);
    }
    return map;
  }, [articles]);

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

  const pages = Array.from({ length: Math.max(1, epaper.pageCount) }, (_, index) => {
    const pageNumber = index + 1;
    const page = epaper.pages.find((item) => item.pageNumber === pageNumber);
    return {
      pageNumber,
      page,
      hotspotCount: hotspotsByPage.get(pageNumber) || 0,
    };
  });
  const readiness = epaper.readiness;
  const automation = epaper.automation;
  const readinessTone =
    readiness?.status === 'ready'
      ? 'emerald'
      : readiness?.status === 'needs-review'
        ? 'amber'
        : 'red';
  const pageCoverage = readiness?.pageImageCoveragePercent ?? 0;
  const hotspotCoverage = readiness?.hotspotCoveragePercent ?? 0;
  const textCoverage = readiness?.textCoveragePercent ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/admin/epapers"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to E-Papers
        </Link>

        <a
          href={`/api/public/epapers/${encodeURIComponent(String(epaper._id || ''))}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
        >
          Open PDF
        </a>
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

      <div className="mb-5 grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-white p-4 lg:grid-cols-[1fr_320px]">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{epaper.title}</h1>
          <p className="mt-1 text-xs text-gray-600">
            {epaper.cityName} ({epaper.citySlug}) | {formatUiDate(epaper.publishDate, epaper.publishDate)}
          </p>
          <p className="mt-1 text-xs text-gray-600">
            {epaper.pageCount} pages | {articles.length} mapped articles
          </p>

          {readiness ? (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Publish readiness
                  </p>
                  <div
                    className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                      readinessTone === 'emerald'
                        ? 'bg-emerald-100 text-emerald-700'
                        : readinessTone === 'amber'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {readiness.status === 'ready' ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    )}
                    {readiness.status === 'ready'
                      ? 'Ready to publish'
                      : readiness.status === 'needs-review'
                        ? 'Needs review'
                        : 'Not ready'}
                  </div>
                </div>

                {automation ? (
                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
                    <p>
                      Source: <span className="font-semibold text-gray-900">{automation.sourceLabel || automation.sourceType}</span>
                    </p>
                    {automation.sourceHost ? (
                      <p className="mt-1">Host: {automation.sourceHost}</p>
                    ) : null}
                    <p className="mt-1">
                      Auto page images:{' '}
                      <span className="font-semibold text-gray-900">
                        {automation.pageImageGenerationAvailable ? 'Available' : 'Manual / blocked'}
                      </span>
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Page images</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">{pageCoverage}%</p>
                  <p className="mt-1 text-xs text-gray-600">
                    {readiness.pagesWithImage}/{epaper.pageCount} pages ready
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Hotspot coverage</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">{hotspotCoverage}%</p>
                  <p className="mt-1 text-xs text-gray-600">
                    {readiness.pagesWithHotspots}/{epaper.pageCount} pages mapped
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Readable text</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">{textCoverage}%</p>
                  <p className="mt-1 text-xs text-gray-600">
                    {readiness.articlesWithReadableText}/{readiness.mappedArticles} stories readable
                  </p>
                </div>
              </div>

              {readiness.blockers.length > 0 ? (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Blockers</p>
                  <ul className="mt-2 space-y-1 text-sm text-red-700">
                    {readiness.blockers.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {readiness.warnings.length > 0 ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Review notes</p>
                  <ul className="mt-2 space-y-1 text-sm text-amber-700">
                    {readiness.warnings.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {automation?.pageImageGenerationReason ? (
                <p className="mt-3 text-xs text-gray-600">{automation.pageImageGenerationReason}</p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
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
              <span className="mb-1 block text-xs font-semibold text-gray-600">Publish Date</span>
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
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void saveMeta()}
              disabled={savingMeta}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {savingMeta ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </button>

            <button
              type="button"
              onClick={() => void generatePageImages()}
              disabled={generatingPages || automation?.pageImageGenerationAvailable === false}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
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
              Generate Page Images
            </button>

            <button
              type="button"
              onClick={() => void deletePaper()}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete E-Paper
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          {epaper.thumbnailPath ? (
            <div className="relative h-52 w-full">
              <Image
                src={epaper.thumbnailPath}
                alt={epaper.title}
                fill
                unoptimized
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 320px"
              />
            </div>
          ) : (
            <div className="flex h-52 items-center justify-center text-sm text-gray-500">
              No thumbnail
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {pages.map(({ pageNumber, page, hotspotCount }) => {
          const hasImage = Boolean(page?.imagePath);
          const isUploading = uploadingPage === pageNumber;
          return (
            <div
              key={pageNumber}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Page {pageNumber}</h3>
                  <p className="mt-1 text-xs text-gray-600">
                    {hasImage ? 'Image available' : 'Image missing'} | {hotspotCount} hotspots
                  </p>
                </div>
                <Link
                  href={`/admin/epapers/${epaper._id}/page/${pageNumber}`}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${
                    hasImage
                      ? 'border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100'
                      : 'cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-500'
                  }`}
                  aria-disabled={!hasImage}
                  onClick={(event) => {
                    if (!hasImage) event.preventDefault();
                  }}
                >
                  <PencilRuler className="h-3.5 w-3.5" />
                  Edit Hotspots
                </Link>
              </div>

              {page?.imagePath ? (
                <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                  <Image
                    src={page.imagePath}
                    alt={`Page ${pageNumber}`}
                    width={page.width || 1200}
                    height={page.height || 1600}
                    unoptimized
                    className="h-auto max-h-80 w-full object-contain"
                  />
                </div>
              ) : null}

              <div className="mt-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100">
                  {isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UploadCloud className="h-3.5 w-3.5" />
                  )}
                  {isUploading ? 'Uploading...' : hasImage ? 'Replace Page Image' : 'Upload Page Image'}
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
