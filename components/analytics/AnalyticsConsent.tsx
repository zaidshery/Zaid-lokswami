'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store/appStore';

export const GOOGLE_ANALYTICS_CONSENT_KEY = 'lokswami_google_analytics_consent_v1';

type ConsentChoice = 'granted' | 'denied';

type GoogleWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

function readStoredChoice(): ConsentChoice | null {
  try {
    const storedChoice = window.localStorage.getItem(GOOGLE_ANALYTICS_CONSENT_KEY);
    return storedChoice === 'granted' || storedChoice === 'denied' ? storedChoice : null;
  } catch {
    return null;
  }
}

function persistChoice(choice: ConsentChoice) {
  try {
    window.localStorage.setItem(GOOGLE_ANALYTICS_CONSENT_KEY, choice);
  } catch {
    // Consent still applies to the current page when storage is unavailable.
  }
}

function getGoogleTagFunction() {
  const googleWindow = window as GoogleWindow;
  googleWindow.dataLayer = googleWindow.dataLayer || [];
  googleWindow.gtag = googleWindow.gtag || function gtag() {
    // Google Consent Mode expects the native arguments object in dataLayer.
    // eslint-disable-next-line prefer-rest-params
    googleWindow.dataLayer?.push(arguments);
  };
  return googleWindow.gtag;
}

function updateGoogleConsent(choice: ConsentChoice) {
  const gtag = getGoogleTagFunction();
  if (!gtag) return;

  gtag('consent', 'update', {
    analytics_storage: choice,
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });

  gtag('event', 'analytics_consent_update', {
    consent_state: choice,
  });
}

export default function AnalyticsConsent() {
  const pathname = usePathname();
  const { language } = useAppStore();
  const [choice, setChoice] = useState<ConsentChoice | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

  useEffect(() => {
    setChoice(readStoredChoice());
    setHasLoaded(true);
  }, []);

  if (
    !hasLoaded ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/signin')
  ) {
    return null;
  }

  const saveChoice = (nextChoice: ConsentChoice) => {
    persistChoice(nextChoice);
    updateGoogleConsent(nextChoice);
    setChoice(nextChoice);
    setIsPreferencesOpen(false);
  };

  const showBanner = choice === null || isPreferencesOpen;

  if (!showBanner) {
    return (
      <button
        type="button"
        onClick={() => setIsPreferencesOpen(true)}
        className="reader-focus-ring fixed bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] left-3 z-[70] inline-flex min-h-11 items-center gap-2 rounded-full border border-zinc-300 bg-white/95 px-3 py-2 text-xs font-semibold text-zinc-700 shadow-lg backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-200 md:bottom-4 md:left-4"
        aria-label={language === 'hi' ? 'कुकी सेटिंग बदलें' : 'Change cookie settings'}
      >
        <ShieldCheck className="h-4 w-4 text-orange-600" aria-hidden="true" />
        {language === 'hi' ? 'कुकी सेटिंग' : 'Cookie settings'}
      </button>
    );
  }

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="analytics-consent-title"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-[80] mx-auto max-w-3xl rounded-2xl border border-zinc-200 bg-white/95 p-4 shadow-2xl backdrop-blur dark:border-zinc-700 dark:bg-zinc-950/95 md:bottom-5 md:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400">
          <BarChart3 className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="analytics-consent-title" className="text-base font-bold text-zinc-950 dark:text-white">
            {language === 'hi' ? 'आपकी प्राइवेसी, आपकी पसंद' : 'Your privacy, your choice'}
          </h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            {language === 'hi'
              ? 'हम वेबसाइट के उपयोग को समझने और बेहतर बनाने के लिए वैकल्पिक Google Analytics का उपयोग करना चाहते हैं। विज्ञापन वैयक्तिकरण बंद रहता है।'
              : 'We would like to use optional Google Analytics to understand and improve the website. Advertising personalization stays disabled.'}
          </p>
          <Link
            href="/main/cookies"
            prefetch={false}
            className="reader-focus-ring mt-1 inline-flex min-h-8 items-center rounded-md text-sm font-semibold text-orange-700 underline underline-offset-4 dark:text-orange-400"
          >
            {language === 'hi' ? 'कुकी नीति पढ़ें' : 'Read the Cookie Policy'}
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => saveChoice('denied')}
          className="reader-focus-ring min-h-11 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-bold text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          {language === 'hi' ? 'वैकल्पिक एनालिटिक्स अस्वीकार करें' : 'Reject optional analytics'}
        </button>
        <button
          type="button"
          onClick={() => saveChoice('granted')}
          className="reader-focus-ring min-h-11 rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-700"
        >
          {language === 'hi' ? 'एनालिटिक्स की अनुमति दें' : 'Allow analytics'}
        </button>
      </div>
    </section>
  );
}
