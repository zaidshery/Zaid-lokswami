'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import {
  Edit,
  FileText,
  Loader,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Volume2,
} from 'lucide-react';
import { getAuthHeader } from '@/lib/auth/clientToken';
import { isAdminRole, isReporterDeskRole, type AdminRole } from '@/lib/auth/roles';
import { NEWS_CATEGORIES } from '@/lib/constants/newsCategories';
import { formatUiDate } from '@/lib/utils/dateFormat';
import type { WorkflowStatus } from '@/lib/workflow/types';

type ScopeFilter = 'all' | 'mine' | 'assigned' | 'review';
type TtsVariant = 'breaking_headline' | 'article_full';
type TtsStatus = 'pending' | 'ready' | 'failed' | 'stale';

type Article = {
  _id: string;
  title: string;
  summary: string;
  category: string;
  author: string;
  sourceType?: 'story' | 'direct';
  sourceStoryId?: string;
  sourceStoryTitle?: string;
  publishedAt?: string;
  updatedAt?: string;
  views: number;
  isBreaking: boolean;
  isTrending: boolean;
  workflow?: {
    status?: WorkflowStatus;
    assignedTo?: { id?: string; name?: string; email?: string } | null;
    createdBy?: { id?: string; name?: string; email?: string } | null;
    reviewedBy?: { id?: string; name?: string; email?: string } | null;
    rejectionReason?: string;
    scheduledFor?: string | null;
  } | null;
};

type TtsAssetRecord = {
  _id: string;
  sourceId: string;
  variant: TtsVariant;
  status: TtsStatus;
  audioUrl?: string;
  lastError?: string;
};

type TtsAssetsResponse = {
  success?: boolean;
  data?: {
    assets?: TtsAssetRecord[];
  };
};

const FILTER_CATEGORIES = ['all', ...NEWS_CATEGORIES.map((category) => category.nameEn)];
const WORKFLOW_FILTERS: Array<{ value: WorkflowStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_review', label: 'In Review' },
  { value: 'copy_edit', label: 'Copy Edit' },
  { value: 'changes_requested', label: 'Changes Requested' },
  { value: 'ready_for_approval', label: 'Ready For Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'archived', label: 'Archived' },
];

const ROLE_SCOPE_OPTIONS: Record<
  AdminRole,
  Array<{ value: ScopeFilter; label: string }>
> = {
  super_admin: [
    { value: 'all', label: 'All Articles' },
    { value: 'review', label: 'Review Queue' },
    { value: 'assigned', label: 'Assigned To Me' },
    { value: 'mine', label: 'My Articles' },
  ],
  admin: [
    { value: 'all', label: 'All Articles' },
    { value: 'review', label: 'Review Queue' },
    { value: 'assigned', label: 'Assigned To Me' },
    { value: 'mine', label: 'My Articles' },
  ],
  copy_editor: [
    { value: 'all', label: 'All Articles' },
    { value: 'review', label: 'Review Queue' },
    { value: 'assigned', label: 'Assigned To Me' },
    { value: 'mine', label: 'My Articles' },
  ],
  reporter: [{ value: 'mine', label: 'My Articles' }],
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const PANEL_CLASS = 'admin-shell-surface-strong rounded-[30px] p-6';

const METRIC_CARD_CLASS = 'admin-shell-surface rounded-[26px] p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.16)]';

const EMPTY_STATE_CLASS =
  'rounded-[24px] border border-dashed border-[color:var(--admin-shell-border-strong)] bg-[color:var(--admin-shell-surface-muted)] p-6 text-sm leading-6 text-[color:var(--admin-shell-text-muted)]';

const FILTER_INPUT_CLASS =
  'w-full rounded-2xl border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface)] px-4 py-3 text-sm text-[color:var(--admin-shell-text)] outline-none transition-colors placeholder:text-[color:var(--admin-shell-text-muted)] focus:border-red-400/40';

const SECONDARY_BUTTON_CLASS =
  'admin-shell-toolbar-btn inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold';

const PRIMARY_BUTTON_CLASS =
  'admin-shell-toolbar-btn inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold';

const DANGER_BUTTON_CLASS =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20';

function formatStatusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function getWorkflowToneClass(status: string) {
  switch (status) {
    case 'published':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'approved':
    case 'ready_for_approval':
    case 'scheduled':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'submitted':
    case 'assigned':
    case 'in_review':
    case 'copy_edit':
    case 'changes_requested':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'rejected':
      return 'border-red-200 bg-red-50 text-red-700';
    default:
      return 'border-gray-200 bg-gray-100 text-gray-700';
  }
}

function WorkflowPill({ status }: { status: string | undefined }) {
  const normalized = status || 'published';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold ${getWorkflowToneClass(normalized)}`}
    >
      {formatStatusLabel(normalized)}
    </span>
  );
}

function TtsPill({
  label,
  tone,
}: {
  label: string;
  tone: 'ready' | 'warning' | 'error' | 'neutral';
}) {
  const toneClass =
    tone === 'ready'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : tone === 'error'
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-gray-200 bg-gray-100 text-gray-600';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold ${toneClass}`}
    >
      {label}
    </span>
  );
}

function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note: string;
}) {
  return (
    <div className={METRIC_CARD_CLASS}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-shell-text-muted)]">
        {label}
      </p>
      <p className="mt-4 text-4xl font-black tracking-tight text-[color:var(--admin-shell-text)]">
        {value}
      </p>
      <p className="mt-3 text-sm text-[color:var(--admin-shell-text-muted)]">{note}</p>
    </div>
  );
}

function normalizeScopeParam(value: string | null): ScopeFilter | null {
  return value === 'mine' || value === 'assigned' || value === 'review' || value === 'all'
    ? value
    : null;
}

function normalizeWorkflowParam(value: string | null): WorkflowStatus | 'all' {
  return WORKFLOW_FILTERS.some((option) => option.value === value)
    ? (value as WorkflowStatus | 'all')
    : 'all';
}

export default function ArticlesManagement() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const adminRole = isAdminRole(session?.user?.role) ? session.user.role : null;
  const roleKey: AdminRole = adminRole || 'reporter';
  const scopeOptions = ROLE_SCOPE_OPTIONS[roleKey];
  const defaultScope = isReporterDeskRole(adminRole) ? 'mine' : 'all';
  const canCreateArticles =
    adminRole === 'super_admin' ||
    adminRole === 'admin' ||
    adminRole === 'copy_editor' ||
    isReporterDeskRole(adminRole);
  const canDeleteArticles = adminRole === 'super_admin' || adminRole === 'admin';

  const [articles, setArticles] = useState<Article[]>([]);
  const [articleTtsById, setArticleTtsById] = useState<
    Record<string, Partial<Record<TtsVariant, TtsAssetRecord>>>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedScope, setSelectedScope] = useState<ScopeFilter>(defaultScope);
  const [selectedWorkflowStatus, setSelectedWorkflowStatus] = useState<WorkflowStatus | 'all'>(
    'all'
  );
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [runningTtsActionKey, setRunningTtsActionKey] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const requestedScope = normalizeScopeParam(searchParams.get('scope'));
    const requestedWorkflow = normalizeWorkflowParam(searchParams.get('workflowStatus'));
    const requestedCategory = searchParams.get('category');

    if (requestedScope && scopeOptions.some((option) => option.value === requestedScope)) {
      setSelectedScope(requestedScope);
    } else {
      setSelectedScope(defaultScope);
    }

    setSelectedWorkflowStatus(requestedWorkflow);
    setSelectedCategory(
      requestedCategory && FILTER_CATEGORIES.includes(requestedCategory)
        ? requestedCategory
        : 'all'
    );
  }, [defaultScope, scopeOptions, searchParams]);

  const loadTtsAssets = useCallback(async (nextArticles: Article[]) => {
    if (!nextArticles.length) {
      setArticleTtsById({});
      return;
    }

    try {
      const params = new URLSearchParams({
        sourceType: 'article',
        sourceIds: nextArticles.map((article) => article._id).join(','),
        limit: 'all',
      });
      const response = await fetch(`/api/admin/tts/assets?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = (await response.json().catch(() => ({}))) as TtsAssetsResponse;
      if (!response.ok || !data.success || !Array.isArray(data.data?.assets)) {
        return;
      }

      const nextMap: Record<string, Partial<Record<TtsVariant, TtsAssetRecord>>> = {};
      for (const asset of data.data.assets) {
        if (!nextMap[asset.sourceId]) {
          nextMap[asset.sourceId] = {};
        }
        if (!nextMap[asset.sourceId][asset.variant]) {
          nextMap[asset.sourceId][asset.variant] = asset;
        }
      }

      setArticleTtsById(nextMap);
    } catch {
      // Keep the list usable even if TTS status fails to load.
    }
  }, []);

  const fetchArticles = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({ limit: 'all' });
      if (selectedScope !== 'all') params.set('scope', selectedScope);
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (selectedWorkflowStatus !== 'all') {
        params.set('workflowStatus', selectedWorkflowStatus);
      }

      const response = await fetch(`/api/admin/articles?${params.toString()}`, {
        headers: { ...getAuthHeader() },
        cache: 'no-store',
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to load articles');
        setArticles([]);
        setArticleTtsById({});
        return;
      }

      const nextArticles = (data.data || []) as Article[];
      setArticles(nextArticles);
      await loadTtsAssets(nextArticles);
    } catch {
      setError('Failed to load articles');
      setArticles([]);
      setArticleTtsById({});
    } finally {
      setIsLoading(false);
    }
  }, [loadTtsAssets, selectedCategory, selectedScope, selectedWorkflowStatus]);

  useEffect(() => {
    void fetchArticles();
  }, [fetchArticles]);

  const filteredArticles = useMemo(() => {
    if (!searchTerm.trim()) return articles;

    const normalized = searchTerm.trim().toLowerCase();
    return articles.filter(
      (article) =>
        article.title.toLowerCase().includes(normalized) ||
        article.author.toLowerCase().includes(normalized) ||
        article.category.toLowerCase().includes(normalized) ||
        article.workflow?.assignedTo?.name?.toLowerCase().includes(normalized) ||
        article.workflow?.createdBy?.name?.toLowerCase().includes(normalized)
    );
  }, [articles, searchTerm]);

  const counts = useMemo(() => {
    const next = {
      total: filteredArticles.length,
      needsReview: 0,
      readyToPublish: 0,
      published: 0,
      rejected: 0,
      drafts: 0,
    };

    for (const article of filteredArticles) {
      const status = article.workflow?.status || 'published';
      if (
        status === 'submitted' ||
        status === 'assigned' ||
        status === 'in_review' ||
        status === 'copy_edit' ||
        status === 'changes_requested'
      ) {
        next.needsReview += 1;
      }
      if (
        status === 'ready_for_approval' ||
        status === 'approved' ||
        status === 'scheduled'
      ) {
        next.readyToPublish += 1;
      }
      if (status === 'published') next.published += 1;
      if (status === 'rejected') next.rejected += 1;
      if (status === 'draft') next.drafts += 1;
    }

    return next;
  }, [filteredArticles]);

  const getTtsState = useCallback((articleId: string, variant: TtsVariant) => {
    return articleTtsById[articleId]?.[variant] || null;
  }, [articleTtsById]);

  const handleGenerateTts = async (article: Article, variant: TtsVariant) => {
    const actionKey = `${variant}:${article._id}`;
    setRunningTtsActionKey(actionKey);
    setError('');

    try {
      const endpoint =
        variant === 'breaking_headline'
          ? `/api/admin/articles/${encodeURIComponent(article._id)}/breaking-tts?force=1`
          : `/api/admin/articles/${encodeURIComponent(article._id)}/tts?force=1`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
        },
      });
      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update TTS audio');
      }

      await loadTtsAssets(articles);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Failed to update TTS audio'
      );
    } finally {
      setRunningTtsActionKey('');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/articles/${id}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeader(),
        },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || 'Failed to delete article');
        return;
      }

      setArticles((current) => current.filter((article) => article._id !== id));
      setArticleTtsById((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setDeleteConfirm(null);
    } catch {
      setError('Failed to delete article');
    }
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[36px] border border-[color:var(--admin-shell-border)] bg-[radial-gradient(circle_at_top_left,rgba(185,28,28,0.10),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.08),transparent_28%),var(--admin-bg-depth)] p-8 text-[color:var(--admin-shell-text)] shadow-[var(--admin-shell-shadow-strong)] lg:p-10">
        <div className="pointer-events-none absolute -right-10 top-0 h-48 w-48 rounded-full bg-red-500/10 blur-3xl dark:bg-red-500/14" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-500/14" />
        <div className="relative grid gap-8 xl:grid-cols-[1.25fr,0.85fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-red-600 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
              Article Workflow
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-[color:var(--admin-shell-text)] sm:text-5xl">
              Article Desk
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[color:var(--admin-shell-text-muted)] sm:text-[15px]">
              Manage drafts, review flow, publish readiness, and article voice operations from one
              desk.
            </p>
          </div>

          <div className={PANEL_CLASS}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-shell-text-muted)]">
              Actions
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
          {adminRole ? (
            <Link
              href="/admin/my-work"
              className={SECONDARY_BUTTON_CLASS}
            >
              My Work
            </Link>
          ) : null}
          {adminRole === 'super_admin' || adminRole === 'admin' || adminRole === 'copy_editor' ? (
            <Link
              href="/admin/review-queue"
              className={SECONDARY_BUTTON_CLASS}
            >
              Review Queue
            </Link>
          ) : null}
          <Link
            href="/admin/ai?ttsVariant=article_full&ttsSourceType=article"
            className={SECONDARY_BUTTON_CLASS}
          >
            Article TTS
          </Link>
          <Link
            href="/admin/ai?ttsVariant=breaking_headline&ttsSourceType=article"
            className={DANGER_BUTTON_CLASS}
          >
            Breaking TTS
          </Link>
            </div>
            {canCreateArticles && !isReporterDeskRole(adminRole) ? (
              <div className="mt-4">
                <Link href="/admin/articles/new" className={PRIMARY_BUTTON_CLASS}>
                  <Plus className="h-4 w-4" />
                  Create Direct Article
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Visible Articles"
          value={counts.total}
          note="Matches your current desk filters and search."
        />
        <StatCard
          label="Needs Review"
          value={counts.needsReview}
          note="Submitted, assigned, in-review, and copy-edit items."
        />
        <StatCard
          label="Ready To Publish"
          value={counts.readyToPublish}
          note="Approved or scheduled articles waiting for release."
        />
        <StatCard
          label="Published"
          value={counts.published}
          note="Live stories that are already out to readers."
        />
      </section>

      <div className={PANEL_CLASS}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {scopeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedScope(option.value)}
                className={cx(
                  'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                  selectedScope === option.value
                    ? 'bg-[color:var(--admin-shell-active)] text-[color:var(--admin-shell-active-text)]'
                    : 'bg-[color:var(--admin-shell-surface-muted)] text-[color:var(--admin-shell-text)] hover:bg-[color:var(--admin-shell-surface)]'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr),repeat(2,minmax(0,0.4fr)),auto]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search by title, author, category, or assignee..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className={cx(FILTER_INPUT_CLASS, 'pl-11')}
              />
            </div>

            <select
              value={selectedWorkflowStatus}
              onChange={(event) =>
                setSelectedWorkflowStatus(event.target.value as WorkflowStatus | 'all')
              }
              className={FILTER_INPUT_CLASS}
            >
              {WORKFLOW_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className={FILTER_INPUT_CLASS}
            >
              {FILTER_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All categories' : category}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void fetchArticles()}
              className={SECONDARY_BUTTON_CLASS}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        {isLoading ? (
          <div className={cx(PANEL_CLASS, 'flex flex-col items-center justify-center py-16')}>
            <Loader className="h-6 w-6 animate-spin text-red-600 dark:text-red-300" />
            <p className="mt-4 text-sm text-[color:var(--admin-shell-text-muted)]">Loading article desk...</p>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className={cx(PANEL_CLASS, 'text-center')}>
            <FileText className="mx-auto mb-3 h-12 w-12 text-zinc-400" />
            <p className="text-lg font-semibold text-[color:var(--admin-shell-text)]">No articles found</p>
            <p className="mt-2 text-sm text-[color:var(--admin-shell-text-muted)]">
              Try changing the scope, workflow status, or category filters.
            </p>
          </div>
        ) : (
          filteredArticles.map((article, idx) => {
            const listenAsset = getTtsState(article._id, 'article_full');
            const breakingAsset = getTtsState(article._id, 'breaking_headline');
            const listenTone =
              listenAsset?.status === 'ready'
                ? 'ready'
                : listenAsset?.status === 'stale'
                  ? 'warning'
                  : listenAsset?.status === 'failed'
                    ? 'error'
                    : 'neutral';
            const breakingTone =
              breakingAsset?.status === 'ready'
                ? 'ready'
                : breakingAsset?.status === 'stale'
                  ? 'warning'
                  : breakingAsset?.status === 'failed'
                    ? 'error'
                    : 'neutral';
            const workflowStatus = article.workflow?.status || 'published';
            const timestamp = article.updatedAt || article.publishedAt || '';

            return (
              <motion.div
                key={article._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="admin-shell-surface-strong rounded-[30px] p-5 transition-shadow hover:shadow-[0_28px_80px_-40px_rgba(15,23,42,0.28)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-xl font-semibold text-[color:var(--admin-shell-text)]">{article.title}</h3>
                      <WorkflowPill status={workflowStatus} />
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300">
                        {article.sourceType === 'story' ? 'From Story' : 'Direct Desk'}
                      </span>
                      {article.isBreaking ? (
                        <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                          Breaking
                        </span>
                      ) : null}
                      {article.isTrending ? (
                        <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-800 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300">
                          Trending
                        </span>
                      ) : null}
                    </div>

                    <p className="mb-4 line-clamp-2 text-sm leading-6 text-[color:var(--admin-shell-text-muted)]">{article.summary}</p>

                    <div className="flex flex-wrap gap-3 text-xs text-[color:var(--admin-shell-text-muted)]">
                      <span>By {article.author}</span>
                      <span>{article.category}</span>
                      {article.sourceType === 'story' && article.sourceStoryTitle ? (
                        <span>Source: {article.sourceStoryTitle}</span>
                      ) : null}
                      {article.workflow?.assignedTo?.name ? (
                        <span>Assigned to {article.workflow.assignedTo.name}</span>
                      ) : null}
                      {article.workflow?.createdBy?.name ? (
                        <span>Created by {article.workflow.createdBy.name}</span>
                      ) : null}
                      {timestamp ? (
                        <span>Updated {formatUiDate(timestamp, timestamp)}</span>
                      ) : null}
                      <span>{article.views} views</span>
                    </div>

                    {article.workflow?.rejectionReason ? (
                      <div className="mt-4 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                        Rejection note: {article.workflow.rejectionReason}
                      </div>
                    ) : null}

                    {article.workflow?.scheduledFor ? (
                      <div className="mt-4 rounded-[20px] border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                        Scheduled for {formatUiDate(article.workflow.scheduledFor, article.workflow.scheduledFor)}
                      </div>
                    ) : null}

                    {article.sourceType === 'story' && article.sourceStoryId ? (
                      <div className="mt-4 rounded-[20px] border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300">
                        Linked to source story.&nbsp;
                        <Link
                          href={`/admin/stories/${article.sourceStoryId}/edit`}
                          className="font-semibold underline"
                        >
                          Open source story
                        </Link>
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <TtsPill
                        label={`Listen ${listenAsset?.status || 'missing'}`}
                        tone={listenTone}
                      />
                      {article.isBreaking ? (
                        <TtsPill
                          label={`Breaking voice ${breakingAsset?.status || 'missing'}`}
                          tone={breakingTone}
                        />
                      ) : (
                        <TtsPill label="Breaking voice off" tone="neutral" />
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleGenerateTts(article, 'article_full')}
                        disabled={runningTtsActionKey !== ''}
                        className={cx(SECONDARY_BUTTON_CLASS, 'px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60')}
                      >
                        {runningTtsActionKey === `article_full:${article._id}` ? (
                          <Loader className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Volume2 className="h-3.5 w-3.5" />
                        )}
                        {listenAsset?.audioUrl ? 'Regenerate Listen' : 'Generate Listen'}
                      </button>
                      {article.isBreaking ? (
                        <button
                          type="button"
                          onClick={() => void handleGenerateTts(article, 'breaking_headline')}
                          disabled={runningTtsActionKey !== ''}
                          className={cx(DANGER_BUTTON_CLASS, 'px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60')}
                        >
                          {runningTtsActionKey === `breaking_headline:${article._id}` ? (
                            <Loader className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                          {breakingAsset?.audioUrl ? 'Regenerate Breaking' : 'Generate Breaking'}
                        </button>
                      ) : null}
                      <Link
                        href={`/admin/ai?ttsSourceType=article&ttsSourceId=${encodeURIComponent(article._id)}`}
                        className={cx(SECONDARY_BUTTON_CLASS, 'px-3 py-2 text-xs')}
                      >
                        TTS Ops
                      </Link>
                    </div>

                    {listenAsset?.lastError ? (
                      <p className="mt-2 text-xs text-red-600 dark:text-red-300">{listenAsset.lastError}</p>
                    ) : null}
                    {!listenAsset?.lastError && article.isBreaking && breakingAsset?.lastError ? (
                      <p className="mt-2 text-xs text-red-600 dark:text-red-300">{breakingAsset.lastError}</p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/articles/${article._id}/edit`}
                      className="rounded-2xl p-2.5 text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-500/10"
                      aria-label="Edit article"
                      title="Edit article"
                    >
                      <Edit className="h-5 w-5" />
                    </Link>

                    {canDeleteArticles ? (
                      <motion.button
                        whileHover={{ scale: 1.06 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setDeleteConfirm(article._id)}
                        className="rounded-2xl p-2.5 text-red-600 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                        title="Delete"
                      >
                        <Trash2 className="h-5 w-5" />
                      </motion.button>
                    ) : null}
                  </div>
                </div>

                {deleteConfirm === article._id ? (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 flex flex-col gap-3 rounded-[22px] border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-red-500/20 dark:bg-red-500/10"
                  >
                    <p className="text-sm text-red-800 dark:text-red-300">
                      Are you sure you want to delete this article?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleDelete(article._id)}
                        className={cx(DANGER_BUTTON_CLASS, 'px-3 py-2 text-xs')}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(null)}
                        className={cx(SECONDARY_BUTTON_CLASS, 'px-3 py-2 text-xs')}
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                ) : null}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
