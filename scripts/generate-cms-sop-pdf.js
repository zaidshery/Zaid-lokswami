const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('@playwright/test');

const projectRoot = path.resolve(__dirname, '..');
const sourcePath = path.join(projectRoot, 'docs', 'LOKSWAMI_CMS_ROLE_SOP.html');
const outputPath = path.join(projectRoot, 'docs', 'LOKSWAMI_CMS_ROLE_SOP.pdf');

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
    await page.goto(pathToFileURL(sourcePath).href, { waitUntil: 'load' });
    await page.evaluate(async () => {
      await Promise.all(
        Array.from(document.images).map((image) => {
          if (image.complete) return Promise.resolve();
          return new Promise((resolve, reject) => {
            image.addEventListener('load', resolve, { once: true });
            image.addEventListener('error', reject, { once: true });
          });
        })
      );
    });

    const pageCount = await page.locator('.page').count();
    if (pageCount !== 8) {
      throw new Error(`Expected 8 SOP pages, found ${pageCount}.`);
    }

    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: outputPath,
      format: 'A4',
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: false,
      tagged: true,
      outline: true,
    });

    console.log(`Generated ${path.relative(projectRoot, outputPath)} (${pageCount} pages).`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
