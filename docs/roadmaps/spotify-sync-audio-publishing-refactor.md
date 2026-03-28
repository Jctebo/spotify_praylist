# Roadmap: Contract-Driven Spotify Sync And Morning Prayer Publishing Refactor

## Summary Of Changes
- Restore Spotify playlist automation as repo-owned contracts under `config/spotify/` instead of depending on the removed Notion config lists.
- Keep the slimmed-down Notion database as the content source, but move playlist identity, playlist IDs, and playlist assembly rules into git-managed contracts.
- Collapse the current multi-contract audio surface into one canonical Morning Prayer publishing path.
- Add a storage-backed publishing boundary so the daily Morning Prayer artifact can become a podcast episode instead of only a synced file tree.
- Make ElevenLabs the primary TTS engine for the Morning Prayer publishing path, with OpenAI retained only as a controlled fallback during migration.
- This roadmap exists now because Spotify sync is intentionally disabled, the current audio runtime is broader than the desired product, and the repo does not yet have a first-class podcast publishing subsystem.

## Roadmap Mode
- Detailed roadmap

## Problem
- Spotify playlist sync is a user-visible regression: the workflow is disabled and the current runtime still expects a separate Notion playlists configuration model the user no longer keeps.
- The repo's audio runtime still treats many prayer contracts as active daily outputs even though the desired product is now one publishable Morning Prayer program.
- The current prayer pipeline can render and sync audio files, but it does not yet turn that output into a storage-backed podcast publication flow.
- TTS is currently OpenAI-first across the codebase, which conflicts with the new requirement to make ElevenLabs the primary voice path.

## Audience
- Primary user: the maintainer running daily prayer automation and curating Spotify + Morning Prayer delivery.
- Secondary stakeholders: listeners consuming the Morning, Midday, and Night Spotify playlists.
- Secondary stakeholders: future collaborators who need a smaller, clearer runtime surface for prayer publishing work.

## Current Status Quo
- `.github/workflows/daily.yml` is present but disabled, so daily Spotify playlist refresh is not currently running.
- `scripts/run_daily_refresh_local.ps1` also exits early and does not invoke the Spotify refresh runtime.
- `jobs/playlist/refresh_playlist.py` still exists and still expects the current Notion-first queue plus a separate Notion playlists database, with legacy file-mode fallback.
- `config/spotify/` does not exist today.
- `jobs/notion/generate_page_audio.py` and `.github/workflows/daily_novena_prayer.yml` currently fan out across top-level `config/*.json` contracts and sync page-audio artifacts to OneDrive.
- `config/morning-prayer.json` is the active Morning Prayer contract, while `config/rosary.json` and other root-level contracts still represent the broader page-audio surface.
- `jobs/notion/generate_prayer.py` is nominally generic, but today it still hardcodes the Morning Prayer builder and Morning output folder.
- Repo inspection did not reveal an existing podcast RSS/feed publication path; current output delivery is storage sync plus Notion/page updates.
- Current TTS defaults in configs, jobs, tests, and `.env.example` are centered on `gpt-4o-mini-tts`.

## What Already Exists
- A durable Morning Prayer contract in `config/morning-prayer.json` with ordered resolvers, a stable key, and explicit page metadata.
- A broad page-audio engine in `jobs/notion/generate_page_audio.py` with caching, ordered output assembly, and storage sync support.
- A single-contract execution pattern already exists in both `PAGE_AUDIO_CONFIG_FILE` handling and `jobs/notion/generate_prayer.py`.
- A legacy but still useful Spotify refresh runtime exists in `jobs/playlist/refresh_playlist.py`, including resolver logic, playlist recreation, and queue-building helpers.
- Existing test coverage exists for the page-audio job, Morning Prayer runner, novena audio path, and Spotify refresh job.
- Existing setup scripts already capture Spotify credentials and playlist IDs, which can inform a contract migration path.
- Existing storage sync boundaries already exist for OneDrive via `rclone`, and GitHub Pages is already used elsewhere in the repo for public devotional assets.

## Sequencing Principles
- Restore Spotify sync first because it is already disabled and has the clearest user-visible regression.
- Move playlist truth into repo contracts before re-enabling automation, so the restored system matches the user's new source-of-truth model.
- Collapse audio to one Morning Prayer publishing path before launching a public podcast, so file naming, metadata, cache keys, and workflow ownership stabilize around one product.
- Move TTS to ElevenLabs before the public podcast launch, so the first public feed is built on the intended voice stack rather than an interim engine.
- Keep facts separate from inference during the refactor: repo contracts should define what the system intends to publish, while Notion should remain the slim content source rather than the contract registry.
- Prefer temporary fallback layers only where they reduce migration risk; avoid preserving two permanent control planes.

## Release Overview
- Release 1: Spotify Contract Sync Recovery
  Restore Morning, Midday, and Night Spotify playlist updates through repo-owned contracts and the slimmed-down Notion queue.
- Release 2: Morning Prayer Publishing Contract
  Replace the many-contract daily audio surface with one canonical Morning Prayer publishing path and a storage-ready artifact contract.
- Release 3: ElevenLabs-First Audio Rendering
  Make ElevenLabs the default synthesis engine for Morning Prayer publishing while preserving controlled fallback behavior.
- Release 4: Podcast Publication And Runtime Cleanup
  Publish Morning Prayer as a real podcast feed from storage and remove the deprecated audio contract surface from daily production.

## Release 1: Spotify Contract Sync Recovery

### Goal
- Restore daily Spotify playlist creation and updates for Morning, Midday, and Night using repo-owned contracts under `config/spotify/`.

### Scope
- In scope:
- Define a contract shape for playlist identity, playlist ID, ordering rules, and queue assembly inputs.
- Add repo-owned contracts for Morning, Midday, and Night.
- Update the Spotify refresh runtime to load playlist definitions from `config/spotify/` instead of requiring a separate Notion playlists database.
- Keep the slimmed-down Notion database as the source for queue items and resolver metadata.
- Re-enable the daily Spotify workflow and local runner once the contract path is ready.
- Add regression coverage for contract loading, single-playlist runs, and the three canonical playlists.
- Explicitly deferred:
- Podcast publishing.
- ElevenLabs migration.
- Deleting the legacy Spotify runtime before the contract path is proven.

### Why This Release Now
- The Spotify workflow is currently disabled, so there is no active sync path to preserve.
- This is the smallest release that restores a broken user-facing capability while aligning the source of truth with the user's new operating model.

### Research Notes
- `jobs/playlist/refresh_playlist.py` already contains resolver logic, playlist recreation, and Notion queue assembly.
- The current runtime still expects `NOTION_PLAYLISTS_DATABASE_ID` or a legacy file-mode config path.
- `config/spotify/` is absent today, so this release introduces a new contract boundary rather than extending an existing folder.
- `scripts/setup_spotify.ps1` already captures Morning, Midday, and Night playlist IDs, which can help seed the initial repo contracts or migration tooling.

### Plan
- Create a small contract schema and contract loader for Spotify playlists.
- Reuse the existing Notion queue reading path where possible, but stop treating Notion playlists rows as the definition of which playlists exist.
- Keep a short-lived compatibility path only if it materially reduces cutover risk.
- Re-enable automation only after contract validation and a dry-run or targeted single-playlist test path exist.

### Features
- Repo-owned Morning, Midday, and Night playlist contracts.
- Contract-driven playlist ID and playlist naming rules.
- Contract-driven queue assembly from the slimmed-down Notion source.
- Reactivated daily and local Spotify refresh entrypoints.

### Stories
- As the maintainer, I want Morning, Midday, and Night playlist definitions versioned in git, so I do not have to keep a separate Notion config list alive.
- As the maintainer, I want to rerun one playlist from its contract, so I can validate a fix without touching the other two playlists.
- As a listener, I want the right time-of-day playlist to refresh daily, so Spotify reflects the current prayer rhythm again.

### Dependencies
- Existing Spotify API credentials and refresh token.
- The slimmed-down Notion queue schema remaining rich enough to determine playlist membership and order.
- A decision on whether playlist IDs live directly in repo contracts or are injected at deploy time while contract keys remain stable.

### Risks
- The current Notion queue may still imply assumptions from the removed playlists database, which could force a thin compatibility adapter.
- Hardcoding too much playlist behavior into code instead of contracts would recreate the same maintenance problem in a different place.
- Re-enabling the workflow before contract validation could write the wrong queues into live Spotify playlists.

### Exit Criteria
- `config/spotify/` contains contracts for Morning, Midday, and Night.
- A local and CI path can update one selected playlist from its contract.
- The daily workflow is re-enabled and updates all three playlists without depending on the old Notion playlists database.

## Release 2: Morning Prayer Publishing Contract

### Goal
- Replace the current many-contract daily audio runtime with one canonical Morning Prayer publishing contract that produces a storage-ready daily artifact.

### Scope
- In scope:
- Define one Morning Prayer publishing contract that owns render metadata, output naming, storage destination intent, and publication metadata.
- Narrow the daily production workflow so it builds one Morning Prayer artifact instead of fanning out across the current contract matrix.
- Separate render concerns from publish concerns so the pipeline can produce a canonical audio file plus metadata package for storage.
- Keep Notion page updates only where they still support the Morning Prayer product.
- Treat the current non-Morning contracts as deprecated for daily production, while deciding whether any of them remain as manual-only tools.
- Explicitly deferred:
- Public podcast RSS launch.
- Final TTS-provider migration.
- Full deletion of deprecated contracts before the Morning Prayer publish path is stable.

### Why This Release Now
- The repo already has a working Morning Prayer contract and storage-oriented audio assembly path.
- Public podcast publication should not sit on top of a daily runtime that still thinks many unrelated contracts are first-class products.

### Research Notes
- `config/morning-prayer.json` is already the active Morning Prayer contract.
- `jobs/notion/generate_prayer.py` already demonstrates a Morning Prayer-first single-contract execution pattern, but it still hardcodes Morning Prayer internals.
- `.github/workflows/daily_novena_prayer.yml` currently discovers all top-level `config/*.json` files and syncs merged artifacts to OneDrive.
- Repo inspection did not show an existing podcast publishing subsystem, so this release should establish a clean publication artifact before feed generation.

### Plan
- Define a publish-ready artifact contract for one daily Morning Prayer output.
- Move the workflow boundary from "all configs are daily products" to "Morning Prayer is the daily published product."
- Keep deprecated contracts available only where they still serve migration, QA, or backfill value.
- Add tests around canonical artifact naming, metadata generation, and storage handoff.

### Features
- One Morning Prayer publishing contract.
- One canonical daily artifact package for Morning Prayer audio plus metadata.
- A narrowed workflow that publishes one daily Morning Prayer output to storage.
- Clear deprecation status for non-Morning daily audio contracts.

### Stories
- As the maintainer, I want one canonical Morning Prayer publish job, so I know exactly which output becomes the daily deliverable.
- As the maintainer, I want the daily artifact to land in storage with stable metadata, so later podcast publishing does not need to reverse-engineer filenames.
- As a collaborator, I want deprecated contracts called out clearly, so we stop treating old page-audio outputs as active daily products.

### Dependencies
- Release 1 is not a hard technical dependency, but both releases should agree on storage naming, workflow conventions, and contract patterns.
- A decision on whether OneDrive remains the first storage target or becomes a staging destination behind a more generic publisher boundary.

### Risks
- `jobs/notion/generate_page_audio.py` currently mixes generic page-audio logic with Morning Prayer-specific behavior, so narrowing the runtime may expose hidden coupling.
- If deprecated contracts remain half-active, the repo could still feel like it has two daily production surfaces.
- Overcoupling Notion page updates to publication could make the storage/podcast boundary harder to stabilize.

### Exit Criteria
- Daily production builds exactly one Morning Prayer artifact package.
- The artifact package is uploaded to storage with stable naming and metadata.
- The current contract matrix is no longer the active daily production path.

## Release 3: ElevenLabs-First Audio Rendering

### Goal
- Make ElevenLabs the primary TTS provider for Morning Prayer publishing while keeping OpenAI only as a managed fallback.

### Scope
- In scope:
- Introduce provider-aware TTS configuration for the Morning Prayer publishing path.
- Add an ElevenLabs adapter and provider-aware cache/render hashing.
- Move the Morning Prayer contract and publishing workflow to ElevenLabs-first defaults.
- Keep an explicit fallback path to OpenAI during rollout and quota incidents.
- Update tests, env docs, and operational configuration for the new provider.
- Explicitly deferred:
- Broad provider migration for unrelated jobs that no longer belong in the narrowed daily production path.
- Public podcast launch until render quality, cost, and operational behavior are stable.

### Why This Release Now
- The TTS provider affects audio character, cache identity, cost, and operational reliability.
- Moving providers before the public podcast launch avoids publishing a feed on one engine and then immediately changing the voice stack underneath listeners.

### Research Notes
- Current defaults in `jobs/notion/generate_page_audio.py`, `jobs/notion/generate_prayer.py`, `jobs/novena/generate_daily_novena_prayer.py`, `.env.example`, and many configs still point to `gpt-4o-mini-tts`.
- Existing tests already validate TTS settings, cache keys, and fragment rendering, which creates a good baseline for provider-aware coverage.
- The repo does not yet expose a provider abstraction; the current code assumes OpenAI-style model and voice settings.

### Plan
- Introduce a provider boundary rather than swapping string constants in place.
- Keep the first provider migration scoped to the Morning Prayer publishing path.
- Treat cache keys, render hashes, and failure modes as first-class migration work, not cleanup.
- Validate the new voice path before making it the only production route.

### Features
- ElevenLabs provider integration for Morning Prayer publishing.
- Provider-aware TTS settings and cache keys.
- OpenAI fallback for controlled failover.
- Updated tests and env documentation for provider selection.

### Stories
- As the maintainer, I want the Morning Prayer publishing contract to target an ElevenLabs voice, so the daily audio matches the intended voice quality.
- As the operator, I want a controlled fallback provider, so one outage or quota issue does not block daily publishing.
- As a listener, I want daily episodes to sound consistent once the public podcast launches.

### Dependencies
- Release 2's single Morning Prayer publishing contract.
- ElevenLabs credentials, selected voice IDs, and cost/usage limits.

### Risks
- Provider changes can invalidate caches and alter audio duration, which may affect metadata, upload timing, or downstream episode expectations.
- A weak fallback design could hide production regressions instead of surfacing them clearly.
- If Morning Prayer still relies on shared novena or fragment audio, those pieces must either migrate with it or stay compatible with the new provider boundary.

### Exit Criteria
- Morning Prayer publishing renders through ElevenLabs in the normal path.
- Cache keys and regression tests are provider-aware.
- The pipeline can fail over intentionally when ElevenLabs is unavailable.

## Release 4: Podcast Publication And Runtime Cleanup

### Goal
- Publish Morning Prayer as a storage-backed podcast and remove the deprecated daily audio contract surface from active production.

### Scope
- In scope:
- Build or integrate a podcast feed generation step that turns the Morning Prayer artifact package into a public RSS feed.
- Publish feed metadata and episode assets from a stable storage/public-hosting boundary.
- Decide which storage target is authoritative for public podcast delivery.
- Remove deprecated daily audio workflows and contract paths that no longer serve the Morning Prayer product.
- Update docs so the repo clearly describes the new Spotify sync surface and the new Morning Prayer podcast surface.
- Explicitly deferred:
- Re-expanding the daily production runtime to other prayer families.
- Broad redesign of unrelated devotional image infrastructure unless it becomes part of the chosen public hosting path.

### Why This Release Now
- Public podcast publishing should come after the artifact contract and TTS stack are stable.
- Cleanup belongs after the new path is proven, so the repo does not lose useful migration or rollback tools too early.

### Research Notes
- The repo currently consumes podcast/RSS feeds but does not yet generate one for publication.
- OneDrive sync exists for private or managed storage, while GitHub Pages is already used for some public devotional assets.
- It is still unknown which public hosting boundary is best for a podcast feed and audio enclosures; that decision should be validated during this release rather than assumed upfront.

### Plan
- Use the Morning Prayer artifact package as the sole input to feed generation.
- Choose one public publication boundary and document it clearly.
- Keep feed metadata stable enough that podcast clients and directories do not treat each rollout as a new show.
- Remove deprecated daily-runtime surfaces only after the podcast path is proven end to end.

### Features
- Public Morning Prayer podcast RSS generation.
- Storage-backed episode publishing.
- Stable show metadata and episode metadata.
- Removal or archival of deprecated daily audio contract workflows.

### Stories
- As a listener, I want to subscribe to Morning Prayer as a podcast, so each day's episode arrives through a normal podcast client.
- As the maintainer, I want the feed to publish from the same daily artifact package, so storage and podcast delivery stay in sync.
- As a collaborator, I want the deprecated audio contract surface removed from daily production, so the repo's active runtime matches the actual product.

### Dependencies
- Release 2's canonical Morning Prayer artifact package.
- Release 3's stable ElevenLabs-first render path.
- A validated public hosting strategy for RSS and media URLs.

### Risks
- A storage target that works for private sync may not be suitable for podcast clients, enclosure URLs, or long-term public hosting.
- Feed GUIDs, episode slugs, or metadata churn could create duplicate or broken podcast entries.
- Cleanup that happens too early could remove useful fallback tools before public publishing has baked long enough.

### Exit Criteria
- A public Morning Prayer RSS feed is generated from the daily artifact package.
- Podcast clients can fetch the feed and today's episode media URL successfully.
- Deprecated daily audio contract workflows are removed or explicitly archived.

## Cross-Cutting Risks
- Source-of-truth sprawl could return if playlist identity, Morning Prayer publish metadata, TTS settings, and storage metadata end up split across repo contracts, Notion, and ad hoc env vars.
- The current code still mixes generic page-audio behavior with Morning Prayer-specific logic, which raises migration risk in Releases 2 and 3.
- Storage choices that are fine for sync may not be safe or durable enough for public podcast hosting.
- Provider migration can change audio timing, caches, and operational cost in ways that ripple into publication.

## Assumptions And Unknowns
- Assumption: this roadmap should be detailed, because it is intended to guide a multi-step refactor rather than only rank ideas.
- Fact from the user request: the slimmed-down Notion source still exists, but the old config lists do not.
- Assumption: playlist identity and playlist IDs should move into repo-managed contracts under `config/spotify/`.
- Unknown: whether playlist IDs should be committed directly in contracts or injected by environment while contract keys remain stable.
- Unknown: whether OneDrive will stay as a staging/storage boundary, become the final publication host, or be replaced for public podcast delivery.
- Unknown: whether any non-Morning audio contracts should survive as manual-only tools after the daily production surface is narrowed.
- Unknown: whether Morning Prayer's daily artifact should continue embedding novena-related audio or treat that content differently in the podcast era.

## Recommended Next Step
- Move Release 1 into `/plan-astack` first.
- It is the clearest broken capability, it matches the user's stated priority order, and it creates the repo-owned contract pattern that the later Morning Prayer publishing work can reuse.
