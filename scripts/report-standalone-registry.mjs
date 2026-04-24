#!/usr/bin/env node
/**
 * Standalone Registry Diagnostic Reporter
 *
 * Prints, in one place, every "source of truth" that must contain each
 * standalone-script entry. The goal: when a new bundle is added but only
 * wired into 5 of the 7 required locations (the recurring failure mode
 * that hid `payment-banner-hider` from CI), the missing rows are
 * IMMEDIATELY visible at the top of the CI log instead of only
 * surfacing as a downstream "artifact missing" failure 8 minutes later.
 *
 * Output sections:
 *   1. Canonical script list (folders found under standalone-scripts/)
 *   2. Per-script row with checkmarks for each registry location:
 *        - package.json build:<name> script
 *        - build:extension chain mentions compile-instruction <name>
 *        - scripts/build-standalone.mjs (compile-instruction + parallel job)
 *        - scripts/check-standalone-dist.mjs REQUIRED_ARTIFACTS
 *        - powershell.json standaloneArtifacts.required[]
 *        - tests/e2e/global-setup.ts buildSteps
 *        - .github/workflows/ci.yml dedicated build-<name> job
 *        - tsconfig.<name>.json + vite.config.<name>.ts present
 *   3. Resolved dist paths (absolute + size + mtime if present)
 *   4. Summary: "X of Y scripts fully wired" — exits 1 on any missing.
 *
 * Run locally:
 *   node scripts/report-standalone-registry.mjs
 *   node scripts/report-standalone-registry.mjs --strict   (exit 1 on gaps)
 *   node scripts/report-standalone-registry.mjs --json     (machine-readable)
 *
 * In CI: wired as the `report-standalone-registry` job — runs in parallel
 * with spec-links / typecheck so registry gaps surface in the first
 * 30 seconds of the pipeline.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STANDALONE_DIR = path.join(ROOT, "standalone-scripts");

const argv = process.argv.slice(2);
const STRICT = argv.includes("--strict");
const JSON_MODE = argv.includes("--json");

/* ------------------------------------------------------------------ */
/*  Step 1 — discover canonical script folders                         */
/* ------------------------------------------------------------------ */

/**
 * Folders inside standalone-scripts/ that are NOT shippable scripts
 * and must be excluded from the registry crosscheck.
 */
const NON_SCRIPT_FOLDERS = new Set([
    "prompts",      // aggregated prompt JSON, no build:<name> script
    "types",        // shared d.ts files
    "shared",       // shared utilities (if present)
    "_generated",   // build-time generated artifacts (e.g. seed-manifest output)
    "node_modules",
]);

function discoverScripts() {
    if (!fs.existsSync(STANDALONE_DIR)) {
        console.error(`[FAIL] standalone-scripts/ directory not found at ${STANDALONE_DIR}`);
        process.exit(1);
    }
    return fs
        .readdirSync(STANDALONE_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !NON_SCRIPT_FOLDERS.has(d.name))
        .map((d) => d.name)
        .sort();
}

/* ------------------------------------------------------------------ */
/*  Step 2 — load every registry source once                           */
/* ------------------------------------------------------------------ */

function readFileSafe(relPath) {
    const abs = path.join(ROOT, relPath);
    if (!fs.existsSync(abs)) return null;
    return fs.readFileSync(abs, "utf-8");
}

function readJsonSafe(relPath) {
    const raw = readFileSafe(relPath);
    if (raw === null) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

const registries = {
    packageJson: readJsonSafe("package.json"),
    buildStandaloneSrc: readFileSafe("scripts/build-standalone.mjs"),
    checkDistSrc: readFileSafe("scripts/check-standalone-dist.mjs"),
    powershellJson: readJsonSafe("powershell.json"),
    globalSetupSrc: readFileSafe("tests/e2e/global-setup.ts"),
    ciYml: readFileSafe(".github/workflows/ci.yml"),
};

/* ------------------------------------------------------------------ */
/*  Step 3 — per-script crosscheck                                     */
/* ------------------------------------------------------------------ */

/**
 * Per-folder check: does the script appear in each registry location?
 * Returns an object of { location: boolean }.
 */
function checkScript(name) {
    const checks = {};

    // 1. package.json: build:<name> script (or build:sdk for marco-sdk)
    const buildKey = name === "marco-sdk" ? "build:sdk" : `build:${name}`;
    checks.pkgScript = !!(registries.packageJson?.scripts?.[buildKey]);

    // 2. build:extension chain references this script's compile-instruction step
    const extChain = registries.packageJson?.scripts?.["build:extension"] ?? "";
    checks.pkgExtensionChain = extChain.includes(`standalone-scripts/${name}`);

    // 3. build-standalone.mjs (compile-instruction prereq + PARALLEL_JOBS entry)
    const bs = registries.buildStandaloneSrc ?? "";
    checks.buildStandalone =
        bs.includes(`standalone-scripts/${name}`) &&
        bs.includes(`name: "${name}"`);

    // 4. check-standalone-dist.mjs REQUIRED_ARTIFACTS map
    checks.checkDist =
        (registries.checkDistSrc ?? "").includes(`"${name}":`);

    // 5. powershell.json standaloneArtifacts.required[]
    const psRequired = registries.powershellJson?.standaloneArtifacts?.required ?? [];
    checks.powershellJson = psRequired.some((r) => r.folder === name);

    // 6. tests/e2e/global-setup.ts buildSteps
    checks.globalSetup =
        (registries.globalSetupSrc ?? "").includes(`'build:${name}'`) ||
        (registries.globalSetupSrc ?? "").includes(`'${buildKey}'`);

    // 7. .github/workflows/ci.yml dedicated build-<name> job
    const ci = registries.ciYml ?? "";
    checks.ciJob = ci.includes(`build-${name}:`) || (name === "marco-sdk" && ci.includes("build-sdk:"));

    // 8. tsconfig + vite.config present (filename varies — try common shapes)
    const tsconfigCandidates = [
        `tsconfig.${name}.json`,
        name === "marco-sdk" ? "tsconfig.sdk.json" : null,
        name === "macro-controller" ? "tsconfig.macro.build.json" : null,
    ].filter(Boolean);
    const viteCandidates = [
        `vite.config.${name}.ts`,
        name === "marco-sdk" ? "vite.config.sdk.ts" : null,
        name === "macro-controller" ? "vite.config.macro.ts" : null,
    ].filter(Boolean);
    checks.tsconfig = tsconfigCandidates.some((f) => fs.existsSync(path.join(ROOT, f)));
    checks.viteConfig = viteCandidates.some((f) => fs.existsSync(path.join(ROOT, f)));

    return checks;
}

/* ------------------------------------------------------------------ */
/*  Step 4 — resolved dist paths                                       */
/* ------------------------------------------------------------------ */

function resolveDist(name) {
    const distDir = path.join(STANDALONE_DIR, name, "dist");
    if (!fs.existsSync(distDir)) {
        return { distDir, exists: false, files: [] };
    }
    const files = fs.readdirSync(distDir).map((f) => {
        const abs = path.join(distDir, f);
        const stat = fs.statSync(abs);
        return { name: f, sizeBytes: stat.size, mtime: stat.mtime.toISOString() };
    });
    return { distDir, exists: true, files };
}

/* ------------------------------------------------------------------ */
/*  Step 5 — render report                                             */
/* ------------------------------------------------------------------ */

const LOCATION_LABELS = {
    pkgScript:          "package.json build:<name>",
    pkgExtensionChain:  "build:extension chain",
    buildStandalone:    "build-standalone.mjs",
    checkDist:          "check-standalone-dist.mjs",
    powershellJson:     "powershell.json",
    globalSetup:        "tests/e2e/global-setup.ts",
    ciJob:              ".github/workflows/ci.yml job",
    tsconfig:           "tsconfig.<name>.json",
    viteConfig:         "vite.config.<name>.ts",
};

/**
 * Per missing location: exact file + JSON path / YAML key + ready-to-paste
 * snippet. Lets the operator patch orchestration without grepping the repo.
 */
function fixHint(locationKey, scriptName) {
    const buildKey = scriptName === "marco-sdk" ? "build:sdk" : `build:${scriptName}`;
    switch (locationKey) {
        case "pkgScript":
            return {
                file: "package.json",
                jsonPath: `scripts["${buildKey}"]`,
                snippet: `"${buildKey}": "vite build --config vite.config.${scriptName}.ts"`,
            };
        case "pkgExtensionChain":
            return {
                file: "package.json",
                jsonPath: `scripts["build:extension"]`,
                snippet: `... && node scripts/compile-instruction.mjs standalone-scripts/${scriptName} && npm run ${buildKey} && ...`,
            };
        case "buildStandalone":
            return {
                file: "scripts/build-standalone.mjs",
                jsonPath: "PARALLEL_JOBS[] / compile-instruction targets",
                snippet:
                    `compile-instruction targets:  "standalone-scripts/${scriptName}"\n` +
                    `PARALLEL_JOBS:                { name: "${scriptName}", cmd: "npm", args: ["run", "${buildKey}"] }`,
            };
        case "checkDist":
            return {
                file: "scripts/check-standalone-dist.mjs",
                jsonPath: "REQUIRED_ARTIFACTS",
                snippet:
                    `"${scriptName}": [\n` +
                    `    "standalone-scripts/${scriptName}/dist/${scriptName}.js",\n` +
                    `    "standalone-scripts/${scriptName}/dist/instruction.json",\n` +
                    `]`,
            };
        case "powershellJson":
            return {
                file: "powershell.json",
                jsonPath: "standaloneArtifacts.required[]",
                snippet: `{ "folder": "${scriptName}", "files": ["${scriptName}.js", "instruction.json"] }`,
            };
        case "globalSetup":
            return {
                file: "tests/e2e/global-setup.ts",
                jsonPath: "buildSteps[]",
                snippet: `{ name: '${buildKey}', cmd: 'npm', args: ['run', '${buildKey}'] }`,
            };
        case "ciJob":
            return {
                file: ".github/workflows/ci.yml",
                jsonPath: `jobs.build-${scriptName}  (+ jobs.build-extension.needs[])`,
                snippet:
                    `build-${scriptName}:\n` +
                    `  runs-on: ubuntu-latest\n` +
                    `  needs: [install]\n` +
                    `  steps:\n` +
                    `    - uses: actions/checkout@v4\n` +
                    `    - run: npm ci\n` +
                    `    - run: npm run ${buildKey}\n` +
                    `    - uses: actions/upload-artifact@v4\n` +
                    `      with:\n` +
                    `        name: standalone-${scriptName}\n` +
                    `        path: standalone-scripts/${scriptName}/dist/\n` +
                    `# Then: add 'build-${scriptName}' to jobs.build-extension.needs[]\n` +
                    `# and download-artifact 'standalone-${scriptName}' before the extension build.`,
            };
        case "tsconfig":
            return {
                file: `tsconfig.${scriptName}.json`,
                jsonPath: "(create file)",
                snippet:
                    `{\n` +
                    `  "extends": "./tsconfig.standalone.base.json",\n` +
                    `  "include": ["standalone-scripts/${scriptName}/src/**/*.ts", "standalone-scripts/types/**/*.d.ts"],\n` +
                    `  "compilerOptions": { "outDir": "standalone-scripts/${scriptName}/dist" }\n` +
                    `}`,
            };
        case "viteConfig":
            return {
                file: `vite.config.${scriptName}.ts`,
                jsonPath: "(create file)",
                snippet:
                    `import { defineConfig } from "vite";\n` +
                    `export default defineConfig({\n` +
                    `  build: {\n` +
                    `    outDir: "standalone-scripts/${scriptName}/dist",\n` +
                    `    emptyOutDir: false,\n` +
                    `    lib: {\n` +
                    `      entry: "standalone-scripts/${scriptName}/src/index.ts",\n` +
                    `      formats: ["iife"],\n` +
                    `      name: "${scriptName.replace(/[-_](.)/g, (_, c) => c.toUpperCase())}",\n` +
                    `      fileName: () => "${scriptName}.js",\n` +
                    `    },\n` +
                    `  },\n` +
                    `});`,
            };
        default:
            return { file: "(unknown)", jsonPath: "(unknown)", snippet: "(no hint)" };
    }
}

const scripts = discoverScripts();
const report = scripts.map((name) => ({
    name,
    checks: checkScript(name),
    dist: resolveDist(name),
}));

if (JSON_MODE) {
    process.stdout.write(JSON.stringify({ scripts: report }, null, 2) + "\n");
    const anyMissing = report.some((r) => Object.values(r.checks).some((v) => !v));
    process.exit(STRICT && anyMissing ? 1 : 0);
}

/* Pretty text output ------------------------------------------------ */

const HR = "════════════════════════════════════════════════════════════════════════";
const SR = "────────────────────────────────────────────────────────────────────────";

console.log("");
console.log(HR);
console.log("  Standalone Script Registry Report");
console.log(HR);
console.log(`  Repo root: ${ROOT}`);
console.log(`  Discovered ${scripts.length} script folder(s) under standalone-scripts/:`);
for (const s of scripts) console.log(`    - ${s}`);
console.log("");

// Section A — registry crosscheck table
console.log(SR);
console.log("  Section A — Registry crosscheck");
console.log("  Each row shows whether the script appears in each required");
console.log("  source of truth. A missing entry ([X]) is the failure mode");
console.log("  that lets a script slip past CI silently.");
console.log(SR);

const locKeys = Object.keys(LOCATION_LABELS);
const nameWidth = Math.max(...scripts.map((s) => s.length), 6);

// Header
const header =
    "  " + "script".padEnd(nameWidth) +
    "  " + locKeys.map((k) => LOCATION_LABELS[k].padEnd(28)).join(" ");
console.log(header);

let totalGaps = 0;
const perScriptGaps = {};

for (const r of report) {
    const cells = locKeys.map((k) => {
        const ok = r.checks[k];
        if (!ok) {
            totalGaps++;
            perScriptGaps[r.name] = (perScriptGaps[r.name] ?? 0) + 1;
        }
        return (ok ? "[OK]" : "[X] ").padEnd(28);
    });
    console.log("  " + r.name.padEnd(nameWidth) + "  " + cells.join(" "));
}
console.log("");

// Section B — resolved dist paths
console.log(SR);
console.log("  Section B — Resolved dist paths (post-build)");
console.log("  Empty/missing dist folders mean the script's build:<name>");
console.log("  has not run yet OR the orchestration entry above is missing.");
console.log(SR);

for (const r of report) {
    console.log(`  ${r.name}`);
    console.log(`    distDir: ${r.dist.distDir}`);
    if (!r.dist.exists) {
        console.log(`    [WARN] dist/ does not exist — bundle has not been built`);
    } else if (r.dist.files.length === 0) {
        console.log(`    [WARN] dist/ is empty`);
    } else {
        for (const f of r.dist.files) {
            console.log(`      ${f.name.padEnd(40)} ${String(f.sizeBytes).padStart(10)} bytes  ${f.mtime}`);
        }
    }
    console.log("");
}

// Section C — summary + GitHub Step Summary
console.log(SR);
console.log("  Section C — Summary");
console.log(SR);

const fullyWired = report.filter((r) => Object.values(r.checks).every(Boolean));
console.log(`  Fully wired: ${fullyWired.length} of ${report.length} script(s)`);
if (totalGaps > 0) {
    console.log(`  Total registry gaps: ${totalGaps}`);
    for (const [name, count] of Object.entries(perScriptGaps)) {
        const missing = locKeys.filter((k) => !report.find((r) => r.name === name).checks[k]);
        console.log(`    - ${name}: ${count} missing → ${missing.map((k) => LOCATION_LABELS[k]).join(", ")}`);
    }
}
console.log("");

/* ------------------------------------------------------------------ */
/*  Step 6 — emit GitHub Actions Step Summary if available             */
/* ------------------------------------------------------------------ */

if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [];
    lines.push("# Standalone Script Registry Report");
    lines.push("");
    lines.push(`**Scripts discovered:** ${scripts.length} (${scripts.join(", ")})`);
    lines.push(`**Fully wired:** ${fullyWired.length} of ${report.length}`);
    lines.push(`**Registry gaps:** ${totalGaps}`);
    lines.push("");
    lines.push("## Crosscheck");
    lines.push("");
    lines.push("| Script | " + locKeys.map((k) => LOCATION_LABELS[k]).join(" | ") + " |");
    lines.push("|" + new Array(locKeys.length + 1).fill("---").join("|") + "|");
    for (const r of report) {
        const cells = locKeys.map((k) => (r.checks[k] ? "✅" : "❌"));
        lines.push(`| \`${r.name}\` | ` + cells.join(" | ") + " |");
    }
    lines.push("");
    lines.push("## Resolved dist paths");
    lines.push("");
    for (const r of report) {
        lines.push(`### \`${r.name}\``);
        lines.push("");
        lines.push("```");
        lines.push(`distDir: ${r.dist.distDir}`);
        if (!r.dist.exists) {
            lines.push("[WARN] dist/ does not exist");
        } else if (r.dist.files.length === 0) {
            lines.push("[WARN] dist/ is empty");
        } else {
            for (const f of r.dist.files) {
                lines.push(`  ${f.name.padEnd(40)} ${String(f.sizeBytes).padStart(10)} bytes`);
            }
        }
        lines.push("```");
        lines.push("");
    }
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}

/* ------------------------------------------------------------------ */
/*  Step 7 — exit code                                                 */
/* ------------------------------------------------------------------ */

if (totalGaps > 0) {
    if (STRICT) {
        console.error(`[FAIL] ${totalGaps} registry gap(s) detected (--strict).`);
        process.exit(1);
    }
    console.log(`[WARN] ${totalGaps} registry gap(s) detected (informational; pass --strict to fail).`);
}

console.log("[OK] Standalone registry report complete.");
