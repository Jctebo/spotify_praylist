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
