'use client';

import { RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';

type ArticleDraftRecoveryNoticeProps = {
  savedAtLabel?: string;
  onRestore: () => void;
  onDiscard: () => void;
};

export default function ArticleDraftRecoveryNotice({
  savedAtLabel = '',
  onRestore,
  onDiscard,
}: ArticleDraftRecoveryNoticeProps) {
  return (
    <section
      aria-labelledby="article-draft-recovery-title"
      className="rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm dark:border-amber-400/30 dark:bg-amber-400/10"
    >
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-white p-2 text-amber-700 shadow-sm dark:bg-zinc-950 dark:text-amber-300">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="article-draft-recovery-title" className="text-sm font-bold text-amber-950 dark:text-amber-100">
            Browser recovery copy available
          </h2>
          <p className="mt-1 text-xs leading-5 text-amber-900/80 dark:text-amber-100/80">
            We found work from another editing session{savedAtLabel ? `, saved ${savedAtLabel}` : ''}.
            Nothing will be replaced until you choose what to do.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRestore}
              className="inline-flex min-h-9 items-center gap-2 rounded-md bg-amber-800 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Restore recovery copy
            </button>
            <button
              type="button"
              onClick={onDiscard}
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-amber-400 bg-white px-3 py-2 text-xs font-bold text-amber-950 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 dark:bg-zinc-950 dark:text-amber-100"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Discard old copy
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
