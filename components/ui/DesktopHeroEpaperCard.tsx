import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CalendarDays } from 'lucide-react';

type DesktopHeroEpaperCardProps = {
  href: string;
  dateLabel?: string;
  thumbnailSrc: string;
  thumbnailAlt: string;
  eyebrowLabel: string;
  title: string;
  editionLabel: string;
  supportLabel?: string;
  ctaLabel: string;
  ariaLabel: string;
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
  ctaLabel,
  ariaLabel,
}: DesktopHeroEpaperCardProps) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="group relative block h-full overflow-hidden rounded-[1.55rem] border border-white/10 bg-[linear-gradient(180deg,#17171c_0%,#121319_100%)] px-4 py-3 text-white shadow-[0_22px_54px_rgba(0,0,0,0.24)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_28px_68px_rgba(0,0,0,0.3)]"
    >
      <div className="absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,rgba(239,68,68,0.9)_0%,rgba(249,115,22,0.72)_48%,transparent_100%)]" />
      <div className="relative grid h-full grid-cols-[132px_minmax(0,1fr)] items-stretch gap-4">
        <div className="flex items-start justify-center pt-0.5">
          <div className="w-full max-w-[120px] rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-1.5 shadow-[0_18px_34px_rgba(0,0,0,0.22)]">
            <div className="relative aspect-[3/4] overflow-hidden rounded-[1rem] bg-[#f6f1e8]">
              <Image
                src={thumbnailSrc}
                alt={thumbnailAlt}
                fill
                className="object-contain p-1 transition-transform duration-500 group-hover:scale-[1.02]"
                sizes="120px"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-[#f6f1e8] via-[#f6f1e8]/96 to-transparent" />
            </div>
          </div>
        </div>

        <div className="min-w-0 flex h-full flex-col py-0.5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">
              {eyebrowLabel}
            </p>
            <h3 className="mt-2 max-w-full truncate whitespace-nowrap text-[1rem] font-extrabold leading-tight tracking-tight text-white">
              {title}
            </h3>
            <p className="mt-1 truncate text-sm font-semibold text-zinc-200">
              {editionLabel}
            </p>
            {supportLabel ? (
              <p className="mt-2.5 max-w-[28ch] text-[11px] leading-[1.45] text-zinc-400">
                {supportLabel}
              </p>
            ) : null}
          </div>

          <div className="mt-4 pt-3">
            <div className="h-px bg-gradient-to-r from-transparent via-white/16 to-transparent" />
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            {dateLabel ? (
              <div className="inline-flex h-9 min-w-0 items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-3 text-[10px] font-semibold text-zinc-200">
                <CalendarDays className="h-3.5 w-3.5 text-red-300" />
                <span className="truncate">{dateLabel}</span>
              </div>
            ) : (
              <div />
            )}

            <div className="inline-flex h-9 items-center gap-2 rounded-full border border-red-400/25 bg-[linear-gradient(180deg,rgba(239,68,68,0.94)_0%,rgba(185,28,28,0.94)_100%)] px-4 text-[10px] font-bold text-white shadow-[0_14px_30px_rgba(127,29,29,0.24)] transition-transform duration-300 group-hover:translate-x-0.5">
              {ctaLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
