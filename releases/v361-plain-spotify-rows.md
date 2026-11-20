## 1 · Scope

- **Direction (John, voice call, 2026-11-10 ~16:19 CT, verbatim):** "I still have the 25/75 layout on the prayer podcast. I thought when we switched to the new UI it was going to switch to a normal Spotify layout. I'd like to go to just a normal layout. You could do something subtle for intentions to make them different. But honestly that's not really that important. The main thing is just switching to the regular Spotify layout."
- **Refinement (John, voice call, 2026-11-10 ~16:20 CT):** a standard row for each track, and the intention rows are titled in the form **"Prayer Intention: <prayer name>"** — the intention intro for a prayer carries the row title "Prayer Intention: " + that prayer's name. Everything plays the same; only the structure/title changes. **The title form is John's specified design: it IS the subtle distinction. Decided by John, not a package question.**
- **Scope claim:** record 1298. **Time contract:** 198. **State at Scope:** v358 Live (Worker 1e1ef845) · v360 Live · fork trunk `muse-draft-week` at 495c38c.
- **Recommended run level: To Ship** (named at this section's end).

### 1.1 What renders today — the 25/75 combined row (first-hand, shipped client)

- **One card per prayer, two things inside it.** Every row surface renders through the one seam `trackCard(t)` (`app/worker/src/client.ts`), called once per PRAYER track. When the day payload's intros map carries the track and the track is available, `trackCard`'s wrap prepends `intentionPanelHtml(t, intro)` INSIDE the same card: the card gains the class `intro-row` and holds the intention panel FIRST and the prayer's own row content second, side by side.
- **The split is literal CSS:** `.intro-row .intention-panel { flex: 0 0 25% }` with a hairline right border (`app/worker/src/ui.ts`) — the panel takes 25%, the prayer takes the rest. This is v338's treatment A, shipped 2026-11-09 at John's then-direction (the modular-intentions design), and v343 then made the combined row uniform: `.card.intro-row` is a fixed 136px, the intention text capped at two lines behind a measurement-armed ⋯ ellipsis that expands in place.
- **The panel's contents:** the "Intention" label, the intention TEXT (the words the intro speaks, capped), and the panel's OWN small play button wired to the intro descriptor (`data-playkey="intro:<episodeId>"`) — John's v338 amendment, kept by v351 decision 5 (the intention panel's play button selects the pair).
- **No intro standing → no panel:** a track with no intro in the map renders the plain standing card. An unavailable prayer renders panel-free. So today's block list mixes two row forms: plain cards and 25/75 combined cards.
- **v353's place in this:** the UI overhaul's clone structure (v353) renders block pages through `paintBlockPage`, which maps the block's tracks through `trackCard` — under v353 §2.0.3's rule that B changes where rows stand, never what a row is. The combined row therefore rode into the new UI unchanged. **That is the gap John names: the overhaul changed the pages around the rows; the rows themselves kept the 25/75 form he expected to leave.**

### 1.2 The descriptors already stand alone — the layout is the only fused part

- `expandDescs` (v338 §2.3, the one expansion seam) already emits the intro as its OWN descriptor — `{ episodeId: 'intro:' + t.episodeId, kind: 'intention', title, url, block, intentionText }` — immediately before its prayer's descriptor in `state.dayDescs`. Queue building, the v351 tap rule (a tap on a prayer pulls its intro in as the pair head), v355's snapshot, v358's advance, and v360's played seam all already treat the intro as a separate track.
- **The queue already shows the target form:** `renderQueueList` (v347) lists every descriptor as its own single row, intros included — an intro row carries the `npq-intro` class, an "Intention — " title prefix when the title lacks one, and NO played dot (played state belongs to prayers; a completion write skips `kind === 'intention'`).
- So the fusion exists at exactly one place: the row RENDERING in `trackCard` + the panel CSS. Nothing in playback, queueing, played state, or persistence assumes the combined row.

### 1.3 Surfaces — what changes, what does not

**Changes (every surface that renders prayer rows through `trackCard`):**
- Block pages (`paintBlockPage`) — the main surface John is looking at.
- The episodes page (`paintEpisodesPage`) — same seam.
- Search results on Listen home (`searchResultsHtml` renders hits through `trackCard`; today a hit whose intro text matches pulls the combined row in).
- The settings-family cards that land on block pages and in the flat paint (own rows and external slots render and swap through `trackCard`: `ownSwapRow`, `extSwapCard`, `blockInsertCards` paths) — they take the new form by the same seam, so a settled card never swaps a combined row back in.

**Does not change:**
- Listen home itself: block cards, Play All, Continue — no track rows stand there.
- The queue list and queue preview: already one row per track (§1.2). One consistency consequence, named for Plan: the queue's intro title prefix ("Intention — ") gives way to the same "Prayer Intention: <prayer name>" title the block rows carry, so a track reads the same everywhere.
- Now Playing, the mini-player/dock, the sleep and speed controls: untouched.
- The Intentions TAB (the pool library, `intentionRow` in `.liblist` form): a different surface sharing a word — not a player row, untouched.
- Playback behavior end to end: v351 tap = pair from the tapped track (the intro row's own play button keeps selecting its pair, exactly as the panel's button does today) · v344/v360 played dots stand on prayer rows only · v355 restore · v358 autoplay/chaining · block counts and Mark-all — all unchanged, because all of them already work on descriptors, not on the card.

### 1.4 The design

1. **Every track its own row.** The row seam renders one card per descriptor: where an intro stands for an available prayer, TWO standard cards stand — the intention row first, the prayer row immediately after — in the standing block order. No card contains another track. The `.intro-row` combined form, `intentionPanelHtml`, and the 25% panel CSS retire.
2. **The intention row's title (John's design, decided):** **"Prayer Intention: " + the prayer's name** — the name of the prayer the intro introduces (the prayer descriptor's title), not the feed item's title. The title itself is the distinction John asked for: subtle, textual, no split panel, no color signal.
3. **The intention row's form:** the standard row form — its own play button (the standing `playbtn`, selecting the pair per v351 decision 5), the title, and a meta line. The intention TEXT — the words the intro speaks, today capped in the panel — is the open content question (§1.5 Q2): the recommendation keeps it, as the row's meta line, capped at two lines with the standing ⋯ expand in place, so no information the panel carried is lost. No played dot stands on an intention row (the queue precedent; played state is the prayer's).
4. **The prayer row's form:** exactly the standing plain card — play button, title, "Plays here · … · duration" meta (+ the novena span rule), Read control where text stands, Spotify link where it stands, the played dot as the row's last element, the unavailable form unchanged. Nothing added, nothing removed.
5. **Uniformity:** rows are the standard `.card` rows the non-intro tracks already use. The v343 fixed-136px geometry was a contract of the combined row only; it retires with it (v343's own §2.5 successor language and the v353 exemption that protected the 136px both lapse — named here so Plan and Review judge harness legs against the new form, and the harness-modernization family absorbs the v343/v353 row legs).

### 1.5 The decisions (in the interactive package; recommendations marked)

1. **Any further distinction beyond the title?** John's title form is the distinction (decided). **None (RECOMMENDED)** — no tint, no chip · a light row tint · a small "Intention" chip beside the title. (Default: none, per John's refinement instruction.)
2. **The intention text on the intention row:** **keep it as the row's meta line, capped at two lines with the ⋯ expand (RECOMMENDED)** — content parity with today's panel · title only, no text on the row.
3. **Run level:** **To Ship (RECOMMENDED)** — a presentation-only change on the shipped v353 structure; one seam, no migration, no Worker route, no payload or nightly change · Stop before Ship · Through Review · Through Implement · Scope only.

### 1.6 Acceptance

- A block page shows single uniform rows only: every intention intro stands as its own row titled "Prayer Intention: <prayer name>", immediately before its prayer; no 25/75 split, no panel, anywhere in the app.
- The intention row's play button plays the pair (intro, then its prayer) exactly as the panel's button does today; a tap on the prayer row behaves exactly as today.
- Played dots, block counts, Continue, the queue, search, and Now Playing read and behave as before — with the queue's intro rows carrying the same "Prayer Intention: " title.
- **Concerns and Information Needs:** the prayer NAME for the title comes from the prayer descriptor at the expansion seam — Plan pins the exact source for both families (own + external) and for the case where a prayer's title is itself null (the Bible in a Year slot carries its title from its match; the fallback naming is Plan's to state, never a fabricated name) · search: today an intro-text match surfaces the PRAYER's hit; under separate rows the hit form is Plan's to state (the recommendation: the prayer hit stands as today, and the intention row stands in its block as always) · the v343/v353 harness families carry combined-row legs (136px, panel-first) that this release supersedes — Implement updates or dispositions them with evidence, per the estate's standing rule.

## 2 · Plan

- **Approval (John, voice call, 2026-11-10 ~16:23 CT):** plain "approve" + "go ahead and push that one" — the recommended answers stand: Decision 1 further distinction **NONE** · Decision 2 intention text **kept as the row's second line, capped at two lines with the ⋯ expand** · Decision 3 run level **TO SHIP**. Scope record 1298 passed on that word. Plan record 1299 · contract 199 (package ASAP, hard deadline 2026-11-10T23:09:50Z). Row directive set by full-field upsert + direct-D1 write (the upsert route does not carry `run_directive` — read back set).
- **Shape of the change:** rendering only, at the one seam §1 found. `client.ts` (the row seam, the swap paths, the ellipsis wiring, the queue title) + `ui.ts` (the CSS retirements + the SW re-pin). **NO migration** (0016 stays free), no Worker route, no payload, no settings, no nightly change — confirmed: the only state the form touches is the session-only `state.expandedIntros`, whose shape does not change.

### 2.1 The title — one helper, pinned source (answers §1's Concerns)

- **`prayerIntentionTitle(t, intro)`** (new, client.ts): returns `"Prayer Intention: " + name`, where **name = the PRAYER track's own title (`t.title`)** — the track standing at the render seam, for BOTH families alike (own tracks via `ownSlotTrack`, external slots via `extSlotTrack`; the Bible in a Year slot's `t.title` is its matched episode title by the time it renders). Fallback chain, in order, never a fabricated name: `t.title` → the intro's own title (`intro.title`, the feed item's title as the payload carries it) → the bare string `"Prayer Intention"` with no suffix.
- **The queue uses the same title** through a descriptor form of the helper (`renderQueueList`, §2.5): the intro descriptor's prayer is resolved from `state.dayDescs` by stripping the `intro:` prefix; the same fallback chain applies (prayer descriptor title → the intro descriptor's own title → bare).

### 2.2 The intention row (new `intentionRowCard(t, intro)`)

- **Form:** a standard `.card` — `<div class="card intention-row" data-card="intro:<episodeId>">` holding one `.row`: the standard `.playbtn` (NOT the panel's small variant — uniform form is the point) with `data-playkey="intro:<episodeId>"`, then a `.grow` column carrying:
  - the `<h3>` title from §2.1's helper;
  - the intention TEXT as the second line: the standing `.intention-text` element (two-line `-webkit-line-clamp`, §2.6 CSS re-homed), with the ⋯ ellipsis button standing after it under the standing rule (rendered measurement arms it — `armEllipsis` re-pointed, §2.4); an expanded row (its prayer id in `state.expandedIntros`) renders unclamped with the button standing as the collapse control.
- **No played dot** (the v347 queue precedent: played state belongs to the prayer; a completion write already skips `kind === 'intention'`). **No "Intention" label line** — the panel's label retires with the panel; Decision 1 (no further distinction) means the title alone carries the distinction. No Read control, no Spotify link, no meta line beyond the text itself.
- **Play behavior:** the button wires exactly as every row button wires (`[data-playkey]` against `state.dayDescs` → `tapPlay(introDesc)`), so v351 decision 5 stands untouched: the pair (intro, then its prayer) is selected and plays, exactly as the panel's button does today.

### 2.3 The seam — `trackCard` returns the pair; the wrap loses its intro branch

- `trackCard(t)` keeps its signature and its callers. When `introForTrack(t)` stands for an available track, it returns **`intentionRowCard(t, intro) + <the plain prayer card>`** — two sibling cards from the one call, so every list caller that joins `trackCard` output (`paintBlockPage` · `paintEpisodesPage` · `searchResultsHtml` · `blockInsertCards` · the flat-paint insert paths) emits the pair with **zero caller changes**. When no intro stands, the return is byte-identical to today's plain card.
- Inside `trackCard`, `wrap()` loses the intro branch: it always returns the plain card (play button · `.grow` · `playedDotHtml(t)` as the row's last element). `intentionPanelHtml` is deleted. The unavailable branches never carried a panel and do not change.
- **Search (§1's open point, settled as recommended):** hits remain PRAYER descriptors exactly as today (a title hit or an intro-text hit surfaces the prayer); the hit now renders the pair through the seam, so an intro-text hit shows the intention row directly above its prayer. No hit-set change.
- **Novena rows:** a novena prayer with a standing intro takes the same pair form; the prayer row's `novenaSpanHtml` meta rule is untouched.

### 2.4 The swap paths — the pair replaces atomically, never resurrects a combined row

- **`ownSwapRow`:** builds its html from `trackCard` over the row's tracks — the pair string flows with no change to its construction. Its node loop already stamps `data-own-row` on EVERY emitted node, so both cards carry the row identity, and its selection (`[data-own-row="<sourceKey>"]`) removes and replaces both together. No code change beyond the seam; the harness proves it (L6).
- **`extSwapCard`:** the ONE caller change. It takes `tmp.firstChild` today; it must take **all** of the fragment's children (one node when no intro stands, two when one does) and replace the old card with them in order (intention row immediately before the prayer card). Its existing `[data-playkey]` wiring loop runs over the whole fresh fragment, so both buttons wire by their own keys (the comment citing v338 §2.7(5)'s two-button case updates to name the pair). Placeholder and downloading cards stand single, unchanged.
- **Ellipsis machinery re-point:** `armEllipsis` / `armAllEllipses` / `wireExpand` select and climb `.card.intention-row` in place of `.card.intro-row` — same measurement rule (scrollHeight > clientHeight + 1), same per-row session state, same wiring points (initial build, insert, swap). The expand toggle now expands the intention row itself.

### 2.5 The queue title (consistency, §1.3)

- `renderQueueList`'s intro branch: the `'Intention — ' + title` prefix rule retires. An intro row's title = §2.1's helper applied to its descriptor (prayer resolved from `state.dayDescs`). The `npq-intro` class stands (a styling hook only); the no-dot rule for intro rows stands; prayer rows are byte-untouched. Queue preview + Continue preview ride the same function and take the same title.

### 2.6 CSS (ui.ts) — retirements and the surviving form

- **Retire:** `.card.intro-row { height:136px … }` · `.intro-row .intention-panel { flex:0 0 25% … }` · `.intention-label` · `.panel-foot` · `.card.intro-row.expanded` (superseded by the row-scoped rule below) · the v353 comment's combined-row exemption line (the exemption lapses; the comment is updated to say so).
- **Stand, re-scoped:** `.intention-text`'s two-line clamp (unchanged declarations) + `.card.intention-row.expanded .intention-text { display:block; -webkit-line-clamp:none; overflow:visible }` · `.ellipsis-btn` + `.stands` (unchanged).
- **Row height / form, stated exactly:** there is NO fixed height in the new form. Every row is a natural-height standard `.card` (the same padding and width the plain tracks already use): a prayer row stands at its content height as today; an intention row stands at title line + up to two text lines + the card padding — shorter when its text is short, taller only by its own text. "Uniform" in this design = one card form, one width, one padding for every track — NOT one pixel height; v343's 136px was a contract of the combined row and retires with it (§1.4 point 5).
- **SW re-pin** per standing practice (Implement names it, `ora-pro-nobis-v361-1` expected).

### 2.7 Byte-untouched (the no-disturbance list)

- Listen home (block cards, Play All row, Continue card) · Now Playing except §2.5's title line · the queue preview mechanics · the mini-player/dock · sleep/speed controls · the Intentions pool TAB (`intentionRow` / `.liblist`) · Examination/Confession chrome · the Settings screens' own chrome (their swap CARDS take the new form only through §2.4's seam).
- All behavior: `tapPlay`/`playTrack` and the v351 pair construction · the v344/v360 played store, dots on prayer rows, block counts, Mark-all · v347 queue mechanics · v355 snapshot/restore (descriptors unchanged — the snapshot stores ids, not cards) · v358 autoplay/chaining and its error path · the resume record.

### 2.8 Harness plan — harness-v361 (new) + the standing families

- **harness-v361 legs:**
  - **L1 (block page, single rows):** a fixture block whose prayer carries an intro renders exactly TWO cards — intention row first (`.card.intention-row`), prayer card second; `querySelectorAll('.intro-row, .intention-panel')` is EMPTY across the whole document.
  - **L2 (title form, both families):** an own-family intro row and an external-family intro row each carry the exact title `Prayer Intention: <prayer title>`.
  - **L3 (second line + expand):** the intention text stands as the row's second line under the clamp; a long-text fixture arms the ⋯ (measurement premise built in the fixture, not assumed); a click expands in place (`.expanded`, full text) and collapses back; a short-text fixture stands NO ellipsis.
  - **L4 (pair selection):** a click on the intention row's play button selects the pair — the standing queue is `[intro, prayer]` and the intro plays (the v351 decision-5 path, asserted at the queue level).
  - **L5 (prayer row unchanged):** the prayer row keeps its played dot as its last element (and no dot stands on the intention row), its Read/Spotify furniture as fixture-set, and a tap on it behaves as the standing rules.
  - **L6 (swap paths):** `ownSwapRow` after a late settle replaces BOTH cards (pair stands, both carry `data-own-row`, no combined form); `extSwapCard` on a settling external slot inserts both nodes in order at the old card's position.
  - **L7 (search):** a title hit renders the pair; an intro-text-only hit renders the prayer hit with its intention row above it.
  - **L8 (queue titles):** `renderQueueList` shows the intro row titled `Prayer Intention: <prayer name>` with no dot; prayer rows unchanged.
  - **L9 (title fallback):** prayer title null + intro title standing → the intro's title is used; both null → the bare `Prayer Intention`.
  - **L10 (no behavior drift):** block played counts and Continue read as before on the fixture day; a Play All build's descriptor order stands `[intro, prayer, …]` unchanged.
- **Pristine expectations (Implement measures, Plan predicts):** on the pre-v361 tree L1, L2, L6, L8 FAIL (the combined row stands; the queue prefix differs) and L4, L5, L10 PASS (the behavior pre-exists the form) — the split that proves the harness tests the form, not the behavior.
- **Standing families to re-run:** harness-v343 · harness-v353 · harness-v354 · harness-v360 at minimum, plus harness-v347 (its queue-title legs meet §2.5) and spot re-runs of harness-v355 / harness-v358 (descriptor-level families; expected untouched).
- **How Review judges harness-v343 (named, per §1.6):** v343's combined-row premises are SUPERSEDED by this approved design. A v343 leg that asserts the standing behavior of `.intro-row`, `.intention-panel`, the 136px fixed height, or panel-first composition is RETIRED by this release — Implement either re-points it (the text-cap and ⋯-expand semantics legs re-point to the intention row, where the behavior survives under §2.2/§2.6) or retires it with a named per-leg disposition in §3; Review FAILS any §3 that leaves a combined-row leg silently failing OR silently passing-against-the-old-DOM, and ACCEPTS the family when every leg is green under its re-pointed form or named-retired. The same rule covers harness-v353's byte-identical-`trackCard` premise for intro-carrying tracks (superseded for those tracks only; non-intro rows remain byte-identical) — its expected delta is that premise's legs plus the SW-pin leg, nothing else.

### 2.9 Sequencing

- Implement (one seat, clean worktree off trunk) → Review after trunk landing (presentation-only, no data/auth surface) → Ship. The v359 Android item and the thumbnails idea are independent and untouched by this line.

## 3 · Implement

- **Seat:** Implement record 1300 · contract 200 (ASAP, hard deadline 2026-11-10T23:42:27Z) · clean worktree `release/v361` off trunk 05b76e4 · **NO migration** (0016 stays free) · SW pin `ora-pro-nobis-v361-1` as §2.6 expected.

### 3.1 Design as built (§2 against the code)

- **§2.1 title helper:** `prayerIntentionTitle(t, intro)` stands as pinned — `"Prayer Intention: " + name`, fallback `t.title` → `intro.title` → bare `"Prayer Intention"`. The queue form `prayerIntentionTitleForDesc(desc)` resolves the prayer descriptor from `state.dayDescs` by the stripped `intro:` id and applies the same chain.
- **§2.2 the intention row:** `intentionRowCard(t, intro)` — `<div class="card intention-row" data-card="intro:<episodeId>">`, the STANDARD `.playbtn` (42px, not the panel's small variant) with `data-playkey="intro:<episodeId>"`, the helper's `<h3>`, the standing `.intention-text` as the second line, the `.ellipsis-btn` after it. No played dot, no label line, no Read control, no Spotify link.
- **§2.3 the seam:** `trackCard` returns `intentionRowCard(t, intro) + <plain prayer card>` when an intro stands for an available track; byte-identical plain return when none stands. `wrap()` lost its intro branch (always the plain card, `playedDotHtml` last). `intentionPanelHtml` is **deleted** — no live reference stands anywhere in the served build (grep-clean except historical comments). Unavailable branches unchanged; search hits remain prayer descriptors, rendered as the pair through the seam.
- **§2.4 swap paths:** `ownSwapRow` unchanged in construction (its per-node `data-own-row` stamping already carries the pair). `extSwapCard` takes ALL fragment children, inserts them in order at the old card's position, and wires each inserted node.
- **§2.5 queue title:** `renderQueueList`'s intro branch titles via the descriptor helper; the `Intention — ` prefix rule is retired. The `npq-intro` class and the no-dot rule stand.
- **§2.6 CSS:** retired exactly as listed (136px rule · panel flex · `.intention-label` · `.panel-foot` · the old combined expanded rule); `.intention-text`'s clamp declarations unchanged; the expanded rule re-scoped to `.card.intention-row.expanded .intention-text`; the v353 exemption comment updated (the exemption has lapsed). No fixed row height stands anywhere in the new form.

### 3.2 Build deltas beyond §2's letter (named for Review — the same rule, applied where §2 did not enumerate)

1. **`extSwapCard` removes the standing pair atomically.** §2.4's "the pair replaces atomically" needed one mechanism §2 did not spell out: on a REPEATED swap, the old prayer card's immediately preceding sibling is this slot's standing intention row (`data-card="intro:<slotId>"`) and is removed with the old card. The first build lacked it, and harness-v361 L6b caught the defect live: the settle swap followed by `ownBuildIntentions`' completion-leg swap stranded the first intention row, leaving TWO intention rows before one prayer card. With the removal, L6b's "exactly ONE intention row … however many swaps run" stands green.
2. **The fragment rule at two further `firstChild` consumers.** §2.3's "zero caller changes" holds for the string-join callers; two paths consume `trackCard(extSlotTrack(...))` through `tmp.firstChild` and would have stranded the pair's prayer card inside the fragment: `blockInsertCards`' external branch and `appendBlockSettingsCards`' external branch now take all fragment children, exactly as `extSwapCard` does.
3. **`ownBuildIntentions` completion-leg guard re-point.** Its "does the pair already stand" test read `.intention-panel` inside the prayer card; it now tests whether the prayer card's immediately preceding sibling carries `.intention-row`. Same completion rule, new form — without it the leg re-swapped every settled slot (the duplicate-row pressure delta 1 then had to absorb).
- **`.playbtn.small` CSS stands unused.** Its only consumer was the deleted panel button; §2.6's retire list did not name the rule, so it was left standing and is named here rather than silently kept or silently removed.

### 3.3 Harness-v361 — candidate 39/39 · pristine 17/39 (complete logs)

- **Candidate:** `harness-v361-implement.log` — **39/39 ok, exit 0.** Every L1–L10 leg green, including L6b's repeated-swap atomicity and L10's no-drift reads.
- **Pristine** (pre-v361 tree, `harness-v361-pristine.log`): **17/39 ok, exit 1** — and the split is §2.8's prediction exactly: **L1 FAIL · L2 FAIL (all three) · L6 FAIL (both swap legs ride the form) · L8 intro-title FAIL** (the old prefix stands) while L8's prayer-row clause passes · **L4 PASS · L5 PASS (both) · L10 PASS (all three)** — the behavior pre-exists the form. L3, L7, L9 FAIL on pristine as form legs (§2.8 made no prediction for them; they assert the row that does not exist pre-v361). L6's precondition passes on both trees (form-neutral). The harness tests the form, not the behavior — proven by the split.

### 3.4 Standing families (complete-log tallies, every delta attributed)

- **harness-v343 — 29 passed, 0 failed** under §3.5's dispositions.
- **harness-v353 — 45/46.** Every v361-owned leg green (pin re-point · L3 pair legs · L5 intention-row tap). The sole failure is a harness EXCEPTION in L10's second leg (toggle + move + Save): the leg keys its second toggle off the FIRST `.setrow`'s `data-setkey`, and since v358 the Settings list opens with the Playback section's Autoplay row, which carries no `data-setkey` — a **v358-era premise rot on a surface this diff does not touch** (the settings rendering is byte-identical in this build; the crash is in the harness's selector, not the app). The exception aborts the family before L11/L12 execute: L11's behavior is gated by harness-v361 L7 (search renders the pair, 39/39) and L12's floors/contrast surface is the `ui.ts` diff itself (only §2.6's rules changed). Named here, not repaired — the repair belongs to the harness-modernization family.
- **harness-v354 — 18/21 candidate = 18/21 pristine, identical failing set** (its SW-pin leg · L3 played dots read against a bare-id seed · the `#continue-queue` timeout riding the same seed). **Zero v361 delta**, proven by the pristine run: the seed premise was superseded by v360's occurrence keying (changeover A — a bare Antiphon mark reads unplayed everywhere), a named harness-modernization item.
- **harness-v360 — 25/26.** Sole failure: its SW-pin leg (`v360-1` → the standing `v361-1`) — the expected per-release delta. Every occurrence-keying leg green on the new form.
- **harness-v347 — 17/19 candidate = 17/19 pristine, identical failures with identical detail values** (L7's fully-played fallback read against a bare-id seed — the same v360 seeding rot as v354 · its SW-pin leg). **Zero v361 delta**, including at §2.5's queue-title seam: no v347 leg asserts the retired prefix.
- **harness-v355 (spot) — 20/29**, the identical failing set v358's record already stands for it (the v360 v2-snapshot legs L1a/L9a · the flat-paint tap-premise legs L1b/L3/L7 · the pin leg · L6b's chaining premise, superseded by v358's approved Decision 1). Zero v361 delta.
- **harness-v358 (spot) — 14/15.** Sole failure: its SW-pin leg.

### 3.5 harness-v343 — per-leg dispositions (per §2.8's judgment rule; all stand in-file)

- **Leg 1 — STANDS** unchanged (fixture integrity, form-independent).
- **Leg 2 — RETIRED.** The 136px uniform height + clip guard was the combined row's contract. Replaced in-file by premise checks: no `.card.intro-row` stands, and intention rows stand at natural heights (max > min across the page's rows).
- **Leg 3 — RE-POINTED** to the intention row (long text arms the ellipsis · short texts stand none). Fixture note stands in-file: the texts were calibrated at panel width; at row width T_EXACT2 reads short — the row-width exact-two-line case is harness-v361 L3's, with its own calibration.
- **Leg 4 — RE-POINTED** (expand grows the row, collapse restores it, sibling rows keep their heights, the expansion survives the own settle re-render) — relative heights replace the 136px assertions.
- **Leg 5 — RE-POINTED** (the completion leg: the intention row — formerly "the panel" — gains in-session when the intros land).
- **Leg 6 — RE-POINTED** (cache-valid open renders intention rows; the DO second slot stands with none).
- **Leg 7 — RE-POINTED** (own settle: the intention row's text and play button).
- **Leg 8 — RETIRED.** The compact combined-row chrome was the combined row's contract. Replaced by a premise check: no `.intention-panel`, `.intention-label`, `.panel-foot`, or `.playbtn.small` stands in the rendered page, and the intention row's button measures the standard 42px.
- **Leg 9 — RE-POINTED in wording** (the no-intro and unavailable shapes are unchanged; no intention row stands before a no-intro card).
- **Leg 10 — RE-POINTED** (external settle: the pair starts from the intention row's own play button).
- **Leg 11 — RE-POINTED** (SW pin `ora-pro-nobis-v361-1`; the construction seams, `intentionRowCard` among them).
- **Navigation (same pass, named):** the file predates v353's DOM narrowing — its legs read the flat all-blocks paint, which no longer exists. The legs now open the block page their rows stand on (Morning for Opens A/B · Night + Afternoon for leg 9), and the row-count thresholds follow the page (5 intention rows stand on Morning), not the old flat paint. Without this the re-pointed legs could not execute at all.

### 3.6 harness-v353 — dispositions under the same rule

- SW-pin leg **RE-POINTED** to `ora-pro-nobis-v361-1`.
- L3's 136px/panel-geometry leg **RETIRED**, replaced by the pair-structure premise (intention row immediately before its prayer card · no panel stands · the row carries its own play button).
- L3's cap/ellipsis and dot legs **RE-POINTED** (clamp + ellipsis read on the intention row; the dot read on the prayer card); L3's expand leg **RE-POINTED** to the row.
- L5's panel-button leg **RE-POINTED** to the intention row's own play button (the tap now addresses the intro card, where the button stands).
- L11's combined-row count **RE-POINTED** to `.card.intention-row` — text-level only in this pass: §3.4's L10 exception aborts the family before L11 executes, so this leg's execution evidence is harness-v361 L7's, stated plainly.
- Non-intro rows remain byte-identical, as §2.8 scoped the supersession — v353's remaining legs (home, block pages, mini-player, preview, PIN seam, Settings list form) all pass against them.

### 3.7 Deviations from §2 — summary

- No design deviation: §2.1–§2.6's form, titles, fallbacks, and behavior stand as designed, and §2.7's no-disturbance list is untouched (the diff is `client.ts`'s row seam + swap/insert paths + queue title, and `ui.ts`'s §2.6 rules + pin).
- The three §3.2 build deltas (repeated-swap atomicity · two more fragment consumers · the completion-guard re-point) are §2's own rules carried to the call sites §2 did not enumerate; each is harness-proven above.
- `.playbtn.small` left standing as unused CSS (§3.2), against a silent removal.
- **NOT deployed.** Ship is a later phase; production still stands at v358's Worker 1e1ef845.

## 4 · Review

- **Seat:** Review record 1304 · contract 204 (ASAP, hard deadline 2026-11-10T23:47:46Z) · **VERDICT: PASS.** The build is §2 as designed and John's approval as given (voice call 2026-11-10 ~16:23 CT): every track its own standard row · intention rows titled "Prayer Intention: <prayer name>" · no further distinction · the intention words as the row's second line, capped, with the ⋯ expand · To Ship. Review ran independently of Implement: the diff was read first-hand, the gate harness re-run by this seat, and the standing families' delta claims spot-checked against the committed complete logs.

### 4.1 The seam, verified against §2 (diff 05b76e4 → e11e5a4, read in full)

- **§2.1 title helper:** `prayerIntentionTitle(t, intro)` stands exactly as pinned — `"Prayer Intention: " + name`, fallback `t.title` → `intro.title` → the bare `"Prayer Intention"`, never a fabricated name. The queue form `prayerIntentionTitleForDesc` resolves the prayer from `state.dayDescs` by the stripped `intro:` id and applies the same chain.
- **§2.2 the intention row:** `intentionRowCard` — `<div class="card intention-row" data-card="intro:<episodeId>">`, the STANDARD `.playbtn` carrying `data-playkey="intro:<episodeId>"` (v351 decision 5 untouched — the button selects the pair), the helper's `<h3>`, `.intention-text` as the second line, the `.ellipsis-btn` after it. No played dot, no label line, no Read control, no Spotify link.
- **§2.3 the seam:** `trackCard`'s wrap returns `intentionRowCard + the plain prayer card` when an intro stands for an available track and the byte-identical plain card when none stands (the no-intro branch is textually the pre-v361 return). `intentionPanelHtml` is DELETED — grep over the served sources finds no live reference (the name survives only in historical comments). Unavailable branches unchanged; search hits remain prayer descriptors rendered as the pair.
- **§2.4/§2.5 mechanics:** `armEllipsis` / `armAllEllipses` / `wireExpand` re-pointed to `.card.intention-row`; `renderQueueList` titles intro rows through the descriptor helper and the `Intention — ` prefix survives only in a comment naming its retirement.
- **§2.6 CSS:** the 136px `.card.intro-row` rule, the 25% `.intention-panel` rule, `.intention-label`, and `.panel-foot` are gone from `ui.ts`; `.intention-text`'s clamp declarations are unchanged; the expanded rule stands re-scoped to `.card.intention-row.expanded`; the v353 exemption comment now records that the exemption lapsed. NO fixed row height stands anywhere in the new form. SW pin `ora-pro-nobis-v361-1` stands in the served service worker.
- **NO migration** — the diff's file list carries zero migration files, and harness leg 2 proves the fixture set runs through 0015 with no 0016 standing. **§2.7's no-disturbance list holds:** the diff is confined to `client.ts`'s row seam + swap/insert paths + queue title (plus comment updates) and `ui.ts`'s §2.6 rules + pin; `ownSwapRow` is untouched (zero diff mentions), as §2.4 designed.

### 4.2 The three §3.2 deviations — judged on their evidence

1. **`extSwapCard` repeated-swap atomicity — ACCEPTED, necessary and correctly bounded.** The removal fires only when the old card's immediately preceding sibling carries `.intention-row` AND `data-card === 'intro:' + slot.slotId` — this slot's own intention row, nothing else. The defect it answers was caught live by the harness during Implement, and this seat's own re-run reproduces the fix: leg 38 reads exactly ONE intention row immediately before the prayer card "however many swaps run".
2. **The fragment rule at `blockInsertCards` + `appendBlockSettingsCards` — ACCEPTED.** Both consumed `trackCard(...)` through `tmp.firstChild`; under the pair return, firstChild alone would have appended the intention row and stranded the prayer card in the fragment. Both now take all fragment children in order — §2.4's own rule at the call sites §2 did not enumerate.
3. **`ownBuildIntentions` completion-guard re-point — ACCEPTED.** The old test (`card.querySelector('.intention-panel')`) could never match again after the panel's retirement, so the completion leg would have re-swapped every settled slot on every intros landing — the duplicate-row pressure deviation 1 then absorbs. The new test (the prayer card's immediately preceding sibling carries `.intention-row`) is the same completion rule in the pair form; a preceding sibling can only be this slot's intention row or another track's prayer card, so the test cannot false-positive.
- **`.playbtn.small` standing unused:** named in §3.2 rather than silently kept or silently removed — accepted as documented residue; its removal is a cleanup candidate for the Curator, not a defect of this release.

### 4.3 harness-v343 dispositions — judged under §2.8's rule

- The committed family log reads **29 passed, 0 failed**, and the dispositions stand IN the harness file (header disposition block + per-leg markers), not only in §3.5's prose. Legs 2 and 8 are RETIRED **with premise replacements that execute**: leg 2's replacement asserts no `.card.intro-row` stands anywhere AND intention rows stand at natural heights (long-text row taller than short-text row); leg 8's asserts no `.intention-panel` / `.intention-label` / `.panel-foot` / `.playbtn.small` stands in the rendered page and the intention row's button measures the standard 42px. The surviving cap/expand/completion/settle semantics legs are re-pointed to the intention row and green. The v353-family navigation narrowing (legs open the block page their rows stand on) is named in-file and in §3.5. **No leg is silently failing, and none passes against the old DOM** — the retired legs' replacements actively assert the old form's ABSENCE. §2.8's rule is satisfied.

### 4.4 Gate evidence — this seat's own runs and spot-checks

- **harness-v361 re-run by this seat (complete log `app/tests/harness-v361-review.log`): 39/39 ok, exit 0** — identical to Implement's candidate tally. The pristine split (17/39; L1/L2/L6/L8 fail, L4/L5/L10 pass) stands as §2.8 predicted in §3.3's committed log: the harness tests the form, not the behavior.
- **harness-v354: candidate 18/21 = pristine 18/21, failing sets byte-identical** (diffed by this seat) — zero v361 delta, proven, not asserted.
- **harness-v347: candidate 17/19 = pristine 17/19, failing sets identical** — zero delta, including at §2.5's queue-title seam.
- **harness-v360: 25/26** — the sole failure is its own SW-pin leg (`v360-1` expected); every occurrence-keying leg green on the new form.
- **harness-v355 spot 20/29 · harness-v358 spot 14/15** (sole failure its SW-pin leg) — both match the standing deltas already on their records; zero v361 delta.
- **harness-v353: 45/46 — the L10 exception is CONFIRMED first-hand as the named pre-existing artifact, not a v361 regression.** The mechanism: L10 reads `firstKey` from the FIRST `.liblist .setrow`'s `data-setkey`, then keys its second toggle off it. Since v358 the Settings list opens with the PLAYBACK section, whose Autoplay row is a `.setrow` with NO `data-setkey` (client.ts: the PLAYBACK row stands bare; every settings-store row carries `data-setkey`) — so `firstKey` is null and the follow-on click throws "Cannot read properties of null". The v361 diff does not touch Settings rendering. The exception aborts the family before L11/L12 execute: L11's behavior is covered by harness-v361 L7 (search renders the pair, green in this seat's re-run), and L12's surface is the `ui.ts` diff itself (§4.1). The L10 premise repair belongs to the harness-modernization family, as §3.4 named it.

### 4.5 Served client — parsed and executed

- The worker bundles clean (harness leg 1, esbuild), the app boots on local wrangler in the harness's served mode (leg 3), and a real browser drove the legs — block pages, swaps, expands, search, queue — with **zero page errors** (leg 39 of this seat's own run). The served client does not merely parse; it runs.

### 4.6 Findings

- **None blocking.** Two named residues ride forward, both already on the record: (a) `.playbtn.small` stands as unused CSS (§3.2; Curator cleanup candidate); (b) the harness-modernization family absorbs the v353 L10 premise repair and the v354/v347 bare-id seed updates (§3.4) — neither is a v361 defect.
- **NOT deployed by this phase.** Production still stands at v358's Worker 1e1ef845. Ship is the next seat; John's phone verdict on the plain rows is the post-ship check.

## 5 · Ship

- **Agent:** Ship agent (v361 Ship, 2026-11-10) — Ship claim record 1305 · time contract 205 (expectation: v361 shipped live — Worker deployed, door proofs pass, four-piece flip read back, §5 published — ASAP, hard deadline 2026-11-10T23:51:34Z), closed met. Shipped straight to production under John's To Ship approval (§1/§2; voice call 2026-11-10 ~16:23 CT). Review PASSED before Ship (record 1304).
- **No migration:** presentation-only client change; production D1 untouched by this Ship (settings version 4 standing, read back through the door after deploy).
- **Deploy:** from the clean ship worktree at trunk b313e2a (build e11e5a4 + §4) — dry run first (exit 0), then deploy via the connector-surrogate wrangler (`~/workspace/.tools/deploy-app-v361-ship.py`). Pre-deploy live read: production at Worker **1e1ef845** (the v358 build) at 100% — the rollback target. Production now serves Worker **84786dbf** (deployment 247dba39-2ca1-4545-be1d-a36380da7f65, created 2026-11-10T23:07:06Z) at 100%, read back through the Cloudflare deployments list BEFORE the flip. **Rollback: 1e1ef845** (prior deployment 088df54c-fc42-4b0b-823e-00e8a7394fcc) — the old build simply renders the retired combined rows from the same payload; no data surface to unwind.
- **Live verification (against the new version):** door proofs on production: GET `/api/agent/player/day` → 200, presentedDay 2026-11-10, eight blocks (Morning · Midmorning · Midday · Afternoon · Evening · Night · Mass and Homilies · Novenas), liturgicalDay {name: "Memorial of Saint Leo the Great", color: "white"} standing · GET `/api/agent/player/settings` → 200, version 4. The deployed tree carries the v361 form — `intentionRowCard` in `client.ts` (the retired `intentionPanelHtml` survives only as a retirement comment), SW pin `ora-pro-nobis-v361-1` in `ui.ts` — read in the exact source the deploy uploaded; the user root route refuses the agent door (403), as designed. The row rendering itself renders inside John's Access session; his phone check is the human verification, recorded as his.
- **Flip (four pieces, read back):** release row 690 — **Live**, shipped_at 2026-11-10T23:07:06Z, whats_new_id 79, by full-field upsert (title/scope/slug/run directive replayed and verified standing) · shipped record **441** (shipped_at 2026-11-10T23:07:06Z, whats_new_id 79 — read back correct as posted) · What's New **79** (project-scoped route; the live max was read first — 78 stood, v358's — and the server assigned 79 as posted) · Ship phase record **1305 passed**. All five phases stand passed (Scope 1298 · Plan 1299 · Implement 1300 · Review 1304 · Ship 1305).
- **John's phone verdict — HIS, pending (his acceptance test, §1):** open any block — every track stands as its own standard row; an intention reads as its own row titled "Prayer Intention: <prayer name>" with the intention words beneath it; no 25/75 split anywhere. That report is his to give; this seat does not claim it.
- **Follow-ons carried:** §4.6's named residues stand — `.playbtn.small` unused CSS (Curator cleanup candidate) and the harness-modernization family members (v353 L10 premise repair · v354/v347 bare-id seed updates) — neither is a v361 defect.
