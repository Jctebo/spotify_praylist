# Roadmap: Publish Content

## Summary Of Changes
- Create a new publishing roadmap that replaces the closed stabilization roadmap and the deleted novena audio roadmap.
- Build the publishing system in phases: repeated daily prayer contracts first, then liturgical-calendar-aligned novena contracts, then Notion text output, durable storage and RSS feeds, Spotify podcast setup, and finally podcast resolvers.
- Treat novena as a scheduled content product inside the broader publishing system rather than as a standalone audio-only roadmap.

## Roadmap Mode
- Detailed roadmap

## Problem
- Prayer content is currently split across contract files, Notion output, OneDrive-style storage, disabled novena workflows, and Spotify playlist automation.
- The next product shape needs one publish pipeline that can create repeatable daily prayer content, schedule novenas from the liturgical calendar, publish text and audio artifacts, expose RSS feeds, and connect those feeds to Spotify podcasts.

## Audience
- Primary user: the maintainer who creates and operates daily prayer and novena publishing workflows.
- Secondary stakeholders: listeners who receive prayer content through podcast clients and Spotify.
- Secondary stakeholders: future collaborators who need clear contracts and release boundaries before adding more prayer products.

## Current Status Quo
- Morning Prayer has an active custom TTS contract at `config/custom_tts/morning-prayer.json`.
- The page-audio runtime can produce Notion page content and audio artifacts, but the publishing contract is still Morning Prayer-centered.
- The novena workflow remains disabled as an active rollout surface.
- Liturgical calendar sync exists, but novena publication is not yet driven by calendar-owned scheduling rules.
- Spotify playlist refresh is contract-backed, but podcast feed publication and podcast-specific resolvers are not yet established.

## What Already Exists
- `config/custom_tts/morning-prayer.json` shows the active daily prayer contract pattern.
- `jobs/notion/generate_page_audio.py` contains the current page-audio generation and Notion output surface.
- `jobs/notion/generate_prayer.py` exists as a generic prayer runner entrypoint.
- `jobs/novena/generate_daily_novena_prayer.py` is the existing novena generation surface, though not yet the target publication shape.
- `jobs/novena/liturgical_helpers.py` and `jobs/novena/sync_liturgical_calendar.py` provide reusable liturgical calendar primitives.
- `.github/workflows/liturgical_calendar_yearly_sync.yml` already supports calendar population.
- `config/spotify/contracts/*.json` and `jobs/playlist/refresh_playlist.py` show the repo-owned contract style used by the playlist side.

## Sequencing Principles
- Stabilize the contract shape before adding distribution surfaces.
- Build repeated daily prayer contracts before novena contracts so the daily content model becomes the reusable base.
- Add liturgical-calendar scheduling before public feeds so novena publication is automatic and reviewable.
- Publish to Notion text boxes before storage and RSS so content can be inspected before it is distributed.
- Create RSS feeds before Spotify podcast setup because Spotify needs stable feed URLs and show metadata.
- Add podcast resolvers after real podcasts exist so resolver behavior is grounded in production feed identities.

## Release Overview
- Release 1: Repeated Daily Prayer Contracts - define the reusable contract model for daily prayer publishing.
- Release 2: Liturgical Novena Contracts - align novena contracts to the liturgical calendar and auto-schedule them.
- Release 3: Notion Text Output - publish generated prayer and novena text into Notion text boxes for review and reuse.
- Release 4: Storage And RSS Publication - publish artifacts to durable storage and expose valid RSS feeds.
- Release 5: Spotify Podcast Launch And Resolvers - set up Spotify podcasts, then add resolvers for the new podcast feeds.

## Release 1: Repeated Daily Prayer Contracts

### Goal
- Establish a reusable contract model for repeated daily prayer content without broad legacy prayer surfaces.

### Scope
- In scope:
- Define daily prayer contract fields for identity, schedule, text sections, audio settings, Notion output, storage output, and podcast/feed metadata placeholders.
- Use Morning Prayer as the first reference contract.
- Separate contract validation from runtime publishing so future prayers can be added predictably.
- Keep the model friendly to repeated daily content, not one-off generated content.
- Explicitly deferred:
- Additional legacy prayer contract families.
- Novena calendar scheduling.
- Public RSS or Spotify setup.

### Why This Release Now
- Everything downstream depends on a stable contract language.
- Morning Prayer already provides a concrete working example that can be generalized without reopening the old multi-prayer migration.

### Research Notes
- `config/custom_tts/morning-prayer.json` already contains identity, output path, TTS metadata, and ordered resolvers.
- `docs/architecture/morning-prayer-contract.schema.json` documents an earlier contract shape and can inform validation.
- The active runtime still carries Morning Prayer-specific behavior that should be planned carefully before broadening.

### Plan
- Define the daily prayer contract shape at roadmap level.
- Confirm which parts of the Morning Prayer contract are generic versus Morning Prayer-specific.
- Plan validation expectations for required fields, resolver ordering, output targets, and disabled states.

### Features
- Repeated daily prayer contract schema.
- Morning Prayer as the first daily prayer reference contract.
- Validation expectations for contract identity, schedule, output, and resolver shape.
- Clear boundary around repeated daily prayer contracts.

### Stories
- As the maintainer, I want repeated daily prayer contracts, so each prayer can be configured without custom code.
- As the operator, I want validation before publishing, so broken contracts fail before they create bad Notion, storage, or feed output.

### Dependencies
- Current Morning Prayer contract.
- Existing page-audio generation behavior.
- Agreement on the minimum daily prayer metadata needed by later Notion, storage, RSS, and podcast phases.

### Risks
- The contract can become too broad if it tries to support every legacy prayer shape immediately.
- Reusing Morning Prayer too literally could make the model hard to apply to later daily prayers.

### Exit Criteria
- The roadmap has a clear contract target for repeated daily prayers.
- Morning Prayer is identified as the reference implementation.
- Release 2 can build novena contracts without redefining the daily contract base.

## Release 2: Liturgical Novena Contracts

### Goal
- Define novena contracts that align to the liturgical calendar and are automatically scheduled by calendar data.

### Scope
- In scope:
- Define novena contract fields for feast, start date rule, duration, daily text/audio sections, eligibility, and calendar source.
- Use the Liturgical Calendar data as the scheduling authority.
- Auto-schedule novena runs from calendar entries instead of manual workflow switches.
- Preserve operator visibility into which novena is scheduled and why.
- Explicitly deferred:
- AI-generated novena expansion unless needed for contract examples.
- Public RSS publication.
- Spotify podcast setup.

### Why This Release Now
- Novena scheduling depends on a stable daily contract base, but it needs its own calendar-aware rules before anything public is published.

### Research Notes
- `jobs/novena/generate_daily_novena_prayer.py` is the current novena generation surface.
- `jobs/novena/liturgical_helpers.py` contains shared calendar logic already used across novena and devotional image work.
- `jobs/novena/sync_liturgical_calendar.py` and `docs/liturgical.ics` show the existing calendar population and export context.

### Plan
- Treat the liturgical calendar as the source of scheduling truth.
- Define novena contract metadata separately from daily prayer contract metadata only where calendar scheduling requires it.
- Keep schedule decisions inspectable so a future plan can test feast eligibility, start windows, and duplicate prevention.

### Features
- Calendar-aligned novena contract model.
- Automatic novena scheduling from liturgical calendar entries.
- Operator-visible schedule decisions.
- Fail-closed behavior for ambiguous or missing calendar data.

### Stories
- As the maintainer, I want novena contracts tied to the liturgical calendar, so novenas start at the right time without manual setup.
- As the operator, I want to see why a novena was scheduled, so I can trust calendar-driven automation.

### Dependencies
- Release 1 daily prayer contract base.
- Liturgical Calendar sync data.
- Existing novena helper and generation code.

### Risks
- Calendar edge cases can create duplicate, missing, or mistimed novenas.
- A too-flexible contract could make scheduling behavior hard to test.

### Exit Criteria
- Novena contracts have a calendar-aware shape.
- The scheduling source and eligibility rules are clear enough for implementation planning.
- The old novena audio roadmap is fully replaced by this release sequence.

## Release 3: Notion Text Output

### Goal
- Publish daily prayer and novena text into Notion text boxes before public distribution.

### Scope
- In scope:
- Define how generated prayer text maps into Notion text boxes.
- Support text output for repeated daily prayers and calendar-scheduled novenas.
- Keep Notion output inspectable and replaceable rather than manually patched.
- Preserve enough metadata to connect Notion text output to later storage and RSS artifacts.
- Explicitly deferred:
- Final media storage.
- RSS feed publication.
- Spotify podcast submission.

### Why This Release Now
- Notion is the review and operating surface. Text should be visible there before media and feeds are published outside the workspace.

### Research Notes
- `jobs/notion/generate_page_audio.py` already writes page content for Morning Prayer.
- The current contract targets include `page_content` and `audio`, which can inform a cleaner text-box output boundary.
- Recent Spotify work already uses Notion rows as operational controls, but podcast content text output needs its own publishing path.

### Plan
- Define Notion text-box targets at the contract level.
- Keep replacement rules clear so each run updates the intended content without accumulating stale blocks.
- Preserve links or identifiers needed by later storage and RSS publication.

### Features
- Notion text-box publication for daily prayer contracts.
- Notion text-box publication for scheduled novena contracts.
- Metadata connection from Notion text to later public artifacts.
- Replaceable output behavior.

### Stories
- As the maintainer, I want generated text in Notion, so I can inspect and adjust content before it becomes public.
- As the operator, I want repeated runs to replace the right text boxes, so Notion does not collect stale generated output.

### Dependencies
- Release 1 repeated daily prayer contracts.
- Release 2 scheduled novena contracts.
- Notion page or database targets for text output.

### Risks
- Notion schema drift can break output routing.
- If replacement rules are vague, generated content may duplicate or overwrite the wrong content.

### Exit Criteria
- Daily prayer and scheduled novena text can be mapped to Notion text boxes.
- Replacement and metadata rules are clear.
- The output is ready to feed storage and RSS planning.

## Release 4: Storage And RSS Publication

### Goal
- Publish prayer artifacts to durable storage and expose valid RSS feeds for podcast clients.

### Scope
- In scope:
- Choose the storage location for text, audio, RSS XML, and supporting metadata.
- Define stable media URLs and RSS item metadata.
- Generate RSS feeds from the published daily prayer and novena artifacts.
- Keep feed identity stable across reruns.
- Explicitly deferred:
- Spotify podcast submission and show configuration.
- Podcast resolvers that depend on live Spotify podcast identities.

### Why This Release Now
- RSS is the bridge between generated content and podcast platforms, but it needs stable storage and Notion-reviewed content first.

### Research Notes
- The repo already writes audio artifacts and syncs selected outputs to OneDrive-style paths.
- Legacy page-audio configs contain RSS ingestion patterns, but publication is a different boundary and should be planned deliberately.
- Current README deployment notes already describe persistent storage mounted at `/data` for generated audio and image jobs.

### Plan
- Pick one canonical storage boundary for public feed files and media enclosures.
- Define feed metadata, enclosure URL rules, retention, and rerun behavior.
- Validate RSS with generated examples before podcast setup.

### Features
- Durable storage publication for text and audio artifacts.
- RSS feed generation for daily prayer content.
- RSS feed generation for scheduled novena content.
- Stable enclosure URLs and feed metadata.

### Stories
- As a listener, I want a valid RSS feed, so I can subscribe in a standard podcast app.
- As the maintainer, I want storage and RSS generated from the same artifacts, so Notion, media files, and feeds do not drift.

### Dependencies
- Release 3 Notion text output.
- A selected public storage location.
- Stable audio artifact naming and retention rules.

### Risks
- Storage and feed identity choices are hard to change after podcast clients subscribe.
- Metadata churn can create duplicate podcast episodes.
- If media URLs are not durable, podcast clients may fail after publication.

### Exit Criteria
- Feed XML validates.
- Feed and media URLs are stable and fetchable.
- Daily prayer and novena publication can be tested from storage without Spotify.

## Release 5: Spotify Podcast Launch And Resolvers

### Goal
- Create and configure Spotify podcasts from the RSS feeds, then add resolvers for the new podcast outputs.

### Scope
- In scope:
- Set up Spotify podcast entries for the published feeds.
- Confirm feed ownership, artwork, title, description, category, and episode ingestion.
- Add resolver contracts for the new podcast outputs after the podcasts exist.
- Keep resolver behavior separate from playlist refresh behavior unless a later plan deliberately connects them.
- Explicitly deferred:
- New prayer products beyond the daily prayer and novena publishing surfaces defined in earlier releases.

### Why This Release Now
- Spotify setup requires stable RSS feeds. Podcast resolvers should come after real podcast identities exist so they can resolve against live outputs instead of guesses.

### Research Notes
- `jobs/playlist/refresh_playlist.py` already supports resolver-backed Spotify playlist queues, but podcast resolver behavior needs a separate product boundary.
- Existing `config/spotify/contracts/*.json` can inform naming, validation, and fail-closed resolver design.
- Podcast setup itself will involve platform configuration outside the repo, while resolver contracts should be repo-owned.

### Plan
- Use the RSS feeds from Release 4 to create Spotify podcast entries.
- Record podcast identities and feed metadata in repo-owned contracts or docs as appropriate during implementation planning.
- Add resolvers only after feed ingestion succeeds.

### Features
- Spotify podcast setup for daily prayer feed.
- Spotify podcast setup for novena feed.
- Podcast resolver contracts for newly created podcasts.
- Validation for missing or unresolved podcast identities.

### Stories
- As a listener, I want the prayer feeds available on Spotify, so I can follow them where I already listen.
- As the maintainer, I want repo-owned podcast resolvers, so downstream automation can use the new podcasts predictably.

### Dependencies
- Release 4 valid RSS feeds and durable media URLs.
- Spotify podcast account access and feed ownership verification.
- Final show metadata and artwork.

### Risks
- Spotify ingestion and ownership verification can expose metadata or feed defects that were invisible locally.
- Resolver work can accidentally blur podcast publishing and playlist refresh responsibilities.

### Exit Criteria
- Spotify podcasts are created and ingest the intended feeds.
- Podcast identities are recorded for future automation.
- Resolver contracts can resolve the new podcasts without depending on manual lookup.

## Cross-Cutting Risks
- Source-of-truth sprawl can return if contracts, Notion text boxes, storage metadata, RSS XML, Spotify setup, and resolvers each own different parts of the same identity.
- Liturgical calendar edge cases can affect novena scheduling across multiple releases.
- Public feed identity is difficult to rename or relocate after clients subscribe.
- Podcast platform setup includes manual or semi-manual steps that must be captured carefully in implementation planning.

## Assumptions And Unknowns
- Fact: Morning Prayer has an active custom TTS contract at `config/custom_tts/morning-prayer.json`.
- Fact: the novena workflow is not currently an active rollout surface.
- Fact: liturgical calendar sync and helper code exist in `jobs/novena/`.
- Fact: Spotify playlist automation is contract-backed, but podcast publication is not yet built.
- Assumption: Notion text boxes are the desired first output surface before storage and RSS.
- Assumption: storage will provide durable public URLs for RSS XML and media enclosures.
- Unknown: the exact storage location for public feed and media files.
- Unknown: the final Notion schema or page targets for text-box publication.
- Unknown: final Spotify show metadata, artwork, and ownership verification steps.

## Recommended Next Step
- Move Release 1, Repeated Daily Prayer Contracts, into `/plan-astack` first.
- That release establishes the contract language needed by novena scheduling, Notion text output, storage, RSS, Spotify podcasts, and podcast resolvers.
