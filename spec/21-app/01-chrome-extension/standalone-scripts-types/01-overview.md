# Standalone-Scripts Global Types — Specification

**Status:** Draft for review
**Owner:** Riseup Asia LLC
**Created:** 2026-04-24 (UTC+8)
**Drives:** `standalone-scripts/types/instruction/**` and the refactor of every
`standalone-scripts/<project>/src/instruction.ts` file in the repository.

---

## 1. Problem Statement

Today every standalone-scripts project (`marco-sdk`, `xpath`,
`macro-controller`, `payment-banner-hider`, …) re-declares the
`ProjectInstruction` shape inline at the top of its own `instruction.ts`. This
has caused four concrete defects:

1. **Drift** — the four copies of `ProjectInstruction` are *almost* identical
   but not exactly; `xpath` and `payment-banner-hider` omit
   `configSeedIds`, `macro-controller` omits `isGlobal`.
2. **In-place anonymous arrays** — `assets.css: Array<{ file: string; inject:
   "head" }>` etc. are defined inline. They are not nameable, not reusable,
   and not lintable for required fields.
3. **String-literal unions instead of enums** — `world: "MAIN" | "ISOLATED"`,
   `runAt: string`, `matchType: "glob" | "regex" | "exact"`,
   `role: "session" | "refresh" | "other"`. There is no single source of
   truth for the legal values.
4. **`unknown` leaks into the public namespace API** — e.g.
   `NamespaceLogApi.info(msg, meta?: Record<string, unknown>)` violates the
   project-wide *No Explicit Unknown* policy
   (`mem://standards/unknown-usage-policy`).

In addition, the user has requested two features the current design does not
support at all:

5. **XPath grouping** — a project should be able to declare a *group* of
   related XPaths under one logical name, with a shared *wrapping* XPath that
   serves as the root.
6. **Relative XPath** — an XPath entry should be able to declare itself as
   relative to another named XPath (the "root variable") and be resolved by
   string-concatenation at runtime.

---

## 2. Goals

- **G1.** One shared, strongly-typed `ProjectInstruction` consumed by every
  standalone project. Removal of all in-place duplicates.
- **G2.** Each public type lives in **its own file**, named after the type,
  to make hand-off to other AI models trivial.
- **G3.** `enum` (or `as const` literal-union exported as a `type`) for every
  closed value set: `InjectionWorld`, `RunAt`, `MatchType`, `CookieRole`,
  `AssetInjectTarget`, `XPathKind`.
- **G4.** Zero `unknown` in the public surface. Generic `<T>` escape hatches
  only at extensible leaves (e.g. user-defined log meta).
- **G5.** Use **`type` exclusively**, never `interface`, in
  `standalone-scripts/**` — enforced by ESLint
  `@typescript-eslint/consistent-type-definitions: ["error", "type"]`.
- **G6.** No abbreviated identifiers in source. `fn`, `cb`, `el`, `msg`,
  `cfg`, `ctx`, `evt`, `val`, `idx`, `len`, `tmp` are banned via
  `id-denylist`. Use the full word.
- **G7.** Forward-compatible: bumping `schemaVersion` from `"1.0"` must not
  require touching a project's `instruction.ts` unless that project opts in
  to a new feature.

---

## 3. Non-Goals

- This spec does **not** change runtime injection behaviour. The compiled
  `dist/instruction.json` shape is identical to today's output.
- This spec does **not** introduce a new XPath *resolver*. The resolver
  already exists in `standalone-scripts/xpath/`. We only add the *declarative
  type* for grouped + relative XPaths so projects can ship an XPath registry
  alongside their instruction.

---

## 4. File Layout

All shared types live under:

```
standalone-scripts/types/
├── riseup-namespace.d.ts          (existing — global window.RiseupAsiaMacroExt)
├── project-namespace-shape.d.ts   (existing — per-project namespace contract)
└── instruction/
    ├── index.ts                   (barrel: re-exports every public type)
    ├── 01-injection-world.ts      (enum InjectionWorld)
    ├── 02-run-at.ts               (enum RunAt)
    ├── 03-match-type.ts           (enum MatchType)
    ├── 04-cookie-role.ts          (enum CookieRole)
    ├── 05-asset-inject-target.ts  (enum AssetInjectTarget)
    ├── 06-xpath-kind.ts           (enum XPathKind)
    ├── 10-seed-target-url.ts      (type SeedTargetUrl)
    ├── 11-seed-cookie.ts          (type SeedCookie)
    ├── 12-seed-block.ts           (type SeedBlock)
    ├── 20-asset-css.ts            (type AssetCss)
    ├── 21-asset-config.ts         (type AssetConfig)
    ├── 22-asset-script.ts         (type AssetScript)
    ├── 23-asset-template.ts       (type AssetTemplate)
    ├── 24-asset-prompt.ts         (type AssetPrompt)
    ├── 25-asset-bundle.ts         (type AssetBundle)
    ├── 30-xpath-entry.ts          (type XPathEntry — direct or relative)
    ├── 31-xpath-group.ts          (type XPathGroup — wrapping XPath + members)
    ├── 32-xpath-registry.ts       (type XPathRegistry)
    └── 40-project-instruction.ts  (type ProjectInstruction)
```

Naming follows `mem://workflow/file-naming-convention` (`NN-name.ts`). The
numeric prefix is the canonical load/dependency order between files.

> One type per file. **No re-declarations.** **No `interface`.** **No
> in-place anonymous object types.**

---

## 5. Type Definitions (Authoritative Reference)

These are the exact shapes that will land under
`standalone-scripts/types/instruction/`. Each block here corresponds to one
file under that directory.

### 5.1 `01-injection-world.ts`

```ts
export enum InjectionWorld {
    Main = "MAIN",
    Isolated = "ISOLATED",
}
```

### 5.2 `02-run-at.ts`

```ts
export enum RunAt {
    DocumentStart = "document_start",
    DocumentEnd = "document_end",
    DocumentIdle = "document_idle",
}
```

### 5.3 `03-match-type.ts`

```ts
export enum MatchType {
    Glob = "glob",
    Regex = "regex",
    Exact = "exact",
}
```

### 5.4 `04-cookie-role.ts`

```ts
export enum CookieRole {
    Session = "session",
    Refresh = "refresh",
    Other = "other",
}
```

### 5.5 `05-asset-inject-target.ts`

```ts
export enum AssetInjectTarget {
    Head = "head",
    Body = "body",
}
```

### 5.6 `06-xpath-kind.ts`

```ts
export enum XPathKind {
    /** Absolute XPath, evaluated from `document`. */
    Absolute = "absolute",
    /**
     * XPath that is concatenated onto the resolved root-element XPath of
     * another named entry. The other entry is referenced by `relativeTo`.
     */
    Relative = "relative",
}
```

### 5.7 `10-seed-target-url.ts`

```ts
import type { MatchType } from "./03-match-type";

export type SeedTargetUrl = {
    pattern: string;
    matchType: MatchType;
};
```

### 5.8 `11-seed-cookie.ts`

```ts
import type { CookieRole } from "./04-cookie-role";

export type SeedCookie = {
    cookieName: string;
    url: string;
    role: CookieRole;
    description: string;
};
```

### 5.9 `12-seed-block.ts`

```ts
import type { RunAt } from "./02-run-at";
import type { SeedTargetUrl } from "./10-seed-target-url";
import type { SeedCookie } from "./11-seed-cookie";

/**
 * Per-project runtime settings. Concrete projects narrow `TSettings` to
 * their own schema (e.g. `MacroControllerSettings`). The base type forbids
 * `unknown` — projects MUST declare their settings shape.
 */
export type SeedBlock<TSettings extends object = Record<string, never>> = {
    /** Deterministic ID for chrome.storage.local */
    id: string;
    seedOnInstall: boolean;
    isRemovable: boolean;
    autoInject: boolean;
    runAt?: RunAt;
    cookieBinding?: string;
    targetUrls: ReadonlyArray<SeedTargetUrl>;
    cookies: ReadonlyArray<SeedCookie>;
    settings: TSettings;
    /** Deterministic seed IDs per config key. */
    configSeedIds?: Readonly<Record<string, string>>;
};
```

### 5.10 `20-asset-css.ts`

```ts
import type { AssetInjectTarget } from "./05-asset-inject-target";

export type AssetCss = {
    file: string;
    inject: AssetInjectTarget;
};
```

### 5.11 `21-asset-config.ts`

```ts
export type AssetConfig = {
    file: string;
    /** Key used to identify this config at runtime. */
    key: string;
    /** Optional: inject as `window[injectAs]` global. */
    injectAs?: string;
};
```

### 5.12 `22-asset-script.ts`

```ts
export type AssetScript = {
    file: string;
    order: number;
    /** Which config key this script depends on. */
    configBinding?: string;
    /** Which config key provides theme data. */
    themeBinding?: string;
    /** Whether the script is an IIFE wrapper. */
    isIife?: boolean;
};
```

### 5.13 `23-asset-template.ts`

```ts
export type AssetTemplate = {
    file: string;
    /** Optional: inject as `window[injectAs]` global. */
    injectAs?: string;
};
```

### 5.14 `24-asset-prompt.ts`

```ts
export type AssetPrompt = {
    file: string;
};
```

### 5.15 `25-asset-bundle.ts`

```ts
import type { AssetCss } from "./20-asset-css";
import type { AssetConfig } from "./21-asset-config";
import type { AssetScript } from "./22-asset-script";
import type { AssetTemplate } from "./23-asset-template";
import type { AssetPrompt } from "./24-asset-prompt";

export type AssetBundle = {
    css: ReadonlyArray<AssetCss>;
    configs: ReadonlyArray<AssetConfig>;
    scripts: ReadonlyArray<AssetScript>;
    templates: ReadonlyArray<AssetTemplate>;
    prompts: ReadonlyArray<AssetPrompt>;
};
```

### 5.16 `30-xpath-entry.ts`

```ts
import type { XPathKind } from "./06-xpath-kind";

/**
 * One named XPath. Either absolute (resolved from `document`) or relative
 * (resolved from the root element of `relativeTo`).
 */
export type XPathEntry =
    | {
          name: string;
          kind: XPathKind.Absolute;
          xpath: string;
          description?: string;
      }
    | {
          name: string;
          kind: XPathKind.Relative;
          /** Name of the XPathEntry or XPathGroup to resolve as the root. */
          relativeTo: string;
          /** Suffix XPath, concatenated as `root + xpath` at resolve time. */
          xpath: string;
          description?: string;
      };
```

### 5.17 `31-xpath-group.ts`

```ts
import type { XPathEntry } from "./30-xpath-entry";

/**
 * A logical grouping of XPaths sharing a wrapping ancestor.
 *
 * `wrapper` is an absolute XPath. Every `member` whose `kind` is
 * `Relative` and whose `relativeTo` equals this group's `name` is
 * concatenated onto `wrapper` at runtime.
 */
export type XPathGroup = {
    name: string;
    wrapper: string;
    description?: string;
    members: ReadonlyArray<XPathEntry>;
};
```

### 5.18 `32-xpath-registry.ts`

```ts
import type { XPathEntry } from "./30-xpath-entry";
import type { XPathGroup } from "./31-xpath-group";

export type XPathRegistry = {
    entries: ReadonlyArray<XPathEntry>;
    groups: ReadonlyArray<XPathGroup>;
};
```

### 5.19 `40-project-instruction.ts`

```ts
import type { InjectionWorld } from "./01-injection-world";
import type { SeedBlock } from "./12-seed-block";
import type { AssetBundle } from "./25-asset-bundle";
import type { XPathRegistry } from "./32-xpath-registry";

/**
 * Strongly-typed project manifest. One instance per standalone-scripts
 * project, default-exported from `<project>/src/instruction.ts`.
 *
 * `TSettings` lets each project narrow `seed.settings` to its own schema.
 */
export type ProjectInstruction<TSettings extends object = Record<string, never>> = {
    schemaVersion: string;
    name: string;
    displayName: string;
    version: string;
    description: string;
    world: InjectionWorld;
    isGlobal?: boolean;
    dependencies: ReadonlyArray<string>;
    loadOrder: number;
    seed: SeedBlock<TSettings>;
    assets: AssetBundle;
    /** Optional declarative XPath registry shipped with the project. */
    xpaths?: XPathRegistry;
};
```

### 5.20 `index.ts`

Barrel re-exporting every type and enum above. Consumers import from
`standalone-scripts/types/instruction` only — never from individual files.

---

## 6. Migration Plan

| # | Project                  | Action                                                                 |
|---|--------------------------|------------------------------------------------------------------------|
| 1 | `marco-sdk`              | Delete inline `ProjectInstruction`/`SeedBlock`/`SeedCookie`/`SeedTargetUrl`. Re-export shared types from `instruction.ts` for backwards-compat. |
| 2 | `xpath`                  | Replace local `import type { SeedBlock, … } from "../../marco-sdk/src/instruction"` with `import type { … } from "../../types/instruction"`. |
| 3 | `macro-controller`       | Same as #2. Define `MacroControllerSettings` type and use `ProjectInstruction<MacroControllerSettings>`. |
| 4 | `payment-banner-hider`   | Same as #2. Replace `world: "MAIN"` literal with `InjectionWorld.Main`, `runAt: "document_idle"` with `RunAt.DocumentIdle`, `matchType: "glob"` with `MatchType.Glob`. |

Every project that runs through the build (`scripts/build-standalone.mjs`)
must continue to emit byte-identical `dist/instruction.json`. We will assert
this with a snapshot test before and after the refactor.

---

## 7. Lint Enforcement

Add to the root ESLint config under an override for
`standalone-scripts/**/*.ts`:

```jsonc
{
  "files": ["standalone-scripts/**/*.ts"],
  "rules": {
    "@typescript-eslint/consistent-type-definitions": ["error", "type"],
    "@typescript-eslint/no-explicit-any": "error",
    "id-denylist": [
      "error",
      "fn", "cb", "el", "msg", "cfg", "ctx",
      "evt", "val", "idx", "len", "tmp", "obj",
      "arr", "str", "num", "res", "req", "err"
    ],
    "no-restricted-syntax": [
      "error",
      {
        "selector": "TSTypeReference[typeName.name='Record'][typeArguments.params.1.type='TSUnknownKeyword']",
        "message": "Record<string, unknown> is banned. Define a concrete type or use a generic <T>."
      },
      {
        "selector": "TSUnknownKeyword",
        "message": "`unknown` is banned in standalone-scripts. Use a concrete type or a generic <T>."
      }
    ]
  }
}
```

The `unknown` ban has a single documented exception: the `CaughtError` alias
in catch blocks (`mem://architecture/data-type-definitions`). That alias
must be imported, never re-declared inline.

---

## 8. Namespace Log API — Removing `unknown`

Current (`standalone-scripts/types/project-namespace-shape.d.ts`):

```ts
interface NamespaceLogApi {
    info: (msg: string, meta?: Record<string, unknown>) => unknown;
    warn: (msg: string, meta?: Record<string, unknown>) => unknown;
    error: (msg: string, meta?: Record<string, unknown>) => unknown;
}
```

Replace with:

```ts
// standalone-scripts/types/instruction/50-namespace-log.ts
export type NamespaceLogMeta = {
    /** Logical function name producing the entry. */
    functionName: string;
    /** Optional structured tags. Values are JSON-serialisable scalars. */
    tags?: Readonly<Record<string, string | number | boolean | null>>;
    /** Optional caught error reference (uses CaughtError alias). */
    cause?: import("../../macro-controller/src/error-utils").CaughtError;
};

export type NamespaceLogApi = {
    info: (message: string, meta?: NamespaceLogMeta) => void;
    warn: (message: string, meta?: NamespaceLogMeta) => void;
    error: (message: string, meta?: NamespaceLogMeta) => void;
};
```

Identical treatment is required for `NamespaceVarsApi`, `NamespaceKvApi`,
`NamespaceFilesApi`, `NamespaceDbApi`, `NamespaceRestKvApi`,
`NamespaceRestFilesApi`, `NamespaceRestDbApi`, `NamespaceNotifyApi`. Each
must replace `unknown` with either a concrete shape or a project-supplied
generic `<T>` parameter at the leaf only.

---

## 9. Open Questions for Review

Before any code is written, please confirm:

- **Q1.** Use TypeScript `enum` (with string values) — or `as const` literal
  unions exported as `type`? Spec assumes **enum** because the user said
  "proper enum". If you prefer the const-object pattern, say so.
- **Q2.** Should `XPathRegistry` be optional on `ProjectInstruction` (current
  draft) or required for every project? Spec assumes **optional** for
  backward compatibility.
- **Q3.** Is `Record<string, never>` an acceptable empty default for the
  `TSettings` generic, or should we expose a named `EmptySettings` type?
- **Q4.** Does the `id-denylist` list cover everything you want banned? Add
  or remove names before we wire the lint rule.

---

## 10. Out-of-Scope Follow-Ups

These are tracked for later phases:

- Generate JSON-schema from `ProjectInstruction` and validate
  `dist/instruction.json` at build time.
- Surface the declarative `XPathRegistry` through the runtime
  `RiseupAsiaMacroExt.Projects.<CodeName>.xpath` namespace.
- Auto-generate per-project namespace `globals.d.ts` from the project's
  `ProjectInstruction<TSettings>` so `_internal` shapes stay in sync.
