# v548 — Summa in a Year podcast: new RSS series in Catechesis → Podcasts

## 1 · Scope

**John's order** (Ora Pro Nobis thread, 2026-11-19 23:02 CT, verbatim): "Join it" · "Approve to add it" — run TO SHIP. Relay intake 1038.

**Identification.** **Summa in a Year** — the daily podcast by **Austin Habash / Think Catholic** walking through St. Thomas Aquinas's Summa Theologiae, one article a day. The run is complete: 307 episodes, Day 1 through Day 307.

- **Feed: `https://anchor.fm/s/e792b1ec/podcast/rss`**

**Feed verification (live, firsthand, 2026-11-19 ~23:05 CT, before any wiring).** HTTP 200 · 1,954,203 bytes · sha256 `e787692fb9f4820dda6ad7d87a12f9b8473b6d3b36d10532a524ac1ccf1fc1ac` · parses as a podcast RSS feed · channel title "Summa in a Year" · channel image present (`https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_nologo/38751507/38751507-1724107232938-c36a4d45fc22d.jpg`) · **307 items** · newest episode = **"Day 307: You Made It."** (pubDate Tue, 10 Mar 2026 05:01:04 GMT), with an audio enclosure · items carry `itunes:duration` and enclosures. The capture is stored as the harness fixture `app/tests/fixtures-v548/feeds-summa-2026-11-19.xml`. The feed passes every verification leg; it is wired.

**Current state, read firsthand from the shipped code (github/main @ fefa2bdd0, the v546 ship tree = production) and the live payloads — what already stands:**

1. **The Catechesis → Podcasts registry carries nine series.** `POD_SERIES_LIST` (native kind): catechism-in-a-year · bible-in-a-year · rosary-in-a-year. `POD_RSS_SERIES_LIST` (RSS kind, the v464/v500/v536 line): exorcist-files · counsel-of-trent · fr-mike-homilies · barron-sunday-sermons · daily-gospel-exegesis. `POD_OWN_SERIES_LIST`: the-ai-signal. Summa in a Year stands in none of them — no series page, no episode list, no episode-level played marks.
2. **No Summa wiring exists anywhere in the estate** — no constant, no Env binding, no day-build slot names this podcast. Unlike v536 (whose feed the day leg already read), this release introduces the feed URL itself, in the kind's standing constant + harness-seam form.
3. **John's live profile state stands untouched by this order.** The standing profile is The Salesian Way with its Podcasts layer series list as it stands; this order adds NO layer entry (see the scope bound).

**The one part (the whole scope):**

1. **Series in the app:** Summa in a Year stands in Catechesis → Podcasts as an RSS series in the v464/v500/v536 pattern — series page with its episodes (the kind's standing 50-episode window over the 307-item feed), episode-level played marks on the standing `podcast_listens`/`podcast_positions` stores, "current" = the latest episode (entries[0] = "Day 307: You Made It."), never mark-derived.

**Scope bound (John's order, explicit):** the series entry in Catechesis → Podcasts ONLY. **No profile Podcasts-layer addition** — no profile's Podcasts layer, no layer list, no layer default changes; John's Salesian Way layer stands byte-preserved. The registry line does make the key *admissible* to the layer validator (the standing union-of-lists rule, the same as every series) — admissibility is the code's own wiring, not a layer act, and no layer act is performed or implied by this release.

**Out of scope:** any profile or layer write · any other series · the day build (no slot names this podcast) · Android (no change; the series rides the web surface the app shell loads).

**Run level:** TO SHIP (John's direct order + approval). Streamlined small-release path: Scope+Plan one pass · Implement · light Review · Ship. Deadlines (ASAP + hard, America/Chicago): Scope+Plan named by 23:30 CT · Implement by 23:50 CT · Review by 00:05 CT · shipped Live by 00:30 CT.

## 2 · Plan

### 2.1 The build — one registry line, one constant, one harness seam

In `app/worker/src/index.ts`, in the v464/v500 form:

```ts
const RSS_SUMMA_FEED_URL = "https://anchor.fm/s/e792b1ec/podcast/rss";
{ key: "summa-in-a-year", title: "Summa in a Year", feedUrl: (env) => env.EXT_SUMMA_FEED_URL || RSS_SUMMA_FEED_URL },
```

- The key is `summa-in-a-year` — the estate's naming form for the "in a Year" family (bible-in-a-year · catechism-in-a-year · rosary-in-a-year).
- The constant stands beside the kind's other feed constants (`RSS_EXORCIST_FEED_URL` block); the registry line is appended to `POD_RSS_SERIES_LIST` after `daily-gospel-exegesis`, with a comment block naming the release.
- `EXT_SUMMA_FEED_URL?: string;` joins the Env interface's harness-seam block — the standing rule for every feed in the estate: production leaves it unset and the pinned constant governs; the harness overrides it to replay the captured feed through the real route. No wrangler change (the seam is optional and unset in production).
- **No migration.** The series' snapshot is built serve-time into the standing `rss_snapshots` store on first read. Migrations stand at 0041; the next free number is untouched.
- **No client change.** The Catechesis → Podcasts index, the series page, and the profile editor's picker all read the server-composed series list; the new entry flows from the one line. client.ts is byte-untouched; ui.ts changes only at Ship (the SW pin bump).

That one line carries the whole scope, by the code's own wiring, each verified below rather than assumed:

- The Podcasts index composes `podRssIndexEntry` for every `POD_RSS_SERIES_LIST` def → the series stands in Catechesis → Podcasts with its real channel art, its windowed episode count, and its latest label; the catalog goes from nine series to ten.
- `/api/player/podcasts?series=summa-in-a-year` resolves through `podRssSeriesDef` → the series page lists the window's episodes, GUID-keyed, with episode-level marks on the standing stores.
- `validateProfileLayers`' registry is the union of the three def lists → the key becomes admissible on any profile's Podcasts layer (named above for what it is: admissibility, not an act; this release performs no layer act and the harness proves no layer moved).

### 2.2 The harness (fixtures from production)

`app/tests/harness-v548.mjs`, in the v536 pattern: a local feed server serves the **captured live feed** (`fixtures-v548/feeds-summa-2026-11-19.xml` — the real feed as fetched at Scope, sha256 named in §1) through the `EXT_SUMMA_FEED_URL` env override; expectations are **derived from the captured feed itself** (newest title, count, durations), never invented. The local D1 is seeded with the **live profile store** (the prayer-door profiles read of 2026-11-19, captured at Plan as `fixtures-v548/profiles-live-2026-11-19.json`) and the live Mass-seats fixture, so the no-layer-change proof runs against John's real standing state. Legs:

- **S (statics):** the registry line stands with the exact key/title/feed form; the constant carries the exact feed URL; the Env seam stands; migrations still end at 0041; client.ts byte-identical to base; ui.ts identical outside the pin.
- **B1 (series build):** a cold series read builds the snapshot from the real feed — kind rss, available, not stale; the 307-item feed stores exactly the latest 50; entries[0] is the captured newest ("Day 307: You Made It.") with its real duration and the channel art as fallback art; the second read serves the snapshot (one fetch).
- **B2 (index):** the Podcasts index carries the new series entry with its real name, art, total 50, and latest label; exactly six RSS series stand; the nine standing series (all three kinds) stand unchanged beside it — the catalog reads ten.
- **P1 (playback):** the newest episode's entry resolves through the standing player path — its stream URL is the captured feed's real enclosure URL for Day 307, playable through the same route shape every RSS episode uses.
- **P2 (listen round-trip):** a listen mark written through the standing route for a Summa episode reads back on the series payload (episode-level mark on `podcast_listens`, keyed series + GUID seq_key) — and a position round-trips on `podcast_positions`.
- **L0 (no layer moved — the scope-bound proof):** the profiles read after the build is byte-equal to the seeded live fixture: every profile's layers, series lists, and the state version identical; the day fold for today carries the Podcasts layer with exactly John's standing series picks — `summa-in-a-year` absent from every fold.
- **W (client walk):** Chromium against the composed shell — Catechesis → Podcasts shows the Summa in a Year card with its real art; its series page lists real episodes with "Day 307: You Made It." standing as current.
- The v439 boot gate runs and is recorded **as-is at its standing 13/2**, never as a pass.

### 2.3 Ship

- Compose `release/v548-ship` = the reviewed build on **production as it stands at compose time** (the live Worker version + pin re-read at compose; v547 is in flight tonight and may land first — if it has, the compose base is its ship tree, and the registry line is re-applied onto it keeping both changes whole) + only the SW pin bump to `ora-pro-nobis-v548-1` in ui.ts.
- The harness re-runs on the composed tree; any functional leg not-ok stops the ship.
- Deploy via a driver adapted from v536's (`~/workspace/.tools/deploy-app-v548-ship.py`), dry-run first. No migration step (none in this release).
- Post-deploy: prayer-door verify all 200 (day · book · favorites · mass-personal-prayer · mass-universal-prayer · profiles) with John's Mass seats byte-preserved against the pre-ship read (preMass standing exactly as it stands, untouched, not re-seeded); the profiles read byte-equal to the pre-ship read (the no-layer-change proof, on production); book favorites = the standing 3 slugs.
- Closeout: this doc completed (§3–§5) and byte-equal incl. end under key `release-doc-v548-summa-in-a-year` · shipped record + What's New posted · row 1484 Live · time contracts judged.
- Check-in (push-to-main): the build merges to main and main is pushed (fast-forward only, GitHub main re-read immediately before the push); the local build branches are deleted after merge; the read-back reads "main pushed · remote in sync". The devops-board document commit stands on that repo's local main only (the standing divergence rule, not pushed).

### 2.4 Named risks

- **Feed size:** the Summa feed is 1.95 MB / 307 items. The kind's build parses the whole document then windows to 50 (the standing F-464-4 posture); the snapshot max-age is 2 h, so the parse cost lands at most on the first read per 2 h window. The harness B1 leg times the cold build from the real capture; a pathological time is reported, not waved.
- **Finished series:** the run completed 2026-03-10; no new episodes are expected. "Current" = Day 307 stands permanently as entries[0] — the kind's standing rule, identical for every RSS series.
- **Parallel ship:** v547 (the Favorites-folder correction) is in flight on the same night. The two changes are surface-separated (v547: favorites/client surfaces; v548: the series registry line in index.ts + the pin at ship). The compose step (§2.3) names the re-base rule if v547 lands first.

## 3 · Implement

Built exactly the Plan: in `app/worker/src/index.ts` — the `RSS_SUMMA_FEED_URL` constant beside the kind's other feed constants, the `EXT_SUMMA_FEED_URL?: string;` harness seam in the Env interface, and one entry appended to `POD_RSS_SERIES_LIST` with a comment block naming the release and its scope bound:

```ts
{ key: "summa-in-a-year", title: "Summa in a Year", feedUrl: (env) => env.EXT_SUMMA_FEED_URL || RSS_SUMMA_FEED_URL },
```

No migration, no client change, no layer act: the index composition, the series payload, and the layer validator's registry all read this one list — and no profile write of any kind was made. Build commit `a2801f68b` on `release/v548` (base github/main `fefa2bdd0`, the v546 ship tree): index.ts +16 lines (purely additive), the harness, and the three fixtures — nothing else.

**Harness (`app/tests/harness-v548.mjs`): 33 ok / 0 not-ok** on the build tree. Shape: S statics (the registry line/key/title/feed form exact, registry order, the constant + seam, migrations still ending at 0041, client.ts byte-identical to the base, ui.ts identical outside the pin, index.ts's diff vs the base purely additive) · W0/W1 seed legs (the harness D1 seeded from the live profiles fixture — John's salesian layer [bible-in-a-year · exorcist-files · daily-gospel-exegesis], state version 5 — read back byte-exact locally before any leg) · B1 (the cold series build from the REAL feed bytes: exactly one fetch, the 1.95 MB / 307-item parse in 163 ms, the window at exactly 50, entries[0] = "Day 307: You Made It." at its real 1147 s standing as current, the channel art on the series and the entry, the second read serving the snapshot) · P1 (entries[0]'s stream URL is the captured feed's real Day 307 enclosure URL — the standing player path) · P2 (a listen mark through the standing mark route reads back on the payload, listenedCount 1; a 42 s position through the standing position route reads back on the second episode, unlistened — both on the standing `podcast_listens`/`podcast_positions` stores) · B2 (the index carries the series: kind rss, available, total 50, the real channel art, the latest label; exactly six RSS series stand; the nine standing series stand beside it, the catalog reading ten) · L0 (after every leg the profiles read is byte-equal to the live fixture — no profile, layer, series list, or state version moved; the day fold carries John's standing three series and `summa-in-a-year` stands in no fold) · W1 (the Pray Podcasts group carries the standing three series entries and NOT the new one — the scope bound on the client surface too) · W2 (Catechesis → Podcasts: the card painted with the feed's real channel art; the series page lists the window's 50 real episodes, Day 307 at the head; no page errors).

Harness-side correction during the run (the build never changed after its first write; the fix is in the harness and named here): the B2 standing-series leg first asserted `available === true` for all nine standing series; `the-ai-signal` (the own kind) reads available=false in the harness D1 because its availability rides its own episode store, which the harness does not seed — its standing local read, identical on the base code. The leg now asserts presence for all nine + availability for the eight feed-driven series, with the reason named in the leg itself.

**The v439 boot gate stands at its standing 13 ok / 2 not-ok (B3, B5 — the named superseded premises), recorded as-is, never as a pass.**

Fixtures (Improvement D — every one drawn from production and named): `feeds-summa-2026-11-19.xml` — the live Anchor feed bytes, sha256 `e787692fb9f4820dda6ad7d87a12f9b8473b6d3b36d10532a524ac1ccf1fc1ac`; `profiles-live-2026-11-19.json` — the live profiles read of 2026-11-19 (door mirror); `mass-seats-live-2026-11-19.json` — the live mass-personal-prayer read of 2026-11-19 (before [prayer-before-communion] · after [prayer-after-communion] · afterMass [hail-holy-queen] · preMass [prayer-before-mass], the standing flagged read, preserved as-is).

## 4 · Review

Review re-ran the harness on the COMMITTED tree (worktree verified clean before the run): **33 ok / 0 not-ok**, identical to the Implement run. The v439 gate was recorded again as-is at 13/2.

The scope, judged point by point:

1. **The series stands.** B1/B2 prove the server side from the real feed (one fetch, snapshot, the 50-window over 307 items, Day 307 as current, the real art on both levels); W2 proves the Catechesis surface in Chromium (card + full series page). Played marks and positions ride the standing episode-level stores (P2's round-trips through the app's own routes — no new code, nothing to diverge).
2. **The scope bound held — no layer moved.** L0 is the proof in both directions: the profiles read after every leg is byte-equal to the live draw (layers, series lists, state version 5 all identical), and the day fold carries exactly John's standing three Podcasts series with the new key absent. W1 carries the same fact to the client surface: the Pray group shows three entries, not four. The registry line makes the key *admissible* to the layer validator (the standing union-of-lists wiring every series shares) — no layer act was performed, none is implied, and John's profile stands exactly as it stood.
3. **The nine standing series are unchanged.** B2: all nine present beside the new entry, the eight feed-driven ones available, the own series' local read named for what it is. S7: index.ts's whole diff against the base is additive — no standing line was edited.

Named Review notes: (a) The W2 art assertion judges the painted reference (the walk fulfills external images with a stand-in GIF; the URL on the element is the feed's real channel art, and B2 proves the payload carries it). (b) The harness's W stubs serve payloads captured from the built worker itself — the client is judged against the server's real output, not a hand skeleton. (c) Production moved during the build exactly as §2.4 named: v547 shipped (registry Live; github/main advanced fefa2bdd0 → 19baf118f, pin ora-pro-nobis-v547-1). The Ship compose (§5) therefore bases on the v547 ship tree, per §2.3's named rule. (d) No deviation from the Plan stands: the build is the one registry line the Plan named.

## 5 · Ship

**Compose.** Production had moved while the build ran, exactly as §2.4 named: v547 shipped at 05:08Z (Worker `e257ac49-2e13-4f0a-9c54-a1035d8a8388`, pin `ora-pro-nobis-v547-1`; github/main `19baf118f`). The ship tree was composed on production AS IT STOOD: `release/v548-ship` = `19baf118f` + the reviewed build cherry-picked clean (`7c661092b` — no conflicts; v547's favorites work and this registry line stand whole beside each other) + ONLY the SW pin bump to `ora-pro-nobis-v548-1` (ship commit `b49f4674d`).

**Harness on the composed tree: 33 ok / 0 not-ok** — the full harness-v548 re-run against the v547 ship tree as its comparison base (client.ts byte-identical to v547's, ui.ts identical outside the pin, index.ts's diff purely additive). The v439 gate stands at its standing 13/2, recorded as-is.

**Deploy.** Driver `~/workspace/.tools/deploy-app-v548-ship.py` (adapted from v547's), dry-run clean, then deployed 2026-11-20 ~06:00Z: **Worker `a4fcb704-cdf9-4f11-80f7-171ce0a94dc9`**, pin `ora-pro-nobis-v548-1`. Rollback: v547's Worker `e257ac49-2e13-4f0a-9c54-a1035d8a8388`. No migration.

**Post-deploy verify (prayer door, all 200):** player day · prayer book (9 groups) · book favorites — exactly the standing three slugs (prayer-after-communion · prayer-before-mass · grace-after-meals) · mass-personal-prayer **byte-equal to the pre-ship read** (before [prayer-before-communion] · after [prayer-after-communion] · afterMass [hail-holy-queen] · **preMass [prayer-before-mass] exactly as it stood — untouched, not re-seeded**) · mass-universal-prayer (dated reads 200) · profiles **byte-equal to the pre-ship read** — the no-layer-change proof on production itself: John's Salesian Way Podcasts layer stands at [bible-in-a-year · exorcist-files · daily-gospel-exegesis], state version 5, nothing moved.

**The series' production proof, named precisely:** the agent door carries no podcasts-series read, and the session series route refuses the door's service token (403 "access sign-in required" — the app shell stands behind John's own Access session), so the series payload was not read back from production through the door. What stands proven: the deployed Worker is the composed tree byte-for-byte (the driver deploys the worktree it guards, head `b49f4674d`), and that exact tree's series behavior — cold build from the real feed, the index card, the series page, the marks — is harness-proven at 33/0 on the composed tree itself. John's field legs below are the live read.

**Check-in (push-to-main):** github/main re-read at push time had advanced once more — to `b3a820f88`, v547's own release-doc closeout commit landing on top of its ship tree while this chain worked. The ship line was rebased onto it (build `63eab9f2d` · ship `314cfa7be`) with the **app tree byte-identical to the deployed tree** (0-line diff against `b49f4674d` — the rebase carried only v547's document commit under the line), then replicated to GitHub main through the estate pusher, byte-identical SHAs, and read back — **main pushed · remote in sync**. This document's commit follows on main in the same closeout. The local build branches (release/v548 · release/v548-ship) are deleted after the push. The devops-board copy of this document stands committed on that repo's local main only (the standing divergence rule, not pushed).

**Field legs — OPEN (John's verdicts):** (1) Catechesis → Podcasts: the Summa in a Year card stands and its series page lists the episodes, newest = "Day 307: You Made It." (2) An episode plays, and a played mark + resume position hold on it as on every series. (3) Pray → Podcasts group: still your standing three series — Summa in a Year was added to the catalog only, not to any profile's Podcasts layer. (First check on any "I don't see it" report: a full close and reopen of the app — the v533 standing rule.)

**Records:** shipped record + What's New 368 posted at closeout; DevOps row 1484 → Live (shipped_at 2026-11-20T06:00:00Z); relay intake 1038 carries the ship line. Time contracts 599 (Scope), 600 (Plan), 602 (Implement), 603 (Review), 604 (Ship) judged at closeout — all met inside their windows (Scope+Plan named by 23:30 CT · Implement by 23:50 CT · Review by 00:05 CT · Live by 00:30 CT).
