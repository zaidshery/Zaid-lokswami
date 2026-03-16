'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { ArrowLeft, Link2, Loader2, UploadCloud } from 'lucide-react';
import DateInputField from '@/components/ui/DateInputField';
import { getAuthHeader } from '@/lib/auth/clientToken';
import { EPAPER_CITY_OPTIONS, type EPaperCitySlug } from '@/lib/constants/epaperCities';

type UploadResponse = {
  success: boolean;
  error?: string;
  warning?: string | null;
  data?: { _id: string };
};

type BasicResponse = {
  success?: boolean;
  error?: string;
};

export default function NewEPaperPage() {
  const router = useRouter();

  const [createMode, setCreateMode] = useState<'upload' | 'import'>('upload');
  const [citySlug, setCitySlug] = useState<EPaperCitySlug>(EPAPER_CITY_OPTIONS[0].slug);
  const [title, setTitle] = useState('');
  const [publishDate, setPublishDate] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [pageCount, setPageCount] = useState('');

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [pageImages, setPageImages] = useState<File[]>([]);
  const [pdfUrl, setPdfUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [pageImageUrlInput, setPageImageUrlInput] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  const cityName = useMemo(() => {
    const match = EPAPER_CITY_OPTIONS.find((item) => item.slug === citySlug);
    return match?.name || '';
  }, [citySlug]);

  const onPageImagesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setPageImages(files);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setWarning('');

    setLoading(true);
    try {
      if (!citySlug || !cityName || !title.trim() || !publishDate) {
        throw new Error('city, title, and publishDate are required');
      }

      let payload: UploadResponse;
      const warnings: string[] = [];

      if (createMode === 'upload') {
        if (!pdfFile || !thumbnailFile) {
          throw new Error('PDF and thumbnail are required for upload mode');
        }

        const body = new FormData();
        body.append('citySlug', citySlug);
        body.append('cityName', cityName);
        body.append('title', title.trim());
        body.append('publishDate', publishDate);
        body.append('status', status);
        if (pageCount.trim()) body.append('pageCount', pageCount.trim());
        body.append('pdf', pdfFile);
        body.append('thumbnail', thumbnailFile);

        const response = await fetch('/api/admin/epapers/upload', {
          method: 'POST',
          headers: {
            ...getAuthHeader(),
          },
          body,
        });

        payload = (await response.json().catch(() => ({}))) as UploadResponse;
        if (response.status === 413) {
          throw new Error(
            'Upload request is too large for server limit. Upload only PDF + thumbnail here, then add page images from the e-paper detail page.'
          );
        }
        if (!response.ok || !payload.success || !payload.data?._id) {
          throw new Error(payload.error || 'Failed to upload e-paper');
        }

        if (payload.warning) {
          warnings.push(payload.warning);
        }

        if (pageImages.length > 0) {
          let failedUploads = 0;
          for (let index = 0; index < pageImages.length; index += 1) {
            const file = pageImages[index];
            setWarning(`E-paper created. Uploading page images ${index + 1}/${pageImages.length}...`);

            const pageBody = new FormData();
            pageBody.append('pageNumber', String(index + 1));
            pageBody.append('image', file);

            try {
              const pageResponse = await fetch(`/api/admin/epapers/${payload.data._id}/pages`, {
                method: 'PUT',
                headers: {
                  ...getAuthHeader(),
                },
                body: pageBody,
              });
              const pagePayload = (await pageResponse.json().catch(() => ({}))) as BasicResponse;

              if (pageResponse.status === 413) {
                failedUploads += 1;
                continue;
              }

              if (!pageResponse.ok || pagePayload.success === false) {
                failedUploads += 1;
              }
            } catch {
              failedUploads += 1;
            }
          }

          if (failedUploads > 0) {
            warnings.push(
              `${failedUploads} page image(s) failed due upload limits. Open this e-paper and upload those pages one by one with smaller files.`
            );
          }
        }
      } else {
        if (!pdfUrl.trim() || !thumbnailUrl.trim()) {
          throw new Error('PDF link and thumbnail link are required for import mode');
        }

        const response = await fetch('/api/admin/epapers/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
          },
          body: JSON.stringify({
            citySlug,
            cityName,
            title: title.trim(),
            publishDate,
            status,
            pageCount: pageCount.trim() || undefined,
            pdfUrl: pdfUrl.trim(),
            thumbnailUrl: thumbnailUrl.trim(),
            pageImageUrls: pageImageUrlInput
              .split(/\r?\n/)
              .map((entry) => entry.trim())
              .filter(Boolean),
            sourceLabel: sourceLabel.trim(),
          }),
        });

        payload = (await response.json().catch(() => ({}))) as UploadResponse;
        if (!response.ok || !payload.success || !payload.data?._id) {
          throw new Error(payload.error || 'Failed to import e-paper');
        }
        if (payload.warning) {
          warnings.push(payload.warning);
        }
      }

      if (warnings.length > 0) {
        setWarning(warnings.join(' '));
      }
      router.push(`/admin/epapers/${payload.data._id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload e-paper');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Link
        href="/admin/epapers"
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to E-Papers
      </Link>

      <div className="mx-auto max-w-3xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Upload E-Paper</h1>
        <p className="mt-1 text-sm text-gray-600">
          Upload files directly or import a shared Google Drive URL into the e-paper workflow.
        </p>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {warning ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {warning}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="mt-5 space-y-5">
          <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => setCreateMode('upload')}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                createMode === 'upload'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Direct upload
            </button>
            <button
              type="button"
              onClick={() => setCreateMode('import')}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                createMode === 'import'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Google Drive / URL import
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs font-semibold text-gray-600">City</span>
              <select
                value={citySlug}
                onChange={(event) => setCitySlug(event.target.value as EPaperCitySlug)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
              >
                {EPAPER_CITY_OPTIONS.map((city) => (
                  <option key={city.slug} value={city.slug}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-xs font-semibold text-gray-600">Publish Date</span>
              <DateInputField
                value={publishDate}
                onChange={setPublishDate}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                required
              />
            </label>
          </div>

          <label>
            <span className="mb-1 block text-xs font-semibold text-gray-600">Title</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Indore Edition - 16 Feb 2026"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
              required
            />
          </label>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

            <label>
              <span className="mb-1 block text-xs font-semibold text-gray-600">
                Manual Page Count (only if PDF auto-count fails)
              </span>
              <input
                type="number"
                min={1}
                value={pageCount}
                onChange={(event) => setPageCount(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                placeholder="Optional"
              />
            </label>
          </div>

          {createMode === 'upload' ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label>
                  <span className="mb-1 block text-xs font-semibold text-gray-600">
                    PDF (required, max 25MB)
                  </span>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(event) => setPdfFile(event.target.files?.[0] || null)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                    required={createMode === 'upload'}
                  />
                  {pdfFile ? (
                    <p className="mt-1 text-xs text-gray-600">{pdfFile.name}</p>
                  ) : null}
                </label>

                <label>
                  <span className="mb-1 block text-xs font-semibold text-gray-600">
                    Thumbnail (JPG/PNG/WEBP, max 10MB)
                  </span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    onChange={(event) => setThumbnailFile(event.target.files?.[0] || null)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                    required={createMode === 'upload'}
                  />
                  {thumbnailFile ? (
                    <p className="mt-1 text-xs text-gray-600">{thumbnailFile.name}</p>
                  ) : null}
                </label>
              </div>

              <label>
                <span className="mb-1 block text-xs font-semibold text-gray-600">
                  Optional Page Images (ordered upload, one per page)
                </span>
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  onChange={onPageImagesChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                />
                <p className="mt-1 text-xs text-gray-600">
                  {pageImages.length > 0
                    ? `${pageImages.length} page image(s) selected (will be uploaded one-by-one after e-paper is created)`
                    : 'If omitted, hotspots can be added later after page images are uploaded.'}
                </p>
              </label>
            </>
          ) : (
            <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <p className="text-sm text-blue-900">
                Paste share links from Google Drive or any direct PDF/image URL. The server will download the assets and create the edition for you.
              </p>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label>
                  <span className="mb-1 block text-xs font-semibold text-gray-600">
                    PDF URL
                  </span>
                  <input
                    type="url"
                    value={pdfUrl}
                    onChange={(event) => setPdfUrl(event.target.value)}
                    placeholder="https://drive.google.com/file/d/..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                    required={createMode === 'import'}
                  />
                </label>

                <label>
                  <span className="mb-1 block text-xs font-semibold text-gray-600">
                    Thumbnail URL
                  </span>
                  <input
                    type="url"
                    value={thumbnailUrl}
                    onChange={(event) => setThumbnailUrl(event.target.value)}
                    placeholder="https://drive.google.com/file/d/..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                    required={createMode === 'import'}
                  />
                </label>
              </div>

              <label>
                <span className="mb-1 block text-xs font-semibold text-gray-600">
                  Source Label (optional)
                </span>
                <input
                  type="text"
                  value={sourceLabel}
                  onChange={(event) => setSourceLabel(event.target.value)}
                  placeholder="Google Drive morning import"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs font-semibold text-gray-600">
                  Optional Page Image URLs (one per line)
                </span>
                <textarea
                  value={pageImageUrlInput}
                  onChange={(event) => setPageImageUrlInput(event.target.value)}
                  rows={5}
                  placeholder={'https://.../page-1.jpg\nhttps://.../page-2.jpg'}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
                />
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : createMode === 'upload' ? (
              <UploadCloud className="h-4 w-4" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            {loading ? 'Processing...' : createMode === 'upload' ? 'Upload E-Paper' : 'Import E-Paper'}
          </button>
        </form>
      </div>
    </div>
  );
}
