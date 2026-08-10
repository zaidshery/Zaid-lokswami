import { createRequire } from 'node:module';

const requireFromTest = createRequire(import.meta.url);
const {
  classifyArticleHtml,
  extractCanonicalHref,
  getPublicArticleItems,
  normalizeBaseUrl,
  parseArgs,
  resolveConfiguredArticleUrl,
} = requireFromTest('../scripts/seo-smoke-check.js') as {
  classifyArticleHtml: (html: string) => {
    ready: boolean;
    hasHeadline: boolean;
    hasBody: boolean;
    hasLoadingPlaceholder: boolean;
    issues: string[];
  };
  extractCanonicalHref: (html: string) => string;
  getPublicArticleItems: (payload: unknown) => Array<Record<string, unknown>>;
  normalizeBaseUrl: (raw: string) => string;
  parseArgs: (argv: string[]) => {
    help: boolean;
    baseUrl: string;
    articleUrl: string;
    timeoutMs: number;
  };
  resolveConfiguredArticleUrl: (baseUrl: string, articleUrl: string) => string | null;
};

describe('SEO deploy smoke parser', () => {
  it('parses positional and explicit smoke options', () => {
    expect(
      parseArgs([
        'https://lokswami.com/',
        '--articleUrl=/main/article/test-story',
        '--timeoutMs=22000',
      ])
    ).toEqual({
      help: false,
      baseUrl: 'https://lokswami.com/',
      articleUrl: '/main/article/test-story',
      timeoutMs: 22000,
    });
    expect(normalizeBaseUrl('https://lokswami.com///')).toBe('https://lokswami.com');
  });

  it('keeps a configured article check on the deployment origin', () => {
    expect(
      resolveConfiguredArticleUrl('https://lokswami.com', '/main/article/test-story')
    ).toBe('https://lokswami.com/main/article/test-story');
    expect(() =>
      resolveConfiguredArticleUrl('https://lokswami.com', 'https://example.com/article')
    ).toThrow(/same origin/i);
  });

  it('extracts canonical links regardless of attribute order', () => {
    expect(
      extractCanonicalHref(
        '<html><head><link href="https://lokswami.com/main" data-x="1" rel="alternate canonical"></head></html>'
      )
    ).toBe('https://lokswami.com/main');
  });

  it('reads both API v1 envelopes and legacy article lists', () => {
    const item = { id: 'one', slug: 'story-one' };
    expect(getPublicArticleItems({ data: { items: [item] } })).toEqual([item]);
    expect(getPublicArticleItems({ items: [item] })).toEqual([item]);
  });

  it('records the current loading-only article HTML as the known Phase 2 gap', () => {
    const result = classifyArticleHtml(
      '<main><p>लेख लोड हो रहा है...</p><script>window.__next_f=[]</script></main>'
    );

    expect(result.ready).toBe(false);
    expect(result.hasHeadline).toBe(false);
    expect(result.hasBody).toBe(false);
    expect(result.hasLoadingPlaceholder).toBe(true);
    expect(result.issues).toHaveLength(3);
  });

  it('accepts crawlable article HTML with a headline and marked body', () => {
    const result = classifyArticleHtml(`
      <main>
        <h1>इंदौर की प्रमुख खबर का पूरा शीर्षक</h1>
        <article data-article-body>
          <p>यह सर्वर से भेजा गया समाचार अनुच्छेद है और इसकी लंबाई इतनी रखी गई है कि स्मोक जांच इसे वास्तविक लेख सामग्री माने, केवल छोटा प्लेसहोल्डर नहीं।</p>
        </article>
      </main>
    `);

    expect(result).toMatchObject({
      ready: true,
      hasHeadline: true,
      hasBody: true,
      hasLoadingPlaceholder: false,
    });
  });
});
