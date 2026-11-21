# v590 — Profiles: intuitive to see, plain to configure

## §1 Scope

John's direction (Ora thread, 2026-11-21 12:39 CT): "I would like to make the
profiles more intuitive and easier to configure. We seemed to lose the 3
profile configs and the settings in the profile are confusing."

Approved (John, 2026-11-21 12:46 CT; Scope Management Space package 82, the
revised package): Q1 A — one Profiles screen: the three defaults as cards; a
profile opens to plain block rows (on/off, in order) + two layer switches
(Novenas · Podcasts). John's Q1 comment: the profiles are more like default
configs — they set all the selections. Q2 A — the three defaults stay
pristine; any change saves as his own copy. REVISION ORDERED BY JOHN (same
message): the scope also includes CONTENTS — a profile carries contents, with
the ability to edit both blocks and contents. This supersedes the 2026-11-17
blocks-only line for this item; the reversal is named in package 82. Run
level: Through Plan.

Amended at the Plan gate (John, Ora thread, 2026-11-21 12:58 CT): two
amendments — rename-on-save, and a per-day default profile — folded into
§2.2, §2.4, §2.5, §2.6, §2.7, §2.8 and stated whole in §2.9. The run
level stands Through Plan.

## §2 Plan

### 2.1 The diagnosis — the defaults stand in the data; in the shape John runs they are unsurfaced, and the day is not shaped by them at all

Read from the shipped build (standing clone at GitHub main 8d3a2e8), the
served payloads (public host, 2026-11-21), and John's own import files
(`john-personal-data-import.json` and `john-personal-data-import-v589.json` —
their profiles sections are byte-identical and stand as the production
fixture).

**The three configs were never dropped.** `OPN_SEED_PROFILES`
(client.ts:2385) carries all three, and John's on-device store carries them
in full: little-way (Morning · Night; layers off), salesian (Morning ·
Midday · Evening · Night; Novenas on; Podcasts on with series
[bible-in-a-year, exorcist-files, daily-gospel-exegesis, daily-readings]),
benedictine (all six hour blocks; Novenas on; Podcasts on with
[daily-readings]); standingKey salesian, dayRule true, picks {}. The local
layer answers the whole profile contract from that store: the payload
(`opnProfilesPayload`, client.ts:2419), the pick sheet, the editor, and the
save/delete/layers routes (client.ts:2608–2689). Nothing in any migration
(v568 local layer, v570 export/import, v578 vault) removes them — the merge
at load fills missing section keys from the seed and keeps a standing list
(client.ts:2280–2284).

**They are unsurfaced to the point of absence — and the fold itself is
missing in the public shape.** The only door to any profile surface is the
profile card on the Pray side (Listen home), and the card paints only when
the day payload carries a profile fold (`profileCardHtml` returns '' when
`day.profile` is null, client.ts:19241). Since the v564 domain move, the
public host composes the day under `pub`: no profile store is read
(index.ts:1027–1031) and the profiles route on the public host answers
empty by design (index.ts:167). Verified live 2026-11-21:
`GET app.orapronobis.media/api/player/day` returns `profile: null` and all
blocks in standing order (Novenas, Morning, Midmorning, Midday, Afternoon,
Evening, Night). No client code recomposes the day from the local profile —
in client.ts, `coreBlocks` is read only by the profiles payload, the editor,
and the save route. So on John's phone today:

- No profile card stands on the Pray side; the Change sheet and the editor
  behind it are unreachable.
- The day is NOT shaped by any profile: every block stands, whatever his
  standing default (The Salesian Way) says. His Novenas and Podcasts layers
  take effect only through their own separate surfaces, not through the
  profile.
- The one profile-shaped thing that does stand — the Podcasts layer series
  resolution and the Daily Readings seat — is driven server-side in the
  private shape only (`profileFoldOf`, index.ts:1259+; the readings seat at
  index.ts:1067–1080 is gated on the server fold).

In the private (server) shape the fold stands and the card paints — but
collapsed by default (v517 §2: `profCardOpen` starts false, client.ts:19236),
showing only today's effective profile name. Even there, the three defaults
never stand together as configs anywhere except inside the Change sheet's
two duplicated name-only lists.

**Why the settings read as confusing, named from the controls themselves**
(the editor, `openProfileEditor`, client.ts:19351+; the sheet,
`openProfileSheet`, client.ts:19287+):

1. The Change sheet is three sections — "For today", "Standing default",
   "Day rule" — listing the same profiles twice as name-only rows; every
   row tap writes immediately, closes the sheet, and rebuilds the day.
   There is no place that shows what a profile CONTAINS before it is picked.
2. The editor leads with two text fields (Name, Honor line) before any
   prayer content appears. A default opens in copy mode with the default's
   own name pre-filled and its honor line blanked — saving turns on a
   naming judgment, and a name collision is silently suffixed (-2) by the
   save route.
3. Blocks are two groups of card rows worked by word buttons — ↑ / ↓ / Off
   for standing blocks, On for the rest. Turning a block On APPENDS it at
   the end of the order; nothing says so.
4. The Layers section puts two word-button rows (Novenas, Podcasts) and
   then the ENTIRE podcast series checklist inline under them — the
   checklist paints whenever the catalog loads, whether or not the
   Podcasts layer is on, so the layer's contents read as a third,
   unrelated section.
5. The defaults are not actually pristine today: the card's Novenas /
   Podcasts toggles (`profileLayerToggle`, client.ts:19270) PUT the layers
   onto the effective profile's record, and the local layers route carries
   NO kind guard — toggling a layer on the card rewrites a default in
   place, while the editor refuses the same change with "the named
   profiles cannot be changed". Two doors, two rules.
6. The client seed and the designed configs have diverged: the seed's
   Salesian Way stands Podcasts OFF with no series, while the designed
   Salesian Way (v549 + v536, and John's stored record) stands Podcasts ON
   with [bible-in-a-year, exorcist-files, daily-gospel-exegesis,
   daily-readings]. A fresh device seeds the stale config.

### 2.2 The model — blocks

One Profiles screen replaces the sheet + editor pair as the configuration
surface. It is reached from the profile card (its Change act) and from a
Settings row ("Prayer profiles"). The card itself keeps its standing dress
and collapsed posture; in the device shape it paints again once §2.5's fold
stands.

- The screen's head is the picker, in plain words: **For today** (the three
  defaults + his customs as cards, today's effective one marked, "Use the
  rule" standing when a pick stands), **Standing default** (the same cards,
  the standing one marked), the **Day rule** as one switch ("The
  Benedictine Way on Sundays and solemnities"), and **Default by day**
  (Amendment 2, §2.9): seven day rows — Monday through Sunday — each
  naming its per-day default profile or standing unset ("Standing
  default"), each row opening the same card list to set or clear it. A
  card tap is the pick — the standing write-then-rebuild behavior,
  unchanged underneath.
- A card opens its profile on the same screen: block rows in order, each
  with a real on/off switch; order is edited by drag handle (the v579
  Favorites dress), never by ↑/↓ word buttons and never by append-on-On —
  a block switched on takes its canonical hour position in the order.
- Under the blocks, the two layer switches: **Novenas** and **Podcasts**.
  The Podcasts switch reveals its series checklist ONLY while on (the
  checklist is the layer's contents, §2.3). The Novenas layer stays
  all-or-nothing, per the standing design.
- Switching profiles rebuilds TODAY in the new profile's shape, same day —
  the standing behavior, restored in the device shape by §2.5.
- Resolution order for a date (Amendment 2, §2.9, extends today's
  pick → rule → standing → first): **per-date pick (For today) →
  per-day default John set for that weekday → day rule → standing
  default → first**. A per-date pick outranks all. A per-day default
  outranks the single standing default. The day rule (Sunday/solemnity →
  The Benedictine Way) stands UNLESS a per-day default John set says
  otherwise — a set per-day default outranks the rule for that weekday,
  solemnities included; the rule still governs every weekday carrying no
  per-day default. This rule-vs-per-day point is flagged for John's eye
  at the next gate (§2.9).

### 2.3 The model — contents (the revision John ordered)

A profile record gains a `contents` field: per block, the ordered list of
item selectors that stand in that block when the profile builds the day.
Grounded in what a block's contents actually are today:

- **Core hour blocks** (Morning · Midmorning · Midday · Afternoon ·
  Evening · Night) are filled at open from four families: (1) the day's
  own Ora episodes, one slot per own source row assigned to the block in
  source settings (`state.ownStanding`, client.ts:8146+); (2) external
  podcast episodes from the block's RSS sources (player_sources, resolved
  at open); (3) source-settings rows — prayer-book prayers and named items
  configured per block, standing after the payload tracks in settings
  order (client.ts:17041+); (4) the Morning block's Daily Readings seat —
  the date-matched Daily Readings episode standing immediately before the
  Rosary when the effective profile's Podcasts layer carries
  daily-readings (index.ts:1074–1080, salesian/benedictine today).
  Per-day additions (prayers a user adds to a block for one date) are NOT
  profile contents: they stay per-day, adding onto whatever profile
  stands, filtered to standing blocks exactly as today (index.ts:1133+).
- **The Novenas layer block** carries the day's novena episodes — one per
  active novena, its day-n track. Its contents selector is the novena set:
  all active novenas (the standing behavior) or a named subset by novena
  slug.
- **The Podcasts layer block** carries no tracks in the day build (v522):
  what stands in it is the podcast itself — the series doors, in layer
  order. Its contents ARE the series list, which already exists as
  `layers.podcasts.series`. The model names it contents and orders it;
  no new field is needed for this layer.

Contents item shape: `{kind: 'source', key}` (an own or external source
row's key) · `{kind: 'prayer', slug}` (a prayer-book prayer) ·
`{kind: 'seat', key: 'daily-readings'}` (the Morning readings seat) ·
for the Novenas block, `{kind: 'novena', slug}` entries or the single
`{kind: 'all-novenas'}` selector. Rules:

- A block with NO `contents` entry reads as **standing contents** — the
  composition the build produces today. This is the migration default
  (§2.6) and the guarantee that the new model changes no day until John
  edits contents.
- An item named in contents stands in the built day; an item of the
  block's families NOT named does not stand. Named-missing posture is
  unchanged: an own source whose episode is missing for the day emits its
  named-missing row exactly as today.
- Order inside the block follows the contents list; families not covered
  by a selector keep their standing relative order after the named items.
- Layers stand after core, never interleaved — for contents as for
  blocks: core contents cannot name layer items, layer contents cannot
  name core items; the save route validates this (the standing
  "Novenas/Podcasts is a layer, not a core block" guard extends to
  contents kinds).
- The day-track intentions system is untouched: contents gate WHICH items
  stand, never their intentions; draws stay per-track at build/play
  (v539), and the v589 core's played state keys off track identity as
  today.
- Editing contents lives in the opened profile on the Profiles screen:
  each block row expands to its contents — item rows with on/off switches
  (off = removed from the list) and drag order — drawn from the block's
  real families for the current day, so what John sees is what the day
  actually carries.

### 2.4 Q2 A mechanics — pristine defaults, his own copies

The standing machinery already carries most of this; the Plan completes
it and closes the one leak:

- Defaults stand `kind: 'default'`. The save route refuses to overwrite
  one ("the named profiles cannot be changed — save as new",
  client.ts:2660) and the delete route refuses defaults (client.ts:2674).
  Both stand.
- In the Profiles screen, opening a default shows its blocks, layers, and
  contents read-write in place — but the only save act is **Save as my
  copy**, and saving REQUIRES a rename (Amendment 1, §2.9): the save
  presents the name field and does not complete until John sets the
  copy's name. A pre-filled suggestion ("<Name> — my copy") may stand in
  the field, but the rename act is a required part of the save — no save
  of an edited default lands under a name John did not give. Saving then
  mints a `kind: 'custom'` record under that name: key = the name's slug
  with the standing -2/-3 collision suffix, honor line starts blank (the
  honor line belongs to the three named defaults — standing editor
  posture).
- A custom opens with **Save** (over itself), **Save as new**, and
  **Delete** (arm-then-tap, standing). **Save as new** mints a copy, so
  the rename rule covers it too: it presents the name field and lands
  only under a name John gives. Customs stand in the same card lists as
  the defaults, marked as his. Deleting the standing default re-seats
  the standing key to 'salesian'; deleting a profile clears its day
  picks — both standing behaviors, kept.
- THE LEAK, closed: the card's layer toggles and the podcast picker's
  writes go through the layers route, which gains the kind guard. Writing
  layers onto a default performs **copy-on-write — routed through the
  rename step** (Amendment 1, §2.9): the write does NOT mint silently.
  It presents the rename for the copy that would carry the toggled
  layers, and only when John confirms the name does the copy mint, become
  the effective profile for the act's scope (today's pick if a pick
  stood, else the standing default), and the day rebuild — the toggle
  takes effect, the default stays byte-identical. **While the rename
  stands unconfirmed, the pending change does not take effect**: no copy
  is minted, no layer changes, no rebuild; the toggle reads as it read
  before the tap, and abandoning the rename abandons the change whole.
  The Plan names this as the one behavior John has not seen drawn; it is
  flagged for his eye at the Ship gate if he lifts the run level.

### 2.5 The fold, restored in the device shape

The repair the diagnosis names: in the device and web shapes, the
effective profile is resolved locally (`opnProfilesPayload` already
computes it) under the full precedence of §2.2 — per-date pick →
per-day default for the date's weekday → day rule → standing default →
first — reading the per-day map from the store (§2.6), and folded into
the day client-side — blocks filtered and
ordered by the profile's coreBlocks, the Novenas block appended when its
layer stands, the Podcasts block appended when its layer stands, contents
applied per §2.3, and the Daily Readings seat resolved on-device for any
profile whose Podcasts layer carries daily-readings (the server gate's
salesian/benedictine key check becomes a contents check, so a custom
profile carrying the seat gets it too). `day.profile` is set from the
local fold so the card paints and every fold consumer (podcasts
resolution, externals cache validity, additions filtering) reads the same
fold. The server shape keeps composing its fold server-side from the same
record shape — one model, both shapes, no divergence: the server fold
(`profileFoldOf`) gains the same contents field and the same seat rule.

### 2.6 Migration — his on-device state

His profiles live in the local document's profiles section
`{list, standingKey, dayRule, version, picks}` under the v578 vault.
Amendment 2 (§2.9) adds one field to that shape: `dayDefaults`, a
weekday→profile-key map (`mon`…`sun` → a profile key), standing
alongside standingKey, dayRule, and picks; a weekday absent from the
map carries no per-day default. The
migration runs in place at first open under the new build, inside the
standing section-merge posture; the vault envelope does not change and no
re-encryption event occurs.

1. **Pristine defaults re-seated.** Each standing record with
   `kind: 'default'` and a seed key is replaced by the NEW pristine
   default for that key. The new pristine defaults are defined from the
   DESIGNED configs — the fixture is John's own stored list: Little Way
   (Morning · Night; layers off), Salesian Way (Morning · Midday ·
   Evening · Night; Novenas on; Podcasts on with [bible-in-a-year,
   exorcist-files, daily-gospel-exegesis, daily-readings]), Benedictine
   Way (all six; Novenas on; Podcasts on with [daily-readings]) — NOT
   from the stale client seed (§2.1, point 6). The seed in code is
   corrected to the same configs, so a fresh device seeds the designed
   defaults.
2. **Nothing of his is lost silently.** Before a default is re-seated,
   its stored shape is compared against BOTH the old seed and the new
   pristine default. Any default that differs from both — drift he made,
   e.g. through the card toggles — is first preserved whole as a custom
   copy named "<Name> — as found", and the preservation is counted in
   the migration note the harness asserts. This preservation is
   automatic migration, NOT a user save: it is exempt from Amendment
   1's rename-on-save rule — John is not asked to name a copy he did
   not ask to make. (Against the fixture, his
   stored Salesian Way differs from the old seed but EQUALS the designed
   config, so it re-seats with no copy minted and no change to his day.)
3. **Customs untouched.** Every `kind: 'custom'` record carries over
   byte-identical, gaining only the absent-`contents` reading of §2.3.
4. **State carries by key.** standingKey, dayRule, and picks carry over
   unchanged (their keys still stand); `dayDefaults` stands absent or
   empty in his stored document and carries as absent — an absent map
   is today's behavior exactly, so the migration changes no resolution
   and the no-op equivalence leg (§2.7a) still passes byte-identical;
   profiles version bumps once, so every fold consumer re-reads.
5. **The server store stands as it is.** The private shape's
   prayer_profiles tables are not migrated by this release; the payload
   contract gains `contents` as an optional field the older store simply
   does not send (absent = standing contents, the same rule).

### 2.7 Implement outline

- **client.ts** — corrected `OPN_SEED_PROFILES` (designed configs +
  default contents absent-by-design); the §2.6 migration at document
  load; `opnProfilesPayload` carries contents in the fold and resolves
  the effective profile under the §2.2 precedence (per-date pick →
  per-day default → day rule → standing → first); the §2.5 on-device
  day fold (compose from the local effective profile inside the
  day-payload path, beside `opnScrubDayPayload`); the Profiles screen
  (cards, picker sections incl. Default by day, opened-profile editor
  for blocks + layers + contents, drag order in the v579 dress); the
  sheet and the old editor retire into it (their routes and write
  contracts stand); layers route kind guard + copy-on-write routed
  through the rename step (§2.4); the rename-required save (the save
  route refuses a copy mint — default save-as-copy, Save as new,
  copy-on-write — without the name John gives at the rename step); save
  route contents validation; the card's acts repoint to the screen.
- **index.ts** — `profileFoldOf` and the day composition honor contents
  identically (server parity); the same precedence resolves the
  effective profile server-side (the payload contract carries
  `dayDefaults` as an optional field, absent = no per-day defaults);
  the readings-seat gate becomes the contents check; profiles payload
  carries contents.
- **ui.ts** — the Profiles screen's styles; the Settings row that opens
  it.
- **Harness (harness-v590)** — fixtures from production only: John's
  import-file profiles section; the served public day payload of
  2026-11-21. Legs: (a) NO-OP EQUIVALENCE — a Salesian-shaped day built
  under the new fold with no contents edits is byte-identical in block
  list and per-block track identity to the standing composition, for
  the fixture day and a Sunday (Benedictine rule) fixture; (b) the fold
  stands in the device shape — card paints, blocks follow the standing
  default; (c) contents edits — remove an item → absent from the build;
  reorder → build order follows; a layer item named in core contents →
  refused at save; (d) copy mechanics — editing a default saves only as
  a copy, the default byte-identical after; card layer toggle on a
  default → copy-on-write routed through the rename step, default
  byte-identical, toggle effective only after the rename confirms;
  (e) migration — his exact stored list → pristine defaults seated,
  zero copies minted on the fixture, customs byte-identical,
  standingKey/picks/dayRule carried, dayDefaults absent; a synthetic
  drifted default → preserved as "— as found" before re-seating;
  (f) rename-required save (Amendment 1) — a save of an edited default
  with no rename given mints nothing and changes nothing; the save
  completes only under the name John gives, and the copy stands under
  that name; a copy-on-write rename left unconfirmed → no copy, no
  layer change, no rebuild; (g) per-day default resolution
  (Amendment 2) — with `dayDefaults` set for a weekday, that weekday's
  day resolves to the per-day profile over the standing default AND
  over the day rule (a Sunday per-day default stands on a Sunday, and
  on a solemnity falling on that weekday); a per-date pick for the
  date still outranks the per-day default; weekdays absent from the
  map resolve exactly as today.

### 2.8 Risks, named

- **The day build is load-bearing.** §2.5 touches how every day is
  composed in the device shape, and §2.3 lets a profile remove items
  from it. Protection: the no-op equivalence leg (a) is the gate —
  Implement does not proceed past it on a red; contents absent = the
  standing composition, proven byte-identical before any contents leg
  runs; the profiles version bump is the rollback seam (a bad build
  rolls back by pin, and the on-device migration is additive — the
  pre-migration document is the standing v570 export shape, restorable).
- **Two shapes, one model.** If the server fold and the device fold
  diverge, John's private day and public day disagree — the v588/v589
  defect class. Protection: one record shape, one contents rule, the
  harness's equivalence legs run against both composers.
- **Copy-on-write surprise.** A card toggle silently minting a profile
  could confuse the picker list. Protection (strengthened by Amendment
  1): nothing mints silently — the write stops at the rename step, the
  pending change takes no effect until John names the copy, the card's
  resolution line names the effective profile as today, and the
  behavior is flagged for John's eye before Ship.
- **Intentions and played state.** Contents gate standing only; draws
  and the v589 core key off track identity, which contents do not
  rename. No migration of either store stands in this release.

### 2.9 Amendments at the Plan gate (John, 2026-11-21 12:58 CT)

Two amendments, given as the Plan was presented; the in-place text of
§2.2–§2.8 above already reads as amended — this section is the record
of what changed.

**Amendment 1 — rename on save.** John, verbatim: "Once you edit it
and hit save, you have to rename it." Saving an edited default now
REQUIRES a rename step (§2.4): the save presents the name field and
does not complete until John sets the copy's name. A pre-filled
suggestion may stand in the field, but no copy lands under a name John
did not give. The rule covers every copy mint: Save as my copy, Save
as new, and copy-on-write — which no longer mints silently: a card
toggle or picker write onto a default routes through the rename step
before it takes effect, and while the rename stands unconfirmed the
pending change does not take effect (no copy, no layer change, no
rebuild). One exemption, stated plainly: the migration's automatic
"— as found" preservation (§2.6) is not a user save and carries no
rename — John is not asked to name a copy he did not ask to make.

**Amendment 2 — per-day default.** John, verbatim: "Also the ability
to change default profile per day." The Profiles screen gains a
**Default by day** section (§2.2): each weekday can carry its own
default profile, set from the same card list, or stand unset. The
store gains `dayDefaults`, a weekday→profile-key map alongside
standingKey, dayRule, and picks (§2.6). Resolution for a date, in
order: **per-date pick (For today) → per-day default John set for that
weekday → day rule → standing default → first** (§2.2, §2.5). A
per-date pick outranks all; a per-day default outranks the single
standing default; and the automatic day rule (Sunday/solemnity → The
Benedictine Way) stands UNLESS a per-day default John set says
otherwise — a set per-day default governs its weekday even on a
solemnity. **FLAGGED for John's eye at the next gate:** that last
point — a per-day default he sets overrides the solemnity rule for
that weekday, every week, until he clears it. Migration: an absent
map is today's behavior exactly, and the no-op equivalence leg still
gates byte-identical (§2.6, §2.7a). New harness legs (§2.7f, §2.7g):
rename-required save, and per-day default resolution.

Plan stands complete at Through Plan, as amended. John's next word — a
run-level lift — seats Implement.
