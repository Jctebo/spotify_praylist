# Implementation Plan

## Metadata
- Project: `spotify_praylist`
- Task: Enhancement 002, order-first `Playlist Audio` filename contract
- Date: March 21, 2026
- Planner: Codex
- Status: Draft

## Source references
- Requirements: [docs/enhancement_002/00_scope.md](c:/Users/jcteb/Code/spotify_praylist/docs/enhancement_002/00_scope.md)
- Research: [docs/enhancement_002/01_reserach.md](c:/Users/jcteb/Code/spotify_praylist/docs/enhancement_002/01_reserach.md)
- DeepWiki:
  - https://deepwiki.com/humanlayer/advanced-context-engineering-for-coding-agents/3.2-planning-phase
  - https://deepwiki.com/humanlayer/advanced-context-engineering-for-coding-agents/3.1-research-phase

## Goal
Change the ordered `Playlist Audio` export contract so filenames are emitted as `Order - Folder - Entry`, while keeping `.mp3` and `.json` sidecars paired, preserving managed truncation, and making `Output Folder` required for ordered exports.

## Chosen approach
Make the export contract change in the existing page-audio pipeline rather than adding a new job. The shared top-level order contract stays in place, but the export stem will be assembled in order-first form and will fail clearly when `Output Folder` is missing.

Update the enhancement docs first, then change the exporter, then update tests and runtime documentation. That sequencing keeps the contract explicit before code changes land and reduces the risk of reintroducing the old folder-first naming rule.

## Files to modify
- `docs/enhancement_002/00_scope.md`
  - keep the scope aligned with the final ordered export contract and required `Output Folder`
- `docs/enhancement_002/01_reserach.md`
  - keep the research artifact aligned with the final implementation decision
- `docs/enhancement_002/02_plan.md`
  - new implementation blueprint for this enhancement
- `jobs/notion/generate_page_audio.py`
  - update export folder resolution
  - update ordered filename stem assembly
  - preserve collision validation, sidecar generation, and managed truncation
- `tests/test_page_audio_job.py`
  - update export metadata assertions
  - add required-folder failure coverage
  - keep collision and truncation coverage
- `README.md`
  - update the runtime docs for the new order-first filename contract and required `Output Folder`

## Phase breakdown

### Phase 1: Docs first
Objective:
- ensure the enhancement docs describe the final contract before code changes start

Files:
- `docs/enhancement_002/00_scope.md`
- `docs/enhancement_002/01_reserach.md`
- `docs/enhancement_002/02_plan.md`

Changes to make:
- confirm the order-first stem format
- confirm `Output Folder` is required
- keep the research and plan artifacts consistent with the same contract

Verification:
- the three enhancement docs agree on the same stem format and folder requirement

Rollback / recovery:
- restore the previous doc wording if the implementation decision changes

Risks:
- stale doc language could preserve the wrong fallback behavior in future edits

### Phase 2: Export contract
Objective:
- update the page-audio exporter to emit order-first filenames and fail clearly when the folder is missing

Files:
- `jobs/notion/generate_page_audio.py`

Symbols:
- `page_audio_export_group_name`
- `page_audio_export_metadata`
- `page_audio_output_library_paths`
- `persist_page_audio_output_library`

Changes to make:
- require `Output Folder` before building ordered exports
- generate `Order - Folder - Entry` stems
- keep the same `.mp3` and `.json` stem pairing
- preserve existing collision checks and managed truncation logic

Verification:
- a representative export builds the expected `Order - Folder - Entry` stem
- missing `Output Folder` produces a clear row-specific error

Rollback / recovery:
- revert the stem assembly and folder requirement if export behavior regresses

Risks:
- rows that relied on the old `Playlist` fallback will now fail until configured correctly

### Phase 3: Tests
Objective:
- lock the new contract in with coverage

Files:
- `tests/test_page_audio_job.py`
- `tests/test_refresh_job.py`

Symbols:
- export metadata tests
- duplicate-stem validation tests
- truncation tests
- shared order-contract tests

Changes to make:
- update expected export stems
- add a missing-folder failure case
- preserve duplicate-stem rejection and truncation checks
- keep refresh ordering tests as a guard that the shared order contract remains unchanged

Verification:
- unit tests cover the new stem format, missing-folder failure, and existing cleanup behavior

Rollback / recovery:
- adjust test fixtures to the new contract if the code changes remain correct but the expectations are stale

Risks:
- test data may still assume the old `Playlist` fallback unless updated carefully

### Phase 4: Runtime docs
Objective:
- document the delivered behavior for future maintainers

Files:
- `README.md`

Changes to make:
- update the `Auto Page Audio` section to show the new order-first stem
- document that `Output Folder` is required for ordered exports

Verification:
- README wording matches the final code path and file naming contract

Rollback / recovery:
- edit the docs again if the implementation contract changes before merge

Risks:
- stale runtime docs could cause future changes to reintroduce the old naming rule

## Dependency and sequencing notes
- Phase 1 must happen before code changes so the contract is explicit.
- Phase 2 depends on the final folder policy and stem shape decided in the docs.
- Phase 3 depends on Phase 2 because the expected filenames and errors will change.
- Phase 4 should happen after the code stabilizes so the docs match the shipped behavior.

## Test strategy
### Unit
- `python -m unittest tests.test_page_audio_job`
- `python -m unittest tests.test_refresh_job`

### Manual verification
- inspect one generated export in a temp library root
- confirm the audio and JSON sidecar share the same order-first stem
- confirm missing `Output Folder` fails clearly

## Edge cases to validate
- missing `Output Folder`
- duplicate stems in the same folder
- order values with integer and decimal display forms
- managed truncation with renamed files

## Non-goals during implementation
- changing the separator style away from spaced ` - `
- renaming other audio libraries
- changing the shared top-level order contract itself

