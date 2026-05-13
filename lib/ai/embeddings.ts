type ArticleEmbeddingSource = {
  title: string;
  category?: string;
  summary?: string;
  content?: string;
  aiSummary?: string;
};

const LOCAL_EMBEDDING_DIMENSIONS = 64;

function normalizeText(input: string) {
  return input.replace(/\s+/g, ' ').trim();
}

function hashToken(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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
  const vector = new Array<number>(LOCAL_EMBEDDING_DIMENSIONS).fill(0);
  const tokens = normalizeText(text).toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];

  for (const token of tokens) {
    const hash = hashToken(token);
    const index = hash % LOCAL_EMBEDDING_DIMENSIONS;
    vector[index] += token.length >= 6 ? 1.35 : 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) return vector;
  return vector.map((value) => Number((value / magnitude).toFixed(6)));
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
