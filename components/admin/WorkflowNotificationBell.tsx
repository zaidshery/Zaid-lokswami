'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Clock3, X } from 'lucide-react';
import type { WorkflowNotificationRecord } from '@/lib/storage/workflowNotifications';
import { useAppStore } from '@/lib/store/appStore';

type NotificationPayload = { items: WorkflowNotificationRecord[]; unreadCount: number };

function formatRelative(value: string, language: 'en' | 'hi') {
  const time = new Date(value).getTime();
  const diff = Math.max(0, Date.now() - time);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return language === 'hi' ? '\u0905\u092d\u0940' : 'Just now';
  if (minutes < 60) return language === 'hi' ? `${minutes} \u092e\u093f\u0928\u091f \u092a\u0939\u0932\u0947` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return language === 'hi' ? `${hours} \u0918\u0902\u091f\u0947 \u092a\u0939\u0932\u0947` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return language === 'hi' ? `${days} \u0926\u093f\u0928 \u092a\u0939\u0932\u0947` : `${days}d ago`;
}

export default function WorkflowNotificationBell() {
  const language = useAppStore((state) => state.language) === 'hi' ? 'hi' : 'en';
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<NotificationPayload>({ items: [], unreadCount: 0 });
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/notifications?limit=8', { cache: 'no-store' });
      const result = (await response.json()) as { success?: boolean; data?: NotificationPayload };
      if (response.ok && result.success && result.data) setPayload(result.data);
    } catch {
      // The workflow remains usable if notification refresh is temporarily unavailable.
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  async function markAllRead() {
    setLoading(true);
    try {
      await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      setPayload((current) => ({
        unreadCount: 0,
        items: current.items.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })),
      }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button type="button" onClick={() => setOpen((current) => !current)} className="admin-shell-toolbar-btn relative inline-flex h-10 w-10 items-center justify-center rounded-xl" aria-label={language === 'hi' ? '\u0935\u0930\u094d\u0915\u092b\u094d\u0932\u094b \u0928\u094b\u091f\u093f\u092b\u093f\u0915\u0947\u0936\u0928' : 'Workflow notifications'} aria-expanded={open}>
        <Bell className="h-4 w-4" />
        {payload.unreadCount ? <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black text-white">{Math.min(payload.unreadCount, 99)}</span> : null}
      </button>
      {open ? (
        <div className="fixed inset-x-3 top-[76px] z-[100] max-h-[calc(100vh-96px)] overflow-hidden rounded-2xl border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell)] shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[390px]" role="dialog" aria-label={language === 'hi' ? '\u0928\u094b\u091f\u093f\u092b\u093f\u0915\u0947\u0936\u0928' : 'Notifications'}>
          <div className="flex items-center justify-between border-b border-[color:var(--admin-shell-border)] px-4 py-3"><div><p className="text-sm font-black text-[color:var(--admin-shell-text)]">{language === 'hi' ? '\u0928\u094d\u092f\u0942\u091c\u0930\u0942\u092e \u0907\u0928\u092c\u0949\u0915\u094d\u0938' : 'Newsroom Inbox'}</p><p className="text-xs text-[color:var(--admin-shell-text-muted)]">{payload.unreadCount} {language === 'hi' ? '\u0905\u0928\u092a\u0922\u093c\u0947' : 'unread'}</p></div><button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-[color:var(--admin-shell-text-muted)]"><X className="h-4 w-4" /></button></div>
          <div className="max-h-[520px] divide-y divide-[color:var(--admin-shell-border)] overflow-y-auto">
            {payload.items.length ? payload.items.map((item) => (
              <Link key={item.id} href={item.href} onClick={() => setOpen(false)} className={`block px-4 py-3 transition-colors hover:bg-[color:var(--admin-shell-surface-muted)] ${item.readAt ? '' : 'bg-blue-500/[0.06]'}`}>
                <div className="flex items-start gap-3">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.readAt ? 'bg-zinc-400/40' : 'bg-blue-500'}`} />
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-bold text-[color:var(--admin-shell-text)]">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--admin-shell-text-muted)]">{language === 'hi' && item.messageHi ? item.messageHi : item.message}</p>
                    <p className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--admin-shell-text-muted)]"><Clock3 className="h-3 w-3" />{formatRelative(item.createdAt, language)}</p>
                  </div>
                </div>
              </Link>
            )) : <div className="px-5 py-10 text-center text-sm text-[color:var(--admin-shell-text-muted)]">{language === 'hi' ? '\u0905\u092d\u0940 \u0915\u094b\u0908 \u0928\u094b\u091f\u093f\u092b\u093f\u0915\u0947\u0936\u0928 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964' : 'No workflow notifications yet.'}</div>}
          </div>
          <div className="flex items-center justify-between border-t border-[color:var(--admin-shell-border)] px-4 py-3"><Link href="/admin/notifications" onClick={() => setOpen(false)} className="text-xs font-bold text-rose-600">{language === 'hi' ? '\u0938\u092d\u0940 \u0926\u0947\u0916\u0947\u0902' : 'View all'}</Link><button type="button" disabled={!payload.unreadCount || loading} onClick={() => void markAllRead()} className="inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--admin-shell-text)] disabled:opacity-40"><CheckCheck className="h-4 w-4" />{language === 'hi' ? '\u0938\u092d\u0940 \u092a\u0922\u093c\u093e' : 'Mark all read'}</button></div>
        </div>
      ) : null}
    </div>
  );
}
