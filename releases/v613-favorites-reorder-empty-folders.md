# v613 — Favorites reorder mode hides empty custom folders

## §1 Scope

John's ruling (v581, Ora thread 2026-11-21): empty folders don't show — the Favorites PAGE paints only folders holding at least one item, defaults and customs alike. One divergence stands since v579: the Favorites REORDER mode still lists empty CUSTOM folders (for management), while empty default folders are already absent there. John's word closes the divergence (main chat, 2026-11-22 01:02 CT: "Approve everything" — approving the alignment put to him): Reorder mode hides empty custom folders too. One rule, both surfaces.

The change is confined to the reorder mode's folder derivation in `app/worker/src/client.ts`. The four (five, since v581) default folders and any folder holding items are untouched. A folder emptied while the mode stands leaves the list on the next paint. No store shape changes, no migration, no new state: the folder definition entry itself is never touched — only the mode's visible list changes. DevOps Board row 1587. Streamlined path (Scope+Plan compressed, light Review, targeted harness). Run level: Scope+Plan now; Implement HELD for main-seat clearance (queue: v612 building — same client file).

### The page rule, grounded (shipped client, standing-clone main `0745dd3`)

- **The predicate is `favFolderCount(f.id) > 0`** (`favVisibleFolders()`, client.ts ~12455): the visible list is `favFolders()` filtered to folders whose count is at least one.
- **What counts** (`favFolderCount`, ~12447): for the Prayers folder, the book's favorites (`bookFavsList().length`) — its content is definitional. For every other folder, **tracks + doors**: `favTracksIn(id)` (entries of `favoritesList()` whose EFFECTIVE folder — `favFolderOf`, assignment where one stands and names a live folder, else the derived folder — is this folder) plus `favDoorsIn(id)` (starred `series` entries in this folder — a podcast series door or a novena door counts as the folder's item, exactly as an episode entry does). A folder holding only a series door is NOT empty; a folder whose entries all moved away or were unstarred IS empty, whatever its definition entry says.
- **The defaults:** `FAV_FOLDER_DEFAULTS` stands at five since v581 — praylist · catechesis · prayers · podcasts · novenas.

### The reorder divergence, grounded

- The mode derives its own list (`favReorderVisibleFolders()`, ~12161): `favFolders().filter(f => f.custom || favReorderFolderItems(f).length > 0)` — the `f.custom ||` clause is the whole divergence. Its content measure (`favReorderFolderItems`: Prayers → book favorites; else doors then tracks) is the same measure as `favFolderCount`, so the two lists differ ONLY by the custom exception.
- The mode's entry (`enterFavReorder`) snapshots that list into `favReorder.folders`; the paint (`paintFavoritesPage`, reorder branch ~12762) walks the snapshot. `favReorderAvailable()` (the header menu's Reorder act gate) also reads the divergent list.
- The v581 header comment at `favVisibleFolders` claims the reorder lists read the page derivation "so a folder hidden here is absent there by construction" — the claim stands ahead of the code; the `f.custom ||` clause falsifies it for customs. This release makes the comment true.
- **Standing harness evidence of the divergence:** harness-v579 leg L6 asserts the OLD behavior ("empty default folders are absent, the empty custom folder stands"). That leg is superseded by this release and is updated at Implement (§2), never silently.

### The management-act finding (grounded — nothing is stranded by this change)

Rename and Delete for a custom folder stand in exactly ONE seat: the folder section head's ⋮ on the Favorites PAGE (`data-favfoldermenu` → `openFavFolderMenu` → Rename / Delete folder, ~12605, painted by `favFolderSectionHtml` ~12685 for custom folders only). That seat already requires the folder to be VISIBLE on the page — i.e. non-empty under v581. The reorder mode's folder head carries a drag handle and the name only — no rename, no delete, no menu.

Consequences, stated plainly:

- An empty custom folder TODAY: invisible on the page (no ⋮ seat), listed in Reorder with no management act there either. Rename/Delete are **already unreachable** for an empty custom folder in the shipped client; this release removes no reachable act.
- The grounded recovery path stands unchanged: an item's ⋮ "Move to \<folder\>" menu (`favMoveItems`, ~12559) reads `favFolders()` UNFILTERED — an empty custom folder remains a move target; moving one item in makes the folder visible on the page, where Rename / Delete stand. "New folder" (header menu) is likewise untouched.
- The pre-existing gap — no direct rename/delete seat for an empty custom folder — predates v613, is NOT widened by it, and is NOT fixed by it (out of the approved scope; named here so it is never mistaken for a v613 regression).

## §2 Plan

- **ONE DERIVATION:** `favReorderVisibleFolders()` drops the `f.custom ||` exception and applies the page predicate — implemented as a filter on `favFolderCount(f.id) > 0` over `favFolders()` (the same measure the mode already computes via `favReorderFolderItems`, restated on the page's own count so the two surfaces share one predicate by construction). The v581 comment at `favVisibleFolders` becomes true as written; the v579 block comment at the reorder mode (~12139, "A folder stands in the mode when it holds an item or it is a custom folder") is rewritten to the aligned rule in the same change.
- **ENTRY AND AVAILABILITY:** `enterFavReorder` and `favReorderAvailable` read the aligned list unchanged in shape — an empty custom folder no longer counts toward the ≥2-folders availability leg, and a folder holding ≥2 items still opens the mode on its own.
- **EMPTIED MID-MODE LEAVES ON THE NEXT PAINT:** the reorder paint filters its working list through the aligned predicate at paint time (a folder whose count has fallen to zero since entry — e.g. its last item unstarred or moved by a sync repaint — emits no section). `favReorderDone` already tolerates a folder whose membership changed mid-mode (its splice skips whole on a length mismatch); Done on a mode whose working list names a now-hidden folder saves the standing folders' orders and skips the hidden one — no write is derived from a hidden folder's rows. Folder ORDER for hidden folders: the saved order key keeps its standing behavior for folders that stand; a hidden folder's id simply does not appear in the working list (the order key's own stale-id dropout in `favFolders()` already covers ids that stop naming folders; a still-defined but empty folder keeps its definition and re-enters the list, in its standing place, the moment it holds an item again).
- **UNTOUCHED:** the page paint and `favVisibleFolders` (no change — the regression leg proves it) · folder definitions and the starred store · `favMoveItems` (empty customs remain move targets) · New folder / Rename / Delete code paths · the drag machinery · Done's splice semantics for standing folders · the Prayers folder's definitional content.
- **HARNESS-V579 L6, SUPERSEDED BY NAME:** at Implement, harness-v579's L6 leg ("the empty custom folder stands") is rewritten to the aligned expectation ("empty folders are absent — defaults and customs alike") with a comment naming v613 as the superseding release. Every other v579 leg stands as-is and must stay green.
- **PIN:** `ora-pro-nobis-v613-1` (ui.ts CACHE bump at ship, standing practice).

### Harness legs (harness-v613, named here; built at Implement)

Fixtures from production shapes only (Improvement D): a starred store in the shipped shapes — default folders with track and series-door entries, a custom folder definition entry (`k:'folder'`) with items assigned, a custom folder definition with NO items, a Prayers folder standing on book favorites — the harness-v579/v581 world recipe, not invented shapes. The old-client ref for the fail-on-old companion is the immutable pre-v613 tree (the ship tree of v612, pinned by commit at Implement), never the moving `main`.

- **R1 — Empty custom absent from reorder:** the store carries an empty custom folder + non-empty folders → `favReorderVisibleFolders()` and the painted reorder sections stand WITHOUT the empty custom folder.
- **R2 — Non-empty custom stands:** a custom folder holding one track (and, separately, one holding only a series door) stands in the reorder list with its rows.
- **R3 — Defaults per their own rule:** each of the five defaults stands in the reorder list exactly when its count is > 0 and is absent when 0 — the same list the page's `favVisibleFolders()` returns, asserted id-for-id equal.
- **R4 — Emptied mid-mode leaves on repaint:** enter the mode with a custom folder holding one item → remove that item from the store (the sync-repaint shape) → repaint: the folder's section is gone; Done then saves cleanly (no throw, standing folders' orders written, the hidden folder deriving no write).
- **R5 — Page rule unregressed:** `favVisibleFolders()` output is byte-identical before/after the change on the same store; the page paint for the fixture store is unchanged.
- **R6 — Management seats unregressed:** `favMoveItems` for a sample item still names the empty custom folder as a move target; the page ⋮ seat code (`openFavFolderMenu`, Rename/Delete) stands untouched for a non-empty custom folder.
- **OA1 — Fail-on-old companion:** R1 driven against the pinned pre-v613 client FAILS (the empty custom folder stands in its reorder list — the divergence reproduces).
- **Regression at Implement:** harness-v579 with L6 rewritten as named above (all other legs green) · harness-v581 green (its L5 page-rule leg is the same predicate) · harness-v576 green.

### Field legs (John, after ship)

- Create or empty a custom folder → open Reorder: the empty folder is not listed; folders with items stand and reorder as before.
- Move an item into that folder from the item's ⋮ menu → it stands on the Favorites page again, and in Reorder.
