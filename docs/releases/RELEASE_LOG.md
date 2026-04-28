# Release Log

## [0.2.0.0] - 2026-04-28

### Added
- Added a contract-first novena publishing system with a fresh `jobs/novena_contracts/` boundary for contract loading, validation, resolution, rendering, audio generation, sidecar writing, and RSS publishing.
- Added `contracts/novenas/templates/standard-9-day.json` and a selector-based family contract in `contracts/novenas/families/standard-9-day.json` so the standard novena can auto-populate eligible celebrations from the liturgical calendar without enumerating feast ids.
- Added `contracts/novenas/feast-days/most_sacred_heart_of_jesus.json` as an explicit feast override example that resolves from a canonical Romcal id.
- Added `scripts/new_novena_contract.py` so authors can create or validate feast contracts from either a saint name or a Romcal id, and optionally auto-populate a selector family.
- Added regression coverage for contract loading, selector resolution, audio sidecar writing, pipeline orchestration, and publish-pipeline compatibility.

### Changed
- Replaced the grouped explicit feast list for the standard novena with a selector-based family contract that auto-discovers eligible solemnities, feasts, memorials, and optional memorials from the liturgical calendar.
- Updated the novena resolver to derive active novena windows from `today` plus contract metadata while suppressing duplicate selector output when an explicit override exists.
- Kept the RSS rebuild deterministic from published audio artifacts and preserved the existing non-novena episodes.
- Added a GitHub Actions novena workflow that runs immediately after `Publish Prayer Audio` on `main` and can also be triggered manually.
- Updated the release artifact and version tracker to reflect the shipped minor release.

### Fixed
- Prevented the standard novena from relying on an invalid weekday-of-Easter example as a feast trigger.
- Ensured embedded templates still override `template_id` and that invalid contract shapes fail closed before audio generation.
- Fixed novena sidecar serialization so Romcal enum values are written into JSON artifacts safely.

## [0.1.5.7] - 2026-04-27

### Changed
- Repointed the Morning Prayer `MORNING_PRAYER_MONTHLY` resolver to the new Spotify show id and changed its lookup to the date-scoped episode title for today.
- Added a dedicated `06:00 UTC` schedule to `Publish Prayer Audio` and moved the Spotify refresh to `07:00 UTC` so Morning Prayer publishes before the later refresh window.
- Updated the README to document the earlier publish cadence and the Morning Prayer show source of truth.

### Fixed
- Stopped the Morning Prayer playlist resolver from relying on the old month/year episode title pattern.
- Kept the `MORNING_PRAYER_MONTHLY` contract key stable so the existing playlist contract files did not need a migration.

## [0.1.5.4] - 2026-04-27

### Added
- Added leaf-fragment expansion for publish audio so Morning Prayer and similar contracts now carry ordered fragment metadata instead of a single whole-entry render blob.
- Added a dedicated publish-audio fragment cache under `.cache/publish_audio/` with per-fragment hashing, cached silence generation, and ffmpeg assembly helpers.
- Added regression coverage for fragment ordering, fragment hash invalidation, repeated leaf reuse, publish-output cache hits, and podcast-feed generation from fragment-assembled audio.

### Changed
- Reworked `jobs/publish/audio.py` to render fragments individually, reuse cached fragment audio, and assemble the final MP3 from cached pieces.
- Updated `jobs/publish/contracts.py` so audio jobs derive their content hash from the fragment manifest instead of from one large concatenated text payload.
- Updated `README.md` to document the fragment cache model and the new publish-audio helper module.

### Fixed
- Ensured identical spoken leaf text can reuse cached audio across reruns instead of calling TTS again for the whole prayer.
- Kept the public publish outputs unchanged at `docs/audio/*.mp3` and `docs/podcast.xml`.

## [0.1.5.3] - 2026-04-26

### Added
- Added a new generic publish boundary under `jobs/publish/` for contract loading, Notion text upserts, audio rendering, and RSS writing.
- Added the shared Morning Prayer and Rosary publish contracts under `config/publish/contracts/` with entry-based text assembly and selector-driven content blocks.
- Added focused regression coverage for publish-contract loading, Notion upserts keyed by `entry_id`, audio idempotency, and RSS enclosure generation.
- Added new `publish_text` and `publish_audio` GitHub Actions workflows for the contract-driven text and audio publish paths.

### Changed
- Updated `README.md` to document the new publish entrypoints, the `Publish Entries` Notion target, and the GitHub Pages base URL override.
- Moved the new audio publication path to `docs/audio/*.mp3` and `docs/podcast.xml` so GitHub Pages can serve the feed directly.

### Fixed
- Made the shared publish contracts fail closed on missing required identity fields, duplicate `entry_id` values, and unsupported block shapes.
- Ensured audio reruns reuse an unchanged MP3 when the content hash matches the existing sidecar metadata.

### Removed
- Removed the need for the new publish path to depend on the archived page-audio runtime.

## [0.1.5.2] - 2026-04-25

### Added
- Added Notion-owned Spotify playlist membership and ordering for the active refresh path using checked `Enabled` rows, exact `notion_name` title joins, populated `Output Folder`, and Notion `Order`.
- Added regression coverage for identity-only playlist files, required Notion membership, exact Notion title joins, checked-only inclusion, blank `Output Folder` omission, unknown folder failures, missing order failures, duplicate active row failures, and weekday-gated playlist skips.

### Changed
- Renamed Spotify queue contract `name` fields to `notion_name` and made playlist JSON files identity-only with `key`, `name`, and `playlist_id`.
- Updated the Spotify refresh workflow and README to document the hard Notion membership dependency and the `source=notion_membership` runtime.
- Updated the morning and evening Marian Antiphon Easter URI to the current Regina Caeli episode.

### Fixed
- Treat blank or missing Notion `Output Folder` values as inactive rows, matching unchecked `Enabled` behavior instead of failing the refresh.
- Preserve fail-closed validation for duplicate checked Notion rows, unknown populated `Output Folder` values, and missing `Order` values on placed rows.

### Removed
- Removed the stale legacy Spotify/Notion queue-builder helpers and skipped legacy tests that contradicted the active contract path.

## [0.1.5.1] - 2026-03-30

### Changed
- Moved the active scheduled GitHub Actions workflows into a midnight-ish Central time window by shifting the daily cron band from 08:00-08:30 UTC to 06:00-06:30 UTC.
- Preserved the daily Spotify refresh schedule gate and the manual `workflow_dispatch` entrypoints on the active workflows.
- Updated the README schedule note so the documented daily Notion reset time matches the new cadence.

### Fixed
- Kept the yearly January workflows on their intended dates while moving them earlier in the day.

## [0.1.4.2] - 2026-03-29

### Added
- Added season-aware Angelus contract fields for ordinary-time and Easter-season Spotify links.
- Added Romcal-backed Easter-season detection and regression coverage for the seasonal Angelus path.

### Changed
- Updated the Angelus refresh flow to choose the ordinary-time singing/spoken links outside Easter and the Regina Caeli singing/spoken links during Easter.
- Normalized resolved Spotify values to queue-safe `spotify:` URIs before writing playlist items.
- Updated the stabilization roadmap and README to describe the Angelus seasonal exception.

### Fixed
- Prevented partial seasonal Angelus contracts from loading and failing later at playlist write time.
- Kept non-Angelus resolver and weekday-gated contracts on the existing contract-first refresh path.

### Removed
- Removed the legacy single-URI Angelus contract entries `angelus-song.json` and `angelus-podcast.json`.

## [0.1.4.1] - 2026-03-29

### Added
- Added regression coverage for the managed-output cleanup path and the normalized Morning Prayer contract shape.

### Changed
- Moved the Morning Prayer publish destination into `config/custom_tts/morning-prayer.json` via `output_path`.
- Normalized the Morning Prayer runtime to derive its `output_folder` from the contract-owned publish path.
- Switched the remote Morning Prayer publish workflow to sync the contract-owned folder instead of copying it.
- Kept the managed-output truncation hook enabled so stale audio files are pruned before regeneration.

### Fixed
- Prevented stale OneDrive files from lingering when a Morning Prayer output disappears from the contract-owned source tree.

### Removed
- Removed the `random-intention` Morning Prayer resolver from the active contract shape.

## [0.1.4.0] - 2026-03-28

### Added
- Added regression coverage for custom-TTS-only discovery and explicit legacy-path rejection in the page-audio and Morning Prayer loaders.

### Changed
- Repointed `scripts/run_daily_novena_prayer_local.ps1` at `config/custom_tts/morning-prayer.json`.
- Kept `PAGE_AUDIO_CONFIG_FILE` and `PRAYER_CONFIG_FILE` as custom-TTS-only override hooks in the active runtime.
- Simplified `jobs/notion/generate_page_audio.py` so the main runtime no longer uses the managed-output truncation hook.
- Updated `README.md` and the shipped release artifact to describe the custom-TTS-only boundary and the final Morning Prayer cutover.

### Fixed
- Removed the legacy `config/legacy/page_audio` auto-scan from the active page-audio loader.
- Made legacy Morning Prayer contract and prayer-config override paths fail fast instead of loading archived files.
- Kept the active page-audio runtime on `config/custom_tts/` so legacy contracts no longer run or get copied over.

### Removed
- Removed the remote Morning Prayer publish workflow (`.github/workflows/morning_prayer_page_audio_remote.yml`).

## [0.1.3.2] - 2026-03-28

### Added
- Added `jobs/novena/liturgical_helpers.py` as the shared liturgical helper boundary for the devotional image and novena jobs.
- Added regression coverage for the shared helper bootstrap path and devotional-image eligibility filtering.

### Changed
- Cut `jobs/novena/generate_devotional_image.py` and `jobs/novena/generate_daily_novena_prayer.py` over to the shared helper module and removed the old `jobs/novena/liturgical_model.py` file.
- Simplified `.github/workflows/daily_devotional_image_remote.yml` so the active workflow now runs the devotional image job only.
- Updated `README.md` and the 0.1.3.2 release artifact to document the image-first rollout and keep the novena workflow disabled.

### Fixed
- Fixed direct script bootstrap for the devotional image and helper modules when run from an arbitrary working directory.
- Fixed the helper eligibility boundary so the image and novena paths share one consistent liturgical contract.

### Removed
- Removed the old novena helper module and the staged future-release planning files under `docs/releases/future-releases/`.

## [0.1.3.1] - 2026-03-27

### Added
- Added repo-owned Spotify queue contracts under `config/spotify/contracts/` and thin playlist definitions under `config/spotify/playlists/` for the Morning, Midday, Night, and Sunday playlists.
- Added a dedicated Spotify contract loader plus regression coverage for contract validation, playlist-definition queue assembly, and selected-playlist refresh runs.

### Changed
- Reworked the Spotify refresh path to assemble queues from committed contract files with explicit resolver metadata, optional fallback resolvers, and contract-level weekday gating.
- Updated the Spotify workflow, setup script, local runner, and README to document the contract-first refresh model and the corrected local module entrypoint.
- Moved the discontinued root-level page-audio, Morning Prayer, Rosary, and Auxilium contracts into `config/legacy/` and repointed the archived page-audio defaults at those legacy paths.

### Fixed
- Fixed the local Spotify refresh script so manual runs execute `python -m jobs.playlist.refresh_playlist` successfully instead of failing on module imports.
- Fixed the active Spotify contract titles and playlist membership to match the current live Opus Dei ordering.
- Fixed the legacy automation surface by disabling the archived page-audio workflow jobs before ship.

### Removed
- Removed required Opus Dei `Output Folder` grouping and required `NOTION_TOKEN` dependence from the active Spotify playlist refresh path.
- Removed legacy page-audio and prayer-generation test modules from the active test gate now that those jobs are discontinued.

## [0.1.3.0] - 2026-03-27

### Added
- Added single-contract execution mode for `PAGE_AUDIO_CONFIG_FILE`, so a selected JSON contract now runs by itself instead of silently rebuilding the shared bundled config set.
- Added page-audio library artifact fan-in and OneDrive sync stages to the prayer workflow, along with regression coverage for contract normalization, single-file loading, page-ID lookup, and legacy Divine Office builder compatibility.

### Changed
- Updated the Rosary contract to target the live Notion row `Daily Rosary with Intentions` and pinned its current page ID for stable remote resolution.
- Updated the prayer and devotional workflows to use the playlist-audio OneDrive root for page-audio sync work instead of reusing the devotional-image root.
- Documented that setting `PAGE_AUDIO_CONFIG_FILE` to a specific contract file now executes only that contract.

### Fixed
- Fixed Morning Prayer and Rosary matrix rows so they execute their selected contracts rather than unrelated shared page-audio configs.
- Fixed page lookup for file-backed contracts by honoring explicit Notion page IDs before stale title matches.
- Fixed legacy Divine Office builder compatibility needed by the page-audio migration tooling and tests.
- Fixed prayer-workflow sync safety so runs fail closed before upload when contract generation or artifact production fails.

## [0.1.2.3] - 2026-03-25

### Added
- Added a calendar-first devotional pipeline that generates devotional images and novenas before the prayer matrix runs.
- Added a final OneDrive sync job that downloads the page-audio artifacts from the matrix rows and uploads the merged library once.

### Changed
- Reworked `daily_devotional_image_remote.yml` into a two-stage workflow with `calendar` followed by `matrix` and a final `sync_page_audio_library` job.
- Moved the page-audio OneDrive delivery boundary out of the matrix rows to avoid concurrent sync races.
- Kept Morning Prayer as a matrix contract row while preserving the calendar-produced novena handoff.
- Kept GitHub Pages deployment gated to `main` so feature-branch runs stay focused on validation.

### Fixed
- Fixed the page-audio OneDrive sync failure caused by concurrent matrix rows racing to sync the same remote folder.
- Fixed the GitHub Actions artifact naming so page-audio library uploads use a valid matrix-based artifact name.
- Fixed the devotional image fallback path so the calendar job can continue when the Notion image config parent is unavailable.

## [0.1.2.1] - 2026-03-24

### Added
- Added a matrix-driven prayer contracts workflow that discovers top-level `config/*.json` files at runtime and fans out one page-audio job per contract.

### Changed
- Replaced the old Morning Prayer-only workflow body with a generic contract-driven matrix workflow.
- Documented the new matrix behavior in the project README.

### Fixed
- Fixed the workflow path mismatch by removing the stale nested Morning Prayer contract path from the GitHub Actions runner.

## [0.1.2.0] - 2026-03-24

### Added
- Added root-level file-backed page-audio contracts for Morning Prayer, Rosary, Sing the Hours, Divine Office Invitatory, Bible in a Year, Daily Mass Readings, Saint of the Day, Daily Examen, Angelus (Morning/Midday/Evening), Afternoon Prayer, and Auxilium Christianorum.
- Added Rosary weekday mystery mapping and reusable fragment composition from the contract tree.
- Added file-backed prayer content under `config/content/` and moved the active contract JSONs to the root `config/` directory.

### Changed
- Refactored the page-audio refresh loop to iterate config files first and use Notion only for the `Name`, `Order`, and `Output Folder` page fields.
- Removed the legacy page-audio and playlist/sync config merge paths so file contracts are authoritative.
- Updated Morning Prayer LOH and Evening Prayer LOH to resolve from the config-driven RSS builder path.
- Normalized active contract filenames and removed stale fallback chains outside the Morning Prayer contract.

### Fixed
- Fixed Daily Examen to resolve from the provided episode page.
- Fixed the Morning Prayer LOH and Evening Prayer LOH page-audio refresh flow so it completes against the new contract-first loop.
- Fixed OneDrive export naming to use the current Notion `Output Folder` column and contract-derived content.
- Fixed Rosary to compile from resolver order instead of the older flow fixture shape.

## [0.1.0.1] - 2026-03-23

### Added
- Added a reusable Morning Prayer construction cleanup release artifact and shipped notes for the Morning Prayer audio construction cutover.
- Added `.gitignore` entries for local `.agents/` and `.copilot/` directories.
- Added a future-release planning note for the next Rosary prayer work.

### Changed
- Removed the Spotify resolver from the Morning Prayer contract and content assembly path.
- Disabled the daily Spotify playlist workflow job and its local mirror script.
- Updated Morning Prayer content generation so the page-content path follows the generic construction pattern without playlist behavior.
- Updated the Morning Prayer release artifact, progress tracking, and shipped status to match the cutover.

### Fixed
- Fixed the Morning Prayer resolver count expectation to match the updated 13-item contract.
- Kept Morning Prayer audio generation working end to end after removing the playlist construction branch.

## [0.1.0.0] - 2026-03-23

### Added
- Added a generic `jobs/notion/generate_prayer.py` runner that loads a prayer JSON config and executes Morning Prayer from that contract.
- Added the repo-local Morning Prayer contract and file-backed content sources under `config/morning-prayer/`.
- Added future-release planning docs for the shared calendar service, novena consumer layer, devotional image refactor, and later prayer add-backs.

### Changed
- Narrowed `.github/workflows/daily_novena_prayer.yml` into a Morning Prayer workflow that calls the generic prayer runner.
- Updated `scripts/run_daily_novena_prayer_local.ps1` to call the generic prayer runner with the Morning Prayer config.
- Shifted Morning Prayer to a config-driven path while keeping audio file materialization for OneDrive.
- Removed the old Morning Prayer test shape that exercised the legacy multi-prayer constructions.
- Updated the Morning Prayer architecture and release docs to describe the hard cutover and the future enhancement ladder.

### Fixed
- Fixed direct execution of `jobs/notion/generate_prayer.py` by adding repo-root import bootstrap.
- Fixed local Morning Prayer regeneration so the new runner executes successfully from the repo root.
- Fixed the remote GitHub Actions Morning Prayer workflow so it completes end to end on the cutover branch.

## [0.0.5.3] - 2026-03-23

### Fixed
- Fixed the daily novena job so `jobs/novena/generate_daily_novena_prayer.py` can run directly in GitHub Actions without a `ModuleNotFoundError` for `jobs`.
- Added regression coverage for the direct-import startup path to keep the import bootstrap from regressing.

## [0.0.5.2] - 2026-03-23

### Added
- Added a dedicated Liturgical Calendar sync regression test module covering backfill range selection, rerunnable upserts, and archived-row handling.

### Changed
- Clarified the Liturgical Calendar yearly sync docs with a concrete 2026-2027 repopulation example and explicit rerun guidance.
- Renamed the Liturgical Calendar sync surface so the calendar workflow uses Liturgical Calendar naming while preserving the legacy Saint Radar helper compatibility.

### Fixed
- Fixed the Liturgical Calendar yearly sync so archived or in-trash rows are ignored during upsert and duplicate cleanup, allowing reruns to create fresh live pages instead of patching deleted ones.
- Fixed the live Liturgical Calendar backfill path so the 2026-2027 repopulation completes successfully and preserves Palm Sunday and Easter Sunday rows.

## [0.0.5.1] - 2026-03-22

### Changed
- Introduced a shared liturgical eligibility helper so devotional outputs now use one rank-and-precedence contract across novena and devotional-image generation.
- Documented that devotional outputs intentionally allow memorials, feasts, and solemnities, including non-saint feasts such as Palm Sunday or Epiphany, while explicitly excluding Easter Octave weekdays by precedence.
- Updated the release artifact and backlog notes to reflect the Holy Week novena cleanup work.

### Fixed
- Fixed the novena pipeline so Holy Week weekdays no longer qualify for day-by-day novena generation under the new rank-based contract.
- Fixed the devotional-image pipeline so Easter Octave weekdays no longer qualify, even though the shared Romcal model still maps them to the pseudo-rank `solemnity-easter octave`.
- Added cleanup for already-generated ineligible novena sections and audio markers so stale Holy Week outputs are removed on subsequent runs.
- Added regression coverage for rank-based inclusion, Holy Week exclusion, Easter Octave exclusion, and invalid-output cleanup.

## [0.0.5.0] - 2026-03-22

### Changed
- Migrated the repo onto the `docs/releases/` workflow artifacts so release planning, progress, QA, and shipped context now live in one canonical location.
- Carried forward the consolidated historical release context from the old `release/releaselog.md` source into the new release-folder contract.
- Documented Morning Prayer detailed fragments as a stable-key workflow where `Fragment Key` is the runtime identity and the row title can evolve independently.

### Fixed
- Fixed Morning Prayer detailed-fragment validation so it now matches required contract rows by stable key instead of exact display label.
- Fixed Morning Prayer migration/preflight matching so existing rows with the correct canonical key can be relinked even after a title rename such as `Petition - Church` -> `Petition - Right Use of Technology`.
- Added regression coverage for renamed-label acceptance, missing-key rejection, and explicit detailed-fragment key preference in the page-audio and migration suites.

## Enhancement 000: Morning Prayer Fragment Migration
- Moved Morning Prayer planning from the legacy audio-composition path toward the two-list Opus Dei + Detailed Fragments model.
- Captured the migration boundary for Morning Prayer, including the required fragment set and the need to avoid orphaned legacy fragment rows.
- Documented the related Notion fragment-view recipe so the new detailed-fragments database stays readable and ordered.

## Enhancement 001: Ordered Playlist Audio and Managed Truncation
- Standardized ordered `Playlist Audio` exports around top-level `Order` while keeping Morning Prayer's working page-body behavior intact.
- Added managed daily truncation so stale playlist-audio files disappear before the rebuild and sync step.
- Preserved the mixed text-sync model so reliable text sources can sync without breaking established writers.

## Enhancement 002: Order-First Playlist Naming
- Updated ordered `Playlist Audio` filenames so the order token comes first in the stem.
- Kept the same spaced separator style and continued using the shared top-level `Order` contract for queueing and export naming.
- Required `Output Folder` for ordered exports and retained managed truncation before sync.

## Enhancement 003: Romcal Overlay and Special Sunday Normalization
- Added a synthetic Romcal child calendar overlay that inherits from the requested calendar and applies explicit special-Sunday normalization rules.
- Normalized the Easter Octave pseudo-rank and expanded the devotional-image allowlist so it can recognize the special celebration state.
- Added regression coverage for named special Sundays, Easter Octave, Christmas, Pentecost, Christ the King, and ordinary Sundays.

## Bug 001: Daily Novena Stale-Audio Regeneration
- Fixed the daily novena audio workflow so reruns rebuild the managed novena audio subtree cleanly.
- Added regression coverage for the stale-audio rerun case.
- Updated the README and progress notes to describe the cleanup behavior.
- Verified the fix with `py -3 -m unittest tests.test_novena_job`, `py -3 -m unittest tests.test_page_audio_job`, and the full test suite.

## Bug 002: Daily Novena Legacy Prefetch Cleanup
- Made the legacy OneDrive novena prefetch explicitly optional.
- The daily novena workflow now skips the legacy copy when `DEVOTIONAL_ONEDRIVE_REMOTE_ROOT` is unset.
- Updated the README and progress notes to document the opt-in legacy path.
- Verified the workflow locally and with a remote GitHub Actions run that logged the skip message instead of the missing-root error.

## [0.1.5.6] - 2026-04-27

### Changed
- Added date-scoped Morning Prayer episode metadata so each day now publishes its own title, description, guid, and sidecar state.
- Introduced a contract-owned `daily_intro` block for the Morning Prayer opening, powered by Romcal, `catholic-mass-readings`, and OpenAI text generation.
- Kept the TTS voice on `alloy` while moving the prompt text model onto the repo's existing `OAI_MODEL` convention.
- Added safe template rendering for contract metadata and archive-aware RSS rebuilding from published sidecars.

### Fixed
- Fixed daily reruns so today's publish overwrites only today's date-scoped episode artifacts instead of an evergreen record.
- Fixed the publish pipeline to preserve prior date-scoped episodes in the feed while still allowing today's run to refresh cleanly.
- Added coverage for the new daily intro, date-scoped audio paths, and archive-aware feed rebuilds.

## Notes
- This file initializes the `docs/releases/` contract from the prior `release/releaselog.md` source.
- Historical context still exists in git history if deeper detail is needed.
