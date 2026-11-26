# v696 — Prayer text not coming through: the Read sheet paints a placeholder sub-line and an empty body

## §1 Scope

**Direction (John, 2026-11-26 09:30 CT, field report with screenshot `~/workspace/user/files/6303_8_6owk.jpg`):** the opened view for "Morning Offering (Extended)" paints its title, the literal sub-line "the episode's text", and an EMPTY body. The prayer's own words never reach the sheet. (Direction relayed verbatim by the coordinator seat, 2026-11-26.)

**The opened view in the screenshot is the Read sheet** — `openRead` in `app/worker/src/client.ts` (the `.readsheet` TALL drawer: drag pill, round play/pause control at the left of the title, title + sub-line, body below; the screenshot's pause glyph is `openRead`'s standing `markPlaying` state for the currently playing track). It is not the v643 track page (a full view with art, a Play button, and an "Open in Ora Pro Nobis" act — none of which stand in the screenshot).

**Base at Plan:** `origin/main` at `7e85dea700573c5a87bd368dc8db110f36a34984` — the v693 ship head, read fresh by `git ls-remote` + fetch at Plan (the standing clone's local HEAD lagged at `6ace898`; the remote head is the true base). Branch `release/v696`, worktree `~/workspace/.worktrees/v696` off the one standing clone `~/workspace/projects/ora-pro-nobis/standing-clone`. Holder: chain-v696-plan. All line citations are `app/worker/src/client.ts` (client), `app/worker/src/index.ts` (index), or `runner/pass2_build.py` (pass2) at base `7e85dea` unless named otherwise. DevOps Board row 1674, slug `prayer-text-not-coming-through`; time contract 1209.

**IN:** the Read sheet's paint for every kind that can reach it (§2.4) — the hardcoded placeholder sub-line removed, the composed descriptor's text seat restored at the seam that drops it, and an honest empty paint where a track genuinely carries no text · the harness (§2.6) · a named companion DATA leg (§2.5, seat 4): re-staging the missing production app-text objects — without that leg the client fix cannot make the 2026-11-26 text paint, and §2.1 proves why.

**OUT, named:** no change to the office (Liturgy of the Hours) Read branch — it already replaces the sub-line and body with the widget (§2.4) · no fallback to the public transcript host from the client (rejected at §2.3 — it would break the v312/v318 settlement that the app reads its own store only) · no "text unavailable" sentence in the body (John's v630 word stands: the reading view carries no comment about pulling text — either read or nothing) · no change to the episode card, the v643 track page, or the prayer-book page (different seats, §2.4) · no feed, contract, or publish-flow code change in the client Implement seats (the data leg's diagnosis is named for its own seat, §2.5 seat 4).

## §2 Plan

### §2.1 Fork 1 — DATA vs PAINT: both, proven separately

**Where an own prayer's text lives.** An own episode's read-along text has exactly one app-side home: an R2 object in the app bucket `ora-pro-nobis-audio` under the key `texts/<date>/<episode_id>.txt`, served by the Worker at `GET /api/player/text/<date>/<episodeId>` (index:6009–6024 — `env.AUDIO.get('texts/${date}/${episodeId}.txt')`, a named 404 when absent). It is NOT in the day payload (the server's day builder emits blocks with `tracks: []`, index:1047 — every real track is resolved client-side), NOT in D1 (the `player_episodes` table's `text_state`/`text_r2_key` columns are the retired stored-day model; the presented-day read no longer consults them — and for 2026-11-26 that table carries exactly one row, `the-ai-signal`, `text_state: "missing"`, `text_r2_key: ""`, read firsthand from production D1 `3a177d55` at Plan), and NOT in the prayer-book catalog (that catalog's `body` field serves the book page, a different seat, §2.4). The staging seat is the publish tail: `pass2:_publish_app_texts` (pass2:1053, called at pass2:1305) PUTs each produced episode's script bytes into the app bucket under `texts/<TARGET>/<canonical id>.txt`, from the same computed bytes as the public podcast transcript file — its own docstring: "the app's copy is byte-identical to the podcast transcript file's content rule".

**The record, traced.** "Morning Offering (Extended)" is the own row `morning-prayer`: the seed source record names it so (`client:2771` — `{"sourceKey": "morning-prayer", "name": "Morning Offering (Extended)", "family": "own", "block": "Morning", …}`), mirrored server-side at index:917 (`"morning-prayer": "Morning Offering (Extended)"`). Its 2026-11-26 feed item stands at `docs/podcast.xml:27` in full: title `Morning Offering (Extended) - November 26, 2026`, guid stem `morning-prayer-elevenlabs-2026-11-26`, enclosure `https://audio.orapronobis.media/morning-prayer-elevenlabs-2026-11-26.mp3` (length 3868701), description `Morning Offering (Extended) for November 26, 2026. The daily opening prays with the selected saint witness and an approved saying, alongside the liturgical day.`, and a `<podcast:transcript>` tag pointing at the episode's public script file.

**The prayer's words exist.** The 2026-11-26 episode script — the exact bytes `_publish_app_texts` stages, per the byte-identical rule above — was read firsthand at Plan from the item's own transcript URL (`https://audio.orapronobis.media/morning-prayer-elevenlabs-2026-11-26.txt`). It carries the whole Morning Prayer episode, and its Morning Offering block reads verbatim: "Morning Offering - O Jesus, through the Immaculate Heart of Mary and the Chaste Heart of St. Joseph, / I offer You my prayers, works, joys, and sufferings of this day, / in union with the Holy Sacrifice of the Mass throughout the world, …" — the same words as the standing template `config/publish/templates/morning-prayer/morning-offering.txt`. The prayer record at its source carries its text in full.

**The app-side copy for today does not stand.** Read firsthand from production R2 (`ora-pro-nobis-audio`) at Plan, 2026-11-26 ~15:34Z:

- `texts/2026-11-26/morning-prayer.txt` — **does not exist** (object read: "The specified key does not exist").
- The whole prefix `texts/2026-11-26/` — **0 objects**. Every own episode of the day is missing its app text, not just this one.
- Neighbouring dates stand: `texts/2026-11-25/` = 10 objects (incl. `morning-prayer.txt`), `texts/2026-11-27/` = 10, `texts/2026-11-23/` = 10, `texts/2026-11-20/` = 14, `texts/2026-11-21/` = 14, `texts/2026-11-22/` = 13.
- The missing dates form a pattern: **2026-11-24, 2026-11-26, and 2026-11-28 carry 0 app-text objects** while the dates between them carry theirs. (Publishes run ~00:20 CT for date+2 — e.g. the 2026-11-26 episodes were published 2026-11-24 00:42 CT, commit `d9ce7d9` — so the gap alternates by publish run, not by episode date's content. Which alternating run skips `_publish_app_texts`, or withholds every episode at its T1 guard, is NOT proven from this seat and is named as the data leg's diagnosis, §2.5 seat 4 — the alternation itself is proven by the prefix reads above.)

**Verdict.** DATA and PAINT are both defective, and each alone produces a broken sheet:

1. **Data (today):** the sheet's fetch (§2.3) asks for `texts/2026-11-26/morning-prayer.txt`, which is absent, so the route 404s and no client paint can show the words for 2026-11-26 (or 11-24 / 11-28) until the objects are re-staged (§2.5 seat 4).
2. **Paint (every date):** the sub-line is a hardcoded placeholder that stands even on dates whose text loads (§2.3), and the composed descriptor drops the text seat on the way (§2.2), so the sheet's resolution depends on a side registry instead of the descriptor of record.

### §2.2 Fork 2 — the composed descriptor's text seat: dropped at `trackDesc`

An own track is born with its text seat intact. `ownSlotTrack` (client:21699) builds, for a present own meta: `hasText: present && !(meta && meta.hasText === false)` and `textUrl: present ? '/api/player/text/' + date + '/' + (meta ? meta.episodeId : row.episodeId) : null` (client:21712). Two facts ride with that birth:

- `hasText` is asserted **blindly**: the v368 comment at the same seat records "No standing meta sets the flag" — no own meta ever sets `hasText: false`, and the own feed matcher that births metas (client:21972) carries no text-existence fact at all. A present own track therefore always claims text, including on 2026-11-26, when the R2 object does not exist. This is why the Read control stands on the row (`trackCard`'s `noText = !(t.hasText && t.textUrl)` gate, client:18387) and why the sheet opens at all today.
- The date in `textUrl` is the presented day (`state.storedDay = day.presentedDay || day.date`, client:22869; the rebuild's emission passes the same `date`, client:21230).

**The drop.** Every descriptor that enters the composed list — the paint and queue source of record since v642 — flows through `expandDescs` → `trackDesc` (client:16303). The seam's output object (client:16306) copies exactly: `episodeId, title, url, enclosureUrl, available, block, source, durationS, imageUrl, descText, spotifyUrl, stale, unresolved` (plus `_occ` / `_side650` / the podcast identity / `intentionText` in their own branches). **`hasText` and `textUrl` are not copied.** The composed descriptor in `state.dayDescs` therefore carries no text seat: any consumer resolving from the composed list holds a track that cannot open its own text.

**How the sheet still opens today — the side registry.** `openRead`'s callers mostly bypass the composed descriptor: the `[data-read]` wiring reads `state.readTracks[key]` (client:14171 · 19209 · 21747 · 23802), and `readTracks` is a separate registry — payload tracks at build (client:22932–22934, an empty set today since payload blocks carry no tracks) repopulated for own slots by `ownRegisterReadTracks` with the raw `ownSlotTrack` object (client:21768), which kept its `textUrl`. Now Playing's Read act reads the same registry first (client:18580). But Now Playing's own visibility gate and fallback expose the drop: `updateNowPlaying` tests the registry entry (client:18672–18681), and the Read act falls back to `state.current` — the composed descriptor — when no registry entry stands (client:18580), where `t.hasText && t.textUrl` (client:18585) is necessarily false and Read silently does nothing. **The dropping seat is `trackDesc`, client:16306.** §2.5 seat 2 restores the two fields there.

### §2.3 Fork 3 — the opened view's read and the placeholder's true origin

`openRead(t)` (client:18425) paints the sheet in one `innerHTML` (client:18438), quoted in full for the head:

```js
'<div class="inner"><div class="row"><button class="playbtn" data-playkey="…">&#9654;</button><div class="grow"><h1 class="screen">' + esc(t.title) + '</h1><p class="sub">the episode&rsquo;s text</p></div></div><div class="readtext" data-skeleton="1">…skeleton bars…</div></div>'
```

- **The placeholder's origin is this literal, client:18438** — the sub-line is hardcoded as `the episode&rsquo;s text`. The coordinator's firsthand grep for "the episode's text" / "episode's text" across `app/worker/src/` returned zero because the source spells the apostrophe as the HTML entity `&rsquo;`; the phone renders the entity as ’, producing the screenshot's exact string "the episode's text". No template construction, no payload string, no server template is involved — the string exists in exactly one place in the repo (whole-repo search at Plan: this one occurrence).
- **The sub-line is never replaced for a non-office track.** After the paint, `openRead` touches `.sub` only in the office branch (client:18452–18457, the widget head). For every other kind the placeholder stands for the life of the sheet — on good dates too, under a fully loaded body. It reads like a description of the content; it is a standing label for the surface, painted as if it were the track's own line.
- **The body read is the fetch, and its failure paint is empty.** For a non-office track the sheet fetches `t.textUrl` (client:18459); on success the body becomes the fetched text (`body.textContent = text`). On any failure — the 404 of §2.1 included — the catch (client:18466–18470, the v630 rule) clears the body to `''`: skeleton bars go, nothing replaces them. Title + placeholder sub-line + empty body is exactly the screenshot, and it is the deterministic output of `openRead` whenever the text object is absent.

**Rejected alternative, named:** giving the client a fallback fetch to the public transcript URL (`https://audio.orapronobis.media/<stem>.txt`, the feed item's `<podcast:transcript>` target) would make the words paint even on unstaged dates — but v318's settlement stands in the record (`releases/v318-episode-transcripts.md` §2: "the player stays independent of the public host — the app reads its own store only, as v312 settled"). v696 does not break that settlement from a Plan seat; the missing objects are re-staged into the app's own store instead (§2.5 seat 4).

### §2.4 Fork 4 — blast radius, per kind

Kinds are judged by one test: can the kind reach `openRead` with a non-office descriptor, and what does the sheet paint for it today?

| Kind | Reaches `openRead`? | Placeholder sub-line today? | Body today |
|---|---|---|---|
| Own episodes — `morning-prayer` (Morning Offering (Extended)), `daily-rosary`, `marian-antiphon-angelus` (×3 rows), `auxilium-christianorum`, `daily-reflection`, `novena-*` | Yes — `ownSlotTrack` gives every present own meta `hasText` + `textUrl` (client:21712); Read stands on the row (client:18387/18402), in Favorites (client:13267), and in Now Playing (client:18580) | **Yes, always** — the sub is never replaced for non-office kinds (client:18438) | The episode's script on staged dates (2026-11-25, -27, …); **empty on 2026-11-24, -26, -28**, whose R2 prefixes are empty (§2.1) |
| Office hours (LOH labeled ext slots, `lohOffice676`) | Yes, but the office branch intercepts | No — the branch replaces `.sub` with the widget head and the body with the widget, and returns before any fetch (client:18452–18458) | The Divine Office widget — unaffected |
| Other externals (Bible in a Year, Saint of the Day, exegesis, Mass slots, …) | No — `extSlotTrack` hard-codes `hasText: false, textUrl: null` (client:19032); no Read control stands on their rows or in Now Playing | No — their opened view is the episode card / track page, which paint `descText` (client:11068 · 17814), a different seat | n/a |
| Podcasts (`podDesc` · `podOwnDesc` · `podNovenaDesc`) | No — no `hasText`/`textUrl` on any podcast descriptor (client:9453 · 10216 · 10291); the Favorites Read gate excludes podcasts outright (client:13267) | No — episode cards paint the entry's `descText` or nothing | n/a |
| Prayer-book prayers, day additions, the readings seat | No — `dayAdditionDesc` (client:14370) and `readingsSeatDesc549` (client:14480) carry no `hasText`/`textUrl`; the book page paints the catalog `body` through `bookBodyHtml`, a different seat | No | n/a |

**The class is exactly one kind family: the own episodes.** Every own episode's Read sheet, on every date, paints the placeholder sub-line; on the three proven unstaged dates every own episode's Read sheet also paints an empty body. The fix must land for the family, not for `morning-prayer` alone.

### §2.5 The prescribed fix (Implement seats, in order)

All seats are `app/worker/src/client.ts` unless named. Line numbers are the Plan base's; Implement re-diffs them (§2.7 R1).

1. **`openRead` — kill the placeholder, paint the track's own line (client:18438).** The hardcoded `the episode&rsquo;s text` is deleted. The sub-line paints the track's own description where one is carried — `t.descText` — and where none is carried the `<p class="sub">` element does not stand at all (no empty placeholder element, no generic noun phrase). To carry `descText` for own tracks, two forwarding seats join this change: the own feed matcher births the meta with the item's `descText` (the feed parser already computes it, client:18905–18913; the matcher at client:21972 drops it today), and `ownSlotTrack` forwards `descText: meta && meta.descText ? meta.descText : null` (its v483 `imageUrl` forwarding is the standing precedent at the same seat). `trackDesc` already forwards `descText` (client:16306) — no change there for this field.
2. **`trackDesc` — restore the text seat at the dropping seam (client:16306).** The output object gains `hasText: !!t.hasText, textUrl: t.textUrl || null`. Every composed descriptor then carries its text seat, Now Playing's fallback to `state.current` (client:18580/18585) works without the side registry, and the composed list — the source of record — can answer the Read question for every kind. No other seam changes: `expandDescs` and the folds in `extRebuildDescs` pass track objects through this one seam for descriptor emission.
3. **The honest empty state (exact paint).** Where a track genuinely carries no text — no `textUrl`, or the fetch fails — the sheet paints: the title, the play control, the track's own sub-line only where `descText` stands (seat 1), and an **empty body** — the v630 catch paint (client:18466–18470) stands unchanged, skeleton cleared, no words added. Honesty is by absence: nothing on the sheet claims to be, or describe, text that is not there. No "No text available" sentence, no placeholder, no caption (§1 OUT, John's v630 word).
4. **COMPANION DATA LEG — not a client seat; the coordinator seats it separately and Ship may not claim the field leg without it.** (a) Re-stage the missing app-text objects for **2026-11-24, 2026-11-26, 2026-11-28** (re-verify the full date range at Implement; later dates may join) into `ora-pro-nobis-audio` under `texts/<date>/<canonical id>.txt`, bytes taken from each episode's public transcript file — proven byte-identical to the staging source at §2.1 — through the standing staging route (`POST /api/agent/player/episodes/text`, the v318 route) or an equivalent R2 PUT, with a per-object remote GET read-back per key (the v562 lesson: remote GETs govern, list endpoints lag). (b) Diagnose the alternation: the publish runs for those dates skipped `_publish_app_texts` (pass2:1053, call at pass2:1305) or withheld every episode at its guard — name which, from the runs' own logs, before the next publish cycle; a code fix there is that leg's own scope, not v696's.

### §2.6 Harness spec — `app/worker/harness-v696.mjs` (new, Implement builds it)

**Fixture (Improvement D — production source named).** The real 2026-11-26 `morning-prayer` record in its `ownSlotTrack` output shape, drawn from two production sources read at Plan: (i) the live feed item `docs/podcast.xml:27` — title after the `ownFeedTitle` strip `Morning Offering (Extended)`, enclosure `https://audio.orapronobis.media/morning-prayer-elevenlabs-2026-11-26.mp3`, length 3868701, description `Morning Offering (Extended) for November 26, 2026. The daily opening prays with the selected saint witness and an approved saying, alongside the liturgical day.`; (ii) the episode's script bytes from its own transcript file (`morning-prayer-elevenlabs-2026-11-26.txt`), whose Morning Offering block opens "Morning Offering - O Jesus, through the Immaculate Heart of Mary and the Chaste Heart of St. Joseph,". The harness stubs `fetch` for `/api/player/text/2026-11-26/morning-prayer` — 200 with those bytes for the text legs, 404 for the empty leg (today's production shape, §2.1).

**Legs.**
- **A — the words come through:** `openRead` on the fixture (200 stub) → the body contains `O Jesus, through the Immaculate Heart of Mary and the Chaste Heart of St. Joseph` and `I offer You my prayers, works, joys, and sufferings of this day`; the sub-line is the fixture's own description line (seat 1) — and in no case the placeholder.
- **B — the seam carries the seat:** `trackDesc` / `expandDescs` on the fixture's track object → the composed descriptor carries `hasText: true` and `textUrl: '/api/player/text/2026-11-26/morning-prayer'` exactly; a text-less track object composes to `hasText: false, textUrl: null`.
- **C — the honest empty:** `openRead` on the fixture with the 404 stub (and again on a `textUrl: null` variant) → body empty after settle, skeleton gone, sub-line absent or the description line only, and the sheet's whole HTML contains none of `the episode's text`, `the episode&rsquo;s text`, `the episode’s text`.
- **D — the placeholder stands nowhere:** the same three-string sweep over `openRead` output for a second own family (`daily-rosary`, same fixture discipline) and over the built client source itself (source-level grep assertion, both apostrophe forms + the entity form).
- **E — office control:** `openRead` on an office fixture still paints the widget branch, replaces the sub with the widget head, and issues no text fetch (the v675/v676 behavior, unchanged).

**Regressions (standing tallies, re-run whole):** harness-v690 **33/0** · harness-v677 **18/0** · harness-v675 **47/0** · harness-v676 **50/0** (the two harnesses that cover the `openRead` seat) · harness-v630 re-run at its standing tally — its v630 legs pin the empty-on-failure body, which seat 3 keeps; only the sub-line paint moves.

### §2.7 Risks and the re-diff list

- **R1 — seat drift.** v691, v692, v694, and v695 land before Implement and shift `client.ts` seats. Implement re-diffs, by function name not line: `openRead` (the sheet `innerHTML` + the office branch + the fetch/catch), `trackDesc` (the output object), `ownSlotTrack` (the forwarded fields), the own feed matcher (the meta birth beside `imageUrl: '/logo.png'`), `extParseFeed` (the `descText` computation), the Now Playing Read gate + act, and every `[data-read]` wiring. Any seat whose shape changed under those releases is re-grounded before it is touched.
- **R2 — `trackDesc` widening touches every descriptor.** `hasText`/`textUrl` now ride the composed list into the queue and the native day snapshot (`pushDaySnapshot`). Implement verifies no consumer reads the new fields adversely (the snapshot's shape is additive; the harness's leg B plus the v690/v677 regressions are the proof surface).
- **R3 — the sub-line's new content.** Own `descText` is the feed description truncated to 240 chars by the parser (client:18913) — the same snippet the episode card paints, so the dress is consistent; if Review prefers no sub-line at all on the Read sheet, seat 1's fallback (element omitted) already covers the no-`descText` case and the change is a one-line narrowing, named here so Review does not read it as a deviation.
- **R4 — the data leg is a hard dependency for the field leg.** With seats 1–3 shipped and seat 4 unlanded, 2026-11-26's sheet paints honestly (no placeholder, empty body) but still not the words. Ship's field claim must name seat 4's read-back; a harness pass alone does not prove the field.
- **R5 — the alternation may recur.** Until seat 4(b) names why alternate publish runs skip app-text staging, new dates can join the missing set; the harness cannot see this — it is a production-data watch, owned by the data leg.

## §2 Addendum — Data-repair leg (2026-11-26, seat chain-v696-data, contract 1210)

### A. Verified deficient-date map (production R2 `ora-pro-nobis-audio`, read 2026-11-26)

Prefix `texts/<date>/` listed for 2026-11-20 → 2026-11-29 and compared against each date's plan episode count (`~/workspace/ora-runner-runs/<date>/plan.json`):

| Date | Episodes | Objects in R2 | State |
|---|---|---|---|
| 2026-11-20 | 14 | 14 | full |
| 2026-11-21 | 14 | 14 | full |
| 2026-11-22 | 13 | 13 | full |
| 2026-11-23 | 10 | 10 | full |
| 2026-11-24 | 9 | 0 | **deficient** |
| 2026-11-25 | 10 | 10 | full |
| 2026-11-26 | 10 | 0 | **deficient** |
| 2026-11-27 | 10 | 10 | full |
| 2026-11-28 | 11 | 0 | **deficient** |
| 2026-11-29 | — | 0 | not a gap: no rundir/plan exists for 2026-11-29 — its episodes are not yet published (publish runs ~date−2) |

Repair scope = exactly 2026-11-24, 2026-11-26, 2026-11-28 (30 objects). No other date was touched.

### B. Re-stage + per-object remote read-back

Route: the runner's own standing staging path — `runner/pass2_build.py` `_transcript_plan` (bytes from each rundir's `script-<key>.txt`, trailing whitespace folded to one final newline, T1 guard applied; missing/withheld = none on all three dates) feeding `_publish_app_texts` (PUT to bucket `ora-pro-nobis-audio`, key `texts/<date>/<canonical id>.txt`, content-type text/plain). Verification: an independent remote GET of every staged object from the app bucket, byte-length + SHA-256 compared against the staged source bytes (remote GETs govern; the objects-list endpoint was used only for the prefix map, never as proof).

- **2026-11-24 — 9/9 staged, 9/9 read-back match:** morning-prayer (4070 B), daily-rosary (19436 B), marian-antiphon-angelus (1601 B), auxilium-christianorum (6059 B), daily-reflection (1780 B), novena-st_catherine_of_alexandria (3420 B), novena-miraculous_medal (3851 B), novena-st_andrew_the_apostle (2485 B), novena-st_edmund_campion (2105 B).
- **2026-11-26 — 10/10 staged, 10/10 read-back match:** morning-prayer (4030 B), daily-rosary (19478 B), marian-antiphon-angelus (1633 B), auxilium-christianorum (6990 B), daily-reflection (1632 B), novena-miraculous_medal (3822 B), novena-st_andrew_the_apostle (2521 B), novena-st_edmund_campion (2102 B), novena-st_barbara (3327 B), novena-st_john_damascene (3945 B).
- **2026-11-28 — 11/11 staged, 11/11 read-back match:** morning-prayer (4031 B), daily-rosary (19018 B), marian-antiphon-angelus (1578 B), auxilium-christianorum (6186 B), daily-reflection (1352 B), novena-st_andrew_the_apostle (2457 B), novena-st_edmund_campion (2042 B), novena-st_barbara (3245 B), novena-st_john_damascene (3839 B), novena-st_nicholas (2184 B), novena-st_ambrose (3233 B).

All three dates count repaired: every object reads back from the remote store byte-identical to its source.

### C. Diagnosis — why alternate publish runs skipped app-text staging

**Cause (proven, code + run evidence): `_publish_app_texts` has exactly one caller, and the finisher path never calls it.**

- Code: `_publish_app_texts` is defined at `runner/pass2_build.py:1053` and called at exactly one seat, `pass2_build.py:1305`, inside `publish_drop` — as step (2c), *after* the audio R2 upload (step 1) and the public-transcript upload (step 2b). Any `publish_drop` run that dies before step (2c) stages no app texts, and no later step re-runs it.
- Code: `reconcile_drop` (`pass2_build.py:1485`) — the idempotent tail finisher — completes R2 audio upload, public transcripts (`_publish_transcripts`, both graft and resume branches), feed graft, deploy, transcript verification, and the ledger flip, but **never calls `_publish_app_texts`**, and none of its checks (a)–(d) (local set · public-bucket R2 manifest · live feed · ledger) reads the app bucket's `texts/` prefix. A date finished by reconcile alone therefore publishes completely — feed, audio, public transcripts, ledger — with zero app texts, and no check anywhere names the loss.
- Run evidence, deficient dates (every one was finished by `--reconcile`, none by a `publish_drop` that reached step 2c):
  - 2026-11-28: the `--publish` run died *before any upload* — `http.client.IncompleteRead` on the live-feed fetch at `pass2_build.py:1289` (`pass2-publish.log`). The date was then finished by reconcile (`pass2-reconcile-curl.log`: "RECONCILE RESULT 2026-11-28: tail completed — R2 upload of 22 object(s) … feed graft of 11 item(s) … ledger flip", feed commit `05c84a1`).
  - 2026-11-26: the last `--publish` attempt died at step (1) — "R2 upload failed for 2026-11-26-st_john_damascene-day-2.mp3 … internal error" (`pass2-publish4.log`), before step (2c). Two reconcile runs finished the date (`pass2-reconcile.log`, `pass2-reconcile2.log`: feed graft of 10 items, commit `e1c6742`, ledger flip).
  - 2026-11-24: both `--publish` logs (`pass2-publish.log`, `pass2-publish2.log`) end at `BUILD_DONE` with no publish tail — no retained log shows a run reaching step (2c) — and reconcile found audio R2 already OK with the feed at 0/9 and finished the date by graft (`pass2-reconcile.log`: commit `16961de`, ledger flip).
- Run evidence, healthy dates (the alternation is incidental, not a toggle): a date's texts stand iff *some* `publish_drop` run reached step (2c), even if that run later failed. 2026-11-25's `publish_drop` ran clean (`pass2-publish2.log`: "App texts (v342): 10 staged"). 2026-11-23's first publish died at deploy *after* staging (`pass2-repair.log`: "App texts (v342): 10 staged for 2026-11-23" followed by a deploy-failure line), and reconcile only finished the graft — texts already stood. 2026-11-22 likewise staged in its publish log. There is no every-other-run condition in the code; the alternating pattern is the accident of which runs died before step (2c) in this window.
- The T1 withholding guard is **not** the cause: on all three deficient dates the transcript plan staged every episode (reconcile logs and this leg's re-run both read "transcripts uploaded = episodes, missing none"), and `_publish_app_texts`' own withheld list would have been empty.

**Fix shape (named here, NOT applied — runner code is a separate seat's scope):** in `reconcile_drop`, stage app texts from the full-day transcript plan it already computes (`tinfo_full`): call `_publish_app_texts(plan, date_iso, tinfo_full)` in both tail branches, next to the existing `_publish_transcripts` calls, before the ledger flip; and add an app-bucket check to reconcile's check list — GET/list `texts/<date>/` in `ora-pro-nobis-audio` against the plan's canonical ids — so a published-but-unstaged date is detected and repaired by the finisher instead of passing silently. Optionally also move `publish_drop`'s step (2c) ahead of the audio upload so an early abort cannot strand it, but the reconcile call alone closes the proven gap.

### D. Contract 1210

- "Missing-date episode texts re-staged to R2 + per-object remote read-back verified" — met by §B (30/30 objects, remote GET + SHA-256 match).
- "Alternating publish-run skip diagnosed + cause named in the release doc" — met by §C.

## §2 Addendum-2 — Runner fix (2026-11-26, seat chain-v696-runnerfix, contract 1213)

- **Fork commit:** `12bff66031b7558ca8e323d04621c353f5de2011` on branch `muse-draft-week` in `~/workspace/projects/spotify_praylist-fork` — LOCAL ONLY, not pushed (standing practice). One file: `runner/pass2_build.py` (+58/−3).
- **Staging, both tail branches of `reconcile_drop`, before the ledger flip:** graft branch (`pass2_build.py:1618`, beside `_publish_transcripts(rundir, plan, only_episode_ids=set(missing_eps))`) and resume branch (`pass2_build.py:1654`, beside that branch's transcript read-back — the resume branch has no `_publish_transcripts` call of its own). Both call `_publish_app_texts(plan, date_iso, tinfo_full)` — publish_drop step (2c)'s exact shape (2c: `pass2_build.py:1305`, with its own full-day `tinfo`). Arguments in scope in both branches: `plan` + `date_iso` are reconcile's own locals; `tinfo_full` is built in the shared tail preamble from `_transcript_plan(rundir, plan)` (full day, no filter). The graft branch deliberately does NOT pass its `tsub` (missing-items-only) — that would strand the non-missing episodes' app texts.
- **App-bucket check (e):** new helper `_app_text_state(plan, date_iso)` (`pass2_build.py:1438`) reads the app bucket listing via the standing `_cf_r2_list()` (`CF_BUCKET` is the app bucket `ora-pro-nobis-audio`; `APP_TEXT_BUCKET` names the same bucket) and returns `(ok, missing_canonical_ids, present_count)` for keys `texts/<date>/<canonical id>.txt` against the plan's canonical ids (`ep.get("key") or ep["episode_id"]`). Reported in the standing check shape as `CHECK app texts: OK|INCOMPLETE — <present>/<episodes> …; missing: […]`, once in the check list after (d) ledger (`pass2_build.py:1568` seat; the already-complete early return and the ledger-done NOTE now also require `app_ok`, so a published-but-unstaged date enters the tail instead of passing as complete) and again after each branch's staging call (`CHECK app texts (after staging): …`). On a post-staging shortfall it prints loudly: `RECONCILE WARNING <date>: app texts INCOMPLETE after staging — missing: […]; the date must not be read as fully published until these texts stand in the app bucket.` An upload failure inside `_publish_app_texts` keeps its standing discipline: `SystemExit` before the graft / ledger flip, caught as `RECONCILE FAILED mid-tail`.
- **Verification:** `python3 -m py_compile runner/pass2_build.py` — OK. Both changed seats + the check seats read back from the committed tree. No live publish or reconcile was run against production. No import-level check was run: importing `pass2_build` executes module-level code in a publish runner and a dry import offers no proof of the reconcile seats without risking side effects — compile + read-back is the named proof for this seat.
- **Not done, deliberately:** `publish_drop` step (2c) was NOT moved ahead of the audio upload (the Addendum's optional extra) — the reconcile call closes the proven gap; no other runner changes, no refactors.

## §3 Implement record (2026-11-26, seat chain-v696-impl, contract 1225)

### Rebase
- `release/v696` rebased cleanly (no conflicts) onto `origin/main` **39dd8f0dced196d8e5a4e81dd88adf3a7740d48c** (v695 ship head, fetched fresh; remote head governed). Rebased head before Implement commits: `1ab0893`.

### Re-diff outcome (Plan §2.7 R1 list, by function name, base 7e85dea → 39dd8f0)
Every seat's **shape is unchanged**; only line numbers shifted. No seat needed re-grounding beyond the line move.
- `openRead` (now client:18594; sheet `innerHTML` at 18607): placeholder literal `the episode&rsquo;s text` intact at the same seat; office branch (sub + body widget replacement, return before fetch) intact; fetch/catch (v630 empty-on-failure) intact.
- `trackDesc` (now 16442; output object 16456): field list exactly as Plan read it — `hasText`/`textUrl` still absent. No drift.
- `ownSlotTrack` (now 21960): forwarded fields as Plan read them (`imageUrl` v483 forwarding precedent standing); no `descText` forwarding yet. No drift.
- Own feed matcher (meta birth now ~22236, beside `imageUrl: '/logo.png'`): as Plan read it — no `descText` carried. No drift.
- `extParseFeed` (now 19048): `descText` computation intact (19074, truncated to 240 at 19082).
- Now Playing Read gate + act (now 18841–18850 gate · 18749–18754 act): unchanged — gate tests `readTracks` entry `hasText && textUrl` or `lohOffice676`; act prefers `readTracks` then falls back to `state.current` (the composed descriptor — the seat §2.5 seat 2 repairs).
- `[data-read]` wiring (14286/14300 · 19376 · 22009 · 24064): all read `state.readTracks[...]` → `openRead(t)`, unchanged.

### What landed (all `app/worker/src/client.ts`, commit `3afd50d`)
1. **Seat 1 — `openRead`:** the hardcoded `the episode&rsquo;s text` sub-line is DELETED. The sub-line now paints `esc(t.descText)` where the track carries one; where none is carried the `<p class="sub">` element does not stand at all. One named guard: an office track keeps the (initially empty) sub element even with no `descText`, because the untouched office branch replaces that element with the widget head — without it, an episode-shaped office descriptor with `descText: null` (harness-v676's P5 shape) would lose the widget head. Office branch code itself untouched.
   - Forwarding: the own feed matcher births the meta with `descText: it.descText || null` (extParseFeed already computes it); `ownSlotTrack` forwards `descText: meta && meta.descText ? meta.descText : null`.
2. **Seat 2 — `trackDesc`:** output object gains `hasText: !!t.hasText, textUrl: t.textUrl || null`. Every composed descriptor now carries its text seat; Now Playing's fallback to `state.current` can answer the Read question without the side registry.
3. **Seat 3 — honest empty state:** no code change needed beyond seats 1–2 — the v630 catch paint stands unchanged (body clears to `''`, skeleton gone, no sentence added). Verified by harness legs C.

### Harness — `app/worker/harness-v696.mjs` (new, commit `b4669dc`): **27 ok, 0 bad**
- F (fixture provenance): 2/2 — real 2026-11-26 feed record (`docs/podcast.xml:27`) + real script bytes (rundir `script-morning-prayer.txt`, 4030 B staged source).
- A (words come through): 5/5 — body carries both named lines; sub-line = the fixture's own feed description; fetch went to `/api/player/text/2026-11-26/morning-prayer`.
- B (seam carries the seat): 4/4 — composed descriptor `hasText: true`, `textUrl` exact, `descText` rides; text-less track composes to `hasText: false, textUrl: null`.
- C (honest empty): 9/9 — 404 leg and `textUrl: null` leg: body empty, skeleton gone, no placeholder, no "text unavailable" sentence; the null leg's sub element does not stand. (Harness note: the stub answers fetch("null") with 404, modeling a real browser's relative-URL request + server 404, which is what drives the v630 catch.)
- D (placeholder stands nowhere): 4/4 — daily-rosary sheet sweep (all three apostrophe forms) + sub-line = its own feed description + real script opening paints; built client source sweep clean.
- E (office control): 3/3 — widget iframe paints, sub carries the widget head, no `/api/player/text` fetch issued.

### Regressions — DEVIATION NAMED (no harness re-pointed, none edited)
Re-run whole on this tree vs **identical runs on the untouched base tree (39dd8f0)** — the Implement delta is **zero on every harness**; the differences from the Plan's standing tallies are pre-existing at the v695 base:
- harness-v690: **33/0** — matches standing tally.
- harness-v677: **18/0** — matches standing tally.
- harness-v675: **44/3 on this tree AND 44/3 at base.** F = stale release-pin assertion (expects v675|v673 pin; served pin is v695-1). R2 + P1 test the `plainText675` opt-out, which v676 retired (v676's P7 pins the opposite behavior) — superseded legs, failing since v676 landed.
- harness-v676: **49/1 on this tree AND 49/1 at base.** The single failure is F's stale pin assertion (expects `ora-pro-nobis-v676-1`; served pin is v695-1). All functional legs pass, including P5 (episode-shaped office, `descText: null`) and P7.
- harness-v630: **crashes identically on this tree AND at base** (`OPN_CLIENT=<base client.ts>`): `ReferenceError: LOH_OFFICE_SLOTS_675 is not defined` at `openRead` → `lohOffice676` → `lohOffice675`. Its slice extractor's `VAR_ALLOWLIST` never gained `LOH_OFFICE_SLOTS_675` when v675/v676 made `openRead` call the office predicate — pre-existing harness rot since v676, not a v696 effect. Its empty-on-failure body legs therefore could not be re-run at this base; the same behavior is covered on this tree by harness-v696 legs C (404 + null) and harness-v676 C2.
- **Review adjudication requested:** the Plan §2.6 standing tallies for v675/v676/v630 are not reproducible at the v695 base for the reasons above. No tally was silently re-pointed; the harnesses stand as committed upstream.

### Commits (on `release/v696`, after rebase head 1ab0893)
- `3afd50d` — Implement seats 1–3 (client.ts, +7/−3).
- `b4669dc` — harness-v696 (new, 239 lines).
- This §3 record — committed with the close-out.

## §4 Review record (2026-11-26, seat chain-v696-review, contract 1226) — VERDICT: PASS

### Independent harness runs (Review seat, this tree, head acb4299)
- harness-v696: **27 ok, 0 bad** — matches §3.
- harness-v690: **33 ok, 0 bad** — matches standing tally.
- harness-v677: **18 ok, 0 bad** — matches standing tally.
- harness-v675: **44 ok, 3 bad**.
- harness-v676: **49 ok, 1 bad**.
- harness-v630: **load crash** — `ReferenceError: LOH_OFFICE_SLOTS_675 is not defined` at `openRead` → `lohOffice676`.

### Base-delta verification (untouched base 39dd8f0, scratch worktree + OPN_CLIENT)
- harness-v675 at base: **44 ok, 3 bad** — failing legs identical to this tree, leg for leg: F (stale release pin), R2 and P1 (the `plainText675` opt-out legs).
- harness-v676 at base: **49 ok, 1 bad** — failing leg identical: F (stale pin `ora-pro-nobis-v676-1`).
- harness-v630 at base (`OPN_CLIENT=<base client.ts>`): **identical crash**, same `ReferenceError: LOH_OFFICE_SLOTS_675 is not defined`.
- **Implement delta vs base = zero on every harness.** §3's base-delta claim is verified firsthand, not taken on trust.

### Diff read (commit 3afd50d, read whole; +7/−3, client.ts only)
- Placeholder literal gone in all forms: grep of the branch client source for `episode's text`, `episode&rsquo;s text`, and `episode’s text` returns **0 / 0 / 0**; harness-v696 leg D's source sweep agrees.
- The sub-line paints only the track's own `descText` (`esc(t.descText)`), forwarded by exactly two seats: the own feed matcher births `descText: it.descText || null` on the meta, and `ownSlotTrack` forwards `descText: meta && meta.descText ? meta.descText : null`. No other content reaches the sub-line.
- `trackDesc` gains exactly `hasText: !!t.hasText, textUrl: t.textUrl || null` appended to the output object; no other field changed shape.
- The office branch code is **untouched** (absent from the diff). The v630 catch paint is **unchanged** (absent from the diff).
- No client fetch to the public transcript host was added — the diff contains no fetch change and no `audio.orapronobis.media` reference; the v312/v318 own-store settlement stands.

### Adjudication 1 — the office guard (empty sub element kept for office tracks): SOUND, accepted
- Plan §2.5 seat 1 kills the placeholder **string** and directs that the sub element not stand where no `descText` is carried. The office branch — which §1 places OUT of scope for change — replaces that element's content with the widget head; with no element standing, the widget head has no seat and an episode-shaped office descriptor (`descText: null`, harness-v676's P5 shape) would lose it.
- The guard keeps the element only on the office path (`t.descText || lohOffice676(t)`), paints it empty, and the untouched office branch replaces it immediately. No placeholder text, no generic noun phrase, and no non-office track ever carries the empty element. This honors the Plan's intent — the string is what dies — and the §1 OUT boundary on the office branch.
- Proven in runs: harness-v696 leg E (3/3 — widget paints, sub carries the widget head, no text fetch) and harness-v676 P5 passes on this tree.

### Adjudication 2 — regression tallies vs Plan §2.6 standing tallies: PASS on this point
- The Plan's standing tallies (v675 47/0 · v676 50/0 · v630 standing tally) are not reproducible at the v695 base, and the shortfall is **pre-existing at base with zero Implement delta**, verified leg-for-leg above: v675's R2/P1 legs test the `plainText675` opt-out that v676 retired (v676's P7 pins the opposite behavior — superseded legs, failing since v676 landed); the F legs in both harnesses assert stale release pins; harness-v630's crash is slice-extractor rot (`VAR_ALLOWLIST` never gained `LOH_OFFICE_SLOTS_675` when v675/v676 made `openRead` call the office predicate), present identically at base.
- Returning v696 for failures its diff neither caused nor could fix would misattribute base rot to this release. The behavior v630's legs pin (empty body on fetch failure) is covered on this tree by harness-v696 legs C (404 + `textUrl: null`, 9/9) and harness-v676 C2. This matches the standing precedent: the v697 Plan measured the same v675/v676 tallies at the v691 base and named them superseded/pre-existing, not regressions.
- Named for the record, not as a v696 condition: harness-v630's extractor allowlist and the stale pin/opt-out legs in v675/v676 remain upstream rot for a future harness-repair seat.

### Verdict
**PASS.** Seats 1–3 land exactly as prescribed; the placeholder stands nowhere; the composed descriptor carries its text seat; both deviations are adjudicated sound / pre-existing with zero delta. The field leg for 2026-11-24/-26/-28 rests on the data leg's per-object remote read-back (§2 Addendum §B, 30/30), per Plan §2.7 R4 — Ship must name that read-back in its field claim.
