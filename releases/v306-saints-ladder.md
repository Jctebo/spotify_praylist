# v306 — Morning Prayer invocation: dynamic three-tier saints ladder

- **Project:** Ora Pro Nobis
- **Slug:** v306-saints-ladder
- **Registry:** DevOps Board app, project ora-pro-nobis, row id 550, version "v306", status Backlog, risk medium
- **Branch:** release/v306 in the runner fork (~/workspace/projects/spotify_praylist-fork); production executes the fork's jobs/ tree
- **Run Directive:** Scope only — the chain holds at Scope. This document + the written sample form the scope package for John; Plan does not open until John answers the question set in this section and sets the level.

## 1 · Scope

- **Agent:** Scope Agent — v306 (seated 2026-11-08 by the main seat; Scope claimed and passed 2026-11-08)
- **Inputs read:** skills/scope/SKILL.md · skills/phase-workflow/references/release-document-standard.md · the v306 registry row · config/publish/contracts/morning-prayer.json · config/publish/templates/morning-prayer/intercessory-litany.txt · jobs/publish/contracts.py (block rendering: a `file` block's text is read verbatim into the segment) · runner/pass1_collect.py (the nightly job builds publish episodes from the contracts and novenas from resolve_active_novenas) · jobs/novena_contracts/resolver.py (the window rule) · jobs/novena_contracts/saint_aliases.py (canonical identity) · contracts/novenas/feast-days/*.json (window scan for the sample) · John's direction, voice call 2026-11-08

### John's words (preserved)

John directed the change on the 2026-11-08 voice call, in substance: change the way the intentions work in the Morning Prayer of the Ora Pro Nobis podcast — the invocation of the saints section. A three-tier ladder of intentions: a core group of saints, part of the normal litany ("pray for us"); a second set of all the saints within the nine-day novena window, and the day's feast-day saint definitely in that second set; a third ladder of the patrons of the show — Saint Carlo Acutis and a few others, a number of saints on his current list, including any parish he has been to (he named Saint Angela Merici and Saint Mark from the current list). A function resolves the saints into the highest ladder they belong to: if Saint Carlo Acutis is in his novena window, he is not also in the third ladder. The prayer stays seamless — no ladder names are spoken; the saints are dynamic and change. "We've got a contract, so you'll probably have to customize that contract, create some functions." He asked for the scope, for a sample of how it could work, and to be asked questions that finalize the saints of each ladder — particularly all the saints for each ladder.

### Discovery findings (verified in the fork)

1. **The invocation today is one static file.** The Morning Prayer publish contract (config/publish/contracts/morning-prayer.json) carries an "Intercessory Litany" sequence whose single block is kind `file`, path config/publish/templates/morning-prayer/intercessory-litany.txt. jobs/publish/contracts.py reads a file block's text verbatim into the segment; runner/pass1_collect.py builds the episode from the contract. The text is the Litany of the Saints: Kyrie frame, 23 named invocations, closing "All holy men and women, Saints of God". It is identical every day. Nothing in the segment is computed.
2. **John's current list is that template.** In order: Holy Mary, Mother of God · Saint Joseph · Saint Michael the Archangel · Saint John the Baptist · Saint Peter and Saint Paul · Saint Teresa of Ávila · Saint Thérèse of Lisieux · Saint John Bosco · Saint Thomas More · Saint Francis de Sales · Saint Isidore of Seville · Saint Albert the Great · Saint Maximilian Kolbe · Saint John Paul II · Saint Teresa of Calcutta · Saint Elizabeth of Hungary · Saint Sebastian · Saint Pier Giorgio Frassati · Saint Mark · Saint Angela Merici · Saint John the Apostle · Saint Josemaría Escrivá · Saint Carlo Acutis. The saints John named on the call (Carlo Acutis, Angela Merici, Mark) stand in its tail block.
3. **The window source already exists and is the one the show runs on.** jobs/novena_contracts/resolver.py, `resolve_active_novenas(today)`, is the function runner/pass1_collect.py uses to select the night's novena episodes. Its window rule (_active_window): start = feast date + start_offset_days (−9 default), end = start + duration_days (9) − 1 — the nine days ending the day before the feast. Traditional-over-short-form priority is already applied inside this machinery (the 2026-11-04 alias work). The catalog: 279 feast-day contracts + 117 short-form contracts. A typical day carries about 10–12 active novenas (Sun 2026-11-08: 12 active per the nightly run report; a hand scan of the traditional fixed-date set found 10 for that date). Tier 2 reads from this same function — never a second window computation.
4. **The feast source is the devotional calendar.** Standing podcast rule: the podcast takes the saint of the day from the devotional calendar only — liturgical saints as named, all, never trimmed — and no saint on Sundays or other saintless non-roster days. Runner side, the day's celebration resolves through jobs/novena/liturgical_helpers.py (romcal_fetch_day) and the calendar the nightly job already uses. Tier 2's feast input comes from there, under the same rule.
5. **Saint identity is a solved problem in this codebase.** jobs/novena_contracts/saint_aliases.py provides canonical_saint_key / canonical_contract_id and alias groups across name forms and diacritics (contract "St. Teresa of Avila" ↔ invocation "Saint Teresa of Ávila"). The ladder resolver matches saints through this machinery, never by raw string.
6. **Constraints that stand (not design questions):** voice locked to avocado_v2:MAI_03, ElevenLabs excluded — a failed Meta-voice render stops the episode · traditional novena priority · endpoint freeze (RSS/Pages URLs, R2 audio host, Spotify IDs) · background bed on · all episodes for a day produced for date+2, published 12:00 AM CT.

### Scope Record

- **Outcome:** the Morning Prayer litany keeps its exact spoken form — Kyrie frame, one "Saint …, pray for us" per saint, the closing line — but the named saints are resolved nightly from the three tiers, so the prayer John hears changes with the calendar and the novenas while its shape never does.
- **In scope:**
  1. A saints-ladder data file in the runner repo holding the Tier 1 (core) and Tier 3 (patrons) membership — canonical saint keys plus the spoken invocation names — so John edits lists as data, with no code change.
  2. A resolver function: given the target date, it returns the one ordered invocation list (design below).
  3. The Morning Prayer contract customization John named: the Intercessory Litany block stops reading the static template file and takes the resolver's list. The static frame (Kyrie opening, "All holy men and women" closing) stays fixed text.
  4. Fixed-date tests, including the Carlo Acutis promotion case (2026-10-09) and an empty-Tier-2 day.
- **Out of scope:** the novena episodes themselves and which novenas run · every other Morning Prayer block and every other segment · the devotional calendar build · voice, render, and publish machinery · the static template file's other readers (it has none — the litany is its only use).
- **Affected users / surfaces:** John's Morning Prayer episode only (Ora Pro Nobis nightly run; the mirror repo Jctebo/ora-pro-nobis-runner carries documentation, production executes the fork's jobs/ tree).
- **The resolver, at scope level:**
  - Inputs: target date · the ladder data file (core list, patrons list) · `resolve_active_novenas(date)` for windows · the devotional-calendar saint(s) of the date for the feast input.
  - Placement: the feast saint(s) and every window saint stand in Tier 2. A patron stands in Tier 3 unless already placed higher that day. A core saint stands in Tier 1 (Q3 asks John to confirm core placement never moves; the sample applies that recommendation). Each saint is placed once, by canonical key, in the highest tier they qualify for — Tier 2 above Tier 3, per John's Carlo example.
  - Order inside the seamless prayer: Tier 1 in list order (the stable opening) · Tier 2 with the feast saint(s) first (calendar order), then window saints by feast-date proximity — the saint whose feast is nearest leads · Tier 3 in list order (the order John already prays them) · the closing line last. No tier name is ever rendered.
  - Special identities: a Marian title in a window (Our Lady of the Rosary, Our Lady of La Leche) and non-saint feasts with contracts (Christ the King) need an explicit rule — carried as Q5, recommended: no separate invocation; Mary is already invoked first, daily, as Holy Mary, Mother of God, and the litany invokes saints.
- **Where membership lives:** Tier 1 and Tier 3 are data (one JSON file in the runner repo; Plan settles the exact path and shape). Tier 2 has no membership data at all — it is computed nightly from the two standing sources, so a new novena contract or a calendar change flows into the prayer with no ladder edit.
- **A day with no Tier 2:** a date with no active window and no calendar saint (a Sunday whose windows have all closed, or a sparse ferial stretch) yields Tier 1 + Tier 3 + the closing line — a complete prayer, the fixed part of today's.
- **Length control:** the full catalog puts ~10–12 windows within reach of a day, so uncapped Tier 2 would swing the prayer by up to a dozen names daily. The window contribution is capped (Q4; recommended cap: 6 window saints; feast saints exempt — they are the calendar's own and few). Priority when the cap binds: patrons in a window first (they are John's), then the nearest feast. Under the recommendations a typical day lands at ~26–28 named invocations against 23 today; the worst case is ~31.
- **Acceptance criteria:**
  1. For any date, the Morning Prayer litany equals core + resolved Tier 2 + patrons, deduplicated by canonical saint key, each saint once, in the highest tier they qualify for, rendered in the current pray-for-us form between the unchanged opening and closing.
  2. Promotion case: on 2026-10-09 Saint Carlo Acutis appears exactly once, in the Tier 2 position; on a date outside his window he appears exactly once, in the patrons' position.
  3. A core saint is never duplicated and never displaced by an open window (per John's Q3 answer).
  4. A date with no active window and no calendar saint produces core + patrons + closing, well-formed.
  5. Editing the ladder data file changes the next nightly run's litany with no code change.
  6. The window saints in the litany for a date are exactly a subset of `resolve_active_novenas(date)` saints (plus the calendar feast saint(s)) — the prayer never invokes a novena the show is not running.
  7. Nothing else changes: same voice, same episode set, same endpoints; only the Intercessory Litany block's text source changes.

### Sample — the invocation for Friday, October 9, 2026

Computed by hand from the discovered sources (appendix below), under this section's recommended answers (core of five; cap 6; core never displaced; Marian windows folded into the opening Marian invocation). The same text stands standalone at ~/workspace/your_files/saints-ladder-sample.md.

> Litany of the Saints
> Lord, have mercy. / Lord, have mercy. / Christ, have mercy. / Christ, have mercy. / Lord, have mercy. / Lord, have mercy.
> Holy Mary, Mother of God, pray for us.
> Saint Joseph, pray for us.
> Saint Michael the Archangel, pray for us.
> Saint John the Baptist, pray for us.
> Saint Peter and Saint Paul, pray for us.
> Saint Denis and Companions, pray for us.
> Saint John Leonardi, pray for us.
> Saint Carlo Acutis, pray for us.
> Saint Teresa of Ávila, pray for us.
> Saint Gerard Majella, pray for us.
> Saint Margaret Mary, pray for us.
> Saint Luke, pray for us.
> Saint Thérèse of Lisieux, pray for us.
> Saint John Bosco, pray for us.
> Saint Thomas More, pray for us.
> Saint Francis de Sales, pray for us.
> Saint Isidore of Seville, pray for us.
> Saint Albert the Great, pray for us.
> Saint Maximilian Kolbe, pray for us.
> Saint John Paul II, pray for us.
> Saint Teresa of Calcutta, pray for us.
> Saint Elizabeth of Hungary, pray for us.
> Saint Sebastian, pray for us.
> Saint Pier Giorgio Frassati, pray for us.
> Saint Mark, pray for us.
> Saint Angela Merici, pray for us.
> Saint John the Apostle, pray for us.
> Saint Josemaría Escrivá, pray for us.
> All holy men and women, Saints of God, pray for us.

#### Appendix — tier computation for 2026-10-09

- **Tier 2 windows that day** (traditional contracts, the resolver's window rule — feast − 9 days through feast − 1): Our Lady of La Leche (feast Oct 11, day 8) · St. Carlo Acutis (feast Oct 12, day 7) · St. Teresa of Ávila (feast Oct 15, day 4) · St. Gerard Majella (feast Oct 16, day 3) · St. Margaret Mary (feast Oct 16, day 3) · St. Luke (feast Oct 18, day 1).
- **Tier 2 feast input** (devotional calendar, Oct 9 — both saints named that day, all, never trimmed): Saint Denis and Companions · Saint John Leonardi (optional memorials; calendar order).
- **Placement:** Our Lady of La Leche is a title of Mary → not invoked separately (Q5 recommendation); Holy Mary, Mother of God opens the prayer. Carlo Acutis: patron, promoted to Tier 2 by his window — John's own case. Teresa of Ávila: patrons' proposal (Tier 1 candidate under Q2), placed in Tier 2 by her window. Gerard Majella, Margaret Mary, Luke: Tier 2 by window. Denis and Companions, John Leonardi: Tier 2 by feast, first.
- **Tier 2 order:** Denis and Companions · John Leonardi (feast, calendar order) · Carlo Acutis (feast Oct 12) · Teresa of Ávila (Oct 15) · Gerard Majella (Oct 16) · Margaret Mary (Oct 16) · Luke (Oct 18). Window saints invoked: 5, under the recommended cap of 6.
- **Tier 3 after resolution:** the 18-name patrons' proposal (Q7) minus Carlo Acutis and Teresa of Ávila = 16 names, in John's current list order.
- **Tier 1:** the proposed core of five (Q1), in current order.
- **Total:** 5 + 7 + 16 = 28 named invocations + the closing line. Today's static prayer: 23 + the closing line.

### Question set for John

John asked to be asked — "particularly all the saints for each ladder." Every question carries a recommended answer; the membership tables are drawn from his current list, so he strikes or keeps rather than composes. Membership answers are scope-level decisions: Plan is written against them.

- **Q1 — Tier 1, the core.** Proposed, in order (each is both on your current list and in the traditional Litany of the Saints, in the prayer's opening block): Holy Mary, Mother of God · Saint Joseph · Saint Michael the Archangel · Saint John the Baptist · Saint Peter and Saint Paul. **Recommendation: approve the five as the fixed core** — the opening of the prayer then never changes shape.
- **Q2 — Tier 1 extension.** Two names on your current list are also traditional litany saints and sit late in today's prayer: Saint Teresa of Ávila and Saint John the Apostle. Do they join Tier 1? And do the archangels Saint Gabriel and Saint Raphael — traditional, but not on your current list at all — enter Tier 1? **Recommendation: add Teresa of Ávila and John the Apostle to Tier 1 (seven core); do not add Gabriel and Raphael — keep the core to saints you already pray daily.**
- **Q3 — A core saint inside a window.** When a Tier 1 saint's novena window is open (Teresa of Ávila, Oct 6–14; John Paul II is Tier 3, but Martin of Tours would behave the same if he were core): does the saint stay in the core position, or move to the Tier 2 position for the nine days? **Recommendation: stay.** The core block is the prayer's fixed anchor; the window changes what is added, never what is standing.
- **Q4 — Tier 2 breadth and the cap.** The resolver's full catalog gives ~10–12 open windows on a typical day (on Sun Nov 8: Leo the Great, Albert the Great, Andrew Avellino, Elizabeth of Hungary, Frances Cabrini, Gertrude, Giuseppe Moscati, Homobonus, Margaret of Scotland, Martin of Tours, and more). Rule A: every open window is eligible, capped. Rule B: only windows of saints on your lists (Tier 1 + Tier 3) enter, plus the feast saint. **Recommendation: Rule A with a cap of 6 window saints** — the prayer then carries the show's real novena life, bounded; feast saints are never capped out, and when the cap binds, patrons in a window come first, then the nearest feast.
- **Q5 — Marian windows and non-saint feasts.** Windows open for titles of Our Lady (of the Rosary, of La Leche, of Champion) and for Christ the King. **Recommendation: neither adds an invocation** — Mary is invoked first every day as Holy Mary, Mother of God, and the litany invokes saints; a Marian window does not name her twice.
- **Q6 — Feast saint and window saints together.** When the calendar saint differs from every window saint (Oct 9: Denis and John Leonardi, neither in a window), all are included — feast first. And on Sundays the calendar names no saint for the podcast, so Tier 2 is windows only. **Recommendation: yes to both — feast and window saints together, feast first; the standing Sunday rule holds.**
- **Q7 — Tier 3, the patrons of the show.** Every saint from your current list not placed in Tier 1, each with its reason — strike or keep each one:
  - Saint Carlo Acutis — patron of the show (your first name for this tier); patron of the internet and of youth.
  - Saint Angela Merici — a parish you have attended (your named reason).
  - Saint Mark — a parish you have attended (your named reason).
  - Saint Isidore of Seville — patron of the internet and computer users; fits the show and your work.
  - Saint Maximilian Kolbe — patron of media; he ran a publishing and radio apostolate.
  - Saint Josemaría Escrivá — founder of Opus Dei; your Opus Dei devotion.
  - Saint John Bosco — patron of youth; the coaching connection.
  - Saint Sebastian — patron of athletes; the coaching connection.
  - Saint Pier Giorgio Frassati — patron of young adults.
  - Saint Thérèse of Lisieux — patroness of missions.
  - Saint Francis de Sales — patron of writers and the press.
  - Saint Thomas More — patron of integrity in public and professional life.
  - Saint Albert the Great — patron of scientists and students (promotes to Tier 2 in his November window).
  - Saint John Paul II — (promotes to Tier 2 in his October window).
  - Saint Teresa of Calcutta — on your current list.
  - Saint Elizabeth of Hungary — on your current list (promotes to Tier 2 in her November window).
  - Saint Teresa of Ávila — also a Tier 1 candidate (Q2); if she does not enter Tier 1, she stands here.
  - Saint John the Apostle — also a Tier 1 candidate (Q2); if he does not enter Tier 1, he stands here.
  **Recommendation: keep all 18** — they are the list you already pray; the tier only gives the list its name and its promotion rule.
- **Q8 — Order.** **Recommendation: tiers run 1 → 2 → 3** (fixed core, then the day's saints, then the patrons, then the closing line); inside Tier 2, feast first, then nearest feast; inside Tier 3, your current list order. The alternative — patrons before the day's saints — puts your standing company ahead of the calendar's day.
- **Q9 — The sample.** Does the October 9 sample sound like the prayer you want — length (28 named invocations against 23 today), pacing, and the day's saints standing between the core and the patrons? **Recommendation: approve the shape; length feedback feeds the Q4 cap.**

### Run Directive

- **Scope only** (as registered). The package — this document and the sample — goes to John in the Ora Pro Nobis thread. Recommended level once the question set is answered: **Through Plan**, because his membership answers change the ladder data file and the resolver's placement rules, and Plan should be written against the settled answers. Plan does not open on the recommendations alone.

### Concerns and Information Needs

- **Facts (verified, with source):** the invocation is a static file block read verbatim into the Morning Prayer segment (config/publish/contracts/morning-prayer.json · intercessory-litany.txt · jobs/publish/contracts.py) · the 23-name current list stands in that template, with Carlo Acutis, Angela Merici, and Mark in its tail · the window source is resolve_active_novenas with the feast−9..feast−1 rule (jobs/novena_contracts/resolver.py), the same function the nightly job runs · the feast source is the devotional calendar under the standing podcast rule (calendar only; all named, never trimmed; no saint on Sundays) · identity matching exists as canonical keys + alias groups (jobs/novena_contracts/saint_aliases.py) · a hand scan of the traditional fixed-date contracts puts 10 windows open on 2026-11-08 against the nightly report's 12 active novenas (the difference is the short-form and non-fixed remainder).
- **Assumptions:** (a) "Highest tier" ranks Tier 2 above Tier 3 — John's Carlo example states exactly that case; the sample applies it. (b) Tier 1's rank against Tier 2 is not stated in John's words; the sample applies the Q3 recommendation (core never displaced) and Q3 puts the choice to him before any build. (c) "The novena window" means the windows of the novenas the show actually runs that night — the resolver's active set, traditional priority included — not every novena in existence.
- **Uncertainties:** Tier 1 extension (Q2) · Tier 2 breadth (Q4) · Marian and non-saint handling (Q5) — all John's calls, all carried in the question set with recommendations; none blocks the scope.
- **Decision impact:** Q4 changes the prayer's daily character most. Rule A makes the middle of the prayer turn over daily with names from the full catalog — saints John may not know (St. Homobonus, St. Giuseppe Moscati) stand beside his own. Rule B keeps Tier 2 to his saints, but a novena the show runs for a saint not on his lists would pass uninvoked in the Morning Prayer. The cap binds under either rule.
- **First source to check:** contracts/novenas/feast-days/st_carlo_acutis.json (feast Oct 12; window Oct 3–11) against the sample appendix.
- **Stop condition:** if John's answers change the outcome itself — a different segment, spoken tier markers, a different prayer form — the item returns to Scope and the answers are recorded as an amendment here. Membership edits alone do not reopen scope.

### Notes for the Curator

- Raw note: the fork's Python dependencies are not installed on this box (openai, catholic_mass_readings missing), so resolve_active_novenas could not be executed in this pass; the sample's windows were computed by hand from the contract JSON files under the resolver's own window rule, and the Nov 8 cross-check against the nightly report agrees within the expected short-form remainder. A Plan-phase test should run the resolver itself once the environment allows.
- Raw note: this document opens the runner fork's first releases/ folder — the runner had no release-document convention; the one-document standard was applied as-is, on branch release/v306 from the fork's HEAD (the shared tree's uncommitted edits were left untouched).

### Amendment — 2026-11-08 12:40 CT: John's answers (recorded by the Plan Agent from the settled record)

John answered the question set on 2026-11-08. The membership and rules below are settled; the outcome in the Scope Record is unchanged, and Scope does not reopen. The run level is set to **Through Plan** (the registry row's Run Directive now reads "Through Plan", verified by the Plan Agent at seating).

- **Q1 + Q2 — the core is NINE:** Holy Mary, Mother of God · Saint Joseph · Saint Michael the Archangel · Saint Gabriel the Archangel · Saint Raphael the Archangel · Saint John the Baptist · Saint Peter and Saint Paul · Saint John the Apostle · Saint Teresa of Ávila, in that insertion order (Gabriel and Raphael stand with Michael; John the Apostle follows Peter and Paul; Teresa of Ávila closes the core).
- **Q3:** a core saint inside a novena window STAYS in the core position — never displaced, never duplicated.
- **Q4:** Rule A, NO cap — every open novena window is eligible. (This supersedes the Scope section's recommended cap of 6; the length figures in the Scope Record that assumed the cap are superseded by the Plan's computed table.)
- **Q5:** Marian titles and non-saint feasts add NO invocation.
- **Q6:** feast saint(s) and window saints together, feast first; on Sundays Tier 2 is windows only.
- **Q7 — patrons, 16 kept:** Carlo Acutis · Angela Merici · Mark · Isidore of Seville · Maximilian Kolbe · Josemaría Escrivá · John Bosco · Sebastian · Pier Giorgio Frassati · Thérèse of Lisieux · Francis de Sales · Thomas More · Albert the Great · John Paul II · Teresa of Calcutta · Elizabeth of Hungary. Teresa of Ávila and John the Apostle are NOT patrons — Q2 moved them into the core. Patron order inside the prayer is the current list order (the order of the static template, which is also the approved sample's order).
- **Q8:** order core → the day's saints → patrons → closing. No tier names are spoken; the prayer stays seamless.
- **Q9:** the sample's shape is approved, with no notes.

### Amendment — 2026-11-08 (Plan pass): three Scope findings corrected against the trunk

Recorded by the Plan Agent; each correction is a mechanism correction only — no Scope outcome, membership, or acceptance criterion changes.

1. **Feast source mechanism (finding 4).** Production resolves the podcast's saint of the day through `jobs/publish/devotional_calendar_saint.py` — `resolve_saint_of_day(target)` (built 2026-11-05 for the Daily Reflection): the devotional calendar ICS is the only source inside its coverage (2026-11-06 – 2027-12-31), Sundays return no saint ever, liturgical entries name all their saints untrimmed, and roster entries resolve to a Principal. The romcal route named in finding 4 is the out-of-coverage fallback inside that same function. The rule finding 4 recorded — calendar only, all named, never trimmed, no saint on Sundays — stands exactly as written; the Plan builds on `resolve_saint_of_day`.
2. **Saint identity machinery (finding 5).** `jobs/novena_contracts/saint_aliases.py` and `canonical_saint_key` do not exist at trunk 4d94e0f (verified: tree search and full git-history search, no hits). Identity across name forms is NOT a solved import in this codebase: on 2026-10-09 the production resolver returns Teresa of Ávila twice in one day (traditional contract `st_teresa_of_avila` and short-form contract `teresa_of_jesus_of_avila_virgin`, both enabled, both in window). The ladder resolver therefore carries its own normalization and an explicit alias map inside the ladder data file (Plan §2). The Scope Record's design intent — match by canonical identity, never by raw string — is preserved; the mechanism is built in this release instead of imported.
3. **The worked example's count (John's answers record, "Effect on the Oct 9 sample").** The recompute to 30 rested on the Scope pass's hand scan, which covered the traditional fixed-date contracts only. Run against the production resolver (the Scope Record's own chosen source), 2026-10-09 returns **11 runtimes**: the six hand-scanned windows plus short-form windows for John XXIII (feast Oct 11), Callistus I (Oct 14), Hedwig of Silesia (Oct 16), and Ignatius of Antioch (Oct 17), and Teresa of Ávila in both her forms. Under John's settled rules the day yields **34 named invocations** (9 core + 10 Tier 2 + 15 patrons), not 30. The four added saints stand in the Plan's verification set (§2). Membership, rules, and the approved sample shape are unchanged; only the arithmetic and the length expectations move, to the Plan's computed table.

## 2 · Plan

- **Agent:** Plan Agent — v306 (seated 2026-11-08 by the main seat; Plan claimed and passed 2026-11-08)
- **Inputs read:** skills/plan/SKILL.md · skills/phase-workflow/references/release-document-standard.md · §1 Scope as passed (record 1028, commit 18d343b) with the amendments above · ~/workspace/your_files/v306-saints-ladder-scope.md (the settled record, in full) · the v306 registry row (ora-pro-nobis, row id 550, risk medium, Run Directive "Through Plan") · config/publish/contracts/morning-prayer.json · config/publish/templates/morning-prayer/intercessory-litany.txt · jobs/publish/contracts.py (block normalization ~L351–522, validation ~L607–660, `resolve_block_content` L1598+, fragment expansion L1994+) · jobs/publish/devotional_calendar_saint.py · jobs/novena_contracts/resolver.py · jobs/novena_contracts/contracts.py (FeastRule.feast_date, load_novena_contracts) · runner/pass1_collect.py (collect(): build_audio_jobs at L183, resolve_active_novenas at L303) · the novena catalog (397 contracts loaded) · production resolver runs for 2026-10-09 and 2026-11-08, and a full-catalog feast-date computation for 2026–2027, all under the repo venv (~/workspace/scratch-daybuild/nv-venv)
- **Trunk base for Implement:** fork HEAD **4d94e0f** (branch release/v306 already stands on it). Production executes the fork's jobs/ tree; there is no separate deploy artifact.

### The contract change — where the invocation is built today

The Morning Prayer contract's "Intercessory Litany" sequence holds one block, kind `file`, path `config/publish/templates/morning-prayer/intercessory-litany.txt`. At build time, `runner/pass1_collect.py` `collect(target)` calls `jobs.publish.audio.build_audio_jobs(contracts, target_date=target)`; block text resolves through the single seam `jobs/publish/contracts.py::resolve_block_content(block, contract, entry, target_date, runtime_context)` — the `file` branch reads the template verbatim. Block kinds are a closed set, admitted in three places in the same file: normalization (~L413), `_validate_entry_blocks` (~L616), and `resolve_block_content` / fragment expansion.

**Chosen approach — a new deterministic block kind, `saints-litany`:**

1. `config/publish/contracts/morning-prayer.json`: the Intercessory Litany block becomes `{"kind": "saints-litany", "fallback_file": "config/publish/templates/morning-prayer/intercessory-litany.txt"}`. The template file stays in place and becomes the fallback (below).
2. `jobs/publish/contracts.py`: admit `saints-litany` in normalization and validation (no file-existence requirement; the fallback path is validated instead), and add its branch in `resolve_block_content`: call the ladder resolver for `effective_date` and return the rendered litany text.
3. The fallback is structural, not a seam: the branch wraps the resolver call so that ANY failure — data file missing or invalid, window resolution error, calendar read error, an implausibly short result (fewer names than core + patrons) — returns the fallback file's text and prints a warning line into the run output. The episode never blocks on the ladder. The nightly report's litany source (resolver | fallback) is named in the job-sheet change (step 7).

**Options rejected.** (a) Pre-generating the litany into a template file before the contract build, contract unchanged: writes generated state into the repo tree at runtime, and a failed generation silently leaves yesterday's file in place — a worse failure mode than the fallback above, and invisible in the contract. (b) Routing the litany through the model-seam (texts-needed / pass1b merge) like daily-intro: the litany is deterministic data, not model prose; the seam adds a model dependency and a fallback-flag path for text that must be exact. (c) Computing the list in pass1 and injecting it as an `inline` block by rewriting the loaded contract in memory: the contract on disk would no longer describe the episode, and validation tooling would never see the real block.

### The resolver — jobs/publish/saints_ladder.py (new)

Public surface: `resolve_invocations(target: date) -> list[str]` (spoken invocation names, in prayer order) and `render_litany(target: date) -> str` (the full block text). Pure functions of the date plus the data file; no state.

**Inputs.**
- The ladder data file (below): core list, patrons list, window-name map.
- Windows: `jobs.novena_contracts.resolver.resolve_active_novenas(target)` — the production function, consumed in its returned order (feast date ascending, the resolver's own tie-break). This is the same call pass1 makes for the night's novena episodes, so the prayer can never invoke a novena the show is not running (acceptance criterion 6 holds by construction).
- Feast: `jobs.publish.devotional_calendar_saint.resolve_saint_of_day(target)["saints"]` — the calendar's liturgical saints for the date, in calendar order; empty on Sundays by that module's absolute rule, which is exactly John's Q6 Sunday rule, inherited rather than re-implemented. The roster `principal` is NOT a feast input (decision + alternative in Concerns).

**Identity.** Each saint carries a canonical key produced by one normalization function in the module: NFKD-fold diacritics, lowercase, strip a leading "Saint/St./Pope", cut trailing descriptors after the first comma, collapse non-alphanumerics. Runtime saints are matched first by contract saint id, then by normalized name, against the data file's match lists. This is what dedupes Teresa of Ávila's two simultaneously active contract forms into one invocation, and what folds "St. Gertrude Prayer" and "St Corona Novena Against Pandemics" onto their saints.

**Resolution rule (John's answers, exactly).**
1. Core first, in data order. A core key is placed once and is sticky: no later input moves or repeats it (Q3).
2. Feast saints next, in calendar order, skipping any key already placed (a core saint on their own feast day stays in the core position) and skipping Mary (her key is the core's first entry; a calendar Marian naming adds nothing, Q5).
3. Window saints next, in resolver order: each runtime resolves through the window-name map to a canonical key + spoken name, or to an exclusion (Marian title · feast of the Lord · devotion that is not a saint · collective already covered by the closing line), or to UNMAPPED. Exclusions are skipped (Q5). A key already placed is skipped. A patron's key placed here is the promotion — the patron simply does not appear again in step 4 (John's Carlo rule, generalized).
4. Patrons last, in data order, skipping keys already placed.
5. No cap anywhere (Q4). No tier name is ever rendered (Q8).

**Unmapped window identities** (a future contract whose saint is not yet in the map): skipped, never guessed, and collected into a warnings list that pass1 prints into the run output — the main seat sees it in the nightly report and the map gains an entry by data edit. The prayer stays well-formed in the meantime.

**Rendering.** `render_litany` wraps the names in the current template's exact frame: the title line, the six Kyrie lines, one two-line invocation per name ("<Name>," / "pray for us."), and the closing "All holy men and women, Saints of God," / "pray for us." The frame literals live in the module, copied from the template; a test pins the frame byte-for-byte against the template's frame lines so the two can never drift silently.

**Performance note.** `resolve_active_novenas` costs ~44 s per call in this environment (each romcal-mode contract rebuilds calendar data; measured: 397 contracts load in ~23 s, one resolver call ~44 s). pass1 already pays it once at L303. Step 5 wires pass1 to compute the runtimes once and inject them through the `runtime_context` the expansion already threads (`runtime_context["saints_ladder_windows"]`); the `saints-litany` branch prefers injected runtimes and computes its own only when absent (tests, tooling). The nightly run therefore pays the resolver cost once, as today.

### The ladder data file — config/publish/saints-ladder.json (new)

One JSON file, three parts; John edits membership as data, no code change (acceptance criterion 5):

- `core`: 9 entries in prayer order — Holy Mary, Mother of God · Saint Joseph · Saint Michael the Archangel · Saint Gabriel the Archangel · Saint Raphael the Archangel · Saint John the Baptist · Saint Peter and Saint Paul · Saint John the Apostle · Saint Teresa of Ávila. Each entry: `key`, `spoken` (the full name line, e.g. "Holy Mary, Mother of God", "Saint Peter and Saint Paul"), `match_ids` (contract saint ids), `match_names` (name forms as they appear in contracts and the calendar).
- `patrons`: the 16 kept patrons in current list order — Thérèse of Lisieux · John Bosco · Thomas More · Francis de Sales · Isidore of Seville · Albert the Great · Maximilian Kolbe · John Paul II · Teresa of Calcutta · Elizabeth of Hungary · Sebastian · Pier Giorgio Frassati · Mark · Angela Merici · Josemaría Escrivá · Carlo Acutis — same entry shape.
- `window_names`: the catalog map, keyed by contract saint id (name-normalized fallback): either `{"spoken": ..., "key": ...}` for a saint, or `{"excluded": "marian" | "lords-feast" | "devotion" | "collective"}`. Implement builds it by sweeping all 397 contracts (776 contract-year windows over 2026–2027) and classifying every distinct saint identity; the sweep output is checked into the Implement record so Review can audit classifications. Known non-obvious entries the sweep must get right: `st_gertrude_prayer` → Saint Gertrude · the Corona and Dymphna devotion contracts → their saints' keys (same-saint merges) · `dedication_of_the_lateran_basilica` → excluded (not a saint) · Our Lady of La Leche / Fatima / the Forsaken / Hope, Queen of the Apostles titles → excluded: marian · Ascension / Epiphany / Nativity / Holy Name of Jesus → excluded: lords-feast · 54 Day Rosary, Impossible Requests Annunciation, Pope's Repose and New Pope → excluded: devotion · All Saints → excluded: collective (the closing line already invokes them) · Holy Innocents and named companion groups (Denis and Companions class) → saints, invoked as named.

### Length under Rule A with no cap — computed

Method: every contract's feast date computed from the production FeastRule for 2026 and 2027 (776 windows, zero failures), windows applied under the resolver's own rule (feast + start_offset_days, duration_days long), identities deduped by the normalization above; eligibility adjustments measured on the probe days against the production resolver itself (2026-10-09: 11 runtimes → 9 distinct identities → 8 eligible window saints; 2026-11-08: 12 runtimes → 12 distinct → 11 eligible). The one selector-bearing contract (contracts/novenas/families/standard-9-day.json) resolves through romcal at runtime and can add at most a saint on days it fires; it flows through the same `resolve_active_novenas` output in production and is inside the probe-day counts.

- **Window identities per day (all contracts):** median 10 · mean 9.5 · 90th percentile 13–14 · max 20 (May 7–9).
- **Eligible Tier 2 window saints:** typical ≈ 8 · measured probe range 5 (Dec 21) to 11 (Nov 8) · peak 12 (May 7: Andrew Bobola, Brendan, Corona, Damien of Molokai, Dymphna, Isidore the Farmer, John of Ávila, Louise de Marillac, Matthias, Nereus and Achilleus, Pancras, Sophia of Rome — 20 identities less 6 exclusions less 2 same-saint merges).
- **Feast input:** 0 on Sundays; otherwise the calendar's named saints, typically 1, at most 2.
- **Total named invocations:** floor **25** (core + patrons only — reached in production on the last days of December, an artifact of the resolver computing feast dates within the current year only, so early-January feasts cast no December windows; inherited unchanged, see Concerns) · typical **≈ 33** (working range 31–35) · peak **≈ 38**.
- **Spoken length:** the current template measures 231 frame characters + 34 characters per invocation; at the show's prayer pace (~13.5 chars/s) one invocation ≈ 2.5 s. Today: 23 names ≈ 75 s of litany. Under the ladder: floor 25 ≈ 80 s · typical 33 ≈ 103 s · peak 38 ≈ 113 s. **The Morning Prayer grows by roughly +30 s on a typical day and +40 s at peak** — the direct consequence of Q4's no-cap rule, stated here as the fact John asked Plan to compute. Episode totals stay well inside the show's existing length envelope; no other segment changes.

### Verification set (pinned in tests)

1. **2026-10-09 (Fri) — the worked example, corrected count 34.** Core: the nine, in order. Tier 2: Saint Denis and Companions · Saint John Leonardi (feast, calendar order) · Saint John XXIII · Saint Carlo Acutis · Saint Callistus I · Saint Hedwig of Silesia · Saint Gerard Majella · Saint Margaret Mary · Saint Ignatius of Antioch · Saint Luke (windows in resolver order; Teresa of Ávila's two contract forms both active — she stands in the core only; Our Lady of La Leche excluded as Marian). Patrons: the 15 (Carlo promoted out). Total **34**. Carlo stands exactly once, in the Tier 2 position — acceptance criterion 2.
2. **2026-11-08 (Sun) — today, old vs new.** Old rule: the static 23 names of the current template, in template order. New rule: core 9 · Tier 2 windows only (Sunday — no feast input): Saint Leo the Great · Saint Andrew Avellino · Saint Martin of Tours · Saint Josaphat · Saint Frances Cabrini · Saint Homobonus · Saint Albert the Great · Saint Gertrude · Saint Giuseppe Moscati · Saint Margaret of Scotland · Saint Elizabeth of Hungary (the Dedication of the Lateran Basilica runtime excluded — not a saint; Albert the Great and Elizabeth of Hungary promoted from the patrons) · patrons 14. Total **34**.
3. **Empty Tier 2 (fixture).** Window source returns nothing, feast source returns no saints: the output is core 9 + patrons 16 = **25** names between the unchanged frame lines, well-formed (acceptance criterion 4). The nearest real days are the last days of December (production floor above).
4. **Core saint in a window — 2026-12-21 (Mon).** Saint John the Apostle's window is open (feast Dec 27, window day 4): he stands in the core, position 8, once. Tier 2: Saint Peter Canisius (the day's calendar saint) · Saint Anastasia · Saint Andrew · Holy Innocents · Saint Stephen · Saint Thomas Becket (windows; Impossible Requests Annunciation, the Nativity, and the Holy Family runtimes excluded). Patrons: all 16 (none promoted, none in a window that day). Total **31** (acceptance criterion 3).

### Steps for Implement (in order; each traces to §1)

1. Build `config/publish/saints-ladder.json`: core + patrons as settled above; the window-name sweep over all 397 contracts with classifications (Scope Record items 1–2; amendment 2's identity mechanism).
2. Write `jobs/publish/saints_ladder.py`: data load + validation, identity normalization, `resolve_invocations`, `render_litany` (Scope Record items 2–3).
3. Wire the `saints-litany` block kind in `jobs/publish/contracts.py` (normalization, validation, `resolve_block_content` branch with the structural fallback) and switch the Morning Prayer contract's Intercessory Litany block to it (Scope Record item 3).
4. Wire pass1: compute `resolve_active_novenas(target)` once in `collect()`, inject via `runtime_context`, print ladder warnings (unmapped identities) into the run output (Plan performance note).
5. Tests (below), run in the repo venv; scoped suites green before the phase passes.
6. Job-sheet change text (step 7) handed to the main seat with the Implement report — Implement does not edit the sheet itself.

### Tests

- `tests/test_saints_ladder.py` (new, fast, sources stubbed — no romcal): the four verification cases above · the Teresa two-forms dedupe · a patron promotion case outside the pinned days · Marian and lords-feast exclusions · an unmapped identity skipped with a warning · a broken/missing data file raising inside the resolver and the contracts branch falling back to the static template text · a data-edit case (a name added to patrons in a fixture copy changes the output — acceptance criterion 5) · the frame byte-pin against the template.
- One integration test (same file, marked slow): the real `resolve_active_novenas` + `resolve_saint_of_day` for 2026-10-09 and 2026-11-08 in the repo venv, asserting the pinned lists end to end (~45 s per date is why this is two dates, not a sweep).
- Gate suites (risk-based, medium): the new test file plus the publish-contract and novena-contract test files in tests/; full-suite position per the standing catch-up counter — this release does not by itself force a full run, but the integration test must run in the venv, not the system python (the system python lacks the repo dependencies — the Scope pass's Curator note).
- Gate evidence discipline: tallies read from the complete log file, never from truncated run output.

### Classification, Review placement, ship shape

- **Classification: shared-core / production contract.** The change alters the nightly production contract's text source for a daily episode. **Review runs BEFORE the trunk landing**, against the pinned verification set, with the sweep classifications audited.
- **Ship shape:** merge release/v306 to the fork trunk (base 4d94e0f) after Review passes; production executes the fork tree, so the merge is the ship — the first nightly run after the merge produces date+2 under the new resolver. Registry flip in the app (Live + shipped record + What's New) per the standard flip. The mirror repo Jctebo/ora-pro-nobis-runner carries no jobs/ tree (v300 finding): the Ship record notes the data file + module as fork-only, and any docs mirror follows the standing pattern — John's call, not assumed.
- **First-run watch (binding on Ship):** on the first produced day under the new resolver, read back the Morning Prayer script's litany (pass1's script-morning-prayer.txt) and diff it against `resolve_invocations(target)` recomputed independently; record both in the Ship section. Any mismatch, or a fallback firing, is fixed forward before the next night's run — never silently.
- **Job-sheet change (step 7, applied by the main seat at Ship):** the nightly Ora job sheet gains (a) the first-run read-back above for the first produced day, and (b) a standing report field naming the litany source for the produced day (resolver | fallback — a fallback night is reported, with the warning lines, not hidden).
- **Migration:** none. **Data change:** one new data file; no existing data touched. **Rollback / fix-forward:** revert the contract block to kind `file` (one JSON edit) or revert the merge — code-only, effective for unproduced days (production is date+2); episodes already produced keep their rendered text, which is correct in both directions.
- **Merge-slot note:** release/v306 stands alone on the Ora line; drift risk concentrates in `jobs/publish/contracts.py` (shared by every publish contract) — Implement rebases onto the then-current fork HEAD and re-verifies the three block-kind touch points before building.

### Outputs

- This Plan section + the §1 amendments, committed on release/v306 and published to the app (key `release-doc-v306-saints-ladder`).
- Settled for Implement: the contract change (new `saints-litany` kind at the `resolve_block_content` seam), the resolver design (inputs, identity, the five-step resolution rule), the data file shape, the computed length table, the four-case verification set, the test matrix, Review-before-landing, and the first-run watch. Plan stops here per the run level (Through Plan); Implement does not start.

### Concerns and Information Needs

- **Facts (verified, with source):** the litany is a `file` block resolved verbatim through `resolve_block_content` (morning-prayer.json · contracts.py L1598+) · `resolve_active_novenas` returns 11 runtimes for 2026-10-09 and 12 for 2026-11-08 under the repo venv, including both of Teresa of Ávila's contract forms on Oct 9 (production runs above) · `resolve_saint_of_day` returns the calendar's liturgical saints with Sundays always empty (devotional_calendar_saint.py, `calendar_saint_for`) · no alias/canonical-key module exists at 4d94e0f (tree + history search) · window distribution computed from all 397 contracts' FeastRules for 2026–2027 (776 windows, zero failures) · template measures 231 frame chars + 34 chars per invocation.
- **Assumptions:** (a) The roster Principal is not a feast input (decision below). (b) Patron order inside the prayer is the current template order — the order of the approved sample's tail and of John's Q8 answer ("current list order"). (c) The ~13.5 chars/s speech rate used for the length table is the show's observed TTS pace class; the table's name counts are exact, the seconds are estimates within ±10%.
- **Uncertainties:** the classifications inside the window-name sweep (a handful of contracts name devotions, collectives, and feasts of the Lord in saint clothing) are Implement's build-time judgment, audited at Review against the classes named in this Plan; a misclassification changes one name on some days, never the prayer's shape.
- **Decision impact:** (a) **Roster Principal** — Plan settles: NOT invoked as a feast saint (it is a private-devotion roster entry, not the day's feast; the approved sample never showed one). If John prefers otherwise, the change is one rule in the resolver plus test updates — it would add a name on most ferial days and lengthen the typical day by ~1. Flagged for John at the Plan gate; the default stands unless he directs. (b) **The December floor** — the resolver's same-year feast computation means late-December days get few or no window saints (early-January feasts cast no windows backward across the year boundary). The ladder inherits this because Tier 2 is defined as the novenas the show runs; fixing the year boundary belongs to the novena machinery and is out of this release's scope (§1). If John wants December full, that is a separate item against `resolve_active_novenas`, not a ladder change.
- **First source to check:** the production resolver output for the target date (repo venv) — every verification case above was built from it, and the first-run watch diffs against it.
- **Stop condition:** any finding that the ladder needs a change to the novena episodes themselves, to another segment, or to voice/render/publish machinery returns the item to Scope and John (§1 stop condition). A data-file classification dispute does not stop the line — it is settled at Review.

### Notes for the Curator

- Raw note: the Scope pass could not execute `resolve_active_novenas` (its Curator note cites missing dependencies on this box). The dependencies exist in the runner venv at ~/workspace/scratch-daybuild/nv-venv — the Scope pass did not find it, and its hand scan silently covered only the traditional fixed-date contracts, which is how the settled record's Oct 9 count (30) came out four names light against production (34). Lesson class: for Ora work, "the environment cannot run it" should name the runner venv check before a hand scan is trusted; the Plan phase caught it only because the tasking named length as a fact to compute.
- Raw note: Teresa of Ávila's traditional and short-form contracts are BOTH enabled and simultaneously in window (2026-10-09 production run) — if the show is not supposed to air two forms of one saint's novena on the same day, that is a catalog question outside this release; the ladder dedupes her either way. Flagged here for the record, not actioned.

### Amendment — 2026-11-08 (Plan pass, post-gate): the identity machinery exists as uncommitted work in the shared fork checkout

Correction to §1 amendment 2 and to this section's identity design, recorded the same day, after a full-tree search of the shared checkout completed post-gate:

- `jobs/novena_contracts/saint_aliases.py` EXISTS in the shared fork checkout (~/workspace/projects/spotify_praylist-fork, branch muse-draft-week, working tree): it provides `canonical_saint_key` (L314) and `canonical_contract_id` (L293); the checkout's `resolver.py` is modified (+170 lines, uncommitted) to import it and apply canonical-id traditional priority; `pipeline.py` is also modified; `tests/test_novena_saint_aliases.py` and `tests/test_novena_traditional_priority.py` stand beside it, uncommitted. This is the 2026-11-04 alias work. NONE of it is committed on any branch (`git log --all` shows no commit touching the file), so it is absent from trunk 4d94e0f and from this release branch — the only sense in which §1 amendment 2's statement holds. The Scope Agent's finding 5 was accurate about the tree it read.
- Production behavior follows the working tree: the Ora job sheet runs the fork at ~/workspace/projects/spotify_praylist-fork. Run under the repo venv, the working-tree resolver returns **10 runtimes for 2026-10-09 — Teresa of Ávila once, traditional form** — against 11 (Teresa twice) from the committed resolver used in this Plan's verification runs. The duplicate-forms fact in §1 amendment 2 and in this section's Concerns is therefore a committed-tree fact, not a production fact.
- Nothing in the verification set or the length table changes: the ladder dedupes by canonical key under either resolver, so every pinned list and total stands verbatim (Oct 9 = 34 · Nov 8 = 34 · Dec 21 = 31 · floor 25 · typical ≈ 33 · peak ≈ 38). The year distribution's identity counts may overcount by one on days when an alias pair with unlike name forms shares a window (Teresa's two forms; a handful of saints, ≤9 days a year each) — inside the stated ranges.
- **Design consequence for Implement (supersedes steps 1–2 where they conflict):** the ladder consumes `canonical_saint_key` / `canonical_contract_id` from `jobs.novena_contracts.saint_aliases` instead of growing a second identity system — PROVIDED the alias changeset is committed to the fork trunk first. That commit is not this release's to make silently: the changeset is a coherent, tested body of work standing uncommitted in a shared tree, and release/v306 is based on the committed 4d94e0f. Implement's seating must first reconcile the base with the Coordinator / main seat: either the alias work lands on trunk and release/v306 rebases onto it (the ladder then imports the machinery; the module's own normalization survives only for name forms the alias table does not cover), or the main seat rules the alias work out of the production tree, in which case this Plan stands as written. Landing v306 in a way that overwrites the uncommitted resolver work is forbidden either way.
- The Plan phase record (1031) stands passed at commit aff3aca; this amendment rides the next document commit, per the amendment rule.
