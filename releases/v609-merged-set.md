# v609 — Merge everything into one set

## §1 Scope

John's words (Ora thread, 2026-11-21 22:27–22:37 CT): "It's not collapsed enough." → "Instead of having blocks followed by blocks and tracks. Merge everything into one set" → "And only one edit button at top." → the Pick stays at the top (22:30 correction: "The edit for when screen is not needed. I can already change it at the top.") → "So the group toggles should still show in this compressed form and toggled off ones show too" (22:34) → "It's good, just too cluttered with the section thing at the top" (22:34) → "Or rather an add button" (22:35, replacing the nested-podcasts reading) → "I can remove the podcasts just like I am removing anything else." (22:37). Run level: "Approve to ship." (22:34 CT).

The build: the Praylist home paints ONE SET — a Play All head + every track of the day in fold order, no block sections, no block rows, no dividers, no fold. Exactly one Edit act stands, at the top (the plan row); the plan-row Pick stands untouched beside it. The edit form the top Edit opens is the condensed form: scope banner + frozen bar only at its top (the v607 shape strip retires), the set grouped by block, each group headed by its ON/OFF toggle, toggled-off groups standing in full (dimmed, editable). Podcasts enter through the Podcasts group's Add button (the v603 ladder), stand as ordinary items, and remove through the ordinary remove act. Blocks remain the composition unit underneath (stores, profiles, layers, the fold unchanged). DevOps Board row 1583. Streamlined path, TO SHIP.

## §2 Plan

Settled in the build log (`v609-build-log.md` §§1–17), in brief:

- ONE SET: `homeBodyHtml` paints `opnSetHtml609` only — Play All (`data-queue="__all"`, a new branch in the standing queue handler queuing `extRebuildDescs(day)` unfiltered) + every track via the standing `trackCard`, in fold order. Dividers: NONE — no function breaks without them (intentions are per-track).
- THE FOLD RETIRES from the home: the ⋮ menu loses Expand all / Collapse all; the home paint no longer reads the stored mode. The old painters stand as unreachable dead code (codebase precedent). Favorites folds untouched.
- ONE EDIT AT THE TOP: the plan row's `data-p607edit` is the page's only edit entry (leg E1 counts exactly one, in `.profplanrow`, before the set). The Pick stands at the page top ONLY — no switcher in the edit screen (John's 22:30 correction).
- GROUP TOGGLES: the edit form groups by block (`opnEditGroupHtml609`); each group head (`.p609ghead`) carries the block's switch on the standing wiring (`data-p607sw` — `block|<name>` · `layer|novenas` · `layer|podcasts`). ON groups in day order; OFF groups after, canonical order, in full under `.p609off` (rows dimmed via CSS, head legible), rows wired (drag · remove · Add). The shape strip no longer paints (`opnShapeHtml607` dead code).
- TOGGLE FLUSH: `opnToggleShape607` chains a contents flush under the new shape (`opnWrite604('__shape609')`), so a group flipped on takes its session-edited list into the store with the flip. The store cannot hold contents for a block that does not stand — an off group's edits land when the group stands on (named semantics, v607's).
- PODCASTS: the group head carries the layer toggle + the group's Add (the v603 ladder, Sources door). Items enter by the ladder, stand as ordinary contents items, remove by the ordinary remove act. THE SERIES SWITCHES KEEP A SEAT inside the Podcasts group (`opnSeriesRows609`, standing `series|<key>` wiring): John's podcast selections live in `layers.series`, not in Podcasts contents — retiring the switches with the strip would strand every standing series with no seat to switch it. Unifying series into contents rows is a named follow-up, not built here.
- DRAG BOUND: drags stay within their block's run BY STORE CONSTRUCTION — `opnDragOver604` resolves both ids in the drag row's own block list; a cross-boundary target is an inert no-op. No move writes between blocks' contents.
- TODAY MARK: re-homed to the plan row's meta line (where `profPlanRowHtml` already paints it); the per-block mark retires with the block rows.
- CONDENSED ROWS: edit rows carry title · drag handle · Remove only (`.p609erow` compact dress); the Intention line and duration stand in the prayer posture only.
- NOW PLAYING / QUEUE / LOCK SCREEN: untouched; the fold already composes the day as one sequence (leg M5: the queued order equals the fold's composed order).
- Pin: `ora-pro-nobis-v609-1`.

## §3 Implement

Worktree `v609-wt`, branch `release/v609` off main d839539 (v607), rebased onto e450a3b after v608 shipped mid-chain (client.ts merged clean; the ui.ts conflict was the pin only, resolved to v609-1; whole-tree marker grep clean). Final commit 940e991 + this doc commit.

- **Client** `app/worker/src/client.ts` — `homeBodyHtml` returns `opnSetHtml609(day)` (old body stands as comment + dead code) · NEW `opnSetHtml609` · NEW `opnEditSetHtml609` (ON groups in day order + OFF groups appended canonical) · NEW `opnGroupOn609` · NEW `opnEditGroupHtml609` (group head with name + switch, condensed rows, Removed/Restore lines, per-group Add) · NEW `opnSeriesRows609` (the series switches' seat in the Podcasts group) · the `[data-queue]` handler gained the `__all` branch · the ⋮ menu's Prayers-home fold items removed · `paintPrayersView`'s home composition no longer calls `opnShapeHtml607()` · `opnToggleShape607` chains the contents flush.
- **UI** `app/worker/src/ui.ts` — pin `ora-pro-nobis-v609-1` · CSS: `.p609set` · `.p609group` · `.p609ghead` · `.p609off` dimming · `.p609erow` compact rows.
- **Harness** `app/harness-v609.mjs` — modeled on harness-v607's frame (fixtures-v603 + John's v589 import store). Legs: T0 parse · OA1–OA3 fail-on-old (old = git main) · M1–M6 (one set · fold order · fold acts nowhere · one Play All · whole-day queue · tap plays) · E1–E9 (one edit entry · Pick at top · one question + banner + NO shape section · groups under heads · condensed rows · drag within/across · Done · today mark) · G1–G5 (no top switches section · off group in full · flip writes at once · flipped group's tracks land in the set · off-group edit persists) · P0–P6 (Podcasts group + Add · series seat · ordinary remove · persistence · the ladder entry point).
- **Gate results (final tree):** harness-v609 **34 ok / 0 not ok** · harness-v603 **49 ok / 1 not ok** (the 1 = T11, the SW pin check vs main — resolves at the merge) · harness-v607's A-section drives the retired block-row expansion ([data-openblock]) and its OA companions anchor to a main that now contains v607 — those legs retire BY NAME (the surfaces they drive are retired by this design); v609's legs re-prove the standing v607 guarantees.
- **Named gap:** the ladder re-offer of a source removed in an earlier session is not legged — the harness fixture day carries no podcast episodes, so post-write standings rebuilds make the offer state unverifiable in this world. The add route is the standing v603 ladder + v604 host, untouched; the remove route is legged (P3, P6a). In-session a just-removed source paints marked "Already in Podcasts" (the v604 host reads the form-open resolution — standing behavior, leg P5). Field leg for John: add a podcast through the ladder.
- **Renders:** `renders-v609.mjs` → `v609-review-renders/01-merged-set.html` · `02-edit-form-groups.html`.

## §4 Review

**Verdict: PASS** — light Review (fix coordinator, self-review against the build log + renders + harness, 2026-11-21).

- Every settled point in the build log (§§1–17) is either legged in harness-v609 or named as a gap (§17 above). The two reversals John issued mid-flight (the Pick's seat, 22:30 · the Podcasts shape, 22:35) are built as corrected, not as first read: no chips stand in the edit form (leg E3 asserts the head carries banner + bar only), and no nested podcast catalogue stands anywhere (the Podcasts group carries its toggle, its series switches, its contents rows, and its Add).
- The series-switch seat (§15 of the log) is the one judgment call taken under decide-and-move: the alternative (retiring the switches with the strip) would have stranded John's standing series selections with no seat — a silent functional loss against his "remove the podcasts" direction. The seat is inside the group, not a top section, so every sentence John spoke stands literally. Named here and in the field legs so his verdict can reverse it.
- Scope check: the diff touches client.ts (the Prayers home + edit form only), ui.ts (pin + the .p609 CSS), the new harness + renders scripts, and this doc. No store shape, no migration, no Worker server change. Prayer seats and John's profiles data are untouched.
- Committed-tree verification: harness-v609 re-run in a clean checkout of the branch HEAD before the merge (result recorded in §5).

## §5 Ship

(Completed at ship time — see the ship commit on main.)
