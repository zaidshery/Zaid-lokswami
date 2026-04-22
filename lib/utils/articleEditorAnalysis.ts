export type ArticleEditorOutlineItem = {
  id: string;
  level: 2 | 3;
  text: string;
};

export type ArticleEditorInsights = {
  wordCount: number;
  characterCount: number;
  paragraphCount: number;
  headingCount: number;
  imageCount: number;
  tableCount: number;
  linkCount: number;
  resourceCount: number;
  outline: ArticleEditorOutlineItem[];
};

function stripHtmlTags(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugifyHeading(value: string, index: number) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `section-${index + 1}`;
}

function extractOutline(html: string): ArticleEditorOutlineItem[] {
  const matches = Array.from(html.matchAll(/<(h2|h3)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi));
  return matches
    .map((match, index) => {
      const tag = match[1]?.toLowerCase();
      const text = stripHtmlTags(match[2] || '');
      if (!text) return null;
      return {
        id: slugifyHeading(text, index),
        level: tag === 'h3' ? 3 : 2,
        text,
      } satisfies ArticleEditorOutlineItem;
    })
    .filter((item): item is ArticleEditorOutlineItem => Boolean(item));
}

export function analyzeArticleEditorContent(html: string): ArticleEditorInsights {
  const safeHtml = typeof html === 'string' ? html : '';
  const plainText = stripHtmlTags(safeHtml);
  const words = plainText ? plainText.split(/\s+/).filter(Boolean) : [];
  const paragraphCount = Math.max(
    (safeHtml.match(/<p(?:\s[^>]*)?>/gi) || []).length,
    plainText ? plainText.split(/\n+/).filter((segment) => segment.trim()).length : 0
  );

  return {
    wordCount: words.length,
    characterCount: plainText.length,
    paragraphCount,
    headingCount: (safeHtml.match(/<h[23](?:\s[^>]*)?>/gi) || []).length,
    imageCount: (safeHtml.match(/<img(?:\s[^>]*)?>/gi) || []).length,
    tableCount: (safeHtml.match(/<table(?:\s[^>]*)?>/gi) || []).length,
    linkCount: (safeHtml.match(/<a(?:\s[^>]*)?>/gi) || []).length,
    resourceCount: (safeHtml.match(/article-resource-card/gi) || []).length,
    outline: extractOutline(safeHtml),
  };
}
