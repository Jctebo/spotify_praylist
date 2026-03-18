# Notion Detailed Fragments View Recipe

Snapshot date: March 15, 2026

Purpose:
- make the `Audio Fragments` database readable now that it is the live "Detailed Fragments" list for page audio
- give one clear primary working view plus a few support views for editing and QA

Note:
- the public Notion API still does not let this repo create saved database views directly
- create these views manually in the Notion app on the `Audio Fragments` database

## Database Role

The `Audio Fragments` database is now the live detailed-fragment table in the two-list model:
- top-level row: `Opus Dei`
- child detail rows: `Audio Fragments`

Each fragment row belongs to one `Opus Dei` item through `Opus Dei Item`.

## Primary View

Create this first:

- View name: `Detailed Fragments - Working`
- Layout: `Table`
- Filter: `Enabled` is checked
- Sort 1: `Opus Dei Item` ascending
- Sort 2: `Order` ascending
- Sort 3: `Assembly Role` ascending
- Sort 4: `Name` ascending

Show these properties in this order:
- `Name`
- `Opus Dei Item`
- `Order`
- `Assembly Role`
- `Fragment Kind`
- `Group`
- `Builder`
- `Feed Match Text`
- `Feed URL`
- `Source URL`
- `Spoken Text`
- `Prompt`
- `Intention Property`
- `Intention Prefix`
- `Start Date`
- `End Date`
- `Enabled`
- `Notes`

Hide in this view unless you are debugging:
- `Fragment Key`
- `Config Key`
- `Fragment Sequence`
- old migration helper fields that are no longer part of the two-list model

## Recommended Support Views

### 1. `Detailed Fragments - By Page`

Use this when you want to understand one prayer end-to-end.

- Layout: `Table`
- Filter: `Enabled` is checked
- Group by: `Opus Dei Item`
- Sort: `Order` ascending

Show:
- `Name`
- `Order`
- `Assembly Role`
- `Fragment Kind`
- `Group`
- `Feed Match Text`
- `Spoken Text`
- `Prompt`

### 2. `Detailed Fragments - Sources`

Use this to verify provider selection and fallback chains.

- Layout: `Table`
- Filter: `Enabled` is checked
- Filter: `Fragment Kind` is any of `rss_audio`, `source_audio`, `builder`
- Sort 1: `Opus Dei Item` ascending
- Sort 2: `Assembly Role` ascending
- Sort 3: `Order` ascending

Show:
- `Name`
- `Opus Dei Item`
- `Order`
- `Assembly Role`
- `Fragment Kind`
- `Builder`
- `Feed Match Text`
- `Feed URL`
- `Source URL`
- `Intention Property`
- `Intention Prefix`
- `Start Date`
- `End Date`

### 3. `Detailed Fragments - Content`

Use this to edit spoken text and prompt-driven fragments.

- Layout: `Table`
- Filter: `Enabled` is checked
- Filter: `Fragment Kind` is any of `text`, `prompt`, `monthly_intention`, `random_intention`, `daily_novena_audio`
- Sort 1: `Opus Dei Item` ascending
- Sort 2: `Order` ascending

Show:
- `Name`
- `Opus Dei Item`
- `Order`
- `Fragment Kind`
- `Group`
- `Spoken Text`
- `Prompt`
- `Builder`
- `Start Date`
- `End Date`

### 4. `Detailed Fragments - Time Window`

Use this to spot seasonal or date-bound fragments.

- Layout: `Table`
- Filter: `Enabled` is checked
- Filter: `Start Date` is not empty OR `End Date` is not empty
- Sort 1: `Start Date` ascending
- Sort 2: `End Date` ascending
- Sort 3: `Opus Dei Item` ascending

Show:
- `Name`
- `Opus Dei Item`
- `Order`
- `Fragment Kind`
- `Start Date`
- `End Date`
- `Group`

### 5. `Detailed Fragments - QA`

Use this to find rows that are likely incomplete.

- Layout: `Table`
- Filter: `Enabled` is checked
- Filter: one of the following is true:
- `Opus Dei Item` is empty
- `Fragment Kind` is empty
- `Order` is empty
- `Assembly Role` is empty
- Sort 1: `Opus Dei Item` ascending
- Sort 2: `Name` ascending

Show:
- `Name`
- `Opus Dei Item`
- `Order`
- `Assembly Role`
- `Fragment Kind`
- `Builder`
- `Feed URL`
- `Source URL`
- `Spoken Text`
- `Prompt`
- `Notes`

## Property Guidance

Use these fields as the main editing surface:

- `Opus Dei Item`: which page/prayer owns the fragment
- `Order`: the canonical assembly order
- `Assembly Role`: `append`, `primary_source`, or `fallback_source`
- `Fragment Kind`: what kind of fragment it is
- `Group`: optional editorial grouping like `intro`, `novena`, `petitions`, `source`, `closing`

Interpretation:

- `append`: always contributes when active
- `primary_source`: main source provider for audio
- `fallback_source`: backup provider only if an earlier source fragment does not resolve

## Recommended Group Values

To keep sorting and scanning consistent, prefer a small shared vocabulary:

- `intro`
- `intention`
- `hymn`
- `opening`
- `psalmody`
- `reading`
- `responsory`
- `gospel`
- `petitions`
- `novena`
- `source`
- `closing`

## Best Working Pattern

For day-to-day editing, keep two tabs open:

1. `Detailed Fragments - Working`
2. `Detailed Fragments - By Page`

That gives one flat operational list and one grouped assembly view.

## Related Opus Dei View

A companion view on the `Opus Dei` database is also helpful:

- View name: `Opus Dei - Audio Assembly`
- Filter: `Platform` contains `auto-audio` OR `auto-text`
- Show:
- `Name`
- `Platform`
- `Assembly Mode`
- `Special Builder`
- `Text Sync Mode`
- `Detailed Fragments`
- `Spotify Resolver`
- `Spotify Fallback Resolver`
- `Playlist`
- `Order`

This makes it easy to move between the parent row and its child fragments.

Important ordering note:

- top-level Opus Dei `Order` is the playlist/export order used for Spotify queueing and ordered OneDrive `Playlist Audio` filenames
- fragment `Order` remains the canonical assembly order inside one prayer page only
- Morning Prayer keeps its existing page template behavior even though its exported OneDrive audio now follows the shared top-level ordered filename contract
