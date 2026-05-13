import { buildArticleEmbeddingText, generateEmbedding } from '@/lib/ai/embeddings';

export type ContentType = 'article' | 'epaper' | 'video' | 'story';

export interface EmbeddableContent {
  _id: string;
  type: ContentType;
  title: string;
  description?: string;
  category?: string;
  date?: string;
  url?: string;
  thumbnail?: string;
  tags?: string[];
}

export function buildEmbeddingText(content: EmbeddableContent): string {
  switch (content.type) {
    case 'article':
      return buildArticleEmbeddingText({
        title: content.title,
        category: content.category,
        summary: content.description,
      });

    case 'epaper':
      return [
        `E-Paper: ${content.title}`,
        content.date ? `Date: ${content.date}` : '',
        content.description || 'Digital newspaper edition',
        content.category || 'E-Paper',
      ]
        .filter(Boolean)
        .join('. ');

    case 'video':
      return [
        `Video: ${content.title}`,
        content.description,
        content.category,
        content.tags?.join(', '),
      ]
        .filter(Boolean)
        .join('. ');

    case 'story':
      return [
        `Short Story: ${content.title}`,
        content.description,
        content.category,
        content.tags?.join(', '),
      ]
        .filter(Boolean)
        .join('. ');

    default:
      return content.title;
  }
}

export async function generateContentSummary(
  content: EmbeddableContent,
  language: 'hi' | 'en' = 'hi'
): Promise<string> {
  void language;
  return content.description || content.title;
}

export async function embedContent(content: EmbeddableContent): Promise<number[]> {
  const text = buildEmbeddingText(content);
  return generateEmbedding(text);
}
