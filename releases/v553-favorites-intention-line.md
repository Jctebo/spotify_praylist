# v553 — Favorites rows paint the Intention line — v539 fix-forward

- **Registry:** DevOps Board, ora-pro-nobis, row 1494 · version v553
- **Intake:** Goals Board task 1053 (Muse Jobs, goal 16)
- **Run level:** To Ship — production-defect fix-forward, same-day notice, no scope package
- **Base:** GitHub main 4aed9b866188985ae43c1c32e916101950959679 (the v550 ship tree)

## 1 · Scope

- **Direction:** John's field report, Ora Pro Nobis thread, 2026-11-20 09:58 CT, verbatim: "Intentionsn.dont show up in the favires" — the per-track Intention line does not show on Favorites rows.
- **Verified defect:** the Favorites row builder (`starredRowHtml`, `app/worker/src/client.ts`) carries NO intention paint — no trackDraws lookup, no "Intention: " line. Day rows paint it (podcast series rows at client.ts:6919, from `state.trackDraws`), `trackCard` paints it (client.ts:11047, via `trackDrawTextFor`), Now Playing paints it (client.ts:2309, 9803). v539's every-track coverage missed the Favorites surface; v547 moved the surface to the folder page on the same builder; v550 added the control cluster without the line.
- **Fix shape (the whole scope, fully determined by v539's standing rules):** the Favorites row paints the same "Intention: " line under the same rules — the track's own settled draw from the full active pool, and the Settings Intentions toggle governs showing. Nothing else changes.
- **Out of scope:** no migration · no server change · no reorder-mode row change · no other surface change · the v552 Favorites header change (separate release, stands at Backlog/Scope) is not touched.
- **Concerns and Information Needs:** none — the fix shape carries no design choice.

## 2 · Plan

- **Change (one seat, client.ts only):** in `starredRowHtml(e)`, resolve the row's descriptor through the standing `starredDescFor(e)` (already computed in the builder), read its settled draw through the standing `trackDrawTextFor(desc)` seam (the one `state.trackDraws` map, date-scoped to the presented date, keyed by the `playedKey` rule — the same key the day rows, the opened view, and Now Playing read), and, when the descriptor is available, a draw text stands, and `intentionsOn()` is true, emit `<div class="intention-text track-draw-line">Intention: …</div>` inside the row's `.grow`, after the title row and before the meta row — the standing row dress. An unavailable track carries no line (the trackCard rule). The reorder-mode builder (`favReorderRowHtml`) is untouched.
- **SW pin:** `ora-pro-nobis-v553-1` at Ship only; the build tree stands at v550-1.
- **Harness:** `app/tests/harness-v553.mjs` — statics (diff confined to client.ts + the harness; index.ts / ui.ts except the Ship pin / migrations byte- or state-identical; no new migration, last stands 0042) plus Chromium legs on the v550 mold: a starred podcast track with a settled draw paints "Intention: …"; a starred day track with a settled draw paints "Intention: …"; with the Settings Intentions toggle off, neither row paints the line; a starred track with no settled draw paints no line.
- **Fixtures (Improvement D):** the LIVE starred fixture `app/tests/fixtures-v550/starred-live.json` (production D1 starred_tracks read, 2026-11-20) and the standing live day fixture `app/tests/fixtures-v522/day-live-2026-11-17.json`, on the v550 harness's mold; the track-draws stub answers the standing pool text, as in the v539/v550 harnesses.
- **Ship:** merge release/v553 to main, push main (read-back "main pushed · remote in sync"), deploy from a clean checkout of the merged HEAD, What's New entry, registry flip Live, verify the served client carries the Favorites intention paint.
- **Concerns and Information Needs:** none.
