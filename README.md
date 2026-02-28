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
- `refresh_playlist.py`: main script (token refresh + playlist update)
- `sync_notion_completions.py`: hourly sync to mark Notion prayer rows as completed from Spotify listening
- `notion_spotify_sync_config.json`: mapping rules from Spotify item text -> Notion row name
- `requirements.txt`: Python dependencies
- `.github/workflows/daily.yml`: daily + manual GitHub Actions workflow
- `.github/workflows/hourly_notion_sync.yml`: hourly + manual Notion completion sync workflow

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
python refresh_playlist.py
```

Expected behavior:
- refreshes Spotify access token each run
- clears existing streaming items from the target playlist (local files preserved)
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

How matching works:
- script reads recent Spotify listening history (default last 3 hours)
- script reads `notion_spotify_sync_config.json`
- if any `match_any` term is found in recent Spotify item text, the matching Notion row (`notion_name`) is marked completed
- script only checks rows; it does not uncheck rows

Required for this script:
- Spotify token must include `user-read-recently-played` scope
- `NOTION_TOKEN` secret
- `NOTION_DATABASE_ID` secret (recommended)

Optional variables/secrets:
- `NOTION_DATABASE_NAME` (fallback lookup; default `Opus Dei`)
- `NOTION_TITLE_PROPERTY` (default `Name`)
- `NOTION_COMPLETED_PROPERTY` (default `Completed`)
- `SPOTIFY_RECENT_LOOKBACK_HOURS` (default `3`, range `1-24`)
- `SPOTIFY_NOTION_SYNC_CONFIG` (default `notion_spotify_sync_config.json`)

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
3. Ensure your Notion integration is connected to the `Opus Dei` database.
4. Run `.github/workflows/hourly_notion_sync.yml` manually once to validate mappings.

## Notes
- Do not commit secrets.
- Script prints a non-zero exit code on failures so Actions fails visibly.
