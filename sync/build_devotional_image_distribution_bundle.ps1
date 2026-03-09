param(
  [string]$SourceRoot,
  [string]$BundleDir,
  [string]$PublicBaseUrl,
  [string]$ClientTargetRoot,
  [string]$PythonExe = "py",
  [string]$PythonArgs = "-3"
)

$ErrorActionPreference = "Stop"

function Resolve-AbsolutePath([string]$PathText) {
  if ([string]::IsNullOrWhiteSpace($PathText)) { return "" }
  return [System.IO.Path]::GetFullPath($PathText)
}

function Require-Path([string]$PathText, [string]$Label) {
  if (-not (Test-Path $PathText)) {
    throw ("Missing {0}: {1}" -f $Label, $PathText)
  }
}

$repoRoot = Resolve-AbsolutePath (Join-Path $PSScriptRoot "..")
if ([string]::IsNullOrWhiteSpace($SourceRoot)) {
  $SourceRoot = Join-Path $env:USERPROFILE "OneDrive\Pictures\Samsung Gallery\DCIM"
}
if ([string]::IsNullOrWhiteSpace($BundleDir)) {
  $BundleDir = Join-Path $repoRoot "sync"
}
if ([string]::IsNullOrWhiteSpace($PublicBaseUrl)) {
  $PublicBaseUrl = "https://example.com/devotional/DCIM"
}
if ([string]::IsNullOrWhiteSpace($ClientTargetRoot)) {
  $ClientTargetRoot = "C:\Users\Public\Pictures\DevotionalImages"
}

$SourceRoot = Resolve-AbsolutePath $SourceRoot
$BundleDir = Resolve-AbsolutePath $BundleDir

$publicRoot = Join-Path $BundleDir "public\DCIM"
$clientRoot = Join-Path $BundleDir "client"

Require-Path $SourceRoot "source root"
Require-Path (Join-Path $SourceRoot "devotional_image_library.json") "root manifest"
Require-Path (Join-Path $SourceRoot "Current Devotion") "folder 'Current Devotion'"
Require-Path (Join-Path $SourceRoot "Current Devotion Wide") "folder 'Current Devotion Wide'"

if (Test-Path $publicRoot) {
  Remove-Item $publicRoot -Recurse -Force
}
if (Test-Path $clientRoot) {
  Remove-Item $clientRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $publicRoot -Force | Out-Null
New-Item -ItemType Directory -Path $clientRoot -Force | Out-Null

$publicBuilder = Join-Path $PSScriptRoot "build_devotional_public_tree.py"
if (-not (Test-Path $publicBuilder)) {
  throw "Missing public export builder: $publicBuilder"
}

& $PythonExe $PythonArgs $publicBuilder `
  --source-root $SourceRoot `
  --target-root $publicRoot
if ($LASTEXITCODE -ne 0) {
  throw "build_devotional_public_tree.py failed with exit code $LASTEXITCODE"
}

$setupScript = Join-Path $PSScriptRoot "setup_devotional_image_client.ps1"
if (-not (Test-Path $setupScript)) {
  throw "Missing setup script: $setupScript"
}

& powershell -NoProfile -ExecutionPolicy Bypass -File $setupScript `
  -SourceMode http `
  -SourceBaseUrl $PublicBaseUrl `
  -TargetRoot $ClientTargetRoot `
  -BundleDir $clientRoot `
  -PythonExe $PythonExe `
  -PythonArgs $PythonArgs `
  -IncludeManifests true `
  -DeleteMissing false `
  -SkipValidation
if ($LASTEXITCODE -ne 0) {
  throw "setup_devotional_image_client.ps1 failed with exit code $LASTEXITCODE"
}

Write-Host "Saved devotional image distribution bundle:"
Write-Host "  $BundleDir"
Write-Host ""
Write-Host "Public HTTP-ready source folder:"
Write-Host "  $publicRoot"
Write-Host ""
Write-Host "Portable client bundle:"
Write-Host "  $clientRoot"
Write-Host ""
Write-Host "Publish this folder over HTTP:"
Write-Host "  $publicRoot"
