# v595 — Praylist: the profile card row retires

## §1 Scope

John's direct instruction (Ora thread, 2026-11-21 15:39 CT),
with his screenshot of the Praylist and the profile card
scribbled out: "And please stop showing this row."

The PROFILE CARD — the card under the Prayer plan row that
read the standing profile's name ("The Salesian Way"), its
resolution line ("Your every day profile"), and the honor
line — is REMOVED from the Praylist. After the change the
Praylist stands: the Prayer plan row (Configure plan) →
Favorites → the blocks.

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

Gates on the working tree:

- **harness-v595: 17 ok / 0 not ok** — T1 the card is gone
  whole (no paint, no class, no flag, no card-era wiring,
  no resolution lines) · T2 exactly one configure act ·
  T3 both ladder doors stand · T4 the shared helpers stand
  · T5 no new migration · T6 pin unmoved pre-Ship · T7 the
  rendered client parses whole · P1–P3 the RENDERED
  Praylist paint (paintListenHome run against a standing
  Salesian fold): the plan row paints with its one act, NO
  profile card paints (no profcard, no fold name, no honor
  line), the order stands plan row → Favorites slot →
  blocks · A1/A2 EQUIVALENCE: a Salesian weekday and a
  Sunday compose byte-identical to the v593 ship · D/F the
  day map, day-pick, and assignment writes stand.
- Regression deltas vs base (main af43c7f), every red
  named: harness-v593 **20/0 — zero delta** · harness-v592
  **10/2 — zero delta** (T3/T4 assert the v592 mapping
  button/pop-up retired by v593) · harness-v591 **29/3 —
  zero delta** (S1/S2/S11 assert the pop-up surface retired
  by v593) · harness-v590 **29/8 vs base 30/7 — one
  by-design red**: S4 ("the home paint emits the Configure
  plan row BEFORE the profile card") asserts the card this
  release retires; its premise is gone by John's word.
