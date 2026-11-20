# v546 — Star any track: Starred section at the head of Praylist, list plays as a list

## 1 · Scope

John's approval (Ora thread, 2026-11-19 22:04 CT) of scope package 49 "starred-tracks" (Scope Management Space, approval record 37), run level TO SHIP. John's direction (2026-11-19 21:52 CT): "I want to add the ability to star and favoitr any track and it show up in a list under prayer." Registered by the main seat as v546 (row 1479) and seated the same evening. Scope stands passed by that approval; this chain runs Plan · Implement · Review · Ship. Time contract 592 (holder v546-chain): the Plan published on the row by 22:35 CT, Thu 2026-11-19 (America/Chicago); later phases take their own contracts as claimed. All wanted ASAP; those are the hard deadlines.

THE DECISIONS, AS JOHN CHOSE THEM (two picks stand against the package recommendations — built exactly as chosen):

- Q1 A — A star button on the track row itself (day cards, podcast rows, Catechesis Novenas cards) AND in Now Playing's control row; the prayer book's gold star glyph (★ filled / ☆ outline).
- Q2 B (John's pick, NOT the recommended own-side A) — No new Pray side: a 'Starred' SECTION at the HEAD of the Praylist side, above today's blocks. John's comment: "Top, not bottom."
- Q3 A (John's pick, NOT the recommended rows-play-singly B) — The Starred list PLAYS AS A LIST: Play all and queue acts on the whole list; the mixed-kind queue machinery cost is accepted (the v542 queue holds one kind only today — this release builds what a mixed list needs). John's comment: "I just want it all to play."
- Q4 A — A NEW server table for starred tracks, migration 0041, whole-list PUT in the v470 prayer-book discipline; existing book favorites carry in, so the book star and the starred list are ONE system: a track starred anywhere reads starred everywhere.

Package-named bounds that stand: queue rows inside Now Playing carry no star · written prayers join the same list through their existing book star · the star act toggles (star / un-star is the same act) · the list orders most recently starred first · the empty state reads "No starred tracks yet — tap ☆ on any track and it will stand here." · a star binds the track, not one standing of it (an episode in two blocks stars once; a novena track's star binds that episode across the novena's run; a written prayer's star binds the prayer, never one language take).

GROUNDING (production v544, main 030bbc91 — the consolidated main; Worker 991cd16d, pin ora-pro-nobis-v544-1 — re-read at seating):

- The book favorites (v470): table prayer_book_favorites (migration 0028: slug PK · sort_order · updated_at); index.ts bookFavorites() reads slugs in stored order, missing table reads empty, never an error; the session PUT /api/prayer/book/favorites validates every slug against prayer_book, dedupes first-occurrence, replaces whole in one batch, answers the stored list re-read; the door mirror GET reads only. Client: state.bookFavs is the working copy, opn-book-favs-v462 the device mirror; bookFavsLoad carries the mirror up once when the server stands empty; toggleBookFav toggles + repaints + PUTs through bookFavsSync. The star button is .bookstar (ui.ts:379 — gold, 19px), emitted on book rows and the prayer page (data-bookstar).
- Played marks: day tracks device-local (opn-played-v344, v344, keyed by canonical episodeId, per-occurrence episodeId|block for repeats); podcast listens server-side (podcast_listens, 0017, series + seq_key). Neither is a model for this store — Q4 A follows the v470 server pattern, as the package ruled.
- Track identity: a day episode carries one canonical episodeId (a novena's id is the same on all nine days); a podcast episode is named by series + seq_key (the descriptor's episodeId IS the seq_key alone — podDesc, client.ts:5918 — so a podcast star key carries its series); a written prayer is named by its book slug (its spoken take's id is prayer:<slug>:<language> — the star binds the slug).
- Day cards: trackCard (client.ts:10194) — the available branches carry the .prow-cluster in the title line, reading played dot · ⋮ (the play disc stands on the thumbnail since v456); the unavailable branches carry no cluster (no acts that cannot be honored, the v413/v424 rule).
- Podcast rows: podRowString (client.ts:6820, audio series pages) and rssRowString (client.ts:6577) carry the cluster podmark · ⋮ in the title line; the own-series page (paintPodOwnSeries, client.ts:6448) carries no cluster — its episodes are day-form descriptors (podOwnDesc) and also stand in the day build. Video series rows are watch rows, not tracks — no star (they carry no play act in the player).
- Now Playing: openNowPlaying (client.ts:10453) — the controls row reads Intentions · Read · ⋮ (np-intentions · np-read · np-menu); updateNowPlaying repaints per track change; renderQueueList paints the queue rows below (no star stands there, per the bound).
- The player: playTrack (single play, clears the queue) · startQueue(descs, force) · addToQueue (v542: the kind bound — a track joins only a standing queue of its own kind, queueKindIsPod reads the current/first entry) · advanceQueue walks state.queue through queueLiveDesc (day entries re-resolve against today's build by (episodeId, block); podcast entries stand on their snapshot) · the 'ended' handler advances the queue and, at its end with autoplay ON, chainForward chains through the day · nativeContractFor builds the Android contract from the standing queue (form follows the start item; items resolve per kind through nativeContractItem; a day queue with autoplay ON gains the unplayed day tail after the queue's last item) · saveQueueSnapshot persists the queue in a podcast form (one series) or a day form (ids + blocks + date) — neither form holds a mixed queue.
- The Praylist side: renderPrayersSide → buildDayFromPayload → paintListenHome — profileCardHtml, then the block rows (homeBodyHtml: orderedBlocks + the episodes row), then the offline line. The Starred section's seat is between the profile card and the block rows: the head of the side, above today's blocks.
- Migrations stand at 0040 (prayer_track_draws); 0041 is this release's. The SW pin stands at ora-pro-nobis-v544-1 (ui.ts:908); the ship bump is ora-pro-nobis-v546-1.

BOUNDS: no existing table is altered; prayer_book_favorites (0028) stands as the carry-in source and its routes stand untouched. The prayer seats stand byte-preserved — the preMass seat reads [prayer-before-mass] as flagged to John 2026-11-19; it is not touched, not re-seeded. No change to the played stores, the queue's standing acts for non-starred queues (the v542 kind bound stands for every menu act), or any stored value outside the new table.

## 2 · Plan

One server migration, one server block, one client block, one CSS rule. A v546 comment in the standing form records each change at its seat.

### 2.1 Migration 0041 — app/migrations/0041_starred_tracks.sql

In the 0028 mold (additive, no down-migration, a rollback leaves the table standing and unused):

```sql
CREATE TABLE IF NOT EXISTS starred_tracks (
  star_key TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL,
  entry TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

One row per star. star_key is the track's own key in one string: `episode:<episodeId>` · `podcast:<series>:<seqKey>` · `prayer:<slug>`. entry is the star's JSON snapshot (§2.2). sort_order is the list order — most recently starred first (a new star takes the head; the client owns the order, the server stores it).

### 2.2 The store's shape — one entry object

`{ k: 'episode' | 'podcast' | 'prayer', id, series?, title, sub, durationS, imageUrl, block, url, date }` — id is the episodeId / seqKey / slug by kind; series stands only on podcast entries; title + sub are the row's words (sub: the kind line — block name for an episode, series title for a podcast, 'Written prayer' for a prayer); url is the play snapshot (a day descriptor's streamUrl, a podcast entry's stream URL, null for a prayer); date is the presented date the track was starred on (provenance; the resolution below reads live sources first). The snapshot is a fallback, never the first read: it plays only what no live source still carries.

### 2.3 Server — app/worker/src/index.ts, one block beside the book favorites

- `starredTracks(env)`: the stored entries in stored order (SELECT star_key, entry ORDER BY sort_order, each entry parsed; an unparseable row is skipped). A missing table (pre-0041) reads as an empty list, never an error (the bookFavorites posture).
- Session GET /api/prayer/starred → { ok: true, starred: [...] }.
- Session PUT /api/prayer/starred { starred: [...] }: the v470 PUT discipline in form — every entry validated, the rows replaced in one batch with sort_order = index, the answer the stored list re-read. Validation (every failure a named 400 that writes nothing): the body must be an array of at most 500 entries; each entry an object with k in {episode, podcast, prayer}, a non-empty id (≤ 200 chars), a string title (≤ 300 chars); a podcast entry must carry a non-empty series; a prayer entry's id must stand in prayer_book (validated against the book, as the 0028 PUT validates slugs); url, when present, a string ≤ 2000 chars. Deduped by star_key, first occurrence stands.
- Door mirror GET /api/agent/prayer/starred — the same body, read-only (the v328 posture; writes are John's, session-only). It stands before the prayer/starred session route's segment matching wherever the door's router requires, on the book-favorites precedent.
- The book favorites routes (GET/PUT /api/prayer/book/favorites, the door mirror) stand byte-identical; the 0028 table is read by the client once at carry-in (§2.4) and never written by this release's client.

### 2.4 Client — the starred store (client.ts, one block beside the prayer book block)

- `state.starred`: the working copy (array of entries, list order). Device mirror opn-starred-v546 (the opn-book-favs-v462 idiom: guarded parse, guarded write).
- `starKeyOf(kind, id, series)` / `starEntryKey(entry)`: the one key builder — 'episode:' + id · 'podcast:' + series + ':' + id · 'prayer:' + id.
- `starredLoad()`: called at the day build's settle (buildDayFromPayload's tail, beside settleTrackDraws) and from the book's load. GET /api/prayer/starred: a non-empty server list is adopted whole (state + mirror rewritten). An empty server list with a standing mirror adopts the mirror. An empty server list AND an empty mirror runs the CARRY-IN, once: GET /api/prayer/book/favorites — where slugs stand, they become prayer entries (in their stored order, titled from the book where it stands loaded, else the slug's book read at paint) and the unified list is PUT; the carry is one-way and idempotent (a later open finds the server standing). A failed read leaves the mirror standing as the working copy.
- `starredSync()`: PUT the whole working copy; the stored list the server answers with is adopted whole (the bookFavsSync form). A failed PUT keeps the mirror; the next toggle or open re-syncs.
- `toggleStar(entry)`: present → removed; absent → unshifted (most recent first). State + mirror update, refreshStarChrome() repaints every standing [data-trackstar] glyph from the store, the Starred section repaints if its slot stands, the prayer-book surfaces repaint through the book's own seat (§2.5), then starredSync().
- `refreshStarChrome()`: for every [data-trackstar] in the document, the glyph reads ★ when its key stands in the store, ☆ otherwise (the refreshPlayedChrome pattern). The Now Playing star is refreshed by updateNowPlaying (§2.6).

### 2.5 The book joins the one system (Q4 A's unification)

- bookFavsList() derives from the unified store: the prayer entries' ids, in list order. bookFavsSet retires; toggleBookFav(slug) becomes toggleStar on the prayer entry (titled from bookFind). bookFavsLoad retires into starredLoad (its carry-up leg is §2.4's carry-in). bookFavsSync retires into starredSync. The book rows, the prayer page star, and the book side's Favorites section paint exactly as today, reading the derived list — one system, the book's dress unchanged. The device mirror opn-book-favs-v462 is no longer written (it stands as a stale artifact of the old system, read by nothing).

### 2.6 Star seats (Q1 A)

One button form everywhere: `<button class="trackstar" data-trackstar="<star_key>" aria-label="Star">★/☆</button>`, wired by ONE delegated document click handler installed once at boot (the button is self-describing; the handler stops propagation, resolves the entry by key kind — §2.7 — and calls toggleStar). Queue rows carry no [data-trackstar] under any paint (the bound).

- Day cards (trackCard): the cluster reads played dot · star · ⋮ on the branches that carry the cluster (the available branches). The star's key is the card's episode id (kind episode). Unavailable cards carry no star (no cluster stands there — the standing rule).
- Podcast rows: podRowString and rssRowString clusters read podmark · star · ⋮ (kind podcast, series = the open payload's series). The own-series page's rows gain the star at the title line's right (no cluster stands there today; the button stands alone in .titlerow) — its episodes are day-form, kind episode, keyed by their entry key.
- Catechesis Novenas cards (paintCatechesisNovenas): the star joins the card's control seat (the played dot's seat) on the same delegated form, kind episode, keyed by the novena episode id.
- Now Playing: a Star button joins the controls row — Intentions · Read · Star · ⋮ (id np-star, the .btn.ghost dress of its row-mates, its glyph ★/☆ in gold). Wired in openNowPlaying; updateNowPlaying sets its glyph from state.current's key (starKeyForDesc: podcast → podcast key with podSeries · prayer:<slug>:<lang> → the prayer's slug · else the episode id) and holds the slot's geometry like the Read slot (a current that cannot star — none stands in the taxonomy — would hold it invisible; every current kind stars).

### 2.7 Resolution — a starred entry back to a playable descriptor

`starredDescFor(entry)` (audio kinds only; a prayer entry opens its page instead):

- podcast: the open series payload, when it is the entry's series, resolves through podDesc (the live entry, its current URL and listened flag). Otherwise the snapshot descriptor stands: { episodeId: id, kind: 'podcast', seriesKey: id, podSeries: series, title, url, available: !!url, block: 'Podcasts', durationS, imageUrl }.
- episode: today's build first — the first descriptor in state.dayDescs with the entry's episodeId (the star binds the episode, not the occurrence) — the live descriptor, exactly as queueLiveDesc would substitute. Otherwise the snapshot: { episodeId: id, title, url, available: !!url, block, durationS, imageUrl } — its streamUrl as starred. In the native engine a past-day snapshot item resolves through oraSnapshotTrack against the presented day and drops from the contract when its day does not stand presented (the standing contract rule — named here as the mixed queue's one native bound; the element engine plays the snapshot whole).

### 2.8 The Starred section (Q2 B)

- paintListenHome gains the section between the profile card and the block rows: `<div id="starred-slot">` + paintStarredSection() — `<h2 class="sectionhead">★ Starred</h2>`, the acts row (Play all · Add all to queue, .btn.ghost.small), then the rows in list order, or the empty line ("No starred tracks yet — tap ☆ on any track and it will stand here.") with no acts row. The slot repaints on the day build, on starredLoad's settle, and on every toggle while it stands.
- A row (the mockup-4 dress): card trow prow — the art (the entry's image over the kind tile), the play disc on the art for audio kinds (data-starplay="<star_key>"), the title, the meta (sub · duration · the starred date's short label), and the filled star at the title line's right (data-trackstar — un-starring from the list is the same tap). A prayer row carries no disc; its tap opens the prayer page (openPrayerPage). An audio row's disc plays the single track through playTrack on the resolved descriptor (the standing single-play funnel).
- A row whose descriptor cannot resolve (no live source, no snapshot URL) paints without its disc and its meta gains "Not available" — it can still be un-starred.

### 2.9 List playback — the mixed-kind queue (Q3 A)

- Provenance: `state.queueFrom` — set to 'starred' by the section's two acts; cleared at every other queue birth (playTrack's head, startQueue's head, clearQueue, the 'ended' terminal clear, advanceQueue's exhaustion clear). addToQueue leaves it standing (an append to a starred queue keeps the list's end rule; an append anywhere else starts from null).
- Play all: the entries in list order → starredDescFor → the available audio descriptors, in order → startQueue(descs, true) → queueFrom = 'starred'. The act is explicit: autoplay's state does not gate it, and the day's chain never joins it (§2.9's end rule).
- Add all to queue: the same resolved list appended to the standing queue in addToQueue's shapes — appended behind a standing queue · forming [current, ...] on a single play · a waiting queue when nothing stands — WITHOUT the kind bound (the mixed act is the decision). queueFrom = 'starred' once any starred descriptor joins. The native leg mirrors addToQueue's: nativeSendNow() → nativeResendAtCurrent(); a paused engine takes it at the resume seam through the standing divergence read.
- The end rule: the 'ended' handler's queue-exhaustion branch chains forward only when queueFrom !== 'starred' — a starred queue stops at its end, whatever autoplay reads. nativeContractFor appends the day tail only when queueFrom !== 'starred' (its form still follows the start item, its items still resolve per kind — the contract's standing shape carries the mix).
- The snapshot bound: saveQueueSnapshot writes no record for a starred queue (its head removes the record and returns when queueFrom === 'starred') — neither standing form holds a mixed queue faithfully (the day form drops podcast entries at restore; the podcast form names one series), so a starred queue lives for its session and never restores. Named here, not discovered later.
- The standing acts are otherwise untouched: the row menus' Add to queue keeps the v542 kind bound against every queue, starred-born included (the section's acts are the mixed route); Clear queue stands; jumpQueueTo stands.

### 2.10 CSS — app/worker/src/ui.ts

One rule: .trackstar in .bookstar's dress (gold, no background/border, pointer) sized for the cluster seats, plus the Now Playing star's gold glyph inherits it by class where used. At Ship only: the SW pin bump to ora-pro-nobis-v546-1.

### 2.11 Fixtures + harness-v546

Fixtures from production (Improvement D): the standing production day fixture (tests/fixtures-v522/day-live-2026-11-17.json, drawn through the prayer door) and the production book + favorites read drawn through the prayer door at build time (the door's GET book + GET book/favorites bodies, saved under app/tests/fixtures-v546/). The harness (app/tests/harness-v546.mjs, the v544 Chromium mold, stubbed fetch) proves:

- S statics: the diff confined to client.ts · index.ts · ui.ts (the one rule; the pin unmoved on the build tree) · migration 0041 stands and no migration past it · mass*.ts and logo*.ts byte-identical to the base (main 030bbc91).
- T1: a day card's cluster reads dot · star · ⋮; a tap fills the star and the track stands at the Starred section's head; the section stands above the first block row.
- T2: the Now Playing star toggles the playing track; the same track reads starred in the section.
- T3: a podcast row's star (stubbed series payload) fills; the entry stands in the section with its series named.
- T4: a Catechesis Novenas card's star fills; the novena episode stands in the section.
- T5 (Q3 A): Play all on a mixed list (day episode + podcast episode + a past-day snapshot episode) builds the queue in list order across kinds; the ended-walk plays each in turn and stops at the list's end with autoplay ON (no day chain).
- T6 (Q3 A): Add all to queue appends the mixed list behind a standing single play of the other kind.
- T7 (Q4 A): a book star writes the unified store (the PUT body carries the prayer entry); the carry-in leg — GET starred empty + GET book/favorites holding slugs — PUTs the unified list with those slugs as prayer entries, once.
- T8: un-star from the section removes the entry everywhere (the row's star reads ☆ again); un-star everything paints the empty line.
- T9: the queue list inside Now Playing carries no star button on any row.
- G439: the standing v439 boot gate recorded as-is, never as a pass.

Compose discipline: onto production as it stands at compose time (at Plan: main 030bbc91, Worker 991cd16d, pin ora-pro-nobis-v544-1 — re-read at Ship) plus only the reviewed build, migration 0041 applied, and the pin bump; the branch worktree stands clean at compose; the harness re-runs on the composed tree.

Check-in (push-to-main, John's rule of 2026-11-19 20:27 CT): at Ship the release merges to main and main is pushed — GitHub main's standing head read immediately before the push (tonight's 00:00 CT production run also writes to main; the head re-read is the guard), the push a fast-forward, never a force-push. The build branch stays local and is deleted after the merge. The read-back reads "main pushed · remote in sync". If the merge is not clean, the check-in leg stops, the app still ships, and the report names the exact blocker. The devops-board repo takes this document's commit on its local main only (its GitHub divergence is package 48's Q5 item — no push improvised there).

Expectations (ASAP + hard deadlines, Thu 2026-11-19 America/Chicago): Plan published and passed by 22:35 CT (contract 592) · Implement + harness green by 23:20 CT · Review passed by 23:40 CT · shipped Live, served surface verified, check-in read-back by 00:05 CT.

## 3 · Implement

Built on local branch release/v546 off main 030bbc91 (the consolidated main), in the fresh worktree ~/workspace/.worktrees/v546 — the production checkout (standing on muse-draft-week with uncommitted work) was never entered. Build commit e5cbc1b01. Contract 593 (Implement): met and closed.

As planned (§2), with the build-time reads recorded where they refined the Plan's survey:

- Migration 0041 (app/migrations/0041_starred_tracks.sql): starred_tracks (star_key PK · sort_order · entry · updated_at), additive in the 0028 mold.
- Server (index.ts, one block): starredTracks() beside bookFavorites() (missing table reads empty, unparseable rows skipped); starKeyOfEntry(); the session GET + PUT /api/prayer/starred (seg form, beside the book favorites routes — validation as planned: kind/id/title bounds, a podcast entry carries its series, a prayer id must stand in prayer_book, dedupe by key first-occurrence, one batch replace, the answer the stored list re-read; every failure a named 400 that writes nothing); the door mirror GET /api/agent/prayer/starred (read-only, standing before the session segment matching on the book-favorites precedent). The book favorites routes and the 0028 table stand byte-identical (harness S4).
- Client store (client.ts, one block beside the book block): state.starred + the opn-starred-v546 mirror; starredLoad (server truth · mirror carry-up · the one-time carry-in of the 0028 favorites as prayer entries in stored order) called at the day build's settle beside settleTrackDraws and from the book's load; starredSync (the whole-list PUT, the stored list adopted whole); toggleStar (unshift/remove, chrome + section + book repaints, then the sync). The book joins the one system: bookFavsList DERIVES from the store's prayer entries; toggleBookFav routes through toggleStar; bookFavsLoad/bookFavsSync delegate to starredLoad/starredSync; state.bookFavs and the opn-book-favs-v462 mirror retire as stores (the mirror stands unwritten, read by nothing).
- Star seats (Q1 A), one delegated document click handler (installed once; the button carries only its key; starEntryForKey resolves the standing entry first, else the live track): trackCard's cluster reads played dot · star · ⋮ on the cluster branches; podRowString + rssRowString clusters read podmark · star · ⋮; the own-series page's rows gain the star at the title line's right (no cluster stands there — v456 retired it; the button stands alone, kind episode as those descriptors are day-form); the Catechesis Novenas cards carry the star beside the played dot (kind episode, the novena episode id), with wireCatechesisNovenas exempting the star tap from the card's play act; Now Playing gains the Star button in the control row (Intentions · Read · Star · ⋮), wired in openNowPlaying, its glyph following the playing track at openNowPlaying and every updateNowPlaying (refreshNpStar). Queue rows carry no star (renderQueueList byte-identical, harness S5b).
- The Starred section (Q2 B): paintListenHome seats #starred-slot between the profile card and the block rows; paintStarredSection paints the ★ Starred head, the acts row (Play all · Add all to queue) when the list stands, the rows in list order (art via rowArtHtml with the play disc on the art for playable audio entries, the meta = sub · duration · starred date · "Not available" where no descriptor resolves, a prayer row opening its page), or the package's empty line. A prayer row's title resolves live from the book where it stands loaded (the carry-in can land before the book's first load, titled by slug — the snapshot title is the fallback, never the standing read).
- List playback (Q3 A): state.queueFrom provenance — set 'starred' by the section's two acts, cleared at playTrack, startQueue, clearQueue, and advanceQueue's exhaustion (one line each, harness S5d). Play all = startQueue over the resolved available audio descriptors in list order (live day descriptor first, then the open series' podDesc, then the snapshot — starredDescFor), provenance set after the birth. Add all = addToQueue's three shapes without the kind bound. The 'ended' handler chains forward only when the provenance is not 'starred'; nativeContractFor appends the day tail under the same read (its form still follows the start item). saveQueueSnapshot writes no record for a starred queue (its head removes the record and returns) — the named snapshot bound of §2.9.
- CSS (ui.ts): exactly one added line — .trackstar in .bookstar's dress (harness S3a).

Fixtures (Improvement D): the standing production day fixture (fixtures-v522/day-live-2026-11-17.json) with track records injected under the production episode ids standing in its introTexts (the v542 mold), and the production book + favorites drawn through the prayer door at build time into app/tests/fixtures-v546/ (book-live.json: 9 groups / 77 prayers · book-favorites-live.json: John's standing favorites — prayer-after-communion · prayer-before-mass · grace-after-meals, in stored order). The podcast series payload stands in the v542 harness's shape.

harness-v546 (app/tests/harness-v546.mjs, the v542/v544 Chromium mold, stubbed fetch): 46 ok / 0 not-ok over the working tree — S statics (diff confinement; the book block, the Mass read, and the unmoved queue seams byte-identical; migration 0041 last) · the carry-in world (A1–A5: the empty store carries the production favorites in through one whole-list PUT, in stored order; the section lists them at the Praylist head; the book reads the same stars; the section's prayer rows take the book's titles) · the main world (B1 the seeded list at the head with both acts · T1 the day card's cluster order + tap + list head + PUT · T5 Play all's mixed queue in list order across kinds with no snapshot written, and the ended-walk stopping at the list's end with autoplay ON · T3 the podcast row's star carrying its series · T6 Add all behind a standing single play of the other kind · T9 no star in the queue rows, the control row's star toggling the playing track · T4 the Novenas card's star, no playback started · T8 un-starring from the section emptying the store, the section, and the final PUT) · G439 at its standing 13 ok / 2 not-ok, recorded as-is, never as a pass. T4's novena slot settles through the app's own settle seam (ownSettlePresent — the resolver's landing act) with a meta under the production novena id novena-st_cecilia: the feed resolution is standing machinery this release does not touch; the card paint, the star seat, and the toggle under test are the production code entire (named in the harness header).

## 4 · Review

Review contract 594. The harness re-ran over the COMMITTED tree — the worktree standing clean at build commit e5cbc1b01 (git status empty before the run; the harness reads its byte-comparison base from git at 030bbc91): harness-v546: 46 ok / 0 not-ok (app/tests/harness-v546-review.log), G439 again at its standing 13 ok / 2 not-ok, recorded as-is. The diff against the production base stands confined to client.ts · index.ts · ui.ts (one added CSS line) · app/migrations/0041_starred_tracks.sql · the harness and its fixtures · this document. The prayer seats stand byte-preserved: bookFavorites and massPersonalPrayers are byte-identical to the base, and the preMass seat — reading [prayer-before-mass] as flagged to John 2026-11-19 — is untouched and not re-seeded. Review passed on the row.
