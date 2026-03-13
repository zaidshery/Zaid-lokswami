'use server';

import type { ContentType } from '@/lib/ai/contentEmbedder';
import { fetchAllIndexedContent, type IndexedContent } from '@/lib/ai/contentIndex';
import { cosineSimilarity, generateEmbedding } from '@/lib/ai/embeddings';
import {
  generateJSON,
  isGeminiConfigured,
  LOKSWAMI_SYSTEM_PROMPT,
} from '@/lib/ai/gemini';
import { NEWS_CATEGORIES, resolveNewsCategory } from '@/lib/constants/newsCategories';

export interface SearchRequestBody {
  query?: string;
  category?: string;
  limit?: number;
  sortBy?: 'relevance' | 'latest' | 'popular';
  language?: 'hi' | 'en';
}

export type AnswerSource =
  | 'cms_articles'
  | 'general_knowledge'
  | 'related_category'
  | 'category_redirect'
  | 'refused'
  | 'empty_database'
  | 'error_fallback';

type GeminiRelevantContent = {
  id: string;
  type: ContentType;
};

type GeminiSearchResponse = {
  headline?: string;
  summary?: string;
  answer?: string;
  keyPoints?: string[];
  whyItMatters?: string;
  relatedQuestions?: string[];
  answerSource?: string;
  relevantContent?: GeminiRelevantContent[];
  confidence?: 'high' | 'medium' | 'low';
};

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

export type SearchStructuredAnswer = {
  headline: string;
  summary: string;
  keyPoints: string[];
  whyItMatters: string;
  relatedQuestions: string[];
  fallbackNote?: string;
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

export type SearchResponseBody = {
  success: true;
  answer: string;
  answerSource: AnswerSource;
  content: GroupedContent;
  confidence: 'high' | 'medium' | 'low';
  followUpSuggestion: string;
  primaryAction: SearchPrimaryAction | null;
  structuredAnswer: SearchStructuredAnswer;
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
    structuredAnswer: SearchStructuredAnswer;
  };
};

type PriorityLocation = {
  id: string;
  labelEn: string;
  labelHi: string;
  aliases: string[];
  explicitBoost: number;
  defaultBoost: number;
};

const PRIORITY_LOCATIONS: PriorityLocation[] = [
  {
    id: 'indore',
    labelEn: 'Indore',
    labelHi: 'इंदौर',
    aliases: ['indore', 'इंदौर'],
    explicitBoost: 0.22,
    defaultBoost: 0.08,
  },
  {
    id: 'madhya-pradesh',
    labelEn: 'Madhya Pradesh',
    labelHi: 'मध्य प्रदेश',
    aliases: ['madhya pradesh', 'madhyapradesh', 'mp', 'm p', 'मध्य प्रदेश', 'मध्यप्रदेश', 'एमपी'],
    explicitBoost: 0.2,
    defaultBoost: 0.07,
  },
  {
    id: 'delhi',
    labelEn: 'Delhi',
    labelHi: 'दिल्ली',
    aliases: ['delhi', 'new delhi', 'दिल्ली', 'नई दिल्ली'],
    explicitBoost: 0.18,
    defaultBoost: 0.06,
  },
  {
    id: 'mumbai',
    labelEn: 'Mumbai',
    labelHi: 'मुंबई',
    aliases: ['mumbai', 'bombay', 'मुंबई', 'बॉम्बे'],
    explicitBoost: 0.18,
    defaultBoost: 0.06,
  },
];

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
  /\bromantic\b/i,
  /\blove letter\b/i,
  /चुटकुल/i,
  /कविता/i,
  /गणित/i,
  /होमवर्क/i,
  /कोड/i,
  /ईमेल/i,
  /लव लेटर/i,
];

const QUERY_STOP_WORDS = new Set([
  'news',
  'khabar',
  'khabarein',
  'khabren',
  'update',
  'updates',
  'latest',
  'today',
  'aaj',
  'ki',
  'ka',
  'ke',
  'mere',
  'mera',
  'meri',
  'me',
  'mein',
  'in',
  'local',
  'city',
  'shehar',
  'top',
  'breaking',
  'headline',
  'headlines',
  'show',
  'open',
  'please',
  'kholen',
  'batao',
  'bataiye',
]);

const NON_LOCATION_HINTS = new Set([
  'politics',
  'sports',
  'business',
  'entertainment',
  'tech',
  'technology',
  'world',
  'national',
  'international',
  'regional',
  'market',
  'stock',
  'economy',
  'ipl',
  'cricket',
  'video',
  'epaper',
]);

function normalizeLooseText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string) {
  return normalizeLooseText(value).match(/[\p{L}\p{N}]+/gu) || [];
}

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').replace(/\p{Extended_Pictographic}/gu, '').trim();
}

function cleanLine(value: unknown, fallback = '') {
  return typeof value === 'string' && cleanText(value) ? cleanText(value) : fallback;
}

function uniqueList(items: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const item of items) {
    const normalized = normalizeLooseText(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(item);
  }

  return output;
}

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

function toTitleCase(value: string) {
  return value.replace(/\b([a-z])/g, (char) => char.toUpperCase());
}

function cleanLocationLabel(value: string) {
  const tokens = value
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !QUERY_STOP_WORDS.has(normalizeLooseText(token)));

  if (!tokens.length) {
    return '';
  }

  const collapsed = tokens.join(' ');

  if (/^[a-z][a-z\s-]*$/i.test(collapsed)) {
    return toTitleCase(collapsed.toLowerCase());
  }

  return collapsed;
}

function isLikelyLocationLabel(value: string) {
  const tokens = tokenize(value);
  if (!tokens.length || tokens.length > 3) {
    return false;
  }

  return !tokens.some((token) => NON_LOCATION_HINTS.has(token));
}

function extractLocationHint(query: string): string | null {
  if (!query.trim()) {
    return null;
  }

  const beforeNewsMatch = query.match(
    /([\p{L}][\p{L}\s-]{1,40})\s+(?:news|updates?|khabar(?:e|ein)?)/iu
  );
  const prepositionMatch = query.match(
    /(?:in|from|near|around|of|mein|me)\s+([\p{L}][\p{L}\s-]{1,40})/iu
  );

  const patternCandidate = cleanLocationLabel(
    beforeNewsMatch?.[1] || prepositionMatch?.[1] || ''
  );
  if (patternCandidate && isLikelyLocationLabel(patternCandidate)) {
    return patternCandidate;
  }

  const candidateTokens = tokenize(query)
    .filter((token) => !QUERY_STOP_WORDS.has(token))
    .filter((token) => !NON_LOCATION_HINTS.has(token));

  if (candidateTokens.length === 1) {
    const single = cleanLocationLabel(candidateTokens[0]);
    return single && isLikelyLocationLabel(single) ? single : null;
  }

  if (candidateTokens.length === 2) {
    const joined = cleanLocationLabel(candidateTokens.join(' '));
    return joined && isLikelyLocationLabel(joined) ? joined : null;
  }

  return null;
}

function containsLoosePhrase(haystack: string, phrase: string) {
  const normalizedHaystack = ` ${normalizeLooseText(haystack)} `;
  const normalizedPhrase = normalizeLooseText(phrase);
  if (!normalizedPhrase) return false;
  return normalizedHaystack.includes(` ${normalizedPhrase} `);
}

function contentSearchText(content: IndexedContent) {
  return [
    content.title,
    content.description,
    content.category,
    content.url,
    ...(content.tags || []),
  ].join(' ');
}

function findExplicitPriorityLocation(query: string) {
  return PRIORITY_LOCATIONS.find((location) =>
    location.aliases.some((alias) => containsLoosePhrase(query, alias))
  );
}

function contentMatchesPriorityLocation(content: IndexedContent, location: PriorityLocation) {
  const haystack = contentSearchText(content);
  return location.aliases.some((alias) => containsLoosePhrase(haystack, alias));
}

function contentMatchesLocationLabel(content: IndexedContent, label: string) {
  return containsLoosePhrase(contentSearchText(content), label);
}

function locationPriorityBoost(query: string, content: IndexedContent) {
  const explicitPriorityLocation = findExplicitPriorityLocation(query);
  const genericLocationHint = extractLocationHint(query);

  if (explicitPriorityLocation) {
    return contentMatchesPriorityLocation(content, explicitPriorityLocation)
      ? explicitPriorityLocation.explicitBoost
      : 0;
  }

  if (genericLocationHint) {
    return contentMatchesLocationLabel(content, genericLocationHint) ? 0.16 : 0;
  }

  let boost = 0;
  for (const location of PRIORITY_LOCATIONS) {
    if (contentMatchesPriorityLocation(content, location)) {
      boost = Math.max(boost, location.defaultBoost);
    }
  }

  return boost;
}

function lexicalScore(query: string, content: IndexedContent) {
  const haystack = normalizeLooseText(contentSearchText(content));
  const tokens = tokenize(query);

  if (!tokens.length || !haystack) {
    return 0;
  }

  let score = 0;

  for (const token of tokens) {
    if (!token) continue;
    if (containsLoosePhrase(haystack, token)) {
      score += containsLoosePhrase(content.title, token) ? 0.18 : 0.1;
    }
  }

  if (containsLoosePhrase(haystack, query)) {
    score += 0.22;
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

function applyCategoryFilter(items: IndexedContent[], category: string) {
  const normalizedCategory = normalizeLooseText(category);
  if (!normalizedCategory || normalizedCategory === 'all') {
    return items;
  }

  return items.filter((item) =>
    normalizeLooseText(item.category).includes(normalizedCategory)
  );
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

function trimGroupedContent(items: IndexedContent[]) {
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
        const date = item.date ? ` | Date: ${item.date.slice(0, 10)}` : '';
        const tags = item.tags?.length ? ` | Tags: ${item.tags.join(', ')}` : '';
        return `- [${(item.similarityScore || 0).toFixed(2)}] ${item.title} (${item.category}) | ID: ${item.id}${date}${tags}`;
      })
      .join('\n') || '- none'
  );
}

function isLikelyOffTopicQuery(query: string) {
  return OFF_TOPIC_PATTERNS.some((pattern) => pattern.test(query));
}

function inferPreferredContentType(query: string): ContentType {
  const normalized = normalizeLooseText(query);

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
  const normalizedQuery = normalizeLooseText(query);

  const matchedCategory = NEWS_CATEGORIES.find((category) => {
    const possibleNames = [
      category.slug,
      category.name,
      category.nameEn,
      ...category.aliases,
    ].map((value) => normalizeLooseText(value));

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

function deriveHeadline(query: string, language: 'hi' | 'en') {
  const locationHint = extractLocationHint(query);
  if (locationHint) {
    return language === 'hi'
      ? `${locationHint} से जुड़ी मुख्य अपडेट`
      : `${locationHint} update`;
  }

  const category = inferPreferredCategory(query, []);
  if (category) {
    const displayCategory = getCategoryDisplayName(category, language);
    return language === 'hi'
      ? `${displayCategory} की मुख्य बात`
      : `${displayCategory} update`;
  }

  return language === 'hi' ? 'Lokswami AI अपडेट' : 'Lokswami AI update';
}

function buildDefaultRelatedQuestions(query: string, language: 'hi' | 'en', category = '') {
  const locationHint = extractLocationHint(query);
  const displayCategory = getCategoryDisplayName(category, language);

  if (locationHint) {
    return language === 'hi'
      ? [
          `${locationHint} की आज की मुख्य खबरें क्या हैं?`,
          `${locationHint} में यह खबर क्यों महत्वपूर्ण है?`,
          `${locationHint} से जुड़ी और अपडेट दिखाइए`,
        ]
      : [
          `What are the top headlines from ${locationHint} today?`,
          `Why does this matter in ${locationHint}?`,
          `Show me more updates from ${locationHint}.`,
        ];
  }

  if (category) {
    return language === 'hi'
      ? [
          `${displayCategory} की आज की मुख्य खबरें क्या हैं?`,
          `इस ${displayCategory} खबर को सरल भाषा में समझाइए`,
          `${displayCategory} की और कवरेज दिखाइए`,
        ]
      : [
          `What are the top ${displayCategory} headlines today?`,
          `Explain this ${displayCategory} news simply.`,
          `Show me more ${displayCategory} coverage.`,
        ];
  }

  return language === 'hi'
    ? [
        'आज की मुख्य खबरें क्या हैं?',
        'यह खबर सरल भाषा में समझाइए',
        'आज की और बड़ी अपडेट दिखाइए',
      ]
    : [
        "What are today's main headlines?",
        'Explain this news simply.',
        'Show me more major updates today.',
      ];
}

function normalizeQuestions(
  value: unknown,
  query: string,
  language: 'hi' | 'en',
  category: string
) {
  const source = Array.isArray(value)
    ? value.map((item) => cleanLine(item)).filter(Boolean)
    : [];
  const defaults = buildDefaultRelatedQuestions(query, language, category);
  return uniqueList([...source, ...defaults]).slice(0, 3);
}

function normalizeKeyPoints(value: unknown, fallback: string, language: 'hi' | 'en') {
  const source = Array.isArray(value)
    ? value.map((item) => cleanLine(item)).filter(Boolean)
    : [];

  if (source.length >= 3) {
    return source.slice(0, 5);
  }

  const defaultPoints =
    language === 'hi'
      ? [
          fallback || 'यह विषय तेजी से विकसित हो रहा है।',
          'उपलब्ध जानकारी के आधार पर यह एक महत्वपूर्ण अपडेट है।',
          'ताज़ा पुष्टि के लिए विश्वसनीय कवरेज देखते रहें।',
        ]
      : [
          fallback || 'This topic is still moving quickly.',
          'Available information suggests this is an important update.',
          'Keep following verified coverage for fresh confirmation.',
        ];

  return uniqueList([...source, ...defaultPoints]).slice(0, 3);
}

function composeAnswerText(answer: SearchStructuredAnswer, language: 'hi' | 'en') {
  const headlineLabel = language === 'hi' ? 'शीर्षक' : 'Headline';
  const keyPointsLabel = language === 'hi' ? 'मुख्य बिंदु' : 'Key Points';
  const whyItMattersLabel = language === 'hi' ? 'क्यों महत्वपूर्ण है' : 'Why it matters';
  const relatedQuestionsLabel = language === 'hi' ? 'संबंधित सवाल' : 'Related questions';
  const noteLabel = language === 'hi' ? 'नोट' : 'Note';

  const sections = [
    `${headlineLabel}:`,
    answer.headline,
    '',
    answer.summary,
    '',
    `${keyPointsLabel}:`,
    ...answer.keyPoints.map((point) => `- ${point}`),
  ];

  if (answer.whyItMatters) {
    sections.push('', `${whyItMattersLabel}:`, answer.whyItMatters);
  }

  if (answer.fallbackNote) {
    sections.push('', `${noteLabel}:`, answer.fallbackNote);
  }

  sections.push(
    '',
    `${relatedQuestionsLabel}:`,
    ...answer.relatedQuestions.map((question) => `- ${question}`)
  );

  return sections.join('\n').trim();
}

function pickPrimaryAction(groupedContent: GroupedContent, language: 'hi' | 'en') {
  const firstItem =
    groupedContent.articles[0] ||
    groupedContent.epapers[0] ||
    groupedContent.videos[0] ||
    groupedContent.stories[0];

  if (!firstItem) return null;

  if (firstItem.type === 'epaper') {
    return {
      label: language === 'hi' ? 'ई-पेपर खोलें' : 'Open e-paper',
      url: firstItem.url,
    };
  }

  if (firstItem.type === 'video' || firstItem.type === 'story') {
    return {
      label: language === 'hi' ? 'वीडियो देखें' : 'Watch coverage',
      url: firstItem.url,
    };
  }

  return {
    label: language === 'hi' ? 'पूरी खबर पढ़ें' : 'Read full story',
    url: firstItem.url,
  };
}

function createSearchResponse(params: {
  query: string;
  language: 'hi' | 'en';
  answerSource: AnswerSource;
  groupedContent: GroupedContent;
  confidence: 'high' | 'medium' | 'low';
  structuredAnswer: SearchStructuredAnswer;
  mode: string;
  primaryAction?: SearchPrimaryAction | null;
}): SearchResponseBody {
  const primaryAction = params.primaryAction || null;
  const followUpSuggestion = params.structuredAnswer.relatedQuestions[0] || '';
  const answer = composeAnswerText(params.structuredAnswer, params.language);
  const legacyArticleResults = params.groupedContent.articles.map(toLegacyArticleResult);

  return {
    success: true,
    answer,
    answerSource: params.answerSource,
    content: params.groupedContent,
    confidence: params.confidence,
    followUpSuggestion,
    primaryAction,
    structuredAnswer: params.structuredAnswer,
    query: params.query,
    data: {
      answer,
      answerSource: params.answerSource,
      mode: params.mode,
      results: legacyArticleResults,
      content: params.groupedContent,
      confidence: params.confidence,
      followUpSuggestion,
      primaryAction,
      structuredAnswer: params.structuredAnswer,
    },
  };
}

function buildEmptyDatabaseResponse(query: string, language: 'hi' | 'en') {
  return createSearchResponse({
    query,
    language,
    answerSource: 'empty_database',
    groupedContent: emptyGroupedContent(),
    confidence: 'low',
    structuredAnswer: {
      headline: language === 'hi' ? 'न्यूज़रूम अपडेट अभी उपलब्ध नहीं' : 'Newsroom updates are not available yet',
      summary:
        language === 'hi'
          ? 'लोकस्वामी की AI सेवा तैयार है, लेकिन इस समय प्रकाशित न्यूज़ डेटा उपलब्ध नहीं है।'
          : 'Lokswami AI is ready, but published newsroom data is not available right now.',
      keyPoints:
        language === 'hi'
          ? [
              'फिलहाल प्रकाशित कंटेंट उपलब्ध नहीं है।',
              'नई खबरें आते ही यह सहायक उन्हें दिखाएगा।',
              'थोड़ी देर बाद फिर कोशिश करें।',
            ]
          : [
              'Published content is not available at the moment.',
              'Fresh stories will appear here as they are published.',
              'Please try again shortly.',
            ],
      whyItMatters:
        language === 'hi'
          ? 'यह सहायक लोकस्वामी की प्रकाशित कवरेज पर आधारित है, इसलिए ताज़ा कंटेंट उपलब्ध होना जरूरी है।'
          : 'This assistant depends on Lokswami coverage, so published newsroom content needs to be available first.',
      relatedQuestions: buildDefaultRelatedQuestions(query, language),
      fallbackNote:
        language === 'hi'
          ? 'जानकारी अभी और विकसित हो सकती है।'
          : 'Information may still be developing.',
    },
    mode: 'empty-database',
    primaryAction: {
      label: language === 'hi' ? 'न्यूज़रूम खोलें' : 'Open newsroom',
      url: '/main',
    },
  });
}

function buildOffTopicResponse(query: string, language: 'hi' | 'en') {
  return createSearchResponse({
    query,
    language,
    answerSource: 'refused',
    groupedContent: emptyGroupedContent(),
    confidence: 'medium',
    structuredAnswer: {
      headline: language === 'hi' ? 'मैं समाचार सहायक हूँ' : 'I am a news assistant',
      summary:
        language === 'hi'
          ? 'मैं राजनीति, अपराध, व्यापार, खेल, टेक्नोलॉजी और ताज़ा घटनाओं पर मदद कर सकता हूँ।'
          : 'I can help with politics, crime, business, sports, technology, and breaking news.',
      keyPoints:
        language === 'hi'
          ? [
              'यह चैट समाचार और लोकहित विषयों पर केंद्रित है।',
              'आप स्थानीय, राष्ट्रीय या अंतर्राष्ट्रीय अपडेट पूछ सकते हैं।',
              'मैं खबरों को सरल भाषा में भी समझा सकता हूँ।',
            ]
          : [
              'This chat focuses on news and public-affairs topics.',
              'You can ask about local, national, or international updates.',
              'I can also explain news in simpler language.',
            ],
      whyItMatters:
        language === 'hi'
          ? 'समाचार पर केंद्रित रहने से जवाब तेज, साफ और उपयोगी रहते हैं।'
          : 'Staying focused on news keeps the answers fast, clear, and useful.',
      relatedQuestions: buildDefaultRelatedQuestions('today news', language),
    },
    mode: 'off-topic-redirect',
  });
}

function buildErrorFallbackResponse(query: string, language: 'hi' | 'en') {
  return createSearchResponse({
    query,
    language,
    answerSource: 'error_fallback',
    groupedContent: emptyGroupedContent(),
    confidence: 'low',
    structuredAnswer: {
      headline: language === 'hi' ? 'तकनीकी दिक्कत' : 'Technical issue',
      summary:
        language === 'hi'
          ? 'अभी खोज प्रणाली में थोड़ी तकनीकी दिक्कत है। कृपया थोड़ी देर में फिर कोशिश करें।'
          : 'There is a brief technical issue in the news search system right now. Please try again shortly.',
      keyPoints:
        language === 'hi'
          ? [
              'यह अस्थायी समस्या लग रही है।',
              'आप थोड़ी देर बाद फिर से पूछ सकते हैं।',
              'लोकस्वामी की बाकी खबरें अभी भी उपलब्ध हैं।',
            ]
          : [
              'This appears to be a temporary issue.',
              'You can try the same question again shortly.',
              'The rest of Lokswami coverage remains available.',
            ],
      whyItMatters:
        language === 'hi'
          ? 'तकनीकी रुकावट के दौरान गलत या अधूरा जवाब देने से बेहतर है थोड़ी देर बाद फिर कोशिश करना।'
          : 'During a technical interruption, it is better to retry than receive an incomplete or unreliable answer.',
      relatedQuestions: buildDefaultRelatedQuestions(query, language),
      fallbackNote:
        language === 'hi'
          ? 'जानकारी अभी और विकसित हो सकती है।'
          : 'Information may still be developing.',
    },
    mode: 'technical-fallback',
  });
}

function buildFallbackStructuredAnswer(params: {
  query: string;
  language: 'hi' | 'en';
  summary?: string;
  keyPoints?: string[];
  whyItMatters?: string;
  headline?: string;
  category?: string;
}) {
  const summary =
    cleanLine(params.summary) ||
    (params.language === 'hi'
      ? 'लोकस्वामी पर इस विषय की सीधी कवरेज अभी सीमित है, इसलिए मैं उपलब्ध संकेतों के आधार पर संक्षिप्त टेक्स्ट अपडेट दे रहा हूँ।'
      : 'Direct Lokswami coverage on this topic is limited right now, so I am giving you a short text update based on available signals.');

  return {
    headline: cleanLine(params.headline) || deriveHeadline(params.query, params.language),
    summary,
    keyPoints: normalizeKeyPoints(params.keyPoints, summary, params.language),
    whyItMatters:
      cleanLine(params.whyItMatters) ||
      (params.language === 'hi'
        ? 'यह स्थिति अभी बदल सकती है, इसलिए आगे के अपडेट महत्वपूर्ण रहेंगे।'
        : 'This situation may still change, so fresh updates will remain important.'),
    relatedQuestions: normalizeQuestions(
      undefined,
      params.query,
      params.language,
      params.category || ''
    ),
    fallbackNote:
      params.language === 'hi'
        ? 'जानकारी अभी और विकसित हो सकती है।'
        : 'Information may still be developing.',
  };
}

function buildStructuredAnswerFromAi(params: {
  query: string;
  language: 'hi' | 'en';
  category: string;
  aiResponse: GeminiSearchResponse;
  answerSource: AnswerSource;
}) {
  const summary = cleanLine(params.aiResponse.summary) || cleanLine(params.aiResponse.answer);
  const keyPoints = normalizeKeyPoints(params.aiResponse.keyPoints, summary, params.language);
  const relatedQuestions = normalizeQuestions(
    params.aiResponse.relatedQuestions,
    params.query,
    params.language,
    params.category
  );

  return {
    headline: cleanLine(params.aiResponse.headline) || deriveHeadline(params.query, params.language),
    summary:
      summary ||
      (params.language === 'hi'
        ? 'यह विषय लोकस्वामी की उपलब्ध कवरेज और मौजूदा संदर्भ के आधार पर समझाया गया है।'
        : 'This topic is explained using available Lokswami coverage and current context.'),
    keyPoints,
    whyItMatters:
      cleanLine(params.aiResponse.whyItMatters) ||
      (params.language === 'hi'
        ? 'यह अपडेट स्थानीय और व्यापक संदर्भ में प्रभाव डाल सकती है, इसलिए इसके अगले चरणों पर नजर रखना जरूरी है।'
        : 'This update may matter both locally and more broadly, so the next developments are worth tracking closely.'),
    relatedQuestions,
    fallbackNote:
      params.answerSource !== 'cms_articles'
        ? params.language === 'hi'
          ? 'जानकारी अभी और विकसित हो सकती है।'
          : 'Information may still be developing.'
        : undefined,
  };
}

function scoreContent(
  query: string,
  queryEmbedding: number[],
  items: IndexedContent[]
): IndexedContent[] {
  return items
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
        (hasComparableEmbedding ? vectorScore * 0.82 : 0) +
        (!hasComparableEmbedding ? textScore : textScore * 0.3) +
        recencyBoost(content.date) +
        popularityBoost(content) +
        locationPriorityBoost(query, content);

      return {
        ...content,
        similarityScore: Number(score.toFixed(4)),
      };
    })
    .filter((content) => (content.similarityScore || 0) > 0.03)
    .sort((left, right) => (right.similarityScore || 0) - (left.similarityScore || 0));
}

function coverageLooksStrong(items: IndexedContent[]) {
  const strongest = items[0]?.similarityScore || 0;
  return strongest >= 0.12;
}

export async function searchLokswamiNews(
  rawBody: SearchRequestBody
): Promise<SearchResponseBody> {
  const query = typeof rawBody.query === 'string' ? rawBody.query.trim() : '';
  const language = rawBody.language === 'en' ? 'en' : 'hi';
  const category = typeof rawBody.category === 'string' ? rawBody.category.trim() : '';
  const limit = parseLimit(rawBody.limit);

  if (!query) {
    throw new Error('Query is required');
  }

  if (!isGeminiConfigured()) {
    return buildErrorFallbackResponse(query, language);
  }

  let queryEmbedding: number[] = [];
  try {
    queryEmbedding = await withTimeout(generateEmbedding(query), 5000, 'Gemini embedding');
  } catch (error) {
    console.warn(
      '[Lokswami AI Search] Query embedding failed, falling back to lexical scoring:',
      error
    );
  }

  let fullContent: IndexedContent[] = [];
  try {
    fullContent = await withTimeout(fetchAllIndexedContent(), 6000, 'content index fetch');
  } catch (error) {
    console.warn('[Lokswami AI Search] Content index fetch failed:', error);
  }

  const articlePool = fullContent.filter((item) => item.type === 'article');
  if (!articlePool.length) {
    return buildEmptyDatabaseResponse(query, language);
  }

  if (isLikelyOffTopicQuery(query)) {
    return buildOffTopicResponse(query, language);
  }

  const contentPool = applyCategoryFilter(fullContent, category);
  const scoredContent = scoreContent(query, queryEmbedding, contentPool);
  const topContent = scoredContent.slice(0, Math.max(limit, 10));
  const groupedForPrompt = groupContent(topContent.slice(0, 8));
  const preferredCategory = inferPreferredCategory(
    query,
    topContent.length ? topContent : articlePool
  );
  const preferredType = inferPreferredContentType(query);

  const languageInstruction =
    language === 'hi'
      ? 'Respond in Hindi using natural Devanagari. Keep the tone professional, clear, and neutral.'
      : 'Respond in English with a professional, neutral newsroom tone.';

  const prompt = `${LOKSWAMI_SYSTEM_PROMPT}

${languageInstruction}

LOKSWAMI COVERAGE (sorted by relevance):

ARTICLES (${groupedForPrompt.articles.length}):
${buildContentSection(groupedForPrompt.articles)}

E-PAPERS (${groupedForPrompt.epapers.length}):
${buildContentSection(groupedForPrompt.epapers)}

VIDEOS (${groupedForPrompt.videos.length}):
${buildContentSection(groupedForPrompt.videos)}

MOJO SHORTS (${groupedForPrompt.stories.length}):
${buildContentSection(groupedForPrompt.stories)}

User Question: ${query}
Preferred content type: ${preferredType}
Preferred category: ${preferredCategory || 'general'}

Instructions:
- Prioritize exact Lokswami coverage when it exists.
- If the user asks about a place, prioritize that geography first.
- Default editorial priority is: Indore, Madhya Pradesh, Delhi, Mumbai.
- If exact coverage is thin, answer briefly in text with high-level context and set answerSource to "general_knowledge" or "related_category".
- Never pretend unsupported facts came from Lokswami coverage.
- Keep the response concise, factual, and useful.
- Provide exactly 3 related questions.
- Do not use emojis.

Respond ONLY in valid JSON:
{
  "headline": "short headline",
  "summary": "one short explanatory paragraph",
  "keyPoints": ["point one", "point two", "point three"],
  "whyItMatters": "one short paragraph",
  "relatedQuestions": ["question 1", "question 2", "question 3"],
  "answerSource": "cms_articles",
  "relevantContent": [
    { "id": "id1", "type": "article" }
  ],
  "confidence": "high"
}`;

  let aiResponse: GeminiSearchResponse;
  try {
    aiResponse = await withTimeout(
      generateJSON<GeminiSearchResponse>(prompt),
      9000,
      'Gemini search response'
    );
  } catch (error) {
    console.warn('[Lokswami AI Search] Gemini response failed, using text fallback:', error);
    return createSearchResponse({
      query,
      language,
      answerSource: topContent.length ? 'related_category' : 'general_knowledge',
      groupedContent: emptyGroupedContent(),
      confidence: 'low',
      structuredAnswer: buildFallbackStructuredAnswer({
        query,
        language,
        category: preferredCategory,
      }),
      mode: 'text-fallback',
    });
  }

  const normalizedAnswerSource =
    normalizeAnswerSource(aiResponse.answerSource) ||
    (coverageLooksStrong(topContent) ? 'cms_articles' : 'general_knowledge');

  if (normalizedAnswerSource === 'refused') {
    return buildOffTopicResponse(query, language);
  }

  const relevantKeys = new Set(
    Array.isArray(aiResponse.relevantContent)
      ? aiResponse.relevantContent
          .filter(
            (item): item is GeminiRelevantContent =>
              Boolean(item && typeof item.id === 'string' && typeof item.type === 'string')
          )
          .map((item) => `${item.type}:${item.id}`)
      : []
  );

  const candidateCmsItems = relevantKeys.size
    ? topContent.filter((item) => relevantKeys.has(`${item.type}:${item.id}`))
    : topContent;
  const groupedContent =
    normalizedAnswerSource === 'cms_articles'
      ? trimGroupedContent(candidateCmsItems)
      : emptyGroupedContent();
  const cmsCoverageStrong =
    normalizedAnswerSource === 'cms_articles' &&
    coverageLooksStrong(candidateCmsItems.length ? candidateCmsItems : topContent) &&
    hasGroupedContent(groupedContent);

  if (!cmsCoverageStrong) {
    const structuredAnswer = buildStructuredAnswerFromAi({
      query,
      language,
      category: preferredCategory,
      aiResponse,
      answerSource:
        normalizedAnswerSource === 'cms_articles'
          ? 'general_knowledge'
          : normalizedAnswerSource,
    });

    return createSearchResponse({
      query,
      language,
      answerSource:
        normalizedAnswerSource === 'cms_articles'
          ? topContent.length
            ? 'related_category'
            : 'general_knowledge'
          : normalizedAnswerSource,
      groupedContent: emptyGroupedContent(),
      confidence: normalizeConfidence(aiResponse.confidence),
      structuredAnswer,
      mode: 'text-fallback',
    });
  }

  const structuredAnswer = buildStructuredAnswerFromAi({
    query,
    language,
    category: preferredCategory,
    aiResponse,
    answerSource: 'cms_articles',
  });

  return createSearchResponse({
    query,
    language,
    answerSource: 'cms_articles',
    groupedContent,
    confidence: normalizeConfidence(aiResponse.confidence),
    structuredAnswer,
    mode: 'multi-content-rag',
    primaryAction: pickPrimaryAction(groupedContent, language),
  });
}
