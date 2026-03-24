# Morning Prayer Runtime Architecture

## Problem Statement
Morning Prayer needs a clean cutover away from the older multi-prayer job structure. The current codebase mixes prayer-specific branches, live Notion repair, novena generation, and shared upload behavior in a way that makes the runtime hard to narrow or safely extend later.

The goal is to make Morning Prayer the first working prayer in a simpler system that can later add the other prayers back without reintroducing the old entanglement.

## Target Shape
The system should have three clear layers:

1. Generic prayer runner
- One shared runner reads a prayer config and executes it.
- It should not hard-code Morning Prayer, Evening Prayer, or other prayer names.
- It owns the generic pipeline: load config, resolve sections, render page/audio, write files, and hand off outputs.

2. Prayer config
- One config file per prayer.
- Morning Prayer is the first config and the only one that must work right now.
- The config defines the ordered resolvers, their metadata, and what output each resolver targets.
- The config format should stay explicit and reviewable in git, with the JSON schema documenting the contract shape.

3. Shared calendar service
- Novena logic belongs here, not inside a specific prayer config.
- The service computes the feast-day window, saint/intentions, and generated novena content.
- Both the prayer runner and the devotional image job should consume this same calendar logic.
- Morning Prayer should only pull novena output if it is already available; it should not call the novena generator itself.

## Flow
```text
prayer config
      |
      v
generic prayer runner
      |
      +--> page content -> Notion page body
      +--> audio files -> cache/staging -> OneDrive upload
      +--> Spotify resolver -> playlist creation/update

shared novena/calendar service
      |
      +--> novena generation / caching
      +--> devotional image job
      +--> prayer runner novena consumer
```

## What Morning Prayer Needs
Morning Prayer is the pilot config and should keep:
- file-backed prayer text living in the repo
- a resolver entry for `Random Intention`
- a resolver entry for `Monthly Intention`
- a resolver entry for `Daily Novena Audio`
- a resolver entry for `Spotify`
- audio file materialization for OneDrive sync
- page content injection into Notion
- novena content should be read from shared generated output when available, not produced inline by Morning Prayer

Morning Prayer should not require legacy prayer builders or compatibility paths once the cutover is complete.

## Morning Prayer JSON Contract
The Morning Prayer config should stay concrete enough that a human can read it and know exactly what will happen.

The current contract shape should include:
- `key`: stable prayer identifier
- `title`: display name
- `status`: enabled or migrated state
- `header`: runtime metadata such as model, page id, and render policy
- `resolvers`: ordered resolver definitions

Each resolver should declare:
- `key`: stable resolver identity
- `kind`: `file`, `monthly_template`, `code_driven`, or `spotify`
- `title`: visible section title
- `order`: explicit ordering in the prayer
- `targets`: where the resolver output lands, such as `page_content`, `audio`, or `playlist_creation`
- kind-specific metadata such as file path, template folder, resolver name, or playlist fields

Sample resolver flow:
```text
Morning Prayer contract
        |
        +--> random-intention
        +--> morning-offering
        +--> daily-consecration
        +--> baptismal-renewal
        +--> petitions-intro
        +--> monthly-intention
        +--> petition-families
        +--> petition-marriages
        +--> petition-conversion
        +--> petition-church
        +--> petition-sanctification-of-the-church
        +--> petition-sick-and-departed
        +--> daily-novena-audio
        +--> intercessory-litany
        +--> spotify-playlist
```

The contract schema lives in `docs/architecture/morning-prayer-contract.schema.json` and should continue to define the resolver kinds and required metadata so the config stays consistent as more prayers are added back later.

## Job Boundary Direction
The repo should not keep a giant generic script that pretends every prayer is the same.

The better shape is:
- one generic prayer runner entrypoint (`jobs/notion/generate_prayer.py`)
- one workflow/job wrapper that calls that runner with a config file
- optional separate workflow wrappers only when operationally useful
- novena/calendar generation shared as a reusable service

This means:
- Morning Prayer can run now as the only active config
- later prayers can come back as new config files without rebuilding the engine
- novena logic stays reusable for the devotional image job and any prayer that needs it
- Morning Prayer can consume novena if the shared service has already produced it, but Morning Prayer should not be the thing that triggers novena generation

## Audio And Staging
Audio should still be generated as files before upload.

Suggested storage boundaries:
- `.cache/page_audio` for reusable render cache
- `onedrive_sync/Praylist Audio/Playlist Audio` for playlist audio staging
- `onedrive_sync/Praylist Audio/Novena Audio Library` for novena audio staging

The shared calendar service should not own file staging. It only provides the calendar-derived inputs that the runner and image job consume.

## Repo Boundaries
Relevant files today:
- `jobs/notion/generate_prayer.py`
- `jobs/notion/generate_page_audio.py`
- `jobs/novena/generate_daily_novena_prayer.py`
- `jobs/novena/generate_devotional_image.py`
- `scripts/migrate_page_audio_notion_schema.py`
- `.github/workflows/daily_novena_prayer.yml`
- `.github/workflows/daily_devotional_image_remote.yml`
- `config/morning-prayer.json`

Likely future split:
- `jobs/novena/calendar_service.py` or similar shared novena/calendar helper
- prayer configs under `config/<prayer-name>/`

## Tradeoffs
- A generic runner lowers duplication and makes the later reintroduction of other prayers much easier.
- A dedicated wrapper per prayer keeps workflow boundaries clear without duplicating the engine.
- Sharing novena/calendar code between the prayer job and the image job avoids drift between “what saint are we on?” decisions.

The main tradeoff is job consolidation versus job clarity. The recommendation is to consolidate code, not unrelated operational outputs.

## Risks
- Shared helpers may still assume multiple prayer modes exist.
- The GitHub Actions workflow may still point at a broad entrypoint until the cutover is completed.
- Live Morning Prayer Notion rows may still need one final ordering check after the runtime narrows.

## Open Questions
- Which legacy helper files can be deleted once Morning Prayer is proven end to end?
- Which shared helpers can stay generic utilities versus being deleted outright?
- Should the devotional image job call the shared calendar service directly, or through the same prayer-facing helper layer?

## Next Step
Use `/research-astack` to map which current job files can be trimmed, which should become generic helpers, and which should be split into dedicated wrappers for the Morning Prayer-only cutover.
