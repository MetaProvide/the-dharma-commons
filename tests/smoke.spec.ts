import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import snapshot from '../src/data/teachings.json' with { type: 'json' };

const teachings = snapshot.teachings;
const withTranscript = teachings.find((teaching) => teaching.summary.title === 'Why we need a spiritual path');
if (!withTranscript) {
    throw new Error('Expected the Tara Institute teaching in the snapshot.');
}
const transcriptFile = withTranscript.files.find((file) => file.kind === 'text');
if (!transcriptFile) {
    throw new Error('Expected a transcript file on the Tara Institute teaching.');
}
const transcriptBytes = readFileSync(join(process.cwd(), 'src/data/transcripts', `${withTranscript.summary.id}.txt`));
const teachingPath = `/teachings/${withTranscript.summary.id}`;

/** Fails the test on any console error or uncaught exception. */
function watchErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
        if (message.type() === 'error') {
            errors.push(message.text());
        }
    });
    return errors;
}

/** Waits until the Astro island holding this test id has hydrated. */
async function hydrated(page: Page, testId: string) {
    const island = page.locator(`astro-island:has([data-testid="${testId}"])`);
    await island.scrollIntoViewIfNeeded();
    await expect(island).not.toHaveAttribute('ssr', /.*/);
}

/** Keeps tests off the real Swarm network: media requests are answered empty. */
async function stubMedia(page: Page) {
    await page.route('https://api.gateway.ethswarm.org/**', (route) => route.fulfill({ status: 204, body: '' }));
}

test.describe('home', () => {
    test('shows the intro, every approved teaching and the footer credit', async ({ page }) => {
        const errors = watchErrors(page);
        await page.goto('/');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Teachings, kept in common.');
        await expect(page.getByTestId('scatter-figure')).toBeVisible();
        await expect(page.getByTestId('teaching-row')).toHaveCount(teachings.length);
        await expect(page.getByTestId('teaching-row').first()).toContainText('The need for Wisdom and Compassion');
        const credit = page.getByRole('link', { name: 'Powered by MetaProvide' });
        await expect(credit).toHaveAttribute('href', 'https://metaprovide.org/archive/');
        await expect(page.getByText('Joyma')).toHaveCount(0);
        expect(errors).toEqual([]);
    });

    test('filters the listing by format, search and teacher', async ({ page }) => {
        await page.goto('/');
        await hydrated(page, 'teaching-index');
        const rows = page.getByTestId('teaching-row');
        const videos = teachings.filter((teaching) => teaching.summary.formats.includes('video')).length;

        await page.getByLabel('Format').selectOption('video');
        await expect(rows).toHaveCount(videos);
        await expect(page).toHaveURL(/format=video/);

        await page.getByLabel('Search teachings and transcripts').fill('secular');
        await expect(rows).toHaveCount(6);

        await page.getByRole('button', { name: 'Clear filters' }).first().click();
        await expect(rows).toHaveCount(teachings.length);

        await page.getByLabel('Teacher').selectOption('Kyabje Lama Thubten Zopa Rinpoche');
        await expect(rows).toHaveCount(2);

        await page.getByLabel('Search teachings and transcripts').fill('no such teaching here');
        await expect(rows).toHaveCount(0);
        await expect(page.getByText('No teaching matches')).toBeVisible();
    });

    test('fingerprints an edited line in the browser', async ({ page }) => {
        await page.goto('/');
        await hydrated(page, 'fingerprint-demo');
        const status = page.getByTestId('fingerprint-status');
        await expect(status).toHaveText('Matches the recording');
        await page.getByTestId('fingerprint-input').fill('Subdue your own mind partly.');
        await expect(status).toHaveText('Does not match: the change shows');
    });
});

test.describe('teaching page', () => {
    test('opens with the player, the transcript and the details', async ({ page }) => {
        const errors = watchErrors(page);
        await stubMedia(page);
        await page.goto(teachingPath);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Why we need a spiritual path');
        await expect(page.getByTestId('player')).toHaveAttribute(
            'src',
            `https://api.gateway.ethswarm.org/bzz/${withTranscript.reference}/audio.opus`,
        );
        await expect(page.getByText('So, good evening to all my brothers and sisters').first()).toBeVisible();
        await expect(page.getByText('Tara Institute, Melbourne, Australia').first()).toBeVisible();

        const panel = page.getByTestId('source-panel');
        await panel.getByText('Source and files').click();
        await expect(page.getByTestId('swarm-reference')).toHaveText(withTranscript.reference);
        await expect(panel.getByRole('link', { name: 'Open on Swarm' })).toHaveAttribute(
            'href',
            withTranscript.collectionUrl,
        );
        await expect(panel).toContainText('MetaProvide');
        expect(errors).toEqual([]);
    });

    test('a video teaching plays from the Swarm gateway', async ({ page }) => {
        await stubMedia(page);
        const video = teachings.find((teaching) => teaching.summary.formats.includes('video'));
        await page.goto(`/teachings/${video?.summary.id}`);
        await expect(page.locator('video[data-testid="player"]')).toHaveCount(1);
    });
});

test.describe('check this copy', () => {
    async function selectTranscript(page: Page) {
        await stubMedia(page);
        await page.goto(teachingPath);
        await hydrated(page, 'check-copy');
        await page.getByTestId('check-copy').getByLabel('File to check').selectOption('transcript.txt');
    }

    test('verifies a copy that matches its fingerprint', async ({ page }) => {
        await page.route(transcriptFile.gateway_url, (route) =>
            route.fulfill({ status: 200, body: transcriptBytes, contentType: 'text/plain' }),
        );
        await selectTranscript(page);
        await page.getByTestId('check-button').click();
        await expect(page.getByTestId('check-result').locator('[data-state="verified"]')).toBeVisible();
        await expect(page.getByTestId('check-actual')).toHaveText(transcriptFile.sha256);
    });

    test('flags a copy that was altered', async ({ page }) => {
        const altered = Buffer.from(transcriptBytes.toString('utf8').replace('thoroughly', 'partly'));
        await page.route(transcriptFile.gateway_url, (route) =>
            route.fulfill({ status: 200, body: altered, contentType: 'text/plain' }),
        );
        await selectTranscript(page);
        await page.getByTestId('check-button').click();
        await expect(page.getByTestId('check-result').locator('[data-state="mismatch"]')).toBeVisible();
        await expect(page.getByTestId('check-actual')).not.toHaveText(transcriptFile.sha256);
    });

    test('says so when the gateway cannot be reached', async ({ page }) => {
        await page.route(transcriptFile.gateway_url, (route) => route.abort('failed'));
        await selectTranscript(page);
        await page.getByTestId('check-button').click();
        await expect(page.getByTestId('check-result').locator('[data-state="failed"]')).toBeVisible();
    });
});

test.describe('pages', () => {
    for (const { path, heading } of [
        { path: '/how-it-works', heading: 'How Swarm keeps a teaching' },
        { path: '/about', heading: 'A library, held in common' },
        { path: '/contribute', heading: 'Preserve your teachings here' },
        { path: '/no-such-page', heading: 'Nothing is kept at this address.' },
    ]) {
        test(`${path} renders`, async ({ page }) => {
            const errors = watchErrors(page);
            await page.goto(path);
            await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
            await expect(page.getByRole('link', { name: 'Powered by MetaProvide' })).toBeVisible();
            expect(errors.filter((error) => !error.includes('404'))).toEqual([]);
        });
    }
});
