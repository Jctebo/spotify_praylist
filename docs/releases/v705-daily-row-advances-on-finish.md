# v705 — Daily row advances to tomorrow's episode on finish

## §1 Grounding

### §1.1 Direction, base, field defect

- **Field defect (John, 2026-11-27 17:26 CT, verbatim):** "The next day resolved again in Bible in a year after finishing it." After finishing today's Bible in a Year episode, the daily row in today's Praylist resolved AGAIN and tomorrow's episode took its place in today's list.
- **Standing discipline broken:** v677 (the day's daily-dynamic pick settles once per Chicago date in store `opn-daily-settled-v1` and holds all day) · v694 (nothing settles until a real presented-day episode stands) · v673/v679 (a finish marks the episode played in place, everywhere). A finish must NEVER advance a daily row to the next day inside the current day.
- **Base:** `origin/main` at `2ae8e28` ("Merge release/v704 amendment into main (v704-2)"). Production pin: `ora-pro-nobis-v702-1`. v704 stands in flight in parallel on the popup content leg only; this release grounds against `origin/main` as read at Plan and touches no v704 seat. Branch `release/v705`, worktree `~/workspace/.worktrees/v705` off the one standing clone (the clone's local main checkout is dirty with unrelated changes and is untouched). Holder: chain-v705-plan.
- **All line citations** are `app/worker/src/client.ts` (client) or `app/worker/src/index.ts` (server) at base `2ae8e28` unless named otherwise.
- **Headline finding, stated up front:** the v666/v677 daily seat is INNOCENT — proven seat by seat in §1.2 and §1.4. The advance enters through a different door: John's Bible in a Year row is carried in his effective profile as a **`course` contents item**, and the course resolver's pick is the payload's **`currentKey` — the first UNLISTENED episode**. The finish writes the listen; the next compose re-picks by that derivation; tomorrow's episode stands in today's list. The mechanism is proven in §1.3.

### §1.2 The completion state path — a finish triggers no recompose and no re-resolve

Traced end to end in the shipped code:

1. **The ended seam.** `markCompleted(desc)` (client:5383) is the only completion writer. For a podcast descriptor it routes at once: `writePodMarkQuiet(desc.seriesKey, desc.podSeries, 'auto')` (client:5400) and returns — no day-store write, no rebuild call.
2. **The native drain.** `drainNativeCompletions()` (client:20645) resolves each stored native completion record to its standing descriptor; a resolved podcast descriptor takes the same seam — `writePodMarkQuiet(desc.seriesKey, desc.podSeries, 'auto')` (client:20730). Non-podcast records keep the day-store write. The drain fires at standing moments only (day stand, foreground return, day paint — client:6746, 6961, 23212) and calls nothing that recomposes a row's identity.
3. **The mark write.** `writePodMarkQuiet(seqKey, seriesKey, source)` (client:9665): posts `POST /api/player/podcasts/mark` (fire-and-forget, offline-enqueue on failure) · drops the position slot (`podPosSlotDrop`) · folds the listen into the OPEN series payload only when that payload is this series (client:9687 ff; for kind `rss` the `currentKey` recompute expressly stands down, client:9694) · calls `podSyncQueueListened(seriesKey, seqKey, true)` · in device/web mode folds the on-device core (`opnPodCoreSetListen`) and re-projects the open series payload only · `refreshPlayedChrome()`. **No call in this function rebuilds the day, re-runs any resolver, or touches the settle store's records' identities.**
4. **The v677 sync.** `podSyncQueueListened(series, seqKey, on)` (client:9607) flips `listened` on every standing copy keyed (podSeries, seriesKey) — queue, current, preview, `state.dayDescs` — and, per v677 §2.3.4(ii), on the settled copies: the `state.dailyRes666` descriptors (`applyDaily677`, client:9645 ff) and **the settle store's stored `desc.listened`** (client:9651–9662, saved via `opnDailySettledSave677()`). It flips a flag in place; it deletes nothing, overwrites no `episodeId`, and writes no new settle record.
5. **Verdict on the completion path:** nothing in the finish path triggers a recompose or a re-resolve of any daily item, and nothing in it overwrites `opn-daily-settled-v1` except the in-place `listened` flip on the settled descriptor copy — which is the v673/v679 "played in place" discipline working as designed. **The advance therefore cannot come from the finish act itself; it must come from a pick rule that reads the listened state the finish wrote, at the next standing compose.** §1.3 names that pick rule.

### §1.3 The pick rule on a played settled episode — the course seat's first-unlistened derivation

**The daily seat's own rule first (for contrast, proven in §1.4):** `resolveDailyDynamic666` never reads listened state to pick. The advance's pick rule stands in the sibling resolver:

1. **The course resolver.** `resolveProfileCourses590(day)` (client:21139) resolves each `course` contents item "to the course's next episode BY THE USER'S OWN PROGRESS" (its header, client:21140 ff). The pick, verbatim in effect (client:21164): `var curKey = payload.currentKey || opnPodCurrentKey(payload.entries);` — the payload's current pointer, else the client derivation.
2. **The client derivation is first-unlistened.** `opnPodCurrentKey(entries)` (client:2491) returns the key of the first entry that is not listened (a `bonus` only when no unlistened day entry stands — the loop at client:2495 ff).
3. **The server derivation is the same rule.** For a sequence-kind series, `podPayload` (server) folds `podcast_listens` over the snapshot entries and derives (index:3798): `const current = entries.find((e) => !e.listened && e.kind !== "bonus") ?? entries.find((e) => !e.listened);` — the lowest-position unlistened day entry, served as `currentKey`. Bible in a Year is a sequence-kind series (its def stands at index:3556, key `bible-in-a-year`, prefix `biy`; entries keyed `biy:day-N` carrying `day`, built from the standing `rss_snapshots` sequence). **The moment today's episode stands listened in `podcast_listens` — the finish's own server write — the payload's `currentKey` IS tomorrow's episode.** Any compose after the finish re-picks it. No date is consulted anywhere in this derivation.
4. **How John's row comes to stand at the course seat.** Bible in a Year stands in BOTH closed sets: `OPN_DAILY_SERIES_666` (client:2861) and `OPN_COURSE_KEYS_603 = ['catechism-in-a-year', 'bible-in-a-year', 'rosary-in-a-year', 'summa-in-a-year']` (client:2840). The v609 profile migration, `opnMigrateProfileRecord609(rec, sections)` (client:2977), converts a profile's Podcasts-layer series into contents items: `daily-readings` becomes a `seat` item in Morning; **every other layer series — Bible in a Year among them — becomes a `{ kind: 'course', key }` item in the Night block** (client:3009–3014), unless the series already carries a source-settings row. John's standing profile is The Salesian Way, whose designed layer carries `series: ["bible-in-a-year", "exorcist-files", "daily-gospel-exegesis", "daily-readings"]` (server DESIGNED_PROFILES_591, index:1609; the client's seed carries the same shape). The Add ladder independently offers Bible in a Year as a course item (client:27717). A `daily` item for the same series exists only when the row is born through the daily ladder arm (client:27736) — not the birth John's row had.
5. **The composed row follows the course map.** `extRebuildDescs`' course fold places `state.courseRes590[block + ':' + key]` at the item's contents position; the daily fold reads `state.dailyRes666` only for `kind: 'daily'` items. A course-carried Bible in a Year row therefore never passes through the settle store at all — **the compose path bypasses `opn-daily-settled-v1` entirely for this row**, not by overwriting it but by never reading it.
6. **The field sequence, assembled:** morning compose → course pick = today's episode (Day 331 on 2026-11-27, the first unlistened day entry) → John finishes it → `writePodMarkQuiet(..., 'auto')` writes the listen server-side and flips the standing copies played in place (the row paints played, correctly) → the next standing compose re-runs `resolveProfileCourses590`, re-fetches the series payload, reads the new `currentKey` = Day 332 → the row in today's list now stands tomorrow's episode. Exactly John's report: "the next day resolved again … after finishing it."

### §1.4 The daily seat itself is innocent — the settled pick already holds over a played episode

For a row carried as a true `daily` item, the shipped resolver already does what the discipline requires — proven from `resolveDailyDynamic666(day)` (client:21549):

- The settle store is read FIRST (client:21624): `settledRaw677 = (opnDailySettled677()[presented] || {})`, with the v694 migration filter dropping any `stale: true` record. The matcher runs ONLY when some job in the series group stands unsettled (client:21628): `var m = anyUnsettled677 ? opnDailyMatch666(series, list, presented) : null;`.
- A settled job rebuilds its descriptor from the stored record (client:21635 ff): identity (`episodeId`, title, url) from the stored `desc`; `listened` read fresh as `!!((fe && fe.listened) || (prevD && prevD.listened) || rec.desc.listened)` — **a played settled episode rebuilds AS today's episode, painted played**. The matcher is never consulted for it, so its played state cannot move the pick.
- The matcher itself is date-keyed and never listened-keyed: `opnDailyMatch666(series, list, presented)` (client:21432) — for `bible-in-a-year`, `e.day === opnDailyDoy666(presented)` exactly (client:21485 ff), hit-only since v694 (every fallback arm deleted). It cannot return tomorrow's episode for today's presented date, played or not.
- Nothing overwrites the store against a settled day: the only writers are `opnDailySettlePut677(presented, jobKey, ...)` (client:5286, called from the resolver's unsettled arm only, client:21678) and the in-place `listened` flip of §1.2 step 4. The put's prune keeps the presented + previous dates and its v694 purge drops only `stale: true` records for the date being written.
- **Standing harness proof of this seat:** harness-v677 leg 2 drives `writePodMarkQuiet` + a full `buildDayFromPayload` re-run on a `daily`-carried Bible in a Year row and the row holds `biy:day-329`, played, intention unchanged (standing tally 18 ok / 0 bad, §2.4). The seat passes in the harness's world because the harness's fixture carries the item as `kind: 'daily'` — the one shape John's profile does NOT carry it in. That fixture gap, not the daily seat, is what let this defect ship past the harness line (Improvement D: the fixture must match John's exact real case — here, the item's real contents kind).

### §1.5 The class — verdict per series

The defect class is **not** "daily series" and **not** Bible-in-a-Year-specific. It is: **any series whose Praylist row is carried as a `course` item AND whose payload `currentKey` is the first-unlistened derivation (sequence kind)**. Verdicts over the closed daily set `OPN_DAILY_SERIES_666` (client:2861), from the pick rule's shape:

| Series | Payload kind / `currentKey` rule | Carried as | Advance on finish? |
|---|---|---|---|
| `bible-in-a-year` | sequence — `currentKey` = first unlistened day entry (index:3798) | `course` (v609 migration of the Salesian layer; Add-ladder course arm) — also addable as `daily` | **YES — the field defect.** As a `daily` item: NO (settle-held, §1.4) |
| `saint-of-the-day` | RSS — `podRssPayload` sets `current = entries[0]`, the latest; "marks never move it" (index:4530 ff) | seat/source twin + `daily` | NO — no listened-keyed pick stands on any of its seats |
| `daily-gospel-exegesis` | RSS — same latest-only `currentKey` | `day` item (v611, date-keyed presented−1) · `daily` · also course-eligible via the same migration | NO advance on finish — its seats are date-keyed or latest-pinned, never progress-keyed. (A course-carried exegesis row stands at the latest entry, a separate standing shape; the §2.1 fix brings a daily-set key at the course seat under the daily discipline whole, §2.2) |
| `daily-readings` | RSS — latest-only `currentKey` | `seat` item (migration's named exception) · `daily` | NO |
| `catholicsaints` (Catholic Saints & Feasts VIDEO) | video payload (`videos`, no `entries`) | `daily` only — the course resolver reads `payload.entries` and cannot carry it | NO |
| `fr-mike-homilies` · `barron-sunday-sermons` (v699 widening) | RSS — latest-only `currentKey` | `daily` (homily arm: newest published on/before presented) | NO |

- **Wider course-set note:** `catechism-in-a-year`, `rosary-in-a-year`, `summa-in-a-year` (the rest of `OPN_COURSE_KEYS_603`) are sequence series whose course rows DO advance on finish — but they stand in no daily set, and "next episode by your progress" is the course kind's own designed discipline for them (v590/v603). They are NOT in this release's scope; §2.1's fix keys on membership in `OPN_DAILY_SERIES_666`, so their behavior is untouched.
- **One-line class verdict:** exactly one shipped combination advances a daily row on finish — a daily-set series carried at the course seat over a sequence payload — and Bible in a Year is its only current field instance.

### §1.6 Fixture case (as briefed, grounded)

- Bible in a Year: the series stands in `rss_snapshots` (sequence build, index:3556 def; payload served by `podPayload` with the `podcast_listens` fold). The row is a contents item of the closed daily set `OPN_DAILY_SERIES_666` — **with the §1.3 correction to the brief's framing: in John's effective profile the item's kind is `course`, not `daily`**, and that kind is the defect's whole mechanism. Implement's first act (§2.3, capture step) reads John's effective profile contents from production and names the kind on the record before the harness fixture is frozen; the harness fixture (§2.3) carries the item in that proven kind.

## §2 Plan

### §2.1 THE FIX — the settled pick holds at the course seat for daily-set series

**Prescribed rule (the settle seat's discipline, carried to the one seat that lacks it):** when a `course` contents item's key stands in `OPN_DAILY_SERIES_666`, the item is a daily row wherever it stands, and it resolves under the v677/v694 daily discipline — **the settled pick holds for the whole Chicago day regardless of played state; finishing paints it played in place; tomorrow's episode first stands at tomorrow's compose.** No other course item changes its pick.

**The seat: `resolveProfileCourses590(day)` (client:21139), one new arm, ahead of the standing progress pick:**

1. **Daily-set arm first.** For a job with `opnDailyKeyOk666(job.key)`: read the settle store first, in `resolveDailyDynamic666`'s exact shape — `opnDailySettled677()[presented]`, the v694 stale-record filter applied, `presented = day.presentedDay || day.date`, the job keyed `job.block + ':' + job.key` (the same key form the daily seat writes, so a series standing as both kinds in one block shares the one settled pick, never two).
2. **Settled → rebuild in place.** A settled record with a `desc` rebuilds the descriptor exactly as the daily seat's settled arm (client:21635 ff): identity from the stored desc, `listened` fresh off the current payload entry / the standing copy / the stored desc, `podPositionS` nulled when listened. The descriptor stands in `state.courseRes590[jobKey]` carrying `course590: true` (the fold's standing mark) plus `daily666: true` + `dailySeries: job.key`. The progress pick (`currentKey` / `opnPodCurrentKey`) is never consulted for this job.
3. **Unsettled → the daily matcher, hit-only.** No settled record: run `opnDailyMatch666(job.key, list, presented)` over the fetched payload's list (`payload.entries`; for `catholicsaints` the arm never reaches here — a video payload carries no `entries` and the course resolver already returns on that shape, unchanged). A hit builds the descriptor in the daily seat's matcher shape (client:21661 ff, podcast arm) and settles it through `opnDailySettlePut677(presented, jobKey, episodeId, false, desc)` BEFORE the rebuild repaint — the v677 write-before-repaint order.
4. **Null match → the v694 placeholder, unchanged shape.** No presented-day entry on a LOADED payload: stand `opnDailyPlaceholder694(job.key, job.block, payload.showImageUrl)` in `state.courseRes590[jobKey]` (with `course590: true` added) and write NOTHING to the settle store — the day stays unsettled, the next standing compose re-runs the matcher, and the real episode settles when it lands. A failed payload load resolves nothing that build (the resolver's standing rule). **No change to the v694 not-available shape; no change to what settles on a fresh day** — a fresh date finds no record under its key, the matcher runs, the day's own episode settles.
5. **Played in place, by the standing sync.** The finish needs no new code: `podSyncQueueListened`'s apply (client:9621 ff) flips every `state.dayDescs` copy keyed (podSeries, seriesKey) — the course descriptor carries `podSeries: job.key` + `seriesKey: e.key`, so the composed copy flips in the same act as today — and the settled rebuild (step 2) reads the listen fresh at every later compose, so the row stands played under its settled identity for the rest of the day. Its queue behavior is the course seat's standing behavior (the descriptor shape is unchanged but for the two daily marks).

**Why this seat and not the migration seat (named and rejected):** repairing `opnMigrateProfileRecord609` to emit `kind: 'daily'` for daily-set keys does not fix the field — mig609 is spent on John's stored record (the layer already stands emptied, client:3016 ff), so the stored `course` item would stand unconverted forever; and the Add ladder's course arm (client:27717) would still birth the defect on any later add. The resolver seat governs the row by its series, however the item was born or stored. No stored-profile rewrite, no migration, no server change.

### §2.2 Exact code seats the fix touches

| Seat | Change |
|---|---|
| `resolveProfileCourses590` (client:21139) | The §2.1 daily-set arm: settle-store read, settled rebuild, `opnDailyMatch666` unsettled pick, `opnDailySettlePut677` write, `opnDailyPlaceholder694` on null — for `opnDailyKeyOk666(job.key)` jobs only. The standing progress pick below it is untouched and unreachable for those jobs. |
| `app/worker/harness-v705.mjs` | NEW — §2.3. |
| This doc | §§3–5 at Implement / Review / Ship. |

**Named non-seats (no change, by name):** `resolveDailyDynamic666` · `opnDailyMatch666` · `opnDailySettlePut677` / `opnDailySettled677` / the `opn-daily-settled-v1` shape · `opnMigrateProfileRecord609` · `writePodMarkQuiet` · `podSyncQueueListened` · `markCompleted` · `drainNativeCompletions` · `resolveExegesisDay611` · `resolveMassDynamic688` and the `opn-mass-settled-v1` store · the server whole (no route, no payload, no migration — `podPayload`'s `currentKey` derivation stands; it remains the Podcasts page's and the non-daily courses' progress pointer) · the v694 placeholder paint and counts/queue discipline (the placeholder reaches the course fold in its standing shape; `extRebuildDescs`' course fold places it unchanged).

**Scope guard:** the arm keys ONLY on `OPN_DAILY_SERIES_666` membership. `catechism-in-a-year` · `rosary-in-a-year` · `summa-in-a-year` · `exorcist-files` course rows keep the progress pick byte-identical — a finish there still advances to the next episode, by the course kind's design.

### §2.3 Harness prescription — `harness-v705.mjs`

Modeled on harness-v677 (playwright-core Chromium, the real built Worker bundle served locally, the API stubbed in-page, `ORA_WT` selecting the tree for the fail-on-old run).

**Fixture — the real Bible in a Year snapshot window from production (Improvement D; the production source is named, never invented):**

- **Capture (Implement's first act, before the fixture freezes):** (a) read John's effective profile from production and name the Bible in a Year item's contents kind + block on the record — §1.3 predicts `course` in Night; the fixture carries the item in the PROVEN kind; (b) capture the production series payload `GET /api/player/podcasts?series=bible-in-a-year` (the sequence payload over `rss_snapshots`: entries keyed `biy:day-N` carrying `day`, `kind`, `label`, title, url, and the `podcast_listens` fold) and freeze a window of it as the fixture file: the presented day's entry, the day before, **tomorrow's entry**, one further day, and any bonus/special entries standing in the window — real keys, real titles, real urls as captured. The harness pins its presented date to the captured window's today (doy = that entry's `day`), so the legs run on production identities, not stand-ins.
- **The stub must reproduce the server's derivation honestly, or the defect leg cannot fail on old:** the in-page series stub recomputes `currentKey` on every read exactly as `podPayload` does (index:3798 — first unlistened non-bonus entry over the stub's listen fold), and the mark stub (`POST /api/player/podcasts/mark`) flips the named entry's `listened` in that fold. This is the one stub rule the whole harness turns on; a stub that serves a frozen `currentKey` proves nothing.
- **Second-series fixture:** Daily Gospel Exegesis from the standing production capture pattern (`app/worker/v666-fixtures/production-heads.json` carries the RSS heads shape) — refreshed from the same production read session as the Bible capture: the presented−1 day's entry, a LATER entry standing at the list head (the latest, which the old course pick would take), and one older entry.

**Legs:**

1. **Settle a day.** Compose the pinned presented day with the Bible in a Year item in its proven kind → the row stands today's entry (`biy:day-<doy>`), not stale, and a record for (presented, block:series) stands in `opn-daily-settled-v1`.
2. **Finish + recompose (the defect leg — MUST FAIL on the pre-v705 tree).** Drive the finish through the standing completion path — `writePodMarkQuiet('biy:day-<doy>', 'bible-in-a-year', 'auto')`, the `markCompleted` seam's own call — then a full `buildDayFromPayload` re-run against the stub payload whose `currentKey` now derives to tomorrow. Assert: the row still stands `biy:day-<doy>`, `listened: true` (painted played in place), title/url = the settled morning dress. On the old tree this leg reads `biy:day-<doy+1>` and fails.
3. **Second daily series, same leg.** The exegesis item carried at the course seat in the same profile fixture: settle → its row stands the presented−1 day entry (the daily matcher's own hit — NOT the list head the progress pick takes; this half also fails on old) → finish through `writePodMarkQuiet(..., 'auto')` → recompose → the row still stands the same entry, played.
4. **Fresh day still settles its own episode.** Turn the presented date +1 → the row settles and stands `biy:day-<doy+1>` under the new date (and leg 3's series settles its new presented−1 entry). Tomorrow's episode first stands HERE — at tomorrow's compose, never at today's finish.
5. **Not-available holds (v694 shape at the new seat).** A fresh world where the payload window lacks the presented day's Bible entry → the row stands the v694 placeholder (`seg:unavailable-v694-bible-in-a-year`, `available: false`, `stale: false`) and NO settle record stands for the date; restore the entry → the next compose settles and stands it.

### §2.4 Regressions (standing tallies, named)

- **harness-v677: 18 ok / 0 bad** — must stand (its `daily`-carried legs are untouched; the re-pointed L5 not-available shape stands).
- **harness-v694: 26 ok / 0 bad** — must stand (no v694 seat moves; §2.3 leg 5 extends its shape to the course seat, it does not alter it).
- **harness-v666: 64 ok / 0 not-ok** — must stand.
- harness-v705 itself: fail-on-old proven by running the committed harness with `ORA_WT` pointed at the base tree (`2ae8e28`) — legs 2 and 3 fail there, all legs pass on the built tree.

### §2.5 Out, named

- No fix to the daily seat — it is proven innocent (§1.4); touching it risks the v677/v694 line for no defect.
- No change to the course progress pick for any series outside `OPN_DAILY_SERIES_666`.
- No stored-profile conversion, no mig610, no server change, no APK work, no new timer/poll/fetch — the fix rides the standing compose points only.
- The Podcasts page's own "current episode" pointer (server `currentKey`) is a catalog surface, not a Praylist row; it keeps its progress meaning and is out of scope.

## §3 Implement record

- **Holder:** chain-v705-impl · **Date:** 2026-11-27 17:37 CT · **Branch:** `release/v705` at base `2ae8e28`. Commits: `f30c569` (fix + pin + fixtures) · `14cf99e` (harness). Not merged, not deployed — Ship is a separate seat.

### §3.1 First act — the kind re-verification (Plan §2.3 capture step a; §1.6's named deviation check)

**Verdict: §1.3's prediction CONFIRMED — John's Bible in a Year item stands as kind `course` in Night. No deviation.** The profiles document itself is device-local personal data (no server copy stands to read), so the verification reads the production server record the device document is built from, plus the one deterministic conversion that shapes it:

- **Standing pick (production D1 `ora-pro-nobis-app`, `prayer_profile_state` id=1):** `standing_key = 'salesian'`, `today_edits = NULL`; no `prayer_profile_day_picks` row for 2026-11-27 — the effective profile for the field day is The Salesian Way, unedited.
- **The stored record (D1 `prayer_profiles`, key `salesian`):** Podcasts layer ON, series `["bible-in-a-year", "exorcist-files", "daily-gospel-exegesis", "daily-readings"]` — the designed layer of §1.3 step 4, as stored in production.
- **The mig609 exception does not apply (D1 `player_source_settings`):** the ONLY source-settings row among the layer's series is `daily-gospel-exegesis` (external, Midmorning, enabled). No row stands for `bible-in-a-year`, so mig609's "already carries a source-settings row" exception cannot fire for it.
- **The conversion (client `opnMigrateProfileRecord609`, base lines 3009–3014):** every non-`daily-readings` layer series without a source row becomes `{ kind: 'course', key }` in **Night** — Bible in a Year among them, deterministically.
- **Corroboration that the derivation is live in production:** the captured series payload (§3.3) serves `currentKey: biy:day-322`, and D1 `podcast_listens`' latest Bible row is `biy:day-321` (2026-11-20, source `auto`) — the served pointer is exactly the first-unlistened derivation of §1.3 step 3 over the production fold.

The harness fixture therefore carries the item as `{ kind: 'course', key: 'bible-in-a-year' }` in Night — the proven kind.

### §3.2 The fix (Plan §2.1–2.2, the one prescribed seat)

- **`resolveProfileCourses590` (client.ts)** gains the daily-set arm, keyed only on `opnDailyKeyOk666(job.key)`, ahead of the standing progress pick (which is untouched and unreachable for those jobs): settle-store read first in `resolveDailyDynamic666`'s exact shape (`opnDailySettled677()[presented]`, v694 stale-record filter, job keyed `block + ':' + key`); a settled record rebuilds in place (identity from the stored desc; `listened` fresh off the current payload entry / the standing course copy / the stored desc; `podPositionS` nulled when listened) carrying `course590: true` + `daily666: true` + `dailySeries`; on unsettled, `opnDailyMatch666` hit-only over `payload.entries` and `opnDailySettlePut677(presented, jobKey, episodeId, false, desc)` BEFORE the rebuild repaint; on null, `opnDailyPlaceholder694(...)` with `course590: true` added and NOTHING settled. One supporting capture: `prevCourse705` snapshots `state.courseRes590` before its reset (the daily seat's `prevRes677` discipline) as the standing-copy listened read. A `catholicsaints` job never reaches the arm — its video payload carries no `entries` and the resolver's standing return stands, unchanged.
- **Build pin:** `ora-pro-nobis-v704-2` → `ora-pro-nobis-v705-1` at the standing pin seat (`app/worker/src/ui.ts`, the service-worker `CACHE` name — the seat v702/v704 bumped).
- **Named non-seats untouched, verified by the diff:** `resolveDailyDynamic666` · `opnDailyMatch666` · the settle store and its shape · `opnMigrateProfileRecord609` · `writePodMarkQuiet` · `podSyncQueueListened` · `markCompleted` · `drainNativeCompletions` · the server whole · the v694 paint. Whole-branch diff vs base (excluding the Plan commits): client.ts +67 · ui.ts 1 line · harness + fixtures new.

### §3.3 Fixture provenance (Plan §2.3 capture step b; Improvement D)

- **Source:** `GET https://app.orapronobis.media/api/player/podcasts?series=bible-in-a-year` and `…?series=daily-gospel-exegesis`, read live from production 2026-11-27 (America/Chicago); both returned HTTP 200 complete on the first attempt (no truncation retry was needed).
- **`app/worker/v705-fixtures/bible-window.json`:** the sequence window frozen from that payload — the two bonus entries standing at the list head as captured (`biy:bonus-bringing-the-bible-back-eea2e6fd`, `biy:bonus-how-to-hear-god-86cbbcdd`), Day 330 "Saul's Conversion", **Day 331 "Peter Preaches to the Gentiles" (presented 2026-11-27, doy 331)**, Day 332 "Barnabas and Paul On Mission" (tomorrow), Day 333 — real keys, titles, urls, durations as captured. The harness pins its presented date to 2026-11-27 (doy 331) and seeds Day 330 as listened in the stub fold (production truth at capture: yesterday's episode already stands listened), so the old tree's morning pick is Day 331 exactly as in the field.
- **`app/worker/v705-fixtures/exegesis-head.json`:** the RSS head as captured — Nov 27, 2026 entry at the head (the latest; the old course pick's `currentKey`), Nov 26 (the presented−1 matcher hit; key `9f58950b-75ec-42c5-bab0-d5b9d5b735c1`), Nov 25, Nov 24.
- **The stub rule stands as prescribed:** the in-page stub recomputes `currentKey` on EVERY read — sequence: first unlistened non-bonus over the stub's listen fold (server index:3798's rule); RSS: the latest entry — and the mark stub flips the named entry's `listened` in that fold.

### §3.4 Harness tallies

- **harness-v705, built tree: 16 ok / 0 bad** — all five legs: settle + record at the course seat (both series) · finish via `writePodMarkQuiet(..., 'auto')` + full `buildDayFromPayload` recompose holds Day 331 played in place with its settled dress · exegesis settle stands the presented−1 entry (not the list head) and holds it through its finish · the 2026-11-28 turn settles Day 332 and the Nov 27 exegesis entry under the new date · the v694 placeholder stands at the new seat with nothing settled, and the landing entry settles on the next compose.
- **Fail-on-old (`ORA_WT` at base `2ae8e28`): 7 ok / 9 bad — legs 2 and 3 FAIL as prescribed.** Leg 2's old-tree row reads **`biy:day-332`** after the finish (the field defect reproduced exactly); leg 3's settle stands the Nov 27 list head instead of the presented−1 entry, and its finish leg fails with it; the settle-record checks fail (the old seat never writes the store).
- **Regressions:** harness-v677 **18 ok / 0 bad** ✔ stands · harness-v694 **26 ok / 0 bad** ✔ stands · harness-v666 **cannot be re-run in this seat — pre-existing harness rot, named as a deviation below**.

### §3.5 Deviation — harness-v666 does not run at base or at this tree

- harness-v666 aborts before its first leg on BOTH the base tree (`2ae8e28`, via `ORA_WT`) and the v705 tree, with the identical error: its `stripServerValidate` exact-string extraction no longer matches `validateProfileContents` in `index.ts` — the server signature was widened after the harness was written (it now carries `off?: number; dayRule?: string` in its normalized item shape, the v686/v690-era shape), and the harness throws `server validate shape moved` at startup.
- This failure is byte-identical with and without the v705 change, and v705 touches no seat the harness's strip reads (the fix is client.ts-only; `index.ts` is untouched). The 64 ok / 0 not-ok tally therefore stands **unre-proven, not regressed**: no v666 leg result differs between base and this tree because neither run reaches a leg. Repairing the harness's strip strings is outside §2.2's named seats and was NOT done in this seat; it is named here for the Review seat / a harness-maintenance follow-up.

## §4 Review verdict

- **Holder:** chain-v705-review · **Date:** 2026-11-27 · **Verdict: PASS.** No defects found. Light review — independent verification only; the fix was not changed.

### §4.1 Diff scope — clean, no extra touch

- Whole-branch diff vs base `2ae8e28` (Implement commits `f30c569` · `14cf99e` · `75ca1f2` over the Plan commits): exactly six files — `app/worker/src/client.ts` (+67) · `app/worker/src/ui.ts` (1 line) · `app/worker/harness-v705.mjs` (new) · `app/worker/v705-fixtures/bible-window.json` + `exegesis-head.json` (new) · this doc.
- `client.ts`: both hunks stand inside `resolveProfileCourses590` only — the `prevCourse705` capture before the `state.courseRes590` reset, and the daily-set arm ahead of the standing progress pick. No other function is touched.
- `ui.ts`: the pin line only — `ora-pro-nobis-v704-2` → `ora-pro-nobis-v705-1` (service-worker `CACHE` name).
- Named non-seats byte-untouched, verified from the diff: `resolveDailyDynamic666` · `opnDailyMatch666` · `writePodMarkQuiet` · `podSyncQueueListened` · `markCompleted` · `drainNativeCompletions` (both mark seams and the whole completion path) · the server `app/worker/src/index.ts` (diff = 0 lines) · the v694 paint / `opnDailyPlaceholder694` · `opnMigrateProfileRecord609` (mig609).

### §4.2 Independent re-runs (Review seat, this tree unless named)

- **harness-v705, new tree: 16 ok / 0 bad** — matches §3.4.
- **Fail-on-old, `ORA_WT` at base `2ae8e28`: 7 ok / 9 bad** — legs 2 and 3 fail as prescribed: leg 2's post-finish row reads **`biy:day-332`** (the field defect reproduced exactly), leg 3's settle stands the Nov 27 list head instead of the presented−1 entry and its finish leg fails with it; the settle-record checks fail with them (the old seat never writes the store).
- **harness-v677: 18 ok / 0 bad** ✔ stands.
- **harness-v694: 26 ok / 0 bad** ✔ stands.

### §4.3 harness-v666 claim — verified

- harness-v666 run by this seat on BOTH trees (new tree directly; base tree via `ORA_WT` at `2ae8e28`): both runs pass the same 5 fixture checks, then abort at startup in `stripServerValidate` with the identical error — `server validate shape moved: function validateProfileContents(contents: unknown, coreBloc…` — before any leg runs.
- The abort is therefore pre-existing and identical with and without the v705 change (v705 touches no seat the strip reads; `index.ts` is untouched). The standing **64 ok / 0 not-ok tally stands unre-proven, not regressed** — §3.5's claim is accurate. Harness-strip repair remains a separate maintenance follow-up, outside this release's seats.

### §4.4 Fix soundness — read of the arm (client.ts, `resolveProfileCourses590`)

- **Settle store first, stale filter applied:** the arm reads `opnDailySettled677()[presented]` and drops `stale: true` records before any pick — the daily seat's exact shape; job keyed `block + ':' + key`, the same key form the daily seat writes.
- **Settled → rebuild in place:** identity from the stored desc; `listened` read fresh as payload entry OR standing course copy (`prevCourse705`) OR stored desc; `podPositionS` nulled when listened. The descriptor carries `course590: true` + `daily666: true` + `dailySeries`. The progress pick (`currentKey` / `opnPodCurrentKey`) stands below the arm's `return` and is never consulted for these jobs.
- **Unsettled → hit-only settle:** `opnDailyMatch666` over `payload.entries`; on a hit the descriptor is built in the daily seat's matcher shape and `opnDailySettlePut677` writes BEFORE `extRebuildDescs` / the repaint — the v677 write-before-repaint order.
- **Null → placeholder, nothing settled:** `opnDailyPlaceholder694(...)` with only `course590: true` added; no settle write. The v694 not-available shape is unchanged (its paint function is untouched).
- **Class coverage:** the arm keys only on `opnDailyKeyOk666(job.key)` — `OPN_DAILY_SERIES_666` membership — so a finish can no longer move the pick for ANY daily-set series carried as a course item, whatever block it stands in; non-daily course keys (`catechism-in-a-year` · `rosary-in-a-year` · `summa-in-a-year` · `exorcist-files`) keep the progress pick byte-identical. A `catholicsaints` job never reaches the arm (its video payload carries no `entries`; the resolver's standing return above the arm stands).
- **Fresh day unchanged:** a new presented date finds no record under its key, the same hit-only matcher runs, and the day's own episode settles — proven by harness leg 4 (2026-11-28 settles `biy:day-332` and the Nov 27 exegesis entry under the new date). No change to what settles on a fresh day.

### §4.5 §3 accuracy

- **Tallies:** every §3.4 tally matches this seat's independent re-runs (§4.2, §4.3).
- **Fixture provenance:** the frozen fixture files match §3.3 on the record — `bible-window.json` carries the two captured bonus entries at the head, Day 330 "Saul's Conversion", Day 331 "Peter Preaches to the Gentiles" (presented 2026-11-27, doy 331), Day 332 "Barnabas and Paul On Mission", Day 333, with real keys/titles/urls; `exegesis-head.json` carries the Nov 27, 2026 entry at the head and the Nov 26 presented−1 entry under key `9f58950b-75ec-42c5-bab0-d5b9d5b735c1`, then Nov 25 / Nov 24. The harness stub's honest `currentKey` recomputation is what makes the fail-on-old leg bite (§4.2).
- **Kind re-verification:** §3.1's conclusion — Bible in a Year stands as `course` in Night — is consistent with the production records it names (Salesian standing pick, stored layer series, no `bible-in-a-year` source-settings row) and with the mig609 conversion code read by this seat at the untouched seat: every non-`daily-readings` layer series without a source row becomes `{ kind: 'course', key }` in Night. The production D1 reads themselves stand as Implement's record; the code leg of the chain was re-read here and holds.

## §5 Ship record

**Shipped LIVE at pin `ora-pro-nobis-v705-1` — 2026-11-28.**

Ship seat: chain-v705-ship (completion seat, seated after the execution-risk stop recorded in §5.4; Ship contract 1275).

### §5.1 Direction

- Field report (John, 2026-11-27 17:26 CT, verbatim): **"The next day resolved again in Bible in a year after finishing it"** — with a screenshot of the day's Praylist (Afternoon card: the Bible in a Year row "Day 325: Boldness in Faith · 25:12"). Run level: **To Ship.**

### §5.2 Review verdict

- **§4 Review: PASS** (chain-v705-review; harness-v705 **16/0** · fail-on-old **7 ok / 9 bad** — leg 2's post-finish row reads `biy:day-332` on the old tree, the field defect reproduced exactly · harness-v677 **18/0** · harness-v694 **26/0** · harness-v666 cannot execute — the identical `stripServerValidate` startup abort on base and new tree (pre-existing rot, `index.ts` untouched); its standing 64/0 tally stands unre-proven, not regressed).

### §5.3 Merge (tree-exact, Git Data API)

- Queue check found v704 already shipped (served pin `ora-pro-nobis-v704-2`); base re-derived to `3b3e7cb` (v704's §5 commit).
- Merge commit: **`bbaf04ad08c7e00ef8bcb6a1cedcb8a73d09a097`**, tree **`a34c991228e45a1647be207ca43e3657bbab9c54`** — every v705 delta blob asserted; the only difference from the branch tree is the v704 doc at its shipped §5 blob. Never force-pushed; the release branch stays local.
- Read back at merge time: **main pushed · remote in sync.**

### §5.4 The execution-risk stop and John's approval

- The first Ship seat created the ship worktree `~/workspace/.worktrees/v705-ship-main` at `bbaf04a` and drew the **execution-risk notice**; per the clone note it **stopped and named it** — no deploy, no closeout. Contract 1275's merge expectation was judged **met**; the deploy and closeout expectations stood open. Production kept serving `ora-pro-nobis-v704-2`.
- John gave the chain-specific word (2026-11-27 18:03 CT, verbatim): **"Approved — process the standing clone for v705 as usual"** — with the standing approval (John, 2026-11-21, AGENTS.md). A completion seat under the same holder name `chain-v705-ship` took the ship from the standing worktree.

### §5.5 Deploy

- Deploy driver `~/workspace/.tools/deploy-app-v705-ship.py`, `EXPECTED_HEAD = bbaf04ad08c7e00ef8bcb6a1cedcb8a73d09a097`; dry-run passed first, then deploy from the ship worktree at the merge head.
- Worker **`ora-pro-nobis-app`** · version ID **`9528b803-95c2-4b75-8971-ee34616945c6`** · deployment created **2026-11-28T00:04:36.705Z** · **100%**.

### §5.6 Production verification (from served bytes)

- Served `sw.js` reads **`ora-pro-nobis-v705-1`**.
- Served `app.js` carries **`prevCourse705`** (×2) and **`opnDailyKeyOk666(job.key)`** (×1) — the v705 daily-set arm inside `resolveProfileCourses590`.

### §5.7 Board closeout

- **What's New id 520**: "Fixed: finishing today's Bible in a Year (or another daily episode) no longer swaps in tomorrow's episode — today's row stands, marked played, for the rest of the day."
- **Releases row 1683**: status **Live** · `shipped_at` = 2026-11-28T00:04:36Z (the deploy timestamp) · `whats_new_id` = 520. Read back.
- **shipped_records id 894**: project 3 · version v705 · title "Daily row advances to tomorrow's episode when today's is finished (Bible in a Year field report)" · `shipped_at` = 2026-11-28T00:04:36Z · `whats_new_id` = 520. Read back.
- **Ship phase record id 2947**: release 1683 · Ship · passed · holder `chain-v705-ship` · slug `daily-row-advances-on-finish` · document_path `docs/releases/v705-daily-row-advances-on-finish.md` · `commit_hash` = `bbaf04ad08c7e00ef8bcb6a1cedcb8a73d09a097`. Read back. (Scope 2942 · Plan 2943 · Implement 2945 · Review 2946 stand passed.)
- **Contract 1275**: all three expectations **met** (merge · deploy + served-bytes verification · closeout).
- **Goals Board intake 1342**: CLOSED, status **Done** — closeout line appended naming the stop, John's 18:03 CT approval, and the completion seat; read back via the task list.

**Disposition: v705 LIVE at pin `ora-pro-nobis-v705-1`.**

**Field check (John's leg, open):** finish today's Bible in a Year episode — the row stays today's, marked played, for the rest of the day.
