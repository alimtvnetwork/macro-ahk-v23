---
name: Payment Banner Hider
description: Auto-injected global script hiding the Lovable "Payment issue detected." banner via CSS3 fade
type: feature
---
# Payment Banner Hider (v1.0.0)

Standalone-script project at `standalone-scripts/payment-banner-hider/` that
auto-injects on `https://lovable.dev/*` and hides the sticky "Payment issue
detected." banner at XPath `/html/body/div[2]/main/div/div[1]`.

## Behavior
- Auto-runs (no manual "Run script" click), `world: MAIN`, `isGlobal: true`, `loadOrder: 2`.
- Pure CSS3 transition — fades to black, collapses height/opacity over 900ms,
  then `display:none` at 1000ms.
- `MutationObserver` on `document.body` re-detects React re-renders /
  SPA navigation. Idempotent via `data-payment-banner-hidden` attribute.
- Only acts when exact text `Payment issue detected.` is present.

## Files
- `src/index.ts` — entrypoint + IIFE bundle exposing `window.PaymentBannerHider`
- `src/instruction.ts` — declarative seed manifest (autoInject:true, lovable.dev/* glob)
- `readme.md` — project docs
- `vite.config.payment-banner-hider.ts` — IIFE build, dist → `payment-banner-hider.js`
- `tsconfig.payment-banner-hider.json` — strict TS config
- `package.json` script: `build:payment-banner-hider`; also wired into `build:extension`

## Debug API
`window.PaymentBannerHider.check()` — manual one-pass detection trigger.
