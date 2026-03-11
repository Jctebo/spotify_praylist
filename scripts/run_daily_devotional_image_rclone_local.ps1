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
$archiveDir = Join-Path $dcimRoot "Non Current Devotion"
$currentWideDir = Join-Path $dcimRoot "Current Devotion Wide"
$archiveWideDir = Join-Path $dcimRoot "Non Current Devotion Wide"
$metadataArchiveDir = Join-Path $dcimRoot "Devotional Metadata Archive"
$rootManifest = Join-Path $dcimRoot "devotional_image_library.json"

if (-not $SkipGenerate) {
  $env:OPENAI_API_KEY = $OpenAiApiKey
  Write-Host "Generating devotional image locally..."
  py -3 jobs/novena/generate_devotional_image.py
  if ($LASTEXITCODE -ne 0) {
    throw "jobs/novena/generate_devotional_image.py failed"
  }
}

if (-not (Test-Path $currentDir)) { throw "Missing folder: $currentDir" }
if (-not (Test-Path $archiveDir)) { throw "Missing folder: $archiveDir" }
if (-not (Test-Path $currentWideDir)) { throw "Missing folder: $currentWideDir" }
if (-not (Test-Path $archiveWideDir)) { throw "Missing folder: $archiveWideDir" }
if (-not (Test-Path $metadataArchiveDir)) { throw "Missing folder: $metadataArchiveDir" }

Write-Host "Syncing Current Devotion via rclone..."
& $rclonePath sync "$currentDir/" "${RcloneRemoteName}:${RcloneRemoteRoot}/Current Devotion/" --progress --transfers 4 --checkers 8
if ($LASTEXITCODE -ne 0) { throw "rclone sync failed for Current Devotion" }

Write-Host "Syncing Non Current Devotion via rclone..."
& $rclonePath sync "$archiveDir/" "${RcloneRemoteName}:${RcloneRemoteRoot}/Non Current Devotion/" --progress --transfers 4 --checkers 8
if ($LASTEXITCODE -ne 0) { throw "rclone sync failed for Non Current Devotion" }

Write-Host "Syncing Current Devotion Wide via rclone..."
& $rclonePath sync "$currentWideDir/" "${RcloneRemoteName}:${RcloneRemoteRoot}/Current Devotion Wide/" --progress --transfers 4 --checkers 8
if ($LASTEXITCODE -ne 0) { throw "rclone sync failed for Current Devotion Wide" }

Write-Host "Syncing Non Current Devotion Wide via rclone..."
& $rclonePath sync "$archiveWideDir/" "${RcloneRemoteName}:${RcloneRemoteRoot}/Non Current Devotion Wide/" --progress --transfers 4 --checkers 8
if ($LASTEXITCODE -ne 0) { throw "rclone sync failed for Non Current Devotion Wide" }

Write-Host "Syncing Devotional Metadata Archive via rclone..."
& $rclonePath sync "$metadataArchiveDir/" "${RcloneRemoteName}:${RcloneRemoteRoot}/Devotional Metadata Archive/" --progress --transfers 4 --checkers 8
if ($LASTEXITCODE -ne 0) { throw "rclone sync failed for Devotional Metadata Archive" }

if (Test-Path $rootManifest) {
  Write-Host "Uploading devotional_image_library.json via rclone..."
  & $rclonePath copyto "$rootManifest" "${RcloneRemoteName}:${RcloneRemoteRoot}/devotional_image_library.json" --progress
  if ($LASTEXITCODE -ne 0) { throw "rclone copyto failed for devotional_image_library.json" }
}

Write-Host "Devotional image local run + rclone sync completed."
