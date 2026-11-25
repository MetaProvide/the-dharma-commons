// Renders the share preview (public/og.png) from the built home page. Run after `pnpm build`: pnpm og
import { chromium } from '@playwright/test';
import { preview } from 'astro';

const server = await preview({ server: { port: 4399 }, logLevel: 'error' });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
await page.goto('http://localhost:4399/');
await page.addStyleTag({
    content: '.slab, .scatter__steps, .scatter__skip, .scatter__figure figcaption { display: none !important; }',
});
await page.screenshot({ path: 'public/og.png' });
await browser.close();
await server.stop();
console.log('wrote public/og.png');
