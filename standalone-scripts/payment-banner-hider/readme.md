# Payment Banner Hider — Standalone Script

**Version**: 1.0.0
**Author**: Riseup Asia LLC
**Type**: Global auto-injected userland script

## Purpose

Automatically hides the Lovable "Payment issue detected." sticky banner that
appears at `/html/body/div[2]/main/div/div[1]` on `lovable.dev/*` pages.

The banner is faded to black and collapsed within ~1 second using a pure
CSS3 transition — no JavaScript animation libraries.

## Behavior

| Stage | What happens |
|-------|---|
| 1 | Script auto-injects on `lovable.dev/*` (no manual run required). |
| 2 | XPath `/html/body/div[2]/main/div/div[1]` is queried. |
| 3 | If `textContent` contains exactly `Payment issue detected.`, the banner is marked. |
| 4 | Background turns black, then opacity + max-height collapse over 900 ms. |
| 5 | After 1000 ms, `display: none` is applied. Layout space is released. |
| 6 | A `MutationObserver` watches for re-renders (React SPA navigation). |

## Safety

- Only acts if the exact string `Payment issue detected.` is present.
- Re-renders are handled by checking the `data-payment-banner-hidden` attribute.
- No DOM removal — only CSS-based hiding (React state stays consistent).

## Build

```bash
pnpm run build:payment-banner-hider
```

Output → `standalone-scripts/payment-banner-hider/dist/payment-banner-hider.js`
(IIFE, exposes `window.PaymentBannerHider` for debugging).

## Debug API (`window.PaymentBannerHider`)

| Method | Description |
|--------|---|
| `version` | Library version string |
| `check()` | Manually trigger one detection pass |

## Target URL Scope

`https://lovable.dev/*` — main app only. Preview iframes
(`*.lovable.app`, `*.lovableproject.com`) are excluded by design since the
billing banner only renders in the main app shell.
