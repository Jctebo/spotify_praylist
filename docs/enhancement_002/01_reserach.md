# Research

## Metadata
- Project: `spotify_praylist`
- Task: Enhancement 002, order-first `Playlist Audio` filename contract
- Date: March 21, 2026
- Researcher: Codex
- Status: Draft

## Source references
- Requirements: [docs/enhancement_002/00_scope.md](c:/Users/jcteb/Code/spotify_praylist/docs/enhancement_002/00_scope.md)
- DeepWiki: https://deepwiki.com/humanlayer/advanced-context-engineering-for-coding-agents/3.1-research-phase

## Objective of research
Identify the current `Playlist Audio` export flow, the symbols that control filename construction, and the safest way to move the order token to the front of the stem without breaking the existing OneDrive rebuild workflow.

## Relevant files
- [jobs/notion/generate_page_audio.py](c:/Users/jcteb/Code/spotify_praylist/jobs/notion/generate_page_audio.py)  
  Primary export path for `Playlist Audio` filenames, JSON sidecars, collision checks, and managed truncation.
- [jobs/playlist/refresh_playlist.py](c:/Users/jcteb/Code/spotify_praylist/jobs/playlist/refresh_playlist.py)  
  Existing consumer of the shared top-level order contract for queue sorting.
- [jobs/prayer_order_contract.py](c:/Users/jcteb/Code/spotify_praylist/jobs/prayer_order_contract.py)  
  Shared parsing and formatting for top-level `Order`.
- [README.md](c:/Users/jcteb/Code/spotify_praylist/README.md)  
  Runtime documentation that still describes the current export naming contract and `Output Folder` fallback.
- [tests/test_page_audio_job.py](c:/Users/jcteb/Code/spotify_praylist/tests/test_page_audio_job.py)  
  Coverage for export metadata, filename collisions, truncation, and page-content behavior.
- [tests/test_refresh_job.py](c:/Users/jcteb/Code/spotify_praylist/tests/test_refresh_job.py)  
  Coverage for top-level order sorting and shared order formatting.

## Relevant symbols and responsibilities
- `jobs/prayer_order_contract.parse_top_level_order`  
  Parses numeric `Order` values from Notion data.
- `jobs/prayer_order_contract.format_top_level_order`  
  Normalizes display text for order values such as `1.01` and `2`.
- `jobs/prayer_order_contract.top_level_order_sort_value`  
  Produces the sortable numeric order used by the queue builder.
- `jobs/playlist/refresh_playlist.build_queue_for_playlist_from_notion`  
  Reads top-level `Order` and sorts playlist queue entries.
- `jobs/notion/generate_page_audio.page_audio_export_metadata`  
  Builds the export stem and currently controls filename shape.
- `jobs/notion/generate_page_audio.page_audio_output_library_paths`  
  Resolves the audio and JSON output paths from the export metadata.
- `jobs/notion/generate_page_audio.persist_page_audio_output_library`  
  Writes the library artifact and sidecar payload.
- `jobs/notion/generate_page_audio.validate_unique_page_audio_export_targets`  
  Detects same-folder filename collisions before writing.
- `jobs/notion/generate_page_audio.truncate_managed_page_audio_outputs`  
  Removes stale managed audio and JSON files from touched folders.

## Architecture and flow
- The queue job reads Opus Dei rows, filters them by platform and playlist, and sorts them with the shared top-level `Order` contract.
- The page-audio job builds export metadata from the page title, output folder, and order value.
- The current export stem is folder-first: `FolderName - Order - EntryName`.
- The library path helper places the files under `Playlist Audio/<FolderName>/`, then writes `.mp3` and `.json` using the same stem.
- Managed truncation only removes files in the touched managed folders, so the workflow can rebuild and then sync cleanly to OneDrive.

## Patterns and conventions
- The repo already centralizes order parsing/formatting in `jobs/prayer_order_contract.py`.
- The page-audio job uses helper functions for path-safe naming, export metadata, and sidecar payloads instead of inline string assembly in multiple places.
- Tests are behavior-driven and use temporary environments and temp directories to verify filesystem behavior.
- Docs in `README.md` and the enhancement artifacts are expected to match runtime naming contracts closely.

## Constraints and dependencies
- `Order` at the top-level Opus Dei row is the canonical ordering source.
- `Output Folder` should become required for ordered exports rather than falling back to `Playlist`.
- The export change must preserve `.mp3` and `.json` pairing.
- Stale remote files are a real risk any time filenames change, so managed truncation remains important.
- The existing OneDrive `rclone sync` workflow is part of the contract and should continue unchanged.

## Potential approaches
- Update the export stem assembly in `page_audio_export_metadata` to use `Order - Folder - Entry`.  
  - Pros: smallest surface area, fits existing helpers, easiest to test.  
  - Cons: only covers this export path.
- Factor a reusable order-first filename helper into `jobs/prayer_order_contract.py`.  
  - Pros: makes the naming convention explicit and reusable.  
  - Cons: slightly broader refactor than necessary if only this one exporter needs it.
- Leave the exporter unchanged and only update docs.  
  - Pros: no code churn.  
  - Cons: does not satisfy the requested filename change.

## Key findings
- The repo already has the shared top-level order contract, so the work is not about inventing order parsing.
- Current `Playlist Audio` filenames are still folder-first in code and docs.
- The requested change is a stem-order change, not a separator-style change.
- Existing collision handling and managed truncation are the right supporting mechanisms for a rename-heavy change.
- Tests already cover the current export shape, so the filename change will need test updates as well as docs updates.

## Risks
- Risk: downstream consumers may already rely on the current folder-first filename shape.  
  - Why it matters: renaming the stem changes file lookup behavior immediately.
  - Possible mitigation: keep the change isolated to the export contract and update docs/tests in the same pass.
- Risk: duplicate order values inside the same folder could collide once the order token is moved to the front.  
  - Why it matters: collisions can overwrite or block output.
  - Possible mitigation: preserve and extend collision validation.
- Risk: stale old filenames may remain on disk or remotely if cleanup is skipped.  
  - Why it matters: users can see both old and new naming schemes at once.
  - Possible mitigation: keep managed truncation before regeneration.

## Unknowns / assumptions to validate
- The requested contract applies only to `Playlist Audio` exports, not other audio libraries.
- The requested change preserves the repo's current spaced separators.
- The filename example should be interpreted as `Order - Folder - Entry`, not `Folder - Order - Entry`.

## Recommendation for planning
Plan the change as a focused export-contract update:
- change the filename stem assembly to `Order - Folder - Entry`
- keep the shared order parsing/formatting contract
- remove the `Playlist` fallback so ordered exports require `Output Folder`
- update collision/truncation tests
- sync README and scope language to the new order-first convention

## Research quality self-check
- Is every major claim tied to an observed file or pattern? Yes
- Are critical files likely missing? No
- Is there implementation detail that should be removed? No
- Can a human review this quickly? Yes

## Exit recommendation
- Ready for planning: Yes
- If No, what additional research is needed? None
