# v712 — Stations of the Cross: the Add-branch door opens an empty screen

- **Direction:** fix-forward for the v710 Stations branch in the Add ladder — the branch leaf paints, its door opens nothing.
- **Plan seat:** chain-v712-plan · **Base:** origin/main `8280a77` (v710 ship head; merge `b8f1211`, pin `ora-pro-nobis-v710-1`)
- **Scope:** §§1–2 only at this seat. No code is changed by Plan.

## §1 Scope / grounding

### §1.1 The defect

- Path: Add to a block → Catechesis → Stations of the Cross → **"Stations of the Cross · Fridays"** opens an **EMPTY screen** — no gold card, no episode rows, no note line. The only controls are Back / Close.
- The branch itself stands and paints: root → `br:catechesis` → `lf:stations` all render their doors. The failure is at the last hop only — the leaf door's target rung renders `''`.

### §1.2 Verified diagnosis (all anchors read firsthand in this tree, `app/worker/src/client.ts` unless named)

- **The door:** `listHtml`, the `lf:stations` arm (client.ts:28523): `doors614([['daily:stations-of-the-cross', 'Stations of the Cross · Fridays', 'The Way of the Cross of Saint Alphonsus Liguori', 'Daily']])`. The v710 B4 door is keyed with the **`daily:` prefix**. A tap sets `rung = 'daily:stations-of-the-cross'` (the standing door-tap wire in `wireList`: `rung = row.getAttribute('data-p603door')`) and repaints through `listHtml()`.
- **The missing arm:** `listHtml` (client.ts:28469) dispatches, in order, `series:` (28515), `course:`, `vmass:`, `vmass-audio:`, `novena:`, `prayers:` — and has **no `daily:` arm**. The rung falls through every arm to the final `return '';` (client.ts:28533). That fall-through IS the empty screen. No error is thrown; nothing logs.
- **Back is broken the same way:** `parentOf614` (client.ts:28534) has arms for `br:`, `prayers:`, `course:`, `series:`, `novena:`, `vmass:`, `vmass-audio:` and the named `lf:*` leaves — **no `daily:` arm**. A `daily:` rung's parent falls to the final `return 'root'`, so even if the node painted, Back would abandon the branch to the root instead of returning to `lf:stations`.
- **The search pill is wrong the same way:** `isEpisodeNode614` (client.ts:28549) = `series:` ‖ `course:` ‖ `novena:` ‖ `vmass:` — no `daily:`. A `daily:` node would paint the generic "Search" placeholder instead of "Search episodes", and `paintList` would never correct it.
- **The node that should serve it already exists and already handles this key:** `seriesNode614(series)` (client.ts:28365):
  - `fetchSeries614(series)` (client.ts:28206) fetches `/api/player/podcasts?series=<key>` once, caches in `pay614`, repaints on arrival; `loading` / `failed` / non-array payloads each paint their standing note.
  - For `stations-of-the-cross` it takes the generic path (not the `daily-gospel-exegesis` / `daily-readings` special nodes): payload `kind` is not `'video'`, `entries` is an array, so it paints `dailyRow614(series)` followed by one `epItem614` episode row per entry, in payload order.
  - `dailyRow614('stations-of-the-cross')` (client.ts:28166) does NOT return `''`: the gold-card gate `opnDailyKeyOk666` (client.ts:2862) passes because `OPN_DAILY_SERIES_666` (client.ts:2861) already carries `stations-of-the-cross` (v710 B2), and `opnDailySeriesTitle666` (client.ts:2877) maps it to `Stations of the Cross`. The gold card therefore paints through the standing `rowHtml` `daily666` arm as `data-p603additem="daily:stations-of-the-cross"`, label `Stations of the Cross · Daily`, with the standing seat-twin / Already-in discipline untouched.
  - **Proof the key serves today through another door:** the v710 server def (below) puts `stations-of-the-cross` in the series list, so `lf:podcasts` already offers a `series:stations-of-the-cross` door into this same node, and that path paints. The data path is not in question; only the `daily:` rung family has no dispatch.
- **Server side is healthy — nothing server-side moves:** `app/worker/src/index.ts:4336` carries the v710 B1 def `{ key: "stations-of-the-cross", title: "Stations of the Cross", feedUrl: ownFeedUrl, window: 500, titlePrefix: "Stations of the Cross" }`; the contents-validation twin carries the key (index.ts:1520); the app D1 `rss_snapshots` row for `stations-of-the-cross` carries the corrected 2026-11-27 episode (`Stations of the Cross - November 27, 2026 (corrected)`, key `stations-of-the-cross-2026-11-27::97236258…`, verified live at v710 Review §4). The snapshot payload shape is the standing RSS shape `seriesNode614` already consumes for every `series:` door: `{ entries: [{ key, title, label, publishedMs, url, durationS, … }] }`.

### §1.3 What does NOT move

- **The v710 resolver:** `resolveDailyDynamic666`, the `opnDailyMatch666` stations arm, the B3 descriptor (title as-is, `daily666` dress, staged `textUrl`) — untouched. A Praylist that already holds the dynamic Stations item resolves and plays exactly as shipped.
- **The pictured Read view:** the `openRead` Stations branch (`t.dailySeries === 'stations-of-the-cross'`, 14 station images above their sections) — untouched.
- **The B4 fridays stamp:** the Add handler arm at client.ts:28593, `if (kp[0] === 'daily' && itemA.key === 'stations-of-the-cross') itemA.dayRule = 'fridays';` — untouched, and §2's shape is chosen so it keeps firing (§2.2).
- **The Prayer Book item:** the `prayer:stations-of-the-cross` stamp (client.ts:28591) and the `prayer_book` row it adds (migration 0053) — untouched. It is a different item from the dynamic daily item and keeps its own Add path.
- **The branch shape:** Catechesis → Stations of the Cross (`lf:stations`) → the Fridays door — the door's key, label, sub, and `Daily` mark all stand exactly as v710 shipped them.
- **Server code, D1, the fork, production:** no change anywhere outside the Add ladder's client dispatch.

## §2 Plan

### §2.1 Shape picked — (a): add the missing `daily:` dispatch

Make `daily:` a real rung family in the Add ladder, delegating to the standing series node — the same delegation every other prefixed family already uses (`series:` → `seriesNode614`, `course:` → `courseNode614`, `novena:` → `novenaSeriesNode614`, `vmass:` → `videoNode656`). Three one-line arms, all in `app/worker/src/client.ts`, all inside `openAddLadder603`:

1. **`listHtml`** — beside the `series:` arm (client.ts:28515):
   `if (rung.indexOf('daily:') === 0) return seriesNode614(rung.slice('daily:'.length));`
   `seriesNode614` serves the key **as-is** (§1.2): no change to `seriesNode614`, `fetchSeries614`, or `dailyRow614` is needed or permitted. On first open the node paints its standing `Loading …` note and repaints when `fetchSeries614` lands — the standing async discipline of every series node.
2. **`parentOf614`** — beside the `series:` arm (client.ts:28545):
   `if (r.indexOf('daily:') === 0) return 'lf:stations';`
   `lf:stations` is the only `daily:` door's home today, and it is the branch-correct parent: Back from the Stations node lands on the Stations leaf, whose own Back already returns `br:catechesis` under the standing `lf:` arm. If a second `daily:` door ever stands, this arm is revisited then — it is not generalized speculatively now.
3. **`isEpisodeNode614`** (client.ts:28549) — add `|| rung.indexOf('daily:') === 0`:
   the node IS an episode node (gold card + episode rows, query narrowing via `matchItem` inside `seriesNode614`), so the search pill reads "Search episodes" at paint and in `paintList`, exactly as for `series:` / `course:` / `novena:` / `vmass:` nodes.

No other seat changes. The CACHE pin bump is the standing release act (Ship), not a fix seat.

### §2.2 The trade, named — and why (b) loses

- **Trade of (a):** the ladder gains a fourth node-prefix family whose parent is, today, a single leaf. `daily:` becomes a dispatch convention, not just an item kind — a future `daily:` door anywhere else must give `parentOf614` its own home or inherit `lf:stations` wrongly. That cost is accepted: it is one named arm, visible at the dispatch seat, and it is the same shape-debt every other family already carries (the homilies' `series:` parent is likewise special-cased inside the `series:` arm).
- **Why not (b) — re-key the door to `series:stations-of-the-cross`:**
  - **Back needs a special case anyway.** The standing `series:` parent arm returns `lf:homilies` only for the two homily series and `lf:podcasts` for everything else — a stations `series:` door would land Back on **Podcasts**, out of the Catechesis → Stations branch entirely, unless `parentOf614` grows a stations special-case. (b) therefore saves no arm; it spends the same special-case in a less honest seat.
  - **It duplicates a door that already stands.** `lf:podcasts` already lists `series:stations-of-the-cross` from the series list (§1.2). Re-keying makes the Catechesis → Stations leaf a second, identical entrance to the Podcasts-shaped node and erases the branch distinction v710 built (Stations as a Catechesis leaf with a `Daily`-marked Fridays door, not a podcast series).
  - **The B4 stamp, checked honestly:** re-keying the DOOR alone would not by itself break the fridays stamp — the gold card's add id is minted by `rowHtml`'s `daily666` arm as `daily:stations-of-the-cross` regardless of the rung prefix, so the stamp at client.ts:28593 would still fire on a gold-card tap. (b) is NOT rejected on a false stamp claim. It is rejected on Back + duplication + branch loss, above — and on the standing risk that a `series:`-keyed stations identity invites a future seat to treat the item as a plain series and lose the daily stamp then.
- **Under (a), the stamp is preserved by construction:** the door key, the gold card's add id (`daily:stations-of-the-cross`), and the stamp's condition (`kp[0] === 'daily' && key === 'stations-of-the-cross'`) all stay byte-identical to v710. Adding the gold card from the repaired node stamps `dayRule: 'fridays'` exactly as B4 prescribes, and episode rows add as plain `episode:` items, as in every series node.

### §2.3 Harness — `harness-v712.mjs` (in `app/worker/`, sibling conventions)

Follows `harness-v710.mjs`'s conventions: plain `node`, `check(name, cond)` tally with `ok / bad` summary and non-zero exit on any bad, `ORA_WT` override for the fail-on-old run, fixtures named at the head. Because the ladder's functions are closures inside `openAddLadder603`, the harness slices the contiguous inner-function block (`dailyRow614` through `isEpisodeNode614`, by the standing slice-by-name extraction) and evals it with stubbed seams only: `host` (`ids()` → `[]`, `groups()` → `[]`), `state` (`dayPayload`/`novenasCatalog` null), `api` (never reached — `pay614` is pre-seeded, below), `esc`, `sectionMark659`, and the `opn*` title/gate functions sliced from the same file. `rung` and `query` are harness-owned variables, set exactly as the wire sets them.

- **Fixture (Improvement D — from production, not invented):** the `stations-of-the-cross` series payload in the standing snapshot shape, its entry derived from the real D1 `rss_snapshots` `stations-of-the-cross` payload: the corrected 2026-11-27 episode — key `stations-of-the-cross-2026-11-27::97236258…`, title `Stations of the Cross - November 27, 2026 (corrected)`, label `Nov 27, 2026` (the v710 §3.3/§4 live-verified entry). `pay614['stations-of-the-cross']` is pre-seeded with it so `fetchSeries614` returns it synchronously; `opnLadderSeries603` carries `{ series: 'stations-of-the-cross', title: 'Stations of the Cross' }` as the live series list does.
- **The drive is the REAL navigation** — the harness calls the real `listHtml()` at each rung, taking each next rung from the `data-p603door` value the previous paint actually emitted (never a hand-typed rung the app did not produce):
  1. `rung = 'root'` → paint carries the `br:catechesis` door; take it.
  2. `rung = 'br:catechesis'` → paint carries the `lf:stations` door; take it.
  3. `rung = 'lf:stations'` → paint carries exactly one door, `data-p603door="daily:stations-of-the-cross"`, label `Stations of the Cross · Fridays`; take it.
  4. `rung = 'daily:stations-of-the-cross'` → **the node paint under test.**
- **Assertions on the step-4 paint:**
  - Non-empty (the defect leg): `listHtml() !== ''`.
  - **Gold dynamic card paints:** the paint contains the `p666daily` card with `data-p603additem="daily:stations-of-the-cross"` and the label `Stations of the Cross · Daily`.
  - **The Nov 27 episode row paints:** the paint contains an episode row with `data-p603additem="episode:stations-of-the-cross|stations-of-the-cross-2026-11-27::…"` and the corrected title `Stations of the Cross - November 27, 2026 (corrected)`.
  - **Back:** `parentOf614('daily:stations-of-the-cross') === 'lf:stations'`, and `parentOf614('lf:stations') === 'br:catechesis'` (the full Back chain home).
  - **Search pill:** at the `daily:` rung, `isEpisodeNode614()` is true.
  - **Stamp preserved:** parsing the gold card's add id as the handler does (`kp = id.split(':')`) yields `kp[0] === 'daily'` and key `stations-of-the-cross` — the exact condition of the standing B4 stamp at client.ts:28593 (plus a source check that the stamp line stands unmoved).
- **Fail-on-old (mandatory):** the same harness run against the v710 tree (`ORA_WT` at `8280a77`) must FAIL — specifically the step-4 legs: `listHtml()` at `daily:stations-of-the-cross` returns `''` there, the gold card and episode row are absent, and `parentOf614` returns `'root'`. The empty paint is reproduced, not merely asserted around. The fail-on-old tally is recorded in §3 beside the built-tree tally.

### §2.4 Regression list

- **harness-v710:** stands at **21 ok / 0 bad** on this base (re-run firsthand by this seat) — must stand identical on the built tree. Its ladder legs (B4 stamp source check, closed set, series def) read the seats §2 does not move; any red is a v712 defect.
- **harness-v666:** standing tally **64 ok / 0 not-ok**, but the harness **cannot execute on this base** — re-verified firsthand by this seat: its five fixture checks pass, then it aborts at load in its own `stripServerValidate` (`harness-v666.mjs:131`, `server validate shape moved: function validateProfileContents…`), the identical pre-existing rot recorded at v705 §3.5/§4.3 and carried at v706. Prescription: Implement runs it; the **identical** abort on the built tree = unre-proven, not regressed, and is recorded as such; any *different* failure is a v712 red. Harness-strip repair is NOT a v712 seat.
- No other harness is prescribed: the change is confined to three arms inside one closure, and the v712 harness drives that closure's real navigation end to end.

## §3 Implement record

- **Implement seat:** chain-v712-impl · **Base:** Plan `650afda` on `release/v712`.

### §3.1 Changes — shape (a) exactly as §2.1 prescribes, all in `app/worker/src/client.ts`, all inside `openAddLadder603` (commit `1dbf1f9`)

1. **`listHtml` — client.ts:28516** (directly beside the `series:` arm at 28515): added `if (rung.indexOf('daily:') === 0) return seriesNode614(rung.slice('daily:'.length));` — the `daily:` rung delegates to the standing series node, key as-is. No change to `seriesNode614`, `fetchSeries614`, or `dailyRow614`.
2. **`parentOf614` — client.ts:28544** (directly beside the `series:` arm at 28543): added `if (r.indexOf('daily:') === 0) return 'lf:stations';`
3. **`isEpisodeNode614` — client.ts:28551**: added `|| rung.indexOf('daily:') === 0` to the standing return, so the search pill reads "Search episodes" at the `daily:` node at paint and in `paintList`.

- **Nothing else moves (verified by the diff: 3 insertions, 1 modified line — the `isEpisodeNode614` line):** the v710 resolver, the pictured Read view, the B4 fridays stamp at the Add handler (client.ts:28595 post-change, byte-identical — harness leg T2), and the Prayer Book item all stand untouched. No server code, no CACHE pin change (the pin bump is the Ship act).

### §3.2 Harness — `app/worker/harness-v712.mjs` (commit `5edfd3e`)

- Per §2.3: plain `node`, `check()` tally, `ORA_WT` override. Slices the contiguous inner-function block (`isOn` through `isEpisodeNode614`, carrying `dailyRow614` … `listHtml`, `parentOf614`, `isEpisodeNode614`) from the real `client.ts` and evals it with stubbed seams only (`host` ids/groups → `[]`, `state` dayPayload/novenasCatalog null, `api` never reached — `pay614` pre-seeded, `esc`/`sectionMark659`/opn* title-gate functions sliced from the same file). `rung`/`query` are harness-owned, set exactly as the wire sets them.
- **Fixture (Improvement D):** the `stations-of-the-cross` payload in the standing snapshot shape, entry derived from the real D1 `rss_snapshots` entry — key `stations-of-the-cross-2026-11-27::97236258…` (prefix as recorded at v710 §3.3/§4; the harness asserts on that prefix), title `Stations of the Cross - November 27, 2026 (corrected)`, label `Nov 27, 2026`.
- **Drive:** the REAL navigation — `root` → door taken from the paint (`br:catechesis`) → door taken from the paint (`lf:stations`) → the paint's exactly-one door (`daily:stations-of-the-cross`) → the node paint under test.
- **Built-tree tally: 14 ok / 0 bad.** All legs pass: slice sanity, N1–N3 door chain taken from the paints, N3b Fridays label, N4 non-empty paint, N4a gold card (`p666daily`, `data-p603additem="daily:stations-of-the-cross"`), N4b `Stations of the Cross · Daily` label, N4c Nov 27 corrected episode row, B1/B2 full Back chain (`daily:` → `lf:stations` → `br:catechesis`), P1 episode-node pill, T1 stamp condition parsed from the gold card's add id exactly as the handler parses it, T2 B4 stamp source line unmoved.

### §3.3 Fail-on-old — REPRODUCED

- Same harness run with `ORA_WT` at a pristine worktree of `8280a77` (v710 tree, base = origin/main): **7 ok / 7 bad, exit 1**. The defect legs fail exactly as §2.3 prescribes: `listHtml()` at `daily:stations-of-the-cross` returns `''` (the empty paint reproduced, not asserted around), the gold card and episode row are absent, `parentOf614` returns `'root'`, the pill leg and the stamp-parse leg fail with it. The branch legs (N1–N3, B2, T2) pass on the old tree, as they should — the branch stood; only the last hop was empty.

### §3.4 Regressions

- **harness-v710: 21 ok / 0 bad** on the built tree — identical to its base tally. No red.
- **harness-v666: unre-proven, not regressed.** It runs its five fixture checks (5 ok), then aborts at load in its own `stripServerValidate` (`harness-v666.mjs:131`, `server validate shape moved: function validateProfileContents…`) — the identical pre-existing abort recorded at v705 §3.5/§4.3 and carried at v706/v712 Plan §2.4. No different failure appeared.
- **Typecheck/build:** no `package.json` or `tsconfig` exists in `app/worker` or at the repo root — sibling releases define no typecheck/build script for this seat, so none was run; the harness's slice-eval parses and executes the changed functions from the real source.

### §3.5 Commits on `release/v712`

- `1dbf1f9` — the three `daily:` arms in `app/worker/src/client.ts`.
- `5edfd3e` — `app/worker/harness-v712.mjs`.
- This §3 record — the doc commit following.

## §4 Review verdict — PASS

- **Review seat:** chain-v712-review (light Review) · Independent re-verification; §3 claims not trusted, all legs re-run firsthand.

### §4.1 Diff read — exact

- `git diff 8280a77..HEAD -- app/worker/src/client.ts`: 3 insertions + 1 modified line, nothing else. The three arms of shape (a), all inside `openAddLadder603`:
  1. `listHtml` (client.ts:28516, beside the `series:` arm): `if (rung.indexOf('daily:') === 0) return seriesNode614(rung.slice('daily:'.length));`
  2. `parentOf614` (client.ts:28544, beside the `series:` arm): `if (r.indexOf('daily:') === 0) return 'lf:stations';`
  3. `isEpisodeNode614` (client.ts:28551): standing return gains `|| rung.indexOf('daily:') === 0` — the only modified line.
- Nothing else moved: the v710 resolver, the pictured Read view, the B4 fridays stamp (client.ts:28595, byte-identical in the diff — absent from it), and the Prayer Book item all stand untouched. Full-range stat: only `client.ts` (the arms), `harness-v712.mjs` (new), and this doc change.

### §4.2 Harness re-runs — Review's own tallies

- **harness-v712 (built tree): 14 ok / 0 bad, exit 0** — identical to §3.2.
- **harness-v710 (built tree): 21 ok / 0 bad, exit 0** — identical to base; no regression.
- **Fail-on-old reproduced firsthand:** pristine worktree of `8280a77` created under `/tmp`, `ORA_WT` pointed at it — **7 ok / 7 bad, exit 1**. Defect legs fail exactly as prescribed: `listHtml()` at `daily:stations-of-the-cross` returns `''`, gold card and episode row absent, `parentOf614` returns `'root'`, pill and stamp-parse legs fail; branch legs (N1–N3, B2, T2) pass on the old tree. Temp worktree removed after the run.
- **harness-v666:** identical pre-existing abort in its own `stripServerValidate` (`harness-v666.mjs:131`, `server validate shape moved: function validateProfileContents…`) — unre-proven, not regressed, as §3.4 records. No different failure.

### §4.3 Sanity — no misroute, Podcasts door intact

- **No other `daily:`-keyed door exists:** grep of `doors614` producers in `client.ts` — the sole `daily:` door key in the client is the `lf:stations` arm (client.ts:28524, `daily:stations-of-the-cross`). Every other `daily:` occurrence is an item add-id (`data-p603additem="daily:…"` minted by `dailyRow614`), not a rung — a tap on those adds an item, it never sets `rung`. The new `parentOf614` `daily:` → `lf:stations` arm therefore cannot misroute any other door.
- **`series:stations-of-the-cross` door intact:** the `lf:podcasts` arm (client.ts:28511–28514) still maps `opnLadderSeries603` to `series:` doors, the `series:` dispatch (client.ts:28515) still delegates to `seriesNode614`, and the `series:` parent arm still returns `lf:podcasts` for stations (not a homily key) — all three lines stand unchanged in the diff (context only).

### §4.4 Verdict

- **PASS.** No defects named. The change is exactly §2.1 shape (a); the defect is fixed on the built tree and reproduced on the old tree; v710 stands unregressed. Ready for Ship (CACHE pin bump remains the Ship act, per §2.1/§3.1).
