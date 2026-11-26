# v678 — Favorites in Praylist dress: section cards, empty groups hidden

## §1 Scope

John's direction (2026-11-25 20:52 CT, with his screenshot of the Favorites page): "Style the favorites like the playlist groups that expand and don't show empty groups".

Approval (John, 2026-11-25 21:01 CT, verbatim): "Approve Favorites in Praylist Dress — Q1: A · Q2: A · Q3: A · Q4: A · Q5: A · run level: To Ship". Full package: `~/workspace/research_notes/scope-favorites-playlist-style-20261125/report.md`.

The picks, as approved:

- **Q1 A** — Favorites page groups take the FULL v659 Praylist section-card dress: card per group, drawn SVG mark, group name, LIVE unplayed count, Play disc, section ⋮ menu, + / − toggle; the expanded card carries the group's rows exactly as today (same rows, same acts, same row menus).
- **Q2 A** — An empty group does not stand on the page at all; when every group is empty, one plain line stands: "No favorites yet — star any track to keep it here."
- **Q3 A** — ONE group open at a time (Praylist accordion, `opnToggleBlock604` discipline).
- **Q4 A** — The page head's Play disc GOES; the head keeps back arrow + Favorites title only.
- **Q5 A** — Each group card's ⋮ menu carries the Praylist section acts (Play · Play next · Add to queue for the whole group).

Run level: To Ship. Base: v677 ship head `7f72a5f`, branch `release/v678`, worktree `~/workspace/.worktrees/v678`. All code cites are `app/worker/src/client.ts` / `ui.ts` at the v677 tree unless named.

**⚠ SCOPE QUESTION IN §2.9 — ANSWERED 2026-11-25 21:12 CT (see the §2.9 amendment).** The grounding (§2.1) found a group kind the approved dress has no seat for: the **Favorite Podcasts** and **Favorite Novenas** folders hold *doors* (series entries), not tracks. A door has no playable descriptor, no played/listened state, and no unplayed count in any standing store — `starredDescFor` returns `null` for it by design (client.ts:13062). Those two cards therefore cannot carry a LIVE unplayed count, a Play disc, or the Q5 menu acts without inventing a new shape (e.g. fan-out series-payload loads per door, or a count that is not an unplayed count). Per the Plan's grounding rule, this Plan does **not** improvise that shape: §2.9 states the question for John, with the candidate readings. Every other part of the dress is fully specified and buildable; Implement seats the track-bearing folders (§2.3–§2.8) and leaves the two door folders' heads at the §2.9 boundary until John's answer lands. The harness leg for door-folder heads (§2.10, L7) is conditional on that answer.

Scope boundaries:

- **IN:** the Favorites page's group paint (cards, heads, toggles, menus) · the empty-group rule · the page head per Q4 · the accordion per Q3.
- **OUT:** the v662 Favorites entry row in the Praylist (`paintFavoritesFolderRow`, client.ts:13236, and the v659 Favorites card on the Praylist home) · what counts as a favorite and the star acts everywhere · the rows' own contents and menus inside a group · the Favorites reorder mode's own paint · any other page's dress · the vault-locked and web-pointer paints of this page.

## §2 Plan

### §2.1 The full group list the Favorites page paints (grounded)

The page's groups are **folders** (v576/v581), not a fixed pair. `paintFavoritesPage(day)` (client.ts:13842) paints `favVisibleFolders()` (client.ts:13599) through `favFolderSectionHtml(folder)` (client.ts:13819). The folder list itself is `favFolders()` (client.ts:13526): the five defaults of `FAV_FOLDER_DEFAULTS` (client.ts:13508), then every custom folder defined by a `k:'folder'` entry in the starred store, sorted by the device-local folder-order key.

| # | Folder (id) | Row source | Rows painted by | Paint seat |
|---|---|---|---|---|
| 1 | Favorite Praylist (`praylist`) | Track entries of `state.starred` whose effective folder is `praylist` — `favTracksIn` (client.ts:13578) over `favoritesList()` (client.ts:13224, the store's `episode`/`podcast` kinds only); derived home of day episodes (`favDerivedFolder`: any non-podcast episode not in the Novenas block); moved-in doors also possible (`favDoorsIn`, client.ts:13581) | `starredRowHtml` (client.ts:13186); doors by `favDoorRowHtml` | `favFolderSectionHtml` praylist branch |
| 2 | Favorite Catechesis (`catechesis`) | Starred **podcast episodes** (derived: `e.k === 'podcast'` → catechesis) + Novenas-block episodes; `favTracksIn` | `starredRowHtml` | same |
| 3 | Favorite Prayers (`prayers`) | The prayer book's favorites — `bookFavsList()` (client.ts:12683) over `state.bookFavs` (the `/api/prayer/book/favorites` store); definitional: no starred tracks or doors ever stand here (`favFolderSectionHtml` special-cases the id) | `favPrayerRowHtml` (book favorite → `bookFind` → `prayerAudioDesc`, client.ts:14109) | same |
| 4 | Favorite Podcasts (`podcasts`) | **Doors only** by derivation: `favDoorsIn` — `k:'series'` starred entries that are not novena doors (John's real four stand here as doors: The AI Signal · The Counsel of Trent · The Exorcist Files · Bible in a Year); moved-in tracks also possible | `favDoorRowHtml` (tap → `goSeries`; plays nothing itself) | same |
| 5 | Favorite Novenas (`novenas`) | **Novena doors only** by derivation: `k:'series'` entries with id `novena-<slug>` (`favIsNovenaDoor`); meta line is the live day standing (`favNovenaStanding`) | `favDoorRowHtml` | same |
| 6 | Custom folders (any number) | A `k:'folder'` definition entry in `state.starred` (created by `favCreateFolder`); contents = any tracks/doors whose standing `folder` assignment names it (`favFolderOf`) — mixed kinds by design | `starredRowHtml` + `favDoorRowHtml` as the items fall | same |

Row stores: `state.starred` is the standing starred store in both shapes (server `starred_tracks` table · the v568 on-device file; v576 header comment at client.ts:13463); the Prayers folder reads the separate book-favorites store. No other group kinds stand on this page — no separate episodes/videos/homilies/series groups exist; episodes and videos stand as track rows *inside* folders 1–2 (and customs), series stand as doors inside folders 4–5 (and customs).

**Group-kind surprise: YES — folders 4 and 5 (doors).** See §2.9. Folders 1, 2, 3, and track-bearing customs have every seat the dress needs (§2.4–§2.5).

### §2.2 Empty groups — how the page paints them today

- **An empty group already stands nowhere.** `favVisibleFolders()` (client.ts:13599) filters `favFolders()` to `favFolderCount(f.id) > 0` (v581, John's added rule: "empty folders don't show"), and `paintFavoritesPage` maps only that list (client.ts:~13959). `favFolderCount` (client.ts:13591) counts tracks + doors, or the book favorites for `prayers`.
- `favFolderSectionHtml` still carries a `!count` branch emitting a `favFolderEmptyLine(folder)` card ("No favorite prayers yet — …", client.ts:~13812) — **unreachable from this page's paint**, since only visible folders are mapped; it stands as a dead branch, not as page behavior. The reorder mode likewise skips a folder emptied mid-mode (v613 filter in the reorder paint).
- **Every group empty:** `paintFavoritesPage` emits one card: "No favorites yet — tap ☆ on a track, a prayer, a podcast, or a novena and it will stand here." (client.ts:~13961).
- **v678 work under Q2 is therefore small and exact:** (i) preserve the `favVisibleFolders` hiding whole — the restyle must paint cards from that same filtered list, never from `favFolders()`; (ii) replace the all-empty line's text with John's approved line verbatim: **"No favorites yet — star any track to keep it here."** (iii) the dead `!count` empty-line branch in the section builder retires with the re-dress (a card builder that only ever receives non-empty folders has no empty case).

### §2.3 The card — reuse of the v659 machinery, seat by seat

There is no standalone Praylist card-builder function: the card is emitted inline by `opnSetHtml609(day)` (client.ts:26486; the card emission at client.ts:~26575). Reuse therefore means: **the same emission grammar, the same classes, and the same standing functions** — not a second card implementation, and not a copy of the block paint.

`favFolderSectionHtml(folder)` is re-dressed to emit, per folder:

```
<div class="card p659card" data-favcard678="<folderId>">
  <div class="p609sethead favfolder-head" data-favhead678="<folderId>">
    <div class="blockcover tone-<blockTone> sm">[sectionMark659 svg]</div>
    <h2 class="sectionhead grow">[folder name]</h2>
    <button class="playbtn small p615disc" data-favdisc678="<folderId>">▶</button>
    <button class="iconbtn p645secmenu" data-favsecmenu678="<folderId>">⋮</button>
    <span class="meta" data-favcount678="<folderId>">[live unplayed]</span>
    <span class="p659toggle">+ | −</span>
  </div>
  [when open] <div class="p659body">[the folder's rows, §2.3.3]</div>
</div>
```

1. **Mark:** `sectionMark659(block)` (client.ts:26466) called with the folder name; a name with no table entry takes the function's standing fallback (a plain ring, `paths659[block] || '<circle …/>'`) — no new mark shapes are drawn in this release. Tile tone: `blockTone(name)` (its standing fallback is `navy`).
2. **Count:** the `<span class="meta">` carries the folder's LIVE unplayed count (§2.4), computed at paint and refreshed live (§2.4.3).
3. **Disc:** `.playbtn.small.p615disc` dress, greying with the `all` class under the same rule as the Praylist heads (total > 0 && unplayed === 0). Its act is §2.5.1.
4. **⋮ menu:** §2.5.2. For custom folders, the standing folder acts (Rename · Delete folder, `openFavFolderMenu`) append below the section acts — that menu is their only seat, and Q5 does not retire it.
5. **Toggle:** `.p659toggle` span reading `+` closed / `−` open; the head tap is the fold act (the toggle is not a separate button — the v659 discipline). The standing `.favfolder-chev` button retires from this paint.
6. **Body:** the folder's rows emitted by the **same builders as today** — `favDoorRowHtml`, `starredRowHtml`, `favPrayerRowHtml`, in the same order `favFolderSectionHtml` composes them today (doors · tracks · prayers). Row contents, row acts, and row menus are untouched (Scope OUT).

**Attribute discipline (load-bearing):** folder heads must NOT reuse the Praylist attributes `data-p609sethead` / `data-p645secmenu` / `data-p615count` / `data-p615disc`. Those attributes' wiring resolves **blocks from `state.dayDescs`** (the section-menu wiring at client.ts:23357; `refreshPlayedChrome`'s head pass at client.ts:~16446 recomputes `[data-p615count]` via `opnBlockCounts615`) — a folder named like a block (the Podcasts folder vs the Podcasts block is the standing collision) would silently build block sets and block counts. Folder heads carry the parallel `data-fav*678` attributes above, wired in `paintFavoritesPage` beside its standing passes (§2.5, §2.7).

**CSS:** no new card CSS. `.card`, `.p659card`, `.p609sethead`, `.p659body`, `.p659toggle`, `.blockcover.sm`, `.p659mark` all stand in `ui.ts` from v659. The `.favfolder` wrapper and `.favfolder-head` dress retire from this paint (the reorder mode keeps its own `.favfolder` emission — untouched).

### §2.4 The live unplayed count, per folder

One new counter, `favUnplayedCount678(folderId)`, built entirely from standing predicates; it returns `{ total, unplayed }` over the folder's **playable tracks** (doors excluded — §2.9):

1. **Episode tracks** (folders 1–2, customs): descriptor via `starredDescFor(e)` (client.ts:13062 — the LIVE `state.dayDescs` object where one stands, else the snapshot descriptor); unplayed reads `opnTrackUnplayed615(desc, presentedDateStr())` (client.ts:16362) — the one v615/v618 predicate: the played store on the presented date, occurrence-aware through `isPlayedDesc`.
2. **Podcast episodes** (folder 2, customs, moved-in): unplayed reads **`favPodListenedOf(e)`** (the open series payload's entry `listened`, else the `favPodListened` session map warmed by `favPodWarm`) — NOT the descriptor's `listened` field: `starredDescFor`'s snapshot branch for a non-open series builds a descriptor carrying **no** `listened` field, so a desc-only count would read every such episode as unplayed forever. This is the count's one trap; the harness (§2.10, L5) proves the map seat.
3. **Prayers folder:** per slug, `prayerAudioDesc(bookFind(slug).prayer, 'en')` (client.ts:14109; descriptor kind `prayer`, episodeId `prayer:<slug>:en`, block `''`); unplayed reads `opnTrackUnplayed615` on it — the played store on the presented date. (Prayer rows carry no mark face today; the count is computed from the same store the prayer's plays write. A slug whose prayer no longer resolves contributes nothing, as its row paints nothing.)
4. **Doors:** contribute to neither total nor unplayed (they are not tracks — the standing Play-all discipline, `starredPlayableDescs` client.ts:14055, passes them by the same way). A folder holding tracks AND doors counts its tracks. A folder holding ONLY doors is §2.9.

**Live refresh:** `refreshPlayedChrome()` (client.ts:16399) gains a folder pass beside its v615 head pass: every `[data-favcount678]` span in `view` is recomputed from state via `favUnplayedCount678` and its text reset, and the sibling `[data-favdisc678]` disc's `all` class re-toggled by the same rule. Recomputed from the stores on every pass, never incremented — the v615 discipline verbatim. (The folder attribute is deliberately not `data-p615count`: that pass would overwrite it with a block count.)

### §2.5 The group acts — disc and ⋮ menu (Q5)

The group's playable set, one builder: `favFolderDescs678(folderId)` = the folder's tracks → `starredDescFor` → available descriptors (prayers folder: book slugs → `prayerAudioDesc`); the **queue set** is `discQueue618(descs)` (client.ts:5773) — the unplayed-only filter through `opnTrackUnplayed615`, exactly the set a Praylist head's disc and ⋮ build.

1. **Disc tap** (wired on `[data-favdisc678]` in `paintFavoritesPage`; stops propagation, never folds — the disc's standing discipline): `startQueue(discQueue618 set, true)` (client.ts:5812) with the starred provenance of `starredPlayAll` (client.ts:14060): `state.queueFrom = 'starred'; saveQueueSnapshot();`. An all-played group builds an empty set and `startQueue` no-ops, as a Praylist disc does.
2. **⋮ menu** (wired on `[data-favsecmenu678]`; stops propagation): `openSheetMenu(folder.name, [ Play · Play next · Add to queue … ], btn)` where Play = the disc's act (§2.5.1), Play next = `playNextSet(set)` (client.ts:6031), Add to queue = `addToQueueSet(set)` (client.ts:6017) — the exact two acts the Praylist section-⋮ wiring calls (client.ts:23357). Note, named so Review does not flag it: the Praylist ⋮ itself carries only Play next · Add to queue (its Play is the disc); Q5's approved text names all three acts in the Favorites menu, so Play stands in the menu here as the disc's own act. Custom folders: Rename · Delete folder append (§2.3.4).

### §2.6 The accordion (Q3)

Today folders fold **independently**: `favToggleCollapse(folderId)` (client.ts:13633) flips one entry in the device-local collapse map (`FAV_COLLAPSE_KEY` = `opn-favcollapse-v576`), and a virgin map reads **every folder expanded** (v576: "All folders stand EXPANDED by default").

The v678 discipline mirrors `opnToggleBlock604` (client.ts:23606) — an OPENING act first closes every other key; closing the open card leaves none open — seated in the standing collapse store (the folder fold does **not** route through `opnFoldSession604`/`opnExpanded604`: that map's fallback reads dayDescs runs and the stored praylist mode, which name blocks, not folders):

- `favToggleCollapse` is rewritten: **opening** folder F writes the map as { every other folder in `favFolders()`: 1 } with F's entry deleted; **closing** F writes the map as { every folder: 1 } (none open — `favCollapseAll`'s existing write shape, client.ts:~13650).
- The expanded read at paint: a folder stands open iff it is not collapsed AND it is the first non-collapsed **visible** folder — with one named exception: a virgin map (no entries at all) opens the **first visible folder only** (the accordion reading of the standing default, mirroring `opnExpanded604`'s 'expanded' fallback at client.ts:23588, where the first run stands open). A partially-written legacy map reads by the same first-non-collapsed rule, so no migration stands.
- The header menu's folder acts (client.ts:16792–16793) follow the v659 precedent: **Expand all retires** (its meaning cannot stand under one-open; `favExpandAll` loses its only caller), **Collapse all stands** (it already writes the all-collapsed map).
- The toggle act repaints through the standing `paintFavoritesSurfaces()` (client.ts:14048), as `favToggleCollapse` already closes with today.

### §2.7 The v673 no-lag property — preservation

v673's Review ruled the Favorites page a seat that never lagged, on two mechanisms (v673 doc §2.3 ruling, re-verified at this tree):

1. **Episode rows:** `starredDescFor` returns the live `state.dayDescs` object itself; the row's mark face is `playedDotHtml`'s `[data-markplayed]` button, wired by `wirePlayed(view)` and repainted **in place** by `refreshPlayedChrome`'s day-store pass — no repaint needed, no copy between write and paint.
2. **Podcast rows:** the face is `favMarkHtml`'s `button.podmark` reading `favPodListenedOf(e)`; `favPodToggle` flips the payload entry / session map first and closes with `paintFavoritesSurfaces()` — the face re-reads the flipped state in the same act.

The restyle preserves both by construction, and Implement must hold these lines:

- Rows inside the expanded card are emitted by the same builders (§2.3.6) reading the same live stores at paint time; `paintFavoritesPage` keeps its standing wiring passes whole (`wirePlayed(view)`, the `[data-favpodmark]` / `[data-favmenu]` / `[data-starplay]` / `[data-card]` passes).
- The card body is plain DOM inside `view` — `refreshPlayedChrome`'s in-place passes (`[data-markplayed]`, `[data-poddot]`) still reach the rows; no shadow root, no iframe, no detached subtree.
- **What must NOT be snapshotted:** descriptors, `listened` flags, played state, and counts must never be copied into a folder-level cache at card build. The head count (§2.4) recomputes from the stores at paint and at every `refreshPlayedChrome`; the disc/menu sets (§2.5) build from `starredDescFor` / `favPodListenedOf` at tap time, exactly as today's acts do.
- The accordion state (§2.6) is the only new state, and it is fold state only — a toggle repaint re-reads the live stores through the standing `paintFavoritesSurfaces`, so a mark landed while a card stands closed paints correctly when the card opens.

### §2.8 The page head's Play disc (Q4)

- **Seat:** `paintFavoritesPage`'s bar call (client.ts:13949–13950) — `rightHtml: list.length ? '<button class="playbtn small" id="starred-playall" …>&#9654;</button>' : ''` — wired at client.ts:13964–13965 to `starredPlayAll()` (client.ts:14060), which plays `starredPlayableDescs()` (client.ts:14055): every playable starred track across ALL folders, in store order, doors passed by.
- **Removal touches exactly:** the `rightHtml` becomes `''` (the bar keeps back arrow + "Favorites" title, `hdrBarHtml` unchanged), and the `#starred-playall` wiring block retires. `starredPlayAll` then has no caller — it stands as dead code or retires, Implement names its choice; `starredPlayableDescs` and `starredAddAll` STAND (the universal menu's Favorites group still calls `starredAddAll`, client.ts:~16782 — the menu's Add all to queue is not the head disc and is out of Q4's reach).

### §2.9 ⚠ SCOPE QUESTION — the door folders (Favorite Podcasts · Favorite Novenas)

Facts (all §2.1): these two default folders hold **doors** — `k:'series'` entries whose rows open a series page (`goSeries`) and play nothing. For a door there is no descriptor (`starredDescFor` returns `null` for `k:'series'`/`k:'folder'`, client.ts:13062, by v576 design: "a series door and a folder definition are never playable"), no played/listened state on this page, and no standing per-door episode enumeration (a door's episodes live behind its series payload, which this page never loads — `favPodWarm` warms starred podcast *episodes*, not doors; a novena door has no podcast payload at all, its standing line is `favNovenaStanding`'s day-standing text).

So three of the card head's six elements have no seat for a doors-only folder: the **LIVE unplayed count** (nothing carries an unplayed state), the **Play disc**, and the **⋮ section acts** (no queue set exists to play). Dressing these two cards whole would require inventing a shape — e.g. loading every door's series payload to count unlistened episodes behind it (a new fan-out load + a new count meaning; impossible for novena doors), or printing the door count where an unplayed count belongs (a count that misleads — the package's own named risk).

**Question for John (Implement does not proceed on these two heads until it lands):** for the Favorite Podcasts and Favorite Novenas cards, which reading stands?

- **(i)** The cards carry mark · name · toggle only (no count, no disc, no ⋮) — the v659 Favorites-card precedent, which carried no disc/⋮ for the same reason.
- **(ii)** The count seat carries the folder's item count (doors today, `favFolderCount`) and disc/⋮ stay off.
- **(iii)** Doors warm-load their series payloads and the count/disc/⋮ read the episodes behind the doors (podcasts only; novenas still need a reading).

Everything else in this Plan is unaffected by the answer: folders 1–3 and customs dress whole under §2.3–§2.8, and a custom folder holding only moved-in doors takes the same reading as folders 4–5 when the answer lands. The harness (§2.10) builds the track-bearing legs unconditionally and the door-folder leg (L7) conditionally on this answer.

### §2.9 amendment — John's answer (2026-11-25 21:12 CT)

John's words, verbatim: "Thise would be ok the bottom and trigger new windows like favorites do".

**Reading (i) stands.** The Favorite Podcasts and Favorite Novenas cards carry mark · name · toggle only — no count span, no Play disc, no ⋮ menu. The same reading covers a custom folder holding only doors. The door rows inside those cards keep today's behavior whole: a tap on a door row opens the door's own page as a new view — verified in the shipped code, not assumed: `favDoorRowHtml`'s tap is wired at client.ts:14022–14025 to `goSeries(door id)` for podcast and novena doors alike, and the door ⋮ menu's first act is the same `goSeries` ("Open podcast" / "Open novena"). Row contents and row acts are untouched (Scope OUT stands).

Consequences for the build:

- `favFolderSectionHtml`'s re-dress (§2.3) emits the head in two shapes: the full six-element head for a folder holding at least one playable track, and the three-element head (mark · name · toggle) for a doors-only folder. A mixed folder (tracks + doors) takes the full head; its count and queue set cover its tracks only (§2.4.4, §2.5), exactly as specified.
- No `data-favcount678` / `data-favdisc678` / `data-favsecmenu678` attribute stands on a doors-only head, so the `refreshPlayedChrome` folder pass (§2.4) and the disc/menu wiring (§2.5) pass it by construction.
- Harness L7 (§2.10) runs under this reading: the Favorite Podcasts card stands with mark · name · toggle only, its four doors stand as rows, and a door tap lands on the door's series page.

### §2.10 Harness design — `app/worker/harness-v678.mjs`

Modeled on `app/worker/harness-v677.mjs`: playwright-core Chromium, the real Worker bundle built with esbuild from source and served locally, the API stubbed in-page, `ORA_WT` selecting the tree for the fail-on-old run (base = the v677 tree at `7f72a5f`).

Fixtures (Improvement D — production shapes, sources named):

- **Starred store** in the shape the server starred store / on-device file carries it (whole-JSON entries, v576): (a) **Favorite Podcasts** = John's real four doors as `k:'series'` entries — The AI Signal · The Counsel of Trent · The Exorcist Files · Bible in a Year (titles from John's 2026-11-25 screenshot + the scope report); (b) **Favorite Prayers** = 3 book favorites (the screenshot's count) — slugs resolving in the stubbed `/api/prayer/book` payload, each prayer carrying `audio.en` (the v573/v574 shape `prayerAudioDesc` reads), with the stubbed `/api/prayer/book/favorites` returning the three slugs; (c) **Favorite Catechesis** = podcast episode entries of one of the four series, their series payload stubbed from the production folded shape (`app/tests/fixtures-v603/bible-folded.json` entries — key/title/url/durationS/listened), **one entry standing `listened: true`** (the played row inside a populated group); (d) **one EMPTY group**: a custom folder definition entry (`k:'folder'`, "Empty Shelf") with no items assigned, and no novena doors anywhere (Favorite Novenas empty by absence).
- **Day payload:** a presented day of 2026-11-25 (Chicago) in the standing harness shape, its `dayDescs` carrying the catechesis episode's live descriptor so `starredDescFor`'s live branch stands.

Legs:

1. **L1 — cards stand:** every populated track-bearing folder (Catechesis, Prayers) stands as one `.p659card` carrying mark tile + SVG · name · live unplayed count · Play disc · ⋮ · toggle; the Catechesis count excludes the played entry (L-fixture c); the expanded card's rows are the standing builders' rows (titles/order as the v677 paint emits for the same fixture).
2. **L2 — empty stands nowhere:** no card, head, or section for "Empty Shelf" or Favorite Novenas stands in the DOM. A second state with the starred store emptied whole paints the one line verbatim: "No favorites yet — star any track to keep it here." (L2's absence half passes on the v677 tree too — standing v581 behavior, named, not claimed as new; the line's text differs and fails there.)
3. **L3 — accordion:** open Prayers → Catechesis closes; open Catechesis → Prayers closes; tap the open card's head → none open. First paint: exactly one card (the first visible) open.
4. **L4 — group Play queues exactly that group:** tap the Prayers card's disc → the queue is exactly the Prayers folder's unplayed prayer descriptors, `queueFrom === 'starred'`; the Catechesis ⋮'s Play next and Add to queue land exactly that folder's unplayed set (the played entry excluded — the `discQueue618` discipline).
5. **L5 — played mark repaints in place (v673 property):** with Catechesis open, drive a row's mark through its standing act (`favPodToggle` seam for the podcast row; the `[data-markplayed]` dot for an episode row where one stands) → the row's face flips, the head count decrements by one, and the card stands open throughout (no collapse/re-expand: the open folder id is identical before and after, and the row's DOM node is the same node for the in-place day-store leg).
6. **L6 — head per Q4:** the bar carries the back arrow and "Favorites" title and NO `#starred-playall` / no `.playbtn` in the bar host.
7. **L7 — door folders (CONDITIONAL on §2.9):** asserts whichever reading John approves for the Favorite Podcasts card (four doors standing as its rows under any reading). Until the answer lands this leg reports SKIP-named, never PASS.
8. **L8 — fail-on-old:** L1, L3, L4, L6 must fail on the v677 tree (`ORA_WT` at `7f72a5f`); L5's row-face half passes there (the standing v673 property) while its count half fails (no folder count stands on the old paint).

**Screenshots (Review evidence):** the harness writes PNGs via `page.screenshot` into `docs/releases/v678-screenshots/` (the harness-v669 pattern): `01-favorites-one-group-open.png` (Catechesis open, its rows standing, Prayers closed) · `02-favorites-empty-group-absent.png` (the fixture-(d) state: populated cards standing, no Empty Shelf / Novenas card anywhere). Regressions: harness-v677 and harness-v676 run green on the new tree before Review believes any leg.

**Pin:** `ui.ts` CACHE (ui.ts:1186) → `ora-pro-nobis-v678-1` (its one seat).

### §2.11 Risks + boundaries restated

- **The door-folder question (§2.9)** is the release's one open risk; it is a Scope question, not an Implement improvisation. If John's answer is (iii), the count's fan-out load is new surface and the Plan returns for a supplement before that leg builds.
- **Count honesty:** a podcast episode whose series payload has not yet warmed reads unplayed through the session map's default — the standing `favPodWarm` posture (its comment: a failed read leaves the unlistened face standing). The warm settle already repaints through `paintFavoritesSurfaces`, so the count corrects itself on landing, like the row faces do today.
- **Attribute collision:** §2.3's `data-fav*678` discipline is the guard; Review checks no folder head carries a `data-p615*` / `data-p645secmenu` / `data-p609sethead` attribute.
- **Legacy collapse maps:** a device carrying a v576-era map with several folders uncollapsed reads under §2.6's first-non-collapsed rule at first paint — one card open, no write, no migration.
- **Reorder mode** paints its own folder sections and is untouched; it reads `favVisibleFolders` too, so the empty rule holds there by the same source.
- Boundaries (Scope §1) restated for Implement: no edit lands in `paintFavoritesFolderRow`, the star acts, any row builder's contents, the reorder paint, or any other page.

## §3 Implement record (2026-11-25, Implement seat, chain-v678)

Built exactly per §2 including the §2.9 amendment (reading (i)). Commits on `release/v678`: `6c80b10` (the dress) · `6b3d97b` (queue-set listened stamp + harness). All code in `app/worker/src/client.ts` unless named.

- **§2.3 card:** `favFolderSectionHtml` re-dressed — one `.card.p659card[data-favcard678]` per folder from `favVisibleFolders()` only, head `.p609sethead.favfolder-head[data-favhead678]` carrying `sectionMark659(folder.name)` in a `blockTone(name)` tile, name, and per shape below; body `.p659body` rows by the standing builders in standing order (doors · tracks · prayers). No folder head carries `data-p609sethead` / `data-p645secmenu` / `data-p615count` / `data-p615disc` (harness L1 asserts the absence). The dead `!count` empty-line branch retired with the re-dress (`favFolderEmptyLine` itself stands, uncalled by this paint). No new CSS.
- **§2.9 reading (i):** a folder with at least one playable descriptor takes the full head (disc · ⋮ · count); a doors-only folder (Favorite Podcasts · Favorite Novenas · a doors-only custom) takes mark · name · toggle only — no `data-favcount678` / `data-favdisc678` / `data-favsecmenu678` stands on its head. A mixed folder takes the full head; count and queue set cover its tracks only. Door rows untouched (tap → `goSeries`).
- **§2.4 count:** new `favUnplayedCount678(folderId)` — episode tracks via `starredDescFor` + `opnTrackUnplayed615`; podcast episodes via `favPodListenedOf` (never the descriptor's `listened` field); prayers via `prayerAudioDesc` + `opnTrackUnplayed615`; doors excluded from both numbers. `refreshPlayedChrome` gained the folder pass beside the v615 head pass: every `[data-favcount678]` recomputed from the stores, sibling `[data-favdisc678]` `all` class re-toggled; never snapshotted, never incremented.
- **§2.5 acts:** one builder `favFolderDescs678(folderId)`; queue set = `discQueue618(descs)`. Disc tap (`favFolderPlay678`): `startQueue(set, true)` then `state.queueFrom = 'starred'` + `saveQueueSnapshot()`, `stopPropagation` (never folds). ⋮ (`openFavSectionMenu678`): `openSheetMenu(folder.name, [Play · Play next · Add to queue])`, Play = the disc act, `playNextSet` / `addToQueueSet` over the same set; custom folders append Rename · Delete folder (the `openFavFolderMenu` acts). One builder refinement, named plainly: a podcast snapshot descriptor carries no `listened` field (§2.4.2's trap), and `discQueue618` reads `desc.listened` for the podcast kind — so `favFolderDescs678` stamps a copy of a podcast descriptor with `listened: favPodListenedOf(e)`; without the stamp a listened podcast episode would enter the group's queue set. No other descriptor is copied (episode descriptors stay the live `state.dayDescs` objects).
- **§2.6 accordion:** `favToggleCollapse` rewritten to the one-open discipline in `FAV_COLLAPSE_KEY` (opening F writes all others collapsed, F deleted; closing the open F writes all collapsed), via new paint read `favOpenFolderId678` (first non-collapsed visible folder open; virgin map opens the first visible folder only). Header menu: Expand all retired (`favExpandAll` lost its only caller and stands uncalled); Collapse all stands.
- **§2.2 all-empty line:** the page's all-empty text is now John's verbatim line: "No favorites yet — star any track to keep it here."
- **§2.8 page head:** the bar's `rightHtml` is `''`; the `#starred-playall` wiring retired. **`starredPlayAll` RETIRES** (function removed with its only caller; its act survives per-folder as `favFolderPlay678`). `starredPlayableDescs` and `starredAddAll` STAND.
- **§2.7 no-lag:** `paintFavoritesPage`'s standing wiring passes kept whole; no descriptor/listened/count state snapshotted into any folder cache; counts and sets build from the live stores at paint / refresh / tap time.
- **§2.10 pin:** `ui.ts` CACHE → `ora-pro-nobis-v678-1` (its one seat).

**Harness** — `app/worker/harness-v678.mjs` (playwright-core, real Worker bundle, API stubbed in-page; fixtures per §2.10: John's four podcast doors · Favorite Prayers = 3 book favorites with `audio.en` · Favorite Catechesis = Day 329/Day 330 podcast episodes from `app/tests/fixtures-v603/bible-folded.json`, Day 329 standing `listened:true`, plus one Novenas-block episode track standing live in `dayDescs` for the in-place day-store leg · one empty custom folder "Empty Shelf" · no novena doors · day payload 2026-11-25 Chicago):

- Built tree: **30 ok, 0 bad** — L1 · L2 · L3 · L4 · L5 (row-face + count halves, podcast leg included) · L6 · L7 all pass.
- Fail-on-old (v677 tree at `7f72a5f`, via `ORA_WT`): **7 ok, 23 bad** — L1, L3, L4, L6 fail as required; L5's row-face half passes and its count half fails; L2's absence half passes (standing v581 behavior) and its line-text half fails; L7's head-shape checks fail while its door-tap half passes (standing behavior).
- Regressions on the new tree: harness-v677 **18 ok, 0 bad**; harness-v676 **49 ok, 1 bad** — the one failure is harness-v676's own pin check (it expects `ora-pro-nobis-v676-1`; the tree now carries `ora-pro-nobis-v678-1`), a pin-string-only failure; the harness was not edited.

**Screenshots** (harness-written, visually verified by the Implement seat): `docs/releases/v678-screenshots/01-favorites-one-group-open.png` (Catechesis open, rows standing, Prayers + Podcasts closed) · `docs/releases/v678-screenshots/02-favorites-empty-group-absent.png` (populated cards standing, no Empty Shelf / Novenas card) · `docs/releases/v678-screenshots/03-favorites-door-card.png` (Favorite Podcasts card mark · name · toggle only, its four doors as rows).

**Deviations from the Plan:** one, named above in §2.5 — the podcast `listened` stamp inside `favFolderDescs678`, required for the §2.5 queue set to exclude a listened podcast episode (§2.4.2's trap applied to the queue consumer). No boundary (Scope OUT) surface was touched: `paintFavoritesFolderRow`, the star acts, row builders' contents/menus, the reorder paint, the vault-locked and web-pointer paints, and every other page stand unedited.

## §4 Review record (2026-11-25, Review seat, chain-v678) — RETURN

**Judged tree:** HEAD `82fd84938c0c6cbff1de9d7aeec17a3442bc8c15` on `release/v678` (commits `6c80b10` · `6b3d97b` · `82fd849` on base `c93d735`; diff base `7f72a5f`). Light review against the Plan; every check below ran on the Review seat's own evidence.

**Verdict: RETURN** — one named finding (F1), a harness defect only. All product-code checks pass; no Plan-forbidden surface was touched; the deviation is ruled acceptable. The repair is harness-only and must not change product code.

### Checks

1. **Harness (own runs).** harness-v678 on the judged tree: **29 ok / 1 bad in 5 of 6 runs; 30 ok / 0 bad in 1 of 6** — §3's "30 ok, 0 bad" does not reproduce (see F1). Fail-on-old via `ORA_WT` on a detached tree at `7f72a5f`: **7 ok / 23 bad**, exactly as required — L1, L3, L4, L6 fail; L5's row-face half passes and its count half fails; L2's absence half passes and its line-text half fails; L7's head-shape checks fail while its door-tap half passes. Regression harness-v677: **18 ok / 0 bad**. Regression harness-v676: **49 ok / 1 bad** — the single failure is its own pin-string check (expects `ora-pro-nobis-v676-1`); no other v676 leg fails. Confirmed acceptable.
2. **Attribute discipline (§2.11).** The `favFolderSectionHtml` emission (client.ts:13895–13925) carries only `data-favcard678` / `data-favhead678` / `data-favcount678` / `data-favdisc678` / `data-favsecmenu678` on folder cards/heads; `data-p609sethead` / `data-p645secmenu` / `data-p615count` / `data-p615disc` appear only at the standing Praylist seats (the `opnSetHtml609` emission and its wiring / `refreshPlayedChrome` block pass). Harness L1 also asserts the absence at runtime. PASS.
3. **Door reading (i).** A doors-only head emits mark · name · toggle only — the full-head branch is gated on `favFolderDescs678(folder.id).length > 0`, so no count/disc/menu attribute stands on it (code read + harness L7 + screenshot 03). `favDoorRowHtml` is untouched as a function: its only diff appearances are the call site moving inside the re-dressed builder (`doors.map(favDoorRowHtml)`). Door tap → `goSeries` proven by harness L7 (`state.podcasts.series = the-ai-signal`). PASS.
4. **Deviation ruling — ACCEPTABLE.** `favFolderDescs678` (client.ts:13862) stamps a copy only for `e.k === 'podcast'`: `Object.assign({}, desc, { listened: favPodListenedOf(e) })`. (a) Episode descriptors are not copied — they pass through as the live `starredDescFor` objects. (b) The copy is built fresh at call time and never cached or stored; its only consumers are the disc/menu queue builds at tap time (the paint call site reads only the array's length to choose the head shape — the stamp's value is never painted). (c) Without it, `discQueue618` → `opnTrackUnplayed615` reads `desc.listened` for the podcast kind, a snapshot descriptor carries no such field, and a listened podcast episode would wrongly enter the group queue set; harness L4's Catechesis legs prove the listened Day 329 is excluded with the stamp standing. The stamp is exactly §2.4.2's trap closed at the §2.5 consumer. ACCEPTED under Plan §2.4.2 + §2.7.
5. **Q2 verbatim.** The all-empty line in `paintFavoritesPage` reads exactly "No favorites yet — star any track to keep it here." (also proven by harness L2 on the new tree and by its failure with the old text on the old tree). The page paints `favVisibleFolders().map(favFolderSectionHtml)` only. PASS.
6. **Q4.** The bar call carries `rightHtml: ''` with back arrow + "Favorites" title; no `#starred-playall` element or wiring stands (harness L6 + grep: remaining mentions are comments only). `starredPlayAll` is retired (function removed, per §3's named choice). `starredPlayableDescs` and `starredAddAll` stand, and `starredAddAll`'s universal-menu caller ("Add all to queue", client.ts:16908) is intact. PASS.
7. **Boundaries.** `git diff 7f72a5f..HEAD` touches only `client.ts` (7 hunks: collapse/accordion seat · section builder + new §2.4/§2.5 functions · `paintFavoritesPage` · `refreshPlayedChrome` folder pass · header menu), `ui.ts` (the pin only), the new harness, the release doc, and the screenshots. No edits in `paintFavoritesFolderRow`, the star acts, any row builder's contents/menus, the reorder paint, the vault-locked / web-pointer paints, or any other page. Pin: `ui.ts` CACHE reads `ora-pro-nobis-v678-1`, the diff's only `ui.ts` change. PASS.
8. **Screenshots.** Opened all three: 01 — Catechesis open, its three rows standing (Day 329 carrying the listened face), count 2, Prayers closed at 3, Podcasts door card closed; 02 — Prayers open with its three rows, populated cards standing, no Empty Shelf / Novenas card anywhere; 03 — Favorite Podcasts head carries mark · name · toggle only (no disc / ⋮ / count) with its four doors as rows. All match §3's claims. PASS.
9. **Accordion (§2.6).** `favToggleCollapse` writes the one-open map in `FAV_COLLAPSE_KEY` (opening F: every other folder = 1, F deleted; closing the open F: every folder = 1) and repaints via `paintFavoritesSurfaces()`; `favOpenFolderId678` reads the first non-collapsed visible folder open, and a virgin map opens the first visible folder only (harness L3 proves all four movements). Expand all has no caller left (`favExpandAll` stands defined, uncalled; its header-menu item is removed in the diff); Collapse all stands with its caller. PASS.

### Finding

- **F1 — harness-v678's L4 Prayers-disc leg is non-deterministic; §3's 30/0 tally does not reproduce.** Root cause, proven by an instrumented probe run by this seat: synchronously after the disc click, `state.queue` is exactly `['prayer:hp1:en', 'prayer:hp2:en', 'prayer:hp3:en']` with `queueFrom === 'starred'` and current = hp1 — the §2.5.1 act is correct. The fixture's prayer audio cannot play in the harness (the book fixture carries `audio: { en: 300 }`, no playable URL), so the standing engine auto-advances through all three tracks and the terminal queue clear empties `state.queue` and nulls `queueFrom` within ~250 ms — before the harness's fixed 350 ms post-click wait reads it. Whether the leg passes is a race between media-error timing and that read (1 pass in 6 Review runs). **Repair (harness only):** make the L4 Prayers-disc assertion read the queue synchronously with the click (the same evaluate that clicks), or give the fixture prayers playable/stubbed audio so the queue stands at read time; then re-run and record a stable 30 ok / 0 bad on the judged tree. No product-code change is needed or permitted for this finding — `favFolderPlay678`, `favFolderDescs678`, and `discQueue618` were each verified correct by direct call and by the synchronous probe.

### §4 addendum — F1 repair (2026-11-25, Repair seat, chain-v678)

- **Repair shape chosen:** the synchronous-capture shape (the brief's preferred option) — the L4 legs whose act starts playback now read the queue in the SAME JS evaluation that performs the click (`clickAndCaptureQueue` / `clickMenuItemAndCaptureQueue` in the harness), before any engine advance can clear it. Chosen over stubbing playable fixture audio because it changes no fixture and no production shape: the assertion still reads the real `state.queue` / `state.queueFrom` the product act itself wrote, exactly as Review's instrumented probe did. The assertions are NOT weakened: the Prayers leg still requires the queue to be exactly `['prayer:hp1:en', 'prayer:hp2:en', 'prayer:hp3:en']` with `queueFrom === 'starred'`, and the Play next leg still requires exactly the Catechesis unplayed set.
- **Same-hazard sweep:** every other post-click queue read in the harness was checked for the race shape (a fixed-delay read of queue state after a click whose act starts playback on unplayable fixture audio). One more leg carried it: **L4 Catechesis Play next** — with the queue emptied and no current standing, `playNextSet` falls back to `startQueue(set, true)`, starting playback of the set (Day 330's remote URL + the `example.invalid` episode URL), so its 350 ms-delayed read raced the same auto-advance/clear. The same synchronous-capture repair was applied to it. The L4 Catechesis **Add to queue** leg carries no hazard — `addToQueueSet` never starts playback (its no-standing-queue fallback assigns the queue directly) — and keeps its standing read. No other leg reads queue state after a click.
- **Files changed:** `app/worker/harness-v678.mjs` only, plus this doc. No product code changed.
- **Proof — built tree (judged tree + this harness repair), 3 consecutive runs:** harness-v678 **30 ok / 0 bad** · **30 ok / 0 bad** · **30 ok / 0 bad**.
- **Proof — fail-on-old:** `ORA_WT` at `7f72a5f` (detached tree), one run: **7 ok / 23 bad** — the required failures stand unchanged (L1, L3, L4, L6 fail; L5's row-face half passes, its count half fails; L2's absence half passes, its line-text half fails; L7's head-shape checks fail, its door-tap half passes).

### §4 closing — re-review (2026-11-25, Re-review seat, chain-v678)

- **F1 CLOSED.** The repair (commit `0952bed`) is confirmed: the L4 Prayers-disc and Catechesis Play-next legs capture the queue synchronously in the same evaluation as the click; the race with the playback engine's auto-advance clear is removed.
- **Product tree unchanged from the judged tree.** `git diff 82fd849..HEAD --stat` touches ONLY `app/worker/harness-v678.mjs` and this release doc. Full-tree hash comparison (`git ls-tree -r` at `82fd849` vs HEAD): 2,342 files on each side, exactly 2 blob hashes differ — the harness and this doc; all 2,340 other files are byte-identical, including `app/worker/src/client.ts` (blob `07fd4f1668c9064010394b6f92f39bdfbfba7510`), `app/worker/src/index.ts` (blob `205f6597cf5a8dcbb313004a30d71025f1c5c4ca`), and `app/worker/src/ui.ts` (blob `11d6006014d14a6845ff3512a5b22d090ab3103d`).
- **Assertions not weakened.** Harness diff read: the Prayers leg still requires exactly `['prayer:hp1:en', 'prayer:hp2:en', 'prayer:hp3:en']` with `queueFrom === 'starred'`; the Catechesis Play-next leg still requires exactly the Catechesis unplayed set (`[E330.key, 'fav-ep-nov']`, sorted). Only the read timing changed — the values asserted are the product act's own `state.queue` / `state.queueFrom`.
- **Own runs — built tree:** harness-v678 run twice consecutively by this seat: **30 ok / 0 bad** · **30 ok / 0 bad**.
- **Own run — fail-on-old:** `ORA_WT` at `7f72a5f`, one run: **7 ok / 23 bad** — the required failures stand (L1, L3, L4, L6 fail; L5's row-face half passes, its count half fails; L2's absence half passes, its line-text half fails; L7's head-shape checks fail, its door-tap half passes).
- **Final judged HEAD:** `0952bedb75f83559c30c1a2d4c9996efab7718f3` on `release/v678` — product-identical to the §4-judged tree `82fd849`.
- **Verdict: PASS.**

## §5 Ship record (chain-v678, 2026-11-26) — LIVE

Review PASS (§4 closing, judged tree `0952bed` — product-identical to `82fd849`; branch head `08f355e` adds only the §4 closing doc commit). Run level: To Ship.

- **Merge:** release/v678 → main, tree-exact via the Git Data API (push-v678-github.py). Local merge `fbc6703` over v677 main `7f72a5f`; product paths asserted against the judged tree `0952bed` before anything moved (client.ts `07fd4f1668c9064010394b6f92f39bdfbfba7510` · index.ts `205f6597cf5a8dcbb313004a30d71025f1c5c4ca` · ui.ts `11d6006014d14a6845ff3512a5b22d090ab3103d`); remote-vs-base delta empty (remote main `6647588` tree == local base tree `6465d87` — no runner commits to reconcile, nothing dropped, no force-push). Remote ship commit **0c05fbba3c4650647b1a12807bed0e2e879db32d**, tree **876215b3592d3b9066646052fab67f5d4858b64d**; local mirror `ed83a404`, same tree. Read-back: **main pushed · remote in sync**.
- **Harness at the merged tree:** `harness-v678: 30 ok, 0 bad` (standing clone, merged main) — matches the built-tree tally.
- **Deploy:** deploy-app-v678-ship.py with EXPECTED_HEAD filled to the merged main head (`ed83a404`); dry-run → deploy clean. Worker **2ed6132d-8023-4744-817f-19d4b1e6df65**, pin **ora-pro-nobis-v678-1**. Production verification: the served sw.js (app.orapronobis.media) reads pin ora-pro-nobis-v678-1 (×1, the only pin served); the served app.js carries the dress markers (`favFolderSectionHtml` ×4 · `data-favcount678` ×3 · `data-favdisc678` ×4 · `data-favsecmenu678` ×3 · `favUnplayedCount678` ×3). No APK, no migration.
- **Board closeout (D1-direct, all read back):** release 1656 → Live, shipped_at 2026-11-26T03:33:28Z, whats_new_id 493 · What's New **493** ("Favorites wear the Praylist dress now") · shipped_records **867** · phase records: Implement **2814** passed · Review **2815** passed · Ship **2816** passed (commit_hash = the remote ship commit 0c05fbb). Goals Board intake 1285 → Done, state line CLOSED.
- **Rollback:** pin ora-pro-nobis-v677-1 (Worker a895f5c5-24d2-4c1f-98ea-97f338224fa3), the v677 driver (`~/workspace/.tools/deploy-app-v677-ship.py`) untouched.
