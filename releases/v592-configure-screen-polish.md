# v592 — Configure screen polish (compact · full-screen · day mapping pop-up)

## §1 Scope

John's field direction on the shipped v591 (Ora thread, 2026-11-21
14:19 CT, verbatim): "Looks great make config a little more compact
and condifgure fill.sxrren proper. Put day mapping button towards
the tip as.anpopuo. Only one row on the.oraylist to configure".
Approved TO SHIP (2026-11-21 14:23 CT, verbatim: "Ship it") on the
scope as stated in the thread (row 1566):

1. **Compact** — the Configure screen's rows and spacing tighten;
   same content and acts, less height per row.
2. **Full screen** — the Configure surface opens as a full screen,
   edge to edge, with its own scroll — not a partial sheet.
3. **Day mapping — top button + pop-up** — a "Day mapping" button
   stands towards the top of the Configure screen; tapping it opens
   the day mapping as a pop-up (the seven days with their profiles;
   each day opens its profile pop-up from there, as built in v591).
4. **One configure row on the Praylist** — verified and enforced:
   exactly one configure row stands on the Praylist; any second
   configure act standing anywhere on it is removed.

Small-release class: presentation only. The v591 model, fold, save
model, day-map semantics, contents machinery, and all data stand
untouched. No migration. The no-op equivalence discipline applies
(a day composes byte-identical to the v591 ship).

## §2 Plan

- **client.ts** — `openProfilesScreen`:
  - The screen root takes the full-screen form: it mounts as a
    full-viewport surface (edge to edge, own scroll) instead of the
    standing drawer sheet. Open/close acts stand as built (the
    Praylist's Configure plan row and the Settings row reach it).
  - The standing day mapping SECTION (§2.4 of v591: the "Every day"
    row + seven weekday rows painted on the screen) retires from
    the screen body. A **Day mapping button** stands in the head
    area (after the head line, before the chips row / blocks);
    tapping it opens a **mapping pop-up** on the same pop-up builder
    (`openPop`): an "Every day" row + Mon–Sun rows, each naming its
    profile; tapping a row opens that scope's profile pop-up;
    closing it returns to the mapping pop-up, which closes back to
    the screen. All v591 mapping behavior stands (seeded Sunday →
    The Benedictine Way; per-day Apply; the Sunday default line).
  - The profile pop-up's return path adapts: a pop-up opened from
    the mapping pop-up closes back to the mapping pop-up (the
    standing `paintPop`/`closePop` stack gains the mapping as a
    scope of its own — no new builder).
- **ui.ts** — the compact dress + the full-screen form + the SW pin
  bump to ora-pro-nobis-v592-1 at Ship:
  - Compact values (the Configure surface's own classes only):
    screen padding 14px → 10px; head-line margin 10px → 6px; chips
    row padding 8px → 5px, chip padding 8px 13px → 6px 11px; block
    row padding 10px 2px → 7px 2px; contents rows padding 6px 2px →
    4px 2px; the standing line 4px → 2px margins; section titles
    margin 16px → 10px; save-acts row margin 14px → 10px. Nothing
    outside the Configure surface's classes changes value.
  - Full-screen: a `.profscreenfull591`-class rule (new class on
    the screen root) — position fixed inset 0, full width/height,
    own overflow scroll, no sheet radius/margin.
- **One configure row — audit first.** The v591 build already
  removed the profile card's acts (harness-v591 S3). The audit
  re-reads the shipped Praylist render: the Configure plan row
  (first row, `data-profconfigure="1"`) must be the ONLY configure
  act; the card carries name + standing line only. harness-v592
  counts configure acts in the Praylist render function = 1.
- **harness-v592** (new; production fixtures only — John's import
  file + the v589 Bible fixture): compact dress statics (the
  tightened values stand in ui.ts) · the screen root carries the
  full-screen class · the Day mapping button stands in the head
  (before the first block row in the screen's paint order) and the
  mapping paints through the pop-up builder with NO standing
  mapping section left in the screen body · the Praylist render
  carries exactly ONE configure act and the card carries none ·
  day-map resolution stands (seeded Sunday → Benedictine; an
  edited day stands) · the EQUIVALENCE LEG (a Salesian weekday +
  a Sunday compose byte-identical block lists + per-block track
  identity to the v591-shipped composition) · SW pin unmoved
  pre-Ship · no new migration (0044 newest) · the rendered client
  parses whole.
- **Regressions** — harness-v591 stands at 32/0 or every delta is
  a named superseded static (the mapping-section statics are the
  expected class: S1's screen composition names the section's
  seat — each delta named, never rounded).

Gates: harness-v592 on the working tree AND a clean checkout of
the committed tree AND the merged tree; served proofs after
deploy (pin ora-pro-nobis-v592-1 · served app.js parses whole ·
one configure row on the served Praylist · the Day mapping button
in the served screen's head, no standing mapping section · public
personal-data reads empty).

## §3 Implement (chain-v592-build, 2026-11-21)

Built on branch release/v592 off main e12300e (v591), in the
standing clone's worktree. Presentation only — client.ts (the
Configure screen) + ui.ts (its dress); index.ts untouched, no
migration, no data change.

**Full screen.** The screen's sheet now carries
`profscreenfull592`; the rule `.sheet.profscreenfull592 .inner`
sets width 100%, max-width none, height/max-height 100dvh
(!important — mountDrawer's tall-drawer inline 92dvh yields),
border-radius 0. The sheet's panelbody is the scroll, as
before; open/close acts stand (the Praylist's Configure plan
row, the Settings row, the scrim, the labeled close).

**Day mapping — top button + pop-up.** `paint()` no longer
paints the standing mapping section (the "Day by day" rows are
gone from the screen body; no `data-p591day` stands anywhere
in the client). In the head — after the "Today follows" line,
before the chips row — stands a **Day mapping** button
(`data-p592daymap`). It opens `openMapPop()`: a sheet
(`.profmap592`) on the same mountDrawer, painting the Every
day row + Mon–Sun rows (each naming its profile) into a
stable `.profmapbody` container (the S11 discipline — never a
whole repaint of a mounted sheet). A row opens that scope's
profile pop-up via the standing `openPop` — the pop mounts
above the mapping sheet, and its close/Apply/save paths
return to the mapping pop-up, which repaints from the fresh
state (`mapPaintFn`, refreshed beside every `paint()` the
pop-up triggers); the mapping's own Close returns to the
screen. All v591 mapping behavior stands (seeded Sunday →
The Benedictine Way; per-day Apply; the Sunday default line
in the Sunday pop-up).

**Compact.** Scoped overrides for the Configure family only
(`.profplan590` screen · `.profpop591` pop-up · `.profmap592`
mapping pop-up): book rows padding 12px 14px → 8px 10px,
margin 10px → 6px; `.sub` margin 12px → 8px; section heads
18px → 12px top; chips row margin 12px → 8px; chips padding
7px 14px → 5px 11px, min-height 44px → 38px; contents margin
10px → 6px; stepper buttons min-height 36px → 32px; the
full-screen panelbody padding 14px → 10px sides. Shared dress
outside the family is untouched.

**One configure row — audited.** The shipped Praylist render
paints exactly one configure act (`data-profconfigure="1"`,
the first-row Configure plan card at the day render); the
profile card carries no configure acts (its v591 information-
only shape stands). Nothing further stood to remove; the
count is proven by harness-v592 T5, not asserted.

**Gates on the working tree.** harness-v592: **12 ok / 0 not
ok** — T1 compact dress · T2 full-screen root + rule · T3 the
button in the head (after the head line, before the chips) ·
T4 the pop-up mapping + no standing section · T5 the
one-configure-row count (= 1; the card none) · T6 no new
migration · T7 pin unmoved pre-Ship · T8 the rendered client
parses whole · A1/A2 EQUIVALENCE (a Salesian weekday and a
Sunday compose byte-identical block lists + per-block track
identity to the v591 ship) · D1/D2 the day map still resolves
(an overwritten Sunday stands and composes the Little Way).
Regression: harness-v591 **32 ok / 0 not ok** — stands at its
shipped count with zero deltas (its statics never pinned the
mapping section's seat, so the expected superseded-static
class does not arise).
