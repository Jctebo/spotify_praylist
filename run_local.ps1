param(
  [string]$ClientId,
  [string]$ClientSecret,
  [string]$RefreshToken
)

$ErrorActionPreference = "Stop"

if (-not $ClientId) { $ClientId = $env:SPOTIFY_CLIENT_ID }
if (-not $ClientSecret) { $ClientSecret = $env:SPOTIFY_CLIENT_SECRET }
if (-not $RefreshToken) { $RefreshToken = $env:SPOTIFY_REFRESH_TOKEN }

if (-not $ClientId) { $ClientId = Read-Host "SPOTIFY_CLIENT_ID" }
if (-not $ClientSecret) { $ClientSecret = Read-Host "SPOTIFY_CLIENT_SECRET" }
if (-not $RefreshToken) { $RefreshToken = Read-Host "SPOTIFY_REFRESH_TOKEN" }

$env:SPOTIFY_CLIENT_ID = $ClientId
$env:SPOTIFY_CLIENT_SECRET = $ClientSecret
$env:SPOTIFY_REFRESH_TOKEN = $RefreshToken

$configPath = "playlist_config.json"
if (-not (Test-Path -Path $configPath)) {
  throw "Missing config file: $configPath"
}
$config = Get-Content -Raw -Path $configPath | ConvertFrom-Json
$matrix = @()
foreach ($prop in $config.profiles.PSObject.Properties) {
  $profileName = [string]$prop.Name
  $playlistId = [string]$prop.Value.playlist_id
  if (-not [string]::IsNullOrWhiteSpace($playlistId)) {
    $matrix += @{ profile = $profileName; playlist_id = $playlistId }
  }
}
if ($matrix.Count -eq 0) {
  throw "No profiles with playlist_id found in $configPath"
}

foreach ($job in $matrix) {
  $env:SPOTIFY_PLAYLIST_PROFILE = [string]$job.profile
  $env:SPOTIFY_PLAYLIST_ID = [string]$job.playlist_id
  $env:SPOTIFY_CONFIG_FILE = $configPath

  Write-Host ""
  Write-Host "Running profile=$($job.profile) playlist_id=$($job.playlist_id)"
  python refresh_playlist.py

  if ($LASTEXITCODE -ne 0) {
    throw "refresh_playlist.py failed for profile '$($job.profile)'"
  }
}

Write-Host ""
Write-Host "All local playlist refresh runs completed successfully."
