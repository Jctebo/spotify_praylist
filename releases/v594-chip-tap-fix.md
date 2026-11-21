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

(Ship read-back lands here at Ship.)
