/**
 * Marco Extension — Script Injection Types
 *
 * Shared types for the injection handler.
 */

/** Assets declared in a script's manifest (css, templates). */
export interface ScriptAssets {
    css?: string;
    templates?: string;
}

/** A script to inject into a tab. */
export interface InjectableScript {
    id: string;
    name?: string;
    code: string;
    order: number;
    runAt?: "document_start" | "document_idle" | "document_end";
    configBinding?: string;
    themeBinding?: string;
    isIife?: boolean;
    /** Optional per-script assets (CSS file, template registry). */
    assets?: ScriptAssets;
}

/** Reason a script was skipped during resolution. */
export type SkipReason = "disabled" | "missing" | "resolver_mismatch" | "empty_code";

/** Result of a single script injection. */
export interface InjectionResult {
    scriptId: string;
    isSuccess: boolean;
    errorMessage?: string;
    durationMs: number;
    /** Set when the script was skipped before execution. */
    skipReason?: SkipReason;
    /** Human-readable name for display. */
    scriptName?: string;
    /** Which injection path was used (main-blob, userScripts, isolated-blob). */
    injectionPath?: string;
    /** DOM target used for script tag insertion (body/documentElement). */
    domTarget?: string;
}

/**
 * Response payload returned by the `INJECT_SCRIPTS` message handler.
 *
 * Single source of truth shared between background, UI, internal callers
 * (shortcut handler, context menu), the preview adapter mock, and E2E
 * tests. Adding a new field here automatically flows to every consumer
 * via TypeScript — preventing the previous drift where the popup hook
 * declared its own narrower `{ results }` shape and silently ignored
 * `inlineSyntaxErrorDetected`.
 */
export interface InjectScriptsResponse {
    /** Per-script outcome rows, in the order the handler executed them. */
    results: InjectionResult[];
    /**
     * `true` iff the inline syntax preflight (`requestHasInlineSyntaxError`)
     * tripped on this request. Always `false` on the cache-hit path, the
     * `forceReload: true` bypass, restricted-URL early returns, and
     * inaccessible-tab early returns. UI surfaces and tests should rely
     * on this flag instead of pattern-matching on `errorMessage` text.
     */
    inlineSyntaxErrorDetected: boolean;
}
