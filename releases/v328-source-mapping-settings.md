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
