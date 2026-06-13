import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('e-paper loading performance', () => {
  it('uses a smaller cached first page without an internal HTTP round trip', () => {
    const page = read('app/(reader)/main/epaper/page.tsx');

    expect(page).toContain('const EPAPER_LIMIT = 12');
    expect(page).toContain('unstable_cache');
    expect(page).toContain('listPublicEpaperFeed');
    expect(page).not.toContain('resolveRequestOrigin');
    expect(page).not.toContain('/api/v1/public/epapers/latest');
  });

  it('optimizes grid covers and prioritizes only the first visible row', () => {
    const client = read('app/(reader)/main/epaper/EPaperPageClient.tsx');
    const grid = client.slice(
      client.indexOf('{epapers.map((paper, index)'),
      client.indexOf('{hasMoreList ?')
    );

    expect(grid).toContain('quality={60}');
    expect(grid).toContain('priority={index < 4}');
    expect(grid).not.toContain('unoptimized');
  });

  it('keeps optimized thumbnail variants cached for one day', () => {
    const config = read('next.config.js');

    expect(config).toContain("formats: ['image/webp']");
    expect(config).toContain('minimumCacheTTL: 86400');
  });

  it('bounds a stalled public MongoDB query before using fallback storage', () => {
    const feed = read('lib/server/publicEpaperFeed.ts');

    expect(feed).toContain('const DEFAULT_QUERY_TIMEOUT_MS = 2000');
    expect(feed).toContain('MONGODB_PUBLIC_QUERY_TIMEOUT_MS');
    expect(feed).toContain('reportMongoUnavailable');
  });
});
