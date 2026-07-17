'use client';

import { useMemo, useState } from 'react';
import { Copy, Megaphone } from 'lucide-react';
import type { PushAlertCandidate } from '@/lib/admin/newsroomControlCenter';
import {
  CMS_COLLECTION_PANEL_CLASS as PANEL_CLASS,
  CMS_COLLECTION_SOFT_CARD_CLASS as SOFT_CARD_CLASS,
} from '@/components/admin/CmsCollectionLayout';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function PushAlertDeskClient({
  candidates,
}: {
  candidates: PushAlertCandidate[];
}) {
  const [selectedId, setSelectedId] = useState(candidates[0]?.id || '');
  const [customHeadline, setCustomHeadline] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const selected = useMemo(
    () => candidates.find((candidate) => candidate.id === selectedId) || candidates[0] || null,
    [candidates, selectedId]
  );

  const previewText =
    customHeadline.trim() ||
    selected?.suggestedLine ||
    'Add a push-alert headline to prepare a newsroom alert.';

  async function copyPreview() {
    try {
      await navigator.clipboard.writeText(previewText);
      setStatusMessage('Push-alert draft copied.');
    } catch {
      setStatusMessage('Copy failed. Select the text and copy it manually.');
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr,1.1fr]">
      <section className={PANEL_CLASS}>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-red-500/10 p-3 text-red-600 dark:text-red-300">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Alert Candidates</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Select a high-signal story and prepare the alert copy the desk can publish.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {candidates.length ? (
            candidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => {
                  setSelectedId(candidate.id);
                  setCustomHeadline(candidate.suggestedLine);
                  setStatusMessage('');
                }}
                className={cx(
                  SOFT_CARD_CLASS,
                  'w-full text-left transition-colors hover:border-red-300/40 hover:bg-red-50/50 dark:hover:border-red-500/20 dark:hover:bg-red-500/5',
                  selected?.id === candidate.id &&
                    'border-red-300/60 bg-red-50/70 dark:border-red-500/30 dark:bg-red-500/8'
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {candidate.title}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {candidate.category} / {candidate.author}
                    </p>
                  </div>
                  <span
                    className={cx(
                      'rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]',
                      candidate.priority === 'high'
                        ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300'
                        : 'border-zinc-200 bg-white text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200'
                    )}
                  >
                    {candidate.priority === 'high' ? 'Priority' : 'Watch'}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                  {candidate.suggestedLine}
                </p>
              </button>
            ))
          ) : (
            <div className={SOFT_CARD_CLASS}>
              No article candidates are available yet. Publish or update a few stories and this desk
              will begin surfacing push-alert lines.
            </div>
          )}
        </div>
      </section>

      <section className={`${PANEL_CLASS} xl:sticky xl:top-4 xl:self-start`}>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Push Alert Draft</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          Build the alert copy here, then pass it to the app or channel you use for final delivery.
        </p>

        <div className="mt-6 space-y-4">
          <div className={SOFT_CARD_CLASS}>
            <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              Headline
            </label>
            <textarea
              value={customHeadline}
              onChange={(event) => {
                setCustomHeadline(event.target.value);
                setStatusMessage('');
              }}
              placeholder="Write the alert headline the newsroom should send."
              className="mt-3 min-h-[132px] w-full rounded-2xl border border-zinc-200/80 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition-colors focus:border-red-300 focus:ring-2 focus:ring-red-500/10 dark:border-white/10 dark:bg-zinc-950/70 dark:text-zinc-100"
            />
          </div>

          <div className={SOFT_CARD_CLASS}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              Preview
            </p>
            <div className="mt-3 rounded-2xl border border-zinc-200/80 bg-white px-4 py-4 text-sm leading-6 text-zinc-700 dark:border-white/10 dark:bg-zinc-950/70 dark:text-zinc-200">
              {previewText}
            </div>
            {selected ? (
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                <span>{selected.category}</span>
                <span>{selected.author}</span>
                <span>{selected.views} views</span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={copyPreview}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Copy className="h-4 w-4" />
              Copy Alert Copy
            </button>
            {selected ? (
              <a
                href={selected.href}
                className="inline-flex items-center justify-center rounded-2xl border border-zinc-200/80 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 transition-colors hover:border-red-300/40 hover:text-red-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:border-red-500/30 dark:hover:text-red-300"
              >
                Open Story
              </a>
            ) : null}
          </div>

          {statusMessage ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
              {statusMessage}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
