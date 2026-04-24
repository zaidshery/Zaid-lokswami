'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  Activity,
  ClipboardList,
  BarChart3,
  BellRing,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Languages,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Newspaper,
  ListChecks,
  Settings,
  Settings2,
  ShieldCheck,
  Share2,
  Sun,
  UserCog,
  Video,
  X,
} from 'lucide-react';
import Logo from '@/components/layout/Logo';
import {
  formatUserRoleLabel,
  isReporterDeskRole,
  isSuperAdminRole,
  type UserRole,
} from '@/lib/auth/roles';
import { useAppStore } from '@/lib/store/appStore';

type SidebarItem = {
  href: string;
  labelEn: string;
  labelHi: string;
  icon: typeof LayoutDashboard;
};

type AdminShellUser = {
  name?: string | null;
  email?: string | null;
  role?: UserRole;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const HI = {
  adminPanel: '\u090f\u0921\u092e\u093f\u0928 \u092a\u0948\u0928\u0932',
  reporterPanel: '\u0930\u093f\u092a\u094b\u0930\u094d\u091f\u0930 \u092a\u0948\u0928\u0932',
  leadershipConsole: '\u0932\u094b\u0915\u0938\u094d\u0935\u093e\u092e\u0940 \u0932\u0940\u0921\u0930\u0936\u093f\u092a',
  adminDashboard: '\u090f\u0921\u092e\u093f\u0928 \u0921\u0948\u0936\u092c\u094b\u0930\u094d\u0921',
  reporterDesk: '\u0930\u093f\u092a\u094b\u0930\u094d\u091f\u0930 \u0921\u0947\u0938\u094d\u0915',
  leadershipDashboard: '\u0932\u094b\u0915\u0938\u094d\u0935\u093e\u092e\u0940 \u0932\u0940\u0921\u0930\u0936\u093f\u092a',
  dashboard: '\u0921\u0948\u0936\u092c\u094b\u0930\u094d\u0921',
  newsroomOverview: '\u0928\u094d\u092f\u0942\u091c\u0930\u0942\u092e \u0913\u0935\u0930\u0935\u094d\u092f\u0942',
  reviewQueue: '\u0930\u093f\u0935\u094d\u092f\u0942 \u0915\u094d\u092f\u0942',
  assignments: '\u0905\u0938\u093e\u0907\u0928\u092e\u0947\u0902\u091f\u094d\u0938',
  contentQueue: '\u0915\u0902\u091f\u0947\u0902\u091f \u0915\u094d\u092f\u0942',
  pushAlerts: '\u092a\u0941\u0936 \u0905\u0932\u0930\u094d\u091f\u094d\u0938',
  copyDesk: '\u0915\u0949\u092a\u0940 \u0921\u0947\u0938\u094d\u0915',
  myWork: '\u092e\u0947\u0930\u093e \u0915\u093e\u092e',
  articles: '\u0932\u0947\u0916',
  myArticles: '\u092e\u0947\u0930\u0947 \u0932\u0947\u0916',
  myStories: '\u092e\u0947\u0930\u0940 \u0938\u094d\u091f\u094b\u0930\u0940\u091c\u093c',
  categories: '\u0936\u094d\u0930\u0947\u0923\u093f\u092f\u093e\u0901',
  polls: '\u092a\u094b\u0932\u094d\u0938',
  stories: '\u0938\u094d\u091f\u094b\u0930\u0940\u091c\u093c',
  videos: '\u0935\u0940\u0921\u093f\u092f\u094b',
  socialPosts: '\u0938\u094b\u0936\u0932 \u092a\u094b\u0938\u094d\u091f',
  epapers: '\u0908-\u092a\u0947\u092a\u0930',
  media: '\u092e\u0940\u0921\u093f\u092f\u093e',
  analytics: '\u090f\u0928\u093e\u0932\u093f\u091f\u093f\u0915\u094d\u0938',
  revenue: '\u0930\u0947\u0935\u0947\u0928\u094d\u092f\u0942 \u0914\u0930 \u090f\u0921\u094d\u0938',
  auditLog: '\u0911\u0921\u093f\u091f \u0932\u0949\u0917',
  permissionReview: '\u092a\u0930\u092e\u093f\u0936\u0928 \u0930\u093f\u0935\u094d\u092f\u0942',
  operationsDiagnostics: '\u0911\u092a\u0930\u0947\u0936\u0928 \u0921\u093e\u092f\u0917\u094d\u0928\u094b\u0938\u094d\u091f\u093f\u0915\u094d\u0938',
  team: '\u091f\u0940\u092e',
  settings: '\u0938\u0947\u091f\u093f\u0902\u0917\u094d\u0938',
  newsroomSettings: '\u0928\u094d\u092f\u0942\u091c\u0930\u0942\u092e \u0938\u0947\u091f\u093f\u0902\u0917\u094d\u0938',
  logout: '\u0932\u0949\u0917\u0906\u0909\u091f',
  viewSite: '\u0938\u093e\u0907\u091f \u0926\u0947\u0916\u0947\u0902',
  language: '\u092d\u093e\u0937\u093e',
  switchToHindi: '\u0939\u093f\u0928\u094d\u0926\u0940 \u092e\u0947\u0902 \u092c\u0926\u0932\u0947\u0902',
  switchToEnglish: '\u0905\u0902\u0917\u094d\u0930\u0947\u091c\u0940 \u092e\u0947\u0902 \u092c\u0926\u0932\u0947\u0902',
  theme: '\u0925\u0940\u092e',
  lightTheme: '\u0932\u093e\u0907\u091f',
  darkTheme: '\u0921\u093e\u0930\u094d\u0915',
} as const;

const SUPER_ADMIN_ITEMS: SidebarItem[] = [
  { icon: LayoutDashboard, labelEn: 'Dashboard', labelHi: HI.dashboard, href: '/admin' },
  { icon: BarChart3, labelEn: 'Analytics', labelHi: HI.analytics, href: '/admin/analytics' },
  { icon: ListChecks, labelEn: 'Polls', labelHi: HI.polls, href: '/admin/polls' },
  { icon: BarChart3, labelEn: 'Revenue', labelHi: HI.revenue, href: '/admin/revenue' },
  { icon: ClipboardList, labelEn: 'Audit Log', labelHi: HI.auditLog, href: '/admin/audit-log' },
  {
    icon: ShieldCheck,
    labelEn: 'Permission Review',
    labelHi: HI.permissionReview,
    href: '/admin/permission-review',
  },
  {
    icon: Activity,
    labelEn: 'Operations Diagnostics',
    labelHi: HI.operationsDiagnostics,
    href: '/admin/operations-diagnostics',
  },
  { icon: Settings, labelEn: 'Settings', labelHi: HI.settings, href: '/admin/settings' },
];

const ADMIN_ITEMS: SidebarItem[] = [
  { icon: LayoutDashboard, labelEn: 'Dashboard', labelHi: HI.dashboard, href: '/admin' },
  { icon: BarChart3, labelEn: 'Analytics', labelHi: HI.analytics, href: '/admin/analytics' },
  { icon: FileText, labelEn: 'Review Queue', labelHi: HI.reviewQueue, href: '/admin/review-queue' },
  { icon: ClipboardList, labelEn: 'Assignments', labelHi: HI.assignments, href: '/admin/assignments' },
  { icon: FolderOpen, labelEn: 'Content Queue', labelHi: HI.contentQueue, href: '/admin/content-queue' },
  { icon: BellRing, labelEn: 'Push Alerts', labelHi: HI.pushAlerts, href: '/admin/push-alerts' },
  { icon: UserCog, labelEn: 'Team', labelHi: HI.team, href: '/admin/team' },
  { icon: FileText, labelEn: 'Articles', labelHi: HI.articles, href: '/admin/articles' },
  { icon: ListChecks, labelEn: 'Polls', labelHi: HI.polls, href: '/admin/polls' },
  { icon: FileText, labelEn: 'Stories', labelHi: HI.stories, href: '/admin/stories' },
  { icon: Video, labelEn: 'Videos', labelHi: HI.videos, href: '/admin/videos' },
  { icon: Share2, labelEn: 'Social Posts', labelHi: HI.socialPosts, href: '/admin/social-posts' },
  { icon: Newspaper, labelEn: 'E-Papers', labelHi: HI.epapers, href: '/admin/epapers' },
  { icon: ImageIcon, labelEn: 'Media', labelHi: HI.media, href: '/admin/media' },
  {
    icon: Settings2,
    labelEn: 'Newsroom Settings',
    labelHi: HI.newsroomSettings,
    href: '/admin/settings/newsroom',
  },
];

const COPY_EDITOR_ITEMS: SidebarItem[] = [
  { icon: LayoutDashboard, labelEn: 'Dashboard', labelHi: HI.dashboard, href: '/admin' },
  { icon: FileText, labelEn: 'Review Queue', labelHi: HI.reviewQueue, href: '/admin/review-queue' },
  { icon: FileText, labelEn: 'Copy Desk', labelHi: HI.copyDesk, href: '/admin/copy-desk' },
  { icon: FileText, labelEn: 'My Work', labelHi: HI.myWork, href: '/admin/my-work' },
  { icon: FileText, labelEn: 'Articles', labelHi: HI.articles, href: '/admin/articles' },
  { icon: FileText, labelEn: 'Stories', labelHi: HI.stories, href: '/admin/stories' },
  { icon: Video, labelEn: 'Videos', labelHi: HI.videos, href: '/admin/videos' },
  { icon: Share2, labelEn: 'Social Posts', labelHi: HI.socialPosts, href: '/admin/social-posts' },
  { icon: ImageIcon, labelEn: 'Media', labelHi: HI.media, href: '/admin/media' },
];

const REPORTER_ITEMS: SidebarItem[] = [
  { icon: LayoutDashboard, labelEn: 'Dashboard', labelHi: HI.dashboard, href: '/admin' },
  { icon: FileText, labelEn: 'My Work', labelHi: HI.myWork, href: '/admin/my-work' },
  { icon: FileText, labelEn: 'My Stories', labelHi: HI.myStories, href: '/admin/stories' },
  { icon: ImageIcon, labelEn: 'Media', labelHi: HI.media, href: '/admin/media' },
];

function getSidebarItems(role: UserRole | undefined): SidebarItem[] {
  if (isSuperAdminRole(role)) {
    return SUPER_ADMIN_ITEMS;
  }

  switch (role) {
    case 'admin':
      return ADMIN_ITEMS;
    case 'copy_editor':
      return COPY_EDITOR_ITEMS;
    case 'reporter':
      return REPORTER_ITEMS;
    default:
      return REPORTER_ITEMS;
  }
}

function isActiveNavItem(pathname: string, href: string) {
  const hrefPath = href.split('?')[0] || href;
  if (hrefPath === '/admin') {
    return pathname === '/admin';
  }

  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
}

function getConsoleLabel(role: UserRole | undefined, isHindi: boolean) {
  if (isSuperAdminRole(role)) {
    return isHindi ? HI.leadershipConsole : 'Lokswami Leadership';
  }

  if (isReporterDeskRole(role)) {
    return isHindi ? HI.reporterPanel : 'Reporter Panel';
  }

  return isHindi ? HI.adminPanel : 'Admin Panel';
}

function getHeaderLabel(role: UserRole | undefined, isHindi: boolean) {
  if (isSuperAdminRole(role)) {
    return isHindi ? HI.leadershipDashboard : 'Lokswami Leadership';
  }

  if (isReporterDeskRole(role)) {
    return isHindi ? HI.reporterDesk : 'Reporter Desk';
  }

  return isHindi ? HI.adminDashboard : 'Admin Dashboard';
}

function ThemeModeSwitcher({
  theme,
  isHindi,
  onChange,
  alwaysShowLabels = false,
}: {
  theme: 'dark' | 'light';
  isHindi: boolean;
  onChange: (theme: 'dark' | 'light') => void;
  alwaysShowLabels?: boolean;
}) {
  const options = [
    {
      value: 'light' as const,
      label: isHindi ? HI.lightTheme : 'Light',
      icon: Sun,
    },
    {
      value: 'dark' as const,
      label: isHindi ? HI.darkTheme : 'Dark',
      icon: Moon,
    },
  ];

  return (
    <div className="admin-shell-segmented inline-flex items-center rounded-2xl p-1">
      {options.map((option) => {
        const isActive = theme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={isActive}
            aria-label={`Switch to ${option.label} theme`}
            data-active={isActive ? 'true' : 'false'}
            className="admin-shell-segmented-option inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold"
          >
            <option.icon className="h-4 w-4" />
            <span className={alwaysShowLabels ? 'inline' : 'hidden sm:inline'}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function AdminShell({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: AdminShellUser;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const { theme, setTheme, language, toggleLanguage } = useAppStore();

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
    setMobileToolsOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileNavOpen(false);
        setMobileToolsOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;

    if (mobileNavOpen || mobileToolsOpen) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileNavOpen, mobileToolsOpen]);

  useEffect(() => {
    if (mobileNavOpen) {
      setMobileToolsOpen(false);
    }
  }, [mobileNavOpen]);

  const resolvedUser = {
    name: initialUser.name ?? null,
    email: initialUser.email ?? null,
    role: initialUser.role as UserRole | undefined,
  };
  const isHindi = isHydrated ? language === 'hi' : true;
  const effectiveTheme = isHydrated ? theme : 'dark';
  const sidebarItems = useMemo(() => getSidebarItems(resolvedUser.role), [resolvedUser.role]);
  const adminName =
    resolvedUser.name?.trim() ||
    resolvedUser.email?.split('@')[0]?.trim() ||
    'Admin';
  const adminEmail = resolvedUser.email?.trim() || '';
  const adminRoleLabel = formatUserRoleLabel(resolvedUser.role);
  const adminInitial = (adminName.charAt(0) || 'A').toUpperCase();
  const consoleLabel = getConsoleLabel(resolvedUser.role, isHindi);
  const headerLabel = getHeaderLabel(resolvedUser.role, isHindi);
  const isReporterView = isReporterDeskRole(resolvedUser.role);
  const sidebarLabel = isReporterView ? adminName : consoleLabel;
  const headerSubtitle = isReporterView ? adminName : adminRoleLabel;

  const handleLogout = async () => {
    try {
      await signOut({ redirect: false });
    } catch {
      // Ignore client sign-out errors and still force navigation to signin.
    }

    router.push('/signin');
    router.refresh();
  };

  const sidebarContent = (
    <>
      <div className="flex h-16 items-center gap-3 border-b border-[color:var(--admin-shell-border)] px-4">
        <Link href="/admin" className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex-shrink-0">
            <Logo size="sm" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs text-[color:var(--admin-shell-text-muted)]">
              {sidebarLabel}
            </div>
            <div className="truncate text-[11px] font-semibold text-[color:var(--admin-shell-text)]">
              {adminRoleLabel}
            </div>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className="admin-shell-toolbar-btn inline-flex h-10 w-10 items-center justify-center rounded-xl lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4 pb-24">
        {sidebarItems.map((item) => (
          <Link
            key={`${item.href}-${item.labelEn}`}
            href={item.href}
            onClick={() => setMobileNavOpen(false)}
            className={`group flex items-center gap-3 rounded-2xl px-3 py-3 transition-all ${
              isActiveNavItem(pathname, item.href)
                ? 'bg-[color:var(--admin-shell-active)] text-[color:var(--admin-shell-active-text)] shadow-[var(--admin-shell-shadow)]'
                : 'text-[color:var(--admin-shell-text-muted)] hover:bg-[color:var(--admin-shell-surface-muted)] hover:text-[color:var(--admin-shell-text)]'
            }`}
          >
            <div
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors ${
                isActiveNavItem(pathname, item.href)
                  ? 'bg-white/10 dark:bg-black/10'
                  : 'bg-white/80 text-[color:var(--admin-shell-text-muted)] group-hover:bg-[color:var(--admin-shell-surface-strong)] group-hover:text-[color:var(--admin-shell-text)] dark:bg-white/5'
              }`}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
              </div>
            <span className="text-sm font-medium">
              {isHindi ? item.labelHi : item.labelEn}
            </span>
          </Link>
        ))}
      </nav>

      <div className="border-t border-[color:var(--admin-shell-border)] p-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-[color:var(--admin-shell-text-muted)] transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          type="button"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm font-medium">{isHindi ? HI.logout : 'Logout'}</span>
        </button>
      </div>
    </>
  );

  return (
    <div
      suppressHydrationWarning
      className="admin-shell min-h-screen text-[color:var(--admin-shell-text)] transition-colors lg:flex lg:h-screen lg:overflow-hidden"
    >
      <button
        type="button"
        aria-label={mobileNavOpen ? 'Close mobile navigation' : mobileToolsOpen ? 'Close mobile tools' : 'Close mobile overlays'}
        onClick={() => {
          setMobileNavOpen(false);
          setMobileToolsOpen(false);
        }}
        className={cx(
          'fixed inset-0 z-30 bg-black/55 transition-opacity lg:hidden',
          mobileNavOpen || mobileToolsOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      />
      <aside
        className={cx(
          'admin-shell-surface-strong fixed inset-y-0 left-0 z-40 flex w-[min(86vw,320px)] flex-col overflow-hidden border-r border-[color:var(--admin-shell-border-strong)] transition-transform duration-300 lg:w-[272px] lg:translate-x-0',
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      <main
        className="relative min-h-screen min-w-0 flex-1 overflow-y-auto transition-colors lg:ml-[272px] lg:h-screen"
      >
        <header
          className={cx(
            'admin-shell-surface fixed left-0 right-0 top-0 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-[color:var(--admin-shell-border)] px-4 py-3 sm:px-6 lg:left-[272px]',
            mobileToolsOpen ? 'z-50' : 'z-20'
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen((current) => !current)}
              className="admin-shell-toolbar-btn inline-flex h-10 w-10 items-center justify-center rounded-xl lg:hidden"
              aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={mobileNavOpen}
            >
              {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-[color:var(--admin-shell-text)] sm:text-lg">
                {headerLabel}
              </h1>
              <p className="truncate text-xs text-[color:var(--admin-shell-text-muted)]">
                {headerSubtitle}
              </p>
            </div>
          </div>

          <div className="relative ml-auto flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <button
              onClick={toggleLanguage}
              className="admin-shell-toolbar-btn hidden items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold sm:inline-flex"
              aria-label={isHindi ? 'Switch to English' : 'Switch to Hindi'}
              type="button"
            >
              <Languages className="h-3.5 w-3.5" />
              <span>{isHindi ? '\u0939\u093f' : 'EN'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileNavOpen(false);
                setMobileToolsOpen((current) => !current);
              }}
              className="admin-shell-toolbar-btn inline-flex h-10 w-10 items-center justify-center rounded-xl sm:hidden"
              aria-label={mobileToolsOpen ? 'Close display and language tools' : 'Open display and language tools'}
              aria-expanded={mobileToolsOpen}
              aria-controls="admin-mobile-tools-menu"
            >
              <Settings2 className="h-4 w-4" />
            </button>
            <div className="hidden sm:block">
              <ThemeModeSwitcher
                theme={effectiveTheme}
                isHindi={isHindi}
                onChange={setTheme}
                alwaysShowLabels={false}
              />
            </div>
            <Link
              href="/main"
              className="admin-shell-toolbar-btn hidden rounded-xl px-3 py-2 text-sm font-medium md:inline-flex"
            >
              {isHindi ? HI.viewSite : 'View Site'}
            </Link>
            <div className="admin-shell-surface hidden rounded-2xl px-3 py-2 text-right sm:block">
              <p className="text-sm font-semibold text-[color:var(--admin-shell-text)]">
                {adminName}
              </p>
              {adminEmail ? (
                <p className="text-xs text-[color:var(--admin-shell-text-muted)]">{adminEmail}</p>
              ) : null}
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-red-600 shadow-sm">
              <span className="text-sm font-bold text-white">{adminInitial}</span>
            </div>

            {mobileToolsOpen ? (
              <div
                id="admin-mobile-tools-menu"
                className="admin-shell-surface-strong absolute right-0 top-12 z-50 w-[min(calc(100vw-2rem),18rem)] rounded-[24px] p-3 shadow-[var(--admin-shell-shadow-strong)] sm:hidden"
              >
                <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-shell-text-muted)]">
                  {isHindi ? HI.language : 'Language'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    toggleLanguage();
                    setMobileToolsOpen(false);
                  }}
                  aria-label={isHindi ? HI.switchToEnglish : HI.switchToHindi}
                  className="admin-shell-toolbar-btn mt-2 flex w-full items-center justify-between rounded-2xl px-3 py-2 text-sm font-semibold [&>span:first-child]:hidden"
                >
                  <span>{isHindi ? 'English' : 'हिन्दी'}</span>
                  <span>{isHindi ? HI.switchToEnglish : HI.switchToHindi}</span>
                  <span className="text-xs text-[color:var(--admin-shell-text-muted)]">{isHindi ? 'EN' : 'HI'}</span>
                </button>
                <div className="mt-3">
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-shell-text-muted)]">
                    {isHindi ? HI.theme : 'Theme'}
                  </p>
                  <div className="mt-2">
                    <ThemeModeSwitcher
                      theme={effectiveTheme}
                      isHindi={isHindi}
                      onChange={(nextTheme) => {
                        setTheme(nextTheme);
                        setMobileToolsOpen(false);
                      }}
                      alwaysShowLabels
                    />
                  </div>
                </div>
                <Link
                  href="/main"
                  onClick={() => setMobileToolsOpen(false)}
                  className="admin-shell-toolbar-btn mt-3 flex w-full items-center justify-center rounded-2xl px-3 py-2 text-sm font-medium"
                >
                  {isHindi ? HI.viewSite : 'View Site'}
                </Link>
              </div>
            ) : null}
          </div>
        </header>

        <div
          className={cx(
            'relative p-4 pt-24 sm:p-6 sm:pt-28 lg:p-8 lg:pt-28',
            isReporterView && 'pb-28 lg:pb-8'
          )}
        >
          {children}
        </div>
      </main>

      {isReporterView ? (
        <nav className="admin-shell-surface-strong fixed inset-x-4 bottom-4 z-20 rounded-[26px] px-2 py-2 shadow-[var(--admin-shell-shadow-strong)] lg:hidden">
          <div className="grid grid-cols-4 gap-1">
            {sidebarItems.map((item) => {
              const isActive = isActiveNavItem(pathname, item.href);

              return (
                <Link
                  key={`${item.href}-${item.labelEn}-mobile`}
                  href={item.href}
                  className={cx(
                    'flex min-w-0 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-center text-[10px] font-semibold transition-colors',
                    isActive
                      ? 'bg-[color:var(--admin-shell-active)] text-[color:var(--admin-shell-active-text)]'
                      : 'text-[color:var(--admin-shell-text-muted)]'
                  )}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="w-full truncate">{isHindi ? item.labelHi : item.labelEn}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
