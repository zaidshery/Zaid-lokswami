'use client';

import { ArrowLeft, ChevronDown, X } from 'lucide-react';

type ViewportMode = 'mobile' | 'tablet' | 'desktop';

type AiChatHeaderProps = {
  viewportMode: ViewportMode;
  isLight: boolean;
  onMinimize: () => void;
  onClose: () => void;
};

export default function AiChatHeader({
  viewportMode,
  isLight,
  onMinimize,
  onClose,
}: AiChatHeaderProps) {
  const isMobile = viewportMode === 'mobile';
  const headerClassName = `${
    isLight ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
  } flex h-16 flex-shrink-0 items-center justify-between border-b px-4 ${
    isMobile ? '' : 'rounded-t-3xl'
  }`;
  const iconButtonClassName = `${
    isLight
      ? 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
  } inline-flex h-8 w-8 items-center justify-center rounded-xl transition`;
  const closeButtonClassName = `${
    isLight
      ? 'bg-zinc-100 text-zinc-500 hover:bg-red-500/10 hover:text-red-500'
      : 'bg-zinc-800 text-zinc-400 hover:bg-red-500/20 hover:text-red-400'
  } inline-flex h-8 w-8 items-center justify-center rounded-xl transition`;

  return (
    <header className={headerClassName}>
      <div className="flex min-w-0 items-center gap-3">
        {isMobile ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to page"
            className={closeButtonClassName}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : null}

        <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#e63946,#c1121f)] text-xs font-black text-white shadow-md shadow-red-500/30">
          लो
        </span>

        <div className="min-w-0">
          <p className={`truncate text-sm font-bold ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
            लोकस्वामी AI
          </p>

          <div className="mt-1 flex items-center gap-1.5">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-xs text-emerald-400">Online</span>
          </div>
        </div>
      </div>

      {!isMobile ? (
        <div className="flex items-center gap-2 pr-0">
          <button
            type="button"
            onClick={onMinimize}
            aria-label="Minimize AI chat"
            className={iconButtonClassName}
          >
            <ChevronDown className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI chat"
            className={closeButtonClassName}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </header>
  );
}
