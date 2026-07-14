'use client';

import { type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Newspaper } from 'lucide-react';
import type { Article } from '@/lib/mock/data';
import {
  buildArticleSharePath,
  buildArticleWhatsAppShareText,
} from '@/lib/utils/articleShare';
import ShareMenu from '@/components/ui/ShareMenu';

interface ArticleMetaRowProps {
  article: Pick<Article, 'id' | 'title' | 'views'> & {
    category?: string;
    image?: string;
    slug?: string;
    summary?: string;
  };
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
  readPriority?: boolean;
  sharePath?: string;
  readHref?: string;
  actionLayout?: 'wrap' | 'three-columns';
  secondaryLabelMode?: 'always' | 'hide-on-narrow';
  compactDensity?: 'normal' | 'tight';
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
  readPriority = false,
  sharePath,
  readHref,
  actionLayout = 'wrap',
  secondaryLabelMode = 'always',
  compactDensity = 'normal',
}: ArticleMetaRowProps) {
  const router = useRouter();
  void timeText;

  const resolvedSharePath =
    sharePath ?? buildArticleSharePath({ id: article.id, slug: article.slug });
  const brandedShareText = buildArticleWhatsAppShareText({
    title: article.title,
    articleUrl: resolvedSharePath,
    summary: article.summary,
    category: article.category,
    includeUrl: false,
  });

  const openEpaper = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    router.push('/main/epaper');
  };

  const borderTone = inverted ? 'border-white/15' : 'border-zinc-200/80 dark:border-zinc-800';
  const readTone = readPriority
    ? inverted
      ? 'border-red-400/55 bg-red-600 text-white shadow-[0_12px_26px_rgba(185,28,28,0.3)] hover:bg-red-500'
      : 'border-red-500 bg-red-600 text-white shadow-[0_12px_26px_rgba(185,28,28,0.2)] hover:bg-red-500'
    : inverted
    ? 'border-white/35 bg-white/10 text-white hover:bg-white/20'
    : 'border-zinc-300 bg-white text-zinc-700 hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-red-500/50 dark:hover:bg-red-500/15 dark:hover:text-red-300';
  const epaperTone = inverted && readPriority
    ? 'border-white/20 bg-white/[0.08] text-white/[0.88] hover:bg-white/[0.14]'
    : inverted
    ? 'border-orange-200/55 bg-orange-500/18 text-orange-100 hover:bg-orange-500/28'
    : 'border-orange-300/80 bg-white text-orange-700 hover:border-orange-400 hover:bg-orange-50 dark:border-orange-500/55 dark:bg-zinc-900 dark:text-orange-300 dark:hover:bg-orange-500/15';
  const shareTone = inverted && readPriority
    ? 'border-white/20 bg-white/[0.08] text-white/[0.88] hover:bg-white/[0.14]'
    : inverted
    ? 'border-sky-200/55 bg-sky-500/18 text-sky-100 hover:bg-sky-500/28'
    : 'border-sky-300/85 bg-white text-sky-700 hover:border-sky-400 hover:bg-sky-50 dark:border-sky-700/75 dark:bg-zinc-900 dark:text-sky-300 dark:hover:bg-sky-900/30';
  const useTightCompactActions =
    compact && actionLayout === 'three-columns' && compactDensity === 'tight';
  const ctaSize = compact
    ? actionLayout === 'three-columns'
      ? useTightCompactActions
        ? 'min-h-10 min-w-0 px-1.5 text-[8.5px] sm:px-2 sm:text-[8.75px]'
        : 'min-h-10 min-w-0 px-1 text-[8.5px] sm:px-2 sm:text-[9px]'
      : 'min-h-9 px-2 text-[9px] sm:min-h-10 sm:px-2.5 sm:text-[10px]'
    : 'min-h-11 px-2.5 text-[10px] sm:px-3 sm:text-xs';
  const iconSize = compact ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const actionWrap = actionLayout === 'three-columns'
    ? `grid w-full grid-cols-3 ${useTightCompactActions ? 'gap-1' : 'gap-1.5'}`
    : compact
      ? 'ml-auto flex max-w-full flex-wrap items-center justify-end gap-1'
      : 'ml-auto flex max-w-full flex-wrap items-center justify-end gap-1.5';
  const actionGap = actionLayout === 'three-columns'
    ? useTightCompactActions
      ? 'gap-0.5'
      : 'gap-1'
    : 'gap-1.5';
  const ctaBase =
    `reader-touch-button reader-focus-ring inline-flex min-w-0 items-center justify-center ${actionGap} ${actionLayout === 'three-columns' ? 'overflow-hidden' : ''} whitespace-nowrap rounded-full border font-semibold leading-none transition-colors shadow-sm active:scale-[0.98]`;
  const secondaryLabelClass =
    `${secondaryLabelMode === 'hide-on-narrow' ? 'max-[399px]:sr-only' : ''} min-w-0 truncate`;

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
            className={`${ctaBase} ${ctaSize} ${readPriority ? '' : 'attention-pulsate-bck'} ${epaperTone}`}
            data-reader-action="true"
          >
            <Newspaper className={iconSize} />
            <span className={secondaryLabelClass}>
              {language === 'hi' ? '\u0908-\u092a\u0947\u092a\u0930' : 'E-Paper'}
            </span>
          </button>
        ) : null}

        {showWhatsAppButton ? (
          <ShareMenu
            title={article.title}
            url={resolvedSharePath}
            text={article.summary || ''}
            whatsappText={brandedShareText}
            contentType="article"
            contentId={article.id}
            placement="article_card"
            language={language}
            triggerLabel={language === 'hi' ? '\u0936\u0947\u092f\u0930' : 'Share'}
            ariaLabel={language === 'hi' ? '\u0936\u0947\u092f\u0930 \u0915\u0930\u0928\u0947 \u0915\u093e \u0924\u0930\u0940\u0915\u093e \u091a\u0941\u0928\u0947\u0902' : 'Choose how to share article'}
            className={actionLayout === 'three-columns' ? 'w-full' : ''}
            buttonClassName={`${ctaBase} ${ctaSize} ${shareTone} ${actionLayout === 'three-columns' ? 'w-full' : ''} ${showWhatsAppText ? '' : '[&>span]:sr-only'}`}
          />
        ) : null}

        {showReadButton ? (
          readHref ? (
            <Link
              href={readHref}
              className={`${ctaBase} ${ctaSize} ${readTone}`}
              onClick={(event) => event.stopPropagation()}
              data-reader-action="true"
            >
              <span className="min-w-0 truncate">
                {language === 'hi' ? '\u092a\u0942\u0930\u0940 \u0916\u092c\u0930' : 'Read Story'}
              </span>
              <ArrowUpRight className={iconSize} />
            </Link>
          ) : (
            <span className={`${ctaBase} ${ctaSize} ${readTone}`} data-reader-action="true">
              <span className="min-w-0 truncate">
                {language === 'hi' ? '\u092a\u0942\u0930\u0940 \u0916\u092c\u0930' : 'Read Story'}
              </span>
              <ArrowUpRight className={iconSize} />
            </span>
          )
        ) : null}
      </div>
    </div>
  );
}
