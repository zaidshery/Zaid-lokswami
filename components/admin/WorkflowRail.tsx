'use client';

import { AlertTriangle, CalendarClock, CheckCircle2, CircleUserRound, Save } from 'lucide-react';
import { useAppStore } from '@/lib/store/appStore';

function pretty(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDue(value: string | null, language: 'en' | 'hi') {
  if (!value) return language === 'hi' ? '\u0921\u094d\u092f\u0942 \u0938\u092e\u092f \u0928\u0939\u0940\u0902' : 'No due time';
  return new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function WorkflowRail({
  status,
  assignee,
  dueAt,
  hasUnsavedChanges,
  blockerCount,
  primaryAction,
  targetId = 'workflow-actions',
}: {
  status: string;
  assignee?: string | null;
  dueAt?: string | null;
  hasUnsavedChanges: boolean;
  blockerCount: number;
  primaryAction: string;
  targetId?: string;
}) {
  const language = useAppStore((state) => state.language) === 'hi' ? 'hi' : 'en';
  const jumpToAction = () => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  return (
    <div className="sticky top-[68px] z-30 mb-5 rounded-2xl border border-zinc-200/90 bg-white/95 p-3 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.7)] backdrop-blur dark:border-zinc-700 dark:bg-zinc-950/95">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1.2fr_1.2fr_1fr_auto] xl:items-center">
        <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">{language === 'hi' ? '\u0935\u0930\u094d\u0924\u092e\u093e\u0928 \u0938\u094d\u091f\u0947\u091c' : 'Current stage'}</p><p className="mt-1 text-sm font-black text-zinc-950 dark:text-white">{pretty(status)}</p></div>
        <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300"><CircleUserRound className="h-4 w-4 text-blue-600" /><span><b>{language === 'hi' ? '\u0913\u0928\u0930:' : 'Owner:'}</b> {assignee || (language === 'hi' ? '\u0905\u0928\u0905\u0938\u093e\u0907\u0928\u094d\u0921' : 'Unassigned')}</span></div>
        <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300"><CalendarClock className="h-4 w-4 text-blue-600" />{formatDue(dueAt || null, language)}</div>
        <div className="flex flex-wrap items-center gap-2 text-xs"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold ${hasUnsavedChanges ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{hasUnsavedChanges ? <Save className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{hasUnsavedChanges ? (language === 'hi' ? '\u0938\u0947\u0935 \u092c\u093e\u0915\u0940' : 'Unsaved') : (language === 'hi' ? '\u0938\u0947\u0935\u094d\u0921' : 'Saved')}</span>{blockerCount ? <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 font-bold text-rose-800"><AlertTriangle className="h-3.5 w-3.5" />{blockerCount} {language === 'hi' ? '\u092c\u094d\u0932\u0949\u0915\u0930' : 'blocker'}</span> : null}</div>
        <button type="button" onClick={jumpToAction} className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-600 px-4 text-xs font-black text-white hover:bg-blue-700">{hasUnsavedChanges ? (language === 'hi' ? '\u092a\u0939\u0932\u0947 \u092c\u0926\u0932\u093e\u0935 \u0938\u0947\u0935 \u0915\u0930\u0947\u0902' : 'Save changes first') : primaryAction}</button>
      </div>
    </div>
  );
}
