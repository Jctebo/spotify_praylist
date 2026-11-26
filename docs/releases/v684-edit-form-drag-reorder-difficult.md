# v684 — Edit-form drag reorder is difficult on the phone

## §1 Scope

Reordering contents inside the Edit form (the Praylist's page-wide edit posture, v604/v607/v609) is done today by dragging a ☰ handle on each contents row. On the phone that drag is difficult to the point of failing in the field, and John retires it whole: **UP/DOWN MOVE BUTTONS on each Edit-form contents row become the only reorder mechanism in the Edit form, and the drag comes out — handlers, handle affordance, and drag styling.**

**Field report (John, 2026-11-26 00:43 CT, verbatim):** "Also, dragging is difficult"

**The fix pick (John, 2026-11-26 00:45 CT, verbatim):** "Up.down probably better" — candidate (c): UP/DOWN MOVE BUTTONS on each Edit-form contents row are the reorder mechanism.

**Drag fate (John, 2026-11-26 00:47 CT, verbatim):** "Retire drag" — the Edit-form drag retires whole: handlers, handle affordance, drag styling come out; buttons are the ONLY reorder mechanism in the Edit form.

Run level: To Ship (streamlined Scope+Plan pass — this doc's §1+§2 are that pass). DevOps Board row 1662, slug `edit-form-drag-reorder-difficult`. Base: origin/main `3d87110` (app code = the v680 pin tree, pin `ora-pro-nobis-v680-1` at ui.ts:1186), branch `release/v684`, worktree `~/workspace/.worktrees/v684` off the one standing clone. Holder: plan-v684.

### §1.1 Why the drag is difficult — the reproduced difficulty (code seats at base `3d87110`, re-verified firsthand at Plan; measurements from the harness drive, §2.4)

- **The target is far under a touch target.** Both Edit-form row builders emit the handle as a non-button inline span: `opnEditGroupHtml609` (client.ts:27025) and `opnEditPostureHtml604` (client.ts:24209) each emit `<span class="p604handle" data-p604handle="rid" title="Drag to reorder">&#x2630;</span>` + label + (group rows: the v670 segtoggle) + Remove button. Its CSS is one rule, ui.ts:504: `.p604handle { cursor:grab; touch-action:none; padding:0 10px 0 2px; color:var(--muted); user-select:none; }`. **Measured in the live DOM at 390px phone width (harness-v684 evidence line): the handle box is 27 × 21 px** — glyph + 12px of horizontal padding, height = the text line-height. A 44px touch target it is not.
- **The drag gives no visual feedback — the user drags blind.** `opnWireDrag604` (client.ts:24159) binds pointerdown on the handle → `preventDefault` → document-level pointermove/pointerup (no `setPointerCapture`, no pointercancel handler). A move reads `document.elementFromPoint` → `closest('[data-p604erow]')` → `opnDragOver604` (client.ts:24147), which swaps the item **in the data list only** (`opnMaterialize604(block)`'s list; `opn604.dragMoved = true`). No `.dragging` class, no transform, **the DOM rows never reorder until pointerup**, when `opnWrite604(block)` persists and repaints. **Harness evidence on the current tree: a driven drag of row 1's handle to row 2's center leaves the mid-drag DOM order byte-identical to the start order; only after pointerup does the order change (with 1 write).** The finger covers the tiny handle, nothing on screen moves, and the first visible result arrives after the finger lifts.
- **Scroll contention.** `touch-action:none` stands only on the tiny span; a finger landing off the glyph starts a page scroll instead of a drag, and there is no activation threshold or long-press either way. The only scroll help is auto-scroll of ±12px per move event within 80px of the viewport edges (client.ts:24171 ff).

### §1.2 Scope boundaries, settled

- **Only the Edit-form drag retires.** `data-p604handle` stands ONLY in the two Edit-form row builders above; `opnDragOver604` is called only from `opnWireDrag604`; `opnWireDrag604` is called once (client.ts:23804, the prayers-view wiring). No shared handler, no widening.
- **The Favorites + queue-sheet drags KEEP, untouched.** They are different machinery: `wireFavDragList` (client.ts:13563) behind the `.favhandle` **44 × 44 button** (ui.ts:579) with pointer capture, live DOM swap, and a pointercancel handler — the discipline this release's buttons match. The v664 queue-sheet drag (`data-npq-handle`, client.ts:6180/6195 ff, riding the same `wireFavDragList` machinery) likewise keeps. Neither surface is named anywhere in §2's removal seats.
- **No server change, no migration, no store change.** The buttons ride the standing save path (§2.2); the write shapes do not move.

## §2 Plan

### §2.1 Decision 1 — the buttons (both row builders)

Per contents row in BOTH row builders — `opnEditGroupHtml609` (client.ts:27001, the group rows of the page-wide form) and `opnEditPostureHtml604` (client.ts:24199, the per-block edit posture) — two buttons stand **after the label and before the office segtoggle / Remove button**, where the handle span stands today:

- `data-p684move="<block>|<rid>|up"` and `data-p684move="<block>|<rid>|down"`, `rid` the row's standing occurrence-qualified id (`opnRowId610`, client.ts:3259).
- Glyphs ▲ / ▼; aria-labels `"Move up"` / `"Move down"`.
- Hit box **≥ 44px tall, ≥ 40px wide** — the `.favhandle` discipline (ui.ts:579: 44 × 44) applied to a two-button seat. A new CSS rule in ui.ts beside the retired `.p604handle` seat carries the box; the buttons are real `<button>` elements, so they take focus, activation, and disabled state natively — everything the span could not do.
- **Boundary shape: the first row's up button and the last row's down button stand DISABLED (the `disabled` attribute)** — held across all blocks and both builders, so a row's layout never shifts as it moves through the list; the button stands, greyed, in its seat. (The standing precedent in this codebase: the Mass text-size segtoggle disables its boundary segment the same way, client.ts:8424.)

Wiring seat: `wirePrayersView` beside the standing `[data-p604remove]` / `[data-p670side]` wiring (client.ts:23790 ff) — one delegated query over `[data-p684move]`, splitting the attribute on `|` exactly as the Remove wiring splits `data-p604remove`, calling `opnMove684(block, rid, dir)`.

### §2.2 Decision 2 — the act rides the standing save path

New seat `opnMove684(block, rowId, dir)` beside `opnRemove604` / `opnFlipSide670` (client.ts:24089–24114), in their exact shape:

1. Resolve the addressed copy: `opnParseRowId610(rowId)` (client.ts:3260) → walk `opnMaterialize604(block)` (client.ts:24041) counting occurrences of `opnTodayItemId594(it)` to the addressed index — the opnRemove604/opnFlipSide670 discipline, so one of two standing copies of an hour moves, never the first copy by accident.
2. Swap the item object with its neighbor (`dir` up = index − 1, down = index + 1) **in the materialized list, whole** — the item object moves as-is, so an office item keeps its `side` stamp and the v670 toggle state is undisturbed (§2.4 L4 proves it).
3. Persist through **`opnWrite604(block)`** (client.ts:24053) — the same write Remove and the office toggle use: today-scope writes `/api/prayer/profiles/today-edit`, standing-scope writes `/api/prayer/profiles/save`; its done path repaints home + `profileRebuild()`, so the composed Praylist paint follows the new order with no new paint seat.
4. **Boundary no-op (defensive):** at index 0 moving up, or at the last index moving down, return without writing. The button is disabled anyway (§2.1); the guard keeps a stale-DOM or programmatic call inert.

### §2.3 Decision 3 — the drag retirement, every seat named

All in client.ts unless named:

| Seat | What comes out |
|---|---|
| client.ts:23804 | the `opnWireDrag604(view);` call in the prayers-view wiring |
| client.ts:24159–24185 | `opnWireDrag604` whole |
| client.ts:24147–24158 | `opnDragOver604` whole (its only caller is the seat above) |
| client.ts:24209 | the handle `<span class="p604handle" …>&#x2630;</span>` in `opnEditPostureHtml604` (the §2.1 buttons stand in its place) |
| client.ts:27025 | the handle `<span class="p604handle" …>&#x2630;</span>` in `opnEditGroupHtml609` (same) |
| ui.ts:504 | the `.p604handle { … }` CSS rule |
| client.ts:23906 + 24157 + 24179 | `opn604.dragMoved` — the state field and its two remaining touches (the set in `opnDragOver604`, the read/reset in the drag pointerup). **Grep at Plan: `dragMoved` stands at exactly these three seats and nowhere else** — no other reader, so the field retires with the drag. |

Untouched, named: `wireFavDragList` (client.ts:13563) and every `.favhandle` / `data-npq-handle` seat (§1.2); `opnDragOver604`'s store-construction comment at client.ts:26952 is a comment about within-block drags in the v635 paint note — Implement updates or removes that sentence with the retirement so no stale drag reference stands.

### §2.4 Decision 4 — pin

ui.ts CACHE → `ora-pro-nobis-v684-1` (its one seat, ui.ts:1186) at Implement.

### §2.5 Harness — `app/worker/harness-v684.mjs` (committed with this Plan)

Playwright-core Chromium, the real built Worker bundle (esbuild from source) served locally, the API stubbed in-page — the harness-v679 pattern. The stub's profiles store is production-shaped (the `opnProfilesPayload` shape): one standing profile (`salesian`) with stored contents; its today-edit / save PUTs are captured and applied to the stub store as the production routes apply them, and every GET serves a fresh JSON copy. Fixtures (Improvement D, production shapes): Morning contents of 4 stored items — a labeled-slot office item `{kind:'source', key:'ext-morning-prayer', side:'sth'}` (the v670 segtoggle row), `{kind:'prayer', key:'our-father'}`, `{kind:'source', key:'daily-rosary'}`, `{kind:'prayer', key:'hail-mary'}` — and a Midday block standing OFF in `coreBlocks` with one stored item (the v635 greyed group). The form opens through the standing entry tail (`opnLoadRes604` → scope `today` → `opnStartEdit607`) on a 390 × 844 phone viewport.

**Tally on the current tree (this Plan's own run): 7 ok, 16 bad** — exactly the predicted shape: L1–L5 fail, L6 passes.

| Leg | Current tree | Evidence |
|---|---|---|
| L1 buttons exist + geometry | **FAIL** (4/4 checks) | no `[data-p684move]` stands on any row |
| L2 driven move + persist | **FAIL** (5/5 checks) | no button to tap; no write; order never moves |
| L3 down + boundary | **FAIL** (3/3 checks) | no button to tap (the boundary check fails with it — its expected order presupposes the move) |
| L4 office row | **FAIL** (move check) | the office item never moves; the toggle-flip check **passes** — the v670 toggle already stands and flips today, named as standing behavior the move must not disturb |
| L5 no drag | **FAIL** (2/2 checks) | `data-p604handle` count in the form = **8**; a driven drag on row 1's handle swaps the order and writes once (below) |
| L6 form shape regression | **PASS** (3/3 checks) | groups at day positions, Midday greyed in place, Remove removes + writes — already-standing behavior the fix must not disturb |

**The reproduced difficulty, measured (harness evidence lines, current tree):**

- `.p604handle` box, first Morning row, live DOM at 390px: **27 × 21 px**.
- Driven center-drag, row 1's handle → row 2's center: **mid-drag DOM order unchanged** (`source:ext-morning-prayer · prayer:our-father · source:daily-rosary · prayer:hail-mary` before and during); after pointerup the order swaps (`prayer:our-father` first) with **1 write**. The drag works only blind, and only if the finger lands on a 27 × 21px span.

Legs, as Implement's gate reads them:

1. **L1 (buttons exist + geometry):** at 390px every Morning contents row carries up+down buttons in order, each box ≥ 40 wide × 44 tall, aria-labels "Move up"/"Move down"; first row up disabled, last row down disabled, inner buttons enabled.
2. **L2 (driven move + persist):** driven tap on row 2's ▲ → DOM order swaps at once; the stub's captured today-edit payload carries the new contents order; leave + re-enter the form → the order stands; the composed Praylist list (the today layer applied over the standing contents, `opnApplyTodayLayer594`) follows.
3. **L3 (down + boundary):** driven ▼ on row 1 moves it one seat; a driven tap on the disabled last-row down button changes nothing (order stands, no new write).
4. **L4 (office row):** moving the office item down keeps its segtoggle standing with the picked side (`sth`) active; the toggle still flips after the move (`do` active in the row and `side:'do'` in the saved payload).
5. **L5 (no drag):** `data-p604handle` count in the form is 0, and a driven pointer drag starting on a row moves nothing — no DOM change, no write. (On the current tree this leg's drag drive is the §1.1 evidence; post-fix there is no handle to grab, and the drive starts on the row itself.)
6. **L6 (form shape regression):** groups stand at day positions (v635), the off group (Midday) stands greyed in place, Remove still removes + writes.

Implement's gate: harness-v684 green whole (20/20 — the current tree's 23 count includes the 3 "button stands to be tapped" failure markers that stand only when no button exists) on the built tree, with L1–L5 flipping FAIL → PASS and no PASS check moving (L4's toggle-flip check and L6 stand as the regression floor).

### §2.6 Risks

- **Disabled-button layout stability:** the boundary shape (§2.1) exists precisely so rows never reflow as buttons enable/disable — a row's first/last status changes as neighbors move, and only the `disabled` attribute (plus its greyed dress) may change, never the box. L1 measures every row's boxes in one standing form; Review re-measures after a move (L2/L3's repaints) — a layout shift there is a fail.
- **Occurrence-qualified duplicates:** two copies of one hour can stand in a block (v610). The move MUST move the addressed copy — `opnMove684` inherits the `opnParseRowId610` occurrence walk from Remove/Flip (§2.2 step 1); a first-match implementation would silently move the wrong copy. The harness fixture carries no duplicate (John's standing Morning carries one office copy); Implement names the walk in its record, and Review reads the seat.
- **Today-scope vs standing-scope both ride `opnWrite604`:** the form opens on today scope at every entry (v609 repair 2) and flips to standing in the banner; the move act names no scope of its own, so both scopes take the identical path — the same property Remove and the toggle already stand on. The harness drives today scope (the entry default); standing scope is covered by the shared-seat reading, not a second drive.
- **v682/v683 land before this ships:** they are in flight on the same main. Rebase `release/v684` onto the shipped main at Ship; expected friction is the ui.ts pin seat only (each release bumps the same line) — resolve to `ora-pro-nobis-v684-1`. If either touches the Edit-form row builders or the prayers-view wiring, the §2.3 seat lines re-verify at rebase before the harness gate re-runs.

## §3 Implement record (implement-v684, contract 1156)

**Product change — implemented exactly per §2, committed `a6582cd`:**

- **Buttons (both builders):** new helper `opnMoveButtons684(block, rid, idx, len)` emits the two buttons — `data-p684move="<block>|<rid>|up"` (▲, aria-label "Move up") and `...|down"` (▼, aria-label "Move down") — standing after the label span and before the segtoggle/Remove in BOTH `opnEditGroupHtml609` and `opnEditPostureHtml604` (each builder's `forEach` now carries the row index; boundary shape held in both: first row's up and last row's down carry `disabled`). New CSS `.p684move` in ui.ts at the retired `.p604handle` seat: 40px wide × 44px tall hit box, ghost dress (muted glyph, no border/background), `disabled` at opacity .35 with default cursor.
- **Act:** `opnMove684(block, rowId, dir)` beside `opnRemove604` — the §2.2 occurrence walk stands by name: `opnParseRowId610(rowId)` → walk `opnMaterialize604(block)` counting occurrences of `opnTodayItemId594(it)` to the addressed index (the addressed copy moves when an hour stands twice), whole-object swap with the neighbor, persist via `opnWrite604(block)`; boundary (index 0 up / last index down), unknown id, and bad dir are defensive no-ops with no write. Wiring stands beside the `[data-p604remove]` wiring in `wirePrayersView`: one delegated query over `[data-p684move]`, split on `|`, covering both builders' rows on every repaint (the wiring re-runs per paint, as the Remove wiring does).
- **Drag retirement (whole):** the `opnWireDrag604(view)` call, `opnWireDrag604`, `opnDragOver604`, both handle spans, the ui.ts `.p604handle` rule, the `dragMoved` field in the `opn604` literal, and the stale drag sentence in the v635 paint comment at `opnEditSetHtml609` (rewritten to name `opnMove684`) all removed. **Grep-zero proof (client.ts + ui.ts): `p604handle` = 0, `opnWireDrag604` = 0, `opnDragOver604` = 0, `dragMoved` = 0.** Favorites drag (`wireFavDragList` / `.favhandle`) and queue-sheet drag (`data-npq-handle`) untouched.
- **Pin:** ui.ts CACHE → `ora-pro-nobis-v684-1` (its one seat).
- **Regression pin re-point (commit `474d31f`):** harness-v670's pin leg re-pointed by name from `ora-pro-nobis-v672-1` to `ora-pro-nobis-v684-1` per the standing rule — the ONLY harness edit made by Implement.

**Gate — harness-v684 on the built tree: 18 ok / 2 bad. NOT GREEN — both failures are harness-drive defects, proven against the product; Implement stopped rather than edit an assertion (per the gate rule). Evidence:**

1. **L5 second check ("a driven pointer drag starting on a row moves nothing"):** the harness drive reads the bounding box of `[data-p604handle]` and drives only `if (hb && row2)`. Post-fix there is no handle: measured `hb = null`, the drive never runs, `afterOrder` stays `null`, and the check compares `null` against the start order → FAIL on any correct tree. §2.5's own L5 text says post-fix "the drive starts on the row itself" — the committed harness does not implement that drive. The product facts the check means to prove DO stand: handle count in the form = 0 (L5 first check ok), writes during the leg = 0, order unchanged. **Fix needed in the harness drive (Plan seat): drive from a row's box when no handle stands, and read `afterOrder` unconditionally.**
2. **L3 second check ("a driven tap on the DISABLED last-row down button changes nothing"):** the harness clicks raw mouse coordinates at the button's bounding-box center. At that scroll position the button box stands at y 798–842, underneath the app's fixed bottom tab bar: measured `document.elementFromPoint(245, 820)` = `BUTTON.tab[data-tab=conscience]` — the click switches to the Conscience tab and the form leaves the DOM (`dom2 = []`). Product proof with the button scrolled into clear view: `elementFromPoint` = the disabled button itself, a real mouse click there changes nothing (order stands, caps stays 1, form stays open). **Fix needed in the harness drive (Plan seat): scroll the target into view / use the locator click (as L6's Remove drive already does) instead of raw bounding-box coordinates.**

All other harness-v684 legs pass on the built tree: fixture + setup, L1 (4/4 — buttons, ≥40×44 geometry, aria labels, boundary disabled shape), L2 (4/4 — driven move, today-edit payload order, re-entry, composed list), L3 first check (down moves one seat), L4 (2/2 — office item moves with segtoggle + `sth` active; toggle still flips to `do` in row and saved payload), L5 first check (handle count 0), L6 (3/3 — group order, Midday greyed in place, Remove removes + writes).

**Regression — harness-v670 on the built tree: 31 ok / 1 bad.** The one failure is its (b)+(d) row-shape check (harness-v670.mjs:404-405), which asserts the office row "carries drag handle" via `html.includes("data-p604handle")` — an assertion v684 §2.3 supersedes whole (harness-v684 L5 requires that count to be 0; the two cannot both pass). Every functional v670 leg passes, including the toggle flip, persistence, reload, and migration legs. Not edited by Implement: authorization covered the pin leg only. **Plan/Review seat: retire the `data-p604handle` term from that check (the row now carries the two `data-p684move` buttons in its place).**

**Deviations from the Plan:** none in product code. Two harness-drive defects (harness-v684 L5/L3) and one superseded assertion (harness-v670:405) are named above for the Plan/Review seat; the gate stands RED on those harness seats only, with product behavior proven correct for each by direct drive.

## §4 Review (review-v684, contract 1159)

**Verdict: PASS on the product, RETURN on the harness seats.** The product change in `a6582cd` stands as planned whole; the gate is red only on three harness seats, named as repairs R1–R3 below. No product repair is returned. The repairs are NOT made by Review — a repair seat follows this return, and a re-review judges them.

**Independent re-runs (Review's own drives on the built tree, not §3's word):**

- harness-v684: **18 ok / 2 bad** — identical tally to §3. Passing: fixture + setup, L1 4/4 (buttons on every row, ≥40×44 geometry, aria labels, boundary disabled shape), L2 4/4 (driven move, today-edit payload order, re-entry, composed list), L3 first check (down moves one seat), L4 2/2 (office item moves whole with segtoggle + `sth` active; toggle still flips to `do` in row and saved payload), L5 first check (handle count 0), L6 3/3 (group order, Midday greyed in place, Remove removes + writes). Failing: L5 second check (`afterOrder: null`, writes 0) and L3 second check (`dom2: []`, writes 0) — both reproduced firsthand and traced to the harness drives, below.
- harness-v670: **31 ok / 1 bad** — identical tally to §3. The sole failure is the (b)+(d) row-shape check at harness-v670.mjs:404-405 on the `data-p604handle` term; every functional leg passes (migration, toggle flip, persistence, reload, paint).

**Diff verdict per seat — `a6582cd` read whole:**

- Buttons, both builders: PASS. Shared helper `opnMoveButtons684(block, rid, idx, len)` emits `data-p684move="<block>|<rid>|up"` / `|down"` (▲/▼, aria-labels "Move up"/"Move down") after the label and before the segtoggle/Remove in BOTH `opnEditGroupHtml609` and `opnEditPostureHtml604`; each builder's `forEach` carries the row index into the helper. Boundary disabled shape stands in both builders by the shared helper: `idx === 0` disables up, `idx === len - 1` disables down, the button stands in its seat either way. CSS `.p684move` at the retired `.p604handle` seat: 40px wide × 44px tall, ghost dress, `:disabled` opacity .35.
- Act: PASS. `opnMove684` beside `opnRemove604` performs the §2.2 occurrence walk by name (`opnParseRowId610` → walk `opnMaterialize604(block)` counting `opnTodayItemId594` occurrences to the addressed index), swaps the item object whole with its neighbor (an office item keeps its `side` stamp — corroborated by L4's drive), persists via `opnWrite604(block)`, and returns without writing on bad dir, unknown id, or boundary (index 0 up / last index down).
- Wiring seat: PASS. One delegated query over `[data-p684move]` in `wirePrayersView` beside the `[data-p604remove]` wiring, splitting the attribute on `|` and calling `opnMove684(p[0], p[1], p[2])`.
- Retirement seats: PASS, grep-zero re-verified by Review in client.ts + ui.ts: `p604handle` = 0, `opnWireDrag604` = 0, `opnDragOver604` = 0, `dragMoved` = 0. The `opnWireDrag604(view)` call, both functions, both handle spans, the `.p604handle` CSS rule, the `dragMoved` field, and the stale v635 paint comment (rewritten to name `opnMove684`) are all out.
- Untouched drags: PASS. `wireFavDragList` / `.favhandle` (Favorites) and `data-npq-handle` (queue sheet, client.ts:6180/6201, riding `wireFavDragList`) stand in the tree and appear nowhere in the `a6582cd` diff except a comment reference to the `.favhandle` discipline.
- Pin: PASS. ui.ts CACHE = `ora-pro-nobis-v684-1` at its one seat; harness-v670's pin leg (commit `474d31f`) reads it green.

**Why the three failures are harness defects, verified firsthand:**

1. L5 (harness-v684): the drive locates `[data-p604handle]`, and drives only `if (hb && row2)`. Post-fix no handle stands — Review's run logs the handle box as `null`, the drive never runs, `afterOrder` stays `null`, and the check compares `null` ≠ start order. Writes during the leg = 0 and handle count = 0: the product facts the leg means to prove stand. §2.5's L5 text requires the post-fix drive to start on the ROW itself; the committed harness does not implement that drive.
2. L3 (harness-v684): the disabled-tap drive raw-clicks `pg.mouse.click` at the button's bounding-box center with no scroll into view, at a scroll position where that center sits under the fixed bottom tab bar — the form leaves the DOM (`dom2 = []`, the tab-switch symptom §3 measured via `elementFromPoint`). §3's scrolled-into-clear-view proof (tap lands on the disabled button itself, nothing changes) stands uncontradicted; L6's Remove drive in the same harness uses the locator click, which scrolls into view, and passes.
3. harness-v670:404-405: the check asserts the office row "carries drag handle" via `html.includes("data-p604handle")` — superseded whole by §2.3; harness-v684 L5 requires that count to be 0, so the two assertions cannot both pass on any tree.

**Repairs returned — exactly these three, no assertion weakened:**

- **R1 — harness-v684 L5:** when no handle stands, drive the drag from a ROW's box (pointerdown on the row body, move, up) and read `afterOrder` unconditionally; the leg asserts order unchanged + 0 writes + handle count 0.
- **R2 — harness-v684 L3:** drive the disabled-tap with the button scrolled into clear view (scrollIntoView + locator click, as L6 already does) so the tap lands on the button itself.
- **R3 — harness-v670 :404-405:** retire the `data-p604handle` term; the office row's reorder affordance now stands as `data-p684move` — re-point that check to the move buttons' presence (same leg intent: the row carries its reorder control).

No assertion may be weakened: R1/R2 keep their full assertions (order, writes, counts); R3 keeps asserting a reorder affordance stands on the office row.

### §4.1 Repair note (repair-v684, contract 1161)

The three harness repairs returned in §4 are made. No product code changed — client.ts/ui.ts stand byte-identical to the tree Review judged.

- **R1 — harness-v684 L5 (commit `2b664db`):** when no `[data-p604handle]` stands, the drag drive now runs from a ROW's box — pointerdown on the row body (center) of the first Morning contents row, pointermove to the next row's center, pointerup — and `afterOrder` is read unconditionally afterward. Full assertions kept: handle count in the form = 0 · DOM order after the drag attempt unchanged · 0 save writes from the attempt.
- **R2 — harness-v684 L3 (commit `2b664db`):** the disabled-boundary tap no longer raw-clicks the bounding-box center. The disabled last-row down button is scrolled into clear view (`scrollIntoView({block:'center'})`, clear of the fixed bottom tab bar) and tapped with a locator click (the L6 pattern, `force:true` for the disabled state), so the tap lands on the button itself. Assertions unchanged: order stands, write count stands, form stays open.
- **R3 — harness-v670 :404-405 (commit `223d560`):** the `data-p604handle` term is retired whole (grep: 0 in harness-v670.mjs). The (b)+(d) check now asserts the office row carries its reorder affordance as `data-p684move` — both `data-p684move="Morning|source:ext-morning-prayer|up"` and `...|down"` standing in the row's HTML. Same leg intent, same strength.

**Tallies (built tree, Repair's own runs):**

- Before: harness-v684 **18 ok / 2 bad** · harness-v670 **31 ok / 1 bad** (identical to §3/§4).
- After: harness-v684 **20 ok / 0 bad — green whole** · harness-v670 **32 ok / 0 bad — green whole**.

**Diff scope:** the Repair commits touch only `app/worker/harness-v684.mjs`, `app/worker/harness-v670.mjs`, and this release doc. `git diff --stat` over the Repair range (`ce0a035..HEAD`, §4.1 doc commit excluded from the harness proof and included in the final range read-back) names no client.ts/ui.ts change — the product tree Review judged did not move.

### §4.2 Re-review (review-v684, second seat)

**Verdict: PASS — repairs accepted, release cleared for Ship.** The three returned harness repairs (R1–R3) are made as specified, no assertion was weakened anywhere in the repair diff, and the product tree the first Review judged stands unchanged. No finding is returned.

**Independent re-runs (Re-review's own drives on the current tree, not §4.1's word):**

- harness-v684: **20 ok / 0 bad — green whole.** L5's evidence lines confirm the repaired drive actually ran from the row: mid-drag and after-pointerup DOM orders both read the start order (`source:ext-morning-prayer · prayer:our-father · source:daily-rosary · prayer:hail-mary`) with **0 writes** during the drag. L3's disabled-tap check passes with the form standing.
- harness-v670: **32 ok / 0 bad — green whole.** The re-pointed (b)+(d) check passes in its new form; every other leg stands as before.

**Repair verdict per seat — `git diff ce0a035..HEAD` read whole (commits `2b664db` R1+R2 · `223d560` R3 · `321f76f` doc §4.1):**

- **R1 — harness-v684 L5: PASS.** When no `[data-p604handle]` stands, the drive now runs from a ROW's box: the first Morning contents row's box is read (`row1`), pointerdown lands on the row body center, pointermove goes to the next row's center, pointerup follows. `afterOrder = await morningRows()` is moved out of the handle branch and read **unconditionally**. Assertions whole and unchanged in strength: handle count in the form = 0 · DOM order after the drag attempt equals the start order · writes during the attempt = 0 (`capsAfter === capsBefore`). The handle branch itself is untouched, so the leg still measures the old drag on a tree that carries one.
- **R2 — harness-v684 L3: PASS.** The disabled last-row down button is scrolled into clear view (`scrollIntoView({block:'center'})`, clear of the fixed bottom tab bar) and tapped with a locator click (`force:true`, the disabled-state form of the L6 pattern) instead of a raw bounding-box mouse click. The assertion line is byte-identical to the pre-repair form: order equals the post-move order AND no new write (`capsN2 === capsN`) — and the form standing to be read for `dom2` is itself part of what the check now proves.
- **R3 — harness-v670 :404-405: PASS.** The `data-p604handle` term is retired whole (grep: 0 in harness-v670.mjs). The (b)+(d) check now asserts the office row carries its reorder affordance as the `data-p684move` pair — BOTH `data-p684move="Morning|source:ext-morning-prayer|up"` AND `...|down"` must stand in the row's HTML. Same leg intent (the office row carries its reorder control), same or greater strength: one presence term became two exact-attribute terms, and every other term of the check (segtoggle, `sth` active, side-naming label, Remove) stands unchanged.

**No assertion weakened — proof:** the repair diff touches exactly three files (`app/worker/harness-v684.mjs`, `app/worker/harness-v670.mjs`, this doc). In harness-v684 only the two drive blocks changed; every `check(...)` expression in the file is unchanged except that L5's `afterOrder` read is now unconditional (stronger, not weaker). In harness-v670 only the one (b)+(d) check changed, per R3 above. Check-call counts are identical before and after the repair range in both files (harness-v684: 24 · harness-v670: 35).

**Product identity — proof:** `git diff ce0a035..HEAD -- app/worker/src/client.ts app/worker/src/ui.ts` is empty (0 lines). Blob hashes are identical at `ce0a035` and at HEAD, and identical to the product commit `a6582cd` the first Review judged: client.ts `38a0246ac583405055664b1b249980e30c2da9ab` · ui.ts `f3151d988acffa74cfad09ea3dd3e568ca934110`. The product tree Review passed in §4 stands byte-identical; the repair range changed harness seats and this doc only.

**Ship clearance:** the §4 gate condition is met — harness-v684 20/0 and harness-v670 32/0 on the unchanged product tree. v684 is cleared for Ship (rebase onto shipped main + pin-seat resolution per §2.6 at Ship, as planned).
