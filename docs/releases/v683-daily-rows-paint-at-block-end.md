# v683 — Daily rows paint at block end

## §1 Scope

John's field report (2026-11-26 00:43 CT, screen recording, Ora Pro Nobis line): in the Praylist, a resolved DAILY dynamic row (the v666 `daily` contents kind) paints at the END of its block instead of at its contents position.

John's real Morning, Thu Nov 26 (contents order as the Edit form shows it):

1. Invitatory (`source:ext-invitatory`)
2. **The Saint of The Day Podcast (Daily)** (`daily:saint-of-the-day`)
3. Morning Offering (Extended) (`source:morning-prayer`, own)
4. The day's readings (`seat:daily-readings`)
5. …the block's standing rows (Divine Office — Morning Prayer · Daily Rosary · Marian Antiphon)

The Morning card paints SEVEN rows in standing order with the Saint daily row **LAST**, not second. The row's stale-episode label is correct behavior (the Nov 26 episode had not landed; the v666/v677 NOT-UPDATED fallback stands) and is NOT part of the defect.

Run level: To Ship (streamlined Scope+Plan pass; this chain ships AFTER v682 — see §2.5). Base: `origin/main` `3d87110`, branch `release/v683`. All line citations below are `app/worker/src/client.ts` at that base unless named otherwise.

### §1.1 Root cause — PROVEN, with the reproduction in §1.2

**The defect is not in the composition walk. It is in the contents list the walk reads, one fold earlier: the v601 restore inside `opnApplyTodayLayer594` (client.ts:3380) reorders the block's contents when a today-layer entry for the presented date is partial.**

The chain, seat by seat:

1. **The day fold applies the today layer.** `opnFoldDay590` (client.ts:4198) builds the effective profile from the standing pick, then applies the presented date's today-layer entry: `eff = opnApplyTodayLayer594(eff, tEntry594)` (client.ts:4222). The result rides the payload as `day.profile`, and its `contents` are the one list every later consumer reads — the resolver jobs, the composition walk, and (in the server shape) nothing else; the server fold's twin (`profileFoldOf`, index.ts:1516–1520) applies today contents **verbatim per block** and has no restore, so this defect is specific to the client fold (the device/web shapes — John's phone).
2. **The v601 guard prepends the restored set whole.** In `opnApplyTodayLayer594`, per block: when the today entry names **no `source` item and no `prayer` item** (`namesSource`, client.ts:3407; `namesPrayer`, client.ts:3413) — the shape of a hand-shaped Edit-today entry carrying only the item(s) the user touched, e.g. only `{kind:'daily', key:'saint-of-the-day'}` — the guard restores the standing selectors the snapshot would otherwise gate out: `standing = opnStandingContents597(out, b)` filtered to `source`/`seat` items (client.ts:3427), minus the ids the entry already names, and then **`entry = restored.concat(entry)` (client.ts:3431)** — every restored item ahead of **every** entry item, regardless of where the entry's items stand in the standing list. The guard's purpose (a sourceless snapshot must not gate the block's sources out of the day) is met; its placement rule is the defect: a `daily` item that stands **second** in the standing contents lands **after the last restored source** — at the block's tail of the composed contents.
3. **The composition walk is innocent — and that is why the row still paints, last.** `extRebuildDescs`' contents pass (client.ts:21308) walks `day.profile.contents[block]` in order; its `daily` branch (client.ts:21332–21350) pushes the resolved descriptor from `state.dailyRes666[b.block + ':' + it.key]` at the item's own position. `resolveDailyDynamic666` (client.ts:20877) resolves the row correctly and its settle rebuilds + repaints. Given the reordered contents from step 2, the walk faithfully seats the Saint row last. The paint (`opnSetHtml609`, reading `state.dayDescs` = `state.composed642`, client.ts:21425) preserves list order; no paint-side sort exists.
4. **Why the standing harnesses never saw it:** harness-v666's and harness-v677's fixtures fold days whose profile documents carry **no today-layer entry for the presented date**, so step 2 never runs and the walk seats every daily row correctly (harness-v666 leg L9 passes on this tree today). The defect needs the conjunction: a presented date with a partial (sourceless, prayerless) today-layer contents entry for the block **and** a non-source item (daily · course · day · episode · video) in that entry whose standing position is not last.

**Named premise, honestly bounded:** the code seat and the mechanism are proven (§1.2 reproduces the exact field paint from shipped code). The one fact Plan cannot read from the repo is the contents of John's on-device today-layer entry for 2026-11-26 — the mechanism requires it to be a partial entry naming the Saint daily item and no source/prayer item. It is the only seat in the shipped code that produces this exact paint (all rows present, standing order preserved, daily last, stale label intact); Implement's first step (§2.5) includes the read-back that confirms or refutes it against the device document shape, and the fix (§2.1) is correct for every partial-entry shape, not only the Saint one.

### §1.2 Reproduction (harness-v683 skeleton, run at Plan on the unmodified tree)

`app/worker/harness-v683.mjs` (committed with this doc; modeled on harness-v666 — jsdom world over John's real profile document, production fixture shapes):

- **Leg 1 (control) — PASS on the unmodified tree.** Standing contents only (John's Morning list above, standings/slots present in the production seed shapes, the readings seat resolved in its production shape): composed Morning order is exactly Invitatory · Saint daily · Morning Offering · Morning Prayer · readings seat · Rosary · Antiphon — the Saint row SECOND. The full-build variant (leg 1b, `buildDayFromPayload` with every resolver racing) passes identically. This eliminates candidates (a)–(c) of the intake brief for the standing path: the daily branch IS reached, `selIdx590`/the candidate machinery is not involved for a daily item, and no second builder appends the row.
- **Leg 2 (the defect) — FAIL on the unmodified tree, exactly as the field.** The same fixture plus a today-layer entry for the presented date, `contents.Morning = [{kind:'daily', key:'saint-of-the-day'}]` (the partial hand-shaped shape): the folded Morning contents read back as `[source ext-invitatory, source morning-prayer, seat daily-readings, source ext-morning-prayer, source daily-rosary, source marian-antiphon, daily saint-of-the-day]` — the restored set prepended, the daily item last — and the composed Morning order is Invitatory · Morning Offering · Morning Prayer · readings seat · Rosary · Antiphon · **Saint daily LAST**: John's seven rows, John's order. Tally at Plan: **3 ok / 2 not-ok**, the 2 failures being leg 2's two assertions.

### §1.3 Boundaries

In scope: the client fold's today-layer restore placement (`opnApplyTodayLayer594`), for every block and every non-source contents kind the restore can displace. Out of scope, named: no change to `extRebuildDescs`, the candidate machinery, `resolveDailyDynamic666`, the v677 settled-pick store, the paint, or the server fold (index.ts — it has no restore; a partial entry there gates sources out instead of displacing, a different and pre-existing posture this release does not touch). No migration, no server change. The v601 guard's PURPOSE stands: a sourceless today snapshot must still not gate the block's standing sources/seat out of the day — only its placement rule changes.

## §2 Plan

### §2.1 The fix — interleave the restore at standing positions (one seat, `client.ts`)

In `opnApplyTodayLayer594`'s restore branch (client.ts:3427–3431), replace the whole-set prepend (`restored.concat(entry)`) with a **standing-order merge**:

- Compute each item's standing index from the block's standing list (`opnStandingContents597(out, b)`, the unfiltered list, keyed by `opnTodayItemId594` + occurrence, the v610 multiset discipline).
- The applied entry is the merge of the restored items and the entry's own items, ordered by standing index: a restored source/seat item and an entry item interleave exactly as they stand in the standing contents — so the Saint daily item (standing index 1) lands after the Invitatory (0) and before Morning Offering (2), and the entry's items keep their contents seats all day (the v677 settled-pick discipline is untouched: the resolver keys on block+series, never on position; only the walk order changes).
- An entry item with **no standing index** (a today-only add that does not stand in the standing contents) keeps its entry-relative position: it is anchored after the nearest preceding entry item that has a standing index (or at the head when none precedes), and restored items never cross it from behind. No item is dropped, duplicated, or re-keyed; occurrence counts ride the multiset rule, as today.
- Everything else in the function is byte-identical: the guard still triggers only on a sourceless, prayerless entry; an entry naming any source or any prayer still applies **verbatim** (the deliberate-gating posture stands); blocks with no today entry are untouched.

This is the minimal change that seats the resolved daily descriptor at its contents index for **all five** series in `OPN_DAILY_SERIES_666` (client.ts:2851) in every block — the merge is kind-blind, so `daily` items for saint-of-the-day · daily-gospel-exegesis · daily-readings · bible-in-a-year · catholicsaints all re-seat, and the displaced `course`/`day`/`episode`/`video` items the same guard could move are fixed by the same stroke (named here so Review does not flag the wider effect as scope creep — it is the same defect).

**Composition with standing rules, checked at Plan:**

- **v660 readings seat:** the seat item is part of the restored set (kind `seat` rides the 3427 filter); under the merge it takes its standing index in the contents, and it still stands nothing in the walk — `foldReadingsSeat` (client.ts:14601) splices the seat descriptor immediately before the Morning `daily-rosary` descriptor exactly as today (harness leg 1's expected order already encodes this: seat between Morning Prayer and Rosary). The fix moves no seat logic.
- **v677 settled pick:** `resolveDailyDynamic666` reads jobs from `eff.contents` keys only; the settled store is keyed (presented, block, series). A re-seated walk changes no identity, no draw key, no settle. The stale row in the field report stays stale, at the right position.
- **Save New (opnSaveNew604, client.ts:24346)** also consumes `opnApplyTodayLayer594`'s composed output — under the merge, a profile minted from a partial-entry day carries the standing order instead of the prepended order. Same fix, no extra seat.

### §2.2 Harness plan — `app/worker/harness-v683.mjs` (full legs at Implement)

The skeleton committed with this Plan carries legs 1–2 (leg 1 + 1b controls, leg 2 the defect). Implement completes it:

1. **Leg 1 (control, stands):** standing contents, John's Morning fixture — composed order == contents order, Saint second. Passes on old and new.
2. **Leg 2 (the defect, stands):** the partial today entry `[{daily saint-of-the-day}]` — composed order == standing order, Saint second, no duplication, no drop. **Fails on the unmodified tree (proven at Plan, §1.2); must pass on the fixed tree.**
3. **Leg 3 — all five series:** for each key in `OPN_DAILY_SERIES_666`, a block whose partial today entry carries only that series' daily item, standing mid-block in the standing contents → the resolved row stands at its standing index. (Per-series payloads in the harness-v666 shapes; catholicsaints exercises the video raw-push branch of the walk.)
4. **Leg 4 — first and last:** (a) a block whose daily item stands FIRST in the standing contents, partial entry carrying it → still first, exactly once; (b) one whose daily item stands LAST → still last, exactly once (the merge must not invent a move where none is owed); (c) a today-only entry item with no standing index (e.g. an `episode` pin added for today only) amid restored sources → it keeps its entry-relative seat, nothing drops.
5. **Leg 5 — regressions:** harness-v677 (18 ok / 0 bad expected, its standing tally) and harness-v666's key legs (L4 resolution · L9 placement · L5 fallback) re-run green on the fixed tree, allowing only the known stale pin checks those harnesses carry; plus a verbatim-path leg: a today entry naming a source item applies verbatim (no restore, no merge) — the deliberate-gating posture is unchanged.

Fixtures (Improvement D): John's real Morning contents and standings as in the skeleton (production seed shapes, `OPN_SEED_SOURCES` sortOrders; saint/readings payloads from `app/worker/v666-fixtures/production-heads.json`, the 2026-11-25 live captures; the profile document is John's v589 import, as harness-v666/v677 use it). The today-layer entry shape is the stored shape `opnCheckTodayLayer594` validates (client.ts:3448) — `{baseProfileKey, contents:{<block>:[…]}}` under `sections.profiles.todayEdits[<date>]`.

### §2.3 Risks

- **Merge-rule edge — duplicate items:** a standing list carrying the same source twice (the v610 Divine Office duplicates) — occurrence-keyed indices are required; a naive id-keyed merge collapses copies. Leg 4 + the multiset rule in §2.1 cover it; Review checks the occurrence handling in the diff.
- **Today-only adds (no standing index):** the anchor rule in §2.1 is the one genuinely new semantic. It is deliberately conservative (entry-relative order preserved, restored items never cross an anchored add from behind); leg 4c proves the shape. If Implement finds a cleaner formulation with the same two properties, it may take it and name the deviation in §3.
- **The field premise (§1.1):** if the device read-back at Implement shows John's Nov 26 entry in a different shape (e.g. naming a source), the restore never ran for his day and this fix, while correct for the proven mechanism, would not close his field leg — Implement must say so in §3 rather than ship on the harness alone, and the coordinator re-opens Scope for the residue. The harness legs stand either way: the prepend is a proven order defect for a validated stored shape.
- **Scope of the merge:** it runs only inside the existing guard (sourceless + prayerless entries). Standing-profile contents, verbatim today entries, and the server fold are untouched, so the blast radius is exactly the partial-entry days.

### §2.4 Ship notes

- **This chain ships AFTER v682.** At Implement start (and again before Ship): rebase `release/v683` onto the post-v682 `origin/main`, re-run harness-v683 whole (legs 1–2 at minimum pre-rebase shapes; the full set after), and re-verify the §1.1 line citations against the rebased tree — v682 may shift line numbers; the seats are named by function so they re-find cleanly. Any citation that no longer matches is a §3 deviation, named.
- Pin: `ui.ts` CACHE → the next v683 pin at its one seat (Implement names it), per standing practice.
- No APK, no migration, no Worker route change — client.ts + ui.ts pin + harness + this doc only.
- Field leg (John's, the chain never claims it): on Thu Nov 27's Praylist (or by an Edit-today act that leaves a partial entry), the Morning card stands the Saint daily row second, in contents order.

## §3 Implement record

### §3.1 Device-document read-back (Plan §2.3 gate) — GATE NOT PASSED: premise neither confirmed nor refuted; Implement STOPPED at the gate, coordinator to decide

Attempts, in order (2026-11-26, Implement seat):

1. **App agent door** (`~/workspace/.tools/prayer_door.py`, the Ora app's own door): `GET /api/agent/prayer/profiles?date=2026-11-26` → HTTP 200. Body: `todayEdit: null`; `state: {standingKey: 'salesian', version: 6}`; profiles = the three defaults only (little-way · salesian · benedictine), none carrying `contents`; `effective.contents: null`.
2. **Direct D1 read** of the live app database `ora-pro-nobis-app` (`3a177d55-7baa-424c-9c4d-0d60cd9fe332`, via the Cloudflare connector `cf.py`): `SELECT standing_key, version, today_edits FROM prayer_profile_state WHERE id=1` → `standing_key='salesian'`, `version=6`, **`today_edits` = NULL** — the column is empty for every date, not only 2026-11-26; the table has the single row `id=1`. `prayer_profiles` holds only the three default rows; the salesian `layers` JSON (133 chars) carries no `contents` key. Full table list checked: no per-user personal-document table exists in this database.
3. **Code read — where the entry actually lives:** the fold that paints on John's phone reads `opnDoc()` (client.ts:1644), which in app mode loads the personal document from **device localStorage** (`OPN_DATA_KEY = 'opn-personal-data-v1'`, client.ts:1428), `sections.profiles.todayEdits` included; web mode never stores personal data (client.ts:1685ff). The server store read in attempts 1–2 is the server fold's mirror, not the device document. **No door route, D1 table, or other server surface exposes the on-device document** — it is reachable only on John's device itself (in-app export, or a device session).

**Verdict:** the server-side store is reachable and **empty** — no today-layer entry for 2026-11-26 (or any date) stands server-side. The on-device entry the premise turns on is **genuinely unreachable from this seat**, so the partial-entry shape (`contents.Morning = [{kind:'daily', key:'saint-of-the-day'}]`, no source/prayer item) is **neither confirmed nor refuted**. Per the Implement brief's gate rule, Implement did **not** proceed to the fix, the full harness, or the pin bump; the coordinator decides (options on the record: proceed on the Plan's proven mechanism + harness alone per §2.3's "the harness legs stand either way", or first obtain the device document shape from John's phone).

**Not done, by the gate:** §2.1 fix · §2.2 legs 3–5 · pin bump to `ora-pro-nobis-v683-1` · fail-on-old / regression tallies. Harness skeleton legs 1–2 stand as committed at Plan (72a7962).

**Deviation named (§2.4):** v682 has not merged to `origin/main` at Implement start (origin/main still `3d87110`; `release/v682` stands at 10eee63 in its own worktree), so the post-v682 rebase could not be performed; the branch stands on the Plan base. Rebase + citation re-verification remain owed when v682 lands.

### §3.2 Coordinator decision (2026-11-26, binding) — PROCEED under Plan §2.3 option (a)

COORDINATOR DECISION (2026-11-26, binding): PROCEED under Plan §2.3 option (a) — implement on the proven mechanism + harness alone. Grounds: the restore-prepend in opnApplyTodayLayer594 (client.ts:3427–3431) is the only seat in shipped code producing this exact paint; harness leg 2 already reproduces John's exact seven-row Morning order with the Saint last from a partial today entry; John's recording shows a today-layer edit standing on his device; the fix is guard-scoped and kind-blind, so a verbatim entry (if his were one) is untouched by it. John's post-ship re-test is the device verification.

### §3.3 Implement record (2026-11-26, continuation seat under §3.2)

**The fix — `app/worker/src/client.ts`, inside the restore guard in `opnApplyTodayLayer594` (client.ts:3427–3466 on the fixed tree):** the whole-set prepend (`entry = restored.concat(entry)`, old client.ts:3431) is replaced by a standing-order merge. The standing list is read unfiltered (`opnStandingContents597(out, b)`, client.ts:3427); each item's standing index is keyed by `opnTodayItemId594` + occurrence (the v610 multiset discipline, so duplicate standing items keep their own indices). Restored items (tier 0) and entry items (tier 1) interleave by standing index; an entry item with no standing index (a today-only add) anchors at the nearest preceding entry item's standing index at tier 2 — restored items never cross it from behind — or at the head (index −1) when none precedes. The restored-set computation itself (standing `source`/`seat` items minus ids the entry names) is byte-identical to the old code; the guard still triggers only on a sourceless, prayerless entry, and an entry naming any source or prayer still applies verbatim (proven by harness leg 5). Kind-blind: no kind is named in the merge. Untouched, as planned: `foldReadingsSeat` (the v660 splice), the v677 settled-pick discipline, the resolver, and the server fold (`index.ts` not in the diff).

**Pin:** `app/worker/src/ui.ts:1186` — `ora-pro-nobis-v680-1` → `ora-pro-nobis-v683-1`, its one seat.

**Harness — `app/worker/harness-v683.mjs` completed to all legs (Plan §2.2):**

- **Built tree: 25 ok / 0 not-ok.** Leg 1 + 1b controls · leg 2 the defect · leg 3 all five `OPN_DAILY_SERIES_666` series at a mid-block seat (folded contents == standing contents exactly, resolved row second, exactly once; catholicsaints exercises the video raw-push branch) · leg 4 first/last/today-only-anchor · leg 5 verbatim path + v666 L4/L9/L5 drawn legs.
- **Fail-on-old (the pre-fix `client.ts` at 08f89bc swapped in, harness unchanged): 9 ok / 16 not-ok.** Every leg-2, leg-3, and leg-4 assertion that turns on the merge fails on the old tree — the daily row paints last in each — while the controls (leg 1/1b), the verbatim leg, the no-duplication count, and the drawn v666 legs pass on both trees, as designed. (Leg 4b's composed assertion also passes on the old tree: with the daily item standing last, the prepend displaced nothing the walk paints — the seat item the prepend moved ahead of it stands nothing in the walk. Its folded-contents assertion fails on the old tree, which is where the displacement is visible.)
- **Regressions on the built tree:** `harness-v677.mjs` **18 ok / 0 bad** (its standing tally). `harness-v666.mjs` **62 ok / 3 not-ok**, and the identical 62/3 with the identical three failures stands on the unmodified base tree (pre-fix `client.ts` swapped in), so all three are pre-existing and none is caused by this fix: (i) L5 "descriptor settles to the day's own entry when the fixture restores it" and (ii) R2 "non-stale daily audio card" — the same descriptor (`0e035504-b8a2-4a58-a6e1-2d60da50b409`, stale:true) on both trees; the v666 expectation predates the v677 settled-pick discipline, under which a stale settled row stands (harness-v677 L5 proves that posture green); (iii) P pin — the harness's stale pin expectation (`ora-pro-nobis-v673-1`), re-pointed by every ship since, the known stale pin check Plan §2.2 allows.

**Deviations from the Plan, named:**

1. **Leg 3, daily-readings stands in Evening, not Morning** (the harness-v666 placement): in Morning the readings seat stands in the same block and the v666 §2.7 suppression in `resolveDailyDynamic666` resolves no daily-readings row beside its seat — a Morning composed assertion for that series cannot pass on any tree. Its folded-contents discipline is still proven in Evening, and the Morning seat composition is legs 1/2's ground.
2. **Leg 4 folded expectations carry the migration's seat:** the fixture profile's Podcasts layer carries daily-readings, so `opnMigrateProfileRecord609` appends `seat:daily-readings` to Morning when a leg's standing contents omit it — pre-existing fold behavior upstream of the today layer. Legs 4a/4b expect standing contents + that seat at the tail (its standing index under the merge); composed assertions are unchanged.
3. **Fail-on-old method:** the brief said "stash the fix"; the fix was already committed, so the pre-fix `client.ts` (08f89bc) was swapped in by file copy, the harness run, and the fixed file restored byte-identical (working tree clean after). Same proof, named here.
4. **§2.4 rebase still owed:** v682 has not merged to `origin/main` (still `3d87110` at this seat's start), so the post-v682 rebase + citation re-verification remain the coordinator's pre-Ship step, as §3.1 recorded. Line citations in §1/§2 are against the Plan base; on this tree the merge stands at client.ts:3427–3466.

## §4 Review record (2026-11-26, independent Review seat, light review under the streamlined path)

**Verdict: PASS — cleared for Ship after the coordinator's post-v682 rebase + merged-tree harness re-verification (§2.4, still owed per §3.3 deviation 4).** Review seat changed no product code; the tree stood clean at `7325b88` before and after every probe and swap.

### Gate (a) DIFF SHAPE — PASS

`git diff 08f89bc..7325b88 -- app/worker/src/` read in full: `client.ts` carries exactly one hunk — the restore-guard standing-order merge in `opnApplyTodayLayer594` (the restored-set computation is the old filter over the unfiltered standing list, byte-equivalent); `ui.ts` carries exactly the one pin seat (`ora-pro-nobis-v680-1` → `ora-pro-nobis-v683-1`). Nothing in `index.ts`, the resolver, `foldReadingsSeat`, or the v677 settled-pick code. The only other files in the range are `harness-v683.mjs` and this doc, as planned.

### Gate (b) MERGE CORRECTNESS — PASS

Merge code read cold against Plan §2.1: standing indices come from the unfiltered `opnStandingContents597(out, b)` list; keying is `opnTodayItemId594` + occurrence on both the restored and entry sides (v610 multiset discipline); tiers are restored 0 · standing entry 1 · unindexed entry 2 at its anchor index, with a monotonic `ord` tiebreak, so the sort is deterministic; the anchor advances only on an indexed entry item. Adversarial probes (throwaway harness copy driving `opnApplyTodayLayer594` directly, deleted after; 4 ok / 0 not-ok):

- **P1 — entry items in reverse standing order** (`[daily y, daily x]` against standing `[source a, daily x, source b, daily y, source c]`): output is exact standing order — standing order wins over entry order for indexed items, as §2.1 specifies.
- **P2 — entry item duplicated, standing carries it once** (`[daily x, daily x]`): both copies kept, none dropped; the second copy has no standing occurrence, anchors at tier 2 on the first copy's index, and the restored source behind it (`source b`) stays behind both copies.
- **P3 — today-only add amid reversed entry order** (`[daily y, episode pin, daily x]`): the pin anchors after `daily y`, its nearest preceding indexed entry item, and lands last; no restored item crosses it from behind.
- **P4 — duplicated standing source** (v610 shape, `[source a, daily x, source a]`, entry `[daily x]`): both copies restore at their own occurrence indices, around the daily item.

The claim "restored items never cross an anchored add from behind" holds in the code and in P2/P3: a restored item sorts after an anchored add iff its standing index exceeds the anchor's, and no restored item can share the anchor's index (indices are unique per standing position, and restored ids are disjoint from entry ids by the `seen` filter).

### Gate (c) HARNESS TRUTH — PASS

Re-run by this seat on the built tree: **harness-v683: 25 ok / 0 not-ok** (matches §3.3). Fail-on-old by file swap (pre-fix `client.ts` at `08f89bc` swapped in, harness unchanged): **9 ok / 16 not-ok**, and leg 2's composed Morning order on the old tree is invitatory · morning offering · morning prayer · readings seat · rosary · antiphon · **Saint daily LAST** — the field paint. The 16 old-tree failures are exactly L2 ×2 · L3 ×10 · L4a ×2 · L4b folded ×1 · L4c folded ×1. Tree restored byte-identical after each swap (`git status` clean, HEAD `7325b88`).

### Gate (d) REGRESSION CLAIMS — PASS

Re-run by this seat on the built tree: **harness-v677: 18 ok / 0 bad**. **harness-v666: 62 ok / 3 not-ok** on the built tree, and the **identical 62/3 with the identical three failures** on the base tree (method: the pre-fix `client.ts` at `08f89bc` swapped into this tree, `ui.ts` left at the v683 pin — the pin failure is therefore, if anything, understated on the base run, and it still fails identically). The three, on both trees: (i) L5 "descriptor settles to the day's own entry when the fixture restores it" — descriptor `0e035504-b8a2-4a58-a6e1-2d60da50b409`, stale:true on both; (ii) R2 "non-stale daily audio card" — the same descriptor on both; (iii) P pin — the stale `ora-pro-nobis-v673-1` expectation. All three are pre-existing; none is caused by this fix. §3.3's account is exact.

### Gate (e) DEVIATIONS ADJUDICATION — all four ACCEPTABLE

1. **Leg 3 daily-readings in Evening — acceptable.** The suppression is real in the shipped code: in `resolveDailyDynamic666`, a `daily-readings` item in a block carrying the `seat:daily-readings` twin resolves nothing for that block+series, so no Morning composed assertion for that series can pass on any tree; the Evening leg proves the same folded-contents + placement discipline, and Morning seat composition is legs 1/2's ground.
2. **Leg 4's `seat:daily-readings` tail append — acceptable.** `opnMigrateProfileRecord609` (client.ts:2953) is pre-existing profile-load behavior upstream of the today layer, untouched by this diff; legs 4a/4b name it in their folded expectations and their composed assertions are unchanged.
3. **Fail-on-old by file swap instead of stash — acceptable.** The fix was already committed; the swap reproduces the exact pre-fix file at `08f89bc`, and this seat repeated the same method independently with the tree verified clean after — same proof, honestly named.
4. **Leg 4b's composed assertion passing on the old tree — acceptable.** Verified by this seat: on the old tree L4b's folded-contents assertion FAILS (the prepend moved the seat ahead of the daily item) while its composed assertion passes, because the seat stands nothing in the walk. The displacement is proven where it lives — the contents list — and §3.3 names the split rather than hiding it.

### Gate (f) DOC — PASS

§3.2 carries the coordinator decision as committed at `55dd788`, verbatim, unaltered by later commits. Every §3.3 tally matches this seat's independent re-runs: 25/0 built · 9/16 fail-on-old · v677 18/0 · v666 62/3 on both trees with the same three failures.

### Ship conditions (carried, not Review defects)

- The §2.4 post-v682 rebase + citation re-verification + merged-tree harness re-run remain the coordinator's pre-Ship step (§3.3 deviation 4).
- The field leg remains John's post-ship re-test, per §3.2 — this PASS clears the code, not the device premise.

## §5 Ship record (chain-v683, 2026-11-26) — LIVE

Review PASS (§4, judged tree `7325b88` pre-rebase; gates (a)–(f) all PASS, adversarial merge probe 4/4). Run level: To Ship.

- **Rebase (§2.4, owed at Review):** release/v683 rebased onto the post-v682 main (`3c42237` remote / local mirror `387b1de`). Sole conflict: the ui.ts pin line (v682-1 vs v683-1) — resolved to `ora-pro-nobis-v683-1`. Citations re-verified on the rebased tree: `opnApplyTodayLayer594` stands at client.ts:3380, the v683 standing-order merge at client.ts:3432 (block 3432–3470). Harness re-verification on the rebased tree: harness-v683 **25 ok / 0 not-ok** · harness-v682 **25 ok / 0 bad** (no regression).
- **Merge:** release/v683 → main, tree-exact via the Git Data API (push-v683-github.py). Judged delta asserted blob-exact: client.ts `65fb2805` · ui.ts `18f39ce6` · index.ts `205f6597` (unchanged) · harness-v683.mjs `edf6c645` · this doc. Remote-vs-base delta empty — nothing dropped, no force-push. Remote ship commit **949bcc50beab481f4930b6d5b50711b965fb7293**, tree **70f407ed9b7529604afb299c8115eef288cc60db** (= the rebased branch tree, so the worktree harness runs stand as merged-tree runs); local mirror `a6144988`, same tree. Read-back: **main pushed · remote in sync**.
- **Harness at the merged tree:** harness-v683 **25 ok / 0 not-ok** (standing clone, merged main).
- **Deploy:** deploy-app-v683-ship.py with EXPECTED_HEAD = merged main head (`a6144988`); dry-run → deploy clean. Worker **45456c97-5e3e-4f17-a386-8f26e24845d4**, pin **ora-pro-nobis-v683-1**. Production verification: the served sw.js (app.orapronobis.media) reads pin ora-pro-nobis-v683-1 (×1, the only pin served); the served app.js carries the fix (`standingIdx683` ×3 · "standing-order merge" ×1) and the v678/v679/v682 markers stand (`favFolderSectionHtml` ×4 · `podSyncQueueListened` ×10 · `updateBlockCounts` ×9). No APK, no migration.
- **Board closeout (D1-direct, all read back):** release 1661 → Live, shipped_at 2026-11-26T07:11:33Z, whats_new_id 498 · What's New **498** ("Fixed: a daily episode (like the Saint of the Day) now stands in the Praylist where you placed it in the block, not at the end.") · shipped_records **872** · Ship phase record **2847** passed (commit_hash = the remote ship commit 949bcc50). Ship contract 1163's expectation judged **met** via the door. Coordinator contract 1149 was found already closed by the door mid-chain (the v679 pattern), so its two expectations could not be judged on it; the per-phase agent contracts (1152 Plan · 1157 Implement · 1162 Review · 1163 Ship) all judged met. Goals Board intake 1296 → Done, state line CLOSED.
- **Premise note (§3.2):** the on-device today-layer document was unreachable from this seat (phone localStorage); the chain proceeded on the proven mechanism + exact harness reproduction, per the coordinator's recorded decision. The field check below is the device verification.
- **Field check (stands open for John's confirmation):** the Saint of the Day row stands second in his Morning card, where his Edit form puts it — and any daily row stands at its contents seat in every block.
- **Rollback:** pin ora-pro-nobis-v682-1 (the v682 driver, `~/workspace/.tools/deploy-app-v682-ship.py`).
