'use client';

import Link from 'next/link';
import { CalendarDays, Newspaper } from 'lucide-react';
import type { MouseEvent } from 'react';
import {
  buildEpaperIssueWhatsAppShareUrl,
  toAbsoluteShareUrl,
} from '@/lib/utils/articleShare';
import { isPdfAsset } from '@/lib/constants/epaperCities';
import ReaderImage from './ReaderImage';

type DesktopHeroEpaperCardProps = {
  href: string;
  dateLabel?: string;
  thumbnailSrc: string;
  thumbnailAlt: string;
  eyebrowLabel: string;
  title: string;
  editionLabel: string;
  supportLabel?: string;
  ariaLabel: string;
  primaryCtaLabel: string;
  shareLabel?: string;
};

export default function DesktopHeroEpaperCard({
  href,
  dateLabel,
  thumbnailSrc,
  thumbnailAlt,
  eyebrowLabel,
  title,
  editionLabel,
  supportLabel,
  ariaLabel,
  primaryCtaLabel,
  shareLabel = 'WhatsApp',
}: DesktopHeroEpaperCardProps) {
  const fallbackThumbnailSrc = '/placeholders/epaper-3x4.svg';
  const coverThumbnailSrc =
    thumbnailSrc && !isPdfAsset(thumbnailSrc) ? thumbnailSrc : fallbackThumbnailSrc;

  const shareOnWhatsApp = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    if (typeof window === 'undefined') return;

    const issueUrl = toAbsoluteShareUrl(href, window.location.origin);
    const whatsappUrl = buildEpaperIssueWhatsAppShareUrl({
      title: `${title} - ${editionLabel}`,
      issueUrl,
      cityLabel: editionLabel,
      dateLabel,
    });
    const opened = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    if (!opened) {
      window.location.href = whatsappUrl;
    }
  };

  return (
    <article
      className="epaper-premium-card group relative block h-full overflow-hidden rounded-[24px] border px-3 py-3 text-zinc-900 transition-all duration-300 hover:-translate-y-0.5 dark:text-white"
    >
      <div className="absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,rgba(239,68,68,0.9)_0%,rgba(249,115,22,0.72)_48%,transparent_100%)]" />

      <div className="relative grid h-full min-h-0 grid-cols-[128px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[156px_minmax(0,1fr)] xl:flex xl:flex-col xl:justify-center xl:gap-3.5">
        <Link
          href={href}
          aria-label={ariaLabel}
          className="reader-focus-ring flex min-h-0 w-full items-center justify-center px-0 xl:flex-none xl:pt-0"
        >
          <div className="relative mx-auto w-full max-w-[126px] sm:max-w-[150px] xl:max-w-[172px] 2xl:max-w-[188px]">
            <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-white shadow-[0_18px_42px_rgba(0,0,0,0.18)] ring-1 ring-black/5 dark:bg-zinc-950 dark:ring-white/10">
              <ReaderImage
                src={coverThumbnailSrc}
                alt={thumbnailAlt}
                fill
                fallbackSrc={fallbackThumbnailSrc}
                className="object-contain p-px"
                sizes="(max-width: 639px) 120px, (max-width: 1279px) 144px, (max-width: 1535px) 168px, 182px"
              />
            </div>
          </div>
        </Link>

        <div className="min-w-0 flex-none text-left xl:text-center">
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-red-300/35 bg-red-600/10 px-2.5 py-1 text-[8.75px] font-black uppercase text-red-700 shadow-none dark:border-red-400/20 dark:bg-red-500/12 dark:text-red-50 xl:mx-auto xl:px-3">
            <Newspaper className="h-3 w-3 text-red-500 dark:text-red-200" />
            <span className="truncate">{eyebrowLabel}</span>
          </span>

          <div className="space-y-1.5 pt-2">
            <Link
              href={href}
              className="reader-focus-ring newsroom-heading line-clamp-2 text-[0.98rem] font-black leading-tight text-zinc-950 transition hover:text-red-600 dark:text-white dark:hover:text-red-300 sm:text-[1.06rem] xl:text-[1.1rem]"
            >
              <span>{title}</span>
              <span className="newsroom-muted mx-1.5 font-medium text-zinc-500">-</span>
              <span className="newsroom-body font-semibold text-zinc-700 dark:text-zinc-200">{editionLabel}</span>
            </Link>

            {supportLabel ? (
              <p className="newsroom-muted max-w-[32ch] line-clamp-2 text-[11px] font-medium leading-[1.45] text-zinc-600 dark:text-zinc-400 xl:mx-auto">
                {supportLabel}
              </p>
            ) : null}
          </div>

          <div className="space-y-2.5 pt-2.5 xl:pt-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 sm:gap-2">
              {dateLabel ? (
                <span className="newsroom-pill-muted inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-md border px-2 text-[9px] font-bold shadow-none sm:px-3 sm:text-[9.5px]">
                  <CalendarDays className="h-3 w-3 text-red-500 dark:text-red-300" />
                  <span className="whitespace-nowrap">{dateLabel}</span>
                </span>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={shareOnWhatsApp}
                aria-label="Share e-paper on WhatsApp"
                className="reader-focus-ring inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-600/90 px-2 text-[9px] font-black text-white shadow-[0_10px_22px_rgba(5,150,105,0.16)] transition hover:bg-emerald-500 sm:px-3 sm:text-[9.5px]"
              >
                <WhatsAppIcon className="h-3.5 w-3.5" />
                <span>{shareLabel}</span>
              </button>
            </div>
            <Link
              href={href}
              aria-label={ariaLabel}
              className="reader-focus-ring inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-red-600 px-4 text-xs font-black text-white shadow-[0_16px_34px_rgba(185,28,28,0.25)] transition hover:bg-red-500"
            >
              <Newspaper className="h-4 w-4" />
              <span className="min-w-0 truncate">{primaryCtaLabel}</span>
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M16.04 3C8.82 3 2.99 8.82 3 16.02c0 2.3.6 4.55 1.74 6.53L3 29l6.63-1.72a12.95 12.95 0 0 0 6.4 1.63H16c7.2 0 13.03-5.82 13.04-13.02A13.01 13.01 0 0 0 16.04 3zm0 23.72h-.01a10.84 10.84 0 0 1-5.52-1.5l-.4-.24-3.94 1.02 1.05-3.84-.26-.4a10.86 10.86 0 1 1 9.08 4.96zm5.95-8.12c-.33-.17-1.95-.96-2.25-1.07-.3-.11-.52-.17-.74.17-.22.33-.85 1.07-1.05 1.29-.19.22-.39.25-.72.08-.33-.17-1.38-.51-2.64-1.62-.98-.88-1.64-1.97-1.84-2.3-.19-.33-.02-.51.15-.68.15-.15.33-.39.5-.58.17-.19.22-.33.33-.55.11-.22.06-.41-.03-.58-.08-.17-.74-1.79-1.01-2.45-.26-.64-.53-.55-.74-.56h-.63c-.22 0-.58.08-.88.41-.3.33-1.16 1.13-1.16 2.75 0 1.62 1.19 3.19 1.35 3.41.17.22 2.34 3.57 5.68 5 .79.34 1.41.54 1.89.69.79.25 1.5.22 2.07.13.63-.09 1.95-.8 2.23-1.57.27-.77.27-1.43.19-1.57-.08-.14-.3-.22-.63-.38z" />
    </svg>
  );
}
