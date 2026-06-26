import {
  analyzeArticleSeo,
  normalizeArticleSeo,
  normalizeArticleSlug,
  isValidArticleSlug,
  stripArticleHtml,
  type ArticleSeoFields,
} from '@/lib/seo/articleSeo';
import { analyzeArticleEditorContent } from '@/lib/utils/articleEditorAnalysis';

export type ArticleAssistMode = 'create' | 'edit';
export type ArticleAssistLanguage = 'hi' | 'en';

export type ArticleAssistField =
  | 'title'
  | 'summary'
  | 'content'
  | 'category'
  | 'author'
  | 'image'
  | 'seoSlug'
  | 'seoTitle'
  | 'seoDescription'
  | 'focusKeyword'
  | 'secondaryKeywords'
  | 'featuredImageAlt'
  | 'featuredImageCaption'
  | 'imageCredit'
  | 'canonicalUrl'
  | 'authorProfileUrl'
  | 'isBreaking'
  | 'isTrending'
  | 'breakingAudio'
  | 'sourceInfo';

export type ArticleAssistPatch = {
  field: ArticleAssistField;
  currentValue: string;
  suggestedValue: string;
  reason: string;
};

export type ArticleAssistSuggestion = {
  id: string;
  label: string;
  value: string;
  reason: string;
};

export type ArticleReadinessItem = {
  id: string;
  label: string;
  status: 'done' | 'warning' | 'blocked' | 'todo';
  detail: string;
  field?: ArticleAssistField;
};

export type ArticleAssistInput = {
  mode?: ArticleAssistMode;
  title?: string;
  summary?: string;
  content?: string;
  category?: string;
  author?: string;
  image?: string;
  seoSlug?: string;
  seo?: Partial<ArticleSeoFields>;
  isBreaking?: boolean;
  isTrending?: boolean;
  language?: ArticleAssistLanguage;
  breakingAudioReady?: boolean;
  requireBreakingAudio?: boolean;
  listenAudioReady?: boolean;
  sourceInfo?: string;
  sourceStoryId?: string;
};

export type ArticleAssistResult = {
  suggestions: ArticleAssistSuggestion[];
  readiness: {
    score: number;
    items: ArticleReadinessItem[];
  };
  patches: ArticleAssistPatch[];
};

export type ArticleReadinessSummary = {
  score: number;
  total: number;
  done: ArticleReadinessItem[];
  blockers: ArticleReadinessItem[];
  warnings: ArticleReadinessItem[];
  todos: ArticleReadinessItem[];
  canSend: boolean;
};

const STOP_WORDS = new Set([
  'about',
  'after',
  'also',
  'and',
  'are',
  'aur',
  'hai',
  'hain',
  'into',
  'is',
  'kaha',
  'liye',
  'mein',
  'par',
  'said',
  'se',
  'the',
  'this',
  'with',
  'के',
  'की',
  'का',
  'को',
  'में',
  'से',
  'और',
  'है',
  'हैं',
]);

function cleanText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function clampText(value: string, maxLength: number) {
  const trimmed = cleanText(value);
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function splitSentences(value: string) {
  return cleanText(value)
    .split(/(?<=[.!?।])\s+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function textTokens(value: string) {
  return cleanText(value).match(/[\p{L}\p{M}\p{N}]+/gu) || [];
}

export function suggestArticleFocusKeyword(input: string) {
  const tokens = textTokens(input)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token.toLowerCase()));

  if (!tokens.length) return '';

  const counts = new Map<string, { label: string; count: number }>();
  tokens.forEach((token) => {
    const key = token.toLowerCase();
    const current = counts.get(key) || { label: token, count: 0 };
    current.count += 1;
    counts.set(key, current);
  });

  return [...counts.values()].sort((left, right) => right.count - left.count)[0]?.label || '';
}

export function suggestArticleSecondaryKeywords(input: string, focusKeyword = '') {
  const focus = focusKeyword.trim().toLowerCase();
  const seen = new Set<string>();
  const suggestions: string[] = [];

  textTokens(input).forEach((token) => {
    const key = token.toLowerCase();
    if (
      token.length <= 2 ||
      STOP_WORDS.has(key) ||
      key === focus ||
      seen.has(key)
    ) {
      return;
    }

    seen.add(key);
    suggestions.push(token);
  });

  return suggestions.slice(0, 5).join(', ');
}

function suggestSummary(input: Pick<ArticleAssistInput, 'title' | 'summary' | 'content'>) {
  const currentSummary = cleanText(input.summary);
  if (currentSummary.length >= 70) return currentSummary;

  const plainContent = stripArticleHtml(cleanText(input.content));
  const sentences = splitSentences(plainContent);
  const candidate = sentences.slice(0, 2).join(' ') || cleanText(input.title);

  return clampText(candidate, 260);
}

function addPatch(
  patches: ArticleAssistPatch[],
  field: ArticleAssistField,
  currentValue: unknown,
  suggestedValue: unknown,
  reason: string
) {
  const current = cleanText(currentValue);
  const suggested = cleanText(suggestedValue);
  if (!suggested || current === suggested) return;

  patches.push({
    field,
    currentValue: current,
    suggestedValue: suggested,
    reason,
  });
}

function readinessItem(
  id: string,
  label: string,
  done: boolean,
  input: {
    blocked?: boolean;
    warning?: boolean;
    doneDetail: string;
    todoDetail: string;
    field?: ArticleAssistField;
  }
): ArticleReadinessItem {
  return {
    id,
    label,
    status: done ? 'done' : input.blocked ? 'blocked' : input.warning ? 'warning' : 'todo',
    detail: done ? input.doneDetail : input.todoDetail,
    field: input.field,
  };
}

export function buildArticleAssistResult(input: ArticleAssistInput): ArticleAssistResult {
  const mode = input.mode === 'edit' ? 'edit' : 'create';
  const title = cleanText(input.title);
  const summary = cleanText(input.summary);
  const content = cleanText(input.content);
  const plainContent = stripArticleHtml(content);
  const category = cleanText(input.category);
  const author = cleanText(input.author);
  const image = cleanText(input.image);
  const sourceInfo = cleanText(input.sourceInfo);
  const sourceStoryId = cleanText(input.sourceStoryId);
  const seo = normalizeArticleSeo(input.seo);
  const insights = analyzeArticleEditorContent(content);
  const currentSlug = cleanText(input.seoSlug);
  const slug = normalizeArticleSlug(currentSlug || title);
  const suggestedSummary = suggestSummary({ title, summary, content });
  const suggestedKeyword = suggestArticleFocusKeyword(`${title} ${summary} ${plainContent}`);
  const effectiveKeyword = seo.focusKeyword || suggestedKeyword;
  const hasSourceSignal = Boolean(
    insights.linkCount > 0 ||
      insights.resourceCount > 0 ||
      sourceInfo ||
      sourceStoryId
  );
  const seoAnalysis = analyzeArticleSeo({
    title,
    summary,
    content,
    slug: currentSlug || slug,
    seo,
    hasFeaturedImage: Boolean(image),
    hasSourceOrExternalLink: hasSourceSignal,
  });
  const effectiveSeoTitle = seo.metaTitle || title;
  const effectiveSeoDescription = seo.metaDescription || summary || suggestedSummary;
  const effectiveImageAlt = seo.featuredImageAlt || (title ? `${title}${category ? ` - ${category}` : ''}` : '');
  const seoEssentialsReady = Boolean(
    effectiveSeoTitle.trim().length >= 20 &&
      effectiveSeoDescription.trim().length >= 70 &&
      isValidArticleSlug(currentSlug || slug) &&
      image &&
      effectiveImageAlt.trim()
  );

  const patches: ArticleAssistPatch[] = [];
  addPatch(patches, 'summary', summary, suggestedSummary, 'Use the lead paragraphs to fill a concise reader summary.');
  addPatch(patches, 'seoSlug', currentSlug, slug, 'Normalize the headline into a clean public URL slug.');
  addPatch(patches, 'seoTitle', seo.metaTitle, clampText(title, 70), 'Use the headline as a search-friendly title.');
  addPatch(
    patches,
    'seoDescription',
    seo.metaDescription,
    clampText(summary || suggestedSummary || plainContent, 155),
    'Turn the summary into a compact search result description.'
  );
  addPatch(
    patches,
    'focusKeyword',
    seo.focusKeyword,
    suggestedKeyword,
    'Extract the most repeated meaningful topic from the headline and copy.'
  );
  addPatch(
    patches,
    'secondaryKeywords',
    seo.secondaryKeywords,
    suggestArticleSecondaryKeywords(`${title} ${summary} ${plainContent}`, effectiveKeyword),
    'Collect supporting search topics without changing the article copy.'
  );
  addPatch(
    patches,
    'featuredImageAlt',
    seo.featuredImageAlt,
    title ? `${title}${category ? ` - ${category}` : ''}` : '',
    'Describe the featured image with the article topic for accessibility and SEO.'
  );
  addPatch(
    patches,
    'featuredImageCaption',
    seo.featuredImageCaption,
    summary || title,
    'Use the story summary as a starter image caption.'
  );

  const suggestions: ArticleAssistSuggestion[] = [
    {
      id: 'outline',
      label: 'Suggested H2 outline',
      value:
        insights.headingCount > 0
          ? insights.outline.map((item) => item.text).join(' • ')
          : [title, category ? `${category} context` : '', 'What happens next']
              .filter(Boolean)
              .join(' • '),
      reason: insights.headingCount > 0
        ? 'The article already has structure; use this to review flow.'
        : 'Add two or three H2 sections so readers can scan the story quickly.',
    },
    {
      id: 'social-copy',
      label: 'Social post starter',
      value: clampText([title, summary || suggestedSummary].filter(Boolean).join(' - '), 220),
      reason: 'A short approved draft can speed up social packaging after publish.',
    },
    {
      id: 'audio-script',
      label: 'Manual audio script starter',
      value: clampText([title, summary || suggestedSummary].filter(Boolean).join('. '), 260),
      reason: 'Keep audio manual, but give the team a clean recording script starter.',
    },
  ];

  const items: ArticleReadinessItem[] = [
    readinessItem('title', 'Headline', title.length >= 12, {
      blocked: true,
      doneDetail: 'Headline is present.',
      todoDetail: 'Add a specific headline before sending.',
      field: 'title',
    }),
    readinessItem('summary', 'Summary', summary.length >= 50, {
      blocked: true,
      doneDetail: 'Summary is ready for feeds.',
      todoDetail: 'Add a 50+ character reader summary.',
      field: 'summary',
    }),
    readinessItem('content', 'Article body', plainContent.length >= 120, {
      blocked: true,
      doneDetail: 'Article body has enough copy to review.',
      todoDetail: 'Add more body copy before publishing.',
      field: 'sourceInfo',
    }),
    readinessItem('category', 'Category', Boolean(category), {
      blocked: true,
      doneDetail: 'Category selected.',
      todoDetail: 'Select the article category.',
      field: 'category',
    }),
    readinessItem('author', 'Author', Boolean(author), {
      blocked: true,
      doneDetail: 'Author is set.',
      todoDetail: 'Add the author name.',
      field: 'author',
    }),
    readinessItem('image', 'Featured image', Boolean(image), {
      blocked: true,
      doneDetail: 'Featured image is ready.',
      todoDetail: 'Upload or keep a featured image.',
      field: 'image',
    }),
    readinessItem('seo', 'SEO package', seoEssentialsReady || seoAnalysis.score >= 70, {
      warning: true,
      doneDetail: seoEssentialsReady
        ? 'SEO essentials are auto-filled.'
        : `SEO score is ${seoAnalysis.score}%.`,
      todoDetail: `SEO score is ${seoAnalysis.score}%; add headline, summary, slug, or image alt metadata.`,
      field: 'seoTitle',
    }),
    readinessItem('source', 'Source or link', hasSourceSignal, {
      warning: true,
      doneDetail: sourceInfo || sourceStoryId
        ? 'Reporter/source handoff is included.'
        : 'Source or supporting link is included.',
      todoDetail: 'Add reporter source info, a resource card, or a relevant link.',
      field: 'content',
    }),
    readinessItem('headings', 'Scannable structure', insights.headingCount > 0, {
      warning: true,
      doneDetail: 'Heading structure is present.',
      todoDetail: 'Add H2/H3 headings for scan-friendly reading.',
      field: 'content',
    }),
  ];

  if (input.isBreaking) {
    const requireBreakingAudio = Boolean(input.requireBreakingAudio);
    items.push(
      readinessItem('breaking-audio', 'Breaking audio', Boolean(input.breakingAudioReady), {
        blocked: requireBreakingAudio,
        warning: !requireBreakingAudio,
        doneDetail: 'Breaking audio is ready or staged.',
        todoDetail: requireBreakingAudio
          ? 'Upload matching manual breaking audio before publishing.'
          : 'Upload matching manual breaking audio before final publish.',
        field: 'breakingAudio',
      })
    );
  }

  const completeWeight = items.reduce((score, item) => {
    if (item.status === 'done') return score + 1;
    if (item.status === 'warning') return score + 0.45;
    return score;
  }, 0);

  return {
    suggestions,
    readiness: {
      score: Math.round((completeWeight / Math.max(items.length, 1)) * 100),
      items,
    },
    patches,
  };
}

export function summarizeArticleReadiness(
  readiness: ArticleAssistResult['readiness']
): ArticleReadinessSummary {
  const items = readiness.items || [];
  const done = items.filter((item) => item.status === 'done');
  const blockers = items.filter((item) => item.status === 'blocked');
  const warnings = items.filter((item) => item.status === 'warning');
  const todos = items.filter((item) => item.status === 'todo');

  return {
    score: readiness.score,
    total: items.length,
    done,
    blockers,
    warnings,
    todos,
    canSend: blockers.length === 0,
  };
}
