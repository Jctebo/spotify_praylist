# v711 — Now Playing buttons a little bigger (transport + bottom row)

- **Status:** PLAN (§§1–2) — holder: chain-v711-plan — streamlined Scope+Plan pass, run level **To Ship**
- **Base:** `ff5f0ec` (origin/main; production pin `ora-pro-nobis-v708-1`)
- **Board:** DevOps Board row 1692 · slug `now-playing-buttons-bigger` · time contract 1303
- **Scope of this phase:** Plan only. No app code in Plan.
- **Execution-risk notice (named per the standing approval, John 2026-11-21 as amended 2026-11-27):** the worktree was created off the standing clone under John's standing clone-processing approval in `~/AGENTS.md`; work proceeded under it, no per-chain word sought.

## §1 Grounding

### 1.1 Direction (John, verbatim)

> "Also make the buttons a little bigger" (John, 2026-11-27 20:27 CT, replying to his Now Playing screenshot)

The buttons of the Now Playing card, two rows:

- **(a) The transport row** — `−10 · previous · play/pause · next · +10` (v652: five equal flex cells under a 420px cap, play exactly centered).
- **(b) The bottom row** (`.np-controls`) — `Intentions · Read · Star · Share · ⋮ · Queue` pill (v667 added the Queue pill last, id `np-queue-btn`).

A modest step up for both rows: bigger tap targets and glyphs. Not a redesign.

### 1.2 The transport row — current geometry (shipped code, origin/main `ff5f0ec`)

CSS seats, `app/worker/src/ui.ts`:

| Seat | Rule (line) | Values |
|---|---|---|
| Row | `.np-transport` (ui.ts:724) | `display:flex; align-items:center; justify-content:center; max-width:420px; margin:16px auto 20px` |
| Cells | `.np-transport > button` (ui.ts:725) | `flex:1 1 0; display:flex; align-items:center; justify-content:center` — five equal-grow cells, the middle (play) cell at the row's exact center |
| Side controls | `.np-tbtn` (ui.ts:726) | `background:none; border:none; font-size:26px; padding:10px` — glyph **26px**, padding **10px** |
| Play | `.np-play` (ui.ts:728) on `.playbtn` (ui.ts:313) | `width:58px; height:58px; font-size:21px` — disc **58px**, glyph **21px** |

Markup seat: `app/worker/src/client.ts:19351` — `#np-back10` (`-10`) · `#np-prev` (⏮) · `#np-play` · `#np-next` (⏭) · `#np-fwd10` (`+10`), in that order.

**Measured on the base tree** (Chromium headless, the measure-v667 seat pattern, Plan's own run 2026-11-27; 390px wide, the v667 field card):

- Row box: **261 × 64px** (the sheet's inner width binds well under the 420px cap at phone width; the cap binds only on wide sheets).
- Cell boxes are **not** pixel-equal in paint: `flex-basis:0` + `min-width:auto` floors each cell at its min-content, and the free space distributes over those floors. Measured: back10 **55×50** · prev **51×64** · play **43×58** · next **51×64** · fwd10 **61×50**.
- Two consequences that govern §2: (1) the row's painted height (**64px**) is set by prev/next — the ⏮/⏭ glyphs' line box at 26px font stands taller than the −10/+10 text (50px) and taller than the play disc (58px); (2) the play disc's painted **width** is min-content-bound (43px in Chromium's font), while its **height** is the CSS-fixed 58px. The prescription therefore grows the binding dimensions: side glyph font + side padding (height), and the play disc's fixed height + glyph.

### 1.3 The bottom row — current geometry

CSS seats, `app/worker/src/ui.ts`:

| Seat | Rule (line) | Values |
|---|---|---|
| Row | `.np-controls` (ui.ts:729) on `.row` (ui.ts:296) | `justify-content:center; flex-wrap:nowrap; gap:4px` — one line always (v667 §3.2) |
| Members | `.np-controls .btn.ghost` (ui.ts:730) | horizontal padding **6px** (v667 compression, from the base 16px) |
| Member base | `button.btn` (ui.ts:287) + `button.btn.ghost` (ui.ts:289) | `min-height:44px; padding:9px 16px; font-size:15px; font-weight:600/400` |
| Share glyph | inline SVG, client.ts:19352 | `width="20" height="20"` — **20×20px** |

Markup seat: client.ts:19352 — `#np-intentions` · `#np-read` · `#np-star` (☆) · `#np-share` (SVG) · `#np-menu` (⋮) · `#np-queue-btn` (Queue), in that order.

**Measured on the base tree** (same run as §1.2): every member stands **44px** tall (the `min-height:44px` governs; content + vertical padding is shorter). Widths: Intentions **103** · Read **50** · Star **27** · Share **34** · Menu **29** · Queue **59** — member sum 302px + 5 gaps × 4px = **322px** of row. The Queue pill carries **no size rule of its own**: it is a plain `.btn.ghost` member and takes the row's dress whole. At 360px wide the row's members span 19–341 inside the sheet's 14–346 (v667 §8 measure) — **~10px of horizontal headroom at 360px**, the tightest horizontal case; §2 prices against it.

### 1.4 The one-page fit discipline

- **v664's card-fit rule:** the card never scrolls (`.sheet.np-sheet` overflow hidden, `.inner` a full-height flex column); the artwork is sized to what the page leaves after the fixed stack stands at full size: `.np-art { --art: clamp(88px, min(72vw, calc(100dvh - 414px)), 340px) }` (ui.ts:709). The **414px budget** prices the fixed stack by name (ui.ts:700–708): sheet padding 54 · hero padding/border 34 · grab 15 · art margin 4 · title 33 · meta 30 · intention 26 (priced at one line) · litday 18 · seek 56 · **transport 94** (margins 36 + disc 58) · **controls 44** · slack 6.
- **v667's fit pass:** `fitNpArtToSheet667()` (client.ts:19491, called at `updateNowPlaying`'s end, client.ts:19489, and re-run on resize) — clears the inline `--art`, measures `.inner` overflow (`scrollHeight − clientHeight`); if any stands, it reduces `#np-art`'s `--art` by exactly the overflow via an inline property, re-measures once, and stops at the standing **88px floor**. The artwork yields for the stack's real height; the stack itself never clips.
- **The short-viewport step:** `@media (max-height: 660px)` (ui.ts:752–758) — hero padding compresses, seek margins 10/2, transport margins 8/10, title + intention clamp to two lines, so the 88px floor never pushes an element off.
- **The standing fit cases** (harness-v664.mjs / harness-v667.mjs / measure-v667.mjs): **390px wide × heights 844 / 740 / 667 / 568**, each with the long intention (the Desiree text verbatim from John's 2026-11-25 screenshot, five lines on device) and with a one-line intention — eight geometries. Standing tallies at base: **harness-v664: 33 ok / 0 not-ok** · **harness-v667: 38 ok / 0 not-ok** · **measure-v667: 11 ok / 0 not-ok** (v667 doc §§7–8).
- **Measured fit margins at base** (v667 §8 Review, Chromium, 390 wide; margin = inner bottom − bottom-row bottom): 844-long **107** · 740-long **3** · 667-long **0** (art yielded 253 → **211**) · 568-long **44** (art 154) · 844-one-line **168** · 740-one-line **64** · 667-one-line **19** (art 253) · 568-one-line **65** (art 154). Plan's own base run (§1.2) reproduces the same art sizes: 281 / 281 / 211 / 154 (long), 281 / 253 / 154 (one-line at 667/568).

### 1.5 The pin seat

`app/worker/src/ui.ts:1225`, inside the `SW_JS` template: `var CACHE = "ora-pro-nobis-v708-1";` — the one seat, confirmed at base. The v711 pin bump (`ora-pro-nobis-v711-1`) lands at Ship as its own commit, per the standing ship shape; Plan and Implement do not touch it.

## §2 Prescription — "a little bigger", one step

### 2.1 The size table (old → new; every change named)

| # | Control | Seat | Old | New | Δ |
|---|---|---|---|---|---|
| 1 | Transport side glyphs (−10 · ⏮ · ⏭ · +10) | `.np-tbtn` font-size, ui.ts | 26px | **30px** | +4 |
| 2 | Transport side tap target | `.np-tbtn` padding, ui.ts | 10px | **12px** | +2/side |
| 3 | Play disc | `.np-play` width/height, ui.ts | 58px | **66px** | +8 |
| 4 | Play glyph | `.np-play` font-size, ui.ts | 21px | **24px** | +3 |
| 5 | Bottom-row button height | `.np-controls .btn.ghost` min-height, ui.ts | 44px | **50px** | +6 |
| 6 | Bottom-row vertical padding | `.np-controls .btn.ghost` padding-top/bottom, ui.ts | 9px (base `.btn`) | **12px** | +3/side |
| 7 | Bottom-row glyph/text size | `.np-controls .btn.ghost` font-size, ui.ts | 15px (base `.btn`) | **16px** | +1 |
| 8 | Bottom-row horizontal padding | `.np-controls .btn.ghost` padding-left/right, ui.ts | 6px | **5px** | −1/side (the fit trade, §2.3) |
| 9 | Share glyph | inline SVG `width`/`height`, client.ts:19352 | 20×20 | **24×24** | +4 |
| 10 | Queue pill (`#np-queue-btn`) | no rule of its own — inherits rows 5–8 whole | 44px tall, 15px text | **50px tall, 16px text** | as the row |

Expected painted effect (Chromium arithmetic from §1's measured boxes; the harness measures the real values): transport row height 64 → **~72–76px** (prev/next glyph line scales with the 30px font; the 66px play disc stands under it), −10/+10 boxes 50 → **~59px** tall; bottom row 44 → **50px** tall, every member. Total fixed-stack growth: **~+14 to +18px** (transport ~+8 to +12, controls +6).

Implementation shape: rows 1–8 are CSS-only, in the two standing rules (`.np-tbtn`, `.np-play`, `.np-controls .btn.ghost` — the last gains the vertical/font declarations; its standing comment is updated to name v711). Row 9 is the one markup change: two attribute values in the `#np-share` SVG on client.ts:19352. No other file, no other line.

### 2.2 Untouched (stated)

- The five-cell transport shape (`flex:1 1 0` cells), the centered play cell, and the **420px cap** — untouched; the growth is vertical and glyphic, the row's width math does not move.
- The bottom-row seat order (Intentions · Read · Star · Share · ⋮ · Queue) and the one-line `nowrap` discipline — untouched.
- All behavior and handlers: every click wiring (client.ts:19359–19364 and the rest of `openNowPlaying`), the seek row, the dock — untouched. No id, class, or aria-label changes.
- The fit pass `fitNpArtToSheet667`, the **414px budget constant**, the 88px floor, and the `@media (max-height: 660px)` step — untouched (§2.3: the pass absorbs the growth; re-pricing the constant is not needed and would only shrink the stylesheet artwork at dvh-bound heights).
- The pin (§1.5) — untouched until Ship.

### 2.3 The fit verdict

**Verdict: the growth is absorbed. The 88px floor does not bind at any standing geometry; no element trades away.**

Derivation, from §1.4's measured base margins minus the §2.1 stack growth (~+17px at the priced maximum; the ≤660px cases keep their margin compression, so their growth is the same rows-only ~+17px):

| Case (390 wide) | Base margin | After growth | Artwork before → after | How it fits |
|---|---|---|---|---|
| 844 · long | 107 | ~90 spare | 281 → 281 | stylesheet size stands |
| 740 · long | 3 | ~14 overflow | 281 → **~267** | fit pass yields |
| 667 · long | 0 (already yielded) | ~17 more yield | 211 → **~194** | fit pass yields; **106px above the floor** |
| 568 · long | 44 | ~27 spare | 154 → 154 | stylesheet size stands (≤660 clamps stand) |
| 844 · one-line | 168 | ~151 spare | 281 → 281 | stands |
| 740 · one-line | 64 | ~47 spare | 281 → 281 | stands |
| 667 · one-line | 19 | ~2 spare | 253 → 253 (or a ≤2px yield) | stands / fit pass |
| 568 · one-line | 65 | ~48 spare | 154 → 154 | stands |

The worst case is 667-long, where the artwork already yields at base: it yields ~17px further to ~194px, still **106px above the 88px floor** — the yield headroom at the tightest case is more than 6× the prescribed growth. The mechanism is height-agnostic (it measures the real overflow on the real device, where the intention wraps to five lines against Chromium's four), so the verdict holds on John's phone by the same mechanism that holds it in the harness. **The one named trade** is horizontal, not vertical: the bottom row's horizontal padding steps 6px → 5px (row 8) to pay for the 16px font and the 24px share glyph inside the 360px one-line case — priced: member sum 302 + ~17 growth (text at 16px ≈ +13, share +4) − 12 padding = **~307px + 20px gaps = ~327px ≤ the ~332px available at 360 wide**. Every member's tap height and glyph still grow; only the side air gives 1px per side.

### 2.4 Harness plan for Implement

- **`app/worker/harness-v711.mjs`** (new, jsdom, modeled on harness-v667): served-CSS legs for rows 1–8 (`.np-tbtn` 30px/12px · `.np-play` 66px/24px · `.np-controls .btn.ghost` min-height 50px, padding 12px vertical / 5px horizontal, font-size 16px) · markup leg for row 9 (the `#np-share` SVG at 24×24, byte-identical otherwise) · seat-order legs (transport five ids in order; controls six ids in order, Queue last) · behavior legs (play/prev/next/back10/fwd10 act as at base; `#np-queue-btn` opens the queue sheet; star/share/menu/intentions/read wired) · the untouched legs (420px cap and cell rule stand; budget constant 414 stands; `fitNpArtToSheet667` stands with its 88px floor).
- **`app/worker/measure-v711.mjs`** (new, Chromium, modeled on measure-v667; same fixtures — the field card verbatim, long + one-line intentions; Improvement D provenance as in v667): (a) computed-box legs at 390×844 — transport row height ≥ base +6, each side control's height > base, play box height = 66, bottom-row members all 50px tall; (b) **the one-page fit leg at the standing cases** — 390 × 844/740/667/568 × both intentions: `scrollHeight ≤ clientHeight`, artwork square and ≥ 88px, the Queue button's box inside the sheet, the bottom row one line; (c) the row one line at **360/390/412** wide with all six members inside; (d) **fail-on-old**: the same script against a scratch worktree at base `ff5f0ec` reports the old sizes (transport row 64, controls 44, play 58) and fails the growth legs there.
- **Regressions, standing tallies at base (§1.4), must stay clean:** harness-v664 **33 ok / 0 not-ok** · harness-v667 **38 ok / 0 not-ok**. Three legs are re-pointed **by name** in Implement, on the v667 precedent (a release that changes what a leg prices re-points the leg and names it): harness-v664 leg D and harness-v667 leg D (bottom-row byte-equality — the base five stand in order with `#np-share` differing **only** in its SVG `width`/`height` attributes, 20 → 24, + Queue appended) and harness-v667's `.np-controls` padding leg (the rule text gains the v711 declarations; horizontal padding 5px). No other leg of either harness changes; the transport-markup byte-equality legs stand unmodified (v711 does not touch the transport markup line).

### 2.5 Ship shape (for the later phases)

Web only, client-only: no APK, no migration, no Worker/door change. Pin bump `ora-pro-nobis-v708-1` → `ora-pro-nobis-v711-1` at Ship as its own commit (seat §1.5); merge `release/v711` to main; deploy from merged main; live-verify the served pin and the served CSS carrying the §2.1 values. Field leg is John's: the two rows visibly bigger on his phone, the card still whole on one page.

## §3 Implement record (chain-v711-impl, 2026-11-27)

### 3.1 Seats changed (old → new; exactly §2.1, nothing else)

| # | Seat | Old → New |
|---|---|---|
| 1–2 | `.np-tbtn` (ui.ts) | font-size 26px → **30px** · padding 10px → **12px** |
| 3–4 | `.np-play` (ui.ts) | width/height 58px → **66px** · font-size 21px → **24px** |
| 5–8 | `.np-controls .btn.ghost` (ui.ts) | gains `min-height:50px; padding:12px 5px; font-size:16px;` — height 44px → **50px** · vertical padding 9px → **12px** · font-size 15px → **16px** · horizontal padding 6px → **5px** (the §2.3 trade); the standing comment updated to name v711 |
| 9 | `#np-share` SVG (client.ts, the np-controls markup line) | `width`/`height` 20 → **24** (the attribute seat Plan named) |
| 10 | Queue pill `#np-queue-btn` | no rule of its own — verified inheriting the row: measured 50px tall at 16px row dress in measure-v711 |

Untouched per §2.2, all harness-proven: five-cell shape, centered play, 420px cap, seat order both rows, all handlers, `fitNpArtToSheet667`, the 414px budget, the 88px floor, the ≤660px step. Transport markup byte-equal to base `ff5f0ec`; bottom-row markup byte-identical to base except the share SVG attributes.

### 3.2 Coordinator override — the pin bumped HERE, in Implement

§1.5/§2.2 placed the pin bump at Ship. **Coordinator override (named):** the pin bumps in Implement, per the standing chain pattern (v706/v708 carried the new pin in the branch; the merge asserts it). Seat: `ui.ts` SW_JS CACHE `ora-pro-nobis-v708-1` → **`ora-pro-nobis-v711-1`**, in the sizes commit (7b7666e). Ship therefore has no separate pin commit; it asserts the merged pin reads `ora-pro-nobis-v711-1`. Consequence named: the pin legs of harness-v664 and harness-v667 were re-pointed to `ora-pro-nobis-v711-1` in the re-point commit (they stood stale at base — v664's leg expected v667-1 and v667's expected v672-1 against the shipped v708-1 pin, so both read 32/1 and 37/1 at base before any v711 change; with the re-point both read full green, §3.3).

### 3.3 Harness tallies

- **harness-v711 (new): 36 ok / 0 not-ok** — served-CSS legs rows 1–8 · markup leg row 9 (24×24, byte-identical otherwise vs `ff5f0ec`) · seat-order legs (source + DOM) · behavior legs (next advances · prev · back10/fwd10/play act · intentions flips its store · star toggles · Queue button opens the queue sheet · all wiring verbatim) · untouched legs (420px cap + cell rule · 414 budget · fit pass + 88px floor · ≤660px step · Queue pill no own rule) · pin leg.
- **measure-v711 (new, Chromium): 18 ok / 0 not-ok** — growth boxes at 390×844: transport row **64 → 75px** · back10/fwd10 50 → 58 · prev/next 64 → 75 · play height **66** · all six bottom-row members **50px** (Queue pill included). Fit leg green at all 8 standing geometries (390 × 844/740/667/568 × long/one-line: `scrollHeight ≤ clientHeight`, art square ≥ 88px, Queue inside, row one line). Row one line at 360/390/412 with all six members inside.
- **Fail-on-old (measure-v711, `OPN_WT` = scratch worktree at base `ff5f0ec`): CONFIRMED** — the base tree reads the old sizes (transport row 64 · play 58 · controls members 44 each), so the growth legs fail there; the fit legs stand at base as before (base 667-long art 211px).
- **Regressions: harness-v664 33 ok / 0 not-ok · harness-v667 38 ok / 0 not-ok.** Re-points, each marked superseded-by-v711 in the harness with the assertion otherwise unchanged: (1) harness-v664 leg D — bottom-row byte-equality: base five in order, byte-equal except `#np-share` SVG attrs 20→24; (2) harness-v667 leg D — same re-point; (3) harness-v667's `.np-controls` padding leg — the rule text gains the v711 declarations (`min-height:50px; padding:12px 5px; font-size:16px;`), horizontal padding 5px. Plus the pin-leg re-points named in §3.2 (v664 + v667, to `ora-pro-nobis-v711-1`) — a consequence of the coordinator's pin override, not of §2.1. No other leg of either harness changed.

### 3.4 The fit verdict — CONFIRMED by driven numbers

Plan §2.3 predicted absorption with the floor never binding. measure-v711's driven numbers confirm it: artwork at the standing cases (long intention): 844 → **281** (stands) · 740 → **267** (fit pass yields from 281) · **667-long → 194px** (fit pass yields from base 211; **106px above the 88px floor**) · 568 → **154** (stands). One-line: 281 / 281 / 253 / 154. Every case `scrollHeight ≤ clientHeight` with the bottom row whole and one line. The 667-long measured artwork height is **194px**, exactly Plan's ~194 prediction.

### 3.5 Queue note + commits

- **v710 check:** `origin/main` read at Implement close — still `ff5f0ec`; v710 has not shipped and main has not moved during Implement. No rebase taken (per brief); if main moves before Ship, Ship re-derives the delta.
- Commits on `release/v711`: `7b7666e` (§2.1 sizes + pin, coordinator override) · `0d39365` (regression re-points) · `e26ae00` (harness-v711) · `d59580e` (measure-v711) · this §3 commit.
- Execution-risk notice: none drawn beyond the standing clone-processing approval named in §1; work proceeded under it.

## §4 Review record (chain-v711-review, 2026-11-27) — PASS

### 4.1 Diff audit (release/v711 vs base ff5f0ec) — PASS

- Production files changed: `app/worker/src/ui.ts` (4 lines) and `app/worker/src/client.ts` (1 line) only, plus the two new harness files, the two regression-harness re-points, and this doc.
- ui.ts seats, exactly §2.1 + the coordinator pin override: `.np-tbtn` font-size 26px → 30px, padding 10px → 12px · `.np-play` 58px → 66px, glyph 21px → 24px · `.np-controls .btn.ghost` gains `min-height:50px; padding:12px 5px; font-size:16px;` · SW_JS CACHE `ora-pro-nobis-v708-1` → `ora-pro-nobis-v711-1`. No other ui.ts line moves.
- client.ts: the single changed line is the np-controls markup line; the only change in it is the `#np-share` SVG `width`/`height` 20 → 24. Transport markup line byte-identical.
- Untouched list (§2.2) verified unchanged in the diff: five-cell shape (`flex:1 1 0`), centered play, 420px cap, seat order both rows, all handlers, `fitNpArtToSheet667`, the 414px budget, the 88px floor, the ≤660px step — none of those lines appear in the production diff.

### 4.2 Independent re-runs (Review's own runs, fresh, on release/v711 head 766c919)

- **harness-v711: 36 ok / 0 not-ok** — matches Implement.
- **measure-v711: 18 ok / 0 not-ok** — growth boxes at 390×844: transport row 75px · play height 66 · all six bottom-row members 50px. Fit leg green at all 8 standing geometries (390 × 844/740/667/568 × long/one-line); **667-long artwork measured 194px** (106px above the 88px floor), matching Plan's prediction and Implement's number. Row one line at 360/390/412.
- **harness-v664: 33 ok / 0 not-ok** · **harness-v667: 38 ok / 0 not-ok** — regressions clean at the standing tallies.

### 4.3 The pin-leg flag — verdict: Implement's claim CONFIRMED

- Implement re-pointed five legs: Plan's three (harness-v664 leg D, harness-v667 leg D, harness-v667 `.np-controls` padding leg) plus the pin legs of harness-v664 and harness-v667. Diff of the two harness files vs base shows only those five legs moved, each marked superseded-by-v711 (the pin legs re-named to `ora-pro-nobis-v711-1`); assertions otherwise unchanged.
- Baseline verified independently: Review ran both harnesses in a scratch worktree at pristine base `ff5f0ec`. **harness-v664 at base: 32 ok / 1 not-ok** — the sole failing leg is the pin leg, expecting the stale `ora-pro-nobis-v667-1` while base ships `ora-pro-nobis-v708-1`. **harness-v667 at base: 37 ok / 1 not-ok** — the sole failing leg is the pin leg, expecting the stale `ora-pro-nobis-v672-1`. Both pin legs therefore stood stale at base, before any v711 change; the re-points repair a pre-existing staleness and mask no v711 defect.

### 4.4 Fail-on-old spot check — CONFIRMED

- measure-v711 run with `OPN_WT` = the scratch base worktree reads the old sizes at base: **transport row 64 · play 58 · bottom-row members 44 each** (667-long artwork 211px at base) — the v711 growth legs fail on the base tree, as Implement reported.

### 4.5 Verdict

- **PASS.** All checks green: diff audit clean, independent tallies match Implement's (36/0 · 18/0 · 33/0 · 38/0), pin-leg baseline claim confirmed, fail-on-old confirmed, 667-long artwork 194px. Clear to Ship at pin `ora-pro-nobis-v711-1`.
- Execution-risk notice: none drawn beyond the standing clone-processing approval named in §1; work proceeded under it.

## §5 Ship record (chain-v711-ship, 2026-11-27) — LIVE

### §5.1 Disposition

- **v711 LIVE at pin `ora-pro-nobis-v711-1`.** Web only, client-only: no APK, no migration, no Worker/door change.

### §5.2 Merge

- Queue check at Ship: `origin/main` read **unmoved at `ff5f0ec`** — v710 (Stations production + dynamic item, app half) had **not** shipped and no nightly-runner commit stood past the branch base. No reconciliation was needed: the merged tree is exactly the branch tree, and no v710 content exists on main to retain (v710 ships after v711 and re-derives onto this main).
- Merge commit: **`1eeff218da5e73fde91fd910ffcf9fc8c1489f36`**, tree **`c5aae3ac2887bf10f7103736c9c44bf3aaeb6f67`**; parent `ff5f0ec` (current `origin/main` at Ship time).
- Tree-exact via the Git Data API (`~/workspace/.tools/push-v711-github.py`, modeled on v708): the merged tree was asserted == main's tree + exactly the v711 delta (7 paths: `app/worker/src/ui.ts` `94891542` · `app/worker/src/client.ts` `95fb1908` · `app/worker/harness-v664.mjs` `b80ecb42` · `app/worker/harness-v667.mjs` `84bd22bd` · `app/worker/harness-v711.mjs` `3c5c3309` · `app/worker/measure-v711.mjs` `965bd62e` · this doc `c21bcf2d`), every blob SHA asserted.
- Single-parent tree-exact commit (v708/v709 precedent): the branch head commit object does not stand on GitHub, and a two-parent creation was refused (422 on the first attempt, before any ref update; the retry with the single parent landed). Never force-pushed; the release branch stays local.
- Read back at merge time: **main pushed · remote in sync** (remote main == `1eeff218`, tree == `c5aae3ac`).

### §5.3 Clone-processing note

- The ship worktree (`v711-ship-main`) was created at the merged head under the standing approval (John, 2026-11-21; AGENTS.md rule of 2026-11-27: the standing approval IS the authorization for every Ora chain's clone processing, ship worktrees included). No execution-risk notice was drawn in this seat; had one been drawn, this seat would have proceeded under that approval and named it here.

### §5.4 Deploy

- Deploy driver `~/workspace/.tools/deploy-app-v711-ship.py`, `EXPECTED_HEAD = 1eeff218da5e73fde91fd910ffcf9fc8c1489f36`; dry-run passed first, then deploy from the ship worktree at the merge head.
- Worker **`ora-pro-nobis-app`** · version ID **`12644244-a405-43a0-9116-f90a931e7b09`** · version created **2026-11-28T02:48:50.116Z** · **100%**.

### §5.5 Production verification (from served bytes)

- Served `sw.js` reads **`ora-pro-nobis-v711-1`**.
- Served `styles.css` carries **`.np-play { width:66px; height:66px; font-size:24px; }`** · **`.np-tbtn { … font-size:30px; … padding:12px; }`** · **`.np-controls .btn.ghost { min-height:50px; padding:12px 5px; font-size:16px; }`**.
- Served `app.js` carries the `#np-share` SVG at **`width="24" height="24"`** (×1).
- Prior shipped content retained in the served bundle: v709's **`dayStoredPos709`** ×3 · v708's **`opnMaterializeRep708`** ×2. (v710 had not shipped — nothing of v710 stood on main to retain.)

### §5.6 Board closeout

- **What's New id 526**: "Changed: the player buttons are a little bigger — the transport controls and the bottom row are easier to tap."
- **Releases row 1692**: status **Live** · `shipped_at` = 2026-11-28T02:48:50Z (the deploy timestamp) · `whats_new_id` = 526. Read back.
- **shipped_records id 900**: project 3 · version v711 · title "Now Playing buttons a little bigger (transport + bottom row)" · `shipped_at` = 2026-11-28T02:48:50Z · `whats_new_id` = 526. Inserted AND read back.
- **Ship phase record id 2980**: release 1692 · Ship · passed · holder `chain-v711-ship` · slug `now-playing-buttons-bigger` · document_path `docs/releases/v711-now-playing-buttons-bigger.md` · `commit_hash` = `1eeff218da5e73fde91fd910ffcf9fc8c1489f36`. Read back. (Scope 2976 · Plan 2977 · Implement 2978 · Review 2979 stand passed.)
- **Ship contract 1306**: expectation **met** through the door (merge · deploy + served-bytes verification · closeout).
- **Goals Board intake 1351**: CLOSED, status **Done** — closeout line appended; read back via the task list.

**Disposition: v711 LIVE at pin `ora-pro-nobis-v711-1`.**
