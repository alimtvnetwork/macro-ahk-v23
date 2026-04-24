---
name: no-type-casting
description: Bans `as T`, `as unknown as T`, `<T>value` and `as any` in standalone-scripts; use type guards or typed globals
type: constraint
---

# No type casting in standalone-scripts

Banned syntax in `standalone-scripts/**/*.{ts,tsx}`:

- `value as SomeType`
- `value as unknown as SomeType` (loophole closure for the `unknown` policy)
- `<SomeType>value` (legacy assertion form)
- `value as any` (already banned by `@typescript-eslint/no-explicit-any`)

## Approved alternatives

| Need | Approved approach |
|------|-------------------|
| Attach a debug global | Declare it in `standalone-scripts/types/riseup-namespace.d.ts` so `window.PaymentBannerHider` is already typed. |
| Narrow a `unknown` from `JSON.parse` | Use a runtime type guard (e.g. `isPromptShape(value)`). |
| Discriminated union narrowing | Use the discriminator field in a `switch` — TS narrows automatically. |
| Cross-window message payloads | Define the message type in the shared types directory and have the receiver assert via a guard. |

## Why

Casting silently turns off the type checker for the next expression. Every
production crash that traces back to "the type said X but the runtime had
Y" begins with a cast somewhere upstream. The `as unknown as` chain is
the worst offender because it requires *two* cast hops to escape detection.

## Detection

ESLint `no-restricted-syntax`:
```
TSAsExpression
TSTypeAssertion
```
Scoped to `standalone-scripts/**/*.{ts,tsx}`. The single allowed escape is
`value as const` (literal-union narrowing), which uses the `const`
identifier; add an exception for `TSAsExpression > TSTypeReference[typeName.name="const"]`.

## Reference RCA

`spec/03-error-manage/01-error-resolution/03-retrospectives/2026-04-24-payment-banner-hider-rca.md`
