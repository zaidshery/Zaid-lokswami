'use client';

import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import AiChatSheet from './AiChatSheet';
import { useAiChat } from './useAiChat';
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
  const chat = useAiChat({ isOpen: sheetOpen });
  const { theme } = useAppStore();
  const isLight = theme === 'light';

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

  return (
    <ChatPortal>
      <motion.button
        type="button"
        onClick={handleToggle}
        aria-label={sheetOpen ? 'Close Lokswami AI chat' : 'Open Lokswami AI chat'}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`fixed right-4 z-50 inline-flex items-center justify-center overflow-hidden rounded-2xl transition-transform md:bottom-24 md:right-4 xl:bottom-8 xl:right-6 ${
          sheetOpen
            ? 'bottom-[88px] h-14 w-14 bg-zinc-700 text-white shadow-lg shadow-black/30 md:h-12 md:w-12'
            : 'bottom-[88px] h-14 w-14 bg-[linear-gradient(135deg,#e63946,#c1121f)] text-white shadow-lg shadow-red-500/40 md:h-12 md:w-12 xl:w-auto xl:px-5'
        } ${isLight && sheetOpen ? 'border border-zinc-300' : ''}`}
      >
        {!sheetOpen ? (
          <span className="pointer-events-none absolute inset-0 animate-ping rounded-2xl bg-red-500/30" />
        ) : null}

        <span className="pointer-events-none absolute inset-[1px] rounded-[15px] bg-white/5" />

        <span className="relative flex items-center justify-center">
          {sheetOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <>
              <span className="flex items-center justify-center xl:hidden">
                <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl">
                  <Image
                    src="/logo-icon-final.png"
                    alt="Lokswami AI"
                    fill
                    sizes="32px"
                    className="object-cover"
                  />
                </span>
              </span>

              <span className="hidden items-center gap-2 xl:inline-flex">
                <Sparkles className="h-4 w-4" />
                <span className="font-bold text-white">लो AI</span>
              </span>
            </>
          )}
        </span>
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
