# v596 — Slot picker day-pick: the locked-vault gate

## §1 Scope

Named sibling defect, found by the v594 Part 1 diagnosis
(2026-11-21) and held at Scope until v594 Part 2 landed:
the prayer slot picker's day-pick rows (openProfileSheet —
the Praylist-era profile sheet) ride the same on-device
write path (opnLocalApi) as the Configure surfaces and
refuse the same way while the v578 vault stands LOCKED.
The sheet paints from the ephemeral default document the
local layer serves on reads, and every row write — the
day-pick (profiles/day-pick), the standing default and
the day rule (profiles/state) — throws 423 vault_locked;
the refusal lands on a note line the user does not see,
so a day-pick tap under a locked vault does nothing.

Fix shape (proven by v594 Part 1): stand the same
locked-vault gate (profVaultGate594) at this surface —
the standing unlock card first, the sheet loads only
once unlocked. Small release, streamlined path, To Ship.
No data change; the vault, the PIN, and John's document
are untouched.

## §2 Plan

One change, in app/worker/src/client.ts, inside
openProfileSheet only:

- The sheet's load — today an inline
  api('/api/prayer/profiles') chain that paints the
  pick / standing / rule rows and wires their writes —
  is wrapped in a named startLoad() function.
- The open path then runs the standing gate, exactly as
  the three Configure surfaces do:
  if (!profVaultGate594(body, startLoad, onClose))
    startLoad();
  While opnMode() === 'device' and the vault is locked,
  the gate paints the standing unlock card
  (opnUnlockCardHtml + opnBindUnlockCard) into the
  sheet's body and the load proceeds only after the
  pad unlock, when the real document stands in the
  cache. Inert in the server shape and whenever the
  vault stands open.

Named adaptation (the only one): the Configure surfaces
already carried a named load function and a ladder-aware
close; this surface's load was inline and its close is
the sheet's own removal. The load is wrapped into
startLoad() and the gate's onClose is sheet.remove() —
the picker's own close path. The gate helper itself is
reused byte-identical; its painted Close row comes with
it, as it does on the Configure surfaces.

Nothing else moves: the sheet's lists, rows, marks, and
pick semantics stand exactly as shipped; the Edit acts
still open the profile editor (which, reached from an
unlocked sheet, works on the unlocked document).

Gate: harness-v596 on the committed tree + a clean
checkout, on the harness-v594 recipe (real vault
envelope over John's v589-import document through the
client's own pin-set migration, cold-start world):

- Locked world: the sheet stands the unlock gate, no
  pick rows paint, no pick is written.
- Locked world, after the pad unlock: the rows paint
  and a tap on a day-pick row LANDS — the day-pick
  write stands in the document (the profiles read-back
  resolves by 'pick').
- Vault-open world: the sheet's painted rows are
  byte-identical to the pre-fix client's, and a pick
  lands as before.
- Server shape: the gate never stands.
- Fail-on-old: the locked-world legs fail on the
  pre-fix client (the silent refusal reproduced).

Regression: harness-v594 · harness-v601 · harness-v600,
deltas named per leg.

## §3 Implement

One commit on release/v596, app/worker/src/client.ts
only: openProfileSheet's inline load chain is wrapped
in a named startLoad() (the chain body byte-identical
apart from its indent), and the open path runs the
standing gate —

  if (!profVaultGate594(body, startLoad,
        function () { sheet.remove(); })) startLoad();

The gate helper is reused byte-identical. The named
adaptation stands as planned in §2: the load wrap, and
onClose = the sheet's own removal (the picker is not a
ladder door). Nothing else in the client moves; ui.ts
and index.ts are untouched; no data change.

harness-v596 (new, on the harness-v594 recipe):

- Working tree: 9 ok / 0 not ok — T1 the gate call site
  stands · T2 pin unmoved · T3 the rendered client
  parses whole · R1 a real envelope over John's
  document through the pin-set path · R2 the locked
  sheet stands the gate, no pick rows paint · R3 the
  stored envelope stands byte-identical (no pick
  written) · R4 after the pad unlock the rows paint
  and a Benedictine day-pick tap lands (the read-back
  resolves by 'pick') · R5 the vault-open sheet paints
  byte-identical to the pre-fix client's and its pick
  lands · R6 the server shape stands no gate.
- Fail-on-old (the same harness on the pre-fix tree):
  6 ok / 3 not ok — T1 red (no gate stands), R2 red
  (gateStood false, the pick rows paint from the
  ephemeral document — the silent-refusal shape), R4
  red (no unlock path; still locked; no pick). The
  defect is reproduced in-harness.

## §4 Review

Diff read whole: client.ts +99/−44 by line count, all
of it the startLoad wrap (re-indent) plus ten new lines
(the comment and the gate call); the load chain's body
is unchanged token for token. The gate helper, the
sheet's rows, marks, and pick semantics are untouched.

Regression, deltas named:

- harness-v601: 8 ok / 0 not ok — zero delta.
- harness-v600: 37 ok / 0 not ok — zero delta.
- harness-v594: 7 ok / 2 not ok on this tree AND
  7 ok / 2 not ok on the pre-fix tree, identical
  payloads — zero delta. The two reds (R3 · R6) assert
  the v593 Q2=A coupling (a chip tap in the editor
  stands the profile for today), retired by v594
  Part 2 — by-design reds, standing since Part 2.

Clean-checkout gate: harness-v596 re-run on a clean
checkout of the committed tree at Ship (§5).

## §5 Ship

SHIPPED LIVE 2026-11-21 23:47Z (17:47 CT).

- Worker **536176d5-73c6-43ec-975b-59412d42db5e** ·
  rollback target eec180ed (v600) · pin
  **ora-pro-nobis-v596-1** (in served sw.js).
- GitHub main **7c230e1** (fast-forward merge of
  release/v596: the fix 03e0966 + the pin bump) —
  main pushed · remote in sync (Git Data API,
  byte-identical, 2 commits replicated with SHA
  assertions; whole-tree conflict-marker grep 0).
- Served proofs: served sw.js carries the pin ·
  served app.js parses whole (1,198,893 B) and
  carries the gate call at the slot picker.
- What's New **417** · row 1570 **Live** ·
  shipped_records **791** · Ship record 2431 ·
  Ship contract 841, met.

### Gates

- harness-v596: **9 ok / 0 not ok** on the working
  tree, a clean checkout of the committed tree, and
  the merged tree.
- Fail-on-old (the same harness on the pre-fix
  tree): T1 · R2 · R4 red — no gate stands, the pick
  rows paint from the ephemeral document, no unlock
  path, no pick: the silent refusal reproduced.
- Regressions, named: harness-v601 8/0 ·
  harness-v600 37/0 — zero delta · harness-v594
  7/2 on this tree and 7/2 on the pre-fix tree with
  identical payloads — zero delta (R3/R6 assert the
  Q2=A coupling retired by v594 Part 2).
