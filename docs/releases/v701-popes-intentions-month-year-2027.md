# v701 — Pope's monthly intentions: month+year keying + the 2027 list

- **Status:** PLAN (§§1–2) — Plan seat: chain-v701-plan. No code in Plan.
- **Base:** main `b0334b4` (the v699 ship record).
- **Direction (John, 2026-11-27, verbatim):** "Can you review the structure of the code and make sure it is month year and then find and add pope leos intentions for next year"
- **John's recollection, verified TRUE:** the intentions are keyed by MONTH ALONE, and the data covers one year only (§1.2, §1.4).

## §1 Scope

### 1.1 What this release does

1. Re-key the Pope's monthly prayer intention lookup from MONTH ALONE to MONTH+YEAR at the one seat that holds intention text (§1.2).
2. Carry the standing twelve files over unchanged under their true year: **2026** (§1.4).
3. Add Pope Leo XIV's twelve monthly intentions for **2027**, from the official publication (§1.5), written in the standing files' house shape (§2.2).
4. Honest failure: a (month, year) with no entry fails honestly — never a silent fall-back to the same month of another year (§2.3).

### 1.2 The seat and the consumers (grounded in this tree)

**One data seat, one lookup implementation, two working copies of one repo.** The fork (`~/workspace/projects/spotify_praylist-fork`, branch `muse-draft-week`) and the standing clone (`~/workspace/projects/ora-pro-nobis/standing-clone`, branch `main`) are two checkouts of the same GitHub repo `Jctebo/spotify_praylist`; the intention files are byte-identical in both (verified: `diff` on `january.txt` — no difference). All edits land in the standing clone's release worktree and push to that repo; the fork checkout picks them up on its next pull. There is NO second implementation to fix.

**The data seat:**

- `config/publish/templates/morning-prayer/monthly-intention/<monthname>.txt` — twelve files: `january.txt` … `december.txt`. Month name alone. No year anywhere in the path, the file names, or the file contents.

**The contract seat:**

- `config/publish/contracts/morning-prayer.json` — the Morning Prayer entry's "Petitions" sequence carries one block:
  ```json
  { "kind": "monthly_template",
    "folder": "config/publish/templates/morning-prayer/monthly-intention",
    "selector": "current_calendar_month" }
  ```
  No `skip_if_missing` flag on this block (see §1.3 for what that means).

**The lookup (the ONLY consumer of the files) — `jobs/publish/contracts.py`:**

- `evaluate_selector()`, contracts.py:767–781. For selector `current_calendar_month` / `month` (line 780–781):
  ```python
  return date_value.strftime("%B").lower()
  ```
  The date's MONTH NAME only. The year is discarded here — this is the exact point where the key loses the year.
- `resolve_block_content()`, contracts.py:1689–1697 (kind `monthly-template`; kinds are normalized, `monthly_template` → `monthly-template`):
  ```python
  month_name = evaluate_selector(block.get("selector", "current_calendar_month"), target_date=effective_date, ...)
  template_file = template_path / f"{month_name}.txt"
  return _read_text_file(str(template_file))
  ```
  Lookup expression, in full: `Path(folder) / f"{target_date.strftime('%B').lower()}.txt"`.
- `_read_text_file()`, contracts.py:796–802: a missing file raises `PublishMissingDataError("Publish template file not found: …")`.
- The fragment-expansion path calls the same resolver: contracts.py:2144–2166 (`_expand_audio_fragments_from_block`, kind `monthly-template`) — fragment key `…/monthly-template/<monthname>`. Same lookup, no second keying.
- Validation seats that touch the block but do NOT resolve a month file: contracts.py:382–388 (normalize: folder + selector required), contracts.py:641–650 (the folder must exist). Neither reads a month file; neither keys anything.
- `skip_if_missing` machinery: contracts.py:1673 + 1803–1810 — when a block sets `skip_if_missing`, a `PublishMissingDataError` becomes a stderr WARN and empty text. The Morning Prayer block does NOT set it (§2.3 keeps it unset).

**Downstream consumers (no keying of their own — they inherit the seat's):**

1. **The nightly podcast Morning Prayer episode.** `build_text_jobs` / the publish pipeline composes the Morning Prayer script from the contract; the monthly-intention fragment stands in the Petitions sequence. The composed script is narrated as the Morning Prayer episode (Spotify feed). Lookup shape: the seat's, via `target_date` = the episode's day.
2. **The app, via the episode.** `jobs/push_episodes_to_app.py` pushes each published day's episodes into the app: audio staged via `POST /api/agent/player/episodes/audio`, episode text (`script-<episode_id>.txt`) via `POST /api/agent/player/episodes/text` (push_episodes_to_app.py:49–56; `morning-prayer` is a named episode family, line 99). The intention reaches the app ONLY as spoken/text content inside the Morning Prayer episode. No separate intention payload, no app-side lookup.
3. **The app's Universal Prayer (Mass scroll) — NOT a consumer of this data.** `app/worker/src/client.ts`, `massUniversalSectionHtml()` (client.ts:9114 ff.), composition order fixed at v527: the Pope line stands FIRST under "Parish Intentions" — but it is a FIXED string, client.ts:9107:
   ```js
   var MASS_UP_POPE = 'For the Holy Father, Pope Leo XIV.';
   ```
   It names the Pope; it carries NO monthly intention text, no month table, no year. Searched `app/worker/src/client.ts` and `app/worker/src/index.ts` for the standing intention strings, a monthly table, and Pope-intention data seats: none exist. App D1 holds no monthly-intention table (the Worker's intention rows are John's own prayer intentions — `prayer_intentions` — and the Universal Prayer per-date lists, migration 0039; neither is the Pope's monthly intention). **The app seat needs NO app code change in this release** — proven by the fixed string above plus the negative search. The app's day build does not compose the Universal Prayer from any monthly source.
4. **Legacy Notion page-audio path — NOT a live consumer.** `jobs/notion/generate_page_audio.py` historically carried a `monthly-intention` special fragment with a provider fall-back (release doc 0.0.5.5). It is not in the current publish path for the Morning Prayer episode (the contract pipeline above is) and holds no month-keyed intention data of its own. Named here so Implement does not chase it; no change.

### 1.3 Current failure behavior (the standing honest state)

Because the Morning Prayer block does not set `skip_if_missing`, a missing month file raises `PublishMissingDataError` and the Morning Prayer text job fails — the day build stops loudly rather than narrating a wrong intention. That loud failure is the seat's standing honest state, and §2.3 preserves it under the new key.

### 1.4 Standing data: coverage and provenance — the true year is 2026, Pope Leo XIV

- **Coverage:** twelve files, one per month, NO year dimension. Under the month-only key they serve EVERY year — January 2027 would narrate the January file's text. That collision is the defect John named.
- **Whose intentions:** Pope Leo XIV's **2026** intentions. Proof by topic match against the published 2026 list (Hallow's Pope Leo intentions collection; Society of Jesus, jesuits.global):
  - Jan — file: "prayer with the Word of God may nourish our lives" ↔ 2026 Jan: *For prayer with the Word of God*. ✔
  - Feb — file: "children with incurable diseases and their families" ↔ 2026 Feb: *For Children with Incurable Diseases*. ✔
  - Mar — file: "effective disarmament may advance … dialogue over violence" ↔ 2026 Mar: *For Disarmament and Peace*. ✔
  - Aug — file: "the Gospel may be proclaimed effectively in urban communities" ↔ 2026 Aug: *evangelization in the city* (jesuits.global). ✔
  - Sep — file: "water may be managed justly and shared equitably" ↔ 2026 Sep: *For the Care of Water*. ✔
  - Oct — file: "the Church may grow in mental health ministry" ↔ 2026 Oct: *For Mental Health Ministry*. ✔
  - The remaining six (Apr priests in crisis · May sufficient food · Jun sports for peace · Jul human life protected · Nov wealth for the common good · Dec preparing hearts to receive Christ) stand in the same series and the same hand; no topic matches any 2025 (Pope Francis) intention.
- **The files are house compositions, not the official text.** Each file wraps the month's official intention topic in a petition sentence — "For the Holy Father's \<Month\> intention: that …, we entrust … through \<the month's traditional devotion\>" (January → the Holy Name of Jesus; June → the Sacred Heart; July → the Precious Blood; October → Our Lady of the Rosary; December → the Immaculate Conception). The 2027 files must be written in this same shape (§2.2) — the official text is the source for the intention clause, never pasted raw.
- **Git history gives no earlier provenance:** the folder enters this repo's history in one step (merge 317cb4396, 2026-08-20, PR #109) with the current text already in place; there is no earlier year of files to recover.

### 1.5 The 2027 source — official, complete, all twelve months verified

- **Source:** Vatican News, "Pope releases prayer intentions for 2027", published 2026-01-30 — Pope Leo XIV entrusted the 2027 intentions to the Pope's Worldwide Prayer Network at that day's audience. Official page: `https://www.vaticannews.va/en/pope/news/2026-01/pope-worldwide-prayer-network-2027-intentions.print.html` (direct fetch from this session was blocked; the text below was read from the verbatim Vatican News republication at en.abouna.org, "Pope releases prayer intentions for 2027", and cross-checked line-by-line against two further republications of the same Vatican News article — explorecatholic.nl and heraldmalaysia.com — with no divergence).
- **Completeness:** ALL TWELVE months stand published. No month is missing; nothing in §2.2 rests on a secondary roundup, a prediction, or the 2026 text.
- **The twelve, exactly as published** (heading phrase, then the "Let us pray" sentence):

  - **JANUARY** — "That the power of prayer might be discovered. Let us pray that everyone in the Church might discover the power of prayer as a personal encounter with the Lord that transforms our hearts and the world."
  - **FEBRUARY** — "That those who care for others might receive care. Let us pray that those who care for the holistic health of others might receive the support they need, and that with patience, wisdom, and fortitude, they might open avenues of inner healing and hope."
  - **MARCH** — "That the dignity of human life might be respected. Let us pray that in a culture focused on productivity and instant results, we might be capable of discovering and appreciating the unique dignity of each person, both our own and that of others."
  - **APRIL** — "That art might be a gift that humanizes. Let us pray that art might be perceived as a true gift that humanizes us, lifts up the spirit, and helps us contemplate God's beauty in creation."
  - **MAY** — "That there be job opportunities for everyone. Let us pray that technological development might open dignified work opportunities, and that intergenerational collaboration might bring a future in which every person can put their talents at the service of the common good."
  - **JUNE** — "For the good use of artificial intelligence. Let us pray that artificial intelligence might always be developed to serve human dignity and that we might know how to use it wisely."
  - **JULY** — "For grandparents and the elderly. Let us pray that members of the Church might always appreciate the treasure of faith and wisdom offered to us by grandparents and the elderly, and be willing to learn from their experience."
  - **AUGUST** — "For the vocation of young people. Let us pray that young people in search of their own vocation might recognize in Jesus Christ a companion on the way to whom they can open their hearts."
  - **SEPTEMBER** — "For integral ecological conversion. Let us pray that we might learn how to live in a new relationship with creation, protecting it with justice, and that, in contemplating creation, we might find the path toward a more harmonious and grateful existence."
  - **OCTOBER** — "For Christian communities. Let us pray that each parish, community, or Christian group might be a center of missionary outreach that forms new disciples at the service of the Gospel."
  - **NOVEMBER** — "For the integration of migrants. Let us pray that, accompanied and comforted by the Holy Family on their own journey of being uprooted, migrants and displaced persons might find communities that welcome them with dignity, solidarity, and true integration."
  - **DECEMBER** — "For the Christian vocation of the family. Let us pray that Christian families might be living witnesses of the Gospel in society, and that they might learn more and more how to be hearths where faith, hope, and love are cultivated."

## §2 Plan

### 2.1 The fix shape — month+year at the seat

**Data shape (prescribed):** one year folder per year under the seat —

```
config/publish/templates/morning-prayer/monthly-intention/
  2026/january.txt … december.txt      (the standing twelve, moved unchanged)
  2027/january.txt … december.txt      (new, §2.2)
```

The contract block's `folder` stays `config/publish/templates/morning-prayer/monthly-intention`; the year becomes part of the resolved path, not of the contract. (Equivalent named shapes — `<year>-<month>.txt` flat files — are acceptable only if the lookup and every check below read the same shape; the year-folder shape is the recommendation because the folder-exists validation at contracts.py:641–650 keeps working unchanged and a year's completeness is visible at a glance.)

**Lookup code (prescribed, contracts.py only):**

1. Add a selector value `current_calendar_month_year` to `VALID_SELECTOR_VALUES` (contracts.py:59) and to `evaluate_selector()` returning `f"{date_value.year}/{date_value.strftime('%B').lower()}"` — or, equivalently, resolve the year inside the `monthly-template` branch from `effective_date.year`. One of the two; name the pick in the Implement report. The month-only selector `current_calendar_month` keeps its current meaning for any other block (no other contract uses `monthly_template` today — searched all `config/publish/contracts/*.json`: morning-prayer.json is the only one).
2. `resolve_block_content()` monthly-template branch (contracts.py:1689–1697): `template_file = template_path / f"{month_year}.txt"` under the new selector — i.e. `…/monthly-intention/2027/january.txt` for a January 2027 target date.
3. `config/publish/contracts/morning-prayer.json`: the block's `selector` becomes `current_calendar_month_year`. `folder` unchanged. `skip_if_missing` stays ABSENT (§2.3).
4. The fragment key (contracts.py:2155) picks up the year with the selector value (`…/monthly-template/2027/january`) — no separate change; verify in the checks (§2.4, leg B).

**No store migration:** the data is files in the repo; D1 holds no intention table (§1.2.3); nothing else reads the folder (searched repo-wide for `monthly-intention` / `monthly_intention` outside contracts.py, the contract JSON, tests, and old release docs: no other live reader).

**App seat: NO app code change** (§1.2.3). The app receives the corrected intention inside the Morning Prayer episode audio/text exactly as today. `MASS_UP_POPE` stands unchanged — it names the Pope and carries no monthly text, so no year keying applies to it. Any future release that puts the month's intention TEXT into the Universal Prayer is a new scope, not this one.

### 2.2 The 2027 files — house shape, official substance

Each 2027 file is ONE sentence in the standing shape:

```
For the Holy Father's <Month> intention: that <the month's intention, from §1.5>, we entrust <this intention / them> to God through <the month's traditional devotion>.
```

Rules for the Implement seat that writes them:

- The intention clause carries the §1.5 substance faithfully — the heading phrase and the "Let us pray" sentence fused into the "that …" clause, no topic dropped, no topic added. Where the official heading is a "For …" phrase (Jun–Dec), it converts to the "that …" clause on the same words.
- The entrustment clause reuses the SAME month's devotion as the 2026 file for that month (the devotions are the months' traditional dedications — Holy Name of Jesus, Holy Family, Saint Joseph, Divine Mercy/Eucharist, Blessed Virgin Mary, Sacred Heart, Precious Blood, Immaculate Heart of Mary, Holy Angels, Our Lady of the Rosary, Holy Souls in Purgatory, Immaculate Conception) — read each from the standing 2026 file for that month; do not invent new ones.
- One file per month, lower-case month name, `2027/<monthname>.txt`, single trailing newline as the standing files stand.
- Review quote-matches every 2027 file's intention clause against §1.5 before Ship (§2.4, leg C).

### 2.3 The honest-failure rule (per consumer) — AMENDED by John's formal approval, Q4 A (see §2.7)

- **The seat / podcast pipeline (AMENDED):** a (month, year) with no file no longer fails the Morning Prayer job. Under Q4 A, the monthly-intention block is OMITTED from the composed Morning Prayer — the rest of the prayer composes normally — and the omission is FLAGGED through the pipeline's standing stderr WARN channel, the flag naming the missing year+month. NEVER: fall back to the same month of another year, to the nearest year, or to a default intention. A January 2028 build (no 2028 data yet) composes with no Holy Father's-intention passage and a recorded flag naming 2028/january — that flag is the prompt to add the next year's list, exactly as this release adds 2027. This omit+flag behavior is scoped to the `monthly_template` block ONLY, by a named marker on that block; every other block's missing-data behavior is unchanged — `PublishMissingDataError` stands elsewhere. (The original Plan fork — the hard `PublishMissingDataError` at this seat — is superseded by John's approved Q4 A pick; see §2.7.)
- **The app episode leg:** inherits the pipeline's failure — no episode is pushed for a day whose build failed; the app never receives a wrong-year intention. No app-side empty state is needed because the app holds no intention data (§1.2.3).
- **The app Universal Prayer:** unaffected by construction — its Pope line is fixed text, not a lookup; there is no lookup to fail.

### 2.4 Checks prescribed (all must run at Review; fixtures from production data per the standing rule)

Fork seat — extend `tests/test_publish_contracts.py` (the standing publish-contracts suite; the monthly-template test at line 565 is the shape to follow). New/extended tests:

- **Leg A — collision (must FAIL on the old code):** `build_text_jobs` / `resolve_block_content` for the Morning Prayer entry at `target_date = 2027-01-15` returns the 2027 January text and NOT the 2026 January text; at `target_date = 2026-01-15` returns the standing January text verbatim. On the old month-only code both dates return the same file — the leg cannot pass pre-fix.
- **Leg B — carry-over identity:** for all twelve months, resolution at a 2026 date returns byte-identical text to the pre-move standing files (fixture: the twelve standing file contents, named production source = the files themselves at base `b0334b4`); the fragment key for a 2026 date carries `2026/<month>` and for a 2027 date `2027/<month>`.
- **Leg C — 2027 quote-match:** for all twelve months, resolution at a 2027 date returns the new file, and each file's intention clause quote-matches §1.5's published text for that month (the check names §1.5 / the Vatican News page as its source; Review additionally spot-reads at least January and June against the live source page).
- **Leg D — honest failure:** resolution at `target_date = 2028-01-15` raises `PublishMissingDataError` naming the 2028 path; the Morning Prayer job fails; no text is produced. Also: with the 2027 folder temporarily absent in a temp-root fixture (the line-565 test's shape), the same failure — never a 2026 fall-back.
- **Leg E — full Morning Prayer composition:** `test_resolve_text_jobs_uses_weekday_and_month_selectors`-shaped leg at a 2027 date: the composed Morning Prayer text contains the 2027 intention sentence inside the Petitions sequence and no 2026 intention text anywhere.

App seat — **no harness-v701.mjs**: there is no app change to harness (§2.1). The app leg of Review is a read-back only: after the first post-ship 2027-dated day build, the pushed Morning Prayer episode text in the app carries the 2027 January sentence (via the episode text seat, §1.2.2). If the ship happens while all built days are still 2026, this leg defers to the first January 2027 build and is named as a field leg, not waived.

### 2.5 Risks

- **R1 — Wrong-year narration is silent today.** Until this ships, every 2027 Morning Prayer would narrate 2026 intentions with no error anywhere. The closer to 2027-01-01, the hotter this is; the release should ship before the first January 2027 day build.
- **R2 — House-shape drift in the 2027 files.** A file pasted raw from the official text would change the prayer's voice and break the Petitions flow; §2.2's shape rule + Leg C guard it.
- **R3 — Selector blast radius.** `evaluate_selector` is shared by every contract; the change must ADD a selector value, never change `current_calendar_month`'s meaning (other kinds — weekday-map etc. — resolve through the same function). Leg B + the standing suite guard it.
- **R4 — The fork checkout.** The fork working copy (`muse-draft-week`) is where nightly work is often run from; it must pull the re-keyed tree before its next Morning Prayer build, or it will fail honestly (missing year path under the OLD folder shape is not possible — old code + new tree = old code looks for `<month>.txt` at the folder root and fails loudly, since the files moved into `2026/`). That loud failure is acceptable and self-announcing; a silent mixed state is not possible. Ship notes must name the pull.
- **R5 — 2028 cliff.** The honest failure (§2.3) means the first January 2028 build fails until the 2028 list is added. That is the designed behavior; the failure message names the missing file. (A future release may add a December warning; not this scope.)

### 2.6 Ordered Implement seat list

1. **Seat 1 — data move + 2027 data (fork/app repo, one tree):** `git mv` the twelve standing files into `monthly-intention/2026/` unchanged; write the twelve `monthly-intention/2027/` files per §2.2. Commit separately from code.
2. **Seat 2 — lookup re-key:** contracts.py selector + monthly-template branch (§2.1 items 1–2) and morning-prayer.json selector (§2.1 item 3). One commit.
3. **Seat 3 — checks:** the §2.4 fork tests (Legs A–E) in `tests/test_publish_contracts.py`; run the full publish-contracts suite plus the standing suite's Morning Prayer legs. No app harness (named, §2.4).
4. **Review:** quote-match spot-read (Leg C), the collision leg read-back (Leg A on old vs new code), R4 pull note in the ship record.
5. **Ship:** merge to main, push (read-back: main pushed · remote in sync); the app episode field leg (§2.4) named in the ship record as standing until the first 2027-dated build.

**Open items:** none on data — the 2027 list stands fully published, all twelve months (§1.5). The only standing field leg after Ship is the first-2027-build episode read-back (§2.4).

### 2.7 Amendment — John's formal approval (2026-11-27 10:42 CT)

- **Approval record:** John, 2026-11-27 10:42 CT, on scope document `scope-popes-intentions-2027` — **Q1: A · Q2: A · Q3: A · Q4: A · Q5: A · Q6: A · run level: To Ship.**
- Q5 (2027 in the standing petition form) and Q6 (2026 re-keyed unchanged) match what the first Implement built — no change.
- **Q4 A supersedes the Plan's original §2.3 fork:** the hard `PublishMissingDataError` for a missing (year, month) intention is REPLACED by omit+flag at the `monthly_template` block only (§2.3 as amended above). §2.4 Leg D is rewritten to the Q4 shape in the amendment Implement (§3.1).
- Q1's third seat — the voice-fragment cache key — is proven in the amendment Implement (§3.1): the fragment key carries the year, and the audio fragment cache cannot serve a fragment across years.

## §3 Implement record

- **Status:** IMPLEMENTED — Implement seat: chain-v701-impl. Built exactly per §§1–2; no app change, no D1 change. Not merged, not pushed (Ship is a later seat).
- **Plan pick (§2.1 item 1):** the selector option — a new selector value `current_calendar_month_year` added to `VALID_SELECTOR_VALUES` and to `evaluate_selector()`, returning `f"{year}/{monthname}"` from the target date. `resolve_block_content()`'s monthly-template branch resolves `template_path / f"{month_year}.txt"`; the fragment-expansion branch reuses the same value, so fragment keys carry the year (`…/monthly-template-2027-january`). `current_calendar_month`'s meaning is untouched. The Morning Prayer contract block's selector is now `current_calendar_month_year`; `folder` unchanged; `skip_if_missing` stays absent.

### Seat 1 — data (both checkouts, identical trees)

- `git mv`: the standing twelve files moved unchanged to `monthly-intention/2026/<month>.txt`. Byte-identity proof: md5 of every file identical before and after the move (e.g. january `3e5d90888b90b34f2d1a7b6f4fbb6b13`, december `a15361dbdac43b6e235b19ab2f752c29`; git recorded all twelve as pure renames), and Leg B asserts byte-identity against the base-`b0334b4` contents in the suite.
- Twelve new `monthly-intention/2027/<month>.txt` files in the standing house shape (§2.2): the intention clause carries §1.5's official text for that month; the entrustment clause reuses the same month's 2026 devotion verbatim (Holy Name of Jesus · Holy Family · Saint Joseph · Divine Mercy/Eucharist · Blessed Virgin Mary · Sacred Heart · Precious Blood · Immaculate Heart of Mary · Holy Angels · Our Lady of the Rosary · Holy Souls in Purgatory · Immaculate Conception). One sentence per file, single trailing newline. November keeps the official clause's own punctuation ("that, accompanied and comforted by the Holy Family …") verbatim from §1.5.

### Seat 2 — lookup re-key (both checkouts)

- `jobs/publish/contracts.py`: selector added (above); monthly-template branches in `resolve_block_content()` and `_expand_audio_fragments_from_block()` use the year-carrying value. A missing (year, month) file still raises `PublishMissingDataError` from `_read_text_file` naming the missing path — verified live: a 2028-01-15 build raises `Publish template file not found: …/monthly-intention/2028/january.txt`. No fall-back to another year anywhere.
- `config/publish/contracts/morning-prayer.json`: the monthly_template block's selector is `current_calendar_month_year`.

### Seat 3 — checks (both checkouts, `tests/test_publish_contracts.py`)

Five new tests, Legs A–E as prescribed in §2.4, fixtures named in-test (2026 fixture = the standing files at base `b0334b4`; 2027 quote-match source = §1.5 / Vatican News 2026-01-30):

- **Leg A** `test_monthly_intention_collision_resolves_by_year` — Jan 2026 returns the standing text verbatim; Jan 2027 returns the 2027 text. **Fail-on-old proof:** the new test run against the pre-change tree (base `b0334b4` worktree + the new test file) FAILS (old contract selector is month-only; both dates resolve the same file).
- **Leg B** `test_monthly_intention_2026_carry_over_byte_identical` — all twelve 2026 months resolve byte-identical; on-disk bytes equal fixture + newline; fragment keys end `monthly-template-2026-january` / `monthly-template-2027-january`.
- **Leg C** `test_monthly_intention_2027_quote_matches_published_list` — all twelve 2027 months resolve in house shape and contain §1.5's phrases verbatim plus the month's devotion.
- **Leg D** `test_monthly_intention_missing_year_fails_honestly` — 2028-01-15 resolution and full `build_text_jobs` raise `PublishMissingDataError` naming `2028/january.txt`; in a temp root with only `2026/january.txt` present, a 2027 lookup raises naming `2027/january.txt` (no fall-back).
- **Leg E** `test_morning_prayer_2027_composition_carries_2027_intention` — full Morning Prayer composition at 2027-01-15 contains the 2027 January sentence and none of the twelve 2026 sentences.

### Test tallies

- **Standing-clone worktree (release/v701):** `tests.test_publish_contracts` — 28 ran, **OK** (23 standing + 5 new). Full CI set (`.github/workflows/contract_validation.yml`: publish_site + spotify_contracts + publish_contracts + publish_local_state) — 52 ran, 51 pass, **1 failure pre-existing and unrelated**: `test_spotify_contracts.test_repository_playlists_match_approved_prayer_membership_and_order`, which fails identically on the untouched base `b0334b4` (playlist membership/order; no v701 path touched).
- **Fork (muse-draft-week):** `tests.test_publish_contracts` — 28 ran, 25 pass; all 5 v701 tests pass. **3 failures pre-existing and unrelated**, each verified failing on the fork's pre-v701 head `53593dd52` with the pre-v701 test file: `test_load_publish_contracts_reads_rewritten_contracts`, `test_render_publish_template_and_episode_id_are_date_scoped`, `test_resolve_text_jobs_uses_weekday_and_month_selectors` — all from the fork's diverged "Morning Offering (Extended)" contract titles. The fork's other CI modules: 24 ran, 1 failure — the same pre-existing spotify playlist test.

### Commits

- **Standing-clone worktree, branch release/v701** (not merged, not pushed):
  - `c0c656b` — data: 2026 move (pure renames) + 2027 twelve.
  - `6527ec0` — lookup re-key: contracts.py selector + branches, morning-prayer.json selector.
  - `fb1fda1` — checks: Legs A–E.
  - (§3 record commit follows this section.)
- **Fork, branch muse-draft-week** (local-only, never pushed): `acce7a5dd` (data) · `84aa8f2e0` (lookup) · `ea0f90d24` (checks) — identical trees to the worktree for every touched path (verified by recursive diff). The release doc does NOT go to the fork. Per Plan R4, the fork still needs its normal pull discipline at Ship; the identical local commits here mean its tree already matches.
- **Untouched:** v700's fork working files (wallpaper and other dirty/untracked paths) — no file collision met; nothing outside this release's seats was modified in either checkout.
- **Deviations from Plan:** none. The two pre-existing failure sets above are reported, not fixed — outside this release's scope.

## §3.1 Amendment Implement record (2026-11-27, after John's formal approval)

- **Status:** AMENDMENT IMPLEMENTED — Implement seat: chain-v701-impl (amendment). Approval: John, 2026-11-27 10:42 CT, scope document `scope-popes-intentions-2027`, Q1–Q6 all A, run level To Ship (§2.7). Q5/Q6 matched the first Implement — no change. Not merged, not pushed (Ship is a later seat).

### Q4 build — omit + flag at the monthly_template block only

- **Contract marker:** `"omit_if_missing": true` on the Morning Prayer `monthly_template` block in `config/publish/contracts/morning-prayer.json` — the only block carrying it. `_normalize_block()` (contracts.py, monthly-template branch) normalizes the marker for that kind only; no other block kind reads it.
- **Code seat:** `resolve_block_content()`, monthly-template branch (contracts.py): the file read is wrapped — on `PublishMissingDataError`, a block carrying the marker returns `""` (the sequence composition drops the empty block; the fragment expansion likewise yields no fragment) instead of raising. An unmarked monthly_template block, and every other block kind, still raises exactly as before. No fall-back to another year's file anywhere.
- **Flag channel (grounded):** composition has no warnings list on its result — warnings surface as `WARN …` lines printed to **stderr** in the pass logs (the standing channel: the `skip_if_missing` handler and the saints-litany fallback both print there). Q4 uses that channel. Flag line, verbatim from a live 2028-01-15 composition:
  ```
  WARN missing_monthly_intention entry=morning-prayer-elevenlabs year=2028 month=january reason=Publish template file not found: …/monthly-intention/2028/january.txt
  ```
  The flag names the missing year and month (`year=2028 month=january`) and the missing path.

### 2028 composition proof (Q4 shape)

- `build_text_jobs` at 2028-01-15 **succeeds**. The Morning Prayer text contains NO "For the Holy Father's …" passage and none of the twelve 2026 sentences; the flag above stands recorded on stderr.
- Petitions section excerpt from that 2028 composition (intention block omitted; the rest composes normally): "Petitions. / In union with the Church and all the angels and saints, / For the healing and sanctification of families, for reconciliation where there is division, … / For the sanctification and strength of marriages, … / For the conversion of sinners, especially those in positions of influence, …"

### Q1 third seat — voice-fragment cache-key proof

- **Fragment keys (from `build_audio_jobs`, January):** 2026 → `block-3/sequence-2/monthly-template-2026-january`; 2027 → `block-3/sequence-2/monthly-template-2027-january`. The name key carries the year — no month-only fragment key stands in the expansion path.
- **The on-disk audio cache** (`jobs/publish/fragments.py`, used by the nightly build via `jobs/publish/audio.py` → `render_fragment_audio`) is keyed by `fragment_content_hash` = SHA-256 of the fragment's sanitized **text** + audio role + TTS settings, and the cache path is built from that hash alone. January 2026 hash `cad1f9cca4be587358a629b0173c3ebb850542fcc1215926ec596a144a24c70c` ≠ January 2027 hash `7ec40faee8d4fa8caf714de2cfb9925182d327deac9cbc992c18f9d3c83af4ad` — different cache paths (`fragments/ca/d1/…` vs `fragments/7e/c4/…`). Because the 2026 and 2027 January texts differ, a fragment rendered for January 2026 can never serve a January 2027 build; the episode-level `audio_manifest_hash` additionally binds the year-carrying fragment key. **Proof shape (i) stands, strengthened: both the name key and the content-hash cache key separate the years. No re-key was needed; no month-only key exists in the audio path.**

### Checks — Leg D rewritten, suite re-run in both checkouts

- **Leg D** is now `test_monthly_intention_missing_year_omits_and_flags`: 2028 resolution returns `""` with the flag recorded naming 2028/january; the full 2028 Morning Prayer composes with no Holy Father's-intention passage; in a temp root with only `2026/january.txt` present, a marked 2027 lookup returns empty + flag (never the 2026 text) and an **unmarked** block still raises `PublishMissingDataError` naming `2027/january.txt`. Legs A/B/C/E unchanged.
- **Standing-clone worktree (release/v701):** `tests.test_publish_contracts` — 28 ran, **OK**.
- **Fork (muse-draft-week):** `tests.test_publish_contracts` — 28 ran, 25 pass, **3 failures pre-existing and unrelated** — the same set recorded in §3 (`test_load_publish_contracts_reads_rewritten_contracts`, `test_render_publish_template_and_episode_id_are_date_scoped`, `test_resolve_text_jobs_uses_weekday_and_month_selectors`; the fork's diverged "Morning Offering (Extended)" titles). All v701 legs pass in both checkouts.

### Amendment commits

- **Standing-clone worktree, branch release/v701** (not merged, not pushed): `e595219` — approval record + §2.3/§2.7 amendment. `fa6e51c` — Q4 build (contracts.py marker + branch, morning-prayer.json marker, Leg D rewrite). (§3.1 record commit follows this section.)
- **Fork, branch muse-draft-week** (local-only, never pushed): `c8c9c93ad` — Q4 build, same three touched paths as the worktree commit (the fork's pre-existing title/llm-backstop divergence in those files is untouched). The release doc does not go to the fork.
- **Untouched:** v700's fork working files — no collision; nothing outside this release's seats was modified in either checkout.
- **Deviations from the amendment brief:** one, named — Task 3's shape (i) assumed the audio cache keys off the fragment/tag name; the traced cache in fact keys off the fragment **content hash** (text + TTS settings), with the year-carrying fragment key bound at the episode-manifest level. The conclusion the approval names — a January 2026 fragment can never serve January 2027 — is proven on both keys; no re-key was built because no month-only key exists.

## §4 Review

- **Status:** REVIEWED — Review seat: chain-v701-review (re-seated after John's formal approval amended the release mid-chain). Light Review: independent re-runs and read-backs, no fixes made. **Verdict: PASS.**

### Independent verification (Review's own runs/reads)

1. **Data.** Review hashed all twelve `2026/` files against the standing files at base `b0334b4`: **12/12 byte-identical** (sha256). Twelve `2027/` files exist; Review read all twelve against §1.5 — every intention clause carries the published text for its month (November keeps the official clause's own leading comma). Entrustment devotions script-checked: **12/12 identical** to the same month's 2026 file; every 2027 file is one sentence with a single trailing newline. One checked-and-cleared note, **not a defect**: April's entrustment pronoun is "this intention" where 2026 reads "them" — the 2026 pronoun referred to priests (plural); the 2027 April intention is art (singular), the devotion itself ("the Eucharistic presence of Christ and His Divine Mercy") is verbatim, and §2.2 binds the devotion, which stands exact.
2. **Lookup.** Review read the full `contracts.py` + `morning-prayer.json` diff vs `b0334b4`: `current_calendar_month_year` added to `VALID_SELECTOR_VALUES` and `evaluate_selector()` returning the date's own `<year>/<monthname>`; `resolve_block_content()` and the fragment-expansion branch both resolve through that value; `current_calendar_month` is unchanged; fragment keys take the `monthly-template-2027-january` form (confirmed live in item 4).
3. **Q4 (approved behavior).** `morning-prayer.json`'s monthly_template block carries `"omit_if_missing": true` and **no** `skip_if_missing` (grep: 0 occurrences). Review composed Morning Prayer itself at **2028-01-15**: build **succeeds** (4 text jobs), the script carries **no** "For the Holy Father's…" passage, and stderr carries `WARN missing_monthly_intention entry=morning-prayer-elevenlabs year=2028 month=january reason=Publish template file not found: …/monthly-intention/2028/january.txt`. At **2027-01-15** the 2027 January intention stands in the composition, the 2026 January text is absent, and no WARN is emitted. An **unmarked** monthly_template block at 2028-01-15 still raises `PublishMissingDataError` in Review's own call — the omit+flag is scoped to the marker, exactly as the amended Leg D asserts.
4. **Cache-key proof (re-derived).** Review loaded `jobs/publish/fragments.py` and recomputed from the real audio jobs: the on-disk fragment cache keys on `fragment_content_hash` (SHA-256 of sanitized text + audio role + TTS settings) and `fragment_cache_path` is built from that hash alone — the fragment name is not a cache key. January 2026 fragment: key `block-3/sequence-2/monthly-template-2026-january`, hash `cad1f9cca4be587358a629b0173c3ebb850542fcc1215926ec596a144a24c70c`; January 2027: key `block-3/sequence-2/monthly-template-2027-january`, hash `7ec40faee8d4fa8caf714de2cfb9925182d327deac9cbc992c18f9d3c83af4ad` — hashes and cache paths differ, fragment keys carry the year, and neither `fragments.py` nor `audio.py` contains any month key (no `monthly` reference at all). No month-only key exists in the audio path.
5. **Tests (Review's own re-runs, `tests.test_publish_contracts`).** Standing-clone worktree (release/v701): **28 ran, OK** — full pass, Legs A–E included. Fork (muse-draft-week): **28 ran, 25 pass, 3 failures** — exactly the named pre-existing set (`test_load_publish_contracts_reads_rewritten_contracts`, `test_render_publish_template_and_episode_id_are_date_scoped`, `test_resolve_text_jobs_uses_weekday_and_month_selectors`, the fork's diverged "Morning Offering (Extended)" titles); all five v701 legs pass in both checkouts.
6. **Cross-checkout + scope.** Recursive diff: data trees identical; test file identical; `morning-prayer.json` and `contracts.py` carry identical v701 content — the only differences are the named pre-existing fork divergences (contract titles in the JSON; the v580 LLM-backstop block present in the worktree's `contracts.py` only), untouched by this release. Worktree touched paths vs base are exactly the release's seats (24 data files, `contracts.py`, `morning-prayer.json`, the test file, this doc); fork commits touch the same paths. No app files, no D1, nothing outside the seats.

### Verdict

- **PASS.** No defects found. The release matches §§1–2 as amended by John's formal approval (§2.7, Q1–Q6 all A, To Ship): month+year keying at the one seat, 2026 carried byte-identical, the 2027 list in house shape, omit+flag at the marked block only with no cross-year fall-back anywhere, and both fragment keys separating the years.
- **Standing field leg (unchanged from §2.4):** after Ship, the first 2027-dated day build's pushed Morning Prayer episode text in the app carries the 2027 January sentence — named, not waived.
- **Ship note (Plan R4):** the fork checkout already carries the identical v701 commits locally; its normal pull discipline still applies at Ship.
