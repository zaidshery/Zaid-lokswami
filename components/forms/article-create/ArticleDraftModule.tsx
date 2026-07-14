'use client';

type ArticleDraftModuleProps = {
  active: boolean;
  debounceSeconds: number;
  savedAtLabel: string;
  statusLabel: string;
  draftId: string;
  draftVersion: number;
  message: string;
  restored: boolean;
  onSave: () => void;
  onDiscardRecovery: () => void;
};

export default function ArticleDraftModule({
  active,
  debounceSeconds,
  savedAtLabel,
  statusLabel,
  draftId,
  draftVersion,
  message,
  restored,
  onSave,
  onDiscardRecovery,
}: ArticleDraftModuleProps) {
  return (
    <div id="article-inspector-publish-draft" role="region" aria-label="Draft safety and recovery" className={active ? 'space-y-4' : 'hidden'}>
      <details open className="rounded-xl border border-blue-100 bg-blue-50 text-sm text-blue-900">
        <summary className="cursor-pointer px-4 py-3 font-medium">Draft safety & recovery</summary>
        <div className="border-t border-blue-100 p-4 pt-3">
          <p className="mt-1 text-blue-800">
            Server autosave runs {debounceSeconds} seconds after changes. A browser copy is kept as emergency fallback.
            {savedAtLabel ? ` Last saved: ${savedAtLabel}.` : ' No draft yet.'}
          </p>
          <p className="mt-1 text-xs text-blue-700" aria-live="polite">
            {statusLabel}
            {draftId ? ` · Draft ${draftId.slice(0, 8)} · version ${draftVersion}` : ''}
            {message ? ` · ${message}` : ''}
          </p>
          {restored ? <p className="mt-1 text-blue-800">Draft restored from local storage.</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={onSave} className="rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100">
              Save draft now
            </button>
            <button type="button" onClick={onDiscardRecovery} className="rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100">
              Discard recovery copy
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}
