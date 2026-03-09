param(
  [string]$OpenAiApiKey,
  [string]$OneDriveUserId,
  [string]$AzureTenantId,
  [string]$AzureClientId,
  [string]$AzureClientSecret,
  [string]$RemoteRoot,
  [switch]$SkipAzureLogin
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

function Encode-GraphPath([string]$PathText) {
  $parts = $PathText -split "/"
  $encoded = @()
  foreach ($part in $parts) {
    if ([string]::IsNullOrWhiteSpace($part)) { continue }
    $encoded += [System.Uri]::EscapeDataString($part)
  }
  return ($encoded -join "/")
}

function Upload-OneDriveFile([string]$LocalPath, [string]$RemotePath, [string]$AccessToken, [string]$UserId) {
  $encodedPath = Encode-GraphPath $RemotePath
  $uri = "https://graph.microsoft.com/v1.0/users/$UserId/drive/root:/$encodedPath`:/content"
  Invoke-RestMethod `
    -Method Put `
    -Uri $uri `
    -Headers @{ Authorization = "Bearer $AccessToken" } `
    -ContentType "application/octet-stream" `
    -InFile $LocalPath | Out-Null
}

$OpenAiApiKey = Resolve-EnvValue "OPENAI_API_KEY" $OpenAiApiKey
$OneDriveUserId = Resolve-EnvValue "ONEDRIVE_USER_ID" $OneDriveUserId
$AzureTenantId = Resolve-EnvValue "AZURE_TENANT_ID" $AzureTenantId
$AzureClientId = Resolve-EnvValue "AZURE_CLIENT_ID" $AzureClientId
$AzureClientSecret = Resolve-EnvValue "AZURE_CLIENT_SECRET" $AzureClientSecret
$RemoteRoot = Resolve-EnvValue "DEVOTIONAL_ONEDRIVE_REMOTE_ROOT" $RemoteRoot

if ([string]::IsNullOrWhiteSpace($OpenAiApiKey)) { $OpenAiApiKey = Read-Host "OPENAI_API_KEY" }
if ([string]::IsNullOrWhiteSpace($OneDriveUserId)) { $OneDriveUserId = Read-Host "ONEDRIVE_USER_ID (UPN or GUID)" }
if ([string]::IsNullOrWhiteSpace($RemoteRoot)) { $RemoteRoot = "Pictures/Samsung Gallery/DCIM" }

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
  throw "Azure CLI (az) is required. Install Azure CLI and try again."
}

$env:OPENAI_API_KEY = $OpenAiApiKey
$env:ONEDRIVE_USER_ID = $OneDriveUserId
$env:DEVOTIONAL_ONEDRIVE_REMOTE_ROOT = $RemoteRoot

if (-not $SkipAzureLogin) {
  if (
    -not [string]::IsNullOrWhiteSpace($AzureTenantId) -and
    -not [string]::IsNullOrWhiteSpace($AzureClientId) -and
    -not [string]::IsNullOrWhiteSpace($AzureClientSecret)
  ) {
    az login --service-principal --tenant $AzureTenantId --username $AzureClientId --password $AzureClientSecret | Out-Null
  } else {
    try {
      az account show | Out-Null
    } catch {
      az login | Out-Null
    }
  }
}

$runRoot = Join-Path $env:TEMP ("devotional_onedrive_sync_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
$dcimRoot = Join-Path $runRoot "DCIM"
$env:DEVOTIONAL_ONEDRIVE_DCIM_DIR = $dcimRoot

Write-Host "Generating devotional image files in temp folder: $dcimRoot"
py -3 jobs/novena/generate_devotional_image.py
if ($LASTEXITCODE -ne 0) {
  throw "jobs/novena/generate_devotional_image.py failed"
}

$currentFolder = Resolve-Path (Join-Path $dcimRoot "Current Devotion")
$archiveFolder = Resolve-Path (Join-Path $dcimRoot "Non Current Devotion")
$currentWideFolder = Resolve-Path (Join-Path $dcimRoot "Current Devotion Wide")
$archiveWideFolder = Resolve-Path (Join-Path $dcimRoot "Non Current Devotion Wide")
$rootManifest = Join-Path $dcimRoot "devotional_image_library.json"

$accessToken = az account get-access-token --resource-type ms-graph --query accessToken -o tsv
if ([string]::IsNullOrWhiteSpace($accessToken)) {
  throw "Could not acquire Microsoft Graph access token from az."
}

$uploaded = 0
Get-ChildItem -Path $currentFolder -File | ForEach-Object {
  $remotePath = "$RemoteRoot/Current Devotion/$($_.Name)"
  Upload-OneDriveFile -LocalPath $_.FullName -RemotePath $remotePath -AccessToken $accessToken -UserId $OneDriveUserId
  $uploaded++
  Write-Host "Uploaded: $remotePath"
}

Get-ChildItem -Path $archiveFolder -File | ForEach-Object {
  $remotePath = "$RemoteRoot/Non Current Devotion/$($_.Name)"
  Upload-OneDriveFile -LocalPath $_.FullName -RemotePath $remotePath -AccessToken $accessToken -UserId $OneDriveUserId
  $uploaded++
  Write-Host "Uploaded: $remotePath"
}

Get-ChildItem -Path $currentWideFolder -File | ForEach-Object {
  $remotePath = "$RemoteRoot/Current Devotion Wide/$($_.Name)"
  Upload-OneDriveFile -LocalPath $_.FullName -RemotePath $remotePath -AccessToken $accessToken -UserId $OneDriveUserId
  $uploaded++
  Write-Host "Uploaded: $remotePath"
}

Get-ChildItem -Path $archiveWideFolder -File | ForEach-Object {
  $remotePath = "$RemoteRoot/Non Current Devotion Wide/$($_.Name)"
  Upload-OneDriveFile -LocalPath $_.FullName -RemotePath $remotePath -AccessToken $accessToken -UserId $OneDriveUserId
  $uploaded++
  Write-Host "Uploaded: $remotePath"
}

if (Test-Path $rootManifest) {
  $remotePath = "$RemoteRoot/devotional_image_library.json"
  Upload-OneDriveFile -LocalPath $rootManifest -RemotePath $remotePath -AccessToken $accessToken -UserId $OneDriveUserId
  $uploaded++
  Write-Host "Uploaded: $remotePath"
}

Write-Host "Devotional image + OneDrive upload completed. uploaded_files=$uploaded temp_dir=$runRoot"
