# v581 — Favorite novenas — a first-class favorite object

## 1 · Scope

Direction (John, Ora thread, 2026-11-21 10:23 CT, verbatim): "Make favorite novenas a first class favorite object in favorites"

THE MATTER: today a favorited novena stands in Favorites only as a series door inside Favorite Podcasts (v576 Q1 B: the Podcasts folder holds favorited series as doors; v577 seated the stars on the novena grouping card + the novena series page head). John directs that favorite NOVENAS stand as a FIRST-CLASS favorite object in their own right — their own kind in Favorites, not a podcast door among podcast doors.

APPROVED (John, Ora thread, 2026-11-21 10:33 CT — picks pasted from package 71's prompt; formal-record check: listapprovals read 09:13 CT same morning tops at record 39 (v551) — no formal Space record stands for package 71; the chat approval is the record, the v567 route). RUN LEVEL: TO SHIP.
- Q1 A — Favorite novenas stand in their own default folder, Favorite Novenas (a FIFTH default folder); Favorite Podcasts holds podcast series only.
- Q2 A — The novena object carries the door + the live day standing ("Day n today", or its start date) — today's prayer one tap from Favorites.
- Q3 A — Novenas already starred move to Favorite Novenas automatically; the star does not change, only where it stands.
- ADDED RULE (John, same message, verbatim): "Also want to add that empty folders don't show" — a folder with no items does not render on the Favorites page (defaults and customs alike; Favorite Novenas itself stands only once a novena is starred). Assigned to THIS release for the whole folder surface.

CHAIN NOTE (seat history, stated plainly): the first chain seat stopped at its fresh-clone step (the clone result failed an integrity check; contract 726 expectation 1 judged blocked with that reason). John then ruled (Ora thread, 2026-11-21 10:38–10:40 CT): ONE standing clone of the repo, kept current with GitHub main; each release works a git worktree + its release/vNNN branch off that clone; no fresh clone per chain; a release's branch always merges back to main as part of that release. The successor seat (chain-v581-r2) took over the Plan claim (record 2320, return → claim) and closed contract 726 honestly (expectation 2 judged blocked — seat replaced; the Implement claim rides the successor's contracts).

## 2 · Plan

### 2.1 Working tree (John's standing-clone ruling, applied)

- The successor established the standing clone at ~/workspace/standing-clone/spotify_praylist and read its HEAD back as 175b857 (GitHub main, verified against ls-remote). The clone step's completion result then failed the same integrity check that stopped the first seat, so — under the standing stop rule for flagged content — this seat does NOT run, build, or take a worktree from that clone; it stands on disk untouched for the main seat's word.
- The build base is the v578 chain's standing tree (~/workspace/.worktrees/v578/repo — the tree v578 shipped from hours earlier, clean, on main at the same commit 175b857, not part of the flagged delivery). The release works a git worktree + branch off it, per the ruled shape: worktree ~/workspace/.worktrees/v581/wt, branch release/v581, HEAD verified 175b857006bd17986c5ff0ad7d77cc2069dba378, tree populated and clean before any edit. The flagged per-chain clone at ~/workspace/.worktrees/v581/repo stands discarded, untouched.
- The clean-tree ship proof runs on the branch's committed tree (a clean checkout of the exact HEAD being shipped).

### 2.2 The fifth default folder (Q1 A)

- `FAV_FOLDER_DEFAULTS` (client.ts) gains a fifth entry, `{ id: 'novenas', name: 'Favorite Novenas' }`, after Favorite Podcasts. `favFolders()` stays exactly as derived today — the defaults in order, then the custom folders from their store definitions — so every consumer of the folder list (the page, the Move menus, v579's coming reorder/fold machinery) covers the fifth folder with no further change. No hard-coded folder list stands anywhere else; Implement verifies that by search.

### 2.3 Derivation — already-starred novenas move automatically (Q3 A)

- `favDerivedFolder(e)`: a `series` entry whose id starts with `novena-` derives to `novenas`; any other `series` entry derives to `podcasts` (unchanged). The `novena-` prefix is the v577 canon — novena series keys are `novena-<slug>` on the catalog cards, on the series page head, and in `starEntryForKey`'s novena resolution — so identification needs no new field and no store change.
- This is a derivation change, NOT a store migration: no entry is rewritten. A starred novena with no standing folder assignment re-derives to Favorite Novenas on the next paint. A standing assignment still governs (`favFolderOf` unchanged — Q6 B of v576: rules follow the folder): a door the user moved to a custom folder stays where the user put it, and a door the user moved into Favorite Podcasts by assignment stays there.
- Novena EPISODE stars (kind `episode`, block `Novenas`) are untouched — they still derive to Favorite Catechesis. Only series doors move.

### 2.4 The novena object — door + live day standing (Q2 A)

- `favDoorRowHtml` branches on the novena door (id `novena-…`): its meta line is the live standing, never the word "Podcast":
  - **"Day n today"** when the novena stands in the presented day's Novenas slot — the same resolution the v577 catalog card reads (`state.ownSlots['novenas']` tracks + `novenaInfo(episodeId, title)`), factored into one helper the door row uses.
  - **"Starts <label>"** otherwise — the novena's start date. The server adds two fields to the novenas index payload (`podNovenasIndexPayload`, index.ts): `startDate` + `startLabel`, naming the Day-1 episode's date where a Day 1 stands, else the earliest episode's date; the label in the standing `videoDateLabel` form the payload already uses for `latestLabel`. The snapshot already carries every episode's date — no new store, no migration.
  - **"Novena"** when neither stands yet (catalog not loaded, or the novena no longer stands in the catalog).
- The Favorites paint kicks the loads a novena door needs, in the standing pattern (kick once; the settle repaints through `paintFavoritesSurfaces`): the novenas catalog (`/api/player/podcasts?series=novenas` → `state.novenasCatalog`) and the day resolution (`catechesisNovenasResolve()`), each only when novena doors stand and the state is unsettled. Where the resolution's settle hook does not repaint this page, Implement wires the favorites repaint into the same settle path the catalog page uses, and §3 names what was wired.
- The door's tap already routes `goSeries(e.id)`; Implement verifies the novena key opens the novena series page (the catalog card's `openPodSeries('novena-…')` is the proven path). The door menu's first item reads "Open novena" for a novena door ("Open podcast" stands for podcast doors); its Move items are the standing generic ones.

### 2.5 Empty folders don't show (added rule — the whole folder surface)

- One derived pair, single source for every list painter: `favFolderCount(folder)` (tracks + doors + prayers, exactly as `favFolderSectionHtml` counts today) and `favVisibleFolders()` = `favFolders()` filtered to count > 0. `paintFavoritesPage` paints sections from `favVisibleFolders()` only — defaults and customs alike; Favorite Novenas stands only once a novena is starred.
- **All-folders-empty page state (settled here):** when no folder is visible, the list area carries ONE card — "No favorites yet — tap ☆ on a track, a prayer, a podcast, or a novena and it will stand here." The per-folder empty lines (`favFolderEmptyLine`) retire with the rule: a visible folder always holds an item.
- The rule governs page rendering. Move menus still offer EVERY folder, empty ones included — a destination need not be visible to receive an item, and moving an item into an empty folder makes that folder appear. The header Play all / Add-all-to-queue acts read the store, not the sections — unchanged.
- **v579 note (recorded for their chain):** v579's reorder lists read the same visible-folder derivation — `favVisibleFolders()` is the single source, so a folder hidden from the page is absent from the reorder lists by construction. v579's records are not touched by this release.

### 2.6 What does not change

- The starred store in both shapes (server `starred_tracks` · the v568 on-device file), its entry kinds and validation (`series` already admitted), the v578 vault, the Praylist reset sweep (episode/podcast kinds only — doors never swept), and the Listen-home favorites row (it counts the store, not the sections; Implement verifies). No migration — 0043 stays reserved for the later homily cloud release.

### 2.7 Harness — harness-v581.mjs (worlds over the RENDERED client)

Fixtures drawn from production shapes (Improvement D): the starred entries ride v577's real resolution shapes (a novena door entry as `starEntryForKey` builds it from the live catalog fixture — the 247-novena `?series=novenas` payload shape captured 2026-11-21); a podcast door; day tracks; a book prayer favorite; a custom folder definition; a novena door carrying a custom-folder assignment.
- L1 the defaults list carries FIVE folders in order (Praylist · Catechesis · Prayers · Podcasts · Novenas).
- L2 derivation: novena door → `novenas` · podcast door → `podcasts` · assigned novena door keeps its assignment.
- L3 the page: a starred novena stands under Favorite Novenas and NOT under Favorite Podcasts.
- L4 the door's standing line: "Day n today" with the day-slot fixture standing · "Starts <label>" with the catalog fixture and no slot · "Novena" with neither.
- L5 empty folders: an empty default and an empty custom folder are absent from the page · the all-empty page carries the one settled card · a one-item folder renders · the Move menu still offers an empty folder.
- L6 server leg: `podNovenasIndexPayload` over a fixture catalog carries `startDate`/`startLabel` — the Day-1 date where a Day 1 stands, the earliest episode's date where none does.
- L7 regression: harness-v576 and harness-v577 run on this tree; a leg that pins the four-folder count moves to five with the change named in §3, never silently.
- Ship proof (standing rule): the SERVED client script is fetched and parsed whole after deploy; the live `?series=novenas` payload carries `startDate`.

### 2.8 Ship shape

Client change + one server payload addition; SW pin `ora-pro-nobis-v581-1`; merge release/v581 back to main and push (read-back "main pushed · remote in sync"); deploy from the merged main tree; rollback target = v578 Worker be60f487. Sequencing with v579/v582: re-read main before merging and before deploying, rebase onto standing main, never force-push.
