import { expect, test } from '@playwright/test';

/**
 * Captures the pages for review. Run with SCREENSHOTS=1 pnpm test tests/screenshots.spec.ts
 */
const pages = [{ name: 'home', path: '/' }];

test.describe('screenshots', () => {
    test.skip(!process.env.SCREENSHOTS, 'Set SCREENSHOTS=1 to capture review screenshots.');

    for (const { name, path } of pages) {
        for (const scheme of ['light', 'dark'] as const) {
            test(`${name} ${scheme}`, async ({ page }) => {
                await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
                await page.setViewportSize({ width: 1440, height: 900 });
                await page.goto(path);
                await expect(page.locator('main')).toBeVisible();
                await page.screenshot({ path: `screenshots/${name}-${scheme}-fold.png` });
                await page.screenshot({ path: `screenshots/${name}-${scheme}-full.png`, fullPage: true });
                await page.setViewportSize({ width: 390, height: 844 });
                await page.screenshot({ path: `screenshots/${name}-${scheme}-mobile.png`, fullPage: true });
            });
        }
    }
});
