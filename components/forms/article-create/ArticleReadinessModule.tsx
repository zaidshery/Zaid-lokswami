'use client';

import Link from 'next/link';
import { AlertCircle, CheckCircle, CircleDot, Loader2, Sparkles } from 'lucide-react';
import { ArticleEditorSidebar } from '@/components/forms/ArticleEditorStudio';
import ArticleEditorialChecklist from '@/components/forms/ArticleEditorialChecklist';
import type { ArticleEditorialMeta } from '@/lib/content/articleEditorial';
import type { ArticleSeoFields } from '@/lib/seo/articleSeo';
import type { ArticleAssistResult, ArticleReadinessItem } from '@/lib/utils/articleAssistant';

type ReadinessSummary = {
  canSend: boolean;
  score: number;
  total: number;
  done: ArticleReadinessItem[];
  blockers: ArticleReadinessItem[];
  warnings: ArticleReadinessItem[];
  todos: ArticleReadinessItem[];
};

type RelatedArticle = { id: string; title: string; slug?: string; category?: string };

type ArticleReadinessModuleProps = {
  active: boolean;
  editorial: ArticleEditorialMeta;
  onEditorialChange: <Key extends keyof ArticleEditorialMeta>(key: Key, value: ArticleEditorialMeta[Key]) => void;
  summary: ReadinessSummary;
  assistResult: ArticleAssistResult;
  linkedArticleExists: boolean;
  onFocusItem: (item: ArticleReadinessItem) => void;
  onRunAssist: () => void;
  isAssistLoading: boolean;
  article: {
    title: string;
    summary: string;
    content: string;
    slug: string;
    image: string;
    category: string;
    seo: ArticleSeoFields;
    relatedArticles: RelatedArticle[];
  };
};

function statusClass(status: ArticleReadinessItem['status']) {
  if (status === 'done') return 'border-green-200 bg-green-50 text-green-800';
  if (status === 'blocked') return 'border-red-200 bg-red-50 text-red-800';
  if (status === 'warning') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-gray-200 bg-white text-gray-700';
}

function StatusIcon({ item }: { item: ArticleReadinessItem }) {
  if (item.status === 'done') return <CheckCircle className="h-4 w-4 text-green-600" />;
  if (item.status === 'blocked') return <AlertCircle className="h-4 w-4 text-red-600" />;
  if (item.status === 'warning') return <AlertCircle className="h-4 w-4 text-amber-600" />;
  return <CircleDot className="h-4 w-4 text-gray-400" />;
}

export default function ArticleReadinessModule(props: ArticleReadinessModuleProps) {
  const { summary } = props;
  return (
    <div id="article-inspector-quality" role="tabpanel" className={props.active ? 'space-y-4' : 'hidden'}>
      <ArticleEditorialChecklist value={props.editorial} onChange={props.onEditorialChange} />
      <details open={summary.blockers.length > 0} className="rounded-xl border border-gray-200 bg-gray-50">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3 marker:hidden">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Publishing readiness</p>
            <p className="mt-1 text-xs leading-5 text-gray-600">{summary.canSend ? 'Critical checks are clear. Review warnings before sending.' : 'Resolve critical blockers before this article can be sent.'}</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-gray-900">{summary.score}%</span>
        </summary>
        <div className="border-t border-gray-200 p-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Done</p><p className="mt-1 text-sm font-bold text-gray-900">{summary.done.length}/{summary.total}</p></div>
            <div className="rounded-lg border border-red-100 bg-white px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-red-500">Blockers</p><p className="mt-1 text-sm font-bold text-red-700">{summary.blockers.length}</p></div>
            <div className="rounded-lg border border-amber-100 bg-white px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Warnings</p><p className="mt-1 text-sm font-bold text-amber-700">{summary.warnings.length + summary.todos.length}</p></div>
          </div>
          {props.linkedArticleExists ? <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">A linked article already exists for this source story.</p> : null}
          {!summary.canSend ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">Resolve blockers: {summary.blockers.map((item) => item.label).join(', ')}</p> : null}
          <div className="mt-3 space-y-2">
            {props.assistResult.readiness.items.map((item) => (
              <button key={item.id} type="button" onClick={() => props.onFocusItem(item)} aria-label={`${item.label} readiness: ${item.status}`} className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors hover:border-gray-400 ${statusClass(item.status)}`}>
                <span className="mt-0.5"><StatusIcon item={item} /></span>
                <span className="min-w-0"><span className="block text-xs font-semibold">{item.label}</span><span className="mt-0.5 block text-xs opacity-80">{item.detail}</span></span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-3">
            <button type="button" onClick={props.onRunAssist} disabled={props.isAssistLoading} className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60">
              {props.isAssistLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Assist with fixes
            </button>
            <Link href="/admin" className="w-full rounded-lg border border-gray-300 px-6 py-3 text-center text-gray-700 transition-colors hover:bg-gray-50">Cancel</Link>
          </div>
        </div>
      </details>
      <details open className="rounded-xl border border-gray-200 bg-gray-50">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">Article analysis</summary>
        <div className="border-t border-gray-200 p-4">
          <ArticleEditorSidebar {...props.article} className="space-y-3" />
        </div>
      </details>
    </div>
  );
}
