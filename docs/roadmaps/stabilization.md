# Roadmap: Stabilization of Codebase



## Summary Of Changes
- Release `0.1.3.2` shipped the novena/image decoupling work and moved the shared liturgical helper boundary.
- The devotional image failure was an OpenAI billing/key issue and was fixed operationally without a release, so it is no longer roadmap work.
- Morning Prayer OneDrive-first repair is complete, so the roadmap now starts with Angelus as the default and Regina Caeli for Easter season, then voice, RSS, and intention layers.
- Novena work has been moved into a separate audio roadmap so the stabilization track stays focused.

## Recent Completed Work
- `0.1.3.2` shipped on 2026-03-28 and decoupled devotional image generation from the novena helper surface.
- The image access issue was resolved outside the release train after the underlying billing/key problem was identified.
- The active roadmap no longer needs a separate image-recovery milestone.
- The Morning Prayer OneDrive repair is complete and can stay the stable base publish path.

## Items to Prioritize
- Updating Angelus to default to Angelus and use Regina Caeli during Easter season
  - Singing Version - Pope Leo https://open.spotify.com/track/1dbE76sfAobxVwYYjQ6yb6?si=CpUQlJe7ShyEVPrjXNYnhg
  - Spoken Version - Catholic Prayers Daily - https://open.spotify.com/episode/68xFE8g1JRFu62osp0tLNg?si=Lwt_hFWtTAqB4FGsOnhvQnT&t=67

## Roadmap Mode
- Detailed roadmap

## Problem
- Morning Prayer now has a repaired OneDrive-first delivery path, so the next stabilization focus is Angelus as the default and Regina Caeli for Easter season before any broader distribution changes.
- Once those core prayer outputs are stable, the repo can safely move on to TTS migration, RSS publication, and personal intention contracts.

## Audience
- Primary user: the maintainer running the daily prayer and publishing automations.
- Secondary stakeholders: listeners and downstream consumers who rely on Morning Prayer and future RSS outputs.
- Secondary stakeholders: future collaborators who need a simple release order instead of overlapping workstreams.

## Current Status Quo
- `0.1.3.2` has already split devotional image generation from the novena helper boundary.
- The OpenAI image issue is resolved operationally, so it should not stay in the roadmap backlog.
- `jobs/notion/generate_page_audio.py` still carries the Morning Prayer assembly and OneDrive export path.
- The daily novena workflow remains intentionally disabled while its future work is tracked on a separate audio roadmap.
- The repo has OneDrive sync patterns and existing intention helpers that can be reused later.

## What Already Exists
- Morning Prayer assembly and export logic in `jobs/notion/generate_page_audio.py`.
- The shared liturgical helper boundary introduced by `0.1.3.2`.
- Existing OneDrive upload and sync conventions for prayer artifacts.
- Existing intention primitives in the page-audio and playlist code paths.

## Sequencing Principles
- Use the repaired Morning Prayer path as the stable base before adding Angelus default/Easter-season Regina Caeli handling or new delivery surfaces.
- Keep TTS migration separate from delivery fixes so voice changes do not hide output bugs.
- Add RSS only after the artifact, voice, and publish boundary are stable.
- Leave personal intention contracts until the base prayer outputs are reliable enough to personalize.

## Release Overview
- Release 1: Angelus Default with Easter Season Regina Caeli
- Release 2: TTS Provider Migration
- Release 3: RSS Publication Surface
- Release 4: Custom Intention Contracts

## Release 1: Angelus Default with Easter Season Regina Caeli

### Goal
- Make Angelus the default and swap to Regina Caeli during Easter season before any broader publishing work.

### Scope
- In scope:
- Repair the Angelus resolver so Angelus is the default and Easter season maps to Regina Caeli.
- Keep the selected prayer explicit and testable instead of hidden behind manual switches.
- Validate that Easter season resolves to Regina Caeli and the rest of the year resolves to Angelus.
- Keep fail-closed behavior so missing calendar mapping does not silently publish the wrong prayer version.
- Explicitly deferred:
- RSS feed generation.
- Broad public-hosting decisions beyond the Angelus path.
- TTS-provider migration until default-versus-Easter selection is stable.

### Why This Release Now
- The repo already has the Angelus and Regina Caeli variants identified, and the next gap is deterministic default-versus-Easter selection.
- This keeps the stabilization track focused on a single prayer surface before broader voice or RSS work.

### Research Notes
- `docs/roadmaps/novena-audio.md` already calls out the Angelus seasonal adaptation item.
- The stabilization roadmap should treat that item as a release-level repair, not a loose backlog note.
- Existing prayer artifact and resolver patterns can inform how the default-versus-Easter boundary should behave.

### Plan
- Define the default Angelus rule and the Easter-season Regina Caeli swap.
- Validate the resolver against Easter season and non-Easter paths.
- Keep the selected variant stable enough that later TTS or publishing work does not have to rediscover the same liturgical logic.

### Features
- Default Angelus selection.
- Easter-season Regina Caeli routing.
- Validation that Easter resolves to Regina Caeli and other seasons resolve to Angelus.

### Stories
- As the maintainer, I want Angelus to stay the default and switch to Regina Caeli during Easter season, so the right prayer version is selected without manual intervention.
- As a listener, I want Easter season to use Regina Caeli and the rest of the year to use Angelus, so the output feels liturgically appropriate.

### Dependencies
- The completed Morning Prayer OneDrive repair as the stable publish base.
- Clear liturgical mapping for Angelus and Regina Caeli already identified in the separate audio roadmap.

### Risks
- Liturgical logic can be easy to get subtly wrong if the Easter boundary is not explicit.
- Ambiguous fallback behavior could reintroduce manual selection work.
- If the resolver and contract drift, the wrong version could be published quietly.

### Exit Criteria
- Angelus resolves to the default form outside Easter and Regina Caeli during Easter.
- The selected variant is validated in tests or equivalent checks.
- The repair can be trusted as the next stable stabilization release.

## Release 2: TTS Provider Migration

### Goal
- Move Morning Prayer off the current OpenAI-first TTS path onto the next chosen provider after delivery is stable.

### Scope
- In scope:
- Introduce a provider-aware TTS boundary for the Morning Prayer path.
- Migrate defaults, cache behavior, and render metadata away from assuming an OpenAI-only TTS model.
- Keep a controlled fallback during rollout if the new provider strategy requires one.
- Update tests, docs, and operational setup for the new provider.
- Explicitly deferred:
- RSS launch until the new voice path is stable.
- Broad migration of unrelated legacy jobs that are no longer part of the core Morning Prayer publish surface.

### Why This Release Now
- Provider migration changes voice quality, cache identity, and operational risk.
- It belongs after the Morning Prayer and novena output paths are stable so voice changes do not hide delivery regressions.

### Research Notes
- Current defaults across page-audio and novena paths remain OpenAI-first.
- The final replacement provider still needs to be locked during implementation planning.
- Existing tests and configs already give this release a concrete migration surface.

### Plan
- Keep the release provider-aware in roadmap form.
- Lock the exact destination provider during `/plan-astack`.
- Treat cache keys, render hashes, and fallback behavior as first-class migration work, not cleanup.

### Features
- Provider-aware Morning Prayer TTS configuration.
- Updated cache and render identity for the new provider.
- Controlled rollback or fallback behavior during migration.

### Stories
- As the maintainer, I want Morning Prayer to render through the new TTS provider, so the voice stack matches the intended product direction.
- As the operator, I want provider-aware fallbacks and logging, so a provider outage does not turn into silent broken publishing.

### Dependencies
- The completed Morning Prayer OneDrive repair as the stable publish base.
- Credentials and operational limits for the selected replacement TTS provider.

### Risks
- The replacement provider has not yet been explicitly locked in this roadmap.
- Voice changes can alter duration, cache keys, and downstream publishing assumptions.
- A weak fallback strategy could hide regressions instead of surfacing them clearly.

### Exit Criteria
- Morning Prayer renders through the chosen non-default provider in the normal path.
- Cache behavior and tests are provider-aware.
- Operators can deliberately validate fallback or rollback behavior if needed.

## Release 3: RSS Publication Surface

### Goal
- Publish Morning Prayer through an RSS feed once artifact generation and TTS are stable.

### Scope
- In scope:
- Define how a Morning Prayer artifact becomes an RSS item with durable metadata and media URLs.
- Add feed-generation logic and stable episode metadata.
- Choose the public-hosting boundary for RSS XML and media enclosures.
- Keep Morning Prayer as the first RSS product rather than reopening the broader legacy page-audio surface.
- Explicitly deferred:
- Re-expanding RSS publication to every older prayer family.
- Personal intention contract publishing, which stays sequenced after base RSS exists.

### Why This Release Now
- RSS is safer once the artifact contract and voice stack are already stable enough to publish outside OneDrive-only workflows.

### Research Notes
- The repo has RSS ingestion builders but does not yet show a Morning Prayer RSS publication path.
- OneDrive and GitHub Pages already exist as delivery mechanisms, but neither is yet declared the canonical RSS publication host.

### Plan
- Reuse the stabilized Morning Prayer artifact package from the completed Morning Prayer repair and Release 2.
- Keep feed identity stable enough that podcast clients do not treat each rollout as a new show.
- Choose one hosting boundary deliberately instead of mixing OneDrive links, Pages assets, and ad hoc storage.

### Features
- Morning Prayer RSS feed generation.
- Stable episode metadata and enclosure URLs.
- A documented hosting boundary for feed and media delivery.

### Stories
- As a listener, I want Morning Prayer available through RSS, so I can receive the daily output in a standard podcast client.
- As the maintainer, I want RSS to publish from the same stable artifact path, so OneDrive-first delivery and public feed delivery stay aligned.

### Dependencies
- The completed Morning Prayer OneDrive repair as the stable base artifact path.
- Release 2's stable TTS-provider path.
- A validated public-hosting decision for RSS and media URLs.

### Risks
- The repo still needs to choose which hosting surface should be authoritative for RSS and audio enclosures.
- Metadata churn could create duplicate or broken podcast entries.
- Publishing too early could expose a feed before the underlying artifact contract is stable enough for outside consumption.

### Exit Criteria
- A valid Morning Prayer RSS feed is generated from the stabilized artifact path.
- Feed metadata and enclosure URLs are stable and fetchable.
- The team has one declared publication boundary for the feed.

## Release 4: Custom Intention Contracts

### Goal
- Add Morning, Midday, Night, and Sunday intention contracts that source personal intentions from Notion and publish them to OneDrive.

### Scope
- In scope:
- Define a contract layer for custom time-of-day intention outputs.
- Pull personal intentions from Notion using a stable mapping instead of ad hoc manual copy.
- Publish the resulting Morning, Midday, Night, and Sunday intention outputs to OneDrive.
- Reuse existing intention primitives where they help, but formalize them into durable contracts rather than keeping them as scattered helpers.
- Explicitly deferred:
- Reworking Spotify sync again unless a later plan proves these contracts should also affect Spotify outputs.
- Broad personalization beyond the four requested time-of-day surfaces.

### Why This Release Now
- Personalization is more valuable once the base delivery surfaces are already stable; otherwise it adds data-shape and privacy complexity to the core recovery work.

### Research Notes
- `jobs/notion/generate_page_audio.py` already contains `random-intention` and `monthly_intention` concepts that may be reusable.
- `jobs/playlist/refresh_playlist.py` already has `distribute_prayer_intentions(...)`, which is not the target release shape but does show an existing Notion-selection pattern.
- There is not yet a contract-first OneDrive publishing layer for custom Morning, Midday, Night, and Sunday intention outputs.

### Plan
- Define the contract boundary first: what each time-of-day output is called, how it maps to Notion data, and what gets published to OneDrive.
- Reuse existing selection and fragment ideas where useful, but keep the new release explicit and contract-driven.
- Protect privacy and publication boundaries before treating personal intentions as routine output artifacts.

### Features
- Morning intention contract.
- Midday intention contract.
- Night intention contract.
- Sunday intention contract.
- Notion-sourced personal intention selection and OneDrive publishing.

### Stories
- As the maintainer, I want personal intentions from Notion turned into time-of-day contracts, so Morning, Midday, Night, and Sunday outputs feel personal and repeatable.
- As the operator, I want those intention outputs published to OneDrive from one consistent contract surface, so the workflow is inspectable and maintainable.

### Dependencies
- Stable OneDrive publishing conventions from the completed Morning Prayer repair.
- A clear Notion schema for personal intentions.
- Agreement on what the published OneDrive artifact looks like for each time-of-day contract.

### Risks
- Personal-intention data can create privacy and publication-boundary concerns if OneDrive destinations are broader than intended.
- If Notion schema or property names drift, the contract layer could become brittle.
- Without a clear contract shape, the work could sprawl into a partial redesign of Morning Prayer, playlists, and RSS all at once.

### Exit Criteria
- The repo has explicit Morning, Midday, Night, and Sunday intention contracts.
- Those contracts can resolve personal intentions from Notion.
- The resulting outputs are published to OneDrive through one documented path.

## Cross-Cutting Risks
- Operational credential issues could still affect the Morning Prayer and novena paths while OpenAI remains on the hot path before the TTS migration ships.
- The repo still contains legacy and current workflow surfaces, so unclear ownership of "the real path" could slow Releases 1 and 2.
- OneDrive is already a strong sync boundary, but it may or may not be the right final public-hosting boundary for RSS.
- Source-of-truth sprawl could return if contracts, Notion properties, workflow secrets, and publish metadata are split across too many places without one clear owner per concern.
- Personal-intention publishing adds privacy sensitivity that the earlier infrastructure releases do not have.

## Assumptions And Unknowns
- Fact: `0.1.3.2` shipped on 2026-03-28 and finished the novena/image helper decoupling work.
- Fact: the OpenAI image failure was resolved operationally and does not need a roadmap release.
- Fact: `.github/workflows/daily_novena_prayer.yml` is intentionally disabled.
- Fact: the Morning Prayer OneDrive repair is complete and no longer the active stabilization item.
- Fact: `jobs/notion/generate_page_audio.py` still uses the playlist-audio OneDrive library boundary and still assumes OpenAI on the current TTS path.
- Fact: the repo has RSS ingestion behavior, but no confirmed Morning Prayer RSS publication path yet.
- Fact: novena-specific roadmap work now lives on a separate audio roadmap instead of this stabilization roadmap.
- Assumption: the completed Morning Prayer repair remains the base publish boundary while Angelus becomes the next stabilization release.
- Unknown: the exact replacement TTS provider to be locked during Release 2 planning.
- Unknown: the final hosting boundary for RSS XML and media URLs.
- Unknown: the final artifact format for custom intention contracts published to OneDrive.

## Recommended Next Step
- Move the Angelus default/Easter-season resolver repair into `/plan-astack` first.
- It is the cleanest next boundary change, it reduces delivery risk, and it gives us a stable base before broader voice and feed work.
