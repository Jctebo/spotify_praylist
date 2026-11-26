# v675 — LOH Widget on Track Pages

## §1 Scope (approved 2026-11-25 18:15 CT, run level: Stop before Ship)

John's decision (2026-11-25 18:04 CT, verbatim): "Let's use the official widget and just attached to all loh pages (even sing the hours)". Approval: Q1 A · Q2 A · Q3 A · Q4 A · Q5 A · run level **Stop before Ship** (John's pick stands; the chain runs Plan → Implement → Review and STOPS with a ship packet — no deploy, no merge, no Live flip).

- Q1 A: the widget endpoint is `https://divineoffice.org/widget`, exactly as offered.
- Q2 A: for Liturgy of the Hours tracks, the Read view's body IS the widget under the app's own header; the episode-text view is replaced for these tracks only.
- Q3 A: the widget attaches on every LOH page regardless of the track's date, with the standing header line "Text: Divine Office — the widget always shows today's Hours" and the track's own date named beside it.
- Q4 A: Sing the Hours pages attach exactly as Divine Office pages; the header names both: "Audio: Sing the Hours · Text: Divine Office (today)".
- Q5 A: the widget is accepted exactly as offered — no interception, no modification; the header area carries the note "Playing inside the frame is separate from the app player."
- OUT (standing): the player's bottom-row Read · non-LOH tracks · any change inside the frame · specific-date or specific-prayer deep links · offline caching of the text · permission letters.
- Heading discipline (v672): headings read "Liturgy of the Hours"; "Divine Office" stands only where it names the source.

## §2 Plan grounding (coordinator, chain-v675, 2026-11-25 — firsthand code read on the v675 worktree, base 88b28a3, the v673 ship tree)

### §2.1 The Read view and its callers
- `openRead(t)` (client.ts:18056) is the one Read view: a tall sheet carrying the track title, a play control on the same descriptor, and a `.readtext` body filled by `fetch(t.textUrl)`; a failed fetch paints the body empty (v630).
- Callers: the `[data-read]` seats (Favorites 13944 · day-card paints 18808, 20958 · Prayers home 23002), each resolving `state.readTracks[...]`; and the Now Playing `#np-read` handler (18195–18197), which gates on `t.hasText && t.textUrl`.

### §2.2 Office tracks carry no Read control today — the track page's text seat is the surface
- `extSlotTrack` (18626) builds every external descriptor with `hasText: false, textUrl: null`. The row paint's external branch (17967) therefore stands with NO Read control ("externals carry no text", v324 §2.9), the episode card carries Play/Star/Mark only, and `#np-read` is held hidden for a playing office track (18289–18291).
- The v643 track page is the one place an office track's text seat stands: `trackPagePaintDay643` (17448) paints the slot record's `descText` (the provider's episode blurb) into `#track-text-643` and fetches `textUrl` in `afterPaint` where one stands. That text seat is the "episode-text view" Q2 A replaces for office tracks. `openTrackPage643` (17369) carries the `headHtml` seat directly above `#track-text-643`.
- Reading of the approved shape, named plainly: the track page's text seat becomes the widget (header lines in `headHtml`, the frame in the text block). The `openRead` branch (§3.3) is the guard seat: any Read act that reaches an office descriptor paints the widget — except the player caller, which opts out explicitly (§3.4). No new Read control is added to any row (not approved; not in the package).

### §2.3 Office identity — keyed on the slot, never the audio source
- An external office descriptor's `episodeId` IS its slot id (`extSlotTrack`: `episodeId: slot.slotId`). A composed office descriptor likewise carries `episodeId` = the slot id with `source` standing and `kind` absent (v655 §2.3, read at `epCardIsEpisode` 10804–10821).
- The office slot set stands in the EXT_SLOTS defs (18381–18391) — the eight Divine Office hour slots: `ext-invitatory` · `ext-morning-prayer` · `ext-midmorning-prayer` · `ext-midday-prayer` · `ext-midafternoon-prayer` · `ext-office-of-readings` · `ext-evening-prayer` · `ext-night-prayer`. Sing the Hours fills only the two labeled slots (`opnLabeledSlot650`, 2316: ext-morning-prayer / ext-evening-prayer) as the fallback side; its descriptors carry the same slot `episodeId` with `source` 'Sing the Hours' (seed, 2771; the backup-side build in `trackPageDaySelect643`, 17424–17446).
- Non-office external slots — `ext-saint-of-the-day`, `ext-usccb-readings`, `ext-daily-tv-mass`, `ext-gospel-exegesis`, `ext-bible-in-a-year`, `ext-fr-mike-homily`, `ext-barron-sermon` — are NOT office and never match.
- `shareSrcOk643` (17342): the standing office source labels are 'Divine Office' and 'Sing the Hours'. The header reads `source` ONLY to label whose audio/text stands (Q4 A); identity never keys on it — a Sing the Hours descriptor matches because its `episodeId` is the office slot.

### §2.4 Dates
- The track page knows the track's own date: the landing `L.date` reaches `trackPagePaintDay643(L, d)`. The Read view's tracks belong to the presented day (`presentedDateStr()`). The header names that date; the frame always shows today (Q3 A line says so).

## §3 The build (client.ts only + the pin)

1. **Predicate** `lohOffice675(t)`: true iff `t` stands and `t.episodeId` is in the eight-slot office set of §2.3 (a literal set in code, commented as drawn from the EXT_SLOTS defs). Nothing else matches — no source test, no kind test, no title test.
2. **Shared builders:**
   - `lohWidgetHead675(t, dateStr)` → the header lines HTML: "Liturgy of the Hours" · the hour (the EXT_SLOTS def title for the slot, falling back to `t.title`) · the track's own date (formatted from `dateStr`) · "Text: Divine Office — the widget always shows today's Hours" · where `t.source === 'Sing the Hours'`: "Audio: Sing the Hours · Text: Divine Office (today)" · "Playing inside the frame is separate from the app player."
   - `lohWidgetBody675()` → the frame block: a loading line ("Loading today's Hours…") + `<iframe src="https://divineoffice.org/widget">` (the Q1 A URL, exactly; no sandbox attribute, no src rewriting) + the fallback row, hidden.
   - `lohWidgetWire675(root)` → the frame's wiring: the frame's `load` event clears the loading line; a 6-second timer with no `load` (or an `error` event) replaces the frame block with the failure row: "Text unavailable — open Divine Office", linking to `https://divineoffice.org` (target `_blank`, rel `noopener`). Never a blank box; the loading line stands until one of the two lands.
3. **Read-view branch:** `openRead(t, opts)` gains an optional second argument. Where `lohOffice675(t)` stands and `opts.plainText675` does not: the sheet paints exactly as today (title, the same-descriptor play control, `markPlaying`, `updateDock`) but the sub carries `lohWidgetHead675(t, presentedDateStr())` and the `.readtext` body carries `lohWidgetBody675()`, wired by `lohWidgetWire675`. NO `textUrl` fetch runs on this branch. Every non-office descriptor takes the byte-identical standing path.
4. **Player opt-out:** the `#np-read` handler (18195) calls `openRead(t, { plainText675: true })`. The player's bottom-row Read stays on the plain-text path for every track, office included — the scope OUT boundary made explicit and permanent at the caller.
5. **Track-page branch:** in `trackPagePaintDay643`, where `lohOffice675(d)` stands: `headHtml` = `lohWidgetHead675(d, L.date)`; `textHtml` = '' (the `descText` blurb does NOT paint — replaced, per Q2 A); `afterPaint` sets `#track-text-643`'s content to `lohWidgetBody675()` and wires it with `lohWidgetWire675` (the standing `textUrl` fetch does not run). Non-office day tracks: byte-identical. The pod/prayer/homily pages (the other `openTrackPage643` callers) never pass through `trackPagePaintDay643` and are untouched.
6. **Frame sizing:** in the standing style seat (the `.readtext` rules' home): `.lohframe675 iframe { width: 100%; height: 68vh; border: 0; display: block; }`, the loading/failure rows dressed from standing classes. No frame-interior styling (impossible cross-origin, and out of scope).
7. **Pin:** `ora-pro-nobis-v675-1` (the standing pin seat, bumped in the build so Review judges the exact tree the packet would ship).

### Harness — app/worker/harness-v675.mjs
The v673/v668 mold: the REAL built Worker bundle (esbuild from source) served locally, the API stubbed, driven Chromium, real acts, same-tick DOM assertions; `ORA_WT` selects the tree for the fail-on-old run.
Fixtures (Improvement D — production shapes, sources named):
- Morning Prayer · Divine Office — a descriptor as `extSlotTrack` builds it from the standing slot def (18382) over a present Divine Office record: episodeId `ext-morning-prayer`, kind 'external', source 'Divine Office', hasText false, a provider-shaped descText.
- Morning Prayer · Sing the Hours — the backup-side descriptor as `trackPageDaySelect643` builds it through `extSlotTrack`: source 'Sing the Hours', same slot id.
- Evening Prayer × both sources, likewise (`ext-evening-prayer`).
- Controls: an own Ora episode descriptor with hasText/textUrl (the plain Read path) and a non-office external (`ext-saint-of-the-day`).
Legs:
- T1–T4: the track page paints for the four office fixtures (through the real landing paint) — assert the header lines stand (heading · hour · the track's date · the Q3 A text line; the Sing the Hours fixtures also carry the Q4 A Audio/Text line and the Q5 A note), assert `#track-text-643` holds an iframe whose src is exactly `https://divineoffice.org/widget`, assert the fixture's descText does NOT paint.
- T5: the failure path — the live frame cannot load from this sandbox (network tunnel failure, established), so past the 6-second bound assert the "Text unavailable — open Divine Office" row stands and no blank frame block remains; before the bound, assert the loading line stands.
- R1: `openRead(office descriptor)` → the widget branch: iframe + header lines in the sheet; no textUrl fetch issued.
- R2: `openRead(office descriptor, { plainText675: true })` → the plain path: no iframe.
- R3: `openRead(control own descriptor)` → the standing plain-text path, text painted from its fetch.
- P1: the player seat driven live — Now Playing standing on an office descriptor whose readTracks entry is stubbed text-carrying (the only shape in which the seat can fire at all): tap `#np-read` → the PLAIN Read view paints, no iframe (the §3.4 opt-out, driven, not just read).
- C1: the non-office external control's track page paints byte-identical to base (descText stands, no frame).
- Fail-on-old: run against base 88b28a3 — T1–T5 and R1 fail (no widget seats exist); R3, C1 pass.

## §4 Gates (Review judges, with its own runs)
(a) Diff scope: client.ts + the pin + app/worker/harness-v675.mjs + this doc — nothing else.
(b) Harness green on the built tree; the fail-on-old run demonstrated (office legs fail on base, controls pass).
(c) Predicate audit: the branch keys on slot ids only; the seven non-office external slots excluded by name; composed office descriptors (kind absent, source standing) match.
(d) Player boundary: the `#np-read` opt-out stands at the caller; Now Playing paint otherwise unchanged (P1 driven).
(e) Header wording exact per Q3 A / Q4 A / Q5 A; heading discipline — "Divine Office" appears only as a source name, never as a heading.
(f) Failure path: blocked frame → the fallback row inside the bound, never a blank box; the loading line precedes it.
(g) Non-office paints unchanged: control legs green + a spot diff of the non-office paths in `openRead` and `trackPagePaintDay643`.
(h) Frame integrity: src is exactly the Q1 A URL; no sandbox attribute, no interception, no interior styling anywhere in the diff.

## §5 Sequencing + ship discipline
- Implement (holder chain-v675-implement, its own contract) builds §3 + the harness on branch release/v675 in the v675 worktree, commits incrementally, and writes §6 of this doc.
- Review (holder chain-v675-review, its own contract) judges §4 with its own runs and writes §7.
- **STOP.** The coordinator then writes §8, the ship packet: the merge plan (release/v675 → main, tree-exact via the Git Data API, the standing shape), a deploy driver at ~/workspace/.tools/deploy-app-v675-ship.py modeled on the v673 driver, the pin ora-pro-nobis-v675-1, a What's New draft, the rollback (pin ora-pro-nobis-v673-1 · Worker 4b9b6e7b), and the exact field check for John's phone. NO deploy, NO merge, NO Live flip in this chain — the ship waits for John's word at the Stop.
- Field check (John, on the shipped build, named now so the Stop carries it): open the Morning Prayer track page from its share link → the text seat shows the app header (Liturgy of the Hours · Morning Prayer · the track's date · "Text: Divine Office — the widget always shows today's Hours") over the LIVE Divine Office widget carrying today's Hours, loading and scrolling inside the app; repeat on a Sing the Hours Evening Prayer page → the header also names "Audio: Sing the Hours · Text: Divine Office (today)"; confirm the app player and the frame never sound together unless play is tapped inside the frame.

## §6 Implement record (chain-v675-implement, contract 1117, 2026-11-25)

Built §3 exactly, on branch release/v675 in the v675 worktree (base 88b28a3). No deploy, no merge, no board writes — run level Stop before Ship stands.

### Files changed (in substance)
- `app/worker/src/client.ts`:
  - §3.1 predicate `lohOffice675(t)` — the literal eight-slot set drawn from the EXT_SLOTS defs; slot identity only (no source/kind/title test).
  - §3.2 builders `lohWidgetHead675(t, dateStr)` (heading "Liturgy of the Hours" · hour from the EXT_SLOTS def title, fallback `t.title` · the track's own date via the standing `homilyLongDate` · the Q3 A text line · the Q4 A "Audio: Sing the Hours · Text: Divine Office (today)" line only where `t.source === 'Sing the Hours'` · the Q5 A note), `lohWidgetBody675()` (loading line "Loading today's Hours…" + iframe src exactly `https://divineoffice.org/widget`, no sandbox attribute + hidden fallback row), `lohWidgetWire675(root)` (see the deviation below).
  - §3.3 `openRead(t, opts)` — optional second argument; office descriptor without `opts.plainText675` paints the sheet as today (title, same-descriptor play control, `markPlaying`, `updateDock`) with the sub carrying `lohWidgetHead675(t, presentedDateStr())` and the `.readtext` body carrying the wired widget; no `textUrl` fetch on this branch. Non-office path byte-identical.
  - §3.4 the `#np-read` handler calls `openRead(t, { plainText675: true })`; nothing else in the player changed.
  - §3.5 `trackPagePaintDay643` — office descriptor: `headHtml = lohWidgetHead675(d, L.date)`, `textHtml = ''` (descText does not paint), `afterPaint` sets `#track-text-643` to `lohWidgetBody675()` and wires it; no `textUrl` fetch. Non-office day tracks byte-identical; pod/prayer/homily callers untouched.
- `app/worker/src/ui.ts`: §3.6 `.lohframe675 iframe { width:100%; height:68vh; border:0; display:block; }` beside the `.readtext` rule (the standing style seat); §3.7 pin bumped to `ora-pro-nobis-v675-1` at the standing pin seat (`CACHE`).
- `app/worker/harness-v675.mjs`: new, in the harness-v673 mold (real esbuild Worker bundle served locally, API stubbed, playwright-core Chromium, real acts, same-tick DOM assertions, `ORA_WT` tree selector).

### Commits
- 4506a89 — predicate + builders (§3.1–3.2)
- 8d7dee3 — track-page + openRead branches, player opt-out, frame CSS, pin (§3.3–3.7)
- 444f67a — apostrophes via the `&rsquo;` entity (the APP_JS template-cooking rule: a `\'` escape inside the template literal cooks to a bare quote and breaks the served bundle — caught by the harness's first run as a page SyntaxError) + the harness
- e155e6b — harness sequencing fixes (standing re-present timers expire between paints; visibility-aware fallback read; bounded T5 poll)
- d2cb5ba — the wire probe refinement (deviation below)

### Harness tally (built tree, pin ora-pro-nobis-v675-1)
`harness-v675: 47 ok, 0 bad` — per leg: F fixture/pin checks 2/2 · T1–T4 track-page widget paint 9/9 each (header lines incl. Q3 A/Q5 A, Q4 A line present on the two Sing the Hours fixtures and absent on the two Divine Office fixtures, iframe src exact with no sandbox, descText absent) · T5 failure path 3/3 (loading line before the bound; fallback row stands past the bound with the `_blank`/`noopener` link to `https://divineoffice.org`; no iframe remains) · R1 2/2 (widget branch, no textUrl fetch — proven against a sentinel textUrl probe) · R2 1/1 (plainText675 → plain path) · R3 1/1 (control → standing text path) · P1 1/1 (Now Playing `#np-read` driven on a stubbed text-carrying office readTracks entry → PLAIN Read view, no iframe) · C1 1/1 (non-office ext track page: descText stands, no frame).

### Fail-on-old (base 88b28a3, scratch worktree, removed after)
`harness-v675: 17 ok, 30 bad` — every T1–T5 office assertion fails on base (the base page paints the provider descText, no widget seats exist) and R1 fails both assertions (the base `openRead` fetches the sentinel textUrl and paints plain text); the controls pass on base exactly as on the built tree: R2, R3, P1, C1 and the F checks. (Two early fail-on-old attempts died on sandbox resource exhaustion — /tmp is a 512 MB tmpfs filled by another tenant's venv; the successful run used a scratch worktree on the main disk with TMPDIR redirected. No bearing on the result.)

### Deviation (one, named)
- §3.2 wire, load decision: the Plan's literal wiring (frame `load` clears the loading line) cannot distinguish a real widget load from a failed navigation — Chromium fires the iframe `load` event for its own error page (measured in this sandbox: `load` at ~0.4 s while the host is unreachable, a no-cors fetch to the same URL rejected at ~0.2 s). Under the literal wiring, gate (f) fails: a blocked frame would stand as a browser error page with the loading line cleared and the fallback never landing. The built wire therefore decides a `load` by a no-cors fetch probe to the widget URL: resolved → load stands (loading clears, 6 s timer cancelled); rejected → the failure row replaces the block. The `error` event and the 6 s timer (which also bounds a hung probe) work exactly as specified, and on a reachable host the visible behavior is the specified one. Review is asked to judge this refinement against gate (f)'s "never a blank box" intent.
- No other deviations. Header wording, frame src, and pin are byte-exact per §3; the apostrophes in the Q3 A line and the loading line render via the estate's standing `&rsquo;` entity (the APP_JS template-cooking rule), text-identical when painted.

## §7 Review record (chain-v675-review, contract 1119, 2026-11-25)

Judged §4 with own runs and reads on the built tree at HEAD 04b7afe (base 88b28a3). No deploy, no merge, no board writes, no code fixes — run level Stop before Ship stands.

### Per-gate verdicts

- (a) Diff scope — PASS. Own `git diff --stat 88b28a3..HEAD`: exactly 4 files — `app/worker/src/client.ts`, `app/worker/src/ui.ts` (frame CSS + pin `ora-pro-nobis-v675-1`), `app/worker/harness-v675.mjs`, this doc. Nothing else.
- (b) Harness — PASS. Own run on the built tree: `harness-v675: 47 ok, 0 bad` (matches the §6 claim). Own fail-on-old run (scratch worktree at 88b28a3 under `~/workspace/.scratch/`, TMPDIR redirected there, `ORA_WT` pointed at it; scratch removed after): `harness-v675: 17 ok, 30 bad` (matches the §6 claim) — T1–T5 office legs and R1 fail on base; controls R2, R3, P1, C1 and the F checks pass on base.
- (c) Predicate audit — PASS. Own read of `lohOffice675`: returns true iff `t.episodeId` is in the literal eight-slot set (`ext-invitatory`, `ext-morning-prayer`, `ext-midmorning-prayer`, `ext-midday-prayer`, `ext-midafternoon-prayer`, `ext-office-of-readings`, `ext-evening-prayer`, `ext-night-prayer`). No source, kind, or title test, so composed office descriptors (kind absent, source standing, episodeId = slot id) match, and the seven non-office external slots (`ext-saint-of-the-day`, `ext-usccb-readings`, `ext-daily-tv-mass`, `ext-gospel-exegesis`, `ext-bible-in-a-year`, `ext-fr-mike-homily`, `ext-barron-sermon`) are excluded by non-membership. `t.source` is read only in `lohWidgetHead675` to paint the Q4 A audio line — labeling, not identity.
- (d) Player boundary — PASS. Own diff read: the `#np-read` handler is the only player change and it calls `openRead(t, { plainText675: true })`; Now Playing paint otherwise unchanged. Harness P1 drives the seat live on a stubbed text-carrying office entry and paints the PLAIN Read view with no iframe (built tree ok; also passes on base, where the plain path is the only path).
- (e) Header wording — PASS. Own read of `lohWidgetHead675` plus harness T1–T4 text assertions: heading is "Liturgy of the Hours"; Q3 A line stands exactly as "Text: Divine Office — the widget always shows today's Hours" (apostrophe via the standing `&rsquo;` entity, text-identical when painted); Q4 A line "Audio: Sing the Hours · Text: Divine Office (today)" stands only where `t.source === 'Sing the Hours'` (present T2/T4, absent T1/T3); Q5 A note "Playing inside the frame is separate from the app player." stands on all four. "Divine Office" appears in the diff only as a source name (header lines, fallback link text) — never as a heading.
- (f) Failure path + the named deviation — PASS, deviation ACCEPTED (judgment below). Own evidence: harness T5 on the built tree — loading line stands before the bound; past the 6 s bound the "Text unavailable — open Divine Office" row stands (link `https://divineoffice.org`, `_blank`, `noopener`) and no iframe remains. Own read of `lohWidgetWire675`: the `error` event and the 6 s timer work as specified; the timer also bounds a hung probe (a probe resolving after the timer fired is ignored via the `done` flag).
- (g) Non-office paints unchanged — PASS. Harness C1 green on the built tree and on base; R3 green. Own spot diff: in `openRead` the widget branch returns only for an office descriptor without `plainText675`; every other descriptor falls through to the unchanged standing fetch path. In `trackPagePaintDay643` the non-office path keeps the original `trackTextHtml643(d.descText)` text and the original `textUrl` `afterPaint` ternary, and passes `headHtml: undefined`, which the standing `(m.headHtml || '')` seat in `openTrackPage643` renders as '' — byte-identical paint.
- (h) Frame integrity — PASS. Own read: the iframe in `lohWidgetBody675` carries `src="https://divineoffice.org/widget"` exactly, no `sandbox` attribute (harness asserts `sandbox === null` on T1–T4), no src rewriting; the only CSS added is the outer sizing rule `.lohframe675 iframe { width:100%; height:68vh; border:0; display:block; }` — no interception and no frame-interior styling anywhere in the diff.

### Deviation judgment (§6, the wire probe)

- ACCEPTED. The literal §3.2 wiring cannot satisfy gate (f): Chromium fires the iframe `load` event for a failed navigation (its own error page), so a blocked frame would clear the loading line and stand as a browser error page with the fallback never landing — the exact "blank box" outcome gate (f) forbids. The built probe decides a `load` by reachability of the same widget URL: resolved → the frame stands; rejected → the failure row replaces the block within the bound. That satisfies gate (f)'s intent on both sides (blocked → fallback, never blank; reachable → frame stands), and the specified `error` + 6 s timer paths stand unchanged.
- Residual risks, named and accepted at this gate: (1) a no-cors probe resolves on any HTTP response, including an error status — a host that answers the probe but serves a broken widget page would stand as a frame showing that error page rather than the fallback row; (2) the converse — a transient probe rejection (or a service-worker/network difference between fetch and frame navigation) while the frame itself loaded would replace a working frame with the fallback row, which still offers the Divine Office link, so the failure mode degrades to the fallback, never to a blank box; (3) a synchronous probe throw is treated as success (`catch (e) { succeed675(); }`) — narrow, and the frame's own `load` already fired in that path. None of these can be settled further in this sandbox, where the live frame cannot load at all; the live-frame proof is John's §5 field check on the shipped build, which stands as the named next gate at the Stop. Acceptable at Stop before Ship.

### Overall verdict

- PASS — all gates (a)–(h) pass on own runs and reads; built tree 47 ok / 0 bad; fail-on-old 17 ok / 30 bad with the office legs failing and the controls passing, as specified. The chain stops here per the run level: no deploy, no merge, no Live flip. The coordinator's §8 ship packet and John's field check (§5) are the next steps, on John's word.

## §8 Ship packet (coordinator, chain-v675, 2026-11-25) — THE STOP

Run level was **Stop before Ship**. Review verdict: **PASS, all gates (a)–(h)** (§7, contract 1119), on the Review-judged tree **f826050** (release/v675 tip; code tree 04b7afe + doc-only §6/§7 commits). Harness evidence, independently re-run by Review: **47 ok / 0 bad** on the built tree; **fail-on-old 17 ok / 30 bad** on base 88b28a3 (every office leg fails on base; every control passes on both trees). The one deviation (the no-cors reachability probe in lohWidgetWire675) is ACCEPTED by Review with its residual risks named in §7; none of them is settleable in the sandbox — the live-frame proof is the field check below.

**Nothing has deployed, merged, or flipped Live. The ship waits for John's word.**

### Merge plan (on John's ship word)
1. Merge release/v675 → main in the standing clone (~/workspace/projects/ora-pro-nobis/standing-clone), tree-exact via the Git Data API: every blob/tree SHA for the touched paths (app/worker/src/client.ts · app/worker/src/ui.ts · app/worker/harness-v675.mjs · docs/releases/v675-loh-widget-on-track-pages.md) asserted against the judged tree f826050; reconcile with any nightly-runner commits on remote main first; never force-push, never drop a runner commit. Build branches stay local and are deleted after the merge (push-to-main rule); the read-back reads "main pushed · remote in sync."
2. Fill EXPECTED_HEAD in the deploy driver with the merged main head (local mirror); re-run harness-v675 at the merged tree — 47/0 expected.
3. Deploy driver: ~/workspace/.tools/deploy-app-v675-ship.py (deployments → dry-run → deploy). It refuses every deploy until EXPECTED_HEAD is filled. Deploy lands pin **ora-pro-nobis-v675-1**; capture the new Worker version id at deploy.
4. Board closeout at ship: Ship phase record + Ship time contract (holder chain-v675), releases.status = 'Live', a shipped_records row (project 3 · v675 · title · shipped_at · whats_new_id), and the What's New entry — each written D1-direct and read back through the door; Goals Board intake 1280 → Done (status value "Done", capitalized).
5. No APK (web-build only; adopted in place by the standing build-adoption discipline). No migration. No index.ts change.

### What's New draft
"The Hours, as text: open a Morning or Evening Prayer track page and the day's Liturgy of the Hours stands as readable text from Divine Office under the app's own header — on Sing the Hours pages too, with the header naming both."

### Rollback
Redeploy pin ora-pro-nobis-v673-1 (Worker 4b9b6e7b) — the v673 driver (~/workspace/.tools/deploy-app-v673-ship.py) and its EXPECTED_HEAD stand untouched.

### Field check (John, on the shipped build — the live-frame proof the sandbox cannot give)
1. Open the Morning Prayer track page from its share link → the text seat shows the app header — Liturgy of the Hours · Morning Prayer · the track's date · "Text: Divine Office — the widget always shows today's Hours" — over the LIVE Divine Office widget carrying today's Hours; confirm the frame loads and scrolls inside the app.
2. Repeat on a Sing the Hours Evening Prayer page → the header also names "Audio: Sing the Hours · Text: Divine Office (today)".
3. Confirm the app player and the frame never sound together unless play is tapped inside the frame (the Q5 A note stands in the header).
4. Failure shape, if a frame ever cannot load: the "Text unavailable — open Divine Office" row stands in its place — never a blank box.
