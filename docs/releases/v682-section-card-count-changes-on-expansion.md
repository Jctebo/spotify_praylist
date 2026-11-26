# v682 — Section card count changes on expansion

## §1 Scope

**Field defect (John, 2026-11-26 00:40 CT, screen recording):** the Morning section card's unplayed count reads **4** while the card stands closed and changes to **5** after he expands it. One card, one block, two counts — the closed paint and the expanded paint disagree, and the closed paint is the stale one.

The recording's Morning rows (6): Invitatory · Morning Offering (Extended) · Morning Prayer — Divine Office · Daily Mass Reading Podcast for November 26, 2026 · Daily Rosary — Luminous Mysteries · Marian Antiphon — Angelus. Expanded count 5 unplayed ⇒ exactly one row stands played in the expanded paint. The closed paint counts 4 unplayed.

Run level: defect fix-forward on the streamlined path — this doc's §1+§2 are the combined Scope+Plan pass. Base: current main, tip `39f224f` (v680 ship record, pin `ora-pro-nobis-v680-1`), branch `release/v682`, worktree `~/workspace/.worktrees/v682` off the one standing clone.

**Base verification (the claim that v680/v681 did not touch this surface):**

- v680 (`43eb549..39f224f`): client.ts changes are the resume-position seats only (position ticks, the day-position drain); the diff's single `refreshPlayedChrome` line is an unchanged context line beside the drain call. ui.ts carries only the pin bump. No count seat, no section-head paint, no ext settle seat, no Favorites count is touched. **Verified.**
- v681: **no v681 commit, release doc, or harness stands on local main** (tip is the v680 ship; `origin/main` tips at the v679 ship). There is no v681 tree in this clone to verify against — named as an open discrepancy in §2.6; this Plan bases on the newest tree that exists, local main at `39f224f`, whose count surface is byte-identical to v679's (the last ship that touched it, via the v678/v679 count and refresh seats).

## §2 Plan

### §2.1 The two count seats — one computation, two moments

Both paints run the SAME computation over the SAME source. There is no second count formula to fix; the defect is a missing refresh between them.

- **The one computation:** `opnCounts615(tracks)` (client.ts:16664) over a track list, per-track predicate `opnTrackUnplayed615` (client.ts:16652): available tracks only (`if (!t || !t.available) return;` — an unavailable track enters neither total nor unplayed); a podcast reads its descriptor's `listened` flag, every other kind reads the played store through `isPlayedDesc` on the presented date. Block form: `opnBlockCounts615(block)` (client.ts:16684) = `opnCounts615` over `state.dayDescs` filtered by `(x.block || 'Episodes') === block`.
- **Closed-card paint seat:** `opnSetHtml609` — runs grouped from `state.dayDescs` (client.ts:26897–26901), head count `var c615 = opnCounts615(run.tracks)` (client.ts:26914), emitted as `<span class="meta" data-p615count="Morning">4</span>` in the card head (client.ts:26923–26929). A closed run emits its head ONLY (client.ts:26930: rows emit `if (open609)`) — **a closed card's rows stand nowhere in the DOM.**
- **Expanded paint seat:** the head tap wiring (client.ts:23691–23695) → `opnToggleBlock604` + `opnRepaintHome604()` (client.ts:24052) → `paintPrayersView` → `opnSetHtml609` again — the same `opnCounts615(run.tracks)`, but over `state.dayDescs` **as it stands at tap time**. Whatever settled into the list since the head paint enters the count at this moment, and only at this moment.
- **The in-place refresh seat (the v673/v678 discipline):** `refreshPlayedChrome()` (client.ts:16689) recomputes every standing `[data-p615count]` in place from live state — its Praylist arm (client.ts:16742–16747) re-reads `opnBlockCounts615` per head and rewrites the span + the disc's `all` class. Recomputed, never incremented. Marks land through it; **settles, as §2.2 proves, do not.**

### §2.2 Root cause — the differing row, the divergence step

**The differing row: Morning Prayer — Divine Office** (contents source `ext-morning-prayer`, Divine Office primary / Sing the Hours fallback — `OPN_SEED_SOURCES`, client.ts:2771; a LABELED slot, `opnLabeledSlot650`). It stands in BOTH descriptor lists, with the same identity (`episodeId: 'ext-morning-prayer'`). What differs is its **availability**, and availability is the count's gate:

- Its descriptor is built by `extSlotTrack(slot, st)` (client.ts:19122): `available: st.state === 'present'` (client.ts:19128). While the slot stands `loading` or `downloading`, the descriptor stands in `state.dayDescs` **unavailable** — present as a row-to-be, invisible to `opnCounts615`.
- Slot states seed at the resolution pass: cache-standing slots seed `downloading`, the rest `loading` (client.ts:22178, :22180) — never `present`. A labeled slot reaches `present` only after BOTH sides' audio bytes download (the settle path, client.ts:22386 ff), the slowest leg of the day build. The first head paint therefore counts Morning Prayer **out** on any ordinary open.

**The divergence step (exact):** when the slot settles, `settle(slot, st)` (client.ts:22240, in `resolveExternals`) runs, in order: `state.extSlots[slotId] = st` → `extRebuildDescs(day)` (the available descriptor now stands in `state.dayDescs`, client.ts:21428) → `extSwapCard(slot)` → `updateBlockCounts(day)` → `writeCache()`. **No step refreshes the section head count:**

1. `extSwapCard` (client.ts:19172) routes the labeled slot to `extSwapLabeled650` (client.ts:19135), which looks up the row's standing cards — `if (!olds.length) return;` (client.ts:19144). The Morning card stands CLOSED, its rows stand nowhere in the DOM (§2.1), so `olds` is empty and the swap returns — **before** its own closing `refreshPlayedChrome()` (client.ts:19169), which is unreachable exactly when the card is closed. (The unlabeled arm is blinder still: `if (!old || !st) return;` at client.ts:19176, and no refresh call on that path at all.)
2. `updateBlockCounts` (client.ts:21581) writes only `[data-bcount]` / `[data-bmeta]` — the retired block-page surfaces. It never touches `[data-p615count]`.
3. The intermediate `downloading` rebuilds (`settleMeta` client.ts:22378, `settleMetaLabeled650` client.ts:22390) change no availability and call the same swap; they are not the step.

So the descriptor list moves (4-counted → 5-counted) while the painted head keeps the paint-time number, and the **first** later act that recomputes the head is the expansion repaint itself. Closed 4, expanded 5 — the recording, exactly. The same seat serves every external slot in every block (Invitatory in this same block included): any ext row that settles while its card stands closed leaves that card's count stale by the same step.

**Candidate elimination, in the task's order:**

- **(a) A row settling after card paint — the readings seat (v660) / a daily settled row (v677 store): ELIMINATED as the stale-count cause.** Both settlers repaint the WHOLE view on settle: the readings seat's `.then` runs `extRebuildDescs(day)` then `paintPrayersView(state.dayPayload)` (client.ts:21024–21027, the v660 §3.2 seat), and the daily resolver's `settle` does the same (client.ts:20913). A whole-view repaint recomputes every head from the new list — a readings/daily settle cannot leave a closed count stale. (Their rows DO settle after paint; their paint discipline is why they are innocent. The ext seat is the one settler whose settle path swaps in place instead of repainting.)
- **(b) A composed copy whose listened flag the closed count reads stale (v673 discipline): ELIMINATED.** Podcast copies' `listened` flips route through the mark/completion sync and close with `refreshPlayedChrome()` — the in-place head recompute at client.ts:16742–16747 — so a flag flip updates a closed card's count in the same act, no expansion needed. And in the fixture trace (§2.3) no podcast row's flag differs between the two paints: the readings descriptor carries `listened: false` in both.
- **(c) A row present in one set only: CONFIRMED, in availability form.** The row identity is present in both lists; the COUNTED set differs — Morning Prayer is outside the closed paint's counted set (unavailable ⇒ excluded by `opnCounts615`'s available-only rule) and inside the expanded paint's counted set (settled `present` ⇒ available, unplayed). The surprise, named for the report: the divergence is not in the count seats and not in row presence — it is in one descriptor's `available` flag, plus a refresh call that stands unreachable behind a closed card.

### §2.3 Fixture (Improvement D — production shapes only)

Presented day **2026-11-26** (a Thursday), John's standing profile (The Salesian Way, his default), Morning contents in standing order. Each field mirrors its production source:

| # | Row (expanded paint) | Descriptor source (production shape) | State at first head paint | State at expansion |
|---|---|---|---|---|
| 1 | Invitatory | ext slot `ext-invitatory` via `extSlotTrack` (client.ts:19122); seed row client.ts:2771 | settled `present`, available, unplayed | same |
| 2 | Morning Offering (Extended) | own row `morning-prayer` via the own-slot seam; seed row client.ts:2771 | present, available, unplayed | same |
| 3 | **Morning Prayer — Divine Office** | **ext labeled slot `ext-morning-prayer` via `extSlotTrack` / `extPaintTracks650`** | **`downloading` ⇒ available: false ⇒ NOT counted** | **settled `present`, available, unplayed ⇒ counted** |
| 4 | Daily Mass Reading Podcast for November 26, 2026 | readings seat record via `resolveReadingsSeat590`'s title match (client.ts:21006–21015) → `readingsSeatDesc549` (client.ts:14591): kind `podcast`, `listened: false` | present, available, unplayed | same |
| 5 | Daily Rosary — Luminous Mysteries | own row `daily-rosary`; seed row client.ts:2771 (Thursday ⇒ Luminous) | present, available, unplayed | same |
| 6 | Marian Antiphon — Angelus | own row `marian-antiphon`; seed row client.ts:2771 | present, available, **played** (played store, presented date — `isPlayedDesc` true) | same |

**Mechanical trace through both computations:**

- Closed paint, `opnCounts615(Morning run)`: Invitatory U · Offering U · Morning Prayer **skipped (unavailable)** · Readings U · Rosary U · Angelus P → total 5, **unplayed 4** ✔ (the recording's closed count).
- Ext settle lands (no head refresh, §2.2): DOM still reads **4**; `state.dayDescs` now counts 5 unplayed.
- Expansion repaint, same function over the current list: total 6, **unplayed 5** ✔ (the recording's expanded count).

Settle order stipulated by the fixture, mirroring production timing: `ext-invitatory` (unlabeled, single download) stands `present` before the first head paint; the labeled `ext-morning-prayer` (two sides' bytes before `present`) settles after the head paint and before the tap. Either ext row settling in that window produces the defect through the identical seat; the fixture names the labeled one because its swap arm carries the unreachable refresh that proves the step.

### §2.4 Fix shape — one count, one live source, refreshed at the settle

No new computation, no new store, no visible change beyond the count standing correct while closed:

1. **The one change:** in `resolveExternals`' ext settle seat `settle(slot, st)` (client.ts:22240), after `extRebuildDescs(day)` + `extSwapCard(slot)`, call **`refreshPlayedChrome()`** (client.ts:16689) — the standing v673/v678 in-place refresh. It recomputes every `[data-p615count]` from `state.dayDescs` through `opnBlockCounts615` (client.ts:16742–16747): one count, from the one live source, for both paints, landing at the settle moment without expansion. Placement beside `updateBlockCounts(day)` (which stays, for its own surfaces). This covers labeled and unlabeled slots uniformly — including the unlabeled arm whose swap carries no refresh at all — and every block, not just Morning. The `downloading` intermediate rebuilds need no call: availability does not flip there; `present`/`missing` land only through `settle`.
2. **Nothing else moves:** `opnSetHtml609`'s paint, `opnCounts615`/`opnTrackUnplayed615`, the swap seats, and the accordion wiring all stand as shipped. `extSwapLabeled650`'s own trailing `refreshPlayedChrome()` (client.ts:19169) becomes redundant-but-harmless on the open-card path; it is NOT removed (no gratuitous change to a shipped seat).
3. **Pin:** `ora-pro-nobis-v682-1` in ui.ts CACHE at Implement (its one seat).

**v678 Favorites count — shared seat? NO for the computation, YES for the refresh pass (code evidence):** the Favorites folder count is `favUnplayedCount678(folderId)` (client.ts:14009), computed over the Favorites store / folder descriptors — a different source set from `opnBlockCounts615` over `state.dayDescs`; the two share only the per-track predicate `opnTrackUnplayed615`. They DO share the refresh pass: `refreshPlayedChrome` carries a dedicated Favorites arm (client.ts:16750–16758) beside the Praylist arm. Consequences for this Plan: the §2.4 call recomputes standing Favorites heads idempotently (recomputed from their own store, values unchanged — the v615 discipline), so the Plan covers Favorites as a regression surface (harness L4), not as a fix surface. No Favorites seat changes.

### §2.5 Harness legs — `app/worker/harness-v682.mjs`

Standing pattern: playwright-core + esbuild bundle of the real Worker, API stubbed in-page; the stub holds the ext payloads back and releases them on the leg's cue, so settle timing is deterministic. Fixture = §2.3 whole (stubbed day payload + settings rows + externals payloads in production shapes; Angelus pre-marked in the played store).

1. **L1 — closed == expanded, at paint, no expansion (MUST FAIL on the pre-fix tree).** First head paint lands with `ext-morning-prayer` held at `downloading`; release its settle; with the Morning card still closed and never tapped, read `[data-p615count="Morning"]` — assert **5**. Then tap the head open and assert the expanded head still reads **5** and the Morning Prayer row stands among 6 rows. Pre-fix: the closed read is 4 ⇒ FAIL (the leg's discriminating assertion); post-fix: PASS.
2. **L2 — a mark landing while the card stands closed updates the closed count at once.** With Morning closed and settled (count 5), land a played mark on the Daily Rosary through the standing mark seam (its row menu act driven from a surface where the row stands, or the queue/completion seam — the v673 route), without touching the Morning head: assert the closed count drops to **4** in the same act; unmark restores **5**. (Passes pre-fix — the v673 discipline already routes marks through `refreshPlayedChrome`; regression guard that the fix does not disturb it.)
3. **L3 — a late-settling row (readings/daily shape) joins the count without expansion.** Hold the `daily-readings` series fetch back at paint (Morning count computed without the seat's counted contribution per the fixture's held state), release it while the card stands closed: assert the closed count joins the seat's unplayed +1 with no expansion tap, and the row stands at its seat position (before the Rosary) on the later expansion. (Passes pre-fix — that settle repaints whole, §2.2(a); the leg guards the fix against breaking the repaint settlers and proves both settle disciplines now agree.)
4. **L4 — regressions.** (i) v659 accordion: opening Morning closes any other open card, opening another card closes Morning, tapping the open head closes it, the +/− toggle follows — exactly as harness-v659 recorded. (ii) v678 Favorites: folder heads' `[data-favcount678]` values and disc `all` classes stand byte-identical before and after an ext settle fires the new `refreshPlayedChrome()` call (idempotent recompute, §2.4), and a Favorites mark still updates its folder count at once.

### §2.6 Open items named

- **v681 discrepancy:** the tasking states v680/v681 ships stand on main; this clone's main tips at the v680 ship (`39f224f`) and no v681 artifact exists in it. If a v681 tree exists elsewhere and touched client.ts, this Plan's line citations must be re-based before Implement. The count surface itself is verified identical v679 → v680 (§1).
- No server change, no migration, no store change. The defect is one missing refresh call on one settle seat.

## §3 Implement

**Rebase (Plan §2.6 open item, resolved):** at Implement start, `origin/main` stood at `3d87110` — the v681 ship (`d1802c0`, doc + APK only; verified: no `client.ts`/`ui.ts` change) plus site wallpaper/podcast publish commits. Local main (`39f224f`, the v680 ship) and `origin/main` share history only to v665 (`203c624`) — parallel ship records for v666–v680 with byte-identical `client.ts`/`ui.ts` trees (full-tree diff between the two mains: only the v681 doc, the APK, wallpapers, and `docs/podcast.xml`). The Plan commit was transplanted alone onto current `origin/main` (`git rebase --onto origin/main 39f224f`): **clean, one commit, `ca7670a` → `3951246`**. Every Plan line citation was re-verified on the rebased tree and stands exact — the settle seat at client.ts:22240, `refreshPlayedChrome` at :16689, `opnTrackUnplayed615` :16652, `opnCounts615` :16664, `opnBlockCounts615` :16684. No citation moved; no §3 citation note is owed.

**The diff (commit `41f6006`, 2 files, +8/−1):**

- `app/worker/src/client.ts` — in `resolveExternals`' ext settle seat `settle(slot, st)` (client.ts:22240), beside `updateBlockCounts(day)` (after `extRebuildDescs(day)` + `extSwapCard(slot)`), one call added, with a v682 comment naming the seat:

```js
      updateBlockCounts(day);
      // v682: a settle also changes the section card's counted
      // set (an unavailable descriptor becomes available) — the
      // swap's own refresh stands unreachable when the card is
      // closed (its rows stand nowhere in the DOM), so the head
      // count [data-p615count] recomputes here, from live
      // state.dayDescs, at the settle moment.
      refreshPlayedChrome();
      writeCache();
```

- `app/worker/src/ui.ts` — the pin seat: `CACHE = "ora-pro-nobis-v680-1"` → `"ora-pro-nobis-v682-1"`.

No other product change, exactly per Plan §2.4: one count (`opnBlockCounts615`) for both paints, recomputed from live `state.dayDescs` at settle, without expansion. `extSwapLabeled650`'s trailing refresh stands untouched (redundant-but-harmless on the open-card path).

**Harness — `app/worker/harness-v682.mjs` (commit `10eee63`):** playwright-core + esbuild bundle of the real Worker, API stubbed in-page. The fixture day (2026-11-26) is driven through the real `resolveExternals(day, settingsOverride)` — the production settle closure, not a reproduction: the courier leg releases `ext-invitatory` at once and holds the labeled `ext-morning-prayer` Divine Office side's bytes until the leg's cue (the Sing the Hours side's routes hang whole); the Angelus stands played in the played store. One stub note: the track-draws read hangs, matching production timing — every standing descriptor's draw key (the unavailable Morning Prayer descriptor's included) is asked at the first build, so no draw response lands at the settle moment to repaint the view and mask the defect (a resolving draws stub was tried first and did exactly that masking, through `refreshTrackDrawSurfaces`' whole-view repaint).

Tallies:

- **Built tree (release/v682 at `10eee63`): `harness-v682: 25 ok, 0 bad`.** L1 closed count 4 at paint → **5 at the settle, card still closed** → 5 expanded, 6 rows standing. L2 closed mark 5→4, unmark →5. L3 readings row held back (closed 4) → joins at +1 → 5 with no expansion, and stands before the Rosary on expansion. L4(i) accordion one-open/toggles as v659 recorded; L4(ii) Favorites Catechesis 2 / Prayers 3, mark 2→1 and back, counts + disc classes byte-identical across a real ext settle fired while the Favorites page stands.
- **Pre-fix tree (`ORA_WT` at the Plan commit `3951246`): `harness-v682: 24 ok, 1 bad`** — the one failure is L1's discriminating assertion, exactly as required: the closed count reads **4** after the settle. Every other leg passes there, as the Plan predicted (L2/L3/L4 are regression guards, not discriminators).
- **Regression harnesses on the built tree:** `harness-v677: 18 ok, 0 bad`. `harness-v673: 29 ok, 1 bad` — the one failure is its fixture pin check, whose whitelist names only v679/v673/v672 pins; it fails identically on the pre-fix tree (pin v680-1), so it is the old harness's stale pin list, not a regression: all 29 functional legs pass on both trees. `harness-v678` (run additionally, the Favorites surface): `29 ok, 1 bad` — the same stale pin-whitelist fixture check (v677/v678 pins only); all functional legs pass.

**State at Implement close:** fix + pin committed (`41f6006`), harness committed (`10eee63`), this §3 follows in its own commit. Not merged, not deployed, board untouched — the line stops here for Review.

## §4 Review

**Verdict: PASS.** Light Review on the streamlined path, judged independently of Implement's record — the diff was read directly, the harness was re-run by Review on both trees, and the no-regress reasoning was checked against the code. No findings.

**1. Diff — exactly the Plan §2.4 shape, nothing else.** Review read `git diff 3951246..41f6006` (the Plan commit → the fix commit) directly: 2 files, +8/−1.

- `app/worker/src/client.ts` (+7): one call, `refreshPlayedChrome();`, added in `resolveExternals`' ext settle seat `settle(slot, st)`, immediately beside `updateBlockCounts(day);` and after `extRebuildDescs(day)` + `extSwapCard(slot)`, before `writeCache()` — plus its v682 comment naming the seat. No other client.ts line changes.
- `app/worker/src/ui.ts` (1 line): the pin seat only, `ora-pro-nobis-v680-1` → `ora-pro-nobis-v682-1`.

The count computation (`opnCounts615` / `opnTrackUnplayed615` / `opnBlockCounts615`), the paint seat (`opnSetHtml609`), the swap seats, the accordion wiring, and the v678 count seat (`favUnplayedCount678`) all stand untouched by the diff.

**2. Harness — Review's own runs of `app/worker/harness-v682.mjs`:**

- **Built tree (release/v682 at `c26e5b1`): `25 ok, 0 bad`.** L1: closed count 4 at paint → **5 at the settle, card still closed, no expansion tap** → 5 expanded, 6 rows standing. L2 closed mark 5→4, unmark →5. L3 readings row joins at +1 → 5 with no expansion and stands before the Rosary on expansion. L4(i) accordion one-open/toggles as v659 recorded; L4(ii) Favorites Catechesis 2 / Prayers 3, mark 2→1 and back, counts + disc classes byte-identical across a real ext settle.
- **Pre-fix tree (Plan commit `3951246`, run via `ORA_WT` on a detached worktree of that commit): `24 ok, 1 bad`** — the sole failure is L1's discriminating assertion, exactly as required: `FAIL L1 closed count == 5 at once, with NO expansion tap :: "4"`. Every other leg passes there, matching the Plan's prediction that L2/L3/L4 are regression guards, not discriminators.

**Fixture verification (Improvement D):** L1's fixture matches John's real Morning block from the field recording, in identity, order, and played state: Invitatory (ext slot, settled `present` before paint) · Morning Offering (Extended) · Morning Prayer — Divine Office (the labeled `ext-morning-prayer` slot, held `downloading` at paint ⇒ `available: false` ⇒ uncounted, settled `present` on the leg's cue) · Daily Mass Reading Podcast for November 26, 2026 (`listened: false`) · Daily Rosary — Luminous Mysteries (Thursday) · Marian Antiphon — Angelus (pre-marked played in the played store on the presented date 2026-11-26, via the standing `writePlayedQuiet` seam). Closed-paint trace: 5 counted, 4 unplayed — the recording's closed count.

**Settle-path verification:** the harness drives the real settle path, not a stub that repaints the whole view. `setupDay` calls the production `resolveExternals(day, SETTINGS)` from the bundled client; only the network is stubbed in-page, holding the Divine Office side's bytes (`__mpP`) and the courier payload until each leg's cue. The settle that lands is the production `settle(slot, st)` closure — `extRebuildDescs` → `extSwapCard` → `updateBlockCounts` → (post-fix) `refreshPlayedChrome` → `writeCache`. After the initial paint, L1 issues no repaint call before reading the closed head; the count change on the built tree can only have come through the settle seat under test. (The track-draws read hangs in the stub by design, matching production timing, so no draw response repaints the view at the settle moment and masks the defect.)

**3. No-lag / no-regress — checked against the code:**

- **No double-paint:** `refreshPlayedChrome()` (client.ts:16689) mutates standing DOM in place only — text content and class toggles on `[data-p615count]` heads (via the `[data-p615disc]` arm, recomputed through `opnBlockCounts615` from live `state.dayDescs`), mark buttons, podcast dots, and novena lines. It never calls `paintPrayersView` / `opnSetHtml609` and rebuilds no card or row nodes, so the added settle-time call cannot double-paint or re-render the view; the closed card's head number simply recomputes at the settle moment — no lag, no expansion needed.
- **Favorites values cannot change:** the same pass's Favorites arm (client.ts:16750–16758) recomputes each `[data-favcount678]` from its own store through `favUnplayedCount678` — recomputed, never incremented, the v615 discipline — and that count seat is untouched by the diff. Empirically confirmed by L4(ii): Favorites counts and disc `all` classes stand byte-identical across a real ext settle fired while the Favorites page stands, and a Favorites mark still updates its folder count at once.
- **Regression harnesses, Review's own runs:** `harness-v673` on the built tree: `29 ok, 1 bad`; `harness-v678` on the built tree: `29 ok, 1 bad`. In both, the sole failure is the fixture pin-whitelist check (`FAIL F the served service worker carries this tree's pin` / `… carries a v677/v678 pin`). Both harnesses were also run by Review on the pre-fix tree (`3951246`, pin v680-1): identical tallies (`29 ok, 1 bad` each) with the identical sole pin-whitelist failure. The failures are the old harnesses' stale pin lists, present before the fix, not regressions; all functional legs pass on both trees.

**4. Gate honesty:** every tally above is from a harness run Review executed in this seat on the named tree. No check is recorded as passed that did not run. No device/field leg was run in Review — none is claimed; the field confirmation (John's closed Morning count standing correct after the ext settle on his phone) remains a post-ship field leg, not a Review pass.

**State at Review close:** §4 written and committed on `release/v682`. Not merged, not deployed, board untouched — the line stops here for Ship.
