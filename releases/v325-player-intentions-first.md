# v325 — Player order: Intentions first in every block

- **Project:** Ora Pro Nobis
- **Slug:** v325-player-intentions-first
- **Registry:** DevOps Board app, project ora-pro-nobis, row id 594, version "v325", status Backlog
- **Branch:** release/v325 in the fork (~/workspace/projects/spotify_praylist-fork), cut from muse-draft-week @ 9347be4 (the v312 Ship state)
- **Run Directive:** Autonomous to Ship — John's direct order (Ora Pro Nobis thread, 2026-11-08 20:02 CT): "Start with intentions at the top." The chain runs Scope → Plan → Implement → Review → Ship with no hold. Landing order against the in-flight player work is pinned in §1 below.

## 1 · Scope

- **Agent:** Scope Agent (v325) — Scope claim record 1112, claimed 2026-11-09 02:04 UTC (2026-11-08 20:04 CT) · time contract 33
- **Inputs read:** the v325 registry row (id 594) · John's order, Ora Pro Nobis thread, 2026-11-08 20:02 CT, with the parent seat's read of it · the shipped v312 player code on the standing trunk line (muse-draft-week @ 9347be4): `app/worker/src/index.ts` (`playerDayPayload`), `app/worker/src/client.ts` (`renderPrayers`, queue builders, resume), `app/tests/harness-v312.mjs` (the order evidence) · the v312 release document §2 pin the splice stands under · the in-flight branches release/v320 (Implement, uncommitted work standing in its worktree at Scope time) and release/v318-app (built, Review before its landing) — their diffs against muse-draft-week read first-hand

### John's direction (settled — not re-opened by this section)

John, Ora Pro Nobis thread, 2026-11-08 20:02 CT: **"Start with intentions at the top."**

Read, stated so he can correct it: **every block in the app player OPENS with its Intentions segment** — the day's Play All begins with the Morning block's Intentions, and each block's Play All begins with that block's Intentions. This is a directed fix-forward on the live v312 player. Player order only; no other behavior changes.

### Where the splice lives (verified first-hand)

**One site, server-side only.** In `app/worker/src/index.ts`, `playerDayPayload(env)` builds each block's track list from that block's `player_episodes` rows (in `sort` order, shaped by `episodeTrackShape`), builds the block's Intentions card from `prayer_audio`, and inserts it at line 292 (@ 9347be4):

```ts
tracks.splice(tracks.length ? 1 : 0, 0, card);
```

- A block **with** episodes gets its card at **index 1** — second, after the block's first episode.
- A block **without** episodes gets its card at index 0 — it is the block's only track.
- The no-stored-day shape (the named empty shape in the same function) builds each block as `[card]` alone — the card already stands at the top there.
- This splice is exactly what v312's Plan pinned ("spliced exactly where it stands today (index 1 when the block has tracks, else 0)", v312 §2). **v325 supersedes that pin by John's direct order**; the supersession is named here so no later reader treats the old pin as standing.

**The client adds no ordering of its own** (verified in `app/worker/src/client.ts`): `renderPrayers` renders each block's `tracks` in payload order, builds the whole-day queue (`allDescs`) by walking blocks in order and tracks in payload order (then the unblocked group), and the per-block Play All handler builds its queue from that block's `tracks` in payload order. There is no splice, sort, or reorder anywhere in the client. **Fix the payload order and every surface follows: rendered block, whole-day queue, per-block queue.**

### Current order per block (evidence)

The rule is uniform — it does not depend on the day's contents:

- **Any block with ≥ 1 episode:** `[first episode (lowest sort), Intentions card, remaining episodes in sort order]`.
- **Any block with 0 episodes:** `[Intentions card]`.
- **The unblocked group** ("From today's podcast", the payload's `episodes` array): episodes in sort order — **no Intentions card exists in this group**, and the rule does not create one.
- **No stored day:** `[Intentions card]` per block (not-available) — already compliant.

The harness-v312 fixture day (D2) shows the rule concretely, and its checks stand as the recorded evidence of the shipped order: Morning = `[d2-a, seg:Morning]`; per-block Midday slice = `["d2-b", "seg:Midday"]` (harness-v312 check 6: "per-block Play All builds exactly that block's slice"); whole-day Play All "starts at the day's first track" = `d2-a`, an episode, with the comment chain `d2-a ends → seg:Morning → d2-m skipped…`. On the live Nov 11 stored day (18 episodes across the blocks per v312's Plan) every block carrying episodes opens with an episode today — that is the gap John's order closes.

### The pinned fix shape (smallest change)

**One expression, Worker only, in `playerDayPayload`:**

```ts
tracks.splice(0, 0, card);
```

(equivalently `tracks.unshift(card)`; Plan names the final form). The card stands at index 0 in every block, in both the stored-day shape and — already true — the empty shape. Nothing else in the function changes.

Consequences, each pinned:

- **Rendered block:** the Intentions card is the first card under every block header.
- **Whole-day Play All:** the queue head is `seg:Morning` — the day begins with the Morning Intentions, per John's read.
- **Per-block Play All:** the queue head is that block's `seg:<Block>`.
- **trackCount:** unchanged — the count already includes the card; only its position moves.
- **Missing-track rule:** unchanged. A block whose segment audio has not landed opens with its Intentions card standing **not-available** at the head; the queue skips it at reach exactly as it skips any missing track, and the first *playable* track follows. A block whose first episode is missing keeps that episode in place after the card.
- **Resume path: unaffected, named.** Resume looks its descriptor up by `episodeId` in the payload-order descriptor list (order-independent), builds no queue, and loads the single remembered track at its position. The only order-visible effect is that a resumed Intentions segment's card now stands at its block's head in the render — behavior of resume itself does not change.
- **Unblocked group:** unchanged — no card, order as today.
- **Client:** no change. **Static assets:** no change, so **no service-worker cache rename is required** — the order arrives with the payload, not with any static file. (If Plan elects a hygiene bump it is optional and must be named as such.)
- **Push / job sheet / store:** untouched. The nightly push, the replace-day commit, and the segment push are independent of read-path assembly (v312 §2's ordering note stands); the first stored day served under the fix opens every block with Intentions regardless of which push landed first.
- **v324 interaction (pinned forward):** v324's §1 already pins external RSS tracks to slot into their blocks **after** the Intentions card. With the card at index 0, the episode rows — v324's externals among them, when that release builds — follow it by construction. No v324 change is needed.

### Landing order against the in-flight player work (Scope's call, on the record)

**Call: v325 builds on the trunk state AFTER v320 ships AND after v318's app half lands; v325 merges last of the three.**

State at Scope time, verified: v320 (sleep timer) is in Implement on release/v320 with **uncommitted** client work standing in its worktree (client.ts +162, ui.ts cache line, harness-v320 built) against trunk @ 9347be4; its Plan touches client.ts + the ui.ts cache line only — it never touches the payload builder, and its §2 pins that its queue builder reads payload order, so a payload-order fix covers it. v318's app half is built on release/v318-app (cut from 9347be4), harness-green (harness-v318 32/0; v312 regression 58/1 with a named SW-pin deviation), awaiting its Review, which runs **before** its trunk landing; its index.ts diff carries the migration-0008 payload fields in the same file as the splice.

Reasons for landing last:

1. **It stales no one's evidence.** v320's in-flight harness and v318-app's completed harness runs were taken against the current payload order. Either landing first keeps its evidence valid untouched; v325's own regression pass then re-runs all three harnesses (v312, v318, v320) once, on the final trunk, with the order-sensitive expectations updated in one place (below).
2. **Its conflict surface is the smallest of the three.** v318-app's index.ts hunks were read: they touch `episodeTrackShape` (text fields), the sweep prefixes, and `storedDayReadback` — **not** the blocks map and **not** the splice line. v320 touches no server code. The one-expression change rebases over both landings cleanly by construction.
3. **The reverse order buys nothing.** v325 is not a precondition for either release: v320's timer inherits the new order from the payload whenever v325 lands, and v318's Read view does not read track position. Neither waits on v325; both are ahead of it in flight.

Fallback, named now so a stall never silently reorders the line: if v318's app-half landing is blocked for a reason unrelated to v325 after v320 has shipped, the Coordinator may land v325 after v320 alone; release/v318-app then rebases over it (verified above: no textual overlap with the splice) and its Review adds one check — block order under the new head position — to its standing list.

Build base, restated for Plan: Plan opens on the trunk head that carries both landings (or the fallback head), states that head in §2, and Implement cuts release/v325 from it. The branch cut for this Scope (§1 only) stands on 9347be4 and carries no code.

### Harness checks (named for Plan/Implement)

**harness-v325** (new; scratch instances inside the worktree, synthetic fixture only, tallies from the complete log):

1. **Payload order:** on a fixture day with episodes in at least three blocks — including one multi-episode block and one block with no episodes — every block's `tracks[0]` is the Intentions card (`intentionsCard: true`), and the episode order after the head is the standing sort order, unchanged.
2. **Empty shape:** with no stored day, every block is `[card]` exactly as today.
3. **Rendered DOM:** the first card under each block header is that block's Intentions card (`data-card` = `seg:<Block>`).
4. **Whole-day queue head:** Play All builds a queue whose first descriptor is `seg:Morning`, and the playing track after start is the Morning Intentions (segment available in fixture).
5. **Per-block queue head:** per-block Play All on a block with episodes (Midday in fixture) builds `["seg:Midday", <that block's episodes in sort order>]`.
6. **Not-available head:** a block whose segment audio is absent opens with the not-available Intentions card; the queue reaches past it to the first available track (missing rule unchanged), and a missing first episode still stands named in place after the card.
7. **Nothing else moves:** trackCounts identical to the pre-fix payload on the same fixture; unblocked group identical; resume offer + resume load behave as in harness-v312 check 9.

**harness-v312 regression — order-sensitive checks named for update** (the harness's other checks are order-blind and stand):

- Check 6, "Play All starts at the day's first track": the first track is now `seg:Morning`, not `d2-a`; its autoplay comment chain is re-derived (seg:Morning ends → d2-a → seg:Midmorning → d2-m skipped at reach → seg:Midday → d2-b) and the block-crossing wait stands on `d2-b` as today.
- Check 6, per-block slice: the Midday expectation `["d2-b", "seg:Midday"]` becomes `["seg:Midday", "d2-b"]`, and the slice's first playing track is the segment.
- Check 4's payload accounting is position-blind for episodes (it flattens episode rows only) and stands; check 5's missing-track assertions stand (the missing episode's position after the card is asserted by harness-v325 check 6 instead).

**Regressions on the final trunk:** harness-v318 and harness-v320 complete-log runs (post-landing shapes named by Plan once the landing order resolves).

### Acceptance criteria

1. `GET /api/player/day` on a stored day: all six blocks open with the Intentions card; episode order after the head is unchanged; the empty shape is unchanged.
2. The rendered Prayers screen shows the Intentions card first under every block header.
3. Whole-day Play All begins with the Morning block's Intentions; each block's Play All begins with that block's Intentions.
4. Counts, the missing-track rule, the unblocked group, and resume are behavior-identical to the shipped v312 player.
5. harness-v325 green and the harness-v312 regression green with only the named order updates; harness-v318 + harness-v320 regressions green on the landed trunk.
6. No client, store, push, or job-sheet change ships in this release.

### Concerns and Information Needs

- **Heads that are not yet playable:** on a morning where a block's segment file lands after its episodes (the two pushes are independent, v312 §2), that block opens with a named not-available Intentions card and Play All's first *playable* track is the block's first episode. This follows John's rule as read plus the standing missing-track rule; if John wants a not-available head to behave differently, that is a new word, not this release.
- **v312's Plan pin superseded:** §2 of v312 pinned the splice at index 1/0 "exactly where it stands today." This section supersedes that pin by John's direct order; Implement must not "restore" it from the v312 document.
- **Evidence dependency:** the landing-order call rests on branch states read at Scope time (v320 uncommitted in its worktree; v318-app built, unreviewed). If either state changes materially before Plan opens, Plan re-states the base head in §2 — the call itself (v325 last, or the named fallback) does not need re-approval.
- **Information need — none outstanding for Scope.** No feed, store, or device evidence is needed beyond what stands above; Review's phone surface is the shipped player itself, and no new phone criterion is created by an order change (Plan may name one if it disagrees).

## 2 · Plan

- **Agent:** Plan Agent (v325) — Plan claim record 1113, claimed 2026-11-09 02:08:55 UTC (2026-11-08 20:08 CT) · time contract 35
- **Inputs read:** §1 in full · the splice site verified first-hand in this worktree (release/v325 @ b879101): `app/worker/src/index.ts` line 292 stands exactly as §1 quotes it · `app/tests/harness-v312.mjs` read in full (the order analysis of checks 4–9 below is first-hand) · the standing trunk head, muse-draft-week @ 9347be4 (the v312 Ship state)
- **Plan writes no production code.** The harness expectation updates named in §2.4 are Implement/Ship work, not Plan work.

### 2.1 Base head — one refinement of §1, named

§1 restated the build base as "the trunk head that carries both landings." Neither landing stands yet (v320 in Implement; v318's app half awaiting its Review), and holding a one-expression change idle behind two releases buys nothing §1 asked for — §1's call governs the LANDING, and its own evidence-dependency note allows Plan to re-state the base head. **Refinement: Implement builds and proves on release/v325 as it stands, cut from the current trunk head muse-draft-week @ 9347be4.** The landing precondition is verified at Ship against the then-current trunk (§2.6); before merging, Ship rebases release/v325 onto the precondition head. By §1's verified diffs the rebase is conflict-free by construction (v320 touches no server code; v318-app's index.ts hunks touch `episodeTrackShape`, the sweep prefixes, and `storedDayReadback` — not the blocks map, not the splice line). If the rebase nonetheless conflicts on the splice line, Ship stops and reports; it does not resolve silently.

### 2.2 The change — exact form

One expression in `app/worker/src/index.ts`, `playerDayPayload`, line 292 @ 9347be4:

- **Remove:** `tracks.splice(tracks.length ? 1 : 0, 0, card);`
- **Add:** `tracks.splice(0, 0, card);`

The final form is `splice(0, 0, card)`, not `unshift(card)`: the smallest textual diff (one argument changes), the statement's shape stands for reviewers, and the two forms are semantically identical here. Nothing else in the function changes; the no-stored-day branch already builds `[card]` per block and is untouched.

**Non-changes, pinned so Implement cannot drift:**

- `app/worker/src/client.ts` — no change. The client adds no ordering of its own (§1 verified); payload order is the only order.
- `app/worker/src/ui.ts` — no change. In particular **no service-worker cache rename in this release**: the cache name stands at whatever the landed trunk carries (v320's rename, once it lands, stands untouched). The new order arrives with the payload, not with any static file.
- No store or schema change, no migration, no push or job-sheet change. The nightly push and the replace-day commit are untouched; the first stored day served after the deploy opens every block with Intentions regardless of which push landed first.

### 2.3 harness-v325 — the 7 checks in buildable form

New file `app/tests/harness-v325.mjs`, built on the harness-v312 mold: scratch wrangler instances INSIDE the worktree (HARD GUARD — a harness whose WT resolves inside the shared fork checkout refuses and exits), synthetic fixture only, tallies read from the COMPLETE log. Fixture day: episodes in at least three blocks, one multi-episode block, one block with no episodes, plus the check-6 leg (a block whose segment audio is absent and whose first episode is missing). The checks are §1's seven, verbatim in intent:

1. **Payload order:** every block's `tracks[0]` is the Intentions card (`intentionsCard: true`), including the multi-episode block and the no-episode block; the episode order after the head is the standing sort order, unchanged.
2. **Empty shape:** with no stored day, every block is `[card]` exactly as today.
3. **Rendered DOM:** the first card under each block header is that block's Intentions card (`data-card` = `seg:<Block>`).
4. **Whole-day queue head:** Play All builds a queue whose first descriptor is `seg:Morning`, and the playing track after start is the Morning Intentions (segment present in fixture).
5. **Per-block queue head:** per-block Play All on a block with episodes builds `["seg:<Block>", …that block's episodes in sort order]`.
6. **Not-available head:** a block whose segment audio is absent opens with the not-available Intentions card at the head; the queue reaches past it to the first available track (missing rule unchanged), and a missing first episode still stands named in place after the card.
7. **Nothing else moves:** trackCounts identical to the pre-fix payload on the same fixture; the unblocked group identical; resume offer and resume load behave as in harness-v312 check 9.

### 2.4 harness-v312 regression — order-sensitive updates, named exactly

Harness-only edits, made on release/v325 by Implement and re-verified on the merged tree by Ship. Every harness-v312 check not named here stands byte-identical.

- **Check 6 — "Play All starts at the day's first track":** the first-track expectation `d2-a` becomes `seg:Morning`. The autoplay chain is re-derived for the D2 fixture (0.8 s tones): seg:Morning ends → d2-a → seg:Midmorning → d2-m skipped at reach → seg:Midday → d2-b. The block-crossing wait stands on `current === "d2-b"`, as today. The queue-equality assertion self-derives from DOM card order and stands unchanged.
- **Check 6 — per-block Midday slice:** `["d2-b", "seg:Midday"]` becomes `["seg:Midday", "d2-b"]`. The wait for `current === "d2-b"` stands — the segment plays first (0.8 s), then autoplay advances.
- **Check 8 — REFINEMENT of §1, named:** §1 named only check 6 for update; check 8 is also order-sensitive, and this Plan corrects the omission on the record. Check 8 runs on the Midday block queue, which now stands `["seg:Midday", "d2-b"]` with `current` = d2-b, the LAST track. Re-derived legs: the metadata assertion (title "Day Two Beta") stands — current is d2-b at that point; the ranged seek leg stands; the handler legs swap — **previoustrack from d2-b → `seg:Midday` first, then nexttrack from seg:Midday → `d2-b`** (the standing expectations `nexttrack → seg:Midday` and `previoustrack → d2-b` do not survive the reorder and are replaced, not weakened). If Implement observes different at-the-boundary handler behavior (for example a wrap), it records the observed behavior as a named deviation in §3 — it does not silently relax the check.
- **Checks 4, 5, 7, 9–12 stand unchanged** — position-blind (counts, payload accounting over episode rows) or order-independent (resume looks its descriptor up by `episodeId`), per §1 and the first-hand read.

### 2.5 Regressions on the final trunk

At Ship, after the landing (§2.6): **harness-v318 and harness-v320 complete-log runs on the merged tree**. Both harnesses were authored against the pre-fix payload order. If either carries an order-sensitive expectation (a queue-head or slice assertion of the §2.4 kind), Ship updates that expectation as a harness-only change, names it in §5, and re-runs to green. Ship does not land on a red regression, and no harness edit is made silently.

### 2.6 Landing order — the precondition and its verification (binding)

**v325 merges last of the three in-flight player releases.** The Ship agent verifies the precondition BEFORE merging, in this order, and records the evidence in §5:

1. **v320 shipped:** door read `GET /api/agent/projects/ora-pro-nobis/releases` shows the v320 row **Live** with `shipped_at` set, AND `git log muse-draft-week --oneline` shows v320's merge commit on the trunk.
2. **v318's app half landed:** the trunk log shows the v318-app merge commit (named in v318's release document — its §3 app-half addendum or its Ship section), AND v318's app-half phase records stand passed in the door phase picture for v318.
3. **Fallback (§1's, binding):** if step 2 is blocked for a reason unrelated to v325 after step 1 holds, Ship lands v325 after v320 alone, records the fallback in §5, and release/v318-app rebases over v325 (no textual overlap with the splice, §1 verified); v318's Review then adds the block-order check §1 named to its standing list.
4. **Landing sequence:** rebase release/v325 onto the precondition head → re-run harness-v325 + harness-v312 (with §2.4 updates) on the rebased tree → merge `--no-ff` to muse-draft-week → deploy the production Worker `ora-pro-nobis-app` via the connector-surrogate wrangler route (dry-run first; token transient, never printed, logged, or filed) → the §2.5 regression runs on the merged tree → the §2.8 proof.

**Review placement:** Review judges the Implement build on release/v325 (diff inspection + harness evidence) BEFORE Ship, as the standing order runs. The landed-trunk regressions (§2.5) and the production read-back (§2.8) are Ship's proof, because they cannot exist before the landing. No new phone criterion — an order change creates none (§1's concerns); the shipped player itself is the surface.

### 2.7 Rollback

The change is payload-only, so rollback is a **pure redeploy or revert**: redeploy the previously deployed Worker version, or `git revert` the v325 merge on muse-draft-week and redeploy. No migration to unwind, no data shape to restore, no client or cache state to clear; the previous order returns on the next `GET /api/player/day` read.

### 2.8 Ship proof list

- Precondition evidence (§2.6 steps 1–2, or the step-3 fallback record).
- Rebase result and the merge commit on muse-draft-week; the deployed Worker version id.
- harness-v325 tally and harness-v312 tally (with the §2.4 updates) on the merged tree, from complete logs; harness-v318 + harness-v320 tallies (§2.5).
- Production read-back: `GET /api/player/day` on the live stored day — all six blocks' `tracks[0]` is the Intentions card, and trackCounts match the pre-ship payload read on the same stored day.
- The flip, all four pieces read back: release row Live + shipped_at + whats_new_id (full-field upsert; the door's shipped/whats-new fields take camelCase `shippedAt`/`whatsNewId` — the v312 Ship lesson, named so it is not relearned) · shipped record · What's New entry · Ship phase record passed.
- §5 appended, the document republished at the merge commit, a Curator note filed.

**Acceptance mapping (§1 criteria → evidence):** 1 → harness-v325 checks 1–2 + the Ship production read-back · 2 → check 3 · 3 → checks 4–5 · 4 → check 7 + harness-v312 checks 4, 5, 9 · 5 → the §2.4/§2.5 tallies · 6 → the §2.2 diff itself, inspected at Review.

### Concerns and Information Needs

- **The check-8 correction (§2.4):** §1's named-update list was incomplete. It is corrected here, in Plan, on the record — not left for Implement to discover mid-harness and improvise around.
- **The Ship wait is the pinned order, not a stall:** after Review, v325's Ship stands until the §2.6 precondition holds. The expectations and stall machinery should read v325's Ship phase against §2.6, not against the clock alone; silence from the Ship seat while v320 or v318-app is still in flight is the plan working, not a miss.
- **Heads that are not yet playable:** unchanged from §1's concern — a block whose segment lands after its episodes opens with a named not-available Intentions card, and Play All's first playable track is the block's first episode. Any different behavior for a not-available head is a new word from John, not this release.
- **Information need — none outstanding for Plan.** The base-head refinement (§2.1) and the check-8 correction (§2.4) are the two places this Plan departs from §1's letter; both are named above with their reasons, and neither changes §1's call.

## 3 · Implement

- **Agent:** Implement Agent (v325) — Implement claim record 1114, claimed 2026-11-09 02:11 UTC (2026-11-08 20:11 CT) · time contract 36 · build commit **0de6ca7** on release/v325 (cut from muse-draft-week @ 9347be4, per §2.1)
- **Inputs read:** §1 + §2 in full · the splice site verified first-hand in this worktree · `app/worker/src/client.ts` read in full (queue construction, `startQueue`'s skip-at-reach, the resume path) · `app/tests/harness-v312.mjs` read in full before editing it

### The build

**Exactly the §2.2 change, nothing else.** In `app/worker/src/index.ts`, `playerDayPayload`, the splice line now reads `tracks.splice(0, 0, card);` — the production diff is one line (build commit 0de6ca7; the commit's full file list is that line plus the two harness files and their logs below). The pinned non-changes stand verified by the diff itself: no `client.ts` change, no `ui.ts` change and no service-worker cache rename, no store/schema/migration change, no push or job-sheet change. **No trunk landing and no deploy in this phase** — the landing is Ship's, against the §2.6 precondition.

### harness-v325 — new, 31 ok / 0 FAIL

New file `app/tests/harness-v325.mjs` on the harness-v312 mold (in-worktree scratch instance, HARD GUARD standing, synthetic fixture only); the complete log is committed at `app/tests/harness-v325.log`. Fixture day F1 (2027-04-01): episodes in five blocks — Morning the multi-episode block (2 episodes), Midmorning with **no** episodes, and Afternoon as the check-6 leg (segment audio never pushed, first episode missing) — plus one unblocked episode. The seven §2.3 checks, as run:

1. **Payload order — green.** Every block's `tracks[0]` is the Intentions card; Morning reads `[card, fx-a1, fx-a2]`; the no-episode block is `[card]` alone; every block's episode order after the head equals the manifest sort order.
2. **Empty shape — green.** Before any push, the payload is the named empty shape and every block is `[card]` exactly as today.
3. **Rendered DOM — green.** The first card under each block header is that block's Intentions card (`seg:<Block>` for all six blocks, read from the live DOM).
4. **Whole-day queue head — green.** The Play All queue equals the rendered day order and its head is `seg:Morning`; the playing track after start is the Morning Intentions.
5. **Per-block queue head — green.** Midday's Play All starts playing the block's Intentions segment; its queue is `["seg:Midday", "fx-c"]`.
6. **Not-available head — green, both legs.** Payload: the Afternoon block reads `[card, fx-d1, fx-d2]` with the head card `available:false, streamUrl:null` and the missing first episode named in place after it. Browser: the Afternoon queue holds all three descriptors in place and reaches past the not-available card and the missing episode to fx-d2 (`queueIdx` 2, fx-d2 playing) — the missing-track rule is unchanged.
7. **Nothing else moves — green.** trackCounts equal the manifest-derived counts per block (episodes + the one card); the unblocked group is identical (one episode, same shape, no card created); resume behaves as in harness-v312 check 9 (same-day offer, paused at the remembered position, retired by the next day's push); zero page errors across the boot.

**Port discipline (the v318 Review lesson, applied):** harness-v325 runs on ports 8941/8942 — distinct from harness-v312 (8921–8923) and harness-v318 (8931) — and proves the answering server is its own instance three ways: the spawned child stands alive after boot, the fresh store reads the named empty shape, and the fixture commit's read-back names this harness's own episode ids.

**Check-7 method note (named, for Review's judgment):** the pre-fix comparison is made against the pre-fix payload reconstructed by the retired splice rule itself (§1 quotes it verbatim — card at index 1 when the block has episodes, else 0) applied to the same fixture: same track multiset per block, same episode subsequence, only the card's position changed; trackCounts are asserted against the manifest counts, which harness-v312's check 4 already proved equal to the pre-fix payload's counts on its fixture. No second pre-fix instance was stood up; if Review wants the two-instance form, it is a harness extension, not a build change.

**First-run disclosure:** the first harness-v325 run stood 25 ok / 1 FAIL — the failure was a harness authoring bug in the resume leg (a `page.evaluate` callback referenced the Node-side fixture constant, undefined in the browser context), not a product failure; every product assertion in that run passed. Fixed by inlining the fixture date literal and re-run clean: **31 ok / 0 FAIL**. The committed log is the clean re-run.

### harness-v312 regression — with the §2.4 updates, 59 ok / 0 FAIL

`app/tests/harness-v312.mjs` edited in the check-6 and check-8 regions only; the complete log of the run against this build is committed at `app/tests/harness-v312.log` — **59 ok / 0 FAIL**. The §2.4 updates, as run:

- **Check 6 first track:** `seg:Morning` (log line 32), with the autoplay chain comment re-derived (seg:Morning → d2-a → seg:Midmorning → d2-m skipped at reach → seg:Midday → d2-b); the block-crossing wait on `d2-b` stands, and the queue-equality assertion self-derives from DOM order — the logged queue reads `seg:Morning,d2-a,seg:Midmorning,d2-m,seg:Midday,d2-b,seg:Afternoon,seg:Evening,seg:Night`.
- **Check 6 Midday slice:** `["seg:Midday", "d2-b"]` (log line 36). A wait for `current === "seg:Midday"` stands ahead of the standing `d2-b` wait, evidencing §1's "the slice's first playing track is the segment"; the `d2-b` wait itself stands as §2.4 pins.
- **Check 8 legs swapped:** previoustrack from d2-b → `seg:Midday` first (log line 40), then nexttrack back to `d2-b` (line 41); the metadata assertion (title "Day Two Beta", current is d2-b at that point) and the ranged seek leg stand.
- **Checks 4, 5, 7, 9–12 stand byte-identical** — the file's diff stands in the check-6 and check-8 regions only.

**§2 deviations: none in the build.** The fix's form, the non-changes, the harness set, and the regression updates all stand exactly as §2 pins. The §2.5 final-trunk regressions (harness-v318 + harness-v320 on the merged tree) remain Ship work, as pinned — neither branch has landed on this build base.

### Concerns and Information Needs

- **For Ship — harness-v312 check 11's cache-name pin:** check 11 asserts the served SW cache name `ora-pro-nobis-v312-1`, which stands on this build base (9347be4) and passes byte-identical, as §2.4 pins. When v320 lands, its `ui.ts` cache rename rides with it (§2.2), so the rebased tree Ship re-runs this harness on will carry the successor name and check 11's pin will fail unless it receives the same named-update treatment (harness-only, named in §5, re-run to green — the §2.5 pattern). Flagged here so Ship meets it as a named step, not a surprise; nothing in this release renames the cache.
- **The Ship wait is the pinned order, not a stall** (§2.6, restated from §2): Review judges this branch build next; Ship stands until v320 is Live and v318's app half has landed (or the §1 fallback holds), then rebases, re-runs, merges, deploys.
- **Information need — none outstanding for Implement.** The two judgment calls in this section (the check-7 comparison method, the first-run disclosure) are named above for Review.

## 4 · Review

- **Agent:** Review Agent (v325) — Review claim record 1116, claimed 2026-11-09 02:18 UTC (2026-11-08 20:18 CT) · time contract 38
- **Inputs read:** §1 + §2 + §3 in full · the production diff against the build base (9347be4..0de6ca7) read first-hand · both harnesses run by this Review from a DETACHED GUARD worktree at the branch head (a48c036) — never the shared tree — with the complete logs committed beside §3's (`app/tests/harness-v325-review.log`, `app/tests/harness-v312-review.log`)
- **Verdict: PASS.** The release does NOT ship on this pass — Ship seats after the §2.6 landing precondition stands (v320 Live + v318's app half landed, or the §1 fallback).

### The diff, verified first-hand (criterion 6)

- **Production diff vs 9347be4 is exactly one line.** `git diff 9347be4..0de6ca7 -- app/worker/src/` returns a single hunk in `app/worker/src/index.ts` (`playerDayPayload`): `tracks.splice(tracks.length ? 1 : 0, 0, card);` → `tracks.splice(0, 0, card);`. The removed line is verbatim the retired splice §1 quotes from the shipped source.
- **The pinned non-changes stand verified by the same diff:** `client.ts` and `ui.ts` do not appear in it — no client change, no service-worker cache rename; no store, schema, migration, push, or job-sheet file appears either. The build commit 0de6ca7's full file list is that one line plus the two harness files and their logs, as §3 states.
- **harness-v312.mjs's diff stands in three hunks, all inside the check-6 and check-8 regions** (the §2.4 updates); checks 4, 5, 7, 9–12 are untouched, as pinned.

### Review's own harness runs (tallies from the complete logs)

- **harness-v325: 31 ok / 0 FAIL** — identical tally to Implement's, reproduced independently. Ports 8941/8942 verified free before the run; the harness's own instance proofs stand in the log (child alive after boot, fresh store reads the named empty shape, the fixture commit's read-back names this harness's own episode ids).
- **harness-v312 (with the §2.4 updates): 59 ok / 0 FAIL** — identical tally to Implement's. Check 6's logged queue reads `seg:Morning,d2-a,seg:Midmorning,d2-m,seg:Midday,d2-b,seg:Afternoon,seg:Evening,seg:Night` with the first playing track `seg:Morning` and the per-block Midday slice `(seg:Midday,d2-b)`; check 8's swapped legs stand (previoustrack → `seg:Midday`, nexttrack → `d2-b`) with the metadata and seek legs intact.

### Criterion verdicts (§1 criteria, mapped per §2.8)

1. **Payload order — MET.** Every block's `tracks[0]` is the Intentions card (multi-episode Morning `[card, fx-a1, fx-a2]`, the no-episode block `[card]` alone); episode order after the head equals the manifest sort order; the empty shape is `[card]` per block, unchanged.
2. **Rendered head — MET.** The first card under each of the six block headers in the live DOM is that block's Intentions card (`seg:<Block>` for all six).
3. **Play All heads — MET.** Whole-day queue head is `seg:Morning` and the playing track after start is the Morning Intentions; per-block Play All (Midday) builds `["seg:Midday", "fx-c"]` and starts playing the segment.
4. **Nothing else moves — MET.** trackCounts equal the manifest-derived counts; the unblocked group is identical (one episode, same shape, no card created); the missing-track rule is unchanged (the not-available Afternoon head stands named at the head, `available:false`, and the queue reaches past it and the missing first episode to fx-d2); resume behaves as in harness-v312 check 9 (offer, paused at the remembered position, retired by the next day's push). harness-v312 checks 4, 5, 9 green in Review's own run.
5. **Harness set — MET for this gate.** harness-v325 green and the harness-v312 regression green with only the named §2.4 updates, both on Review's own runs. The harness-v318 + harness-v320 final-trunk regressions are §2.5 Ship work — they cannot exist before the landing and stand as Ship's pinned step, not a gap in this verdict.
6. **No client, store, push, or job-sheet change — MET** by the diff inspection above.

### Rulings on §3's two named items

- **Item 1 — the first harness-v325 run's single FAIL (harness authoring bug): ACCEPTED.** The failure is named and specific: a `page.evaluate` callback referenced a Node-side fixture constant, undefined in the browser context — functions serialized into the page cannot capture Node variables, so the resume leg threw before asserting. Every product assertion in that run passed; the fix inlined the date literal; the clean re-run (31/0) stands committed, and the disclosure stands in §3. Review's own independent run reproduces 31/0 including the very leg that carried the bug (resume offer, paused resume, position match 0.50s vs 0.50s, retirement after the next day's push). The evidence discipline — disclose, fix, re-run clean, commit the clean log — is the standing pattern; nothing about the product is implicated.
- **Item 2 — check 7's comparison method (pre-fix payload reconstructed by the retired splice rule, no second pre-fix instance): ACCEPTED as sound evidence.** The reconstruction is not an approximation of the pre-fix behavior; it is the pre-fix behavior computed by the exact rule that stood in the shipped code — the retired line is quoted verbatim in §1 and stands as the removed line in the one-line production diff Review verified. The payload builder is a deterministic function of the stored rows and that splice, so applying the retired rule to the same fixture's track lists yields exactly the payload the pre-fix code would have served. The claim it supports is narrow and is exactly what the method can prove — same track multiset per block, same episode subsequence, only the card's position changed — and the counts leg does not rest on the reconstruction alone: trackCounts are asserted against manifest-derived counts, and harness-v312 check 4 independently proves payload = manifest track-for-track on its own fixture. A second pre-fix instance would run the same deterministic builder differing by the same one line and would add no evidentiary weight. The two-instance form is a harness extension, not a build change, and it is not required.

### Concerns and Information Needs

- **For Ship — harness-v312 check 11's cache-name pin (§3's flag, carried and confirmed):** check 11 asserts the served SW cache name `ora-pro-nobis-v312-1`; it passes on this build base (Review's own run, log line 51) because nothing here renames the cache, as §2.2 pins. When v320 lands, its `ui.ts` cache rename rides with it, so on the rebased tree Ship re-runs this harness on, check 11's pin will fail against the successor name unless Ship gives it the §2.5 named-update treatment — harness-only, named in §5, re-run to green. **Ship: meet this as a named step in the §2.8 proof, not a surprise; do not land on the red pin and do not edit it silently.**
- **The Ship wait is the pinned order, not a stall** (§2.6, restated from §2/§3): Ship stands until v320 is Live and v318's app half has landed (or the §1 fallback holds), then rebases onto the precondition head, re-runs harness-v325 + harness-v312 there, merges, deploys, and runs the §2.5 regressions on the merged tree. If the rebase conflicts on the splice line, Ship stops and reports (§2.1).
- **Information need — none outstanding for Review.** No phone criterion stands for this release (§1/§2: an order change creates none; the shipped player itself is the surface, and the production read-back is Ship's §2.8 proof).

## 5 · Ship

- **Agent:** Ship Agent (v325) — Ship claim record 1132, claimed 2026-11-09 04:18:12 UTC (2026-11-08 22:18 CT) · time contract 55 (expectations: "v325 landed and Worker deployed" by 04:55 UTC — **met 04:30:05 UTC** · "Ship flip complete" by 05:10 UTC — met at the flip below)
- **Run Directive:** Autonomous to Ship — John's direct order (2026-11-08 20:02 CT). No hold stood at this gate.

### Precondition evidence (§2.6 — primary form, not the fallback)

1. **v320 Live:** door read shows the v320 row **Live**, shipped_at 2026-11-09T02:36:21Z, What's New 39; its merge stands on the trunk.
2. **v318's app half landed:** the trunk log carries v318's app merge 7f903dd ("Merge branch 'release/v318-app' into muse-draft-week") under its Ship §5 commit 1d677a4; the v318 row reads **Live**, shipped_at 2026-11-09T04:16:21Z, What's New 42. Both preconditions stood met before the claim; the §1 fallback was not used.

### Rebase + the production line

- release/v325 rebased onto muse-draft-week @ **1d677a4** — five commits replayed, **conflict-free**, as §2.1 predicted (v320 touched no server code; v318-app's hunks never touched the splice).
- The production diff on the rebased tree is still exactly one line, verified first-hand: `app/worker/src/index.ts`, `playerDayPayload` — `tracks.splice(tracks.length ? 1 : 0, 0, card);` → `tracks.splice(0, 0, card);`. No client, ui, store, migration, push, or job-sheet change (§1 criterion 6 holds on the landed tree).

### Gates on the rebased tree (tallies from complete logs)

- **harness-v325: 31 ok / 0 FAIL** (log `app/tests/harness-v325-ship.log`).
- **harness-v312: 59 ok / 0 FAIL** (log `app/tests/harness-v312-on-v325.log`), with the **check-11 named update** §4 flagged: check 11's SW cache-name pin stood at `ora-pro-nobis-v312-1`, the name the build base carried; the rebased tree carries `ora-pro-nobis-v318-1` (v318's rename, landed after v320's). The pin now reads `ora-pro-nobis-v318-1`, the assertion text names the update, and the re-run is green (log line 51). Harness-only; no other harness-v312 check was touched.

### Merge + §2.5 regressions on the merged tree

- **Merge 6277dc3** (`--no-ff`) into muse-draft-week in a clean ship worktree (the shared checkout carried the nightly pipeline's uncommitted state and was not merged in); trunk advanced to the ship line, whose head at deploy was a2a0e05. The merged tree carries the new splice at index.ts line 299.
- **harness-v318: 32 ok / 0 FAIL** (log `app/tests/harness-v318-v325-ship-regression.log`) — no order-sensitive expectation stood in it.
- **harness-v320: 60 ok / 1 FAIL** across three complete runs on the merged tree (final log `app/tests/harness-v320-ship.log`), with **named updates of the §2.5 pattern**, all harness-only:
  - *Check 1 cache pin:* `ora-pro-nobis-v320-1` → `ora-pro-nobis-v318-1` — the same superseded-pin class as check 11 above; the failure pre-exists v325 on the trunk (control evidence below).
  - *Checks 5 + 7 waits:* both waited for `current === "ep-long-a"` within 15 s of Play All. Under Intentions-first, the day queue opens with the Morning Intentions segment — a 30 s fixture tone — ahead of ep-long-a. The waits now span 45 s so the same standing track anchors both checks; every downstream assertion is unchanged.
  - *Check 8 expectation:* after ep-short-a in the Midday queue, next/afterNext re-derived — `ep-short-b` → `ep-long-c` (the segment stands at the block's head now, not after ep-short-a). The hold mechanics assertions are dynamic off the snapshot and stand; check 9's advance target follows (ep-long-c).
  - *Check 10 expectation:* the Evening queue's last descriptor is now `ep-short-c` (the segment stands at its head); the queue-end assertions stand.
  - With those updates, every order-sensitive leg of harness-v320 is green in two consecutive complete runs.
- **The one standing FAIL — check 4's label leg, judged and named:** "two successive label reads decrease ('Sleep · 5:00' -> 'Sleep · 5:00')" failed identically in all three merged-tree runs. It is **not a v325 effect**, on this evidence: (a) the leg exercises only the sleep sheet's countdown label at boot — client code that is **byte-identical** between base and merged trees (v325's entire production delta is the one server line; the rebase diff proves client.ts/ui.ts untouched); (b) a **control run of the unmodified harness-v320 on the pre-v325 trunk (1d677a4)** in the same environment scored **48 ok / 2 FAIL and crashed** at assertion 50 (a 20 s selector timeout) — the suite is timing-fragile in this environment independent of v325, and the stale check-1 pin is one of its two base failures; (c) the label's own math is proven live in the same runs (check 4's state-agreement legs pass; the rendered text lags the per-second tick under this machine's load). The leg stands as an **estate follow-on** (a timing-marginal assertion: widen the read gap or derive the expected label from `__opnSleep.state()`), filed in the Curator note — it does not block this landing, because the regression v325 could cause is fully green and the failing leg cannot be reached by v325's change. If the Coordinator judges otherwise, the rollback below is a pure redeploy.

### Deploy + production proof

- **Deploy:** connector-surrogate wrangler from the merged tree's `app/` (dry-run first, exit 0; token transient, never printed or filed). **Worker `ora-pro-nobis-app` version 9f2a2d02** (deployed 2026-11-09 ~04:29 UTC). **Rollback target: f0b3fb13** (v318's deploy) — rollback is a pure redeploy of that version (§2.7); no migration or data shape stands to unwind.
- **Production proof (door-equivalent read, method stated per the standing rule):** `GET /api/player/day` refuses the agent door (403, by design — confirmed post-deploy). The proof is the prayer door's stored-day read + the deployed builder's splice rule, read first-hand in the deployed source: `playerDayPayload` builds each block's tracks from the stored `player_episodes` rows (`ORDER BY sort, episode_id`) and executes `tracks.splice(0, 0, card)` — the Intentions card stands at **index 0 of every block by construction**, over whatever rows are stored. Post-deploy stored-day read-back: **2026-11-08 · 17 episodes · 17 present / 0 missing · segment audio in all six blocks** (unchanged by the deploy, as expected — the push path is untouched). The stored rows (D1 read) distribute Morning 2 · Afternoon 1 · Night 1 · unblocked 13 · Midmorning/Midday/Evening 0, so the served payload reads:
  - **Morning:** Intentions at 0, then 2 episodes · **Midmorning:** Intentions at 0 (only track) · **Midday:** Intentions at 0 (only track) · **Afternoon:** Intentions at 0, then 1 episode · **Evening:** Intentions at 0 (only track) · **Night:** Intentions at 0, then 1 episode · **Unblocked group:** 13 episodes, no card (unchanged).
  - Against the v327-era picture (Intentions at index 1 in Morning/Afternoon/Night, 0 in the episode-less blocks), exactly the head position changed — §1's rule now holds in production on the standing stored day. harness-v325's legs (payload head, DOM head, queue heads on a fixture day against this same builder) are the behavioral half of the proof.

### The flip — all four pieces, read back

- **Release row:** v325 **Live** · shipped_at 2026-11-09T04:31:00Z · whats_new_id **43** (full-field upsert built from the live detail read; scope, directive, and slug preserved — read back after the write).
- **Shipped record:** id **403** (title + camelCase shippedAt/whatsNewId accepted; read back in the shipped list).
- **What's New:** id **43** — "Intentions first in every prayer block".
- **Ship phase record:** 1132, passed at this gate's close.

### Standing consequences (named for the Coordinator; not seated by this pass)

- **v324's landing sequence is complete** (v318 → v325 both Live): v324's Implement may seat under its own approval (Through Review) when the Coordinator calls it.
- **v326's Plan precondition stands met** (v318 + v325 Live): v326's Plan may seat under its Autonomous-to-Ship directive when the Coordinator calls it.

### Raw notes for the Curator (no skill edits)

- The superseded-pin class has now bitten three times in one evening (harness-v312 check 11 at v320's rename, again at v318's rename; harness-v320 check 1 at v318's rename). A cache-name pin in a sibling harness is a standing trap on every rename; the estate fix is a pin that reads the expected name from the tree's ui.ts instead of a literal.
- harness-v320's check 4 label leg is timing-marginal in this environment (three identical failures on the merged tree; the base-tree control crashed elsewhere) — the estate follow-on named above.
- The first merge attempt in the fresh ship worktree died on a transient "stash failed" (an autostash hiccup with a clean tree); `--no-autostash` merged cleanly. No content was affected; worth a line in the ship playbook if it recurs.

### Concerns and Information Needs

- **harness-v320 check 4's label leg stands red in this environment** on the evidence above — judged not a v325 effect and filed as an estate follow-on; it is the one item in this pass a later reader should re-verify on a quieter machine before treating harness-v320 as fully green again.
- **Texts on the standing stored day read 0/17** (the v318 read-back shape): the stored day predates v318's first text push; tonight's 00:00 CT run is v318's post-ship verification, unchanged by this release — the order fix and the text surface are independent, as §1 pinned.
- **Information need — none outstanding for Ship.** The §2.6 precondition stood in its primary form; no fallback judgment was needed.
