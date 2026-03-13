'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { BellRing, Newspaper, Smartphone, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import {
  canShowDailyEpaperAlert,
  clearActiveSurface,
  dismissDailyEpaperAlert,
  markDailyEpaperAlertShown,
  releaseActiveSurface,
} from '@/lib/popups/popupManager';
import { usePopupState } from '@/lib/popups/usePopupState';
import { useAppStore } from '@/lib/store/appStore';
import {
  requestInstallPrompt,
  resolveNotificationCapability,
} from '@/lib/pwa/client';

type LatestPaper = {
  title: string;
  city: string;
  publishDate: string;
};

const DAILY_ALERT_STORAGE_KEY = 'lokswami_daily_epaper_alert_sent_on';

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function DailyEpaperAlert() {
  const { language } = useAppStore();
  const { data: session, status } = useSession();
  const popupState = usePopupState();
  const [latestPaper, setLatestPaper] = useState<LatestPaper | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [enableState, setEnableState] = useState<'idle' | 'working'>('idle');
  const [notice, setNotice] = useState('');

  const today = useMemo(() => localDateKey(new Date()), []);
  const isSignedIn = status === 'authenticated' && Boolean(session?.user?.email);
  const notificationCapability = resolveNotificationCapability();
  const isHandledToday =
    popupState.epaperAlertShownOn === today ||
    popupState.epaperAlertDismissedOn === today;

  useEffect(() => {
    if (showBanner || popupState.activeSurface !== 'epaper-alert' || !isHandledToday) {
      return;
    }

    clearActiveSurface('epaper-alert');
  }, [isHandledToday, popupState.activeSurface, showBanner]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (typeof window === 'undefined') return;
      const alreadySent = localStorage.getItem(DAILY_ALERT_STORAGE_KEY);
      if (alreadySent === today || isHandledToday || latestPaper) return;

      try {
        const response = await fetch('/api/epapers?limit=1&status=published', {
          cache: 'no-store',
        });
        const data = await response.json().catch(() => ({}));
        if (!active) return;

        const first = Array.isArray(data?.data) ? data.data[0] : null;
        if (!response.ok || !first) return;

        const publishDate = String(first.publishDate || '').trim();
        if (publishDate !== today) return;

        const paper: LatestPaper = {
          title: String(first.title || ''),
          city: String(first.cityName || first.citySlug || ''),
          publishDate,
        };
        setLatestPaper(paper);
      } catch {
        // Silent fail: notifications should never block primary browsing.
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [isHandledToday, latestPaper, today]);

  useEffect(() => {
    if (!latestPaper || showBanner || isHandledToday || !canShowDailyEpaperAlert(today)) {
      return;
    }

    setShowBanner(true);
    markDailyEpaperAlertShown(today);

    if (typeof window !== 'undefined') {
      localStorage.setItem(DAILY_ALERT_STORAGE_KEY, today);
    }

    if (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted' &&
      document.visibilityState === 'visible'
    ) {
      const body =
        language === 'hi'
          ? `${latestPaper.city} \u0915\u093e \u0928\u092f\u093e \u0908-\u092a\u0947\u092a\u0930 \u0906 \u0917\u092f\u093e \u0939\u0948\u0964`
          : `Today's ${latestPaper.city} e-paper is now available.`;
      new Notification(
        language === 'hi'
          ? '\u0906\u091c \u0915\u093e \u0908-\u092a\u0947\u092a\u0930 \u0906 \u0917\u092f\u093e!'
          : "Today's E-paper has arrived!",
        {
          body,
          icon: '/logo-icon-final.png',
          tag: `epaper-${today}`,
        }
      );
    }
  }, [isHandledToday, language, latestPaper, showBanner, today]);

  const closeBanner = () => {
    setShowBanner(false);
    dismissDailyEpaperAlert(today);

    if (typeof window !== 'undefined') {
      localStorage.setItem(DAILY_ALERT_STORAGE_KEY, today);
    }
  };

  const requestNotificationPermission = async () => {
    const capability = resolveNotificationCapability();

    if (capability.requiresAppInstall) {
      setShowBanner(false);
      releaseActiveSurface('epaper-alert');
      requestInstallPrompt();
      setNotice(
        language === 'hi'
          ? 'iPhone \u092a\u0930 \u0905\u0932\u0930\u094d\u091f \u091a\u093e\u0932\u0942 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f \u092a\u0939\u0932\u0947 \u090f\u092a \u0907\u0902\u0938\u094d\u091f\u0949\u0932 \u0915\u0930\u0947\u0902\u0964'
          : 'Install the app first on iPhone to turn on alerts.'
      );
      return;
    }

    if (!capability.isSupported) {
      setNotice(
        language === 'hi'
          ? '\u0907\u0938 \u092c\u094d\u0930\u093e\u0909\u091c\u093c\u0930 \u092e\u0947\u0902 \u0905\u0932\u0930\u094d\u091f \u0938\u092a\u094b\u0930\u094d\u091f \u0928\u0939\u0940\u0902 \u0939\u0948\u0902\u0964'
          : 'Alerts are not supported in this browser.'
      );
      return;
    }

    if (capability.permission === 'denied') {
      setNotice(
        language === 'hi'
          ? '\u0905\u0932\u0930\u094d\u091f \u092b\u093f\u0930 \u0938\u0947 \u091a\u093e\u0932\u0942 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f browser site settings \u092e\u0947\u0902 Notifications \u0905\u0928\u0941\u092e\u0924\u093f \u091a\u093e\u0932\u0942 \u0915\u0930\u0947\u0902\u0964'
          : 'Alerts are blocked. Re-enable them from your browser site settings.'
      );
      return;
    }

    if (!capability.canPrompt) {
      return;
    }

    setEnableState('working');
    setNotice('');

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        if (latestPaper) {
          const body =
            language === 'hi'
              ? `${latestPaper.city} \u0915\u093e \u0928\u092f\u093e \u0908-\u092a\u0947\u092a\u0930 \u0909\u092a\u0932\u092c\u094d\u0927 \u0939\u0948\u0964`
              : `Today's ${latestPaper.city} e-paper is available now.`;
          new Notification(
            language === 'hi'
              ? '\u0905\u0932\u0930\u094d\u091f \u0938\u0915\u094d\u0937\u092e \u0939\u094b \u0917\u092f\u093e'
              : 'Alerts enabled',
            {
              body,
              icon: '/logo-icon-final.png',
            }
          );
        }
        setNotice(
          language === 'hi'
            ? isSignedIn
              ? '\u0906\u092a\u0915\u0947 \u0905\u0915\u093e\u0909\u0902\u091f \u0915\u0947 \u0932\u093f\u090f \u0907\u0938 \u0921\u093f\u0935\u093e\u0907\u0938 \u092a\u0930 \u0905\u0932\u0930\u094d\u091f \u0938\u0915\u094d\u0937\u092e \u0939\u094b \u0917\u090f'
              : '\u0907\u0938 \u0921\u093f\u0935\u093e\u0907\u0938 \u092a\u0930 \u0905\u0932\u0930\u094d\u091f \u0938\u0915\u094d\u0937\u092e \u0939\u094b \u0917\u090f'
            : isSignedIn
              ? 'Alerts enabled for this account on this device'
              : 'Alerts enabled on this device'
        );
      } else if (permission === 'denied') {
        setNotice(
          language === 'hi'
            ? '\u0905\u0928\u0941\u092e\u0924\u093f \u0928\u0939\u0940\u0902 \u092e\u093f\u0932\u0940\u0964 browser site settings \u092e\u0947\u0902 Notifications \u091a\u093e\u0932\u0942 \u0915\u0930\u0915\u0947 \u092b\u093f\u0930 \u0915\u094b\u0936\u093f\u0936 \u0915\u0930\u0947\u0902\u0964'
            : 'Permission was denied. Turn notifications back on from browser site settings.'
        );
      } else {
        setNotice(
          language === 'hi'
            ? '\u0906\u092a \u091a\u093e\u0939\u0947\u0902 \u0924\u094b \u092c\u093e\u0926 \u092e\u0947\u0902 \u092d\u0940 \u0905\u0932\u0930\u094d\u091f \u091a\u093e\u0932\u0942 \u0915\u0930 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902\u0964'
            : 'You can turn alerts on later.'
        );
      }
    } finally {
      setEnableState('idle');
    }
  };

  if (!showBanner || !latestPaper) return null;

  const canPromptForAlerts = notificationCapability.canPrompt;
  const shouldShowInstallForAlerts = notificationCapability.requiresAppInstall;

  return (
    <div className="pointer-events-none fixed bottom-20 right-3 z-[95] w-[min(92vw,24rem)] sm:bottom-6 sm:right-5">
      <div className="pointer-events-auto relative overflow-hidden rounded-2xl border border-primary-200/70 bg-white/95 p-3.5 shadow-[0_22px_52px_rgba(199,29,36,0.16)] backdrop-blur-md dark:border-primary-900/40 dark:bg-zinc-900/95">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#8b141a_0%,#e72129_55%,#c61d24_100%)]" />
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300">
              <BellRing className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-black text-zinc-900 dark:text-zinc-100">
                {language === 'hi'
                  ? '\u0906\u091c \u0915\u093e \u0908-\u092a\u0947\u092a\u0930 \u0906 \u0917\u092f\u093e!'
                  : "Today's E-paper has arrived!"}
              </p>
              <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                {latestPaper.city}: {latestPaper.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeBanner}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            aria-label={language === 'hi' ? '\u092c\u0902\u0926 \u0915\u0930\u0947\u0902' : 'Dismiss'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/main/epaper"
            onClick={closeBanner}
            className="attention-pulsate-bck inline-flex h-8 items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 text-xs font-semibold text-primary-700 transition hover:bg-primary-100 dark:border-primary-900/40 dark:bg-primary-950/30 dark:text-primary-300 dark:hover:bg-primary-950/45"
          >
            <Newspaper className="h-3.5 w-3.5 text-primary-600 dark:text-primary-300" />
            {language === 'hi'
              ? '\u0908-\u092a\u0947\u092a\u0930 \u092a\u0922\u093c\u0947\u0902'
              : 'Read E-Paper'}
          </Link>

          {canPromptForAlerts || shouldShowInstallForAlerts ? (
            <button
              type="button"
              onClick={() => void requestNotificationPermission()}
              disabled={enableState === 'working'}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-primary-600 bg-primary-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-primary-500 dark:bg-primary-600 dark:hover:bg-primary-500"
            >
              {shouldShowInstallForAlerts ? (
                <Smartphone className="h-3.5 w-3.5" />
              ) : (
                <BellRing className="h-3.5 w-3.5" />
              )}
              {enableState === 'working'
                ? language === 'hi'
                  ? '\u0938\u0915\u094d\u0937\u092e \u0939\u094b \u0930\u0939\u093e \u0939\u0948...'
                  : 'Enabling...'
                : shouldShowInstallForAlerts
                  ? language === 'hi'
                    ? '\u0905\u0932\u0930\u094d\u091f \u0915\u0947 \u0932\u093f\u090f \u090f\u092a \u0907\u0902\u0938\u094d\u091f\u0949\u0932 \u0915\u0930\u0947\u0902'
                    : 'Install App for Alerts'
                  : language === 'hi'
                    ? '\u0905\u0932\u0930\u094d\u091f \u0938\u0915\u094d\u0937\u092e \u0915\u0930\u0947\u0902'
                    : 'Enable Alerts'}
            </button>
          ) : null}
        </div>

        {notice ? (
          <p
            aria-live="polite"
            className="mt-2 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300"
          >
            {notice}
          </p>
        ) : null}
      </div>
    </div>
  );
}
