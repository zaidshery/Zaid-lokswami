import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('mobile runtime compatibility', () => {
  it('keeps pre-hydration scripts compatible with older supported browsers', () => {
    const layout = read('app/layout.tsx');
    const scripts = layout.slice(
      layout.indexOf('const THEME_INIT_SCRIPT'),
      layout.indexOf('const googleTagManagerId')
    );

    expect(scripts).not.toContain('Promise.allSettled');
    expect(scripts).not.toContain('?.');
    expect(scripts).not.toContain('.finally(');
    expect(scripts).toContain('function settleAll(promises)');
  });

  it('supports the legacy MediaQueryList listener API in the theme provider', () => {
    const themeProvider = read('components/providers/ThemeProvider.tsx');

    expect(themeProvider).toContain('mediaQuery.addListener(onSystemThemeChange)');
    expect(themeProvider).toContain('mediaQuery.removeListener(onSystemThemeChange)');
  });

  it('does not require Promise.allSettled in the service worker', () => {
    const serviceWorker = read('public/sw.js');

    expect(serviceWorker).not.toContain('Promise.allSettled');
    expect(serviceWorker).toContain("const CACHE_NAME = 'lokswami-app-shell-v7'");
  });
});
