# refresh_playlist.py Architecture

This document explains how `jobs/playlist/refresh_playlist.py` builds each playlist run from `config/playlist_config.json`.

If Mermaid still does not render in your editor, open Markdown preview (not raw editor) and ensure Mermaid support is enabled in your IDE.

## High-Level Flow

```mermaid
flowchart TD
    A[Start main] --> B[Load config/playlist_config.json]
    B --> C[Read profile from SPOTIFY_PLAYLIST_PROFILE]
    C --> D[Resolve playlist_id]
    D --> E[Create Spotify client from refresh token]
    E --> F[Build queue from profile.order]
    F --> G[Replace playlist items with resolved URIs]
    G --> H[Append overflow batches if needed]
    H --> I[Print summary and exit]
```

## Runtime Sequence

```mermaid
sequenceDiagram
    participant Runner as scripts/run_daily_refresh_local.ps1 / GitHub Action
    participant Script as jobs/playlist/refresh_playlist.py
    participant Config as config/playlist_config.json
    participant Spotify as Spotify API

    Runner->>Script: Execute with env vars
    Script->>Config: load_playlist_config()
    Script->>Spotify: refresh_access_token()
    loop for each key in profile.order
        Script->>Script: resolve_item_uri(key)
        Script->>Spotify: show_episodes()/next() as needed
        Script->>Script: choose URI or None
    end
    Script->>Spotify: PUT /playlists/{id}/items (first 100)
    Script->>Spotify: POST /playlists/{id}/items (remaining chunks)
    Script-->>Runner: SUMMARY + INFO logs
```

## Config Dependency Model

```mermaid
flowchart LR
    CFG[config/playlist_config.json]
    SHOWS[shows]
    FIXED[fixed]
    TOKENS[tokens]
    CATALOG[catalog]
    PROFILES[profiles]
    ORDER[profiles.profile_name.order]

    CFG --> SHOWS
    CFG --> FIXED
    CFG --> TOKENS
    CFG --> CATALOG
    CFG --> PROFILES
    PROFILES --> ORDER
    ORDER --> CATALOG
    CATALOG --> SHOWS
    CATALOG --> FIXED
    CATALOG --> TOKENS
```

## Resolver Dispatch (`resolve_item_uri`)

Each key in `profiles.<profile>.order` is dispatched by `resolve_item_uri(...)`.

```mermaid
flowchart TD
    K[Key from profile.order] --> R{Key type}
    R -->|Fixed item| F[Return URI from fixed map]
    R -->|Dynamic item| D[Run resolver logic]
    R -->|Sunday-only key| S{weekday == Sunday}
    S -->|No| N[Return None]
    S -->|Yes| E[Resolve latest/first episode]
    R -->|Friday stations| FR{weekday == Friday}
    FR -->|No| FN[Return None]
    FR -->|Yes| FU[Return fixed.FRIDAY_STATIONS URI]
```

Common dynamic resolvers:
- `latest_by_release_date(show_id)` for latest episode style feeds.
- `first_episode(show_id)` for newest item in show feed.
- `do_date_aware(show_id, terms)` for date-aware Divine Office picks.
- `sth_match_today(show_id, terms)` for STH date-prefix matches.
- `bible_in_a_year_for_today(show_id, status)` for Day N + newest year logic.

## BIAY Selection Logic

```mermaid
flowchart TD
    A[Compute day-of-year N capped to 365] --> B[Pattern: Day N]
    B --> C[Loop markets: US, null, GB, CA, AU]
    C --> D[Page through BIAY episodes with offsets]
    D --> E{Episode name matches Day N?}
    E -->|No| D
    E -->|Yes| F[Extract year from title or release_date]
    F --> G[Build key: year + release_date]
    G --> H[Track best max key]
    H --> D
    D --> I[After scan, return best URI]
```

## Error Handling and Retries

- API calls go through `safe_call(...)`.
- `safe_call` retries on:
  - `429` (honors `Retry-After`)
  - `500/502/503/504` with backoff
- Unrecoverable failures return `None`, and resolvers gracefully skip unresolved keys.
- Script exits non-zero on critical failures (missing config/env/auth/no items resolved).

## Output Contract

On success:
- `SUMMARY playlist_id=<id> tracks_written=<n>`
- `INFO profile=<name> weekday=<day> playlist_recreated=true`
- Optional BIAY debug:
  - `INFO biay_day=<n> selected=<episode title>`

On failure:
- `ERROR ...` on stderr
- exit code `1`
