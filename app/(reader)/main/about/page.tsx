'use client';

import Link from 'next/link';
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  Mail,
  Newspaper,
  Phone,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { useAppStore } from '@/lib/store/appStore';
import { COMPANY_INFO } from '@/lib/constants/company';

const COPY = {
  en: {
    heroTag: 'About Lokswami',
    title: 'Trusted Digital News Platform for Hindi Readers',
    subtitle:
      'Lokswami delivers reliable, fast, and reader-first journalism across national, regional, and global updates.',
    storyTitle: 'Our Story',
    storyText:
      'Lokswami was built with a simple goal: make quality Hindi news accessible on every screen. From breaking alerts to deep coverage, we focus on clarity, speed, and accuracy.',
    missionTitle: 'Our Mission',
    missionText:
      'To provide factual, balanced, and timely reporting that helps readers make informed decisions every day.',
    valuesTitle: 'Editorial Principles',
    value1Title: 'Accuracy First',
    value1Text: 'Every report is checked for factual correctness before publication.',
    value2Title: 'Public Interest',
    value2Text: 'We prioritize stories that matter to people and communities.',
    value3Title: 'Responsible Reporting',
    value3Text: 'We avoid sensationalism and maintain editorial discipline.',
    statsTitle: 'Platform Snapshot',
    statFounded: 'Registration',
    statCoverage: 'Coverage',
    statLanguages: 'Language',
    statFocus: 'Focus',
    statCoverageValue: 'National + Regional + International',
    statLanguagesValue: 'Hindi / English',
    statFocusValue: 'News, Video, E-Paper',
    contactTitle: 'Contact & Editorial Desk',
    contactText:
      'For news tips, corrections, advertising, or business inquiries, connect with our team directly.',
    contactButton: 'Go to Contact Page',
    addressLabel: 'Office Address',
    phoneLabel: 'Phone',
    emailLabel: 'Email',
  },
  hi: {
    heroTag: '\u0932\u094b\u0915\u0938\u094d\u0935\u093e\u092e\u0940 \u0915\u0947 \u092c\u093e\u0930\u0947 \u092e\u0947\u0902',
    title: '\u0939\u093f\u0902\u0926\u0940 \u092a\u093e\u0920\u0915\u094b\u0902 \u0915\u0947 \u0932\u093f\u090f \u0935\u093f\u0936\u094d\u0935\u0938\u0928\u0940\u092f \u0921\u093f\u091c\u093f\u091f\u0932 \u0928\u094d\u092f\u0942\u091c \u092a\u094d\u0932\u0947\u091f\u092b\u0949\u0930\u094d\u092e',
    subtitle:
      '\u0932\u094b\u0915\u0938\u094d\u0935\u093e\u092e\u0940 \u0930\u093e\u0937\u094d\u091f\u094d\u0930\u0940\u092f, \u0915\u094d\u0937\u0947\u0924\u094d\u0930\u0940\u092f \u0914\u0930 \u0935\u0948\u0936\u094d\u0935\u093f\u0915 \u0938\u092e\u093e\u091a\u093e\u0930 \u0915\u094b \u0924\u0947\u091c, \u0938\u0920\u0940\u0915 \u0914\u0930 \u091c\u093f\u092e\u094d\u092e\u0947\u0926\u093e\u0930 \u0924\u0930\u0940\u0915\u0947 \u0938\u0947 \u092a\u0947\u0936 \u0915\u0930\u0924\u093e \u0939\u0948\u0964',
    storyTitle: '\u0939\u092e\u093e\u0930\u0940 \u0915\u0939\u093e\u0928\u0940',
    storyText:
      '\u0932\u094b\u0915\u0938\u094d\u0935\u093e\u092e\u0940 \u0915\u093e \u0932\u0915\u094d\u0937\u094d\u092f \u0936\u0941\u0930\u0942 \u0938\u0947 \u090f\u0915 \u0939\u0940 \u0930\u0939\u093e: \u0917\u0941\u0923\u0935\u0924\u094d\u0924\u093e\u092a\u0942\u0930\u094d\u0923 \u0939\u093f\u0902\u0926\u0940 \u0938\u092e\u093e\u091a\u093e\u0930 \u0915\u094b \u0939\u0930 \u0938\u094d\u0915\u094d\u0930\u0940\u0928 \u0924\u0915 \u092a\u0939\u0941\u0902\u091a\u093e\u0928\u093e\u0964 \u092c\u094d\u0930\u0947\u0915\u093f\u0902\u0917 \u0938\u0947 \u0932\u0947\u0915\u0930 \u0935\u093f\u0938\u094d\u0924\u0943\u0924 \u0935\u093f\u0936\u094d\u0932\u0947\u0937\u0923 \u0924\u0915, \u0939\u092e \u0938\u0920\u0940\u0915\u0924\u093e \u0914\u0930 \u0938\u094d\u092a\u0937\u094d\u091f\u0924\u093e \u092a\u0930 \u0927\u094d\u092f\u093e\u0928 \u0926\u0947\u0924\u0947 \u0939\u0948\u0902\u0964',
    missionTitle: '\u0939\u092e\u093e\u0930\u093e \u092e\u093f\u0936\u0928',
    missionText:
      '\u092a\u093e\u0920\u0915\u094b\u0902 \u0924\u0915 \u0924\u0925\u094d\u092f\u093e\u0927\u093e\u0930\u093f\u0924, \u0938\u0902\u0924\u0941\u0932\u093f\u0924 \u0914\u0930 \u0938\u092e\u092f\u092c\u0926\u094d\u0927 \u0938\u092e\u093e\u091a\u093e\u0930 \u092a\u0939\u0941\u0902\u091a\u093e\u0928\u093e, \u0924\u093e\u0915\u093f \u0935\u0947 \u0930\u094b\u091c\u093c\u092e\u0930\u094d\u0930\u093e \u0915\u0947 \u0928\u093f\u0930\u094d\u0923\u092f \u0938\u0939\u0940 \u091c\u093e\u0928\u0915\u093e\u0930\u0940 \u0915\u0947 \u0938\u093e\u0925 \u0932\u0947 \u0938\u0915\u0947\u0902\u0964',
    valuesTitle: '\u0938\u0902\u092a\u093e\u0926\u0915\u0940\u092f \u0938\u093f\u0926\u094d\u0927\u093e\u0902\u0924',
    value1Title: '\u0938\u0920\u0940\u0915\u0924\u093e \u0938\u092c\u0938\u0947 \u092a\u0939\u0932\u0947',
    value1Text: '\u0939\u0930 \u0938\u092e\u093e\u091a\u093e\u0930 \u0915\u094b \u092a\u094d\u0930\u0915\u093e\u0936\u093f\u0924 \u0915\u0930\u0928\u0947 \u0938\u0947 \u092a\u0939\u0932\u0947 \u0924\u0925\u094d\u092f \u091c\u093e\u0902\u091a \u0915\u0940 \u091c\u093e\u0924\u0940 \u0939\u0948\u0964',
    value2Title: '\u091c\u0928\u0939\u093f\u0924 \u0938\u0930\u094d\u0935\u094b\u092a\u0930\u093f',
    value2Text: '\u0939\u092e \u0909\u0928 \u0935\u093f\u0937\u092f\u094b\u0902 \u0915\u094b \u092a\u094d\u0930\u093e\u0925\u092e\u093f\u0915\u0924\u093e \u0926\u0947\u0924\u0947 \u0939\u0948\u0902 \u091c\u094b \u0932\u094b\u0917\u094b\u0902 \u0914\u0930 \u0938\u092e\u093e\u091c \u0938\u0947 \u091c\u0941\u0921\u093c\u0947 \u0939\u094b\u0902\u0964',
    value3Title: '\u091c\u093f\u092e\u094d\u092e\u0947\u0926\u093e\u0930 \u0930\u093f\u092a\u094b\u0930\u094d\u091f\u093f\u0902\u0917',
    value3Text: '\u0939\u092e \u0938\u0902\u0938\u0928\u0940\u0916\u0947\u091c\u093c \u092a\u094d\u0930\u0938\u094d\u0924\u0941\u0924\u093f \u0938\u0947 \u092c\u091a\u0924\u0947 \u0939\u0941\u090f \u0938\u0902\u092a\u093e\u0926\u0915\u0940\u092f \u0905\u0928\u0941\u0936\u093e\u0938\u0928 \u092c\u0928\u093e\u090f \u0930\u0916\u0924\u0947 \u0939\u0948\u0902\u0964',
    statsTitle: '\u092a\u094d\u0932\u0947\u091f\u092b\u0949\u0930\u094d\u092e \u091d\u0932\u0915',
    statFounded: '\u0930\u091c\u093f\u0938\u094d\u091f\u094d\u0930\u0947\u0936\u0928',
    statCoverage: '\u0915\u0935\u0930\u0947\u091c',
    statLanguages: '\u092d\u093e\u0937\u093e',
    statFocus: '\u092b\u094b\u0915\u0938',
    statCoverageValue: '\u0930\u093e\u0937\u094d\u091f\u094d\u0930\u0940\u092f + \u0915\u094d\u0937\u0947\u0924\u094d\u0930\u0940\u092f + \u0905\u0902\u0924\u0930\u0930\u093e\u0937\u094d\u091f\u094d\u0930\u0940\u092f',
    statLanguagesValue: '\u0939\u093f\u0902\u0926\u0940 / English',
    statFocusValue: '\u0928\u094d\u092f\u0942\u091c, \u0935\u0940\u0921\u093f\u092f\u094b, \u0908-\u092a\u0947\u092a\u0930',
    contactTitle: '\u0938\u0902\u092a\u0930\u094d\u0915 \u0914\u0930 \u090f\u0921\u093f\u091f\u094b\u0930\u093f\u092f\u0932 \u0921\u0947\u0938\u094d\u0915',
    contactText:
      '\u0928\u094d\u092f\u0942\u091c \u091f\u093f\u092a\u094d\u0938, \u0938\u0941\u0927\u093e\u0930, \u0935\u093f\u091c\u094d\u091e\u093e\u092a\u0928 \u092f\u093e \u0935\u094d\u092f\u093e\u0935\u0938\u093e\u092f\u093f\u0915 \u091c\u093e\u0928\u0915\u093e\u0930\u0940 \u0915\u0947 \u0932\u093f\u090f \u0939\u092e\u093e\u0930\u0940 \u091f\u0940\u092e \u0938\u0947 \u0938\u0940\u0927\u093e \u0938\u0902\u092a\u0930\u094d\u0915 \u0915\u0930\u0947\u0902\u0964',
    contactButton: '\u0915\u0949\u0928\u094d\u091f\u0948\u0915\u094d\u091f \u092a\u0947\u091c \u092a\u0930 \u091c\u093e\u090f\u0902',
    addressLabel: '\u0911\u092b\u093f\u0938 \u092a\u0924\u093e',
    phoneLabel: '\u092b\u094b\u0928',
    emailLabel: '\u0908\u092e\u0947\u0932',
  },
};

export default function AboutPage() {
  const { language } = useAppStore();
  const t = COPY[language];

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="cnp-surface p-5 sm:p-6">
        <span className="inline-flex rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-500 dark:text-red-300">
          {t.heroTag}
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
          {t.title}
        </h1>
        <p className="mt-2 max-w-4xl text-sm text-zinc-600 dark:text-zinc-400 sm:text-base">
          {t.subtitle}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="cnp-surface p-5 sm:p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 sm:text-xl">
            {t.storyTitle}
          </h2>
          <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-400 sm:text-[15px]">
            {t.storyText}
          </p>

          <h3 className="mt-5 text-base font-semibold text-zinc-900 dark:text-zinc-50 sm:text-lg">
            {t.missionTitle}
          </h3>
          <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-400 sm:text-[15px]">
            {t.missionText}
          </p>
        </div>

        <aside className="cnp-surface p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 sm:text-xl">
            {t.valuesTitle}
          </h2>
          <ul className="mt-4 space-y-4">
            <li className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/70">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                <BadgeCheck className="h-4 w-4 text-emerald-500" />
                {t.value1Title}
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t.value1Text}</p>
            </li>
            <li className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/70">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                <Target className="h-4 w-4 text-orange-500" />
                {t.value2Title}
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t.value2Text}</p>
            </li>
            <li className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/70">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                <ShieldCheck className="h-4 w-4 text-sky-500" />
                {t.value3Title}
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t.value3Text}</p>
            </li>
          </ul>
        </aside>
      </div>

      <div className="cnp-surface p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 sm:text-xl">
          {t.statsTitle}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <CalendarDays className="h-4 w-4 text-red-500" />
              {t.statFounded}
            </div>
            <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{COMPANY_INFO.registration.number}</p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <Building2 className="h-4 w-4 text-red-500" />
              {t.statCoverage}
            </div>
            <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t.statCoverageValue}</p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <Newspaper className="h-4 w-4 text-red-500" />
              {t.statLanguages}
            </div>
            <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t.statLanguagesValue}</p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <Target className="h-4 w-4 text-red-500" />
              {t.statFocus}
            </div>
            <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t.statFocusValue}</p>
          </div>
        </div>
      </div>

      <div className="cnp-surface p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 sm:text-xl">
          {t.contactTitle}
        </h2>
        <p className="mt-2 max-w-4xl text-sm text-zinc-600 dark:text-zinc-400 sm:text-base">
          {t.contactText}
        </p>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{t.addressLabel}</p>
            <a
              href={COMPANY_INFO.address.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm font-medium text-zinc-800 hover:text-orange-600 dark:text-zinc-200 dark:hover:text-orange-400"
            >
              {COMPANY_INFO.address.displayAddress}
            </a>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{t.phoneLabel}</p>
            <a href={COMPANY_INFO.contact.phoneHref} className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-zinc-800 hover:text-orange-600 dark:text-zinc-200 dark:hover:text-orange-400">
              <Phone className="h-4 w-4 text-orange-500" />
              {COMPANY_INFO.contact.phoneDisplay}
            </a>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{t.emailLabel}</p>
            <a href={`mailto:${COMPANY_INFO.contact.email}`} className="mt-2 inline-flex items-center gap-2 break-all text-sm font-semibold text-zinc-800 hover:text-orange-600 dark:text-zinc-200 dark:hover:text-orange-400">
              <Mail className="h-4 w-4 text-orange-500" />
              {COMPANY_INFO.contact.email}
            </a>
          </div>
        </div>

        <div className="mt-5">
          <Link
            href="/contact"
            className="inline-flex items-center rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500"
          >
            {t.contactButton}
          </Link>
        </div>
      </div>
    </section>
  );
}
