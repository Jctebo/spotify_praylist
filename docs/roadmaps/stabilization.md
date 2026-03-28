# Roadmap: Stabilization of Codebase

## Recent Releases
- `0.1.3.1`: Spotify contract sync recovery shipped on 2026-03-27 and moved the active Spotify refresh path onto repo-owned contracts and playlist definitions.

## Roadmap Mode
- Detailed roadmap

## Problem
- The devotional image and novena generation paths are still co-located in code and in the same workflow job, which makes one failure more likely to drag the other down.
- The shared logic between those jobs should live in helpers, while the runnable entrypoints should be independent.
- The pipelines should be split so image generation and novena generation can be scheduled, retried, and reasoned about separately.
- The original first roadmap milestone is no longer future work; Spotify contract sync has already shipped.
- The next broken daily capability is the devotional image pipeline, which still depends on a working `OPENAI_API_KEY` secret in GitHub Actions.
- Morning Prayer still needs a stable OneDrive-first delivery path before it is safe to widen the surface to a new TTS provider or RSS publication.
- The repo has intention-related helpers and Morning/Midday/Night/Sunday playlist surfaces, but it does not yet have custom intention contracts that turn personal intentions from Notion into OneDrive-published outputs.

## Audience
- Primary user: the maintainer operating the daily prayer, image, and publishing automations.
- Secondary stakeholders: listeners and downstream consumers who depend on Spotify playlists, Morning Prayer outputs, and future RSS delivery being stable.
- Secondary stakeholders: future collaborators who need one clear release order instead of overlapping "fix, migrate, publish, personalize" tracks.

## Current Status Quo
- Release `0.1.3.1` shipped on 2026-03-27 and restored the contract-first Spotify refresh path under `config/spotify/contracts/` and `config/spotify/playlists/`.
- `.github/workflows/daily_devotional_image_remote.yml` currently uses `OPENAI_API_KEY` for both devotional image generation and the daily novena step before syncing outputs to OneDrive.
- `.github/workflows/daily_novena_prayer.yml` is intentionally disabled, and the legacy page-audio contract matrix is archived under `config/legacy/page_audio/`.
- `jobs/notion/generate_page_audio.py` still contains the active Morning Prayer assembly logic and defaults its library root to `OneDrive\Praylist Audio\Playlist Audio`.
- Current TTS defaults across page-audio and novena paths are still OpenAI-first.
- The repo can consume RSS-backed sources through builders such as `rss_audio_v1`, but repo inspection did not show an existing Morning Prayer RSS publishing path.
- Intention handling exists today in two partial forms:
- random/monthly intention fragment support inside `jobs/notion/generate_page_audio.py`
- Notion petition distribution helpers inside `jobs/playlist/refresh_playlist.py`
- There is not yet a release-shaped contract system for custom Morning, Midday, Night, and Sunday intention publishing to OneDrive.

## What Already Exists
- A shipped Spotify contract model with explicit queue contracts and thin playlist definitions.
- A working devotional image workflow with OneDrive and GitHub Pages delivery boundaries, provided OpenAI authentication succeeds.
- Morning Prayer assembly and export logic in `jobs/notion/generate_page_audio.py`, plus prior shipped work that moved artifact sync to a single OneDrive boundary.
- Existing OneDrive setup and upload patterns in local scripts and GitHub workflows.
- Existing OpenAI-backed TTS settings, cache behavior, and tests that can anchor a provider migration.
- Existing RSS ingestion patterns that can inform later RSS publication work.
- Existing intention primitives:
- `random-intention` and `monthly_intention` fragment support in the page-audio runtime
- `distribute_prayer_intentions(...)` in the Spotify runtime as a useful Notion-selection reference

## Sequencing Principles
- Decouple first so the image and novena jobs no longer share a single pipeline failure domain.
- Move shared logic into reusable helpers, but keep each job entrypoint and pipeline independent.
- Keep shipped work shipped: the completed Spotify sync milestone stays visible in `Recent Releases`, not as a future milestone.
- Unblock broken daily jobs before adding new delivery surfaces.
- Treat the OpenAI image failure as an operational recovery first and only widen into code/debug work if a fresh credential does not restore execution.
- Fix Morning Prayer with artifact integrity first and OneDrive sync second so later TTS and RSS work build on a proven delivery boundary.
- Do not switch TTS providers while Morning Prayer delivery is still unstable; otherwise provider changes could mask underlying pipeline bugs.
- Add RSS only after the base Morning Prayer artifact and voice stack are stable enough to publish externally.
- Add custom intention contracts last, because personalization should target stable distribution surfaces instead of becoming part of the core recovery path.

## Release Overview
- Release 1: Novena And Image Decoupling
  Split the devotional image and novena paths into separate pipelines and push any reusable logic into shared helpers.
- Release 2: Devotional Image OpenAI Key Recovery
  Restore the image workflow by fixing the OpenAI auth boundary so image jobs begin running again.
- Release 3: Morning Prayer OneDrive-First Repair
  Repair Morning Prayer generation and keep OneDrive as the first stable publish boundary.
- Release 4: TTS Provider Migration
  Switch Morning Prayer off the current OpenAI-first TTS path onto the next chosen provider once delivery is stable.
- Release 5: RSS Publication Surface
  Publish Morning Prayer through an RSS feed backed by the stabilized artifact and voice pipeline.
- Release 6: Custom Intention Contracts
  Add Morning, Midday, Night, and Sunday intention contracts that source personal intentions from Notion and publish them to OneDrive.

## Release 1: Novena And Image Decoupling

### Goal
- Split the devotional image and daily novena jobs into separate pipelines so they can fail, retry, and ship independently.

### Scope
- In scope:
- Move any reusable code between the image and novena jobs into shared helpers.
- Remove pipeline-level coupling so devotional image generation does not depend on the novena job running in the same workflow.
- Create two distinct pipeline entrypoints or workflow paths, one for devotional images and one for daily novena generation.
- Keep the existing shared liturgical and helper logic available to both jobs.
- Explicitly deferred:
- Fixing the OpenAI secret boundary for image generation.
- Morning Prayer publishing changes.
- TTS-provider migration.

### Why This Release Now
- The two jobs currently share the same workflow job and several of the same inputs, so one failure can take down both outputs.
- Decoupling reduces blast radius before we spend effort on secret rotation or pipeline fixes.

### Research Notes
- `jobs/novena/generate_devotional_image.py` imports shared constants and helpers from `jobs/novena/generate_daily_novena_prayer.py`.
- `.github/workflows/daily_devotional_image_remote.yml` currently runs devotional image generation and novena generation in the same `calendar` job.
- The local wrappers also mirror the image job directly rather than exposing a separate novena/image split for operators.

### Plan
- Extract truly shared helper code into a common module where it can be imported by both jobs.
- Create separate workflow jobs or workflow files so the image pipeline and novena pipeline can run independently.
- Keep the behavior of each job the same at first, then tighten the boundaries once the split is stable.

### Features
- Shared helper modules for common liturgical or Notion logic.
- Independent devotional image pipeline.
- Independent daily novena pipeline.

### Stories
- As the maintainer, I want image and novena jobs to be separate, so a failure in one does not block the other.
- As the operator, I want reusable code in shared helpers, so common logic is maintained once instead of copied across jobs.

### Dependencies
- The existing shared liturgical model and Notion helper code.
- Workflow restructuring in GitHub Actions.

### Risks
- Over-sharing helpers could create a new shared-core bottleneck if we move too much logic together.
- Splitting the workflows without cleaning up shared assumptions could create duplicate environment setup or drift.
- If helper extraction is too aggressive, we could blur the boundaries again instead of clarifying them.

### Exit Criteria
- The image pipeline and novena pipeline can run independently.
- Shared logic lives in helper modules, not duplicated directly in the two job entrypoints.
- A failure in one pipeline no longer requires the other pipeline to run in the same job.

## Release 2: Devotional Image OpenAI Key Recovery

### Goal
- Get the devotional image workflow running again by restoring the OpenAI credential boundary used by the image and novena steps.

### Scope
- In scope:
- Validate the current GitHub Actions `OPENAI_API_KEY` secret path used by `.github/workflows/daily_devotional_image_remote.yml`.
- Rotate or replace the OpenAI key if the current secret is stale, revoked, or otherwise unusable.
- Run one manual workflow dispatch to confirm image generation begins successfully again.
- Confirm whether the same fix also restores the novena step that runs in the same workflow.
- Add minimal operational notes or validation guidance if needed to keep the secret boundary understandable.
- Explicitly deferred:
- TTS-provider changes.
- Morning Prayer publishing redesign.
- RSS publication.

### Why This Release Now
- It is the next broken daily capability after the shipped Spotify recovery.
- The user explicitly called this out as the first remaining roadmap item and believes it is likely a small key rotation.

### Research Notes
- `.github/workflows/daily_devotional_image_remote.yml` passes `OPENAI_API_KEY` into both `python jobs/novena/generate_devotional_image.py` and `python jobs/novena/generate_daily_novena_prayer.py`.
- The workflow already has a working OneDrive sync and Pages publish path once generation succeeds.
- Repo inspection supports the operational diagnosis that OpenAI auth is on the hot path, but does not by itself prove the failure is only a stale key.

### Plan
- Start with the smallest likely fix: validate or rotate the GitHub secret.
- Re-run the workflow manually after the secret update.
- If a fresh key still fails, widen the release into a focused auth/model/quota investigation instead of assuming the roadmap item is done.

### Features
- Restored OpenAI credential path for devotional image generation.
- Manual workflow verification after credential update.
- Clear separation between "secret problem" and "code problem" in operator guidance.

### Stories
- As the maintainer, I want image jobs to start again after updating the OpenAI secret, so the devotional pipeline resumes without a larger refactor.
- As the operator, I want to know whether the failure is only a stale key or something deeper, so I can scope the next action correctly.

### Dependencies
- GitHub Actions secret access for `OPENAI_API_KEY`.
- A valid OpenAI project/account with access to the configured image and prompt models.

### Risks
- The failure may not be only a secret rotation issue; quota, billing, or model-access changes could look similar.
- The same secret is used by both image and novena steps in the workflow, so a partial fix may still leave one stage failing.
- A purely operational fix can drift again later if secret ownership and rotation expectations stay undocumented.

### Exit Criteria
- A manual or scheduled run of `.github/workflows/daily_devotional_image_remote.yml` reaches image generation successfully with a valid OpenAI secret.
- The workflow no longer fails at startup because of the OpenAI credential boundary.
- The maintainer has evidence showing whether the novena step also recovered or still needs separate follow-up.

## Release 3: Morning Prayer OneDrive-First Repair

### Goal
- Fix Morning Prayer generation and prove it lands correctly in OneDrive before taking on RSS publishing.

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

## Release 4: TTS Provider Migration

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
- The user wants this after Morning Prayer is fixed, which is the right order because pipeline and delivery bugs should be isolated before the voice stack changes.

### Research Notes
- Current defaults across page-audio and novena paths remain OpenAI-first.
- The prior roadmap assumed ElevenLabs as the next provider, but the current user request only says "switch TTS providers."
- Existing tests and configs already give this release a concrete migration surface even before the final provider is locked.

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
- Release 2's stable Morning Prayer generation and OneDrive delivery path.
- Credentials and operational limits for the selected replacement TTS provider.

### Risks
- The replacement provider has not yet been explicitly locked in this revised roadmap.
- Voice changes can alter duration, cache keys, and downstream publishing assumptions.
- A weak fallback strategy could hide regressions instead of surfacing them clearly.

### Exit Criteria
- Morning Prayer renders through the chosen non-default provider in the normal path.
- Cache behavior and tests are provider-aware.
- Operators can deliberately validate fallback or rollback behavior if needed.

## Release 5: RSS Publication Surface

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
- The user wants RSS after the TTS-provider switch.
- RSS is safer once the artifact contract and voice stack are already stable enough to publish outside OneDrive-only workflows.

### Research Notes
- The repo has RSS ingestion builders but repo inspection did not show an existing Morning Prayer RSS publication path.
- OneDrive and GitHub Pages both already exist in the repo as delivery mechanisms, but neither is yet declared the canonical RSS publication host.

### Plan
- Reuse the stabilized Morning Prayer artifact package from Releases 3 and 4.
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
- Release 2's stable Morning Prayer artifact.
- Release 3's stable TTS-provider path.
- A validated public-hosting decision for RSS and media URLs.

### Risks
- The repo still needs to choose which hosting surface should be authoritative for RSS and audio enclosures.
- Metadata churn could create duplicate or broken podcast entries.
- Publishing too early could expose a feed before the underlying artifact contract is stable enough for outside consumption.

### Exit Criteria
- A valid Morning Prayer RSS feed is generated from the stabilized artifact path.
- Feed metadata and enclosure URLs are stable and fetchable.
- The team has one declared publication boundary for the feed.

## Release 6: Custom Intention Contracts

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
- The user wants this after RSS.
- Personalization is more valuable once the base delivery surfaces are already stable; otherwise it adds data-shape and privacy complexity to the core recovery work.

### Research Notes
- `jobs/notion/generate_page_audio.py` already contains `random-intention` and `monthly_intention` concepts that may be reusable.
- `jobs/playlist/refresh_playlist.py` already has `distribute_prayer_intentions(...)`, which is not the target release shape but does show an existing Notion-selection pattern.
- There is not yet a contract-first OneDrive publishing layer for custom Morning/Midday/Night/Sunday intention outputs.

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
- Stable OneDrive publishing conventions from Release 2.
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
- Operational credential issues could affect both devotional and Morning Prayer paths while OpenAI remains on the hot path before the TTS migration ships.
- The repo still contains legacy and current workflow surfaces, so unclear ownership of "the real path" could slow Releases 3 through 5.
- OneDrive is already a strong sync boundary, but it may or may not be the right final public-hosting boundary for RSS.
- Source-of-truth sprawl could return if contracts, Notion properties, workflow secrets, and publish metadata are split across too many places without one clear owner per concern.
- Personal-intention publishing adds privacy sensitivity that the earlier infrastructure releases do not have.

## Assumptions And Unknowns
- Fact: Release 1 shipped in `0.1.3.1` on 2026-03-27, but the roadmap now introduces a new Release 1 for novena/image decoupling.
- Fact: `.github/workflows/daily_devotional_image_remote.yml` uses `OPENAI_API_KEY` for both devotional image generation and daily novena generation.
- Fact: `.github/workflows/daily_novena_prayer.yml` is intentionally disabled.
- Fact: `jobs/notion/generate_page_audio.py` still uses the playlist-audio OneDrive library boundary and still assumes OpenAI on the current TTS path.
- Fact: the repo has RSS ingestion behavior, but no confirmed Morning Prayer RSS publication path yet.
- Assumption: the immediate devotional image failure is likely recoverable through OpenAI key rotation or replacement rather than a deeper code change.
- Assumption: OneDrive should remain the first publish boundary for Morning Prayer before RSS is added.
- Unknown: the exact replacement TTS provider to be locked during Release 4 planning.
- Unknown: the final hosting boundary for RSS XML and media URLs.
- Unknown: the final artifact format for custom intention contracts published to OneDrive.

## Recommended Next Step
- Move Release 1 into `/plan-astack` first.
- It is the cleanest boundary change, it reduces pipeline blast radius, and it will make the later image secret recovery easier to validate in isolation.
