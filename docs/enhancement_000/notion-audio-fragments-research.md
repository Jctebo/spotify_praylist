# Notion Audio Fragments Research

Snapshot date: March 15, 2026

Status: Research only. This document maps the current system so a later implementation plan can simplify it safely.

## Goal

Understand how Notion is being used today for page audio, audio outputs, and audio fragments so the next design can move toward one Notion audio fragment list with metadata for grouping and sorting.

## Research Framing

This document follows the spirit of the HumanLayer DeepWiki "research phase": map the current system first, identify real seams and invariants, and defer the implementation plan until the current-state model is clear.

Reference:
- https://deepwiki.com/humanlayer/advanced-context-engineering-for-coding-agents/3.1-research-phase

Primary local sources:
- `jobs/notion/generate_page_audio.py`
- `jobs/novena/generate_daily_novena_prayer.py`
- `config/page_audio_config.json`

Live state sources used for this snapshot:
- `load_page_audio_config_from_notion(...)`
- `load_audio_fragments_from_notion(...)`
- `load_audio_outputs_from_notion(...)`
- direct queries of the main Notion page database and the related audio databases

## Executive Summary

Today the runtime is not a one-list fragment model. It is a four-layer model:

1. Main page rows in the Opus Dei database
2. `Page Audio Configuration`
3. `Audio Outputs`
4. `Audio Fragments`

The system is partly normalized, but not fully simplified:

- `Audio Outputs` is mostly a thin indirection layer over top-level wrapper fragments.
- `Audio Fragments` contains both true leaf content and synthetic wrapper rows.
- `Page Audio Configuration` still exists as a separate reusable builder/source layer.
- The main page database still resolves into a merged config map, not directly into a single fragment model.

The most important current-state finding is that Notion already has "one fragment list", but that list is not yet the whole truth:

- some source definitions still live in `Page Audio Configuration`
- some fallback definitions still live in `config/page_audio_config.json`
- some page behavior still depends on page-level resolver fields
- some active flows bypass the fragment list or only use it indirectly

## Current System Snapshot

### Runtime layers

| Layer | Purpose today | Live count | Important note |
| --- | --- | ---: | --- |
| Main page database | User-facing pages that receive audio/text sync | 34 pages | 16 use `auto-audio`, 3 use `auto-text` |
| `Page Audio Configuration` | Reusable builder/source recipes | 17 live Notion rows | File fallback still matters |
| `Audio Outputs` | Stable output contracts used by pages | 17 rows | 16 fragment-backed, 1 rosary special case |
| `Audio Fragments` | Leaf fragments, special fragments, wrapper fragments | 72 raw rows / 61 active rows | Active count is date-filtered |

### Why `Audio Fragments` has two counts

The fragment database currently has 72 Notion rows, but only 61 are active in the runtime on March 15, 2026 because fragment loading applies start/end date windows. The main difference is the monthly intention rows: the database stores the full year, but only the current month is active in the runtime fragment map.

### Merged runtime config map

`load_page_audio_config(...)` merges:

1. file configs from `config/page_audio_config.json`
2. live Notion page-audio configs
3. normalized output configs from `Audio Outputs`

That produces 36 runtime config keys on March 15, 2026, plus 61 active fragment specs.

## Database-By-Database Findings

### 1. Main Page Database

This is still the operational entry point. Pages do not resolve directly to leaf fragments. They resolve through page-level fields into the merged config map.

Important page-level properties in use:

- `Platform`
- `Text Resolver`
- `Auto Audio Resolver 1`
- `Auto Audio Resolver 2`
- legacy `Spotify Resolver`
- legacy `Audio Configuration`

Current live usage:

- 16 pages use `auto-audio`
- 3 pages use `auto-text`
- 16 pages have `Auto Audio Resolver 1`
- 3 pages have `Auto Audio Resolver 2`
- 3 pages have `Text Resolver`
- 0 active auto pages currently use `Audio Configuration`
- 14 of the 16 auto-audio pages still retain a legacy `Spotify Resolver` value

Current resolver pattern:

- most pages resolve `Auto Audio Resolver 1` to an output key
- some pages also keep a second fallback resolver
- text sync pages resolve `Text Resolver` to a base config key, not to an output key

Examples:

- `Morning Prayer`
  - `Auto Audio Resolver 1 = MORNING_PRAYER_OUTPUT`
  - `Auto Audio Resolver 2 = MORNING_PRAYER_PAGE_AUDIO`
- `Morning Prayer - Liturgy of the Hours (Spotify)`
  - `Text Resolver = DIVINE_OFFICE_MORNING_TEXT`
  - `Auto Audio Resolver 1 = SING_THE_HOURS_MORNING_OUTPUT`
  - `Auto Audio Resolver 2 = DIVINE_OFFICE_MORNING_OUTPUT`
- `Divine Office Invitatory`
  - `Auto Audio Resolver 1 = DIVINE_OFFICE_INVITATORY_OUTPUT`
  - `Auto Audio Resolver 2 = DIVINE_OFFICE_INVITATORY_PAGE_AUDIO`

Important implication:

The main page database is already partly normalized, but its resolvers still mix two concepts:

- output keys
- base config keys

That works because the runtime merges both into one config map, but it also hides the architectural difference between "entrypoint/output" and "source recipe".

### 2. `Page Audio Configuration`

This database is still a real layer, not just migration residue.

Live Notion counts by builder:

| Builder | Count |
| --- | ---: |
| `rss_audio_v1` | 12 |
| `morning_prayer_v1` | 1 |
| `divine_office_invitatory_v1` | 1 |
| `divine_office_morning_text_v1` | 1 |
| `divine_office_night_text_v1` | 1 |
| `auxilium_daily_text_v1` | 1 |

Typical fields used here:

- `Builder`
- `Audio Caption`
- `Silence Ms`
- TTS settings
- `Feed URL`
- `Feed Match Text`
- `Feed Match Strategy`
- `Feed Match Map`
- `Text Property`
- monthly intention provider/language
- daily novena page title
- intention property/prefix

This layer currently does three different jobs:

- source recipe definition
- builder selection
- per-output override defaults

### File config and Notion config are both active

`config/page_audio_config.json` is still part of the live runtime. It is not just a bootstrap artifact.

Current split:

- 12 config keys exist in the file fallback
- 17 config keys exist in live Notion
- the union is 19 keys

Configs that currently exist only in the file fallback:

- `DIVINE_OFFICE_EVENING_TEXT`
- `SING_THE_HOURS_EVENING_PAGE_AUDIO`

Configs that currently exist only in live Notion:

- `ANGELUS_PODCAST_PAGE_AUDIO`
- `AUXILIUM_PAGE_AUDIO`
- `BARRON_ROSARY_PAGE_AUDIO`
- `BIBLE_IN_A_YEAR_PAGE_AUDIO`
- `DIVINE_OFFICE_AFTERNOON_PAGE_AUDIO`
- `SAINT_OF_DAY_PAGE_AUDIO`
- `USCCB_READINGS_PAGE_AUDIO`

Important implication:

Notion is not yet the complete source of truth for the audio system. Some required builder/source definitions still only live in the file fallback.

### 3. `Audio Outputs`

This database is now mostly normalized around fragment entrypoints, but it is still a separate layer from `Audio Fragments`.

Current raw output-row shapes:

| Shape | Count | Meaning |
| --- | ---: | --- |
| `fragment_key` | 15 | a top-level output points to one wrapper fragment |
| `fragment_key + weekday_map` | 1 | top-level fragment plus a schedule override |
| `weekday_map` only | 1 | special rosary output mode |

Current output modes:

| Output Mode | Count |
| --- | ---: |
| `fragments` | 16 |
| `rosary` | 1 |

Current practical pattern:

- 16 rows are now top-level output contracts that point to one fragment key
- 15 of those are pure indirection over wrapper fragments
- `ROSARY_INTENTIONS_OUTPUT` is the main exception because it still uses the dedicated `rosary` output mode

Important runtime detail:

When outputs are loaded, they are normalized into configs for the merged config map. After that, the runtime mostly stops treating them as a distinct first-class concept.

This means `Audio Outputs` is doing two jobs:

- it is a user-facing operational contract layer
- it is also a config-normalization step into the generic runtime

### 4. `Audio Fragments`

This is the closest thing to the target model, but it is still a mixed-use database.

### Raw fragment database shape

Raw fragment rows by explicit `Fragment Type`:

| Explicit `Fragment Type` value | Count |
| --- | ---: |
| blank | 53 |
| `config` | 16 |
| `monthly_intention` | 1 |
| `sequence` | 1 |
| `daily_novena_audio` | 1 |

Important observation:

Most fragment rows still do not declare their type explicitly. The runtime infers the type from which fields are populated.

### Raw fragment row shape by populated fields

| Row shape | Count |
| --- | ---: |
| text rows | 52 |
| prompt rows | 1 |
| config-key wrappers | 16 |
| sequence rows | 1 |
| typed special rows with no text/sequence/config key | 2 |

### Active fragment runtime map on March 15, 2026

Active fragment types after date filtering:

| Active type | Count |
| --- | ---: |
| `text` | 41 |
| `prompt` | 1 |
| `config` | 16 |
| `monthly_intention` | 1 |
| `sequence` | 1 |
| `daily_novena_audio` | 1 |

Largest collections in the raw fragment database:

| Collection | Count |
| --- | ---: |
| `rosary` | 29 |
| `page_audio_output_wrappers` | 16 |
| `Morning Prayer` | 12 |
| `monthly_intention` | 12 |
| `page_audio_special` | 2 |
| `page_audio_output_sequences` | 1 |

### What these fragments really are today

The live fragment database currently contains several different kinds of things:

- leaf spoken-text fragments
- one prompt template fragment
- wrapper fragments that point back to `Page Audio Configuration`
- one old sequence fragment
- typed special rows that act like placeholders for dynamic generation
- date-windowed monthly intention content

It does not yet contain all fragment-capable concepts as first-class rows.

Important examples:

- `rosary-decade-meditation-template`
  - the only live prompt fragment
- `daily-rosary-wrapper`
  - a top-level wrapper fragment pointing back to `BARRON_ROSARY_PAGE_AUDIO`
- `morning-prayer-wrapper`
  - a top-level wrapper fragment pointing back to `MORNING_PRAYER_PAGE_AUDIO`
- `monthly-intention`
  - a typed special fragment row
- `daily-novena-audio`
  - a typed special fragment row

Notably absent:

- there is no live `random-intention` fragment row, even though the code supports that fragment type
- there are no live fragment rows of type `builder`

### Fragment metadata today

Current fragment schema supports:

- `Name`
- `Fragment Key`
- `Fragment Type`
- `Builder`
- `Spoken Text`
- `Prompt`
- `Prompt Model`
- `Enabled`
- `Start Date`
- `End Date`
- `Collection`
- `Fragment Sequence`
- `Config Key`
- `Target Row`
- `Output Folder`
- `Order`
- `Notes`

But the runtime does not use all of these equally.

Actively used today:

- `Spoken Text`
- `Prompt`
- `Prompt Model`
- `Start Date` / `End Date`
- `Collection`
- `Fragment Sequence`
- `Config Key`
- `Output Folder`
- sometimes `Notes`

Partly or weakly used:

- `Collection`
  - mainly grouping, plus special logic for monthly intention selection
- `Notes`
  - used in rosary mystery fragments as JSON metadata like `title` and `fruit`

Currently not meaningfully driving runtime behavior:

- `Order`
- `Target Row`

Important implication:

The fragment database already has metadata fields, but some of the metadata a simplified model probably wants is still hidden in ad hoc places like `Notes` JSON, while other declared fields are not yet used.

## End-to-End Runtime Flow

### 1. Build the runtime config/fragment state

`load_page_audio_config(...)` does this:

1. load file configs from `config/page_audio_config.json`
2. overlay Notion `Page Audio Configuration`
3. load active fragment rows from `Audio Fragments`
4. load `Audio Outputs`
5. normalize outputs into generic runtime configs

Result on March 15, 2026:

- 36 merged config keys
- 61 active fragment specs

### 2. Resolve main page rows

The main page sync uses the page database as the operational driver. For each candidate page, the runtime looks at:

- `Text Resolver`
- `Auto Audio Resolver 1`
- `Auto Audio Resolver 2`
- then legacy fallbacks if needed

Those resolver values are looked up in the merged config map, so a page can point to:

- an output key
- or a base config key

### 3. Dispatch by builder

`build_page_audio_plan(...)` chooses the path based on the resolved builder:

- `morning_prayer_v1`
- `divine_office_invitatory_v1`
- `divine_office_morning_text_v1`
- `divine_office_evening_text_v1`
- `divine_office_night_text_v1`
- `auxilium_daily_text_v1`
- `rss_audio_v1`
- `audio_fragments_v1`
- `rosary_dynamic_v1`

### 4. Produce a `PageAudioPlan`

The runtime plan can contain:

- audio fragments
- synced text for a text property
- or full Notion page-content blocks

This is important because "audio fragment" is not only about audio. Some builder paths also drive page content synchronization.

### 5. Render and sync

`render_page_audio_for_config(...)` then:

1. computes the render hash
2. assembles audio
3. optionally embeds cover art
4. writes the library file
5. uploads the file to Notion
6. updates audio blocks and render metadata
7. applies text/page-content sync if requested

## Canonical Live Paths

These examples are the clearest way to understand how the current model actually works.

### Typical RSS-backed page

`Main page row -> Auto Audio Resolver 1 -> Audio Output row -> wrapper fragment -> Page Audio Configuration -> rss_audio_v1`

Example:

`Evening Prayer -> DIVINE_OFFICE_EVENING_OUTPUT -> divine-office-evening-wrapper -> DIVINE_OFFICE_EVENING_PAGE_AUDIO -> rss_audio_v1`

### Morning Prayer

`Main page row -> MORNING_PRAYER_OUTPUT -> morning-prayer-wrapper -> MORNING_PRAYER_PAGE_AUDIO -> morning_prayer_v1`

Important detail:

The active `morning_prayer_v1` path does not currently build from the `Morning Prayer` fragment collection. It reads the live Morning Prayer page body itself, clones/syncs that content, and dynamically inserts monthly intention and novena content.

That means these still exist in Notion but are not the active top-level path:

- the `Morning Prayer` fragment collection rows
- `morning-prayer-sequence`

`morning-prayer-sequence` still contains:

- `morning-offering`
- `daily-consecration`
- `baptismal-renewal`
- `petitions-intro`
- `SPECIAL:monthly_intention`
- several petition fragments
- `SPECIAL:daily_novena_audio`
- `intercessory-litany`

But the current live output no longer resolves through that sequence.

### Daily Rosary

`Main page row -> DAILY_ROSARY_OUTPUT -> daily-rosary-wrapper -> BARRON_ROSARY_PAGE_AUDIO -> rss_audio_v1`

This means `Daily Rosary` is fragment-backed at the top, but the actual source is still a wrapped page-audio config.

### Rosary with Intentions

`Main page row -> ROSARY_INTENTIONS_OUTPUT -> rosary_dynamic_v1`

This is the main exception to the top-level fragment-wrapper pattern.

It does use fragment library content for repeated prayers and the meditation prompt template, but the output itself is not represented as a top-level fragment row today.

### Text-sync pages

Example:

`Night Prayer (Optional) -> Text Resolver -> DIVINE_OFFICE_NIGHT_TEXT -> divine_office_night_text_v1 -> page content blocks`

This is another example of page resolvers pointing directly at a base config rather than at an output row or fragment entrypoint.

## Friction And Simplification Pressure Points

These are research findings, not implementation steps.

### 1. There are still four logical layers

Even after recent normalization work, the operational model still spans:

- main page rows
- page-audio configs
- outputs
- fragments

That is the main reason the mental model still feels heavier than "one fragment list".

### 2. Top-level outputs are duplicated

For most auto-audio items, the same concept exists twice:

- once as an `Audio Output` row
- once as a wrapper fragment row in `page_audio_output_wrappers`

This duplication is real today, even though it was helpful for migration.

### 3. The fragment database mixes content and wiring

The fragment list currently contains both:

- meaningful reusable content fragments
- structural wrapper rows that exist mostly to bridge back into config-based builders

That makes the list harder to browse as a content-first library.

### 4. Most fragment rows still rely on type inference

53 of the 72 fragment rows leave `Fragment Type` blank. That works in code, but it makes the live Notion model harder to read and sort confidently.

### 5. Morning Prayer is not truly fragment-driven today

The active Morning Prayer path is driven by the live Morning Prayer page body plus dynamic inserts, not by the `Morning Prayer` fragment rows. That means there are multiple representations of Morning Prayer content in Notion today.

### 6. Rosary is still a special path

`ROSARY_INTENTIONS_OUTPUT` still uses a dedicated output mode and builder. It consumes fragments, but it is not yet modeled as a normal top-level fragment entrypoint.

### 7. Some metadata is first-class, some metadata is hidden

Examples:

- `Collection`, `Start Date`, and `End Date` are first-class
- rosary mystery metadata like `fruit` is stored as JSON in `Notes`
- `Order` exists but is unused
- `Target Row` exists but appears unused

This means the current metadata model is incomplete for a clean grouping/sorting story.

### 8. Notion is not yet the only source of truth

Some required configs still exist only in `config/page_audio_config.json`, so a Notion-only mental model is still incomplete.

### 9. Page resolvers still carry old world assumptions

The main page database is cleaner than before, but it still:

- mixes output keys and base config keys
- retains many legacy `Spotify Resolver` values

That makes page rows more historical than they need to be.

## What The Current System Already Supports

The code is ahead of the live Notion model in some ways.

The runtime already supports fragment concepts beyond simple text rows:

- `text`
- `prompt`
- `sequence`
- `config`
- `builder`
- `monthly_intention`
- `random_intention`
- `daily_novena_audio`

It also supports recursive fragment resolution with cycle detection and full `PageAudioPlan` merging.

That means the code already has the beginnings of a generic fragment system. The live Notion data model simply has not fully moved onto it yet.

## What A Future "One Fragment List" Must Preserve

This is not the implementation plan. It is the constraint list the plan will need to respect.

Any simplified model will still need to represent:

- leaf spoken text
- prompt templates
- provider-backed/dynamic fragments
- scheduled/date-windowed fragments
- top-level entrypoints for pages
- audio source wrappers
- page-content sync behavior, not just audio
- source fallback behavior
- metadata for grouping and sorting

The plan will also need to make explicit decisions about these seams:

- whether `Audio Outputs` survives as a separate stable contract layer
- whether `Page Audio Configuration` survives as an internal template layer
- whether main page rows should point only to fragment keys
- whether Morning Prayer content should live in page body, fragment rows, or both
- whether rosary scheduling and mystery metadata become first-class fragment metadata
- whether file-only configs should be moved fully into Notion

## Open Questions For The Next Phase

These are the main research outputs to carry into planning:

1. What should be the canonical top-level object: output row, fragment row, or both?
2. Should pages resolve directly to fragment keys instead of to a merged config namespace?
3. Should wrapper fragments remain visible in the same list as content fragments?
4. Should `Page Audio Configuration` be absorbed into typed fragments, or retained as an internal builder/source layer?
5. What is the source of truth for Morning Prayer content?
6. How should rosary metadata move out of `Notes` JSON into explicit metadata fields?
7. Which current fragment fields should become true metadata for grouping/sorting, and which should be removed?
8. Should file-only configs be migrated into Notion before deeper simplification?

## Working Conclusion

The current system is no longer purely config-driven, but it is also not yet truly fragment-first end to end.

The cleanest description of the current architecture is:

- pages resolve into a merged config namespace
- outputs mostly normalize page entrypoints into wrapper fragments
- fragments contain both content and wiring
- specialized builders still exist for Morning Prayer, RSS-backed sources, text sync, and rosary

That is a workable base for simplification, but not yet the final mental model you want.

The next document should be an implementation plan that decides:

- what remains as a separate layer
- what gets collapsed into the fragment list
- which current metadata fields become the canonical grouping/sorting model
- and how to migrate live Notion rows without breaking the current daily flows
