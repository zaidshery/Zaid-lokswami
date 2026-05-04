'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  UploadCloud, CheckCircle2, AlertCircle, Loader2,
  Trash2, ImageOff, RefreshCw, BarChart2, Image as ImageIcon,
  Plus, Save, X, Clock,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

/* ─── Constants ────────────────────────────────────────────── */
const ELECTION_STATES = [
  { id: 'wb',         name: 'West Bengal',  totalSeats: 294 },
  { id: 'kerala',     name: 'Kerala',       totalSeats: 140 },
  { id: 'tn',         name: 'Tamil Nadu',   totalSeats: 234 },
  { id: 'assam',      name: 'Assam',        totalSeats: 126 },
  { id: 'puducherry', name: 'Puducherry',   totalSeats: 30  },
];

const PARTY_COLOR_PRESETS = [
  { label: 'BJP',  color: '#FF6B00' },
  { label: 'INC',  color: '#00A651' },
  { label: 'TMC',  color: '#45B5E4' },
  { label: 'AAP',  color: '#00A3E0' },
  { label: 'CPM',  color: '#E63946' },
  { label: 'AITC', color: '#1565C0' },
  { label: 'NCP',  color: '#8B5CF6' },
  { label: 'SP',   color: '#CC0000' },
  { label: 'Other',color: '#6B7280' },
];

type Party = { name: string; color: string; won: number; leading: number };
type StateResult = { name: string; totalSeats: number; parties: Party[] };
type ResultsData = { lastUpdated: string | null; states: Record<string, StateResult> };
type MsgMap = Record<string, { type: 'success' | 'error'; text: string }>;

/* ─── Component ─────────────────────────────────────────────── */
export default function ElectionSettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'graphics' | 'results'>('graphics');

  /* ── Graphics state ── */
  const [uploading,  setUploading]  = useState<string | null>(null);
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const [messages,   setMessages]   = useState<MsgMap>({});
  const [timestamps, setTimestamps] = useState<Record<string, number>>({});
  const [deleted,    setDeleted]    = useState<Record<string, boolean>>({});

  /* ── Results state ── */
  const [resultsData,    setResultsData]    = useState<ResultsData | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [savingResults,  setSavingResults]  = useState(false);
  const [saveMsg,        setSaveMsg]        = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeState,    setActiveState]    = useState('wb');

  /* ── Helpers ── */
  const setMsg = (id: string, type: 'success' | 'error', text: string) =>
    setMessages((p) => ({ ...p, [id]: { type, text } }));
  const clearMsg = (id: string) =>
    setMessages((p) => { const n = { ...p }; delete n[id]; return n; });

  /* ── Load results data ── */
  const loadResults = useCallback(async () => {
    setLoadingResults(true);
    try {
      const res = await fetch('/api/admin/elections/results');
      if (res.ok) setResultsData(await res.json());
    } finally {
      setLoadingResults(false);
    }
  }, []);

  useEffect(() => { if (activeTab === 'results') loadResults(); }, [activeTab, loadResults]);

  /* ── Graphics: Upload ── */
  const handleUpload = useCallback(async (stateId: string, file: File) => {
    setUploading(stateId); clearMsg(stateId);
    const form = new FormData();
    form.append('file', file); form.append('stateId', stateId);
    try {
      const res = await fetch('/api/admin/elections/upload', { method: 'POST', body: form });
      let data: Record<string, any> = {};
      try { data = await res.json(); } catch { /* ignore */ }

      if (res.status === 401) { setMsg(stateId, 'error', 'Session expired. Please login again.'); }
      else if (res.status === 413) { setMsg(stateId, 'error', 'File too large (max 10MB)'); }
      else if (!res.ok) { setMsg(stateId, 'error', data.error || `Server error (${res.status})`); }
      else if (data.success) {
        setMsg(stateId, 'success', 'Graphic updated!');
        setTimestamps((p) => ({ ...p, [stateId]: Date.now() }));
        setDeleted((p) => ({ ...p, [stateId]: false }));
        router.refresh();
      } else { setMsg(stateId, 'error', data.error || 'Upload failed'); }
    } catch { setMsg(stateId, 'error', 'Network error — check your connection'); }
    finally  { setUploading(null); }
  }, [router]);

  /* ── Graphics: Delete ── */
  const handleDelete = useCallback(async (stateId: string) => {
    const stateName = ELECTION_STATES.find(s => s.id === stateId)?.name;
    if (!confirm(`Remove the "${stateName}" graphic?`)) return;
    setDeleting(stateId); clearMsg(stateId);
    try {
      const res = await fetch('/api/admin/elections/delete', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stateId }),
      });
      let data: Record<string, any> = {};
      try { data = await res.json(); } catch { /* ignore */ }

      if (res.status === 401) { setMsg(stateId, 'error', 'Session expired.'); }
      else if (!res.ok) { setMsg(stateId, 'error', data.error || 'Delete failed'); }
      else if (data.success) {
        setMsg(stateId, 'success', 'Graphic removed.');
        setDeleted((p) => ({ ...p, [stateId]: true }));
        router.refresh();
      } else { setMsg(stateId, 'error', data.error || 'Delete failed'); }
    } catch { setMsg(stateId, 'error', 'Network error'); }
    finally  { setDeleting(null); }
  }, [router]);

  /* ── Results: Party helpers ── */
  const currentParties = (): Party[] =>
    resultsData?.states?.[activeState]?.parties ?? [];

  const updateParty = (idx: number, field: keyof Party, value: string | number) => {
    if (!resultsData) return;
    const parties = [...currentParties()];
    parties[idx] = { ...parties[idx], [field]: value };
    setResultsData({
      ...resultsData,
      states: {
        ...resultsData.states,
        [activeState]: { ...resultsData.states[activeState], parties },
      },
    });
  };

  const addParty = () => {
    if (!resultsData) return;
    const parties = [...currentParties(), { name: '', color: '#6B7280', won: 0, leading: 0 }];
    setResultsData({
      ...resultsData,
      states: {
        ...resultsData.states,
        [activeState]: { ...resultsData.states[activeState], parties },
      },
    });
  };

  const removeParty = (idx: number) => {
    if (!resultsData) return;
    const parties = currentParties().filter((_, i) => i !== idx);
    setResultsData({
      ...resultsData,
      states: {
        ...resultsData.states,
        [activeState]: { ...resultsData.states[activeState], parties },
      },
    });
  };

  /* ── Results: Save ── */
  const saveResults = async () => {
    if (!resultsData) return;
    setSavingResults(true); setSaveMsg(null);
    try {
      const res  = await fetch('/api/admin/elections/results', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resultsData),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMsg({ type: 'success', text: `Saved & live! Updated at ${new Date(data.lastUpdated).toLocaleTimeString('en-IN')}` });
        setResultsData((p) => p ? { ...p, lastUpdated: data.lastUpdated } : p);
      } else { setSaveMsg({ type: 'error', text: data.error || 'Save failed' }); }
    } catch { setSaveMsg({ type: 'error', text: 'Network error' }); }
    finally  { setSavingResults(false); }
  };

  const totalSeats = ELECTION_STATES.find(s => s.id === activeState)?.totalSeats ?? 0;
  const totalCounted = currentParties().reduce((a, p) => a + p.won + p.leading, 0);

  /* ─── Render ──────────────────────────────────────────────── */
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Elections CMS</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manage live election graphics and results data for the homepage widget.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 p-1 w-fit">
        {[
          { id: 'graphics', label: 'Graphics',     icon: ImageIcon  },
          { id: 'results',  label: 'Live Results',  icon: BarChart2  },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id as 'graphics' | 'results')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === id
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ══ TAB: GRAPHICS ═════════════════════════════════════ */}
      {activeTab === 'graphics' && (
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
              <div key={state.id} className="cnp-surface flex flex-col rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm">
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
                      src={imageUrl} alt={`${state.name} Election Graphic`}
                      className="absolute inset-0 w-full h-full object-contain"
                      onError={() => setDeleted((p) => ({ ...p, [state.id]: true }))}
                    />
                  )}
                  {isBusy && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                      <Loader2 className="w-7 h-7 text-white animate-spin" />
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="p-4 flex flex-col gap-3 min-h-[150px]">
                  <h3 className="font-semibold text-base text-zinc-900 dark:text-zinc-100">{state.name}</h3>
                  <div className="flex flex-col gap-2 mt-auto">
                    <label className={`relative flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all select-none ${
                      isBusy ? 'bg-zinc-200 text-zinc-400 dark:bg-zinc-700 dark:text-zinc-500 cursor-not-allowed'
                        : isDeleted ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-md shadow-blue-500/20'
                        : 'bg-zinc-800 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white cursor-pointer'
                    }`}>
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={isBusy}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(state.id, f); e.target.value = ''; }}
                      />
                      {isUpl ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                        : isDeleted ? <><UploadCloud className="w-4 h-4" /> Upload Graphic</>
                        : <><RefreshCw className="w-4 h-4" /> Replace Graphic</>}
                    </label>
                    {!isDeleted && (
                      <button type="button" disabled={isBusy} onClick={() => handleDelete(state.id)}
                        className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-xl text-sm font-medium border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700/60 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isDel ? <><Loader2 className="w-4 h-4 animate-spin" /> Removing…</> : <><Trash2 className="w-4 h-4" /> Remove Graphic</>}
                      </button>
                    )}
                  </div>
                  
                  {/* Message Area - Fixed height to prevent card jump */}
                  <div className="h-5 flex items-center">
                    {msg?.text && (
                      <div className={`flex items-start gap-1.5 text-xs ${msg.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {msg.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                        <span className="truncate">{msg.text}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ TAB: LIVE RESULTS ════════════════════════════════= */}
      {activeTab === 'results' && (
        <div className="space-y-5">
          {loadingResults ? (
            <div className="flex items-center justify-center py-16 gap-3 text-zinc-500">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading results data…
            </div>
          ) : (
            <>
              {/* Last updated badge */}
              {resultsData?.lastUpdated && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <Clock className="w-3.5 h-3.5" />
                  Last saved: {new Date(resultsData.lastUpdated).toLocaleString('en-IN')}
                </div>
              )}

              {/* Instructions */}
              <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800/50 dark:bg-blue-900/10 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
                📋 Copy seat counts from{' '}
                <a href="https://results.eci.gov.in/ResultAcGenMay2026/index.htm" target="_blank" rel="noreferrer"
                  className="underline font-semibold">results.eci.gov.in</a>{' '}
                and enter them below. Click <strong>Save & Go Live</strong> to update the homepage instantly.
              </div>

              {/* State tabs */}
              <div className="flex flex-wrap gap-2">
                {ELECTION_STATES.map((s) => (
                  <button key={s.id} type="button" onClick={() => setActiveState(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                      activeState === s.id
                        ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white'
                        : 'border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>

              {/* Results entry card */}
              <div className="cnp-surface rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                {/* Card header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30">
                  <div>
                    <h2 className="font-bold text-zinc-900 dark:text-zinc-100">
                      {ELECTION_STATES.find(s => s.id === activeState)?.name}
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Total seats: {totalSeats} &nbsp;|&nbsp; Counted: {totalCounted} &nbsp;|&nbsp;
                      Majority: {Math.floor(totalSeats / 2) + 1}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    totalCounted > 0
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'
                  }`}>
                    {totalCounted > 0 ? `${totalCounted}/${totalSeats} seats` : 'No data yet'}
                  </span>
                </div>

                {/* Party table */}
                <div className="p-5 space-y-3">
                  {/* Column headers */}
                  {currentParties().length > 0 && (
                    <div className="grid grid-cols-[auto_1fr_80px_80px_80px_36px] gap-2 items-center px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      <span>Color</span>
                      <span>Party</span>
                      <span className="text-center">Won</span>
                      <span className="text-center">Leading</span>
                      <span className="text-center">Total</span>
                      <span />
                    </div>
                  )}

                  {/* Party rows */}
                  {currentParties().map((party, idx) => (
                    <div key={idx} className="grid grid-cols-[auto_1fr_80px_80px_80px_36px] gap-2 items-center">
                      {/* Color swatch + picker */}
                      <div className="relative w-8 h-8 rounded-lg overflow-hidden border-2 border-zinc-200 dark:border-zinc-700 cursor-pointer shrink-0">
                        <span className="absolute inset-0" style={{ background: party.color }} />
                        <input type="color" value={party.color}
                          onChange={(e) => updateParty(idx, 'color', e.target.value)}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        />
                      </div>

                      {/* Party name + presets */}
                      <div className="flex flex-col gap-1 min-w-0">
                        <input
                          type="text" value={party.name} placeholder="Party name"
                          onChange={(e) => updateParty(idx, 'name', e.target.value)}
                          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                        <div className="flex flex-wrap gap-1">
                          {PARTY_COLOR_PRESETS.map((p) => (
                            <button key={p.label} type="button"
                              onClick={() => { updateParty(idx, 'name', p.label); updateParty(idx, 'color', p.color); }}
                              className="text-[10px] px-1.5 py-0.5 rounded font-medium border transition-colors hover:opacity-80"
                              style={{ borderColor: p.color, color: p.color, background: `${p.color}15` }}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Won */}
                      <input type="number" min={0} value={party.won}
                        onChange={(e) => updateParty(idx, 'won', Number(e.target.value))}
                        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-sm text-center text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />

                      {/* Leading */}
                      <input type="number" min={0} value={party.leading}
                        onChange={(e) => updateParty(idx, 'leading', Number(e.target.value))}
                        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-sm text-center text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />

                      {/* Total */}
                      <div className="text-center text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        {party.won + party.leading}
                      </div>

                      {/* Remove row */}
                      <button type="button" onClick={() => removeParty(idx)}
                        className="flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {/* Empty state */}
                  {currentParties().length === 0 && (
                    <div className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-600">
                      No parties added yet. Click <strong>Add Party</strong> below.
                    </div>
                  )}

                  {/* Add party */}
                  <button type="button" onClick={addParty}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add Party
                  </button>
                </div>
              </div>

              {/* Save bar */}
              <div className="flex items-center gap-3 pt-2">
                <button type="button" onClick={saveResults} disabled={savingResults}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-green-500/20"
                >
                  {savingResults
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                    : <><Save className="w-4 h-4" /> Save &amp; Go Live</>}
                </button>

                {saveMsg && (
                  <div className={`flex items-center gap-1.5 text-sm ${saveMsg.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {saveMsg.type === 'success'
                      ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                      : <AlertCircle  className="w-4 h-4 shrink-0" />}
                    {saveMsg.text}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
