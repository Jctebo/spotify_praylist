# Morning Prayer Redesign Architecture

## Problem Statement
Morning Prayer has become the most fragile part of the page-audio pipeline. The current design mixes runtime rendering, live Notion row shape, durable keys, special handling, and migration repair logic in ways that are hard to reason about and easy to break.

The repeated drift comes from:
- canonical rows and owner-linked rows diverging
- special items like `Monthly Intention`, `Daily Novena Audio`, and `Random Intention` needing custom behavior
- the workflow preflight failing even when the live database appears to contain the right content
- code fixes becoming compatibility patches instead of lasting architecture

This redesign narrows the problem to Morning Prayer only so we can define one clear system before applying the pattern elsewhere.

## Goals
- Define one canonical Morning Prayer contract.
- Make live-data normalization explicit and testable.
- Keep validation strict so real missing content still fails fast.
- Separate content identity from display title so titles can change without breaking the workflow.
- Support a page-by-page migration path starting with Morning Prayer, then retiring old code paths and Notion config after each page is moved.

## Proposed System Shape
Morning Prayer should be modeled as exactly two layers:

1. Opus Dei page layer
- This layer has no business logic.
- It is just the page surface in Notion.
- It stores the human-facing page title and page id.

2. JSON contract layer
- This layer is the source of truth for how the page is composed.
- It refers to the Opus Dei page id.
- It defines one ordered resolver list.
- Each resolver declares where its output lands: page content, audio, or both.
- It is easy to follow and easy to diff in git.
- It owns the composition rules, not the page itself.

The JSON contract should include:
- a header with metadata such as model, status, and page id
- one ordered `resolvers` section
- resolver blocks that can be file-based, prompt-based, reusable template-based, monthly-template based, or special code-driven kinds like `random_intention`
- resolvers can opt into audio reuse so previously generated audio fragments can be reused instead of rebuilt
- resolver sections are collapsible by default in Notion, so the contract does not need to carry a per-resolver `collapsible` flag

The schema for that contract lives in `docs/architecture/morning-prayer-contract.schema.json`.

The redesign must preserve:
- novena logic still runs up front when a feast day is approaching
- monthly intentions are stored as separate rotating templates, one per calendar month, rather than being embedded as one-off prose
- the actual text lives in repo files, and resolvers decide whether that text is emitted into content, audio, or both
- audio reuse should be standard and reuse-first, matching the current cache-and-library behavior in the codebase, but it stays implicit in the runtime rather than being encoded as a first-class JSON field in this contract

## JSON Configuration Shape
Each Morning Prayer record should capture:
- `key`: stable identifier for the contract
- `page_id`: the Opus Dei page id this contract refers to
- `title`: display title for the page
- `status`: enabled, draft, deprecated, or migrated
- `header`: metadata like model, page id, and render policy
- `resolvers`: ordered resolver definitions with destinations and metadata

### Sample Record: Morning Prayer
```json
{
  "key": "morning-prayer",
  "title": "Morning Prayer",
  "status": "enabled",
  "header": {
    "builder": "morning_prayer_v1",
    "model": "gpt-4o-mini-tts",
    "render_policy": "strict",
    "page_id": "0e8a66b1-2be7-4ea0-8a92-39695f930ecd"
  },
  "resolvers": [
    {
      "key": "random-intention",
      "kind": "code_driven",
      "resolver": "random_intention_v1",
      "order": 1,
      "title": "Random Intention",
      "targets": ["page_content", "audio"],
      "metadata": {
        "role": "shared_intro"
      }
    },
    {
      "key": "morning-offering",
      "kind": "file",
      "path": "config/morning-prayer/content/morning-offering.txt",
      "order": 2,
      "title": "Morning Offering",
      "targets": ["page_content", "audio"]
    },
    {
      "key": "daily-consecration",
      "kind": "file",
      "path": "config/morning-prayer/content/daily-consecration.txt",
      "order": 3,
      "title": "Daily Consecration",
      "targets": ["page_content", "audio"]
    },
    {
      "key": "baptismal-renewal",
      "kind": "file",
      "path": "config/morning-prayer/content/baptismal-renewal.txt",
      "order": 4,
      "title": "Baptismal Renewal",
      "targets": ["page_content", "audio"]
    },
    {
      "key": "petitions-intro",
      "kind": "file",
      "path": "config/morning-prayer/content/petitions-intro.txt",
      "order": 5,
      "title": "Petitions Intro",
      "targets": ["page_content", "audio"]
    },
    {
      "key": "monthly-intention",
      "kind": "monthly_template",
      "folder": "templates/monthly-intention",
      "selector": "current_calendar_month",
      "order": 6,
      "title": "Monthly Intention",
      "targets": ["page_content", "audio"],
      "metadata": {
        "rotation": "monthly"
      }
    },
    {
      "key": "petition-families",
      "kind": "file",
      "path": "config/morning-prayer/content/petition-families.txt",
      "order": 7,
      "title": "Petition - Families",
      "targets": ["page_content", "audio"]
    },
    {
      "key": "petition-marriages",
      "kind": "file",
      "path": "config/morning-prayer/content/petition-marriages.txt",
      "order": 8,
      "title": "Petition - Marriages",
      "targets": ["page_content", "audio"]
    },
    {
      "key": "petition-conversion",
      "kind": "file",
      "path": "config/morning-prayer/content/petition-conversion.txt",
      "order": 9,
      "title": "Petition - Conversion",
      "targets": ["page_content", "audio"]
    },
    {
      "key": "petition-church",
      "kind": "file",
      "path": "config/morning-prayer/content/petition-church.txt",
      "order": 10,
      "title": "Petition - Church",
      "targets": ["page_content", "audio"]
    },
    {
      "key": "petition-sanctification-of-the-church",
      "kind": "file",
      "path": "config/morning-prayer/content/petition-sanctification-of-the-church.txt",
      "order": 11,
      "title": "Petition - Sanctification of the Church",
      "targets": ["page_content", "audio"]
    },
    {
      "key": "petition-sick-and-departed",
      "kind": "file",
      "path": "config/morning-prayer/content/petition-sick-and-departed.txt",
      "order": 12,
      "title": "Petition - Sick and Departed",
      "targets": ["page_content", "audio"]
    },
    {
      "key": "daily-novena-audio",
      "kind": "code_driven",
      "resolver": "daily_novena_audio_v1",
      "order": 13,
      "title": "Daily Novena Audio",
      "targets": ["audio"],
      "metadata": {
        "feast_day_window": 9,
        "generated_up_front": true
      }
    },
    {
      "key": "intercessory-litany",
      "kind": "file",
      "path": "config/morning-prayer/content/intercessory-litany.txt",
      "order": 14,
      "title": "Intercessory Litany",
      "targets": ["page_content", "audio"]
    },
    {
      "key": "spotify-playlist",
      "kind": "spotify",
      "resolver": "do_morning_playlist_v1",
      "order": 15,
      "title": "Spotify Playlist",
      "targets": ["page_content", "playlist_creation"],
      "metadata": {
        "playlist_key": "morning-prayer",
        "playlist_name": "Morning Prayer",
        "creation_mode": "create_if_missing",
        "selection_resolver": "DO_MORNING",
        "fallback_resolver": "DIVINE_OFFICE_MORNING_PAGE_AUDIO"
      }
    }
  ]
}
```

### Sample Content Files
```text
config/morning-prayer/content/morning-offering.txt
O Jesus, through the Immaculate Heart of Mary and the Chaste Heart of St. Joseph,
I offer You my prayers, works, joys, and sufferings of this day,
in union with the Holy Sacrifice of the Mass throughout the world,
for all the intentions of Your Sacred Heart,
in reparation for my sins,
for the intentions of all my relatives and friends,
and in particular for the intentions of the Holy Father.
I wish to gain all the indulgences attached to the prayers I shall say
and the good works I shall perform this day.

config/morning-prayer/content/daily-consecration.txt
O Mary, my Queen and my Mother,
O Joseph, my father and guardian,
to you I consecrate this day all that I am and have:
my eyes, my ears, my mouth, my heart,
my whole being without reserve.
Protect me, guide me, and guard me as your own possession.
Assist me to know and love more deeply the Heart of Jesus,
to live faithfully this day in His grace,
and defend me at the hour of my death.

config/morning-prayer/content/baptismal-renewal.txt
O Sacred Body of Christ,
in whom I was made a new creation through Baptism at Corpus Christi,
receive my life anew this day.
Make me a living offering of praise to the glory of the Father.
I renounce sin and Satan, and I renew the promises of my baptism:
to live in the freedom of God's children,
to reject the glamour of evil,
and to follow Christ in faith, hope, and charity.
May the grace of my baptism bear fruit in every word, thought, and action this day. Amen.

config/morning-prayer/content/petitions-intro.txt
Petitions.
In union with the Church and all the angels and saints,

config/morning-prayer/content/petition-families.txt
For the Holy Father's monthly intention: that nations move toward effective disarmament, particularly nuclear disarmament, and that world leaders choose the path of dialogue and diplomacy instead of violence.

config/morning-prayer/content/petition-marriages.txt
For the healing and sanctification of families, for reconciliation where there is division, for children without both parents through death, divorce, or abandonment,
and for families suffering economic hardship.

config/morning-prayer/content/petition-conversion.txt
For the sanctification and strength of marriages, for fidelity in vocations, and for my own ongoing conversion and growth in holiness.

config/morning-prayer/content/petition-technology.txt
For the conversion of sinners, especially those in positions of influence,

config/morning-prayer/content/petition-church.txt
For the right use of knowledge and technology,

config/morning-prayer/content/petition-sanctification-of-the-church.txt
For the sanctification and unity of the Church in every land.

config/morning-prayer/content/petition-sick-and-departed.txt
For the sick suffering, and for the faithful departed, especially our family members
```

### Sample Record: Daily Novena Prayer
```json
{
  "key": "daily-novena-prayer",
  "title": "Daily Novena Prayer",
  "status": "enabled",
  "page_id": "replaced-by-live-page-id",
  "header": {
    "model": "gpt-4.1-mini",
    "render_policy": "strict",
    "page_id": "replaced-by-live-page-id"
  },
  "resolvers": [
    {
      "key": "daily-novena-audio",
      "kind": "novena_pipeline",
      "feast_day_window": 9,
      "order": 1,
      "title": "Daily Novena Audio",
      "targets": ["audio"],
      "metadata": {
        "generated_up_front": true
      }
    }
  ]
}
```

## Key Design Decisions

### 1. Identity is durable-key first
Morning Prayer should treat the resolver key as the runtime identity.
Display titles can change, but they cannot define the contract.

### 2. Special resolvers are explicit
`Monthly Intention`, `Daily Novena Audio`, and `Random Intention` are not just ordinary text sources.
They are generated resolvers with dedicated behavior and extra metadata.
The current implementation already reuses audio through stable hash values and persisted library fragment files under `PAGE_AUDIO_CACHE_DIR` / `PAGE_AUDIO_LIBRARY_DIR`, so the new contract should preserve that reuse-first shape instead of inventing a separate cache model.

### 3. Validation happens after normalization
Morning Prayer should reject incomplete content only after the normalization layer has resolved the live Notion shape.

### 4. Migration logic is page-by-page
The migration path should move one Opus Dei page at a time. Morning Prayer goes first, then once a page is fully moved its old code paths and Notion config can be retired.

## Data Flow
1. GitHub Actions or a local job loads the Morning Prayer source rows from Notion.
2. The normalization layer resolves canonical rows, owner-linked rows, and special resolvers into one Morning Prayer model.
3. Validation checks that all required resolvers are present.
4. If valid, the renderer builds page audio and page content from the resolved text.
5. If invalid, the job fails with a precise explanation of what is missing.

## Tradeoffs

### Benefit
- Fewer compatibility patches.
- Clearer debugging when Morning Prayer fails.
- Better separation between data repair and rendering.
- Easier testing because the model becomes explicit.

### Cost
- One more layer of abstraction before rendering.
- A one-time migration step for the live Notion data.
- Some short-term complexity while the old shape is still present.

## Open Questions
- None for the current Morning Prayer architecture pass.

## Next Step
Use `/research-astack` to map the current Morning Prayer code paths and identify the smallest set of modules that should be replaced by this architecture.
