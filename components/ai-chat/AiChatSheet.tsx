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
  const onCloseRef = useRef(onClose);
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
    onCloseRef.current = onClose;
  }, [onClose]);

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
        onCloseRef.current();
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
  }, [open]);

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
      : activeTab === 'headlines' || activeTab === 'trending'
        ? true
        : Boolean(chat.draft.trim() || chat.currentArticleId));

  const panelSurfaceClassName = isLight
    ? 'border-zinc-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,250,250,0.98))] shadow-[0_18px_48px_rgba(24,24,27,0.12)]'
    : 'border-zinc-800 bg-[linear-gradient(180deg,rgba(9,9,11,0.98),rgba(24,24,27,0.98))] shadow-[0_28px_80px_rgba(0,0,0,0.58)]';

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

      if (
        tab === 'trending' &&
        activeTab === 'trending' &&
        !chat.draft.trim() &&
        !chat.isWorking
      ) {
        chat.runTrendingTopics();
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

    if (activeTab === 'explain') {
      chat.runExplainAction();
      return;
    }

    if (activeTab === 'translate') {
      chat.runTranslateAction();
      return;
    }

    if (activeTab === 'headlines') {
      chat.runTopHeadlines();
      return;
    }

    if (activeTab === 'trending') {
      chat.runTrendingTopics();
      return;
    }

    chat.sendMessage();
  }, [activeTab, chat]);

  const panelClassName =
    viewportMode === 'mobile'
      ? `pointer-events-auto fixed inset-x-2 top-[max(0.5rem,env(safe-area-inset-top))] bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+0.65rem)] z-[61] flex flex-col overflow-hidden rounded-[1.55rem] border backdrop-blur ${panelSurfaceClassName}`
      : viewportMode === 'tablet'
        ? `pointer-events-auto fixed bottom-24 right-4 z-[61] flex h-[min(76vh,43rem)] max-h-[calc(100vh-7rem)] w-[min(400px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[1.8rem] border backdrop-blur ${panelSurfaceClassName}`
        : `pointer-events-auto fixed bottom-8 right-6 z-[61] flex h-[min(620px,calc(100vh-4rem))] max-h-[calc(100vh-4rem)] w-[min(455px,calc(100vw-3rem))] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-[1.9rem] border backdrop-blur ${panelSurfaceClassName}`;

  const panelAnimation =
    viewportMode === 'mobile'
      ? {
          initial: { y: 32, opacity: 0 },
          animate: { y: 0, opacity: 1 },
          exit: { y: 22, opacity: 0 },
          transition: { duration: 0.26, ease: 'easeOut' },
        }
      : {
          initial: { opacity: 0, scale: 0.92, x: 0, y: 24 },
          animate: { opacity: 1, scale: 1, x: 0, y: 0 },
          exit: { opacity: 0, scale: 0.94, x: 0, y: 16 },
          transition: { duration: 0.28, ease: 'easeOut' },
        };

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      <motion.button
        type="button"
        aria-label="Close AI chat backdrop"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`pointer-events-auto fixed inset-0 ${
          isLight
            ? 'bg-[radial-gradient(circle_at_80%_80%,rgba(239,68,68,0.05),rgba(17,24,39,0.08))]'
            : 'bg-[radial-gradient(circle_at_80%_80%,rgba(239,68,68,0.08),rgba(2,6,23,0.44))]'
        }`}
      />

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
        <span className="pointer-events-none absolute inset-x-0 top-0 z-0 h-px bg-gradient-to-r from-transparent via-red-500/70 to-transparent" />
        <span className="pointer-events-none absolute -left-16 top-16 z-0 h-24 w-24 rounded-full bg-red-500/12 blur-2xl" />
        <span className="pointer-events-none absolute -right-20 bottom-24 z-0 h-32 w-32 rounded-full bg-zinc-500/10 blur-3xl" />

        <div className="flex h-full flex-col">
          <AiChatHeader
            viewportMode={viewportMode}
            language={chat.language}
            isLight={isLight}
            onMinimize={onClose}
            onClose={onClose}
          />

          <AiChatActionChips
            activeTab={activeTab}
            language={chat.language}
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
            isLight={isLight}
          />
        </div>
      </motion.div>
    </div>
  );
}
