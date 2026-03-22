# Implementation Plan

## Metadata
- Project: Prompt gallery repo extraction
- Task: Create a standalone prompt-gallery repo and workspace support
- Date: March 19, 2026
- Planner: Codex
- Status: Draft

## Source references
- Requirements: `docs/new_repo_request/01_requirements.md`
- Research: `docs/new_repo_request/02_research.md`
- Methodology: `docs/prompt_gallery/000_prompts.md`

## Goal
Create a standalone prompt-gallery repo that can be reused across projects, add workspace support for opening it alongside other repos, and keep this current repo as the home for the request-specific documentation bundle.

## Chosen approach
Use the existing prompt-gallery docs as the content source, move them into a new dedicated repo, and add a workspace file that includes the new repo as a separate root. Keep the request bundle in this repo as the record of the migration request and its implementation context.

The implementation should treat the reusable prompt-gallery methodology and the request-specific artifact chain as separate concerns. The reusable prompt instructions stay in the gallery repo, while the request bundle stays here.

## Files to modify
- `docs/new_repo_request/00_request.md`
  - Why it changes: preserve the source request in the new two-digit naming scheme.
- `docs/new_repo_request/01_requirements.md`
  - Why it changes: record the requirements for the repo split.
- `docs/new_repo_request/02_research.md`
  - Why it changes: record the current repo findings that support the plan.
- `docs/new_repo_request/03_plan.md`
  - Why it changes: this is the plan artifact itself.

## Files to create
- `docs/new_repo_request/04_implement.md`
  - Purpose: execution guide for the future repo split.
- `docs/new_repo_request/05_progress.md`
  - Purpose: progress log to be updated during implementation.
- `docs/new_repo_request/06_review.md`
  - Purpose: final review artifact after implementation.
- `prompt-gallery/README.md`
  - Purpose: entrypoint for the standalone prompt-gallery repo.
- `prompt-gallery/docs/000_prompts.md`
  - Purpose: reusable methodology prompt in the new repo.
- `prompt-gallery/docs/00_requirements.md`
- `prompt-gallery/docs/01_research.md`
- `prompt-gallery/docs/02_plan.md`
- `prompt-gallery/docs/03_implement.md`
- `prompt-gallery/docs/04_progress.md`
- `prompt-gallery/docs/05_review.md`
- `prompt-gallery/prompt-gallery.code-workspace`
  - Purpose: workspace file that can open the gallery repo alongside other projects.

## Files to verify but not modify
- `docs/prompt_gallery/000_prompts.md`
  - What to confirm: the content being moved is the correct reusable method source.
- `docs/prompt_gallery/00_requirements.md`
  - What to confirm: the existing prompt-gallery lifecycle is consistent with the new repo structure.
- `README.md`
  - What to confirm: the current repo remains application-specific and does not claim to be the reusable gallery.

## Phase breakdown

### Phase 1: Confirm boundaries
Objective:
- lock the split between the reusable gallery repo and the request-specific docs in this repo

Files:
- `docs/new_repo_request/01_requirements.md`
- `docs/new_repo_request/02_research.md`

Changes to make:
- confirm the target repo scope and workspace purpose
- keep the request bundle separate from the reusable method docs

Verification:
- the requirements and research agree on what moves and what stays

Rollback / recovery:
- if the boundary is still unclear, refine the requirements before moving anything

Risks:
- mixed ownership between the two repos

### Phase 2: Stand up the target repo
Objective:
- create the standalone prompt-gallery repo skeleton

Files:
- `prompt-gallery/README.md`
- `prompt-gallery/docs/000_prompts.md`

Changes to make:
- move the reusable methodology into the new repo
- preserve the original prompt-gallery content and ordering

Verification:
- the new repo contains the reusable prompt-gallery method docs

Rollback / recovery:
- if the new repo layout is wrong, adjust the scaffold before deleting anything from the source repo

Risks:
- content drift during the move

### Phase 3: Add workspace support
Objective:
- make the new repo easy to open with other projects

Files:
- `prompt-gallery/prompt-gallery.code-workspace`

Changes to make:
- define the workspace roots needed for cross-project use
- keep the workspace file simple and reusable

Verification:
- the workspace opens the prompt-gallery repo as a separate root

Rollback / recovery:
- if the workspace format is unsuitable, switch to the format supported by the intended editor

Risks:
- choosing a workspace format that does not fit the user's actual workflow

### Phase 4: Clean up the source repo
Objective:
- remove the reusable gallery from this current repo once the new repo is ready

Files:
- `docs/prompt_gallery/000_prompts.md`
- `docs/prompt_gallery/00_requirements.md`
- `docs/prompt_gallery/01_research.md`
- `docs/prompt_gallery/02_plan.md`
- `docs/prompt_gallery/03_implement.md`
- `docs/prompt_gallery/04_progress.md`
- `docs/prompt_gallery/05_review.md`

Changes to make:
- remove or replace the old gallery docs according to the approved cleanup policy
- keep the request-specific docs in `docs/new_repo_request/`

Verification:
- the reusable prompt-gallery docs no longer live in this repo

Rollback / recovery:
- if the cleanup policy is not approved, leave a pointer file instead of deleting content

Risks:
- accidental loss of the reusable method docs if cleanup happens before the target repo is confirmed

### Phase 5: Verify the new boundary
Objective:
- confirm the split is understandable and usable

Files:
- `README.md`
- `docs/new_repo_request/06_review.md`

Changes to make:
- document the final state of the split
- capture any follow-up items

Verification:
- the request bundle clearly explains the new repo, the workspace, and the source-repo cleanup

Rollback / recovery:
- if the plan changes during implementation, update the plan and progress docs before continuing

Risks:
- stale instructions left behind in either repo

## Dependency and sequencing notes
- Phase 1 must finish before any repo movement.
- Phase 2 depends on the boundary being approved.
- Phase 3 can happen after the target repo exists, but before source cleanup.
- Phase 4 should not start until the target repo and workspace are verified.
- Phase 5 is the final sanity check before closure.

## Test strategy
### Unit
- No automated unit tests are expected for the documentation bundle itself.

### Integration
- Verify the new repo structure opens as intended in the chosen workspace format.

### Manual verification
- Confirm the reusable prompt-gallery docs live in the new repo.
- Confirm the current repo keeps only the request-specific docs.
- Confirm the workspace includes the new repo as a separate root.

### Performance / safety checks
- Make sure the cleanup step does not delete the request-specific bundle in this repo.

## Edge cases to validate
- The target repo name changes late in the process.
- The workspace format needs to be swapped for a different editor.
- The source repo should keep a pointer file instead of a hard delete.

## Non-goals during implementation
- Changing the prompt-gallery methodology itself.
- Refactoring unrelated application code.
- Bundling other project docs into the new repo.

## Plan quality self-check
- Are all file paths exact? Yes
- Are all major symbols named? Yes
- Can each phase be verified independently? Yes
- Is there any implementation code that should be removed? No
- Could a fresh agent implement from this alone? Yes

## Exit recommendation
- Ready for implementation: Yes
- If No, what needs to change?

## Final instruction
After writing `docs/new_repo_request/03_plan.md`, stop.
Do not move files or create the target repo in the same step unless explicitly instructed.
