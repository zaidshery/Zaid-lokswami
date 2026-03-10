'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { Home, PlayCircle, Newspaper, Zap, Menu, User } from 'lucide-react';
import { useAppStore } from '@/lib/store/appStore';

interface BottomNavProps {
  onMenuClick: () => void;
  isMenuOpen?: boolean;
  isOverlayDark?: boolean;
}

const navItems = [
  { icon: Home, label: '\u0939\u094b\u092e', labelEn: 'Home', href: '/main' },
  { icon: PlayCircle, label: '\u0935\u0940\u0921\u093f\u092f\u094b', labelEn: 'Videos', href: '/main/videos' },
  { icon: Newspaper, label: '\u0908-\u092a\u0947\u092a\u0930', labelEn: 'E-Paper', href: '/main/epaper', isCenter: true },
  { icon: Zap, label: '\u095e\u091f\u093e\u095e\u091f', labelEn: 'Quick', href: '/main/ftaftaf' },
  { icon: Menu, label: '\u092e\u0947\u0928\u0942', labelEn: 'Menu', href: '#', isMenu: true },
  {
    icon: User,
    label: '\u0905\u0915\u093e\u0909\u0902\u091f',
    labelEn: 'Account',
    href: '/main/account',
    isAccount: true,
  },
];

export default function BottomNav({
  onMenuClick,
  isMenuOpen = false,
  isOverlayDark = false,
}: BottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { language } = useAppStore();
  const { data: session, status } = useSession();
  const userName = session?.user?.name?.trim() || session?.user?.email?.trim() || 'Reader';
  const userImage = session?.user?.image || null;
  const userInitial = (userName.charAt(0) || 'R').toUpperCase();
  const isSignedIn = status === 'authenticated' && Boolean(session?.user?.email);
  const accountLabel = isSignedIn ? 'Account' : 'Sign In';
  const accountTarget = isSignedIn ? '/main/account' : '/signin';

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
      <div className="mx-auto grid h-16 w-full max-w-2xl grid-cols-6 items-center gap-x-1 px-2 pb-safe sm:gap-x-2 sm:px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const label = item.isAccount
            ? accountLabel
            : language === 'hi'
              ? item.label
              : item.labelEn;
          const href = item.isAccount ? accountTarget : item.href;
          const isActive =
            item.isAccount
              ? isSignedIn && (pathname === '/main/account' || pathname.startsWith('/main/account/'))
              : href !== '#' && (pathname === href || pathname.startsWith(`${href}/`));

          if (item.isMenu) {
            return (
              <motion.button
                key="menu"
                onClick={onMenuClick}
                whileTap={{ scale: 0.96 }}
                className={`cnp-motion relative flex w-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-1.5 ${
                  isMenuOpen
                    ? `bg-red-500/15 ${activeTone}`
                    : inactiveTone
                }`}
                aria-label={label}
                aria-controls="mobile-drawer"
                aria-expanded={isMenuOpen}
                type="button"
              >
                <Icon size={22} strokeWidth={2} />
                <span className="text-[11px] font-semibold leading-none">{label}</span>
              </motion.button>
            );
          }

          if (item.isAccount) {
            return (
              <motion.button
                key="account"
                type="button"
                onClick={() => router.push(accountTarget)}
                whileTap={{ scale: 0.96 }}
                aria-current={isActive ? 'page' : undefined}
                aria-label={accountLabel}
                className="relative flex w-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-1.5"
              >
                {isActive ? (
                  <motion.div
                    layoutId="bottomNavActive"
                    className={`absolute inset-1 rounded-xl ${activeBackgroundTone}`}
                    transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                  />
                ) : null}

                <span
                  className={`relative z-10 inline-flex h-[22px] w-[22px] items-center justify-center overflow-hidden rounded-full ${
                    isSignedIn
                      ? 'border border-zinc-300 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100'
                      : ''
                  }`}
                >
                  {isSignedIn ? (
                    userImage ? (
                      <Image
                        src={userImage}
                        alt={userName}
                        width={22}
                        height={22}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] font-bold">{userInitial}</span>
                    )
                  ) : (
                    <Icon
                      size={22}
                      strokeWidth={isActive ? 2.35 : 2}
                      className={isActive ? activeTone : inactiveTone}
                    />
                  )}
                </span>
                <span
                  className={`cnp-motion relative z-10 text-[11px] font-semibold leading-none ${
                    isActive ? activeTone : inactiveTone
                  }`}
                >
                  {label}
                </span>
              </motion.button>
            );
          }

          return (
            <Link
              key={item.href}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className="relative flex w-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-1.5"
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
                className={`cnp-motion relative z-10 text-[11px] font-semibold leading-none ${
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
