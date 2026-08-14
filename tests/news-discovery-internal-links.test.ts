import { describe, expect, it } from 'vitest';
import { listRelatedPublicArticles } from '@/lib/server/publicArticles';

describe('SEO Phase 8 - News-Led Discovery & Contextual Internal Linking', () => {
  const currentArticle = {
    id: 'art-current-1',
    href: '/main/article/indore-cleanliness-drive-2026',
    category: 'Regional',
  };

  it('retrieves published related articles without including the current article', async () => {
    const result = await listRelatedPublicArticles(currentArticle, {
      limit: 6,
      source: 'file',
    });

    expect(Array.isArray(result.items)).toBe(true);
    expect(result.limit).toBe(6);

    for (const item of result.items) {
      expect(item.id).not.toBe(currentArticle.id);
      expect(item.href).not.toBe(currentArticle.href);
      expect(item.href).toMatch(/^\/main\/article\//);
    }
  });

  it('guarantees unique destination URLs in related articles', async () => {
    const result = await listRelatedPublicArticles(currentArticle, {
      limit: 10,
      source: 'file',
    });

    const hrefs = result.items.map((i) => i.href);
    const uniqueHrefs = new Set(hrefs);
    expect(uniqueHrefs.size).toBe(hrefs.length);
  });
});
