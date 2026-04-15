'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Link2,
  Loader2,
  Pencil,
  PieChart,
  Plus,
  RefreshCw,
  Save,
  X,
} from 'lucide-react';
import type { AdminPollPayload, PollDTO, PollStatus } from '@/lib/types/poll';
import { formatUiDateTime } from '@/lib/utils/dateFormat';

type PublishedArticleOption = {
  _id: string;
  title: string;
  category?: string;
};

type PollFormState = {
  question: string;
  options: string[];
  status: PollStatus;
  expiresAt: string;
  linkedArticleId: string;
};

const PANEL_CLASS = 'admin-shell-surface-strong rounded-[30px] p-6';
const METRIC_CARD_CLASS =
  'admin-shell-surface rounded-[26px] p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.16)]';
const INPUT_CLASS =
  'w-full rounded-2xl border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface)] px-4 py-3 text-sm text-[color:var(--admin-shell-text)] outline-none transition-colors placeholder:text-[color:var(--admin-shell-text-muted)] focus:border-red-400/40';
const SECONDARY_BUTTON_CLASS =
  'admin-shell-toolbar-btn inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold';
const PRIMARY_BUTTON_CLASS =
  'inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70';

const EMPTY_FORM: PollFormState = {
  question: '',
  options: ['', ''],
  status: 'inactive',
  expiresAt: '',
  linkedArticleId: '',
};

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function formatDateTimeInput(value: string | null) {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function mapPollToForm(poll: PollDTO): PollFormState {
  return {
    question: poll.question,
    options: poll.options.map((option) => option.text),
    status: poll.status,
    expiresAt: formatDateTimeInput(poll.expiresAt),
    linkedArticleId: poll.linkedArticleId || '',
  };
}

function toAdminPayload(form: PollFormState): AdminPollPayload {
  return {
    question: form.question.trim(),
    options: form.options.map((option) => option.trim()).filter(Boolean),
    status: form.status,
    expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    linkedArticleId: form.linkedArticleId.trim() || null,
  };
}

function buildArticleLabel(article: PublishedArticleOption) {
  return article.category ? `${article.title} (${article.category})` : article.title;
}

function statusTone(status: PollStatus, isExpired: boolean) {
  if (isExpired) {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
  }

  return status === 'active'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
    : 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300';
}

export default function PollManagementClient() {
  const [polls, setPolls] = useState<PollDTO[]>([]);
  const [articles, setArticles] = useState<PublishedArticleOption[]>([]);
  const [form, setForm] = useState<PollFormState>(EMPTY_FORM);
  const [editingPollId, setEditingPollId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyPollId, setBusyPollId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const editingPoll = useMemo(
    () => polls.find((poll) => poll.id === editingPollId) || null,
    [editingPollId, polls]
  );
  const articlesById = useMemo(
    () => new Map(articles.map((article) => [article._id, article])),
    [articles]
  );
  const summary = useMemo(
    () => ({
      total: polls.length,
      active: polls.filter((poll) => poll.status === 'active' && !poll.isExpired).length,
      totalVotes: polls.reduce((sum, poll) => sum + poll.totalVotes, 0),
    }),
    [polls]
  );
  const isStructureLocked = Boolean(editingPoll && editingPoll.totalVotes > 0);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [pollsResponse, articlesResponse] = await Promise.all([
        fetch('/api/admin/polls', { cache: 'no-store' }),
        fetch('/api/admin/articles?limit=all&workflowStatus=published', {
          cache: 'no-store',
        }),
      ]);

      const pollsPayload = (await pollsResponse.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        data?: PollDTO[];
      };
      const articlesPayload = (await articlesResponse.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        data?: PublishedArticleOption[];
      };

      if (!pollsResponse.ok || !pollsPayload.success) {
        throw new Error(pollsPayload.error || 'Failed to load polls');
      }

      if (!articlesResponse.ok || !articlesPayload.success) {
        throw new Error(articlesPayload.error || 'Failed to load published articles');
      }

      setPolls(Array.isArray(pollsPayload.data) ? pollsPayload.data : []);
      setArticles(
        Array.isArray(articlesPayload.data)
          ? articlesPayload.data.map((article) => ({
              _id: String(article._id || ''),
              title: String(article.title || '').trim(),
              category: typeof article.category === 'string' ? article.category : '',
            }))
          : []
      );
    } catch (loadError) {
      setError(toErrorMessage(loadError, 'Failed to load poll management data.'));
      setPolls([]);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!success) {
      return;
    }

    const timeout = window.setTimeout(() => setSuccess(''), 2600);
    return () => window.clearTimeout(timeout);
  }, [success]);

  const resetForm = () => {
    setEditingPollId(null);
    setForm(EMPTY_FORM);
  };

  const handleOptionChange = (index: number, value: string) => {
    setForm((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) =>
        optionIndex === index ? value : option
      ),
    }));
  };

  const addOption = () => {
    setForm((current) =>
      current.options.length >= 4
        ? current
        : {
            ...current,
            options: [...current.options, ''],
          }
    );
  };

  const removeOption = (index: number) => {
    setForm((current) => {
      if (current.options.length <= 2) {
        return current;
      }

      return {
        ...current,
        options: current.options.filter((_, optionIndex) => optionIndex !== index),
      };
    });
  };

  const populateForEdit = (poll: PollDTO) => {
    setEditingPollId(poll.id);
    setForm(mapPollToForm(poll));
    setError('');
    setSuccess('');
  };

  const savePoll = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(
        editingPollId ? `/api/admin/polls/${editingPollId}` : '/api/admin/polls',
        {
          method: editingPollId ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(toAdminPayload(form)),
        }
      );
      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save poll');
      }

      await loadData();
      resetForm();
      setSuccess(editingPollId ? 'Poll updated.' : 'Poll created.');
    } catch (saveError) {
      setError(toErrorMessage(saveError, 'Failed to save poll.'));
    } finally {
      setSaving(false);
    }
  };

  const togglePollStatus = async (poll: PollDTO) => {
    setBusyPollId(poll.id);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/admin/polls/${poll.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: poll.question,
          options: poll.options.map((option) => option.text),
          status: poll.status === 'active' ? 'inactive' : 'active',
          expiresAt: poll.expiresAt,
          linkedArticleId: poll.linkedArticleId,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update poll status');
      }

      await loadData();
      setSuccess(
        poll.status === 'active' ? 'Poll deactivated.' : 'Poll activated and made live.'
      );
    } catch (statusError) {
      setError(toErrorMessage(statusError, 'Failed to update poll status.'));
    } finally {
      setBusyPollId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[color:var(--admin-shell-text)]">
            Poll Management
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--admin-shell-text-muted)]">
            Create homepage polls, control the single live slot, and monitor voting engagement
            without leaving the newsroom console.
          </p>
        </div>

        <button type="button" onClick={() => void loadData()} className={SECONDARY_BUTTON_CLASS}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className={METRIC_CARD_CLASS}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-shell-text-muted)]">
            Total Polls
          </p>
          <p className="mt-4 text-4xl font-black tracking-tight text-[color:var(--admin-shell-text)]">
            {summary.total}
          </p>
          <p className="mt-3 text-sm text-[color:var(--admin-shell-text-muted)]">
            Polls created across the editorial desk.
          </p>
        </div>
        <div className={METRIC_CARD_CLASS}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-shell-text-muted)]">
            Live Polls
          </p>
          <p className="mt-4 text-4xl font-black tracking-tight text-emerald-500">
            {summary.active}
          </p>
          <p className="mt-3 text-sm text-[color:var(--admin-shell-text-muted)]">
            Only one poll can be live on the homepage at a time.
          </p>
        </div>
        <div className={METRIC_CARD_CLASS}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-shell-text-muted)]">
            Total Votes
          </p>
          <p className="mt-4 text-4xl font-black tracking-tight text-[color:var(--admin-shell-text)]">
            {summary.totalVotes}
          </p>
          <p className="mt-3 text-sm text-[color:var(--admin-shell-text-muted)]">
            Combined engagement across all saved polls.
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-300">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          {success}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.35fr)]">
        <section className={PANEL_CLASS}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-shell-text-muted)]">
                {editingPollId ? 'Edit Poll' : 'Create Poll'}
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-[color:var(--admin-shell-text)]">
                {editingPollId ? 'Update the selected poll' : 'Launch a new homepage poll'}
              </h2>
            </div>
            {editingPollId ? (
              <button type="button" onClick={resetForm} className={SECONDARY_BUTTON_CLASS}>
                <X className="h-4 w-4" />
                Cancel
              </button>
            ) : null}
          </div>

          {isStructureLocked ? (
            <div className="mt-4 rounded-[24px] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-700 dark:text-amber-300">
              This poll already has votes, so its question and options are locked to preserve result
              integrity. You can still update status, expiry, and linked article.
            </div>
          ) : null}

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[color:var(--admin-shell-text)]">
                Question
              </span>
              <textarea
                value={form.question}
                onChange={(event) =>
                  setForm((current) => ({ ...current, question: event.target.value }))
                }
                rows={4}
                disabled={isStructureLocked}
                placeholder="क्या आप इस फैसले से सहमत हैं?"
                className={INPUT_CLASS}
              />
            </label>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-[color:var(--admin-shell-text)]">
                  Options
                </span>
                {!isStructureLocked ? (
                  <button
                    type="button"
                    onClick={addOption}
                    disabled={form.options.length >= 4}
                    className={SECONDARY_BUTTON_CLASS}
                  >
                    <Plus className="h-4 w-4" />
                    Add Option
                  </button>
                ) : null}
              </div>
              <div className="space-y-3">
                {form.options.map((option, index) => (
                  <div key={`poll-option-${index}`} className="flex items-center gap-3">
                    <input
                      type="text"
                      value={option}
                      disabled={isStructureLocked}
                      onChange={(event) => handleOptionChange(index, event.target.value)}
                      placeholder={`Option ${index + 1}`}
                      className={INPUT_CLASS}
                    />
                    {!isStructureLocked ? (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        disabled={form.options.length <= 2}
                        className={SECONDARY_BUTTON_CLASS}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[color:var(--admin-shell-text)]">
                  Status
                </span>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value === 'active' ? 'active' : 'inactive',
                    }))
                  }
                  className={INPUT_CLASS}
                >
                  <option value="inactive">Inactive</option>
                  <option value="active">Active</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[color:var(--admin-shell-text)]">
                  Expiry
                </span>
                <input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, expiresAt: event.target.value }))
                  }
                  className={INPUT_CLASS}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[color:var(--admin-shell-text)]">
                Linked Article
              </span>
              <select
                value={form.linkedArticleId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, linkedArticleId: event.target.value }))
                }
                className={INPUT_CLASS}
              >
                <option value="">No linked article</option>
                {articles.map((article) => (
                  <option key={article._id} value={article._id}>
                    {buildArticleLabel(article)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void savePoll()}
              disabled={saving}
              className={PRIMARY_BUTTON_CLASS}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingPollId ? 'Save Changes' : 'Create Poll'}
            </button>
            <div className="text-sm text-[color:var(--admin-shell-text-muted)]">
              Setting a poll to active automatically removes the current live poll from the homepage
              slot.
            </div>
          </div>
        </section>

        <section className={PANEL_CLASS}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-shell-text-muted)]">
                Poll Library
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-[color:var(--admin-shell-text)]">
                Recent polls and result history
              </h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface)] px-3 py-2 text-xs font-semibold text-[color:var(--admin-shell-text-muted)]">
              <PieChart className="h-4 w-4" />
              {polls.length} stored
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-7 w-7 animate-spin text-red-500" />
            </div>
          ) : polls.length === 0 ? (
            <div className="mt-6 rounded-[24px] border border-dashed border-[color:var(--admin-shell-border-strong)] bg-[color:var(--admin-shell-surface-muted)] px-5 py-12 text-center text-sm text-[color:var(--admin-shell-text-muted)]">
              No polls have been created yet.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {polls.map((poll, index) => {
                const linkedArticle = poll.linkedArticleId
                  ? articlesById.get(poll.linkedArticleId) || null
                  : null;
                const isBusy = busyPollId === poll.id;

                return (
                  <motion.article
                    key={poll.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: index * 0.04 }}
                    className="admin-shell-surface rounded-[28px] border border-[color:var(--admin-shell-border)] p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(
                              poll.status,
                              poll.isExpired
                            )}`}
                          >
                            {poll.isExpired
                              ? 'Expired'
                              : poll.status === 'active'
                                ? 'Active'
                                : 'Inactive'}
                          </span>
                          <span className="text-xs font-medium text-[color:var(--admin-shell-text-muted)]">
                            Created {formatUiDateTime(poll.createdAt, poll.createdAt)}
                          </span>
                        </div>
                        <h3 className="mt-3 text-lg font-black leading-7 text-[color:var(--admin-shell-text)]">
                          {poll.question}
                        </h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => populateForEdit(poll)}
                          className={SECONDARY_BUTTON_CLASS}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void togglePollStatus(poll)}
                          disabled={isBusy}
                          className={PRIMARY_BUTTON_CLASS}
                        >
                          {isBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : poll.status === 'active' ? (
                            <X className="h-4 w-4" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          {poll.status === 'active' ? 'Deactivate' : 'Make Live'}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="rounded-[22px] border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface-muted)] p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--admin-shell-text)]">
                          <BarChart3 className="h-4 w-4 text-red-500" />
                          Votes
                        </div>
                        <p className="mt-3 text-2xl font-black text-[color:var(--admin-shell-text)]">
                          {poll.totalVotes}
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface-muted)] p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--admin-shell-text)]">
                          <CalendarClock className="h-4 w-4 text-orange-500" />
                          Expiry
                        </div>
                        <p className="mt-3 text-sm font-medium text-[color:var(--admin-shell-text)]">
                          {poll.expiresAt
                            ? formatUiDateTime(poll.expiresAt, poll.expiresAt)
                            : 'No expiry'}
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface-muted)] p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--admin-shell-text)]">
                          <Link2 className="h-4 w-4 text-blue-500" />
                          Linked Article
                        </div>
                        <p className="mt-3 text-sm font-medium text-[color:var(--admin-shell-text)]">
                          {linkedArticle ? buildArticleLabel(linkedArticle) : 'Not linked'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {poll.options.map((option, optionIndex) => (
                        <div key={`${poll.id}-${optionIndex}`}>
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="font-semibold text-[color:var(--admin-shell-text)]">
                              {option.text}
                            </span>
                            <span className="font-semibold text-[color:var(--admin-shell-text-muted)]">
                              {option.percentage}% · {option.votes} votes
                            </span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[color:var(--admin-shell-surface-muted)]">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-500"
                              style={{ width: `${option.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

