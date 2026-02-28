param()

$ErrorActionPreference = "Stop"

function Read-Required {
  param(
    [string]$Prompt
  )

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

function Get-QueryParamValue {
  param(
    [string]$Url,
    [string]$ParamName
  )

  if ([string]::IsNullOrWhiteSpace($Url)) {
    return ""
  }

  try {
    $uri = [Uri]$Url
    $query = $uri.Query.TrimStart("?")
    foreach ($pair in $query.Split("&")) {
      if ([string]::IsNullOrWhiteSpace($pair)) { continue }
      $parts = $pair.Split("=", 2)
      $key = [uri]::UnescapeDataString($parts[0])
      if ($key -eq $ParamName) {
        if ($parts.Count -gt 1) {
          return [uri]::UnescapeDataString($parts[1])
        }
        return ""
      }
    }
  } catch {
    # Fall back to regex for non-URL pasted values.
    if ($Url -match "(?:^|[?&])$ParamName=([^&]+)") {
      return [uri]::UnescapeDataString($matches[1])
    }
  }

  return ""
}

function Validate-SpotifyInputs {
  param(
    [string]$ClientId,
    [string]$RedirectUri,
    [string]$Scope
  )

  if ($ClientId -notmatch "^[a-zA-Z0-9]{32}$") {
    Write-Host "Warning: SPOTIFY_CLIENT_ID does not look like a standard 32-char Spotify client id." -ForegroundColor Yellow
  }

  try {
    $uri = [Uri]$RedirectUri
    if (-not $uri.IsAbsoluteUri) {
      throw "Redirect URI is not absolute."
    }
  } catch {
    throw "Redirect URI is invalid: '$RedirectUri'"
  }

  if ([string]::IsNullOrWhiteSpace($Scope)) {
    throw "OAuth scope cannot be empty."
  }
}

function Get-RefreshToken {
  param(
    [string]$ClientId,
    [string]$ClientSecret,
    [string]$RedirectUri,
    [string]$Scope
  )

  Validate-SpotifyInputs -ClientId $ClientId -RedirectUri $RedirectUri -Scope $Scope
  $authUrl = "https://accounts.spotify.com/authorize?client_id=$ClientId&response_type=code&redirect_uri=$([uri]::EscapeDataString($RedirectUri))&scope=$([uri]::EscapeDataString($Scope))&show_dialog=true"

  Write-Host ""
  Write-Host "Open this URL, sign in, and approve access:" -ForegroundColor Cyan
  Write-Host "If Spotify shows 'Something went wrong', verify this exact redirect URI is in your app settings: $RedirectUri" -ForegroundColor Yellow
  Write-Host $authUrl

  if (Read-YesNo "Open browser automatically?" $true) {
    Start-Process $authUrl | Out-Null
  }

  Write-Host ""
  Write-Host "After redirect, copy the FULL URL from your browser and paste it below." -ForegroundColor Cyan
  Write-Host "It must contain '?code=' (example: http://127.0.0.1:8888/callback?code=...)." -ForegroundColor Cyan
  $fullRedirect = Read-Required "Redirected URL"

  $oauthError = Get-QueryParamValue -Url $fullRedirect -ParamName "error"
  if (-not [string]::IsNullOrWhiteSpace($oauthError)) {
    throw "Spotify authorization returned error: $oauthError"
  }

  $code = Get-QueryParamValue -Url $fullRedirect -ParamName "code"
  if ([string]::IsNullOrWhiteSpace($code)) {
    throw "Could not find 'code=' in redirected URL. Paste the full callback URL from browser address bar."
  }

  $basic = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("$ClientId`:$ClientSecret"))
  try {
    $tokenResp = Invoke-RestMethod -Method Post -Uri "https://accounts.spotify.com/api/token" `
      -Headers @{ Authorization = "Basic $basic" } `
      -ContentType "application/x-www-form-urlencoded" `
      -Body @{
        grant_type   = "authorization_code"
        code         = $code
        redirect_uri = $RedirectUri
      }
  } catch {
    $rawResponse = ""
    if ($_.Exception.Response -and $_.Exception.Response.GetResponseStream()) {
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $rawResponse = $reader.ReadToEnd()
    }
    if (-not [string]::IsNullOrWhiteSpace($rawResponse)) {
      throw "Token exchange failed. Spotify response: $rawResponse"
    }
    throw "Token exchange failed: $($_.Exception.Message)"
  }

  $refreshToken = "$($tokenResp.refresh_token)".Trim()
  if (-not $refreshToken) {
    throw "No refresh_token returned. Re-run and approve again (show_dialog=true is already enabled)."
  }

  return $refreshToken
}

Write-Host "Spotify Local Setup Wizard" -ForegroundColor Green
Write-Host "This will set env vars for your current shell and optionally save for future shells." -ForegroundColor Green

$clientId = if ($env:SPOTIFY_CLIENT_ID) {
  Read-WithDefault "SPOTIFY_CLIENT_ID" $env:SPOTIFY_CLIENT_ID
} else {
  Read-Required "SPOTIFY_CLIENT_ID"
}

$clientSecret = if ($env:SPOTIFY_CLIENT_SECRET) {
  Read-WithDefault "SPOTIFY_CLIENT_SECRET" $env:SPOTIFY_CLIENT_SECRET
} else {
  Read-Required "SPOTIFY_CLIENT_SECRET"
}

$refreshToken = $env:SPOTIFY_REFRESH_TOKEN
if (-not [string]::IsNullOrWhiteSpace($refreshToken)) {
  if (-not (Read-YesNo "Use existing SPOTIFY_REFRESH_TOKEN from your environment?" $true)) {
    $refreshToken = ""
  }
}

if ([string]::IsNullOrWhiteSpace($refreshToken)) {
  $redirectUri = Read-WithDefault "Redirect URI" "http://127.0.0.1:8888/callback"
  $scope = Read-WithDefault "OAuth scope" "playlist-modify-private playlist-modify-public playlist-read-private user-read-recently-played user-read-currently-playing user-read-playback-state"
  Write-Host ""
  Write-Host "OAuth preflight:" -ForegroundColor Cyan
  Write-Host "- Redirect URI: $redirectUri"
  Write-Host "- Scope: $scope"
  $refreshToken = Get-RefreshToken -ClientId $clientId -ClientSecret $clientSecret -RedirectUri $redirectUri -Scope $scope

  Write-Host ""
  Write-Host "Full refresh token:" -ForegroundColor Cyan
  Write-Host $refreshToken

  if (Get-Command Set-Clipboard -ErrorAction SilentlyContinue) {
    if (Read-YesNo "Copy refresh token to clipboard?" $true) {
      $refreshToken | Set-Clipboard
      Write-Host "Copied." -ForegroundColor Green
    }
  }
}

$morningId = Read-WithDefault "Morning playlist ID" "0sy9eBsySKuCppI0PxXRJN"
$middayId = Read-WithDefault "Midday playlist ID" "4gQAaPAMiezBaDaoqK6sFQ"
$nightId = Read-WithDefault "Night playlist ID" "1TAlNiKHMc41cT0fvkYxTD"

$env:SPOTIFY_CLIENT_ID = $clientId
$env:SPOTIFY_CLIENT_SECRET = $clientSecret
$env:SPOTIFY_REFRESH_TOKEN = $refreshToken

$env:SPOTIFY_PLAYLIST_ID_MORNING = $morningId
$env:SPOTIFY_PLAYLIST_ID_MIDDAY = $middayId
$env:SPOTIFY_PLAYLIST_ID_NIGHT = $nightId

Write-Host ""
Write-Host "Session environment is set." -ForegroundColor Green

if (Read-YesNo "Save these values for future terminals (CurrentUser env)?" $true) {
  [Environment]::SetEnvironmentVariable("SPOTIFY_CLIENT_ID", $clientId, "User")
  [Environment]::SetEnvironmentVariable("SPOTIFY_CLIENT_SECRET", $clientSecret, "User")
  [Environment]::SetEnvironmentVariable("SPOTIFY_REFRESH_TOKEN", $refreshToken, "User")
  [Environment]::SetEnvironmentVariable("SPOTIFY_PLAYLIST_ID_MORNING", $morningId, "User")
  [Environment]::SetEnvironmentVariable("SPOTIFY_PLAYLIST_ID_MIDDAY", $middayId, "User")
  [Environment]::SetEnvironmentVariable("SPOTIFY_PLAYLIST_ID_NIGHT", $nightId, "User")
  Write-Host "Saved to CurrentUser environment." -ForegroundColor Green
}

if (Read-YesNo "Run all playlists locally now?" $true) {
  $runLocalPath = Join-Path $PSScriptRoot "run_local.ps1"
  if (-not (Test-Path $runLocalPath)) {
    throw "run_local.ps1 not found at: $runLocalPath"
  }

  & $runLocalPath -ClientId $clientId -ClientSecret $clientSecret -RefreshToken $refreshToken
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "For GitHub Actions, keep using repo Secrets for client id/secret/refresh token." -ForegroundColor Green
