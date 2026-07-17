'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, UserRoundCheck } from 'lucide-react';
import type { WorkQueueItem } from '@/lib/admin/workQueue';
import type { AdminRole } from '@/lib/auth/roles';

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  activeWorkload?: number;
  reason?: string;
};

export default function BulkTriageClient({ items }: { items: WorkQueueItem[] }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [assignedToId, setAssignedToId] = useState('');
  const [priority, setPriority] = useState('normal');
  const [dueAt, setDueAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ succeeded: number; failed: number; errors: string[] } | null>(null);

  useEffect(() => {
    const contentTypes = Array.from(new Set(items.map((item) => item.contentType))).join(',');
    void fetch(`/api/admin/work-queue/assignee-suggestions?contentTypes=${encodeURIComponent(contentTypes)}`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload) => setMembers((payload.data || []).filter((member: TeamMember) => member.isActive)))
      .catch(() => setMembers([]));
  }, [items]);

  async function submit() {
    if (!assignedToId) return;
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch('/api/admin/work-queue/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({ contentType: item.contentType, id: item.id, expectedVersion: item.version })),
          assignedToId,
          priority,
          dueAt: dueAt || undefined,
        }),
      });
      const payload = (await response.json()) as { data?: { succeeded?: number; failed?: number; results?: Array<{ error?: string }> }; error?: string };
      setResult({
        succeeded: Number(payload.data?.succeeded || 0),
        failed: Number(payload.data?.failed || (response.ok ? 0 : items.length)),
        errors: (payload.data?.results || []).map((entry) => entry.error || '').filter(Boolean),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 pb-10 sm:px-6">
      <Link href="/admin/work" className="inline-flex items-center gap-2 text-sm font-bold text-[color:var(--admin-shell-text-muted)]"><ArrowLeft className="h-4 w-4" />Back to Work Queue</Link>
      <section className="admin-shell-surface-strong rounded-[24px] p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Safe bulk action</p>
        <h1 className="mt-2 text-3xl font-black text-[color:var(--admin-shell-text)]">Bulk Triage</h1>
        <p className="mt-2 text-sm leading-6 text-[color:var(--admin-shell-text-muted)]">Assign ownership, priority, and a useful due time. Publishing decisions remain item-by-item.</p>
      </section>
      <section className="admin-shell-surface rounded-[22px] p-5">
        <h2 className="text-lg font-black text-[color:var(--admin-shell-text)]">{items.length} selected item{items.length === 1 ? '' : 's'}</h2>
        <div className="mt-4 space-y-2">{items.map((item) => (
          <div key={`${item.contentType}:${item.id}`} className="admin-shell-surface-muted flex items-center justify-between gap-3 rounded-xl px-4 py-3">
            <div className="min-w-0"><p className="truncate text-sm font-bold text-[color:var(--admin-shell-text)]">{item.title}</p><p className="text-xs uppercase tracking-wide text-[color:var(--admin-shell-text-muted)]">{item.publicationType === 'emagazine' ? 'E-Magazine' : item.contentType}</p></div>
            <span className="text-xs text-[color:var(--admin-shell-text-muted)]">{item.assignedToName || 'Unassigned'}</span>
          </div>
        ))}</div>
      </section>
      <section className="admin-shell-surface rounded-[22px] p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-2 text-xs font-bold uppercase tracking-wide text-[color:var(--admin-shell-text-muted)]">
            Assign to
            <select value={assignedToId} onChange={(event) => setAssignedToId(event.target.value)} className="h-11 w-full rounded-xl border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface-muted)] px-3 text-sm normal-case text-[color:var(--admin-shell-text)]">
              <option value="">Choose team member</option>
              {members.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.reason || member.role.replace(/_/g, ' ')}</option>)}
            </select>
            <span className="block text-[11px] font-medium normal-case tracking-normal">Suggested order uses role fit and current active workload; an admin must confirm.</span>
          </label>
          <label className="space-y-2 text-xs font-bold uppercase tracking-wide text-[color:var(--admin-shell-text-muted)]">
            Priority
            <select value={priority} onChange={(event) => setPriority(event.target.value)} className="h-11 w-full rounded-xl border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface-muted)] px-3 text-sm normal-case text-[color:var(--admin-shell-text)]"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select>
          </label>
          <label className="space-y-2 text-xs font-bold uppercase tracking-wide text-[color:var(--admin-shell-text-muted)]">
            Due at
            <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="h-11 w-full rounded-xl border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface-muted)] px-3 text-sm normal-case text-[color:var(--admin-shell-text)]" />
          </label>
        </div>
        <button type="button" disabled={!assignedToId || busy || !items.length} onClick={() => void submit()} className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRoundCheck className="h-4 w-4" />}Apply triage</button>
        {result ? <div className={`mt-4 rounded-xl border p-4 text-sm ${result.failed ? 'border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-200' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'}`}><p className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-4 w-4" />{result.succeeded} updated · {result.failed} failed</p>{result.errors.length ? <ul className="mt-2 list-disc pl-5 text-xs">{result.errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul> : null}</div> : null}
      </section>
    </div>
  );
}
