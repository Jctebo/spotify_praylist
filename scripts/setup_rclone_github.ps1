param(
  [string]$RemoteName = "onedrive",
  [string]$ConfigPath = "$env:APPDATA\rclone\rclone.conf",
  [string]$GitHubRepo,
  [string]$RcloneExe
)

$ErrorActionPreference = "Stop"

function Confirm-YesNo([string]$Prompt, [bool]$DefaultYes = $true) {
  $suffix = if ($DefaultYes) { "[Y/n]" } else { "[y/N]" }
  $raw = Read-Host "$Prompt $suffix"
  if ([string]::IsNullOrWhiteSpace($raw)) { return $DefaultYes }
  $val = $raw.Trim().ToLowerInvariant()
  return $val -in @("y", "yes")
}

function Resolve-RcloneExe([string]$Hint) {
  if (-not [string]::IsNullOrWhiteSpace($Hint) -and (Test-Path $Hint)) { return $Hint }
  $cmd = Get-Command rclone -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidates = @(
    "$env:ProgramFiles\rclone\rclone.exe",
    "$env:ProgramFiles(x86)\rclone\rclone.exe",
    "$env:LOCALAPPDATA\Programs\rclone\rclone.exe",
    "$env:USERPROFILE\scoop\apps\rclone\current\rclone.exe",
    "$env:LOCALAPPDATA\Microsoft\WinGet\Links\rclone.exe"
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) { return $c }
  }
  # WinGet package install fallback (non-linked executable path).
  $wingetPackagesRoot = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages"
  if (Test-Path $wingetPackagesRoot) {
    $found = Get-ChildItem -Path $wingetPackagesRoot -Recurse -Filter "rclone.exe" -ErrorAction SilentlyContinue |
      Select-Object -First 1 -ExpandProperty FullName
    if (-not [string]::IsNullOrWhiteSpace($found) -and (Test-Path $found)) {
      return $found
    }
  }
  return ""
}

function Ensure-RcloneExe([string]$Hint) {
  $exe = Resolve-RcloneExe $Hint
  if (-not [string]::IsNullOrWhiteSpace($exe)) { return $exe }
  Write-Host "rclone not found on PATH."
  if (Confirm-YesNo "Install rclone via winget now?" $true) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
      throw "winget not available. Install rclone manually: https://rclone.org/downloads/"
    }
    winget install --id Rclone.Rclone --exact --accept-package-agreements --accept-source-agreements
    # Refresh PATH for this process from user+machine in case winget updated links.
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath"
    $exe = Resolve-RcloneExe $Hint
    if (-not [string]::IsNullOrWhiteSpace($exe)) { return $exe }
    throw "rclone install completed but executable still not found. Check WinGet install paths and rerun."
  }
  throw "rclone is required. Install from https://rclone.org/downloads/ and rerun."
}

$rcloneExePath = Ensure-RcloneExe $RcloneExe

Write-Host "rclone setup wizard for GitHub Actions secret RCLONE_CONFIG_B64"
Write-Host "Remote name: $RemoteName"
Write-Host "rclone: $rcloneExePath"
Write-Host ""

if (-not (Test-Path $ConfigPath)) {
  Write-Host "No rclone config found at: $ConfigPath"
  Write-Host "Opening rclone config now. Create remote '$RemoteName' (type: onedrive)."
  & $rcloneExePath config
} else {
  $remotes = @(& $rcloneExePath listremotes 2>$null)
  $hasRemote = $false
  foreach ($r in $remotes) {
    if ($r.TrimEnd(":") -eq $RemoteName) { $hasRemote = $true; break }
  }
  if (-not $hasRemote) {
    Write-Host "Remote '$RemoteName' not found."
    Write-Host "Opening rclone config now. Create remote '$RemoteName' (type: onedrive)."
    & $rcloneExePath config
  } elseif (Confirm-YesNo "Reconnect/refresh token for '$RemoteName' now?" $false) {
    & $rcloneExePath config reconnect "${RemoteName}:"
  }
}

if (-not (Test-Path $ConfigPath)) {
  throw "rclone config file not found after setup: $ConfigPath"
}

Write-Host "Validating remote access..."
try {
  & $rcloneExePath lsd "${RemoteName}:" | Out-Null
} catch {
  throw "Remote validation failed for '${RemoteName}:'. Run 'rclone config' and try again."
}

$configText = Get-Content -Raw -Path $ConfigPath
$bytes = [System.Text.Encoding]::UTF8.GetBytes($configText)
$b64 = [System.Convert]::ToBase64String($bytes)

$outDir = Join-Path $PSScriptRoot "..\artifacts"
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
$outFile = Join-Path $outDir "rclone_config_b64.txt"
Set-Content -Path $outFile -Value $b64 -NoNewline -Encoding ascii

try {
  Set-Clipboard -Value $b64
  Write-Host "Copied RCLONE_CONFIG_B64 to clipboard."
} catch {
  Write-Host "Clipboard copy skipped (Set-Clipboard unavailable)."
}

Write-Host "Saved base64 config to: $outFile"
Write-Host ""
Write-Host "Next steps:"
Write-Host "1) Add/update GitHub secret: RCLONE_CONFIG_B64"
Write-Host "2) (Optional) Set vars: RCLONE_REMOTE_NAME=$RemoteName and RCLONE_REMOTE_ROOT=Pictures/Samsung Gallery/DCIM"

if (Get-Command gh -ErrorAction SilentlyContinue) {
  if ([string]::IsNullOrWhiteSpace($GitHubRepo)) {
    $GitHubRepo = (git config --get remote.origin.url 2>$null)
    if (-not [string]::IsNullOrWhiteSpace($GitHubRepo)) {
      if ($GitHubRepo -match "github\.com[:/](.+?)(\.git)?$") {
        $GitHubRepo = $Matches[1]
      }
    }
  }

  if (-not [string]::IsNullOrWhiteSpace($GitHubRepo)) {
    if (Confirm-YesNo "Set secret via gh for repo '$GitHubRepo' now?" $false) {
      $b64 | gh secret set RCLONE_CONFIG_B64 --repo $GitHubRepo
      Write-Host "Secret set: RCLONE_CONFIG_B64"
    }
  }
}
