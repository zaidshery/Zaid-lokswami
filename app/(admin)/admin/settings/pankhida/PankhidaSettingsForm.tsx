'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { DEFAULT_PANKHIDA_CONFIG, type PankhidaConfig } from '@/lib/pankhida/config';

const inputClass = 'mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white';

export default function PankhidaSettingsForm() {
  const [config, setConfig] = useState<PankhidaConfig>(DEFAULT_PANKHIDA_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/admin/pankhida', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load Pankhida settings.');
        return response.json() as Promise<PankhidaConfig>;
      })
      .then((value) => { if (active) setConfig(value); })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : 'Could not load settings.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/pankhida', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save settings.');
      setConfig(result as PankhidaConfig);
      setMessage('Saved. The public Pankhida 2026 page now reflects these settings.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-600">Reader event page</p>
        <h1 className="mt-2 text-3xl font-black text-zinc-950 dark:text-white">Pankhida 2026</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Control the event page at <Link className="font-semibold text-red-600 underline" href="/main/pankhida-2026" target="_blank">/main/pankhida-2026</Link>. Publish a YouTube stream with the Pankhida 2026 destination in Video Desk to show it here. The URL below is a fallback when no published Pankhida video exists.</p>
      </div>
      <form onSubmit={save} className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-7">
        <label className="block text-sm font-bold text-zinc-900 dark:text-white">
          Stream status
          <select className={inputClass} value={config.status} disabled={loading} onChange={(event) => setConfig({ ...config, status: event.target.value as PankhidaConfig['status'] })}>
            <option value="upcoming">Upcoming — show a waiting message</option>
            <option value="live">Live — show the YouTube live player</option>
            <option value="ended">Ended — show the YouTube replay</option>
          </select>
          <span className="mt-2 block text-xs font-normal text-zinc-500">A published Pankhida Video Desk stream appears automatically after its scheduled time. Set Ended to label it as a replay. When there is no published stream, this status controls the fallback URL below. Archive the Video Desk stream to remove it from the event page.</span>
        </label>
        <label className="block text-sm font-bold text-zinc-900 dark:text-white">
          YouTube live stream or replay URL
          <input className={inputClass} type="url" value={config.youtubeUrl} disabled={loading} placeholder="https://www.youtube.com/live/..." onChange={(event) => setConfig({ ...config, youtubeUrl: event.target.value })} />
          <span className="mt-2 block text-xs font-normal text-zinc-500">Fallback URL used only when no published Pankhida Video Desk stream exists. The video must allow embedding and be available to viewers. If YouTube blocks the embed, readers can use the Watch on YouTube link.</span>
        </label>
        <label className="block text-sm font-bold text-zinc-900 dark:text-white">
          Event description
          <textarea className={inputClass} rows={4} maxLength={1000} value={config.description} disabled={loading} placeholder="Tell readers about Pankhida 2026" onChange={(event) => setConfig({ ...config, description: event.target.value })} />
          <span className="mt-2 block text-xs font-normal text-zinc-500">Appears below the title on the public Pankhida 2026 page.</span>
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={loading || saving} className="min-h-11 rounded-xl bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save event page'}</button>
          {message ? <p role="status" className="text-sm text-zinc-700 dark:text-zinc-300">{message}</p> : null}
        </div>
      </form>
    </div>
  );
}
