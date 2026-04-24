import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Playwright config for the Payment Banner Hider smoke test ONLY.
 *
 * This config exists so the smoke test can run in isolation without the
 * heavy `globalSetup` from `playwright.config.ts` (which builds the entire
 * extension via pnpm). The smoke test:
 *   - Does NOT need the Chrome extension loaded
 *   - DOES need the payment-banner-hider IIFE bundle on disk (its own
 *     beforeAll() asserts this with a precise error message)
 *
 * Wired into CI as a dedicated `e2e-payment-banner-hider` job that runs
 * after `build-payment-banner-hider` uploads the dist artifact, so it
 * doesn't depend on the full extension build pipeline.
 *
 * Local use:
 *   pnpm exec playwright test --config playwright.config.payment-banner-hider.ts
 */
export default defineConfig({
    testDir: path.resolve(__dirname, 'tests/e2e'),
    testMatch: '**/e2e-21-payment-banner-hider.spec.ts',
    timeout: 60_000,
    expect: { timeout: 10_000 },
    workers: 1,
    fullyParallel: false,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI
        ? [['list'], ['junit', { outputFile: 'test-results/junit-pbh.xml' }], ['github']]
        : [['list']],
    outputDir: path.resolve(__dirname, 'test-results/payment-banner-hider'),
    projects: [{ name: 'payment-banner-hider', use: {} }],
});
