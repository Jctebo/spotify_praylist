param(
  [string]$OneDriveUserId,
  [string]$AzureTenantId,
  [string]$AzureClientId,
  [string]$AzureClientSecret,
  [string]$RemoteRoot
)

$ErrorActionPreference = "Stop"

function Read-Required([string]$Prompt) {
  $value = Read-Host $Prompt
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing required value: $Prompt"
  }
  return $value
}

function Mask-Secret([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return "" }
  if ($Value.Length -le 8) { return "********" }
  return ($Value.Substring(0, 4) + "..." + $Value.Substring($Value.Length - 4))
}

if (-not $OneDriveUserId) { $OneDriveUserId = [Environment]::GetEnvironmentVariable("ONEDRIVE_USER_ID", "User") }
if (-not $AzureTenantId) { $AzureTenantId = [Environment]::GetEnvironmentVariable("AZURE_TENANT_ID", "User") }
if (-not $AzureClientId) { $AzureClientId = [Environment]::GetEnvironmentVariable("AZURE_CLIENT_ID", "User") }
if (-not $AzureClientSecret) { $AzureClientSecret = [Environment]::GetEnvironmentVariable("AZURE_CLIENT_SECRET", "User") }
if (-not $RemoteRoot) { $RemoteRoot = [Environment]::GetEnvironmentVariable("DEVOTIONAL_ONEDRIVE_REMOTE_ROOT", "User") }

if (-not $OneDriveUserId) { $OneDriveUserId = Read-Required "ONEDRIVE_USER_ID (UPN or GUID)" }
if (-not $AzureTenantId) { $AzureTenantId = Read-Required "AZURE_TENANT_ID" }
if (-not $AzureClientId) { $AzureClientId = Read-Required "AZURE_CLIENT_ID" }
if (-not $AzureClientSecret) { $AzureClientSecret = Read-Required "AZURE_CLIENT_SECRET" }
if (-not $RemoteRoot) { $RemoteRoot = "Pictures/Samsung Gallery/DCIM" }

[Environment]::SetEnvironmentVariable("ONEDRIVE_USER_ID", $OneDriveUserId, "User")
[Environment]::SetEnvironmentVariable("AZURE_TENANT_ID", $AzureTenantId, "User")
[Environment]::SetEnvironmentVariable("AZURE_CLIENT_ID", $AzureClientId, "User")
[Environment]::SetEnvironmentVariable("AZURE_CLIENT_SECRET", $AzureClientSecret, "User")
[Environment]::SetEnvironmentVariable("DEVOTIONAL_ONEDRIVE_REMOTE_ROOT", $RemoteRoot, "User")

Write-Host "Saved local OneDrive/Azure settings (User env):"
Write-Host "ONEDRIVE_USER_ID: $OneDriveUserId"
Write-Host "AZURE_TENANT_ID: $(Mask-Secret $AzureTenantId)"
Write-Host "AZURE_CLIENT_ID: $(Mask-Secret $AzureClientId)"
Write-Host "AZURE_CLIENT_SECRET: $(Mask-Secret $AzureClientSecret)"
Write-Host "DEVOTIONAL_ONEDRIVE_REMOTE_ROOT: $RemoteRoot"

Write-Host ""
Write-Host "Next step:"
Write-Host ".\\scripts\\run_daily_devotional_image_onedrive_local.ps1"
