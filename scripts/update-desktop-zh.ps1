[CmdletBinding()]
param(
  [string]$SourceRoot,
  [string]$InstallRoot = "$env:LOCALAPPDATA\\hermes\\hermes-agent",
  [switch]$SkipLaunch
)

$ErrorActionPreference = "Stop"

if (-not $SourceRoot) {
  $SourceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Assert-PathExists {
  param(
    [string]$Path,
    [string]$Label
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "$Label not found: $Path"
  }
}

Assert-PathExists -Path $SourceRoot -Label "Source root"
Assert-PathExists -Path $InstallRoot -Label "Install root"

$reapplyScript = Join-Path $SourceRoot "scripts\\reapply-desktop-zh.ps1"
Assert-PathExists -Path $reapplyScript -Label "Reapply script"

Write-Host "SourceRoot : $SourceRoot"
Write-Host "InstallRoot: $InstallRoot"
Write-Host "Reapply    : $reapplyScript"

$running = Get-Process Hermes -ErrorAction SilentlyContinue
if ($running) {
  Write-Host "Stopping running Hermes..."
  $running | Stop-Process -Force
  Start-Sleep -Milliseconds 800
}

Push-Location $InstallRoot
try {
  Write-Host "Stashing local desktop changes..."
  & git stash push --include-untracked -m "desktop-zh-auto-$(Get-Date -Format 'yyyyMMdd-HHmmss')" | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "git stash failed with exit code $LASTEXITCODE"
  }

  Write-Host "Pulling latest upstream..."
  & git pull --ff-only | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "git pull --ff-only failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}

$reapplyArgs = @(
  "-ExecutionPolicy", "Bypass",
  "-File", $reapplyScript,
  "-SourceRoot", $SourceRoot,
  "-InstallRoot", $InstallRoot
)

if ($SkipLaunch) {
  $reapplyArgs += "-SkipLaunch"
}

Write-Host "Reapplying zh-CN desktop patch..."
& powershell.exe @reapplyArgs
if ($LASTEXITCODE -ne 0) {
  throw "reapply-desktop-zh.ps1 failed with exit code $LASTEXITCODE"
}

Write-Host "Hermes Desktop updated and zh-CN patch reapplied."
