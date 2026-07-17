'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { useRef, useState } from 'react';

type OperationsTab = {
  id: string;
  label: string;
  description: string;
  content: ReactNode;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function OperationsCenterTabs({ tabs }: { tabs: OperationsTab[] }) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || '');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const active = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  if (!active) return null;

  return (
    <div className="space-y-5">
      <div className="admin-shell-surface-strong sticky top-[76px] z-10 rounded-[18px] p-1.5 backdrop-blur-xl">
        <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4" role="tablist" aria-label="Operations views">
          {tabs.map((tab, index) => {
            const isActive = tab.id === active.id;
            return (
              <button
                key={tab.id}
                ref={(node) => { tabRefs.current[index] = node; }}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                  let nextIndex = index;
                  if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
                  else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
                  else if (event.key === 'Home') nextIndex = 0;
                  else if (event.key === 'End') nextIndex = tabs.length - 1;
                  else return;
                  event.preventDefault();
                  setActiveTab(tabs[nextIndex]?.id || active.id);
                  tabRefs.current[nextIndex]?.focus();
                }}
                role="tab"
                id={`operations-tab-${tab.id}`}
                aria-controls={`operations-panel-${tab.id}`}
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                className={cx(
                  'rounded-[14px] px-3 py-2.5 text-left transition-colors sm:px-4',
                  isActive
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-[color:var(--admin-shell-text-muted)] hover:bg-[color:var(--admin-shell-surface-muted)] hover:text-[color:var(--admin-shell-text)]'
                )}
              >
                <span className="block text-sm font-bold">{tab.label}</span>
                <span className={cx('mt-0.5 hidden text-xs leading-5 sm:block', isActive ? 'text-white/80' : '')}>
                  {tab.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" id={`operations-panel-${active.id}`} aria-labelledby={`operations-tab-${active.id}`} tabIndex={0}>{active.content}</div>
    </div>
  );
}
