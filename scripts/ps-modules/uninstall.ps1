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

    After completion, writes <RootDir>\uninstall-report.json containing one entry
    per attempted path with its phase, label, absolute path, status
    ("removed" | "missing" | "error"), recovered size in bytes, and any error
    message captured.

    Does NOT touch:
      * Source files, spec/, .lovable/, .release/, .git/, scripts/, build/ps-modules/
      * Chrome/Edge user-data profiles. Users must remove the loaded
        unpacked extension manually from chrome://extensions.

.NOTES
    Required script-scope vars: $script:RootDir, $script:ExtensionDir,
    $script:CleanPaths, $script:ProjectName.
#>

# Module-scope collector for the JSON report. Reset at the start of each
# Invoke-Uninstall call so re-runs do not accumulate stale entries.
$script:UninstallReportEntries = New-Object System.Collections.Generic.List[object]

function Get-PathSizeBytes {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path)) { return 0 }
    try {
        $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
        if ($item.PSIsContainer) {
            $sum = (Get-ChildItem -LiteralPath $Path -Recurse -Force -File -ErrorAction SilentlyContinue |
                    Measure-Object -Property Length -Sum).Sum
            if ($null -eq $sum) { return 0 } else { return [int64]$sum }
        }
        return [int64]$item.Length
    } catch { return 0 }
}

function Add-UninstallReportEntry {
    param(
        [string]$Phase,
        [string]$Label,
        [string]$Path,
        [string]$Status,            # removed | missing | error
        [int64]$SizeBytes = 0,
        [string]$ErrorMessage = $null
    )
    $resolved = $Path
    try { if ($Path) { $resolved = [System.IO.Path]::GetFullPath($Path) } } catch { $resolved = $Path }
    $script:UninstallReportEntries.Add([pscustomobject]@{
        phase        = $Phase
        label        = $Label
        path         = $resolved
        status       = $Status
        sizeBytes    = $SizeBytes
        errorMessage = $ErrorMessage
        timestamp    = (Get-Date).ToString("o")
    }) | Out-Null
}

function Remove-PathSafe {
    param(
        [string]$Path,
        [string]$Label,
        [string]$Phase = "unknown"
    )
    if ([string]::IsNullOrWhiteSpace($Path)) {
        Add-UninstallReportEntry -Phase $Phase -Label $Label -Path $Path -Status "missing"
        return $false
    }
    if (-not (Test-Path -LiteralPath $Path)) {
        Add-UninstallReportEntry -Phase $Phase -Label $Label -Path $Path -Status "missing"
        return $false
    }
    $size = Get-PathSizeBytes -Path $Path
    try {
        Remove-Item -Recurse -Force -LiteralPath $Path -ErrorAction Stop
        Write-Host "  [removed] $Label" -ForegroundColor DarkGreen
        Add-UninstallReportEntry -Phase $Phase -Label $Label -Path $Path -Status "removed" -SizeBytes $size
        return $true
    } catch {
        $msg = $_.Exception.Message
        Write-Host "  [skip]    $Label  ($msg)" -ForegroundColor DarkYellow
        Add-UninstallReportEntry -Phase $Phase -Label $Label -Path $Path -Status "error" -SizeBytes $size -ErrorMessage $msg
        return $false
    }
}

function Remove-GlobInDir {
    param(
        [string]$Dir,
        [string]$Pattern,
        [string]$Label,
        [string]$Phase = "unknown"
    )
    if ([string]::IsNullOrWhiteSpace($Dir) -or -not (Test-Path -LiteralPath $Dir)) { return 0 }
    $count = 0
    Get-ChildItem -LiteralPath $Dir -Filter $Pattern -File -ErrorAction SilentlyContinue | ForEach-Object {
        if (Remove-PathSafe -Path $_.FullName -Label "$Label -> $($_.Name)" -Phase $Phase) { $count++ }
    }
    return $count
}

function Write-UninstallReport {
    param(
        [string]$RootDir,
        [System.Diagnostics.Stopwatch]$Stopwatch,
        [int]$RemovedCount
    )
    $reportPath = Join-Path $RootDir "uninstall-report.json"
    $entries = @($script:UninstallReportEntries)

    $byStatus = @{ removed = 0; missing = 0; error = 0 }
    $totalBytes = [int64]0
    foreach ($e in $entries) {
        if ($byStatus.ContainsKey($e.status)) { $byStatus[$e.status]++ } else { $byStatus[$e.status] = 1 }
        $totalBytes += [int64]$e.sizeBytes
    }

    $report = [pscustomobject]@{
        schemaVersion   = 1
        project         = $script:ProjectName
        generatedAt     = (Get-Date).ToString("o")
        rootDir         = $RootDir
        extensionDir    = $script:ExtensionDir
        durationMs      = if ($Stopwatch) { [int64]$Stopwatch.ElapsedMilliseconds } else { 0 }
        totalAttempted  = $entries.Count
        totalRemoved    = $RemovedCount
        totalMissing    = $byStatus["missing"]
        totalErrors     = $byStatus["error"]
        bytesReclaimed  = $totalBytes
        entries         = $entries
    }

    try {
        $json = $report | ConvertTo-Json -Depth 6
        Set-Content -LiteralPath $reportPath -Value $json -Encoding UTF8 -ErrorAction Stop
        Write-Host "  [report]  uninstall-report.json -> $reportPath" -ForegroundColor Cyan
        Write-Host "            removed=$($report.totalRemoved)  missing=$($report.totalMissing)  errors=$($report.totalErrors)  bytes=$totalBytes" -ForegroundColor DarkCyan
    } catch {
        Write-Host "  [WARN]    Failed to write uninstall-report.json: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

<#
.SYNOPSIS
    Run the full uninstall / clean sequence.
.OUTPUTS
    [int] number of paths successfully removed.
.NOTES
    Side effect: writes <RootDir>\uninstall-report.json with a structured
    entry per attempted path (status: removed | missing | error).
#>
function Invoke-Uninstall {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host "  $($script:ProjectName) -- UNINSTALL" -ForegroundColor Magenta
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host ""

    # Reset collector for this run.
    $script:UninstallReportEntries = New-Object System.Collections.Generic.List[object]

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
            $abs = Join-Path $extDir $cp
            if (Remove-PathSafe -Path $abs -Label "$extDir\$cp" -Phase "cleanPaths") { $removed++ }
        }
    } finally { Pop-Location }

    # 2. Extra extension-side caches
    Write-Host "[2/5] Removing extra build caches..." -ForegroundColor Yellow
    $extraCaches = @(".pnpm", ".pnp.loader.mjs", "pnpm-lock.yaml", ".turbo", ".cache", ".eslintcache")
    Push-Location $extDir
    try {
        foreach ($cp in $extraCaches) {
            $abs = Join-Path $extDir $cp
            if (Remove-PathSafe -Path $abs -Label "$extDir\$cp" -Phase "buildCaches") { $removed++ }
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
                if (Remove-PathSafe -Path $target -Label "standalone-scripts\$($pkg.Name)\$sub" -Phase "standaloneScripts") { $removed++ }
            }
        }
        $generated = Join-Path $standaloneRoot "_generated"
        if (Test-Path $generated) {
            if (Remove-PathSafe -Path $generated -Label "standalone-scripts\_generated" -Phase "standaloneScripts") { $removed++ }
        }
    } else {
        Write-Host "  [skip]    no standalone-scripts/ folder" -ForegroundColor DarkGray
        Add-UninstallReportEntry -Phase "standaloneScripts" -Label "standalone-scripts/" -Path $standaloneRoot -Status "missing"
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
        if (Remove-PathSafe -Path $p -Label $p -Phase "auxArtifacts") { $removed++ }
    }
    $removed += (Remove-GlobInDir -Dir $rootDir -Pattern "*.tsbuildinfo" -Label "tsbuildinfo" -Phase "auxArtifacts")

    # 5. Notice about the deployed Chrome extension
    Write-Host "[5/5] Browser-side cleanup notice..." -ForegroundColor Yellow
    Write-Host "  [info]    Open chrome://extensions and remove any unpacked Marco copy manually." -ForegroundColor Cyan
    Write-Host "  [info]    Profiles + bookmarks are NOT touched by this script." -ForegroundColor Cyan

    $sw.Stop()

    # Emit the JSON report before printing the final banner.
    Write-UninstallReport -RootDir $rootDir -Stopwatch $sw -RemovedCount $removed

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host "  Uninstall complete -- $removed path(s) removed in $(Format-ElapsedTime $sw)" -ForegroundColor Magenta
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host ""
    return $removed
}
