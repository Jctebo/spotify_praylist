# Research

## Metadata
- Project: Prompt gallery repo extraction
- Task: Research the current repo and the migration boundary
- Date: March 19, 2026
- Researcher: Codex
- Status: Draft

## Source references
- Requirements: `docs/new_repo_request/01_requirements.md`
- Request: `docs/new_repo_request/00_request.md`
- Methodology: `docs/prompt_gallery/000_prompts.md`

## Objective of research
Identify the current location and structure of the prompt gallery, determine what in this repo is reusable methodology versus request-specific documentation, and surface the files and conventions that a future repo split must respect.

## Relevant files
- `docs/prompt_gallery/000_prompts.md`
  - Purpose: reusable prompt-gallery entrypoint and methodology source.
  - Relevance: this is the template that should move to the standalone repo.
- `docs/prompt_gallery/00_requirements.md`
  - Purpose: current prompt-gallery requirements artifact.
  - Relevance: shows the established lifecycle and structure.
- `docs/prompt_gallery/01_research.md`
  - Purpose: current prompt-gallery research artifact.
  - Relevance: shows how the method documents the repo being researched.
- `docs/prompt_gallery/02_plan.md`
  - Purpose: current prompt-gallery plan artifact.
  - Relevance: shows the expected planning structure.
- `docs/prompt_gallery/03_implement.md`
  - Purpose: current prompt-gallery implementation guide.
  - Relevance: shows the handoff between plan and implementation.
- `docs/prompt_gallery/04_progress.md`
  - Purpose: current prompt-gallery progress artifact.
  - Relevance: shows how execution is recorded.
- `docs/prompt_gallery/05_review.md`
  - Purpose: current prompt-gallery review artifact.
  - Relevance: shows the final review step.
- `docs/new_repo_request/00_request.md`
  - Purpose: human-authored source request for this bundle.
  - Relevance: defines the migration request and workspace need.
- `README.md`
  - Purpose: project overview for the current repo.
  - Relevance: confirms this repo is currently application-specific, not a shared prompt-gallery repo.

## Relevant symbols and responsibilities
- `docs/prompt_gallery/000_prompts.md`
  - Role: reusable methodology prompt for generating docs bundles.
- `docs/new_repo_request/00_request.md`
  - Role: source-of-truth request for this implementation.

## Architecture and flow
The current repo already separates concerns at the documentation level:
- `docs/prompt_gallery/` contains the reusable prompt-gallery workflow.
- `docs/new_repo_request/` contains the request-specific bundle for the new repo request.

The intended future flow is:
1. Use the reusable prompt gallery as the method.
2. Apply it to the human request in `docs/new_repo_request/00_request.md`.
3. Produce a standalone prompt-gallery repo and workspace configuration.
4. Keep the request-specific docs in this repo as the record of how the move was specified.

## Patterns and conventions
- The prompt-gallery workflow uses numbered artifacts in sequence.
- The reusable prompt file is a separate entrypoint from the generated docs.
- Request-specific bundles should keep the source request isolated from the generated artifacts.
- The current repo already treats `docs/prompt_gallery/` and `docs/new_repo_request/` as distinct documentation areas.

## Constraints and dependencies
- There is no workspace file in the current repo yet.
- There is no separate prompt-gallery repo yet.
- The new repo must preserve the prompt-gallery content and naming conventions well enough for reuse across projects.
- The request-specific bundle in this repo should not be mixed with the reusable prompt-gallery method files.

## Potential approaches
1. Separate repo plus workspace
   - Summary: move the prompt gallery into its own repo and add a workspace file that includes it.
   - Pros: clean boundary, easy reuse, matches the request.
   - Cons: requires a repo split and workspace setup.
   - Compatibility: best match for the current request.
2. Keep only in-repo copies
   - Summary: duplicate the prompt gallery in the current repo and treat it as a local template.
   - Pros: minimal immediate effort.
   - Cons: does not satisfy the cross-project reuse goal.
   - Compatibility: poor.

## Key findings
- The reusable prompt-gallery docs are already present and well-structured in `docs/prompt_gallery/`.
- The current repo does not appear to have a workspace configuration checked in.
- The request-specific docs belong in this repo, while the reusable prompt-gallery method should live elsewhere.

## Risks
- Risk: copying the docs without a clear repo boundary could leave the gallery duplicated in both places.
- Why it matters: the reusable method would still be coupled to this application repo.
- Possible mitigation: define the source repo cleanup step before implementation.

## Unknowns / assumptions to validate
- The new repo name is not defined yet.
- The workspace file format is not defined yet.
- The source-repo cleanup policy after the move is not defined yet.

## Recommendation for planning
Plan a standalone prompt-gallery repo and a workspace file that can open it with other projects, then document the exact source-repo cleanup and migration steps before any deletion happens.

## Research quality self-check
- Is every major claim tied to an observed file/pattern? Yes
- Are critical files likely missing? No
- Is there implementation detail that should be removed? No
- Can a human review this quickly? Yes

## Exit recommendation
- Ready for planning: Yes
- If No, what additional research is needed?

## Final instruction
After writing `docs/new_repo_request/02_research.md`, stop.
Do not implement the repo move in the same step unless explicitly instructed.
