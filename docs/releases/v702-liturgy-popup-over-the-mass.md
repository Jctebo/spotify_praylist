# v702 — Liturgy Popup over the Mass

## §1 Grounding

### §1.1 Direction

- John, 2026-11-27 15:21 CT, verbatim: **"Can you create a popup player that reads the days liturgy so I can overlay it in the mass. The popup should be movable around the screen with customizable transparency."**
- **AMENDMENT (John, 2026-11-27 15:24 CT, verbatim): "That popup menu should be engaged by the overflow menu."**
- **PRECISION (John, 2026-11-27 15:26 CT, verbatim): "Like the overflow menu docked at the bottom like I sent in the screenshot."** — the door is the **⋯ on the bottom-docked player bar** in John's screenshot (the bar docked at the foot of the screen under the playing Mass video, carrying the track title, the block name — "Midday" — play, next, and the "⋯" at its right end). The Plan's separate "Liturgy" **button** under the watchframe (§1.4/§2.3 as first written) is **SUPERSEDED**: no button stands on either watch paint. The door item stands in the docked bar's ⋯ menu instead (§1.4 as amended). Everything else in §§1–2 stands unchanged.
- **LABEL (John, 2026-11-27 15:26 CT, verbatim): "Display Liturgy Text"** — the overflow item's name is **"Display Liturgy Text"**, not "Liturgy". The label binds the door item only; the popup panel's own head keeps the Plan's "Liturgy" heading (§1.2/§2.1).
- Field shape: a CatholicTV Daily Mass **video** plays inside the app (a v688 `massdaily` item in the Midday block; the dock reads "Catholic Mass Today | Friday November 27, 2026 | CatholicTV Daily Mass · Midday"). While the video plays, a floating panel paints **the day's liturgy**, draggable anywhere, with a transparency control.
- Client-only release. No server change, no new route, no migration (§1.2 proves none is needed).

### §1.2 Content — the ONE standing payload; what rides and what does not

**Rides in the popup — exactly the v697 Read card's paint, reused:**

- Source: `GET /api/prayer/mass-readings?date=<day>` (route `index.ts:5249–5263`, session-gated, no PIN; answers `massReadingsPayload(env, date)`, `mass-readings.ts:478–486` — D1 `readings_cache` store-first, live USCCB pull on miss). This is the same payload the Mass scroll loads (`loadMassFeed`, `client.ts:7776–7789`) and the v697 card loads (`readingsCardDrive697`, `client.ts:17975`).
- Body paint: **reuse `readingsCardPaint697(root, payload)`** (`client.ts:17944`ff): every part in `payload.parts`, in payload order, through the Mass surface's own renderer `massFeedPartHtml(part, MASS_SLOT_LABELS[part.key], i)` (`client.ts:8271`), then every `payload.copyright[]` line as a `.mass-ack` line, exactly as `massAcksHtml` (`client.ts:8550`) paints them. Head paint: reuse `readingsCardHead697` dress (`.lohhead675`), heading **"Liturgy"** variant (§2.2).
- Not-available: `found:false`, no parts, or a failed fetch → the v697 honest line alone — **"Readings not available for this day."** — no parts, no acknowledgment, no other day's text (`readingsCardPaint697`'s standing negative arm). The captured 2026-11-26 fixture (§1.6) is exactly this shape in production: `found:true, parts:[]`.
- **Readings are the minimum and the whole of the payload leg** — that is what the payload carries (`MassReadingsPayload`, `mass-readings.ts:47–64`: `{date, found, title?, parts[], copyright[], memorials?}`; memorial sets do **not** paint, per the v697 prescription, which stands).

**Does NOT ride — the Worship Lectionary scroll's fuller liturgy, with the reason for each piece:**

| Scroll piece | Where the scroll gets it | Why it does not ride |
|---|---|---|
| Order of Mass fixed texts (Introductory Rites, Eucharistic Prayers, Creed, …) | Client-side standing text: `MASS_ORDER` inlined at `client.ts:24` (generated from `mass-order.ts`), rendered by `paintMassScroll` (`client.ts:8623`) via `massLinesHtml`/`massPartHtml` with `MASS_ROLES`, penitential-form and EP picks held in `state.mass` | Not in the payload. Carrying it means composing a second, stateful surface (version/EP/Latin picks) inside the popup — a second liturgy composer, not an overlay of the day's readings |
| The day's propers (Collect, antiphons, formulary) | A **second** payload: `GET /api/prayer/mass?date=` (`index.ts:5240–5248`, `massPayload`), loaded by `paintMassLiturgy` (`client.ts:9390`) into `state.mass.payload`; `massFormulary()` at `client.ts:8192` | A second fetch shape, forbidden by the one-payload rule unless proven needed; it is not needed for the readings overlay John asked for |
| Universalis backup parts | Browser-side JSONP adjunct (`loadMassReadings`, `client.ts:7756`; `massBackupPartHtml`, `client.ts:8300`), fired only when the feed lacks a piece (`massMaybeLoadUniversalis`, `client.ts:7819`) | Not part of the payload; the v697 card already excluded it (§1.4 of the v697 doc) and the popup inherits that exclusion — a lacking day is not-available, never Universalis-filled |
| Pre-Mass Prayers · Universal Prayer · personal/Communion seats · homily card | `state.mass`-bound sections inside `paintMassScroll` (`client.ts:8660`ff, `8687`, `8724`) | Personal/session state of the Lectionary side, not day liturgy text; out of the overlay's scope |

- The scroll's date posture confirms the split: `paintMassLiturgy` (`client.ts:9371`) loads for `todayChicago()` only — the scroll is a today-surface. The popup's date rule (§1.3) is the presented day's, which only the readings payload serves per-date.
- **No new server route is needed — proof:** the route, store, payload, renderer, and card paint all stand shipped (above); the popup is a new *seat* for existing code. Nothing server-side is missing.

### §1.3 Date rule — the PRESENTED day (v697 discipline)

`liturgyPopupDate702(t)` (§2.2) is `episodeDate697(t)` (`client.ts:17909`ff) applied to the playing item:

1. **Primary: the item's own title date** — `opnDailyTitleDate666(t.title)` (`client.ts:21023`) parses the "Month D, YYYY" the title carries; a full `YYYY-MM-DD` result is the date.
2. **Fallback only: `presentedDateStr()`** (`client.ts:5300`) — where the title yields no full date.

Applied per surface:

- **A Mass item played from today's Praylist** (the screenshot case): the v688 video descriptor's title is the video's own title (`resolveMassDynamic688`, `client.ts:21505–21515`: `title: v.title` — e.g. "Catholic Mass Today | Friday November 27, 2026 | CatholicTV Daily Mass", which title-date-parses to `2026-11-27`). That date is asked for, and only that date.
- **A Mass item whose title carries another date:** that date governs — a title naming November 25 paints November 25's readings, never today's (the v697 D1 rule, unchanged). Note v694 deleted the stale-video fallback (`opnMassMatch688`, `client.ts:21347`ff), so a Praylist Mass video is always a presented-day match; the other-date case reaches the popup through the series-page surface (§1.4b), whose videos carry their own dates.
- **The Worship Virtual Mass surface:** its watch (§1.4b) is fed by `podWatch.video` — `{id, title, dateLabel}` from the series payload, **no descriptor, no date field**. The rule applies to `podWatch.video.title` (a daily-Mass video title carries its date); where a series video's title carries no full date, the fallback is `presentedDateStr()` — sound because the Virtual Mass series page is opened from the presented day's app. Never a date from `dateLabel` parsing beyond the title rule, publish stamps, or "today" as such.

### §1.4 Seat + door — the video surfaces

**(a) The Praylist video play (the screenshotted surface).** A `kind:'video'` descriptor diverts at the play choke point: `startDesc` → `openVideoHandoff656(desc)` (`client.ts:5632`, `10638`). The surface is `paintVideoWatch656` (`client.ts:10655`): a row-2 bar (dest 'Praylist', back act `finishVideoHandoff656`), then `<div class="watchframe-wrap"><iframe class="podwatch-frame" src="youtube.com/embed/<id>?enablejsapi=1&autoplay=1&rel=0">` (`client.ts:10666`; frame dress `ui.ts:1025–1026`), an error seat, and a meta line — all painted into `view`. Teardown: `finishVideoHandoff656` (`client.ts:10676`) removes the frame and repaints the Prayers view; any other close goes through `closeWatch` (`client.ts:10832`, called on tab switch at `client.ts:7714`).

**(b) The Worship tab's Virtual Mass surface — SEPARATE entry, SAME watch code.** `paintMassVirtual` (`client.ts:9427`) paints the `MASS_VIRTUAL_ENTRIES` cards (`client.ts:9413`); a tap runs `openMassVirtualSeries` → `openPodSeries` with `massPodReturn = true`. The series page is `paintPodcastVideos`; a video tap runs `openPodWatch(v)` → **`paintPodWatch`** (`client.ts:10737`): the same `.watchframe-wrap` / `iframe.podwatch-frame` form (`client.ts:10752`), back act `closeWatch`. So the Virtual Mass watch does **not** share `paintVideoWatch656` — it shares the frame form and the `wirePodWatchApi` seam, but stands in its own paint.

**Not a door seat:** `paintMassAdorationWatch` (`client.ts:9495`ff) — a third, separate watch paint for perpetual live streams: no Mass item, no item date, nothing to overlay. The popup never stands there (§2.5 leg A1 pins this).

**The door (AS AMENDED, §1.1): the bottom-docked player bar's ⋯ menu.** Neither watch paint carries a ⋮ of its own (both paint only a row-2 back bar, the frame, an error seat, and a meta line). The overflow a person watching the Mass actually reaches is the one in John's screenshot: **the mini-player dock** — `<div id="dock">` in the shell (`ui.ts:69`), carrying `#dock-title`, `#dock-meta` (the block name — "Midday" in the screenshot), `#dock-play`, `#dock-next`, and at its right end **`<button id="dock-menu">⋯</button>`**, whose click opens **`openDockMenu`** (`client.ts:17381`, wired at `client.ts:9530`) — a standing `openSheetMenu('Playback', items, anchorEl)` card (`client.ts:16915`). The bar stands exactly in the screenshotted state: `openVideoHandoff656` sets `state.current` to the video descriptor and calls `updateDock()` (`client.ts:10638`ff; `updateDock`, `client.ts:7017`, unhides the dock whenever a current stands, painting its title + block). The Now Playing sheet's ⋮ (`#np-menu`, `client.ts:18878`, wired `client.ts:18898` → `openPlayerMenu`, `client.ts:17349`) is **not** the door: opening that sheet runs `closeWatch()` first (`openNowPlaying`, `client.ts:18861`), which tears the watch down — it cannot be reached while watching. **The build adds one item, "Display Liturgy Text" (John's label, §1.1), to `openDockMenu`'s item list**, in the standing `openSheetMenu` dress.

**When the item stands — `liturgyPopupSource702()` (new, §2.2):** the menu reads the *watch state*, not `state.current` alone (on the Virtual Mass surface the playing video never becomes `state.current`):

- **Praylist surface:** `videoHandoff656` stands (a `paintVideoWatch656` hand-off is open) **and** its descriptor is a Mass video — `desc.mass688 === true` (the `resolveMassDynamic688` stamp, `client.ts:21509`ff) or `desc.vmSeries` naming a `MASS_VIRTUAL_ENTRIES` series (`catholictv` · `dailytvmass` · `springfieldmass`, `client.ts:9413`). Source descriptor: `videoHandoff656.desc` (its title carries the date, §1.3).
- **Worship Virtual Mass surface:** `podWatch` stands with `podLevel === 'watch'` and **`massPodReturn === true`** — the flag `openMassVirtualSeries` sets (`client.ts:9445`) that homes the series page and its watch under the Worship Mass tab. Source descriptor: `{title: podWatch.video.title}` (§1.3's adapter).
- **Never otherwise:** no item for an audio track (no watch stands), no item on a Catechesis-homed podcast video watch (`massPodReturn` false), no item for a non-Mass Praylist video (e.g. a Catholic Saints video — `vmSeries: 'catholicsaints'`, no `mass688` stamp), and no item while the Adoration watch stands (`adorationWatch` is a separate record; `podWatch` does not stand for it).

**Open act:** tapping "Display Liturgy Text" calls `openLiturgyPopup702(source)` (§2.2) for the playing item (§1.3's date rule applied to that source). **Close acts:** the panel's own Close button (§1.5), a second tap of the menu item (toggle — `openLiturgyPopup702` closes a standing panel for the same date), or the video's teardown (§1.5).

### §1.5 Mechanics

- **Panel seat:** a JS-built `<div class="litpop702" id="litpop702">` appended to `document.body` — never into `view` (both watch paints rewrite `view.innerHTML`; sheets follow the same body-append rule, e.g. `client.ts:1249`, `1362`). One panel at a time: opening removes any standing one first (the queue-sheet rule, `client.ts:6519`ff).
- **Drag:** by the panel head (`.litpop702-head`) only, via **pointer events** in the standing v664 pattern: `pointerdown` on the head → `setPointerCapture(ev.pointerId)` (the `wireQueueDrag664` machinery, `client.ts:6425–6432`), `pointermove`/`pointerup`/`pointercancel` on the head until release. Head carries `touch-action:none` (the `.grabstrip` rule, `ui.ts` dress for `.np-grab`/`.grabstrip`). Mouse and touch ride the same pointer path — no separate touch handlers.
- **Bounds clamp (at every move and at open):** `left ∈ [0, max(0, innerWidth − panel.offsetWidth)]`, `top ∈ [0, max(0, innerHeight − panel.offsetHeight)]` — the whole panel stays on screen; measured live from the panel, never a stored size.
- **Internal scroll:** the panel is a flex column, `max-height:70dvh`; the head and the transparency row are `flex:none`; the body (`.litpop702-body`) is `flex:1 1 auto; min-height:0; overflow-y:auto` — the `.sheet .panelbody` discipline (`ui.ts:622`ff dress block). The liturgy scrolls inside the panel; the page and the video never scroll with it.
- **Transparency:** a slider **on the panel**, in its own row under the head: `<input type="range" id="litpop702-alpha" min="0.35" max="1" step="0.05">`, labelled "Transparency". Range **0.35–1.00**, **default 0.88**. The slider sets **the panel background only**: the panel's inline `background` is set as `color-mix(in srgb, var(--card) <alpha×100>%, transparent)`; head text, body text, and the slider itself stay at full opacity. **Why background-only:** whole-panel `opacity` fades the words with the ground — at 0.35 the readings would be unreadable against a bright video, which defeats the overlay's one job. Background-only gives John the see-through ground he asked for and keeps every word at full strength.
- **Persistence (device-local):** `localStorage` key **`opn-litpop-v702`**, value JSON `{x, y, alpha}` — the standing `opn-*-vNNN` key pattern (`opn-video-reg-v656`, `client.ts:3290`; `opn-mass-settled-v1`, `client.ts:21301`; `opn-speed-v336`, `client.ts:1213`). Written on drag end and on slider input; read at open; a stored position is clamped to the current viewport before it is applied (§ bounds). No server write, no sync.
- **Z-order:** `z-index:45` — in the standing scale (`ui.ts`): brandbar/tabbar 30 (`ui.ts:150`, `181`) · intfab 35 (`ui.ts:220`) · dock 40 (`ui.ts:198`) · **litpop702 45** · sheet 50 (`ui.ts:622`) · menucatcher 65 / anchmenu 70 (`ui.ts:643–644`). Above the video surface (normal flow, no z-index) and the dock; below every sheet and menu, so Now Playing, menus, and dialogs always stand over the popup.
- **Playback is never touched:** no popup code calls `pauseTransport`, any YT API, or any transport function; the iframe element is never removed, recreated, or re-`src`'d by the popup. The panel is `position:fixed` and movable — where it covers the frame, John drags it off; that movability is the standing answer to control access, and §2.5 carries a **driven** reachability leg (v668 discipline), not a paint claim.
- **Video close/change:** the popup **closes** — `closeLiturgyPopup702()` is called from `finishVideoHandoff656`, from `closeWatch`, and at the head of `openVideoHandoff656`/`openPodWatch` (a new video never inherits the old video's panel; reopening via the door re-dates from the new item). Position + alpha survive the close in `opn-litpop-v702`; the open state does not persist — no panel stands on app boot or on a non-video surface.

### §1.6 Modes

- **Native APK · installed PWA · plain web tab: no difference.** All three run this same client; both watch paints and their YouTube iframes stand in all three (the native shell is the Capacitor host read by `oraNativeMode()`/`oraInShell()`; an installed PWA is `opnInstalledPwa()`, `client.ts:1443–1452`; mode derivation `opnMode()`, `client.ts:1454`). The popup is plain DOM + `localStorage`, both of which stand identically in the shell, the standalone PWA, and a tab. The one honest caveat, named not built around: a plain tab's `localStorage` can be cleared by the browser/user, in which case the panel simply opens at its default position/alpha — no leg depends on the store surviving.

### §1.7 Fixtures captured at Plan (Improvement D)

Fetched live 2026-11-27 from the standing route itself (the route's own answer, parts and copyright arrays verbatim, no trimming):

- **`app/worker/fixtures/mass-readings-2026-11-27.json`** — `found:true`, title "Friday of the Thirty-fourth Week in Ordinary Time", 4 parts: r1 **Revelation 20:1-4, 11—21:2** · ps Psalm 84:3, 4, 5-6a, 8a · ga Luke 21:28 · g **Luke 21:29-33**; `copyright[]` 1 line; no part carries `options`.
- **`app/worker/fixtures/mass-readings-2026-11-26.json`** — the not-available day shape as production actually serves it: `found:true`, `parts:[]`, `copyright[]` 1 line (the Thanksgiving-day parse outcome recorded in v697 §3.3). This is the honest-empty fixture: the popup must paint the not-available line from it, never its copyright line and never another day's text.

## §2 Plan

Client-only: `app/worker/src/client.ts` + `app/worker/src/ui.ts` + pin + new harness. No server change (§1.2 proof).

### §2.1 The panel (ui.ts dress)

New rules beside the watch dress (`ui.ts:1025`):

- `.litpop702 { position:fixed; z-index:45; width:min(92vw, 420px); max-height:70dvh; display:flex; flex-direction:column; border:1px solid var(--line); border-radius:14px; box-shadow:0 12px 32px rgba(42,38,32,.28); overflow:hidden; }` (the anchmenu shadow/radius dress, `ui.ts:644`).
- `.litpop702-head { flex:none; display:flex; align-items:center; gap:10px; padding:10px 12px; cursor:grab; touch-action:none; }` — carries the title (`.lohhead-title675` form: "Liturgy" + the day line) and the Close button (`btn ghost small`).
- `.litpop702-alpha-row { flex:none; display:flex; align-items:center; gap:10px; padding:0 12px 8px; }` — the "Transparency" label + `#litpop702-alpha` range input (`flex:1`).
- `.litpop702-body { flex:1 1 auto; min-height:0; overflow-y:auto; padding:2px 14px 16px; }` — the readings paint host; rides the reused `.mass-*` / `.mass-ack` classes, no new text dress.

### §2.2 The functions (client.ts, one v702 block beside the v697 builders, ~client.ts:17990)

- `liturgyPopupPrefs702()` / `liturgyPopupPrefsSave702(p)` — the `opn-litpop-v702` read/write, in the `opnVideoReg656` guarded try/catch form (`client.ts:3289`ff). Defaults: `{x:null, y:null, alpha:0.88}`.
- `liturgyPopupDate702(t)` — returns `episodeDate697(t)` (§1.3). For the `paintPodWatch` surface the caller passes `{title: podWatch.video.title}` — `episodeDate697` reads only `.title` before its presented-date fallback, so the adapter is exact, no second date function.
- `liturgyPopupSource702()` — *(added by the §1.1 amendment)* returns the playing Mass item's source descriptor per §1.4's rule (the `videoHandoff656.desc` on the Praylist surface; `{title: podWatch.video.title}` on the Worship Virtual Mass surface), or `null` when no Mass video stands on either named surface. `openDockMenu` consults it: non-null → the "Display Liturgy Text" item stands, its act `openLiturgyPopup702(source)`.
- `openLiturgyPopup702(t)` — toggle-close if a panel stands for the same date; else build the panel: head (title + `readingsCardHead697`-form day line for `liturgyPopupDate702(t)`) · alpha row (slider set from prefs) · body host; apply prefs (position clamped per §1.5, background from alpha per §1.5); wire drag + slider + Close; then paint the body through the **standing v697 driver shape**: `api('/api/prayer/mass-readings?date=' + dateStr)` → `readingsCardPaint697(bodyEl, payload)`, a rejected fetch → `readingsCardPaint697(bodyEl, null)`. (Implement may call `readingsCardDrive697` with a resolver returning `{body, head}` — its head day-name swap targets `.readings-day697`, which the popup head carries — or drive the fetch directly; either way the paint function is `readingsCardPaint697` and no second renderer is written.)
- `closeLiturgyPopup702()` — removes `#litpop702` if it stands; writes nothing (prefs are written at drag end / slider input, not at close).
- `wireLiturgyPopupDrag702(panel, head)` — the §1.5 pointer drag: capture on the head (`setPointerCapture`), move updates `left/top` through the clamp, up/cancel ends and saves prefs.
- Slider wiring (inside `openLiturgyPopup702`): `input` event → set the panel's inline background per §1.5 + save prefs. The body text's opacity is never written anywhere.

### §2.3 The door + teardown calls (AS AMENDED, §1.1/§1.4)

1. **The door — one seat, in `openDockMenu`** (`client.ts:17381`): after the standing items are built and before `openSheetMenu('Playback', items, anchorEl)`, consult `liturgyPopupSource702()`; where it returns a source, push `{ label: 'Display Liturgy Text', act: function () { openLiturgyPopup702(src702); } }`. No paint in `paintVideoWatch656` or `paintPodWatch` changes; no button stands anywhere.
2. Teardown: `closeLiturgyPopup702()` at the head of `finishVideoHandoff656` (`client.ts:10676`) and `closeWatch` (`client.ts:10832`), and at the head of `openVideoHandoff656` (`client.ts:10638`) and `openPodWatch` (`client.ts:10724`) — §1.5's close/change rule. No other call sites; tab switches reach the popup through `closeWatch` (`client.ts:7714`).

### §2.4 Pin

- `ui.ts:1214`: the standing pin → **`ora-pro-nobis-v702-1`**.

### §2.5 Harness spec — `app/worker/harness-v702.mjs` (the v697/v688 mold)

The real built Worker bundle served locally, the API stubbed, driven Chromium, real acts, same-tick DOM assertions; `ORA_WT` selects the tree for the fail-on-old run. Fixtures: the two Plan-captured files in `app/worker/fixtures/` (§1.7), read by the harness — never re-typed, never trimmed. The video surfaces are driven through their real paints (`paintVideoWatch656` with a v688 catholictv descriptor titled "Catholic Mass Today | Friday November 27, 2026 | CatholicTV Daily Mass"; `paintPodWatch` with a `podWatch.video` of the same title).

- **F** — fixture shape: the 2026-11-27 fixture is `found:true` with 4 parts incl. a Gospel part and a non-empty `copyright[]`; the 2026-11-26 fixture is `found:true` with `parts:[]`.
- **O1 (open + paint, Praylist surface)** — with a v688 CatholicTV Mass descriptor playing through `paintVideoWatch656`, the docked bar's ⋯ menu (`openDockMenu`) carries a "Display Liturgy Text" item; tapping it → `#litpop702` stands over the page; the fetch log shows exactly one `mass-readings` fetch, `date=2026-11-27`; the body paints every fixture part's citation (Revelation 20:1-4, 11—21:2 · Luke 21:29-33 stand), a Gospel body word-string from the fixture, and the `copyright[]` line as `.mass-ack` at the foot.
- **O2 (open + paint, Virtual Mass surface)** — the same legs through the Worship Virtual Mass watch (`paintPodWatch` with `massPodReturn` standing): the ⋯ menu carries "Display Liturgy Text", the tap opens the popup, same fetch, same paint.
- **O3 (no Order of Mass)** — the painted body contains no `MASS_ORDER` text (assert a standing fixed-text string, e.g. "And with your spirit", is absent) and no `/api/prayer/mass` fetch was issued.
- **D1 (drag + bounds)** — pointer-drag the head by real `pointerdown/move/up` events: the panel's `left/top` change by the drag delta; an oversize drag toward each edge ends clamped — panel fully inside the viewport on all four sides.
- **S1 (slider)** — set the slider across its range (0.35 → 1.00): the panel's inline background percentage changes with the value at both ends; the body text element's opacity is never set (no `opacity` inline style on the panel or body).
- **P1 (persistence)** — drag + set alpha 0.5 → close (Close button) → reopen via the "Display Liturgy Text" menu item: panel stands at the stored position (within 1px) with the slider at 0.5 and the background to match; `localStorage['opn-litpop-v702']` carries `{x, y, alpha:0.5}`.
- **V1 (playback untouched + controls reachable, DRIVEN)** — record the frame element + its `src` before opening; after open + drag + slider + close, the frame element is the **same node** with the same `src`, and `podWatch`/`videoHandoff656` stand unchanged. Reachability: with the popup open, drag it to a corner, then `document.elementFromPoint` at the frame's center returns the iframe (not the panel) — a real hit-test, not a paint claim (v668 discipline).
- **N1 (honest empty)** — the route stub answers the 2026-11-26 fixture for the asked date: the body paints "Readings not available for this day." alone — no citation, no `.mass-ack`, no 2026-11-27 text.
- **C1 (video close/change)** — with the popup open, `finishVideoHandoff656(false)` (and, on the other surface, `closeWatch()`) removes `#litpop702`; opening a second video does not resurrect it.
- **A1 (item absent off the Mass surfaces)** — the ⋯ menu carries **no** "Display Liturgy Text" item when the playing item is not a Mass video: (a) an audio track current, no watch standing; (b) the Adoration watch standing (`paintMassAdorationWatch`); (c) a non-Mass Praylist video (a Catholic Saints video descriptor through the hand-off).
- **Fail-on-old:** on the base tree (a8cb317) O1–O3, D1, S1, P1, N1, C1 fail (no door, no panel); A1 passes; V1's frame-identity half passes trivially (nothing touches the frame) while its popup half fails.
- **Regression bar:** harness-v697 **74/0** · harness-v688 **65/0** — no new bad in either.

### §2.6 Risks

- **R1 — `color-mix` support:** the background form needs a current Chromium/WebView (the app's shell and driven Chromium are current; the harness's S1 leg is the proof). If S1 fails on the built tree, the fallback is an explicit `--card` RGB triplet variable added in ui.ts with the same alpha wiring — named here so Implement does not improvise a whole-panel `opacity` (forbidden by §1.5's legibility rule).
- **R2 — Head drag vs. slider/head-button taps:** the drag starts on the head only; the Close button and the slider stand outside the drag's actuation (a `pointerdown` on the button must not start a drag — check `ev.target` in `wireLiturgyPopupDrag702` and skip when the target is the button or its child).
- **R3 — Stored position on a smaller viewport** (rotation, window resize): the open-time clamp (§1.5) governs; no resize listener is prescribed.
- **R4 — The v697 driver's head swap:** if Implement reuses `readingsCardDrive697`, its settle-time head write targets `.readings-day697` inside the resolved head — the popup head must carry that class on its day-name element, or the swap silently no-ops (safe, but the day name then stays the date line). Either outcome is acceptable; §3 records which path was taken.

### §2.7 Ordered Implement seat list

1. **ui.ts dress** (§2.1) + **pin** → `ora-pro-nobis-v702-1` (§2.4).
2. **client.ts v702 block** (§2.2): prefs · `liturgyPopupDate702` · `openLiturgyPopup702` · `closeLiturgyPopup702` · `wireLiturgyPopupDrag702`.
3. **Door** (§2.3.1, as amended): `liturgyPopupSource702()` + the "Display Liturgy Text" item in `openDockMenu`.
4. **Teardown calls** (§2.3.2) in `finishVideoHandoff656`, `closeWatch`, `openVideoHandoff656`, `openPodWatch`.
5. **Harness** `app/worker/harness-v702.mjs` per §2.5, reading the committed fixtures; run it + harness-v697 + harness-v688; write §3 with tallies and the R1/R4 outcomes.

## §3 Implement record

Built by chain-v702-impl, 2026-11-27. Commits: `ec898d2` (Step 0 — the §1/§2 amendment) · `827e383` (seat 1 — dress + pin) · `cbfa9a8` (seats 2–4 — client block, door, teardown) · `12ae150` (seat 5 — harness) · a harness-hardening commit (fail-on-old completion) · this §3 commit. No server change, no board touch, no deploy.

### §3.1 What was built

- **ui.ts dress** (§2.1, beside the watch dress): `.litpop702` (`ui.ts:1032`) — `position:fixed; z-index:45; width:min(92vw, 420px); max-height:70dvh`, flex column; `.litpop702-head` (grab cursor, `touch-action:none`), `.litpop702-alpha-row`, `.litpop702-body` (`flex:1 1 auto; min-height:0; overflow-y:auto`). The body rides the reused `.mass-*` / `.mass-ack` classes; no new text dress.
- **Pin:** `ui.ts:1224` — `ora-pro-nobis-v702-1`.
- **client.ts v702 block** (beside the v697 builders, `client.ts:18004`ff):
  - `liturgyPopupPrefs702()` (`:18010`) / `liturgyPopupPrefsSave702` — the `opn-litpop-v702` `{x, y, alpha}` store in the guarded `opnVideoReg656` form; defaults `{x:null, y:null, alpha:0.88}`.
  - `liturgyPopupDate702(t)` (`:18022`) — `episodeDate697(t)`, unchanged (§1.3).
  - `liturgyPopupSource702()` (`:18023`) — the amendment's playing-item reader (§3.2).
  - `litpop702Clamp` (`:18043`) — the §1.5 viewport clamp, measured live from the panel.
  - `litpop702ApplyAlpha702` (`:18048`) — inline `background: color-mix(in srgb, var(--card) <alpha×100>%, transparent)`; no `opacity` write stands anywhere in the block.
  - `openLiturgyPopup702(t)` (`:18054`) — one body-appended `#litpop702` panel (head: "Liturgy" title + `.readings-day697` day line + Close `btn ghost small` · alpha row: "Transparency" label + `#litpop702-alpha` range 0.35–1 step 0.05 · body host); toggle-close on a re-open for the same date, re-date on a different one; position from prefs, clamped at open; the body is painted by the **standing v697 driver** `readingsCardDrive697` with a settle-time resolver returning `{body, head}` from the standing panel — so the paint function is `readingsCardPaint697` and the fetch is the one standing `mass-readings` shape.
  - `closeLiturgyPopup702()` (`:18107`) — removes the panel; writes nothing.
  - `wireLiturgyPopupDrag702(panel, head)` (`:18111`) — pointer capture on the head (v664 pattern), move through the clamp, up/cancel saves prefs; a `pointerdown` whose target is inside a `button` never starts a drag (R2).
- **The door** (§2.3 as amended): in `openDockMenu` (`client.ts:17401`–`17408`), after the standing items, `liturgyPopupSource702()` is consulted; non-null → `{ label: 'Display Liturgy Text', act: openLiturgyPopup702(source) }` is pushed (after "Previous track", before "Intentions"). No paint in either watch paint changed; no button stands anywhere.
- **Teardown calls** (§2.3): `closeLiturgyPopup702()` at `openVideoHandoff656` (`client.ts:10645`), `finishVideoHandoff656` (`:10678`), `openPodWatch` (`:10736`), `closeWatch` (`:10836`) — each the first statement of its function.
- **Playback untouched:** no transport, YT-API, or frame write stands in the v702 block (harness V1 proves the frame node + `src` and the hand-off record survive open/drag/slider/close).

### §3.2 The amendment's grounding — which menu, why

John's three directions (2026-11-27 15:24 · 15:26 · 15:26 CT, recorded in §1.1) moved the door off the watch paints and named it. The grounding, from the shipped code:

- Neither watch paint carries a ⋮: `paintVideoWatch656` and `paintPodWatch` paint a row-2 back bar, the frame, an error seat, and a meta line — nothing else.
- The overflow in John's screenshot is the **mini-player dock**: `<div id="dock">` (`ui.ts:69`) with `#dock-title`, `#dock-meta` (the block name — "Midday" in the screenshot), `#dock-play`, `#dock-next`, and `#dock-menu` (⋯) at its right end, wired at `client.ts:9530` to **`openDockMenu`** (`client.ts:17381`), a standing `openSheetMenu('Playback', …)` card. The bar stands in exactly the screenshotted state while a Praylist Mass video plays: `openVideoHandoff656` sets `state.current` to the video descriptor and calls `updateDock()`, which unhides the dock whenever a current stands and paints its title + block.
- The Now Playing sheet's ⋮ (`#np-menu` → `openPlayerMenu`) is **not** the door: `openNowPlaying` runs `closeWatch()` first (`client.ts:18861`), tearing the watch down — unreachable while watching. The item therefore stands in `openDockMenu` only.
- **How the menu knows the playing item:** `liturgyPopupSource702()` reads the *watch state*, not `state.current` alone — on the Worship Virtual Mass surface the playing video never becomes `state.current`. Praylist arm: `videoHandoff656` stands and its descriptor is a Mass video (`mass688 === true`, the `resolveMassDynamic688` stamp, or `vmSeries` naming a `MASS_VIRTUAL_ENTRIES` series). Worship arm: `podWatch` stands with `podLevel === 'watch'` and `massPodReturn === true` (the flag `openMassVirtualSeries` sets). Everything else — audio, a Catechesis-homed video watch, a non-Mass Praylist video (Catholic Saints), the Adoration watch (`podWatch` never stands for it) — returns null and the item does not stand (harness A1 proves all three named negatives).
- **Panel head:** the door item's label is John's prescribed "Display Liturgy Text"; the popup panel's own head keeps the Plan's "Liturgy" heading (§1.2/§2.1), per the label direction's own scope.

### §3.3 Harness — `app/worker/harness-v702.mjs`

New tree: **37 ok, 0 bad.** Per leg group: **F** 4/4 (fixture shapes from the committed files + the served v702 pin) · **O1** 7/7 (menu carries "Display Liturgy Text" on the Praylist surface · tap opens · panel date = the title's 2026-11-27 · exactly one `mass-readings` fetch for that date · both citations, the Gospel word-string "Consider the fig tree", and the `copyright[]` line as `.mass-ack`) · **O2** 3/3 (same legs through the Worship Virtual Mass watch) · **O3** 2/2 (no "And with your spirit", no `/api/prayer/mass` fetch) · **D1** 3/3 (real mouse-pointer drag by delta; oversize drags clamp inside the viewport both ways) · **S1** 4/4 (default alpha applied as an 88% background; 35% and 100% at the slider ends; no opacity on panel or body) · **P1** 4/4 (store carries `{x, y, alpha:0.5}`; reopen via the menu item restores position within 1px, slider 0.5, 50% background) · **V1** 2/2 (frame node + `src` + hand-off record unchanged; `elementFromPoint` at the frame's center returns the iframe with the popup open and parked in a corner) · **N1** 2/2 (the 2026-11-26 fixture paints "Readings not available for this day." alone) · **C1** 2/2 (`finishVideoHandoff656` and `closeWatch` each remove the panel) · **A1** 3/3 (item absent for audio, for a Catholic Saints Praylist video, and on the Adoration watch).

**Fail-on-old** (base tree `a8cb317`, `ORA_WT`): **7 ok, 30 bad** — every substantive leg fails (pin, O1, O2, O3, D1, S1, P1, V1-reachability, N1, C1); the 7 standing are exactly the prescribed trivial passes: the 3 fixture-shape legs, V1's frame-identity half, and A1's three absence legs.

### §3.4 Regressions

- **harness-v688: 65 ok / 0 not-ok** — the bar stands.
- **harness-v697: 73 ok / 1 bad — no new bad.** The one bad is its F pin leg ("the served service worker carries the v697 release pin ora-pro-nobis-v697-1"), which fails for the standing reason that a later release's pin supersedes it: the identical leg fails identically on the **base tree** (pin `ora-pro-nobis-v699-1` there; harness-v697 run against `a8cb317` also reads 73 ok / 1 bad, same leg). No leg was re-pointed or weakened; the v702 pin bump (`§2.4`) is the named cause, and the regression delta from this change is zero.

### §3.5 Deviations and risk outcomes

- **R1 (`color-mix`):** stands — S1 passes on the built tree in driven Chromium; the RGB-triplet fallback was not needed.
- **R4 (driver head swap):** the first outcome — the popup head carries `.readings-day697`, so `readingsCardDrive697`'s settle-time swap lands (the head's day line takes the payload's title when it stands).
- **DEVIATION (named) — the slider cannot rest at 0.88:** the Plan prescribes range 0.35–1.00, step 0.05, default 0.88. A range input's step grid is min-anchored (0.35 + n·0.05 = …, 0.85, 0.90, …), so 0.88 is not a step value and the control snaps to 0.90. The prescribed default is honored where it acts: prefs default `alpha: 0.88` and the panel's applied background on first open is 88% (S1 asserts exactly that). The first slider input writes a stepped value. No Plan number was changed.
- **Noted seam (no scope taken):** on the Worship Virtual Mass surface the dock bar itself stands only while a `state.current` stands (the standing `updateDock` rule for all surfaces); the menu item keys on the watch record whenever the menu is opened, per §3.2. Changing dock visibility was outside the Plan and was not taken.

## §4 Review record

**Verdict: PASS**

Reviewed by chain-v702-review, 2026-11-27 — light, independent review. Every tally below was re-run firsthand on the Implement head `c5963e1`; no §3 number was taken on trust. No defect found; nothing fixed by this seat.

### §4.1 Independent tallies

- **harness-v702 (new tree): 37 ok / 0 bad.** Per leg group, counted from the run output: **F** 4/4 · **O1** 7/7 · **O2** 3/3 · **O3** 2/2 · **D1** 3/3 · **S1** 4/4 · **P1** 4/4 · **V1** 2/2 · **N1** 2/2 · **C1** 2/2 · **A1** 3/3. Matches §3.3 exactly.
- **V1 is a DRIVEN check, confirmed in the harness source and the runs:** the leg records the frame node + `src` before opening and asserts identity after open/drag/slider/close, and reachability is a real hit-test — `document.elementFromPoint` at the frame's center (`harness-v702.mjs:256`) must return the iframe itself with the popup open and parked in a corner. Not paint-only.
- **Fail-on-old (base `a8cb317`, via `ORA_WT` on a scratch checkout): 7 ok / 30 bad.** The 7 standing are exactly the prescribed trivial passes: the 3 fixture-shape legs, V1's frame-identity half, and A1's three absence legs. Every substantive leg fails (pin, O1, O2, O3, D1, S1, P1, V1-reachability, N1, C1). Matches §3.3.
- **harness-v688 (new tree): 65 ok / 0 not-ok** — the bar stands.
- **harness-v697 (new tree): 73 ok / 1 bad** — the single bad is the F pin leg ("the served service worker carries the v697 release pin ora-pro-nobis-v697-1").

### §4.2 The v697 base reproduction (§3.4 verified firsthand)

harness-v697 run against the base tree `a8cb317` via `ORA_WT` reads **73 ok / 1 bad**, and the bad is the **identical F pin leg** with the identical failure text. The v697 bad is therefore a pre-existing pin-supersession artifact, not a v702 regression; §3.4's no-new-bad claim stands confirmed. (Had the base not reproduced it, this review would have returned.)

### §4.3 Door and label verification (from the code)

- The exact string **"Display Liturgy Text"** stands as a menu item in exactly one place: `openDockMenu`, `client.ts:17408` — `items.push({ label: 'Display Liturgy Text', act: … openLiturgyPopup702(src702) })`, pushed only when `liturgyPopupSource702()` returns a source (`client.ts:17407`). This is the bottom-docked bar's ⋯ (`#dock-menu` → `openDockMenu`), per John's 15:24 / 15:26 CT directions.
- `openPlayerMenu` carries **no** liturgy item and no `liturgyPopup` reference (grep count 0). Neither watch paint (`paintVideoWatch656`, `paintPodWatch`) carries the item or any button — the client.ts delta adds nothing to either paint.
- The gate `liturgyPopupSource702()` (`client.ts:18023`ff) reads the watch state: Praylist arm — a standing `videoHandoff656` whose descriptor is a Mass video (`mass688 === true`, or `vmSeries` naming a `MASS_VIRTUAL_ENTRIES` series); Worship arm — `podWatch` standing with `podLevel === 'watch'` and `massPodReturn === true`, source `{title: podWatch.video.title}`. It returns null for audio items (no watch stands), for a non-Mass Praylist video (Catholic Saints — no stamp, series not in `MASS_VIRTUAL_ENTRIES`), for a Catechesis-homed watch (`massPodReturn` false), and for the Adoration watch (`podWatch` never stands for it). Harness A1 proves the three named negatives driven.
- The panel head's **"Liturgy"** title (`client.ts`, in `openLiturgyPopup702`'s head HTML, `.lohhead-title675`) is the only other door-adjacent naming in the delta. It matches the label direction's scope as flagged in §1.1/§3.2: John's "Display Liturgy Text" binds the door item only; the panel head keeps the Plan's "Liturgy" heading. No conflict.

### §4.4 Content discipline

- The popup body paints only through the standing v697 driver: `openLiturgyPopup702` calls `readingsCardDrive697` with a settle-time resolver returning `{body, head}` from the standing panel; the paint function is `readingsCardPaint697` (→ `massFeedPartHtml` / `massAcksHtml`). No second renderer stands in the block.
- The v702 delta adds **no** fetch shape of its own: grepping the added client.ts lines for `api/prayer` / `fetch(` returns nothing — the one `mass-readings` fetch is the standing driver's. No `/api/prayer/mass` reference stands in the popup path (harness O3 also proves no such fetch is issued and no `MASS_ORDER` text paints).
- Date rule: `liturgyPopupDate702(t)` is `episodeDate697(t)` verbatim (`client.ts:18022`) — title date primary, `presentedDateStr()` fallback inside the standing function. No second date function.

### §4.5 Mechanics spot-checks

- **z-index 45:** `.litpop702 { position:fixed; z-index:45; … }` in the ui.ts dress — above the dock (40), below sheets (50) and menus (65/70), per §1.5's scale.
- **Transparency background-only:** `litpop702ApplyAlpha702` sets only the inline `background` as `color-mix(in srgb, var(--card) <alpha×100>%, transparent)`; no `opacity` write stands anywhere in the v702 block (code grep + harness S1's no-opacity assertion). Slider range `min="0.35" max="1" step="0.05"` in the panel HTML.
- **Persistence:** key `opn-litpop-v702`, written on drag end (the drag's up/cancel handler saves prefs) and on slider `input`; read at open with the viewport clamp applied. Harness P1 proves the stored `{x, y, alpha:0.5}` round-trip.
- **Teardown calls** stand at exactly the four named seats, each the function's first statement: `openVideoHandoff656` (`client.ts:10645`), `finishVideoHandoff656` (`:10678`), `openPodWatch` (`:10736`), `closeWatch` (`:10836`). No other call sites besides the definition and the panel's own Close button.
- **Playback untouched:** no transport, YT-API, or frame call stands in the v702 block (grep clean); harness V1 proves the frame node, its `src`, and the hand-off record survive the full open/drag/slider/close cycle.
- **Drag discipline:** pointer capture on the head in the v664 pattern, moves through the live-measured viewport clamp, and a `pointerdown` whose target is inside a `button` never starts a drag (R2 honored).

### §4.6 Deviation judged — the slider-step item (§3.5)

**Judged: acceptable as named, not a defect.** The Plan's substantive numbers all hold where they act: the range is 0.35–1.00, the prefs default is `alpha: 0.88`, and the panel's applied background on first open is 88% (harness S1 asserts exactly that). That 0.88 is not a resting value of the control is a property of the HTML range input's min-anchored step grid (0.35 + n·0.05 → …, 0.85, 0.90, …), not a deviation in behavior: the first slider input writes a stepped value inside the prescribed range, and no Plan number was changed. The deviation is named in §3.5 with its mechanism, which is the correct disposition.

R1 (`color-mix`) and R4 (driver head swap) outcomes in §3.5 are consistent with the firsthand evidence: S1 passes on the built tree in driven Chromium, and the popup head carries `.readings-day697`, so the driver's settle-time day-name swap lands.

### §4.7 Pin and delta confinement

- **Pin:** `ui.ts:1224` carries `ora-pro-nobis-v702-1`; the ui.ts diff is exactly the `.litpop702` dress block plus the pin change (`v699-1` → `v702-1`). Nothing else version-shaped changed.
- **Delta vs `a8cb317` — 6 files, confined to the named seats:**
  - `app/worker/src/client.ts` — pure insertions, zero removed lines; hunks only at the four teardown seats, the `openDockMenu` door, and the v702 block beside the v697 builders.
  - `app/worker/src/ui.ts` — the `.litpop702` dress + the pin.
  - `app/worker/harness-v702.mjs` — new.
  - `app/worker/fixtures/mass-readings-2026-11-27.json` · `app/worker/fixtures/mass-readings-2026-11-26.json` — the two Plan-captured fixtures.
  - `docs/releases/v702-liturgy-popup-over-the-mass.md` — this release doc.
- No server file, no other repo, no board or production surface touched.

**Disposition: PASS — cleared for Ship.**
