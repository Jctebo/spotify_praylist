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

function Normalize-NotionDatabaseId {
  param([string]$Value)
  $raw = ($Value -replace "-", "").Trim()
  if ($raw -match "^[0-9a-fA-F]{32}$") {
    return $raw.ToLowerInvariant()
  }
  throw "Database ID must be 32 hex characters (hyphens optional)."
}

function Test-NotionAccess {
  param(
    [string]$Token,
    [string]$DatabaseId
  )

  $headers = @{
    Authorization    = "Bearer $Token"
    "Notion-Version" = "2022-06-28"
    "Content-Type"   = "application/json"
  }

  $url = "https://api.notion.com/v1/databases/$DatabaseId/query"
  $body = @{ page_size = 1 } | ConvertTo-Json
  try {
    $result = Invoke-RestMethod -Method Post -Uri $url -Headers $headers -Body $body
    $count = @($result.results).Count
    Write-Host "Notion API access OK. Query returned $count row(s)." -ForegroundColor Green
    return $true
  } catch {
    Write-Host "Notion API validation failed: $($_.Exception.Message)" -ForegroundColor Red
    return $false
  }
}

Write-Host "Notion Setup Wizard" -ForegroundColor Green
Write-Host "Use this after creating a Notion integration token in Notion UI." -ForegroundColor Green

$notionToken = if ($env:NOTION_TOKEN) {
  Read-WithDefault "NOTION_TOKEN" $env:NOTION_TOKEN
} else {
  Read-Required "NOTION_TOKEN"
}

$databaseIdInput = if ($env:NOTION_DATABASE_ID) {
  Read-WithDefault "NOTION_DATABASE_ID" $env:NOTION_DATABASE_ID
} else {
  Read-Required "NOTION_DATABASE_ID"
}

$databaseId = Normalize-NotionDatabaseId $databaseIdInput

Write-Host ""
[void](Test-NotionAccess -Token $notionToken -DatabaseId $databaseId)

$env:NOTION_TOKEN = $notionToken
$env:NOTION_DATABASE_ID = $databaseId
Write-Host "Session env set: NOTION_TOKEN, NOTION_DATABASE_ID" -ForegroundColor Green

if (Read-YesNo "Save these values for future terminals (CurrentUser env)?" $true) {
  [Environment]::SetEnvironmentVariable("NOTION_TOKEN", $notionToken, "User")
  [Environment]::SetEnvironmentVariable("NOTION_DATABASE_ID", $databaseId, "User")
  Write-Host "Saved to CurrentUser environment." -ForegroundColor Green
}

Write-Host ""
Write-Host "Remember to update GitHub secrets: NOTION_TOKEN and NOTION_DATABASE_ID." -ForegroundColor Green
