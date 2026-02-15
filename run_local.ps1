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

$matrix = @(
  @{ profile = "morning"; playlist_id = "0sy9eBsySKuCppI0PxXRJN" },
  @{ profile = "midday";  playlist_id = "4gQAaPAMiezBaDaoqK6sFQ" },
  @{ profile = "night";   playlist_id = "1TAlNiKHMc41cT0fvkYxTD" }
)

foreach ($job in $matrix) {
  $env:SPOTIFY_PLAYLIST_PROFILE = $job.profile
  $env:SPOTIFY_PLAYLIST_ID = $job.playlist_id

  Write-Host ""
  Write-Host "Running profile=$($job.profile) playlist_id=$($job.playlist_id)"
  python refresh_playlist.py

  if ($LASTEXITCODE -ne 0) {
    throw "refresh_playlist.py failed for profile '$($job.profile)'"
  }
}

Write-Host ""
Write-Host "All local playlist refresh runs completed successfully."
