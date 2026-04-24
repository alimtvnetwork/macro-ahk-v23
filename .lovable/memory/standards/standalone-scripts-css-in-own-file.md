---
name: standalone-scripts-css-in-own-file
description: CSS for standalone-scripts must live in less/ or css/, compile to dist, and be declared via assets.css[]
type: feature
---

# CSS belongs in its own file (standalone-scripts)

Every `standalone-scripts/<project>/` that ships visual styling MUST:

1. Keep CSS source in `<project>/less/*.less` (preferred — see
   `macro-controller/less/`) or `<project>/css/*.css`.
2. Compile to `<project>/dist/<bundle>.css` via the project's
   `vite.config.<project>.ts`.
3. Declare the bundle in `<project>/src/instruction.ts` under
   `assets.css[]` so the injection pipeline picks it up:
   ```ts
   assets: {
       css: [{ file: "<bundle>.css", inject: AssetInjectTarget.Head }],
       …
   }
   ```

## Banned patterns

- `document.createElement("style")` followed by `style.textContent = "…"`
  inside a standalone-scripts entry file.
- Template-literal CSS strings interpolated with constants and injected at
  runtime.

## Allowed exceptions

The single emergency CSS sentinel (`mem://features/css-injection-sentinel`)
is the documented exception. Any new exception must be approved by the
user and recorded as its own memory entry.

## Detection

ESLint `no-restricted-syntax`:
```
CallExpression[callee.object.name="document"][callee.property.name="createElement"][arguments.0.value="style"]
```
Suppress with `// JUSTIFIED: emergency-css-sentinel` on the line above.

## Reference

- Canonical example: `standalone-scripts/macro-controller/less/`
- RCA: `spec/03-error-manage/01-error-resolution/03-retrospectives/2026-04-24-payment-banner-hider-rca.md`
