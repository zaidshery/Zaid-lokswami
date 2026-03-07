import { GoogleGenerativeAI } from '@google/generative-ai';

type ArticleEmbeddingSource = {
  title: string;
  category?: string;
  summary?: string;
  content?: string;
  aiSummary?: string;
};

const apiKey = process.env.GEMINI_API_KEY || '';
const configuredEmbeddingModel =
  process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
const fallbackEmbeddingModels = ['text-embedding-004'] as const;
const candidateEmbeddingModels = Array.from(
  new Set([configuredEmbeddingModel, ...fallbackEmbeddingModels].filter(Boolean))
);

if (!apiKey) {
  console.warn('[Gemini Embeddings] GEMINI_API_KEY is not set.');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

function normalizeText(input: string) {
  return input.replace(/\s+/g, ' ').trim();
}

function shouldRetryWithNextModel(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /404|not found|not supported/i.test(message);
}

export function buildArticleEmbeddingText(article: ArticleEmbeddingSource): string {
  return [
    article.title,
    article.category,
    article.aiSummary,
    article.summary,
    typeof article.content === 'string' ? article.content.slice(0, 1600) : '',
  ]
    .map((part) => (typeof part === 'string' ? normalizeText(part) : ''))
    .filter(Boolean)
    .join('. ');
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!genAI) {
    throw new Error('Gemini API key not configured. Set GEMINI_API_KEY.');
  }

  const normalized = normalizeText(text).slice(0, 8000);
  if (!normalized) {
    return [];
  }

  let lastError: unknown;

  for (let index = 0; index < candidateEmbeddingModels.length; index += 1) {
    const modelName = candidateEmbeddingModels[index];
    const model = genAI.getGenerativeModel({ model: modelName });

    try {
      const response = await model.embedContent(normalized);
      const values = Array.isArray(response.embedding.values)
        ? response.embedding.values.filter((value) => Number.isFinite(value))
        : [];

      if (values.length) {
        return values;
      }
    } catch (error) {
      lastError = error;

      if (
        !shouldRetryWithNextModel(error) ||
        index === candidateEmbeddingModels.length - 1
      ) {
        break;
      }

      const message = error instanceof Error ? error.message : 'Unknown embedding error';
      console.warn(
        `[Gemini Embeddings] Model "${modelName}" unavailable, retrying with next candidate. ${message}`
      );
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : 'Gemini embedding request failed';
  throw new Error(`Gemini embedding error: ${message}`);
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (!left.length || !right.length || left.length !== right.length) {
    return 0;
  }

  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = Number.isFinite(left[index]) ? left[index] : 0;
    const rightValue = Number.isFinite(right[index]) ? right[index] : 0;
    dotProduct += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (!leftMagnitude || !rightMagnitude) {
    return 0;
  }

  return dotProduct / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}
