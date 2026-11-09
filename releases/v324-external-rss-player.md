# v324 — External RSS sources in the app player

- **Project:** Ora Pro Nobis
- **Slug:** v324-external-rss-player
- **Registry:** DevOps Board app, project ora-pro-nobis, row id 590, version "v324", status Backlog, Run Directive "Scope only"
- **Branch:** release/v324 in the fork (~/workspace/projects/spotify_praylist-fork)
- **Run Directive:** Scope only — the Scope Gate holds this release at Scope. This document is the scope package for John (with the HTML package at ~/workspace/your_files/v324-scope-package.html); Plan does not open until John approves and sets the level, and Plan seats only after v312 stands Live.

## 1 · Scope

- **Agent:** Scope Agent (v324) — Scope claim record 1108, claimed 2026-11-09 01:51 UTC (2026-11-08 19:51 CT) · time contract 28
- **Inputs read:** the v324 registry row (id 590) · John's direction, Ora Pro Nobis thread, 2026-11-08 19:49 CT · the v312 release document in full (§1–§4 + the Ship amendment — the player store, the queue model, the missing-track rule) · `jobs/playlist/refresh_playlist.py` (the resolvers and `DEFAULT_TOKENS`) · `config/spotify/contracts/*.json` and `config/spotify/playlists/*.json` (the standing external-source contracts and their block placement) · `docs/releases/0.3.6.1-divine-office-preference-swap.md` (the settled source preference) · the three live feeds, fetched first-hand this pass (2026-11-08 ~19:56–20:05 CT), with enclosure-host transport probes

### John's direction (settled — not re-opened by this section)

John, Ora Pro Nobis thread, 2026-11-08 19:49 CT, added this item with the model in his own words: **"Basically user downloads from rss."**

- **Sources:** the Divine Office show and Bible in a Year join the app player by tapping the shows' own RSS feeds. (Sing the Hours Lauds is the third external in the playlist contracts — its exact role is decision D2 below.)
- **Model:** the app reads each show's RSS feed, date/title-matches **today's** episodes (the playlist contracts already encode the matching — reuse that knowledge), and the player downloads/plays from the feed's enclosure URLs directly. **No copies into the app R2 store; their audio stays on their hosts.**
- **Same player, same queue:** background play and lock-screen controls apply like any track.
- **Today-centered:** presentation stays consistent with v312's one-day rule.
- **Honesty rule:** a feed unreachable or no matching episode today → the track stands in its block named **not-available**, never silently dropped (the v312 missing-track rule).
- **Sequence:** builds on v312's player store/queue — Plan seats only after v312 stands Live.

### The ground it builds on — v312 (verified from its document)

- The player reads **D1 only**: the nightly run pushes the day's episode entries at publish time (`POST /api/agent/player/day`, the replace-day commit); the live-RSS read path was deleted, not bypassed. Tables: `player_episodes` (PK `(date, episode_id)`; `block` = one of the six block names or `'unblocked'`; `sort`; `audio_state` present/missing; `r2_key`) and the `player_day` singleton.
- Track shape: `{episodeId, title, kind:'episode', available, streamUrl, durationS, sizeBytes}` where `streamUrl` is the app's own ranged route `/api/player/audio/<date>/<episode_id>` for present rows, `null` for missing rows. **The count includes missing rows** — a missing track is named in place, never dropped.
- The replace-day commit verifies every present row's staged R2 object size before writing; one-day retention deletes every other date's rows and objects.
- **Consequence for externals (named for Plan):** an external track's audio is not in R2, so it cannot ride `r2_key` / the app audio route as they stand, and it must stand outside the commit's staged-size verification. The store needs a way to carry an external stream address. That is Plan's design work; the constraint is Scope's to name.

### The standing contracts — the matching knowledge, verified in the fork

The playlist system already resolves these shows daily (for Spotify). The contracts are config + resolver code in the fork:

- **Shows:** Divine Office (Spotify show `70ydTdzunoqWAsvutFIkHM`) · Sing the Hours (`5MvuGtXFIbfej3dz8cKBVp`) · Bible in a Year (`4Pppt42NPK2XzKwNIoW7BR`). Contract files: `divine-office-invitatory.json`, `morning-prayer-loh.json`, `office-of-readings.json`, `midmorning-prayer.json`, `midday-prayer.json`, `midafternoon-prayer.json`, `evening-prayer-loh.json`, `night-prayer-loh.json`, `bible-in-a-year.json`.
- **Divine Office title matching** (`do_date_aware` + `DEFAULT_TOKENS`): an episode matches an hour when its title contains the hour term **and** a month-day date (today, else yesterday): Invitatory = `Invitatory`/`Invitatory Psalm` · Morning = `Morning Prayer` · Office of Readings = `Office of Readings` · Midmorning = `Midmorning Prayer` · Midday = `Midday Prayer` · Midafternoon = `Midafternoon Prayer` · Evening = `Evening Prayer`/`Vespers` · Night = `Night Prayer`/`Compline`.
- **Sing the Hours matching** (`sth_match_today`): the title carries the date prefix `M.D.YY` (e.g. `11.8.26`) plus the token `Lauds` (morning) or `Vespers` (evening).
- **Bible in a Year matching** (`bible_in_a_year_for_today`): the episode for calendar day N (day-of-year, 1–365) is the one whose title matches `Day\s*0*N`; among years, the newest year wins.
- **Settled preference (release 0.3.6.1, shipped):** for the Morning and Evening slots, **Divine Office is primary and Sing the Hours is the fallback** when Divine Office has no match. Sing the Hours appears in the contracts in exactly that role — it is not a separate slot anywhere in the day.
- **Block placement (the standing playlists = the app's six blocks):** Morning ← Invitatory · Morning Prayer · Bible in a Year · Midmorning block ← Midmorning Prayer · Midday block ← Midday Prayer · Afternoon block ← Midafternoon Prayer · Evening block ← Office of Readings · Evening Prayer · Night block ← Night Prayer.
- **Other externals the contracts carry** (USCCB Daily Readings, Saint of the Day, Daily TV Mass, the Sunday homilies) are **not** in this item — John named Divine Office and Bible in a Year. They are named here so John can add any of them by name; absent his word they stay out.

### Live feed evidence — fetched first-hand, 2026-11-08 evening CT

**Divine Office — `https://divineoffice.org/feed/podcast/`** (the show's canonical feed, per its Apple Podcasts listing)
- 1,347,612 bytes · 114 items (the feed keeps only ~12 days by design) · response carries **two** `Access-Control-Allow-Origin` headers (`*` and a specific origin) — a combination browsers reject for `fetch()`; see the read-path options.
- Title form, exactly as the contract expects: `November 8th, 2026 – Morning Prayer – Divine Office: Liturgy of the Hours`.
- **Today (Sun Nov 8) is complete — all eight hours, each with an enclosure:** Invitatory (4,270,940 B) · Office of Readings (37,640,477 B) · Morning Prayer (28,358,685 B) · Midmorning Prayer (11,299,324 B) · Midday Prayer (14,208,104 B) · Midafternoon Prayer (11,928,353 B) · Evening Prayer II (25,898,474 B) · Night Prayer (8,806,504 B). Enclosures are `audio/mpeg` on `media.blubrry.com` → `traffic.libsyn.com`.
- **Timing:** today's hours were published Nov 7 from 17:43 UTC (11:43 AM CT) — the full day stands in the feed well before the midnight push.
- **Two traps, verified in today's feed:** (1) announcement items carry the same date-title form with **no enclosure** ("This Week: …", "Second Edition Update: …") — one even carries the word "Vespers" — so **an enclosure is part of the match**: a title match without an enclosure is not a track. (In the Spotify catalog every episode has audio by construction; in RSS it does not.) (2) The feed holds both `November 7th – Evening Prayer I` and `November 8th – Evening Prayer II` — the title-date rule must take date == target date; yesterday's Evening Prayer I must not displace today's Evening Prayer II. (The Spotify rule's today-else-yesterday acceptance does not carry over blindly; Plan pins the I/II handling on this evidence.)

**Bible in a Year — `https://feeds.fireside.fm/bibleinayear/rss`** (Ascension, Fr. Mike Schmitz)
- 9,183,467 bytes · 1,867 items (the whole multi-year catalog) · **no `Access-Control-Allow-Origin` header at all** — a browser `fetch()` from the app is blocked outright.
- Today is day-of-year **312**. The feed holds five `Day 312` items (2022–2026). The 2026 item — `Day 312: Conclusion to the Old Testament (2026)` — carries pubDate **Sun, 08 Nov 2026 03:15:00 -0500 = 2:15 AM CT**: it posts **after** a midnight-CT resolution. Enclosure 16,500,772 B via `dts.podtrac.com` → `aphid.fireside.fm`.
- **Consequence (pinned):** at the midnight push, the newest `Day N` item standing in the feed is *last year's*. The Spotify rule ("newest year wins") would select it. For the app the rule must be **current-year only**: before today's item posts, the track stands **not-available** — last year's recording is never silently substituted for today's — and a morning re-resolve (decision D3) lands it once it appears.

**Sing the Hours — `https://feeds.castos.com/x8g54`** (Paul Rose)
- 324,130 bytes · 25 items · feed sends `Access-Control-Allow-Origin: *` (the only one of the three cleanly fetchable from a browser).
- Title form, exactly per `sth_match_today`: `Divine Office 11.8.26 | Sunday Morning Prayer | Lauds`. **Today's Lauds and today's Vespers II both stand in the feed** (Lauds published Sat 11:20 AM CT; Vespers Sat ~10:00 PM CT — both before the midnight push).
- Enclosures on `episodes.castos.com`, 36–46 MB each — Sing the Hours records at a high bitrate; its two files are the largest in this item. Streaming only; no storage cost to the app.

**Enclosure transport probes (this pass):** Castos answers a ranged request directly with **206 + Content-Range**. Fireside answers **206 + Content-Range + Accept-Ranges: bytes** after its redirects. Libsyn (Divine Office) advertises **Accept-Ranges: bytes**; a ranged probe through its two-redirect chain answered 200 rather than a clean 206 — final-host seek behavior is a Plan/on-device verification item, **not** assumed. Playback itself (an audio element pointed at the enclosure URL) needs no CORS on any host and follows the redirects; **offline caching via `fetch` does need CORS**, which Castos and Fireside enclosures do not offer — see the next section.

**What "user downloads from rss" can honestly mean in the app (named plainly):** at play time the player points its audio element at the enclosure URL and the audio downloads/streams progressively **from the show's own host** — that is the download, and background play + lock-screen controls (the app's own machinery, keyed off the audio element, not the URL's host) apply unchanged. **Offline pre-download of external tracks is out of this release's reach** without a proxy: two of the three enclosure hosts send no CORS headers, so the app cannot `fetch`-cache their files. Nothing in this release copies external audio anywhere.

### The read-path decision — options on the evidence

- **A · Resolve at the nightly push (RECOMMENDED).** The standing app push gains an externals leg: at publish time the pusher fetches the three feeds server-side (no CORS exists server-side), applies the contract matching (hour term + title-date == target date + enclosure required · Sing the Hours prefix+token as fallback · Bible in a Year day-of-year, current-year only), and writes external rows into `player_episodes` carrying the enclosure URL as the track's stream address, `audio_state` present/missing by match result. The player still reads D1 only — **v312's rule 1 stays intact** — and the nightly report names each external track present/missing, like the standing stored-day read-back. Because Bible in a Year's item posts at 2:15 AM CT, the leg includes a **morning re-resolve of the external rows only**, riding the standing morning-watchdog hour pattern (Plan seats the exact vehicle); until it lands, that track stands not-available.
- **B · Worker resolves at read.** The app Worker fetches the feeds when the day payload is requested. Rejected: it reintroduces exactly what v312 removed — read-time dependence on external files, including parsing a 9.2 MB catalog on the request path — and the day payload stops being a pure store read.
- **C · Client resolves.** The phone fetches the feeds. Rejected on evidence, not preference: Bible in a Year's feed sends no CORS header (blocked), Divine Office sends two conflicting ones (browser-rejected), and the phone would parse 9.2 MB to find one item. Only Sing the Hours would work.
- **D · Worker feed proxy for the client.** The Worker fetches and re-serves the feeds so the client can resolve. Named for completeness; it keeps the read-time external dependency and the phone-side parse cost of C. Not recommended for v1.

### Decisions for John (each with the Scope recommendation)

- **D1 — The source list.** **Recommended: exactly three sources** — Divine Office (all eight hours), Bible in a Year, and Sing the Hours in its contract role (D2). The other contract externals stay out unless John adds one by name.
- **D2 — Sing the Hours' role.** **Recommended: fallback only**, exactly as the contracts carry it — Divine Office fills Morning and Evening first (the settled 0.3.6.1 preference); Sing the Hours' Lauds/Vespers fills the slot only when Divine Office has no match for today. The alternative — Sing the Hours as additional separate tracks — puts two versions of the same hour in the day.
- **D3 — The read path.** **Recommended: option A** — resolution at the nightly push plus a morning externals re-resolve, with the Bible in a Year current-year pin.
- **D4 — Placement within each block.** **Recommended: external tracks stand after the block's own episodes**, in the standing contract order (Morning: Invitatory · Morning Prayer · Bible in a Year · Evening: Office of Readings · Evening Prayer · and so on per the mapping above) — the podcast's own day keeps its flow, the externals complete the block. The alternative is externals first.
- **D5 — Labeling.** **Recommended:** the track's name is the hour/show name as prayed (`Morning Prayer` · `Bible in a Year — Day 312: Conclusion to the Old Testament`), with the **source named in the track's meta line** (`Divine Office` / `Bible in a Year` / `Sing the Hours`) using the app's standing meta styling; a not-available external stands with its name plus **"Not available today"** (the v312 missing-track naming). The alternative is no source tag.

### Scope Record

- **Outcome:** today's Prayers tab carries the day's external hours and Bible in a Year in their blocks, playable in the same queue as the podcast's own episodes, with the audio served from the shows' own hosts — and any external that cannot be matched today stands named not-available in its place.
- **In scope:**
  1. **The externals resolution leg** on the standing push: the three feeds fetched server-side at publish time; the contract matching ported (terms + month-day · prefix+token · day-of-year) with the two RSS pins (enclosure required · title-date == target date, incl. the Evening Prayer I/II handling); Bible in a Year current-year only; the **morning externals re-resolve**.
  2. **External rows in the player store**: rows in `player_episodes` for the target date carrying the enclosure URL as the stream address and present/missing by match result, standing outside the R2 staged-size verification; one-day retention unchanged — yesterday's external rows leave with yesterday's day, and **no external audio ever enters R2** (verified by the bucket listing at Review).
  3. **Placement + labeling** per D4/D5 as approved, in the six blocks per the contract mapping; external rows count in each block's track count, missing ones included (the v312 count rule).
  4. **Playback parity:** external tracks join both Play All shapes and the continuous queue; background play, lock-screen/media-session controls, autoplay-next, and resume treat them like any track.
  5. **The report:** the nightly (and morning re-resolve) report names each external track present/missing for the day — the standing read-back pattern, extended.
- **Out of scope:** any copy of external audio into the app store (R2 or D1) · offline pre-download/caching of external audio · feed fetching at read time (Worker or client) · any external show beyond D1 as approved · changes to the podcast's own episodes, their push, or their audio · the Spotify playlists and watchdogs (unchanged — they keep resolving the same contracts for Spotify) · the shows' feeds and hosts (their timing is a fact this design absorbs, not a thing this release changes) · any Pam surface (the app is John-only).
- **Affected surfaces:** the nightly push (`jobs/push_episodes_to_app.py` + the app-door day commit's shape for external rows) · the app D1 store (an external stream address — Plan) · the player day payload + the client (external rows render and play) · the nightly/morning reports. **Plan seats only after v312 stands Live** (John's sequence); this Scope was written against v312's shipped design while its Ship lands.
- **Review placement:** **before the trunk landing** (the v312 precedent — a data-path + client change), with a candidate deployment; external playback on John's phone is a Review criterion (criterion 6 below), as background play was for v312.

### Acceptance criteria

1. On a normal morning, today's Prayers tab shows the external tracks in their blocks per the contract mapping (eight Divine Office hours across the six blocks + Bible in a Year in Morning; Sing the Hours only where it filled a fallback), each playable in the same queue — and the app R2 listing holds **no** external object.
2. Matching follows the contracts as pinned: Divine Office term + title-date == today + enclosure present; Sing the Hours prefix+token, fallback only; Bible in a Year = today's day-of-year, current year only — last year's episode is never presented as today's.
3. A show with no matching episode today, or a feed unreachable at resolve time, leaves its track standing in its block named not-available; the day's other tracks are unaffected, and the report names the miss.
4. The one-day rule is intact: yesterday's external rows are gone with yesterday's day; the store holds exactly one day.
5. The player read path stays D1-only: no feed fetch at read time in the Worker or the client (harness/grep evidence, the v312 pattern).
6. **Phone check (John's verdict, Review):** play an external track, lock the phone — audio continues; lock-screen next/previous crosses between the podcast's own and external tracks in queue order; seek works on an external track.

### Concerns and Information Needs

- **Facts:** all feed figures, title forms, enclosure hosts/sizes, header facts, and probe results above were measured first-hand this pass (2026-11-08 ~19:56–20:05 CT) · Divine Office's eight hours for today total ≈ 142 MB of audio if every one is played in full — streaming only, no storage, but cellular data is spent as played · the three feeds' publication timing (Divine Office complete by the evening before · Sing the Hours by ~10 PM CT the evening before · Bible in a Year 2:15 AM CT the day itself) is the fact that shapes D3's morning leg.
- **Assumptions:** the shows keep their standing title forms and feed addresses (the contracts' matching depends on them; a title-form change at a show reads as not-available, named in the report — the honesty rule absorbs it) · the nightly push remains the day's single write path, so the externals leg rides it rather than inventing a second writer.
- **Uncertainties:** Libsyn's final-host seek behavior (the probe ambiguity above) — Plan verifies against the final host and Review verifies on the phone · whether the morning re-resolve's cleanest seat is the push job's own morning pass or the 05:40 watchdog hour — Plan's call, the requirement (external rows re-resolved on the morning of the day) is Scope's · Divine Office's double `Access-Control-Allow-Origin` would matter only to a future client-fetch design; it is recorded so that design is never proposed on a false premise.
- **Decision impact:** D1–D5 are John's at approval; every other choice in this section follows the standing contracts or the measured feed evidence.
- **First source to check:** `jobs/playlist/refresh_playlist.py` (`DEFAULT_TOKENS`, `do_date_aware`, `sth_match_today`, `bible_in_a_year_for_today`) and the three live feeds at the addresses above.

### Recommended approval level

- **Recommendation: Through Review (level 4).**
- **Reason:** the design rests on settled contracts and measured feeds, but two things verify only in the doing — external-stream behavior on John's actual phone (criterion 6, the v312 pattern) and the external-row shape in the store. Through Review lets the chain run Scope · Plan · Implement · Review without further words and stops before Ship for John's word with the phone check in hand. Plan seats only after v312 stands Live regardless of level. Plain "approve" sets this level.
