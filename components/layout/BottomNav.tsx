'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Home,
  PlayCircle,
  Newspaper,
  Zap,
  Menu,
  type LucideIcon,
} from 'lucide-react';
import { useAppStore } from '@/lib/store/appStore';
import { READER_NAVIGATION, isReaderNavigationActive } from '@/lib/constants/readerNavigation';

interface BottomNavProps {
  onMenuClick: () => void;
  isMenuOpen?: boolean;
  isOverlayDark?: boolean;
}

type BottomNavItem = {
  icon: LucideIcon;
  label: string;
  labelEn: string;
  href: string;
  ariaLabel?: string;
  ariaLabelEn?: string;
  isCenter?: boolean;
  isMenu?: boolean;
};

const navItems: BottomNavItem[] = [
  { icon: Home, label: READER_NAVIGATION.home.name, labelEn: READER_NAVIGATION.home.nameEn, href: READER_NAVIGATION.home.href },
  { icon: Newspaper, label: READER_NAVIGATION.epaper.name, labelEn: READER_NAVIGATION.epaper.nameEn, href: READER_NAVIGATION.epaper.href, isCenter: true },
  {
    icon: BookOpen,
    label: '\u0908-\u092e\u0948\u0917',
    labelEn: 'E-Mag',
    ariaLabel: '\u0908-\u092e\u0948\u0917\u091c\u093c\u0940\u0928',
    ariaLabelEn: 'E-Magazine',
    href: READER_NAVIGATION.emagazine.href,
  },
  { icon: PlayCircle, label: READER_NAVIGATION.videos.name, labelEn: READER_NAVIGATION.videos.nameEn, href: READER_NAVIGATION.videos.href },
  { icon: Zap, label: '\u095e\u091f\u093e\u095e\u091f', labelEn: 'Quick', href: '/main/ftaftaf' },
  { icon: Menu, label: '\u092e\u0947\u0928\u0942', labelEn: 'Menu', href: '#', isMenu: true },
];

export default function BottomNav({
  onMenuClick,
  isMenuOpen = false,
  isOverlayDark = false,
}: BottomNavProps) {
  const pathname = usePathname();
  const { language } = useAppStore();

  const shellTone = isOverlayDark
    ? 'border-white/10 bg-black/90 dark:border-white/10 dark:bg-black/90'
    : 'border-zinc-200/90 bg-white/95 dark:border-zinc-800 dark:bg-zinc-950/95';
  const inactiveTone = isOverlayDark
    ? 'text-zinc-300 hover:text-white'
    : 'text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100';
  const activeTone = isOverlayDark ? 'text-red-400' : 'text-red-600 dark:text-red-400';
  const activeBackgroundTone = isOverlayDark
    ? 'bg-white/10'
    : 'bg-red-50 dark:bg-red-500/10';

  return (
    <nav
      role="navigation"
      aria-label="Bottom Navigation"
      className={`fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur xl:hidden ${shellTone}`}
    >
      <div className="mx-auto grid min-h-[var(--bottom-nav-height)] w-full max-w-xl grid-cols-6 items-center gap-x-0.5 px-1.5 pb-[max(env(safe-area-inset-bottom),0.25rem)] pt-1 sm:gap-x-1 sm:px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const label = language === 'hi' ? item.label : item.labelEn;
          const ariaLabel = language === 'hi'
            ? item.ariaLabel || item.label
            : item.ariaLabelEn || item.labelEn;
          const explicitAriaLabel = ariaLabel === label ? undefined : ariaLabel;
          const href = item.href;
          const isActive = href !== '#' && isReaderNavigationActive(pathname, href);

          if (item.isMenu) {
            return (
              <motion.button
                key="menu"
                onClick={onMenuClick}
                whileTap={{ scale: 0.96 }}
                className={`cnp-motion reader-touch-button reader-focus-ring touch-target-compact relative flex w-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 ${
                  isMenuOpen
                    ? `bg-red-500/15 ${activeTone}`
                    : inactiveTone
                }`}
                aria-label={explicitAriaLabel}
                aria-controls="mobile-drawer"
                aria-expanded={isMenuOpen}
                type="button"
              >
                <Icon size={22} strokeWidth={2} />
                <span className="max-w-full truncate text-[9px] font-semibold leading-none min-[380px]:text-[10px] sm:text-[11px]">{label}</span>
              </motion.button>
            );
          }

          return (
            <Link
              key={item.href}
              href={href}
              aria-label={explicitAriaLabel}
              aria-current={isActive ? 'page' : undefined}
              className="reader-touch-link reader-focus-ring touch-target-compact relative flex w-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5"
            >
              {isActive ? (
                <motion.div
                  layoutId="bottomNavActive"
                  className={`absolute inset-1 rounded-xl ${activeBackgroundTone}`}
                  transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                />
              ) : null}

              <Icon
                size={22}
                strokeWidth={isActive ? 2.35 : 2}
                className={`cnp-motion relative z-10 ${isActive ? activeTone : inactiveTone}`}
              />
              <span
                className={`cnp-motion relative z-10 max-w-full truncate text-[9px] font-semibold leading-none min-[380px]:text-[10px] sm:text-[11px] ${
                  isActive ? activeTone : inactiveTone
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
