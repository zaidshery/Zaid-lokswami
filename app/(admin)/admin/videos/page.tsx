'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  Edit,
  FileText,
  Loader2,
  Plus,
  Search,
  Trash2,
  Video,
} from 'lucide-react';
import { getAuthHeader } from '@/lib/auth/clientToken';
import { NEWS_CATEGORIES } from '@/lib/constants/newsCategories';
import { formatUiDate } from '@/lib/utils/dateFormat';

interface AdminVideo {
  _id: string;
  title: string;
  description: string;
  thumbnail: string;
  videoUrl: string;
  duration: number;
  category: string;
  isShort: boolean;
  isPublished: boolean;
  shortsRank: number;
  views: number;
  publishedAt: string;
}

type TypeFilter = 'all' | 'shorts' | 'standard';
type StatusFilter = 'all' | 'published' | 'draft';

const categories = ['all', ...NEWS_CATEGORIES.map((category) => category.nameEn)];

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function isPdfThumbnail(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('data:application/pdf') || normalized.endsWith('.pdf');
}

export default function VideosManagementPage() {
  const [videos, setVideos] = useState<AdminVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await fetch('/api/admin/videos?limit=all', {
          headers: {
            ...getAuthHeader(),
          },
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to load videos');
        }

        setVideos(Array.isArray(data.data) ? (data.data as AdminVideo[]) : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load videos');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const filteredVideos = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return videos.filter((video) => {
      if (selectedCategory !== 'all' && video.category !== selectedCategory) {
        return false;
      }

      if (typeFilter === 'shorts' && !video.isShort) return false;
      if (typeFilter === 'standard' && video.isShort) return false;

      if (statusFilter === 'published' && !video.isPublished) return false;
      if (statusFilter === 'draft' && video.isPublished) return false;

      if (!normalizedSearch) return true;

      return (
        video.title.toLowerCase().includes(normalizedSearch) ||
        video.description.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [videos, searchTerm, selectedCategory, typeFilter, statusFilter]);

  const handleDelete = async (id: string) => {
    setBusyId(id);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/admin/videos/${id}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeader(),
        },
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to delete video');
      }

      setVideos((prev) => prev.filter((video) => video._id !== id));
      setDeleteConfirmId(null);
      setSuccess('Video deleted successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete video');
    } finally {
      setBusyId(null);
    }
  };

  const handleTogglePublish = async (video: AdminVideo) => {
    setBusyId(video._id);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/admin/videos/${video._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({ isPublished: !video.isPublished }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update publish status');
      }

      setVideos((prev) =>
        prev.map((item) =>
          item._id === video._id ? { ...item, isPublished: !item.isPublished } : item
        )
      );
      setSuccess(video.isPublished ? 'Video moved to draft' : 'Video published');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update publish status');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Videos</h1>
          <p className="mt-1 text-gray-600">
            Manage videos, Shorts mode, publish status, and ordering
          </p>
        </div>

        <Link href="/admin/videos/new">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2 rounded-lg bg-spanish-red px-5 py-3 font-medium text-white transition-colors hover:bg-guardsman-red"
          >
            <Plus className="h-5 w-5" />
            Upload Video
          </motion.button>
        </Link>
      </div>

      {error ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {success ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      ) : null}

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search videos..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-spanish-red focus:outline-none"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-spanish-red focus:outline-none"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category === 'all' ? 'All Categories' : category}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
              className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-spanish-red focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="shorts">Shorts</option>
              <option value="standard">Standard</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-spanish-red focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
          <Loader2 className="h-6 w-6 animate-spin text-spanish-red" />
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
          <Video className="mx-auto mb-3 h-10 w-10 text-gray-400" />
          <p className="text-sm text-gray-600">No videos found for current filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredVideos.map((video, index) => (
            <motion.article
              key={video._id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="relative h-36 w-full overflow-hidden rounded-lg bg-gray-100 md:w-60">
                  {isPdfThumbnail(video.thumbnail) ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gray-50 text-center">
                      <FileText className="h-7 w-7 text-red-600" />
                      <span className="px-2 text-xs font-semibold text-gray-600">PDF Thumbnail</span>
                    </div>
                  ) : (
                    // Thumbnails can be editor-provided external URLs.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="h-full w-full object-cover"
                    />
                  )}
                  <span className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
                    {formatDuration(video.duration)}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h2 className="line-clamp-2 text-lg font-semibold text-gray-900">
                      {video.title}
                    </h2>
                    {video.isShort ? (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                        Shorts #{video.shortsRank}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        Standard
                      </span>
                    )}

                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        video.isPublished
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      {video.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </div>

                  <p className="mb-3 line-clamp-2 text-sm text-gray-600">{video.description}</p>

                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span>{video.category}</span>
                    <span>•</span>
                    <span>{video.views} views</span>
                    <span>•</span>
                    <span>{formatUiDate(video.publishedAt, video.publishedAt)}</span>
                  </div>
                </div>

                <div className="flex flex-row items-start justify-end gap-2 md:flex-col">
                  <button
                    type="button"
                    disabled={busyId === video._id}
                    onClick={() => handleTogglePublish(video)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                      video.isPublished
                        ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {busyId === video._id
                      ? 'Saving...'
                      : video.isPublished
                      ? 'Unpublish'
                      : 'Publish'}
                  </button>

                  <Link href={`/admin/videos/${video._id}/edit`}>
                    <button
                      type="button"
                      className="rounded-lg p-2 text-blue-600 transition-colors hover:bg-blue-50"
                      aria-label="Edit video"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(video._id)}
                    className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50"
                    aria-label="Delete video"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {deleteConfirmId === video._id ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-700">Delete this video permanently?</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busyId === video._id}
                      onClick={() => handleDelete(video._id)}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {busyId === video._id ? 'Deleting...' : 'Delete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(null)}
                      className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </motion.article>
          ))}
        </div>
      )}
    </div>
  );
}
