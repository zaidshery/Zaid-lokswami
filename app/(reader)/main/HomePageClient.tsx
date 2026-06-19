'use client';

import dynamic from 'next/dynamic';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  TrendingUp,
  ArrowRight,
  Flame,
} from 'lucide-react';
import HeroCarousel from '@/components/ui/HeroCarousel';
import NewsCard from '@/components/ui/NewsCard';
import ReaderImage from '@/components/ui/ReaderImage';
import { articles as mockArticles, type Article } from '@/lib/mock/data';
import { categoryMatches, fetchMergedLiveArticles } from '@/lib/content/liveArticles';
import {
  buildVisualStoriesFromArticles,
  type VisualStory,
} from '@/lib/content/visualStories';
import { fetchLiveStories } from '@/lib/content/liveStories';
import {
  fetchHomeFeedForHomePage,
  type HomePageEpaperPreview,
  type HomePageFeedState,
} from '@/lib/content/homeFeed';
import {
  fetchPublicArticlesPage,
  mapPublicArticlesToUiArticles,
} from '@/lib/content/publicArticles';
import {
  getNewsCategoryHref,
  NEWS_CATEGORY_DEFINITIONS,
  type NewsCategory,
  resolveNewsCategory,
} from '@/lib/constants/newsCategories';
import { useAppStore } from '@/lib/store/appStore';
import {
  buildArticleImageVariantUrl,
} from '@/lib/utils/articleMedia';
import { buildArticlePublicPath } from '@/lib/seo/articleSeo';
import { formatUiDate } from '@/lib/utils/dateFormat';

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

function formatDesktopHeroDate(value: string | undefined, language: 'en' | 'hi') {
  if (!value) return '';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return formatUiDate(value, value);
  }

  return new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getPublishedTimestamp(article: Article) {
  const parsed = new Date(article.publishedAt).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

const HOME_LATEST_INITIAL_COUNT = 6;
const HOME_LATEST_PAGE_STEP = 6;
const CATEGORY_INITIAL_STORIES_COUNT = 4;
const CATEGORY_STORIES_PAGE_STEP = 4;
const CATEGORY_FETCH_LIMIT = 12;
const CATEGORY_VIEWPORT_ROOT_MARGIN = '700px 0px';
const HI_EPAPER_CITY_LABELS: Record<string, string> = {
  indore: '\u0907\u0902\u0926\u094c\u0930',
  ujjain: '\u0909\u091c\u094d\u091c\u0948\u0928',
  mumbai: '\u092e\u0941\u0902\u092c\u0908',
  delhi: '\u0926\u093f\u0932\u094d\u0932\u0940',
};

type HomeEpaperResponse = {
  items?: HomePageEpaperPreview[];
};

type HomePageProps = {
  initialHomeFeed?: HomePageFeedState | null;
};

type CategorySectionViewModel = {
  slug: string;
  category: NewsCategory | undefined;
  items: Article[];
  accent: string;
};

const StoriesRail = dynamic(() => import('@/components/ui/StoriesRail'), {
  ssr: false,
  loading: StoriesRailFallback,
});

const DesktopHeroEpaperCard = dynamic(
  () => import('@/components/ui/DesktopHeroEpaperCard'),
  {
    ssr: false,
    loading: DesktopHeroEpaperCardFallback,
  }
);

const NewsPoll = dynamic(() => import('@/components/ui/NewsPoll'), {
  ssr: false,
  loading: NewsPollFallback,
});

function StoriesRailFallback() {
  return (
    <div className="flex gap-3 overflow-hidden py-1 sm:gap-4 sm:py-1.5">
      {[0, 1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="h-[10.7rem] w-24 shrink-0 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800 md:w-28"
        />
      ))}
    </div>
  );
}

function DesktopHeroEpaperCardFallback() {
  return (
    <div className="h-full animate-pulse rounded-[1.6rem] border border-zinc-200/90 bg-zinc-100 dark:border-white/10 dark:bg-zinc-900">
      <div className="grid h-full grid-cols-[150px_minmax(0,1fr)] items-center gap-3 px-3.5 py-2">
        <div className="mx-auto aspect-[3/4] w-[136px] rounded-[1.35rem] bg-zinc-200 dark:bg-zinc-800" />
        <div className="space-y-3">
          <div className="h-5 w-24 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-5 w-11/12 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-8/12 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-7 w-32 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}

function NewsPollFallback() {
  return (
    <div className="cnp-surface overflow-hidden p-4">
      <div className="animate-pulse space-y-3">
        <div className="h-5 w-24 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-6 w-4/5 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-12 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
        ))}
      </div>
    </div>
  );
}

function TopSideStoriesFallback({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="h-full animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex h-full items-center gap-3 p-3">
            <div className="h-[72px] w-[108px] flex-none rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-11/12 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-7/12 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

function CategoryStoriesSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {[0, 1].map((item) => (
        <div
          key={item}
          className="min-h-24 animate-pulse rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="space-y-2 p-4">
            <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-11/12 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-8/12 rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

function useNearViewport() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);

  useEffect(() => {
    if (isNearViewport) return;

    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      setIsNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: CATEGORY_VIEWPORT_ROOT_MARGIN, threshold: 0.01 }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [isNearViewport]);

  return { ref, isNearViewport };
}

type LazyCategorySectionProps = {
  section: CategorySectionViewModel;
  language: 'en' | 'hi';
  visibleCount: number;
  onVisible: (slug: string) => void;
  onShowMore: (slug: string, totalItems: number) => void;
};

function LazyCategorySection({
  section,
  language,
  visibleCount,
  onVisible,
  onShowMore,
}: LazyCategorySectionProps) {
  const { ref, isNearViewport } = useNearViewport();
  const categoryLabel = section.category
    ? language === 'hi'
      ? section.category.name
      : section.category.nameEn
    : section.slug;
  const visibleArticles = isNearViewport
    ? section.items.slice(0, visibleCount)
    : [];
  const hasMoreStories = isNearViewport && visibleCount < section.items.length;
  const categoryHref = getNewsCategoryHref(section.slug);
  const headerStyle: CSSProperties = {
    borderColor: hexToRgba(section.accent, 0.28),
    boxShadow: `0 18px 55px -44px ${hexToRgba(section.accent, 0.75)}`,
  };
  const accentStyle: CSSProperties = {
    backgroundColor: section.accent,
  };

  useEffect(() => {
    if (isNearViewport) {
      onVisible(section.slug);
    }
  }, [isNearViewport, onVisible, section.slug]);

  return (
    <div
      ref={ref}
      style={headerStyle}
      className="cnp-surface overflow-hidden border px-3 py-4 sm:px-5 sm:py-5 md:px-6"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800 sm:mb-4 sm:pb-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[1.05rem] font-black tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-2xl">
            <span style={accentStyle} className="h-5 w-1 rounded-full sm:h-6 sm:w-1.5" />
            <span className="truncate">{categoryLabel}</span>
          </h2>
          <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 sm:text-sm">
            {language === 'hi'
              ? '\u0938\u092c\u0938\u0947 \u0928\u0908 \u092a\u094d\u0930\u0915\u093e\u0936\u093f\u0924 \u0916\u092c\u0930\u0947\u0902'
              : 'Top latest published stories'}
          </p>
        </div>
        <Link
          href={categoryHref}
          className="reader-touch-link reader-focus-ring inline-flex min-h-10 items-center gap-1 rounded-full border border-zinc-300 bg-white px-3 py-2 text-[11px] font-semibold text-zinc-800 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-orange-700 dark:hover:bg-zinc-800 sm:text-sm"
        >
          {language === 'hi' ? '\u0936\u094d\u0930\u0947\u0923\u0940 \u0926\u0947\u0916\u0947\u0902' : 'View Category'}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {!isNearViewport ? (
        <CategoryStoriesSkeleton />
      ) : visibleArticles.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {visibleArticles.map((article, index) => (
            <NewsCard key={article.id} article={article} size="sm" index={index} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400">
          {language === 'hi'
            ? '\u0907\u0938 \u0936\u094d\u0930\u0947\u0923\u0940 \u092e\u0947\u0902 \u0905\u092d\u0940 \u0915\u094b\u0908 \u0924\u093e\u091c\u093c\u093e \u0916\u092c\u0930 \u0928\u0939\u0940\u0902 \u0939\u0948.'
            : 'No latest stories are published in this category yet.'}
        </div>
      )}

      {hasMoreStories ? (
        <div className="flex justify-center pt-4 sm:pt-5">
          <button
            type="button"
            onClick={() => onShowMore(section.slug, section.items.length)}
            className="reader-touch-button reader-focus-ring min-h-12 w-full rounded-full border border-zinc-300 bg-white px-6 py-3 text-[13px] font-semibold text-zinc-900 transition-all hover:-translate-y-0.5 hover:border-orange-300 hover:bg-orange-50 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-orange-700 dark:hover:bg-zinc-800 sm:w-auto sm:px-8 sm:text-sm"
          >
            Load more Stories
          </button>
        </div>
      ) : null}
    </div>
  );
}

async function fetchLatestEpaperPreview(): Promise<HomePageEpaperPreview | null> {
  try {
    const response = await fetch('/api/v1/public/epapers/latest?limit=1');
    const payload = (await response.json().catch(() => ({}))) as HomeEpaperResponse;
    if (!response.ok) return null;

    const first = Array.isArray(payload.items) ? payload.items[0] : null;
    if (!first) return null;

    return {
      _id: String(first._id || ''),
      citySlug: String(first.citySlug || ''),
      cityName: String(first.cityName || ''),
      title: String(first.title || ''),
      publishDate: String(first.publishDate || ''),
      thumbnailPath: String(first.thumbnailPath || ''),
      pageCount: Number(first.pageCount || 0),
    };
  } catch {
    return null;
  }
}

export default function HomePage({ initialHomeFeed = null }: HomePageProps) {
  const { language } = useAppStore();
  const topStoriesVariant: 'editorial' | 'modern' = 'editorial';
  const [isClientReady, setIsClientReady] = useState(false);
  const [feedArticles, setFeedArticles] = useState<Article[]>(
    () => initialHomeFeed?.articles.length ? initialHomeFeed.articles : mockArticles
  );
  const [cmsStories, setCmsStories] = useState<VisualStory[]>(
    () => initialHomeFeed?.stories || []
  );
  const [latestEpaper, setLatestEpaper] = useState<HomePageEpaperPreview | null>(
    () => initialHomeFeed?.epaper || null
  );
  const hasInitialArticles = Boolean(initialHomeFeed?.articles.length);
  const hasInitialStories = Boolean(initialHomeFeed?.stories.length);
  const hasInitialEpaper = Boolean(initialHomeFeed?.epaper);
  const [visibleLatestNewsCount, setVisibleLatestNewsCount] = useState(
    HOME_LATEST_INITIAL_COUNT
  );
  const [visibleCategoryStoryCounts, setVisibleCategoryStoryCounts] = useState<Record<string, number>>({});
  const [categoryArticlesBySlug, setCategoryArticlesBySlug] = useState<Record<string, Article[]>>({});
  const requestedCategorySlugsRef = useRef<Set<string>>(new Set());
  const categoryRequestGenerationRef = useRef(0);
  const heroArticles = feedArticles.slice(0, 5);
  const trendingArticles = feedArticles.filter((article) => article.isTrending);
  const spotlightTablet = (trendingArticles.length ? trendingArticles : feedArticles).slice(0, 3);
  const latestNews = feedArticles.slice(5);
  const visibleLatestNews = latestNews.slice(0, visibleLatestNewsCount);
  const hasMoreLatestNews = visibleLatestNewsCount < latestNews.length;
  const featuredSidebar: Article[] = (trendingArticles.length ? trendingArticles : feedArticles).slice(0, 3);
  const desktopHeroSidebarStories: Article[] = (trendingArticles.length ? trendingArticles : feedArticles).slice(0, 2);
  const latestPublishedArticles = useMemo(
    () =>
      [...feedArticles].sort(
        (a, b) => getPublishedTimestamp(b) - getPublishedTimestamp(a)
      ),
    [feedArticles]
  );
  const visualStories = useMemo(
    () =>
      cmsStories.length
        ? cmsStories.slice(0, 10)
        : buildVisualStoriesFromArticles(feedArticles, 10),
    [cmsStories, feedArticles]
  );
  const categorySections = useMemo(() => {
    return NEWS_CATEGORY_DEFINITIONS.map((definition) => {
      const slug = definition.slug;
      const category = resolveNewsCategory(slug);
      const fetchedItems = categoryArticlesBySlug[slug] || [];
      const feedItems = latestPublishedArticles
        .filter((article) => categoryMatches(article.category, slug, NEWS_CATEGORY_DEFINITIONS));
      const items = (fetchedItems.length ? fetchedItems : feedItems).slice(0, CATEGORY_FETCH_LIMIT);

      return {
        slug,
        category,
        items,
        accent: category?.color || '#F97316',
      };
    });
  }, [categoryArticlesBySlug, latestPublishedArticles]);

  useEffect(() => {
    setIsClientReady(true);
  }, []);

  const loadCategoryStories = useCallback((slug: string) => {
    if (requestedCategorySlugsRef.current.has(slug)) return;
    requestedCategorySlugsRef.current.add(slug);
    const generation = categoryRequestGenerationRef.current;

    void (async () => {
      const page = await fetchPublicArticlesPage({
        category: slug,
        limit: CATEGORY_FETCH_LIMIT,
      });
      const articles = page
        ? mapPublicArticlesToUiArticles(page.items).sort(
            (a, b) => getPublishedTimestamp(b) - getPublishedTimestamp(a)
          )
        : [];

      if (generation !== categoryRequestGenerationRef.current) return;

      setCategoryArticlesBySlug((current) => ({
        ...current,
        [slug]: articles,
      }));
    })();
  }, []);

  const showMoreCategoryStories = useCallback((slug: string, totalItems: number) => {
    setVisibleCategoryStoryCounts((current) => {
      const visibleCount = current[slug] || CATEGORY_INITIAL_STORIES_COUNT;

      return {
        ...current,
        [slug]: Math.min(visibleCount + CATEGORY_STORIES_PAGE_STEP, totalItems),
      };
    });
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      let hasArticles = hasInitialArticles;
      let hasStories = hasInitialStories;
      let hasEpaper = hasInitialEpaper;

      if (!hasArticles || !hasStories || !hasEpaper) {
        const homeFeed = await fetchHomeFeedForHomePage();

        if (active && homeFeed) {
          if (!hasArticles && homeFeed.articles.length) {
            setFeedArticles(homeFeed.articles);
            hasArticles = true;
          }
          if (!hasStories && homeFeed.stories.length) {
            setCmsStories(homeFeed.stories);
            hasStories = true;
          }
          if (!hasEpaper && homeFeed.epaper) {
            setLatestEpaper(homeFeed.epaper);
            hasEpaper = true;
          }
        }
      }

      const [fallbackArticles, fallbackStories, fallbackEpaper] = await Promise.all([
        hasArticles ? Promise.resolve(null) : fetchMergedLiveArticles(100),
        hasStories ? Promise.resolve(null) : fetchLiveStories(20),
        hasEpaper ? Promise.resolve(null) : fetchLatestEpaperPreview(),
      ]);

      if (!active) return;

      if (fallbackArticles?.length) {
        setFeedArticles(fallbackArticles);
      }
      if (fallbackStories?.length) {
        setCmsStories(fallbackStories);
      }
      if (fallbackEpaper) {
        setLatestEpaper(fallbackEpaper);
      }
    };

    if (!hasInitialArticles || !hasInitialStories || !hasInitialEpaper) {
      void load();
    }

    return () => {
      active = false;
    };
  }, [hasInitialArticles, hasInitialStories, hasInitialEpaper]);

  useEffect(() => {
    setVisibleLatestNewsCount(HOME_LATEST_INITIAL_COUNT);
  }, [feedArticles.length]);

  useEffect(() => {
    setVisibleCategoryStoryCounts({});
    setCategoryArticlesBySlug({});
    requestedCategorySlugsRef.current.clear();
    categoryRequestGenerationRef.current += 1;
  }, [feedArticles]);

  const epaperHref = (() => {
    if (!latestEpaper) return '/main/epaper';
    const query = new URLSearchParams();
    if (latestEpaper.citySlug) {
      query.set('city', latestEpaper.citySlug);
    }
    if (latestEpaper.publishDate) {
      query.set('date', latestEpaper.publishDate);
    }
    const search = query.toString();
    return search ? `/main/epaper?${search}` : '/main/epaper';
  })();
  const epaperCity = latestEpaper?.cityName.trim()
    ? latestEpaper.cityName
    : language === 'hi'
      ? '\u0921\u093f\u091c\u093f\u091f\u0932 \u090f\u0921\u093f\u0936\u0928'
      : 'Digital edition';
  const localizedEpaperCity =
    language === 'hi' && latestEpaper?.citySlug
      ? HI_EPAPER_CITY_LABELS[latestEpaper.citySlug] || epaperCity
      : epaperCity;
  const desktopHeroEpaperDateLabel = formatDesktopHeroDate(latestEpaper?.publishDate, language);
  const isDesktopHeroEpaperToday = Boolean(
    latestEpaper?.publishDate && latestEpaper.publishDate === getLocalDateKey()
  );
  const epaperThumbnail = latestEpaper?.thumbnailPath || '/placeholders/epaper-3x4.svg';
  const epaperThumbnailAlt =
    language === 'hi'
      ? `${localizedEpaperCity} \u0908-\u092a\u0947\u092a\u0930 \u0915\u0935\u0930`
      : `${epaperCity} e-paper cover`;
  const epaperEditionLabel =
    language === 'hi'
      ? latestEpaper?.cityName.trim()
        ? `${localizedEpaperCity} \u0938\u0902\u0938\u094d\u0915\u0930\u0923`
        : '\u0906\u091c \u0915\u093e \u0921\u093f\u091c\u093f\u091f\u0932 \u0938\u0902\u0938\u094d\u0915\u0930\u0923'
      : latestEpaper?.cityName.trim()
        ? `${epaperCity} Edition`
        : "Today's digital edition";
  const desktopHeroEpaperTitle =
    language === 'hi'
      ? '\u0932\u094b\u0915\u0938\u094d\u0935\u093e\u092e\u0940'
      : 'Lokswami';
  const desktopHeroEpaperEyebrow =
    language === 'hi'
      ? isDesktopHeroEpaperToday
        ? '\u0906\u091c \u0915\u093e \u0908-\u092a\u0947\u092a\u0930'
        : '\u0924\u093e\u091c\u093c\u093e \u0908-\u092a\u0947\u092a\u0930'
      : isDesktopHeroEpaperToday
        ? "Today's E-Paper"
        : 'Latest E-Paper';
  const desktopHeroEpaperEdition =
    language === 'hi' ? `${localizedEpaperCity} \u090f\u0921\u093f\u0936\u0928` : epaperEditionLabel;
  const desktopHeroEpaperSupport =
    language === 'hi'
      ? isDesktopHeroEpaperToday
        ? '\u0924\u093e\u091c\u093c\u093e \u0916\u092c\u0930\u0947\u0902, \u092a\u0942\u0930\u093e \u0921\u093f\u091c\u093f\u091f\u0932 \u0938\u0902\u0938\u094d\u0915\u0930\u0923'
        : '\u0909\u092a\u0932\u092c\u094d\u0927 \u0938\u092c\u0938\u0947 \u0928\u0908 \u0921\u093f\u091c\u093f\u091f\u0932 \u090f\u0921\u093f\u0936\u0928'
      : isDesktopHeroEpaperToday
        ? 'Fresh news, full digital edition'
        : 'Latest available digital edition';
  const desktopHeroEpaperCta =
    language === 'hi' ? '\u0905\u092d\u0940 \u092a\u0922\u093c\u0947\u0902' : 'Read Now';
  const desktopHeroEpaperAriaLabel =
    language === 'hi' ? '\u0905\u092d\u0940 \u0908-\u092a\u0947\u092a\u0930 \u092a\u0922\u093c\u0947\u0902' : "Read today's e-paper";

  return (
    <div className="relative pb-3 [--section-gap:1rem] sm:[--section-gap:1.25rem] lg:[--section-gap:1.5rem]">
      <div className="pointer-events-none absolute -top-16 right-0 h-60 w-60 rounded-full bg-orange-200/45 blur-3xl dark:bg-orange-900/20" />
      <div className="pointer-events-none absolute top-[26rem] -left-16 h-64 w-64 rounded-full bg-cyan-200/35 blur-3xl dark:bg-cyan-900/20" />

      <section
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
            {isClientReady ? (
              spotlightTablet.map((article, index) => (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.06 }}
                  className="h-full"
                >
                  <Link
                    href={buildArticlePublicPath({ id: article.id, slug: article.slug })}
                    className="cnp-card cnp-card-hover group block h-full rounded-2xl bg-gradient-to-b from-white to-zinc-50 p-3 dark:from-zinc-900 dark:to-zinc-900/70"
                  >
                    <div className="flex h-full items-center gap-2.5">
                      <div className="relative h-[74px] w-[112px] flex-none overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-950">
                        <ReaderImage
                          src={buildArticleImageVariantUrl(article.image, 'thumb')}
                          alt={article.title}
                          fill
                          className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
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
              ))
            ) : (
              <TopSideStoriesFallback count={3} />
            )}
          </div>

          <div className="hidden xl:col-span-4 xl:grid xl:h-[var(--top-stories-h)] xl:grid-rows-[minmax(0,1.55fr)_repeat(2,minmax(0,0.725fr))] xl:gap-3">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35 }}
              className="h-full"
            >
              <DesktopHeroEpaperCard
                href={epaperHref}
                dateLabel={desktopHeroEpaperDateLabel}
                thumbnailSrc={epaperThumbnail}
                thumbnailAlt={epaperThumbnailAlt}
                eyebrowLabel={desktopHeroEpaperEyebrow}
                title={desktopHeroEpaperTitle}
                editionLabel={desktopHeroEpaperEdition}
                supportLabel={desktopHeroEpaperSupport}
                ctaLabel={desktopHeroEpaperCta}
                ariaLabel={desktopHeroEpaperAriaLabel}
              />
            </motion.div>

            {isClientReady ? (
              desktopHeroSidebarStories.map((article, index) => (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: 0.08 + index * 0.07 }}
                  className="h-full"
                >
                  <Link
                    href={buildArticlePublicPath({ id: article.id, slug: article.slug })}
                    className="cnp-card cnp-card-hover group block h-full rounded-2xl bg-gradient-to-b from-white to-zinc-50 px-3 py-2 dark:from-zinc-900 dark:to-zinc-900/70"
                  >
                    <div className="flex h-full items-center gap-3">
                      <div className="relative h-[72px] w-[108px] flex-none overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-950">
                        <ReaderImage
                          src={buildArticleImageVariantUrl(article.image, 'thumb')}
                          alt={article.title}
                          fill
                          className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
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
              ))
            ) : (
              <TopSideStoriesFallback count={2} />
            )}
          </div>
        </div>

      </section>

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
            <Link
              href="/main/latest"
              className="reader-touch-link reader-focus-ring inline-flex min-h-10 items-center gap-1 rounded-full px-2 text-[11px] font-semibold text-orange-600 transition-colors hover:text-orange-500 sm:text-sm"
            >
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-2.5 sm:space-y-3">
            {visibleLatestNews.map((article, index) => (
              <NewsCard 
                key={article.id} 
                article={article} 
                variant="horizontal" 
                index={index}
              />
            ))}
          </div>

          {hasMoreLatestNews ? (
            <div className="flex justify-center pt-3.5 sm:pt-5">
              <button
                type="button"
                onClick={() =>
                  setVisibleLatestNewsCount((current) =>
                    Math.min(current + HOME_LATEST_PAGE_STEP, latestNews.length)
                  )
                }
                className="reader-touch-button reader-focus-ring min-h-12 w-full rounded-full border border-zinc-300 bg-white px-6 py-3 text-[13px] font-semibold text-zinc-900 transition-all hover:-translate-y-0.5 hover:border-orange-300 hover:bg-orange-50 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-orange-700 dark:hover:bg-zinc-800 sm:w-auto sm:px-8 sm:text-sm"
              >
                Load More Stories
              </button>
            </div>
          ) : null}
        </div>

        <aside className="space-y-3 lg:col-span-4 lg:sticky lg:top-24 lg:self-start lg:space-y-4">
          <div className="cnp-surface p-2.5 sm:p-4">
            <div className="mb-3.5 flex items-center gap-2">
              <TrendingUp className="h-[18px] w-[18px] text-orange-500" />
              <h3 className="text-[1.05rem] font-black text-zinc-900 dark:text-zinc-100 sm:text-lg">Trending Now</h3>
            </div>

            <div className="space-y-2.5">
              {featuredSidebar.map((article, index) => (
                <div key={article.id}>
                  <NewsCard article={article} variant="compact" index={index} />
                </div>
              ))}
            </div>
          </div>

          <NewsPoll />
        </aside>
      </div>
      {categorySections.length ? (
        <section className="relative mt-[var(--section-gap)] space-y-4 sm:space-y-5">
          {categorySections.map((section) => (
            <LazyCategorySection
              key={section.slug}
              section={section}
              language={language}
              visibleCount={
                visibleCategoryStoryCounts[section.slug] || CATEGORY_INITIAL_STORIES_COUNT
              }
              onVisible={loadCategoryStories}
              onShowMore={showMoreCategoryStories}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}



