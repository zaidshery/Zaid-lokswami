'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Bookmark, Newspaper, Sparkles, Volume2, PauseCircle, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import NewsCard from '@/components/ui/NewsCard';
import { fetchMergedLiveArticles } from '@/lib/content/liveArticles';
import type { Article } from '@/lib/mock/data';
import { useAppStore } from '@/lib/store/appStore';
import {
  buildArticleWhatsAppShareUrl,
  toAbsoluteShareUrl,
} from '@/lib/utils/articleShare';
import {
  buildArticleImageVariantUrl,
} from '@/lib/utils/articleMedia';
import { buildArticlePublicPath } from '@/lib/seo/articleSeo';
import { formatUiDate } from '@/lib/utils/dateFormat';
import { renderArticleRichContent } from '@/lib/utils/articleRichContent';
import {
  GEMINI_TTS_LANGUAGE_OPTIONS,
  GEMINI_TTS_VOICE_OPTIONS,
} from '@/lib/constants/tts';
import {
  buildTtsAudioSource,
  fetchTtsStatus,
  requestArticleTtsAudio,
  type TtsAudioData,
} from '@/lib/ai/ttsClient';

type ApiArticle = {
  _id?: string;
  id?: string;
  slug?: string;
  title?: string;
  summary?: string;
  content?: string;
  image?: string;
  category?: string;
  author?: string | { name?: string; avatar?: string };
  publishedAt?: string;
  views?: number;
  isBreaking?: boolean;
  isTrending?: boolean;
  seo?: Article['seo'];
};

const DEFAULT_AVATAR = '/logo-icon-final.png';
const USE_REMOTE_DEMO_MEDIA =
  process.env.NEXT_PUBLIC_USE_REMOTE_DEMO_MEDIA === 'true';
const UNSPLASH_IMAGE_HOST = /^https:\/\/images\.unsplash\.com\//i;
const LOCAL_NEWS_FALLBACK_IMAGE = '/placeholders/news-16x9.svg';
const MONGO_OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;
const DEVANAGARI_REGEX = /[\u0900-\u097F]/;
const RELATED_STORIES_INITIAL_COUNT = 4;
const RELATED_STORIES_LOAD_STEP = 4;
const RELATED_STORIES_MAX_COUNT = 20;

type PreparedArticleAudio = {
  sourceId: string;
  languageCode: string;
  voice: string;
  src: string;
  payload: TtsAudioData;
};

function normalizeArticleImage(input: string) {
  const image = input.trim();
  if (!image) return '';
  if (!USE_REMOTE_DEMO_MEDIA && UNSPLASH_IMAGE_HOST.test(image)) {
    return LOCAL_NEWS_FALLBACK_IMAGE;
  }
  return image;
}

function normalizeApiArticle(raw: ApiArticle | null | undefined): Article | null {
  if (!raw) return null;

  const id = raw._id || raw.id;
  const title = (raw.title || '').trim();
  const summary = (raw.summary || '').trim();
  const image = normalizeArticleImage(raw.image || '');

  if (!id || !title || !summary || !image) {
    return null;
  }

  const authorName =
    typeof raw.author === 'string'
      ? raw.author
      : raw.author?.name || 'Editor';
  const authorAvatar =
    typeof raw.author === 'string'
      ? DEFAULT_AVATAR
      : raw.author?.avatar || DEFAULT_AVATAR;

  return {
    id,
    slug: raw.slug,
    title,
    summary,
    content: raw.content || '',
    image,
    category: raw.category || 'General',
    author: {
      id: `author-${authorName.toLowerCase().replace(/\s+/g, '-')}`,
      name: authorName,
      avatar: authorAvatar,
    },
    publishedAt: raw.publishedAt || new Date().toISOString(),
    views: Number.isFinite(raw.views) ? Number(raw.views) : 0,
    isBreaking: Boolean(raw.isBreaking),
    isTrending: Boolean(raw.isTrending),
    seo: raw.seo,
  };
}

function buildRelatedArticles(source: Article[], current: Article | null) {
  if (!source.length) return [];
  if (!current) return source.slice(0, RELATED_STORIES_MAX_COUNT);

  const sameCategory = source.filter(
    (item) =>
      item.id !== current.id &&
      item.category.toLowerCase() === current.category.toLowerCase()
  );
  const others = source.filter(
    (item) =>
      item.id !== current.id &&
      item.category.toLowerCase() !== current.category.toLowerCase()
  );

  return [...sameCategory, ...others].slice(0, RELATED_STORIES_MAX_COUNT);
}

function toPlainText(html: string) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferArticleContentLanguage(article: Article | null): 'hi' | 'en' {
  if (!article) {
    return 'hi';
  }

  const sample = [article.title, article.summary, article.content || '']
    .filter(Boolean)
    .join(' ');

  return DEVANAGARI_REGEX.test(sample) ? 'hi' : 'en';
}

function getPreferredListenLanguageCode(article: Article | null) {
  return inferArticleContentLanguage(article) === 'hi' ? 'hi-IN' : 'en-IN';
}

export default function ArticleDetailPage() {
  const router = useRouter();
  const { status } = useSession();
  const params = useParams<{ id: string }>();
  const routeId = Array.isArray(params?.id) ? params.id[0] || '' : params?.id || '';
  const language = useAppStore((state) => state.language);
  const savedArticleIds = useAppStore((state) => state.currentUser?.savedArticles ?? null);
  const [article, setArticle] = useState<Article | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<Article[]>([]);
  const [visibleRelatedCount, setVisibleRelatedCount] = useState(
    RELATED_STORIES_INITIAL_COUNT
  );
  const [isLoading, setIsLoading] = useState(true);
  const [readingProgress, setReadingProgress] = useState(0);
  const [aiBullets, setAiBullets] = useState<string[]>([]);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [, setAiSummaryError] = useState('');
  const [listenLanguageCode, setListenLanguageCode] = useState('hi-IN');
  const [listenVoiceId, setListenVoiceId] = useState('');
  const [isPreparingListen, setIsPreparingListen] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isSavingBookmark, setIsSavingBookmark] = useState(false);
  const [listenError, setListenError] = useState('');
  const [isTtsConfigured, setIsTtsConfigured] = useState<boolean | null>(null);
  const [preparedListenAudio, setPreparedListenAudio] = useState<PreparedArticleAudio | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadedListenAudioRef = useRef<HTMLAudioElement | null>(null);
  const listenRequestIdRef = useRef(0);
  const listenPrefetchRequestIdRef = useRef(0);
  const listenPrefetchPromiseRef = useRef<Promise<PreparedArticleAudio | null> | null>(null);
  const hasTrackedReadRef = useRef(false);
  const readingProgressRef = useRef(0);
  const isSignedIn = status === 'authenticated';
  const canSaveArticle = Boolean(article && MONGO_OBJECT_ID_REGEX.test(article.id));
  const articleContentLanguage = useMemo(() => inferArticleContentLanguage(article), [article]);
  const isBookmarked = Boolean(
    article && Array.isArray(savedArticleIds) && savedArticleIds.includes(article.id)
  );
  const visibleRelatedArticles = relatedArticles.slice(0, visibleRelatedCount);
  const hasMoreRelatedStories = visibleRelatedCount < relatedArticles.length;
  const canPrepareListen = isTtsConfigured === true;
  const currentListenSourceId = article?.id || '';
  const currentListenVoice = listenVoiceId || '';
  const canUsePreparedListenAudio = Boolean(
    preparedListenAudio &&
      preparedListenAudio.sourceId === currentListenSourceId &&
      preparedListenAudio.languageCode === listenLanguageCode &&
      preparedListenAudio.voice === currentListenVoice
  );
  const listenButtonTitle = (() => {
    if (isTtsConfigured === null) {
      return language === 'hi' ? 'Audio service check ho raha hai' : 'Audio service is checking';
    }

    if (isTtsConfigured === false) {
      return language === 'hi'
        ? 'Gemini audio configured nahi hai'
        : 'Gemini audio is not configured';
    }

    return language === 'hi' ? 'Lekh sunein' : 'Listen to article';
  })();

  useEffect(() => {
    let active = true;

    const loadArticle = async () => {
      setIsLoading(true);
      setAiBullets([]);
      setAiSummaryError('');
      setListenError('');
      setVisibleRelatedCount(RELATED_STORIES_INITIAL_COUNT);
      if (!routeId) {
        setArticle(null);
        setRelatedArticles([]);
        setIsLoading(false);
        return;
      }

      const articleId = decodeURIComponent(routeId);
      let found: Article | null = null;
      let merged: Article[] = [];

      try {
        const res = await fetch(`/api/articles/${encodeURIComponent(articleId)}`, {
          cache: 'no-store',
        });
        if (res.ok) {
          const payload = await res.json();
          found = normalizeApiArticle(payload?.data);
        }
      } catch {
        // fallback to merged feed below
      }

      try {
        merged = await fetchMergedLiveArticles(200);
      } catch {
        merged = [];
      }

      if (!found && merged.length) {
        found = merged.find((item) => item.id === articleId) || null;
      }

      if (!active) return;

      setArticle(found);
      setRelatedArticles(buildRelatedArticles(merged, found));
      setIsLoading(false);
    };

    loadArticle();

    return () => {
      active = false;
    };
  }, [routeId]);

  useEffect(() => {
    const updateReadingProgress = () => {
      const root = document.documentElement;
      const scrollTop = window.scrollY || root.scrollTop;
      const scrollable = root.scrollHeight - root.clientHeight;

      if (scrollable <= 0) {
        setReadingProgress(0);
        return;
      }

      const nextValue = Math.min(100, Math.max(0, (scrollTop / scrollable) * 100));
      setReadingProgress(nextValue);
    };

    updateReadingProgress();
    window.addEventListener('scroll', updateReadingProgress, { passive: true });
    window.addEventListener('resize', updateReadingProgress);

    return () => {
      window.removeEventListener('scroll', updateReadingProgress);
      window.removeEventListener('resize', updateReadingProgress);
    };
  }, []);

  useEffect(() => {
    readingProgressRef.current = readingProgress;
  }, [readingProgress]);

  const trackArticleRead = useCallback(
    async (completionPercent: number) => {
      if (!article || !MONGO_OBJECT_ID_REGEX.test(article.id) || hasTrackedReadRef.current) {
        return;
      }

      hasTrackedReadRef.current = true;

      try {
        await fetch('/api/user/track', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            articleId: article.id,
            completionPercent: Math.min(100, Math.max(0, Math.round(completionPercent))),
          }),
        });
      } catch (error) {
        console.error('Failed to track article read:', error);
        hasTrackedReadRef.current = false;
      }
    },
    [article]
  );

  useEffect(() => {
    hasTrackedReadRef.current = false;
    setVisibleRelatedCount(RELATED_STORIES_INITIAL_COUNT);
  }, [article?.id]);

  useEffect(() => {
    if (!article || !MONGO_OBJECT_ID_REGEX.test(article.id)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void trackArticleRead(Math.max(60, readingProgressRef.current));
    }, 60_000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [article, trackArticleRead]);

  useEffect(() => {
    if (readingProgress < 80) {
      return;
    }

    void trackArticleRead(readingProgress);
  }, [readingProgress, trackArticleRead]);

  useEffect(() => {
    let active = true;

    const loadTtsStatus = async () => {
      try {
        const payload = await fetchTtsStatus();
        if (!active) return;
        setIsTtsConfigured(Boolean(payload.configured));
      } catch {
        if (!active) return;
        setIsTtsConfigured(false);
      }
    };

    void loadTtsStatus();

    return () => {
      active = false;
    };
  }, []);

  const contentHtml = useMemo(() => {
    if (!article) return '';
    const raw = article.content && article.content.trim() ? article.content : article.summary;
    const parsed = renderArticleRichContent(raw);
    return parsed || renderArticleRichContent(article.summary);
  }, [article]);

  const articleMeta = useMemo(() => {
    if (!article) {
      return { readMinutes: 1, publishedText: '' };
    }

    const plain = toPlainText(article.content || article.summary || '');
    const words = plain ? plain.split(/\s+/).filter(Boolean).length : 0;
    const readMinutes = Math.max(1, Math.round(words / 220));

    const publishedText = formatUiDate(article.publishedAt, '');

    return { readMinutes, publishedText };
  }, [article]);

  const listenLanguageOptions = useMemo(() => {
    return GEMINI_TTS_LANGUAGE_OPTIONS;
  }, []);

  const listenVoiceOptions = useMemo(() => {
    return GEMINI_TTS_VOICE_OPTIONS;
  }, []);

  useEffect(() => {
    if (!listenLanguageOptions.length) return;
    const exists = listenLanguageOptions.some((item) => item.code === listenLanguageCode);
    if (!exists) {
      setListenLanguageCode(listenLanguageOptions[0].code);
    }
  }, [listenLanguageCode, listenLanguageOptions]);

  useEffect(() => {
    const preferredCode = getPreferredListenLanguageCode(article);
    setListenLanguageCode((current) =>
      current === preferredCode ? current : preferredCode
    );
  }, [article]);

  useEffect(() => {
    if (!listenVoiceId) return;
    const exists = listenVoiceOptions.some((voice) => voice.id === listenVoiceId);
    if (!exists) {
      setListenVoiceId('');
    }
  }, [listenVoiceId, listenVoiceOptions]);

  const stopListening = (suppressState = false, cancelPending = true) => {
    if (cancelPending) {
      listenRequestIdRef.current += 1;
    }

    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (!suppressState) {
      setIsPlayingAudio(false);
      setIsPreparingListen(false);
    }
  };

  const prepareArticleListenAudio = useCallback(
    async (options?: { force?: boolean }) => {
      if (!article || isTtsConfigured !== true) {
        return null;
      }

      const sourceId = article.id;
      const languageCode = listenLanguageCode;
      const voice = listenVoiceId || '';

      if (
        !options?.force &&
        preparedListenAudio &&
        preparedListenAudio.sourceId === sourceId &&
        preparedListenAudio.languageCode === languageCode &&
        preparedListenAudio.voice === voice
      ) {
        return preparedListenAudio;
      }

      if (!options?.force && listenPrefetchPromiseRef.current) {
        return await listenPrefetchPromiseRef.current;
      }

      const requestId = listenPrefetchRequestIdRef.current + 1;
      listenPrefetchRequestIdRef.current = requestId;

      const promise = requestArticleTtsAudio(sourceId, {
        languageCode,
        voice: voice || undefined,
      })
        .then((payload) => {
          if (requestId !== listenPrefetchRequestIdRef.current) {
            return null;
          }

          const src = buildTtsAudioSource(payload);
          if (!src) {
            return null;
          }

          const prepared = {
            sourceId,
            languageCode,
            voice,
            src,
            payload,
          } satisfies PreparedArticleAudio;

          const preloaded = new Audio(src);
          preloaded.preload = 'auto';
          preloaded.load();
          preloadedListenAudioRef.current = preloaded;
          setPreparedListenAudio(prepared);
          return prepared;
        })
        .catch(() => null)
        .finally(() => {
          if (requestId === listenPrefetchRequestIdRef.current) {
            listenPrefetchPromiseRef.current = null;
          }
        });

      listenPrefetchPromiseRef.current = promise;
      return await promise;
    },
    [article, isTtsConfigured, listenLanguageCode, listenVoiceId, preparedListenAudio]
  );

  const handleGenerateSummary = async () => {
    if (!article) return;
    setAiSummaryError('');
    setIsGeneratingSummary(true);

    try {
      const response = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          articleId: article.id,
          language: articleContentLanguage,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        data?: {
          bullets?: string[];
        };
        error?: string;
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || 'Failed to generate summary');
      }

      const bullets = Array.isArray(payload.data.bullets)
        ? payload.data.bullets.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];

      if (!bullets.length) {
        throw new Error('Summary was empty');
      }

      setAiBullets(bullets.slice(0, 3));
    } catch (error) {
      setAiSummaryError(error instanceof Error ? error.message : 'Failed to generate summary');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleListen = async () => {
    if (!article) return;
    const requestId = listenRequestIdRef.current + 1;
    listenRequestIdRef.current = requestId;
    setListenError('');
    setIsPreparingListen(true);
    stopListening(false, false);

    const articleListenSourceId = article.id;
    if (!articleListenSourceId) {
      setListenError(
        language === 'hi'
          ? 'सुनने के लिए लेख का टेक्स्ट उपलब्ध नहीं है।'
          : 'No article text is available for listen mode.'
      );
      setIsPreparingListen(false);
      return;
    }

    try {
      if (isTtsConfigured === null) {
        setListenError(
          language === 'hi'
            ? 'Audio service check ho raha hai. Ek pal baad phir try karein.'
            : 'Audio service is still checking. Please try again in a moment.'
        );
        return;
      }

      if (!isTtsConfigured) {
        setListenError(
          language === 'hi'
            ? 'Gemini audio abhi configured nahi hai. Thodi der baad phir try karein.'
            : 'Gemini audio is not configured right now. Please try again shortly.'
        );
        return;
      }

      const preparedAudio = await prepareArticleListenAudio();
      if (requestId !== listenRequestIdRef.current) return;

      const payload =
        preparedAudio?.payload ||
        (await requestArticleTtsAudio(articleListenSourceId, {
          languageCode: listenLanguageCode,
          voice: listenVoiceId || undefined,
        }));
      if (requestId !== listenRequestIdRef.current) return;

      const src = preparedAudio?.src || buildTtsAudioSource(payload);
      if (!src) {
        throw new Error('Gemini TTS returned no audio payload.');
      }

      const preloadedAudio = preloadedListenAudioRef.current;
      const audio =
        preloadedAudio && preloadedAudio.src === new URL(src, window.location.href).href
          ? preloadedAudio
          : new Audio(src);
      audioRef.current = audio;
      audio.onended = () => {
        if (requestId !== listenRequestIdRef.current) return;
        audioRef.current = null;
        setIsPlayingAudio(false);
      };
      audio.onerror = () => {
        if (requestId !== listenRequestIdRef.current) return;
        audioRef.current = null;
        setIsPlayingAudio(false);
        setListenError(
          language === 'hi'
            ? 'Generated Gemini audio play nahi ho paaya.'
            : 'Unable to play the generated Gemini audio.'
        );
      };

      await audio.play();
      if (requestId !== listenRequestIdRef.current) {
        audio.pause();
        return;
      }
      setIsPlayingAudio(true);
    } catch (error) {
      if (requestId !== listenRequestIdRef.current) return;
      setListenError(
        error instanceof Error && error.message.trim()
          ? error.message
          : language === 'hi'
            ? 'Gemini audio generate karne mein dikkat aayi.'
            : 'Unable to generate Gemini audio right now.'
      );
    } finally {
      if (requestId === listenRequestIdRef.current) {
        setIsPreparingListen(false);
      }
    }
  };

  useEffect(() => {
    return () => {
      stopListening(true);
    };
  }, []);

  useEffect(() => {
    listenPrefetchRequestIdRef.current += 1;
    listenPrefetchPromiseRef.current = null;
    preloadedListenAudioRef.current = null;
    setPreparedListenAudio(null);
    stopListening(true);
  }, [article?.id, listenLanguageCode, listenVoiceId]);

  useEffect(() => {
    if (!article || isTtsConfigured !== true) return;
    void prepareArticleListenAudio();
  }, [article, isTtsConfigured, prepareArticleListenAudio]);

  const handleWhatsAppShare = () => {
    if (typeof window === 'undefined' || !article) return;

    const articlePath = buildArticlePublicPath({ id: article.id, slug: article.slug });
    const articleUrl = toAbsoluteShareUrl(articlePath, window.location.origin);
    const shareUrl = buildArticleWhatsAppShareUrl({
      title: article.title,
      articleUrl,
    });

    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  const handleBookmarkToggle = async () => {
    if (!article) return;

    if (!isSignedIn) {
      router.push('/signin?redirect=/main/saved');
      return;
    }

    if (!canSaveArticle || isSavingBookmark) return;

    setIsSavingBookmark(true);

    try {
      const response = await fetch('/api/user/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ articleId: article.id }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        data?: {
          saved?: boolean;
          savedArticleIds?: string[];
        };
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error('Failed to toggle bookmark');
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('lokswami:saved-article-updated', {
            detail: {
              articleId: article.id,
              saved: Boolean(payload.data.saved),
              savedArticleIds: Array.isArray(payload.data.savedArticleIds)
                ? payload.data.savedArticleIds
                : undefined,
            },
          })
        );
      }
    } catch (error) {
      console.error('Failed to toggle article bookmark:', error);
    } finally {
      setIsSavingBookmark(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl py-10">
        <div className="cnp-surface p-6 text-sm text-zinc-600 dark:text-zinc-300">
          {language === 'hi' ? 'लेख लोड हो रहा है...' : 'Loading article...'}
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="mx-auto max-w-4xl py-10">
        <div className="cnp-surface p-6 sm:p-8">
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
            {language === 'hi' ? 'लेख नहीं मिला' : 'Article not found'}
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            {language === 'hi'
              ? 'यह लेख उपलब्ध नहीं है या हटाया जा चुका है।'
              : 'This article is unavailable or may have been removed.'}
          </p>
          <Link
            href="/main"
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-900 hover:border-orange-300 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-orange-700 dark:hover:text-orange-400"
          >
            <ArrowLeft className="h-4 w-4" />
            {language === 'hi' ? 'होम पर वापस जाएं' : 'Back to Home'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl pb-12">
      <div className="pointer-events-none fixed left-0 right-0 top-0 z-50 h-1 bg-transparent">
        <div
          className="h-full bg-gradient-to-r from-orange-500 via-orange-600 to-red-600 transition-[width] duration-150 ease-out"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      <Link
        href="/main"
        className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-zinc-700 hover:text-orange-600 dark:text-zinc-300 dark:hover:text-orange-400 sm:mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        {language === 'hi' ? 'होम' : 'Home'}
      </Link>

      <article className="cnp-surface overflow-hidden p-0">
        <div className="relative aspect-[16/9] w-full overflow-hidden">
          <Image
            src={buildArticleImageVariantUrl(article.image, 'detail')}
            alt={article.seo?.featuredImageAlt || article.title}
            fill
            className="object-cover"
            sizes="(max-width: 639px) 100vw, (max-width: 1023px) 92vw, 896px"
            priority
          />
        </div>
        {article.seo?.featuredImageCaption || article.seo?.imageCredit ? (
          <div className="border-b border-zinc-200 px-4 py-2 text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-400">
            {article.seo.featuredImageCaption ? <span>{article.seo.featuredImageCaption}</span> : null}
            {article.seo.imageCredit ? (
              <span className="ml-2 font-medium">{article.seo.imageCredit}</span>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-3.5 p-3.5 sm:space-y-4 sm:p-6 md:p-8">
          <div className="-mx-0.5 overflow-x-auto pb-0.5 pl-0.5 pr-0.5 scrollbar-hide sm:mx-0 sm:overflow-visible sm:pb-0 sm:pl-0 sm:pr-0">
            <div className="inline-flex min-w-max items-center gap-1 sm:flex sm:min-w-0 sm:flex-wrap sm:gap-2">
            <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-orange-50 px-2.5 text-[10px] font-semibold leading-none text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 sm:h-auto sm:px-3 sm:py-1 sm:text-xs sm:leading-normal">
              {article.category}
            </span>
            {article.isBreaking ? (
              <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-red-600 px-2.5 text-[10px] font-semibold leading-none text-white sm:h-auto sm:px-3 sm:py-1 sm:text-xs sm:leading-normal">
                {language === 'hi' ? 'ब्रेकिंग' : 'BREAKING'}
              </span>
            ) : null}
            {article.isTrending ? (
              <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-zinc-900 px-2.5 text-[10px] font-semibold leading-none text-white dark:bg-zinc-700 sm:h-auto sm:px-3 sm:py-1 sm:text-xs sm:leading-normal">
                {language === 'hi' ? 'ट्रेंडिंग' : 'TRENDING'}
              </span>
            ) : null}
            <div className="inline-flex items-center gap-1 sm:ml-auto sm:gap-2">
              <button
                type="button"
                onClick={() => void handleBookmarkToggle()}
                disabled={!canSaveArticle || isSavingBookmark}
                className={`inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-full border px-2 text-[10px] font-semibold leading-none transition sm:h-9 sm:px-3.5 sm:text-sm sm:font-bold sm:leading-normal ${
                  isBookmarked
                    ? 'border-orange-400 bg-orange-600 text-white hover:bg-orange-700 dark:border-orange-500 dark:bg-orange-500 dark:hover:bg-orange-400'
                    : 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-500/45 dark:bg-orange-500/12 dark:text-orange-300 dark:hover:bg-orange-500/20'
                } ${!canSaveArticle || isSavingBookmark ? 'cursor-not-allowed opacity-60' : ''}`}
                aria-pressed={isBookmarked}
                aria-label={isBookmarked ? 'Remove bookmark' : 'Save article'}
              >
                {isSavingBookmark ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                ) : (
                  <Bookmark
                    className={`h-3.5 w-3.5 max-[420px]:hidden sm:h-4 sm:w-4 ${
                      isBookmarked ? 'fill-current' : ''
                    }`}
                  />
                )}
                {isBookmarked ? 'Saved' : 'Save'}
              </button>

              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 text-[10px] font-semibold leading-none text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-700/75 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/45 sm:h-9 sm:px-3.5 sm:text-sm sm:font-bold sm:leading-normal"
                aria-label={language === 'hi' ? '\u0935\u094d\u0939\u093e\u091f\u094d\u0938\u090f\u092a \u0936\u0947\u092f\u0930' : 'Share on WhatsApp'}
              >
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-white max-[420px]:hidden sm:h-4 sm:w-4">
                  <svg viewBox="0 0 24 24" className="h-2 w-2 fill-current sm:h-2.5 sm:w-2.5" aria-hidden="true">
                    <path d="M12 2a10 10 0 0 0-8.68 14.95L2 22l5.2-1.36A10 10 0 1 0 12 2Zm0 18.17a8.15 8.15 0 0 1-4.15-1.13l-.3-.18-3.09.8.82-3.01-.2-.31A8.18 8.18 0 1 1 12 20.17Zm4.48-5.86c-.24-.12-1.4-.7-1.62-.77-.22-.08-.38-.12-.54.12-.16.24-.62.77-.76.93-.14.16-.28.18-.52.06-.24-.12-1-.37-1.91-1.17-.7-.63-1.18-1.4-1.32-1.64-.14-.24-.02-.37.1-.49.1-.1.24-.26.36-.39.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.79-.2-.47-.4-.41-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.33.98 2.49c.12.16 1.7 2.61 4.11 3.66.58.25 1.03.4 1.38.52.58.18 1.1.16 1.52.1.46-.07 1.4-.57 1.6-1.12.2-.55.2-1.02.14-1.12-.06-.1-.22-.16-.46-.28Z" />
                  </svg>
                </span>
                WhatsApp
              </button>

              <Link
                href="/main/epaper"
                className="attention-pulsate-bck inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-full border border-orange-300 bg-orange-50 px-2 text-[10px] font-semibold leading-none text-orange-700 transition hover:bg-orange-100 dark:border-orange-500/45 dark:bg-orange-500/12 dark:text-orange-300 dark:hover:bg-orange-500/20 sm:h-9 sm:px-3.5 sm:text-sm sm:font-bold sm:leading-normal"
                aria-label={language === 'hi' ? '\u0908-\u092a\u0947\u092a\u0930' : 'E-Paper'}
              >
                <Newspaper className="h-3.5 w-3.5 max-[420px]:hidden sm:h-4 sm:w-4" />
                {language === 'hi' ? '\u0908-\u092a\u0947\u092a\u0930' : 'E-Paper'}
              </Link>
            </div>
          </div>
          </div>

          <h1 className="text-xl font-black leading-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
            {article.title}
          </h1>

          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 sm:gap-2 sm:text-base">
            <span>{article.author.name}</span>
            <span aria-hidden="true">&bull;</span>
            <span>{articleMeta.readMinutes} min read</span>
            {articleMeta.publishedText ? (
              <>
                <span aria-hidden="true">&bull;</span>
                <span>{articleMeta.publishedText}</span>
              </>
            ) : null}
          </div>

          <p className="text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300 sm:text-base">
            {article.summary}
          </p>

          <section
            aria-label={language === 'hi' ? 'Lokswami AI tools' : 'Lokswami AI tools'}
            className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div
              className={`flex items-center gap-1.5 bg-zinc-50 px-2.5 py-2 dark:bg-zinc-900/70 sm:gap-2 sm:px-4 sm:py-2.5 ${
                aiBullets.length || listenError
                  ? 'border-b border-zinc-200 dark:border-zinc-800'
                  : ''
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative h-[50px] w-[50px] shrink-0 overflow-hidden rounded-xl sm:h-[65px] sm:w-[65px]">
                  <Image
                    src="/ai-logo-shery-lokswami-cutout.png"
                    alt="Lokswami AI"
                    fill
                    sizes="(max-width: 639px) 50px, 65px"
                    className="object-contain object-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
                    priority={false}
                  />
                </div>
                <div className="hidden min-w-0 sm:flex sm:flex-col sm:gap-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-bold tracking-wide text-zinc-900 dark:text-zinc-100">
                      Lokswami
                    </span>
                    <span className="inline-flex h-5 items-center rounded-full border border-red-200 bg-red-50 px-2 text-[10px] font-black uppercase tracking-[0.12em] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                      AI
                    </span>
                  </div>
                  <p className="truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Audio tools for this article
                  </p>
                </div>
              </div>

              <div className="ml-auto flex min-w-0 shrink-0 items-center justify-end gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => void handleListen()}
                  disabled={isPreparingListen || !canPrepareListen}
                  title={listenButtonTitle}
                  className={`inline-flex h-7 items-center justify-center gap-1 rounded-full border px-2 text-[10px] font-bold leading-none transition disabled:opacity-60 sm:h-8 sm:gap-1.5 sm:px-3 sm:text-xs ${
                    canUsePreparedListenAudio
                      ? 'border-emerald-300 bg-emerald-100 text-emerald-800 hover:border-emerald-400 hover:bg-emerald-200 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                  }`}
                >
                  {isPreparingListen ? <Loader2 className="h-3 w-3 animate-spin sm:h-3.5 sm:w-3.5" /> : <Volume2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                  {language === 'hi' ? '\u0938\u0941\u0928\u0947\u0902' : 'Listen'}
                </button>

                <button
                  type="button"
                  onClick={() => stopListening()}
                  disabled={!isPlayingAudio && !isPreparingListen}
                  className="inline-flex h-7 items-center justify-center gap-1 rounded-full border border-zinc-300 bg-white px-2 text-[10px] font-bold leading-none text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:h-8 sm:gap-1.5 sm:px-3 sm:text-xs"
                >
                  <PauseCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  {language === 'hi' ? '\u0930\u094b\u0915\u0947\u0902' : 'Stop'}
                </button>

                <button
                  type="button"
                  onClick={() => void handleGenerateSummary()}
                  disabled={isGeneratingSummary}
                  className="inline-flex h-7 items-center justify-center gap-1 rounded-full border border-red-200 bg-white px-2 text-[10px] font-bold leading-none text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/70 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-950/30 sm:h-8 sm:gap-1.5 sm:px-3 sm:text-xs"
                >
                  {isGeneratingSummary ? <Loader2 className="h-3 w-3 animate-spin sm:h-3.5 sm:w-3.5" /> : <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                  {language === 'hi' ? '\u0938\u093e\u0930\u093e\u0902\u0936' : 'Summary'}
                </button>
              </div>
            </div>

            {aiBullets.length ? (
              <ul className="space-y-2 px-3 py-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300 sm:px-4">
                {aiBullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2.5">
                    <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-red-600" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {listenError ? (
              <p className="border-t border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300 sm:px-4">
                {listenError}
              </p>
            ) : null}
          </section>

          <div className="h-px w-full bg-zinc-200 dark:bg-zinc-800" />

          <div
            className="article-rich-content text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200 sm:text-base"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        </div>
      </article>

      {relatedArticles.length ? (
        <section className="mt-6 space-y-3">
          <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100 sm:text-xl">
            {language === 'hi' ? 'संबंधित खबरें' : 'Related News'}
          </h2>
          <div className="space-y-3">
            {visibleRelatedArticles.map((item, index) => (
              <NewsCard key={item.id} article={item} variant="horizontal" index={index} />
            ))}
          </div>

          {hasMoreRelatedStories ? (
            <div className="flex justify-center pt-3 sm:pt-4">
              <button
                type="button"
                onClick={() =>
                  setVisibleRelatedCount((current) =>
                    Math.min(current + RELATED_STORIES_LOAD_STEP, relatedArticles.length)
                  )
                }
                className="rounded-full border border-zinc-300 bg-white px-6 py-2 text-[13px] font-semibold text-zinc-900 transition-all hover:-translate-y-0.5 hover:border-orange-300 hover:bg-orange-50 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-orange-700 dark:hover:bg-zinc-800 sm:px-8 sm:py-3 sm:text-sm"
              >
                {language === 'hi' ? '\u0914\u0930 \u0916\u092c\u0930\u0947\u0902 \u0932\u094b\u0921 \u0915\u0930\u0947\u0902' : 'Load More Stories'}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}



