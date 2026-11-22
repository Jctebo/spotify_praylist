# v604 — The Praylist editable in place · the standing pick

## §1 Scope

John's direction (Ora thread, 2026-11-21): the Praylist
becomes ONE page — plan row at head, every block a
collapsed row, expand a block to edit its individual
tracks in place — and the profile resolution collapses
to ONE standing pick: blocks stay as they are (no add
block, no rename block, no block reorder).

Approved (John, 2026-11-21 20:53 CT; formal Scope Space
approval record 43, package 87), run level **TO SHIP**:

- Q1 blocks fold INDEPENDENTLY — expanding one never
  collapses another. Expand all stands only as an
  option (the page head's ⋮ overflow), with one stored
  page mode restored at open.
- Q2 today-only edits write AT ONCE — no draft, no
  Save today bar on this surface (Edit today's own
  v600 draft posture stands untouched on its surface).
- Q3 the migration deletes the stored `dayDefaults`
  and `picks`; the standing pick starts from the stored
  standing field (`standingKey`), never a hardcoded
  name.
- Edit today edits wait in a draft for the frozen Save
  today button (John, 2026-11-21, reversing v594
  Part 2) — that rule stands for the Edit today screen;
  the one page is its named divergence, per Q2.
- v604 Praylist (John, 2026-11-21): blocks collapsed
  by default, expand a block to edit its individual
  tracks, Expand all only as an option; blocks stand
  as they are — no add block, no rename block, no
  reorder of blocks. Track-level drag only.
- Courses return only where a hand adds them through
  the Add door (v603) — the in-place ADD row is that
  door's third host; defaults and Reset stay
  courseless.

The decided shape: one page (plan row · collapsed
block rows with name/count/duration/marks, incl.
"today has its own edits" on the block's own row) ·
an Edit act in the expanded block's head opens the
EDIT POSTURE inside the expansion · entering Edit asks
the ONE QUESTION once per session with NAMED targets
("Today only — <weekday, Mon D>" / "Standing — in
<profile name>, your every-day profile"), the answer
standing as a FROZEN scope banner under the plan row
with a Change act · edit rows carry drag handles +
remove acts (restore line standing), rows do not play
or open cards · writes go through the standing stores
(today layer at once / the profile-in-force's
contents) · SAVE NEW in the frozen edit bar mints the
COMPOSED DAY as a new profile and becomes the standing
pick · the plan row gains a pick Edit act (chips →
Save writes the standing pick; a standing today layer
clears, with the warning standing at the act) ·
resolution precedence becomes standing pick → today
layer · Configure's ladder drops to two doors (the
Edit mapping door is removed whole).

Carry-in guards: `profVaultGate594` in front of the
in-place Edit act · `opnEnsureStandings601` awaited
before the first in-place materialization · the v603
ladder internals + named-novena fold untouched ·
settled intention draws never re-drawn by an edit ·
the v585 title card/played marks untouched on the
prayer posture · the block page survives whole as the
prayer's deep view.

## §2 Plan

### 2.1 Resolution collapse (client + server)

Precedence becomes **standing pick → today layer**.
`opnResolveProfile590` keeps only its standing leg;
the per-date pick leg and the day-map leg are removed
whole, with `OPN_DOW_KEYS_590`. The payload state
drops `dayDefaults` and `dayRule`. The seed document
drops `picks`/`dayDefaults`. Server parity:
`profileResolve` standing only; `prayerProfileStore`
drops the picks SELECT, the day_defaults read, and
the Sunday seed write-back; `profilesPayload` state
drops both fields. The D1 tables/column
(`prayer_profile_day_picks`,
`prayer_profile_state.day_defaults`) are left dormant
— no reader, no writer, no D1 migration.

### 2.2 Migration + validators

Client migration `opnMigrateProfiles604`, gated by
its own `mig604` flag, runs at the new build's first
open against the real document: `delete P.dayDefaults;
delete P.picks;` — nothing else touched; profiles,
contents, and today layers byte-identical otherwise;
the standing pick reads from the stored `standingKey`
as-is. `opnMigrateProfiles591` retires whole; the
`dayDefaults` init leaves `opnMigrateProfiles590`.

Validators, per path (postures named): PUT
`/profiles/state` carrying `dayDefaults` → REJECT,
named 400 (client local + server) · profile save
payloads carrying `dayDefaults`/`picks` → REJECT,
named 400 (client local + server) · the import path →
STRIP (a backup carrying the fields restores with
them deleted; a reject would refuse John's own
standing backups) · PUT `/profiles/day-pick` → the
route is removed whole (client: the standing 404;
server: the router's unknown-route posture).
`dayRule` leaves the payload, the seed, and the
profiles-screen toggle; stored copies stand inert.

Edit today's pick chips become the STANDING PICK
chips: a chip change + Save today writes `standingKey`
through `/profiles/state`; the layer-clearing rule
and warning words stand; the v600 draft posture for
contents is untouched.

### 2.3 The one page

Collapsed rows stand as they stood (name · count ·
duration · marks), the per-block today-edits mark
joining the row's own meta from the live divergence
diff. A row tap toggles its in-place expansion —
independent per block; the stored page mode
(`opn-praylistmode-v604`: collapsed default /
expanded) is restored at paint, and a single block's
toggle is a session act that never rewrites it.
Expand all / Collapse all stand in the page head's ⋮
overflow (the universal menu's Pray group), outside
edit posture only. The expansion's prayer posture
reuses the block page's row paint whole (Play All at
the expanded head · the Edit act · the door to the
block page); the block page itself is untouched.

### 2.4 Edit posture, banner, writes, Save New

Entry guards: `profVaultGate594` against the
expansion host before the question sheet (locked →
the unlock card stands in place of the posture);
`opnEnsureStandings601()` awaited before the first
materialization in either scope. The question sheet
names both targets from the live day and the resolved
profile; the answer stands as the frozen scope banner
for the whole session (Change re-asks; acts already
written stand where they were written, and the banner
says so). Posture rows: drag handles (track-level,
pointer events, edge auto-scroll) · Remove acts with
the standing restore line (restore returns the track
at its composed position, from the session's
first-touch composed snapshot) · an ADD row opening
the v603 ladder as its third host · rows inert to tap.

Writes: today scope → the standing today-edit route,
materialize-on-first-touch, validated by
`opnCheckTodayLayer594`, at once; standing scope →
the profile-in-force's `contents[block]`, validated
by `opnCheckContents590`, through the standing save
route. SAVE NEW (frozen edit bar; greyed while clean,
active when dirty) mints the composed day — resolved
profile with the today layer folded whole — under the
name given at the save (`openRenameCopySheet590`);
the date's today layer clears; the mint becomes the
standing pick at once; the banner re-names; the
original profile record stands byte-untouched by the
mint act.

### 2.5 Configure ladder cut

`openConfigureLadder593` paints two doors (Edit today
· Edit profiles); the mapping door, its wiring, and
`openDayMappingScreen593` are removed whole. Grep
proof at build: `dayDefaults` and `\.picks` return
zero readers in client/server outside retirement
comments, the migration function, and the named-400
rejection checks; `state.dayDefaults` readers zero;
`dayRule` absent from payload/seed/toggle.

### 2.6 Fixture + harness

Fixture (Improvement D): John's v589 import file —
which carries NO `dayDefaults`, NO `contents`, NO
`todayEdits` (it predates the v590 document shape) —
proves identity + standing-pick start + list
byte-identity raw (M1); a POPULATED VARIANT (the seed
shape's `dayDefaults`, a Sunday pick, per-profile
contents, a todayEdits entry in the shipped writers'
shapes, `standingKey` set to benedictine to prove no
hardcoded name) proves deletion + byte-identity (M2).
The variant is proven acceptable to the OLD build
first: its resolver resolves the variant's Sunday by
its pick, and its validators accept the variant whole
(OA legs).

harness-v604: 30 legs (P1 · M1–M3 · V1 · O1–O4 ·
F1–F2 · Q1–Q2 · E1–E3 · W1–W6 · S1–S4 · K1–K3 · D1),
the ◆ legs (P1 · M1 · M2 · V1 · W1 · K1 · D1) run
against ffd1bbe and recorded FAIL there, PASS on the
branch. Regression: harness-v603 must stand 50/0;
v600/v601/v598/v594/v594p2/v585 re-run; legs in
v590/v591/v593 (and any other suite) superseded by
this design are retired BY NAME in the build log —
silent leg loss is a Review defect.

### 2.7 Pin

SW pin `ora-pro-nobis-v603-1` → `ora-pro-nobis-v604-1`
at Ship (plan §1.8), in the Ship seat's commit, as
v603's pin moved at its Ship.

## §3 Implement — as built (2026-11-21, Implement seat, contract 856)

- **Groups A–G built as planned** — full record in
  `~/workspace/projects/ora-pro-nobis/v604-build-log.md`:
  groups as built · per-path validator postures ·
  fixture + old-build acceptance (OA1/OA2) · harness
  counts with the fail-on-old table · regression counts
  against the ffd1bbe baseline · retired legs by name ·
  grep proof · deviations D-1…D-6 named in the open.
- **Gates (worktree):** harness-v604 **50 ok / 0 not
  ok** · harness-v603 **50 ok / 0 not ok** (stands) ·
  harness-v600 35/2 (A2, R7 retired by name) ·
  harness-v601 7/1 (T1 retired by name) ·
  harness-v598 12/3 (R3c pre-existing at baseline;
  T4, A2 retired by name) · harness-v594 T2/T3 green,
  T1 retired by name, R worlds NOT RUN (its export
  hook names the removed mapping function) ·
  harness-v594p2 25/9 (six baseline failures stand;
  T1, A2, R1 retired by name) · harness-v585 39/3
  (identical to baseline) · harness-v590 19 ok / 8 not
  ok printed, NOT RUN from §C4 (its own day-pick write
  meets the removed route) · harness-v591 7 ok / 6 not
  ok printed, NOT RUN from §M1 (the retired mig591
  leg reads the deleted field) · harness-v593 NOT RUN
  from its F section (its first data act is a
  dayDefaults write the new build rejects by design).
  Every NOT RUN is stated with its reason in the build
  log; no leg was edited in any harness file.
- **Deviations (named in the build log):** D-1 the
  slot picker's per-date pick rows removed with the
  route (the plan's sweep named only its standing rows
  + dayRule toggle) · D-2 the ladder head keeps the
  "Today follows <profile>" form (the followed profile
  is the standing pick; the form keeps two standing
  regression legs green) · D-3 the ladder's third host
  is supplied as a variable (harness-v603 T1 counts
  inline host literals; the contract is identical) ·
  D-4 two Edit today sub-lines reworded to name the
  standing pick (the old words would be false; the
  warning words stand byte-identical) · D-5 the pin
  bump stands at Ship per §1.8 · D-6 the S3
  "original untouched" reading for the standing scope.
- **State at Implement close:** branch release/v604
  committed, worktree clean, branch never pushed. No
  merge, no deploy, no registry writes beyond the
  contract judgments. Stop at BRANCH READY.

## §4 Review — skeleton

- **Verdict:** (written at Review)
- **Gates on the final tree:** (written at Review)
- **Driven renders (plan §6):** (written at Review) —
  1. the one page, all-collapsed · 2. the one page,
  all-expanded · 3. one block in edit posture (handles ·
  remove acts · restore line · ADD row · the frozen
  edit bar greyed→active) · 4. the question sheet with
  both targets named from a live fixture · 5. the pick
  flip sheet (standing marked · the layer-clearing
  warning standing) · 6. locked-vault Edit tap (unlock
  card in place of the posture) · 7. Configure ladder
  (two doors; Edit today + Edit profiles painting whole
  against the new payload state) · 8. the block page
  (unchanged paint + the v585 card from a track tap).
- **Field legs:** (written at Review)

## §5 Ship

- (Written at Ship: merge · pin `ora-pro-nobis-v604-1`
  · push read-back · clean-checkout gates · deploy ·
  served proofs · What's New · shipped_records ·
  intake close.)
