# Spotify Playlist Refresher

Python project for refreshing a Spotify playlist daily using GitHub Actions.

## Runtime
- Python 3.11
- Non-interactive auth via refresh token
- Daily refresh queue config is Notion-first (Opus Dei rows)

Required variables:
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN`

Optional variables:
- `SPOTIFY_USER_ID` (compatibility only)
- `SPOTIFY_PLAYLIST_NAME` (Notion mode only; optional single-playlist filter)
- `SPOTIFY_PLAYLIST_ID` (optional single-playlist target override)
- `SPOTIFY_PLAYLIST_PROFILE` (legacy file-mode selector; default `morning`)

## Files
- `jobs/playlist/refresh_playlist.py`: main script (token refresh + playlist update)
- `jobs/notion/reset_notion_completions.py`: daily reset to uncheck all Notion completion checkboxes
- `jobs/novena/generate_daily_novena_prayer.py`: generates a daily novena litany from Romcal saints + OpenAI and writes to Notion
- `jobs/novena/sync_liturgical_calendar.py`: syncs Liturgical Calendar Notion rows from Romcal over a date range (yearly job)
- `jobs/novena/generate_devotional_image.py`: generates a saint devotional image from the 9-day Romcal window and writes files to OneDrive folders
- `config/playlist_config.json`: legacy file-mode config (optional fallback)
- `config/notion_spotify_sync_config.json`: mapping rules from Spotify item text -> Notion row name
- `scripts/setup_spotify.ps1`: Spotify setup + refresh-token wizard
- `scripts/setup_notion.ps1`: Notion token/database setup + API validation
- `scripts/setup_notion_playlists.ps1`: creates/populates the Notion playlists database and backfills the main `Playlist` field
- `scripts/setup_novena.ps1`: Romcal + OpenAI + Notion setup wizard for daily novena generation
- `scripts/run_daily_refresh_local.ps1`: local mirror of `.github/workflows/daily.yml`
- `scripts/run_daily_notion_reset_local.ps1`: local mirror of `.github/workflows/daily_notion_reset.yml`
- `scripts/run_daily_novena_prayer_local.ps1`: local runner for daily novena prayer generation
- `scripts/run_daily_devotional_image_local.ps1`: local runner for saint devotional image generation
- `scripts/run_daily_devotional_image_onedrive_local.ps1`: local runner that generates devotional images and uploads them to OneDrive via Microsoft Graph
- `scripts/run_daily_devotional_image_rclone_local.ps1`: local runner that generates devotional images and uploads to OneDrive using rclone
- `scripts/setup_onedrive_local.ps1`: stores local Azure/OneDrive app settings for local Graph upload runs
- `scripts/setup_rclone_github.ps1`: wizard to create/validate rclone OneDrive remote and export `RCLONE_CONFIG_B64` for GitHub Actions
- `sync/sync_devotional_images_client.py`: portable client sync script for non-OneDrive consumers
- `sync/setup_devotional_image_client.ps1`: wizard to create a portable client sync bundle
- `sync/build_devotional_public_tree.py`: filters the OneDrive-oriented devotional manifest tree into a public current-only export
- `sync/build_devotional_image_distribution_bundle.ps1`: builds a `sync\public` + `sync\client` distribution folder
- `requirements.txt`: Python dependencies
- `release/releaselog.md`: consolidated release log for shipped bug work
- `.github/workflows/daily.yml`: daily + manual GitHub Actions workflow
- `.github/workflows/daily_notion_reset.yml`: daily + manual Notion completion reset workflow
- `.github/workflows/daily_devotional_image_remote.yml`: daily + manual devotional image generation with rclone upload to OneDrive
- `.github/workflows/liturgical_calendar_yearly_sync.yml`: Jan 1 + manual Liturgical Calendar population

## Config Timezone
- `config/playlist_config.json` supports top-level `utc_offset` in legacy file mode.
- `JOB_UTC_OFFSET` can override offset at runtime for date-based jobs.
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
$env:NOTION_TOKEN = "..."
$env:NOTION_DATABASE_ID = "..."
$env:NOTION_PLAYLISTS_DATABASE_ID = "..."
# Optional single-playlist run:
$env:SPOTIFY_PLAYLIST_NAME = "Morning"
# Optional: disable Notion page Spotify bookmark sync
$env:NOTION_SPOTIFY_BOOKMARKS_ENABLED = "false"
# Optional:
$env:SPOTIFY_USER_ID = "..."
$env:JOB_UTC_OFFSET = "-06:00"
```

4. Run:

```bash
python jobs/playlist/refresh_playlist.py
```

Expected behavior:
- refreshes Spotify access token each run
- reads enabled rows from your Notion playlists database
- reads Opus Dei rows for each playlist and order
- supports row-level resolver + fallback (for Morning/Evening LOTH dual-podcast logic)
- replaces each target playlist contents with resolved items from the flat Notion list
- keeps a Spotify bookmark block at the top of each Spotify row page when the current row resolves to a Spotify item
- prints one summary per playlist: `playlist`, `playlist_id`, and `tracks_written`
- exits non-zero on error

## GitHub Actions Setup
1. Push this project to a GitHub repository.
2. In GitHub: `Settings -> Secrets and variables -> Actions -> New repository secret`
3. Add secrets (exact names):
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN`
- `NOTION_TOKEN`
- `NOTION_DATABASE_ID` (recommended)
- `NOTION_PLAYLISTS_DATABASE_ID` (recommended)
- `SPOTIFY_USER_ID` (optional)
- `SPOTIFY_PLAYLIST_ID` (optional single-playlist override only)

Workflow triggers:
- daily schedule (UTC cron in `.github/workflows/daily.yml`)
- manual run via `workflow_dispatch`

## Notion Queue Config (Opus Dei)
Daily refresh now uses Opus Dei rows as the queue source (`SPOTIFY_REFRESH_CONFIG_SOURCE=notion`).

Recommended Opus Dei columns:
- `Name` (title)
- `Platform` (must include your Spotify value, default `spotify`; rows with `spotify-nosync` are skipped)
- `Playlist` (text, select, multi-select, or comma-separated text matching a playlist table row name)
- `Category` (optional devotional grouping; ignored by Spotify playlist building)
- `Order` (number; lower runs earlier)
- `Spotify Resolver` (resolver key like `MORNING`, `EVENING`, `USCCB`, `ROSARY`, etc., or direct `spotify:...` URI)
- `Spotify Fallback Resolver` (optional; second resolver if primary fails)
- `Enabled` (checkbox; unchecked rows are skipped)
- `URI` (optional direct URI; used as fixed source when resolver is blank)

Recommended Spotify Playlists columns:
- `Name` (title)
- `Spotify Playlist ID` (raw playlist id, `spotify:playlist:...`, or Spotify playlist URL)
- `Enabled` (checkbox; unchecked playlists are skipped)

Key edge-case support:
- Morning/Evening Liturgy of the Hours two-podcast backup is handled by resolver logic (`MORNING` and `EVENING` already include STH primary + Divine Office fallback).
- Additional explicit backup can be set per row with `Spotify Fallback Resolver`.
- Non-Spotify rows can stay in the same flat list; the refresh job only builds playlists from rows whose `Platform` contains your Spotify value.

Queue-related environment variables:
- `SPOTIFY_REFRESH_CONFIG_SOURCE` (default `notion`; set `file` for legacy JSON mode)
- `SPOTIFY_PLAYLIST_NAME` (optional single-playlist filter in Notion mode)
- `SPOTIFY_ENABLE_URI_AUTOSYNC` (default `false`; keeps automatic URI mapping off)
- `NOTION_SPOTIFY_BOOKMARKS_ENABLED` (default `true`; inserts/refreshes a Spotify bookmark block at the top of Spotify row pages)
- `NOTION_SPOTIFY_EMBEDS_ENABLED` (legacy alias for the same setting)
- `NOTION_PLAYLISTS_DATABASE_ID` (recommended)
- `NOTION_PLAYLISTS_DATABASE_NAME` (fallback lookup; default `Spotify Playlists`)
- `NOTION_PLAYLISTS_TITLE_PROPERTY` (default `Name`)
- `NOTION_PLAYLISTS_ID_PROPERTY` (default `Spotify Playlist ID`)
- `NOTION_PLAYLISTS_ENABLED_PROPERTY` (default `Enabled`)
- `NOTION_QUEUE_PLAYLIST_PROPERTY` (default `Playlist`)
- `NOTION_QUEUE_PROFILE_PROPERTY` (legacy alias fallback for older schemas)
- `NOTION_QUEUE_ORDER_PROPERTY` (default `Order`)
- `NOTION_QUEUE_RESOLVER_PROPERTY` (default `Spotify Resolver`)
- `NOTION_QUEUE_FALLBACK_PROPERTY` (default `Spotify Fallback Resolver`)
- `NOTION_QUEUE_ENABLED_PROPERTY` (default `Enabled`)

## Daily Notion Reset
Purpose:
- unchecks all rows in your Notion `Completed` checkbox column so each day starts fresh

Workflow:
- `.github/workflows/daily_notion_reset.yml`
- schedule: `0 8 * * *` (02:00 CST / 03:00 CDT)

Required:
- `NOTION_TOKEN` secret
- `NOTION_DATABASE_ID` secret (recommended)

Optional variables:
- `NOTION_DATABASE_NAME` (fallback lookup; default `Opus Dei`)
- `NOTION_COMPLETED_PROPERTY` (default `Completed`)

## Daily Novena Prayer Generation
Purpose:
- reads saints from Romcal for today through the next 8 days (9-day window)
- uses OpenAI API to draft a litany-style novena prayer
- writes prayer text or mirrored daily liturgical content to the Notion row titled `Daily Novenas from Liturgical Calendar`

Script:
- `jobs/novena/generate_daily_novena_prayer.py`
- the shared Romcal helper now builds a synthetic child calendar on top of the selected calendar id, normalizes named special Sundays to `solemnity`, and carries Easter Octave weekdays as the app-level pseudo-rank `solemnity-easter octave`

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
- the scheduled daily novena workflow always prefetches the primary `Praylist Audio` library
- the legacy `DEVOTIONAL_ONEDRIVE_REMOTE_ROOT` prefetch is skipped unless that env var is explicitly configured

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
- `Morning Prayer` now runs from the two-list `Opus Dei` + owner-linked `Detailed Fragments` model
- required Morning Prayer fragments are owner-linked `Audio Fragments` rows for the static prayers, `Monthly Intention`, and `Daily Novena Audio`
- Morning Prayer contract rows should carry stable `Fragment Key` values; the key is the runtime identity, while the row title can be edited for display text
- `Text Sync Mode = page_content` remains the intended Morning Prayer behavior, and the job preserves its current working block/template path instead of forcing it into the generic managed-section sync
- legacy `MORNING_PRAYER_OUTPUT` / wrapper / sequence rows can remain as migration references, but they are no longer the active runtime source of truth
- `DIVINE_OFFICE_INVITATORY_OUTPUT` in `Audio Outputs`
- wraps `DIVINE_OFFICE_INVITATORY_PAGE_AUDIO` from `Page Audio Configuration`
- target row: `Divine Office Invitatory`
- prepended intention is emitted as the shared `Random Intention` fragment and cached on disk
- source audio: official DivineOffice.org RSS enclosure for the matching day
- source text: synced into the page body
- `DIVINE_OFFICE_NIGHT_TEXT`
- target row: `Night Prayer (Optional)`
- source text: official DivineOffice.org RSS body synced into the page body
- `DIVINE_OFFICE_MORNING_TEXT`
- target row: `Morning Prayer - Liturgy of the Hours (Spotify)`
- source text: official DivineOffice.org `Morning Prayer` RSS body synced into the page body
- `SING_THE_HOURS_MORNING_OUTPUT` in `Audio Outputs`
- wraps `SING_THE_HOURS_MORNING_PAGE_AUDIO` from `Page Audio Configuration`
- target row: `Morning Prayer - Liturgy of the Hours (Spotify)`
- prepended intention is emitted as the shared `Random Intention` fragment and cached on disk
- source audio: public Sing the Hours RSS enclosure for the matching day's `Lauds`
- `DIVINE_OFFICE_MORNING_OUTPUT` in `Audio Outputs`
- wraps `DIVINE_OFFICE_MORNING_PAGE_AUDIO` from `Page Audio Configuration`
- target row: `Morning Prayer - Liturgy of the Hours (Spotify)`
- source audio fallback: official DivineOffice.org RSS enclosure for the matching day's `Morning Prayer`
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
- fallback file source remains available in [page_audio_config.json](c:/Users/jcteb/Code/spotify_praylist/config/page_audio_config.json) if the Notion config database is unavailable

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
- `PAGE_AUDIO_CONFIG_FILE` (fallback file config if Notion config db is unavailable)
- `PAGE_AUDIO_CACHE_DIR` (default `.cache/page_audio`)
- `PAGE_AUDIO_LIBRARY_DIR` (optional; default local root is `%USERPROFILE%\OneDrive\Praylist Audio\Playlist Audio`)
- `PAGE_AUDIO_TRUNCATE_MANAGED_OUTPUTS` (default `false`; when `true`, remove managed playlist-audio exports locally before regeneration)
- `PAGE_AUDIO_CONFIG_KEY` (optional single-config filter)
- `PAGE_AUDIO_ROW_TITLE` (optional single-row filter)
- `PAGE_AUDIO_FAIL_OPEN` (default `false`)

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

Rosary output mode:
- `Output Mode = rosary`
- `Weekday Map` is a JSON object like `{"Monday":"The Joyful Mysteries", ...}`
- rosary decade intentions are pulled from the Notion `Prayer Intentions` library when available, with the row's `Intention` field used only as fallback
- fixed prayers like `Hail Mary`, `Our Father`, and `Glory Be` should be separate `Audio Fragments` rows so their TTS audio is cached once and reused many times
- each mystery announcement should be its own fragment row
- `rosary-decade-meditation-template` is an LLM-backed prompt fragment that gets rendered once per decade using the page's numbered `Intention` lines

Local run:

```powershell
.\scripts\run_page_audio_local.ps1
```

## Liturgical Calendar Yearly Sync
Purpose:
- populates your `Liturgical Calendar` Notion database from Romcal calendar-day entries
- keeps entries pre-created so daily 9-day jobs can update content without creating new calendar-day rows

Script:
- `jobs/novena/sync_liturgical_calendar.py`

Defaults:
- scheduled Jan 1 run writes the **next year** (example: Jan 1, 2027 syncs all of 2028)

Manual bootstrap examples:
- through end of 2027: set `LITURGICAL_SYNC_END_YEAR=2027` (optionally `LITURGICAL_SYNC_START_DATE=YYYY-MM-DD`)
- one explicit year: set `LITURGICAL_SYNC_TARGET_YEAR=2028`

Required environment variables:
- `NOTION_TOKEN`
- `NOTION_DATABASE_ID` (parent database used for fallback parent lookup)
- `NOTION_SAINT_DATABASE_ID` (recommended: your Liturgical Calendar database id)

Optional variables:
- `ROMCAL_CALENDAR` (default `general_roman`)
- `ROMCAL_LOCALE` (default `en`)
- `LITURGICAL_SYNC_TARGET_YEAR` (optional `YYYY`; highest priority)
- `LITURGICAL_SYNC_START_DATE` (optional `YYYY-MM-DD`)
- `LITURGICAL_SYNC_END_DATE` (optional `YYYY-MM-DD`)
- `LITURGICAL_SYNC_END_YEAR` (optional `YYYY`)

## Daily Devotional Image Generation
Purpose:
- selects all unseen eligible celebrations from the same 9-day Romcal window (or one date when `DEVOTIONAL_TARGET_DATE` is set)
- eligible ranks: `solemnity`, `solemnity-easter octave`, `feast`, `memorial`, `optional_memorial`
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
- `DEVOTIONAL_IMAGE_MODEL` (default `gpt-image-1`)
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
https://jctebo.github.io/spotify_praylist/devotional/DCIM/Current%20Devotion/03-01_03-31_dev_st-joseph_mod_realism.png
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
