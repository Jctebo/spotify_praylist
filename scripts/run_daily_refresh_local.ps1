param(
  [string]$ClientId,
  [string]$ClientSecret,
  [string]$RefreshToken,
  [string]$NotionToken,
  [string]$NotionDatabaseId,
  [string]$NotionDatabaseName,
  [string]$NotionTitleProperty,
  [string]$NotionPlatformProperty,
  [string]$NotionPlatformSpotifyValue,
  [string]$NotionUriProperty,
  [string]$JobUtcOffset
)

$ErrorActionPreference = "Stop"

if (-not $ClientId) { $ClientId = $env:SPOTIFY_CLIENT_ID }
if (-not $ClientSecret) { $ClientSecret = $env:SPOTIFY_CLIENT_SECRET }
if (-not $RefreshToken) { $RefreshToken = $env:SPOTIFY_REFRESH_TOKEN }
if (-not $NotionToken) { $NotionToken = $env:NOTION_TOKEN }
if (-not $NotionDatabaseId) { $NotionDatabaseId = $env:NOTION_DATABASE_ID }
if (-not $NotionDatabaseName) { $NotionDatabaseName = $env:NOTION_DATABASE_NAME }
if (-not $NotionTitleProperty) { $NotionTitleProperty = $env:NOTION_TITLE_PROPERTY }
if (-not $NotionPlatformProperty) { $NotionPlatformProperty = $env:NOTION_PLATFORM_PROPERTY }
if (-not $NotionPlatformSpotifyValue) { $NotionPlatformSpotifyValue = $env:NOTION_PLATFORM_SPOTIFY_VALUE }
if (-not $NotionUriProperty) { $NotionUriProperty = $env:NOTION_URI_PROPERTY }
if (-not $JobUtcOffset) { $JobUtcOffset = $env:JOB_UTC_OFFSET }

if (-not $ClientId) { $ClientId = Read-Host "SPOTIFY_CLIENT_ID" }
if (-not $ClientSecret) { $ClientSecret = Read-Host "SPOTIFY_CLIENT_SECRET" }
if (-not $RefreshToken) { $RefreshToken = Read-Host "SPOTIFY_REFRESH_TOKEN" }

$env:SPOTIFY_CLIENT_ID = $ClientId
$env:SPOTIFY_CLIENT_SECRET = $ClientSecret
$env:SPOTIFY_REFRESH_TOKEN = $RefreshToken
$env:SPOTIFY_REFRESH_CONFIG_SOURCE = "notion"
$env:SPOTIFY_ENABLE_URI_AUTOSYNC = "false"

if ($NotionToken) { $env:NOTION_TOKEN = $NotionToken }
if ($NotionDatabaseId) { $env:NOTION_DATABASE_ID = $NotionDatabaseId }
if ($NotionDatabaseName) { $env:NOTION_DATABASE_NAME = $NotionDatabaseName }
if ($NotionTitleProperty) { $env:NOTION_TITLE_PROPERTY = $NotionTitleProperty }
if ($NotionPlatformProperty) { $env:NOTION_PLATFORM_PROPERTY = $NotionPlatformProperty }
if ($NotionPlatformSpotifyValue) { $env:NOTION_PLATFORM_SPOTIFY_VALUE = $NotionPlatformSpotifyValue }
if ($NotionUriProperty) { $env:NOTION_URI_PROPERTY = $NotionUriProperty }
if ($JobUtcOffset) { $env:JOB_UTC_OFFSET = $JobUtcOffset }

if (-not $env:NOTION_TOKEN -or -not $env:NOTION_DATABASE_ID) {
  Write-Host "WARNING: NOTION_TOKEN and/or NOTION_DATABASE_ID not set. Notion URI sync will be skipped." -ForegroundColor Yellow
}

$jobs = @(
  @{ profile = "morning"; env_name = "SPOTIFY_PLAYLIST_ID_MORNING" },
  @{ profile = "midday"; env_name = "SPOTIFY_PLAYLIST_ID_MIDDAY" },
  @{ profile = "night"; env_name = "SPOTIFY_PLAYLIST_ID_NIGHT" }
)

foreach ($job in $jobs) {
  $playlistId = [Environment]::GetEnvironmentVariable([string]$job.env_name, "Process")
  if ([string]::IsNullOrWhiteSpace($playlistId)) {
    $playlistId = [Environment]::GetEnvironmentVariable([string]$job.env_name, "User")
  }
  if ([string]::IsNullOrWhiteSpace($playlistId)) {
    Write-Host "Skipping profile=$($job.profile). Missing env $($job.env_name)." -ForegroundColor Yellow
    continue
  }
  $env:SPOTIFY_PLAYLIST_PROFILE = [string]$job.profile
  $env:SPOTIFY_PLAYLIST_ID = [string]$playlistId

  Write-Host ""
  Write-Host "Running daily refresh profile=$($job.profile) playlist_id=$($playlistId)"
  py -3 jobs/playlist/refresh_playlist.py
  if ($LASTEXITCODE -ne 0) {
    throw "jobs/playlist/refresh_playlist.py failed for profile '$($job.profile)'"
  }
}

Write-Host ""
Write-Host "Daily refresh local run completed."
