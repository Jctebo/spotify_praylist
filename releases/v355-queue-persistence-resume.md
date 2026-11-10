# v355 — Queue persistence and auto-resume

## 1 · Scope

**Defect of record (Scope-proven, re-verified at Plan against the shipped tree, trunk ee34d35 / production Worker d02e1901).** The standing queue lives in page memory only: `state.queue`, `state.queueIdx`, and `state.current` in `app/worker/src/client.ts` are never written anywhere. What survives a page discard today is exactly two device-local records, neither of them the queue: the v312 resume record (`opn-resume-v312` — ONE track: `{date, episodeId, positionS, savedAt}`, written by `saveResume()` on pause and on a 5-second `timeupdate` throttle) and the v344 played store (`opn-played-v344`). When the phone discards the idle page, the queue is lost whole; on return the app can offer at most the v312 single track or Continue's rebuild. Scope reproduced the loss and priced two routes: a device-local snapshot (the v344 store pattern, extended to the queue) and server-side state (John's hypothesis) at roughly double the device-local price.

**John's eight decisions (Ora thread, 2026-11-10 05:59 CT, interactive package, all recommendations standing — binding):**

1. **Storage route: device-local snapshot** on this phone (local storage). The server route is NOT taken.
2. **The snapshot stores track identity in order**, re-resolved against the fresh day on return.
3. **On return: restore PAUSED** — queue, track, and position standing; one tap continues.
4. **Position: exact position in seconds restored.**
5. **Yesterday's snapshot: DISCARDED** — yesterday's queue never restores into today; Continue governs the new day.
6. **The restored queue WINS** — Continue steps aside while a restored queue stands and returns when the queue ends.
7. **Sleep timer: NOT restored** — a restored session starts with the timer off.
8. **Sequencing:** v355 runs AFTER v352 ships and BEFORE v353 is planned. v352 is Live (2026-11-10 ~06:46 CT); this Plan reads the shipped v352 tree. v356 (Confession PIN) follows; §2.9 names the seams this release touches so v356's Implement can rebase.

**Run level: TO SHIP** under the standard five-phase flow (the overhaul's straight-to-production Decision 5 belongs to v352–v354, not to this release). Client-only: no migration, no Worker route, no payload change (§2.8 verifies each).

## 2 · Plan

### 2.1 The snapshot — key, schema, bound

ONE new localStorage key, in the standing family pattern (`opn-played-v344`, `opn-resume-v312`, `opn-speed-v336`, `opn-ext-cache-v1`):

- **Key:** `opn-queue-v355`
- **Value (JSON):**
  - `v`: `1` — schema version; a record whose `v` is not `1` is discarded whole.
  - `date`: the PRESENTED Chicago day (`presentedDateStr()` — the same day key v344's store and, since v342 §2.5, the v312 record already use; `state.storedDay` equals it in the shipped code).
  - `ids`: the queue's descriptor `episodeId`s, in queue order. The id space is the one the queue array already carries: canonical own-episode ids (v342's keying pin), external slot ids (the `episodeId` an ext slot descriptor carries, matched at advance by `queueLiveDesc` against `state.extSlots` / `state.extStanding`), and intention descriptors under their standing `intro:<prayerId>` ids. No titles, no URLs, no durations are stored — identity only (decision 2); everything else re-resolves against the fresh day.
  - `idx`: `state.queueIdx` at write time (the index of the current entry inside `ids`).
  - `currentId`: `state.current.episodeId` at write time (redundant with `ids[idx]` by construction; carried so the restore can detect an inconsistent record and so the position's owner is named outright).
  - `positionS`: `audioEl.currentTime` at write time, seconds, for the current track only.
  - `savedAt`: ISO timestamp (diagnostic parity with the v312 record; no logic reads it — the date field governs).
- **Bound:** `ids` is a copy of the standing queue array, which is built only from the day's descriptors (eight blocks + the unblocked group; on the order of 40 entries). The record is ids and numbers only — well under 2 KB serialized, an order of magnitude below the v344 store's working size. No truncation rule is needed; a queue cannot outgrow the day it was built from.
- **Write discipline:** every write is a whole-record replace inside `try/catch`, exactly as every standing store writes (`saveResume`, `writePlayedQuiet`). A storage failure (quota, private mode) degrades silently to today's behavior — the queue simply does not restore — and never throws into a playback path.
- **Existence rule:** a snapshot stands only while a queue stands. It is written when `state.queue.length > 0` and removed at the moments §2.5 names. A single play (`playTrack`, which clears the queue by design) leaves NO snapshot: the v312 record already covers that track's resume, and there is no queue to restore.

### 2.2 Write triggers — the set, and why each

One function, `saveQueueSnapshot()`, beside `saveResume()` in the localStorage section of `client.ts`: it reads `state.queue` / `state.queueIdx` / `state.current` / `audioEl.currentTime`, writes the §2.1 record when a queue stands, and removes the key when none does. It is called from exactly five places:

1. **`startQueue`, after the queue and index are set and the first entry is started.** Every queue birth and every queue replacement passes this point (Play All, block play, the v351 card tap with `force`, `previewQueueTap`, Continue's own start). A queue that exists is a queue that has been snapshotted — there is no build path that leaves a standing queue unrecorded.
2. **`startDesc`, the single funnel every track start passes** (queue advance, `jumpQueueTo`, `startQueue`'s first entry, single plays). This is the track-change trigger: the snapshot's `idx`/`currentId` follow the queue as it moves, with the new track's position standing at its start (0, or the pending-resume position when a start carries one). Hooking the funnel — not `advanceQueue` and `jumpQueueTo` separately — means no present or future advance path can move the queue without the record following.
3. **The `pause` event, beside the standing `saveResume()` call.** Pause is the moment the listener most often leaves; the position written here is the position he left at.
4. **The `timeupdate` throttle, on the standing 5-second tick that already calls `saveResume()`** (the `lastResumeSave` pattern, its own sibling counter). A playing queue's stored position never lags more than ~5 seconds behind the ear, so a discard mid-play loses at most the throttle window — the same tolerance the v312 record already accepts.
5. **`pagehide`, and `visibilitychange` to `hidden`.** These are the discard moments themselves — the last writes before the phone may throw the page away. `pagehide` is the reliable unload signal on iOS; `visibilitychange`-hidden covers the freeze that precedes a discard (the v346 visibility seam already stands in this file; the snapshot hook rides the same event, it does not alter the media-session re-assert). Together they make triggers 3–4 a floor, not the only protection.

No other writes: no timer loop of its own (trigger 4 reuses the standing tick), no write on render, no write on played-state changes (the queue did not change).

### 2.3 The restore — boot order, date check, re-resolution

The restore runs ONCE, inside `renderPrayers`' payload-success path, after `state.dayPayload` / `state.dayDescs` stand and the initial render has happened, at the point where the standing code calls `resolveExternals(day)` — restore is a sibling step there, named `restoreQueueSnapshot(day)`. It never blocks the render: the day paints as it does today, and the restore stands the player up behind it.

In order:

1. **Read + shape check.** Parse `opn-queue-v355`; a missing, unparseable, or wrong-`v` record ends the restore (a malformed record is removed).
2. **Date check FIRST (decision 5).** `record.date !== presentedDateStr()` → remove the record, end the restore. Yesterday's queue is never re-resolved, never partially honored; Continue and the v312 record govern the new day exactly as today. The v312 record's own stored-day check is untouched and keeps its meaning for its own track.
3. **Re-resolution (decision 2).** Build the fresh list the way every queue build does — `extRebuildDescs(state.dayPayload)` — and map each stored id to its fresh descriptor. An id that does not resolve drops out, silently (a track the fresh day does not carry — a slot whose pick changed, an episode that rotated — is simply not in today's queue). Intention descriptors resolve under their `intro:` ids like any other entry; a dropped prayer takes its intro with it only when the intro itself fails to resolve — the entries are independent records in `ids`, each resolved on its own id.
4. **Current-track determination.** If `currentId` resolves and stands in the surviving list, it is the current entry and `positionS` is its stored position. If `currentId` dropped out, the current entry is the first surviving entry AT OR AFTER its stored position in the order (the entry that followed it), at position 0; if none follows, the LAST surviving entry, at position 0. If an entry survives but stands `available: false` at restore time (an external slot still resolving — the standing snapshot-flag situation `queueLiveDesc` answers at advance), the same at-or-after rule applies for the CURRENT entry only: the queue keeps the unavailable entry in its place in the order, `state.queueIdx` stands on the first available survivor at or after the stored index, and when the unavailable entry's turn comes later it is answered by the standing advance machinery exactly as in a live queue. Position applies only when the standing current IS the stored current; any substituted current starts at 0.
5. **Empty after resolution.** If no id survives, remove the record and end — Continue governs, as if no snapshot had stood.
6. **Stand the queue PAUSED (decision 3).** Set `state.queue` to the surviving descriptors in stored order and `state.queueIdx` to the determined current index. Load the current descriptor through the standing paused-load mechanism — the `loadResume` machinery (`state.pendingResume` + `audioEl.src` + explicit `load()` on the `preload="none"` element, dock painted, playbackState 'paused') — but NOT through `loadResume` itself, which clears the queue as its first act; the restore performs the same steps inline (or via a `loadResume`-sibling that omits the clear — Implement picks the shape, the contract is: queue and index set BEFORE the load, and the load does not touch them). **No autoplay, ever:** no `play()` call stands anywhere in the restore; the app's standing rule (v312's loadResume comment: "the app never autoplays sound on open") governs. One tap on the dock / Now Playing / media-session play resumes through the standing `resumeCurrent()` seam, queue and position preserved by construction.
7. **Position (decision 4), with the clamp.** `pendingResume.positionS` is the stored position, clamped BEFORE it is handed over: when the fresh descriptor's `durationS` is known and > 0, clamp to `max(0, min(positionS, durationS - 1))`; the standing `loadedmetadata` handler gains the same guard for the unknown-duration case — when the element's real duration is finite, the seek target is `min(positionS, max(0, duration - 1))`. The one-second margin keeps a seek from landing on the exact end, which would fire `ended`, advance the queue, and mark the track — a restore must never consume the track it restores. For positions inside the duration both clamps are identity operations, so the v312 single-track path and Continue's carry path (which share `pendingResume`) behave exactly as today for every in-range position; only the out-of-range tail changes, from "seek to the end and end" to "stand one second short of it." If the stored position is 0 or absent, no seek stands.
8. **Flag the win (decision 6).** A completed restore sets the state flag §2.4 names, and the dock paints from `state.current` as it does for any standing track — the restored session is indistinguishable from a live paused one, except that it was never played this visit.

### 2.4 Continue interaction (decision 6)

- **The flag:** one state field (alongside `previewQueue` in the state initializer), standing exactly while a restored queue stands: set by §2.3 step 8, cleared at every §2.5 clearing moment.
- **The rule in `paintContinue`:** while the flag stands, the Continue slot renders EMPTY — the card does not stand, offers no button, and its "See queue" preview is not reachable — regardless of what the played store or the v312 record would otherwise show. `buildContinueQueue` and the card's own gate/merge logic are NOT modified; they are simply not reached for rendering while the flag stands. The v312 record itself is left alone (the restored session's `saveResume` writes will refresh it as playback proceeds, exactly as a live session's do).
- **The return:** when the restored queue ends (natural exhaustion, §2.5) or is replaced, the flag clears and `paintContinue` is re-invoked through its standing refresh path (`refreshPlayedChrome`, already called at every played-state write and at render end), so the card returns at the moment the queue stops standing — offering what the played store and resume record then say, under its standing rules.
- **Continue's own start is a replacement:** if the listener could reach Continue it would call `startQueue` — while the flag stands he cannot (no card), and any OTHER start (a card tap, Play All, a block play) replaces the queue under §2.5 and clears the flag with it. There is no path where a restored queue and a Continue queue coexist.

### 2.5 What clears the snapshot — and what does not

**Clears (the record is removed, the §2.4 flag drops with it):**

- **Queue exhaustion:** the queue plays to its end — the `advanceQueue` end-clear (`dir > 0` past the last entry) and the `ended`-handler path that empties a standing queue. The record dies at the same moment the in-memory queue does.
- **A different queue or play starts:** any `startQueue` call replaces the record with the NEW queue's snapshot (a clear-and-rewrite, never a merge — v351 decision 3's replace semantics extended to storage); `playTrack` (single play, queue cleared by design) removes the record outright, per §2.1's existence rule.
- **A new day:** the boot date check (§2.3 step 2) — and a snapshot can only ever be read at boot, so no mid-session rollover path exists or is needed.
- **Corruption:** an unparseable or wrong-version record, removed at read.

**Does NOT clear:**

- **A pause** — pause WRITES the snapshot (trigger 3); it is the protected state, not a clearing one.
- **A page discard, reload, or SW-update reload** — surviving exactly these is the release's purpose; the boot restore is their counterpart.
- **The sleep timer firing** — a timed stop is a pause (v320: "the queue stands held, not cleared"); the snapshot stands with the queue.
- **`jumpQueueTo`** — movement inside the standing queue; trigger 2 rewrites the record with the new index.
- **Played-state writes, tab switches, the Now Playing sheet opening or closing** — none of them touch the queue.

### 2.6 Sleep timer (decision 7)

No build stands here, and §2 says so expressly so Review can verify the absence: `state.sleep` is in-memory only in the shipped code (v320's comment: "never written anywhere… an app restart, reload, or SW-update reload resets it"), and the §2.1 schema carries NO timer field — no mode, no deadline, no remaining time. A restored session therefore starts with the timer off by construction, even when the pre-discard session had minutes or end-of-track armed. The snapshot code must not read `state.sleep`, and the restore must not arm anything. The harness proves it (§2.10, leg L9).

### 2.7 Standing seams — what is not touched

- **Playback engine contracts (v351):** `startQueue(descs, force)` keeps its signature and its one-argument behavior at every standing call site; `tapPlay`'s dispatch, `sectionQueueFrom`, `queueLiveDesc`, `advanceQueue`, `jumpQueueTo` are unmodified in behavior — the release ADDS calls out of `startQueue`/`startDesc` (trigger hooks) and adds one reader at boot; it changes no decision any of them makes.
- **Played state (v344):** the store, its key, its writers, and the Continue gate inputs are untouched. The release reads nothing from `opn-played-v344`.
- **Media session (v346):** handlers, `resumeCurrent`, `reassertMediaSession` untouched; the restore's paused stand is what the session then declares, through the standing `setPlaybackState('paused')` in the load path.
- **Speeds (v336), sleep (v320), externals resolution (v334/v348/v350), the v338 intro interleave, the v343 rows, the v347 queue list UI:** untouched. `renderQueueList` reads `state.queue` fresh on every call (the v343 rule), so a restored queue renders in Now Playing with no UI work at all.
- **The v312 record:** key, byte shape, writers, and readers unchanged; it keeps governing the single-track and Continue-carry paths exactly as today. The ONE shared-seam edit is the §2.3-step-7 clamp inside the `loadedmetadata` handler — a handler both paths already share, identity for in-range positions.
- **NO CHECKLIST:** nothing in the snapshot renders, counts, or marks; the restore shows only the standing dock/queue surfaces.
- **Same-day consumption (v337):** the date key is the presented day; the snapshot can never present another day's queue as today's.

### 2.8 No server change — the verification

Client-only, verified at Plan from the tree: the snapshot is a localStorage record in the family of three standing localStorage stores; no route in `app/worker/src/index.ts` is added, read, or changed by this design; no payload gains a field (contrast v352, whose `liturgicalDay` required one); no D1 table is touched, so **no migration stands in this release** and the migration sequence is undisturbed (0014 remains v356's claimed number, 0015 is v352's, both exactly as they stood). The only served-file changes are `client.ts` and the service-worker pin that names it (the standing `ora-pro-nobis-vNNN-1` pin in `ui.ts` bumps to `ora-pro-nobis-v355-1`, per the pin-succession discipline every client release follows).

### 2.9 Seams named forward — for v356's Implement (and v353's Plan)

This release touches, in `client.ts` only:

- The **state initializer** (one flag field added beside `previewQueue`).
- The **localStorage section** beside `saveResume`/`readResume` (the new `saveQueueSnapshot` + the restore reader live there).
- **Hooks (added calls, no behavior change)** in `startQueue`, `startDesc`, the standing `pause` listener beside `saveResume()`, the `timeupdate` throttle, and a new `pagehide` listener beside the v346 `visibilitychange` listener (which gains one added call).
- The **`loadedmetadata` handler** (the §2.3-step-7 clamp).
- **`renderPrayers`' payload-success path** (the restore step beside `resolveExternals(day)`) and **`paintContinue`** (the flag gate at its head).
- `ui.ts`: the SW pin string only.

v356's surfaces — the `/api/exam/*` and `/api/confession/*` gates in `index.ts`, the Examination/Confession renderers, the `api()` helper, the tab flow — are disjoint from every region above; its Plan's stated dependency ("rebase onto the landed v355 tree and re-verify the `api()`/render seams") reduces to the trunk landing order, with no seam in this release inside its build area. For v353's Plan (which seats after v355/v356 land): the boot path gains a restore step and the Continue slot gains a flag gate — the structure release's Listen-home redesign inherits both as standing behavior on the surfaces it rebuilds.

### 2.10 Harness plan

A new `harness-v355.mjs`, built on the estate's standing harness shape (the real client under headless Chromium against the harness Worker's fixture day), with its fixture migration set including **0015** (the v352 §4 fixture-cap lesson: harnesses that stop at 0013 abort on the payload's `prayer_liturgical_days` query — the fixture set runs the full migration sequence through 0015). Legs:

- **L1 Write-on-build:** starting a queue (Play All and a v351 card tap) writes a record whose `ids`/`idx`/`currentId` match the standing queue exactly.
- **L2 Write-on-move:** advance and `jumpQueueTo` update `idx`/`currentId`; pause writes the live position; a position tick (throttled) refreshes `positionS`.
- **L3 Discard survival:** with a queue standing, a full page reload (fresh page state, same storage) restores the queue in stored order, standing PAUSED — no audio playing, dock standing on the stored current at the stored position.
- **L4 Position exactness + clamp:** a mid-track position restores to the second; a stored position beyond the fresh duration stands clamped one second short and does NOT advance or mark the track.
- **L5 Yesterday discard:** a record dated the day before the presented day is removed at boot and never restores; Continue paints under its standing rules.
- **L6 Continue suppression + return:** with a restored queue standing, the Continue slot is empty though the played store would otherwise raise the card; when the restored queue plays out to its end, the record is removed and the Continue card returns.
- **L7 Replace clears:** a card tap (v351 force-replace) and a `playTrack` single play each retire the old record — the tap's new queue is snapshotted, the single play leaves no record.
- **L8 Missing tracks:** a stored id absent from the fresh day drops out with order preserved; a dropped CURRENT id stands the following survivor current at 0; an all-dropped record is removed and Continue governs; an unavailable-at-restore current (ext slot unresolved) keeps its queue place while the current stands on the first available survivor.
- **L9 Timer off (decision 7):** arm a sleep timer, snapshot, reload — the restored session's sleep state is off and no timer field exists in the record.
- **L10 No-record boot:** with no record, boot is byte-for-behavior identical to today (no dock standing, Continue under its standing gate).
- **Regressions:** the standing families run as they stand — v344 (played/Continue), v346 (media session), v347 (queue list), v350 (externals courier), v351 (tap-to-queue), v352 (liturgical) — with the pin-succession legs reading the new `ora-pro-nobis-v355-1` pin and the fixture-cap legs dispositioned per the v352 §4 pattern (a failure whose sole cause is a family's own superseded pin or its pre-0015 fixture cap is dispositioned, not counted against the release; any other failure is the release's to answer).

### 2.11 Ship shape

Standard five-phase to production: Implement in a clean release worktree on `release/v355` from trunk `ee34d35`, harness green from complete logs, ff-only landing; Review after landing (client-only, no data/auth/migration surface, so no pre-landing Review stands required); Ship deploys the app Worker from the clean tree via the connector-surrogate wrangler (rollback = the standing production version at ship time), door proofs on the player/day shell, and the four-piece flip (registry row Live by full-field upsert with camelCase `shippedAt`/`whatsNewId`, shipped record, project What's New read live, phase records). **John's phone verdict — leave the app mid-queue, return, find the queue standing paused at his place — is recorded in §5 as his, pending; never as passed.** No sheet or job edits stand in this release; no board task stands for it.
