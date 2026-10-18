# Local Episode Contracts

## Contract format

`config/publish/contracts/<contract-id>.json` is the source for contract metadata, entries, blocks, audio configuration, and local `episode_state`. The contract's authored `entry_id`, `date`, `title`, `blocks`, and `audio_config` drive generation. Episode state records the latest text/hash and audio URL/path/content hash produced by the local pipeline.

## File layout

- Contract definitions and per-entry state: `config/publish/contracts/*.json`.
- Generated text/audio and episode sidecars: existing `docs/` paths and sidecar formats.
- Podcast feed: `docs/podcast.xml`, generated from local audio artifacts.
- Runtime completion and episode state: `.cache/publish_state/state.json`, persisted by the pipeline and cached by GitHub Actions. It records a schema version, local reset date, completion flags keyed by contract and entry, and episode records keyed by episode ID.

## Reuse boundary

The publish pipeline reuses the novena contract validators, resolver, artifact writer, and RSS helpers where their inputs match. Publish entries retain `jobs/publish/contracts.py` block normalization and generation because these include daily intros, Rosary, and reflection-specific blocks. Shared RSS and audio artifact writers remain the source of output behavior.

## Migration status

Publish contracts and pipeline state are repository-owned. Text and audio jobs no longer read or write external database records. The local state file replaces daily completion resets and preserves same-day manual changes while resetting completion flags on a new local date.
