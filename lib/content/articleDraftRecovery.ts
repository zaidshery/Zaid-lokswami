const EDITOR_SESSION_SUFFIX = ':editor-session';

function createEditorSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `editor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getArticleDraftEditorSessionStorageKey(draftStorageKey: string) {
  return `${draftStorageKey}${EDITOR_SESSION_SUFFIX}`;
}

export function getOrCreateArticleDraftEditorSessionId(
  draftStorageKey: string,
  storage?: Pick<Storage, 'getItem' | 'setItem'>
) {
  const targetStorage = storage ?? (typeof window !== 'undefined' ? window.sessionStorage : null);
  if (!targetStorage) return '';

  const key = getArticleDraftEditorSessionStorageKey(draftStorageKey);
  const existing = targetStorage.getItem(key)?.trim();
  if (existing) return existing;

  const created = createEditorSessionId();
  targetStorage.setItem(key, created);
  return created;
}

export function isCurrentArticleDraftEditorSession(
  storedSessionId: unknown,
  currentSessionId: string
) {
  return Boolean(
    currentSessionId &&
      typeof storedSessionId === 'string' &&
      storedSessionId.trim() === currentSessionId
  );
}
