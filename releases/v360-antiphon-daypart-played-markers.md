## 1 · Scope

- **Direction (John, Ora thread, 2026-11-10 11:41 CT; clarified by his option selection 11:44 CT):** SEPARATE PLAYED MARKER FOR EACH DAYPART for the Marian Antiphon. The Marian Antiphon occurrences in Morning, Midday, and Evening are DISTINCT occurrences for played/unplayed state.
- **The requirement, in full:** playing to natural completion, or manually toggling the dot, on one daypart's Antiphon must NOT mark either other daypart's Antiphon as played. Audio/content stays the same; only the played-state identity changes. Block progress and Continue must count each Antiphon occurrence independently. **Acceptance test (John's):** play or mark the Morning Antiphon, then verify Midday and Evening remain unplayed; complete the Midday Antiphon and verify Morning/Evening states remain independent.
- **Routing note (John's):** this affects v344's current canonical-episode-id played-state keying for this repeated item.
- **Scope claim:** record 1289. **Time contract:** 193. **State at Scope:** v344 · v347 · v351 · v355 all Live; fork trunk `muse-draft-week` at a52dc23 + v359's §1 (a3c731e). Production carries the v354 build.
- **Recommended run level: To Ship** (named at this section's end).

### 1.1 Discovery — how played state is keyed today (first-hand, shipped client)

- **The store (v344, `app/worker/src/client.ts`):** ONE device-local store, localStorage key `opn-played-v344`, shaped `{ "<canonicalEpisodeId>": { "<presentedDate>": { playedAt, via } } }`. The client's own header comment states the design: "keyed by CANONICAL EPISODE ID first and PRESENTED DATE second — the id the stored payload and the podcast feed share (v342's keying)". Canonical keying is what lets a novena's nine days accumulate under one key across rollovers; it is also exactly what makes the Antiphon's three dayparts share one played state.
- **The Antiphon's three occurrences:** the settings carry three rows — sourceKeys `marian-antiphon` (Morning), `marian-antiphon-midday` (Midday), `marian-antiphon-evening` (Evening) — and `OWN_ROW_EPISODE` maps ALL THREE to the one canonical episode id `marian-antiphon-angelus`. One produced episode stands behind all three rows; the own-feed resolver settles the single feed match into each enabled row ("the Antiphon item places into each of its enabled rows (Morning, Midday, Evening) from this one match"). The audio is one file; the occurrences are three.
- **The descriptor already knows its daypart:** every descriptor built from a row or a block carries its block (`ownSlotTrack` sets `_block: row.block`; the day-build seam stamps `_block: b.block`; `segDesc` carries it onto the queue descriptor as `block`). Played-state code simply never consults it: `markCompleted(desc)` writes `desc.episodeId` only, and `isPlayed(episodeId, dateStr)` takes no block.
- **The dot is keyed by id alone:** `playedDotHtml` emits `data-markplayed="<episodeId>"` and the toggle handler reads that id — so today, tapping the Morning Antiphon's dot flips the one shared record, and `refreshPlayedChrome` paints all three rows' dots from the same record.
- **v344's keying pin, stated precisely:** v342/v344 pinned that DESCRIPTOR ids are never re-keyed (the canonical id is the identity the feed matcher, the payload, and the text routes share). This scope does NOT propose re-keying any descriptor or episode id. It proposes that the PLAYED STORE's key for this one family gains the occurrence (the block) — the canonical id stays the identity everywhere else.

### 1.2 Every consumer of the played key (complete inventory)

1. **Completion marking** — `markCompleted` (the only completion writer; the three `ended` paths). Must write the occurrence of the descriptor that actually finished.
2. **The row dot + toggle** — `playedDotHtml`, the `data-markplayed` handler, `refreshPlayedChrome`, `heardCls` (the heard title tone). The dot must carry and flip its own row's occurrence.
3. **Block progress** — `blockPlayedCounts(block)` (the "N prayed" counts and the Mark-all button label). Today each of Morning/Midday/Evening counts the Antiphon as played when the shared record stands; under occurrence keying each block counts only its own.
4. **Mark all played / unplayed (per block)** — writes each available descriptor in the block through `writePlayedQuiet(x.episodeId, …)`; must write occurrences, so Mark-all in Morning no longer marks the Midday/Evening Antiphons.
5. **The played filter** — `unplayedOnly` (v344 §2.4) behind Play All and per-block play queue builds. Must answer per occurrence, so a played Morning Antiphon leaves the Midday/Evening occurrences in an unplayed-only queue.
6. **Auto-queue (v351)** — a tap builds the tapped pair + the `unplayedOnly` remainder of the block; inherits the filter's answer.
7. **Continue** — `paintContinue` finds the first unplayed track by `isPlayed(x.episodeId, d)`; must find it per occurrence (e.g. with Morning's Antiphon played and Midday's not, Continue's remaining count and first-unplayed must treat them separately).
8. **Queue list dots (v347)** — the Now Playing queue rows paint their played dot from `isPlayed(desc.episodeId, dstr)`; the descriptor carries `block`, so the queue can paint per occurrence once the seam takes it.
9. **Queue snapshot (v355)** — the snapshot stores track identity as EPISODE IDS ONLY (`ids: queue.map(d => d.episodeId)`, `currentId`), and restore re-resolves by id with FIRST MATCH winning (`byId[d.episodeId]` keeps the first descriptor). Occurrence identity does NOT ride the snapshot today: a restored queue containing two Antiphon occurrences collapses both to the first daypart's descriptor (the audio is identical, but a completion in the restored queue would credit the wrong daypart under occurrence keying). Priced as its own decision (§1.3 Q3).
10. **The resume record (`opn-resume-v312`)** — keyed by episodeId + position; examined: it resumes a POSITION in identical audio, not a played state. No change proposed; named so the inventory is complete.
11. **Novena progress (`novenaInfo`)** — counts played DATES under the canonical id for `novena-*` ids across days. NOT an Antiphon consumer, and the reason the design must not touch canonical keying generally: multi-day novena accumulation depends on it.

### 1.3 The decisions (in the interactive package; recommendations marked)

1. **Keying design:**
   - **A — Antiphon-only occurrence key (RECOMMENDED).** The played seam (`isPlayed` / `writePlayed` / `writePlayedQuiet`) learns the descriptor's block for the Antiphon family only: the store key for an Antiphon occurrence becomes the canonical id + the block (e.g. `marian-antiphon-angelus` keyed per Morning / Midday / Evening). Every consumer in §1.2 (items 1–8) consults the seam with the descriptor in hand, so one seam change carries them all. Descriptor ids, feed matching, payload, and every other item's keying are untouched. Recognizing the family: by the canonical id `marian-antiphon-angelus` (both seasonal stems — Angelus and Regina Caeli — resolve to their own canonical ids; Plan pins the exact family set against the resolver).
   - **B — Occurrence keying for repeated episodes generally.** Every item's played key gains its block. **This is a DEVIATION from John's requirement** (see §1.4) and is NOT recommended: it re-keys items John did not name, and it puts the novena family's canonical accumulation (§1.2 item 11) at risk for no asked benefit.
   - **C — No change** (decline; the shared marker stands).
2. **Changeover — what happens to TODAY's already-played Antiphon mark:**
   - **A — No occurrence inherits it (RECOMMENDED).** The old shared mark cannot say WHICH daypart John actually heard — that missing fact is the defect itself. Under the new keying, the day's three occurrences start from their own records; the old canonical entry stays in the store, unread by the Antiphon seam (it ages out under the standing 120-day prune). Cost, stated plainly: on the first day under the new build, an Antiphon John already heard may show unplayed, and Continue may offer it once more. One day, one repeated short track, against three dayparts wrongly marked played every day the current behavior stands.
   - **B — All three inherit today's mark.** Preserves "heard today" but recreates the exact false state John reported, on day one.
   - **C — Morning only inherits.** A guess dressed as a rule: nothing in the old record says the hearing was the Morning occurrence.
3. **Queue snapshot identity (v355):**
   - **A — Carry the block with the snapshot ids (RECOMMENDED).** The snapshot gains the occurrence's block alongside each id (a v2 record shape; a standing v1 record restores under the old first-match rule and is rewritten as v2 at the next save). Restore then re-resolves each Antiphon occurrence to its own daypart, and a completion in a restored queue credits the daypart that actually played.
   - **B — Leave the snapshot as it stands.** Restored queues keep collapsing Antiphon occurrences to the first daypart's descriptor; audio identical, but completion credit in a restored queue can land on the wrong daypart. Named as a known gap if chosen.
4. **Run level:** **To Ship (RECOMMENDED)** — client-only, device-local store, no migration, no Worker route, no payload or nightly change; John's acceptance test is a phone check he runs himself · Stop before Ship · Through Review · Through Implement · Scope only.

### 1.4 Deviation discipline — named plainly

- **John's original:** occurrence played markers for THE MARIAN ANTIPHON — Morning, Midday, Evening.
- **Option B proposes instead:** occurrence keying for EVERY repeated episode. That is different from what John asked, and it is flagged here, not folded into the recommendation. The recommendation is Option A — the Antiphon only, as asked.
- **Known consequence of Antiphon-only keying, named:** any OTHER episode that stands in more than one block keeps the old shared canonical keying. Today the Antiphon is the only episode in that position (verified: it is the one canonical id the resolver settles into multiple rows); the inconsistency is therefore theoretical until a second repeated episode exists, at which point it needs its own scope. Novenas are NOT such a case — each novena episode is a distinct per-saint id, and their cross-day accumulation under canonical keying is a feature (§1.2 item 11), not the defect.

### 1.5 Recommendation

- **Q1 A · Q2 A · Q3 A · run level To Ship.** One seam change (the played store's key for the Antiphon family gains the block), carried by descriptors that already know their daypart; the snapshot learns the same identity so restored queues credit the right daypart; today's ambiguous shared mark is retired rather than guessed at. File surface (Plan confirms): `app/worker/src/client.ts` (the played seam, the dot, the filter, Continue, the snapshot) + the SW re-pin in `ui.ts` + a new harness. No migration, no server change, no nightly change.
- **Acceptance (John's test, as the gate):** play or mark the Morning Antiphon → Midday and Evening remain unplayed (dots, block counts, Continue) → complete the Midday Antiphon → Morning and Evening states remain exactly as they stood.
- **Concerns and Information Needs:** the seasonal Antiphon stem changes (Angelus ↔ Regina Caeli carry different canonical ids) — Plan pins the family set from the resolver so both seasons key per occurrence · the Antiphon also stands as the LAST track of Morning (the Morning order fix) — no ordering interaction is expected, but the harness proves the pair rule (an intention intro never marks) still holds per occurrence · if John's phone already carries a queue snapshot from today at ship time, Q3's v1→v2 fallback covers it.

## 2 · Plan

- **Approval (John, Ora thread, 2026-11-10 14:08 CT, via the package prompt): TO SHIP.** Decisions: **(1) Keying B — occurrence keying for repeated episodes GENERALLY** (John expressly chose the option §1.4 flagged as a deviation from his Antiphon-only requirement; it stands as HIS approved decision, recorded in the row's run directive and here — not as Muse's recommendation, which was A). **(2) Changeover A** — no occurrence inherits the old shared mark. **(3) Saved queue A** — the v355 snapshot carries each occurrence's block. **(4) Run level To Ship.**
- **Plan claim:** record 1290 (holder plan-v360). **Time contract:** 194 — package ASAP, hard deadline 2026-11-10T20:54:28Z. **Scope pass:** record 1289 passed on John's approval, above.
- **Migration: NONE.** Client-only, device-local store, no Worker route, no payload or nightly change. Migration 0016 stays free.

### 2.1 The repeated-id enumeration (first-hand, settings v4 / migration 0015 era)

The presented day is built from three descriptor sources; each was enumerated for a canonical episode id standing in more than one block:

| Source | Ids and their blocks | Repeats? |
|---|---|---|
| Own rows (`OWN_ROW_EPISODE`, settings rows) | `morning-prayer` → Morning · `daily-rosary` → Morning · `auxilium-christianorum` → Afternoon · `daily-reflection` → Night · `novenas` → per-saint ids `novena-<slug>`, Novenas block only | No — each stands in exactly one block |
| Own rows — the Antiphon | `marian-antiphon` (Morning), `marian-antiphon-midday` (Midday), `marian-antiphon-evening` (Evening) ALL map to the one canonical id **`marian-antiphon-angelus`** | **YES — three blocks. The only cross-block repeat in the day** |
| Externals (descriptor episodeId = the slot id; §client extSlots) | `ext-invitatory` · `ext-morning-prayer` · `ext-bible-in-a-year` → Morning · `ext-gospel-exegesis` · `ext-midmorning-prayer` → Midmorning · `ext-midday-prayer` → Midday · `ext-saint-of-the-day` · `ext-midafternoon-prayer` → Afternoon · `ext-office-of-readings` · `ext-evening-prayer` → Evening · `ext-night-prayer` → Night · the Mass-and-Homilies slots (USCCB readings · Daily TV Mass · Fr. Mike homily · Barron sermon) → Mass and Homilies only | No — every slot stands in exactly one block. The Sing the Hours fallbacks (Lauds, Vespers) share their primary's SLOT and block — the same occurrence position, never a second block |
| Novenas | one descriptor per active novena, id `novena-<slug>`, Novenas block only; distinct saints carry distinct ids | No |
| Intention intros | `intro:<prayerId>` — never a played-state subject (markCompleted skips them by rule) | n/a |

- **Enumeration result: exactly ONE repeated canonical id stands in a presented day — `marian-antiphon-angelus` (Morning · Midday · Evening).** The seasonal stem is covered by construction: in Eastertide the resolver yields the Regina Caeli canonical id in the same three rows, and the design below keys by REPEAT, not by a family list — no code names the Antiphon at all.
- **Within-block duplicates:** none stand (the fallback/primary pair shares one slot and only one stands). Named limitation, §2.7: two occurrences of one id inside the SAME block would share an occurrence key; no such pair exists in the settings, the contracts, or the externals today.

### 2.2 The key design — repeat-aware occurrence keying

- **The rule:** at each day build, the client computes the day's REPEAT SET — the episode ids carried by more than one prayer descriptor in `state.dayDescs` (intention intros excluded; availability does not matter, so the set is stable while slots settle). The set stands on `state.repeatIds`, recomputed wherever `state.dayDescs` is rebuilt.
- **The key function (the one seam change):** `playedKey(episodeId, block)` returns `episodeId + '|' + block` when the id stands in the repeat set AND a block is in hand; otherwise the bare `episodeId`. The store shape is unchanged — `{ "<key>": { "<date>": { playedAt, via } } }` under the SAME localStorage key `opn-played-v344`. A `|` never appears in a canonical id, so an occurrence key can never collide with a bare key, past or future.
- **Why singletons keep the bare id (the justification Decision 1 requires):** (a) it is the smallest change that satisfies the general rule — an id that occurs once has exactly one occurrence, so the bare id already IS its occurrence key; (b) it preserves every standing canonical-key behavior for the 99% case — most importantly the novena family's cross-day accumulation (§2.5) and the 120-day history John already carries, which a uniform re-key would orphan in one stroke; (c) it makes the changeover surgical: only repeated ids change keys, and §2.4 prices exactly that.
- **The seam signatures:** `isPlayed(episodeId, dateStr, block)` and `writePlayed / writePlayedQuiet(episodeId, dateStr, via, block)` gain the block as a trailing optional argument; every caller in §2.3 passes its descriptor's block (every descriptor already carries one — payload tracks are stamped `_block` at the build seam, `segDesc` carries it as `block`, own rows carry `row.block`, externals carry their standing row's block). A caller without a block reads/writes the bare key — the pre-v360 behavior, retained only as a defensive default; the harness proves no production caller relies on it for a repeated id.

### 2.3 Every consumer, its exact change (§1.2 items 1–10)

1. **Completion marking — `markCompleted`:** `writePlayed(desc.episodeId, d, 'played', desc.block)`. The descriptor that actually finished credits its own occurrence.
2. **The row dot + toggle — `playedDotHtml` / the `data-markplayed` handler / `refreshPlayedChrome` / `heardCls`:** the dot button gains `data-playedblock="<block>"` beside `data-markplayed`; its on-state reads `isPlayed(id, date, block)`; the toggle handler writes with the button's block; `refreshPlayedChrome` repaints each dot from its own pair of attributes; `heardCls(t)` passes `t.block`.
3. **Block progress — `blockPlayedCounts(block)`:** already iterates only the block's descriptors — `isPlayed(x.episodeId, d, x.block)`; each block now counts its own Antiphon occurrence only.
4. **Mark all played / unplayed (per block):** the mark-all handler writes each of the block's descriptors through `writePlayedQuiet(x.episodeId, …, x.block)` — Mark-all in Morning no longer touches the Midday/Evening Antiphons.
5. **The played filter — `unplayedOnly`:** its `isPlayed(x.episodeId, d)` calls gain `x.block`, including the intention-pair grouping check (a pair is judged by its PRAYER's occurrence state, as today).
6. **Auto-queue (v351):** no code of its own — it builds through `unplayedOnly` and the pair rule, and inherits the per-occurrence answer. The harness proves the tap case (§2.6 L6).
7. **Continue — `paintContinue`:** the first-unplayed scan and the remaining count read `isPlayed(x.episodeId, d, x.block)` — with Morning's Antiphon played and Midday's not, Continue offers Midday's occurrence and counts it.
8. **Queue list dots (v347):** the queue-row paint reads `isPlayed(desc.episodeId, dstr, desc.block)`; queue descriptors carry `block` through `segDesc`.
9. **Queue snapshot (v355):** §2.5-B below (Decision 3).
10. **The resume record (`opn-resume-v312`):** UNCHANGED, per §1.2 item 10 — it resumes a position in identical audio; it is not a played state and no consumer reads it as one.

### 2.4 Changeover A — the old shared marks

- **No store-version bump and no key migration.** `PLAYED_KEY` stays `opn-played-v344`: bumping it would orphan ALL played history (every singleton mark and the novena accumulation) to retire ONE ambiguous entry — a cost Decision 2A never approved. Instead: under the repeat rule, the seam simply never looks up the bare `marian-antiphon-angelus` key again — the day's Antiphon is in the repeat set, so every read and write names an occurrence key. The old entry stands in the store unread and ages out under the standing 120-day prune, exactly as §1.3-A stated.
- **The one-day cost, stated exactly as approved:** on the first day under the new build, all three Antiphon occurrences read UNPLAYED even if John heard one (or all) of them that day under the old build; Continue may offer the Antiphon once more that day. From the next presented day the distinction is exact. No other item's marks change in any way.

### 2.5 novenaInfo — untouched, and why general keying does not disturb it

- `novenaInfo(episodeId, title)` counts played DATES under the canonical id for `novena-*` ids across days — the nine-day accumulation a novena's progress display stands on. It reads the store directly by canonical id; it is not one of the §2.3 seam consumers and this Plan changes nothing in it.
- **Why it cannot be disturbed:** a novena id never stands in the repeat set (each `novena-<slug>` occurs once in a day, in one block — §2.1). Its writes therefore keep the bare canonical key under §2.2's rule, on every day of the novena, and `novenaInfo`'s reads land exactly where they land today. General keying reaches only ids that repeat; the novena family is the proof case that the repeat rule, not a family exception, is what protects it. (This answers the risk §1.3-B named against general keying: under the repeat rule the risk does not materialize, because keying follows repetition, not item class.)

### 2.5-B The v355 snapshot (Decision 3A)

- **Save:** the snapshot record becomes `v: 2` and gains `blocks` — an array parallel to `ids`, each entry the descriptor's block (or `''`) — plus `currentBlock` beside `currentId`. Everything else in the record is byte-identical in shape.
- **Restore (v2):** descriptors are indexed by the PAIR — `byPair[id + '|' + block]`, first occurrence winning per pair — and each stored entry resolves on its own pair. Two Antiphon occurrences in one queue restore to their own dayparts' descriptors; a completion in the restored queue credits the daypart that actually played (through §2.3.1). The stored current stands on the entry whose pair matches `(currentId, currentBlock)`.
- **Restore (v1 fallback, as approved):** a pre-v360 record carries ids only — it restores under the standing first-match-by-id rule (the occurrences collapse to the first daypart's descriptor for that one restore, audio identical), and the NEXT save rewrites the record as v2. No v1 record is rewritten in place unread.
- **Yesterday's snapshot** still dies at the day boundary under v355's standing rule — unchanged.

### 2.6 The harness plan — harness-v360.mjs

Modeled on the estate's harness shape (fixture day build from the settings-v4 seed + migration-0015-era payload, real client functions, DOM-level where the chrome is the claim). Fixtures: settings version 4 (26 rows), the three Antiphon rows resolving to the one canonical episode, at least two active novenas, one full eight-block day.

- **L1 Enumeration:** the built day's repeat set is exactly `{marian-antiphon-angelus}` — no external slot, no novena, no singleton own row stands in it.
- **L2 JOHN'S ACCEPTANCE, part 1:** toggle the Morning Antiphon's dot on → the store holds the Morning occurrence key only; the Midday and Evening dots read unplayed; Morning's block count advances, Midday's and Evening's do not.
- **L3 JOHN'S ACCEPTANCE, part 2:** complete the Midday Antiphon through the real `ended`/`markCompleted` path → the Midday occurrence is marked; Morning's state stands exactly as L2 left it; Evening remains unplayed. (L2+L3 together are the acceptance test verbatim, and the same independence pattern is then asserted for every other id in the repeat set — by L1 that set is the Antiphon alone, so the Antiphon legs ARE the general check; the leg is written data-driven over the repeat set so a future second repeated id is covered by construction.)
- **L4 Toggle independence:** toggling Midday's dot off after L3 leaves Morning's mark standing.
- **L5 Mark-all isolation:** Mark-all in Morning marks Morning's Antiphon occurrence and no other block's.
- **L6 Filter + auto-queue:** with Morning's Antiphon played, an unplayed-only queue for Midday still contains Midday's Antiphon (with its intention intro paired); a tap on Midday's Antiphon builds from it (v351 unchanged in shape).
- **L7 Continue:** first-unplayed and the remaining count treat the three occurrences separately across a scripted sequence of marks.
- **L8 Queue dots:** a queue holding two Antiphon occurrences paints each row's dot from its own occurrence.
- **L9 Snapshot v2 round-trip:** a saved queue with Morning + Evening Antiphon occurrences restores each to its own daypart's descriptor; completing the restored Evening entry credits Evening only.
- **L10 Snapshot v1 fallback:** an ids-only record restores first-match, and the next save emits the v2 shape (`v: 2`, `blocks`, `currentBlock`).
- **L11 Changeover:** a store pre-seeded with the bare-id Antiphon mark for the presented date reads all three occurrences UNPLAYED under the new build, while a pre-seeded singleton mark (e.g. `daily-rosary`) and a novena date history still read exactly as before.
- **L12 Novena guard:** `novenaInfo` over a two-date played history for one `novena-<slug>` returns the same count before and after the change; the novena's store keys are the bare canonical id throughout.
- **L13 Singleton stability:** marking Morning Prayer writes the bare `morning-prayer` key — no occurrence suffix anywhere in the store for a non-repeated id.
- **Pristine-tree expectations:** on the pre-v360 tree the occurrence legs (L2, L3, L5, L6, L7, L9, L11-Antiphon half) FAIL (the shared key answers for all three dayparts); the guard legs (L1's set is empty rather than wrong-shaped, L12, L13) may pass or fail by their own logic — the pattern is recorded at Implement from the real pristine run, never asserted from this Plan.

### 2.7 File surface, sequencing, risks

- **Files:** `app/worker/src/client.ts` only (the repeat-set computation at the day-build seam · `playedKey` + the seam signatures · the §2.3 call sites · the snapshot v2) + the SW cache pin in `app/worker/src/ui.ts` (bump to the v360 pin) + the new `harness-v360.mjs`. No migration, no Worker route, no payload, no nightly sheet change.
- **Sequencing under To Ship:** Implement on a release worktree off trunk `muse-draft-week` → scoped harness (v360 + the played-family regressions v344/v347/v351/v355, whose flat-paint premises are already named in the harness-modernization family — Implement re-proves behavior through those harnesses' current passing forms where they stand, and names any leg it cannot re-run) → Review after trunk landing (client-only, no data/auth/migration surface) → Ship with the connector-surrogate deploy + the four-piece flip.
- **Risks named:** (a) a descriptor reaching a §2.3 call site without a block would silently use the bare key — mitigated by the L-legs exercising every consumer with real descriptors, and by Review's extraction check on the call sites; (b) the repeat set must be computed BEFORE the first played read of a paint — the build seam already orders dayDescs before chrome paints (v353's paint dispatch), and L2 fails otherwise; (c) within-block duplicates share a key (the §2.1 limitation) — accepted, none exist; (d) the v1-snapshot fallback credits a restored completion to the first daypart for that one restore — the approved price of Decision 3A's fallback, stated in §2.5-B.
- **Concerns and Information Needs:** none outstanding for Implement. The seasonal-stem question §1 raised is closed by construction (§2.1: the repeat rule names no family). John's acceptance test is a phone check he runs himself after Ship.
