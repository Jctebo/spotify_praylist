# Release Log

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

## Notes
- This file initializes the `docs/releases/` contract from the prior `release/releaselog.md` source.
- Historical context still exists in git history if deeper detail is needed.
