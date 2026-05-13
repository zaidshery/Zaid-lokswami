import type { Article } from '@/lib/mock/data';
import { getAiArticleCorpus } from '@/lib/ai/articleCorpus';
import { resolveNewsCategory } from '@/lib/constants/newsCategories';

const DEVANAGARI_PATTERN = /[\u0900-\u097F]/;

const TOKEN_EXPANSIONS: Record<string, string[]> = {
  election: ['elections', 'chunav', 'vote', 'voting'],
  chunav: ['election', 'vote', 'voting'],
  politics: ['rajneeti', 'sarkar', 'government', 'policy'],
  rajneeti: ['politics', 'government', 'sarkar'],
  sports: ['sport', 'khel', 'cricket', 'ipl', 'football'],
  khel: ['sports', 'cricket', 'ipl', 'football'],
  business: ['biz', 'vyapar', 'market', 'economy', 'stocks'],
  vyapar: ['business', 'market', 'economy'],
  entertainment: ['manoranjan', 'movie', 'film', 'bollywood', 'celebrity'],
  manoranjan: ['entertainment', 'movie', 'film', 'bollywood'],
  tech: ['technology', 'ai', 'startup', 'digital'],
  technology: ['tech', 'ai', 'startup', 'digital'],
  world: ['international', 'global', 'vishwa'],
  international: ['world', 'global'],
  national: ['india', 'desh', 'rashtriya'],
  weather: ['mausam', 'rain', 'heatwave', 'storm'],
  mausam: ['weather', 'rain', 'storm', 'heatwave'],
};

export type SemanticSearchResult = {
  id: string;
  title: string;
  summary: string;
  image: string;
  category: string;
  author: Article['author'];
  publishedAt: string;
  views: number;
  isBreaking?: boolean;
  isTrending?: boolean;
  score: number;
  snippet: string;
};

export type SemanticSearchResponse = {
  query: string;
  answer: string;
  mode: 'local-search';
  language: 'hi' | 'en';
  results: SemanticSearchResult[];
};

function normalizeText(input: string) {
  return input
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesCategoryFilter(articleCategory: string, selectedCategory: string) {
  const normalizedArticle = normalizeText(articleCategory);
  const normalizedSelected = normalizeText(selectedCategory);
  if (!normalizedSelected || normalizedSelected === 'all') return true;

  const resolved = resolveNewsCategory(normalizedSelected);
  if (!resolved) {
    return normalizedArticle.includes(normalizedSelected);
  }

  const accepted = new Set<string>([
    resolved.slug,
    resolved.name,
    resolved.nameEn,
    ...resolved.aliases,
  ].map((item) => normalizeText(item)));

  return accepted.has(normalizedArticle);
}

function tokenize(input: string) {
  return normalizeText(input).match(/[\p{L}\p{N}]+/gu) || [];
}

function detectLanguage(query: string): 'hi' | 'en' {
  return DEVANAGARI_PATTERN.test(query) ? 'hi' : 'en';
}

function expandTokens(tokens: string[]) {
  const expanded = new Set(tokens);
  tokens.forEach((token) => {
    const direct = TOKEN_EXPANSIONS[token];
    if (direct) {
      direct.forEach((value) => expanded.add(value));
    }
  });

  Object.entries(TOKEN_EXPANSIONS).forEach(([key, values]) => {
    if (values.some((value) => expanded.has(value))) {
      expanded.add(key);
      values.forEach((value) => expanded.add(value));
    }
  });

  return Array.from(expanded);
}

function countOccurrences(haystack: string, needle: string) {
  if (!needle || !haystack.includes(needle)) return 0;
  let index = 0;
  let count = 0;
  while (true) {
    const next = haystack.indexOf(needle, index);
    if (next === -1) break;
    count += 1;
    index = next + needle.length;
  }
  return count;
}

function computeTermScore(text: string, tokens: string[]) {
  return tokens.reduce((score, token) => {
    const matches = countOccurrences(text, token);
    if (!matches) return score;
    const tokenWeight = token.length >= 6 ? 1.35 : token.length >= 4 ? 1.1 : 0.85;
    return score + Math.min(matches, 8) * tokenWeight;
  }, 0);
}

function buildSnippet(article: Article, tokens: string[]) {
  const text = `${article.summary}. ${article.content || ''}`
    .replace(/\s+/g, ' ')
    .trim();
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const found = sentences.find((sentence) => {
    const normalized = normalizeText(sentence);
    return tokens.some((token) => normalized.includes(token));
  });
  const snippet = found || article.summary || article.title;
  return snippet.length > 220 ? `${snippet.slice(0, 217).trim()}...` : snippet;
}

function recencyBoost(publishedAt: string) {
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return 0;
  const ageDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays <= 1) return 4;
  if (ageDays <= 3) return 3;
  if (ageDays <= 7) return 2;
  if (ageDays <= 30) return 1;
  return 0;
}

function normalizeArticleForResponse(article: Article, score: number, tokens: string[]): SemanticSearchResult {
  return {
    id: article.id,
    title: article.title,
    summary: article.summary,
    image: article.image,
    category: article.category,
    author: article.author,
    publishedAt: article.publishedAt,
    views: article.views,
    isBreaking: article.isBreaking,
    isTrending: article.isTrending,
    score: Number(score.toFixed(2)),
    snippet: buildSnippet(article, tokens),
  };
}

function templateAnswer(query: string, language: 'hi' | 'en', results: SemanticSearchResult[]) {
  if (!results.length) {
    return language === 'hi'
      ? 'Is query ke liye abhi seedha match nahi mila. Kripya keywords badal kar dobara try karein.'
      : 'No direct match found for this query yet. Try refining the keywords for better results.';
  }

  const top = results.slice(0, 3).map((item) => item.title);
  if (language === 'hi') {
    return `Local search se ${results.length} relevant stories mili hain. Sabse upyogi coverage: ${top.join('; ')}.`;
  }
  return `Local search found ${results.length} relevant stories. Most useful coverage includes: ${top.join('; ')}.`;
}

export async function runSemanticRagSearch(params: {
  query: string;
  category?: string;
  limit?: number;
  sortBy?: 'relevance' | 'latest' | 'popular';
}) {
  const query = params.query.trim();
  const language = detectLanguage(query);
  const limit = Math.max(1, Math.min(params.limit || 18, 36));
  const sortBy = params.sortBy || 'relevance';

  if (!query) {
    return {
      query,
      answer:
        language === 'hi'
          ? 'Apna sawal type karein, main relevant coverage turant nikal dunga.'
          : 'Type your question and I will retrieve relevant coverage instantly.',
      mode: 'local-search',
      language,
      results: [],
    } as SemanticSearchResponse;
  }

  const corpus = await getAiArticleCorpus(320);
  const tokens = expandTokens(tokenize(query));
  const normalizedQuery = normalizeText(query);
  const scored = corpus
    .filter((item) => {
      const selectedCategory =
        typeof params.category === 'string' ? params.category : '';
      return matchesCategoryFilter(item.category, selectedCategory);
    })
    .map((article) => {
      const titleText = normalizeText(article.title);
      const summaryText = normalizeText(article.summary);
      const contentText = normalizeText(article.content || '');
      const categoryText = normalizeText(article.category);

      const titleScore = computeTermScore(titleText, tokens) * 6;
      const summaryScore = computeTermScore(summaryText, tokens) * 3.5;
      const contentScore = computeTermScore(contentText, tokens) * 1.25;
      const categoryScore = computeTermScore(categoryText, tokens) * 4;
      const phraseBonus =
        titleText.includes(normalizedQuery) || summaryText.includes(normalizedQuery) ? 7 : 0;
      const trendBoost = article.isTrending ? 0.5 : 0;
      const freshBoost = recencyBoost(article.publishedAt);
      const viewBoost = Math.log10(Math.max(1, article.views || 1));

      const score =
        titleScore +
        summaryScore +
        contentScore +
        categoryScore +
        phraseBonus +
        trendBoost +
        freshBoost +
        viewBoost;

      return { article, score };
    })
    .filter((item) => item.score > 0.2);

  scored.sort((a, b) => {
    if (sortBy === 'latest') {
      return new Date(b.article.publishedAt).getTime() - new Date(a.article.publishedAt).getTime();
    }
    if (sortBy === 'popular') {
      return (b.article.views || 0) - (a.article.views || 0);
    }
    return b.score - a.score;
  });

  const results = scored
    .slice(0, limit)
    .map((item) => normalizeArticleForResponse(item.article, item.score, tokens));

  const answer = templateAnswer(query, language, results);

  return {
    query,
    answer,
    mode: 'local-search',
    language,
    results,
  } as SemanticSearchResponse;
}
