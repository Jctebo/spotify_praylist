# Implementation Plan

## Metadata
- Project: spotify_praylist
- Task: bug_002 daily novena legacy prefetch cleanup
- Date: March 18, 2026
- Planner: Codex
- Status: Draft

## Source references
- Requirements: `docs/bug_002/001_.md`
- Research: `docs/bug_002/002_research.md`
- DeepWiki:
  - https://deepwiki.com/humanlayer/advanced-context-engineering-for-coding-agents/3.2-planning-phase
  - https://deepwiki.com/humanlayer/advanced-context-engineering-for-coding-agents/3.1-research-phase

## Goal
Eliminate the missing-root noise in the daily novena workflow by making the legacy OneDrive novena prefetch explicitly opt-in, while keeping the primary `Praylist Audio` mirror behavior unchanged.

## Chosen approach
Change the `Prefetch Audio Libraries from OneDrive` shell step so the legacy `Novena Audio Library` backfill runs only when `DEVOTIONAL_ONEDRIVE_REMOTE_ROOT` is explicitly set. If the variable is blank, the step should skip the legacy copy entirely and continue with the current primary root prefetch.

Keep the rest of the workflow unchanged: the job should still restore the current novena library, generate audio, upload the novena library, and run page audio exactly as before. The documentation should describe the legacy path as optional migration support instead of a default fallback.

## Files to modify

- `.github/workflows/daily_novena_prayer.yml`
  - Why it changes: remove the unconditional legacy fallback root and skip the legacy copy when no legacy root is configured.
  - Key symbols affected: `Prefetch Audio Libraries from OneDrive`, `DEVOTIONAL_ONEDRIVE_REMOTE_ROOT`, `LEGACY_ROOT`, the legacy `rclone copy` call.

- `README.md`
  - Why it changes: document the legacy backfill path as optional and explain that it only runs when explicitly configured.
  - Key symbols affected: `DEVOTIONAL_ONEDRIVE_REMOTE_ROOT`, the daily novena setup section.

- `docs/bug_002/001_.md`
  - Why it changes: align the requirements with the implemented workflow behavior.
  - Key symbols affected: objective, requirements, acceptance criteria.

- `docs/bug_002/002_research.md`
  - Why it changes: keep the research artifact aligned with the final shell-step behavior.
  - Key symbols affected: the legacy-root optionality findings.

- `docs/bug_002/004_progress.md`
  - Why it changes: record the cleanup task state and verification results.
  - Key symbols affected: task summary, completed phases, test results.

## Files to create

- `docs/bug_002/001_.md`
  - Purpose: requirements document for the legacy prefetch cleanup.

- `docs/bug_002/002_research.md`
  - Purpose: research notes for the workflow cleanup.

- `docs/bug_002/003_plan.md`
  - Purpose: implementation plan for the cleanup.

- `docs/bug_002/004_progress.md`
  - Purpose: live progress record for the cleanup task.

## Files to verify but not modify

- `jobs/novena/generate_daily_novena_prayer.py`
  - What to confirm: no novena-generation behavior changes are needed for this workflow-only cleanup.

- `tests/test_novena_job.py`
  - What to confirm: the novena job tests remain green after the workflow-only change.

- `docs/bug_001/004_progress.md`
  - What to confirm: the prior remote-run notes remain accurate and do not need edits.

## Phase breakdown

### Phase 1: Finalize docs
Objective:
- write the requirements, research, plan, and progress artifacts for bug_002

Files:
- `docs/bug_002/001_.md`
- `docs/bug_002/002_research.md`
- `docs/bug_002/003_plan.md`
- `docs/bug_002/004_progress.md`

Symbols:
- document metadata, requirements, workflow references

Changes to make:
- create the bug_002 documentation set using the prompt templates
- make the docs describe the legacy prefetch as optional migration support

Verification:
- docs clearly state that the legacy root is opt-in

Rollback / recovery:
- if the doc scope is wrong, revise the docs before editing the workflow

Risks:
- documentation could accidentally imply the legacy path is deprecated if it is still needed for migration

### Phase 2: Patch the workflow prefetch step
Objective:
- stop the workflow from attempting the legacy novena copy when no legacy root is configured

Files:
- `.github/workflows/daily_novena_prayer.yml`

Symbols:
- `Prefetch Audio Libraries from OneDrive`
- `DEVOTIONAL_ONEDRIVE_REMOTE_ROOT`
- `LEGACY_ROOT`

Changes to make:
- remove the hard-coded fallback path for the legacy root
- wrap the legacy `rclone copy` in a conditional that only runs when the env var is set
- optionally emit a short skip message when the legacy root is absent

Verification:
- the workflow still copies the primary `Praylist Audio` libraries
- the legacy copy no longer runs by default

Rollback / recovery:
- restore the previous fallback behavior only if a real migration workflow still depends on it

Risks:
- an explicit legacy user may need to set `DEVOTIONAL_ONEDRIVE_REMOTE_ROOT` after this change

### Phase 3: Update runtime docs
Objective:
- document the cleaned-up legacy-prefetch contract

Files:
- `README.md`
- `docs/bug_002/001_.md`
- `docs/bug_002/002_research.md`

Symbols:
- `DEVOTIONAL_ONEDRIVE_REMOTE_ROOT`
- daily novena setup notes

Changes to make:
- explain that the legacy path is optional and migration-only
- note that the workflow skips it when the env var is blank

Verification:
- docs match the workflow behavior and do not promise a hidden fallback

Rollback / recovery:
- update the docs again if the workflow logic changes

Risks:
- stale docs could leave the optional legacy behavior unclear

### Phase 4: Verify and record
Objective:
- confirm the workflow change is safe and log the result

Files:
- `docs/bug_002/004_progress.md`
- `.github/workflows/daily_novena_prayer.yml`

Symbols:
- progress entries
- workflow run summary

Changes to make:
- validate the workflow logic locally by inspection
- if possible, run the remote workflow and confirm the missing-root error is gone
- record the verification result in the progress doc

Verification:
- no missing-root error appears when `DEVOTIONAL_ONEDRIVE_REMOTE_ROOT` is unset
- the primary novena prefetch and later steps still succeed

Rollback / recovery:
- if the workflow still needs the legacy path by default, revert to the previous behavior and adjust the docs

Risks:
- a remote run may still surface unrelated OneDrive transfer retries even after the cleanup

## Dependency and sequencing notes
- Phase 1 must happen before code changes so the docs match the intended behavior.
- Phase 2 is the only code change required.
- Phase 3 should follow immediately after the workflow patch so the docs do not lag behind.
- Phase 4 can be done locally or remotely depending on environment access.

## Test strategy

### Unit
- no new unit tests expected

### Integration
- inspect the workflow shell step locally to confirm the legacy branch is conditional
- if available, trigger the `Daily Novena Prayer` workflow on GitHub Actions and watch the run

### Manual verification
- confirm the workflow logs no longer mention the missing `Pictures/Samsung Gallery/DCIM/Novena Audio Library` path when the env var is unset
- confirm the primary `Praylist Audio` prefetch still runs

### Performance / safety checks
- ensure the workflow still completes without adding extra steps or retries

## Edge cases to validate
- `DEVOTIONAL_ONEDRIVE_REMOTE_ROOT` unset
- `DEVOTIONAL_ONEDRIVE_REMOTE_ROOT` set to a valid legacy root
- primary audio root present but legacy root missing

## Non-goals during implementation
- changing novena generation
- changing the audio sync destinations
- refactoring unrelated workflow logic

## Plan quality self-check
- Are all file paths exact? Yes
- Are all major symbols named? Yes
- Can each phase be verified independently? Yes
- Is there any implementation code that should be removed? No
- Could a fresh agent implement from this alone? Yes

## Exit recommendation
- Ready for implementation: Yes
- If No, what needs to change?

