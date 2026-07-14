const { chromium } = require('@playwright/test');

const baseUrl = String(process.env.SMOKE_BASE_URL || 'http://localhost:3100').replace(/\/$/, '');

async function open(page, path) {
  const response = await page.goto(`${baseUrl}${path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  if (!response || response.status() >= 400) {
    throw new Error(`${path} returned ${response?.status() ?? 'no response'}`);
  }
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
}

async function dismissOptionalPrompt(page) {
  const dismissButton = page.getByRole('button', { name: /^(?:Not now|अभी नहीं)$/ });
  const appeared = await dismissButton
    .waitFor({ state: 'visible', timeout: 2_000 })
    .then(() => true)
    .catch(() => false);

  if (appeared) {
    await dismissButton.click();
    await dismissButton.waitFor({ state: 'hidden' });
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  try {
    await open(page, '/main');
    await page.locator('header[aria-busy="true"]').waitFor({ state: 'detached', timeout: 15_000 });
    await page.locator('a[href="/main/search"]').first().waitFor({ state: 'visible' });
    await page.locator('a[href="/main/epaper"]').first().waitFor({ state: 'visible' });

    const shareTrigger = page.locator('button[aria-haspopup="menu"]').first();
    await shareTrigger.waitFor({ state: 'visible', timeout: 15_000 });
    await shareTrigger.click();
    const shareMenu = page.getByRole('menu').first();
    await shareMenu.waitFor({ state: 'visible' });
    for (const platform of ['WhatsApp', 'Facebook', 'X', 'LinkedIn']) {
      await shareMenu.getByRole('menuitem', { name: platform, exact: true }).waitFor();
    }
    await page.keyboard.press('Escape');

    await open(page, '/main/search');
    await page.locator('input').first().waitFor({ state: 'visible' });

    await open(page, '/main/epaper');
    await page.locator('main').waitFor({ state: 'visible' });

    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, '/main');
    await dismissOptionalPrompt(page);
    const mobileMenuButton = page.locator('button[aria-controls="mobile-drawer"]');
    await mobileMenuButton.waitFor({ state: 'visible' });
    await mobileMenuButton.click();
    const mobileDrawer = page.locator('#mobile-drawer');
    await mobileDrawer.waitFor({ state: 'visible' });
    await mobileDrawer.locator('a[href="/main/search"]').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await mobileDrawer.waitFor({ state: 'hidden' });

    await open(page, '/admin');
    await page.waitForURL(/\/signin(?:\?|$)/, { timeout: 15_000 });

    if (pageErrors.length > 0) {
      throw new Error(`Browser page errors: ${pageErrors.join(' | ')}`);
    }

    console.log('Browser smoke passed: desktop navigation/share, search, e-paper, mobile drawer, and admin auth redirect.');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
