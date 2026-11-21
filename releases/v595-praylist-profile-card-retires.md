# v595 — Praylist: the profile card row retires

## §1 Scope

John's direct instruction (Ora thread, 2026-11-21 15:39 CT),
with his screenshot of the Praylist and the profile card
scribbled out: "And please stop showing this row."

The PROFILE CARD — the card under the Prayer plan row that
read the standing profile's name ("The Salesian Way"), its
resolution line ("Your every day profile"), and the honor
line — is REMOVED from the Praylist as a separate row.

REFINED by John (Ora thread, 2026-11-21 15:44 CT, while
the chain ran): "I just don't want to show 2 rows when
the button and current plan can be in one row." The shape
is a MERGE, not a bare removal: ONE row stands at the
Praylist's head carrying BOTH — on the left, the current
plan (the standing profile's name + its resolution line,
the lines the card carried); on the right, the Configure
plan button. The card's honor line retires with the card
(it stands in the profiles editor, where the profile is
edited). After the change the Praylist stands: the one
plan row → Favorites → the blocks. The refinement landed
before deploy — the bare-removal shape reached main and
GitHub (deaef71) but was never deployed; what deploys is
the merged row.

Presentation only. The day's composition, the fold, profile
state, personal data, and prayer seats stand untouched;
equivalence is the gate. Small release, streamlined path,
TO SHIP on his direct instruction. No migration.

## §2 Plan

One compressed Scope + Plan pass (small-release path). The
Plan sweep — what hangs on the card — read the whole client
and the harness family:

- `profileCardHtml(day)` has exactly ONE caller:
  `paintListenHome` (the Praylist paint). The card paints
  information only — name, resolution line, honor line; it
  has carried NO acts since v591 §2.5.
- The card-era wiring in the paint pass (`data-profchange`
  / `data-profexpand` / `data-profcustomize`) binds
  attributes NO paint emits anywhere in the client — dead
  since v591. `profCardOpen` is written only by that wiring
  and read nowhere.
- The shared helpers `profPut` / `profileRebuild` serve the
  ladder, the Day mapping screen, and the profiles editor —
  NOT the card. They stand untouched.
- Both ladder doors are independent of the card: the
  Configure plan row's `data-profconfigure` wiring and
  Settings' `profBtn590` both call `openConfigureLadder593`
  directly.
- No `.profcard` CSS exists (the card wore the generic
  `.card` dress); nothing to remove in ui.ts.

Verdict: nothing live hangs on the card. The change set is
client.ts only: (1) drop the card call from
`paintListenHome`; (2) delete `profileCardHtml`; (3) delete
the dead card-era wiring + `profCardOpen`. Gates:
harness-v595 (new) with rendered-paint legs + the
equivalence legs carried from harness-v593; regression
deltas named against base.

## §3 Implement

Commit on release/v595 (see the Ship record for the hash).
client.ts only, three cuts as planned; the v547 comment at
the Favorites slot now names the Prayer plan row as the
slot's upper neighbor, and the v515 section head records
the card's retirement over the surviving helpers.

The refinement build (after §1's redirect): a new paint,
`profPlanRowHtml(day)`, paints the ONE row — fold standing:
name + resolution line left, Configure plan button right;
no fold: the bare "Prayer plan" label with the act
standing. `paintListenHome` calls it. The card stays
deleted whole.

Gates on the working tree (final shape):

- **harness-v595: 18 ok / 0 not ok** — T1 the card is gone
  whole (no paint, no class, no flag, no card-era wiring)
  · T2 the merged row paint stands (two posture literals
  in the one paint function; exactly one act renders) ·
  T3 both ladder doors stand · T4 the shared helpers stand
  · T5 no new migration · T6 pin · T7 the rendered client
  parses whole · P1–P4 the RENDERED Praylist paint
  (paintListenHome run in a vm world): exactly ONE plan
  row carrying the one configure act · the row carries
  BOTH the standing profile's name + standing line AND
  the button, name before button · NO second card (no
  profcard, no honor-line block) · the order stands plan
  row → Favorites slot → blocks · no fold → the bare
  "Prayer plan" fallback · A1/A2 EQUIVALENCE: a Salesian
  weekday and a Sunday compose byte-identical to the v593
  ship · D/F the day map, day-pick, and assignment writes
  stand.
- Regression deltas vs the v593 ship (main af43c7f),
  every red named: harness-v591 **29/3 — zero delta**
  (S1/S2/S11, the v593 pop-up reds) · harness-v590 **29/8
  vs base 30/7 — one by-design red**: S4 asserts the card
  stands after the Configure plan row; its premise is
  gone · harness-v593 **19/1 — one new by-design red**:
  T2 counts `data-profconfigure="1"` SOURCE literals
  (=== 1); the merged row's one paint function carries
  two posture literals (fold / no-fold) and renders
  exactly one act — the rendered count is the truth, and
  harness-v595 P1 proves it · harness-v592 **9/3 — one
  new by-design red**: T5, the same literal-count premise
  (its T3/T4 reds are the standing v593 deltas).

## §4 Review

PASS, over both builds. First build: the diff was read
whole (6234689 + the Review fix f84cf6c) — three cuts and
comment corrections in client.ts, nothing else; the
removed wiring bound attributes no paint emits (proven at
Plan, re-verified against the diff); the retained
Configure plan wiring and both ladder doors stood
byte-identical to base. One Review fix: the v590 comment
at the plan row still said the button stands "whether or
not a profile card paints below it" — corrected
(f84cf6c, comment only).

Refinement build, re-reviewed whole: `profPlanRowHtml`
is the only new paint; its fold branch reproduces the
retired card's name + resolution lines verbatim (same
`resolvedBy` mapping, same esc()) inside the plan row,
and its no-fold branch reproduces the bare row
byte-identical to the row the Praylist carried before.
`paintListenHome`'s change is the one call. Nothing else
moved — the fold, the payload, and every write path stand
byte-identical to the first build.

Gates re-run on the final shape: harness-v595 **18 ok /
0 not ok** on the working tree and on a clean checkout of
the committed tree; equivalence A1/A2 byte-identical in
both. Named limits: the historical test suites under
app/tests/ (harness-v515/v517/v521/v522) assert the
card's retired forms and stand as history, not gates —
the standing gate family is app/harness-*.mjs, whose
deltas are named in §3. Private-shape parity stands at
code level (the change is one client paint path,
shape-independent; the fold and the payload are
untouched).
