# v703 — Auxilium Christianorum Double Introduction — Plan

- **Release:** v703 · Ora Pro Nobis line · Plan seat: chain-v703-plan (contract 1258)
- **Date:** 2026-11-27
- **Defect:** the Auxilium Christianorum episode opens with TWO day-introduction paragraphs back to back. The saint announcement stands twice before "Our help is in the name of the Lord."
- **Ship shape (verdict up front):** FORK-ONLY. Both composition seats are in the fork pipeline (`~/workspace/projects/spotify_praylist-fork`, branch `muse-draft-week`). No app change, no pin.
- **Fix (verdict up front):** ONE opening. The contract's standing `liturgical_announcement` block retires for the Auxilium episode type; the Auxilium's own `prayer_intro` opening survives unchanged in shape. Exact seat: §2.1.

## §1 Grounds

### 1.1 The defect in production (verbatim, 2026-11-27)

`~/workspace/ora-runner-runs/2026-11-27/script-auxilium-christianorum.txt`, head, after the standing welcome line ("Welcome to Ora Pro Nobis. Where we pray with the saints."):

- Paragraph 1 (standing episode day-intro): "Today is Friday, November 27, 2026, Friday of the thirty-fourth week in Ordinary Time. The Church celebrates Sts. Basileus, Auxilius and Saturninus, martyrs, held today as a private devotion from the Roman Martyrology. Liturgical season: Ordinary Time."
- Paragraph 2 (the Auxilium's own opening reflection): "As we begin the Auxilium Christianorum prayers, the Church celebrates Sts. Basileus, Auxilius and Saturninus, martyrs, held today as a private devotion from the Roman Martyrology. Their steadfast witness strengthens us. We ask Our Lady, Help of Christians, to guard our families and to obtain for us perseverance and trust in Christ."
- Paragraph 3 begins the fixed prayer sequence: "Our help is in the name of the Lord."

Same shape on 2026-11-25 (`~/workspace/ora-runner-runs/2026-11-25/script-auxilium-christianorum.txt`): paragraph 1 "On Wednesday, November 25, 2026, in Ordinary Time, the Church celebrates Saint Catherine of Alexandria, Virgin and Martyr. We gather under the help of Mary, Help of Christians, and seek her protection for the Church." — then paragraph 2 "As we begin the Auxilium Christianorum prayers, the Church celebrates Saint Catherine of Alexandria, Virgin and Martyr. Her steadfast witness strengthens us against every evil. …" The saint announcement stands twice on both dates. The defect is structural, not a one-day model slip.

### 1.2 Block A — the standing episode day-intro (`liturgical_announcement`)

- **Contract seat:** fork `config/publish/contracts/auxilium-christianorum.json` — entry `auxilium-christianorum`, `blocks[0]`: `{"kind": "liturgical_announcement", "title": "Liturgical Announcement"}`; contract metadata carries `liturgical_announcement: {calendar: "general_roman", locale: "en", include_season: true}`.
- **Resolver seat:** fork `jobs/publish/contracts.py`, block-kind dispatch `if kind == "liturgical-announcement":` (≈L1790) → `build_liturgical_announcement_text(effective_date, calendar=…, locale=…, include_season=…)`.
- **Template seat:** fork `jobs/publish/liturgical_announcement.py` · `build_liturgical_announcement_text` — deterministic template: `"Today is {date_display}."` + `"Today the Church celebrates {_join_with_and(names)}."` + (when `include_season`) `"Liturgical season: {season_label}."` Names come from romcal via `romcal_fetch_day`.
- **Runner seam:** in the nightly runner this fragment kind is a model seam — fork `runner/pass1_collect.py`: `SEAM_KINDS` includes `"liturgical-announcement"`, `SEAM_PURPOSE["liturgical-announcement"]` = "Liturgical announcement: date, weekday, and the day's celebration." Pass 1 registers block `auxilium-christianorum/liturgical-announcement` in `texts-needed.json` with the deterministic builder text as fallback; the seam author supplies the produced paragraph (2026-11-27 `texts-provided.json`, block `auxilium-christianorum/liturgical-announcement` = paragraph 1 in §1.1, verbatim). Fallback on file for 2026-11-27: "Today is Friday, November 27, 2026. Today the Church celebrates Friday of the thirty-fourth week of Ordinary Time. Liturgical season: Ordinary Time." — the fallback announces the day too; the duplication does not depend on the seam author.

### 1.3 Block B — the Auxilium's own opening reflection (`prayer_intro`)

- **Contract seat:** same contract file — `blocks[1]`: `{"kind": "prayer_intro", "title": "Prayer Intro", "prayer_title": "Auxilium Christianorum prayers", "devotion": "Auxilium Christianorum", "profile": "auxilium-christianorum"}`; contract metadata carries `prayer_intro: {calendar: "general_roman", locale: "en", prompt_model: "gpt-4.1-mini", temperature: 0.4, allow_missing_gospel: true}`.
- **Resolver seat:** fork `jobs/publish/contracts.py` · `_resolve_prayer_intro_content` (≈L943) → `_shared_intro_context` → `build_devotional_intro(profile="auxilium-christianorum", …)`.
- **Profile/template seat:** fork `jobs/publish/devotional_intro.py`:
  - `AUXILIUM_CHRISTIANORUM_PROFILE` — purpose: "Lead from the liturgical announcement into the Auxilium Christianorum prayers, placing the listener, families, and the needs of the day under Mary's protection."
  - `validate_devotional_intro` REQUIRES the intro to identify the selected observance for every non-novena profile: `if profile.key != "novena" and selected_observance and not _contains_any(rendered, (selected_observance,)): raise RuntimeError("Intro must identify the selected observance.")` A prayer intro that does not name the saint FAILS validation and falls back.
  - The deterministic fallback announces it too: `_fallback_text`, auxilium branch — "As we enter the {prayer_title}, {timing_sentence} … We carry the grace of {theme} into prayer, placing ourselves, our families, and the needs of this day under Mary's protection.", where `_observance_timing_sentence` yields "Today the Church celebrates {name}." for a same-day observance.
  - Prompt guidance for the profile (`build_devotional_intro_prompt`): "Connect the observance to Christ's victory, grace, holiness, perseverance, protection of family and vocation, … Mary as Help of Christians, or the intercession of the saints … Give one simple intention for the prayers." — this is the source of the reflection sentence ("Their steadfast witness strengthens us.") and the petition to Our Lady, Help of Christians in paragraph 2.
- **Runner seam:** `runner/pass1_collect.py`: `SEAM_KINDS` includes `"prayer-intro"`, `SEAM_PURPOSE["prayer-intro"]` = "Short prayer intro (saint-of-the-day weave-in) before the fixed prayer text." 2026-11-27 `texts-provided.json`, block `auxilium-christianorum/prayer-intro` = paragraph 2 in §1.1, verbatim.

### 1.4 Why BOTH fire on the Auxilium episode type

The Auxilium contract is the only daily-episode contract that stacks the two blocks: its entry's block list is `['liturgical_announcement', 'prayer_intro', 'sequence', 'sequence', 'weekday_map', 'sequence']` (read from the contract file by this seat). Composition walks the block list in order, so the announcement paragraph is composed first and the prayer intro second, immediately before the fixed "Opening Prayers" sequence that starts "Our help is in the name of the Lord."

The stacking is a design collision, not a runtime accident:

- The `prayer_intro` family is designed to stand ALONE as an episode's opening. Sibling proof inside `devotional_intro.py`: `ANGELUS_PROFILE` purpose reads "Lead naturally into the Angelus by joining the day's grace to Mary's faithful yes and the mystery of the Word made flesh **without repeating a separate daily announcement**" (`REGINA_CAELI_PROFILE` carries the same clause). The Angelus and Regina Caeli contracts carry a `prayer_intro` block and NO `liturgical_announcement` block.
- The Auxilium profile's own purpose ("Lead **from the liturgical announcement** into the Auxilium Christianorum prayers") shows the intro was written expecting the announcement before it — but the intro validator (§1.3) still requires the intro itself to name the selected observance. Expectation and validator disagree; the validator wins at composition time, so the saint is announced in both paragraphs, on both the model path and the deterministic fallback path.

### 1.5 The class — sibling daily episodes (scripts of 2026-11-27, heads read by this seat)

Verdict first: **Auxilium stands alone.** No sibling announces the saint twice, because no sibling contract stacks an announcement block ahead of an intro block. Contract block lists (fork `config/publish/contracts/`, read by this seat):

| Episode | Contract blocks (opening seat) | Opening shape in `~/workspace/ora-runner-runs/2026-11-27/` script | Saint announced |
|---|---|---|---|
| Auxilium Christianorum | `liturgical_announcement` + `prayer_intro` | Two paragraphs (§1.1) | **TWICE** |
| Daily Rosary | `rosary_intro` only | ONE paragraph: "On Friday, November 27, 2026, we begin the Sorrowful Mysteries. The Church celebrates Sts. Basileus, Auxilius and Saturninus, martyrs, held today as a private devotion from the Roman Martyrology. Their witness strengthens us as we draw near to Christ with Mary. …" The following "We offer this Rosary in honour of Sts. …" paragraph is the overall-intention block (a petition naming the saint as intercessor), not a second announcement | Once |
| Marian Antiphon / Angelus | `prayer_intro` only | ONE paragraph: "As we pray the Angelus, the Church celebrates Sts. Basileus, Auxilius and Saturninus, martyrs, held today as a private devotion from the Roman Martyrology. The grace of trustful perseverance and faithful prayer draws us to Mary's faithful yes and the mystery of the Word made flesh." | Once |
| Daily Reflection | `ignatian_reflection` only | ONE opening paragraph: "The Church celebrates Sts. Basileus, Auxilius and Saturninus, martyrs, held today as a private devotion from the Roman Martyrology. Little is handed down of their lives beyond their martyrdom, and that is itself a witness. …" Later paragraphs reflect on the Gospel and close by asking the saints' intercession — no second announcement | Once |
| Morning Prayer | `daily_intro` only | ONE paragraph: "As we begin Morning Offering (Extended) on Friday, November 27, 2026, the Church gathers our hearts around trustful perseverance and faithful prayer. The Church celebrates Sts. Basileus, Auxilius and Saturninus, martyrs, held today as a private devotion from the Roman Martyrology. Today's Gospel is proclaimed in Luke 21:29-33. …" | Once |

Class consequence: the fix does NOT belong at a shared seat — there is no shared seat producing a second announcement for the siblings. The double announcement exists only where the Auxilium contract stacks the two blocks. The fix at the Auxilium contract seat (§2.1) covers the whole class, because the class has exactly one member. (Novena episodes are out of the class: their intros come from the novena engine, carry no day announcement, and no novena script was flagged.)

## §2 The fix

### 2.1 Decision — the `liturgical_announcement` block retires for the Auxilium episode type; the `prayer_intro` opening survives

- **Change seat (exact):** fork `config/publish/contracts/auxilium-christianorum.json` —
  1. Remove `blocks[0]` (`{"kind": "liturgical_announcement", "title": "Liturgical Announcement"}`) from the `auxilium-christianorum` entry. The `prayer_intro` block becomes the episode's first block.
  2. Remove the now-dead `liturgical_announcement` object from the contract `metadata` in the same edit (it exists only to configure that block).
- **Nothing else moves.** `jobs/publish/contracts.py` needs no change: with no `liturgical_announcement` block in the entry, the dispatch never fires for this episode. `jobs/publish/liturgical_announcement.py` (`build_liturgical_announcement_text`) stays in the tree — it becomes unused by contracts; deleting shared code is not this release's word. `runner/pass1_collect.py` needs no change: `SEAM_KINDS` / `SEAM_PURPOSE` keep the kind registered for any future contract, and Pass 1 simply stops registering an `auxilium-christianorum/liturgical-announcement` block because `build_audio_jobs` no longer emits the fragment.
- **Why this block retires, on the evidence:**
  1. Standing guidance: keep the Auxilium's own character. Paragraph 2 is the episode's own voice — the reflection on the saint's witness ("Their steadfast witness strengthens us.") and the petition to Our Lady, Help of Christians ("We ask Our Lady, Help of Christians, to guard our families…") exist only in the `prayer_intro`. Paragraph 1 is standing episode furniture: date, week, celebration, season — no Auxilium content.
  2. The alternative (keep the announcement, rewrite the intro to not re-announce) fights the machinery: `validate_devotional_intro` rejects any non-novena prayer intro that does not identify the selected observance, and the deterministic fallback re-inserts the announcement via `_observance_timing_sentence`. That route means carving a validator exception for one profile and weakening a guard every prayer intro relies on — a bigger, shared-seat change to fix a one-contract stacking error.
  3. Sibling precedent: the Angelus — the closest sibling, same `prayer_intro` machinery — opens with its prayer intro alone, saint announced once, no date/season furniture paragraph. After this fix the Auxilium opens exactly like its sibling class.
  4. The Auxilium profile purpose line ("Lead from the liturgical announcement into…") is the one stale text the decision leaves behind; Implement updates that purpose string in `devotional_intro.py` to match the new shape (intro stands as the opening; no announcement precedes it). Text-only, no behavior change.
- **Named trade-off (accepted, not hidden):** the episode loses its spoken date/week/season line. The date still stands in the episode title and description (`title_template: "Auxilium Christianorum - {date_display}"`). The Angelus sibling already opens with no spoken date; no sibling carries a season line outside a single fused intro. If John wants the date spoken in this episode, that is a separate word — it is not smuggled into this fix.

### 2.2 The surviving opening, quoted for a real date

After the fix, the episode opens: welcome line, then the `prayer_intro` paragraph alone, then "Our help is in the name of the Lord." The surviving paragraph, exactly as composed for 2026-11-27 by the standing pipeline (`texts-provided.json` block `auxilium-christianorum/prayer-intro`; identical in the published script):

> Welcome to Ora Pro Nobis. Where we pray with the saints.
>
> As we begin the Auxilium Christianorum prayers, the Church celebrates Sts. Basileus, Auxilius and Saturninus, martyrs, held today as a private devotion from the Roman Martyrology. Their steadfast witness strengthens us. We ask Our Lady, Help of Christians, to guard our families and to obtain for us perseverance and trust in Christ.
>
> Our help is in the name of the Lord.

The saint announcement stands exactly once. Implement composes the first target date (§2.4) fresh through the same pipeline; its wording will be that date's own composition from the same profile and templates — not this paragraph copied forward.

### 2.3 Checks for Implement to run

1. **Composed script, real date, one announcement.** Compose the Auxilium episode for the first target date (§2.4) through the standing pipeline compose path (Pass 1 collect + seam merge, the route that produced the 2026-11-27 rundir — not a hand-written script). In the composed `script-auxilium-christianorum.txt`: the day's saint/celebration announcement ("The Church celebrates …") occurs exactly once in the opening, and no `liturgical-announcement` block stands in that rundir's `texts-needed.json` for the Auxilium episode.
2. **Tail byte-identical.** Everything from "Our help is in the name of the Lord." onward in the composed script is byte-identical to the standing composition for the same date produced without the fix (compose the same date on the pre-fix contract into a scratch rundir and diff from that line to EOF — the only permitted difference in the whole script is the removed announcement paragraph).
3. **Transcript guard passes.** The standing transcript guard passes on the composed script (same guard that produced `guard-auxilium-christianorum-2026-11-27.json`, `passed: true`, for the defective script — it must still pass with the paragraph removed).
4. **Sibling verdicts proven from scripts.** The same composed rundir's sibling scripts (`script-daily-rosary.txt`, `script-marian-antiphon-angelus.txt`, `script-daily-reflection.txt`, `script-morning-prayer.txt`) each still announce the saint exactly once in the opening — proving the contract-seat fix touched no sibling.
5. **Pinned tests updated, suite green.** Fork tests that pin the retired shape are updated to the new shape and the publish-contract/devotional-intro suites pass: `tests/test_publish_contracts.py` asserts today that the Auxilium entry's `blocks[0]` kind is `"liturgical-announcement"` (≈L241), that the composed text contains "Today is Monday, April 6, 2026" (≈L852), that the section titles begin "Liturgical Announcement", "Prayer Intro", … and that `resume_markers[0]` is the Liturgical Announcement — each assertion is re-pinned to the one-opening shape (first block/section = Prayer Intro; no "Today is …" announcement paragraph). `tests/test_publish_devotional_intro.py` needs no change (it exercises the profile/validator, which do not move, apart from the §2.1 purpose-string text).

### 2.4 First target date

- Nightly builds target date+2: the run that starts at 00:00 CT on day D composes target D+2. Production proof on file: the 2026-11-27 rundir's wallpaper finals were built 2026-11-25.
- This Plan publishes the evening of Friday 2026-11-27 CT. Target 2026-11-29 was already composed by the run that started 2026-11-27 00:00 CT — before any ship tonight — so it cannot carry the fix.
- **First target date: 2026-11-30** — composed by the nightly run starting Saturday 2026-11-28 00:00 CT — PROVIDED the fix is merged in the fork before that run starts. Ship later tonight (2026-11-27 evening CT) satisfies that condition with hours to spare.
- Implement/Ship must confirm, by name in their records: (a) the fork carries the contract change before the 2026-11-28 00:00 CT run starts, and (b) the 2026-11-30 rundir's Auxilium script passes check §2.3.1. If the merge misses that run, the first target date slips to 2026-12-01 and Ship says so plainly.

## §3 Implement record (chain-v703-impl, contract 1259, 2026-11-27)

### 3.1 What changed (fork `spotify_praylist-fork`, branch `muse-draft-week`, local-only, never pushed)

- **Fork commit `9625e229e`** — "v703: retire liturgical_announcement block from Auxilium contract"
  - `config/publish/contracts/auxilium-christianorum.json`: removed `blocks[0]` (`liturgical_announcement` / "Liturgical Announcement"); removed the dead `metadata.liturgical_announcement` object. The `prayer_intro` block is now the episode's first block.
  - `jobs/publish/devotional_intro.py`: Auxilium profile purpose text updated to the new shape — "Open the Auxilium Christianorum prayers as the episode's opening, placing the listener, families, and the needs of the day under Mary's protection." Text-only; no behavior change.
  - Nothing else moved: `contracts.py`, `liturgical_announcement.py` (`build_liturgical_announcement_text` stays in tree, unused by this contract), and `runner/pass1_collect.py` untouched, per Plan §2.1.
- **Fork commit `146f2857c`** — "v703: re-pin publish contract tests to one-opening Auxilium shape" (`tests/test_publish_contracts.py`, see §3.2).

### 3.2 Tests re-pinned (each pinned the retired two-opening shape)

| Test | Re-pin | Why |
|---|---|---|
| `test_load_publish_contracts_reads_rewritten_contracts` | Auxilium `blocks[0]` kind `"liturgical-announcement"` → `"prayer-intro"` | First block is now the prayer intro |
| `test_resolve_text_jobs_uses_weekday_and_month_selectors` | `assertIn("Today is Monday, April 6, 2026", auxilium text)` → `assertNotIn(...)` | The announcement paragraph no longer composes |
| same test | Section titles drop `"Liturgical Announcement"` → `["Prayer Intro", "Opening Prayers", "Litany of the Most Precious Blood", "Weekday Prayer", "Conclusion"]` | One opening section fewer |
| same test | `resume_markers[0]` = "Prayer Intro" (was [0]=Liturgical Announcement, [1]=Prayer Intro); `resume_markers[0].source` stays `"text_section"` | Marker list shifts up one |
| `test_auxilium_audio_fragments_include_resume_markers` | `audio_fragments[0]` = kind `"prayer-intro"`, label `"Prayer Intro"`, `fragment_key` `"block-1/prayer-intro"` (was [0]=liturgical-announcement, [1]=prayer-intro `block-2/prayer-intro`) | Fragment list shifts up one |

- `tests/test_publish_devotional_intro.py`: no change, per Plan §2.3.5 (profile/validator do not move apart from the purpose string).

**Suite tally:** `tests.test_publish_contracts` + `tests.test_publish_devotional_intro` under the repo venv (`~/workspace/scratch-daybuild/nv-venv`): **54 tests ran, 51 passed, 3 failed — all 3 failures PRE-EXISTING on the unmodified tree** (verified by stashing the v703 changes and re-running: same 3 failures). The 3 are Morning Prayer title-template drift, unrelated to v703: the morning contract now renders "Morning Offering (Extended) - …" while the tests still expect "Morning Prayer - …" (`test_load_publish_contracts_reads_rewritten_contracts` at the title_template assert, `test_render_publish_template_and_episode_id_are_date_scoped`, `test_resolve_text_jobs_uses_weekday_and_month_selectors` at its morning-title assert). Because two of those tests stop at the morning-title assert, the re-pinned Auxilium assertions inside `test_resolve_text_jobs_uses_weekday_and_month_selectors` were additionally verified directly against `build_text_jobs` for 2026-04-06 with the test harness fakes: **all pass** (no "Today is Monday, April 6, 2026", section list and `resume_markers[0]` as re-pinned, "Our help is in the name of the Lord." present). `test_auxilium_audio_fragments_include_resume_markers` passes in the suite as re-pinned. **Deviation from the contract expectation's "tests re-pinned green" clause, named plainly: the suite is not fully green — 3 pre-existing Morning Prayer failures stand outside this release's scope; every v703 re-pin is green.**

### 3.3 Checks (§2.3), target date 2026-11-30, composed through the standing pipeline

Compose route: `runner/pass1_collect.py --date 2026-11-30` + seam merge `runner/pass1b_merge.py`, run twice into scratch rundirs — post-fix `~/workspace/ora-runner-runs/v703-check-post-2026-11-30` (committed contract) and pre-fix `~/workspace/ora-runner-runs/v703-check-pre-2026-11-30` (contract restored from fork commit `c8c9c93ad`, then restored back). Seam texts for the Auxilium blocks were authored identically for both runs (prayer-intro in both; liturgical-announcement in pre only); all other seam blocks took their deterministic fallbacks in both runs.

1. **One announcement — PASS.** Post-fix `texts-needed.json` carries NO `auxilium-christianorum/liturgical-announcement` block (pre-fix carries it). Post-fix composed opening, verbatim:
   > Welcome to Ora Pro Nobis. Where we pray with the saints.
   >
   > As we begin the Auxilium Christianorum prayers, the Church celebrates Saint Andrew, Apostle. His steadfast witness strengthens us. We ask Our Lady, Help of Christians, to guard our families and to obtain for us perseverance and trust in Christ.
   >
   > Our help is in the name of the Lord.
   
   "Church celebrates" count in the whole post-fix Auxilium script: **1** (pre-fix: **2**). The opening is the prayer_intro paragraph followed directly by "Our help is in the name of the Lord."
2. **Tail byte-identical — PASS.** Everything from "Our help is in the name of the Lord." to EOF (5,481 bytes) is byte-identical between the pre-fix and post-fix composed scripts; the only whole-script difference is the removed announcement paragraph.
3. **Transcript guard — DEVIATION, named plainly.** The guard's script-side screen (`script_screen` on the post-fix Auxilium seam texts with plan context) passes: **problems: []**. The full standing guard (`runner/pass2_build.py`, no publish) on the post-fix check build marks the Auxilium episode **FAILED_GUARD**: `[asr] ASR extra-content ratio 0.11 > 0.08` (cached-transcript runs; metrics coverage 0.944, segment_problems 0, unlocated_segments 0, worst span 1.19) and, on a fresh-ASR rerun, extra 0.18 with interval span 1.47 before the "Let us pray" segment. The pre-fix build of the same date passes the same guard (extra 0.027, 13/13 episodes pass; post-fix build 12/13, Auxilium the only failure). **Cause, on the transcript evidence: ASR decoding artifacts in the UNCHANGED, byte-identical tail, not spoken content and not the removed paragraph** — the post-fix ASR transcript contains a burst of 10× "Blood of Christ save us" inside a single 0.84 s ASR segment (237.060–237.900) and digit gibberish ("6.8.0.1.1.1…") over the stretch before "Lamb of God"; ASR counts "Blood of Christ / save us" 38× against the script's 24×, while the pre-fix run's ASR counts exactly 24×. Every other guard layer passes on the post-fix audio: fragment duration screen clean, all segments located in order, opening rendered verbatim as scripted, episode duration 390.1 s vs pre-fix 399.7 s (Δ ≈ the removed announcement). The ~10 s shorter episode shifts the ASR 60 s chunk alignment across the repetitive Litany of the Most Precious Blood, and the recognizer loops there. **Consequence for Ship: the production 2026-11-30 nightly run composes its own seam texts and renders and runs this guard itself; its Auxilium guard verdict must be read by name at Ship — this check build's ASR instability on the litany is a standing risk to that verdict, and a FAILED_GUARD there holds the episode under the standing guard rule.**
4. **Siblings — PASS (untouched).** In the same composed rundirs, pre and post scripts are unchanged for every sibling; "Church celebrates" in each sibling script (whole script): Daily Rosary **1**, Marian Antiphon / Angelus **1**, Morning Prayer **1**, Daily Reflection **0** occurrences of that exact phrase in both runs (its deterministic fallback opening announces the day in other wording — "The Church's calendar gives us … as a companion today" — identical pre/post; in production its announcement is seam-authored, per §1.5). All four sibling episodes PASS the full transcript guard in the post-fix pass2 build.

### 3.4 First-target-date condition (§2.4)

- (a) The fork carries the contract change (commit `9625e229e`, 2026-11-27 evening CT) — before the 2026-11-28 00:00 CT nightly run starts. **Confirmed.**
- (b) The production 2026-11-30 rundir does not exist yet at Implement time; its Auxilium script check (§2.3.1) and guard verdict (§3.3.3) are Ship's named read-backs on the nightly run that starts 2026-11-28 00:00 CT.

## §4 Review verdict (chain-v703-review, contract 1263, 2026-11-27) — PASS WITH CONDITIONS

**Verdict: PASS WITH CONDITIONS.** The fix is verified independently. Both Implement deviations are judged below; neither blocks the fix from shipping. The conditions are Ship's named read-backs on the production 2026-11-30 build — they gate the episode's publish, not the fix.

### 4.1 Verification 1 — contract change (PASS, own diff)

- Semantic diff of `config/publish/contracts/auxilium-christianorum.json`, fork pre-fix `c8c9c93ad` vs HEAD `146f2857c`: the ONLY contract changes are the removal of `entries[0].blocks[0]` (`liturgical_announcement` / "Liturgical Announcement") and the removal of `metadata.liturgical_announcement`. The remaining blocks shift up unchanged: post-fix block kinds are `['prayer_intro', 'sequence', 'sequence', 'weekday_map', 'sequence']`, `prayer_intro` first. Nothing else in the contract changed.
- `jobs/publish/devotional_intro.py` in commit `9625e229e`: one purpose-string line only ("Lead from the liturgical announcement into…" → "Open the Auxilium Christianorum prayers as the episode's opening, …"). No behavior change. Total v703 diff vs pre-fix: 3 files (contract · devotional_intro purpose · test re-pins).

### 4.2 Verification 2 — composed proof, 2026-11-30 scratch rundirs (PASS, own counts)

- Post-fix script (`v703-check-post-2026-11-30/script-auxilium-christianorum.txt`): "Church celebrates" count = **1** (pre-fix: **2**). The opening is the welcome line, the `prayer_intro` paragraph alone (Saint Andrew, Apostle), then "Our help is in the name of the Lord."
- Post-fix `texts-needed.json`: **0** `liturgical-announcement` occurrences, no `auxilium-christianorum/liturgical-announcement` block (pre-fix: present).
- Tail byte-identity, re-run by this seat: from "Our help is in the name of the Lord." to EOF = **5,481 bytes, byte-identical** pre vs post. Whole-script diff is exactly the removed announcement paragraph (plus its blank line) — nothing else.

### 4.3 Deviation 1 — ASR guard failure on the post-fix check build: JUDGED AN ARTIFACT, not a ship-blocker for the fix

Evidence inspected by this seat (post-fix guard transcript + chunk segments, `guard/auxilium-christianorum-2026-11-30/asr/`):

- The guard file on disk for the post-fix build reads FAILED: extra-content ratio **0.18** > 0.08, interval span **1.47** before the "Let us pray" segment; coverage 0.944, unlocated_segments 0. The pre-fix build of the same date passes (extra **0.027**).
- The extra content sits entirely in the byte-identical tail — the Litany of the Most Precious Blood — not in the opening and not in any spoken addition: the post-fix ASR transcript counts "Blood of Christ" **67×** against the script's **24×** (pre-fix ASR counts 24×, matching the script). One ASR segment, **237.060–237.900 s (0.84 s)**, carries 17 repetitions of "Blood of Christ save us" — a rate no speaker produces; the following segments repeat the same loop. That is a recognizer repetition burst, not rendered speech.
- The opening ASR segment matches the post-fix script: one announcement, Saint Andrew named once, then "Our help is in the name of the Lord."
- The script itself is proven clean by §4.2 (byte-identical tail; the only change is a removed paragraph). A decoder loop over unchanged audio content, triggered after the ~10 s shortening shifted chunk alignment, does not indict the fix.

**Judgment:** the ASR failure does NOT block shipping v703. It converts to ship condition C3 below: Ship answers it by reading the PRODUCTION 2026-11-30 build's Auxilium guard verdict by name. Under the standing guard rule, a FAILED_GUARD in production holds that episode — the episode does not publish — while the fix itself still ships and stands.

### 4.4 Deviation 2 — suite 51/54, 3 Morning Prayer failures: JUDGED PRE-EXISTING, not a ship-blocker

Own re-runs by this seat (fork venv, unittest):

- `tests.test_publish_devotional_intro`: **26/26 OK**.
- `test_auxilium_audio_fragments_include_resume_markers` (re-pinned): **PASS**.
- The 3 named failures each fail at exactly one assert, all Morning Prayer title-template drift: `test_load_publish_contracts_reads_rewritten_contracts` at L278 (`'Morning Offering (Extended) - {date…}' != 'Morning Prayer - {date…}'`), `test_render_publish_template_and_episode_id_are_date_scoped` at L209, `test_resolve_text_jobs_uses_weekday_and_month_selectors` at L848 — same rendered-vs-expected title pair in all three.
- Pre-existing basis: the v703 diff (§4.1) touches no Morning Prayer contract, template, or title assert; the morning contract and those asserts stand as they were before v703. The failures are outside this release's scope.
- The re-pinned Auxilium assertions inside `test_resolve_text_jobs_uses_weekday_and_month_selectors` stand after its L848 morning assert, so the suite never reaches them; this seat ran them directly against `build_text_jobs` for 2026-04-06: **all pass** (no "Today is Monday, April 6, 2026" in the Auxilium text, "Our help is in the name of the Lord." present, section titles `["Prayer Intro", "Opening Prayers", "Litany of the Most Precious Blood", "Weekday Prayer", "Conclusion"]`, `resume_markers[0]` = Prayer Intro / `text_section`, title and intro-focus text as re-pinned). Every v703 re-pin is green.
- Note, plainly: this seat did not re-run the full 54-test tally end-to-end (the contracts module's heavy job builds exceed this seat's window); the tally above is targeted re-runs of every test the deviation names plus the full devotional-intro module, and it is consistent with Implement's 51/54.

### 4.5 Verification 5 — sibling spot-check (PASS)

- Production rundir 2026-11-27, `script-marian-antiphon-angelus.txt` (this seat's pick): opening paragraph announces the saint exactly **once** ("As we pray the Angelus, the Church celebrates Sts. Basileus, Auxilius and Saturninus, martyrs…"), whole-script "Church celebrates" count = 1. Matches the Plan's class verdict; the Auxilium (count 2 in the same rundir) stood alone.

### 4.6 Ship conditions (Ship discharges each by name)

- **C1 — fork HEAD read-back:** the fork (`spotify_praylist-fork`, branch `muse-draft-week`) carries commits `9625e229e` + `146f2857c` before the 2026-11-28 00:00 CT nightly run starts. If the run was missed, the first target date slips to 2026-12-01 and Ship says so plainly.
- **C2 — production script read-back:** in the production 2026-11-30 rundir, the Auxilium script's saint announcement count is exactly 1 and its `texts-needed.json` carries no `auxilium-christianorum/liturgical-announcement` block.
- **C3 — production guard verdict read-back (the Deviation 1 condition):** Ship reads the production 2026-11-30 Auxilium transcript-guard verdict by name. If it is FAILED_GUARD, that episode is held under the standing guard rule and does not publish; v703 still ships, and Ship's report names the held episode and the guard verdict — it does not claim the episode published.
- **Not a condition:** the 3 pre-existing Morning Prayer title-template failures (§4.4) are not fixed in v703 and do not gate Ship.

## §5 Ship record

- **Status:** SHIPPED · LIVE — Ship seat: chain-v703-ship (Ship phase record 2941). **Date:** 2026-11-27. **Ship shape:** FORK-ONLY — this record merged to main + board closeout is the ship. No app deploy, no pin.
- **Review:** PASS WITH CONDITIONS (§4, commit `8bcf905`).
- **Standing approval (execution-risk flag):** the first Ship pass stopped before this doc merge on a system execution-risk flag over the standing clone. This completion proceeded under John's standing approval of 2026-11-21 11:22 CT (recorded in `~/AGENTS.md`, "Standing-clone processing go-ahead") to process the one standing clone (checkout · build · test · git/package-manager operations inside it) for Ora line chains despite that flag — cautions honored: worktree off the clone, committed-tree verification before ship, merges serialized, nothing shipped unverified. The approval was reaffirmed 2026-11-26 for v690, and v702's ship proceeded under it when the same flag fired.

### C1 — fork HEAD read-back: DISCHARGED

- Fork (`~/workspace/projects/spotify_praylist-fork`, branch `muse-draft-week`, local-only, never pushed): HEAD `146f2857c0ac2ef5e7c0f384b462dc9a093d9548` (carries `9625e229e` + `146f2857c`), read back 2026-11-27 17:20:02 CST — before the 2026-11-28 00:00 CT nightly run starts. The first target date stands 2026-11-30; no slip.

### Merge + push read-backs

- **Branch:** `release/v703` at `8bcf90580a56a7b6fb9fe86387890bb2de38753c` (tree `c6c8ab0f348f362ac1f579a03c5279f8ed0c9673`), local only — never pushed. Doc blob at merge: `9b964697db2d3193ad25250dfc4ebb53b83b98a9`.
- **Remote main before merge:** `8abc14a181dfaac33d68de637f54df11d50a025c` (Merge release/v704 into main; tree `4cebc9d778e5bcbfad8244f37de39eafc46231da`). Remote main had moved past the branch base; the v703 doc path was untouched on remote main. The merge commit's parent is that exact head; no force-push, no history rewrite, no commit dropped.
- **Merge:** GitHub Git Data API, tree-exact (`~/workspace/.tools/push-v703-doc.py`, modeled on the v702 drivers): remote merge commit `e33e521566ab8aea40be66b61d525b101dd49060` ("Merge release/v703 into main", parent `8abc14a`), tree `d3d00db3e4d032dc5e6ccef353823d341980d6c8`. Assertion: merged tree == remote main's tree plus this doc path at its branch blob exactly; every non-doc blob byte-identical to pre-merge remote main; path set exact.
- This §5 record commit follows the merge on main as its own tree-exact commit (the v702 ship-record pattern); the final remote main head and tree are read back in the chain's ship report.

### Board closeout (DevOps Board, project ora-pro-nobis)

- **Phase records:** Plan 2934 · Implement 2935 · Review 2938 · Ship 2941 — all `passed`, read back.
- **What's New id 518:** "Fixed: the Auxilium Christianorum episode no longer announces the day twice in its introduction." — read back.
- **shipped_records id 892:** project_id 3 · version `v703` · whats_new_id 518 — inserted and read back.
- **Release row 1681:** status `Live`, shipped_at `2026-11-27T23:20:35Z`, whats_new_id 518 — read back.

### Standing production read-back — C2/C3 NAMED, OPEN

- **C2 = the production 2026-11-30 rundir's Auxilium script must carry the announcement exactly once with no liturgical-announcement block.**
- **C3 = the production 2026-11-30 Auxilium guard verdict read by name — if FAILED_GUARD that episode is held under the standing guard rule and does not publish.**
- Neither condition is discharged by this ship: the production 2026-11-30 rundir is composed by the nightly run starting 2026-11-28 00:00 CT, after this record. This ship does NOT claim the 2026-11-30 episode published and does NOT claim any guard verdict for it. C2/C3 close on the named production read-backs.
