'use client';
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Upload, AlertCircle, CheckCircle, Image as ImageIcon, Loader } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import RichTextEditor from '@/components/forms/RichTextEditor';
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
const AUTOSAVE_INTERVAL_MS = 15000;
const DRAFT_STORAGE_PREFIX = 'lokswami:article-draft:edit:';

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

type ArticleSeo = {
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  canonicalUrl?: string;
};

type RevisionItem = {
  _id?: string;
  title?: string;
  summary?: string;
  savedAt?: string;
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

export default function EditArticle() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const routeId = Array.isArray(params?.id) ? params.id[0] || '' : params?.id || '';
  const articleId = decodeURIComponent(routeId);
  const draftStorageKey = `${DRAFT_STORAGE_PREFIX}${articleId}`;

  const [formData, setFormData] = useState<ArticleFormState>(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategorySlug, setNewCategorySlug] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [createCategoryError, setCreateCategoryError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [contentMode, setContentMode] = useState<'write' | 'preview'>('write');
  const [draftSavedAt, setDraftSavedAt] = useState('');
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [revisions, setRevisions] = useState<RevisionItem[]>([]);
  const [isLoadingRevisions, setIsLoadingRevisions] = useState(false);
  const [restoringRevisionId, setRestoringRevisionId] = useState('');
  const [imageQualityNote, setImageQualityNote] = useState('');

  const previewContentHtml = useMemo(() => {
    const source = formData.content.trim() || formData.summary.trim();
    if (!source) return '<p>Start writing your article to see a live preview.</p>';
    return renderArticleRichContent(source);
  }, [formData.content, formData.summary]);

  const fetchRevisions = useCallback(async () => {
    if (!articleId) return;
    setIsLoadingRevisions(true);
    try {
      const response = await fetch(`/api/admin/articles/${encodeURIComponent(articleId)}/revisions`, {
        headers: { ...getAuthHeader() },
        cache: 'no-store',
      });
      const data = await response.json();
      setRevisions(response.ok && data?.success && Array.isArray(data.data) ? data.data : []);
    } catch {
      setRevisions([]);
    } finally {
      setIsLoadingRevisions(false);
    }
  }, [articleId]);

  const fetchArticle = useCallback(async () => {
    if (!articleId) {
      setIsLoading(false);
      setDraftReady(true);
      return;
    }

    setIsLoading(true);
    setDraftReady(false);
    try {
      const response = await fetch(`/api/admin/articles/${encodeURIComponent(articleId)}`, {
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok || !data?.success || !data?.data) {
        setError('Failed to load article');
        return;
      }

      const article = data.data as {
        title?: string;
        summary?: string;
        content?: string;
        category?: string;
        author?: string;
        image?: string;
        isBreaking?: boolean;
        isTrending?: boolean;
        seo?: ArticleSeo;
      };

      const baseForm: ArticleFormState = {
        title: article.title || '',
        summary: article.summary || '',
        content: article.content || '',
        category: article.category || 'National',
        author: article.author || '',
        isBreaking: Boolean(article.isBreaking),
        isTrending: Boolean(article.isTrending),
        seoTitle: article.seo?.metaTitle || '',
        seoDescription: article.seo?.metaDescription || '',
        ogImage: article.seo?.ogImage || '',
        canonicalUrl: article.seo?.canonicalUrl || '',
      };

      let nextForm = baseForm;
      let nextImage = article.image || '';
      let nextMode: 'write' | 'preview' = 'write';
      let nextSavedAt = '';
      let restored = false;

      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem(draftStorageKey);
          if (raw) {
            const parsed = JSON.parse(raw) as {
              savedAt?: string;
              formData?: Partial<ArticleFormState>;
              imagePreview?: string;
              contentMode?: 'write' | 'preview';
            };
            if (parsed.formData) {
              const shouldRestore = window.confirm(
                'Unsaved local draft found for this article. Do you want to restore it?'
              );
              if (shouldRestore) {
                nextForm = { ...baseForm, ...parsed.formData };
                nextImage = parsed.imagePreview?.trim() ? parsed.imagePreview : nextImage;
                nextMode = parsed.contentMode === 'preview' ? 'preview' : 'write';
                nextSavedAt = parsed.savedAt || '';
                restored = true;
              }
            }
          }
        } catch {
          // ignore malformed draft payload
        }
      }

      setFormData(nextForm);
      setImagePreview(nextImage);
      setContentMode(nextMode);
      setDraftSavedAt(nextSavedAt);
      setDraftRestored(restored);
    } catch {
      setError('Failed to load article');
    } finally {
      setIsLoading(false);
      setDraftReady(true);
    }
  }, [articleId, draftStorageKey]);

  useEffect(() => {
    fetchArticle();
    fetchRevisions();
  }, [fetchArticle, fetchRevisions]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch('/api/admin/categories');
        const data = await response.json();
        if (response.ok && Array.isArray(data.data) && data.data.length) {
          const nextCategories = data.data.map((c: { name: string }) => c.name);
          setCategories(nextCategories);
          setFormData((current) => ({
            ...current,
            category: nextCategories.includes(current.category) ? current.category : nextCategories[0],
          }));
        }
      } catch {
        // keep defaults
      }
    };
    loadCategories();
  }, []);

  const persistDraft = useCallback(() => {
    if (!draftReady || typeof window === 'undefined' || !articleId) return;
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
    localStorage.setItem(draftStorageKey, JSON.stringify(payload));
    setDraftSavedAt(payload.savedAt);
  }, [articleId, contentMode, draftReady, draftStorageKey, formData, imagePreview]);

  const clearDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(draftStorageKey);
    setDraftSavedAt('');
    setDraftRestored(false);
  }, [draftStorageKey]);

  useEffect(() => {
    if (!draftReady || typeof window === 'undefined') return;
    const intervalId = window.setInterval(persistDraft, AUTOSAVE_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [draftReady, persistDraft]);

  useEffect(() => {
    if (!draftReady || typeof window === 'undefined') return;
    const onBeforeUnload = () => persistDraft();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
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

  const uploadImage = async () => {
    if (!imageFile) return imagePreview;
    setIsLoadingImage(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('file', imageFile);
      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { ...getAuthHeader() },
        body: formDataToSend,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to upload image');
      return data.data.url as string;
    } catch {
      setError('Failed to upload image. Please try again.');
      throw new Error('upload-failed');
    } finally {
      setIsLoadingImage(false);
    }
  };

  const handleRestoreRevision = async (revisionId: string) => {
    const shouldRestore = window.confirm(
      'Restore this revision? Current unsaved changes will be replaced.'
    );
    if (!shouldRestore) return;

    setRestoringRevisionId(revisionId);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(
        `/api/admin/articles/${encodeURIComponent(articleId)}/revisions/${encodeURIComponent(revisionId)}/restore`,
        { method: 'POST', headers: { ...getAuthHeader() } }
      );
      const data = await response.json();
      if (!response.ok || !data?.success || !data?.data) {
        setError(data?.error || 'Failed to restore revision');
        return;
      }

      const article = data.data as {
        title?: string;
        summary?: string;
        content?: string;
        category?: string;
        author?: string;
        image?: string;
        isBreaking?: boolean;
        isTrending?: boolean;
        seo?: ArticleSeo;
      };

      setFormData({
        title: article.title || '',
        summary: article.summary || '',
        content: article.content || '',
        category: article.category || 'National',
        author: article.author || '',
        isBreaking: Boolean(article.isBreaking),
        isTrending: Boolean(article.isTrending),
        seoTitle: article.seo?.metaTitle || '',
        seoDescription: article.seo?.metaDescription || '',
        ogImage: article.seo?.ogImage || '',
        canonicalUrl: article.seo?.canonicalUrl || '',
      });
      setImagePreview(article.image || '');
      setImageFile(null);
      setImageQualityNote('');
      setContentMode('write');
      clearDraft();
      setSuccess('Revision restored successfully.');
      await fetchRevisions();
    } catch {
      setError('Failed to restore revision. Please try again.');
    } finally {
      setRestoringRevisionId('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      if (!formData.title || !formData.summary || !formData.content || !formData.author || !imagePreview) {
        setError('Please fill in all required fields');
        setIsSaving(false);
        return;
      }

      if (formData.canonicalUrl.trim() && !isValidAbsoluteHttpUrl(formData.canonicalUrl.trim())) {
        setError('Canonical URL must start with http:// or https://');
        setIsSaving(false);
        return;
      }

      if (
        formData.ogImage.trim() &&
        !formData.ogImage.trim().startsWith('/') &&
        !isValidAbsoluteHttpUrl(formData.ogImage.trim())
      ) {
        setError('OG image must be an absolute URL or local path starting with /');
        setIsSaving(false);
        return;
      }

      let imageUrl = imagePreview;
      if (imageFile) imageUrl = await uploadImage();
      const resolvedOgImage =
        formData.ogImage.trim() || resolveArticleOgImageUrl({ image: imageUrl });

      const response = await fetch(`/api/admin/articles/${encodeURIComponent(articleId)}`, {
        method: 'PUT',
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
        setError(data.error || 'Failed to update article');
        setIsSaving(false);
        return;
      }

      setSuccess('Article updated successfully! Redirecting...');
      setImageFile(null);
      clearDraft();
      setTimeout(() => router.push('/admin/articles'), 1500);
    } catch {
      setError('Failed to update article. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 text-spanish-red animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading article...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
      <Link href="/admin/articles" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors">
        <ArrowLeft className="w-5 h-5" />
        Back to Articles
      </Link>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit Article</h1>
          <p className="text-gray-600 mb-8">Update your article details and content</p>

          {error ? <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex gap-2"><AlertCircle className="w-5 h-5 shrink-0" />{error}</div> : null}
          {success ? <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 flex gap-2"><CheckCircle className="w-5 h-5 shrink-0" />{success}</div> : null}

          <div className="mb-6 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="font-medium">Draft & Revision Tools</p>
            <p className="mt-1 text-blue-800">
              Draft autosaves every {AUTOSAVE_INTERVAL_MS / 1000} seconds.
              {draftSavedAt ? ` Last saved: ${formatDraftTimestamp(draftSavedAt)}.` : ' No local draft yet.'}
            </p>
            {draftRestored ? <p className="mt-1 text-blue-800">Local draft restored for this article.</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={persistDraft} className="rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100">Save Draft Now</button>
              <button type="button" onClick={clearDraft} className="rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100">Discard Local Draft</button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Article Title <span className="text-red-500">*</span></label>
              <input type="text" name="title" value={formData.title} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-spanish-red transition-colors" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Summary <span className="text-red-500">*</span></label>
              <textarea name="summary" value={formData.summary} onChange={handleInputChange} rows={2} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-spanish-red transition-colors" required />
            </div>

            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-900">SEO Settings</p>
              <input type="text" name="seoTitle" value={formData.seoTitle} onChange={handleInputChange} placeholder="Meta title (max 160)" maxLength={160} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-spanish-red transition-colors" />
              <textarea name="seoDescription" value={formData.seoDescription} onChange={handleInputChange} placeholder="Meta description (max 320)" rows={3} maxLength={320} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-spanish-red transition-colors" />
              <input type="text" name="ogImage" value={formData.ogImage} onChange={handleInputChange} placeholder="OG image URL or /local-path" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-spanish-red transition-colors" />
              <p className="-mt-2 text-xs text-gray-500">
                Leave empty to auto-use featured image as 1200x630 OG preview.
              </p>
              <input type="url" name="canonicalUrl" value={formData.canonicalUrl} onChange={handleInputChange} placeholder="Canonical URL" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-spanish-red transition-colors" />
            </div>

	            <div>
	              <label className="block text-sm font-medium text-gray-900 mb-2">Featured Image <span className="text-red-500">*</span></label>
	              <label className="flex items-center justify-center w-full px-4 py-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-spanish-red hover:bg-gray-50 transition-colors">
                <div className="flex flex-col items-center gap-2">
                  <ImageIcon className="w-6 h-6 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">Click to change image</span>
                </div>
	                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
	              </label>
	              <p className="mt-2 text-xs text-gray-500">{ARTICLE_IMAGE_UPLOAD_GUIDE}</p>
	              {imageQualityNote ? (
	                <p className="mt-1 text-xs font-medium text-amber-700">{imageQualityNote}</p>
	              ) : null}
	              {imagePreview ? (
	                <div className="mt-4 rounded-lg overflow-hidden border border-gray-200">
	                  <img src={imagePreview} alt="Preview" className="w-full h-64 object-cover" />
	                </div>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Article Content <span className="text-red-500">*</span></label>
              <p className="mb-2 text-xs text-gray-500">Tip: Paste a YouTube link on its own line or use the YouTube button in the toolbar.</p>
              <div className="mb-3 inline-flex overflow-hidden rounded-lg border border-gray-300">
                <button type="button" onClick={() => setContentMode('write')} className={`px-4 py-1.5 text-sm font-medium ${contentMode === 'write' ? 'bg-spanish-red text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>Write</button>
                <button type="button" onClick={() => setContentMode('preview')} className={`px-4 py-1.5 text-sm font-medium ${contentMode === 'preview' ? 'bg-spanish-red text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>Preview</button>
              </div>
              {contentMode === 'write' ? (
                <RichTextEditor value={formData.content} onChange={(content) => setFormData((current) => ({ ...current, content }))} />
              ) : (
                <div className="rounded-lg border border-gray-300 bg-white p-4">
                  <h3 className="text-lg font-bold text-gray-900">{formData.title.trim() || 'Untitled article'}</h3>
                  <p className="mt-1 text-sm text-gray-600">{formData.summary.trim() || 'Summary preview will appear here.'}</p>
                  <div className="my-4 h-px bg-gray-200" />
                  <div className="article-rich-content text-gray-800" dangerouslySetInnerHTML={{ __html: previewContentHtml }} />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Category <span className="text-red-500">*</span></label>
              <select name="category" value={formData.category} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-spanish-red transition-colors">
                {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateCategory((s) => !s)}
                  className="text-sm text-spanish-red font-medium hover:underline"
                >
                  {showCreateCategory ? 'Cancel' : '+ Create new category'}
                </button>

                {showCreateCategory ? (
                  <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                    {createCategoryError ? <div className="text-sm text-red-600">{createCategoryError}</div> : null}
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
                            const response = await fetch('/api/admin/categories', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                ...getAuthHeader(),
                              },
                              body: JSON.stringify({
                                name: newCategoryName.trim(),
                                slug: newCategorySlug.trim() || undefined,
                              }),
                            });
                            const data = await response.json();
                            if (!response.ok) {
                              throw new Error(data?.error || 'Failed to create category');
                            }
                            const created = data.data as { name: string };
                            setCategories((current) => [created.name, ...current.filter((item) => item !== created.name)]);
                            setFormData((current) => ({ ...current, category: created.name }));
                            setNewCategoryName('');
                            setNewCategorySlug('');
                            setShowCreateCategory(false);
                          } catch (err: unknown) {
                            setCreateCategoryError(
                              err instanceof Error ? err.message : 'Failed to create category'
                            );
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
                ) : null}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Author Name <span className="text-red-500">*</span></label>
              <input type="text" name="author" value={formData.author} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-spanish-red transition-colors" required />
            </div>

            <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-900">Article Status</p>
              <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" name="isBreaking" checked={formData.isBreaking} onChange={handleInputChange} className="w-4 h-4 rounded border-gray-300 text-spanish-red focus:ring-spanish-red" /><span className="text-sm text-gray-700">Mark as Breaking News</span></label>
              <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" name="isTrending" checked={formData.isTrending} onChange={handleInputChange} className="w-4 h-4 rounded border-gray-300 text-spanish-red focus:ring-spanish-red" /><span className="text-sm text-gray-700">Mark as Trending</span></label>
            </div>

            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">Revision History</p>
                <button type="button" onClick={fetchRevisions} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100">{isLoadingRevisions ? 'Refreshing...' : 'Refresh'}</button>
              </div>
              {isLoadingRevisions ? <p className="text-sm text-gray-600">Loading revisions...</p> : null}
              {!isLoadingRevisions && revisions.length === 0 ? <p className="text-sm text-gray-600">No revisions yet. Save article to create one.</p> : null}
              {!isLoadingRevisions && revisions.length > 0 ? (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {revisions.map((revision, index) => {
                    const revisionId = revision._id || `${revision.savedAt || 'revision'}-${index}`;
                    const isRestoring = restoringRevisionId === revisionId;
                    return (
                      <div key={revisionId} className="rounded-lg border border-gray-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">{revision.title?.trim() || 'Untitled revision'}</p>
                            <p className="text-xs text-gray-500">{formatDraftTimestamp(revision.savedAt || '') || 'Unknown save time'}</p>
                          </div>
                          <button type="button" disabled={!revision._id || isRestoring} onClick={() => revision._id && handleRestoreRevision(revision._id)} className="shrink-0 rounded-md border border-spanish-red px-3 py-1.5 text-xs font-semibold text-spanish-red hover:bg-red-50 disabled:opacity-50">
                            {isRestoring ? 'Restoring...' : 'Restore'}
                          </button>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-gray-600">{revision.summary?.trim() || 'No summary in this revision.'}</p>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="flex gap-3 pt-4">
              <button type="submit" disabled={isSaving || isLoadingImage} className="flex-1 flex items-center justify-center gap-2 py-3 bg-spanish-red text-white font-medium rounded-lg hover:bg-guardsman-red transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {isSaving || isLoadingImage ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</> : <><Upload className="w-5 h-5" />Save Changes</>}
              </button>
              <Link href="/admin/articles">
                <button type="button" className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              </Link>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
