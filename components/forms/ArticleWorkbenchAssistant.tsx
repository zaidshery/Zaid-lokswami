'use client';

import {
  CheckCircle2,
  CircleAlert,
  CircleDot,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  ArticleAssistField,
  ArticleAssistPatch,
  ArticleAssistResult,
  ArticleReadinessItem,
} from '@/lib/utils/articleAssistant';

type ArticleWorkbenchAssistantProps = {
  result: ArticleAssistResult | null;
  isLoading: boolean;
  error?: string;
  rejectedPatchKeys?: Set<string>;
  onRun: () => void;
  onApplyPatch: (patch: ArticleAssistPatch) => void;
  onApplyAll?: (patches: ArticleAssistPatch[]) => void;
  onRejectPatch: (patch: ArticleAssistPatch) => void;
  onFocusField?: (field: ArticleAssistField) => void;
  title?: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function getArticleAssistPatchKey(patch: ArticleAssistPatch) {
  return `${patch.field}:${patch.suggestedValue}`;
}

function statusIcon(item: ArticleReadinessItem) {
  if (item.status === 'done') {
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  }
  if (item.status === 'blocked') {
    return <CircleAlert className="h-4 w-4 text-red-600" />;
  }
  if (item.status === 'warning') {
    return <CircleAlert className="h-4 w-4 text-amber-600" />;
  }
  return <CircleDot className="h-4 w-4 text-zinc-400" />;
}

function statusClass(status: ArticleReadinessItem['status']) {
  switch (status) {
    case 'done':
      return 'border-emerald-100 bg-emerald-50 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100';
    case 'blocked':
      return 'border-red-100 bg-red-50 text-red-900 dark:border-red-400/25 dark:bg-red-500/10 dark:text-red-100';
    case 'warning':
      return 'border-amber-100 bg-amber-50 text-amber-900 dark:border-amber-300/25 dark:bg-amber-400/10 dark:text-amber-100';
    default:
      return 'border-zinc-200 bg-white text-zinc-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-300';
  }
}

function fieldLabel(field: ArticleAssistField) {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase());
}

export default function ArticleWorkbenchAssistant({
  result,
  isLoading,
  error,
  rejectedPatchKeys,
  onRun,
  onApplyPatch,
  onApplyAll,
  onRejectPatch,
  onFocusField,
  title = 'Assistant & readiness',
}: ArticleWorkbenchAssistantProps) {
  const patches = (result?.patches || []).filter(
    (patch) => !rejectedPatchKeys?.has(getArticleAssistPatchKey(patch))
  );
  const readinessItems = result?.readiness.items || [];
  const completedItems = readinessItems.filter((item) => item.status === 'done').length;
  const blockedItems = readinessItems.filter((item) => item.status === 'blocked').length;

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-zinc-950/70">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{title}</p>
          <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
            Deterministic desk assist. Apply only the suggestions you approve.
          </p>
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={isLoading}
          className="inline-flex shrink-0 items-center gap-2 rounded-md border border-spanish-red bg-white px-3 py-2 text-xs font-semibold text-spanish-red transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-500/10 dark:text-red-100 dark:hover:bg-red-500/20"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Assist
        </button>
      </div>

      {error ? (
        <p className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Ready score
            </p>
            <span className="rounded-full bg-zinc-950 px-2.5 py-1 text-xs font-bold text-white dark:bg-white dark:text-zinc-950">
              {result.readiness.score}%
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Complete
              </p>
              <p className="mt-1 text-sm font-bold text-zinc-950 dark:text-zinc-50">
                {completedItems}/{readinessItems.length}
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Blockers
              </p>
              <p className="mt-1 text-sm font-bold text-zinc-950 dark:text-zinc-50">
                {blockedItems}
              </p>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {readinessItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => item.field && onFocusField?.(item.field)}
                className={cx(
                  'flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left transition-colors',
                  statusClass(item.status),
                  item.field && 'hover:border-zinc-400 dark:hover:border-white/30'
                )}
              >
                <span className="mt-0.5">{statusIcon(item)}</span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold">{item.label}</span>
                  <span className="mt-0.5 block text-xs opacity-80">{item.detail}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {patches.length ? (
        <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Suggested field updates
            </p>
            {onApplyAll ? (
              <button
                type="button"
                onClick={() => onApplyAll(patches)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-zinc-950 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Apply all safe
              </button>
            ) : null}
          </div>
          <div className="mt-3 space-y-2">
            {patches.map((patch) => (
              <div
                key={getArticleAssistPatchKey(patch)}
                className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.03]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-950 dark:text-zinc-50">{fieldLabel(patch.field)}</p>
                    <p className="mt-1 line-clamp-3 text-xs text-zinc-700 dark:text-zinc-300">{patch.suggestedValue}</p>
                    <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{patch.reason}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRejectPatch(patch)}
                    className="rounded p-1 text-zinc-400 transition-colors hover:bg-white hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-zinc-100"
                    aria-label={`Dismiss ${fieldLabel(patch.field)} suggestion`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onApplyPatch(patch)}
                  className="mt-3 w-full rounded-md bg-zinc-950 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  Apply suggestion
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : result ? (
        <p className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100">
          No pending field suggestions. The current package is already well-filled.
        </p>
      ) : null}

      {result?.suggestions.length ? (
        <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Desk notes
          </p>
          <div className="mt-3 space-y-2">
            {result.suggestions.map((suggestion) => (
              <div key={suggestion.id} className="rounded-md bg-zinc-50 p-3 dark:bg-white/[0.03]">
                <p className="text-xs font-bold text-zinc-950 dark:text-zinc-50">{suggestion.label}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-700 dark:text-zinc-300">{suggestion.value}</p>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{suggestion.reason}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
