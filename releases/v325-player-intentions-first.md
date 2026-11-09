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
