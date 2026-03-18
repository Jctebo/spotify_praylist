# Implementation Plan

## Metadata
- Project: spotify_praylist
- Task: bug_001 daily novena stale-audio regeneration
- Date: March 18, 2026
- Planner: Codex
- Status: Approved

## Source references
- Requirements: `docs/bug_001/001_.md`
- Research: `docs/bug_001/002_research.md`
- DeepWiki:
  - https://deepwiki.com/humanlayer/advanced-context-engineering-for-coding-agents/3.2-planning-phase
  - https://deepwiki.com/humanlayer/advanced-context-engineering-for-coding-agents/3.1-research-phase

## Goal
Diagnose why the daily novena audio run can leave stale audio behind, then implement the smallest reliable fix so a rerun replaces the managed audio set cleanly. The plan should verify whether the bug is in local artifact cleanup, filename/order contract changes, or the OneDrive sync boundary, and then add regression coverage for the confirmed failure mode.

## Chosen approach
Use the existing daily novena pipeline as the execution path and treat the local novena audio library as the first boundary to inspect. The selected fix is an always-on managed-output cleanup step that clears the current novena library subtree before regeneration, then lets the existing `rclone sync` mirror the clean state to OneDrive.

The implementation should preserve the current Notion cleanup behavior, since the research shows the page-body side already uses marker-based removal. The main job is to make the generated local audio tree deterministic across reruns, especially if ordering or filename changes are causing old files to survive outside the new output set.

## Files to modify

- `jobs/novena/generate_daily_novena_prayer.py`
  - Why it changes: inspect the current novena audio library build path and add or adjust managed cleanup if the bug is in local generation state.
  - Key symbols affected: `novena_audio_library_dir`, `ensure_saint_novena_audio_library`, `maybe_generate_and_attach_audio`, `main`, any local cleanup helpers added for managed novena audio.

- `README.md`
  - Why it changes: document the managed novena audio cleanup behavior if the bug fix changes operational expectations.
  - Key symbols affected: the daily novena audio section and any environment variable references.

- `tests/test_novena_job.py`
  - Why it changes: add or adjust coverage for stale novena audio cleanup and rerun behavior.
  - Key symbols affected: the novena job test cases that exercise audio generation, cache reuse, and page attachment behavior.

- `tests/test_page_audio_job.py`
  - Why it changes: verify the managed-output cleanup precedent still behaves as expected and use it as a reference for any analogous cleanup logic.
  - Key symbols affected: `truncate_managed_page_audio_outputs` and the related export cleanup tests.

## Files to create

- None expected unless the implementation needs a small shared helper for managed novena output cleanup.

## Files to verify but not modify

- `jobs/notion/generate_page_audio.py`
  - What to confirm: the existing managed-output truncation pattern is still the right behavioral precedent.

- `tests/test_refresh_job.py`
  - What to confirm: no unrelated ordering or sync regression is introduced by changes to the novena workflow.

- `docs/bug_001/002_research.md`
  - What to confirm: the implementation matches the local-vs-remote stale-output hypothesis documented there.

- `.github/workflows/daily_novena_prayer.yml`
  - What to confirm: the scheduled job already mirrors the managed novena library tree with `rclone sync` and does not need a new toggle.

## Phase breakdown

### Phase 1: Reproduce and isolate the stale-output boundary
Objective:
- determine whether stale audio survives in the local novena library, the remote OneDrive destination, or both

Files:
- `jobs/novena/generate_daily_novena_prayer.py`
- `.github/workflows/daily_novena_prayer.yml`
- `tests/test_novena_job.py`

Symbols:
- `novena_audio_library_dir`
- `ensure_saint_novena_audio_library`
- `main`

Changes to make:
- inspect the current local library layout used by the daily novena workflow
- trace whether reruns overwrite, append, or leave orphaned files in the novena audio tree
- confirm whether order or naming changes create a new filename set while older files remain

Verification:
- identify the exact managed directory boundary where stale files persist
- confirm whether the Notion page cleanup path is already behaving correctly

Rollback / recovery:
- no code changes should be necessary in this phase
- if the issue cannot be reproduced locally, note the exact environment gap and continue from workflow evidence

Risks:
- the symptom may look like one bug but actually come from multiple filename and sync behaviors

### Phase 2: Define the managed cleanup contract
Objective:
- specify which novena audio artifacts are safe to rebuild and remove on every run

Files:
- `jobs/novena/generate_daily_novena_prayer.py`
- `README.md`

Symbols:
- `novena_audio_library_dir`
- any new cleanup helper

Changes to make:
- define the managed novena output subtree explicitly
- use full-tree truncation within that managed subtree before regeneration
- align the contract with the existing OneDrive sync behavior

Verification:
- the cleanup boundary is narrow enough to avoid unrelated cached audio
- the boundary is broad enough to remove stale novena artifacts after reruns

Rollback / recovery:
- if the cleanup boundary is ambiguous, stop and narrow it before editing runtime logic

Risks:
- removing too much could delete cached files that are still intended to persist

### Phase 3: Implement local managed-output cleanup
Objective:
- make rerunning the daily novena job produce a clean local audio tree before sync

Files:
- `jobs/novena/generate_daily_novena_prayer.py`

Symbols:
- `ensure_saint_novena_audio_library`
- `main`
- any helper that enumerates or truncates managed novena audio files

Changes to make:
- remove stale managed novena audio artifacts locally before regeneration or before upload
- keep the existing audio generation behavior intact apart from cleanup
- preserve the current Notion audio/page-writing flow

Verification:
- a second run no longer leaves old audio artifacts in the managed local subtree
- regenerated files reflect the current ordering and naming contract

Rollback / recovery:
- if cleanup causes missing files or over-deletion, revert only the cleanup hook and keep the investigation notes

Risks:
- order changes may hide the bug if the cleanup only addresses exact filename collisions

### Phase 4: Preserve workflow sync semantics
Objective:
- ensure the scheduled job still mirrors the cleaned local state to OneDrive correctly

Files:
- `.github/workflows/daily_novena_prayer.yml`

Symbols:
- daily novena generation step
- OneDrive prefetch step
- OneDrive upload step

Changes to make:
- keep the prefetch and `rclone sync` flow intact
- make sure the remote sync still removes stale remote files by mirroring the clean local tree

Verification:
- the workflow still prefetches the library, generates audio, and syncs the managed subtree
- stale remote files disappear after a rerun when the local tree has been cleaned

Rollback / recovery:
- no workflow toggle is expected; keep the scheduled job unchanged unless the cleanup boundary proves incorrect

Risks:
- a workflow-only change will not fix the bug if the local tree remains dirty

### Phase 5: Add regression tests
Objective:
- prove the stale-audio case stays fixed across reruns

Files:
- `tests/test_novena_job.py`
- `tests/test_page_audio_job.py`

Symbols:
- novena cleanup and generation test cases
- `truncate_managed_page_audio_outputs`

Changes to make:
- add coverage for rerunning the daily novena job without leaving stale artifacts behind
- verify the cleanup boundary removes obsolete audio but preserves intended files
- use the playlist-audio truncation tests as a model for the expected behavior

Verification:
- tests fail before the fix and pass after the fix
- the regression test demonstrates stale output removal on rerun

Rollback / recovery:
- keep the tests even if the implementation evolves slightly, since the regression intent is the important part

Risks:
- tests may need fixtures or temp directories that mirror the actual managed audio path closely enough to be meaningful

### Phase 6: Update operational docs
Objective:
- document the new managed cleanup behavior

Files:
- `README.md`

Symbols:
- daily novena audio documentation
- environment variable documentation

Changes to make:
- explain the cleanup behavior for daily novena audio reruns
- note that no new workflow toggle is required
- clarify what is considered managed output versus cached input

Verification:
- the docs match the runtime behavior and do not promise broader cleanup than the implementation provides

Rollback / recovery:
- if the implementation changes again, update the docs in the same change set or remove stale guidance

Risks:
- docs could overstate the cleanup boundary if the implementation stays narrowly scoped

## Dependency and sequencing notes
- Phase 1 must happen before code changes so we know whether the bug is local cleanup, sync behavior, or both.
- Phase 2 should settle the managed-output boundary before any deletion logic is added.
- Phase 3 depends on Phase 2 and should not be implemented until the cleanup contract is clear.
- Phase 4 is only needed if the workflow needs an explicit toggle or if the job’s orchestration needs adjustment.
- Phase 5 should come after the behavior is stable enough to test meaningfully.
- Phase 6 should land last, after the runtime contract is settled.

## Test strategy

### Unit
- `python -m unittest tests.test_novena_job`
- `python -m unittest tests.test_page_audio_job`

Coverage focus:
- stale novena audio rerun behavior
- managed cleanup boundary behavior
- preserved Notion audio/page behavior

### Integration
- run the daily novena job against a temporary local library root if the environment can supply the required secrets and fixtures
- confirm that a rerun leaves only the current managed novena artifacts in the local output tree

### Manual verification
- inspect the novena audio library before and after a rerun
- confirm that files no longer intended for the current run are removed
- if the workflow is available, verify the OneDrive remote mirror matches the cleaned local tree after `rclone sync`

### Performance / safety checks
- ensure cleanup does not introduce a noticeable delay in the daily run
- confirm unrelated cached or non-managed artifacts are not deleted

## Edge cases to validate
- filenames or folder names change between runs
- order changes create a new output stem while old stems remain present
- rerunning the job on the same day with identical inputs
- partial generation failure after cleanup but before upload

## Non-goals during implementation
- redesigning the entire novena generation pipeline
- changing the audio content itself unless required to fix stale-output behavior
- broad refactors of unrelated playlist or enhancement workflows

## Plan quality self-check
- Are all file paths exact? Yes
- Are all major symbols named? Yes
- Can each phase be verified independently? Yes
- Is there any implementation code that should be removed? No
- Could a fresh agent implement from this alone? Yes

## Exit recommendation
- Ready for implementation: Yes
- If No, what needs to change?
