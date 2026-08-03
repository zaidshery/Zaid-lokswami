import mongoose from 'mongoose';
import { WorkflowMetaSchema } from '@/lib/models/schemas/workflow';
import {
  CopyEditorMetaSchema,
  ReporterMetaSchema,
} from '@/lib/models/schemas/newsroom';
import type { CopyEditorMeta, ReporterMeta } from '@/lib/content/newsroomMetadata';
import {
  normalizeArticleSourceType,
  type ArticleSourceType,
} from '@/lib/content/newsroomPublishing';
import type { WorkflowMeta } from '@/lib/workflow/types';
import {
  ARTICLE_AI_DISCLOSURES,
  ARTICLE_EVIDENCE_TYPES,
  ARTICLE_FACT_CHECK_STATUSES,
  ARTICLE_IMAGE_LICENSES,
  ARTICLE_REVIEW_STATUSES,
  ARTICLE_STORY_TYPES,
  type ArticleEditorialMeta,
} from '@/lib/content/articleEditorial';
import type { ArticleMediaMetadata } from '@/lib/content/articleMediaMetadata';
import type { ArticleDocument } from '@/lib/content/articleDocument';

export interface IArticleSeo {
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
  authorDisplayName: string;
  authorDisplayNameSet: boolean;
  authorAvatarUrl: string;
  authorProgramName: string;
  includeInNewsSitemap: boolean;
  majorUpdateNote: string;
}

export interface IArticleRevision {
  _id?: string;
  title: string;
  summary: string;
  content: string;
  contentJson: ArticleDocument;
  image: string;
  category: string;
  author: string;
  slug: string;
  previousSlugs: string[];
  isBreaking: boolean;
  isTrending: boolean;
  seo: IArticleSeo;
  reporterMeta: ReporterMeta;
  copyEditorMeta: CopyEditorMeta;
  editorial: ArticleEditorialMeta;
  media: ArticleMediaMetadata;
  savedAt: Date;
}

export interface IArticleBreakingTts {
  audioUrl: string;
  textHash: string;
  languageCode: 'hi-IN' | 'en-IN';
  voice: string;
  model: string;
  mimeType: string;
  generatedAt: Date;
}

export interface IArticle {
  _id?: string;
  version: number;
  title: string;
  summary: string;
  content: string;
  contentJson: ArticleDocument;
  image: string;
  category: string;
  author: string;
  slug: string;
  previousSlugs: string[];
  publishedAt: Date;
  updatedAt: Date;
  views: number;
  isBreaking: boolean;
  isTrending: boolean;
  seo: IArticleSeo;
  revisions: IArticleRevision[];
  breakingTts: IArticleBreakingTts | null;
  workflow: WorkflowMeta;
  reporterMeta: ReporterMeta;
  copyEditorMeta: CopyEditorMeta;
  editorial: ArticleEditorialMeta;
  media: ArticleMediaMetadata;
  sourceType: ArticleSourceType;
  sourceStoryId: string;
  sourceStoryTitle: string;
  embedding: number[];
  embeddingGeneratedAt: Date | null;
  aiSummary: string;
}

const SeoSchema = new mongoose.Schema<IArticleSeo>(
  {
    metaTitle: { type: String, default: '', maxlength: 160 },
    metaDescription: { type: String, default: '', maxlength: 320 },
    ogImage: { type: String, default: '' },
    canonicalUrl: { type: String, default: '' },
    focusKeyword: { type: String, default: '', maxlength: 120 },
    secondaryKeywords: { type: String, default: '', maxlength: 240 },
    featuredImageAlt: { type: String, default: '', maxlength: 220 },
    featuredImageCaption: { type: String, default: '', maxlength: 300 },
    imageCredit: { type: String, default: '', maxlength: 180 },
    authorProfileUrl: { type: String, default: '' },
    authorDisplayName: { type: String, default: '', maxlength: 120 },
    authorDisplayNameSet: { type: Boolean, default: false },
    authorAvatarUrl: { type: String, default: '' },
    authorProgramName: { type: String, default: '', maxlength: 120 },
    includeInNewsSitemap: { type: Boolean, default: true },
    majorUpdateNote: { type: String, default: '', maxlength: 240 },
  },
  { _id: false }
);

const EditorialSchema = new mongoose.Schema<ArticleEditorialMeta>(
  {
    storyType: { type: String, enum: ARTICLE_STORY_TYPES, default: 'standard' },
    evidenceType: { type: String, enum: ARTICLE_EVIDENCE_TYPES, default: 'none' },
    sourceAttribution: { type: String, default: '', maxlength: 1000 },
    quoteAttribution: { type: String, default: '', maxlength: 1000 },
    eventDateTime: { type: String, default: '' },
    factCheckStatus: {
      type: String,
      enum: ARTICLE_FACT_CHECK_STATUSES,
      default: 'pending',
    },
    legalReviewStatus: {
      type: String,
      enum: ARTICLE_REVIEW_STATUSES,
      default: 'pending',
    },
    sensitivityReviewStatus: {
      type: String,
      enum: ARTICLE_REVIEW_STATUSES,
      default: 'pending',
    },
    headlineSupportConfirmed: { type: Boolean, default: false },
    duplicateCheckComplete: { type: Boolean, default: false },
    aiDisclosure: { type: String, enum: ARTICLE_AI_DISCLOSURES, default: 'none' },
    imageLicense: { type: String, enum: ARTICLE_IMAGE_LICENSES, default: 'unknown' },
    correctionNote: { type: String, default: '', maxlength: 1000 },
    breakingStartsAt: { type: String, default: '' },
    breakingExpiresAt: { type: String, default: '' },
    breakingReason: { type: String, default: '', maxlength: 500 },
    trendingExpiresAt: { type: String, default: '' },
    trendingReason: { type: String, default: '', maxlength: 500 },
    flagApprovedBy: { type: String, default: '', maxlength: 180 },
  },
  { _id: false }
);

const MediaVariantsSchema = new mongoose.Schema<ArticleMediaMetadata['variants']>(
  {
    landscape16x9: { type: String, default: '' },
    standard4x3: { type: String, default: '' },
    square1x1: { type: String, default: '' },
    webp: { type: String, default: '' },
    avif: { type: String, default: '' },
  },
  { _id: false }
);

const MediaMetadataSchema = new mongoose.Schema<ArticleMediaMetadata>(
  {
    sourceMediaId: { type: String, default: '', maxlength: 200 },
    focalPointX: { type: Number, default: 50, min: 0, max: 100 },
    focalPointY: { type: Number, default: 50, min: 0, max: 100 },
    width: { type: Number, default: 0, min: 0 },
    height: { type: Number, default: 0, min: 0 },
    format: { type: String, default: '', maxlength: 32 },
    variants: { type: MediaVariantsSchema, default: () => ({}) },
  },
  { _id: false }
);

const RevisionSchema = new mongoose.Schema<IArticleRevision>(
  {
    title: { type: String, required: true, maxlength: 200 },
    summary: { type: String, required: true, maxlength: 500 },
    content: { type: String, required: true },
    contentJson: { type: mongoose.Schema.Types.Mixed, default: () => ({ version: 1, blocks: [] }) },
    image: { type: String, required: true },
    category: { type: String, required: true },
    author: { type: String, required: true },
    slug: { type: String, default: '', trim: true, lowercase: true },
    previousSlugs: { type: [String], default: [] },
    isBreaking: { type: Boolean, default: false },
    isTrending: { type: Boolean, default: false },
    seo: { type: SeoSchema, default: () => ({}) },
    reporterMeta: { type: ReporterMetaSchema, default: () => ({}) },
    copyEditorMeta: { type: CopyEditorMetaSchema, default: () => ({}) },
    editorial: { type: EditorialSchema, default: () => ({}) },
    media: { type: MediaMetadataSchema, default: () => ({}) },
    savedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const BreakingTtsSchema = new mongoose.Schema<IArticleBreakingTts>(
  {
    audioUrl: { type: String, required: true },
    textHash: { type: String, required: true },
    languageCode: { type: String, enum: ['hi-IN', 'en-IN'], required: true },
    voice: { type: String, required: true },
    model: { type: String, required: true },
    mimeType: { type: String, required: true },
    generatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ArticleSchema = new mongoose.Schema<IArticle>({
  // Drafts are created before publish-ready fields exist. Publication and
  // workflow transitions enforce completeness at the API boundary.
  version: { type: Number, default: 1, min: 1 },
  title: { type: String, default: '', maxlength: 200 },
  summary: { type: String, default: '', maxlength: 500 },
  content: { type: String, default: '' },
  contentJson: { type: mongoose.Schema.Types.Mixed, default: () => ({ version: 1, blocks: [] }) },
  image: { type: String, default: '' },
  // category is stored as a string (category name or slug). Categories are managed separately.
  category: { type: String, default: '' },
  author: { type: String, default: '' },
  slug: { type: String, default: '', trim: true, lowercase: true },
  previousSlugs: { type: [String], default: [] },
  publishedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  views: { type: Number, default: 0 },
  isBreaking: { type: Boolean, default: false },
  isTrending: { type: Boolean, default: false },
  seo: { type: SeoSchema, default: () => ({}) },
  revisions: { type: [RevisionSchema], default: [] },
  breakingTts: { type: BreakingTtsSchema, default: null },
  workflow: { type: WorkflowMetaSchema, default: () => ({}) },
  reporterMeta: { type: ReporterMetaSchema, default: () => ({}) },
  copyEditorMeta: { type: CopyEditorMetaSchema, default: () => ({}) },
  editorial: { type: EditorialSchema, default: () => ({}) },
  media: { type: MediaMetadataSchema, default: () => ({}) },
  sourceType: {
    type: String,
    enum: ['story', 'direct'],
    default: normalizeArticleSourceType(undefined),
  },
  sourceStoryId: { type: String, default: '' },
  sourceStoryTitle: { type: String, default: '' },
  embedding: { type: [Number], default: [], select: false },
  embeddingGeneratedAt: { type: Date, default: null },
  aiSummary: { type: String, default: '' },
});

ArticleSchema.index({ publishedAt: -1, _id: -1 });
ArticleSchema.index({ 'workflow.status': 1, publishedAt: -1, _id: -1 });
ArticleSchema.index({ 'workflow.createdBy.id': 1, 'workflow.status': 1, updatedAt: -1 });
ArticleSchema.index({ 'workflow.assignedTo.id': 1, 'workflow.status': 1, updatedAt: -1 });
ArticleSchema.index({ sourceStoryId: 1, updatedAt: -1 });
// Performance And Scaling Plan — recommended additions:
ArticleSchema.index({ slug: 1 }, { unique: true, sparse: true });
ArticleSchema.index({ previousSlugs: 1 });
ArticleSchema.index({ category: 1, publishedAt: -1 });
ArticleSchema.index({ isBreaking: 1, publishedAt: -1 });
ArticleSchema.index({ isTrending: 1, publishedAt: -1 });
ArticleSchema.index({ 'reporterMeta.locationTag': 1, publishedAt: -1 });
ArticleSchema.index({ updatedAt: -1, publishedAt: -1, _id: -1 });

export default mongoose.models.Article || mongoose.model('Article', ArticleSchema);

