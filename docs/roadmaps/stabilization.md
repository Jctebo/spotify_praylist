# Roadmap: Stabilization of Codebase

## Summary Of Changes
- Release `0.1.3.2` shipped the novena/image decoupling work and moved the shared liturgical helper boundary.
- The devotional image failure was an OpenAI billing/key issue and was fixed operationally without a release, so it is no longer roadmap work.
- This roadmap now focuses on Morning Prayer OneDrive-first stability, then voice, RSS, and intention layers.
- Novena work has been moved into a separate audio roadmap so the stabilization track stays focused.

## Recent Completed Work
- `0.1.3.2` shipped on 2026-03-28 and decoupled devotional image generation from the novena helper surface.
- The image access issue was resolved outside the release train after the underlying billing/key problem was identified.
- The active roadmap no longer needs a separate image-recovery milestone.

## Roadmap Mode
- Detailed roadmap

## Problem
- Morning Prayer still needs a reliable OneDrive-first delivery path that can be trusted before any broader distribution changes.
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
- Stabilize the daily Morning Prayer path before adding new content or new delivery surfaces.
- Keep TTS migration separate from delivery fixes so voice changes do not hide output bugs.
- Add RSS only after the artifact, voice, and publish boundary are stable.
- Leave personal intention contracts until the base prayer outputs are reliable enough to personalize.

## Release Overview
- Release 1: Morning Prayer OneDrive-First Repair
- Release 2: TTS Provider Migration
- Release 3: RSS Publication Surface
- Release 4: Custom Intention Contracts

## Release 1: Morning Prayer OneDrive-First Repair

### Goal
- Fix Morning Prayer generation and prove it lands correctly in OneDrive before any broader publishing work.

### Scope
- In scope:
- Repair Morning Prayer generation, assembly, or contract issues that currently block the desired daily output.
- Keep OneDrive as the first publish boundary for Morning Prayer artifacts.
- Validate artifact contents before blaming OneDrive sync when something is missing or malformed.
- Keep fail-closed behavior so broken generation does not silently publish partial outputs.
- Decide the single active daily Morning Prayer path the repo should trust while the legacy matrix remains discontinued.
- Explicitly deferred:
- RSS feed generation.
- Broad public-hosting decisions beyond the OneDrive-first boundary.
- TTS-provider migration until the current Morning Prayer path is stable.

### Why This Release Now
- The user wants Morning Prayer fixed before the TTS switch and before RSS.
- The repo already has OneDrive-oriented artifact patterns, so this is the natural place to stabilize Morning Prayer delivery first.

### Research Notes
- `jobs/notion/generate_page_audio.py` still owns Morning Prayer assembly behavior and exports against the playlist-audio OneDrive root.
- `docs/releases/0.1.3.0-prayer-output-divergence.md` documents the recent "artifact first, OneDrive second" debugging lesson.
- `.github/workflows/daily_novena_prayer.yml` is disabled, so the roadmap should assume Morning Prayer needs one clear supported execution path rather than the old legacy matrix.

### Plan
- Establish the single Morning Prayer generation path the team wants to keep.
- Validate generated artifacts locally or in CI before treating sync as the root cause.
- Keep OneDrive as the first trusted destination once artifact integrity is proven.
- Delay broader publishing work until the OneDrive boundary is reliable again.

### Features
- Stable Morning Prayer daily artifact generation.
- OneDrive-first Morning Prayer publish boundary.
- Clear validation flow that distinguishes generation failures from sync failures.

### Stories
- As the maintainer, I want Morning Prayer fixed and landing in OneDrive first, so I can trust the daily output before adding more distribution layers.
- As an operator, I want artifact-level validation before sync, so debugging does not get stuck on the wrong boundary.

### Dependencies
- A working current OpenAI auth path while Morning Prayer is still on the existing TTS stack.
- The shipped OneDrive artifact fan-in and sync patterns already documented in earlier release artifacts.

### Risks
- Morning Prayer still sits inside a broader page-audio runtime, so hidden coupling may surface when narrowing or stabilizing its path.
- If the repo keeps multiple half-active Morning Prayer entrypoints, operators may still be unsure which path is authoritative.
- Sync debugging can waste time if artifact integrity is not proven first.

### Exit Criteria
- Morning Prayer can be generated through one clear supported path.
- The generated artifact is validated before sync.
- OneDrive receives the expected Morning Prayer output from that validated artifact path.

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
- Release 1's stable Morning Prayer artifact and OneDrive boundary.
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
- Reuse the stabilized Morning Prayer artifact package from Releases 1 and 2.
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
- Release 1's stable Morning Prayer artifact.
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
- Stable OneDrive publishing conventions from Release 1.
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
- Fact: `jobs/notion/generate_page_audio.py` still uses the playlist-audio OneDrive library boundary and still assumes OpenAI on the current TTS path.
- Fact: the repo has RSS ingestion behavior, but no confirmed Morning Prayer RSS publication path yet.
- Fact: novena-specific roadmap work now lives on a separate audio roadmap instead of this stabilization roadmap.
- Assumption: OneDrive should remain the first publish boundary for Morning Prayer before RSS is added.
- Unknown: the exact replacement TTS provider to be locked during Release 2 planning.
- Unknown: the final hosting boundary for RSS XML and media URLs.
- Unknown: the final artifact format for custom intention contracts published to OneDrive.

## Recommended Next Step
- Move Release 1 into `/plan-astack` first.
- It is the cleanest boundary change, it reduces delivery risk, and it gives us a stable base before reattaching novena generation.
