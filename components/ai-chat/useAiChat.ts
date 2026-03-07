'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NEWS_CATEGORIES, resolveNewsCategory } from '@/lib/constants/newsCategories';
import { BHASHINI_LANGUAGE_OPTIONS } from '@/lib/constants/lokswamiAi';
import { useAppStore } from '@/lib/store/appStore';
import type {
  AiAnswerSource,
  AiCategorySuggestion,
  AiChatSuggestions,
  AiContentGroups,
  AiContentItem,
  AiContentType,
  AiPrimaryAction,
  ChatMessage,
  ChatRole,
  UseAiChatOptions,
  UseAiChatResult,
} from './types';

type AwarenessResult = {
  id: string;
  title: string;
  summary: string;
  type?: AiContentType;
  url?: string;
};

type AwarenessResponse = {
  success?: boolean;
  answer?: string;
  answerSource?: AiAnswerSource;
  content?: AiContentGroups;
  confidence?: 'high' | 'medium' | 'low';
  followUpSuggestion?: string;
  primaryAction?: AiPrimaryAction | null;
  data?: {
    answer?: string;
    answerSource?: AiAnswerSource;
    results?: AwarenessResult[];
    content?: AiContentGroups;
    followUpSuggestion?: string;
    primaryAction?: AiPrimaryAction | null;
  };
  error?: string;
};

type SummaryResponse = {
  success?: boolean;
  data?: {
    bullets?: string[];
  };
  error?: string;
};

type TtsStatusResponse = {
  success?: boolean;
  data?: {
    bhashiniConfigured?: boolean;
  };
};

type TtsResponse = {
  success?: boolean;
  data?: {
    audioUrl?: string;
    audioBase64?: string;
    mimeType?: string;
  };
  error?: string;
};

type SuggestionsResponse = {
  latestEpaper?: {
    title?: string;
    date?: string;
    url?: string;
  } | null;
  trendingVideo?: {
    title?: string;
    thumbnail?: string;
    url?: string;
  } | null;
  topStory?: {
    title?: string;
    thumbnail?: string;
    url?: string;
    durationSeconds?: number;
  } | null;
  breakingArticle?: {
    title?: string;
    url?: string;
  } | null;
};

type CategoriesResponse = {
  categories?: Array<{
    name?: string;
    hindi?: string;
    count?: number;
  }>;
};

function emptyContentGroups(): AiContentGroups {
  return {
    articles: [],
    epapers: [],
    videos: [],
    stories: [],
  };
}

function emptySuggestions(): AiChatSuggestions {
  return {
    latestEpaper: null,
    trendingVideo: null,
    topStory: null,
    breakingArticle: null,
  };
}

function createMessage(
  role: ChatRole,
  text: string,
  extras: Omit<Partial<ChatMessage>, 'id' | 'role' | 'text'> = {}
): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    role,
    text,
    ...extras,
  };
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
  if (!normalizedTarget || !base) return false;

  return voices.some((voiceCode) => {
    const normalizedVoice = normalizeLangCode(voiceCode);
    return (
      normalizedVoice === normalizedTarget ||
      normalizedVoice.startsWith(`${base}-`) ||
      normalizedVoice === base
    );
  });
}

function pickBestVoice(voices: SpeechSynthesisVoice[], targetCode: string) {
  const normalizedTarget = normalizeLangCode(targetCode);
  const baseTarget = getBaseLang(targetCode);

  return (
    voices.find((voice) => normalizeLangCode(voice.lang) === normalizedTarget) ||
    voices.find((voice) => normalizeLangCode(voice.lang).startsWith(`${baseTarget}-`)) ||
    voices.find((voice) => normalizeLangCode(voice.lang) === 'hi-in') ||
    voices.find((voice) => normalizeLangCode(voice.lang).startsWith('hi-')) ||
    voices.find((voice) => normalizeLangCode(voice.lang) === 'en-us') ||
    voices.find((voice) => normalizeLangCode(voice.lang).startsWith('en-')) ||
    voices[0]
  );
}

async function ensureVoices(speech: SpeechSynthesis) {
  let voices = speech.getVoices();
  if (voices.length) return voices;

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

  return voices;
}

function isAwarenessResult(value: unknown): value is AwarenessResult {
  if (!value || typeof value !== 'object') return false;
  const source = value as Partial<AwarenessResult>;
  return (
    typeof source.id === 'string' &&
    typeof source.title === 'string' &&
    typeof source.summary === 'string'
  );
}

function isContentItem(value: unknown): value is AiContentItem {
  if (!value || typeof value !== 'object') return false;

  const source = value as Partial<AiContentItem>;
  return Boolean(
    typeof source.id === 'string' &&
      typeof source.type === 'string' &&
      typeof source.title === 'string' &&
      typeof source.description === 'string' &&
      typeof source.category === 'string' &&
      typeof source.thumbnail === 'string' &&
      typeof source.url === 'string' &&
      typeof source.date === 'string'
  );
}

function normalizeContentGroup(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is AiContentItem => isContentItem(item));
}

function normalizeContentGroups(value: unknown): AiContentGroups {
  if (!value || typeof value !== 'object') {
    return emptyContentGroups();
  }

  const source = value as Partial<AiContentGroups>;

  return {
    articles: normalizeContentGroup(source.articles),
    epapers: normalizeContentGroup(source.epapers),
    videos: normalizeContentGroup(source.videos),
    stories: normalizeContentGroup(source.stories),
  };
}

function hasContentGroups(groups: AiContentGroups) {
  return (
    groups.articles.length > 0 ||
    groups.epapers.length > 0 ||
    groups.videos.length > 0 ||
    groups.stories.length > 0
  );
}

function toSpeakableText(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 3200);
}

function getPreferredListenLanguageCode(language: 'hi' | 'en') {
  return language === 'hi' ? 'hi-IN' : 'en-US';
}

function normalizeAnswerSource(value: unknown): AiAnswerSource | undefined {
  if (
    value === 'cms_articles' ||
    value === 'general_knowledge' ||
    value === 'related_category' ||
    value === 'category_redirect' ||
    value === 'refused' ||
    value === 'empty_database' ||
    value === 'error_fallback'
  ) {
    return value;
  }

  return undefined;
}

function buildSuggestions(
  payload: SuggestionsResponse,
  language: 'hi' | 'en'
): AiChatSuggestions {
  return {
    latestEpaper:
      payload.latestEpaper &&
      typeof payload.latestEpaper.title === 'string' &&
      typeof payload.latestEpaper.url === 'string'
        ? {
            type: 'epaper',
            title: payload.latestEpaper.title,
            subtitle:
              language === 'hi' ? '📄 आज का अखबार पढ़ें' : '📄 Read today’s e-paper',
            url: payload.latestEpaper.url,
            date:
              typeof payload.latestEpaper.date === 'string'
                ? payload.latestEpaper.date
                : '',
          }
        : null,
    trendingVideo:
      payload.trendingVideo &&
      typeof payload.trendingVideo.title === 'string' &&
      typeof payload.trendingVideo.url === 'string'
        ? {
            type: 'video',
            title: payload.trendingVideo.title,
            subtitle:
              language === 'hi' ? '🎬 आज का वायरल वीडियो' : '🎬 Trending video today',
            url: payload.trendingVideo.url,
            thumbnail:
              typeof payload.trendingVideo.thumbnail === 'string'
                ? payload.trendingVideo.thumbnail
                : '',
          }
        : null,
    topStory:
      payload.topStory &&
      typeof payload.topStory.title === 'string' &&
      typeof payload.topStory.url === 'string'
        ? {
            type: 'story',
            title: payload.topStory.title,
            subtitle:
              language === 'hi' ? '⚡ आज का Mojo देखें' : '⚡ Watch today’s Mojo',
            url: payload.topStory.url,
            thumbnail:
              typeof payload.topStory.thumbnail === 'string'
                ? payload.topStory.thumbnail
                : '',
            durationSeconds:
              typeof payload.topStory.durationSeconds === 'number'
                ? payload.topStory.durationSeconds
                : undefined,
          }
        : null,
    breakingArticle:
      payload.breakingArticle &&
      typeof payload.breakingArticle.title === 'string' &&
      typeof payload.breakingArticle.url === 'string'
        ? {
            type: 'article',
            title: payload.breakingArticle.title,
            subtitle:
              language === 'hi'
                ? '📰 ब्रेकिंग खबर पढ़ें'
                : '📰 Read breaking coverage',
            url: payload.breakingArticle.url,
          }
        : null,
  };
}

function buildCategorySuggestions(
  payload: CategoriesResponse,
  language: 'hi' | 'en'
): AiCategorySuggestion[] {
  const source =
    Array.isArray(payload.categories) && payload.categories.length
      ? payload.categories
      : NEWS_CATEGORIES.slice(0, 4).map((category) => ({
          name: category.nameEn,
          hindi: category.name,
          count: 0,
        }));

  return source.slice(0, 4).map((item) => {
    const fallbackName = typeof item.name === 'string' ? item.name.trim() : '';
    const fallbackHindi = typeof item.hindi === 'string' ? item.hindi.trim() : '';
    const resolved = resolveNewsCategory(fallbackName || fallbackHindi || '');
    const hindi = fallbackHindi || resolved?.name || 'खबरें';
    const name = fallbackName || resolved?.nameEn || hindi;
    const icon = resolved?.icon || '📰';

    return {
      name,
      hindi,
      count: typeof item.count === 'number' ? item.count : 0,
      label:
        language === 'hi'
          ? `${icon} ${hindi} की खबरें`
          : `${icon} ${name} news`,
      query: language === 'hi' ? `${hindi} की खबरें` : `${name} news`,
    };
  });
}

function buildTechnicalFallbackMessage(
  query: string,
  language: 'hi' | 'en'
): ChatMessage {
  return createMessage(
    'assistant',
    language === 'hi'
      ? 'थोड़ी तकनीकी परेशानी है, एक पल में दोबारा कोशिश करें! 🔄'
      : 'There is a brief technical hiccup. Please try again in a moment! 🔄',
    {
      answerSource: 'error_fallback',
      retryQuery: query,
    }
  );
}

export function useAiChat(options: UseAiChatOptions): UseAiChatResult {
  const { isOpen } = options;
  const { language } = useAppStore();
  const pathname = usePathname();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isWorking, setIsWorking] = useState(false);
  const [errorText, setErrorText] = useState('');

  const [listenLanguageCode, setListenLanguageCode] = useState(
    getPreferredListenLanguageCode(language)
  );
  const [isPreparingListen, setIsPreparingListen] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [listenError, setListenError] = useState('');
  const [isBhashiniConfigured, setIsBhashiniConfigured] = useState(false);
  const [browserVoiceLangCodes, setBrowserVoiceLangCodes] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<AiChatSuggestions>(emptySuggestions());
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [categorySuggestions, setCategorySuggestions] = useState<AiCategorySuggestion[]>([]);
  const [isLoadingCategorySuggestions, setIsLoadingCategorySuggestions] = useState(false);

  const currentArticleId = useMemo(() => {
    const match = pathname.match(/\/main\/article\/([^/?#]+)/i);
    if (!match?.[1]) return '';
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }, [pathname]);

  const latestAssistantText = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === 'assistant' && messages[index].text.trim()) {
        return messages[index].text;
      }
    }
    return '';
  }, [messages]);

  const listenLanguageOptions = useMemo(() => {
    if (isBhashiniConfigured) return BHASHINI_LANGUAGE_OPTIONS;

    const filtered = BHASHINI_LANGUAGE_OPTIONS.filter((option) =>
      isLangSupportedByVoices(option.code, browserVoiceLangCodes)
    );
    if (filtered.length) return filtered;

    const hindi = BHASHINI_LANGUAGE_OPTIONS.find((item) => item.code === 'hi-IN');
    return hindi ? [hindi] : BHASHINI_LANGUAGE_OPTIONS.slice(0, 1);
  }, [browserVoiceLangCodes, isBhashiniConfigured]);

  const searchRouteHref = draft.trim()
    ? `/main/search?q=${encodeURIComponent(draft.trim())}`
    : '/main/search';

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const stopListening = useCallback((suppressState = false) => {
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
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (messages.length) return;

    const greeting =
      language === 'hi'
        ? 'नमस्ते, मैं लोकस्वामी AI हूं। आप खबर खोज सकते हैं, सारांश पा सकते हैं, या सुन सकते हैं।'
        : 'Hello, I am Lokswami AI. You can search news, get summaries, or listen here.';
    setMessages([createMessage('assistant', greeting)]);
  }, [isOpen, language, messages.length]);

  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [isOpen, messages, isWorking]);

  useEffect(() => {
    let active = true;

    const loadTtsStatus = async () => {
      try {
        const response = await fetch('/api/ai/tts', {
          method: 'GET',
          cache: 'no-store',
        });
        const payload = (await response.json().catch(() => ({}))) as TtsStatusResponse;
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
            .filter((value): value is string => Boolean(value && value.trim()))
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

  useEffect(() => {
    const preferredCode = getPreferredListenLanguageCode(language);
    setListenLanguageCode((current) =>
      current === preferredCode ? current : preferredCode
    );
  }, [language]);

  useEffect(() => {
    if (!listenLanguageOptions.length) return;
    if (listenLanguageCode === 'en-US') return;
    const exists = listenLanguageOptions.some((item) => item.code === listenLanguageCode);
    if (!exists) {
      setListenLanguageCode(listenLanguageOptions[0].code);
    }
  }, [listenLanguageCode, listenLanguageOptions]);

  useEffect(() => {
    return () => {
      stopListening(true);
    };
  }, [stopListening]);

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    setIsLoadingSuggestions(true);
    setIsLoadingCategorySuggestions(true);

    const loadSuggestions = async () => {
      try {
        const [suggestionsResponse, categoriesResponse] = await Promise.all([
          fetch('/api/ai/suggestions', {
            method: 'GET',
            cache: 'no-store',
          }),
          fetch('/api/ai/categories', {
            method: 'GET',
            cache: 'no-store',
          }),
        ]);

        const suggestionsPayload = (await suggestionsResponse
          .json()
          .catch(() => ({}))) as SuggestionsResponse;
        const categoriesPayload = (await categoriesResponse
          .json()
          .catch(() => ({}))) as CategoriesResponse;

        if (!active) return;

        setSuggestions(buildSuggestions(suggestionsPayload, language));
        setCategorySuggestions(buildCategorySuggestions(categoriesPayload, language));
      } catch {
        if (!active) return;
        setSuggestions(emptySuggestions());
        setCategorySuggestions(buildCategorySuggestions({}, language));
      } finally {
        if (active) {
          setIsLoadingSuggestions(false);
          setIsLoadingCategorySuggestions(false);
        }
      }
    };

    void loadSuggestions();

    return () => {
      active = false;
    };
  }, [isOpen, language]);

  const runAwarenessSearch = useCallback(
    async (query: string) => {
      const cleanQuery = query.trim();
      if (!cleanQuery) return;

      setErrorText('');
      setIsWorking(true);
      appendMessage(createMessage('user', cleanQuery));

      try {
        const response = await fetch('/api/ai/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: cleanQuery,
            language,
            limit: 8,
          }),
        });
        const payload = (await response.json().catch(() => ({}))) as AwarenessResponse;

        if (!response.ok || !payload.success) {
          appendMessage(buildTechnicalFallbackMessage(cleanQuery, language));
          return;
        }

        const answer =
          typeof payload.data?.answer === 'string' && payload.data.answer.trim()
            ? payload.data.answer.trim()
            : typeof payload.answer === 'string' && payload.answer.trim()
              ? payload.answer.trim()
              : language === 'hi'
                ? 'लोकस्वामी पर आपके लिए कुछ उपयोगी अपडेट मिले हैं।'
                : 'I found a few useful updates for you on Lokswami.';

        const normalizedGroups = normalizeContentGroups(payload.data?.content || payload.content);
        const articleLinks = Array.isArray(payload.data?.results)
          ? payload.data.results
              .filter((item) => isAwarenessResult(item))
              .slice(0, 3)
              .map((item) => ({
                id: item.id,
                title: item.title,
                type: item.type,
                url: item.url,
              }))
          : [];

        const answerSource = normalizeAnswerSource(
          payload.data?.answerSource || payload.answerSource
        );
        const primaryAction =
          payload.data?.primaryAction && typeof payload.data.primaryAction.url === 'string'
            ? payload.data.primaryAction
            : payload.primaryAction && typeof payload.primaryAction.url === 'string'
              ? payload.primaryAction
              : null;

        appendMessage(
          createMessage('assistant', answer, {
            links:
              articleLinks.length && !hasContentGroups(normalizedGroups)
                ? articleLinks
                : undefined,
            content: hasContentGroups(normalizedGroups) ? normalizedGroups : undefined,
            followUpSuggestion:
              typeof payload.data?.followUpSuggestion === 'string'
                ? payload.data.followUpSuggestion
                : typeof payload.followUpSuggestion === 'string'
                  ? payload.followUpSuggestion
                  : '',
            answerSource,
            primaryAction,
            retryQuery: answerSource === 'error_fallback' ? cleanQuery : undefined,
          })
        );
      } catch {
        appendMessage(buildTechnicalFallbackMessage(cleanQuery, language));
      } finally {
        setIsWorking(false);
      }
    },
    [appendMessage, language]
  );

  const runSummary = async (mode: 'article' | 'text') => {
    const trimmedText = draft.trim();
    const useArticle = mode === 'article' && Boolean(currentArticleId);
    const useText = mode === 'text' && Boolean(trimmedText);

    if (!useArticle && !useText) {
      appendMessage(
        createMessage(
          'assistant',
          language === 'hi'
            ? 'टेक्स्ट भेजें या कोई खबर खोलें, मैं उसका आसान सारांश तुरंत दूँगा!'
            : 'Share some text or open an article, and I will summarize it right away.'
        )
      );
      return;
    }

    setErrorText('');
    setIsWorking(true);

    if (useText) {
      appendMessage(createMessage('user', trimmedText));
      setDraft('');
    } else {
      appendMessage(
        createMessage(
          'user',
          language === 'hi' ? 'इस लेख का TL;DR दीजिए।' : 'Summarize this article.'
        )
      );
    }

    try {
      const body: { articleId?: string; text?: string; language: 'hi' | 'en' } = {
        language,
      };

      if (useArticle) {
        body.articleId = currentArticleId;
      } else {
        body.text = trimmedText;
      }

      const response = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const payload = (await response.json().catch(() => ({}))) as SummaryResponse;
      if (!response.ok || !payload.success || !payload.data) {
        appendMessage(
          createMessage(
            'assistant',
            language === 'hi'
              ? 'सारांश तैयार करते समय थोड़ी तकनीकी परेशानी है, एक पल बाद फिर कोशिश करें! 🔄'
              : 'There is a brief technical issue while creating the summary. Please try again in a moment! 🔄'
          )
        );
        return;
      }

      const bullets = Array.isArray(payload.data.bullets)
        ? payload.data.bullets.filter(
            (item): item is string => typeof item === 'string' && item.trim().length > 0
          )
        : [];

      if (!bullets.length) {
        appendMessage(
          createMessage(
            'assistant',
            language === 'hi'
              ? 'सारांश के मुख्य बिंदु तैयार हो रहे हैं। थोड़ी देर में फिर कोशिश करें!'
              : 'The summary highlights are being prepared. Please try again shortly.'
          )
        );
        return;
      }

      const summaryText = bullets.slice(0, 3).map((item) => `- ${item}`).join('\n');
      appendMessage(createMessage('assistant', summaryText));
    } catch {
      appendMessage(
        createMessage(
          'assistant',
          language === 'hi'
            ? 'सारांश तैयार करते समय थोड़ी तकनीकी परेशानी है, एक पल बाद फिर कोशिश करें! 🔄'
            : 'There is a brief technical issue while creating the summary. Please try again in a moment! 🔄'
        )
      );
    } finally {
      setIsWorking(false);
    }
  };

  const speakWithBrowserFallback = async (sourceText: string, friendlyVoiceMessage: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setListenError(
        language === 'hi'
          ? 'यह ब्राउज़र सुनने की सुविधा सपोर्ट नहीं करता।'
          : 'Listen feature is unavailable in this browser.'
      );
      return;
    }

    const speech = window.speechSynthesis;
    const voices = await ensureVoices(speech);
    if (!voices.length) {
      setListenError(friendlyVoiceMessage);
      return;
    }

    const preferredVoice = pickBestVoice(voices, listenLanguageCode);
    const utterance = new SpeechSynthesisUtterance(sourceText);
    utterance.voice = preferredVoice || null;
    utterance.lang = preferredVoice?.lang || listenLanguageCode;
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

  const handleListen = async () => {
    const sourceText = toSpeakableText(draft.trim() || latestAssistantText);
    if (!sourceText) {
      setListenError(
        language === 'hi'
          ? 'सुनने के लिए पहले AI जवाब या टेक्स्ट चाहिए।'
          : 'Need AI response or text before using Listen.'
      );
      return;
    }

    setListenError('');
    setIsPreparingListen(true);
    stopListening();

    const friendlyVoiceMessage =
      language === 'hi'
        ? 'चुनी गई voice उपलब्ध नहीं है। हिंदी या English voice चुनें, या Bhashini connect करें।'
        : 'The selected voice is unavailable. Try a Hindi or English voice, or connect Bhashini.';

    try {
      if (!isBhashiniConfigured) {
        await speakWithBrowserFallback(sourceText, friendlyVoiceMessage);
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
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as TtsResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || 'Bhashini TTS unavailable.');
      }

      const audioUrl = typeof payload.data.audioUrl === 'string' ? payload.data.audioUrl.trim() : '';
      const audioBase64 =
        typeof payload.data.audioBase64 === 'string' ? payload.data.audioBase64.trim() : '';
      const mimeType =
        typeof payload.data.mimeType === 'string' && payload.data.mimeType.trim()
          ? payload.data.mimeType.trim()
          : 'audio/mpeg';

      const src = audioUrl || (audioBase64 ? `data:${mimeType};base64,${audioBase64}` : '');
      if (!src) {
        throw new Error('No audio payload returned.');
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
      await speakWithBrowserFallback(sourceText, friendlyVoiceMessage);
    } finally {
      setIsPreparingListen(false);
    }
  };

  const sendMessage = () => {
    const cleanQuery = draft.trim();
    if (!cleanQuery || isWorking) return;
    setDraft('');
    void runAwarenessSearch(cleanQuery);
  };

  const runDraftSearch = () => {
    if (!draft.trim() || isWorking) return;
    sendMessage();
  };

  const runSuggestedQuery = (query: string) => {
    if (!query.trim() || isWorking) return;
    setDraft('');
    void runAwarenessSearch(query);
  };

  const retrySearch = (query: string) => {
    if (!query.trim() || isWorking) return;
    void runAwarenessSearch(query);
  };

  const runSummaryAction = () => {
    if (isWorking) return;
    if (draft.trim()) {
      void runSummary('text');
      return;
    }
    if (currentArticleId) {
      void runSummary('article');
      return;
    }
    void runSummary('text');
  };

  const runTopHeadlines = () => {
    if (isWorking) return;
    const query =
      language === 'hi' ? 'आज की टॉप हेडलाइंस क्या हैं?' : 'Top headlines today in India';
    void runAwarenessSearch(query);
  };

  return {
    language,
    draft,
    setDraft,
    messages,
    isWorking,
    errorText,
    searchRouteHref,
    currentArticleId,
    listenLanguageCode,
    setListenLanguageCode,
    listenLanguageOptions,
    isPreparingListen,
    isPlayingAudio,
    listenError,
    messagesEndRef,
    suggestions,
    isLoadingSuggestions,
    categorySuggestions,
    isLoadingCategorySuggestions,
    sendMessage,
    runDraftSearch,
    runSummaryAction,
    runTopHeadlines,
    runSuggestedQuery,
    retrySearch,
    handleListen,
    stopListening: () => stopListening(),
  };
}
