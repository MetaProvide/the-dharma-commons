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

test.describe('scatter intro screenshots', () => {
    test.skip(!process.env.SCREENSHOTS, 'Set SCREENSHOTS=1 to capture review screenshots.');

    test('scroll stages', async ({ page }) => {
        await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/');
        const track = await page.locator('.scatter').boundingBox();
        const span = (track?.height ?? 0) - 900;
        for (const stage of [0, 0.18, 0.32, 0.45, 0.6, 0.8, 1]) {
            await page.evaluate((y) => window.scrollTo(0, y), Math.round(span * stage));
            await page.waitForTimeout(250);
            await page.screenshot({
                path: `screenshots/scatter-${String(Math.round(stage * 100)).padStart(3, '0')}.png`,
            });
        }
    });
});
