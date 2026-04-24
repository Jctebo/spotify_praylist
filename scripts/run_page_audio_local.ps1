param(
  [string]$OpenAiApiKey,
  [string]$NotionToken,
  [string]$NotionDatabaseId,
  [string]$NotionDatabaseName,
  [string]$NotionTitleProperty,
  [string]$NotionPlatformProperty,
  [string]$NotionAudioPlatformValue,
  [string]$NotionAudioResolverProperty,
  [string]$NotionAudioEnabledProperty,
  [string]$NotionPageAudioConfigDatabaseId,
  [string]$NotionPageAudioConfigDatabaseName,
  [string]$NotionAudioFragmentsDatabaseId,
  [string]$NotionAudioFragmentsDatabaseName,
  [string]$NotionAudioOutputsDatabaseId,
  [string]$NotionAudioOutputsDatabaseName,
  [string]$PageAudioConfigKey,
  [string]$PageAudioRowTitle,
  [string]$PageAudioConfigFile,
  [string]$PageAudioCacheDir,
  [string]$PageAudioLibraryDir,
  [string]$PageAudioFailOpen,
  [string]$OaiApiBaseUrl,
  [string]$JobUtcOffset
)

$ErrorActionPreference = "Stop"

if (-not $OpenAiApiKey) { $OpenAiApiKey = $env:OPENAI_API_KEY }
if (-not $NotionToken) { $NotionToken = $env:NOTION_TOKEN }
if (-not $NotionDatabaseId) { $NotionDatabaseId = $env:NOTION_DATABASE_ID }
if (-not $NotionDatabaseName) { $NotionDatabaseName = $env:NOTION_DATABASE_NAME }
if (-not $NotionTitleProperty) { $NotionTitleProperty = $env:NOTION_TITLE_PROPERTY }
if (-not $NotionPlatformProperty) { $NotionPlatformProperty = $env:NOTION_PLATFORM_PROPERTY }
if (-not $NotionAudioPlatformValue) { $NotionAudioPlatformValue = $env:NOTION_AUDIO_PLATFORM_VALUE }
if (-not $NotionAudioResolverProperty) { $NotionAudioResolverProperty = $env:NOTION_AUDIO_RESOLVER_PROPERTY }
if (-not $NotionAudioEnabledProperty) { $NotionAudioEnabledProperty = $env:NOTION_AUDIO_ENABLED_PROPERTY }
if (-not $NotionPageAudioConfigDatabaseId) { $NotionPageAudioConfigDatabaseId = $env:NOTION_PAGE_AUDIO_CONFIG_DATABASE_ID }
if (-not $NotionPageAudioConfigDatabaseName) { $NotionPageAudioConfigDatabaseName = $env:NOTION_PAGE_AUDIO_CONFIG_DATABASE_NAME }
if (-not $NotionAudioFragmentsDatabaseId) { $NotionAudioFragmentsDatabaseId = $env:NOTION_AUDIO_FRAGMENTS_DATABASE_ID }
if (-not $NotionAudioFragmentsDatabaseName) { $NotionAudioFragmentsDatabaseName = $env:NOTION_AUDIO_FRAGMENTS_DATABASE_NAME }
if (-not $NotionAudioOutputsDatabaseId) { $NotionAudioOutputsDatabaseId = $env:NOTION_AUDIO_OUTPUTS_DATABASE_ID }
if (-not $NotionAudioOutputsDatabaseName) { $NotionAudioOutputsDatabaseName = $env:NOTION_AUDIO_OUTPUTS_DATABASE_NAME }
if (-not $PageAudioConfigKey) { $PageAudioConfigKey = $env:PAGE_AUDIO_CONFIG_KEY }
if (-not $PageAudioRowTitle) { $PageAudioRowTitle = $env:PAGE_AUDIO_ROW_TITLE }
if (-not $PageAudioConfigFile) { $PageAudioConfigFile = $env:PAGE_AUDIO_CONFIG_FILE }
if (-not $PageAudioCacheDir) { $PageAudioCacheDir = $env:PAGE_AUDIO_CACHE_DIR }
if (-not $PageAudioLibraryDir) { $PageAudioLibraryDir = $env:PAGE_AUDIO_LIBRARY_DIR }
if (-not $PageAudioFailOpen) { $PageAudioFailOpen = $env:PAGE_AUDIO_FAIL_OPEN }
if (-not $OaiApiBaseUrl) { $OaiApiBaseUrl = $env:OAI_API_BASE_URL }
if (-not $JobUtcOffset) { $JobUtcOffset = $env:JOB_UTC_OFFSET }

if (-not $OpenAiApiKey) { $OpenAiApiKey = Read-Host "OPENAI_API_KEY" }
if (-not $NotionToken) { $NotionToken = Read-Host "NOTION_TOKEN" }
if (-not $NotionDatabaseId -and -not $NotionDatabaseName) { $NotionDatabaseId = Read-Host "NOTION_DATABASE_ID" }

$env:OPENAI_API_KEY = $OpenAiApiKey
$env:NOTION_TOKEN = $NotionToken

if ($NotionDatabaseId) { $env:NOTION_DATABASE_ID = $NotionDatabaseId }
if ($NotionDatabaseName) { $env:NOTION_DATABASE_NAME = $NotionDatabaseName }
if ($NotionTitleProperty) { $env:NOTION_TITLE_PROPERTY = $NotionTitleProperty }
if ($NotionPlatformProperty) { $env:NOTION_PLATFORM_PROPERTY = $NotionPlatformProperty }
if ($NotionAudioPlatformValue) { $env:NOTION_AUDIO_PLATFORM_VALUE = $NotionAudioPlatformValue }
if ($NotionAudioResolverProperty) { $env:NOTION_AUDIO_RESOLVER_PROPERTY = $NotionAudioResolverProperty }
if ($NotionAudioEnabledProperty) { $env:NOTION_AUDIO_ENABLED_PROPERTY = $NotionAudioEnabledProperty }
if ($NotionPageAudioConfigDatabaseId) { $env:NOTION_PAGE_AUDIO_CONFIG_DATABASE_ID = $NotionPageAudioConfigDatabaseId }
if ($NotionPageAudioConfigDatabaseName) { $env:NOTION_PAGE_AUDIO_CONFIG_DATABASE_NAME = $NotionPageAudioConfigDatabaseName }
if ($NotionAudioFragmentsDatabaseId) { $env:NOTION_AUDIO_FRAGMENTS_DATABASE_ID = $NotionAudioFragmentsDatabaseId }
if ($NotionAudioFragmentsDatabaseName) { $env:NOTION_AUDIO_FRAGMENTS_DATABASE_NAME = $NotionAudioFragmentsDatabaseName }
if ($NotionAudioOutputsDatabaseId) { $env:NOTION_AUDIO_OUTPUTS_DATABASE_ID = $NotionAudioOutputsDatabaseId }
if ($NotionAudioOutputsDatabaseName) { $env:NOTION_AUDIO_OUTPUTS_DATABASE_NAME = $NotionAudioOutputsDatabaseName }
if ($PageAudioConfigKey) { $env:PAGE_AUDIO_CONFIG_KEY = $PageAudioConfigKey }
if ($PageAudioRowTitle) { $env:PAGE_AUDIO_ROW_TITLE = $PageAudioRowTitle }
if ($PageAudioConfigFile) { $env:PAGE_AUDIO_CONFIG_FILE = $PageAudioConfigFile }
if ($PageAudioCacheDir) { $env:PAGE_AUDIO_CACHE_DIR = $PageAudioCacheDir }
if ($PageAudioLibraryDir) { $env:PAGE_AUDIO_LIBRARY_DIR = $PageAudioLibraryDir }
if ($PageAudioFailOpen) { $env:PAGE_AUDIO_FAIL_OPEN = $PageAudioFailOpen }
if (-not $env:PAGE_AUDIO_FAIL_OPEN) { $env:PAGE_AUDIO_FAIL_OPEN = "true" }
if ($OaiApiBaseUrl) { $env:OAI_API_BASE_URL = $OaiApiBaseUrl }
if ($JobUtcOffset) { $env:JOB_UTC_OFFSET = $JobUtcOffset }

Write-Host "Generating page audio locally..."
python jobs/notion/generate_page_audio.py
if ($LASTEXITCODE -ne 0) {
  throw "jobs/notion/generate_page_audio.py failed"
}

Write-Host "Page audio local run completed."
