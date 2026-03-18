# Enhancement 001 Scope

Snapshot date: March 18, 2026

Status: Approved working scope for implementation.

## Objective

Unify daily OneDrive playlist-audio exports and Notion prayer text sync under one explicit contract while preserving prayer pages that already write correctly today.

## Desired Outcome

- Ordered OneDrive `Playlist Audio` exports refresh every day from the existing page-audio workflow.
- Managed OneDrive playlist-audio folders are rebuilt daily so stale filenames disappear when prayer titles, folders, or order values change.
- Prayers with reliable text sources resolve their text into Notion page content.
- Prayer pages that already write correctly, especially Morning Prayer, keep their current working block/template behavior.

## In Scope

- Ordered OneDrive `.mp3` and `.json` exports in `Playlist Audio`.
- Filename contract: `<FolderName> - <Order> - <EntryName>.<ext>`.
- Top-level Opus Dei `Order` as the export-order contract for OneDrive naming.
- Managed daily truncation and rebuild of local playlist-audio outputs before the existing OneDrive sync.
- Page-content sync only when the runtime has a reliable text source.
- Clear reporting or failure when a prayer is configured for reliable page-content sync but no valid text resolves.
- Regression coverage for ordered naming, truncation, queue/export alignment, Morning Prayer non-regression, and reliable-text behavior.

## Out Of Scope

- Generating `.lnk`, `.url`, or other shortcut artifacts.
- Using detailed-fragment `Order` to drive top-level OneDrive filenames.
- Inventing text for prayers that do not have a reliable source yet.
- Reformatting Morning Prayer just to match a generic page-content sync path.
- Deleting unrelated OneDrive content outside managed `Playlist Audio/<FolderName>/` folders.

## Scope Clarifications

### OneDrive Artifacts

- "OneDrive playlist files" means the existing exported audio artifact plus matching JSON sidecar.
- The implementation should keep using the current page-audio workflow and OneDrive `rclone sync` path.

### Ordering And Naming

- Ordered filenames should use the top-level prayer row `Order`, not detailed-fragment `Order`.
- `Output Folder` remains the first folder-routing source.
- If `Output Folder` is blank, the exporter may fall back to the row `Playlist` value.

### Daily Refresh Behavior

- Managed playlist-audio folders should be truncated locally before the daily rebuild.
- The existing upload sync should continue to remove stale remote files after the local rebuild completes.

### Notion Page Text Behavior

- Reliable text should be written into page content where the runtime can already derive canonical text.
- Prayers without a reliable text source stay audio-only for now and must be reported, not fabricated.
- Morning Prayer is explicitly a preservation case: keep its current block grouping, placeholder behavior, and novena insertion shape.

## Acceptance Criteria

1. OneDrive playlist-audio artifacts are exported with ordered filenames using the same stem for `.mp3` and `.json`.
2. Managed playlist-audio folders are truncated locally before regeneration and stale remote filenames disappear after sync.
3. Top-level Opus Dei `Order` is the shared contract for Spotify queue order and OneDrive export naming.
4. Detailed-fragment `Order` remains only an internal in-prayer assembly contract.
5. Prayers with reliable text sources write to Notion page content.
6. Prayers without reliable text sources remain audio-only and are surfaced clearly.
7. Morning Prayer continues using its current working page-content template behavior.
