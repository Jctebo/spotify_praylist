# Spotify Playlist Refresher

Python automation for rebuilding Spotify prayer playlists from repo-owned queue contracts and thin playlist definitions.

## Runtime
- Python 3.11
- Non-interactive Spotify auth via refresh token
- Repo-owned queue contracts in `config/spotify/contracts/*.json`
- Repo-owned playlist identity definitions in `config/spotify/playlists/*.json`
- Checked-in playlist definitions own the Spotify playlist ids and ordered active contract membership

Required variables:
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN`

Optional variables:
- `SPOTIFY_PLAYLIST_NAME` to target one playlist definition by key or display name
- `SPOTIFY_PLAYLIST_ID` to override the selected playlist id for a one-off validation run
- `JOB_UTC_OFFSET` to override the runtime timezone
- `ROMCAL_CALENDAR` and `ROMCAL_LOCALE` to control the liturgical season lookup used by the Marian Antiphon swap
## Publish Pipelines

- `jobs/publish/run_text_pipeline.py` renders repository-owned publish contracts into local artifacts and episode state.
- `jobs/publish/run_audio_pipeline.py` builds date-scoped audio, JSON sidecars, the archive index, and `docs/podcast.xml` from the same local contracts.
- `jobs/novena_contracts/` owns contract-driven novena generation, audio artifacts, and RSS publication.
- Spotify playlist refresh uses checked-in playlist definitions and queue contracts; it needs only Spotify credentials.
- GitHub Pages serves a responsive daily prayer homepage built from the checked-in Spotify playlists, with a current devotional phone wallpaper when available, plus the existing podcast RSS and cover art. The prayer directory, calendar publisher, and devotional infographic publisher are retired.

## Files
- `.agents/skills/normalize-prayer-tts/`: preview-only prayer TTS audit skill for expanding supported abbreviations, separating Versicle/Response voices, converting intention directions into bell/pause controls, and flagging ambiguous print artifacts for review; run it with `python .agents/skills/normalize-prayer-tts/scripts/normalize_prayer_tts.py <path> --format auto`, or audit every novena contract read-only with `python .agents/skills/normalize-prayer-tts/scripts/normalize_prayer_tts.py contracts/novenas --format auto`
- `jobs/playlist/refresh_playlist.py`: active Spotify refresh runtime driven by checked-in playlist definitions and ordered queue contracts
- `jobs/playlist/spotify_contracts.py`: loader and validation for `config/spotify/contracts/*.json` and `config/spotify/playlists/*.json`
- `config/spotify/contracts/*.json`: one resolver-backed, fixed-URI, or `spotify_episode_lookup` queue contract per file; the three Marian Antiphon Spotify contracts resolve the daily Ora Pro Nobis episode through ordered lookup searches
- `config/spotify/playlists/*.json`: playlist definitions with playlist identity plus checked-in active contract arrays
- `config/legacy/playlist_config.json`: legacy reference config kept off the active runtime path
- `jobs/publish/*.py`: local contract-driven text, audio, state, and RSS publishing
- `jobs/publish/liturgical_announcement.py`: deterministic Romcal-backed liturgical/date announcement block used by Auxilium Christianorum without requiring OpenAI or Gospel text
- `jobs/publish/saint_centered_theme.py`: deterministic D-3..D+9 calendar-window resolver and saint-centered theme brief used by every generated prayer experience
- `jobs/publish/daily_liturgical_context.py`: compatibility context adapter exposing the approved saint-centered brief to existing generated prayer/reflection builders
- `jobs/publish/offline_lectionary.py`: repository-owned citation and Douay-Rheims fallback used only after live Gospel sources fail
- `jobs/publish/ignatian_reflection.py`: model-led Daily Reflection generation with listener-facing safety validation, deterministic fallback narration, and paragraph-based pause timing
- `jobs/publish/fragments.py`: fragment-level cache and assembly helpers for publish audio
- `scripts/setup_spotify.ps1`: Spotify credential wizard that also updates `config/spotify/playlists/*.json`
- `scripts/run_daily_refresh_local.ps1`: local mirror of `.github/workflows/daily.yml` with optional single-playlist targeting

- `.github/workflows/daily.yml`: manual + scheduled Spotify refresh workflow; the daily 07:00 UTC run is gated by `SPOTIFY_REFRESH_SCHEDULE_ENABLED`
- `.github/workflows/publish_audio.yml`: combined publish workflow for Morning Prayer audio and novena publishing, scheduled daily and also available on manual dispatch with `novena_publish_mode=daily` as the default choice; `bootstrap-no-cache` rebuilds audio without using the cache, and `targeted-novena-repair` rebuilds selected novena dates from `novena_repair_contract_id` and `novena_repair_dates` while skipping daily audio
- `config/site/`: static daily prayer home, responsive styles, and Spotify playlist rendering for the podcast Pages deployment
- `scripts/build_pages_artifact.py`: validates Spotify queue contracts and assembles the Pages artifact with the feed, cover art, and optional current wallpaper

## Config Timezone
- `jobs/playlist/refresh_playlist.py` uses `JOB_UTC_OFFSET` for all date-based episode selection.
- Default runtime offset is CST (`-06:00`) when `JOB_UTC_OFFSET` is unset.
- Spotify playlist definitions carry playlist identity only; timezone does not live in the Spotify config files.

### Offline Lectionary Fallback

Daily Gospel lookup keeps the existing live source order (`catholic-mass-readings`, then USCCB HTML) and finally checks the repository-owned files under `config/publish/offline/`. The offline catalog stores lectionary citations separately from the public-domain Original Douay-Rheims passage cache, and fallback contexts identify themselves as `offline-douay-rheims` rather than claiming USCCB/NAB wording.

The checked-in data contains 730 daily entries for 2026–2027 and 1,552 cached citation passages. The builder can populate another reviewed range from the Catholic Readings API and the Original Douay-Rheims API:

```powershell
python scripts/build_offline_lectionary_cache.py config/publish/offline/lectionary.json config/publish/offline/douay-rheims.json --populate-years 2026 2027
```

The generated catalog preserves the modern lectionary citation while resolving known Douay-Rheims numbering differences (including Vulgate psalms). Validate an input pair with:

```powershell
python scripts/build_offline_lectionary_cache.py config/publish/offline/lectionary.json config/publish/offline/douay-rheims.json
```

The source cache uses the General Roman Calendar and English only in this release. Missing local dates remain transparent failures and continue to respect `allow_missing_gospel`.

## Spotify Contract Model
Queue contract files in `config/spotify/contracts/` own:
- `key`
- `name`, a human-readable label used in resolver status and logs
- exactly one of `resolver` or `spotify_uri` for ordinary contracts
- `spotify_episode_lookup` for date-scoped podcast episode matching by show id, required name terms, ordered date formats, and optional ordered search profiles
- optional `fallback_resolver`
- optional `weekdays`

`spotify_episode_lookup` contracts own the Spotify show id, match episode names, require every configured term, and try date formats/search profiles in order until the first search returns matches.

Auxilium Christianorum, Daily Rosary, and Daily Examen contracts resolve generated Ora Pro Nobis episodes by title and date. Their local contract names are descriptive labels only.


The runtime validates the selected definitions and all referenced contracts before any Spotify write. Invalid JSON, duplicate keys/names, invalid playlist IDs, unknown contract keys, invalid weekdays, or invalid resolver/direct-URI shapes stop the run.
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
# Optional single-playlist run:
$env:SPOTIFY_PLAYLIST_NAME = "morning"
# Optional single-run override:
$env:SPOTIFY_PLAYLIST_ID = "spotify:playlist:..."
$env:JOB_UTC_OFFSET = "-06:00"
```

4. Review `config/spotify/contracts/*.json` and `config/spotify/playlists/*.json`.
5. Run either:

```bash
python -m jobs.playlist.refresh_playlist
```

or:

```powershell
.\scripts\run_daily_refresh_local.ps1 -SpotifyPlaylistName morning
```

Expected behavior:
- refreshes the Spotify access token each run
- loads and validates playlist definitions and queue contracts before touching Spotify
- applies contract-level weekday gating such as Sunday-only or Friday-only items
- resolves each contract through its explicit `resolver`, `spotify_uri`, or `spotify_episode_lookup`
- resolves `spotify_episode_lookup` contracts by matching the show id, ordered search profiles, required name terms, and configured date variants against Spotify episode titles
- replaces each selected playlist contents with the resolved queue
- prints one summary per playlist: `playlist`, `playlist_id`, and `tracks_written`, plus `source=playlist_contracts`
- exits non-zero on invalid contracts, invalid playlist definitions, invalid single-playlist overrides, or unresolved selected runs

## Portable Development Container
This repository includes a VS Code Dev Container for developing from multiple machines without changing the deployment path.

Use it when you want a consistent Python 3.11 environment with dependencies installed inside Docker while the source code remains mounted from your local checkout.

Prerequisites:
- Docker Desktop or another Docker engine
- VS Code with the Dev Containers extension, or another editor that supports `.devcontainer/devcontainer.json`

Open the repo in the container:

```text
VS Code -> Command Palette -> Dev Containers: Reopen in Container
```

The dev container:
- mounts the local checkout into `/workspaces/spotify_praylist`
- installs `requirements.txt` after creation
- stores generated cache/audio/image outputs under the mounted `./artifacts/container` folder via `/data`
- configures unittest discovery for `tests/test_*.py`
- does not change GitHub Actions or any existing deployment workflow

Run tests inside the dev container:

```bash
python -m unittest discover -s tests -p "test_*.py"
```

Run the default Spotify refresh inside the dev container:

```bash
python -m jobs.playlist.refresh_playlist
```

## Container Deployment
This app is packaged as a one-shot job container. It does not expose an HTTP port; a scheduler runs the image, the selected job does its work, and the container exits non-zero if the job fails.

The default container command refreshes Spotify playlists:

```bash
python -m jobs.playlist.refresh_playlist
```

Build the deployment image locally:

```bash
docker build -t spotify-praylist:local .
```

Run the default Spotify playlist refresh locally:

```bash
docker run --rm --env-file .env spotify-praylist:local
```

Run a single playlist:

```bash
docker run --rm --env-file .env -e SPOTIFY_PLAYLIST_NAME=morning spotify-praylist:local
```

Run another job by overriding the command:

```bash
docker run --rm --env-file .env -v "$PWD/artifacts/container:/data" spotify-praylist:local python -m jobs.publish.run_text_pipeline
docker run --rm --env-file .env -v "$PWD/artifacts/container:/data" spotify-praylist:local python -m jobs.publish.run_audio_pipeline
```

Run with Docker Compose locally:

```bash
docker compose run --rm playlist-refresh
```

Other job entrypoints are available as Compose profiles:

```bash
docker compose --profile test run --rm tests
```

Use a registry image with Compose:

```bash
SPOTIFY_PRAYLIST_IMAGE=ghcr.io/<owner>/<repo>:latest docker compose run --rm playlist-refresh
```

Publish the image:
- `.github/workflows/container.yml` builds and publishes the image to GitHub Container Registry as `ghcr.io/<owner>/<repo>:latest` on pushes to `main`.
- The same workflow also publishes immutable SHA tags like `ghcr.io/<owner>/<repo>:sha-<commit>`.
- Run the workflow manually from GitHub Actions if you want to publish without changing app code.

Deploy the image:
- Use any job scheduler that can run a container, such as GitHub Actions container jobs, Kubernetes CronJob, Azure Container Apps jobs, AWS ECS scheduled tasks, or a VM cron calling `docker run`.
- Inject secrets at runtime; do not bake `.env` into the image.
- Mount persistent storage at `/data` for jobs that generate cache/audio/image files.
- Use `JOB_UTC_OFFSET=-06:00` or another explicit offset so date-sensitive jobs behave consistently.

Container implementation notes:
- [Dockerfile](c:/Users/jcteb/Code/spotify_praylist/Dockerfile) uses Python 3.11, installs `requirements.txt`, copies the app, and defaults to `python -m jobs.playlist.refresh_playlist`.
- The runtime image runs as an unprivileged `app` user.
- `.devcontainer/` is for portable development; the root `Dockerfile` is the deployable runtime image.
- `.dockerignore` excludes local secrets, caches, virtual environments, and generated artifacts from the image build context.
- `compose.yaml` mounts `./artifacts/container` to `/data` for generated audio/image/cache outputs.
- The image sets Linux-safe defaults for `USERPROFILE`, `PAGE_AUDIO_CACHE_DIR`, `PAGE_AUDIO_LIBRARY_DIR`, `NOVENA_AUDIO_LIBRARY_DIR`, and `DEVOTIONAL_ONEDRIVE_DCIM_DIR`; override them with environment variables if you mount a different output path.

## GitHub Actions Setup
1. Push this project to a GitHub repository.
2. In GitHub, open `Settings -> Secrets and variables -> Actions` and add:
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN`

3. Add optional variables:
- `JOB_UTC_OFFSET`
- `SPOTIFY_REFRESH_SCHEDULE_ENABLED`

Workflow behavior:
- `workflow_dispatch` accepts an optional `spotify_playlist_name` input for one playlist.
- Scheduled runs execute only when `SPOTIFY_REFRESH_SCHEDULE_ENABLED` is `true`.

Recommended rollout:
1. Run one manual workflow dispatch with `spotify_playlist_name=morning`.
2. Confirm the expected checked-in contract order appears in the Spotify playlist.
3. Set `SPOTIFY_REFRESH_SCHEDULE_ENABLED=true` to enable the daily schedule.
## Local Job Mirrors
Run local equivalents of the supported scheduled jobs:

```powershell
.\scripts\run_daily_refresh_local.ps1
python -m jobs.publish.run_audio_pipeline
```

## Daily Prayer Home

The GitHub Pages root shows the daily prayer home with ordered Morning, Midmorning, Midday, Mid-afternoon, Evening, Night, and Mass and Homilies Spotify playlists. Each prayer links to its Spotify destination, and the full playlist is linked from each group. Today's phone wallpaper is included when available; otherwise the page uses a branded background. The podcast remains at `https://jctebo.github.io/spotify_praylist/podcast.xml`, with its cover image at `/images/logo_ora_pro_nobis.png`. No prayer directory is published.

## Devotional Wallpapers

The independent OneDrive wallpaper pipeline remains available. Its scheduled workflow is `.github/workflows/daily_devotional_wallpapers.yml`; local runs use `scripts/run_devotional_wallpapers_local.ps1` with the existing rclone profile/configuration. The Pages workflow uses `RCLONE_CONFIG_B64`, `RCLONE_REMOTE_NAME`, and `RCLONE_REMOTE_ROOT` to copy only today's phone image from OneDrive's `phone-current` folder. That image is public at `/images/daily-wallpaper.<extension>`; watch images, queues, and archives are not published.

## Local Test Framework
Run the offline unit test suite (no live Spotify API calls):

```powershell
.\scripts\run_local_tests.ps1
```

Verbose mode:

```powershell
.\scripts\run_local_tests.ps1 -VerboseOutput
```

Coverage:
- `jobs/playlist/refresh_playlist.py` main flow and playlist recreate chunking (`PUT/POST /items`)
- GitHub Pages deployment artifact generation for the daily prayer home, optional wallpaper, and podcast assets
- `jobs/publish/run_audio_pipeline.py` contract-driven episode output and local state behavior

## Setup Scripts
Use the Spotify setup script (separate from `run_*` job mirrors):

```powershell
.\scripts\setup_spotify.ps1
```

## Documentation
- [Local episode contracts](docs/architecture/local-episode-contracts.md)
- [Publish and feed-retention architecture](docs/architecture/publish-audio-feed-retention.md)
- [Morning Prayer publishing architecture](docs/architecture/morning-prayer-redesign.md)
- [Publishing roadmap (archived)](docs/roadmaps/publish-content.md)
- [Release history](docs/releases/RELEASE_LOG.md)
- [Current release record](docs/releases/0.4.21.0-divine-office-playlist-distribution.md)

## Notes
- Do not commit secrets.
- Script prints a non-zero exit code on failures so Actions fails visibly.
