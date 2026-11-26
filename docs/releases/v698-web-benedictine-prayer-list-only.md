# v698 — Web Benedictine: prayer list only

- **Status:** PLAN (§§1–2) — run level **To Ship** (John, voice call 2026-11-26 ~12:05 CT: "I approve everything to production.")
- **Base:** main `1f3fc7c` (the v697 ship)
- **Scope of this phase:** Plan only. No app code in Plan.

## §1 Scope

### 1.1 Direction (John, 2026-11-26, verbatim)

> "On the webpage get rid of that long bar for the Benedictine Way and just leave it alone."

> "Yeah, just show the prayer list for web users. Don't have to put the big long introduction."

### 1.2 Settled reading (not re-litigated)

- The v692 release (shipped, pin `ora-pro-nobis-v692-1`) built a WEB-ONLY detailed display of the Benedictine Way: on the webpage, a card standing under the plan row carries the Way's name, its honor line, a descriptive paragraph, and then its full prayer shape in detail (v692 doc §3.1, item W). Other surfaces show summary cards.
- John has seen that display on the webpage and reverses the display choice: the long bar / big long introduction comes OFF the webpage. Web users see JUST THE PRAYER LIST — the Benedictine's blocks and their contents as a plain list, with no long introduction standing over it.
- LEAVE THE REST ALONE:
  - The starter pick itself (startup · Add · Reset seats, `opnOpenStarterPick692` / `opnStarterCardHtml692`) stands exactly as shipped.
  - The other two Ways (The Little Way · The Salesian Way) stand exactly as shipped, at every seat.
  - The native surfaces (device mode · server mode) stand exactly as shipped.
  - Every other v692 behavior stands exactly as shipped — migration, toggle, phantom-edits fix, provenance, the device-mode starter offer, all of it.
- This release touches ONE function (§1.3) and nothing else in the app.

### 1.3 The exact current seat (grounded in this tree, base `1f3fc7c`)

All citations `app/worker/src/client.ts` unless named.

- **The display function:** `opnWebBenedictineHtml692`, **client.ts:25697–25725**. (The v692 doc §3.1 cites client.ts:25279 — that was the v692 tree; the function stands at 25697 in THIS tree. Implement re-diffs at this line.)
- **Its caller — the only caller:** `paintListenHome`, **client.ts:28153**, emission at **client.ts:28208**:

```js
var html = profPlanRowHtml(day)
  + (opnMode() === 'web' ? opnWebBenedictineHtml692() : '')
  + opnBannerHtml604() + opnEditBarHtml604()
  + …
```

  The card therefore stands on the Praylist home, directly under the plan row — the web surface where v692 seated it, because the plan row is the home's profile seat. No other caller exists (searched: the function's name occurs only at its definition and at client.ts:28208).
- **The mode gate — doubled, both halves stand unchanged:**
  1. The caller ternary above: `opnMode() === 'web'` at client.ts:28208.
  2. The function's own first line, client.ts:25707: `if (opnMode() !== 'web') return '';`
  - `opnMode()` itself, **client.ts:1450–1453**: a non-public shape reads `'server'`; a public shape reads `'device'` when in the app shell or an installed PWA (`oraInShell() || opnInstalledPwa()`), else `'web'` — the plain browser tab. That is the web-surface test the display keys on, and the test this change keys on: the edit lands inside the already-web-gated function, so it can only ever paint on the webpage (§2.3).
- **The shape source (unchanged by this release):** `opnStarterRecord692('benedictine', opnDoc().sections)` (client.ts:25708; the builder at client.ts:3015 — the `benedictine` seed record from `OPN_SEED_PROFILES`, client.ts:2774, with `opnMigrateProfileRecord609` applied: the effective post-mig609 shape). Each block's contents read through `opnStandingContents597` (client.ts:3428 — the record's own contents where they stand, else the block's standing list; Morning carries the readings seat). Item labels via `opnItemLabel604` (client.ts:24660). Read-only: no buttons, no pick, nothing stored — that posture stands.

### 1.4 The FULL markup the function emits today — introduction vs list

The function builds one string. Verbatim, client.ts:25710–25724, split at the boundary this release acts on:

**The introduction / bar portion (the head of the card — client.ts:25710–25712):**

```js
var html = '<div class="card p692webben" data-p692webben="1"><h3>The Benedictine Way</h3>'
  + '<p class="sub">' + esc(rec.honorLine || '') + '</p>'
  + '<p class="sub">A complete day of prayer, shown in full. Profiles themselves live in the app — nothing here is stored, and no pick is offered.</p>';
```

Rendered, the head carries exactly three elements over the list:

1. `<h3>The Benedictine Way</h3>` — the Way's name, one short line.
2. `<p class="sub">named in honor of the tradition, not the order's own routine</p>` — the honor line (`rec.honorLine`, the seed's verbatim value, client.ts:2774).
3. `<p class="sub">A complete day of prayer, shown in full. Profiles themselves live in the app — nothing here is stored, and no pick is offered.</p>` — the descriptive paragraph.

**The prayer-list portion (client.ts:25713–25724):**

```js
(rec.coreBlocks || []).forEach(function (b) {
  var items = opnStandingContents597(rec, b);
  html += '<h4>' + esc(b) + '</h4><ul class="p692weblist">'
    + items.map(function (it) { return '<li>' + esc(opnItemLabel604(b, it)) + '</li>'; }).join('') + '</ul>';
});
if (rec.layers && rec.layers.novenas && rec.layers.novenas.on) {
  var nov = opnStandingContents597(rec, 'Novenas');
  html += '<h4>Novenas</h4><ul class="p692weblist">'
    + nov.map(function (it) { return '<li>' + esc(opnItemLabel604('Novenas', it)) + '</li>'; }).join('') + '</ul>';
}
return html + '</div>';
```

Rendered: for each of the Benedictine's six core blocks in seed order — **Morning · Midmorning · Midday · Afternoon · Evening · Night** — an `<h4>` block name and a `<ul class="p692weblist">` of `<li>` content rows (labels via `opnItemLabel604` over `opnStandingContents597`; the Morning list carries the readings seat); then, because the Benedictine's Novenas layer stands on, an `<h4>Novenas</h4>` and its contents list; then the card's closing `</div>`.

**No other Benedictine introduction stands on the web surface.** The device-mode starter offer (`opnStarterOfferHtml692`) never stands on web — its gate is `opnMode() === 'device'` (`opnStarterOfferStands692`, client.ts:25678-area) — and the starter pick sheet is never offered on web (v692 W: no pick offered, nothing stored). The card at client.ts:25697 is the only long introductory Benedictine display a web user sees; it is the seat John's words name.

### 1.5 The boundary — fate of every element

The boundary is the split in §1.4: everything the function emits BEFORE the first block's `<h4>` is the introduction/bar; everything from the first `<h4>` on is the prayer list. Fates, decided from John's words ("just show the prayer list" · "don't have to put the big long introduction" · "just leave it alone" for the rest):

| # | Element | Fate | Ground |
|---|---------|------|--------|
| 1 | The descriptive paragraph — "A complete day of prayer, shown in full. Profiles themselves live in the app — nothing here is stored, and no pick is offered." | **REMOVED** | The "big long introduction" in its clearest form: descriptive copy standing over the list, naming no prayer. Unambiguous. |
| 2 | The honor-line paragraph — "named in honor of the tradition, not the order's own routine" | **REMOVED from this web display** | It is part of the introduction: it stands in the card's head, between the name and the list, and describes the Way rather than listing a prayer. Named explicitly so no seat guesses: the removal is THIS READ ONLY. The honor line itself stands untouched everywhere it belongs — the seed record (`OPN_SEED_PROFILES`, client.ts:2774), every starter card (`opnStarterCardHtml692`, client.ts:25598 — name · blocks · time · guidance · honor line · "Becomes your own profile"), the starter offer, and the starter pick. The honor-naming discipline governs the starters; this web display is not a starter pick (v692 W: no pick is offered there), so no honor obligation rides on it. |
| 3 | The Way's name — `<h3>The Benedictine Way</h3>` | **STANDS — OPEN-1, recommendation below** | Genuinely ambiguous: the name is one short line, not long copy, and a prayer list standing under the plan row needs its title to read as a list OF something; but a strict reading of "just the prayer list" could take the whole head. Recommendation (§2.2): KEEP the `<h3>` as the list's title line. Implement follows the recommendation unless John rules otherwise before Implement. |
| 4 | The card wrapper — `<div class="card p692webben" data-p692webben="1">` … `</div>` | **STANDS** | It is the list's container and dress, not copy: the `card` class gives the list its standing surface on the home, and `data-p692webben="1"` is the harness marker (§2.5 — keeping it is why only one v692 leg needs re-pointing). |
| 5 | Each block name — `<h4>Morning</h4>` … `<h4>Night</h4>` (six, seed order) | **STANDS, complete** | Block names are the prayer list's own structure — the list is unreadable without them. |
| 6 | Each contents list — `<ul class="p692weblist"><li>…</li></ul>` per block, labels via `opnItemLabel604` over `opnStandingContents597`, Morning's readings seat included | **STANDS, complete and unchanged** | This IS the prayer list John asked to show. Same source, same read, same order, same labels — byte-identical list markup. |
| 7 | The Novenas block — `<h4>Novenas</h4>` + its list, painted when `rec.layers.novenas.on` | **STANDS, complete and unchanged** | Part of the Benedictine's prayer shape and of its list; the layer test and the contents read stand as shipped. |
| 8 | Read-only posture — no buttons, no pick, nothing stored | **STANDS** | "Leave it alone": the removal adds no act and no storage. |

**What the web surface shows after the change, precisely:** under the plan row on the Praylist home, the same card in the same seat, carrying the one-line title "The Benedictine Way" (OPEN-1 recommendation), then the complete prayer list and nothing else — six block names each with its full contents rows, then Novenas with its rows. No honor line, no descriptive paragraph, no other introductory copy standing over the list. The rest of the home (plan row, banner, edit bar, the day's own block rows, the Favorites slot, the offline line) is untouched — `paintListenHome` is not edited at all (§2.4).

## §2 Plan

### 2.1 The change in one line

Inside `opnWebBenedictineHtml692` only: delete the introduction's two `<p class="sub">` lines (fates #1 and #2, §1.5); keep the title (fate #3), the wrapper, and the entire list emission byte-identical.

### 2.2 OPEN-1 — the Way's name in the title line

- **Question:** does `<h3>The Benedictine Way</h3>` count as part of "that long bar", or is it the prayer list's title?
- **Recommendation: KEEP it.** It is a single short line — the opposite of a "big long introduction"; the list under the plan row otherwise stands anonymous on a home that also carries the day's own blocks, and a reader could not tell whose prayer list it is; and "just leave it alone" covers the rest of the display standing as shipped. The deletion this recommendation prescribes is exactly the two copy paragraphs.
- Implement follows the recommendation unless John rules otherwise before Implement; if he rules the name out too, the fix is the same seat (the `<h3>` rides the same opening literal) and §3 records the ruling. The harness (§2.5) asserts the name's presence per the recommendation — a contrary ruling re-points that one assertion, named in §3.

### 2.3 The web-only guarantee

- The edit sits inside a function that is reached only when `opnMode() === 'web'` — twice over (the caller ternary at client.ts:28208 and the function's own gate at client.ts:25707). No gate is added, moved, or widened.
- In device and server modes the caller ternary yields `''` and the function is never invoked with effect; `paintListenHome`'s emitted string in those modes is therefore byte-identical before and after this release, by construction — no native paint path is edited, reordered, or re-dressed.
- The native starter pick keeps the summary cards exactly as shipped: `opnStarterCardHtml692` (client.ts:25598) and `opnOpenStarterPick692` are not touched, and the device-mode starter offer (`opnStarterOfferHtml692`) is not touched. The harness proves both (§2.5, legs N1–N2).

### 2.4 Implement prescription — the minimal edit

**One app file: `app/worker/src/client.ts`. One function. Two lines deleted.**

1. **Seat:** `opnWebBenedictineHtml692` (client.ts:25697 at base; re-diff at Implement — the function must still carry its own `opnMode() !== 'web'` return and the `opnStarterRecord692('benedictine', …)` source; if either has moved, stop and re-ground rather than editing a look-alike).
2. **Delete** these two concatenations from the opening literal (client.ts:25711–25712 at base):

```js
  + '<p class="sub">' + esc(rec.honorLine || '') + '</p>'
  + '<p class="sub">A complete day of prayer, shown in full. Profiles themselves live in the app — nothing here is stored, and no pick is offered.</p>';
```

   The opening literal becomes:

```js
  var html = '<div class="card p692webben" data-p692webben="1"><h3>The Benedictine Way</h3>';
```

3. **Keep byte-identical:** the mode gate, the `opnStarterRecord692` read and its null return, the block loop, the Novenas arm, the closing `return html + '</div>';`, the wrapper, and the `<h3>` (OPEN-1 recommendation).
4. **Update the function's head comment** in the same edit: the v692 W comment's "Read-only display; the honor line stands." no longer holds. The replacement comment names v698 and John's words (web users see just the prayer list; the introduction — honor line + descriptive paragraph — is removed at his direction, 2026-11-26) and keeps the standing facts (web only · full shape in detail · read-only · native picks keep the summary cards). No other comment moves.
5. **The function is REDUCED, not removed.** It still builds and returns the list; its name, signature, and caller stand. Do NOT inline the list into `paintListenHome`, do NOT rename the function or its classes, and do NOT touch `paintListenHome` (client.ts:28153 / 28208) at all.
6. **No other app seat is edited:** not `index.ts` (no server leg — the display is client paint over the on-device document's seed), not `OPN_SEED_PROFILES`, not `opnStarterRecord692`, not `opnStandingContents597`, not `opnItemLabel604`, not any starter seat. The service-worker pin bump in `ui.ts` is the standing Ship-phase act, not an Implement edit.

**Dead-code call — there is none to remove:**

- **CSS classes:** `p692webben` and `p692weblist` both REMAIN in use (the wrapper and every list) and neither carries a dedicated CSS rule anywhere in the tree (searched `app/worker/src/` — no rule names either class; the card's dress rides the generic `card` class, which stands). Nothing becomes dead; no CSS is deleted or added.
- **Helpers:** `esc`, `opnStarterRecord692`, `opnStandingContents597`, and `opnItemLabel604` all remain used by the reduced function itself (and elsewhere). The only read that disappears is `rec.honorLine` AT THIS SEAT; the field and its other readers (the starter cards, the payloads, the reset/mint routes) stand untouched — no helper, field, or constant becomes dead.
- The two deleted lines are the whole delta. Any Implement diff larger than the function + its comment, the new harness, the one re-pointed harness leg (§2.5), and this doc's §3 is out of prescription and Review returns it.

### 2.5 Harness spec — `app/worker/harness-v698.mjs` (for Implement)

**Fixtures from production shapes (the standing fixture rule):** the harness-v692 WEB leg's own world is the model and is reused, not reinvented — its `SEED` source-settings fixture (the production seed shape that feeds `opnStandingContents597`'s standing lists), its `__mkDay692` day payload, and its plain-tab page (no shell, no installed PWA → `opnMode() === 'web'`). No hand-built Benedictine record: the shape under test is `opnStarterRecord692('benedictine', …)` over the real seed + the real mig609 transform, exactly as production paints it. For the native legs, harness-v692's device world is the model the same way.

**Legs — harness-v698 (new):**

- **W1 — the list stands complete on web:** in the plain-tab page, `opnWebBenedictineHtml692()` returns a string carrying the wrapper marker `data-p692webben="1"`; an `<h4>` for every Benedictine block (Morning · Midmorning · Midday · Afternoon · Evening · Night); at least 6 `<li>` rows; the Morning list carrying the readings seat (the standing `readings` label test, as in harness-v692's W leg); and the `<h4>Novenas</h4>` block with its list.
- **W2 — no introduction stands over the list:** the same returned string does NOT contain the descriptive sentence "A complete day of prayer, shown in full", does NOT contain the honor-line text "named in honor of the tradition", and contains NO `<p class="sub">` at all; the first `<h4>` follows the title directly (the string between `</h3>` and the first `<h4>` is empty). Per OPEN-1's recommendation the string DOES contain `<h3>The Benedictine Way</h3>` — that assertion is the OPEN-1 re-point if John rules the name out.
- **W3 — the painted web home:** through the real paint path (`paintPrayersView` → `paintListenHome`, harness-v692's W-leg method), the painted home carries `data-p692webben="1"` and the block names, and carries NEITHER introduction text NOR `data-p692offer`; nothing is stored (`localStorage.getItem('opn-personal-data-v1')` stays null); no pick is offered (no `data-p692pick`, no `data-p692starter`).
- **O1 — the other Ways unchanged:** `opnStarterCardHtml692` output for all three seeds (little-way · salesian · benedictine) is byte-identical to the base tree's — every card still carries its name, blocks line, time fact, guidance line, honor line, and "Becomes your own profile — change anything afterwards". (The web surface paints no other Way at all — Benedictine is its only Way display — so the cards are the other Ways' standing display shape, and they must not move.)
- **N1 — off-web, the function is silent:** in device mode and in server mode, `opnWebBenedictineHtml692()` returns `''` (its own gate), and a device-mode `paintListenHome` paint contains no `p692webben` and no Benedictine list.
- **N2 — the native starter pick is byte-identical:** the device-mode starter offer (`opnStarterOfferHtml692`) and the starter pick sheet (`opnOpenStarterPick692`'s painted cards) render byte-identical to the base tree's — names, honor lines, guidance, and the Salesian "Start here" marker all standing. Byte-identity is proven against the pre-change tree (the standing method: run the same extraction on the base tree — `ORA_WT`-style, as harness-v692's leg 8 proved byte-identity against `7e85dea` — and diff; any diff fails the leg).

**Regression — harness-v692 at its standing tally, with ONLY the superseded legs re-pointed:**

- Standing tally at the v692 ship: **72 ok / 0 bad**. After this release it must still read **72 ok / 0 bad**, with exactly ONE leg re-pointed, named here:
  - **The W leg at harness-v692.mjs:748** — "W the web paint path carries the FULL Benedictine shape — every block stands with its contents" — today asserts `html.includes('The Benedictine Way') && html.includes('named in honor of the tradition')`. The honor-line assertion is the one assertion this change supersedes (fate #2): re-point the leg to drop `&& html.includes('named in honor of the tradition')` and assert its ABSENCE instead (`&& !html.includes('named in honor of the tradition')`), keeping every other assertion in the leg (all six block `<h4>`s, ≥6 `<li>`, the Way's name) word-identical. Mark the re-point in-code with a v698 comment, on the harness-v688 M2 re-point precedent (v692 doc §3.4).
  - **Every other v692 leg stands unmodified**, including the remaining W legs: web mode stands in a plain tab (:745-area) · the Morning readings seat (the leg after :748) · no pick offered and the starter offer does not stand · nothing stored on web · and "W the painted web home stands the Benedictine card and no starter offer" (:759 — it asserts the `data-p692webben="1"` marker, which fate #4 keeps, so it passes unmodified; that is by design, not by oversight).
- Standing regression suite, at the tallies recorded at the v692 ship (§5 of the v692 doc, on the merged tree): harness-v687 **42/0** · harness-v688 **65/0** · harness-v690 **33/0** · harness-v691 **41/0**. harness-v693's stale-pin leg (**25/1**, pre-existing, identical on the base tree) is not a regression bar for this release.

**Fail-on-old evidence Implement must produce (named, recorded in §3):**

- harness-v698 run against the PRE-CHANGE tree (base `1f3fc7c` client, or the branch with the §2.4 edit reverted in a scratch worktree — the branch worktree's committed state is never disturbed): legs **W2 and W3 MUST FAIL** (the old paint carries both introduction texts) while **W1, O1, N1, N2 pass** — proving the new legs discriminate exactly the introduction and nothing else. §3 records both tallies (on-old and on-new).
- The re-pointed harness-v692 also discriminates: on the old tree the honor line STANDS, so the re-pointed leg's absence assertion fails there while its list assertions pass on both trees. §3 records the re-pointed v692 harness on-old tally too: expected **71 ok / 1 bad**, the 1 bad being exactly the re-pointed W leg.

### 2.6 Risks

- **R1 — OPEN-1 misread (the name).** If John meant the whole head including the name, a kept `<h3>` leaves one line he asked off. Mitigation: the point is named OPEN with a recommendation (§2.2), the fix is one literal in the same seat, and the field leg is John's look at the webpage. No other element's fate is ambiguous — the two copy paragraphs are the introduction under any reading of "big long introduction".
- **R2 — honor-line scope creep.** Removing the honor line HERE could be misread as dropping the honor discipline. It is not: §1.5 fate #2 scopes the removal to this one read; the seed, the starter cards, the offer, and the pick keep the line verbatim, and harness legs O1/N2 fail if any of them moves.
- **R3 — over-deletion.** Deleting the whole function, the Novenas arm, or the contents read would take the prayer list with the introduction — the exact opposite of the direction. Mitigation: §2.4 prescribes the two lines by quotation; W1 fails on any list loss; the diff-size guard (§2.4, last bullet) makes Review return anything larger.
- **R4 — mode leakage.** An edit outside the gated function (e.g. in `paintListenHome`) could move native paint. Mitigation: `paintListenHome` is not edited at all; N1/N2 prove off-web silence and native byte-identity.
- **R5 — stale line numbers.** Citations are this tree's (base `1f3fc7c`); intervening ships could shift them before Implement. Mitigation: §2.4 step 1 requires re-diffing the seat by its gate + shape-source fingerprints, not by line number alone.
- **R6 — the "long bar" names a different seat.** Grounded against: the card at client.ts:25697 is the ONLY Benedictine display on the web home (§1.4, last paragraph — the offer is device-gated, the pick is never offered on web), and it is the only element on that surface matching "long … big long introduction" standing over a prayer list. If John's field look after ship still shows a bar, it is a different element and a new direction — not a license for Implement to hunt beyond this seat.

### 2.7 Ordered Implement seat list

Single Implement seat, in order:

1. **Edit** `opnWebBenedictineHtml692` in `app/worker/src/client.ts` per §2.4 (re-diff the seat first per §2.4 step 1; delete the two lines; update the head comment; nothing else in the file).
2. **Write** `app/worker/harness-v698.mjs` per §2.5 (fixtures reused from harness-v692's WEB/device worlds) and run it green on the new tree.
3. **Re-point** the one named leg in `app/worker/harness-v692.mjs` (:748 W leg) per §2.5, in-code v698 comment; run harness-v692 to **72/0**.
4. **Produce the fail-on-old evidence** per §2.5 (harness-v698 on-old: W2/W3 bad, the rest green; re-pointed harness-v692 on-old: 71/1, the 1 bad the re-pointed W leg) in a scratch worktree; record both tallies.
5. **Run the standing regressions** (§2.5): v687 42/0 · v688 65/0 · v690 33/0 · v691 41/0.
6. **Write §3** of this doc (seats changed with built-tree citations · the OPEN-1 disposition as built · both fail-on-old tallies · all harness tallies) and commit. The pin bump, merge, and deploy are the Ship phase's acts under the To Ship run level — not Implement's.

### 2.8 Open points index

- OPEN-1 (§1.5 fate #3, §2.2): the `<h3>The Benedictine Way</h3>` title line — default: KEEP as the list's title; only the two copy paragraphs are removed.

## §3 Implement (chain-v698-impl)

### 3.1 Build summary

- **Seat changed:** `opnWebBenedictineHtml692` only, `app/worker/src/client.ts:25697` on the built tree (same line as base — the edit is inside the function).
- **Edit per Plan §2.4, exactly:** the two `<p class="sub">` concatenations are deleted from the opening literal — (a) the honor-line paragraph (`esc(rec.honorLine || '')`) and (b) the descriptive paragraph ("A complete day of prayer, shown in full. …"). The opening literal is now the single line `var html = '<div class="card p692webben" data-p692webben="1"><h3>The Benedictine Way</h3>';`.
- **Head comment updated** in the same edit: the v692 W comment's "the honor line stands" claim is removed; the replacement names v698 and John's direction (2026-11-26 — web users see just the prayer list; the introduction, honor line + descriptive paragraph, is removed) and keeps the standing facts (web only · full shape in detail · read-only · native picks keep the summary cards).
- **Kept byte-identical:** the mode gate, the `opnStarterRecord692('benedictine', …)` read and null return, the block loop, the Novenas arm, the closing return, the card wrapper, and the `<h3>` title. The function is reduced, not removed; name, signature, and the `paintListenHome` caller are untouched. No edit to `index.ts`, the seed, `opnStarterRecord692`, `opnStandingContents597`, `opnItemLabel604`, or any starter seat. Dead code: none (per Plan §2.4).
- **OPEN-1 disposition as built:** KEPT — `<h3>The Benedictine Way</h3>` stands as the list's title line (Plan recommendation; no contrary ruling from John before Implement).
- **Files in the Implement diff:** `app/worker/src/client.ts` (the function + its comment: 12 lines removed, 13 added by `git diff` count incl. comment rewrap; the code delta is exactly the two deleted lines), `app/worker/harness-v698.mjs` (new), `app/worker/harness-v692.mjs` (the one re-point, §3.3), and this doc's §3.

### 3.2 harness-v698 (new) — tallies

- **On the new tree: 20 ok / 0 bad.** Per leg: W1 pass (wrapper marker, six block `<h4>`s, ≥6 `<li>`, Morning readings seat, Novenas arm) · W2 pass (descriptive sentence absent, honor-line text absent, no `<p class="sub">` in the card, first `<h4>` directly after `</h3>`, Way name present per OPEN-1) · W3 pass (painted web home: list stands, no introduction, no starter offer, nothing stored, no pick) · O1 pass (all three starter cards byte-identical vs base `1f3fc7c`, compared in-harness via `V698_BASE_WT` dual-bundle build) · N1 pass (function returns `''` in device and server modes; no web card in device paint) · N2 pass (device starter offer + pick sheet byte-identical vs base, same dual-bundle comparison).
- **Fail-on-old (scratch worktree `~/workspace/.worktrees/v698-base` at base `1f3fc7c`, harness run with `ORA_WT` + `V698_BASE_WT` pointed at it): 17 ok / 3 bad — legs W2 and W3 FAIL, legs W1, O1, N1, N2 pass.** The 3 bad checks are exactly the introduction assertions (W2 ×2, W3 ×1). The legs discriminate the introduction and nothing else, as Plan §2.5 required.

### 3.3 harness-v692 — the one re-point

- **Re-point named:** the W leg at `app/worker/harness-v692.mjs:748` ("W the web paint path carries the FULL Benedictine shape — every block stands with its contents") drops its `html.includes('named in honor of the tradition')` assertion and asserts its ABSENCE instead (`&& !html.includes('named in honor of the tradition')`), marked in-code with a v698 comment. Every other assertion in the leg and every other leg in the harness is word-identical.
- **On the new tree: 72 ok / 0 bad** (standing tally held).
- **Fail-on-old (same scratch base worktree, re-pointed harness run against it): 71 ok / 1 bad** — the 1 bad is exactly the re-pointed W leg, as Plan §2.5 predicted.

### 3.4 Standing regressions

- harness-v687: **42 ok / 0 bad** · harness-v688: **65 ok / 0 bad** · harness-v690: **33 ok / 0 bad** · harness-v691: **41 ok / 0 bad** — all at their standing tallies.

### 3.5 Deviations

- None. The diff is the prescription: the two lines + the head comment, the new harness, the one re-pointed leg, and this §3.

## §4 Review (chain-v698-review — light Review)

- **Verdict: PASS.** No defect found. The Implement diff is exactly the Plan §2.4 prescription and every harness claim in §3 reproduced under independent re-run.

### 4.1 Diff inspection (Review, independent)

- `git diff 0420f3a..4bfe91c` and the full branch diff vs base `1f3fc7c` read directly. App-tree files: `app/worker/src/client.ts`, `app/worker/harness-v698.mjs` (new), `app/worker/harness-v692.mjs` (one re-point), and this doc. No other app file moved.
- client.ts delta is exactly: inside `opnWebBenedictineHtml692` (built tree client.ts:25697) the two `<p class="sub">` concatenations deleted (honor-line paragraph + descriptive paragraph) and the head comment updated per §2.4 step 4. The opening literal is the single line carrying the wrapper `<div class="card p692webben" data-p692webben="1">` + `<h3>The Benedictine Way</h3>`.
- Byte-identical, confirmed in the diff and in the built function body: the mode gate (`if (opnMode() !== 'web') return '';`), the `opnStarterRecord692('benedictine', …)` read and null return, the block loop (all `<h4>` / `<ul class="p692weblist">` rows), the Novenas arm, and the closing return. `paintListenHome`'s caller ternary stands at client.ts:28209 untouched; `index.ts`, the seed, and every starter seat are absent from the diff.

### 4.2 Harness tallies (Review, measured by re-run)

- **harness-v698 on the new tree: 20 ok / 0 bad** — legs W1 · W2 · W3 · O1 · N1 · N2 all pass.
- **harness-v692 on the new tree: 72 ok / 0 bad** — standing tally held.
- **Fail-on-old spot-check (Review's own scratch worktree at base `1f3fc7c`, created, run, removed): harness-v698 = 17 ok / 3 bad** — exactly legs W2 (×2) and W3 (×1) fail on the introduction assertions; W1, O1, N1, N2 pass. Matches §3.2 and Plan §2.5 exactly; the legs discriminate the introduction and nothing else.

### 4.3 harness-v692 re-point inspection

- `git diff 1f3fc7c..4bfe91c -- app/worker/harness-v692.mjs` shows ONE changed leg (harness-v692.mjs:748): the comment line added naming the v698 re-point, and the single assertion flipped from `html.includes('named in honor of the tradition')` to `!html.includes('named in honor of the tradition')`. Every other assertion in the leg (six block `<h4>`s, ≥6 `<li>`, the Way's name) and every other leg in the harness is word-identical. No weakened or extra-changed leg.

### 4.4 Scope grep — the honor line stands everywhere it belongs

- The removal is scoped to the one web display read: the built `opnWebBenedictineHtml692` no longer reads `rec.honorLine`. The honor line still stands verbatim in the seed (`OPN_SEED_PROFILES`, client.ts:2774, all three Ways), in the server seed (index.ts:1608–1610), and in the starter card read (`esc(seed.honorLine || '')`, client.ts:25604) — the offer and the pick render through those cards, and harness legs O1/N2 pass with the honor lines standing.

### 4.5 OPEN-1

- Built state matches the Plan recommendation: `<h3>The Benedictine Way</h3>` stands as the list's one-line title (asserted by harness-v698 leg W2), and §1.5/§2.2 name the call. John has not ruled otherwise. Not a return ground, per the phase brief.

### 4.6 Notes

- Note (not a defect): in a plain run without `V698_BASE_WT`, harness-v698 legs O1/N2 prove byte-identity structurally and print BYTE lines for external diff; the dual-bundle byte comparison runs when `V698_BASE_WT` is set (as in §3's runs and in Review's fail-on-old run, where O1/N2 passed against the base tree). The starter-card and offer/pick outputs carry the honor lines and all standing facts, and the client.ts diff shows no starter seat touched — the byte-identity claim stands on the diff plus these legs.
- Standing regressions (v687/v688/v690/v691) were not re-run by Review; §3.4 records them at standing tallies and the diff touches no seat they exercise beyond the one function, whose behavior they do not assert.
