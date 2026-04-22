'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  Loader2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { getAuthHeader } from '@/lib/auth/clientToken';
import {
  canCreateContent,
  canDeleteContent,
  canViewPage,
  type PermissionUser,
} from '@/lib/auth/permissions';
import { isAdminRole, isReporterDeskRole, type AdminRole } from '@/lib/auth/roles';
import { NEWS_CATEGORIES } from '@/lib/constants/newsCategories';
import { formatUiDate } from '@/lib/utils/dateFormat';
import {
  buildWorkflowFeedbackSummary,
  type WorkflowFeedbackTone,
} from '@/lib/workflow/feedback';
import type { WorkflowStatus } from '@/lib/workflow/types';
import {
  CmsCollectionHero,
  CmsCollectionMetricCard,
  CmsCollectionMetricGrid,
  CmsCollectionPage,
  CMS_COLLECTION_EMPTY_STATE_CLASS as EMPTY_STATE_CLASS,
  CMS_COLLECTION_FILTER_INPUT_CLASS as FILTER_INPUT_CLASS,
  CMS_COLLECTION_META_CHIP_CLASS as META_CHIP_CLASS,
  CMS_COLLECTION_PANEL_CLASS as PANEL_CLASS,
  CMS_COLLECTION_PRIMARY_BUTTON_CLASS as PRIMARY_BUTTON_CLASS,
  CMS_COLLECTION_SECONDARY_BUTTON_CLASS as SECONDARY_BUTTON_CLASS,
} from '@/components/admin/CmsCollectionLayout';

type WorkflowActor = {
  id?: string;
  name?: string;
  email?: string;
  role?: AdminRole;
};

interface AdminStory {
  _id: string;
  title: string;
  caption: string;
  thumbnail: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  linkUrl: string;
  linkLabel: string;
  category: string;
  author: string;
  durationSeconds: number;
  priority: number;
  views: number;
  isPublished: boolean;
  publishedAt: string;
  updatedAt?: string;
  linkedArticleId?: string;
  linkedArticleStatus?: 'not_created' | 'draft' | 'submitted' | 'published';
  videoProduction?: {
    status?: 'not_started' | 'editing' | 'qa_review' | 'ready_to_publish' | 'published';
    assignedTo?: { id?: string; name?: string; email?: string } | null;
    editorNotes?: string;
    masterExportUrl?: string;
    thumbnailUrl?: string;
    updatedAt?: string | null;
  } | null;
  copyEditorMeta?: {
    returnForChangesReason?: string;
    copyEditorNotes?: string;
  } | null;
  workflow?: {
    status?: WorkflowStatus;
    createdBy?: WorkflowActor | null;
    assignedTo?: WorkflowActor | null;
    reviewedBy?: WorkflowActor | null;
    rejectionReason?: string;
    comments?: Array<{
      body?: string | null;
      kind?: string | null;
      author?: {
        name?: string | null;
        email?: string | null;
      } | null;
    }>;
  };
}

type StatusFilter = 'all' | WorkflowStatus;

const categories = ['all', 'General', ...NEWS_CATEGORIES.map((category) => category.nameEn)];
const workflowFilters: StatusFilter[] = [
  'all',
  'draft',
  'submitted',
  'assigned',
  'in_review',
  'copy_edit',
  'changes_requested',
  'ready_for_approval',
  'approved',
  'scheduled',
  'published',
  'rejected',
  'archived',
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const DANGER_BUTTON_CLASS =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20';

function formatWorkflowStatus(status: StatusFilter) {
  if (status === 'all') return 'All statuses';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function workflowTone(status: WorkflowStatus | undefined) {
  switch (status) {
    case 'published':
      return 'bg-emerald-100 text-emerald-700';
    case 'approved':
    case 'ready_for_approval':
    case 'scheduled':
      return 'bg-blue-100 text-blue-700';
    case 'submitted':
    case 'assigned':
    case 'in_review':
    case 'copy_edit':
    case 'changes_requested':
      return 'bg-amber-100 text-amber-700';
    case 'rejected':
      return 'bg-red-100 text-red-700';
    case 'archived':
      return 'bg-zinc-200 text-zinc-700';
    case 'draft':
    default:
      return 'bg-zinc-100 text-zinc-700';
  }
}

function workflowFeedbackToneClasses(tone: WorkflowFeedbackTone) {
  switch (tone) {
    case 'info':
      return 'border-blue-200/80 bg-blue-50/80 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200';
    case 'warning':
      return 'border-amber-200/80 bg-amber-50/80 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200';
    case 'danger':
      return 'border-red-200/80 bg-red-50/80 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200';
    case 'success':
      return 'border-emerald-200/80 bg-emerald-50/80 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200';
    case 'neutral':
    default:
      return 'border-zinc-200/80 bg-zinc-50/80 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200';
  }
}

function formatLinkedArticleStatus(status: AdminStory['linkedArticleStatus']) {
  switch (status) {
    case 'draft':
      return 'Article Draft';
    case 'submitted':
      return 'Article In Desk';
    case 'published':
      return 'Article Published';
    case 'not_created':
    default:
      return 'No Article';
  }
}

function linkedArticleTone(status: AdminStory['linkedArticleStatus']) {
  switch (status) {
    case 'published':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300';
    case 'draft':
    case 'submitted':
      return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300';
    default:
      return 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300';
  }
}

function formatVideoProductionStatus(
  status: NonNullable<AdminStory['videoProduction']>['status'] | undefined
) {
  switch (status) {
    case 'editing':
      return 'Video Editing';
    case 'qa_review':
      return 'Video QA';
    case 'ready_to_publish':
      return 'Video Ready';
    case 'published':
      return 'Video Published';
    case 'not_started':
    default:
      return 'Video Not Started';
  }
}

function videoProductionTone(
  status: NonNullable<AdminStory['videoProduction']>['status'] | undefined
) {
  switch (status) {
    case 'published':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300';
    case 'ready_to_publish':
      return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300';
    case 'editing':
    case 'qa_review':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
    default:
      return 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300';
  }
}

export default function StoriesManagementPage() {
  const { data: session } = useSession();
  const adminRole = isAdminRole(session?.user?.role) ? session.user.role : null;
  const [stories, setStories] = useState<AdminStory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const permissionUser = useMemo<PermissionUser | null>(() => {
    const sessionUser = session?.user;
    const email = sessionUser?.email?.trim() || '';
    const role = sessionUser?.role;

    if (!sessionUser || !email || !isAdminRole(role)) {
      return null;
    }

    return {
      id: sessionUser.userId || sessionUser.id || email,
      email,
      name: sessionUser.name?.trim() || email.split('@')[0] || 'Admin',
      role,
    };
  }, [session]);

  const canCreateStories = canCreateContent(permissionUser?.role, 'story');
  const canCreateLinkedArticles = Boolean(
    permissionUser &&
      permissionUser.role !== 'reporter' &&
      canCreateContent(permissionUser.role, 'article')
  );
  const canDeleteStories = canDeleteContent(permissionUser);
  const canOpenDesk = Boolean(permissionUser);
  const canManageVideoProduction =
    adminRole === 'admin' || adminRole === 'super_admin' || adminRole === 'copy_editor';
  const canGenerateSocialDrafts =
    adminRole === 'admin' || adminRole === 'super_admin';
  const canAccessMyWork = canViewPage(adminRole, 'my_work');
  const canAccessReviewQueue = canViewPage(adminRole, 'review_queue');
  const isReporterFlow = isReporterDeskRole(adminRole);
  const deskTitle = isReporterFlow ? 'My Stories' : 'Story Desk';
  const deskDescription = isReporterFlow
    ? 'Track the story cards you created or that are assigned to you. Save drafts, submit for review, and follow status changes without leaving the desk.'
    : 'Manage fullscreen story cards through the newsroom workflow with a cleaner desk for review, readiness, and publishing.';

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await fetch('/api/admin/stories?limit=all', {
          headers: {
            ...getAuthHeader(),
          },
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to load stories');
        }

        setStories(Array.isArray(data.data) ? (data.data as AdminStory[]) : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stories');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const filteredStories = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return stories.filter((story) => {
      const status = story.workflow?.status || (story.isPublished ? 'published' : 'draft');

      if (selectedCategory !== 'all' && story.category !== selectedCategory) return false;
      if (statusFilter !== 'all' && status !== statusFilter) return false;

      if (!normalizedSearch) return true;
      return (
        story.title.toLowerCase().includes(normalizedSearch) ||
        story.caption.toLowerCase().includes(normalizedSearch) ||
        story.category.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [searchTerm, selectedCategory, statusFilter, stories]);

  const summary = useMemo(() => {
    return filteredStories.reduce(
      (accumulator, story) => {
        const status = story.workflow?.status || (story.isPublished ? 'published' : 'draft');
        if (status === 'draft') accumulator.drafts += 1;
        if (['submitted', 'assigned', 'in_review', 'copy_edit', 'changes_requested'].includes(status)) {
          accumulator.review += 1;
        }
        if (status === 'ready_for_approval' || status === 'approved' || status === 'scheduled') {
          accumulator.ready += 1;
        }
        if (status === 'published') {
          accumulator.published += 1;
        }
        return accumulator;
      },
      { drafts: 0, review: 0, ready: 0, published: 0 }
    );
  }, [filteredStories]);

  const handleDelete = async (id: string) => {
    setBusyId(id);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/admin/stories/${id}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeader(),
        },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to delete story');
      }

      setStories((prev) => prev.filter((item) => item._id !== id));
      setDeleteConfirmId(null);
      setSuccess('Story deleted successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete story');
    } finally {
      setBusyId(null);
    }
  };

  const handleStartVideoProduction = async (id: string) => {
    setActionKey(`video:${id}`);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/admin/stories/${id}/video-production`, {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
        },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to start video production');
      }

      setStories((current) =>
        current.map((story) =>
          story._id === id
            ? {
                ...story,
                videoProduction: data.data?.videoProduction || story.videoProduction,
              }
            : story
        )
      );
      setSuccess('Video production started for this story.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start video production');
    } finally {
      setActionKey('');
    }
  };

  const handleGenerateSocialDrafts = async (id: string) => {
    setActionKey(`social:${id}`);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/admin/social-posts/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({ storyId: id }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to generate social drafts');
      }

      setSuccess('Social drafts generated for YouTube, Facebook, and Instagram.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate social drafts');
    } finally {
      setActionKey('');
    }
  };

  return (
    <CmsCollectionPage className="space-y-6">
      <CmsCollectionHero
        accent="rose"
        eyebrow="Story Workflow"
        title={deskTitle}
        description={deskDescription}
        aside={
          <div className={cx(PANEL_CLASS, 'p-4 sm:p-6')}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-shell-text-muted)]">
              Actions
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {canAccessMyWork ? (
                <Link href="/admin/my-work" className={SECONDARY_BUTTON_CLASS}>
                  My Work
                </Link>
              ) : null}
              {canAccessReviewQueue ? (
                <Link href="/admin/review-queue" className={SECONDARY_BUTTON_CLASS}>
                  Review Queue
                </Link>
              ) : null}
              {canCreateStories ? (
                <Link href="/admin/stories/new" className={PRIMARY_BUTTON_CLASS}>
                  <Plus className="h-4 w-4" />
                  New Story
                </Link>
              ) : null}
            </div>
          </div>
        }
      />

      {error ? (
        <div className="flex items-start gap-2 rounded-[20px] border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {success ? (
        <div className="flex items-start gap-2 rounded-[20px] border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      ) : null}

      <CmsCollectionMetricGrid className="grid-cols-2 md:grid-cols-4 xl:grid-cols-4">
        <CmsCollectionMetricCard label="Drafts" value={summary.drafts} />
        <CmsCollectionMetricCard label="In Review" value={summary.review} />
        <CmsCollectionMetricCard label="Ready" value={summary.ready} />
        <CmsCollectionMetricCard label="Published" value={summary.published} />
      </CmsCollectionMetricGrid>

      <div className={cx(PANEL_CLASS, 'p-4 sm:p-6')}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search stories..."
              className={cx(FILTER_INPUT_CLASS, 'pl-11')}
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            className={FILTER_INPUT_CLASS}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category === 'all' ? 'All categories' : category}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className={FILTER_INPUT_CLASS}
          >
            {workflowFilters.map((status) => (
              <option key={status} value={status}>
                {formatWorkflowStatus(status)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className={cx(PANEL_CLASS, 'flex items-center justify-center py-16')}>
          <Loader2 className="h-6 w-6 animate-spin text-red-600 dark:text-red-300" />
        </div>
      ) : filteredStories.length === 0 ? (
        <div className={cx(PANEL_CLASS, 'py-16 text-center')}>
          <Eye className="mx-auto mb-3 h-10 w-10 text-zinc-400" />
          <p className="text-sm text-[color:var(--admin-shell-text-muted)]">No stories found for current filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredStories.map((story, index) => {
            const status = story.workflow?.status || (story.isPublished ? 'published' : 'draft');
            const workflowFeedback = isReporterFlow
              ? buildWorkflowFeedbackSummary({
                  contentLabel: 'Story',
                  status,
                  assignedToName:
                    story.workflow?.assignedTo?.name || story.workflow?.assignedTo?.email || '',
                  reviewedByName:
                    story.workflow?.reviewedBy?.name || story.workflow?.reviewedBy?.email || '',
                  rejectionReason: story.workflow?.rejectionReason || '',
                  returnForChangesReason:
                    story.copyEditorMeta?.returnForChangesReason || '',
                  copyEditorNotes: story.copyEditorMeta?.copyEditorNotes || '',
                  workflowComments: story.workflow?.comments || [],
                })
              : null;

            return (
              <motion.article
                key={story._id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={cx(
                  'admin-shell-surface-strong rounded-[24px] p-4 sm:rounded-[30px] sm:p-5',
                  isReporterFlow && 'overflow-hidden'
                )}
              >
                <div className="flex flex-col gap-4 md:flex-row">
                  <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-[18px] bg-zinc-100 dark:bg-zinc-900 sm:h-44 sm:w-28 sm:rounded-[22px] md:h-48 md:w-32">
                    {story.thumbnail ? (
                      <img
                        src={story.thumbnail}
                        alt={story.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-shell-text-muted)]">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h2 className="line-clamp-2 text-lg font-semibold tracking-tight text-[color:var(--admin-shell-text)] sm:text-xl">
                        {story.title}
                      </h2>
                      <span className={META_CHIP_CLASS}>
                        {story.mediaType === 'video' ? 'Video' : 'Image'}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${workflowTone(status)}`}
                      >
                        {formatWorkflowStatus(status)}
                      </span>
                      <span
                        className={cx(
                          `rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${linkedArticleTone(
                            story.linkedArticleStatus
                          )}`,
                          isReporterFlow && 'hidden sm:inline-flex'
                        )}
                      >
                        {formatLinkedArticleStatus(story.linkedArticleStatus)}
                      </span>
                      <span
                        className={cx(
                          `rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${videoProductionTone(
                            story.videoProduction?.status
                          )}`,
                          isReporterFlow && 'hidden sm:inline-flex'
                        )}
                      >
                        {formatVideoProductionStatus(story.videoProduction?.status)}
                      </span>
                    </div>

                    {story.caption ? (
                      <p
                        className={cx(
                          'mb-3 line-clamp-2 text-sm leading-6 text-[color:var(--admin-shell-text-muted)]',
                          isReporterFlow && 'hidden sm:block'
                        )}
                      >
                        {story.caption}
                      </p>
                    ) : null}

                    {workflowFeedback ? (
                      <div
                        className={cx(
                          'mb-4 rounded-[18px] border p-3 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.28)] sm:rounded-[24px] sm:p-4',
                          workflowFeedback.tone === 'success' && isReporterFlow && 'hidden sm:block',
                          workflowFeedbackToneClasses(workflowFeedback.tone)
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] dark:bg-white/10">
                            {workflowFeedback.badge}
                          </span>
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-80">
                            {workflowFeedback.readyToResubmit
                              ? 'Reporter action needed'
                              : workflowFeedback.waitingOnDesk
                                ? 'Desk handling in progress'
                                : 'Status updated'}
                          </span>
                        </div>
                        <p className="mt-3 text-xs font-semibold leading-5 sm:text-sm sm:leading-6">
                          {workflowFeedback.summary}
                        </p>
                        <p className="mt-2 text-xs leading-5 opacity-90 sm:text-sm sm:leading-6">
                          <span className="font-semibold">Next:</span> {workflowFeedback.nextAction}
                        </p>

                        {workflowFeedback.highlightedNote ? (
                          <div className="mt-3 hidden rounded-[18px] border border-current/15 bg-white/65 p-3 dark:bg-white/5 sm:block">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-80">
                              {workflowFeedback.highlightedNoteLabel || 'Latest note'}
                              {workflowFeedback.highlightedBy
                                ? ` - ${workflowFeedback.highlightedBy}`
                                : ''}
                            </p>
                            <p className="mt-1 text-sm leading-6 opacity-95">
                              {workflowFeedback.highlightedNote}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-[color:var(--admin-shell-text-muted)] sm:gap-x-3 sm:text-xs">
                      <span>{story.category || 'General'}</span>
                      <span className={cx(isReporterFlow && 'hidden sm:inline')}>•</span>
                      <span>{story.durationSeconds || 6}s</span>
                      <span className={cx(isReporterFlow && 'hidden sm:inline')}>•</span>
                      <span className={cx(isReporterFlow && 'hidden sm:inline')}>Priority {story.priority || 0}</span>
                      <span className={cx(isReporterFlow && 'hidden sm:inline')}>•</span>
                      <span>{story.views || 0} views</span>
                      <span className={cx(isReporterFlow && 'hidden sm:inline')}>•</span>
                      <span>{formatUiDate(story.updatedAt || story.publishedAt, story.updatedAt || story.publishedAt)}</span>
                    </div>

                    <div
                      className={cx(
                        'mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[color:var(--admin-shell-text-muted)]',
                        isReporterFlow && 'hidden sm:flex'
                      )}
                    >
                      {story.workflow?.createdBy?.name ? (
                        <span>Created by: {story.workflow.createdBy.name}</span>
                      ) : null}
                      {story.workflow?.assignedTo?.name ? (
                        <span>Assigned to: {story.workflow.assignedTo.name}</span>
                      ) : null}
                      {story.videoProduction?.assignedTo?.name ? (
                        <span>Video editor: {story.videoProduction.assignedTo.name}</span>
                      ) : null}
                    </div>

                    {story.linkedArticleId ? (
                      <div className="mt-4 rounded-[20px] border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300">
                        Linked article is ready in the article desk.&nbsp;
                        <Link
                          href={`/admin/articles/${story.linkedArticleId}/edit`}
                          className="font-semibold underline"
                        >
                          Open linked article
                        </Link>
                      </div>
                    ) : null}

                    {story.videoProduction?.status &&
                    story.videoProduction.status !== 'not_started' ? (
                      <div className="mt-4 rounded-[20px] border border-violet-200 bg-violet-50 px-4 py-3 text-xs text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300">
                        Video production is {formatVideoProductionStatus(
                          story.videoProduction.status
                        ).toLowerCase()}
                        {story.videoProduction.masterExportUrl ? '. Final export attached.' : '.'}
                      </div>
                    ) : null}
                  </div>

                  <div
                    className={cx(
                      'flex flex-row items-start justify-end gap-2 md:flex-col',
                      isReporterFlow && 'w-full md:w-auto'
                    )}
                  >
                    {canCreateLinkedArticles &&
                    !story.linkedArticleId &&
                    ['approved', 'scheduled', 'published'].includes(status) ? (
                      <Link
                        href={`/admin/articles/new?sourceStoryId=${encodeURIComponent(story._id)}`}
                        className={PRIMARY_BUTTON_CLASS}
                      >
                        Create Article
                      </Link>
                    ) : null}

                    {story.linkedArticleId ? (
                      <Link
                        href={`/admin/articles/${story.linkedArticleId}/edit`}
                        className={SECONDARY_BUTTON_CLASS}
                      >
                        Open Article
                      </Link>
                    ) : null}

                    {canManageVideoProduction &&
                    ['approved', 'scheduled', 'published'].includes(status) ? (
                      <button
                        type="button"
                        onClick={() => void handleStartVideoProduction(story._id)}
                        disabled={actionKey !== ''}
                        className={SECONDARY_BUTTON_CLASS}
                      >
                        {actionKey === `video:${story._id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        {story.videoProduction?.status &&
                        story.videoProduction.status !== 'not_started'
                          ? 'Video Production'
                          : 'Start Video'}
                      </button>
                    ) : null}

                    {canGenerateSocialDrafts &&
                    story.linkedArticleId &&
                    (story.videoProduction?.status === 'ready_to_publish' ||
                      story.videoProduction?.status === 'published') &&
                    story.videoProduction?.masterExportUrl ? (
                      <button
                        type="button"
                        onClick={() => void handleGenerateSocialDrafts(story._id)}
                        disabled={actionKey !== ''}
                        className={SECONDARY_BUTTON_CLASS}
                      >
                        {actionKey === `social:${story._id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        Social Drafts
                      </button>
                    ) : null}

                    {canOpenDesk ? (
                      <Link
                        href={`/admin/stories/${story._id}/edit`}
                        className={cx(SECONDARY_BUTTON_CLASS, isReporterFlow && 'w-full justify-center md:w-auto')}
                      >
                        Open Desk
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    ) : null}

                    {canDeleteStories ? (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(story._id)}
                        className="rounded-2xl border border-red-200/80 bg-red-50/80 p-2.5 text-red-600 transition-colors hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
                        aria-label="Delete story"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    ) : null}
                  </div>
                </div>

                {deleteConfirmId === story._id ? (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-red-200 bg-red-50/80 p-4 dark:border-red-500/20 dark:bg-red-500/10">
                    <p className="text-sm font-medium text-red-700 dark:text-red-300">Delete this story permanently?</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busyId === story._id}
                        onClick={() => void handleDelete(story._id)}
                        className={cx(DANGER_BUTTON_CLASS, 'disabled:cursor-not-allowed disabled:opacity-60')}
                      >
                        {busyId === story._id ? 'Deleting...' : 'Delete'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className={SECONDARY_BUTTON_CLASS}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </motion.article>
            );
          })}
        </div>
      )}
    </CmsCollectionPage>
  );
}

