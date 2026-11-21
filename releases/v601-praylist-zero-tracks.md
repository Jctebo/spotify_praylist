# v601 — Praylist zero tracks: the today-layer fix-forward

## §1 Scope

Production break, field report (John, Ora thread,
2026-11-21 16:56 CT, with screenshot): "Eevy playlist
says 0 tracks" — every Praylist block reads 0 tracks for
Sat Nov 21, 2026. The same Praylist carried tracks at
15:39 CT (Morning 5 · Midday 2 · Evening 3). Ships since
the working state: v594 Part 2 (16:11 CT) and v598
(16:47 CT, ui.ts only). Run under the production-break
fix-forward rule: restore prayer first, then fix forward
in Part 2's code, keeping every Part 2 feature and the
0045 migration. No data change; John's device document
is never touched by this release.

One triage correction, recorded plainly: the raw
GET /api/player/day payload reads trackCount 0 in EVERY
state, healthy or broken — the endpoint returns block
shells by design and the client composes the Praylist
on-device. The discriminating evidence is the composed
count through the client, which is what the new harness
leg measures.

## §2 Plan — the mechanism

The composition chain: the client folds the day payload
with the on-device profile document (opnFoldDay590);
per-block contents gate the settings-row families in
extRebuildDescs (the v590 §2.3 gate: when a contents
entry stands for a block, only source rows named by a
source selector in that list stand).

Part 2's Edit today materializes a block's contents on
first touch from the composed list
(opnStandingContents597 → profContentsUniverse590),
which is built from state.ownStanding / extStanding —
standings that exist only after a Pray day build
(buildWithSettings inside resolveExternals). Edit
today's open path never builds them. Opened cold —
before any Pray visit — the universe holds NO source
items (Morning: the readings seat only; the other core
blocks: nothing; Novenas: the all-novenas item). The
first contents act snapshots that list into the today
layer, and layerFromDraft's diff carries it as a
deliberate divergence. The §2.3 gate then treats the
stored list as the block's whole truth and filters out
every source row it does not name — every block touched
in Edit today composes with 0 tracks, and the layer
persists the damage in the device document for the rest
of the day. The server fold is innocent: Part 2's
index.ts diff is additive, no layer stands server-side
(prayer_profile_state.today_edits NULL, verified), and
the break is in the device fold.

A sibling keying defect stands in the same gate: the
contents system names the Novenas block's own row with
the all-novenas item, never a source selector, so ANY
contents entry for Novenas (today layer or profile)
gates the novenas row out.

Restore first: rollback deployment 134d042f
(2026-11-21T22:59:38Z) put Worker cf306d08 (v595 — the
last client whose fold carries no today-layer code) at
100%. It stood ~10 minutes; v597's ship (Worker
6a44cfa5, from a brief written before this break)
covered it, restoring Part 2 + v598 + the v597 fix from
main 3cf6dc5. During the rollback window the served
client was verified as the v595 client (pin
ora-pro-nobis-v595-1; zero todayEdits strings in the
served app.js) — under it the stored layer is ignored
and the day composes from the profile alone. This
fix-forward lands on main 3cf6dc5 and re-deploys the
whole standing line with the fix.

## §3 Implement

Three changes, all in app/worker/src/client.ts
(commit 773716e on release/v601, rebased on main
3cf6dc5):

1. Write side (the root): opnEnsureStandings601 —
   when the standings are unbuilt, fetch the day and
   run the standing resolveExternals, bounded at 2.5s,
   proceeding with what stands on failure. Both
   Configure loads (Edit today · Edit profiles) await
   it before their first paint, so no surface can
   paint or materialize from an empty universe again.
2. Fold side (heal + safety net): in
   opnApplyTodayLayer594, a today-layer contents entry
   that names NO source selector and NO prayer —
   the snapshot shapes (empty · seat-only) a cold
   materialization produces — has the block's standing
   source selectors restored ahead of its own items.
   Entries naming a source apply verbatim (deliberate
   gating stands, harness leg C1); entries carrying a
   prayer were hand-shaped through the Add picker and
   stand as the block's deliberate truth (Part 2 §2
   semantics, leg C2). NAMED TRADE-OFF: a deliberate
   removal of every source inside Edit today, leaving
   a sourceless and prayerless list, is overridden by
   the restore — accepted, because a today-layer
   contents list is a machine-materialized snapshot
   and that shape is treated as a snapshot artifact,
   not intent. The guard also heals the standing
   2026-11-21 layer after redeploy without touching
   John's data.
3. Gate keying: in extRebuildDescs, an entry carrying
   the all-novenas item stands the Novenas block's own
   row (the contents system's own name for that row).

harness-v601 (new): jsdom full-client worlds over
production fixtures (John's v589 document · production
source-settings · the production 2026-11-21 day
payload), the poisoned layer written through the real
today-edit route. PRE-FIX client: the standing blocks
compose {} (all zero — the break reproduced). FIXED
client: the same layer composes exactly the clean
counts — Morning 6 · Midday 2 · Evening 3 · Night 2 ·
Novenas 1. No-layer equivalence byte-identical.

## §4 Review

Gates on the committed tree (773716e, rebased and
re-verified whole after the rebase; marker grep 0):

- harness-v601: 8 ok / 0 not ok.
- harness-v594p2: 34 ok / 0 not ok — equal to base.
- harness-v595: 17 ok / 1 not ok — equal to base.
- harness-v593: 18 ok / 2 not ok — equal to base (the
  standing by-design reds).
- harness-v597: 24 ok / 1 not ok — the one red is its
  T5 pin static, stale on the base tree too (the base
  already carries pin v597-1; the leg expects v598-1).
- harness-v598: 14 ok / 1 not ok — the one red is T4,
  which asserts client.ts byte-identical for that
  ui-only release; it is a by-design red for any later
  client-fixing release. Its 14 behavior legs pass.

Server parity note: the server fold's contents
consumers are additions + the readings seat only
(descriptors are client-built) and no layer stands
server-side — the fix is client-side; index.ts is
untouched by this release. Part 2's features stand
whole: the three-door ladder, Edit today behind its
vault gate, divergence badges, the 0045 migration.

## §5 Ship

SHIPPED LIVE 2026-11-21 23:30Z (17:30 CT).

- Worker **1815cb47-1222-460a-a8c9-fe775aaeba1f** ·
  rollback target 6a44cfa5 (v597) · pin
  **ora-pro-nobis-v601-1**.
- Deploy sequence, for the record: cf306d08 (v595)
  deployed 21:50:56Z · 8b3316b6 (v594 Part 2) 22:10:40Z ·
  c408bfad (v598) 22:46:37Z · **v601 rollback deployment
  134d042f, 22:59:38Z, cf306d08 at 100%** (stood ~10
  minutes; the served client verified as the v595
  client, under which the stored layer is ignored) ·
  6a44cfa5 (v597 ship) covered it · 1815cb47 (this fix)
  deployed from main 97179b7.
- GitHub main **97179b7** — main pushed · remote in
  sync (Git Data API replication, read-back OK).
- Served proofs: the served sw.js carries the v601-1
  pin; the served app.js parses whole (1,191,801 B) and
  carries opnEnsureStandings601, the fold guard, and
  the Part 2 surfaces (the ladder, Edit today behind
  profVaultGate594). SERVED-LEG DRIVE: the served
  client, over production fixtures with the poisoned
  layer standing, composes clean == poisoned —
  Morning 5 · Midday 2 · Evening 3 · Night 2 ·
  Novenas 1 (Morning 5 matches the field screenshot
  from the working state at 15:39 CT).
- Gates at ship: harness-v601 **8/0** on the working
  tree, the rebased tree, and the merged tree;
  regression deltas vs base all named in §4 (zero
  behavioral deltas).
- What's New **415** · row 1575 **Live** ·
  shipped_records **789** (inserted and read back) ·
  intake 1118 Done.
- Field leg (John's): the Praylist carries its tracks
  again. If today still reads empty on a device that
  holds the damaged layer in a form the guard does not
  recognize, one "Clear today's edits" in Edit today
  restores it whole; the layer also expires at
  midnight.
