param(
  [string]$ClientId,
  [string]$ClientSecret,
  [string]$RefreshToken,
  [string]$NotionToken,
  [string]$NotionDatabaseId,
  [string]$NotionDatabaseName,
  [string]$NotionPlaylistsDatabaseId,
  [string]$NotionPlaylistsDatabaseName,
  [string]$NotionTitleProperty,
  [string]$NotionPlatformProperty,
  [string]$NotionPlatformSpotifyValue,
  [string]$NotionPlaylistsTitleProperty,
  [string]$NotionPlaylistsIdProperty,
  [string]$NotionPlaylistsEnabledProperty,
  [string]$NotionQueuePlaylistProperty,
  [string]$NotionUriProperty,
  [string]$NotionSpotifyBookmarksEnabled,
  [string]$SpotifyPlaylistName,
  [string]$JobUtcOffset
)

$ErrorActionPreference = "Stop"

if (-not $ClientId) { $ClientId = $env:SPOTIFY_CLIENT_ID }
if (-not $ClientSecret) { $ClientSecret = $env:SPOTIFY_CLIENT_SECRET }
if (-not $RefreshToken) { $RefreshToken = $env:SPOTIFY_REFRESH_TOKEN }
if (-not $NotionToken) { $NotionToken = $env:NOTION_TOKEN }
if (-not $NotionDatabaseId) { $NotionDatabaseId = $env:NOTION_DATABASE_ID }
if (-not $NotionDatabaseName) { $NotionDatabaseName = $env:NOTION_DATABASE_NAME }
if (-not $NotionPlaylistsDatabaseId) { $NotionPlaylistsDatabaseId = $env:NOTION_PLAYLISTS_DATABASE_ID }
if (-not $NotionPlaylistsDatabaseName) { $NotionPlaylistsDatabaseName = $env:NOTION_PLAYLISTS_DATABASE_NAME }
if (-not $NotionTitleProperty) { $NotionTitleProperty = $env:NOTION_TITLE_PROPERTY }
if (-not $NotionPlatformProperty) { $NotionPlatformProperty = $env:NOTION_PLATFORM_PROPERTY }
if (-not $NotionPlatformSpotifyValue) { $NotionPlatformSpotifyValue = $env:NOTION_PLATFORM_SPOTIFY_VALUE }
if (-not $NotionPlaylistsTitleProperty) { $NotionPlaylistsTitleProperty = $env:NOTION_PLAYLISTS_TITLE_PROPERTY }
if (-not $NotionPlaylistsIdProperty) { $NotionPlaylistsIdProperty = $env:NOTION_PLAYLISTS_ID_PROPERTY }
if (-not $NotionPlaylistsEnabledProperty) { $NotionPlaylistsEnabledProperty = $env:NOTION_PLAYLISTS_ENABLED_PROPERTY }
if (-not $NotionQueuePlaylistProperty) { $NotionQueuePlaylistProperty = $env:NOTION_QUEUE_PLAYLIST_PROPERTY }
if (-not $NotionUriProperty) { $NotionUriProperty = $env:NOTION_URI_PROPERTY }
if (-not $NotionSpotifyBookmarksEnabled) { $NotionSpotifyBookmarksEnabled = $env:NOTION_SPOTIFY_BOOKMARKS_ENABLED }
if (-not $NotionSpotifyBookmarksEnabled) { $NotionSpotifyBookmarksEnabled = $env:NOTION_SPOTIFY_EMBEDS_ENABLED }
if (-not $SpotifyPlaylistName) { $SpotifyPlaylistName = $env:SPOTIFY_PLAYLIST_NAME }
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
if ($NotionPlaylistsDatabaseId) { $env:NOTION_PLAYLISTS_DATABASE_ID = $NotionPlaylistsDatabaseId }
if ($NotionPlaylistsDatabaseName) { $env:NOTION_PLAYLISTS_DATABASE_NAME = $NotionPlaylistsDatabaseName }
if ($NotionTitleProperty) { $env:NOTION_TITLE_PROPERTY = $NotionTitleProperty }
if ($NotionPlatformProperty) { $env:NOTION_PLATFORM_PROPERTY = $NotionPlatformProperty }
if ($NotionPlatformSpotifyValue) { $env:NOTION_PLATFORM_SPOTIFY_VALUE = $NotionPlatformSpotifyValue }
if ($NotionPlaylistsTitleProperty) { $env:NOTION_PLAYLISTS_TITLE_PROPERTY = $NotionPlaylistsTitleProperty }
if ($NotionPlaylistsIdProperty) { $env:NOTION_PLAYLISTS_ID_PROPERTY = $NotionPlaylistsIdProperty }
if ($NotionPlaylistsEnabledProperty) { $env:NOTION_PLAYLISTS_ENABLED_PROPERTY = $NotionPlaylistsEnabledProperty }
if ($NotionQueuePlaylistProperty) { $env:NOTION_QUEUE_PLAYLIST_PROPERTY = $NotionQueuePlaylistProperty }
if ($NotionUriProperty) { $env:NOTION_URI_PROPERTY = $NotionUriProperty }
if ($NotionSpotifyBookmarksEnabled) { $env:NOTION_SPOTIFY_BOOKMARKS_ENABLED = $NotionSpotifyBookmarksEnabled }
if ($SpotifyPlaylistName) { $env:SPOTIFY_PLAYLIST_NAME = $SpotifyPlaylistName }
if ($JobUtcOffset) { $env:JOB_UTC_OFFSET = $JobUtcOffset }

Write-Host ""
if ($env:SPOTIFY_PLAYLIST_NAME) {
  Write-Host "Running daily refresh for playlist '$($env:SPOTIFY_PLAYLIST_NAME)' from Notion..."
} else {
  Write-Host "Running daily refresh for all enabled Notion playlists..."
}
py -3 jobs/playlist/refresh_playlist.py
if ($LASTEXITCODE -ne 0) {
  throw "jobs/playlist/refresh_playlist.py failed"
}

Write-Host ""
Write-Host "Daily refresh local run completed."
