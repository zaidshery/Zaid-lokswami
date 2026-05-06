import { NextResponse } from 'next/server';
import { getServerArticlePath, listNewsArticlesForSitemap } from '@/lib/content/serverArticles';
import { getSiteUrl } from '@/lib/seo/articleSeo';

export const dynamic = 'force-dynamic';

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function absoluteUrl(baseUrl: string, path: string) {
  return path.startsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`;
}

export async function GET() {
  const siteUrl = getSiteUrl();
  const articles = await listNewsArticlesForSitemap(1000);
  const urls = articles
    .map((article) => {
      const loc = absoluteUrl(siteUrl, getServerArticlePath(article));
      return [
        '  <url>',
        `    <loc>${escapeXml(loc)}</loc>`,
        '    <news:news>',
        '      <news:publication>',
        '        <news:name>Lokswami</news:name>',
        '        <news:language>hi</news:language>',
        '      </news:publication>',
        `      <news:publication_date>${escapeXml(article.publishedAt)}</news:publication_date>`,
        `      <news:title>${escapeXml(article.title)}</news:title>`,
        '    </news:news>',
        '  </url>',
      ].join('\n');
    })
    .join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
    urls,
    '</urlset>',
  ]
    .filter(Boolean)
    .join('\n');

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
