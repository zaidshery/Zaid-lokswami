'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  FileText,
  Loader2,
  Newspaper,
  RefreshCcw,
  Sparkles,
  Video,
  Zap,
} from 'lucide-react';

type ContentType = 'article' | 'epaper' | 'video' | 'story';

type TrainingSummary = {
  total: number;
  trained: number;
  percent: number;
};

type TrainingStatus = Record<ContentType, TrainingSummary> & {
  overall: TrainingSummary;
};

type StatusResponse = {
  success?: boolean;
  data?: TrainingStatus | { status?: TrainingStatus };
  error?: string;
};

const EMPTY_SUMMARY: TrainingSummary = {
  total: 0,
  trained: 0,
  percent: 0,
};

const EMPTY_STATUS: TrainingStatus = {
  article: EMPTY_SUMMARY,
  epaper: EMPTY_SUMMARY,
  video: EMPTY_SUMMARY,
  story: EMPTY_SUMMARY,
  overall: EMPTY_SUMMARY,
};

const TRAINING_CARDS: Array<{
  type: ContentType;
  label: string;
  icon: typeof FileText;
  accent: string;
  bar: string;
}> = [
  {
    type: 'article',
    label: '📰 Articles',
    icon: FileText,
    accent: 'text-red-500',
    bar: 'bg-red-500',
  },
  {
    type: 'epaper',
    label: '📄 E-Papers',
    icon: Newspaper,
    accent: 'text-amber-500',
    bar: 'bg-amber-500',
  },
  {
    type: 'video',
    label: '🎬 Videos',
    icon: Video,
    accent: 'text-sky-500',
    bar: 'bg-sky-500',
  },
  {
    type: 'story',
    label: '⚡ Stories',
    icon: Zap,
    accent: 'text-purple-500',
    bar: 'bg-purple-500',
  },
];

function normalizeStatus(payload: StatusResponse): TrainingStatus {
  if (!payload.success || !payload.data) {
    return EMPTY_STATUS;
  }

  if ('overall' in payload.data) {
    return payload.data as TrainingStatus;
  }

  return payload.data.status || EMPTY_STATUS;
}

export default function AdminAiTrainingPage() {
  const [status, setStatus] = useState<TrainingStatus>(EMPTY_STATUS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [runningType, setRunningType] = useState<'all' | ContentType | ''>('');

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/ai/embed', {
        method: 'GET',
        cache: 'no-store',
      });

      const payload = (await response.json().catch(() => ({}))) as StatusResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to load AI training status.');
      }

      setStatus(normalizeStatus(payload));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Failed to load AI training status.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleTrain = useCallback(
    async (type: 'all' | ContentType) => {
      setRunningType(type);
      setError('');
      setSuccess('');

      try {
        const response = await fetch('/api/ai/embed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type,
            embedAll: true,
          }),
        });

        const payload = (await response.json().catch(() => ({}))) as StatusResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Training failed.');
        }

        setStatus(normalizeStatus(payload));
        setSuccess(
          type === 'all'
            ? 'Train Everything completed.'
            : `Training completed for ${type}.`
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error ? requestError.message : 'Training failed.'
        );
      } finally {
        setRunningType('');
      }
    },
    []
  );

  const overallLabel = useMemo(() => {
    return `${status.overall.trained}/${status.overall.total} trained`;
  }, [status.overall.total, status.overall.trained]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
                <Bot className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Lokswami AI Training</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Train embeddings and AI summaries for articles, e-papers, videos, and stories.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadStatus()}
              disabled={loading || runningType !== ''}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              Refresh
            </button>

            <button
              type="button"
              onClick={() => void handleTrain('all')}
              disabled={runningType !== '' || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#e63946,#c1121f)] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-red-500/20 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {runningType === 'all' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Train Everything
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Overall Progress</p>
              <p className="mt-1 text-sm text-gray-500">{overallLabel}</p>
            </div>
            <p className="text-lg font-bold text-gray-900">{status.overall.percent}%</p>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-[linear-gradient(135deg,#e63946,#c1121f)] transition-all"
              style={{ width: `${status.overall.percent}%` }}
            />
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {TRAINING_CARDS.map((card) => {
          const Icon = card.icon;
          const summary = status[card.type];
          const isRunning = runningType === card.type;

          return (
            <div
              key={card.type}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100 ${card.accent}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-base font-semibold text-gray-900">{card.label}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      {summary.trained}/{summary.total} trained ({summary.percent}%)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleTrain(card.type)}
                  disabled={runningType !== '' || loading}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Train All
                </button>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full rounded-full transition-all ${card.bar}`}
                  style={{ width: `${summary.percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
