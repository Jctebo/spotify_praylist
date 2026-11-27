# v699 — Stations as an addable episode · the "Mass and Homilies" closing section removed: every row an addable item

- **Status:** REVIEW PASS (§4) — holder: chain-v699-review
- **Base:** `a26830f` (worktree head at Plan; branch `release/v699` off the one standing clone)
- **Scope of this phase:** Plan only. No app code in Plan.

## §1 Scope

### 1.1 Direction (John, verbatim)

> "I should see the prayer in the feed as an episode and it should be available to add." (John, 2026-11-27 07:46 CT)

> "Remove the Mass and Homilies section — make them all addable items." (John, 2026-11-27 07:47 CT — the widening; row 1677 retitled "Mass and Homilies section removed: every row an addable item (Stations · Daily TV Mass · Fr. Mike · Bp. Barron)", intake 1331)

**The widening is named:** this Plan was first tasked narrow (the Stations only). John's 07:47 word widens the release to the WHOLE closing section — all four of its rows become addable items and the section itself is deleted. §§1–2 below are written to the widened scope throughout; no narrow-scope draft stands.

### 1.2 The field report

- The Stations of the Cross today stand ONLY as a settings row (app D1 `player_source_settings`: `source_key 'stations-of-the-cross'`, name "Stations of the Cross / Lenten Devotion", family `'unplaced'`, block `''`, day_rule `'fridays'`, enabled 0, slot_id NULL — read back from D1 at Plan, §1.3), reachable only via the Edit form's closing "Mass and Homilies" section (v686).
- John switched it on (his device state) and still got no standing row and could not find the prayer in any feed.
- The closing section's other three rows (Daily TV Mass · Fr. Mike Sunday Homily · Bp. Barron Sunday Sermon) stand in the same posture: a switch + day pick in the Edit form, and — §1.4 proves — no composed seat in any day's Praylist build for any of them.

### 1.3 Grounding — the Stations content seat: NO playable episode stands behind the settings row (proven negative)

Every store the app serves was queried/read at Plan (app D1 `3a177d55-7baa-424c-9c4d-0d60cd9fe332`, live reads 2026-11-27):

| Store | Evidence | Stations record |
|---|---|---|
| `player_source_settings` (26 rows; `player_settings_meta` version **9**) | The settings row itself: family `unplaced` · block `''` · day_rule `fridays` · sort_order NULL · enabled **0** · slot_id **NULL** · role `primary` (seed identical: migration 0010 line 51; client seed `OPN_SEED_SOURCES`, client.ts:2775) | The row is ALL that stands |
| `player_episodes` (grouped by episode_id) | 30 episode families: the six own families, novenas, `the-ai-signal`, ext office slots | **None** — no `stations-of-the-cross` episode, ever produced |
| `player_sources` | 6 rows only — the per-block Spotify playlist rows (Morning…Night) | **None** |
| Own feed (Ora Pro Nobis podcast feed) | `rss_snapshots` row `ora-pro-nobis` (269,735 bytes, built 2026-11-27T12:00Z): `instr(payload,'stations') = 0`, `instr(payload,'Stations') = 0`; the runner's `EPISODE_ORDER` (runner/pass1_collect.py) is closed at the six own families + novenas | **None** — the feed carries no Stations episode |
| `prayer_book` (77 slugs) + `PRAYER_AUDIO` (index.ts:1953) | Full slug list read: no `stations-of-the-cross` slug, no audio-map entry | **None** — the prayer kind cannot resolve it today (§1.5) |
| `ext_resolutions` (11 slot_ids) | Office slots + `ext-gospel-exegesis` + `ext-saint-of-the-day` + `ext-daily-tv-mass` | **None** — no slot; the seed row's slot_id NULL is literal: no resolver leg exists for it |
| `rss_snapshots` series / `podcast_sequences` | Series: the 8 RSS series + novenas catalog; sequences: 4 course series | **None** — no Stations series |
| Legacy Spotify contracts (outside the app) | `config/spotify/contracts/friday-stations-of-the-cross.json` + `lenten-devotion.json`: one Spotify episode, `spotify:episode:4rZ8YJKq1iuqiypu3Q5TRm`, weekdays [Friday] | The ONLY playable Stations recording named anywhere in the estate — the retired Spotify praylist system's record; the app neither reads nor serves it |

**What slot_id NULL + family `unplaced` + block `''` mean, in code:** every standing filter that could stand a source row in a day requires more than this row has — the own-feed standings require `family === 'own' && OWN_ROW_EPISODE[sourceKey] && enabled && block` (client.ts:10032, client.ts:23606; `OWN_ROW_EPISODE`, client.ts:19140, has no Stations entry), and the external legs resolve through `EXT_SLOTS` (client.ts:19094), which has no Stations entry (the four Mass-and-Homilies slots were retired from it at v499, comment client.ts:19106). **The row is a settings record with no content behind it: produced by seed (migration 0010 / `OPN_SEED_SOURCES`), resolved by nothing.**

**What John's flipped switch did — nothing, on two independent grounds:**
1. **No persisted flip stands.** The toggle's write path is `opnToggleSource686` → `opnSaveSourceSettings686` (client.ts, §2.5 of v686): a whole-table PUT of all 26 rows + read-back. The server store read at Plan still carries enabled **0** — so no whole-table write carrying his flip stands on the server (his flip lives, at most, in his device's local copy of the settings; in device mode the settings ride the on-device document, seeded as `sourceSettings: { version: 1, sources: opnClone(OPN_SEED_SOURCES) }`, client.ts:1636).
2. **A persisted 1 would still stand nothing.** With family `unplaced`, block `''`, slot_id NULL and no `OWN_ROW_EPISODE` entry, every standings filter above fails on an enabled row exactly as on a disabled one. The switch was a control for a seat that does not exist.

### 1.4 Grounding — per-row: content seat · add seat today · what the settings row actually does

**Row 1 — Stations of the Cross** (`stations-of-the-cross` · unplaced · `''` · fridays · enabled 0 · slot NULL)
- Content seat: **none** (§1.3). Add seat today: **none** — it stands in no Add branch, no series node, no book group, no search group.
- The settings row does: nothing. It is painted only by the closing section and read by no resolver.

**Row 2 — Daily TV Mass** (`daily-tv-mass` · external · block `Mass and Homilies` · daily · enabled 1 · slot `ext-daily-tv-mass`; live D1 sort_order 1)
- Content seat: **real and live, but not through the slot system.** The slot retired at v499 (`EXT_SLOTS` names it no more), yet the server courier still resolves it: `ext_resolutions` carries `ext-daily-tv-mass` rows, 6 standing, latest date 2026-11-28, state `present`, with stream URLs (Buzzsprout) — resolved by the jobs externals resolver, read by the client through the externals/live payload (`opnMassAudioEntry688`, client.ts:21363).
- Add seat today: **its addable shape ALREADY stands (v688).** The dynamic Mass kind `massdaily` (`OPN_MASS_SERIES_688`, client.ts:2864 — `'daily-tv-mass'` is its AUDIO key): Add › Videos › Virtual Mass › "Daily TV Mass · Audio" door (`vmass-audio:daily-tv-mass` → `massAudioNode688`, client.ts:27342) paints the gold dynamic card (`massRow688`); the video doors (`vmass:*` → `videoNode656`) paint the sibling video keys' cards at their heads; the head search carries the same four cards under "Videos › Virtual Mass". An Add produces `{kind:'massdaily', key:'daily-tv-mass'}`, resolved per presented day by `resolveMassDynamic688` (client.ts:21378), which reads the profile contents + the externals payload — **and never reads the source-settings row.**
- The settings row does: nothing for the item. Its enabled/block values gate no leg of the v688 shape. The closing row is a second, divergent control for a source whose one real control is the contents item (add · remove · v690 Frequency).

**Row 3 — Fr. Mike Sunday Homily** (`fr-mike-homily` · external · block `Mass and Homilies` · sundays · enabled 1 · slot `ext-fr-mike-homily`; live D1 sort_order 2)
**Row 4 — Bp. Barron Sunday Sermon** (`barron-sermon` · external · block `Mass and Homilies` · sundays · enabled 1 · slot `ext-barron-sermon`; live D1 sort_order 3)
- Content seat: **the series pass-through, live.** Both are RSS series defs (`POD_RSS_SERIES_LIST`, index.ts:4282–4283: `fr-mike-homilies` "Sunday Homilies with Fr. Mike Schmitz" · `barron-sunday-sermons` "Bishop Barron's Sunday Sermons"), snapshotted into `rss_snapshots` (35,357 / 21,961 bytes, both built 2026-11-27T12:00Z) and served by the podcasts route. Their SLOT records stand nowhere: `EXT_SLOTS` retired both slots at v499 and `ext_resolutions` carries no row for either slot_id — the v658 Sundays cadence lives only in the settings store (settings version 9) and in the retired Spotify-playlist jobs (`SUNDAY_FRMIKE` / `SUNDAY_BARRON` resolvers in jobs/externals_resolver.py), not in the app's day build.
- Add seat today: **pinned episodes only.** Add › Catechesis › Homilies (`lf:homilies`, client.ts:27677) doors to `series:fr-mike-homilies` / `series:barron-sunday-sermons` → `seriesNode614`, which lists every snapshot entry as a pinned episode row `{kind:'episode', key:'<series>|<entryKey>'}` (resolved by `resolveProfileEpisodes614`). What does NOT stand: a standing/dynamic item for the source itself — `seriesNode614` calls `dailyRow614(series)` at its head, and `dailyRow614` returns `''` for any series outside `OPN_DAILY_SERIES_666` (client.ts:2855: the five daily series; the homily series are not among them). A person can pin last Sunday's episode; they cannot add "the Sunday homily" as a standing item, and the Sundays cadence exists only on the inert settings row.
- The settings rows do: nothing in the app. No resolver, fold, or paint reads them.

**Boundary — the USCCB readings row is NOT in this release.** `usccb-daily-readings` carries block `Mass and Homilies` in the seed but stands in the Edit form in **Morning** (the v686 fold), gated by the `seat:daily-readings` contents item — it is not one of the closing section's four rows (the closing keys are exactly `['daily-tv-mass','fr-mike-homily','barron-sermon','stations-of-the-cross']`, client.ts:25019) and row 1677 does not name it. It stands untouched.

### 1.5 The feed seat the Stations join (decided)

- **Seat:** Add › **Prayers › Prayer Book** — the book's category rung (`lf:prayerbook` → `prayers:<category>`), where every book prayer stands as a row `{kind:'prayer', key:<slug>}` through the standing `rowHtml`. The book payload (`bookPayload`, index.ts:2033, from `prayer_book`) is the feed of prayers the app serves; the head search already carries this branch ("Prayers › Prayer Book").
- **Item shape:** `{kind:'prayer', key:'stations-of-the-cross', dayRule:'fridays'}` — the exact shape v690's own Plan named for this prayer ("a Stations prayer item is a `prayer` contents item", v690 §1.3) and v690's harness exercised. **No new kind.** The `dayRule:'fridays'` is stamped at Add (§2.2) — the settings row's Fridays cadence folding into the item, thereafter owned by the standing v690 Frequency act (`opnSetItemDay690` / `opnItemPaints690`).
- **Play path (all standing machinery, no new leg):** the server day payload synthesizes a fold entry for the contents prayer (`dayAdditionsFold`, index.ts:1163 area — v690 G3(b) already dayRule-gates this synthesis), resolved against `prayer_book` (title) + `PRAYER_AUDIO` (duration); the client places the descriptor at its contents position and plays it from the book audio route (`/api/player/book/audio/<slug>/en`, index.ts:5270 area, serving R2 `prayer-audio/<slug>.en.mp3`). A slug missing from either the book or the audio map **drops from the fold silently** (index.ts:1224–1230) — which is exactly today's failure mode, and why §2.1 creates BOTH records.
- **What must be created (the catalog record — it does not exist, §1.3):** (a) a `prayer_book` row: slug `stations-of-the-cross`, title "Stations of the Cross", a standing category (recommendation: `The Raccolta` — the book's devotion collection; final category is Implement's read of the book's group order), body = the traditional Stations text (St. Alphonsus Liguori's Way of the Cross, public domain — an authoring input at Implement, not invented in this Plan); (b) a `PRAYER_AUDIO` entry `"stations-of-the-cross": { en: <duration> }` with the duration **measured from the produced audio file**; (c) the audio object itself at R2 `prayer-audio/stations-of-the-cross.en.mp3`, produced by the standing prayer-audio production (the v484 pilot's pre-rendered-audio posture). **Named unproven:** no prayer-audio render script stands in this tree (searched `app/` + `runner/` + `scripts/`) — Implement seat 1 (§2.6) verifies the production route before any code seat; if none stands, that seat stops and reports rather than faking a duration or an object.

### 1.6 The homilies' standing shape (decided) — with the deviation called out

- **DEVIATION, named boldly:** v666 closed `OPN_DAILY_SERIES_666` and v688 honored the closure by building `massdaily` as a SIBLING kind rather than widening `daily`. This Plan **widens the daily set by the two homily series** — John's original (per the widening): the homily sources become addable standing items like the other dynamic sources; the proposed different thing considered and NOT taken: a new sibling kind (a `weekly` kind would duplicate the resolver, the v677 settled store, the subtitle family, and both validators for two keys). The daily machinery is kind-generic everywhere except the matcher, and the matcher takes one new arm (§2.3). The widening is two keys in three literal seats (client set · client validator · server validator) plus the matcher arm.
- **Item shape:** `{kind:'daily', key:'fr-mike-homilies', dayRule:'sundays'}` · `{kind:'daily', key:'barron-sunday-sermons', dayRule:'sundays'}` — the settings rows' Sundays cadence folding in as the Add-stamped initial `dayRule`, thereafter owned by the v690 Frequency act.
- **Add seat:** the head of each series' own node — Add › Catechesis › Homilies › the series door (standing) → `seriesNode614`, whose head already calls `dailyRow614(series)`; once the keys stand in the set, the gold dynamic card ("… · Daily", sub "The day's episode, standing new every day") paints there with NO ladder change. The pinned episode rows below it stand unchanged.
- **Matcher arm (the trap named):** `opnDailyMatch666`'s generic tail returns `null` for any series without a named arm — widening the set WITHOUT the arm would validate and paint the card yet resolve nothing, silently. The arm for both homily series: **the newest entry whose Chicago publish date is on or before the presented date** (the v677 never-later discipline, as the saint arm applies it), `stale:false`; `null` when no such entry stands (the resolver then stands its standing not-available placeholder, per v694's no-fallback rule). Because the item gate (`opnItemPaints690`, in `resolveDailyDynamic666` before grouping) runs first, the matcher is only ever consulted on Sundays for a Sundays-stamped item.

### 1.7 The closing section — every seat that names it (grounded)

Paint + acts (client.ts):
- `opnMassHomiliesSectionHtml686` (client.ts:25017–25023) — the section builder: wrapper `<div class="p609group p686mass" data-p686mass="1">`, head "Mass and Homilies", the four keys in order, each painted by `opnSourceRowHtml686(r, {tag:…, closing:true})` (Stations tagged "Not placed", the other three "Daily source").
- Its only caller: `opnEditSetHtml609` (client.ts:28468) — `html += opnMassHomiliesSectionHtml686();` after the last block group, on every Edit-form paint, both scopes.
- The rows' acts are the shared source-row acts (NOT section-specific): switch/disable → `opnToggleSource686`, menu → `opnOpenSourceMenu687` (Frequency via `opnSetSourceDay686`), all writing through `opnSaveSourceSettings686`'s whole-table PUT. These acts survive for the block-seated source rows; only the closing rows' paint dies.

Seats that name "Mass and Homilies" but are NOT the section (decided per seat in §2.4 — deleting them would break the store):
- The source-settings validators' block exception — client.ts:4084 and index.ts:6539: block `'Mass and Homilies'` is accepted ONLY for `['usccb-daily-readings','daily-tv-mass','fr-mike-homily','barron-sermon']`. This validates the STORE rows' block value, not the Edit section.
- `OPN686_SECTIONS` (client.ts:24849) — the whole-table write ORDER (the deleted Settings editor's section order); `opn686SectionOf` reads row block/enabled against it.
- `OPN686_SLOT_ROW` (client.ts:24829) — maps `ext-daily-tv-mass`/`ext-fr-mike-homily`/`ext-barron-sermon` to their rows for the splice's conversion test; the closing rows are never in a painted block's row set, so those entries are already unreachable.
- Name seats, not paint seats: `BLOCK_TONES` / `BLOCK_GLYPHS` (client.ts:16851/16859) and the Add ladder's door marks (`doorMark666` maps the Homilies + Videos doors to the 'Mass and Homilies' mark) — the mark namespace survives the section.
- Server: `EXT_SLOT_BLOCKS` (index.ts:903–907) names the four slots' retired block — a payload/record naming, not a paint.

**Settings-side surfaces:** the Settings source editor was deleted whole at v686 (its harness L6 leg stands). Searched at Plan: the four rows paint ONLY via (a) the closing section and (b) — for rows with a block seat — the splice; none of the four has a block seat, so **the closing section is the only surface that paints any of the four rows.** No other surface (Settings · home · Podcasts) paints them.

### 1.8 Migration — the 26-row store keeps its shape; per-row fate

**No D1 migration. No store row is deleted, renamed, or re-valued by this release.** Ground: the source-settings PUT contract refuses anything but the exact stored set (unknown/duplicate/missing `sourceKey` = named 400, writes nothing — v686 §2.5), and every client act PUTs all 26 rows; deleting a row server-side would 400 every source-row write from every client until all clients updated, and deleting the validators' block exception would 400 the writes that carry the frozen rows' standing block values. The standing precedent is v686's C4 posture: rows that take no surface (the-ai-signal · the fallback rows) ride every whole-table write byte-identical, inert. The four closing rows join that posture:

| Row | Store fate | What folds where |
|---|---|---|
| `stations-of-the-cross` (enabled 0 · fridays · block `''`) | **Frozen inert.** Rides whole-table writes unchanged; no surface paints it; no resolver reads it (none ever did) | Its `fridays` folds into the Add-stamped `dayRule:'fridays'` on the new prayer item (§1.5). Its enabled 0 folds into nothing — there was no standing item to preserve |
| `daily-tv-mass` (enabled 1 · daily · block `Mass and Homilies`) | **Frozen inert** (same posture) | Nothing folds: the v688 `massdaily` items already in profiles stand exactly as they stand; the row's enabled/daily gated nothing (§1.4). The item is the one source of truth from this release on |
| `fr-mike-homily` (enabled 1 · sundays) | **Frozen inert** | Its `sundays` folds into the Add-stamped `dayRule:'sundays'` on the new daily item (§1.6). Pinned `episode` items already in profiles stand unchanged |
| `barron-sermon` (enabled 1 · sundays) | **Frozen inert** | As Fr. Mike |

**Devices carrying local closing-row state:** a device document whose local settings carry a flipped Stations row (enabled 1 — John's case) or any closing-row divergence keeps the row in its local copy; after this release no paint, resolver, or fold reads it, in either direction (harness leg S8, §2.5: a settings fixture with Stations enabled=1 and the homilies enabled=0 produces NO standing Stations or homily item, and does NOT gate an added item). No device migration runs; the rows simply stop mattering. The server store (version 9) is not written by this release's migration — there is none.

**End state — one source of truth per source:** Stations → the `prayer` contents item + the book catalog record · Daily TV Mass → the `massdaily` contents item · Fr. Mike / Bp. Barron → the `daily` contents item (standing form) or a pinned `episode` item (specific-episode form). No closing-section switch survives for anything.

## §2 Plan

### 2.1 Stations catalog production (Implement seat 1 — production, before code)

1. Verify the standing prayer-audio production route (the v484 pilot posture: pre-rendered mp3 per slug/language in the AUDIO bucket). If no route stands in the estate, STOP and report — do not invent a duration, a URL, or an object.
2. Author the `prayer_book` row: slug `stations-of-the-cross` · title `Stations of the Cross` · category per §1.5 recommendation · body = the traditional (St. Alphonsus) Stations text · source naming the text's origin, in the book's standing row shape (migration-0026 family; insert via the standing book write path or a D1 insert at Ship's data seat — Implement names the route it used in §3).
3. Render the English audio from that body through the verified route; upload to R2 `prayer-audio/stations-of-the-cross.en.mp3`; measure its duration (the produced file is the source of truth).
4. The produced record (slug · title · category · duration) is the harness fixture (§2.5) — drawn from production, per the standing fixture rule.

### 2.2 Code seats — client.ts

1. **Section deletion:** delete `opnMassHomiliesSectionHtml686` whole (client.ts:25017) and its caller line in `opnEditSetHtml609` (client.ts:28468). Nothing else in the Edit builders changes; `opnSourceRowHtml686`'s `closing` opt loses its only caller — remove the opt's closing-only branch if one stands distinct in the row builder, else leave the builder byte-identical and name it in §3 (Review greps: no `p686mass`, no `closing: true` caller survives).
2. **Daily-set widening:** `OPN_DAILY_SERIES_666` (client.ts:2855) gains `'fr-mike-homilies'` and `'barron-sunday-sermons'` (appended; the five standing keys' order untouched). The head comment at the set is updated to name v699 + the deviation (§1.6). `opnDailySeriesTitle666` needs no change (its ladder lookup carries both series' titles; §3 verifies the painted card labels read "Sunday Homilies with Fr. Mike Schmitz · Daily" / "Bishop Barron's Sunday Sermons · Daily" — if the ladder title differs, the T table gains the two titles in this seat instead).
3. **Matcher arm:** in `opnDailyMatch666`, before the generic `return null`, add the homily arm (§1.6): for the two series, the newest entry by `publishedMs` whose `ownChicagoDateStr(publishedMs)` is non-empty and `<= presented`; `{e, stale:false}` or `null`. No other arm moves; v694's no-fallback discipline stands (no stale arm is reintroduced).
4. **Client validator literal:** `opnCheckContents590`'s daily arm (client.ts:3182 area) gains the two keys in its literal set — the exact mirror of seat 2.
5. **Add stamps:** in the ladder's add handler (the `[data-p603additem]` click handler, client.ts:27731 — the same handler that stamps v670's `side`), stamp the initial `dayRule` from the settings rows' cadences: `prayer:stations-of-the-cross` → `itemA.dayRule = 'fridays'`; `daily:fr-mike-homilies` / `daily:barron-sunday-sermons` → `itemA.dayRule = 'sundays'`. No other add is stamped (every other item still starts rule-absent = daily, per v690 §1.2). The stamp is the migration (§1.8) made executable; the Frequency menu can change it thereafter like any item's.
6. **No other client seat:** not the ladder doors (the Homilies door and both series doors already stand), not `seriesNode614` (its `dailyRow614` head call is the seat, already wired), not `resolveDailyDynamic666` (its v690 gate + grouping already cover the new keys), not the splice, not `opn686*` write machinery.

### 2.3 Code seats — index.ts

1. **Server validator literal:** `validateProfileContents`' daily arm (index.ts:1515–1522) gains the two keys in its literal set — the exact mirror of §2.2 seat 4 (the literal-because-extracted discipline stands).
2. **`PRAYER_AUDIO` entry:** `"stations-of-the-cross": { en: <duration from §2.1 seat 3> }` (index.ts:1953 map). The duration is a production fact, not a chosen number; §3 records the measured value + the file it was measured from.
3. **No other server seat:** not the source-settings route or its validator (the block exception STAYS, §1.7/§1.8), not `dayAdditionsFold` (its prayer synthesis + v690 gate already carry the shape), not the book payload (it reads `prayer_book` whole — the new row stands in it by construction), not the podcasts route (both homily series defs already stand), not `EXT_SLOT_BLOCKS`.

### 2.4 Named no-change seats (Review verifies each)

- `OPN686_SECTIONS` + `opn686SectionOf` (write order — the frozen rows must keep sorting to their standing places in the whole-table PUT; harness S9).
- Both source-settings validators' `'Mass and Homilies'` block exceptions (client.ts:4084 · index.ts:6539).
- `OPN686_SLOT_ROW`'s three closing entries (unreachable, harmless; removing them is out of prescription).
- `BLOCK_TONES` / `BLOCK_GLYPHS` / `doorMark666` mark names; `EXT_SLOT_BLOCKS` (index.ts:903).
- The `usccb-daily-readings` row and its Morning seat, whole.
- All 26 store rows' values; `player_settings_meta` version (no settings write in this release).
- The v688 Mass seats (`OPN_MASS_SERIES_688`, `massRow688`, `massAudioNode688`, `resolveMassDynamic688`) — byte-identical; Daily TV Mass gains NO new code, only the loss of its duplicate control.

### 2.5 Harness spec — `app/worker/harness-v699.mjs` (for Implement)

**Fixtures from production shapes:** the Stations catalog record AS PRODUCED in §2.1 (slug · title · the measured duration, read from the shipped `PRAYER_AUDIO` entry + book payload shape) · the LIVE settings shape (harness-v658's `SETTINGS_LIVE` fixture family — the 26-row live store incl. the four closing rows at their live values: stations 0/fridays, daily-tv-mass 1/daily sort 1, fr-mike 1/sundays sort 2, barron 1/sundays sort 3, settings version 9) · homily series payloads in the `rss_snapshots` shape (entries with `key` · `title` · `url` · `publishedMs`, drawn from the live fr-mike-homilies snapshot's head entries) · presented days **Thu 2026-11-26 · Fri 2026-11-27 · Sun 2026-11-29** (the v690 fixture days; Fri 2026-11-27 is the field-report day).

- **S1 — the section paints NOWHERE.** The Edit form (both builders, both scopes) contains no `[data-p686mass]`, no "Mass and Homilies" group head, and no `[data-p686src]` row for any of the four closing keys; the surviving block source rows (e.g. `do-invitatory`) still paint.
- **S2 — the Stations catalog record stands.** The book payload carries slug `stations-of-the-cross` with title "Stations of the Cross" in a standing category; `PRAYER_AUDIO['stations-of-the-cross'].en` stands and equals the fixture duration; the fold resolution of a contents prayer item for the slug yields a fold entry (title + duration) — NOT the silent drop.
- **S3 — Stations Add.** At the Prayer Book category rung the Stations row stands; the Add produces, in the chosen block's stored contents (through both validators), exactly `{kind:'prayer', key:'stations-of-the-cross', dayRule:'fridays'}`.
- **S4 — Stations plays, Fridays only.** Friday's composed day carries the Stations descriptor at its contents position, its play URL the book audio route for the slug, and the block's queue build includes it; Thursday's and Sunday's composed days carry no Stations descriptor and no queue entry (the v690 G3(b) synthesis gate + G1 paint gate, exercised end-to-end for this slug).
- **S5 — Daily TV Mass: standing shape only, no second control.** `massAudioNode688` and the `vmass:` node still paint the gold `massdaily` card; an Add produces `{kind:'massdaily', key:'daily-tv-mass'}`; NO `[data-p686src]` row, toggle, or menu for `daily-tv-mass` stands anywhere in the Edit form (the S1 assertion read for this key, named separately because it is this row's one-source-of-truth leg).
- **S6 — Homilies standing Add.** `seriesNode614('fr-mike-homilies')` and `seriesNode614('barron-sunday-sermons')` each paint the gold daily card at the head (label per §2.2 seat 2); an Add produces `{kind:'daily', key:<series>, dayRule:'sundays'}` in stored contents; BOTH validators accept both new daily keys with the stamped rule (and still refuse a bogus daily key); the pinned episode rows still list below the card.
- **S7 — Homily resolution + Sundays cadence.** With the Sunday fixture (2026-11-29) and the snapshot-shaped payload, the added Fr. Mike item resolves the newest entry published on or before Sunday (never a future-dated entry — the fixture carries one, dated after Sunday, and it must NOT stand); the composed Sunday day carries the descriptor; Friday's composed day carries neither homily descriptor (item gate); the item's Frequency menu reads `Frequency — Sundays only` with Sundays `Current`, and setting Daily through `opnSetItemDay690` repaints it onto Friday (v690 machinery, regression-guard leg).
- **S8 — One source of truth (settings inert both ways).** With a settings fixture flipped AGAINST the items (Stations enabled=1 · homilies enabled=0 · daily-tv-mass enabled=0): no section paints (S1 holds), no Stations/homily/Mass item stands in any composed day from the settings alone, and an added Stations item still paints Friday, an added homily item still paints Sunday, an added massdaily item still resolves — the frozen rows gate nothing in either direction.
- **S9 — Whole-table write safety.** A surviving source-row act (Invitatory toggle) still PUTs all 26 rows with the four frozen rows byte-identical to the fixture (blocks `'Mass and Homilies'` / `''` as stored) and the server validator accepts the table — no 400, read-back stands.

**Regressions (standing tallies):**
- harness-v690 **33/0** · harness-v688 **65/0** — unmodified, no re-point (neither asserts the closing section; v690's Stations-shaped fixture is this release's S3/S4 shape at harness scale).
- harness-v658 **20/0** at its standing tally — unmodified: it reads the settings STORE values (seed + live flips), which this release does not change (§2.4). If any v658 leg is found at Implement to assert a closing-section PAINT (none is recorded in its doc), that leg is named in §3 and re-pointed to the store-value assertion only — never weakened silently.
- harness-v686 **45/0**, with exactly these named re-points (each marked in-code `superseded-by-v699`, on the v690-review re-point precedent):
  1. **L1 closing-section leg** (harness-v686.mjs:292 — "closing Mass and Homilies section stands after the last block group, four rows in order") → re-pointed to the section's ABSENCE: no `[data-p686mass]` stands in the form.
  2. **L1 Stations row leg** (:294 — tag "Not placed" · Off · Fridays) → re-pointed: no `[data-p686src]` row for `stations-of-the-cross` stands in the form.
  3. **L1 Fr. Mike row leg** (:297 — On · Sundays) → re-pointed: no `[data-p686src]` row for `fr-mike-homily` stands in the form.
  4. **L7 leg** (:502) → its closing-keys clause (the four keys carry no Move button) is re-pointed: none of the four keys paints a source row at all; every other clause of L7 word-identical.
  No other v686 leg is touched; the whole-table, splice, Move, and Settings legs stand as the S9 regression net.

**Fail-on-old evidence (named, recorded in §3):** harness-v699 run against the pre-change tree: **S1, S2, S3, S5 (no-row leg), S6, S7, S8 MUST FAIL** (the old tree paints the section, has no catalog record, no daily keys, no stamps) while **S9 passes on both trees** (the write contract is unchanged). §3 records both tallies.

### 2.6 Ordered Implement seat list

1. **Production verification + catalog production** (§2.1): verify the prayer-audio route; author the book row; render + upload the audio; measure the duration. Stop-and-report if the production route cannot be verified.
2. **Server seats** (§2.3): validator literal (two keys) · `PRAYER_AUDIO` entry with the measured duration · the `prayer_book` row insert by the route named in §2.1 seat 2.
3. **Client seats** (§2.2): section deletion (builder + caller) · daily-set widening + validator literal · matcher arm · Add stamps.
4. **Write harness-v699** (§2.5) and run it green on the new tree.
5. **Re-point harness-v686** (the four named legs, §2.5) and run it to **45/0**.
6. **Produce the fail-on-old evidence** (§2.5) in a scratch worktree; record both tallies.
7. **Run the standing regressions:** harness-v690 **33/0** · harness-v688 **65/0** · harness-v658 **20/0**.
8. **Write §3** (seats changed with built-tree citations · the catalog record as produced (slug · category · measured duration · R2 key) · the production route used · both fail-on-old tallies · all harness tallies · the card-label verification from §2.2 seat 2) and commit. The pin bump, merge, and deploy are the Ship phase's acts — not Implement's.

### 2.7 Risks

- **R1 — the audio production route is unproven in-tree.** No prayer-audio render script stands in `app/`, `runner/`, or `scripts/` (searched at Plan). Mitigation: seat 1 is verification-first with a stop-and-report; the release must not ship a `PRAYER_AUDIO` entry whose R2 object does not stand (the audio route 404s and the descriptor would stand unplayable — worse than absent). If the route cannot be verified, the coordinator takes the blocker to John before any code seat runs.
- **R2 — the matcher-arm trap.** Widening the daily set without the `opnDailyMatch666` arm yields items that validate, paint in the Edit form, and resolve NOTHING (generic tail = `null`), with no error anywhere — the v690-class silent failure. Mitigation: S6/S7 assert resolution against a snapshot-shaped payload, not just validation; §2.2 orders the arm in the same seat block as the widening.
- **R3 — the whole-table PUT trap.** Deleting store rows, or the validators' `'Mass and Homilies'` block exception, or the `OPN686_SECTIONS` entry, breaks every source-row write (400 / reordering) — a regression far larger than the release. Mitigation: §1.8's frozen posture + §2.4's named no-change seats + S9.
- **R4 — deviation blowback (daily-set widening).** The v688 sibling-kind discipline exists to keep kinds closed; a future seat could read the widening as license. Mitigation: the set's head comment names v699 + John's widening word as the authority for exactly these two keys; no other key is added.
- **R5 — homily publish timing.** A Sunday homily episode may publish after the day's first build; the arm stands the newest entry ≤ presented (last Sunday's) until the new one lands, and the v677 settled store holds the day's pick once settled. Named behavior, not a defect: it matches the saint arm's never-later discipline; v694's no-fallback rule is honored (no stale flag, no placeholder swap mid-day beyond the standing settle machinery).
- **R6 — grep false positives at Review.** "Mass and Homilies" legitimately survives in the store values, validators, write order, marks, and `EXT_SLOT_BLOCKS` (§1.7). Mitigation: §2.4 lists every surviving seat by name; Review fails only on a surviving PAINT seat (`opnMassHomiliesSectionHtml686` · `data-p686mass` · a `closing:true` caller).
- **R7 — the book category choice.** The Stations must stand in a category a person browsing Prayer Book will open; a wrong category re-buries it. Mitigation: §1.5's recommendation + S3 asserts the row at its category rung; the head search carries Prayer Book prayers by title regardless of category, so "Stations" is findable by search from day one.
- **R8 — John's device copy.** His device may hold the flipped local settings (enabled 1) and, in device mode, a locally-seeded settings doc; after ship the row is inert (§1.8), but his Edit form simply loses the section — the field leg is his look: no section, Stations findable in Prayer Book, homilies addable as standing items. Not claimed by any harness.

### 2.8 Open points index

- **OPEN-1 (§1.5):** the Stations' book category — recommendation `The Raccolta`; Implement confirms against the book's group order and records the pick in §3. No other element's seat is open: the item shapes, the matcher arm, the frozen-store posture, and the section deletion are decided above.

## §3 Implement record (holder: chain-v699-impl)

### 3.1 Seat 1 — production route VERIFIED + the catalog record as produced

- **Route found (standing production route for Prayer Book audio):** the v509/v562 path — live book body → `normalized_tts_text` (the fork runner's `_common`, wrapping the repo's normalize-prayer-tts skill) → `/opt/hatch/bin/tts speak --voice avocado_v2:MAI_03` (plain voice, no bed, body only, voice read-back verified per segment) → ffmpeg concat/re-encode to the standing format (MP3, 24 kHz, mono, 64 kbps) → upload to R2 bucket `ora-pro-nobis-audio` at `prayer-audio/<slug>.en.mp3` via wrangler with the Cloudflare connector credential → read-back byte compare (sha256 equal). Evidence in-tree: `releases/v562-prayer-audio-full-coverage.md` §1 + the v562 seat's `render_v562.py` / `upload_v562.py` in `~/workspace/projects/ora-pro-nobis/v562-prayer-audio/`. The Plan's "no render script in app/, runner/, scripts/" negative stands for the app tree; the route lives in the v562 production seat's scripts + the fork runner's `_common.normalized_tts_text`, and was followed exactly.
- **Text authored:** St. Alphonsus Liguori, *The Way of the Cross* (public domain) — preparatory prayer + the fourteen stations (versicle/response, meditation, prayer, "Our Father, Hail Mary and Glory Be", closing verse each) + "St. Alphonsus Liguori, pray for us. Amen." The source's ending indulgence rubric is a direction, not prayer text, and is not seeded (the book's standing convention, migration 0026). Body: 14,614 chars as stored.
- **Book row (route used: the standing migration route — migration `0053_stations_of_the_cross_book_row.sql`, applied to live app D1 `3a177d55-7baa-424c-9c4d-0d60cd9fe332` through the Cloudflare connector at Implement, read back):** slug `stations-of-the-cross` · title "Stations of the Cross" · category **"The Raccolta"** (OPEN-1 DECIDED by the coordinator under decide-and-move — the Plan's recommendation; the live book's Raccolta group stands at sort 9010–9080, this row at sort **9090**) · body_latin NULL · source "St. Alphonsus Liguori, The Way of the Cross (public domain)". Read-back: row id 78, category/sort/length verified by SELECT.
- **Audio produced:** 15 segments (intro/preparatory + 14 stations), every segment's voice read-back `avocado_v2:MAI_03`. Produced file: `stations-of-the-cross.en.mp3`, **duration 1011.8 s (ffprobe, measured from the produced file)**, 8,094,765 bytes, sha256 `e3a4de1b4a7c5f08f77a41d55d11d6161db10f705cc90bd56d862fdf09a03e9d`. Seat artifacts: `~/workspace/projects/ora-pro-nobis/v699-prayer-audio/` (body.txt · tts-text.txt · render_v699.py · renders.json · uploads.json · parts/).
- **R2 read-back evidence:** PUT `ora-pro-nobis-audio/prayer-audio/stations-of-the-cross.en.mp3` succeeded; a subsequent GET's sha256 equals the local file's sha256 exactly (`e3a4de…a03e9d`, recorded in uploads.json, verified: true).
- **`PRAYER_AUDIO` entry (index.ts):** `"stations-of-the-cross": { en: 1011.8 }` with a comment naming the measurement.

### 3.2 Code seats (built-tree citations)

- **client.ts — section deletion:** `opnMassHomiliesSectionHtml686` deleted whole + its caller line in `opnEditSetHtml609` deleted. `opnSourceRowHtml686` carries NO distinct closing-only branch (its `opts` reads are off/tag/block/repRid only) — the builder stands byte-identical per §2.2 seat 1's else-branch. Grep on the built tree: no `p686mass`, no `closing: true` caller, no `opnMassHomiliesSectionHtml686`.
- **client.ts — daily-set widening:** `OPN_DAILY_SERIES_666` gains `'fr-mike-homilies'`, `'barron-sunday-sermons'` appended (five standing keys' order untouched); the set's head comment names v699 + the §1.6 deviation + John's widening word as authority for exactly these two keys. The client validator (`opnCheckContents590` daily arm) gates on `opnDailyKeyOk666` — no separate literal stands in client.ts, so the widening carries it (Plan §2.2 seat 4's mirror is by construction). Card labels verified in harness-v699 S6: "Sunday Homilies with Fr. Mike Schmitz · Daily" / "Bishop Barron's Sunday Sermons · Daily" — the ladder lookup carries both titles, no T-table change needed.
- **client.ts — matcher arm:** in `opnDailyMatch666`, before the generic `return null`: for the two homily series, entries filtered to Chicago publish date ≤ presented, newest by `publishedMs`, `{e, stale:false}` or `null`. No other arm moved.
- **client.ts — Add stamps:** in the `[data-p603additem]` click handler, beside the v670 side stamp: `prayer:stations-of-the-cross` → `dayRule:'fridays'`; `daily:fr-mike-homilies` / `daily:barron-sunday-sermons` → `dayRule:'sundays'`. No other add is stamped.
- **index.ts — server validator literal:** `validateProfileContents`' daily arm gains the two keys (exact mirror).
- **index.ts — `PRAYER_AUDIO` entry:** §3.1.
- **Pin:** ui.ts CACHE `ora-pro-nobis-v699-1`.
- **Daily TV Mass:** zero new code (verified — no change to any v688 seat); its closing row retires with the section; harness-v699 S5 asserts the standing card + no `[data-p686src]` control for the key.
- **No-change seats verified standing:** both source-settings validators' `'Mass and Homilies'` block exceptions (client.ts · index.ts), `OPN686_SECTIONS` + `OPN686_SLOT_ROW`, block tones/glyphs/door marks, server `EXT_SLOT_BLOCKS`, all 26 store rows' values, the `usccb-daily-readings` Morning seat (harness-v699 S9 + harness-v686 45/0).

### 3.3 DEVIATIONS from the Plan (named plainly)

1. **`contentsOut` carriage fix (client.ts, profile-editor save serializer) — beyond §2.2's named seats, required for seat 5 to function.** Found at Implement by harness-v699 S3/S6: the profile editor's `contentsOut` mapped every item to `{kind, key}` only, silently stripping `side` (v670), `off` (v687) and `dayRule` (v690) on every profile-editor save — v699's Add-stamped dayRules landed in the draft and died at Save. The map now carries `side`/`off`/`dayRule` when present (both validators already carry all three fields). Without this fix the release's central shape (a Fridays-only Stations item added through the profile editor) fails silently in production — the exact failure class this release exists to kill. All regression harnesses re-run green after the fix (§3.4).
2. **harness-v688 one leg re-pointed (Plan §2.5 said v688 unmodified).** Its M8 leg "the v666 set is NOT widened (OPN_DAILY_SERIES_666 unchanged)" asserts the closed set that §1.6's named deviation widens — it cannot stand with the prescribed build. Re-pointed to assert the widened set verbatim, marked `superseded-by-v699` in-code; no other v688 leg touched; tally 65/0 stands with the re-point named.
3. **harness-v686 L7 re-point widened by one clause.** The four named re-points stand as prescribed; the L7 leg's `rows.length >= 10` floor counted the four closing rows (only 9 block rows stand after deletion), so the floor is re-pointed to >= 9 inside the same marked leg. No clause weakened: the closing keys are now asserted absent entirely, which is strictly stronger than the original no-Move clause.
4. **S5 fail-on-old shape (evidence note, not a build change).** In harness-v699's jsdom world the Edit form is not painted, so S5's no-row leg passes on both trees; the leg that fails on old for S5's assertion is S1 + the re-pointed harness-v686 L1/L7 legs (playwright, the real Edit form). Recorded here rather than silently claiming the §2.5 shape.

### 3.4 Harness tallies

- **harness-v699 (new, Plan §2.5 legs S1–S9): 34 ok / 0 not-ok** on the built tree.
- **Fail-on-old (method: pristine base worktree at `a26830f` + harness-v699 copied in, run there): 20 ok / 14 not-ok** — S1, S2 (map + fold), S3 (stamp), S5's section leg via S1, S6 (set + both validators + node card + stamp), S7 (matcher + composed Sunday), S8 all FAIL on the base tree as required; **S9 passes on both trees** (the write contract is unchanged), as §2.5 prescribes.
- **Regressions:** harness-v690 **33/0** unmodified · harness-v658 **20/0** unmodified (no v658 leg asserts a closing-section paint; none needed re-pointing) · harness-v688 **65/0** with the one named re-point (§3.3.2) · harness-v686 **45/0** with exactly the four named re-points, each marked `superseded-by-v699` in-code (§3.3.3 for the L7 floor clause).
- **Build:** the worker bundles clean through the standing esbuild route the harnesses use (`index.ts` + `ui.ts`, no errors).

### 3.5 Ship notes

- Not merged, not deployed (Ship is a separate seat). The D1 book row (migration 0053) and the R2 audio object already stand live — both are additive and inert until the code ships (no slug resolution exists pre-v699).
- Field leg (John's look, per R8): no closing section in the Edit form; Stations findable at Add › Prayers › Prayer Book › The Raccolta and by head search; homilies addable as standing Sunday items from Add › Catechesis › Homilies.

## §4 Review (holder: chain-v699-review — LIGHT Review, independently re-run)

- **Verdict: PASS.** No defects named. All seven verification items in the Review brief were checked independently; §3's claims reproduce.

### 4.1 Independent tallies (re-run by Review on the built tree)

- harness-v699: **34 ok / 0 not-ok** (S1–S9) — matches §3.4.
- harness-v690: **33/0** · harness-v658: **20/0** — both byte-unmodified vs base `a26830f` (zero diff), as §3.4 records.
- harness-v688: **65/0** with the one M8 re-point · harness-v686: **45/0** with the four named re-points.

### 4.2 Re-point inspection (each diff read)

- v688 M8: marked `superseded-by-v699`; asserts the widened `OPN_DAILY_SERIES_666` verbatim by exact JSON equality — equal strength, new behavior. PASS.
- v686 L1 section leg → asserts `mass === null` (absence — stronger). L1 Stations leg → no source row paints (stronger). L1 Fr. Mike leg → no source row paints (stronger). L7: closing-keys clause now asserts zero of the four keys paint a source row at all (stronger than the original no-Move clause); the `rows.length >= 10` floor re-pointed to `>= 9` inside the same marked leg (§3.3.3) — the floor alone is one lower, but the leg as a whole is strictly stronger because the four closing rows are now asserted absent entirely. No re-point merely weakens a leg. PASS.

### 4.3 The contentsOut deviation (§3.3 item 1) — verified load-bearing and correct

- Serializer diff read: the map still emits `{kind, key}` (key omitted when absent) exactly as base; it now additionally carries `side` verbatim, `off` as `1`, and `dayRule` verbatim, each only when present on the item. No other field's carriage changes; no field is dropped that base carried.
- Harness coverage of a stamped item surviving a Save: **S3 and S6** — both drive the real Add ladder, click the profile Save button (`savedMorning699` → `[data-p593save="profile"]`, whose payload is built by `contentsOut`), then read the stored contents back through the profiles payload and assert `dayRule:'fridays'` (S3, Stations prayer) and `dayRule:'sundays'` (S6, Fr. Mike daily) survive. The fix is exercised end-to-end, not merely present. PASS.

### 4.4 Fail-on-old spot-check (Review's own run)

- Pristine worktree at base `a26830f` + harness-v699 copied in, run by Review: **20 ok / 14 not-ok** — exactly §3.4's tally.
- S1 FAILS on base (builder present) · S6 FAILS on base (set unwidened · both validators throw `bad daily` · no head card · no stamped Add) · the bogus-key refusal passes on both trees · S9 stands in the passing set on base, as §2.5 prescribes. PASS.

### 4.5 Data legs (read-only spot-checks)

- App D1 `3a177d55-7baa-424c-9c4d-0d60cd9fe332`: `prayer_book` row stands — id 78 · slug `stations-of-the-cross` · title "Stations of the Cross" · category "The Raccolta" · body opens with the Alphonsus preparatory prayer. PASS.
- Migration `0053_stations_of_the_cross_book_row.sql` stands in the branch (`app/migrations/`). PASS.
- `~/workspace/projects/ora-pro-nobis/v699-prayer-audio/uploads.json`: internally consistent — sha256 `e3a4de1b…a03e9d` and bytes 8,094,765 match `renders.json` exactly; `readbackEqual: true`; renders record duration 1011.8 s, voice `avocado_v2:MAI_03`, 15 segments — consistent with the `PRAYER_AUDIO` entry `{ en: 1011.8 }`. A live R2 GET sha compare was not re-run (optional per brief; the recorded read-back stands). PASS.

### 4.6 Built source

- Full branch diff vs `a26830f` read: client.ts carries exactly the set widening (two keys appended, standing order untouched, head comment naming v699 + the deviation), the homily matcher arm, the section builder deletion + caller-line deletion, the Add dayRule stamps, and the contentsOut carriage (§4.3). index.ts carries exactly the server validator literal (two keys) + the `PRAYER_AUDIO` entry. ui.ts carries only the pin.
- No-change seats stand untouched (absent from the diff): both source-settings validators' `'Mass and Homilies'` block exceptions · `OPN686_SECTIONS` · `OPN686_SLOT_ROW` · `EXT_SLOT_BLOCKS`.
- Pin reads `ora-pro-nobis-v699-1`. Daily TV Mass: zero new code — no v688 seat appears in the diff. PASS.

### 4.7 Daily-set widening + matcher discipline

- `OPN_DAILY_SERIES_666` gains exactly `'fr-mike-homilies'` + `'barron-sunday-sermons'`, appended; S6 asserts the full seven-key array verbatim.
- The homily arm filters to Chicago publish date `<= presented` and takes the newest (`byPub` descending, first hit), `stale:false`, `null` when none stands. S7 asserts the future-dated case directly: presented Fri 2026-11-27 resolves the Nov 22 entry while the Nov 29 / Dec 6 future entries never stand, and a future-only series resolves `null`. PASS.

### 4.8 Findings

- None blocking. The §3.3 deviations (contentsOut carriage · v688 M8 re-point · v686 L7 floor clause · S5 fail-on-old shape note) are each named in §3, verified above, and stand as recorded.
- Ship seat note: the field leg (R8) remains John's look after deploy; no harness claims it.
