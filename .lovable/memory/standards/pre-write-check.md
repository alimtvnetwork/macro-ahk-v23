---
name: pre-write-check
description: Before writing any new file in a known project area, read the closest existing sibling and follow its conventions
type: preference
---

# Pre-write check

Before creating or substantially rewriting any file under a known project
area (e.g. `standalone-scripts/<new-project>/`,
`src/components/<new-feature>/`, `src/background/<new-handler>/`), the
assistant MUST:

1. **Read the closest existing sibling** — open the most similar existing
   project / feature / handler and skim its structure.
2. **Read the relevant spec section** — at minimum
   `spec/02-coding-guidelines/01-cross-language/04-code-style/`,
   `spec/02-coding-guidelines/02-typescript/`, and any folder-specific
   guideline (e.g. `mem://standards/standalone-scripts-development.md`).
3. **Match the existing pattern** — file layout, naming, class vs. module
   choice, CSS location, instruction shape, lint config.
4. **Document deliberate departures** — if the new file *must* deviate from
   the canonical pattern, note it in the file header comment with a
   one-line reason.

## Why

Every drift incident in this codebase (instruction.ts duplication across 4
projects, payment-banner-hider's inline CSS + `!important` + error
swallow, etc.) started with the assistant treating a "new" file as a
greenfield write instead of as a "follow-the-existing-pattern" write.

## How to apply

When the user asks for a new standalone-scripts project:

1. `code--list_dir standalone-scripts/macro-controller` — read the
   canonical structure.
2. `code--view standalone-scripts/macro-controller/src/instruction.ts`,
   `…/macro-controller/less/index.less`, `…/macro-controller/src/index.ts`.
3. `code--view mem://standards/standalone-scripts-development.md` and
   `mem://standards/class-based-standalone-scripts.md`.
4. Only then produce the new files.

## Detection

This is a workflow rule for the assistant; there is no automated lint.
Skipping it produces RCAs like the one referenced below — the user notices
and writes another correction.

## Reference RCA

`spec/03-error-manage/01-error-resolution/03-retrospectives/2026-04-24-payment-banner-hider-rca.md`
