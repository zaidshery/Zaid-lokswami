'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { dismissAdminSigninBanner, shouldShowAdminSigninBanner } from '@/lib/auth/adminBanner';
import { isAdminRole } from '@/lib/auth/roles';

export default function AdminSigninBanner() {
  const { data: session, status } = useSession();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    if (
      status !== 'authenticated' ||
      !isAdminRole(session?.user?.role) ||
      session.user.isActive === false
    ) {
      setIsVisible(false);
      return;
    }

    setIsVisible(shouldShowAdminSigninBanner());
  }, [session?.user?.isActive, session?.user?.role, status]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="border-b border-amber-300/70 bg-amber-100 text-amber-950 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/12 dark:text-amber-100">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-5 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-amber-500/20 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200">
            <ShieldAlert className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">आप एडमिन अकाउंट से साइन इन हैं</p>
            <Link
              href="/admin"
              className="text-sm font-medium underline underline-offset-4 hover:text-amber-700 dark:hover:text-amber-200"
            >
              एडमिन पैनल →
            </Link>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            dismissAdminSigninBanner();
            setIsVisible(false);
          }}
          className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full border border-amber-400/40 bg-white/70 text-amber-800 transition hover:bg-white dark:border-amber-300/20 dark:bg-zinc-900/50 dark:text-amber-100 dark:hover:bg-zinc-900"
          aria-label="Dismiss admin banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
