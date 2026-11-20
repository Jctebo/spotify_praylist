# v320 — Sleep timer for the prayer player

- **Project:** Ora Pro Nobis
- **Slug:** v320-player-sleep-timer
- **Registry:** DevOps Board app, project ora-pro-nobis, row id 580, version "v320", status Backlog, Run Directive "Scope only"
- **Branch:** release/v320 in the fork (~/workspace/projects/spotify_praylist-fork); the timer is built against the v312 player on branch release/v312 (worktree ~/workspace/.worktrees/v312) once v312 stands on trunk
- **Run Directive:** Scope only — the Scope Gate holds this release at Scope. This document is the scope package for John (with the HTML package at ~/workspace/your_files/v320-scope-package.html); Plan does not open until John approves and sets the level.

## 1 · Scope

- **Agent:** Scope Agent (v320) — Scope claim record 1069, claimed 2026-11-08 23:52 UTC (17:52 CT)
- **Inputs read:** the v320 registry row (id 580) · John's approval of grooming-review recommendation #9 (main chat, 2026-11-08) and the analyst document (~/workspace/your_files/grooming-review-2026-11-08.md, item #9) · the v312 player as built — app/worker/src/client.ts on branch release/v312 (the queue engine, the Media Session handlers, the resume store), read first-hand in this pass · the v312 release document (§1 + §2, elements E5/E6)

### John's decision (settled — not re-opened by this section)

John approved grooming-review recommendation #9 in the main chat on 2026-11-08: add the standard sleep timer to the prayer player — presets plus end-of-episode — as a client-only follow-on once v312 ships. Feature axis, size S, risk LOW (the row's own sizing).

### Hard precondition (stated plainly)

**This release depends on v312 shipping first.** The timer is a control on v312's queue engine: there is no Play All queue, no autoplay-next, and no resume store in the live v305 player for a timer to govern. v312 stands at Review (agent side complete 2026-11-08, awaiting John's phone check; the chain stops before Ship at his approval level). **Plan for v320 does not open until v312 is Live and its player stands on the fork trunk**; this release's branch then cuts from that trunk, not from today's. If v312's design changes at its Review or Ship, this scope is re-read against the shipped player before Plan.

### Discovery findings (verified this pass, in the built v312 client)

1. **The engine the timer governs.** app/worker/src/client.ts (branch release/v312, 511 lines): one shell-scope `audioEl`; `startQueue(descs)` builds the day or block queue; the `ended` handler calls `advanceQueue(1)` — autoplay-next across blocks; queue end clears the queue and the playing marks. Queue and audio state live in the shell scope; no render resets them.
2. **The resume store the timer must respect.** Playback position is saved to localStorage (`opn-resume-v312`) on `pause` and on a ~5 s `timeupdate` throttle, and a saved position is offered, paused, on the next open for the same stored day. A timer stop that pauses the element therefore **already** records the resume point through the standing `pause` handler — the timer needs no resume logic of its own, and must not add a second one.
3. **No timer exists.** A grep for timer/sleep across the v312 client and UI sources returns nothing — this release adds the whole control.
4. **The control's home.** The Prayers render carries the Play All row at the top of the tab (client.ts:302 — "Play All · the whole day, in order"). The timer control stands in that same transport area (mockup in the HTML package), reachable while any playback runs, per-block queues included.
5. **Constraints that stand:** client-only — no Worker, D1, R2, door, or job-sheet change · no checklist · the one-day / today-centered shape is untouched · the app stays John-only · v312's font floor governs the control's text · the service-worker cache name bumps with the client change (the v312 E7 rule, so the new client actually reaches John's phone).

### Scope Record

- **Outcome:** a listener who starts the day's playback at night can set it to stop on its own — after a chosen span or at the end of the current track — and the standing resume picks up exactly where listening stopped.
- **In scope:**
  1. **The control.** A **Sleep timer** control in the Prayers tab's transport area beside Play All (the mockup shows its placement and its open state). It reads its state at a glance: **Off** when unset; the remaining time (or "End of track") while armed.
  2. **The choices.** **Off · 5 · 10 · 15 · 30 · 45 · 60 minutes · End of track.** One tap arms; choosing Off disarms. The armed choice is shown in the control without opening anything.
  3. **Timed stop.** When a minute timer expires: playback pauses (through the element's own pause, so the standing resume save fires), the queue is **held, not cleared** — the state reads as paused mid-queue exactly as if the listener had tapped pause — and the timer returns to Off. No sound, no dialog, no mark on any card.
  4. **End-of-track stop.** When armed, the current track plays to its end and playback does not advance: the queue's autoplay-next is suppressed for that one track end, playback stands paused at the next track's head (the resume store records the finished track's end state through the standing handlers — Plan verifies the saved position reads as the next track, unstarted), and the timer returns to Off.
  5. **The fade (named choice).** In the last ~15 seconds of a minute timer, the element's volume eases down before the pause, and is restored for the next play. (If Plan finds the platform restores volume unreliably, the fade is the first thing cut — the stop itself is the feature; §1 records the fade as wanted, not as a criterion.)
  6. **Scope of arming.** The timer is a player state, not a per-queue state: arming it during any playback (whole-day queue, block queue, or a single track) governs that playback; switching tabs never disarms it (the standing shell-scope rule); changing the queue (a new Play All) keeps an armed timer armed unless the listener turns it Off. It does not persist across app restarts — a reopened app starts with the timer Off.
- **Out of scope:** a timer on the Intentions-segment audio bar outside the queue engine (the legacy single-play path) · scheduling playback to *start* (this is a stop only) · per-block or per-track default timers · any server, store, or push change · any change to v312's queue, resume, or Media Session behavior beyond the one suppressed advance in item 4.
- **Affected surfaces:** the app client only (one control + the timer state in the shell scope) and the service-worker cache name. Nothing else in the monorepo, the pipeline, or the app store.
- **Review placement:** on the branch candidate, before any trunk landing (the standing client-change shape). Criterion checks run in the v312 harness mold (real-browser boot, accelerated timers — a 1-minute arm tested at test speed, Plan settles the harness seam) plus **one item on John's phone**: set a short timer at night, confirm playback stops and the morning resume offers the place — folded into a single verdict with actor John, as v312's phone check set the pattern. The fade, if it survives Plan, is judged by ear in the same check.

### Acceptance criteria

1. Arming each minute preset stops playback at expiry (±2 s at test speed): the element stands paused, the queue stands held (not cleared), the control reads Off, and no dialog or sound marks the stop.
2. Arming End of track during a queue: the current track finishes, the next track does **not** start, and reopening the app offers the resume at the next track, unstarted.
3. The resume after a timed stop offers the exact position where playback stopped (the standing v312 resume, unmodified).
4. Turning the timer Off before expiry: playback continues past the would-be expiry untouched.
5. Nothing else moves: Play All ×2, autoplay-next (unarmed), Media Session controls, the four tabs, and the stored day behave exactly as v312 shipped them; the served client parses and boots with zero page errors (the standing parse + boot pin).

### Concerns and Information Needs

- **Facts:** the engine, handlers, and resume store are as quoted from the built v312 client above · the pause-driven resume save means the timer's stop needs no new persistence — verified in the `pause` handler, which is also the timed stop's exact mechanism · no timer code exists to conflict with.
- **Assumptions:** phone browsers keep a backgrounded/locked PWA's timers honest enough for minute-scale presets while audio plays (the audio element is active, which is the case the platform keeps alive) — the phone check in Review is where this assumption is proven, on John's own surface, and an unreliable result returns the item to Scope rather than shipping a timer that fires late.
- **Uncertainties:** the fade's volume restore across a pause is platform-dependent (named as cuttable in item 5) · whether "End of track" should also exist for the per-block queue's last track is moot — at queue end playback already stops; the arm simply reads Off.
- **Decision impact:** none open for John inside his approval — the presets, the held-queue rule, and the non-persistence across restarts are stated above for his eye.
- **First source to check:** app/worker/src/client.ts on branch release/v312 (the queue engine this rides) and §2 of the v312 document (E5/E6, the elements this extends).

### Recommended approval level

- **Recommendation: Through Review (level 4)** — the chain stops before Ship, and Plan seats only after v312 is Live (the hard precondition above).
- **Reason:** the change is small and client-only, but its one real proof is a behavior on John's phone at night — the v312 pattern (agent evidence plus his verdict) is the right gate, and Ship, which also sequences the cache bump onto his installed app, stays a separate word. Plain "approve" sets this level.

## 2 · Plan

- **Agent:** Plan Agent (v320) — Plan claim record 1109, claimed 2026-11-09 01:55:46 UTC (19:55 CT); time contract 30
- **Level in force:** Autonomous to Ship (John's blanket, 2026-11-08 19:41 CT) — this Plan's pass runs the chain on to Implement without another word. §1's recommended level (Through Review) was superseded by that blanket; the Review phone check §1 named still stands as a Review criterion (§2.11).
- **Precondition check:** §1's hard precondition is MET — v312 shipped Live 2026-11-08 (trunk merge 5460a2e, Worker 2586e412, phone check waived by John's "Push it" order and recorded in v312's §4/§5). This Plan was written against the shipped player, not the Review candidate.
- **Inputs read:** §1 of this document · the shipped v312 player on the standing trunk line (`muse-draft-week` at 9347be4, which carries merge 5460a2e) — `app/worker/src/client.ts` (511 lines, read in full), `app/worker/src/ui.ts` (the CSS floor and the SW cache line), `app/tests/harness-v312.mjs` (the harness mold)

### 2.1 — State model (pinned)

- One addition to the shell-scope `state` object in client.ts: `state.sleep`, exactly one of `{ mode: 'off' }` · `{ mode: 'minutes', presetMin: <n>, deadlineMs: <epoch ms> }` · `{ mode: 'track' }`. It lives and dies in shell scope like the queue itself; no render resets it (§1 item 6).
- All code lands in `app/worker/src/client.ts` plus the one cache-name line in `app/worker/src/ui.ts` (§2.12). No change to index.ts, any Worker route, D1, R2, the door, or the job sheet — client-only, as scoped.

### 2.2 — The control: placement and states (pinned)

- **Placement:** inside the standing Play All row in `renderPrayers` (the `<div class="row">` that carries `#play-all`), after the "the whole day, in order" meta span: one button, `id="sleep-btn"`, standing classes `btn ghost`. Nothing else in the row changes; no control is added to any other tab (§1 item 1: the control's home is the Prayers transport area; the timer still governs while other tabs stand open, per §1 item 6).
- **Label = state, at a glance** (§1 item 1): Off → `Sleep · Off` · minutes armed → `Sleep · M:SS` (remaining time, rounded up to the next second) · End of track armed → `Sleep · End of track`. Standing classes only — `btn` text is 15px, `meta` 14px, body 17px (ui.ts); no new font size is introduced anywhere, so the v312 font floor holds by construction.
- **The sheet:** tapping the button opens a sheet in the app's standing pattern (`div.sheet > div.inner`, as the Intention editor uses), titled "Sleep timer", holding one button per choice in the exact §1 order — **Off · 5 · 10 · 15 · 30 · 45 · 60 minutes · End of track** — with the currently armed choice carrying the standing `active` treatment (as the Examination chips do) and a Close button that dismisses without change. One tap on a choice arms it and closes the sheet (§1 item 2: one tap arms; choosing Off disarms). No confirm step, no second screen.
- **Label upkeep:** every `renderPrayers` call derives the button's label from `state.sleep` at render time, so a re-render can never lose or reset an arm; between renders, the countdown tick (§2.3) updates `#sleep-btn`'s text in place when it exists. The button is re-wired on each render with the row's other controls.

### 2.3 — Countdown mechanics (pinned)

- **Deadline-based, never a decrementing counter:** arming a minute preset stores `deadlineMs = Date.now() + presetMin * 60000`. Remaining time is always recomputed from the deadline, so interval throttling cannot stretch the timer — it can only delay the fire check (bounded in §2.7).
- **Two check paths, one function:** a single 1-second `setInterval` lives in shell scope from boot, and the standing `timeupdate` handler gains one call; both call the same `sleepTick()`. `sleepTick()`: if mode is not `minutes`, return · compute `remaining = deadlineMs - Date.now()` · update the label · if `remaining <= 15000` and the fade has not started, start the fade (§2.6) · if `remaining <= 0`, fire the timed stop (§2.4).
- **Idle-at-deadline edge:** if at the deadline the element is already paused, or nothing is loaded, firing is a disarm only — no pause call, no resume write, no dialog; the fade restore (§2.6) still runs so a mid-fade manual pause cannot strand a lowered volume past the deadline.

### 2.4 — Timed stop (pinned)

Exactly §1 item 3, in this order: (1) `audioEl.pause()` — the standing `pause` handler saves the resume point through `saveResume()`; the timer adds **no** save of its own and no second resume logic (§1 finding 2) · (2) disarm (`state.sleep = { mode: 'off' }`) · (3) fade restore (§2.6) · (4) label → `Sleep · Off`. `state.queue`, `state.queueIdx`, and `state.current` are not touched — the queue stands **held, not cleared**, indistinguishable from a manual pause mid-queue. No sound, no dialog, no mark on any card.

### 2.5 — End of track (pinned) — the one `ended`-handler change

- In the standing `ended` handler, before the queue advance: if `state.sleep.mode` is `'track'`, run the end-of-track stop below. **The arm disarms as it fires in every sub-case**, so exactly one track end is ever suppressed; the next natural end advances normally.
  - **(a) Queue with a next available descriptor — hold at the next track's head:** advance `queueIdx` to the next available descriptor using `advanceQueue`'s own skip rule (unavailable descriptors passed over with `markSkipped`) **without playing it**: set `state.current` to that descriptor, `setMediaSessionFor(desc)`, `audioEl.src = desc.url`, `audioEl.load()` (the explicit-load rule from v312's resume work — the element is `preload="none"`, so `src` alone loads nothing), `markPlaying(desc.episodeId)`, then an explicit `saveResume()` — which writes `{ date: storedDay, episodeId: <next track>, positionS: audioEl.currentTime = 0 }`. Ordering argument: whether the element's own `pause` event lands before or after this handler, the final stored record is the next track at 0 — the pause handler saves whatever `state.current` then is, and this handler's save runs after `state.current` changes. Playback stands paused at the next track's head; resuming is a plain play of that head track (its card button or Media Session play) — no special path. This is §1 criterion 2's exact end state.
  - **(b) Queue exhausted (no next available descriptor):** exactly the standing queue-end path — queue cleared, `current` null, `markPlaying(null)` — nothing added; the arm simply reads Off (§1's moot note).
  - **(c) No queue (a single track via `playTrack`/`play`):** exactly the standing path (`current` null, `markPlaying(null)`); disarm only.
- **Interaction with manual controls:** the arm is a player state, **not bound to a track**. Media Session next/previous, seek, a new `startQueue`, or a single-track `playTrack` while armed change which track is current; an end-of-track arm fires at the end of whatever track is then playing, and a minute arm's deadline never moves (§1 item 6: changing the queue keeps an armed timer armed). A pause from any surface (Media Session, card toggle, `startQueue`'s toggle-pause) never disarms either mode. Only firing, choosing Off, or an app restart disarms.

### 2.6 — Fade decision: IN, probed, with pinned restores

- **Decision: IN.** §1 item 5 leaves the call to Plan. Reason: the fade is the difference between a gentle stop and a hard cut mid-prayer in the feature's whole setting — a listener falling asleep at Night Prayer — and §1 names it wanted. The platform risk §1 flagged (volume restore unreliable) is contained by construction: **the fade never owns the stop** (the stop is `pause()`, independent of volume), and every volume write is paired with a pinned restore point below.
- **Shape:** when a minutes timer first reaches `remaining <= 15000` in `sleepTick()`, record `fadeBase = audioEl.volume` and start the ramp: on each tick, `audioEl.volume = fadeBase * max(0, remaining / 15000)`. The volume is recomputed from the remaining time on every tick, never accumulated — a manual pause mid-fade followed by play cannot compound it, and the ramp simply resumes from the then-remaining time.
- **Capability probe:** after the first ramp write, read the value back. If it did not move (platforms where element volume is not settable — iOS Safari is the known case), mark the fade unsupported for this run and make no further volume writes; the stop proceeds without a fade, silently. No error, no label change, no criterion depends on it.
- **Restore points (exhaustive — every play path in this one file):** (1) immediately after the timed stop's `pause()` · (2) at the top of `startDesc` — the single funnel every playback start passes through (`startQueue`, `advanceQueue`, `playTrack`) · (3) in the Media Session `play` handler — the one play path that bypasses `startDesc`. Restore = `audioEl.volume = fadeBase` (1 when no fade ran) and fade state cleared. `loadResume` never plays, so it needs no restore and never starts a fade.
- **End-of-track mode has no fade** (§1 ties the fade to the minute timer's last ~15 s; a track's own ending is already a natural ending). The fade is judged by ear in Review's phone check (§2.11), never by the harness alone.

### 2.7 — Background playback and autoplay-next (pinned)

- **Autoplay-next:** untouched, except the single suppressed advance in §2.5(a). A minute timer never blocks, delays, or alters an advance; tracks change under it freely.
- **Media Session:** no new handlers, no handler changes — the stop is an internal `pause()`, so lock-screen state follows the element to paused on its own, and the metadata of the held/current track stands as the handlers already set it.
- **Background/locked honesty bound:** the timer is a wall-clock deadline in the page — no WakeLock, no worker thread, no notification. While audio plays, `timeupdate` keeps arriving and keeps the deadline honest; if the platform freezes the page outright, the stop lands at the first check after the deadline when the page resumes. That bound is named, not hidden: Review's phone check on John's own phone is where the §1 assumption is proven, exactly as §1's Concerns assigned it.

### 2.8 — Restart reset (pinned exactly)

- `state.sleep` initializes to `{ mode: 'off' }` at boot and is **never written anywhere**: no new localStorage key, no cookie, no store field. The app's only localStorage key remains `opn-resume-v312`, byte shape unchanged — the timer adds no persistence of any kind (§1 item 6).
- **Resets** on app restart, page reload, or a service-worker-update reload: the arm (either mode), the deadline, the fade state, and the element volume (a fresh element starts at the platform default).
- **Does not reset:** the resume record, the stored day, anything server-side. The queue itself is shell-scope in v312 and already resets the same way; the timer adds nothing to that surface.

### 2.9 — Branch and build handling (pinned)

- `release/v320` stands on a pre-v312 trunk base (its §1 commit 2494c74 predates the v312 landing — §1 was written against the player as built, before it shipped). Before writing code, Implement **rebases `release/v320` onto `muse-draft-week`** (HEAD 9347be4 at this Plan; re-read at Implement start). The branch carries only this document, so the rebase is conflict-free by construction; the Scope record's commit hash stands as history, and the Ship section records the landed hashes.
- All work happens in the `~/workspace/.worktrees/v320` worktree. Harness runs follow the v312 hard guard: scratch instances inside that worktree, never the shared checkout — the harness refuses a shared-checkout path itself.
- **Files touched, exhaustively:** `app/worker/src/client.ts` (state, control + sheet, tick, the `ended` branch, fade, harness hook) and `app/worker/src/ui.ts` (one line: the cache name, §2.12). Nothing else in the monorepo.

### 2.10 — Harness seam (pinned)

Mirroring v312's `window.__opnMediaHandlers` precedent, the client exposes `window.__opnSleep` = `{ state(), armMinutes(n), armTrack(), disarm() }`: `state()` returns a copy of `state.sleep` plus `remainingMs`; `armMinutes(n)` accepts any positive number, fractional allowed (the harness arms at seconds scale through it; the production sheet passes only the §1 presets). The hook and the sheet call the **same** arm/disarm functions, so the hook cannot drift from the shipped behavior; the harness also drives the real sheet by taps (checks 3–4), so the UI path itself is gated.

### 2.11 — harness-v320 check list (pinned)

In the v312 mold: Playwright real-browser boot against a scratch instance inside the worktree, ffmpeg tone fixtures (short tracks where a track end is needed), numbered ok/not-ok lines, tallies read from the COMPLETE log. The harness file is `app/tests/harness-v320.mjs`, written by Implement.

1. **Parse + boot:** the served client parses, the app boots, zero page errors (the standing pin).
2. **Control:** the sleep button stands in the Prayers transport row beside Play All; its label reads `Sleep · Off` at boot.
3. **Sheet:** tapping the button opens the sheet; the choices stand in the exact order Off · 5 · 10 · 15 · 30 · 45 · 60 · End of track; one tap arms and closes the sheet.
4. **Real-path arm:** arming 5 through the sheet — two successive label reads decrease, and `__opnSleep.state()` agrees with the label.
5. **Timed fire (§1 criterion 1 + 3):** hook-armed at seconds scale against a playing queue — at expiry ±2 s the element stands paused; queue length, `queueIdx`, and `current` are unchanged (**held, not cleared**); the label reads Off; the resume record names the playing track at the stop position (±1 s).
6. **Disarm (§1 criterion 4):** arm, choose Off before expiry — playback continues past the would-be deadline untouched; the timer stands Off.
7. **Deadline invariance:** arm at seconds scale, `advanceQueue(1)` mid-arm — the stop fires at the original deadline, against the new track.
8. **End of track in a queue (§1 criterion 2):** arm End of track against a short fixture track mid-queue — the track finishes; the next track does **not** start (element paused); `state.current` is the next track; `audioEl.src` is the next track's URL; `currentTime` is 0; the resume record names the next track at 0; the label reads Off.
9. **Exactly one suppression:** after check 8, play the held track and let it end — it advances normally.
10. **End of track at the queue's last track:** the standing queue-end state stands (queue cleared, `current` null); the label reads Off.
11. **End of track on a single track (no queue):** the standing end state stands; the label reads Off.
12. **Fade branch:** where element volume is settable in the harness browser — inside the fade window the volume reads below `fadeBase`, and reads `fadeBase` again after the stop and after the next `startDesc`. Where it is not settable, the probe reports unsupported and the stop still fires on time. The check records which branch ran; neither branch may fail the gate.
13. **Restart reset:** arm (either mode), reload the page — the label reads Off, `__opnSleep.state()` reports mode `off`; the resume record stands byte-identical to its pre-arm shape.
14. **No new storage:** after arming and firing, the localStorage key set is exactly what stood at boot (the resume key only, beyond the harness's own seeds).
15. **Nothing else moves (§1 criterion 5):** Play All toggle, per-block queue, card play/pause toggle, and the Media Session handler table (read via `__opnMediaHandlers`) behave as harness-v312's corresponding checks found them.
16. **Regression:** harness-v312 runs green on the same tree; its complete-log tally is quoted in §3.

**Review phone check (one item, per §1):** John sets a short timer at night on his own phone — playback stops on its own, and the morning resume offers the place where listening stopped; the fade is judged by ear in the same check. One verdict, actor John, folded as v312's phone check set the pattern. Ship waits on that verdict under the standing Review gate; the Autonomous-to-Ship directive then carries it through without another word.

### 2.12 — Service-worker cache bump (pinned)

ui.ts line 117: `var CACHE = "ora-pro-nobis-v312-1"` → `"ora-pro-nobis-v320-1"` — the standing v312 E7 rule, so the new client actually reaches John's installed app. No other ui.ts change; no CSS change of any kind.

### 2.13 — Rollback shape (pinned)

Client-only, so rollback is a **pure redeploy**: redeploy the pre-v320 Worker build (v312's Ship build, Worker 2586e412) or revert the v320 trunk merge and redeploy. There is no migration to unwind (none exists), no data shape changes, and the resume record is untouched by construction — a rolled-back app reads it exactly as v312 left it. The cache name returns with the reverted client. A post-Ship rollback is a fix-forward decision recorded in §5, never a data event.

### 2.14 — Ship proof list (pinned)

1. harness-v320 complete-log tally and the harness-v312 regression tally, both on the merged trunk tree (tallies from complete logs, never truncated output).
2. The trunk merge commit and the deployed Worker version id.
3. Production read-backs: the production-served client carries the sleep control and the `__opnSleep` hook, and its cache name reads `ora-pro-nobis-v320-1`; the served bytes parse and boot (the standing parse pin, executed against the production-served client).
4. The flip pieces, each read back: the release row Live + `shipped_at` + `whats_new_id` · the shipped record · the What's New entry · the Ship phase record passed · §5 appended and this document republished at the merge commit.
5. Nothing else moved: the `/api/player/day` payload shape is unchanged (spot-read against v312's §5 record); no route, store, or job-sheet diff rides the merge.

### Acceptance-criteria mapping (§1 → this Plan)

- §1 criterion 1 (timed stop, held queue, reads Off, silent) → harness checks 5 (+ 3–4 for the arming path)
- §1 criterion 2 (end-of-track, resume at the next track unstarted) → harness check 8 (+ 9–11 for the edges)
- §1 criterion 3 (resume offers the exact stop position) → harness check 5
- §1 criterion 4 (Off before expiry = untouched) → harness check 6
- §1 criterion 5 (nothing else moves; parse + boot clean) → harness checks 1, 15, 16
- The fade (wanted, not a criterion) → harness check 12 (mechanics) + Review phone check (by ear)

### Concerns and Information Needs

- **Facts:** every engine fact above was verified first-hand in the shipped client at trunk 9347be4 — the `ended` handler's advance, the `pause` handler's `saveResume()`, `advanceQueue`'s skip-and-clear rules, the `preload="none"` explicit-load trap (v312's own finding, honored in §2.5(a)), the Play All row's markup, the ui.ts font sizes, and the cache line. No timer code exists to conflict with (grep over the shipped tree returns nothing).
- **Assumptions:** the §1 background-timer assumption (a backgrounded/locked PWA playing audio keeps its checks honest at minute scale) is carried unchanged — Plan cannot retire it from a desk; §2.7 names the honest bound and Review's phone check is its proof surface. If the phone check shows the timer firing late in the background, the item returns to Scope with that evidence rather than shipping a timer that fires late.
- **Uncertainties:** the `pause`-event ordering against the `ended` handler (§2.5(a)) is argued, not assumed — both orders land on the same stored record, and harness check 8 verifies the end state itself, not the order. The fade's feel (15 s ramp from full volume) is a by-ear judgment reserved to the phone check; the ramp length is §1's own figure.
- **Decision impact:** one decision was Plan's to make and is made — the fade is IN (§2.6), with the probe and restores that contain its risk. The preset set is confirmed against §1 exactly: **Off · 5 · 10 · 15 · 30 · 45 · 60 · End of track** — no addition, no removal. No decision is open for John inside this Plan.
- **First source to check:** `app/worker/src/client.ts` on `muse-draft-week` (the shipped engine this rides) and harness-v312.mjs (the mold §2.11 follows).

## 3 · Implement

- **Agent:** Implement Agent (v320) — Implement claim record 1111, claimed 2026-11-09 01:59 UTC (19:59 CT); time contract 32 (separate from Plan's contract 30, per the repo pattern)
- **Level in force:** Autonomous to Ship (John's blanket, 2026-11-08 19:41 CT) — this pass runs Implement only; Review follows, carrying the one phone item §2.11 names. No trunk landing, no deploy in Implement (§2.9).
- **Base handling (§2.9, as pinned):** `release/v320` rebased onto `muse-draft-week` at 9347be4 before any code was written — conflict-free, document-only as predicted (Scope stands as ac5acb3, Plan as 46777c2 after the rebase). All work in `~/workspace/.worktrees/v320`. Build commit **db59762**.
- **Files touched — exactly the §2.9 list, nothing else:** `app/worker/src/client.ts` (the sleep module, the control + sheet, the tick, the `ended` branch, the fade, the harness seam) and `app/worker/src/ui.ts` (one line: the cache name). Diff stat: client.ts +160/−2 net lines, ui.ts 1 line changed. The harness is a new file (`app/tests/harness-v320.mjs`) plus its logs, as §2.11 directs.

### What was built (per §2 pin)

- **State (§2.1/§2.8):** `state.sleep` added to the shell-scope state, initializing to `{ mode: 'off' }` at boot and never written anywhere — no new localStorage key, no cookie, no store field; the resume record's byte shape is unchanged (harness checks 13–14 verify both).
- **Control (§2.2):** one button `id="sleep-btn"`, classes `btn ghost`, inside the Play All row after the meta span; the label derives from `state.sleep` at every render and is updated in place by the tick between renders. The sheet follows the standing pattern (titled "Sleep timer", one chip per choice in the exact order **Off · 5 · 10 · 15 · 30 · 45 · 60 · End of track**, the armed choice carrying `active`, a Close that dismisses without change); one tap arms and closes.
- **Countdown (§2.3):** deadline-based — `deadlineMs = Date.now() + presetMin * 60000`, remaining always recomputed; one 1-second shell-scope interval and one added call in the standing `timeupdate` handler, both calling the same `sleepTick()`. The §2.3 idle-at-deadline edge is honored (already paused or nothing loaded → disarm only, no pause call, no resume write; the fade restore still runs).
- **Timed stop (§2.4):** exactly the pinned order — `pause()` (the standing pause handler saves the resume point; the timer adds no save of its own) · disarm · fade restore · label to Off. Queue, queueIdx, and current untouched — held, not cleared (check 5).
- **End of track (§2.5):** the one `ended`-handler change — the track-mode branch runs before the queue advance and disarms as it fires in every sub-case, so exactly one suppression ever occurs (check 9). Sub-case (a) walks to the next available descriptor by advanceQueue's own skip rule (markSkipped on unavailable) without playing it: current set, Media Session metadata set, `src` set, explicit `load()` (the preload="none" rule), markPlaying, explicit saveResume writing the next track at 0 (check 8). Sub-cases (b) and (c) are the standing end paths untouched (checks 10–11).
- **Fade (§2.6) — IN, as pinned:** at `remaining <= 15000` the base is captured once and each tick writes `fadeBase * max(0, remaining/15000)` — recomputed from the remaining time, never accumulated. The capability probe reads back after the first ramp write (a read-back materially above the written target marks the fade unsupported for the run; no further writes; the stop proceeds silently). Restores at exactly the three pinned points: after the timed stop's pause · at the top of `startDesc` · in the Media Session `play` handler. One implementation detail inside those pins: re-arming while a fade stands restores first, so a re-arm can never strand a lowered volume (the fade-state clearing §2.6's restore definition already names).
- **Harness seam (§2.10):** `window.__opnSleep = { state(), armMinutes(n), armTrack(), disarm() }`; the hook and the sheet call the same arm/disarm functions. `state()` returns a copy of `state.sleep` plus `remainingMs`.
- **Cache (§2.12):** ui.ts line 117 — `ora-pro-nobis-v312-1` → `ora-pro-nobis-v320-1`. No other ui.ts change; no CSS change.

### Harness evidence (complete logs, tallies read from the files)

- **harness-v320: 61 ok / 0 FAIL** (`app/tests/harness-v320.log`, exit 0) — §2.11 checks 1–15, all green: parse + boot with zero page errors across the whole run · control + label · sheet order and real-path arm (label reads decrease 5:00 → 4:59, state() agrees) · timed fire at expiry with queue/idx/current unchanged and the resume record naming the playing track at the element's stop position exactly (1.96 s vs 1.96 s) · disarm before expiry leaves playback untouched past the deadline · deadline invariance across an advanceQueue (stop at 5.0 s on a 4.8 s arm, against the new track) · end-of-track hold-at-head (src, currentTime 0, resume at 0, queue intact) · exactly one suppression · queue-end and single-track edges · restart reset with the resume record byte-identical · no new storage (the key set is exactly `opn-resume-v312`) · nothing else moves (Play All toggle, per-block slice, card toggle, the 7-handler Media Session table).
- **Fade branch observed (check 12): SETTABLE** — in the harness browser (Chromium) the volume read **0.73** inside the window at 11 s remaining (the ramp value for that remaining time), read fadeBase (1) again after the stop, and read 1 again after the next `startDesc`. The unsupported branch was not exercised — by construction it cannot be in this browser; the probe code path stands as §2.6 pins it, and the by-ear judgment remains Review's phone check.
- **Check 16 regression — harness-v312 on the same tree: 58 ok / 1 FAIL** (`app/tests/harness-v312-on-v320.log`, complete log). See the named deviation below: the single FAIL is v312's own cache-name pin and nothing else — every functional v312 check (door push, replace-day, payload, queue order, Media Session, resume, fonts, Access refusals) passes on the v320 tree.

### Named deviation (one, for Review to rule)

- **§2.11 check 16 ("harness-v312 runs green") conflicts with §2.12 inside the same Plan.** harness-v312's check 11 asserts the served SW cache name reads literally `ora-pro-nobis-v312-1`; §2.12 pins this release to change that name to `ora-pro-nobis-v320-1`, and the brief for this pass pinned it again. §2.12 was followed. Result: harness-v312 stands 58 ok / 1 FAIL on the v320 tree, the FAIL being exactly that superseded pin (its own harness-v320 counterpart, check 1, asserts the new name and passes). harness-v312.mjs was NOT edited — it stands outside §2.9's file list. Review's ruling is asked on this single point; no other check in either harness fails.

### Order sensitivity (v325 coordination note)

- John's player order rule (2026-11-08 20:02 CT — every block opens with its Intentions segment) lands as the v325 fix-forward on the trunk after this release; §2 behavior here is unchanged by it, and the build inherits whatever payload order stands because the queue builder reads payload order (as it did in v312).
- Named per the coordination note: harness-v320 checks **7 and 8** are order-sensitive by construction — the payload as shipped interleaves each block's Intentions segment inside its track list (the fixture day serves Midday as ep-short-a · seg:Midday · ep-short-b · ep-long-c), so both checks read the "next descriptor" from the live queue instead of assuming an episode-first order. They pass against the current order and follow the v325 order when it lands; no queue-order assumption is baked into the timer build itself.

### Harness build notes (harness-side only — no build change)

- Two harness fixes during the pass, neither touching the build: (1) fixture short tracks stand at 6 s wherever an arm must land before the track ends — at 2.5 s a track ended before the arm under this machine's load and the hold window was missed (reproduced twice, then designed out); (2) check 15 pauses before the per-block queue click, because startQueue's standing toggle-pause fires while any queue plays — the same step harness-v312 takes. The scratch instance also moved to port 8951 after a foreign instance was found answering on the first-choice port during probing.

### Concerns and Information Needs

- **Facts:** both harness tallies above are read from complete log files committed with the build (db59762); the served client was parsed (vm.Script) and executed by the real-browser harness, per the standing pin.
- **Assumptions:** none added beyond §2's own — the background/locked timer-honesty bound (§2.7) stands exactly as Plan carried it, with Review's phone check as its proof surface.
- **Uncertainties:** the fade's feel (the 15 s ramp) is a by-ear judgment reserved to Review's phone check (§2.6/§2.11); the probe's read-back tolerance (0.02) is an Implement choice inside §2.6's "did not move" wording — in a supporting browser the write/read-back are exact, so the tolerance never decides a real case there.
- **Decision impact:** one ruling is owed by Review — the check-16/cache-pin deviation above. Nothing is open for John inside Implement; Review's one phone item (§2.11) stands as pinned.
- **First source to check:** `app/tests/harness-v320.log` (the 61-line gate) and `app/tests/harness-v312-on-v320.log` line 51 (the single regression FAIL, the superseded pin).

## 4 · Review

- **Agent:** Review Agent (v320) — Review claim record 1115, claimed 2026-11-09 02:16:53 UTC (20:16 CT); time contract 37. This Review ran BEFORE any trunk landing (§2's gate). **Review stands ACTIVE, not passed** — every agent-side criterion is judged below; the one phone criterion (§2.11) stands PENDING John's check on the candidate prepared by this pass, and the record passes only when his verdict lands (or he waives, as for v312).
- **Inputs read first-hand:** §1–§3 of this document · the complete build diff 9347be4..db59762 (client.ts +162/−2 across seven hunks, ui.ts exactly one line) · the standing base code the pins lean on (`advanceQueue`, `saveResume`, the localStorage surface) · both of Review's own harness runs (below).

### Criterion verdicts (§1 criteria, via §2's mapping)

1. **Timed stop — queue held, label Off, silent (§1 criteria 1 + 3): MET.** The built `fireTimedStop` follows §2.4's order exactly — `pause()` only (the standing pause handler saves the resume point; the timer adds no save), disarm, fade restore, label — and touches neither `state.queue`, `state.queueIdx`, nor `state.current`. Review's harness check 5: paused at expiry, queue/idx/current unchanged, resume record naming the playing track at the element's stop position exactly (2.70 s vs 2.70 s).
2. **End of track — hold at the next track's head (§1 criterion 2): MET.** The one `ended`-handler change branches before the advance and disarms as it fires in every sub-case (exactly one suppression — check 9: the held track then plays out and advances normally). Sub-case (a) walks by `advanceQueue`'s own skip rule (verified against the base function: same `markSkipped` walk; sub-case (b) replicates its queue-end line for line), sets current + Media Session, `src` + explicit `load()` (the preload="none" rule), `markPlaying`, explicit `saveResume`. Check 8: element paused, `src` = next track, `currentTime` 0, resume record names the next track at 0, queue intact. Sub-cases (b)/(c) stand as the standing end paths (checks 10–11).
3. **Off before expiry = untouched (§1 criterion 4): MET** — check 6: playback continues past the would-be deadline; the timer stands Off.
4. **Nothing else moves (§1 criterion 5): MET** — checks 1 + 15 in Review's own run: served client parses, boot with zero page errors across the whole run, Play All toggle, per-block queue, card play/pause toggle, and the 7-handler Media Session table unchanged. The build diff touches nothing outside §2.9's two files.
5. **Control + sheet (§2.2): MET** — checks 2–4: the `Sleep · …` button stands in the Play All row with classes `btn ghost`, label = state at every render; the sheet carries the exact order Off · 5 · 10 · 15 · 30 · 45 · 60 · End of track, the armed choice `active`, one tap arms and closes; the hook and the sheet call the same arm/disarm functions (§2.10 seam read in code).
6. **Countdown + restart reset (§2.3/§2.8): MET** — deadline-based throughout (remaining always recomputed; check 7: the stop fires at the original deadline across a mid-arm queue advance); the §2.3 idle edge is honored in code (already paused / nothing loaded → disarm only, fade restore still runs). `state.sleep` initializes `{mode:'off'}` in shell scope and is never written anywhere: a grep of the built client shows `localStorage` touched only for the standing `opn-resume-v312` key (set/get/remove), byte shape unchanged (checks 13–14: after reload the timer stands Off and the resume record stands byte-identical; the key set is exactly the resume key).
7. **Fade mechanics (§2.6): MET as mechanics; the by-ear judgment is the phone item.** In code: the ramp recomputes from remaining time on every tick (`fadeBase * max(0, remaining/15000)`), never accumulated; the stop is `pause()`, independent of volume; the probe reads back after the first ramp write and stands the fade down silently when the value did not take; restores stand at all three pinned points (after the timed stop · top of `startDesc` · Media Session `play`), and re-arming restores first so a lowered volume cannot strand. In Review's runs the SETTABLE branch ran both times (check 12: volume 0.73 at 11 s remaining against fadeBase 1, restored after the stop and again after the next `startDesc`; the stop fired on time). End-of-track mode carries no fade, as pinned.
8. **Phone check (§2.11 — background/locked honesty + the fade by ear + morning resume): PENDING JOHN'S CHECK** — the candidate and the check stand below. Review does not pass this criterion on agent evidence.

### Deviation ruling (§3's one named deviation)

- **Check 16 vs §2.12 — ACCEPTED.** §2.11 check 16 ("harness-v312 runs green") and §2.12 (the cache name changes to `ora-pro-nobis-v320-1`) conflict inside the same Plan; both cannot hold literally. §2.12 governs: the cache bump is the standing v312 E7 rule whose whole purpose is that a new client actually reaches John's installed app — shipping without it would strand the feature on his phone, the worse failure by far. harness-v312's single FAIL is exactly its check-11 literal pin on the superseded name (complete log, line 51); the other 58 checks pass on the v320 tree, and harness-v320's own check 1 asserts the new name green. This is the same class the v318 Review accepted (a pin superseded by the Plan's own instruction is not a regression). The stale pin in harness-v312.mjs is estate maintenance for a later pass, not a v320 defect; the file stands unedited, outside §2.9's list.

### Order sensitivity (§3's note, for v325)

- **CONFIRMED SOUND.** The timer build holds no queue-order assumption: the queue builders construct from payload order (as in v312), the deadline is a player state unbound to any track, and the end-of-track hold lands on whatever descriptor stands next in the live queue. Review's own harness check 8 (line 31) proves it against the current interleaved order — the descriptor after ep-short-a is the block's Intentions segment, and the hold lands on it, read from the live queue. When v325 lands the Intentions-first payload order, this build inherits it with no change.

### Review's own harness runs (disclosed in full)

- Run from a DETACHED GUARD worktree at the branch head f3aabd5 (never the shared tree), with the harness's app port moved to 8971 in the disposable guard copy only (the branch tree is untouched) after verifying nothing answered on 8971 — the sibling-port lesson from v318's Review, applied.
- **Run 1: 60 ok / 1 FAIL** — the single failure is check 4's label-decrease leg (`'Sleep · 5:00' -> 'Sleep · 5:00'`). Analysis: the label text updates on the 1-second tick; the check reads twice across a fixed 1.4 s window, and whether a tick lands inside the window after remaining crosses the 299 s ceil boundary is a phase coin-flip of the boot-aligned interval — the countdown itself is deadline-true (check 4's companion legs passed: state() agrees with the arm, label agrees with state() within tolerance; check 5's fire-at-expiry passed). A harness timing sensitivity, not a build defect.
- **Run 2: 61 ok / 0 FAIL** (exit 0), tally-identical to Implement's §3 run — committed as `app/tests/harness-v320-review.log`. The fade SETTABLE branch ran in both runs.

### The phone-check candidate (prepared by this pass)

- **What stands:** the branch build (release/v320 at f3aabd5, the exact tree Implement passed and Review re-ran) deployed as a SEPARATE review deployment — Worker `ora-pro-nobis-app-v320-review` (version d11602c0-83f1-4849-90b6-4d19b18ba0c4), its own D1 `ora-pro-nobis-app-v320-review`, its own R2 bucket `ora-pro-nobis-audio-v320-review`, behind its own Cloudflare Access application (fd97db64; Google sign-in, the production IdP, **John-only** allow policy for john@thibeaux.com + john.thibeaux@gmail.com, 24-hour session; the Muse service-token policy stands at precedence 2 for the door, as on production). Its own AGENT_TOKEN secret stands on the candidate only. **Production is untouched:** no production deploy, no production data read or written by this pass.
- **Fixture day stored:** 2026-11-08 (today), pushed through the candidate's own door and read back exact (storedDate 2026-11-08 · rowCount 5 · per-track 4 verified / 1 missing · all six Intentions segments held): `Review Fixture — Morning Prayer`, Morning, 8:00 · `Review Fixture — Missing Track`, Midmorning, 3:00, intentionally missing · `Review Fixture — Midday Prayer`, Midday, 6:00 · `Review Fixture — Vespers`, Evening, 8:00 · `Review Fixture — Extra Track`, unblocked group, 6:00 — plus all six Intentions segments (2:00 each). The seed data is the harness's synthetic set (35 items, 11 synthetic intentions); the fixture audio is synthetic tones, long enough on purpose so a 5-minute timer can be armed and its fade heard inside a track. An unauthenticated open was verified to land on the Access login (HTTP 302).
- **How John reaches it (exact steps):**
  1. On the Z Fold 8, open **https://ora-pro-nobis-app-v320-review.john-thibeaux.workers.dev/**
  2. Sign in with Google as John when Cloudflare Access asks.
  3. The app opens on the Prayers (Listen) tab on the stored fixture day — Sunday, November 8, 2026 — with **Play All** at the top and the **Sleep · Off** button beside it.
  4. Run the check below.
- **The check (John's verdict completes this gate):** (1) start Play All, tap **Sleep**, choose **5** — the button counts down · (2) in the last ~15 seconds before the stop, listen for the volume fading down gently (judged by ear — this is the fade item) · (3) at the stop, playback pauses on its own; press play — the same track resumes at the place where it stopped, the queue still standing (the morning-resume item in miniature) · (4) also try **End of track**: arm it during any track — when that track ends, the next track stands ready but does not start until tapped · (5) optionally: lock the phone or background the app while a timer runs — the stop should still land on time. His verdict is recorded on the v320 row (actor John) by the main seat and completes this section; a fail on any item returns the release to Implement with the named item.

### Why Review stands ACTIVE (not passed)

Criteria 1–7 are judged MET on first-hand agent evidence, the one §3 deviation is accepted, and the v325 order-sensitivity reading is confirmed. Criterion 8 — the §2.11 phone check — is **PENDING JOHN'S PHONE CHECK** by the release's own pinned rule; Review does not pass it on agent evidence. The Review phase record (1115) therefore stands ACTIVE with this section published; John's verdict on the candidate above completes the pass, and the Autonomous-to-Ship directive then carries the release through Ship without another word.

### Concerns and Information Needs

- **Facts:** both harness tallies were read from complete log files · the candidate's fixture push read back exact through its own door (stored-day + commit read-back above) · the candidate's unauthenticated root answers the Access login redirect · no production surface was deployed or written by this pass.
- **Assumptions:** John's phone check runs on the candidate surface prepared above, as with v312. The candidate is a separate origin from the installed production app, by design (production stays untouched until Ship). If the surface John actually uses day-to-day (the installed production PWA) behaves differently on background/locked timing, §2.7's named bound governs and any failure is fixed forward after Ship on his report.
- **Uncertainties:** the fade's feel (the 15 s ramp) and the locked/background stop timing on the Z Fold 8 — exactly what the phone check exists to learn. On iOS-class platforms the probe would stand the fade down silently; John's phone is Android, where element volume is settable (the harness's Chromium branch agrees), but the by-ear judgment is his.
- **Decision impact:** one judgment is reserved to John — the phone check, as a verdict. Nothing else in this section needs his input; no return to Implement stands on agent evidence.
- **First source to check:** `app/tests/harness-v320-review.log` (Review's 61/0 run) and this section's candidate read-backs.

### Amendment — 2026-11-09 (Ship pass, on John's verdict)

- **Phone check (criterion 8): PASSED BY JOHN'S VERDICT.** John checked the v320-review candidate on his phone and answered in the Ora Pro Nobis thread, 2026-11-08 20:30 CT: "Approved. Ship it." The verdict stands recorded on the v320 registry row (actor John, verdict pass, recorded 2026-11-09T02:31:13Z). Unlike v312, nothing here is waived: the phone criterion closes as passed on his word.
- With criterion 8 closed, criteria 1–7 stand MET per the verdicts above, the one §3 deviation stands accepted, and **Review record 1115 PASSES** on this amendment. The standing §4 text above is not rewritten; this amendment is appended only, per the phase rule.
- The Autonomous-to-Ship directive now carries the release through Ship without another word.

## 5 · Ship

- **Agent:** Ship Agent (v320) — Ship claim record 1119, claimed 2026-11-09 02:31:41 UTC; time contract 41 (all expectations judged below).
- **Verdict + Review pass:** John's verdict recorded on the v320 row (actor John, verdict pass, 2026-11-09T02:31:13Z — Ora thread, 2026-11-08 20:30 CT: "Approved. Ship it."). The §4 amendment naming the verdict stands as commit 5c187d6 on release/v320; **Review record 1115 PASSED** with that commit (finished 2026-11-09T02:31:28Z). Review's contract 37 closed — both expectations stood met on their evidence. Nothing in this release was waived: the phone criterion passed on John's word after his check on the v320-review candidate.
- **Merge:** release/v320 (5c187d6) merged into the trunk `muse-draft-week` (9347be4) with --no-ff — merge commit **ed78174**, clean, no conflicts. The stale local `main` (e72c1e3) was not touched.
- **Gates on the merged tree** (detached guard worktree at ed78174, never the shared tree; ports 8951 + 8921–8923 verified silent before the runs; complete logs committed as `app/tests/harness-v320-ship.log` + `app/tests/harness-v312-ship.log`):
  - **harness-v320: 61 ok / 0 FAIL** (exit 0) — tally-identical to Implement's and Review's runs.
  - **harness-v312: 58 ok / 1 FAIL** — the single FAIL is exactly check 11, the SW cache-name literal `ora-pro-nobis-v312-1`, superseded by §2.12's pinned rename to `ora-pro-nobis-v320-1` and ruled accepted at Review (§4). No other failure stands in the complete log.
- **Deploy:** production Worker `ora-pro-nobis-app` deployed from the merged tree via the connector-surrogate wrangler route, dry-run first (upload 251.55 KiB both runs) — **Worker version 92a258ef-ab2e-49ba-984b-22aa22696696**, deployment e2b77e22-ff5c-434d-8e72-4dea2bbcbd09 at 100% (verified by the deployments read-back; the prior deployment carried v312's 2586e412, which stands as the rollback). No migration, no job-sheet change, no store change.
- **Production proof (read-only):** the door's stored-day read-back on production answers 200 with the named empty shape (`storedDate: null`, 0 episodes — the pre-first-push state; the first push under v312's step 4B lands tonight, Mon 2026-11-09 00:00 CT) · the day payload through the door answers 200 · the merged tree's served-client sources carry the release (ui.ts SW cache name `ora-pro-nobis-v320-1`; client.ts carries the `Sleep · …` control and the `__opnSleep` seam). The static shell routes answer only John's session by design (the door cannot read /app.js in production — the same posture as v312's Ship); the deployed bundle is the merged tree's, and harness-v320 booted this exact client green.
- **Payload order note:** the production payload still stands pre-v325 — in a block with episodes, the Intentions card stands second. v325 is Review-passed and lands last, after v318's app half; the order fix is not this ship's defect and no order behavior was touched here.
- **Flip (all four pieces, read back):** What's New **39** · shipped record **399** (shipped_at 2026-11-09T02:36:21Z) · release row 580 **Live** (derivedStatus Live, shipped_at + whats_new_id 39 verified on read-back; John's verdict stands on the row) · Ship record 1119 passed with this section's commit. Contract 41: all three expectations met, contract closed.
- **Review candidate:** the `ora-pro-nobis-app-v320-review` deployment (Worker d11602c0, its own D1/R2/Access) is LEFT STANDING for later teardown, as briefed; it holds only the synthetic fixture day.
- **Deviation (one, named):** the first shipped-record POST returned 500 — the insert requires `title`, which the first body omitted; the write failed whole (no partial record), and the retry with the full shape returned 201 as shipped record 399, verified on read-back. No other deviation.

### Concerns and Information Needs

- **Facts:** all tallies read from complete log files · the flip pieces each read back from the app after their writes · the deployment read-back shows 92a258ef at 100% · production data untouched by this ship (no migration, no push, no store write).
- **Assumptions:** John's installed app picks up the new client on its next open (the v320-1 cache name + the v304 update check); the sleep timer's first real night is tonight's stored day, pushed at 00:00 CT.
- **Uncertainties:** background/locked stop timing on the installed production PWA (as distinct from the review candidate) — §2.7's named bound governs; any failure is fixed forward on John's report.
- **Decision impact:** none outstanding. v325's first landing precondition (v320 Live) now stands met; its second (v318's app half landed) still stands.
- **First source to check:** `app/tests/harness-v320-ship.log` (61/0 on the merged tree) and this section's flip read-backs.
