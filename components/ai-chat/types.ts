import type { RefObject } from 'react';

export type ChatRole = 'assistant' | 'user';
export type AiContentType = 'article' | 'epaper' | 'video' | 'story';
export type AiChatActionTab = 'search' | 'summary' | 'listen' | 'headlines';
export type AiAnswerSource =
  | 'cms_articles'
  | 'general_knowledge'
  | 'related_category'
  | 'category_redirect'
  | 'refused'
  | 'empty_database'
  | 'error_fallback';

export type AiContentItem = {
  id: string;
  type: AiContentType;
  title: string;
  description: string;
  category: string;
  thumbnail: string;
  url: string;
  date: string;
  similarityScore?: number;
  durationSeconds?: number;
  tags?: string[];
};

export type AiContentGroups = {
  articles: AiContentItem[];
  epapers: AiContentItem[];
  videos: AiContentItem[];
  stories: AiContentItem[];
};

export type AiSuggestionCard = {
  type: 'epaper' | 'video' | 'story' | 'article';
  title: string;
  subtitle: string;
  url: string;
  thumbnail?: string;
  date?: string;
  durationSeconds?: number;
};

export type AiChatSuggestions = {
  latestEpaper: AiSuggestionCard | null;
  trendingVideo: AiSuggestionCard | null;
  topStory: AiSuggestionCard | null;
  breakingArticle: AiSuggestionCard | null;
};

export type AiCategorySuggestion = {
  name: string;
  hindi: string;
  count: number;
  label: string;
  query: string;
};

export type AiPrimaryAction = {
  label: string;
  url: string;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  links?: Array<{ id: string; title: string; type?: AiContentType; url?: string }>;
  content?: AiContentGroups;
  followUpSuggestion?: string;
  answerSource?: AiAnswerSource;
  retryQuery?: string;
  primaryAction?: AiPrimaryAction | null;
};

export type UseAiChatOptions = {
  isOpen: boolean;
};

export type UseAiChatResult = {
  language: 'hi' | 'en';
  draft: string;
  setDraft: (value: string) => void;
  messages: ChatMessage[];
  isWorking: boolean;
  errorText: string;
  searchRouteHref: string;
  currentArticleId: string;
  listenLanguageCode: string;
  setListenLanguageCode: (value: string) => void;
  listenLanguageOptions: Array<{ code: string; label: string; native?: string }>;
  isPreparingListen: boolean;
  isPlayingAudio: boolean;
  listenError: string;
  messagesEndRef: RefObject<HTMLDivElement>;
  suggestions: AiChatSuggestions;
  isLoadingSuggestions: boolean;
  categorySuggestions: AiCategorySuggestion[];
  isLoadingCategorySuggestions: boolean;
  sendMessage: () => void;
  runDraftSearch: () => void;
  runSummaryAction: () => void;
  runTopHeadlines: () => void;
  runSuggestedQuery: (query: string) => void;
  retrySearch: (query: string) => void;
  handleListen: () => Promise<void>;
  stopListening: () => void;
};
