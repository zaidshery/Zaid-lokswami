import { expect, test } from '@playwright/test';

const SCREENSHOT_TARGETS = [
  { name: 'e-magazine', path: '/main/e-magazine' },
  { name: 'epaper', path: '/main/epaper' },
];

const VIEWPORTS = [
  { name: 'desktop', size: { width: 1440, height: 1000 } },
  { name: 'mobile', size: { width: 390, height: 844 } },
];

test.describe('E-paper visual smoke screenshots', () => {
  for (const target of SCREENSHOT_TARGETS) {
    for (const viewport of VIEWPORTS) {
      test(`${target.name} ${viewport.name} renders`, async ({ page }, testInfo) => {
        await page.setViewportSize(viewport.size);
        const response = await page.goto(target.path, { waitUntil: 'networkidle' });

        expect(response?.ok()).toBeTruthy();
        await expect(page.locator('body')).not.toBeEmpty();

        const screenshotPath = testInfo.outputPath(`${target.name}-${viewport.name}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        await testInfo.attach(`${target.name}-${viewport.name}`, {
          path: screenshotPath,
          contentType: 'image/png',
        });
      });
    }
  }
});
