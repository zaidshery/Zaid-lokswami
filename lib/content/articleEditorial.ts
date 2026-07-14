export const ARTICLE_STORY_TYPES = [
  'standard',
  'breaking',
  'investigation',
  'analysis',
  'explainer',
  'opinion',
] as const;

export const ARTICLE_EVIDENCE_TYPES = [
  'none',
  'first_hand',
  'official',
  'document',
  'public_record',
  'news_agency',
  'anonymous',
  'other',
] as const;

export const ARTICLE_REVIEW_STATUSES = ['pending', 'not_needed', 'complete'] as const;
export const ARTICLE_FACT_CHECK_STATUSES = [
  'pending',
  'verified',
  'needs_follow_up',
] as const;
export const ARTICLE_AI_DISCLOSURES = [
  'none',
  'assisted',
  'generated_reviewed',
] as const;
export const ARTICLE_IMAGE_LICENSES = [
  'unknown',
  'owned',
  'licensed',
  'creative_commons',
  'news_agency',
  'fair_use',
] as const;

export type ArticleStoryType = (typeof ARTICLE_STORY_TYPES)[number];
export type ArticleEvidenceType = (typeof ARTICLE_EVIDENCE_TYPES)[number];
export type ArticleReviewStatus = (typeof ARTICLE_REVIEW_STATUSES)[number];
export type ArticleFactCheckStatus = (typeof ARTICLE_FACT_CHECK_STATUSES)[number];
export type ArticleAiDisclosure = (typeof ARTICLE_AI_DISCLOSURES)[number];
export type ArticleImageLicense = (typeof ARTICLE_IMAGE_LICENSES)[number];

export type ArticleEditorialMeta = {
  storyType: ArticleStoryType;
  evidenceType: ArticleEvidenceType;
  sourceAttribution: string;
  quoteAttribution: string;
  eventDateTime: string;
  factCheckStatus: ArticleFactCheckStatus;
  legalReviewStatus: ArticleReviewStatus;
  sensitivityReviewStatus: ArticleReviewStatus;
  headlineSupportConfirmed: boolean;
  duplicateCheckComplete: boolean;
  aiDisclosure: ArticleAiDisclosure;
  imageLicense: ArticleImageLicense;
  correctionNote: string;
  breakingStartsAt: string;
  breakingExpiresAt: string;
  breakingReason: string;
  trendingExpiresAt: string;
  trendingReason: string;
  flagApprovedBy: string;
};

const storyTypeSet = new Set<string>(ARTICLE_STORY_TYPES);
const evidenceTypeSet = new Set<string>(ARTICLE_EVIDENCE_TYPES);
const reviewStatusSet = new Set<string>(ARTICLE_REVIEW_STATUSES);
const factCheckStatusSet = new Set<string>(ARTICLE_FACT_CHECK_STATUSES);
const aiDisclosureSet = new Set<string>(ARTICLE_AI_DISCLOSURES);
const imageLicenseSet = new Set<string>(ARTICLE_IMAGE_LICENSES);

function trimmed(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseArticleEditorialTimestamp(value: unknown) {
  const normalized = trimmed(value);
  if (!normalized) return Number.NaN;
  // datetime-local controls have no offset. The newsroom workflow is fixed to
  // Asia/Calcutta, so interpret those values as IST on every server.
  const withNewsroomOffset = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/u.test(normalized)
    ? `${normalized}${normalized.length === 16 ? ':00' : ''}+05:30`
    : normalized;
  return new Date(withNewsroomOffset).getTime();
}

export function resolveArticleEditorialFlags(
  input: { isBreaking?: unknown; isTrending?: unknown; editorial?: unknown },
  now = Date.now()
) {
  const editorial = normalizeArticleEditorialMeta(input.editorial);
  const breakingStartsAt = parseArticleEditorialTimestamp(editorial.breakingStartsAt);
  const breakingExpiresAt = parseArticleEditorialTimestamp(editorial.breakingExpiresAt);
  const trendingExpiresAt = parseArticleEditorialTimestamp(editorial.trendingExpiresAt);
  const breakingHasStarted = !Number.isFinite(breakingStartsAt) || breakingStartsAt <= now;
  const breakingHasNotExpired = !Number.isFinite(breakingExpiresAt) || breakingExpiresAt > now;
  const trendingHasNotExpired = !Number.isFinite(trendingExpiresAt) || trendingExpiresAt > now;

  return {
    isBreaking: Boolean(input.isBreaking) && breakingHasStarted && breakingHasNotExpired,
    isTrending: Boolean(input.isTrending) && trendingHasNotExpired,
  };
}

export function createEmptyArticleEditorialMeta(): ArticleEditorialMeta {
  return {
    storyType: 'standard',
    evidenceType: 'none',
    sourceAttribution: '',
    quoteAttribution: '',
    eventDateTime: '',
    factCheckStatus: 'pending',
    legalReviewStatus: 'pending',
    sensitivityReviewStatus: 'pending',
    headlineSupportConfirmed: false,
    duplicateCheckComplete: false,
    aiDisclosure: 'none',
    imageLicense: 'unknown',
    correctionNote: '',
    breakingStartsAt: '',
    breakingExpiresAt: '',
    breakingReason: '',
    trendingExpiresAt: '',
    trendingReason: '',
    flagApprovedBy: '',
  };
}

export function normalizeArticleEditorialMeta(input: unknown): ArticleEditorialMeta {
  const source = typeof input === 'object' && input ? (input as Record<string, unknown>) : {};
  return {
    storyType: storyTypeSet.has(String(source.storyType || ''))
      ? (source.storyType as ArticleStoryType)
      : 'standard',
    evidenceType: evidenceTypeSet.has(String(source.evidenceType || ''))
      ? (source.evidenceType as ArticleEvidenceType)
      : 'none',
    sourceAttribution: trimmed(source.sourceAttribution),
    quoteAttribution: trimmed(source.quoteAttribution),
    eventDateTime: trimmed(source.eventDateTime),
    factCheckStatus: factCheckStatusSet.has(String(source.factCheckStatus || ''))
      ? (source.factCheckStatus as ArticleFactCheckStatus)
      : 'pending',
    legalReviewStatus: reviewStatusSet.has(String(source.legalReviewStatus || ''))
      ? (source.legalReviewStatus as ArticleReviewStatus)
      : 'pending',
    sensitivityReviewStatus: reviewStatusSet.has(String(source.sensitivityReviewStatus || ''))
      ? (source.sensitivityReviewStatus as ArticleReviewStatus)
      : 'pending',
    headlineSupportConfirmed: Boolean(source.headlineSupportConfirmed),
    duplicateCheckComplete: Boolean(source.duplicateCheckComplete),
    aiDisclosure: aiDisclosureSet.has(String(source.aiDisclosure || ''))
      ? (source.aiDisclosure as ArticleAiDisclosure)
      : 'none',
    imageLicense: imageLicenseSet.has(String(source.imageLicense || ''))
      ? (source.imageLicense as ArticleImageLicense)
      : 'unknown',
    correctionNote: trimmed(source.correctionNote),
    breakingStartsAt: trimmed(source.breakingStartsAt),
    breakingExpiresAt: trimmed(source.breakingExpiresAt),
    breakingReason: trimmed(source.breakingReason),
    trendingExpiresAt: trimmed(source.trendingExpiresAt),
    trendingReason: trimmed(source.trendingReason),
    flagApprovedBy: trimmed(source.flagApprovedBy),
  };
}

const ARTICLE_EDITORIAL_KEYS = [
  'storyType',
  'evidenceType',
  'sourceAttribution',
  'quoteAttribution',
  'eventDateTime',
  'factCheckStatus',
  'legalReviewStatus',
  'sensitivityReviewStatus',
  'headlineSupportConfirmed',
  'duplicateCheckComplete',
  'aiDisclosure',
  'imageLicense',
  'correctionNote',
  'breakingStartsAt',
  'breakingExpiresAt',
  'breakingReason',
  'trendingExpiresAt',
  'trendingReason',
  'flagApprovedBy',
] as const satisfies readonly (keyof ArticleEditorialMeta)[];

export function normalizeArticleEditorialMetaPartial(
  input: unknown
): Partial<ArticleEditorialMeta> {
  const source = typeof input === 'object' && input ? (input as Record<string, unknown>) : {};
  const normalized = normalizeArticleEditorialMeta(source);
  return Object.fromEntries(
    ARTICLE_EDITORIAL_KEYS.filter((key) =>
      Object.prototype.hasOwnProperty.call(source, key)
    ).map((key) => [key, normalized[key]])
  ) as Partial<ArticleEditorialMeta>;
}

export function validateArticleEditorialMeta(meta: ArticleEditorialMeta) {
  if (meta.sourceAttribution.length > 1000) {
    return 'Source attribution is too long (max 1000 characters)';
  }
  if (meta.quoteAttribution.length > 1000) {
    return 'Quote attribution is too long (max 1000 characters)';
  }
  if (meta.correctionNote.length > 1000) {
    return 'Correction note is too long (max 1000 characters)';
  }
  if (meta.breakingReason.length > 500 || meta.trendingReason.length > 500) {
    return 'Editorial flag reason is too long (max 500 characters)';
  }
  for (const [label, value] of [
    ['Breaking start', meta.breakingStartsAt],
    ['Breaking expiry', meta.breakingExpiresAt],
    ['Trending expiry', meta.trendingExpiresAt],
  ] as const) {
    if (value && Number.isNaN(parseArticleEditorialTimestamp(value))) {
      return `${label} must be valid`;
    }
  }
  if (
    meta.breakingStartsAt &&
    meta.breakingExpiresAt &&
    parseArticleEditorialTimestamp(meta.breakingExpiresAt) <=
      parseArticleEditorialTimestamp(meta.breakingStartsAt)
  ) {
    return 'Breaking expiry must be after its start time';
  }
  if (meta.eventDateTime && Number.isNaN(parseArticleEditorialTimestamp(meta.eventDateTime))) {
    return 'Event date and time must be valid';
  }
  return null;
}
