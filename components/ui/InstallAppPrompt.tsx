'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  CheckCircle2,
  Download,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import { useAppStore } from '@/lib/store/appStore';
import {
  canRegisterServiceWorker,
  INSTALL_PROMPT_HIDE_EVENT,
  INSTALL_PROMPT_REQUEST_EVENT,
  isStandaloneMode,
  resolveInstallPlatform,
} from '@/lib/pwa/client';
import {
  canShowInstallPrompt,
  markInstallPromptShown,
  releaseActiveSurface,
} from '@/lib/popups/popupManager';
import { usePopupState } from '@/lib/popups/usePopupState';

const INSTALL_PROMPT_STORAGE_KEY = 'lokswami_install_prompt_state_v1';
const INSTALL_PROMPT_INITIAL_DELAY_MS = 10 * 1000;
const INSTALL_PROMPT_FOLLOW_UP_DELAY_MS = 30 * 1000;
const INSTALL_PROMPT_REPEAT_DELAY_MS = 60 * 1000;

type InstallPromptState = {
  dismissedAt?: number;
  acceptedAt?: number;
};

function normalizeInstallPromptState(raw: unknown): InstallPromptState {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const value = raw as InstallPromptState;
  return {
    dismissedAt:
      typeof value.dismissedAt === 'number' && Number.isFinite(value.dismissedAt)
        ? value.dismissedAt
        : undefined,
    acceptedAt:
      typeof value.acceptedAt === 'number' && Number.isFinite(value.acceptedAt)
        ? value.acceptedAt
        : undefined,
  };
}

function readInstallPromptState(): InstallPromptState {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(INSTALL_PROMPT_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    return normalizeInstallPromptState(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
}

function saveInstallPromptState(next: InstallPromptState) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      INSTALL_PROMPT_STORAGE_KEY,
      JSON.stringify(normalizeInstallPromptState(next))
    );
  } catch {
    // Ignore localStorage failures.
  }
}

function updateInstallPromptState(
  updater: (current: InstallPromptState) => InstallPromptState
) {
  const current = readInstallPromptState();
  const next = normalizeInstallPromptState(updater(current));
  saveInstallPromptState(next);
  return next;
}

function hasAcceptedPrompt(state: InstallPromptState) {
  return Boolean(state.acceptedAt && state.acceptedAt > 0);
}

function isEligiblePath(pathname: string | null) {
  if (!pathname) {
    return false;
  }

  return !(
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signin')
  );
}

export default function InstallAppPrompt() {
  const pathname = usePathname();
  const { language } = useAppStore();
  const popupState = usePopupState();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installState, setInstallState] = useState<InstallPromptState>(() =>
    readInstallPromptState()
  );
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [notice, setNotice] = useState('');
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  const eligiblePath = isEligiblePath(pathname);
  const installPlatform = resolveInstallPlatform();
  const isStandalone = isStandaloneMode();
  const hasAcceptedInstallPrompt = hasAcceptedPrompt(installState);
  const isReaderRoute = pathname?.startsWith('/main') ?? false;
  const isEpaperRoute = pathname?.startsWith('/main/epaper') ?? false;
  const isVideoRoute = pathname?.startsWith('/main/videos') ?? false;
  const canReuseActiveSurface = popupState.activeSurface === 'install-app';
  const autoPromptStateRef = useRef({
    canReuseActiveSurface,
    copyUnavailable: '',
    deferredPrompt: null as BeforeInstallPromptEvent | null,
    eligiblePath,
    installPlatform,
    isVisible: false,
  });

  const presentInstallPrompt = useCallback(
    ({
      useIosInstructions,
      nextNotice = '',
    }: {
      useIosInstructions: boolean;
      nextNotice?: string;
    }) => {
      if (!canReuseActiveSurface && !canShowInstallPrompt()) {
        return false;
      }

      markInstallPromptShown();
      setShowIosInstructions(useIosInstructions);
      setNotice(nextNotice);
      setIsVisible(true);
      return true;
    },
    [canReuseActiveSurface]
  );

  const copy = useMemo(() => {
    const installLabel =
      installPlatform === 'desktop'
        ? language === 'hi'
          ? '\u0921\u0947\u0938\u094d\u0915\u091f\u0949\u092a \u090f\u092a \u0907\u0902\u0938\u094d\u091f\u0949\u0932 \u0915\u0930\u0947\u0902'
          : 'Install desktop app'
        : installPlatform === 'android'
          ? language === 'hi'
            ? '\u0939\u094b\u092e \u0938\u094d\u0915\u094d\u0930\u0940\u0928 \u092a\u0930 \u091c\u094b\u0921\u093c\u0947\u0902'
            : 'Add to home screen'
          : language === 'hi'
            ? '\u0905\u092d\u0940 \u0907\u0902\u0938\u094d\u091f\u0949\u0932 \u0915\u0930\u0947\u0902'
            : 'Install app';

    if (language === 'hi') {
      return {
        badge:
          installPlatform === 'ios'
            ? '\u0939\u094b\u092e \u0938\u094d\u0915\u094d\u0930\u0940\u0928'
            : '\u090f\u092a \u0907\u0902\u0938\u094d\u091f\u0949\u0932',
        title: isEpaperRoute
          ? '\u0908-\u092a\u0947\u092a\u0930 \u090f\u0915 \u091f\u0948\u092a \u092a\u0930 \u0916\u094b\u0932\u0947\u0902'
          : isVideoRoute
            ? '\u0935\u0940\u0921\u093f\u092f\u094b \u0914\u0930 \u0928\u094d\u092f\u0942\u091c\u093c \u0924\u0947\u091c\u093c\u0940 \u0938\u0947 \u0916\u094b\u0932\u0947\u0902'
            : '\u0932\u094b\u0915\u0938\u094d\u0935\u093e\u092e\u0940 \u0915\u094b \u0939\u094b\u092e \u0938\u094d\u0915\u094d\u0930\u0940\u0928 \u092a\u0930 \u091c\u094b\u0921\u093c\u0947\u0902',
        subtitle:
          '\u0924\u0947\u091c\u093c \u090f\u0915\u094d\u0938\u0947\u0938, \u092b\u0941\u0932-\u0938\u094d\u0915\u094d\u0930\u0940\u0928 \u0930\u0940\u0921\u093f\u0902\u0917 \u0914\u0930 \u0915\u092e \u092c\u094d\u0930\u093e\u0909\u091c\u093c\u0930 \u0921\u093f\u0938\u094d\u091f\u094d\u0930\u0948\u0915\u094d\u0936\u0928\u0964',
        install: installLabel,
        installing:
          '\u0907\u0902\u0938\u094d\u091f\u0949\u0932 \u092a\u094d\u0930\u0949\u092e\u094d\u092a\u094d\u091f \u0916\u0941\u0932 \u0930\u0939\u093e \u0939\u0948...',
        dismiss: '\u0905\u092d\u0940 \u0928\u0939\u0940\u0902',
        iosTitle:
          '\u0905\u092a\u0928\u0947 iPhone \u092a\u0930 \u0932\u094b\u0915\u0938\u094d\u0935\u093e\u092e\u0940 \u0938\u0947\u0935 \u0915\u0930\u0947\u0902',
        iosSubtitle:
          'Safari \u092e\u0947\u0902 Share \u0926\u092c\u093e\u090f\u0902 \u0914\u0930 Add to Home Screen \u091a\u0941\u0928\u0947\u0902\u0964',
        unavailable:
          '\u0907\u0902\u0938\u094d\u091f\u0949\u0932 \u0935\u093f\u0915\u0932\u094d\u092a \u0905\u092d\u0940 \u0924\u0948\u092f\u093e\u0930 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964 \u090f\u0915 \u092c\u093e\u0930 \u0930\u093f\u092b\u094d\u0930\u0947\u0936 \u0915\u0930\u0915\u0947 \u092b\u093f\u0930 \u0915\u094b\u0936\u093f\u0936 \u0915\u0930\u0947\u0902\u0964',
        availability:
          '\u0938\u092a\u094b\u0930\u094d\u091f\u0947\u0921 \u092e\u094b\u092c\u093e\u0907\u0932 \u092c\u094d\u0930\u093e\u0909\u091c\u093c\u0930 \u0914\u0930 \u0921\u0947\u0938\u094d\u0915\u091f\u0949\u092a Chrome/Edge \u092e\u0947\u0902 \u0938\u092c\u0938\u0947 \u0905\u091a\u094d\u091b\u093e \u0915\u093e\u092e \u0915\u0930\u0924\u093e \u0939\u0948\u0964',
        benefits: [
          '\u092b\u093e\u0938\u094d\u091f \u0932\u0949\u0928\u094d\u091a',
          '\u092b\u0941\u0932 \u0938\u094d\u0915\u094d\u0930\u0940\u0928',
          '\u090f\u0915 \u091f\u0948\u092a \u0935\u093e\u092a\u0938\u0940',
        ],
        iosSteps: [
          'Safari \u0915\u0947 Share \u092c\u091f\u0928 \u092a\u0930 \u091f\u0948\u092a \u0915\u0930\u0947\u0902',
          'Add to Home Screen \u091a\u0941\u0928\u0947\u0902',
          '\u0939\u094b\u092e \u0938\u094d\u0915\u094d\u0930\u0940\u0928 \u0938\u0947 \u0932\u094b\u0915\u0938\u094d\u0935\u093e\u092e\u0940 \u0916\u094b\u0932\u0947\u0902',
        ],
      };
    }

    return {
      badge:
        installPlatform === 'ios' ? 'Add to Home Screen' : 'Install App',
      title: isEpaperRoute
        ? 'Install Lokswami for one-tap e-paper access'
        : isVideoRoute
          ? 'Install Lokswami for faster video opens'
          : 'Install Lokswami for faster daily reading',
      subtitle:
        'Launch faster, read full-screen, and come back without browser clutter.',
      install: installLabel,
      installing: 'Opening install prompt...',
      dismiss: 'Not now',
      iosTitle: 'Save Lokswami to your iPhone home screen',
      iosSubtitle: 'In Safari, tap Share and then choose Add to Home Screen.',
      unavailable:
        'This browser has not exposed the install option yet. Try Chrome or Edge, then reload once.',
      availability:
        'Works best in supported mobile browsers and desktop Chrome or Edge.',
      benefits: ['Fast launch', 'Full-screen reading', 'One-tap return'],
      iosSteps: [
        'Tap the Share button in Safari',
        'Choose Add to Home Screen',
        'Open Lokswami straight from your home screen',
      ],
    };
  }, [installPlatform, isEpaperRoute, isVideoRoute, language]);

  useEffect(() => {
    autoPromptStateRef.current = {
      canReuseActiveSurface,
      copyUnavailable: copy.unavailable,
      deferredPrompt,
      eligiblePath,
      installPlatform,
      isVisible,
    };
  }, [
    canReuseActiveSurface,
    copy.unavailable,
    deferredPrompt,
    eligiblePath,
    installPlatform,
    isVisible,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined' || !canRegisterServiceWorker()) {
      return;
    }

    let cancelled = false;

    navigator.serviceWorker
      .register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      })
      .then((registration) => {
        if (cancelled) {
          return;
        }

        void registration.update().catch(() => undefined);
      })
      .catch(() => {
        // Silent failure keeps the UI usable even if service worker registration fails.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!eligiblePath || isStandalone) {
      setIsVisible(false);
      setShowIosInstructions(false);
      releaseActiveSurface('install-app');
      return;
    }

    const handleBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setShowIosInstructions(false);
      setNotice('');
    };

    const handleAppInstalled = () => {
      const next = updateInstallPromptState((current) => ({
        ...current,
        acceptedAt: Date.now(),
      }));
      setInstallState(next);
      releaseActiveSurface('install-app');
      setDeferredPrompt(null);
      setShowIosInstructions(false);
      setIsVisible(false);
      setNotice('');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [eligiblePath, isStandalone]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handlePromptRequest = () => {
      const currentState = readInstallPromptState();
      if (!eligiblePath || isStandaloneMode() || hasAcceptedPrompt(currentState)) {
        return;
      }

      if (installPlatform === 'ios') {
        presentInstallPrompt({ useIosInstructions: true });
        return;
      }

      if (deferredPrompt) {
        presentInstallPrompt({ useIosInstructions: false });
        return;
      }

      presentInstallPrompt({
        useIosInstructions: false,
        nextNotice: copy.unavailable,
      });
    };

    window.addEventListener(INSTALL_PROMPT_REQUEST_EVENT, handlePromptRequest as EventListener);
    return () => {
      window.removeEventListener(
        INSTALL_PROMPT_REQUEST_EVENT,
        handlePromptRequest as EventListener
      );
    };
  }, [
    canReuseActiveSurface,
    copy.unavailable,
    deferredPrompt,
    eligiblePath,
    installPlatform,
    presentInstallPrompt,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handlePromptHide = () => {
      setIsVisible(false);
      setNotice('');
      releaseActiveSurface('install-app');
    };

    window.addEventListener(INSTALL_PROMPT_HIDE_EVENT, handlePromptHide as EventListener);
    return () => {
      window.removeEventListener(
        INSTALL_PROMPT_HIDE_EVENT,
        handlePromptHide as EventListener
      );
    };
  }, []);

  useEffect(() => {
    if (!eligiblePath || isStandalone || hasAcceptedInstallPrompt) {
      setIsVisible(false);
      setShowIosInstructions(false);
      releaseActiveSurface('install-app');
      return;
    }

    const attemptAutoPrompt = () => {
      const current = autoPromptStateRef.current;
      if (
        !current.eligiblePath ||
        current.isVisible ||
        document.visibilityState !== 'visible' ||
        document.body.dataset.lokswamiPopupActive === '1' ||
        isStandaloneMode()
      ) {
        return;
      }

      if (!current.canReuseActiveSurface && !canShowInstallPrompt()) {
        return;
      }

      presentInstallPrompt({
        useIosInstructions: current.installPlatform === 'ios' && !current.deferredPrompt,
        nextNotice:
          current.installPlatform === 'ios' || current.deferredPrompt
            ? ''
            : current.copyUnavailable,
      });
    };

    const initialTimer = window.setTimeout(
      attemptAutoPrompt,
      INSTALL_PROMPT_INITIAL_DELAY_MS
    );
    const followUpTimer = window.setTimeout(
      attemptAutoPrompt,
      INSTALL_PROMPT_FOLLOW_UP_DELAY_MS
    );

    let repeatTimer = 0;
    const repeatStarter = window.setTimeout(() => {
      attemptAutoPrompt();
      repeatTimer = window.setInterval(
        attemptAutoPrompt,
        INSTALL_PROMPT_REPEAT_DELAY_MS
      );
    }, INSTALL_PROMPT_REPEAT_DELAY_MS);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearTimeout(followUpTimer);
      window.clearTimeout(repeatStarter);
      if (repeatTimer) {
        window.clearInterval(repeatTimer);
      }
    };
  }, [eligiblePath, hasAcceptedInstallPrompt, isStandalone, pathname, presentInstallPrompt]);

  const dismissPrompt = () => {
    const next = updateInstallPromptState((current) => ({
      ...current,
      dismissedAt: Date.now(),
    }));
    setInstallState(next);
    releaseActiveSurface('install-app');
    setIsVisible(false);
    setNotice('');
  };

  const installApp = async () => {
    if (!deferredPrompt) {
      setNotice(copy.unavailable);
      return;
    }

    setIsInstalling(true);
    setNotice('');

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;

      const next = updateInstallPromptState((current) =>
        choice.outcome === 'accepted'
          ? {
              ...current,
              acceptedAt: Date.now(),
            }
          : {
              ...current,
              dismissedAt: Date.now(),
            }
      );

      setInstallState(next);
      releaseActiveSurface('install-app');
      setDeferredPrompt(null);
      setIsVisible(false);
    } catch {
      setNotice(copy.unavailable);
    } finally {
      setIsInstalling(false);
    }
  };

  if (!eligiblePath || !isVisible || isStandalone) {
    return null;
  }

  return (
    <div
      className={`pointer-events-none fixed inset-x-3 z-[115] ${
        isReaderRoute
          ? 'bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+0.75rem)] sm:bottom-4'
          : 'bottom-4'
      }`}
    >
      <section className="pointer-events-auto mx-auto w-full max-w-md overflow-hidden rounded-[1.8rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,247,247,0.96))] shadow-[0_28px_75px_rgba(15,23,42,0.22)] backdrop-blur dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(24,24,27,0.97),rgba(13,13,16,0.98))]">
        <div className="relative overflow-hidden px-4 pb-4 pt-4 sm:px-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_right,rgba(231,33,41,0.26),transparent_68%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#8b141a_0%,#e72129_52%,#c61d24_100%)]" />

          <div className="relative flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#8b141a_0%,#e72129_100%)] text-white shadow-[0_16px_30px_rgba(199,29,36,0.26)]">
                {showIosInstructions ? (
                  <Share2 className="h-5 w-5" />
                ) : (
                  <Download className="h-5 w-5" />
                )}
              </span>

              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-primary-200/80 bg-primary-50/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary-700 dark:border-primary-500/25 dark:bg-primary-500/10 dark:text-primary-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  {copy.badge}
                </div>
                <h2 className="mt-3 text-[1.05rem] font-black leading-tight tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-[1.15rem]">
                  {showIosInstructions ? copy.iosTitle : copy.title}
                </h2>
                <p className="mt-1.5 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                  {showIosInstructions ? copy.iosSubtitle : copy.subtitle}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={dismissPrompt}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/80 bg-white/80 text-zinc-600 shadow-sm backdrop-blur transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10"
              aria-label="Dismiss install prompt"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

        </div>

        <div className="border-t border-zinc-200/70 bg-white/70 px-4 py-4 backdrop-blur dark:border-zinc-800/80 dark:bg-white/[0.02] sm:px-5">
          {showIosInstructions ? (
            <div className="rounded-[1.4rem] border border-primary-100 bg-[linear-gradient(135deg,rgba(255,245,245,0.98),rgba(255,255,255,0.96))] p-4 shadow-sm dark:border-primary-500/20 dark:bg-[linear-gradient(135deg,rgba(99,20,24,0.18),rgba(255,255,255,0.03))]">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-200">
                  <Share2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-6 text-zinc-900 dark:text-zinc-100">
                    {copy.iosSubtitle}
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                    {copy.iosSteps.map((step) => (
                      <li key={step} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-600 dark:text-emerald-300" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          {notice ? <span className="sr-only">{notice}</span> : null}

          <div className={`${showIosInstructions ? 'mt-4' : ''} flex flex-col-reverse gap-2 sm:flex-row sm:items-center`}>
            {!showIosInstructions ? (
              <button
                type="button"
                onClick={() => void installApp()}
                disabled={isInstalling}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#b3171d_0%,#e72129_100%)] px-4 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(199,29,36,0.26)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {isInstalling ? copy.installing : copy.install}
              </button>
            ) : null}
            <button
              type="button"
              onClick={dismissPrompt}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-zinc-300/90 bg-white/85 px-4 text-sm font-semibold text-zinc-700 transition hover:bg-white dark:border-zinc-700 dark:bg-white/[0.03] dark:text-zinc-200 dark:hover:bg-white/[0.06]"
            >
              {copy.dismiss}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
