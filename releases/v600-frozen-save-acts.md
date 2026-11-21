# v600 — Frozen save acts: Edit profiles always, Save today

## §1 Scope

John's direction (Ora thread, 2026-11-21 16:51 CT):
"Also on edit profiles the save And save mee buttons need
to be frozen. On today a new frozen button save today
needs to be there" — and the semantics pick (16:53 CT):
"Today's edits wait for the Save today button."

Two halves, both decided:

1. EDIT PROFILES — the acts bar stands FROZEN ALWAYS:
   Save · Save New stand at the top whether the draft is
   dirty or clean (Save inert/greyed when there is nothing
   to save). This REVERSES v593's Q3=C (the bar stands
   only while dirty).
2. EDIT TODAY — DRAFT-UNTIL-SAVE with a frozen SAVE TODAY
   button: today's edits hold as a screen draft and write
   only when Save today is pressed. This REVERSES v594
   Part 2's Q1=A (edits stand at once) and builds the
   package's Q1 option B shape, as now picked.

Client only (app/worker/src/client.ts). No server change,
no migration, no data change: every write rides the
standing routes (today-edit · day-pick · profiles/save).

## §2 Plan

### 2.1 Edit profiles — the permanent bar

`paintFrozen()` today sets `barEl.hidden = !dirty`. The
bar (`.profbar593`, inside the permanent `.proffrozen593`
flex sibling above the `.panelbody` scroller) becomes
permanent: the `hidden` attribute is never set. Save
(`data-p593save="profile"`) carries the `disabled`
attribute while the draft is clean — greyed by the
standing `.btn` disabled posture; Save New stands live
always (its clean-state purpose already stands: minting a
profile from the toggles as they stand). The bar line
paints always: dirty → "{name} · unsaved changes" (the
standing words); clean → "No unsaved changes". Because
the frozen zone's height is now constant, the first edit
can no longer change the scroller's geometry at all —
the v593 mitigation (flex sibling) becomes a guarantee,
and every edit repaint stays anchored as built. Nothing
else in the editor moves: chips switch the editor only,
the Q1=B switch prompt, the This profile zone, the jump
strip + scrollspy + hairline, the Q3=A warning line.

### 2.2 Edit today — the draft state machine (exact)

Standing state S = (P0, L0): P0 is today's effective
pick; L0 is the standing `todayEdits` entry for today,
or null. The screen draft D = { pick, td, cleared }:

- OPEN (after the standing vault gate): pick := P0;
  td := Part 2's `buildTodayDraft()` (profile P0's
  composition with L0 applied); cleared := false.
- DRAFT LAYER L(D): if cleared, the empty layer ("follow
  the profile whole"); else Part 2's `layerFromDraft()`
  recomputed from td against the draft pick's profile
  (the diff machinery is unchanged — an aspect the draft
  holds exactly as the profile stands it is not carried).
- DIVERGENCES while drafting are computed on the DRAFT:
  `opnTodayDivergence594(profileOf(pick), L(D))` — the
  badges, the count line, the removed-item trace lines
  and the materialize sentence all describe the draft.
  For a cleared draft the layer reads as `{baseProfileKey}`
  (no fields) → zero divergences → the line reads "Today
  stands as X stands it."
- DIRTY(D) := pick ≠ P0, OR (cleared AND L0 stands), OR
  (not cleared AND L(D) carries any field). SAVE TODAY is
  enabled exactly when DIRTY(D).
- FROZEN BAR: a new frozen sibling above the scroller
  (the `.proffrozen593` / `.profbar593` dress, reused —
  no new CSS), standing always once the screen loads. It
  carries SAVE TODAY (gold, `disabled` while clean) and
  the draft's standing line: the divergence sentence in
  the standing words ("Today differs from X in N
  place(s)." / "Today stands as X stands it."), with
  " · unsaved changes" appended while DIRTY(D).
- EDITS (block toggles · steppers · layer toggles ·
  series · contents add/remove/restore/reorder) mutate
  td only. NOTHING writes; the payload — and so the
  Praylist, the ladder head and the plan-row mark — keeps
  composing from the standing state until the save lands.
- PICK CHIP TAP (K ≠ draft pick): the clearing rule,
  applied in-draft exactly as Part 2 applied it at the
  tap: td := the draft of profile K with NO layer;
  cleared := false; pick := K. The standing warning
  ("Changing the pick clears today's edits.") stands in
  the paint whenever a pick change would clear anything —
  L0 stands, or the draft carries layer edits — before
  both the tap and the save, in the standing words.
- SAVE TODAY (dirty only) writes the whole draft at
  once through the standing routes:
  - pick ≠ P0: today-edit {layer: null} first (only when
    L0 stands), then day-pick {date, profileKey: pick}.
  - pick = P0: today-edit {date, layer: L(D) carrying
    fields ? L(D) : null} — a draft equal to the profile
    whole, and a cleared draft alike, write NO layer
    (the entry deletes; the clear outcome).
  After the write, res refreshes from the response, the
  draft rebuilds from the new standing state (clean),
  and `profileRebuild()` recomposes the day.
- CLEAR ACT (label unchanged: "Clear today's edits —
  follow the profile whole") RESETS THE DRAFT and never
  writes: pick := P0; td := profile P0's whole draft (no
  layer applied); cleared := L0 stands. A saved layer is
  therefore cleared by drafting its removal (this act)
  and saving. The act stands whenever L0 stands OR the
  draft differs from the standing state.
- CLOSE: the labeled Close act and the gate's Close row
  route through a guard — clean draft closes at once;
  a differing draft fires the prompt in the standing
  Q1=B shape (a `.profprompt593` sheet): Save today
  (writes, then closes) · Discard (closes; the standing
  state stands byte-identical) · Stay (the prompt
  closes; drafting continues). The drawer's universal
  scrim/grab dismissal keeps the app's standing posture
  — the same posture Edit profiles' unsaved drafts have
  always had — and stands outside the prompt's reach,
  named here.
- The vault gate stands as built: it gates the OPEN;
  the load and every save write run inside the gated
  surface's own session, exactly as Part 2's writes did.

### 2.3 What does not change

The fold, the payload, the ladder head and the plan-row
mark read the STANDING layer only — they are separate
reads of the standing state, and a screen-local draft
never reaches them. The server mirror, migration 0045,
the today-edit / day-pick routes and the layer model
(§2.1 of the Part 2 doc) stand untouched. With no draft
saved, every composed day is byte-identical to the
pre-v600 ship; a saved draft must produce exactly the
layer Part 2's at-once writes produced for the same
edits (the harness drives both paths on one fixture and
compares).

### 2.4 Gates (harness-v600)

Statics (the permanent bar · Save Today bar + draft
machinery · the retired at-once writes named) · the
v594p2 A/L equivalence legs carried whole (fold +
routes untouched) · real-DOM legs in the plain world:
the profiles bar stands clean and dirty, Save inert
when clean, the scroller's offset unmoved by the first
edit · Edit today writes nothing until Save today (the
payload and the composed day read before and after) ·
Save today writes pick + layer together (the warning
painted before) · a profile-whole draft writes no layer ·
the close prompt (Discard byte-identical · Stay keeps
drafting · Save today writes and closes) · the clear
act resets without writing · the ladder head shows no
mark while a draft stands unsaved · the both-paths
equivalence (draft-save vs the at-once route writes) ·
the locked-vault world: gate → unlock → draft → save
lands. Regression: harness-v594p2 · harness-v598 ·
harness-v597 if landed — every delta named; the retired
at-once assertions (v594p2's R3/R4/R8/R9 class) are
by-design reds under John's reversal, named per leg.

## §3 Implement

Client only (app/worker/src/client.ts; ui.ts carries a
comment update only — the frozen dress is reused, no new
CSS; index.ts untouched, no migration).

Edit profiles: `paintFrozen()` no longer hides the bar —
`barEl.hidden = false` always; the Save button carries
`disabled` while the draft is clean; the bar line paints
always ("{name} · unsaved changes" / "No unsaved
changes"). The frozen zone's height is now constant, so
the first edit cannot move the scroller's content.

Edit today, per §2.2: the draft {pickD, td, clearedD}
generalizes Part 2's draft builder (`buildDraftFor(key,
layer)`); every edit handler mutates the draft and
repaints only (`afterEdit` is repaint-only; the at-once
`persist()` is deleted — every `profPut` in the screen
lives inside `saveToday()`). The frozen Save today bar
(`.proffrozen593 .profbar593` dress, `data-p600savetoday`)
stands above the scroller, unhidden at first paint, its
button enabled exactly when the draft is dirty and its
line stating the draft's divergence sentence in the
standing words + " · unsaved changes" while dirty.
Divergences, badges, trace lines and the materialize
sentence all compute on the DRAFT (`draftLayerObj()`).
The pick warning stands whenever a standing layer
stands or the draft carries layer edits. The Clear act
resets the draft (pick := standing, td := the profile
whole, cleared := a layer stands) and never writes.
Close routes through `requestClose()` → the prompt
(`data-p600prompt`: Save today · Discard · Stay).

One defect caught by the harness during Implement
(R5's first run): the dirty check first compared the
draft against the PROFILE — a draft restating the
standing layer read dirty forever. The check now
compares against a standing snapshot (`standJson`,
taken whenever the draft is built from the standing
state) through the one diff machinery (`layerJsonOf`).
A tap away and back to the standing pick leaves the
draft without the standing layer applied — dirty, and
saving writes the profile whole: the clearing rule's
honest outcome, the warning having stood before the
first tap.

harness-v600: 33 ok / 0 not ok on the working tree AND
on a clean checkout of the committed tree (16eb7d6) —
T statics · the carried A/L equivalence legs · R1–R19
(the permanent bar + offset leg · draft writes nothing ·
pick + layer together · profile-whole writes no layer ·
clear resets without writing · the close prompt's three
acts · the ladder head unmarked by a draft · the
both-paths equivalence · the locked-vault world).

## §4 Review

PASS. The diff against main (5482e19) is four files:
client.ts (the two halves), ui.ts (a comment), the new
harness, this doc. index.ts untouched; marker grep 0;
the rendered client parses whole (T8).

Regression, every delta named:
- harness-v594p2: 28 ok / 6 not ok. T4 asserts the chip
  path's literal day-pick write (moved into saveToday —
  retired code shape) · R3/R4 assert Q1=A at-once
  semantics (retired by John's reversal) · R5's
  noPick precondition was R4's landed pick (a cascade
  of R4's red; the decoupling itself stands — the
  editor switched, and v600's legs cover the surface) ·
  R8/R9 assert the at-once land + at-once clear in the
  locked world (v600's R19/R9–R10 prove the same world
  under the draft model). All six by-design.
- harness-v598: 13 ok / 2 not ok. T4 asserts client.ts
  byte-identical to main (v598's presentation-only
  static; v600 changes the client deliberately) · R3c
  asserts the at-once flow in the locked world
  (retired; v600 R19 covers it). Both by-design.
- harness-v597: not landed (still at Scope) — nothing
  to run; the Ship rebase re-checks if it lands first.

Equivalence, both forms: with no draft saved, the
carried A1/A2 legs prove every composed day
byte-identical to the pre-Part-2 ship (the fold is
untouched); R16 proves a saved draft lands exactly the
layer the at-once route write lands for the same edits.

Ship stands HELD at the gate: a production break in
the server fold is being fixed forward by the v601
chain (rollback + corrected re-land in flight). Per
the standing serialization rule this chain does not
merge or deploy over that work; on v601's landing it
rebases onto the new main, re-verifies the merged tree
whole, and ships.

## §5 Ship

SHIPPED LIVE 2026-11-21 23:38Z (17:38 CT).

- Worker **eec180ed-0098-4d59-bf1c-ac1afd2e2ece** ·
  rollback target 1815cb47 (v601) · pin
  **ora-pro-nobis-v600-1** (in served sw.js).
- GitHub main **fe125b1** (merge of release/v600) —
  main pushed · remote in sync (Git Data API,
  byte-identical, 7 commits replicated with SHA
  assertions; whole-tree conflict-marker grep 0).
- What's New **416** · row 1574 **Live** ·
  shipped_records **790** · Ship record 2427 ·
  Ship contract 837, met.

### The ship defect + fix (named in the ship record)

The first ship attempt stopped at the merged-tree gate
on a failed combined drive, field-reachable in the
exact v601 shape. The draft inherits the standing
layer's contents for every block (a poisoned/healed
layer can carry e.g. Night: []); toggling Night OFF
removes it from the draft's coreBlocks, but
`layerJsonOf` still emitted the Night contents entry
(it differs from the composed contents). v600's
single-write Save today sent coreBlocks-without-Night
PLUS contents-for-Night in one body, and the
today-edit route validator refused the whole write:
"contents for a block that does not stand: Night".
The stored layer stood unchanged — the user's save
failed whole.

The fix (client side, commit 0dc6b20): the draft's
save serialization drops contents entries for blocks
the draft's coreBlocks does not stand — `layerJsonOf`
emits contents only for standing blocks (Novenas
excepted, as the validator stands it). The route
validator stands unchanged as the guard. Every other
v600 behavior is unchanged in effect.

### Gates

- harness-v600: **37 ok / 0 not ok** on the working
  tree, a clean checkout, and the merged tree — the
  combined drive now stands as legs D1–D4 (poisoned
  standing layer composes healed · Edit today opens
  over it · Night off stands in the draft with Save
  today live, nothing written · SAVE LANDS — Night off
  as saved, every other block at its healed count, the
  stored layer carrying no Night contents entry).
  On the pre-fix client D4 is red (the save refused
  whole; the standing layer unchanged) — the defect
  reproduced in-harness.
- harness-v601: 8 ok / 0 not ok (its B1 no-layer
  equivalence byte-identical stands; harness-v600's
  A1/A2 likewise).
- Regressions, named: harness-v594p2 28 ok / 6 not ok
  · harness-v598 13 ok / 2 not ok — the same by-design
  reds as §4, zero delta.

### Served proofs

- Served sw.js carries pin ora-pro-nobis-v600-1.
- Served app.js parses whole (1,193,516 chars); both
  frozen bars stand in the served client.
- Served-leg Edit today drive (the served client in
  jsdom over John's document + the poisoned layer):
  Edit today opens · Night off stands in the draft
  with Save today live · SAVE LANDS — the stored
  layer carries coreBlocks without Night and no
  Night contents entry.

### Field legs (John's)

- Edit profiles: Save · Save New stand at the top
  before any edit; Save greys while the draft is
  clean and lights on the first edit.
- Edit today: turn Night off — today does not change
  until Save today is pressed; then Night stands off
  for today.
- Edit today with a change, closed without saving:
  the prompt offers Save today · Discard · Stay.
