import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCircle2, FileText, Image as ImageIcon, Newspaper, Video } from 'lucide-react';
import { getAdminSession } from '@/lib/auth/admin';
import { getMyWorkOverview } from '@/lib/admin/articleWorkflowOverview';
import { canViewPage } from '@/lib/auth/permissions';
import { formatUserRoleLabel, isCopyEditorRole, isReporterDeskRole } from '@/lib/auth/roles';
import { formatUiDate } from '@/lib/utils/dateFormat';
import formatNumber from '@/lib/utils/formatNumber';
import {
  buildWorkflowFeedbackSummary,
  type WorkflowFeedbackTone,
} from '@/lib/workflow/feedback';
import { isWorkflowStatus } from '@/lib/workflow/types';

type LinkCard = {
  title: string;
  description: string;
  href: string;
  icon: typeof FileText;
  tone: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const PANEL_CLASS = 'admin-shell-surface-strong rounded-[26px] p-4 sm:rounded-[30px] sm:p-6';

const SOFT_CARD_CLASS =
  'admin-shell-surface-muted rounded-[24px] p-4 shadow-[0_18px_48px_-40px_rgba(15,23,42,0.14)] dark:shadow-[0_18px_48px_-40px_rgba(0,0,0,0.35)]';

const EMPTY_STATE_CLASS =
  'rounded-[24px] border border-dashed border-[color:var(--admin-shell-border-strong)] bg-[color:var(--admin-shell-surface-muted)] p-4 text-sm leading-6 text-[color:var(--admin-shell-text-muted)]';

const META_CHIP_CLASS =
  'admin-shell-surface inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-shell-text-muted)]';

function getWorkflowFeedbackToneClass(tone: WorkflowFeedbackTone) {
  switch (tone) {
    case 'danger':
      return 'border-red-200/80 bg-red-50/80 text-red-900 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-100';
    case 'warning':
      return 'border-amber-200/80 bg-amber-50/80 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100';
    case 'info':
      return 'border-blue-200/80 bg-blue-50/80 text-blue-900 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-100';
    case 'success':
      return 'border-emerald-200/80 bg-emerald-50/80 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100';
    case 'neutral':
    default:
      return 'border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface)] text-[color:var(--admin-shell-text)]';
  }
}

function getIntro(role: string) {
  switch (role) {
    case 'reporter':
      return 'Reporter desk for your story drafts, submissions, assignments, and media work.';
    case 'copy_editor':
      return 'Copy desk view for the work you are actively shaping across articles, stories, videos, and e-paper editions.';
    case 'admin':
    case 'super_admin':
      return 'Operations view for the items you own directly, including edition production work alongside the content desk.';
    default:
      return 'A dedicated workspace entry point for role-based newsroom tasks.';
  }
}

function getLinkCards(role: string): LinkCard[] {
  const isReporter = isReporterDeskRole(role);
  const cards: LinkCard[] = [];

  if (isReporter) {
    cards.push({
      title: 'Create Story',
      description: 'Start a new reporting draft with media, source notes, and desk handoff details.',
      href: '/admin/stories/new',
      icon: Video,
      tone: 'bg-fuchsia-500/10 text-fuchsia-600',
    });
    cards.push({
      title: 'My Stories',
      description: 'Open the story desk for the cards you created or that are assigned to you.',
      href: '/admin/stories',
      icon: Video,
      tone: 'bg-fuchsia-500/10 text-fuchsia-600',
    });
    cards.push({
      title: 'Media Library',
      description: 'Upload or manage the image assets tied to your current story work.',
      href: '/admin/media',
      icon: ImageIcon,
      tone: 'bg-emerald-500/10 text-emerald-600',
    });
  } else {
    if (isCopyEditorRole(role)) {
      cards.push({
        title: 'Copy Desk',
        description: 'Pick up submitted reporter stories and continue active copy desk work.',
        href: '/admin/copy-desk',
        icon: FileText,
        tone: 'bg-violet-500/10 text-violet-600',
      });
    } else {
      cards.push({
        title: 'Review Queue',
        description: 'Move into the shared editorial queue for articles, videos, stories, and e-papers.',
        href: '/admin/review-queue',
        icon: FileText,
        tone: 'bg-violet-500/10 text-violet-600',
      });
    }
    cards.push({
      title: 'Article Desk',
      description: 'Jump into article editing and current desk content.',
      href: '/admin/articles',
      icon: FileText,
      tone: 'bg-blue-500/10 text-blue-600',
    });
    cards.push({
      title: 'Media Library',
      description: 'Upload or manage the images and media tied to your current work.',
      href: '/admin/media',
      icon: ImageIcon,
      tone: 'bg-emerald-500/10 text-emerald-600',
    });
    cards.push({
      title: 'E-Paper Desk',
      description: 'Open edition production, hotspot QA, and publish-readiness work.',
      href: '/admin/epapers',
      icon: Newspaper,
      tone: 'bg-orange-500/10 text-orange-600',
    });
  }

  return cards;
}

function formatStatusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatContentTypeLabel(contentType: string) {
  return contentType === 'epaper' ? 'E-Paper' : formatStatusLabel(contentType);
}

export default async function AdminMyWorkPage() {
  const admin = await getAdminSession();
  if (!admin) {
    redirect('/signin?redirect=/admin/my-work');
  }
  if (!canViewPage(admin.role, 'my_work')) {
    redirect('/admin');
  }

  const myWork = await getMyWorkOverview(admin);
  const cards = getLinkCards(admin.role);
  const isReporter = isReporterDeskRole(admin.role);
  const isCopyEditor = isCopyEditorRole(admin.role);
  const emptyStateMessage = isReporter
    ? 'No drafts, submissions, or assignments yet. Your story work will appear here as soon as it starts moving through the desk.'
    : 'No owned or assigned workflow items yet. Content and edition desk work will appear here as it lands.';
  const contextStats = isReporter
    ? [
        {
          label: 'My Drafts',
          value: myWork.counts.draft || 0,
          note: 'Draft story cards still being prepared',
          tone: 'bg-blue-500/10 text-blue-600',
          icon: FileText,
        },
        {
          label: 'Waiting On Desk',
          value:
            Number(myWork.counts.submitted || 0) +
            Number(myWork.counts.assigned || 0) +
            Number(myWork.counts.in_review || 0) +
            Number(myWork.counts.copy_edit || 0) +
            Number(myWork.counts.ready_for_approval || 0) +
            Number(myWork.counts.approved || 0) +
            Number(myWork.counts.scheduled || 0),
          note: 'Submitted stories currently moving through desk review and approval',
          tone: 'bg-violet-500/10 text-violet-600',
          icon: Video,
        },
        {
          label: 'Needs Changes',
          value: Number(myWork.counts.changes_requested || 0) + Number(myWork.counts.rejected || 0),
          note: 'Desk-returned items that can be revised and resubmitted',
          tone: 'bg-red-500/10 text-red-600',
          icon: FileText,
        },
        {
          label: 'In Active Review',
          value:
            Number(myWork.counts.assigned || 0) +
            Number(myWork.counts.in_review || 0) +
            Number(myWork.counts.copy_edit || 0),
          note: 'Stories currently assigned, reviewed, or copy-checked by the desk',
          tone: 'bg-orange-500/10 text-orange-600',
          icon: CheckCircle2,
        },
      ]
    : [
        {
          label: 'My Drafts',
          value: myWork.counts.draft || 0,
          note: 'Draft articles and story cards still being prepared',
          tone: 'bg-blue-500/10 text-blue-600',
          icon: FileText,
        },
        {
          label: 'Submitted',
          value: myWork.counts.submitted || 0,
          note: 'Waiting for desk review or the next workflow action',
          tone: 'bg-violet-500/10 text-violet-600',
          icon: Video,
        },
        {
          label: 'Assigned To Me',
          value:
            Number(myWork.counts.assigned || 0) +
            Number(myWork.productionCounts.pages_ready || 0) +
            Number(myWork.productionCounts.ocr_review || 0) +
            Number(myWork.productionCounts.hotspot_mapping || 0) +
            Number(myWork.productionCounts.qa_review || 0) +
            Number(myWork.productionCounts.ready_to_publish || 0),
          note: 'Owned content, assignments, and edition items currently on your plate',
          tone: 'bg-orange-500/10 text-orange-600',
          icon: Newspaper,
        },
      ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-[color:var(--admin-shell-border)] bg-[radial-gradient(circle_at_top_left,rgba(185,28,28,0.10),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_28%),var(--admin-bg-depth)] p-6 text-[color:var(--admin-shell-text)] shadow-[var(--admin-shell-shadow-strong)] sm:rounded-[36px] sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-10 top-0 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-500/14" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-500/14" />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-red-600 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
              {formatUserRoleLabel(admin.role)}
            </div>
            <h1 className="mt-5 text-3xl font-black tracking-tight text-[color:var(--admin-shell-text)] sm:text-5xl">
              My Work
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[color:var(--admin-shell-text-muted)] sm:text-[15px]">
              {getIntro(admin.role)}
            </p>
          </div>
          <Link
            href={isReporter ? '/admin/stories/new' : isCopyEditor ? '/admin/copy-desk' : '/admin/review-queue'}
            className="admin-shell-toolbar-btn inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold"
          >
            {isReporter ? 'Create Story' : isCopyEditor ? 'Open Copy Desk' : 'Open Review Queue'}
          </Link>
        </div>
      </section>

      <section
        className={cx(
          'grid gap-4',
          isReporter ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 lg:grid-cols-3',
          isCopyEditor && 'hidden lg:grid'
        )}
      >
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className={cx(
                'admin-shell-surface-strong rounded-[24px] p-4 transition-all hover:-translate-y-0.5 sm:rounded-[28px] sm:p-6',
                isReporter && 'min-h-[132px] sm:min-h-0'
              )}
            >
              <div className={cx('inline-flex rounded-2xl p-3', card.tone, isReporter && 'p-2.5 sm:p-3')}>
                <Icon className={cx('h-5 w-5', isReporter && 'h-4 w-4 sm:h-5 sm:w-5')} />
              </div>
              <h2 className={cx('mt-4 text-lg font-bold text-[color:var(--admin-shell-text)]', isReporter && 'text-base sm:text-lg')}>
                {card.title}
              </h2>
              <p
                className={cx(
                  'mt-2 text-sm leading-6 text-[color:var(--admin-shell-text-muted)]',
                  isReporter && 'hidden text-xs leading-5 sm:block sm:text-sm sm:leading-6'
                )}
              >
                {card.description}
              </p>
            </Link>
          );
        })}
      </section>

      {isCopyEditor ? (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {contextStats.map((stat) => (
            <div
              key={stat.label}
              className="admin-shell-surface-strong rounded-[24px] p-4 sm:rounded-[28px] sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-[color:var(--admin-shell-text-muted)] sm:text-sm">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-2xl font-black text-[color:var(--admin-shell-text)] sm:mt-3 sm:text-3xl">
                    {formatNumber(stat.value)}
                  </p>
                </div>
                <div className={`rounded-2xl p-2.5 sm:p-3 ${stat.tone}`}>
                  <stat.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
              </div>
              <p className="mt-4 hidden text-sm text-[color:var(--admin-shell-text-muted)] sm:block">{stat.note}</p>
            </div>
          ))}
        </section>
      ) : null}

      <section className={PANEL_CLASS}>
        <div>
          <div>
            <h2 className="text-xl font-bold text-[color:var(--admin-shell-text)]">
              Current Work
            </h2>
            <p className="mt-1 text-sm text-[color:var(--admin-shell-text-muted)]">
              {isReporter
                ? 'Your current ownership and assignment view across active story work.'
                : 'Your current ownership and assignment view across content and edition production.'}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-2.5 sm:mt-6 sm:space-y-3">
          {myWork.items.length ? (
            myWork.items.map((item) => (
              (() => {
                const workflowFeedback =
                  isReporter &&
                  (item.contentType === 'article' || item.contentType === 'story') &&
                  isWorkflowStatus(item.status)
                    ? buildWorkflowFeedbackSummary({
                        contentLabel: item.contentType === 'article' ? 'Article' : 'Story',
                        status: item.status,
                        assignedToName: item.assignedToName,
                        returnForChangesReason: item.copyEditorSummary?.returnForChangesReason || '',
                        copyEditorNotes: item.copyEditorSummary?.copyEditorNotes || '',
                      })
                    : null;

                return (
                  <Link
                    key={`${item.contentType}-${item.id}`}
                    href={item.editHref}
                    className={cx(
                      'flex flex-col gap-2.5 transition-colors hover:border-zinc-300/90 hover:bg-zinc-100/80 dark:hover:border-white/15 dark:hover:bg-white/[0.06] sm:gap-3',
                      SOFT_CARD_CLASS
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-[color:var(--admin-shell-text)] sm:text-sm">
                          {item.title}
                        </p>
                        <p className="mt-1 text-[11px] text-[color:var(--admin-shell-text-muted)] sm:text-xs">
                          {item.category} / {item.author} / {formatContentTypeLabel(item.contentType)}
                        </p>
                      </div>
                      <span className={META_CHIP_CLASS}>
                        {formatStatusLabel(item.status)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-[color:var(--admin-shell-text-muted)] sm:gap-3 sm:text-xs">
                      <span>Updated {formatUiDate(item.updatedAt, item.updatedAt)}</span>
                      {item.assignedToName ? <span className="hidden sm:inline">Assignee: {item.assignedToName}</span> : null}
                      {item.createdByName ? <span className="hidden sm:inline">Created by: {item.createdByName}</span> : null}
                    </div>
                    {workflowFeedback ? (
                      <div
                        className={cx(
                          'rounded-[18px] border p-3 sm:rounded-[20px]',
                          getWorkflowFeedbackToneClass(workflowFeedback.tone),
                          workflowFeedback.tone === 'success' && 'hidden sm:block'
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                            {workflowFeedback.badge}
                          </span>
                          {workflowFeedback.readyToResubmit ? (
                            <span className="rounded-full border border-current/20 bg-white/70 px-2 py-1 text-[11px] font-semibold">
                              Can resubmit
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs leading-5 sm:text-sm sm:leading-6">{workflowFeedback.nextAction}</p>
                        {workflowFeedback.highlightedNote ? (
                          <p className="mt-2 hidden line-clamp-2 text-xs leading-5 opacity-90 sm:block">
                            <span className="font-semibold">
                              {workflowFeedback.highlightedNoteLabel || 'Desk feedback'}:
                            </span>{' '}
                            {workflowFeedback.highlightedNote}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </Link>
                );
              })()
            ))
          ) : (
            <div className={EMPTY_STATE_CLASS}>
              {emptyStateMessage}
            </div>
          )}
        </div>
      </section>

      <section
        className={cx(
          'grid gap-4',
          isReporter ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 lg:grid-cols-3',
          isCopyEditor && 'hidden'
        )}
      >
        {contextStats.map((stat) => (
          <div
            key={stat.label}
            className="admin-shell-surface-strong rounded-[24px] p-4 sm:rounded-[28px] sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-[color:var(--admin-shell-text-muted)] sm:text-sm">
                  {stat.label}
                </p>
                <p className="mt-2 text-2xl font-black text-[color:var(--admin-shell-text)] sm:mt-3 sm:text-3xl">
                  {formatNumber(stat.value)}
                </p>
              </div>
              <div className={`rounded-2xl p-2.5 sm:p-3 ${stat.tone}`}>
                <stat.icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </div>
            <p className="mt-4 hidden text-sm text-[color:var(--admin-shell-text-muted)] sm:block">{stat.note}</p>
          </div>
        ))}
      </section>

      {isCopyEditor ? (
        <section className="grid grid-cols-2 gap-4 lg:hidden">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={`${card.href}-mobile`}
                href={card.href}
                className="admin-shell-surface-strong rounded-[24px] p-4 transition-all hover:-translate-y-0.5"
              >
                <div className={cx('inline-flex rounded-2xl p-2.5', card.tone)}>
                  <Icon className="h-4 w-4" />
                </div>
                <h2 className="mt-4 text-base font-bold text-[color:var(--admin-shell-text)]">
                  {card.title}
                </h2>
              </Link>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
