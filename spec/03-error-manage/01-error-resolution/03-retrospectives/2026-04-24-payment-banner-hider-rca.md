# RCA — `payment-banner-hider/src/index.ts`

**Date:** 2026-04-24 (Asia/Kuala_Lumpur, UTC+8)
**Author:** AI assistant (Lovable)
**Severity:** High — multiple coding-guideline violations shipped together in
the same 151-line file, despite the violated rules already being documented
elsewhere in the repo.
**Affected file:** `standalone-scripts/payment-banner-hider/src/index.ts`
**Reviewer-reported issues:** the user, in the chat message that produced this
RCA.

---

## 1. What went wrong

The shipped file violates the project's standalone-scripts conventions in
**eight** distinct ways:

| # | Violation | Evidence (line) | Rule that already exists |
|---|-----------|-----------------|--------------------------|
| 1 | `!important` used 17× inside an inline `<style>` block | lines 33–63 | None yet — this RCA creates it |
| 2 | CSS lives **inside the TypeScript file** instead of in a separate stylesheet declared via `instruction.assets.css[]` | lines 27–65 | `mem://architecture/instruction-driven-seeding`, macro-controller `less/` pattern |
| 3 | Error swallowing — `catch { return null; }` discards the cause | lines 79–81 | `mem://standards/error-logging-via-namespace-logger` ("no swallowed errors") |
| 4 | Magic strings (`"fading"`, `"hiding"`, `"done"`, `"data-payment-banner-hidden"`, `"payment-banner-hider-styles"`) instead of enums / constants | lines 21–22, 34–62 | `mem://architecture/constant-naming-convention` |
| 5 | No class structure — every helper is a free function | lines 27–149 | New rule (this RCA) |
| 6 | Type casting via `as unknown as { … }` to attach the debug global | line 136 | `mem://standards/unknown-usage-policy` |
| 7 | Missing blank line before `return` statements | lines 28–30, 78–81, 86–88, 104–113 | `spec/02-coding-guidelines/01-cross-language/04-code-style/03-blank-lines-and-spacing.md` |
| 8 | Three-phase `requestAnimationFrame` + `setTimeout` fade dance to do what a single `display:none` class transition can do in 1 declaration | lines 91–98 | New rule (this RCA): prefer the simplest CSS transition |

Items #3 and #6 directly contradict rules already in `mem://index.md` Core
section. Items #2 and #4 contradict architectural memories the AI is
*supposed* to consult before writing standalone-scripts files. Items #1, #5,
#7, #8 are new rules being formalised by this RCA so they cannot recur.

---

## 2. Why it happened — root causes

### RC-1. The AI did not read the existing standalone-scripts examples before writing a new one

The macro-controller project demonstrates the correct pattern:
- CSS lives in `standalone-scripts/macro-controller/less/*.less`, compiled to
  `dist/macro-looping.css`, declared in `instruction.assets.css[]`.
- The runtime is structured as cohesive modules (`loop-engine.ts`,
  `panel-controls.ts`, etc.) each exposing a clear surface.
- Constants are centralised in `constants.ts` with `STYLE_*`, `ATTR_*`,
  `ID_*` prefixes (`mem://architecture/constant-naming-convention`).

Despite all three patterns being **already in the repo**, the assistant
produced a one-file script that copied none of them. The trigger was speed:
"it's a tiny banner, just inline everything". This is the same failure mode
that produces the 8 violations above. **Speed is not an excuse for
ignoring documented conventions.**

### RC-2. The `mem://index.md` Core list does not enforce a "read examples first" check

The Core list contains ban rules (no `unknown`, no Supabase, no retry, etc.)
but nothing tells the assistant: *before writing a new file in a known
project area, read the closest existing sibling and follow its structure.*
That mandatory pre-write check is missing.

### RC-3. There is no rule banning `!important` anywhere in the repo

`!important` is not mentioned in any spec or memory. The assistant defaulted
to it because inline-injected styles often lose specificity battles against
host-page rules. The correct fix — ship the CSS as a real `assets.css[]`
file with a high-specificity selector — was not considered because of RC-1.

### RC-4. The "no error swallowing" rule lives only inside the namespace-logger memory

`mem://standards/error-logging-via-namespace-logger.md` says "no swallowed
errors" but it is filed under *logger* concerns, so the assistant treated
it as "use the logger when you log" — not as "you must always either log,
rethrow, or surface the cause". The rule needs its own dedicated memory
file under `standards/` so it surfaces during a generic
`grep`-the-memory-index lookup.

### RC-5. The "no type casting" intent is partially captured but easy to miss

`mem://standards/unknown-usage-policy.md` bans explicit `unknown` and
`Record<string, unknown>`, but `(window as unknown as { … })` slipped
through because:
- The cast goes through `unknown` only as a *bridge* to a typed shape — a
  loophole the policy doesn't close in plain language.
- There is no lint rule banning `as unknown as` chains.

### RC-6. There was no template / scaffolder for new standalone-scripts projects

Every new project is hand-written from a blank file. There is no
`scripts/scaffold-standalone.mjs` that copies the canonical structure (CSS
folder, class skeleton, instruction stub, vite + tsconfig + lint config).
That absence guarantees drift every time a new project is added.

---

## 3. What we are changing — corrective actions

| # | Action | Where | Owner |
|---|--------|-------|-------|
| CA-1 | Add **"Pre-write check"** to `mem://index.md` Core: *Before writing any new file under a known project area, read the closest existing sibling and follow its conventions. Reference: `mem://standards/engineering-rules.md#pre-write-check`.* | `mem://index.md` Core | This session |
| CA-2 | Create `mem://standards/no-css-important.md` — bans `!important` in all CSS/LESS sources. Allowed only with an inline `// JUSTIFIED: <reason>` comment immediately above. | new memory | This session |
| CA-3 | Create `mem://standards/no-error-swallowing.md` — `catch` blocks must always (a) re-throw, (b) call `RiseupAsiaMacroExt.Logger.error` or `console.warn` with the caught value, or (c) include an inline `// SWALLOW JUSTIFIED: <reason>` comment. Plain `catch { return null/false/undefined; }` is banned. | new memory | This session |
| CA-4 | Create `mem://standards/standalone-scripts-css-in-own-file.md` — every standalone-scripts project that ships visual styling MUST place CSS in `<project>/less/` or `<project>/css/`, compile to `dist/<bundle>.css`, and declare it via `instruction.assets.css[]`. Inline `document.createElement("style")` blobs are banned except for emergency CSS sentinels (`mem://features/css-injection-sentinel`). | new memory | This session |
| CA-5 | Create `mem://standards/class-based-standalone-scripts.md` — every standalone-scripts entry point exports a single class (e.g. `class PaymentBannerHider`). Module-level free functions are banned in entry files; helpers are private methods or injected dependencies. The auto-run block at file bottom must be a single `new PaymentBannerHider().start()`. | new memory | This session |
| CA-6 | Create `mem://standards/no-type-casting.md` — bans `as <T>`, `as unknown as <T>`, `as any` (already banned), and `<T>(value)` type assertions in `standalone-scripts/**`. Type narrowing must use type guards, discriminated unions, or properly-typed globals from `standalone-scripts/types/**`. | new memory | This session |
| CA-7 | Add §11–§16 to the standalone-scripts-types spec covering: class architecture, CSS-in-own-file, no-`!important`, no-error-swallowing, no-type-casting, blank-line-before-return, magic-strings → enums (HandledAttrState, EventName, RunPhase). | spec | This session |
| CA-8 | Add **Q5–Q10** to the spec's Open Questions so the user can choose the exact strategy (single hide-class vs phase enum, CSS bundle name, enum module location, DI mechanism, lint activation order). | spec | This session |
| CA-9 | Refactor `payment-banner-hider/src/index.ts` to: class-based, CSS in `payment-banner-hider/less/payment-banner-hider.less`, enum-driven state, no `!important` (selector specificity instead), no swallowing, no casting, blank line before each return. | code | After spec review |
| CA-10 | Build a `scripts/scaffold-standalone.mjs` that creates a new project from a canonical template directory — closing RC-6. | tooling | Follow-up session |

CA-1 through CA-8 are committed in this session. **CA-9 and CA-10 wait for
the user's review** of the amended spec, per the existing
`mem://workflow/task-execution-pattern` rule.

---

## 4. Detection — how we will catch this faster next time

| Detector | Mechanism |
|----------|-----------|
| `!important` slipping into source | ESLint `stylelint-config-standard` `declaration-no-important` for `**/*.{css,less}`, plus a `no-restricted-syntax` rule banning the literal `"!important"` inside `Literal` nodes in `standalone-scripts/**/*.ts`. |
| Inline `<style>` blob in TS | `no-restricted-syntax` rule banning `document.createElement("style")` in `standalone-scripts/**/*.ts`. Allowed via `// JUSTIFIED: emergency-css-sentinel` line comment. |
| Error swallowing | ESLint `no-restricted-syntax` rule on `CatchClause` whose body contains only a single `ReturnStatement`, with no preceding logger / throw / `JUSTIFIED:` comment. |
| Type casting | `no-restricted-syntax` rules banning `TSAsExpression` and `TSTypeAssertion` inside `standalone-scripts/**/*.ts`. |
| Missing blank line before `return` | ESLint `padding-line-between-statements: ["error", { blankLine: "always", prev: "*", next: "return" }]`. |
| Magic strings for state attributes | `no-restricted-syntax` ban on string literals matching the project's HANDLED_ATTR values, suggesting the corresponding enum. |
| Free-function entry file | Custom ESLint rule (or a lightweight grep in `scripts/check-standalone-dist.mjs`): every `standalone-scripts/<project>/src/index.ts` must `export default class …` or `export class … extends BaseStandaloneScript`. |

Every detector above is an **automated tripwire**, not a code review checklist
item. RC-1 (the AI ignored existing patterns) is mitigated by CA-1
(mandatory pre-write check) plus CA-10 (scaffolder).

---

## 5. Why my memory was "fucked" — honest summary

Three structural reasons, in priority order:

1. **No pre-write check rule existed.** I had no memory entry telling me to
   look at the closest existing project before writing a new one. I treated
   "write a tiny banner script" as a greenfield task instead of a
   "follow-the-existing-pattern" task. → Fixed by CA-1.
2. **The "no swallowing" and "no inline CSS" rules were not surfaced under
   `standards/`.** They existed implicitly inside other memories. The Core
   index search-by-keyword would not find them when I'm working on a
   non-logging file. → Fixed by CA-3 + CA-4.
3. **No rule for `!important`, class architecture, or `as unknown as`
   casts existed at all.** I made the wrong default choice in a vacuum. →
   Fixed by CA-2, CA-5, CA-6.

Engineering is not a memory problem; it's a **pre-flight** problem. The fix
is to make "read the spec + read the closest existing file" a non-skippable
step, enforced by the index Core list and (eventually) by a scaffolder that
makes the wrong path harder than the right one.

---

## 6. Status

- [x] RCA written
- [x] Memories CA-1 to CA-6 created (this session)
- [x] Spec amended with §11–§16 + Q5–Q10 (this session)
- [ ] User reviews amended spec and answers Q1–Q10
- [ ] CA-9 — refactor `payment-banner-hider/src/index.ts`
- [ ] CA-10 — build `scripts/scaffold-standalone.mjs`
