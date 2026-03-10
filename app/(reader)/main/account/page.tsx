'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Activity, Bookmark, Loader2, LogOut, Settings, UserCircle2 } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { formatUserRoleLabel } from '@/lib/auth/roles';
import { useAppStore } from '@/lib/store/appStore';

const ACCOUNT_REDIRECT_URL = '/signin?redirect=/main/account';

type ReaderTrackStats = {
  readCount: number;
  readHistoryCount: number;
  averageCompletionPercent: number;
  lastActiveAt: string;
};

type SavedArticlesSummaryPayload = {
  success?: boolean;
  data?: {
    count?: number;
  };
};

function formatMemberSince(value: string | undefined, language: 'hi' | 'en') {
  if (!value) {
    return language === 'hi' ? '\u0909\u092a\u0932\u092c\u094d\u0927 \u0928\u0939\u0940\u0902' : 'Unavailable';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return language === 'hi' ? '\u0909\u092a\u0932\u092c\u094d\u0927 \u0928\u0939\u0940\u0902' : 'Unavailable';
  }

  return new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatLastActive(value: string | undefined, language: 'hi' | 'en') {
  if (!value) {
    return language === 'hi' ? '\u0909\u092a\u0932\u092c\u094d\u0927 \u0928\u0939\u0940\u0902' : 'Unavailable';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return language === 'hi' ? '\u0909\u092a\u0932\u092c\u094d\u0927 \u0928\u0939\u0940\u0902' : 'Unavailable';
  }

  return new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function getUserInitials(name: string, email: string) {
  const source = name.trim() || email.trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }

  return (parts[0]?.slice(0, 2) || 'R').toUpperCase();
}

function AccountSkeleton({ message }: { message: string }) {
  return (
    <div className="mx-auto w-full max-w-4xl py-4 sm:py-6">
      <div className="cnp-surface overflow-hidden rounded-[28px] p-5 sm:p-6">
        <div className="animate-pulse space-y-5">
          <div className="rounded-[24px] border border-zinc-200 bg-gradient-to-br from-zinc-50 via-white to-red-50/70 p-5 dark:border-zinc-800 dark:from-zinc-900 dark:via-zinc-900 dark:to-red-950/20">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="h-6 w-40 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-4 w-56 max-w-full rounded-full bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-5 w-24 rounded-full bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="h-28 rounded-3xl bg-zinc-100 dark:bg-zinc-900" />
            <div className="h-28 rounded-3xl bg-zinc-100 dark:bg-zinc-900" />
            <div className="h-28 rounded-3xl bg-zinc-100 dark:bg-zinc-900" />
          </div>
        </div>

        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
          <Loader2 className="h-4 w-4 animate-spin text-red-500" />
          <span>{message}</span>
        </div>
      </div>
    </div>
  );
}

/** Account profile sourced from the active NextAuth session. */
export default function ReaderAccountPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { language } = useAppStore();
  const [trackStats, setTrackStats] = useState<ReaderTrackStats | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [savedArticlesCount, setSavedArticlesCount] = useState(0);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const copy = useMemo(() => {
    if (language === 'hi') {
      return {
        loading: '\u0906\u092a\u0915\u0940 \u092a\u094d\u0930\u094b\u092b\u093e\u0907\u0932 \u0932\u094b\u0921 \u0939\u094b \u0930\u0939\u0940 \u0939\u0948...',
        redirecting: '\u0906\u092a\u0915\u094b \u0938\u093e\u0907\u0928-\u0907\u0928 \u092a\u0930 \u0932\u0947 \u091c\u093e\u092f\u093e \u091c\u093e \u0930\u0939\u093e \u0939\u0948...',
        heading: '\u0905\u0915\u093e\u0909\u0902\u091f',
        subtitle: '\u0906\u092a\u0915\u093e \u0917\u0942\u0917\u0932 \u0938\u0924\u094d\u0930 \u0932\u094b\u0915\u0938\u094d\u0935\u093e\u092e\u0940 \u0938\u0947 \u091c\u0941\u0921\u093c\u093e \u0939\u0941\u0906 \u0939\u0948\u0964',
        memberSince: '\u092e\u0947\u0902\u092c\u0930 \u0938\u093f\u0902\u0938',
        savedArticles: '\u0938\u0947\u0935\u094d\u0921 \u0906\u0930\u094d\u091f\u093f\u0915\u0932\u094d\u0938',
        savedArticlesHint: '\u0906\u092a\u0915\u0947 \u0926\u094d\u0935\u093e\u0930\u093e \u0938\u0947\u0935 \u0915\u0940 \u0917\u0908 \u0916\u092c\u0930\u0947\u0902',
        readingStats: '\u0930\u0940\u0921\u093f\u0902\u0917 \u0938\u094d\u091f\u0948\u091f\u094d\u0938',
        averageCompletion: '\u0914\u0938\u0924 \u0915\u0902\u092a\u094d\u0932\u0940\u0936\u0928',
        lastActive: '\u0906\u0916\u093f\u0930\u0940 \u090f\u0915\u094d\u091f\u093f\u0935',
        statsLoading: '\u0938\u094d\u091f\u0948\u091f\u094d\u0938 \u0932\u094b\u0921 \u0939\u094b \u0930\u0939\u0947 \u0939\u0948\u0902...',
        preferences: '\u092a\u094d\u0930\u093f\u092b\u0930\u0947\u0902\u0938\u0947\u0938',
        preferencesHint: '\u092d\u093e\u0937\u093e, \u092b\u0940\u0921 \u0914\u0930 \u0930\u0940\u0921\u093f\u0902\u0917 \u0938\u0947\u091f\u093f\u0902\u0917\u094d\u0938',
        openPreferences: '\u092a\u094d\u0930\u093f\u092b\u0930\u0947\u0902\u0938\u0947\u0938 \u0916\u094b\u0932\u0947\u0902',
        logout: '\u0932\u0949\u0917\u0906\u0909\u091f',
        loggingOut: '\u0932\u0949\u0917\u0906\u0909\u091f \u0939\u094b \u0930\u0939\u093e \u0939\u0948...',
      };
    }

    return {
      loading: 'Loading your profile...',
      redirecting: 'Redirecting you to sign in...',
      heading: 'Account',
      subtitle: 'Your Google session is connected to Lokswami.',
      memberSince: 'Member Since',
      savedArticles: 'Saved Articles',
      savedArticlesHint: 'Stories you have saved for later reading',
      readingStats: 'Reading Stats',
      averageCompletion: 'Average Completion',
      lastActive: 'Last Active',
      statsLoading: 'Loading reading stats...',
      preferences: 'Preferences',
      preferencesHint: 'Language, feed and reading settings',
      openPreferences: 'Open Preferences',
      logout: 'Logout',
      loggingOut: 'Logging out...',
    };
  }, [language]);

  const sessionUser = session?.user;
  const userName =
    sessionUser?.name?.trim() || sessionUser?.email?.split('@')[0]?.trim() || 'Reader';
  const userEmail = sessionUser?.email?.trim() || '';
  const userImage = sessionUser?.image || null;
  const userInitials = getUserInitials(userName, userEmail);
  const userRole = formatUserRoleLabel(sessionUser?.role);
  const memberSince = formatMemberSince(sessionUser?.createdAt, language);
  const fallbackSavedArticlesCount = Array.isArray(sessionUser?.savedArticles)
    ? sessionUser.savedArticles.length
    : 0;
  const readCount = typeof trackStats?.readCount === 'number' ? trackStats.readCount : 0;
  const averageCompletionPercent =
    typeof trackStats?.averageCompletionPercent === 'number'
      ? trackStats.averageCompletionPercent
      : 0;
  const lastActive = formatLastActive(trackStats?.lastActiveAt, language);

  useEffect(() => {
    if (status !== 'unauthenticated') {
      setIsRedirecting(false);
      return;
    }

    setIsRedirecting(true);
    router.replace(ACCOUNT_REDIRECT_URL);
  }, [router, status]);

  const loadSavedArticlesCount = useCallback(async () => {
    if (status !== 'authenticated' || !userEmail) {
      setSavedArticlesCount(0);
      return;
    }

    try {
      const response = await fetch('/api/user/save', {
        method: 'GET',
        cache: 'no-store',
      });

      const payload = (await response.json().catch(() => ({}))) as SavedArticlesSummaryPayload;

      if (
        response.ok &&
        payload.success &&
        typeof payload.data?.count === 'number' &&
        Number.isFinite(payload.data.count)
      ) {
        setSavedArticlesCount(payload.data.count);
        return;
      }

      setSavedArticlesCount(fallbackSavedArticlesCount);
    } catch (error) {
      console.error('Failed to load saved articles count:', error);
      setSavedArticlesCount(fallbackSavedArticlesCount);
    }
  }, [fallbackSavedArticlesCount, status, userEmail]);

  useEffect(() => {
    let active = true;

    const loadTrackStats = async () => {
      if (status !== 'authenticated' || !userEmail) {
        if (!active) return;
        setTrackStats(null);
        setIsStatsLoading(false);
        return;
      }

      setIsStatsLoading(true);

      try {
        const response = await fetch('/api/user/track', { cache: 'no-store' });
        const payload = (await response.json().catch(() => ({}))) as {
          success?: boolean;
          data?: ReaderTrackStats;
        };

        if (!active) return;

        if (response.ok && payload.success && payload.data) {
          setTrackStats(payload.data);
        } else {
          setTrackStats(null);
        }
      } catch (error) {
        console.error('Failed to load reader stats:', error);
        if (active) {
          setTrackStats(null);
        }
      } finally {
        if (active) {
          setIsStatsLoading(false);
        }
      }
    };

    void loadTrackStats();

    return () => {
      active = false;
    };
  }, [status, userEmail]);

  useEffect(() => {
    void loadSavedArticlesCount();
  }, [loadSavedArticlesCount]);

  useEffect(() => {
    if (typeof window === 'undefined' || status !== 'authenticated') {
      return;
    }

    const handleSavedArticleUpdated = () => {
      void loadSavedArticlesCount();
    };

    window.addEventListener('lokswami:saved-article-updated', handleSavedArticleUpdated);

    return () => {
      window.removeEventListener('lokswami:saved-article-updated', handleSavedArticleUpdated);
    };
  }, [loadSavedArticlesCount, status]);

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await signOut({ callbackUrl: '/signin' });
    } catch (error) {
      console.error('Reader sign-out failed:', error);
      setIsSigningOut(false);
    }
  }

  if (status === 'loading' || isRedirecting) {
    return (
      <AccountSkeleton
        message={status === 'loading' ? copy.loading : copy.redirecting}
      />
    );
  }

  if (status !== 'authenticated' || !userEmail) {
    return <AccountSkeleton message={copy.redirecting} />;
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="mx-auto w-full max-w-4xl py-4 sm:py-6"
    >
      <div className="cnp-surface overflow-hidden rounded-[28px] p-5 sm:p-6 md:p-7">
        <div className="rounded-[28px] border border-zinc-200 bg-[linear-gradient(135deg,rgba(254,242,242,0.95),rgba(255,255,255,0.98)_45%,rgba(249,250,251,0.98))] p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] dark:border-zinc-800 dark:bg-[linear-gradient(135deg,rgba(24,24,27,0.98),rgba(24,24,27,0.94)_45%,rgba(69,10,10,0.22))] sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-white/70 bg-red-100 text-2xl font-black text-red-700 shadow-sm dark:border-zinc-700 dark:bg-red-500/15 dark:text-red-300">
              {userImage ? (
                <Image
                  src={userImage}
                  alt={userName}
                  fill
                  sizes="80px"
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <span>{userInitials}</span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {copy.heading}
              </p>
              <h1 className="mt-3 truncate text-2xl font-black text-zinc-900 dark:text-zinc-100 sm:text-3xl">
                {userName}
              </h1>
              <p className="mt-1 truncate text-sm text-zinc-600 dark:text-zinc-400">
                {userEmail}
              </p>
              <div className="mt-3 inline-flex items-center rounded-full border border-red-300/70 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                {userRole}
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {copy.subtitle}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                <UserCircle2 className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {copy.memberSince}
                </p>
                <p className="mt-1 text-lg font-black text-zinc-900 dark:text-zinc-100">
                  {memberSince}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                <Bookmark className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {copy.savedArticles}
                </p>
                <p className="mt-1 text-lg font-black text-zinc-900 dark:text-zinc-100">
                  {savedArticlesCount}
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {copy.savedArticlesHint}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                <Activity className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {copy.readingStats}
                </p>
                {isStatsLoading ? (
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {copy.statsLoading}
                  </p>
                ) : (
                  <>
                    <p className="mt-1 text-lg font-black text-zinc-900 dark:text-zinc-100">
                      {readCount}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {copy.averageCompletion}: {averageCompletionPercent}%
                    </p>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {copy.lastActive}: {lastActive}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                <Settings className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {copy.preferences}
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {copy.preferencesHint}
                </p>
              </div>
            </div>

            <Link
              href="/main/preferences"
              className="mt-4 inline-flex items-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {copy.openPreferences}
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/main"
            className="inline-flex rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Back to Main
          </Link>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={isSigningOut}
            className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-500 dark:hover:bg-red-400"
          >
            {isSigningOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            <span>{isSigningOut ? copy.loggingOut : copy.logout}</span>
          </button>
        </div>
      </div>
    </motion.section>
  );
}
