import { describe, expect, it } from 'vitest';
import {
  buildArticleImageFigureHtml,
  buildArticleResourceCardHtml,
  buildArticleTableHtml,
  buildDefaultArticlePermalink,
} from '@/lib/utils/articleEditorTemplates';

describe('article editor templates', () => {
  it('builds inline image markup with caption and source credit', () => {
    const html = buildArticleImageFigureHtml({
      src: 'cdn.example.com/photo.jpg',
      alt: 'Flooded street',
      caption: 'Waterlogging near the city square.',
      sourceName: 'Lokswami Reporter',
      sourceUrl: 'lokswami.com/source',
    });

    expect(html).toContain('<figure class="article-inline-figure">');
    expect(html).toContain('https://cdn.example.com/photo.jpg');
    expect(html).toContain('Waterlogging near the city square.');
    expect(html).toContain('Source: <a href="https://lokswami.com/source"');
  });

  it('builds resource cards and comparison tables for richer editing', () => {
    const card = buildArticleResourceCardHtml({
      title: 'Official Notice',
      url: 'example.com/notice',
      description: 'Use this for the exact government circular.',
    });
    const table = buildArticleTableHtml({ columns: 2, rows: 2 });

    expect(card).toContain('Official Notice');
    expect(card).toContain('https://example.com/notice');
    expect(card).toContain('Use this for the exact government circular.');

    expect(table).toContain('<table>');
    expect(table).toContain('<th>Heading 1</th>');
    expect(table).toContain('<td>Row 2, Col 2</td>');
  });

  it('builds the default public permalink for existing articles', () => {
    expect(buildDefaultArticlePermalink('article-123', 'https://lokswami.com/')).toBe(
      'https://lokswami.com/main/article/article-123'
    );
  });
});
