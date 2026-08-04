import { describe, expect, it } from 'vitest';
import Article from '@/lib/models/Article';

describe('Article revision snapshots', () => {
  it('allows an incomplete draft to be stored as a revision snapshot', async () => {
    const article = new Article({
      title: 'Draft in progress',
      revisions: [
        {
          title: '',
          summary: '',
          content: '',
          image: '',
          category: '',
          author: '',
        },
      ],
    });

    await expect(article.validate()).resolves.toBeUndefined();
  });

  it('defaults missing legacy revision fields instead of rejecting the article update', async () => {
    const article = new Article({
      title: 'Legacy draft',
      revisions: [{}],
    });

    await expect(article.validate()).resolves.toBeUndefined();
    expect(article.revisions[0]).toEqual(
      expect.objectContaining({
        title: '',
        summary: '',
        content: '',
        image: '',
        category: '',
        author: '',
      })
    );
  });
});
