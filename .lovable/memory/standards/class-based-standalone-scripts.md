---
name: class-based-standalone-scripts
description: Standalone-scripts entry files must export a single class; helpers are methods or injected dependencies
type: preference
---

# Class-based standalone-scripts

Every `standalone-scripts/<project>/src/index.ts` MUST:

1. Export a single class as default. The class name matches the project's
   PascalCase code name (e.g. `PaymentBannerHider`, `MacroController`,
   `XPathUtilities`).
2. Place every helper as a private method on that class, or as a separate
   injected dependency class imported from a sibling file.
3. End with a single auto-run block:
   ```ts
   const instance = new PaymentBannerHider();
   instance.start();
   ```

## Why

- A single class gives a single named lifecycle (`constructor`, `start`,
  `stop`, `dispose`) that the runtime can introspect.
- Dependencies become visible — `new PaymentBannerHider({ logger,
  styleInjector })` makes the wiring auditable instead of relying on module
  side-effects.
- Free module-level functions hide state in module-scoped variables, which
  cannot be reset between SPA navigations.

## Banned patterns

- Module-level `let` / `const` mutable state.
- Free `function foo()` declarations alongside a class — fold them in as
  private methods.
- Multiple top-level `if (…) { startObserver(); }` calls — one `start()`
  method handles the entry-point branching.

## Detection

A lightweight check in `scripts/check-standalone-dist.mjs`: parse each
`standalone-scripts/<project>/src/index.ts` and require an
`ExportDefaultDeclaration` whose declaration is a `ClassDeclaration`.

## Reference RCA

`spec/03-error-manage/01-error-resolution/03-retrospectives/2026-04-24-payment-banner-hider-rca.md`
