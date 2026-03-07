'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { RefObject } from 'react';
import AiChatContentCards from './AiChatContentCards';
import type { AiCategorySuggestion, AiChatSuggestions, ChatMessage } from './types';

type AiChatMessagesProps = {
  language: 'hi' | 'en';
  messages: ChatMessage[];
  isWorking: boolean;
  errorText: string;
  messagesEndRef: RefObject<HTMLDivElement>;
  onSuggestionSelect: (value: string) => void;
  onQuickSearch: (value: string) => void;
  onRetrySearch: (value: string) => void;
  suggestions: AiChatSuggestions;
  isLoadingSuggestions: boolean;
  categorySuggestions: AiCategorySuggestion[];
  isLoadingCategorySuggestions: boolean;
  isLight: boolean;
};

const MESSAGE_ANIMATION = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22 },
};

const EMPTY_STATE_SUGGESTIONS = [
  '🗞️ आज की बड़ी खबरें',
  '🏏 IPL 2026 अपडेट',
  '🌤️ मौसम की जानकारी',
];

function getGreetingSeed(language: 'hi' | 'en') {
  return language === 'hi'
    ? 'नमस्ते, मैं लोकस्वामी AI हूं। आप खबर खोज सकते हैं, सारांश पा सकते हैं, या सुन सकते हैं।'
    : 'Hello, I am Lokswami AI. You can search news, get summaries, or listen here.';
}

function formatDuration(seconds?: number) {
  if (!seconds || seconds < 1) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `0:${secs
    .toString()
    .padStart(2, '0')}`;
}

function AssistantAvatar() {
  return (
    <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#e63946,#c1121f)] text-xs font-black text-white">
      लो
    </span>
  );
}

function TypingIndicator({ isLight }: { isLight: boolean }) {
  const bubbleClassName = isLight
    ? 'border border-zinc-200 bg-zinc-100 text-zinc-800'
    : 'border border-zinc-700/50 bg-zinc-800 text-zinc-200';

  return (
    <div className={`rounded-2xl rounded-tl-sm px-4 py-3 ${bubbleClassName}`}>
      <div className="flex items-center gap-1 py-1">
        {[0, 0.2, 0.4].map((delay) => (
          <motion.span
            key={delay}
            className="h-2 w-2 rounded-full bg-zinc-500"
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ repeat: Infinity, duration: 1, delay }}
          />
        ))}
      </div>
    </div>
  );
}

function ExploreMoreRow({ isLight }: { isLight: boolean }) {
  const pillClassName = isLight
    ? 'rounded-full bg-white border border-zinc-300 px-3 py-1 text-xs text-zinc-600 transition hover:border-red-500/40 hover:text-red-500'
    : 'rounded-full bg-zinc-800 border border-zinc-700 px-3 py-1 text-xs text-zinc-400 transition hover:border-red-500/40 hover:text-red-300';

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Link href="/main" className={pillClassName}>
        📰 और खबरें
      </Link>
      <Link href="/main/videos" className={pillClassName}>
        🎬 वीडियो
      </Link>
      <Link href="/main/epaper" className={pillClassName}>
        📄 E-Paper
      </Link>
    </div>
  );
}

function SuggestionsRail({
  suggestions,
  isLoading,
  isLight,
}: {
  suggestions: AiChatSuggestions;
  isLoading: boolean;
  isLight: boolean;
}) {
  const cards = [
    suggestions.latestEpaper,
    suggestions.trendingVideo,
    suggestions.topStory,
    suggestions.breakingArticle,
  ].filter((item): item is NonNullable<AiChatSuggestions[keyof AiChatSuggestions]> => item !== null);

  if (isLoading) {
    return (
      <div className="mt-6 w-full overflow-x-auto scrollbar-hide">
        <div className="flex gap-3 pb-1">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className={`h-24 w-[220px] flex-shrink-0 animate-pulse rounded-2xl border ${
                isLight ? 'border-zinc-200 bg-zinc-100' : 'border-zinc-800 bg-zinc-900'
              }`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!cards.length) {
    return null;
  }

  return (
    <div className="mt-6 w-full">
      <p
        className={`mb-3 text-left text-xs font-semibold uppercase tracking-wide ${
          isLight ? 'text-zinc-500' : 'text-zinc-400'
        }`}
      >
        आज का सुझाव
      </p>

      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-3 pb-1">
          {cards.map((card) => {
            const cardClassName =
              card.type === 'epaper'
                ? isLight
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-amber-500/30 bg-amber-500/10'
                : card.type === 'video'
                  ? isLight
                    ? 'border-sky-300 bg-sky-50'
                    : 'border-sky-500/30 bg-sky-500/10'
                  : card.type === 'story'
                    ? isLight
                      ? 'border-purple-300 bg-purple-50'
                      : 'border-purple-500/20 bg-purple-500/10'
                    : isLight
                      ? 'border-zinc-200 bg-white'
                      : 'border-zinc-800 bg-zinc-900';

            return (
              <Link
                key={`${card.type}-${card.title}`}
                href={card.url}
                className={`flex h-24 w-[220px] flex-shrink-0 gap-3 rounded-2xl border p-3 text-left transition hover:scale-[1.02] ${cardClassName}`}
              >
                {card.thumbnail ? (
                  <div
                    className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl ${
                      card.type === 'story' ? 'aspect-square' : ''
                    }`}
                  >
                    <Image
                      src={card.thumbnail}
                      alt={card.title}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />

                    {card.type === 'story' ? (
                      <>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="inline-flex rounded-full bg-red-500 p-2 text-white shadow-md shadow-red-500/30">
                            <span className="text-[10px] leading-none">▶</span>
                          </span>
                        </div>
                        {card.durationSeconds ? (
                          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            {formatDuration(card.durationSeconds)}
                          </span>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-2xl">
                    {card.type === 'epaper' ? '📄' : card.type === 'article' ? '📰' : '⚡'}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[11px] font-semibold ${
                      card.type === 'story' ? 'text-purple-400' : 'text-red-400'
                    }`}
                  >
                    {card.subtitle}
                  </p>
                  <p
                    className={`mt-1 line-clamp-2 text-sm font-semibold ${
                      isLight ? 'text-zinc-900' : 'text-zinc-100'
                    }`}
                  >
                    {card.title}
                  </p>
                  {card.date ? (
                    <p className="mt-2 text-[11px] text-zinc-500">{card.date.slice(0, 10)}</p>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CategorySuggestionSection({
  categorySuggestions,
  isLoading,
  onQuickSearch,
  isLight,
}: {
  categorySuggestions: AiCategorySuggestion[];
  isLoading: boolean;
  onQuickSearch: (value: string) => void;
  isLight: boolean;
}) {
  if (isLoading) {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={`h-8 w-24 animate-pulse rounded-full ${
              isLight ? 'bg-zinc-200' : 'bg-zinc-800'
            }`}
          />
        ))}
      </div>
    );
  }

  if (!categorySuggestions.length) {
    return null;
  }

  return (
    <div className="mt-3">
      <p className={`text-xs font-semibold ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
        शायद आप यह जानना चाहें 💡
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {categorySuggestions.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => onQuickSearch(item.query)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              isLight
                ? 'border-zinc-300 bg-white text-zinc-700 hover:border-red-500/40 hover:text-red-500'
                : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-red-500/40 hover:text-red-300'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ResponseActions({
  message,
  onRetrySearch,
  isLight,
}: {
  message: ChatMessage;
  onRetrySearch: (value: string) => void;
  isLight: boolean;
}) {
  if (!message.retryQuery && !message.primaryAction) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {message.retryQuery ? (
        <button
          type="button"
          onClick={() => onRetrySearch(message.retryQuery || '')}
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
            isLight
              ? 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200'
              : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
          }`}
        >
          फिर कोशिश करें ↻
        </button>
      ) : null}

      {message.primaryAction ? (
        <Link
          href={message.primaryAction.url}
          className="rounded-xl bg-[linear-gradient(135deg,#e63946,#c1121f)] px-3 py-2 text-xs font-semibold text-white shadow-md shadow-red-500/20"
        >
          {message.primaryAction.label}
        </Link>
      ) : null}
    </div>
  );
}

export default function AiChatMessages({
  language,
  messages,
  isWorking,
  errorText,
  messagesEndRef,
  onSuggestionSelect,
  onQuickSearch,
  onRetrySearch,
  suggestions,
  isLoadingSuggestions,
  categorySuggestions,
  isLoadingCategorySuggestions,
  isLight,
}: AiChatMessagesProps) {
  const greetingSeed = getGreetingSeed(language);
  const visibleMessages = messages.filter(
    (message) =>
      !(
        message.role === 'assistant' &&
        message.text === greetingSeed &&
        !message.links?.length
      )
  );

  const areaClassName = isLight ? 'bg-zinc-50' : 'bg-zinc-900';
  const aiBubbleClassName = isLight
    ? 'border border-zinc-200 bg-zinc-100 text-zinc-800'
    : 'border border-zinc-700/50 bg-zinc-800 text-zinc-200';
  const suggestionClassName = isLight
    ? 'border-zinc-300 bg-zinc-100 text-zinc-600 hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-500'
    : 'border-zinc-700 bg-zinc-800/80 text-zinc-300 hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-300';

  return (
    <div
      className={`flex-1 overflow-y-auto px-4 py-4 [scrollbar-color:#52525b_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700 ${areaClassName}`}
    >
      {visibleMessages.length === 0 && !isWorking ? (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <motion.div
            className="mb-4 text-6xl"
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          >
            🤖
          </motion.div>

          <h3 className={`mt-2 text-lg font-bold ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
            नमस्ते! मैं लोकस्वामी AI हूं 👋
          </h3>
          <p className={`mt-1 text-sm ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>
            खबर खोजें, सारांश पाएं, या सुनें
          </p>

          <SuggestionsRail
            suggestions={suggestions}
            isLoading={isLoadingSuggestions}
            isLight={isLight}
          />

          <div className="mt-6 w-full overflow-x-auto scrollbar-hide">
            <div className="flex w-max min-w-full flex-nowrap justify-center gap-2 pb-1">
              {EMPTY_STATE_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => onSuggestionSelect(suggestion)}
                  className={`flex-shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-xs transition-all ${suggestionClassName}`}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleMessages.map((message) => {
            const isUser = message.role === 'user';
            const shouldShowCategorySuggestions =
              !isUser &&
              (message.answerSource === 'refused' ||
                message.answerSource === 'error_fallback' ||
                message.answerSource === 'empty_database' ||
                (!message.content &&
                  message.answerSource !== undefined &&
                  message.answerSource !== 'cms_articles'));

            return (
              <motion.div
                key={message.id}
                initial={MESSAGE_ANIMATION.initial}
                animate={MESSAGE_ANIMATION.animate}
                transition={MESSAGE_ANIMATION.transition}
                className={isUser ? 'flex justify-end' : 'flex'}
              >
                {isUser ? (
                  <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-[linear-gradient(135deg,#e63946,#c1121f)] px-4 py-3 text-sm leading-relaxed text-white shadow-md shadow-red-500/20">
                    <p className="whitespace-pre-line break-words">{message.text}</p>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <AssistantAvatar />

                    <div className="flex-1 space-y-3">
                      <div
                        className={`max-w-[92%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed ${aiBubbleClassName}`}
                      >
                        <p className="whitespace-pre-line break-words">{message.text}</p>

                        {message.followUpSuggestion ? (
                          <p className="mt-3 text-xs font-medium text-zinc-500">
                            अगला सवाल: {message.followUpSuggestion}
                          </p>
                        ) : null}

                        {message.links?.length && !message.content ? (
                          <ul
                            className={`mt-3 space-y-2 border-t pt-3 ${
                              isLight ? 'border-zinc-200' : 'border-zinc-700/50'
                            }`}
                          >
                            {message.links.map((linkItem) => (
                              <li key={linkItem.id}>
                                <Link
                                  href={
                                    linkItem.url ||
                                    `/main/article/${encodeURIComponent(linkItem.id)}`
                                  }
                                  className="line-clamp-2 text-xs font-semibold underline underline-offset-2 text-red-500 hover:text-red-600"
                                >
                                  {linkItem.title}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : null}

                        <ResponseActions
                          message={message}
                          onRetrySearch={onRetrySearch}
                          isLight={isLight}
                        />

                        {shouldShowCategorySuggestions ? (
                          <CategorySuggestionSection
                            categorySuggestions={categorySuggestions}
                            isLoading={isLoadingCategorySuggestions}
                            onQuickSearch={onQuickSearch}
                            isLight={isLight}
                          />
                        ) : null}

                      </div>

                      {message.content ? (
                        <AiChatContentCards content={message.content} isLight={isLight} />
                      ) : null}

                      <ExploreMoreRow isLight={isLight} />
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}

          {isWorking ? (
            <motion.div
              initial={MESSAGE_ANIMATION.initial}
              animate={MESSAGE_ANIMATION.animate}
              transition={MESSAGE_ANIMATION.transition}
              className="flex"
            >
              <div className="flex items-start gap-3">
                <AssistantAvatar />
                <TypingIndicator isLight={isLight} />
              </div>
            </motion.div>
          ) : null}

          {errorText && visibleMessages.length === 0 ? (
            <p className="text-xs text-red-500 dark:text-red-400">
              {errorText || (language === 'hi' ? 'कुछ गलत हो गया।' : 'Something went wrong.')}
            </p>
          ) : null}
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
