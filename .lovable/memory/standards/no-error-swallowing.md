---
name: no-error-swallowing
description: catch blocks must log, rethrow, or carry an inline JUSTIFIED comment — never silent return
type: constraint
---

# No error swallowing

Every `catch` block must do **one** of the following:

1. **Log** the caught value via `RiseupAsiaMacroExt.Logger.error(functionName,
   message, error)` (preferred for standalone-scripts) or
   `console.warn(message, error)` for pre-namespace bootstrap code.
2. **Re-throw** the original error or a wrapped error that preserves
   `.cause`.
3. Carry an inline `// SWALLOW JUSTIFIED: <reason>` comment on the line
   immediately above the swallow, explaining why the failure is safe to
   ignore (e.g. *"feature-detection probe — absence is the expected fail
   path"*).

## Banned patterns

```ts
// ❌ BANNED — silent return swallows the cause
try { return JSON.parse(raw); } catch { return null; }

// ❌ BANNED — boolean swallow
try { doIt(); } catch { return false; }

// ❌ BANNED — empty catch
try { doIt(); } catch {}
```

## Required patterns

```ts
// ✅ Log + return null
try {
    return JSON.parse(raw);
} catch (error: CaughtError) {
    RiseupAsiaMacroExt.Logger?.error("parsePromptJson", "invalid JSON", error);

    return null;
}

// ✅ Re-throw with cause
try {
    await fetchToken();
} catch (error: CaughtError) {
    throw new Error("token fetch failed", { cause: error });
}

// ✅ Justified swallow
try {
    // SWALLOW JUSTIFIED: probe — XPath may not exist on first paint
    return Boolean(document.evaluate(probe, document, null, 0, null));
} catch {
    return false;
}
```

## Detection

ESLint `no-restricted-syntax` rule:
```
CatchClause:has(BlockStatement[body.length=1] > ReturnStatement):not(
  CatchClause:has(Comment[value=/SWALLOW JUSTIFIED/])
)
```

## Reference RCA

`spec/03-error-manage/01-error-resolution/03-retrospectives/2026-04-24-payment-banner-hider-rca.md`
