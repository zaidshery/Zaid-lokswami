import type { Article } from '@/lib/mock/data';
import {
  mapLiveStoriesToVisualStories,
  type VisualStory,
} from '@/lib/content/visualStories';

const DEFAULT_AVATAR = '/logo-icon-final.png';

export type HomePageEpaperPreview = {
  _id: string;
  citySlug: string;
  cityName: string;
  title: string;
  publishDate: string;
  thumbnailPath: string;
  pageCount: number;
};

export type HomePageFeedState = {
  articles: Article[];
  stories: VisualStory[];
  epaper: HomePageEpaperPreview | null;
};

type PublicHomeFeedArticle = {
  id?: string;
  _id?: string;
  slug?: string;
  title?: string;
  summary?: string;
  image?: string;
  category?: string;
  author?: string | { name?: string; avatar?: string };
  publishedAt?: string;
  views?: number;
  isBreaking?: boolean;
  isTrending?: boolean;
  seo?: Article['seo'];
};

type PublicHomeFeedStory = {
  id?: string;
  _id?: string;
  title?: string;
  caption?: string;
  thumbnail?: string;
  mediaType?: 'image' | 'video' | string;
  mediaUrl?: string;
  linkUrl?: string;
  linkLabel?: string;
  category?: string;
  author?: string;
  durationSeconds?: number;
  priority?: number;
  views?: number;
  publishedAt?: string;
  isPublished?: boolean;
  mediaAssets?: unknown;
};

type PublicHomeFeedEPaper = {
  id?: string;
  _id?: string;
  citySlug?: string;
  cityName?: string;
  title?: string;
  publishDate?: string;
  thumbnailPath?: string;
  pageCount?: number;
};

type PublicHomeFeedData = {
  hero?: PublicHomeFeedArticle[];
  latest?: PublicHomeFeedArticle[];
  trending?: PublicHomeFeedArticle[];
  stories?: PublicHomeFeedStory[];
  epaper?: PublicHomeFeedEPaper | null;
};

type PublicHomeFeedEnvelope = {
  success?: boolean;
  data?: PublicHomeFeedData;
};

function asObject(value: unknown) {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
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

function normalizeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeAuthor(value: PublicHomeFeedArticle['author']) {
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

function mapHomeFeedArticle(raw: PublicHomeFeedArticle, index: number): Article | null {
  const input = asObject(raw) as PublicHomeFeedArticle;
  const id = String(input.id || input._id || `home-feed-${index}`).trim();
  const title = String(input.title || '').trim();
  const summary = String(input.summary || '').trim();
  const image = String(input.image || '').trim();
  const category = String(input.category || '').trim() || 'General';

  if (!id || !title || !summary || !image) return null;

  return {
    id,
    slug: String(input.slug || '').trim() || undefined,
    title,
    summary,
    image,
    category,
    author: normalizeAuthor(input.author),
    publishedAt: normalizeDate(input.publishedAt),
    views: Math.max(0, Math.floor(normalizeNumber(input.views))),
    isBreaking: Boolean(input.isBreaking),
    isTrending: Boolean(input.isTrending),
    seo: input.seo,
  };
}

function mergeUniqueArticles(sections: PublicHomeFeedArticle[][]) {
  const seen = new Set<string>();
  const output: Article[] = [];

  sections.flat().forEach((item, index) => {
    const article = mapHomeFeedArticle(item, index);
    if (!article) return;
    const key = article.id || `${article.title.toLowerCase()}|${article.publishedAt}`;
    if (seen.has(key)) return;
    seen.add(key);
    output.push(article);
  });

  return output;
}

function mapHomeFeedEPaper(raw: PublicHomeFeedEPaper | null | undefined) {
  if (!raw) return null;
  const id = String(raw.id || raw._id || '').trim();
  if (!id) return null;

  return {
    _id: id,
    citySlug: String(raw.citySlug || '').trim(),
    cityName: String(raw.cityName || '').trim(),
    title: String(raw.title || '').trim(),
    publishDate: String(raw.publishDate || '').trim(),
    thumbnailPath: String(raw.thumbnailPath || '').trim(),
    pageCount: Math.max(0, Math.floor(normalizeNumber(raw.pageCount))),
  } satisfies HomePageEpaperPreview;
}

function getHomeFeedData(payload: unknown): PublicHomeFeedData | null {
  const envelope = asObject(payload) as PublicHomeFeedEnvelope;
  if (envelope.success === false) return null;

  const data = asObject(envelope.data || payload) as PublicHomeFeedData;
  if (!data || typeof data !== 'object') return null;
  return data;
}

export function mapHomeFeedToHomePageState(payload: unknown): HomePageFeedState | null {
  const data = getHomeFeedData(payload);
  if (!data) return null;

  const articles = mergeUniqueArticles([
    Array.isArray(data.hero) ? data.hero : [],
    Array.isArray(data.latest) ? data.latest : [],
    Array.isArray(data.trending) ? data.trending : [],
  ]);
  const stories = mapLiveStoriesToVisualStories(
    Array.isArray(data.stories) ? data.stories : [],
    10
  );
  const epaper = mapHomeFeedEPaper(data.epaper);

  if (!articles.length && !stories.length && !epaper) return null;

  return {
    articles,
    stories,
    epaper,
  };
}

export async function fetchHomeFeedForHomePage(
  input: RequestInfo | URL = '/api/v1/public/home-feed'
) {
  try {
    const response = await fetch(input);
    const payload = await response.json().catch(() => null);
    if (!response.ok) return null;
    return mapHomeFeedToHomePageState(payload);
  } catch {
    return null;
  }
}
