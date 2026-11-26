# v677 — Daily row settles at start of day

## §1 Scope

John's rule (field direction, 2026-11-25, Ora Pro Nobis line): "When adding the dynamic per day it's, they only should repaint at the beginning of the day."

Restated as the release's requirement:

- A v666 daily dynamic row (`daily:<series>` contents item) settles its episode **once for the Chicago (presented) date** and holds that episode all day — across repaints, reloads, snapshot refreshes, and play/mark acts.
- Playing the day's episode never advances the row and never repaints it as a fresh copy of another episode.
- The next day's episode stands only when the date turns.
- The set is the whole v666 closed five: `saint-of-the-day` · `daily-gospel-exegesis` · `daily-readings` · `bible-in-a-year` · `catholicsaints` (video) — `OPN_DAILY_SERIES_666`, client.ts (v666 §2.4).

Field evidence (2026-11-25 ~20:19 CT, John's screenshot `Screenshot_20261125_201946_Ora_Pro_Nobis_11_ra5y.jpg`): Praylist, Wed Nov 25, 2026, Afternoon block — the Bible in a Year daily row stands as **"Day 323: Pentecost"**, hollow (unplayed) dot, carrying an intention draw, after John had already listened to Bible in a Year earlier that day. Two facts in that screenshot are load-bearing for the Plan:

1. A fresh Nov-25 resolution does not produce that row: day-of-year(Nov 25, 2026) = 329, and harness-v666 leg L4 proves a Nov-25 build resolves `biy:day-329` ("The Ethiopian Eunuch") from the production payload. "Day 323: Pentecost" is a different episode identity — `biy:day-323` in the production folded sequence (`app/tests/fixtures-v603/bible-folded.json`, the payload shape John's app consumes).
2. The row's played state and intention are those of a fresh row, not of the episode John played: the evening repaint is not the morning row's identity, so its mark and its draw (keyed by episode identity, §2.2) do not carry.

Run level: To Ship (streamlined Scope+Plan pass). Base: v676 ship head `71a489a`, branch `release/v677`.

## §2 Plan

### §2.1 Root-cause verdict, per candidate (code seats at base `71a489a`)

#### (a) The candidate set drops or re-ranks the played episode — ELIMINATED

- Sequence payloads (BIAY): `podBuildSequence` (index.ts:3339) groups feed items by `edition|day`, keeps one winner per group, then one supplier per day number (`daySupplier`, newest edition carrying the day) and sorts by day number. The snapshot therefore carries **exactly one entry per day number**, keyed `biy:day-N`.
- The serving fold, `podPayload` (index.ts:~3513), maps the snapshot entries 1:1 and only stamps `listened` / `positionS` onto each entry from `podcast_listens` / `podcast_positions`. A listened entry never leaves the list and never moves. `currentKey` (first unlistened) is derived beside the entries and is **not read** by `opnDailyMatch666`.
- RSS payloads (saint · exegesis · readings): `podRssBuild` (index.ts:4134) sorts by `publishedMs` desc and dedupes by guid/url into a fixed window; the listens fold likewise stamps state onto entries in place.
- Verdict: in neither payload family can playing an episode drop it, move it, or re-rank the set a re-resolution reads. Eliminated as the field mechanism.

#### (b) Order-sensitive first hit across feed years / a mid-day snapshot refresh changed the first hit — ELIMINATED for Bible in a Year; PROVEN as a latent hazard for two other series

- BIAY: the client never sees the 1887-item feed. It sees the deduped sequence (§a), so the matcher's first-hit scan (`opnDailyMatch666`, client.ts:20437 — first entry with `e.day === opnDailyDoy666(presented)`) is deterministic for a given snapshot: one candidate exists. A snapshot rebuild (`podSequence`, index.ts:~3470 — rebuild when the snapshot is older than 24 h, plus the watcher rebuilds at index.ts:~3011) can change the **supplier edition** under a day number (2025 vs 2026 edition of Day 329: different title/url), but the key `biy:day-329` and the day number cannot change, so a rebuild cannot bring a different day's episode into the match. It can only drift the dress under a stable identity — drift the settle (§2.3) must absorb, not the field advance.
- The hazard is real where the matcher is first-hit over a **publish-ordered, year-blind** list:
  - `daily-gospel-exegesis` (client.ts:20419): first entry whose Chicago publish date equals presented − 1, no sort — saved today only because the date includes the year, so the match is unique.
  - `catholicsaints` (client.ts:20443): first entry whose title's leading `Month D:` equals presented's MM-DD — the title carries **no year**; a next-year same-date video at the head of the 15-entry window would win the match.
  - `saint-of-the-day` (client.ts:20404): title-prefix `MM/DD` hits sorted by `publishedMs` desc — a future-year entry with the same MM/DD would outrank today's.
  - `daily-readings`: list order is publish order, not date order — the production capture (`app/worker/v666-fixtures/production-heads.json`) stands "Daily Mass Reading Podcast for **December 31, 2026**" first in the list, weeks ahead of the presented date. Only the exact-title match keeps an ahead episode out today; the matcher has no explicit never-later guard.
- Verdict: not the BIAY field mechanism, but the never-later guard in §2.3 is required work, not decoration.

#### (c) A repaint re-runs the whole resolution instead of reusing a settled descriptor — PROVEN, the root cause

1. **No settled record exists.** `resolveDailyDynamic666` (client.ts:20446) opens with `state.dailyRes666 = {}` (client.ts:20462) on **every** invocation, refetches `/api/player/podcasts?series=<key>`, and re-runs `opnDailyMatch666` against whatever payload stands at that moment. `state.dailyRes666` is a bare in-memory map: never persisted, never keyed by date, never read back as a record of what the morning chose.
2. **It re-runs on every day build.** Its one invocation seat is `buildDayFromPayload` (client.ts:22334). Within a single day, `buildDayFromPayload` re-runs on:
   - `renderPrayersSide` (client.ts:22193) — every Pray tab/side entry (dispatch at client.ts:7417), every reload and cold open;
   - `profileRebuild` (client.ts:23420) — after any profile/contents write (profile switch, Edit today / profile-editor saves);
   - `opnUnlockedRepaint609` → `renderPrayersSide` (client.ts:26150) — the vault-unlock repaint;
   - the day share-landing fetch (client.ts:17609) — a landing for another date fetches and builds that day;
   - `offlineDayFallback` (client.ts:22402) — a failed day read builds from the on-device snapshot (the snapshot path still calls `resolveDailyDynamic666`; only the externals resolution differs).
   - Named non-triggers, to bound the claim: `visibilitychange`/foreground (client.ts:6687) only re-asserts the media session and drains completions — no rebuild; pause/ended handlers save positions and marks — no rebuild. The harmful repaint is a navigation / reload / profile / unlock rebuild, not a foreground event.
3. **Played state is a resolve-time copy, and its home is what gets wiped.** The descriptor is built with `listened: !!e.listened` copied off the payload entry (client.ts:20508; video :20500) and copied again through `trackDesc` (client.ts:~16077). A completion mark flips only the **standing** copies — `podSyncQueueListened` (client.ts:9360) applies to `state.queue`, `state.current`, `state.previewQueue`, and `state.dayDescs` — **not** to `state.dailyRes666`. The next `extRebuildDescs` rebuilds the row from `state.dailyRes666` (client.ts:20866) and re-copies the stale resolve-time `listened: false`: the row repaints hollow even with zero payload drift, on any other resolver's settle (courses / episodes / videos / seat / starred / homily settles all rebuild).
4. **Any drift at a full rebuild is silently adopted as a new pick.** Snapshot rebuild across the 24 h line, a supplier-edition change, an RSS window shift — with no record of the morning pick, whatever the re-match returns becomes the row. A changed episode identity also re-keys the intention draw (draws key on `descMarkKey` = episodeId + block, client.ts:5080; §2.2), which is the screenshot's second tell: a new intention belongs to a new identity.

Root cause, in one sentence: the daily row is **re-decided on every repaint from live payload state, and its played mark lives on copies that the rebuild path does not consult** — so a mid-day repaint can stand a different, unplayed episode where the played one stood, and nothing in the code can contradict it.

### §2.2 Where built-day settled facts persist today (the seat the fix rides)

The per-track intention draw is the standing precedent for a built-day settled fact:

- Server store: `POST /api/player/track-draws` (migration 0040; client comment block client.ts:5281) — **first draw wins** per (presented date, track key); a settled key is never re-drawn that day.
- Client cache: `state.trackDraws` + `state.trackDrawsDate`, date-scoped — dropped whole when the presented date turns (client.ts:22207, in `buildDayFromPayload`); `settleTrackDraws` runs at the build settle (client.ts:22339) and on every rebuild (client.ts:20960), asking only for missing keys.

The daily pick has **no equivalent at any layer** — that absence is the defect. The fix (§2.3) adds the pick's own settled record in the same shape (date-keyed, first-settle-wins, dropped at the date turn), seated client-side in `localStorage` beside the standing per-device stores (the played store `PLAYED_KEY`/`readPlayed`, the podcast core `OPN_PODCAST_CORE_KEY`). Justification for the client seat over a new server store: (i) the resolver and every rebuild path are client code in all three app shapes (server / device / web), so one seat covers all of them; (ii) the pick is a per-device presentation fact — its played state already reconciles through the standing listen stores (podcast core on device, `podcast_listens` on server); (iii) no migration and no new route in a streamlined release; (iv) persistence across reload on the same device is exactly the property the field failure needs.

### §2.3 The fix shape (Implement's spec; all changes in `app/worker/src/client.ts` unless named, plus the pin in `ui.ts`)

1. **Settled-pick store.** New `localStorage` key `opn-daily-settled-v1`: `{ [presentedDate]: { [block + ':' + series]: { episodeId, stale, desc } } }`, where `desc` is the settled descriptor's stable fields (title, url/enclosure, durationS, imageUrl, descText, kind, videoId where applicable). Written at first settle for a date; pruned at write to the current + previous presented date. Module state mirrors it as `state.dailySettled677`, loaded lazily like `readPlayed()`.
2. **Resolution reads the record first.** In `resolveDailyDynamic666`: for each job, if a settled entry stands for (presented, block, series), the descriptor is rebuilt **from the settled identity** — stable fields from the stored `desc`; `listened` / `podPositionS` (video: the marks fold's `listened`) read **fresh** off the current payload entry with that same key/id when it stands in the payload, else from the last known values in `desc`. The matcher does not run for that job. Only a job with no settled entry runs `opnDailyMatch666`; its result (including a `stale: true` fallback result) is written to the store **before** the settle repaint.
3. **Never-later guard in `opnDailyMatch666`** (applies at first settle, the only moment the matcher runs):
   - `saint-of-the-day`: a title-prefix hit counts only when `ownChicagoDateStr(e.publishedMs) <= presented` (a future-year same-MM/DD entry is excluded); among qualifying hits, latest `publishedMs` wins, as today.
   - `daily-gospel-exegesis`: unchanged match (Chicago publish date == presented − 1 is never-later by construction); named in code as the guard.
   - `daily-readings`: the exact/contains title hit must also parse, via `opnDailyTitleDate666`, to a title date **equal to** presented (today the contains step is substring-only); the fallback already requires title date < presented.
   - `bible-in-a-year`: unchanged match (`e.day === doy(presented)`; a later episode is a greater day number and cannot match; fallback is lesser day numbers only); named in code as the guard.
   - `catholicsaints`: a title MM-DD hit counts only when `ownChicagoDateStr(v.publishedMs) <= presented` (excludes a next-year same-date video); the publish-date fallback (`== presented`) and the before-presented fallback stand as today.
4. **Played/mark state attaches to the settled episode.** Two legs: (i) §2.3.2's fresh read of `listened`/`podPositionS` from the payload entry for the settled key at every resolve — a mark recorded in the podcast core / server listens after the settle shows on the settled row at the next repaint; (ii) `podSyncQueueListened`'s apply list gains the `state.dailyRes666` descriptors (match on kind + podSeries/seriesKey, video descriptors on episodeId), so rebuilds between resolves stop re-copying a stale `listened: false` over a completed play.
5. **NOT-UPDATED shape.** When the matcher finds no entry for the presented date, the v666 §2.5 fallback (`stale: true`, the last episode that loaded, with its standing warning paint) is the result that **settles** for the date (§2.3.2). Consequence, named as John's rule verbatim: if the day's episode lands later that day, the row does not upgrade mid-day; it stands from the next date's first build. No match and no earlier entry still resolves nothing (the v666 named edge).
6. **Date turn is the only advance.** The store is keyed by the presented (Chicago) date the build carries (`day.presentedDay || day.date`, the resolver's standing `presented` read). A build for a new date finds no entry and resolves fresh; yesterday's entry is never consulted for today.
7. **Pin:** `ui.ts` CACHE → `ora-pro-nobis-v677-1` (its one seat).

Per-series identity summary (what names "that date's episode" vs "a later episode" under the fix):

| Series | That date's episode | A later episode (excluded by) |
|---|---|---|
| saint-of-the-day | Title `MM/DD` prefix of presented + Chicago publish date ≤ presented, latest publish | Same MM/DD, publish date after presented (future year) |
| daily-gospel-exegesis | Chicago publish date == presented − 1 (the v611 rule) | Any other publish date; the equality is the guard |
| daily-readings | Title date (parsed) == presented | Title date > presented (the batch-ahead entries, e.g. Dec 31, 2026 in the Nov 25 list) |
| bible-in-a-year | Sequence entry `day == doy(presented)`, key `biy:day-N` | `day > doy(presented)` |
| catholicsaints | Title `Month D:` == presented MM-DD + Chicago publish date ≤ presented | Same MM-DD title, publish date after presented (future year) |

Out of scope, named: no server change, no migration, no change to the matchers' fallback shapes, the seat twins / duplication rule (v666 §2.7), or the track-draw store. A daily item first added to a block mid-day has no settled entry and settles at its add — the beginning of that item's day, named here so Review does not flag it.

### §2.4 Harness design — `app/worker/harness-v677.mjs`

Modeled on `app/worker/harness-v676.mjs`: playwright-core Chromium, the real Worker bundle built with esbuild from source and served locally, the API stubbed in-page, `ORA_WT` selecting the tree for the fail-on-old run (base = the v676 tree at `71a489a`).

Fixtures (Improvement D — production shapes, sources named):

- **Bible in a Year (day-number shape):** the production folded sequence payload `app/tests/fixtures-v603/bible-folded.json` (the capture harness-v666 consumed; 372 entries keyed `biy:day-N` carrying `day`), which stands **both** Day 329 "The Ethiopian Eunuch" (presented 2026-11-25, doy 329) **and** Day 330 "Saul's Conversion" (tomorrow) in the same list, plus Day 323 "Pentecost" (the field screenshot's identity) as a standing control entry. The ahead episode is in the fixture from leg 1 — a fixture without Day 330 proves nothing about never-advancing.
- **Daily Readings (title-date shape):** the RSS payload built from `app/worker/v666-fixtures/production-heads.json` `readings` capture — "Daily Mass Reading Podcast for November 25, 2026" standing in a list whose **first** entry is the batch-ahead "December 31, 2026" episode, with November 24 / 23 behind it. Different dating shape from BIAY (calendar date in the title vs day number), and the ahead-publication hazard is in the fixture, not simulated.
- Day payload: a presented day of **2026-11-25** (Chicago) whose Afternoon contents carry `daily:bible-in-a-year` and `daily:daily-readings`, in the standing day-payload shape (harness-v676's stub pattern; profile/contents in the v666 harness's shape).

Legs (assertions on the standing row's episodeId, `listened`, `stale`, and its intention draw text):

1. **Morning resolve:** BIAY row = `biy:day-329`, readings row = the November 25, 2026 entry (not the December 31 head entry); neither is `stale`.
2. **Play to completion + repaint:** drive the BIAY row's descriptor through the standing completion seam (the mark act / `writePodMarkQuiet` path), then force a full `buildDayFromPayload` re-run and an `extRebuildDescs` rebuild. Row still = `biy:day-329`, now `listened: true`, intention text identical to leg 1's draw. **Must fail on the v676 tree** (the rebuild re-copies the resolve-time `listened: false` from `state.dailyRes666`, and a re-resolve is free to move the pick).
3. **Mid-day snapshot refresh + repaint:** swap the stubbed BIAY payload to a refreshed snapshot (Day 330's supplier edition changed, a Day 331 entry added, Day 329's entry carrying `listened: true` from the server fold; readings payload re-served with the December 31 entry still at its head), then a full day rebuild. Both rows still stand on their leg-1 identities; BIAY stands played. **Must fail on the v676 tree.**
4. **Date turn:** rebuild with a presented day of 2026-11-26. BIAY row = `biy:day-330` (already standing in the fixture since leg 1 — it stands only now). (Readings' capture carries no November 26 entry, named in the fixture note; the turn leg runs on BIAY, the readings turn is covered by leg 5's shape in reverse and is not claimed.)
5. **Today absent → NOT-UPDATED stands:** BIAY payload with the Day 329 entry removed → row = `biy:day-328` with `stale: true`; readings payload with the November 25 entry removed → row = the November 24, 2026 entry with `stale: true`. Then restore today's entries and repaint the same date: the stale settled rows **stand** (no mid-day upgrade — §2.3.5).

Fail-on-old: legs 2 and 3 must fail on the v676 tree (`ORA_WT` at base `71a489a`); legs 1, 4, 5's first halves are expected to pass there (they restate v666 behavior) — 5's second half (no mid-day upgrade after restore) is a v677-only assertion and is expected to fail on old. Regressions: harness-v676 and harness-v666 run green on the new tree before Review believes any leg.

## §2.5 Risks

- **localStorage loss** (reinstall, cleared site data): the settled record dies with the other per-device stores (played store, podcast core) and a mid-day re-resolve becomes possible again. Accepted — same posture as the standing stores; no new failure class.
- **Late-landing episode waits a day** (§2.3.5): a saint/exegesis episode that publishes after the day's first build stands tomorrow instead of upgrading at noon. This is John's rule applied literally ("only should repaint at the beginning of the day"); if the field shows it hurting, the relaxation is a Scope question, not an Implement improvisation.
- **Supplier-edition drift under a stable BIAY key:** closed by storing the settled descriptor's stable fields (§2.3.1) — a snapshot rebuild cannot re-dress the settled row; only `listened`/`positionS` are read fresh, by design.
- **Video year boundary:** the catholicsaints never-later guard keys on the Chicago publish date; the channel publishes ~02:00Z (previous Chicago evening), so today's video qualifies under `<= presented` on its own date — the guard excludes only genuinely future publishes.
- **Two devices, two settles:** each device settles at its own beginning-of-day against the payload it first sees; played state still reconciles through the standing listen stores. Named, accepted for a streamlined release.

## §3 Implement record

Implemented exactly per §2.3, all in `app/worker/src/client.ts` plus the `ui.ts` pin. Commits on `release/v677`: `6d8b298` (the fix) · `e93aa21` (the harness) · this section's commit (the record).

### §3.1 What changed, per Plan item

1. **Settled-pick store (§2.3.1)** — new `localStorage` key `opn-daily-settled-v1` (`OPN_DAILY_SETTLED_KEY`), seated beside the played store (`PLAYED_KEY` / `readPlayed`, client.ts ~5032ff): `opnDailySettled677()` (lazy load, mirrored as `state.dailySettled677`), `opnDailySettledSave677()`, `opnDailyPrevDate677()`, `opnDailySettlePut677(presented, jobKey, episodeId, stale, desc)` — shape `{ [presentedDate]: { [block + ':' + series]: { episodeId, stale, desc } } }`, `desc` a clone of the settled descriptor (its stable fields plus last known `listened`/`podPositionS`); prune at write to the current + previous presented date.
2. **Resolution reads the record first (§2.3.2)** — `resolveDailyDynamic666`: the standing `state.dailyRes666` copies are captured as `prevRes677` before the reset. Per series group, the settled map for `presented` is read first; the matcher runs ONLY when some job in the group has no settled entry. A settled job's descriptor is rebuilt from the stored identity: stable fields from the stored `desc`, `listened` read fresh off the current payload entry with the same key/id, else the standing copy's mark, else the stored value; `podPositionS` fresh off that entry when unlistened, nulled when listened. An unsettled job's matcher result — the `stale: true` NOT-UPDATED fallback included (§2.3.5) — is written via `opnDailySettlePut677` before the settle repaint. Date turn (§2.3.6) is structural: the store is keyed by `day.presentedDay || day.date`, the resolver's standing `presented` read.
3. **Never-later guards (§2.3.3)** — in `opnDailyMatch666`: `saint-of-the-day` title-prefix hits now also require `ownChicagoDateStr(e.publishedMs) <= presented` (latest qualifying `publishedMs` still wins); `daily-readings` exact and contains title hits now also require `opnDailyTitleDate666(title) === presented`; `catholicsaints` title MM-DD hits now also require `ownChicagoDateStr(v.publishedMs) <= presented` (publish-date and before-presented fallbacks unchanged). `daily-gospel-exegesis` and `bible-in-a-year` carry code comments naming them never-later by construction (publish-date equality == presented − 1; day-number equality == doy(presented)) — no behavior change there, per the Plan table.
4. **Played state attaches to the settled episode (§2.3.4)** — leg (i) is §3.1.2's fresh read at every resolve; leg (ii): `podSyncQueueListened`'s apply list gains the `state.dailyRes666` descriptors (podcast on kind + `podSeries`/`seriesKey`, video on `episodeId`) AND the settled store's stored `desc` copies, persisted in the same act — a completion mark lands on the settled descriptor copy, so rebuilds between resolves stop re-copying a stale `listened: false`.
5. **Pin (§2.3.7)** — `ui.ts` CACHE → `ora-pro-nobis-v677-1` (its one seat).

Scope discipline held: no server change, no migration, no change to fallback shapes, the seat twins, the track-draw store, or the v676 widget code.

### §3.2 Harness — `app/worker/harness-v677.mjs` (Plan §2.4)

Modeled on harness-v676 (playwright-core Chromium, esbuild bundle of the real Worker served locally, API stubbed in-page, `ORA_WT` tree switch). Fixtures as planned: BIAY from `app/tests/fixtures-v603/bible-folded.json` (372 entries; Day 329 today, Day 330 tomorrow, Day 323 control — all standing from leg 1); readings from the v666 `production-heads.json` capture (Nov 25, 2026 entry in a list headed by the batch-ahead Dec 31, 2026 entry); the track-draw stub is a first-draw-wins store, so an intention change can only mean an identity change.

- **Built tree: 18 ok, 0 bad.** L1 morning resolve (Day 329 / Nov 25 readings, neither stale, draw stands) · L2 completion mark via `writePodMarkQuiet` + `extRebuildDescs` rebuild and a full `buildDayFromPayload` re-run (same episode, `listened: true`, intention identical) · L3 refreshed snapshot (same identities, played, settled dress) · L4 date turn (Day 330 stands) · L5 today absent (Day 328 / Nov 24 readings, `stale: true`) and restored (stale settles stand, no mid-day upgrade).
- **Fail-on-old (scratch worktree at base `71a489a`, `ORA_WT` pointed there; removed after the run): 13 ok, 5 bad — as required.** Failing on old: L2 played-after-rebuild (both the rebuild and the full re-run checks — the row re-copies `listened: false`), L3 settled-dress check (the old tree adopts the drifted Alt Edition dress), L5 second half (both rows upgrade mid-day on restore). Passing on old, as the Plan expects: legs 1, 4, and L5's first halves.
- **Regressions:** harness-v676 on the new tree: 49 ok, 1 bad — the one failure is its own pin check (it names `ora-pro-nobis-v676-1`; the tree correctly carries the v677 pin). harness-v666 on the new tree: 62 ok, 3 not-ok — two of the three (L5 "settles to the day's own entry when the fixture restores it", R2's non-stale-after-restore card) assert the pre-v677 mid-day upgrade that §2.3.5 expressly supersedes; the third is its pin check naming `ora-pro-nobis-v673-1`, stale since before this release. No other v666/v676 check moved.

### §3.3 Deviations from Plan §2

- **Harness leg 3 fixture (named, inside §2.5's letter):** the refreshed snapshot also drifts Day 329's own dress (title + url under its stable `biy:day-329` key), beyond the Plan's literal leg-3 list (Day 330 supplier swap · Day 331 added · Day 329 listened). Reason: §2.5 names supplier-edition drift under a stable BIAY key as the risk the stored stable fields close, and without a Day-329 dress drift the leg cannot discriminate old from new (the old tree's re-match returns the same day number). The new tree holds the morning dress; the old tree adopts the drifted dress — the leg fails on old as required.
- No other deviation. The fix's code shape, seats, and scope are as §2.3 names them.

## §4 Review record (LIGHT Review, streamlined path — independent re-run)

**Verdict: PASS.** Run level To Ship — this PASS seats Ship.

### §4.1 Harness tallies (Review's own runs, not §3's word)

- **Built tree at `322e7de`, `harness-v677.mjs`: 18 ok, 0 bad.** Per leg: fixtures F 2/2 · L1 morning resolve 3/3 (BIAY `biy:day-329` not stale · readings = Nov 25, 2026 entry, not the Dec 31 head, not stale · intention draw stands) · L2 play + repaint 4/4 (same episode after `extRebuildDescs` rebuild and after a full `buildDayFromPayload` re-run, `listened: true`, intention identical) · L3 snapshot refresh 4/4 (identity holds, played, settled dress held, readings holds) · L4 date turn 1/1 (`biy:day-330` stands only at the turn) · L5 NOT-UPDATED 4/4 (Day 328 / Nov 24 readings, `stale: true`; restored mid-day, stale settles stand, no upgrade).
- **Fail-on-old (scratch worktree at base `71a489a`, harness copied in, `ORA_WT` pointed there; worktree removed after the run): 13 ok, 5 bad — legs 2 and 3 fail as required.** Failing on old: L2 played-after-rebuild (both the rebuild check and the full re-run check — row re-copies `listened: false`), L3 settled-dress check (old tree adopts the drifted Alt Edition title/url), L5 second half (both rows upgrade mid-day on restore — the v677-only assertion, expected to fail on old per Plan §2.4). Passing on old: legs 1, 4, L5 first halves, as the Plan expects. Identical to §3.2's record.
- **Regression spot-verify, `harness-v666.mjs` on the built tree: 62 ok, 3 not-ok — exactly §3.2's claim, and the 3 are exactly the superseded-behavior checks:** (1) L5 "the descriptor settles to the day's own entry when the fixture restores it" — asserts the pre-v677 mid-day upgrade that §2.3.5 deliberately supersedes; (2) R2 "non-stale daily audio card … NO warning stands" — the direct consequence of (1): the row correctly stays stale after restore, so the warning correctly stands; (3) P pin check naming `ora-pro-nobis-v673-1` — stale since before this release. No other v666 check moved. (harness-v676's 49 ok / 1 bad pin-only record in §3.2 was not re-run; its one failure is by construction — the check names the v676 pin and the tree correctly carries `ora-pro-nobis-v677-1`, confirmed in the diff.)

### §4.2 Diff-scope result (`git diff 71a489a..322e7de`)

Four files only: `app/worker/src/client.ts`, `app/worker/src/ui.ts`, `app/worker/harness-v677.mjs` (new), this doc. Client changes stand only at the four Plan seats: (1) settled store beside the played store (`OPN_DAILY_SETTLED_KEY = 'opn-daily-settled-v1'`, lazy load / save / prev-date / put helpers); (2) `resolveDailyDynamic666` settled-first read (standing copies captured as `prevRes677` before the reset; matcher runs only when a job in the group has no settled entry; settled results written via the put before the settle repaint); (3) `opnDailyMatch666` never-later guards for saint / readings / catholicsaints; (4) `podSyncQueueListened` apply list gains the `state.dailyRes666` descriptors and the settled store's stored descs, persisted in the same act. `ui.ts`: the one pin seat, `ora-pro-nobis-v677-1`. Confirmed absent: no server (`index.ts`) changes, no migration, no seat-twin or track-draw-store changes, no non-daily descriptor changes; exegesis and BIAY matchers are comment-only (never-later named, behavior unchanged).

### §4.3 Guard correctness read (one line each)

- **saint-of-the-day:** a title-prefix hit now also requires `ownChicagoDateStr(publishedMs) <= presented`, so a future-year entry with the same MM/DD prefix can never win; today's entry publishes on the presented date (`<=` holds) and still wins as the latest qualifying hit.
- **daily-readings:** exact and contains title hits now also require the parsed title date `=== presented`, so the batch-ahead head entry (title date 2026-12-31) can never match Nov 25; the Nov 25 entry's title parses to exactly the presented date and matches.
- **catholicsaints:** a title MM-DD hit now also requires the Chicago publish date `<= presented`, so a next-year same-date video is excluded; today's video (published ~02:00Z, the previous Chicago evening) carries a publish date on or before presented and still matches.
- **daily-gospel-exegesis / bible-in-a-year:** unchanged by construction — publish-date equality to presented − 1, and day-number equality to doy(presented), each exclude every later episode without a new guard.

### §4.4 Settled-store read

- **Prune:** `opnDailySettlePut677` deletes every stored date other than the presented date and its previous date at each write — current + previous only. Confirmed in code.
- **Stale settles, no mid-day upgrade:** the matcher's `stale: true` NOT-UPDATED result is written through the same put; on later resolves the settled branch rebuilds from the record and the matcher does not run for that job — proven by harness L5 second half (restored entries do not upgrade the stale rows; the same checks fail on the old tree).
- **Fresh marks, stable identity:** the settled rebuild clones the stored `desc` (title/url/duration/image/kind from the morning settle — proven by L3's dress check) and reads only `listened` / `podPositionS` fresh off the current payload entry matched by the settled key/id (`fe.listened`, `fe.positionS` when unlistened, nulled when listened), falling back to the standing copy's mark, then the stored value. Identity never changes; marks do.

### §4.5 Deviation judgment (§3.3)

**Acceptable — it strengthens the proof.** The deviation is harness-fixture only (no production-code scope change): leg 3's refreshed snapshot also drifts Day 329's own title/url under its stable `biy:day-329` key. Without that drift the leg cannot discriminate old from new — the old tree's re-match returns the same day number and the leg would pass vacuously on both trees. With it, the leg exercises exactly the §2.5 supplier-edition-drift risk that the stored stable fields (§2.3.1) exist to close, and it fails on old as required (Review's own fail-on-old run: L3 dress check FAIL, old tree standing on the Alt Edition dress). A fixture change that makes a required fail-on-old leg actually capable of failing is a proof improvement, not a weakening.

## §5 Ship record (chain-v677, 2026-11-26) — LIVE

Review PASS (§4, judged tree `322e7de`; branch head `2ffde1c` adds only the §4 doc commit). Run level: To Ship.

- **Merge:** release/v677 → main, tree-exact via the Git Data API (push-v677-github.py). Local merge `2c702d8` over v676 main `71a489a`; code paths (client.ts · ui.ts · harness-v677.mjs) asserted blob-identical to the Review-judged tree `322e7de` before anything moved; remote-vs-base delta empty (remote main `0cb8884` tree == local base tree `e8b7e92` — no runner commits to reconcile, nothing dropped, no force-push). Remote ship commit **124e6a2**, tree **d66f152**; local mirror `bc7d6c6`, same tree. Read-back: **main pushed · remote in sync**.
- **Harness at the merged tree:** `harness-v677: 18 ok, 0 bad` (standing clone, merged main) — matches the built-tree tally.
- **Deploy:** deploy-app-v677-ship.py with EXPECTED_HEAD filled to the merged main head (`bc7d6c6`); deployments → dry-run → deploy all clean. Worker **a895f5c5-24d2-4c1f-98ea-97f338224fa3**, pin **ora-pro-nobis-v677-1**. Production verification: the served sw.js (app.orapronobis.media) reads pin ora-pro-nobis-v677-1 (×1, the only pin served); the served app.js carries the settled-pick markers (`opn-daily-settled-v1` ×1 · `opnDailySettled677` ×4). No APK, no migration, no index.ts change.
- **Board closeout (D1-direct, all read back):** release 1655 → Live, shipped_at 2026-11-26T02:43:00Z, whats_new_id 492 · What's New **492** ("A daily row now keeps its episode all day") · shipped_records **866** · Ship phase record **2807** passed (commit_hash = the remote ship commit 124e6a2). Goals Board intake 1284 → Done, state line CLOSED.
- **Rollback:** pin ora-pro-nobis-v676-1 (Worker 4746a200-c7b8-462d-b885-8c75763888a7), the v676 driver (`~/workspace/.tools/deploy-app-v676-ship.py`) untouched.
- **Field check (John, standing open):** play today's Bible in a Year → the row still shows today's episode, standing played.
