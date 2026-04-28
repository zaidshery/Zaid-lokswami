import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import { isPubliclyPublishedArticle } from '@/lib/content/articlePublication';
import Article from '@/lib/models/Article';
import type { ArticleSeo, StoredArticle } from '@/lib/storage/articlesFile';
import {
  getStoredArticleById,
  listAllStoredArticles,
} from '@/lib/storage/articlesFile';

export type ServerArticle = {
  id: string;
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
  updatedAt: string;
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
  const source = typeof input === 'object' && input ? (input as Record<string, unknown>) : {};
  return {
    metaTitle: typeof source.metaTitle === 'string' ? source.metaTitle.trim() : '',
    metaDescription:
      typeof source.metaDescription === 'string' ? source.metaDescription.trim() : '',
    ogImage: normalizeMediaUrl(
      typeof source.ogImage === 'string' ? source.ogImage : '',
      ''
    ),
    canonicalUrl: typeof source.canonicalUrl === 'string' ? source.canonicalUrl.trim() : '',
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
    id: stringifyId(source._id) || stringifyId(source.id),
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
  if (process.env.MONGODB_URI) {
    try {
      await connectDB();
      if (Types.ObjectId.isValid(id)) {
        const article = await Article.findById(id).lean();
        if (!isPubliclyPublishedArticle(article)) {
          return null;
        }
        const normalized = normalizeFromUnknown(article);
        if (normalized) return normalized;
      }
    } catch (error) {
      console.error('Failed to load article metadata from MongoDB, falling back.', error);
    }
  }

  const fileArticle = await getStoredArticleById(id);
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

  const updatedAtRaw = source.updatedAt;
  const updatedAtValue = new Date(
    typeof updatedAtRaw === 'string' || typeof updatedAtRaw === 'number'
      ? updatedAtRaw
      : Date.now()
  );
  const updatedAt = Number.isNaN(updatedAtValue.getTime())
    ? new Date().toISOString()
    : updatedAtValue.toISOString();

  return { id, updatedAt };
}

export async function listArticlesForSitemap(limit = 500) {
  if (process.env.MONGODB_URI) {
    try {
      await connectDB();
      const records = await Article.find({})
        .select('_id updatedAt publishedAt workflow')
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
