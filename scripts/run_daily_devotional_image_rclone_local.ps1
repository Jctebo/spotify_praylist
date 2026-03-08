param(
  [string]$OpenAiApiKey,
  [string]$RcloneRemoteName,
  [string]$RcloneRemoteRoot,
  [string]$RcloneExe,
  [switch]$SkipGenerate
)

$ErrorActionPreference = "Stop"

function Resolve-EnvValue([string]$Name, [string]$CurrentValue) {
  if (-not [string]::IsNullOrWhiteSpace($CurrentValue)) { return $CurrentValue }
  $processValue = [Environment]::GetEnvironmentVariable($Name, "Process")
  if (-not [string]::IsNullOrWhiteSpace($processValue)) { return $processValue }
  $userValue = [Environment]::GetEnvironmentVariable($Name, "User")
  if (-not [string]::IsNullOrWhiteSpace($userValue)) { return $userValue }
  return ""
}

function Resolve-RcloneExe([string]$Hint) {
  if (-not [string]::IsNullOrWhiteSpace($Hint) -and (Test-Path $Hint)) { return $Hint }
  $cmd = Get-Command rclone -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidates = @(
    "$env:LOCALAPPDATA\Microsoft\WinGet\Links\rclone.exe",
    "$env:ProgramFiles\rclone\rclone.exe",
    "$env:ProgramFiles(x86)\rclone\rclone.exe",
    "$env:LOCALAPPDATA\Programs\rclone\rclone.exe"
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) { return $c }
  }
  $wingetPackagesRoot = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages"
  if (Test-Path $wingetPackagesRoot) {
    $found = Get-ChildItem -Path $wingetPackagesRoot -Recurse -Filter "rclone.exe" -ErrorAction SilentlyContinue |
      Select-Object -First 1 -ExpandProperty FullName
    if (-not [string]::IsNullOrWhiteSpace($found) -and (Test-Path $found)) { return $found }
  }
  return ""
}

$OpenAiApiKey = Resolve-EnvValue "OPENAI_API_KEY" $OpenAiApiKey
$RcloneRemoteName = Resolve-EnvValue "RCLONE_REMOTE_NAME" $RcloneRemoteName
$RcloneRemoteRoot = Resolve-EnvValue "RCLONE_REMOTE_ROOT" $RcloneRemoteRoot

if ([string]::IsNullOrWhiteSpace($OpenAiApiKey) -and -not $SkipGenerate) { $OpenAiApiKey = Read-Host "OPENAI_API_KEY" }
if ([string]::IsNullOrWhiteSpace($RcloneRemoteName)) { $RcloneRemoteName = "onedrive" }
if ([string]::IsNullOrWhiteSpace($RcloneRemoteRoot)) { $RcloneRemoteRoot = "Pictures/Samsung Gallery/DCIM" }

$rclonePath = Resolve-RcloneExe $RcloneExe
if ([string]::IsNullOrWhiteSpace($rclonePath)) {
  throw "rclone executable not found. Install rclone or pass -RcloneExe."
}

$dcimRoot = Join-Path $env:USERPROFILE "OneDrive\Pictures\Samsung Gallery\DCIM"
$currentDir = Join-Path $dcimRoot "Current Devotion"
$wideDir = Join-Path $dcimRoot "Devotion Wide"

if (-not $SkipGenerate) {
  $env:OPENAI_API_KEY = $OpenAiApiKey
  Write-Host "Generating devotional image locally..."
  py -3 jobs/novena/generate_devotional_image.py
  if ($LASTEXITCODE -ne 0) {
    throw "jobs/novena/generate_devotional_image.py failed"
  }
}

if (-not (Test-Path $currentDir)) { throw "Missing folder: $currentDir" }
if (-not (Test-Path $wideDir)) { throw "Missing folder: $wideDir" }

Write-Host "Uploading Current Devotion via rclone..."
& $rclonePath copy "$currentDir/" "${RcloneRemoteName}:${RcloneRemoteRoot}/Current Devotion/" --progress --transfers 4 --checkers 8
if ($LASTEXITCODE -ne 0) { throw "rclone copy failed for Current Devotion" }

Write-Host "Uploading Devotion Wide via rclone..."
& $rclonePath copy "$wideDir/" "${RcloneRemoteName}:${RcloneRemoteRoot}/Devotion Wide/" --progress --transfers 4 --checkers 8
if ($LASTEXITCODE -ne 0) { throw "rclone copy failed for Devotion Wide" }

Write-Host "Devotional image local run + rclone upload completed."
