'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { type MouseEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Share2, Bookmark, ArrowUpRight } from 'lucide-react';
import { useAppStore } from '@/lib/store/appStore';
import type { Article } from '@/lib/mock/data';
import { buildArticleImageVariantUrl } from '@/lib/utils/articleMedia';
import ArticleMetaRow from './ArticleMetaRow';

interface HeroCardProps {
  article: Article;
  parallax?: { x: number; y: number };
  variant?: 'editorial' | 'modern';
}

export default function HeroCard({ article, parallax = { x: 0, y: 0 }, variant = 'editorial' }: HeroCardProps) {
  const router = useRouter();
  const { status } = useSession();
  const language = useAppStore((state) => state.language);
  const savedArticleIds = useAppStore((state) => state.currentUser?.savedArticles ?? null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isSavingBookmark, setIsSavingBookmark] = useState(false);
  const isSignedIn = status === 'authenticated';
  const isSavedInProfile = Array.isArray(savedArticleIds) && savedArticleIds.includes(article.id);
  const articleHref = `/main/article/${encodeURIComponent(article.id)}`;
  const canSaveArticle = /^[a-fA-F0-9]{24}$/.test(article.id);
  const heroImage = buildArticleImageVariantUrl(article.image, 'hero');

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    setIsBookmarked(isSavedInProfile);
  }, [isSavedInProfile]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleSavedArticleEvent = (
      event: Event
    ) => {
      const payload = (event as CustomEvent<{
        articleId?: string;
        saved?: boolean;
      }>).detail;

      if (!payload || payload.articleId !== article.id || typeof payload.saved !== 'boolean') {
        return;
      }

      setIsBookmarked(payload.saved);
    };

    window.addEventListener(
      'lokswami:saved-article-updated',
      handleSavedArticleEvent as EventListener
    );

    return () => {
      window.removeEventListener(
        'lokswami:saved-article-updated',
        handleSavedArticleEvent as EventListener
      );
    };
  }, [article.id]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diff < 60) {
      return language === 'hi' ? `${diff} min \u092a\u0939\u0932\u0947` : `${diff} min ago`;
    } else if (diff < 1440) {
      const hours = Math.floor(diff / 60);
      return language === 'hi' ? `${hours} \u0918\u0902\u091f\u0947 \u092a\u0939\u0932\u0947` : `${hours} hours ago`;
    } else {
      const days = Math.floor(diff / 1440);
      return language === 'hi' ? `${days} \u0926\u093f\u0928 \u092a\u0939\u0932\u0947` : `${days} days ago`;
    }
  };

  const renderTime = (dateString: string) =>
    isHydrated ? formatTime(dateString) : language === 'hi' ? '\u0939\u093e\u0932 \u0939\u0940 \u092e\u0947\u0902' : 'recently';

  const handleBookmarkClick = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!isSignedIn) {
      router.push('/signin?redirect=/main/saved');
      return;
    }

    if (!canSaveArticle || isSavingBookmark) return;

    setIsSavingBookmark(true);

    try {
      const response = await fetch('/api/user/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ articleId: article.id }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        data?: {
          saved?: boolean;
          savedArticleIds?: string[];
        };
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error('Failed to toggle bookmark');
      }

      const nextSaved = Boolean(payload.data.saved);
      setIsBookmarked(nextSaved);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('lokswami:saved-article-updated', {
            detail: {
              articleId: article.id,
              saved: nextSaved,
              savedArticleIds: Array.isArray(payload.data.savedArticleIds)
                ? payload.data.savedArticleIds
                : undefined,
            },
          })
        );
      }
    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
    } finally {
      setIsSavingBookmark(false);
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative h-full group"
    >
      <Link href={articleHref} className="block h-full md:flex md:flex-col">
        <div
          className={`relative overflow-hidden ${
            variant === 'editorial'
              ? 'h-[clamp(156px,25vh,210px)] min-[420px]:h-[clamp(172px,27vh,226px)] sm:h-[clamp(210px,30vh,265px)] md:flex-1 md:min-h-0 md:aspect-auto rounded-t-2xl rounded-b-none ring-1 ring-zinc-200/70 shadow-lg shadow-zinc-300/25 dark:ring-zinc-800 dark:shadow-black/30'
              : 'aspect-[16/9] md:h-[62%] md:aspect-auto rounded-2xl card-hover'
          }`}
        >
          <div
            className="absolute inset-0 transition-transform duration-700 ease-out will-change-transform"
            style={{ transform: `translate3d(${parallax.x}px, ${parallax.y}px, 0) scale(1)` }}
          >
            <Image
              src={heroImage}
              alt={article.title}
              fill
              className="object-cover image-hover-zoom"
              sizes="(max-width: 767px) 100vw, (max-width: 1279px) 66vw, 900px"
              priority
            />
          </div>

          <div
            className={`absolute inset-0 transition-opacity ${
              variant === 'editorial'
                ? 'bg-gradient-to-t from-black/65 via-black/15 to-black/35 md:from-black/45 md:via-black/15 md:to-transparent group-hover:from-black/70 group-hover:via-black/25 md:group-hover:from-black/55 md:group-hover:via-black/20'
                : 'bg-gradient-to-t from-black/90 via-black/60 to-black/10 group-hover:from-black group-hover:via-black/75'
            }`}
          />

          {variant === 'modern' ? (
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 lg:p-10">
              <h1 className="hi-heading mb-4 text-2xl font-extrabold text-white transition-colors group-hover:text-gray-100 sm:text-3xl md:text-4xl lg:text-5xl md:line-clamp-3">
                {article.title}
              </h1>

              <p className="hi-body mb-5 hidden line-clamp-2 text-sm text-gray-200 md:block md:text-base lg:text-lg">
                {article.summary}
              </p>

              <div className="text-xs text-gray-300 md:text-sm">
                <span className="inline-flex items-center rounded-full border border-white/25 bg-black/25 px-3 py-1 font-semibold text-white/95 backdrop-blur-sm">
                  {article.author.name}
                </span>
              </div>
            </div>
          ) : null}

          {variant === 'modern' ? (
            <div className="absolute top-6 right-6 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="w-11 h-11 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:bg-lokswami-red transition-all shadow-lg hover:shadow-lokswami-red/50"
                aria-label="Share"
              >
                <Share2 className="w-5 h-5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleBookmarkClick}
                className={`w-11 h-11 rounded-full backdrop-blur-md flex items-center justify-center transition-all shadow-lg ${
                  isBookmarked
                    ? 'bg-lokswami-red text-white hover:bg-red-700 hover:shadow-lokswami-red/50'
                    : 'bg-black/60 text-white hover:bg-lokswami-red hover:shadow-lokswami-red/50'
                } ${!canSaveArticle || isSavingBookmark ? 'cursor-not-allowed opacity-60' : ''}`}
                disabled={!canSaveArticle || isSavingBookmark}
                aria-pressed={isBookmarked}
                aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
                title={
                  !canSaveArticle
                    ? language === 'hi'
                      ? '\u0921\u0947\u092e\u094b \u0938\u094d\u091f\u094b\u0930\u0940 \u0915\u094b \u0938\u0947\u0935 \u0928\u0939\u0940\u0902 \u0915\u093f\u092f\u093e \u091c\u093e \u0938\u0915\u0924\u093e'
                      : 'Demo stories cannot be saved'
                    : undefined
                }
              >
                <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
              </motion.button>
            </div>
          ) : null}
        </div>

        {variant === 'editorial' ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.06 }}
            className="relative z-10 -mt-px rounded-b-2xl border border-t-0 border-zinc-200/80 bg-gradient-to-b from-white via-zinc-50 to-zinc-100 px-2.5 pb-1.5 pt-1.5 shadow-lg shadow-zinc-300/35 backdrop-blur-[1px] dark:border-zinc-800 dark:from-zinc-900/95 dark:via-zinc-950/95 dark:to-zinc-900 dark:shadow-black/25 md:hidden sm:px-3 sm:pb-2 sm:pt-2"
          >
            <span className="mb-2 block h-1.5 w-8 rounded-full bg-gradient-to-r from-red-500 to-red-400" />

            <div className="min-h-0">
              <h1 className="hi-heading line-clamp-2 text-[clamp(0.9rem,3.7vw,1.02rem)] font-semibold leading-[1.2] text-zinc-900 dark:text-white sm:text-[clamp(0.96rem,3.9vw,1.08rem)]">
                {article.title}
              </h1>
            </div>

            <ArticleMetaRow
              article={article}
              timeText={renderTime(article.publishedAt)}
              language={language}
              className="mt-1 !pt-0.5 sm:mt-1.5 sm:!pt-1"
              compact
              withBorder
              showWhatsAppText
              showEpaperButton
            />
          </motion.div>
        ) : null}

        {variant === 'editorial' ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08 }}
            className="relative z-10 -mt-px hidden rounded-b-2xl border border-t-0 border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50 px-4 pb-1 pt-3 shadow-lg shadow-zinc-200/35 dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-900/80 dark:shadow-black/30 md:flex md:flex-col"
          >
            <div className="mb-2.5 flex items-center justify-between">
              <span className="h-1.5 w-10 rounded-full bg-gradient-to-r from-red-500 to-red-400" />
              <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                Top Pick <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>

            <div className="min-h-0 flex-1 space-y-1.5">
              <h1 className="hi-heading line-clamp-2 text-[1.2rem] font-semibold leading-[1.24] text-zinc-900 dark:text-zinc-100 lg:text-[1.34rem]">
                {article.title}
              </h1>
              <p className="hi-body line-clamp-1 text-[0.86rem] leading-[1.4] text-zinc-600 dark:text-zinc-300">
                {article.summary}
              </p>
            </div>

            <ArticleMetaRow
              article={article}
              timeText={renderTime(article.publishedAt)}
              language={language}
              className="mt-1.5 !pt-1"
              withBorder
              showWhatsAppText
              showEpaperButton
            />
          </motion.div>
        ) : null}
      </Link>
    </motion.article>
  );
}

