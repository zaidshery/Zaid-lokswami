'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import AiChatActionChips from './AiChatActionChips';
import AiChatComposer from './AiChatComposer';
import AiChatHeader from './AiChatHeader';
import AiChatMessages from './AiChatMessages';
import type { AiChatActionTab, UseAiChatResult } from './types';

type AiChatSheetProps = {
  open: boolean;
  onClose: () => void;
  chat: UseAiChatResult;
  theme: 'dark' | 'light';
};

type ViewportMode = 'mobile' | 'tablet' | 'desktop';

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute('disabled'));
}

function resolveViewportMode(width: number): ViewportMode {
  if (width < 768) return 'mobile';
  if (width < 1280) return 'tablet';
  return 'desktop';
}

export default function AiChatSheet({
  open,
  onClose,
  chat,
  theme,
}: AiChatSheetProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [viewportMode, setViewportMode] = useState<ViewportMode>(() => {
    if (typeof window === 'undefined') {
      return 'desktop';
    }

    return resolveViewportMode(window.innerWidth);
  });
  const [activeTab, setActiveTab] = useState<AiChatActionTab>(
    chat.currentArticleId ? 'summary' : 'search'
  );

  const isLight = theme === 'light';

  useEffect(() => {
    const syncViewport = () => {
      setViewportMode(resolveViewportMode(window.innerWidth));
    };

    syncViewport();
    window.addEventListener('resize', syncViewport);

    return () => {
      window.removeEventListener('resize', syncViewport);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousActive = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (!panel) return;

    const focusableElements = getFocusableElements(panel);
    (focusableElements[0] || panel).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const items = getFocusableElements(panel);
      if (!items.length) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousActive?.focus();
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open || viewportMode !== 'mobile') return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, viewportMode]);

  const canSubmit =
    !chat.isWorking &&
    (activeTab === 'summary'
      ? Boolean(chat.draft.trim() || chat.currentArticleId)
      : Boolean(chat.draft.trim()));

  const handleSuggestionSelect = useCallback(
    (value: string) => {
      setActiveTab('search');
      chat.setDraft(value);
    },
    [chat]
  );

  const handleTabChange = useCallback(
    (tab: AiChatActionTab) => {
      if (
        tab === 'headlines' &&
        activeTab === 'headlines' &&
        !chat.draft.trim() &&
        !chat.isWorking
      ) {
        chat.runTopHeadlines();
        return;
      }

      setActiveTab(tab);
    },
    [activeTab, chat]
  );

  const handleSubmit = useCallback(() => {
    if (chat.isWorking) return;

    if (activeTab === 'summary') {
      chat.runSummaryAction();
      return;
    }

    if (activeTab === 'listen') {
      void chat.handleListen();
      return;
    }

    chat.sendMessage();
  }, [activeTab, chat]);

  const panelClassName =
    viewportMode === 'mobile'
      ? `${isLight ? 'bg-white' : 'bg-zinc-950'} pointer-events-auto fixed inset-0 z-50 flex flex-col pb-16`
      : viewportMode === 'tablet'
        ? `${isLight ? 'bg-white border-zinc-200 shadow-black/10' : 'bg-zinc-900 border-zinc-700/50 shadow-black/50'} pointer-events-auto fixed bottom-24 right-4 z-50 flex h-[min(75vh,42rem)] max-h-[calc(100vh-7rem)] w-[min(380px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border shadow-2xl`
        : `${isLight ? 'bg-white border-zinc-200 shadow-black/10' : 'bg-zinc-900 border-zinc-700/50 shadow-black/60'} pointer-events-auto fixed bottom-8 right-6 z-50 flex h-[min(600px,calc(100vh-4rem))] max-h-[calc(100vh-4rem)] w-[min(440px,calc(100vw-3rem))] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-3xl border shadow-2xl`;

  const panelAnimation =
    viewportMode === 'mobile'
      ? {
          initial: { x: '100%', opacity: 0 },
          animate: { x: 0, opacity: 1 },
          exit: { x: '100%', opacity: 0 },
          transition: { type: 'spring', damping: 28, stiffness: 280 },
        }
      : {
          initial: { opacity: 0, scale: 0.92, x: 0, y: 24 },
          animate: { opacity: 1, scale: 1, x: 0, y: 0 },
          exit: { opacity: 0, scale: 0.94, x: 0, y: 16 },
          transition: { duration: 0.28, ease: 'easeOut' },
        };

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {viewportMode !== 'mobile' ? (
        <motion.button
          type="button"
          aria-label="Close AI chat backdrop"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`pointer-events-auto fixed inset-0 ${isLight ? 'bg-black/10' : 'bg-black/30'}`}
        />
      ) : null}

      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Lokswami AI chat"
        tabIndex={-1}
        initial={panelAnimation.initial}
        animate={panelAnimation.animate}
        exit={panelAnimation.exit}
        transition={panelAnimation.transition}
        className={panelClassName}
      >
        <div className="flex h-full flex-col">
          <AiChatHeader
            viewportMode={viewportMode}
            isLight={isLight}
            onMinimize={onClose}
            onClose={onClose}
          />

          <AiChatActionChips
            activeTab={activeTab}
            onTabChange={handleTabChange}
            isLight={isLight}
          />

          <AiChatMessages
            language={chat.language}
            messages={chat.messages}
            isWorking={chat.isWorking}
            errorText={chat.errorText}
            messagesEndRef={chat.messagesEndRef}
            onSuggestionSelect={handleSuggestionSelect}
            onQuickSearch={chat.runSuggestedQuery}
            onRetrySearch={chat.retrySearch}
            suggestions={chat.suggestions}
            isLoadingSuggestions={chat.isLoadingSuggestions}
            categorySuggestions={chat.categorySuggestions}
            isLoadingCategorySuggestions={chat.isLoadingCategorySuggestions}
            isLight={isLight}
          />

          <AiChatComposer
            activeTab={activeTab}
            draft={chat.draft}
            setDraft={chat.setDraft}
            isWorking={chat.isWorking}
            canSubmit={canSubmit}
            onSubmit={handleSubmit}
            onListen={() => {
              void chat.handleListen();
            }}
            onStop={chat.stopListening}
            isPreparingListen={chat.isPreparingListen}
            isPlayingAudio={chat.isPlayingAudio}
            listenError={chat.listenError}
            listenLanguageCode={chat.listenLanguageCode}
            setListenLanguageCode={chat.setListenLanguageCode}
            listenLanguageOptions={chat.listenLanguageOptions}
            isLight={isLight}
          />
        </div>
      </motion.div>
    </div>
  );
}
