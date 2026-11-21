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

## 3 · Implement

Built on release/v581 (commits 4ac1045 + 6c1650d), all in the standing surfaces — `app/worker/src/client.ts`, `app/worker/src/index.ts`, the new `app/harness-v581.mjs`, and two sibling harness pin moves (§3.4). No migration, no store change, the v578 vault untouched.

### 3.1 The fifth folder and the derivation (Q1 A · Q3 A)

- `FAV_FOLDER_DEFAULTS` gains `{ id: 'novenas', name: 'Favorite Novenas' }` fifth, after Favorite Podcasts. `favFolders()` is otherwise exactly as derived (v579's device-local folder order sorts inside it — §3.3), so the page, the Move menus, and the reorder machinery all cover the fifth folder with no further change.
- `favDerivedFolder`: a `series` entry whose id starts with `novena-` (the v577 canon, read by the new `favIsNovenaDoor`) derives to `novenas`; any other series derives to `podcasts`. No entry is rewritten — already-starred novenas re-derive on the next paint, and a standing assignment still governs through `favFolderOf` (a door the user moved stays where the user put it; harness L2 proves both directions).

### 3.2 The novena object (Q2 A)

- `favDoorRowHtml` branches on the novena door: its meta line is `favNovenaStanding(e)` — "Day n today" from the presented day's Novenas slot (the slot track whose episodeId is the door's id, read through `novenaInfo`, the catalog card's own resolution), else "Starts <label>" from the catalog row's new `startLabel`, else the plain line "Novena". A podcast door's meta stands unchanged.
- The door menu's first item reads "Open novena" for a novena door; the tap still routes `goSeries(e.id)` → `openPodSeries('novena-…')`, the proven catalog path.
- Server (index.ts): `podNovenasIndexPayload` adds `startDate` + `startLabel` per novena — the Day-1 episode's date where a Day 1 stands, else the earliest episode's (episodes stand newest-first in the snapshot). No new store; the snapshot already carries every episode.
- The Favorites paint kicks the two loads a novena door needs, in the standing pattern, only when novena doors stand: the novenas catalog fetch (settle repaints through `paintFavoritesSurfaces`) and `catechesisNovenasResolve()`. The wiring the Plan promised to name: the resolution's settle hook `catechesisNovenasSettled` now also calls `paintFavoritesSurfaces()` (a no-op unless the Favorites page stands), so a "Day n today" line lands when the slot settles.

### 3.3 Empty folders don't show (added rule)

- `favFolderCount(folderId)` (tracks + doors, or the book's favorites for Prayers) and `favVisibleFolders()` = `favFolders()` filtered to count > 0 are the single derivation. `paintFavoritesPage` paints sections from `favVisibleFolders()` only — defaults and customs alike; when none stands, the list area carries the one settled card ("No favorites yet — tap ☆ on a track, a prayer, a podcast, or a novena and it will stand here."). `favFolderSectionHtml` counts through the same helper. Move menus still offer every folder (a destination need not be visible to receive an item).
- **Sequencing fact, stated plainly:** v582 and v579 shipped to main while this build was in flight; the branch rebased onto main a49dc6d with no conflicts, and the harness suite re-ran green on the rebased tree (§4). v579's folder-order machinery composes with the fifth folder as its own comment anticipates — the stored order sorts inside `favFolders()`, and a later default stands in its standing place until the person reorders.
- **One divergence, named (not silently folded in):** v579's reorder mode, shipped hours before this build landed, enumerates its folders through its own `favReorderVisibleFolders` — empty DEFAULT folders are absent there (the added rule holds), but empty CUSTOM folders stand in the reorder mode by v579's shipped design (management access: an empty custom folder can still be renamed, deleted, or reordered there). The Favorites PAGE follows the added rule for defaults and customs alike, exactly as directed. Aligning the reorder mode for customs is a separate small fix-forward if John wants it; it is not folded into this release.

### 3.4 Harness and the named pin moves

- harness-v581 (new): S-legs (diff confinement · migrations unchanged, newest 0042 · SW pin unmoved pre-Ship · surface strings · the payload's start fields · the RENDERED client parses whole · the paint reads the visible folders) + L-legs over the rendered client (five folders in order · derivation both ways + assignment governs · the page list partition — novena under Favorite Novenas, never under Favorite Podcasts · the standing line in all three states · empty-folder invisibility + Move still offers + the all-empty world · the payload's own text over a fixture catalog for the Day-1 and no-Day-1 cases).
- Named pin moves (the release that changes the folder count moves the pins that enumerate folders): harness-v576's L1 folder-order pin and harness-v579's L1/L4 folder-order pins now carry 'novenas' in its standing place. No other sibling assertion was touched.

## 4 · Review

Review ran on a CLEAN checkout of the exact committed tree — worktree ~/workspace/.worktrees/v581/review, detached at the branch HEAD 6c1650d, `git status` clean — never on the build worktree's word.

- **harness-v581: 31 ok / 0 not ok** on the clean checkout (and the same on the build tree before the commit).
- **harness-v576: 44 ok / 1 not ok.** The one not-ok is its S1 diff-confinement leg: its allowed-file set predates harness-v581.mjs, so the leg structurally fails on any tree carrying this release's harness. Every functional leg passes, including the folder partition and the moved L1 pin.
- **harness-v579: 33 ok / 2 not ok.** The two not-oks are its S1/S3 legs, which are pinned to its ship parent (175b857) and structurally include v579's own shipped change and pin bump — they can only pass on v579's own pre-ship tree. Every functional leg passes, including all folder-order legs with the fifth folder standing in its standing place.
- **harness-v577: 37 ok / 1 not-ok.** The one not-ok is the same S1 class (its allowed set predates the sibling harness files and this release doc). Its served legs pass against the modified payload builder — the novena grouping and series payloads answer in both shapes (private + public), with the new start fields standing consistently in both.
- Gate honesty: the three S-leg artifacts above are named with their causes; no failed leg is counted as a pass, and no functional leg failed anywhere in the suite.
- Diff audit: the change is confined to the folder derivation, the door row's meta, the section visibility, two payload fields, and the settle-hook line — the starred store, the sweep, the vault, and the Prayers folder's definitional content are untouched (the diff stat: client.ts +102/−9 in the favorites span, index.ts +9).

### 2.8 Ship shape

Client change + one server payload addition; SW pin `ora-pro-nobis-v581-1`; merge release/v581 back to main and push (read-back "main pushed · remote in sync"); deploy from the merged main tree; rollback target = v578 Worker be60f487. Sequencing with v579/v582: re-read main before merging and before deploying, rebase onto standing main, never force-push.
