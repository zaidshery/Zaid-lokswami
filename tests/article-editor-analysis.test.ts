import { describe, expect, it } from 'vitest';
import { analyzeArticleEditorContent } from '@/lib/utils/articleEditorAnalysis';

describe('article editor analysis', () => {
  it('extracts outline and editorial counts from rich article HTML', () => {
    const insights = analyzeArticleEditorContent(`
      <p>Lead paragraph with <a href="https://example.com">source link</a>.</p>
      <h2>Ground Situation</h2>
      <p>Field copy continues here.</p>
      <h3>What Officials Said</h3>
      <figure>
        <img src="https://cdn.example.com/photo.jpg" alt="Reporter photo" />
      </figure>
      <div class="article-resource-card">Reference</div>
      <table><thead><tr><th>A</th></tr></thead><tbody><tr><td>B</td></tr></tbody></table>
    `);

    expect(insights.wordCount).toBeGreaterThan(5);
    expect(insights.headingCount).toBe(2);
    expect(insights.imageCount).toBe(1);
    expect(insights.linkCount).toBe(1);
    expect(insights.tableCount).toBe(1);
    expect(insights.resourceCount).toBe(1);
    expect(insights.outline).toEqual([
      {
        id: 'ground-situation',
        level: 2,
        text: 'Ground Situation',
      },
      {
        id: 'what-officials-said',
        level: 3,
        text: 'What Officials Said',
      },
    ]);
  });
});
