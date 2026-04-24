import { test, expect, chromium, type Browser } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * E2E-21 — Payment Banner Hider Smoke Test
 *
 * Confirms the payment-banner-hider standalone script actually performs
 * the DOM mutation it advertises, by:
 *
 *   1. Loading the IIFE bundle that the build pipeline produces at
 *      `standalone-scripts/payment-banner-hider/dist/payment-banner-hider.js`
 *      — i.e. the same file the extension ships and that the CI registry
 *      report verifies exists.
 *   2. Serving an inline data: URL HTML page that contains a banner at
 *      the *exact* XPath the script targets (/html/body/div[2]/main/div/div[1])
 *      with the trigger text "Payment issue detected.".
 *   3. Injecting the bundle via `addScriptTag` (MAIN world by default in
 *      Playwright — no chrome.scripting needed; this is the same world the
 *      script runs in production).
 *   4. Asserting the documented DOM contract:
 *        - `data-payment-banner-hidden` attribute progresses through
 *          `fading` → `hiding` → `done`
 *        - Final computed style is `display: none`
 *        - `window.PaymentBannerHider.version` is exposed for debugging
 *
 * Failure modes this test catches:
 *   - Build emitted an empty/broken IIFE (would throw on injection)
 *   - XPath regression (target node not found)
 *   - Trigger text changed without updating the script
 *   - CSS transition not reaching the `done` state (timer/RAF regression)
 *   - `window.PaymentBannerHider` namespace removed/renamed
 *
 * Why a separate spec (not folded into script-injection.spec.ts):
 *   This script ships independently of the macro injection pipeline. A
 *   dedicated spec keeps the failure attribution clean — when this fails,
 *   the only suspect is the payment-banner-hider bundle.
 *
 * Why no extension fixture:
 *   The bundle is a self-contained IIFE that runs in any MAIN-world
 *   context. Loading the entire extension just to verify
 *   "does this 2.2 KB script mutate the DOM?" would add ~15 s of
 *   build/launch overhead per test for zero additional coverage.
 *   The extension's job (registering this script, injecting it on
 *   lovable.dev/*) is verified separately by the existing injection
 *   specs and the registry preflight.
 */

const BUNDLE_PATH = path.resolve(
    __dirname,
    '../../standalone-scripts/payment-banner-hider/dist/payment-banner-hider.js',
);

/**
 * Fixture page: minimal HTML that places a "Payment issue detected." banner
 * at exactly /html/body/div[2]/main/div/div[1] — the XPath the script targets.
 *
 * NOTE: div[1] in XPath is 1-indexed *and* counts only siblings of the same
 * tag. So we need:
 *   body
 *     div[1]   (decoy — must exist so the second div is div[2])
 *     div[2]
 *       main
 *         div
 *           div[1]   ← target banner
 *           div[2]   ← decoy after-content
 */
const FIXTURE_HTML = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Payment Banner Hider Smoke Fixture</title></head>
<body>
  <div id="decoy-before">decoy sibling so the next div becomes div[2]</div>
  <div id="app">
    <main>
      <div id="layout">
        <div id="banner" style="background:#fee; padding:16px; height:48px;">
          <strong>Payment issue detected.</strong> Please update your billing.
        </div>
        <div id="page-content">Real page content goes here.</div>
      </div>
    </main>
  </div>
</body>
</html>`;

const FIXTURE_DATA_URL =
    'data:text/html;charset=utf-8,' + encodeURIComponent(FIXTURE_HTML);

test.describe('E2E-21 — Payment Banner Hider Smoke', () => {
    test('bundle file exists and is non-empty (orchestration sanity)', () => {
        // Cheap pre-check that does NOT require a browser. If the registry report
        // missed a wiring gap, the bundle would be missing or zero-byte. Fail with
        // a precise message instead of letting the browser-based tests below crash
        // with a misleading "addScriptTag failed".
        if (!fs.existsSync(BUNDLE_PATH)) {
            throw new Error(
                `[e2e-21] Bundle not found at ${BUNDLE_PATH}.\n` +
                `Reason: tests/e2e/global-setup.ts must run "build:payment-banner-hider" before this spec, ` +
                `OR (when running this spec via playwright.config.payment-banner-hider.ts) the CI job must ` +
                `download the payment-banner-hider-dist artifact first.\n` +
                `Fix: ensure global-setup buildSteps[] includes payment-banner-hider, ` +
                `or run \`pnpm run build:payment-banner-hider\` manually.`,
            );
        }
        const stat = fs.statSync(BUNDLE_PATH);
        expect(stat.size,
            `Built bundle is suspiciously small (${stat.size} bytes). ` +
            `Expected an IIFE around 2 KB. Re-run build:payment-banner-hider.`
        ).toBeGreaterThan(500);
    });

    let browser: Browser;

    test.beforeAll(async () => {
        // Launch a *plain* chromium (no extension) — see file header for rationale.
        // Skipped automatically if the bundle is missing (the previous test will
        // already have flagged that with a precise error).
        if (!fs.existsSync(BUNDLE_PATH)) return;
        browser = await chromium.launch();
    });

    test.afterAll(async () => {
        await browser?.close();
    });

    test('hides the banner: data attribute progresses fading -> hiding -> done', async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(FIXTURE_DATA_URL);

        // Sanity: the fixture is shaped the way the XPath expects BEFORE injection.
        const xpathHit = await page.evaluate(() => {
            const r = document.evaluate(
                '/html/body/div[2]/main/div/div[1]',
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null,
            );
            const node = r.singleNodeValue as HTMLElement | null;
            return {
                found: !!node,
                id: node?.id ?? null,
                text: node?.textContent ?? null,
            };
        });
        expect(xpathHit.found, 'Fixture XPath target missing — fix FIXTURE_HTML').toBe(true);
        expect(xpathHit.id).toBe('banner');
        expect(xpathHit.text ?? '').toContain('Payment issue detected.');

        // Inject the production bundle into MAIN world.
        await page.addScriptTag({ path: BUNDLE_PATH });

        // 1) Immediately after injection the banner should be marked "fading".
        //    The script sets this synchronously inside checkAndHide().
        const banner = page.locator('#banner');
        await expect(
            banner,
            'Bundle did not tag the banner with data-payment-banner-hidden="fading"'
        ).toHaveAttribute('data-payment-banner-hidden', 'fading');

        // 2) Two RAFs later it should advance to "hiding".
        await expect(
            banner,
            'Banner stuck in "fading" state — RAF chain may be broken'
        ).toHaveAttribute('data-payment-banner-hidden', 'hiding', { timeout: 2_000 });

        // 3) After REMOVE_DELAY_MS (1000 ms in the source) it should be "done".
        await expect(
            banner,
            'Banner did not reach terminal "done" state within timeout'
        ).toHaveAttribute('data-payment-banner-hidden', 'done', { timeout: 3_000 });

        // 4) Computed style must be display:none so layout space is released.
        const display = await banner.evaluate((el) => getComputedStyle(el).display);
        expect(display, 'Banner is "done" but still occupies layout space').toBe('none');

        await context.close();
    });

    test('exposes window.PaymentBannerHider with version + check() (debug API)', async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(FIXTURE_DATA_URL);
        await page.addScriptTag({ path: BUNDLE_PATH });

        const api = await page.evaluate(() => {
            const w = window as unknown as {
                PaymentBannerHider?: { version?: unknown; check?: unknown };
            };
            return {
                hasNamespace: !!w.PaymentBannerHider,
                versionType: typeof w.PaymentBannerHider?.version,
                version: w.PaymentBannerHider?.version,
                checkType: typeof w.PaymentBannerHider?.check,
            };
        });
        expect(api.hasNamespace,
            'window.PaymentBannerHider missing — debug entrypoint regressed'
        ).toBe(true);
        expect(api.versionType).toBe('string');
        expect(api.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(api.checkType,
            'PaymentBannerHider.check() is not a function'
        ).toBe('function');

        await context.close();
    });

    test('does NOT hide a banner when trigger text is absent (no false positives)', async () => {
        // Same DOM shape, different text — the script must leave it alone.
        const innocentHtml = FIXTURE_HTML.replace(
            'Payment issue detected.',
            'Welcome back to your dashboard.',
        );
        const innocentUrl =
            'data:text/html;charset=utf-8,' + encodeURIComponent(innocentHtml);

        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(innocentUrl);
        await page.addScriptTag({ path: BUNDLE_PATH });

        // Wait long enough that, IF it were going to act, it would have.
        // (REMOVE_DELAY_MS = 1000 in the source; 1500 ms is a comfortable margin.)
        await page.waitForTimeout(1_500);

        const result = await page.evaluate(() => {
            const banner = document.getElementById('banner');
            return {
                attr: banner?.getAttribute('data-payment-banner-hidden') ?? null,
                display: banner ? getComputedStyle(banner).display : null,
            };
        });
        expect(result.attr,
            'Script falsely triggered on a banner WITHOUT the trigger text'
        ).toBeNull();
        expect(result.display).not.toBe('none');

        await context.close();
    });
});
