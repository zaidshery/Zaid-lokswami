'use client';

import { useCallback, useEffect, useState } from 'react';

type SurfaceKey = 'breaking' | 'article' | 'epaper';

type SurfaceConfig = {
  enabled: boolean;
  autoGenerate: boolean;
  defaultLanguageCode: string;
  defaultVoice: string;
};

type SettingsPayload = {
  config: {
    regenerateMissingFiles: boolean;
    retentionDays: number;
    forceStorage: boolean;
    surfaces: Record<SurfaceKey, SurfaceConfig>;
    prewarm: {
      latestBreakingLimit: number;
      latestArticleLimit: number;
      latestEpaperStoryLimit: number;
    };
  };
  runtime: {
    configured: boolean;
    provider: string;
    model: string;
    defaultVoice: string;
    maxCharacters: number;
    supportedLanguages: Array<{ code: string; label: string }>;
    voices: Array<{ id: string; label: string }>;
    env: {
      geminiApiKeyConfigured: boolean;
      digitalOceanSpacesConfigured: boolean;
      storageMode: string;
      forceStorageEnv: boolean;
      storageUploadsBaseDir: string;
    };
  };
};

type SettingsResponse = {
  success?: boolean;
  data?: SettingsPayload;
  error?: string;
};

type PrewarmResponse = {
  success?: boolean;
  data?: {
    result?: Record<string, { processed: number; ready: number; failed: number }>;
  };
  error?: string;
};

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(' ');
}

const PANEL_CLASS =
  'rounded-[32px] border border-zinc-200/80 bg-white/92 p-8 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.38)] dark:border-white/10 dark:bg-zinc-950/60';

const FIELD_CLASS =
  'mt-2 w-full rounded-2xl border border-zinc-300/90 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-red-300 focus:ring-2 focus:ring-red-200/60 dark:border-white/10 dark:bg-zinc-950/70 dark:text-zinc-100 dark:focus:border-red-500/40 dark:focus:ring-red-500/20';

const SURFACE_LABELS: Record<SurfaceKey, string> = {
  breaking: 'Breaking ticker',
  article: 'Article listen',
  epaper: 'E-paper story',
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export default function TtsSettingsPanel() {
  const [payload, setPayload] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prewarming, setPrewarming] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [prewarmSummary, setPrewarmSummary] = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/tts/settings', { cache: 'no-store' });
      const data = (await response.json().catch(() => ({}))) as SettingsResponse;
      if (!response.ok || !data.success || !data.data) {
        throw new Error(data.error || 'Failed to load TTS settings.');
      }
      setPayload(data.data);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Failed to load TTS settings.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const updateSurface = useCallback(
    (surface: SurfaceKey, patch: Partial<SurfaceConfig>) => {
      setPayload((current) =>
        current
          ? {
              ...current,
              config: {
                ...current.config,
                surfaces: {
                  ...current.config.surfaces,
                  [surface]: {
                    ...current.config.surfaces[surface],
                    ...patch,
                  },
                },
              },
            }
          : current
      );
    },
    []
  );

  const updatePrewarm = useCallback(
    (key: 'latestBreakingLimit' | 'latestArticleLimit' | 'latestEpaperStoryLimit', value: string) => {
      setPayload((current) =>
        current
          ? {
              ...current,
              config: {
                ...current.config,
                prewarm: {
                  ...current.config.prewarm,
                  [key]: Number.parseInt(value || '0', 10) || 0,
                },
              },
            }
          : current
      );
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!payload) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/admin/tts/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload.config),
      });
      const data = (await response.json().catch(() => ({}))) as SettingsResponse;
      if (!response.ok || !data.success || !data.data) {
        throw new Error(data.error || 'Failed to update TTS settings.');
      }
      setPayload(data.data);
      setSuccess('TTS settings updated.');
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Failed to update TTS settings.'));
    } finally {
      setSaving(false);
    }
  }, [payload]);

  const handlePrewarm = useCallback(async (scope: 'all' | 'breaking' | 'article' | 'epaper') => {
    setPrewarming(true);
    setError('');
    setSuccess('');
    setPrewarmSummary('');

    try {
      const response = await fetch('/api/admin/tts/prewarm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, forceRegenerate: false }),
      });
      const data = (await response.json().catch(() => ({}))) as PrewarmResponse;
      if (!response.ok || !data.success || !data.data?.result) {
        throw new Error(data.error || 'Failed to prewarm TTS assets.');
      }

      const summary = Object.entries(data.data.result)
        .map(([key, value]) => `${key}: ${value.ready}/${value.processed} ready, ${value.failed} failed`)
        .join(' | ');
      setPrewarmSummary(summary);
      setSuccess('TTS prewarm completed.');
      void loadSettings();
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Failed to prewarm TTS assets.'));
    } finally {
      setPrewarming(false);
    }
  }, [loadSettings]);

  if (loading && !payload) {
    return (
      <div className={PANEL_CLASS}>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading TTS settings...</p>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className={PANEL_CLASS}>
        <p className="text-sm text-red-600 dark:text-red-400">
          {error || 'Unable to load TTS settings.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={PANEL_CLASS}>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-600 dark:text-red-400">
          Global TTS
        </p>
        <h1 className="mt-2 text-3xl font-black text-zinc-900 dark:text-zinc-100">
          TTS Settings
        </h1>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Control default behavior for breaking news, articles, and e-paper story audio.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-zinc-200/80 bg-zinc-50/95 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Runtime
            </p>
            <p className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {payload.runtime.configured ? 'Configured' : 'Missing Gemini'}
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {payload.runtime.provider} | {payload.runtime.model}
            </p>
          </div>

          <div className="rounded-[24px] border border-zinc-200/80 bg-zinc-50/95 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Storage
            </p>
            <p className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {payload.runtime.env.storageMode}
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {payload.runtime.env.digitalOceanSpacesConfigured
                ? 'DigitalOcean Spaces configured'
                : payload.runtime.env.storageUploadsBaseDir}
            </p>
          </div>

          <div className="rounded-[24px] border border-zinc-200/80 bg-zinc-50/95 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Limits
            </p>
            <p className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {payload.runtime.maxCharacters} chars
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Default voice: {payload.runtime.defaultVoice}
            </p>
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
            {success}
          </p>
        ) : null}

        {prewarmSummary ? (
          <p className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
            {prewarmSummary}
          </p>
        ) : null}
      </div>

      <div className={PANEL_CLASS}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="rounded-[24px] border border-zinc-200/80 bg-zinc-50/95 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Retention days
            </span>
            <input
              type="number"
              min={1}
              max={3650}
              value={payload.config.retentionDays}
              onChange={(event) =>
                setPayload((current) =>
                  current
                    ? {
                        ...current,
                        config: {
                          ...current.config,
                          retentionDays: Number.parseInt(event.target.value || '1', 10) || 1,
                        },
                      }
                    : current
                )
              }
              className={FIELD_CLASS}
            />
          </label>

          <label className="rounded-[24px] border border-zinc-200/80 bg-zinc-50/95 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Breaking prewarm
            </span>
            <input
              type="number"
              min={0}
              max={1000}
              value={payload.config.prewarm.latestBreakingLimit}
              onChange={(event) => updatePrewarm('latestBreakingLimit', event.target.value)}
              className={FIELD_CLASS}
            />
          </label>

          <label className="rounded-[24px] border border-zinc-200/80 bg-zinc-50/95 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Article prewarm
            </span>
            <input
              type="number"
              min={0}
              max={1000}
              value={payload.config.prewarm.latestArticleLimit}
              onChange={(event) => updatePrewarm('latestArticleLimit', event.target.value)}
              className={FIELD_CLASS}
            />
          </label>

          <label className="rounded-[24px] border border-zinc-200/80 bg-zinc-50/95 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              E-paper prewarm
            </span>
            <input
              type="number"
              min={0}
              max={5000}
              value={payload.config.prewarm.latestEpaperStoryLimit}
              onChange={(event) => updatePrewarm('latestEpaperStoryLimit', event.target.value)}
              className={FIELD_CLASS}
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex items-start gap-3 rounded-[24px] border border-zinc-200/80 bg-zinc-50/95 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
            <input
              type="checkbox"
              checked={payload.config.regenerateMissingFiles}
              onChange={(event) =>
                setPayload((current) =>
                  current
                    ? {
                        ...current,
                        config: {
                          ...current.config,
                          regenerateMissingFiles: event.target.checked,
                        },
                      }
                    : current
                )
              }
              className="mt-1 h-4 w-4 rounded border-zinc-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              Re-generate missing assets when they are detected.
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-[24px] border border-zinc-200/80 bg-zinc-50/95 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
            <input
              type="checkbox"
              checked={payload.config.forceStorage}
              onChange={(event) =>
                setPayload((current) =>
                  current
                    ? {
                        ...current,
                        config: {
                          ...current.config,
                          forceStorage: event.target.checked,
                        },
                      }
                    : current
                )
              }
              className="mt-1 h-4 w-4 rounded border-zinc-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              Force durable storage for generated audio.
            </span>
          </label>
        </div>
      </div>

      <div className={PANEL_CLASS}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">Prewarm Audio</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Generate missing reusable audio for the latest breaking headlines, articles, and e-paper stories before readers tap Listen.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['article', 'breaking', 'epaper', 'all'] as const).map((scope) => (
              <button
                key={scope}
                type="button"
                onClick={() => void handlePrewarm(scope)}
                disabled={prewarming || !payload.runtime.configured}
                className="rounded-2xl border border-zinc-200/80 bg-white/85 px-4 py-2.5 text-sm font-semibold capitalize text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
              >
                {prewarming ? 'Running...' : `Prewarm ${scope}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={PANEL_CLASS}>
        <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">Surface defaults</h2>
        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          {(['breaking', 'article', 'epaper'] as SurfaceKey[]).map((surface) => (
            <div
              key={surface}
              className="rounded-[24px] border border-zinc-200/80 bg-zinc-50/95 p-5 shadow-sm dark:border-white/10 dark:bg-white/5"
            >
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {SURFACE_LABELS[surface]}
              </h3>

              <div className="mt-4 space-y-4">
                <label className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={payload.config.surfaces[surface].enabled}
                    onChange={(event) =>
                      updateSurface(surface, { enabled: event.target.checked })
                    }
                    className="h-4 w-4 rounded border-zinc-300 text-red-600 focus:ring-red-500"
                  />
                  Enable public TTS
                </label>

                <label className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={surface === 'article' ? false : payload.config.surfaces[surface].autoGenerate}
                    disabled={surface === 'article'}
                    onChange={(event) => {
                      if (surface === 'article') return;
                      updateSurface(surface, { autoGenerate: event.target.checked });
                    }}
                    className="h-4 w-4 rounded border-zinc-300 text-red-600 focus:ring-red-500 disabled:opacity-50"
                  />
                  {surface === 'article' ? 'Manual upload only' : 'Auto-generate by default'}
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Language
                  </span>
                  <select
                    value={payload.config.surfaces[surface].defaultLanguageCode}
                    onChange={(event) =>
                      updateSurface(surface, { defaultLanguageCode: event.target.value })
                    }
                    className={FIELD_CLASS}
                  >
                    {payload.runtime.supportedLanguages.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Voice
                  </span>
                  <select
                    value={payload.config.surfaces[surface].defaultVoice}
                    onChange={(event) =>
                      updateSurface(surface, { defaultVoice: event.target.value })
                    }
                    className={FIELD_CLASS}
                  >
                    {payload.runtime.voices.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => void loadSettings()}
            disabled={loading || saving}
            className="rounded-2xl border border-zinc-200/80 bg-white/85 px-4 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-xl bg-[linear-gradient(135deg,#e63946,#c1121f)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save TTS settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
