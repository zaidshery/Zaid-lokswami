import { NextRequest, NextResponse } from 'next/server';
import type { ContentType } from '@/lib/ai/contentEmbedder';
import { fetchAllIndexedContent, type IndexedContent } from '@/lib/ai/contentIndex';
import { cosineSimilarity, generateEmbedding } from '@/lib/ai/embeddings';
import {
  generateJSON,
  isGeminiConfigured,
  LOKSWAMI_SYSTEM_PROMPT,
} from '@/lib/ai/gemini';
import { NEWS_CATEGORIES, resolveNewsCategory } from '@/lib/constants/newsCategories';

interface SearchRequestBody {
  query?: string;
  category?: string;
  limit?: number;
  sortBy?: 'relevance' | 'latest' | 'popular';
  language?: 'hi' | 'en';
}

type AnswerSource =
  | 'cms_articles'
  | 'general_knowledge'
  | 'related_category'
  | 'category_redirect'
  | 'refused'
  | 'empty_database'
  | 'error_fallback';

interface GeminiRelevantContent {
  id: string;
  type: ContentType;
}

interface GeminiSearchResponse {
  answer: string;
  answerSource?: string;
  relevantContent?: GeminiRelevantContent[];
  confidence?: 'high' | 'medium' | 'low';
  followUpSuggestion?: string;
}

type GroupedContent = {
  articles: IndexedContent[];
  epapers: IndexedContent[];
  videos: IndexedContent[];
  stories: IndexedContent[];
};

type SearchPrimaryAction = {
  label: string;
  url: string;
};

type LegacyArticleResult = {
  id: string;
  title: string;
  summary: string;
  image: string;
  category: string;
  publishedAt: string;
  views: number;
  author: {
    id: string;
    name: string;
    avatar: string;
  };
};

type SearchResponseBody = {
  success: true;
  answer: string;
  answerSource: AnswerSource;
  content: GroupedContent;
  confidence: 'high' | 'medium' | 'low';
  followUpSuggestion: string;
  primaryAction: SearchPrimaryAction | null;
  query: string;
  data: {
    answer: string;
    answerSource: AnswerSource;
    mode: string;
    results: LegacyArticleResult[];
    content: GroupedContent;
    confidence: 'high' | 'medium' | 'low';
    followUpSuggestion: string;
    primaryAction: SearchPrimaryAction | null;
  };
};

const NEGATIVE_PATTERNS = [
  /उपलब्ध नहीं/i,
  /जानकारी नहीं/i,
  /नहीं मिली/i,
  /नहीं बता सकता/i,
  /मेरे पास जानकारी नहीं/i,
  /डेटा उपलब्ध नहीं/i,
  /I don't have/i,
  /no information/i,
  /not available/i,
  /cannot provide/i,
  /no results/i,
] as const;

const OFF_TOPIC_PATTERNS = [
  /\brecipe\b/i,
  /\bjoke\b/i,
  /\bpoem\b/i,
  /\bpoetry\b/i,
  /\bmath\b/i,
  /\bhomework\b/i,
  /\bprogram\b/i,
  /\bcode\b/i,
  /\bemail\b/i,
  /\btranslate\b/i,
  /\bromantic\b/i,
  /\blove letter\b/i,
  /चुटकुल/i,
  /कविता/i,
  /गणित/i,
  /होमवर्क/i,
  /कोड/i,
  /ईमेल/i,
  /अनुवाद/i,
  /लव लेटर/i,
] as const;

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      globalThis.setTimeout(() => {
        reject(new Error(`${label} timed out after ${ms}ms`));
      }, ms);
    }),
  ]);
}

function parseLimit(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 6;
  }

  return Math.max(1, Math.min(Math.round(value), 12));
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function tokenize(value: string) {
  return normalizeText(value).match(/[\p{L}\p{N}]+/gu) || [];
}

function normalizeAnswerSource(value: unknown): AnswerSource | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'cms_articles' ||
    normalized === 'general_knowledge' ||
    normalized === 'related_category' ||
    normalized === 'category_redirect' ||
    normalized === 'refused' ||
    normalized === 'empty_database' ||
    normalized === 'error_fallback'
  ) {
    return normalized;
  }

  return null;
}

function normalizeConfidence(value: unknown): 'high' | 'medium' | 'low' {
  if (value === 'high' || value === 'medium' || value === 'low') {
    return value;
  }

  return 'medium';
}

function hasNegativeLanguage(answer: string) {
  return NEGATIVE_PATTERNS.some((pattern) => pattern.test(answer));
}

function hasActionableEnding(answer: string) {
  return /(लोकस्वामी|search|सर्च करें|देखें|पढ़ें|\?)$/i.test(answer.trim());
}

function sanitizeAIResponse(answer: string): string {
  let sanitized = answer.trim();
  let hasNegative = false;

  NEGATIVE_PATTERNS.forEach((pattern) => {
    if (pattern.test(sanitized)) {
      hasNegative = true;
    }
  });

  if (!sanitized) {
    return '';
  }

  sanitized = sanitized.replace(
    /उपलब्ध नहीं है[।.]?/gi,
    'के बारे में हमारी टीम जल्द खबर लाएगी!'
  );
  sanitized = sanitized.replace(
    /उपलब्ध नहीं हैं[।.]?/gi,
    'के बारे में हमारी टीम जल्द खबर लाएगी!'
  );
  sanitized = sanitized.replace(
    /जानकारी नहीं है[।.]?/gi,
    'की ताज़ा जानकारी के लिए लोकस्वामी पर नज़र रखें!'
  );
  sanitized = sanitized.replace(
    /नहीं मिली[।.]?/gi,
    'पर हमारी टीम नई अपडेट ला रही है!'
  );
  sanitized = sanitized.replace(
    /नहीं बता सकता[।.]?/gi,
    'पर मैं आपको संबंधित खबरों की दिशा दिखा सकता हूं!'
  );
  sanitized = sanitized.replace(
    /I don't have[^.?!]*[.?!]?/gi,
    'Lokswami is tracking this topic closely!'
  );
  sanitized = sanitized.replace(
    /no information[^.?!]*[.?!]?/gi,
    'Lokswami is tracking this topic closely!'
  );
  sanitized = sanitized.replace(
    /not available[^.?!]*[.?!]?/gi,
    'fresh updates are on the way!'
  );
  sanitized = sanitized.replace(
    /cannot provide[^.?!]*[.?!]?/gi,
    'I can guide you to related coverage!'
  );
  sanitized = sanitized.trim();

  if (hasNegative && !sanitized.includes('लोकस्वामी') && !/Lokswami/i.test(sanitized)) {
    sanitized += ' लोकस्वामी पर इस विषय की और खबरों के लिए सर्च करें।';
  }

  if (hasNegativeLanguage(sanitized)) {
    return 'इस विषय पर हमारी टीम नई अपडेट ला रही है! लोकस्वामी पर ताज़ा खबरों के लिए बने रहें।';
  }

  return sanitized;
}

function ensurePositiveEnding(answer: string, language: 'hi' | 'en') {
  if (!answer.trim()) {
    return language === 'hi'
      ? 'लोकस्वामी पर इस विषय की और खबरों के लिए सर्च करें।'
      : 'Search Lokswami for more updates on this topic.';
  }

  if (hasActionableEnding(answer)) {
    return answer.trim();
  }

  return language === 'hi'
    ? `${answer.trim()} लोकस्वामी पर इस विषय की और खबरों के लिए सर्च करें।`
    : `${answer.trim()} Search Lokswami for more coverage on this topic.`;
}

function lexicalScore(query: string, content: IndexedContent) {
  const haystack = normalizeText(
    [
      content.title,
      content.description,
      content.category,
      content.type,
      ...(content.tags || []),
    ].join('. ')
  );
  const tokens = tokenize(query);

  if (!tokens.length || !haystack) {
    return 0;
  }

  let score = 0;

  for (const token of tokens) {
    if (!token) continue;
    if (haystack.includes(token)) {
      score += content.title.toLowerCase().includes(token) ? 0.18 : 0.1;
    }
  }

  if (haystack.includes(normalizeText(query))) {
    score += 0.24;
  }

  return Math.min(score, 0.95);
}

function recencyBoost(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return 0;
  }

  const ageDays = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24);

  if (ageDays <= 1) return 0.08;
  if (ageDays <= 3) return 0.06;
  if (ageDays <= 7) return 0.04;
  if (ageDays <= 30) return 0.02;
  return 0;
}

function popularityBoost(content: IndexedContent) {
  const views = typeof content.views === 'number' ? content.views : 0;
  if (views <= 0) return 0;
  return Math.min(Math.log10(views + 1) / 30, 0.05);
}

function sortByUtility(items: IndexedContent[]) {
  return [...items].sort((left, right) => {
    const leftViews = typeof left.views === 'number' ? left.views : 0;
    const rightViews = typeof right.views === 'number' ? right.views : 0;
    if (rightViews !== leftViews) {
      return rightViews - leftViews;
    }

    const leftDate = new Date(left.date).getTime() || 0;
    const rightDate = new Date(right.date).getTime() || 0;
    return rightDate - leftDate;
  });
}

function categoryMatches(contentCategory: string, preferredCategory: string) {
  if (!preferredCategory) return true;

  const left = normalizeText(contentCategory);
  const right = normalizeText(preferredCategory);
  return left.includes(right) || right.includes(left);
}

function applyCategoryFilter(items: IndexedContent[], category: string) {
  const normalizedCategory = normalizeText(category);
  if (!normalizedCategory || normalizedCategory === 'all') {
    return items;
  }

  return items.filter((item) => normalizeText(item.category).includes(normalizedCategory));
}

function emptyGroupedContent(): GroupedContent {
  return {
    articles: [],
    epapers: [],
    videos: [],
    stories: [],
  };
}

function hasGroupedContent(groups: GroupedContent) {
  return (
    groups.articles.length > 0 ||
    groups.epapers.length > 0 ||
    groups.videos.length > 0 ||
    groups.stories.length > 0
  );
}

function groupContent(items: IndexedContent[]): GroupedContent {
  return items.reduce<GroupedContent>((groups, item) => {
    if (item.type === 'article') groups.articles.push(item);
    if (item.type === 'epaper') groups.epapers.push(item);
    if (item.type === 'video') groups.videos.push(item);
    if (item.type === 'story') groups.stories.push(item);
    return groups;
  }, emptyGroupedContent());
}

function trimGroupedContent(items: IndexedContent[]): GroupedContent {
  const counts: Record<ContentType, number> = {
    article: 0,
    epaper: 0,
    video: 0,
    story: 0,
  };

  const selected: IndexedContent[] = [];

  for (const item of items) {
    if (selected.length >= 5) break;
    if (counts[item.type] >= 2) continue;

    counts[item.type] += 1;
    selected.push(item);
  }

  return groupContent(selected);
}

function toLegacyArticleResult(article: IndexedContent): LegacyArticleResult {
  return {
    id: article.id,
    title: article.title,
    summary: article.description,
    image: article.thumbnail,
    category: article.category,
    publishedAt: article.date,
    views: typeof article.views === 'number' ? article.views : 0,
    author: {
      id: 'lokswami-ai',
      name: article.authorName || 'Lokswami',
      avatar: '/placeholders/avatar.svg',
    },
  };
}

function buildContentSection(items: IndexedContent[]) {
  return (
    items
      .map((item) => {
        const tags = item.tags?.length ? ` | Tags: ${item.tags.join(', ')}` : '';
        return `- [${(item.similarityScore || 0).toFixed(2)}] ${item.title} (${item.category}) | ID: ${item.id}${tags}`;
      })
      .join('\n') || '- none'
  );
}

function inferPreferredContentType(query: string): ContentType {
  const normalized = normalizeText(query);

  if (/(e-paper|epaper|अखबार|ई पेपर|ई-पेपर|pdf)/i.test(normalized)) {
    return 'epaper';
  }

  if (/(video|watch|वीडियो|देखें|देखो)/i.test(normalized)) {
    return 'video';
  }

  if (/(mojo|short|shorts|फटाफट|मोजो)/i.test(normalized)) {
    return 'story';
  }

  return 'article';
}

function inferPreferredCategory(query: string, candidates: IndexedContent[]) {
  const normalizedQuery = normalizeText(query);

  const matchedCategory = NEWS_CATEGORIES.find((category) => {
    const possibleNames = [
      category.slug,
      category.name,
      category.nameEn,
      ...category.aliases,
    ].map((value) => normalizeText(value));

    return possibleNames.some((value) => value && normalizedQuery.includes(value));
  });

  if (matchedCategory) {
    return matchedCategory.name;
  }

  const topArticle = candidates.find((item) => item.type === 'article');
  return topArticle?.category || '';
}

function getCategoryDisplayName(category: string, language: 'hi' | 'en') {
  if (!category) {
    return language === 'hi' ? 'मुख्य' : 'main';
  }

  const resolved = resolveNewsCategory(category);
  if (!resolved) {
    return category;
  }

  return language === 'hi' ? resolved.name : resolved.nameEn;
}

function buildFallbackContent(
  allContent: IndexedContent[],
  preferredType: ContentType,
  preferredCategory: string
) {
  const sorted = sortByUtility(allContent);
  const preferredMatches = sorted.filter(
    (item) =>
      item.type === preferredType &&
      categoryMatches(item.category, preferredCategory)
  );
  const sameType = sorted.filter(
    (item) => item.type === preferredType && !preferredMatches.includes(item)
  );
  const relatedArticles = sorted.filter(
    (item) => item.type === 'article' && categoryMatches(item.category, preferredCategory)
  );
  const generalArticles = sorted.filter(
    (item) => item.type === 'article' && !relatedArticles.includes(item)
  );

  return trimGroupedContent([
    ...preferredMatches,
    ...sameType,
    ...relatedArticles,
    ...generalArticles,
  ]);
}

function isLikelyOffTopicQuery(query: string) {
  return OFF_TOPIC_PATTERNS.some((pattern) => pattern.test(query));
}

function createSearchResponse(params: {
  answer: string;
  answerSource: AnswerSource;
  groupedContent: GroupedContent;
  confidence: 'high' | 'medium' | 'low';
  followUpSuggestion: string;
  query: string;
  primaryAction?: SearchPrimaryAction | null;
  mode: string;
}): SearchResponseBody {
  const primaryAction = params.primaryAction || null;
  const legacyArticleResults = params.groupedContent.articles.map(toLegacyArticleResult);

  return {
    success: true,
    answer: params.answer,
    answerSource: params.answerSource,
    content: params.groupedContent,
    confidence: params.confidence,
    followUpSuggestion: params.followUpSuggestion,
    primaryAction,
    query: params.query,
    data: {
      answer: params.answer,
      answerSource: params.answerSource,
      mode: params.mode,
      results: legacyArticleResults,
      content: params.groupedContent,
      confidence: params.confidence,
      followUpSuggestion: params.followUpSuggestion,
      primaryAction,
    },
  };
}

function buildEmptyDatabaseResponse(
  query: string,
  language: 'hi' | 'en'
): SearchResponseBody {
  return createSearchResponse({
    answer:
      language === 'hi'
        ? 'लोकस्वामी AI आपकी सेवा में तैयार है! आज की ताज़ा खबरों के लिए हमारा न्यूज़रूम देखें।'
        : 'Lokswami AI is ready for you. Explore today’s newsroom for the latest updates.',
    answerSource: 'empty_database',
    groupedContent: emptyGroupedContent(),
    confidence: 'low',
    followUpSuggestion:
      language === 'hi'
        ? 'क्या आप आज की बड़ी खबरें देखना चाहेंगे?'
        : 'Would you like to explore today’s top stories?',
    query,
    primaryAction: {
      label: language === 'hi' ? 'न्यूज़रूम देखें →' : 'Open Newsroom →',
      url: '/main',
    },
    mode: 'empty-database',
  });
}

function buildOffTopicResponse(
  query: string,
  language: 'hi' | 'en'
): SearchResponseBody {
  return createSearchResponse({
    answer:
      language === 'hi'
        ? 'मैं खबरों का AI हूं! आप मुझसे राजनीति, खेल, मनोरंजन, व्यापार या किसी भी ताज़ा खबर के बारे में पूछ सकते हैं। क्या आप आज की कोई बड़ी खबर जानना चाहते हैं?'
        : 'I am a news AI. Ask me about politics, sports, entertainment, business, or any major headline today. Would you like a fresh update now?',
    answerSource: 'refused',
    groupedContent: emptyGroupedContent(),
    confidence: 'medium',
    followUpSuggestion:
      language === 'hi'
        ? 'आज की टॉप हेडलाइंस दिखाइए'
        : 'Show me the top headlines today.',
    query,
    mode: 'off-topic-redirect',
  });
}

function buildErrorFallbackResponse(
  query: string,
  language: 'hi' | 'en'
): SearchResponseBody {
  return createSearchResponse({
    answer:
      language === 'hi'
        ? 'थोड़ी तकनीकी परेशानी है, एक पल में दोबारा कोशिश करें! 🔄'
        : 'There is a brief technical hiccup. Please try again in a moment! 🔄',
    answerSource: 'error_fallback',
    groupedContent: emptyGroupedContent(),
    confidence: 'low',
    followUpSuggestion:
      language === 'hi'
        ? 'क्या आप दोबारा कोशिश करना चाहेंगे?'
        : 'Would you like to try again?',
    query,
    mode: 'technical-fallback',
  });
}

function buildRelatedCoverageResponse(params: {
  query: string;
  language: 'hi' | 'en';
  allContent: IndexedContent[];
  candidates: IndexedContent[];
  leadText?: string;
  mode: 'related_category' | 'category_redirect';
}): SearchResponseBody {
  const preferredType = inferPreferredContentType(params.query);
  const preferredCategory = inferPreferredCategory(params.query, params.candidates);
  const groupedContent = buildFallbackContent(
    params.allContent,
    preferredType,
    preferredCategory
  );
  const categoryLabel = getCategoryDisplayName(preferredCategory, params.language);
  const leadText = params.leadText ? `${params.leadText.trim()} ` : '';

  const answer =
    params.mode === 'category_redirect'
      ? params.language === 'hi'
        ? `${leadText}इस विषय की सटीक जानकारी के लिए हमारे ${categoryLabel} सेक्शन में देखें। यहाँ कुछ संबंधित खबरें हैं:`
        : `${leadText}For precise updates on this topic, explore our ${categoryLabel} section. Here are a few related stories:`
      : params.language === 'hi'
        ? `${leadText}इस विषय पर हमारी टीम जल्द खबर लाएगी! अभी आप ${categoryLabel} की ताज़ा खबरें लोकस्वामी पर पढ़ सकते हैं।`
        : `${leadText}Our newsroom is tracking this topic closely. For now, you can explore the latest ${categoryLabel} coverage on Lokswami.`;

  const followUpSuggestion =
    params.language === 'hi'
      ? `${categoryLabel} की और खबरें दिखाइए`
      : `Show me more ${categoryLabel} updates.`;

  return createSearchResponse({
    answer,
    answerSource: params.mode,
    groupedContent,
    confidence: 'medium',
    followUpSuggestion,
    query: params.query,
    mode: params.mode,
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as SearchRequestBody;
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  const language = body.language === 'en' ? 'en' : 'hi';
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const limit = parseLimit(body.limit);

  if (!query) {
    return NextResponse.json(
      { success: false, error: 'Query is required' },
      { status: 400 }
    );
  }

  if (!isGeminiConfigured()) {
    return NextResponse.json(buildErrorFallbackResponse(query, language));
  }

  try {
    let queryEmbedding: number[] = [];
    try {
      queryEmbedding = await withTimeout(generateEmbedding(query), 5000, 'Gemini embedding');
    } catch (error) {
      console.warn('[AI Search] Query embedding failed, using lexical fallback:', error);
    }

    let fullContent: IndexedContent[] = [];
    try {
      fullContent = await withTimeout(
        fetchAllIndexedContent(),
        6000,
        'content index fetch'
      );
    } catch (error) {
      console.warn('[AI Search] Content index fetch failed, using graceful fallback:', error);
      fullContent = [];
    }
    const allContent = applyCategoryFilter(fullContent, category);
    const articlePool = fullContent.filter((item) => item.type === 'article');

    if (!articlePool.length) {
      return NextResponse.json(buildEmptyDatabaseResponse(query, language));
    }

    if (isLikelyOffTopicQuery(query)) {
      return NextResponse.json(buildOffTopicResponse(query, language));
    }

    const scoredContent = allContent
      .map((content) => {
        const hasComparableEmbedding =
          queryEmbedding.length > 0 &&
          content.embedding.length > 0 &&
          content.embedding.length === queryEmbedding.length;

        const vectorScore = hasComparableEmbedding
          ? cosineSimilarity(queryEmbedding, content.embedding)
          : 0;
        const textScore = lexicalScore(query, content);
        const score =
          (hasComparableEmbedding ? vectorScore * 0.88 : 0) +
          (!hasComparableEmbedding ? textScore : textScore * 0.22) +
          recencyBoost(content.date) +
          popularityBoost(content);

        return {
          ...content,
          similarityScore: Number(score.toFixed(4)),
        };
      })
      .filter((content) => (content.similarityScore || 0) > 0)
      .sort((left, right) => (right.similarityScore || 0) - (left.similarityScore || 0));

    const topContent = scoredContent.slice(0, Math.max(limit, 10));
    const groupedForPrompt = groupContent(topContent);

    const languageInstruction =
      language === 'hi'
        ? 'Respond in Hindi (Devanagari script).'
        : 'Respond in English.';

    const prompt = `${LOKSWAMI_SYSTEM_PROMPT}

${languageInstruction}

LOKSWAMI CONTENT (sorted by relevance):

ARTICLES (${groupedForPrompt.articles.length}):
${buildContentSection(groupedForPrompt.articles)}

E-PAPERS (${groupedForPrompt.epapers.length}):
${buildContentSection(groupedForPrompt.epapers)}

VIDEOS (${groupedForPrompt.videos.length}):
${buildContentSection(groupedForPrompt.videos)}

MOJO SHORTS (${groupedForPrompt.stories.length}):
${buildContentSection(groupedForPrompt.stories)}

User Question: ${query}

Choose the best relevant Lokswami content from any type above.
- If the user asks about reading a newspaper, prefer e-paper.
- If the user asks about watching, prefer videos.
- If the user wants a quick update or Mojo style story, prefer Mojo shorts.
- If the user is off-topic, gently redirect to news and set answerSource to "refused".
- If exact coverage is thin, answer briefly with best-effort general news knowledge and set answerSource to "general_knowledge" or "related_category".

Respond ONLY in valid JSON:
{
  "answer": "answer here",
  "answerSource": "cms_articles",
  "relevantContent": [
    { "id": "id1", "type": "article" },
    { "id": "id2", "type": "video" }
  ],
  "confidence": "high",
  "followUpSuggestion": "follow up question"
}`;

    let aiResponse: GeminiSearchResponse;
    try {
      aiResponse = await withTimeout(
        generateJSON<GeminiSearchResponse>(prompt),
        9000,
        'Gemini search response'
      );
    } catch (error) {
      console.warn('[AI Search] Gemini response failed, using positive fallback:', error);
      return NextResponse.json(
        buildRelatedCoverageResponse({
          query,
          language,
          allContent: allContent.length ? allContent : fullContent,
          candidates: topContent.length ? topContent : sortByUtility(articlePool),
          mode: topContent.length ? 'category_redirect' : 'related_category',
        })
      );
    }
    const normalizedAnswerSource =
      normalizeAnswerSource(aiResponse.answerSource) ||
      (topContent.length ? 'cms_articles' : 'general_knowledge');
    const relevantKeys = new Set(
      Array.isArray(aiResponse.relevantContent)
        ? aiResponse.relevantContent
            .filter(
              (item): item is GeminiRelevantContent =>
                Boolean(
                  item && typeof item.id === 'string' && typeof item.type === 'string'
                )
            )
            .map((item) => `${item.type}:${item.id}`)
        : []
    );

    const groupedContent =
      relevantKeys.size > 0
        ? trimGroupedContent(
            topContent.filter((item) => relevantKeys.has(`${item.type}:${item.id}`))
          )
        : trimGroupedContent(topContent);

    const sanitizedAnswer = ensurePositiveEnding(
      sanitizeAIResponse(typeof aiResponse.answer === 'string' ? aiResponse.answer : ''),
      language
    );
    const confidence = normalizeConfidence(aiResponse.confidence);
    const followUpSuggestion =
      typeof aiResponse.followUpSuggestion === 'string' && aiResponse.followUpSuggestion.trim()
        ? aiResponse.followUpSuggestion.trim()
        : language === 'hi'
          ? 'क्या आप इस विषय की और खबरें देखना चाहेंगे?'
          : 'Would you like to explore more coverage on this topic?';

    if (normalizedAnswerSource === 'refused') {
      return NextResponse.json(buildOffTopicResponse(query, language));
    }

    if (!hasGroupedContent(groupedContent)) {
      const fallbackMode = topContent.length > 0 ? 'category_redirect' : 'related_category';

      return NextResponse.json(
        buildRelatedCoverageResponse({
          query,
          language,
          allContent: allContent.length ? allContent : fullContent,
          candidates: topContent.length ? topContent : sortByUtility(articlePool),
          leadText:
            normalizedAnswerSource === 'general_knowledge' && sanitizedAnswer
              ? sanitizedAnswer
              : undefined,
          mode: fallbackMode,
        })
      );
    }

    const answerSource =
      hasNegativeLanguage(typeof aiResponse.answer === 'string' ? aiResponse.answer : '') &&
      normalizedAnswerSource === 'cms_articles'
        ? 'category_redirect'
        : normalizedAnswerSource;

    return NextResponse.json(
      createSearchResponse({
        answer: sanitizedAnswer,
        answerSource,
        groupedContent,
        confidence,
        followUpSuggestion,
        query,
        mode: 'multi-content-rag',
      })
    );
  } catch (error) {
    console.error('[AI Search] Error:', error);
    return NextResponse.json(buildErrorFallbackResponse(query, language));
  }
}
