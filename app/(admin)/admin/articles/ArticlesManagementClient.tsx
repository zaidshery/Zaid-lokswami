'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  Edit,
  FileText,
  Link2,
  Loader,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Volume2,
} from 'lucide-react';
import { getAuthHeader } from '@/lib/auth/clientToken';
import {
  canTransitionContent,
  type ContentTransitionAction,
} from '@/lib/auth/permissions';
import { isAdminRole, type AdminRole } from '@/lib/auth/roles';
import { NEWS_CATEGORIES } from '@/lib/constants/newsCategories';
import { formatUiDate } from '@/lib/utils/dateFormat';
import { getAllowedWorkflowTransitions } from '@/lib/workflow/transitions';
import type { WorkflowStatus } from '@/lib/workflow/types';
import {
  CmsCollectionHero,
  CmsCollectionPage,
  CMS_COLLECTION_DANGER_BUTTON_CLASS as DANGER_BUTTON_CLASS,
  CMS_COLLECTION_EMPTY_STATE_CLASS as EMPTY_STATE_CLASS,
  CMS_COLLECTION_FILTER_INPUT_CLASS as FILTER_INPUT_CLASS,
  CMS_COLLECTION_METRIC_CARD_CLASS as METRIC_CARD_CLASS,
  CMS_COLLECTION_PANEL_CLASS as PANEL_CLASS,
  CMS_COLLECTION_PRIMARY_BUTTON_CLASS as PRIMARY_BUTTON_CLASS,
  CMS_COLLECTION_SECONDARY_BUTTON_CLASS as SECONDARY_BUTTON_CLASS,
} from '@/components/admin/CmsCollectionLayout';

type ScopeFilter = 'all' | 'mine' | 'assigned' | 'review';
type SourceFilter = 'all' | 'story' | 'direct';
type TtsVariant = 'breaking_headline' | 'article_full';
type TtsStatus = 'pending' | 'ready' | 'failed' | 'stale';
type ArticleDeskRole = Exclude<AdminRole, 'reporter'>;
type WorkflowComment = {
  body?: string;
  kind?: string;
  author?: { name?: string; email?: string } | null;
};

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
    comments?: WorkflowComment[] | null;
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
const SOURCE_FILTERS: Array<{ value: SourceFilter; label: string }> = [
  { value: 'all', label: 'All Sources' },
  { value: 'story', label: 'From Story' },
  { value: 'direct', label: 'Direct Desk' },
];
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
  ArticleDeskRole,
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
    { value: 'assigned', label: 'Assigned To Me' },
    { value: 'mine', label: 'My Articles' },
  ],
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const STATUS_TO_ACTION: Partial<Record<WorkflowStatus, ContentTransitionAction>> = {
  submitted: 'submit',
  assigned: 'assign',
  in_review: 'start_review',
  copy_edit: 'move_to_copy_edit',
  changes_requested: 'request_changes',
  ready_for_approval: 'mark_ready_for_approval',
  approved: 'approve',
  rejected: 'reject',
  scheduled: 'schedule',
  published: 'publish',
  archived: 'archive',
};

const QUICK_ACTIONS: ContentTransitionAction[] = [
  'submit',
  'start_review',
  'move_to_copy_edit',
  'mark_ready_for_approval',
  'approve',
  'publish',
  'archive',
];

const QUICK_ACTION_LABELS: Record<ContentTransitionAction, string> = {
  submit: 'Submit',
  assign: 'Assign',
  start_review: 'Start Review',
  move_to_copy_edit: 'Copy Edit',
  request_changes: 'Request Changes',
  mark_ready_for_approval: 'Ready',
  approve: 'Approve',
  reject: 'Reject',
  schedule: 'Schedule',
  publish: 'Publish',
  archive: 'Archive',
};

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

function getWorkflowFeedbackToneClass(tone: 'neutral' | 'info' | 'warning' | 'danger' | 'success') {
  switch (tone) {
    case 'danger':
      return 'border-red-200 bg-red-50 text-red-900';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-900';
    case 'info':
      return 'border-blue-200 bg-blue-50 text-blue-900';
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    case 'neutral':
    default:
      return 'border-gray-200 bg-white text-gray-900';
  }
}

function normalizeSourceParam(value: string | null): SourceFilter {
  return value === 'story' || value === 'direct' ? value : 'all';
}

function extractLatestWorkflowNote(article: Article) {
  const comments = Array.isArray(article.workflow?.comments) ? article.workflow?.comments || [] : [];
  for (let index = comments.length - 1; index >= 0; index -= 1) {
    const comment = comments[index];
    const body = String(comment?.body || '').trim();
    if (!body) continue;
    return {
      label:
        comment?.kind === 'approval_note'
          ? 'Approval note'
          : comment?.kind === 'revision_request'
            ? 'Revision request'
            : comment?.kind === 'rejection_note'
              ? 'Rejection note'
              : 'Latest note',
      body,
      by: String(comment?.author?.name || comment?.author?.email || '').trim(),
    };
  }

  const rejectionReason = String(article.workflow?.rejectionReason || '').trim();
  if (rejectionReason) {
    return {
      label: 'Rejection reason',
      body: rejectionReason,
      by: String(article.workflow?.reviewedBy?.name || article.workflow?.reviewedBy?.email || '').trim(),
    };
  }

  return null;
}

function buildDeskWorkflowSummary(article: Article) {
  const status = article.workflow?.status || 'published';
  const sourceLabel = article.sourceType === 'story' ? 'story-linked article' : 'direct desk article';
  const assignedTo = article.workflow?.assignedTo?.name || article.workflow?.assignedTo?.email || '';
  const latestNote = extractLatestWorkflowNote(article);

  switch (status) {
    case 'draft':
      return {
        badge: article.sourceType === 'story' ? 'Story Draft' : 'Desk Draft',
        tone: 'neutral' as const,
        summary: `This ${sourceLabel} is still in drafting and has not entered the approval lane yet.`,
        nextAction: 'Finish the copy, then submit it for review when the desk version is ready.',
        note: latestNote,
      };
    case 'submitted':
      return {
        badge: 'Review Queue',
        tone: 'warning' as const,
        summary: `This ${sourceLabel} is waiting for desk triage or assignment.`,
        nextAction:
          'Open the workflow to assign an editor, or start review directly if the desk is taking it forward now.',
        note: latestNote,
      };
    case 'assigned':
      return {
        badge: 'Assigned',
        tone: 'info' as const,
        summary: assignedTo
          ? `This ${sourceLabel} is assigned to ${assignedTo}.`
          : `This ${sourceLabel} is assigned and should move into active review.`,
        nextAction: 'Start review or open the editor to continue the desk pass.',
        note: latestNote,
      };
    case 'in_review':
      return {
        badge: 'In Review',
        tone: 'info' as const,
        summary: `Desk review is active on this ${sourceLabel}.`,
        nextAction: 'Continue review in the editor, or push it into copy edit when the first pass is done.',
        note: latestNote,
      };
    case 'copy_edit':
      return {
        badge: 'Copy Edit',
        tone: 'info' as const,
        summary: `This ${sourceLabel} is being polished for language, packaging, and evidence support.`,
        nextAction: 'Use the editor to tighten structure, then mark it ready for approval.',
        note: latestNote,
      };
    case 'changes_requested':
      return {
        badge: 'Needs Changes',
        tone: 'danger' as const,
        summary: `This ${sourceLabel} needs revisions before it can continue through the desk.`,
        nextAction: 'Open the editor, address the note, then submit it back into review.',
        note: latestNote,
      };
    case 'ready_for_approval':
      return {
        badge: 'Approval Lane',
        tone: 'success' as const,
        summary: `Desk work is complete and this ${sourceLabel} is waiting for admin approval.`,
        nextAction: 'Admin should approve it now or reopen it if another edit pass is needed.',
        note: latestNote,
      };
    case 'approved':
      return {
        badge: 'Publish Lane',
        tone: 'success' as const,
        summary: `This ${sourceLabel} is approved and waiting for publish handling.`,
        nextAction: 'Admin can publish now or schedule from the article editor.',
        note: latestNote,
      };
    case 'scheduled':
      return {
        badge: 'Scheduled',
        tone: 'success' as const,
        summary: `This ${sourceLabel} is approved and scheduled for release.`,
        nextAction: 'Open the editor only if timing, SEO, or final packaging needs adjustment.',
        note: latestNote,
      };
    case 'published':
      return {
        badge: 'Published',
        tone: 'success' as const,
        summary: `This ${sourceLabel} is live for readers.`,
        nextAction: 'Monitor performance, update corrections if needed, and use the article as the newsroom reference output.',
        note: latestNote,
      };
    case 'rejected':
      return {
        badge: 'Rejected',
        tone: 'danger' as const,
        summary: `This ${sourceLabel} was rejected and needs desk-directed fixes before re-entry.`,
        nextAction: 'Open the article, resolve the rejection reason, then resubmit it for review.',
        note: latestNote,
      };
    case 'archived':
    default:
      return {
        badge: 'Archived',
        tone: 'neutral' as const,
        summary: `This ${sourceLabel} is archived and no longer in the active workflow lane.`,
        nextAction: 'Reopen the article only if the desk needs to resume work.',
        note: latestNote,
      };
  }
}

function getQuickActionToneClass(action: ContentTransitionAction) {
  switch (action) {
    case 'publish':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100';
    case 'approve':
    case 'mark_ready_for_approval':
      return 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100';
    case 'archive':
      return 'border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200';
    default:
      return 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50';
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
  const roleKey: ArticleDeskRole =
    adminRole && adminRole !== 'reporter' ? adminRole : 'admin';
  const scopeOptions = ROLE_SCOPE_OPTIONS[roleKey];
  const defaultScope: ScopeFilter = 'all';
  const canCreateArticles =
    adminRole === 'super_admin' ||
    adminRole === 'admin' ||
    adminRole === 'copy_editor';
  const canDeleteArticles = adminRole === 'super_admin' || adminRole === 'admin';

  const [articles, setArticles] = useState<Article[]>([]);
  const [articleTtsById, setArticleTtsById] = useState<
    Record<string, Partial<Record<TtsVariant, TtsAssetRecord>>>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedScope, setSelectedScope] = useState<ScopeFilter>(defaultScope);
  const [selectedSourceType, setSelectedSourceType] = useState<SourceFilter>('all');
  const [selectedWorkflowStatus, setSelectedWorkflowStatus] = useState<WorkflowStatus | 'all'>(
    'all'
  );
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [runningTtsActionKey, setRunningTtsActionKey] = useState('');
  const [runningWorkflowActionKey, setRunningWorkflowActionKey] = useState('');
  const [error, setError] = useState('');

  const permissionUser = useMemo(() => {
    const sessionUser = session?.user;
    const email = sessionUser?.email?.trim() || '';
    const role = sessionUser?.role;

    if (!sessionUser || !email || !isAdminRole(role)) {
      return null;
    }

    return {
      id: sessionUser.userId || sessionUser.id || email,
      email,
      name: sessionUser.name?.trim() || email.split('@')[0] || 'Desk User',
      role,
    };
  }, [session]);

  useEffect(() => {
    const requestedScope = normalizeScopeParam(searchParams.get('scope'));
    const requestedWorkflow = normalizeWorkflowParam(searchParams.get('workflowStatus'));
    const requestedCategory = searchParams.get('category');
    const requestedSourceType = normalizeSourceParam(searchParams.get('sourceType'));

    if (requestedScope && scopeOptions.some((option) => option.value === requestedScope)) {
      setSelectedScope(requestedScope);
    } else {
      setSelectedScope(defaultScope);
    }

    setSelectedWorkflowStatus(requestedWorkflow);
    setSelectedSourceType(requestedSourceType);
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
    const sourceFiltered =
      selectedSourceType === 'all'
        ? articles
        : articles.filter((article) => (article.sourceType || 'direct') === selectedSourceType);

    if (!searchTerm.trim()) return sourceFiltered;

    const normalized = searchTerm.trim().toLowerCase();
    return sourceFiltered.filter(
      (article) =>
        article.title.toLowerCase().includes(normalized) ||
        article.author.toLowerCase().includes(normalized) ||
        article.category.toLowerCase().includes(normalized) ||
        article.workflow?.assignedTo?.name?.toLowerCase().includes(normalized) ||
        article.workflow?.createdBy?.name?.toLowerCase().includes(normalized)
    );
  }, [articles, searchTerm, selectedSourceType]);

  const counts = useMemo(() => {
    const next = {
      total: filteredArticles.length,
      storyLinked: 0,
      directDesk: 0,
      needsReview: 0,
      approvalLane: 0,
      publishLane: 0,
      readyToPublish: 0,
      published: 0,
      rejected: 0,
      drafts: 0,
      assignedToMe: 0,
    };

    for (const article of filteredArticles) {
      const status = article.workflow?.status || 'published';
      if ((article.sourceType || 'direct') === 'story') {
        next.storyLinked += 1;
      } else {
        next.directDesk += 1;
      }
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
      if (status === 'ready_for_approval') next.approvalLane += 1;
      if (status === 'approved' || status === 'scheduled') next.publishLane += 1;
      if (status === 'published') next.published += 1;
      if (status === 'rejected') next.rejected += 1;
      if (status === 'draft') next.drafts += 1;
      if (
        permissionUser &&
        ((article.workflow?.assignedTo?.id || '').trim().toLowerCase() ===
          permissionUser.id.trim().toLowerCase() ||
          (article.workflow?.assignedTo?.email || '').trim().toLowerCase() ===
            permissionUser.email.trim().toLowerCase())
      ) {
        next.assignedToMe += 1;
      }
    }

    return next;
  }, [filteredArticles, permissionUser]);

  const handleWorkflowAction = async (article: Article, action: ContentTransitionAction) => {
    const actionKey = `${action}:${article._id}`;
    setRunningWorkflowActionKey(actionKey);
    setError('');

    try {
      const response = await fetch(`/api/admin/articles/${encodeURIComponent(article._id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          action,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update article workflow');
      }

      await fetchArticles();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Failed to update article workflow'
      );
    } finally {
      setRunningWorkflowActionKey('');
    }
  };

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
    <CmsCollectionPage className="space-y-6">
      <CmsCollectionHero
        accent="red"
        eyebrow="Article Workflow"
        title="Article Desk"
        description="Manage drafts, review flow, publish readiness, and article voice operations from one desk."
        aside={
          <div className={PANEL_CLASS}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-shell-text-muted)]">
              Actions
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {adminRole ? (
                <Link href="/admin/my-work" className={SECONDARY_BUTTON_CLASS}>
                  My Work
                </Link>
              ) : null}
              {adminRole === 'super_admin' || adminRole === 'admin' ? (
                <Link href="/admin/review-queue" className={SECONDARY_BUTTON_CLASS}>
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
            {canCreateArticles ? (
              <div className="mt-4">
                <Link href="/admin/articles/new" className={PRIMARY_BUTTON_CLASS}>
                  <Plus className="h-4 w-4" />
                  Create Direct Article
                </Link>
              </div>
            ) : null}
          </div>
        }
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Visible Articles"
          value={counts.total}
          note="Matches your current desk filters and search."
        />
        <StatCard
          label="From Story"
          value={counts.storyLinked}
          note="Website articles created from approved reporter story packages."
        />
        <StatCard
          label="Direct Desk"
          value={counts.directDesk}
          note="Original desk-written articles created without a source story."
        />
        <StatCard
          label="Needs Review"
          value={counts.needsReview}
          note="Submitted, assigned, in-review, and copy-edit items."
        />
        <StatCard
          label="Approval Lane"
          value={counts.approvalLane}
          note="Articles waiting for admin approval right now."
        />
        <StatCard
          label="Publish Lane"
          value={counts.publishLane}
          note="Approved or scheduled articles waiting for release handling."
        />
        <StatCard
          label="Published"
          value={counts.published}
          note="Live stories that are already out to readers."
        />
        {permissionUser ? (
          <StatCard
            label="Assigned To Me"
            value={counts.assignedToMe}
            note="Articles currently in your personal desk lane."
          />
        ) : null}
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

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr),repeat(3,minmax(0,0.34fr)),auto]">
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

            <select
              value={selectedSourceType}
              onChange={(event) => setSelectedSourceType(event.target.value as SourceFilter)}
              className={FILTER_INPUT_CLASS}
            >
              {SOURCE_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
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
            const workflowFeedback = buildDeskWorkflowSummary(article);
            const quickActions = permissionUser
              ? getAllowedWorkflowTransitions(workflowStatus)
                  .map((status) => STATUS_TO_ACTION[status])
                  .filter((action): action is ContentTransitionAction => Boolean(action))
                  .filter((action) => QUICK_ACTIONS.includes(action))
                  .filter((action) =>
                    canTransitionContent(permissionUser, {
                      legacyAuthorName: article.author,
                      workflow: article.workflow,
                    }, action)
                  )
              : [];

            return (
              <motion.div
                key={article._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="admin-shell-surface-strong rounded-[18px] p-3 transition-shadow hover:shadow-[0_28px_80px_-40px_rgba(15,23,42,0.28)] sm:rounded-[30px] sm:p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2 sm:mb-3">
                      <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-[color:var(--admin-shell-text)] sm:text-xl">{article.title}</h3>
                      <WorkflowPill status={workflowStatus} />
                      <span className="hidden rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 sm:inline-flex dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300">
                        {article.sourceType === 'story' ? 'From Story' : 'Direct Desk'}
                      </span>
                      {article.isBreaking ? (
                        <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-800 sm:px-3 sm:text-xs dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                          Breaking
                        </span>
                      ) : null}
                      {article.isTrending ? (
                        <span className="hidden rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-800 sm:inline-flex dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300">
                          Trending
                        </span>
                      ) : null}
                    </div>

                    <p className="mb-3 line-clamp-2 text-sm leading-6 text-[color:var(--admin-shell-text-muted)] sm:mb-4">{article.summary}</p>

                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[color:var(--admin-shell-text-muted)]">
                      <span>By {article.author}</span>
                      <span>{article.category}</span>
                      {timestamp ? (
                        <span>Updated {formatUiDate(timestamp, timestamp)}</span>
                      ) : null}
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

                    <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-5">
                      {quickActions.map((action) => {
                        const isRunning = runningWorkflowActionKey === `${action}:${article._id}`;
                        return (
                          <button
                            key={action}
                            type="button"
                            onClick={() => void handleWorkflowAction(article, action)}
                            disabled={Boolean(runningWorkflowActionKey)}
                            className={cx(
                              'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                              getQuickActionToneClass(action)
                            )}
                          >
                            {isRunning ? <Loader className="h-3.5 w-3.5 animate-spin" /> : null}
                            {QUICK_ACTION_LABELS[action]}
                          </button>
                        );
                      })}
                      <Link
                        href={`/admin/articles/${article._id}/edit`}
                        className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        Open
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>

                    <details className="mt-3 rounded-2xl border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface-muted)]">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-[color:var(--admin-shell-text-muted)]">
                        More details
                      </summary>
                      <div className="space-y-3 border-t border-[color:var(--admin-shell-border)] p-3">
                        <div
                          className={cx(
                            'rounded-2xl border p-3 text-sm',
                            getWorkflowFeedbackToneClass(workflowFeedback.tone)
                          )}
                        >
                          <p className="font-semibold">{workflowFeedback.summary}</p>
                          <p className="mt-1 opacity-90">
                            <span className="font-semibold">Next:</span> {workflowFeedback.nextAction}
                          </p>
                        </div>
                        {article.sourceType === 'story' && article.sourceStoryId ? (
                          <Link
                            href={`/admin/stories/${article.sourceStoryId}/edit`}
                            className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-100"
                          >
                            <Link2 className="h-3.5 w-3.5" />
                            Source Story
                          </Link>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <TtsPill
                            label={`Listen ${listenAsset?.status || 'missing'}`}
                            tone={listenTone}
                          />
                          {article.isBreaking ? (
                            <TtsPill
                              label={`Breaking voice ${breakingAsset?.status || 'missing'}`}
                              tone={breakingTone}
                            />
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
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
                            Listen
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
                              Breaking Voice
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
                          <p className="text-xs text-red-600 dark:text-red-300">{listenAsset.lastError}</p>
                        ) : null}
                        {!listenAsset?.lastError && article.isBreaking && breakingAsset?.lastError ? (
                          <p className="text-xs text-red-600 dark:text-red-300">{breakingAsset.lastError}</p>
                        ) : null}
                      </div>
                    </details>
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
    </CmsCollectionPage>
  );
}
