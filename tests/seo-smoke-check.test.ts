import { createRequire } from 'node:module';
import { vi } from 'vitest';

const requireFromTest = createRequire(import.meta.url);
const {
  assertCanonicalMatchesPage,
  checkArticleHtml,
  checkCanonicalHtml,
  classifyArticleHtml,
  extractCanonicalHref,
  fetchTextRoute,
  getPublicArticleItems,
  normalizeBaseUrl,
  parseArgs,
  resolveConfiguredArticleUrl,
  resolveSupportedArticleCanonical,
  runSeoSmoke,
} = requireFromTest('../scripts/seo-smoke-check.js') as {
  assertCanonicalMatchesPage: (
    canonicalHref: string,
    pageUrl: string,
    expectedOrigin: string
  ) => URL;
  checkArticleHtml: (
    baseUrl: string,
    articleUrl: string,
    timeoutMs: number
  ) => Promise<void>;
  checkCanonicalHtml: (
    baseUrl: string,
    path: string,
    timeoutMs: number
  ) => Promise<{ text: string; url: string; canonical: string }>;
  classifyArticleHtml: (html: string, options?: { requireRelatedLink?: boolean }) => {
    ready: boolean;
    hasHeadline: boolean;
    hasBody: boolean;
    hasRelatedLink: boolean;
    hasLoadingPlaceholder: boolean;
    relatedLinkCount: number;
    issues: string[];
  };
  extractCanonicalHref: (html: string) => string;
  fetchTextRoute: (
    baseUrl: string,
    pathOrUrl: string,
    accept: string,
    timeoutMs: number
  ) => Promise<{ response: Response; text: string; url: string; requestedUrl: string }>;
  getPublicArticleItems: (payload: unknown) => Array<Record<string, unknown>>;
  normalizeBaseUrl: (raw: string) => string;
  parseArgs: (argv: string[]) => {
    help: boolean;
    baseUrl: string;
    articleUrl: string;
    timeoutMs: number;
  };
  resolveConfiguredArticleUrl: (baseUrl: string, articleUrl: string) => string | null;
  resolveSupportedArticleCanonical: (baseUrl: string, canonicalUrl: unknown) => string;
  runSeoSmoke: (options: {
    baseUrl: string;
    articleUrl: string;
    timeoutMs: number;
  }) => Promise<void>;
};

function createResponse(body: string, url: string, contentType = 'text/html') {
  return {
    status: 200,
    url,
    headers: new Headers({ 'content-type': contentType }),
    text: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function createReadyArticleHtml(canonical: string, includeRelatedLink = true) {
  return `
    <html>
      <head><link rel="canonical" href="${canonical}"></head>
      <body>
        <h1>A substantive article headline</h1>
        <article data-article-body><p>${'A'.repeat(100)}</p></article>
        <section data-related-articles>
          ${includeRelatedLink ? '<a href="/main/article/related-story">Related story</a>' : ''}
        </section>
      </body>
    </html>
  `;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

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

  it('does not allow a paragraph outside data-article-body to satisfy the body check', () => {
    const result = classifyArticleHtml(`
      <main>
        <h1>A substantive article headline</h1>
        <p>${'Unrelated layout paragraph. '.repeat(6)}</p>
        <div data-article-body><span>Short body</span></div>
      </main>
    `);

    expect(result.ready).toBe(false);
    expect(result.hasBody).toBe(false);
    expect(result.issues).toContain(
      'initial HTML has no marked article body with a substantive paragraph'
    );
  });

  it('requires a valid internal anchor inside the marked related section only when eligible', () => {
    const html = `
      <main>
        <h1>A substantive article headline</h1>
        <div data-article-body><p>${'A'.repeat(100)}</p></div>
        <a href="/main/article/outside">Outside link</a>
        <section data-related-articles><a href="https://example.com/story">External</a></section>
      </main>
    `;

    expect(classifyArticleHtml(html)).toMatchObject({ ready: true, hasRelatedLink: false });
    expect(classifyArticleHtml(html, { requireRelatedLink: true })).toMatchObject({
      ready: false,
      hasRelatedLink: false,
      relatedLinkCount: 0,
    });
  });
});

describe('SEO smoke canonical validation', () => {
  const baseUrl = 'https://lokswami.com';

  it('accepts the exact canonical expected for the checked page', () => {
    expect(
      assertCanonicalMatchesPage(
        'https://lokswami.com/main/category/politics',
        'https://lokswami.com/main/category/politics',
        baseUrl
      ).toString()
    ).toBe('https://lokswami.com/main/category/politics');
  });

  it('rejects a wrong same-origin canonical path', () => {
    expect(() =>
      assertCanonicalMatchesPage(
        'https://lokswami.com/main',
        'https://lokswami.com/main/category/politics',
        baseUrl
      )
    ).toThrow(/does not match the checked page URL/i);
  });

  it('rejects an external-origin canonical', () => {
    expect(() =>
      assertCanonicalMatchesPage(
        'https://example.com/main/category/politics',
        'https://lokswami.com/main/category/politics',
        baseUrl
      )
    ).toThrow(/canonical uses another origin/i);
  });

  it('validates the canonical against the final URL after an intentional redirect', async () => {
    const finalUrl = 'https://lokswami.com/main/category/politics';
    const response = createResponse(
      `<html><head><link rel="canonical" href="${finalUrl}"></head></html>`,
      finalUrl
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    await expect(checkCanonicalHtml(baseUrl, '/politics', 1000)).resolves.toMatchObject({
      url: finalUrl,
      canonical: finalUrl,
    });
  });

  it('preserves meaningful query-string differences', () => {
    const pageUrl = 'https://lokswami.com/main/epaper?city=indore&page=2';

    expect(assertCanonicalMatchesPage(pageUrl, pageUrl, baseUrl).toString()).toBe(pageUrl);
    expect(() =>
      assertCanonicalMatchesPage(
        'https://lokswami.com/main/epaper?city=indore',
        pageUrl,
        baseUrl
      )
    ).toThrow(/does not match the checked page URL/i);
    expect(() =>
      assertCanonicalMatchesPage(
        'https://lokswami.com/main/epaper?city=bhopal&page=2',
        pageUrl,
        baseUrl
      )
    ).toThrow(/does not match the checked page URL/i);
  });

  it('normalizes fragments, default ports, and the documented trailing-slash tolerance', () => {
    expect(
      assertCanonicalMatchesPage(
        'https://lokswami.com:443/main/epaper/#archive',
        'https://lokswami.com/main/epaper',
        baseUrl
      ).toString()
    ).toBe('https://lokswami.com/main/epaper');
  });

  it('accepts a supported configured article canonical override from article detail', async () => {
    const articleUrl = `${baseUrl}/main/article/story-one`;
    const canonicalOverride = `${baseUrl}/main/article/preferred-story?edition=evening`;
    const articleHtml = createReadyArticleHtml(canonicalOverride);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input));
        if (url.pathname === '/robots.txt') {
          return createResponse(
            `User-agent: *\nSitemap: ${baseUrl}/sitemap.xml\nSitemap: ${baseUrl}/news-sitemap.xml`,
            url.toString(),
            'text/plain'
          );
        }
        if (url.pathname === '/sitemap.xml') {
          return createResponse('<urlset></urlset>', url.toString(), 'application/xml');
        }
        if (url.pathname === '/news-sitemap.xml') {
          return createResponse(
            '<urlset xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"></urlset>',
            url.toString(),
            'application/xml'
          );
        }
        if (url.pathname === '/api/v1/public/articles' && url.searchParams.has('limit')) {
          return createResponse(
            JSON.stringify({ data: { items: [{ id: 'one', slug: 'story-one' }] } }),
            url.toString(),
            'application/json'
          );
        }
        if (url.pathname === '/api/v1/public/articles/story-one') {
          return createResponse(
            JSON.stringify({
              data: {
                id: 'one',
                slug: 'story-one',
                seo: { canonicalUrl: canonicalOverride },
              },
            }),
            url.toString(),
            'application/json'
          );
        }
        if (url.toString() === articleUrl) {
          return createResponse(articleHtml, articleUrl);
        }

        return createResponse(
          `<html><head><link rel="canonical" href="${url.toString()}"></head></html>`,
          url.toString()
        );
      })
    );

    await expect(
      runSeoSmoke({ baseUrl, articleUrl: '', timeoutMs: 1000 })
    ).resolves.toBeUndefined();
  });

  it('uses the final public article URL when no canonical override is configured', async () => {
    const requestedUrl = `${baseUrl}/main/article/legacy-story`;
    const finalUrl = `${baseUrl}/main/article/current-story?edition=morning`;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input));
        if (url.pathname === '/api/v1/public/articles' && url.searchParams.has('limit')) {
          return createResponse(
            JSON.stringify({ data: { items: [{ id: 'one', slug: 'current-story' }] } }),
            url.toString(),
            'application/json'
          );
        }
        if (url.pathname === '/api/v1/public/articles/legacy-story') {
          return createResponse(
            JSON.stringify({ data: { id: 'one', slug: 'current-story', seo: { canonicalUrl: '' } } }),
            url.toString(),
            'application/json'
          );
        }
        return createResponse(createReadyArticleHtml(finalUrl), finalUrl);
      })
    );

    await expect(checkArticleHtml(baseUrl, requestedUrl, 1000)).resolves.toBeUndefined();
  });

  it('rejects article HTML without a marked related anchor when the feed has another eligible article', async () => {
    const articleUrl = `${baseUrl}/main/article/current-story`;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input));
        if (url.pathname === '/api/v1/public/articles' && url.searchParams.has('limit')) {
          return createResponse(
            JSON.stringify({
              data: {
                items: [
                  { id: 'current', slug: 'current-story' },
                  { id: 'related', slug: 'eligible-related-story' },
                ],
              },
            }),
            url.toString(),
            'application/json'
          );
        }
        if (url.pathname === '/api/v1/public/articles/current-story') {
          return createResponse(
            JSON.stringify({
              data: { id: 'current', slug: 'current-story', seo: { canonicalUrl: '' } },
            }),
            url.toString(),
            'application/json'
          );
        }
        return createResponse(createReadyArticleHtml(articleUrl, false), articleUrl);
      })
    );

    await expect(checkArticleHtml(baseUrl, articleUrl, 1000)).rejects.toThrow(
      /no valid internal link inside the related-article section/i
    );
  });

  it('permits article HTML without a related anchor when the feed has no eligible related article', async () => {
    const articleUrl = `${baseUrl}/main/article/current-story`;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input));
        if (url.pathname === '/api/v1/public/articles' && url.searchParams.has('limit')) {
          return createResponse(
            JSON.stringify({ data: { items: [{ id: 'current', slug: 'current-story' }] } }),
            url.toString(),
            'application/json'
          );
        }
        if (url.pathname === '/api/v1/public/articles/current-story') {
          return createResponse(
            JSON.stringify({
              data: { id: 'current', slug: 'current-story', seo: { canonicalUrl: '' } },
            }),
            url.toString(),
            'application/json'
          );
        }
        return createResponse(createReadyArticleHtml(articleUrl, false), articleUrl);
      })
    );

    await expect(checkArticleHtml(baseUrl, articleUrl, 1000)).resolves.toBeUndefined();
  });

  it('rejects a same-origin article canonical that is not the configured override', async () => {
    const articleUrl = `${baseUrl}/main/article/story-one`;
    const configuredCanonical = `${baseUrl}/main/article/preferred-story`;
    const renderedCanonical = `${baseUrl}/main/article/different-story`;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input));
        if (url.pathname === '/api/v1/public/articles' && url.searchParams.has('limit')) {
          return createResponse(
            JSON.stringify({ data: { items: [{ id: 'one', slug: 'story-one' }] } }),
            url.toString(),
            'application/json'
          );
        }
        if (url.pathname === '/api/v1/public/articles/story-one') {
          return createResponse(
            JSON.stringify({
              data: {
                id: 'one',
                slug: 'story-one',
                seo: { canonicalUrl: configuredCanonical },
              },
            }),
            url.toString(),
            'application/json'
          );
        }
        return createResponse(createReadyArticleHtml(renderedCanonical), articleUrl);
      })
    );

    await expect(checkArticleHtml(baseUrl, articleUrl, 1000)).rejects.toThrow(
      /does not match the checked page URL expectation.*preferred-story/i
    );
  });

  it('rejects invalid or unsupported configured canonical overrides', () => {
    expect(() => resolveSupportedArticleCanonical(baseUrl, '/main/article/preferred')).toThrow(
      /valid absolute HTTP\(S\) URL/i
    );
    expect(() =>
      resolveSupportedArticleCanonical(baseUrl, 'https://example.com/main/article/preferred')
    ).toThrow(/unsupported origin/i);
  });
});

describe('SEO smoke response timeout', () => {
  const baseUrl = 'https://lokswami.com';

  it('reads normal response headers and body', async () => {
    const response = createResponse('complete body', `${baseUrl}/main`);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    await expect(fetchTextRoute(baseUrl, '/main', 'text/html', 1000)).resolves.toMatchObject({
      response,
      text: 'complete body',
      url: `${baseUrl}/main`,
    });
  });

  it('times out when a request never returns headers', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('aborted', 'AbortError')),
            { once: true }
          );
        })
      )
    );

    const request = fetchTextRoute(baseUrl, '/main', 'text/html', 50);
    const assertion = expect(request).rejects.toThrow(/timed out after 50ms.*headers or body/i);
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out when headers arrive but the response body stalls', async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | null = null;
    const response = {
      status: 200,
      url: `${baseUrl}/main`,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: () =>
        new Promise<string>((_resolve, reject) => {
          requestSignal?.addEventListener(
            'abort',
            () => reject(new DOMException('aborted', 'AbortError')),
            { once: true }
          );
        }),
    } as unknown as Response;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        requestSignal = init?.signal || null;
        return response;
      })
    );

    const request = fetchTextRoute(baseUrl, '/main', 'text/html', 50);
    const assertion = expect(request).rejects.toThrow(/timed out after 50ms.*headers or body/i);
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans up the timeout after a successful body read', async () => {
    vi.useFakeTimers();
    const response = createResponse('complete body', `${baseUrl}/main`);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    await fetchTextRoute(baseUrl, '/main', 'text/html', 50);

    expect(vi.getTimerCount()).toBe(0);
  });
});
