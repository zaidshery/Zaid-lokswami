import type { Article } from '@/lib/mock/data';

const DEFAULT_AVATAR = '/logo-icon-final.png';
const DEFAULT_LIMIT = 20;

export type PublicArticlesCursor = {
  publishedAt: string;
  id: string;
};

export type PublicArticleApiItem = {
  _id?: string;
  id?: string;
  slug?: string;
  title?: string;
  summary?: string;
  content?: string;
  image?: string;
  category?: string;
  author?: string | { name?: string; avatar?: string };
  publishedAt?: string;
  updatedAt?: string;
  views?: number;
  isBreaking?: boolean;
  isTrending?: boolean;
  city?: string;
  href?: string;
  seo?: Article['seo'];
};

export type PublicArticlesPage = {
  items: PublicArticleApiItem[];
  limit: number;
  hasMore: boolean;
  nextCursor: PublicArticlesCursor | null;
};

export type PublicArticlesQuery = {
  limit?: number;
  category?: string;
  city?: string;
  cursor?: PublicArticlesCursor | null;
  basePath?: string;
};

type PublicArticlesEnvelope = {
  success?: boolean;
  data?: {
    items?: PublicArticleApiItem[];
  };
  meta?: {
    pagination?: {
      limit?: number;
      hasMore?: boolean;
      nextCursor?: PublicArticlesCursor | null;
    };
  };
  items?: PublicArticleApiItem[];
  limit?: number;
  hasMore?: boolean;
  nextCursor?: PublicArticlesCursor | null;
};

function asObject(value: unknown) {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeLimit(value: unknown, fallback = DEFAULT_LIMIT) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeCursor(value: unknown): PublicArticlesCursor | null {
  const input = asObject(value);
  const publishedAt = String(input.publishedAt || '').trim();
  const id = String(input.id || '').trim();
  if (!publishedAt || !id) return null;
  return { publishedAt, id };
}

function normalizeDate(value: unknown) {
  const parsed = new Date(
    value instanceof Date || typeof value === 'string' || typeof value === 'number'
      ? value
      : Date.now()
  );
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function normalizeAuthor(value: PublicArticleApiItem['author']) {
  if (typeof value === 'string') {
    const name = value.trim() || 'Editor';
    return {
      id: `author-${name.toLowerCase().replace(/\s+/g, '-')}`,
      name,
      avatar: DEFAULT_AVATAR,
    };
  }

  const name = value?.name?.trim() || 'Editor';
  return {
    id: `author-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    avatar: value?.avatar?.trim() || DEFAULT_AVATAR,
  };
}

export function parsePublicArticlesPayload(
  payload: unknown,
  fallbackLimit = DEFAULT_LIMIT
): PublicArticlesPage {
  const envelope = asObject(payload) as PublicArticlesEnvelope;
  const data = asObject(envelope.data) as PublicArticlesEnvelope['data'];
  const meta = asObject(envelope.meta) as PublicArticlesEnvelope['meta'];
  const pagination = asObject(meta?.pagination);

  const items = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(envelope.items)
      ? envelope.items
      : Array.isArray(envelope.data)
        ? (envelope.data as PublicArticleApiItem[])
        : [];
  const limit = normalizeLimit(pagination.limit ?? envelope.limit, fallbackLimit);
  const nextCursor = normalizeCursor(pagination.nextCursor ?? envelope.nextCursor);

  return {
    items,
    limit,
    hasMore: Boolean(pagination.hasMore ?? envelope.hasMore),
    nextCursor,
  };
}

export function buildPublicArticlesPath(query: PublicArticlesQuery = {}) {
  const path = query.basePath || '/api/v1/public/articles';
  const params = new URLSearchParams();
  params.set('limit', String(normalizeLimit(query.limit)));

  if (query.category?.trim()) {
    params.set('category', query.category.trim());
  }
  if (query.city?.trim()) {
    params.set('city', query.city.trim());
  }
  if (query.cursor?.publishedAt && query.cursor.id) {
    params.set('cursorPublishedAt', query.cursor.publishedAt);
    params.set('cursorId', query.cursor.id);
  }

  return `${path}?${params.toString()}`;
}

export function mapPublicArticleToUiArticle(
  item: PublicArticleApiItem,
  index = 0
): Article | null {
  const id = String(item._id || item.id || `public-article-${index}`).trim();
  const title = String(item.title || '').trim();
  const summary = String(item.summary || '').trim();
  const image = String(item.image || '').trim();
  if (!id || !title || !summary || !image) return null;

  return {
    id,
    slug: String(item.slug || '').trim() || undefined,
    title,
    summary,
    content: String(item.content || ''),
    image,
    category: String(item.category || '').trim() || 'General',
    author: normalizeAuthor(item.author),
    publishedAt: normalizeDate(item.publishedAt),
    views: Number.isFinite(Number(item.views)) ? Number(item.views) : 0,
    isBreaking: Boolean(item.isBreaking),
    isTrending: Boolean(item.isTrending),
    seo: item.seo,
  };
}

export function mapPublicArticlesToUiArticles(items: PublicArticleApiItem[]) {
  return items
    .map((item, index) => mapPublicArticleToUiArticle(item, index))
    .filter((item): item is Article => Boolean(item));
}

export async function fetchPublicArticlesPage(
  query: PublicArticlesQuery = {},
  options: { fallbackToLegacyLatest?: boolean } = {}
) {
  const limit = normalizeLimit(query.limit);
  const requestPath = buildPublicArticlesPath({ ...query, limit });

  try {
    const response = await fetch(requestPath);
    const payload = await response.json().catch(() => null);
    if (response.ok) {
      return parsePublicArticlesPayload(payload, limit);
    }
  } catch {
    // Fall through to legacy latest endpoint when requested.
  }

  if (!options.fallbackToLegacyLatest || query.category || query.city) {
    return null;
  }

  try {
    const legacyPath = buildPublicArticlesPath({
      ...query,
      limit,
      basePath: '/api/articles/latest',
    });
    const response = await fetch(legacyPath);
    const payload = await response.json().catch(() => null);
    if (!response.ok) return null;
    return parsePublicArticlesPayload(payload, limit);
  } catch {
    return null;
  }
}
