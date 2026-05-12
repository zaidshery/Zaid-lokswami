'use client';

import type { AiChatActionTab } from './types';

type AiChatActionChipsProps = {
  activeTab: AiChatActionTab;
  language: 'hi' | 'en';
  onTabChange: (tab: AiChatActionTab) => void;
  isLight: boolean;
};

const CHAT_TABS: Record<'hi' | 'en', Array<{ id: AiChatActionTab; label: string }>> = {
  hi: [
    { id: 'search', label: '\u0916\u094b\u091c' },
    { id: 'summary', label: '\u0938\u093e\u0930\u093e\u0902\u0936' },
    { id: 'explain', label: '\u0938\u093er\u0932 \u0938\u092e\u091d\u093e\u090f\u0902' },
    { id: 'translate', label: '\u0905\u0928\u0941\u0935\u093e\u0926' },
    { id: 'headlines', label: '\u092e\u0941\u0916\u094d\u092f \u0916\u092c\u0930\u0947\u0902' },
    { id: 'trending', label: '\u091f\u094d\u0930\u0947\u0902\u0921\u093f\u0902\u0917' },
  ],
  en: [
    { id: 'search', label: 'Search' },
    { id: 'summary', label: 'Summary' },
    { id: 'explain', label: 'Explain' },
    { id: 'translate', label: 'Translate' },
    { id: 'headlines', label: 'Headlines' },
    { id: 'trending', label: 'Trending' },
  ],
};

export default function AiChatActionChips({
  activeTab,
  language,
  onTabChange,
  isLight,
}: AiChatActionChipsProps) {
  const tabs = CHAT_TABS[language] || CHAT_TABS.en;

  return (
    <div
      className={`relative z-10 flex-shrink-0 border-b ${
        isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-950'
      }`}
    >
      <div className="scrollbar-hide overflow-x-auto">
        <div className="flex gap-2 px-4 py-3">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`flex-shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? 'border-red-700 bg-red-700 text-white shadow-[0_10px_20px_rgba(127,29,29,0.24)]'
                    : isLight
                      ? 'border-zinc-300 bg-white text-zinc-700 hover:border-red-300 hover:text-red-700'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-red-500/40 hover:text-zinc-100'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
