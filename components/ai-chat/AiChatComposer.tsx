'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send } from 'lucide-react';
import { useAppStore } from '@/lib/store/appStore';
import type { AiChatActionTab } from './types';

type AiChatComposerProps = {
  activeTab: AiChatActionTab;
  draft: string;
  setDraft: (value: string) => void;
  isWorking: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  isLight: boolean;
};

const TAB_PLACEHOLDERS: Record<AiChatActionTab, string> = {
  search:
    '\u0938\u092e\u093e\u091a\u093e\u0930, \u091c\u093f\u0932\u0947, \u0935\u093f\u0937\u092f \u092f\u093e \u0935\u094d\u092f\u0915\u094d\u0924\u093f \u0915\u0947 \u092c\u093e\u0930\u0947 \u092e\u0947\u0902 \u092a\u0942\u091b\u0947\u0902...',
  summary:
    '\u0932\u0947\u0916 \u0915\u093e \u091f\u0947\u0915\u094d\u0938\u094d\u091f \u092f\u093e \u0932\u093f\u0902\u0915 \u092a\u0947\u0938\u094d\u091f \u0915\u0930\u0947\u0902...',
  explain:
    '\u0916\u092c\u0930 \u0915\u093e \u091f\u0947\u0915\u094d\u0938\u094d\u091f \u092a\u0947\u0938\u094d\u091f \u0915\u0930\u0947\u0902 \u092f\u093e \u0915\u094b\u0908 \u0932\u0947\u0916 \u0916\u094b\u0932\u0947\u0902...',
  translate:
    '\u091c\u093f\u0938 \u0916\u092c\u0930 \u0915\u093e \u0905\u0928\u0941\u0935\u093e\u0926 \u091a\u093e\u0939\u093f\u090f \u0935\u0939 \u091f\u0947\u0915\u094d\u0938\u094d\u091f \u092a\u0947\u0938\u094d\u091f \u0915\u0930\u0947\u0902...',
  headlines:
    '\u091a\u093e\u0939\u0947\u0902 \u0924\u094b \u0936\u094d\u0930\u0947\u0923\u0940 \u0932\u093f\u0916\u0947\u0902, \u0935\u093er\u0928\u093e \u0938\u093f\u0927\u0947 \u0906\u091c \u0915\u0940 \u092e\u0941\u0916\u094d\u092f \u0916\u092c\u0930\u0947\u0902 \u092e\u093e\u0902\u0917\u0947\u0902...',
  trending:
    '\u091a\u093e\u0939\u0947\u0902 \u0924\u094b \u0935\u093f\u0937\u092f \u0932\u093f\u0916\u0947\u0902, \u0935\u093er\u0928\u093e \u0906\u091c \u0915\u0947 \u091f\u094d\u0930\u0947\u0902\u0921\u093f\u0902\u0917 \u0935\u093f\u0937\u092f \u092a\u0942\u091b\u0947\u0902...',
};

const TAB_PLACEHOLDERS_EN: Record<AiChatActionTab, string> = {
  search: 'Ask about headlines, districts, topics, or people...',
  summary: 'Paste article text or a URL...',
  explain: 'Paste news text or open an article to simplify it...',
  translate: 'Paste news text to translate it into the selected language...',
  headlines: 'Type a category or just ask for today\'s top news...',
  trending: 'Type a topic or just ask for today\'s trending topics...',
};

export default function AiChatComposer({
  activeTab,
  draft,
  setDraft,
  isWorking,
  canSubmit,
  onSubmit,
  isLight,
}: AiChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { language } = useAppStore();
  const isHindi = language === 'hi';

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = '44px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, [draft]);

  const shellClassName = isLight
    ? 'border-zinc-200 bg-white'
    : 'border-zinc-800 bg-zinc-950';
  const textareaClassName = isLight
    ? 'border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-500 focus:border-red-500/70'
    : 'border-zinc-700/80 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-500 focus:border-red-500/70';

  const translationHint =
    activeTab === 'translate'
      ? isHindi
        ? '\u0905\u0928\u0941\u0935\u093e\u0926 \u091a\u092f\u0928\u093f\u0924 \u092d\u093e\u0937\u093e \u092e\u0947\u0902 \u0939\u094b\u0917\u093e\u0964'
        : 'Translation will be returned in the selected language.'
      : '';

  return (
    <div className={`relative z-10 flex-shrink-0 border-t px-4 py-4 ${shellClassName}`}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit || isWorking) return;
          onSubmit();
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (!canSubmit || isWorking) return;
                onSubmit();
              }
            }}
            placeholder={isHindi ? TAB_PLACEHOLDERS[activeTab] : TAB_PLACEHOLDERS_EN[activeTab]}
            rows={1}
            className={`min-h-[44px] max-h-[120px] flex-1 resize-none overflow-hidden rounded-2xl border px-4 py-3 text-sm focus:outline-none ${textareaClassName}`}
          />

          <motion.button
            type="submit"
            disabled={!canSubmit || isWorking}
            aria-label="Send message"
            whileHover={canSubmit && !isWorking ? { scale: 1.05 } : undefined}
            whileTap={canSubmit && !isWorking ? { scale: 0.95 } : undefined}
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border transition-all duration-200 ${
              canSubmit && !isWorking
                ? 'border-red-700 bg-red-700 text-white shadow-[0_10px_20px_rgba(127,29,29,0.28)]'
                : isLight
                  ? 'border-zinc-300 bg-zinc-100 text-zinc-500'
                  : 'border-zinc-700/70 bg-zinc-900 text-zinc-600'
            }`}
          >
            <Send size={16} />
          </motion.button>
        </div>
      </form>

      {translationHint ? (
        <p className={`mt-2 text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
          {translationHint}
        </p>
      ) : null}
    </div>
  );
}
