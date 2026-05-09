import 'server-only';

import { Types } from 'mongoose';
import Article from '@/lib/models/Article';
import { resolveArticleWorkflow } from '@/lib/workflow/article';

export type ArticleManualTtsSource = {
  id: string;
  title: string;
  summary: string;
  content: string;
  author: string;
  workflow: ReturnType<typeof resolveArticleWorkflow>;
};

export type SerializableManagedTtsAsset = {
  id: string;
  status: string;
  provider: string;
  audioUrl: string;
  voice: string;
  model: string;
  languageCode: string;
  mimeType: string;
  storageMode: string;
  generatedAt: string;
  updatedAt: string;
  lastVerifiedAt: string;
  lastError: string;
  chunkCount: number;
  charCount: number;
};

export async function loadArticleManualTtsSource(
  articleId: string
): Promise<ArticleManualTtsSource | null> {
  if (!Types.ObjectId.isValid(articleId)) {
    return null;
  }

  const article = await Article.findById(articleId).select(
    '_id title summary content author workflow updatedAt publishedAt'
  );
  if (!article) {
    return null;
  }

  return {
    id: String(article._id),
    title: String(article.title || '').trim(),
    summary: String(article.summary || '').trim(),
    content: String(article.content || '').trim(),
    author: String(article.author || '').trim(),
    workflow: resolveArticleWorkflow({
      workflow: article.workflow,
      updatedAt: article.updatedAt,
      publishedAt: article.publishedAt,
    }),
  };
}

export function serializeManagedTtsAsset(asset: unknown): SerializableManagedTtsAsset | null {
  if (!asset || typeof asset !== 'object') return null;

  const source = asset as Record<string, unknown>;
  return {
    id: String(source._id || ''),
    status: String(source.status || ''),
    provider: String(source.provider || ''),
    audioUrl: String(source.audioUrl || ''),
    voice: String(source.voice || ''),
    model: String(source.model || ''),
    languageCode: String(source.languageCode || ''),
    mimeType: String(source.mimeType || ''),
    storageMode: String(source.storageMode || ''),
    generatedAt: source.generatedAt instanceof Date
      ? source.generatedAt.toISOString()
      : String(source.generatedAt || ''),
    updatedAt: source.updatedAt instanceof Date
      ? source.updatedAt.toISOString()
      : String(source.updatedAt || ''),
    lastVerifiedAt: source.lastVerifiedAt instanceof Date
      ? source.lastVerifiedAt.toISOString()
      : String(source.lastVerifiedAt || ''),
    lastError: String(source.lastError || ''),
    chunkCount: Number(source.chunkCount || 0),
    charCount: Number(source.charCount || 0),
  };
}
