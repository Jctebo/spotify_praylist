# v704 — Liturgy Popup Carries the Entire Liturgy

## §1 Grounding

### §1.1 Direction

- John, 2026-11-27 16:52 CT, replying to the v702 ship report, verbatim: **"Not just the readings. The entire liturgy. Homily recording and custom editing can be excluded."**
- Run level: **To Ship.**
- v702 (§§1–5, `docs/releases/v702-liturgy-popup-over-the-mass.md`) stands in full: the door (the bottom-docked player bar's ⋯ → **"Display Liturgy Text"**, gated by `liturgyPopupSource702()`), drag by head with viewport clamp, the transparency slider (0.35–1.00, panel **background only**, `color-mix`), persistence `localStorage` key `opn-litpop-v702`, `z-index:45`, close on video teardown/change, playback never touched. **None of that changes.**
- v702 §1.2 excluded the Worship Mass scroll's fuller liturgy under its one-payload rule and named each excluded piece. **v704 is John's explicit follow-up lifting exactly that exclusion.** The popup's content leg — today `readingsCardDrive697` → `readingsCardPaint697` inside `openLiturgyPopup702` (`client.ts`, v702 block) — is swapped for the **entire liturgy of the playing item's day, composed as the Worship Mass scroll composes it** (`paintMassScroll`, `client.ts:8623`), minus the two exclusions John named (§1.5).
- Client-only release. No server change, no new route, no migration (§1.2 proves every payload already stands behind a standing route).

### §1.2 The entire-liturgy payload — route, shape, and the one-payload proof

**The Mass payload (the propers leg):**

- Route: **`GET /api/prayer/mass?date=<day>`** (`index.ts:5240–5248`, session-gated, no PIN) → `json(await massPayload(env, date))`.
- `massPayload(env, date)` (`mass.ts`, tail): reads the day's entry from `MASS_CALENDAR` (`mass-calendar.ts`) and answers, verbatim field names:
  - In-calendar day: **`{ date, name, defaultVersion, versions, season, inCalendar: true }`**, where each entry of `versions[]` is **`{ key, label, rank, formulary }`** and `formulary` is a `MassFormulary` (`mass.ts:13–21`): **`entranceAntiphon?: { ref?, text }` · `collect?` · `prayerOverOfferings?` · `prefaceName?` · `prefaceText?` · `communionAntiphon?: { ref?, text }` · `prayerAfterCommunion?`** — every field optional; a formulary that fails extraction stands **absent**, never paraphrased (extracted serve-time from the Roman Missal at liturgies.net, cached in D1 `mass_cache`).
  - Not-in-calendar day: **`{ date, name: date, defaultVersion: null, versions: [], inCalendar: false }`**.
  - `season` is the day's season-kind version's season (e.g. `"Ordinary Time"`), carried so the client can apply the day-true Gloria/Creed rule and the seasonal Penitential Form C set.
- The scroll loads it in `paintMassLiturgy` (`client.ts:9390`): `api('/api/prayer/mass?date=' + today)` → `state.mass.payload`; `massFormulary()` (`client.ts:8192`) selects `versions[]` entry whose `key === state.mass.version` (else `versions[0]`) and returns its `formulary`.

**The readings payload (the readings leg) — does NOT ride the Mass payload:**

- The route's own comment is the proof (`index.ts`, mass route): *"Readings do NOT ride this route — they ride mass-readings below (v490)."* `massPayload` builds versions/formularies/season only; **no readings field stands anywhere in its answer.**
- The scroll therefore merges the readings **client-side**: `paintMassLiturgy` separately calls `loadMassFeed(today)` (`client.ts:7776`) → `GET /api/prayer/mass-readings?date=` → the module global **`massFeed`**; `paintMassScroll` embeds `massReadingsHtml()` (`client.ts:8489`ff), which reads that global — never `state.mass.payload`.
- The readings payload shape stands as v702 §1.2 recorded it: `MassReadingsPayload` (`mass-readings.ts:47–64`): `{date, found, title?, parts[], copyright[], memorials?}`; parts carry `{key, heading, source, html, options?}`.

**The Universal Prayer intentions (the third, per-date leg):**

- The scroll's Universal Prayer section lists the day's stored intentions from `state.mass.universal`, loaded by `massUniversalLoad()` (`client.ts`, v527 block) from **`GET /api/prayer/mass-universal-prayer?date=<day>`** (`index.ts:5437–5447`, session-gated, no PIN), answering **`{ ok: true, date, intentions: string[] }`** (the stored list whole, in stored order; `massUniversalIntentions`, `index.ts:2140`).
- This is a genuine third fetch the scroll's composition depends on. §1.4 prescribes it **IN, read-only** (the section's text is part of the liturgy; only its editing machinery is excluded, §1.5).

**Fetch set the popup issues — exactly three, all standing routes, all GET:**

1. `GET /api/prayer/mass?date=<popup date>` — the Mass payload (new in v704; v702's O3 leg forbade it, §2.4 re-points that leg).
2. `GET /api/prayer/mass-readings?date=<popup date>` — the readings payload (the v702 leg's fetch, unchanged).
3. `GET /api/prayer/mass-universal-prayer?date=<popup date>` — the day's Universal Prayer intentions, read-only (new in v704, §1.4).

**No other fetch.** In particular: **no Universalis JSONP** (§1.4, OUT), **no** `GET /api/prayer/mass-personal-prayer`, **no** `GET /api/prayer/book` (the personal-seat loads, §1.4 OUT), **no** intentions-pool fetch (`/api/prayer/intentions` serves only the Universal editor's pool sheet, §1.5).

### §1.3 Composition order — `paintMassScroll` end to end, with the source of every section

Read at `client.ts:8623–8727`. The popup follows this order and part set, minus §1.5's exclusions. Sources: **(i)** Mass payload · **(ii)** readings payload · **(iii)** client-side standing text (`MASS_ORDER` inlined at `client.ts:24`, generated from `mass-order.ts`; `MASS_ROLES` / `MASS_LATIN` / `MASS_LATIN_ROLES` beside it) · **(iv)** Universalis JSONP backup · **(v)** session/personal state.

| # | Scroll section (in order) | Renderer / seat in `paintMassScroll` | Source |
|---|---|---|---|
| 1 | ICEL notice (head) | `MASS_ICEL_NOTICE` constant (`client.ts:7748`) | (iii) |
| 2 | Day header: "Daily Lectionary" · day name · date line | `p.name` (fallback `'Mass of the Day'`) · `state.mass.dateLabel` | (i) + (v) date label |
| 3 | Version picker (only when `versions.length > 1`) + Text-size controls | `[data-version]` buttons · `[data-tsize]` buttons | (v) picks — **controls: OUT (§1.5)** |
| 4 | Pre-Mass Prayers section (default collapsed) + premass host | `massPremassHostHtml()` → `massPersonalListHtml('premass')` + the Universal editor block | (v) personal — **OUT (§1.4)** |
| 5 | Section: Introductory Rites | `massSectionHtml` | (iii) |
| 6 | Entrance Antiphon | `massAntiphonHtml('Entrance Antiphon', f.entranceAntiphon)` | (i) formulary |
| 7 | Introductory lines | `massLinesHtml(MASS_ORDER.introPre, MASS_ROLES.introPre)` | (iii) |
| 8 | Penitential Act body (toggle stands above it in the scroll) | `massPenBodyHtml()` — `MASS_ORDER` slices via `massPenForms()`; Form C prepends the seasonal set chosen by `payload.season` | (iii) + (i) season + (v) `penform` pick — **toggle OUT, body IN** |
| 9 | Kyrie | `massPartHtml('kyrie', MASS_ORDER.kyrieEn, 'Kyrie')` | (iii) + (v) `latin` pick |
| 10 | Introductory tail lines | `massLinesHtml(MASS_ORDER.introPost, …)` | (iii) |
| 11 | Gloria — **only when `massDayFlags().gloria`** | `massPartHtml('gloria', MASS_ORDER.gloriaEn, 'Gloria')` | (iii), gated by (i) rank/season + date |
| 12 | Lines after Gloria | `massLinesHtml(MASS_ORDER.introTail, …)` | (iii) |
| 13 | Collect | `massPrayerHtml('Collect', f.collect)` | (i) formulary |
| 14 | Section: Liturgy of the Word | `massSectionHtml` | (iii) |
| 15 | **Readings place** (`#mass-readings`) | `massReadingsHtml()`: feed parts in payload order (canon slots first-occurrence; `extra` parts under their own headings; a standing memorial set via `massStandingSetKey()`/`massMemorialPartsHtml()` replaces the ferial set whole), each part through `massFeedPartHtml(part, MASS_SLOT_LABELS[part.key], i)`; a canon slot the feed lacks is filled by `massBackupPartHtml(key)` | (ii) readings payload, merged client-side (§1.2) + **(iv) Universalis backup — OUT in the popup (§1.4)** |
| 16 | **Homily record card** (`#mass-homily-host`) | `massHomilyCardHtml()` | (v) — **OUT, exclusion (a) (§1.5)** |
| 17 | Creed — **only when `massDayFlags().creed`** — then Creed outro lines (always) | `massPartHtml('creed', …)` · `massLinesHtml(MASS_ORDER.creedOutro, …)` | (iii), gated by (i) |
| 18 | **The Universal Prayer** (`#mass-universal-section`) | `massUniversalSectionHtml()`: section head · "Prayer of the Faithful" · invitation `MASS_UP_INVITATION` · "Parish Intentions" · `MASS_UP_POPE` + `MASS_UP_RESPONSE` · `MASS_UP_SENTENCE` · "Private Intention" · the day's intentions, each + the response (or `MASS_UP_EMPTY` when none) · then the Edit button + editor host | (iii) standing constants + (v) per-date intentions store — **section IN read-only; editor OUT, exclusion (b) (§1.5)** |
| 19 | Section: Liturgy of the Eucharist | `massSectionHtml` | (iii) |
| 20 | Offertory lines | `massLinesHtml(MASS_ORDER.offertory, …)` | (iii) |
| 21 | Prayer over the Offerings | `massPrayerHtml('Prayer over the Offerings', f.prayerOverOfferings)` | (i) formulary |
| 22 | Eucharistic Prayer host (`#mass-ep`) | `massEpHtml()`: Preface Dialogue · Preface (`f.prefaceText`/`f.prefaceName`, else `MASS_ORDER.commonPreface1` fallback) · Sanctus via `massPartHtml` · heading + EP toggle · `MASS_ORDER['ep' + ep]` lines | (i) preface + (iii) + (v) `ep` pick — **toggle OUT, body IN** |
| 23 | Section: Communion Rite | `massSectionHtml` | (iii) |
| 24 | Communion-rite lines | `massLinesHtml(MASS_ORDER.communionPre, …)` | (iii) |
| 25 | The Lord's Prayer | head + `massLinesHtml(MASS_ORDER.paterEn, …)` | (iii) |
| 26 | Communion-rite middle lines | `massLinesHtml(MASS_ORDER.communionMid, …)` | (iii) |
| 27 | Agnus Dei | `massPartHtml('agnus', MASS_ORDER.agnusEn, 'Agnus Dei')` | (iii) + (v) `latin` pick |
| 28 | Communion-rite closing lines | `massLinesHtml(MASS_ORDER.communionPost, …)` | (iii) |
| 29 | Communion Antiphon | `massAntiphonHtml('Communion Antiphon', f.communionAntiphon)` | (i) formulary |
| 30 | Private Pre-Communion seat · Private Post-Communion seat | `massPersonalListHtml('before')` / `('after')` | (v) personal — **OUT (§1.4)** |
| 31 | Prayer after Communion | `massPrayerHtml('Prayer after Communion', f.prayerAfterCommunion)` | (i) formulary |
| 32 | Section: Concluding Rites + concluding lines | `massSectionHtml` · `massLinesHtml(MASS_ORDER.concluding, …)` | (iii) |
| 33 | Post-Mass Prayers section + after-Mass seat | `massPersonalListHtml('aftermass')` | (v) personal — **OUT (§1.4)** |
| 34 | Acknowledgments (`#mass-acks`) | `massAcksHtml()`: every readings-payload `copyright[]` line as `.mass-ack`; the Universalis/Jerusalem Bible lines **only** when `massUsedFallback` (a backup piece painted) | (ii) + (iv) — feed lines IN; (iv) lines never stand in the popup |
| 35 | ICEL notice (tail) | `MASS_ICEL_NOTICE` again — the notice stands twice, head and tail (ICEL's first/last-frame condition) | (iii) |

After composing, `paintMassScroll` sets `view.innerHTML` and wires everything in `view` (version/text-size/EP/Latin/pen/chips/personal/Universal/homily handlers) and kicks the async personal + Universal loads. **The popup calls none of that tail** (§2.2 is the load-bearing prescription).

### §1.4 The definitive IN / OUT lists

**IN — the popup paints, in §1.3's order:** rows 1, 2 (header text only), 5, 6, 7, 8 (body), 9, 10, 11 (when the day flag stands), 12, 13, 14, 15 (feed parts only), 17, 18 (read-only composition), 19, 20, 21, 22 (body), 23, 24, 25, 26, 27, 28, 29, 31, 32, 34 (feed copyright only), 35.

**OUT — never in the popup, each with its reason:**

- **Homily record card (row 16)** — John's named exclusion (a), §1.5.
- **Every custom-editing / picking control (rows 3, 8-toggle, 22-toggle, and the toggles/chips embedded inside rows 9/15/27's renderers, plus row 18's editor)** — John's named exclusion (b), §1.5. The popup is a reading surface: it *reads* the standing picks (§2.2), it never offers one.
- **Pre-Mass Prayers (row 4), the private Communion seats (row 30), Post-Mass Prayers (row 33)** — personal devotion seats, not the day's liturgy: v702 §1.2's reason stands for these (John lifted the fuller-*liturgy* exclusion; the task names the Universal Prayer alone as the personal-state section that stands). Technical bar, independently decisive: their renderer `massPersonalListHtml(seat)` embeds the Add button, per-card Remove and move (↑/↓) buttons **inside the paint itself**, and their load machinery (`massPersonalLoad`, `massBookGroups`) is bound to the scroll's global host IDs (`mass-personal-premass` / `-before` / `-after` / `-aftermass`) — there is no read-only reuse of that renderer, and a second renderer is forbidden (§2.2).
- **Universalis backup parts (source iv, inside row 15) and their acknowledgment lines (row 34)** — v702's exclusion stands (John did not name it; v704 lifts only the fuller-liturgy exclusion). Technical bar: the backup is a browser JSONP singleton (`loadMassReadings` → `window.universalisCallback` → the module global `massReadings`) whose callback repaints the Mass tab's own hosts; it is not date-isolated state the popup can borrow safely. In the popup's composition `massReadings` is held `null` (§2.2), so `massBackupPartHtml` returns `''` by its own guard and `massUsedFallback` never sets — a lacking canon slot paints nothing at its place (§1.6), exactly the scroll's behavior when the backup has not loaded.

### §1.5 The two exclusions, proven by name

**(a) The homily-recording element.** Seat: `paintMassScroll` row 16, between the readings place and the Creed — `h += massHomilyCardHtml();` (`client.ts:8682`, comment: *"v551 (Q2 A): the homily record card — INSIDE the Mass scroll at the homily's own place"*). Constituted by:

- Paint: **`massHomilyCardHtml()`** (`client.ts:15426`) → host `<div id="mass-homily-host">` → **`massHomilyCardInner()`**: the `.homily-rec-card` card with **`#mass-homily-rec`** (the record disc, `homilyStartRecord`), **`#mass-homily-stop`**, `#mass-homily-timer`, the microphone row (`homilyMicRowHtml()`, **`#mass-homily-mic-change`**, `[data-homily-mic]` picks), and **`homilyNoteCardHtml()`** (the note box: **`#mass-homily-note-field`**, **`#mass-homily-note-save`**, **`#mass-homily-note-edit`**).
- Wiring/capture: **`wireMassHomily()`** (called from `paintMassScroll`'s tail), `homilyStartRecord` / `homilyStartCapture` / `homilyStopRecord` / `homilyFinishRecord` / `homilyAbortRecord`, `MediaRecorder` + `navigator.mediaDevices.getUserMedia`, the `homilyRec` record and its IndexedDB takes.
- **Popup rule:** `massHomilyCardHtml` is never called, `wireMassHomily` is never called, and no element with id `mass-homily-host`, `mass-homily-rec`, `mass-homily-stop`, `mass-homily-note-field`, `mass-homily-note-save`, or `mass-homily-note-edit`, and no `.homily-rec-card`, stands inside `#litpop702`. The harness asserts absence by these names (§2.5).

**(b) The custom-editing affordances.** Every control the scroll offers, by name — **none** stands in the popup (no element, and no wiring: the popup calls no `wireMass*` function at all):

| Affordance | Names (function / element / attribute) |
|---|---|
| Mass version picker | `[data-version]` buttons in `.mass-vpicker` (painted in `paintMassScroll` row 3) |
| Text-size stepper | `[data-tsize]` buttons (row 3) |
| Penitential-form toggle | `massPenToggleHtml()` → `[data-pen]` buttons (`.mass-pentoggle`); wiring `wireMassPen()` |
| Eucharistic-Prayer toggle | `[data-ep]` buttons in `.mass-eptoggle`, **embedded in `massEpHtml()`'s own head**; wiring `wireMassEp()` |
| Latin/Greek part toggles | `[data-lt]` buttons in `.mass-ltoggle`, **embedded in `massPartHtml()`** for kyrie/gloria/sanctus/agnus/creed; wiring `wireMassLatin()` |
| Reading-option chips | `[data-rchoice]` buttons, **embedded in `massFeedPartHtml()`** when a part carries `options.length > 1`; wiring in `wireMassChips()` |
| Readings-set chips | `massReadingsChipsHtml()` → `[data-rset]` buttons (Weekday / memorial sets); wiring in `wireMassChips()` |
| Universal Prayer editor | `massUniversalSectionHtml()`'s **`#mass-universal-edit-btn`** + `#mass-universal-point` host; **`massUniversalEditorHtml(withHead)`** and its acts: `[data-muup]` · `[data-mudown]` · `[data-muremove]` · `[data-mutext]` · `[data-muedsave]` · `[data-muedcancel]` · `[data-muaddpool]` · `[data-muaddfree]` · `.mu-input` / `.mu-free` / `.mu-edit` inputs; `wireMassUniversalSection()` / `wireMassUniversalIn(host)`; the pool sheet `openMassUniversalPool()` (`.musheet`, `[data-mupooli]`); the second editor host `#mass-universal-premass` inside `massPremassHostHtml()` |
| Personal-seat editing | `MASS_PERSONAL_SEATS` add buttons (`#mass-personal-premass-btn` · `#mass-personal-before-btn` · `#mass-personal-after-btn` · `#mass-personal-aftermass-btn`), per-card `[data-mpremove]` · `[data-mpup]` · `[data-mpdown]`, per-prayer language switches `[data-mplang]`, the picker `openMassPersonalPicker(seat)` (`.mpsheet`, `[data-mppick]`) — the seats themselves are OUT (§1.4), so none of this can stand |
| Pre-Mass collapse act | `#mass-premass-head` click (the section is OUT with its seat) |

Note the embedded cases (EP toggle, Latin toggles, reading chips): those buttons are produced **by the standing renderers the popup must reuse** (§2.2). The prescription is therefore *reuse the renderer, strip its control strip from the popup's own DOM, wire nothing* — §2.2 names the exact strips.

### §1.6 Honest-empty, per part (the scroll's own omission behavior, inherited)

- **Entrance / Communion Antiphon missing** (`ant` absent or `ant.text` empty): `massAntiphonHtml` paints **the heading alone**, no body — the popup inherits exactly this.
- **Collect / Prayer over the Offerings / Prayer after Communion missing:** `massPrayerHtml` paints **the heading alone** — inherited.
- **Preface missing** (`f.prefaceText` absent): `massEpHtml` falls back to the standing **Common Preface I** (`MASS_ORDER.commonPreface1`) under a plain "Preface" head — inherited; a missing preface is never an empty hole.
- **Gloria / Creed:** omitted **whole** (no heading, no placeholder) when `massDayFlags()` says the day does not carry them (rank/season/Sunday from the Mass payload + the date) — inherited. (The §1.7 fixture day, Friday 2026-11-27, ferial, carries **neither** — the harness asserts their absence on that day as correct behavior, not as a lack.)
- **A readings canon slot the feed lacks** (e.g. no `r2` on a weekday): paints **nothing at its place** in the popup (the Universalis fill is OUT, §1.4) — the scroll's own posture before/without its backup.
- **Readings payload missing whole** (`found:false`, no parts, or the readings fetch rejects): the readings place paints the standing honest line alone — **"Readings not available for this day."** (the `readingsCardPaint697` negative arm, v702 §1.2) — and the rest of the liturgy still paints around it. This is the one place the popup does not follow `massReadingsHtml` literally (which would paint an empty readings place); it follows v702's proven honest-empty rule for the same payload.
- **Universal Prayer intentions:** an empty stored list (or the universal fetch rejecting — `massUniversalLoad`'s catch adopts `intentions: []`) paints the section whole with **`MASS_UP_EMPTY` — "No private intentions added for today"** — under the "Private Intention" head, exactly as the scroll closes the section.
- **Whole day — no Mass payload** (the fetch rejects, or the answer is `inCalendar:false` / `versions:[]`): the popup body paints **one line alone** and nothing else, reusing the standing failure line form from `paintMassLiturgy`'s catch arm: **"The day's Mass could not be loaded."** No part headings, no other day's text, no readings even if the readings fetch succeeded — without the day's versions/season there is no composition to hang them on.

### §1.7 Date rule — stands unchanged

`liturgyPopupDate702(t)` = `episodeDate697(t)`: the playing item's **title date primary** (`opnDailyTitleDate666`), `presentedDateStr()` fallback only (v702 §1.3). All three v704 fetches (§1.2) ask for **that date and only that date**. Note the contrast the Plan must hold: the Worship scroll is a today-only surface (`paintMassLiturgy` loads `todayChicago()`); the popup is a **presented-day** surface — which is precisely why it cannot borrow the scroll's loaded state (§2.2).

### §1.8 Fixture captured at Plan (Improvement D)

- **`app/worker/fixtures/mass-2026-11-27.json`** — the real Mass payload for **2026-11-27**, captured 2026-11-27 at Plan through **the Worker's own code path locally**: `massPayload(env, '2026-11-27')` from `src/mass.ts` run directly (the route at `index.ts:5247` is session-gated on the app host, so the route's own function was driven locally — the same capture shape the task prescribes when a live capture is impossible from the Plan seat). The D1 handle was a cache-miss stub, so the formulary was computed by the standing extraction (`resolveFormulary` → the season page for Ordinary Time week 34, weekday part) exactly as a cold production request computes it; the calendar fields (`name`, `defaultVersion`, `versions[]` keys/labels/ranks, `season`) come from `MASS_CALENDAR` itself. Shape: `inCalendar:true`, `name` "Friday in the 34ᵗʰ Week in Ordinary Time", `season` "Ordinary Time", one version (`ferial`, rank `ferial`) whose formulary carries `entranceAntiphon` (ref "Cf. Ps 85 (84): 9"), `collect` ("Stir up the will of your faithful…"), `prayerOverOfferings`, `communionAntiphon`, `prayerAfterCommunion` — and **no `prefaceText`** (so the fixture day exercises §1.6's Common Preface fallback). Saved verbatim, no trimming — including the extraction's own trailing word in `prayerAfterCommunion`, as production's extractor produces it.
- **The two v702 readings fixtures stay in play** (the popup still fetches the readings payload, §1.2): `app/worker/fixtures/mass-readings-2026-11-27.json` (4 parts: Revelation 20:1-4, 11—21:2 · Psalm 84:3, 4, 5-6a, 8a · Luke 21:28 · Luke 21:29-33; `copyright[]` 1 line) and `app/worker/fixtures/mass-readings-2026-11-26.json` (`found:true`, `parts:[]` — the readings-honest-empty day).
- The Universal Prayer leg needs no captured fixture file: the route's empty-day answer is `{ok:true, date, intentions:[]}` by construction (`massUniversalIntentions` returns the stored list, empty when none stands), and the harness stubs that shape directly; a non-empty stub list in the harness is test data for the read-only paint, labeled as such in the harness header — it is not presented as a captured fixture.

## §2 Plan

Client-only: `app/worker/src/client.ts` + `app/worker/src/ui.ts` + pin + new harness + the §1.8 fixture (already committed at Plan). No server change (§1.2 proof: all three routes stand).

### §2.1 What does not change

The whole v702 mechanics leg stands byte-for-byte in behavior: the panel element (`#litpop702`, body-appended), head dress, the alpha row and slider, `litpop702ApplyAlpha702`, `litpop702Clamp`, `wireLiturgyPopupDrag702`, the prefs store `opn-litpop-v702`, the door (`liturgyPopupSource702()` + the "Display Liturgy Text" item in `openDockMenu`), the date rule (`liturgyPopupDate702` = `episodeDate697`), the toggle-close/re-date rule in `openLiturgyPopup702`, and the four teardown call sites. **Only the body paint changes**: where `openLiturgyPopup702` today hands the panel to `readingsCardDrive697`, v704 hands it to the new driver in §2.2. The panel body keeps riding the reused `.mass-*` / `.mass-ack` classes — the scroll's own dress, no new text dress (one optional dress note in §2.3).

### §2.2 The load-bearing prescription — how the popup composes without touching the Lectionary surface

**Why `paintMassScroll()` can never be called by the popup (grounded, §1.3's tail):**

1. It **writes the Worship view**: `view.innerHTML = h` — `view` is the app's main view element; the playing video's watch paint (frame, meta) stands in that same view on the Praylist surface. Calling it would destroy the watch (and the iframe) the popup exists to overlay.
2. It **wires the view and kicks session loads**: its tail calls `wireMassHomily()`, `wireMassLatin()`, `wireMassPen()`, `wireMassChips()`, `wireMassPersonal()`, `wireMassUniversalSection()` and starts `massPersonalLoad()` / `massUniversalLoad()` when those state fields are `undefined` — all bound to the scroll's global host IDs, all mutating the Lectionary side's state.
3. Its segment renderers do not take parameters for their data: they read **module globals and `state.mass`** — `massFormulary()` / `massDayFlags()` / `massPenSamplesHtml()` read `state.mass.payload` + `state.mass.version`; `massPenBodyHtml()` reads `state.mass.penform`; `massPartHtml()` reads `state.mass.latin[part]`; `massEpHtml()` reads `state.mass.ep`; `massFeedPartHtml()` reads `state.mass.rchoices`; `massReadingsHtml()` reads the globals **`massFeed`** and **`massReadings`** and writes **`massUsedFallback`**; `massAcksHtml()` reads `massFeed` + `massUsedFallback`; `massStandingSetKey()` reads `state.mass.version` and **writes** `state.mass.rset` / `state.mass.rsetFor`.

**The prescribed reuse shape — snapshot, swap, synchronous compose, restore:**

New function **`liturgyPopupPaint704(bodyEl, headEl, massP, readingsP, universalIntentions)`** and driver **`liturgyPopupDrive704(t, resolve704)`** in the v702 block in `client.ts`, beside `openLiturgyPopup702`:

1. **Fetch (driver, async — outside the swap):** for `dateStr = liturgyPopupDate702(t)`, issue the three §1.2 GETs in parallel (`api('/api/prayer/mass?date=' + dateStr)`, `api('/api/prayer/mass-readings?date=' + dateStr)`, `api('/api/prayer/mass-universal-prayer?date=' + dateStr)`). Each settles independently: mass-payload rejection or an `inCalendar:false` / empty-`versions` answer → the §1.6 whole-day line (the driver paints it and stops); readings rejection → `readingsP = null` (the §1.6 readings line at the readings place); universal rejection → `universalIntentions = []` (§1.6). At settle, resolve the panel through `resolve704()` **at settle time** (the v697 R4 discipline `openLiturgyPopup702` already uses) and check the panel still stands for `dateStr` before painting.
2. **Snapshot (sync):** save `prev = { mass: state.mass, feed: massFeed, readings: massReadings, fb: massUsedFallback }`.
3. **Swap (sync):** set `massFeed = readingsP`; set `massReadings = null` (the Universalis OUT, §1.4 — `massBackupPartHtml` self-guards to `''`); set `massUsedFallback = false`; set `state.mass` to a **fresh temporary object** built exactly in `paintMassLiturgy`'s construction shape (`client.ts:9392`):
   `{ date: dateStr, payload: massP, version: <pick rule>, ep: <pick rule>, penform: <pick rule>, preMassOpen: false, latin: <pick rule>, rchoices: <pick rule>, textSize: massPrefs().size, dateLabel: shortDayLabel(dateStr), personal: undefined, personalLang: {}, universal: { date: dateStr, intentions: universalIntentions }, universalOpen: false, universalEditIdx: -1 }`
   - **Pick rule (read-only standing picks):** where a standing `state.mass` exists **and `state.mass.date === dateStr`** (the user has this same day loaded on the Lectionary side), carry its `version`, `ep`, `penform` and **shallow copies** of its `latin` and `rchoices` objects into the temp object — the popup honors the picks the user already made for that day, and copies (plus the temp top level absorbing `massStandingSetKey`'s `rset`/`rsetFor` writes) guarantee no renderer write can land on the standing object. Where no same-date standing state exists, the temp object takes `paintMassLiturgy`'s own entry defaults: `version = massP.defaultVersion || (massP.versions[0] && massP.versions[0].key) || null`, `ep = 'II'`, `penform = 'A'`, `latin = {}`, `rchoices = {}`.
4. **Compose (sync, no `await` anywhere between swap and restore):** build the body string by calling the **scroll's own segment renderers in §1.3's order** — `massSectionHtml`, `massAntiphonHtml`, `massLinesHtml` (with `MASS_ORDER`/`MASS_ROLES`), `massPenBodyHtml`, `massPartHtml`, `massPrayerHtml`, `massReadingsHtml`, `massEpHtml`, `massAcksHtml`, `massDayFlags`, `massFormulary` — the exact call sequence §2.3 lists. Every one of these is a synchronous string builder (verified: the whole of `paintMassScroll` up to its `view.innerHTML` assignment is synchronous; all async work stands in its tail, which the popup never enters). Because JavaScript is single-threaded and no await intervenes, **no other paint, settle handler, or tab action can observe the swapped state** — the Lectionary surface is undisturbed by construction, not by care.
5. **The two composed-by-hand seams (no second renderer, no new text):**
   - **Day header:** the scroll's rows 1–2 minus the row-3 controls: `MASS_ICEL_NOTICE` notice + `.mass-day` "Daily Lectionary" + `.mass-dayname` (`massP.name || 'Mass of the Day'`) + `.mass-date` (`dateLabel`) — the same constants, fields, and classes `paintMassScroll` uses, in its order.
   - **Universal Prayer (row 18):** `massUniversalSectionHtml()` **cannot** be called — it embeds `#mass-universal-edit-btn` and the editor host in its own return string (§1.5b). The popup composes the section from the **same standing constants and classes** that function uses, in its order: `massSectionHtml('The Universal Prayer')` + `.mass-up-sub` "Prayer of the Faithful" + invitation line (`MASS_UP_INVITATION`) + `.mass-h` "Parish Intentions" + `MASS_UP_POPE` line + `.mass-up-response` (`MASS_UP_RESPONSE`) + `MASS_UP_SENTENCE` line + `.mass-h` "Private Intention" + `<br>` + either each intention in `state.mass.universal` (the temp object's list) as a `.mass-line` followed by the response line, or the `MASS_UP_EMPTY` line. No string in this seam is new text: every word is a `MASS_UP_*` constant or a stored intention. The Edit button and the `#mass-universal-point` host are simply never emitted.
   - **Readings honest-empty seam:** when `readingsP` is missing whole (§1.6), the readings place in the composed string is the `readingsCardPaint697` negative arm's line — `<div class="mass-line readings-none697">Readings not available for this day.</div>` — instead of `massReadingsHtml()`'s output. (When the readings payload stands, `massReadingsHtml()` paints, with `massFeed` swapped to it.)
6. **Strip the embedded control strips (sync, on the popup's own DOM):** assign the composed string to `bodyEl.innerHTML`, then remove from the panel body only: `.mass-eptoggle` (from `massEpHtml`), every `.mass-ltoggle` (from `massPartHtml`), every `[data-rchoice]` chip strip (`.mass-chips` produced by `massFeedPartHtml`), and the readings-set chip strip (`massReadingsChipsHtml`'s `.mass-chips` carrying `[data-rset]`). Removal by those class/attribute names, nothing else touched. **Wire nothing**: no `wireMass*` call stands in the v704 block; the strips' handlers could not act even if a strip survived, and the harness asserts none survives (§2.5).
7. **Restore (sync, immediately after the strip):** `state.mass = prev.mass; massFeed = prev.feed; massReadings = prev.readings; massUsedFallback = prev.fb;` — in a `finally` posture around steps 4–6 in Implement's code, so a renderer throw still restores (and a throw paints the §1.6 whole-day line). The composed DOM is already materialized in the panel; restoring the globals cannot unpaint it.
8. **Head day-name:** where `massP.name` stands, the panel head's `.readings-day697` line takes it at settle (the same settle-time head swap `readingsCardDrive697` performs with the readings title — here the Mass payload's `name` is the fuller day name; where it does not stand, the head keeps the date line `openLiturgyPopup702` painted).

**What this shape forbids, by name:** calling `paintMassScroll` or `paintMassLiturgy` from the popup; calling `massUniversalSectionHtml`, `massPremassHostHtml`, `massPersonalListHtml`, `massHomilyCardHtml`, `loadMassFeed`, `loadMassReadings`, `massPersonalLoad`, `massUniversalLoad`, or any `wireMass*` from the v704 block; writing any renderer of its own for a part the scroll already renders (the two §2.2.5 seams are composition of standing constants/classes, not renderers).

### §2.3 The composition call sequence (the swap, concretely)

Inside the swap, `liturgyPopupPaint704` builds, in this exact order (row numbers = §1.3):

```
notice(MASS_ICEL_NOTICE) · day header (rows 1–2, §2.2.5)
massSectionHtml('Introductory Rites')
massAntiphonHtml('Entrance Antiphon', f.entranceAntiphon)        // f = massFormulary()
massLinesHtml(MASS_ORDER.introPre, MASS_ROLES.introPre)
massPenBodyHtml()                                                // NO massPenToggleHtml
massPartHtml('kyrie', MASS_ORDER.kyrieEn, 'Kyrie')
massLinesHtml(MASS_ORDER.introPost, MASS_ROLES.introPost)
flags.gloria ? massPartHtml('gloria', MASS_ORDER.gloriaEn, 'Gloria') : ''
massLinesHtml(MASS_ORDER.introTail, MASS_ROLES.introTail)
massPrayerHtml('Collect', f.collect)
massSectionHtml('Liturgy of the Word')
readings place: readingsP stands ? massReadingsHtml() : the §1.6 honest line
// NO massHomilyCardHtml — exclusion (a)
flags.creed ? massPartHtml('creed', MASS_ORDER.creedEn, 'Creed') : ''
massLinesHtml(MASS_ORDER.creedOutro, MASS_ROLES.creedOutro)
Universal Prayer seam (§2.2.5)
massSectionHtml('Liturgy of the Eucharist')
massLinesHtml(MASS_ORDER.offertory, MASS_ROLES.offertory)
massPrayerHtml('Prayer over the Offerings', f.prayerOverOfferings)
massEpHtml()                                                     // toggle strip removed at §2.2.6
massSectionHtml('Communion Rite')
massLinesHtml(MASS_ORDER.communionPre, MASS_ROLES.communionPre)
'<div class="mass-h">The Lord's Prayer</div>' + massLinesHtml(MASS_ORDER.paterEn, MASS_ROLES.paterEn)
massLinesHtml(MASS_ORDER.communionMid, MASS_ROLES.communionMid)
massPartHtml('agnus', MASS_ORDER.agnusEn, 'Agnus Dei')
massLinesHtml(MASS_ORDER.communionPost, MASS_ROLES.communionPost)
massAntiphonHtml('Communion Antiphon', f.communionAntiphon)
// NO personal seats — §1.4
massPrayerHtml('Prayer after Communion', f.prayerAfterCommunion)
massSectionHtml('Concluding Rites')
massLinesHtml(MASS_ORDER.concluding, MASS_ROLES.concluding)
// NO Post-Mass Prayers section — §1.4
massAcksHtml()
notice(MASS_ICEL_NOTICE)
```

Wrapped in `<div class="mass-scroll ts-<textSize>">…</div>` exactly as `paintMassScroll` wraps its string, so the standing `.mass-*` dress and the text-size class govern the popup body identically. No new dress is prescribed; if Implement finds the `.mass-scroll` wrapper needs a popup-scoped width rule, it stands in the existing `.litpop702-body` rule in `ui.ts` — no new class names.

**`openLiturgyPopup702` change (one seat):** its closing driver call changes from `readingsCardDrive697(t, resolver)` to `liturgyPopupDrive704(t, resolver)` with the same settle-time resolver shape (`{body, head}` read from the standing panel, date-checked). Nothing else in the function changes. `readingsCardDrive697` / `readingsCardPaint697` themselves are **not** modified (the v697 surfaces keep them; harness-v697 is the guard).

### §2.4 Pin

- `ui.ts` (the standing pin, `ui.ts:1224` at base): → **`ora-pro-nobis-v704-1`**.

### §2.5 Harness spec — `app/worker/harness-v704.mjs` (the v702 harness mold)

The real built Worker bundle served locally, the API stubbed, driven Chromium, real acts, same-tick DOM assertions; `ORA_WT` selects the tree for the fail-on-old run. Fixtures read from the committed files, never re-typed: `fixtures/mass-2026-11-27.json` (§1.8) + the two v702 readings fixtures. The API stub answers the three §1.2 routes from the fixtures (the universal route answers `{ok:true, date, intentions:[]}` by default; the U2 leg restubs it with a one-intention list, labeled test data in the harness header). The video surfaces are driven through their real paints, as in harness-v702.

- **F — fixture shape + pin:** the mass fixture is `inCalendar:true`, `season:'Ordinary Time'`, one `ferial` version whose formulary carries `collect` + `entranceAntiphon.text` and **no** `prefaceText`; the two readings fixtures keep their v702 F shapes; the served pin is `ora-pro-nobis-v704-1`.
- **L1 (entire liturgy paints, in composition order, Praylist surface)** — open via the dock ⋯ "Display Liturgy Text" item on a playing CatholicTV Mass descriptor titled “…November 27, 2026…”: the fetch log shows **exactly the three §1.2 fetches, each with `date=2026-11-27`, and no other `/api/` fetch** (no personal-prayer, no book, no intentions-pool, no Universalis request — the stub records all requests; Universalis is an external JSONP, asserted by the absence of any `universalis.com` request in the page's request log). In `#litpop702 .litpop702-body`, markers stand **in strictly increasing document order**: ICEL notice → day name "Friday in the 34ᵗʰ Week in Ordinary Time" → "Entrance Antiphon" + "The Lord speaks of peace" → a standing Order line (e.g. "And with your spirit") → "Collect" + "Stir up the will of your faithful" → "Liturgy of the Word" → the readings citations (Revelation 20:1-4, 11—21:2 · Luke 21:29-33) → "The Universal Prayer" + "For the Holy Father, Pope Leo XIV." + the pinned sentence + "No private intentions added for today" → "Liturgy of the Eucharist" → "Prayer over the Offerings" → "You are indeed Holy, O Lord" (Eucharistic Prayer II, the entry default) → "The Lord's Prayer" + "Our Father, who art in heaven" → "Communion Antiphon" → "Prayer after Communion" → "Concluding Rites" → the readings `copyright[]` line as `.mass-ack` → the tail ICEL notice (the notice stands **twice**).
- **L2 (day-flag honesty on the fixture day)** — on 2026-11-27 (ferial Friday): **no** "Gloria" part and **no** "Creed" part stands in the body (§1.6 — correct omission, asserted so a future always-paint regression fails); the Preface head stands with the **Common Preface fallback** text (the fixture carries no `prefaceText`).
- **L3 (Virtual Mass surface)** — the L1 order legs' key markers (Collect text · readings citation · Universal Prayer standing parts · EP II line) through `paintPodWatch` with `massPodReturn` standing, same three fetches for the title's date.
- **X1 (exclusion (a) — homily, absence by name)** — in the open popup: no `#mass-homily-host`, no `.homily-rec-card`, no `#mass-homily-rec`, no `#mass-homily-stop`, no `#mass-homily-note-field`, no `#mass-homily-note-save`, no `#mass-homily-note-edit`, and the body text contains no "Record the homily".
- **X2 (exclusion (b) — editing, absence by name)** — in the open popup: no `[data-version]`, no `[data-tsize]`, no `[data-pen]`, no `[data-ep]`, no `[data-lt]`, no `[data-rchoice]`, no `[data-rset]`, no `#mass-universal-edit-btn`, no `[data-muup]` / `[data-mudown]` / `[data-muremove]` / `[data-mutext]` / `[data-muedsave]` / `[data-muaddpool]` / `[data-muaddfree]`, no `.mu-input`, no personal-seat button (`#mass-personal-premass-btn` etc.), no `[data-mpremove]` / `[data-mpup]` / `[data-mpdown]`, and **no `button` element of any kind inside `.litpop702-body`** (the panel head's Close button stands outside the body and is the only button in the panel besides none). A click dispatched on the body (e.g. on the EP heading) changes nothing in the body and issues no fetch.
- **U2 (Universal Prayer with a stored intention, read-only)** — the universal stub answers `intentions:['For a test intention.']` (test data, labeled): the body paints that intention as a `.mass-line` followed by "Lord, hear our prayer.", the `MASS_UP_EMPTY` line does **not** stand, and X2's editor absences still hold.
- **D1 (date rule holds)** — a descriptor titled “…November 25, 2026…” (stub answers the 2026-11-27 fixtures' bodies under any date, keyed by request): all three fetches carry `date=2026-11-25`, none carries `2026-11-27` or the presented date; the panel's `data-litpop702-date` is `2026-11-25`.
- **N1 (whole-day honest empty)** — the mass stub answers `{date, name:date, defaultVersion:null, versions:[], inCalendar:false}` (readings/universal stubs still answer normally): the body paints **"The day's Mass could not be loaded." alone** — no "Collect", no readings citation, no other text part.
- **N2 (readings honest empty inside a standing liturgy)** — the readings stub answers the 2026-11-26 fixture (`parts:[]`) while the mass stub answers the 2026-11-27 fixture: the body paints "Readings not available for this day." at the readings place (after "Liturgy of the Word", before "The Universal Prayer") and the rest of the liturgy (Collect · EP II line · Prayer after Communion) still stands; no `.mass-ack` from the readings fixture stands (its copyright does not paint on the not-available arm — the tail acks read the swapped `massFeed`, so Implement must confirm: if `massAcksHtml` paints the empty fixture's copyright line, that is a **named deviation to record in §3**, not a silent pass — the leg asserts the line's absence per the v702 N1 discipline).
- **S9 (state isolation — the load-bearing leg)** — before opening, drive the app to a sentinel state: set `state.mass` to a sentinel object for a **different** date with marker picks, set `massFeed`/`massReadings` to sentinel values, and paint a sentinel string into `view` beside the watch frame. After the popup paints: `state.mass` is the **identical object** (reference equality) with its fields untouched, `massFeed`/`massReadings`/`massUsedFallback` hold their sentinel values, the sentinel view content and the watch iframe (node + `src`, the v702 V1 discipline) stand unchanged, and no element with the scroll's host IDs (`mass-readings`, `mass-ep`, `mass-acks`, `mass-universal-section`, `mass-personal-premass`) stands anywhere in the document (the popup reuses classes, never the scroll's IDs).
- **M (v702 mechanics re-proven on the new content)** — the v702 legs carried over **unmodified in substance**: drag + clamp (D1 of v702) · slider background-only, no `opacity` anywhere (S1) · persistence round-trip `{x, y, alpha:0.5}` in `opn-litpop-v702` (P1) · `elementFromPoint` reachability at the frame's center with the popup open and parked (V1) · teardown close via `finishVideoHandoff656` and `closeWatch` (C1) · the door item absent off the Mass surfaces (A1: audio · Adoration watch · non-Mass Praylist video).
- **Fail-on-old (base `50542b5`):** F's pin leg, L1, L2, L3, U2, D1's fetch-set half, N1, N2, and X1/X2's *popup-stands* preconditions fail (on base the popup paints readings only: no Collect, no Order text, no Universal Prayer, and a `/api/prayer/mass` fetch is never issued); S9's popup half fails (no entire-liturgy paint to isolate); M's mechanics legs pass on base where they passed for v702 (they are v702 behavior, standing on base) — the harness header states this split explicitly, as harness-v702's header did.

### §2.6 Regression bars and the harness-v702 re-points

- **harness-v702 — re-pointed, named here, nowhere else:** v702's legs were written against the readings-only prescription; exactly three legs change meaning under v704 and Implement re-points **only** these in `harness-v702.mjs`, recording the re-point in §3:
  1. **O1's paint assertions** — "the body paints every fixture part's citation … and the copyright line" stands, but O1 also asserted (via O3's pairing) a readings-only body; O1's body assertions are re-pointed to accept the entire-liturgy body (the readings citations and the `.mass-ack` line stand **inside** it, at the readings place and the tail).
  2. **O2's paint assertions** — the same re-point on the Virtual Mass surface.
  3. **O3 — INVERTED:** "no `MASS_ORDER` text (e.g. 'And with your spirit' absent) and **no `/api/prayer/mass` fetch**" becomes its opposite: the body **contains** standing Order text and the fetch log **shows** `/api/prayer/mass?date=2026-11-27` (plus the universal-prayer fetch). O3 is renamed in place (e.g. O3′) with a header comment citing this section — never silently edited.
  Every other v702 leg (F, D1, S1, P1, V1, N1*, C1, A1) runs **unmodified**. *N1 caveat: v702's N1 asserts the 2026-11-26 fixture paints the not-available line **alone in the body**; under v704 that fixture is the *readings* answer while the mass stub in harness-v702 answers… harness-v702's stub answers only `mass-readings` — its `/api/prayer/mass` request is unstubbed. Implement must therefore also re-point N1's setup (stub the mass route with the §1.8 fixture) and its assertion (the line stands **at the readings place**, the liturgy around it) — this is a fourth, setup-only re-point, named here so it is not discovered mid-Implement; N1's *discipline* (no citation, no other day's readings text) is unmodified. With the re-points, the bar is **harness-v702: all legs ok** on the new tree.
- **harness-v697: 74/0 is the recorded v697 bar; the standing expectation is "no new bad vs base"** (v702 §3.4's bar): its F pin leg fails on any later pin (it failed identically on the v702 base and new trees) — Implement runs it on the new tree and on base `50542b5` and reports both tallies; the delta must be zero.
- **harness-v688: 65/0** — no new bad.

### §2.7 Risks

- **R1 — A renderer reads a global the swap missed.** The swap list (§2.2.3) is grounded in the renderers' bodies, but a miss paints wrong-day or wrong-pick text silently. Mitigation: harness S9 (sentinel isolation) + L1 (every marker is the fixture day's own text). Implement greps the composed call set for `state.` / module-global reads before writing §3 and names any addition to the swap list there.
- **R2 — `massReadingsHtml`'s memorial/set machinery writes state.** `massStandingSetKey()` writes `rset`/`rsetFor` on `state.mass` — absorbed by the temp object by design (§2.2.3). `massFeedPartHtml` only reads `rchoices`. No other composed renderer writes state (Implement verifies by the R1 grep).
- **R3 — Duplicate-ID leakage.** The composed string must carry **no `id=` attributes from the scroll's hosts** (`mass-readings`, `mass-ep`, `mass-acks`, `mass-universal-section`, `mass-epbody` — note `massEpHtml` returns a wrapper carrying `id="mass-epbody"`: Implement strips that one id attribute from the popup's DOM at §2.2.6 time, or the S9 leg fails on a duplicate when the Lectionary view also stands). Harness S9 asserts the full ID absence list.
- **R4 — The acks tail on the readings-empty arm** (the N2 caveat, §2.6): `massAcksHtml` reads the swapped `massFeed` — an empty-parts fixture with a `copyright[]` line may paint that line at the tail even though the readings place took the honest line. The N2 leg asserts absence; if the standing code paints it, Implement records the deviation in §3 for Review's judgment instead of improvising a guard the Plan did not prescribe.
- **R5 — Long content in a 70dvh panel.** The entire liturgy is far longer than the readings; the panel's internal scroll (§1.5 of v702) carries it — no dress change prescribed. The drag head and alpha row are `flex:none` and stay reachable at any scroll depth (v702 dress, unchanged).

### §2.8 Ordered Implement seat list

1. **Pin** (§2.4): `ui.ts` pin → `ora-pro-nobis-v704-1`. (No dress change expected; §2.3's note governs if one proves necessary.) Commit alone.
2. **The driver + paint** (§2.2/§2.3) in the v702 block in `client.ts`: `liturgyPopupDrive704` + `liturgyPopupPaint704` (snapshot/swap/compose/strip/restore), and the one-seat change in `openLiturgyPopup702` (driver swap). No other function modified; `readingsCardDrive697`/`readingsCardPaint697` untouched. Commit alone.
3. **Harness** `app/worker/harness-v704.mjs` per §2.5, reading the committed fixtures; run it; run the fail-on-old split on base `50542b5` via `ORA_WT`. Commit alone.
4. **Regression runs + the named re-points** (§2.6): re-point `harness-v702.mjs` (O1, O2, O3-inverted, N1-setup — only these), run harness-v702 (all ok), harness-v697 (new tree + base, delta zero), harness-v688 (65/0). Commit the re-points alone, with the harness header comment citing §2.6.
5. **§3 Implement record** in this doc: tallies, the R1 grep outcome (the final swap list as built), the R4/N2 outcome, any deviation named. Commit alone.

## §2A Plan amendment — the Liturgy popup is resizable (2026-11-27)

Appended by chain-v704-plan (Plan-amendment seat), 2026-11-27, after §4 Review PASS and after the un-amended build's deploy (§2A.2). This section amends §2 only; §§1–2 stand as written except where §2A names a change, and the amendment's own Implement and Review records stand as §3A and §4A (§2A.8). No code was changed by this seat.

### §2A.1 Direction

- John, 2026-11-27 17:09 CT, verbatim: **"Also the ability to edit the size of that pop-up"**
- Meaning, in the direction's own terms: the Liturgy popup (§§1–2, the v702 panel as v704 repaints it) is **resizable by the user** — the user edits the panel's size directly, by a drag act on the panel itself. No settings field, no stepper, no menu item: a drag handle on the panel, a size that clamps to the screen, and a size that persists with the panel's other prefs (§2A.5).
- Run level stands: **To Ship** (the release's standing level; the amendment folds into v704 before closeout, §2A.2).

### §2A.2 Chain state — the release stands OPEN, the amendment folds in before closeout

Recorded as verified firsthand by the coordinator:

- The original Ship seat **merged `release/v704` to main** (remote merge **`8abc14a`**) and **deployed the UN-amended build at pin `ora-pro-nobis-v704-1`**; production serves that build now. That deploy happened **before** John's amendment (§2A.1) arrived.
- The coordinator **stopped that Ship seat** on the amendment's arrival.
- **No board closeout happened:** DevOps Board row **1682** still stands at **Scope**; no What's New entry was written; no `shipped_records` row was inserted.
- **Consequence:** v704 is **not** a shipped-and-closed release with a follow-up; it stands **OPEN**, and this amendment is part of v704. The amended build ships under the same release (§2A.6's pin ruling), and §5 (Ship record) will record **both** deploys — v704-1 (un-amended, §2A.2) and v704-2 (amended) — when closeout finally runs.

### §2A.3 The resize act — a grip handle at the panel's bottom-right corner

**Seat chosen: the bottom-right corner of the panel.** Grounds, from the shipped dress and structure:

- The panel (`.litpop702`, `ui.ts:1032`) is a **flex column**: `.litpop702-head` (`flex:none`, the drag-by-head surface, `cursor:grab; touch-action:none`), `.litpop702-alpha-row` (`flex:none`), `.litpop702-body` (`flex:1 1 auto; min-height:0; overflow-y:auto` — the scrolling body). Every other seat is taken or hostile: the head already carries the move drag and the Close button; the alpha row carries the slider; the right edge overlays the body's own scrollbar for the body's full height; the bottom edge alone reads as a height-only act. The **bottom-right corner** is the one seat that is free, is the standard resize seat, and naturally carries a two-axis (width + height) drag. It also never collides with the head, the alpha row, or the Close button at any panel size (§2A.4's minimums keep it clear of them by construction: it stands at the opposite corner from all three).
- **The element:** `openLiturgyPopup702` (`client.ts`, v702 block) appends one more child to the panel, a **sibling after `.litpop702-body`** (never inside it): `<div class="litpop702-resize702" aria-hidden="true"></div>`. It is **not a `button`** and stands **outside `.litpop702-body`**, so §2.5's X2 leg (no `button` element of any kind inside `.litpop702-body`) stands unmodified. It carries no text and no handler beyond the resize wiring (§2A.3, wiring).
- **The dress** (new rule in the `.litpop702` dress block, `ui.ts`, beside the standing rules — the panel is already `position:fixed`, so the handle anchors to the panel itself):
  - `.litpop702-resize702 { position:absolute; right:0; bottom:0; width:28px; height:28px; cursor:nwse-resize; touch-action:none; }` — a **28×28 px hit area** at the corner (large enough for a touch target, small enough never to cover a body line's text run in practice; the body's standing bottom padding, 16px, plus the handle's corner seat keep it over the panel's corner, not over the text column's measure).
  - The grip mark is drawn in the standing dress vocabulary — CSS only, no new asset, no icon font: a diagonal grip of two short strokes in the standing line color, e.g. `background:linear-gradient(135deg, transparent 0 62%, var(--line) 62% 68%, transparent 68% 78%, var(--line) 78% 84%, transparent 84%);` with `border-bottom-right-radius:14px` matching the panel's own radius, so the grip reads as the panel's corner, in the panel's colors, at any alpha (the handle is panel chrome; like the head's text it is **never faded** — the alpha rule paints the panel background only, §2.1 stands).
  - No other dress changes, with one posture rule: the standing `.litpop702` rule's `width:min(92vw, 420px); max-height:70dvh` becomes the **default** posture only. When a size is applied (§2A.5), Implement sets the panel's inline `style.width` / `style.height` **and** `style.maxHeight = 'none'` — otherwise `max-height:70dvh` would silently cap a stored or dragged height the user legitimately chose up to the §2A.4 viewport bound. With no size applied, no inline size stands and the dress posture governs exactly as today.
- **The wiring:** new function **`wireLiturgyPopupResize702(panel, handle)`** in the v702 block in `client.ts`, **beside `wireLiturgyPopupDrag702`**, built on that function's exact mold — the standing pointer-capture pattern:
  - `pointerdown` on the handle: `ev.preventDefault()`; record the start point (`ev.clientX/clientY`) and the start size (`panel.offsetWidth` / `panel.offsetHeight` — the rendered size, which under the default posture is the §2A.5 derived default); `handle.setPointerCapture(ev.pointerId)` in the standing guarded `try` form. (No button-guard is needed — the handle contains no button — and no head-drag can start from it: the head's listener stands on the head element only, and the handle is not inside the head.)
  - `pointermove`: new size = start size + pointer delta (`w = startW + (mv.clientX - startX)`, `h = startH + (mv.clientY - startY)` — a bottom-right drag grows the panel toward the bottom-right, the top-left corner never moves during a resize), passed through the §2A.4 clamp rule, then applied as inline `style.width` / `style.height` (with `style.maxHeight = 'none'` per the posture rule above).
  - `pointerup` / `pointercancel`: remove the three listeners (the drag function's own shape) and **save the prefs**: read `liturgyPopupPrefs702()`, set `x`/`y` from `panel.getBoundingClientRect()` (unchanged by a resize, saved so the record is whole), set `w`/`h` from the rect's rounded width/height, leave `alpha` as read, `liturgyPopupPrefsSave702(p)` — exactly the drag function's save shape, extended by the two fields.
  - Pointer **and** touch ride the same path: pointer events with capture, as the head drag already proves on this panel, and `touch-action:none` on the handle (the head's own standing rule) so a touch drag resizes instead of scrolling the body or the page.

### §2A.4 Bounds — minimums, maximums, and the exact clamp rule

**Named constants** (in the v702 block in `client.ts`, beside the resize wiring; Implement names them `LITPOP702_MIN_W` / `LITPOP702_MIN_H` or buries the literals in the one clamp helper of §2A.4 — one seat only, no second copy):

- **Minimum width: 280px.** Below this the head cannot carry its title block plus the Close button without crowding, and the alpha row's "Transparency" label plus a usable slider run do not fit; the liturgy's text measure also goes unusably narrow.
- **Minimum height: 200px.** The head (~two-line title block + its padding) and the alpha row are `flex:none` and together stand at roughly 100px; 200px guarantees they stand whole, the grip never reaches them, and the scrolling body still shows a real reading window (~100px) beneath them.
- **Maximum: the viewport, and nothing else.** No fixed maximum width or height is named. The governing rule is the panel-rect rule, the same discipline as the move clamp in `litpop702Clamp` (`client.ts` — the panel never leaves the screen): at every moment the panel's rect satisfies **`x ≥ 0 · y ≥ 0 · x + w ≤ window.innerWidth · y + h ≤ window.innerHeight`**.

**The exact clamp rule** — one helper, prescribed as **`litpop702ClampSize702(x, y, w, h)`** returning the clamped `{w, h}` for a panel whose top-left stands at `(x, y)`:

```
availW = max(0, window.innerWidth  - x)
availH = max(0, window.innerHeight - y)
w' = availW < MIN_W ? availW : min(max(w, MIN_W), availW)
h' = availH < MIN_H ? availH : min(max(h, MIN_H), availH)
```

(The viewport wins over the minimum: on a screen too small to offer even the minimum beside the panel's position, the size clamps to what remains rather than pushing the panel off-screen. On any ordinary screen `availW ≥ MIN_W` and `availH ≥ MIN_H`, and the rule is simply `min(max(size, MIN), avail)`.)

**Where the rule applies:**

1. **On every resize move** (§2A.3): the delta size is clamped with `(x, y)` = the panel's current `left`/`top` (the top-left does not move in a resize), so an oversize drag toward the bottom-right stops growing at the screen's right/bottom edges and the panel stands **fully on screen** at the end of any drag — size clamped, position untouched, because with a fixed top-left the size clamp alone keeps the rect inside the rule.
2. **At open** (§2A.5): a stored size is clamped **to the current viewport before it is applied** — first `litpop702ClampSize702(0, 0, w, h)` (the size can exceed neither the viewport's width nor its height, whatever screen saved it), the inline size is set, and **then** the position is clamped by the standing `litpop702Clamp(panel, px, py)` exactly as `openLiturgyPopup702` does today (it reads `panel.offsetWidth`/`offsetHeight`, so it now clamps the position against the **applied size** — a stored position that fit the stored size on a larger screen is pulled back until the whole panel stands on this screen). Rotation and smaller-screen opens are therefore governed by the same two clamps, mirroring the standing position clamp's discipline. After both, the rect rule above holds by construction.

### §2A.5 Prefs — the size persists in the same store, `{x, y, alpha, w, h}`

- **Same store, extended shape:** `localStorage` key **`opn-litpop-v702`** (unchanged — no new key, no migration), prefs shape extended from `{x, y, alpha}` to **`{x, y, alpha, w, h}`**. `liturgyPopupPrefs702()` returns `w` and `h` under the reader's standing guarded form, each **`typeof v.w === 'number' ? v.w : null`** (and likewise `h`) — a corrupt, absent, or non-number field reads as `null`, exactly as `x`/`y` already do. `liturgyPopupPrefsSave702` is unmodified (it stringifies the whole object it is handed).
- **Save sites preserve the size:** every standing save site already reads the prefs through `liturgyPopupPrefs702()` and mutates fields before saving (the drag's `up` handler sets `x`/`y`; the slider's `input` handler sets `alpha`/`x`/`y`). Because the reader now also returns `w`/`h`, those sites carry the stored size through untouched **by construction** — Implement verifies no site builds a fresh `{x, y, alpha}` literal (none does today) and names that check in §3A. The resize save site (§2A.3) is the only site that writes `w`/`h`.
- **Backward compatibility — the v702-shape object (saved by v702 or by the v704-1 build now in production):** a stored object with **no `w`/`h`** (or with either field non-number) reads as `w:null, h:null`, and `openLiturgyPopup702` then applies **no inline size**: the panel opens at the **standing default size** — the current dress posture, `width:min(92vw, 420px)` and height auto up to `max-height:70dvh` — while the stored `x`/`y` (position) and `alpha` are honored exactly as today. Nothing is rewritten in the store at open; `w`/`h` first enter the store when the user first resizes (the resize save, §2A.3) or ride through a later drag/slider save once set.
- **How the default `w`/`h` are derived at first open under the new shape:** they are **not** numbers in the store and are never materialized as prefs — the default width is the dress's own `min(92vw, 420px)` as rendered (`panel.offsetWidth` once appended), and the default height is the panel's content height as rendered under the `max-height:70dvh` cap (`panel.offsetHeight` once appended and positioned). These rendered values are the **start size** the first resize drag measures from (§2A.3: `startW`/`startH` = `offsetWidth`/`offsetHeight` at `pointerdown`), so a first resize begins from exactly the size the user sees, with no jump.
- **A stored size at open:** where `prefs.w` and `prefs.h` both stand as numbers, `openLiturgyPopup702` applies them through the §2A.4 at-open clamps (size-to-viewport, then position) as inline `style.width` / `style.height` with `style.maxHeight = 'none'` (§2A.3's posture rule), **before** the standing position clamp and alpha application, so `litpop702Clamp` measures the sized panel. Where only one of `w`/`h` stands (a hand-edited or partially corrupt object), the standing one applies and the other keeps the dress default — the reader's per-field guard already makes this the natural reading.

### §2A.6 Pin ruling — the amended build deploys at `ora-pro-nobis-v704-2`

- The pin seat in `ui.ts` (the standing pin line, `ui.ts:1224`, currently `ora-pro-nobis-v704-1`) changes **`v704-1` → `ora-pro-nobis-v704-2`** for the amended build. **The release remains v704** — no new version number, no new registry row; §5 will record both deploys (§2A.2).
- **Reason, recorded:** production already serves **v704-1** (§2A.2), and the client records adoption **per pin** before its in-place reload (the v647/v649 discipline) — a phone that has adopted v704-1 treats a same-pin redeploy as the build it already has and never reloads it. A same-pin redeploy of the amended build would therefore **never reach the phones that already took v704-1**. The pin bump is the delivery mechanism, not bookkeeping.

### §2A.7 Harness additions — the R legs for `app/worker/harness-v704.mjs`

New leg group **R** in `harness-v704.mjs`, the v702 mold (the real built Worker bundle served locally, the API stubbed, driven Chromium, **real pointer acts** — the resize is driven by dispatched pointer events on the handle with capture, through the panel's real paints, as the M group's drag legs already drive the head). (Group letter R is the harness group; it is not §2.7's risk numbering.) The legs, each opening the popup through the standing door on a Mass surface as the L/M legs do:

- **R1 (resize drag changes width and height by the drag delta)** — open the popup (no stored size: the default posture), read the panel's rect, drive a pointer drag on `.litpop702-resize702` by **(+80, +60)**; the panel's width stands at start width **+80 (±2px)** and its height at start height **+60 (±2px)**, its `left`/`top` are **unchanged**, and the panel's inline size stands set (the default posture no longer governs).
- **R2 (resize clamps at the minimum and at the viewport edge)** — from the open popup: a drag by **(−600, −600)** leaves the panel at exactly **280×200** (§2A.4's minimums, ±1px), still fully on screen; then a drag by **(+2000, +2000)** toward the bottom-right leaves the panel **fully on screen** — `right ≤ innerWidth` and `bottom ≤ innerHeight` (±1px), `left`/`top` unchanged from the drag's start, width = `innerWidth − left` and height = `innerHeight − top` (±1px) — the §2A.4 rule, driven.
- **R3 (size persists)** — resize by a named delta, close the popup (the standing Close act), read `opn-litpop-v702`: it carries **`w` and `h`** equal to the resized panel's rect (±1px), alongside the standing `x`/`y`/`alpha`. Reopen via "Display Liturgy Text": the panel stands at the **stored size** (±1px) at the stored position, with the handle standing.
- **R4 (v702-shape prefs open at the default size)** — seed `opn-litpop-v702` with a v702-shape object **`{x, y, alpha}` only** (a standing position and `alpha:0.5`, no `w`/`h`), then open: the panel stands at the **default size** — width = `min(92vw, 420px)` as rendered (±1px) and height governed by the standing posture (no inline `style.width`/`style.height` stands on the panel) — with the stored **position honored** (±1px) and the **alpha honored** (the 50% background, the M group's own measure). The leg also asserts the resize handle stands, so the leg as a whole is an amendment leg under the fail-on-old posture below.
- **Groups the amendment does NOT touch:** the standing leg groups **F · L · X · U · D · N · S · M stand unmodified** — no leg in them is edited, re-pointed, or renamed by the amendment. Two interactions are named so they are not discovered mid-Implement: (i) **M's persistence leg** (the v702 P1 shape) asserts the stored object's `x`/`y`/`alpha` fields individually, never the object's exact key set, so a stored `w`/`h` riding alongside does not disturb it; (ii) **X2's** no-`button`-in-the-body assertion is preserved by the handle's seat and element choice (§2A.3), not by any X2 edit.
- **Fail-on-old posture for the R legs:** the R legs **fail on the pre-amendment tree `ebec0de`** (the §4 head; now an ancestor of the amended tree) — on it there is no handle, no resize wiring, and no `w`/`h` in the store, so R1–R3 fail outright and R4 fails on its handle assertion while its default-size/position/alpha assertions stand trivially (it is a compatibility guard for the new tree, in the posture of §2.5's trivially-standing legs). The fail-on-old run for the amendment legs is prescribed with **`ORA_WT` base = `ebec0de`** (not §2.5's `50542b5`, which remains the base for the un-amended release's own split). Implement records both tallies (new tree, `ebec0de`) for the R group in §3A.

### §2A.8 Implement seat list for the amendment (ordered, small)

1. **Dress** (`ui.ts`): the `.litpop702-resize702` rule (§2A.3) in the `.litpop702` dress block. No other dress change. Commit alone.
2. **Pin** (§2A.6): `ui.ts` pin → `ora-pro-nobis-v704-2`. Commit alone (may ride with seat 1 only if §3A names the combined commit as such — the standing habit is one seat, one commit).
3. **Resize wiring** (`client.ts`, v702 block): `liturgyPopupPrefs702` extended to return `w`/`h` under the standing guard (§2A.5) · `litpop702ClampSize702` (§2A.4) · `wireLiturgyPopupResize702` beside `wireLiturgyPopupDrag702` (§2A.3) · `openLiturgyPopup702` — the handle element appended, the stored-size application at open (§2A.5, through the §2A.4 at-open clamps), and the resize wiring call. No other function modified; the drag, slider, door, date rule, paint (v704 block), and teardown sites are untouched. Commit alone.
4. **Harness R legs** (§2A.7): the R group added to `app/worker/harness-v704.mjs`; run it on the new tree; run the fail-on-old split on base **`ebec0de`** via `ORA_WT`. No standing leg edited. Commit alone.
5. **Regressions:** **harness-v704 full** on the new tree — the standing groups F · L · X · U · D · N · S · M at their §3.2/§4.1 tallies (56 ok / 1 bad, the one bad being §3.4's named R4-risk N2 ack leg, unaffected by this amendment) plus the new R group all ok · **harness-v702 unmodified** — its mechanics expectations (drag + clamp · slider · persistence · reachability · teardown · door absences) are already re-proven inside harness-v704's **M group**, which is the re-run that governs; harness-v702 itself re-runs as a smoke check and stands at its §4.4 posture (36 ok / 1 bad, the one bad the F pin-supersession leg — which now supersedes to `v704-2`, the same named artifact class, recorded in §3A, never re-pointed) · **harness-v697** (delta-zero vs its standing base posture, as §2.6) and **harness-v688** (65/0) re-run, since the pin and the v702 block move again. Commit any harness change alone (none is expected beyond seat 4).
6. **§3A — the amendment Implement record**, appended to §3 in this doc by the Implement seat: commits, tallies (harness-v704 full + the R group on the new tree and on `ebec0de`), the §2A.5 save-site check outcome, any deviation named. Commit alone.
7. **§4A — a light Review of the amendment delta only**, appended to §4 in this doc by a Review seat that is not the Implement seat: the delta against `ebec0de` confined to the seats above, the R legs re-run firsthand, the clamp rule and the backward-compatibility leg judged against §2A.4/§2A.5 as written. Ship follows §4A PASS under the release's standing To Ship level, at pin `ora-pro-nobis-v704-2` (§2A.6), and §5 records both deploys (§2A.2).

## §3 Implement record

Built by chain-v704-impl, 2026-11-27. Commits: `1c33094` (seat 1 — pin) · `ceb26ae` (seat 2 — driver + paint + the one-seat driver swap) · `0f7823e` (seat 3 — harness-v704) · `fdb7d6f` (seat 4 — the harness-v702 re-points + regression runs) · this §3 commit. No server change, no board touch, no deploy, no merge.

### §3.1 What was built

- **Pin:** `ui.ts:1224` — `ora-pro-nobis-v704-1`. No dress change was needed (§2.3's note did not trigger: the `.mass-scroll` wrapper governs the popup body under the standing `.litpop702-body` rule).
- **`liturgyPopupPaint704(bodyEl, headEl, massP, readingsP, universalIntentions)`** (`client.ts:18074`, in the v702 block) — the prescribed snapshot/swap/compose/strip/restore shape, exactly:
  - Whole-day arm first (§1.6): a missing payload, `inCalendar:false`, or an empty `versions[]` paints the standing failure line alone — "The day's Mass could not be loaded." in `paintMassLiturgy`'s catch-arm form (`.mass-scroll` + `.mass-rubric`, the line's own curly apostrophe as the standing code carries it).
  - Snapshot `prev = { mass: state.mass, feed: massFeed, readings: massReadings, fb: massUsedFallback }`; swap sets `massFeed = readingsP`, `massReadings = null` (the Universalis OUT — `massBackupPartHtml` self-guards to `''`), `massUsedFallback = false`, and `state.mass` to a fresh temporary object built in `paintMassLiturgy`'s exact construction shape (`client.ts:9392` form), with the §2.2.3 pick rule: a standing same-date `state.mass` carries `version`/`ep`/`penform` and **shallow copies** of `latin`/`rchoices`; otherwise the entry defaults (`version = massP.defaultVersion || versions[0].key`, EP II, penform A, empty `latin`/`rchoices`). The temp object carries `universal: { date, intentions }` from the driver's third fetch, `textSize: massPrefs().size`, `dateLabel: shortDayLabel(dateStr)`.
  - Compose is synchronous, no `await` between swap and restore, calling the scroll's own renderers in the §2.3 sequence verbatim: `massSectionHtml` · `massAntiphonHtml` · `massLinesHtml` (with `MASS_ORDER`/`MASS_ROLES`) · `massPenBodyHtml` (no toggle) · `massPartHtml` (kyrie/gloria-when-flagged/creed-when-flagged/agnus) · `massPrayerHtml` · `massReadingsHtml` at the readings place · `massEpHtml` · `massAcksHtml`, wrapped in `<div class="mass-scroll ts-<size>">`. The two composed-by-hand seams stand as prescribed: the day header (head ICEL notice + `.mass-day` + `.mass-dayname` + `.mass-date`, no row-3 controls) and the Universal Prayer (the `massUniversalSectionHtml` order and `MASS_UP_*` constants/classes, intentions read through `massUniversalState()` against the temp object; the Edit button and `#mass-universal-point` host are never emitted). The readings honest-empty seam: a readings payload missing whole (`found:false`, no parts, or a rejected fetch arriving as `null`) paints `<div class="mass-line readings-none697">Readings not available for this day.</div>` at the readings place instead of `massReadingsHtml()`'s output.
  - Strip, on the popup's own DOM only: `.mass-eptoggle` and every `.mass-ltoggle` removed; every `[data-rchoice]` / `[data-rset]` chip strip removed whole (its `.mass-chips` container); the `id="mass-epbody"` attribute removed from `massEpHtml`'s wrapper (R3). **Nothing is wired** inside the popup body — no `wireMass*` call stands in the v704 block.
  - Restore in a `finally` posture: all four swapped globals return to their snapshot values, throw or not; a renderer throw paints the §1.6 whole-day line after restore. Forbidden calls (§2.2) are all absent from the block: no `paintMassScroll`, no `paintMassLiturgy`, no `massUniversalSectionHtml`, no `massPremassHostHtml`, no `massPersonalListHtml`, no `massHomilyCardHtml`, no `loadMassFeed`/`loadMassReadings`, no `massPersonalLoad`/`massUniversalLoad`, no `wireMass*`.
  - Head (§2.2.8): where `massP.name` stands, the panel head's `.readings-day697` line takes it at settle.
- **`liturgyPopupDrive704(t, resolve704)`** (`client.ts:18221`) — exactly the three §1.2 GETs for `liturgyPopupDate702(t)`, issued in parallel outside the swap, each settling independently (mass rejection → `null` → the whole-day line; readings rejection → `null` → the readings line at its place; universal rejection → `intentions: []`). The panel is resolved through `resolve704()` at settle time.
- **The one-seat driver swap** (`client.ts:18283`): `openLiturgyPopup702`'s closing call now hands the panel to `liturgyPopupDrive704` with the same settle-time resolver; nothing else in the function changed. `readingsCardDrive697` / `readingsCardPaint697` are unmodified. The door, its gate, drag+clamp, the slider, persistence, z-order, the teardown closes, the date rule, and playback are untouched.

### §3.2 Harness — `app/worker/harness-v704.mjs`

New tree: **56 ok, 1 bad** — the one bad is the R4/N2 deviation (§3.4), recorded, not passed over. Per leg group: **F** 5/5 (the §1.8 mass fixture's shape — `inCalendar:true`, `season:'Ordinary Time'`, one `ferial` version, formulary with `collect` + `entranceAntiphon.text` and no `prefaceText` — the two v702 readings fixtures' shapes, and the served v704 pin) · **L1** 9/10 (menu item · tap · popup stands with the head day line taking the Mass payload's name · **exactly the three §1.2 fetches, each `date=2026-11-27`, no other `/api/` fetch** · the entire liturgy in strictly increasing composition order through all 23 markers, ICEL → day name → Entrance Antiphon → "And with your spirit" → Collect text → Liturgy of the Word → both readings citations → Universal Prayer standing parts → Liturgy of the Eucharist → EP II line → Lord's Prayer → Communion Antiphon → Prayer after Communion → Concluding Rites → the ack · the ICEL notice stands **twice**, tail after the ack · the `copyright[]` line as `.mass-ack`; the one L1 bad at first run was the Universalis leg measuring app-boot traffic — the leg now scopes its request log to the popup act's own window, and no `universalis.com` request stands in that window) · **L2** 2/2 (no Gloria heading, no Creed heading on the ferial fixture; the Preface head stands with the Common Preface fallback line) · **X1** 1/1 (homily absence by every §1.5 name) · **X2** 3/3 (editing absence by every §1.5 name · **no `button` element inside the popup body** · a click dispatched on the EP heading changes nothing and issues no fetch) · **U2** 3/3 (the labeled test-data intention paints as a `.mass-line` followed by "Lord, hear our prayer.", the `MASS_UP_EMPTY` line absent, X2's editor absences still holding) · **D1** 2/2 (all three fetches carry `date=2026-11-25`, none carries `2026-11-27`, panel `data-litpop702-date` is `2026-11-25`) · **N1** 2/2 (the whole-day line alone — no Collect, no citation, no other part) · **N2** 2/3 (the readings line at its place with the liturgy standing around it; the ack-absence leg is the R4 deviation, §3.4) · **S9** 6/6 (reference equality of the sentinel `state.mass` with fields untouched · `massFeed`/`massReadings`/`massUsedFallback` sentinel values held · sentinel view content and the watch iframe node + `src` unchanged · no scroll host ID — `mass-readings`, `mass-ep`, `mass-acks`, `mass-universal-section`, `mass-personal-premass`, `mass-epbody` — anywhere in the document · the popup painted the fixture day's liturgy, not the sentinel's intention or copyright) · **L3** 3/3 (Virtual Mass surface: key markers + the same three fetches for the title's date) · **M** 17/17 (the v702 mechanics legs unmodified in substance: door · frame identity · drag + clamp both ways · `elementFromPoint` reachability · slider background-only at both ends with no `opacity` · persistence round-trip `{x, y, alpha:0.5}` · both teardown closes · A1's three absences).

**Fail-on-old** (base `50542b5`, `ORA_WT` on a scratch worktree): **45 ok, 12 bad** — the Plan §2.5 split. Failing: F's pin leg · L1's head-name, fetch-set, composition-order, and ICEL-twice legs · L2's Preface leg · U2's paint leg · D1's fetch-set half · N1 · N2's composition leg · S9's popup-paint half · L3. Standing on base, as prescribed: the fixture-shape legs, L1's door/tap/ack legs, L2's Gloria/Creed absence (trivially, on a readings-only body), X1/X2 (trivially — the readings paint carries none of the named elements), N2's ack leg (the v702 paint drops the copyright on its negative arm — see §3.4), S9's isolation halves (nothing on base disturbs the sentinels), and all of M (standing v702 behavior).

### §3.3 Regressions

- **harness-v702 (re-pointed): 36 ok, 1 bad.** The re-points, and only these, stand in `harness-v702.mjs`, each cited in place to §2.6: (1) **O1's paint assertions** — the citations, Gospel word-string, and `.mass-ack` assertions now read as standing inside the entire-liturgy body (assertions' substance unchanged); (2) **O2's paint assertions** — the same re-point on the Virtual Mass surface; (3) **O3 inverted → O3′** — the body **contains** "And with your spirit" and the fetch log **shows** `/api/prayer/mass?date=2026-11-27` plus the universal-prayer fetch, with a citing header comment at the leg; (4) **N1's setup** — the stub now also serves `/api/prayer/mass` from the §1.8 fixture and `/api/prayer/mass-universal-prayer` empty (without this the v704 driver's parallel fetch never settles in that harness), and **N1's assertion** moves to "the line at the readings place (after 'Liturgy of the Word', before 'The Universal Prayer'), the liturgy around it", its discipline (no citation, no other day's readings text) unmodified. Every other leg is byte-unmodified. The one bad is **F's pin leg** ("the served service worker carries the v702 release pin ora-pro-nobis-v702-1"), which fails for the standing pin-supersession reason — the identical artifact class as harness-v697's F pin leg in v702 §3.4: the v704 pin (§2.4, a named seat of this release) supersedes it. F was not a named re-point and was not touched; every non-pin leg, re-pointed and unmodified alike, is ok. The Plan's "all legs ok" bar therefore stands met in substance, with this one named pin artifact as the exception, recorded here rather than silently re-pointed.
- **harness-v697: 73 ok / 1 bad on the new tree; 73 ok / 1 bad on base `50542b5` — delta zero.** The one bad on both trees is the identical F pin leg (pin supersession, standing).
- **harness-v688: 65 ok / 0 not-ok** — the bar stands.

### §3.4 Deviations and risk outcomes

- **DEVIATION (named, R4 — the N2 acks tail):** on the readings-honest-empty arm, the popup's tail **does** paint the empty fixture's `copyright[]` line as a `.mass-ack`. Mechanism, exactly as R4 foresaw: the prescribed swap sets `massFeed = readingsP` (the 2026-11-26 fixture: `found:true`, `parts:[]`, `copyright[]` 1 line), and the prescribed tail calls the scroll's own `massAcksHtml()`, which paints every `f.copyright` line whenever `f.found` stands — it has no parts-empty guard. The readings place itself takes the honest line and no readings text paints; only the acknowledgment line stands at the tail. The N2 leg asserts the line's absence per the v702 N1 discipline and **fails on the new tree (and passes on base, where the v702 paint's negative arm drops the copyright)** — harness-v704 stands at 56 ok / 1 bad with this leg as the one bad. Per §2.7/R4's disposition, no guard was improvised; the deviation is recorded here for Review's judgment.
- **R1 (a renderer reads a global the swap missed) — grep outcome, swap list complete as prescribed, no addition:** the composed call set (`massFormulary`, `massDayFlags`, `massSectionHtml`, `massAntiphonHtml`, `massLinesHtml`, `massPenBodyHtml` + `massPenForms`/`massPenSamplesHtml`, `massPartHtml` + `massPartLines`, `massPrayerHtml`, `massReadingsHtml` + `massReadingsChipsHtml`/`massStandingSetKey`/`massPickedMemorial`/`massMemorialPartsHtml`/`massFeedPartHtml`/`massBackupPartHtml`, `massEpHtml`, `massAcksHtml`, `massUniversalState`) was grepped for `state.` and module-global reads. Every read found is one of: `state.mass.payload` · `state.mass.version` · `state.mass.date` · `state.mass.penform` · `state.mass.payload.season` (via `massPenSamplesHtml`) · `state.mass.latin` · `state.mass.ep` · `state.mass.rchoices` · `state.mass.universal` · `state.mass.rset`/`rsetFor` — all carried by the temporary object — or the three swapped globals `massFeed` · `massReadings` · `massUsedFallback`. The only writes in the set are `massReadingsHtml`'s `massUsedFallback` assignment and `massStandingSetKey`'s `rset`/`rsetFor` writes, both absorbed by the swap/temp object (R2's posture, proven by S9). No renderer in the set touches `view` or the document. `massPrefs()` reads `localStorage` only (the standing text-size preference, read for the temp object's `textSize` — not swapped state). **Final swap list as built: `state.mass` (temp) · `massFeed` · `massReadings` · `massUsedFallback` — the Plan's list, unchanged.**
- **R3 (duplicate IDs):** stands — the strip removes the `mass-epbody` id at paint time and the composed string carries no other scroll host ID; harness S9 asserts the full absence list against the whole document.
- **R5 (long content):** no dress change was taken; the panel's standing internal scroll carries the full liturgy (the M drag/slider legs pass at full content length).

## §3A Amendment Implement record (§2A)

Built by chain-v704-impl, 2026-11-27, on `release/v704` from the Plan-amendment head `d158c53`. Commits: `dfbac64` (§2A seat 1 — dress) · `14e621f` (§2A seat 2 — pin) · `a8acf25` (§2A seat 3 — resize wiring) · `04e3795` (§2A seat 4 — harness R group) · this §3A commit (seat 5's regression runs changed no file). No board touch, no deploy, no merge.

### §3A.1 What was built

- **Dress (§2A seat 1, `ui.ts`):** one new rule in the `.litpop702` dress block — `.litpop702-resize702 { position:absolute; right:0; bottom:0; width:28px; height:28px; cursor:nwse-resize; touch-action:none; background:linear-gradient(135deg, transparent 0 62%, var(--line) 62% 68%, transparent 68% 78%, var(--line) 78% 84%, transparent 84%); border-bottom-right-radius:14px; }` — the §2A.3 grip (CSS-only diagonal strokes in `var(--line)`, the panel's radius at the corner). The panel's positioning context was verified firsthand: `.litpop702` stands `position:fixed`, so the absolute handle anchors to the panel. No other dress change.
- **Pin (§2A seat 2, `ui.ts`):** `ora-pro-nobis-v704-1` → **`ora-pro-nobis-v704-2`** (§2A.6).
- **Resize wiring (§2A seat 3, `client.ts`, v702 block only):**
  - `liturgyPopupPrefs702()` extended: the return object now also carries `w` / `h`, each under the standing guard (`typeof v.w === 'number' ? v.w : null`, likewise `h`); the absent/corrupt-store default return carries `w:null, h:null`. `liturgyPopupPrefsSave702` is unmodified. The store key `opn-litpop-v702` is unchanged.
  - `litpop702ClampSize702(x, y, w, h)` beside `litpop702Clamp`, exactly per §2A.4: `availW = max(0, innerWidth − x)`, `availH = max(0, innerHeight − y)`; `w' = availW < 280 ? availW : min(max(w, 280), availW)`; `h'` likewise with 200. The literals stand in this one helper only.
  - `wireLiturgyPopupResize702(panel, handle)` beside `wireLiturgyPopupDrag702`, in its pointer-capture mold: `pointerdown` (`preventDefault`, guarded `setPointerCapture`, start pointer + `panel.offsetWidth/offsetHeight` recorded), `pointermove` applies the size clamped via `litpop702ClampSize702` at the panel's current left/top as inline `style.width` / `style.height` and sets `style.maxHeight = 'none'` (§2A.3 posture rule), `pointerup`/`pointercancel` removes the three listeners and saves the prefs whole — read `liturgyPopupPrefs702()`, set `x`/`y`/`w`/`h` from the panel's rounded bounding rect, `alpha` as read, `liturgyPopupPrefsSave702(p)`.
  - `openLiturgyPopup702`: the handle element `<div class="litpop702-resize702" aria-hidden="true"></div>` is appended as a panel child **after** `.litpop702-body` (a sibling, never inside the body; not a `button` — §2.5 X2's no-button-in-body leg stands unmodified and passes), and `wireLiturgyPopupResize702` is called beside the drag wiring. Stored-size application at open, per §2A.4's at-open rule: where `prefs.w` and/or `prefs.h` stand as numbers, the size is first clamped by `litpop702ClampSize702(0, 0, w, h)` (the size can exceed neither viewport dimension), the standing field(s) applied as inline `style.width` / `style.height` (with `style.maxHeight = 'none'` when a height is applied), and **then** the standing `litpop702Clamp` position pass runs against the applied size. Where only one of `w`/`h` stands, that one applies and the other keeps the dress default (§2A.5). Where neither stands: no inline size, the standing default dress governs, and the store is **not** rewritten at open.
  - Untouched, verified by the delta: the door/gate, the move drag, the slider, the v704 content composition (§§1–2 build), teardown, playback. The amendment delta against `d158c53` is confined to `ui.ts` (the dress rule + the pin line), `client.ts` (the v702 block), and `harness-v704.mjs` (additions only).

### §3A.2 Save-site check (§2A.5) — no fix needed

Every `liturgyPopupPrefsSave702` call site was read firsthand. All three sites read the prefs through `liturgyPopupPrefs702()` and mutate fields on that object before saving — the slider's `input` handler (sets `alpha`/`x`/`y`), the drag's `up` handler (sets `x`/`y`), and the new resize `up` handler (sets `x`/`y`/`w`/`h`). **No site builds a fresh `{x, y, alpha}` literal**, so with the reader now returning `w`/`h`, a stored size rides through drag and slider saves untouched by construction. No save-site fix was required and none was made.

### §3A.3 Harness — group R and the full tallies

- **Group R, new tree: 13 ok / 0 bad.** **R1** 2/2 (setup + the (+80, +60) drag: width +80, height +60, ±2px, left/top unchanged, inline size set — the leg first drives a preliminary shrink drag so the default-posture panel, 359px wide on the harness's 390px viewport, has room for the +80 delta inside the §2A.4 clamp; the asserted drag is measured from the post-shrink rect) · **R2** 3/3 (setup · the (−600, −600) drag clamps at exactly 280×200 · the (+2000, +2000) drag clamps at the viewport edge: width = `innerWidth − left`, height = `innerHeight − top`, ±1px, left/top unchanged, panel fully on screen) · **R3** 4/4 (setup · `opn-litpop-v702` carries `w`/`h` equal to the resized rect ±1px alongside `x`/`y`/`alpha` · reopen tap · the reopened panel stands at the stored size ±1px at the stored position, handle standing) · **R4** 4/4 (setup · v702-shape prefs open at the default size: no inline `style.width`/`style.height`, rendered width = `min(92vw, 420px)` ±1px · stored position ±1px and the 50% background honored · the handle stands).
- **Group R, fail-on-old on base `ebec0de`** (`ORA_WT` on a scratch worktree, removed after): the substantive legs fail exactly per §2A.7's posture — **R1's drag leg fails outright** (no handle: size and position unchanged, no inline size), **R2's minimum and viewport-edge legs both fail outright**, **R3's store leg fails** (the store reads `null` — no resize save stands) **and its reopen leg fails** (no stored size, no handle), and **R4 fails on its handle assertion only** — its default-size and position/alpha legs stand trivially on the old tree, as prescribed. The R setup legs (the standing door tap) pass on both trees. Full old-tree run: 63 ok / 7 bad (the 6 R failures above + the N2 ack leg of §3.4, which stands on `ebec0de` by the same mechanism §4.3 judged).
- **harness-v704 full, new tree: 68 ok / 2 bad.** The standing groups stand byte-unmodified (the harness diff is additions only: the header's amendment note + group R) and read **55 ok / 2 bad**; group R adds 13 ok / 0 bad. The two bad: (1) the **N2 ack leg** — §3.4's named deviation, judged acceptable in §4.3, unaffected by this amendment; (2) the **F pin leg** — a deviation of tally expectation only, named in §3A.5.

### §3A.4 Regressions (§2A.8 seat 5)

- **harness-v702 (unmodified): 36 ok / 1 bad** — the one bad is the F pin leg, the standing pin-supersession artifact: it expects `ora-pro-nobis-v702-1` while the served pin is now `ora-pro-nobis-v704-2` (the same leg, the same artifact class as at §4.4, superseding one pin further). Every mechanics leg (drag + clamp · slider · persistence · reachability · teardown · door absences) is ok; the M group inside harness-v704 re-proves the same mechanics on the amended build (17/17).
- **harness-v697: 73 ok / 1 bad on the new tree; 73 ok / 1 bad on base `50542b5` — delta zero.** The one bad on both trees is the identical F pin leg.
- **harness-v688: 65 ok / 0 not-ok** — the bar stands.

### §3A.5 Deviations

- **DEVIATION (tally only, named — harness-v704's F pin leg):** §2A.8 seat 5 states the standing groups at their §4.1 tally (56 ok / 1 bad). On the amended tree they read **55 ok / 2 bad**: the second bad is F's pin leg ("the served service worker carries the v704 release pin ora-pro-nobis-v704-1"), which fails by the §2A.6 pin bump itself — the served pin is `ora-pro-nobis-v704-2`, a named seat of this amendment. This is the identical pin-supersession artifact class judged for harness-v702's F leg in §4.4 and for harness-v697's F leg throughout: a pin leg written against the release's first pin cannot stand after the release's own prescribed pin bump. The standing groups stand **byte-unmodified** per §2A.7/§2A.8 (no leg edited, re-pointed, or renamed), so F was not re-pointed; the failure is recorded here for §4A's judgment instead. No behavior is implicated: group F's four fixture-shape legs all pass, and group R plus the M group prove the amended build end to end.
- No other deviation. §2A's prescription proved implementable at every seat as written: the handle seat, the bounds, the clamp rule, the prefs shape, and the at-open order all stand as prescribed. The §3.4 R4/N2 acks-tail deviation is unchanged by this amendment (it is one of the two bad above, carried, not new).

## §4 Review record

**Verdict: PASS**

Reviewed by chain-v704-review, 2026-11-27 — light, independent review. Every tally below was re-run firsthand on the Implement head `7f833ca`; no §3 number was taken on trust. One named deviation (§3.4, the R4/N2 acks tail) and one pin-supersession exception (harness-v702's F leg) were judged; both are acceptable as named, per the v702 §4.6 precedent. Nothing was fixed by this seat; no code, board, or production surface was touched.

### §4.1 Independent tallies

- **harness-v704 (new tree): 56 ok / 1 bad.** Per leg group, counted from the run output: **F** 5/5 · **L1** 10/10 (door · tap · popup with the head day line taking the Mass payload's name · exactly the three §1.2 fetches, each `date=2026-11-27`, no other `/api/` fetch · no Universalis request · the entire liturgy in strictly increasing composition order through all markers · the ICEL notice twice, tail after the ack · the `copyright[]` line as `.mass-ack`) · **L2** 2/2 · **X1** 1/1 · **X2** 3/3 · **U2** 3/3 · **D1** 2/2 · **N1** 2/2 · **N2** 2/3 (the one bad — the R4 ack leg, §4.3) · **S9** 6/6 · **L3** 3/3 · **M** 17/17. Matches §3.2 exactly, including which leg is the one bad.
- **harness-v702 (re-pointed, new tree): 36 ok / 1 bad** — the one bad is the F pin leg (§4.4). Every re-pointed leg (O1, O2, O3′, N1) and every unmodified leg is ok. Matches §3.3.
- **harness-v697 (new tree): 73 ok / 1 bad** — the single bad is the identical F pin leg ("the served service worker carries the v697 release pin ora-pro-nobis-v697-1"). Matches §3.3.
- **harness-v688 (new tree): 65 ok / 0 not-ok** — the bar stands. Matches §3.3.

### §4.2 Fail-on-old reproduction

harness-v704 run against base `50542b5` via `ORA_WT` on a scratch worktree (removed after): **45 ok / 12 bad** — the Plan §2.5 split, leg for leg. The 12 failing, read from the run output: F's pin leg · L1's head-name, fetch-set, composition-order, and ICEL-twice legs · L2's Preface leg · U2's paint leg · D1's fetch-set half · N1 · N2's composition leg · S9's popup-paint half · L3. Standing on base, as prescribed: the fixture-shape legs, L1's door/tap/ack legs, L2's Gloria/Creed absence (trivially, on a readings-only body), X1/X2 (trivially), N2's ack leg (the v702 paint's negative arm drops the copyright — the mirror image of §4.3), S9's isolation halves, and all of M (standing v702 behavior). Matches §3.2.

### §4.3 Deviation judged — the R4/N2 acks tail (§3.4)

**Judged: acceptable as named, not a defect.**

- **Mechanism (verified in the code):** the prescribed swap sets `massFeed` to the readings payload, and the prescribed tail calls the scroll's own `massAcksHtml()` (`client.ts:8550`): it paints every `f.copyright` line whenever `f && f.found && f.copyright` — it has no parts-empty guard. The 2026-11-26 fixture is `found:true, parts:[], copyright[]` 1 line, so the ack line stands at the popup's tail on the readings-honest-empty arm. Implement improvised no guard; the deviation is recorded in §3.4 with this mechanism, which is the disposition Plan §2.7/R4 prescribed.
- **The governing standard is the scroll the popup mirrors, and the scroll does the same thing:** `paintMassScroll` composes its own tail from the same function over the same global — `h += '<div id="mass-acks">' + massAcksHtml() + '</div>'` (`client.ts:8724`). For this same payload state (`found:true`, `parts:[]`), the Worship Mass scroll therefore also stands the payload's copyright line at its tail. The popup matches the surface it mirrors. Plan §1.6's rule — per-part omission as the scroll itself does it — and §1.3 row 34 (acknowledgments: feed copyright lines IN) govern over the stricter discipline of the v702 readings-only card, whose negative arm (`readingsCardPaint697`, `client.ts:17958` — returns the honest line before its copyright loop) belonged to a card that painted readings and nothing else.
- **No readings text is painted on this arm:** in this review's own harness-v704 run, the N2 composition leg passes — "Readings not available for this day." stands at the readings place (after "Liturgy of the Word", before "The Universal Prayer") with the liturgy standing around it — and the failing leg's own evidence shows the only extra text is the copyright/acknowledgment line itself. An acknowledgment of the lectionary edition is not a reading, and painting it is the scroll's standing behavior, not a leak of another day's text.

### §4.4 The harness-v702 F-pin exception judged

**Judged: a pin-supersession artifact, not a regression — the v702 §3.4/§4.2 precedent applies directly.**

- harness-v702 **as it stands on base** `50542b5`, run against the base tree via `ORA_WT`, reads **37 ok / 0 bad** (firsthand, this review).
- On the new tree the re-pointed harness reads 36 ok / 1 bad, and the delta against base is exactly one leg: F's pin leg, which expects `ora-pro-nobis-v702-1` while the v704 pin seat (§2.4, a named seat of this release) serves `ora-pro-nobis-v704-1`.
- F was **not** a named re-point and stands byte-unmodified: the `harness-v702.mjs` diff against base touches only the header re-point comment, the N1-setup stub (the mass + universal-prayer routes and the §1.8 fixture const), and the O1/O2/O3′/N1 legs — each cited in place to §2.6. No other leg changed, and every non-pin leg is ok on the new tree.
- The Plan's "all legs ok" bar therefore stands met in substance, with this one named pin artifact as the exception — the same artifact class, judged the same way, as harness-v697's F pin leg under v702.

### §4.5 Code verification (delta `50542b5..HEAD`, read firsthand)

- **One-seat driver swap:** the client.ts delta is exactly two hunks — the v704 block insertion beside `openLiturgyPopup702`, and inside that function the closing call's change from `readingsCardDrive697(t, …)` to `liturgyPopupDrive704(t, …)` with the same settle-time resolver (plus its comment). `readingsCardDrive697` / `readingsCardPaint697` themselves are unmodified (their only appearance in the delta is the removed call line). The date rule is untouched: the driver asks `liturgyPopupDate702(t)` = `episodeDate697(t)`.
- **No forbidden call in the popup path:** the added lines contain `paintMassScroll`, `massUniversalSectionHtml`, and `massHomilyCardHtml` only inside comments stating they are never called. No call to `paintMassScroll`, `paintMassLiturgy`, `massUniversalSectionHtml`, `massHomilyCardHtml`, `massPremassHostHtml`, `massPersonalListHtml`, any `wireMass*`, or any homily record function stands in the v704 block. The Universal Prayer seam is composed from the `MASS_UP_*` constants, as prescribed.
- **Synchronous compose:** `liturgyPopupPaint704` contains no `await` anywhere (grep of the function body: none) — snapshot, swap, compose, strip, and the `finally` restore all run in one synchronous span, exactly as §2.2.4 requires.
- **Strip list stands:** the paint removes `.mass-eptoggle` and every `.mass-ltoggle`, removes every `[data-rchoice]` / `[data-rset]` chip strip whole (its `.mass-chips` container), and removes the `id` attribute from the `#mass-epbody` wrapper. Nothing is wired in the body.
- **No button in the popup body; exclusions by name:** harness X1/X2 pass driven in this review's run — no homily element by any §1.5(a) name (`#mass-homily-host`, `.homily-rec-card`, `#mass-homily-rec`, `#mass-homily-stop`, `#mass-homily-note-field`/`-save`/`-edit`, "Record the homily"), no editing affordance by any §1.5(b) name (`[data-version]`, `[data-tsize]`, `[data-pen]`, `[data-ep]`, `[data-lt]`, `[data-rchoice]`, `[data-rset]`, `#mass-universal-edit-btn`, the `[data-mu*]` set, `.mu-input`, personal-seat acts), and no `button` element of any kind inside `.litpop702-body`; a click dispatched inside the body changes nothing and issues no fetch. The X legs assert exactly §1.5's name lists.
- **Fetch set is exactly the three named GETs:** the only `api(` calls in the added code are the driver's three — `/api/prayer/mass`, `/api/prayer/mass-readings`, `/api/prayer/mass-universal-prayer`, each `?date=` + the popup date — and harness L1's fetch-log leg proves the same set driven, with no other `/api/` fetch and no Universalis request.
- **Mechanics untouched:** no hunk touches the door or its gate (`openDockMenu`, `liturgyPopupSource702`), the drag/clamp code, the slider/alpha code, the prefs store, the `.litpop702` dress, the z-45 rule, or any teardown call site; harness M re-proves all of them (17/17) on the new content.

### §4.6 State isolation (S9)

The S9 legs are **driven assertions in the harness source**, not paint claims: the harness installs a sentinel `state.mass` (a different date, marker picks, a sentinel Universal intention), sentinel `massFeed` / `massReadings` / `massUsedFallback` values, and a sentinel view node beside the watch frame, then after the popup paints asserts — in page context — reference equality (`state.mass === window.__sentMass`), the sentinel fields untouched, the three globals holding their sentinel values, the sentinel view content standing, the watch iframe the identical node with the identical `src`, and no scroll host ID (`mass-readings`, `mass-ep`, `mass-acks`, `mass-universal-section`, `mass-personal-premass`, `mass-epbody`) anywhere in the document. All six legs passed in this review's own run, and the popup painted the fixture day's liturgy — not the sentinel's intention or copyright — under that sentinel state.

### §4.7 Pin and delta confinement

- **Pin:** `ui.ts:1224` carries `ora-pro-nobis-v704-1`; the ui.ts diff is exactly that one line (`v702-1` → `v704-1`). Nothing else version-shaped changed anywhere in the delta.
- **Delta vs `50542b5` — 6 files, confined to the named seats:**
  - `app/worker/src/client.ts` — the v704 block (`liturgyPopupPaint704` + `liturgyPopupDrive704`) plus the one-seat driver swap in `openLiturgyPopup702`; nothing else.
  - `app/worker/src/ui.ts` — the pin line only.
  - `app/worker/harness-v704.mjs` — new.
  - `app/worker/harness-v702.mjs` — only the §2.6 named re-points (O1, O2, O3-inverted, N1-setup + its assertion), each cited in place.
  - `app/worker/fixtures/mass-2026-11-27.json` — the §1.8 Plan fixture.
  - `docs/releases/v704-liturgy-popup-entire-liturgy.md` — this release doc.
- No server file, no other repo, no board or production surface touched.

**Disposition: PASS — cleared for Ship.**

## §4A Amendment Review record (§2A)

**Verdict: PASS**

Reviewed by chain-v704-review, 2026-11-27 — light, independent review of the amendment delta only (`d158c53..d570ddf`). Every tally below was re-run firsthand on the amendment head `d570ddf`; no §3A number was taken on trust. One named deviation (§3A.5, harness-v704's F pin leg) was judged; it is acceptable as named, per the §4.3/§4.6 precedent. The other bad in the full tally is exactly §3.4's N2 ack leg, already judged acceptable in §4.3 — not a new failure. Nothing was fixed by this seat; no code, board, or production surface was touched, and no deploy was made.

### §4A.1 Independent tallies

- **harness-v704 (new tree): 68 ok / 2 bad.** Group **R: 13 ok / 0 bad** (R1 2/2 · R2 3/3 · R3 4/4 · R4 4/4). The standing groups read **55 ok / 2 bad**, byte-unmodified. The two bad, read from this review's own run output, are exactly: (1) **F's pin leg** ("the served service worker carries the v704 release pin ora-pro-nobis-v704-1") — the §3A.5 deviation, judged in §4A.3; (2) **N2's ack leg** — §3.4's named R4 deviation, judged acceptable in §4.3, unchanged by this amendment. Group F's four fixture-shape legs all pass. Matches §3A.3 exactly.
- **harness-v702 (unmodified, new tree): 36 ok / 1 bad** — the one bad is its F pin leg, the standing pin-supersession artifact (expects `ora-pro-nobis-v702-1`, served pin is now `ora-pro-nobis-v704-2`). Matches §3A.4.
- **harness-v697: 73 ok / 1 bad on the new tree; 73 ok / 1 bad on base `50542b5` — delta zero.** The one bad on both trees is the identical F pin leg. Matches §3A.4 (the base tally was re-run firsthand in this review, via `ORA_WT` on a scratch worktree, removed after).
- **harness-v688 (new tree): 65 ok / 0 not-ok** — the bar stands. Matches §3A.4.

### §4A.2 Fail-on-old reproduction (amendment legs)

harness-v704 run against base `ebec0de` via `ORA_WT` on a scratch worktree (removed after): **63 ok / 7 bad** — the §2A.7 split, leg for leg. The 7 failing, read from the run output: **R1's drag leg fails outright** (no handle: size and position unchanged, no inline size) · **R2's minimum leg and viewport-edge leg both fail outright** · **R3's store leg fails** (the store reads `null` — no resize save stands) **and its reopen leg fails** (no stored size, no handle) · **R4 fails on its handle assertion only** — its default-size and position/alpha legs stand trivially on the old tree, as prescribed · plus the standing **N2 ack leg** (§3.4/§4.3, which stands on `ebec0de` by the same mechanism). The R setup legs (the standing door tap) pass on both trees. Matches §3A.3 exactly.

### §4A.3 Deviation judged — harness-v704's F pin leg (§3A.5)

**Judged: acceptable as named, not a defect. F is not to be re-pointed.**

- **Mechanism:** harness-v704's own F leg asserts the pin `ora-pro-nobis-v704-1`. The §2A.6-prescribed pin seat — a named seat of this amendment, adopted because production already serves v704-1 and adoption is per-pin — serves `ora-pro-nobis-v704-2`. The leg therefore fails on the amended tree **by the amendment's own prescription**, not by any behavior defect: the served pin is exactly the pin §2A.6 ordered.
- **The precedent governs directly:** §4.4 judged the identical artifact for harness-v702's F leg (expects `ora-pro-nobis-v702-1`, superseded by this release's prescribed pin) and the same class has stood for harness-v697's F leg throughout — a pin leg written against a release's first pin cannot stand after that release's own prescribed pin bump. This is that artifact, one bump further along the same chain.
- **Re-pointing is the wrong fix:** §2A.7/§2A.8 prescribe the standing groups **byte-unmodified** — no leg edited, re-pointed, or renamed — and the harness delta in fact stands additions-only (§4A.5). Re-pointing F to v704-2 would break that prescription to make a tally read clean, and would erase the leg's supersession signal for the next bump. The failure is tally-only: group F's fixture-shape legs pass 4/4, and groups R and M prove the amended build end to end on the pin that actually serves.

### §4A.4 Code verification (amendment delta `d158c53..d570ddf`, read firsthand)

- **Handle seat and X2:** in `openLiturgyPopup702` the panel markup appends `<div class="litpop702-resize702" aria-hidden="true"></div>` **after** `<div class="litpop702-body"></div>` in the same `innerHTML` string — a sibling after the body, never inside it, a `div`, not a `button`. Harness X2 passed in this review's run (no `button` element of any kind inside `.litpop702-body`), and the seat read in the code is the reason it passes.
- **Resize wiring follows the drag mold:** `wireLiturgyPopupResize702(panel, handle)` stands beside `wireLiturgyPopupDrag702`, guards a missing handle, and on `pointerdown` does `preventDefault()`, records start pointer + `panel.offsetWidth/offsetHeight`, and takes pointer capture in the standing guarded `try` form. `pointermove` applies the clamped size; the shared `up` handler for `pointerup`/`pointercancel` removes all three listeners (move/up/cancel) and only then saves the prefs. No listener survives an up/cancel.
- **Clamp rule exact:** `litpop702ClampSize702(x, y, w, h)` is §2A.4's formula verbatim — `availW = max(0, innerWidth − x)`, `availH = max(0, innerHeight − y)`; `w' = availW < 280 ? availW : min(max(w, 280), availW)`; `h'` likewise with 200. Minimums 280×200, maximum the viewport remainder, the viewport wins over the minimum. The literals stand in this one helper only.
- **Posture rule:** applying a size sets inline `maxHeight = 'none'` — in the resize `move` handler unconditionally with the inline width/height, and at open when a stored height is applied (the only case the standing `max-height:70dvh` could cap; a width-only application needs no such release). This is §2A.3's rule as §3A.1 recorded it.
- **Open-time order:** size first, position second — where `prefs.w` and/or `prefs.h` stand, `openLiturgyPopup702` clamps through `litpop702ClampSize702(0, 0, …)`, sets the standing field(s) inline, and **then** computes `px`/`py` and runs the standing `litpop702Clamp(panel, px, py)`, which measures `panel.offsetWidth/offsetHeight` — now the applied size. A stored position that fit a larger screen is pulled back against the applied size, as §2A.4.2 prescribes.
- **Prefs reader and the three save sites:** `liturgyPopupPrefs702()` returns `w`/`h` each under `typeof v.w === 'number' ? v.w : null` (likewise `h`), and the corrupt/absent default return carries `w:null, h:null`; the store key is unchanged and `liturgyPopupPrefsSave702` is unmodified. All three save sites were read firsthand — the slider's `input` handler, the drag's `up` handler, and the resize `up` handler — and **every one reads `liturgyPopupPrefs702()`, mutates fields on that object, and saves it; no site builds a fresh `{x, y, alpha}` literal**, so a stored size rides through drag and slider saves untouched by construction.
- **Null size at open:** where neither `w` nor `h` stands, the application branch does not run — **no inline size is written and no save call stands in the open path, so the store is not rewritten at open**. R4 proves the posture driven: v702-shape prefs open with no inline `style.width`/`style.height`, at the default rendered width, with position and alpha honored.

### §4A.5 Pin and delta confinement

- **Pin:** `ui.ts` carries `ora-pro-nobis-v704-2` (the `SW_JS` CACHE line); a grep of the full delta for version-shaped strings finds no other version change anywhere.
- **Delta vs `d158c53` — 4 files, confined to the §2A.8 seats:**
  - `app/worker/src/ui.ts` — 2 insertions / 1 deletion: the `.litpop702-resize702` dress rule (§2A seat 1) + the pin line (§2A seat 2). Nothing else.
  - `app/worker/src/client.ts` — the v702 block only: the prefs reader's `w`/`h` fields, `litpop702ClampSize702`, the handle element + stored-size application + resize wiring call in `openLiturgyPopup702`, and `wireLiturgyPopupResize702`. No other function modified; the drag, slider, door, date rule, v704 paint, and teardown sites are untouched.
  - `app/worker/harness-v704.mjs` — **additions only (103 insertions, 0 deletions)**: the header's amendment note + group R. The standing groups F · L · X · U · D · N · S · M are byte-unmodified, verified by the diff itself.
  - `docs/releases/v704-liturgy-popup-entire-liturgy.md` — §2A/§3A records (and this §4A).
- No server file, no other harness, no other repo, no board or production surface touched.

### §4A.6 R-leg quality

- **The R legs are driven, not paint claims:** the harness's `dragResize` helper reads the handle's real rect in page context and drives it with real Chromium mouse acts (`pg.mouse.move` to the handle's center, `down`, a stepped `move` by the named delta, `up`) through the panel's real paints and its real pointer-capture wiring; every R assertion then reads the panel's live rect, its inline style, or the real `opn-litpop-v702` store. R3's persistence leg closes via the standing Close act and reopens through the standing door.
- **R1's preliminary shrink drag does not weaken the leg:** the shrink is itself a real resize drag on the same handle, standing as setup only because the default-posture panel (359px wide on the harness's 390px viewport) has no room for a +80 delta inside the §2A.4 clamp. The asserted drag is measured from the **post-shrink rect** — a real, rendered size — and asserts the full +80/+60 delta (±2px) with left/top unchanged and the inline size set. The setup manufactures nothing: the quantity asserted is a delta produced by the asserted drag itself, against the real clamp, and R2 separately proves both clamp bounds driven. On the old tree the same leg fails outright (§4A.2), which a paint claim could not do.

**Disposition: PASS — cleared for Ship at pin `ora-pro-nobis-v704-2`.**

## §5 Ship record

**Shipped LIVE at pin `ora-pro-nobis-v704-2` — 2026-11-27.**

Ship seat: chain-v704-ship (re-seated after a ruled stop; standing Ship contract 1270).

### §5.1 Direction and amendment

- Direction (John, 2026-11-27 16:52 CT, replying to the v702 ship report, verbatim): **"Not just the readings. The entire liturgy. Homily recording and custom editing can be excluded."** Run level: **To Ship.**
- Amendment (John, 2026-11-27 17:09 CT, verbatim): **"Also the ability to edit the size of that pop-up"** — folded into v704 before closeout as §2A (Plan amendment), §3A (Implement), §4A (Review).

### §5.2 Review verdicts

- **§4 Review: PASS** (chain-v704-review, on Implement head `7f833ca`; harness-v704 56 ok / 1 bad — the one bad the §3.4 R4/N2 acks tail, judged acceptable; harness-v702 36/1 pin artifact; harness-v697 73/1; harness-v688 65/0).
- **§4A Amendment Review: PASS** (chain-v704-review, on amendment head `d570ddf`; harness-v704 68 ok / 2 bad — F pin leg §3A.5 deviation judged acceptable, N2 ack leg already judged in §4.3; group R 13/13; harness-v702 36/1; harness-v697 delta zero; harness-v688 65/0). Amendment chain: §2A `d158c53` · §3A `d570ddf` · §4A `ab34138`.

### §5.3 First merge and first deploy (v704-1, un-amended build)

- The first Ship seat merged `release/v704` → main: merge commit **`8abc14a`**.
- That seat deployed the **un-amended** build at pin **`ora-pro-nobis-v704-1`**: Worker version ID **`f1736ed6-15b5-47ca-9b25-f63b510282b4`**, deployment created **2026-11-27T23:10:16.827Z** at **100%** (identified from the Worker's deployment history by that seat; re-confirmed in this seat's deployment listing).
- John's amendment (§5.1) then arrived; the **coordinator stopped that Ship seat**. **No board closeout happened** at that point (row 1682 stood at Scope; no What's New, no shipped_records row). Production served v704-1 until the second deploy (§5.5).

### §5.4 The ruled stop and the coordinator's re-authorization

- The second Ship seat stopped per its stop condition because **remote main had moved**: v703's ship landed on main (merge `e33e521` + §5 `89e98ab`).
- The **coordinator verified firsthand** and ruled: remote main stands at **`89e98ab54982bac5c81da1526791f92bee323b86`** (tree `e8a69cc1998ba139ec7aa59b58b2663b1f476ecf`); v703's delta vs `8abc14a` is **only** `docs/releases/v703-auxilium-double-introduction.md` (225 insertions, no overlap with v704). The coordinator **re-authorized the merge with parent `89e98ab`**, with the standing condition: if remote main had moved beyond `89e98ab` at re-read, stop and report again. At this seat's re-read, remote main stood exactly at `89e98ab`.

### §5.5 Second merge (tree-exact, Git Data API)

- Branch verified firsthand: `release/v704` head **`ab34138`**, tree `3d058c1a47f217fb9864416cff5712d6d19b7074`, clean; amendment blobs re-asserted: `app/worker/src/ui.ts` `ca39a41d2740a3b68b8e9bf0110ee77ffac9de9a` · `app/worker/src/client.ts` `399938c31b9895f71d224a0d60577f9dd81153fa` · `app/worker/harness-v704.mjs` `f6353133bfda2228a6ae8acf2ceea52bd09a7d5b` · this doc `c6e9d31d680fd43d1eb570c3cc78e0207ca23340`.
- Merge commit: **`2ae8e28ad2c8f7ce70a3f81126567de84f5ba689`**, parent `89e98ab`, tree **`e6672b4086b93a00182111c8b01d9afd79c01267`**. Never force-pushed; the release branch stays local.
- Tree assertions (all passed): every one of the 4 amendment delta blobs in the merged tree == the branch blob · the v703 doc blob in the merged tree == its blob at `89e98ab` (`90919d70b74d72f4652946c419996fd0e85cbfdb` — nothing of v703 dropped) · no other path differs from `89e98ab`'s tree (diff == exactly the 4 amendment paths).
- Ship worktree `v704-ship-main` moved to the merge head and verified clean; the standing clone's own unrelated dirty checkout was not touched.

### §5.6 Second deploy (v704-2)

- Worker **`ora-pro-nobis-app`** deployed from the ship worktree at the merge head (deploy driver `EXPECTED_HEAD` updated to `2ae8e28…`; dry-run passed first).
- Worker version ID: **`fc70bfb7-2e5a-4353-b95c-167ee1c04873`** · deployment created **2026-11-27T23:26:51.570Z** · **100%**.

### §5.7 Production verification (from served bytes)

- `GET https://app.orapronobis.media/` → **200**.
- Served `sw.js` reads **`ora-pro-nobis-v704-2`** and does **not** read `ora-pro-nobis-v704-1`.
- Served `app.js` carries **`liturgyPopupPaint704`**, **`litpop702-resize702`**, and **`wireLiturgyPopupResize702`**.

### §5.8 Board closeout

- **What's New id 519**: "Changed: the Liturgy popup now shows the whole Mass — the full liturgy with the readings inside it, not the readings alone — and you can drag it, resize it, and set how see-through it is."
- **Releases row 1682**: status **Live** · `shipped_at` = 2026-11-27T23:26:51Z (the v704-2 deploy timestamp) · `whats_new_id` = 519. Read back.
- **shipped_records id 893**: project 3 · version v704 · title "Liturgy popup carries the entire liturgy, not readings only (homily recording + custom editing excluded)" · `shipped_at` = 2026-11-27T23:26:51Z · `whats_new_id` = 519. Read back.
- **Ship phase record id 2944**: release 1682 · Ship · passed · holder `chain-v704-ship` · slug `liturgy-popup-entire-liturgy` · document_path `docs/releases/v704-liturgy-popup-entire-liturgy.md` · `commit_hash` = `2ae8e28ad2c8f7ce70a3f81126567de84f5ba689`. Read back. (Scope 2936 · Plan 2937 · Implement 2939 · Review 2940 stand passed.)
- **Goals Board intake 1340**: CLOSED, status **Done** — closeout line appended naming both deploys, the amendment, and the v703-mover stop/ruling; read back via the task list.

**Disposition: v704 LIVE at pin `ora-pro-nobis-v704-2`.**
