import type { MetadataRoute } from 'next';
import { getServerArticlePath, listArticlesForSitemap } from '@/lib/content/serverArticles';

export const dynamic = 'force-dynamic';

const FALLBACK_SITE_URL = 'http://localhost:3000';

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();

  const staticRoutes = [
    '/',
    '/main',
    '/main/latest',
    '/main/videos',
    '/main/epaper',
    '/main/search',
    '/main/about',
    '/main/contact',
    '/main/advertise',
    '/main/careers',
  ];

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: absoluteUrl(siteUrl, route),
    lastModified: now,
    changeFrequency: route === '/main' ? 'hourly' : 'daily',
    priority: route === '/main' ? 1 : 0.7,
  }));

  const articles = await listArticlesForSitemap(500);
  const articleEntries: MetadataRoute.Sitemap = articles.map((article) => ({
    url: absoluteUrl(siteUrl, getServerArticlePath(article)),
    lastModified: new Date(article.updatedAt),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticEntries, ...articleEntries];
}

