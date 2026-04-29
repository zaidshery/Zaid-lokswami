'use client';
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft,
  Link2,
  Loader2,
  Upload,
  AlertCircle,
  CheckCircle,
  Image as ImageIcon,
} from 'lucide-react';
import ArticleEditorStudio, {
  ArticleEditorSidebar,
  type ArticleEditorStudioMode,
} from '@/components/forms/ArticleEditorStudio';
import {
  CmsEditorCanvas,
  CmsEditorColumns,
  CmsEditorMain,
  CmsEditorSidebar,
} from '@/components/admin/CmsEditorLayout';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAuthHeader } from '@/lib/auth/clientToken';
import { NEWS_CATEGORIES } from '@/lib/constants/newsCategories';
import { formatUiDateTime } from '@/lib/utils/dateFormat';
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
  locationTag: string;
  sourceInfo: string;
  sourceConfidential: boolean;
  reporterNotes: string;
  isBreaking: boolean;
  isTrending: boolean;
  seoTitle: string;
  seoDescription: string;
  ogImage: string;
  canonicalUrl: string;
};

type SourceStoryRecord = {
  _id: string;
  title: string;
  caption: string;
  category: string;
  author: string;
  thumbnail: string;
  linkedArticleId?: string;
  linkedArticleStatus?: string;
  reporterMeta?: {
    locationTag?: string;
    sourceInfo?: string;
    sourceConfidential?: boolean;
    reporterNotes?: string;
  } | null;
};

const EMPTY_FORM: ArticleFormState = {
  title: '',
  summary: '',
  content: '',
  category: 'National',
  author: '',
  locationTag: '',
  sourceInfo: '',
  sourceConfidential: false,
  reporterNotes: '',
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
  const searchParams = useSearchParams();
  const { data: session } = useSession();
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
  const [contentMode, setContentMode] = useState<ArticleEditorStudioMode>('write');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState('');
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [imageQualityNote, setImageQualityNote] = useState('');
  const [sourceStory, setSourceStory] = useState<SourceStoryRecord | null>(null);
  const [isLoadingSourceStory, setIsLoadingSourceStory] = useState(false);
  const [sourceStoryError, setSourceStoryError] = useState('');
  const [sourcePrefillApplied, setSourcePrefillApplied] = useState(false);

  const sourceStoryId = searchParams.get('sourceStoryId')?.trim() || '';
  const canPublishImmediately =
    session?.user?.role === 'admin' || session?.user?.role === 'super_admin';
  const canCreateCategories =
    session?.user?.role === 'admin' || session?.user?.role === 'super_admin';
  const submitLabel = canPublishImmediately ? 'Publish Article' : 'Submit Article';
  const submitVerb = canPublishImmediately ? 'Publishing' : 'Submitting';
  const successMessage = canPublishImmediately
    ? 'Article published successfully! Redirecting...'
    : 'Article submitted for review! Redirecting...';

  const persistDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    const hasAnyContent = Boolean(
      formData.title.trim() ||
      formData.summary.trim() ||
        formData.content.trim() ||
        formData.author.trim() ||
        formData.locationTag.trim() ||
        formData.sourceInfo.trim() ||
        formData.reporterNotes.trim() ||
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
      focusMode: isFocusMode,
    };

    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
    setDraftSavedAt(payload.savedAt);
  }, [formData, imagePreview, contentMode, isFocusMode]);

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
        contentMode?: ArticleEditorStudioMode;
        focusMode?: boolean;
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
        if (
          parsed.contentMode === 'write' ||
          parsed.contentMode === 'split' ||
          parsed.contentMode === 'preview'
        ) {
          setContentMode(parsed.contentMode);
        }
        if (typeof parsed.focusMode === 'boolean') {
          setIsFocusMode(parsed.focusMode);
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

  useEffect(() => {
    const sessionName = session?.user?.name?.trim() || '';
    if (!sessionName) return;
    setFormData((current) =>
      current.author.trim()
        ? current
        : { ...current, author: sessionName }
    );
  }, [session?.user?.name]);

  useEffect(() => {
    if (!sourceStoryId) {
      setSourceStory(null);
      setSourceStoryError('');
      setSourcePrefillApplied(false);
      return;
    }

    let isMounted = true;

    const loadSourceStory = async () => {
      setIsLoadingSourceStory(true);
      setSourceStoryError('');
      try {
        const response = await fetch(`/api/admin/stories/${encodeURIComponent(sourceStoryId)}`, {
          headers: {
            ...getAuthHeader(),
          },
          cache: 'no-store',
        });
        const data = (await response.json().catch(() => ({}))) as {
          success?: boolean;
          error?: string;
          data?: SourceStoryRecord;
        };

        if (!response.ok || !data.success || !data.data) {
          throw new Error(data.error || 'Failed to load source story');
        }

        if (!isMounted) return;
        setSourceStory(data.data);
      } catch (err) {
        if (!isMounted) return;
        setSourceStoryError(
          err instanceof Error ? err.message : 'Failed to load source story'
        );
      } finally {
        if (isMounted) {
          setIsLoadingSourceStory(false);
        }
      }
    };

    void loadSourceStory();

    return () => {
      isMounted = false;
    };
  }, [sourceStoryId]);

  useEffect(() => {
    if (!sourceStory || sourcePrefillApplied) return;

    setFormData((current) => ({
      ...current,
      title: current.title.trim() ? current.title : sourceStory.title || '',
      summary: current.summary.trim() ? current.summary : sourceStory.caption || '',
      category:
        current.category.trim() && current.category !== EMPTY_FORM.category
          ? current.category
          : sourceStory.category || current.category,
      author: current.author.trim() ? current.author : sourceStory.author || current.author,
      locationTag:
        current.locationTag.trim()
          ? current.locationTag
          : sourceStory.reporterMeta?.locationTag || '',
      sourceInfo:
        current.sourceInfo.trim()
          ? current.sourceInfo
          : sourceStory.reporterMeta?.sourceInfo || '',
      sourceConfidential:
        current.sourceConfidential || Boolean(sourceStory.reporterMeta?.sourceConfidential),
      reporterNotes:
        current.reporterNotes.trim()
          ? current.reporterNotes
          : sourceStory.reporterMeta?.reporterNotes || '',
    }));

    if (!imagePreview.trim() && sourceStory.thumbnail.trim()) {
      setImagePreview(sourceStory.thumbnail);
    }
    setSourcePrefillApplied(true);
  }, [imagePreview, sourcePrefillApplied, sourceStory]);

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
          intent: canPublishImmediately ? 'publish' : 'submit',
          title: formData.title,
          summary: formData.summary,
          content: formData.content,
          category: formData.category,
          author: formData.author,
          reporterMeta: {
            locationTag: formData.locationTag,
            sourceInfo: formData.sourceInfo,
            sourceConfidential: formData.sourceConfidential,
            reporterNotes: formData.reporterNotes,
          },
          isBreaking: formData.isBreaking,
          isTrending: formData.isTrending,
          image: imageUrl,
          seo: {
            metaTitle: formData.seoTitle,
            metaDescription: formData.seoDescription,
            ogImage: resolvedOgImage,
            canonicalUrl: formData.canonicalUrl,
          },
          ...(sourceStoryId ? { sourceStoryId } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to publish article');
        setIsLoading(false);
        return;
      }

      setSuccess(successMessage);
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
      >
        <CmsEditorCanvas>
        <div className="rounded-[20px] border border-gray-200 bg-white p-3 shadow-sm sm:rounded-[28px] sm:p-6 xl:p-8">
          <h1 className="mb-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            {sourceStoryId ? 'Create Article From Story' : 'Create Direct Desk Article'}
          </h1>
          <p className="mb-5 text-sm leading-6 text-gray-600 sm:mb-8">
            {sourceStoryId
              ? 'Turn the approved story package into a polished website article.'
              : 'Write a professional desk article and send it through approval.'}
          </p>

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

          {isFocusMode ? (
            <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              Focus writing mode is on. Publishing controls, SEO, and media settings are hidden so you can stay inside the article draft.
            </div>
          ) : null}

          <form
            onSubmit={handleSubmit}
            className="space-y-4 sm:space-y-8"
          >
            <CmsEditorColumns stacked={isFocusMode} sidebarWidth="narrow">
            <CmsEditorMain>
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

              <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Article Content <span className="text-red-500">*</span>
              </label>
              <details className="mb-3 rounded-lg border border-amber-100 bg-amber-50 text-xs text-amber-900">
                <summary className="cursor-pointer px-3 py-2 font-semibold">
                  Writing tools and embed tips
                </summary>
                <div className="grid gap-3 border-t border-amber-100 p-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className="font-semibold">Headings</p>
                    <p className="mt-1">Use H2 and H3 buttons to break long copy into clean sections.</p>
                  </div>
                  <div>
                    <p className="font-semibold">Inline Images</p>
                    <p className="mt-1">Upload article images with caption and source credit.</p>
                  </div>
                  <div>
                    <p className="font-semibold">Resources & Tables</p>
                    <p className="mt-1">Add source cards, comparison tables, quotes, and links.</p>
                  </div>
                  <div>
                    <p className="font-semibold">Video</p>
                    <p className="mt-1">Paste a YouTube link on its own line or use the toolbar button.</p>
                  </div>
                </div>
              </details>
              <ArticleEditorStudio
                title={formData.title}
                summary={formData.summary}
                content={formData.content}
                mode={contentMode}
                focusMode={isFocusMode}
                showSidebar={false}
                onModeChange={setContentMode}
                onFocusModeChange={setIsFocusMode}
                onContentChange={(content) =>
                  setFormData((current) => ({ ...current, content }))
                }
                editorClassName="min-h-[260px] sm:min-h-64"
                placeholder="Write your article here. Use the toolbar above for formatting."
              />
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
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

                  {canCreateCategories ? (
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
                  ) : null}
                </div>

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
              </div>

              <details className="rounded-lg border border-gray-200 bg-gray-50">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">
                  Reporter submission details
                </summary>
                <div className="space-y-4 border-t border-gray-200 p-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Reporter Submission</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Add location context, source notes, and reporter handoff details for the desk.
                  </p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Location Tag
                    </label>
                    <input
                      type="text"
                      name="locationTag"
                      value={formData.locationTag}
                      onChange={handleInputChange}
                      placeholder="Indore, Madhya Pradesh"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-spanish-red transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Reporter Notes
                    </label>
                    <textarea
                      name="reporterNotes"
                      value={formData.reporterNotes}
                      onChange={handleInputChange}
                      placeholder="Extra context for copy edit, verification, or publishing."
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-spanish-red transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Source Info
                  </label>
                  <textarea
                    name="sourceInfo"
                    value={formData.sourceInfo}
                    onChange={handleInputChange}
                    placeholder="Who provided the information, documents, or quotes?"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-spanish-red transition-colors"
                  />
                </div>
                <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-gray-200 bg-white px-4 py-3">
                  <input
                    type="checkbox"
                    name="sourceConfidential"
                    checked={formData.sourceConfidential}
                    onChange={handleInputChange}
                    className="w-4 h-4 rounded border-gray-300 text-spanish-red focus:ring-spanish-red"
                  />
                  <span className="text-sm text-gray-700">
                    Source is confidential and should stay internal to the desk
                  </span>
                </label>
                </div>
              </details>
            </CmsEditorMain>

            {!isFocusMode ? (
            <CmsEditorSidebar>
              {isLoadingSourceStory ? (
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading source story...
                </div>
              ) : null}

              {sourceStoryError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {sourceStoryError}
                </div>
              ) : null}

              {sourceStory ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        Source Story
                      </p>
                      <p className="mt-1 text-base font-semibold">{sourceStory.title}</p>
                      <p className="mt-1 text-emerald-800/80">
                        This article will stay linked to the approved story package.
                      </p>
                    </div>
                    <Link
                      href={`/admin/stories/${sourceStory._id}/edit`}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Open Source Story
                    </Link>
                  </div>
                  {sourceStory.linkedArticleId ? (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      A linked article already exists for this story. Opening another one from the
                      same source will be blocked.{' '}
                      <Link
                        href={`/admin/articles/${sourceStory.linkedArticleId}/edit`}
                        className="font-semibold underline"
                      >
                        Open linked article
                      </Link>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <details className="rounded-xl border border-blue-100 bg-blue-50 text-sm text-blue-900">
                <summary className="cursor-pointer px-4 py-3 font-medium">Draft & Local Restore</summary>
                <div className="border-t border-blue-100 p-4 pt-3">
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
              </details>

              <details className="rounded-xl border border-gray-200 bg-gray-50">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">
                  SEO Settings
                </summary>
                <div className="space-y-4 border-t border-gray-200 p-4">
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
                  <p className="mt-1 text-xs text-gray-500">
                    Leave empty to use the default public article permalink after publish. You can
                    override it here for migrated or syndicated stories.
                  </p>
                </div>
                </div>
              </details>

              <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
                <label className="block text-sm font-medium text-gray-900 mb-2 sm:mb-3">
                  Featured Image <span className="text-red-500">*</span>
                </label>
                <label className="flex w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-3 py-4 transition-colors hover:border-spanish-red hover:bg-gray-50 sm:px-4 sm:py-6">
                  <div className="flex flex-col items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-gray-400 sm:h-6 sm:w-6" />
                    <span className="text-sm font-medium text-gray-700">Click to upload image</span>
                    <span className="text-xs text-gray-500">PNG, JPG, WebP</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    required={!imagePreview}
                  />
                </label>
                <p className="mt-2 hidden text-xs text-gray-500 sm:block">{ARTICLE_IMAGE_UPLOAD_GUIDE}</p>
                {imageQualityNote ? (
                  <p className="mt-1 text-xs font-medium text-amber-700">{imageQualityNote}</p>
                ) : null}

                {imagePreview && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-3 overflow-hidden rounded-lg border border-gray-200 sm:mt-4"
                  >
                    <img src={imagePreview} alt="Preview" className="h-40 w-full object-cover sm:h-52" />
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

              <details className="rounded-xl border border-gray-200 bg-gray-50">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">
                  Article flags
                </summary>
                <div className="space-y-3 border-t border-gray-200 p-4">
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
                {formData.isBreaking ? (
                  <p className="text-xs text-gray-600">
                    Breaking articles generate reusable voice cache automatically after publish.
                  </p>
                ) : null}
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
              </details>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-900">Ready to send</p>
                <p className="mt-1 text-xs text-gray-600">
                  Submit from here after checking title, summary, featured image, and structure.
                </p>
                <div className="mt-4 flex flex-col gap-3">
                  <button
                    type="submit"
                    disabled={
                      isLoading ||
                      isLoadingImage ||
                      Boolean(sourceStory?.linkedArticleId)
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-spanish-red py-3 text-white font-medium transition-colors hover:bg-guardsman-red disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading || isLoadingImage ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {submitVerb}...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        {submitLabel}
                      </>
                    )}
                  </button>
                  <Link href="/admin" className="w-full">
                    <button
                      type="button"
                      className="w-full rounded-lg border border-gray-300 px-6 py-3 text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </Link>
                </div>
              </div>

              <details className="rounded-xl border border-gray-200 bg-gray-50">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">
                  Article analysis
                </summary>
                <div className="border-t border-gray-200 p-4">
                  <ArticleEditorSidebar
                    title={formData.title}
                    summary={formData.summary}
                    content={formData.content}
                    className="space-y-3"
                  />
                </div>
              </details>
            </CmsEditorSidebar>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-900">Finish & Submit</p>
                <p className="mt-1 text-xs text-gray-600">
                  Exit focus to review SEO, featured image, and publishing details before sending the article.
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="submit"
                    disabled={
                      isLoading ||
                      isLoadingImage ||
                      Boolean(sourceStory?.linkedArticleId)
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-spanish-red py-3 text-white font-medium transition-colors hover:bg-guardsman-red disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading || isLoadingImage ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {submitVerb}...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        {submitLabel}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFocusMode(false)}
                    className="w-full rounded-lg border border-gray-300 px-6 py-3 text-gray-700 transition-colors hover:bg-gray-50 sm:w-auto"
                  >
                    Exit Focus
                  </button>
                </div>
              </div>
            )}
            </CmsEditorColumns>
          </form>
        </div>
        </CmsEditorCanvas>
      </motion.div>
    </div>
  );
}

