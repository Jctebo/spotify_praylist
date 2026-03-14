param(
  [string]$OpenAiApiKey,
  [string]$NotionToken,
  [string]$NotionDatabaseId,
  [string]$NotionDatabaseName,
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
  [string]$NotionAudioRenderHashProperty,
  [string]$NotionAudioSavedProperty,
  [string]$RomcalCalendar,
  [string]$RomcalLocale,
  [string]$RomcalWindowDays,
  [string]$OaiModel,
  [string]$JobUtcOffset,
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
if (-not $NotionNovenaRowTitle) { $NotionNovenaRowTitle = $env:NOTION_NOVENA_ROW_TITLE }
if (-not $NotionNovenaProperty) { $NotionNovenaProperty = $env:NOTION_NOVENA_PROPERTY }
if (-not $NotionWriteDailyNovenaPage) { $NotionWriteDailyNovenaPage = $env:NOTION_WRITE_DAILY_NOVENA_PAGE }
if (-not $NotionSaintDatabaseId) { $NotionSaintDatabaseId = $env:NOTION_SAINT_DATABASE_ID }
if (-not $NotionSaintDatabaseName) { $NotionSaintDatabaseName = $env:NOTION_SAINT_DATABASE_NAME }
if (-not $NotionSaintTitleProperty) { $NotionSaintTitleProperty = $env:NOTION_SAINT_TITLE_PROPERTY }
if (-not $NotionSaintFeastDayProperty) { $NotionSaintFeastDayProperty = $env:NOTION_SAINT_FEAST_DAY_PROPERTY }
if (-not $NotionSaintCelebrationProperty) { $NotionSaintCelebrationProperty = $env:NOTION_SAINT_CELEBRATION_PROPERTY }
if (-not $NotionSaintPrecedenceProperty) { $NotionSaintPrecedenceProperty = $env:NOTION_SAINT_PRECEDENCE_PROPERTY }
if (-not $NotionSaintBackgroundProperty) { $NotionSaintBackgroundProperty = $env:NOTION_SAINT_BACKGROUND_PROPERTY }
if (-not $NotionAudioRenderHashProperty) { $NotionAudioRenderHashProperty = $env:NOTION_AUDIO_RENDER_HASH_PROPERTY }
if (-not $NotionAudioSavedProperty) { $NotionAudioSavedProperty = $env:NOTION_AUDIO_SAVED_PROPERTY }
if (-not $RomcalCalendar) { $RomcalCalendar = $env:ROMCAL_CALENDAR }
if (-not $RomcalLocale) { $RomcalLocale = $env:ROMCAL_LOCALE }
if (-not $RomcalWindowDays) { $RomcalWindowDays = $env:ROMCAL_WINDOW_DAYS }
if (-not $OaiModel) { $OaiModel = $env:OAI_MODEL }
if (-not $JobUtcOffset) { $JobUtcOffset = $env:JOB_UTC_OFFSET }
if (-not $NovenaAudioEnabled) { $NovenaAudioEnabled = $env:NOVENA_AUDIO_ENABLED }
if (-not $NovenaAudioModel) { $NovenaAudioModel = $env:NOVENA_AUDIO_MODEL }
if (-not $NovenaAudioVoice) { $NovenaAudioVoice = $env:NOVENA_AUDIO_VOICE }
if (-not $NovenaAudioFormat) { $NovenaAudioFormat = $env:NOVENA_AUDIO_FORMAT }
if (-not $NovenaAudioSpeed) { $NovenaAudioSpeed = $env:NOVENA_AUDIO_SPEED }
if (-not $NovenaAudioCaption) { $NovenaAudioCaption = $env:NOVENA_AUDIO_CAPTION }
if (-not $NovenaAudioFailOpen) { $NovenaAudioFailOpen = $env:NOVENA_AUDIO_FAIL_OPEN }
if (-not $NovenaAudioLibraryDir) { $NovenaAudioLibraryDir = $env:NOVENA_AUDIO_LIBRARY_DIR }

if (-not $OpenAiApiKey) { $OpenAiApiKey = Read-Host "OPENAI_API_KEY" }
if (-not $NotionToken) { $NotionToken = Read-Host "NOTION_TOKEN" }
if (-not $NotionDatabaseId -and -not $NotionDatabaseName) { $NotionDatabaseId = Read-Host "NOTION_DATABASE_ID" }
if (-not $NotionNovenaRowTitle) { $NotionNovenaRowTitle = "Daily Novenas from Liturgical Calendar" }

$env:OPENAI_API_KEY = $OpenAiApiKey
$env:NOTION_TOKEN = $NotionToken
$env:NOTION_NOVENA_ROW_TITLE = $NotionNovenaRowTitle

if ($NotionDatabaseId) { $env:NOTION_DATABASE_ID = $NotionDatabaseId }
if ($NotionDatabaseName) { $env:NOTION_DATABASE_NAME = $NotionDatabaseName }
if ($NotionNovenaProperty) { $env:NOTION_NOVENA_PROPERTY = $NotionNovenaProperty }
if ($NotionWriteDailyNovenaPage) { $env:NOTION_WRITE_DAILY_NOVENA_PAGE = $NotionWriteDailyNovenaPage }
if ($NotionSaintDatabaseId) { $env:NOTION_SAINT_DATABASE_ID = $NotionSaintDatabaseId }
if ($NotionSaintDatabaseName) { $env:NOTION_SAINT_DATABASE_NAME = $NotionSaintDatabaseName }
if ($NotionSaintTitleProperty) { $env:NOTION_SAINT_TITLE_PROPERTY = $NotionSaintTitleProperty }
if ($NotionSaintFeastDayProperty) { $env:NOTION_SAINT_FEAST_DAY_PROPERTY = $NotionSaintFeastDayProperty }
if ($NotionSaintCelebrationProperty) { $env:NOTION_SAINT_CELEBRATION_PROPERTY = $NotionSaintCelebrationProperty }
if ($NotionSaintPrecedenceProperty) { $env:NOTION_SAINT_PRECEDENCE_PROPERTY = $NotionSaintPrecedenceProperty }
if ($NotionSaintBackgroundProperty) { $env:NOTION_SAINT_BACKGROUND_PROPERTY = $NotionSaintBackgroundProperty }
if ($NotionAudioRenderHashProperty) { $env:NOTION_AUDIO_RENDER_HASH_PROPERTY = $NotionAudioRenderHashProperty }
if ($NotionAudioSavedProperty) { $env:NOTION_AUDIO_SAVED_PROPERTY = $NotionAudioSavedProperty }
if ($RomcalCalendar) { $env:ROMCAL_CALENDAR = $RomcalCalendar }
if ($RomcalLocale) { $env:ROMCAL_LOCALE = $RomcalLocale }
if ($RomcalWindowDays) { $env:ROMCAL_WINDOW_DAYS = $RomcalWindowDays }
if ($OaiModel) { $env:OAI_MODEL = $OaiModel }
if ($JobUtcOffset) { $env:JOB_UTC_OFFSET = $JobUtcOffset }
if ($NovenaAudioEnabled) { $env:NOVENA_AUDIO_ENABLED = $NovenaAudioEnabled }
if ($NovenaAudioModel) { $env:NOVENA_AUDIO_MODEL = $NovenaAudioModel }
if ($NovenaAudioVoice) { $env:NOVENA_AUDIO_VOICE = $NovenaAudioVoice }
if ($NovenaAudioFormat) { $env:NOVENA_AUDIO_FORMAT = $NovenaAudioFormat }
if ($NovenaAudioSpeed) { $env:NOVENA_AUDIO_SPEED = $NovenaAudioSpeed }
if ($NovenaAudioCaption) { $env:NOVENA_AUDIO_CAPTION = $NovenaAudioCaption }
if ($NovenaAudioFailOpen) { $env:NOVENA_AUDIO_FAIL_OPEN = $NovenaAudioFailOpen }
if ($NovenaAudioLibraryDir) { $env:NOVENA_AUDIO_LIBRARY_DIR = $NovenaAudioLibraryDir }

Write-Host "Generating Daily Novena Prayer locally..."
py -3 jobs/novena/generate_daily_novena_prayer.py
if ($LASTEXITCODE -ne 0) {
  throw "jobs/novena/generate_daily_novena_prayer.py failed"
}

Write-Host "Daily Novena Prayer local run completed."
