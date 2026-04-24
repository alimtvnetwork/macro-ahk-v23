---
name: no-css-important
description: !important banned in all CSS/LESS sources and inline style strings — use selector specificity instead
type: constraint
---

# No `!important` in CSS or inline styles

`!important` is **banned** in:

- All `*.css` and `*.less` source files under `standalone-scripts/**` and
  `src/**`.
- All inline style strings inside TypeScript / TSX
  (`element.style.cssText = "...!important"`, template literals injected via
  `<style>`, etc.).

## Why

`!important` defeats the cascade and forces every future override to also
use `!important`, producing an arms race. The correct tools are:

1. Higher selector specificity (`html body .marco-banner.marco-banner--hidden`).
2. A scoped class added at the right DOM depth.
3. A CSS layer (`@layer overrides { … }`) when ordering against host CSS
   matters.

## Allowed exceptions (must be inline-justified)

A single `!important` declaration may be used **only when** it is preceded
by an inline comment in the same block:

```less
.marco-emergency-sentinel {
  // JUSTIFIED: emergency sentinel must override host stylesheet
  // injected by Lovable that uses inline style attribute (specificity 1,0,0,0).
  display: none !important;
}
```

The `// JUSTIFIED:` comment must explain *what* host CSS is being defeated
and *why* lower-specificity wins are not possible.

## Detection

- Stylelint: `declaration-no-important: true` for `**/*.{css,less}`.
- ESLint `no-restricted-syntax` for TS sources:
  ```
  Literal[value=/!important/]
  ```
  Bans the literal substring inside any string in `standalone-scripts/**`.

## Reference RCA

`spec/03-error-manage/01-error-resolution/03-retrospectives/2026-04-24-payment-banner-hider-rca.md`
