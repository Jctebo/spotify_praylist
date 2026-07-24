param()

$ErrorActionPreference = "Stop"

function Read-Required {
  param([string]$Prompt)
  while ($true) {
    $value = Read-Host $Prompt
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      return $value.Trim()
    }
    Write-Host "Value is required. Please try again." -ForegroundColor Yellow
  }
}

function Read-WithDefault {
  param(
    [string]$Prompt,
    [string]$Default
  )
  $value = Read-Host "$Prompt [$Default]"
  if ([string]::IsNullOrWhiteSpace($value)) {
    return $Default
  }
  return $value.Trim()
}

function Read-Optional {
  param([string]$Prompt)
  $value = Read-Host $Prompt
  if ([string]::IsNullOrWhiteSpace($value)) {
    return ""
  }
  return $value.Trim()
}

function Read-YesNo {
  param(
    [string]$Prompt,
    [bool]$DefaultYes = $true
  )
  $suffix = if ($DefaultYes) { "[Y/n]" } else { "[y/N]" }
  while ($true) {
    $value = Read-Host "$Prompt $suffix"
    if ([string]::IsNullOrWhiteSpace($value)) {
      return $DefaultYes
    }
    switch ($value.Trim().ToLowerInvariant()) {
      "y" { return $true }
      "yes" { return $true }
      "n" { return $false }
      "no" { return $false }
      default { Write-Host "Enter y or n." -ForegroundColor Yellow }
    }
  }
}

function Validate-AbsoluteUrl {
  param(
    [string]$Name,
    [string]$Value
  )
  try {
    $uri = [Uri]$Value
    if (-not $uri.IsAbsoluteUri) {
      throw "$Name is not an absolute URL."
    }
  } catch {
    throw "$Name is invalid: '$Value'"
  }
}

function Validate-WindowDays {
  param([string]$Value)
  $n = 0
  if (-not [int]::TryParse($Value, [ref]$n)) {
    throw "ROMCAL_WINDOW_DAYS must be a number between 1 and 30."
  }
  if ($n -lt 1 -or $n -gt 30) {
    throw "ROMCAL_WINDOW_DAYS must be a number between 1 and 30."
  }
}

function Validate-UtcOffset {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) {
    return
  }
  if ($Value -notmatch "^[+-](\d{1,2})(?::?([0-5]\d))?$") {
    throw "JOB_UTC_OFFSET must look like -06:00 or +05:30."
  }
}

function Mask-Secret {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) {
    return "<empty>"
  }
  if ($Value.Length -le 8) {
    return ("*" * $Value.Length)
  }
  return ($Value.Substring(0, 4) + ("*" * ($Value.Length - 8)) + $Value.Substring($Value.Length - 4))
}

Write-Host "Novena Setup Wizard" -ForegroundColor Green
Write-Host "This sets environment variables for Daily Novena Prayer generation." -ForegroundColor Green

$openAiKey = $env:OPENAI_API_KEY
if (-not [string]::IsNullOrWhiteSpace($openAiKey)) {
  if (-not (Read-YesNo "Use existing OPENAI_API_KEY from your environment?" $true)) {
    $openAiKey = ""
  }
}
if ([string]::IsNullOrWhiteSpace($openAiKey)) {
  $openAiKey = Read-Required "OPENAI_API_KEY"
}

$oaiBase = if ($env:OAI_API_BASE_URL) {
  Read-WithDefault "OAI_API_BASE_URL" $env:OAI_API_BASE_URL
} else {
  Read-WithDefault "OAI_API_BASE_URL" "https://api.openai.com/v1"
}
Validate-AbsoluteUrl -Name "OAI_API_BASE_URL" -Value $oaiBase

$oaiModel = if ($env:OAI_MODEL) {
  Read-WithDefault "OAI_MODEL" $env:OAI_MODEL
} else {
  Read-WithDefault "OAI_MODEL" "gpt-4.1-mini"
}

$romcalCalendar = if ($env:ROMCAL_CALENDAR) {
  Read-WithDefault "ROMCAL_CALENDAR" $env:ROMCAL_CALENDAR
} else {
  Read-WithDefault "ROMCAL_CALENDAR" "general_roman"
}

$romcalLocale = if ($env:ROMCAL_LOCALE) {
  Read-WithDefault "ROMCAL_LOCALE" $env:ROMCAL_LOCALE
} else {
  Read-WithDefault "ROMCAL_LOCALE" "en"
}

$windowDays = if ($env:ROMCAL_WINDOW_DAYS) {
  Read-WithDefault "ROMCAL_WINDOW_DAYS" $env:ROMCAL_WINDOW_DAYS
} else {
  Read-WithDefault "ROMCAL_WINDOW_DAYS" "9"
}
Validate-WindowDays -Value $windowDays

$notionToken = if ($env:NOTION_TOKEN) {
  Read-WithDefault "NOTION_TOKEN" $env:NOTION_TOKEN
} else {
  Read-Optional "NOTION_TOKEN (optional if already configured elsewhere)"
}

$notionDbId = if ($env:NOTION_DATABASE_ID) {
  Read-WithDefault "NOTION_DATABASE_ID" $env:NOTION_DATABASE_ID
} else {
  Read-Optional "NOTION_DATABASE_ID (optional if using NOTION_DATABASE_NAME)"
}

$notionDbName = if ($env:NOTION_DATABASE_NAME) {
  Read-WithDefault "NOTION_DATABASE_NAME" $env:NOTION_DATABASE_NAME
} else {
  Read-WithDefault "NOTION_DATABASE_NAME" "Opus Dei"
}

$notionTitleProp = if ($env:NOTION_TITLE_PROPERTY) {
  Read-WithDefault "NOTION_TITLE_PROPERTY" $env:NOTION_TITLE_PROPERTY
} else {
  Read-WithDefault "NOTION_TITLE_PROPERTY" "Name"
}

$notionRowTitle = if ($env:NOTION_NOVENA_ROW_TITLE) {
  Read-WithDefault "NOTION_NOVENA_ROW_TITLE" $env:NOTION_NOVENA_ROW_TITLE
} else {
  Read-WithDefault "NOTION_NOVENA_ROW_TITLE" "Daily Novenas from Liturgical Calendar"
}

$notionPrayerProp = if ($env:NOTION_NOVENA_PROPERTY) {
  Read-WithDefault "NOTION_NOVENA_PROPERTY (blank to replace page content)" $env:NOTION_NOVENA_PROPERTY
} else {
  Read-Optional "NOTION_NOVENA_PROPERTY (blank to replace page content)"
}

$notionWriteDailyNovenaPage = if ($env:NOTION_WRITE_DAILY_NOVENA_PAGE) {
  Read-WithDefault "NOTION_WRITE_DAILY_NOVENA_PAGE" $env:NOTION_WRITE_DAILY_NOVENA_PAGE
} else {
  Read-WithDefault "NOTION_WRITE_DAILY_NOVENA_PAGE" "false"
}

$notionSaintDbId = if ($env:NOTION_SAINT_DATABASE_ID) {
  Read-WithDefault "NOTION_SAINT_DATABASE_ID" $env:NOTION_SAINT_DATABASE_ID
} else {
  Read-Optional "NOTION_SAINT_DATABASE_ID (recommended for Liturgical Calendar)"
}

$notionSaintDbName = if ($env:NOTION_SAINT_DATABASE_NAME) {
  Read-WithDefault "NOTION_SAINT_DATABASE_NAME" $env:NOTION_SAINT_DATABASE_NAME
} else {
  Read-WithDefault "NOTION_SAINT_DATABASE_NAME" "Liturgical Calendar"
}

$novenaAudioEnabled = if ($env:NOVENA_AUDIO_ENABLED) {
  Read-WithDefault "NOVENA_AUDIO_ENABLED" $env:NOVENA_AUDIO_ENABLED
} else {
  Read-WithDefault "NOVENA_AUDIO_ENABLED" "true"
}

$novenaAudioModel = if ($env:NOVENA_AUDIO_MODEL) {
  Read-WithDefault "NOVENA_AUDIO_MODEL" $env:NOVENA_AUDIO_MODEL
} else {
  Read-WithDefault "NOVENA_AUDIO_MODEL" "gpt-4o-mini-tts"
}

$novenaAudioVoice = if ($env:NOVENA_AUDIO_VOICE) {
  Read-WithDefault "NOVENA_AUDIO_VOICE" $env:NOVENA_AUDIO_VOICE
} else {
  Read-WithDefault "NOVENA_AUDIO_VOICE" "ash"
}

$novenaAudioFormat = if ($env:NOVENA_AUDIO_FORMAT) {
  Read-WithDefault "NOVENA_AUDIO_FORMAT" $env:NOVENA_AUDIO_FORMAT
} else {
  Read-WithDefault "NOVENA_AUDIO_FORMAT" "mp3"
}

$novenaAudioSpeed = if ($env:NOVENA_AUDIO_SPEED) {
  Read-WithDefault "NOVENA_AUDIO_SPEED" $env:NOVENA_AUDIO_SPEED
} else {
  Read-WithDefault "NOVENA_AUDIO_SPEED" "1.0"
}

$novenaAudioCaption = if ($env:NOVENA_AUDIO_CAPTION) {
  Read-WithDefault "NOVENA_AUDIO_CAPTION" $env:NOVENA_AUDIO_CAPTION
} else {
  Read-WithDefault "NOVENA_AUDIO_CAPTION" "Daily Novena Prayer (Audio)"
}

$novenaAudioFailOpen = if ($env:NOVENA_AUDIO_FAIL_OPEN) {
  Read-WithDefault "NOVENA_AUDIO_FAIL_OPEN" $env:NOVENA_AUDIO_FAIL_OPEN
} else {
  Read-WithDefault "NOVENA_AUDIO_FAIL_OPEN" "true"
}

$notionAudioRenderHashProperty = if ($env:NOTION_AUDIO_RENDER_HASH_PROPERTY) {
  Read-WithDefault "NOTION_AUDIO_RENDER_HASH_PROPERTY" $env:NOTION_AUDIO_RENDER_HASH_PROPERTY
} else {
  Read-WithDefault "NOTION_AUDIO_RENDER_HASH_PROPERTY" "Render Hash"
}

$notionAudioSavedProperty = if ($env:NOTION_AUDIO_SAVED_PROPERTY) {
  Read-WithDefault "NOTION_AUDIO_SAVED_PROPERTY" $env:NOTION_AUDIO_SAVED_PROPERTY
} else {
  Read-WithDefault "NOTION_AUDIO_SAVED_PROPERTY" "Audio Saved"
}

$jobUtcOffset = if ($env:JOB_UTC_OFFSET) {
  Read-WithDefault "JOB_UTC_OFFSET (optional)" $env:JOB_UTC_OFFSET
} else {
  Read-Optional "JOB_UTC_OFFSET (optional, e.g. -06:00)"
}
Validate-UtcOffset -Value $jobUtcOffset

$env:OPENAI_API_KEY = $openAiKey
$env:OAI_API_BASE_URL = $oaiBase
$env:OAI_MODEL = $oaiModel
$env:ROMCAL_CALENDAR = $romcalCalendar
$env:ROMCAL_LOCALE = $romcalLocale
$env:ROMCAL_WINDOW_DAYS = $windowDays
$env:NOTION_DATABASE_NAME = $notionDbName
$env:NOTION_TITLE_PROPERTY = $notionTitleProp
$env:NOTION_NOVENA_ROW_TITLE = $notionRowTitle

if ($notionToken) { $env:NOTION_TOKEN = $notionToken }
if ($notionDbId) { $env:NOTION_DATABASE_ID = $notionDbId }
if ($notionPrayerProp) { $env:NOTION_NOVENA_PROPERTY = $notionPrayerProp } else { Remove-Item Env:NOTION_NOVENA_PROPERTY -ErrorAction SilentlyContinue }
if ($notionWriteDailyNovenaPage) { $env:NOTION_WRITE_DAILY_NOVENA_PAGE = $notionWriteDailyNovenaPage }
if ($notionSaintDbId) { $env:NOTION_SAINT_DATABASE_ID = $notionSaintDbId }
if ($notionSaintDbName) { $env:NOTION_SAINT_DATABASE_NAME = $notionSaintDbName }
if ($novenaAudioEnabled) { $env:NOVENA_AUDIO_ENABLED = $novenaAudioEnabled }
if ($novenaAudioModel) { $env:NOVENA_AUDIO_MODEL = $novenaAudioModel }
if ($novenaAudioVoice) { $env:NOVENA_AUDIO_VOICE = $novenaAudioVoice }
if ($novenaAudioFormat) { $env:NOVENA_AUDIO_FORMAT = $novenaAudioFormat }
if ($novenaAudioSpeed) { $env:NOVENA_AUDIO_SPEED = $novenaAudioSpeed }
if ($novenaAudioCaption) { $env:NOVENA_AUDIO_CAPTION = $novenaAudioCaption }
if ($novenaAudioFailOpen) { $env:NOVENA_AUDIO_FAIL_OPEN = $novenaAudioFailOpen }
if ($notionAudioRenderHashProperty) { $env:NOTION_AUDIO_RENDER_HASH_PROPERTY = $notionAudioRenderHashProperty }
if ($notionAudioSavedProperty) { $env:NOTION_AUDIO_SAVED_PROPERTY = $notionAudioSavedProperty }
if ($jobUtcOffset) { $env:JOB_UTC_OFFSET = $jobUtcOffset }

Write-Host ""
Write-Host "Session environment is set." -ForegroundColor Green
Write-Host "OPENAI_API_KEY: $(Mask-Secret -Value $openAiKey)" -ForegroundColor Cyan
Write-Host "ROMCAL_CALENDAR: $romcalCalendar" -ForegroundColor Cyan
Write-Host "NOTION_NOVENA_ROW_TITLE: $notionRowTitle" -ForegroundColor Cyan

if (Read-YesNo "Save these values for future terminals (CurrentUser env)?" $true) {
  [Environment]::SetEnvironmentVariable("OPENAI_API_KEY", $openAiKey, "User")
  [Environment]::SetEnvironmentVariable("OAI_API_BASE_URL", $oaiBase, "User")
  [Environment]::SetEnvironmentVariable("OAI_MODEL", $oaiModel, "User")
  [Environment]::SetEnvironmentVariable("ROMCAL_CALENDAR", $romcalCalendar, "User")
  [Environment]::SetEnvironmentVariable("ROMCAL_LOCALE", $romcalLocale, "User")
  [Environment]::SetEnvironmentVariable("ROMCAL_WINDOW_DAYS", $windowDays, "User")
  [Environment]::SetEnvironmentVariable("NOTION_DATABASE_NAME", $notionDbName, "User")
  [Environment]::SetEnvironmentVariable("NOTION_TITLE_PROPERTY", $notionTitleProp, "User")
  [Environment]::SetEnvironmentVariable("NOTION_NOVENA_ROW_TITLE", $notionRowTitle, "User")
  if ($notionToken) { [Environment]::SetEnvironmentVariable("NOTION_TOKEN", $notionToken, "User") }
  if ($notionDbId) { [Environment]::SetEnvironmentVariable("NOTION_DATABASE_ID", $notionDbId, "User") }
  if ($notionPrayerProp) {
    [Environment]::SetEnvironmentVariable("NOTION_NOVENA_PROPERTY", $notionPrayerProp, "User")
  } else {
    [Environment]::SetEnvironmentVariable("NOTION_NOVENA_PROPERTY", $null, "User")
  }
  [Environment]::SetEnvironmentVariable("NOTION_WRITE_DAILY_NOVENA_PAGE", $notionWriteDailyNovenaPage, "User")
  if ($notionSaintDbId) { [Environment]::SetEnvironmentVariable("NOTION_SAINT_DATABASE_ID", $notionSaintDbId, "User") }
  [Environment]::SetEnvironmentVariable("NOTION_SAINT_DATABASE_NAME", $notionSaintDbName, "User")
  [Environment]::SetEnvironmentVariable("NOVENA_AUDIO_ENABLED", $novenaAudioEnabled, "User")
  [Environment]::SetEnvironmentVariable("NOVENA_AUDIO_MODEL", $novenaAudioModel, "User")
  [Environment]::SetEnvironmentVariable("NOVENA_AUDIO_VOICE", $novenaAudioVoice, "User")
  [Environment]::SetEnvironmentVariable("NOVENA_AUDIO_FORMAT", $novenaAudioFormat, "User")
  [Environment]::SetEnvironmentVariable("NOVENA_AUDIO_SPEED", $novenaAudioSpeed, "User")
  [Environment]::SetEnvironmentVariable("NOVENA_AUDIO_CAPTION", $novenaAudioCaption, "User")
  [Environment]::SetEnvironmentVariable("NOVENA_AUDIO_FAIL_OPEN", $novenaAudioFailOpen, "User")
  [Environment]::SetEnvironmentVariable("NOTION_AUDIO_RENDER_HASH_PROPERTY", $notionAudioRenderHashProperty, "User")
  [Environment]::SetEnvironmentVariable("NOTION_AUDIO_SAVED_PROPERTY", $notionAudioSavedProperty, "User")
  if ($jobUtcOffset) { [Environment]::SetEnvironmentVariable("JOB_UTC_OFFSET", $jobUtcOffset, "User") }
  Write-Host "Saved to CurrentUser environment." -ForegroundColor Green
}

if (Read-YesNo "Run daily novena generation now?" $true) {
  $runnerPath = Join-Path $PSScriptRoot "run_daily_novena_prayer_local.ps1"
  if (-not (Test-Path $runnerPath)) {
    throw "run_daily_novena_prayer_local.ps1 not found at: $runnerPath"
  }
  & $runnerPath `
    -OpenAiApiKey $openAiKey `
    -NotionToken $notionToken `
    -NotionDatabaseId $notionDbId `
    -NotionDatabaseName $notionDbName `
    -NotionNovenaRowTitle $notionRowTitle `
    -NotionNovenaProperty $notionPrayerProp `
    -NotionWriteDailyNovenaPage $notionWriteDailyNovenaPage `
    -NotionSaintDatabaseId $notionSaintDbId `
    -NotionSaintDatabaseName $notionSaintDbName `
    -NotionAudioRenderHashProperty $notionAudioRenderHashProperty `
    -NotionAudioSavedProperty $notionAudioSavedProperty `
    -RomcalCalendar $romcalCalendar `
    -RomcalLocale $romcalLocale `
    -RomcalWindowDays $windowDays `
    -OaiModel $oaiModel `
    -JobUtcOffset $jobUtcOffset `
    -NovenaAudioEnabled $novenaAudioEnabled `
    -NovenaAudioModel $novenaAudioModel `
    -NovenaAudioVoice $novenaAudioVoice `
    -NovenaAudioFormat $novenaAudioFormat `
    -NovenaAudioSpeed $novenaAudioSpeed `
    -NovenaAudioCaption $novenaAudioCaption `
    -NovenaAudioFailOpen $novenaAudioFailOpen
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
