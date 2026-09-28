param(
  [ValidateSet("generate", "rotate-only", "dry-run-rotation", "resolve-only", "preview")]
  [string]$Mode = "generate",
  [string]$RcloneExe
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
  throw "Python launcher 'py' was not found. Install Python 3.11 or newer."
}
if ($RcloneExe) { $env:RCLONE_EXE = $RcloneExe }

$arguments = @("jobs/novena/generate_devotional_wallpapers.py")
switch ($Mode) {
  "rotate-only" { $arguments += "--rotate-only" }
  "dry-run-rotation" { $arguments += "--dry-run-rotation" }
  "resolve-only" { $arguments += "--resolve-only" }
  "preview" { $arguments += "--skip-delivery" }
}
py -3 @arguments
if ($LASTEXITCODE -ne 0) { throw "Devotional wallpaper pipeline failed with exit code $LASTEXITCODE" }
