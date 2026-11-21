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

## 3 · Implement

Built on branch `release/v582` off main 175b857 (fresh clone verified whole before building: HEAD on main at 175b857, clean tree). Commit 52e33b6.

- `app/worker/src/ui.ts` — the `.novsearchbar` rule set stands in APP_CSS directly after the `.searchpill` rules: the bar is full-width (block, `position:relative`, margin 0 0 14px) with the leading ⌕ glyph seat at 21px; its input stands at width:100%, height:56px, font-size:18px, padding 0 18px 0 46px, border-radius 14px, the standing `var(--line)` border and `var(--card)` background, `appearance:none` so the height holds on every browser. The `.searchpill` dress is untouched.
- `app/worker/src/client.ts` — in `paintCatechesisNovenas`, the head markup's wrapper changed from `<p>` to `<div class="novsearchbar">`; the input element itself (type, id `nov-search`, placeholder, value binding, autocomplete) and the `input` event wiring are byte-identical, and a comment names the v582 dress. Nothing else in the client moved.
- No server change, no migration, no data write. `novenaSearchMatch`'s source is identical to BASE (harness S5 proves it byte-for-byte), and the saint order still rides the payload order.

Harness: harness-v582 **16 ok / 0 not-ok** on the build tree and again on a clean checkout (git worktree) of the exact committed tree 52e33b6 — S1 diff confined · S2 migrations unchanged, newest 0042 · S3 pin unmoved pre-Ship · S4 the dress and the wrapper stand, the old bare form gone · S5 behavior source identical + wiring stands · S6 the RENDERED client parses whole · C1 matching behavior unchanged (name hit, saint hit, miss, empty needle) · C2 the rendered head markup carries the bar.

- **Trunk-drift rework:** 0 — main stood at 175b857 from clone through the build; v581 had not merged.
- **Concerns and Information Needs:** none. The one harness defect found was in the harness itself (a `git show` of the 1MB+ client.ts overflowed the default exec buffer; fixed with an explicit maxBuffer before the first full run).

## 4 · Review

Light review (streamlined path), against the approved picks:

- **Diff audit:** the full source diff vs main 175b857 is two hunks. client.ts: the Novenas head wrapper (`<p>` → `<div class="novsearchbar">`) plus its naming comment — the input element and its wiring are byte-identical. ui.ts: one additive rule set (`.novsearchbar`, its glyph seat, its input rule) placed after the `.searchpill` rules; the `.searchpill` dress and every other rule stand untouched. No other file carries a source change.
- **Q1 A compliance:** the input rule reads width:100% (the entire row — the global `* { box-sizing: border-box; }` at ui.ts stands, so the padding rides inside the row), height:56px (taller than the standing 44px pill; the tap target is the full bar), font-size:18px (larger than the standing 16px). The bar stands at the top of the Novenas page, above the list, as before.
- **Behavior unchanged:** harness S5 proves `novenaSearchMatch`'s source byte-identical to BASE; C1 drives the rendered function (name hit, saint hit, clean miss, empty needle matches all); the list repaint-on-type wiring is unmoved (S5). The saint sort order rides the payload, untouched.
- **Harness evidence:** harness-v582 16 ok / 0 not-ok on the build tree and on a clean checkout of the exact committed tree (52e33b6), including S6 — the RENDERED client parses whole.
- **Verdict:** PASS. No returns, no concerns carried to Ship.

## 5 · Ship

SHIPPED LIVE 2026-11-21 16:46Z (11:46 CT).

- **Merge + push:** main re-read before the merge (175b857 — v581 had not merged; no rebase needed). `release/v582` fast-forwarded into main; the SW pin bump (`ora-pro-nobis-v582-1`, ui.ts) landed as the Ship commit. Main pushed via the standing Git Data API replication (4 commits, byte-identical, each SHA verified): remote main read back **cc52c69** == local main — main pushed · remote in sync.
- **Harness on the ship tree:** 15 ok / 1 not-ok — the one not-ok is S3 reading the pin bump itself (the standing Ship shape; S3 guards the pre-Ship tree, where it read green at 16/0 on the exact committed build tree and its clean checkout).
- **Deploy:** from a clean checkout of merged main cc52c69 (the deploy driver refuses a dirty tree or a wrong head). Worker **2b13133f-8ca8-4ff9-985d-42a6260d657f** at 100%. Rollback target: v578 Worker be60f487.
- **Served legs (public host):** GET /app.js 200 — parses whole under vm.Script (1,056,569 script bytes) and carries the `novsearchbar` markup · GET /styles.css 200 — carries the `.novsearchbar input` rule exactly as built (width:100%, height:56px, font-size:18px) · GET /sw.js — pin reads back `ora-pro-nobis-v582-1`.
- **Registry:** row 1553 **Live** (shipped_at 2026-11-21T16:46:42Z, read back) · What's New **394** · shipped record posted · all five phases passed (Scope 2319 · Plan 2321 · Implement 2322 · Review 2323 · Ship 2324) · time contracts 727/728/730/731 all closed with every expectation judged met.
- **Sequencing:** v581 never merged or deployed during this chain — main and the live pin stood at v578's state from seating to ship, so nothing of v581's was carried or overwritten; its deploy will rebase onto cc52c69.
- **Field leg (John's):** open Catechesis → Novenas — the search bar stands big across the whole row at the top; typing still filters the saint-sorted list in place.
