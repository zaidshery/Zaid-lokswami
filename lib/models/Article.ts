import mongoose from 'mongoose';

export interface IArticleSeo {
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
  canonicalUrl: string;
}

export interface IArticleRevision {
  _id?: string;
  title: string;
  summary: string;
  content: string;
  image: string;
  category: string;
  author: string;
  isBreaking: boolean;
  isTrending: boolean;
  seo: IArticleSeo;
  savedAt: Date;
}

export interface IArticle {
  _id?: string;
  title: string;
  summary: string;
  content: string;
  image: string;
  category: string;
  author: string;
  publishedAt: Date;
  updatedAt: Date;
  views: number;
  isBreaking: boolean;
  isTrending: boolean;
  seo: IArticleSeo;
  revisions: IArticleRevision[];
}

const SeoSchema = new mongoose.Schema<IArticleSeo>(
  {
    metaTitle: { type: String, default: '', maxlength: 160 },
    metaDescription: { type: String, default: '', maxlength: 320 },
    ogImage: { type: String, default: '' },
    canonicalUrl: { type: String, default: '' },
  },
  { _id: false }
);

const RevisionSchema = new mongoose.Schema<IArticleRevision>(
  {
    title: { type: String, required: true, maxlength: 200 },
    summary: { type: String, required: true, maxlength: 500 },
    content: { type: String, required: true },
    image: { type: String, required: true },
    category: { type: String, required: true },
    author: { type: String, required: true },
    isBreaking: { type: Boolean, default: false },
    isTrending: { type: Boolean, default: false },
    seo: { type: SeoSchema, default: () => ({}) },
    savedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ArticleSchema = new mongoose.Schema<IArticle>({
  title: { type: String, required: true, maxlength: 200 },
  summary: { type: String, required: true, maxlength: 500 },
  content: { type: String, required: true },
  image: { type: String, required: true },
  // category is stored as a string (category name or slug). Categories are managed separately.
  category: { type: String, required: true },
  author: { type: String, required: true },
  publishedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  views: { type: Number, default: 0 },
  isBreaking: { type: Boolean, default: false },
  isTrending: { type: Boolean, default: false },
  seo: { type: SeoSchema, default: () => ({}) },
  revisions: { type: [RevisionSchema], default: [] },
});

ArticleSchema.index({ publishedAt: -1, _id: -1 });

export default mongoose.models.Article || mongoose.model('Article', ArticleSchema);

