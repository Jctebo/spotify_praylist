# v599 — Edit today: the time block chips (a block jump strip)

## §1 Scope

- Direction (John, Ora thread, 2026-11-21 16:49 CT): "I meant the
  time block chips on edit today" — v598 aligned Edit today's profile
  pick chips; John meant the chips that stand for the day's blocks.
- Investigation finding (recorded on row 1573): Edit today paints NO
  block chips — its blocks stand as section cards; the only block
  chips in the Configure family are Edit profiles' jump strip
  (.profjump593 / profjumbtn593), itself outside the v598 compact
  chip dress (32px · 12px · 4px/9px vs chip591's 38px · 14px ·
  5px/11px under the compact rule).
- Pick (John, 2026-11-21 17:56 CT): "(a) Edit today gains a block
  jump strip" — APPROVED TO SHIP.
- Refinement (John, 2026-11-21 17:57 CT): "And I want it more
  compact like edit profiles" — the new strip stands at Edit
  profiles' JUMP STRIP's own compactness, so the two jump strips
  match each other. This supersedes the compact-chip591 wording
  where they differ.

## §2 Plan

- Edit today gains a block jump strip inside its frozen zone
  (frozenT, with the v600 Save today bar), painted by
  paintFrozenT() — which runs only after the locked-vault gate
  passes and the screen loads, so the strip never paints behind
  the gate.
- One chip per block the screen paints, in the screen's own order —
  the exact order paintBlocksT() emits: the draft's core order,
  then any remaining hours in HOURS order, then Novenas, then
  Podcasts. A block the draft turns off still stands as a card, so
  its chip stands too.
- Dress by construction: the strip reuses Edit profiles' own
  component — container class profjump593, buttons profjumbtn593
  (ui.ts:469-471, unscoped rules) — so the two jump strips read one
  dress. No new CSS, no copied values. Edit profiles' strip stands
  untouched.
- Behavior mirrors Edit profiles' strip as shipped: a chip tap
  scrolls the scroller to the block's card (data-p594anchor, the
  jumpTo math); a scroll listener on the screen's scroller runs
  the scrollspy (spyUpdate math) lighting the chip of the block in
  view (.on). Chips carry data-p599jumpbtn so no selector collides
  with the profiles screen's data-p593jumpbtn wiring (each screen
  scopes its queries to its own frozen element regardless).
- Navigation only: the strip never writes, never touches the
  draft (td / pickD / clearedD), and never repaints the body —
  the v600 draft/save/prompt machinery stands byte-identical in
  effect. paintBlocksT and the fold are untouched, so every
  composed day is byte-identical (equivalence gate).
- Gates: harness-v599 — strip presence/order · dress equality
  against Edit profiles' JUMP strip chips (32px/12px/4-9, computed)
  · tap-scroll + scrollspy driven · frozen-zone standing ·
  navigation never dirties (document byte-identical after jumps +
  close, no prompt) · locked-vault leg (gate first, strip after
  unlock) · A1/A2 equivalence carried from harness-v594p2's world
  · fail-on-old against the pre-v599 client. Regressions:
  harness-v600 + harness-v601 + harness-v598, deltas named.

## §3 Implement

- client.ts only (+61 lines, all inside
  openEditTodayScreen594; ui.ts and index.ts
  byte-identical to main):
  - The strip element: a div.profjump593
    (data-p599jump) appended to frozenT under the
    Save today bar, with one delegated click listener
    and a scroll listener on the screen's scroller.
  - jumpToT / spyUpdateT: Edit profiles' jumpTo /
    spyUpdate math carried over this screen's
    anchors (data-p594anchor) — tap scrolls the
    block's card to the scroller's top; the spy
    lights the chip of the last block at or above
    the top edge (.on).
  - paintJumpT (called from paintFrozenT, which
    runs only once the screen has loaded past the
    vault gate): rebuilds the chips in the screen's
    own paint order — draft core order, remaining
    hours in HOURS order, Novenas, Podcasts — each
    chip a button.profjumbtn593 (data-p599jumpbtn).
    The dress is Edit profiles' own rule (ui.ts
    .profjump593 / .profjumbtn593, unscoped) — shared
    by construction, no CSS added or copied.
  - Navigation only: no writes, no draft contact,
    no body repaint; the v600 machinery untouched.
- harness-v599 (new): 17 ok / 0 not ok on the
  working tree. Fail-on-old (the pre-v599 client):
  8 ok / 9 not ok — every strip leg red (T1 · R2–R7
  · R10). Dress equality is computed, not eyeballed:
  both strips' chips compute 32px min-height ·
  12px type · 4px/9px padding in the same world.
  Tap-scroll and scrollspy are driven with patched
  geometry (jsdom has no layout); the locked-vault
  legs run over a real envelope made through the
  client's own pin-set path.

## §4 Review

- harness-v599 on a clean checkout of the committed
  tree (b3ff6a7): 17 ok / 0 not ok — identical to
  the working tree.
- Equivalence: the change is confined to a
  paint-only screen function (T3) with index.ts
  byte-identical (T4); the composition gates stand
  in the regressions — harness-v600 37/0 (its A/L
  legs are the byte-identical composition proofs)
  and harness-v601 8/0. Every composed day is
  byte-identical to the pre-v599 ship.
- Regressions, deltas named: harness-v600 37/0 —
  zero delta · harness-v601 8/0 — zero delta ·
  harness-v598 13/2 — zero delta against the
  v600-shipped baseline: T4 asserts client.ts
  byte-identical to main (by-design red for a
  client-changing release) and R3c asserts the
  at-once Edit today flow v600 retired (by-design).
- Review verdict: PASS. The strip shares Edit
  profiles' jump component by construction (no CSS
  added, ui.ts untouched pre-pin), behaves as that
  strip behaves, stands frozen, and cannot dirty
  the draft (R8: document byte-identical after
  jumps + close).
