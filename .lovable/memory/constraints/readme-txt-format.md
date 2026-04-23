---
name: readme.txt format and prohibitions
description: readme.txt is a milestone marker only — never suggest format utilities, date/time formatters, generators, or "update" features for it
type: constraint
---

# readme.txt — Hard prohibitions

`readme.txt` is **only** the milestone marker file at the project root.
Format is fixed and manual:

```
let's start now {YYYY-MM-DD HH:MM:SS}
```

(Asia/Kuala_Lumpur, UTC+8.) It is refreshed by hand during version bumps —
nothing else writes to it, ever.

## Never suggest, build, or propose

- Utilities to **format Malaysia date as `dd-MMM-YYYY`**, 12-hour clock,
  or any other custom date/time format "for `readme.txt`". The format above
  is the only one. **Why:** Locked-in milestone marker convention; alternate
  formats break the version-bump workflow and the strictly-avoid policy.
- Helpers to **auto-generate, regenerate, or "update"** `readme.txt` from
  feature code, build steps, hooks, or scripts. **Why:** `readme.txt` was
  removed by explicit user request and only re-introduced as the manual
  milestone marker — automated writers re-create the original problem.
- "Workspace status / changelog" features that **target `readme.txt`** as
  the output file. Use a different file (e.g., `WORKSPACE_STATUS.md`,
  `.marco/workspace-status.json`, or `marco.files.save(...)`).
- Date/time formatting libraries or wrappers added "to support `readme.txt`
  generation". **Why:** No such generation exists or will exist.
- Prompts asking the user to choose a `readme.txt` format. **Why:** The
  format is non-negotiable.

## How to apply

If a request mentions `readme.txt` in any generative/formatting/update
context — refuse, cite this constraint and `.lovable/strictly-avoid.md`,
and offer alternative target files instead. Do **not** ask the user to
confirm the format.
