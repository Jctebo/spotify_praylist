# v328 — App settings for the source-to-day mapping (seeded with current defaults)

- **Project:** Ora Pro Nobis
- **Slug:** v328-source-mapping-settings
- **Registry:** DevOps Board app, project ora-pro-nobis, row id 600, version "v328", status Scope
- **Branch:** release/v328 in the fork (~/workspace/projects/spotify_praylist-fork), cut from muse-draft-week @ 53dc63f (the v327 Ship merge — the trunk head at seating)
- **Run Directive:** Scope only — held at Scope for John's approval and level (Scope Gate, 2026-11-08). This document is the scope package for John (with the HTML package at ~/workspace/your_files/v328-scope-package.html); Plan does not open until John approves and sets the level.

## 1 · Scope

- **Agent:** Scope Agent (v328) — Scope claim record 1126, claimed 2026-11-09 03:09 UTC (2026-11-08 21:09 CT) · time contract 48
- **Inputs read:** the v328 registry row (id 600) · John's direction, Ora Pro Nobis thread voice call, 2026-11-08 21:05 CT · the seat skill + WF-1-SCOPE (Ora Pro Nobis Agent Skills Open Standard) · the v324 release document §1 in full (the three external sources, their contract matching, the placement decisions) · the v312 release document (player storage, the push-time block resolution rule, the `player_sources` state) · the v305 release document (the app shell, `player_sources` as data, the session sources editor with no screen) · `jobs/push_episodes_to_app.py` (the standing push helper, read in full and its resolver EXECUTED against the most recent completed manifest) · `config/spotify/playlists/*.json` (all seven playlist definitions) · `config/spotify/contracts/*.json` (all 28 contracts) · `jobs/playlist/refresh_playlist.py` (the resolvers, the fallback chain, the weekday gates) · `app/migrations/0003_player_sources.sql` + `app/migrations/0007_player_episodes.sql` · `app/worker/src/index.ts` (the sources session routes, the player payload) · `app/worker/src/ui.ts` + `client.ts` (the four-tab shell, the brand bar) · the production app read first-hand through the prayer door this pass (the prayer-day payload for 2026-11-08/09/10 · the stored-day read · the sources route attempted through the agent door) · the completed run manifests at ~/workspace/ora-runner-runs/2026-11-08, 2026-11-09, 2026-11-10

### John's direction (verbatim — the whole item)

John, voice call in the Ora Pro Nobis thread, 2026-11-08 21:05 CT: **"add a request for a settings that let you configure which podcast go against which day — push my default settings to the app to begin with."**

Read, stated so he can correct it: a Settings surface in the Ora Pro Nobis app where John configures which podcast/source goes against which day — the source-to-block and source-to-day assignment — **seeded with his current default mapping exactly as it stands today**, and once the settings exist, the nightly push reads the app's settings instead of the mapping being folklore in code and config files. The registry row's own scope text (row 600) frames the same item: "the source-to-block (and day) assignment that today lives in the spotify-refresh Worker contracts, the app's player_sources rows, and v324's placement decisions."

### Discovery — where the mapping lives TODAY (verified first-hand, this pass)

There is no single mapping today. There are **three layers**, in three homes, and the one the player actually obeys is the weakest of them:

1. **The push-time name match (the layer the app player actually obeys).** Since v312, the player reads D1 only; each episode's block is resolved **at push time** by `jobs/push_episodes_to_app.py::resolve_blocks`: (a) mapped `player_sources` titles first, then (b) the day's prayer-item names from the app's own prayer-day payload — the longest name the episode's title carries as its head wins; unmatched episodes fall to **`unblocked`** (rendered after the blocks as "From today's podcast"). **Executed evidence:** this pass ran the helper's own resolver against the most recent completed manifest (2026-11-10, 16 episodes). Result: **4 resolve to a block** (Morning Prayer → Morning · Daily Rosary → Morning · Auxilium Christianorum → Afternoon · Daily Reflection → Night) and **12 fall to unblocked** — all 11 novena episodes (their titles begin "Traditional Novena to…" / "Short-Form Novena to…", which never head-match the prayer item named "Novenas", Midmorning) and the Marian Antiphon episode (the items are named "Morning/Midday/Afternoon Marian Antiphon"; the episode title is "Marian Antiphon - Angelus"). The first production push under this rule runs tonight (2026-11-09 00:00 CT, target Nov 11), so this fall-through is the standing behavior John's first app days will show unless the mapping becomes real data.
2. **`player_sources` (the app's own mapping table — currently presentation only, and unreadable by the push).** Migration 0003 (v305) created it as "the prayer/block playback mapping AS DATA, editable, never hard-coded," seeded with the six blocks' Spotify Praylist URLs plus one episode mapping (Morning Prayer → Morning, kind `rss`). **Migration 0007 (v312) deleted the rss row**; production therefore holds **6 rows, all `source_kind='playlist'`** — the blocks' "Open in Spotify" links, presentation data only (v312 §5 read-back). A session editor exists (GET/PUT `/api/player/sources`, `app/worker/src/index.ts` lines 652-663 — whole-table replace, behind `johnOnly`) but **no screen was ever built for it** (v305 Review accepted "editable via session API, no editor screen" as inside that release's scope). And the push's "player_sources first" leg is **inert in production**: this pass called GET `/api/player/sources` through the agent door and received **403 "access sign-in required"** — the route is session-only, and the helper swallows the failure in a try/except and proceeds on prayer-item names alone. So the one table meant to hold this mapping holds none of it, and the push could not read it if it did.
3. **The Spotify contracts (the rich mapping — it feeds Spotify, not the app).** `config/spotify/playlists/*.json` assign contracts to playlists (the six blocks + a seventh, Sunday's "Mass and Homilies"); `config/spotify/contracts/*.json` (28 contracts) name each source's resolver or episode lookup; `jobs/playlist/refresh_playlist.py` executes them daily for the Spotify Praylists: Divine Office hour matching (`do_date_aware`: hour term + month-day date, today else yesterday), Sing the Hours (`sth_match_today`: `M.D.YY` prefix + Lauds/Vespers token), Bible in a Year (`bible_in_a_year_for_today`: day-of-year, newest year), the **Divine-Office-first / Sing-the-Hours-fallback** chain for Morning and Evening (`get_morning_prayer` / `get_evening_prayer`, and the `morning-prayer-loh` contract's `fallback_resolver: DO_MORNING`), weekday gates (`contract_runs_today` — the Stations of the Cross and Lenten Devotion contracts carry `weekdays: [Friday]`), the Auxilium weekday-named episode, and the Rosary mystery rotation by weekday (Mon/Sat Joyful · Tue/Fri Sorrowful · Wed/Sun Glorious · Thu Luminous — a content rule inside one source, not a mapping change). None of this reaches the app player today; v324 is the release that brings three of these sources into the app, carrying their contract placement with them.

**The app shell (for the surface decision):** exactly four tabs (Prayers · Intentions · Examination · Confession, `ui.ts` tab bar, fixed at the bottom), a sticky navy **brand bar** on top present on every tab, and NO settings screen anywhere. Two in-app precedents for editable seeded data exist: the Examination tab's prompts are editable in place, and the Confession guide opens an editor sheet — seeded data the user edits inside the app is an established pattern in this codebase. The Prayers tab is player-only by v305's amendments; the four-tab shape is settled (v326's docked player is also designed against it).

**The stored day today:** the prayer door's stored-day read returns `storedDate: null, episodeCount: 0` — the first v312 production push lands tonight (2026-11-09 00:00 CT). The prayer-day payload itself (the draw structure the push matches against) was read for 2026-11-08, 2026-11-09, and 2026-11-10 and is **identical across all three days**: the standing item-to-block structure in Table B below.

### THE CURRENT DEFAULT MAPPING — the seed, in full

This is the table §1 exists to produce: every source, its block, and its day rule, exactly as the evidence above establishes today. **This table IS the seed** — at Ship it is written into the app once, as it stands here, and John's corrections to this table (in the package, or at approval) are corrections to the seed itself.

**Table A — the sources (the settings rows).** "In the app today" means the source reaches the app player now; "with v324" means the row takes effect in the app when v324's externals leg lands (the row can stand in the settings from the seed regardless).

| # | Source | Block | Day rule | In the app |
|---|--------|-------|----------|-----------|
| 1 | Morning Prayer (the podcast's own) | Morning | Daily | today |
| 2 | Daily Rosary | Morning | Daily (the mystery rotates by weekday — content, not mapping) | today |
| 3 | Marian Antiphon — Angelus (the podcast's own, one episode a day) | Morning ⚠ | Daily | today — but falls to unblocked under the standing name match (see note ⚠) |
| 4 | Novenas — every novena episode of the day | Midmorning | Daily | today — but falls to unblocked under the standing name match |
| 5 | Auxilium Christianorum | Afternoon | Daily (the episode is weekday-named) | today |
| 6 | Daily Reflection | Night | Daily | today |
| 7 | Divine Office — Invitatory | Morning | Daily | with v324 |
| 8 | Divine Office — Morning Prayer | Morning | Daily · primary for the hour | with v324 |
| 9 | Sing the Hours — Lauds | Morning | **Fallback only** (fills the hour only when Divine Office has no Morning Prayer match today) | with v324 |
| 10 | Bible in a Year | Morning | Daily (day-of-year episode; current year only, per v324 §1) | with v324 |
| 11 | Divine Office — Midmorning Prayer | Midmorning | Daily | with v324 |
| 12 | Divine Office — Midday Prayer | Midday | Daily | with v324 |
| 13 | Divine Office — Midafternoon Prayer | Afternoon | Daily | with v324 |
| 14 | Saint of the Day | Afternoon | Daily | Spotify-side only today (contract source; not in v324's app set) |
| 15 | Divine Office — Office of Readings | Evening | Daily | with v324 |
| 16 | Divine Office — Evening Prayer | Evening | Daily · primary for the hour | with v324 |
| 17 | Sing the Hours — Vespers | Evening | **Fallback only** (as row 9, for Evening) | with v324 |
| 18 | Divine Office — Night Prayer | Night | Daily | with v324 |

**Not placed today (named so the seed is complete — each seeds as OFF / no block, and John can place any of them from the settings once this ships):**

| Source | State today |
|--------|-------------|
| USCCB Daily Readings | A contract exists (`daily-mass-readings`, resolver USCCB); it stands in NO playlist and no block |
| Daily TV Mass | Stands in the Sunday playlist "Mass and Homilies" — a Spotify list, not an app block · Sunday content |
| Fr. Mike Sunday Homily | Sunday playlist · Sundays (latest by release date) |
| Bp. Barron Sunday Sermon | Sunday playlist · Sundays (latest by release date) |
| Stations of the Cross / Lenten Devotion | One fixed episode, contract-gated to **Fridays only**; stands in no playlist definition |

⚠ **Row 3 needs John's eye.** The prayer structure carries THREE antiphon slots (Morning · Midday · Afternoon Marian Antiphon — the Angelus prayed three times a day), but the podcast produces ONE antiphon episode a day ("Marian Antiphon - Angelus"). The seed places that episode in **Morning** (the first Angelus of the day). If John wants it at Midday, in all three slots, or elsewhere, the correction lands on this row — this is exactly the class of judgment the seed review exists for. Rows 3 and 4 also carry the discovery above: their seed placement states the INTENDED mapping (the prayer structure's own assignment), which the standing name match fails to execute today — the settings are what make the intent real.

**Table B — the standing item structure the own-podcast rows rest on** (the app prayer-day payload, identical 2026-11-08/09/10, read first-hand; episode-bearing items in bold — the rest are the day's activity/structure items, which are not sources and stand outside the settings):

- **Morning:** Workout · Shower · **Invitatory** · **Morning Prayer** · **Morning Prayer (Liturgy of the Hours)** · **Daily Rosary** · **Bible in a Year** · **Morning Marian Antiphon** · **Mass**
- **Midmorning:** Morning task · Socializing · **Daily Gospel Exegesis** · **Novenas** · **Midmorning (Terce)**
- **Midday:** Midday task · Socializing · **Midday Marian Antiphon** · **Midday Prayer**
- **Afternoon:** Afternoon task · Socializing · Additional spiritual prayer · **Afternoon Marian Antiphon** · **Saint of the Day** · **Auxilium Christianorum** · **None (Liturgy of the Hours)**
- **Evening:** Evening task · **Office of Readings** · **Vespers** · Family quality time · Muse Feed · Next day prep · The AI Signal
- **Night:** **Daily Reflection** · **Compline** · Sleep

Two structure notes: (1) **Daily Gospel Exegesis** (Midmorning) and the Liturgy-of-the-Hours items (Invitatory · Morning Prayer (LOH) · Midmorning (Terce) · Midday Prayer · None · Vespers · Compline) are prayer items the day's own audio covers through the Intentions segments and the produced episodes — they are not separate produced sources, and they get no settings row; the settings govern podcast/source placement, not the prayer draw itself (decision D3). (2) The six `player_sources` playlist rows (block → its Spotify Praylist URL: Morning 0sy9eBsySKuCppI0PxXRJN · Midmorning 3EYFgLhMGEfILn6bRJgHJm · Midday 4gQAaPAMiezBaDaoqK6sFQ · Afternoon 7cyrM9f9LXEfmoqwZvUaXW · Evening 6HNvFLWRShih7lgtwHTqXU · Night 1TAlNiKHMc41cT0fvkYxTD) are the blocks' "Open in Spotify" presentation links — they stand as they are and are not source rows.

**The Intentions segments stand outside the settings entirely:** one per block, generated by the run, always first in their block (the v325 player order rule). No setting moves, hides, or reorders them.

### The Settings surface — options on the evidence

- **A · A gear in the brand bar, opening a Settings screen (RECOMMENDED).** The brand bar is sticky and present on every tab; a gear icon there (icon-only, per the design principles) opens a Settings screen holding the mapping editor — one row per source: name · block picker (the six blocks, or Off) · day rule · order within the block. It changes no tab, touches no settled surface, and follows the app's own precedent for editing seeded data in place (Examination prompts, Confession guide). The Prayers tab stays player-only.
- **B · A fifth tab, "Settings."** Rejected as the recommendation: the four-tab shell is settled (v305), the tab bar is already at four labeled icons on a phone, and v326's docked player is being designed against this exact shell — a fifth tab reopens two settled designs for a surface John opens rarely.
- **C · A settings section inside the Prayers tab.** Rejected: the Prayers tab is player-only by v305's amendments, and a configuration surface inside the prayer flow puts machinery in the middle of the day's praying.

### The knob line — what is a setting and what is not

**In (the mapping):** per source — **on/off** · **block assignment** (Morning · Midmorning · Midday · Afternoon · Evening · Night · or no block, which renders the track in the "From today's podcast" group as unblocked does today) · **day rule** (Daily · Weekdays only · Weekends only · Sundays only · Fridays only · Fallback only — the vocabulary is exactly the rules the contracts execute today) · **order within the block** (v324's placement decision put externals after the block's own episodes in contract order; order is part of "which podcast goes where," so it is a knob, seeded as today's order).

**Out (the mechanics), with the line argued:** the per-source **match parameters** — title terms, date formats, day-of-year arithmetic, show/feed identities — are NOT settings. They are matching mechanics: a mistyped term does not produce an error, it produces a silent "not available today" (the honesty rule names the miss, not the cause), and a settings screen that can break matching without saying so is a trap. Source identity (which show, which feed) is fixed when a source is registered — by a release, with evidence, as v324 registered its three — not typed into a phone screen. What John configures is **assignment**: which source, in which block, on which days, in which order, on or off. If a source's matching ever needs to change, that is a Plan-level change with a harness, exactly as the contracts are changed today.

**Also out:** the prayer draw itself — which prayer items stand in which block (Table B) is the devotional content, owned by the prayer data and its own surfaces. The settings map SOURCES onto that structure; they do not edit the structure.

### Consumption — how the nightly push reads the settings

- **The read:** the push (step 4B, `jobs/push_episodes_to_app.py`, running in the fork's jobs tree with the prayer door already in hand) reads the settings **once, at push time**, and resolves every episode's block from them — replacing the name-match as the authority (the prayer-item names remain only as the seed's origin, not a runtime rule). The settings carry a **version stamp** (incremented on every edit); the push records the version it used — the mandatory "App push (v312)" report field gains the settings version (Plan pins the exact text; the step-4B job-sheet sentence is a Ship edit, coordinated below).
- **A new agent-door read is required — named plainly:** today the only sources route is session-only and the agent door gets 403 (verified this pass). The settings read for the push must stand behind the agent door (a read-only agent route serving the settings + version), or the push cannot consume what John edits. Plan designs the route; Scope names the requirement and the reason.
- **The failure fallback (decision D4):** if the settings read fails at push time, the push uses the **last-known settings** (the push caches the last successful read, stamped with its version) and the report names that it did so. Before any successful read exists, the last-known IS the seed — which equals today's mapping by construction, so a failed first read changes nothing. **A failed settings read must never silently change the day's content, and must never take the day down:** failing the whole push for a settings blip is rejected (the push is part of the publish tail; one bad read would leave the player with no day at all, where the last-known mapping leaves it with the right one). The one unacceptable outcome — silently resolving against a DIFFERENT mapping than the report claims — is excluded by the version stamp in the report.
- **What does NOT consume the settings in this release:** the Spotify playlist refresh. The contracts remain the Spotify side's source of truth (decision D5). Unifying both sides under the app settings is a named follow-on John can direct; doing it inside this release would put a Worker-side config migration inside a settings-screen release.

### Seed mechanics (decision D6)

- The seed is Table A (+ the not-placed set as OFF rows), written into the app's settings store **once, at Ship** (migration or a Ship-time write — Plan's call; the store's shape is Plan's design work, on the `player_sources` precedent of mapping-as-data).
- **Absent settings read as the seed:** before the seed write and on any store miss, the effective mapping is Table A — so behavior before this release, at its Ship, and after it is identical until John makes his first edit.
- **No job ever re-seeds.** After the one seed write, the settings are John's alone; nothing in the nightly run, the push, or any future release overwrites them (a re-seed would silently undo his edits — the pattern is named here so Plan and Review can hold the line). A future release that adds a source adds its row additively, never by rewriting the table.

### Relation to v324, and the sequencing, stated honestly

- **Relation: COMPANION (decision D7).** v324's three sources are rows 7–18 of the seed; once v328 stands, the settings govern those sources' block, day rule, and order like every other row. v324 was approved by John at Through Review on the 2026-11-08 voice call (21:06 CT, after this item was registered — recorded in MEMORY.md; at registration its Scope stood held for that approval). **Recommendation: v324 proceeds on its own approved chain against the contract mapping (its §1/§2 pins), and v328 follows and absorbs the externals into the settings table at its Ship** — the alternative (v328 first, v324 consuming settings from birth) parks an approved release behind this one's full chain for no behavioral gain, since the seed's external rows ARE v324's pinned placement.
- **The shared-file coordination, flagged:** v324's externals leg, v327 (in flight tonight — it shipped and merged during this Scope pass; trunk moved c59a32b → 53dc63f under this seat), and this release all touch `jobs/push_episodes_to_app.py`; v318's Ship also edits the step-4B job-sheet text, and v328's Ship must edit the same sheet for the settings-version field. v328's Implement therefore seats **after v324's landing**, and its Ship's sheet edit queues behind v318's. v326 (docked player, approved to Ship; Plan seats after v318+v325) touches the client shell where the Settings gear lands (the brand bar) — a light coordination, noted for Plan: whichever of v326/v328 lands second rebases the brand bar.
- **Likely place in the queue:** last of the current player line — after v318 · v325 · v326 · v324 settle. Scope names this so John's level choice is made with the real wait in view; nothing in this item is urgent, and the mapping it fixes is visibly wrong only in the unblocked fall-through (rows 3–4), which the player still renders and plays.

### Decisions for John (each with the Scope recommendation)

- **D1 — Surface placement.** **Recommended: option A** — a gear in the brand bar opening a Settings screen. (Fifth tab and in-Prayers section are the alternatives, argued above.)
- **D2 — The knob set.** **Recommended:** on/off · block · day rule · order within block. Match parameters and source identities stay OUT (mechanics, argued above).
- **D3 — The governed set.** **Recommended:** the settings govern the push's source placement — the podcast's own episode families AND the external sources (v324's set and every future registered source) — and NOT the prayer draw (Table B's structure) and NOT the Intentions segments.
- **D4 — Consumption + failure fallback.** **Recommended:** one versioned settings read at push time through a new agent-door read; on failure, last-known (seed before the first success), named in the report with its version; never fail the day, never silently change the mapping.
- **D5 — The Spotify boundary.** **Recommended: app-only.** The Spotify contracts stay Spotify's source of truth; unifying them under the app settings is a follow-on by John's word, not part of this release.
- **D6 — Seed mechanics.** **Recommended:** Table A written once at Ship; absent settings read as the seed; no re-seed ever; later edits are John's alone.
- **D7 — The v324 relation.** **Recommended: companion** — v324 proceeds on its approved chain with the contract mapping; v328 absorbs its sources into the settings at Ship; v328's Implement seats after v324 lands.

### Scope Record

- **Outcome:** the app carries a Settings screen where John sees the whole source mapping as one table — every source with its block, day rule, order, and on/off — seeded with today's mapping exactly; his edits there are what the nightly push uses from the next push on, with the settings version named in the run report; and the two source families that fall to "unblocked" today (the novenas, the Marian Antiphon) stand in their blocks under the seed.
- **In scope:**
  1. **The settings store**: the mapping as data in the app (the Table A rows + the not-placed set as OFF rows), each row carrying source name · block (or none) · day rule · order · on/off, plus a settings version stamp incremented on every edit. Seeded once at Ship from Table A.
  2. **The Settings screen**: reached by the brand-bar gear (D1); renders every row readably at the app's font floor (~17px body); edits block (picker), day rule (picker over the D2 vocabulary), order, and on/off; saves through the app's session surface (the standing GET/PUT sources-route precedent, extended or succeeded — Plan's design); shows the current settings version.
  3. **The push consumption leg**: the nightly push reads the settings once at push time through a new agent-door read, resolves own + external episode blocks from them (the name match retired as the authority), applies day rules and on/off (an OFF source's episodes are not pushed as tracks — they stand out of the day, named in the report, never silently present), and prints the settings version + read source (live · last-known) in the mandatory report field.
  4. **The failure fallback**: last-known cache in the push (seed before first success), exactly per D4; a failed read changes nothing about the day's mapping and is named in the report.
  5. **The report**: the closing report names the settings version used and any source that stood OFF or unplaced for the day — the standing read-back pattern, extended.
- **Out of scope:** match parameters, title terms, date formats, show/feed identities as editable fields · the prayer draw and Table B's structure · the Intentions segments (placement, content, order) · the Spotify playlist refresh and its contracts (unchanged; D5) · any change to v324's own scope, level, or pins · offline/download behavior (v324's exclusions stand) · any Pam surface (the app is John-only) · a settings screen for anything beyond this mapping (no general app-settings surface is created by this release).
- **Affected surfaces:** the app D1 (the settings store — Plan settles shape/migration) · the app Worker (the Settings screen's session read/write + the new agent-door settings read) · the app client (the brand-bar gear + the Settings screen) · the nightly push (`jobs/push_episodes_to_app.py` — resolution authority changes; day rules + on/off applied) · the step-4B job-sheet text (the settings-version field — Ship edit, coordinated with v318's Ship edit of the same sheet) · the nightly closing report.
- **Review placement:** **before the trunk landing** (the v312 precedent — a data-path + client change), with a candidate deployment; the Settings screen on John's phone and an edit-then-push reflection are Review criteria (criteria 2–3 below).

### Acceptance criteria

1. The Settings screen (from the brand-bar gear) lists every seed row — Table A's 18 rows plus the not-placed set as OFF — each with its block, day rule, and order, standing exactly as Table A states (John's approval corrections included); the six blocks' Spotify links and the Intentions segments are untouched.
2. **Edit reflection (Review, candidate):** an edit made on the candidate (e.g. Bible in a Year moved to Evening, or Novenas switched OFF) is what a push against the candidate uses — the pushed day reflects the edit, and the push's report field names the NEW settings version.
3. **Fallback (Review, candidate):** with the settings read made to fail, the push resolves against the last-known mapping (or the seed, pre-first-read), the day's blocks are identical to the last-known mapping, and the report names the fallback and its version. No push in any leg resolves against a mapping the report does not name.
4. Under the untouched seed, a pushed day places the novena episodes in **Midmorning** and the Marian Antiphon episode in **Morning** (the two families that fall to unblocked today), and every other own episode exactly as the executed resolver placed the four it already resolves — the seed changes nothing except making the intended placements real.
5. With v324 landed, its external rows resolve from the settings identically to v324's contract placement under the untouched seed (Divine Office hours in their blocks, Sing the Hours fallback-only, Bible in a Year Morning) — and switching an external source OFF removes it from the next pushed day, named in the report.
6. **Phone check (John's verdict, Review):** open Settings from the gear — the table is readable at the app's font size; change one mapping and change it back; the screen shows the version move and the day itself is undisturbed until the next push.
7. No re-seed: after any edit, a subsequent push, deploy, or release leaves the edited settings byte-identical except by John's own further edits (read-back evidence at Review and Ship).

### Concerns and Information Needs

- **Concerns and Information Needs:** — the anchor line for the app extractor; the substance follows.
- **Facts:** every figure above was verified first-hand this pass (2026-11-08 ~21:09–21:30 CT): the 4-of-16 resolution split is the helper's own code executed against the 2026-11-10 manifest, not an estimate · the 403 on the agent-door sources read was received this pass · the prayer-day structure is identical across the three days read · the production stored day stands empty until tonight's first push · trunk moved under this seat during the pass (v327 shipped and merged, c59a32b → 53dc63f) — this branch is cut from the new head, so no rebase is owed.
- **Assumptions:** the nightly push remains the day's single write path, so consumption rides step 4B rather than inventing a second reader · John's "which podcast go against which day" reads as source-to-block + source-to-day assignment (his registry scope text names the same reading); if he meant the Spotify playlists themselves as the governed surface, D5 is the decision that flips, and the Scope amendment is small.
- **Uncertainties:** row 3's antiphon placement (one produced episode, three prayer slots) — seeded to Morning, flagged for John's correction in the package · whether the Settings screen's write surface extends the standing sources PUT or stands as its own route — Plan's design call, the requirement (session-only writes, agent-door read-only consumption) is Scope's · the exact day-rule vocabulary for sources John may add later (the D2 set covers every rule the contracts execute today; a new rule kind is a release, not a settings value).
- **Decision impact:** D1–D7 are John's at approval. D5 is the widest: an app-only ruling keeps this release one surface + one consumption leg; a both-sides ruling roughly doubles it and pulls the Spotify refresh Worker into the blast radius. D4's fallback is the safety core: every other choice can be revisited, but a push that silently maps a day wrong is a wrong day prayed.
- **First source to check:** `jobs/push_episodes_to_app.py::resolve_blocks` (the standing authority being replaced) · `config/spotify/playlists/*.json` + `contracts/*.json` (the seed's contract half) · the prayer-day payload via the prayer door (Table B's source).
- **Stop condition:** if John's approval corrects Table A materially (a different default for a source family, not a single row), the seed is re-issued as a dated amendment to this section before Plan seats — Plan never builds against an uncorrected seed.

### Recommended approval level

- **Recommendation: Through Review (level 4).**
- **Reason:** two things verify only in the doing, and both are Review-shaped. (1) The surface is interaction — a settings editor on John's phone (the v312 pattern: phone check as a Review criterion, criterion 6 above). (2) The consumption leg is behavior-critical — a settings read that fails or a version that drifts changes what a whole day of prayer contains, silently if Review does not prove criteria 2–3 on a candidate. Through Review lets the chain run Scope · Plan · Implement · Review without further words and stops before Ship with the phone check and the fallback proofs in hand. Plain "approve" sets this level.

### Notes for the Curator

- Raw notes: the mapping's real state was worse than its reputation — the table built in v305 to hold it was emptied by v312's (correct) retirement of the read path, the push's read of it was never possible (session-only route, silently swallowed), and the name match left standing resolves a quarter of a real day's episodes to blocks. Three individually reasonable changes composed into a mapping that exists nowhere. The class: when a data store is retired, name the successor authority in the same release — v312 named the push-time rule but the rule was a heuristic, and no gate ever re-measured it against a real manifest until this pass ran the resolver by hand. Running the standing code against the newest real input, as a Scope discovery step, produced this release's single most decision-relevant fact (4 of 16).

---

## Amendment A1 — 2026-11-08 21:17 CT · Order is part of the scope

- **Directed:** John, Ora Pro Nobis thread, 2026-11-08 21:17 CT (verbatim): **"Include order in the scope. Not just mapping but order."**
- **Standing of this amendment:** §1 above stands as passed (Scope record 1126) and is not edited. §1 already carried "order within the block" as one of D2's knobs and as a field the Settings screen shows; this amendment makes order a first-class, numbered part of the item in three places — the seed (A1.1), the knob set (A1.2), and the consumption reading (A1.3). Where this amendment and §1 differ in emphasis, this amendment governs. The item remains HELD at Scope; John's approval, when it lands, covers mapping AND order together.

### A1.1 The seed carries ORDER — the per-block sequences

Table A gains an **Order** column: every placed source carries its playback sequence number within its block, composed from the standing rules — the Intentions card first (position 0, the v325 rule) · the block's own episodes in seed order (Table A's order, which is the push-manifest order §1 executed against) · the external slots after, in v324 §2.2's slot order (slots 1–9). Fallback sources carry **the number of the slot they fill**, not a number of their own — a fallback plays in its primary's position, on the days it plays at all. **Sources seeded OFF (the not-placed set) carry no number**: an OFF source has no position. When John places one from the Settings, it takes the next open position at the end of that block's source list until he moves it (Plan pins the write shape). A source John sets to NO BLOCK likewise stands outside the block sequences while it is unplaced, and takes the next open position when he gives it a block.

| Block | Order | Source | Standing |
|-------|-------|--------|----------|
| Morning | 0 | Intentions card † | v325 rule — not a settings row |
| Morning | 1 | Morning Prayer (the podcast's own) | today |
| Morning | 2 | Daily Rosary | today |
| Morning | 3 | Marian Antiphon — Angelus | today |
| Morning | 4 | Divine Office — Invitatory | v324 slot 1 |
| Morning | 5 | Divine Office — Morning Prayer | v324 slot 2 · Sing the Hours — Lauds fills THIS position as fallback |
| Morning | 6 | Bible in a Year | v324 slot 3 |
| Midmorning | 0 | Intentions card † | v325 rule — not a settings row |
| Midmorning | 1 | Novenas | today |
| Midmorning | 2 | Divine Office — Midmorning Prayer | v324 slot 4 |
| Midday | 0 | Intentions card † | v325 rule — not a settings row |
| Midday | 1 | Divine Office — Midday Prayer | v324 slot 5 |
| Afternoon | 0 | Intentions card † | v325 rule — not a settings row |
| Afternoon | 1 | Auxilium Christianorum | today |
| Afternoon | 2 | Saint of the Day ‡ | Spotify-side only today |
| Afternoon | 3 | Divine Office — Midafternoon Prayer | v324 slot 6 |
| Evening | 0 | Intentions card † | v325 rule — not a settings row |
| Evening | 1 | Divine Office — Office of Readings | v324 slot 7 |
| Evening | 2 | Divine Office — Evening Prayer | v324 slot 8 · Sing the Hours — Vespers fills THIS position as fallback |
| Night | 0 | Intentions card † | v325 rule — not a settings row |
| Night | 1 | Daily Reflection | today |
| Night | 2 | Divine Office — Night Prayer | v324 slot 9 |

† **Position 0 is NOT a settings row.** The Intentions card stands outside the settings entirely (§1, and sub-decision A1.2a below): no setting stores its position, and no edit moves it. It is shown in every block's sequence so the seed states each block's whole playback order, and its 0 is the standing v325 rule (John, 2026-11-08 20:02 CT: "Start with intentions at the top"), not a value in the settings store.

‡ Saint of the Day carries its settings order of record — Afternoon 2, after Auxilium, in Table A's order. It reaches the app on no current leg (Spotify-side only today), so the number orders nothing in the player yet; it governs from the day a source leg brings the source into the app, so the seed never has to be re-argued for it.

### A1.2 D2 amended — REORDER is a first-class knob

**Amendment to D2** (D2's text in §1 stands; this amendment extends it): the knob set is **on/off · block · day rule · ORDER (reorder)**. §1's "order within the block… seeded as today's order" described a placement fact; as amended, order is an editable control of the same standing as block and day rule — John can **reorder the sources within a block** from the Settings, and the settings hold the **one order of record**: the push reads it, and the player plays it (A1.3). Reorder is **within a block**; moving a source to another block is the block knob, and the row then stands in its new block at the order position the settings sequence gives it (Plan pins how a block's sequence renumbers on such a move — one gapless sequence per block, in displayed order).

**Sub-decision A1.2a — the bounds of reorder (for John's approval with the rest; recommendations marked):**

- **An external source may be moved ahead of the podcast's own episodes — YES (recommended).** An order that cannot cross the own/external line is two half-orders, not one order, and John's direction reads as the whole block sequence being his to arrange. The seed keeps today's composition (own episodes first, externals after); a reorder that interleaves them is his edit, stored and reported like any other.
- **The Intentions card may NOT be moved, and nothing may be placed ahead of it (recommended).** The card stands **outside the reorderable set**. Grounds: its first position is John's own standing order rule (the v325 rule, directed 2026-11-08 20:02 CT), and §1 already places the Intentions segments outside the settings entirely — "no setting moves, hides, or reorders them." A settings value that could outrank that rule would make the rule repealable by accident, mid-edit, from a phone screen. If John ever wants the card's position configurable, that is a change to the v325 rule itself, directed as such — never a settings value.

### A1.3 Consumption consequence — the stored order reaches the player through `sort`, and nothing else changes

Confirmed against the code this pass: the stored order reaches the payload through the standing `sort` column, and no ordering mechanics change. The push helper already writes a `sort` on every episode row it commits (`jobs/push_episodes_to_app.py` — today the manifest's enumeration; v324's externals ride the same commit in their 901–909 band), and the payload builder already reads `SELECT * FROM player_episodes WHERE date=? ORDER BY sort, episode_id` and takes each block's tracks in that order (`app/worker/src/index.ts`, `playerDayPayload`), with the Intentions card spliced at the block's head (the v325 form of that splice). Under this release the push derives the `sort` values from the **settings order** instead of the manifest enumeration — own episodes and external slots alike take their sorts from the one per-block sequence the settings hold (Plan pins the numeric scheme; where a reorder interleaves the two families, the settings-order derivation supersedes v324's fixed 900-band). **What this amendment changes is therefore exactly two things: the seed (it now carries the numbers, A1.1) and the settings write shape (each row stores its order; an edit rewrites its block's sequence).** The player's ordering mechanics — the query, the per-block ordering, the card splice — are untouched by this amendment and this release. One acceptance reading joins §1's criteria: under the untouched seed, a pushed day's per-block track order equals A1.1's sequences exactly, Intentions first; and criterion 2's edit-reflection leg extends to order — a reorder made on the Review candidate is the order the next push against that candidate writes, named by the new settings version.

### Amendment record

- **Phase record:** Scope record 1126 stands PASSED — not re-claimed, not re-passed; this amendment lands as a dated amendment per the standing pattern (a passed section is never rewritten).
- **Package:** ~/workspace/your_files/v328-scope-package.html re-issued with this amendment — marked AMENDED 2026-11-08 21:17 CT, the seed table carrying the ORDER column, the Settings mockup showing the seed's true order numbers, and sub-decision A1.2a with its recommendations.
- **Door note:** `amendment-v328-order-2026-11-08` filed through the app door with this amendment.

## 2 · Plan

- **Agent:** Plan Agent (v328) — Plan claim record 1160, claimed 2026-11-09 05:24 UTC (2026-11-08 23:24 CT) · time contract 79
- **Inputs read:** §1 + Amendment A1 in full (the scope of record; Scope record 1126 PASSED) · the Plan skill + the release-document standard · the registry row 600 (run directive read at seating: "Autonomous to Ship (lifted from Through Review by John blanket prod approval, 2026-11-08 23:00 CT; amended scope b38a837 is the scope of record)") · trunk `muse-draft-week` @ **29643a9** (the v324 Ship §5 commit — the base named below), read first-hand at that ref: `jobs/push_episodes_to_app.py` (334 lines, with v331's SEED_PLACEMENT + v324's step 4C) · `jobs/externals_resolver.py` (the nine SLOTS, sort = 900 + slot) · `app/worker/src/index.ts` (954 lines: `isAgent` door gate · `johnOnly` · `playerDayPayload` · the replace-day commit · the externals route · the session sources GET/PUT) · `app/worker/src/ui.ts` (SHELL_HTML brand bar · APP_CSS · SW_JS, cache `ora-pro-nobis-v324-1`) · `app/worker/src/client.ts` (view renders, `setTab`, the sheet precedent) · `app/migrations/0003_player_sources.sql` · `0007_player_episodes.sql` · `0009_player_episode_external.sql` · the real run manifest `~/workspace/ora-runner-runs/2026-11-08/report.json` (17 episode keys, enumerated below) · the app/tests estate listing (harness-v305…v333 + push-leg-v327/v333.py + check-v331-placement.py)
- **Work:** the research below, then this plan. Every load-bearing claim was verified against the trunk source at 29643a9, not against §1's seating-time evidence — two facts §1 could not have had are pinned where they bite: the Worker hard-validates external blocks against a pinned table (§2.2, the plan's one structural surprise), and v331's SEED_PLACEMENT + v324's externals now stand in the helper the consumption leg rewrites (§2.4).

### 2.0 Chosen approach, and the options rejected

**Chosen:** a dedicated settings store (two new tables, migration 0010) holding one row per source; the Settings screen edits it through a new session route in the standing whole-table PUT idiom; the push reads it once through a new agent-door GET and derives every episode's block + sort from it, with a last-known cache and the standing resolution as the terminal fallback; the Worker's two external-block validations are relaxed from "the pinned block" to "a known slot in a valid block" so a settings edit can never make the nightly commit fail.

**Rejected:**
- **Extend `player_sources` with the mapping rows.** Its six playlist rows are presentation data (criterion 1 protects them), its PUT is keyed to the retired title-match shape, and folding the mapping into it re-creates the §1 discovery — one table, two authorities, neither readable as the mapping. A dedicated store keeps the mapping's shape honest.
- **The settings as one JSON blob in a meta row.** Per-row validation, per-row order, and the seed-equality dump are all row-shaped; the codebase's own editor precedents (sources PUT, exam prompts PUT) are row updates in one batch.
- **A second seed copy inside the push helper** (so the helper's pre-first-read fallback is "the seed"). Two seeds of record drift; §2.4's terminal fallback is the standing resolution instead, which produces the seed's placements by construction (the D4 reading, pinned in §2.4).
- **A door write route for the seed or for edits.** Writes are John's, session-only (§1's requirement); the door stays read-only for settings. The seed is written by the migration (§2.1).

### 2.1 Storage — migration 0010 (pre-assigned number: 0010, next after v324's 0009)

**File:** `app/migrations/0010_player_source_settings.sql` — additive only, no rebuild of any standing table (the 0008/0009 idiom), so no safe-rebuild template applies.

```sql
CREATE TABLE player_source_settings (
  source_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  family TEXT NOT NULL,              -- 'own' | 'external' | 'spotify' | 'unplaced'
  block TEXT NOT NULL DEFAULT '',    -- one of the six blocks, or '' = no block
  day_rule TEXT NOT NULL DEFAULT 'daily',
  sort_order INTEGER,                -- position within the block; NULL = no position (off, or no block)
  enabled INTEGER NOT NULL DEFAULT 1,
  slot_id TEXT,                      -- external rows: the v324 slot governed; NULL otherwise
  role TEXT NOT NULL DEFAULT 'primary',  -- 'primary' | 'fallback'
  updated_at TEXT NOT NULL
);
CREATE TABLE player_settings_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
```

- **Day-rule stored values** (the D2 vocabulary, stored form): `daily` · `weekdays` · `weekends` · `sundays` · `fridays` · `fallback-only`. Display labels are the client's map ("Daily", "Weekdays only", …); the store never carries labels.
- **The seed is written by this migration** (Plan's call under D6 — §1 left "migration or a Ship-time write" to Plan). Grounds: the estate's own idiom (0003 seeded `player_sources`; 0006 is a seed migration outright), and the guarantee D6 actually needs — *written once, never re-seeded* — is structural with a migration: migrations run exactly once, so no job, deploy, or future release can re-apply it. At Ship, "apply migration 0010" IS the seed write (§2.8). The Worker carries **no** seed constant; the migration is the one seed of record. `player_settings_meta` is seeded `(1, 1, <migration time>)` — the untouched seed is **version 1**; every PUT increments it.
- **The seed rows (23) — pinned verbatim from §1 Table A + A1.1 + the not-placed set.** Order shown is the row's `sort_order` within its block:

| source_key | name | family | block | day_rule | order | enabled | slot_id | role |
|---|---|---|---|---|---|---|---|---|
| morning-prayer | Morning Prayer | own | Morning | daily | 1 | 1 | — | primary |
| daily-rosary | Daily Rosary | own | Morning | daily | 2 | 1 | — | primary |
| marian-antiphon | Marian Antiphon — Angelus | own | Morning | daily | 3 | 1 | — | primary |
| novenas | Novenas | own | Midmorning | daily | 1 | 1 | — | primary |
| auxilium-christianorum | Auxilium Christianorum | own | Afternoon | daily | 1 | 1 | — | primary |
| daily-reflection | Daily Reflection | own | Night | daily | 1 | 1 | — | primary |
| do-invitatory | Divine Office — Invitatory | external | Morning | daily | 4 | 1 | ext-invitatory | primary |
| do-morning-prayer | Divine Office — Morning Prayer | external | Morning | daily | 5 | 1 | ext-morning-prayer | primary |
| sth-lauds | Sing the Hours — Lauds | external | Morning | fallback-only | 5 | 1 | ext-morning-prayer | fallback |
| bible-in-a-year | Bible in a Year | external | Morning | daily | 6 | 1 | ext-bible-in-a-year | primary |
| do-midmorning-prayer | Divine Office — Midmorning Prayer | external | Midmorning | daily | 2 | 1 | ext-midmorning-prayer | primary |
| do-midday-prayer | Divine Office — Midday Prayer | external | Midday | daily | 1 | 1 | ext-midday-prayer | primary |
| do-midafternoon-prayer | Divine Office — Midafternoon Prayer | external | Afternoon | daily | 3 | 1 | ext-midafternoon-prayer | primary |
| saint-of-the-day | Saint of the Day | spotify | Afternoon | daily | 2 | 1 | — | primary |
| do-office-of-readings | Divine Office — Office of Readings | external | Evening | daily | 1 | 1 | ext-office-of-readings | primary |
| do-evening-prayer | Divine Office — Evening Prayer | external | Evening | daily | 2 | 1 | ext-evening-prayer | primary |
| sth-vespers | Sing the Hours — Vespers | external | Evening | fallback-only | 2 | 1 | ext-evening-prayer | fallback |
| do-night-prayer | Divine Office — Night Prayer | external | Night | daily | 2 | 1 | ext-night-prayer | primary |
| usccb-daily-readings | USCCB Daily Readings | unplaced | '' | daily | NULL | 0 | — | primary |
| daily-tv-mass | Daily TV Mass | unplaced | '' | sundays | NULL | 0 | — | primary |
| fr-mike-homily | Fr. Mike Sunday Homily | unplaced | '' | sundays | NULL | 0 | — | primary |
| barron-sermon | Bp. Barron Sunday Sermon | unplaced | '' | sundays | NULL | 0 | — | primary |
| stations-of-the-cross | Stations of the Cross / Lenten Devotion | unplaced | '' | fridays | NULL | 0 | — | primary |

- Notes on the table: the two fallback rows carry **the position of the slot they fill** (A1.1's rule — sth-lauds 5 = do-morning-prayer's 5; sth-vespers 2 = do-evening-prayer's 2), not positions of their own. Saint of the Day stands enabled with its order of record (Afternoon 2, A1.1 ‡) though no app leg consumes it yet. The five unplaced rows seed OFF with the day rule each carries today (§1's not-placed table: Sunday content → `sundays`; Stations → `fridays`; USCCB → `daily`, no rule attested, named here so Review sees the choice). `updated_at` seeds to the migration timestamp on every row.

### 2.2 Worker — routes and the one validation change (`app/worker/src/index.ts`)

1. **Session read:** `GET /api/player/source-settings` (in the session player branch, beside `sources` — `johnOnly` applies by router position) → `{ ok: true, version, sources: [ {sourceKey, name, family, block, dayRule, sortOrder, enabled, slotId, role} … ] }`, rows ordered by block (standing block order), then `sort_order`, then name.
2. **Session write:** `PUT /api/player/source-settings`, body `{ sources: [ {sourceKey, block, dayRule, enabled} … ] }` — the whole table, in the standing sources-PUT idiom (one D1 batch). Validation, each a named 400 that writes nothing: unknown `sourceKey` · `block` not one of the six or `''` · `dayRule` not one of the six stored values · `enabled` not 0/1 · the row set not exactly the stored set (no creates, no deletes — a future release adds a source by migration). **Server-owned fields:** `name`, `family`, `slot_id`, `role` are never taken from the body. **Order:** the server renumbers `sort_order` gapless per block (1..n) following the body's array order among the rows claiming that block (A1.2's renumber pin); rows with `block=''` or `enabled=0` get `sort_order = NULL`. On success the meta version increments by 1, `updated_at` stamps, and the reply is `{ ok: true, version: <new> }`.
3. **Door read:** `GET /api/agent/player/settings` inside the agent branch (the `isAgent` gate refuses a missing/wrong token with the standing 403 before the route is reached) → the identical body to the session GET. **No door write route exists.** This is the route §1 named as required: the standing sources route is session-only and the door's read of it 403s (verified at Scope; the helper swallows it today).
4. **The validation change (load-bearing — read carefully).** Today both write routes hard-pin external blocks to the resolver's table: the replace-day commit refuses any external entry whose block ≠ `EXTERNAL_SLOTS[id]` (400 "external block … must be …"), and the externals route forces `block = EXTERNAL_SLOTS[id]` onto every posted track. Under the settings, an external's block is John's configuration — a commit carrying a settings-moved external would 400 the whole replace-day, i.e. **a Settings edit could take the nightly push down**. The change, in both routes: `EXTERNAL_SLOTS` is demoted to the **slot-id registry** (an external `episode_id` must still be one of the nine), and the block is validated as data — must be one of `PRAYER_BLOCKS` or `'unblocked'` — and otherwise taken from the posted entry, exactly as own episodes' blocks already are. The externals route likewise takes `block` + `sort` from the posted track. Nothing else in either route changes: staging verification, the 9-for-9 swap shape, and the read-backs stand.
5. **Untouched, named:** `playerDayPayload` (it groups the stored rows by their stored block — it has no block authority of its own), `player_sources` and its GET/PUT (the playlist links stand), the staging routes, `EXTERNAL_SLOTS` as the id set. SW cache name → **`ora-pro-nobis-v328-1`** (ui.ts, §2.3).

### 2.3 Client — the Settings screen (`app/worker/src/ui.ts` + `client.ts`)

- **Gear:** SHELL_HTML's `.brandbar` gains one button after `.brandtext` — `<button class="gearbtn" id="gearbtn" aria-label="Settings">&#9881;</button>` (⚙, icon-only per the design principles; `.gearbtn { margin-left:auto; … }` in the CSS tail). The brand bar stands on every screen, so the gear does too (D1, option A). v326 coordination: the dock, if landed, sits at the body's bottom — the gear touches only the header line; the two changes share no region (§2.7).
- **Screen:** `client.ts` gains `renderSettings()` in the standing view-render idiom (the gear click swaps `#view`; it is **not** a tab — `setTab` and the four tabs are untouched, no tab stands active while Settings shows, and tapping any tab leaves). A "‹ Back" button returns via `setTab('prayers')`. Structure:
  - `<h1 class="screen">Settings</h1>` + `.sub` line: "Source mapping — which podcast plays in which block, on which days, in which order. Changes apply from the next nightly push." + a version line: "Settings version N" (the value the GET returned).
  - **Sections in standing order:** Morning · Midmorning · Midday · Afternoon · Evening · Night · No block · Off. Each section lists its rows **in settings order** (the displayed order is the order of record).
  - **Row shape:** source name at the app body size (17px — the font floor stands) · a `.meta` line naming the family ("Own podcast" · "Divine Office" · "Sing the Hours — fallback only" · "Bible in a Year" · "Spotify-side today" · "Not placed") · controls in one `.row`: an On/Off chip toggle · a Block `<select>` (the six blocks + "No block") · a Day rule `<select>` (the six rules, display labels) · **▲ ▼ move buttons** (disabled at the section's ends). Reorder is within the section's list only (A1.2); changing a row's Block select moves the row in the DOM to the **end of the target block's section** immediately, so displayed order is always the sent order.
  - **The Antiphon flag, carried visibly (§1 row 3 ⚠):** the marian-antiphon row carries a `.meta` note verbatim in substance: "One antiphon episode is produced each day and stands here, in Morning. The day also carries Midday and Afternoon antiphon prayer slots, which no produced episode fills."
  - **The Saint of the Day note:** its row's `.meta` line reads "Spotify-side today — this row governs from the day a source leg brings this source into the app." The five unplaced rows carry "Not placed — no app leg yet." (So an edit there is visibly stored-but-unconsumed, never silently effective.)
  - **Save:** one "Save mapping" button (`.btn gold`). It sends the full row array in displayed order via PUT; on `{ok, version}` the screen re-renders with the new version and a saved note ("Saved — settings version N. The next nightly push uses it."); on any 400 the server's error text shows in an `.err` line and nothing is re-rendered (no partial state — the PUT is one batch or nothing).
- **CSS:** additions land at the APP_CSS tail only (`.gearbtn`, `.setrow`, `.setcontrols`, select widths inside rows) — no standing rule is edited. Body text stays at the standing 17px; selects inherit the standing 16px form size.

### 2.4 Push consumption — `jobs/push_episodes_to_app.py` (+ `jobs/externals_resolver.py` interface unchanged)

The resolver keeps its matchers, its SLOTS table (now the seed's origin for externals and the slot registry), and its entry shape. **All settings application happens in the helper**, in one new leg at the head of `main()` and of `externals_only()`:

1. **The read (one read, versioned — D4).** `load_settings()` → `door.call("GET", "/api/agent/player/settings")`. On 200 with a well-formed body: write the cache and use it (`settings_source = "live read"`). On any failure (non-200, exception, malformed): read the cache if it stands (`settings_source = "last-known cache"`); if no cache stands, `settings = None` (`settings_source = "standing fallback"`, step 5). **Cache:** `~/workspace/ora-runner-runs/app-settings-cache.json` — `{version, fetched_at, sources}` — written on every successful read, never otherwise. The cache lives outside the per-date run dirs (it must survive across nights; the run dirs do not carry it).
2. **Family matchers (mechanics, code constants — §1's line: matching is not a setting).** The 2026-11-08 manifest's 17 keys, verified first-hand, are the families' evidence: `FAMILY_MATCH = [("exact", "morning-prayer", "morning-prayer"), ("exact", "daily-rosary", "daily-rosary"), ("exact", "marian-antiphon-angelus", "marian-antiphon"), ("prefix", "novena-", "novenas"), ("exact", "auxilium-christianorum", "auxilium-christianorum"), ("exact", "daily-reflection", "daily-reflection")]` — (match kind, episode-id pattern, settings source_key). The v331 `SEED_PLACEMENT` table is **absorbed**: its two placements are seed rows now (novenas → Midmorning, marian-antiphon → Morning), and the table + `seed_block()` are deleted in this release (the terminal fallback in step 5 re-derives them from the standing name match's prayer items — "Novenas" and the antiphon item names stand in the day payload — plus a retained two-line emergency map? **No** — pinned plainly: the fallback is the pre-v328 resolution *minus* SEED_PLACEMENT, i.e. sources-titles + prayer-item name-match only; on the one night it could ever fire before a first successful read, novenas/antiphon would stand unblocked for that one day and the report would name the fallback loudly. The alternative — keeping a placement table the settings supersede — leaves two authorities standing forever, which is the defect class this release exists to close. Named here so Review rules on it with §1's D4 text in hand: D4's guarantee is that a failed read "changes nothing about the day's mapping" relative to the last-known; before any read exists, the seed's equality with today's behavior is §1's construction claim about the *settings*, and the fallback's one-day placement gap is the honest price of a single authority. If Review rules this a D4 breach, the return is small: retain SEED_PLACEMENT as the fallback's first leg, deleted the day the cache first stands.)
3. **Own episodes.** For each manifest episode: find its family row. (a) Row stands, enabled, and its day rule passes for the target date → block = the row's block, or `'unblocked'` when the row's block is `''`; sort per step 6. (b) Row disabled or day rule fails → the episode is **excluded from the manifest entirely** (§1 in-scope 3) and named in the Settings field (step 7). (c) No family row matches (a producer the settings do not name) → the episode is committed as `'unblocked'` in manifest order and named in the Settings field as unmapped — **never dropped, never block-guessed** (the name match no longer assigns blocks to anything).
4. **Day rules**, evaluated against the target date (the date is a Chicago calendar date; weekday from the date itself): `daily` always · `weekdays` Mon–Fri · `weekends` Sat–Sun · `sundays` · `fridays` · `fallback-only` — on a primary row, never plays (it is not a primary on any day); on a fallback row it is the row's standing state (step 5 of the externals leg below).
5. **Externals.** `resolve_externals_detailed()` runs as today; the helper then applies the settings to the nine entries by `slot_id`:
   - The slot's **primary row** governs. Primary disabled or day-rule-failed → the entry stands `audio_state: "missing"`, `stream_url: ""`, and is named as stood out (step 7); **the fallback is NOT consulted** — John switched the primary off; silently substituting another show is a different mapping than the one the report names (pinned interpretation; the alternative is named in Concerns).
   - Primary stands → block = the primary row's block (or `'unblocked'`), sort per step 6 from the primary row's position. If the resolver matched the primary, the entry stands as resolved; if it missed, the **fallback row** is consulted as today (Sing the Hours), provided the fallback row is enabled — a fallback row's own day rule gates the days it may fill (`daily` = any day; the seed's `fallback-only` = whenever the primary misses, which is its role statement, not a day restriction). A filled entry takes the **primary row's block and position** (A1.1: the fallback plays in its primary's position) and names Sing the Hours as its source, as today.
   - The Bible entry's title/source construction is the resolver's, unchanged; its row (`bible-in-a-year`) governs block/position/on-off like any primary.
6. **The sort formula (A1.3's numeric scheme).** `sort = blockOrdinal × 100000 + sort_order × 100 + intra`, where blockOrdinal follows the standing block order (Morning 1 · Midmorning 2 · Midday 3 · Afternoon 4 · Evening 5 · Night 6 · unblocked 7), `sort_order` is the governing row's settings position, and `intra` is the episode's 0-based index within its family in manifest order (externals: 0). This preserves exactly what the payload reads — `ORDER BY sort, episode_id`, blocks grouped from the rows — while making the per-block sequence the settings order; the old encodings (manifest enumeration for own episodes, the resolver's 900-band for externals) are superseded in the one derivation. Cap named: a family with ≥100 episodes in a day would collide into the next position — the largest family stands at 12 (novenas); the formula's headroom is a named assumption, not a silent one.
7. **The report fields (exact text — §1 in-scope 3 + 5).** The standing print gains a settings suffix and a companion line:
   - `App push (v312): date pushed <date> · episodes <n> (<p> present / <m> missing) · per-track audio verified <v> · stored date after push <date> · texts <tp> / <tm> · settings v<N> (live read)` — the suffix reads `· settings v<N> (last-known cache)` on the cache leg, or `· settings: standing fallback (read failed)` when no settings governed.
   - `Settings (v328): stood out — <Name> (off) · <Name> (day rule: <rule>) · <Name> (unmapped)` — printed **always** (`stood out — none` when empty), so the line's absence from a run report is itself a failure signal. Names are the settings display names; externals appear under their primary row's name.
   - `externals_only()` prints the same suffix on the `Externals re-resolve (v324):` line and the same stood-out line when a settings exclusion lands a slot missing. Its standing feed-failure refusal is unchanged — a feed failure still refuses the whole post; a settings exclusion is a deliberate state, not a failure, and posts as a named missing.
8. **Verification legs stand:** the commit read-back and stored-day assertions are computed on the committed set exactly as today (they already key off the manifest the helper built); excluded episodes are outside the manifest, so no assertion changes shape.

### 2.5 The seed-equality oracle and harness-v328

**Equality, defined exactly** (§1 criterion 4 + A1.3's added reading): under the untouched seed, the v328 resolution of a day equals today's standing resolution on (a) the episode → block map, (b) each block's ordered episode sequence, and (c) the external entries' (slot, block, filling source, present/missing against identical feed inputs). The `sort` **integers** differ by design (the §2.4 formula supersedes both old encodings) — equality is judged on the three readings above, never on raw sort values. Review is asked to hold this definition, since A1.3 pins the derivation change itself.

- **Golden capture (Implement step 0, before any code change):** on the rebased trunk, run the standing resolution (the current helper's `resolve_blocks` + SEED_PLACEMENT + the resolver driven by `app/tests/fixtures/v324/`'s fixture feeds) against the real `~/workspace/ora-runner-runs/2026-11-08/report.json`, and commit the result as `app/tests/fixtures/v328/golden-2026-11-08.json`: `{blocks: {episode_id: block}, sequences: {block: [episode_id…]}, externals: [{episode_id, block, source, audio_state}]}`. The golden is the oracle; it is captured from the pre-change code, never edited after.
- **`app/tests/harness-v328.mjs`** (the estate mold — local wrangler instance, own port, LOCAL_DEV): legs —
  1. **Seed:** fresh D1, migrations 0001–0010 apply clean; `player_source_settings` holds exactly the 23 §2.1 rows (every field compared); meta version = 1.
  2. **Door auth:** `GET /api/agent/player/settings` with no token → 403; wrong token → 403; the door token → 200 with `{version: 1, sources: 23}`.
  3. **Session read parity:** session GET returns the identical body to the door GET.
  4. **PUT validation + version:** bad block → 400 · bad day_rule → 400 · unknown source_key → 400 · a body missing a row → 400 · a body trying to rename a source → name unchanged on read-back; a valid PUT (Bible in a Year → Evening) → `{ok, version: 2}`, read-back shows the move, and both blocks' `sort_order` stand gapless.
  5. **Reorder:** swap Morning Prayer and Daily Rosary in the body → read-back order follows; assert no row exists for the Intentions card (it is not a settings row — A1.2a) and none can be created (PUT with a forged key → 400, leg 4).
  6. **Commit acceptance (the §2.2 change):** a replace-day commit carrying `ext-bible-in-a-year` in Evening → 200 (the pre-change code 400s this — the leg names it as the defect-class proof); the externals-route swap carrying the same → 200; a commit with an unknown external id → 400; a commit with block `"bogus"` → 400.
  7. **Parse + boot (the standing pin):** the served `/app.js` parses and the shell boots against the instance; the served `/` carries the gear button; `renderSettings` against the instance's data renders 23 rows in the seed's sections and order.
  8. **Cache pin:** served `/sw.js` names `ora-pro-nobis-v328-1`.
- **`app/tests/check-v328-consumption.py`** (check-v331-placement.py's pattern — drives the helper's own functions; the door is stubbed at the helper's `door.call` seam):
  - **(a) Seed equality:** seed settings fixture (`app/tests/fixtures/v328/settings-seed.json`, a door-shaped copy of §2.1) + the real 2026-11-08 report.json + the v324 fixture feeds → the resolution equals the golden on all three readings. This leg carries check-v331-placement.py's two assertions (novenas → Midmorning in manifest order; antiphon → Morning) as a subset.
  - **(b) Edit reflection:** settings edited (Bible in a Year → Evening · Novenas off · Daily Rosary `fridays` — the fixture date 2026-11-08 is a Sunday) → BIAY commits in Evening at its row's position; no novena episode stands in the manifest; the rosary stands excluded; the stood-out line names all three with their reasons; the App push line names the edited version.
  - **(c) Fallback:** door read fails with a cache standing → the cache's mapping governs and the line names `(last-known cache)` with its version; door read fails with no cache → the standing fallback governs, the line names it, and the blocks equal the golden's except the two SEED_PLACEMENT families standing unblocked (the §2.4 step-2 price, asserted openly so Review sees it rather than discovers it).
  - **(d) Fallback interplay:** fixture feeds with Divine Office's Morning Prayer missing + Sing the Hours present → the slot fills with Sing the Hours at position 5 in Morning; with do-morning-prayer **off** → the slot stands missing, Sing the Hours is not consulted, and the stood-out line names Divine Office — Morning Prayer (off).
- **Superseded pins (harness-only, named per the standing class):** the SW cache string in harness-v312 (check 11), harness-v318, harness-v320, and harness-v324 — one string each, updated to `ora-pro-nobis-v328-1`. **check-v331-placement.py is retired** — its assertions are carried by check-v328-consumption.py leg (a) against the new authority; the file is deleted in this release and the retirement named in §3. Any harness-v324 leg asserting a 400 for a non-pinned external block is updated to the §2.2 validation (slot-id + valid block) — Implement greps for it and names what it finds in §3, tally in hand.
- **Regressions (named, complete logs, tallies from the complete files):** harness-v312 · harness-v318 · harness-v320 · harness-v324 · harness-v325 · harness-v327 · harness-v333 · push-leg-v327.py · push-leg-v333.py.
- **Full-suite position:** this release is migration + shared-core (the commit validation both write routes share) + client — the risk policy's big-change class. Implement therefore runs the **full runnable suite**: every `harness-v*.mjs` in app/tests (v305…v333 as they stand runnable on the mold) + both python push legs + check-v328-consumption.py + harness-v328. This also serves the standing full-suite catch-up counter.

### 2.6 Review placement and the §1 criteria map

**Review stands BEFORE the trunk landing** (§1's placement: data-path + client change, the v312 precedent), on a fresh candidate deployment `ora-pro-nobis-app-v328-review` (own Worker + D1 + R2 + Access app, the v324/v326 pattern; migrations 0001–0010 applied — the seed lands with 0010; the still-standing v324-review candidate is NOT reused, and its teardown remains v324's own follow-on). The candidate is exercised with a fixture-day push through the candidate door.

| §1 criterion | Proven by |
|---|---|
| 1 — screen lists the seed exactly; playlist links + Intentions untouched | harness-v328 legs 1 + 7 · candidate session GET read-back against §2.1 |
| 2 — edit reflection on the candidate, new version named | check-v328 leg (b) + the candidate edit-then-push run (Bible in a Year → Evening) |
| 3 — fallback: last-known governs, named, no silent mapping | check-v328 leg (c) + a candidate push with the settings read made to fail |
| 4 — untouched seed places novenas/antiphon; the resolved four unmoved | check-v328 leg (a) against the golden |
| 5 — externals resolve identically under the seed; OFF removes, named | check-v328 legs (a) + (b) + (d) · harness-v328 leg 6 |
| 6 — John's phone check | **LAST, John's verdict** (below) |
| 7 — no re-seed: edits survive pushes/deploys byte-identical | candidate: edit → push → re-read settings, byte-compare except the edit · Ship repeats the read-back on production after the deploy |

**Phone criterion (exact ask, drafted for Review to carry):** on the candidate — open the app, tap the gear in the top bar: the source table is readable at the app's size; move Bible in a Year to Evening and Save (the version number moves); move it back and Save; the day's prayers are undisturbed throughout.

### 2.7 Sequencing, trunk base, merge slot

- **Trunk base Implement should expect:** `muse-draft-week` at its seating-time head — 29643a9 at Plan time. Implement's first step is the rebase of `release/v328` onto that head (the branch stands at b38a837, cut from 53dc63f; the rebase is document-only at Plan's exit — §1 + A1 + this §2 ride it).
- **Drift watch:** v326 (docked player) stands in its Ship pass at Plan time and touches `client.ts`/`ui.ts`. If it lands first, the rebase carries this release over the dock — the gear (SHELL_HTML header) and Settings view (a new client function + CSS tail) share no region with the dock (body bottom + playback code), so the expected conflict surface is nil-to-trivial; if v328 lands first, v326's successor rebases over the gear by the same shape. Either order works; neither requires a re-plan unless the landing changes the brand bar itself, which neither release does.
- **Files in this release, complete:** `app/migrations/0010_player_source_settings.sql` (new) · `app/worker/src/index.ts` (routes + validation) · `app/worker/src/ui.ts` (gear + CSS tail + SW name) · `app/worker/src/client.ts` (renderSettings) · `jobs/push_episodes_to_app.py` (the consumption leg) · `app/tests/harness-v328.mjs` + `app/tests/check-v328-consumption.py` + `app/tests/fixtures/v328/` (new) · the named harness pin updates (§2.5) · check-v331-placement.py (deleted) · this document. **Spotify side: nothing** (D5).

### 2.8 Ship outline (named here so the gates agree; Ship executes)

1. Apply migration 0010 to the **production** D1 (this is the seed write) → read back 23 rows + meta version 1.
2. Merge `release/v328` → trunk; deploy the production Worker from the landed trunk.
3. Door read-back: `GET /api/agent/player/settings` → version 1, 23 rows, §2.1 equality on the production store.
4. **Job-sheet edit:** `ora-pro-nobis-nightly-run` — step 4B's text gains the settings sentence (the push reads the app's source-mapping settings; the field names the version), and step 6's mandatory-field list gains the `Settings (v328)` stood-out line beside the extended 'App push (v312)' field — via cron view + update with the complete body, read back (the v324 Ship pattern; the standing 4B text-staging copy fix and step 4C are preserved verbatim).
5. **First governed push = the next nightly run** (no Ship-time re-push); its App push field + Settings line are read back into §5 as the post-ship production proof — a verification, not a gate (the v312/v318 pattern; NEVER WAIT ON A CLOCK does not apply — nothing is blocked, the day's own run is the proof's natural vehicle).
6. The four-piece flip + Curator note `ship-v328-<date>`.

### 2.9 Rollback

- **Worker:** redeploy the prior production version — the Settings screen, both new routes, and the validation change vanish together; migration 0010's tables stand (additive, forward-only idiom — no down-migration, per the v329 precedent). John's edits, if any stand by then, remain in the tables, unread, until a fix-forward restores the surface.
- **Helper:** revert the helper commit on trunk and the standing resolution governs again in full (SEED_PLACEMENT rides the revert back). Independently, the new helper against a reverted Worker degrades safely by construction: its settings read 404s → cache → standing fallback, each named in the report. Both directions were checked at Plan: old helper + new Worker is likewise safe (the relaxed commit validation is a superset of the pinned one; the old helper's pinned-block manifests still commit).

### Outputs

- **This section:** the implementation plan — storage + seed (§2.1), Worker routes + the validation change (§2.2), the Settings screen (§2.3), push consumption + report fields (§2.4), the seed-equality oracle + harness design + test matrix (§2.5), Review placement + criteria map (§2.6), sequencing (§2.7), Ship outline (§2.8), rollback (§2.9). Every step traces to a §1 line: in-scope 1 → §2.1 · 2 → §2.2/§2.3 · 3 → §2.4 · 4 → §2.4 steps 1–2 · 5 → §2.4 step 7 + §2.8 step 4 · D1 → §2.3 · D2/A1 → §2.1 + §2.3 + §2.4 step 6 · D4 → §2.4 steps 1–2 · D5 → §2.7 (nothing Spotify-side) · D6 → §2.1 · D7 → the externals rows + §2.4 step 5 (v324 landed 23:52Z; its sources are absorbed exactly as §1 directed). No scope gap found; nothing absorbed that §1 does not cover.

### Concerns and Information Needs

- **Concerns and Information Needs:** — the anchor line for the app extractor; the substance follows.
- **Facts (verified first-hand this pass, trunk @ 29643a9):** the replace-day commit refuses an external entry whose block differs from `EXTERNAL_SLOTS` (400, named in the route), and the externals route forces the pinned block onto posted tracks — so without §2.2 step 4, a lawful Settings edit (criterion 2's own example, Bible in a Year → Evening) would fail the nightly commit; §1's criteria assume the move works, and the fix is inside §1's in-scope 2 ("the push consumption leg… resolves own + external episode blocks from them") read with in-scope 3 — Plan names it as the release's one structural surprise so Review verifies it expressly (harness-v328 leg 6 is its proof). · The payload orders by `(sort, episode_id)`: two episodes sharing a sort fall to alphabetical order, which is why §2.4's formula carries the intra-family index — without it, a block's novenas would re-order alphabetically instead of manifest order and seed equality (b) would fail. · The 2026-11-08 manifest's keys are exactly the six own families §2.4 names (5 exact ids + 12 `novena-` ids). · `GET /api/player/day` refuses the agent door (403) while `GET /api/agent/prayer/day` serves it — the new door route follows the `/api/agent/…` branch's `isAgent` gate, the established pattern. · The session sources PUT is whole-table + one batch — the settings PUT mirrors it deliberately.
- **Assumptions (pinned readings, each reversible by a Scope amendment if John or Review reads §1 otherwise):** (1) the fallback does not fill a slot whose primary John switched OFF or day-ruled out (§2.4 step 5) — substitution under an OFF would play a show the mapping he set does not name for that day. (2) A fallback row's day rule gates the days it may fill; its seed value `fallback-only` states its role, not a day restriction. (3) `fallback-only` on a primary (own) row means it never plays — the vocabulary is uniform across rows (§1's picker), and no own source carries it in the seed. (4) The D4 terminal fallback is the standing resolution without SEED_PLACEMENT (§2.4 step 2) — the one-day, loudly-named placement gap for two families is priced against a permanent second authority. (5) USCCB Daily Readings seeds `daily` — §1 attests no day rule for it.
- **Uncertainties:** whether harness-v324 carries a leg asserting the old pinned-block 400 — not read this pass; Implement greps and names it (§2.5). · v326's landing order against v328's Implement (§2.7) — either order is planned for; a brand-bar change in v326's Ship would reopen §2.3's gear placement, and nothing in its §2 suggests one.
- **Decision impact:** assumption (4) is the only one with a user-visible edge, and only on a night when the settings read fails before the cache first stands — after the first successful read (expected: the first governed push), the cache makes the question moot permanently. Assumptions (1)–(2) shape two harness legs (check-v328 (d)); if Review rules either the other way, the change is one leg of the helper + one harness leg, inside the same release.
- **First source to check:** `app/worker/src/index.ts` — the commit route's external validation and the externals route (the §2.2 change) · `jobs/push_episodes_to_app.py::resolve_blocks` + `externals_only()` (the consumption leg's seams) · `app/tests/check-v331-placement.py` (the pattern check-v328-consumption.py follows, and the file this release retires).
- **Stop condition:** if any correction to Table A beyond A1 stands in the registry or the door notes when Implement seats (Plan read the run directive at this seating: Autonomous to Ship, amended scope b38a837 is the scope of record, no correction noted), Implement does not build against an uncorrected seed — the seed is re-issued as a dated §1 amendment first (§1's own stop condition, carried forward).

### Notes for the Curator

- Raw notes: the plan's real work was one discovery — §1 scoped "the push resolves external blocks from the settings" as a helper change, but the Worker's two write routes would have refused the result: the pinned-slot validation, correct when v324 built it (the blocks WERE pinned then), became a trap the moment the blocks became configuration. The class, again: a validation that hard-codes a value a later release turns into data must be named in the later release's plan, or the feature ships with a self-denying write path. The seed-equality definition (§2.5) is the second note: "byte-identical" survives contact with an intentional sort re-encoding only by stating equality on the three readings (map, sequences, external set) — a Review that compared raw sorts would have failed a correct build.
