import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const requireFromTest = createRequire(import.meta.url);

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Hostinger static asset safeguards', () => {
  it('decodes encoded app-route chunk paths before looking up files', () => {
    const {
      normalizeStaticRelativePath,
    } = requireFromTest('../scripts/start-hostinger.js') as {
      normalizeStaticRelativePath: (requestUrl: string) => string;
    };

    expect(
      normalizeStaticRelativePath(
        '/_next/static/chunks/app/%28reader%29/main/sitemap/page-a.js'
      )
    ).toBe('chunks/app/(reader)/main/sitemap/page-a.js');
    expect(
      normalizeStaticRelativePath('/_next/static/chunks/app/%2e%2e/server.js')
    ).toBe('');
  });

  it('recovers from stale Next assets served through every static alias', () => {
    const layout = read('app/layout.tsx');

    expect(layout).toContain("assetUrl.indexOf('/_next/static/') !== -1");
    expect(layout).toContain("assetUrl.indexOf('/next/static/') !== -1");
    expect(layout).toContain("assetUrl.indexOf('/__next_static__/') !== -1");
    expect(layout).toContain('text\\\\/(?:html|plain)');
    expect(layout).toContain('strict MIME type checking');
  });

  it('checks the sitemap route chunk during deploy smoke tests', () => {
    const smoke = read('scripts/smoke-check-deploy.js');

    expect(smoke).toContain("'/main/sitemap'");
  });
});
