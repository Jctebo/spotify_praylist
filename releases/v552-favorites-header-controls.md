# v552 — Favorites page: Play all to the header bar · Add all to queue to the top overflow

- **Registry:** DevOps Board, ora-pro-nobis, row 1493 · version v552
- **Intake:** Goals Board task 1054 (Muse Jobs, goal 16)
- **Run level:** To Ship — approved by John, Ora Pro Nobis thread, 2026-11-20 11:57 CT (scope package 53: Q1 A · Q2 A · Q3 A · Q4 A · Q5 A). Streamlined small-release path (Scope+Plan one pass · Implement · light Review · Ship).
- **Base:** GitHub main 5d7e31bb183ceb7eb99878362ef10b2500d087e1 (the v554 ship tree)

## 1 · Scope

- **Direction:** John, main chat, 2026-11-20 09:55 CT, with his screenshot of the Favorites page, verbatim: "Move play all button to the header like other lists and add all to the queue in the overflow menu at the top".
- **Approved shape (package 53, all A's — build exactly these):**
  - **Q1 A:** Play all takes the block pages' form — the round ▶ disc (.playbtn.small) alone in the header bar's right slot.
  - **Q2 A:** "Add all to queue" stands in the universal header menu's Favorites group, ABOVE Reorder.
  - **Q3 A:** Reorder keeps its v550 seat in the same group, unchanged.
  - **Q4 A:** the Play all disc stands only when the Favorites list holds a track (empty list = no disc).
  - **Q5 A:** run level To Ship, streamlined small-release path.
- **Verified current state (GitHub main 5d7e31b, app/worker/src/client.ts):** `paintFavoritesPage` paints the bar (`hdrBarHtml`, dest Pray, title Favorites) with NO right slot, then — non-empty list only — an in-page acts row: `#starred-playall` "Play all" + `#starred-addall` "Add all to queue" (btn ghost small), wired by id to `starredPlayAll` / `starredAddAll`. Its top overflow is the universal header menu (`openHeaderMenu`), whose Favorites page group holds the head "Favorites" + v550's Reorder item (stands outside reorder mode, list length ≥ 2).
- **The model (block pages):** the bar stands back · title · rightHtml `'<button class="playbtn small" data-queue="<block>" aria-label="Play all of <label>">▶</button>'`, and the page's acts stand in the universal menu's page group.
- **The change (the whole scope):** two seat moves only. Both acts keep their exact behavior — `starredPlayAll` (the whole list plays in list order, 'starred' queue provenance) and `starredAddAll` (the whole list joins the standing queue) stand byte-identical. The in-page acts row retires whole. No data change, no migration.
- **Out of scope:** the reorder-mode paint (bar reads Reorder, Done at its right) unchanged · the v550 row controls unchanged · the v553 Intention line on Favorites rows unchanged · no other page's bar or menu changes.
- **Concerns and Information Needs:** none.

## 2 · Plan

- **Change (one seat, app/worker/src/client.ts only):**
  1. `paintFavoritesPage`: the bar gains its right slot in the block pages' form — when the list is non-empty, `rightHtml: '<button class="playbtn small" id="starred-playall" aria-label="Play all of Favorites">&#9654;</button>'`; when the list is empty, no rightHtml and no disc (Q4 A). The disc carries the standing `starred-playall` id — the page's standing wiring (`getElementById('starred-playall')` → `starredPlayAll`) finds it in the bar host unchanged; it carries NO `data-queue` (that key belongs to the block pages' day-descriptor wiring, which never runs on this page). The in-page acts row is deleted whole, and the retired `#starred-addall` id wiring goes with it (the act's new seat wires it in the menu item).
  2. `openHeaderMenu`, the Favorites page group: directly under the "Favorites" head, `if (!favReorder && favoritesList().length) items.push({ label: 'Add all to queue', act: function () { starredAddAll(); } });` — ABOVE the standing Reorder push, which is not edited (Q2 A · Q3 A). The item stands only outside reorder mode and only while the list holds a track (the no-dead-items rule, the Reorder item's own discipline).
- **SW pin:** `ora-pro-nobis-v552-1` at Ship only; the build tree stands at v553-1.
- **Harness:** `app/tests/harness-v552.mjs` — statics (diff against the base confined to client.ts + this document + the harness · index.ts byte-identical · ui.ts byte-identical on the build tree · migrations end at 0042 · `starredPlayAll`/`starredAddAll`/`starredRowHtml`/`favReorderRowHtml` byte-identical · the Reorder push unedited) plus Chromium legs on the v550/v553 mold: the bar carries the ▶ disc in its right slot on a non-empty list and the in-page row is gone · a disc tap runs Play all (the list's playable descriptors in list order, queueFrom 'starred') · the header menu's Favorites group reads Add all to queue above Reorder · the Add all item runs Add all (the list joins the queue, nothing starts) · Reorder still enters reorder mode from the same menu · an empty list paints no disc and the menu group carries neither item.
- **Fixtures (Improvement D):** the standing production fixtures — `app/tests/fixtures-v550/starred-live.json` (the LIVE starred read, production D1, 2026-11-20) and `app/tests/fixtures-v522/day-live-2026-11-17.json` (the live day payload; the harness seats minimal track records under the production episode ids, the v542/v547/v550/v553 mold).
- **Ship:** rebase onto the then-current main (v554's runner work does not overlap this surface), merge release/v552 to main, push main (read-back "main pushed · remote in sync"), delete the local build branch, deploy the Worker from a clean checkout of the merged HEAD, What's New entry, registry row 1493 Live, served verification.
- **Concerns and Information Needs:** none.

## 3 · Implement

- **Change:** `app/worker/src/client.ts`, two seats only. (1) `paintFavoritesPage`: the bar gains `rightHtml` — the `.playbtn.small` disc under the standing `starred-playall` id with `aria-label="Play all of Favorites"`, emitted only when the list is non-empty; the in-page acts row and the retired `#starred-addall` id wiring are deleted. (2) `openHeaderMenu`: the Favorites group gains the "Add all to queue" item (act `starredAddAll`) directly under the head, above the unedited Reorder push, standing only outside reorder mode while the list holds a track. `starredPlayAll` / `starredAddAll` and all standing machinery byte-identical; no migration; no server change.
- **Harness:** `app/tests/harness-v552.mjs` — 29 ok / 0 not-ok on the build tree (statics: diff confined to client.ts + this document + the harness · index.ts/ui.ts byte-identical · migration 0042 last · acts and machinery byte-identical · the Reorder push unedited; Chromium legs: disc in the bar's right slot with the row gone · menu group reads Favorites · Add all to queue · Reorder · the Add all item forms the waiting queue in list order under 'starred' provenance · a disc tap plays the list in order, first track current · Reorder still enters reorder mode · the empty list paints no disc and no menu act items).
- **Concerns and Information Needs:** none.
