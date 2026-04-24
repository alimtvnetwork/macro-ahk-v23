---
name: blank-line-before-return
description: Every return statement must be preceded by a blank line, except as the first statement of a block
type: preference
---

# Blank line before `return`

Every `return` statement MUST be preceded by a blank line, **except** when
the `return` is the very first statement of its block (`if (…) { return; }`,
arrow-function bodies, single-line guards).

## Why

Visual separation makes the function's exit points scannable. A return
buried in a wall of statements with no preceding blank line is the most
common cause of "I missed that early-return" review comments.

## Examples

```ts
// ✅ Allowed — single-statement block
if (!target) return null;

// ✅ Allowed — first statement of the block
function getName(user: User): string {
    return user.name;
}

// ✅ Required — blank line before return after other statements
function buildBanner(record: Record): Element {
    const node = document.createElement("div");
    node.className = "marco-banner";
    node.textContent = record.message;

    return node;
}

// ❌ Banned — return follows a statement with no blank line
function buildBanner(record: Record): Element {
    const node = document.createElement("div");
    node.textContent = record.message;
    return node;
}
```

## Detection

ESLint:
```jsonc
"padding-line-between-statements": [
    "error",
    { "blankLine": "always", "prev": "*", "next": "return" }
]
```

## Reference

- Existing related guideline:
  `spec/02-coding-guidelines/01-cross-language/04-code-style/03-blank-lines-and-spacing.md`
- RCA:
  `spec/03-error-manage/01-error-resolution/03-retrospectives/2026-04-24-payment-banner-hider-rca.md`
