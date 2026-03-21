# Enhancement 002 Scope

Snapshot date: March 21, 2026

Status: Clarified working scope for implementation.

## Objective

Update the ordered `Playlist Audio` filename contract so the order value appears first in the stem while preserving the existing spaced separator style.

## Desired Outcome

- Ordered OneDrive `Playlist Audio` exports continue to refresh from the existing page-audio workflow.
- Export filenames use the order-first stem format `1.01 - Morning - Morning Prayer.mp3`.
- Matching `.json` sidecars use the same ordered stem as the audio file.
- Top-level Opus Dei `Order` remains the export-order contract for OneDrive naming.
- Managed daily truncation still clears stale playlist-audio artifacts before the rebuild and sync.

## In Scope

- Ordered OneDrive `.mp3` and `.json` exports in `Playlist Audio`.
- Filename contract: `<Order> - <FolderName> - <EntryName>.<ext>`.
- Top-level Opus Dei `Order` as the shared order source for queueing and export naming.
- `Output Folder` is required for ordered exports.
- Managed daily truncation and rebuild of local playlist-audio outputs before the existing OneDrive sync.
- Regression coverage for ordered naming, truncation, queue/export alignment, and filename collision handling.

## Out Of Scope

- Changing the separator style away from the current spaced ` - ` stem format.
- Using detailed-fragment `Order` to drive top-level OneDrive filenames.
- Reformatting unrelated audio libraries or non-`Playlist Audio` exports.
- Deleting unrelated OneDrive content outside managed `Playlist Audio/<FolderName>/` folders.

## Scope Clarifications

### OneDrive Artifacts

- "OneDrive playlist files" means the exported audio artifact plus its matching JSON sidecar.
- The implementation should keep using the current page-audio workflow and OneDrive `rclone sync` path.

### Ordering And Naming

- The filename stem should place the order token first, then the folder name, then the entry name.
- The order token should be formatted with the shared top-level order normalization contract.
- `Output Folder` is the required folder-routing source for the exported files.

### Daily Refresh Behavior

- Managed playlist-audio folders should still be truncated locally before the daily rebuild.
- The existing upload sync should continue to remove stale remote files after the local rebuild completes.

## Acceptance Criteria

1. OneDrive playlist-audio artifacts are exported with order-first filenames using the same stem for `.mp3` and `.json`.
2. Managed playlist-audio folders are truncated locally before regeneration and stale remote filenames disappear after sync.
3. Top-level Opus Dei `Order` is the shared contract for Spotify queue order and OneDrive export naming.
4. Detailed-fragment `Order` remains only an internal in-prayer assembly contract.
5. Filename collisions are detected clearly before writing output files.
