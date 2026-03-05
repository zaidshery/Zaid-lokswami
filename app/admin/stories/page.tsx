'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  Edit,
  Eye,
  Loader2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { getAuthHeader } from '@/lib/auth/clientToken';
import { NEWS_CATEGORIES } from '@/lib/constants/newsCategories';

interface AdminStory {
  _id: string;
  title: string;
  caption: string;
  thumbnail: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  linkUrl: string;
  linkLabel: string;
  category: string;
  author: string;
  durationSeconds: number;
  priority: number;
  views: number;
  isPublished: boolean;
  publishedAt: string;
}

type StatusFilter = 'all' | 'published' | 'draft';

const categories = ['all', 'General', ...NEWS_CATEGORIES.map((category) => category.nameEn)];

export default function StoriesManagementPage() {
  const [stories, setStories] = useState<AdminStory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
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
        const response = await fetch('/api/admin/stories?limit=all', {
          headers: {
            ...getAuthHeader(),
          },
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to load stories');
        }

        setStories(Array.isArray(data.data) ? (data.data as AdminStory[]) : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stories');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const filteredStories = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return stories.filter((story) => {
      if (selectedCategory !== 'all' && story.category !== selectedCategory) return false;
      if (statusFilter === 'published' && !story.isPublished) return false;
      if (statusFilter === 'draft' && story.isPublished) return false;

      if (!normalizedSearch) return true;
      return (
        story.title.toLowerCase().includes(normalizedSearch) ||
        story.caption.toLowerCase().includes(normalizedSearch) ||
        story.category.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [searchTerm, selectedCategory, statusFilter, stories]);

  const handleDelete = async (id: string) => {
    setBusyId(id);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/admin/stories/${id}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeader(),
        },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to delete story');
      }

      setStories((prev) => prev.filter((item) => item._id !== id));
      setDeleteConfirmId(null);
      setSuccess('Story deleted successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete story');
    } finally {
      setBusyId(null);
    }
  };

  const handleTogglePublish = async (story: AdminStory) => {
    setBusyId(story._id);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/admin/stories/${story._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({ isPublished: !story.isPublished }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update status');
      }

      setStories((prev) =>
        prev.map((item) =>
          item._id === story._id ? { ...item, isPublished: !item.isPublished } : item
        )
      );
      setSuccess(story.isPublished ? 'Story moved to draft' : 'Story published');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Visual Stories</h1>
          <p className="mt-1 text-gray-600">
            Create, publish, and optimize Instagram-style story cards
          </p>
        </div>

        <Link href="/admin/stories/new">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2 rounded-lg bg-spanish-red px-5 py-3 font-medium text-white transition-colors hover:bg-guardsman-red"
          >
            <Plus className="h-5 w-5" />
            New Story
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
              placeholder="Search stories..."
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

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-spanish-red focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
          <Loader2 className="h-6 w-6 animate-spin text-spanish-red" />
        </div>
      ) : filteredStories.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
          <Eye className="mx-auto mb-3 h-10 w-10 text-gray-400" />
          <p className="text-sm text-gray-600">No stories found for current filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredStories.map((story, index) => (
            <motion.article
              key={story._id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="relative h-44 w-28 shrink-0 overflow-hidden rounded-xl bg-gray-100 md:h-48 md:w-32">
                  {story.thumbnail ? (
                    // Thumbnails can be external URLs configured by editors.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={story.thumbnail}
                      alt={story.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs font-semibold text-gray-500">
                      No image
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h2 className="line-clamp-2 text-lg font-semibold text-gray-900">
                      {story.title}
                    </h2>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                      {story.mediaType === 'video' ? 'Video' : 'Image'}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        story.isPublished
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      {story.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </div>

                  {story.caption ? (
                    <p className="mb-3 line-clamp-2 text-sm text-gray-600">{story.caption}</p>
                  ) : null}

                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span>{story.category || 'General'}</span>
                    <span>•</span>
                    <span>{story.durationSeconds || 6}s</span>
                    <span>•</span>
                    <span>Priority {story.priority || 0}</span>
                    <span>•</span>
                    <span>{story.views || 0} views</span>
                    <span>•</span>
                    <span>{new Date(story.publishedAt).toLocaleDateString('en-GB')}</span>
                  </div>
                </div>

                <div className="flex flex-row items-start justify-end gap-2 md:flex-col">
                  <button
                    type="button"
                    disabled={busyId === story._id}
                    onClick={() => handleTogglePublish(story)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                      story.isPublished
                        ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {busyId === story._id
                      ? 'Saving...'
                      : story.isPublished
                      ? 'Unpublish'
                      : 'Publish'}
                  </button>

                  <Link href={`/admin/stories/${story._id}/edit`}>
                    <button
                      type="button"
                      className="rounded-lg p-2 text-blue-600 transition-colors hover:bg-blue-50"
                      aria-label="Edit story"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(story._id)}
                    className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50"
                    aria-label="Delete story"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {deleteConfirmId === story._id ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-700">Delete this story permanently?</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busyId === story._id}
                      onClick={() => handleDelete(story._id)}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {busyId === story._id ? 'Deleting...' : 'Delete'}
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
