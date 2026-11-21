# v594 Part 2 — The three-door ladder (Edit today · Edit profiles · Edit mapping)

DevOps Board row **1568** (shared with Part 1, the chip-tap fix — Live,
What's New 409). Scope: package 85, approved **TO SHIP** by John
2026-11-21 15:51 CT (formal Scope Space approval record 41; the chat
approval and the record agree exactly). Build chain:
chain-v594-part2-build, one chain Plan · Implement · Review · Ship on
branch `release/v594-part2` off the one standing clone, base main
**7626e6a** (v594 Part 1's gate + v595's merged plan row both stand on
it). Pin: **ora-pro-nobis-v594-2**.

**Records handling (named once, here):** row 1568's canonical phase
records are all occupied and the board's transition graph holds a
passed phase final — Scope 2391 stands as Part 2's own Scope record
(passed, holder chain-v594-scope); Plan 2396 · Implement 2397 ·
Review 2398 · Ship 2399 are Part 1's, passed, and are NOT overwritten
or re-claimed. Part 2's phase passage is carried by (a) new time
contracts under holder chain-v594-part2-build with expectation names
prefixed "Part 2 —" (Plan 812 · Implement · Review · Ship — ids in
§5), (b) this document, (c) a ship note appended to row 1568's
run_directive at Ship.

## 1. Scope (as approved — package 85, all picks John's)

John's design (2026-11-21 15:36 CT): "Maybe a 3 ladder edit today,
edit profiles, and edit mapping. Today just presents today and let's
you edit it and only changes today. Profile allows profile changes
and day mapping maps everything."

- **The ladder carries THREE doors** — Edit today · Edit profiles ·
  Edit mapping — each opening its own full screen; every screen's
  Close returns to the ladder. The ladder head states today's
  standing whole: "Today follows X" + "· today has its own edits"
  whenever a layer stands for today (Q5=A).
- **EDIT TODAY (new screen):** opens on today's composed day · the
  pick chips at its head change today's pick for today only, writing
  at once; changing the pick CLEARS today's edits, and the row says
  so before it writes (Q2=A) · edits STAND AT ONCE (Q1=A) — no
  draft, no Save; the layer materializes per-block on first touch
  (untouched blocks follow the profile live) · divergences badged in
  place in fact language + the head count line ("Today differs from
  X in N places") + ONE clear act: "Clear today's edits — follow the
  profile whole" (Q4=A) · the teaching line stands: "Changes here
  stand for today only. To change every day, use Edit profiles." ·
  contents-touched blocks carry the materialize sentence ("Set for
  today — stands as listed · new prayers added to <profile> will not
  join today").
- **EDIT PROFILES (the v593 editor, decoupled — findings §4.3's
  delta, exactly):** chips switch the editor only (no day-pick, no
  day rebuild; the switch prompt guards the draft only) · the
  head/status names the edited profile, never "today follows" · the
  chips lose the today tag (marks: on-screen + dirty dot) · the
  standing warning line under the profile's name: "Changes here
  stand in every day that follows this profile." (Q3=A) · everything
  else from v593 stands (dirty-only acts bar, jump strip + scrollspy
  + hairline, anchored repaints, This profile zone, the two standing
  sheet exceptions).
- **EDIT MAPPING:** the v593 screen, unchanged.
- **The divergence mark beyond Edit today:** the Prayer plan row (the
  v595 merged one-row form) carries the short form "· today has its
  own edits" whenever a layer stands for today. Divergence is always
  a live diff against the profile's CURRENT shape — no stored
  edited flags.

**Named constraint (Part 1's lesson, carried per the seating
addendum):** every surface built or touched follows Part 1's
locked-vault gate discipline. While the v578 vault stands locked,
`opnLocalApi` refuses every personal WRITE (423 vault_locked) while
reads ride the ephemeral default document — the exact break Part 1
repaired at the editor and the mapping screen with
`profVaultGate594`. EDIT TODAY is a new surface: its load and every
write (layer writes, pick chips, the clear act) stand behind the
same gate, reusing `profVaultGate594`. The harness proves the new
surfaces in a LOCKED-VAULT world (a real vault envelope over John's
document, cold session: gate stands → PIN unlock → surface loads →
a write lands), not in the plain-document world alone.

## 2. Plan

### 2.1 The layer as data (findings §1 + §5, binding)

`todayEdits` lives in `sections.profiles` of the on-device document,
date-keyed exactly as `picks` is. An entry is profile-shaped:
`{ baseProfileKey, coreBlocks?, layers?, contents? }` — a field
stands in the entry only once that aspect is touched for that date;
fields the entry does not carry fall through to the resolved
profile's shape. `contents` is per-block: a block's entry stands
only once that block's contents are touched (the materialize
discipline — at first touch the block's list materializes from the
composed list, so an item toggle never silently drops the block's
other items). `coreBlocks`, when carried, is the day's full ordered
core list as authored (it may be empty — turning every block off for
today is a legitimate authored state; the divergence badges and the
clear act keep it visible and reversible). `baseProfileKey` names
the profile resolved for the date when the layer was authored; it is
provenance, never a rebase trigger — a later profile change never
rebases the layer; divergence is recomputed live.

- **Writes** go through the local API shim family: a new route
  `PUT /api/prayer/profiles/today-edit` `{date, layer}` — `layer`
  null, or an entry carrying no fields, DELETES the date's entry
  (the day-pick delete pattern). Validation mirrors the save route:
  baseProfileKey names a standing profile; coreBlocks an ordered
  subset of the six hours; layers through `opnCheckLayers`;
  contents through `opnCheckContents590` against the effective core.
  The write shares `bump()` and **prunes past-date entries** (date <
  today) on every profiles PUT. The Edit today pick chips write
  through the EXISTING day-pick route (the path Part 1 repaired) —
  no parallel write path.
- **The fold** (`opnFoldDay590`) applies the entry AFTER the
  resolved profile, for that date only: coreBlocks/layers replace
  when carried; contents merge per block (a carried block's list
  replaces the profile's list for that block; uncarried blocks fall
  through). Absent entry = the fold is the pre-Part-2 fold,
  byte-identical. The composed payload's `profile` gains
  `todayEdits: true` when an entry stands for the date AND the live
  diff is non-empty — the mark the plan row paints.
- **The profiles payload** gains `todayEdit` (the entry for the
  requested date, or null) so Edit today, the ladder head, and the
  divergence diff read one shape in every mode.
- **Server parity (the private shape):** migration **0045** adds
  `today_edits` (TEXT, JSON) to `prayer_profile_state`, mirroring
  0044 exactly (read in its own try — a pre-0045 store reads as an
  absent map). The server store carries it; `profileFoldOf` applies
  the entry after resolution and stamps the same `todayEdits` mark,
  so the server day composition (blocks, additions, readings seat —
  all read from the fold) honors the layer with no downstream
  change; a mirror `PUT /api/prayer/profiles/today-edits` route
  validates and writes it; `profilesPayload` gains `todayEdit`.
- **Divergence (one definition, every surface):** a live diff of the
  layer-applied shape against the resolved profile's CURRENT shape:
  a core block standing in one shape only (off for today / added for
  today) · a layer on-state differing · a Podcasts series standing
  in one shape only · per contents block the layer carries: an item
  standing in the profile-composed list only (removed for today) or
  in the layer's list only (added for today), or the same items in a
  different order (one divergence for the block). The count line
  counts these entries. No layer, or a layer whose applied shape
  equals the profile's, diverges in zero places — the marks hide and
  the clear act still stands while an entry exists.

### 2.2 Settlement 1 — intention draws on a mid-day today-edit: DRAWS STAND

The draw store (device: `opn-draws-local-v1`; private shape: the
server track-draws rows) is keyed by (date, track key) and settles on
ask: a key with a draw keeps it; a key without one draws from the
pool at the ask. It holds no composition state, so a today-edit
re-settles nothing and needs no draw code. A removed track's draw is
simply never asked for again that day — and if the edit is undone the
same day, the track returns WITH its draw, which is exactly the
standing rule (built-day tracks settle at day build and keep the
draw all day). An added track has no draw and draws when first
asked — the standing path for tracks outside the built day. Both
re-settle candidates were rejected: re-settling the whole day would
change intentions on tracks the edit never touched; re-settling only
the affected blocks would still swap the intention on a track John
may be mid-prayer with, against the keep-all-day rule v539 settled.
Draws stand while composition changes.

### 2.3 Settlement 2 — export/import: todayEdits RIDES the v570 file

The layer lives inside `sections.profiles`, which the export clones
whole (`opnExportText`) and the validator carries: `todayEdits: {}`
is added to the default document's profiles section so the
validator's missing-key fill names it explicitly, and
`opnValidateImport` validates each entry with the same checks as the
write route (an entry that fails validation is dropped, never
guessed — the restore never refuses the whole file over a layer).
A restored entry for a PAST date is inert and prunes on the next
profiles write; a restored entry for TODAY restores John's today as
he left it — it is his edit, in his file, on his recovery path.
Stripping was rejected: it would silently drop a same-day edit on
the one recovery path the public build has — the v589
silent-section defect in mirror image. The harness proves the
round-trip (export → validate → restore → the layer stands
byte-identical) and the absent-section case (a file without
`todayEdits` restores with no layer and no refusal).

### 2.4 The surfaces

- **Ladder** (`openConfigureLadder593`): gains the Edit today door
  (first), the two standing doors keep their words, and a head state
  line painted from the profiles payload: "Today follows X" +
  " · today has its own edits" when the diff for today is non-empty
  (Q5=A). Door sub-lines carry the consequences (findings §4.1):
  Edit today — "Today's prayer as it stands — changes stand for
  today only." · Edit profiles — "What a profile stands — changes
  stand in every day that follows it." · Edit mapping — "Which
  profile each day follows — every day and each weekday." Every
  door's screen Close returns to the ladder (Edit profiles' Close
  already does via `fromLadder`; Edit today and mapping likewise).
- **Edit today** (`openEditTodayScreen594`, new): full screen on the
  standing pattern; gated by `profVaultGate594` before load. Head:
  the pick line ("Today follows X — the chips change today's pick")
  + the pick chips; when an entry stands, the pick row carries its
  warning verbatim: "Changing the pick clears today's edits." (the
  word stands BEFORE the tap writes — Q2=A); a pick tap writes the
  day-pick first, then deletes the entry, then reloads. The
  divergence line ("Today differs from X in N places" / "Today
  stands as X stands it.") + the clear act when an entry stands.
  The teaching line stands under the head. Blocks paint as the
  editor paints them (switch + steppers, contents open under on
  blocks) over a draft-shaped object initialized from the composed
  shape; EVERY edit persists at once through the today-edit route
  (the layer recomputed from the draft-vs-profile diff) and
  repaints anchored, then rebuilds the day. Badges in place: "off
  for today (X stands it on)" on a block/layer the profile stands
  and today drops; "added for today" on one today stands and the
  profile does not; contents items carry "added for today" where
  added; removed items stand as ONE foot line per block ("Removed
  for today: A · B") with a per-item restore act. A block whose
  contents the layer carries shows "Set for today — stands as
  listed" + the materialize sentence; an untouched block shows "As
  X stands it". No Save act stands anywhere on the screen (Q1=A).
- **Edit profiles decoupling** (five named changes, nothing else):
  (1) `doSwitch` retires — a chip tap opens the tapped profile's
  draft (scroll to top, Q6=A stands), with NO day-pick write and NO
  day rebuild; the switch prompt (Q1=B) guards the draft only, its
  Save path saving the draft then opening the tapped profile.
  (2) The dirty bar's status line loses its today clause — it reads
  "X · unsaved changes". (3) The body head's "Today follows X" line
  retires; the Q3=A warning line stands under the profile's name:
  "Changes here stand in every day that follows this profile."
  (4) The chips lose the today tag; marks are the on-screen chip +
  the dirty dot. (5) Save / Save New / Reset / Delete keep their
  standing behavior, including the day rebuild after a record write
  (a saved profile that today follows SHOULD recompose today — that
  is a record write, not the retired chip coupling).
- **Prayer plan row** (`profPlanRowHtml`): the meta line gains
  " · today has its own edits" when the day payload's profile
  carries the `todayEdits` mark. The merged one-row form stands;
  the retired card does not return.

### 2.5 Gates (harness-v594p2, new)

Committed tree + clean checkout: the ladder paints three doors with
the head state · Edit today opens on the composed day, a first touch
materializes only that block · an edit stands at once and the day
recomposes · the pick change clears the layer with its stated word ·
divergence badges + count + removed-item trace + restore · the
clear act deletes the layer and the day follows the profile whole ·
a layer on OTHER dates only leaves today byte-identical · NO layer
anywhere = byte-identical composition vs the pre-Part-2 ship
(equivalence: A1 Salesian weekday + A2 Sunday) · Edit profiles chips
fire no pick and rebuild no day · the warning line stands · the plan
row carries the mark when a layer stands · export/import round-trip
as §2.3 decided, proven · locked-vault R legs (gate → unlock → load
→ write lands) for Edit today and the decoupled editor · personal
data + prayer seats byte-exact. Regression: harness-v593 + v594 +
v595 with every delta named (the v593 legs asserting the retired
Q2=A chip coupling are by-design reds under Part 2's picks).

### 2.6 Files

`app/worker/src/client.ts` (layer model + fold + shim route +
payload field + ladder + Edit today + editor decoupling + plan-row
mark) · `app/worker/src/index.ts` (store + fold + payload + mirror
route) · `app/migrations/0045_profile_today_edits.sql` ·
`app/harness-v594p2.mjs` (new) · `app/worker/src/ui.ts` (pin only) ·
this doc. No other surface moves.

## 3. Implement

Branch `release/v594-part2` off the standing clone at main 7626e6a.
Built exactly as planned (§2), in `client.ts` + `index.ts` +
migration 0045:

- **The layer model** (`opnTodayEntry594` · `opnCheckTodayLayer594`
  · `opnApplyTodayLayer594` · `opnTodayDivergence594` ·
  `opnPruneTodayEdits594`): `todayEdits: {}` joins the default
  document's profiles section; the payload gains `todayEdit`; the
  fold applies the entry after the resolved profile and stamps
  `profile.todayEdits` when the live diff is non-empty; the shim
  gains `PUT /api/prayer/profiles/today-edit` (null or field-less
  layer deletes the entry; every profiles PUT prunes past dates
  first); the import validator validates each entry with the write
  route's checks and drops a failing entry, never the file
  (Settlement 2). No draw code stands or moves (Settlement 1).
- **The ladder** paints three doors with the findings' sub-lines
  and the Q5=A head line, painted from the profiles payload.
- **Edit today** (`openEditTodayScreen594`): gated by
  `profVaultGate594` before load (the addendum's discipline, Part
  1's exact pattern). Pick chips write the standing day-pick route
  after clearing the layer through the today-edit route; the
  warning stands in the paint whenever an entry stands. Every edit
  recomputes the layer from the draft-vs-profile diff and writes it
  at once, repaints anchored, and rebuilds the day. Badges, the
  count line, the removed-item trace with per-item restore, the
  materialize sentence, and the clear act all stand as specified.
- **Edit profiles decoupled** (the five named changes of §2.4, and
  nothing else): `doSwitch` opens the tapped draft only — no
  day-pick call, no `profileRebuild`; the bar line reads "X ·
  unsaved changes"; the "Today follows" head retires and the Q3=A
  warning stands under the profile's name; the chips lose the
  today tag. Save / Save New / Reset / Delete / the switch prompt
  stand untouched, including the rebuild after a record write.
- **Server parity**: migration 0045 (`today_edits` TEXT on
  `prayer_profile_state`); the store reads it in its own try;
  `profileFoldOf` applies the entry and stamps the mark via
  `todayLayerDiverges594`; `profilesPayload` gains `todayEdit`;
  the mirror `PUT /api/prayer/profiles/today-edit` validates
  through the standing helpers and writes + bumps in one batch.
- **The plan row** appends " · today has its own edits" to its meta
  line when the folded payload's profile carries the mark.

**Defect caught by the harness pre-ship (named):** the two new
date regexes were first written with single backslashes; inside
the APP_JS template literal they rendered as a literal `d`, so the
today-edit route refused every date. harness-v594p2's L1 leg
caught it on the first run (the harness drives the RENDERED
client — the v568 lesson); both regexes now stand in the standing
doubled form, matching every neighboring route.

**harness-v594p2 on the working tree: 34 ok / 0 not ok** — T
statics ×12 · equivalence A1/A2 · data legs L1–L11 (layer write,
recomposition + mark, divergence count, clear, other-dates
isolation, per-block materialization, validation, pruning,
export/import round-trip ×3) · real-DOM legs R1–R9 (ladder +
head, Edit today open + at-once write + divergence line + badge,
pick-clears-layer with the warning standing, the decoupled editor
chip, and the locked-vault world: gate → pad unlock → write lands
→ clear act).
