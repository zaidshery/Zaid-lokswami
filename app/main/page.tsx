'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import {
  TrendingUp,
  ArrowRight,
  Flame,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Newspaper,
} from 'lucide-react';
import HeroCarousel from '@/app/components/content/HeroCarousel';
import StoriesRail from '@/app/components/content/StoriesRail';
import NewsCard from '@/app/components/content/NewsCard';
import { articles as mockArticles, type Article } from '@/lib/mock/data';
import { categoryMatches, fetchMergedLiveArticles } from '@/lib/content/liveArticles';
import {
  buildVisualStoriesFromArticles,
  type VisualStory,
} from '@/lib/content/visualStories';
import { fetchLiveStories } from '@/lib/content/liveStories';
import { NEWS_CATEGORY_DEFINITIONS, resolveNewsCategory } from '@/lib/constants/newsCategories';
import { useAppStore } from '@/lib/store/appStore';
import {
  buildArticleWhatsAppShareUrl,
  toAbsoluteShareUrl,
} from '@/lib/utils/articleShare';
import {
  buildArticleImageVariantUrl,
  resolveArticleOgImageUrl,
} from '@/lib/utils/articleMedia';

function hexToRgba(hex: string, alpha: number) {
  const cleaned = hex.replace('#', '').trim();
  const normalized = cleaned.length === 3
    ? cleaned.split('').map((token) => token + token).join('')
    : cleaned;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return `rgba(249, 115, 22, ${alpha})`;
  }
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function HomePage() {
  const { language } = useAppStore();
  const topStoriesVariant: 'editorial' | 'modern' = 'editorial';
  const categoryScrollerRef = useRef<HTMLDivElement | null>(null);
  const [feedArticles, setFeedArticles] = useState<Article[]>(mockArticles);
  const [cmsStories, setCmsStories] = useState<VisualStory[]>([]);
  const heroArticles = feedArticles.slice(0, 5);
  const trendingArticles = feedArticles.filter((article) => article.isTrending);
  const spotlightDesktop = (trendingArticles.length ? trendingArticles : feedArticles).slice(0, 4);
  const spotlightTablet = (trendingArticles.length ? trendingArticles : feedArticles).slice(0, 3);
  const latestNews = (feedArticles.length > 7 ? feedArticles.slice(5, 12) : feedArticles.slice(0, 12));
  const featuredSidebar: Article[] = (trendingArticles.length ? trendingArticles : feedArticles).slice(0, 5);
  const visualStories = useMemo(
    () =>
      cmsStories.length
        ? cmsStories.slice(0, 10)
        : buildVisualStoriesFromArticles(feedArticles, 10),
    [cmsStories, feedArticles]
  );
  const categoryPanels = useMemo(() => {
    const panelSlugs = ['regional', 'national', 'international', 'technology', 'business'];
    return panelSlugs.map((slug) => {
      const category = resolveNewsCategory(slug);
      const items = feedArticles
        .filter((article) => categoryMatches(article.category, slug, NEWS_CATEGORY_DEFINITIONS))
        .slice(0, 4);
      return {
        slug,
        category,
        items,
        lead: items[0] || null,
        rest: items.slice(1, 4),
        accent: category?.color || '#F97316',
      };
    });
  }, [feedArticles]);

  const scrollCategoryStrip = (direction: 'prev' | 'next') => {
    const node = categoryScrollerRef.current;
    if (!node) return;
    const delta = Math.max(260, Math.floor(node.clientWidth * 0.88));
    node.scrollBy({
      left: direction === 'next' ? delta : -delta,
      behavior: 'smooth',
    });
  };

  const openArticleOnWhatsApp = (article: Article | null, fallbackPath: string) => {
    if (typeof window === 'undefined') return;

    const origin = window.location.origin;
    const articlePath = article?.id
      ? `/main/article/${encodeURIComponent(article.id)}`
      : fallbackPath;
    const articleUrl = toAbsoluteShareUrl(articlePath, origin);
    const imageUrl = article?.image
      ? toAbsoluteShareUrl(resolveArticleOgImageUrl({ image: article.image }), origin)
      : '';
    const title = article?.title?.trim() || (language === 'hi' ? 'लोकस्वामी खबर' : 'Lokswami story');
    const shareUrl = buildArticleWhatsAppShareUrl({
      title,
      articleUrl,
      imageUrl,
    });

    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      const merged = await fetchMergedLiveArticles(100);
      if (active) {
        setFeedArticles(merged);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadStories = async () => {
      const rows = await fetchLiveStories(20);
      if (active) {
        setCmsStories(rows);
      }
    };

    loadStories();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="relative pb-3 [--section-gap:1rem] sm:[--section-gap:1.25rem] lg:[--section-gap:1.5rem]">
      <div className="pointer-events-none absolute -top-16 right-0 h-60 w-60 rounded-full bg-orange-200/45 blur-3xl dark:bg-orange-900/20" />
      <div className="pointer-events-none absolute top-[26rem] -left-16 h-64 w-64 rounded-full bg-cyan-200/35 blur-3xl dark:bg-cyan-900/20" />

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
        className={`relative overflow-hidden cnp-surface [--ts-pad:0.45rem] [--ts-gap:0.55rem] [--ts-toolbar-gap:0.35rem] max-[360px]:[--ts-pad:0.34rem] max-[360px]:[--ts-gap:0.4rem] max-[360px]:[--ts-toolbar-gap:0.22rem] p-[var(--ts-pad)] sm:[--ts-pad:0.875rem] sm:[--ts-gap:0.875rem] md:[--ts-pad:1.125rem] md:[--ts-gap:1rem] lg:[--ts-pad:1.25rem] ${
          topStoriesVariant === 'editorial'
            ? 'bg-white/95 dark:bg-zinc-950/90'
            : 'bg-gradient-to-br from-orange-50 via-white to-zinc-100 dark:from-zinc-900 dark:via-zinc-950 dark:to-black'
        }`}
      >
        <div className="mb-[var(--ts-gap)] flex flex-wrap items-center justify-between gap-[var(--ts-toolbar-gap)] sm:gap-3">
          <div
            className={`cnp-pill px-3 py-1 text-[11px] max-[360px]:px-2 max-[360px]:py-0.5 max-[360px]:text-[10px] sm:text-xs ${
              topStoriesVariant === 'editorial'
                ? ''
                : 'border-orange-200 bg-white/80 dark:border-zinc-700 dark:bg-zinc-900'
            }`}
          >
            Top Stories
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-bold tracking-[0.06em] max-[360px]:px-2 max-[360px]:py-0.5 max-[360px]:text-[8px] sm:px-3 sm:py-1 sm:text-xs ${
              topStoriesVariant === 'editorial'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
            }`}
          >
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-white/95 animate-pulse" />
            LIVE UPDATES
          </span>
        </div>

        <div className="grid grid-cols-1 gap-[var(--ts-gap)] md:grid-cols-12 md:items-stretch md:[--tablet-top-h:460px] lg:[--tablet-top-h:500px] xl:gap-5 xl:[--spot-card-h:100px] xl:[--spot-gap:4px] xl:[--top-stories-h:calc(var(--spot-card-h)*4+var(--spot-gap)*3)]">
          <div className="md:col-span-8 md:h-[var(--tablet-top-h)] xl:col-span-8 xl:h-[var(--top-stories-h)]">
            <HeroCarousel articles={heroArticles} variant={topStoriesVariant} className="h-full" />
          </div>

          <div className="hidden md:col-span-4 md:grid md:h-[var(--tablet-top-h)] md:grid-rows-3 md:gap-3 xl:hidden">
            {spotlightTablet.map((article, index) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.06 }}
                className="h-full"
              >
                <Link
                  href={`/main/article/${encodeURIComponent(article.id)}`}
                  className="cnp-card cnp-card-hover group block h-full rounded-2xl bg-gradient-to-b from-white to-zinc-50 p-3 dark:from-zinc-900 dark:to-zinc-900/70"
                >
                  <div className="flex h-full items-center gap-2.5">
                    <div className="relative h-[74px] w-[112px] flex-none overflow-hidden rounded-xl">
                      <Image
                        src={buildArticleImageVariantUrl(article.image, 'thumb')}
                        alt={article.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 1023px) 112px, 112px"
                      />
                      <span className="absolute left-1.5 top-1.5 inline-flex max-w-[72px] items-center rounded-full bg-red-600/95 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-white shadow-sm">
                        <span className="truncate">{article.category}</span>
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="hi-heading line-clamp-2 text-[1rem] font-semibold leading-[1.34] text-zinc-900 transition-colors group-hover:text-red-600 dark:text-zinc-100 dark:group-hover:text-red-400">
                        {article.title}
                      </p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          <div className="hidden xl:col-span-4 xl:grid xl:h-[var(--top-stories-h)] xl:grid-rows-4 xl:gap-[var(--spot-gap)]">
            {spotlightDesktop.map((article, index) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: index * 0.07 }}
                className="h-full"
              >
                <Link
                  href={`/main/article/${encodeURIComponent(article.id)}`}
                  className="cnp-card cnp-card-hover group block h-full rounded-2xl bg-gradient-to-b from-white to-zinc-50 px-3 py-2 dark:from-zinc-900 dark:to-zinc-900/70"
                >
                  <div className="flex h-full items-center gap-3">
                    <div className="relative h-[72px] w-[108px] flex-none overflow-hidden rounded-lg">
                      <Image
                        src={buildArticleImageVariantUrl(article.image, 'thumb')}
                        alt={article.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="108px"
                      />
                      <span className="absolute left-1.5 top-1.5 inline-flex max-w-[80px] items-center rounded-full bg-red-600/95 px-2 py-0.5 text-[10px] font-semibold leading-none text-white shadow-sm">
                        <span className="truncate">{article.category}</span>
                      </span>
                    </div>
                    <div className="min-w-0 flex h-full flex-1 flex-col justify-center">
                      <p className="hi-heading line-clamp-2 pt-0.5 text-[1.01rem] font-semibold leading-[1.34] text-zinc-900 transition-colors group-hover:text-red-600 dark:text-zinc-100 dark:group-hover:text-red-400">
                        {article.title}
                      </p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

      </motion.section>

      <section className="relative mt-[var(--section-gap)] cnp-surface px-3 py-3 backdrop-blur-sm sm:px-4 sm:py-3.5 md:px-6 md:py-4 lg:py-[1.1rem] xl:py-[1.2rem]">
        <div className="mb-1.5 flex items-center justify-between gap-2 sm:mb-2 sm:gap-2.5 md:mb-2 md:gap-3">
          <h2 className="text-base font-black tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-[1.05rem] md:text-[1.25rem] lg:text-[1.35rem] xl:text-[1.4rem]">
            Mojo Stories
          </h2>
          <div className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400 sm:gap-1.5 sm:text-xs">
            <Flame className="h-4 w-4" />
            Swipe to Explore
          </div>
        </div>
        <StoriesRail stories={visualStories} showHeader={false} />
      </section>

      <div className="mt-[var(--section-gap)] grid grid-cols-1 items-start gap-3.5 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-8">
          <div className="mb-3 flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800 sm:mb-4 sm:pb-4">
            <h2 className="flex items-center gap-2 text-[1.05rem] font-black tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-2xl">
              <span className="h-5 w-1 rounded-full bg-orange-500 sm:h-6 sm:w-1.5"></span>
              Latest News
            </h2>
            <button className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-600 transition-colors hover:text-orange-500 sm:text-sm">
              View All <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2.5 sm:space-y-3">
            {latestNews.map((article, index) => (
              <NewsCard 
                key={article.id} 
                article={article} 
                variant="horizontal" 
                index={index}
              />
            ))}
          </div>

          <div className="flex justify-center pt-3.5 sm:pt-5">
            <button className="rounded-full border border-zinc-300 bg-white px-6 py-2 text-[13px] font-semibold text-zinc-900 transition-all hover:-translate-y-0.5 hover:border-orange-300 hover:bg-orange-50 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-orange-700 dark:hover:bg-zinc-800 sm:px-8 sm:py-3 sm:text-sm">
              Load More Stories
            </button>
          </div>
        </div>

        <aside className="space-y-3 lg:col-span-4 lg:sticky lg:top-24 lg:self-start lg:space-y-4">
          <div className="cnp-surface p-2.5 sm:p-4">
            <div className="mb-3.5 flex items-center gap-2">
              <TrendingUp className="h-[18px] w-[18px] text-orange-500" />
              <h3 className="text-[1.05rem] font-black text-zinc-900 dark:text-zinc-100 sm:text-lg">Trending Now</h3>
            </div>

            <div className="space-y-2.5">
              {featuredSidebar.map((article, index) => (
                <div key={article.id} className={index >= 2 ? 'hidden md:block' : ''}>
                  <NewsCard article={article} variant="compact" index={index} />
                </div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-red-300/50 bg-gradient-to-br from-red-500 via-red-600 to-red-700 p-4 text-white shadow-[var(--shadow-card)] sm:rounded-2xl sm:p-5">
            <div className="absolute -top-8 right-0 h-24 w-24 rounded-full bg-white/20 blur-2xl" />
            <div className="absolute -bottom-8 left-0 h-24 w-24 rounded-full bg-black/20 blur-2xl" />

            <div className="relative">
              <h3 className="mb-2 inline-flex items-center gap-2 text-lg font-black tracking-tight">
                <CalendarDays className="h-[18px] w-[18px]" />
                {language === 'hi' ? 'ई-पेपर' : 'E-Paper'}
              </h3>
              <p className="mb-4 text-xs leading-relaxed text-red-50/95 sm:text-sm">
                {language === 'hi'
                  ? 'आज का अखबार पढ़ें। इंदौर, उज्जैन, मुंबई और दिल्ली के संस्करण उपलब्ध।'
                  : 'Read today’s newspaper edition. Indore, Ujjain, Mumbai and Delhi editions available.'}
              </p>

              <Link
                href="/main/epaper"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white/95 px-3.5 py-2.5 text-xs font-bold text-red-700 transition-colors hover:bg-white sm:text-sm"
              >
                {language === 'hi' ? 'E-Paper देखें' : 'View E-Paper'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </aside>
      </div>
      <section className="relative mt-[var(--section-gap)] cnp-surface overflow-hidden px-3 py-4 sm:px-5 sm:py-5 md:px-6 md:py-6">
        <div className="pointer-events-none absolute -top-16 -right-8 h-32 w-32 rounded-full bg-orange-200/45 blur-3xl dark:bg-orange-900/20" />
        <div className="pointer-events-none absolute -bottom-16 -left-8 h-28 w-28 rounded-full bg-cyan-200/40 blur-3xl dark:bg-cyan-900/20" />

        <div className="relative">
          <button
            type="button"
            onClick={() => scrollCategoryStrip('prev')}
            aria-label="Scroll previous categories"
            className="absolute left-1 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-300/90 bg-white/95 text-zinc-700 shadow-sm transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:bg-zinc-800 md:inline-flex"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => scrollCategoryStrip('next')}
            aria-label="Scroll next categories"
            className="absolute right-1 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-300/90 bg-white/95 text-zinc-700 shadow-sm transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:bg-zinc-800 md:inline-flex"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div
            ref={categoryScrollerRef}
            className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-1.5 md:px-2"
          >
          {categoryPanels.map((panel) => {
            const categoryLabel = panel.category
              ? (language === 'hi' ? panel.category.name : panel.category.nameEn)
              : panel.slug;
            const cardStyle: CSSProperties = {
              borderColor: hexToRgba(panel.accent, 0.25),
              boxShadow: `0 10px 35px -28px ${hexToRgba(panel.accent, 0.65)}`,
            };
            const badgeStyle: CSSProperties = {
              backgroundColor: hexToRgba(panel.accent, 0.14),
              color: panel.accent,
            };
            const supportText =
              panel.lead?.summary?.trim() ||
              panel.rest[0]?.title ||
              (language === 'hi'
                ? '\u0905\u0927\u093f\u0915 \u0915\u0939\u093e\u0928\u093f\u092f\u093e\u0902 \u092a\u0922\u093c\u0947\u0902'
                : 'Read more stories in this category');
            const leadArticle = panel.lead || panel.rest[0] || null;
            const readHref = leadArticle
              ? `/main/article/${encodeURIComponent(leadArticle.id)}`
              : `/main/category/${panel.slug}`;

            return (
              <article
                key={panel.slug}
                style={cardStyle}
                className="group flex min-h-[312px] w-[82%] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border bg-zinc-100 transition-transform duration-300 hover:-translate-y-0.5 sm:min-h-[344px] sm:w-[60%] lg:w-[42%] xl:w-[28%] dark:bg-zinc-900"
              >
                {panel.lead ? (
                  <Link href={`/main/article/${encodeURIComponent(panel.lead.id)}`} className="block">
                    <div className="relative aspect-[16/10] overflow-hidden border-b border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800">
                      <Image
                        src={buildArticleImageVariantUrl(panel.lead.image, 'card')}
                        alt={panel.lead.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        sizes="(max-width: 639px) 100vw, (max-width: 1279px) 50vw, 33vw"
                      />
                      <span
                        style={badgeStyle}
                        className="absolute left-2.5 top-2.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide backdrop-blur-sm"
                      >
                        {categoryLabel}
                      </span>
                    </div>
                  </Link>
                ) : (
                  <div className="flex aspect-[16/10] items-center justify-center border-b border-dashed border-zinc-300 bg-zinc-100 text-xs font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 sm:text-sm">
                    {language === 'hi' ? '\u0905\u092d\u0940 \u0915\u094b\u0908 \u0939\u0947\u0921\u0932\u093e\u0907\u0928 \u0928\u0939\u0940\u0902' : 'No headline yet'}
                  </div>
                )}

                <div className="flex min-h-[146px] flex-1 flex-col bg-white/95 px-3 py-3 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 sm:min-h-[168px] sm:px-4 sm:py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-400">
                    {categoryLabel}
                  </p>
                  <p className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-[1.2rem] sm:text-sm sm:leading-5">
                    {panel.lead?.title || (language === 'hi' ? '\u0924\u093e\u091c\u093c\u093e \u0905\u092a\u0921\u0947\u091f' : 'Latest update')}
                  </p>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-[1.1rem] text-zinc-600 dark:text-zinc-300 sm:text-sm sm:leading-5">
                    {supportText}
                  </p>

                  <div className="mt-auto grid grid-cols-3 gap-1.5 pt-3">
                    <Link
                      href="/main/epaper"
                      className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-full border border-zinc-300 bg-zinc-100 px-2 text-[10px] font-semibold text-zinc-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 dark:border-zinc-700 dark:bg-zinc-900/65 dark:text-zinc-100 dark:hover:border-orange-500/50 dark:hover:bg-orange-900/20 dark:hover:text-orange-300 sm:h-9 sm:px-2.5 sm:text-[11px]"
                    >
                      <Newspaper className="h-3.5 w-3.5 text-orange-500 dark:text-orange-400" />
                      <span>{language === 'hi' ? 'ई-पेपर' : 'E-Paper'}</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => openArticleOnWhatsApp(leadArticle, readHref)}
                      className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-full border border-zinc-300 bg-zinc-100 px-2 text-[10px] font-semibold text-zinc-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-900/65 dark:text-zinc-100 dark:hover:border-emerald-500/50 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-300 sm:h-9 sm:px-2.5 sm:text-[11px]"
                    >
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                        <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 fill-current" aria-hidden="true">
                          <path d="M12 2a10 10 0 0 0-8.68 14.95L2 22l5.2-1.36A10 10 0 1 0 12 2Zm0 18.17a8.15 8.15 0 0 1-4.15-1.13l-.3-.18-3.09.8.82-3.01-.2-.31A8.18 8.18 0 1 1 12 20.17Zm4.48-5.86c-.24-.12-1.4-.7-1.62-.77-.22-.08-.38-.12-.54.12-.16.24-.62.77-.76.93-.14.16-.28.18-.52.06-.24-.12-1-.37-1.91-1.17-.7-.63-1.18-1.4-1.32-1.64-.14-.24-.02-.37.1-.49.1-.1.24-.26.36-.39.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.79-.2-.47-.4-.41-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.33.98 2.49c.12.16 1.7 2.61 4.11 3.66.58.25 1.03.4 1.38.52.58.18 1.1.16 1.52.1.46-.07 1.4-.57 1.6-1.12.2-.55.2-1.02.14-1.12-.06-.1-.22-.16-.46-.28Z" />
                        </svg>
                      </span>
                      <span className="whitespace-nowrap">WhatsApp</span>
                    </button>

                    <Link
                      href={readHref}
                      className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-full border border-zinc-300 bg-zinc-100 px-2 text-[10px] font-semibold text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-900/65 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/75 sm:h-9 sm:px-2.5 sm:text-[11px]"
                    >
                      <span>{language === 'hi' ? '\u092a\u0942\u0930\u0940 \u0916\u092c\u0930' : 'Read Story'}</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
          </div>
        </div>
      </section>
    </div>
  );
}


