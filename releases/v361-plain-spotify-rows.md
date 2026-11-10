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
