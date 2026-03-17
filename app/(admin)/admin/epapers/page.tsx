'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, Eye, Search } from 'lucide-react';
import DateInputField from '@/components/ui/DateInputField';
import { getAuthHeader } from '@/lib/auth/clientToken';
import { MAX_ADMIN_EPAPERS } from '@/lib/constants/adminContentLimits';
import { EPAPER_CITY_OPTIONS } from '@/lib/constants/epaperCities';
import type { EPaperRecord } from '@/lib/types/epaper';
import { formatUiDate } from '@/lib/utils/dateFormat';

type ApiResponse = {
  success: boolean;
  error?: string;
  data?: EPaperRecord[];
};

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export default function AdminEPaperListPage() {
  const [epapers, setEpapers] = useState<EPaperRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [deleteId, setDeleteId] = useState('');
  const canCreateEpaper = epapers.length < MAX_ADMIN_EPAPERS;

  const fetchEpapers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/epapers?limit=all', {
        headers: {
          ...getAuthHeader(),
        },
      });
      const payload = (await response.json()) as ApiResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to load e-papers');
      }

      setEpapers(Array.isArray(payload.data) ? payload.data : []);
    } catch (err: unknown) {
      setError(toErrorMessage(err, 'Failed to load e-papers'));
      setEpapers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchEpapers();
  }, []);

  const filtered = useMemo(() => {
    const searchValue = search.trim().toLowerCase();
    return epapers.filter((item) => {
      const cityMatch = cityFilter === 'all' || item.citySlug === cityFilter;
      const statusMatch = statusFilter === 'all' || item.status === statusFilter;
      const dateMatch = !dateFilter || item.publishDate === dateFilter;
      const textMatch =
        !searchValue ||
        item.title.toLowerCase().includes(searchValue) ||
        item.cityName.toLowerCase().includes(searchValue);

      return cityMatch && statusMatch && dateMatch && textMatch;
    });
  }, [epapers, search, cityFilter, statusFilter, dateFilter]);

  const deletePaper = async (id: string) => {
    setError('');
    try {
      const response = await fetch(`/api/admin/epapers/${id}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeader(),
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to delete e-paper');
      }

      setEpapers((current) => current.filter((item) => item._id !== id));
      setDeleteId('');
    } catch (err: unknown) {
      setError(toErrorMessage(err, 'Failed to delete e-paper'));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">E-Papers</h1>
          <p className="text-sm text-gray-600">Manage uploads, page images, and hotspot articles.</p>
        </div>

        {canCreateEpaper ? (
          <Link
            href="/admin/epapers/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            New Upload
          </Link>
        ) : null}
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-4">
        <label className="md:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-gray-600">Search</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title or city"
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-600"
            />
          </span>
        </label>

        <label>
          <span className="mb-1 block text-xs font-semibold text-gray-600">City</span>
          <select
            value={cityFilter}
            onChange={(event) => setCityFilter(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
          >
            <option value="all">All cities</option>
            {EPAPER_CITY_OPTIONS.map((city) => (
              <option key={city.slug} value={city.slug}>
                {city.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-xs font-semibold text-gray-600">Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
          >
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>

        <label>
          <span className="mb-1 block text-xs font-semibold text-gray-600">Date</span>
          <DateInputField
            value={dateFilter}
            onChange={setDateFilter}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-600"
          />
        </label>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-12 text-center text-gray-600">
          No e-papers found.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((epaper) => {
            const pagesWithImage = epaper.pages.filter((page) => Boolean(page.imagePath)).length;
            const missingPages = Math.max(0, epaper.pageCount - pagesWithImage);
            const canOpenPublicView = epaper.status === 'published';
            const readiness = epaper.readiness;
            const readinessLabel =
              readiness?.status === 'ready'
                ? 'Ready'
                : readiness?.status === 'needs-review'
                  ? 'Needs review'
                  : 'Not ready';

            return (
              <div
                key={epaper._id}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-semibold text-gray-900">{epaper.title}</h2>
                    <p className="mt-1 text-xs text-gray-600">
                      {epaper.cityName} ({epaper.citySlug}) | {formatUiDate(epaper.publishDate, epaper.publishDate)}
                    </p>
                    <p className="mt-1 text-xs text-gray-600">
                      {epaper.pageCount} pages | {pagesWithImage} with image | {missingPages} missing
                    </p>
                    {readiness ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            readiness.status === 'ready'
                              ? 'bg-emerald-100 text-emerald-700'
                              : readiness.status === 'needs-review'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {readinessLabel}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          Hotspots {readiness.hotspotCoveragePercent}% | Text {readiness.textCoveragePercent}%
                        </span>
                        {epaper.automation?.sourceLabel ? (
                          <span className="text-[11px] text-gray-500">
                            Source: {epaper.automation.sourceLabel}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      epaper.status === 'published'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {epaper.status}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/admin/epapers/${epaper._id}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Link>

                  <Link
                    href={`/main/epaper?paper=${encodeURIComponent(epaper._id)}&city=${encodeURIComponent(epaper.citySlug)}`}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold ${
                      canOpenPublicView
                        ? 'border-gray-300 bg-gray-100 text-gray-800 hover:bg-gray-200'
                        : 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
                    }`}
                    aria-disabled={!canOpenPublicView}
                    onClick={(event) => {
                      if (!canOpenPublicView) event.preventDefault();
                    }}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {canOpenPublicView ? 'View' : 'Publish to View'}
                  </Link>

                  {deleteId === epaper._id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void deletePaper(epaper._id)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                      >
                        Confirm Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId('')}
                        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteId(epaper._id)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
