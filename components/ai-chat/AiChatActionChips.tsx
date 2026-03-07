'use client';

import type { AiChatActionTab } from './types';

type AiChatActionChipsProps = {
  activeTab: AiChatActionTab;
  onTabChange: (tab: AiChatActionTab) => void;
  isLight: boolean;
};

const CHAT_TABS: Array<{ id: AiChatActionTab; label: string }> = [
  { id: 'search', label: '🔍 खोजें' },
  { id: 'summary', label: '⚡ सारांश' },
  { id: 'listen', label: '🎙️ सुनें' },
  { id: 'headlines', label: '📰 Headlines' },
];

export default function AiChatActionChips({
  activeTab,
  onTabChange,
  isLight,
}: AiChatActionChipsProps) {
  return (
    <div
      className={`flex-shrink-0 border-b ${
        isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800/60 bg-zinc-900'
      }`}
    >
      <div className="scrollbar-hide overflow-x-auto">
        <div className="flex gap-2 px-4 py-3">
          {CHAT_TABS.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`flex-shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-[linear-gradient(135deg,#e63946,#c1121f)] text-white shadow-sm shadow-red-500/30'
                    : isLight
                      ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
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
