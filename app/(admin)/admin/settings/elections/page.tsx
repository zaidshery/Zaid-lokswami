'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  BarChart2,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Image as ImageIcon,
  ImageOff,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  ELECTION_MODES,
  ELECTION_STATES,
  finalizeElectionResults,
  type ElectionMode,
  type ElectionParty,
  type ElectionResultsData,
} from '@/lib/elections/results';

const PARTY_COLOR_PRESETS = [
  { label: 'BJP', color: '#FF6B00' },
  { label: 'INC', color: '#00A651' },
  { label: 'TMC', color: '#45B5E4' },
  { label: 'AAP', color: '#00A3E0' },
  { label: 'CPM', color: '#E63946' },
  { label: 'AITC', color: '#1565C0' },
  { label: 'NCP', color: '#8B5CF6' },
  { label: 'SP', color: '#CC0000' },
  { label: 'Other', color: '#6B7280' },
];

type MsgMap = Record<string, { type: 'success' | 'error'; text: string }>;

function isElectionMode(value: unknown): value is ElectionMode {
  return ELECTION_MODES.includes(value as ElectionMode);
}

function activeModeLabel(mode: ElectionMode) {
  if (mode === 'live') return 'Live results';
  if (mode === 'hidden') return 'Hidden from widget';
  return 'Final archive';
}

export default function ElectionSettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'graphics' | 'results'>('graphics');
  const [uploading, setUploading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [messages, setMessages] = useState<MsgMap>({});
  const [timestamps, setTimestamps] = useState<Record<string, number>>({});
  const [deleted, setDeleted] = useState<Record<string, boolean>>({});
  const [resultsData, setResultsData] = useState<ElectionResultsData | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [savingResults, setSavingResults] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeState, setActiveState] = useState('wb');

  const activeStateConfig = useMemo(
    () => ELECTION_STATES.find((state) => state.id === activeState) || ELECTION_STATES[0],
    [activeState]
  );

  const setMsg = (id: string, type: 'success' | 'error', text: string) =>
    setMessages((previous) => ({ ...previous, [id]: { type, text } }));

  const clearMsg = (id: string) =>
    setMessages((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });

  const loadResults = useCallback(async () => {
    setLoadingResults(true);
    try {
      const response = await fetch('/api/admin/elections/results', { cache: 'no-store' });
      if (response.ok) {
        setResultsData((await response.json()) as ElectionResultsData);
      }
    } finally {
      setLoadingResults(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'results') {
      void loadResults();
    }
  }, [activeTab, loadResults]);

  const handleUpload = useCallback(
    async (stateId: string, file: File) => {
      setUploading(stateId);
      clearMsg(stateId);
      const form = new FormData();
      form.append('file', file);
      form.append('stateId', stateId);

      try {
        const response = await fetch('/api/admin/elections/upload', { method: 'POST', body: form });
        const data = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string };

        if (response.status === 401) {
          setMsg(stateId, 'error', 'Session expired. Please login again.');
        } else if (response.status === 413) {
          setMsg(stateId, 'error', 'File too large (max 10MB).');
        } else if (!response.ok || !data.success) {
          setMsg(stateId, 'error', data.error || `Upload failed (${response.status}).`);
        } else {
          setMsg(stateId, 'success', 'Graphic updated.');
          setTimestamps((previous) => ({ ...previous, [stateId]: Date.now() }));
          setDeleted((previous) => ({ ...previous, [stateId]: false }));
          router.refresh();
        }
      } catch {
        setMsg(stateId, 'error', 'Network error. Check your connection.');
      } finally {
        setUploading(null);
      }
    },
    [router]
  );

  const handleDelete = useCallback(
    async (stateId: string) => {
      const stateName = ELECTION_STATES.find((state) => state.id === stateId)?.name || stateId;
      if (!confirm(`Remove the "${stateName}" graphic?`)) return;

      setDeleting(stateId);
      clearMsg(stateId);
      try {
        const response = await fetch('/api/admin/elections/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stateId }),
        });
        const data = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string };

        if (response.status === 401) {
          setMsg(stateId, 'error', 'Session expired.');
        } else if (!response.ok || !data.success) {
          setMsg(stateId, 'error', data.error || 'Delete failed.');
        } else {
          setMsg(stateId, 'success', 'Graphic removed.');
          setDeleted((previous) => ({ ...previous, [stateId]: true }));
          router.refresh();
        }
      } catch {
        setMsg(stateId, 'error', 'Network error.');
      } finally {
        setDeleting(null);
      }
    },
    [router]
  );

  const currentParties = (): ElectionParty[] =>
    resultsData?.states?.[activeState]?.parties ?? [];

  const updateResultsMeta = <K extends keyof ElectionResultsData>(
    field: K,
    value: ElectionResultsData[K]
  ) => {
    setResultsData((current) => (current ? { ...current, [field]: value } : current));
  };

  const updateParty = (index: number, field: keyof ElectionParty, value: string | number) => {
    setResultsData((current) => {
      if (!current) return current;
      const currentState = current.states[activeState];
      if (!currentState) return current;
      const parties = currentState.parties.slice();
      parties[index] = { ...parties[index], [field]: value };
      return {
        ...current,
        states: {
          ...current.states,
          [activeState]: { ...currentState, parties },
        },
      };
    });
  };

  const addParty = () => {
    setResultsData((current) => {
      if (!current) return current;
      const currentState = current.states[activeState];
      if (!currentState) return current;
      return {
        ...current,
        states: {
          ...current.states,
          [activeState]: {
            ...currentState,
            parties: [...currentState.parties, { name: '', color: '#6B7280', won: 0, leading: 0 }],
          },
        },
      };
    });
  };

  const removeParty = (index: number) => {
    setResultsData((current) => {
      if (!current) return current;
      const currentState = current.states[activeState];
      if (!currentState) return current;
      return {
        ...current,
        states: {
          ...current.states,
          [activeState]: {
            ...currentState,
            parties: currentState.parties.filter((_, partyIndex) => partyIndex !== index),
          },
        },
      };
    });
  };

  const finalizeAllStates = () => {
    setResultsData((current) => (current ? finalizeElectionResults(current) : current));
    setSaveMsg({ type: 'success', text: 'Converted leading seats into final won seats. Save to publish this archive.' });
  };

  const saveResults = async () => {
    if (!resultsData) return;
    setSavingResults(true);
    setSaveMsg(null);
    try {
      const response = await fetch('/api/admin/elections/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resultsData),
      });
      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        lastUpdated?: string;
      };

      if (response.ok && data.success) {
        const updatedAt = data.lastUpdated || new Date().toISOString();
        setSaveMsg({
          type: 'success',
          text: `Saved ${activeModeLabel(resultsData.mode).toLowerCase()} at ${new Date(updatedAt).toLocaleTimeString('en-IN')}.`,
        });
        setResultsData((current) => (current ? { ...current, lastUpdated: updatedAt } : current));
      } else {
        setSaveMsg({ type: 'error', text: data.error || 'Save failed.' });
      }
    } catch {
      setSaveMsg({ type: 'error', text: 'Network error.' });
    } finally {
      setSavingResults(false);
    }
  };

  const totalSeats = activeStateConfig.totalSeats;
  const totalCounted = currentParties().reduce((sum, party) => sum + party.won + party.leading, 0);
  const isLiveMode = resultsData?.mode === 'live';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Elections CMS</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manage election graphics, final archives, and optional live result widgets.
        </p>
      </div>

      <div className="flex w-fit gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/60">
        {[
          { id: 'graphics', label: 'Graphics', icon: ImageIcon },
          { id: 'results', label: 'Results', icon: BarChart2 },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id as 'graphics' | 'results')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeTab === id
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'graphics' ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ELECTION_STATES.map((state) => {
            const imageUrl = `/elections/${state.id}.jpg?t=${timestamps[state.id] || 1}`;
            const isUploading = uploading === state.id;
            const isDeleting = deleting === state.id;
            const isBusy = isUploading || isDeleting;
            const isDeleted = deleted[state.id];
            const message = messages[state.id];

            return (
              <div key={state.id} className="cnp-surface flex flex-col overflow-hidden rounded-2xl border border-zinc-200 shadow-sm dark:border-zinc-800">
                <div className="relative flex aspect-video w-full items-center justify-center border-b border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
                  {isDeleted ? (
                    <div className="flex flex-col items-center justify-center gap-2 text-zinc-400 dark:text-zinc-600">
                      <ImageOff className="h-8 w-8" />
                      <span className="text-xs font-medium">No graphic uploaded</span>
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt={`${state.name} election graphic`}
                      className="absolute inset-0 h-full w-full object-contain"
                      onError={() => setDeleted((previous) => ({ ...previous, [state.id]: true }))}
                    />
                  )}
                  {isBusy ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                      <Loader2 className="h-7 w-7 animate-spin text-white" />
                    </div>
                  ) : null}
                </div>

                <div className="flex min-h-[150px] flex-col gap-3 p-4">
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{state.name}</h3>
                  <div className="mt-auto flex flex-col gap-2">
                    <label className={`relative flex w-full select-none items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                      isBusy
                        ? 'cursor-not-allowed bg-zinc-200 text-zinc-400 dark:bg-zinc-700 dark:text-zinc-500'
                        : isDeleted
                          ? 'cursor-pointer bg-blue-600 text-white shadow-md shadow-blue-500/20 hover:bg-blue-700'
                          : 'cursor-pointer bg-zinc-800 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white'
                    }`}>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={isBusy}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void handleUpload(state.id, file);
                          event.target.value = '';
                        }}
                      />
                      {isUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
                        </>
                      ) : isDeleted ? (
                        <>
                          <UploadCloud className="h-4 w-4" /> Upload Graphic
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" /> Replace Graphic
                        </>
                      )}
                    </label>
                    {!isDeleted ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleDelete(state.id)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-700/60 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        {isDeleting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Removing...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4" /> Remove Graphic
                          </>
                        )}
                      </button>
                    ) : null}
                  </div>

                  <div className="flex h-5 items-center">
                    {message?.text ? (
                      <div className={`flex items-start gap-1.5 text-xs ${message.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {message.type === 'success' ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
                        <span className="truncate">{message.text}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-5">
          {loadingResults ? (
            <div className="flex items-center justify-center gap-3 py-16 text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading results data...
            </div>
          ) : (
            <>
              {resultsData?.lastUpdated ? (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <Clock className="h-3.5 w-3.5" />
                  Last saved: {new Date(resultsData.lastUpdated).toLocaleString('en-IN')}
                </div>
              ) : null}

              {resultsData ? (
                <div className="cnp-surface grid gap-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-zinc-500">Display mode</span>
                    <select
                      value={resultsData.mode}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (isElectionMode(value)) updateResultsMeta('mode', value);
                      }}
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <option value="final">Final archive</option>
                      <option value="live">Live counting</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </label>

                  <label className="flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                    <input
                      type="checkbox"
                      checked={resultsData.homepageEnabled}
                      onChange={(event) => updateResultsMeta('homepageEnabled', event.target.checked)}
                    />
                    {resultsData.homepageEnabled ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-zinc-500" />}
                    <span className="text-sm font-medium">Show widget on homepage</span>
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-zinc-500">Widget title</span>
                    <input
                      value={resultsData.title}
                      onChange={(event) => updateResultsMeta('title', event.target.value)}
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-zinc-500">Badge</span>
                      <input
                        value={resultsData.badgeLabel}
                        onChange={(event) => updateResultsMeta('badgeLabel', event.target.value)}
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-zinc-500">Source</span>
                      <input
                        value={resultsData.sourceLabel}
                        onChange={(event) => updateResultsMeta('sourceLabel', event.target.value)}
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </label>
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-800/50 dark:bg-blue-900/10 dark:text-blue-300">
                Use <strong>Live counting</strong> during counting day. Use <strong>Final archive</strong> after results are declared. Use <strong>Hidden</strong> when the widget should disappear but data should be kept for future reference.
              </div>

              <div className="flex flex-wrap gap-2">
                {ELECTION_STATES.map((state) => (
                  <button
                    key={state.id}
                    type="button"
                    onClick={() => setActiveState(state.id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
                      activeState === state.id
                        ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                        : 'border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400'
                    }`}
                  >
                    {state.name}
                  </button>
                ))}
              </div>

              <div className="cnp-surface overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50/50 px-5 py-4 dark:border-zinc-700 dark:bg-zinc-800/30">
                  <div>
                    <h2 className="font-bold text-zinc-900 dark:text-zinc-100">{activeStateConfig.name}</h2>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      Total seats: {totalSeats} | Counted: {totalCounted} | Majority: {Math.floor(totalSeats / 2) + 1}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    totalCounted > 0
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'
                  }`}>
                    {resultsData ? activeModeLabel(resultsData.mode) : 'Loading'}
                  </span>
                </div>

                <div className="space-y-3 p-5">
                  {currentParties().length > 0 ? (
                    <div className="grid grid-cols-[auto_1fr_80px_80px_80px_36px] items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      <span>Color</span>
                      <span>Party</span>
                      <span className="text-center">Won</span>
                      <span className="text-center">Leading</span>
                      <span className="text-center">Total</span>
                      <span />
                    </div>
                  ) : null}

                  {currentParties().map((party, index) => (
                    <div key={`${party.name}-${index}`} className="grid grid-cols-[auto_1fr_80px_80px_80px_36px] items-center gap-2">
                      <div className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 border-zinc-200 dark:border-zinc-700">
                        <span className="absolute inset-0" style={{ background: party.color }} />
                        <input
                          type="color"
                          value={party.color}
                          onChange={(event) => updateParty(index, 'color', event.target.value)}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />
                      </div>

                      <div className="flex min-w-0 flex-col gap-1">
                        <input
                          type="text"
                          value={party.name}
                          placeholder="Party name"
                          onChange={(event) => updateParty(index, 'name', event.target.value)}
                          className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                        <div className="flex flex-wrap gap-1">
                          {PARTY_COLOR_PRESETS.map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => {
                                updateParty(index, 'name', preset.label);
                                updateParty(index, 'color', preset.color);
                              }}
                              className="rounded border px-1.5 py-0.5 text-[10px] font-medium transition-opacity hover:opacity-80"
                              style={{ borderColor: preset.color, color: preset.color, background: `${preset.color}15` }}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <input
                        type="number"
                        min={0}
                        value={party.won}
                        onChange={(event) => updateParty(index, 'won', Number(event.target.value))}
                        className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-center text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                      <input
                        type="number"
                        min={0}
                        value={party.leading}
                        disabled={!isLiveMode}
                        onChange={(event) => updateParty(index, 'leading', Number(event.target.value))}
                        className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-center text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:disabled:bg-zinc-900"
                      />
                      <div className="text-center text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        {party.won + party.leading}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeParty(index)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}

                  {currentParties().length === 0 ? (
                    <div className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-600">
                      No parties added yet. Click <strong>Add Party</strong> below.
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={addParty}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                  >
                    <Plus className="h-4 w-4" /> Add Party
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={finalizeAllStates}
                  disabled={!resultsData}
                  className="flex items-center gap-2 rounded-xl border border-emerald-300 px-5 py-2.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
                >
                  <CheckCircle2 className="h-4 w-4" /> Finalize Leads
                </button>
                <button
                  type="button"
                  onClick={saveResults}
                  disabled={savingResults || !resultsData}
                  className="flex items-center gap-2 rounded-xl bg-green-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-green-500/20 transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingResults ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" /> Save Results
                    </>
                  )}
                </button>

                {saveMsg ? (
                  <div className={`flex items-center gap-1.5 text-sm ${saveMsg.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {saveMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                    {saveMsg.text}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
