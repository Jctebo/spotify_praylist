# v582 — Novenas search — a bigger search box

## 1 · Scope

Source: John's direction, Ora Pro Nobis thread, 2026-11-21 10:34 CT, verbatim: "And make that search box bigger". Scope Management Space package 72. Relay intake 1096 (Goals Board, Muse Jobs).

THE MATTER: the search at the top of the Novenas catalog page (shipped in v577: the grouping answers sorted by saint, search at the top) is small. John directs a BIGGER search box — a full-width, taller, prominent bar at the top of the Novenas page, so finding one novena among 247 is the first thing a person can do. Client-only change; the search itself (what it matches, the saint order under it) does not change.

APPROVED (John, Ora thread, 2026-11-21 10:37 CT — picks pasted from package 72's prompt; formal-record check: listapprovals read 09:13 CT same morning tops at record 39 (v551) — no formal Space record stands for package 72; the chat approval is the record, the v567 route). RUN LEVEL: TO SHIP.
- Q1 A — Full-width prominent bar: larger text, larger tap target; the search spans the page width at the top of the Novenas page.
- REFINEMENT (John, Ora thread, 2026-11-21 10:36 CT, verbatim): "Also wider. It can take the entire row" — the search box takes the ENTIRE ROW (full width). This is the package's recommended Q1 A shape; no package change needed.
- Q2 — Run level: To Ship (small follow-on, streamlined path: Scope + Plan in one pass · Implement · light Review · Ship).

## 2 · Plan

### 2.1 The surface, as it stands (verified in the fresh clone of main 175b857)

- The Novenas page head is painted by `paintCatechesisNovenas()` in `app/worker/src/client.ts`: the search is a bare `<p><input type="search" id="nov-search" …></p>` with no class.
- The served stylesheet (`APP_CSS` in `app/worker/src/ui.ts`, served at /styles.css) carries NO rule for `input[type=search]` — the base form rule covers only `input[type=text], input[type=date], select, textarea`. The novenas input therefore renders at browser-default size: small text, small height, less than full width. That is the whole defect.
- The app's standing search dress is `.searchpill` (ui.ts): a full-width pill, input height 44px, font-size 16px, leading ⌕ glyph. It serves the prayer book and the Mass picker. Q1 A asks for MORE than the standing pill: a taller bar with larger text.

### 2.2 The change (presentation only)

- `ui.ts` (APP_CSS): one new rule set, `.novsearchbar`, scoped to the Novenas page head — a full-width bar (width:100%, display block, margin under it matching the page rhythm) whose input stands 56px tall with 18px text, generous side padding, the standing border/card dress, and the same leading ⌕ glyph seat as `.searchpill`. The input keeps `-webkit-appearance:none; appearance:none` so the bar's height is the bar's height on every browser.
- `client.ts` (`paintCatechesisNovenas`): the bare `<p><input …></p>` becomes `<div class="novsearchbar"><input type="search" id="nov-search" …></div>`. The input's id, type, placeholder, value binding, and the `input` event wiring are byte-identical — only the wrapper and its dress change.
- Nothing else moves: `novenaSearchMatch` (the match predicate), the saint sort order (payload order), the list repaint-on-type behavior, and every other page stand untouched. No server change, no migration, no data write.

### 2.3 Proof (harness-v582, the change's own harness)

- S1 the diff vs BASE is confined to client.ts, ui.ts, this harness, and the release doc.
- S2 migrations unchanged vs BASE; the newest stays 0042 (0043 stands reserved).
- S3 the SW pin is unmoved vs BASE pre-Ship (the pin bump is the Ship commit).
- S4 the new dress stands: the `.novsearchbar` rules stand in ui.ts with full width, 56px height, 18px text; the Novenas head markup in client.ts carries the new wrapper and keeps `id="nov-search"`; the old bare `<p><input` form is gone from the Novenas head.
- S5 the search behavior strings stand unchanged: `novenaSearchMatch` and the input wiring (`novenaSearchText = inp.value`, list-only repaint) are unmoved.
- S6 THE SERVED CLIENT PARSES: the APP_JS template, rendered exactly as the Worker serves it, compiles whole (the 2026-11-21 v568 lesson — the harness runs the RENDERED text, never the raw source).
- C1 (slice world over the rendered client): `novenaSearchMatch` still matches by name and by saint, misses cleanly, and the empty needle matches all — the matching behavior is unchanged.
- C2 (slice world over the rendered client): the rendered Novenas head markup carries the full-width bar — the wrapper class stands on the search container and the input keeps its id.

### 2.4 Ship plan

Branch `release/v582` off main; harness green on a clean checkout of the exact committed tree; merge to main and push (read-back "main pushed · remote in sync"); SW pin bump to `ora-pro-nobis-v582-1` as the Ship commit; deploy the Worker from a clean ship checkout of the merged main; served legs — the live app.js parses whole, the served /styles.css carries the `.novsearchbar` rules, the pin reads back in the served sw.js; What's New entry; row 1553 flips Live; intake 1096 closes. Sequencing: v581 is in flight on the same client — main and the live pin are re-read before the merge and before the deploy, and the branch rebases onto whatever main stands; never force-push.
