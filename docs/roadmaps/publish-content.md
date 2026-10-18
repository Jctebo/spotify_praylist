# Roadmap: Publish Content

## Status

This roadmap is archived. The publishing architecture is now implemented around repository-owned contracts and local episode state.

## Current System

- `config/publish/contracts/*.json` defines episode identity, content, schedules, and audio settings.
- `jobs/publish/run_text_pipeline.py` renders episode text and updates local state.
- `jobs/publish/run_audio_pipeline.py` produces audio artifacts, sidecars, archive indexes, and the podcast RSS feed.
- `jobs/novena_contracts/` provides contract-driven novena generation and RSS publishing.
- `docs/architecture/local-episode-contracts.md` documents the local state format and pipeline boundaries.

## Preserved Publishing Behavior

The current pipeline retains podcast titles, descriptions, audio branding, RSS output, and scheduled publishing behavior. Spotify playlist refresh remains a separate workflow driven by checked-in queue contracts. GitHub Pages now serves a coming-soon landing page plus the podcast RSS feed and cover art; prayer-site, calendar, and devotional image publishing have been retired.
