import { expect, test } from '@playwright/test';

for (const width of [320, 390, 820, 1440]) {
  test(`Pankhida 2026 page fits ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const response = await page.goto('/main/pankhida-2026', { waitUntil: 'domcontentloaded' });
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole('heading', { name: 'Pankhida 2026', exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    const nav = page.locator('header nav a');
    await expect(nav.nth(1)).toHaveAttribute('href', '/main/pankhida-2026');
    await expect(nav.last()).toHaveAttribute('href', '/main/elections');
  });
}
