# v676 — LOH Widget for Every Divine Office Prayer (the player's Read stands for office tracks)

## §1 Scope (John's field report, 2026-11-25 19:03 CT — fix-forward on v675, run level: To Ship)

Streamlined path: Scope + Plan in one pass (this doc, §§1–5). v676 is a fix-forward on **v675** (Live, pin `ora-pro-nobis-v675-1`, Worker d42fa21c-e0a3-4c19-8e4c-022a86c786f6). No new scope package: the widget, its endpoint, and its header wording were settled by John's v675 approval (Q1 A · Q2 A · Q3 A · Q4 A · Q5 A); v676 changes only **where the widget branch can be reached from** — the player, and office descriptors reached as episodes.

Field evidence (the defect): John's screenshot 2026-11-25 19:03 CT (`~/workspace/user/files/6253_9_i44c.jpg`) — the Now Playing card for "Morning Prayer - Sing the Hours"; the bottom row stands as Intentions On · Star · Share · ⋮ · Queue; **no Read button**. John's words (verbatim):

- "I don't see it on app"
- "Any divine office prayer. Not just morning"
- "And it's not on morning prayer either"

Reading of the report, named plainly: v675 attached the widget to track pages and to the Read view's office branch, but its scope carried the player's bottom-row Read as an explicit OUT, and the player caller opted out of the widget branch (§3.4 of v675). On the phone, the surface John actually uses for a playing office track is the player — so the widget never stands where he looks for it. v676 reverses that one boundary **for office tracks only** and widens office identity so a Divine Office hour reached as an episode (not as a labeled/composed slot) matches too.

- IN: the Now Playing `#np-read` button stands and paints the widget for every Divine Office office track — all eight hours (Invitatory · Office of Readings · Morning Prayer · Midmorning Prayer · Midday Prayer · Midafternoon Prayer · Evening Prayer · Night Prayer), both office sources (Divine Office · Sing the Hours), whether the playing descriptor is a labeled slot, a composed slot descriptor, or an episode-shaped Divine Office descriptor whose title names the hour · the `openRead` widget branch keyed on the widened predicate with the v675 player opt-out retired · the track-page branch keyed on the same widened predicate (v675 track-page behavior otherwise unchanged).
- OUT (standing): non-office tracks of every kind (Saint of the Day, USCCB readings, TV Mass, Gospel Exegesis, Bible in a Year, homilies, own podcast episodes) — their player Read behavior and Read view stay byte-identical · any change inside the frame · specific-date or specific-prayer deep links · offline caching of the text · permission letters.
- Carried wording (v675, approved, unchanged): Q3 A line "Text: Divine Office — the widget always shows today's Hours" · Q4 A line "Audio: Sing the Hours · Text: Divine Office (today)" where the source is Sing the Hours · Q5 A note "Playing inside the frame is separate from the app player." · failure row "Text unavailable — open Divine Office", never a blank box.
- Heading discipline (v672, standing): headings read "Liturgy of the Hours"; "Divine Office" stands only where it names the source.

## §2 Plan grounding (Plan agent, chain-v676, 2026-11-25 — firsthand code read on the v676 worktree, base 98262df, the v675 ship tree)

### §2.1 Root cause 1 — the player's Read is held hidden for office tracks
- The Now Playing sheet always renders `#np-read` in the bottom row: `openNowPlaying` builds the controls row (client.ts:18271) in the order Intentions · Read · Star · Share · ⋮ · Queue.
- `updateNowPlaying` (18348) resolves `var rt = state.readTracks[cur.episodeId]` (18382) and stands the button only on the text test (18387–18390): `if (rt && rt.hasText && rt.textUrl)` clears `visibility` and removes `aria-hidden`; otherwise the button is held at `visibility:hidden` with `aria-hidden` set — the slot is HELD, not collapsed (the v419 G17 discipline, commented at 18383–18386), so the row's geometry never moves.
- Office external descriptors can never pass that test: `extSlotTrack` (18724) builds every external descriptor with `hasText: false, textUrl: null` (episodeId = `slot.slotId`, kind 'external', source standing). For composed slot tracks the `readTracks` entry is absent altogether, so `rt` itself is undefined. Either way Read never stands for an office track — exactly the screenshot: the row shows Intentions On · Star · Share · ⋮ · Queue with the Read slot held invisible.

### §2.2 Root cause 2 — the player click is a second gate on the same test, plus the v675 opt-out
- The `#np-read` click handler (18293–18296) resolves `t = state.current && state.readTracks[state.current.episodeId]` and fires only `if (t && t.hasText && t.textUrl)`, calling `openRead(t, { plainText675: true })` — the v675 §3.4 player opt-out. Even a hypothetical text-carrying office entry would paint the plain-text path, never the widget.

### §2.3 Root cause 3 — the widget branch keys on slot identity only
- `openRead(t, opts)` (18142) paints the widget branch at 18169 only where `lohOffice675(t) && !(opts && opts.plainText675)`.
- `lohOffice675` (17368–17371) returns true iff `t.episodeId` is in `LOH_OFFICE_SLOTS_675` — the literal eight-slot set: `ext-invitatory` · `ext-morning-prayer` · `ext-midmorning-prayer` · `ext-midday-prayer` · `ext-midafternoon-prayer` · `ext-office-of-readings` · `ext-evening-prayer` · `ext-night-prayer`. Slot identity only — no source, kind, or title test (v675 §2.3).
- A Divine Office episode descriptor reached **as an episode** (podcast/episode-shaped; its `episodeId` is an episode id, not a slot id) therefore never matches, on any surface. John's "Any divine office prayer. Not just morning" names this gap as well as the player gap.

### §2.4 The standing widget seats (reused unchanged)
- `lohWidgetHead675(t, dateStr)` (17375): heading "Liturgy of the Hours" · the hour — it first takes `t.title`, then overrides from the EXT_SLOTS def title where a def's `slotId === t.episodeId`; **for an episode descriptor no def matches, so the hour falls back to `t.title`** (the standing fallback) · the track's own date · the Q3 A line · the Q4 A line only where `t.source === 'Sing the Hours'` · the Q5 A note.
- `lohWidgetBody675()` (17391): the loading line "Loading today's Hours…" + `<iframe src="https://divineoffice.org/widget">` exactly (no sandbox attribute, no src rewriting) + the hidden fallback row.
- `lohWidgetWire675(root)` (17410): the frame's `load` is decided by the no-cors reachability probe (the v675 §6 deviation, ACCEPTED in v675 §7 against gate (f)'s "never a blank box"); the `error` event and the 6-second timer replace the block with the "Text unavailable — open Divine Office" row (link `https://divineoffice.org`, `_blank`, `noopener`). Never a blank box.
- The track-page seat: `trackPagePaintDay643` (17529) computes `office675 = lohOffice675(d)` and, where it stands, paints `lohWidgetHead675(d, L.date)` as `headHtml`, suppresses the `descText` blurb, and in `afterPaint` sets `#track-text-643` to the wired widget body; non-office day tracks take the standing `descText`/`textUrl` path.

### §2.5 Office identity in the standing tables
- The EXT_SLOTS defs (18478–18489) carry the eight office slots interleaved with the non-office courier slots `ext-bible-in-a-year` (source 'Bible in a Year'), `ext-gospel-exegesis` (source 'Logical Bible Study'), and `ext-saint-of-the-day` (source 'Good Catholic'); the retired Mass/Homilies slots (`ext-usccb-readings` · `ext-daily-tv-mass` · `ext-fr-mike-homily` · `ext-barron-sermon`) stand in the v675 §2.3 record. None of the non-office slots is in `LOH_OFFICE_SLOTS_675`, and none of their sources is an office source.
- The two labeled slots (`opnLabeledSlot650`, 2316: `ext-morning-prayer` / `ext-evening-prayer`) are where Sing the Hours stands as the fallback side; its descriptors carry the same slot `episodeId` with source 'Sing the Hours' — slot identity, not source, is what matches them today.
- Grounding note on the §3.1(b) arm: no standing builder puts a `slotId` field on a descriptor — `extSlotTrack` carries slot identity on `episodeId` alone. The `t.slotId` arm is therefore inert on today's descriptor shapes; it is additive (set membership is required, so it cannot false-positive on a non-office descriptor) and covers any descriptor shape that carries its slot identity on `slotId` directly. No §3 decision contradicts the code as read; this is the one arm with no live producer today, named so Review judges it as written.
- Grounding note on the §3.1(c) title arm: the EXT_SLOTS defs carry `fallbackToken` 'Lauds' / 'Vespers' for the two labeled slots. The §3.1(c) phrase list follows the eight hour names exactly and does not add those aliases; labeled-slot descriptors are covered by arms (a)/(b) independent of title, so the aliases are not needed for the slot shapes.

### §2.6 The pin seat
- `app/worker/src/ui.ts:1186` — `var CACHE = "ora-pro-nobis-v675-1";` is the standing pin seat the §3.7 bump replaces.

## §3 The build (client.ts + ui.ts pin + the harness)

1. **New predicate** `lohOffice676(t)`: true iff any of three arms stands —
   - (a) `lohOffice675(t)` — slot identity on `episodeId` (covers labeled slots and composed office descriptors, exactly as v675);
   - (b) `t.slotId` is in the same eight-slot set (`LOH_OFFICE_SLOTS_675`);
   - (c) `t.source` is 'Divine Office' or 'Sing the Hours' **AND** `t.title` names an office hour — a token/phrase test on the title against the eight hour names: Invitatory · Office of Readings · Morning Prayer · Midmorning Prayer · Midday Prayer · Midafternoon Prayer · Evening Prayer · Night Prayer. This arm covers Divine Office show episodes of any hour reached as episodes, whose titles name the hour.
   Non-office externals (Saint of the Day, USCCB readings, TV Mass, Gospel Exegesis, Bible in a Year, homilies) must never match: their sources are not office sources and their slot ids are not in the set — both the (b) and (c) arms exclude them by construction, and (a) already does.
2. **`openRead`:** the widget branch keys on `lohOffice676(t)`. The `plainText675` opt-out is **RETIRED** — the option is ignored: an office descriptor paints the widget even if `plainText675` is passed. Non-office descriptors take the byte-identical standing fetch path.
3. **Track-page branch** (`trackPagePaintDay643`): the office test widens from `lohOffice675(d)` to `lohOffice676(d)`; everything else about the v675 track-page behavior stands unchanged (header in `headHtml`, `descText` suppressed for office, wired widget body in `afterPaint`, no `textUrl` fetch on the office branch).
4. **Player visibility** (`updateNowPlaying`): the Read button STANDS (visibility cleared, `aria-hidden` removed) where `lohOffice676(cur)` or `lohOffice676(rt)` — `cur = state.current`, `rt = state.readTracks[cur.episodeId]` — **in addition to** the standing text test (`rt && rt.hasText && rt.textUrl`). Non-office tracks: the standing test alone, unchanged. The v419 held-slot discipline stands: a track that passes no test leaves the button invisible in its box.
5. **Player click** (`#np-read`): resolve the descriptor as `t = ` the `readTracks` entry `|| state.current`; where `lohOffice676(t)` or `lohOffice676(state.current)`, call `openRead` with the matching descriptor (prefer the one that satisfies the predicate; `state.current` is the playing descriptor and carries the office identity in the screenshot case) and return — the widget branch fires. Otherwise the standing behavior exactly: `t && t.hasText && t.textUrl` → `openRead(t)` with **no** opt-out argument.
6. **Header/hour lines:** reuse `lohWidgetHead675` / `lohWidgetBody675` / `lohWidgetWire675` unchanged — Q3 A line "Text: Divine Office — the widget always shows today's Hours" · Q4 A line "Audio: Sing the Hours · Text: Divine Office (today)" where source is Sing the Hours · Q5 A note "Playing inside the frame is separate from the app player." · failure row "Text unavailable — open Divine Office", never a blank box. For episode descriptors the head's hour falls back to `t.title` (the standing fallback in `lohWidgetHead675`, §2.4) — named here so Review checks it rather than discovering it. Heading discipline stands: "Liturgy of the Hours"; "Divine Office" only as a source name.
7. **Pin:** `ora-pro-nobis-v676-1` at the standing pin seat in `ui.ts` (§2.6).

### Harness — app/worker/harness-v676.mjs
New, in the harness-v675 mold: the REAL built Worker bundle (esbuild from source) served locally, the API stubbed, playwright-core Chromium, real acts, same-tick DOM assertions; `ORA_WT` selects the tree for the fail-on-old run.
Fixtures (Improvement D — production shapes, sources named):
- Office slot fixtures shaped exactly as harness-v675's `officeFx` (the `extSlotTrack` shape: `episodeId` = slot id, kind 'external', source standing, `hasText` false, `textUrl` null, provider `descText`): Morning Prayer × Sing the Hours (**the screenshot case — first**) and × Divine Office; Evening Prayer × both sources.
- One other-hour Divine Office **episode** descriptor (episode-shaped: `episodeId` NOT a slot id, source 'Divine Office', title naming the hour — e.g. Office of Readings — `hasText` false, `textUrl` null).
- Controls: a non-office external (`ext-saint-of-the-day`, source 'Good Catholic') and an own podcast episode with `hasText`/`textUrl`.
Legs:
- P1–P4 (player, the four slot fixtures): set `state.current` + queue to the fixture, `openNowPlaying()` — assert `#np-read` is VISIBLE (visibility not hidden, no `aria-hidden`) — CLICK `#np-read` — assert a `.readsheet` stands carrying an iframe with src exactly `https://divineoffice.org/widget` and the header lines (heading · Q3 line · Q5 note; the Q4 line on the Sing the Hours fixtures).
- P5 (the episode fixture): same drive — Read stands, click paints the widget sheet.
- P6 (failure path): on the screenshot fixture, past the wire's bound the "Text unavailable — open Divine Office" row stands in the Read sheet and no blank frame block remains (the sandbox cannot load the live frame — established in v675).
- P7 (opt-out retired): `openRead(office fixture, { plainText675: true })` paints the widget branch (iframe stands) — the v675 R2 assertion inverted.
- C1 (non-office external in the player): `#np-read` stays hidden; no sheet on click attempt (the button is `visibility:hidden` — assert the hidden state, and that `openRead` was not reached with a widget).
- C2 (own podcast episode with text in the player): Read stands via the standing test; click paints the PLAIN text path (fetched text stands, no iframe).
- T-legs: the v675 track-page assertions re-run by including harness-v675 unchanged as a regression (the Implement record runs it) — v676's own harness covers the player + `openRead` legs.
- Fail-on-old: harness-v676 run against the v675 tree (`ORA_WT` at base 98262df) — P1–P5 and P7 fail; C1, C2 pass.

## §4 Gates (Review judges, with its own runs)
(a) Diff scope = `client.ts` + `ui.ts` pin + `harness-v676.mjs` + this release doc, nothing else.
(b) harness-v676 green on the built tree + harness-v675 still 47/0.
(c) Fail-on-old demonstrated: harness-v676 on base 98262df — P1–P5 and P7 fail; C1, C2 pass.
(d) Predicate audit: the three arms of `lohOffice676` named in the code as in §3.1; non-office slots/sources excluded (Saint of the Day, USCCB readings, TV Mass, Gospel Exegesis, Bible in a Year, homilies named and shown not to match any arm).
(e) Player geometry: the Read slot held (visibility discipline) for non-office, stands for office; bottom-row order unchanged (Intentions · Read · Star · Share · ⋮ · Queue).
(f) Header wording byte-exact per v675 (Q3 A · Q4 A · Q5 A lines; heading "Liturgy of the Hours"; "Divine Office" only as a source name; the episode-descriptor hour falls back to `t.title`).
(g) Failure path in the player-opened sheet: past the wire's bound the "Text unavailable — open Divine Office" row stands; never a blank box.
(h) Frame integrity: src exactly `https://divineoffice.org/widget`, no sandbox attribute, no interception, no interior styling anywhere in the diff.

## §5 Sequencing + ship discipline
- Implement (holder chain-v676-implement, its own contract) builds §3 + the harness on branch release/v676 in the v676 worktree, commits incrementally, and writes §6 of this doc.
- Review (holder chain-v676-review, its own contract) judges §4 with its own runs and reads, and writes §7.
- Ship (holder chain-v676, its own contract) writes §8, the Ship record:
  1. Merge release/v676 → main, tree-exact via the Git Data API: every blob/tree SHA for the touched paths asserted against the Review-judged tree; reconcile any runner commits on remote main first; no force-push, nothing dropped. Build branches stay local and are deleted after the merge (push-to-main rule); the read-back reads "main pushed · remote in sync."
  2. Deploy driver modeled on `~/workspace/.tools/deploy-app-v675-ship.py`, with EXPECTED_HEAD filled at ship time to the merged main head; deployments → dry-run → deploy. Deploy lands pin **ora-pro-nobis-v676-1**; capture the new Worker version id at deploy.
  3. Harness re-run at the merged tree (harness-v676 green; harness-v675 still 47/0).
  4. Production verification: the served pin reads `ora-pro-nobis-v676-1` and the served app.js carries the widget markers (`lohOffice676`, `divineoffice.org/widget`).
  5. Board closeout (each written and read back): Ship phase record passed · the release row Live + `shipped_at` + `whats_new_id` · the What's New entry · a `shipped_records` row inserted + read back · all v676 contracts met · Goals Board intake 1282 → Done/CLOSED.
  6. No APK (web-build only). No migration. No index.ts change.
- What's New draft: "Read the Hours while they play: the player now carries a Read button for Morning and Evening Prayer — and every Divine Office hour — opening the day's Liturgy of the Hours as text from Divine Office, on Sing the Hours tracks too."
- Rollback: redeploy pin `ora-pro-nobis-v675-1` (Worker d42fa21c-e0a3-4c19-8e4c-022a86c786f6) — the v675 driver (`~/workspace/.tools/deploy-app-v675-ship.py`) and its EXPECTED_HEAD stand untouched.
- Field check (John, on the shipped build — the live-frame proof the sandbox cannot give): open Morning Prayer (Sing the Hours) in the player → Read stands in the bottom row → tap → the widget sheet: the app header (Liturgy of the Hours · Morning Prayer · "Text: Divine Office — the widget always shows today's Hours" · "Audio: Sing the Hours · Text: Divine Office (today)" · "Playing inside the frame is separate from the app player.") over the LIVE Divine Office widget carrying today's Hours, loading and scrolling inside the app; repeat on another hour (e.g. Office of Readings reached as an episode) → Read stands and the widget paints; a frame that cannot load shows the "Text unavailable — open Divine Office" row, never a blank box.

## §6 Implement record (Implement agent, chain-v676-implement, contract 1122, 2026-11-25)

Built on branch `release/v676` in the v676 worktree (base 98262df + Plan d62348b). Commits: `dbee1dc` (build) · `5fd1f2f` (harness) · this doc commit.

### Files changed, in substance
- `app/worker/src/client.ts`:
  - §3.1 — new predicate `lohOffice676(t)` directly beside `lohOffice675`, with the three arms named in its comment: (a) `lohOffice675(t)`; (b) `t.slotId` in `LOH_OFFICE_SLOTS_675`; (c) `t.source` is 'Divine Office' or 'Sing the Hours' AND `t.title` contains one of the eight hour names (`LOH_OFFICE_HOURS_676`: Invitatory · Office of Readings · Morning Prayer · Midmorning Prayer · Midday Prayer · Midafternoon Prayer · Evening Prayer · Night Prayer). Non-office sources/slots match no arm by construction.
  - §3.2 — `openRead`: the widget branch now keys on `lohOffice676(t)`; the `plainText675` opt-out is retired (the option is ignored entirely; the branch comment states this). The non-office fetch path is untouched.
  - §3.3 — `trackPagePaintDay643`: the office test widened `lohOffice675(d)` → `lohOffice676(d)` (local var name `office675` kept); everything else unchanged.
  - §3.4 — `updateNowPlaying`: the Read button stands where `(rt && rt.hasText && rt.textUrl) || lohOffice676(cur) || lohOffice676(rt)`; the held-slot visibility discipline is otherwise unchanged.
  - §3.5 — `#np-read` click: `t = (state.current && state.readTracks[state.current.episodeId]) || state.current`; where `lohOffice676(state.current) || lohOffice676(t)`, calls `openRead(state.current)` when `state.current` satisfies the predicate, else `openRead(t)`, with NO opts, and returns. Otherwise the standing behavior: `t && t.hasText && t.textUrl` → `openRead(t)` with no opt-out argument.
  - `lohWidgetHead675` / `lohWidgetBody675` / `lohWidgetWire675` reused unchanged (§3.6). No new apostrophes were introduced into the client template literal (the §6/v675 `&rsquo;` rule did not bite; the harness's first run showed no page SyntaxError).
- `app/worker/src/ui.ts`: pin `ora-pro-nobis-v675-1` → `ora-pro-nobis-v676-1` at the standing pin seat (§3.7).
- `app/worker/harness-v676.mjs`: NEW, in the harness-v675 mold (real esbuild Worker bundle served locally, API stubbed, playwright-core Chromium, real acts, `ORA_WT` tree selector). Fixtures exactly as harness-v675's `officeFx`, plus the episode-shaped Divine Office Office of Readings descriptor (feed-shaped episodeId, kind 'podcast'). Legs P1–P7 + C1/C2 + the F pin check for `ora-pro-nobis-v676-1`.

### Harness tallies
- **harness-v676 on the built tree: 50 ok / 0 bad.** P1 (Morning × Sing the Hours, the screenshot case) first; P1–P5 assert `#np-read` visible (visibility cleared, no `aria-hidden`) with `state.readTracks = {}`, click → `.readsheet` with iframe src exactly `https://divineoffice.org/widget` (no sandbox) + header lines (heading · Q3 · Q5; Q4 on the Sing the Hours fixtures, absent on Divine Office fixtures). P6: past the wire's bound the "Text unavailable — open Divine Office" row stands and no iframe remains (40s bounded poll). P7: `openRead(office, { plainText675: true })` paints the widget anyway. C1: saint external — `#np-read` stays hidden, click opens no sheet. C2: own text episode — Read stands, click paints the plain fetched text, no iframe.
- **harness-v675 regression on the built tree: 44 ok / 3 bad — the 3 failures are v676's own designed changes, NOT regressions, and harness-v675 was NOT edited:**
  - **R2 — the designed inversion named in the Implement brief:** v675's R2 asserts `openRead(office, {plainText675:true})` takes the PLAIN path; v676 §3.2 retires that opt-out, so the widget branch paints. Expected failure by design.
  - **P1 — the same designed inversion on the player leg:** v675's P1 asserts the player's `#np-read` paints the PLAIN Read view under the §3.4 opt-out; v676 §3.5 reverses that boundary for office tracks, so the click now paints the widget. Expected failure by design, same class as R2.
  - **F — pin superseded:** v675's F check accepts only pins `v675-1|v673-1`; the built tree correctly serves `ora-pro-nobis-v676-1`. Expected on the new tree.
  - All other v675 legs (T1–T5 track-page widget paint + failure path, R1, R3, C1) pass unchanged: 44 ok.
- **Fail-on-old (harness-v676, `ORA_WT` at a scratch worktree of base 98262df, TMPDIR redirected under `~/workspace/.scratch`; scratch removed after): 10 ok / 40 bad.** P1–P5 fail (every sub-check: `#np-read` held hidden, no sheet), P7 fails (old tree takes the plain path under the opt-out), P6 fails with them (no Read sheet exists on the old tree to carry the failure row), and the F pin check fails (old tree serves the v675 pin). C1 and C2 pass on the old tree, as required.

### Deviations
- One harness-only correction during the build, named: the first harness-v676 run failed P6's "no iframe remains" check because the sheet-state probe counted the widget body's HIDDEN fallback row (present from the start, anchor included) as the standing failure row, so the poll exited before the wire's bound. The probe now counts the failure row only when it is not `hidden` — the same test harness-v675's `pageState` makes. No app code was changed for this; the re-run is 50/0.
- No other deviations. Diff scope is exactly `client.ts` + `ui.ts` pin + `harness-v676.mjs` + this doc (§4 gate (a)). No deploy, no merge, no board writes.

## §7 Review record (Review agent, chain-v676-review, contract 1123, 2026-11-25)

Judged on the built tree at `018ce33` (base `98262df`) with Review's own runs and reads. Gate (b) judged as amended by the Coordinator (the Plan's "harness-v675 still 47/0" text is superseded by the amended expectation: 44 ok / 3 bad with the failures exactly v675 R2 · v675 P1 · v675 F).

### Review's own runs
- **harness-v676 on the built tree: 50 ok / 0 bad.** P1 (Morning Prayer × Sing the Hours, the screenshot case) first and green; P6's failure row stood past the wire's bound with no iframe remaining.
- **harness-v675 on the built tree: 44 ok / 3 bad.** The 3 failures are exactly the amended set, each verified from the failure output: **F** (served pin is `ora-pro-nobis-v676-1`, outside the v675/v673 pin check) · **R2** (`openRead(office, {plainText675:true})` paints the widget — iframe src `https://divineoffice.org/widget` in the failure payload — where v675 asserted the plain path; the §3.2 retirement by design) · **P1** (the player `#np-read` click paints the widget where v675 asserted the §3.4 plain-path opt-out; the §3.5 reversal by design). No other v675 failure — no regression.
- **Fail-on-old (harness-v676, `ORA_WT` at a scratch worktree of base `98262df` under `~/workspace/.scratch`, TMPDIR redirected there; scratch removed after): 10 ok / 40 bad.** P1–P5 fail on every substantive sub-check (`#np-read` held hidden, no sheet, no header), P7 fails (old tree takes the plain path under the opt-out), P6's failure-row check fails with them (no Read sheet exists on the old tree), and the F pin check fails (old tree serves the v675 pin). C1 and C2 pass on the old tree, as required. Matches Implement's tally exactly.

### Per-gate verdicts
- **(a) Diff scope — PASS.** `git diff 98262df..018ce33 --stat`: `app/worker/src/client.ts` · `app/worker/src/ui.ts` (pin only) · `app/worker/harness-v676.mjs` (new) · this release doc. Nothing else.
- **(b) Harnesses — PASS (as amended).** harness-v676 50 ok / 0 bad on the built tree; harness-v675 44 ok / 3 bad with the failures exactly R2 · P1 · F, each a designed v676 change (§3.2 opt-out retirement · §3.5 player reversal · §3.7 pin), named above. No other failure.
- **(c) Fail-on-old — PASS.** 10 ok / 40 bad on base `98262df`; P1–P5 and P7 fail, C1 and C2 pass (tally and shape above).
- **(d) Predicate audit — PASS.** `lohOffice676` in the code carries the three arms as §3.1, with the arms named in its comment: (a) `lohOffice675(t)` (slot identity on `episodeId`); (b) `t.slotId` in `LOH_OFFICE_SLOTS_675` — inert-but-additive per Plan §2.5 (no standing builder puts `slotId` on a descriptor; set membership is required, so it cannot false-positive); (c) `t.source` is 'Divine Office' or 'Sing the Hours' AND `t.title` contains one of the eight hour names in `LOH_OFFICE_HOURS_676`. The seven non-office external slots match no arm: `ext-saint-of-the-day` (source 'Good Catholic') · `ext-usccb-readings` · `ext-daily-tv-mass` · `ext-fr-mike-homily` · `ext-barron-sermon` · `ext-gospel-exegesis` (source 'Logical Bible Study') · `ext-bible-in-a-year` (source 'Bible in a Year') — none of their slot ids is in the eight-slot set (arms a/b fail) and none of their sources is an office source (arm c fails on its source conjunct, before any title test).
- **(e) Player geometry — PASS.** The bottom-row markup is untouched by the diff and reads Intentions · Read · Star · Share · ⋮ · Queue in that order. `updateNowPlaying` stands the button where `(rt && rt.hasText && rt.textUrl) || lohOffice676(cur) || lohOffice676(rt)` and otherwise holds the slot at `visibility:hidden` + `aria-hidden` — the v419 held-slot discipline unchanged for non-office tracks (proven live by C1: saint external stays hidden, click opens no sheet; C2: own text episode stands via the standing test alone and paints plain text).
- **(f) Header wording — PASS.** `lohWidgetHead675` / `lohWidgetBody675` / `lohWidgetWire675` are untouched by the diff, so the wording is byte-identical to v675: heading "Liturgy of the Hours" · Q3 line "Text: Divine Office — the widget always shows today's Hours" · Q4 line "Audio: Sing the Hours · Text: Divine Office (today)" only where source is Sing the Hours (asserted present on P1/P3, absent on P2/P4/P5) · Q5 note "Playing inside the frame is separate from the app player." "Divine Office" stands only as a source name in these lines. The episode-descriptor hour falls back to `t.title`: P5's sheet carries "Office of Readings" from the fixture's title, no EXT_SLOTS def matching its feed-shaped episodeId.
- **(g) Failure path in the player-opened sheet — PASS.** Review's own P6 run: on the screenshot fixture, past the wire's bound the "Text unavailable — open Divine Office" row stands in the player-opened Read sheet (link `https://divineoffice.org`) and no iframe remains — never a blank box.
- **(h) Frame integrity — PASS.** `lohWidgetBody675` (unchanged) emits `<iframe src="https://divineoffice.org/widget">` exactly — Review's harness runs assert the served sheet's iframe src equals that string and its `sandbox` attribute is null on P1–P5. The diff contains no sandbox attribute, no src rewriting, no interception, and no interior styling.

### Screenshot-case coverage — verified genuine
Harness P1's fixture is the Morning Prayer × Sing the Hours `extSlotTrack` shape (`episodeId` `ext-morning-prayer`, kind 'external', `hasText` false, `textUrl` null, provider `descText`), and the player legs set `state.readTracks = {}` — the composed-track shape, no readTracks entry. The sheet is painted by the `#np-read` CLICK (`btn.click()` in the harness driver), not by a direct `openRead` call; P7 is the only direct-`openRead` leg and is labeled as such.

### Opt-out retirement — verified
Grep of the whole built `client.ts` for `plainText675`: the only occurrences are the §3.2 retirement comment at the `openRead` branch. No caller passes `plainText675` anywhere; the branch keys on `lohOffice676(t)` alone and ignores the option.

### Overall verdict: **PASS**
All §4 gates (a)–(h) pass on Review's own runs and reads, with gate (b) judged under the Coordinator's amended expectation. No code fixes made by Review; no deploy, no merge, no board writes. Cleared for Ship per §5.

## §8 Ship record (chain-v676, 2026-11-26) — LIVE

John's field report lifted the fix-forward To Ship (Ora thread, 2026-11-25 19:02–19:04 CT). Ship contract 1124 (holder chain-v676) · Ship phase record 2802.

- **Merge:** release/v676 → main in the standing clone, tree-exact via the Git Data API (push-v676-github.py). Local merge e5c640d over v675 main 98262df; code paths (client.ts · ui.ts · harness-v676.mjs) asserted blob-identical to the Review-judged tree 24a923c before anything moved; remote-vs-base delta empty (no runner commits to reconcile, nothing dropped, no force-push). Remote ship commit **4f09c66**, tree **36a3cd9**; local mirror 3dcef3b, same tree. Read-back: **main pushed · remote in sync**.
- **Harness at the merged tree:** `harness-v676: 50 ok, 0 bad` (standing clone, merged main) — matches the built-tree tally.
- **Deploy:** deploy-app-v676-ship.py with EXPECTED_HEAD filled to the merged main head (3dcef3b); deployments → dry-run → deploy all clean. Worker **4746a200-c7b8-462d-b885-8c75763888a7**, pin **ora-pro-nobis-v676-1**. Production verification: the served sw.js reads pin ora-pro-nobis-v676-1; the served app.js carries the v676 branch (lohOffice676 ×7 · divineoffice.org/widget ×2). No APK, no migration, no index.ts change.
- **Board closeout (D1-direct, read back through the door):** release 1654 → Live, shipped_at 2026-11-26T01:21:00Z, whats_new_id 491 · What's New **491** ("Read the Hours while they play") · shipped_records **865** · Ship phase record 2802 passed · all v676 contracts (1121/1122/1123/1124) stand met, all five phase records passed. Goals Board intake 1282 → Done, state line CLOSED.
- **Rollback:** pin ora-pro-nobis-v675-1 (Worker d42fa21c-e0a3-4c19-8e4c-022a86c786f6), v675 driver untouched.
- **Field check (John, standing open):** open Morning Prayer (Sing the Hours) in the player → the Read button stands in the bottom row (Intentions · Read · Star · Share · ⋮ · Queue) → tap it → the widget sheet: the app header (Liturgy of the Hours · Morning Prayer · the track's date · "Text: Divine Office — the widget always shows today's Hours" · "Audio: Sing the Hours · Text: Divine Office (today)") over the LIVE Divine Office widget. Repeat on any other Divine Office hour (Office of Readings, Night Prayer, …) — Read stands there too. A frame that cannot load shows the "Text unavailable — open Divine Office" row, never a blank box.
