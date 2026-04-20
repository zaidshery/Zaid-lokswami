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
} from 'lucide-react';
import Logo from '@/components/layout/Logo';
import {
  formatUserRoleLabel,
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

const HI = {
  adminPanel: '\u090f\u0921\u092e\u093f\u0928 \u092a\u0948\u0928\u0932',
  leadershipConsole: '\u0932\u094b\u0915\u0938\u094d\u0935\u093e\u092e\u0940 \u0932\u0940\u0921\u0930\u0936\u093f\u092a',
  adminDashboard: '\u090f\u0921\u092e\u093f\u0928 \u0921\u0948\u0936\u092c\u094b\u0930\u094d\u0921',
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
  { icon: FileText, labelEn: 'Stories', labelHi: HI.stories, href: '/admin/stories' },
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

  return isHindi ? HI.adminPanel : 'Admin Panel';
}

function getHeaderLabel(role: UserRole | undefined, isHindi: boolean) {
  if (isSuperAdminRole(role)) {
    return isHindi ? HI.leadershipDashboard : 'Lokswami Leadership';
  }

  return isHindi ? HI.adminDashboard : 'Admin Dashboard';
}

function ThemeModeSwitcher({
  theme,
  isHindi,
  onChange,
}: {
  theme: 'dark' | 'light';
  isHindi: boolean;
  onChange: (theme: 'dark' | 'light') => void;
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
            <span className="hidden sm:inline">{option.label}</span>
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
  const { theme, setTheme, language, toggleLanguage } = useAppStore();

  useEffect(() => {
    setIsHydrated(true);
  }, []);

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
      <div className="flex h-16 items-center justify-between border-b border-[color:var(--admin-shell-border)] px-4">
        <Link href="/admin" className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex-shrink-0">
            <Logo size="sm" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs text-[color:var(--admin-shell-text-muted)]">
              {consoleLabel}
            </div>
            <div className="truncate text-[11px] font-semibold text-[color:var(--admin-shell-text)]">
              {adminRoleLabel}
            </div>
          </div>
        </Link>
      </div>

      <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4 pb-24">
        {sidebarItems.map((item) => (
          <Link
            key={`${item.href}-${item.labelEn}`}
            href={item.href}
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
      className="admin-shell flex min-h-screen text-[color:var(--admin-shell-text)] transition-colors"
    >
      <aside
        className="admin-shell-surface-strong fixed bottom-0 left-0 top-0 z-40 flex w-[272px] flex-col overflow-hidden border-r border-[color:var(--admin-shell-border-strong)]"
      >
        {sidebarContent}
      </aside>

      <main
        className="relative ml-[272px] flex-1 transition-colors"
      >
        <header className="admin-shell-surface sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[color:var(--admin-shell-border)] px-4 sm:px-6">
          <div>
            <h1 className="text-lg font-semibold text-[color:var(--admin-shell-text)]">
              {headerLabel}
            </h1>
            <p className="text-xs text-[color:var(--admin-shell-text-muted)]">{adminRoleLabel}</p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleLanguage}
              className="admin-shell-toolbar-btn inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold"
              aria-label={isHindi ? 'Switch to English' : 'Switch to Hindi'}
              type="button"
            >
              <Languages className="h-3.5 w-3.5" />
              <span>{isHindi ? '\u0939\u093f' : 'EN'}</span>
            </button>
            <ThemeModeSwitcher
              theme={effectiveTheme}
              isHindi={isHindi}
              onChange={setTheme}
            />
            <Link
              href="/main"
              className="admin-shell-toolbar-btn rounded-xl px-3 py-2 text-sm font-medium"
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
          </div>
        </header>

        <div className="relative p-6 sm:p-8">{children}</div>
      </main>
    </div>
  );
}
