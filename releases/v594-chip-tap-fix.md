# v594 — Chip tap fix (Part 1: the locked-vault gate on the Configure surfaces)

## §1 Scope

FIELD DEFECT on the shipped v593 (John, Ora thread, 2026-11-21
15:31–15:32 CT): in Profile edit, tapping another profile's
chip — his example: The Benedictine Way, while The Salesian
Way stands — does NOTHING. No switch, no prompt, no error.
Fix-forward under the standing production-break rule: restore
the APPROVED v593 behavior only — no new design, no scope
changes. Part 2 of row 1568 (the today-vs-everything
differentiation) is NOT in this release; it stays at Scope.

## §2 Plan — the diagnosis (proven, not guessed)

**The reproduction.** The SERVED client (pin
ora-pro-nobis-v593-1, fetched from production) was driven in
jsdom through the REAL event path: `openProfilesScreen` (the
ladder door's exact call) → the painted chip button → a real
click dispatch, in two worlds:

- **World A — John's field world** (the on-device store is a
  v578 vault ENVELOPE; the session never unlocked — the
  Configure path carries no unlock step): the editor paints
  normally ("Today follows The Salesian Way", chips stand).
  The Benedictine tap changes nothing — head and profile
  stand, no prompt — and the only trace anywhere is the note
  line reading **"vault_locked"**. The store stands
  untouched. A tap landing on the chip's child span behaves
  identically.
- **World B — control** (the same document in plain form):
  the same tap on the same painted chip switches — head
  "Today follows The Benedictine Way", the pick written
  `{"2026-11-21": "benedictine"}`.

**The break.** In the device shape, `opnLocalApi` refuses
every personal WRITE while the vault stands locked
(`mode === 'device' && write && opnVaultLocked()` → 423
`vault_locked`, thrown before dispatch). v593's chip tap IS
a write — `doSwitch`'s day-pick PUT — so it never lands.
Its refusal lands in `.catch(fail)`, which writes the raw
string `vault_locked` into `.profplannote` — an element
mountDrawer relocated to the very bottom of the scrolling
panel, under all eight blocks: invisible in normal use.
Reads ride the ephemeral default document while locked
(`opnDoc` over a locked envelope returns `opnDefaultDoc()`),
so the screen LOOKS right — the three ways, Salesian
standing — while every act on both Configure surfaces
(chip switch · Save · Save New · Reset · Delete · mapping
Stand) is dead the same way.

**Candidates cleared by the control + code read:** (1) the
chip binding — painted with `data-p593chip` and bound per
paint, fires in both worlds; (2) a stale-reference throw —
no throw anywhere in the tap path; (3) event target vs
currentTarget — the binding closes over the button element
and reads its own attribute; the span-target tap fired the
handler in world A (it produced the vault_locked trace);
(5) served ≠ committed tree — the served client IS the
committed tree's render (the repro ran on the served file).
Candidate (4) is the break, in its precise form: not the
document's content shape but its ENCRYPTED shape — the
harness's plain-document fixture never stands in it.

**Why harness-v593 passed (20/0) over a dead tap:** its legs
are source statics plus `opnLocalApi` driven directly in a
vm world seeded with a PLAIN document — no envelope, so
`opnVaultLocked()` is false — and no DOM at all: no paint,
no binding, no click. The producer-consumer key it never
exercised is the vault state of the store it consumed.

**The fix (smallest change).** `profVaultGate594` in
client.ts: while `opnMode() === 'device'` and the vault
stands locked, the surface's body carries the standing
unlock card (v587: `opnUnlockCardHtml` +
`opnBindUnlockCard`) and the surface loads only once
unlocked — when `opnVaultApplyKey` has put the real
document in the cache. Stood at the two Configure surfaces:
`openProfilesScreen` (its load trio behind `startLoad`) and
`openDayMappingScreen593` (its load behind `loadMap`). The
gate's Close returns to the ladder, as the surfaces' own
closes do. Inert in the server shape and whenever the vault
stands open (harness R6/R7). Client-only: no migration, no
endpoint, no data change. John's vault, PIN, and document
are untouched — his same PIN unlocks, as on the Intentions
side since v587.

**Named sibling, outside this release:** the prayer slot
picker's day-pick rows (`openProfileSheet`) ride the same
local write path and refuse the same way under a locked
vault. v593 did not touch that surface and this fix does
not either; it stands for its own item if John wants it
gated too.

## §3 Implement

- `app/worker/src/client.ts`: `profVaultGate594` added
  before `openConfigureLadder593`; the editor's load trio
  wrapped in `startLoad` behind the gate; the Day mapping
  screen's load wrapped in `loadMap` behind the gate.
- `app/harness-v594.mjs` (new): T statics (the gate + both
  call sites · rendered client parses · pin unmoved
  pre-Ship) + R real-DOM legs (jsdom; `npm i --no-save
  jsdom`): a REAL vault envelope is built over John's
  document through the client's own production migration
  path (the local `/api/pin/set` route — opnPinSet +
  opnVaultCreate in one action), a fresh world over that
  envelope is his cold-start session, and the legs drive
  the painted DOM — gate stands → PIN pad unlock → painted
  chip click → the switch lands (R2/R3, editor; R5, Day
  mapping) — with the unlocked control (R6) and the
  server-shape control (R7).

## §4 Review

- **harness-v594 on the fixed tree: 9 ok / 0 not ok.**
- **Fail-on-old proof:** the same harness on the pre-fix
  tree (af43c7f): 5 ok / 4 not ok — T1, R2, R3, R5 fail;
  R3 reads `stillLocked: true`, no switch: the field defect
  reproduced in-harness. The controls (R6/R7) pass on both
  trees.
- **Equivalence:** harness-v593 A1/A2 and harness-v592
  A1/A2 pass on the fixed tree — a Salesian weekday and a
  Sunday under the seeded map compose byte-identical to
  the shipped compositions. The gate is open-time only.
- **Regression deltas, named:** harness-v593 20/0 (clean)
  · harness-v591 29/3 · harness-v592 10/2 — identical to
  the v593 ship's named by-design reds (assertions on the
  retired pop-up surface); the v594 change adds no new red
  anywhere.
- Personal data and prayer seats untouched (client-surface
  release; the fold/data legs all green).

## §5 Ship

- **Merge + push (this chain):** release/v594 rebased over
  the concurrent v595 merge (deaef71), merged to main at
  **a271310**, replicated via the GitHub Git Data API,
  byte-identical, SHA-asserted — at that moment: main
  pushed · remote in sync (Jctebo/spotify_praylist).
- **⚠ INCIDENT — conflict markers shipped in sw.js (this
  chain's error, named plainly):** the rebase's pin
  conflict was resolved by a string replace that set both
  CACHE sides to ora-pro-nobis-v594-1 but LEFT THE MARKER
  LINES (`<<<<<<< HEAD` · `=======` · `>>>>>>> 341d5cb`)
  standing in ui.ts's SW_JS template, and the tree was
  committed (32f982b), merged, and deployed that way
  (Worker 88032d46). The served sw.js therefore failed to
  parse — a service-worker update could not install while
  it stood (~21:44–21:48Z). The gate-carrying app.js
  served correctly throughout (it parses whole; the
  markers stood only in the SW template). How it slipped
  the gates: the harness pin legs compare the pin STRING,
  and both sides read v594-1 after the replace; no leg
  greps the served sw.js for marker text. Standing lesson
  recorded for the line: a conflict resolution is verified
  by a marker grep over the whole tree, never by the
  resolved line alone.
- **Repair (the v595 seat's fix-forward):** the v595 ship
  seat found the markers in 32f982b, resolved them in
  **f7ecc93** (pin ora-pro-nobis-v595-1, on their
  refinement merge 5373858 over a271310), pushed it, and
  deployed **Worker 4fadc0e9-7582-4013-b91f-fa5611dc1483**
  (2026-11-21T21:48:29Z). That is the SERVING state,
  verified from production after the repair: served sw.js
  clean (`var CACHE = "ora-pro-nobis-v595-1"`, no markers)
  · served app.js parses whole (1,150,333 chars) carrying
  `profVaultGate594` and both call sites, no markers
  anywhere · public `/api/prayer/profiles` reads empty as
  designed. GitHub main stands at f7ecc93 + this doc
  commit — main pushed · remote in sync.
- **Gates:** harness-v594 **9/0** on the working tree, a
  clean checkout, and the merged tree (the v594 pin bump
  superseded by the v595 pin in the serving tree — the
  gate legs are pin-independent) · on the merged tree
  harness-v593 19/1 · harness-v595 16/1 (their reds: the
  pin legs only, the standing disclosed shape) ·
  harness-v591 29/3 · harness-v592 10/2 (the v593 ship's
  named by-design pop-up assertions). Equivalence stands
  (harness-v593/v592 A legs green).
- **Records:** phase records Plan · Implement · Review ·
  Ship all passed (Scope 2391 stands from registration) ·
  contracts 808 (Plan) · 809 (Implement) · 810 (Review) ·
  811 (Ship), every expectation met — read with this §5:
  the Ship contract's deploy note names this chain's
  88032d46 deploy; the serving deploy is 4fadc0e9 per the
  incident + repair above (judgments are uneditable; the
  correction stands here and on the row). **What's New
  409** · row 1568 **Live** (shipped_at
  2026-11-21T21:47:37Z).
- **Intake 1110 stays OPEN** — Part 1's outcome (with the
  incident) is appended to its notes; Part 2 (today vs
  everything) stands at Scope for its package.
- **Field leg (John's):** open Configure plan → Profile
  edit — with the vault locked, the unlock pad stands
  first; after the PIN, tapping The Benedictine Way
  switches today to it.
