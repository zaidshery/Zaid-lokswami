import { describe, expect, it } from 'vitest';
import {
  articleDocumentToHtml,
  migrateArticleHtmlToDocument,
  normalizeArticleDocument,
} from '@/lib/content/articleDocument';

describe('article structured document migration', () => {
  it('migrates existing HTML into ordered block JSON without dropping rich blocks', () => {
    const html = [
      '<h2>Context</h2>',
      '<p>Verified reporting paragraph.</p>',
      '<blockquote>Attributed quote</blockquote>',
      '<table><tbody><tr><td>Data</td></tr></tbody></table>',
      '[youtube:https://www.youtube.com/watch?v=abc123]',
    ].join('');
    const document = migrateArticleHtmlToDocument(html);

    expect(document.version).toBe(1);
    expect(document.blocks.map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
      'quote',
      'table',
      'embed',
    ]);
    expect(articleDocumentToHtml(document)).toContain('<table>');
    expect(articleDocumentToHtml(document)).toContain('[youtube:');
  });

  it('normalizes invalid documents through the HTML compatibility path', () => {
    const document = normalizeArticleDocument({ version: 9 }, '<p>Legacy article</p>');
    expect(document.blocks).toEqual([
      expect.objectContaining({ type: 'paragraph', text: 'Legacy article' }),
    ]);
  });
});
