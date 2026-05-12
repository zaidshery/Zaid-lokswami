'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchTtsStatus,
} from '@/lib/ai/ttsClient';
import { NEWS_CATEGORIES, resolveNewsCategory } from '@/lib/constants/newsCategories';
import { TTS_LANGUAGE_OPTIONS } from '@/lib/constants/tts';
import { useAppStore } from '@/lib/store/appStore';
import type {
  AiAnswerSource,
  AiCategorySuggestion,
  AiChatSuggestions,
  AiContentGroups,
  AiContentItem,
  AiContentType,
  AiPrimaryAction,
  AiStructuredAnswer,
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
  structuredAnswer?: AiStructuredAnswer;
  data?: {
    answer?: string;
    answerSource?: AiAnswerSource;
    results?: AwarenessResult[];
    content?: AiContentGroups;
    followUpSuggestion?: string;
    primaryAction?: AiPrimaryAction | null;
    structuredAnswer?: AiStructuredAnswer;
  };
  error?: string;
};

type AiActionResponse = {
  success?: boolean;
  action?: 'explain' | 'translate' | 'top_news' | 'trending_topics';
  answer?: string;
  followUpSuggestion?: string;
  primaryAction?: AiPrimaryAction | null;
  content?: AiContentGroups;
  structuredAnswer?: AiStructuredAnswer;
  data?: {
    answer?: string;
    followUpSuggestion?: string;
    primaryAction?: AiPrimaryAction | null;
    content?: AiContentGroups;
    structuredAnswer?: AiStructuredAnswer;
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

function isStructuredAnswer(value: unknown): value is AiStructuredAnswer {
  if (!value || typeof value !== 'object') return false;
  const source = value as Partial<AiStructuredAnswer>;
  return (
    typeof source.headline === 'string' &&
    typeof source.summary === 'string' &&
    Array.isArray(source.keyPoints) &&
    Array.isArray(source.relatedQuestions) &&
    typeof source.whyItMatters === 'string'
  );
}

function normalizeStructuredAnswer(value: unknown): AiStructuredAnswer | undefined {
  if (!isStructuredAnswer(value)) return undefined;

  const keyPoints = value.keyPoints
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .slice(0, 5);
  const relatedQuestions = value.relatedQuestions
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .slice(0, 3);

  if (!keyPoints.length || !relatedQuestions.length) {
    return undefined;
  }

  return {
    headline: value.headline.trim(),
    summary: value.summary.trim(),
    keyPoints,
    whyItMatters: value.whyItMatters.trim(),
    relatedQuestions,
    fallbackNote:
      typeof value.fallbackNote === 'string' && value.fallbackNote.trim()
        ? value.fallbackNote.trim()
      : undefined,
  };
}

function hasUsableAssistantSource(messages: ChatMessage[], greeting: string) {
  return messages.some(
    (message) =>
      message.role === 'assistant' &&
      message.text.trim() &&
      message.text !== greeting
  );
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
            subtitle: language === 'hi' ? 'आज का ई-पेपर' : "Today's e-paper",
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
            subtitle: language === 'hi' ? 'लोकप्रिय वीडियो' : 'Trending video',
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
            subtitle: language === 'hi' ? 'आज का Mojo' : "Today's Mojo",
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
            subtitle: language === 'hi' ? 'ताज़ा कवरेज' : 'Breaking coverage',
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
      label: language === 'hi' ? `${icon} ${hindi} की खबरें` : `${icon} ${name} news`,
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
      ? 'अभी थोड़ी तकनीकी दिक्कत है। कृपया एक पल बाद फिर कोशिश करें।'
      : 'There is a brief technical issue right now. Please try again in a moment.',
    {
      answerSource: 'error_fallback',
      retryQuery: query,
    }
  );
}

function getGreetingMessage(language: 'hi' | 'en') {
  return language === 'hi'
    ? 'नमस्कार, मैं Lokswami AI Desk हूँ। मैं आपको सुर्खियाँ, जिला कवरेज, ई-पेपर और सारांश में मदद कर सकता हूँ।'
    : 'Hello, this is Lokswami AI Desk. I can help with headlines, local coverage, e-paper access, summaries, and read-aloud support.';
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

  const [isTtsConfigured, setIsTtsConfigured] = useState(false);
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
    return TTS_LANGUAGE_OPTIONS;
  }, []);

  const searchRouteHref = draft.trim()
    ? `/main/search?q=${encodeURIComponent(draft.trim())}`
    : '/main/search';

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const stopListening = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (messages.length) return;

    setMessages([createMessage('assistant', getGreetingMessage(language))]);
  }, [isOpen, language, messages.length]);

  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [isOpen, messages, isWorking]);

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

  useEffect(() => {
    return () => {
      stopListening();
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
      setListenError('');
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

        const structuredAnswer = normalizeStructuredAnswer(
          payload.data?.structuredAnswer || payload.structuredAnswer
        );
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
            structuredAnswer,
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

  const appendActionResponse = useCallback(
    (payload: AiActionResponse, fallbackAnswer: string) => {
      const normalizedGroups = normalizeContentGroups(payload.data?.content || payload.content);
      const structuredAnswer = normalizeStructuredAnswer(
        payload.data?.structuredAnswer || payload.structuredAnswer
      );
      const primaryAction =
        payload.data?.primaryAction && typeof payload.data.primaryAction.url === 'string'
          ? payload.data.primaryAction
          : payload.primaryAction && typeof payload.primaryAction.url === 'string'
            ? payload.primaryAction
            : null;
      const answer =
        typeof payload.data?.answer === 'string' && payload.data.answer.trim()
          ? payload.data.answer.trim()
          : typeof payload.answer === 'string' && payload.answer.trim()
            ? payload.answer.trim()
            : fallbackAnswer;

      appendMessage(
        createMessage('assistant', answer, {
          content: hasContentGroups(normalizedGroups) ? normalizedGroups : undefined,
          structuredAnswer,
          followUpSuggestion:
            typeof payload.data?.followUpSuggestion === 'string'
              ? payload.data.followUpSuggestion
              : typeof payload.followUpSuggestion === 'string'
                ? payload.followUpSuggestion
                : '',
          primaryAction,
        })
      );
    },
    [appendMessage]
  );

  const runAiAction = useCallback(
    async (
      action: 'explain' | 'translate' | 'top_news' | 'trending_topics',
      source: { text?: string; articleId?: string },
      fallbackAnswer: string
    ) => {
      const response = await fetch('/api/ai/actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          text: source.text,
          articleId: source.articleId,
          language,
          targetLanguage: language,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as AiActionResponse;

      if (!response.ok || !payload.success) {
        appendMessage(buildTechnicalFallbackMessage(action === 'translate' ? 'translate' : 'news', language));
        return;
      }

      appendActionResponse(payload, fallbackAnswer);
    },
    [appendActionResponse, appendMessage, language]
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
            ? 'टेक्स्ट भेजें या कोई खबर खोलें, मैं उसका आसान सारांश तुरंत दूँगा।'
            : 'Share some text or open an article, and I will summarize it right away.'
        )
      );
      return;
    }

    setErrorText('');
    setListenError('');
    setIsWorking(true);

    if (useText) {
      appendMessage(createMessage('user', trimmedText));
      setDraft('');
    } else {
      appendMessage(
        createMessage(
          'user',
          language === 'hi' ? 'इस लेख का संक्षिप्त सारांश दीजिए।' : 'Summarize this article.'
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
              ? 'सारांश तैयार करते समय थोड़ी तकनीकी दिक्कत आई। कृपया थोड़ी देर में फिर कोशिश करें।'
              : 'There was a brief technical issue while creating the summary. Please try again shortly.'
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
              ? 'सारांश के मुख्य बिंदु अभी तैयार नहीं हो पाए। कृपया थोड़ी देर में फिर कोशिश करें।'
              : 'The summary highlights are not ready yet. Please try again shortly.'
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
            ? 'सारांश तैयार करते समय थोड़ी तकनीकी दिक्कत आई। कृपया थोड़ी देर में फिर कोशिश करें।'
            : 'There was a brief technical issue while creating the summary. Please try again shortly.'
        )
      );
    } finally {
      setIsWorking(false);
    }
  };

  const handleListen = async () => {
    const sourceText = toSpeakableText(draft.trim() || latestAssistantText);
    if (!sourceText) {
      setListenError(
        language === 'hi'
          ? 'सुनने के लिए पहले AI जवाब या टेक्स्ट चाहिए।'
          : 'Need an AI response or some text before using read-aloud.'
      );
      return;
    }

    setListenError('');
    setErrorText('');
    setIsPreparingListen(true);
    stopListening();

    try {
      if (!isTtsConfigured) {
        setListenError(
          language === 'hi'
            ? 'Gemini audio abhi configured nahi hai. Thodi der baad phir try karein.'
            : 'Gemini audio is not configured right now. Please try again shortly.'
        );
        return;
      }

      const payload = await requestTtsAudio({
        text: sourceText,
        languageCode: listenLanguageCode,
      });
      const src = buildTtsAudioSource(payload);
      if (!src) {
        throw new Error('Gemini TTS returned no audio payload.');
      }

      const audio = new Audio(src);
      audioRef.current = audio;
      audio.onended = () => {
        setIsPlayingAudio(false);
      };
      audio.onerror = () => {
        setIsPlayingAudio(false);
        setListenError(
          language === 'hi'
            ? 'ऑडियो चलाने में समस्या आई।'
            : 'Unable to play the generated audio.'
        );
      };

      await audio.play();
      setIsPlayingAudio(true);
    } catch (error) {
      setListenError(
        error instanceof Error && error.message.trim()
          ? error.message
          : language === 'hi'
            ? 'Gemini audio sunane mein dikkat aayi.'
            : 'Unable to play Gemini audio right now.'
      );
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

  const runExplainAction = () => {
    if (isWorking) return;

    const greeting = getGreetingMessage(language);
    const cleanDraft = draft.trim();
    const canUseAssistantText = hasUsableAssistantSource(messages, greeting);
    const sourceText = cleanDraft || (!currentArticleId && canUseAssistantText ? latestAssistantText : '');

    if (!currentArticleId && !sourceText) {
      appendMessage(
        createMessage(
          'assistant',
          language === 'hi'
            ? 'सरल व्याख्या के लिए टेक्स्ट लिखें, कोई लेख खोलें, या पहले किसी खबर पर जवाब मुझसे लें।'
            : 'Add some news text, open an article, or ask me about a story first so I can explain it simply.'
        )
      );
      return;
    }

    setErrorText('');
    setListenError('');
    setIsWorking(true);

    if (cleanDraft) {
      appendMessage(createMessage('user', cleanDraft));
      setDraft('');
    } else {
      appendMessage(
        createMessage(
          'user',
          language === 'hi' ? 'इसे सरल भाषा में समझाइए।' : 'Explain this simply.'
        )
      );
    }

    void runAiAction(
      'explain',
      {
        text: cleanDraft ? cleanDraft : !currentArticleId ? sourceText : undefined,
        articleId: !cleanDraft && currentArticleId ? currentArticleId : undefined,
      },
      language === 'hi'
        ? 'यह खबर सरल रूप में समझाई गई है।'
        : 'Here is a simpler explanation of this news.'
    ).finally(() => {
      setIsWorking(false);
    });
  };

  const runTranslateAction = () => {
    if (isWorking) return;

    const greeting = getGreetingMessage(language);
    const cleanDraft = draft.trim();
    const canUseAssistantText = hasUsableAssistantSource(messages, greeting);
    const sourceText = cleanDraft || (!currentArticleId && canUseAssistantText ? latestAssistantText : '');

    if (!currentArticleId && !sourceText) {
      appendMessage(
        createMessage(
          'assistant',
          language === 'hi'
            ? 'अनुवाद के लिए टेक्स्ट लिखें, कोई लेख खोलें, या पहले किसी खबर पर जवाब मुझसे लें।'
            : 'Add some news text, open an article, or ask me about a story first so I can translate it.'
        )
      );
      return;
    }

    setErrorText('');
    setListenError('');
    setIsWorking(true);

    if (cleanDraft) {
      appendMessage(createMessage('user', cleanDraft));
      setDraft('');
    } else {
      appendMessage(
        createMessage(
          'user',
          language === 'hi' ? 'इसे हिंदी में अनुवाद कीजिए।' : 'Translate this into English.'
        )
      );
    }

    void runAiAction(
      'translate',
      {
        text: cleanDraft ? cleanDraft : !currentArticleId ? sourceText : undefined,
        articleId: !cleanDraft && currentArticleId ? currentArticleId : undefined,
      },
      language === 'hi' ? 'यह रहा हिंदी अनुवाद।' : 'Here is the English translation.'
    ).finally(() => {
      setIsWorking(false);
    });
  };

  const runTopHeadlines = () => {
    if (isWorking) return;

    const cleanDraft = draft.trim();
    if (cleanDraft) {
      setDraft('');
      void runAwarenessSearch(
        language === 'hi'
          ? `${cleanDraft} की आज की मुख्य खबरें बताइए।`
          : `Show me today's top ${cleanDraft} news`
      );
      return;
    }

    setErrorText('');
    setListenError('');
    setIsWorking(true);
    appendMessage(
      createMessage(
        'user',
        language === 'hi' ? 'आज की मुख्य खबरें बताइए।' : "Show me today's top news."
      )
    );

    void runAiAction(
      'top_news',
      {},
      language === 'hi' ? 'यह रही आज की मुख्य खबरें।' : "Here is today's top news."
    ).finally(() => {
      setIsWorking(false);
    });
  };

  const runTrendingTopics = () => {
    if (isWorking) return;

    const cleanDraft = draft.trim();
    if (cleanDraft) {
      setDraft('');
      void runAwarenessSearch(
        language === 'hi'
          ? `${cleanDraft} से जुड़े आज के ट्रेंडिंग विषय क्या हैं?`
          : `What are today's trending topics related to ${cleanDraft}?`
      );
      return;
    }

    setErrorText('');
    setListenError('');
    setIsWorking(true);
    appendMessage(
      createMessage(
        'user',
        language === 'hi' ? 'आज के ट्रेंडिंग विषय बताइए।' : "Show me today's trending topics."
      )
    );

    void runAiAction(
      'trending_topics',
      {},
      language === 'hi'
        ? 'यह रहे आज के ट्रेंडिंग विषय।'
        : "Here are today's trending topics."
    ).finally(() => {
      setIsWorking(false);
    });
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
    runExplainAction,
    runTranslateAction,
    runTopHeadlines,
    runTrendingTopics,
    runSuggestedQuery,
    retrySearch,
    handleListen,
    stopListening: () => stopListening(),
  };
}
