# Roadmap: Stabilization of Codebase

## Summary Of Changes
- This roadmap is now closed.
- The stabilization work produced the repaired Morning Prayer publish path, the calendar/devotional decoupling work, the Angelus and Regina Caeli seasonal resolver, the midnight job window, and Notion-owned Spotify playlist membership.
- Remaining future-facing work has moved out of stabilization and into `docs/roadmaps/publish-content.md`.
- The old novena audio roadmap has been deleted because novena now belongs inside the broader publish-content roadmap instead of living as a separate audio-only track.

## Roadmap Mode
- Detailed roadmap

## Closure Status
- Closed as of 2026-04-26.
- No new releases should be added to this stabilization roadmap.
- Use this document as historical context only.

## Completed Outcomes
- Morning Prayer was narrowed to the active custom TTS contract path under `config/custom_tts/morning-prayer.json`.
- Morning Prayer output ownership moved into the contract-owned publish folder.
- The devotional image path and novena helper path were decoupled through the shared liturgical helper boundary.
- Angelus now defaults outside Easter season and switches to Regina Caeli during Easter season.
- Scheduled jobs moved into the midnight-ish Central time window.
- Spotify playlist refreshes now use repo-owned contracts plus Notion-owned membership and ordering.

## What Already Exists
- `config/custom_tts/morning-prayer.json` is the active Morning Prayer custom TTS contract.
- `jobs/notion/generate_page_audio.py` is the active page-audio generation surface.
- `jobs/novena/liturgical_helpers.py` provides the shared liturgical helper boundary.
- `jobs/novena/sync_liturgical_calendar.py` and `.github/workflows/liturgical_calendar_yearly_sync.yml` populate the Liturgical Calendar data.
- `jobs/playlist/refresh_playlist.py` and `config/spotify/contracts/*.json` own the active Spotify playlist refresh path.
- `docs/releases/RELEASE_LOG.md` is the canonical shipped-release history.

## Work Moved Elsewhere
- Repeated daily prayer contracts moved to `docs/roadmaps/publish-content.md`.
- Novena contracts, liturgical calendar alignment, and automatic scheduling moved to `docs/roadmaps/publish-content.md`.
- Notion text output, storage publication, RSS feeds, podcast setup, and podcast resolvers moved to `docs/roadmaps/publish-content.md`.

## Cross-Cutting Risks Retired Or Moved
- Retired: uncertainty about whether Morning Prayer has a stable active contract path.
- Retired: uncertainty about whether Angelus and Regina Caeli seasonal routing belongs in stabilization.
- Moved: public content publishing risks now belong to the publish-content roadmap.
- Moved: podcast feed identity and resolver expansion risks now belong to the publish-content roadmap.

## Recommended Next Step
- Plan Release 1 of `docs/roadmaps/publish-content.md` with `/plan-astack`.
