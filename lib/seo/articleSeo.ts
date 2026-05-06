export type ArticleSeoFields = {
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
  canonicalUrl: string;
  focusKeyword: string;
  secondaryKeywords: string;
  featuredImageAlt: string;
  featuredImageCaption: string;
  imageCredit: string;
  authorProfileUrl: string;
  includeInNewsSitemap: boolean;
  majorUpdateNote: string;
};

export type ArticleSeoChecklistItem = {
  label: string;
  done: boolean;
};

export type ArticleSeoAnalysis = {
  score: number;
  items: ArticleSeoChecklistItem[];
  missingInlineImageAltCount: number;
};

export type ArticlePublicRef = {
  id: string;
  slug?: string;
};

const FALLBACK_SITE_URL = 'http://localhost:3000';
const ARTICLE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function defaultArticleSeo(): ArticleSeoFields {
  return {
    metaTitle: '',
    metaDescription: '',
    ogImage: '',
    canonicalUrl: '',
    focusKeyword: '',
    secondaryKeywords: '',
    featuredImageAlt: '',
    featuredImageCaption: '',
    imageCredit: '',
    authorProfileUrl: '',
    includeInNewsSitemap: true,
    majorUpdateNote: '',
  };
}

export function normalizeArticleSeo(input: unknown): ArticleSeoFields {
  const source = typeof input === 'object' && input ? (input as Record<string, unknown>) : {};
  return {
    metaTitle: typeof source.metaTitle === 'string' ? source.metaTitle.trim() : '',
    metaDescription:
      typeof source.metaDescription === 'string' ? source.metaDescription.trim() : '',
    ogImage: typeof source.ogImage === 'string' ? source.ogImage.trim() : '',
    canonicalUrl: typeof source.canonicalUrl === 'string' ? source.canonicalUrl.trim() : '',
    focusKeyword: typeof source.focusKeyword === 'string' ? source.focusKeyword.trim() : '',
    secondaryKeywords:
      typeof source.secondaryKeywords === 'string' ? source.secondaryKeywords.trim() : '',
    featuredImageAlt:
      typeof source.featuredImageAlt === 'string' ? source.featuredImageAlt.trim() : '',
    featuredImageCaption:
      typeof source.featuredImageCaption === 'string'
        ? source.featuredImageCaption.trim()
        : '',
    imageCredit: typeof source.imageCredit === 'string' ? source.imageCredit.trim() : '',
    authorProfileUrl:
      typeof source.authorProfileUrl === 'string' ? source.authorProfileUrl.trim() : '',
    includeInNewsSitemap:
      typeof source.includeInNewsSitemap === 'boolean'
        ? source.includeInNewsSitemap
        : true,
    majorUpdateNote:
      typeof source.majorUpdateNote === 'string' ? source.majorUpdateNote.trim() : '',
  };
}

export function normalizeArticleSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 200);
}

export function isValidArticleSlug(input: string) {
  return ARTICLE_SLUG_PATTERN.test(input.trim());
}

export async function resolveUniqueArticleSlug(
  requestedTitleOrSlug: string,
  exists: (candidate: string) => Promise<boolean>
) {
  const base = normalizeArticleSlug(requestedTitleOrSlug) || 'article';
  let candidate = base;
  let suffix = 2;

  while (await exists(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
    if (suffix > 1000) break;
  }

  return candidate;
}

export function getSiteUrl(value = process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_SITE_URL) {
  return value.replace(/\/+$/, '');
}

export function toAbsoluteArticleUrl(input: string, siteUrl = getSiteUrl()) {
  if (!input) return '';
  if (/^https?:\/\//i.test(input)) return input;
  return input.startsWith('/') ? `${siteUrl}${input}` : `${siteUrl}/${input}`;
}

export function getArticlePublicToken(article: ArticlePublicRef) {
  return article.slug?.trim() || article.id.trim();
}

export function buildArticlePublicPath(article: ArticlePublicRef) {
  const token = getArticlePublicToken(article);
  return token ? `/main/article/${encodeURIComponent(token)}` : '';
}

export function buildArticlePublicUrl(article: ArticlePublicRef, siteUrl = getSiteUrl()) {
  const path = buildArticlePublicPath(article);
  return path ? toAbsoluteArticleUrl(path, siteUrl) : '';
}

export function stripArticleHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function getFirstParagraphText(html: string) {
  const match = html.match(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/i);
  return stripArticleHtml(match?.[1] || html).slice(0, 500);
}

function containsKeyword(text: string, keyword: string) {
  if (!keyword.trim()) return false;
  return text.toLowerCase().includes(keyword.trim().toLowerCase());
}

function countMissingInlineImageAlt(html: string) {
  const images = Array.from(html.matchAll(/<img\b([^>]*)>/gi));
  return images.filter((match) => {
    const attrs = match[1] || '';
    const altMatch = attrs.match(/\balt=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const alt = altMatch?.[1] || altMatch?.[2] || altMatch?.[3] || '';
    return !alt.trim();
  }).length;
}

export function analyzeArticleSeo(input: {
  title: string;
  summary: string;
  content: string;
  slug: string;
  seo: Partial<ArticleSeoFields>;
  hasFeaturedImage: boolean;
  hasSourceOrExternalLink?: boolean;
}) {
  const seo = normalizeArticleSeo(input.seo);
  const firstParagraph = getFirstParagraphText(input.content);
  const headingText = stripArticleHtml(
    Array.from(input.content.matchAll(/<h[23](?:\s[^>]*)?>([\s\S]*?)<\/h[23]>/gi))
      .map((match) => match[1] || '')
      .join(' ')
  );
  const keyword = seo.focusKeyword;
  const missingInlineImageAltCount = countMissingInlineImageAlt(input.content);
  const hasInternalArticleLink = /href=["'][^"']*\/main\/article\//i.test(input.content);
  const hasAnyLink = /<a\b/i.test(input.content);
  const hasSeoImage = input.hasFeaturedImage && Boolean(seo.featuredImageAlt.trim());
  const hasSchemaBasics = Boolean(
    input.title.trim() &&
      input.summary.trim() &&
      input.hasFeaturedImage &&
      input.slug.trim() &&
      seo.includeInNewsSitemap !== undefined
  );

  const items: ArticleSeoChecklistItem[] = [
    { label: 'Meta title ready', done: (seo.metaTitle || input.title).trim().length >= 20 },
    {
      label: 'Meta description ready',
      done: (seo.metaDescription || input.summary).trim().length >= 70,
    },
    { label: 'SEO slug ready', done: isValidArticleSlug(input.slug) },
    { label: 'Featured image alt text added', done: hasSeoImage },
    {
      label: 'Focus keyword in title',
      done: Boolean(keyword) && containsKeyword(input.title, keyword),
    },
    {
      label: 'Focus keyword in first paragraph',
      done: Boolean(keyword) && containsKeyword(firstParagraph, keyword),
    },
    {
      label: 'Focus keyword in heading',
      done: Boolean(keyword) && containsKeyword(headingText, keyword),
    },
    { label: 'Internal article link added', done: hasInternalArticleLink },
    {
      label: 'Source or external link added',
      done: Boolean(input.hasSourceOrExternalLink || (hasAnyLink && !hasInternalArticleLink)),
    },
    { label: 'NewsArticle schema complete', done: hasSchemaBasics },
    { label: 'News sitemap eligible', done: seo.includeInNewsSitemap && hasSchemaBasics },
  ];
  const doneCount = items.filter((item) => item.done).length;
  return {
    score: Math.round((doneCount / items.length) * 100),
    items,
    missingInlineImageAltCount,
  } satisfies ArticleSeoAnalysis;
}

export function buildArticleGooglePreview(input: {
  id: string;
  slug: string;
  title: string;
  summary: string;
  image: string;
  seo: Partial<ArticleSeoFields>;
  siteUrl?: string;
}) {
  const seo = normalizeArticleSeo(input.seo);
  const title = seo.metaTitle || input.title || 'Untitled article';
  const description = seo.metaDescription || input.summary || '';
  const url =
    seo.canonicalUrl ||
    buildArticlePublicUrl(
      { id: input.id || 'article-preview', slug: input.slug || undefined },
      getSiteUrl(input.siteUrl)
    );

  return {
    title,
    description,
    url,
    image: seo.ogImage || input.image,
  };
}

export function buildNewsArticleJsonLd(input: {
  id: string;
  slug?: string;
  title: string;
  summary: string;
  image: string;
  category: string;
  author: string;
  publishedAt: string;
  updatedAt: string;
  seo: Partial<ArticleSeoFields>;
  siteUrl?: string;
}) {
  const seo = normalizeArticleSeo(input.seo);
  const siteUrl = getSiteUrl(input.siteUrl);
  const articleUrl = seo.canonicalUrl || buildArticlePublicUrl(input, siteUrl);
  const imageUrl = toAbsoluteArticleUrl(seo.ogImage || input.image, siteUrl);
  const author: Record<string, string> = {
    '@type': 'Person',
    name: input.author,
  };
  if (seo.authorProfileUrl) {
    author.url = seo.authorProfileUrl;
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: seo.metaTitle || input.title,
    description: seo.metaDescription || input.summary,
    image: imageUrl ? [imageUrl] : [],
    articleSection: input.category,
    datePublished: input.publishedAt,
    dateModified: input.updatedAt || input.publishedAt,
    author: [author],
    publisher: {
      '@type': 'Organization',
      name: 'Lokswami',
      logo: {
        '@type': 'ImageObject',
        url: toAbsoluteArticleUrl('/logo-app-512.png', siteUrl),
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleUrl,
    },
  };
}
