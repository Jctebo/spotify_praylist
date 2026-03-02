param(
  [string]$ClientId,
  [string]$ClientSecret,
  [string]$RefreshToken,
  [string]$NotionToken,
  [string]$NotionDatabaseId,
  [string]$JobUtcOffset
)

$ErrorActionPreference = "Stop"

if (-not $ClientId) { $ClientId = $env:SPOTIFY_CLIENT_ID }
if (-not $ClientSecret) { $ClientSecret = $env:SPOTIFY_CLIENT_SECRET }
if (-not $RefreshToken) { $RefreshToken = $env:SPOTIFY_REFRESH_TOKEN }
if (-not $NotionToken) { $NotionToken = $env:NOTION_TOKEN }
if (-not $NotionDatabaseId) { $NotionDatabaseId = $env:NOTION_DATABASE_ID }
if (-not $JobUtcOffset) { $JobUtcOffset = $env:JOB_UTC_OFFSET }

if (-not $ClientId) { $ClientId = Read-Host "SPOTIFY_CLIENT_ID" }
if (-not $ClientSecret) { $ClientSecret = Read-Host "SPOTIFY_CLIENT_SECRET" }
if (-not $RefreshToken) { $RefreshToken = Read-Host "SPOTIFY_REFRESH_TOKEN" }
if (-not $NotionToken) { $NotionToken = Read-Host "NOTION_TOKEN" }
if (-not $NotionDatabaseId) { $NotionDatabaseId = Read-Host "NOTION_DATABASE_ID" }

$env:SPOTIFY_CLIENT_ID = $ClientId
$env:SPOTIFY_CLIENT_SECRET = $ClientSecret
$env:SPOTIFY_REFRESH_TOKEN = $RefreshToken
$env:NOTION_TOKEN = $NotionToken
$env:NOTION_DATABASE_ID = $NotionDatabaseId
if ($JobUtcOffset) { $env:JOB_UTC_OFFSET = $JobUtcOffset }
$env:SPOTIFY_CONFIG_FILE = "config/playlist_config.json"
$env:SPOTIFY_NOTION_SYNC_CONFIG = "config/notion_spotify_sync_config.json"

Write-Host "Running hourly notion completion sync locally..."
py -3 jobs/notion/sync_notion_completions.py
if ($LASTEXITCODE -ne 0) {
  throw "jobs/notion/sync_notion_completions.py failed"
}

Write-Host "Hourly notion sync local run completed."
