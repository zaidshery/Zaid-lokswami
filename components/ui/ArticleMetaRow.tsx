'use client';

import { type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Newspaper } from 'lucide-react';
import type { Article } from '@/lib/mock/data';
import {
  buildArticleWhatsAppShareUrl,
  toAbsoluteShareUrl,
} from '@/lib/utils/articleShare';

interface ArticleMetaRowProps {
  article: Pick<Article, 'id' | 'title' | 'views'> & { image?: string };
  timeText: string;
  language: 'hi' | 'en';
  className?: string;
  compact?: boolean;
  withBorder?: boolean;
  inverted?: boolean;
  showWhatsAppText?: boolean;
  showWhatsAppButton?: boolean;
  showReadButton?: boolean;
  showEpaperButton?: boolean;
  sharePath?: string;
  readHref?: string;
}

export default function ArticleMetaRow({
  article,
  timeText,
  language,
  className = '',
  compact = false,
  withBorder = true,
  inverted = false,
  showWhatsAppText = true,
  showWhatsAppButton = true,
  showReadButton = true,
  showEpaperButton = false,
  sharePath,
  readHref,
}: ArticleMetaRowProps) {
  const router = useRouter();
  void timeText;

  const shareOnWhatsApp = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (typeof window === 'undefined') return;

    const resolvedPath =
      sharePath ?? `/main/article/${encodeURIComponent(article.id)}`;
    const articleUrl = toAbsoluteShareUrl(resolvedPath, window.location.origin);
    const shareUrl = buildArticleWhatsAppShareUrl({
      title: article.title,
      articleUrl,
    });
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  const openEpaper = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    router.push('/main/epaper');
  };

  const borderTone = inverted ? 'border-white/15' : 'border-zinc-200/80 dark:border-zinc-800';
  const readTone = inverted
    ? 'border-white/35 bg-white/10 text-white hover:bg-white/20'
    : 'border-zinc-300 bg-white text-zinc-700 hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-red-500/50 dark:hover:bg-red-500/15 dark:hover:text-red-300';
  const epaperTone = inverted
    ? 'border-orange-200/55 bg-orange-500/18 text-orange-100 hover:bg-orange-500/28'
    : 'border-orange-300/80 bg-white text-orange-700 hover:border-orange-400 hover:bg-orange-50 dark:border-orange-500/55 dark:bg-zinc-900 dark:text-orange-300 dark:hover:bg-orange-500/15';
  const whatsappTone = inverted
    ? 'border-emerald-200/55 bg-emerald-500/18 text-emerald-100 hover:bg-emerald-500/28'
    : 'border-emerald-300/85 bg-white text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-700/75 dark:bg-zinc-900 dark:text-emerald-300 dark:hover:bg-emerald-900/30';
  const ctaSize = compact
    ? 'h-5 px-1.5 text-[8.5px] sm:h-6 sm:px-2 sm:text-[9px]'
    : 'h-8 px-2.5 text-[10px] sm:h-9 sm:px-3 sm:text-xs';
  const iconSize = compact ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const actionWrap = compact
    ? 'ml-auto flex max-w-full flex-wrap items-center justify-end gap-1'
    : 'ml-auto flex max-w-full flex-wrap items-center justify-end gap-1.5';
  const ctaBase =
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full border font-semibold leading-none transition-colors shadow-sm active:scale-[0.98]';

  return (
    <div
      className={`${withBorder ? `border-t ${borderTone} pt-2` : ''} w-full ${className}`}
    >
      <div className={actionWrap}>
        {showEpaperButton ? (
          <button
            type="button"
            onClick={openEpaper}
            aria-label={language === 'hi' ? '\u0908-\u092a\u0947\u092a\u0930' : 'E-Paper'}
            className={`${ctaBase} ${ctaSize} attention-pulsate-bck ${epaperTone}`}
          >
            <Newspaper className={iconSize} />
            <span>
              {language === 'hi' ? '\u0908-\u092a\u0947\u092a\u0930' : 'E-Paper'}
            </span>
          </button>
        ) : null}

        {showWhatsAppButton ? (
          <button
            type="button"
            onClick={shareOnWhatsApp}
            aria-label={language === 'hi' ? '\u0935\u094d\u0939\u093e\u091f\u094d\u0938\u090f\u092a \u092a\u0930 \u0936\u0947\u092f\u0930 \u0915\u0930\u0947\u0902' : 'Share on WhatsApp'}
            className={`${ctaBase} ${ctaSize} ${whatsappTone}`}
          >
            <span className={`${iconSize} flex items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm`}>
              <svg viewBox="0 0 24 24" className={`${compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} fill-current`} aria-hidden="true">
                <path d="M12 2a10 10 0 0 0-8.68 14.95L2 22l5.2-1.36A10 10 0 1 0 12 2Zm0 18.17a8.15 8.15 0 0 1-4.15-1.13l-.3-.18-3.09.8.82-3.01-.2-.31A8.18 8.18 0 1 1 12 20.17Zm4.48-5.86c-.24-.12-1.4-.7-1.62-.77-.22-.08-.38-.12-.54.12-.16.24-.62.77-.76.93-.14.16-.28.18-.52.06-.24-.12-1-.37-1.91-1.17-.7-.63-1.18-1.4-1.32-1.64-.14-.24-.02-.37.1-.49.1-.1.24-.26.36-.39.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.79-.2-.47-.4-.41-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.33.98 2.49c.12.16 1.7 2.61 4.11 3.66.58.25 1.03.4 1.38.52.58.18 1.1.16 1.52.1.46-.07 1.4-.57 1.6-1.12.2-.55.2-1.02.14-1.12-.06-.1-.22-.16-.46-.28Z" />
              </svg>
            </span>
            {showWhatsAppText ? (
              <span>
                WhatsApp
              </span>
            ) : null}
          </button>
        ) : null}

        {showReadButton ? (
          readHref ? (
            <Link
              href={readHref}
              className={`${ctaBase} ${ctaSize} ${readTone}`}
              onClick={(event) => event.stopPropagation()}
            >
              {language === 'hi' ? '\u092a\u0942\u0930\u0940 \u0916\u092c\u0930' : 'Read Story'}
              <ArrowUpRight className={iconSize} />
            </Link>
          ) : (
            <span className={`${ctaBase} ${ctaSize} ${readTone}`}>
              {language === 'hi' ? '\u092a\u0942\u0930\u0940 \u0916\u092c\u0930' : 'Read Story'}
              <ArrowUpRight className={iconSize} />
            </span>
          )
        ) : null}
      </div>
    </div>
  );
}
