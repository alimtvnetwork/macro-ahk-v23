# Memory: architecture/build-preflight-system
Updated: 2026-04-24

## Modular Architecture (v2.0)

The build system was refactored from a monolithic 1758-line `run.ps1` into a ~270-line orchestrator that dot-sources 8 module files from `build/ps-modules/`:

| Module | Purpose |
|--------|---------|
| `utils.ps1` | Format-ElapsedTime, Test-Command, Refresh-Path, Install-NodeJS, Install-Pnpm, version parsing, pnpm command helpers |
| `pnpm-config.ps1` | Configure-PnpmStore, Configure-PnpMode, PnP NODE_OPTIONS management |
| `browser.ps1` | Profile detection, Deploy-Extension, Stop-BrowserProcesses, Download-ChromeForTesting |
| `preflight.ps1` | Invoke-PreflightCheck (dynamic import/require scanning) |
| `standalone-build.ps1` | Build-StandaloneScript, Build-AllStandaloneScripts (PARALLEL via Start-Job), Test-StandaloneDistArtifacts |
| `extension-build.ps1` | Install-ExtensionDependencies, Install-RootBuildDependencies, Build-Extension (with manifest validation) |
| `watch.ps1` | Start-WatchMode (FileSystemWatcher with debounce) |
| `help.ps1` | Show-Help |

## Standalone bundle registry — single source of truth

Every standalone script MUST be registered in ALL of the following locations or the build will silently skip it / pass without producing the artifact:

1. `package.json` — dedicated `build:<name>` script + entry in `build:extension` chain (`compile-instruction` step).
2. `scripts/build-standalone.mjs` — `compile-instruction` prereq + `PARALLEL_JOBS` entry + `requiredFiles` preflight (tsconfig + vite.config).
3. `scripts/check-standalone-dist.mjs` — `REQUIRED_ARTIFACTS` map (folder → required dist files including `instruction.json`).
4. `powershell.json` — `standaloneArtifacts.required[]`.
5. `tests/e2e/global-setup.ts` — `buildSteps` array (Playwright pre-extension build).
6. `.github/workflows/ci.yml` — dedicated `build-<name>` job (parallel after `build-sdk`) + listed in `build-extension.needs` + `Download <name> dist` step.
7. `tsconfig.<name>.json` + `vite.config.<name>.ts` exist.

Currently registered: `marco-sdk`, `xpath`, `payment-banner-hider`, `macro-controller`.

## Parallel Standalone Builds

`Build-AllStandaloneScripts` launches each standalone script as a separate PowerShell `Start-Job`, collecting output and reporting results. The Node-based `scripts/build-standalone.mjs` mirrors this with `Promise.all` for non-PowerShell environments (CI, plain `pnpm build:standalone`).

## Console encoding rule

All console output must use ASCII-safe characters only — no Unicode symbols. Use `[OK]`, `[FAIL]`, `[WARN]`, `[INFO]` prefixes instead of checkmarks/crosses.
