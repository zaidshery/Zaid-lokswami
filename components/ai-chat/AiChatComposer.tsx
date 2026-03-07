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
  onListen: () => void;
  onStop: () => void;
  isPreparingListen: boolean;
  isPlayingAudio: boolean;
  listenError: string;
  listenLanguageCode: string;
  setListenLanguageCode: (value: string) => void;
  listenLanguageOptions: Array<{ code: string; label: string; native?: string }>;
  isLight: boolean;
};

const TAB_PLACEHOLDERS: Record<AiChatActionTab, string> = {
  search: 'कोई भी खबर खोजें...',
  summary: 'टेक्स्ट या लिंक पेस्ट करें...',
  listen: 'सुनने के लिए टेक्स्ट लिखें...',
  headlines: 'कैटेगरी लिखें...',
};

export default function AiChatComposer({
  activeTab,
  draft,
  setDraft,
  isWorking,
  canSubmit,
  onSubmit,
  onListen,
  onStop,
  isPreparingListen,
  isPlayingAudio,
  listenError,
  listenLanguageCode,
  setListenLanguageCode,
  listenLanguageOptions,
  isLight,
}: AiChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { language, setLanguage } = useAppStore();

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = '44px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, [draft]);

  const shellClassName = isLight ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800';
  const selectClassName = isLight
    ? 'bg-zinc-100 border-zinc-300 text-zinc-700 hover:bg-zinc-200'
    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700';
  const textareaClassName = isLight
    ? 'bg-zinc-100 border-zinc-300 text-zinc-900 placeholder:text-zinc-500 focus:border-red-500/50'
    : 'bg-zinc-800 border-zinc-700/50 text-zinc-100 placeholder:text-zinc-500 focus:border-red-500/50';
  const idleSendClassName = isLight
    ? 'bg-zinc-100 text-zinc-600 cursor-not-allowed'
    : 'bg-zinc-800 text-zinc-600 cursor-not-allowed';
  const stopButtonClassName = isLight
    ? 'bg-zinc-100 border-zinc-300 text-zinc-600 hover:bg-zinc-200'
    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700';

  return (
    <div className={`flex-shrink-0 border-t px-4 py-4 ${shellClassName}`}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit || isWorking) return;
          onSubmit();
        }}
      >
        <div className="flex items-end gap-2">
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value as 'hi' | 'en')}
            aria-label="Select chat language"
            className={`w-14 cursor-pointer rounded-xl border px-2 py-2 text-xs font-bold transition ${selectClassName}`}
          >
            <option value="hi">हि</option>
            <option value="en">EN</option>
          </select>

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
            placeholder={TAB_PLACEHOLDERS[activeTab]}
            rows={1}
            className={`min-h-[44px] max-h-[120px] flex-1 resize-none overflow-hidden rounded-2xl border px-4 py-3 text-sm focus:outline-none ${textareaClassName}`}
          />

          <motion.button
            type="submit"
            disabled={!canSubmit || isWorking}
            aria-label="Send message"
            whileHover={canSubmit && !isWorking ? { scale: 1.05 } : undefined}
            whileTap={canSubmit && !isWorking ? { scale: 0.95 } : undefined}
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl transition-all duration-200 ${
              canSubmit && !isWorking
                ? 'bg-[linear-gradient(135deg,#e63946,#c1121f)] text-white shadow-md shadow-red-500/30'
                : idleSendClassName
            }`}
          >
            <Send size={16} />
          </motion.button>
        </div>
      </form>

      {activeTab === 'listen' ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={listenLanguageCode}
            onChange={(event) => setListenLanguageCode(event.target.value)}
            aria-label="Select listen language"
            className={`h-10 min-w-[110px] cursor-pointer rounded-xl border px-3 text-xs font-semibold transition ${selectClassName}`}
          >
            {listenLanguageOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.native || option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onListen}
            disabled={isPreparingListen}
            className="h-10 min-w-[110px] flex-1 rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-4 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            सुनें
          </button>

          <button
            type="button"
            onClick={onStop}
            disabled={!isPlayingAudio && !isPreparingListen}
            className={`h-10 min-w-[110px] flex-1 rounded-xl border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${stopButtonClassName}`}
          >
            रोकें
          </button>
        </div>
      ) : null}

      {activeTab === 'listen' && listenError ? (
        <p className="mt-2 text-xs text-red-500 dark:text-red-400">{listenError}</p>
      ) : null}
    </div>
  );
}
