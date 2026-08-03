'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  AlertCircle,
  CheckCircle,
  Image as ImageIcon,
  Cloud,
  CloudOff,
  Save,
} from 'lucide-react';
import type { ArticleEditorStudioMode } from '@/components/forms/ArticleEditorStudio';
import ArticleWorkbenchAssistant, {
  getArticleAssistPatchKey,
} from '@/components/forms/ArticleWorkbenchAssistant';
import ArticleTranslationReview from '@/components/forms/ArticleTranslationReview';
import ArticleDraftRecoveryNotice from '@/components/forms/ArticleDraftRecoveryNotice';
import ArticleDraftModule from '@/components/forms/article-create/ArticleDraftModule';
import ArticleSeoModule from '@/components/forms/article-create/ArticleSeoModule';
import ArticleReadinessModule from '@/components/forms/article-create/ArticleReadinessModule';
import ArticleComposeModule from '@/components/forms/article-create/ArticleComposeModule';
import ArticleMediaModule from '@/components/forms/article-create/ArticleMediaModule';
import ArticlePublishModule from '@/components/forms/article-create/ArticlePublishModule';
import useArticleServerDraft from '@/components/forms/useArticleServerDraft';
import {
  CmsEditorCanvas,
  CmsEditorColumns,
  CmsEditorSidebar,
} from '@/components/admin/CmsEditorLayout';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAuthHeader } from '@/lib/auth/clientToken';
import { NEWS_CATEGORIES } from '@/lib/constants/newsCategories';
import { formatUiDateTime } from '@/lib/utils/dateFormat';
import {
  getArticleImageHints,
  prepareArticleImageFile,
} from '@/lib/utils/articleImageUpload';
import { uploadArticleTtsAudioDirect } from '@/lib/utils/articleTtsUploadClient';
import { uploadBreakingTtsAudioDirect } from '@/lib/utils/breakingTtsUploadClient';
import { uploadAuthorProfileImage } from '@/lib/utils/authorProfileImageUpload';
import { buildSpokenBreakingHeadline } from '@/lib/types/breaking';
import { resolveArticleOgImageUrl } from '@/lib/utils/articleMedia';
import {
  buildArticleGooglePreview,
  buildArticlePublicPath,
  isValidArticleSlug,
  normalizeArticleSeo,
  normalizeArticleSlug,
  stripArticleHtml,
} from '@/lib/seo/articleSeo';
import {
  buildArticleAssistResult,
  suggestArticleFocusKeyword,
  suggestArticleSecondaryKeywords,
  summarizeArticleReadiness,
  type ArticleAssistField,
  type ArticleAssistPatch,
  type ArticleAssistResult,
  type ArticleAssistSuggestion,
  type ArticleReadinessItem,
} from '@/lib/utils/articleAssistant';
import type { WorkflowPriority } from '@/lib/workflow/types';
import {
  createEmptyArticleEditorialMeta,
  type ArticleEditorialMeta,
} from '@/lib/content/articleEditorial';
import {
  createEmptyArticleMediaMetadata,
  type ArticleMediaMetadata,
} from '@/lib/content/articleMediaMetadata';
import { migrateArticleHtmlToDocument } from '@/lib/content/articleDocument';
import {
  getOrCreateArticleDraftEditorSessionId,
  isCurrentArticleDraftEditorSession,
} from '@/lib/content/articleDraftRecovery';

const DEFAULT_CATEGORIES = NEWS_CATEGORIES.map((category) => category.nameEn);
const LEGACY_DRAFT_STORAGE_KEY = 'lokswami:article-draft:new';
const DRAFT_STORAGE_PREFIX = 'lokswami:article-draft:v2';
const SERVER_AUTOSAVE_DEBOUNCE_MS = 4000;
const LOCAL_AUTOSAVE_DEBOUNCE_MS = 1000;
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
  authorDisplayName: string;
  authorDisplayNameSet: boolean;
  authorAvatarUrl: string;
  authorProgramName: string;
  includeInNewsSitemap: boolean;
  majorUpdateNote: string;
  editorial: ArticleEditorialMeta;
  media: ArticleMediaMetadata;
};

type CreateArticleLocalDraft = {
  savedAt?: string;
  editorSessionId?: string;
  formData?: Partial<ArticleFormState>;
  imagePreview?: string;
  contentMode?: ArticleEditorStudioMode;
  focusMode?: boolean;
  serverDraftId?: string;
  serverDraftVersion?: number;
  serverDraftSavedAt?: string;
  articleAudioStored?: boolean;
  breakingAudioStored?: boolean;
  recoveryStorageKey?: string;
};

type RelatedArticleSuggestion = {
  id: string;
  slug?: string;
  title: string;
  category?: string;
};

type ArticleInspectorTab = 'media' | 'seo' | 'publish' | 'quality';
type ArticleCreateWorkflowIntent = 'submit' | 'publish' | 'schedule';

type AssignableTeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  profileUrl?: string;
  image?: string;
};

type MediaLibraryItem = {
  _id: string;
  filename: string;
  url: string;
  size?: number;
  type?: string;
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
  authorDisplayName: '',
  authorDisplayNameSet: false,
  authorAvatarUrl: '',
  authorProgramName: '',
  includeInNewsSitemap: true,
  majorUpdateNote: '',
  editorial: createEmptyArticleEditorialMeta(),
  media: createEmptyArticleMediaMetadata(),
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

function resolveCreatedArticleVersion(payload: unknown) {
  if (!payload || typeof payload !== 'object') return 1;
  const rawVersion = Number((payload as Record<string, unknown>).version);
  return Number.isInteger(rawVersion) && rawVersion > 0 ? rawVersion : 1;
}

function buildArticleMutationPayload(
  formData: ArticleFormState,
  imageUrl: string,
  sourceStoryId: string,
  mediaOverride?: ArticleMediaMetadata
) {
  const persistedImage = imageUrl.startsWith('data:') ? '' : imageUrl;
  return {
    title: formData.title,
    slug: formData.seoSlug,
    summary: formData.summary,
    content: formData.content,
    contentJson: migrateArticleHtmlToDocument(formData.content),
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
    editorial: formData.editorial,
    media: mediaOverride || formData.media,
    image: persistedImage,
    seo: {
      metaTitle: formData.seoTitle,
      metaDescription: formData.seoDescription,
      ogImage:
        formData.ogImage.trim() ||
        (persistedImage ? resolveArticleOgImageUrl({ image: persistedImage }) : ''),
      canonicalUrl: formData.canonicalUrl,
      focusKeyword: formData.focusKeyword,
      secondaryKeywords: formData.secondaryKeywords,
      featuredImageAlt: formData.featuredImageAlt,
      featuredImageCaption: formData.featuredImageCaption,
      imageCredit: formData.imageCredit,
      authorProfileUrl: formData.authorProfileUrl,
      authorDisplayName: formData.authorDisplayName,
      authorDisplayNameSet: formData.authorDisplayNameSet,
      authorAvatarUrl: formData.authorAvatarUrl,
      authorProgramName: formData.authorProgramName,
      includeInNewsSitemap: formData.includeInNewsSitemap,
      majorUpdateNote: formData.majorUpdateNote,
    },
    ...(sourceStoryId ? { sourceStoryId } : {}),
  };
}

async function uploadArticleImageFile(
  file: File,
  focalPoint: { x: number; y: number }
) {
  const uploadPayload = new FormData();
  uploadPayload.append('file', file);
  uploadPayload.append('purpose', 'image');
  uploadPayload.append('optimizeArticleImage', 'true');
  uploadPayload.append('focalPointX', String(focalPoint.x));
  uploadPayload.append('focalPointY', String(focalPoint.y));
  const response = await fetch('/api/admin/upload', {
    method: 'POST',
    headers: { ...getAuthHeader() },
    body: uploadPayload,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to upload image');
  }
  const url = String(data?.data?.url || '').trim();
  if (!url) throw new Error('Image upload completed without a URL.');
  let sourceMediaId = '';
  try {
    const registerResponse = await fetch('/api/admin/media', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({
        filename: data?.data?.filename || file.name,
        url,
        size: data?.data?.size || file.size,
        type: data?.data?.type || 'image/webp',
      }),
    });
    const registered = await registerResponse.json().catch(() => ({}));
    if (registerResponse.ok) sourceMediaId = String(registered?.data?._id || '');
  } catch {
    // Article upload remains valid even when the optional library index is unavailable.
  }
  return {
    url,
    sourceMediaId,
    width: Number(data?.data?.width || 0),
    height: Number(data?.data?.height || 0),
    format: String(data?.data?.format || data?.data?.type || '').replace(/^image\//, ''),
    variants: {
      ...createEmptyArticleMediaMetadata().variants,
      ...(data?.data?.variants || {}),
    },
  };
}

export default function UploadArticle() {
  const router = useRouter();
  const redirectTimerRef = useRef<number | null>(null);
  const articleFormRef = useRef<HTMLFormElement | null>(null);
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const scheduleRedirect = useCallback(
    (href: string, delayMs: number) => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
      redirectTimerRef.current = window.setTimeout(() => {
        redirectTimerRef.current = null;
        router.push(href);
      }, delayMs);
    },
    [router]
  );

  useEffect(
    () => () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
    },
    []
  );
  const [formData, setFormData] = useState<ArticleFormState>(EMPTY_FORM);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [mediaLibrary, setMediaLibrary] = useState<MediaLibraryItem[]>([]);
  const [mediaSearch, setMediaSearch] = useState('');
  const [isMediaLibraryLoading, setIsMediaLibraryLoading] = useState(false);
  const [mediaLibraryLoaded, setMediaLibraryLoaded] = useState(false);
  const [mediaLibraryError, setMediaLibraryError] = useState('');
  const [articleAudioFile, setArticleAudioFile] = useState<File | null>(null);
  const [articleAudioPreviewUrl, setArticleAudioPreviewUrl] = useState('');
  const [articleAudioStored, setArticleAudioStored] = useState(false);
  const [articleAudioValidationError, setArticleAudioValidationError] = useState('');
  const [isUploadingArticleAudio, setIsUploadingArticleAudio] = useState(false);
  const [breakingAudioFile, setBreakingAudioFile] = useState<File | null>(null);
  const [breakingAudioPreviewUrl, setBreakingAudioPreviewUrl] = useState('');
  const [breakingAudioStored, setBreakingAudioStored] = useState(false);
  const [breakingAudioValidationError, setBreakingAudioValidationError] = useState('');
  const [isUploadingBreakingAudio, setIsUploadingBreakingAudio] = useState(false);
  const [isUploadingAuthorPhoto, setIsUploadingAuthorPhoto] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [contentMode, setContentMode] = useState<ArticleEditorStudioMode>('write');
  const [inspectorTab, setInspectorTab] = useState<ArticleInspectorTab>('quality');
  const [workflowIntent, setWorkflowIntent] = useState<ArticleCreateWorkflowIntent>('submit');
  const [workflowPriority, setWorkflowPriority] = useState<WorkflowPriority>('normal');
  const [workflowDueAt, setWorkflowDueAt] = useState('');
  const [workflowScheduledFor, setWorkflowScheduledFor] = useState('');
  const [workflowAssigneeId, setWorkflowAssigneeId] = useState('');
  const [teamOptions, setTeamOptions] = useState<AssignableTeamMember[]>([]);
  const [teamOptionsError, setTeamOptionsError] = useState('');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState('');
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [pendingDraftRecovery, setPendingDraftRecovery] = useState<CreateArticleLocalDraft | null>(null);
  const [draftEditorSessionId, setDraftEditorSessionId] = useState('');
  const [lastServerSavedSignature, setLastServerSavedSignature] = useState('');
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
  const [isTrendingSignalLoading, setIsTrendingSignalLoading] = useState(false);
  const [trendingSignalStatus, setTrendingSignalStatus] = useState('');
  const [rejectedAssistPatchKeys, setRejectedAssistPatchKeys] = useState<Set<string>>(
    () => new Set()
  );

  const sourceStoryId = searchParams.get('sourceStoryId')?.trim() || '';
  const localDraftStorageKey = useMemo(() => {
    const owner = String(session?.user?.email || 'anonymous')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9@._-]+/g, '-');
    const source = sourceStoryId || 'direct';
    return `${DRAFT_STORAGE_PREFIX}:${owner}:${source}`;
  }, [session?.user?.email, sourceStoryId]);
  const draftRecoveryBlocking = !draftReady || Boolean(pendingDraftRecovery);

  useEffect(() => {
    setDraftEditorSessionId(getOrCreateArticleDraftEditorSessionId(localDraftStorageKey));
  }, [localDraftStorageKey]);
  const canPublishImmediately =
    session?.user?.role === 'admin' || session?.user?.role === 'super_admin';
  const canCreateCategories =
    session?.user?.role === 'admin' || session?.user?.role === 'super_admin';
  const authorOptions = useMemo(() => {
    const sessionUserId = String((session?.user as { id?: string } | undefined)?.id || '').trim();
    const options = [
      ...(session?.user?.name
        ? [
            {
              id: sessionUserId || session.user.email || session.user.name,
              name: session.user.name,
              email: session.user.email || '',
              role: session.user.role || 'staff',
              isActive: true,
              profileUrl: sessionUserId
                ? `/main/author/${encodeURIComponent(sessionUserId)}`
                : '',
              image: String((session.user as { image?: string | null }).image || '').trim(),
            },
          ]
        : []),
      ...teamOptions,
    ];
    const seen = new Set<string>();
    return options.filter((member) => {
      const key = member.name.trim().toLowerCase();
      if (!key || seen.has(key) || !member.isActive) return false;
      seen.add(key);
      return true;
    });
  }, [session?.user, teamOptions]);
  const submitLabel =
    workflowIntent === 'publish'
      ? 'Publish Article'
      : workflowIntent === 'schedule'
        ? 'Schedule Article'
        : 'Submit for Review';
  const submitVerb =
    workflowIntent === 'publish'
      ? 'Publishing'
      : workflowIntent === 'schedule'
        ? 'Scheduling'
        : 'Submitting';
  const successMessage =
    workflowIntent === 'publish'
      ? 'Article published successfully! Redirecting...'
      : workflowIntent === 'schedule'
        ? 'Article scheduled successfully! Redirecting...'
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
    breakingAudioReady:
      !formData.isBreaking || Boolean(breakingAudioFile) || breakingAudioStored,
    requireBreakingAudio: workflowIntent === 'publish' && formData.isBreaking,
    listenAudioReady: Boolean(articleAudioFile) || articleAudioStored,
    sourceInfo: formData.sourceInfo,
    sourceStoryId,
    locationTag: formData.locationTag,
    editorial: {
      ...formData.editorial,
      flagApprovedBy:
        formData.isBreaking || formData.isTrending
          ? session?.user?.name || session?.user?.email || 'current staff user'
          : '',
    },
    relatedArticles: relatedArticles.map((article) => ({
      title: article.title,
      slug: article.slug,
    })),
  }), [
    articleAudioFile,
    articleAudioStored,
    breakingAudioFile,
    breakingAudioStored,
    formData,
    imagePreview,
    relatedArticles,
    session?.user?.email,
    session?.user?.name,
    sourceStoryId,
    workflowIntent,
  ]);

  const liveAssistResult = useMemo(
    () => buildArticleAssistResult(buildAssistPayload()),
    [buildAssistPayload]
  );
  const liveReadinessSummary = useMemo(
    () => summarizeArticleReadiness(liveAssistResult.readiness),
    [liveAssistResult]
  );

  const serverDraftPayload = useMemo(
    () => buildArticleMutationPayload(formData, imagePreview, sourceStoryId),
    [formData, imagePreview, sourceStoryId]
  );
  const serverDraftPayloadSignature = useMemo(
    () => JSON.stringify(serverDraftPayload),
    [serverDraftPayload]
  );
  const hasMeaningfulDraftContent = useMemo(
    () =>
      Boolean(
        formData.title.trim() ||
          formData.summary.trim() ||
          stripArticleHtml(formData.content).trim() ||
          formData.locationTag.trim() ||
          formData.sourceInfo.trim() ||
          formData.reporterNotes.trim() ||
          formData.editorial.sourceAttribution.trim() ||
          formData.editorial.quoteAttribution.trim() ||
          formData.editorial.correctionNote.trim() ||
          imagePreview.trim() ||
          imageFile ||
          articleAudioFile ||
          breakingAudioFile
      ),
    [articleAudioFile, breakingAudioFile, formData, imageFile, imagePreview]
  );
  const {
    draftId,
    draftVersion,
    savedAt: serverDraftSavedAt,
    status: serverDraftStatus,
    message: serverDraftMessage,
    saveNow: saveServerDraft,
    adoptDraft,
    resetDraft: resetServerDraft,
  } = useArticleServerDraft({
    enabled: draftReady && Boolean(session?.user),
    hasMeaningfulContent: hasMeaningfulDraftContent,
    payload: serverDraftPayload,
    debounceMs: SERVER_AUTOSAVE_DEBOUNCE_MS,
    onSaved: (record) => {
      setLastServerSavedSignature(record.payloadSignature || serverDraftPayloadSignature);
      setDraftSavedAt(record.updatedAt);
    },
  });
  const draftStatusLabel =
    serverDraftStatus === 'saving'
      ? 'Saving...'
      : serverDraftStatus === 'saved'
        ? 'Saved'
        : serverDraftStatus === 'offline'
          ? 'Offline - local copy kept'
          : serverDraftStatus === 'conflict'
            ? 'Conflict detected'
            : serverDraftStatus === 'error'
              ? 'Save failed - local copy kept'
              : draftId
                ? 'Server draft ready'
                : 'Not saved yet';

  useEffect(() => {
    setWorkflowIntent(canPublishImmediately ? 'publish' : 'submit');
  }, [canPublishImmediately]);

  useEffect(() => {
    if (inspectorTab !== 'media' || mediaLibraryLoaded) {
      return;
    }
    let active = true;
    setIsMediaLibraryLoading(true);
    setMediaLibraryError('');
    void fetch('/api/admin/media', {
      cache: 'no-store',
      headers: { ...getAuthHeader() },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.success === false) {
          throw new Error(payload?.error || 'Failed to load the media library.');
        }
        if (!active) return;
        setMediaLibrary(
          (Array.isArray(payload?.data) ? payload.data : []).filter(
            (item: MediaLibraryItem) => !item.type || item.type.startsWith('image/')
          )
        );
      })
      .catch((loadError: unknown) => {
        if (active) {
          setMediaLibraryError(
            loadError instanceof Error ? loadError.message : 'Failed to load the media library.'
          );
        }
      })
      .finally(() => {
        if (active) {
          setIsMediaLibraryLoading(false);
          setMediaLibraryLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, [inspectorTab, mediaLibraryLoaded]);

  const filteredMediaLibrary = useMemo(() => {
    const query = mediaSearch.trim().toLowerCase();
    if (!query) return mediaLibrary.slice(0, 18);
    return mediaLibrary
      .filter((item) => item.filename.toLowerCase().includes(query))
      .slice(0, 18);
  }, [mediaLibrary, mediaSearch]);

  useEffect(() => {
    if (!canPublishImmediately) {
      setTeamOptions([]);
      setWorkflowAssigneeId('');
      return;
    }
    let active = true;
    setTeamOptionsError('');
    void fetch('/api/admin/team/options', {
      cache: 'no-store',
      headers: { ...getAuthHeader() },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.success === false) {
          throw new Error(payload?.error || 'Failed to load newsroom staff.');
        }
        if (active) setTeamOptions(Array.isArray(payload?.data) ? payload.data : []);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setTeamOptionsError(
          loadError instanceof Error ? loadError.message : 'Failed to load newsroom staff.'
        );
      });
    return () => {
      active = false;
    };
  }, [canPublishImmediately]);

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
    if (
      lastServerSavedSignature &&
      lastServerSavedSignature === serverDraftPayloadSignature
    ) {
      localStorage.removeItem(localDraftStorageKey);
      localStorage.removeItem(LEGACY_DRAFT_STORAGE_KEY);
      return;
    }
    const hasAnyContent = Boolean(
      formData.title.trim() ||
      formData.summary.trim() ||
        formData.content.trim() ||
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
      version: 2,
      savedAt: new Date().toISOString(),
      editorSessionId: draftEditorSessionId,
      serverDraftId: draftId,
      serverDraftVersion: draftVersion,
      serverDraftSavedAt,
      articleAudioStored,
      breakingAudioStored,
      formData,
      imagePreview: imagePreview.startsWith('data:') ? '' : imagePreview,
      contentMode,
      focusMode: isFocusMode,
    };

    localStorage.setItem(localDraftStorageKey, JSON.stringify(payload));
    setDraftSavedAt(payload.savedAt);
  }, [
    contentMode,
    articleAudioStored,
    breakingAudioStored,
    draftId,
    draftEditorSessionId,
    draftVersion,
    formData,
    imagePreview,
    isFocusMode,
    localDraftStorageKey,
    lastServerSavedSignature,
    serverDraftPayloadSignature,
    serverDraftSavedAt,
  ]);

  const clearDraft = useCallback((resetServer = false) => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(localDraftStorageKey);
    localStorage.removeItem(LEGACY_DRAFT_STORAGE_KEY);
    setDraftSavedAt('');
    setDraftRestored(false);
    if (resetServer) resetServerDraft();
  }, [localDraftStorageKey, resetServerDraft]);

  const applyLocalDraft = useCallback((parsed: CreateArticleLocalDraft) => {
    setFormData((current) => ({
      ...current,
      ...parsed.formData,
      editorial: {
        ...current.editorial,
        ...(parsed.formData?.editorial || {}),
      },
      media: {
        ...current.media,
        ...(parsed.formData?.media || {}),
        variants: {
          ...current.media.variants,
          ...(parsed.formData?.media?.variants || {}),
        },
      },
    }));
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
    if (typeof parsed.serverDraftId === 'string' && parsed.serverDraftId.trim()) {
      adoptDraft({
        id: parsed.serverDraftId.trim(),
        version:
          typeof parsed.serverDraftVersion === 'number' && parsed.serverDraftVersion > 0
            ? parsed.serverDraftVersion
            : 1,
        updatedAt:
          typeof parsed.serverDraftSavedAt === 'string' && parsed.serverDraftSavedAt
            ? parsed.serverDraftSavedAt
            : parsed.savedAt || new Date().toISOString(),
      });
    }
    setArticleAudioStored(Boolean(parsed.articleAudioStored));
    setBreakingAudioStored(Boolean(parsed.breakingAudioStored));
    setDraftRestored(true);
  }, [adoptDraft]);

  const restorePendingDraft = useCallback(() => {
    if (!pendingDraftRecovery) return;
    applyLocalDraft(pendingDraftRecovery);
    if (
      pendingDraftRecovery.recoveryStorageKey &&
      pendingDraftRecovery.recoveryStorageKey !== localDraftStorageKey
    ) {
      localStorage.removeItem(pendingDraftRecovery.recoveryStorageKey);
    }
    setPendingDraftRecovery(null);
    setDraftReady(true);
  }, [applyLocalDraft, localDraftStorageKey, pendingDraftRecovery]);

  const discardPendingDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (pendingDraftRecovery?.recoveryStorageKey) {
      localStorage.removeItem(pendingDraftRecovery.recoveryStorageKey);
    }
    localStorage.removeItem(LEGACY_DRAFT_STORAGE_KEY);
    setPendingDraftRecovery(null);
    setDraftRestored(false);
    setDraftSavedAt('');
    setDraftReady(true);
  }, [pendingDraftRecovery]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      sessionStatus === 'loading' ||
      !draftEditorSessionId
    ) return;
    setDraftReady(false);
    setPendingDraftRecovery(null);
    try {
      const currentRaw = localStorage.getItem(localDraftStorageKey);
      const recoveryStorageKey = currentRaw
        ? localDraftStorageKey
        : LEGACY_DRAFT_STORAGE_KEY;
      const raw = currentRaw || localStorage.getItem(LEGACY_DRAFT_STORAGE_KEY);
      if (!raw) {
        setDraftReady(true);
        return;
      }

      const parsed = JSON.parse(raw) as CreateArticleLocalDraft;

      if (!parsed.formData) {
        setDraftReady(true);
        return;
      }

      const candidate = { ...parsed, recoveryStorageKey };
      if (isCurrentArticleDraftEditorSession(parsed.editorSessionId, draftEditorSessionId)) {
        applyLocalDraft(candidate);
        if (recoveryStorageKey !== localDraftStorageKey) {
          localStorage.removeItem(recoveryStorageKey);
        }
        setDraftReady(true);
        return;
      }

      setPendingDraftRecovery(candidate);
    } catch {
      // Ignore invalid draft payloads.
      setDraftReady(true);
    }
  }, [
    applyLocalDraft,
    draftEditorSessionId,
    localDraftStorageKey,
    sessionStatus,
  ]);

  useEffect(() => {
    if (!draftReady || typeof window === 'undefined') return;
    const id = window.setTimeout(persistDraft, LOCAL_AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [draftReady, persistDraft]);

  useEffect(() => {
    const form = articleFormRef.current;
    if (!form) return;
    form.toggleAttribute('inert', draftRecoveryBlocking);
    return () => form.removeAttribute('inert');
  }, [draftRecoveryBlocking]);

  useEffect(() => {
    if (!serverDraftSavedAt) return;
    setDraftSavedAt(serverDraftSavedAt);
  }, [serverDraftSavedAt]);

  useEffect(() => {
    const handleKeyboardSave = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      if (draftRecoveryBlocking) return;
      persistDraft();
      void saveServerDraft();
    };
    window.addEventListener('keydown', handleKeyboardSave);
    return () => window.removeEventListener('keydown', handleKeyboardSave);
  }, [draftRecoveryBlocking, persistDraft, saveServerDraft]);

  useEffect(() => {
    if (!draftId || !imageFile) return;
    let active = true;
    const fileToUpload = imageFile;
    setIsLoadingImage(true);
    void uploadArticleImageFile(fileToUpload, {
      x: formData.media.focalPointX,
      y: formData.media.focalPointY,
    })
      .then((uploaded) => {
        if (!active) return;
        setImagePreview(uploaded.url);
        setImageFile((current) => (current === fileToUpload ? null : current));
        setFormData((current) => ({
          ...current,
          media: {
            ...current.media,
            sourceMediaId: uploaded.sourceMediaId || current.media.sourceMediaId,
            width: uploaded.width || current.media.width,
            height: uploaded.height || current.media.height,
            format: uploaded.format || current.media.format,
            variants: uploaded.variants,
          },
        }));
        setImageQualityNote('Featured image uploaded and attached to the server draft.');
      })
      .catch((uploadError: unknown) => {
        if (!active) return;
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : 'Failed to upload the draft image.'
        );
      })
      .finally(() => {
        if (active) setIsLoadingImage(false);
      });
    return () => {
      active = false;
    };
  }, [draftId, formData.media.focalPointX, formData.media.focalPointY, imageFile]);

  useEffect(() => {
    if (
      isLoading ||
      !draftId ||
      !articleAudioFile ||
      Boolean(validateArticleAudioFile(articleAudioFile))
    ) {
      return;
    }
    let active = true;
    const fileToUpload = articleAudioFile;
    setIsUploadingArticleAudio(true);
    void uploadArticleTtsAudioDirect({
      articleId: draftId,
      file: fileToUpload,
      authHeaders: getAuthHeader(),
    })
      .then(() => {
        if (!active) return;
        setArticleAudioStored(true);
        setArticleAudioFile((current) => (current === fileToUpload ? null : current));
        setArticleAudioPreviewUrl('');
        setArticleAudioValidationError('');
      })
      .catch((uploadError: unknown) => {
        if (!active) return;
        setArticleAudioValidationError(
          uploadError instanceof Error
            ? `Draft audio upload failed: ${uploadError.message}`
            : 'Draft audio upload failed.'
        );
      })
      .finally(() => {
        if (active) setIsUploadingArticleAudio(false);
      });
    return () => {
      active = false;
    };
  }, [articleAudioFile, draftId, isLoading]);

  useEffect(() => {
    if (
      isLoading ||
      !draftId ||
      !formData.isBreaking ||
      !breakingAudioFile ||
      Boolean(validateArticleAudioFile(breakingAudioFile, 'Breaking'))
    ) {
      return;
    }
    let active = true;
    const fileToUpload = breakingAudioFile;
    setIsUploadingBreakingAudio(true);
    void uploadBreakingTtsAudioDirect({
      articleId: draftId,
      file: fileToUpload,
      expectedVersion: draftVersion || 1,
      authHeaders: getAuthHeader(),
    })
      .then((uploaded) => {
        if (!active) return;
        setBreakingAudioStored(true);
        setBreakingAudioFile((current) => (current === fileToUpload ? null : current));
        setBreakingAudioPreviewUrl('');
        setBreakingAudioValidationError('');
        adoptDraft({
          id: draftId,
          version: uploaded.version,
          updatedAt: uploaded.updatedAt,
        });
      })
      .catch((uploadError: unknown) => {
        if (!active) return;
        setBreakingAudioValidationError(
          uploadError instanceof Error
            ? `Draft breaking audio upload failed: ${uploadError.message}`
            : 'Draft breaking audio upload failed.'
        );
      })
      .finally(() => {
        if (active) setIsUploadingBreakingAudio(false);
      });
    return () => {
      active = false;
    };
  }, [adoptDraft, breakingAudioFile, draftId, draftVersion, formData.isBreaking, isLoading]);

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

      if (name === 'author') {
        const selectedMember = authorOptions.find((member) => member.name === String(nextValue));
        next.authorProfileUrl = selectedMember?.profileUrl || '';
        next.authorDisplayName = selectedMember?.name || '';
        next.authorDisplayNameSet = Boolean(selectedMember);
        next.authorAvatarUrl = selectedMember?.image || '';
      }

      if (name === 'authorDisplayName') {
        next.authorDisplayNameSet = true;
      }

      if (name === 'isBreaking') {
        const checked = (e.target as HTMLInputElement).checked;
        next.editorial = {
          ...current.editorial,
          storyType: checked
            ? 'breaking'
            : current.editorial.storyType === 'breaking'
              ? 'standard'
              : current.editorial.storyType,
        };
      }

      return next;
    });
  };

  const handleAuthorPhotoUpload = useCallback(async (file: File) => {
    setError('');
    setIsUploadingAuthorPhoto(true);
    try {
      const url = await uploadAuthorProfileImage(file);
      setFormData((current) => ({ ...current, authorAvatarUrl: url }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload profile photo');
    } finally {
      setIsUploadingAuthorPhoto(false);
    }
  }, []);

  const updateEditorialField = <Key extends keyof ArticleEditorialMeta>(
    key: Key,
    value: ArticleEditorialMeta[Key]
  ) => {
    setFormData((current) => ({
      ...current,
      editorial: {
        ...current.editorial,
        [key]: value,
      },
    }));
  };

  const updateMediaField = <Key extends keyof Omit<ArticleMediaMetadata, 'variants'>>(
    key: Key,
    value: ArticleMediaMetadata[Key]
  ) => {
    setFormData((current) => ({
      ...current,
      media: {
        ...current.media,
        [key]: value,
      },
    }));
  };

  const handleContentChange = useCallback((content: string) => {
    setFormData((current) => {
      const plainContent = stripArticleHtml(content);
      const combinedText = `${current.title} ${current.summary} ${plainContent}`;
      const focusKeyword =
        current.focusKeyword.trim() || suggestArticleFocusKeyword(combinedText).slice(0, 120);

      return {
        ...current,
        content,
        ...(!current.seoDescription.trim() && !current.summary.trim() && plainContent
          ? { seoDescription: plainContent.slice(0, 320) }
          : {}),
        ...(!current.focusKeyword.trim() && focusKeyword ? { focusKeyword } : {}),
        ...(!current.secondaryKeywords.trim()
          ? {
              secondaryKeywords: suggestArticleSecondaryKeywords(
                combinedText,
                focusKeyword
              ).slice(0, 180),
            }
          : {}),
      };
    });
  }, []);

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

  const useTrendingAudienceSignal = async () => {
    setIsTrendingSignalLoading(true);
    setTrendingSignalStatus('');
    try {
      const response = await fetch(
        `/api/admin/articles/trending-signal?category=${encodeURIComponent(formData.category)}`,
        { headers: { ...getAuthHeader() } }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        data?: { available?: boolean; reason?: string; detail?: string };
      };
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || 'Audience signal is unavailable');
      }
      if (!payload.data.available || !payload.data.reason) {
        setTrendingSignalStatus(payload.data.detail || 'No audience signal is available.');
        return;
      }
      updateEditorialField('trendingReason', payload.data.reason);
      setTrendingSignalStatus(payload.data.detail || 'Audience signal added for editorial review.');
    } catch (signalError) {
      setTrendingSignalStatus(
        signalError instanceof Error ? signalError.message : 'Audience signal is unavailable'
      );
    } finally {
      setIsTrendingSignalLoading(false);
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

  const insertAssistSuggestion = (suggestion: ArticleAssistSuggestion) => {
    if (!suggestion.insertValue || !suggestion.targetField) return;
    if (suggestion.targetField === 'title') {
      setFormData((current) => ({
        ...current,
        title: suggestion.insertValue || current.title,
        seoTitle: current.seoTitle.trim()
          ? current.seoTitle
          : (suggestion.insertValue || '').slice(0, 160),
      }));
      return;
    }
    if (suggestion.targetField === 'content') {
      setFormData((current) => ({
        ...current,
        content: `${current.content}${current.content.trim() ? '\n' : ''}${suggestion.insertValue}`,
      }));
      setContentMode('write');
    }
  };

  const applyTranslation = (field: 'title' | 'summary' | 'content', value: string) => {
    if (field === 'content') {
      handleContentChange(value);
      setContentMode('write');
      return;
    }
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const focusWorkbenchField = useCallback((field: ArticleAssistField) => {
    if (typeof document === 'undefined') return;
    if (
      field === 'image' ||
      field === 'featuredImageAlt' ||
      field === 'featuredImageCaption' ||
      field === 'imageCredit' ||
      field === 'imageLicense'
    ) {
      setInspectorTab('media');
    } else if (
      field === 'seoTitle' ||
      field === 'seoDescription' ||
      field === 'seoSlug' ||
      field === 'focusKeyword' ||
      field === 'secondaryKeywords' ||
      field === 'canonicalUrl' ||
      field === 'authorProfileUrl'
    ) {
      setInspectorTab('seo');
    } else if (field === 'breakingAudio' || field === 'isBreaking' || field === 'isTrending') {
      setInspectorTab('publish');
    } else if (
      field === 'storyType' ||
      field === 'sourceAttribution' ||
      field === 'quoteAttribution' ||
      field === 'eventDateTime' ||
      field === 'factCheckStatus' ||
      field === 'legalReviewStatus' ||
      field === 'sensitivityReviewStatus' ||
      field === 'headlineSupportConfirmed' ||
      field === 'duplicateCheckComplete' ||
      field === 'aiDisclosure'
    ) {
      setInspectorTab('quality');
    }
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
      imageLicense: '[name="imageLicense"]',
      canonicalUrl: '[name="canonicalUrl"]',
      authorProfileUrl: '[name="authorProfileUrl"]',
      sourceInfo: '[name="sourceInfo"]',
      breakingAudio: '[data-article-field="breakingAudio"], [name="isBreaking"]',
      isBreaking: '[name="isBreaking"]',
      isTrending: '[name="isTrending"]',
      storyType: '[name="storyType"]',
      sourceAttribution: '[name="sourceAttribution"]',
      quoteAttribution: '[name="quoteAttribution"]',
      eventDateTime: '[name="eventDateTime"]',
      factCheckStatus: '[name="factCheckStatus"]',
      legalReviewStatus: '[name="legalReviewStatus"]',
      sensitivityReviewStatus: '[name="sensitivityReviewStatus"]',
      headlineSupportConfirmed: '[name="headlineSupportConfirmed"]',
      duplicateCheckComplete: '[name="duplicateCheckComplete"]',
      aiDisclosure: '[name="aiDisclosure"]',
    };
    const selector = fieldSelectors[field] || `[name="${field}"]`;
    window.setTimeout(() => {
      const element = document.querySelector<HTMLElement>(selector);
      const details = element?.closest('details') as HTMLDetailsElement | null;
      if (details) details.open = true;
      if (typeof element?.scrollIntoView === 'function') {
        element.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      const focusTarget = element?.matches(
        'input, textarea, select, button, [contenteditable="true"]'
      )
        ? element
        : element?.querySelector<HTMLElement>(
            'input, textarea, select, button, [contenteditable="true"]'
          );
      focusTarget?.focus();
    }, 0);
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
        media: {
          ...current.media,
          sourceMediaId: '',
          width: prepared.width,
          height: prepared.height,
          format: prepared.file.type.replace(/^image\//, ''),
          variants: createEmptyArticleMediaMetadata().variants,
        },
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
    if (!imageFile) return { url: imagePreview, media: formData.media };

    setIsLoadingImage(true);
    try {
      const uploaded = await uploadArticleImageFile(imageFile, {
        x: formData.media.focalPointX,
        y: formData.media.focalPointY,
      });
      const media = {
        ...formData.media,
        sourceMediaId: uploaded.sourceMediaId || formData.media.sourceMediaId,
        width: uploaded.width || formData.media.width,
        height: uploaded.height || formData.media.height,
        format: uploaded.format || formData.media.format,
        variants: uploaded.variants,
      };
      setImagePreview(uploaded.url);
      setFormData((current) => ({ ...current, media }));
      setImageFile(null);
      return { url: uploaded.url, media };
    } catch (err) {
      setError('Failed to upload image. Please try again.');
      throw err;
    } finally {
      setIsLoadingImage(false);
    }
  };

  const selectMediaLibraryItem = (item: MediaLibraryItem) => {
    setImageFile(null);
    setImagePreview(item.url);
    setImageQualityNote('Selected from the newsroom media library.');
    setFormData((current) => ({
      ...current,
      featuredImageAlt: current.featuredImageAlt.trim()
        ? current.featuredImageAlt
        : item.filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 220),
      media: {
        ...current.media,
        sourceMediaId: item._id,
        format: String(item.type || '').replace(/^image\//, ''),
        variants: createEmptyArticleMediaMetadata().variants,
      },
    }));
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

    if (draftRecoveryBlocking) {
      setError('Restore or discard the browser recovery copy before creating this article.');
      return;
    }

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

    if (workflowIntent === 'schedule') {
      const scheduledTime = new Date(workflowScheduledFor).getTime();
      if (!workflowScheduledFor || !Number.isFinite(scheduledTime)) {
        setInspectorTab('publish');
        setError('Choose a valid publication date and time before scheduling.');
        return;
      }
      if (scheduledTime <= Date.now()) {
        setInspectorTab('publish');
        setError('Scheduled publication must be in the future.');
        return;
      }
    }

    if (workflowDueAt && !Number.isFinite(new Date(workflowDueAt).getTime())) {
      setInspectorTab('publish');
      setError('Choose a valid editorial deadline.');
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

      const breakingAudioRequired = workflowIntent === 'publish' && formData.isBreaking;
      const breakingValidationError = validateArticleAudioFile(breakingAudioFile, 'Breaking');
      if (breakingAudioRequired && !breakingAudioFile && !breakingAudioStored) {
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
        !formData.authorProfileUrl.trim().startsWith('/') &&
        !isValidAbsoluteHttpUrl(formData.authorProfileUrl.trim())
      ) {
        setError('Author profile URL must be a local path or start with http:// or https://');
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
      let finalMedia = formData.media;
      if (imageFile) {
        const uploaded = await uploadImage();
        imageUrl = uploaded.url;
        finalMedia = uploaded.media;
      }
      const finalPayload = buildArticleMutationPayload(
        formData,
        imageUrl,
        sourceStoryId,
        finalMedia
      );
      const response = await fetch(
        draftId
          ? `/api/admin/articles/${encodeURIComponent(draftId)}`
          : '/api/admin/articles',
        {
        method: draftId ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          ...finalPayload,
          ...(draftId
            ? { expectedVersion: draftVersion }
            : { intent: 'draft' }),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          response.status === 409
            ? 'This draft changed in another session. Open the saved draft and compare before publishing.'
            : data.error || 'Failed to save the article draft'
        );
      }

      const createdArticleId = resolveCreatedArticleId(data.data);
      if (!createdArticleId) {
        throw new Error('The server saved the draft without returning an article ID.');
      }
      const savedVersion = resolveCreatedArticleVersion(data.data);
      let workflowExpectedVersion = savedVersion;
      const savedAt =
        typeof data?.data?.updatedAt === 'string'
          ? data.data.updatedAt
          : new Date().toISOString();
      adoptDraft({ id: createdArticleId, version: savedVersion, updatedAt: savedAt });

      let audioUploadWarning = '';
      if (breakingAudioFile) {
        setIsUploadingBreakingAudio(true);
        try {
          const uploaded = await uploadBreakingTtsAudioDirect({
            articleId: createdArticleId,
            file: breakingAudioFile,
            expectedVersion: workflowExpectedVersion,
            authHeaders: getAuthHeader(),
          });
          workflowExpectedVersion = uploaded.version;
          adoptDraft({
            id: createdArticleId,
            version: uploaded.version,
            updatedAt: uploaded.updatedAt,
          });
        } catch (audioError) {
          const uploadError =
            audioError instanceof Error
              ? `Breaking audio upload failed: ${audioError.message}`
              : 'Breaking audio upload failed.';
          if (breakingAudioRequired) throw new Error(uploadError);
          audioUploadWarning = uploadError;
        } finally {
          setIsUploadingBreakingAudio(false);
        }
      }

      if (articleAudioFile) {
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
              ? `Listen audio upload failed: ${audioError.message}`
              : 'Listen audio upload failed.';
        } finally {
          setIsUploadingArticleAudio(false);
        }
      }

      const workflowAction = workflowIntent;
      const workflowResponse = await fetch(
        `/api/admin/articles/${encodeURIComponent(createdArticleId)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
          },
          body: JSON.stringify({
            action: workflowAction,
            expectedVersion: workflowExpectedVersion,
            priority: workflowPriority,
            ...(workflowDueAt ? { dueAt: workflowDueAt } : {}),
            ...(workflowAction === 'schedule'
              ? { scheduledFor: workflowScheduledFor }
              : {}),
          }),
        }
      );
      const workflowPayload = await workflowResponse.json().catch(() => ({}));
      if (!workflowResponse.ok || workflowPayload?.success === false) {
        throw new Error(
          workflowPayload?.error ||
            `The draft was saved, but ${workflowAction === 'publish' ? 'publishing' : 'submission'} failed.`
        );
      }

      let workflowVersion = resolveCreatedArticleVersion(workflowPayload?.data);
      adoptDraft({
        id: createdArticleId,
        version: workflowVersion,
        updatedAt:
          typeof workflowPayload?.data?.updatedAt === 'string'
            ? workflowPayload.data.updatedAt
            : new Date().toISOString(),
      });


      if (workflowAction === 'submit' && workflowAssigneeId) {
        const assignmentResponse = await fetch(
          `/api/admin/articles/${encodeURIComponent(createdArticleId)}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeader(),
            },
            body: JSON.stringify({
              action: 'assign',
              expectedVersion: workflowVersion,
              assignedToId: workflowAssigneeId,
              priority: workflowPriority,
              ...(workflowDueAt ? { dueAt: workflowDueAt } : {}),
            }),
          }
        );
        const assignmentPayload = await assignmentResponse.json().catch(() => ({}));
        if (!assignmentResponse.ok || assignmentPayload?.success === false) {
          audioUploadWarning =
            assignmentPayload?.error ||
            'Article was submitted, but the editor assignment could not be saved.';
        } else {
          workflowVersion = resolveCreatedArticleVersion(assignmentPayload?.data);
          adoptDraft({
            id: createdArticleId,
            version: workflowVersion,
            updatedAt:
              typeof assignmentPayload?.data?.updatedAt === 'string'
                ? assignmentPayload.data.updatedAt
                : new Date().toISOString(),
          });
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
      setArticleAudioStored(false);
      setBreakingAudioStored(false);
      setContentMode('write');
      setIsSeoSlugTouched(false);
      clearDraft(true);

      if (audioUploadWarning) {
        setSuccess(
          workflowIntent === 'publish'
            ? 'Article published. Redirecting to the editor to retry the remaining attachment...'
            : workflowIntent === 'schedule'
              ? 'Article scheduled. Redirecting to the editor to retry the remaining attachment...'
              : 'Article submitted. Redirecting to the editor to retry the remaining attachment...'
        );
        setError(audioUploadWarning);
        scheduleRedirect(
          createdArticleId
            ? `/admin/articles/${encodeURIComponent(createdArticleId)}/edit`
            : '/admin/articles',
          2500
        );
        return;
      }

      setSuccess(
        breakingAudioFile || breakingAudioStored
            ? workflowIntent === 'publish'
              ? 'Article published successfully with breaking audio! Redirecting...'
              : workflowIntent === 'schedule'
                ? 'Article scheduled successfully with breaking audio! Redirecting...'
                : 'Article submitted successfully with staged breaking audio! Redirecting...'
            : articleAudioFile || articleAudioStored
          ? workflowIntent === 'publish'
            ? 'Article published successfully with listen audio! Redirecting...'
            : workflowIntent === 'schedule'
              ? 'Article scheduled successfully with listen audio! Redirecting...'
              : 'Article submitted successfully with listen audio! Redirecting...'
          : successMessage
      );

      scheduleRedirect('/admin/articles', 2000);
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
              <div
                className={`inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${
                  serverDraftStatus === 'conflict' || serverDraftStatus === 'error'
                    ? 'border-red-400/40 bg-red-500/15 text-red-100'
                    : serverDraftStatus === 'offline'
                      ? 'border-amber-300/40 bg-amber-400/15 text-amber-100'
                      : 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100'
                }`}
                title={serverDraftMessage || draftStatusLabel}
                aria-live="polite"
              >
                {serverDraftStatus === 'offline' ? (
                  <CloudOff className="h-4 w-4" />
                ) : (
                  <Cloud className="h-4 w-4" />
                )}
                <span>{draftStatusLabel}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  persistDraft();
                  void saveServerDraft();
                }}
                disabled={
                  draftRecoveryBlocking ||
                  !hasMeaningfulDraftContent ||
                  serverDraftStatus === 'saving'
                }
                className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
                title="Save draft (Ctrl+S)"
              >
                <Save className="h-4 w-4" />
                <span>Save draft</span>
              </button>
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
                <span>Check readiness</span>
              </button>
              <button
                type="button"
                onClick={() => setContentMode((current) => (current === 'preview' ? 'write' : 'preview'))}
                className="ml-auto inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/[0.12]"
              >
                <FileText className="h-4 w-4" />
                <span>{contentMode === 'preview' ? 'Continue writing' : 'Preview'}</span>
              </button>
              <button
                type="submit"
                form="article-create-form"
                disabled={
                  submitBusy ||
                  draftRecoveryBlocking ||
                  Boolean(sourceStory?.linkedArticleId) ||
                  !liveReadinessSummary.canSend
                }
                className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md bg-spanish-red px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                <span>{submitBusy ? submitBusyLabel : submitLabel}</span>
              </button>
            </div>
          ) : null}

          {pendingDraftRecovery ? (
            <ArticleDraftRecoveryNotice
              savedAtLabel={
                pendingDraftRecovery.savedAt
                  ? formatDraftTimestamp(pendingDraftRecovery.savedAt)
                  : ''
              }
              onRestore={restorePendingDraft}
              onDiscard={discardPendingDraft}
            />
          ) : null}

          <form
            id="article-create-form"
            ref={articleFormRef}
            onSubmit={handleSubmit}
            className="admin-article-workspace space-y-4 sm:space-y-8"
          >
            <CmsEditorColumns stacked={isFocusMode} sidebarWidth="workspace">
            <ArticleComposeModule
              value={formData}
              image={imagePreview}
              mode={contentMode}
              focusMode={isFocusMode}
              categories={categories}
              canCreateCategories={canCreateCategories}
              authorOptions={authorOptions}
              onChange={handleInputChange}
              onContentChange={handleContentChange}
              onModeChange={setContentMode}
              onFocusModeChange={setIsFocusMode}
              onAuthorPhotoUpload={handleAuthorPhotoUpload}
              authorPhotoUploading={isUploadingAuthorPhoto}
              onCategoryCreated={(name) => {
                setCategories((current) => [name, ...current.filter((category) => category !== name)]);
                setFormData((current) => ({ ...current, category: name }));
              }}
            />

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

              <div
                role="tablist"
                aria-label="Article inspector"
                className="sticky top-0 z-10 grid grid-cols-4 gap-1 rounded-xl border border-gray-200 bg-white/95 p-1.5 shadow-sm backdrop-blur"
              >
                {(
                  [
                    ['media', 'Media'],
                    ['seo', 'SEO'],
                    ['publish', 'Publish'],
                    ['quality', 'Quality'],
                  ] as const
                ).map(([tab, label]) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={inspectorTab === tab}
                    aria-controls={`article-inspector-${tab}`}
                    onClick={() => setInspectorTab(tab)}
                    className={`min-h-9 rounded-lg px-2 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spanish-red focus-visible:ring-offset-2 ${
                      inspectorTab === tab
                        ? 'bg-zinc-950 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div
                id="article-inspector-quality-assistant"
                role="region"
                aria-label="Article assistance"
                className={inspectorTab === 'quality' ? 'space-y-4' : 'hidden'}
              >
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
                onInsertSuggestion={insertAssistSuggestion}
                title="Packaging assistant"
                />
                <ArticleTranslationReview
                  title={formData.title}
                  summary={formData.summary}
                  content={formData.content}
                  reporterNotes={formData.reporterNotes}
                  sourcePackage={[
                    sourceStory?.title,
                    sourceStory?.caption,
                    formData.sourceInfo,
                  ].filter(Boolean).join('\n')}
                  onApply={applyTranslation}
                />
              </div>

              <ArticleDraftModule
                active={inspectorTab === 'publish'}
                debounceSeconds={SERVER_AUTOSAVE_DEBOUNCE_MS / 1000}
                savedAtLabel={draftSavedAt ? formatDraftTimestamp(draftSavedAt) : ''}
                statusLabel={draftStatusLabel}
                draftId={draftId}
                draftVersion={draftVersion}
                message={serverDraftMessage}
                restored={draftRestored}
                onSave={() => {
                  persistDraft();
                  void saveServerDraft();
                }}
                onDiscardRecovery={() => clearDraft(false)}
              />

              <ArticleMediaModule
                active={inspectorTab === 'media'}
                busy={submitBusy}
                audioAccept={ARTICLE_AUDIO_ACCEPT}
                audioFile={articleAudioFile}
                audioSizeLabel={articleAudioFile ? formatArticleAudioSize(articleAudioFile.size) : ''}
                audioPreviewUrl={articleAudioPreviewUrl}
                audioStored={articleAudioStored}
                audioValidationError={articleAudioValidationError}
                onAudioChange={handleArticleAudioChange}
                onClearAudio={clearArticleAudioFile}
                image={imagePreview}
                imageQualityNote={imageQualityNote}
                media={formData.media}
                editorial={formData.editorial}
                title={formData.title}
                summary={formData.summary}
                category={formData.category}
                featuredImageAlt={formData.featuredImageAlt}
                featuredImageCaption={formData.featuredImageCaption}
                imageCredit={formData.imageCredit}
                mediaSearch={mediaSearch}
                mediaLibraryLoading={isMediaLibraryLoading}
                mediaLibraryError={mediaLibraryError}
                mediaLibrary={filteredMediaLibrary}
                onImageChange={handleImageChange}
                onRemoveImage={() => {
                  setImageFile(null);
                  setImagePreview('');
                  setImageQualityNote('');
                  setFormData((current) => ({
                    ...current,
                    media: createEmptyArticleMediaMetadata(),
                  }));
                }}
                onMediaSearchChange={setMediaSearch}
                onSelectMedia={selectMediaLibraryItem}
                onMediaChange={updateMediaField}
                onEditorialChange={updateEditorialField}
                onTextChange={handleInputChange}
              />
              <ArticleSeoModule
                active={inspectorTab === 'seo'}
                value={formData}
                previewPath={previewPath}
                googlePreview={googlePreview}
                onChange={handleInputChange}
              />

              <ArticlePublishModule
                active={inspectorTab === 'publish'}
                busy={submitBusy}
                isBreaking={formData.isBreaking}
                isTrending={formData.isTrending}
                majorUpdateNote={formData.majorUpdateNote}
                editorial={formData.editorial}
                onTextChange={handleInputChange}
                onEditorialChange={updateEditorialField}
                breakingRecordingScript={breakingRecordingScript}
                breakingAudioAccept={ARTICLE_AUDIO_ACCEPT}
                breakingAudioFile={breakingAudioFile}
                breakingAudioSizeLabel={breakingAudioFile ? formatArticleAudioSize(breakingAudioFile.size) : ''}
                breakingAudioPreviewUrl={breakingAudioPreviewUrl}
                breakingAudioStored={breakingAudioStored}
                breakingAudioValidationError={breakingAudioValidationError}
                onBreakingAudioChange={handleBreakingAudioChange}
                onClearBreakingAudio={clearBreakingAudioFile}
                onUseTrendingSignal={useTrendingAudienceSignal}
                trendingSignalLoading={isTrendingSignalLoading}
                trendingSignalStatus={trendingSignalStatus}
                workflowIntent={workflowIntent}
                onWorkflowIntentChange={setWorkflowIntent}
                canPublishImmediately={canPublishImmediately}
                scheduledFor={workflowScheduledFor}
                onScheduledForChange={setWorkflowScheduledFor}
                priority={workflowPriority}
                onPriorityChange={setWorkflowPriority}
                dueAt={workflowDueAt}
                onDueAtChange={setWorkflowDueAt}
                assigneeId={workflowAssigneeId}
                onAssigneeChange={setWorkflowAssigneeId}
                teamOptions={teamOptions}
                teamOptionsError={teamOptionsError}
              />
              <ArticleReadinessModule
                active={inspectorTab === 'quality'}
                editorial={formData.editorial}
                onEditorialChange={updateEditorialField}
                summary={liveReadinessSummary}
                assistResult={liveAssistResult}
                linkedArticleExists={Boolean(sourceStory?.linkedArticleId)}
                onFocusItem={focusReadinessItem}
                onRunAssist={runArticleAssist}
                isAssistLoading={isAssistLoading}
                article={{
                  title: formData.title,
                  summary: formData.summary,
                  content: formData.content,
                  slug: formData.seoSlug,
                  image: imagePreview,
                  seo: normalizedSeo,
                  category: formData.category,
                  relatedArticles,
                }}
              />
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
                      draftRecoveryBlocking ||
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

