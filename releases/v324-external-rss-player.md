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

## 2 · Plan

- **Agent:** Plan Agent (v324) — Plan claim record 1127, claimed 2026-11-09 03:09 UTC · time contract 49
- **Approval on record:** John, voice call in the Ora thread, 2026-11-08 21:06 CT — "Oh I approve the RSS." Level: **Through Review**. The recommended answers to D1–D5 stand (D1 exactly three sources · D2 Sing the Hours fallback-only · D3 read-path option A · D4 externals after the block's own episodes · D5 source in the meta line, "Not available today" for a miss). Run Directive on row 590 carries the same words and was read back at seating.
- **Base:** branch `release/v324` rebased onto trunk `muse-draft-week` at **53dc63f** (v327's Ship merge) before this section was written; §1 rides at 6890a34. Trunk state this Plan designs against: v312 Live (player store + push) · v320 Live (sleep timer) · v327 Live (episode-id pattern widened at both enforcement sites). v318-app and v325 are NOT in this base — they land before this item builds (§2.10 pins the sequence), so the design is written against the **post-v325 player**: Intentions card spliced at index 0, harness-v318's text fields standing in the track shape.
- **Production fact verified at Plan (2026-11-09 ~03:05 UTC):** the app's stored day is the **current Chicago date's** day (stored-day read-back: 2026-11-08, 17 episodes, on the evening of Nov 8). The midnight publish pushes the day whose date it is; the resolver's target date is therefore always the stored day's date, in both modes (§2.6, §2.8) — never a computed "today" at a different layer.

### 2.1 Chosen approach — option A, one store, one helper, two modes

§1's option A stands: resolution happens server-side at the push; the player keeps reading D1 only. The design in one paragraph: the nine external **slots** (§2.2) become rows in the standing `player_episodes` table, distinguished by a new `kind` column (migration 0009, §2.3), carrying the enclosure URL in a new `stream_url` column and the source name in a new `source` column. They ride the **same replace-day commit** as the day's own episodes at the midnight publish (the commit stays the day's single write path; §2.4), resolved by a new resolver module the push helper calls (§2.6, §2.7). A dedicated externals-only door route (§2.5) serves the **morning re-resolve** (§2.8), which can rewrite only those nine rows. The payload builder branches once on `kind` (§2.9); the client branches once on `kind` for the meta line and the not-available wording (§2.9). Rejected alternatives: a separate `player_externals` table (a second ordering domain — the payload's per-block `ORDER BY sort` interleave would need a merge in code, and the one-day sweep would need a second delete; the single table keeps every standing query true) · resolving inside the Worker at push-commit time (the feeds total ~10.8 MB of XML; parsing belongs in the job layer that already runs Python, not in the Worker's request path) · a client-side or read-time fetch of any kind (§1 options B/C/D, already rejected on evidence).

### 2.2 The slot table — nine slots, fixed forever in this release

One row per slot per day, present or missing — the slot set never varies, which is what makes the morning swap count-invariant (§2.5). Slot ids match the commit's episode-id pattern (`^[A-Za-z0-9][A-Za-z0-9\-_]*$` after v327) and are **slot-neutral**: the id names the slot, never the source, because the fallback can change who fills it.

| # | episode_id | block | Display title | Primary source | Fallback |
|---|---|---|---|---|---|
| 1 | `ext-invitatory` | Morning | Invitatory | Divine Office | — |
| 2 | `ext-morning-prayer` | Morning | Morning Prayer | Divine Office | Sing the Hours (Lauds) |
| 3 | `ext-bible-in-a-year` | Morning | Bible in a Year — Day N[: subtitle] | Bible in a Year | — |
| 4 | `ext-midmorning-prayer` | Midmorning | Midmorning Prayer | Divine Office | — |
| 5 | `ext-midday-prayer` | Midday | Midday Prayer | Divine Office | — |
| 6 | `ext-midafternoon-prayer` | Afternoon | Midafternoon Prayer | Divine Office | — |
| 7 | `ext-office-of-readings` | Evening | Office of Readings | Divine Office | — |
| 8 | `ext-evening-prayer` | Evening | Evening Prayer | Divine Office | Sing the Hours (Vespers) |
| 9 | `ext-night-prayer` | Night | Night Prayer | Divine Office | — |

- **Sort:** `900 + slot #` (901–909). Own episodes carry the manifest's small sorts, so inside every block the order reads: Intentions card (post-v325 splice) → own episodes → externals in slot order. That is D4 read with the Intentions-first pin, exactly.
- **Display titles (D5):** Divine Office and fallback-filled slots show the bare hour name from the table (never the feed's dated title). Bible in a Year shows `Bible in a Year — Day N` plus `: <subtitle>` when present, where subtitle = the feed title with the leading `Day N:` stripped and a trailing `(YYYY)` stripped (2026-11-08's item renders `Bible in a Year — Day 312: Conclusion to the Old Testament`). A missing Bible in a Year row shows `Bible in a Year — Day N` (N is always known — it is the target date's day-of-year). A missing slot's `source` = its primary source name.
- **Counts:** external rows count in each block's track count, missing included (§1 in-scope #3 — the standing `trackCount = tracks.length` already does this once the rows stand in `player_episodes`).

### 2.3 Storage — migration 0009 and the stored shape

- **Migration number: `0009`** — pinned against the app sequence as it stands at Plan time: trunk carries `app/migrations/0001`–`0007`; `release/v318-app` carries `0008_player_episode_text.sql`; v325 carries none; v327 carried none. **Implement re-confirms 0009 is still the next free number at its seating** (v326, §2.10, is the only other app item in flight) and stops for the Coordinator if it is not.
- **File:** `app/migrations/0009_player_episode_external.sql` — three additive columns on `player_episodes`, each `TEXT NOT NULL DEFAULT ''` except kind's default:
  - `kind TEXT NOT NULL DEFAULT 'episode'` — `'episode'` | `'external'`
  - `source TEXT NOT NULL DEFAULT ''` — display source name (`Divine Office` · `Bible in a Year` · `Sing the Hours`)
  - `stream_url TEXT NOT NULL DEFAULT ''` — the enclosure URL for a present external row; `''` otherwise
  Additive-with-defaults is the safe shape here (no table rebuild): every pre-v324 row and every pre-v324 code path reads the defaults and behaves exactly as today — this is also what makes the rollback in §2.13 a pure redeploy.
- **Stored shape of an external row:** `episode_id` per §2.2 · `title` per §2.2 · `block` per §2.2 · `sort` 901–909 · `duration_s` from the feed's `itunes:duration` when parseable (`HH:MM:SS` | `MM:SS` | bare seconds), else 0 (the client already omits a zero duration) · `size_bytes` = the enclosure's `length` attribute, informational only — **never verified against anything** · `r2_key` = `''` always · `audio_state` = `present` on a match, `missing` otherwise · `stream_url` = the enclosure URL verbatim on a present row (redirects are the audio element's business, as §1's probes established), `''` on a missing row.
- **Artwork: not carried.** The feeds offer show-level images; the player has no per-track artwork surface. Considered and cut at Plan, named here so Implement does not invent one.
- **No external audio ever enters R2** — no staging call exists for external rows anywhere in this design (§2.11 check 25 proves the bucket stays clean).

### 2.4 The replace-day commit — external rows ride it, outside its verification

`POST /api/agent/player/day` (app/worker/src/index.ts, the v312 E2 route) gains exactly three behaviors; everything else is byte-unchanged:

1. The manifest entry shape gains optional `kind`, `source`, `stream_url`. Absent `kind` = `'episode'` (the standing v312 helper shape keeps committing — regression-proven by harness-v312 at Implement). An entry with `kind: 'external'` must carry one of the nine pinned slot ids (else 400, named) and a block equal to the slot's pinned block (else 400, named).
2. The staged-size verification loop (step (i)) skips `kind: 'external'` entries entirely — an external row's audio is never staged, so there is nothing to verify; an own episode's verification is untouched (a wrong staged size still aborts with the named 409).
3. The INSERT gains the three columns; an external row's `r2_key` binds `''` regardless of `audio_state` (the standing bind derives the key from `audio_state` for episode rows only — pin the branch on `kind`, not on state).

`player_day.episode_count` continues to bind `eps.length` — now own + 9. The commit's read-back (`rowCount`, `perTrack`) covers external rows like any row; `perTrack.audio` for an external present row reads `"verified"` in the sense *stored as resolved* — pin the helper (§2.7) to count externals from the resolver result and the stored-day read-back, not from `perTrack`, so the word never overclaims.

### 2.5 The externals door route — the morning write path, externals only

New agent-door route: `POST /api/agent/player/externals`, body `{date, tracks: [<the nine slot entries, manifest shape>]}`. Pinned behavior:

- **Guards, each a named refusal that writes nothing:** `date` ≠ the stored day's date → 409 `externals date <d> is not the stored day <s>` · the track set is not exactly the nine pinned slot ids → 400, naming the difference · any track's block ≠ its slot's pinned block → 400, named. A `kind` in the body is ignored — the route writes `kind='external'` unconditionally.
- **Write:** one D1 batch — `DELETE FROM player_episodes WHERE date=? AND kind='external'` + the nine INSERTs (same column shape as §2.4). It touches nothing else: own-episode rows, `prayer_audio` segments, and `player_day` are outside its reach by construction. `episode_count` needs no update — the swap is 9-for-9, count-invariant.
- **Reply:** `{ok, storedDate, externalsPresent, externalsMissing, perSlot: [{episode_id, audio_state, source}]}` — the morning report (§2.8) prints from this plus the stored-day read-back.
- The route is agent-door only, like every player write (the standing `isAgent` gate); no session surface gains a write.

### 2.6 The resolver — `jobs/externals_resolver.py`, the contract matchers ported

A new module beside the push helper. It imports nothing from the Spotify stack (no spotipy, no network but the three feeds) and exposes `resolve_externals(target_date) -> list[manifest entry]` — always exactly nine entries, in slot order. The matchers are **ports** of the standing contract code in `jobs/playlist/refresh_playlist.py`, cited by function so a reader can diff the behavior:

- **Divine Office** — port of `do_date_aware` (L348) with `DEFAULT_TOKENS` (L63) terms: `DO_INVITATORY` · `DO_MORNING` · `DO_OFFICE` · `DO_MIDMORNING` · `DO_MIDDAY` · `DO_MIDAFTERNOON` · `DO_EVENING` · `DO_NIGHT_ANY`, and `matches_month_day`/`date_regex` (L337–346) ported verbatim in behavior. Two RSS pins replace the Spotify behaviors, per §1's traps: **(a) the title-date must equal the target date** — the Spotify today-else-yesterday acceptance does NOT carry (yesterday's `Evening Prayer I` must never displace today's `Evening Prayer II`); **(b) an enclosure is part of the match** — a title match without an `<enclosure>` is not a candidate (the announcement trap). Among candidates for a slot, the first in feed order wins (the feed stands newest-first).
- **Bible in a Year** — port of `bible_in_a_year_for_today` (L566) with `day_of_year_1_to_365` (L560): N = the target date's day-of-year, capped at 365; pattern `\bDay\s*0*N\b`, case-insensitive; enclosure required. **Current-year-only pin (§1):** a candidate's year — the max `20\d\d` in its title, else its pubDate year (the contract's `episode_year` rule) — must equal the target date's year; last year's Day N is never a candidate. Among current-year candidates, the newest pubDate wins (the contract's `(year, release_date)` ordering, reduced to the surviving set).
- **Sing the Hours** — port of `sth_match_today` (L312) with `sth_date_prefix` (L308): the title contains the target date's `M.D.YY` prefix AND the token (`Lauds` for the Morning slot, `Vespers` for the Evening slot), enclosure required. Consulted **only** when the Divine Office match for that slot missed (D2, fallback-only), in slot order Morning then Evening.
- **Feed addresses (pinned):** Divine Office `https://divineoffice.org/feed/podcast/` · Bible in a Year `https://feeds.fireside.fm/bibleinayear/rss` · Sing the Hours `https://feeds.castos.com/x8g54`.
- **Parsing:** `xml.etree.ElementTree` over the raw feed bytes; item fields = `title`, `enclosure[url,length]`, `pubDate`, `itunes:duration` (namespaced). The Bible in a Year feed is 9.2 MB / 1,867 items — parsed whole, server-side; measured cost is the resolver's to report at Implement, expected well under the push's existing runtime.
- **Failure isolation:** each feed fetch is its own try/except with a 30-second timeout, single attempt. A failed feed degrades only its own slots to `missing` (a failed Sing the Hours fetch matters only on a fallback day); a resolver-level exception degrades all nine to `missing` and is **named** in the report field (§2.7) — the own-episode commit never blocks on externals, and a miss is always a named row, never an absent one (the honesty rule).
- **Drift guard:** the helper's term table is a literal copy of the `DEFAULT_TOKENS` values it uses; harness check 14 (§2.11) asserts equality against `refresh_playlist.py` at test time, so a future contract-token change fails a gate instead of silently diverging. The slot table (§2.2) mirrors `config/spotify/playlists/*.json` placement as of this Plan; a placement change in the contracts is a follow-on amendment, named here so nobody expects the app to follow it automatically.

### 2.7 The push leg — step 4C, riding the standing helper

- `jobs/push_episodes_to_app.py` gains a stage after its manifest build and before the commit: call `resolve_externals(report_date)`, append the nine entries to the manifest, then commit as today. Its read-back asserts update to the combined manifest (`commit.rowCount == len(manifest)`, `stored.episodeCount == len(manifest)`) — the asserts' shape is unchanged, their input grows.
- **Job sheet:** a new step **4C EXTERNALS (v324)** after step 4B in the nightly sheet, with the sheet text drafted in Implement's section and enacted at Ship (the v318 step-4B pattern). The leg is part of the publish tail: a failure is completed by `--reconcile` like the rest of the tail, ledger flip still last — the helper's idempotency already covers this, since a re-run replaces the same day whole.
- **Report field (mandatory, pinned format):** the helper prints, after the standing `App push (v312)` field: `Externals (v324): <p>/9 present · <slot=Source for each present> · missing: <slot names or none>` — on a normal midnight this reads `8/9 present · … · missing: Bible in a Year` (it posts at 2:15 AM CT; §2.8 fills it). A resolver failure prints `Externals (v324): RESOLVER FAILED — <error> · all slots stand missing` and the run's step fails loudly like any push failure.

### 2.8 The morning re-resolve — the 05:40 watchdog gains one leg

- **Vehicle (Scope left the seat to Plan; pinned here):** the standing **publish-audio-watchdog** job (05:40 CT — the publish watchdog, not the 05:00 Spotify one) gains an externals re-resolve leg, enacted by a sheet amendment at Ship alongside step 4C. 05:40 stands safely after Bible in a Year's 2:15 AM CT post and after Divine Office's and Sing the Hours' evening-before availability, so one morning leg covers every source's timing.
- **Command:** `python3 jobs/push_episodes_to_app.py --externals-only` — a new mode on the standing helper: read the stored day's date from `GET /api/agent/player/stored-day`, resolve externals **for that date**, POST §2.5's route, read back, print the field `Externals re-resolve (v324): <p>/9 present · filled: <slots that changed missing→present> · still missing: <slots or none>`.
- **What it may change:** the nine external rows of the stored day, nothing else — §2.5's route makes any wider write impossible, and the leg runs no other door write. Own episodes, Intentions segments, and the stored day's identity are outside its reach by construction, not by discipline.
- **Failure shape:** stored day absent or not the current Chicago date → the leg reports a named no-op (`stored day is <d or none> — re-resolve skipped`) and the watchdog's other duties proceed. A route refusal or fetch failure leaves the rows exactly as they stand (a missing Bible in a Year stays named missing) and the watchdog report names the failure — the leg never blocks, retries into, or repairs the day's own state.

### 2.9 Payload and client — one branch each

- **Payload** (`episodeTrackShape`, app/worker/src/index.ts): for `kind='external'` rows the shape is `{episodeId, title, kind:'external', source, available, streamUrl: present ? row.stream_url : null, durationS, sizeBytes, hasText:false, textUrl:null}`. The `hasText`/`textUrl` fields are v318-app's (they stand in the shape by the time this builds, §2.10) — externals carry no read-along text in this release, so no Read control stands on an external card, the same rule v318 applied to tracks without text. Own-episode shapes are byte-unchanged. No payload query changes: the standing `SELECT * … ORDER BY sort, episode_id` already interleaves correctly under §2.2's sorts. No feed fetch appears in the Worker or the client at read time — §1 criterion 5, proven by harness check 26.
- **Client** (`trackCard`, app/worker/src/client.ts): one new branch ahead of the episode branch.
  - Present external: the standing card with play button, meta line `Plays here · <Source>` + duration when non-zero (D5 — the source stands where own episodes read `episode file`).
  - Missing external: the standing card frame, title, and the not-available line reading **`Not available today`** (D5's approved wording for externals; own episodes keep their standing `Not available in the app yet`).
  - Queue behavior needs no new code and gets none: the queue is built from playable cards in payload order, unavailable cards are skipped by the standing advance rule, and sleep-timer / end-of-track behavior (v320) is keyed to the audio element, not the track kind — externals inherit all of it, named here as a regression surface for harness check 20.
- **Service-worker cache:** the client change ships under a new cache name per the standing convention (the tree's then-current name bumped to a v324 name at Implement, exact string Implement's to record) — the pin-class lesson applies: any harness check naming the old cache string is updated as a named harness-only change, never silently.

### 2.10 Landing sequence and merge-slot note

Pinned sequence — Implement for v324 seats only when **all** of these stand in trunk, in this order:

1. **v327** — LANDED (trunk 53dc63f, this Plan's base).
2. **v318** — its app half (`release/v318-app`) merges and deploys: migration 0008, the text fields in the track shape, the step-4B sheet sentence. v318's own Ship gates (tonight's drop read-back) govern it; v324 does not seat around it.
3. **v325** — rebases onto the post-v318 trunk and lands: the Intentions splice moves to index 0. This is the order v324's payload and harness are designed against (§2.2, check 18).
4. **v324 Implement** — `release/v324` rebases onto the post-v325 head (§1+§2 ride), migration 0009 re-confirmed free (§2.3), build per §2.14.

- **Review placement: before the trunk landing** (§1's Scope Record), on a candidate deployment, per the v312/v318-app/v320 pattern (§2.12). The chain's level is Through Review — **the line stops at Review's pass**; Ship seats only on John's further word.
- **Drift watch:** v326 (docked player, Scope-stage, client) is the one item whose surface overlaps this one — it will reshape client playback code. If v326 lands before v324's Implement, Implement rebases onto it and re-verifies the §2.9 client pins against the docked player's queue model before writing code, and names any pin that moved in its section; if v326 is still in flight, v324 proceeds on the standing client and v326 rebases over it. Either way the §2.9 *payload* pins do not move — they are Worker-side.
- While v324 waits its turn, trunk also moves under the nightly fix-forward traffic; Implement rebases late and re-runs the full regression set (§2.11) on the rebased tree, per standing practice.

### 2.11 Test design — harness-v324 (26 checks) + the regression set

Two legs, following the family's split (v327's precedent: an .mjs Worker/client harness + a Python leg for job-side code). Gate tallies are read from the COMPLETE log files, and every gate parses AND executes the served client (the parse+boot pin).

**Python leg — `app/tests/resolver-leg-v324.py`** against the resolver, with frozen fixture feeds under `app/tests/fixtures/v324/` (trimmed copies of the three real feeds fetched at Implement, retaining every trap item §1 named; target date 2026-11-08):

1. Divine Office Invitatory match — present, stream_url = the fixture enclosure URL.
2. Divine Office Morning Prayer match.
3. No-enclosure trap — the fixture's announcement item carrying "Vespers" + today's date and no enclosure is not selected for any slot.
4. Wrong-date trap — `November 7th – Evening Prayer I` is not selected for Nov 8; `November 8th – Evening Prayer II` fills `ext-evening-prayer`.
5. Full Divine Office day — all seven Divine Office-primary slots present from the complete fixture (slots 1, 2, 4, 5, 6, 7, 8).
6. Bible in a Year match — the 2026 `Day 312` item fills `ext-bible-in-a-year`; title renders per §2.2.
7. Current-year rule — with the 2026 item removed from the fixture, the slot stands **missing**; the 2025 `Day 312` item is never selected.
8. Day-pattern forms — `Day 312` and a zero-padded form both satisfy `\bDay\s*0*N\b`.
9. Fallback fills — with the Divine Office Morning item removed, `ext-morning-prayer` fills from Sing the Hours Lauds, `source = 'Sing the Hours'`.
10. Fallback order — with Divine Office present, Sing the Hours is not used for Morning or Evening (`source = 'Divine Office'`).
11. Sing the Hours prefix trap — yesterday's `11.7.26` Lauds is never selected for 11.8.26.
12. Per-feed isolation — a Divine Office fetch failure leaves its slots missing while Bible in a Year still resolves.
13. Slot-set shape — exactly nine entries, pinned ids/blocks/sorts 901–909; a missing entry carries `stream_url ''`, its primary `source`, `r2_key ''`.
14. Tokens parity — the resolver's term table equals the `DEFAULT_TOKENS` values read live from `jobs/playlist/refresh_playlist.py`.
15. Live-feed smoke — the resolver runs against the three live feeds for the run's current date and returns the nine-slot shape without exception. **Non-gating at Implement (reported in §3); gating at Review for shape-and-completion only** — never for any slot's present/missing state, which is the shows' timing, not this code.

**Worker/client leg — `app/tests/harness-v324.mjs`** against a local instance seeded through the door (the family's guard-worktree + port discipline; a moved port on collision, per the v318 Review lesson):

16. Migration 0009 applies cleanly on the post-0008 schema; a v312-shaped manifest (no `kind` anywhere) still commits, and its rows read back `kind='episode'`, `source ''`, `stream_url ''`.
17. Commit verification split — a present external entry with no staged R2 object commits 200; an own present entry with a wrong staged size still aborts 409 with nothing written.
18. Payload order — in every block: Intentions card first (this check asserts the post-v325 splice; on any pre-v325 tree it is expected-red and Implement names the base it ran on), then own episodes in manifest order, then externals in slot order.
19. Payload shape — a present external carries `kind 'external'`, its `source`, `stream_url` = the enclosure URL verbatim, `hasText false`, `textUrl null`; a missing external carries `available false`, `stream_url null`.
20. Client render + queue — a present external's card meta names its source; a missing external's card shows `Not available today`; the block queue order is card → own → externals; Play All skips an unavailable external without stalling; a sleep-timer stop on an external behaves as on any track.
21. Morning fill-in — after a midnight-shaped commit with Bible in a Year missing, the externals route flips exactly that slot to present; own-episode rows are byte-identical before/after; `prayer_audio` segments untouched; `player_day.episode_count` unchanged.
22. Morning route guards — a wrong date → 409 named, nothing written; a slot set ≠ the nine pinned ids → 400 named, nothing written; a body `kind` is ignored (rows store `'external'`).
23. Stored-day read-back — after the combined commit, `episodeCount` = own + 9 and the new `externalsPresent`/`externalsMissing` counts are correct; after the morning fill-in they move by exactly the filled count. (The read-back gains those two fields in this release — a §2.4-adjacent Worker change, pinned here.)
24. One-day retention — the next day's replace-day commit leaves no external rows under the old date; the new date holds its own nine.
25. R2 purity — after the combined commit and a morning route write, the bucket listing holds no key for any external slot id (no `episodes/<date>/ext-…` objects).
26. Read-path purity — no fetch of any of the three feed hosts exists in the Worker or client source (structural grep over `app/worker/src/`), and the payload builds from D1 alone with the network to those hosts blocked in the harness environment.

**Regression set** (on the final rebased tree, complete logs): `harness-v312` (with its standing order/cache-pin updates as they stand at build time) · `harness-v325` · `harness-v318` · the v327 push-leg (`app/tests/push-leg-v327.py`) — the push helper changes in §2.7 make its leg a regression surface too. A red regression stops the gate; a superseded pin inside one is updated only as a named harness-only change in the Implement section (the standing pin-class rule).

### 2.12 Review criteria

Review judges §1's six acceptance criteria on the evidence, plus:

- **Criterion 6 is John's phone check on a Review candidate deployment** (the v312/v320 pattern): play an external track on the candidate, lock the phone — audio continues; lock-screen next/previous crosses between the podcast's own and external tracks in queue order; **seek works on a Divine Office track** (this is where §1's Libsyn range ambiguity is settled — on the device, not by probe); and **Bible in a Year plays from the candidate after a morning fill-in** (the candidate's day is seeded, then the re-resolve leg is run against it, then John plays it).
- The R2 bucket listing at Review shows no external object (§1 criterion 1's second half) — read from the candidate's bucket.
- Review stands **before** the trunk landing (§2.10); a failed phone check returns the item to Implement with the failure named, it does not waive.

### 2.13 Rollback and off-switch

- **Off-switch (feature off, no deploy):** remove step 4C from the nightly sheet and the re-resolve leg from the watchdog sheet. The next midnight replace-day commit carries no external rows — the commit replaces the whole day — so the payload simply has no externals and the feature reads as absent. Rows never linger past one day (the one-day rule).
- **App-half rollback (bad build):** pure redeploy of the prior Worker build (the post-v325 build), **plus** one re-run of the pre-v324 push helper from git to re-commit the standing day own-only — because the pre-v324 payload shape would otherwise render stored external rows as own episodes pointing at the app audio route. Migration 0009's columns stay (additive defaults; no down-migration, per standing practice).
- **Resolver rollback:** the resolver and the helper's stage are one commit apart from the Worker changes; reverting the helper stage alone leaves the Worker carrying a dormant route and columns — a safe standing state.

### 2.14 Steps in order (Implement's checklist — each step traces to §1)

1. Rebase `release/v324` onto the post-v325 trunk; re-confirm migration 0009 (§2.3) and the §2.9 client pins against the standing tree (v326 watch, §2.10). *(§1 sequence)*
2. Migration 0009 + Worker: commit-path externals (§2.4), the externals route (§2.5), the payload branch (§2.9), the stored-day read-back fields (check 23). *(§1 in-scope #2)*
3. Client: the external card branch + cache-name bump (§2.9). *(§1 in-scope #3)*
4. Resolver module with the ported matchers and the slot table (§2.6); fixture feeds frozen (§2.11). *(§1 in-scope #1)*
5. Push helper: the externals stage, the `--externals-only` mode, the updated asserts, both report fields (§2.7, §2.8). *(§1 in-scope #1, #5)*
6. Step-4C sheet text + the watchdog-leg sheet text, drafted in the Implement section for Ship to enact (§2.7, §2.8). *(§1 in-scope #5)*
7. harness-v324 both legs + the regression set, complete logs, on a detached guard worktree (§2.11). *(§1 criteria 1–5)*
8. Stop at Review: candidate deployment up, Review seats (§2.12). **The level is Through Review — nothing in this plan authorizes a Ship step.**

### Concerns and Information Needs

- **Facts:** every file, function, and line cited above was read first-hand this pass on trunk 53dc63f / `release/v318-app` / `release/v325` as noted · production stored-day read-back (2026-11-08, 17 episodes) taken through the app door at Plan time · the three feeds' sizes, title forms, and timings are §1's first-hand measurements, not re-measured this pass.
- **Assumptions:** the nightly sheet's step-4C insertion and the watchdog sheet amendment follow the v312/v318 enactment pattern (drafted at Implement, enacted at Ship) — if the Coordinator prefers enactment at Review's pass instead, the design does not change, only the sheet timing · the 05:40 watchdog's sheet can carry a shell command leg like the nightly sheet's steps (its current legs are verification reads; the re-resolve is its first write leg — named here so Review weighs it deliberately rather than discovering it).
- **Uncertainties:** Libsyn's final-host seek behavior — unsettled by probe (§1), settled only by §2.12's phone check; if seek fails on Divine Office tracks on the phone, v1 ships with that named limitation or returns to Implement at John's word — Plan does not invent a proxy to fix it (§1 option D stays rejected) · whether `itunes:duration` stands on every Divine Office item — the design already absorbs its absence (duration 0, client omits).
- **Decision impact:** none outstanding — D1–D5 stand as approved; the two Plan-level calls Scope left open (external-row shape, morning vehicle) are pinned in §2.3/§2.5 and §2.8 with their reasons.
- **First source to check:** `app/worker/src/index.ts` (playerDayPayload · the E2 commit route · storedDayReadback) and `jobs/push_episodes_to_app.py`, against §2.4–§2.9.

## 3 · Implement

**Seat:** Implement Agent (v324), record 1135, claimed 2026-11-09T04:32:23Z. Time contract 58: "Build committed" MET 04:40:52Z · "Harness result" MET (see the tally below) · "Implement pass" judged at this section's pass. Run level: Through Review (John, 2026-11-08 21:06 CT). Review stands BEFORE trunk landing for this release: nothing here is landed, deployed, or written to any production store; migration 0009 is applied nowhere.

**Rebase.** `release/v324` rebased onto `muse-draft-week` @ 7f938f3 (v325's §5 head; v318 Live 2026-11-09T04:16Z, v325 Live 04:31Z) — clean, no conflicts. New heads: §1 = 19b4ddd, §2 = 460b0ed. Migration **0009 re-confirmed free**: the rebased tree carries app/migrations 0001–0008 (0008 = player_episode_text), and the additive 0009 lands after it.

**Build commits (all on release/v324):**
- `51f8db7` — migration 0009 (`kind`/`source`/`stream_url` on player_episodes, §2.3) + Worker: commit-path externals (§2.4 — kind validation with the pinned slot/block refusals, staged-size and text verification split so externals skip both, external r2_key binds '' regardless of state), the externals-only route (§2.5), the payload external branch (§2.9), stored-day externalsPresent/externalsMissing (§2.5's read-back fields).
- `72e6f56` — client: the external card branch ahead of the episode branch (present → source in the meta line; missing → "Not available today"; no Read control, no not-available line on a present external) + the service-worker cache bump §2.9 requires: the name Implement chose is **`ora-pro-nobis-v324-1`**.
- `b7b7a0b` — `jobs/externals_resolver.py` (§2.6) + the frozen fixture feeds (§2.11: trimmed real feeds for target 2026-11-08, every §1 trap retained — the no-enclosure announcements, Evening Prayer I vs II, five years of Day 312, the 11.7.26 Sing the Hours pair).
- `efdc1c9` — push helper: the step 4C stage (§2.7 — the nine resolved entries ride the same replace-day commit; own-episode verification counts computed over the own entries only; stored-day assertions extended by the nine rows) + `--externals-only` mode (§2.8).
- `37798ed` — resolver term-boundary fix + resolver-leg corrections (deviation 3 below).
- `fa92e54` — harness-v324, both legs (§2.11).
- `dd25fb2` — named harness-only regression updates + the gate/regression logs.

**Harness-v324 — 26/26 checks green** (complete logs stand in the repo at `tests/v324-resolver.log` and `tests/v324-gate.log`):
- Resolver leg (`app/tests/resolver-leg-v324.py`, checks 1–15): **15/15 ok**. Check 15 (live-feed smoke, non-gating at Implement) ran against the real feeds — see the live evidence below.
- Worker/client leg (`app/tests/harness-v324.mjs`, checks 16–26): **29/29 assertions ok**, incl. the verification split (an external present with no staged object commits; an own present with a wrong staged size still refuses the whole commit 409 with nothing written), payload order per block (Intentions card → own episodes → externals in slot order), the morning fill-in swapping exactly the missing slot with own rows and segments byte-untouched, the route guards (409/400/kind-ignored), one-day retention, R2 purity (persist scan: zero `episodes/<date>/ext-` objects; the audio route 404s an external slot), and read-path purity (no feed host named in Worker or client source).
- **Regressions on the final branch tree, all green** (complete logs in `tests/`): harness-v312 **59/59** · harness-v325 **31/31** · harness-v318 **32/32** · the v327 push leg (harness-v327) **10/10**.

**Live-feed evidence (check 15, run 2026-11-09 ~04:53Z for the current Chicago date, 2026-11-08; log at `tests/v324-live-smoke.log`):** resolver error none, no feed failed — **9/9 present**: ext-invitatory · ext-morning-prayer · ext-midmorning-prayer · ext-midday-prayer · ext-midafternoon-prayer · ext-office-of-readings · ext-evening-prayer · ext-night-prayer all from Divine Office (durations 296–1797 s read from itunes:duration), and ext-bible-in-a-year from Bible in a Year (Day 312, 917 s, rendered title "Bible in a Year — Day 312: Conclusion to the Old Testament"). Sing the Hours was not consulted — no fallback slot missed. The §1/§2.8 pattern stands as designed: at a 00:00 CT resolution the Bible slot stands missing (the item posts ~2:15 AM CT) and the 05:40 re-resolve fills it; this evening run simply post-dates the post.

**Job sheets — NOT changed in this phase** (§2.7/§2.8: drafted here, enacted at Ship). The drafted texts for Ship to enact verbatim:

*Nightly sheet (`ora-pro-nobis-nightly-run`), inserted as step 4C after step 4B:*
> STEP 4C EXTERNALS (v324) — part of step 4B's push, not a separate invocation: the push helper resolves the day's nine external RSS slots (jobs/externals_resolver.py) and carries them in the same replace-day commit. The run report MUST include the field, verbatim from the helper's output:
> Externals (v324): <p>/9 present · <slot=Source for each present slot> · missing: <slot names or none>
> On a midnight run the expected shape is 8/9 with ext-bible-in-a-year missing (Bible in a Year posts ~2:15 AM CT); the 05:40 watchdog's re-resolve fills it. A field reading RESOLVER FAILED names a resolver-level failure — the day's own episodes stand pushed regardless; name it in the closing report.

*Watchdog sheet (`publish-audio-watchdog`), inserted as step 2C after step 2B:*
> STEP 2C EXTERNALS RE-RESOLVE (v324) — after the standing steps: python3 jobs/push_episodes_to_app.py --externals-only
> It re-resolves the stored day's nine external rows only; own episodes, segments, and texts are never touched. The report MUST include the field, verbatim from the helper's output:
> Externals re-resolve (v324): <p>/9 present · filled: <slots filled since the midnight push or none> · still missing: <slots or none>
> A stored day that is absent or not the current Chicago date is a named no-op (the field says so) — the watchdog's other duties proceed. A FAILED field leaves the rows exactly as pushed; name it in the report.

**Named deviations and Implement decisions** (each small, each recorded here per the workflow):
1. **The externals route's reply carries one field beyond §2.5's pinned shape: `filled`** — the slot ids that changed missing→present in the swap. §2.8's morning report prints its "filled:" list from it; the pinned fields are unchanged and in order.
2. **Resolver-failure posture at the push.** §2.7's "the resolver run itself fails loudly" and §2.6's "the commit never blocks on externals" meet in the helper as: on a resolver-level exception the commit proceeds with all nine slots missing, the mandatory field prints the RESOLVER FAILED form, and the helper exits 0 — the failure is loud in the run's mandatory report (the sheet's check-off reads it), while a nonzero exit would have --reconcile re-run a push whose own-episode half is healthy. The morning mode takes the opposite posture where it is safe: on a resolver or feed failure it posts NOTHING (rows stand as pushed) and exits 1, per §2.8's failure shape.
3. **Term matching takes a non-letter boundary, and each feed item is consumed by at most one slot.** The contracts' plain containment lets "Morning Prayer" match inside "Midmorning Prayer" — with the day's own Morning Prayer item absent, the Midmorning item filled the Morning slot and Sing the Hours never fired (caught by resolver-leg checks 9/11 during this phase). RSS titles compound the hour names; the Spotify track names the contracts were written against do not. The boundary rule + consumption keep one episode per hour without moving any §2.2 assignment.
4. **§2.11 check 5's text says "7 DO-primary slots"; the §2.2 table carries eight** (every slot but Bible in a Year). The harness asserts the table's eight; the Plan text understates its own table. No behavior turns on it.
5. **§2.11 check 12's Divine-Office-down case:** the two fallback slots still fill from Sing the Hours (a miss is a miss, whatever its cause — D2); the leg asserts the six non-fallback DO slots missing, the Bible slot present, and the fallback fills named as Sing the Hours. Check 20's queue expectation follows the standing v312 model the same way: unavailable tracks stand in the queue and are skipped at reach — §2.9's "no queue code changes" holds.
6. **Superseded pins updated as named harness-only changes** (the standing pattern): the SW cache pins in harness-v312 (check 11), harness-v318, and harness-v320 (check 1) move `ora-pro-nobis-v318-1` → `ora-pro-nobis-v324-1`; harness-v318's helper-driver stored-day assertions move to the v324 day shape (episodeCount 3 → 12, textsMissing 2 → 11, tracksMissing 1 → 10, plus externals 0/9) because the helper it drives now appends the nine external rows by design.
7. **Gate environment:** this worktree carried no node_modules; the harness deps stand in /tmp (wrangler 4.158, puppeteer-core 23) symlinked in untracked, and the browser leg runs on the estate's playwright-core + headless shell exactly as harness-v325's mold prescribes. No repo file turns on it.

**What Implement did NOT do:** no trunk landing, no deploy, no production D1/R2 write, no job-sheet or watchdog edit, no Access change. Review (§2.12) judges §1's six criteria plus the phone checks on a Review candidate, before any landing.

- **Concerns and Information Needs:**
  - Review's phone check carries the open Libsyn question (§2.12): play an external track, cross own/external boundaries under lock-screen controls, and **seek on a Divine Office track** — the ranged-probe evidence at Scope could not settle it, and a failed seek returns the item here, it does not get absorbed silently.
  - Bible in a Year after a morning fill-in is the second phone leg (§2.12): the first production morning will show 8/9 at midnight by design; anyone reading the midnight field without this note will misread it as a defect.
  - The two big feeds are fetched in full per resolution (Divine Office ~1.35 MB, Bible in a Year ~9.2 MB), twice a day (midnight + 05:40). No action proposed; named so the cost is on the record if the feed grows.
  - §2.10's drift watch stands: if v326 (docked player) lands before v324's Review completes, this release's pins re-verify against its queue model; the §2.9 payload pins do not move.
  - The seating brief named the slug "v324-external-rss-in-player"; the registry, the repo document, and the published document all stand as **v324-external-rss-player** (§1/§2's publications included). This section publishes under the standing identity; the brief's variant was not used anywhere.

## 4 · Review

**Seat:** Review Agent (v324), record **1145**, claimed 2026-11-09T04:55:53Z — left **CLAIMED / active** at this section's publication: every code criterion is judged below, and the Review record is **not passed**, because §1 criterion 6 (John's phone check) stands open by design. Time contract **68**: "Candidate deployed" MET 05:06:12Z · "Code criteria verdict in §4" judged at this section's publication. Run level: Through Review. Review stands BEFORE trunk landing: nothing here is landed, deployed to production, or written to any production store; migration 0009 is applied only on the candidate's own D1.

**Independence note:** every tally below is this seat's own run on the branch tree (`release/v324` @ 0078416, worktree ~/workspace/.worktrees/v324), read from COMPLETE log files — §3's numbers were treated as claims, not evidence.

### Evidence — this seat's own runs

- **harness-v324 resolver leg (checks 1–14 + live smoke 15): 15/15 ok.** All traps hold (no-enclosure announcements never match · Evening Prayer II beats I · Bible current-year-only · zero-padded Day form · fallback fills only on a Divine Office miss · yesterday's Sing the Hours prefix never matches · per-feed isolation · nine-slot shape · tokens parity with `DEFAULT_TOKENS` read live).
- **harness-v324 Worker/client leg (checks 16–26): 29/29 assertions ok** — migration 0009 clean on the post-0008 schema · the v312-shaped manifest still commits and reads back defaults · the verification split (external present with no staged object commits; own present with wrong staged size refuses the whole commit 409, nothing written) · payload order per block (Intentions card → own episodes → externals in slot order) · payload shape (source carried, `streamUrl` = enclosure verbatim, `hasText false`, `textUrl null`; missing external `available false`, `streamUrl null`) · client render (source in the meta line · "Not available today") · Play All order + autoplay crossing own → external, skipping the missing one at reach · sleep stop on an external · morning fill-in swapping exactly the missing slot with own rows and segments byte-untouched · route guards (409 wrong date · 400 wrong slot set · body `kind` ignored) · one-day retention · R2 purity (zero external objects; the audio route 404s an external slot) · read-path purity (no feed host named in Worker or client source; my own grep over `app/worker/src/` for the three feed hosts also returns 0, and the Intentions splice stands untouched at `splice(0, 0, card)`).
- **Regressions, this seat's runs, all green:** harness-v312 **59 ok / 0 FAIL** · harness-v325 **31 ok / 0 FAIL** · harness-v318 **32 ok / 0 FAIL** · v327 push leg **10 ok / 0 FAIL** (the pre-v324 helper shape still commits against the v324 Worker — the door's backward compatibility is proven, not assumed).
- **Live-feed evidence, this seat's runs (target 2026-11-08, the current Chicago date at seating):** the resolver's live smoke resolved **9/9 present** (eight Divine Office slots + Bible in a Year, Day 312, Sing the Hours not consulted), and four consecutive detailed runs reproduced 9/9 with the feed byte-stable at 1,310,619 bytes / 10 Nov-8 titles. **Intermittency observed and absorbed:** three of the night's resolver invocations degraded on the Divine Office feed fetch (single attempt, §2.6's pin) — each degraded exactly as designed: Divine Office slots stood named missing, Sing the Hours filled Morning and Evening, Bible in a Year was unaffected, and nothing was silently dropped. See the candidate evidence for the repair leg proving itself on the same failure.

### Candidate deployment (§2.12) — this seat's build and proof

- **Candidate:** Worker **`ora-pro-nobis-app-v324-review`** (version **7aa2450c-b10a-45bd-a3ea-cf5e63d1d373**) deployed from the branch tree, with its OWN D1 (`ora-pro-nobis-app-v324-review`, migrations **0001–0009** applied), its OWN R2 bucket (`ora-pro-nobis-audio-v324-review`), its own Access application (**596ceb4f**, Google sign-in on the production IdP, John-only allow policy for John's two emails at precedence 1, the Muse service-token policy at precedence 2, 24-hour session), and its own AGENT_TOKEN secret on the candidate only. Production is untouched by this pass.
- **The day on the candidate:** six synthetic Intentions segment tones (candidate-only fixture data) + the real 2026-11-08 push through the v324 helper (17 own episodes, audio verified 17). The push's own step-4C resolution hit the Divine Office fetch failure live and printed `Externals (v324): 3/9 present · ext-morning-prayer=Sing the Hours, ext-bible-in-a-year=Bible in a Year, ext-evening-prayer=Sing the Hours · missing: <the six Divine Office slots>` — criterion 3's failure shape, produced by a real failure, not a simulation.
- **The morning leg, proven on the candidate:** `push_episodes_to_app.py --externals-only` against the candidate printed `Externals re-resolve (v324): 9/9 present · filled: ext-invitatory, ext-midmorning-prayer, ext-midday-prayer, ext-midafternoon-prayer, ext-office-of-readings, ext-night-prayer · still missing: none`. The stored-day read-back moved to 26 rows (17 own + 9 external), externals 9/0, segments in all six blocks, own rows untouched.
- **Order and placement, read back from the candidate's D1:** Morning ← ext-invitatory (901) · ext-morning-prayer (902) · ext-bible-in-a-year (903) · Midmorning ← ext-midmorning-prayer (904) · Midday ← ext-midday-prayer (905) · Afternoon ← ext-midafternoon-prayer (906) · Evening ← ext-office-of-readings (907) · ext-evening-prayer (908) · Night ← ext-night-prayer (909) — sorts after the day's own episodes in every block, sources named per row, the Intentions splice (v325) standing in the payload builder ahead of both. Candidate R2 listing holds **zero** `ext-` objects.
- **Final candidate state, set deliberately for the phone check:** one externals swap with **ext-night-prayer forced missing** (route reply: externalsPresent 8, externalsMissing 1, `filled: []`) — the Night block's external stands named missing so John sees "Not available today" rendered by the production path, beside eight playable externals and a filled-in Bible in a Year.
- **Seek — the §1 open item, settled at the transport level:** §1's probe read a 200 through the redirect chain and left Libsyn's range behavior ambiguous. Following the chain to the final host (`content.libsyn.com`), a ranged request for bytes 1000000–1999999 against today's Divine Office Morning Prayer enclosure answered **206 Partial Content with `Content-Range: bytes 1000000-1999999/30100478`** and exactly 1,000,000 bytes — the final host honors ranges. (A headless-shell playback probe of the same URL failed on the shell's codec support, not on the host; the harness browser leg already proves the app's own audio element plays enclosure URLs.) On-device seek remains John's criterion-6 verdict, with its transport precondition now proven instead of assumed.

### Criteria (§1) — verdicts

| # | Criterion | Verdict |
|---|---|---|
| 1 | External tracks in their blocks per the mapping, playable in the same queue; no external object in R2 | **MET** on code + candidate evidence (harness checks 18–20 · candidate slot read-back · R2 scan 0); the phone half rides inside criterion 6 |
| 2 | Matching per the contracts as pinned (term + date == today + enclosure · fallback-only · Bible current-year) | **MET** (resolver checks 1–14, this seat's run) |
| 3 | A miss or unreachable feed leaves the track named not-available; other tracks unaffected; the report names the miss | **MET** — proven three ways: harness isolation check, the candidate push's live 3/9 degradation with the field naming every miss, and the forced-missing slot standing on the candidate |
| 4 | One-day rule intact | **MET** (check 24, this seat's run) |
| 5 | Player read path stays D1-only | **MET** (check 26 + this seat's grep: no feed host in `app/worker/src/`) |
| 6 | **Phone check (John's verdict)** — play an external; lock-screen continuation + next/previous across own/external; seek on a Divine Office track; Bible in a Year after a morning fill-in | **PENDING JOHN** — the candidate stands ready (below); the record is not passed until his verdict lands |

### §3 deviations — rulings

1. **The externals route's reply carries `filled` beyond §2.5's pinned shape — ACCEPTED.** Additive only; the pinned fields are unchanged and in order; §2.8's morning report prints its filled list from it. Observed working in both candidate swaps (six fills named by the morning leg · `filled: []` on the forced-missing swap).
2. **Resolver-failure posture (push proceeds all-missing + RESOLVER FAILED field + exit 0; morning mode posts nothing + exit 1) — ACCEPTED.** It is the only reading under which §2.6 (the commit never blocks on externals) and §2.7 (the failure is loud) both hold; a nonzero push exit would make `--reconcile` re-run a healthy own-episode half, and the morning posture matches §2.8's failure shape word for word. The candidate push demonstrated the loud-field half live.
3. **Term matching takes a non-letter boundary + one feed item feeds at most one slot — ACCEPTED.** The contracts' plain containment was written against Spotify track titles; against RSS's compounded hour names it mis-fills Morning from the Midmorning item and starves the fallback (Implement's checks 9/11 caught it red). No §2.2 assignment moves; this is the faithful port, not a redesign.
4. **§2.11 check 5's "7 DO-primary slots" vs the §2.2 table's eight — ACCEPTED as a Plan text erratum.** The harness asserts the table (eight), the behavior follows the table, nothing turns on the sentence. Named for the Curator as a document correction, not a build defect.
5. **Fallback and queue readings (fallback fills on a feed failure, not only on a no-match; unavailable tracks stand in the queue and are skipped at reach) — ACCEPTED.** A miss is a miss whatever its cause (D2's logic, and tonight's live failure behaved exactly so), and the queue reading is the standing v312 model §2.9 promised not to change.
6. **Superseded pins (cache-name updates in harness-v312/v318/v320; harness-v318 helper-driver day-shape counts) — ACCEPTED** as the standing named harness-only pattern; all four suites re-ran green in this seat's hands with those pins in place.

### Verdict

**All code criteria MET. The Review stands open on criterion 6 only** — John's phone check on the candidate, per §2.12: a failed phone check returns the item to Implement with the failure named; a pass lets the Coordinator pass this record and seat Ship on John's word (the level is Through Review). No Ship step is authorized by this section.

**The phone-check ask, exactly:** open **https://ora-pro-nobis-app-v324-review.john-thibeaux.workers.dev** on the phone and sign in (Google, John's identity — the candidate is John-only). On the Prayers tab for the stored day (2026-11-08): (1) play **Morning Prayer** in the Morning block — its meta line names **Divine Office**; (2) lock the phone — audio continues; lock-screen **next/previous** crosses between the podcast's own tracks and the external tracks in queue order; (3) **seek** inside that Divine Office track (drag well into the track) — it should resume from the new position, not restart; (4) play **Bible in a Year** in the Morning block — it stands filled by the morning re-resolve; (5) in the Night block, **Night Prayer** (the external) stands **"Not available today"** — that miss is set deliberately for this check, and the podcast's own Night tracks are unaffected.

- **Concerns and Information Needs:**
  - **Divine Office feed fetch intermittency (the night's real operational fact):** roughly a third of this seat's resolver invocations degraded on the Divine Office fetch (single attempt, 30 s timeout — §2.6's pin), while consecutive runs against the byte-stable feed resolved 9/9. The design absorbs it completely (isolation → named misses → fallback fills → the 05:40 leg repairs, all proven live on the candidate tonight), so this is not a defect against the Plan as pinned. It is named for Scope/Curator as a follow-on candidate: **one retry inside the resolver's Divine Office fetch** would erase most degraded midnights before the morning leg is needed. Not authorized by anything in this release.
  - **Candidate's own episodes stand in the unblocked group** — the push helper's standing title-head resolution (the same behavior the v327 production push showed for 2026-11-08), not a v324 behavior: v324's slots resolve by slot table, and all nine stand in their pinned blocks. The block-mapping of own episodes is v328's subject (its seed maps the sources); named here so the candidate's blocks are not misread as a v324 placement failure.
  - **Candidate texts read 0/17 — an artifact of this seat's push invocation, flagged for the Coordinator, not a v324 finding:** the helper resolves audio under `<rundir>/` (the MP3s stand in the run's `out/`) and episode texts under the same `<rundir>/script-*.txt` (the scripts stand in the run **root** — 17 there, 0 in `out/`). One `--rundir` value cannot satisfy both as the run directory is currently laid out; the candidate was pushed with `--rundir …/out`, so its own episodes carry no text (external tracks are unaffected — `hasText false` by design). Whether the enacted step-4B invocation shape resolves both legs on a real nightly run is a v318-surface question this Review does not judge; it is recorded so it is checked, not discovered.
  - The candidate deployment (Worker `ora-pro-nobis-app-v324-review` + its D1, R2, and Access app 596ceb4f) is **left standing** for John's phone check and owed a teardown after the verdict, like the v320-review candidate before it; it holds only the 2026-11-08 day, six synthetic segment tones, and its own door token.
  - Static assets on the candidate could not be fetched through its session gate from this seat (the Worker answers "access sign-in required" to the service-token path, the production behavior); the served-client parse+boot evidence stands on the harness browser leg against the identical build, and the deployed Worker version was taken from the deploy of this branch's tree.
