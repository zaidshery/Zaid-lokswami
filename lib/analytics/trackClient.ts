'use client';

const ANALYTICS_SESSION_KEY = 'lokswami_analytics_session_id';

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

function createSessionId() {
  const random = Math.random().toString(36).slice(2, 12);
  return `sess_${Date.now().toString(36)}${random}`;
}

function getSessionId() {
  if (typeof window === 'undefined') return '';

  try {
    const current = window.localStorage.getItem(ANALYTICS_SESSION_KEY);
    if (current) return current;

    const generated = createSessionId();
    window.localStorage.setItem(ANALYTICS_SESSION_KEY, generated);
    return generated;
  } catch {
    return createSessionId();
  }
}

function trackGoogleTagManagerEvent(payload: {
  event: string;
  page: string;
  source: string;
  sessionId: string;
  metadata: Record<string, unknown>;
}) {
  if (typeof window === 'undefined') return;

  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: payload.event,
      lokswami_page: payload.page,
      lokswami_source: payload.source,
      lokswami_session_id: payload.sessionId,
      lokswami_metadata: payload.metadata,
    });
  } catch {
    // no-op
  }
}

type TrackClientEventInput = {
  event: string;
  page?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

export function trackClientEvent(input: TrackClientEventInput) {
  if (typeof window === 'undefined') return;

  const event = String(input.event || '').trim().toLowerCase();
  if (!event) return;

  const payload = {
    event,
    page: String(input.page || window.location.pathname).slice(0, 200),
    source: String(input.source || 'web').slice(0, 80),
    sessionId: getSessionId(),
    metadata: input.metadata || {},
  };

  trackGoogleTagManagerEvent(payload);

  const raw = JSON.stringify(payload);

  try {
    if (typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([raw], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics/track', blob);
      return;
    }
  } catch {
    // no-op
  }

  void fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw,
    keepalive: true,
  }).catch(() => undefined);
}
