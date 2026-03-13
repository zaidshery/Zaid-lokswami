'use client';
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Upload, AlertCircle, CheckCircle, Image as ImageIcon } from 'lucide-react';
import RichTextEditor from '@/components/forms/RichTextEditor';
import { useRouter } from 'next/navigation';
import { getAuthHeader } from '@/lib/auth/clientToken';
import { NEWS_CATEGORIES } from '@/lib/constants/newsCategories';
import { formatUiDateTime } from '@/lib/utils/dateFormat';
import { renderArticleRichContent } from '@/lib/utils/articleRichContent';
import {
  ARTICLE_IMAGE_UPLOAD_GUIDE,
  getArticleImageHints,
  prepareArticleImageFile,
} from '@/lib/utils/articleImageUpload';
import { resolveArticleOgImageUrl } from '@/lib/utils/articleMedia';

const DEFAULT_CATEGORIES = NEWS_CATEGORIES.map((category) => category.nameEn);
const DRAFT_STORAGE_KEY = 'lokswami:article-draft:new';
const AUTOSAVE_INTERVAL_MS = 15000;

type ArticleFormState = {
  title: string;
  summary: string;
  content: string;
  category: string;
  author: string;
  isBreaking: boolean;
  isTrending: boolean;
  seoTitle: string;
  seoDescription: string;
  ogImage: string;
  canonicalUrl: string;
};

const EMPTY_FORM: ArticleFormState = {
  title: '',
  summary: '',
  content: '',
  category: 'National',
  author: '',
  isBreaking: false,
  isTrending: false,
  seoTitle: '',
  seoDescription: '',
  ogImage: '',
  canonicalUrl: '',
};

function formatDraftTimestamp(value: string) {
  return formatUiDateTime(value, '');
}

function isValidAbsoluteHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function UploadArticle() {
  const router = useRouter();
  const [formData, setFormData] = useState<ArticleFormState>(EMPTY_FORM);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategorySlug, setNewCategorySlug] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [createCategoryError, setCreateCategoryError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [contentMode, setContentMode] = useState<'write' | 'preview'>('write');
  const [draftSavedAt, setDraftSavedAt] = useState('');
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [imageQualityNote, setImageQualityNote] = useState('');

  const previewContentHtml = useMemo(() => {
    const source = formData.content.trim() || formData.summary.trim();
    if (!source) {
      return '<p>Start writing your article to see a live preview.</p>';
    }
    return renderArticleRichContent(source);
  }, [formData.content, formData.summary]);

  const persistDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    const hasAnyContent = Boolean(
      formData.title.trim() ||
        formData.summary.trim() ||
        formData.content.trim() ||
        formData.author.trim() ||
        formData.seoTitle.trim() ||
        formData.seoDescription.trim() ||
        formData.ogImage.trim() ||
        formData.canonicalUrl.trim() ||
        imagePreview.trim()
    );

    if (!hasAnyContent) return;

    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      formData,
      imagePreview: imagePreview.startsWith('data:') ? '' : imagePreview,
      contentMode,
    };

    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
    setDraftSavedAt(payload.savedAt);
  }, [formData, imagePreview, contentMode]);

  const clearDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setDraftSavedAt('');
    setDraftRestored(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) {
        setDraftReady(true);
        return;
      }

      const parsed = JSON.parse(raw) as {
        savedAt?: string;
        formData?: Partial<typeof formData>;
        imagePreview?: string;
        contentMode?: 'write' | 'preview';
      };

      if (!parsed.formData) {
        setDraftReady(true);
        return;
      }

      const shouldRestore = window.confirm(
        'Unsaved draft found. Do you want to restore it?'
      );
      if (shouldRestore) {
        setFormData((current) => ({ ...current, ...parsed.formData }));
        if (typeof parsed.imagePreview === 'string' && parsed.imagePreview.trim()) {
          setImagePreview(parsed.imagePreview);
        }
        if (parsed.contentMode === 'write' || parsed.contentMode === 'preview') {
          setContentMode(parsed.contentMode);
        }
        if (typeof parsed.savedAt === 'string') {
          setDraftSavedAt(parsed.savedAt);
        }
        setDraftRestored(true);
      }
    } catch {
      // Ignore invalid draft payloads.
    } finally {
      setDraftReady(true);
    }
  }, []);

  useEffect(() => {
    if (!draftReady || typeof window === 'undefined') return;
    const id = window.setInterval(persistDraft, AUTOSAVE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [draftReady, persistDraft]);

  useEffect(() => {
    if (!draftReady || typeof window === 'undefined') return;

    const onBeforeUnload = () => {
      persistDraft();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [draftReady, persistDraft]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((current) => ({
      ...current,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setImageQualityNote('');

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    try {
      const prepared = await prepareArticleImageFile(file);
      setImageFile(prepared.file);
      setImagePreview(prepared.previewDataUrl);

      const notes: string[] = [];
      if (prepared.wasResized) {
        notes.push(
          `Image optimized to ${prepared.width}x${prepared.height} for better cross-device clarity.`
        );
      }

      const hints = getArticleImageHints(prepared.width, prepared.height);
      if (hints.length) notes.push(...hints);

      setImageQualityNote(notes.join(' '));
    } catch {
      setError('Failed to process image. Please try a different file.');
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/admin/categories');
        const data = await res.json();
        if (res.ok && Array.isArray(data.data) && data.data.length) {
          const nextCategories = data.data.map((c: { name: string }) => c.name);
          setCategories(nextCategories);
          setFormData((f) => ({
            ...f,
            category: nextCategories.includes(f.category)
              ? f.category
              : nextCategories[0],
          }));
        }
      } catch {
        // keep defaults
      }
    };
    load();
  }, []);

  const uploadImage = async () => {
    if (!imageFile) return imagePreview;

    setIsLoadingImage(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('file', imageFile);

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
        },
        body: formDataToSend,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload image');
      }

      return data.data.url;
    } catch (err) {
      setError('Failed to upload image. Please try again.');
      throw err;
    } finally {
      setIsLoadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (!formData.title || !formData.summary || !formData.content || !formData.author || !imagePreview) {
        setError('Please fill in all required fields');
        setIsLoading(false);
        return;
      }

      const canonicalUrl = formData.canonicalUrl.trim();
      if (canonicalUrl && !isValidAbsoluteHttpUrl(canonicalUrl)) {
        setError('Canonical URL must start with http:// or https://');
        setIsLoading(false);
        return;
      }

      const ogImage = formData.ogImage.trim();
      if (
        ogImage &&
        !ogImage.startsWith('/') &&
        !isValidAbsoluteHttpUrl(ogImage)
      ) {
        setError('OG image must be an absolute URL or local path starting with /');
        setIsLoading(false);
        return;
      }

      // Upload image first if it's a new file
      let imageUrl = imagePreview;
      if (imageFile) {
        imageUrl = await uploadImage();
      }
      const resolvedOgImage =
        formData.ogImage.trim() || resolveArticleOgImageUrl({ image: imageUrl });

      const response = await fetch('/api/admin/articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          title: formData.title,
          summary: formData.summary,
          content: formData.content,
          category: formData.category,
          author: formData.author,
          isBreaking: formData.isBreaking,
          isTrending: formData.isTrending,
          image: imageUrl,
          seo: {
            metaTitle: formData.seoTitle,
            metaDescription: formData.seoDescription,
            ogImage: resolvedOgImage,
            canonicalUrl: formData.canonicalUrl,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to publish article');
        setIsLoading(false);
        return;
      }

      setSuccess('Article published successfully! Redirecting...');
      const fallbackCategory = categories.includes(EMPTY_FORM.category)
        ? EMPTY_FORM.category
        : categories[0] || EMPTY_FORM.category;
      setFormData({ ...EMPTY_FORM, category: fallbackCategory });
      setImageFile(null);
      setImagePreview('');
      setContentMode('write');
      clearDraft();

      setTimeout(() => {
        router.push('/admin/articles');
      }, 2000);
    } catch {
      setError('Failed to publish article. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
      <Link href="/admin" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors">
        <ArrowLeft className="w-5 h-5" />
        Back to Dashboard
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto"
      >
        <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Article</h1>
          <p className="text-gray-600 mb-8">Write and publish a new article with rich formatting</p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-800"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3 text-green-800"
            >
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{success}</p>
            </motion.div>
          )}

          <div className="mb-6 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="font-medium">Draft & SEO Tools</p>
            <p className="mt-1 text-blue-800">
              Draft autosaves every {AUTOSAVE_INTERVAL_MS / 1000} seconds.
              {draftSavedAt
                ? ` Last saved: ${formatDraftTimestamp(draftSavedAt)}.`
                : ' No local draft yet.'}
            </p>
            {draftRestored ? (
              <p className="mt-1 text-blue-800">
                Draft restored from local storage.
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={persistDraft}
                className="rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100"
              >
                Save Draft Now
              </button>
              <button
                type="button"
                onClick={clearDraft}
                className="rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100"
              >
                Discard Local Draft
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Article Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Enter an engaging title"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-spanish-red transition-colors"
                required
              />
            </div>

            {/* Summary */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Summary <span className="text-red-500">*</span>
              </label>
              <textarea
                name="summary"
                value={formData.summary}
                onChange={handleInputChange}
                placeholder="Brief summary of the article (will appear in article feed)"
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-spanish-red transition-colors"
                required
              />
            </div>

            {/* SEO Panel */}
            <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-900">SEO Settings</p>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Meta Title
                </label>
                <input
                  type="text"
                  name="seoTitle"
                  value={formData.seoTitle}
                  onChange={handleInputChange}
                  placeholder="Optional SEO title (recommended under 60 chars)"
                  maxLength={160}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-spanish-red transition-colors"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {formData.seoTitle.length}/160
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Meta Description
                </label>
                <textarea
                  name="seoDescription"
                  value={formData.seoDescription}
                  onChange={handleInputChange}
                  placeholder="Optional SEO description"
                  rows={3}
                  maxLength={320}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-spanish-red transition-colors"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {formData.seoDescription.length}/320
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  OG Image URL
                </label>
                <input
                  type="text"
                  name="ogImage"
                  value={formData.ogImage}
                  onChange={handleInputChange}
                  placeholder="https://example.com/image.jpg or /uploads/image.jpg"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-spanish-red transition-colors"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Leave empty to auto-use featured image as 1200x630 OG preview.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Canonical URL
                </label>
                <input
                  type="url"
                  name="canonicalUrl"
                  value={formData.canonicalUrl}
                  onChange={handleInputChange}
                  placeholder="https://example.com/main/article/slug"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-spanish-red transition-colors"
                />
              </div>
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Featured Image <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className=" flex items-center justify-center w-full px-4 py-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-spanish-red hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col items-center gap-2">
                      <ImageIcon className="w-6 h-6 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">Click to upload image</span>
                      <span className="text-xs text-gray-500">PNG, JPG, WebP up to 5MB</span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                      required={!imagePreview}
                    />
                  </label>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">{ARTICLE_IMAGE_UPLOAD_GUIDE}</p>
              {imageQualityNote ? (
                <p className="mt-1 text-xs font-medium text-amber-700">{imageQualityNote}</p>
              ) : null}

              {imagePreview && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-4 rounded-lg overflow-hidden border border-gray-200"
                >
                  <img src={imagePreview} alt="Preview" className="w-full h-64 object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview('');
                      setImageQualityNote('');
                    }}
                    className="w-full py-2 bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-sm font-medium"
                  >
                    Remove Image
                  </button>
                </motion.div>
              )}
            </div>

            {/* Content Editor */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Article Content <span className="text-red-500">*</span>
              </label>
              <p className="mb-2 text-xs text-gray-500">
                Tip: Paste a YouTube link on its own line or use the YouTube button in the editor toolbar.
              </p>
              <div className="mb-3 inline-flex overflow-hidden rounded-lg border border-gray-300">
                <button
                  type="button"
                  onClick={() => setContentMode('write')}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                    contentMode === 'write'
                      ? 'bg-spanish-red text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setContentMode('preview')}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                    contentMode === 'preview'
                      ? 'bg-spanish-red text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Preview
                </button>
              </div>
              {contentMode === 'write' ? (
                <RichTextEditor
                  value={formData.content}
                  onChange={(content) =>
                    setFormData((current) => ({ ...current, content }))
                  }
                  placeholder="Write your article here. Use the toolbar above for formatting."
                />
              ) : (
                <div className="rounded-lg border border-gray-300 bg-white p-4">
                  <h3 className="text-lg font-bold text-gray-900">
                    {formData.title.trim() || 'Untitled article'}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {formData.summary.trim() || 'Summary preview will appear here.'}
                  </p>
                  <div className="my-4 h-px bg-gray-200" />
                  <div
                    className="article-rich-content text-gray-800"
                    dangerouslySetInnerHTML={{ __html: previewContentHtml }}
                  />
                </div>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-spanish-red transition-colors"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              {/* Inline create category */}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateCategory((s) => !s)}
                  className="text-sm text-spanish-red font-medium hover:underline"
                >
                  {showCreateCategory ? 'Cancel' : '+ Create new category'}
                </button>

                {showCreateCategory && (
                  <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                    {createCategoryError && <div className="text-sm text-red-600">{createCategoryError}</div>}
                    <input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Category name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <input
                      value={newCategorySlug}
                      onChange={(e) => setNewCategorySlug(e.target.value)}
                      placeholder="Optional slug (auto-generated if blank)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isCreatingCategory}
                        onClick={async () => {
                          setCreateCategoryError('');
                          if (!newCategoryName.trim()) {
                            setCreateCategoryError('Please provide a category name');
                            return;
                          }
                          setIsCreatingCategory(true);
                          try {
                            const res = await fetch('/api/admin/categories', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                ...getAuthHeader(),
                              },
                              body: JSON.stringify({ name: newCategoryName.trim(), slug: newCategorySlug.trim() || undefined }),
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || 'Failed to create category');
                            const created = data.data;
                            setCategories((c) => [created.name, ...c.filter((x) => x !== created.name)]);
                            setFormData((f) => ({ ...f, category: created.name }));
                            setNewCategoryName('');
                            setNewCategorySlug('');
                            setShowCreateCategory(false);
                          } catch (err: unknown) {
                            const message =
                              err instanceof Error
                                ? err.message
                                : 'Failed to create category';
                            setCreateCategoryError(message);
                          } finally {
                            setIsCreatingCategory(false);
                          }
                        }}
                        className="px-4 py-2 bg-spanish-red text-white rounded-md disabled:opacity-50"
                      >
                        {isCreatingCategory ? 'Creating...' : 'Create'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateCategory(false);
                          setNewCategoryName('');
                          setNewCategorySlug('');
                          setCreateCategoryError('');
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-md"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Author */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Author Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="author"
                value={formData.author}
                onChange={handleInputChange}
                placeholder="Your name or team name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-spanish-red transition-colors"
                required
              />
            </div>

            {/* Flags */}
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-900">Article Status</p>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="isBreaking"
                  checked={formData.isBreaking}
                  onChange={handleInputChange}
                  className="w-4 h-4 rounded border-gray-300 text-spanish-red focus:ring-spanish-red"
                />
                <span className="text-sm text-gray-700">Mark as Breaking News</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="isTrending"
                  checked={formData.isTrending}
                  onChange={handleInputChange}
                  className="w-4 h-4 rounded border-gray-300 text-spanish-red focus:ring-spanish-red"
                />
                <span className="text-sm text-gray-700">Mark as Trending</span>
              </label>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isLoading || isLoadingImage}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-spanish-red text-white font-medium rounded-lg hover:bg-guardsman-red transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading || isLoadingImage ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Publish Article
                  </>
                )}
              </button>
              <Link href="/admin">
                <button
                  type="button"
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </Link>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

