import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import formatNumber from '@/lib/utils/formatNumber';

export type AnalyticsTabItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  active: boolean;
};

export type AnalyticsControlItem = {
  label: string;
  href: string;
  active: boolean;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function AnalyticsPageHeader({
  title,
  eyebrow,
  description,
  actions,
}: {
  title: string;
  eyebrow: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className="admin-shell-surface-strong rounded-[24px] p-5 sm:rounded-[32px] sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-[color:var(--admin-shell-text)] sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--admin-shell-text-muted)]">
            {description}
          </p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}

export function AnalyticsDateControls({
  rangeControls,
  compareControls,
}: {
  rangeControls: AnalyticsControlItem[];
  compareControls: AnalyticsControlItem[];
}) {
  return (
    <section className="admin-shell-surface-strong rounded-[24px] p-4">
      <div className="grid gap-4 lg:grid-cols-[1fr,auto] lg:items-center">
        <div>
          <h2 className="text-base font-bold text-[color:var(--admin-shell-text)]">
            Report window
          </h2>
          <p className="mt-1 text-sm text-[color:var(--admin-shell-text-muted)]">
            Change the time range or compare with the previous period.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <ControlGroup label="Date range" items={rangeControls} />
          <ControlGroup label="Compare" items={compareControls} />
        </div>
      </div>
    </section>
  );
}

function ControlGroup({ label, items }: { label: string; items: AnalyticsControlItem[] }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--admin-shell-text-muted)]">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={cx(
              'rounded-full px-3 py-2 text-xs font-semibold transition-colors',
              item.active
                ? 'bg-red-600 text-white'
                : 'admin-shell-toolbar-btn text-[color:var(--admin-shell-text)]'
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsTabs({ tabs }: { tabs: AnalyticsTabItem[] }) {
  return (
    <nav className="admin-shell-surface-strong overflow-x-auto rounded-[24px] p-2">
      <div className="flex min-w-max gap-2 lg:grid lg:min-w-0 lg:grid-cols-8">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={cx(
                'min-w-[150px] rounded-[18px] px-3 py-3 transition-colors lg:min-w-0',
                tab.active
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-[color:var(--admin-shell-text-muted)] hover:bg-[color:var(--admin-shell-surface-muted)] hover:text-[color:var(--admin-shell-text)]'
              )}
            >
              <span className="flex items-center gap-2 text-sm font-bold">
                <Icon className="h-4 w-4" />
                {tab.label}
              </span>
              <span className={cx('mt-1 block text-xs leading-4', tab.active ? 'text-white/80' : '')}>
                {tab.description}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'bg-blue-500/10 text-blue-600',
}: {
  label: string;
  value: number | string;
  detail: string;
  icon: LucideIcon;
  tone?: string;
}) {
  return (
    <div className="admin-shell-surface rounded-[20px] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-shell-text-muted)]">
            {label}
          </p>
          <p className="mt-2 text-2xl font-black text-[color:var(--admin-shell-text)]">
            {typeof value === 'number' ? formatNumber(value) : value}
          </p>
        </div>
        <span className={cx('rounded-2xl p-2.5', tone)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-sm leading-5 text-[color:var(--admin-shell-text-muted)]">
        {detail}
      </p>
    </div>
  );
}

export function AnalyticsPanel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('admin-shell-surface-strong rounded-[24px] p-4 sm:p-5', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-[color:var(--admin-shell-text)]">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-[color:var(--admin-shell-text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function BarList({
  items,
  valueSuffix = '',
  emptyMessage = 'No data available for this view.',
}: {
  items: Array<{ label: string; value: number; detail?: string }>;
  valueSuffix?: string;
  emptyMessage?: string;
}) {
  const maxValue = Math.max(1, ...items.map((item) => item.value));
  if (!items.length) return <EmptyAnalyticsState message={emptyMessage} />;

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-[18px] border border-[color:var(--admin-shell-border)] p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[color:var(--admin-shell-text)]">{item.label}</p>
              {item.detail ? <p className="mt-1 text-xs text-[color:var(--admin-shell-text-muted)]">{item.detail}</p> : null}
            </div>
            <span className="text-sm font-black text-[color:var(--admin-shell-text)]">
              {formatNumber(item.value)}{valueSuffix}
            </span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-black/5 dark:bg-white/10">
            <div
              className="h-2 rounded-full bg-blue-500"
              style={{ width: `${Math.max(4, (item.value / maxValue) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DataTable({
  columns,
  rows,
  emptyMessage = 'No rows for this view.',
}: {
  columns: string[];
  rows: Array<Array<React.ReactNode>>;
  emptyMessage?: string;
}) {
  if (!rows.length) return <EmptyAnalyticsState message={emptyMessage} />;

  return (
    <div className="overflow-hidden rounded-[20px] border border-[color:var(--admin-shell-border)]">
      <div
        className="hidden gap-4 border-b border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface-muted)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--admin-shell-text-muted)] md:grid"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        {columns.map((column) => <span key={column}>{column}</span>)}
      </div>
      <div className="divide-y divide-[color:var(--admin-shell-border)]">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex}>
            <div className="space-y-3 px-4 py-3 text-sm md:hidden">
              {row.map((cell, cellIndex) => (
                <div key={cellIndex}>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--admin-shell-text-muted)]">
                    {columns[cellIndex]}
                  </p>
                  <div className="text-[color:var(--admin-shell-text)]">{cell}</div>
                </div>
              ))}
            </div>
            <div
              className="hidden gap-4 px-4 py-3 text-sm md:grid"
              style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
            >
              {row.map((cell, cellIndex) => (
                <div key={cellIndex} className="text-[color:var(--admin-shell-text)]">
                  {cell}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyAnalyticsState({ message }: { message: string }) {
  return (
    <div className="rounded-[20px] border border-dashed border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface-muted)] px-4 py-5 text-sm text-[color:var(--admin-shell-text-muted)]">
      {message}
    </div>
  );
}
