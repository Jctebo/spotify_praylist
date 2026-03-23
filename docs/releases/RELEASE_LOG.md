# Release Log

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
