# Spotify Playlist Refresher

Python project for refreshing a Spotify playlist daily using GitHub Actions.

## Runtime
- Python 3.11
- Non-interactive auth via refresh token
- Config via environment variables only

Required variables:
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN`
- `SPOTIFY_PLAYLIST_ID`

Optional variables:
- `SPOTIFY_USER_ID` (compatibility only)
- `SPOTIFY_PLAYLIST_PROFILE` (`morning`, `midday`, or `night`; default `morning`)

## Files
- `jobs/playlist/refresh_playlist.py`: main script (token refresh + playlist update)
- `jobs/notion/sync_notion_completions.py`: hourly sync to mark Notion prayer rows as completed from Spotify listening
- `jobs/notion/reset_notion_completions.py`: daily reset to uncheck all Notion completion checkboxes
- `config/playlist_config.json`: playlist/profile/show configuration
- `config/notion_spotify_sync_config.json`: mapping rules from Spotify item text -> Notion row name
- `scripts/setup_spotify.ps1`: Spotify setup + refresh-token wizard
- `scripts/setup_notion.ps1`: Notion token/database setup + API validation
- `scripts/run_daily_refresh_local.ps1`: local mirror of `.github/workflows/daily.yml`
- `scripts/run_hourly_notion_sync_local.ps1`: local mirror of `.github/workflows/hourly_notion_sync.yml`
- `scripts/run_daily_notion_reset_local.ps1`: local mirror of `.github/workflows/daily_notion_reset.yml`
- `requirements.txt`: Python dependencies
- `.github/workflows/daily.yml`: daily + manual GitHub Actions workflow
- `.github/workflows/hourly_notion_sync.yml`: hourly + manual Notion completion sync workflow
- `.github/workflows/daily_notion_reset.yml`: daily + manual Notion completion reset workflow

## Config Timezone
- `config/playlist_config.json` supports top-level `utc_offset` (example `-06:00`).
- `JOB_UTC_OFFSET` can override offset at runtime for both daily refresh and hourly sync.
- `jobs/playlist/refresh_playlist.py` uses this for all date-based episode selection.
- Default is CST (`-06:00`) when not set.

## Local Setup
1. Create and activate a virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Set environment variables in your shell.

PowerShell example:

```powershell
$env:SPOTIFY_CLIENT_ID = "..."
$env:SPOTIFY_CLIENT_SECRET = "..."
$env:SPOTIFY_REFRESH_TOKEN = "..."
$env:SPOTIFY_PLAYLIST_ID = "..."
# Optional:
$env:SPOTIFY_USER_ID = "..."
$env:SPOTIFY_PLAYLIST_PROFILE = "morning"
```

4. Run:

```bash
python jobs/playlist/refresh_playlist.py
```

Expected behavior:
- refreshes Spotify access token each run
- replaces the target playlist contents with resolved items from the selected profile
- writes resolved items from the selected profile
- prints summary: `playlist_id` and `tracks_written`
- exits non-zero on error

## GitHub Actions Setup
1. Push this project to a GitHub repository.
2. In GitHub: `Settings -> Secrets and variables -> Actions -> New repository secret`
3. Add secrets (exact names):
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN`
- `SPOTIFY_PLAYLIST_ID`
- `SPOTIFY_USER_ID` (optional)

If you want a non-default profile in Actions, add repository variable `SPOTIFY_PLAYLIST_PROFILE` (or hardcode in workflow env).

Workflow triggers:
- daily schedule (UTC cron in `.github/workflows/daily.yml`)
- manual run via `workflow_dispatch`

## Hourly Notion Completion Sync
Purpose:
- updates existing rows in your Notion `Opus Dei` database by checking `Completed` when Spotify listening matches configured prayer mappings
- quiet-hours guard: hourly sync skips between 11:00 PM and 4:00 AM (job local time from `JOB_UTC_OFFSET` or `config/playlist_config.json` `utc_offset`)

How matching works:
- script reads recent Spotify listening history (default last 3 hours)
- script reads `config/notion_spotify_sync_config.json`
- if any `match_any` term is found in recent Spotify item text, the matching Notion row (`notion_name`) is marked completed
- script only checks rows; it does not uncheck rows
- rows with platform value `Spotify-TimeSync` are currently ignored (feature removed)

Required for this script:
- Spotify token must include `user-read-recently-played` scope
- Spotify token should also include `user-read-currently-playing` scope
- `NOTION_TOKEN` secret
- `NOTION_DATABASE_ID` secret (recommended)

Optional variables/secrets:
- `NOTION_DATABASE_NAME` (fallback lookup; default `Opus Dei`)
- `NOTION_TITLE_PROPERTY` (default `Name`)
- `NOTION_COMPLETED_PROPERTY` (default `Completed`)
- `NOTION_PLATFORM_PROPERTY` (default `Platform`, used by daily refresh URI sync)
- `NOTION_PLATFORM_SPOTIFY_VALUE` (default `spotify`, case-insensitive filter)
- `NOTION_PLATFORM_NOSYNC_VALUE` (default `spotify-nosync`, skip automation)
- `NOTION_URI_PROPERTY` (default `URI`, used for URI-based completion matching)
- `SPOTIFY_RECENT_LOOKBACK_HOURS` (default `3`, range `1-24`)
- `SPOTIFY_NOTION_SYNC_CONFIG` (default `config/notion_spotify_sync_config.json`)
- `JOB_UTC_OFFSET` (optional runtime override for local/GitHub job timezone offset, e.g. `-06:00`)

GitHub setup for hourly workflow:
1. Add secrets:
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN`
- `NOTION_TOKEN`
- `NOTION_DATABASE_ID` (recommended)
2. Add optional repository variables:
- `NOTION_DATABASE_NAME`
- `NOTION_TITLE_PROPERTY`
- `NOTION_COMPLETED_PROPERTY`
- `SPOTIFY_RECENT_LOOKBACK_HOURS`
- `JOB_UTC_OFFSET`
3. Ensure your Notion integration is connected to the `Opus Dei` database.
4. Run `.github/workflows/hourly_notion_sync.yml` manually once to validate mappings.

## Daily Notion Reset
Purpose:
- unchecks all rows in your Notion `Completed` checkbox column so each day starts fresh

Workflow:
- `.github/workflows/daily_notion_reset.yml`
- schedule: `0 10 * * *` (04:00 CST / 05:00 CDT)

Required:
- `NOTION_TOKEN` secret
- `NOTION_DATABASE_ID` secret (recommended)

Optional variables:
- `NOTION_DATABASE_NAME` (fallback lookup; default `Opus Dei`)
- `NOTION_COMPLETED_PROPERTY` (default `Completed`)

## Local Job Mirrors
Run local equivalents of each GitHub Action workflow:

```powershell
# Daily refresh workflow mirror
.\scripts\run_daily_refresh_local.ps1

# Hourly notion sync workflow mirror
.\scripts\run_hourly_notion_sync_local.ps1

# Daily notion reset workflow mirror
.\scripts\run_daily_notion_reset_local.ps1
```

## Local Test Framework
Run the offline unit test suite (no live Spotify/Notion API calls):

```powershell
.\scripts\run_local_tests.ps1
```

Verbose mode:

```powershell
.\scripts\run_local_tests.ps1 -VerboseOutput
```

Coverage:
- `jobs/playlist/refresh_playlist.py` main flow and playlist recreate chunking (`PUT/POST /items`)
- `jobs/notion/sync_notion_completions.py` main flow, quiet-hours short-circuit, and strict URI row matching
- `jobs/notion/reset_notion_completions.py` checkbox reset behavior and schema error handling

## Setup Scripts
Use setup scripts (separate from `run_*` job mirrors):

```powershell
.\scripts\setup_spotify.ps1
.\scripts\setup_notion.ps1
```

## Notes
- Do not commit secrets.
- Script prints a non-zero exit code on failures so Actions fails visibly.
