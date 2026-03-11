param(
  [string]$NotionToken,
  [string]$NotionDatabaseId,
  [string]$PlaylistsDatabaseId,
  [string]$PlaylistsDatabaseName,
  [string]$PlaylistsParentPageTitle,
  [string]$PlaylistProperty,
  [string]$LegacyPlaylistProperty,
  [string]$PlaylistIdProperty,
  [string]$PlaylistsEnabledProperty,
  [string]$ConfigPath
)

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

function Normalize-NotionId {
  param([string]$Value)
  $raw = ($Value -replace "-", "").Trim()
  if (-not $raw) {
    return ""
  }
  if ($raw -match "^[0-9a-fA-F]{32}$") {
    return $raw.ToLowerInvariant()
  }
  return $Value.Trim()
}

function Get-NormalizedKey {
  param([string]$Value)
  return ([regex]::Replace([string]$Value.ToLowerInvariant(), "[^a-z0-9]+", " ")).Trim()
}

function Convert-DisplayName {
  param([string]$Value)
  $normalized = Get-NormalizedKey $Value
  if (-not $normalized) {
    return ""
  }
  return [System.Globalization.CultureInfo]::InvariantCulture.TextInfo.ToTitleCase($normalized)
}

function Get-NotionHeaders {
  param([string]$Token)
  return @{
    Authorization    = "Bearer $Token"
    "Notion-Version" = "2022-06-28"
    "Content-Type"   = "application/json"
  }
}

function Invoke-Notion {
  param(
    [string]$Method,
    [string]$Url,
    [object]$Body = $null
  )

  $headers = Get-NotionHeaders $script:NotionToken
  try {
    if ($null -eq $Body) {
      return Invoke-RestMethod -Method $Method -Uri $Url -Headers $headers
    }
    $json = $Body | ConvertTo-Json -Depth 20
    return Invoke-RestMethod -Method $Method -Uri $Url -Headers $headers -Body $json
  } catch {
    $response = $_.Exception.Response
    if ($response -and $response.GetResponseStream) {
      $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
      $detail = $reader.ReadToEnd()
      if ($detail) {
        throw $detail
      }
    }
    throw
  }
}

function Find-DatabaseIdByName {
  param([string]$Name)
  $body = @{
    query  = $Name
    filter = @{
      value    = "database"
      property = "object"
    }
  }
  $resp = Invoke-Notion -Method Post -Url "https://api.notion.com/v1/search" -Body $body
  foreach ($item in @($resp.results)) {
    $title = (($item.title | ForEach-Object { $_.plain_text }) -join " ").Trim()
    if ($title -and $title.ToLowerInvariant() -eq $Name.ToLowerInvariant()) {
      return [string]$item.id
    }
  }
  foreach ($item in @($resp.results)) {
    if ($item.id) {
      return [string]$item.id
    }
  }
  return ""
}

function Get-AllPages {
  param([string]$DatabaseId)
  $pages = @()
  $cursor = $null
  while ($true) {
    $body = @{ page_size = 100 }
    if ($cursor) {
      $body.start_cursor = $cursor
    }
    $resp = Invoke-Notion -Method Post -Url "https://api.notion.com/v1/databases/$DatabaseId/query" -Body $body
    $pages += @($resp.results)
    if (-not $resp.has_more) {
      break
    }
    $cursor = [string]$resp.next_cursor
  }
  return $pages
}

function Get-ObjectPropertyByName {
  param(
    [object]$Object,
    [string]$PropertyName
  )
  if ($null -eq $Object) {
    return $null
  }
  foreach ($prop in $Object.PSObject.Properties) {
    if ($prop.Name.ToLowerInvariant() -eq $PropertyName.ToLowerInvariant()) {
      return $prop.Value
    }
  }
  return $null
}

function Get-PageProperty {
  param(
    [object]$Page,
    [string]$PropertyName
  )
  return Get-ObjectPropertyByName -Object $Page.properties -PropertyName $PropertyName
}

function Get-DatabaseProperty {
  param(
    [object]$Database,
    [string]$PropertyName
  )
  return Get-ObjectPropertyByName -Object $Database.properties -PropertyName $PropertyName
}

function Get-PropertyText {
  param([object]$Property)
  if ($null -eq $Property) {
    return ""
  }
  switch ([string]$Property.type) {
    "select" {
      if ($Property.select) {
        return [string]$Property.select.name
      }
      return ""
    }
    "multi_select" {
      return ((@($Property.multi_select) | ForEach-Object { [string]$_.name }) -join ", ").Trim()
    }
    "status" {
      if ($Property.status) {
        return [string]$Property.status.name
      }
      return ""
    }
    "rich_text" {
      return ((@($Property.rich_text) | ForEach-Object { [string]$_.plain_text }) -join " ").Trim()
    }
    "title" {
      return ((@($Property.title) | ForEach-Object { [string]$_.plain_text }) -join " ").Trim()
    }
    "url" {
      return [string]$Property.url
    }
    default {
      return ""
    }
  }
}

function Get-PropertyCheckbox {
  param([object]$Property)
  if ($null -eq $Property) {
    return $null
  }
  if ([string]$Property.type -ne "checkbox") {
    return $null
  }
  return [bool]$Property.checkbox
}

function New-RichTextValue {
  param([string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text)) {
    return ,@()
  }
  return ,@(
    @{
      type = "text"
      text = @{
        content = $Text
      }
    }
  )
}

function Update-PageTextProperty {
  param(
    [string]$PageId,
    [string]$PropertyName,
    [string]$PropertyType,
    [string]$Value
  )

  $payload = switch ($PropertyType) {
    "rich_text" { @{ rich_text = (New-RichTextValue $Value) } }
    "select" {
      if ([string]::IsNullOrWhiteSpace($Value)) {
        @{ select = $null }
      } else {
        @{ select = @{ name = $Value } }
      }
    }
    "multi_select" {
      if ([string]::IsNullOrWhiteSpace($Value)) {
        @{ multi_select = @() }
      } else {
        @{ multi_select = @(@{ name = $Value }) }
      }
    }
    default { throw "Unsupported property type '$PropertyType' for property '$PropertyName'." }
  }

  $body = @{
    properties = @{
      $PropertyName = $payload
    }
  }
  [void](Invoke-Notion -Method Patch -Url "https://api.notion.com/v1/pages/$PageId" -Body $body)
}

function Update-PageCheckboxProperty {
  param(
    [string]$PageId,
    [string]$PropertyName,
    [bool]$Value
  )
  $body = @{
    properties = @{
      $PropertyName = @{
        checkbox = $Value
      }
    }
  }
  [void](Invoke-Notion -Method Patch -Url "https://api.notion.com/v1/pages/$PageId" -Body $body)
}

function New-PlaylistPageBody {
  param(
    [string]$DatabaseId,
    [string]$Name,
    [string]$PlaylistId,
    [bool]$Enabled,
    [string]$TitleProperty,
    [string]$PlaylistIdProperty,
    [string]$EnabledProperty
  )
  return @{
    parent     = @{ database_id = $DatabaseId }
    properties = @{
      $TitleProperty      = @{
        title = @(
          @{
            type = "text"
            text = @{
              content = $Name
            }
          }
        )
      }
      $PlaylistIdProperty = @{
        rich_text = (New-RichTextValue $PlaylistId)
      }
      $EnabledProperty    = @{
        checkbox = $Enabled
      }
    }
  }
}

function New-MainDatabaseContainerPage {
  param(
    [string]$DatabaseId,
    [object]$Database,
    [string]$Title
  )

  $properties = @{
    Name = @{
      title = @(
        @{
          type = "text"
          text = @{
            content = $Title
          }
        }
      )
    }
  }

  if (Get-DatabaseProperty -Database $Database -PropertyName "Platform") {
    $properties["Platform"] = @{
      rich_text = (New-RichTextValue "container")
    }
  }
  if (Get-DatabaseProperty -Database $Database -PropertyName "Enabled") {
    $properties["Enabled"] = @{
      checkbox = $false
    }
  }
  if (Get-DatabaseProperty -Database $Database -PropertyName "Description") {
    $properties["Description"] = @{
      rich_text = (New-RichTextValue "Automation container page for the Spotify Playlists database.")
    }
  }

  $body = @{
    parent     = @{
      database_id = $DatabaseId
    }
    properties = $properties
  }
  return Invoke-Notion -Method Post -Url "https://api.notion.com/v1/pages" -Body $body
}

if (-not $NotionToken) { $NotionToken = $env:NOTION_TOKEN }
if (-not $NotionDatabaseId) { $NotionDatabaseId = $env:NOTION_DATABASE_ID }
if (-not $PlaylistsDatabaseId) { $PlaylistsDatabaseId = $env:NOTION_PLAYLISTS_DATABASE_ID }
if (-not $PlaylistsDatabaseName) { $PlaylistsDatabaseName = $env:NOTION_PLAYLISTS_DATABASE_NAME }
if (-not $PlaylistsParentPageTitle) { $PlaylistsParentPageTitle = $env:NOTION_PLAYLISTS_PARENT_PAGE_TITLE }
if (-not $PlaylistProperty) { $PlaylistProperty = $env:NOTION_QUEUE_PLAYLIST_PROPERTY }
if (-not $LegacyPlaylistProperty) { $LegacyPlaylistProperty = "Playlist Profile" }
if (-not $PlaylistIdProperty) { $PlaylistIdProperty = $env:NOTION_PLAYLISTS_ID_PROPERTY }
if (-not $PlaylistsEnabledProperty) { $PlaylistsEnabledProperty = $env:NOTION_PLAYLISTS_ENABLED_PROPERTY }
if (-not $ConfigPath) { $ConfigPath = "config/playlist_config.json" }

if (-not $NotionToken) { $NotionToken = Read-Required "NOTION_TOKEN" }
if (-not $NotionDatabaseId) { $NotionDatabaseId = Read-Required "NOTION_DATABASE_ID" }
if (-not $PlaylistsDatabaseName) { $PlaylistsDatabaseName = "Spotify Playlists" }
if (-not $PlaylistsParentPageTitle) { $PlaylistsParentPageTitle = "$PlaylistsDatabaseName Setup" }
if (-not $PlaylistProperty) { $PlaylistProperty = "Playlist" }
if (-not $PlaylistIdProperty) { $PlaylistIdProperty = "Spotify Playlist ID" }
if (-not $PlaylistsEnabledProperty) { $PlaylistsEnabledProperty = "Enabled" }

$script:NotionToken = $NotionToken
$NotionDatabaseId = Normalize-NotionId $NotionDatabaseId
$PlaylistsDatabaseId = Normalize-NotionId $PlaylistsDatabaseId

Write-Host "Loading Notion database metadata..." -ForegroundColor Cyan
$mainDatabase = Invoke-Notion -Method Get -Url "https://api.notion.com/v1/databases/$NotionDatabaseId"

$playlistPropertySchema = Get-DatabaseProperty -Database $mainDatabase -PropertyName $PlaylistProperty
if ($null -eq $playlistPropertySchema) {
  Write-Host "Adding property '$PlaylistProperty' to the main database..." -ForegroundColor Cyan
  $body = @{
    properties = @{
      $PlaylistProperty = @{
        rich_text = @{}
      }
    }
  }
  $mainDatabase = Invoke-Notion -Method Patch -Url "https://api.notion.com/v1/databases/$NotionDatabaseId" -Body $body
  $playlistPropertySchema = Get-DatabaseProperty -Database $mainDatabase -PropertyName $PlaylistProperty
}

$playlistPropertyType = if ($playlistPropertySchema) { [string]$playlistPropertySchema.type } else { "" }
if ($playlistPropertyType -notin @("rich_text", "select", "multi_select")) {
  throw "Property '$PlaylistProperty' exists but has unsupported type '$playlistPropertyType'."
}

$playlistSeeds = @{}
if (Test-Path $ConfigPath) {
  Write-Host "Reading playlist ids from $ConfigPath..." -ForegroundColor Cyan
  $cfg = Get-Content $ConfigPath -Raw | ConvertFrom-Json
  if ($cfg.profiles) {
    foreach ($profileProp in $cfg.profiles.PSObject.Properties) {
      $rawKey = [string]$profileProp.Name
      $displayName = Convert-DisplayName $rawKey
      if (-not $displayName) {
        continue
      }
      $normalized = Get-NormalizedKey $displayName
      $playlistId = ""
      if ($profileProp.Value -and $profileProp.Value.playlist_id) {
        $playlistId = [string]$profileProp.Value.playlist_id
      }
      $playlistSeeds[$normalized] = @{
        name       = $displayName
        playlistId = $playlistId
        enabled    = (-not [string]::IsNullOrWhiteSpace($playlistId))
      }
    }
  }
}

Write-Host "Loading main database rows..." -ForegroundColor Cyan
$mainRows = Get-AllPages $NotionDatabaseId
$legacyBackfill = @()
foreach ($row in $mainRows) {
  $legacyText = Get-PropertyText (Get-PageProperty -Page $row -PropertyName $LegacyPlaylistProperty)
  $legacyNorm = Get-NormalizedKey $legacyText
  if ($legacyNorm) {
    if (-not $playlistSeeds.ContainsKey($legacyNorm)) {
      $playlistSeeds[$legacyNorm] = @{
        name       = (Convert-DisplayName $legacyText)
        playlistId = ""
        enabled    = $false
      }
    }
    $currentPlaylistText = Get-PropertyText (Get-PageProperty -Page $row -PropertyName $PlaylistProperty)
    if ([string]::IsNullOrWhiteSpace($currentPlaylistText)) {
      $legacyBackfill += @{
        pageId = [string]$row.id
        value  = [string]$playlistSeeds[$legacyNorm].name
      }
    }
  }
}

if (-not $PlaylistsDatabaseId) {
  Write-Host "Searching for an existing '$PlaylistsDatabaseName' database..." -ForegroundColor Cyan
  $PlaylistsDatabaseId = Normalize-NotionId (Find-DatabaseIdByName $PlaylistsDatabaseName)
}

if (-not $PlaylistsDatabaseId) {
  $parent = $mainDatabase.parent
  $createParent = switch ([string]$parent.type) {
    "workspace" {
      $containerRow = $null
      $targetNorm = Get-NormalizedKey $PlaylistsParentPageTitle
      foreach ($row in $mainRows) {
        $rowTitle = Get-PropertyText (Get-PageProperty -Page $row -PropertyName "Name")
        if ((Get-NormalizedKey $rowTitle) -eq $targetNorm) {
          $containerRow = $row
          break
        }
      }
      if ($null -eq $containerRow) {
        Write-Host "Creating container row '$PlaylistsParentPageTitle' in the main database..." -ForegroundColor Cyan
        $containerRow = New-MainDatabaseContainerPage -DatabaseId $NotionDatabaseId -Database $mainDatabase -Title $PlaylistsParentPageTitle
      } else {
        Write-Host "Using existing container row '$PlaylistsParentPageTitle'..." -ForegroundColor Cyan
      }
      @{ type = "page_id"; page_id = [string]$containerRow.id }
    }
    "page_id" { @{ type = "page_id"; page_id = [string]$parent.page_id } }
    default { throw "Unsupported Notion parent type '$($parent.type)' for playlists database creation." }
  }

  Write-Host "Creating playlists database '$PlaylistsDatabaseName'..." -ForegroundColor Cyan
  $body = @{
    parent     = $createParent
    title      = @(
      @{
        type = "text"
        text = @{
          content = $PlaylistsDatabaseName
        }
      }
    )
    properties = @{
      Name                  = @{ title = @{} }
      $PlaylistIdProperty   = @{ rich_text = @{} }
      $PlaylistsEnabledProperty = @{ checkbox = @{} }
    }
  }
  $createdDb = Invoke-Notion -Method Post -Url "https://api.notion.com/v1/databases" -Body $body
  $PlaylistsDatabaseId = Normalize-NotionId ([string]$createdDb.id)
}

Write-Host "Loading playlists database rows..." -ForegroundColor Cyan
$playlistRows = @{}
foreach ($row in (Get-AllPages $PlaylistsDatabaseId)) {
  $name = Get-PropertyText (Get-PageProperty -Page $row -PropertyName "Name")
  $normalized = Get-NormalizedKey $name
  if (-not $normalized) {
    continue
  }
  $playlistRows[$normalized] = $row
}

$createdPlaylists = 0
$updatedPlaylists = 0
foreach ($seed in $playlistSeeds.Values | Sort-Object name) {
  $normalized = Get-NormalizedKey $seed.name
  $existing = $playlistRows[$normalized]
  if ($null -eq $existing) {
    Write-Host "Creating playlist row '$($seed.name)'..." -ForegroundColor Cyan
    $body = New-PlaylistPageBody -DatabaseId $PlaylistsDatabaseId -Name $seed.name -PlaylistId $seed.playlistId -Enabled ([bool]$seed.enabled) -TitleProperty "Name" -PlaylistIdProperty $PlaylistIdProperty -EnabledProperty $PlaylistsEnabledProperty
    $created = Invoke-Notion -Method Post -Url "https://api.notion.com/v1/pages" -Body $body
    $playlistRows[$normalized] = $created
    $createdPlaylists += 1
    continue
  }

  $existingId = Get-PropertyText (Get-PageProperty -Page $existing -PropertyName $PlaylistIdProperty)
  $existingEnabled = Get-PropertyCheckbox (Get-PageProperty -Page $existing -PropertyName $PlaylistsEnabledProperty)
  $needsUpdate = ($existingId -ne [string]$seed.playlistId) -or ($existingEnabled -ne [bool]$seed.enabled)
  if ($needsUpdate) {
    Write-Host "Updating playlist row '$($seed.name)'..." -ForegroundColor Cyan
    Update-PageTextProperty -PageId ([string]$existing.id) -PropertyName $PlaylistIdProperty -PropertyType "rich_text" -Value ([string]$seed.playlistId)
    Update-PageCheckboxProperty -PageId ([string]$existing.id) -PropertyName $PlaylistsEnabledProperty -Value ([bool]$seed.enabled)
    $updatedPlaylists += 1
  }
}

$backfilledRows = 0
foreach ($row in $legacyBackfill) {
  Update-PageTextProperty -PageId $row.pageId -PropertyName $PlaylistProperty -PropertyType $playlistPropertyType -Value $row.value
  $backfilledRows += 1
}

Write-Host ""
Write-Host "Playlists database ready." -ForegroundColor Green
Write-Host "NOTION_PLAYLISTS_DATABASE_ID=$PlaylistsDatabaseId" -ForegroundColor Green
Write-Host "playlist_rows_created=$createdPlaylists" -ForegroundColor Green
Write-Host "playlist_rows_updated=$updatedPlaylists" -ForegroundColor Green
Write-Host "main_rows_backfilled=$backfilledRows" -ForegroundColor Green
Write-Host "playlist_property=$PlaylistProperty ($playlistPropertyType)" -ForegroundColor Green
