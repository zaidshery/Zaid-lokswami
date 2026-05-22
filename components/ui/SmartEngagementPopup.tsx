'use client';

import { useEffect, useMemo, useState } from 'react';
import { BellRing, CheckCircle2, Mail, Sparkles, X } from 'lucide-react';
import { useAppStore } from '@/lib/store/appStore';
import { trackClientEvent } from '@/lib/analytics/trackClient';

const POPUP_STORAGE_KEY = 'lokswami_marketing_popup_state_v1';
const DISMISS_COOLDOWN_MS = 2 * 24 * 60 * 60 * 1000;
const SUBMIT_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

const INTEREST_OPTIONS = [
  { value: 'national', labelEn: 'National', labelHi: '?????????' },
  { value: 'sports', labelEn: 'Sports', labelHi: '???' },
  { value: 'business', labelEn: 'Business', labelHi: '??????' },
  { value: 'entertainment', labelEn: 'Entertainment', labelHi: '???????' },
  { value: 'tech', labelEn: 'Tech', labelHi: '???' },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type PopupState = {
  dismissedAt?: number;
  submittedAt?: number;
};

function readPopupState(): PopupState {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(POPUP_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PopupState;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function savePopupState(next: PopupState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(POPUP_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // no-op
  }
}

export default function SmartEngagementPopup() {
  const { language } = useAppStore();
  const [isVisible, setIsVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [interests, setInterests] = useState<string[]>(['national']);
  const [consent, setConsent] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [hasTrackedView, setHasTrackedView] = useState(false);

  const t = useMemo(
    () =>
      language === 'hi'
        ? {
            title: '???? ??????? ???? ????',
            subtitle:
              '???? ???? ?? ?????, ?-???? ????? ?? ???? ????? ???? ?????',
            nameLabel: '??? (????????)',
            emailLabel: '????',
            interestsLabel: '???? ?? ???????',
            consentLabel:
              '??? ??????/????? ?????????? ?? ?????????? ??????????? ??????? ???? ?? ??? ????? ????/???? ????',
            submit: '??????? ???? ????',
            loading: '??? ?? ??? ??...',
            dismiss: '??? ????',
            success: '???????! ???? ????????? ??? ?? ???',
            invalidEmail: '????? ??? ???? ???? ?????',
            invalidConsent: '???? ???? ?? ??? ????? ????',
          }
        : {
            title: 'Enable Daily Alerts',
            subtitle:
              'Get your preferred news, e-paper alerts, and key updates directly.',
            nameLabel: 'Name (Optional)',
            emailLabel: 'Email',
            interestsLabel: 'Topics You Care About',
            consentLabel:
              'I agree to receive news alerts and marketing communication from Lokswami.',
            submit: 'Enable Alerts',
            loading: 'Saving...',
            dismiss: 'Not now',
            success: 'Thanks! Your preferences have been saved.',
            invalidEmail: 'Please enter a valid email address.',
            invalidConsent: 'Please provide consent to continue.',
          },
    [language]
  );

  useEffect(() => {
    let active = true;
    const state = readPopupState();
    const now = Date.now();

    if (state.submittedAt && now - state.submittedAt < SUBMIT_COOLDOWN_MS) {
      return;
    }

    if (state.dismissedAt && now - state.dismissedAt < DISMISS_COOLDOWN_MS) {
      return;
    }

    let timer: number | null = null;

    const maybeShow = () => {
      if (!active) return;
      if (window.scrollY < window.innerHeight * 0.3) return;
      setIsVisible(true);
      if (!hasTrackedView) {
        setHasTrackedView(true);
        trackClientEvent({
          event: 'engagement_popup_view',
          page: window.location.pathname,
          source: 'engagement_popup',
        });
      }
      window.removeEventListener('scroll', maybeShow);
    };

    timer = window.setTimeout(() => {
      window.addEventListener('scroll', maybeShow, { passive: true });
      maybeShow();
    }, 14000);

    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
      window.removeEventListener('scroll', maybeShow);
    };
  }, [hasTrackedView]);

  const closePopup = (reason: 'dismiss' | 'success') => {
    setIsVisible(false);
    const now = Date.now();
    const state = readPopupState();
    savePopupState({
      ...state,
      dismissedAt: reason === 'dismiss' ? now : state.dismissedAt,
      submittedAt: reason === 'success' ? now : state.submittedAt,
    });

    trackClientEvent({
      event: reason === 'success' ? 'engagement_popup_submit_success' : 'engagement_popup_dismiss',
      page: typeof window !== 'undefined' ? window.location.pathname : '/main',
      source: 'engagement_popup',
    });
  };

  const toggleInterest = (value: string) => {
    setInterests((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const submit = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setNotice(t.invalidEmail);
      return;
    }

    if (!consent) {
      setNotice(t.invalidConsent);
      return;
    }

    setIsSubmitting(true);
    setNotice('');

    try {
      const response = await fetch('/api/marketing/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email: normalizedEmail,
          interests,
          source: 'engagement-popup',
          campaign: 'daily-alerts',
          wantsDailyAlerts: true,
          consent,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !data.success) {
        setNotice(data.error || 'Unable to save right now. Please try again.');
        trackClientEvent({
          event: 'engagement_popup_submit_fail',
          page: window.location.pathname,
          source: 'engagement_popup',
          metadata: { status: response.status },
        });
        return;
      }

      setNotice(t.success);
      window.setTimeout(() => closePopup('success'), 700);
    } catch {
      setNotice('Unable to save right now. Please try again.');
      trackClientEvent({
        event: 'engagement_popup_submit_fail',
        page: window.location.pathname,
        source: 'engagement_popup',
        metadata: { reason: 'network_error' },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[120] flex items-end justify-center bg-black/35 p-3 pb-[calc(var(--reader-bottom-nav-space)+0.75rem)] sm:items-center sm:p-5">
      <div className="pointer-events-auto max-h-[var(--reader-bottom-sheet-max-height)] w-full max-w-xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 sm:max-h-[calc(100dvh-2.5rem)] sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <div className="inline-flex items-center gap-1 rounded-full border border-primary-300 bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-700 dark:border-primary-700/50 dark:bg-primary-500/12 dark:text-primary-300">
              <Sparkles className="h-3.5 w-3.5" />
              Smart Alerts
            </div>
            <h3 className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {t.title}
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => closePopup('dismiss')}
            className="reader-touch-button reader-focus-ring inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {t.nameLabel}
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-primary-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              placeholder={language === 'hi' ? '???? ???' : 'Your name'}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {t.emailLabel}
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 outline-none transition focus:border-primary-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                placeholder="you@example.com"
              />
            </div>
          </div>
        </div>

        <div className="mt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t.interestsLabel}
          </p>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((option) => {
              const active = interests.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleInterest(option.value)}
                  className={`reader-touch-button reader-focus-ring min-h-10 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'border-primary-400 bg-primary-50 text-primary-700 dark:border-primary-700/60 dark:bg-primary-500/15 dark:text-primary-300'
                      : 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  {language === 'hi' ? option.labelHi : option.labelEn}
                </button>
              );
            })}
          </div>
        </div>

        <label className="mt-3 flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-primary-600 focus:ring-primary-500 dark:border-zinc-700"
          />
          <span>{t.consentLabel}</span>
        </label>

        {notice ? (
          <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
            {notice}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={isSubmitting}
            className="reader-touch-button reader-focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-65"
          >
            {isSubmitting ? <BellRing className="h-4 w-4 animate-pulse" /> : <CheckCircle2 className="h-4 w-4" />}
            {isSubmitting ? t.loading : t.submit}
          </button>
          <button
            type="button"
            onClick={() => closePopup('dismiss')}
            className="reader-touch-button reader-focus-ring inline-flex min-h-11 items-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {t.dismiss}
          </button>
        </div>
      </div>
    </div>
  );
}
