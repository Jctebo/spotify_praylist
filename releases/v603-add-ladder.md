# v603 — Add becomes a ladder: kinds, categories, prayers, search

## §1 Scope

John's direction (Ora thread, 2026-11-21 17:47–17:49 CT):
revamp the contents ADD act into a LADDER on the app's
standing ladder pattern — kind doors first, Prayers
descending categories → prayers — with search that
follows the ladder ("Search all or drill as search"), and
the doors following the existing app layout.

Approved (John, 2026-11-21 18:04 CT; formal Scope Space
approval record 42, package 86 — the two agree exactly),
run level STOP BEFORE SHIP:

- Q1 doors, in order: Courses · Prayers · Novenas ·
  Sources. A door that cannot add to the block being
  edited does not stand (the Novenas door stands only
  for the Novenas block).
- Q2 search: one search pill at the top of EVERY rung —
  from the head it searches ALL addable items, matches
  grouped by kind with the rung path named; inside a
  door/category it narrows that rung only; clearing
  restores the rung's full list.
- Q3 an item already in the block shows marked
  "Already in <block>", not tappable — no duplicates
  ever written.
- Q4 a pick returns to the editor (Edit profiles: the
  profile draft · Edit today: the v600 today draft);
  adding another is a fresh Add tap.
- Q5 STOP BEFORE SHIP — at Review the chain brings
  driven renders of every rung; nothing deploys until
  John's Ship word (his Q5 comment: "How would I see
  it?").

Courses return through the Add path only — a named
reversal of v597's contents-system removal, scoped:
the validators re-open for hand-added course items and
the course resolver is restored, while v597's defaults
rule stands whole (designed defaults + Reset carry no
courses; a course stands only in an explicit contents
entry a hand add created; courses never route through
opnStandingContents597).

No data change to John's profiles (his document carries
no course items; nothing migrates). Both editors get the
ladder; the two flat pickers retire into it.

## §2 Plan

### 2.1 The ladder (client.ts, one builder, two hosts)

One ladder builder, `openAddLadder603(block, host)`,
replaces `openAddPicker` (Edit profiles) and
`openAddPickerT` (Edit today). The host supplies exactly
three things: the block's current item list (profiles:
`d.contents[block]` via materialize-state · today:
`effList(block)`), the add act (profiles:
`materialize(d, block).push(item)` + `repaint()` ·
today: `materializeT(block).push(item)` +
`afterEdit(null)`), and the seat-posture layers (profiles:
`d.layers` · today: `td.layers`). Everything else — the
rungs, the search, the already-standing marks — is the
one builder, so the two editors can never drift.

The ladder is a `.sheet.profadd591` sheet (the standing
Add sheet's class, so its dress and drawer behavior
stand) with rung state held in the builder:

- RUNG 0 — DOORS. One `.searchpill` (the standing dress,
  ui.ts) + door rows in the Configure ladder's own shape
  (`.card.bookrow`, `.row` / `.grow` title + `.meta` › +
  `.sub` line — the `openConfigureLadder593` pattern):
  Courses ("A course's next episode, by your progress")
  · Prayers ("The prayer book, by category") · Novenas
  ("One novena, or every active novena" — Novenas block
  only) · Sources ("This block's own sources"). A door
  whose kind cannot add to the block does not stand:
  Novenas only for the Novenas block; Courses, Prayers,
  Sources never for the Novenas block (its contents
  admit novena selectors only — the standing validator
  shape).
- RUNG 'courses' — the four course keys as rows
  (catechism-in-a-year · bible-in-a-year ·
  rosary-in-a-year · summa-in-a-year), titled from the
  podcasts index seriesList where it names them.
- RUNG 'prayers' — the book's CATEGORIES as door rows
  (the served groups, kept whole — §2.3), each with its
  count; RUNG 'prayers:<group>' — that group's prayers.
- RUNG 'novenas' — "Every active novena" first (the
  all-novenas item), then the novenas catalog
  (`/api/player/podcasts?series=novenas`, the v577
  source) in its served order, each row a
  `novena:<slug>` item.
- RUNG 'sources' — the block's standing sources from
  `profContentsUniverse590(block)` (source items only),
  with the readings seat under its standing posture
  guard (`opnSeatPosture597`, exactly as both pickers
  apply it today).

SEARCH (Q2): the pill stands at the top of every rung.
At rung 0 a query searches ALL addable items (courses ·
prayers across all groups · novenas where the door
stands · the block's sources) and paints matches grouped
under kind heads with the rung path named ("Courses",
"Prayers › Our Lady", "Novenas", "Sources"). Inside any
rung the same field narrows that rung's list only.
Clearing the field restores the rung's full list. The
input repaints only the list container, so focus and
text survive (the Catechesis Novenas page's pattern).

ALREADY STANDING (Q3): an item whose id
(`kind:key`, opnTodayItemId594's shape) stands in the
host's current list paints with the meta "Already in
<block>" and carries no tap handler — in every rung and
in search results. No duplicates can be written: the
add act is unreachable for a standing item, and the
validators' own dedupe stands behind it.

A pick (Q4) adds through the host's add act, removes
the sheet, and returns to the editor — Edit today's add
lands in the v600 draft (nothing writes until Save
today, as built).

The vault gate stands in front of both editors as built
(neither editor opens while locked, so the ladder never
opens unlocked-unguarded); the ladder itself adds no
write path of its own.

### 2.2 Courses re-open (validators + read seam + resolver)

Exactly the seams v597 closed, re-opened for the four
keys only:

- Client `opnCheckContents590`: `kind === 'course'`
  accepted when the key is one of OPN_COURSE_KEYS_603
  (the four keys, restored as a named constant); any
  other course key throws ('bad course'), as pre-v597.
  `opnCheckTodayLayer594` re-opens by dependency (its
  contents leg calls opnCheckContents590).
- Client `opnContentsOf590` (the read seam): course
  items with a standing key pass through; a course item
  naming any other key still filters out (a foreign
  stored item can neither paint nor resolve).
- Server `validateProfileContents` (index.ts): the
  mirror change — `kind === "course"` with a standing
  key is kept (normalized like any keyed item); any
  other course key is an error, matching the client.
  Its three consumers (profile store read · today-edit
  route · profile save route) inherit it.
- The RESOLVER, restored from the pre-v597 tree
  (commit c1ff8d3^): `resolveProfileCourses590(day)`
  whole — each course selector in the effective
  profile's contents resolves through
  `/api/player/podcasts?series=<key>` to the standing
  Current pointer (the payload's `currentKey`, else
  `opnPodCurrentKey(entries)` — the user's own
  progress), the descriptor stands in
  `state.courseRes590` — plus its two call-side pieces:
  the `buildDayFromPayload` call beside
  `resolveProfilePodcasts(day)`, and the placement leg
  in `extRebuildDescs` (a block's resolved course
  descriptors stand as tracks in contents order, after
  the block's merged settings rows, exactly where the
  leg stood pre-v597). A finished or unavailable course
  resolves nothing: its slot stands empty.
- GUARD (v597's rule, standing): `profContentsUniverse590`
  gains NO course selectors and `opnStandingContents597`
  is untouched — defaults and Reset stay courseless by
  construction, and a course can stand only where a
  hand add wrote an explicit contents entry.

### 2.3 The book's groups kept whole

`loadBook` / `loadBookT` stop flattening: beside the
flat `bookList` (which other consumers read), each
editor scope keeps `bookGroups` — the served
`r.groups` as `{ name, prayers: [{slug, title}] }`
(Daily 24 · Morning & evening 5 · Mass & Communion 13 ·
Our Lady 9 · In trouble 5 · For the family 4 · For the
dead 7 · For the children 2 · The Raccolta 8 — the
served counts the Scope seat verified). The ladder's
Prayers rungs and the head search read bookGroups.

### 2.4 Gates (harness-v603)

- The ladder opens from BOTH editors with the door
  set/order per block kind (Novenas door absent for a
  core block, present — alone — for Novenas).
- Prayers descend door → category → prayers with the
  served group counts.
- A hand-added course stands in the block, survives
  save + reload through the real local API (validator +
  read seam), and RESOLVES in the composed day to the
  next episode by the user's own progress (the v589
  production fixture's Bible in a Year: 322 listened,
  Current = Day 322's next unlistened entry).
- Defaults + Reset carry NO courses on the new code
  (the v597 guard leg, driven through the real save +
  reset routes).
- Search: head search returns matches across kinds
  grouped with paths named · inside Our Lady the same
  field narrows to that category only · clearing
  restores the rung.
- An already-standing item paints marked and its tap
  writes nothing (the document byte-identical after).
- A pick in Edit today lands in the DRAFT — nothing
  written until Save today; driven through the save.
- The locked-vault leg stands (both editors gated; the
  ladder never paints).
- Equivalence: every day composed without a hand-added
  course is byte-identical to the pre-v603 ship.
- Regression: harness-v597 (course-ban legs named
  by-design; defaults/Reset legs stay green) ·
  harness-v600 · harness-v601 — every delta named.

### 2.5 Review renders

At Review the built client is driven in headless
Chromium over production fixtures and a PNG is captured
of each rung — doors (core block) · doors (Novenas
block) · Prayers categories · one category's prayers ·
the Courses door · a head search grouped · a narrowed
in-category search · an already-standing item marked —
saved under
~/workspace/projects/ora-pro-nobis/v603-review-renders/.
Then the chain STOPS: no merge, no pin, no deploy.

## §3 Implement — as built (2026-11-21, chain-v603-build)

- **The ladder:** one builder, `openAddLadder603(block, host)`, top-level in the client, serving both editors. The sheet wears `.sheet.profadd591.profaddladder603` (the standing sheet dress; ui.ts gains the compact `.bookrow` spacing for the ladder and the `.profadd-on603` marked dress). Rungs: doors · courses · prayers · prayers:<group> · novenas · sources. The Configure ladder's door-row dress (`.card.bookrow`) carries every row. Hosts: Edit profiles supplies ids from the draft's materialized contents (else the standing contents), add = push into the materialized draft + repaint; Edit today supplies ids from the effective draft list, add = push into the materialized draft layer + `afterEdit` (v600 draft posture untouched — nothing writes until Save today).
- **Doors (Q1):** core blocks stand Courses · Prayers · Sources in that order; the Novenas block stands the Novenas door alone. The Novenas rung: "Every active novena" first, then the served catalog (247) in saint order.
- **Search (Q2):** the standing `.searchpill` at every rung; only the list container repaints on input (focus and query survive). Head search walks all four kinds and groups matches under kind heads, each row's meta naming its rung path ("Prayers › Our Lady", "Courses", "Sources", "Novenas"). Inside a rung the same field narrows that rung only; clearing restores it.
- **Already-standing (Q3):** a row whose item stands in the block paints with `.profadd-on603`, the meta "Already in <block>", and NO tap handler — a tap writes nothing (harness-proven byte-identical).
- **Pick (Q4):** a tap closes the sheet back to the editor; the item stands in the editor's draft. Adding another is a fresh Add tap.
- **Courses re-opened (the scoped reversal of v597):** `OPN_COURSE_KEYS_603` names the four keys. Client `opnCheckContents590` accepts a course item naming a standing key and throws `bad course <key>` on any other; the read seam `opnContentsOf590` passes standing-key course items and still filters foreign ones; `opnCheckTodayLayer594` inherits by dependency. Server `validateProfileContents` mirrors the rule exactly (client == server over the harness battery). The resolver stands restored whole from the pre-v597 tree: `resolveProfileCourses590`, its `buildDayFromPayload` call beside `resolveProfilePodcasts`, and the placement leg in `extRebuildDescs` (after the merged settings rows, in contents order). The server payload derivation was never removed and stands untouched. GUARD kept: `profContentsUniverse590` offers no courses and `opnStandingContents597` is untouched — defaults and Reset stay courseless (harness-v603 V3/V4 + harness-v597 B1–B3 green).
- **Book groups:** both loaders keep the served groups whole (`bookGroups`: {name: category, prayers}) beside the flat `bookList` the rest of the client reads; counts as served (24 · 5 · 13 · 9 · 5 · 4 · 7 · 2 · 8).
- **Retired:** both flat pickers (`openAddPicker`, `openAddPickerT`) and their row attributes are gone; the Add buttons stand as before.
- **Gates (working tree):** harness-v603 **39 ok / 0 not ok** — statics (ladder · doors order · Q3 · validators client+server · resolver restored · guard · pin unmoved · parse) · validator parity battery · save/export/restore keeps a hand-added course · the ladder driven in both editors (door sets per block kind · Prayers descent with served counts · in-category narrowing + clearing · head search grouped with paths · already-standing marked + tap-writes-nothing · the Novenas rung) · a hand-added Bible in a Year course saves into the Salesian Way and RESOLVES in the composed day to **Day 322 — The Ascension** (the next episode by John's own progress, from the production listens fixture) · an Edit today pick lands in the draft and writes only at Save today · the locked-vault world stands the gate, no ladder · equivalence: the day composed without a hand-added course is **byte-identical** to the pre-v603 ship.
- **Regression:** harness-v600 **37/0** · harness-v601 **8/0** — no deltas. harness-v597: baseline on main is 24 ok / 1 not ok (T5 pin drift, pre-existing). On this tree: T2/T3 fail BY DESIGN (they assert the retired course ban in the validators, read seam, and server parity statics — the exact text v603 re-opens for the four keys; the parity itself is re-proven by harness-v603 E1 with the updated extraction table) · T4 fails BY DESIGN (it asserts the two flat Add pickers consult the seat-posture helper; the pickers are retired into the ladder, and the posture still governs the Sources rung through the contents universe — harness-v597 C1–C3 stay green) · T5 fails identically to main (pre-existing) · sections A–D all green, including the defaults/Reset legs B1–B3 that must stay green · §E stops on its own outdated server-extraction table (it cannot strip the re-opened validator's course line — a harness-shape limit, named; §§F–G did not run under it, and the courseless server fold is untouched code outside the course branch).

## §4 Review — the gate (2026-11-21, chain-v603-build)

- **Verdict: PASS at the Review gate — held before Ship per the approved run level (Q5).** No merge, no pin bump, no deploy, no What's New.
- **Gates on the final tree:** harness-v603 **39 ok / 0 not ok** (working tree AND a clean checkout of the branch head) · harness-v600 **37/0** · harness-v601 **8/0** · harness-v597 deltas exactly as named in §3 (T2/T3/T4 by design, T5 pre-existing on main, §E extraction-table limit; defaults/Reset legs green).
- **Review fix (one, found by the renders):** the first rung-6 capture showed a course row in head search wearing its fallback label ("Course — rosary-in-a-year") because the series titles had not landed when the search painted and nothing repainted. The ladder now repaints whenever the series index (or the novenas catalog) lands while its sheet stands. Re-render proves it: the row reads "The Rosary in a Year".
- **The renders (driven from the built client over the production fixtures; the real sheet markup, rasterized in headless Chromium with the app's own CSS):** all under `~/workspace/projects/ora-pro-nobis/v603-review-renders/` —
  - `rung-1-doors.png` — the doors for a core block (Morning): Courses · Prayers · Sources, search pill at the head.
  - `rung-2-doors-novenas.png` — the doors for the Novenas block: the Novenas door alone.
  - `rung-3-prayers-categories.png` — Prayers: the nine served categories with their counts (24 · 5 · 13 · 9 · 5 · 4 · 7 · 2 · 8).
  - `rung-4-category-prayers.png` — Our Lady: its 9 prayers.
  - `rung-5-courses.png` — Courses: Catechism in a Year · Bible in a Year · The Rosary in a Year · Summa in a Year.
  - `rung-6-head-search.png` — head search "Rosary": matches grouped COURSES / PRAYERS / SOURCES, rung paths named ("Prayers › Our Lady", "Prayers › The Raccolta"), the standing Daily Rosary marked "Already in Morning".
  - `rung-7-category-search.png` — inside Our Lady, "Memorare" narrows the rung to the one prayer.
  - `rung-8-already-standing.png` — Sources rung: the standing source painted marked "Already in Morning", not tappable.
- **What Ship does on John's word:** merge release/v603 to main (serialized), bump the SW pin to ora-pro-nobis-v603-1, deploy through the standing connector-surrogate driver, served-leg proof (the ladder live on the public host), What's New entry, shipped_records insert + read-back, field legs to John (add a course by hand in Edit profiles and in Edit today; watch it resolve in the day).

### Review addendum — round 2: a named novena plays (2026-11-21, chain-v603-fix)

- **The gap (John's question at the gate — "When you add novenas, how does that work?" — and his approval, 19:05 CT: "Ok. Let's do it plus fix"):** the Review renders' fold drive proved a named novena contents item (`kind:'novena'`) was stored, validated, painted, and exported — but NO fold consumer read it. Beside all-novenas it changed nothing; standing ALONE (all-novenas off) the Novenas block composed EMPTY, because the `extRebuildDescs` contents gate stood the block's own-source row only on a source selector or all-novenas. The door's promise ("One novena, or every active novena") was half unhonored.
- **The fix (client.ts only; commits 9b60ecc + abd2dae):** the fold now reads `kind:'novena'`. (1) The gate stands the novenas row on a named item too. (2) A new selection, `opnNovenaMetas603(contents, tracks)`, walks the block's contents IN CONTENTS ORDER: a `novena` item stands its own track — the day's Day n episode, present in the resolved slot only while that novena runs (the feed carries one episode per running novena per date, so slot presence IS the day standing; the resolution source is the same slot all-novenas draws from); the `all-novenas` item stands every running track not already stood — dedupe by episodeId, so a named novena that is also active stands exactly once, at its contents position. (3) Under a missing slot, a named-only entry emits no missing placeholder: the block is empty only when no named novena runs — a true empty, not a gate accident.
- **Server parity — no index.ts change, by evidence:** the server never composes novena tracks; its day payload carries block shells plus the profile fold, and `profileFoldOf` deep-clones the validated contents verbatim into that fold (the today layer merges the same way), while `validateProfileContents` already normalized `novena` items through. The one composition engine is the shared client's `extRebuildDescs`, running in both shapes — the mirror is the fold itself. The harness E1 parity battery now carries a named-novena item and client == server over it.
- **Gates:** harness-v603 **50 ok / 0 not ok** (working tree AND a clean checkout of the new head abd2dae) — the prior 39 legs plus T13 (fold statics) and the N legs: N0 the fixture slot for 2026-11-21 built from the production catalog by the window rule carries the nine running novenas · N1 named ALONE on a running day composes its Day n (christ_the_king, Day 9) · N2 named ALONE outside its run (14_holy_helpers, window 2026-07-30 + 9d) composes zero tracks AND no missing placeholder — empty by truth, the reason asserted · N3 named + all-novenas: nine tracks, the named exactly once · N4 two named stand in contents order (miraculous_medal before christ_the_king — the reverse of slot order) · N5a–d the Edit today posture driven through the real screen: the pick lands in the draft, Save today writes the layer, the standing profile's contents stay byte-identical, and the saved layer composes the named novena once at its Day 4 · N6 FAIL-ON-PRE-FIX: the same named-alone world on the pre-fix tree (b4545c2, pinned by hash) composes ZERO — the defect reproduced. Equivalence A1 stands: no named novena in contents → byte-identical to the pre-v603 ship. Regression: harness-v600 **37/0** · harness-v601 **8/0** — zero delta · harness-v597 deltas exactly as §3 named (T2/T3/T4 by design, T5 pre-existing, §E extraction-table halt) — unchanged; the fix touches neither validator.
- **Renders revised:** `novenas-4-composed.png` RE-RENDERED from the fixed fold (`app/renders-v603-fix.mjs`): posture A (named alone) now stands the one track — "Traditional Novena to Christ the King Day 9"; posture B (both standing) stands the nine running novenas with the named exactly once. `novenas-3-added.png` NOT re-rendered: the fix touches no paint code (the editor's paint is byte-identical), so the round-1 capture stands as-is.
- **State after round 2:** branch release/v603 at abd2dae, clean (the untracked `app/node_modules` symlink is tooling only). Still held before Ship — no merge, no pin bump, no deploy, no What's New. Ship on John's word does exactly what §4 above says, plus the new field leg: add ONE named novena by hand (and, on a day it runs, switch "Every active novena" off) and watch its Day n stand in the block.

## §5 Ship (2026-11-21, chain-v603-ship — John's word 19:20 CT: "Ship it")

- Merge: release/v603 merged to main as 97e033f
  (--no-ff). Main had advanced past the branch base
  by exactly one commit (56e3693, the v599 doc §5)
  touching only the v599 release doc — zero overlap
  with v603's files, no hand resolution needed.
  Whole-tree conflict-marker grep: 0. SW pin bump
  2c3784d (ora-pro-nobis-v603-1, ui.ts CACHE).
- Push: 8 commits replicated byte-identical via the
  GitHub Git Data API with SHA assertions — main
  pushed · remote in sync at 2c3784d.
- Gates on the merged tree: harness-v603 50 ok /
  0 not ok (also 50/0 after the pin bump) ·
  harness-v600 37/0 · harness-v601 8/0 — zero delta.
- Deploy (connector-surrogate driver, from the
  standing clone at 2c3784d): Worker
  90d4f7c0-819a-4b8c-9e1e-5968ac893123 at 100% ·
  rollback target 3bfc4b31 (v599) · pin
  ora-pro-nobis-v603-1 stands in the served sw.js ·
  served app.js parses whole (1,209,846 chars) and
  carries the ladder (openAddLadder603) and the
  named-novena selection (opnNovenaMetas603) ·
  served /api/prayer/book answers the nine groups
  at the served counts (24 · 5 · 13 · 9 · 5 · 4 ·
  7 · 2 · 8).
- Board closeout: What's New 419 · row 1577 Live
  (shipped_at 2026-11-22T01:25:00Z) ·
  shipped_records 793 inserted and read back ·
  phase records Scope 2432 · Plan 2437 · Implement
  2438 · Review 2439 · Ship 2440, all passed ·
  contracts 846 · 848 · 849 · 850 (Review fix) ·
  852 (Ship), all met · intake 1121 Done, read back.
- Field legs: Open Edit profiles, tap Add in a
  block — the doors stand (Courses · Prayers ·
  Sources), search at the head; hand-add Bible in
  a Year from the Courses door and watch the next
  day by your progress stand in the day. In Edit
  today, Add lands in the draft until Save today.
  In the Novenas block, hand-add one named novena,
  switch Every active novena off on a day it runs,
  and watch its Day n stand in the block.
