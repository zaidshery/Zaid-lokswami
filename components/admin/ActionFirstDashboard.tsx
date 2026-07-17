'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, Inbox, ListChecks, Send, UserRoundX } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { WorkQueueItem, WorkQueueOverview, WorkQueueView } from '@/lib/admin/workQueue';
import type { AdminRole } from '@/lib/auth/roles';
import { useAppStore } from '@/lib/store/appStore';

type Copy = {
  eyebrow: string;
  title: string;
  summary: string;
  openQueue: string;
  empty: string;
  sections: Record<'mine' | 'risk' | 'approval' | 'release', { title: string; description: string }>;
  metrics: string;
};

const COPY: Record<'en' | 'hi', Copy> = {
  en: {
    eyebrow: 'Action-first newsroom',
    title: 'What needs your attention now',
    summary: 'Ownership, blockers, approval, and release decisions are ordered before passive reporting.',
    openQueue: 'Open Work Queue',
    empty: 'Nothing needs action in this lane.',
    sections: {
      mine: { title: 'My Next Actions', description: 'Assigned or created work with a permitted next step.' },
      risk: { title: 'Overdue and Unassigned', description: 'Ownership and timing risks that need triage.' },
      approval: { title: 'Awaiting Approval', description: 'Desk-ready work waiting for an approval decision.' },
      release: { title: 'Scheduled and Ready to Publish', description: 'Approved releases and publication products at the final gate.' },
    },
    metrics: 'Workload at a glance',
  },
  hi: {
    eyebrow: '\u090f\u0915\u094d\u0936\u0928-\u092b\u0930\u094d\u0938\u094d\u091f \u0928\u094d\u092f\u0942\u091c\u0930\u0942\u092e',
    title: '\u0905\u092d\u0940 \u0906\u092a\u0915\u0947 \u0927\u094d\u092f\u093e\u0928 \u0915\u0940 \u0915\u094d\u092f\u093e \u091c\u093c\u0930\u0942\u0930\u0924 \u0939\u0948',
    summary: '\u0930\u093f\u092a\u094b\u0930\u094d\u091f \u0938\u0947 \u092a\u0939\u0932\u0947 \u0913\u0928\u0930, \u092c\u094d\u0932\u0949\u0915\u0930, \u0905\u092a\u094d\u0930\u0942\u0935\u0932 \u0914\u0930 \u0930\u093f\u0932\u0940\u091c\u093c \u0915\u0947 \u092b\u0948\u0938\u0932\u0947 \u0926\u093f\u0916\u093e\u090f \u0917\u090f \u0939\u0948\u0902\u0964',
    openQueue: '\u0935\u0930\u094d\u0915 \u0915\u094d\u092f\u0942 \u0916\u094b\u0932\u0947\u0902',
    empty: '\u0907\u0938 \u0938\u0947\u0915\u094d\u0936\u0928 \u092e\u0947\u0902 \u0905\u092d\u0940 \u0915\u094b\u0908 \u0915\u093e\u0930\u094d\u0930\u0935\u093e\u0908 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964',
    sections: {
      mine: { title: '\u092e\u0947\u0930\u0947 \u0905\u0917\u0932\u0947 \u0915\u093e\u0930\u094d\u092f', description: '\u0905\u0938\u093e\u0907\u0928 \u092f\u093e \u092c\u0928\u093e\u090f \u0917\u090f \u0915\u093e\u092e \u0915\u093e \u0905\u0917\u0932\u093e \u0905\u0928\u0941\u092e\u0924 \u0915\u0926\u092e\u0964' },
      risk: { title: '\u0926\u0947\u0930\u0940 \u092e\u0947\u0902 \u0914\u0930 \u092c\u093f\u0928\u093e \u0913\u0928\u0930', description: '\u091f\u094d\u0930\u093e\u092f\u093e\u091c \u0915\u0940 \u091c\u093c\u0930\u0942\u0930\u0924 \u0935\u093e\u0932\u0947 \u0913\u0928\u0930\u0936\u093f\u092a \u0914\u0930 \u0938\u092e\u092f \u091c\u094b\u0916\u093f\u092e\u0964' },
      approval: { title: '\u0905\u092a\u094d\u0930\u0942\u0935\u0932 \u0915\u0947 \u0907\u0902\u0924\u091c\u093c\u093e\u0930 \u092e\u0947\u0902', description: '\u092b\u0948\u0938\u0932\u0947 \u0915\u0947 \u0932\u093f\u090f \u0924\u0948\u092f\u093e\u0930 \u0921\u0947\u0938\u094d\u0915 \u0935\u0930\u094d\u0915\u0964' },
      release: { title: '\u0936\u0947\u0921\u094d\u092f\u0942\u0932 \u0914\u0930 \u092a\u092c\u094d\u0932\u093f\u0936 \u0915\u0947 \u0932\u093f\u090f \u0924\u0948\u092f\u093e\u0930', description: '\u0905\u0902\u0924\u093f\u092e \u0917\u0947\u091f \u092a\u0930 \u0905\u092a\u094d\u0930\u0942\u0935 \u0930\u093f\u0932\u0940\u091c\u093c \u0914\u0930 \u092a\u092c\u094d\u0932\u093f\u0915\u0947\u0936\u0928\u0964' },
    },
    metrics: '\u0935\u0930\u094d\u0915\u0932\u094b\u0921 \u090f\u0915 \u0928\u091c\u093c\u0930 \u092e\u0947\u0902',
  },
};

const TERMINAL = new Set(['published', 'archived']);

function pretty(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dueLabel(value: string | null, language: 'en' | 'hi') {
  if (!value) return language === 'hi' ? '\u0915\u094b\u0908 \u0921\u094d\u092f\u0942 \u0938\u092e\u092f \u0928\u0939\u0940\u0902' : 'No due time';
  return new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function ActionRow({ item, language }: { item: WorkQueueItem; language: 'en' | 'hi' }) {
  return (
    <Link href={item.editHref} className="group grid gap-3 border-b border-[color:var(--admin-shell-border)] px-4 py-3 last:border-b-0 hover:bg-[color:var(--admin-shell-surface-muted)] sm:grid-cols-[minmax(0,1fr)_130px_145px_auto] sm:items-center">
      <div className="min-w-0"><p className="truncate text-sm font-black text-[color:var(--admin-shell-text)]">{item.title}</p><p className="mt-1 text-xs text-[color:var(--admin-shell-text-muted)]">{item.publicationType === 'emagazine' ? 'E-Magazine' : pretty(item.contentType)} · {pretty(item.status)}</p></div>
      <div className="text-xs text-[color:var(--admin-shell-text-muted)]"><span className="font-bold text-[color:var(--admin-shell-text)]">{item.assignedToName || (language === 'hi' ? '\u092c\u093f\u0928\u093e \u0913\u0928\u0930' : 'Unassigned')}</span></div>
      <div className={`text-xs ${item.isOverdue ? 'font-bold text-rose-600' : 'text-[color:var(--admin-shell-text-muted)]'}`}><Clock3 className="mr-1 inline h-3.5 w-3.5" />{dueLabel(item.dueAt, language)}</div>
      <span className="inline-flex items-center justify-between gap-2 text-xs font-black text-blue-600 sm:justify-end">{item.nextActionLabel}<ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span>
    </Link>
  );
}

function Lane({ icon: Icon, title, description, href, items, language, empty }: { icon: LucideIcon; title: string; description: string; href: string; items: WorkQueueItem[]; language: 'en' | 'hi'; empty: string }) {
  return (
    <section className="admin-shell-surface overflow-hidden rounded-[22px]">
      <div className="flex items-start justify-between gap-4 border-b border-[color:var(--admin-shell-border)] px-4 py-4 sm:px-5">
        <div className="flex min-w-0 gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600"><Icon className="h-5 w-5" /></span><div><h2 className="text-lg font-black text-[color:var(--admin-shell-text)]">{title}</h2><p className="mt-1 text-xs leading-5 text-[color:var(--admin-shell-text-muted)]">{description}</p></div></div>
        <Link href={href} className="admin-shell-toolbar-btn shrink-0 rounded-full px-3 py-2 text-xs font-bold">{items.length}</Link>
      </div>
      {items.length ? items.slice(0, 5).map((item) => <ActionRow key={`${item.contentType}:${item.id}`} item={item} language={language} />) : <p className="px-5 py-8 text-center text-sm text-[color:var(--admin-shell-text-muted)]">{empty}</p>}
    </section>
  );
}

export default function ActionFirstDashboard({ overview, role }: { overview: WorkQueueOverview; role: AdminRole }) {
  const language = useAppStore((state) => state.language) === 'hi' ? 'hi' : 'en';
  const copy = COPY[language];
  const active = overview.items.filter((item) => !TERMINAL.has(item.status));
  const mine = active.filter((item) => item.isMine);
  const risk = active.filter((item) => item.isOverdue || item.isUnassigned);
  const approval = active.filter((item) => item.status === 'ready_for_approval');
  const release = active.filter((item) => ['approved', 'scheduled', 'ready_to_publish'].includes(item.status));
  const metrics: Array<{ view: WorkQueueView; label: string; icon: LucideIcon }> = [
    { view: 'mine', label: language === 'hi' ? '\u092e\u0947\u0930\u093e \u0915\u093e\u092e' : 'Mine', icon: ListChecks },
    { view: 'unassigned', label: language === 'hi' ? '\u092c\u093f\u0928\u093e \u0913\u0928\u0930' : 'Unassigned', icon: UserRoundX },
    { view: 'review', label: language === 'hi' ? '\u0930\u093f\u0935\u094d\u092f\u0942' : 'Review', icon: Inbox },
    { view: 'approval', label: language === 'hi' ? '\u0905\u092a\u094d\u0930\u0942\u0935\u0932' : 'Approval', icon: CheckCircle2 },
    { view: 'publishing', label: language === 'hi' ? '\u092a\u092c\u094d\u0932\u093f\u0936\u093f\u0902\u0917' : 'Publishing', icon: Send },
    { view: 'overdue', label: language === 'hi' ? '\u0926\u0947\u0930\u0940 \u092e\u0947\u0902' : 'Overdue', icon: AlertTriangle },
  ];

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 px-3 pb-10 sm:px-5">
      <section className="admin-shell-surface-strong rounded-[24px] p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-rose-600">{copy.eyebrow} · {pretty(role)}</p><h1 className="mt-2 text-3xl font-black tracking-tight text-[color:var(--admin-shell-text)] sm:text-4xl">{copy.title}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--admin-shell-text-muted)]">{copy.summary}</p></div><Link href="/admin/work" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 text-sm font-black text-white dark:bg-white dark:text-zinc-950">{copy.openQueue}<ArrowUpRight className="h-4 w-4" /></Link></div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Lane icon={ListChecks} {...copy.sections.mine} href="/admin/work?view=mine" items={mine} language={language} empty={copy.empty} />
        <Lane icon={AlertTriangle} {...copy.sections.risk} href="/admin/work?view=overdue" items={risk} language={language} empty={copy.empty} />
        <Lane icon={CheckCircle2} {...copy.sections.approval} href="/admin/work?view=approval" items={approval} language={language} empty={copy.empty} />
        <Lane icon={Send} {...copy.sections.release} href="/admin/work?view=publishing" items={release} language={language} empty={copy.empty} />
      </div>

      <section><h2 className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-[color:var(--admin-shell-text-muted)]">{copy.metrics}</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{metrics.map(({ view, label, icon: Icon }) => <Link key={view} href={`/admin/work?view=${view}`} className="admin-shell-surface rounded-[18px] p-4 transition-transform hover:-translate-y-0.5"><div className="flex items-center justify-between"><Icon className="h-4 w-4 text-blue-600" /><span className="text-2xl font-black text-[color:var(--admin-shell-text)]">{overview.viewCounts[view]}</span></div><p className="mt-3 text-xs font-bold text-[color:var(--admin-shell-text-muted)]">{label}</p></Link>)}</div></section>
    </div>
  );
}
