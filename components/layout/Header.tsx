'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { signOut, useSession } from 'next-auth/react';
import {
  Bookmark,
  LogOut,
  Menu,
  Moon,
  Newspaper,
  Settings,
  Sun,
  User,
} from 'lucide-react';
import { useAppStore } from '@/lib/store/appStore';
import DesktopNav from './DesktopNav';
import Logo from '@/components/layout/Logo';

/** Renders the main site header with reader auth actions. */
export default function Header() {
  const [mounted, setMounted] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const {
    theme,
    toggleTheme,
    language,
    toggleLanguage,
    toggleMobileMenu,
    isMobileMenuOpen,
  } = useAppStore();
  const { data: session, status } = useSession();

  const userName = session?.user?.name?.trim() || 'Reader';
  const userEmail = session?.user?.email?.trim() || '';
  const userImage = session?.user?.image || null;
  const userInitial = (userName.charAt(0) || userEmail.charAt(0) || 'R').toUpperCase();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isUserMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent): void {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isUserMenuOpen]);

  async function handleReaderSignOut(): Promise<void> {
    try {
      setIsUserMenuOpen(false);
      await signOut({ callbackUrl: '/main' });
    } catch (error) {
      console.error('Reader sign-out failed:', error);
    }
  }

  if (!mounted) return null;

  return (
    <header className="fixed left-0 right-0 top-9 z-50 border-b border-zinc-200/85 bg-white/95 shadow-[var(--shadow-soft)] backdrop-blur-md transition-all duration-500 dark:border-zinc-800 dark:bg-zinc-950/95 md:top-11">
      <div className="w-full px-2 sm:px-5 md:px-8">
        <div className="flex h-11 items-center justify-between gap-1.5 sm:h-[3.45rem] sm:gap-3">
          <div className="flex min-w-0 items-center">
            <div className="min-w-0 sm:hidden">
              <Logo size="sm" href="/main" />
            </div>
            <div className="hidden min-w-0 sm:block lg:hidden">
              <Logo size="headerMobile" href="/main" />
            </div>
            <div className="hidden min-w-0 lg:block">
              <Logo size="headerDesktop" href="/main" />
            </div>
          </div>

          <div className="ml-0.5 flex min-w-0 flex-shrink-0 items-center justify-end sm:ml-2">
            <div className="inline-flex max-w-full items-center gap-1 rounded-2xl border border-zinc-200/90 bg-gradient-to-b from-white to-zinc-100/80 p-1 shadow-[0_8px_18px_rgba(15,23,42,0.08)] dark:border-zinc-700/80 dark:from-zinc-900 dark:to-zinc-900/75 sm:gap-2 sm:p-1.5">
              <motion.button
                onClick={toggleLanguage}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="cnp-motion inline-flex h-8 shrink-0 items-center rounded-xl border border-zinc-200/80 bg-white px-1.5 py-1 text-[10px] font-semibold text-zinc-900 shadow-sm hover:border-orange-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-500 sm:h-10 sm:px-1.5 sm:text-xs"
                aria-label={language === 'hi' ? 'Switch to English' : 'Switch to Hindi'}
              >
                <span className="attention-pulsate-bck-slow inline-flex items-center">
                  <span
                    className={`rounded-md px-1.5 py-1 leading-none transition-colors sm:px-2 ${
                      language === 'hi'
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
                        : 'text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    {'\u0939\u093f'}
                  </span>
                  <span className="mx-1 h-3.5 w-px bg-zinc-200 dark:bg-zinc-700" aria-hidden="true" />
                  <span
                    className={`rounded-md px-1.5 py-1 leading-none transition-colors sm:px-2 ${
                      language === 'en'
                        ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300'
                        : 'text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    EN
                  </span>
                </span>
              </motion.button>

              <motion.div
                style={{ perspective: 900 }}
                whileHover={{ y: -1.5, rotateX: 5, rotateY: -5 }}
                whileTap={{ scale: 0.98, rotateX: 2, rotateY: -2 }}
                transition={{ type: 'spring', stiffness: 360, damping: 24, mass: 0.6 }}
                className="relative"
              >
                <Link
                  href="/main/epaper"
                  className="group cnp-motion relative inline-flex h-8 shrink-0 items-center gap-1 overflow-hidden whitespace-nowrap rounded-xl border border-orange-300/70 bg-gradient-to-r from-orange-50 via-white to-red-50 px-2 text-[10px] font-bold text-zinc-900 shadow-[0_8px_18px_rgba(249,115,22,0.22)] hover:shadow-[0_11px_24px_rgba(239,68,68,0.24)] dark:border-orange-500/35 dark:bg-gradient-to-r dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800 dark:text-zinc-50 dark:shadow-[0_10px_20px_rgba(0,0,0,0.35)] sm:h-10 sm:gap-1.5 sm:px-3 sm:text-xs"
                  aria-label={language === 'hi' ? '\u0908-\u092a\u0947\u092a\u0930' : 'E-Paper'}
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-6 -top-6 h-14 w-14 rounded-full bg-orange-300/45 blur-lg dark:bg-red-500/20"
                  />
                  <span className="attention-pulsate-bck relative z-10 inline-flex items-center gap-1 sm:gap-1.5">
                    <span
                      className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-white/90 text-orange-700 shadow-sm dark:bg-zinc-900/80 dark:text-orange-300 sm:h-6 sm:w-6"
                      aria-hidden="true"
                    >
                      <Newspaper size={13} className="transition-transform duration-200 group-hover:rotate-[-10deg] group-hover:scale-110 sm:h-[14px] sm:w-[14px]" />
                    </span>
                    <span className="hidden min-[420px]:inline">
                      {language === 'hi' ? '\u0908-\u092a\u0947\u092a\u0930' : 'E-Paper'}
                    </span>
                  </span>
                </Link>
              </motion.div>

              <div className="relative hidden lg:block" ref={userMenuRef}>
                {status === 'loading' ? (
                  <div className="h-10 w-10 animate-pulse rounded-full border border-zinc-200/80 bg-zinc-200/80 dark:border-zinc-700 dark:bg-zinc-700" />
                ) : userEmail ? (
                  <>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setIsUserMenuOpen((open) => !open)}
                      className="relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-zinc-200/80 bg-white text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      aria-label={language === 'hi' ? '\u0930\u0940\u0921\u0930 \u092e\u0947\u0928\u0942' : 'Reader menu'}
                    >
                      {userImage ? (
                        <Image
                          src={userImage}
                          alt={userName}
                          fill
                          sizes="40px"
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-bold">{userInitial}</span>
                      )}
                    </motion.button>

                    <AnimatePresence>
                      {isUserMenuOpen ? (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.96, y: -8 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.98, y: -6 }}
                          transition={{ duration: 0.16, ease: 'easeOut' }}
                          className="absolute right-0 top-12 z-[80] w-72 rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_22px_50px_rgba(15,23,42,0.18)] dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/80">
                            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {userName}
                            </p>
                            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                              {userEmail}
                            </p>
                          </div>

                          <div className="mt-2 space-y-1">
                            <Link
                              href="/main/account"
                              onClick={() => setIsUserMenuOpen(false)}
                              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                            >
                              <User size={16} />
                              <span>My Account</span>
                            </Link>
                            <Link
                              href="/main/saved"
                              onClick={() => setIsUserMenuOpen(false)}
                              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                            >
                              <Bookmark size={16} />
                              <span>Saved Articles</span>
                            </Link>
                            <Link
                              href="/main/preferences"
                              onClick={() => setIsUserMenuOpen(false)}
                              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                            >
                              <Settings size={16} />
                              <span>Preferences</span>
                            </Link>
                          </div>

                          <div className="my-2 h-px bg-zinc-200 dark:bg-zinc-700" />

                          <button
                            type="button"
                            onClick={() => void handleReaderSignOut()}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                          >
                            <LogOut size={16} />
                            <span>Sign Out</span>
                          </button>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </>
                ) : (
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Link
                      href="/signin"
                      className="cnp-motion inline-flex h-10 items-center gap-1 rounded-xl border border-zinc-200/80 bg-white px-3 text-xs font-semibold text-zinc-800 shadow-sm hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-red-500/40 dark:hover:bg-red-500/15 dark:hover:text-red-300"
                      aria-label={language === 'hi' ? '\u0938\u093e\u0907\u0928 \u0907\u0928' : 'Sign In'}
                    >
                      <User size={16} />
                      <span>Sign In</span>
                    </Link>
                  </motion.div>
                )}
              </div>

              <motion.button
                onClick={toggleTheme}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="cnp-motion inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-zinc-200/80 bg-white text-zinc-800 shadow-sm hover:border-amber-300 hover:bg-amber-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 sm:h-10 sm:w-10"
                aria-label="Toggle theme"
              >
                <span className="attention-pulsate-bck-slow inline-flex">
                  {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                </span>
              </motion.button>

              <motion.button
                type="button"
                onClick={toggleMobileMenu}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="cnp-motion inline-flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200/80 bg-white text-zinc-800 shadow-sm hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 sm:h-10 sm:w-10 lg:hidden"
                aria-label={language === 'hi' ? '\u092e\u0947\u0928\u0942' : 'Menu'}
                aria-controls="mobile-drawer"
                aria-expanded={isMobileMenuOpen}
              >
                <Menu size={16} />
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-200/80 dark:border-zinc-800">
        <div className="scrollbar-hide flex h-9 items-center overflow-x-auto touch-pan-x px-2 sm:px-4 md:h-10 md:px-8 lg:justify-center">
          <DesktopNav className="min-w-max py-0" />
        </div>
      </div>
    </header>
  );
}
