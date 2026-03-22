# Run Implementation

## Canonical references
- `docs/new_repo_request/01_requirements.md`
- `docs/new_repo_request/02_research.md`
- `docs/new_repo_request/03_plan.md`

## Inputs
- `docs/new_repo_request/03_plan.md`
- `docs/new_repo_request/01_requirements.md`
- `docs/new_repo_request/02_research.md`

## Outputs
- code changes in the new prompt-gallery repo
- `docs/new_repo_request/05_progress.md` updated continuously

---

# Phase Entry: Plan Review

Before any implementation begins, review the requirements, research, and plan.

## Plan Review Objectives
- Validate that the repo split is complete and executable
- Surface any remaining ambiguity
- Confirm the source-repo cleanup policy before deletion

## Plan Review Instructions

1. Carefully review:
   - `docs/new_repo_request/01_requirements.md`
   - `docs/new_repo_request/02_research.md`
   - `docs/new_repo_request/03_plan.md`

2. Ask any final questions needed before execution:
   - repo name
   - workspace format
   - pointer file versus delete-only cleanup
   - any missing migration detail

3. If questions exist:
   - list them clearly
   - stop and wait for answers before proceeding

4. If no questions exist:
   - explicitly state that the plan is clear and ready for execution

---

# Pre-Execution Step: Document Alignment

After all questions are answered:

## Required updates
- Refine `docs/new_repo_request/03_plan.md` if clarifications changed execution details
- Initialize `docs/new_repo_request/05_progress.md` with metadata and the starting point

## Rules
- Do not begin the repo move until the docs reflect the final plan
- Ensure a fresh agent could resume from the updated docs alone

---

# Execution Phase

## Mission
Create the standalone prompt-gallery repo, add workspace support, and clean up the source repo exactly as approved.

## Mandatory implementation rules
- Follow `docs/new_repo_request/03_plan.md` unless blocked
- If blocked or a deviation is necessary:
  - update `docs/new_repo_request/03_plan.md`, or
  - record the deviation in `docs/new_repo_request/05_progress.md` before continuing
- After each completed phase:
  - write a compact progress update
- Do not silently change the repo boundary

## Final Instruction
- Pause and ask critical questions before deployment if the cleanup boundary is not fully approved.
- Keep the reusable prompt-gallery docs separate from the request-specific docs.
