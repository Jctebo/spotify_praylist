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
