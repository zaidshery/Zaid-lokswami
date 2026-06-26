import { describe, expect, it } from 'vitest';
import { buildPolishedPlainTextHtml } from '@/components/forms/RichTextEditor';

describe('RichTextEditor pasted formatting', () => {
  it('turns pasted article body text into headings and paragraphs automatically', () => {
    const html = buildPolishedPlainTextHtml(
      [
        'Body',
        'Village tension after land dispute',
        '',
        'This lead paragraph has enough newsroom copy to be treated as article body text after a pasted section heading. It should become a clean paragraph.',
        '',
        'Hospital questions after emergency care',
        '',
        'This second section has enough detail to prove the standalone line before it is a section heading, not a short paragraph.',
      ].join('\n')
    );

    expect(html).not.toContain('<p>Body</p>');
    expect(html).toContain('<h2>Village tension after land dispute</h2>');
    expect(html).toContain(
      '<p>This lead paragraph has enough newsroom copy to be treated as article body text after a pasted section heading. It should become a clean paragraph.</p>'
    );
    expect(html).toContain('<h2>Hospital questions after emergency care</h2>');
  });

  it('keeps pasted bullet and numbered groups as real lists', () => {
    const html = buildPolishedPlainTextHtml(
      [
        '- First injured person',
        '- Second injured person',
        '',
        '1. Police statement',
        '2. Hospital update',
      ].join('\n')
    );

    expect(html).toContain('<ul><li>First injured person</li><li>Second injured person</li></ul>');
    expect(html).toContain('<ol><li>Police statement</li><li>Hospital update</li></ol>');
  });
});
