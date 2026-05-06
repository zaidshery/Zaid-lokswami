import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import { isPubliclyPublishedArticle } from '@/lib/content/articlePublication';
import Article from '@/lib/models/Article';
import type { ArticleSeo, StoredArticle } from '@/lib/storage/articlesFile';
import {
  getStoredArticleById,
  getStoredArticleByIdOrSlug,
  listAllStoredArticles,
} from '@/lib/storage/articlesFile';
import {
  buildArticlePublicPath,
  normalizeArticleSeo,
  normalizeArticleSlug,
} from '@/lib/seo/articleSeo';

export type ServerArticle = {
  id: string;
  slug: string;
  previousSlugs: string[];
  title: string;
  summary: string;
  image: string;
  category: string;
  author: string;
  publishedAt: string;
  updatedAt: string;
  seo: ArticleSeo;
};

export type ServerArticleSitemapItem = {
  id: string;
  slug: string;
  updatedAt: string;
};

export type ServerNewsArticleSitemapItem = ServerArticleSitemapItem & {
  title: string;
  publishedAt: string;
  includeInNewsSitemap: boolean;
};

const USE_REMOTE_DEMO_MEDIA =
  process.env.NEXT_PUBLIC_USE_REMOTE_DEMO_MEDIA === 'true';
const UNSPLASH_IMAGE_HOST = /^https:\/\/images\.unsplash\.com\//i;
const LOCAL_NEWS_FALLBACK_IMAGE = '/placeholders/news-16x9.svg';

function normalizeMediaUrl(value: string, fallback = LOCAL_NEWS_FALLBACK_IMAGE) {
  const media = value.trim();
  if (!media) return fallback;
  if (!USE_REMOTE_DEMO_MEDIA && UNSPLASH_IMAGE_HOST.test(media)) {
    return fallback;
  }
  return media;
}

function normalizeSeo(input: unknown): ArticleSeo {
  const seo = normalizeArticleSeo(input);
  return {
    ...seo,
    ogImage: normalizeMediaUrl(seo.ogImage, ''),
  };
}

function stringifyId(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && 'toString' in value) {
    return String(value).trim();
  }
  return '';
}

function stringifyField(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function normalizeFromUnknown(input: unknown): ServerArticle | null {
  const source = typeof input === 'object' && input ? (input as Record<string, unknown>) : null;
  if (!source) return null;

  const title = stringifyField(source.title);
  const summary = stringifyField(source.summary);
  const image = normalizeMediaUrl(
    typeof source.image === 'string' ? source.image : ''
  );
  const category = stringifyField(source.category);
  const author = stringifyField(source.author);
  if (!title || !summary || !image || !category || !author) return null;
  const id = stringifyId(source._id) || stringifyId(source.id);
  const slug = normalizeArticleSlug(stringifyField(source.slug));
  const previousSlugs = Array.isArray(source.previousSlugs)
    ? source.previousSlugs
        .map((item) => normalizeArticleSlug(String(item || '')))
        .filter(Boolean)
    : [];

  const publishedAtSource = source.publishedAt;
  const updatedAtSource = source.updatedAt;
  const publishedAtValue = new Date(
    typeof publishedAtSource === 'string' || typeof publishedAtSource === 'number'
      ? publishedAtSource
      : Date.now()
  );
  const updatedAtValue = new Date(
    typeof updatedAtSource === 'string' || typeof updatedAtSource === 'number'
      ? updatedAtSource
      : Date.now()
  );
  const publishedAt = Number.isNaN(publishedAtValue.getTime())
    ? new Date().toISOString()
    : publishedAtValue.toISOString();
  const updatedAt = Number.isNaN(updatedAtValue.getTime())
    ? publishedAt
    : updatedAtValue.toISOString();

  return {
    id,
    slug,
    previousSlugs,
    title,
    summary,
    image,
    category,
    author,
    publishedAt,
    updatedAt,
    seo: normalizeSeo(source.seo),
  };
}

function normalizeFromStored(article: StoredArticle): ServerArticle {
  return {
    id: article._id,
    slug: article.slug,
    previousSlugs: article.previousSlugs,
    title: article.title,
    summary: article.summary,
    image: normalizeMediaUrl(article.image),
    category: article.category,
    author: article.author,
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
    seo: {
      ...article.seo,
      ogImage: normalizeMediaUrl(article.seo.ogImage, ''),
    },
  };
}

export async function getArticleForMetadata(id: string) {
  const token = id.trim();
  const slug = normalizeArticleSlug(token);
  if (process.env.MONGODB_URI) {
    try {
      await connectDB();
      const article = Types.ObjectId.isValid(token)
        ? await Article.findById(token).lean()
        : slug
          ? await Article.findOne({
              $or: [{ slug }, { previousSlugs: slug }],
            }).lean()
          : null;
      if (article && isPubliclyPublishedArticle(article)) {
        const normalized = normalizeFromUnknown(article);
        if (normalized) return normalized;
      }
    } catch (error) {
      console.error('Failed to load article metadata from MongoDB, falling back.', error);
    }
  }

  const fileArticle = await getStoredArticleByIdOrSlug(token) || await getStoredArticleById(token);
  if (!fileArticle || !isPubliclyPublishedArticle(fileArticle)) return null;
  return normalizeFromStored(fileArticle);
}

function toSitemapItem(input: unknown): ServerArticleSitemapItem | null {
  const source = typeof input === 'object' && input ? (input as Record<string, unknown>) : null;
  if (!source) return null;

  const id =
    typeof source._id === 'string'
      ? source._id
      : typeof source.id === 'string'
        ? source.id
        : '';
  if (!id) return null;
  const slug = normalizeArticleSlug(stringifyField(source.slug));

  const updatedAtRaw = source.updatedAt;
  const updatedAtValue = new Date(
    typeof updatedAtRaw === 'string' || typeof updatedAtRaw === 'number'
      ? updatedAtRaw
      : Date.now()
  );
  const updatedAt = Number.isNaN(updatedAtValue.getTime())
    ? new Date().toISOString()
    : updatedAtValue.toISOString();

  return { id, slug, updatedAt };
}

export async function listArticlesForSitemap(limit = 500) {
  if (process.env.MONGODB_URI) {
    try {
      await connectDB();
      const records = await Article.find({})
        .select('_id slug updatedAt publishedAt workflow')
        .sort({ updatedAt: -1 })
        .lean();

      const normalized = records
        .filter((item) => isPubliclyPublishedArticle(item))
        .map((item) => toSitemapItem(item))
        .filter((item): item is ServerArticleSitemapItem => Boolean(item))
        .slice(0, limit);
      if (normalized.length) return normalized;
    } catch (error) {
      console.error('Failed to load sitemap articles from MongoDB, falling back.', error);
    }
  }

  const fallback = await listAllStoredArticles();
  return fallback
    .filter((item) => isPubliclyPublishedArticle(item))
    .map((item) => toSitemapItem(item))
    .filter((item): item is ServerArticleSitemapItem => Boolean(item))
    .slice(0, limit);
}

function toNewsSitemapItem(input: unknown): ServerNewsArticleSitemapItem | null {
  const source = typeof input === 'object' && input ? (input as Record<string, unknown>) : null;
  if (!source || !isPubliclyPublishedArticle(source)) return null;

  const sitemap = toSitemapItem(source);
  if (!sitemap) return null;
  const title = stringifyField(source.title);
  const seo = normalizeSeo(source.seo);
  const publishedAtRaw = source.publishedAt;
  const publishedAtValue = new Date(
    typeof publishedAtRaw === 'string' ||
      typeof publishedAtRaw === 'number' ||
      publishedAtRaw instanceof Date
      ? publishedAtRaw
      : Date.now()
  );
  const publishedAt = Number.isNaN(publishedAtValue.getTime())
    ? new Date().toISOString()
    : publishedAtValue.toISOString();

  return {
    ...sitemap,
    title,
    publishedAt,
    includeInNewsSitemap: seo.includeInNewsSitemap,
  };
}

export async function listNewsArticlesForSitemap(limit = 1000, now = new Date()) {
  const cutoff = now.getTime() - 48 * 60 * 60 * 1000;
  const filterRecent = (item: ServerNewsArticleSitemapItem) =>
    item.includeInNewsSitemap && new Date(item.publishedAt).getTime() >= cutoff;

  if (process.env.MONGODB_URI) {
    try {
      await connectDB();
      const records = await Article.find({})
        .select('_id slug title publishedAt updatedAt workflow seo')
        .sort({ publishedAt: -1 })
        .lean();
      const normalized = records
        .map((item) => toNewsSitemapItem(item))
        .filter((item): item is ServerNewsArticleSitemapItem => Boolean(item))
        .filter(filterRecent)
        .slice(0, limit);
      if (normalized.length) return normalized;
    } catch (error) {
      console.error('Failed to load news sitemap articles from MongoDB, falling back.', error);
    }
  }

  const fallback = await listAllStoredArticles();
  return fallback
    .map((item) => toNewsSitemapItem(item))
    .filter((item): item is ServerNewsArticleSitemapItem => Boolean(item))
    .filter(filterRecent)
    .slice(0, limit);
}

export function getServerArticlePath(article: ServerArticleSitemapItem) {
  return buildArticlePublicPath({ id: article.id, slug: article.slug });
}
