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
  resolveArticleOgImageUrl,
} from '@/lib/utils/articleMedia';
import { renderArticleRichContent } from '@/lib/utils/articleRichContent';
import { BHASHINI_LANGUAGE_OPTIONS } from '@/lib/constants/lokswamiAi';

type ApiArticle = {
  _id?: string;
  id?: string;
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
};

type TtsVoiceOption = {
  id: string;
  label: string;
  languages: string[];
};

const DEFAULT_AVATAR = '/logo-icon-final.png';
const USE_REMOTE_DEMO_MEDIA =
  process.env.NEXT_PUBLIC_USE_REMOTE_DEMO_MEDIA === 'true';
const ALLOW_BROWSER_TTS_FALLBACK = process.env.NODE_ENV !== 'production';
const UNSPLASH_IMAGE_HOST = /^https:\/\/images\.unsplash\.com\//i;
const LOCAL_NEWS_FALLBACK_IMAGE = '/placeholders/news-16x9.svg';
const MONGO_OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

function parsePublicBhashiniVoiceOptions(raw: string | undefined): TtsVoiceOption[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const voices: TtsVoiceOption[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const source = item as Record<string, unknown>;
      const id = typeof source.id === 'string' ? source.id.trim().slice(0, 120) : '';
      const label = typeof source.label === 'string' ? source.label.trim().slice(0, 80) : '';
      const languages = Array.isArray(source.languages)
        ? source.languages
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            .map((value) => value.trim().slice(0, 16))
        : [];

      if (!id || !label) continue;
      voices.push({ id, label, languages });
      if (voices.length >= 20) break;
    }

    return voices;
  } catch {
    return [];
  }
}

const PUBLIC_BHASHINI_VOICE_OPTIONS = parsePublicBhashiniVoiceOptions(
  process.env.NEXT_PUBLIC_BHASHINI_TTS_VOICE_OPTIONS
);

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
  };
}

function buildRelatedArticles(source: Article[], current: Article | null) {
  if (!source.length) return [];
  if (!current) return source.slice(0, 4);

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

  return [...sameCategory, ...others].slice(0, 4);
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

function normalizeLangCode(value: string) {
  return value.trim().toLowerCase();
}

function getBaseLang(value: string) {
  return normalizeLangCode(value).split('-')[0] || '';
}

function isLangSupportedByVoices(targetCode: string, voices: string[]) {
  const normalizedTarget = normalizeLangCode(targetCode);
  const base = getBaseLang(targetCode);
  return voices.some((voiceCode) => {
    const normalizedVoice = normalizeLangCode(voiceCode);
    return (
      normalizedVoice === normalizedTarget ||
      normalizedVoice.startsWith(`${base}-`) ||
      normalizedVoice === base
    );
  });
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
  const [isBhashiniConfigured, setIsBhashiniConfigured] = useState(false);
  const [browserVoiceLangCodes, setBrowserVoiceLangCodes] = useState<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasTrackedReadRef = useRef(false);
  const readingProgressRef = useRef(0);
  const isSignedIn = status === 'authenticated';
  const canSaveArticle = Boolean(article && MONGO_OBJECT_ID_REGEX.test(article.id));
  const isBookmarked = Boolean(
    article && Array.isArray(savedArticleIds) && savedArticleIds.includes(article.id)
  );

  useEffect(() => {
    let active = true;

    const loadArticle = async () => {
      setIsLoading(true);
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
        const response = await fetch('/api/ai/tts', {
          method: 'GET',
          cache: 'no-store',
        });
        const payload = (await response.json().catch(() => ({}))) as {
          success?: boolean;
          data?: {
            bhashiniConfigured?: boolean;
          };
        };

        if (!active) return;
        setIsBhashiniConfigured(Boolean(payload?.success && payload?.data?.bhashiniConfigured));
      } catch {
        if (!active) return;
        setIsBhashiniConfigured(false);
      }
    };

    void loadTtsStatus();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const speech = window.speechSynthesis;

    const syncVoices = () => {
      const voices = speech.getVoices();
      const codes = Array.from(
        new Set(
          voices
            .map((voice) => voice.lang)
            .filter((lang): lang is string => Boolean(lang && lang.trim()))
        )
      );
      setBrowserVoiceLangCodes(codes);
    };

    syncVoices();

    const handleVoicesChanged = () => {
      syncVoices();
    };

    if (typeof speech.addEventListener === 'function') {
      speech.addEventListener('voiceschanged', handleVoicesChanged);
      return () => {
        speech.removeEventListener('voiceschanged', handleVoicesChanged);
      };
    }

    const previous = speech.onvoiceschanged;
    speech.onvoiceschanged = handleVoicesChanged;
    return () => {
      speech.onvoiceschanged = previous;
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

    const date = new Date(article.publishedAt);
    const locale = language === 'hi' ? 'hi-IN' : 'en-US';
    const publishedText = Number.isNaN(date.getTime())
      ? ''
      : date.toLocaleDateString(locale, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });

    return { readMinutes, publishedText };
  }, [article, language]);

  const articleStructuredData = useMemo(() => {
    if (!article) return null;

    const siteOrigin =
      typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const articleUrl = toAbsoluteShareUrl(
      `/main/article/${encodeURIComponent(article.id)}`,
      siteOrigin
    );
    const structuredImage = buildArticleImageVariantUrl(article.image, 'detail');

    return {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: article.title,
      description: article.summary,
      image: [toAbsoluteShareUrl(structuredImage, siteOrigin)],
      datePublished: article.publishedAt,
      dateModified: article.publishedAt,
      author: [
        {
          '@type': 'Person',
          name: article.author.name,
        },
      ],
      publisher: {
        '@type': 'Organization',
        name: 'Lokswami',
        logo: {
          '@type': 'ImageObject',
          url: toAbsoluteShareUrl('/logo-icon-final.png', siteOrigin),
        },
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': articleUrl,
      },
    };
  }, [article]);

  const listenLanguageOptions = useMemo(() => {
    if (isBhashiniConfigured) return BHASHINI_LANGUAGE_OPTIONS;

    const filtered = BHASHINI_LANGUAGE_OPTIONS.filter((option) =>
      isLangSupportedByVoices(option.code, browserVoiceLangCodes)
    );

    if (filtered.length) return filtered;

    const hindi = BHASHINI_LANGUAGE_OPTIONS.find((option) => option.code === 'hi-IN');
    return hindi ? [hindi] : BHASHINI_LANGUAGE_OPTIONS.slice(0, 1);
  }, [browserVoiceLangCodes, isBhashiniConfigured]);

  const listenVoiceOptions = useMemo(() => {
    if (!isBhashiniConfigured || !PUBLIC_BHASHINI_VOICE_OPTIONS.length) return [];

    const normalizedTarget = normalizeLangCode(listenLanguageCode);
    const baseTarget = getBaseLang(listenLanguageCode);

    return PUBLIC_BHASHINI_VOICE_OPTIONS.filter((voice) => {
      if (!voice.languages.length) return true;
      return voice.languages.some((code) => {
        const normalizedVoiceLang = normalizeLangCode(code);
        return (
          normalizedVoiceLang === normalizedTarget ||
          normalizedVoiceLang === baseTarget ||
          normalizedVoiceLang.startsWith(`${baseTarget}-`)
        );
      });
    });
  }, [isBhashiniConfigured, listenLanguageCode]);

  useEffect(() => {
    if (!listenLanguageOptions.length) return;
    const exists = listenLanguageOptions.some((item) => item.code === listenLanguageCode);
    if (!exists) {
      setListenLanguageCode(listenLanguageOptions[0].code);
    }
  }, [listenLanguageCode, listenLanguageOptions]);

  useEffect(() => {
    if (!listenVoiceId) return;
    const exists = listenVoiceOptions.some((voice) => voice.id === listenVoiceId);
    if (!exists) {
      setListenVoiceId('');
    }
  }, [listenVoiceId, listenVoiceOptions]);

  const stopListening = (suppressState = false) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (!suppressState) {
      setIsPlayingAudio(false);
    }
  };

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
          language,
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
    setListenError('');
    setIsPreparingListen(true);
    stopListening();

    const formatBulletsForSpeech = (bullets: string[]) => {
      const cleaned = bullets
        .map((item) => toPlainText(item))
        .filter((item) => item.length > 0)
        .slice(0, 3);

      if (!cleaned.length) return '';

      const prefix =
        language === 'hi' ? 'इस खबर का संक्षिप्त सारांश।' : 'Here is the quick summary.';
      const body = cleaned
        .map((item, index) => `${index + 1}. ${item}`)
        .join(' ');
      return `${prefix} ${body}`.slice(0, 1400);
    };

    const resolveListenSourceText = async () => {
      if (aiBullets.length) {
        return formatBulletsForSpeech(aiBullets);
      }

      try {
        const response = await fetch('/api/ai/summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            articleId: article.id,
            language,
          }),
        });

        const payload = (await response.json().catch(() => ({}))) as {
          success?: boolean;
          data?: {
            bullets?: string[];
          };
        };

        if (response.ok && payload.success && payload.data?.bullets?.length) {
          const bullets = payload.data.bullets
            .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
            .slice(0, 3);

          if (bullets.length) {
            setAiBullets(bullets);
            return formatBulletsForSpeech(bullets);
          }
        }
      } catch {
        // Fall back to headline + summary below.
      }

      return toPlainText(`${article.title}. ${article.summary}`).slice(0, 1200);
    };

    const sourceText = await resolveListenSourceText();
    if (!sourceText) {
      setListenError(
        language === 'hi'
          ? 'सुनने के लिए सारांश उपलब्ध नहीं है।'
          : 'No summary text is available for listen mode.'
      );
      setIsPreparingListen(false);
      return;
    }

    const friendlyVoiceMessage =
      language === 'hi'
        ? 'Selected voice is unavailable on this device. Hindi/English try karein ya Bhashini connect karein.'
        : 'Selected voice is unavailable on this device. Try Hindi/English or connect Bhashini.';

    const serverVoiceOnlyMessage =
      language === 'hi'
        ? 'हाई-क्वालिटी हिंदी वॉइस अभी उपलब्ध नहीं है। कृपया थोड़ी देर बाद फिर प्रयास करें।'
        : 'High-quality Hindi voice is currently unavailable. Please try again shortly.';

    const fallbackSpeak = async () => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setListenError(
          language === 'hi'
            ? 'Listen feature is unavailable in this browser.'
            : 'Listen feature is unavailable in this browser.'
        );
        return;
      }

      const speech = window.speechSynthesis;
      let voices = speech.getVoices();

      if (!voices.length) {
        voices = await new Promise<SpeechSynthesisVoice[]>((resolve) => {
          let settled = false;
          const timeout = window.setTimeout(() => {
            if (settled) return;
            settled = true;
            resolve(speech.getVoices());
          }, 800);

          const done = () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeout);
            resolve(speech.getVoices());
          };

          if (typeof speech.addEventListener === 'function') {
            speech.addEventListener('voiceschanged', done, { once: true });
          } else {
            const previous = speech.onvoiceschanged;
            speech.onvoiceschanged = () => {
              done();
              speech.onvoiceschanged = previous;
            };
          }
        });
      }

      if (!voices.length) {
        setListenError(friendlyVoiceMessage);
        return;
      }

      const normalizedTarget = normalizeLangCode(listenLanguageCode);
      const baseTarget = getBaseLang(listenLanguageCode);
      const preferredVoice =
        voices.find((voice) => normalizeLangCode(voice.lang) === normalizedTarget) ||
        voices.find((voice) => normalizeLangCode(voice.lang).startsWith(`${baseTarget}-`)) ||
        voices.find((voice) => normalizeLangCode(voice.lang) === 'hi-in') ||
        voices.find((voice) => normalizeLangCode(voice.lang).startsWith('hi-')) ||
        voices.find((voice) => normalizeLangCode(voice.lang) === 'en-us') ||
        voices.find((voice) => normalizeLangCode(voice.lang).startsWith('en-')) ||
        voices[0];

      const utterance = new SpeechSynthesisUtterance(sourceText);
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang || listenLanguageCode;
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.onend = () => {
        setIsPlayingAudio(false);
      };
      utterance.onerror = () => {
        setIsPlayingAudio(false);
        setListenError(friendlyVoiceMessage);
      };

      speech.cancel();
      speech.speak(utterance);
      setIsPlayingAudio(true);
    };

    try {
      if (!isBhashiniConfigured) {
        if (!ALLOW_BROWSER_TTS_FALLBACK) {
          setListenError(serverVoiceOnlyMessage);
          return;
        }
        await fallbackSpeak();
        return;
      }

      const response = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: sourceText,
          languageCode: listenLanguageCode,
          voice: listenVoiceId || undefined,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        data?: {
          audioUrl?: string;
          audioBase64?: string;
          mimeType?: string;
        };
        error?: string;
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || 'Bhashini TTS is not available.');
      }

      const audioUrl =
        typeof payload.data.audioUrl === 'string'
          ? payload.data.audioUrl.trim()
          : '';
      const audioBase64 =
        typeof payload.data.audioBase64 === 'string'
          ? payload.data.audioBase64.trim()
          : '';
      const mimeType =
        typeof payload.data.mimeType === 'string' && payload.data.mimeType.trim()
          ? payload.data.mimeType.trim()
          : 'audio/mpeg';

      const src = audioUrl || (audioBase64 ? `data:${mimeType};base64,${audioBase64}` : '');
      if (!src) {
        throw new Error('No audio payload returned by TTS provider.');
      }

      const audio = new Audio(src);
      audioRef.current = audio;
      audio.onended = () => {
        setIsPlayingAudio(false);
      };
      audio.onerror = () => {
        setIsPlayingAudio(false);
        setListenError('Unable to play generated audio.');
      };

      await audio.play();
      setIsPlayingAudio(true);
    } catch {
      if (!ALLOW_BROWSER_TTS_FALLBACK) {
        setListenError(serverVoiceOnlyMessage);
        return;
      }
      await fallbackSpeak();
    } finally {
      setIsPreparingListen(false);
    }
  };

  useEffect(() => {
    return () => {
      stopListening(true);
    };
  }, []);

  const handleWhatsAppShare = () => {
    if (typeof window === 'undefined' || !article) return;

    const articlePath = `/main/article/${encodeURIComponent(article.id)}`;
    const articleUrl = toAbsoluteShareUrl(articlePath, window.location.origin);
    const imageUrl = article.image
      ? toAbsoluteShareUrl(resolveArticleOgImageUrl({ image: article.image }), window.location.origin)
      : '';

    const shareUrl = buildArticleWhatsAppShareUrl({
      title: article.title,
      articleUrl,
      imageUrl,
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
      {articleStructuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleStructuredData) }}
        />
      ) : null}

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
            alt={article.title}
            fill
            className="object-cover"
            sizes="(max-width: 639px) 100vw, (max-width: 1023px) 92vw, 896px"
            priority
          />
        </div>

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

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="inline-flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-zinc-100">
                    <Sparkles className="h-4 w-4 text-orange-500" />
                    Lokswami AI
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => void handleGenerateSummary()}
                disabled={isGeneratingSummary}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-orange-300 bg-white px-3 py-1.5 text-xs font-semibold text-orange-700 transition hover:bg-orange-50 disabled:opacity-60 dark:border-orange-700 dark:bg-zinc-950 dark:text-orange-300 dark:hover:bg-zinc-900 sm:h-auto"
              >
                {isGeneratingSummary ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {language === 'hi' ? 'AI TL;DR' : 'AI TL;DR'}
              </button>
            </div>

            {aiBullets.length ? (
              <ul className="mt-3 space-y-1.5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {aiBullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-orange-500" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950/80">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={listenLanguageCode}
                  onChange={(event) => setListenLanguageCode(event.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 sm:w-auto"
                >
                  {listenLanguageOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>

                {listenVoiceOptions.length ? (
                  <select
                    value={listenVoiceId}
                    onChange={(event) => setListenVoiceId(event.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 sm:w-auto"
                  >
                    <option value="">
                      {language === 'hi' ? 'Auto Voice' : 'Auto Voice'}
                    </option>
                    {listenVoiceOptions.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.label}
                      </option>
                    ))}
                  </select>
                ) : null}

                <button
                  type="button"
                  onClick={() => void handleListen()}
                  disabled={isPreparingListen}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30 sm:h-auto"
                >
                  {isPreparingListen ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
                  {language === 'hi' ? 'Listen' : 'Listen'}
                </button>

                <button
                  type="button"
                  onClick={() => stopListening()}
                  disabled={!isPlayingAudio && !isPreparingListen}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-200 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 sm:h-auto"
                >
                  <PauseCircle className="h-3.5 w-3.5" />
                  Stop
                </button>
              </div>

              {listenError ? (
                <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                  {listenError}
                </p>
              ) : null}
            </div>
          </div>

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
            {relatedArticles.map((item, index) => (
              <NewsCard key={item.id} article={item} variant="horizontal" index={index} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}



