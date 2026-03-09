param(
  [ValidateSet("http", "local")]
  [string]$SourceMode,
  [string]$SourceBaseUrl,
  [string]$SourceRoot,
  [string]$TargetRoot,
  [string]$RootManifest = "devotional_image_library.json",
  [object]$IncludeManifests = $null,
  [object]$DeleteMissing = $null,
  [string]$PythonExe = "py",
  [string]$PythonArgs = "-3",
  [string]$BundleDir,
  [string]$ConfigPath,
  [string]$BatchPath,
  [switch]$SkipValidation
)

$ErrorActionPreference = "Stop"

function Read-Required([string]$Prompt, [string]$DefaultValue = "") {
  $fullPrompt = if ([string]::IsNullOrWhiteSpace($DefaultValue)) { $Prompt } else { "$Prompt [$DefaultValue]" }
  $value = Read-Host $fullPrompt
  if ([string]::IsNullOrWhiteSpace($value)) { $value = $DefaultValue }
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing required value: $Prompt"
  }
  return $value.Trim()
}

function Read-YesNo([string]$Prompt, [bool]$DefaultValue) {
  $suffix = if ($DefaultValue) { "[Y/n]" } else { "[y/N]" }
  $raw = Read-Host "$Prompt $suffix"
  if ([string]::IsNullOrWhiteSpace($raw)) { return $DefaultValue }
  $value = $raw.Trim().ToLowerInvariant()
  return $value -in @("y", "yes", "true", "1")
}

function Parse-OptionalBool([object]$Value) {
  if ($null -eq $Value) { return $null }
  if ($Value -is [bool]) { return [bool]$Value }
  $text = [string]$Value
  if ([string]::IsNullOrWhiteSpace($text)) { return $null }
  switch ($text.Trim().ToLowerInvariant()) {
    "1" { return $true }
    "0" { return $false }
    "true" { return $true }
    "false" { return $false }
    "yes" { return $true }
    "no" { return $false }
    "y" { return $true }
    "n" { return $false }
    default { throw "Invalid boolean value: $text" }
  }
}

function Resolve-AbsolutePath([string]$PathText) {
  if ([string]::IsNullOrWhiteSpace($PathText)) { return "" }
  return [System.IO.Path]::GetFullPath($PathText)
}

function Validate-HttpUrl([string]$UrlText) {
  $uri = $null
  if (-not [System.Uri]::TryCreate($UrlText, [System.UriKind]::Absolute, [ref]$uri)) {
    throw "Invalid HTTP URL: $UrlText"
  }
  if ($uri.Scheme -notin @("http", "https")) {
    throw "URL must start with http:// or https://"
  }
}

function Test-HttpManifest([string]$BaseUrl, [string]$ManifestName) {
  $url = $BaseUrl.TrimEnd("/") + "/" + $ManifestName
  try {
    $response = Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing -TimeoutSec 20
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 400
  } catch {
    try {
      $response = Invoke-WebRequest -Uri $url -Method Get -UseBasicParsing -TimeoutSec 20
      return $response.StatusCode -ge 200 -and $response.StatusCode -lt 400
    } catch {
      return $false
    }
  }
}

function Build-ConfigObject(
  [string]$Mode,
  [string]$BaseUrl,
  [string]$Root,
  [string]$Destination,
  [string]$Manifest,
  [bool]$SyncManifests,
  [bool]$PruneMissing
) {
  return [ordered]@{
    source_root = $(if ($Mode -eq "local") { $Root } else { "" })
    source_base_url = $(if ($Mode -eq "http") { $BaseUrl } else { "" })
    target_root = $Destination
    root_manifest = $Manifest
    include_manifests = $SyncManifests
    delete_missing = $PruneMissing
  }
}

$repoRoot = Resolve-AbsolutePath (Join-Path $PSScriptRoot "..")
$syncRoot = Resolve-AbsolutePath (Join-Path $repoRoot "sync")
$scriptPath = Resolve-AbsolutePath (Join-Path $PSScriptRoot "sync_devotional_images_client.py")
New-Item -ItemType Directory -Path $syncRoot -Force | Out-Null

if ([string]::IsNullOrWhiteSpace($SourceMode)) {
  $rawMode = Read-Required "Source mode: http or local" "http"
  $mode = $rawMode.Trim().ToLowerInvariant()
  if ($mode -notin @("http", "local")) {
    throw "Source mode must be 'http' or 'local'."
  }
  $SourceMode = $mode
}

$IncludeManifests = Parse-OptionalBool $IncludeManifests
$DeleteMissing = Parse-OptionalBool $DeleteMissing
if ($null -eq $IncludeManifests) {
  $IncludeManifests = Read-YesNo "Keep local copies of manifest JSON files?" $true
}
if ($null -eq $DeleteMissing) {
  $DeleteMissing = Read-YesNo "Delete local files that no longer exist in the source manifests?" $false
}

if ($SourceMode -eq "http") {
  if ([string]::IsNullOrWhiteSpace($SourceBaseUrl)) {
    $SourceBaseUrl = Read-Required "Public HTTP root URL for the devotional DCIM folder"
  }
  Validate-HttpUrl $SourceBaseUrl
  $SourceRoot = ""
}

if ($SourceMode -eq "local") {
  if ([string]::IsNullOrWhiteSpace($SourceRoot)) {
    $SourceRoot = Read-Required "Local source root containing devotional manifests and files"
  }
  $SourceRoot = Resolve-AbsolutePath $SourceRoot
  if (-not (Test-Path $SourceRoot)) {
    throw "Local source root does not exist: $SourceRoot"
  }
  $SourceBaseUrl = ""
}

if ([string]::IsNullOrWhiteSpace($TargetRoot)) {
  $defaultTarget = Join-Path $env:USERPROFILE "Pictures\DevotionalImages"
  $TargetRoot = Read-Required "Local target root to sync into" $defaultTarget
}
$TargetRoot = Resolve-AbsolutePath $TargetRoot

if ([string]::IsNullOrWhiteSpace($BundleDir)) {
  $BundleDir = Join-Path $syncRoot "client"
}
$BundleDir = Resolve-AbsolutePath $BundleDir

if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
  $ConfigPath = Join-Path $BundleDir "devotional_image_client.json"
}
$ConfigPath = Resolve-AbsolutePath $ConfigPath

if ([string]::IsNullOrWhiteSpace($BatchPath)) {
  $BatchPath = Join-Path $BundleDir "run_devotional_sync.bat"
}
$BatchPath = Resolve-AbsolutePath $BatchPath
$Ps1Path = Resolve-AbsolutePath (Join-Path (Split-Path -Parent $BatchPath) "run_devotional_sync.ps1")
$BundledScriptPath = Resolve-AbsolutePath (Join-Path (Split-Path -Parent $ConfigPath) "sync_devotional_images_client.py")

if ([string]::IsNullOrWhiteSpace($PythonExe)) {
  $PythonExe = Read-Required "Python executable or launcher" "py"
}
if ($null -eq $PythonArgs) {
  $PythonArgs = ""
}

if (-not $SkipValidation) {
  if ($SourceMode -eq "http") {
    $ok = Test-HttpManifest -BaseUrl $SourceBaseUrl -ManifestName $RootManifest
    if (-not $ok) {
      Write-Warning "Could not validate $RootManifest at $SourceBaseUrl. Continuing anyway."
    }
  } else {
    $manifestPath = Join-Path $SourceRoot $RootManifest
    if (-not (Test-Path $manifestPath)) {
      Write-Warning "Root manifest not found yet: $manifestPath"
    }
  }
}

$configDir = Split-Path -Parent $ConfigPath
$batchDir = Split-Path -Parent $BatchPath
New-Item -ItemType Directory -Path $BundleDir -Force | Out-Null
New-Item -ItemType Directory -Path $configDir -Force | Out-Null
New-Item -ItemType Directory -Path $batchDir -Force | Out-Null
New-Item -ItemType Directory -Path $TargetRoot -Force | Out-Null

$config = Build-ConfigObject `
  -Mode $SourceMode `
  -BaseUrl $SourceBaseUrl `
  -Root $SourceRoot `
  -Destination $TargetRoot `
  -Manifest $RootManifest `
  -SyncManifests ([bool]$IncludeManifests) `
  -PruneMissing ([bool]$DeleteMissing)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($ConfigPath, ($config | ConvertTo-Json -Depth 5), $utf8NoBom)
Copy-Item -Path $scriptPath -Destination $BundledScriptPath -Force

$invokeLine = if ([string]::IsNullOrWhiteSpace($PythonArgs)) {
  'call "%PYTHON_EXE%" "%SCRIPT_PATH%" --config "%CONFIG_PATH%"'
} else {
  'call "%PYTHON_EXE%" %PYTHON_ARGS% "%SCRIPT_PATH%" --config "%CONFIG_PATH%"'
}

$batchLines = @(
  "@echo off",
  "setlocal",
  "set ""SCRIPT_DIR=%~dp0""",
  "set ""SCRIPT_PATH=%SCRIPT_DIR%sync_devotional_images_client.py""",
  "set ""CONFIG_PATH=%SCRIPT_DIR%devotional_image_client.json""",
  "set ""PYTHON_EXE=$PythonExe""",
  "set ""PYTHON_ARGS=$PythonArgs""",
  "if not exist ""%SCRIPT_PATH%"" (",
  "  echo Missing script: %SCRIPT_PATH%",
  "  exit /b 1",
  ")",
  "if not exist ""%CONFIG_PATH%"" (",
  "  echo Missing config: %CONFIG_PATH%",
  "  exit /b 1",
  ")",
  $invokeLine,
  "exit /b %ERRORLEVEL%"
)

Set-Content -Path $BatchPath -Value $batchLines -Encoding ascii

$ps1Lines = @(
  '$ErrorActionPreference = "Stop"',
  '$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path',
  '$scriptPath = Join-Path $scriptDir "sync_devotional_images_client.py"',
  '$configPath = Join-Path $scriptDir "devotional_image_client.json"',
  ('$pythonExe = "{0}"' -f $PythonExe.Replace('"', '""')),
  ('$pythonArgs = @({0})' -f $(if ([string]::IsNullOrWhiteSpace($PythonArgs)) { "" } else { ($PythonArgs.Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries) | ForEach-Object { '"' + $_.Replace('"', '""') + '"' }) -join ", " })),
  'if (-not (Test-Path $scriptPath)) { throw "Missing script: $scriptPath" }',
  'if (-not (Test-Path $configPath)) { throw "Missing config: $configPath" }',
  'if ($pythonArgs.Count -gt 0) {',
  '  & $pythonExe @pythonArgs $scriptPath --config $configPath',
  '} else {',
  '  & $pythonExe $scriptPath --config $configPath',
  '}',
  'exit $LASTEXITCODE'
)
[System.IO.File]::WriteAllText($Ps1Path, ($ps1Lines -join [Environment]::NewLine), $utf8NoBom)

Write-Host "Saved devotional image client bundle:"
Write-Host "  $BundleDir"
Write-Host "Bundle contents:"
Write-Host "  $BundledScriptPath"
Write-Host "  $ConfigPath"
Write-Host "  $BatchPath"
Write-Host "  $Ps1Path"
Write-Host ""
Write-Host "Configuration summary:"
Write-Host "  Source mode: $SourceMode"
if ($SourceMode -eq "http") {
  Write-Host "  Source base URL: $SourceBaseUrl"
} else {
  Write-Host "  Source root: $SourceRoot"
}
Write-Host "  Target root: $TargetRoot"
Write-Host "  Root manifest: $RootManifest"
Write-Host "  Include manifests: $IncludeManifests"
Write-Host "  Delete missing: $DeleteMissing"
Write-Host "  Python exe: $PythonExe"
Write-Host "  Python args: $PythonArgs"
Write-Host ""
Write-Host "Run either launcher from the bundle folder:"
Write-Host "  $BatchPath"
Write-Host "  $Ps1Path"
