'use client';

import { useState, useCallback } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  ImageOff,
  RefreshCw,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const ELECTION_STATES = [
  { id: 'wb',         name: 'West Bengal' },
  { id: 'kerala',     name: 'Kerala' },
  { id: 'tn',         name: 'Tamil Nadu' },
  { id: 'assam',      name: 'Assam' },
  { id: 'puducherry', name: 'Puducherry' },
];

type MsgMap = Record<string, { type: 'success' | 'error'; text: string }>;

export default function ElectionSettingsPage() {
  const router = useRouter();
  const [uploading,  setUploading]  = useState<string | null>(null);
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const [messages,   setMessages]   = useState<MsgMap>({});
  const [timestamps, setTimestamps] = useState<Record<string, number>>({});
  const [deleted,    setDeleted]    = useState<Record<string, boolean>>({});

  const setMsg = (id: string, type: 'success' | 'error', text: string) =>
    setMessages((p) => ({ ...p, [id]: { type, text } }));

  const clearMsg = (id: string) =>
    setMessages((p) => { const n = { ...p }; delete n[id]; return n; });

  /* ── Upload / Replace ─────────────────────────────────────── */
  const handleUpload = useCallback(async (stateId: string, file: File) => {
    setUploading(stateId);
    clearMsg(stateId);

    const form = new FormData();
    form.append('file', file);
    form.append('stateId', stateId);

    try {
      const res  = await fetch('/api/admin/elections/upload', { method: 'POST', body: form });
      const data = await res.json();

      if (data.success) {
        setMsg(stateId, 'success', 'Graphic updated!');
        setTimestamps((p) => ({ ...p, [stateId]: Date.now() }));
        setDeleted((p) => ({ ...p, [stateId]: false }));
        router.refresh();
      } else {
        setMsg(stateId, 'error', data.error || 'Upload failed');
      }
    } catch {
      setMsg(stateId, 'error', 'Network error');
    } finally {
      setUploading(null);
    }
  }, [router]);

  /* ── Delete ───────────────────────────────────────────────── */
  const handleDelete = useCallback(async (stateId: string) => {
    if (!confirm(`Remove the "${ELECTION_STATES.find(s => s.id === stateId)?.name}" graphic? This cannot be undone.`)) return;

    setDeleting(stateId);
    clearMsg(stateId);

    try {
      const res  = await fetch('/api/admin/elections/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stateId }),
      });
      const data = await res.json();

      if (data.success) {
        setMsg(stateId, 'success', 'Graphic removed.');
        setDeleted((p) => ({ ...p, [stateId]: true }));
        setTimestamps((p) => ({ ...p, [stateId]: Date.now() }));
        router.refresh();
      } else {
        setMsg(stateId, 'error', data.error || 'Delete failed');
      }
    } catch {
      setMsg(stateId, 'error', 'Network error');
    } finally {
      setDeleting(null);
    }
  }, [router]);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Live Election Graphics
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Upload, replace or remove election graphics shown in the homepage widget.
          Changes are reflected on the live site immediately.
        </p>
      </div>

      {/* Cards grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {ELECTION_STATES.map((state) => {
          const ts        = timestamps[state.id] || 1;
          const imageUrl  = `/elections/${state.id}.jpg?t=${ts}`;
          const isUpl     = uploading === state.id;
          const isDel     = deleting  === state.id;
          const isBusy    = isUpl || isDel;
          const isDeleted = deleted[state.id];
          const msg       = messages[state.id];

          return (
            <div
              key={state.id}
              className="cnp-surface flex flex-col rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Preview */}
              <div className="relative aspect-video w-full bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
                {isDeleted ? (
                  <div className="flex flex-col items-center justify-center gap-2 text-zinc-400 dark:text-zinc-600">
                    <ImageOff className="w-8 h-8" />
                    <span className="text-xs font-medium">No graphic uploaded</span>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt={`${state.name} Election Graphic`}
                    className="absolute inset-0 w-full h-full object-contain"
                    onError={() =>
                      setDeleted((p) => ({ ...p, [state.id]: true }))
                    }
                  />
                )}

                {/* Busy overlay */}
                {isBusy && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <Loader2 className="w-7 h-7 text-white animate-spin" />
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="p-4 flex-1 flex flex-col gap-3">
                <h3 className="font-semibold text-base text-zinc-900 dark:text-zinc-100">
                  {state.name}
                </h3>

                {/* Action buttons */}
                <div className="mt-auto flex flex-col gap-2">

                  {/* Upload / Replace */}
                  <label
                    className={`relative flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-medium transition-all select-none ${
                      isBusy
                        ? 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed'
                        : 'bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 cursor-pointer'
                    }`}
                  >
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={isBusy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(state.id, file);
                        e.target.value = '';
                      }}
                    />
                    {isUpl ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                    ) : isDeleted ? (
                      <><UploadCloud className="w-4 h-4" /> Upload Graphic</>
                    ) : (
                      <><RefreshCw className="w-4 h-4" /> Replace Graphic</>
                    )}
                  </label>

                  {/* Delete */}
                  {!isDeleted && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleDelete(state.id)}
                      className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-xl text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800/60 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isDel ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Removing…</>
                      ) : (
                        <><Trash2 className="w-4 h-4" /> Remove Graphic</>
                      )}
                    </button>
                  )}
                </div>

                {/* Status message */}
                {msg?.text && (
                  <div className={`flex items-start gap-1.5 text-xs mt-1 ${
                    msg.type === 'success'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {msg.type === 'success'
                      ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                      : <AlertCircle  className="w-4 h-4 shrink-0" />}
                    <span>{msg.text}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
