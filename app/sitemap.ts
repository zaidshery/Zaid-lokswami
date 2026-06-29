import type { MetadataRoute } from 'next';
import { EPAPER_CITY_OPTIONS } from '@/lib/constants/epaperCities';
import { NEWS_CATEGORIES, getNewsCategoryHref } from '@/lib/constants/newsCategories';
import { listEPapersForSitemap } from '@/lib/content/publicSitemap';
import { getServerArticlePath, listArticlesForSitemap } from '@/lib/content/serverArticles';

export const revalidate = 86_400;

const FALLBACK_SITE_URL = 'http://localhost:3000';
const ARTICLE_SITEMAP_LIMIT = 5000;
const EPAPER_SITEMAP_LIMIT = 1000;

type StaticSitemapRoute = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
};

function getSiteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_SITE_URL;
  return raw.replace(/\/+$/, '');
}

function absoluteUrl(baseUrl: string, path: string) {
  if (!path.startsWith('/')) {
    return `${baseUrl}/${path}`;
  }
  return `${baseUrl}${path}`;
}

function buildEpaperIssuePath(input: { id: string; citySlug: string; publishDate: string }) {
  const params = new URLSearchParams({
    paper: input.id,
    city: input.citySlug,
    date: input.publishDate,
  });
  return `/main/epaper?${params.toString()}`;
}

function uniqueEntries(entries: MetadataRoute.Sitemap) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.url)) return false;
    seen.add(entry.url);
    return true;
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();

  const staticRoutes: StaticSitemapRoute[] = [
    { path: '/', changeFrequency: 'daily', priority: 0.7 },
    { path: '/main', changeFrequency: 'hourly', priority: 1 },
    { path: '/main/latest', changeFrequency: 'hourly', priority: 0.9 },
    { path: '/main/videos', changeFrequency: 'daily', priority: 0.8 },
    { path: '/main/stories', changeFrequency: 'daily', priority: 0.75 },
    { path: '/main/ftaftaf', changeFrequency: 'daily', priority: 0.7 },
    { path: '/main/epaper', changeFrequency: 'daily', priority: 0.85 },
    { path: '/main/e-magazine', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/main/elections', changeFrequency: 'daily', priority: 0.7 },
    { path: '/main/search', changeFrequency: 'weekly', priority: 0.45 },
    { path: '/main/digital-newsroom', changeFrequency: 'weekly', priority: 0.55 },
    { path: '/main/about', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/main/contact', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/main/advertise', changeFrequency: 'monthly', priority: 0.45 },
    { path: '/main/careers', changeFrequency: 'weekly', priority: 0.45 },
    { path: '/main/privacy', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/main/terms', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/main/cookies', changeFrequency: 'yearly', priority: 0.25 },
    { path: '/main/disclaimer', changeFrequency: 'yearly', priority: 0.25 },
    { path: '/main/sitemap', changeFrequency: 'weekly', priority: 0.4 },
  ];

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: absoluteUrl(siteUrl, route.path),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const categoryEntries: MetadataRoute.Sitemap = NEWS_CATEGORIES.map((category) => ({
    url: absoluteUrl(siteUrl, getNewsCategoryHref(category.slug)),
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.85,
  }));

  const epaperCityEntries: MetadataRoute.Sitemap = EPAPER_CITY_OPTIONS.map((city) => ({
    url: absoluteUrl(siteUrl, `/main/epaper?city=${encodeURIComponent(city.slug)}`),
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.65,
  }));

  const articles = await listArticlesForSitemap(ARTICLE_SITEMAP_LIMIT);
  const articleEntries: MetadataRoute.Sitemap = articles.map((article) => ({
    url: absoluteUrl(siteUrl, getServerArticlePath(article)),
    lastModified: new Date(article.updatedAt),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const epapers = await listEPapersForSitemap(EPAPER_SITEMAP_LIMIT);
  const epaperEntries: MetadataRoute.Sitemap = epapers.map((paper) => ({
    url: absoluteUrl(siteUrl, buildEpaperIssuePath(paper)),
    lastModified: new Date(paper.updatedAt),
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return uniqueEntries([
    ...staticEntries,
    ...categoryEntries,
    ...epaperCityEntries,
    ...articleEntries,
    ...epaperEntries,
  ]);
}

