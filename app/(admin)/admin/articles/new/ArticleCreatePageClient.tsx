'use client';
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft,
  FileAudio,
  FileText,
  Link2,
  Loader2,
  Search,
  Upload,
  Volume2,
  X,
  AlertCircle,
  CheckCircle,
  CircleDot,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import ArticleEditorStudio, {
  ArticleEditorSidebar,
  type ArticleEditorStudioMode,
} from '@/components/forms/ArticleEditorStudio';
import ArticleFeaturedImageReaderPreview from '@/components/forms/ArticleFeaturedImageReaderPreview';
import ArticleWorkbenchAssistant, {
  getArticleAssistPatchKey,
} from '@/components/forms/ArticleWorkbenchAssistant';
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
import { uploadArticleTtsAudioDirect } from '@/lib/utils/articleTtsUploadClient';
import { uploadBreakingTtsAudioDirect } from '@/lib/utils/breakingTtsUploadClient';
import { buildSpokenBreakingHeadline } from '@/lib/types/breaking';
import { resolveArticleOgImageUrl } from '@/lib/utils/articleMedia';
import {
  buildArticleGooglePreview,
  buildArticlePublicPath,
  isValidArticleSlug,
  normalizeArticleSeo,
  normalizeArticleSlug,
} from '@/lib/seo/articleSeo';
import {
  buildArticleAssistResult,
  suggestArticleFocusKeyword,
  summarizeArticleReadiness,
  type ArticleAssistField,
  type ArticleAssistPatch,
  type ArticleAssistResult,
  type ArticleReadinessItem,
} from '@/lib/utils/articleAssistant';

const DEFAULT_CATEGORIES = NEWS_CATEGORIES.map((category) => category.nameEn);
const DRAFT_STORAGE_KEY = 'lokswami:article-draft:new';
const AUTOSAVE_INTERVAL_MS = 15000;
const ARTICLE_AUDIO_ACCEPT = '.mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4';
const ARTICLE_AUDIO_MAX_BYTES = 50 * 1024 * 1024;
const ARTICLE_AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'm4a']);
const ARTICLE_AUDIO_CONTENT_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a',
]);

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
  seoSlug: string;
  seoTitle: string;
  seoDescription: string;
  ogImage: string;
  canonicalUrl: string;
  focusKeyword: string;
  secondaryKeywords: string;
  featuredImageAlt: string;
  featuredImageCaption: string;
  imageCredit: string;
  authorProfileUrl: string;
  includeInNewsSitemap: boolean;
  majorUpdateNote: string;
};

type RelatedArticleSuggestion = {
  id: string;
  slug?: string;
  title: string;
  category?: string;
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
  seoSlug: '',
  seoTitle: '',
  seoDescription: '',
  ogImage: '',
  canonicalUrl: '',
  focusKeyword: '',
  secondaryKeywords: '',
  featuredImageAlt: '',
  featuredImageCaption: '',
  imageCredit: '',
  authorProfileUrl: '',
  includeInNewsSitemap: true,
  majorUpdateNote: '',
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

function normalizeDraftArticleSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .slice(0, 200);
}

function formatArticleAudioSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function getArticleAudioExtension(fileName: string) {
  const segments = fileName.trim().toLowerCase().split('.');
  return segments.length > 1 ? segments.pop() || '' : '';
}

function validateArticleAudioFile(file: File | null, label = 'Article') {
  if (!file) return '';

  const extension = getArticleAudioExtension(file.name);
  const type = file.type.trim().toLowerCase();
  if (!ARTICLE_AUDIO_EXTENSIONS.has(extension)) {
    return `${label} audio must be MP3, WAV, or M4A.`;
  }
  if (type && !ARTICLE_AUDIO_CONTENT_TYPES.has(type) && !type.startsWith('audio/')) {
    return `${label} audio must be MP3, WAV, or M4A.`;
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return 'File size is invalid.';
  }
  if (file.size > ARTICLE_AUDIO_MAX_BYTES) {
    return `${label} audio must be 50MB or smaller.`;
  }

  return '';
}

function getReadinessStatusClass(status: ArticleReadinessItem['status']) {
  switch (status) {
    case 'done':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-100';
    case 'blocked':
      return 'border-red-200 bg-red-50 text-red-900 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-100';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-300/30 dark:bg-amber-400/10 dark:text-amber-100';
    default:
      return 'border-gray-200 bg-white text-gray-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300';
  }
}

function getReadinessIcon(item: ArticleReadinessItem) {
  if (item.status === 'done') {
    return <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-200" />;
  }
  if (item.status === 'blocked') {
    return <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-200" />;
  }
  if (item.status === 'warning') {
    return <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-200" />;
  }
  return <CircleDot className="h-4 w-4 text-gray-400 dark:text-gray-300" />;
}

function createArticleAudioPreviewUrl(file: File) {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return '';
  }

  return URL.createObjectURL(file);
}

function resolveCreatedArticleId(payload: unknown) {
  if (!payload || typeof payload !== 'object') return '';
  const source = payload as Record<string, unknown>;
  return String(source._id || source.id || '').trim();
}

export default function UploadArticle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [formData, setFormData] = useState<ArticleFormState>(EMPTY_FORM);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [articleAudioFile, setArticleAudioFile] = useState<File | null>(null);
  const [articleAudioPreviewUrl, setArticleAudioPreviewUrl] = useState('');
  const [articleAudioValidationError, setArticleAudioValidationError] = useState('');
  const [isUploadingArticleAudio, setIsUploadingArticleAudio] = useState(false);
  const [breakingAudioFile, setBreakingAudioFile] = useState<File | null>(null);
  const [breakingAudioPreviewUrl, setBreakingAudioPreviewUrl] = useState('');
  const [breakingAudioValidationError, setBreakingAudioValidationError] = useState('');
  const [isUploadingBreakingAudio, setIsUploadingBreakingAudio] = useState(false);
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
  const [isSeoSlugTouched, setIsSeoSlugTouched] = useState(false);
  const [relatedArticles, setRelatedArticles] = useState<RelatedArticleSuggestion[]>([]);
  const [assistResult, setAssistResult] = useState<ArticleAssistResult | null>(null);
  const [assistError, setAssistError] = useState('');
  const [isAssistLoading, setIsAssistLoading] = useState(false);
  const [rejectedAssistPatchKeys, setRejectedAssistPatchKeys] = useState<Set<string>>(
    () => new Set()
  );

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
  const submitBusy = isLoading || isLoadingImage || isUploadingArticleAudio || isUploadingBreakingAudio;
  const submitBusyLabel = isUploadingBreakingAudio
    ? 'Uploading breaking audio...'
    : isUploadingArticleAudio
      ? 'Uploading audio...'
      : `${submitVerb}...`;

  const buildAssistPayload = useCallback(() => ({
    mode: 'create' as const,
    title: formData.title,
    summary: formData.summary,
    content: formData.content,
    category: formData.category,
    author: formData.author,
    image: imagePreview ? 'featured-image-ready' : '',
    seoSlug: formData.seoSlug,
    seo: {
      metaTitle: formData.seoTitle,
      metaDescription: formData.seoDescription,
      ogImage: formData.ogImage,
      canonicalUrl: formData.canonicalUrl,
      focusKeyword: formData.focusKeyword,
      secondaryKeywords: formData.secondaryKeywords,
      featuredImageAlt: formData.featuredImageAlt,
      featuredImageCaption: formData.featuredImageCaption,
      imageCredit: formData.imageCredit,
      authorProfileUrl: formData.authorProfileUrl,
      includeInNewsSitemap: formData.includeInNewsSitemap,
      majorUpdateNote: formData.majorUpdateNote,
    },
    isBreaking: formData.isBreaking,
    isTrending: formData.isTrending,
    language: 'hi' as const,
    breakingAudioReady: !formData.isBreaking || Boolean(breakingAudioFile),
    requireBreakingAudio: canPublishImmediately && formData.isBreaking,
    listenAudioReady: Boolean(articleAudioFile),
  }), [articleAudioFile, breakingAudioFile, canPublishImmediately, formData, imagePreview]);

  const liveAssistResult = useMemo(
    () => buildArticleAssistResult(buildAssistPayload()),
    [buildAssistPayload]
  );
  const liveReadinessSummary = useMemo(
    () => summarizeArticleReadiness(liveAssistResult.readiness),
    [liveAssistResult]
  );

  const breakingRecordingScript = useMemo(
    () =>
      buildSpokenBreakingHeadline({
        id: 'breaking-preview',
        title: formData.title.trim() || 'Untitled breaking headline',
        ...(formData.locationTag.trim() ? { city: formData.locationTag.trim() } : {}),
      }),
    [formData.locationTag, formData.title]
  );

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
        formData.seoSlug.trim() ||
        formData.seoTitle.trim() ||
        formData.seoDescription.trim() ||
        formData.ogImage.trim() ||
        formData.canonicalUrl.trim() ||
        formData.focusKeyword.trim() ||
        formData.secondaryKeywords.trim() ||
        formData.featuredImageAlt.trim() ||
        formData.featuredImageCaption.trim() ||
        formData.imageCredit.trim() ||
        formData.authorProfileUrl.trim() ||
        formData.majorUpdateNote.trim() ||
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
    return () => {
      if (articleAudioPreviewUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(articleAudioPreviewUrl);
      }
    };
  }, [articleAudioPreviewUrl]);

  useEffect(() => {
    return () => {
      if (breakingAudioPreviewUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(breakingAudioPreviewUrl);
      }
    };
  }, [breakingAudioPreviewUrl]);

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

  useEffect(() => {
    let active = true;

    const loadRelatedArticles = async () => {
      try {
        const response = await fetch('/api/articles/latest?limit=50', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json();
        const rows = Array.isArray(payload?.items) ? payload.items : [];
        if (!active) return;
        setRelatedArticles(
          rows
            .map((item: Record<string, unknown>) => ({
              id: String(item._id || item.id || ''),
              slug: typeof item.slug === 'string' ? item.slug : undefined,
              title: String(item.title || ''),
              category: typeof item.category === 'string' ? item.category : undefined,
            }))
            .filter((item: RelatedArticleSuggestion) => item.id && item.title)
        );
      } catch {
        // Suggestions are helpful, not required for article submission.
      }
    };

    void loadRelatedArticles();

    return () => {
      active = false;
    };
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const nextValue = name === 'seoSlug' ? normalizeDraftArticleSlug(value) : value;
    if (name === 'seoSlug') {
      setIsSeoSlugTouched(true);
    }
    setFormData((current) => {
      const next = {
        ...current,
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : nextValue,
      };

      if (name === 'title') {
        if (!current.seoTitle.trim()) next.seoTitle = String(nextValue).slice(0, 160);
        if (!current.featuredImageAlt.trim()) {
          next.featuredImageAlt = String(nextValue).slice(0, 220);
        }
        if (!current.focusKeyword.trim()) {
          next.focusKeyword = suggestArticleFocusKeyword(String(nextValue)).slice(0, 120);
        }
        if (!isSeoSlugTouched) {
          next.seoSlug = normalizeArticleSlug(String(nextValue));
        }
      }

      if (name === 'summary' && !current.seoDescription.trim()) {
        next.seoDescription = String(nextValue).slice(0, 320);
      }

      if (name === 'seoTitle' && !isSeoSlugTouched) {
        next.seoSlug = normalizeArticleSlug(String(nextValue));
      }

      return next;
    });
  };

  const runArticleAssist = async () => {
    setIsAssistLoading(true);
    setAssistError('');
    try {
      const response = await fetch('/api/admin/articles/assist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify(buildAssistPayload()),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        data?: ArticleAssistResult;
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || 'Article assist failed');
      }

      setRejectedAssistPatchKeys(new Set());
      setAssistResult(payload.data);
    } catch (assistError) {
      setAssistError(
        assistError instanceof Error ? assistError.message : 'Article assist failed'
      );
    } finally {
      setIsAssistLoading(false);
    }
  };

  const applyAssistPatch = (patch: ArticleAssistPatch) => {
    if (patch.field === 'seoSlug') {
      setIsSeoSlugTouched(true);
    }

    setFormData((current) => {
      if (!(patch.field in current)) return current;
      const currentValue = current[patch.field as keyof ArticleFormState];
      if (typeof currentValue !== 'string') return current;

      return {
        ...current,
        [patch.field]: patch.suggestedValue,
      };
    });

    setRejectedAssistPatchKeys((current) => {
      const next = new Set(current);
      next.add(getArticleAssistPatchKey(patch));
      return next;
    });
  };

  const applyAssistPatches = (patches: ArticleAssistPatch[]) => {
    if (!patches.length) return;

    if (patches.some((patch) => patch.field === 'seoSlug')) {
      setIsSeoSlugTouched(true);
    }

    setFormData((current) => {
      let next = current;

      patches.forEach((patch) => {
        if (!(patch.field in next)) return;
        const currentValue = next[patch.field as keyof ArticleFormState];
        if (typeof currentValue !== 'string') return;

        next = {
          ...next,
          [patch.field]: patch.suggestedValue,
        };
      });

      return next;
    });

    setRejectedAssistPatchKeys((current) => {
      const next = new Set(current);
      patches.forEach((patch) => next.add(getArticleAssistPatchKey(patch)));
      return next;
    });
  };

  const rejectAssistPatch = (patch: ArticleAssistPatch) => {
    setRejectedAssistPatchKeys((current) => {
      const next = new Set(current);
      next.add(getArticleAssistPatchKey(patch));
      return next;
    });
  };

  const focusWorkbenchField = useCallback((field: ArticleAssistField) => {
    if (typeof document === 'undefined') return;
    const fieldSelectors: Partial<Record<ArticleAssistField, string>> = {
      title: '[name="title"]',
      summary: '[name="summary"]',
      content:
        '[data-article-field="content"] [contenteditable="true"], [data-article-field="content"] textarea, [data-article-field="content"]',
      category: '[name="category"]',
      author: '[name="author"]',
      image: '[data-article-field="image"]',
      seoTitle: '[name="seoTitle"]',
      seoDescription: '[name="seoDescription"]',
      seoSlug: '[name="seoSlug"]',
      focusKeyword: '[name="focusKeyword"]',
      secondaryKeywords: '[name="secondaryKeywords"]',
      featuredImageAlt: '[name="featuredImageAlt"]',
      featuredImageCaption: '[name="featuredImageCaption"]',
      imageCredit: '[name="imageCredit"]',
      canonicalUrl: '[name="canonicalUrl"]',
      authorProfileUrl: '[name="authorProfileUrl"]',
      breakingAudio: '[data-article-field="breakingAudio"], [name="isBreaking"]',
    };
    const selector = fieldSelectors[field] || `[name="${field}"]`;
    const element = document.querySelector<HTMLElement>(selector);
    const details = element?.closest('details') as HTMLDetailsElement | null;
    if (details) details.open = true;
    if (typeof element?.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    const focusTarget = element?.matches('input, textarea, select, button, [contenteditable="true"]')
      ? element
      : element?.querySelector<HTMLElement>('input, textarea, select, button, [contenteditable="true"]');
    window.setTimeout(() => focusTarget?.focus(), 0);
  }, []);

  const focusReadinessItem = useCallback(
    (item?: ArticleReadinessItem) => {
      if (item?.field) {
        focusWorkbenchField(item.field);
      }
    },
    [focusWorkbenchField]
  );

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
      setFormData((current) => ({
        ...current,
        featuredImageAlt: current.featuredImageAlt.trim()
          ? current.featuredImageAlt
          : current.title.trim().slice(0, 220),
        featuredImageCaption: current.featuredImageCaption.trim()
          ? current.featuredImageCaption
          : current.summary.trim().slice(0, 300),
      }));

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

  const handleArticleAudioChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.currentTarget.value = '';
    setError('');

    if (!file) return;

    const validationError = validateArticleAudioFile(file);
    setArticleAudioFile(file);
    setArticleAudioValidationError(validationError);
    setArticleAudioPreviewUrl(validationError ? '' : createArticleAudioPreviewUrl(file));
  };

  const clearArticleAudioFile = () => {
    setArticleAudioFile(null);
    setArticleAudioValidationError('');
    setArticleAudioPreviewUrl('');
  };

  const handleBreakingAudioChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.currentTarget.value = '';
    setError('');

    if (!file) return;

    const validationError = validateArticleAudioFile(file, 'Breaking');
    setBreakingAudioFile(file);
    setBreakingAudioValidationError(validationError);
    setBreakingAudioPreviewUrl(validationError ? '' : createArticleAudioPreviewUrl(file));
  };

  const clearBreakingAudioFile = () => {
    setBreakingAudioFile(null);
    setBreakingAudioValidationError('');
    setBreakingAudioPreviewUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (sourceStory?.linkedArticleId) {
      setError('A linked article already exists for this source story.');
      return;
    }

    if (!liveReadinessSummary.canSend) {
      const blockerLabels = liveReadinessSummary.blockers.map((item) => item.label).join(', ');
      setError(`Resolve blockers: ${blockerLabels}`);
      focusReadinessItem(liveReadinessSummary.blockers[0]);
      return;
    }

    setIsLoading(true);

    try {
      if (!formData.title || !formData.summary || !formData.content || !formData.author || !imagePreview) {
        setError('Please fill in all required fields');
        setIsLoading(false);
        return;
      }

      const audioValidationError = validateArticleAudioFile(articleAudioFile);
      if (audioValidationError || articleAudioValidationError) {
        const nextError = audioValidationError || articleAudioValidationError;
        setArticleAudioValidationError(nextError);
        setError(nextError);
        setIsLoading(false);
        return;
      }

      const breakingAudioRequired = canPublishImmediately && formData.isBreaking;
      const breakingValidationError = validateArticleAudioFile(breakingAudioFile, 'Breaking');
      if (breakingAudioRequired && !breakingAudioFile) {
        const nextError = 'Upload breaking news audio before publishing this breaking article.';
        setBreakingAudioValidationError(nextError);
        setError(nextError);
        setIsLoading(false);
        return;
      }
      if (breakingValidationError || breakingAudioValidationError) {
        const nextError = breakingValidationError || breakingAudioValidationError;
        setBreakingAudioValidationError(nextError);
        setError(nextError);
        setIsLoading(false);
        return;
      }

      const canonicalUrl = formData.canonicalUrl.trim();
      if (canonicalUrl && !isValidAbsoluteHttpUrl(canonicalUrl)) {
        setError('Canonical URL must start with http:// or https://');
        setIsLoading(false);
        return;
      }

      if (formData.seoSlug.trim() && !isValidArticleSlug(formData.seoSlug.trim())) {
        setError('SEO slug must use lowercase letters, numbers, and hyphens only');
        setIsLoading(false);
        return;
      }

      if (
        formData.authorProfileUrl.trim() &&
        !isValidAbsoluteHttpUrl(formData.authorProfileUrl.trim())
      ) {
        setError('Author profile URL must start with http:// or https://');
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
          breakingAudioUploadPending: breakingAudioRequired && Boolean(breakingAudioFile),
          title: formData.title,
          slug: formData.seoSlug,
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
            focusKeyword: formData.focusKeyword,
            secondaryKeywords: formData.secondaryKeywords,
            featuredImageAlt: formData.featuredImageAlt,
            featuredImageCaption: formData.featuredImageCaption,
            imageCredit: formData.imageCredit,
            authorProfileUrl: formData.authorProfileUrl,
            includeInNewsSitemap: formData.includeInNewsSitemap,
            majorUpdateNote: formData.majorUpdateNote,
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

      const createdArticleId = resolveCreatedArticleId(data.data);
      let audioUploadWarning = '';
      if (breakingAudioFile) {
        if (!createdArticleId) {
          audioUploadWarning =
            'Article was created, but breaking audio could not be uploaded because the new article ID was missing.';
        } else {
          setIsUploadingBreakingAudio(true);
          try {
            await uploadBreakingTtsAudioDirect({
              articleId: createdArticleId,
              file: breakingAudioFile,
              authHeaders: getAuthHeader(),
            });

            if (breakingAudioRequired) {
              const publishResponse = await fetch(
                `/api/admin/articles/${encodeURIComponent(createdArticleId)}`,
                {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader(),
                  },
                  body: JSON.stringify({ action: 'publish' }),
                }
              );
              const publishPayload = (await publishResponse.json().catch(() => ({}))) as {
                success?: boolean;
                error?: string;
              };
              if (!publishResponse.ok || !publishPayload.success) {
                throw new Error(publishPayload.error || 'Breaking article audio was uploaded, but publishing failed.');
              }
            }
          } catch (audioError) {
            audioUploadWarning =
              audioError instanceof Error
                ? `Article was created, but breaking audio upload failed: ${audioError.message}`
                : 'Article was created, but breaking audio upload failed.';
          } finally {
            setIsUploadingBreakingAudio(false);
          }
        }
      }

      if (articleAudioFile) {
        if (!createdArticleId) {
          audioUploadWarning =
            'Article was created, but listen audio could not be uploaded because the new article ID was missing.';
        } else {
          setIsUploadingArticleAudio(true);
          try {
            await uploadArticleTtsAudioDirect({
              articleId: createdArticleId,
              file: articleAudioFile,
              authHeaders: getAuthHeader(),
            });
          } catch (audioError) {
            audioUploadWarning =
              audioError instanceof Error
                ? `Article was created, but listen audio upload failed: ${audioError.message}`
                : 'Article was created, but listen audio upload failed.';
          } finally {
            setIsUploadingArticleAudio(false);
          }
        }
      }

      const fallbackCategory = categories.includes(EMPTY_FORM.category)
        ? EMPTY_FORM.category
        : categories[0] || EMPTY_FORM.category;
      setFormData({ ...EMPTY_FORM, category: fallbackCategory });
      setImageFile(null);
      setImagePreview('');
      clearArticleAudioFile();
      clearBreakingAudioFile();
      setContentMode('write');
      setIsSeoSlugTouched(false);
      clearDraft();

      if (audioUploadWarning) {
        setSuccess(
          canPublishImmediately
            ? 'Article saved successfully. Redirecting to the editor to retry audio upload...'
            : 'Article submitted successfully. Redirecting to the editor to retry audio upload...'
        );
        setError(audioUploadWarning);
        setTimeout(() => {
          router.push(
            createdArticleId
              ? `/admin/articles/${encodeURIComponent(createdArticleId)}/edit`
              : '/admin/articles'
          );
        }, 2500);
        return;
      }

      setSuccess(
        breakingAudioFile
          ? canPublishImmediately
            ? 'Article published successfully with breaking audio! Redirecting...'
            : 'Article submitted successfully with staged breaking audio! Redirecting...'
          : articleAudioFile
          ? canPublishImmediately
            ? 'Article published successfully with listen audio! Redirecting...'
            : 'Article submitted successfully with listen audio! Redirecting...'
          : successMessage
      );

      setTimeout(() => {
        router.push('/admin/articles');
      }, 2000);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Failed to publish article. Please try again.'
      );
    } finally {
      setIsLoading(false);
      setIsUploadingArticleAudio(false);
      setIsUploadingBreakingAudio(false);
    }
  };

  const normalizedSeo = useMemo(
    () =>
      normalizeArticleSeo({
        metaTitle: formData.seoTitle,
        metaDescription: formData.seoDescription,
        ogImage: formData.ogImage,
        canonicalUrl: formData.canonicalUrl,
        focusKeyword: formData.focusKeyword,
        secondaryKeywords: formData.secondaryKeywords,
        featuredImageAlt: formData.featuredImageAlt,
        featuredImageCaption: formData.featuredImageCaption,
        imageCredit: formData.imageCredit,
        authorProfileUrl: formData.authorProfileUrl,
        includeInNewsSitemap: formData.includeInNewsSitemap,
        majorUpdateNote: formData.majorUpdateNote,
      }),
    [formData]
  );
  const googlePreview = useMemo(
    () =>
      buildArticleGooglePreview({
        id: 'article-preview',
        slug: formData.seoSlug,
        title: formData.title,
        summary: formData.summary,
        image: imagePreview,
        seo: normalizedSeo,
      }),
    [formData.seoSlug, formData.title, formData.summary, imagePreview, normalizedSeo]
  );
  const previewPath = buildArticlePublicPath({
    id: 'article-preview',
    slug: formData.seoSlug || undefined,
  });

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

          {!isFocusMode ? (
            <div className="sticky top-0 z-20 mb-5 flex items-center gap-2 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-950/95 p-2 shadow-lg shadow-black/10 backdrop-blur dark:border-white/10">
              {[
                { label: 'Write', field: 'content' as ArticleAssistField, Icon: FileText },
                { label: 'SEO', field: 'seoTitle' as ArticleAssistField, Icon: Search },
                { label: 'Media', field: 'image' as ArticleAssistField, Icon: ImageIcon },
                { label: 'Audio', field: 'breakingAudio' as ArticleAssistField, Icon: FileAudio },
              ].map(({ label, field, Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => focusWorkbenchField(field)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-200 transition-colors hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={runArticleAssist}
                className="inline-flex shrink-0 items-center gap-2 rounded-md bg-spanish-red px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700"
              >
                <CheckCircle className="h-4 w-4" />
                <span>Ready</span>
              </button>
            </div>
          ) : null}

          <form
            onSubmit={handleSubmit}
            className="space-y-4 sm:space-y-8"
          >
            <CmsEditorColumns stacked={isFocusMode} sidebarWidth="narrow">
            <CmsEditorMain>
              <div data-article-field="title">
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

              <div data-article-field="summary">
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

              <div data-article-field="content">
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
                previewVariant="article"
                author={formData.author}
                image={imagePreview}
                imageAlt={formData.featuredImageAlt}
                imageCaption={formData.featuredImageCaption}
                imageCredit={formData.imageCredit}
                category={formData.category}
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
                <div data-article-field="category">
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

                <div data-article-field="author">
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

              <ArticleWorkbenchAssistant
                result={assistResult}
                isLoading={isAssistLoading}
                error={assistError}
                rejectedPatchKeys={rejectedAssistPatchKeys}
                onRun={runArticleAssist}
                onApplyPatch={applyAssistPatch}
                onApplyAll={applyAssistPatches}
                onRejectPatch={rejectAssistPatch}
                onFocusField={focusWorkbenchField}
                title="Packaging assistant"
              />

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

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-white p-2 text-spanish-red shadow-sm">
                    <Volume2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">Article Listen Audio</p>
                      <span className="rounded-full border border-spanish-red/30 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-spanish-red dark:border-red-400/40 dark:bg-red-500/15 dark:text-red-100">
                        Optional
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-gray-600">
                      Upload MP3, WAV, or M4A audio. It will attach after the article is created.
                    </p>
                  </div>
                </div>

                {articleAudioFile ? (
                  <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-start gap-3">
                      <FileAudio className="mt-0.5 h-4 w-4 flex-shrink-0 text-spanish-red" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {articleAudioFile.name}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {formatArticleAudioSize(articleAudioFile.size)}
                          {articleAudioValidationError
                            ? ' | Needs replacement'
                            : ' | Ready to attach after article creation'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={clearArticleAudioFile}
                        className="rounded-md border border-gray-200 p-1.5 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800"
                        aria-label="Remove article listen audio"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {articleAudioPreviewUrl ? (
                      <audio
                        controls
                        preload="metadata"
                        src={articleAudioPreviewUrl}
                        className="mt-3 w-full"
                      />
                    ) : null}
                  </div>
                ) : null}

                {articleAudioValidationError ? (
                  <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                    {articleAudioValidationError}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  <label
                    className={`inline-flex items-center gap-2 rounded-md border border-spanish-red bg-white px-3 py-2 text-xs font-semibold text-spanish-red transition-colors hover:bg-red-50 ${
                      submitBusy ? 'pointer-events-none cursor-not-allowed opacity-60' : 'cursor-pointer'
                    }`}
                  >
                    <Upload className="h-4 w-4" />
                    {articleAudioFile ? 'Replace Audio' : 'Upload Audio'}
                    <input
                      type="file"
                      accept={ARTICLE_AUDIO_ACCEPT}
                      disabled={submitBusy}
                      onChange={handleArticleAudioChange}
                      className="sr-only"
                    />
                  </label>
                  {articleAudioFile ? (
                    <button
                      type="button"
                      onClick={clearArticleAudioFile}
                      disabled={submitBusy}
                      className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <X className="h-4 w-4" />
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>

              <details data-article-field="seo" className="rounded-xl border border-gray-200 bg-gray-50">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">
                  SEO Settings
                </summary>
                <div className="space-y-4 border-t border-gray-200 p-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    SEO Slug
                  </label>
                  <input
                    type="text"
                    name="seoSlug"
                    value={formData.seoSlug}
                    onChange={handleInputChange}
                    placeholder="article-public-url-slug"
                    maxLength={200}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-spanish-red transition-colors"
                  />
                  <p className="mt-1 break-all text-xs text-gray-500">{previewPath}</p>
                </div>
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
                    Focus Keyword
                  </label>
                  <input
                    type="text"
                    name="focusKeyword"
                    value={formData.focusKeyword}
                    onChange={handleInputChange}
                    placeholder="Primary topic for internal SEO checks"
                    maxLength={120}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-spanish-red transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Secondary Keywords
                  </label>
                  <input
                    type="text"
                    name="secondaryKeywords"
                    value={formData.secondaryKeywords}
                    onChange={handleInputChange}
                    placeholder="Comma separated supporting topics"
                    maxLength={240}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-spanish-red transition-colors"
                  />
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
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Author Profile URL
                  </label>
                  <input
                    type="url"
                    name="authorProfileUrl"
                    value={formData.authorProfileUrl}
                    onChange={handleInputChange}
                    placeholder="https://example.com/authors/name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-spanish-red transition-colors"
                  />
                </div>
                <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
                  <input
                    type="checkbox"
                    name="includeInNewsSitemap"
                    checked={formData.includeInNewsSitemap}
                    onChange={handleInputChange}
                    className="w-4 h-4 rounded border-gray-300 text-spanish-red focus:ring-spanish-red"
                  />
                  <span className="text-sm text-gray-700">Include in Google News sitemap after publish</span>
                </label>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Google Preview</p>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold text-blue-700">{googlePreview.title}</p>
                  <p className="mt-1 break-all text-xs text-green-700">{googlePreview.url}</p>
                  <p className="mt-1 line-clamp-3 text-xs text-gray-600">{googlePreview.description || 'Meta description or summary will appear here.'}</p>
                </div>
                </div>
              </details>

              <div data-article-field="image" className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
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
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="aspect-[16/9] w-full bg-zinc-950 object-contain"
                    />
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
                <div className="mt-4 space-y-3">
                  <input
                    type="text"
                    name="featuredImageAlt"
                    value={formData.featuredImageAlt}
                    onChange={handleInputChange}
                    placeholder="Featured image alt text"
                    maxLength={220}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-spanish-red focus:outline-none"
                  />
                  <textarea
                    name="featuredImageCaption"
                    value={formData.featuredImageCaption}
                    onChange={handleInputChange}
                    placeholder="Featured image caption"
                    rows={2}
                    maxLength={300}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-spanish-red focus:outline-none"
                  />
                  <input
                    type="text"
                    name="imageCredit"
                    value={formData.imageCredit}
                    onChange={handleInputChange}
                    placeholder="Image credit/source"
                    maxLength={180}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-spanish-red focus:outline-none"
                  />
                </div>
                <ArticleFeaturedImageReaderPreview
                  image={imagePreview}
                  title={formData.title}
                  summary={formData.summary}
                  caption={formData.featuredImageCaption}
                  credit={formData.imageCredit}
                  alt={formData.featuredImageAlt}
                  category={formData.category}
                />
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
                  <div data-article-field="breakingAudio" className="space-y-3 rounded-lg border border-red-200 bg-white p-3 dark:border-red-500/30 dark:bg-zinc-900">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-red-50 p-2 text-spanish-red dark:bg-red-500/15 dark:text-red-100">
                        <Volume2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            Breaking News Audio
                          </p>
                          <span className="rounded-full border border-spanish-red/30 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-spanish-red dark:border-red-400/40 dark:bg-red-500/15 dark:text-red-100">
                            Required before publish
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-300">
                          Record the script below exactly, then upload the MP3, WAV, or M4A file.
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Recording Script
                      </p>
                      <div className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm leading-6 text-gray-900 dark:border-gray-700 dark:bg-zinc-950 dark:text-gray-100">
                        {breakingRecordingScript}
                      </div>
                    </div>

                    {breakingAudioFile ? (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-zinc-950">
                        <div className="flex items-start gap-3">
                          <FileAudio className="mt-0.5 h-4 w-4 flex-shrink-0 text-spanish-red" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {breakingAudioFile.name}
                            </p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {formatArticleAudioSize(breakingAudioFile.size)}
                              {breakingAudioValidationError
                                ? ' | Needs replacement'
                                : ' | Ready to attach after article creation'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={clearBreakingAudioFile}
                            className="rounded-md border border-gray-200 p-1.5 text-gray-500 transition-colors hover:bg-white hover:text-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-zinc-900 dark:hover:text-white"
                            aria-label="Remove breaking news audio"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {breakingAudioPreviewUrl ? (
                          <audio
                            controls
                            preload="metadata"
                            src={breakingAudioPreviewUrl}
                            className="mt-3 w-full"
                          />
                        ) : null}
                      </div>
                    ) : null}

                    {breakingAudioValidationError ? (
                      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-400/40 dark:bg-red-500/15 dark:text-red-100">
                        {breakingAudioValidationError}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      <label
                        className={`inline-flex items-center gap-2 rounded-md border border-spanish-red bg-white px-3 py-2 text-xs font-semibold text-spanish-red transition-colors hover:bg-red-50 dark:bg-transparent dark:text-red-100 dark:hover:bg-red-500/15 ${
                          submitBusy ? 'pointer-events-none cursor-not-allowed opacity-60' : 'cursor-pointer'
                        }`}
                      >
                        <Upload className="h-4 w-4" />
                        {breakingAudioFile ? 'Replace Breaking Audio' : 'Upload Breaking Audio'}
                        <input
                          type="file"
                          accept={ARTICLE_AUDIO_ACCEPT}
                          disabled={submitBusy}
                          onChange={handleBreakingAudioChange}
                          className="sr-only"
                        />
                      </label>
                      {breakingAudioFile ? (
                        <button
                          type="button"
                          onClick={clearBreakingAudioFile}
                          disabled={submitBusy}
                          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-transparent dark:text-gray-200 dark:hover:bg-zinc-900"
                        >
                          <X className="h-4 w-4" />
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
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

              <details className="rounded-xl border border-gray-200 bg-gray-50">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">
                  Publish timing
                </summary>
                <div className="space-y-3 border-t border-gray-200 p-4 text-sm text-gray-700">
                  <p>Timezone: Asia/Calcutta</p>
                  <p>Status: {canPublishImmediately ? 'Publish now' : 'Submit for review'}</p>
                  <textarea
                    name="majorUpdateNote"
                    value={formData.majorUpdateNote}
                    onChange={handleInputChange}
                    placeholder="Major update note (optional)"
                    rows={2}
                    maxLength={240}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-spanish-red focus:outline-none"
                  />
                </div>
              </details>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">Publishing readiness</p>
                    <p className="mt-1 text-xs leading-5 text-gray-600">
                      {liveReadinessSummary.canSend
                        ? 'Critical checks are clear. Review warnings before sending.'
                        : 'Resolve critical blockers before this article can be sent.'}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-gray-900">
                    {liveReadinessSummary.score}%
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Done</p>
                    <p className="mt-1 text-sm font-bold text-gray-900">
                      {liveReadinessSummary.done.length}/{liveReadinessSummary.total}
                    </p>
                  </div>
                  <div className="rounded-lg border border-red-100 bg-white px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-red-500">Blockers</p>
                    <p className="mt-1 text-sm font-bold text-red-700">
                      {liveReadinessSummary.blockers.length}
                    </p>
                  </div>
                  <div className="rounded-lg border border-amber-100 bg-white px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Warnings</p>
                    <p className="mt-1 text-sm font-bold text-amber-700">
                      {liveReadinessSummary.warnings.length + liveReadinessSummary.todos.length}
                    </p>
                  </div>
                </div>

                {sourceStory?.linkedArticleId ? (
                  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                    A linked article already exists for this source story.
                  </p>
                ) : null}

                {!liveReadinessSummary.canSend ? (
                  <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                    Resolve blockers: {liveReadinessSummary.blockers.map((item) => item.label).join(', ')}
                  </p>
                ) : null}

                <div className="mt-3 space-y-2">
                  {liveAssistResult.readiness.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => focusReadinessItem(item)}
                      aria-label={`${item.label} readiness: ${item.status}`}
                      className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors hover:border-gray-400 ${getReadinessStatusClass(item.status)}`}
                    >
                      <span className="mt-0.5">{getReadinessIcon(item)}</span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold">{item.label}</span>
                        <span className="mt-0.5 block text-xs opacity-80">{item.detail}</span>
                      </span>
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={runArticleAssist}
                    disabled={isAssistLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isAssistLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Assist with fixes
                  </button>
                  <button
                    type="submit"
                    disabled={
                      submitBusy ||
                      Boolean(sourceStory?.linkedArticleId) ||
                      !liveReadinessSummary.canSend
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-spanish-red py-3 text-white font-medium transition-colors hover:bg-guardsman-red disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitBusy ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {submitBusyLabel}
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
                    slug={formData.seoSlug}
                    image={imagePreview}
                    seo={normalizedSeo}
                    category={formData.category}
                    relatedArticles={relatedArticles}
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
                      submitBusy ||
                      Boolean(sourceStory?.linkedArticleId) ||
                      !liveReadinessSummary.canSend
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-spanish-red py-3 text-white font-medium transition-colors hover:bg-guardsman-red disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitBusy ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {submitBusyLabel}
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

