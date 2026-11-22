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
