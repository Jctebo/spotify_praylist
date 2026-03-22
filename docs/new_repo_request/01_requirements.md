# Requirements

## Metadata
- Project: Prompt gallery repo extraction
- Feature / Bug / Refactor: New repo setup
- Requestor: User
- Date: March 19, 2026
- Owner: Codex
- Status: Draft

## Source references
- User request: `docs/new_repo_request/00_request.md`
- Methodology: `docs/prompt_gallery/000_prompts.md`
- Current repo: `spotify_praylist`

## Objective
Move the reusable prompt gallery into its own repo so it can be opened and reused across multiple projects, including from a shared workspace. Keep the current repo as the place where the request-specific documentation bundle lives.

## Problem statement
The prompt gallery currently lives inside this application repo, which makes it harder to reuse across multiple projects and obscures the boundary between the reusable documentation method and this repo's own implementation work.

## Desired outcome
A standalone prompt-gallery repo exists, the reusable prompt-gallery docs live there, and a workspace can include that repo alongside other project repos. This repo keeps the request-specific documentation bundle that describes the extraction.

## In scope
- Define the standalone prompt-gallery repo layout.
- Define how the reusable prompt-gallery docs should be moved.
- Define the workspace setup needed for cross-project use.
- Document the request-specific workflow in this repo.

## Out of scope
- Implementing the repo move in this documentation task.
- Changing unrelated Spotify playlist or novena code.
- Rewriting the prompt-gallery methodology itself.

## Users / systems affected
- Codex users who want to reuse the prompt gallery across multiple projects.
- Local editors or workspace configurations that need to open multiple repos together.
- This current repo, which will retain only the request-specific docs.

## Functional requirements
- FR1: The prompt gallery must be separated into its own repo.
- FR2: The new repo must be usable from a shared workspace across multiple projects.
- FR3: The request bundle in this repo must clearly document the move and its boundaries.
- FR4: The reusable method docs must remain distinct from the request artifacts.

## Non-functional requirements
- Maintainability: The split should make the reusable prompt gallery easier to update independently.
- Usability: The workspace setup should be simple enough to open with other project repos.
- Clarity: The request-specific documentation must not mix method instructions with generated artifacts.

## Inputs
- `docs/new_repo_request/00_request.md`
- `docs/prompt_gallery/000_prompts.md`
- Current repo structure and any workspace configuration files

## Outputs
- A standalone prompt-gallery repo
- A workspace file or equivalent workspace configuration
- Request-specific docs in `docs/new_repo_request/`

## Constraints
- Technical constraints: The current repo already contains the prompt-gallery docs, so the move must preserve their content and ordering.
- Organizational constraints: The request-specific documentation stays in this repo.
- Deployment constraints: The move should be reviewed before anything is deleted from the current repo.

## Existing assumptions
- A1: The prompt gallery is the reusable method.
- A2: The new repo is separate from this current repo.
- A3: The current repo will keep the request bundle even after the gallery is moved.

## Open questions
- Q1: What should the new repo be named?
- Q2: What workspace format should be used for cross-project use?
- Q3: Should the source repo keep a pointer file after the move or remove the old gallery docs entirely?

## Acceptance criteria
- AC1: The standalone repo exists and contains the prompt-gallery method docs.
- AC2: The workspace can open the prompt-gallery repo together with other projects.
- AC3: The current repo contains the request-specific documentation bundle.
- AC4: The reusable prompt-gallery docs are clearly separated from the request artifacts.

## Verification expectations
- Unit tests expected? No
- Integration tests expected? No
- Manual verification expected? Yes
- Performance verification expected? No

## Risk notes
- Risk 1: The repo/workspace boundary could remain ambiguous and cause the wrong files to move.
- Risk 2: The old prompt-gallery docs could be left behind or duplicated if the migration is not explicit.

## Approval
- Requirements approved by: Pending
- Date: Pending
