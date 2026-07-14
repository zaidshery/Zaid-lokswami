'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getAuthHeader } from '@/lib/auth/clientToken';

export type ArticleDraftSaveStatus =
  | 'idle'
  | 'saving'
  | 'saved'
  | 'offline'
  | 'conflict'
  | 'error';

export type ArticleDraftPayload = Record<string, unknown>;

export type ArticleDraftRecord = {
  id: string;
  version: number;
  updatedAt: string;
  payloadSignature?: string;
};

type DraftResponsePayload = {
  success?: boolean;
  error?: string;
  code?: string;
  currentVersion?: number;
  updatedAt?: string | null;
  data?: Record<string, unknown>;
};

type UseArticleServerDraftOptions = {
  enabled: boolean;
  hasMeaningfulContent: boolean;
  payload: ArticleDraftPayload;
  debounceMs?: number;
  createIfMissing?: boolean;
  onBeforeSave?: () => void;
  onSaved?: (record: ArticleDraftRecord) => void;
};

function resolveRecord(
  value: unknown,
  fallback?: ArticleDraftRecord | null
): ArticleDraftRecord | null {
  if (!value || typeof value !== 'object') return fallback || null;
  const source = value as Record<string, unknown>;
  const id = String(source._id || source.id || fallback?.id || '').trim();
  const rawVersion = Number(source.version ?? fallback?.version ?? 1);
  if (!id) return fallback || null;
  return {
    id,
    version:
      Number.isInteger(rawVersion) && rawVersion > 0
        ? rawVersion
        : fallback?.version || 1,
    updatedAt:
      typeof source.updatedAt === 'string' && source.updatedAt
        ? source.updatedAt
        : fallback?.updatedAt || new Date().toISOString(),
  };
}

export default function useArticleServerDraft({
  enabled,
  hasMeaningfulContent,
  payload,
  debounceMs = 4000,
  createIfMissing = true,
  onBeforeSave,
  onSaved,
}: UseArticleServerDraftOptions) {
  const [record, setRecord] = useState<ArticleDraftRecord | null>(null);
  const [status, setStatus] = useState<ArticleDraftSaveStatus>('idle');
  const [message, setMessage] = useState('');
  const recordRef = useRef<ArticleDraftRecord | null>(null);
  const payloadRef = useRef(payload);
  const enabledRef = useRef(enabled);
  const hasContentRef = useRef(hasMeaningfulContent);
  const createIfMissingRef = useRef(createIfMissing);
  const inFlightRef = useRef<Promise<ArticleDraftRecord | null> | null>(null);
  const queuedRef = useRef(false);
  const conflictRef = useRef(false);
  const pausedRef = useRef(false);
  const callbacksRef = useRef({ onBeforeSave, onSaved });

  useEffect(() => {
    payloadRef.current = payload;
    enabledRef.current = enabled;
    hasContentRef.current = hasMeaningfulContent;
    createIfMissingRef.current = createIfMissing;
    callbacksRef.current = { onBeforeSave, onSaved };
  }, [createIfMissing, enabled, hasMeaningfulContent, onBeforeSave, onSaved, payload]);

  const adoptDraft = useCallback((next: ArticleDraftRecord | null) => {
    conflictRef.current = false;
    recordRef.current = next;
    setRecord(next);
    setMessage('');
    setStatus(next ? 'saved' : 'idle');
  }, []);

  const resetDraft = useCallback(() => {
    recordRef.current = null;
    queuedRef.current = false;
    conflictRef.current = false;
    setRecord(null);
    setMessage('');
    setStatus('idle');
  }, []);

  const pauseAndWait = useCallback(async () => {
    pausedRef.current = true;
    queuedRef.current = false;
    const pendingSave = inFlightRef.current;
    if (pendingSave) await pendingSave;
    return recordRef.current;
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
  }, []);

  const performSave = useCallback(async () => {
    if (pausedRef.current) {
      return inFlightRef.current || recordRef.current;
    }
    if (!enabledRef.current || !hasContentRef.current) return recordRef.current;
    if (conflictRef.current) return recordRef.current;

    if (inFlightRef.current) {
      queuedRef.current = true;
      return inFlightRef.current;
    }

    const run = async () => {
      let latestRecord = recordRef.current;
      do {
        queuedRef.current = false;
        callbacksRef.current.onBeforeSave?.();
        setStatus('saving');
        setMessage('');

        const requestPayload = payloadRef.current;
        const requestPayloadSignature = JSON.stringify(requestPayload);
        const currentRecord = recordRef.current;
        const response = await fetch(
          currentRecord
            ? `/api/admin/articles/${encodeURIComponent(currentRecord.id)}`
            : '/api/admin/articles',
          {
            method: currentRecord ? 'PATCH' : 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeader(),
            },
            body: JSON.stringify(
              currentRecord
                ? {
                    ...requestPayload,
                    autosave: true,
                    expectedVersion: currentRecord.version,
                  }
                : { ...requestPayload, intent: 'draft' }
            ),
          }
        );
        const responsePayload = (await response.json().catch(() => ({}))) as DraftResponsePayload;

        if (response.status === 404 && currentRecord) {
          if (!createIfMissingRef.current) {
            throw new Error('This article no longer exists on the server.');
          }
          recordRef.current = null;
          setRecord(null);
          queuedRef.current = true;
          continue;
        }

        if (response.status === 409 || responsePayload.code === 'ARTICLE_VERSION_CONFLICT') {
          const currentVersion = Number(responsePayload.currentVersion);
          conflictRef.current = true;
          setStatus('conflict');
          setMessage(
            Number.isInteger(currentVersion) && currentVersion > 0
              ? `Server version ${currentVersion} is newer. Open the saved draft before replacing it.`
              : responsePayload.error || 'This draft changed in another session.'
          );
          return recordRef.current;
        }

        if (!response.ok || responsePayload.success === false) {
          throw new Error(responsePayload.error || 'Draft could not be saved.');
        }

        latestRecord = resolveRecord(responsePayload.data, currentRecord);
        if (!latestRecord) throw new Error('The draft was saved without an article ID.');
        latestRecord = { ...latestRecord, payloadSignature: requestPayloadSignature };
        recordRef.current = latestRecord;
        conflictRef.current = false;
        setRecord(latestRecord);
        setStatus('saved');
        setMessage('');
        callbacksRef.current.onSaved?.(latestRecord);
      } while (queuedRef.current);

      return latestRecord;
    };

    const promise = run()
      .catch((error: unknown) => {
        const offline = typeof navigator !== 'undefined' && !navigator.onLine;
        setStatus(offline ? 'offline' : 'error');
        setMessage(
          offline
            ? 'Offline. Your emergency local copy is still available.'
            : error instanceof Error
              ? error.message
              : 'Draft could not be saved.'
        );
        return recordRef.current;
      })
      .finally(() => {
        inFlightRef.current = null;
      });

    inFlightRef.current = promise;
    return promise;
  }, []);

  const payloadSignature = JSON.stringify(payload);
  useEffect(() => {
    if (!enabled || !hasMeaningfulContent || conflictRef.current) return;
    const timeout = window.setTimeout(() => {
      void performSave();
    }, debounceMs);
    return () => window.clearTimeout(timeout);
  }, [debounceMs, enabled, hasMeaningfulContent, payloadSignature, performSave]);

  return {
    draftId: record?.id || '',
    draftVersion: record?.version || 0,
    savedAt: record?.updatedAt || '',
    status,
    message,
    saveNow: performSave,
    adoptDraft,
    resetDraft,
    pauseAndWait,
    resume,
  };
}
