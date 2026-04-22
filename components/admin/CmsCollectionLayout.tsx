import type { ReactNode } from 'react';

type HeroAccent = 'red' | 'rose' | 'blue' | 'amber';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const HERO_ACCENTS: Record<
  HeroAccent,
  {
    shell: string;
    orbPrimary: string;
    orbSecondary: string;
    eyebrow: string;
  }
> = {
  red: {
    shell:
      'border-[color:var(--admin-shell-border)] bg-[radial-gradient(circle_at_top_left,rgba(185,28,28,0.10),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.08),transparent_28%),var(--admin-bg-depth)]',
    orbPrimary: 'bg-red-500/10 dark:bg-red-500/14',
    orbSecondary: 'bg-blue-500/10 dark:bg-blue-500/14',
    eyebrow:
      'border-red-500/20 bg-red-500/10 text-red-600 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300',
  },
  rose: {
    shell:
      'border-[color:var(--admin-shell-border)] bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.10),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.08),transparent_28%),var(--admin-bg-depth)]',
    orbPrimary: 'bg-rose-500/10 dark:bg-rose-500/14',
    orbSecondary: 'bg-blue-500/10 dark:bg-blue-500/14',
    eyebrow:
      'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300',
  },
  blue: {
    shell:
      'border-[color:var(--admin-shell-border)] bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.10),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_28%),var(--admin-bg-depth)]',
    orbPrimary: 'bg-blue-500/10 dark:bg-blue-500/14',
    orbSecondary: 'bg-emerald-500/10 dark:bg-emerald-500/14',
    eyebrow:
      'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-300',
  },
  amber: {
    shell:
      'border-[color:var(--admin-shell-border)] bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.08),transparent_28%),var(--admin-bg-depth)]',
    orbPrimary: 'bg-amber-500/10 dark:bg-amber-500/14',
    orbSecondary: 'bg-violet-500/10 dark:bg-violet-500/14',
    eyebrow:
      'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300',
  },
};

export const CMS_COLLECTION_PANEL_CLASS = 'admin-shell-surface-strong rounded-[30px] p-6';

export const CMS_COLLECTION_SOFT_CARD_CLASS =
  'admin-shell-surface-muted rounded-[24px] p-4 shadow-[0_18px_48px_-40px_rgba(15,23,42,0.14)] dark:shadow-[0_18px_48px_-40px_rgba(0,0,0,0.35)]';

export const CMS_COLLECTION_METRIC_CARD_CLASS =
  'admin-shell-surface rounded-[26px] p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.16)] dark:shadow-[0_22px_70px_-46px_rgba(0,0,0,0.38)]';

export const CMS_COLLECTION_EMPTY_STATE_CLASS =
  'rounded-[24px] border border-dashed border-[color:var(--admin-shell-border-strong)] bg-[color:var(--admin-shell-surface-muted)] p-6 text-sm leading-6 text-[color:var(--admin-shell-text-muted)]';

export const CMS_COLLECTION_META_CHIP_CLASS =
  'admin-shell-surface inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-shell-text-muted)]';

export const CMS_COLLECTION_FILTER_INPUT_CLASS =
  'w-full rounded-2xl border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface)] px-4 py-3 text-sm text-[color:var(--admin-shell-text)] outline-none transition-colors placeholder:text-[color:var(--admin-shell-text-muted)] focus:border-red-400/40';

export const CMS_COLLECTION_SECONDARY_BUTTON_CLASS =
  'admin-shell-toolbar-btn inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold';

export const CMS_COLLECTION_PRIMARY_BUTTON_CLASS =
  'admin-shell-toolbar-btn inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold';

export const CMS_COLLECTION_DANGER_BUTTON_CLASS =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20';

export function CmsCollectionPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx('mx-auto max-w-[1640px] space-y-8', className)}>{children}</div>;
}

export function CmsCollectionHero({
  eyebrow,
  title,
  description,
  aside,
  meta,
  accent = 'red',
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  description: ReactNode;
  aside?: ReactNode;
  meta?: ReactNode;
  accent?: HeroAccent;
}) {
  const tone = HERO_ACCENTS[accent];

  return (
    <section
      className={cx(
        'relative overflow-hidden rounded-[36px] border p-8 text-[color:var(--admin-shell-text)] shadow-[var(--admin-shell-shadow-strong)] lg:p-10',
        tone.shell
      )}
    >
      <div className={cx('pointer-events-none absolute -right-10 top-0 h-48 w-48 rounded-full blur-3xl', tone.orbPrimary)} />
      <div className={cx('pointer-events-none absolute bottom-0 left-0 h-40 w-40 rounded-full blur-3xl', tone.orbSecondary)} />

      <div className={cx('relative', Boolean(aside) && 'grid gap-8 xl:grid-cols-[1.25fr,0.85fr]')}>
        <div>
          <div
            className={cx(
              'inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em]',
              tone.eyebrow
            )}
          >
            {eyebrow}
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-[color:var(--admin-shell-text)] sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-[color:var(--admin-shell-text-muted)] sm:text-[15px]">
            {description}
          </p>
          {meta ? <div className="mt-6 flex flex-wrap gap-3">{meta}</div> : null}
        </div>

        {aside ? <div>{aside}</div> : null}
      </div>
    </section>
  );
}

export function CmsCollectionMetricGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cx('grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4', className)}>{children}</section>;
}

export function CmsCollectionMetricCard({
  label,
  value,
  note,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx(CMS_COLLECTION_METRIC_CARD_CLASS, className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-shell-text-muted)]">
        {label}
      </p>
      <p className="mt-4 text-4xl font-black tracking-tight text-[color:var(--admin-shell-text)]">
        {value}
      </p>
      {note ? (
        <p className="mt-3 text-sm text-[color:var(--admin-shell-text-muted)]">{note}</p>
      ) : null}
    </div>
  );
}
