'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Send, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import AiChatBrandMark from './AiChatBrandMark';
import AiChatSheet from './AiChatSheet';
import { useAiChat } from './useAiChat';
import { usePopupState } from '@/lib/popups/usePopupState';
import { useAppStore } from '@/lib/store/appStore';

type ChatPortalProps = {
  children: ReactNode;
};

function ChatPortal({ children }: ChatPortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(children, document.body);
}

export default function AiChatLauncher() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [previewDismissed, setPreviewDismissed] = useState(false);
  const chat = useAiChat({ isOpen: sheetOpen });
  const popupState = usePopupState();
  const { theme, language } = useAppStore();
  const isLight = theme === 'light';
  const isHindi = language === 'hi';
  const previewBlocked = Boolean(popupState.activeSurface);

  const content = useMemo(
    () => ({
      title: 'Lokswami AI Desk',
      subtitle: isHindi
        ? '\u0938\u092e\u093e\u091a\u093e\u0930 \u0938\u0939\u093e\u092f\u0924\u093e \u0914\u0930 \u0932\u093e\u0907\u0935 \u0905\u092a\u0921\u0947\u091f'
        : 'News guidance and live updates',
      intro: isHindi
        ? '\u0906\u091c \u0915\u0940 \u0938\u0941\u0930\u094d\u0916\u093f\u092f\u093e\u0901, \u0906\u092a\u0915\u0947 \u0936\u0939\u0930 \u0915\u0940 \u0916\u092c\u0930\u0947\u0902, \u0908-\u092a\u0947\u092a\u0930 \u0914\u0930 \u0924\u094d\u0935\u0930\u093f\u0924 \u0938\u093e\u0930\u093e\u0902\u0936 \u092a\u0942\u091b\u0947\u0902\u0964'
        : 'Ask for top stories, local coverage, e-paper access, or quick summaries.',
      inputHint: isHindi
        ? '\u0938\u092e\u093e\u091a\u093e\u0930 \u0938\u0947 \u091c\u0941\u095c\u093e \u092a\u094d\u0930\u0936\u094d\u0928 \u0932\u093f\u0916\u0947\u0902...'
        : 'Ask a news question...',
    }),
    [isHindi]
  );

  const handleToggle = () => {
    if (sheetOpen) {
      chat.stopListening();
      setSheetOpen(false);
      return;
    }

    setSheetOpen(true);
  };

  const handleClose = () => {
    chat.stopListening();
    setSheetOpen(false);
  };

  const handleOpenWithDraft = (value?: string) => {
    if (value) {
      chat.setDraft(value);
    }
    setSheetOpen(true);
  };

  const floatingButtonClassName = sheetOpen
    ? `${isLight ? 'border border-zinc-200 bg-white text-zinc-900' : 'border border-zinc-700 bg-zinc-900 text-zinc-100'} h-14 w-14 rounded-2xl xl:h-12 xl:w-12 xl:px-0`
    : 'h-14 w-14 rounded-2xl bg-[linear-gradient(135deg,#dc2626,#991b1b)] text-white shadow-[0_14px_30px_rgba(127,29,29,0.28)] xl:h-12 xl:w-auto xl:px-5';

  const previewSurfaceClassName = isLight
    ? 'border-zinc-200 bg-[linear-gradient(165deg,rgba(255,255,255,0.97),rgba(255,248,248,0.95))] text-zinc-900 shadow-[0_18px_48px_rgba(24,24,27,0.12)]'
    : 'border-zinc-800 bg-[linear-gradient(165deg,rgba(9,9,11,0.95),rgba(24,24,27,0.97))] text-zinc-100 shadow-[0_22px_56px_rgba(0,0,0,0.55)]';

  return (
    <ChatPortal>
      <AnimatePresence>
        {!sheetOpen && !previewDismissed && !previewBlocked ? (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.26, ease: 'easeOut' }}
            className={`fixed bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+4.3rem)] right-2 z-50 w-[calc(100vw-1rem)] max-w-[23.5rem] overflow-hidden rounded-[1.4rem] border backdrop-blur xl:bottom-[7.2rem] xl:right-6 xl:max-w-[27rem] ${previewSurfaceClassName}`}
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-red-500/70 to-transparent" />
            <span className="pointer-events-none absolute -left-16 bottom-6 h-24 w-24 rounded-full bg-red-500/12 blur-2xl" />
            <span className="pointer-events-none absolute -right-16 top-8 h-24 w-24 rounded-full bg-zinc-500/10 blur-2xl" />

            <div className="relative px-4 pb-4 pt-3">
              <button
                type="button"
                onClick={() => setPreviewDismissed(true)}
                aria-label={
                  isHindi
                    ? 'AI \u092a\u094d\u0930\u0940\u0935\u094d\u092f\u0942 \u092c\u0902\u0926 \u0915\u0930\u0947\u0902'
                    : 'Close AI preview'
                }
                className={`absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
                  isLight
                    ? 'border-zinc-300 bg-white text-zinc-600 hover:border-red-300 hover:text-red-700'
                    : 'border-zinc-700 bg-zinc-950/90 text-zinc-300 hover:border-red-500/45 hover:text-red-200'
                }`}
              >
                <X className="h-4 w-4" />
              </button>

              <div className="mb-3 flex items-center gap-3">
                <AiChatBrandMark
                  compact
                  pulse
                  className="h-11 w-11 md:h-12 md:w-12"
                  imageScale={1.45}
                  imagePosition="50% 40%"
                />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">{content.title}</p>
                  <p className={isLight ? 'text-[11px] text-zinc-600' : 'text-[11px] text-zinc-400'}>
                    {content.subtitle}
                  </p>
                </div>
              </div>

              <p className={`text-sm font-semibold ${isLight ? 'text-zinc-800' : 'text-zinc-100'}`}>
                {content.intro}
              </p>

              <button
                type="button"
                onClick={() => handleOpenWithDraft()}
                className={`mt-3 flex w-full items-center justify-between rounded-full border px-4 py-2.5 text-left text-sm transition ${
                  isLight
                    ? 'border-zinc-300 bg-white text-zinc-500 hover:border-red-400'
                    : 'border-zinc-700 bg-zinc-950/90 text-zinc-400 hover:border-red-500/45'
                }`}
              >
                <span className="truncate">{content.inputHint}</span>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-700 text-white shadow-[0_8px_18px_rgba(127,29,29,0.24)]">
                  <Send className="h-3.5 w-3.5" />
                </span>
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={handleToggle}
        aria-label={sheetOpen ? 'Close Lokswami AI Assistant' : 'Open Lokswami AI Assistant'}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`fixed bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+0.9rem)] right-4 z-[51] inline-flex items-center justify-center gap-2 overflow-hidden transition-transform xl:bottom-8 xl:right-6 ${floatingButtonClassName}`}
      >
        {sheetOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <>
            <AiChatBrandMark
              compact
              plain
              className="h-10 w-10 md:h-10 md:w-10 xl:h-9 xl:w-9"
              imageScale={1.55}
              imagePosition="50% 40%"
            />
            <span className="hidden whitespace-nowrap text-sm font-semibold tracking-wide text-white xl:inline">
              AI Desk
            </span>
          </>
        )}
      </motion.button>

      <AnimatePresence>
        {sheetOpen ? (
          <AiChatSheet
            open={sheetOpen}
            onClose={handleClose}
            chat={chat}
            theme={theme}
          />
        ) : null}
      </AnimatePresence>
    </ChatPortal>
  );
}
