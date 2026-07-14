import {
  analyzeArticleSeo,
  normalizeArticleSeo,
  normalizeArticleSlug,
  isValidArticleSlug,
  stripArticleHtml,
  type ArticleSeoFields,
} from '@/lib/seo/articleSeo';
import { analyzeArticleEditorContent } from '@/lib/utils/articleEditorAnalysis';
import {
  normalizeArticleEditorialMeta,
  parseArticleEditorialTimestamp,
  type ArticleEditorialMeta,
} from '@/lib/content/articleEditorial';

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
  | 'sourceInfo'
  | 'storyType'
  | 'sourceAttribution'
  | 'quoteAttribution'
  | 'eventDateTime'
  | 'factCheckStatus'
  | 'legalReviewStatus'
  | 'sensitivityReviewStatus'
  | 'headlineSupportConfirmed'
  | 'duplicateCheckComplete'
  | 'aiDisclosure'
  | 'imageLicense';

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
  targetField?: ArticleAssistField;
  insertValue?: string;
  kind?: 'headline' | 'internal_link' | 'claim_review' | 'desk_note';
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
  locationTag?: string;
  editorial?: Partial<ArticleEditorialMeta>;
  relatedArticles?: Array<{ title: string; slug?: string }>;
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

function proofreadPlainText(value: string) {
  return value
    .replace(/\s+([,.;:!?।])/gu, '$1')
    .replace(/([.!?।])(?=[\p{L}\p{N}])/gu, '$1 ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function hasQualityImageAlt(value: string) {
  const normalized = cleanText(value);
  if (normalized.length < 12 || textTokens(normalized).length < 3) return false;
  return !/^(image|photo|picture|preview|featured image|news image)(\s+\d+)?$/iu.test(
    normalized
  );
}

function buildHeadlineOptions(input: {
  title: string;
  category: string;
  summary: string;
}) {
  const options = [input.title];
  if (input.category && input.title) {
    options.push(`${input.category}: ${input.title}`);
  }
  const summaryLead = splitSentences(input.summary)[0] || '';
  if (summaryLead && input.title) {
    options.push(`${input.title} — ${clampText(summaryLead, 80)}`);
  }
  if (input.title) options.push(`${input.title}: What the reporting shows`);
  return [...new Set(options.map((value) => clampText(value, 160)).filter(Boolean))].slice(0, 3);
}

function relatedArticleScore(
  article: { title: string },
  inputTokens: Set<string>
) {
  return textTokens(article.title).reduce(
    (score, token) => score + (inputTokens.has(token.toLowerCase()) ? 1 : 0),
    0
  );
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
  if (currentSummary.length >= 70 && currentSummary.length <= 180) return currentSummary;

  if (currentSummary.length > 180) {
    const tightened = splitSentences(currentSummary).slice(0, 2).join(' ');
    return clampText(tightened || currentSummary, 180);
  }

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
  const originalTitle = String(input.title || '');
  const originalSummary = String(input.summary || '');
  const title = cleanText(input.title);
  const summary = cleanText(input.summary);
  const content = cleanText(input.content);
  const plainContent = stripArticleHtml(content);
  const category = cleanText(input.category);
  const author = cleanText(input.author);
  const image = cleanText(input.image);
  const sourceInfo = cleanText(input.sourceInfo);
  const sourceStoryId = cleanText(input.sourceStoryId);
  const locationTag = cleanText(input.locationTag);
  const editorial = normalizeArticleEditorialMeta(input.editorial);
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
  const requiredBodyLength =
    editorial.storyType === 'breaking'
      ? 80
      : editorial.storyType === 'investigation'
        ? 600
        : 120;
  const isHighRiskStory = editorial.storyType === 'investigation';
  const hasAttributedEvidence = Boolean(
    editorial.evidenceType !== 'none' && editorial.sourceAttribution
  );
  const containsQuote = /["“”'‘’]/u.test(plainContent);
  const hasImageRights = Boolean(
    !image || (editorial.imageLicense !== 'unknown' && seo.imageCredit)
  );
  const hasAccessibleImageAlt = Boolean(!image || hasQualityImageAlt(seo.featuredImageAlt));
  const reviewComplete = (value: ArticleEditorialMeta['legalReviewStatus']) =>
    value === 'complete' || value === 'not_needed';
  const futureDate = (value: string) => {
    const timestamp = parseArticleEditorialTimestamp(value);
    return Number.isFinite(timestamp) && timestamp > Date.now();
  };
  const validDate = (value: string) => {
    const timestamp = parseArticleEditorialTimestamp(value);
    return Number.isFinite(timestamp);
  };
  const missingBreakingControls = [
    !editorial.breakingReason ? 'reason' : '',
    !validDate(editorial.breakingStartsAt) ? 'start time' : '',
    !futureDate(editorial.breakingExpiresAt) ? 'future expiry' : '',
  ].filter(Boolean);
  const missingTrendingControls = [
    !editorial.trendingReason ? 'reason' : '',
    !futureDate(editorial.trendingExpiresAt) ? 'future expiry' : '',
  ].filter(Boolean);

  const patches: ArticleAssistPatch[] = [];
  addPatch(
    patches,
    'title',
    originalTitle,
    proofreadPlainText(originalTitle),
    'Fix spacing and punctuation without changing the reported claim.'
  );
  addPatch(
    patches,
    'summary',
    originalSummary,
    proofreadPlainText(originalSummary),
    'Fix spacing and punctuation without introducing new information.'
  );
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

  const headlineOptions = buildHeadlineOptions({ title, category, summary });
  const suggestions: ArticleAssistSuggestion[] = [
    ...headlineOptions.map((value, index) => ({
      id: `headline-option-${index + 1}`,
      label: `Headline option ${index + 1}`,
      value,
      insertValue: value,
      targetField: 'title' as const,
      kind: 'headline' as const,
      reason: 'Uses only the existing headline, category, and summary; verify emphasis before inserting.',
    })),
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
      kind: 'desk_note',
    },
    {
      id: 'social-copy',
      label: 'Social post starter',
      value: clampText([title, summary || suggestedSummary].filter(Boolean).join(' - '), 220),
      reason: 'A short approved draft can speed up social packaging after publish.',
      kind: 'desk_note',
    },
    {
      id: 'audio-script',
      label: 'Manual audio script starter',
      value: clampText([title, summary || suggestedSummary].filter(Boolean).join('. '), 260),
      reason: 'Keep audio manual, but give the team a clean recording script starter.',
      kind: 'desk_note',
    },
  ];

  const claimCandidates = splitSentences(plainContent).filter((sentence) =>
    /\b\d[\d,.%]*\b|\b(first|largest|smallest|only|all|never|always)\b|सबसे|पहली|एकमात्र/iu.test(
      sentence
    )
  );
  if (claimCandidates.length > 0) {
    suggestions.push({
      id: 'unsupported-claim-review',
      label: hasSourceSignal ? 'High-risk claims to verify' : 'Potentially unsupported claims',
      value: claimCandidates.slice(0, 3).join(' • '),
      reason: hasSourceSignal
        ? 'Numbers and absolute claims need a source-by-source check even when evidence is attached.'
        : 'No source signal was found; add attribution or soften these claims before publish.',
      kind: 'claim_review',
      targetField: 'sourceAttribution',
    });
  }

  const inputTokenSet = new Set(
    textTokens(`${title} ${summary}`).map((token) => token.toLowerCase())
  );
  (input.relatedArticles || [])
    .map((article) => ({ article, score: relatedArticleScore(article, inputTokenSet) }))
    .filter(({ article, score }) => score > 0 && article.title.trim() && article.slug?.trim())
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .forEach(({ article }, index) => {
      const href = `/main/article/${encodeURIComponent(article.slug || '')}`;
      suggestions.push({
        id: `internal-link-${index + 1}`,
        label: 'Internal link suggestion',
        value: article.title,
        insertValue: `<p>Related: <a href="${href}">${article.title}</a></p>`,
        targetField: 'content',
        kind: 'internal_link',
        reason: 'Topic overlap comes from the current headline and summary; insert only if it helps readers.',
      });
    });

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
    readinessItem('content', 'Article body', plainContent.length >= requiredBodyLength, {
      blocked: true,
      doneDetail: 'Article body has enough copy to review.',
      todoDetail: `Add more body copy before publishing (${requiredBodyLength}+ characters for this story type).`,
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
    readinessItem(
      'headline-support',
      'Headline supported by reporting',
      editorial.headlineSupportConfirmed,
      {
        blocked: isHighRiskStory,
        warning: !isHighRiskStory,
        doneDetail: 'The headline has been checked against the reporting.',
        todoDetail: 'Confirm every headline claim is supported by the copy and evidence.',
        field: 'headlineSupportConfirmed',
      }
    ),
    readinessItem('duplicate-check', 'Duplicate story check', editorial.duplicateCheckComplete, {
      blocked: isHighRiskStory,
      warning: !isHighRiskStory,
      doneDetail: 'The newsroom duplicate check is complete.',
      todoDetail: 'Check for an existing or substantially similar story.',
      field: 'duplicateCheckComplete',
    }),
    readinessItem('evidence', 'Evidence and source attribution', hasAttributedEvidence, {
      blocked: isHighRiskStory,
      warning: !isHighRiskStory,
      doneDetail: 'Evidence type and source attribution are recorded.',
      todoDetail: isHighRiskStory
        ? 'Record the evidence type and source attribution for this investigation.'
        : 'Record the source and evidence type when the story relies on external reporting.',
      field: 'sourceAttribution',
    }),
    readinessItem(
      'fact-check',
      'Fact check',
      editorial.storyType === 'opinion'
        ? editorial.factCheckStatus !== 'needs_follow_up'
        : editorial.factCheckStatus === 'verified',
      {
        blocked: isHighRiskStory,
        warning: !isHighRiskStory,
        doneDetail: 'Fact-check status is clear.',
        todoDetail: 'Complete the fact check or resolve follow-up items.',
        field: 'factCheckStatus',
      }
    ),
    readinessItem('image-rights', 'Image credit and license', hasImageRights, {
      blocked: isHighRiskStory,
      warning: !isHighRiskStory,
      doneDetail: image ? 'Image credit and usage rights are recorded.' : 'No image rights check is needed.',
      todoDetail: 'Choose an image license and add a credit before publish.',
      field: editorial.imageLicense === 'unknown' ? 'imageLicense' : 'imageCredit',
    }),
    readinessItem('image-alt-quality', 'Image alt-text quality', hasAccessibleImageAlt, {
      blocked: isHighRiskStory,
      warning: !isHighRiskStory,
      doneDetail: image ? 'Image alt text is descriptive.' : 'No image alt text is needed.',
      todoDetail: 'Add specific alt text with at least three descriptive words.',
      field: 'featuredImageAlt',
    }),
    readinessItem('ai-disclosure', 'AI disclosure', Boolean(editorial.aiDisclosure), {
      warning: true,
      doneDetail:
        editorial.aiDisclosure === 'none'
          ? 'No AI assistance is disclosed.'
          : 'AI assistance is disclosed for editorial review.',
      todoDetail: 'Record whether AI assisted with this story.',
      field: 'aiDisclosure',
    }),
  ];

  if (containsQuote) {
    items.push(
      readinessItem('quote-attribution', 'Quote attribution', Boolean(editorial.quoteAttribution), {
        blocked: isHighRiskStory,
        warning: !isHighRiskStory,
        doneDetail: 'Quoted material has attribution notes.',
        todoDetail: 'Record who supplied or verified the quoted material.',
        field: 'quoteAttribution',
      })
    );
  }

  if (isHighRiskStory) {
    items.push(
      readinessItem('legal-review', 'Legal review', reviewComplete(editorial.legalReviewStatus), {
        blocked: true,
        doneDetail: 'Legal review is complete or marked not needed.',
        todoDetail: 'Complete legal review or explicitly mark it not needed.',
        field: 'legalReviewStatus',
      }),
      readinessItem(
        'sensitivity-review',
        'Sensitivity review',
        reviewComplete(editorial.sensitivityReviewStatus),
        {
          blocked: true,
          doneDetail: 'Sensitivity review is complete or marked not needed.',
          todoDetail: 'Complete sensitivity review or explicitly mark it not needed.',
          field: 'sensitivityReviewStatus',
        }
      )
    );
  }

  if (editorial.storyType !== 'opinion') {
    items.push(
      readinessItem(
        'event-context',
        'Date, time, and location clarity',
        Boolean(editorial.eventDateTime && locationTag),
        {
          blocked: isHighRiskStory,
          warning: !isHighRiskStory,
          doneDetail: 'Event date/time and location are recorded.',
          todoDetail: 'Record the event date/time and location, or confirm they are clear in the copy.',
          field: editorial.eventDateTime ? 'sourceInfo' : 'eventDateTime',
        }
      )
    );
  }

  if (input.mode === 'edit') {
    items.push(
      readinessItem(
        'correction-update-note',
        'Correction or major-update note',
        Boolean(editorial.correctionNote || seo.majorUpdateNote),
        {
          warning: true,
          doneDetail: 'A correction or major-update note is recorded.',
          todoDetail: 'Add a public-facing note when this edit corrects or substantially changes the story.',
          field: 'seoDescription',
        }
      )
    );
  }

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
    items.push(
      readinessItem(
        'breaking-control',
        'Breaking flag approval',
        missingBreakingControls.length === 0,
        {
          blocked: true,
          doneDetail: 'Breaking reason, start, approver, and future expiry are recorded.',
          todoDetail: `Add the missing ${missingBreakingControls.join(' and ')}; the server records the approver.`,
          field: 'isBreaking',
        }
      )
    );
  }

  if (input.isTrending) {
    items.push(
      readinessItem(
        'trending-control',
        'Trending flag approval',
        missingTrendingControls.length === 0,
        {
          blocked: true,
          doneDetail: 'Trending reason, approver, and future expiry are recorded.',
          todoDetail: `Add the missing ${missingTrendingControls.join(' and ')}; the server records the approver.`,
          field: 'isTrending',
        }
      )
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
