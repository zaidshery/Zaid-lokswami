import type { Metadata } from 'next';
import { COMPANY_INFO } from '@/lib/constants/company';
import { EPAPER_CITY_OPTIONS } from '@/lib/constants/epaperCities';
import { resolveNewsCategory } from '@/lib/constants/newsCategories';

const FALLBACK_SITE_URL = 'http://localhost:3000';
const DEFAULT_OG_IMAGE = '/lokswami-share-preview.png';

type MetadataInput = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  image?: string;
  robots?: Metadata['robots'];
};

type EpaperMetadataInput = {
  city: string;
  publishDate: string;
};

function formatTitle(title: string) {
  return title.includes(COMPANY_INFO.name) ? title : `${title} | ${COMPANY_INFO.name}`;
}

export function normalizeSiteUrl(value: string) {
  return value.replace(/\/+$/, '');
}

export function resolveSiteUrl() {
  return normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_SITE_URL);
}

export function toAbsoluteUrl(input: string, siteUrl = resolveSiteUrl()) {
  if (!input) return '';
  if (/^https?:\/\//i.test(input)) return input;
  if (!input.startsWith('/')) return `${siteUrl}/${input}`;
  return `${siteUrl}${input}`;
}

function slugToTitle(slug: string) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function formatMetadataDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function buildMetadata(input: MetadataInput): Metadata {
  const siteUrl = resolveSiteUrl();
  const canonical = toAbsoluteUrl(input.path, siteUrl);
  const image = toAbsoluteUrl(input.image || DEFAULT_OG_IMAGE, siteUrl);
  const title = formatTitle(input.title);

  return {
    title,
    description: input.description,
    keywords: input.keywords,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description: input.description,
      url: canonical,
      type: 'website',
      siteName: COMPANY_INFO.name,
      locale: 'hi_IN',
      images: image
        ? [
            {
              url: image,
              width: 1200,
              height: 630,
              alt: title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: input.description,
      images: image ? [image] : undefined,
    },
    robots: input.robots || {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  };
}

export function buildLatestPageMetadata() {
  return buildMetadata({
    title: 'Latest Hindi News and Breaking Headlines',
    description:
      'Track the newest Hindi news updates, breaking headlines, and top stories from Lokswami across politics, regional, business, sports, and more.',
    path: '/main/latest',
    keywords: [
      'latest hindi news',
      'breaking headlines',
      'today news',
      'lokswami latest news',
      'india news updates',
    ],
  });
}

export function buildVideosPageMetadata() {
  return buildMetadata({
    title: 'Hindi News Videos and Shorts',
    description:
      'Watch Hindi news videos, explainers, interviews, and shorts from Lokswami covering the biggest stories of the day.',
    path: '/main/videos',
    keywords: [
      'hindi news videos',
      'news shorts',
      'lokswami videos',
      'breaking news video',
      'india video news',
    ],
  });
}

export function buildEpaperPageMetadata(input: EpaperMetadataInput) {
  const cityName =
    EPAPER_CITY_OPTIONS.find((item) => item.slug === input.city)?.name || '';
  const formattedDate = input.publishDate ? formatMetadataDate(input.publishDate) : '';
  const query = new URLSearchParams();

  if (input.city && input.city !== 'all') {
    query.set('city', input.city);
  }
  if (input.publishDate) {
    query.set('date', input.publishDate);
  }

  let title = 'E-Paper Archive and Digital Edition';
  let description =
    'Read the Lokswami e-paper online with archive filters, mapped stories, downloadable daily editions, and city-wise access.';

  if (cityName && formattedDate) {
    title = `${cityName} E-Paper for ${formattedDate}`;
    description = `Read the ${formattedDate} ${cityName} Lokswami e-paper edition online with archive access, mapped stories, and downloadable pages.`;
  } else if (cityName) {
    title = `${cityName} E-Paper Archive`;
    description = `Browse the Lokswami ${cityName} e-paper archive online with daily digital editions, mapped stories, and downloadable PDFs.`;
  } else if (formattedDate) {
    title = `E-Paper for ${formattedDate}`;
    description = `Read the Lokswami e-paper for ${formattedDate} online with digital archive access, mapped stories, and downloadable pages.`;
  }

  const path = query.size > 0 ? `/main/epaper?${query.toString()}` : '/main/epaper';

  return buildMetadata({
    title,
    description,
    path,
    keywords: [
      'lokswami epaper',
      'hindi epaper',
      'digital newspaper',
      'epaper archive',
      cityName ? `${cityName.toLowerCase()} epaper` : '',
    ].filter(Boolean),
  });
}

export function buildCategoryPageMetadata(slug: string) {
  const normalizedSlug = slug.trim().toLowerCase();
  const category = resolveNewsCategory(normalizedSlug);
  const displayName = category?.nameEn || slugToTitle(normalizedSlug) || 'News';

  return buildMetadata({
    title: `${displayName} News`,
    description: category
      ? `Read the latest ${category.nameEn.toLowerCase()} news, breaking updates, analysis, and top stories on Lokswami.`
      : `Read the latest news, headlines, and updates from ${displayName} on Lokswami.`,
    path: `/main/category/${encodeURIComponent(normalizedSlug)}`,
    keywords: [
      `${displayName.toLowerCase()} news`,
      'hindi news',
      'lokswami category news',
      normalizedSlug,
    ].filter(Boolean),
    robots: {
      index: Boolean(category),
      follow: true,
      'max-image-preview': 'large',
    },
  });
}
