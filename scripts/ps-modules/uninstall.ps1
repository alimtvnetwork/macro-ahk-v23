<#
.SYNOPSIS
    Uninstall / clean module — removes build artifacts and dependency caches
    so the next run.ps1 invocation produces a fully fresh build.

.DESCRIPTION
    Wipes (best-effort, never throws):
      * powershell.json -> cleanPaths     (e.g. chrome-extension, dist, node_modules, .vite, .pnp.cjs)
      * Extra build caches               (.pnpm, .pnp.loader.mjs, pnpm-lock.yaml, .turbo, .cache)
      * Standalone-scripts dist/ folders (macro-controller, marco-sdk, xpath, payment-banner-hider)
      * Standalone-scripts node_modules  (if present)
      * Generated metadata               (chrome-extension/projects/seed-manifest.json)
      * Test artifacts                   (test-results, playwright-report, test_reports)
      * Tsconfig build info              (*.tsbuildinfo)

    Does NOT touch:
      * Source files, spec/, .lovable/, .release/, .git/, scripts/, build/ps-modules/
      * Chrome/Edge user-data profiles. Users must remove the loaded
        unpacked extension manually from chrome://extensions.

.NOTES
    Required script-scope vars: $script:RootDir, $script:ExtensionDir,
    $script:CleanPaths, $script:ProjectName.
#>

function Remove-PathSafe {
    param([string]$Path, [string]$Label)
    if ([string]::IsNullOrWhiteSpace($Path)) { return $false }
    if (-not (Test-Path $Path)) { return $false }
    try {
        Remove-Item -Recurse -Force -LiteralPath $Path -ErrorAction Stop
        Write-Host "  [removed] $Label" -ForegroundColor DarkGreen
        return $true
    } catch {
        Write-Host "  [skip]    $Label  ($($_.Exception.Message))" -ForegroundColor DarkYellow
        return $false
    }
}

function Remove-GlobInDir {
    param([string]$Dir, [string]$Pattern, [string]$Label)
    if ([string]::IsNullOrWhiteSpace($Dir) -or -not (Test-Path $Dir)) { return 0 }
    $count = 0
    Get-ChildItem -LiteralPath $Dir -Filter $Pattern -File -ErrorAction SilentlyContinue | ForEach-Object {
        if (Remove-PathSafe -Path $_.FullName -Label "$Label -> $($_.Name)") { $count++ }
    }
    return $count
}

<#
.SYNOPSIS
    Run the full uninstall / clean sequence.
.OUTPUTS
    [int] number of paths successfully removed.
#>
function Invoke-Uninstall {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host "  $($script:ProjectName) -- UNINSTALL" -ForegroundColor Magenta
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host ""

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $removed = 0
    $rootDir = if ($script:RootDir) { $script:RootDir } else { (Get-Location).Path }
    $extDir  = if ($script:ExtensionDir) { $script:ExtensionDir } else { $rootDir }

    # 1. Configured cleanPaths (resolved relative to extension dir)
    Write-Host "[1/5] Removing configured cleanPaths..." -ForegroundColor Yellow
    $configuredPaths = @()
    if ($script:CleanPaths) { $configuredPaths += $script:CleanPaths }
    $configuredPaths = $configuredPaths | Select-Object -Unique
    Push-Location $extDir
    try {
        foreach ($cp in $configuredPaths) {
            if (Remove-PathSafe -Path $cp -Label "$extDir\$cp") { $removed++ }
        }
    } finally { Pop-Location }

    # 2. Extra extension-side caches
    Write-Host "[2/5] Removing extra build caches..." -ForegroundColor Yellow
    $extraCaches = @(".pnpm", ".pnp.loader.mjs", "pnpm-lock.yaml", ".turbo", ".cache", ".eslintcache")
    Push-Location $extDir
    try {
        foreach ($cp in $extraCaches) {
            if (Remove-PathSafe -Path $cp -Label "$extDir\$cp") { $removed++ }
        }
    } finally { Pop-Location }

    # 3. Standalone scripts dist + node_modules
    Write-Host "[3/5] Removing standalone-scripts artifacts..." -ForegroundColor Yellow
    $standaloneRoot = Join-Path $rootDir "standalone-scripts"
    if (Test-Path $standaloneRoot) {
        $packages = Get-ChildItem -Path $standaloneRoot -Directory -ErrorAction SilentlyContinue
        foreach ($pkg in $packages) {
            foreach ($sub in @("dist", "node_modules", ".turbo", ".cache")) {
                $target = Join-Path $pkg.FullName $sub
                if (Remove-PathSafe -Path $target -Label "standalone-scripts\$($pkg.Name)\$sub") { $removed++ }
            }
        }
        # Also nuke generated/ aggregate folder if present
        $generated = Join-Path $standaloneRoot "_generated"
        if (Test-Path $generated) {
            if (Remove-PathSafe -Path $generated -Label "standalone-scripts\_generated") { $removed++ }
        }
    } else {
        Write-Host "  [skip]    no standalone-scripts/ folder" -ForegroundColor DarkGray
    }

    # 4. Generated metadata + test artifacts
    Write-Host "[4/5] Removing generated metadata + test artifacts..." -ForegroundColor Yellow
    $auxPaths = @(
        (Join-Path $rootDir "chrome-extension\projects\seed-manifest.json"),
        (Join-Path $rootDir "test-results"),
        (Join-Path $rootDir "playwright-report"),
        (Join-Path $rootDir "test_reports"),
        (Join-Path $rootDir "coverage")
    )
    foreach ($p in $auxPaths) {
        if (Remove-PathSafe -Path $p -Label $p) { $removed++ }
    }
    # tsbuildinfo files at root
    $removed += (Remove-GlobInDir -Dir $rootDir -Pattern "*.tsbuildinfo" -Label "tsbuildinfo")

    # 5. Notice about the deployed Chrome extension
    Write-Host "[5/5] Browser-side cleanup notice..." -ForegroundColor Yellow
    Write-Host "  [info]    Open chrome://extensions and remove any unpacked Marco copy manually." -ForegroundColor Cyan
    Write-Host "  [info]    Profiles + bookmarks are NOT touched by this script." -ForegroundColor Cyan

    $sw.Stop()
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host "  Uninstall complete -- $removed path(s) removed in $(Format-ElapsedTime $sw)" -ForegroundColor Magenta
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host ""
    return $removed
}
