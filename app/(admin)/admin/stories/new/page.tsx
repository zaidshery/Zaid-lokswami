'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Image as ImageIcon,
  Loader2,
  Send,
  Upload,
} from 'lucide-react';
import { getAuthHeader } from '@/lib/auth/clientToken';
import { isAdminRole, isReporterDeskRole } from '@/lib/auth/roles';
import { NEWS_CATEGORIES } from '@/lib/constants/newsCategories';

interface StoryFormData {
  title: string;
  caption: string;
  thumbnail: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  linkUrl: string;
  linkLabel: string;
  category: string;
  author: string;
  locationTag: string;
  sourceInfo: string;
  sourceConfidential: boolean;
  reporterNotes: string;
  durationSeconds: string;
  priority: string;
}

type StoryCreateIntent = 'draft' | 'submit' | 'publish';

const categories = ['General', ...NEWS_CATEGORIES.map((category) => category.nameEn)];
const THUMBNAIL_MAX_SIZE = 5 * 1024 * 1024;

function createInitialFormData(author = 'Desk'): StoryFormData {
  return {
    title: '',
    caption: '',
    thumbnail: '',
    mediaType: 'image',
    mediaUrl: '',
    linkUrl: '',
    linkLabel: '',
    category: 'General',
    author,
    locationTag: '',
    sourceInfo: '',
    sourceConfidential: false,
    reporterNotes: '',
    durationSeconds: '6',
    priority: '0',
  };
}

export default function CreateStoryPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [formData, setFormData] = useState<StoryFormData>(() => createInitialFormData());
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState('');
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [runningIntent, setRunningIntent] = useState<StoryCreateIntent | ''>('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const previewThumbnail = useMemo(
    () => thumbnailPreview || formData.thumbnail.trim(),
    [formData.thumbnail, thumbnailPreview]
  );

  const role = session?.user?.role;
  const sessionName = session?.user?.name?.trim() || '';
  const canPublishNow = role === 'admin' || role === 'super_admin';
  const canUseDesk = isAdminRole(role);
  const isReporterFlow = isReporterDeskRole(role);
  const defaultAuthor = isReporterFlow && sessionName ? sessionName : 'Desk';

  useEffect(() => {
    if (!isReporterFlow || !sessionName) {
      return;
    }

    setFormData((current) => {
      const currentAuthor = current.author.trim();
      if (currentAuthor === sessionName) {
        return current;
      }

      if (currentAuthor && currentAuthor !== 'Desk') {
        return current;
      }

      return { ...current, author: sessionName };
    });
  }, [isReporterFlow, sessionName]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleThumbnailFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Thumbnail must be an image file');
      return;
    }

    if (file.size > THUMBNAIL_MAX_SIZE) {
      setError('Thumbnail image size must be less than 5MB');
      return;
    }

    setError('');
    setThumbnailFile(file);

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
      body.append('purpose', 'story-thumbnail');

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

  const handleSubmit = async (intent: StoryCreateIntent) => {
    setError('');
    setSuccess('');
    setIsLoading(true);
    setRunningIntent(intent);

    try {
      if (!formData.title.trim()) {
        setError('Story title is required');
        return;
      }

      const thumbnail = await uploadThumbnail();
      if (!thumbnail) {
        setError('Please provide a story thumbnail');
        return;
      }

      const durationSeconds = Number.parseInt(formData.durationSeconds, 10);
      const priority = Number.parseInt(formData.priority, 10);

      if (!Number.isFinite(durationSeconds) || durationSeconds < 2 || durationSeconds > 180) {
        setError('Duration must be between 2 and 180 seconds');
        return;
      }

      if (!Number.isFinite(priority)) {
        setError('Priority must be a valid number');
        return;
      }

      if (formData.mediaType === 'video' && !formData.mediaUrl.trim()) {
        setError('Video media URL is required for video stories');
        return;
      }

      const response = await fetch('/api/admin/stories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          caption: formData.caption.trim(),
          thumbnail: thumbnail.trim(),
          mediaType: formData.mediaType,
          mediaUrl: formData.mediaUrl.trim(),
          linkUrl: formData.linkUrl.trim(),
          linkLabel: formData.linkLabel.trim(),
          category: formData.category,
          author: formData.author.trim() || defaultAuthor,
          reporterMeta: {
            locationTag: formData.locationTag,
            sourceInfo: formData.sourceInfo,
            sourceConfidential: formData.sourceConfidential,
            reporterNotes: formData.reporterNotes,
          },
          durationSeconds,
          priority,
          intent,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create story');
      }

      setSuccess(
        intent === 'draft'
          ? 'Story draft saved successfully.'
          : intent === 'submit'
            ? 'Story submitted for review.'
            : 'Story published successfully.'
      );
      setFormData(createInitialFormData(defaultAuthor));
      setThumbnailFile(null);
      setThumbnailPreview('');

      setTimeout(() => {
        router.push('/admin/stories');
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create story');
    } finally {
      setIsLoading(false);
      setRunningIntent('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Link
        href="/admin/stories"
        className="mb-6 inline-flex items-center gap-2 text-gray-600 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Stories
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-3xl"
      >
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Create Story</h1>
          <p className="mb-6 text-gray-600">Save a draft, hand it into review, or publish when allowed</p>

          {!canUseDesk ? (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Your session is still loading role permissions. Publishing actions may stay hidden until it resolves.
            </div>
          ) : null}

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
            className="space-y-6"
          >
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">
                Story Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Headline for visual story"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">Video Script</label>
              <textarea
                name="caption"
                value={formData.caption}
                onChange={handleInputChange}
                placeholder="Optional context line for fullscreen viewer"
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {!isReporterFlow ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">
                    Story Type
                  </label>
                  <select
                    name="mediaType"
                    value={formData.mediaType}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                  >
                    <option value="image">Image Story</option>
                    <option value="video">Video Story</option>
                  </select>
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900">
                  Category
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">
                Thumbnail URL (optional if file upload used)
              </label>
              <input
                type="url"
                name="thumbnail"
                value={formData.thumbnail}
                onChange={handleInputChange}
                placeholder="https://example.com/story-thumbnail.jpg"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">
                Upload Thumbnail (image)
              </label>
              <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-4 py-5 transition-colors hover:border-primary-600 hover:bg-gray-50">
                <span className="flex flex-col items-center gap-1 text-center">
                  <ImageIcon className="h-5 w-5 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Click to upload</span>
                  <span className="text-xs text-gray-500">Images/Videos - All formats up to 5MB</span>
                </span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleThumbnailFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {previewThumbnail ? (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <img
                  src={previewThumbnail}
                  alt="Story thumbnail preview"
                  className="h-64 w-full object-cover"
                />
              </div>
            ) : null}

            {formData.mediaType === 'video' ? (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900">
                  Video URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  name="mediaUrl"
                  value={formData.mediaUrl}
                  onChange={handleInputChange}
                  placeholder="https://example.com/story-video.mp4"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                  required
                />
              </div>
            ) : null}

            {!isReporterFlow ? (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900">
                      Link URL (optional)
                    </label>
                    <input
                      type="text"
                      name="linkUrl"
                      value={formData.linkUrl}
                      onChange={handleInputChange}
                      placeholder="/main/article/123 or https://..."
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900">
                      Link Label
                    </label>
                    <input
                      type="text"
                      name="linkLabel"
                      value={formData.linkLabel}
                      onChange={handleInputChange}
                      placeholder="Read Full Story"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-gray-900">
                      Author
                    </label>
                    <input
                      type="text"
                      name="author"
                      value={formData.author}
                      onChange={handleInputChange}
                      placeholder={defaultAuthor}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-gray-900">
                      Duration (sec)
                    </label>
                    <input
                      type="number"
                      name="durationSeconds"
                      value={formData.durationSeconds}
                      onChange={handleInputChange}
                      min="2"
                      max="180"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900">Priority</label>
                    <input
                      type="number"
                      name="priority"
                      value={formData.priority}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                    />
                  </div>
                </div>
              </>
            ) : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900">
                  Location Tag
                </label>
                <input
                  type="text"
                  name="locationTag"
                  value={formData.locationTag}
                  onChange={handleInputChange}
                  placeholder="Bhopal, MP"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">
                Reporter Notes
              </label>
              <textarea
                name="reporterNotes"
                value={formData.reporterNotes}
                onChange={handleInputChange}
                rows={3}
                placeholder="Editing notes, verification context, or publishing hints."
                className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
              />
            </div>

            {!isReporterFlow ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Source Information</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Capture source and desk context before this story enters review.
                  </p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">
                    Source Info
                  </label>
                  <textarea
                    name="sourceInfo"
                    value={formData.sourceInfo}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Who supplied this story, clip, or visual?"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                  />
                </div>
                <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="sourceConfidential"
                    checked={formData.sourceConfidential}
                    onChange={handleInputChange}
                    className="h-4 w-4 rounded border-gray-300 text-spanish-red focus:ring-spanish-red"
                  />
                  <span className="text-sm text-gray-700">
                    Source is confidential and should remain internal
                  </span>
                </label>
              </div>
            ) : null}

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              Draft keeps the story private, submit sends it into review, and publish is only shown for desk roles with release authority.
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={isLoading || isUploadingThumbnail}
                onClick={() => void handleSubmit('draft')}
                className="inline-flex min-w-[160px] items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-lg bg-spanish-red px-5 py-3 font-medium text-white transition-colors hover:bg-guardsman-red disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="inline-flex min-w-[160px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                href="/admin/stories"
                className="rounded-lg border border-gray-300 px-5 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-100"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
