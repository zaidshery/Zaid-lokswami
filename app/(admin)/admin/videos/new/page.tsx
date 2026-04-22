'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  FileText,
  Image as ImageIcon,
  Loader2,
  Send,
  Upload,
} from 'lucide-react';
import { getAuthHeader } from '@/lib/auth/clientToken';
import { isAdminRole } from '@/lib/auth/roles';
import { NEWS_CATEGORIES } from '@/lib/constants/newsCategories';
import {
  CmsEditorCanvas,
  CmsEditorColumns,
  CmsEditorMain,
  CmsEditorSidebar,
} from '@/components/admin/CmsEditorLayout';

const categories = NEWS_CATEGORIES.map((category) => category.nameEn);
const THUMBNAIL_MAX_SIZE = 10 * 1024 * 1024;
const THUMBNAIL_ACCEPT = '.jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf';

interface VideoFormData {
  title: string;
  description: string;
  thumbnail: string;
  videoUrl: string;
  duration: string;
  category: string;
  isShort: boolean;
  shortsRank: string;
}

type VideoCreateIntent = 'draft' | 'submit' | 'publish';

const initialFormData: VideoFormData = {
  title: '',
  description: '',
  thumbnail: '',
  videoUrl: '',
  duration: '',
  category: 'National',
  isShort: false,
  shortsRank: '0',
};

function isPdfUrl(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('data:application/pdf') || normalized.endsWith('.pdf');
}

function isAllowedThumbnailFile(file: File) {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    mime === 'image/jpeg' ||
    mime === 'image/jpg' ||
    mime === 'image/png' ||
    mime === 'application/pdf' ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png') ||
    name.endsWith('.pdf')
  );
}

function getYouTubeId(value: string) {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.replace('www.', '').toLowerCase();

    if (host === 'youtu.be') {
      return url.pathname.slice(1) || null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') return url.searchParams.get('v');
      if (url.pathname.startsWith('/shorts/')) return url.pathname.split('/')[2] || null;
      if (url.pathname.startsWith('/embed/')) return url.pathname.split('/')[2] || null;
    }

    return null;
  } catch {
    return null;
  }
}

function getYouTubeThumbnail(value: string) {
  const id = getYouTubeId(value);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '';
}

export default function CreateVideoPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [formData, setFormData] = useState<VideoFormData>(initialFormData);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState('');
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [runningIntent, setRunningIntent] = useState<VideoCreateIntent | ''>('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const hasPdfThumbnail = useMemo(() => {
    if (thumbnailFile) {
      return (
        thumbnailFile.type === 'application/pdf' ||
        thumbnailFile.name.toLowerCase().endsWith('.pdf')
      );
    }
    return isPdfUrl(formData.thumbnail);
  }, [thumbnailFile, formData.thumbnail]);

  const role = session?.user?.role;
  const canPublishNow = role === 'admin' || role === 'super_admin';
  const canUseDesk = isAdminRole(role);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : value,
    }));
  };

  const handleThumbnailFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isAllowedThumbnailFile(file)) {
      setError('Thumbnail file must be JPG, JPEG, PNG, or PDF');
      return;
    }

    if (file.size > THUMBNAIL_MAX_SIZE) {
      setError('Thumbnail size must be less than 10MB');
      return;
    }

    setError('');
    setThumbnailFile(file);

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      setThumbnailPreview('');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setThumbnailPreview((event.target?.result as string) || '');
    };
    reader.readAsDataURL(file);
  };

  const uploadThumbnail = async () => {
    if (!thumbnailFile) return formData.thumbnail.trim();

    setIsUploadingThumbnail(true);
    try {
      const body = new FormData();
      body.append('file', thumbnailFile);
      body.append('purpose', 'video-thumbnail');

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
        },
        body,
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload thumbnail');
      }

      return String(data.data?.url || '');
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  const handleSubmit = async (intent: VideoCreateIntent) => {
    setError('');
    setSuccess('');
    setIsLoading(true);
    setRunningIntent(intent);

    try {
      if (
        !formData.title.trim() ||
        !formData.description.trim() ||
        !formData.videoUrl.trim() ||
        !formData.duration ||
        !formData.category
      ) {
        setError('Please fill in all required fields');
        return;
      }

      const duration = Number.parseInt(formData.duration, 10);
      const shortsRank = Number.parseInt(formData.shortsRank || '0', 10);

      if (!Number.isFinite(duration) || duration < 1) {
        setError('Duration must be a valid number greater than 0');
        return;
      }

      if (!Number.isFinite(shortsRank)) {
        setError('Shorts rank must be a valid number');
        return;
      }

      const youtubeId = getYouTubeId(formData.videoUrl);
      if (!youtubeId) {
        setError('Please enter a valid YouTube URL');
        return;
      }

      let thumbnail = await uploadThumbnail();
      if (!thumbnail.trim()) {
        thumbnail = getYouTubeThumbnail(formData.videoUrl);
      }

      if (!thumbnail.trim()) {
        setError('Please provide a thumbnail (upload or URL)');
        return;
      }

      const response = await fetch('/api/admin/videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim(),
          thumbnail: thumbnail.trim(),
          videoUrl: formData.videoUrl.trim(),
          duration,
          category: formData.category,
          isShort: formData.isShort,
          shortsRank: formData.isShort ? shortsRank : 0,
          intent,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create video');
      }

      setSuccess(
        intent === 'draft'
          ? 'Video draft saved successfully.'
          : intent === 'submit'
            ? 'Video submitted for review.'
            : 'Video published successfully.'
      );
      setFormData(initialFormData);
      setThumbnailFile(null);
      setThumbnailPreview('');

      setTimeout(() => {
        router.push('/admin/videos');
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create video');
    } finally {
      setIsLoading(false);
      setRunningIntent('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Link
        href="/admin/videos"
        className="mb-6 inline-flex items-center gap-2 text-gray-600 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Videos
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <CmsEditorCanvas>
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Create Video</h1>
          <p className="mb-6 text-gray-600">
            Save a draft, hand it into review, or publish when allowed
          </p>

          {error ? (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          ) : null}

          {success ? (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
              <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{success}</p>
            </div>
          ) : null}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit('submit');
            }}
          >
            <CmsEditorColumns sidebarWidth="narrow">
              <CmsEditorMain>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">
                Video Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Enter video title"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Video description"
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900">
                  Thumbnail URL (optional)
                </label>
                <input
                  type="url"
                  name="thumbnail"
                  value={formData.thumbnail}
                  onChange={handleInputChange}
                  placeholder="https://example.com/thumbnail.jpg"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Leave empty to auto-use YouTube thumbnail.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900">
                  Video URL (YouTube) <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  name="videoUrl"
                  value={formData.videoUrl}
                  onChange={handleInputChange}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Supported: `youtube.com/watch`, `youtu.be`, `youtube.com/shorts`
                </p>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">
                Upload Thumbnail File (JPG/JPEG/PNG/PDF)
              </label>
              <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-4 py-5 transition-colors hover:border-primary-600 hover:bg-gray-50">
                <span className="flex flex-col items-center gap-1 text-center">
                  <ImageIcon className="h-5 w-5 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    Click to upload thumbnail file
                  </span>
                  <span className="text-xs text-gray-500">JPG/JPEG/PNG/PDF up to 10MB</span>
                </span>
                <input
                  type="file"
                  accept={THUMBNAIL_ACCEPT}
                  onChange={handleThumbnailFileChange}
                  className="hidden"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900">
                  Duration (seconds) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="duration"
                  value={formData.duration}
                  onChange={handleInputChange}
                  placeholder="60"
                  min="1"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900">
                  Shorts Rank (high = first)
                </label>
                <input
                  type="number"
                  name="shortsRank"
                  value={formData.shortsRank}
                  onChange={handleInputChange}
                  placeholder="0"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                  disabled={!formData.isShort}
                />
              </div>
            </div>

              </CmsEditorMain>

              <CmsEditorSidebar>
                {!canUseDesk ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    Your session is still loading role permissions. Publishing actions may stay hidden until it resolves.
                  </div>
                ) : null}

                {(thumbnailFile || formData.thumbnail) && (thumbnailPreview || formData.thumbnail || hasPdfThumbnail) ? (
                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                    {hasPdfThumbnail ? (
                      <div className="flex h-44 flex-col items-center justify-center gap-2 bg-gray-50 px-4 text-center">
                        <FileText className="h-8 w-8 text-red-600" />
                        <p className="text-sm font-semibold text-gray-800">PDF thumbnail selected</p>
                        <p className="text-xs text-gray-500">
                          {thumbnailFile ? thumbnailFile.name : 'PDF URL provided'}
                        </p>
                      </div>
                    ) : (
                      <img
                        src={thumbnailPreview || formData.thumbnail}
                        alt="Thumbnail preview"
                        className="h-48 w-full object-cover"
                      />
                    )}
                  </div>
                ) : null}

                <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <label className="flex cursor-pointer items-center justify-between gap-4">
                <span className="text-sm font-medium text-gray-900">Use this video in Shorts mode</span>
                <input
                  type="checkbox"
                  name="isShort"
                  checked={formData.isShort}
                  onChange={handleInputChange}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-600"
                />
              </label>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              Draft keeps the video private, submit sends it into review, and publish is only shown for desk roles with release authority.
                </div>

                <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <button
                type="button"
                disabled={isLoading || isUploadingThumbnail}
                onClick={() => void handleSubmit('draft')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {runningIntent === 'draft' ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5" />
                    Save Draft
                  </>
                )}
              </button>

              <button
                type="submit"
                disabled={isLoading || isUploadingThumbnail}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-spanish-red px-5 py-3 font-medium text-white transition-colors hover:bg-guardsman-red disabled:cursor-not-allowed disabled:opacity-50"
              >
                {runningIntent === 'submit' ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Submit For Review
                  </>
                )}
              </button>

              {canPublishNow ? (
                <button
                  type="button"
                  disabled={isLoading || isUploadingThumbnail}
                  onClick={() => void handleSubmit('publish')}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {runningIntent === 'publish' ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5" />
                      Publish Now
                    </>
                  )}
                </button>
              ) : null}

              <Link
                href="/admin/videos"
                className="inline-flex w-full items-center justify-center rounded-lg border border-gray-300 px-5 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-100"
              >
                Cancel
              </Link>
                </div>
              </CmsEditorSidebar>
            </CmsEditorColumns>
          </form>
        </div>
        </CmsEditorCanvas>
      </motion.div>
    </div>
  );
}
