import Link from 'next/link';
import {
  Activity,
  FileText,
  Inbox,
  MessageSquare,
  Newspaper,
  Plus,
  Video,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getAdminDashboardData } from '@/lib/admin/dashboard';
import { formatUiDate } from '@/lib/utils/dateFormat';
import formatNumber from '@/lib/utils/formatNumber';

type ActionCard = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tone: string;
};

function formatDate(value: string) {
  return formatUiDate(value, 'Unknown date');
}

function formatDuration(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

const quickActions: ActionCard[] = [
  {
    label: 'Upload Article',
    description: 'Create a new article',
    href: '/admin/articles/new',
    icon: FileText,
    tone: 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20',
  },
  {
    label: 'Create Story',
    description: 'Publish a new story',
    href: '/admin/stories/new',
    icon: Activity,
    tone: 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20',
  },
  {
    label: 'Upload Video',
    description: 'Add a new video',
    href: '/admin/videos/new',
    icon: Video,
    tone: 'bg-purple-500/10 text-purple-600 hover:bg-purple-500/20',
  },
  {
    label: 'Manage E-Papers',
    description: 'Review published editions',
    href: '/admin/epapers',
    icon: Newspaper,
    tone: 'bg-orange-500/10 text-orange-600 hover:bg-orange-500/20',
  },
  {
    label: 'Contact Inbox',
    description: 'Respond to reader messages',
    href: '/admin/contact-messages',
    icon: MessageSquare,
    tone: 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20',
  },
];

export default async function AdminDashboardPage() {
  const dashboard = await getAdminDashboardData();

  const stats = [
    {
      label: 'Total Articles',
      value: dashboard.stats.totalArticles,
      note: 'Published and draft articles',
      icon: FileText,
      tone: 'bg-blue-500/15 text-blue-600',
    },
    {
      label: 'Published Videos',
      value: dashboard.stats.totalVideos,
      note: 'Videos currently available',
      icon: Video,
      tone: 'bg-purple-500/15 text-purple-600',
    },
    {
      label: 'Published E-Papers',
      value: dashboard.stats.totalEPapers,
      note: 'Editions available to readers',
      icon: Newspaper,
      tone: 'bg-orange-500/15 text-orange-600',
    },
    {
      label: 'New Messages',
      value: dashboard.stats.newMessages,
      note: 'Inbox items awaiting review',
      icon: Inbox,
      tone: 'bg-emerald-500/15 text-emerald-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.href} href={action.href}>
              <div
                className={`rounded-2xl border border-zinc-200 p-6 shadow-sm transition-all hover:shadow-md dark:border-zinc-800 ${action.tone}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl p-3 ${action.tone}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
                      {action.label}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {action.description}
                    </p>
                  </div>
                  <Plus className="ml-auto h-5 w-5 opacity-50" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {stat.label}
                </p>
                <p className="mt-2 text-3xl font-black text-zinc-900 dark:text-zinc-100">
                  {formatNumber(stat.value)}
                </p>
              </div>
              <div className={`rounded-xl p-3 ${stat.tone}`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">{stat.note}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Operational Snapshot
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Source:{' '}
                {dashboard.source === 'hybrid'
                  ? 'MongoDB + local file store'
                  : dashboard.source === 'mongodb'
                    ? 'MongoDB live data'
                    : 'Local file store'}
              </p>
            </div>
            <Link
              href="/admin/contact-messages"
              className="text-sm font-semibold text-red-600 transition-colors hover:text-red-500"
            >
              Open Inbox
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                All Messages
              </p>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {formatNumber(dashboard.inbox.all)}
              </p>
            </div>
            <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                New
              </p>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {formatNumber(dashboard.inbox.new)}
              </p>
            </div>
            <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                In Progress
              </p>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {formatNumber(dashboard.inbox.inProgress)}
              </p>
            </div>
            <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Resolved
              </p>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {formatNumber(dashboard.inbox.resolved)}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Popular Content
          </h2>
          <div className="mt-6 space-y-3">
            {dashboard.popularArticles.length ? (
              dashboard.popularArticles.map((article, index) => (
                <Link
                  key={article.id}
                  href={`/admin/articles/${encodeURIComponent(article.id)}/edit`}
                  className="flex items-center gap-4 rounded-2xl bg-zinc-50 p-4 transition-colors hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                >
                  <span className="text-lg font-black text-red-600">#{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {article.title}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {formatNumber(article.views)} views
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                No popular articles yet.
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Recent Articles
            </h2>
            <Link
              href="/admin/articles"
              className="text-sm font-semibold text-red-600 transition-colors hover:text-red-500"
            >
              View All
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            {dashboard.recentArticles.length ? (
              dashboard.recentArticles.map((article) => (
                <Link
                  key={article.id}
                  href={`/admin/articles/${encodeURIComponent(article.id)}/edit`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-50 p-4 transition-colors hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {article.title}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {article.category} / {article.author}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
                    {formatDate(article.publishedAt)}
                  </span>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                No articles available yet.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Recent Videos
            </h2>
            <Link
              href="/admin/videos"
              className="text-sm font-semibold text-red-600 transition-colors hover:text-red-500"
            >
              View All
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            {dashboard.recentVideos.length ? (
              dashboard.recentVideos.map((video) => (
                <Link
                  key={video.id}
                  href={`/admin/videos/${encodeURIComponent(video.id)}/edit`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-50 p-4 transition-colors hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {video.title}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {video.category} / {formatNumber(video.views)} views
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
                    {formatDuration(video.duration)}
                  </span>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                No videos available yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
