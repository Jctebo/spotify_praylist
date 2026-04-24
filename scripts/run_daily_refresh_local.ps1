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
  [string]$NotionPlatformNoSyncValue,
  [string]$NotionQueueOrderProperty,
  [string]$NotionQueueResolverProperty,
  [string]$NotionQueueFallbackProperty,
  [string]$NotionQueueEnabledProperty,
  [string]$NotionUriProperty,
  [string]$SpotifyPlaylistName,
  [string]$SpotifyPlaylistId,
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
if (-not $NotionPlatformNoSyncValue) { $NotionPlatformNoSyncValue = $env:NOTION_PLATFORM_NOSYNC_VALUE }
if (-not $NotionQueueOrderProperty) { $NotionQueueOrderProperty = $env:NOTION_QUEUE_ORDER_PROPERTY }
if (-not $NotionQueueResolverProperty) { $NotionQueueResolverProperty = $env:NOTION_QUEUE_RESOLVER_PROPERTY }
if (-not $NotionQueueFallbackProperty) { $NotionQueueFallbackProperty = $env:NOTION_QUEUE_FALLBACK_PROPERTY }
if (-not $NotionQueueEnabledProperty) { $NotionQueueEnabledProperty = $env:NOTION_QUEUE_ENABLED_PROPERTY }
if (-not $NotionUriProperty) { $NotionUriProperty = $env:NOTION_URI_PROPERTY }
if (-not $SpotifyPlaylistName) { $SpotifyPlaylistName = $env:SPOTIFY_PLAYLIST_NAME }
if (-not $SpotifyPlaylistId) { $SpotifyPlaylistId = $env:SPOTIFY_PLAYLIST_ID }
if (-not $JobUtcOffset) { $JobUtcOffset = $env:JOB_UTC_OFFSET }

if (-not $ClientId) { $ClientId = Read-Host "SPOTIFY_CLIENT_ID" }
if (-not $ClientSecret) { $ClientSecret = Read-Host "SPOTIFY_CLIENT_SECRET" }
if (-not $RefreshToken) { $RefreshToken = Read-Host "SPOTIFY_REFRESH_TOKEN" }

$env:SPOTIFY_CLIENT_ID = $ClientId
$env:SPOTIFY_CLIENT_SECRET = $ClientSecret
$env:SPOTIFY_REFRESH_TOKEN = $RefreshToken
$env:SPOTIFY_ENABLE_URI_AUTOSYNC = "false"
$env:NOTION_INTENTIONS_ENABLED = "false"

if ($NotionToken) { $env:NOTION_TOKEN = $NotionToken }
if ($NotionDatabaseId) { $env:NOTION_DATABASE_ID = $NotionDatabaseId }
if ($NotionDatabaseName) { $env:NOTION_DATABASE_NAME = $NotionDatabaseName }
if ($NotionTitleProperty) { $env:NOTION_TITLE_PROPERTY = $NotionTitleProperty }
if ($NotionPlatformProperty) { $env:NOTION_PLATFORM_PROPERTY = $NotionPlatformProperty }
if ($NotionPlatformSpotifyValue) { $env:NOTION_PLATFORM_SPOTIFY_VALUE = $NotionPlatformSpotifyValue }
if ($NotionPlatformNoSyncValue) { $env:NOTION_PLATFORM_NOSYNC_VALUE = $NotionPlatformNoSyncValue }
if ($NotionQueueOrderProperty) { $env:NOTION_QUEUE_ORDER_PROPERTY = $NotionQueueOrderProperty }
if ($NotionQueueResolverProperty) { $env:NOTION_QUEUE_RESOLVER_PROPERTY = $NotionQueueResolverProperty }
if ($NotionQueueFallbackProperty) { $env:NOTION_QUEUE_FALLBACK_PROPERTY = $NotionQueueFallbackProperty }
if ($NotionQueueEnabledProperty) { $env:NOTION_QUEUE_ENABLED_PROPERTY = $NotionQueueEnabledProperty }
if ($NotionUriProperty) { $env:NOTION_URI_PROPERTY = $NotionUriProperty }
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
