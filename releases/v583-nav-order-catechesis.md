# v583 — Nav order: Catechesis next to Pray, Conscience one over

Row 1555 · Project ora-pro-nobis · Streamlined small-release path (Plan compressed · Implement · light Review · Ship)

## §1 Scope

John's direction (main chat, 2026-11-21 10:49 CT): "Let's put catechsis next to prayer and move conscience one over." Approved Q1 A (Ora thread, 2026-11-21 11:30 CT): the bottom nav order becomes **Worship · Pray · Catechesis · Conscience · Sacred Art** — Catechesis and Conscience swap places; names, icons, contents, and the cold open on Worship stand unchanged. Run level: To Ship. Scope record 2329 passed.

## §2 Plan (passed) — the change surface and the dependency sweep

**The nav itself is static shell markup.** The bottom tab bar stands in `app/worker/src/ui.ts` lines 70–75 as five `<button data-tab=…>` elements in the order mass (Worship) · prayers (Pray) · conscience (Conscience) · podcasts (Catechesis) · wallpaper (Sacred Art). It is the ONLY copy of the tab bar markup in the repo (grep for `data-tab="conscience"` across app/: one hit). The swap = exchange the conscience and podcasts button lines; buttons carry their own icons and labels, so nothing else in the markup moves.

**Second surface in tab order:** the page menu's `sections` array (`app/worker/src/client.ts`, ~line 14341) lists the sections "in tab order" for the menu's one-entry section list. Its conscience/podcasts pair swaps with the bar so the menu stays a faithful map of the tabs. Its prayers/mass head order is a standing menu convention (the standing group paints first regardless) and does not change.

**Dependency sweep — what was checked for old-order keying:**
- **Saved last-tab state:** `opn-lasttab-v492` (written by `setTab`, client.ts ~5688) stores the tab NAME, validated against the five names at boot (~19867). Name-keyed, not positional — a stored `conscience` or `podcasts` still opens the same tab after the swap. No migration.
- **Cold open:** `bootTab` defaults to `'mass'` (Worship) and stands unchanged (v492 comment at the boot tail).
- **Deep links / routing:** no `location.hash` or `location.search` routing exists in client.ts or index.ts; tab switching is `setTab(name)` with the active class toggled by `data-tab` match (~5689). Nothing numeric.
- **CSS:** no `nth-child` or positional selector touches `.tab` in ui.ts/client.ts; the bar is a flex row, order = document order.
- **Gestures:** the only touch swipe handler is the Sacred Art wallpaper carousel (`[data-car-stage]`), not tab navigation.
- **PIN surfaces:** the Conscience gate renders through `renderConscience()` → `gatedTabRender('conscience', …)`, dispatched by tab name from `setTab`; the v578 vault unlock stands in Settings, reached by name. Neither reads tab position. The v584 PIN-screen release keys off the shared PIN component, not the tab's seat.
- **Server:** index.ts carries no tab-order logic.

**Harness plan:** a new `harness-v583.mjs` in the v582 pattern — build the client bundle from the worktree, render the shell, and assert (a) the tab bar's data-tab order reads mass · prayers · podcasts · conscience · wallpaper with labels Worship · Pray · Catechesis · Conscience · Sacred Art, (b) the page-menu sections order matches, (c) the bundle parses whole. Run on the committed tree in a clean checkout before Ship. Served proof after deploy: fetch the live shell, read the nav order from the served markup, parse the served app.js whole.

## §3 Implement (passed)

Two line swaps, nothing else:

- `app/worker/src/ui.ts` — in `SHELL_HTML`'s tab bar, the podcasts (Catechesis) button now stands third and the conscience (Conscience) button fourth; each button moved whole, with its own icon and label.
- `app/worker/src/client.ts` — the page menu's `sections` array swaps its podcasts/conscience entries, so the menu's section list stays in tab order.

Commits on release/v583: `816ab6d` (the swaps + harness + this doc §2) and `d7d3a1c` (harness fix: `SHELL_HTML` closes on its own line, so the harness's template renderer takes its end marker per template — found on the first harness run, before any green was claimed).

**Harness (harness-v583.mjs, BASE 6307094): 23 ok / 0 not-ok** on the committed tree, and **23 ok / 0 not-ok again in a clean checkout** of the branch HEAD (d7d3a1c) — the committed-tree rule. Legs: diff confined to the four named files · migrations untouched (newest 0042) · SW pin unmoved pre-Ship · the new data-tab and label orders stand in source and in the RENDERED shell · each moved button keeps its icon · `setTab`, the last-tab write, and the boot validation are byte-identical to BASE · the rendered APP_JS parses whole · the boot validation, run in a slice world, resolves a stored `podcasts` and a stored `conscience` to themselves and an unknown value to `mass` — saved last-tab state survives the swap by name.

Record blemish, named: the Plan contract's judgment note (contract 754) misstated the Plan phase record id as 2336; the record is **2343**. A recorded judgment cannot be edited (the door answered 409), so the correction stands here and in the chain's ship report.

## §4 Review (light, passed)

- Diff re-read whole against the branch base (6307094): in `app/`, exactly two lines moved — the podcasts button line and the conscience button line in `ui.ts`, the podcasts/conscience entry pair in `client.ts`. No other surface moved; migrations untouched; John's prayer seats and personal data untouched (no data path in the diff at all).
- Harness re-run on the branch after the §3 commit stands as the Implement proof: 23 ok / 0 not-ok on the committed tree and on a clean checkout of HEAD — the committed-tree rule under John's caution.
- Behavior proof for the one stateful surface: the C2 slice-world legs run the boot validation itself against stored values — a stored `podcasts` and a stored `conscience` each resolve to themselves, so a phone whose last tab was either opens on that same tab after the swap; the cold-open default (`mass`, Worship) stands.
- Ship compose: the pin bump (below) rides this commit per the standing pattern; the harness on the final ship tree is expected at 22 ok / 1 not-ok, the one not-ok being S3 on the pin bump's own line — the same disclosed shape as v582/v586.

## §5 Ship (passed)

- **Merge + push:** release/v583 merged to main as `f9d93b8` ("Merge release/v583 — Nav order: Catechesis next to Pray, Conscience one over (Q1 A)") and pushed through the Git Data API route — the push read back remote main == `f9d93b8`, byte-identical: **main pushed · remote in sync** at ship. The local release/v583 branch was deleted after the merge.
- **Mid-flight composition, handled:** while this chain ran, v584 merged into main (17fa828, its PIN-pad dress in ui.ts). The branch took main in (merge 672710b); the single conflict was the CACHE line, resolved to this ship's pin — the shipped tree carries BOTH changes (the 88px PIN dress verified present in the merged ui.ts) and the nav swap. Harness on the merged tree: **22 ok / 1 not-ok**, the one not-ok being S3 on the pin bump's own line (disclosed in §4). On the pre-v584 base the same harness read **23 ok / 0 not-ok**, on the committed tree and on a clean checkout.
- **Deploy:** Worker `ora-pro-nobis-app` deployed from a clean checkout of the merged main HEAD (f9d93b8) — **Worker version d90bf5c1-b6bd-4a1b-9a84-d2251d7ec3a3**, pin **ora-pro-nobis-v583-1**. Rollback target: the prior deployment (v586's Worker, from its ship earlier today).
- **Served proofs (app.orapronobis.media):** the served shell's tab bar reads data-tab mass · prayers · podcasts · conscience · wallpaper with labels **Worship · Pray · Catechesis · Conscience · Sacred Art** · the served sw.js carries pin ora-pro-nobis-v583-1 · the served app.js parses whole (1,069,483 bytes).
- **Board:** row 1555 **Live** (shipped_at 2026-11-21T17:53:00Z) · What's New **399** · phase records Scope 2329 · Plan 2343 · Implement 2346 · Review 2350 · Ship 2352, all passed · contracts 754 (Plan) · 756 (Implement) · 760 (Review) · 762 (Ship), all judged met.
- **Field leg left for John:** on his phone, the bottom tabs stand in the new order — Catechesis third, Conscience fourth — and a cold open still lands on Worship (or on his last tab, by name as before).
