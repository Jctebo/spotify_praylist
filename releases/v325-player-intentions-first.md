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
