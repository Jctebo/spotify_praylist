param(
  [string]$NotionToken,
  [string]$NotionDatabaseId
)

$ErrorActionPreference = "Stop"

if (-not $NotionToken) { $NotionToken = $env:NOTION_TOKEN }
if (-not $NotionDatabaseId) { $NotionDatabaseId = $env:NOTION_DATABASE_ID }

if (-not $NotionToken) { $NotionToken = Read-Host "NOTION_TOKEN" }
if (-not $NotionDatabaseId) { $NotionDatabaseId = Read-Host "NOTION_DATABASE_ID" }

$env:NOTION_TOKEN = $NotionToken
$env:NOTION_DATABASE_ID = $NotionDatabaseId

Write-Host "Running daily notion completion reset locally..."
py -3 jobs/notion/reset_notion_completions.py
if ($LASTEXITCODE -ne 0) {
  throw "jobs/notion/reset_notion_completions.py failed"
}

Write-Host "Daily notion reset local run completed."
