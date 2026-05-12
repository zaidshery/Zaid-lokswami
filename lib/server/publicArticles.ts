import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import { isPubliclyPublishedArticle } from '@/lib/content/articlePublication';
import {
  NEWS_CATEGORY_DEFINITIONS,
  resolveNewsCategory,
} from '@/lib/constants/newsCategories';
import Article from '@/lib/models/Article';
import {
  getStoredArticleByIdOrSlug,
  listAllStoredArticles,
} from '@/lib/storage/articlesFile';
import type { ArticleSeo } from '@/lib/storage/articlesFile';
import {
  buildArticlePublicPath,
  normalizeArticleSeo,
  normalizeArticleSlug,
} from '@/lib/seo/articleSeo';

export type PublicArticleSource = 'mongo' | 'file';

export type PublicArticleCursor = {
  publishedAt: string;
  id: string;
};

export type PublicArticleListFilters = {
  category?: string;
  city?: string;
  query?: string;
};

export type PublicArticleListOptions = PublicArticleListFilters & {
  limit?: number;
  cursorPublishedAt?: string;
  cursorId?: string;
};

export type PublicArticleItem = {
  _id: string;
  id: string;
  slug: string;
  title: string;
  summary: string;
  image: string;
  category: string;
  author: string;
  publishedAt: string;
  updatedAt: string;
  views: number;
  isBreaking: boolean;
  isTrending: boolean;
  city: string;
  href: string;
};

export type PublicArticleDetail = PublicArticleItem & {
  previousSlugs: string[];
  content: string;
  seo: ArticleSeo;
};

export type PublicArticleListResult = {
  items: PublicArticleItem[];
  source: PublicArticleSource;
  limit: number;
  filters: PublicArticleListFilters;
  hasMore: boolean;
  nextCursor: PublicArticleCursor | null;
};

export type PublicArticleDetailResult = {
  article: PublicArticleDetail;
  source: PublicArticleSource;
};

const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 1;
const MAX_LIMIT = 200;
const USE_REMOTE_DEMO_MEDIA =
  process.env.NEXT_PUBLIC_USE_REMOTE_DEMO_MEDIA === 'true';
const UNSPLASH_IMAGE_HOST = /^https:\/\/images\.unsplash\.com\//i;
const LOCAL_NEWS_FALLBACK_IMAGE = '/placeholders/news-16x9.svg';

function asObject(value: unknown) {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function toId(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && 'toString' in value) {
    return String(value).trim();
  }
  return '';
}

function toText(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function toIsoDate(value: unknown) {
  const parsed = new Date(
    value instanceof Date || typeof value === 'string' || typeof value === 'number'
      ? value
      : Date.now()
  );
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeMediaUrl(value: unknown, fallback = LOCAL_NEWS_FALLBACK_IMAGE) {
  const image = typeof value === 'string' ? value.trim() : '';
  if (!image) return fallback;
  if (!USE_REMOTE_DEMO_MEDIA && UNSPLASH_IMAGE_HOST.test(image)) {
    return fallback;
  }
  return image;
}

function normalizeSeo(input: unknown, image: string): ArticleSeo {
  const seo = normalizeArticleSeo(input);
  return {
    ...seo,
    ogImage: normalizeMediaUrl(seo.ogImage, image),
  };
}

function normalizeSlugList(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => normalizeArticleSlug(String(item || '')))
    .filter(Boolean);
}

export function normalizePublicArticleLimit(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, parsed));
}

function normalizeFilterValue(value: unknown) {
  return String(value || '').trim();
}

function normalizeComparable(value: string) {
  return value.trim().toLowerCase();
}

function getCategoryCandidates(category: string) {
  const normalized = normalizeComparable(category);
  if (!normalized || normalized === 'all' || normalized === 'latest') {
    return [];
  }

  const matched = resolveNewsCategory(normalized);
  const candidates = matched
    ? [matched.slug, matched.name, matched.nameEn, ...matched.aliases]
    : [category];

  return Array.from(
    new Set(candidates.map((item) => item.trim()).filter(Boolean))
  );
}

function categoryMatchesFilter(articleCategory: string, category: string) {
  const normalized = normalizeComparable(category);
  if (!normalized || normalized === 'all' || normalized === 'latest') return true;

  const articleValue = normalizeComparable(articleCategory);
  const matched = resolveNewsCategory(normalized);
  if (!matched) return articleValue === normalized;

  const candidates = [
    matched.slug,
    matched.name,
    matched.nameEn,
    ...matched.aliases,
  ].map(normalizeComparable);

  return candidates.includes(articleValue);
}

function cityMatchesFilter(article: Pick<PublicArticleItem, 'city'>, city: string) {
  const normalized = normalizeComparable(city);
  if (!normalized || normalized === 'all') return true;
  return normalizeComparable(article.city).includes(normalized);
}

function searchMatchesFilter(
  article: Pick<PublicArticleItem, 'title' | 'summary' | 'category' | 'author' | 'city'>,
  query: string
) {
  const normalized = normalizeComparable(query);
  if (!normalized) return true;

  return [article.title, article.summary, article.category, article.author, article.city]
    .map(normalizeComparable)
    .some((value) => value.includes(normalized));
}

function getLocationFromSource(source: Record<string, unknown>) {
  const reporterMeta = asObject(source.reporterMeta);
  return (
    toText(reporterMeta.locationTag) ||
    toText(source.city) ||
    toText(source.cityName) ||
    toText(source.locationTag)
  );
}

function toPublicArticleItem(source: unknown): PublicArticleItem | null {
  const input = asObject(source);
  const id = toId(input._id) || toId(input.id);
  const title = toText(input.title);
  const summary = toText(input.summary);
  const image = normalizeMediaUrl(input.image);
  const category = toText(input.category) || 'General';
  const author = toText(input.author) || 'Editor';
  const slug = normalizeArticleSlug(toText(input.slug));
  const publishedAt = toIsoDate(input.publishedAt);
  const updatedAt = toIsoDate(input.updatedAt || input.publishedAt);

  if (!id || !title || !summary || !image) return null;

  return {
    _id: id,
    id,
    slug,
    title,
    summary,
    image,
    category,
    author,
    publishedAt,
    updatedAt,
    views: Math.max(0, Math.floor(toNumber(input.views, 0))),
    isBreaking: Boolean(input.isBreaking),
    isTrending: Boolean(input.isTrending),
    city: getLocationFromSource(input),
    href: buildArticlePublicPath({ id, slug }),
  };
}

function toPublicArticleDetail(source: unknown): PublicArticleDetail | null {
  const input = asObject(source);
  const item = toPublicArticleItem(input);
  if (!item) return null;

  return {
    ...item,
    previousSlugs: normalizeSlugList(input.previousSlugs).filter(
      (slug) => slug !== item.slug
    ),
    content: toText(input.content),
    seo: normalizeSeo(input.seo, item.image),
  };
}

function getSortTime(value: Pick<PublicArticleItem, 'publishedAt'>) {
  const parsed = new Date(value.publishedAt).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareArticles(a: PublicArticleItem, b: PublicArticleItem) {
  const byDate = getSortTime(b) - getSortTime(a);
  if (byDate !== 0) return byDate;
  return b.id.localeCompare(a.id);
}

function parseCursor(options: PublicArticleListOptions): PublicArticleCursor | null {
  const publishedAt = normalizeFilterValue(options.cursorPublishedAt);
  const id = normalizeFilterValue(options.cursorId);
  if (!publishedAt || !id) return null;

  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return null;

  return {
    publishedAt: date.toISOString(),
    id,
  };
}

function applyCursorFilter(items: PublicArticleItem[], cursor: PublicArticleCursor | null) {
  if (!cursor) return items;
  const cursorTime = new Date(cursor.publishedAt).getTime();

  return items.filter((item) => {
    const itemTime = getSortTime(item);
    if (itemTime < cursorTime) return true;
    if (itemTime > cursorTime) return false;
    return item.id < cursor.id;
  });
}

function applyFilters(items: PublicArticleItem[], filters: PublicArticleListFilters) {
  return items.filter((item) => {
    if (filters.category && !categoryMatchesFilter(item.category, filters.category)) {
      return false;
    }
    if (filters.city && !cityMatchesFilter(item, filters.city)) {
      return false;
    }
    if (filters.query && !searchMatchesFilter(item, filters.query)) {
      return false;
    }
    return true;
  });
}

function buildListResult(
  items: PublicArticleItem[],
  source: PublicArticleSource,
  options: PublicArticleListOptions
): PublicArticleListResult {
  const limit = normalizePublicArticleLimit(options.limit);
  const filters: PublicArticleListFilters = {
    ...(normalizeFilterValue(options.category)
      ? { category: normalizeFilterValue(options.category) }
      : {}),
    ...(normalizeFilterValue(options.city)
      ? { city: normalizeFilterValue(options.city) }
      : {}),
    ...(normalizeFilterValue(options.query)
      ? { query: normalizeFilterValue(options.query) }
      : {}),
  };
  const cursor = parseCursor(options);
  const filtered = applyCursorFilter(applyFilters(items.sort(compareArticles), filters), cursor);
  const pageItems = filtered.slice(0, limit);
  const last = pageItems[pageItems.length - 1];
  const hasMore = filtered.length > limit;

  return {
    items: pageItems,
    source,
    limit,
    filters,
    hasMore,
    nextCursor:
      hasMore && last
        ? {
            publishedAt: last.publishedAt,
            id: last.id,
          }
        : null,
  };
}

async function resolveSource(): Promise<PublicArticleSource> {
  if (!process.env.MONGODB_URI) return 'file';

  try {
    await connectDB();
    return 'mongo';
  } catch (error) {
    console.error('MongoDB unavailable for public articles, using file store.', error);
    return 'file';
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildMongoFilter(options: PublicArticleListOptions) {
  const and: Record<string, unknown>[] = [];
  const categoryCandidates = getCategoryCandidates(normalizeFilterValue(options.category));
  if (categoryCandidates.length) {
    and.push({
      $or: categoryCandidates.map((item) => ({
        category: { $regex: `^${escapeRegExp(item)}$`, $options: 'i' },
      })),
    });
  }

  const city = normalizeFilterValue(options.city);
  if (city) {
    const cityRegex = { $regex: escapeRegExp(city), $options: 'i' };
    and.push({
      $or: [
        { 'reporterMeta.locationTag': cityRegex },
        { city: cityRegex },
        { cityName: cityRegex },
        { locationTag: cityRegex },
      ],
    });
  }

  const query = normalizeFilterValue(options.query);
  if (query) {
    const queryRegex = { $regex: escapeRegExp(query), $options: 'i' };
    and.push({
      $or: [
        { title: queryRegex },
        { summary: queryRegex },
        { category: queryRegex },
        { author: queryRegex },
        { 'reporterMeta.locationTag': queryRegex },
        { city: queryRegex },
        { cityName: queryRegex },
        { locationTag: queryRegex },
      ],
    });
  }

  return and.length ? { $and: and } : {};
}

async function listMongoArticles(options: PublicArticleListOptions) {
  const requestedLimit = normalizePublicArticleLimit(options.limit);
  const candidateLimit = Math.min(
    1000,
    Math.max(requestedLimit * 5, requestedLimit + 50)
  );

  const docs = await Article.find(buildMongoFilter(options))
    .select(
      '_id slug previousSlugs title summary image category author publishedAt updatedAt views isBreaking isTrending workflow reporterMeta city cityName locationTag seo content'
    )
    .sort({ publishedAt: -1, _id: -1 })
    .limit(candidateLimit)
    .lean();

  return docs
    .filter((item) => isPubliclyPublishedArticle(item))
    .map((item) => toPublicArticleItem(item))
    .filter((item): item is PublicArticleItem => Boolean(item));
}

async function listFileArticles() {
  const stored = await listAllStoredArticles();
  return stored
    .filter((item) => isPubliclyPublishedArticle(item))
    .map((item) => toPublicArticleItem(item))
    .filter((item): item is PublicArticleItem => Boolean(item));
}

export async function listPublicArticles(
  options: PublicArticleListOptions = {}
): Promise<PublicArticleListResult> {
  const source = await resolveSource();
  const items = source === 'mongo' ? await listMongoArticles(options) : await listFileArticles();
  return buildListResult(items, source, options);
}

async function getMongoArticleByToken(token: string) {
  const slug = normalizeArticleSlug(token);
  let article: unknown = null;

  if (Types.ObjectId.isValid(token)) {
    article = await Article.findById(token).lean();
  }

  if (!article && slug) {
    article = await Article.findOne({
      $or: [{ slug }, { previousSlugs: slug }],
    }).lean();
  }

  return article;
}

export async function getPublicArticleBySlug(
  slugOrId: string
): Promise<PublicArticleDetailResult | null> {
  const token = decodeURIComponent(slugOrId).trim();
  if (!token) return null;

  const source = await resolveSource();
  const raw =
    source === 'mongo'
      ? await getMongoArticleByToken(token)
      : await getStoredArticleByIdOrSlug(token);

  if (!raw || !isPubliclyPublishedArticle(raw)) return null;

  const article = toPublicArticleDetail(raw);
  return article ? { article, source } : null;
}

export const PUBLIC_ARTICLE_FILTER_FIELDS = [
  'category',
  'city',
  ...NEWS_CATEGORY_DEFINITIONS.map((item) => item.slug),
];
