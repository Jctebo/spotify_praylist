# v593 — Configure without pop-ups (chips switch in place · the ladder · the dirty-only acts bar)

## §1 Scope

John's field direction on the shipped v592 (Ora thread voice call
+ screen recording, 2026-11-21 ~14:44 CT): "I don't need a pop
up. I needed to change the current profile. When I click the
Little Way it should change my profile." Scope package 84
delivered the critique (9 walk frictions, W1–W9, grounded in the
served v592 client) and seven decision questions. APPROVED TO
SHIP (John, Ora thread, 2026-11-21 15:15 CT; formal Scope Space
approval record 40, package 84 — the two agree exactly). THE
PICKS AS PICKED (the build runs on these; on Q1/Q2/Q3/Q7 they
override the package recommendations):

- **Q1 = B** — prompt on switch: tapping another profile's chip
  while the standing draft is dirty raises Save · Discard ·
  Stay. A clean tap switches at once.
- **Q2 = A** — today changes too: a chip tap stands the tapped
  profile for today (its saved shape; the day rebuilds) AND
  opens it on the screen for editing. No separate Switch act —
  the chips are the switch.
- **Q3 = C** — the acts bar stands at the top ONLY when there
  are changes (Save · Save New + the status line); the chips
  row and the jump strip stand frozen always.
- **Q4 = A** — block jump-chips with scrollspy + the progress
  hairline as garnish.
- **Q5 = A** — the ladder (John's own pick, 2026-11-21 15:04
  CT): Configure opens a two-option ladder — PROFILE EDIT ·
  DAY MAPPING — each to its own full screen. The v592 Day
  mapping button + pop-up retire.
- **Q6 = A** — an in-place switch lands at the top.
- **Q7 = B** — TO SHIP.

The v591 model stands underneath unchanged: profiles (the ways
included) edited in place · Save Profile writes back · Save New
mints, named at the save · Reset to Default returns a way to
its designed config · the day map names profiles, Sunday
seeded to The Benedictine Way · resolution: per-date pick →
the day's profile → the every-day profile. No migration. The
no-op equivalence discipline gates the build.

## §2 Plan

**The three coherence points, settled and named:**

1. **Q2=A × Q1=B.** A chip tap fires a day-pick
   (`PUT /api/prayer/profiles/day-pick {date, profileKey}`) —
   today stands the tapped profile's SAVED shape and the day
   rebuilds (`profileRebuild`); the screen then opens a fresh
   draft of the tapped profile, scrolled to the top. Edits on
   the screen remain a draft until Save writes them (the v591
   semantics stand). If the standing draft is dirty, the
   prompt fires first: **Save** writes the standing draft into
   ITS OWN profile (Save Profile semantics — if today followed
   that profile, its own rebuild applies the saved edits) and
   only then does the switch proceed, the day-pick superseding
   for today; **Discard** drops the draft and switches;
   **Stay** switches nothing. A clean tap switches at once.
2. **Q3=C — Save New's clean-state home + the bar-appear
   mitigation.** Save New stands ALWAYS in the **"This
   profile" zone** in the scroll (beside Reset/Delete) —
   reachable clean or dirty; the dirty bar carries the same
   act. The mitigation: the frozen zone is inserted into the
   sheet's `.inner` as a flex sibling ABOVE the `.panelbody`
   scroller, so the bar appearing on the first edit shrinks
   only the scroller's height (its bottom edge) — never its
   content offset. On top of that, every edit repaint is
   anchored to the edited block (below), so the first edit
   that raises the bar cannot move his place.
3. **Q2=A — the frozen acts.** The dirty bar carries **Save ·
   Save New only** — no Switch act (the chips are the
   switch). Its status line names the on-screen profile +
   "· unsaved changes" + whether today follows it. The chips
   row (on-screen chip marked; a "today" tag on the chip
   today follows; a dirty dot on the on-screen chip) and the
   jump strip + hairline stand frozen always.

**Build (client.ts + ui.ts only; no server change, no
migration):**

- `openConfigureLadder593()` (new): a full-screen sheet
  (profscreenfull592) — head "Configure plan", two door rows
  (Profile edit · Day mapping), Close. Doors remove the
  ladder and open their screen; each screen's labeled Close
  returns to the ladder. Entry rewiring: the Praylist's one
  Configure plan row, the profile card's Change act, and
  Settings → Prayer plan now open the ladder. (The card's
  Customize act still opens the editor at its profile — a
  specific-profile act, not a Configure door.)
- `openProfilesScreen(openKey, opts)` (rewritten): the
  pop-up machinery (`openPop`, `openMapPop`, the
  `.profpop591`/`.profmap592` sheets, the head's Day mapping
  button) is deleted whole. Retained verbatim: the draft
  machinery (draftOf · contentsOut · draftDirty ·
  materialize · contents/series/block painters · the Add
  picker · loaders). New: the frozen zone (above); chipTap /
  doSwitch / openSwitchPrompt / saveProfileDraft /
  doSaveNew; the This profile zone (Save New always · Reset
  for ways · Delete for his own — Delete stands on the
  editor for the first time; in v591/v592 it lived only in
  the pop-up); the labeled Close ("Close without saving"
  while dirty), returning to the ladder when reached from
  it. **Repaint anchoring (not optional):** block cards and
  contents carry `data-p593anchor`; `wireBlocks` hands the
  tapped button to the repaint, which restores the scroll by
  the anchor's viewport delta after repainting — an edit
  never moves his place (W6's repair).
- `openDayMappingScreen593(fromLadder)` (new): a full
  screen in the Configure family's dress. Week view: the
  two standing lines ("Each day follows its profile…" ·
  "Standing a profile for a day takes effect at once."), an
  Every day row + Mon–Sun rows naming their profile. A
  row turns the SAME screen to that day's assignment view:
  profile chips, the line "To change what a profile
  contains, use Configure plan.", one gold act ("Stand for
  <Weekday>" / "Stand as every day") writing at once via the
  state route, and Back. Close returns to the ladder.
- ui.ts: the v593 dress (frozen zone · bar · chips tags ·
  jump strip · hairline · ladder · mapping screen · This
  profile zone), scoped to the new classes; the SW pin
  bumps to ora-pro-nobis-v593-1 at Ship.
- harness-v593 (new): statics for every pick + the
  no-pop-up retirement + equivalence (A) + day-map (D) +
  the data-layer legs under the picks (F). Regression:
  harness-v591 + harness-v592 with every delta named.

## §3 Implement

Built as planned, on release/v593 off the standing clone
(main 81b3e42):

- **client.ts** — the ladder, the Day mapping screen, and
  the rewritten editor spliced in; the pop-up machinery
  deleted whole (zero `openPop` / `openMapPop` /
  `profpop591` / `profmap592` / `data-p592daymap` strings
  remain in the client). Entry points rewired to the
  ladder. The retained draft machinery is byte-identical
  except the anchor attributes on block/contents painters
  and `repaint(btn)` in `wireBlocks`.
- **ui.ts** — the v593 dress block added after the v592
  block; no standing rule changed value.
- **harness-v593** (new, app/harness-v593.mjs) — 20 legs:
  T1–T13 statics (the ladder's two doors · one configure
  act · the day-pick switch + top landing · the prompt's
  three acts · the hidden-until-dirty bar + Save New's
  zone home · the jump strip/scrollspy/hairline · the Day
  mapping screen · NO pop-up path · the anchored repaint ·
  the frozen zone's seat · no migration · pin unmoved ·
  the rendered client parses whole) · A1/A2 equivalence ·
  D1/D2 day map · F1–F3 the picks' data layer (a day-pick
  stands the tapped profile for today and today composes
  it; a mapping assignment writes at once and the day
  follows).

**Gates (working tree):** harness-v593 **20 ok / 0 not ok**.
Regression, every delta named: harness-v591 **29 ok / 3 not
ok** (base 32/0) — S1 (asserts the retired in-body chips
paint), S2 (asserts the pop-up's acts), S11 (asserts the
pop-up's paint discipline): all three assert surfaces v593
removes by John's picks; every functional leg (fold,
equivalence, save/reset/contents/courses) still passes.
harness-v592 **10 ok / 2 not ok** (base 12/0) — T3 (the Day
mapping button in the head) and T4 (the mapping pop-up):
both retired by Q5=A; its equivalence + day-map legs pass.

## §4 Review

The diff read whole (client.ts +537/−221 net across the
function span, ui.ts +30, harness new, this doc). The
retained-machinery proof ran as a byte comparison against
main: the draft/contents/block painter segment differs from
the shipped v592 original ONLY by the five anchor attributes
and the seven `repaint(btn)` hand-offs; the Add-picker /
loader segment is byte-identical. The rendered client parses
whole (harness T13) and the equivalence gate holds on the
working tree and in a clean checkout of the committed HEAD
(4dc870d): harness-v593 20/0 in both, regressions identical
to §3's named deltas.

**Verdict: PASS.** Named limits, none rounded:

- The screen's live DOM behaviors (the prompt's three acts,
  scrollspy lighting, anchored repaints, the bar's
  appearance) are proven at source-static level plus the
  data layer (F1–F3) — the repo's standing harness pattern
  (v591/v592 the same); no DOM-simulation harness exists.
  The field legs below carry the live checks.
- Dismiss gestures (grab-drag, scrim tap) close the editor
  to the calling surface without the ladder return; the
  labeled Close is the ladder path, as specced.
- Delete stands on the editor for the first time (in
  v591/v592 it lived only in the pop-up) — same endpoint,
  same two-tap arm; named so the surface change is on
  record.
- The switch prompt is a sheet (the app's standing
  ask-surface) carrying the three acts; Q1=B's "you are
  asked" is met by it.
