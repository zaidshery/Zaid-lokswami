'use client';

import type { ReactNode } from 'react';

type SidebarWidth = 'narrow' | 'default' | 'wide' | 'quarter';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const SIDEBAR_WIDTH_CLASS: Record<SidebarWidth, string> = {
  narrow: 'xl:grid-cols-[minmax(0,1fr)_360px]',
  default: 'xl:grid-cols-[minmax(0,1fr)_380px]',
  wide: 'xl:grid-cols-[minmax(0,1fr)_400px]',
  quarter: 'xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]',
};

export function CmsEditorCanvas({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx('mx-auto max-w-[1500px]', className)}>{children}</div>;
}

export function CmsEditorColumns({
  children,
  className,
  sidebarWidth = 'default',
  stacked = false,
}: {
  children: ReactNode;
  className?: string;
  sidebarWidth?: SidebarWidth;
  stacked?: boolean;
}) {
  return (
    <div
      className={cx(
        'grid gap-4 sm:gap-8',
        !stacked && SIDEBAR_WIDTH_CLASS[sidebarWidth],
        className
      )}
    >
      {children}
    </div>
  );
}

export function CmsEditorMain({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx('space-y-4 sm:space-y-6', className)}>{children}</div>;
}

export function CmsEditorSidebar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside className={cx('space-y-3 sm:space-y-4 xl:sticky xl:top-24 xl:self-start', className)}>
      {children}
    </aside>
  );
}
