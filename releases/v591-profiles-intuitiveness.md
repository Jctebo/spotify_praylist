# v591 — Profiles: intuitiveness, second pass (blocks-first · direct edit · day map)

## §1 Scope

John's field verdict on v590 as shipped (Ora thread, 2026-11-21 13:33 CT):
"It's not quite intuitive enough. Let's do another review". The review
(row 1565, Scope record 2376) walked the shipped v590 surface and found
19 frictions (findings file:
`~/workspace/projects/ora-pro-nobis/v591-intuitiveness-review-findings.md`).
John approved the fix set TO SHIP (2026-11-21 13:45 CT) and then cut the
model to its final shape across 13:35–13:53 CT, all recorded on row 1565.
**The consolidated correction (13:53 CT) governs**; it supersedes the
interim "Current" model (point 6), the day-mapping friction resolution
built on it, and the brief's two-act Save framing:

- Direction 1: the screen opens directly on the blocks; a block that is
  on shows its contents underneath, standing open; a profile is a
  preset that sets all the toggles at once.
- Direction 2: tapping a profile opens a pop-up that explains it and
  lets John change the toggles inside it.
- Direction 4: per-day profiles work the same way, through their own
  pop-ups — one pattern, only the scope differs.
- Direction 5 (clarified): the configure entry comes OFF the Praylist's
  second row (the profile card); the Praylist keeps ONE configure row
  (the first); the further screen carries all configuration.
- Point 7: profile chips are ONE ROW, horizontally scrollable; the
  chips name profiles.
- Correction 1: the Sunday rule is JUST A DEFAULT — the day map ships
  seeded Sunday → The Benedictine Way, overwritable in config like any
  day; the day-rule mechanism retires; the solemnity override retires
  with it (a solemnity follows its weekday's profile).
- Correction 2: an ADD BUTTON for prayers inside blocks — each block's
  contents carries an Add act (prayers, and the block's other addable
  families).
- **The final model (13:51–13:53 CT):** there are only PROFILES. No
  "Current" — no unsaved working set, no Current state, chip, or
  head-line wording anywhere. A profile is edited DIRECTLY — the three
  ways included; the toggles on the screen are the opened profile's
  toggles. The v590 pristine-defaults rule and its copy-on-write /
  rename-on-edit machinery are SUPERSEDED: editing a way asks no name
  and mints no copy. **Save Profile** writes the edits back into the
  profile that was opened (ways and his own alike). **Save New** mints
  another profile from the toggles as they stand, named at the save —
  the name is asked exactly once, here, the only place a name is ever
  asked. **Reset to Default** stands separately: it returns a named
  way to its DESIGNED config, discarding edits made to it; one plain
  confirmation, no name asked. A day follows the profile its day-map
  entry names; the standing (every-day) profile governs days with no
  entry; a per-date pick names a profile for that date. The head line
  names the profile today follows. The friction is gone (John's
  conclusion): the map names profiles, edits land in profiles through
  the save acts — there is no third unsaved thing for a day to follow
  or leak.

The v590 data model, fold mechanics, contents/course machinery, and
migration stand underneath unchanged except where Correction 1 and the
final model amend the resolution and the save routes. This release
changes the SURFACE, its words, and the save discipline — and retires
the day rule and the pristine rule.

## §2 Plan

### 2.1 The screen — blocks first

The Configure plan screen (the v590 `openProfilesScreen` sheet,
rebuilt) opens on the profile TODAY follows:

1. **Head line** — "Today follows The Salesian Way" (the profile
   today's resolution names; F5).
2. **The chips row** (§2.3).
3. **The blocks** — the opened profile's toggle set, in standing
   order: the six hours, then Novenas, then Podcasts (blocks among
   blocks; the word "layer" retires from the surface). Each block row
   carries a REAL SWITCH (the approved mockup's form; F6). A block
   that is ON shows its contents standing open underneath: item rows
   with real switches, the course rows badged with name + next
   standing (F8: "Bible in a Year · Next: Day 322", from the same
   Current pointer the Courses side shows), the readings seat labeled
   "The day's readings" (F18), the Novenas block's row reading "Every
   active novena" with off shown as "No novenas stand" (F15;
   named-subset picking stays a named limit), and the standing line
   (F4): "As the day brings it" for standing contents, "Set by you —
   this block stands as listed" for explicit contents. A block that
   is OFF shows no contents. Block order is edited by **up/down
   steppers on the row** (the fix-4 pick: touch-certain, the standing
   editor dress; HTML5 drag retires from this surface). The Podcasts
   block's contents are its series rows (switches), standing open
   while on. Every contents list carries the **Add act**
   (Correction 2): a picker sheet listing the block's addable
   families not already standing — sources, the day's readings
   (Morning), courses, and PRAYERS from the prayer book (by name).
   Adding to a block with standing contents materializes the contents
   as set-by-you and the standing line flips to say so.
   Contents items are REORDERABLE (John, 13:56 CT): every
   contents row carries the same stepper pair as the block
   rows — one grammar everywhere — and the reordered order
   IS the profile's contents order for the block, standing
   in the built day in that order (the fold's contents gate
   already honors contents order; this lifts v590's named
   limit that contents order followed the editor's universe
   order). Every contents row also carries a REMOVE act
   (John, 13:59 CT): a quiet ✕ on the row takes the item
   out of that block's contents for that profile (never out
   of the app — the Add act brings it back); removing from
   standing contents materializes the rest as the explicit
   list, and removing the last item leaves an explicit
   EMPTY contents — the block stands on with nothing in it,
   never a silent revert to standing contents.
4. **The save acts for the opened profile** (§2.2): Save Profile ·
   Save New · Reset to Default (named ways only).
5. **The day mapping section** (§2.4) — an "Every day" row + seven
   weekday rows, each naming the profile it follows, each opening
   its pop-up.

The screen's toggles edit a DRAFT of the opened profile. Editing
never writes a profile until a save act is clicked (§2.2) — edits
land in profiles through the save acts, and nowhere else. Closing
the screen or a pop-up with unsaved edits: the close act reads
**"Close without saving"** whenever the draft differs from the
profile as opened, plain "Close" when it does not (the fix-6 pick:
the labeled path is the warning; no interrupt question stands in
the way).

### 2.2 The save acts — the whole persistence model

- **Save Profile** — writes the draft back into the profile that was
  opened: its blocks, layers, and contents. Ways and his own alike;
  no name asked, no copy minted. If the edited profile is the one
  today follows, today rebuilds from the saved shape.
- **Save New** — mints ANOTHER profile from the draft as it stands,
  named at the save (the name asked exactly once, here — the v590
  rename sheet carries the act). The opened profile stands
  byte-identical. After a save, the pop-up/screen offers the
  follow-on in scope words: "Use it today" / "Use it every day" /
  "Stand for <Weekday>".
- **Reset to Default** — stands separately on the screen and in a
  way's pop-up (never in the save pair): returns the named way to
  its DESIGNED config (the v590 designed fixtures), discarding edits
  made to it — saved and draft alike. One plain confirmation line,
  no name asked. His own profiles have no designed default behind
  them; the act stands for the named ways only.
- **Apply** (pop-ups) — makes the pop-up's scope follow the opened
  profile: today → a per-date pick for today; a weekday → that day's
  map entry; Every day → the standing profile. Apply never edits a
  profile; Save Profile does. Both labels carry a one-line
  explanation inside the pop-up so the difference is never guessed.
- **Delete** — his own profiles only, standing in their pop-up (the
  v590 act, kept); ways cannot be deleted (Reset is their road back).

Resolution (v591): **per-date pick → the day's profile (day map) →
the every-day (standing) profile → first.** The day-rule leg RETIRES
(Correction 1): no rule stands above the map. A solemnity follows
its weekday's profile. The head line names the profile today
follows; there is no other state word.

### 2.3 Profiles — chips in one scrollable row (Point 7)

The profiles stand on the screen as **chips in ONE row, horizontally
scrollable** — never stacked cards or a section of rows. Chips carry
the profile names (the three ways + John's own). The chip of the
profile today follows reads as the standing one. Tapping a chip
opens its pop-up (§2.5). No other chip stands in the row.

### 2.4 The day mapping — profiles only (Correction 1)

- The map (the v590 `dayDefaults`, surfaced as the day mapping)
  names PROFILES ONLY — with no unsaved third thing, there is
  nothing else it could name, and no leak path exists: a day follows
  its mapped profile as saved, edits included, the moment they are
  saved into that profile.
- **Migration (mig591, in place at first open; server parity at the
  profile-state read):** a stored `dayRule = true` with an empty day
  map seeds the map's Sunday entry to The Benedictine Way;
  `dayRule = false` seeds nothing. The stored dayRule then retires
  (written false; resolution never reads it). With the seeded map, a
  Sunday composes Benedictine exactly as v590's rule did — the
  equivalence leg (§2.7) gates on it. John's stored ways equal the
  designed configs today, so in-place editing starts from the
  designed shapes; the v590 migration's "— as found" preservation
  stands as shipped history — v591 adds no new preservation
  machinery.
- Each weekday row names its mapped profile, or "Every day" when
  unmapped. Tapping a row opens that day's pop-up (§2.5): a profile
  chips strip at its head chooses which profile the pop-up shows;
  Apply stands the shown profile for that day.
- The Sunday pop-up explains the default plainly: Sunday stands as
  The Benedictine Way by default and can be changed like any day
  (fix 8, resolved by Correction 1's simplification — no hidden
  solemnity consequence remains to disclose).

### 2.5 The pop-up — one pattern (Directions 2–4, F14)

One pop-up builder serves every scope (profile chip · Every day ·
weekday). It carries: a profile chips strip (the shown profile is
switchable inside the pop-up); the name; the explanation (what stands
in it — blocks + contents in words; how long it runs, from the
designed descriptions for the named ways; the honor line, F19); the
toggles (blocks + contents, real switches, the Add act, steppers) as
a draft of the shown profile; and the acts — **Apply** (scope words:
"Use for today" · "Use every day" · "Stand for <Weekday>", with its
one-line explanation), **Save Profile**, **Save New**, **Reset to
Default** (ways only, standing apart), **Delete** (his own only),
and the labeled close (§2.1).

The profile card on the Pray side keeps its name + resolution line
as INFORMATION ONLY — its Change/Customize/layer acts are removed
(Direction 5, F17). One configure row stands on the Praylist (the
first), one label everywhere: "Configure plan" (the Settings row
keeps the same label).

### 2.6 Language pass (F19)

Surface words: **profile** stands (John's own word in the final
model); scopes read **Today** · **Every day** · the weekday's name;
"layer" and "contents" retire as labels (contents stand open;
Novenas and Podcasts stand as blocks); "The day's readings" for the
readings seat; the honor line stands in the pop-up's explanation;
the word "Current" never names a configuration state anywhere on
the surface.

### 2.7 Implement outline + gates

- **client.ts** — mig591 (Sunday seed + dayRule retire);
  `opnResolveProfile590` drops the rule leg (pick → map → standing →
  first); the fold reads the new resolve (mechanics unchanged); the
  save route writes over ANY profile by key (Save Profile), the mint
  path drops the rename guards (Save New names freely), the layers
  route's default guard retires, a reset route writes the designed
  seed record over a way; the screen rebuilt per §2.1–§2.5 (chips
  row, switches, contents open, Add picker incl. book prayers,
  steppers, day mapping, pop-ups with the save pair + Reset +
  Apply); the fold surfaces an added prayer selector as an
  addition-shaped descriptor woven into its block by the standing
  additions path; the card loses its acts; `profContentsUniverse`
  gains course names + next standings and prayer items for the Add
  picker (book read).
- **index.ts** — `profileResolve` drops the rule leg; the
  profile-state read seeds Sunday (day_rule standing + empty map)
  and retires day_rule, mirroring mig591; the save/layers routes
  mirror the client's new discipline; a reset route mirrors; the
  payload's state drops dayRule. No schema migration: the
  day_defaults column (0044) already carries the map.
- **ui.ts** — the chips row (one row, scrollable), the switch
  control, pin bump ora-pro-nobis-v591-1.
- **harness-v591** — production fixtures only (John's stored
  profiles document; the v589 Bible fixture): blocks-first render
  statics · pop-up act statics (Apply/Save Profile/Save New/Reset
  labels + explanations) · Save Profile writes back into a named way
  (the way's stored record changes; no copy minted) · Save New
  mints under the given name, the opened profile byte-identical ·
  Reset returns an edited way to the designed config byte-identical
  · the day follows its mapped profile after an in-place edit +
  Save Profile, with no other act · day-map resolution incl. the
  seeded Sunday + an overwritten Sunday · migration seeding
  (dayRule=true → Sunday seeded; false → none) · the Add act (a
  prayer added stands in the built day; the standing line flips) ·
  contents reorder (the new order persists in the profile's
  contents and the built day's block stands in that order; the
  stepper affordance stands on every contents row) · contents
  remove (from standing contents → the built day carries exactly
  the remaining items and the line reads set-by-you; the last
  item removed → the block stands empty; a removed item returns
  through Add) ·
  the course badge (Day 322) · one configure row (no configure acts
  in the card) · no "Current" as a configuration state on the
  surface · the EQUIVALENCE LEG: with the seeded map and unedited
  profiles, a Salesian weekday and a Sunday compose byte-identical
  block lists + per-block track identity to the v590-shipped
  composition.
- **Regressions** — harness-v590 stands at 37/0 or every delta is a
  named superseded static/leg (the pristine-rule refusals D1/F1/F2,
  the rule resolution A3/S5/G2-wording, the dayRule carry E2 — each
  superseded by John's named word: Correction 1 and the final
  model); v589/v585/v578 functional legs pass identically.

### 2.8 Risks, named

- **The fold is load-bearing (standing).** The resolution change
  (rule retirement) is gated by the equivalence leg on the
  production fixture before any surface leg counts; mig591 is
  additive (a bad build rolls back by pin; the pre-migration
  document is the v570 export shape).
- **Two shapes, one model (standing).** Map + resolution + save
  discipline land in both the local layer and the server store with
  one rule; the harness runs the legs against the client world and
  the payload contract is read back on the served client.
- **Ways are now mutable.** A stray edit to a way persists through
  Save Profile; Reset to Default is the standing road back, and the
  designed configs it restores are fixtures in the harness (Reset
  byte-identical leg), so the road back is proven, not promised.

## §3 Implement (chain-v591-build, 2026-11-21)

Built on branch release/v591 off main 0feb21c (v590), in the
standing clone's worktree. The v590 model underneath stands; the
changes are the resolution, the save routes, and the surface.

**Resolution + migration (client `opnMigrateProfiles591` +
`opnResolveProfile590`; server `prayerProfileStore` +
`profileResolve`).** The day-rule leg is deleted in both shapes.
mig591 runs in place at first open (and at a restore): a stored
dayRule=true with no Sunday map entry seeds dayDefaults.sun =
'benedictine'; dayRule=false seeds nothing; a standing Sunday
entry is never overwritten; the stored rule is then written
false (server: zeroed in the same write that persists the seed).
The fresh-install seed doc starts in the v591 shape (Sunday
seeded, no rule). No schema migration: the day_defaults column
(0044) already carries the map. Precedence is now per-date pick
→ the day's profile (map) → the every-day profile → first, in
both shapes; the server fold's resolvedBy union drops "rule".

**Save discipline (both shapes' routes).** Save Profile: the
save route's key branch writes name/honor/blocks/layers/
contents over ANY profile, ways included (the v590 refusal is
deleted in both shapes). Save New: the mint path drops the
rename_required guards in both shapes. The layers route's kind
guard is deleted in both shapes. A new reset route (both
shapes) writes the DESIGNED record over a named way — client:
the OPN_SEED_PROFILES record; server: DESIGNED_PROFILES_591,
the same fixtures in stored form — and refuses customs.

**The fold's prayer surfacing (Correction 2).** In the client
fold, a prayer selector standing in the effective profile's
contents for a block appends an addition-shaped descriptor
({block, slug, lang 'en', kind 'prayer'}) to the day's
additions — the standing additions weave paints it into the
block and the book audio serves it; a stored per-day addition
for the same prayer in the same block dedupes it. Server
parity: dayAdditionsFold takes the fold's contents prayers as
synthetic rows through the same book/audio resolution. The
standing contents gates (extRebuildDescs: source rows stand
only when named, in contents order; an explicit empty list
empties the block) already honor contents order and the
explicit-empty shape — the reorder and remove legs ride them.

**The surface (client).** profileCardHtml is information only
(name · resolution line — "Your pick for today" / "From the
day mapping" / "Your every-day profile" · honor line); its
Change/Customize/layer acts and the copy-on-write
profileLayerToggle are deleted. openProfilesScreen is rebuilt:
head line "Today follows <name>"; the profiles as chips in
one scrollable row (.profchips591/.chip591); the opened
profile's blocks with REAL switches (.switch591), contents
standing open under on blocks (the standing line, item rows
with switches + ↑/↓ steppers + a ✕ Remove, the Add act
opening a picker over the block's addable families + the
prayer book by name); Novenas/Podcasts as blocks among
blocks, Podcasts contents = its series rows; block order by
↑/↓ steppers (the fix-4 pick — touch-certain; HTML5 drag is
gone from the surface); the save acts (Save Profile · Save
New · Reset to Default for ways); the day mapping section
(Every day + Mon–Sun rows naming their profile). One pop-up
builder (openPop inside the screen) serves chip/Every-day/
weekday scopes: a chips strip switches the shown profile;
the explanation (honor line · duration for the ways · the
"Stands:" line in words; the Sunday default explained on the
Sunday pop-up); the draft toggles; Apply (scope words, with
"Apply makes <scope> follow this profile. It does not change
the profile.") · Save Profile ("Save Profile writes these
toggles into <name>.") · Save New (the name sheet — the only
name ask; its copy reworded to the new model) · Reset
(ways) · Delete (his own). The fix-6 pick: the close act
reads "Close without saving" whenever the draft differs
from the profile as opened, plain "Close" when it does not.
Course rows read the label cache filled from the podcasts
index fold ("Bible in a Year · Next: Day 322"); the readings
seat reads "The day's readings"; the Novenas contents row
reads "Every active novena". ui.ts gains the switch/chips/
stepper dress. The legacy openProfileSheet/openProfileEditor
stand untouched and unreached (the card no longer opens
them); the Settings "Configure plan" row and the Praylist's
first row reach the one screen, one label everywhere.

**Gates on the working tree.** harness-v591: **31 ok / 0 not
ok** — statics S1–S10 · EQUIVALENCE A1/A2 (a Salesian
weekday and a Sunday under the seeded map compose
byte-identical block lists + per-block track identity to
the v590-shipped composition; Sunday resolves 'day-default')
· migration M1–M3 · the save model P1–P6 (Save Profile
writes a named way, no copy; the day follows the edit with
no other act; Save New mints, opened byte-identical; Reset
restores the designed config; Reset refuses a custom; the
layers route writes a way) · the day map D1–D3 · contents
C1–C5 (Add surfaces in the built day; reorder persists and
the built day stands in the new order; remove retires the
seat and the list stands exactly; remove-last leaves an
explicit empty contents — seat off, no additions; a removed
item returns through Add) · the course badge B1 (Day 322,
label included, on the v589 production fixture).
Regressions: harness-v590 30 ok / 7 not ok — every not-ok a
named supersession (S5 + A3: the "rule" resolution retired
by Correction 1 — A3's composition itself is byte-identical,
only resolvedBy moved to 'day-default'; E2: the dayRule
carry retired by Correction 1; D1/D2/F1/F2: the pristine
rule's refusals retired by the final model). harness-v589
33/2, v585 41/1, v587 functional legs all pass, v586 22/1,
v581, v579 31/4, v576 44/1 — every remaining not-ok is a
static pinned to that release's own base or change-set
(diff confinement · newest-migration · pin-vs-base ·
byte-identical-to-BASE), the same legs that fail on main
today; zero functional failures anywhere. The rendered
client parses whole (1,141,681 chars); index.ts and ui.ts
strip + parse clean.

## §4 Review (chain-v591-build, 2026-11-21)

**Verdict: PASS.** The diff was read whole (index.ts hunk by
hunk; the client machinery regions; the surface splice). The
gates stand as recorded in §3, with the harness at **32 ok /
0 not ok** after the one defect below was fixed and guarded
(S11 added in Review; 32/0 on the working tree and on a clean
checkout of the committed tree, 81f8cb2).

**Defect found in Review, fixed forward inside this
approval:** the profile pop-up mounted its sheet EMPTY and
repainted `pop.innerHTML` — mountDrawer restructures the
sheet's `.inner` at mount time (grab strip + panel body), so
the pop-up would have stood without drawer chrome and its
first repaint would have torn the structure down. Fixed:
the pop-up now carries a stable `.profpopbody` container
inside the mounted `.inner` and paints/wires only there —
the standing sheets' own discipline. Guarded by harness
static S11. No other surface repaints a mounted sheet whole
(the screen and the Add picker verified: both paint into
inner containers or mount once with content standing).

**Named limits standing:** named-subset novena picking
stays unbuilt (the Novenas contents are all-or-nothing, in
words) · contents item order for SOURCE families rides the
standing extRebuildDescs gate (contents order honored
there); prayer surfacing order rides the additions weave ·
a contents prayer whose slug also stands as a per-day
addition in another language dedupes to the stored addition
(no duplicate stands) · the legacy profile sheet/editor
remain in the client, unreached · private-shape parity for
the new routes is code + harness level (the private host's
Access gate blocks a live fetch from this seat, the
standing posture).

## §5 Ship (chain-v591-ship2, successor seat, 2026-11-21)

The original build chain completed Plan · Implement ·
Review and the merge, then died during Ship with no
report; this seat finished the ship on the verified state
— nothing was rebuilt.

- Merge 66f8b79 (release/v591 → main) + pin bump bb5bc92
  (ora-pro-nobis-v591-1) stand on GitHub main, pushed
  through the Git Data API, byte-identical — main pushed ·
  remote in sync (66f8b79).
- harness-v591: **32 ok / 0 not ok** on the merged tree
  (66f8b79, the clean ship worktree) — the equivalence legs
  A1/A2 green: a Salesian weekday and a Sunday under the
  seeded map compose byte-identical to the v590 ship.
- Pre-deploy live read: production at Worker **faf9b32b**
  (the v590 build) at 100% — the rollback target. Dry run
  clean (exit 0), then deploy via the connector-surrogate
  wrangler (deploy-app-v591-ship.py) from the clean ship
  worktree at 66f8b79.
- Worker ora-pro-nobis-app now serves version **2774044f**
  at 100%. Served proofs: the served sw.js carries pin
  ora-pro-nobis-v591-1; the served app.js parses whole
  (1,146,364 bytes) and carries the v591 surface — the
  blocks-first screen, the profile chips row, real
  switches, Save Profile / Save New / Reset to Default,
  the day mapping, the contents Add / remove / stepper
  acts, Configure plan — and no "Current" as a
  configuration state; the live public day payload for
  2026-11-21 stands in the public shape (personal folds
  client-side); personal-data reads on the public host
  stand empty (profiles [], intentions refused with the
  personal-in-app pointer, by design); the served client
  is the same tree the harness equivalence legs ran on.
- Row 1565 Live · What's New 406 · Ship phase record 2380 ·
  Ship contract 792 · intake 1105 closed Done.
- Field legs standing open for John (his verdicts, not
  claimed): first open after the update — the blocks stand
  first with their contents open underneath; edit The
  Salesian Way and Save Profile writes it back; Save New
  mints a new profile under his name for it; Reset returns
  a way to its designed config; Sunday follows The
  Benedictine Way from the day map, and the map entry can
  be changed; a contents item drags by its steppers, a
  prayer adds into a block, an item removes from its row.
