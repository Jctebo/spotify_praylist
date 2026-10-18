# Roadmap: Stabilization of Codebase

## Summary

This roadmap is closed. The stabilization work produced the repaired Morning Prayer publish path, seasonal Angelus and Regina Caeli routing, a midnight Central job window, and repository-owned Spotify playlist membership.

## Closure Status

- Closed as of 2026-04-26.
- No new releases should be added to this roadmap.
- Use this document only as historical context.

## Current Architecture Pointers

- `jobs/publish/` contains contract-driven local episode publishing.
- `jobs/novena/liturgical_helpers.py` contains shared Romcal helpers.
- Calendar ICS publishing has been retired.
- `jobs/playlist/refresh_playlist.py` and `config/spotify/` contain the Spotify refresh path.
- `docs/releases/RELEASE_LOG.md` is the release history.
