# v598 — Edit today chips: the compact chip design

## §1 Scope

John's direct instruction (Ora thread, 2026-11-21 16:38 CT):
"Let's also make edit today follow the same compact chip
design as the other edit does."

Edit today's pick chips take the SAME compact chip design
as Edit profiles' chips — the compact Configure chip dress
(v592's compact family, carried into the v593 editor's
frozen chips row): same component, same size, same marked
state, same scrollable one-row posture.

Presentation only. Edit today's behavior stands exactly as
v594 Part 2 shipped it: the locked-vault gate
(profVaultGate594) stands first, the pick writes at once
through the standing day-pick route, changing the pick
clears today's edits with its warning standing in the paint
first, and the badges / count line / clear act / trace
lines are untouched. Edit profiles and Edit mapping are
byte-untouched in behavior. The composed day is
byte-identical before and after — equivalence is the gate.
Small release, streamlined path, TO SHIP on his direct
instruction. No migration, no data change.

## §2 Plan

One compressed Scope + Plan pass (small-release path). The
chip sweep read both screens' paints in client.ts and the
whole chip dress in ui.ts:

- ONE chip component already stands: every Configure
  screen's profile chips paint as `<button class="chip591">`
  in a flex nowrap scrollable row — Edit profiles
  (data-p593chip, in .profchips593 inside .proffrozen593),
  Edit today (data-p594tchip, in .profchips591 inside
  .proftoday594), Day mapping (data-p593mapchip). The
  marked state is the shared `.chip591.on` rule; the
  editor's dirty dot (.dot593) rides the same button.
- THE GAP is the dress, not the paint: the component's
  BASE dress (ui.ts .chip591) is the large form — padding
  7px 14px, min-height 44px, row margin 0 0 12px. The
  COMPACT form (padding 5px 11px, min-height 38px, row
  margin 0 0 8px, padding-bottom 2px) is not the
  component's own dress — it is re-declared per screen
  wrapper: .profplan590 / .profpop591, .proffrozen593
  (Edit profiles), .profmapscreen593 (Day mapping). Edit
  today (.proftoday594), a v594 Part 2 paint, stands in NO
  compact scope — so its chips render at the base 44px
  dress while Edit profiles' render at 38px. Same
  component, two sizes, decided by which wrapper scopes
  happen to name the screen.

Verdict: a bespoke DRESS application, not a bespoke paint.
The fix aligns by construction, not by copied values:
ui.ts only — the per-screen compact chip declarations
collapse into ONE rule naming every Configure-family
wrapper (.profplan590 · .profpop591 · .proffrozen593 ·
.profmapscreen593 · .proftoday594), and Edit today's
.profchips591 row joins the one compact row rule
(margin 0 0 8px, padding-bottom 2px). After the change no
Configure screen can fall back to the large dress by
omission: the compact dress is stated once, for the
family. client.ts is byte-untouched; every existing
scope's computed chip values are unchanged (the merged
rule carries the identical 5px 11px / 38px values).

Gates: harness-v598 (new) — statics (one compact rule,
proftoday594 named in it, no per-screen chip re-declaration
left, pin) + RENDERED legs driving the real client in a
jsdom world over John's v589 document in a real locked
vault envelope (the harness-v594p2 world): Edit today's
rendered chips and Edit profiles' rendered chips carry the
same classes and equal computed height / padding /
font-size / font-family · exactly one chips row on Edit
today · the pick tap still lands through the gate
(gate → PIN unlock → tap → pick written, layer cleared,
warning stood first) · equivalence A1/A2 (a Salesian
weekday and a Sunday compose byte-identical to the
pre-v598 ship). Regression: harness-v594p2 +
harness-v594, every delta named.

## §3 Implement

ui.ts only (3 insertions, 5 deletions); client.ts and
index.ts byte-untouched:

- The compact chip declarations collapse into ONE rule:
  `.profplan590 .chip591, .profpop591 .chip591,
  .proffrozen593 .chip591, .profmapscreen593 .chip591,
  .proftoday594 .chip591 { padding:5px 11px;
  min-height:38px; }` — the two per-screen chip lines
  (.proffrozen593's and .profmapscreen593's) and the
  plan/pop line's chip half are deleted; the surviving
  rule carries the identical values, so every previously
  compact screen computes byte-identical dress.
- Edit today's chips row joins the one compact row rule:
  `.profmapscreen593 .profchips591, .proftoday594
  .profchips591` added to the standing selector list
  (margin 0 0 8px, padding-bottom 2px); the mapping
  screen's duplicate row line is deleted into the same
  merge.
- A comment at the rule names the discipline: the dress
  is stated once for the family, so no Configure screen
  can fall back to the base 44px dress by omission.

harness-v598 (new, app/harness-v598.mjs): **15 ok / 0 not
ok** on the working tree — T1–T7 statics (the unified
rule · no re-declaration · the row rule · client.ts
byte-identical to main · the base dress standing · pin ·
rendered client parses whole) · A1/A2 equivalence
byte-identical · R1 the rendered chip equality (same
classes; computed min-height 38px, padding 5px/11px,
font-size 14px, same font stack — measured in a jsdom
world with the app's own APP_CSS injected as its sheet,
the served page's composition) · R2 exactly one chips
row on Edit today, nowrap + overflow-x auto · R3 the
locked-vault world: envelope over John's document → the
gate stands first → pad unlock → a block switch lands a
layer → the clearing warning stands → the pick tap lands
the pick and clears the layer · R3d the chips measure
compact in that world too.

## §4 Review

PASS. The diff was read whole: ui.ts only, 3 insertions /
5 deletions — the one unified compact chip rule, Edit
today's row in the one compact row rule, the two
per-screen re-declarations deleted, one comment. No other
line moved; client.ts and index.ts are byte-identical to
main (harness T4, and the merge base is the v594 Part 2
ship f6c553b).

Gates, all on the committed tree (fe74268):

- **harness-v598: 15 ok / 0 not ok** on a CLEAN CHECKOUT
  of the committed tree, matching the working tree.
- **Fail-on-old proof:** the same harness on the pre-fix
  tree (main f6c553b) runs **10 ok / 5 not ok** — T1/T2/T3
  (the unified rule absent; 3 per-screen re-declarations
  standing) and R1/R3d red, with R1's measurements the
  field defect in numbers: Edit profiles' chip computes
  min-height 38px, padding 5px/11px; Edit today's chip
  computes **44px, padding 7px/14px**. Every behavior leg
  (A1/A2, R3a–R3c) is green on both trees.
- **Regression, every delta named:** harness-v594p2
  **34 ok / 0 not ok — zero delta**. harness-v594 **7 ok /
  2 not ok — zero delta**: the identical R3/R6 reds stand
  on the base tree f6c553b (they assert the v593 chip
  coupling — a chip tap in Edit profiles switching today —
  which v594 Part 2 retired on John's picks; the v594
  Part 2 ship recorded the same 7/2). No behavior leg
  moved under a CSS-only change.
