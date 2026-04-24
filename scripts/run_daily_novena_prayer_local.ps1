param(
  [string]$OpenAiApiKey,
  [string]$NotionToken,
  [string]$NotionDatabaseId,
  [string]$NotionDatabaseName,
  [string]$NotionAudioRenderHashProperty,
  [string]$NotionAudioSavedProperty,
  [string]$OaiModel,
  [string]$JobUtcOffset,
  [string]$PrayerConfigFile,
  [string]$PrayerRowTitle,
  [string]$PageAudioCacheDir,
  [string]$PageAudioLibraryDir,
  [string]$NotionNovenaRowTitle,
  [string]$NotionNovenaProperty,
  [string]$NotionWriteDailyNovenaPage,
  [string]$NotionSaintDatabaseId,
  [string]$NotionSaintDatabaseName,
  [string]$NotionSaintTitleProperty,
  [string]$NotionSaintFeastDayProperty,
  [string]$NotionSaintCelebrationProperty,
  [string]$NotionSaintPrecedenceProperty,
  [string]$NotionSaintBackgroundProperty,
  [string]$RomcalCalendar,
  [string]$RomcalLocale,
  [string]$RomcalWindowDays,
  [string]$NovenaAudioEnabled,
  [string]$NovenaAudioModel,
  [string]$NovenaAudioVoice,
  [string]$NovenaAudioFormat,
  [string]$NovenaAudioSpeed,
  [string]$NovenaAudioCaption,
  [string]$NovenaAudioFailOpen,
  [string]$NovenaAudioLibraryDir
)

$ErrorActionPreference = "Stop"

if (-not $OpenAiApiKey) { $OpenAiApiKey = $env:OPENAI_API_KEY }
if (-not $NotionToken) { $NotionToken = $env:NOTION_TOKEN }
if (-not $NotionDatabaseId) { $NotionDatabaseId = $env:NOTION_DATABASE_ID }
if (-not $NotionDatabaseName) { $NotionDatabaseName = $env:NOTION_DATABASE_NAME }
if (-not $NotionAudioRenderHashProperty) { $NotionAudioRenderHashProperty = $env:NOTION_AUDIO_RENDER_HASH_PROPERTY }
if (-not $NotionAudioSavedProperty) { $NotionAudioSavedProperty = $env:NOTION_AUDIO_SAVED_PROPERTY }
if (-not $OaiModel) { $OaiModel = $env:OAI_MODEL }
if (-not $JobUtcOffset) { $JobUtcOffset = $env:JOB_UTC_OFFSET }
if (-not $PrayerConfigFile) { $PrayerConfigFile = $env:PRAYER_CONFIG_FILE }
if (-not $PrayerRowTitle) { $PrayerRowTitle = $env:PRAYER_ROW_TITLE }
if (-not $PageAudioCacheDir) { $PageAudioCacheDir = $env:PAGE_AUDIO_CACHE_DIR }
if (-not $PageAudioLibraryDir) { $PageAudioLibraryDir = $env:PAGE_AUDIO_LIBRARY_DIR }

if (-not $OpenAiApiKey) { $OpenAiApiKey = Read-Host "OPENAI_API_KEY" }
if (-not $NotionToken) { $NotionToken = Read-Host "NOTION_TOKEN" }
if (-not $NotionDatabaseId -and -not $NotionDatabaseName) { $NotionDatabaseId = Read-Host "NOTION_DATABASE_ID" }
if (-not $PrayerConfigFile) { $PrayerConfigFile = "config/custom_tts/morning-prayer.json" }
if (-not $PrayerRowTitle) { $PrayerRowTitle = "Morning Prayer" }

$env:OPENAI_API_KEY = $OpenAiApiKey
$env:NOTION_TOKEN = $NotionToken
$env:PRAYER_CONFIG_FILE = $PrayerConfigFile
$env:PRAYER_ROW_TITLE = $PrayerRowTitle

if ($NotionDatabaseId) { $env:NOTION_DATABASE_ID = $NotionDatabaseId }
if ($NotionDatabaseName) { $env:NOTION_DATABASE_NAME = $NotionDatabaseName }
if ($NotionAudioRenderHashProperty) { $env:NOTION_AUDIO_RENDER_HASH_PROPERTY = $NotionAudioRenderHashProperty }
if ($NotionAudioSavedProperty) { $env:NOTION_AUDIO_SAVED_PROPERTY = $NotionAudioSavedProperty }
if ($OaiModel) { $env:OAI_MODEL = $OaiModel }
if ($JobUtcOffset) { $env:JOB_UTC_OFFSET = $JobUtcOffset }
if ($PageAudioCacheDir) { $env:PAGE_AUDIO_CACHE_DIR = $PageAudioCacheDir }
if ($PageAudioLibraryDir) { $env:PAGE_AUDIO_LIBRARY_DIR = $PageAudioLibraryDir }

Write-Host "Generating Morning Prayer locally..."
python jobs/notion/generate_prayer.py
if ($LASTEXITCODE -ne 0) {
  throw "jobs/notion/generate_prayer.py failed"
}

Write-Host "Morning Prayer local run completed."
