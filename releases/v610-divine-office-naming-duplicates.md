# v610 — Divine Office: specific names, duplicates allowed

## §1 Scope

John's words (Ora thread, 2026-11-21 22:38 CT): "Why does divine office just show up as divine office?.the.specific.pesyer needs to show up.snd duplicates can be allowed"

Two fixes, TO SHIP under the fix-forward discipline:
1. SPECIFIC NAMES — every Divine Office track shows its own hour's name (Invitatory · Office of Readings · Morning Prayer · Midmorning Prayer · Midday Prayer · Midafternoon Prayer · Evening Prayer · Night Prayer), everywhere a track name stands.
2. DUPLICATES ALLOWED — the same specific prayer may stand more than once in a day/list: in contents, in the fold, in the paint, and in the queue; each copy is its own track (own row, own played mark, own intention draw).

DevOps Board row 1584. Streamlined path (ground · Plan · Implement · light Review · Ship).

## §2 The WHY — why the generic label won, and where duplicates died

**The label.** An office track's identity in the contents system is its SOURCE selector: the item key is the slot id (`ext-morning-prayer`, `ext-evening-prayer`, …) and the item's `source` field is the provider name, "Divine Office". The specific hour name exists on the slot record (client `EXT_SLOTS`, server `EXT_DO_SLOTS` — both carry `title: 'Morning Prayer'` etc.), and the folded track itself was already titled from it (`extSlotTrack` reads the settled slot state). But the CONTENTS universe — the one list every item surface paints from (the editor contents, the Add ladder's Sources rung, the in-place edit form's rows) — built each external item as `{kind:'source', key: sl.slotId, label: sl.source || sl.slotId}`. The eight office slots carry no `source` of their own, so `resolveExternals` stamps them all with the fallback `source: s.source || 'Divine Office'` — and that fallback, the provider's name, became the label for all eight hours. Seven different prayers stood as seven identical "Divine Office" rows, indistinguishable in the Add picker and the editor.

**The duplicates.** They died at three layers, in order:
1. CONTENTS VALIDATION (both twins — client `opnCheckContents590`, server `validateProfileContents`): a global seen-set drops any second item with the same kind:key. A profile could not even STORE a repeat.
2. THE FOLD (`extRebuildDescs`): descriptors are built one per standing row and admitted by the contents gate `selIdx590`, which returns the FIRST contents index for an id — even a stored duplicate emitted once.
3. IDENTITY: an external descriptor's `episodeId` IS the slot id; the card key, the played-mark key, and the intention-draw key all derive from it. Two copies would have shared one card, one mark, one draw — `playedKey` (v360) keys repeats per BLOCK, so two copies in the SAME block still collided.

The Add ladder also refused a second copy up front ("Already in <block>").

## §3 Plan

- NAMES at the source: the universe builds the external item's label as `sl.title || sl.source || sl.slotId`. One line; every consumer (editor, ladder, edit form) inherits the specific name. The folded track already carried the title.
- DUPLICATES, office-scoped: the validators' seen-set dedupe is skipped ONLY for a `source` item whose key is one of the eight Divine Office slot ids (client tests `EXT_TOKENS[key]`; the server inlines the id list because the harnesses extract the validator standalone). Every other kind/key keeps the standing dedupe — the widening stops at the office, per the brief's flag rule.
- THE FOLD emits one descriptor per contents occurrence: an emission list is built from the contents indices (own entries emit once at their standing position, as before); copies after the first are stamped `_occ` (1-based). `trackDesc` forwards the stamp.
- OCCURRENCE IDENTITY: `playedKeyOcc` = the standing `playedKey` + `#n` for a stamped copy; `descMarkKey(t)` is the one key a descriptor's marks and draws read, routed through `trackKeyOf` (draws), `playedDotHtml` (emits `data-playedocc`), `heardCls`, `refreshPlayedChrome`, the played toggle, the completion write, and the desc-based reads (queue filter, Now Playing on-state, first-unplayed, block played counts, mark-all both ways). Card/play identity runs on `descCardKey(t)` (episodeId + `#n` on copies) in `trackCard`, `tapPlay`, `sectionQueueFrom`, all six playkey wiring sites, the `markPlaying` call sites, and `extSwapCard` (which re-renders copy cards in place on settle). A descriptor with no stamp reads exactly the keys it read before v610 — every standing mark, draw, and card is untouched.
- EDIT FORM: rows are occurrence-qualified in both paints (`opnEditGroupHtml609`, `opnEditPostureHtml604`) via `opnRowId610` / `opnParseRowId610`; remove splices the addressed copy only; restore returns ONE copy at its composed position (multiset rebuild; a fully-present id never gains a copy); drag resolves occurrence indices; the today-divergence check is now a multiset diff (a second copy reads item-added; a dropped copy item-removed).
- ADD LADDER: `isOn` returns false for Divine Office sources — a standing hour stays tappable and adds a second copy; every other item keeps the "Already in" refusal.
- NON-GOALS (named): block pages (`appendBlockSettingsCards` / `blockInsertCards`) paint all standing rows with no contents gate — standing behavior, untouched. Cross-block copies already worked (per-block marks) and are unchanged. No store migration: stored contents keep their shape; a duplicate is simply two entries.
- Pin: `ora-pro-nobis-v610-1`.

## §4 Implement + Review

Worktree `v610-wt`, branch `release/v610`, rebased onto main 70a04b1 (the v609 merge) — no conflicts. Commits: ebcdc5c (part 1: names + validators) · f5fd86c (part 2: fold, identity, edit form, ladder).

- **Client** `app/worker/src/client.ts` — universe label line · client validator exemption · fold emission + `_occ` stamp · `playedKeyOcc` / `descMarkKey` / `isPlayedDesc` / `descCardKey` seams · the played/draw/card routing listed in §3 · edit-form occurrence rows · multiset divergence · ladder `isOn` exemption.
- **Server** `app/worker/src/index.ts` — `validateProfileContents` carries the same office-scoped exemption (parity with the client twin).
- **UI** `app/worker/src/ui.ts` — pin `ora-pro-nobis-v610-1` (lands at ship; see §5).

Gates (Review, on the branch tree):
- harness-v610 **18/0** — legs: N1/N2 specific names (universe + folded day, ≥6 distinct hour titles, none bare "Divine Office") · D1a–d both validators keep two office copies, still dedupe an own-source and a prayer duplicate · D2/D2b the fold emits both copies at their contents positions with distinct card keys · D3a/D3b independent draw keys and played marks · D4a–d the ladder offers a standing Morning Prayer again and the pick lands twice in the today layer. Fail-on-old companions OA1–OA3 confirm the v609 tree fails all three defect legs (generic labels · validator drops the copy · fold emits one).
- Regressions: harness-v603 **50/0** · harness-v609 **31/3** — identical on the pristine v609 base (its OA fail-on-old companions reference git main, which is now the v609 tree itself) · harness-v607 **23/2** — identical on pristine main (same stale-companion cause) · harness-v597 crashes on base at its server extraction (pre-existing; the shape moved under later releases). No v610 regression.
- Renders: `~/workspace/projects/ora-pro-nobis/v610-review-renders/` — 01 the day's office tracks under their specific names (Invitatory · Morning Prayer · Midday Prayer · Office of Readings · Evening Prayer · Night Prayer) · 02 Morning Prayer standing twice in the Morning list (Morning Prayer · Invitatory · Morning Prayer, second copy occurrence-stamped).
- The rendered client parses whole after all edits.

## §5 Ship

HELD — 2026-11-21 23:14 CT: the parent seat ordered HOLD ALL DEPLOYS (v609 production break; v609 rolling back to the v608 Worker). v610 stands at Review-passed on `release/v610`, unmerged, undeployed. On clearance: rebase onto the repaired main (the v609 repair lands first), committed-tree verification, whole-tree marker grep, deploy (pin `ora-pro-nobis-v610-1`), served proof, Git Data API push, What's New, shipped_records insert + read-back, row 1584 → Live, intake Done.
