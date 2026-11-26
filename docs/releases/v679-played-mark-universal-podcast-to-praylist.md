# v679 — Played state stands everywhere at once

## §1 Scope

Played state stands everywhere at once: a played episode stands read on every standing copy of it — the Praylist copy, the series/episodes-page row, the Favorites row — in the same act that plays or marks it, with no reopen, no reload, no collapse/re-expand. TWO LEGS:

**Leg 1 (field report, John 2026-11-25 21:15 CT):** "It also seems as if okay is not universal. I played an episode from a podcast and it didn'r make itself read on the playlist" — an episode played to completion FROM a podcast surface (series/episodes page) did not stand read on the Praylist copy of the same episode.

**Leg 2 (scope addition, John 2026-11-25 21:15 CT, verbatim):** "Also, clicking the mark as read button outside of playlist doesn't immediately paint the menus." — the v639 Mark as read / Mark as unread row-menu item, tapped OUTSIDE the Praylist (series/episodes pages, Favorites rows, every surface carrying it), does not repaint at once: neither the row's played paint nor the menu's own state (after marking read, the item must read "Mark as unread", and the row behind must stand read when the menu closes) — no reopen, no reload, no collapse/re-expand.

Run level: To Ship (streamlined Scope+Plan pass — this doc's §1+§2 are that pass). Base: v677 ship head `7f72a5f` (pin `ora-pro-nobis-v677-1`), branch `release/v679`, worktree `~/workspace/.worktrees/v679` off the one standing clone. v678 is in flight on the same main from its own worktree; this release bases on current main and does not touch it. Contract 1132 (Plan, holder plan-v679).

## §2 Plan

Reproduction first (Improvement D discipline): `app/worker/harness-v679.mjs` stands the real client up (playwright-core Chromium, esbuild bundle of the real Worker, API stubbed in-page; the stub's mark/unmark endpoints flip its server-side payload store as the production routes flip `podcast_listens`, and every fetch serves a fresh JSON copy, as the network does). Fixtures are production shapes: the Bible in a Year folded sequence (`app/tests/fixtures-v603/bible-folded.json`, 372 entries keyed `biy:day-N`) and the Catholic Saints capture (`app/worker/v666-fixtures/production-heads.json` `catholicsaints` — real video ids/titles/publishedMs). **Tally on the current tree (this Plan's own run): 32 ok, 3 bad** — the 3 failures are Leg 1v, Leg 5c, and Leg 6a below; every other leg passes and is named as already-standing behavior the fix must not disturb.

### §2.1 Leg 1 — root cause, per completion seat (code seats at base `7f72a5f`)

The Praylist copies of a series episode and the keys they carry — every audio shape checked firsthand:

| Praylist copy | Builder seat | episodeId | seriesKey | podSeries |
|---|---|---|---|---|
| Fixed episode pin (`episode` contents item) | `resolveProfileEpisodes614` (client.ts:20250), descriptor at :20363 | `e.key` | `e.key` | the item's series |
| Daily dynamic (audio) | `resolveDailyDynamic666` (client.ts:20532 ff) | `e.key` | `e.key` | the daily series |
| Course (next episode) | `resolveProfileCourses590` (client.ts:20163) | `e.key` | `e.key` | the course series |
| Day exegesis | `resolveExegesisDay611` (client.ts:20205) | `e.key` | `e.key` | `daily-gospel-exegesis` |
| Readings seat | `readingsSeatDesc549` (client.ts:14305) | `seat.seqKey` (= the RSS entry key, index.ts:4511) | same | `daily-readings` |
| Reading addition | `dayAdditionDesc` (client.ts:14220) | `a.ref` (the GUID = entry key) | same | `daily-readings` |
| Daily dynamic (video) | `resolveDailyDynamic666` video branch | `yt:` + video id | — (video arm keys on episodeId) | — (`vmSeries`) |

The completion write flips **(podSeries, seriesKey)** — `podSyncQueueListened` (client.ts:9380), whose apply (client.ts:9400) matches `kind 'podcast' && podSeries === series && seriesKey === seqKey` over queue/current/preview/`state.dayDescs`, plus (v677) the `state.dailyRes666` descriptors and the settled-pick store, the video arm matching on episodeId (client.ts:9414, :9425). Every audio Praylist copy above carries exactly that key pair — **there is no identity mismatch on the audio arm.**

The audio completion seats, each driven in the harness:

- **Web 'ended' seam:** series-page play is `playPodFrom` (client.ts:10792) → `podDesc` queue (episodeId = seriesKey = `e.key`, podSeries = the open series, client.ts:9363); the ended handler's `markCompleted` (client.ts:5166, podcast branch :5183) → `writePodMarkQuiet(desc.seriesKey, desc.podSeries, 'auto')` (client.ts:9431) → `podSyncQueueListened` (client.ts:9466) + `refreshPlayedChrome`. **Driven (harness L1): both Praylist copies of `biy:day-329` (fixed pin + daily) flip in the same act, the Afternoon head count drops 4 → 2, the unrelated `biy:day-330` copy does not flip (L4). Already universal — PASS on the current tree.**
- **Native drain:** `drainNativeCompletions` (client.ts:19703) resolves the record (queue/dayDescs candidates by episodeId + block, the contract-shaped record for a series-page play carrying block `Podcasts` + the entry's mediaUri + queueIndex) and routes a resolved podcast descriptor through `writePodMarkQuiet` (client.ts:19786–19788, the v673 seat). **Driven in the Plan probe with exactly that record shape: the Praylist copy flips. Already universal.**
- **Reverse direction (harness L2):** completion on the Praylist copy flips the open series payload entry — PASS. **Daily settled row (harness L3, the v677 regression):** after a full rebuild the daily copy still stands read — PASS.
- **Favorites-door route:** a starred series door enters through `goSeries` (client.ts:16757) → `openPodSeries` → the same `playPodFrom` path. Same play path, no second seat — named, not a separate fix surface.

**The one completion seat that bypasses the sync — PROVEN, the Leg 1 root cause:** the marks-carrying video series (Catholic Saints, the v666 daily set's video member). Its natural-end write is `markPodVideoEnded663` (client.ts:10552): it flips only the payload's video object (`v.listened = true`, client.ts:10569 ff) and posts `/api/player/podcasts/mark` keyed `(series, 'yt:' + videoId)` **directly — it never calls `podSyncQueueListened`**. The v677 video arm of the sync (dailyRes666 + settled store, keyed on episodeId) therefore never fires for a series-page watch: the Praylist daily video copy keeps the resolve-time `listened: false` in `state.dailyRes666`, and every `extRebuildDescs` re-copies it onto the day copy. **Driven (harness L1v): after the natural end, payload video `listened: true`, `dailyRes666` copy `false`, day copy `false` — FAIL on the current tree.** (The full day rebuild's fresh resolve reads the server fold and recovers the mark, exactly the collapse/re-expand class of recovery v673/v677 retired for audio; in-session it stands hollow.) A video contents pin (`resolveProfileVideos656`, client.ts:20377) carries no `listened` field at all — Virtual Mass payloads carry no marks (v434 discipline) — named out of scope with that evidence.

**Leg 1 fix shape (one seat):** `markPodVideoEnded663` routes its in-memory leg through the standing sync — after the post, call `podSyncQueueListened(res.series, seqKey, true)` (its video arm already matches the daily copies on episodeId === seqKey) and `refreshPlayedChrome()`, beside the payload fold it already performs. No new key, no new store, no change to any audio seat.

### §2.2 Leg 2 — root cause (code seats at base `7f72a5f`)

The menu contract first: `openSheetMenu` (client.ts:16563) closes the card, **then** fires the item's act (client.ts:16701–16708, the non-`stay` path). So after a tap the menu is gone; its "own state" is observable only as (a) the row paint standing behind it and (b) the label a reopened menu derives at open. The reopened label derives from live state at open in every menu builder checked — `openPodRowMenu` from the payload entry (client.ts:23118), `dayRowMarkItem639` from the descriptor (client.ts:17783) — and the harness proves it flips on reopen in both hostings (L5a/L5b). **The failing half is the row paint, and it fails at one seat:**

**`podToggleMark`'s repaint is hosting-gated.** `podToggleMark` (client.ts:10804) is the act behind the episodes-page row menu (`openPodRowMenu`'s mark item, client.ts:23118) and the row's own podmark button. It flips the payload entry, the core (device/web shapes), and — via `podSyncQueueListened` — every queue/day copy, then repaints **only** `if (state.tab === 'podcasts')` (client.ts:10844: `paintPodcastRss()` / `paintPodcasts()`). A series page stands in three hostings, and the other two get no repaint at all:

- **Pray-homed** — entered from Pray (`goSeries`, client.ts:16757: `podOrigin = 'prayers'`, tab stays `'prayers'`; the open/paint seats themselves honor this hosting, client.ts:9888);
- **Mass-homed** — `massPodReturn`, tab `'mass'` (same paint seats, client.ts:9888).

**Driven (real taps, harness L5):** Catechesis hosting (L5a) — row podmark flips at once, Praylist copy flips, reopened menu reads "Mark as not listened": PASS, already standing. Pray-homed hosting — the mark direction (L5b) passed in the harness run only because a racing session-return re-read repainted the page behind the act (the `renderPodcasts` return machinery, client.ts:9503); the act itself carries no repaint in this hosting, and the unmark direction (L5c) proves the standing failure cleanly: **entry flips to unread, the row's podmark stays `on` — FAIL.** The Plan probe's first drive of the same hosting (mark direction, no re-read pending) failed identically (entry `true`, podmark class unchanged, aria-label still "Mark as listened").

**The Favorites route into the same act fails even in the act's own terms (harness L6a — FAIL):** `openFavRowMenu` (client.ts:13154) routes a podcast row whose series stands open to `openPodRowMenu` (client.ts:13165), whose mark act is the bare `podToggleMark` — the Favorites surface is never repainted on this route (`favPodToggle`'s `paintFavoritesSurfaces()` close, client.ts:13129–13136, is bypassed). Driven: entry flips `true`, the Favorites row's podmark face stays off. **The mirror route already flips (harness L6b — PASS):** series not open → the mirror menu's mark act is `favPodToggle` itself, which closes with `paintFavoritesSurfaces()`.

Surfaces proven ALREADY flipping, with evidence (the fix stays off them):

- Praylist home rows (v639 item via `dayRowMarkApply639`, client.ts:17801): v673's seam — harness-v673's standing record plus this harness's L5 Praylist-copy assertions in both hostings.
- Episodes page, Catechesis hosting: harness L5a, real taps, PASS.
- Favorites mirror menu: harness L6b, real taps, PASS.
- Favorites podmark button (the direct face act): `favPodToggle` + `paintFavoritesSurfaces` — same code seat as L6b.
- The episode card's played toggle (`epCardTogglePlayed`, client.ts:10911) repaints its own card through its `refresh()` argument on every surface; its background-row leg rides `podToggleMark`, so it inherits the §2.2 fix — named as a beneficiary, not a separate seat.
- `dayRowMarkItem639` on a Favorites **mirror** (non-podcast) row: the descriptor is a snapshot object; its act writes the day store and `refreshPlayedChrome` re-reads that same store — standing immediate paint, unchanged.

**Leg 2 fix shape (one seat, plus one call):** in `podToggleMark`, replace the hosting-gated repaint with the standing series-page dispatch in **every** hosting — `paintPodSeriesPage()` (client.ts:9845, the dispatch the open/return seats already use, honoring `podOrigin === 'prayers'` and `massPodReturn` exactly as client.ts:9888 does; it also corrects the kind dispatch — the current guard calls `paintPodcasts()` for own/novena/video payloads standing on the podcasts tab) — and close with `paintFavoritesSurfaces()` (internally guarded: it repaints the Favorites page only when it stands, client.ts:14048, plus the folder row count). No menu-builder change: labels already derive at open.

### §2.3 Out of scope, named

- No consolidation of the row/menu/paint copies (John's shared-components direction, 2026-11-25 21:15 CT, is a separate scope package) — this release fixes the two seats inside the standing shapes, per the v673/v677 discipline: the completion/mark write flips every standing copy of that episode at once, in place.
- No server change, no migration, no store change. The writes already land everywhere; both defects are in-memory propagation/repaint misses.
- Pin: `ui.ts` CACHE → `ora-pro-nobis-v679-1` (its one seat), at Implement.

### §2.4 Harness legs — `app/worker/harness-v679.mjs` (committed with this Plan; tallies on the current tree in §2 head)

1. Play from series page → Praylist row read at once (state copies + Afternoon head count), no reload. *(Current tree: PASS — regression guard for the audio arm.)*
2. Play from Praylist → series page read (regression). *(PASS.)*
3. Daily-dynamic episode played anywhere → settled row read after a full rebuild (v677 regression). *(PASS.)*
4. Unrelated episode's copies do not flip. *(PASS — asserted inside L1.)*
5. Mark as read on the episodes page → row + menu repaint at once and the Praylist copy stands read; Mark as unread reverses both — run in BOTH hostings (Catechesis L5a, Pray-homed L5b/L5c). *(Current tree: L5a PASS · L5b PASS-by-race, named in §2.2 · L5c FAIL — the leg's discriminating assertion on the current tree.)*
6. Same mark act on a Favorites row: series-open route (L6a) and mirror route (L6b). *(Current tree: L6a FAIL · L6b PASS.)*
1v. The video arm of leg 1: series-page natural end (`markPodVideoEnded663`) → the Praylist daily video copy stands read. *(Current tree: FAIL — Leg 1's discriminating assertion.)*

Implement's gate: harness-v679 green whole (35/35) on the built tree, with L1v, L5c, and L6a flipping from FAIL to PASS and no PASS leg moving; regressions harness-v677 and harness-v673 green on the built tree (their pin legs re-pointed by name if Implement's pin bump requires it, per the standing rule).

### §2.5 Risks

- **`paintPodSeriesPage` repaint cost/scroll:** the series painters re-run whole on the podcasts tab today at every toggle; extending the same repaint to the Pray/Mass hostings inherits their standing scroll behavior (`armPodScroll` seats exist on the return paths; the toggle repaint on the podcasts tab today does not preserve scroll either — parity, not a new class). Review verifies scroll posture in the Pray hosting specifically.
- **L5b's race:** the session-return re-read can mask the Leg 2 defect in a casual re-test; Review must judge L5c (unmark, no re-read pending) and L6a, not L5b alone.
- **Video arm scope:** `podSyncQueueListened`'s video match also touches `state.dayDescs` copies only through its daily arms (dailyRes666 + settled store) — the day copy is re-copied from dailyRes666 at rebuild, so flipping the dailyRes copy is sufficient; Implement verifies the standing (non-rebuild) day copy's paint via `refreshPlayedChrome`'s poddot pass (its read seat is `state.dayDescs` by episodeId — the sync's dayDescs apply is podcast-kind only, so Implement names whether the video day copy needs the apply widened or the repaint comes from the rebuild the resolver's settle already runs).
- **Two hostings, one payload object:** the fix repaints from `state.podcasts`, the same object every hosting paints — no copy is introduced.

## §3 Implement

Holder: impl-v679 · Contract 1135. Base Plan commit `2968482`. Commits on `release/v679`:

- `97d352f` — Leg 1 (video completion seat)
- `51000d1` — Leg 2 (mark toggle repaint) + pin bump
- `71b7059` — Leg 2 standing-view guard + Leg 1 §2.5 apply widening (both proven necessary by the harness, below)
- `20267ff` — harness-v673 pin leg re-pointed (§2.4 standing rule)

**Leg 1 — `markPodVideoEnded663` (client.ts:10552, sync call at :10590–10591):** beside its standing post + payload fold, the seat now calls `podSyncQueueListened(res.series, seqKey, true)` (seqKey = `'yt:' + v.id`, the form its post already used; the sync's video arm keys on episodeId === seqKey) and `refreshPlayedChrome()`. No audio seat touched.

**Leg 1 widening (§2.5's named question, answered by evidence):** the standing day copy did NOT flip with the seat fix alone — harness run 2 stood at 33 ok / 2 bad with L1v reading `dailyRes: true, day copy listened: false`. Cause: the dayDescs video copy is an `Object.assign` copy of the dailyRes666 descriptor (extRebuildDescs daily branch), and `podSyncQueueListened`'s standing-copy apply (client.ts:9399) matched podcast kind only; `refreshPlayedChrome`'s poddot pass reads `state.dayDescs` by episodeId, so no repaint could recover it without a rebuild. The apply now carries the video arm beside the podcast arm — `kind 'video'` keyed on `episodeId === seqKey || episodeId === 'yt:' + seqKey`, exactly the v677 daily arm's key forms — covering queue/current/preview/dayDescs copies. Audio calls cannot trip it (their seqKeys never equal a video episodeId).

**Leg 2 — `podToggleMark` (client.ts:10804, repaint at :10859–10872):** the hosting-gated repaint (`if (state.tab === 'podcasts') …`) is replaced by `paintPodSeriesPage()` (client.ts:9845 dispatch — every hosting, every kind) plus a closing `paintFavoritesSurfaces()` (client.ts:14048, internally guarded). One refinement of the Plan's literal shape, proven necessary by harness L6a: the series dispatch runs only when a series page actually stands in the view (`view.querySelector('[data-podrow]')` — every series painter emits those rows). Unconditional dispatch failed L6a (`favPodmarkOn: null`): on the Favorites series-open route the Favorites page stands, not the series page, and the dispatch painted the series page over it, destroying the Favorites list before `paintFavoritesSurfaces` could repaint it. The same clobber would hit the episode-card (`epCardTogglePlayed`, client.ts:10915) and Praylist row (`dayRowMarkApply639`, client.ts:17810) callers of `podToggleMark`, where no series page stands either. With the guard: every hosting where the series page stands repaints (L5a/L5b/L5c), the Favorites face flips on the series-open route (L6a), and non-series surfaces are never clobbered. No menu-builder change — labels already derive at open (L5/L6 reopened-label legs pass).

**Pin:** `ui.ts` CACHE → `ora-pro-nobis-v679-1` (ui.ts:1186, in `51000d1`).

**Harness tallies (built tree):**

- harness-v679: **35 ok, 0 bad** — L1v, L5c, L6a flipped FAIL → PASS against the Plan baseline of 32 ok / 3 bad; no PASS leg moved. Judged on the discriminating legs: L5c (Pray-homed unmark) and L6a (Favorites series-open route) both pass on real taps; L5b is not relied on.
- harness-v677 (regression — daily settled row): **18 ok, 0 bad**.
- harness-v673 (regression — Praylist mark paint): **30 ok, 0 bad**, after its pin leg was re-pointed by name to `ora-pro-nobis-v679-1` per §2.4's standing rule (`20267ff`); before the re-point it stood 29 ok / 1 bad with the pin leg the only failure.

**Out of scope, untouched:** `resolveProfileVideos656` video contents pins (no listened field), all audio completion seats, server/routes/stores.

## §4 Review

Holder: review-v679 · Contract 1138. **Verdict: PASS.** Judged tree: Implement head `f080184` (code commits `97d352f`, `51000d1`, `71b7059`; harness re-point `20267ff`). All tallies below are Review's own independent re-runs, not the Implement record's.

**Harness tallies (built tree, Review re-run):**

- harness-v679: **35 ok, 0 bad** — discriminating legs L1v (video completion flips the Praylist daily copy), L5c (Pray-homed unmark flips the row podmark off), L6a (Favorites series-open route flips the Favorites face) all PASS on real taps/drives.
- harness-v677 (regression): **18 ok, 0 bad**.
- harness-v673 (regression): **30 ok, 0 bad**.

**Fail-on-old (Review re-run):** scratch worktree of the Plan commit `2968482` with the current harness-v679 copied in: **32 ok, 3 bad** — exactly the Plan baseline. The 3 failures are the discriminating legs, with evidence: L1v (`dailyRes: false`, day copy `listened: false` after the natural end), L5c (entry `false` while the row podmark stays `on`), L6a (entry `true` while `favPodmarkOn: false`). L5b passed on the old tree, as §2.2/§2.5 predicted (session-return race) — not relied on as evidence in either direction. Scratch worktree removed after the run.

**Deviation (a) — Leg 1 apply widening: SOUND.** The widened apply in `podSyncQueueListened` (client.ts:9399 ff) is an `else if` beside the podcast arm, gated on `kind === 'video'` and exact episodeId equality (`episodeId === seqKey || episodeId === 'yt:' + seqKey` — the v677 daily arm's two key forms). It cannot flip an unrelated copy: an audio call's seqKey (`biy:day-N` form) can never equal a video descriptor's episodeId (`yt:<id>` form, or `'yt:' + seqKey` = `yt:biy:day-N`, which no video copy carries), and a video call's seqKey (`yt:<id>`) matches only that video's copies across queue/current/preview/dayDescs. **Named gap (non-blocking):** the harness carries no unrelated-VIDEO control leg — L4 asserts only the unrelated audio copy (`biy:day-330`); no second video copy stands in the harness day to assert against. The exact-match keying makes the risk theoretical; a future harness touching this seat should add the video control.

**Deviation (b) — Leg 2 standing-view guard: SOUND.** `podToggleMark` (client.ts:10860 ff) dispatches `paintPodSeriesPage()` only when `view.querySelector('[data-podrow]')` finds a standing series page, and closes with `paintFavoritesSurfaces()` unconditionally (itself guarded: Favorites page repainted only when the Favorites view stands, plus the folder row count). The other callers cannot be clobbered: `epCardTogglePlayed` (client.ts:10939) calls `podToggleMark` only when the open payload is the descriptor's series, then runs its own `refresh()` for the card surface — on a non-series surface no `[data-podrow]` stands, the dispatch is skipped, and the card's own repaint governs; `dayRowMarkApply639` (client.ts:17829, the v639 Praylist seat) likewise calls it from day-row surfaces where no series page stands, then sets `t.listened` and `refreshPlayedChrome()` itself — unchanged. Catechesis-homed behavior is unchanged in outcome (series page stands → dispatch paints, now with the correct kind dispatch for video/own/novena payloads where the old tab-gated code called `paintPodcasts()`); Praylist-home (v639) mark behavior is unchanged, confirmed by harness-v673 30/0 and the L5 Praylist-copy assertions.

**Audio arm byte-untouched: CONFIRMED.** Total client.ts diff `2968482..f080184` is exactly three hunks: (1) `podSyncQueueListened` apply at :9398 — the ONLY hunk touching that function, in `71b7059`, adding the video `else if` arm; the podcast arm line and both v677 daily arms are context only, byte-identical; (2) `markPodVideoEnded663` at :10574 — `97d352f`, +8 lines, the sync call + `refreshPlayedChrome()` inside the video seat only; (3) `podToggleMark` repaint at :10841 — `51000d1` + `71b7059`. No hunk touches `markCompleted`, `writePodMarkQuiet`, `drainNativeCompletions`, or any audio completion seat. `97d352f` does not touch `podSyncQueueListened` at all — it only calls it.

**Pin:** `ora-pro-nobis-v679-1` stands at ui.ts:1186, verified in the judged tree and in the served sw.js via the harness pin legs.

**Ship note:** no FAIL items. The unrelated-video harness gap above is an observation for a future harness, not a ship blocker.

## §5 Ship record (chain-v679, 2026-11-26) — LIVE

Review PASS (§4, judged tree `f080184`). Run level: To Ship.

- **Rebase:** release/v679 onto origin/main at the v678 ship (`0c05fbb`; remote had advanced one doc-only commit, `8978d58` v678 §5, verified doc-only). The plain rebase replayed the pre-Git-Data history, so the rebase was done as a cherry-pick of the seven v679 commits (Plan `2968482` · Leg 1 `97d352f` · Leg 2 `51000d1` · guard/widening `71b7059` · harness re-point `20267ff` · Implement record `f080184` · Review record `ca41333`) onto the local main mirror of origin/main. ONE conflict: `ui.ts` pin (v678-1 vs v679-1) — resolved to `ora-pro-nobis-v679-1`, v678's pin seat only; `client.ts` auto-merged, preserving BOTH v678's Favorites dress and v679's two fixes (rebased delta vs main is exactly the original v679 delta: client.ts 30 lines, ui.ts pin, harness-v673 pin leg, harness-v679, this doc). Rebased head `589d886`, tree `acccc4d`.
- **Harness on the rebased tree:** harness-v679 **35 ok, 0 bad** (L1v, L5c, L6a PASS) · harness-v677 **18 ok, 0 bad** · harness-v678 **29 ok, 1 bad** — the one failure is harness-v678's own pin leg (it expects a v677/v678 pin; the tree now carries v679-1, the standing pin-bump effect), no product leg failed.
- **Merge:** release/v679 → main, tree-exact via the Git Data API (push-v679-github.py). Product paths asserted against the rebased candidate `589d886` (client.ts `5d9dce5d12c1bce791dbf69543ea64ab2b30c1af` · index.ts `205f6597cf5a8dcbb313004a30d71025f1c5c4ca` · ui.ts `288653cf0c814908570d6c08b0ac76373726d9b0`); remote-vs-base delta empty (remote main `8978d58` tree == local base tree `01a465f` — the v678 §5 doc commit was already in the base, nothing dropped, no force-push). Remote ship commit **4b089e8637810d267c753520d539d1a1f35fbba3**, tree **acccc4df60692df4115719a035b76aff0aa55607**; local mirror `08fefd87`, same tree. Read-back: **main pushed · remote in sync**.
- **Harness at the merged tree:** harness-v679 **35 ok, 0 bad** (standing clone, merged main).
- **Deploy:** deploy-app-v679-ship.py with EXPECTED_HEAD = merged main head (`08fefd87`); dry-run → deploy clean. Worker **80098c2a-b972-4225-9665-928b07f5ca95**, pin **ora-pro-nobis-v679-1**. Production verification: the served sw.js (app.orapronobis.media) reads pin ora-pro-nobis-v679-1 (×1, the only pin served); the served app.js carries the fix markers (`podSyncQueueListened(res.series, seqKey, true)` ×1 in `markPodVideoEnded663` · `podToggleMark` segment carries `paintPodSeriesPage()` + the closing `paintFavoritesSurfaces()` + the `[data-podrow]` standing-view guard ×1) and v678's dress markers stand (`favFolderSectionHtml` ×4 · `data-favcount678` ×3). No APK, no migration.
- **Board closeout (D1-direct, all read back):** release 1657 → Live, shipped_at 2026-11-26T03:38:08Z, whats_new_id 494 · What's New **494** ("A played episode now stands read everywhere it appears") · shipped_records **868** · Ship phase record **2817** passed (commit_hash = the remote ship commit 4b089e86). Ship contract 1139's expectation judged **met** via the door. Goals Board intake 1287 → Done, state line CLOSED.
- **Rollback:** pin ora-pro-nobis-v678-1 (Worker 2ed6132d-8023-4744-817f-19d4b1e6df65), the v678 driver (`~/workspace/.tools/deploy-app-v678-ship.py`) untouched.
