# Spotify Playlist Refresher

Python automation for rebuilding Spotify prayer playlists from repo-owned queue contracts and thin playlist definitions.

## Runtime
- Python 3.11
- Non-interactive Spotify auth via refresh token
- Repo-owned queue contracts in `config/spotify/contracts/*.json`
- Repo-owned playlist identity definitions in `config/spotify/playlists/*.json`
- Notion `Opus Dei` rows own active playlist membership and order

Required variables:
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN`
- `NOTION_TOKEN`

Optional variables:
- `SPOTIFY_PLAYLIST_NAME` to target one playlist definition by stable key or display name
- `SPOTIFY_PLAYLIST_ID` to override the selected playlist definition's playlist id for a one-off validation run
- `SPOTIFY_USER_ID` for compatibility with older local setups
- `JOB_UTC_OFFSET` to override the runtime timezone
- `ROMCAL_CALENDAR` and `ROMCAL_LOCALE` to control the liturgical season lookup used by the Marian Antiphon swap
- `NOTION_DATABASE_ID` or `NOTION_DATABASE_NAME` for the `Opus Dei` membership/order database
- related Notion variables for optional post-write sync behavior

## Publish Pipelines
### Text
- `jobs/publish/run_text_pipeline.py`: contract-driven Notion text publication for `config/publish/contracts/*.json`
- `config/publish/contracts/*.json`: shared Morning Prayer, Auxilium Christianorum, Marian Antiphon, and Rosary publish contracts with a single entry-based schema
- `config/publish/templates/...`: reusable prayer text assets and Rosary mystery text assets referenced by the contracts
- `config/publish/contracts/auxilium-christianorum.json`: Ora Pro Nobis Auxilium Christianorum lay-member daily episode contract built from reusable prayer templates and a weekday-specific prayer map
- `config/publish/templates/auxilium-christianorum/*.txt`: source-attributed lay-member Auxilium Christianorum prayer templates from the official daily prayer PDF; priest-only prayers are intentionally excluded
- `jobs/notion/generate_page_audio.py`: archived page-audio runtime retained only for older Morning Prayer workflows
- `NOTION_PUBLISH_DATABASE_ID` or `NOTION_DATABASE_NAME` for the new publish-text Notion target, which upserts page titles on the `Opus Dei` database and writes the prayer text into the page body
- For local OpenAI runs, copy `config/local/openai.env.example` to `config/local/openai.env` and fill in `OPENAI_API_KEY`; the publish-text helper will read that file automatically, and you can override the path with `OPENAI_API_KEY_FILE`
- `Publish Prayer Text` now runs after `Daily Spotify Playlist Refresh` completes successfully on `main`, plus manual dispatches

### Audio
- `jobs/publish/run_audio_pipeline.py`: contract-driven audio publication that writes date-scoped `docs/audio/<episode_id>.mp3` files and refreshes `docs/podcast.xml`
- `jobs/publish/fragments.py`: fragment cache and ffmpeg assembly helpers used by the publish audio path
- publish audio caches leaf fragments under `.cache/publish_audio/` so unchanged spoken blocks can be reused across reruns, and GitHub Actions persists that cache across workflow runs
- publish audio writes one JSON sidecar per episode under `docs/audio/`, including ordered `resume_markers` for fragment-level resume/bookmark surfaces; reruns now rebuild the feed from the local `docs/audio/` archive snapshot rather than the remote published feed
- the publish workflow also writes `docs/audio/index.html` and `docs/audio/index.json` so GitHub Pages exposes a browsable archive dashboard alongside the feed
- Auxilium Christianorum publishes as its own daily Ora Pro Nobis episode with a deterministic liturgical announcement, the lay-member every-day prayers, the correct weekday prayer, the Litany of the Most Precious Blood, and the daily conclusion
- Auxilium Christianorum and Marian Antiphon episodes use deterministic `prayer_intro` bridge blocks so the liturgical day announcement flows into the prayer with one concise day-theme transition sentence.
- Auxilium Christianorum response markers are normalized into clean spoken fragments: printed `V.` and `R.` labels are omitted, response boundaries become normal fragment pauses, and short versicle/response fragments can use role-specific TTS voices
- Daily Rosary publishes as its own date-scoped Ora Pro Nobis episode with the traditional weekday mysteries, a short title focus such as a feast day or `Today's Gospel`, a generated 3-4 sentence Rosary intro, five full decades, one daily reflection per mystery using structured feast-grounded, Gospel-grounded, season-grounded, or deterministic fallback generation, and cached canonical prayer fragments for repeated prayers such as `Our Father`, `Hail Mary`, `Glory Be`, and `Fatima Prayer`; final episode sidecars record the reflection source so feast-day fallback remains auditable.
- Marian Antiphon publish audio contracts are season-gated: the ordinary-season Angelus contract and the Easter-season Regina Caeli contract each render their own daily episode while reusing the shared daily intro and sign-of-cross templates; both episode titles include `Marian Antiphon` so Spotify lookup can target one durable title marker across seasons
- Publish-audio episodes use centralized seasonal audio branding from `config/publish/audio_branding.json`, with seasonal MP3 assets stored under `config/publish/audio/`; the current required assets are `Advent Podcast.mp3`, `Christmas Podcast.mp3`, `Ordinary Time Podcast.mp3`, `Lent Podcast.mp3`, `Holy Week Podcast.mp3`, and `Easter Podcast.mp3`
- Publish-audio and novena episodes normalize the final assembled MP3 to the shared podcast loudness target (`-16 LUFS`, `-1.5 dBTP`, `11 LRA`) after fragment assembly by default; individual contracts can override or disable `loudness_normalization` when a specific episode family needs different mastering.
- `scripts/run_morning_prayer_elevenlabs_local.py`: step-by-step local smoke helper that loads `config/local/elevenlabs.env`, renders only the Morning Prayer ElevenLabs variant, and writes local feed/archive artifacts under `artifacts/local/elevenlabs/`
- `ELEVENLABS_API_KEY` for ElevenLabs-first publish audio, including Morning Prayer, Auxilium Christianorum, Marian Antiphons, Rosary, and novena audio in local runs or GitHub Actions; OpenAI remains the configured fallback where provider lists include it
- `config/publish/images/logo_ora_pro_nobis.png`: podcast cover art copied into the published `docs/images/` tree
- To replace future seasonal music, overwrite the matching MP3 in `config/publish/audio/` or update the path in `config/publish/audio_branding.json`; missing assets log a warning and publish the spoken episode without music.
- `PUBLISH_GITHUB_PAGES_BASE_URL` to override the RSS enclosure base URL when publishing audio
- `PUBLISH_PODCAST_FEED_URL` to override the remote `podcast.xml` archive URL when publishing audio
- `Publish Prayer Audio` now runs at `06:00 UTC`, and `Daily Spotify Playlist Refresh` runs at `05:00 UTC`, `13:00 UTC`, and `21:00 UTC`, on `main`, on pushes to `main`, plus manual dispatches

### Novena
- `jobs/novena_contracts/pipeline.py`: contract-first novena publishing that resolves the active novena from today's date, renders content, writes a JSON sidecar, and rebuilds RSS
- `contracts/novenas/templates/*.json`: reusable novena templates, including the shared `standard-9-day` template
- `contracts/novenas/families/*.json`: selector-based family contracts that auto-populate eligible celebrations from the liturgical calendar
- `contracts/novenas/feast-days/*.json`: explicit feast-day overrides keyed by Romcal ids
- `scripts/new_novena_contract.py`: helper for authoring explicit feast contracts or selector-based family contracts
- `scripts/new_novena_url_contract.py`: local URL importer for Catholic Novena App pages; `single` imports one novena page and `bulk` walks the catalog page, writing generated drafts plus reports under `artifacts/novena-url-overrides/`
- `scripts/run_traditional_novena_import_local.py`: local batch runner that defaults to the July and August Traditional Novena catalog slices and writes month-specific bulk reports under `artifacts/novena-url-overrides/traditional-novena-july-august/`
- The URL importer pulls the live prayer body from the novena page and embeds it into `novena.template`; repeated novena days are compacted into shared blocks, and canonical prayers such as `Our Father`, `Hail Mary`, and `Glory Be` are stored once in a fragment library so the TTS renderer can reuse them across days
- The URL importer can optionally normalize instruction-heavy sections with OpenAI for TTS-friendly output; those rewrites are recorded on each section as `notes`
- Before the model runs, the importer expands canonical prayer names like `Our Father`, `Hail Mary`, and `Glory Be` from the repo's Rosary text templates, then compacts identical day blocks into shared blocks tagged with the day numbers they cover so the TTS renderer can reuse one prayer block behind a small day-specific intro
- Imported traditional novenas publish with a `Traditional Novena to {saint_name} Day {day} - {date_display}` episode title so they stay distinct from the existing auto-generated novena titles while showing the publish date in the RSS title
- For local OpenAI runs, copy `config/local/openai.env.example` to `config/local/openai.env` and fill in `OPENAI_API_KEY`; the importer will read that file automatically, and you can override the path with `OPENAI_API_KEY_FILE`
- Novena contracts now support a top-level `enabled` flag; `enabled: false` contracts stay loadable for review but are skipped by the novena runtime
- Run the July/August traditional novena import locally with `python scripts/run_traditional_novena_import_local.py`; pass repeated `--month` values if you need a different batch window.
- `.github/workflows/publish_audio.yml`: combined publish workflow that runs Morning Prayer audio and novena publishing together, scheduled daily and also available on manual dispatch; manual runs default to `daily`, which publishes tomorrow's slice and preserves the existing feed, `bootstrap` seeds today and tomorrow without truncating the feed, `bootstrap-no-cache` seeds today and tomorrow while forcing a rebuild of the audio outputs, and `reset` seeds today and tomorrow after clearing the existing feed
- The combined publish workflow currently targets MP3, JSON sidecars, and RSS. Spotify playlist assignment and Notion updates stay out of scope for this release.

### RSS Pages
- Site root landing page: `https://jctebo.github.io/spotify_praylist/`
- Feed file: `docs/podcast.xml`
- Audio enclosures: `docs/audio/*.mp3`
- Public feed URL on GitHub Pages: `https://jctebo.github.io/spotify_praylist/podcast.xml`
- Public audio URL pattern on GitHub Pages: `https://jctebo.github.io/spotify_praylist/audio/<episode_id>.mp3`

## Files
- `jobs/playlist/refresh_playlist.py`: active Spotify refresh runtime with Notion-owned membership/order
- `jobs/playlist/spotify_contracts.py`: loader and validation for `config/spotify/contracts/*.json` and `config/spotify/playlists/*.json`
- `config/spotify/contracts/*.json`: one resolver-backed, fixed-URI, or `spotify_episode_lookup` queue contract per file; the three Marian Antiphon Spotify contracts resolve the daily Ora Pro Nobis episode through ordered lookup searches
- `config/spotify/playlists/*.json`: thin playlist definitions with playlist identity only
- `config/legacy/playlist_config.json`: legacy reference config kept off the active runtime path
- `config/custom_tts/morning-prayer.json`: canonical Morning Prayer custom TTS contract for the active page-audio surface
- `config/legacy/page_audio/*.json`, `config/legacy/rosary.json`, and `config/legacy/auxilium_daily_text.json`: discontinued top-level page-audio contracts retained only as archives; the active runtime no longer loads them
- `jobs/publish/*.py`: new generic publish boundary for Notion text and GitHub Pages audio outputs
- `jobs/publish/liturgical_announcement.py`: deterministic Romcal-backed liturgical/date announcement block used by Auxilium Christianorum without requiring OpenAI or Gospel text
- `jobs/publish/fragments.py`: fragment-level cache and assembly helpers for publish audio
- `scripts/setup_spotify.ps1`: Spotify credential wizard that also updates `config/spotify/playlists/*.json`
- `scripts/run_daily_refresh_local.ps1`: local mirror of `.github/workflows/daily.yml` with optional single-playlist targeting
- `scripts/setup_notion_playlists.ps1`: legacy Notion playlist-registry helper, no longer on the active Spotify hot path
- `.github/workflows/daily.yml`: manual + scheduled Spotify refresh workflow; scheduled runs are gated by `SPOTIFY_REFRESH_SCHEDULE_ENABLED` and now run three times per day
- `.github/workflows/daily_notion_reset.yml`: daily + manual Notion completion reset workflow
- `.github/workflows/publish_audio.yml`: combined publish workflow for Morning Prayer audio and novena publishing, scheduled daily and also available on manual dispatch with `novena_publish_mode=daily` as the default choice; `bootstrap-no-cache` is available for a bootstrap-style publish that rebuilds audio without using the cache
- `.github/workflows/daily_devotional_image_remote.yml`: daily + manual devotional image generation with OneDrive sync and GitHub Pages export
- `.github/workflows/liturgical_calendar_yearly_sync.yml`: Jan 1 + manual Liturgical Calendar population

## Config Timezone
- `jobs/playlist/refresh_playlist.py` uses `JOB_UTC_OFFSET` for all date-based episode selection.
- Default runtime offset is CST (`-06:00`) when `JOB_UTC_OFFSET` is unset.
- Spotify playlist definitions carry playlist identity only; timezone does not live in the Spotify config files.

## Spotify Contract Model
Queue contract files in `config/spotify/contracts/` own:
- `key`
- `notion_name`, the exact Notion row title used for membership matching
- exactly one of `resolver` or `spotify_uri` for ordinary contracts
- `spotify_episode_lookup` for date-scoped podcast episode matching by show id, required name terms, ordered date formats, and optional ordered search profiles
- resolver names are exact; the runtime does not rewrite legacy alias names before dispatch
- the three Marian Antiphon contracts target the Ora Pro Nobis show and try `Marian Antiphon` first, then legacy `Angelus` and `Regina Caeli` title searches for transition coverage
- optional `fallback_resolver`
- optional `weekdays`

`spotify_episode_lookup` contracts:
- own the Spotify show id directly in the contract file
- match episode `name` only
- support the flat `required_name_terms` plus `date_formats` shape for one search
- support `searches` for multiple ordered searches, each with its own `required_name_terms` and `date_formats`
- require every configured name term in the active search to be present
- try the active search's configured date formats in order until one matches the episode title
- stop at the first search that returns matches, then return every matching episode URI for the day

Auxilium Christianorum Spotify playlist integration resolves the generated Ora Pro Nobis daily episode by title and date from the Ora Pro Nobis show. The Spotify queue contract keeps the current Notion row title `Auxillium Christianorum` for membership matching, while its episode lookup targets titles such as `Auxilium Christianorum - April 6, 2026`.

Daily Rosary Spotify playlist integration resolves the generated Ora Pro Nobis daily episode by title and date from the Ora Pro Nobis show. Its episode lookup targets titles such as `Daily Rosary - Joyful Mysteries - Saint Example - April 6, 2026` while matching only the durable `Daily Rosary` term and the publish date.

Playlist definition files in `config/spotify/playlists/` own:
- `key`
- `name`
- `playlist_id`

Playlist membership and sequence come from checked Notion rows:
- Notion `Enabled` must be checked.
- Notion `Output Folder` must be populated; blank `Output Folder` omits the row just like unchecked `Enabled`.
- Notion `Name` must exactly match a contract `notion_name`.
- Notion `Output Folder`, when populated, must match one playlist key or display name such as `Morning`, `Midday`, `Night`, or `Sunday`.
- Notion `Order` controls queue order inside the playlist.
- Contracts with no checked matching Notion row, or with a row whose `Output Folder` is blank, stay inactive without failing the run.

The committed playlist definitions are:
- `config/spotify/playlists/morning.json`
- `config/spotify/playlists/midday.json`
- `config/spotify/playlists/night.json`
- `config/spotify/playlists/sunday.json`

The runtime validates the selected playlist definitions before any Spotify write occurs and fails closed on:
- invalid JSON
- duplicate contract or playlist keys/names
- invalid playlist ids
- invalid contract weekday names
- invalid contract resolver-vs-direct-URI shapes
- duplicate checked Notion rows for one `notion_name`
- checked matched rows with unknown `Output Folder`
- checked matched rows with populated `Output Folder` but missing `Order`

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
$env:NOTION_TOKEN = "..."
$env:NOTION_DATABASE_ID = "..."
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
- loads and validates playlist definitions, queue contracts, and Notion membership before touching Spotify
- applies contract-level weekday gating such as Sunday-only or Friday-only items
- resolves each contract through its explicit `resolver`, `spotify_uri`, or `spotify_episode_lookup`
- resolves `spotify_episode_lookup` contracts by matching the show id, ordered search profiles, required name terms, and configured date variants against Spotify episode titles
- replaces each selected playlist contents with the resolved queue
- prints one summary per playlist: `playlist`, `playlist_id`, and `tracks_written`, plus `source=notion_membership`
- exits non-zero on invalid contracts, invalid playlist definitions, missing Notion access, invalid single-playlist overrides, or unresolved selected runs

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
docker run --rm --env-file .env spotify-praylist:local python -m jobs.notion.reset_notion_completions
docker run --rm --env-file .env -v "$PWD/artifacts/container:/data" spotify-praylist:local python -m jobs.novena.generate_daily_novena_prayer
docker run --rm --env-file .env -v "$PWD/artifacts/container:/data" spotify-praylist:local python -m jobs.publish.run_text_pipeline
docker run --rm --env-file .env -v "$PWD/artifacts/container:/data" spotify-praylist:local python -m jobs.publish.run_audio_pipeline
docker run --rm --env-file .env -v "$PWD/artifacts/container:/data" spotify-praylist:local python jobs/notion/generate_page_audio.py
docker run --rm --env-file .env -v "$PWD/artifacts/container:/data" spotify-praylist:local python -m jobs.novena.generate_devotional_image
```

Run with Docker Compose locally:

```bash
docker compose run --rm playlist-refresh
```

Other job entrypoints are available as Compose profiles:

```bash
docker compose --profile notion run --rm notion-reset
docker compose --profile novena run --rm novena-prayer
docker compose --profile audio run --rm page-audio
docker compose --profile image run --rm devotional-image
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
2. In GitHub: `Settings -> Secrets and variables -> Actions`.
3. Add required secrets:
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN`

4. Add required Notion access for playlist membership and order:
- `NOTION_TOKEN`
- `NOTION_DATABASE_ID`
- `NOTION_DATABASE_NAME`

5. Add optional repository variables:
- `JOB_UTC_OFFSET`
- `SPOTIFY_REFRESH_SCHEDULE_ENABLED`

Workflow behavior:
- `workflow_dispatch` accepts an optional `spotify_playlist_name` input for a one-playlist validation run
- scheduled runs use the same workflow file, but only execute when `SPOTIFY_REFRESH_SCHEDULE_ENABLED` is set to `true`
- the base refresh path requires Spotify secrets plus Notion access to the `Opus Dei` database

Recommended rollout:
1. Run one manual workflow dispatch with `spotify_playlist_name=morning`.
2. Confirm Notion membership/order writes the expected playlist.
3. Set `SPOTIFY_REFRESH_SCHEDULE_ENABLED=true` to let the daily schedule run.

## Optional Notion Integrations
The active Spotify queue assembly path reads Opus Dei rows for playlist membership and ordering. Resolver metadata still comes from repo-owned contract files.

With `NOTION_TOKEN` present, the job can also run optional post-write helpers:
- URI autosync when `SPOTIFY_ENABLE_URI_AUTOSYNC=true`
- prayer-intention distribution through the existing Notion helper path

Useful related variables:
- `NOTION_TOKEN`
- `NOTION_DATABASE_ID`
- `NOTION_DATABASE_NAME`
- `SPOTIFY_ENABLE_URI_AUTOSYNC`
- `NOTION_URI_PROPERTY`
- `NOTION_INTENTIONS_ENABLED`
- `NOTION_INTENTIONS_RUN_PLAYLIST`

## Daily Notion Reset
Purpose:
- unchecks all rows in your Notion `Completed` checkbox column so each day starts fresh

Workflow:
- `.github/workflows/daily_notion_reset.yml`
- schedule: `0 7 * * *` (01:00 CST / 02:00 CDT)

Required:
- `NOTION_TOKEN` secret
- `NOTION_DATABASE_ID` secret (recommended)

Optional variables:
- `NOTION_DATABASE_NAME` (fallback lookup; default `Opus Dei`)
- `NOTION_COMPLETED_PROPERTY` (default `Completed`)

## Daily Novena Prayer Generation
Purpose:
- reads eligible liturgical celebrations from Romcal for today through the next 8 days (9-day window)
- uses OpenAI API to draft a litany-style novena prayer
- writes prayer text or mirrored daily liturgical content to the Notion row titled `Daily Novenas from Liturgical Calendar`
- the matching GitHub Actions workflow remains intentionally disabled in this release

Script:
- `jobs/novena/generate_daily_novena_prayer.py`
- the shared Romcal helper now builds a synthetic child calendar on top of the selected calendar id, normalizes named special Sundays to `solemnity`, and carries Easter Octave weekdays as the app-level pseudo-rank `solemnity-easter octave`
- devotional outputs now use a shared liturgical eligibility contract: allowed ranks are `solemnity`, `feast`, `memorial`, and `optional_memorial`, and Easter Octave weekdays are explicitly excluded by precedence

Starter config:
- copy values from [.env.example](c:/Users/jcteb/Code/spotify_praylist/.env.example) into your local environment or secret store; the novena/audio section now includes the render-hash metadata properties

Required environment variables:
- `OPENAI_API_KEY`
- `NOTION_TOKEN`
- `NOTION_DATABASE_ID` (or set `NOTION_DATABASE_NAME`)

Optional variables:
- `ROMCAL_CALENDAR` (default `general_roman`)
- `ROMCAL_LOCALE` (default `en`)
- `ROMCAL_WINDOW_DAYS` (default `9`, max `30`)
- `OAI_API_BASE_URL` (default `https://api.openai.com/v1`)
- `OAI_MODEL` (default `gpt-4.1-mini`)
- `NOTION_TITLE_PROPERTY` (default `Name`)
- `NOTION_NOVENA_ROW_TITLE` (default `Daily Novenas from Liturgical Calendar`)
- `NOTION_NOVENA_PROPERTY` (optional rich_text property to store prayer text; if unset/not rich_text, page content is replaced)
- `NOTION_WRITE_DAILY_NOVENA_PAGE` (default `true`; set `false` to mirror today's Liturgical Calendar entry into `Daily Novenas from Liturgical Calendar` while still writing day-by-day sections into today's Saint Radar row page)
- `NOTION_SAINT_RADAR_ENABLED` (default `false`; when `true`, syncs saints into a Saint Radar database)
- `NOTION_SAINT_DATABASE_ID` (optional explicit database id)
- `NOTION_SAINT_DATABASE_NAME` (default `Saint Radar`; searched/created when id not provided)
- `NOTION_SAINT_PARENT_PAGE_ID` (optional parent page id used when creating the Saint Radar database)
- `NOTION_SAINT_TITLE_PROPERTY` (default `Name`)
- `NOTION_SAINT_FEAST_DAY_PROPERTY` (default `Feast Day`)
- `NOTION_SAINT_CELEBRATION_PROPERTY` (default `Celebration Rank`; maps Romcal `rank_name` as-is)
- `NOTION_SAINT_PRECEDENCE_PROPERTY` (default `Precedence`; maps Romcal `precedence` as-is)
- `NOTION_SAINT_BACKGROUND_PROPERTY` (default `Background`)
- `NOTION_SAINT_INCLUDE_CALENDAR_DAYS` (default `false`; keep `false` when using separate yearly Liturgical Calendar sync)
- `NOTION_SAINT_REFRESH_ALL` (default `false`; set `true` to regenerate all existing saint row page bodies/backgrounds)
- `NOVENA_AUDIO_ENABLED` (default `false`; set `true` to generate and embed audio on the same Notion page)
- `NOVENA_AUDIO_MODEL` (default `gpt-4o-mini-tts`)
- `NOVENA_AUDIO_VOICE` (default `alloy`)
- `NOVENA_AUDIO_FORMAT` (default `mp3`)
- `NOVENA_AUDIO_SPEED` (default `1.0`, range `0.25-4.0`)
- `NOVENA_AUDIO_CAPTION` (default `Daily Novena Prayer (Audio)`)
- `NOVENA_AUDIO_FAIL_OPEN` (default `true`; if `true`, text update continues even if audio upload fails)
- `NOVENA_AUDIO_LIBRARY_DIR` (optional; default local root is `%USERPROFILE%\OneDrive\Praylist Audio\Novena Audio Library`; saint novena audio is prebuilt there with readable `day-01...day-09` filenames and JSON sidecars)
- the daily novena job fully truncates that managed library root before regeneration so stale audio and payload files do not survive a rerun
- `DEVOTIONAL_ONEDRIVE_REMOTE_ROOT` (optional legacy novena backfill root; when set, the daily novena workflow also prefetches `Novena Audio Library` from that location)
- saint-day novenas now cache two layers:
- prompt payload JSON once per saint/feast window
- the full 9-day audio set once per saint/feast window
- each day the job uploads the prebuilt file for that day into Notion instead of regenerating TTS inline
- saint-day render hashes now include the actual fragment text, so a text change invalidates the cached file cleanly
- `NOTION_AUDIO_RENDER_HASH_PROPERTY` (optional; default `Render Hash`; if that property exists on the page, the render hash is written there after a fresh audio render)
- `NOTION_AUDIO_SAVED_PROPERTY` (optional; default `Audio Saved`; if that property exists on the page, the job writes the fresh render timestamp there)
- `USCCB_READINGS_ENABLED` (default `true`; appends USCCB daily Mass readings as Notion toggles at page bottom)
- `USCCB_READINGS_FAIL_OPEN` (default `true`; if `true`, prayer update continues when readings fetch/parse fails)
- `USCCB_READINGS_BASE_URL` (default `https://bible.usccb.org/bible/readings`)
- `JOB_UTC_OFFSET` (default `-06:00`)

Workflow note:
- the scheduled novena workflow stays disabled in GitHub Actions for this release
- use the local script if you need to run the novena generator manually

Local run:

```powershell
.\scripts\run_daily_novena_prayer_local.ps1
```

## Auto Page Audio
Purpose:
- reads `Opus Dei` rows whose `Platform` contains `auto-audio` or `auto-text`
- resolves page text from `Text Resolver`
- resolves page audio from `Auto Audio Resolver 1` and optionally `Auto Audio Resolver 2`
- supports Notion `Audio Outputs` rows in two modes:
- `fragments` for a top-level `Fragment Key` or `Fragment Sequence`
- `config` only as a compatibility input; it is normalized into a generated wrapper fragment internally
- `rosary` for the dynamic fragment-based rosary builder with weekday mystery mapping
- falls back to the legacy `Audio Configuration` field and then the legacy resolver field when the new properties are blank
- builds a Notion audio block for `auto-audio` rows and syncs page body content for feed-backed rows
- caches generated fragment audio under `.cache/page_audio`
- exports the assembled files to `%USERPROFILE%\OneDrive\Praylist Audio\Playlist Audio\<Output Folder>\<Order - FolderName - EntryName>.mp3`
- writes the matching JSON sidecar with the same ordered stem
- can truncate managed playlist-audio outputs locally before regeneration so stale ordered filenames disappear on the next OneDrive sync

Current config:
- Morning Prayer now resolves from `config/custom_tts/morning-prayer.json`, with `MORNING_PRAYER_CONTRACT_FILE` kept as an override-only custom-TTS validation path.
- `Morning Prayer` now runs from the two-list `Opus Dei` + owner-linked `Detailed Fragments` model
- required Morning Prayer fragments are owner-linked `Audio Fragments` rows for the static prayers, `Monthly Intention`, and `Daily Novena Audio`
- the live Morning Prayer contract currently uses these durable keys for the petition rows: `petition-church` for `Petition - Right Use of Technology`, `petition-sick-departed` for `Petition - Sanctification of the Church`, and `petition-7` for `Petition - Sick and Departed`
- the page-audio contract also normalizes the live Morning Prayer legacy aliases `petition-technology`, `petition-sanctification-of-the-church`, and `petition-sick-and-departed` onto the same durable keys so the workflow can read the existing Notion rows without weakening missing-fragment checks
- Morning Prayer contract rows should carry stable `Fragment Key` values; the key is the runtime identity, while the row title can be edited for display text
- `Text Sync Mode = page_content` remains the intended Morning Prayer behavior, and the job preserves its current working block/template path instead of forcing it into the generic managed-section sync
- archived `MORNING_PRAYER_OUTPUT` / wrapper / sequence rows can remain as migration references, but they are no longer the active runtime source of truth and are not runnable by the active loaders
- `DIVINE_OFFICE_INVITATORY_OUTPUT` in `Audio Outputs`
- wraps `DIVINE_OFFICE_INVITATORY_PAGE_AUDIO` from `Page Audio Configuration`
- target row: `Divine Office Invitatory`
- prepended intention is emitted as the shared `Random Intention` fragment and cached on disk
- source audio: official DivineOffice.org RSS enclosure for the matching day
- source text: synced into the page body
- `SING_THE_HOURS_MORNING_OUTPUT` in `Audio Outputs`
- wraps `SING_THE_HOURS_MORNING_PAGE_AUDIO` from `Page Audio Configuration`
- target row: `Morning Prayer - Liturgy of the Hours (Spotify)`
- prepended intention is emitted as the shared `Random Intention` fragment and cached on disk
- source audio: public Sing the Hours RSS enclosure for the matching day's `Lauds`
- `SING_THE_HOURS_EVENING_OUTPUT` in `Audio Outputs`
- wraps `SING_THE_HOURS_EVENING_PAGE_AUDIO` from `Page Audio Configuration`
- target row: `Morning Prayer - Liturgy of the Hours (Spotify)`
- prepended intention is emitted as the shared `Random Intention` fragment and cached on disk
- source audio: public Sing the Hours RSS enclosure for the matching day's `Vespers`
- reliable text promoted into page content from more generic sources now uses a managed autogenerated prayer-text section so manual notes can survive
- rows that do not resolve a reliable text source should stay audio-only for now instead of generating synthetic page text
- additional podcast-backed outputs now live in `Audio Outputs` too, including:
- `BIBLE_IN_A_YEAR_OUTPUT`
- `SAINT_OF_DAY_OUTPUT`
- `USCCB_READINGS_OUTPUT`
- `DAILY_ROSARY_OUTPUT`
- `AUXILIUM_OUTPUT`
- `ANGELUS_MORNING_OUTPUT`
- `ANGELUS_MIDDAY_OUTPUT`
- `ANGELUS_EVENING_OUTPUT`
- `DIVINE_OFFICE_AFTERNOON_OUTPUT`
- `DIVINE_OFFICE_EVENING_OUTPUT`
- `DIVINE_OFFICE_NIGHT_OUTPUT`
- `ROSARY_INTENTIONS_OUTPUT`
- `config/legacy/page_audio_config.json` remains on disk as an archive, but the active runtime no longer loads it

Recommended Opus Dei row shape:
- `Platform = Spotify, auto-text, auto-audio` for rows that should do all three
- `Spotify Resolver` and `Spotify Fallback Resolver` for playlist/bookmark resolution
- `Text Resolver` for page-body text sync
- `Auto Audio Resolver 1` and `Auto Audio Resolver 2` for generated audio with fallback
- `Enabled = true`

Text resolvers can be RSS-backed or PDF-backed. For PDF-backed builders like `AUXILIUM_DAILY_TEXT`, set the `Feed URL` field in `Page Audio Configuration` to the source PDF URL; the job will parse and write today’s section into the page body.

Environment variables:
- `NOTION_AUDIO_PLATFORM_VALUE` (default `auto-audio,auto-text`)
- `NOTION_AUDIO_CONFIG_PROPERTY` (default `Audio Configuration`)
- `NOTION_AUDIO_RESOLVER_PROPERTY` (default `Spotify Resolver`)
- `NOTION_TEXT_RESOLVER_PROPERTY` (default `Text Resolver`)
- `NOTION_AUTO_AUDIO_RESOLVER_PRIMARY_PROPERTY` (default `Auto Audio Resolver 1`)
- `NOTION_AUTO_AUDIO_RESOLVER_SECONDARY_PROPERTY` (default `Auto Audio Resolver 2`)
- `NOTION_AUDIO_ENABLED_PROPERTY` (default `Enabled`)
- `NOTION_PAGE_AUDIO_CONFIG_DATABASE_ID` (recommended)
- `NOTION_PAGE_AUDIO_CONFIG_DATABASE_NAME` (fallback lookup; default `Page Audio Configuration`)
- `NOTION_AUDIO_FRAGMENTS_DATABASE_ID` (recommended for fragment-backed outputs)
- `NOTION_AUDIO_FRAGMENTS_DATABASE_NAME` (fallback lookup; default `Audio Fragments`)
- `NOTION_AUDIO_OUTPUTS_DATABASE_ID` (recommended for fragment-backed outputs)
- `NOTION_AUDIO_OUTPUTS_DATABASE_NAME` (fallback lookup; default `Audio Outputs`)
- `MORNING_PRAYER_CONTRACT_FILE` (default `config/custom_tts/morning-prayer.json`; custom-TTS-only override path for Morning Prayer)
- `PAGE_AUDIO_CONFIG_FILE` (custom-TTS-only contract config; when set to a specific `config/custom_tts/*.json`, the run executes only that selected contract)
- `PAGE_AUDIO_CACHE_DIR` (default `.cache/page_audio`)
- `PAGE_AUDIO_LIBRARY_DIR` (optional; default local root is `%USERPROFILE%\OneDrive\Praylist Audio\Playlist Audio`)
- `PAGE_AUDIO_TRUNCATE_MANAGED_OUTPUTS` (default `false`; when `true`, remove managed playlist-audio exports locally before regeneration)
- `PAGE_AUDIO_CONFIG_KEY` (optional single-config filter)
- `PAGE_AUDIO_ROW_TITLE` (optional single-row filter)
- `PAGE_AUDIO_FAIL_OPEN` (default `false`)

Morning folder override example:

```powershell
.\scripts\run_page_audio_local.ps1 -PageAudioLibraryDir "$env:USERPROFILE\OneDrive\Praylist Audio\Morning"
```

Audio fragment row shape:
- `Name`
- `Fragment Key`
- for Morning Prayer contract rows, treat `Fragment Key` as required and stable across title/content edits
- `Fragment Type` optional; defaults from the populated fields
- `Spoken Text` for fixed text fragments
- `Prompt` for LLM-backed fragments
- `Prompt Model` optional; defaults to `OAI_MODEL` or `gpt-4.1-mini`
- `Fragment Sequence` for wrapper/composite fragments
- `Config Key` for wrapper fragments that reuse a `Page Audio Configuration` row
- `Builder` plus normal page-audio config fields for custom builder fragments
- `Collection`
- `Enabled`
- optional `Start Date` and `End Date`

Audio output row shape:
- `Name`
- `Output Key`
- `Output Mode`
- `Fragment Key` or `Fragment Sequence` for fragment-driven outputs
- `Config Key` is still accepted for migration, but the job now turns it into a wrapper fragment internally
- `Target Row`
- `Audio Caption`
- `Output Folder` is required to route exported daily files into the correct OneDrive subfolder
- `Weekday Map` for outputs that vary by weekday, like the fragment-based rosary
- `Enabled`

Archived Rosary page-audio output mode:
- `Output Mode = rosary`
- `config/legacy/rosary.json` is the legacy Rosary contract source of truth
- `config/content/rosary/` holds the actual Rosary prayer text files and the meditation prompt template
- `Weekday Map` is a JSON object like `{"Monday":"The Joyful Mysteries", ...}`
- the Rosary contract declares the visible flow with per-block counts, so `Hail Mary x10` stays obvious in config
- rosary decade intentions come from the Rosary page's `Intention` text, which is split into a daily pool and shuffled per decade
- fixed prayers like `Hail Mary`, `Our Father`, and `Glory Be` now live as repo text files under `config/content/rosary/`
- each mystery announcement is generated from the Rosary contract, not from Notion rows
- `rosary-decade-meditation-template` is a local prompt text file that gets rendered once per decade using the page's numbered `Intention` lines
- the Rosary summary stays compact and shows the mystery, fruit, and daily intentions instead of the full prayer text

Local run:

```powershell
.\scripts\run_page_audio_local.ps1
```

## Liturgical Calendar Yearly Sync
Purpose:
- populates your `Liturgical Calendar` Notion database from Romcal calendar-day entries
- keeps entries pre-created so daily 9-day jobs can update content without creating new calendar-day rows
- reruns as an upsert by `Name` + `Feast Day`, so repopulating a year is safe when the schema stays stable

Script:
- `jobs/novena/sync_liturgical_calendar.py`

Defaults:
- scheduled Jan 1 run writes the **next year** (example: Jan 1, 2027 syncs all of 2028)

Manual bootstrap examples:
- through end of 2027: set `LITURGICAL_SYNC_END_YEAR=2027` (optionally `LITURGICAL_SYNC_START_DATE=YYYY-MM-DD`)
- one explicit year: set `LITURGICAL_SYNC_TARGET_YEAR=2028`
- repopulate 2026 and 2027 with the current precedence rules: set `LITURGICAL_SYNC_START_DATE=2026-01-01` and `LITURGICAL_SYNC_END_YEAR=2027`

Required environment variables:
- `NOTION_TOKEN`
- `NOTION_DATABASE_ID` (parent database used for fallback parent lookup)
- `LITURGICAL_CALENDAR_DATABASE_ID` (recommended: your Liturgical Calendar database id)

Optional variables:
- `ROMCAL_CALENDAR` (default `general_roman`)
- `ROMCAL_LOCALE` (default `en`)
- `LITURGICAL_SYNC_TARGET_YEAR` (optional `YYYY`; highest priority)
- `LITURGICAL_SYNC_START_DATE` (optional `YYYY-MM-DD`)
- `LITURGICAL_SYNC_END_DATE` (optional `YYYY-MM-DD`)
- `LITURGICAL_SYNC_END_YEAR` (optional `YYYY`)
- `LITURGICAL_CALENDAR_DATABASE_NAME` (optional explicit name; defaults to `Liturgical Calendar`)
- `NOTION_SAINT_DATABASE_ID` and `NOTION_SAINT_DATABASE_NAME` remain supported as legacy aliases

## Daily Devotional Image Generation
Purpose:
- selects all unseen eligible celebrations from the same 9-day Romcal window (or one date when `DEVOTIONAL_TARGET_DATE` is set)
- eligible ranks: `solemnity`, `feast`, `memorial`, `optional_memorial`
- explicit exclusion: Easter Octave weekdays (`Precedence.weekday_of_easter_octave_*`) are skipped even though the shared Romcal model still maps them to the pseudo-rank `solemnity-easter octave`
- skips already-generated entries by parsing existing filenames
- generates a high-finish devotional image prompt from saint subject
- creates an image with OpenAI image generation
- includes 9-day window metadata in output filename and `.window.txt` companion file
- writes two layout variants per subject:
  - portrait variant to `Current Devotion`
  - widescreen variant to `Current Devotion Wide`
- keeps only four canonical storage folders:
  - `OneDrive\Pictures\Samsung Gallery\DCIM\Current Devotion`
  - `OneDrive\Pictures\Samsung Gallery\DCIM\Non Current Devotion`
  - `OneDrive\Pictures\Samsung Gallery\DCIM\Current Devotion Wide`
  - `OneDrive\Pictures\Samsung Gallery\DCIM\Non Current Devotion Wide`
- automatically moves expired files from `Current` into `Non Current`
- writes `images_manifest.json` inside each canonical image folder plus a root `devotional_image_library.json`
- supports non-OneDrive clients by publishing a filtered public manifest tree with only the current portrait + wide folders

Script:
- `jobs/novena/generate_devotional_image.py`

Required environment variables:
- `OPENAI_API_KEY`

Optional variables:
- `OAI_API_BASE_URL` (default `https://api.openai.com/v1`)
- `ROMCAL_CALENDAR` (default `general_roman`)
- `ROMCAL_LOCALE` (default `en`)
- `ROMCAL_WINDOW_DAYS` (default `9`)
- `DEVOTIONAL_TARGET_DATE` (optional `YYYY-MM-DD` to force saint for a specific date in window)
- `DEVOTIONAL_ONEDRIVE_DCIM_DIR` (default `%USERPROFILE%\OneDrive\Pictures\Samsung Gallery\DCIM`)
- `DEVOTIONAL_CURRENT_FOLDER` (default `Current Devotion`)
- `DEVOTIONAL_ARCHIVE_FOLDER` (default `Non Current Devotion`)
- `DEVOTIONAL_CURRENT_WIDE_FOLDER` (default `Current Devotion Wide`)
- `DEVOTIONAL_ARCHIVE_WIDE_FOLDER` (default `Non Current Devotion Wide`)
- `DEVOTIONAL_MANIFEST_NAME` (default `images_manifest.json`)
- `DEVOTIONAL_ROOT_MANIFEST_NAME` (default `devotional_image_library.json`)
- `DEVOTIONAL_PROMPT_MODEL` (default `gpt-5-mini`)
- `DEVOTIONAL_IMAGE_MODEL` (default `gpt-image-2`)
- `DEVOTIONAL_IMAGE_SIZE` (default `1024x1536`, phone portrait)
- `DEVOTIONAL_IMAGE_SIZE_WIDE` (default `1536x1024`, widescreen)
- `DEVOTIONAL_IMAGE_QUALITY` (default `high`)
- `DEVOTIONAL_IMAGE_FORMAT` (default `png`)

Local run:

```powershell
.\scripts\run_daily_devotional_image_local.ps1
```

Local run with rclone upload:

```powershell
.\scripts\run_daily_devotional_image_rclone_local.ps1
```

Optional local vars:
- `RCLONE_REMOTE_NAME` (default `onedrive`)
- `RCLONE_REMOTE_ROOT` (default `Pictures/Samsung Gallery/DCIM`)

Local run with OneDrive app upload (Graph):

```powershell
.\scripts\setup_onedrive_local.ps1
.\scripts\run_daily_devotional_image_onedrive_local.ps1
```

Local OneDrive upload env (User or Process):
- `ONEDRIVE_USER_ID` (UPN or GUID target user for OneDrive)
- `AZURE_TENANT_ID`
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET` (for service principal login)
- `DEVOTIONAL_ONEDRIVE_REMOTE_ROOT` (optional legacy novena backfill root)

Client sync without OneDrive:

```powershell
py -3 .\sync\sync_devotional_images_client.py `
  --config .\sync\devotional_image_client.example.json
```

Interactive setup wizard:

```powershell
.\sync\setup_devotional_image_client.ps1
```

The wizard:
- asks whether the source is `http` or `local`
- collects the source root or public base URL
- collects the local target folder
- collects manifest and cleanup options
- writes a reusable portable client bundle into `sync\client\`
- keeps sync/distribution files under the repo root `sync\` folder instead of mixing them with other scripts

Unattended example for HTTP:

```powershell
.\sync\setup_devotional_image_client.ps1 `
  -SourceMode http `
  -SourceBaseUrl "https://jctebo.github.io/spotify_praylist/devotional/DCIM" `
  -TargetRoot "C:\Users\Public\Pictures\DevotionalImages"
```

Unattended example for a local shared folder:

```powershell
.\sync\setup_devotional_image_client.ps1 `
  -SourceMode local `
  -SourceRoot "\\server\share\devotional\DCIM" `
  -TargetRoot "C:\Users\Public\Pictures\DevotionalImages"
```

Build or refresh the root `sync\` folder so it contains both the public HTTP-ready source tree and the portable client bundle:

```powershell
.\sync\build_devotional_image_distribution_bundle.ps1 `
  -SourceRoot "$env:USERPROFILE\OneDrive\Pictures\Samsung Gallery\DCIM" `
  -BundleDir ".\sync" `
  -PublicBaseUrl "https://jctebo.github.io/spotify_praylist/devotional/DCIM" `
  -ClientTargetRoot "C:\Users\Public\Pictures\DevotionalImages"
```

That root folder contains:
- `sync\public\DCIM\...` with:
  - `Current Devotion`
  - `Current Devotion Wide`
  - filtered `devotional_image_library.json`
- `sync\client\...` with:
  - `sync_devotional_images_client.py`
  - `devotional_image_client.json`
  - `run_devotional_sync.bat`
  - `run_devotional_sync.ps1`

HTTP source example:

```powershell
py -3 .\sync\sync_devotional_images_client.py `
  --config .\sync\devotional_image_client_http.example.json
```

How the HTTP mode works:
- publish the filtered public DCIM root over HTTP
- the public root URL must expose:
  - `devotional_image_library.json`
  - `Current Devotion/images_manifest.json`
  - `Current Devotion Wide/images_manifest.json`
- every file path listed in those manifests must be reachable at the same relative HTTP path
- directory listing is not required; only direct file access is required

Expected HTTP layout:

```text
https://jctebo.github.io/spotify_praylist/devotional/DCIM/devotional_image_library.json
https://jctebo.github.io/spotify_praylist/devotional/DCIM/Current%20Devotion/images_manifest.json
https://jctebo.github.io/spotify_praylist/devotional/DCIM/Current%20Devotion/<manifest-relative-image-path>.png
https://jctebo.github.io/spotify_praylist/devotional/DCIM/Current%20Devotion%20Wide/images_manifest.json
```

Recommended client config for HTTP:
- set `source_base_url` to the public DCIM root URL
- leave `source_root` empty
- set `target_root` to the local folder where the client should store the synced files
- set `include_manifests` to `true` if the client should keep local copies of the manifest JSON files
- set `delete_missing` to `true` only if the client should mirror the remote exactly and delete files that are no longer present upstream

Direct command without a config file:

```powershell
py -3 .\sync\sync_devotional_images_client.py `
  --source-base-url "https://jctebo.github.io/spotify_praylist/devotional/DCIM" `
  --target-root "C:\Users\Public\Pictures\DevotionalImages" `
  --include-manifests
```

What the client script does:
- downloads `devotional_image_library.json`
- reads each folder manifest referenced by the root manifest
- downloads only files that are missing locally or whose sha256 hash changed
- optionally deletes local files not present in the manifests when `--delete-missing` is set
- works with either a local filesystem source (`--source-root`) or a public HTTP source (`--source-base-url`)

Notes:
- Requires Azure CLI (`az`) installed locally.
- If service principal vars are missing, runner falls back to current `az login` context.

## Local Job Mirrors
Run local equivalents of each GitHub Action workflow:

```powershell
# Daily refresh workflow mirror
.\scripts\run_daily_refresh_local.ps1

# Daily notion reset workflow mirror
.\scripts\run_daily_notion_reset_local.ps1

# Daily novena prayer generation
.\scripts\run_daily_novena_prayer_local.ps1
```

## Remote Devotional Image Job (rclone + OneDrive)
Workflow:
- `.github/workflows/daily_devotional_image_remote.yml`

Purpose:
- runs the devotional image generator on GitHub Actions
- uploads generated files to OneDrive via `rclone` under:
  - `Pictures/Samsung Gallery/DCIM/Current Devotion`
  - `Pictures/Samsung Gallery/DCIM/Non Current Devotion`
  - `Pictures/Samsung Gallery/DCIM/Current Devotion Wide`
  - `Pictures/Samsung Gallery/DCIM/Non Current Devotion Wide`
  - `Pictures/Samsung Gallery/DCIM/devotional_image_library.json`
- builds a filtered public export containing only:
  - `devotional/DCIM/Current Devotion`
  - `devotional/DCIM/Current Devotion Wide`
  - `devotional/DCIM/devotional_image_library.json`
- deploys that filtered export to GitHub Pages for non-OneDrive client sync

Required GitHub Secrets:
- `OPENAI_API_KEY`
- `RCLONE_CONFIG_B64` (base64-encoded `rclone.conf` containing your OneDrive remote)

Optional GitHub Variables:
- `RCLONE_REMOTE_NAME` (default `onedrive`)
- `RCLONE_REMOTE_ROOT` (default `Pictures/Samsung Gallery/DCIM`)

GitHub Pages:
- this workflow deploys the public devotional export with `actions/deploy-pages`
- the client sync `source_base_url` should point to:
  - `https://<github-user>.github.io/<repo>/devotional/DCIM`

Generate `RCLONE_CONFIG_B64` with wizard:

```powershell
.\scripts\setup_rclone_github.ps1
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
- `jobs/notion/reset_notion_completions.py` checkbox reset behavior and schema error handling
- `jobs/novena/generate_daily_novena_prayer.py` saint-window selection and Notion write mode behavior

## Setup Scripts
Use setup scripts (separate from `run_*` job mirrors):

```powershell
.\scripts\setup_spotify.ps1
.\scripts\setup_notion.ps1
.\scripts\setup_notion_playlists.ps1
.\scripts\setup_novena.ps1
```

## Notes
- Do not commit secrets.
- Script prints a non-zero exit code on failures so Actions fails visibly.
