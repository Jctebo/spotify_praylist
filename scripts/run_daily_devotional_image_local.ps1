param(
  [string]$OpenAiApiKey
)

$ErrorActionPreference = "Stop"

if (-not $OpenAiApiKey) { $OpenAiApiKey = $env:OPENAI_API_KEY }
if (-not $OpenAiApiKey) { $OpenAiApiKey = [Environment]::GetEnvironmentVariable("OPENAI_API_KEY", "User") }
if (-not $OpenAiApiKey) { $OpenAiApiKey = Read-Host "OPENAI_API_KEY" }

$env:OPENAI_API_KEY = $OpenAiApiKey

Write-Host "Generating devotional image locally..."
py -3 jobs/novena/generate_devotional_image.py
if ($LASTEXITCODE -ne 0) {
  throw "jobs/novena/generate_devotional_image.py failed"
}

Write-Host "Devotional image local run completed."
