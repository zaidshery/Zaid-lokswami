'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, BarChart3, CheckCircle2, Loader2 } from 'lucide-react';
import type { PollDTO, PollStatusDTO } from '@/lib/types/poll';
import { useAppStore } from '@/lib/store/appStore';
import { cn } from '@/lib/utils/cn';

const POLL_LOCAL_STORAGE_PREFIX = 'lokswami_poll_vote';

type StoredPollVote = {
  pollId: string;
  selectedOptionIndex: number;
  votedAt: string;
};

function pollStorageKey(pollId: string) {
  return `${POLL_LOCAL_STORAGE_PREFIX}:${pollId}`;
}

function readStoredVote(pollId: string): StoredPollVote | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(pollStorageKey(pollId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredPollVote>;
    if (
      parsed &&
      parsed.pollId === pollId &&
      typeof parsed.selectedOptionIndex === 'number' &&
      parsed.selectedOptionIndex >= 0
    ) {
      return {
        pollId,
        selectedOptionIndex: parsed.selectedOptionIndex,
        votedAt: typeof parsed.votedAt === 'string' ? parsed.votedAt : '',
      };
    }
  } catch {
    // Ignore malformed local storage values and fall back to server truth.
  }

  return null;
}

function writeStoredVote(pollId: string, selectedOptionIndex: number) {
  if (typeof window === 'undefined') {
    return;
  }

  const payload: StoredPollVote = {
    pollId,
    selectedOptionIndex,
    votedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(pollStorageKey(pollId), JSON.stringify(payload));
}

function clearStoredVote(pollId: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(pollStorageKey(pollId));
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function buildCopy(language: 'hi' | 'en') {
  if (language === 'hi') {
    return {
      eyebrow: 'लाइव पोल',
      support: 'इस खबर पर अपना वोट दें और तुरंत नतीजे देखें।',
      vote: 'वोट करें',
      totalVotes: 'कुल वोट',
      selected: 'आपका चयन',
      retry: 'फिर से कोशिश करें',
      pickOption: 'एक विकल्प चुनें',
      fetchError: 'पोल अभी लोड नहीं हो सका।',
      voteError: 'वोट अभी दर्ज नहीं हो सका।',
      statusError: 'पोल स्थिति रीफ्रेश नहीं हो सकी।',
      results: 'रिजल्ट',
      activeNow: 'अभी सक्रिय',
      thanks: 'वोट के लिए धन्यवाद',
      votesLabel: 'वोट',
    } as const;
  }

  return {
    eyebrow: 'Live Poll',
    support: 'Vote on this story and see the live results right away.',
    vote: 'Vote Now',
    totalVotes: 'Total votes',
    selected: 'Your choice',
    retry: 'Try again',
    pickOption: 'Select one option',
    fetchError: 'The poll could not be loaded right now.',
    voteError: 'Your vote could not be submitted right now.',
    statusError: 'The poll status could not be refreshed.',
    results: 'Results',
    activeNow: 'Active now',
    thanks: 'Thanks for voting',
    votesLabel: 'votes',
  } as const;
}

function PollSkeleton() {
  return (
    <div className="cnp-surface overflow-hidden p-4">
      <div className="animate-pulse space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="h-5 w-24 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-5 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <div className="h-6 w-4/5 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-full rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-zinc-200/70 bg-white/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/50"
          >
            <div className="h-4 w-3/4 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          </div>
        ))}
        <div className="h-11 w-full rounded-full bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}

export default function NewsPoll() {
  const { language } = useAppStore();
  const copy = buildCopy(language);
  const [poll, setPoll] = useState<PollDTO | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadPoll = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');

      try {
        const currentResponse = await fetch('/api/poll/current', {
          cache: 'no-store',
          signal,
        });
        const currentPayload = (await currentResponse.json().catch(() => ({}))) as {
          success?: boolean;
          error?: string;
          data?: PollDTO | null;
        };

        if (!currentResponse.ok || !currentPayload.success) {
          throw new Error(currentPayload.error || copy.fetchError);
        }

        const currentPoll = currentPayload.data || null;
        if (signal?.aborted) {
          return;
        }

        setPoll(currentPoll);

        if (!currentPoll) {
          setHasVoted(false);
          setSelectedOption(null);
          return;
        }

        const storedVote = readStoredVote(currentPoll.id);
        if (storedVote) {
          setHasVoted(true);
          setSelectedOption(storedVote.selectedOptionIndex);
        } else {
          setHasVoted(false);
          setSelectedOption(null);
        }

        try {
          const statusResponse = await fetch(
            `/api/poll/status?pollId=${encodeURIComponent(currentPoll.id)}`,
            {
              cache: 'no-store',
              signal,
            }
          );
          const statusPayload = (await statusResponse.json().catch(() => ({}))) as {
            success?: boolean;
            error?: string;
            data?: PollStatusDTO;
          };

          if (!statusResponse.ok || !statusPayload.success) {
            throw new Error(statusPayload.error || copy.statusError);
          }

          if (signal?.aborted) {
            return;
          }

          const status = statusPayload.data;
          const nextHasVoted = Boolean(status?.hasVoted);
          const nextSelectedOption =
            typeof status?.selectedOptionIndex === 'number'
              ? status.selectedOptionIndex
              : storedVote?.selectedOptionIndex ?? null;

          setHasVoted(nextHasVoted);
          setSelectedOption(nextSelectedOption);

          if (nextHasVoted && nextSelectedOption !== null) {
            writeStoredVote(currentPoll.id, nextSelectedOption);
          } else {
            clearStoredVote(currentPoll.id);
          }
        } catch (statusError) {
          if (!signal?.aborted) {
            setError(toErrorMessage(statusError, copy.statusError));
          }
        }
      } catch (loadError) {
        if (!signal?.aborted) {
          setPoll(null);
          setHasVoted(false);
          setSelectedOption(null);
          setError(toErrorMessage(loadError, copy.fetchError));
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [copy.fetchError, copy.statusError]
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadPoll(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadPoll]);

  const submitVote = async () => {
    if (!poll || selectedOption === null || submitting) {
      return;
    }

    const optionIndex = selectedOption;
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/poll/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pollId: poll.id,
          optionIndex,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        data?: PollDTO;
      };

      if (!response.ok || !payload.success || !payload.data) {
        if (response.status === 404 || response.status === 409) {
          await loadPoll();
          return;
        }

        throw new Error(payload.error || copy.voteError);
      }

      setPoll(payload.data);
      setHasVoted(true);
      setSelectedOption(optionIndex);
      writeStoredVote(payload.data.id, optionIndex);
    } catch (voteError) {
      setError(toErrorMessage(voteError, copy.voteError));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <PollSkeleton />;
  }

  if (!poll) {
    if (!error) {
      return null;
    }

    return (
      <div className="cnp-surface overflow-hidden border border-red-500/15 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-red-500/10 p-2 text-red-500">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{error}</p>
            <button
              type="button"
              onClick={() => void loadPoll()}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-500/5 dark:text-red-300"
            >
              {copy.retry}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[1.6rem] border border-red-500/15 bg-[linear-gradient(160deg,rgba(255,255,255,0.96)_0%,rgba(255,247,237,0.94)_100%)] p-4 shadow-[0_24px_55px_rgba(15,23,42,0.12)] dark:border-red-500/15 dark:bg-[linear-gradient(160deg,rgba(24,24,27,0.96)_0%,rgba(17,24,39,0.98)_100%)]"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,#ef4444_0%,#f97316_52%,#fde68a_100%)]" />
      <div className="pointer-events-none absolute -right-10 top-10 h-28 w-28 rounded-full bg-red-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-8 bottom-0 h-24 w-24 rounded-full bg-orange-400/10 blur-3xl" />

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-red-500/15 bg-red-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-red-600 dark:text-red-300">
            <BarChart3 className="h-3.5 w-3.5" />
            {copy.eyebrow}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-orange-400/20 bg-white/70 px-2.5 py-1 text-[10px] font-semibold text-zinc-600 dark:bg-white/5 dark:text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
            {hasVoted ? copy.results : copy.activeNow}
          </span>
        </div>

        <div className="mt-4">
          <h3 className="text-[1.1rem] font-black leading-tight text-zinc-950 dark:text-zinc-50">
            {poll.question}
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            {hasVoted ? copy.thanks : copy.support}
          </p>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
            {error}
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {poll.options.map((option, index) => {
            const isSelected = selectedOption === index;

            if (hasVoted) {
              return (
                <div
                  key={`${option.text}-${index}`}
                  className={cn(
                    'rounded-2xl border p-3',
                    isSelected
                      ? 'border-red-500/20 bg-red-500/5'
                      : 'border-zinc-200/80 bg-white/70 dark:border-zinc-800 dark:bg-zinc-900/50'
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {isSelected ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-red-500" />
                      ) : (
                        <span className="h-4 w-4 shrink-0 rounded-full border border-zinc-300 dark:border-zinc-700" />
                      )}
                      <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {option.text}
                      </span>
                    </div>
                    <span className="text-sm font-black text-zinc-900 dark:text-zinc-100">
                      {option.percentage}%
                    </span>
                  </div>

                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${option.percentage}%` }}
                      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                      className={cn(
                        'h-full rounded-full',
                        isSelected ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-zinc-500/70'
                      )}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                    <span>
                      {option.votes} {copy.votesLabel}
                    </span>
                    {isSelected ? <span>{copy.selected}</span> : null}
                  </div>
                </div>
              );
            }

            return (
              <label
                key={`${option.text}-${index}`}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 transition-all',
                  isSelected
                    ? 'border-red-500/25 bg-red-500/5'
                    : 'border-zinc-200/80 bg-white/70 hover:border-red-300/50 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-red-500/30'
                )}
              >
                <input
                  type="radio"
                  name="news-poll-option"
                  value={index}
                  checked={isSelected}
                  onChange={() => setSelectedOption(index)}
                  className="mt-1 h-4 w-4 border-zinc-300 text-red-500 focus:ring-red-400"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-6 text-zinc-900 dark:text-zinc-100">
                    {option.text}
                  </p>
                </div>
              </label>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {copy.totalVotes}:{' '}
            <span className="font-bold text-zinc-900 dark:text-zinc-100">{poll.totalVotes}</span>
          </div>
          <button
            type="button"
            disabled={hasVoted || submitting}
            onClick={() => {
              if (selectedOption === null) {
                setError(copy.pickOption);
                return;
              }

              void submitVote();
            }}
            className="inline-flex min-w-[9rem] items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#ef4444_0%,#f97316_100%)] px-5 py-2.5 text-sm font-bold text-white shadow-[0_16px_30px_rgba(239,68,68,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {copy.vote}
          </button>
        </div>
      </div>
    </motion.section>
  );
}

