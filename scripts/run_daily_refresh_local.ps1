param(
  [string]$ClientId,
  [string]$ClientSecret,
  [string]$RefreshToken,
  [string]$SpotifyPlaylistName,
  [string]$SpotifyPlaylistId,
  [string]$JobUtcOffset
)

$ErrorActionPreference = "Stop"

if (-not $ClientId) { $ClientId = $env:SPOTIFY_CLIENT_ID }
if (-not $ClientSecret) { $ClientSecret = $env:SPOTIFY_CLIENT_SECRET }
if (-not $RefreshToken) { $RefreshToken = $env:SPOTIFY_REFRESH_TOKEN }
if (-not $SpotifyPlaylistName) { $SpotifyPlaylistName = $env:SPOTIFY_PLAYLIST_NAME }
if (-not $SpotifyPlaylistId) { $SpotifyPlaylistId = $env:SPOTIFY_PLAYLIST_ID }
if (-not $JobUtcOffset) { $JobUtcOffset = $env:JOB_UTC_OFFSET }

if (-not $ClientId) { $ClientId = Read-Host "SPOTIFY_CLIENT_ID" }
if (-not $ClientSecret) { $ClientSecret = Read-Host "SPOTIFY_CLIENT_SECRET" }
if (-not $RefreshToken) { $RefreshToken = Read-Host "SPOTIFY_REFRESH_TOKEN" }

$env:SPOTIFY_CLIENT_ID = $ClientId
$env:SPOTIFY_CLIENT_SECRET = $ClientSecret
$env:SPOTIFY_REFRESH_TOKEN = $RefreshToken

if ($SpotifyPlaylistName) { $env:SPOTIFY_PLAYLIST_NAME = $SpotifyPlaylistName }
if ($SpotifyPlaylistId) { $env:SPOTIFY_PLAYLIST_ID = $SpotifyPlaylistId }
if ($JobUtcOffset) { $env:JOB_UTC_OFFSET = $JobUtcOffset }

Write-Host ""
if ($env:SPOTIFY_PLAYLIST_NAME) {
  Write-Host "Running daily refresh for Spotify playlist definition '$($env:SPOTIFY_PLAYLIST_NAME)'..."
} else {
  Write-Host "Running daily refresh for all Spotify playlist definitions..."
}
python -m jobs.playlist.refresh_playlist
if ($LASTEXITCODE -ne 0) {
  throw "jobs.playlist.refresh_playlist failed"
}

Write-Host ""
Write-Host "Daily refresh local run completed."
