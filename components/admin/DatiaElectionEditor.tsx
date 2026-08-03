'use client';
/* eslint-disable @next/next/no-img-element */

import { useState } from 'react';
import { AlertTriangle, Eye, EyeOff, Image as ImageIcon, Loader2, Plus, Save, Trash2, UploadCloud, X } from 'lucide-react';
import {
  FEATURED_ELECTION_STATUSES,
  type ElectionResultsData,
  type FeaturedElectionCandidate,
  type FeaturedElectionContest,
  type FeaturedElectionStatus,
} from '@/lib/elections/results';
import { uploadElectionImage } from '@/lib/utils/electionImageUpload';

type EditorMessage = { type: 'success' | 'error'; text: string } | null;

const inputClass = 'mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none focus:border-red-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';
const labelClass = 'block text-xs font-semibold text-zinc-600 dark:text-zinc-300';

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function ElectionImageField({
  label,
  value,
  uploading,
  onSelect,
  onRemove,
  kind,
}: {
  label: string;
  value: string;
  uploading: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
  kind: 'background' | 'portrait' | 'symbol';
}) {
  const spec = {
    background: {
      dimensions: '1600 × 900 px',
      ratio: '16:9 landscape',
      guidance: 'Keep important faces or symbols near the centre; the public dashboard crops this image responsively.',
      fit: 'object-cover',
    },
    portrait: {
      dimensions: '800 × 800 px',
      ratio: '1:1 square',
      guidance: 'Use a clear, natural head-and-shoulders photo with the face centred and space above the head.',
      fit: 'object-cover object-top',
    },
    symbol: {
      dimensions: '512 × 512 px',
      ratio: '1:1 square',
      guidance: 'Use an official party or election symbol. Transparent PNG or WEBP gives the cleanest result.',
      fit: 'object-contain p-3',
    },
  }[kind];
  const isBackground = kind === 'background';

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100">{label}</span>
        <span className="rounded-md bg-zinc-100 px-2 py-1 text-[10px] font-black text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
          {spec.dimensions} · {spec.ratio}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-4 text-zinc-500">{spec.guidance}</p>
      <div className={isBackground ? 'mt-3' : 'mt-3 flex items-center gap-3'}>
        <div className={`relative shrink-0 overflow-hidden rounded-lg border border-dashed border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 ${isBackground ? 'aspect-[16/6] w-full' : 'h-28 w-28'}`}>
          {value ? (
            <img src={value} alt={`${label} preview`} className={`h-full w-full ${spec.fit}`} />
          ) : (
            <div className="flex h-full min-h-28 flex-col items-center justify-center gap-2 text-zinc-400">
              <ImageIcon className="h-7 w-7" />
              <span className="text-[10px] font-semibold">No image uploaded</span>
            </div>
          )}
          {uploading ? <div className="absolute inset-0 flex items-center justify-center bg-black/60"><Loader2 className="h-6 w-6 animate-spin text-white" /></div> : null}
        </div>
        <div className={`${isBackground ? 'mt-3 flex flex-wrap items-center gap-2' : 'min-w-0 flex-1'}`}>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
              <UploadCloud className="h-3.5 w-3.5" />{value ? 'Replace image' : 'Upload image'}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) onSelect(file); }} />
            </label>
            {value ? <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30"><X className="h-3.5 w-3.5" />Remove</button> : null}
          </div>
          <p className={`${isBackground ? 'ml-auto' : 'mt-2'} text-[10px] font-medium text-zinc-500`}>JPG, PNG or WEBP · Maximum 5MB</p>
        </div>
      </div>
    </div>
  );
}

export default function DatiaElectionEditor({
  data,
  onChange,
  onSave,
  saving,
  message,
}: {
  data: ElectionResultsData;
  onChange: (data: ElectionResultsData) => void;
  onSave: () => void;
  saving: boolean;
  message: EditorMessage;
}) {
  const contest = data.featuredContest;
  const [uploadingAsset, setUploadingAsset] = useState('');
  const [imageError, setImageError] = useState('');

  const update = <Key extends keyof FeaturedElectionContest>(key: Key, value: FeaturedElectionContest[Key]) => {
    onChange({ ...data, featuredContest: { ...contest, [key]: value } });
  };

  const updateCandidate = <Key extends keyof FeaturedElectionCandidate>(index: number, key: Key, value: FeaturedElectionCandidate[Key]) => {
    const candidates = contest.candidates.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, [key]: value } : candidate);
    update('candidates', candidates);
  };

  const uploadImage = async (key: string, file: File, applyUrl: (url: string) => void) => {
    setUploadingAsset(key);
    setImageError('');
    try {
      applyUrl(await uploadElectionImage(file));
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'Image upload failed.');
    } finally {
      setUploadingAsset('');
    }
  };

  const addCandidate = () => {
    update('candidates', [
      ...contest.candidates,
      { id: `candidate-${Date.now()}`, name: '', party: '', color: '#6B7280', votes: null, statusLabel: '', voteNote: '', photoUrl: '', symbolUrl: '' },
    ]);
  };

  const removeCandidate = (index: number) => {
    const removedId = contest.candidates[index]?.id;
    const candidates = contest.candidates.filter((_, candidateIndex) => candidateIndex !== index);
    onChange({
      ...data,
      featuredContest: {
        ...contest,
        candidates,
        leaderCandidateId: removedId === contest.leaderCandidateId ? candidates[0]?.id || '' : contest.leaderCandidateId,
      },
    });
  };

  const storyFields: Array<{ key: keyof FeaturedElectionContest; label: string; help: string }> = [
    { key: 'whyElection', label: 'Why the by-election was required', help: 'Explain the vacancy and use attributed, legally precise wording.' },
    { key: 'previousResult', label: 'Previous result', help: 'Give readers the relevant historical comparison.' },
    { key: 'candidateContext', label: 'Candidate context', help: 'Summarise the main field without campaign language.' },
    { key: 'politicalImportance', label: 'Political importance', help: 'Explain what the result tests for each side.' },
    { key: 'controversy', label: 'Controversy / security response', help: 'Present allegations and the official response together.' },
    { key: 'bottomLine', label: 'Bottom line', help: 'State clearly whether this is a trend or final result.' },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-500/20 dark:bg-amber-500/[0.08] dark:text-amber-100">
        <div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div><p className="font-bold">Live result publishing rule</p><p className="mt-1 text-xs leading-5 opacity-80">Keep the page in Live mode until an official declaration. Enter the verification time and source for every counting update.</p></div></div>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><h2 className="text-lg font-black text-zinc-950 dark:text-white">Publication & status</h2><p className="mt-1 text-xs text-zinc-500">Controls the public Elections page.</p></div>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
            <input type="checkbox" checked={contest.enabled} onChange={(event) => update('enabled', event.target.checked)} />
            {contest.enabled ? <Eye className="h-4 w-4 text-emerald-600" /> : <EyeOff className="h-4 w-4 text-zinc-500" />}
            <span className="text-sm font-bold">{contest.enabled ? 'Page published' : 'Coverage hidden'}</span>
          </label>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className={labelClass}>Coverage status<select value={contest.status} onChange={(event) => update('status', event.target.value as FeaturedElectionStatus)} className={inputClass}>{FEATURED_ELECTION_STATUSES.map((status) => <option key={status} value={status}>{status === 'live' ? 'Live counting' : status === 'final' ? 'Final result' : 'Scheduled'}</option>)}</select></label>
          <label className={labelClass}>Verification time<input value={contest.lastVerifiedLabel} onChange={(event) => update('lastVerifiedLabel', event.target.value)} className={inputClass} /></label>
          <label className={labelClass}>Source label<input value={contest.sourceLabel} onChange={(event) => update('sourceLabel', event.target.value)} className={inputClass} /></label>
          <label className={`${labelClass} md:col-span-3`}>Official/source URL<input type="url" value={contest.sourceUrl} onChange={(event) => update('sourceUrl', event.target.value)} placeholder="https://results.eci.gov.in/" className={inputClass} /></label>
          <label className={`${labelClass} md:col-span-3`}>Verification disclaimer<textarea rows={2} value={contest.verificationNote} onChange={(event) => update('verificationNote', event.target.value)} className={inputClass} /></label>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-zinc-950 dark:text-white">Broadcast media & headline</h2>
            <p className="mt-1 text-xs text-zinc-500">Controls the large image and headline shown on the public election dashboard and OBS view.</p>
          </div>
          <span className="rounded-full bg-red-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-red-600 dark:bg-red-500/10">Public + OBS</span>
        </div>
        <div className="mt-4">
          <ElectionImageField label="Election background image" value={contest.backgroundImageUrl} uploading={uploadingAsset === 'background'} kind="background" onSelect={(file) => void uploadImage('background', file, (url) => update('backgroundImageUrl', url))} onRemove={() => update('backgroundImageUrl', '')} />
        </div>
        {imageError ? <p className="mt-3 text-sm font-semibold text-red-600">{imageError}</p> : null}
        <div className="mt-6 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <h3 className="text-base font-black text-zinc-950 dark:text-white">Headline and location</h3>
          <p className="mt-1 text-xs text-zinc-500">Keep the headline concise so it remains readable in the wide dashboard layout.</p>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className={labelClass}>Hindi live label<input value={contest.liveLabelHi} onChange={(event) => update('liveLabelHi', event.target.value)} className={inputClass} /></label>
          <label className={labelClass}>Eyebrow<input value={contest.eyebrow} onChange={(event) => update('eyebrow', event.target.value)} className={inputClass} /></label>
          <label className={labelClass}>Election type<input value={contest.electionType} onChange={(event) => update('electionType', event.target.value)} className={inputClass} /></label>
          <label className={`${labelClass} md:col-span-2`}>Headline<input value={contest.title} onChange={(event) => update('title', event.target.value)} className={inputClass} /></label>
          <label className={`${labelClass} md:col-span-2`}>Summary<textarea rows={3} value={contest.summary} onChange={(event) => update('summary', event.target.value)} className={inputClass} /></label>
          <label className={labelClass}>Constituency number<input value={contest.constituencyNumber} onChange={(event) => update('constituencyNumber', event.target.value)} className={inputClass} /></label>
          <label className={labelClass}>Constituency name<input value={contest.constituencyName} onChange={(event) => update('constituencyName', event.target.value)} className={inputClass} /></label>
          <label className={labelClass}>State<input value={contest.stateName} onChange={(event) => update('stateName', event.target.value)} className={inputClass} /></label>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-black text-zinc-950 dark:text-white">Counting dashboard</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className={labelClass}>Rounds completed<input type="number" min="0" max={contest.totalRounds} value={contest.roundsCompleted} onChange={(event) => update('roundsCompleted', numberValue(event.target.value))} className={inputClass} /></label>
          <label className={labelClass}>Total rounds<input type="number" min="1" value={contest.totalRounds} onChange={(event) => update('totalRounds', numberValue(event.target.value))} className={inputClass} /></label>
          <label className={labelClass}>Lead margin<input type="number" min="0" value={contest.leadMargin} onChange={(event) => update('leadMargin', numberValue(event.target.value))} className={inputClass} /></label>
          <label className={labelClass}>Turnout %<input type="number" min="0" max="100" step="0.01" value={contest.turnoutPercent} onChange={(event) => update('turnoutPercent', numberValue(event.target.value))} className={inputClass} /></label>
          <label className={labelClass}>Votes cast<input type="number" min="0" value={contest.votesCast} onChange={(event) => update('votesCast', numberValue(event.target.value))} className={inputClass} /></label>
          <label className={labelClass}>Total electors<input type="number" min="0" value={contest.totalElectors} onChange={(event) => update('totalElectors', numberValue(event.target.value))} className={inputClass} /></label>
          <label className={labelClass}>Candidates<input type="number" min="0" value={contest.candidateCount} onChange={(event) => update('candidateCount', numberValue(event.target.value))} className={inputClass} /></label>
          <label className={labelClass}>Poll date<input value={contest.pollDate} onChange={(event) => update('pollDate', event.target.value)} className={inputClass} /></label>
          <label className={labelClass}>Counting date<input value={contest.countingDate} onChange={(event) => update('countingDate', event.target.value)} className={inputClass} /></label>
          <label className={labelClass}>Counting start<input value={contest.countingStartTime} onChange={(event) => update('countingStartTime', event.target.value)} className={inputClass} /></label>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-zinc-950 dark:text-white">Candidate tracker</h2>
            <p className="mt-1 text-xs text-zinc-500">Add the three key candidates, upload newsroom-approved assets and select the current leader.</p>
          </div>
          <button type="button" onClick={addCandidate} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-sm font-bold hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"><Plus className="h-4 w-4" />Add candidate</button>
        </div>
        <div className="mt-4 grid gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-[11px] text-blue-950 dark:border-blue-500/20 dark:bg-blue-500/[0.08] dark:text-blue-100 sm:grid-cols-2">
          <p><strong>Candidate photo:</strong> 800 × 800 px, square, face centred.</p>
          <p><strong>Party symbol:</strong> 512 × 512 px, preferably transparent.</p>
        </div>
        <div className="mt-4 space-y-4">
          {contest.candidates.map((candidate, index) => (
            <div key={candidate.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-black text-white dark:bg-zinc-100 dark:text-zinc-900">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-zinc-950 dark:text-white">{candidate.name || `Candidate ${index + 1}`}</p>
                    <p className="truncate text-[11px] text-zinc-500">{candidate.party || 'Party not entered'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${contest.leaderCandidateId === candidate.id ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300'}`}>
                    <input type="radio" name="election-leader" checked={contest.leaderCandidateId === candidate.id} onChange={() => update('leaderCandidateId', candidate.id)} />
                    {contest.leaderCandidateId === candidate.id ? 'Current leader' : 'Set as leader'}
                  </label>
                  <button type="button" onClick={() => removeCandidate(index)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30" aria-label={`Delete ${candidate.name || `candidate ${index + 1}`}`}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>

              <div className="grid gap-3 p-4 lg:grid-cols-2">
                <ElectionImageField label="Natural candidate photo" value={candidate.photoUrl} uploading={uploadingAsset === `candidate-${index}`} kind="portrait" onSelect={(file) => void uploadImage(`candidate-${index}`, file, (url) => updateCandidate(index, 'photoUrl', url))} onRemove={() => updateCandidate(index, 'photoUrl', '')} />
                <ElectionImageField label="Party / election symbol" value={candidate.symbolUrl} uploading={uploadingAsset === `symbol-${index}`} kind="symbol" onSelect={(file) => void uploadImage(`symbol-${index}`, file, (url) => updateCandidate(index, 'symbolUrl', url))} onRemove={() => updateCandidate(index, 'symbolUrl', '')} />
              </div>

              <div className="grid gap-3 border-t border-zinc-200 p-4 dark:border-zinc-800 md:grid-cols-2 lg:grid-cols-4">
                <label className={labelClass}>Candidate name<input value={candidate.name} onChange={(event) => updateCandidate(index, 'name', event.target.value)} className={inputClass} /></label>
                <label className={labelClass}>Party<input value={candidate.party} onChange={(event) => updateCandidate(index, 'party', event.target.value)} className={inputClass} /></label>
                <label className={labelClass}>Status label<input value={candidate.statusLabel} onChange={(event) => updateCandidate(index, 'statusLabel', event.target.value)} className={inputClass} /></label>
                <label className={labelClass}>Reported votes<input type="number" min="0" value={candidate.votes ?? ''} onChange={(event) => updateCandidate(index, 'votes', event.target.value === '' ? null : numberValue(event.target.value))} placeholder="Optional" className={inputClass} /></label>
                <label className={`${labelClass} lg:col-span-3`}>Vote note<input value={candidate.voteNote} onChange={(event) => updateCandidate(index, 'voteNote', event.target.value)} className={inputClass} /></label>
                <label className={labelClass}>Dashboard colour<input type="color" value={candidate.color} onChange={(event) => updateCandidate(index, 'color', event.target.value)} className="mt-1 h-[42px] w-full rounded-xl border border-zinc-300 bg-transparent p-1 dark:border-zinc-700" aria-label={`${candidate.name || 'Candidate'} dashboard colour`} /></label>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-black text-zinc-950 dark:text-white">Explainer sections</h2>
        <div className="mt-4 space-y-4">
          {storyFields.map((field) => <label key={field.key} className={labelClass}>{field.label}<span className="ml-2 font-normal text-zinc-400">{field.help}</span><textarea rows={3} value={String(contest[field.key] || '')} onChange={(event) => update(field.key, event.target.value as never)} className={inputClass} /></label>)}
        </div>
      </section>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white/95 p-3 shadow-xl backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <button type="button" onClick={onSave} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Publishing...' : 'Save & publish election page'}</button>
        {message ? <p className={`text-sm font-semibold ${message.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>{message.text}</p> : null}
      </div>
    </div>
  );
}
