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
- **Fix note (Review defect R3-1, Fix seat
  2026-11-22):** the Q3 migration now also runs on
  the vault-unlock path. Inside `opnVaultApplyKey`
  (client.ts:1852), after the decrypted real document
  stands as the document, the standing migration
  family runs in its standing order (mig590-family
  first, then mig604) against the real document, and
  a migration persists through the standing vault
  persist path — exactly once (each migration's own
  flag gates re-runs; a second unlock writes
  nothing). The locked posture is unchanged: no
  migration against the ephemeral document, no
  envelope write before unlock. Proven by the new
  harness-v604 leg **M4** (old-build envelope over
  the M2 populated variant): M4 FAILS on the pre-fix
  branch HEAD f97bf40 (post-unlock both fields
  standing, `mig604` unset — harness 50 ok / 1 not
  ok, M4 the sole failure) and PASSES with the fix —
  harness-v604 **51 ok / 0 not ok**, harness-v603
  **50 ok / 0 not ok**. Full evidence in the build
  log's R3-1 fix section. Pin untouched (stays
  `ora-pro-nobis-v603-1` until Ship); no merge, no
  deploy in this seat.

## §4 Review — Independent Review seat, 2026-11-21 (contract 857)

- **Verdict: FAIL — one named defect (R3, below).** All
  other gates pass. Ship may NOT proceed until the
  defect is fixed forward or John accepts it in the
  open; the coordinator decides.
- **DEFECT R3-1 (migration never runs on the
  vault-unlock path):** `opnMigrateProfiles604` runs
  only on the plain-document load path (client.ts:1650)
  and at restore (:2371). The vault unlock path,
  `opnVaultApplyKey` (:1852), decrypts the real
  document into the cache and runs NO migration (the
  same shape stands for mig590 — pre-existing there,
  new for mig604). Driven proof (render R3, below):
  an envelope built by the OLD build over the populated
  variant (dayDefaults + picks standing, no mig604)
  opens locked on the new build — ephemeral document,
  envelope byte-identical, no phantom write (that half
  of R3 stands) — but AFTER unlock the real document
  still carries `dayDefaults` and `picks` with
  `mig604` undefined. On a vaulted device (the device
  shape; John's own shape since v578) the Q3 deletion
  therefore never happens: the fields stand inert (no
  reader remains; resolution and composition are
  unaffected), but the approved migration does not
  occur, and every later save re-persists them.
  Build log Group B's claim "runs in the doc-load
  path (real document only … R3 posture stands)" is
  incomplete: the unlock path is a real-document load
  it does not cover. Fix shape (for the coordinator,
  not built by this seat): run mig590 + mig604 inside
  `opnVaultApplyKey` after decrypt and persist; add a
  harness leg for the unlock path (the M legs run the
  plain path only — that is the coverage gap that let
  this through).
- **Gates on the final tree (Review's own runs,**
  **worktree at f44087e):** harness-v604 **50 ok / 0**
  **not ok** · harness-v603 **50 ok / 0 not ok**
  (stands, as required) · harness-v585 39/3 ·
  harness-v600 35/2 · harness-v601 7/1 — each count
  identical to the build log's, the non-green legs
  exactly the legs the build log retires by name.
- **Fail-on-old spot-checks (Review's own, against**
  **the ffd1bbe tree):** P1 — the old client resolves
  the populated variant's Sunday `little-way` by
  `pick` (new build: `benedictine` by standing) FAIL
  on old as required · M2 — the old build leaves
  `dayDefaults` + `picks` standing on the variant
  (keys list read firsthand) FAIL on old as required.
- **Driven renders (plan §6)** — jsdom drives of the
  branch's rendered client, saved under
  `~/workspace/projects/ora-pro-nobis/v604-review-renders/`:
  1. `01-one-page-all-collapsed.html` — 7 collapsed
  rows, 0 expansions, pick Edit stands, 0 edit acts.
  2. `02-one-page-all-expanded.html` — stored mode
  `expanded` restored at paint; 6 of 7 blocks expanded
  (the trackless block paints no expansion host; the
  harness F1 leg accepts blocks−1 on the same shape).
  3. `03a-edit-posture-clean-savenew-greyed.html` —
  handles + removes on every posture row, ADD row
  stands, Save New disabled while clean ·
  `03b-edit-posture-dirty-restore-line.html` — after
  one removal: restore line stands ("Removed: Morning
  Prayer"), Save New active, frozen banner stands
  ("Editing today only — Saturday, Nov 21" + Change).
  4. `04-question-sheet.html` — both targets named
  from the live fixture: "Today only — Saturday,
  Nov 21" · "Standing — in The Salesian Way, your
  every-day profile".
  5. `05-pick-flip-sheet.html` — chips for all three
  profiles, The Salesian Way marked on, warning
  standing verbatim: "today has its own edits —
  changing the profile clears them" (fixture with a
  today layer).
  6. `06-locked-vault-edit-tap.html` — device shape,
  vault locked: Edit tap stands the unlock card in
  place of the posture, 0 posture rows, stored
  envelope byte-identical (no write route ran).
  7. `07a-configure-ladder.html` — exactly two doors
  (Edit today · Edit profiles), head "Today follows
  The Salesian Way" · `07b-edit-today.html` — chips
  paint whole against the new payload, standing chip
  (Salesian) marked on.
  8. `08a-block-page.html` — the deep view paints
  unchanged (track cards + Play All stand) ·
  `08b-v585-title-card.html` — **the card itself NOT
  RUN in this drive:** the synthetic fixture tracks
  carry no resolvable episode descriptor, so the tap
  opens nothing; this is a fixture limit, not a
  regression claim — `paintBlockPage` and
  `openEpisodeCard` stand outside the v604 diff
  whole (grep of the diff: no hits), the one-page
  prayer posture's card rows are proven by harness
  O4, and harness-v585 stands at its baseline 39/3.
  Plus the **R3 check** (`R3-check.txt`): locked at
  first open — no mig604 write, no field deletion on
  the ephemeral document, envelope untouched (PASS);
  post-unlock — migration does NOT run (FAIL, defect
  R3-1 above).
- **NOT RUN coverage audit** (build's not-run
  sections; behavior → disposition):
  - v594 R worlds (vault gate on the Configure
    surfaces, incl. the mapping screen): the mapping
    surface is GONE by John's approval —
    superseded-by-design for that surface; the gate
    behavior itself is re-proven by harness-v604 W4
    (and Review render 6, firsthand) for the in-place
    surface and by harness-v600 R18 (green in
    Review's 35/2 run) for Edit today. No gap.
  - v590 §C4/C5 (contents seats reached through a
    day-pick write): the write they ride is removed
    whole by approval — superseded-by-design; the
    contents behavior is re-proven by harness-v604
    W2/S2/S3. §G1–G4 (old precedence: pick > day
    default > standing): superseded-by-design,
    replaced by harness-v604 P1 (Review spot-verified
    on both trees). No gap.
  - v591 §M1–M3 (the mig591 Sunday-seed legs):
    mig591 is retired whole with the map it fed —
    superseded-by-design; migration correctness is
    re-proven by harness-v604 M1–M3 on the plain
    path. The sections after M1 (profile data legs):
    the legs asserting dayDefaults state writes /
    day-pick writes are superseded-by-design; the
    standing profile CRUD they also exercise is
    re-proven by harness-v604 S/K/W legs. **One gap
    stands, and it is defect R3-1's root:** no leg in
    any suite runs a migration against a document
    loaded through the vault-unlock path — named as
    a coverage gap, severity HIGH for Q3 (it is
    exactly John's device shape), LOW for day
    composition (the fields are readerless).
  - v593 §F1/F2 (the data layer under the picks):
    their first act is a dayDefaults write the new
    build rejects by design — superseded-by-design;
    replacements harness-v604 V1 (named 400 + route
    gone, Review-run green) and K3 (chips write the
    standing pick). No gap.
- **Code reads (targeted, firsthand):**
  - `saveToday` read whole (client.ts:20586): the
    pick leg is cut clean — a changed chip clears the
    today layer first, then writes `standingKey` via
    `/profiles/state`; an unchanged pick writes the
    layer as drafted; `clearedD`/`pickD` reset and
    the rebuild stand after the chain. R1 holds.
  - Migration function (:2506): deletes exactly
    `dayDefaults` + `picks`, gated by `mig604`,
    `standingKey` never written. Call paths: plain
    load + restore only — see defect R3-1.
  - Third ladder host (:20244 `opnOpenAdd604`): the
    host is a variable (`host604`) holding exactly
    `{ids, add, layers, groups, ensure}` — the same
    five keys, in the same order, as both standing
    host literals (:20963 Edit today · :21438 Edit
    profiles); `ids` reads the scope's effective
    list, `add` materializes + writes per scope.
    D-3's contract claim is genuine.
  - Grep proof (Review's own): `dayDefaults` /
    `\.picks` in client.ts + index.ts return only
    the migration deletes, the import strip, the
    retirement comments, and the named-400 checks —
    zero readers, matching the build log's counts.
    No remaining WRITER to `/profiles/day-pick`
    exists anywhere in `app/worker/src` (only the
    two retirement comments name the route).
- **Deviation verdicts (build log D-1…D-6):**
  - D-1 (slot-picker per-date rows removed): WITHIN
    — the rows wrote the removed day-pick route; a
    stale writer cannot stand, and the plan's sweep
    missing them is a plan gap, not a build excess.
  - D-2 (ladder head keeps "Today follows <profile>"):
    WITHIN — post-collapse the followed profile IS
    the standing pick; the words name no retired
    mechanism, and the head's required content
    (standing profile + today-edits fact) stands.
  - D-3 (third host as a variable): WITHIN — the
    contract is identical (verified above); only the
    literal's placement differs, to keep the mandated
    harness-v603 50/0.
  - D-4 (two Edit today sub-lines reworded): WITHIN
    — Review verified the claim: the pick warning
    "Changing the pick clears today's edits." stands
    byte-identical (1 occurrence, old tree and new);
    the two changed sub-lines are the ones whose old
    words ("today's pick" · "Change for today only")
    would be false under the standing pick.
  - D-5 (pin deferred to Ship): WITHIN — plan §1.8
    places the bump at Ship; the standing pin legs
    stay green meanwhile.
  - D-6 (S3 reading): WITHIN — "original untouched"
    can only mean untouched BY THE MINT ACT in the
    standing scope (the session's own standing edits
    are the writes step 19 approves); S2 proves the
    strict byte-identity where it is claimable
    (today scope).
- **Field legs:** unchanged from the plan — John's
  device legs (in-place edit at prayer time · the
  Sunday flip by hand · Save New mint) stand open
  and are not claimed by this Review.

### §4 addendum — Fix verification (independent Fix-Verification seat, 2026-11-22)

- **Defect closed: R3-1.** As recorded above, `mig604`
  never ran on the vault-unlock path: `opnVaultApplyKey`
  decrypted the real document and ran no migration, so
  on a vaulted device the approved Q3 deletion of the
  stored `dayDefaults` + `picks` never occurred.
- **Fix seam (read firsthand in the diff
  `f97bf40..c933281`, `app/worker/src/client.ts`):**
  inside `opnVaultApplyKey`, immediately after the
  decrypted real document stands as `opnDocCache`, the
  standing migration family now runs against that
  decrypted real document only, in the standing order
  (`opnMigrateProfiles590` first, then
  `opnMigrateProfiles604` — the same order as the
  plain load path and restore), and if either migrated,
  the result persists through the standing vault path
  (`opnVaultPersist()`, awaited before the unlock
  resolves). Nothing else in client behavior changed:
  the diff is that one block plus its comment; the
  locked posture is untouched (no migration against
  the ephemeral document, no envelope write before
  unlock), and each migration's own flag gates re-runs.
- **Harness counts (this seat's own runs, worktree at
  c933281):** harness-v604 **51 ok / 0 not ok** ·
  harness-v603 **50 ok / 0 not ok** (stands, as
  required). Harness diff read firsthand: it adds the
  M4 vault-unlock leg and the `opnDoc` hook export it
  reads through, and changes no standing leg.
- **R3 drive (this seat's own, independent script in
  the Review seat's pattern; output saved as
  `R3-fix-check.txt` in
  `~/workspace/projects/ora-pro-nobis/v604-review-renders/`):**
  an old-build envelope over the populated variant
  (dayDefaults + picks standing) → new build, locked
  open: vault locked, envelope byte-identical, nothing
  migrated → unlock: the real document carries NEITHER
  `dayDefaults` NOR `picks`, `mig604` stands set,
  `standingKey` (`benedictine`) byte-identical, and
  `list` / per-profile `contents` / `todayEdits`
  byte-identical to the variant, with the migrated
  document persisted in the envelope → lock + unlock
  again: no second write (envelope byte-identical,
  document unchanged). **Drive verdict: PASS.**
- **Review verdict updated: PASS.** Defect R3-1 is
  verified fixed; ship may proceed. Standing note:
  the title-card render 08b stands as **NOT RUN**,
  with its named cover — the title-card/played-mark
  surface is outside the v604 diff, covered by O4 +
  the harness-v585 baseline. Field legs remain John's,
  as recorded above, and are not claimed here.

## §5 Ship (2026-11-21, Ship seat, contract 858 — run level TO SHIP)

- Pin: SW pin bumped on release/v604 in d3920f3
  (`ora-pro-nobis-v603-1` → `ora-pro-nobis-v604-1`,
  ui.ts CACHE); harness-v604 re-run on the branch
  tree after the bump: 51 ok / 0 not ok.
- Merge: release/v604 merged to main as 0427223
  (--no-ff). Main had not moved past the branch base
  ffd1bbe (verified before merge). Whole-tree marker
  grep: `dayDefaults` hits only in the migration
  deletes, the import strip, retirement comments, and
  the named-400 checks; `openDayMappingScreen593`
  zero hits; conflict markers zero.
- Push: 10 commits replicated byte-identical via the
  GitHub Git Data API with SHA assertions — main
  pushed · remote in sync at
  0427223af7afa7dd17a229a9fe5eabde2c821cb1.
- Gates on a clean checkout of the exact merged HEAD
  (0427223, tracked tree clean): harness-v604 51 ok /
  0 not ok · harness-v603 50 ok / 0 not ok. Note on
  refs: harness-v604 reads its old build via
  `git show main:`, so its clean run stood in a
  disposable clone with that clone's main ref at the
  base ffd1bbe (the harness's design environment, as
  on the branch tree); harness-v603's T11 pin-vs-main
  leg reads main the other way, so its 50/0 clean run
  stood with main at the merged HEAD. The checked-out
  tree was the exact merged HEAD, tracked-clean, in
  both runs.
- Deploy (connector-surrogate driver, from the
  standing clone at 0427223): Worker
  b63ffb5c-6a94-4adc-942b-512449736ede at 100% ·
  rollback target 90d4f7c0 (v603).
- Served proofs (https://app.orapronobis.media):
  served sw.js pin reads `ora-pro-nobis-v604-1`
  (v603-1 absent) · served app.js parses whole
  (1,224,850 chars, node --check OK) and carries
  `opnMigrateProfiles604`, `opn-praylistmode-v604`,
  and `opnOpenAdd604` (the one-page expansion), and
  does NOT carry `openDayMappingScreen593` · the
  door-mirror profiles payload state is
  {standingKey: "salesian", version: 6} — no
  `dayDefaults`, no `picks` · a served day composes
  under the standing pick: profiles effective for
  Sunday 2026-11-22 resolves to salesian with
  resolvedBy "standing" (no day-map flip), and the
  served player day for 2026-11-21 answers 200 with
  its composed day payload.
- Board closeout: What's New 420 · row 1578 Live
  (shipped_at 2026-11-22T03:55:00Z) ·
  shipped_records inserted and read back (see the
  Ship seat's closing report for its id) · Ship
  phase record 2445 passed · intake 1123 Done.
- Field legs: on the Praylist, open a block and pray
  from the expansion; tap Edit inside a block, answer
  the one question (today only / standing), remove a
  track and watch the restore line stand, then Save
  New and watch the mint become your standing pick;
  flip the standing pick from the plan row and watch
  the next day follow it — including a Sunday, which
  no longer flips on its own.
