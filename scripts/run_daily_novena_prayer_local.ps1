param(
  [string]$OpenAiApiKey,
  [string]$NotionToken,
  [string]$NotionDatabaseId,
  [string]$NotionNovenaRowTitle,
  [string]$NotionNovenaProperty,
  [string]$RomcalCalendar,
  [string]$RomcalLocale,
  [string]$RomcalWindowDays,
  [string]$OaiModel,
  [string]$JobUtcOffset
)

$ErrorActionPreference = "Stop"

if (-not $OpenAiApiKey) { $OpenAiApiKey = $env:OPENAI_API_KEY }
if (-not $NotionToken) { $NotionToken = $env:NOTION_TOKEN }
if (-not $NotionDatabaseId) { $NotionDatabaseId = $env:NOTION_DATABASE_ID }
if (-not $NotionNovenaRowTitle) { $NotionNovenaRowTitle = $env:NOTION_NOVENA_ROW_TITLE }
if (-not $NotionNovenaProperty) { $NotionNovenaProperty = $env:NOTION_NOVENA_PROPERTY }
if (-not $RomcalCalendar) { $RomcalCalendar = $env:ROMCAL_CALENDAR }
if (-not $RomcalLocale) { $RomcalLocale = $env:ROMCAL_LOCALE }
if (-not $RomcalWindowDays) { $RomcalWindowDays = $env:ROMCAL_WINDOW_DAYS }
if (-not $OaiModel) { $OaiModel = $env:OAI_MODEL }
if (-not $JobUtcOffset) { $JobUtcOffset = $env:JOB_UTC_OFFSET }

if (-not $OpenAiApiKey) { $OpenAiApiKey = Read-Host "OPENAI_API_KEY" }
if (-not $NotionToken) { $NotionToken = Read-Host "NOTION_TOKEN" }
if (-not $NotionDatabaseId) { $NotionDatabaseId = Read-Host "NOTION_DATABASE_ID" }
if (-not $NotionNovenaRowTitle) { $NotionNovenaRowTitle = "Daily Novena Prayer" }

$env:OPENAI_API_KEY = $OpenAiApiKey
$env:NOTION_TOKEN = $NotionToken
$env:NOTION_DATABASE_ID = $NotionDatabaseId
$env:NOTION_NOVENA_ROW_TITLE = $NotionNovenaRowTitle

if ($NotionNovenaProperty) { $env:NOTION_NOVENA_PROPERTY = $NotionNovenaProperty }
if ($RomcalCalendar) { $env:ROMCAL_CALENDAR = $RomcalCalendar }
if ($RomcalLocale) { $env:ROMCAL_LOCALE = $RomcalLocale }
if ($RomcalWindowDays) { $env:ROMCAL_WINDOW_DAYS = $RomcalWindowDays }
if ($OaiModel) { $env:OAI_MODEL = $OaiModel }
if ($JobUtcOffset) { $env:JOB_UTC_OFFSET = $JobUtcOffset }

Write-Host "Generating Daily Novena Prayer locally..."
py -3 jobs/novena/generate_daily_novena_prayer.py
if ($LASTEXITCODE -ne 0) {
  throw "jobs/novena/generate_daily_novena_prayer.py failed"
}

Write-Host "Daily Novena Prayer local run completed."
