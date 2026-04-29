'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';

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
  const active = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  if (!active) return null;

  return (
    <div className="space-y-5">
      <div className="admin-shell-surface-strong rounded-[24px] p-2">
        <div className="grid gap-2 md:grid-cols-4">
          {tabs.map((tab) => {
            const isActive = tab.id === active.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-pressed={isActive}
                className={cx(
                  'rounded-[18px] px-4 py-3 text-left transition-colors',
                  isActive
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-[color:var(--admin-shell-text-muted)] hover:bg-[color:var(--admin-shell-surface-muted)] hover:text-[color:var(--admin-shell-text)]'
                )}
              >
                <span className="block text-sm font-bold">{tab.label}</span>
                <span className={cx('mt-1 block text-xs leading-5', isActive ? 'text-white/80' : '')}>
                  {tab.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>{active.content}</div>
    </div>
  );
}
