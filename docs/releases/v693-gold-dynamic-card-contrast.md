# v693 — Gold dynamic card contrast: the Add sheet's gold card text reads at full contrast

## §1 Scope

**Direction (John, 2026-11-26 08:57 CT, verbatim):** "gold button doesn't show up well on black background" — field report with screenshot (`~/workspace/user/files/6295_5_lnge.jpg`): the "Add to Midday" sheet, dark mode; at the head of the CatholicTV series node stands the v688 gold card "Catholic TV Mass · Daily / The day's Mass, standing new every day / Daily" — the title in white on the pale gold fill (near-invisible), the sub-line in grey, the "Daily" tag washed out. The fixed episode rows below it read fine.

**Clarification (John, 2026-11-26 08:58 CT, verbatim):** "It's the text isn't redable. Maybe not a dark mode peonle." — read "problem". The defect is the TEXT's readability itself, NOT a dark-mode fault.

**The cause, grounded in the card's own dress (per John's word):** the shared gold-card class `.p666daily` carries its fill in its own rule and NO text color at all. Its one rule (`app/worker/src/ui.ts:590`) reads in full:

```css
.profaddladder603 .p666daily { background:#f6ecd3; border-color:var(--gold); box-shadow:0 1px 4px rgba(168,134,58,.25); }
```

The fill is pinned in the class — a pale gold `#f6ecd3`, the same in every mode; no `[data-mode="dark"]` rule names `.p666daily` anywhere (whole-client search, §2.1). But the class defines no `color` for any of its three text elements, so the text is not the card's own — it is borrowed from outside the class: the title (`span.grow`) inherits the body color (`ui.ts:149`, `color:var(--ink)`), the sub-line takes `.sub`'s color (`ui.ts:223`, `color:var(--muted)`), and the "Daily" tag takes `.meta`'s color (`ui.ts:282`, `color:var(--muted)`). The pairing is therefore broken standing on its own: the card pins a light fill and pins no text to stand on it. In light mode the borrowed colors happen to be dark and the card passes; in dark mode the borrowed colors are the dark grounds' light text (`--ink:#f5f5f5` · `--muted:#a8a8a8`, `ui.ts:129`) and the same card fails — but the defect seat is the class itself, not the mode layer: the mode tokens stand as designed for the grounds they dress, and this release does not touch them. The fix (§2.3) makes the class own its text the way it owns its fill.

**Current computed contrast on the standing pairing** (WCAG ratio math on the grounded values, §2.2): dark mode — title **1.08:1**, sub-line **2.02:1**, tag **2.02:1** (all fail 4.5:1); light mode — title 12.79:1, sub-line 5.02:1, tag 5.02:1 (pass, by borrowing luck, not by the class's design).

**Base at Plan:** `origin/main` at `180d93d7dc317bfaa48a75660c0daae5b0f68cb7` — the post-v690 main head (v690 shipped 2026-11-26T14:56:09Z; fetched firsthand at Plan). Branch `release/v693`, worktree `~/workspace/.worktrees/v693` off the one standing clone. Holder: plan-v693. All line citations are `app/worker/src/ui.ts` (ui) or `app/worker/src/client.ts` (client) at base `180d93d` unless named otherwise. DevOps Board row 1671, slug `gold-dynamic-card-contrast`; Goals Board intake 1309.

**IN:** the gold dynamic card's dress — the ONE shared class `.p666daily` standing on the v688 Mass cards and the v666 "Add daily" cards — corrected so title, sub-line, and the "Daily" tag read at computed contrast ≥ 4.5:1 on the gold fill in BOTH modes (dark + light), the card still reading GOLD at a glance · the harness (§2.4).

**OUT, named:** no change to any other Add-sheet row (the fixed episode rows in the screenshot read fine and stand out of scope) · no change to the `[data-mode="dark"]` token layer or any `:root` token · no change to `client.ts` (no markup, no row builder, no kind) · no change to the card's fill, border, or shadow · no change to the marked state's dress (`.profadd-on603` opacity, `ui.ts:591` — the standing ladder-wide already-standing discipline; the harness proves the unmarked card, the screenshot's state) · no server, migration, or APK work.

## §2 Plan

### §2.1 The shared class and every seat it paints

**The class:** `.p666daily`, scoped `.profaddladder603 .p666daily`. Its CSS is the single rule at `ui.ts:590` quoted in §1 — fill `#f6ecd3` (hard-coded literal, never re-pointed), border `var(--gold)` (`#a8863a`, `ui.ts:82`), shadow `0 1px 4px rgba(168,134,58,.25)`. The card element also carries `.card.bookrow` (the ladder's row dress, `ui.ts:581`), whose rule sets `background:var(--card)` — the `.p666daily` rule wins the fill at equal specificity (two classes each), standing later in the file (`ui.ts:590` after `ui.ts:581`).

**The card's structure** (both row builders emit the same shape): `div.card.bookrow.p666daily > div.row > span.grow` (the title) `+ span.meta` (the "Daily" tag, or "Already in \<block\>" when marked) `+ p.sub` (the sub-line, when one stands).

**Every seat the class paints** — whole-client search for `p666daily` (`app/worker/src/`, base `180d93d`): the definition at `ui.ts:590` and exactly TWO builders in `client.ts`, both inside the Add ladder's `rowHtml`:

1. **The v666 "Add daily" arm** — `client.ts:26618–26627` (`item.daily666`): built by `dailyRow614` (`client.ts:26538`, gated on `opnDailyKeyOk666`, the closed five-series set at `client.ts:2851`). Its call seats: `readingsNode614` (`client.ts:26691`, daily-readings) · `exegesisNode614` (`client.ts:26710`, daily-gospel-exegesis) · `seriesNode614` (`client.ts:26749`, any daily series' node) · `videoNode656` (`client.ts:26775`, the catholicsaints video node — the one daily series on the video route).
2. **The v688 Mass arm** — `client.ts:26629–26638` (`item.mass688`): built by `massRow688` (`client.ts:26546`, gated on `opnMassKeyOk688`, the closed four-source set at `client.ts:2860`). Its call seats: `videoNode656` (`client.ts:26775`, the catholictv · dailytvmass · springfieldmass nodes — the screenshot's seat) · `massAudioNode688` (`client.ts:26559–26564`, the `vmass-audio:daily-tv-mass` node's whole content) · the head search's 'Videos › Virtual Mass' group (`client.ts:26817`, the four Mass cards constructed directly through `rowHtml`).

**Nowhere else.** No other file in `app/worker/src/` names the class; no Praylist row, no Edit-form row, no other surface wears it. (The remaining hits in the repo are harness files reading the class — `harness-v666.mjs` · `harness-v668.mjs` · `harness-v688.mjs` — not paint seats.) One class, two builders, the Add ladder only: a dress fix at `ui.ts:590` reaches every gold dynamic card and nothing else.

**The text colors the class borrows today** (the §1 cause, by element):

| Element | Seat | Light value | Dark value | Source |
|---|---|---|---|---|
| Fill | `.p666daily` background | `#f6ecd3` | `#f6ecd3` | `ui.ts:590` — the class's own, both modes |
| Title | `span.grow`, inherited | `#2a2620` (`--ink`) | `#f5f5f5` (`--ink`) | `ui.ts:149` body color · tokens `ui.ts:82` / `ui.ts:129` |
| Sub-line | `p.sub` | `#6d6353` (`--muted`) | `#a8a8a8` (`--muted`) | `ui.ts:223` · tokens `ui.ts:88` / `ui.ts:129` |
| "Daily" tag | `span.meta` | `#6d6353` (`--muted`) | `#a8a8a8` (`--muted`) | `ui.ts:282` · tokens `ui.ts:88` / `ui.ts:129` |

### §2.2 Current computed contrast (WCAG math, shown)

Ratio = `(L1 + 0.05) / (L2 + 0.05)` over relative luminance (sRGB, the standing harness math in `harness-v669.mjs`). Fill `#f6ecd3` luminance ≈ 0.838.

| Element | Light mode | Dark mode |
|---|---|---|
| Title | `#2a2620` on `#f6ecd3` = **12.79:1** ✓ | `#f5f5f5` on `#f6ecd3` = **1.08:1** ✗ |
| Sub-line | `#6d6353` on `#f6ecd3` = **5.02:1** ✓ | `#a8a8a8` on `#f6ecd3` = **2.02:1** ✗ |
| "Daily" tag | `#6d6353` on `#f6ecd3` = **5.02:1** ✓ | `#a8a8a8` on `#f6ecd3` = **2.02:1** ✗ |

The dark column is the screenshot: the white title at 1.08:1 is near-invisible; the grey sub-line and tag at 2.02:1 are washed out. The light column passes only because the borrowed colors happen to be dark there — the class guarantees nothing in either mode.

### §2.3 The means — (a) dark ink on the standing gold fill, picked

**(b) Deepened gold with light text — rejected on the numbers.** Deepening the fill to the standing text-gold `#866b2e` (`--gold-text`, `ui.ts:107`): white title = 5.05:1 ✓, but the sub-line/tag need a secondary tone lighter than the title's white is impossible — the palest standing secondary, the fill's own `#f6ecd3`, measures **4.30:1 ✗** on `#866b2e`; only near-white passes for all three elements, which collapses the title/sub hierarchy the card now carries. On brand gold `#a8863a` itself, white measures 3.42:1 ✗. A deeper fill (`#7a5f24`: white 6.02:1, cream 5.54:1) passes arithmetically but the card stops reading as the pale gold card of the screenshot and of every shipped screenshot since v666 — the dynamic-card signal changes, which §1 holds fixed. (b) cannot hold 4.5:1 for the sub-line/tag with a real secondary tone; (a) can, with room.

**(a) Dark ink on the standing gold fill — PICKED.** The fill does not move (`#f6ecd3` + `var(--gold)` border + the standing shadow: the card reads GOLD at a glance, byte-identical silhouette). The class takes its own text colors, as literals — NOT `var(--ink)` / `var(--muted)`, because those tokens re-point under `[data-mode="dark"]` (`ui.ts:129`), which is exactly the borrowing that broke the pairing. The literal values are the tokens' standing light values, so light mode's rendering does not change at all; dark mode's card becomes the light card's own dress, owned by the class in both modes. Precedent in the same file: the gold mark tiles already pair dark ink on gold (`.tone-gold > .p659mark { color:#16283f }`, `ui.ts:825`).

**Exact writes for Implement — `app/worker/src/ui.ts` only, no other file:**

1. Amend the rule at `ui.ts:590` to add the title's color (inherited by `span.grow`, which no rule colors directly):

```css
.profaddladder603 .p666daily { background:#f6ecd3; border-color:var(--gold); box-shadow:0 1px 4px rgba(168,134,58,.25); color:#2a2620; }
```

2. Add two scoped rules immediately after it (specificity: three classes beat `.sub` / `.meta` at one class, `ui.ts:223` / `ui.ts:282`, in both modes; no `[data-mode]` variant is added or needed):

```css
.profaddladder603 .p666daily .sub { color:#6d6353; }
.profaddladder603 .p666daily .meta { color:#6d6353; }
```

**Post-fix computed contrast — identical in BOTH modes** (the class's literals do not re-point):

| Element | Value on `#f6ecd3` | Ratio |
|---|---|---|
| Title | `#2a2620` | **12.79:1** ✓ |
| Sub-line | `#6d6353` | **5.02:1** ✓ |
| "Daily" tag | `#6d6353` | **5.02:1** ✓ |

Every element ≥ 4.5:1 in both modes, the fill and border untouched, the gold signal unchanged. No liturgical theme reaches these literals (`[data-lit]` re-points only `--accent*` / `--bar-*`, `ui.ts:110–114`), so the pairing holds on every liturgical day as well.

### §2.4 The harness — `app/worker/harness-v693.mjs`

On the Chromium pattern of `harness-v669.mjs` (playwright-core + the pwtest Chromium, build + serve the built bundle, the standing WCAG `parseColor`/`lum`/`contrast` math carried over) — computed styles from a real browser, not jsdom, because the proof is a cascade claim (specificity + inheritance + the mode attribute). Mode is set through the standing device store (`opn-mode-v669`: dark = `[data-mode="dark"]` standing, light = the attribute absent). Fixtures from production (Improvement D): the production captures `app/tests/fixtures-v656/catholictv.json` (the screenshot's own series payload) and the v669/v688 fixture sets for the saint series node; no invented payload shapes.

- **C1 (dark, the Mass card — the screenshot's seat):** dark mode standing; the Add sheet open on a block, the CatholicTV series node standing; the unmarked `.p666daily` card stands. Read `getComputedStyle`: card `background-color` = `rgb(246, 236, 211)`; title (`.grow`) `color`, sub-line (`.sub`) `color`, tag (`.meta`) `color` each taken against the computed fill — contrast **≥ 4.5:1 per element**, and the computed colors equal the §2.3 literals (`rgb(42, 38, 32)` title · `rgb(109, 99, 83)` sub-line and tag). On the pre-fix tree this leg reads 1.08 / 2.02 / 2.02 and fails — fail-on-old by construction.
- **C2 (light, the Mass card):** the same node with the mode attribute absent; the same three computed contrasts ≥ 4.5:1 and the same literal colors (the class owns the pairing in both modes — the two modes' readings are identical).
- **C3 (both kinds, both modes):** the v666 "Add daily" card on the saint-of-the-day series node carries the same three assertions in dark AND light — the shared class proven on its second builder, not only on the Mass arm.
- **C4 (the gold signal stands):** in both modes the card's computed `border-color` = `rgb(168, 134, 58)` (`--gold`) and its fill stays `rgb(246, 236, 211)`; the card still carries `.p666daily` and stands at the head of its node (the v688 M1 seat, re-read here for this class only).
- **C5 (the dress is the class's own):** the served `/styles.css` carries the amended `ui.ts:590` rule with `color:#2a2620` and the two scoped `.sub` / `.meta` rules with `#6d6353`; and NO rule naming `p666daily` stands under a `[data-mode="dark"]` scope (the pairing is owned by the class, per §1's cause).
- **S (screenshots):** 390×844, the Add sheet with the gold card standing, dark AND light → `docs/releases/v693-screenshots/01-add-sheet-dark.png` · `docs/releases/v693-screenshots/02-add-sheet-light.png`. Review reads both firsthand; the dark shot is the screenshot defect's direct re-read.
- **Regressions:** `harness-v688.mjs` must stand at its base tally **65 ok / 0 not-ok** (read firsthand by Plan at this base, §2.5). `harness-v666.mjs`: at this base it LOAD-CRASHES before its legs (pre-existing — §2.5); Implement runs it, and if the crash is the identical base crash, records it unchanged and does NOT repair it and does NOT count it as a v693 red.

### §2.5 Base readings and risks

- **Read firsthand by Plan at base `180d93d`:** `node app/worker/harness-v688.mjs` → **65 ok / 0 not-ok**. `node app/worker/harness-v666.mjs` → throws at load: `Error: server validate shape moved: function validateProfileContents(contents: unknown, coreBloc…` at `harness-v666.mjs:131` (`stripServerValidate`) — its extraction recipe predates the v690 validator widening; the crash is in the harness's recipe, not in the app, and it stands identical before any v693 change.
- **Risk — specificity:** the two new rules must land scoped exactly as prescribed (`.profaddladder603 .p666daily .sub` / `.meta`); an unscoped `.p666daily .sub` (two classes) still beats `.sub` (one class) but the ladder scope is the dress's standing shape and keeps the fix inside the one surface the class paints. The harness C1–C3 computed readings are the proof, not a source read.
- **Risk — inheritance:** the title's color rides on inheritance from the card rule (no rule anywhere colors `.grow` directly — verified by search at base); if a future rule colors `.grow`, C1/C2 catch it as a computed miss.
- **Risk — marked state:** a marked card (`profadd-on603`, opacity .55, `ui.ts:591`) blends toward the sheet ground under the standing ladder discipline, as every already-standing row does; that dress is OUT (§1) and the harness asserts the unmarked card, the state in John's screenshot and the state a user reads before adding.
- **No other risk surface:** no token moves, so no other surface's contrast changes; no `client.ts` change, so no row, kind, validator, or resolver seat moves; the diff is three CSS lines in one file plus the harness and this doc.

## §3 Implement record

**Base and commits.** Worktree `~/workspace/.worktrees/v693` on branch `release/v693` off the standing clone, base `origin/main` `180d93d7` (the Plan commit `c37fb40` stands on it). Build commits: `d21dad8` (the ui.ts fix) · `6e9718b` (harness-v693 + screenshots). No other production file touched; no scope change.

**The fix — `app/worker/src/ui.ts` only, exactly as prescribed in §2.3.** The rule at `ui.ts:590` amended to add the title's color, and two scoped rules added immediately after it:

```css
.profaddladder603 .p666daily { background:#f6ecd3; border-color:var(--gold); box-shadow:0 1px 4px rgba(168,134,58,.25); color:#2a2620; }
.profaddladder603 .p666daily .sub { color:#6d6353; }
.profaddladder603 .p666daily .meta { color:#6d6353; }
```

Literals, NOT `var(--ink)` / `var(--muted)` — the class now owns its text/fill pairing in both modes. Fill, gold border, and shadow unchanged; no `[data-mode]` variant added; no token, `client.ts`, markup, or builder change.

**Harness — `app/worker/harness-v693.mjs`: 26 ok / 0 bad** (Chromium, the harness-v669/v668 pattern: the real built bundle served locally, production fixtures — `app/tests/fixtures-v656/catholictv.json` for the screenshot's series, the v668/v669 fixture set for the saint series node; mode through the standing device store `opn-mode-v669`; computed styles from the real browser).

| Leg | Result |
|---|---|
| C1 dark Mass card | computed title `rgb(42, 38, 32)` = **12.79:1** · sub-line `rgb(109, 99, 83)` = **5.02:1** · tag `rgb(109, 99, 83)` = **5.02:1** on the computed fill — all ≥ 4.5:1, literal colors asserted |
| C2 light Mass card | identical readings to C1 (the class owns the pairing in both modes; the two modes' readings asserted equal) |
| C3 v666 saint "Add daily" card | the same three assertions pass in dark AND light (`daily:saint-of-the-day` — the shared class proven on its second builder) |
| C4 gold signal | fill `rgb(246, 236, 211)` + border `rgb(168, 134, 58)` in both modes; the card stands at the head of its node |
| C5 dress ownership | the served `/styles.css` carries the amended rule with `color:#2a2620` and the two scoped `.sub` / `.meta` rules at `#6d6353`; no `[data-mode="dark"]`-scoped `p666daily` rule stands |

**Fail-on-old.** The harness run against the pre-fix `ui.ts` (the `c37fb40` tree's file, the fix only reverted, then restored): **19 ok / 7 bad** — C1 fails at exactly the Plan's computed values: title **1.08:1**, sub-line **2.02:1**, tag **2.02:1** (computed colors `rgb(245, 245, 245)` / `rgb(168, 168, 168)` — the borrowed dark-mode tokens). C3 dark fails identically; the light legs pass on the old tree, as §2.2 predicted. The fix was restored and the harness re-run on the fixed tree: **26 ok / 0 bad**, the screenshots regenerated from the fixed tree (byte-identical to the committed shots).

**Screenshots** (`docs/releases/v693-screenshots/`, 390×844, the Add sheet on the CatholicTV node with the gold card at its head; read firsthand by the Implement seat before this record was written): `01-add-sheet-dark.png` — dark mode: the gold card's title "Catholic TV Mass · Daily" in dark ink on the pale gold fill, plainly readable; the sub-line "The day's Mass, standing new every day" readable in the muted tone; the "Daily" tag at the card's right readable — the field screenshot's defect stands corrected · `02-add-sheet-light.png` — light mode: the same card, same dress, title / sub-line / tag all plainly readable, the rendering unchanged from the standing light card.

**Regressions, judged against the Plan's base readings (§2.5):**

| Harness | Base (at `180d93d`, per Plan) | After v693 | Verdict |
|---|---|---|---|
| harness-v693 | — (new) | **26 ok / 0 bad** | green |
| harness-v688 | 65 ok / 0 not-ok | **65 ok / 0 not-ok** | identical |
| harness-v666 | load-crashes at `harness-v666.mjs:131`: `server validate shape moved` in `stripServerValidate` | identical crash, identical seat | pre-existing at base; NOT repaired, NOT counted as a v693 red |

**Not shipped by this seat** — the coordinator runs Review and Ship. The field leg stays John's, unclaimed.

## §4 Review record — PASS

**Reviewer:** review-v693 (light, independent). Nothing in §3 was taken on trust: the diff was re-read, both harnesses re-run fresh, both screenshots read firsthand, and the adversarial greps run against the whole repo. Base `180d93d7`, Implement final commit `7c023042` — HEAD matched at review start.

**1. Diff audit — PASS.** `git diff 180d93d7..HEAD --stat`: exactly five files — `app/worker/src/ui.ts`, `app/worker/harness-v693.mjs`, this doc, and the two screenshots. The full `ui.ts` diff is exactly the three prescribed §2.3 rules and nothing else: the `.profaddladder603 .p666daily` rule amended with `color:#2a2620` (fill `#f6ecd3`, `var(--gold)` border, shadow byte-identical), plus the two scoped rules `.p666daily .sub { color:#6d6353; }` and `.p666daily .meta { color:#6d6353; }` immediately after. No token, no `client.ts`, no other production change.

**2. Harness re-run (fresh) — `harness-v693.mjs`: 26 ok / 0 bad.** Computed readings from the real browser, identical in dark and light: card fill `rgb(246, 236, 211)`, border `rgb(168, 134, 58)`; title `rgb(42, 38, 32)`, sub-line `rgb(109, 99, 83)`, tag `rgb(109, 99, 83)`. Review's own WCAG math on those computed colors against the computed fill: title **12.79:1**, sub-line **5.02:1**, tag **5.02:1** — every element ≥ 4.5:1 in both modes, on both builders (C1/C2 Mass arm, C3 saint "Add daily" arm). C5 confirmed in the served CSS. The tree stayed clean after the re-run (regenerated screenshots byte-identical to the committed shots).

**3. Regression — `harness-v688.mjs` re-run fresh: 65 ok / 0 not-ok**, identical to the Plan's base tally. `harness-v666` not re-run: its load crash is pre-existing at base and out of scope per §2.4/§2.5.

**4. Screenshots — read firsthand, PASS.** `01-add-sheet-dark.png`: the gold card stands at the head of the CatholicTV node on the dark sheet; title "Catholic TV Mass · Daily" in dark ink on the pale gold fill, sub-line "The day's Mass, standing new every day", and the "Daily" tag at the card's right are all plainly readable — the field defect stands corrected; the card still reads gold; the fixed episode rows below stand in their standing dark dress, unchanged. `02-add-sheet-light.png`: the same card, same dress, all three elements plainly readable; fixed rows unchanged.

**5. Adversarial — Plan's seat map stands.** Whole-repo grep for `p666daily`: paint seats are exactly the two `client.ts` builders Plan named (`client.ts:26627` daily arm · `client.ts:26638` Mass arm, both in the Add ladder's `rowHtml`; the `client.ts:26631` hit is a comment) plus the definition in `ui.ts`; every other hit is a harness reader or a release doc. No `[data-mode="dark"]`-scoped `p666daily` rule stands anywhere in the source, and harness C5 confirms none stands in the served CSS. No missed seat found.

**Verdict: PASS.** The class owns its text/fill pairing in both modes at full contrast, the gold signal and every out-of-scope surface stand untouched, and the regression tally is identical to base. Ready for Ship. The field leg stays John's, unclaimed by this seat.
