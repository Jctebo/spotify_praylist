# v579 — Favorites — reorder, expand/collapse all, remembered fold state

## 1 · Scope

Direction (John, Ora thread, 2026-11-21 09:41 CT, verbatim): "Also want the ability to reorder favorites and expand collapse all, all triggered from the overflow menu. Collapse expand.state remembered by the app"

Three additions to the v576 grouped Favorites page, all driven from the page's overflow (header) menu:

1. REORDER favorites — an order the person sets, persisted on-device, inside the grouped folders.
2. EXPAND ALL / COLLAPSE ALL — one tap in the overflow menu folds or unfolds every folder at once.
3. REMEMBERED STATE — each folder's expanded/collapsed state is remembered by the app (persisted on-device; the page reopens as it was left).

APPROVED (John, Ora thread, 2026-11-21 10:20 CT — picks pasted from package 69's prompt; no formal Space record stands for package 69, the chat approval is the record, the v567 route). RUN LEVEL: TO SHIP.
Q1 A — Reorder mode from the overflow menu with drag handles; Done leaves the mode; the order persists on the device.
Q2 A — Reorder mode covers folder order as well as item order; the four default folders can be rearranged (none can be deleted, as v576 stands).

Builds on v576 (grouped folders, Live) and v578 (the on-device vault, Live). No server surface: order and fold state live in the on-device store discipline beside the favorites themselves. The first chain seat stopped at its fresh-clone step (the clone failed an integrity check); John ruled (Ora thread, 2026-11-21 10:38–10:40 CT) one standing clone with a worktree + branch per release, and this successor seat (chain-v579-r2) runs under that ruling.

## 2 · Plan

Streamlined path (Scope + Plan compressed · Implement · light Review · Ship), per the standing small-release rule.

Findings from the shipped code (fresh reads of GitHub main 175b857, the v578 tree):

- Fold state already persists on-device: `favCollapseRead`/`favToggleCollapse` over localStorage key `opn-favcollapse-v576`, recording only collapsed folders; the page reopens as left for any folder the person has toggled. What does NOT stand: Expand all / Collapse all acts, and any menu seat for them.
- v550's reorder mode (`favReorder = { keys }`, `favReorderRowHtml`, `wireFavDrag`, `favReorderDone`) reorders the FLAT track list (`favoritesList()` — episode + podcast kinds only) outside the folder sections. It cannot order items inside a folder, cannot order the Prayers folder (its content is the book-favorites slug list, `bookFavsList()`), cannot order doors within a folder, and cannot order folders.
- Folder order has no store: `favFolders()` returns the four defaults in fixed order, then custom folders in store order (their definition entries' order in the starred list).
- Stores: the starred list is whole-JSON in both shapes (server `starred_tracks` · the v568 on-device file) and its array index is the standing order; the book-favorites list is a whole slug array with its own sync. Order state therefore needs no migration and no new server surface.

Build (client.ts + ui.ts only):

1. FOLDER ORDER — a device-local key `opn-favfolderorder-v579` holding folder ids in the person's order. `favFolders()` sorts by it: named ids first in the stored order (ids that no longer name a folder drop out), unlisted folders follow in their standing order (defaults in default order, then customs in store order). Data-driven over the folder list, so a fifth default folder (v581's Favorite Novenas) is covered the moment it lands in the defaults, and a hidden (empty) folder is simply absent wherever the page hides it.
2. REORDER MODE, REBUILT PER-FOLDER — entering the mode (header menu, standing seat) paints the folder sections in standing order; visible folders carry a drag handle on the section head; each visible folder's items paint as drag rows in their standing order (tracks and doors for starred folders, prayer rows for the Prayers folder). `wireFavDrag` is generalized to read its working order from any row container, not only the flat list. Drags write nothing; Done saves, per folder:
   - starred folders: the folder's item keys are spliced back into the starred list at the positions that folder's items already occupy (other folders' entries, folder definitions, and assignments untouched), then the standing whole-list write (`starredSet` + `starredSync`);
   - the Prayers folder: the slug array is rewritten in the dragged order (`bookFavsSet` + `bookFavsSync`);
   - folder order: the dragged folder-id order writes to `opn-favfolderorder-v579`.
   Leaving without Done discards (the standing v550 rule).
3. EXPAND ALL / COLLAPSE ALL — two acts in the header menu's Favorites group, standing outside the reorder mode. Expand all clears the collapse map; Collapse all sets every standing folder's id in it; both write the standing collapse key and repaint. Each stands only when it can change something (Expand all only while some folder is collapsed; Collapse all only while some folder is expanded) — the no-dead-items rule.
4. The Praylist reset sweep is untouched and reads effective folders exactly as before; order and fold state ride the device-local discipline, clear of the v578 vault (the vault encrypts the personal-data file; these keys are UI state, the played-marks precedent).

Coordination: v581 (fifth folder) and v582 (Novenas search) chains run in parallel on the same repo. Merges serialize: re-read main before merging and before deploying, rebase onto standing main, never force-push; the branch merges back to main as part of this release.

Verification: harness-v579 — statics (diff confined to client.ts + ui.ts + the harness; migrations unchanged, newest 0042; SW pin unmoved pre-Ship) + the rendered-client parse leg + vm-world legs over the rendered client: folder-order resolution (stored order wins, unlisted follow, dead ids drop), per-folder item splice (other folders untouched), Prayers slug reorder, expand/collapse all over the collapse map, reorder entry conditions, and the sweep's indifference to order state. Fixtures drawn from the shipped v576 entry shapes (Improvement D). Served-leg proof at Ship parses the served client script whole.

## 3 · Implement

Built on the standing clone (~/workspace/projects/ora-pro-nobis/standing-clone, established this run and verified at GitHub main 175b857 by API read) in worktree ~/workspace/.worktrees/v579wt/repo on branch release/v579, commit d2f1c82. The flagged per-chain clone at ~/workspace/.worktrees/v579/repo stands untouched, as directed. Diff confined to app/worker/src/client.ts, app/worker/src/ui.ts, app/harness-v579.mjs. No migration; no server surface.

As planned (§2):
- Folder order: device-local key `opn-favfolderorder-v579`; `favFolders()` sorts by it (named first in stored order, unlisted follow standing order, dead ids drop out). Data-driven over the folder list — a fifth default folder is covered when it lands.
- Reorder mode rebuilt per-folder: the mode paints the visible folder sections (a folder stands when it holds an item or is custom; an empty default folder is absent, the v581 rule), a drag handle on each section head, drag rows per folder (tracks + doors for starred folders, prayer rows for the Prayers folder). `wireFavDrag` is generalized to any row list. Done saves: folder order to the device key; each starred folder's items spliced into the positions that folder's items already occupy in the whole list (other folders, definitions, assignments unmoved) through `starredSet` + `starredSync`; the Prayers slug array rewritten through `bookFavsSet` + `bookFavsSync`. A folder whose membership changed mid-mode keeps its standing order.
- Expand all / Collapse all in the header menu's Favorites group, each standing only while it can change something; both write the standing collapse key (`opn-favcollapse-v576`) and repaint. Fold state was already remembered on-device by v576; this release completes the set with the two bulk acts.
- The Praylist sweep is untouched and reads effective folders as before; order/fold state rides the device-local UI discipline, clear of the v578 vault.

Defect caught by the harness pre-commit (the v568 class): the sameSet comparison in `favReorderDone` carried a single-backslash `\n` join inside the APP_JS template literal, which renders as a literal newline and breaks the served client's parse. Fixed in source with doubled backslashes; the S6 rendered-parse leg now passes.

Harness: harness-v579 35 ok / 0 not ok on the build tree and again on a clean checkout of the exact committed tree (d2f1c82, tree clean). Sibling regressions on the same clean tree: harness-v576 44 ok / 1 not ok (the one not-ok is its S1 diff-confinement leg reading this release's own harness file in the diff; every behavior leg passes) · harness-v578 41 ok / 2 not-ok (its S1/S2 base-pinned statics; all crypto legs C1–C9 pass).

## 4 · Review

Light review (streamlined path), performed on the committed tree d2f1c82:

- Diff audit: 3 files — app/harness-v579.mjs (new) · app/worker/src/ui.ts (+2 lines: the folder-head handle dress and the section dragging dress) · app/worker/src/client.ts. Every deletion in client.ts is the retired flat-list reorder machinery (the v550 comment form, the flat enterFavReorder, the flat favReorderDone, the single-list wireFavDrag, the flat paint branch) — nothing else was removed. Additions stand only in the planned places: the folder-order key + favFolders ordering, favExpandAll/favCollapseAll + their any-reads, the per-folder reorder block, the reorder paint branch, the header-menu seats.
- Picks audit: Q1 A — Reorder stands in the header menu's Favorites group, drag handles on items and folder heads, Done saves and leaves the mode, leaving without Done discards; the orders persist on-device (starred whole-list write · book slug sync · folder-order device key). Q2 A — folder order is reorderable in the same mode; no folder can be deleted from the mode (Delete stands only in a custom folder's own menu, as v576 built it; defaults have no such menu).
- Harness read-back: harness-v579 35 ok / 0 not ok on a clean checkout of the committed tree; the S6 rendered-parse leg passes (it caught the single-backslash join defect during Implement, fixed before commit). Sibling regressions as recorded in §3.
- Risk notes: the drag machinery is v550's, generalized — pointer behavior on a real phone stands as a field leg, as it did for v550. The folder drag moves a whole section; on a long folder the section is tall, which makes the folder drag deliberate rather than quick — acceptable for an order set once. favReorderDone's mid-mode membership guard keeps a folder's standing order when its content changed under the mode.

Verdict: PASS.

## 5 · Ship

- Sequencing: v582 (Novenas search) shipped Live while v579 built; before merging, main was re-read (remote c1f1c5a) and release/v579 was rebased onto it (clean rebase — v582's client changes did not touch the Favorites machinery). v581 stood in Implement at merge time; nothing of its was touched. On the rebased tree harness-v579 read 35 ok / 0 not ok again; the SW pin bump to ora-pro-nobis-v579-1 followed (ship tree: 34 ok / 1 not ok, the one not-ok being the S3 pin leg reading its own bump — the standing disclosed shape).
- Merge + push: release/v579 merged fast-forward to main in the standing clone and replicated byte-identically to GitHub via the Git Data API — main pushed · remote in sync: remote main == a49dc6de52e3c3b048ecf5e438c62d36381d00d9 (build a0c943f + pin a49dc6d over c1f1c5a).
- Deploy: from the standing clone at merged main — Worker 4b6371be-bd9f-46a6-b8b1-6a4e98588ab4 at 100%. Rollback target: the v582 Worker (read at deploy time from the deployments list; the pre-deploy production pin was ora-pro-nobis-v582-1).
- Served-leg proofs (public host, plain GETs): sw.js carries ora-pro-nobis-v579-1 · app.js parses whole under vm.Script (1,064,540 script bytes) with the v579 surface present (Expand all · Collapse all · opn-favfolderorder-v579 · data-favfolderhandle) · /api/prayer/intentions answers the empty public shape {"ok":true,"intentions":[]}.
- Registry: row 1548 Live (shipped_at 2026-11-21T16:50:31Z) · What's New 395 · all five phases passed · time contracts 729 (Plan), 732 (Implement), 735 (Review), 736 (Ship) closed with expectations judged (729's predecessor 722 stands closed with both expectations judged blocked — the stopped first seat's clone failure, recorded honestly at takeover).
- Standing-clone note: this release established the ONE standing clone at ~/workspace/projects/ora-pro-nobis/standing-clone under John's ruling (2026-11-21 10:38–10:40 CT); the local release/v579 branch is deleted after merge, per the push-to-main rule.
- Open field legs (John's): drag-reorder an item inside a folder and a folder itself, leave and return — the orders stand · Collapse all, leave, return — the page opens folded · Expand all — the page opens unfolded · reorder the Prayers folder and play a row (the order is the play order's source list order for the folder's own paints).
