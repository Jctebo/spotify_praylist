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
- `requirements.txt`: Python dependencies
- `.github/workflows/daily.yml`: daily + manual GitHub Actions workflow

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

## Notes
- Do not commit secrets.
- Script prints a non-zero exit code on failures so Actions fails visibly.
