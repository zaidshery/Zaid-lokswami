export const ARTICLE_DOCUMENT_VERSION = 1 as const;

export type ArticleDocumentBlockType =
  | 'paragraph'
  | 'heading'
  | 'quote'
  | 'list'
  | 'image'
  | 'table'
  | 'embed'
  | 'raw_html';

export type ArticleDocumentBlock = {
  id: string;
  type: ArticleDocumentBlockType;
  html: string;
  text: string;
  attrs: Record<string, string | number | boolean>;
};

export type ArticleDocument = {
  version: typeof ARTICLE_DOCUMENT_VERSION;
  blocks: ArticleDocumentBlock[];
};

function stripHtml(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function blockTypeForTag(tag: string, html: string): ArticleDocumentBlockType {
  if (/^h[1-6]$/i.test(tag)) return 'heading';
  if (tag === 'blockquote') return 'quote';
  if (tag === 'ul' || tag === 'ol') return 'list';
  if (tag === 'figure' || /<img\b/i.test(html)) return 'image';
  if (tag === 'table') return 'table';
  if (tag === 'iframe' || /\[(youtube|facebook|instagram|x|social):/i.test(html)) {
    return 'embed';
  }
  if (tag === 'p') return 'paragraph';
  return 'raw_html';
}

export function migrateArticleHtmlToDocument(value: unknown): ArticleDocument {
  const html = typeof value === 'string' ? value.trim() : '';
  if (!html) return { version: ARTICLE_DOCUMENT_VERSION, blocks: [] };

  const matches = Array.from(
    html.matchAll(
      /<(h[1-6]|p|blockquote|ul|ol|figure|table|iframe)\b[^>]*>[\s\S]*?<\/\1>|\[(?:youtube|facebook|instagram|x|social):[^\]]+\]/gi
    )
  );
  const blocks: ArticleDocumentBlock[] = [];
  let cursor = 0;
  const addBlock = (blockHtml: string, tag = '') => {
    const normalized = blockHtml.trim();
    if (!normalized) return;
    const resolvedTag = tag || normalized.match(/^<([a-z0-9]+)/i)?.[1]?.toLowerCase() || '';
    blocks.push({
      id: `block-${blocks.length + 1}`,
      type: blockTypeForTag(resolvedTag, normalized),
      html: normalized,
      text: stripHtml(normalized),
      attrs: /^h([1-6])$/i.test(resolvedTag)
        ? { level: Number(resolvedTag.slice(1)) }
        : {},
    });
  };

  matches.forEach((match) => {
    if (typeof match.index === 'number' && match.index > cursor) {
      addBlock(html.slice(cursor, match.index));
    }
    addBlock(match[0], String(match[1] || '').toLowerCase());
    cursor = (match.index || 0) + match[0].length;
  });
  if (cursor < html.length) addBlock(html.slice(cursor));
  if (!blocks.length) addBlock(`<p>${html}</p>`, 'p');
  return { version: ARTICLE_DOCUMENT_VERSION, blocks };
}

export function normalizeArticleDocument(input: unknown, fallbackHtml = ''): ArticleDocument {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return migrateArticleHtmlToDocument(fallbackHtml);
  }
  const source = input as Record<string, unknown>;
  if (!Array.isArray(source.blocks)) return migrateArticleHtmlToDocument(fallbackHtml);
  const allowed = new Set<ArticleDocumentBlockType>([
    'paragraph',
    'heading',
    'quote',
    'list',
    'image',
    'table',
    'embed',
    'raw_html',
  ]);
  const blocks = source.blocks
    .slice(0, 2000)
    .map((entry, index): ArticleDocumentBlock | null => {
      const block = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : null;
      if (!block) return null;
      const html = typeof block.html === 'string' ? block.html.trim() : '';
      if (!html) return null;
      const type = allowed.has(block.type as ArticleDocumentBlockType)
        ? (block.type as ArticleDocumentBlockType)
        : 'raw_html';
      return {
        id: typeof block.id === 'string' && block.id.trim() ? block.id.trim() : `block-${index + 1}`,
        type,
        html,
        text: typeof block.text === 'string' ? block.text.trim() : stripHtml(html),
        attrs:
          block.attrs && typeof block.attrs === 'object' && !Array.isArray(block.attrs)
            ? (block.attrs as Record<string, string | number | boolean>)
            : {},
      };
    })
    .filter((block): block is ArticleDocumentBlock => Boolean(block));
  return { version: ARTICLE_DOCUMENT_VERSION, blocks };
}

export function articleDocumentToHtml(document: ArticleDocument) {
  return document.blocks.map((block) => block.html).join('\n');
}
