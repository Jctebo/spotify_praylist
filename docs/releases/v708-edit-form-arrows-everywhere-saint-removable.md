# v708 — Edit form: arrows on everything · Saint of the Day removable · prayer title pull-through · Stations prayer must play

- **Status:** IMPLEMENT (§§1–3) — holder: chain-v708-impl — BRANCH READY (not shipped)
- **Base:** `ff0b30b` (origin/main; production pin `ora-pro-nobis-v706-1`)
- **Scope of this phase:** Plan only. No app code in Plan.
- **Execution-risk notice (named per the standing approval, John 2026-11-21):** the worktree creation drew the standing-clone execution-risk notice. Work proceeded under the standing approval in `~/AGENTS.md`; no per-chain word was sought.

## §1 Grounding

### 1.1 Direction (John, verbatim)

> "Also, up down arrows should exist on everything and why is saint of the day disable. It should be able to be removed. Just divine office and loh are disabled only. And everything should have arrows" (John, 2026-11-27 19:12 CT, with a screenshot of the Edit form's Afternoon block)

> "Next stations didn't work. It said it was from the prayer book, were and it didn't even play." + "That stations didn't play" (John, 2026-11-27 19:17–19:18 CT — the widening amendment, recorded as a field report)

**Act law (John, 2026-11-26, `~/MEMORY.md`):** the ONLY hard rule in the Edit-form act system is that Disable exists only for Liturgy of the Hours items. Everything else is John's preference, honored by where he leaves things.

**Field reports (the evidence this Plan grounds on):**

- **19:12 screenshot, Afternoon block:** Saint of the Day (Daily source) paints a toggle, NO ▲▼, NO Remove · Divine Office — Midafternoon Prayer (Daily source) paints the Disable icon, NO ▲▼ · contents rows (Auxilium Christianorum · Catholic Saints & Feasts · Bible in a Year) paint ▲▼ + Remove · the docked player bar shows the raw key `stations-of-the-cross` as a track title.
- **19:17 field report:** the Stations of the Cross item added via Add › Prayers › Prayer Book (the v699 item, `{kind:'prayer', key:'stations-of-the-cross', dayRule:'fridays'}`) stands in his Praylist but DOES NOT PLAY. **The v699 field leg stands FAILED until v708's field check passes.**

### 1.2 Part 1 — Arrows on everything: every row the Edit form paints

The Edit form paints through `opnEditGroupHtml609` (client.ts:29080), one group per day block (day blocks + the canonical seven inserted), and through its twin `opnEditPostureHtml604` (client.ts:25918). Every group paints two row families:

**Family A — contents rows** (`opnContentsRowHtml687`, client.ts:29032). ▲▼ paint UNCONDITIONALLY (`opnMoveButtons684(block, rid, paintIdx, paintLen)`, client.ts:25325, called at the row's tail), and every contents row carries Remove — except a labeled-office contents item (`kind:'source'` with `opnLabeledSlot650(key)`, i.e. only `ext-morning-prayer` / `ext-evening-prayer`), which carries the segtoggle + Disable icon instead. Kinds that paint as contents rows, all arrowed today: `source` (own rows: Morning Offering · Daily Rosary · Marian Antiphon in its three block copies · Auxilium Christianorum · Daily Reflection · The AI Signal), `source` (external, non-slot and slot), `seat`, `prayer`, `episode`, `video`, `daily`, `massdaily`, `day`, `course`, `novena`, `all-novenas`.

**Family B — daily-source rows** (`opnSourceRowHtml686`, client.ts:25436), produced by `opnSpliceSourceRows686` (client.ts:25498) from the nine keys of `OPN686_BLOCK_ROWS` (client.ts:25381) whose store row's block is the painted block (`opn691BlockRowKeys`, client.ts:25472). A source row paints in one of two states:

- **Converted** — a contents representation item stands in the block's materialized list; the entry carries `repRid` (client.ts:25537). ▲▼ paint, addressed to the representation.
- **Spliced** — no representation stands; the row is spliced in by standing rank (`sortOrder`, family) at client.ts:25546–25552 as `{t:'s', row}` with **no `repRid`**.

| # | Source row (store key) | Block | Representation item | Pinned (Disable, no Remove) | ▲▼ today when converted | ▲▼ today when spliced |
|---|---|---|---|---|---|---|
| 1 | `do-invitatory` | Morning | `source:ext-invitatory` | yes | yes | **NO** |
| 2 | `usccb-daily-readings` | Morning (store block `Mass and Homilies`) | `seat:daily-readings` (stray `source:ext-usccb-readings` drops, v687 §2.5) | no | yes | **NO** |
| 3 | `daily-gospel-exegesis` | Midmorning | `source:ext-gospel-exegesis` | no | yes | **NO** |
| 4 | `do-midmorning-prayer` | Midmorning | `source:ext-midmorning-prayer` | yes | yes | **NO** |
| 5 | `do-midday-prayer` | Midday | `source:ext-midday-prayer` | yes | yes | **NO** — spliced in the standing fixture (harness-v691 M3 names this exact case) |
| 6 | `saint-of-the-day` | Afternoon | `source:ext-saint-of-the-day` | no | yes | **NO** — spliced in John's 19:12 screenshot |
| 7 | `do-midafternoon-prayer` | Afternoon | `source:ext-midafternoon-prayer` | yes | Disable paints; **▲▼ NO** — spliced in John's 19:12 screenshot | **NO** |
| 8 | `do-office-of-readings` | Evening | `source:ext-office-of-readings` | no (v687 Amendment A exception: removable, no Disable) | yes | **NO** |
| 9 | `do-night-prayer` | Night | `source:ext-night-prayer` | yes | yes | **NO** |

**The exact seats that withhold the arrows (and Remove) from a spliced row:**

1. `opnSourceRowHtml686` (client.ts:25436): `var rid = opts.repRid || '';` (client.ts:25451) — arrows paint only `if (rid)` (client.ts:25457, `opnMoveButtons684`); the Remove icon paints only `else if (rid)` for a non-pinned row (client.ts:25459). A pinned row's Disable icon paints regardless (client.ts:25458) — which is why the screenshot's Midafternoon row shows Disable and no arrows.
2. `opnOpenSourceMenu687` (client.ts:25827): the Move up / Move down items and the menu Remove stand only under `if (block && rid)` / `else if (rid)`; a spliced non-pinned row's menu carries Frequency alone (plus the toggle on the row).
3. The rule's source: v687 **C-687-5** — "a spliced-in source row carries no ▲▼ and no Remove; its playing seat is held by the standings order (store `sortOrder`)". John's 19:12 word supersedes C-687-5.

**The other 17 store rows never paint as source rows** (proven from `OPN686_BLOCK_ROWS` + `opn691BlockRowKeys`): the 8 own rows and the 2 fallback rows (`sth-lauds`, `sth-vespers` — they share their slot with the primary row) paint, if at all, as Family A contents rows; the 4 closing rows (`usccb-daily-readings` paints as row 2 above; `daily-tv-mass`, `fr-mike-homily`, `barron-sermon`) and `stations-of-the-cross` paint nowhere since v699 (frozen inert).

**Non-item rows, enumerated and excluded by name:** group heads (`opnEditGroupHtml609` head row — a block on/off switch, not an item), the shape strip's block/layer switch rows, the Removed line + Restore buttons (not standing items), and the Add button row. No move discipline exists for any of them; §2 names them non-seats.

**Move disciplines in force (the arrows' acts):**

- Contents arrows: `opnMove684` (client.ts:25334) — swap the addressed occurrence in the materialized list, persist through `opnWrite604` (today-edit or profiles/save by scope).
- Converted source-row arrows: the same `opnMoveButtons684` / `opnMove684` on the representation's rid (v687 §2.1) — the contents discipline; the store row is not written by an up/down move.
- Cross-block Move (not an arrow act): `opnMoveSource691` (client.ts:25643) — the v691 dual write (store write first, read-back verified → `opnMove686` contents move → store rollback on failure). Arrows never cross blocks, so no dual write is prescribed for arrows; the dual write is prescribed for the saint's Remove in §1.3, where both stores genuinely change.

### 1.3 Part 2 — Saint of the Day removable

**(a) Why the saint row is toggle-only in the screenshot.** There is NO saint-specific exception anywhere in the paint or menu code (grep-proven: no `saint-of-the-day` branch in `opnSourceRowHtml686`, `opnOpenSourceMenu687`, or `opnSpliceSourceRows686`). The saint's posture is the spliced posture of §1.2: in John's live Afternoon list no `source:ext-saint-of-the-day` representation stands, so the row splices in with no `repRid`, and the two rid gates (§1.2 seats 1–2) withhold ▲▼ and Remove. The only act left on the row is the toggle — `opnToggleSource686` (client.ts:25579), the store `enabled` flip — which John reads, correctly, as "disable". Even converted, the saint's Remove today is contents-only (`opnRemove604`, client.ts:25860, via `data-p687srcremove` / menu Remove): it removes the representation and records the session's removed set (which suppresses the splice for that session only, `opnSpliceSourceRows686` §2.6 arm); **the store row is never written by a Remove**, so on any profile whose block stands by standing emission (no contents entry) the saint would return whole at the next build.

**(b) What Remove must write, and how removal is expressed in the 26-row store.** The store write route — server `PUT /api/player/source-settings` (index.ts:6514) and its device mirror (client.ts:4078) — demands **exactly the stored 26-row set**: unknown key 400, duplicate 400, `seen.size !== stored.size` 400 ("the row set must be exactly the stored set (no creates, no deletes)"). The client write path `opnSaveSourceSettings686` (client.ts:25569) PUTs all 26 rows carrying only `{sourceKey, block, dayRule, enabled}` per row. **A source-row removal therefore cannot delete a row; it is expressed as field values on the row: `enabled: 0` AND `block: ''` (unplaced), `dayRule` preserved.** This is the seed posture of the one already-unplaced row (`stations-of-the-cross`: family `unplaced`, block `''`, enabled 0, sortOrder null — `OPN_SEED_SOURCES`, client.ts:2775), and both validators accept it (`block === ''` is a named legal value in both PUT validators). Proof the expression removes the saint from every consumer, from shipped code:

- Edit form: `opn691BlockRowKeys` claims a row for a block only when `r.block === block` — block `''` is claimed by no block, so the row paints nowhere (no conversion, no splice).
- Day build: `resolveExternals` (client.ts:23185) stands an external slot only when its primary row has `enabled === 1` — the saint slot `ext-saint-of-the-day` leaves `state.extStanding`, so no composed day carries it, on both the contents-gated path (the `extRebuildDescs` merged filter, client.ts:22202) and the standing-emission path.
- Add ladder universe: `profContentsUniverse590` (client.ts:26573) builds source items from `state.extStanding` — the saint item leaves the universe while removed.
- PUT renumber: both routes set `sortOrder = null` for a row that is not (enabled AND placed) — the row leaves the standings order cleanly, no gap.

**(c) The standing restore path.** Two legs, named separately because they restore different things:

- **The form's own Removed line + Restore** (`opnRestore604`, client.ts:25873; painted in `opnEditGroupHtml609` / `opnEditPostureHtml604` under `data-p604removed`) — the exact inverse act within the session. §2 prescribes the saint's Remove record a removed entry here even in the spliced case, and Restore run the inverse dual write (store row back to its captured `{block, enabled}`, read-back verified; representation restored where one was removed).
- **The Add ladder, across sessions** (`openAddLadder603`, client.ts:27808): the saint series node `seriesNode614('saint-of-the-day')` paints `dailyRow614('saint-of-the-day')` — `opnDailyKeyOk666('saint-of-the-day')` is true (`OPN_DAILY_SERIES_666`, client.ts:2861) and the seat-twin check `dailyTwin614` reads only the host's standing ids, so the gold Daily card stands addable whether or not the source row stands. Adding it writes `{kind:'daily', key:'saint-of-the-day'}` — the saint's daily episode presence returns to the block through `resolveDailyDynamic666`. This restores the saint's **presence**; the **source-row form** returns only through the in-form Restore (or by re-adding the slot item from the ladder's saint node head, `saintItem614`, once the store row stands again). No silent widening: §2 prescribes no ladder change.

**(d) Every other seat anchoring the saint's daily presence — what Remove touches and does NOT touch:**

| Seat | Touched by the form's Remove? |
|---|---|
| `player_source_settings` row `saint-of-the-day` (the store) | **YES** — `enabled 0`, `block ''`, dayRule preserved, whole-table PUT |
| The contents representation `source:ext-saint-of-the-day`, where one stands | **YES** — `opnRemove604` (removed set + scope write) |
| `EXT_SLOTS` entry `ext-saint-of-the-day` (client.ts:19503, courier resolver def) | NO — the slot definition stands |
| `OPN_SEED_SOURCES` saint row (client.ts:2775) + the D1 seed | NO — seed is initial state only |
| Profile seeds / starter profiles (`OPN_SEED_PROFILES`, client.ts:2774) | NO |
| The standing Praylist build machinery (`resolveExternals`, `extRebuildDescs`) | NO — it reads the store values; it is not edited |
| A `daily:saint-of-the-day` contents item (v666 daily series), where one stands | NO — it is a different item; it stands or falls by its own acts |
| The saint podcast feed / courier resolution | NO |

### 1.4 Part 3 — Prayer title pull-through (the raw key in the dock)

**The descriptor composition seat:** `dayAdditionDesc` (client.ts:14511), prayer arm at client.ts:14546–14566. It is the ONE builder every `kind:'prayer'` descriptor flows through: the contents pass (`extRebuildDescs` prayer arm, client.ts:22474, via the synthesized record `recUse619`), the additions weave (`weaveAdditions`, client.ts:14608/14618), and the block-page addition cards.

**Why the key leaks:** the descriptor's title is composed as `(title || a.slug)` (client.ts:14562). Title resolution stands in exactly two places, both conditional:

- The **server fold** resolves it: `dayAdditionsFold` (index.ts:1175) reads `SELECT slug, title FROM prayer_book` (index.ts:1196) and drops a prayer row whose slug has no title or no `PRAYER_AUDIO` duration (index.ts:1224–1231). A server-folded record therefore always carries the true title.
- The **client fold** does not: `opnFoldDay590` (client.ts:4406) synthesizes the contents-prayer addition record as `{block, slug: it.key, lang:'en', afterId:null, kind:'prayer', ref:null}` (client.ts:4475–4478) — **no title, no duration**. `dayAdditionDesc` then falls back to `bookFind(a.slug)` (client.ts:12932), which reads `state.book` — a payload that loads only when a book surface opens (client.ts:14165, 12995) and is routinely NOT in hand at day-build time. Book not in hand → `hit` null → title = `a.slug` = `stations-of-the-cross`, duration 0. That is the screenshot's dock.

**The title source the fix must read:** the Prayer Book record itself — D1 `prayer_book` row slug `stations-of-the-cross`, title **"Stations of the Cross"** (migration `0053_stations_of_the_cross_book_row.sql`; D1 id 78, verified at v699 Review §4.5), served by `GET /api/prayer/book` (`bookPayload`, index.ts:2039, which also folds the `audio` durations from `PRAYER_AUDIO`) and held client-side as `state.book` groups / the Add ladder's catalog (`opnLoadBook604` → `opn604.bookList`, client.ts:26052 area; `bookFind`, client.ts:12932). The standing rule: **a row's title is the original title of the record that actually plays** (John's original-title rule) — for a book prayer, that record is the `prayer_book` row.

**Every seat the leaked title reaches** — all read `desc.title` from the one descriptor; no second composition exists: the Praylist row (`trackCard`, client.ts:18915) · the docked player bar (`updateDock`, from `state.current.title`) · Now Playing (`openNowPlaying` / `updateNowPlaying`) · the track page. One fix at the composition seat heals all four.

### 1.5 Part 4 — The Stations prayer does not play (John, 2026-11-27 19:17 CT)

**(a) Where the playable URL is composed — it IS composed.** `dayAdditionDesc` (client.ts:14563) sets `url: '/api/prayer/book/audio/' + encodeURIComponent(a.slug) + '/' + a.lang`, `available: true`, unconditionally — the identical string the Book page's own builder composes (`prayerAudioDesc`, client.ts:14435). Composition does not fail; the descriptor that reaches the dock (screenshot) carries this URL.

**(c) taken before (b) — the served route stands; it is NOT the seat.** `GET /api/prayer/book/audio/:slug/:lang` (index.ts:5273) serves the R2 object `prayer-audio/<slug>.<lang>.mp3` with Range passthrough (206 + content-range), gated only on `PRAYER_AUDIO[slug]` carrying the language — `"stations-of-the-cross": { en: 1011.8 }` stands at index.ts:1959. The public gate passes it (`publicGate`, index.ts:156: fam `prayer`, sub `book` ∈ `PUBLIC_READS.prayer`), the service worker passes `/api/` through (ui.ts:1247), and the R2 object itself stands sha-verified since the v699 ship (§4.5/§5 of the v699 doc). The route is not re-questioned.

**(b) What the play path demands that this descriptor, as composed on the failing path, lacks** — compared against descriptors that play (own episode: `enclosureUrl` + feed identity; external slot: a `state.extSlots` record + the pass-through route; podcast: stream URL + series identity; Book-page prayer: `prayerAudioDesc` built from the book row in hand, with title + measured duration):

1. **A measured duration.** On the client-fold path (§1.4) the same missed resolution that leaks the title also yields `durationS: 0` (`bookFind` miss → `dur` never set). The descriptor that stands in John's dock is a 0-duration, slug-titled descriptor. Every comparison descriptor carries its measured duration at composition (own/ext/podcast from their payloads; the Book-page prayer from the book row's `audio` fold, `prayerAudioDesc` client.ts:14429). The native contract (`nativeContractItem`, client.ts:20440 → `oraSnapshotTrack`, client.ts:20000) and the queue machinery (`queueLiveDesc`, client.ts:5891; `sectionQueueFrom`, client.ts:6013; `startDesc`, client.ts:5625) all consume this descriptor as-is — no seat re-resolves a prayer's duration or title at play time.
2. **A second, engine-resolvable address.** The prayer descriptor is the only day descriptor whose playable address lives solely in `url`, with `enclosureUrl: null` and no `extSlots` record; `oraSnapshotTrack` reaches it only through the own-address fallback arm (client.ts:20061). It is also never enumerated into the offline/downloaded day set (`offlineEnumerateToday`, client.ts:24120 enumerates own + ext standings only), so no downloaded copy stands behind it.
3. **Harness blindness (why v699 shipped this):** v699's S4 asserted composition + queue inclusion only. No leg drove `startDesc` / the native contract / the served route for the prayer descriptor, so the play leg was never exercised end to end.

**One seat or two — stated plainly:** Parts 3 and 4 share **ONE composition seat**: `dayAdditionDesc` (client.ts:14511) and its title-less client-fold record producer (`opnFoldDay590`, client.ts:4475). The title leak and the 0-duration descriptor are the same miss at the same seat. Part 4's remaining demands (the `oraSnapshotTrack` fallback arm, the offline enumeration) are named as check-first seats in §2, not presumed defects: §2 orders the play drive FIRST, and the fix lands at the branch the drive proves. **Split test: NOT split** — the play leg shares the descriptor seat with Part 3, the candidate fix surface is one function plus at most one snapshot arm, and the drive is harness-scale. v708 carries all four parts to Ship. The one split trigger is named in §2: if the drive proves the failure lives in the native shell (outside this repo), Implement stops and reports, and the coordinator splits that leg.

## §2 Plan

### 2.1 Part 1 seats — arrows on every painted item row

1. **`opnSpliceSourceRows686` (client.ts:25498) — the representation-on-act seat.** A spliced source entry gains a working representation at its first arrow/Remove act: a new helper (working name `opnEnsureRep691`-family, e.g. `opnMaterializeRep708(block, key)`) inserts the representation item — the first id of `opn687RepIds687(key)` (`seat:daily-readings` for the readings; `source:<slotId>` for the other eight) — into the block's materialized list (`opnMaterialize604`) at the entry's painted index, so the entry converts in place. Safe by construction: a spliced state exists only where a stored contents entry already stands for the block (an absent entry materializes the standing universe, which already carries the slot items — §1.3a), so inserting the representation joins a contents list the composition gate already reads; it cannot gate out a sibling that a standing-emission profile was carrying.
2. **`opnSourceRowHtml686` (client.ts:25436) — paint.** ▲▼ paint for EVERY source row: converted rows keep `opnMoveButtons684(block, repRid, paintIdx, paintLen)` byte-for-byte; spliced rows paint the same buttons addressed to a source-row arrow act (new attribute, e.g. `data-p708srcmove="<block>|<key>|up|down"`) whose handler runs seat 1 then `opnMove684` on the materialized representation. Boundary dress stands (first row's ▲ / last row's ▼ disabled in their seats). The pinned rows' Disable icon and the toggle are untouched.
3. **`opnOpenSourceMenu687` (client.ts:25827) — menu parity.** Move up / Move down stand for spliced rows too, through the same seat-1 + `opnMove684` act; the `block && rid` gate widens to `block` + (rid OR key). No other menu item changes.
4. **Contents rows: NO seat.** `opnContentsRowHtml687` already paints ▲▼ + the correct icon for every kind (§1.2 Family A); Review greps that it is absent from the diff.

### 2.2 Part 2 seats — Saint of the Day removable

1. **The act (new, working name `opnRemoveSourceSaint708`)** — a dual write in the v691 order (`opnMoveSource691`, client.ts:25643, is the shape):
   - **Store first:** set the saint row `enabled: 0`, `block: ''`, dayRule preserved, and write the whole 26-row table through `opnSaveSourceSettings686`; read back and verify the row stands at `{enabled:0, block:''}` (a failed verify or a standing `opn686.err` aborts before any contents write).
   - **Contents second:** where a representation stands in the acted block, `opnRemove604` it (removed set + the scope's `opnWrite604`); where none stands, record the removed entry in `opn604.removed[block]` directly (a saint marker entry carrying the captured store values `{block, enabled}`) so the Removed line + Restore paint for the spliced case too.
   - **Rollback:** a contents failure (verified by re-reading the profiles payload — the item still stands) restores the store row's captured `{block, enabled}` through `opnSaveSourceSettings686` and surfaces the form's error line, exactly the v691 rollback shape.
2. **Paint/menu seats:** in `opnSourceRowHtml686`, the saint row (non-pinned, key `saint-of-the-day`) paints the Remove icon in BOTH states — converted (the standing `data-p687srcremove`) and spliced (a new attribute addressed to the seat-1 act). In `opnOpenSourceMenu687`, Remove stands for the saint in both states. **Scope guard:** this widens Remove to the saint ONLY. The other removable source rows (readings · exegesis · Office of Readings) keep their standing converted-state Remove and gain nothing in the spliced state beyond §2.1's arrows (their spliced-state Remove is not prescribed — John's word names the saint; widening it is a deviation, not a reading).
3. **Restore:** the Removed line's Restore for the saint runs the inverse dual write — store row back to its captured `{block, enabled}` (read-back verified) + `opnRestore604` where a representation was removed. The Add ladder is untouched (§1.3c: its saint Daily card is the cross-session presence restore, as shipped).
4. **Both form scopes:** every act above runs identically in today scope and standing scope (the contents writes follow `opnWrite604`'s scope; the store write is scope-independent, as every v686/v691 store act is). The harness asserts both.

### 2.3 Part 3 seat — prayer title pull-through

1. **ONE fix seat: `dayAdditionDesc` (client.ts:14511), prayer arm.** Title resolution order becomes: the record's folded title (`a.title` — the server fold's D1-resolved title stands first, untouched) → the Prayer Book record in hand (`bookFind(a.slug)` → `hit.prayer.title`, with duration from `prayerAudioDesc(hit.prayer, a.lang)`) → **never the slug for a slug that stands in the book**. The `(title || a.slug)` fallback is deleted for book slugs; a slug absent from the book keeps the standing drop posture (the server fold already drops it — client parity, named in §3 if Implement shapes it differently).
2. **The record producer (same seat family, named):** `opnFoldDay590`'s synthesized contents-prayer record (client.ts:4475) gains the book title + duration at synthesis when the book stands in hand, so the common path carries them on the record like the server fold does. The day build's descriptor composition must not run ahead of the book where the book is loadable: Implement wires the standing book load (`api('/api/prayer/book')` → `state.book`, the client.ts:14165 precedent) ahead of the contents-prayer composition or re-composes on its settle — the exact wiring is Implement's, the invariant is §2.5's: **no descriptor for a book prayer ever carries its slug as its title or 0 as its duration when the book record stands.**
3. **Non-seats:** `trackCard`, `updateDock`, Now Playing, the track page (readers of `desc.title` — healed by the one seat); the server fold (`dayAdditionsFold` — already correct); `prayerAudioDesc` (the Book page's builder — already correct).

### 2.4 Part 4 seats — Stations must play end to end

1. **Seat 0 — drive first (no fix before the drive).** Implement's first act is the §2.5 play drive on the pre-fix tree with the real fixture: compose the Stations descriptor through the contents path, run `queueLiveDesc` → `playTrack`/`startDesc` → `nativeContractItem`, and GET the descriptor's URL against the harness's real Worker. §3 names the exact branch that fails (element load · contract null · route status · 0-duration) BEFORE any Part 4 fix seat is touched.
2. **Prescribed fix surface (bounded):** the descriptor-composition seat of §2.3 (title + measured duration at composition — the same fix) and, only if the drive proves it, the `oraSnapshotTrack` prayer arm (client.ts:20000) so a `kind:'prayer'` descriptor hands the native engine its book-audio address under its own kind instead of the own-address fallback. **Split trigger:** if the drive proves the failure lives in the native shell (outside this repo) or in a seat larger than these two, Implement STOPs and reports; the coordinator splits that leg and v708 ships Parts 1–3.
3. **Non-seats:** the served route (index.ts:5273), `PRAYER_AUDIO`, the R2 object, the public gate, the service worker — all proven in §1.5c; absent from the diff.

### 2.5 Harness spec — `app/worker/harness-v708.mjs` (for Implement)

**Fixtures (Improvement D — production sources named):**

- **F1 — the captured real profile:** harness-v687's `JOHN_CONTENTS` (John's real profile as screenshotted 2026-11-26, harness-v687.mjs:13–25) PLUS a v708 Afternoon variant matching the 2026-11-27 19:12 screenshot — Afternoon contents standing WITHOUT `source:ext-saint-of-the-day` and WITHOUT `source:ext-midafternoon-prayer` (the spliced state), its contents rows Auxilium · Catholic Saints & Feasts (`daily:catholicsaints`) · Bible in a Year (`daily:bible-in-a-year`). Implement captures John's live Afternoon contents verbatim (door read of the profiles payload) and names the capture in §3; the screenshot variant stands if the live read differs in shape only, never in the two absences.
- **F2 — the real Prayer Book row:** the `stations-of-the-cross` row as produced in v699 — slug · title "Stations of the Cross" · category "The Raccolta" · the Liguori body (migration 0053; D1 id 78) — with `PRAYER_AUDIO` duration **1011.8** (the v699 renders record, `prayer-audio/stations-of-the-cross.en.mp3`).
- **F3 — the 26-row seed store** extracted from the tree (the harness-v687 F-fixture discipline), settings version standing.

**Legs:**

- **A (arrows everywhere):** for EVERY painted item row in EVERY block of F1 (both scopes, both builders): the row's painted HTML carries a ▲ and a ▼ control (`data-p684move` or the §2.1 spliced-row attribute), named row by row in the harness output — contents kinds (source · seat · prayer · episode · video · daily · massdaily · day · course · novena · all-novenas) and all nine source rows in BOTH states (converted and spliced; F1's Afternoon + Midday furnish the spliced instances, the harness forces the remaining keys' spliced state by removing their representations from a fixture copy). An arrow act on a spliced row moves it: painted order changes, the materialized list gains the representation at the moved position, and the composed day's order follows.
- **S (saint Remove + restore):** in BOTH scopes — Remove on the spliced saint (F1 Afternoon): the whole-table PUT carries all 26 rows with the saint at `{enabled:0, block:'', dayRule:'daily'}` and every other row byte-identical; read-back stands; the row paints in NO block; the composed day (Friday fixture) carries no saint descriptor; the Removed line names "Saint of the Day". Restore: the row repaints in Afternoon, the store read-back stands at its captured values, the composed day carries the saint again, byte-identical to the pre-Remove composition. Remove on the CONVERTED saint (representation restored into the fixture): both writes land (store unplaced + representation in the removed set), same end state. The Add ladder's saint Daily card still paints addable after a Remove (the cross-session presence leg, §1.3c).
- **O (office discipline — the act law):** the five pinned rows (`OPN687_PINNED`) paint Disable and NO Remove icon and NO menu Remove, in both states; every non-LOH painted row (the saint · readings · exegesis · Office of Readings · every contents kind) carries Remove; NO non-office row paints a Disable icon anywhere (row or menu). Labeled-office CONTENTS items (`ext-morning-prayer` / `ext-evening-prayer`) keep segtoggle + Disable, unchanged.
- **T (title pull-through):** the contents-prayer descriptor for F2, composed through the client fold with the book NOT pre-loaded in hand, reads title **"Stations of the Cross"** and durationS **1011.8**; the Praylist row, the dock (`updateDock` output), Now Playing, and the track page each paint "Stations of the Cross" and none paints `stations-of-the-cross` as a title. **Fail-on-old:** on the pre-fix tree this leg FAILS (slug title, duration 0) — recorded in §3.
- **P (play end to end — Part 4):** compose the real Stations item from F2 through the contents path on the Friday fixture; drive the play path: `queueLiveDesc(desc)` returns the descriptor; `playTrack`/`startDesc` runs without a pass-over; `nativeContractItem(desc)` is non-null with `mediaUri` equal to the origin + the book-audio URL and `durationS` 1011.8; a GET of the descriptor's URL against the harness's real Worker answers **200 `audio/mpeg`** with a non-zero content-length, and a Range GET answers **206** with a content-range — the served-route proof. **Fail-on-old proven for the play leg:** the same drive on the pre-fix tree fails at the branch §3 names (expected: the 0-duration/slug descriptor at composition).
- **Regressions (standing tallies, re-points named):** harness-v687 **42/0** — with exactly the re-points its C-687-5 legs require (a spliced row carrying no ▲▼ / no Remove, and the saint's spliced posture), each marked `superseded-by-v708` in code and named in §3; harness-v691 **41/0** — its M3 qualification (the spliced Midday row carries no Move item) re-pointed the same way if the leg asserts it, named in §3; harness-v699 **34/0** — unmodified (any re-point named in §3 before it is made). No other harness is touched.

### 2.6 Ordered Implement seat list

1. **Play drive (§2.4 seat 0)** on the pre-fix tree; record the failing branch in §3. Split trigger check.
2. **Part 3 + Part 4 descriptor seats** (§2.3, §2.4 seat 2): `dayAdditionDesc` resolution + the `opnFoldDay590` record; the `oraSnapshotTrack` arm only if the drive proves it.
3. **Part 1 seats** (§2.1): representation materialization helper · `opnSourceRowHtml686` paint · `opnOpenSourceMenu687` parity.
4. **Part 2 seats** (§2.2): the saint Remove dual write + paint/menu + Restore inverse.
5. **Write harness-v708** (§2.5) and run it green; produce fail-on-old for legs T and P.
6. **Re-point + run the regressions** (v687 42/0 · v691 41/0 · v699 34/0, re-points named).
7. **Write §3** (seats changed with built-tree citations · the play drive's failing branch on the old tree · both fail-on-old tallies · all harness tallies · the F1 live-capture note) and commit. Pin bump, merge, deploy are Ship's acts — not Implement's. **Field leg after Ship:** John's look — arrows on the Afternoon rows, saint Remove + Restore, Stations titled "Stations of the Cross" in the dock and PLAYING; the v699 field leg stays FAILED until he confirms the play.

### 2.7 Risks

- **R1 — representation materialization changes a stored list.** Inserting a rep item writes a contents entry the profile did not carry. Mitigation: it lands only on an explicit arrow/Remove act (John's own act, in his scope), at the painted position, and §2.5 leg A asserts the composed order follows the painted order — no silent reorder.
- **R2 — the saint's store unplace vs. the toggle.** After a Remove, the saint row paints nowhere, so its toggle is gone with it; Restore is the only road back inside the form. Mitigation: §1.3c's two named restore legs + leg S asserts both; the Removed line paints in both scopes.
- **R3 — whole-table PUT safety.** The saint Remove rides the standing whole-table write; a malformed row breaks every source act. Mitigation: leg S asserts all 26 rows with the other 25 byte-identical (the v699 S9 discipline).
- **R4 — book-in-hand timing (Part 3).** If Implement's wiring re-composes on book settle, a descriptor composed before the settle must not stand slug-titled in a painted surface after it. Mitigation: leg T composes with the book NOT pre-loaded — the hostile order is the fixture, not the hope.
- **R5 — Part 4 unknown branch.** The play failure's exact branch is unproven until the drive. Mitigation: seat 0 is drive-first with a named split trigger (§2.4); no fix is prescribed blind beyond the two bounded seats.

### 2.8 Open points index

- **OPEN-1 (§2.1):** the spliced-row arrow attribute's name and the materialization helper's name are Implement's, inside the named seats; no behavior is open.
- **OPEN-2 (§1.3c):** the source-row form's cross-session restore (beyond the in-form Restore and the ladder's Daily presence) is NOT prescribed — if John wants the slot item itself re-addable while the store row stands unplaced, that is a ladder widening for a later word. Named, not silently widened.
- No other element's seat is open: the removal expression, the fix seats, the harness, and the split trigger are decided above.

## §3 Implement record — holder: chain-v708-impl

- **Disposition: BRANCH READY.** All four parts implemented at the prescribed seats; harness-v708 green; regressions run with every re-point named below. Not shipped — pin bump stands in-tree at `ora-pro-nobis-v708-1` for Ship.
- **Execution-risk notice (named per the standing approval, John 2026-11-21):** worktree/clone processing proceeded under the standing approval in `~/AGENTS.md`; no per-chain word was sought.

### 3.1 Part 4 drive-first findings (§2.4 seat 0 — driven on the pre-fix tree BEFORE any fix)

Drive: the real built Worker + Chromium, the real v699 Stations render bytes behind a fake AUDIO binding, John's contents shape with the v699 Stations item (`{kind:'prayer', key:'stations-of-the-cross', dayRule:'fridays'}`) in Afternoon, the book NOT in hand. Findings, branch by branch:

- **Served route — NOT the seat.** `GET /api/prayer/book/audio/stations-of-the-cross/en` against the real Worker: **200 `audio/mpeg`, content-length 8094765**; Range GET: **206, `content-range: bytes 0-99/8094765`** (§1.5c stands).
- **Composition — THE BREAK (shared with Part 3).** The descriptor the contents path composes reads **title `stations-of-the-cross` (the slug), durationS 0** — the `bookFind` miss of §1.4, exactly as prescribed.
- **queueLiveDesc:** returns the descriptor as itself — no re-resolution; the 0-duration slug descriptor is what every play path receives.
- **Native contract — the play branch that fails.** `oraSnapshotTrack` reaches the prayer descriptor only through the own-address fallback arm: `nativeContractItem` hands the native engine **kind `episode`, durationS 0** (mediaUri correct). In the native shell — John's phone — the Stations item crosses as a 0-duration episode, not as a prayer with its measured duration. **The split trigger does NOT fire:** the failure lives in this repo, at the two bounded seats §2.4 named.
- **Web element:** with the real route behind it, the element loads and plays even pre-fix (readyState 4, currentTime advancing, element duration 1011.768) — the web element path is not the break; the composition + native-contract branches are.

### 3.2 Seats touched (built tree, `app/worker/src/client.ts` unless named)

**Part 1 — arrows on everything (§2.1):**
- `opnMaterializeRep708(block, key)` (new, after `opnSpliceSourceRows686`): inserts the representation item (`opn687RepIds687`'s first id — `seat:daily-readings` for the readings, else `source:<slotId>`) into the block's materialized list at the entry's painted index (painted index minus the spliced entries before it), so the entry converts in place; returns the occurrence-qualified rid. `opnSrcMove708(block, key, dir)`: materialize, then the standing `opnMove684`. **No store write rides an arrow act** (leg A asserts zero source-settings PUTs).
- `opnSourceRowHtml686`: spliced rows paint the same ▲▼ under the new attribute `data-p708srcmove="<block>|<key>|up|down"`, boundary dress matching `opnMoveButtons684`'s seats; converted rows byte-for-byte as before.
- `opnOpenSourceMenu687`: the `block && rid` gate widens to `block && (rid || key)` for Move up / Move down (spliced rows act through `opnSrcMove708`); **Move to block… stays converted-only** — it is not an arrow act and §2.1 names no seat for it (this also keeps harness-v691's M3 qualification standing, §3.5).
- Contents rows: **no seat** — `opnContentsRowHtml687` is absent from the diff (grep-verified, 0 occurrences in the client diff).
- Wiring: `[data-p708srcmove]` in the standing view bind, beside `[data-p684move]`.

**Part 2 — Saint removable (§2.2):**
- `opnRemoveSaint708(block)` (new): the dual write in the v691 order. Store FIRST — saint row `enabled: 0`, `block: ''`, dayRule preserved, whole-table PUT through `opnSaveSourceSettings686`, read-back verified at `{enabled:0, block:''}` (a failed verify aborts before any contents write). Contents SECOND — `opnRemove604` where a representation stands (`opnSaintRepStand708`); where none stands, the removed entry is recorded directly in `opn604.removed[block]` as `{kind:'source', key:'ext-saint-of-the-day', saint708:{block, enabled, sortOrder, blockOrder}}` so the Removed line + Restore paint for the spliced case. Contents verify by re-reading the profiles payload (`opnLoadRes604` + the effective list): the representation still standing rolls the store row back to its captured values and surfaces the form's error line.
- **Rank preservation (named addition inside the seat):** the capture carries the saint's `sortOrder` and its block's full placed order (`blockOrder`). The whole-table PUT renumbers each block in body order, and an unplace/re-place cycle renumbers the saint's siblings in its absence — without the captured order, Restore seats the saint last in its block and the composed day is NOT byte-identical. `opnRestoreSaint708` re-seats the captured order on the rows before its PUT, so the renumber returns every Afternoon row to its captured rank (leg S proves byte-identical composition).
- Paint/menu: the saint paints the Remove icon under `data-p708saintremove="<block>"` in BOTH states (converted rows route away from `data-p687srcremove` for the saint only), and its menu Remove stands in both states, addressed to `opnRemoveSaint708`. **Scope guard stands:** no other spliced row gains a Remove (paint or menu); the five pinned rows keep Disable and no Remove (leg O).
- `opnRestoreSaint708(block, rowId)` (new): the inverse dual write — store row back to its captured `{block, enabled}` (+ the captured block order), read-back verified, then `opnRestore604` where a representation was removed; the spliced marker leaves the removed set without a contents item write. The Removed line's Restore button for a saint entry paints `data-p708saintrestore` in BOTH form builders (`opnEditPostureHtml604` + `opnEditGroupHtml609`); every other removed entry keeps `data-p604restore`. Both form scopes run identically (leg S: today + standing).

**Part 3 — prayer title (§2.3):**
- `dayAdditionDesc` prayer arm: resolution order is now the record's folded title → the Prayer Book record in hand → never the slug for a book slug. "In hand" widens by one named source: `bookFind` (state.book) **or `opnBookCopyFind708`** (new — the v462 device copy, `bookReadCopy()`, the book's own cache that the Mass seat already reads through `massBookGroups`). Where the book stands in neither hand, `opnEnsureBook708` (new) kicks the standing book load one-flight-at-a-time; its settle adopts `state.book`, writes the device copy, and re-composes the standing day (`extRebuildDescs(state.dayPayload)`) — the R4 invariant: no slug-titled / 0-duration descriptor stands painted after the settle. **Client-parity drop (named per §2.3.1):** where the book stands in hand and the slug stands nowhere in it, the descriptor stands `available: false` — the server fold's drop posture.
- `opnFoldDay590`'s synthesized contents-prayer record (client.ts:4475 family) gains `title` + `durationS` at synthesis when the book stands in hand (either source), like the server fold's record.
- Non-seats stand: `trackCard`, `updateDock`, Now Playing, the track page (readers — healed by the one seat, leg T), the server fold, `prayerAudioDesc`.

**Part 4 — Stations plays (§2.4 seat 2):**
- The descriptor seat above (title + measured duration at composition).
- `oraSnapshotTrack`: a new prayer arm stands BEFORE the own-episode arm — a `kind:'prayer'` descriptor hands the native engine its book-audio address **under its own kind** (`kind:'prayer'`, its non-blob `url` absolutized, `needsAuth` on-origin, measured `durationS`), instead of the own-address fallback that crossed it as kind `episode`.
- Non-seats stand: the served route, `PRAYER_AUDIO`, the R2 object, the public gate, the service worker — absent from the diff.

**Pin:** `app/worker/src/ui.ts` — `ora-pro-nobis-v706-1` → `ora-pro-nobis-v708-1` (the standing pin seat).

### 3.3 Fixtures (Improvement D — sources named)

- **F1:** harness-v687's `JOHN_CONTENTS` verbatim, with the Afternoon block replaced by the §2.5 screenshot variant (contents: Auxilium Christianorum · `daily:catholicsaints` · `daily:bible-in-a-year`; NO `source:ext-saint-of-the-day`, NO `source:ext-midafternoon-prayer`). **Live-capture note:** at Implement (2026-11-27 ~19:40 CT) the production D1 `prayer_profiles` read (Cloudflare connector, database `ora-pro-nobis-app`) carries only the three starter profiles with NO contents field — John's contents are device-local under the v590+ personal-data model and no door read of the device store exists — so the Plan's screenshot variant stands under §2.5 F1's own fallback (the two absences are the screenshot's, verbatim). **F1b** (harness-local): F1 with the remaining six keys' representations removed, forcing all nine source rows spliced across the two fixtures.
- **F2:** the real Prayer Book row — slug `stations-of-the-cross`, title "Stations of the Cross", category "The Raccolta", duration **1011.8** — asserted in-harness against `index.ts`'s `PRAYER_AUDIO` entry (migration 0053; D1 id 78); leg P's route proof serves the real v699 render bytes (`~/workspace/projects/ora-pro-nobis/v699-prayer-audio/stations-of-the-cross.en.mp3`, 8,094,765 bytes) through a fake AUDIO binding behind the real Worker route.
- **F3:** the 26-row seed store extracted from this tree (asserted 26).

### 3.4 harness-v708 tallies (`app/worker/harness-v708.mjs`)

- **32 ok, 0 bad.** By leg: fixtures F/F2/F3 **3/3** · A (arrows) **8/8** — every painted row named row-by-row in the harness output for F1 + F1b (all nine source rows in both states across the fixtures; a spliced saint arrow act moves the painted order, materializes the representation at the moved position, the composed day follows, and zero store writes ride it; menu parity with no Move to block… on spliced rows) · S (saint) **9/9** — spliced + converted Remove/Restore in today scope, spliced Remove/Restore in standing scope (save-path contents write), the 26-row PUT byte-identity outside the saint row, the standing-emission composed day losing and regaining the saint byte-identically, the Add ladder still painting after a Remove · O (office discipline) **5/5** — the five pinned rows Disable + no Remove in both states, every non-LOH row Remove, no non-office Disable anywhere, labeled-office contents items unchanged · T (title) **3/3** — descriptor composed with the book NOT pre-loaded settles to "Stations of the Cross" / 1011.8; the device-copy path resolves synchronously; Praylist row, dock, and Now Playing paint the title and never the slug · P (play) **4/4** — queueLiveDesc stands the descriptor; `nativeContractItem` non-null, kind `prayer`, mediaUri = origin + the book-audio URL, durationS 1011.8; `startDesc` runs without a pass-over and the element plays the real bytes; the descriptor URL against the real Worker answers 200 `audio/mpeg` (non-zero length) and 206 with a content-range on a Range GET.
- **Fail-on-old (pre-fix tree `3846c84`, `ORA_WT`):** harness-v708 reads **9 ok, 23 bad** — legs T fail (slug title, durationS 0) and the P contract leg fails (kind `episode`, durationS 0), as §2.5 requires; the route + web-element legs pass on the old tree, matching the drive (§3.1).

### 3.5 Regressions + every re-point named

- **harness-v699: 34 ok / 0 not-ok — unmodified, no re-point.**
- **harness-v691: no re-point made.** Its M3 qualification (the spliced Midday row carries no Move to block…) stands under v708 because Move to block… remains converted-only (§3.2 Part 1). Run evidence below.
- **harness-v687: two re-points, both marked `superseded-by-v708` in code, both in L6 (the saint's acts):** (1) the Remove click selector `[data-p687srcremove="Afternoon|source:ext-saint-of-the-day"]` → `[data-p708saintremove="Afternoon"]` — the saint's Remove seat is the dual-write act in both states now; (2) the Restore click selector `[data-p604restore="Afternoon|source:ext-saint-of-the-day"]` → `[data-p708saintrestore="Afternoon|source:ext-saint-of-the-day"]` — the saint's Restore seat is the inverse dual write. L6's assertions are unchanged and pass (the row leaves the form, the Removed line names "Saint of the Day", the composed day loses and regains the descriptor byte-identically — now with the store unplace/re-place riding underneath). No C-687-5 assertion text stands in harness-v687's legs (the spliced-posture assertions live in harness-v691's M3, above); the Plan's pre-named v687 re-point family is otherwise empty.
- **Environment note on the v687/v691 tallies (named, not hidden):** at this base, harness-v687 and harness-v691 cannot complete unmodified in this environment — both crash on the closing-row seats (`fr-mike-homily` paints nowhere in the Edit form since v699 removed the "Mass and Homilies" closing section; L12, the L7 closing menu, the L7 row-icons' closing arm, and v691 M3's closing arm assert that paint). This is **pre-existing at the base**: run through crash-guarded copies (guards in /tmp only, never committed), the tallies are **harness-v687: 38 ok / 4 bad** and **harness-v691: 40 ok / 1 bad** on the pre-fix tree AND **identical ok/FAIL sets on the v708 tree** — every bad leg is the stale closing-row family (v687: L1's ≥10 source-row count, L12, L7 closing menu, L7 row icons; v691: M3 closing arm), and **no leg changes verdict between the pre-fix and v708 trees**. The Plan's standing tallies (42/0 · 41/0) count those closing-row legs as passing in the environment they were authored in; v708 introduces no regression against them, and the two saint re-points above are the only committed regression-harness edits.

### 3.6 Commits (branch `release/v708`, base `ff0b30b`)

- `b13bec1` — Part 3+4 descriptor seats + the `oraSnapshotTrack` prayer arm.
- `6723589` — Part 1+2 (materialize/arrows, saint dual writes, Removed-line seats, wiring) + the pin bump.
- `1dc3369` — harness-v708 + saint rank preservation + the `opnEnsureBook708` in-flight shape.
- `c9374b9` — saint Restore rank: the marker capture carries `blockOrder`.
- This §3 + the harness-v687 saint re-points ride the final Implement commit.

**BRANCH READY — Implement stops here. Ship (merge · deploy · board closeout) is not Implement's act. Field leg after Ship stands as §2.6 names it: John's look — arrows on the Afternoon rows, saint Remove + Restore, Stations titled "Stations of the Cross" in the dock and PLAYING; the v699 field leg stays FAILED until he confirms the play.**

## §4 Review record — holder: chain-v708-review

- **Verdict: PASS** — clear to Ship at pin `ora-pro-nobis-v708-1`. Light Review: every tally below was re-run independently by Review (not §3's numbers restated); the diff was audited hunk by hunk; Parts 2 and 4 were code-read at their seats.
- **Execution-risk notice (named per the standing approval, John 2026-11-21):** worktree/clone processing (incl. the temporary pre-fix worktree at base `ff0b30b`, removed after use) proceeded under the standing approval in `~/AGENTS.md`; no per-chain word was sought.

### 4.1 harness-v708 — independently re-run: **32 ok, 0 bad**

- By leg (Review's run): F/F2/F3 **3/3** · A **8/8** · O **5/5** · S **9/9** · T **3/3** · P **4/4** — identical to §3.4.
- Load-bearing legs spot-driven in Review's own run output: **A** — the spliced saint arrow act moves the painted order, materializes `source:ext-saint-of-the-day` at the moved position, the composed day follows, and **zero source-settings PUTs** ride the act; all nine source rows arrowed in both states across F1+F1b. **S** — spliced + converted Remove/Restore in today scope and spliced Remove/Restore in standing scope (profiles/save path); the 26-row PUT carries every non-saint row byte-identical; Restore returns the composed day **byte-identical** to pre-Remove. **O** — the five pinned office rows paint Disable and no Remove in both states; every non-LOH row carries Remove; no non-office Disable anywhere. **T** — descriptor composed with the book NOT pre-loaded settles to title "Stations of the Cross", durationS **1011.8**; Praylist row, dock, and Now Playing paint the title, never the slug. **P** — `nativeContractItem` non-null, contract kind **`prayer`**, mediaUri = origin + the book-audio URL, durationS 1011.8; `startDesc` plays the real bytes; the descriptor URL against the real Worker answers **200 `audio/mpeg`** and **206** with a content-range on a Range GET.

### 4.2 Fail-on-old — harness-v708 against the pre-fix tree (base `ff0b30b`, `ORA_WT`)

- **Leg T fails on the old tree:** descriptor title `stations-of-the-cross` (the slug), durationS **0** — as §2.5 requires.
- **Leg P's contract leg fails on the old tree:** contract kind **`episode`**, durationS **0** (the own-address fallback arm of §3.1) — as §2.5 requires.
- The route and web-element legs pass on the old tree, matching §3.1's drive-first finding (served route and web element were never the break). The A/S/O legs also fail on the old tree at their v708 seats (spliced rows unarrowed; the saint carries no Remove) — the expected pre-fix posture. (§3.4's 9/23 total was recorded against `3846c84`; Review's run was against `ff0b30b` and confirms the required T/P failure modes verbatim.)

### 4.3 Regressions — independently reproduced

- **harness-v699: 34 ok / 0 bad — unmodified** (Review's run; the file is absent from the branch diff).
- **harness-v687 / harness-v691 crash, reproduced:** both crash unmodified in this environment at the closing-row seats (v687 at the L7 closing `openMenu`, harness-v687.mjs:362 in Review's run; v691 at the M3 closing arm, `closing[0].label` on an empty menu) — pre-existing at the base since v699 removed the closing section; not a v708 introduction.
- **Crash-guarded copies (guards in /tmp only, never committed — Review's own guards):** harness-v687 **38 ok / 4 bad on BOTH trees** — the original (pre-re-point) copy on the pre-fix tree and the committed re-pointed copy on the v708 tree — with **identical FAIL sets**: L1 (the source-row paint leg), L12, L7 closing menu, L7 row icons — every bad leg is the stale closing-row family, and no leg changes verdict between the trees. harness-v691 **40 ok / 1 bad on BOTH trees**, sole bad = the M3 closing arm, identical both sides.
- **Cross-check named for completeness:** the re-pointed v687 copy run against the PRE-fix tree reads 36/6 — the same 4 closing-family bads plus the 2 L6 saint legs, which fail there because the re-pointed selectors name v708's saint seat (`data-p708saintremove`), absent pre-fix. That is fail-on-old evidence for the saint seat, not a regression; §3.5's identical-set claim holds for the correct pairing (original-on-old, re-pointed-on-v708), reproduced above.
- **v687 re-points verified in the diff:** exactly two selector changes in L6 (Remove → `data-p708saintremove="Afternoon"`, Restore → `data-p708saintrestore=…`), each marked `superseded-by-v708` in code; L6's assertions are unchanged. harness-v691 carries **no** committed change (absent from the diff) — its M3 qualification stands because Move to block… remains converted-only (leg A menu parity confirms: spliced menu carries Move up/down, no Move to block…).

### 4.4 Diff audit (base `ff0b30b` → `72b46b2`, 5 files)

- **Files:** `client.ts` (+291/−14 family), `ui.ts` (pin only), `harness-v708.mjs` (new), `harness-v687.mjs` (the two re-points of §4.3), this doc. Nothing else.
- **Client hunks land only on the prescribed seats:** `opnFoldDay590` record (title/duration at synthesis) · the `bookFind` family additions (`opnBookCopyFind708` / `opnEnsureBook708` — inside §2.3.2's "the exact wiring is Implement's" latitude) · `dayAdditionDesc` prayer arm · the `oraSnapshotTrack` prayer arm · the `wirePrayersView` bind for the three new `data-p708*` attributes · `opnSourceRowHtml686` paint · `opnMaterializeRep708`/`opnSrcMove708` (new, after `opnSpliceSourceRows686`) · `opnRemoveSaint708`/`opnRestoreSaint708` + `opnSaintRepStand708` (new) · `opnOpenSourceMenu687` (the `block && (rid || key)` widening for Move up/down + the saint's menu Remove) · the Removed-line saint Restore seat in both form builders (`opnEditPostureHtml604`, `opnEditGroupHtml609`). Pin: `ora-pro-nobis-v706-1` → `ora-pro-nobis-v708-1` in `ui.ts` only.
- **Named non-touches confirmed absent from the diff (grep over the client diff, 0 occurrences each):** `EXT_SLOTS`, `OPN_SEED_SOURCES`, seed/starters (`OPN_SEED_PROFILES`), `opnContentsRowHtml687`. `opnMoveSource691` is **unmodified** — its single diff appearance is a hunk-header context line; the v691 dual-write seat stands beyond the prescription untouched. The served route, `PRAYER_AUDIO`, and the server fold are absent from the diff.
- **Scope guard confirmed:** no non-saint spliced row gained a Remove (paint or menu — leg O + code read); the saint's Remove is addressed only to `opnRemoveSaint708`; Move to block… stays converted-only (leg A menu parity + the menu diff).

### 4.5 Part 2 soundness (code-read at the seat)

- `opnRemoveSaint708`: capture first (`{block, enabled, sortOrder, blockOrder}` — the block's full placed order) → **store first** (saint `enabled:0`, `block:''`, dayRule preserved, whole-table PUT via `opnSaveSourceSettings686`) → **read-back verify** (`{enabled:0, block:''}` + no `opn686.err`; a failed verify restores the captured values in memory and aborts before any contents write) → **contents second** (`opnRemove604` where a representation stands; the `saint708` marker into `opn604.removed[block]` where none stands) → contents verify by re-reading the profiles payload, with **store rollback** (captured `{block, enabled}` re-PUT + the form's error line) when the representation still stands.
- `opnRestoreSaint708`: the inverse — captured values restored on the row, the **captured `blockOrder` re-seated on the rows before the PUT** (so the PUT renumber returns every row of the block to its captured rank), read-back verified, then `opnRestore604` / marker removal. Leg S's byte-identical composition in both scopes is the driven proof of the rank capture.
- Both scopes run the same acts (leg S: today + standing, the standing contents write riding profiles/save).

### 4.6 Part 4 soundness (code-read at the seat)

- The `oraSnapshotTrack` prayer arm stands **before** the own-episode arm (after the ext-slot arms, which a prayer descriptor never enters): a `kind:'prayer'` descriptor hands the engine kind **`prayer`**, its non-blob `url` absolutized against the origin, `needsAuth` on-origin, and its measured `durationS`. A prayer descriptor with no non-blob address returns null (no fabricated address).
- **Nothing else in the snapshot contract changed:** the arm is purely additive and gated on `kind === 'prayer'`; the homily exclusion, ext-slot arms, own-episode arm, and fallback stand byte-for-byte as at base (diff-verified). The web element path still plays (leg P's `startDesc` drive on the real bytes).

### 4.7 Reservations (named, none blocking)

- **R-708-1 (§3.5 wording):** §3.5 characterizes the failing v687 L1 leg as "L1's ≥10 source-row count"; in Review's runs the failing L1 check is the source-row title/grow-column paint leg. The leg identity (L1), the closing-row family, and the identical-on-both-trees verdict all stand as §3.5 claims — only the leg's gloss differs. No action required.
- **Field leg stands as §2.6/§3 names it:** John's look after Ship — arrows on the Afternoon rows, saint Remove + Restore on his phone, Stations titled "Stations of the Cross" in the dock and PLAYING. The v699 field leg stays FAILED until John confirms the play; this PASS clears Ship, it does not close the field leg.

**Review stops here. Ship (merge · deploy · board closeout) is the Ship seat's act.**
