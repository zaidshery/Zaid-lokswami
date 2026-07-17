'use client';

import { FileAudio, Loader2, Sparkles, Upload, Volume2, X } from 'lucide-react';
import type { ArticleEditorialMeta } from '@/lib/content/articleEditorial';
import { WORKFLOW_PRIORITIES, type WorkflowPriority } from '@/lib/workflow/types';

type WorkflowIntent = 'submit' | 'publish' | 'schedule';
type TeamMember = { id: string; name: string; role: string };

type ArticlePublishModuleProps = {
  active: boolean;
  busy: boolean;
  isBreaking: boolean;
  isTrending: boolean;
  majorUpdateNote: string;
  editorial: ArticleEditorialMeta;
  onTextChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onEditorialChange: <Key extends keyof ArticleEditorialMeta>(key: Key, value: ArticleEditorialMeta[Key]) => void;
  breakingRecordingScript: string;
  breakingAudioAccept: string;
  breakingAudioFile: File | null;
  breakingAudioSizeLabel: string;
  breakingAudioPreviewUrl: string;
  breakingAudioStored: boolean;
  breakingAudioValidationError: string;
  onBreakingAudioChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClearBreakingAudio: () => void;
  onUseTrendingSignal: () => void;
  trendingSignalLoading: boolean;
  trendingSignalStatus: string;
  workflowIntent: WorkflowIntent;
  onWorkflowIntentChange: (value: WorkflowIntent) => void;
  canPublishImmediately: boolean;
  scheduledFor: string;
  onScheduledForChange: (value: string) => void;
  priority: WorkflowPriority;
  onPriorityChange: (value: WorkflowPriority) => void;
  dueAt: string;
  onDueAtChange: (value: string) => void;
  assigneeId: string;
  onAssigneeChange: (value: string) => void;
  teamOptions: TeamMember[];
  teamOptionsError: string;
};

const fieldClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-spanish-red focus:outline-none';

export default function ArticlePublishModule(props: ArticlePublishModuleProps) {
  return (
    <div id="article-inspector-publish" role="tabpanel" className={props.active ? 'space-y-4' : 'hidden'}>
      <details open className="rounded-xl border border-gray-200 bg-gray-50">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">Homepage placement & article flags</summary>
        <div className="space-y-3 border-t border-gray-200 p-4">
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" name="isBreaking" checked={props.isBreaking} onChange={props.onTextChange} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-spanish-red focus:ring-spanish-red" /><span><span className="block text-sm font-semibold text-gray-900">Breaking News / Live Updates</span><span className="mt-0.5 block text-xs leading-5 text-gray-600">Shows this story first in the homepage Live Updates rail and enables the breaking-news banner. Unused slots are filled with the latest published stories.</span></span></label>
          </div>
          {props.isBreaking ? (
            <div className="space-y-3">
              <div className="grid gap-3 rounded-lg border border-red-200 bg-red-50/50 p-3">
                <label className="block space-y-1.5"><span className="text-xs font-semibold uppercase tracking-wide text-red-700">Breaking reason</span><textarea value={props.editorial.breakingReason} onChange={(event) => props.onEditorialChange('breakingReason', event.target.value)} rows={2} maxLength={500} placeholder="Why does this story require a breaking banner?" className={fieldClass} /></label>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <label className="block space-y-1.5"><span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Starts at</span><input type="datetime-local" value={props.editorial.breakingStartsAt} onChange={(event) => props.onEditorialChange('breakingStartsAt', event.target.value)} className={fieldClass} /></label>
                  <label className="block space-y-1.5"><span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Expires at</span><input type="datetime-local" value={props.editorial.breakingExpiresAt} onChange={(event) => props.onEditorialChange('breakingExpiresAt', event.target.value)} className={fieldClass} /></label>
                </div>
                <p className="text-xs text-gray-600">The server records the logged-in approver when this flag is saved and removes the flag after expiry.</p>
              </div>
              <div data-article-field="breakingAudio" className="space-y-3 rounded-lg border border-red-200 bg-white p-3">
                <div className="flex items-start gap-3"><div className="rounded-lg bg-red-50 p-2 text-spanish-red"><Volume2 className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-gray-900">Breaking News Audio</p><span className="rounded-full border border-spanish-red/30 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-spanish-red">Required before publish</span></div><p className="mt-1 text-xs leading-5 text-gray-600">Record the script below exactly, then upload MP3, WAV, or M4A.</p></div></div>
                <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Recording Script</p><div className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm leading-6 text-gray-900">{props.breakingRecordingScript}</div></div>
                {props.breakingAudioFile ? <div className="rounded-lg border border-gray-200 bg-gray-50 p-3"><div className="flex items-start gap-3"><FileAudio className="mt-0.5 h-4 w-4 shrink-0 text-spanish-red" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-900">{props.breakingAudioFile.name}</p><p className="mt-1 text-xs text-gray-500">{props.breakingAudioSizeLabel}{props.breakingAudioValidationError ? ' | Needs replacement' : ' | Ready to attach after article creation'}</p></div><button type="button" onClick={props.onClearBreakingAudio} className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-white" aria-label="Remove breaking news audio"><X className="h-3.5 w-3.5" /></button></div>{props.breakingAudioPreviewUrl ? <audio controls preload="metadata" src={props.breakingAudioPreviewUrl} className="mt-3 w-full" /> : null}</div> : null}
                {props.breakingAudioStored ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">Breaking audio is attached to this server draft.</p> : null}
                {props.breakingAudioValidationError ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{props.breakingAudioValidationError}</p> : null}
                <div className="flex flex-wrap gap-2"><label className={`inline-flex items-center gap-2 rounded-md border border-spanish-red bg-white px-3 py-2 text-xs font-semibold text-spanish-red hover:bg-red-50 ${props.busy ? 'pointer-events-none cursor-not-allowed opacity-60' : 'cursor-pointer'}`}><Upload className="h-4 w-4" />{props.breakingAudioFile || props.breakingAudioStored ? 'Replace Breaking Audio' : 'Upload Breaking Audio'}<input type="file" accept={props.breakingAudioAccept} disabled={props.busy} onChange={props.onBreakingAudioChange} className="sr-only" /></label>{props.breakingAudioFile ? <button type="button" onClick={props.onClearBreakingAudio} disabled={props.busy} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"><X className="h-4 w-4" />Remove</button> : null}</div>
              </div>
            </div>
          ) : null}
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" name="isTrending" checked={props.isTrending} onChange={props.onTextChange} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-spanish-red focus:ring-spanish-red" /><span><span className="block text-sm font-semibold text-gray-900">Feature in Popular News</span><span className="mt-0.5 block text-xs leading-5 text-gray-600">Pins this story near the top of the homepage Popular News rail until its expiry. Remaining slots use published stories with the strongest view counts.</span></span></label>
          </div>
          {props.isTrending ? (
            <div className="grid gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
              <label className="block space-y-1.5"><span className="text-xs font-semibold uppercase tracking-wide text-amber-800">Trending reason</span><textarea value={props.editorial.trendingReason} onChange={(event) => props.onEditorialChange('trendingReason', event.target.value)} rows={2} maxLength={500} placeholder="Cite the traffic, search, social, or editorial signal." className={fieldClass} /></label>
              <label className="block space-y-1.5"><span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Trending expires at</span><input type="datetime-local" value={props.editorial.trendingExpiresAt} onChange={(event) => props.onEditorialChange('trendingExpiresAt', event.target.value)} className={fieldClass} /></label>
              <p className="text-xs text-gray-600">Add the observable signal; the server records who approved the flag and removes it after expiry.</p>
              <button type="button" onClick={props.onUseTrendingSignal} disabled={props.trendingSignalLoading} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60">{props.trendingSignalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Use 7-day audience signal</button>
              {props.trendingSignalStatus ? <p className="text-xs text-amber-800" aria-live="polite">{props.trendingSignalStatus}</p> : null}
            </div>
          ) : null}
        </div>
      </details>
      <details open className="rounded-xl border border-gray-200 bg-gray-50">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">Workflow & publication</summary>
        <div className="space-y-3 border-t border-gray-200 p-4 text-sm text-gray-700">
          <p>Timezone: Asia/Calcutta</p>
          <label className="block space-y-1.5"><span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Final action</span><select value={props.workflowIntent} onChange={(event) => props.onWorkflowIntentChange(event.target.value as WorkflowIntent)} className={fieldClass}><option value="submit">Submit for review</option>{props.canPublishImmediately ? <option value="publish">Publish now</option> : null}{props.canPublishImmediately ? <option value="schedule">Schedule publication</option> : null}</select></label>
          {props.workflowIntent === 'schedule' ? <label className="block space-y-1.5"><span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Publish at</span><input type="datetime-local" value={props.scheduledFor} onChange={(event) => props.onScheduledForChange(event.target.value)} className={fieldClass} required /></label> : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <label className="block space-y-1.5"><span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Priority</span><select value={props.priority} onChange={(event) => props.onPriorityChange(event.target.value as WorkflowPriority)} className={fieldClass}>{WORKFLOW_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</option>)}</select></label>
            <label className="block space-y-1.5"><span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Editorial deadline</span><input type="datetime-local" value={props.dueAt} onChange={(event) => props.onDueAtChange(event.target.value)} className={fieldClass} /></label>
          </div>
          {props.canPublishImmediately && props.workflowIntent === 'submit' ? <label className="block space-y-1.5"><span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Assign editor after submit</span><select value={props.assigneeId} onChange={(event) => props.onAssigneeChange(event.target.value)} className={fieldClass}><option value="">Leave in shared review queue</option>{props.teamOptions.filter((member) => member.role === 'copy_editor' || member.role === 'admin').map((member) => <option key={member.id} value={member.id}>{member.name} ({member.role.replace(/_/g, ' ')})</option>)}</select>{props.teamOptionsError ? <span className="block text-xs text-amber-700">{props.teamOptionsError}</span> : null}</label> : null}
          <textarea name="majorUpdateNote" value={props.majorUpdateNote} onChange={props.onTextChange} placeholder="Major update note (optional)" rows={2} maxLength={240} className={fieldClass} />
        </div>
      </details>
    </div>
  );
}
