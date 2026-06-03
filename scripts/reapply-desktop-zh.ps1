[CmdletBinding()]
param(
  [string]$SourceRoot = "\\wsl$\Ubuntu-D\home\leoai\.hermes\hermes-agent",
  [string]$InstallRoot = "$env:LOCALAPPDATA\hermes\hermes-agent",
  [switch]$CheckOnly,
  [switch]$SkipBuild,
  [switch]$SkipLaunch
)

$ErrorActionPreference = "Stop"

$relativeFiles = @(
  "apps\desktop\src\app\agents\index.tsx",
  "apps\desktop\src\app\artifacts\index.tsx",
  "apps\desktop\src\app\chat\composer\context-menu.tsx",
  "apps\desktop\src\app\chat\composer\index.tsx",
  "apps\desktop\src\app\chat\index.tsx",
  "apps\desktop\src\app\chat\sidebar\index.tsx",
  "apps\desktop\src\app\chat\sidebar\session-actions-menu.tsx",
  "apps\desktop\src\app\command-center\index.tsx",
  "apps\desktop\src\app\cron\index.tsx",
  "apps\desktop\src\app\messaging\index.tsx",
  "apps\desktop\src\app\profiles\index.tsx",
  "apps\desktop\src\app\right-sidebar\index.tsx",
  "apps\desktop\src\app\settings\about-settings.tsx",
  "apps\desktop\src\app\settings\appearance-settings.tsx",
  "apps\desktop\src\app\settings\config-settings.tsx",
  "apps\desktop\src\app\settings\gateway-settings.tsx",
  "apps\desktop\src\app\settings\index.tsx",
  "apps\desktop\src\app\settings\keys-settings.tsx",
  "apps\desktop\src\app\settings\mcp-settings.tsx",
  "apps\desktop\src\app\settings\model-settings.tsx",
  "apps\desktop\src\app\settings\sessions-settings.tsx",
  "apps\desktop\src\app\shell\gateway-menu-panel.tsx",
  "apps\desktop\src\app\shell\model-menu-panel.tsx",
  "apps\desktop\src\app\shell\titlebar-controls.tsx",
  "apps\desktop\src\app\skills\index.tsx",
  "apps\desktop\src\components\chat\intro.tsx",
  "apps\desktop\src\components\desktop-install-overlay.tsx",
  "apps\desktop\src\components\desktop-onboarding-overlay.tsx",
  "apps\desktop\src\components\model-visibility-dialog.tsx",
  "apps\desktop\src\app\updates-overlay.tsx",
  "apps\desktop\src\i18n\catalog.ts",
  "apps\desktop\src\i18n\index.tsx",
  "apps\desktop\src\main.tsx",
  "apps\desktop\src\store\locale.ts"
)

function Assert-PathExists {
  param(
    [string]$Path,
    [string]$Label
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "$Label not found: $Path"
  }
}

function Copy-PatchedFiles {
  param(
    [string]$FromRoot,
    [string]$ToRoot,
    [string[]]$Files
  )

  foreach ($rel in $Files) {
    $sourcePath = Join-Path $FromRoot $rel
    $targetPath = Join-Path $ToRoot $rel
    $targetDir = Split-Path -Parent $targetPath

    Assert-PathExists -Path $sourcePath -Label "Source file"

    if (-not (Test-Path -LiteralPath $targetDir)) {
      New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }

    Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
    Write-Host "[sync] $rel"
  }
}

function Invoke-NpmStep {
  param(
    [string]$DesktopRoot,
    [string[]]$NpmArgs
  )

  Push-Location $DesktopRoot
  try {
    & npm.cmd @NpmArgs
    if ($LASTEXITCODE -ne 0) {
      throw "npm $($NpmArgs -join ' ') failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

Assert-PathExists -Path $SourceRoot -Label "Source root"
Assert-PathExists -Path $InstallRoot -Label "Install root"

$desktopRoot = Join-Path $InstallRoot "apps\desktop"
$exePath = Join-Path $desktopRoot "release\win-unpacked\Hermes.exe"

Assert-PathExists -Path $desktopRoot -Label "Desktop app root"

Write-Host "SourceRoot : $SourceRoot"
Write-Host "InstallRoot: $InstallRoot"
Write-Host "DesktopRoot: $desktopRoot"
Write-Host "Patched files: $($relativeFiles.Count)"

if ($CheckOnly) {
  foreach ($rel in $relativeFiles) {
    Assert-PathExists -Path (Join-Path $SourceRoot $rel) -Label "Source file"
    Write-Host "[check] ok $rel"
  }

  Write-Host "Check completed."
  exit 0
}

$running = Get-Process Hermes -ErrorAction SilentlyContinue
if ($running) {
  Write-Host "Stopping running Hermes..."
  $running | Stop-Process -Force
  Start-Sleep -Milliseconds 800
}

Copy-PatchedFiles -FromRoot $SourceRoot -ToRoot $InstallRoot -Files $relativeFiles

if (-not $SkipBuild) {
  Write-Host "Running type-check..."
  Invoke-NpmStep -DesktopRoot $desktopRoot -NpmArgs @("run", "type-check")

  Write-Host "Packing desktop app..."
  Invoke-NpmStep -DesktopRoot $desktopRoot -NpmArgs @("run", "pack")
}

if (-not $SkipLaunch) {
  Assert-PathExists -Path $exePath -Label "Hermes executable"
  Write-Host "Launching Hermes..."
  Start-Process -FilePath $exePath
}

Write-Host "Hermes Desktop zh-CN patch reapplied."
