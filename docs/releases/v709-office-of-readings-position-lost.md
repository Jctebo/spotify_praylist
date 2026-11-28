# v709 — Office of Readings restarts from scratch on re-select (position lost)

## §1 Grounding

- **Field report (John, voice call, 2026-11-27 ~19:20 CT, verbatim):** "I was listening to the Office of Readings earlier and I went to another track and came back and then when I selected Office of Readings it started from scratch."
- **Board:** release row 1690 · slug `office-of-readings-position-lost` · status Scope at Plan read (DevOps Board D1 `f5d8f251-f6bf-4055-bb0c-1c807a123722`, read via cf.py at Plan time; scope text read verbatim from the row).
- **Production pin:** `ora-pro-nobis-v706-1`. **Base commit:** `ff0b30b` (v706 §5 Ship record, head of `origin/main` at Plan time). Branch `release/v709`, worktree `~/workspace/.worktrees/v709`, created from `origin/main` — the standing clone's local checkout was not disturbed.
- **v708 overlap:** v708 (Edit-form seats) stands at Plan commit `f5baa0e` on `release/v708`, one doc file only (`docs/releases/v708-…md`), no code seats touched yet. Its territory is the Edit form (arrows / saint removal / prayer titles / Stations play leg). v709's seats are the player position family in `app/worker/src/client.ts` (§2.3) — no seat overlap with v708's named territory. v709 does not touch any v708 seat or file.
- **Standing discipline under test (v680, doc `v680-resume-position-survives-app-kill.md`):** position saves every 5 s while playing, from the player's true position, into the store a fresh tap reads · a stored position under 5 s = not started · crossing 95% = read everywhere + position cleared · a partly played track resumes by tapping it. v681 kill behavior stands beside it and is out of scope for change.

### §1.1 The descriptor — how the Office of Readings is composed

- The Office of Readings is an **ext slot**, not an own track and not a podcast: seed source `do-office-of-readings` (family `external`, block **Evening**, sortOrder 1, `client.ts:2775` OPN_SEED_SOURCES) → slot id **`ext-office-of-readings`** in `EXT_SLOTS` (`client.ts:19505`) and in the server resolver table (`index.ts:2219`, token key `DO_OFFICE`, tokens `["Office of Readings"]`, slug suffix `/-or$/` at `index.ts:2860`).
- It is **its own source/slot, distinct from the two labeled office hours**: `opnLabeledSlot650(slotId)` is true ONLY for `ext-morning-prayer` and `ext-evening-prayer` (`client.ts:2320`). The Office of Readings is **not** a labeled slot — it carries no second (Sing the Hours) side, no `_side650` stamp, and no per-side discriminator anywhere. The v651 per-side discriminator (`extSideTag650`, `playedKeyOcc`'s `@side` suffix, `extAudioKey650(date, slot, source)`) applies to the two labeled slots' **played keys and cache keys only** — it never enters the day-position keying for any slot (§1.2).
- Composition seat: `extSlotTrack(slot, st)` (`client.ts:19753`) builds `{ episodeId: slot.slotId, title: st.title, kind: 'external', source: st.source, streamUrl, durationS: st.durationSec || 0, … }` from the resolved slot state; `extRebuildDescs(day)` (`client.ts:22152`, the emitExt619 leg) emits it once per contents occurrence, and every emission flows through `expandDescs` → `trackDesc(t, day)` (`client.ts:16452`).
- **Identity fields, proven stable across a recompose:** `episodeId` is the constant slot id `ext-office-of-readings` on every compose — it does not carry date, enclosure, source, or occurrence (an `_occ` stamp rides only when the contents list names the slot twice, `client.ts:16468`). `trackDesc` drops `kind` for non-podcast families (the v655 §2.3 comment at `client.ts:11137` names this: "a COMPOSED office descriptor carries no kind"), so the descriptor that actually plays stands with `kind === undefined`, `block` from the slot's `_block`, `durationS` from the slot state's `durationSec`, `url` from `streamUrl`. None of these fields enters the position key (§1.2) except `episodeId` — and it is constant.

### §1.2 The position path for this track, end to end

The Office of Readings is a **day track**: not `kind === 'podcast'`, not `kind === 'prayer'`, so its position lives in the **day-position store**, never the podcast store.

**Save (while it plays):**
- Drivers: web/element — the `timeupdate` handler's 5 s cadence (`client.ts:6974–6975`); native (John's APK) — `nativeMirrorTick`'s 5 s interval leg (`client.ts:20995`: mirror playing + `nativeMirror.trackId === state.current.episodeId` → `podPositionTick(); dayPositionTick();`). Event saves: pause / visibility-hidden / pagehide, the native playing→paused flip (`client.ts:20906`), the native transition/stopped saves (`saveTrackPos680`), and **skip-away at the head of `startDesc`** (`dayPositionSkipAway(desc)`, `client.ts:5666` area) — the exact seam John's "went to another track" act fires.
- `dayPositionTick` / `dayPositionSaveCurrent` / `dayPositionSkipAway` (`client.ts:11519–11570`) all read the live position through `livePos680(cur)` (native: the mirror, accepted only when `nativeMirror.trackId === cur.episodeId`; element: `audioEl.currentTime`), apply the guards (≥ 5 s, never at/past the end, `crossed95` stand-down), and call the one writer:
- `writeDayPositionQuiet(episodeId, positionS, durationS)` (`client.ts:11500`) with **`episodeId = cur.episodeId` = the bare slot id `ext-office-of-readings`** — no block, no occurrence, no side, no date in the key itself. It writes THREE places:
  1. the in-memory fold: `state.dayPayload.dayPositions[episodeId] = pos` (v461 F3, `client.ts:11510`);
  2. the coalesced local slot `opn-daypos-pending-v1`, keyed `episodeId + '|' + date` (`dayPosSlotSet`, `client.ts:11490`), date = `presentedDateStr()`;
  3. `POST /api/player/day-position { episodeId, date, positionS, durationS }` — server shape → D1 `day_positions`, upsert on `(date, episode_id)` (`index.ts:6175–6206`); non-server shapes → the local route seat (`client.ts:4381–4385`), which writes `opnPlayback().dayPositions[episodeId + '|' + date] = { positionS, durationS }`.

**Read (a fresh tap re-selects it):**
- `tapPlay(d)` (`client.ts:5777`) re-resolves the tap in a **fresh compose** — `sectionQueueFrom(extRebuildDescs(state.dayPayload), key)` — and takes the single-play funnel `playTrack(build[0])` → `startDesc(desc)`.
- `startDesc`'s day branch (`client.ts:5698–5708`): a standing `pendingResume` naming a different episode clears; the live carry (v617, same-track only) does not apply to a re-select after another track; the read is **`state.dayPayload.dayPositions[desc.episodeId]`** — the bare slot id again — applied when `>= 5`, seating `pendingResume`, which the element's `loadedmetadata` seek and the native contract's `startPositionS: queueStartPos(desc)` both serve. `queueMarkPos617` (`client.ts:5031–5046`) reads the same fold under the same bare key for queue transitions.

**Save key vs read key: they are the same bare key, `ext-office-of-readings`, at every seat above.** There is no key divergence in the code as shipped — see the probe evidence in §1.4, which is why the rival-cause verdicts in §1.3 land where they do.

### §1.3 Rival causes — each proven or cleared from code

**(a) Recompose rebuilds the descriptor with a changed identity — CLEARED.**
The recompose between plays rebuilds the descriptor from the same slot state through the same seats (§1.1): `episodeId` is the constant slot id; `slot/side/date/enclosure` either do not exist for this unlabeled slot (side), or do not enter the position key (date enters only the slot/D1 row's date column and the slot key's suffix — identically at save and at payload fold, both from the presented day; the enclosure enters only the cache stamp, see (b)). A changed enclosure or a re-resolved title between plays cannot orphan the saved position, because no position seat reads them. Plan probe P2 (§1.4) demonstrates the fresh-compose re-select resuming.

**(b) The v649 enclosure-stamp rule treats the returning track as a different copy — CLEARED.**
The stamp (`opnStampedResponse649` / `opnStampMatches649`, `client.ts:24035–24063`; mismatch seats at `client.ts:23567, 23595`) binds a **Cache API audio entry** to the enclosure its bytes were fetched for. A mismatch evicts and re-downloads the audio bytes. No stamp seat reads, writes, or deletes `dayPositions`, the day slot, or the D1 row. A re-downloaded copy of the same slot still composes the same `episodeId` and reads the same fold. The position cannot "go with" a discarded copy — the two stores share no key and no code path.

**(c) The save never lands for this descriptor shape — STANDS, narrowed to the one production input no standing harness feeds truthfully: the duration the 95% test and the end guards read.**
The shape itself is not skipped: the composed descriptor's `kind === undefined` passes every day-position guard (the guards exclude only `'podcast'` and `'prayer'` by name), and Plan probes P1/P2 (§1.4) prove the save lands and the re-select resumes in the harness world on both engines. What the harness world does **not** carry is a truthful duration: `buildStanding` in harness-v680 seeds every ext slot with `durationSec: 30` while its legs play positions of 111–600 s, and its `livePos680` duration comes from the fixture element/mirror duration (300 / 1248 / 1800), never from the descriptor. In production the three duration sources converge on one value — the resolver's stored `durationSec` for the slot (`index.ts:2626`: the Divine Office feed item's parsed `itunes:duration`, `extParseDuration`) → slot state `durationSec` → descriptor `durationS` → native contract item `durationS` → the shell's published `nativeMirror.durationS` → `livePos680`'s `live.dur`. `cross95Check680(cur, live)` (`client.ts:11362–11381`) tests `live.pos` against `Math.ceil(dur * 0.95)` with `dur = live.dur > 0 ? live.dur : cur.durationS` — i.e. against that same carried value on both engines (element path: `audioEl.duration`, the one independent source). **If the carried duration for this slot on the field day stood shorter than the true audio — a resolver/feed duration defect, or a shell-reported duration taken from the contract — then at the first 5 s tick past 95% of the wrong duration the track is marked READ through `markCompleted` and its position is cleared in the same act (`writeDayPositionQuiet(episodeId, 0, 0)`), every later save stands down on `crossed95`, and the re-select reads an empty fold and starts at 0:00 — John's report, exactly, including that he had only "gone to another track and come back."** This is rival (d)'s seat carrying rival (c)'s cause: the save path is not shape-skipped, it is **cleared mid-play by the threshold test fed a wrong duration**. The Plan-time live-feed check (§1.5) shows the feed's own durations are sane, which points the defect at the stored/served record for the field day or the shell's report — a distinction only the real production resolution record can settle, which is why §2.4's fixture is that record and §2.2's first Implement step is its read-back.

**(d) The 95% rule misfires — the RULE stands as designed; its duration input is the suspect (see (c)).**
The rule itself (cross at ≥ 95% of a known duration → mark + clear) is v680 §2.9 as approved, and this release does not change it. On the evidence: the Divine Office feed's durations for the Office of Readings are **not** short — 2026-11-26 item: 18:50 · 2026-11-27 item: 19:33 (read from the live feed at Plan time, §1.5; each duration trails its own item in the feed XML). So a misfire cannot be presumed from the feed; it must be proven or cleared against the **stored resolution record the app actually served for the field day** (§2.4 fixture). If that record's `durationSec` is truthful, (d) falls and (c)'s remaining form — the shell's mirror duration — is the next seat the harness interrogates (§2.2 step 2). The Plan does not name (d) as the mechanism on its face: a mid-listen restart is not a 95% clear until the duration evidence carries it, and §2.4 is built to carry it or kill it.

### §1.4 Plan probes (run at Plan time on the base tree, harness-v680 world)

Two probe legs were run in the standing harness-v680 scaffolding (real client, real day fixture 2026-11-21, ext slots standing present), since removed:

- **P1 — web/element, field flow:** start `ext-office-of-readings` → play to 600 (element duration 1800) → `timeupdate` tick → switch to `ext-morning-prayer` through `startDesc` → fresh `extRebuildDescs` compose → re-select. Result: the day store held `ext-office-of-readings|2026-11-21 = 600`, the fold held 600 after the switch, and the re-select seated `pendingResume = { ext-office-of-readings, 600 }`. **Resumes.**
- **P2 — native, field flow:** same flow through the bridge stub (mirror duration 1800, contract captured). Result: identical store/fold values, and the re-select's contract carried `startPositionS: 600`. **Resumes.**

The probes prove the keying and the in-session path whole — and they prove the standing harnesses' blind spot with it: every duration in both probes was a fixture value (descriptor 30 s, engine 1800 s), so no standing leg can see a wrong carried duration. That blind spot is the Plan's named defect surface.

### §1.5 Production evidence read at Plan time

- Live Divine Office feed (`https://divineoffice.org/feed/podcast/`, the resolver's `EXT_DO_FEED_URL`, `index.ts:2202`), crawled 2026-11-28 01:26 UTC: per-item durations (each trailing its item) — 2026-11-26: Invitatory 2:28 · **Office of Readings 18:50** · Morning Prayer 16:15 · Midmorning 8:50 · Midday 11:15 · Midafternoon 8:28 · Evening Prayer 14:28 · Night Prayer 13:09 · Thanksgiving prayer 1:18. 2026-11-27: **Office of Readings 19:33**. No short-duration anomaly for this slot in the feed itself.
- Standing tallies at base `ff0b30b` (Plan's own runs): **harness-v680: 21 ok / 0 not ok.** **harness-v695: 23 ok / 1 bad**, the one bad being solely its P pin leg (the pin has advanced past v695-1 to v706-1 at this base) — its functional legs stand 23/0; its shipped tally was 24/0.

### §1.6 Class verdict

- The position keying is **uniform for every day track**: bare `episodeId`, no side discriminator, no block, no occurrence. The Office of Readings is not keyed differently from the other seven office hours or from any other ext slot.
- The defect class is therefore **every ext-slot day track whose carried duration can diverge from its true audio** — in practice the Divine Office office hours first (their durations are feed-parsed and contract-carried), the Office of Readings being the reported and, as the longest and most-listened office, the most exposed instance. It is **not** the Office of Readings alone (no OoR-specific seat exists in the path), and it is **not** the labeled slots' v651 side class (that discriminator never touches day positions; the two labeled slots are exposed to this same duration class through their standing side's record, and their second side holds no day position of its own — a standing fact named here, not a v709 scope item).
- Own tracks and podcasts are outside the class: own tracks' durations are feed-true by the same parse but their position store is the same day store — they share the seat and the harness must sample one (§2.4 leg L6); podcasts read `podPositionS` from the podcast store and `cross95Check680` applies to them through the same duration input — the fix's duration-source seat (§2.3) is shared, so a proven wrong-duration fire is fixed for both stores at the one seat.

## §2 Plan

### §2.1 The fix, prescribed at the proven seat

**Guarantee:** leaving and re-selecting the Office of Readings the same day resumes at the saved position, under the v680 rules whole — 5 s saves · under-5 s = not started · 95% = read + cleared · v681 kill behavior untouched.

The seat is `cross95Check680`'s **duration input** (`client.ts:11362–11381`) together with the save family's end guards that read the same value — NOT the 95% rule, NOT the threshold, NOT any key. The fix has exactly two parts, and part 1 is conditional on the §2.2 evidence in the manner stated there:

1. **The 95% test and the at/past-end guards may only consume a duration the engine itself reports for the playing audio** — element path: `audioEl.duration` (already the source); native path: the mirror's `durationS` **as published by the shell from its player**, never the contract/descriptor value when the two differ. Where the shell's publish merely echoes the contract (the standing shell behavior the Implement read-back must establish), the test stands down when the only duration available is the descriptor's carried `durationS` **and** the position has not yet reached it — i.e. a crossing may only be declared from an engine-measured duration. A track whose engine duration is unknown plays, saves, and resumes exactly as today, and is marked only by the `ended` path — the standing completion writer. The 95% **rule** (the percentage, the mark, the clear) is byte-identical wherever it fires.
2. **Save-side symmetry:** `dayPositionTick` / `podPositionTick` and their save twins keep writing through the standing routes and keys (§1.2) — no key, store, route, or cadence changes anywhere in the fix.

If §2.2's evidence instead clears every duration source, the fallback seat — named now so Implement never re-plans — is the **read fold's single-source dependence**: `startDesc`'s day branch and `queueMarkPos617` read only `state.dayPayload.dayPositions`, a fold rebuilt from the server payload on any day refetch, while the save's guaranteed-local leg (the `opn-daypos-pending-v1` slot) is drained but never read at tap time. The fallback fix: the day branch reads through one reader that falls back to the pending slot's standing entry for `(episodeId, presentedDate)` when the fold carries nothing — no rule, key, or store changes. Implement takes this seat only on the §2.2 step-3 evidence, and says so in §3.

### §2.2 Implement's evidence steps (before any code)

1. **Read the real production resolution record** for `ext-office-of-readings` for a real recent day (the courier/`ext_resolutions` record the client was served — the §2.4 fixture source): name its `durationSec`, its enclosure, and its `resolvedAt`. Compare `durationSec` against the feed item's duration for that date (§1.5 method) and against the enclosure's true length where readable.
2. **Establish the shell's mirror duration source** from the standing record (the v680 §2.6 shell record + the contract shape): does `nativeMirror.durationS` originate from the player or echo the contract item's `durationS` (which is the descriptor's)? Name the answer in §3 with its seat.
3. **Decide the seat by evidence:** a wrong stored `durationSec`, or a contract-echoed mirror duration combined with any stored/served divergence, seats the fix at §2.1 part 1. All durations truthful and engine-measured seats it at the §2.1 fallback. Either way §3 names the evidence values, not just the conclusion.

### §2.3 Code seats (all in `app/worker/src/client.ts`, plus the pin in `ui.ts`)

- `cross95Check680` (`client.ts:11362`) — the duration-source discipline of §2.1 part 1, for both the podcast and day callers (one seat, both stores).
- `livePos680` (`client.ts:11334`) — only if the discipline needs the engine-vs-carried distinction carried on its return; its guards and callers otherwise untouched.
- Fallback seat (only on §2.2 step-3 evidence): `startDesc` day branch (`client.ts:5698`) + `queueMarkPos617` (`client.ts:5031`) reading through the one reader; `dayPosSlotRead` (`client.ts:11488`) as the slot's reader.
- **Untouched by name:** the 5 s cadence and movement gate · the under-5 s rule at every seat · the 95% percentage, mark, and clear · `writeDayPositionQuiet` / `writePodPositionQuiet` keys, routes, and slot discipline · v681's kill seats · v649's stamp and restore · the labeled slots' v650/v651 side machinery · v708's Edit-form territory.

### §2.4 Harness design — `app/harness-v709.mjs` (spec only; Implement builds it)

Modeled on `app/harness-v680.mjs` (the standing two-world recipe: real client in a DOM world; the native world drives a bridge stub capturing contracts and publishes engine state through `applyNativeState`).

**Fixture (Improvement D — no invented shapes):** the **real Office of Readings resolution record for a real day**, taken from production at Implement time (§2.2 step 1): the slot's stored resolution (title · enclosure/streamUrl · `durationSec` · sizeBytes · source · resolvedAt) for the most recent day standing in production, seated into the harness world's slot state exactly as the courier payload seats it, with the day built from the standing production day fixture family (fixtures-v597 posture) and John's real profile data as harness-v680 uses it. The fixture file names its production source and retrieval date in its header. If the record's `durationSec` is itself the defect, the fixture carries it verbatim — correcting it in the fixture defeats the harness.

**Legs:**

- **L1 ◆ THE field leg (must FAIL on the base tree if the §2.1 seat stands):** native world — start the Office of Readings from the fixture record, publish playing state advancing to a mid position (a position past 95% of the fixture's carried `durationSec` if that value is short, else a true mid position), run two mirror ticks, switch to another track through `startDesc`, fresh-compose through `extRebuildDescs`, re-select → the re-select's contract `startPositionS` stands within ±6 s of the switch-away position, and the track does **not** stand read. On the base tree with a wrong carried duration this fails by construction (the tick marks + clears; the contract carries 0).
- **L2 ◆ web twin of L1:** the same flow on the element path (element duration = the enclosure's true length) — resumes at the saved position; no mark stands.
- **L3 ◆ under-5 s leg:** play the fixture track to 3 s, switch away, re-select → starts at 0, no position stands in any store (the v680 rule, unchanged).
- **L4 ◆ 95% leg, truthful duration:** with an engine-measured duration standing (element duration, or a mirror duration published as engine-measured per §2.2 step 2), advance past 95% → the track stands READ and its position stands cleared in the store, the slot, and the fold — the rule firing exactly as v680 §2.9 prescribes, proving the fix did not blunt it.
- **L5 ◆ kill leg (v680/v681 regression-in-miniature):** native world, mid position, hard kill (no lifecycle events), reboot over the same storage, re-select → resumes within ±6 s.
- **L6 ◆ class sample:** L1's flow repeated for one other office hour from its real record (Morning Prayer) and one own track — same resume outcome, fixing the class boundary empirically.
- **Regressions:** `harness-v680` — standing tally **21/0** at base (Plan's run, §1.5), must stand 21/0 after. `harness-v695` — **24/0** at its ship; at this base its functional legs stand 23/0 with the P pin leg failing only on the advanced pin (§1.5) — after v709 the pin leg's expectation moves with the new pin; the 23 functional legs must stand 0-bad.

### §2.5 Boundaries

- No server change, no migration, no route change, no APK: every seat is client-side, and an old shell parses the same contract bytes (the §2.1 discipline consumes only values the client already receives).
- No change to the 95% rule, the under-5 s rule, or v681 kill behavior — stated as the run's hard boundary; a §3 that needs any of them stops and returns to Plan.
- Ship pin: next `ora-pro-nobis-v709-N` at Ship's seat.

## §3 Implement

Built on `release/v709` in worktree `~/workspace/.worktrees/v709`, base `ff0b30b`. Commits: `5a0d0a4` (the fix + the pin) · `f4709fc` (harness-v709) · this §3. Client only — `app/worker/src/client.ts` + `app/worker/src/ui.ts`; no server change, no migration, no route change, no APK.

### §3.1 The §2.2 evidence read-backs (before any code)

**Step 1 — the real production resolution record, field day 2026-11-27** (production D1 `ext_resolutions`, read via the Cloudflare connector at Implement time, 2026-11-28):

- `ext-office-of-readings` · date `2026-11-27` · state `present` · title `Office of Readings – Divine Office: Liturgy of the Hours` · stream_url `https://media.blubrry.com/divineoffice/traffic.libsyn.com/divineoffice/divine-ord-w34-fri-or.mp3?prayer=OfficeOfReadings&date=20261127&episode=202611273` · **`duration_s` 1173** · `size_bytes` 25162812 · source NULL · `resolved_at` `2026-11-27T06:00:46.427Z` · `episode_date` `2026-11-27`.
- **Comparison:** the feed item's duration for that date (Plan §1.5's live read) is **19:33 = 1173 s — the stored `durationSec` is EQUAL and truthful.** The size/duration pair is also internally consistent (≈171.6 kbps, in family with the sibling Divine Office slots that day: Morning Prayer 1043 s / 22549217 B, Evening Prayer 849 s / 18667422 B). The neighbouring days stand sane in the same read: OoR 2026-11-24 = 1169 · 11-25 = 983 · 11-26 = 1130 (= the feed's 18:50) · 11-28 = 1106 — no short-duration anomaly on any day.
- **Served leg:** the payload's `durationSec` is the row's `duration_s` verbatim (`index.ts:3455`, the stored-resolution payload seat), and the descriptor's `durationS` is that slot state's value (§1.1). Stored = served = feed. No divergence at any seat.

**Step 2 — the shell's mirror duration source.** The shell source is a separate Android repo, not in this tree (the v680 §1 standing record); the client-side seat is `applyNativeState` (`client.ts:20813`), which takes the publish's `st.durationS` into `nativeMirror.durationS` as published. Whether the shell's publish is player-measured or echoes the contract item (`nativeContractItem` carries the descriptor's `durationS`) cannot be established from this tree — and on this evidence it cannot carry the defect either: the contract value for the field day is the truthful 1173, so a contract-echoed mirror would still stand at 1173. §2.1 part 1's trigger (a contract-echoed mirror **combined with** a stored/served divergence) is not met, because no divergence exists. The element path's duration is engine-measured by construction (`audioEl.duration`).

**Step 3 — decision, plus one further production read-back.** Every duration source the §2.2 steps name is truthful: stored, served, feed, element, and (echo or measured) the mirror's only possible value for the field day. **The §2.1 primary seat therefore does NOT stand, and Implement took the §2.1 FALLBACK seat, plainly: the tap-time fold's single-source dependence.** The supporting read-back: **no `day_positions` row stands for (2026-11-27, `ext-office-of-readings`)** — and no row in `day_positions` or `podcast_positions` carries an `updated_at` after 2026-11-20T21:38Z — so the fold's server source carried nothing for the field day: any day-payload rebuild before John's re-select emptied the fold, and the save's guaranteed-local leg (the `opn-daypos-pending-v1` slot, written synchronously at every save) was never read at tap time. That is the fallback seat's named defect shape, on production values.

### §3.2 The fix as built (fallback seat, §2.3's fallback line)

- **One reader, `dayStoredPos709(episodeId)`** (new, beside the day-position family in `client.ts`): returns the payload fold's value when the fold carries one (byte-identical to the standing read); when the fold carries **nothing** for the episode, falls back to the pending slot's standing entry for `(episodeId, presentedDateStr())` via the standing `dayPosSlotRead`. A 0-clear (ended / 95% mark) drops the slot entry and deletes the fold entry in the same act, so a finished or crossed track reads nothing through the fallback either.
- **Call sites (the two named seats, nothing else):** `startDesc`'s day branch and `queueMarkPos617` now read through `dayStoredPos709`. Their standing guards are untouched — the callers keep the ≥ 5 s "not started" rule on the reader's value, the live-carry precedence in `startDesc` stands ahead of the read exactly as before, and a standing deliberate `pendingResume` is still never overridden.
- **Untouched by name, verified in the diff:** `cross95Check680` and `livePos680` (the §2.1 primary seat was not taken — the 95% rule, percentage, mark, and clear are byte-unchanged), the 5 s cadence and movement gate, the under-5 s rule at every seat, `writeDayPositionQuiet` / `writePodPositionQuiet` keys, routes, and slot discipline, v681's kill seats, v649's stamp, the v650/v651 side machinery, v708's Edit-form territory.
- **Pin:** `ui.ts` CACHE `ora-pro-nobis-v706-1` → **`ora-pro-nobis-v709-1`** (one seat).

### §3.3 Harness — `app/harness-v709.mjs`: **15 ok / 0 not ok**

- **Fixture (Improvement D):** the real production resolution records for 2026-11-27 (§3.1 step 1), seated verbatim into the harness world's slot state exactly as the courier payload seats them — OoR (durationSec 1173, sizeBytes 25162812, the real enclosure URL) and Morning Prayer (1043, 22549217, source "Divine Office") — over the standing v597 production day fixture and John's real profile data, as harness-v680 uses them. Cross-check: the fixture's `durationSec` values are the D1 read-back values of §3.1, compared there against the feed (1173 = 19:33) — the fixture carries production's values, not corrected ones.
- **Legs:** T0/T0b (parse + seats + pin + the 95% rule byte-standing) · **L1 ◆ the field leg, native, fallback form** — play the fixture OoR to 600 of 1173, the tick's save held {600, 1173} in the pending slot at the write instant, switch away, the fold loses the position (the field condition of §3.1 step 3: rebuilt fold empty, slot entry standing), fresh compose through `extRebuildDescs`, re-select → contract `startPositionS` ≈600 ±6, track does not stand read · L1b `queueMarkPos617` reads 600 through the same reader · L2 web twin (pendingResume ≈600) · L3 under-5 s (3 s writes nothing anywhere; re-select at the top) · L4 95% with the truthful engine duration (1150 of element-measured 1173 → stands READ; position cleared in fold AND slot; fresh tap at the top — the rule unblunted, and the fallback never resurrects a cleared track) · L5 kill leg (mid 600, hard kill, reboot over the same storage → resumes ±6) · L6 class sample (Morning Prayer from its real record, native, ≈500 · one own track `morning-prayer`, web, ≈200 — same resume outcome).
- **Fail-on-old (base `ff0b30b`, the v706 tree): OA-L1 and OA-L2 fail there as required** — on the base tree the tap-time reads consult the fold only, so after the fold loss the re-select starts at 0 and `queueMarkPos617` reads 0, on both engines. (§2.4's L1 fail-on-old condition was written for the primary seat — "if the §2.1 seat stands"; with the fallback seated on the §2.2 evidence, the fail-on-old legs target the fallback's defect on the same base, as §2.4's conditional provides.)
- **Regressions (built tree):** `harness-v680` **21 ok / 0 not ok** (standing tally preserved) · `harness-v695` **23 ok / 1 bad** — the one bad is solely its P pin leg (it expects `ora-pro-nobis-v695-1`; the pin stands at v709-1), the exact bad named for this base in §1.5; its 23 functional legs stand 0-bad. harness-v695 was not edited or weakened.

### §3.4 Queue note

- v708 stands in flight on `release/v708` (no ship at Implement read); `origin/main` advanced past the Plan base by a runner publish commit (`ecdadd8`, "Publish Ora Pro Nobis 2026-11-27") — merge derivation is the Ship seat's job, not taken here.


## §4 Review (LIGHT, streamlined path) — PASS

Review seat: `chain-v709-review`. Independent re-runs and read-backs, 2026-11-28. No execution-risk notice was drawn in this seat.

### §4.1 Fallback-seat verdict — §2.2 evidence re-verified independently

- **Duration read (re-run):** production D1 `ext_resolutions` for (`ext-office-of-readings`, `2026-11-27`) returns `duration_s` **1173**, `size_bytes` 25162812, `resolved_at` `2026-11-27T06:00:46.427Z` — byte-identical to §3.1. 1173 s = the feed's 19:33 for that date (§1.5). Stored duration is truthful; no divergence at stored, served, or feed seats.
- **Absence read (re-run):** `day_positions` count for (`2026-11-27`, `ext-office-of-readings`) = **0 rows**; `MAX(updated_at)` over `day_positions` = `2026-11-20T21:38:09.158Z` — no row stands for the field day, exactly as §3.1 step 3 states.
- **Rule application:** Plan §2.2 step 3 seats the primary (`cross95Check680` duration input) only on a wrong stored `durationSec` or a contract-echoed mirror combined with a stored/served divergence. Neither condition stands on the re-verified values, so the primary seat correctly did **not** stand and the §2.1 fallback seat was the prescribed seat. Applied as written, not as convenience.

### §4.2 Diff audit (`ff0b30b..88b6ab8`)

- **Scope:** code change is `client.ts` only — one new reader `dayStoredPos709` plus its two named call sites (`startDesc` day branch, `queueMarkPos617`) — and the one pin seat in `ui.ts` (`ora-pro-nobis-v706-1` → `ora-pro-nobis-v709-1`). Remaining files: `app/harness-v709.mjs` (new) and this doc. No server, migration, route, or APK change.
- **Byte-unchanged, verified in the diff:** `cross95Check680` · `livePos680` · the 95% percentage/mark/clear · the under-5 s rule · the 5 s cadence · `writeDayPositionQuiet` / `writePodPositionQuiet` keys, routes, and slot discipline · v681 kill seats · v649 stamp · v650/v651 side machinery.
- **Reader discipline:** fold first — a fold value (including 0) returns as-is, byte-identical to the standing read; the slot is consulted only when the fold carries nothing. Callers keep their standing ≥ 5 s rule on the returned value; `startDesc`'s live-carry precedence stands ahead of the read, untouched.
- **0-clear cannot resurrect:** a 0-clear in the standing (unchanged) writer deletes the fold entry and drops the slot entry in the same act, so a crossed/finished track reads nothing through either leg; harness L4 proves it end-to-end (cleared in fold AND slot, fresh tap at the top).
- **Date-scoping:** the slot fallback reads only the key `episodeId + '|' + presentedDateStr()` — an entry standing under another date is never consulted, so a stale slot entry from another day cannot resume. Proven by code read; the harness constructs the same-day entry only, matching the prescribed seat.

### §4.3 Independent harness re-runs (Review's own runs)

- **harness-v709: 15 ok / 0 not ok** — including L1 (native field leg, resumes ≈600), L1b (`queueMarkPos617` through the same reader), L2 (web twin), L3 (under-5 s), L4 (95% fires unblunted; no resurrection), L5 (kill leg), L6 (class sample: Morning Prayer + one own track).
- **Fail-on-old (inside harness-v709, base `ff0b30b`): OA-L1 and OA-L2 fail on the base tree as required** — the tap-time reads there consult the fold only; after fold loss the re-select starts at 0 on both engines.
- **harness-v680: 21 ok / 0 not ok** — standing tally preserved.
- **harness-v695: 23 ok / 1 bad** — the sole bad is its P pin leg (`FAIL P pin: ui.ts CACHE is ora-pro-nobis-v695-1 …`), the exact bad named in §1.5 for this base; the base pin stands at `ora-pro-nobis-v706-1` (read from `ff0b30b:ui.ts`), so the same leg fails identically on base. Its 23 functional legs stand 0-bad. harness-v695 was not edited.

### §4.4 Verdict

- **PASS.** No defects found. The fallback seat stands on independently re-verified §2.2 evidence; the diff touches only the prescribed seats; all tallies match §3.
- Next: Ship seat, with its contract, per the chain.

## §5 Ship record

**Shipped LIVE at pin `ora-pro-nobis-v709-1` — 2026-11-28.**

Ship seat: chain-v709-ship.

### §5.1 Review verdict

- **§4 Review: PASS** (chain-v709-review, commit `e492921`): fallback seat confirmed on independently re-verified §2.2 evidence (stored duration 1173 = feed 19:33, truthful; no `day_positions` row for the field day); diff audit clean (one reader `dayStoredPos709` + 2 call sites + pin only); harness-v709 **15/0** incl. fail-on-old OA-L1/OA-L2, harness-v680 **21/0**, harness-v695 **23/1** (named pin leg only).

### §5.2 Merge (tree-exact, Git Data API)

- Merge commit: **`24f7f56906f4fe6971dd634fc41ffcf043fd554c`**, tree **`6c1af9f2f2c91d202414809cee16aba10a70e11b`**; parent `ecdadd8` (the runner publish commit that advanced `origin/main` past the branch base `ff0b30b`). Single-parent tree-exact commit (v705 precedent): the branch head commit object does not stand on GitHub, and a two-parent creation was refused (422); the merged tree was asserted exactly: == main's tree with exactly the v709 delta applied — the 4 delta blobs asserted (`app/harness-v709.mjs` `d1598b48` · `app/worker/src/client.ts` `4413c708` · `app/worker/src/ui.ts` `a1608aab` · this doc `8943c4c6`), and main's own delta vs base (only `docs/podcast.xml`, the runner publish) carried untouched. Never force-pushed; the release branch stays local.
- Read back at merge time: **main pushed · remote in sync.**
- Queue ordering: v708 (row 1689) had **not** shipped at merge time (its Implement phase stands active; no Ship record) — v709 merged onto the current `origin/main` first, and v708's ship derives onto this main when its turn comes.

### §5.3 Clone-processing note

- The ship worktree `~/workspace/.worktrees/v709-ship-main` was created at the merged head under the standing approval (John, 2026-11-21; AGENTS.md rule of 2026-11-27: the standing approval IS the authorization for every Ora chain's clone processing, ship worktrees included). No execution-risk notice was drawn in this seat; had one been drawn, this seat would have proceeded under that approval and named it here. The standing clone's stale/dirty local checkout was not disturbed — all work ran in worktrees from `origin/main`.

### §5.4 Deploy

- Deploy driver `~/workspace/.tools/deploy-app-v709-ship.py`, `EXPECTED_HEAD = 24f7f56906f4fe6971dd634fc41ffcf043fd554c`; dry-run passed first, then deploy from the ship worktree at the merge head.
- Worker **`ora-pro-nobis-app`** · version ID **`54d2455b-95ba-4171-a4a8-6285ae583f00`** · deployment created **2026-11-28T01:42:50.025Z** · **100%**.

### §5.5 Production verification (from served bytes)

- Served `sw.js` reads **`ora-pro-nobis-v709-1`**.
- Served `app.js` carries **`dayStoredPos709`** ×3 (the reader + its 2 call sites).

### §5.6 Board closeout

- **What's New id 524**: "Fixed: the Office of Readings now remembers where you stopped — leave it for another track, come back, and it resumes where you left off instead of starting over."
- **Releases row 1690**: status **Live** · `shipped_at` = 2026-11-28T01:42:50Z (the deploy timestamp) · `whats_new_id` = 524. Read back.
- **shipped_records id 898**: project 3 · version v709 · title "Office of Readings restarts from scratch on re-select (position lost)" · `shipped_at` = 2026-11-28T01:42:50Z · `whats_new_id` = 524. Read back.
- **Ship phase record id 2970**: release 1690 · Ship · passed · holder `chain-v709-ship` · slug `office-of-readings-position-lost` · document_path `docs/releases/v709-office-of-readings-position-lost.md` · `commit_hash` = `24f7f56906f4fe6971dd634fc41ffcf043fd554c`. Read back. (Scope 2965 · Plan 2967 · Implement 2968 · Review 2969 stand passed.)
- **Ship contract**: all three expectations **met** (merge · deploy + served-bytes verification · closeout).
- **Goals Board intake 1348**: CLOSED, status **Done** — closeout line appended; read back via the task list.

**Disposition: v709 LIVE at pin `ora-pro-nobis-v709-1`.**

**Field check (John's leg, open):** play the Office of Readings partway, leave it for another track, come back the same day — it resumes where he left off instead of starting over.
