import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

type HeaderRule = {
  source: string;
  has?: Array<{ type: string; key: string }>;
  missing?: Array<{ type: string; key: string }>;
  headers: Array<{ key: string; value: string }>;
};

const nextConfig = require('../next.config.js') as {
  headers: () => Promise<HeaderRule[]>;
};

function headerValue(rule: HeaderRule, key: string) {
  return rule.headers.find(
    (header) => header.key.toLowerCase() === key.toLowerCase()
  )?.value;
}

function hasSignal(
  rules: Array<{ type: string; key: string }> | undefined,
  type: string,
  key: string
) {
  return Boolean(
    rules?.some(
      (item) =>
        item.type.toLowerCase() === type.toLowerCase() &&
        item.key.toLowerCase() === key.toLowerCase()
    )
  );
}

describe('App Router Flight cache headers', () => {
  it('prevents RSC flight payloads from being cached as public pages', async () => {
    const rules = await nextConfig.headers();
    const rscHeaderRule = rules.find(
      (rule) => rule.source === '/:path*' && hasSignal(rule.has, 'header', 'RSC')
    );
    const rscQueryRule = rules.find(
      (rule) => rule.source === '/:path*' && hasSignal(rule.has, 'query', '_rsc')
    );

    expect(headerValue(rscHeaderRule!, 'Cache-Control')).toContain('no-store');
    expect(headerValue(rscHeaderRule!, 'CDN-Cache-Control')).toBe('no-store');
    expect(headerValue(rscHeaderRule!, 'Vary')).toContain('RSC');
    expect(headerValue(rscQueryRule!, 'Cache-Control')).toContain('no-store');
  });

  it('does not apply public /main page cache headers to flight requests', async () => {
    const rules = await nextConfig.headers();
    const mainRule = rules.find((rule) => rule.source === '/main');

    expect(mainRule).toBeTruthy();
    expect(headerValue(mainRule!, 'Cache-Control')).toContain('s-maxage=120');
    expect(headerValue(mainRule!, 'Vary')).toContain('Next-Router-State-Tree');
    expect(hasSignal(mainRule?.missing, 'header', 'RSC')).toBe(true);
    expect(hasSignal(mainRule?.missing, 'query', '_rsc')).toBe(true);
  });
});
