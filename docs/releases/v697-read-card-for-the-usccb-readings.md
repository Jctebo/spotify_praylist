# v697 — Read Card for the USCCB Readings

## §1 Direction + grounded current state

### §1.1 The direction

John, 2026-11-26 09:59 CT, verbatim: **"Put a read card in the ucssb using the same source that the mass uses."**

- "the ucssb" = the USCCB readings episode — the "Daily Mass Reading Podcast" (series `daily-readings`, feed def `index.ts:4108`: `{ key: "daily-readings", title: "USCCB Daily Readings Podcast", … }`).
- The card is a **Read act + a native card**, on the v675/v676 pattern (the Liturgy of the Hours Read): the act stands in the player bottom row and on the episode's track page; the card shows **the day's readings text — citations + words**.
- The text source is **the same source the Mass uses** (§1.4) — never a second source, never the podcast's own description text (`descText`), never the DivineOffice.org iframe widget (that is the Hours' card, §1.2).

### §1.2 Field evidence — the screenshot

`~/workspace/user/files/6305_9_fz67.jpg` (John, 2026-11-26 09:59 CT): Now Playing for **"Daily Mass Reading Podcast for November 26, 2026"**, block **Morning**, liturgical line "Thursday in the 34th Week in Ordinary Time", playing at 5:10 / −0:48. Bottom row: **Intentions On · ☆ · share · ⋮ · Queue — NO Read**. The Read slot stands held-but-invisible in that row (§1.3, seat 1): the gap between "Intentions On" and the star is the held `#np-read` box. The episode is playing **from Morning — the composed fold seat** (§1.5, shape a).

### §1.3 The office Read pattern (the mold)

All in `app/worker/src/client.ts` unless named.

- **Predicate v675** — `lohOffice675(t)` at **client.ts:17649**, over the literal slot set `LOH_OFFICE_SLOTS_675` at **client.ts:17648**: true iff `t.episodeId` is one of the eight Divine Office hour slots (`ext-invitatory · ext-morning-prayer · ext-midmorning-prayer · ext-midday-prayer · ext-midafternoon-prayer · ext-office-of-readings · ext-evening-prayer · ext-night-prayer`). Slot identity only — never source, kind, or title (comment, client.ts:17640–17648).
- **Predicate v676 (the standing, widened one)** — `lohOffice676(t)` at **client.ts:17661–17675**, three arms: (a) `lohOffice675(t)`; (b) `t.slotId` in the same eight-slot set; (c) `t.source` is `'Divine Office'` or `'Sing the Hours'` AND `t.title` names an office hour (phrase test against `LOH_OFFICE_HOURS_676`, client.ts:17660).
- **Seat 1 — player bottom row (v676).** The button `#np-read` stands in the Now Playing control row built at **client.ts:18558** (`openNowPlaying`; the row literal carries `<button class="btn ghost" id="np-read">Read</button>`). Its click handler at **client.ts:18601–18605**: resolves `t = state.readTracks[state.current.episodeId] || state.current`; where `lohOffice676(state.current) || lohOffice676(t)` it calls `openRead(…)` with the predicate-satisfying descriptor; else the standing text test (`t.hasText && t.textUrl`). Its **visibility** is set in `updateNowPlaying` at **client.ts:18699–18700**: visible iff `(rt && rt.hasText && rt.textUrl) || lohOffice676(cur) || lohOffice676(rt)`; otherwise held invisible in its box (`visibility:hidden` + `aria-hidden`, the v419 held-slot rule — the row geometry never moves).
- **Seat 2 — the track page (v675).** `trackPagePaintDay643(L, d)` at **client.ts:17831**: `var office675 = lohOffice676(d)` (client.ts:17832); an office descriptor paints `headHtml = lohWidgetHead675(d, L.date)`, `textHtml = ''` (its `descText` does NOT paint), and `afterPaint` fills `#track-text-643` with the widget body + wire. Non-office: `descText` paints, or a `textUrl` fetch appends.
- **The sheet the act opens** — `openRead(t, opts)` at **client.ts:18444**: a JS-built tall `.sheet.readsheet` (title + same-descriptor play control + `.readtext` body, skeleton bars while loading). The office branch at **client.ts:18474–18482**: where `lohOffice676(t)`, the sheet's `.sub` carries `lohWidgetHead675(t, presentedDateStr())` and the body carries `lohWidgetBody675()`, wired by `lohWidgetWire675`; **no `textUrl` fetch runs**. Non-office: `fetch(t.textUrl)` paints the text; a failed fetch paints the body empty (v630, client.ts:18491–18495).
- **The office card's dress + data source** — `lohWidgetHead675` (client.ts:17682: heading "Liturgy of the Hours" · the hour · the track's own date · the "Text: Divine Office — the widget always shows today's Hours" line · the Sing the Hours audio line · the separate-player note), `lohWidgetBody675` (client.ts:17693: loading line + `<iframe src="https://divineoffice.org/widget">` exactly, no sandbox + hidden failure row), `lohWidgetWire675` (client.ts:17708: load clears the loading line via a no-cors probe; a 6-second timer or an error replaces the block with "Text unavailable — open Divine Office"). Frame sizing in `ui.ts:366`. **The office card's data source is the third-party widget — always today's Hours, regardless of the track's date. The readings card must NOT inherit that date posture (§2.4).**

### §1.4 The readings text source — the Mass's payload (ONE payload, both surfaces)

- **The module** — `app/worker/src/mass-readings.ts`: the USCCB Daily Readings RSS feed (NABRE) fetched server-side (`FEED_URL`, mass-readings.ts:71; the standing pull `pullReadings`, with the v537 spaced retry ladder over the publisher's two addresses and the v529/v531 memorial merge). Words are never altered: part bodies ride as the feed's own HTML (header comment, mass-readings.ts:1–27).
- **The store (v608)** — the D1 display cache `readings_cache` (migration 0046): `storedReadings` (mass-readings.ts:455) reads `SELECT body FROM readings_cache WHERE date = ?`; `massReadingsPayload(env, date)` (mass-readings.ts:478–486) is **store-first** — a stored day returns with zero outbound fetches; a miss runs the standing live pull and backfills **on a found payload only**; the nightly grab `grabReadings` (mass-readings.ts:509) fresh-pulls, verifies (`verifyReadings`: found · ≥1 part · every part carries its citation · a Gospel part stands), stores, and **prunes to a rolling 35-day window** (mass-readings.ts:518). The grab's door route is `POST /api/agent/prayer/readings-grab` (index.ts:4726).
- **The route the client reads** — `GET /api/prayer/mass-readings?date=YYYY-MM-DD` (index.ts:5048–5063): session-gated, no PIN; answers `massReadingsPayload(env, date)`; on a throw it answers the empty shape `{ date, found:false, parts:[], copyright:[] }`.
- **Mass vs Lectionary — the call: there are not two payloads.** "Lectionary" is a *side of the Mass tab* (client.ts:7228–7229: the Mass tab's sides are `[['liturgy','Lectionary'],['virtual','Virtual Mass'],['adoration','Adoration']]`), and its readings place is the Mass scroll's own readings place (`<div id="mass-readings">` inside `paintMassScroll`, client.ts:8539). Both names read the **one** client load: `loadMassFeed(dateStr)` (client.ts:7639–7648) fetches `/api/prayer/mass-readings?date=…` into `massFeed`; `massReadingsHtml()` (client.ts:8310) renders `massFeed`'s parts through `massFeedPartHtml` (client.ts:8134: `.mass-h` heading label · citation `.mass-ref` from `part.source` · body via `massFeedLinesHtml`, client.ts:8067); `massAcksHtml()` (client.ts:8413) renders the acknowledgment. The day manifest folds the **same** payload server-side (`dayManifestPayload`, index.ts:620–621: `readings = await massReadingsPayload(env, date)`). **v697 builds on this payload — the Mass's — exactly as John's words govern.**
- **The one adjunct, named and excluded:** the Mass scroll fills a piece the feed lacks from the Universalis JSONP payload (`loadMassReadings` / `massBackupPartHtml`, client.ts:7619–7625, 8170), per piece, with the Universalis/Jerusalem Bible ack lines standing only when a backup piece was used (`massAcksHtml`, client.ts:8428–8437). That fill is a browser-side JSONP adjunct to the scroll, **not part of the payload**; the card does not take it (§2.3 — a day the payload has not landed is not-available, never Universalis-filled, never another day's).
- **Payload shape** (`MassReadingsPayload`, mass-readings.ts:47–64): `{ date, found, title?, parts[], copyright[], memorials? }`. Each part (`MassFeedPart`, mass-readings.ts:29–42): `{ key: 'r1'|'ps'|'r2'|'ga'|'g'|'extra', heading (the feed's own part name, e.g. "Reading 1"), source (the citation, e.g. "Revelation 3:1-6, 14-22"), html (the part body, the feed's own HTML), options? (alternates folded in by `groupFeedParts`) }`. `title` is the feed item's day title. **The acknowledgment's seat:** `copyright[]` — the Lectionary copyright paragraph(s) the feed item itself carries, verbatim (parse, mass-readings.ts:198–205); the Mass surface paints them as `.mass-ack` lines at the readings' foot (`massAcksHtml`, client.ts:8413–8427). The ICEL Missal notice (`MASS_ICEL_NOTICE`, client.ts:7611) belongs to the Missal texts, not the readings, and does not ride the card.
- **The real 2026-11-26 day (verified firsthand from the live feed at Plan time, 2026-11-26 16:01 UTC):** the feed carries Nov 26 as Thanksgiving Day / Thursday of the Thirty-fourth Week in Ordinary Time, with headed parts including Reading I **Sirach 50:22-24** · Responsorial Psalm **Psalm 145:2-3, 4-5, 6-7, 8-9, 10-11** · Reading II **1 Corinthians 1:3-9** · Alleluia **1 Thessalonians 5:18** · Gospel **Luke 17:11-19** (the Thanksgiving selection the feed prints first for the date) and the ferial set headed by Reading 1 **Revelation 18:1-2, 21-23; 19:1-3, 9a** · Gospel **Luke 21:20-28**. Which item `parseUsccbFeed` date-matches (its link test is `…/112626.cfm`, mass-readings.ts:141–148) is exactly what the Implement fixture capture settles (§2.5) — the fixture is the route's own payload, never a hand-built copy.

### §1.5 The readings item's identities — three shapes, one episode

**(a) The composed Praylist fold seat (the screenshot shape).** Server: `dailyReadingsSeat(env, presented)` (index.ts:4569–4590) matches the presented date's episode in the `daily-readings` RSS sequence (`dailyReadingsMatch` — the title "Daily Mass Reading Podcast for \<Month D, YYYY\>") and returns `{ series:'daily-readings', seqKey: hit.key, title, url, durationS, imageUrl, listened, positionS }`. Client: `resolveReadingsSeat590(day)` (client.ts:21120) re-matches by the same title rule into `day.readingsSeat` (only where the effective Morning contents carry the `{kind:'seat', key:'daily-readings'}` selector); `readingsSeatDesc549(seat, block691)` (client.ts:14480–14491) builds the ONE descriptor construction; `foldReadingsSeat(descs, seat)` (client.ts:14494) splices it into Morning **immediately before the `daily-rosary` descriptor** (the v660 fold seat). Descriptor fields, verbatim from client.ts:14486–14491:

```
{ episodeId: seat.seqKey,            // the episode's feed GUID key — NOT a slot id
  kind: 'podcast', seriesKey: seat.seqKey, podSeries: 'daily-readings',
  title: seat.title,                 // "Daily Mass Reading Podcast for November 26, 2026" — carries the date
  url, enclosureUrl: null, available, block: 'Morning' (or the seat item's block, v691),
  source: '', durationS, listened, podPositionS, imageUrl,
  descText: null, spotifyUrl: null, readingsSeat: true }
```

No `slotId`. No date field — the date rides the **title**. `source` is `''`.

**(b) The daily-kind contents item.** A `{kind:'daily', key:'daily-readings'}` contents item (`OPN_DAILY_SERIES_666`, client.ts:2851, includes `'daily-readings'`) is resolved by `resolveDailyDynamic666(day)` (client.ts:20802) via `opnDailyMatch666`'s daily-readings arm (client.ts:20760–20770: exact title-date match, never-later guarded; else the newest earlier episode, `stale:true`). The descriptor (client.ts:20905–20912):

```
{ episodeId: e.key, kind: 'podcast', seriesKey: e.key, podSeries: 'daily-readings',
  title: (e.label ? e.label + ': ' : '') + e.title, url, available, block: <contents block>,
  source: 'USCCB Daily Readings Podcast' (opnDailySeriesTitle666, client.ts:2867–2870),
  durationS, listened, podPositionS, imageUrl, descText: e.descText || null, spotifyUrl: null,
  stale, daily666: true, dailySeries: 'daily-readings' }
```

The v677 settled store (`opnDailySettled677` / `opnDailySettlePut677`) holds this descriptor by (presented date, block:series) — a settled copy rebuilds from the stored `desc`, so **a stale settled descriptor's title still names its own (earlier) date**. No `slotId`, no `readingsSeat` flag.

**(c) The ext slot.** Slot def `ext-usccb-readings` (seed source row `usccb-daily-readings`, block "Mass and Homilies", client.ts:2771; slot block maps index.ts:904, 936). Its resolution record stands in `ext_resolutions` per (date, slot_id) and reaches the client as the slot state `state.extSlots['ext-usccb-readings']`; `extSlotTrack(slot, st)` (client.ts:19047–19058) builds:

```
{ episodeId: 'ext-usccb-readings', title: st.title, kind: 'external', source: st.source,
  available: st.state === 'present', streamUrl, durationS, sizeBytes,
  hasText: false, textUrl: null, _block: slot.block, imageUrl, descText,
  stale, unresolved, resolvedAt }
```

The episode is picked by the same title-date rule server-side (`extMatchUsccb`, index.ts:6141–6144). No `slotId` field (the slot id rides `episodeId`), no `podSeries`, no date field — the resolution is per-presented-date.

**Which shapes the act must fire for: all three.** They are one episode in three dresses; John's screenshot is shape (a), but the same episode stands as (b) wherever a profile's contents carry the daily item instead of the seat, and as (c) wherever the source row stands (its standing home, "Mass and Homilies", and any block a Move places it in). A Read that fires for only one dress is the v654/v655 trap class in a new form.

**The trap, named:** composed descriptors hold `source` but no `kind` in some dresses, and here the three dresses disagree on almost every field — shape (a) has `kind:'podcast'` + `source:''`, shape (b) has `kind:'podcast'` + a series-title `source`, shape (c) has `kind:'external'` + a provider `source`. **No predicate may key on `kind` alone, on `source`, or on `hasText`/`textUrl`** (all three dresses carry `hasText` unset/false and `textUrl` null — the standing text test can never fire for this episode, which is why the screenshot row shows no Read).

### §1.6 Regression tallies measured on this base (7089be0, 2026-11-26, Plan seat, firsthand runs)

| Harness | Result on this base | Reading |
|---|---|---|
| harness-v677 | **18 ok, 0 bad** | as tasked |
| harness-v690 | **33 ok, 0 bad** | as tasked |
| harness-v676 | **49 ok, 1 bad** | the 1 bad is only the `F` pin leg (the served pin is v691's, not `ora-pro-nobis-v676-1`) — all 49 functional legs pass |
| harness-v675 | **44 ok, 3 bad** | the 3 bad are: the `F` pin leg (same cause), and `R2` + `P1` — the v675 plain-text opt-out legs that **v676 §3.2 retired by design** (the office branch ignores `plainText675`); they fail on every post-v676 tree and are superseded, not regressions. All 44 standing functional legs pass |

Implement's regression bar (§2.5): v676 functional legs stay green (its pin leg turns green only if the pin leg is re-pointed — out of scope; the bar is **no new bad**), v675 stays at exactly these 3 named bad, v677 18/0, v690 33/0.

## §2 The build prescription

Client-only release: `app/worker/src/client.ts` + `app/worker/src/ui.ts` (card dress, only if a rule is needed) + the release pin. **No server change** — the route, the store, and the payload already stand (§1.4). No new source, no new route, no migration.

### §2.1 The predicate — `usccbReadings697(t)`

Stands beside `lohOffice676` (client.ts:17661), in the same commented-literal discipline:

```js
function usccbReadings697(t) {
  if (!t) return false;
  if (t.readingsSeat === true) return true;              // shape (a): the fold seat's own flag
  if (t.podSeries === 'daily-readings') return true;     // shapes (a)+(b): the series key both carry
  if (t.dailySeries === 'daily-readings') return true;   // shape (b): the v666 dynamic stamp
  if (t.episodeId === 'ext-usccb-readings') return true; // shape (c): the slot id rides episodeId
  if (t.slotId === 'ext-usccb-readings') return true;    // shape (c), slotId-carrying copies
  return false;
}
```

- **Identity fields only** — the seat flag, the series keys, the slot id. Never `kind` (the dresses disagree, §1.5), never `source` (shape (a) carries `''`), never `hasText`/`textUrl` (never set for this episode), never title text (titles are display, not identity — the title is used for the *date* only, §2.4).
- **Exclusion proof — every other episode fails every arm:** Bible in a Year (podSeries/dailySeries `'bible-in-a-year'`, ext slot `ext-bible-in-a-year`), Daily Gospel Exegesis (`'daily-gospel-exegesis'` / `ext-gospel-exegesis`), Saint of the Day (`'saint-of-the-day'` / `ext-saint-of-the-day`), the dynamic Mass items (`mass688`/`massSeries` stamps, no readings fields), own Ora episodes and every other podcast series (their own `podSeries`, no seat flag) — none carries `readingsSeat`, a `'daily-readings'` series key, or the `ext-usccb-readings` id.
- **Disjointness from `lohOffice676` — proven on the identity fields, both directions.** A readings descriptor: `episodeId` is a feed GUID key (shapes a/b) or `'ext-usccb-readings'` (shape c) — never one of the eight office slots, so office arms (a)/(b) fail; `source` is `''`, `'USCCB Daily Readings Podcast'`, or the ext provider source — never `'Divine Office'`/`'Sing the Hours'`, so office arm (c) fails before its title test (and the title "Daily Mass Reading Podcast for …" names no office hour anyway). An office descriptor: no `readingsSeat`, no `podSeries`/`dailySeries` (office dresses carry neither), `episodeId`/`slotId` in the office set — never `'ext-usccb-readings'`. **Both predicates can never be true of the same track.** Branch order in §2.2 therefore cannot misroute; the office branch still stands first so the v676 path stays byte-identical.

### §2.2 The seats — exactly the two seats the office Read stands in

1. **Player bottom row (the v676 seat).**
   - Visibility, `updateNowPlaying` (client.ts:18699–18700): the test gains `|| usccbReadings697(cur) || usccbReadings697(rt)`. The held-slot discipline is unchanged — a non-readings, non-office, textless track still leaves `#np-read` invisible in its box.
   - Click, the `#np-read` handler (client.ts:18601–18605): after the office arm, a readings arm — `if (usccbReadings697(state.current) || usccbReadings697(t)) { openRead(usccbReadings697(state.current) ? state.current : t); return; }` (the office arm's own preference shape: `state.current` first when it satisfies the predicate, else the readTracks descriptor). The standing text path below is untouched.
2. **The track page (the v675 seat).** `trackPagePaintDay643` (client.ts:17831): beside `var office675 = lohOffice676(d)` (client.ts:17832), compute `var readings697 = usccbReadings697(d)`. Where it stands: `textHtml = ''` (the descriptor's `descText` — the podcast blurb on shapes (b)/(c) — does **not** paint; the card replaces the text seat exactly as the widget does for office), `headHtml = readingsCardHead697(d, L.date)`, and `afterPaint` paints the card body into `#track-text-643` via the §2.3 fetch-and-paint. Where neither predicate stands: byte-identical standing paint.
3. **The Read sheet branch.** `openRead` (client.ts:18444): immediately after the office branch (client.ts:18474–18482), a readings branch keyed on `usccbReadings697(t)`: the sheet stands as today (title, same-descriptor play control, `markPlaying`, `updateDock` — all above the branch, untouched); the `.sub` carries `readingsCardHead697(t, episodeDate697(t))`; the `.readtext` body is filled by the §2.3 fetch-and-paint. **No `textUrl` fetch runs on this branch** (there is none), and the office branch above it is not modified.
- **No other seat.** No row Read button (`readButton`, client.ts:16407, stays gated on the standing text test — the office Read stands in no row either), no episode-card act, no menu act. The act stands wherever the episode stands *in these two seats* and only for it.

### §2.3 The card's paint — native, in the Read sheet's dress, from the one payload

New builders beside the v675 builders (client.ts:~17750), mirroring `lohWidgetHead675` / `lohWidgetBody675` in shape:

- `readingsCardHead697(t, dateStr)` → header HTML in the `.lohhead675` dress (reuse the classes; a readings variant class may ride alongside): heading **"Daily Readings"** · the day name (the payload's `title` where it stands; until the payload lands, the descriptor's own long date) · the date line (the episode's date, formatted via `homilyLongDate`, client.ts:14922 — the same formatter the office head uses). No "always shows today" line — the opposite is true here (§2.4) and no line claims otherwise.
- `readingsCardPaint697(root, payload)` → the body, built **only from payload fields**:
  - For each part in `payload.parts`, in payload order: the part through the Mass surface's own renderer — `massFeedPartHtml(part, MASS_SLOT_LABELS[part.key], i)` (client.ts:8134) — so heading label, citation (`.mass-ref`), option folding, and body cleaning (`massFeedLinesHtml`) are the Mass's own, not a second rendering. (Implementation note: `massFeedPartHtml` reads `state.mass.rchoices` defensively; the card passes the ferial set with no `setKey`, exactly as `massReadingsHtml`'s ferial arm does, client.ts:8335. Memorial sets — `payload.memorials` — do **not** paint on the card: the episode is the day's ferial readings podcast; the memorial chip system stays on the Mass scroll, named out of scope here.)
  - At the foot: the acknowledgment — every line of `payload.copyright[]` as a `.mass-ack` line, exactly as `massAcksHtml` paints them (client.ts:8419–8423). The USCCB/ICEL Lectionary acknowledgment thus stands on the card as it stands on the readings surfaces. No Universalis ack lines (no Universalis piece ever paints on the card, §1.4).
- **The fetch:** `api('/api/prayer/mass-readings?date=' + episodeDate697(t))` — the standing route (§1.4), whose payload is store-first / live-pull-on-miss behind the server seam; the client adds no cache of its own. Until the fetch settles, the sheet's standing skeleton stands (as it does for every Read). On settle, the body is **replaced whole** — parts, or the not-available state below. A rejected fetch takes the same not-available path (never the v630 empty-body path: this card always says which of the two states stands).
- **The not-available state — and the v696 lesson.** Where the payload answers `found:false`, carries no parts, or the fetch fails: the body paints one honest line — **"Readings not available for this day."** — and nothing else: no parts, no other day's text, no acknowledgment (no text stands to acknowledge). The class this avoids, named: **v696's defect was a hardcoded placeholder line standing in an empty Read sheet as if it were content.** This card carries **no hardcoded content strings at all** — every heading, citation, and word in the body is built from the payload's own fields at paint time; the only literals are the heading ("Daily Readings"), the part labels the Mass renderer itself supplies, and the not-available line, which is a *state*, painted only on the payload's own negative answer and never alongside any part. The harness (§2.5) asserts the negative leg's body contains no citation and no other date's text, so a placeholder can never pass as content.

### §2.4 The date rule — the episode's own date

`episodeDate697(t)`:

1. **Primary: the title date.** `opnDailyTitleDate666(t.title)` (client.ts:20713) parses the "Month D, YYYY" the episode's title carries ("Daily Mass Reading Podcast for November 26, 2026" → `2026-11-26`). All three dresses carry this title (shape (c)'s resolution title is the feed episode's own title, picked by the same title-date rule, index.ts:6141–6144). A full `YYYY-MM-DD` result (length 10) is the date.
2. **Fallback: the presented date.** Only where the title yields no full date: `presentedDateStr()` (client.ts:5172) — sound because every dress is built for the presented day (the fold seat and the ext resolution are presented-date constructions; a daily descriptor with an unparseable title was matched *for* the presented day). The fallback never invents a date from `resolvedAt`, publish stamps, or "today".
3. The route is then asked for **that** date and only that date. A settled/yesterday episode (shape (b) stale, its title naming Nov 25) paints **Nov 25's** readings; it never paints today's. A past date inside the store's 35-day window (§1.4) serves its own day from `readings_cache`; a past date outside it live-pulls (the feed carries ~10 days) or answers `found:false` → the §2.3 not-available state. **Contrast with the office card, named so Review does not conflate them:** the widget always shows *today's* Hours and says so (Q3 A, v675); the readings card always shows the *episode's* day and needs no such line.

### §2.5 Harness spec — `app/worker/harness-v697.mjs` (the v675/v676 mold)

The real built Worker bundle (esbuild from source) served locally, the API stubbed, driven Chromium, real acts, same-tick DOM assertions; `ORA_WT` selects the tree for the fail-on-old run.

**Fixtures (Improvement D — production sources named):**
- **The real 2026-11-26 readings payload**: captured from the standing route's own answer for `2026-11-26` — `massReadingsPayload`'s JSON as `GET /api/prayer/mass-readings?date=2026-11-26` serves it (equivalently the `readings_cache` row for that date), embedded verbatim. Never hand-built, never trimmed: the capture settles which feed item the parser date-matches (§1.4) and the legs assert against the captured parts' own headings/citations. Likewise the **real 2026-11-25 payload** (the feed's Nov 25 item: Reading 1 Revelation 15:1-4 · Responsorial Psalm Psalm 98:1, 2-3ab, 7-8, 9 · Gospel per the item) for the own-date leg.
- **The readings episode in its three real dresses**, shaped exactly as §1.5's constructions build them: (a) the fold-seat descriptor (`readingsSeatDesc549`'s literal shape — `episodeId` = a feed GUID key, `readingsSeat:true`, `podSeries:'daily-readings'`, `source:''`, `descText:null`, title "Daily Mass Reading Podcast for November 26, 2026"); (b) the daily descriptor (`resolveDailyDynamic666`'s literal shape — `daily666:true`, `dailySeries:'daily-readings'`, `source:'USCCB Daily Readings Podcast'`, a provider `descText` standing, which must NOT paint); (c) the ext descriptor (`extSlotTrack`'s literal shape — `episodeId:'ext-usccb-readings'`, `kind:'external'`, `hasText:false`, `textUrl:null`, a provider `descText` standing, which must NOT paint).
- **Negative fixtures:** an office slot descriptor (harness-v676's `officeFx('ext-morning-prayer', 'Morning Prayer', 'Sing the Hours')` verbatim); a Bible in a Year daily descriptor (`podSeries`/`dailySeries:'bible-in-a-year'`); an exegesis daily descriptor; an own podcast episode with `hasText`/`textUrl` (harness-v676's `OWN` verbatim).

**Legs:**
- **F** — fixture-shape checks: the three dresses match §1.5's field sets (incl. shape (a) carrying no `kind`-independent identity gap: `slotId` absent, `source:''`); the captured payloads are `found:true` with a Gospel part and a non-empty `copyright[]`.
- **P1 (the screenshot case, first)** — player, shape (a) as `state.current` (queue `[fx]`, `readTracks {}` — the real composed shape): `#np-read` stands (visibility cleared, no `aria-hidden`); click → the Read sheet paints the card: the Nov 26 day name/date line, every captured part's citation, a Gospel body word-string from the captured payload, and the `copyright[]` acknowledgment line at the foot; **no iframe** stands; the fetch log shows exactly one `mass-readings` fetch, with `date=2026-11-26`.
- **P2 / P3** — player, shapes (b) and (c): `#np-read` stands; click paints the same Nov 26 card; shape (b)/(c)'s `descText` string appears nowhere in the sheet.
- **T1 / T2** — track page (`trackPagePaintDay643` through the real landing paint), shapes (a) and (c): the head stands above `#track-text-643`; the card body paints into `#track-text-643` with the Nov 26 citations; `descText` does not paint; no iframe.
- **D1 (own-date rule)** — player, shape (b) retitled "Daily Mass Reading Podcast for November 25, 2026" (the stale/settled dress): the fetch asks `date=2026-11-25`; the card paints the Nov 25 payload's citations (Revelation 15:1-4 stands) and **no Nov 26 citation** (Luke 17:11-19 / Sirach 50:22-24, per the captured Nov 26 set) appears.
- **N1 (missing text)** — the route stub answers `{found:false, parts:[], copyright:[]}` for the asked date: the body paints "Readings not available for this day." alone — no citation, no acknowledgment, no other date's text, no skeleton bars remaining.
- **C1 (office untouched)** — the office fixture in the player: `#np-read` stands via the office arm; click paints the **widget** (iframe src exactly `https://divineoffice.org/widget`); no `mass-readings` fetch is issued.
- **C2 (podcast negatives)** — BIAY and exegesis fixtures in the player: `#np-read` stays hidden (visibility hidden + `aria-hidden`); a click attempt opens no Read sheet and issues no `mass-readings` fetch.
- **C3 (standing text path untouched)** — the `OWN` fixture with its `readTracks` entry: `#np-read` stands via the standing text test; click paints the plain fetched text; no card, no `mass-readings` fetch.
- **Fail-on-old:** on the base tree (7089be0) P1–P3, T1–T2, D1 fail (no Read stands for the episode; the track page paints `descText`/nothing); C1–C3 pass; N1 fails (no sheet opens at all).
- **Regression bar (measured §1.6):** harness-v677 **18/0** · harness-v690 **33/0** · harness-v676 **no new bad** (49 functional legs green; the pin `F` leg excepted until the pin bump, where it reads the v697 pin only if Review re-points it — not required) · harness-v675 stays at exactly its 3 named superseded/pin bad.

### §2.6 Risks

- **R1 — Thanksgiving-day parse ambiguity (§1.4):** the Nov 26 feed carries more than one item for the date (the Thanksgiving selection and the ferial set) and `parseUsccbFeed` matches by the `112626.cfm` link. The card inherits whatever the Mass serves — that is the requirement ("the same source that the mass uses"), not a defect — but the fixture capture must be the route's real answer, and Review must not assert citations from the feed's other item.
- **R2 — `massFeedPartHtml` reuse:** it is a Mass-scroll renderer that reads `state.mass.rchoices` (defensively) and emits option chips for multi-option parts; on the card those chips would be inert (no `wireMassChips` host). Prescription stands (reuse = one rendering), but Implement must confirm no chip renders for the captured Nov 26 parts; if a part carries options, the card paints option [0] through the same call — the chips' buttons, if emitted, are inside `#mass-readings`-less DOM and must be checked for stray wiring. If that check fails, fall back to painting heading + citation + `massFeedLinesHtml(opt.html, …)` directly (the renderer's own internals) and name the deviation in §3.
- **R3 — Shape (c) title risk:** if a day's ext resolution title ever lacks the "Month D, YYYY" form, §2.4 falls back to the presented date — correct for a presented-day resolution, and the D1 leg covers the title path; the fallback is bounded to that case by construction.
- **R4 — Track-page repaints:** `trackPagePaintDay643` re-presents on the standing [400, 1200, 2500] ms guards (`openTrackPage643`); the card's async fetch must paint into the *current* `#track-text-643` at settle time (read the element at settle, as the standing `textUrl` afterPaint does, client.ts:17847–17853) — never a captured node.
- **R5 — Pin:** the build bumps the standing pin to `ora-pro-nobis-v697-1`; harness-v676/v675 `F` pin legs read old pins and stay bad for that leg alone — named in §1.6 so Review does not chase them.

### §2.7 Ordered Implement seat list

1. **Predicate + builders** (client.ts, beside `lohOffice676` at 17661 and the v675 builders at ~17682): `usccbReadings697` (§2.1) · `episodeDate697` (§2.4) · `readingsCardHead697` + `readingsCardPaint697` + the fetch-and-paint driver (§2.3).
2. **`openRead` readings branch** (client.ts:18474, immediately after the office branch).
3. **Player seats** (client.ts:18601–18605 click arm; client.ts:18699–18700 visibility test).
4. **Track-page seat** (client.ts:17831–17853, beside the office675 test).
5. **Card dress** (ui.ts, only if a rule is needed beyond the reused `.lohhead675` / `.mass-*` / `.mass-ack` classes).
6. **Pin** bump to `ora-pro-nobis-v697-1` (the standing pin seat).
7. **Harness** `app/worker/harness-v697.mjs` per §2.5, with the two captured payloads embedded; run it + the four regression harnesses; write §3 with tallies and the R2 check's outcome.

### §2.8 Re-diff note — v692 lands before Implement

v692 (starter profiles + the today/standing edit toggle; at Ship phase on its own branch at Plan time, its ship will land on main after this Plan's base 7089be0) touches the profile/contents composition this release reads. **Before Implement writes a line, it re-diffs these v697 seats against the landed v692 tree and re-grounds any moved line numbers in §3:**

- **`resolveReadingsSeat590` (client.ts:21120) and the Morning-contents seat check** — v692's starter migration (mig609 shape: the readings seat stands in Morning contents) is the very selector this resolver reads; confirm the seat selector's shape is unchanged.
- **`resolveDailyDynamic666` (client.ts:20802) + the v677 settled store** — v692 turns the three Ways into starter templates and changes how profiles/contents are composed and reset (its server-reset repair rewrote the stored starter shape); confirm the daily descriptor's construction (§1.5b) is byte-identical and the settled-store keying stands.
- **`foldReadingsSeat` / `readingsSeatDesc549` (client.ts:14480–14530) and `extRebuildDescs`' contents pass** — profile composition order is v692's home ground; confirm the fold still seats shape (a) before `daily-rosary` and the descriptor's fields stand as §1.5(a) records.
- **The predicate's field assumptions (§2.1)** — re-verify against the landed tree that no v692 shape change renamed `podSeries` / `dailySeries` / `readingsSeat` or the `ext-usccb-readings` slot id; if any field moved, the predicate follows the landed field, named in §3.
- **Not at risk from v692:** the Mass readings route/store/payload (§1.4 — v692 touches no readings server code), `openRead`, the player seats, and `trackPagePaintDay643` — still re-diffed by line number, expected to stand.

## §3 Implement record (chain-v697-impl)

### §3.1 Rebase

- Rebased `release/v697` onto `origin/main` **5dd67ca** (v696 Ship record) — clean, no conflicts. Plan commits 0531ecc/1467ffb replayed as 27ab388/ea0dd6b. Base moved 7089be0 → 5dd67ca; v692, v694, v695, v696 all landed in between, as §2.8 anticipated (plus v694/v695/v696, re-diffed per the Implement brief's extension).

### §3.2 Re-diff outcome (every Plan-named seat, rebased tree)

All line numbers below are the rebased tree (`app/worker/src/client.ts` unless named).

- **`lohOffice675` / slots / `lohOffice676`** — Plan 17648/17649/17661 → **17779/17780/17792**. Byte-identical predicates; the eight-slot set unchanged.
- **`lohWidgetHead675` / `lohWidgetBody675` / `lohWidgetWire675`** — Plan ~17682 → **17808/17824/17843**. Unchanged.
- **`trackPagePaintDay643`** — Plan 17831 (office test 17832) → **17962** (office test 17963). Unchanged shape; its standing `textUrl` afterPaint reads `#track-text-643` at settle time (the R4 pattern the readings afterPaint follows).
- **`openRead`** — Plan 18444, office branch 18474–18482 → **18594**, office branch **18626–18632**, byte-untouched by this build. **v696 shift, named:** the sheet's sub-line is now conditional (`sub696`, client.ts:18608) — the `<p class="sub">` element stands only where `t.descText` stands or the track is an office track. A readings descriptor with no `descText` (shape (a)) therefore has **no `.sub` element** for the readings branch to fill: the branch creates the element (inserted after the sheet's `<h1>`) when it is absent, then paints `readingsCardHead697` into it. Shapes (b)/(c) carry `descText`, so their element stands and is replaced, exactly as the office branch replaces it.
- **Player seats** — `#np-read` click handler Plan 18601–18605 → **18750–18758**; `updateNowPlaying` visibility test Plan 18699–18700 → **18852**. Both shapes unchanged (office arm first, standing text test below).
- **`resolveReadingsSeat590`** — Plan 21120 → **21354**. Selector unchanged: the seat stands only where the effective Morning contents carry `{kind:'seat', key:'daily-readings'}` (the v609 rule v692's starter migration preserves). No v692 shape change.
- **`readingsSeatDesc549` / `foldReadingsSeat`** — Plan 14480/14494 → **14611/14625**. Descriptor fields byte-identical to §1.5(a) (`readingsSeat:true`, `podSeries:'daily-readings'`, `source:''`, `descText:null`, no `slotId`); the fold still splices immediately before the Morning `daily-rosary` descriptor; the v691 moved-block seat (descriptor spliced directly by `extRebuildDescs`' contents pass, not through `trackDesc`) stands.
- **`resolveDailyDynamic666` + the v677 settled store** — Plan 20802 → **20984**; settled store `opnDailySettled677`/`opnDailySettlePut677` at **5265/5280**. The §1.5(b) descriptor construction is byte-identical (`podSeries`/`dailySeries` = series, `daily666:true`, `source` = series title, `descText` rides). **v694 shift, named:** `opnDailyMatch666` (20878) lost every stale-fallback arm — a presented-day hit or null; a null match stands the `opnDailyPlaceholder694` descriptor (20970: sentinel `episodeId:'seg:unavailable-v694-'+series`, `dailySeries` set, **`podSeries` set only on the non-video arm via `d.podSeries = series`** — for `daily-readings` the placeholder therefore satisfies `usccbReadings697` by `dailySeries`+`podSeries`; it is `available:false` with no URL, so it can never be `state.current` in the player, and on the track page it never stands — the track page is reached only for available tracks. No predicate change follows). Pre-v694 `stale:true` settled records are treated as no record (20984's resolver filters them). §1.5(b)'s "stale settled descriptor" dress is therefore a legacy shape only; the D1 own-date leg (§3.5) constructs it directly, as §2.5 prescribes. The settled-store keying ((presented, block:series)) stands.
- **`extRebuildDescs` contents pass** — Plan-era seat → **21467**. The daily branch re-stamps `daily666`/`dailySeries` onto the `trackDesc` output (the seam copies `podSeries` for `kind:'podcast'` but not the daily marks) — so a composed daily descriptor carries all three predicate fields. The readings seat descriptor is spliced raw (never through `trackDesc`), so `readingsSeat` stands on the composed descriptor.
- **`trackDesc` seam (v696 shift, named)** — **16442**. v696 added `hasText`/`textUrl` copying (its §2.5 seat 2). The seam still does **not** copy `readingsSeat`, `dailySeries`, or `slotId`, and copies `podSeries` only for `kind:'podcast'`. Consequences, all safe for §2.1: shape (a) never passes the seam on its seat path (raw splice, above); shape (b) passes it as `kind:'podcast'` (podSeries survives) and gets `dailySeries` re-stamped by the contents pass; shape (c) passes it as an ext descriptor — `episodeId:'ext-usccb-readings'` survives the seam (it is the seam's first field), so the predicate's episodeId arm fires. `queueLiveDesc` (5943) rebuilds a playing ext track through this seam — the readings identity survives there too.
- **`extSlotTrack`** — Plan 19047 → **19199**, byte-identical to §1.5(c). **v695 shift, named:** v695's natural-title view (`view695`, client.ts:5954) applies only to labeled slots (`opnLabeledSlot650` — the Divine Office / Sing the Hours pair) in `queueLiveDesc`; `ext-usccb-readings` is not a labeled slot, so its title is untouched.
- **Predicate field assumptions (§2.1)** — re-verified on the landed tree: no field renamed. `podSeries`, `dailySeries`, `readingsSeat`, and the `ext-usccb-readings` slot id all stand as §1.5 records. The predicate is built exactly as §2.1 prescribes, with no field substitution.
- **Mass seats** — `massFeedLinesHtml` 8198 · `MASS_SLOT_LABELS` 8214 · `massFeedPartHtml` 8265 (signature `(part, label, idx, setKey)`; the ferial arm in `massReadingsHtml` at 8443–8457 passes no `setKey`, as §2.3 prescribes for the card) · `massAcksHtml` 8544 (its feed-copyright arm at 8552–8556 paints each `massFeed.copyright[]` line as `.mass-ack` — the card's foot replicates exactly those lines from the payload, never the Universalis lines, which stand only under `massUsedFallback`). `homilyLongDate` 15053 · `opnDailyTitleDate666` 20865 · `presentedDateStr` 5294 · `api` 4517. All unchanged in shape.
- **Pin seat** — `ui.ts:1214`: `var CACHE = "ora-pro-nobis-v696-1"` → bumped to `ora-pro-nobis-v697-1` in this build (§3.3).

### §3.3 Fixture capture (Improvement D) — and the Nov 26 production finding

- Captured from app D1 `readings_cache` (database `3a177d55-7baa-424c-9c4d-0d60cd9fe332`) on 2026-11-26, via the Cloudflare connector's D1 query route — the store-first body the route `GET /api/prayer/mass-readings?date=` serves verbatim. Both payloads are embedded **verbatim** in `harness-v697.mjs`.
- **2026-11-25 payload:** `found:true`, title "Wednesday of the Thirty-fourth Week in Ordinary Time", 4 parts (r1 **Revelation 15:1-4** · ps Psalm 98:1, 2-3ab, 7-8, 9 · ga Revelation 2:10c · g **Luke 21:12-19**), one `copyright[]` line, one memorial (Saint Catherine of Alexandria — its set does NOT paint on the card, §2.3). No part carries `options` (see R2, §3.4).
- **2026-11-26 payload — PRODUCTION FINDING, named:** `found:true`, title "Thursday of the Thirty-fourth Week in Ordinary Time-Thanksgiving", **`parts: []`**, one `copyright[]` line. This is not a capture error: a fresh live pull through the standing parser (`parseUsccbFeed` on the current USCCB feed, run locally from the rebased source) returns the identical payload. Cause, grounded in the feed itself: the feed carries three Nov 26 items — `112626-Thanksgiving` (the Thanksgiving selection: Sirach 50:22-24 … Luke 17:11-19), `112626-Ordinary` (the ferial set: Revelation 18:1-2…), and `112626.cfm` (a link-list item carrying only the two links and the copyright tail). The parser's link test (`…/112626.cfm`, mass-readings.ts:141–148) matches **only the link-list item**, whose description carries no headed parts — so the route's own payload for Nov 26 has no parts. (The Mass scroll masks this in production via its Universalis backup fill, §1.4's adjunct, which the card by prescription does not take.)
- **Consequence for the harness (DEVIATION from §2.5's P1/F wording, named):** §2.5 assumed the captured Nov 26 payload would carry parts (its F leg: "the captured payloads are `found:true` with a Gospel part"; its P1: the card paints Nov 26 citations + a Gospel word-string). The captured production payload carries none, and a hand-built substitute is exactly what Improvement D and the brief forbid. The harness therefore: (1) embeds both captured payloads verbatim; (2) asserts the Nov 26 legs (P1–P3, T1–T2) against the captured payload's own truth — the fetch asks `date=2026-11-26` exactly once, no iframe stands, `descText` never paints, and the body paints the §2.3 not-available line **alone** (the correct paint for a no-parts payload: no parts, no acknowledgment, no other day's text); (3) carries the full citation/Gospel-word/acknowledgment paint proof on the captured **Nov 25** payload, whose dress stands in the player and on the track page as the day's own card (legs P4/T3, plus D1's own-date form). No citation is ever asserted from the feed's other Nov 26 items (R1 honored: Sirach 50:22-24 and Luke 17:11-19 appear nowhere in the harness's expectations). **This finding is a server-side defect in its own right (the parser's Thanksgiving-day match) — it is NOT fixed here (v697 is client-only, no server change per §2) and is flagged for the coordinator/John as a follow-up matter.**

### §3.4 Build summary (client.ts + ui.ts only; no server change)

1. **Predicate + builders** (client.ts:17887–17982, beside `lohOffice676` / the v675 builders): `usccbReadings697` exactly as §2.1 (identity fields only) · `episodeDate697` (§2.4: `opnDailyTitleDate666` full-date primary, `presentedDateStr()` fallback only) · `readingsCardHead697` (`.lohhead675` dress: "Daily Readings" · day name — the payload's `title` named in by the driver when it lands, the descriptor's own long date until then · the date line via `homilyLongDate`) · `readingsCardPaint697(root, payload)` (parts in payload order through `massFeedPartHtml(part, MASS_SLOT_LABELS[part.key], i)` with **no setKey** — the ferial arm; foot = `payload.copyright[]` lines as `.mass-ack` exactly as `massAcksHtml` paints them; memorial sets do not paint; `found:false` / no parts / null payload → "Readings not available for this day." alone) · `readingsCardDrive697` (fetch `api('/api/prayer/mass-readings?date=' + episodeDate697(t))`; the root resolver is invoked **at settle time** — R4 honored, no captured node; a rejected fetch takes the not-available path).
2. **`openRead` readings branch** (client.ts:18763) immediately **after** the office branch (18626–18632, byte-untouched): `.sub` carries the card head (the branch stands the `.sub` element itself where v696's rule left none — §3.2), the body fills via the driver; no `textUrl` fetch runs.
3. **Player seats**: `#np-read` click arm (client.ts:18904) after the office arm — `state.current` first when it satisfies `usccbReadings697`, else the readTracks descriptor; `updateNowPlaying` visibility (client.ts:19004) gains `|| usccbReadings697(cur) || usccbReadings697(rt)`. Held-slot discipline unchanged.
4. **Track-page seat** (`trackPagePaintDay643`, client.ts:18073): beside the office675 test — `readings697` → `textHtml=''` (descText never paints), `headHtml = readingsCardHead697(d, L.date)`, `afterPaint` drives the card body into `#track-text-643` (read at settle time).
5. **Card dress**: no ui.ts rule added — the card rides the reused `.lohhead675` / `.mass-*` / `.mass-ack` classes only (the new class names `readingshead697` / `readings-day697` / `readings-none697` are hooks, unstyled).
6. **Pin**: `ui.ts:1214` — `ora-pro-nobis-v696-1` → **`ora-pro-nobis-v697-1`** (verified in the built tree: harness-v697's F leg reads the served `/sw.js` and passes; grep of the built source confirms the pin).
7. **Disjointness**: the office branch stands first at every seat; the v676 path is byte-identical (harness-v676 functional legs all green, §3.5).

### §3.5 R2 outcome

- **No option chip renders for the captured parts — the prescribed `massFeedPartHtml` call stands, no fallback rendering was needed.** Grounded three ways: (1) neither captured payload's parts carry an `options` field at all (Nov 26: no parts; Nov 25: all 4 parts option-free — asserted by harness-v697's F leg); (2) `massFeedPartHtml` emits chips only where `part.options.length > 1`; (3) harness-v697 P4 asserts `chipCount === 0` in the painted card. No deviation on R2.

### §3.6 Harness tallies

- **harness-v697 (new tree): 74 ok, 0 bad.** Legs: F (7) · P1 fold-seat player (screenshot case) · P2 daily · P3 ext · P4 daily Nov 25 full card (every captured citation, the Gospel word-string "They will seize and persecute you", the `.mass-ack` copyright foot, no chips, memorial set absent) · D1 own-date (Nov 25 fetch only; no Nov 26 citation from either feed item) · N1 found:false → the not-available line alone · T1 fold / T2 ext / T3 daily-Nov-25 track page (body into `#track-text-643` at settle, descText absent, no iframe) · C1 office widget untouched with zero mass-readings fetches · C2 BIAY + exegesis hidden, no sheet, no fetch · C3 OWN plain-text path untouched. (First run read 70/4: the 4 bad were a harness artifact — T3's standing track-page re-present timers re-painted during the C legs and landed a stray fetch in their logs; fixed in the harness by expiring the timers before the C legs, no client change. Re-run: 74/0.)
- **Fail-on-old** (`ORA_WT` = the pre-build tree, rebased base 5dd67ca): **35 ok, 39 bad** — every P1–P4, T1–T3, D1, and N1 leg group fails there (no Read stands for the episode; the track page paints `descText`/nothing), C1–C3 pass whole, and the F pin leg fails (the old tree serves `ora-pro-nobis-v696-1`). As §2.5 expects (its P/T/D/N fail · C pass pattern, extended by the P4/T3 Nov-25 proof legs and the pin leg).
- **Regressions on the rebased+built tree — no new bad anywhere:**
  - harness-v677: **18 ok, 0 bad** ✓ (bar 18/0)
  - harness-v690: **33 ok, 0 bad** ✓ (bar 33/0)
  - harness-v676: **49 ok, 1 bad** — the 1 bad is only the `F` pin leg (it expects `ora-pro-nobis-v676-1`; the tree now serves the v697 pin, per R5). All 49 functional legs pass ✓ (bar: no new bad)
  - harness-v675: **44 ok, 3 bad** — exactly the 3 named in §1.6: the `F` pin leg, and `R2` + `P1`, the plain-text opt-out legs v676 retired by design. No new bad ✓

### §3.7 Deviations named (complete list)

1. **Nov 26 harness legs assert the not-available paint, not citations** — forced by the captured production payload (parts: []), §3.3. The full citation paint proof runs on the captured Nov 25 payload (P4/T3/D1). The underlying parser defect (the `112626.cfm` link test matching the feed's link-list item on Thanksgiving Day) is a **server-side follow-up matter for the coordinator/John** — out of this release's client-only scope, not fixed here. Note the field consequence Review should weigh: on 2026-11-26 itself, the shipping card will paint "Readings not available for this day." for the Nov 26 episode, because that is what the Mass's payload carries; every other day in the store's window with a normal payload paints its full card.
2. **`openRead`'s readings branch creates the `.sub` element where absent** — forced by v696's conditional sub (§3.2); the office branch never faced this because v696 keeps the element for office tracks.
3. **§1.5(b)'s stale-dress description is legacy after v694** (§3.2): v694 deleted the daily fallback arms; the predicate and descriptor fields are unchanged, and D1 constructs the Nov 25 dress directly per §2.5.

Implement stops here: no merge, no deploy, no board records touched.
