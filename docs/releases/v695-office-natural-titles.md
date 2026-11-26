# v695 — Office rows read standing names: pull through the episode's natural title for both office sources

## §1 Scope

**Direction (John, 2026-11-26 09:25 CT, verbatim):** "Also pull through natural.titles for divine office and sikf the hours podcast"

**Standing rule this direction joins (John, 2026-11-25, the original-title rule):** "The name just needs to pull through from the podcast. No special name" — a track row's title must be the original title of the record that actually plays, never a label from the other source swapped onto it; a row must not say Sing the Hours while playing Divine Office.

**Reading of the direction (the Plan's, stated for correction):** the office rows — the eight Liturgy of the Hours slots fed by Divine Office, and the two labeled slots (Morning Prayer · Evening Prayer) whose second side is the Sing the Hours podcast — stop standing under the standing seed/slot names and instead read **the natural title of the episode that actually plays**, for **both** office sources. The title follows the side that paints, under the standing v670 paint discipline (§2.7): the item's named side's view if present, else the other side's view, else none. Where the painted side's record carries no title, the standing seed name stands (§2.5 — a named fallback, not a silent one). The source **label** does not move (§2.6): "Divine Office" / "Sing the Hours" stand exactly where they name the source today.

**Base:** remote `main` at `7e85dea7` (v693 ship record; production pin `ora-pro-nobis-v693-1`). Branch `release/v695` (LOCAL — never pushed), worktree `~/workspace/.worktrees/v695` off the one standing clone. Holder: chain-v695-plan · contract 1205. All line citations are `app/worker/src/client.ts` (client) or `app/worker/src/index.ts` (server) at base unless named otherwise.

### §1.1 What ships

1. **The resolver stores the episode's natural title** for every office slot (§2.4): the Divine Office feed leg and the no-row courier path store the matched feed item's own title (cleaned per §2.2) instead of the standing slot title; the Sing the Hours fill stores the StH item's own title the same way. This is the standing pattern of every other feed leg — exegesis · Bible · Saint · TV Mass already store `it?.title ?? <standing>` (index.ts:2876 · 2890 · 2897 · 2906); the office legs are the only ones that discard `it.title`.
2. **The backup side gains a stored title** (§2.4): migration `0052` adds `backup_title` to `ext_resolutions` — today the record carries no title for its second side at all, and the live payload **composes** one (`${sd.title} - ${backup_source}`, index.ts:3270). The backup-pointer writes store the other side's natural title; the payload serves it.
3. **No client title logic changes on the main flow** (§2.3): the views already carry each side's `title` (client.ts:2326 · 2330), `extPaintSide670` already picks the painted side's view, `extSlotTrack` already copies the view's title into the descriptor (client.ts:19030), and `trackDesc` already copies `title` unconditionally (client.ts:16306). Once the payload carries natural titles, every paint seat reads them. Implement's client work is the re-diff + the one checked seat (§2.9), not new machinery.

### §1.2 Boundaries

**IN:** the office title writes in the server resolver (the Divine Office leg's `titleFor` · the Sing the Hours fill · the backup-pointer write · the synthesis/scrape displacement carriage) · the no-row courier payload path · the stored-row live payload builder (standing title + backup title) · migration 0052 (`backup_title`) · the new harness `app/worker/harness-v695.mjs`.

**OUT, named:** the source label seats (§2.6 — seed names, Add pick rows, the Edit toggle's side labels, item/track source labels, `index.ts` source stamps, the share line's source segment) · the matchers (`extMatchDivineOffice` · `extMatchSth` — no matcher edits; the cleaning reuses the date facts the matchers already require) · the non-office slots (they already store natural titles; byte-identical) · the synthesis and scrape rungs' titles (their items are constructed, no episode title exists — the standing title stands, §2.5) · the LOH widget header's hour line (client.ts:17655 — it names the hour for the Divine Office text widget from the slot def, by design; not a track title) · no APK work.

**Queue state (read from the DevOps Board `releases` table at Plan time, 2026-11-26):** v691 (id 1669) — status `Implement`, unshipped · v692 (id 1670) — status `Implement`, unshipped · v694 (id 1672) — status `Scope`, unshipped · v695 (id 1673) — status `Scope` at Plan start. Implement for v695 holds behind that queue; the coordinator sequences it.

## §2 Plan

### §2.1 Where the office descriptor's title is set today — the full flow

**Server — the natural title exists at match time and is discarded at every office write seat:**

- The feed items carry their natural titles into the resolver: `ExtFeedItem.title` (index.ts:2049), parsed from the feeds by `extParseFeed`. The matchers select on those titles — `extMatchDivineOffice` (index.ts:2148) requires a token match **and** a title-date match (`extMatchesMonthDay(it.title, …)`, index.ts:2159); `extMatchSth` (index.ts:2187) requires the title to include the `M.D.YY` date prefix and the Lauds/Vespers token (index.ts:2190).
- **Divine Office leg:** `titleFor` (index.ts:2817–2822) ignores `it.title` and returns the standing slot title from `EXT_DO_SLOTS` (index.ts:2038–2047) — bare for six slots, `` `${t} - Divine Office` `` for the two labeled slots (the v626 labeling). `extResolutionWrite` (index.ts:2499) stores that in `ext_resolutions.title`.
- **Sing the Hours fill:** the fill write (index.ts:2971) stores `` `${slotTitle} - Sing the Hours` `` — composed, never the StH item's `it.title`.
- **Backup side:** `ext_resolutions` has **no backup title column** (`ExtResolutionRow`, index.ts:2443–2462: `backup_url` · `backup_source` · `backup_image_url` · `backup_duration_s` only). `extResolutionBackupWrite` (index.ts:2520, call site index.ts:2980) writes no title. The displaced-fill carriage in the synthesis (index.ts:2858) and scrape (index.ts:3036) rungs likewise carries url/image/duration — no title.
- **Synthesis + scrape rungs:** the constructed item itself carries `title: sl.title` (index.ts:2855 · 3033) — no natural title exists on these rungs.
- **Live payload (stored-row path):** the payload builder serves `title: res.title ?? sd.title` (index.ts:3252) — the stored composed/standing title flows whole — and **composes** the backup entry's title as `` `${sd.title} - ${res.backup_source ?? ""}` `` (index.ts:3270).
- **Live payload (no-row courier path):** `externalsCourierPayload` composes the same labeled form from the slot title — `` `${slot.title} - Divine Office` `` for labeled slots, bare `slot.title` otherwise (index.ts:2429) — again discarding the matched item's `it.title`.

**Client — the record's two views carry titles; the paint already follows the painted side:**

- The slot record's standing view reads `title: rec.title` (`extStandingView650`, client.ts:2326–2328); the second side's view reads `title: s.title` (`extSide2View650`, client.ts:2330–2333). Both views exist per labeled record — one resolution record per hour, two sides on it.
- `extPaintSide670(rec, sideTag)` (client.ts:2335–2348) returns the named side's view if present, else the first standing view, else null (§2.7). `extPaintTracks650` (client.ts:2349) builds the one descriptor from that view through `extSlotTrack(slot, v)`, whose descriptor title is `title: st.title` (client.ts:19028–19030) — **the view's title, i.e. the painted side's title, already flows**; what flows today is the composed/standing string the server stored.
- Emission: `extRebuildDescs` (client.ts:21214) emits labeled slots only through `extPaintTracks650` with the occurrence item's side (client.ts:21343 area, `emitExt619`); unlabeled office slots emit through `extSlotTrack(slot, st2)` on the standing record. Every descriptor then passes the `trackDesc` seam (client.ts:16292), which copies `title: t.title` unconditionally (client.ts:16306).
- Settle path: the courier settle hands the payload entry's titles to the record — standing `title: e.title` and backup `title: e.backup.title || slot.title` (client.ts:22769–22770) into `settleMetaLabeled650` (client.ts:22584), which stands them on the record's standing fields and `side2`. The day cache (`writeCache`, client.ts:22395–22397) and the snapshot restore (client.ts:23252) carry both sides' titles the same way. **No client seat invents a title on this flow** — the client paints what the record carries; the defect is wholly in what the server stores and composes.

### §2.2 The feeds' natural titles — live evidence, and the cleaning

**Stored today (app D1 `ext_resolutions`, read 2026-11-26 at Plan time — the defect, verbatim):**

| Slot | 2026-11-26 stored `title` | 2026-11-27 stored `title` |
|---|---|---|
| ext-invitatory | `Invitatory` | `Invitatory` |
| ext-morning-prayer | `Morning Prayer - Divine Office` (source `Divine Office`, backup_source `Sing the Hours`, route `feed`) | `Morning Prayer - Divine Office` (no backup yet) |
| ext-midmorning-prayer | `Midmorning Prayer` | `Midmorning Prayer` |
| ext-midday-prayer | `Midday Prayer` | `Midday Prayer` |
| ext-midafternoon-prayer | `Midafternoon Prayer` | `Midafternoon Prayer` |
| ext-office-of-readings | `Office of Readings` | `Office of Readings` |
| ext-evening-prayer | `Evening Prayer - Divine Office` (backup_source `Sing the Hours`) | `Evening Prayer - Divine Office` |
| ext-night-prayer | `Night Prayer` | `Night Prayer` |

Contrast, same read: the non-office rows already store natural titles — `ext-daily-tv-mass` = `Daily TV Mass Thursday November 26, 2026` · `ext-gospel-exegesis` = `Thursday of Week 34 in Ordinary Time - Luke 21: 20-28` · `ext-saint-of-the-day` = `11/26 - St. John Berchmans`.

**The feeds' own titles (live feed reads, 2026-11-26 at Plan time):**

- Divine Office feed (`https://divineoffice.org/feed/podcast/`), the 2026-11-26 episodes:
  - Morning: `November 26th, 2026 – Morning Prayer – Divine Office: Liturgy of the Hours`
  - Evening: `November 26th, 2026 – Evening Prayer – Divine Office: Liturgy of the Hours`
  - (Same form for every hour: `November 25th, 2026 – Invitatory – Divine Office: Liturgy of the Hours` · `November 25th, 2026 – Office of Readings – Divine Office: Liturgy of the Hours`.)
- Sing the Hours feed (`https://feeds.castos.com/x8g54`), the 2026-11-26 episodes:
  - Lauds (Morning): `Divine Office 11.26.26 | Thursday Morning Prayer | Lauds`
  - Vespers (Evening): `Divine Office 11.26.26 | Thursday Evening Prayer | Vespers`

**The cleaning (named, one rule): remove exactly the date segment — nothing else.** Both feeds date-stamp the episode's own title, and the row already stands under the presented day (the day build, the date line, and Now Playing's album line all carry the date). The date segment is the one the matcher itself required, so the cleaning invents nothing:

- Divine Office form: strip the leading `<Month> <D><ordinal>, <YYYY> – ` segment → `Morning Prayer – Divine Office: Liturgy of the Hours`.
- Sing the Hours form: strip the `M.D.YY` date token (the exact prefix `extMatchSth` keys on, index.ts:2188) with its orphaned separator → `Divine Office | Thursday Morning Prayer | Lauds`.

The remainder stands **verbatim** — the episodes' own words, including the Divine Office tail `– Divine Office: Liturgy of the Hours` and the Sing the Hours head `Divine Office |`, which are parts of the feeds' own titles, not app-composed labels. No invented label is added; no standing name is swapped back in. A title that is empty after cleaning (or absent) falls back per §2.5. Cleaning is applied **once, server-side, at write time** (one shared helper, §2.4), so the stored title, the payload, the day cache, and every reader inherit the same string.

### §2.3 Every seat the title paints — one field, read whole

Every consumer reads the descriptor's `title` field; none re-derives a title for a present office descriptor. No per-surface change is prescribed — the re-diff (§2.9) verifies each seat against the new stored strings.

| Seat | Consumer | Field read |
|---|---|---|
| Praylist row | `trackCard` title row (client.ts:18310–18312) | `t.title` (the descriptor) |
| Opened view (episode card) | episode card head (client.ts:11063 · 11065) | `model.titleText \|\| d.title` |
| Opened view (track page) | `openTrackPage643` (client.ts:17733), model built at client.ts:17817 | `m.title` ← `d.title` |
| Now Playing | `#np-title` (client.ts:18644); queue rows (client.ts:6208 · 6427) | `cur.title` · `desc.title` |
| Lock screen (web) | `setMediaSessionFor` MediaMetadata (client.ts:5288 · 5297) | `desc.title` |
| Lock screen / native face (shell) | native hand-off entries (client.ts:19294 · 19309 · 19315 · 19734) | `d.title` |
| Share sheet | `shareTrackSheet` (client.ts:17403) | `t.title` |

The lock-screen **subtitle** (the track's own intention, per the standing one-intention system) does not read the title field and does not move.

### §2.4 Build prescription (server-led; the client flow already carries the title)

1. **One cleaning helper** (server, `index.ts`): `extNaturalTitle695(rawTitle, y, mo, d)` — returns the title with exactly the date segment removed (§2.2): the Divine Office leading `<Month> <D><ordinal>, <YYYY> – ` form and the Sing the Hours `M.D.YY` token form (the token built exactly as `extMatchSth` builds it, index.ts:2188). Anything else returns the raw title trimmed. Empty result → null (the caller falls back, §2.5).
2. **Divine Office leg** (`titleFor`, index.ts:2817): a present match stores `extNaturalTitle695(it.title, …) ?? <today's composed/standing form>`; a missing row keeps the bare slot title exactly as today. The v626 `source` stamp does not move.
3. **No-row courier path** (index.ts:2429): the same rule from the matched item — present entries carry the cleaned natural title; `mkMissing` entries keep the bare slot title.
4. **Sing the Hours fill** (index.ts:2971): a fill stores the cleaned natural title of the matched StH item (`extNaturalTitle695(it.title, …) ?? \`${slotTitle} - Sing the Hours\``).
5. **Backup title — migration 0052** (`app/migrations/0052_ext_backup_title.sql`): `ALTER TABLE ext_resolutions ADD COLUMN backup_title TEXT;` (the 0051 shape). `ExtResolutionRow` gains `backup_title: string | null`.
   - `extResolutionBackupWrite` (index.ts:2520) gains a `backupTitle` parameter; its call site (index.ts:2980) passes the matched StH item's cleaned natural title.
   - `extResolutionWrite`'s backup carriage (the synthesis/scrape displacement writes, index.ts:2858 · 3036): the displaced Sing the Hours fill's **stored row title** (`cur.title` — after this release, that fill's own natural title) rides as `backup_title` beside its url/image/duration.
   - The payload builder (index.ts:3270) serves `title: res.backup_title ?? \`${sd.title} - ${res.backup_source ?? ""}\`` — rows written before 0052 carry no `backup_title`; the composed form stands for them until the watcher next writes that backup (named legacy fallback, §2.5).
6. **Client:** no title logic change on the main flow (§2.1). The settle, cache, and restore seats already carry both sides' titles (client.ts:22769–22770 · 22395–22397 · 23252). Implement verifies by re-diff (§2.9) and fixes only a seat the re-diff proves wrong.

### §2.5 The fallback — the standing seed name stands, by name

When the painted side's record carries **no title**, the standing name stands — at every seat, named here so no seat falls silent or invents:

- **Missing row / unresolved slot:** the bare slot title, exactly as today — server `titleFor`'s missing arm and `mkMissing`; client `missingSt` (client.ts:22711, `title: slot.title` from the `EXT_SLOTS` def, client.ts:18771–18783).
- **Synthesis / scrape fills:** the constructed item's title is the slot title (§2.1) — a present row on those rungs reads the standing name (for labeled slots, the composed `` `<slot> - Divine Office` `` form stands, as today).
- **Title-less present record** (natural title absent, or empty after cleaning): the write seats fall back to today's composed/standing form (§2.4 steps 2–4); the payload's `res.title ?? sd.title` (index.ts:3252) and the client's `e.backup.title || slot.title` (client.ts:22770) remain as the last-resort guards.
- **Legacy backup rows** (no `backup_title` yet): the composed `` `<slot> - <source>` `` form stands (§2.4 step 5) until the watcher rewrites the backup.

### §2.6 The source label does not move (v672 discipline) — label seats untouched

"Divine Office" / "Sing the Hours" stand where they **name the source**; none of these seats changes:

- Seed display names: `OPN_SEED_SOURCES` (client.ts:2771 — `Divine Office — Morning Prayer` · `Sing the Hours — Lauds` · …) and `opnSeedDisplayName636` (client.ts:2772) — the Settings / source-row names.
- The Edit-form item label for a labeled slot: `opnItemLabel687` (client.ts:24248) — `<label> · Divine Office` / `· Sing the Hours` from the item's side.
- The Add pick rows and the Edit toggle's side labels (the v670/v672 seats) — they name a **side/source**, not an episode.
- Item/track source labels: the descriptor's `source` field and every paint of it, including the share line's source segment (`shareLineFor640`, client.ts:17396).
- Server source stamps: `ext_resolutions.source` / `backup_source`, the payload's `source` fields, and `index.ts`'s `EXT_DO_SLOTS` titles (index.ts:2038) in their remaining roles (fallback titles §2.5 · matcher slot identity) — the matcher token tables `EXT_TOKENS` (both files) do not move.
- The `EXT_SLOTS` def titles (client.ts:18771) in their remaining roles: fallback titles (§2.5) and the LOH widget header's hour line (client.ts:17655, §1.2 OUT).

### §2.7 The v670 paint discipline as it bears on title

`extPaintSide670` (client.ts:2335–2348): the views stand in order [standing view, side2 view]; the first view whose `extSideTag650(source)` equals the named side wins; if none matches, `views[0]` — the first standing view — paints. Because each view carries **its own side's** title (§2.1), the descriptor's title follows the painted side with no further rule:

- Named side present → that side's natural title.
- **Missing-side fallback:** the named side absent, the other side standing → the other side's natural title paints (the title follows the audio that will actually play — the original-title rule's whole point).
- No view → no descriptor; the slot's unavailable track stands under §2.5.

The one record shape this depends on: both sides' titles must stand on the record at settle — the standing title from the payload entry, the side2 title from `entry.backup.title`. That is exactly the §2.4 step-5 gap today (the backup title is composed, not stored), and the only reason a migration stands in this release.

### §2.8 The composed-descriptor trap class (v654/v655) — grounded for every title consumer

A composed office descriptor (the form that stands in `state.dayDescs` / `state.composed642` and reaches the queue, Now Playing, and the share seats) holds `source` but **no `kind`**: `extSlotTrack` sets `kind: 'external'` (client.ts:19029), but the `trackDesc` seam (client.ts:16306–16324) copies `kind` **only for podcast** — every other family, office included, loses it at the seam while `source` rides through (client.ts:16306).

- The standing defenses, already shipped: `shareAppUrlFor` fires its office branch on `t.kind === 'external' || opnLabeledSlot650(id)` (client.ts:17367–17380, the v654 fix); `shareLineFor640` likewise on `t.source && opnLabeledSlot650(t.episodeId)` (client.ts:17387–17396, the v655 fix); `queueLiveDesc`'s `isExt` test carries the `state.extSlots[d.episodeId]` arm beside the kind test (client.ts:5809).
- **Prescription:** title needs no new consumer — every §2.3 seat reads `title` unconditionally, which is why the main flow needs no client change. Any seat Implement touches or adds must key office identity on `episodeId` (the eight-slot set, `LOH_OFFICE_SLOTS_675`, client.ts:17629) or on `source` — **never on `kind === 'external'` alone**, which silently misses composed descriptors.
- One title-reading predicate to re-check at Implement: `lohOffice676` arm (c) (client.ts:17646) tests `t.title` for an office-hour name. Both feeds' cleaned natural titles still contain the hour name (`Morning Prayer` · `Evening Prayer` stand in both forms, §2.2), so the arm still fires — the re-diff (§2.9) proves it on the new strings rather than assuming it.

### §2.9 Harness prescription — `app/worker/harness-v695.mjs` (prescribed here; built at Implement)

Recipe: the v670 harness shape (the rendered client from source driven in jsdom over John's profile document; the server title/write functions extracted standalone, the v603 recipe).

**Fixtures (Improvement D — production sources, named):** the live-shaped resolution records read at Plan time — the app D1 `ext_resolutions` rows for 2026-11-26 (§2.2: both labeled slots standing on Divine Office with a Sing the Hours backup; the six unlabeled office slots present) and the two live feeds' 2026-11-26 episode titles (§2.2, verbatim strings). The BEFORE fixture carries today's stored titles; the AFTER fixture carries the cleaned natural titles those same episodes produce under §2.2. No invented titles.

**Legs:**

1. **Server write legs:** the DO leg stores the cleaned natural title for all eight office slots from the live-shaped feed items · the StH fill stores `Divine Office | Thursday Morning Prayer | Lauds` (from the verbatim StH string) · the backup write stores the StH natural title in `backup_title` · the payload serves standing + backup natural titles.
2. **Paint legs, each side:** with the item's side `do`, the Praylist row + opened view + Now Playing read `Morning Prayer – Divine Office: Liturgy of the Hours` · with side `sth`, all three read `Divine Office | Thursday Morning Prayer | Lauds` · the same pair for Evening (`Evening Prayer – Divine Office: Liturgy of the Hours` · `Divine Office | Thursday Evening Prayer | Vespers`) · an unlabeled slot (ext-invitatory) paints its DO natural title.
3. **Missing-side fallback:** a Morning record with only the Sing the Hours side standing, item named `do` → the row paints the StH natural title (title follows the painted side, §2.7).
4. **Title-less fallback:** a record whose painted side carries no title (null title; a synthesis-shaped record) → the standing seed name stands (`Morning Prayer` · the composed labeled form for a legacy backup).
5. **Non-office byte-identity:** own rows, exegesis, Saint, Bible, and TV Mass descriptors byte-identical before/after.
6. **Regressions:** harness-v670 at its standing tally · harness-v690 33/0 · harness-v677 18/0.

### §2.10 Re-diff list for Implement (every seat to re-read against the new strings)

Server (`index.ts`): `titleFor` DO leg (2817) · courier path (2429) · StH fill (2971) · `extResolutionBackupWrite` + call site (2520 · 2980) · synthesis + scrape displacement writes (2858 · 3036) — confirm `backup_title` is neither nulled nor left stale when a write displaces the other side, including the feed leg's whole-row write over a standing StH fill · payload builder (3252 · 3270) · the four non-office legs (2876 · 2890 · 2897 · 2906) — untouched check.

Client (`client.ts`): `extStandingView650` / `extSide2View650` / `extPaintSide670` / `extPaintTracks650` (2326–2358) · `extSlotTrack` (19028) · `trackDesc` (16292) · settle + cache + restore title carriage (22769–22770 · 22395–22397 · 23252) · `queueLiveDesc`'s rebuild (5825 — it rebuilds from the **whole record** `extSlotTrack(slot, st)`, i.e. the standing view only: confirm a side2-painted descriptor rebuilt here cannot come back under the standing side's title, or fix that seat) · the §2.3 consumer seats · `lohOffice676` arm (c) (17646) on the new title strings · `extSwapLabeled650`'s direct-paint fallback (19051).

### §2.11 Open points

- **OP1 — cleaning depth (recommendation stands; not blocking):** §2.2 removes only the date segment; the remainders keep the feeds' own source words (DO's `– Divine Office: Liturgy of the Hours` tail, StH's leading `Divine Office |`). They are the episodes' own title text, and the original-title rule forbids swapping in an app-composed name — the Plan recommends the verbatim remainder. A deeper strip is John's word at Scope/Review, not Implement's invention.
- **OP2 — the one data change:** migration 0052 (`backup_title`) is required because the second side's natural title has no stored home today (§2.7); there is no client-side source for it. Small, additive, nullable.
- **OP3 — standing rows refresh on the watcher cadence:** rows already written for 2026-11-26/27 keep their composed titles until the resolver next writes those days (its standing pass/nudge cadence); no backfill is prescribed.

## §3 Implement (chain-v695-impl, 2026-11-26)

### §3.1 Re-diff outcome (old base 7e85dea → current tree at 97c7c47, v694 ship)

Every §2.10 seat re-read against the current tree. Seat shifts (old → current line):

**Server (`app/worker/src/index.ts`):**
- `externalsCourierPayload` DO title seat: 2429 → 2619 (the present-entry title line; `mkMissing` unchanged above it).
- `ExtResolutionRow`: 2443–2462 → 2637–2656.
- `extResolutionWrite`: 2499 → 2689. `extResolutionBackupWrite`: 2520 → 2707; its call site 2980 → 3175.
- DO leg `titleFor` (inside the `runSlotFeed` "divine-office" call): 2817–2822 → 3005–3017. `runSlotFeed`'s `titleFor` signature widened to `(slotId, it, y, mo, d)` so the leg can clean by the row's date; all other legs ignore the extra args (their stored titles byte-identical — harness-v695 leg 5 + the untouched-check below).
- Synthesis displacement write: 2858 → 3047. Scrape displacement write: 3036 → 3225.
- StH fill write: 2971 → 3166.
- Payload builder: standing title 3252 → 3441 (`res.title ?? sd.title`, unchanged); backup title composition 3270 → 3459.
- Non-office legs (2876 · 2890 · 2897 · 2906 → 3065 · 3079 · 3086 · 3095): re-read, **untouched** — exegesis · Bible · Saint · TV Mass still store `it?.title ?? <standing>`.
- Matchers `extMatchDivineOffice` (2317) · `extMatchSth` (2356): re-read, **not edited**.

**Client (`app/worker/src/client.ts`):**
- `extStandingView650` / `extSide2View650` / `extPaintSide670` / `extPaintTracks650`: 2326–2358 → 2330–2358. Verified: both views carry their own side's `title`; the paint rule is unchanged. No change.
- `extSlotTrack`: 19028 → 19188. Verified: descriptor title = the view's title. No change.
- `trackDesc`: 16292 → 16433. Verified: copies `title` unconditionally. No change.
- Settle title carriage: 22769–22770 → 23023–23024 (courier settle hands `e.title` standing + `e.backup.title || slot.title` side2 into `settleMetaLabeled650`, 22839). Cache write: 22395–22397 → 22640–22650 (both sides' titles carried). Snapshot/cache restore seed: 23252 → 22623 (record seeds standing `title: c.title` + side2 `title: c.backup.title || null`). All verified carrying both sides' titles; no change.
- §2.3 consumer seats (Praylist row `trackCard` 18392 · episode card 11194–11196 · track page `openTrackPage643` 17883 via `trackPagePaintDay643` 17962 · Now Playing `#np-title` 18813 · MediaSession 5288 area · native hand-off · `shareTrackSheet`): re-read; all read the descriptor's `title` field whole. No change.
- `lohOffice676` arm (c): 17646 → 17797–17806. **Proved on the new strings** (harness-v695 leg R): both feeds' cleaned titles contain the hour name (`Morning Prayer` · `Evening Prayer` stand in the DO remainder and in the StH remainder), arm (c) fires for all four labeled forms and does not fire on an unrelated title.
- `extSwapLabeled650` direct-paint fallback: 19051 → 19201–19209. Verified: falls back to `extPaintTracks650(slot, st, extStandingSide670(slot))` — the standing item's side through the paint rule, so the fallback paints the named side's view/title. No change.
- Label seats (§2.6): seed names, Add pick rows, Edit toggle side labels, descriptor `source` field, share-line source segment, server source stamps, `EXT_DO_SLOTS` / `EXT_SLOTS` titles in their remaining roles — re-read, **untouched**.

### §3.2 The flagged seat — queueLiveDesc: DEFECT FOUND AND FIXED

`queueLiveDesc` (5825 → 5885; rebuild at 5940): the rebuild ran only for a descriptor standing `available: false`, and built it from the **whole record** (`extSlotTrack(slot, st)` — the standing view only). A side2-painted (Sing the Hours) descriptor frozen unavailable — the v338 download-in-flight shape this seat exists for — **could and would** come back under the standing side's title, source, and URL. Fixed minimally at that seat: for a labeled slot the rebuild now builds from the descriptor's own side's view through the standing paint rule — `extPaintSide670(st, extSideTag650(d.source))` (named side if it stands, else the other side per §2.7) — falling back to the whole record for unlabeled slots, whose rebuild is byte-identical to before. Evidence: harness-v695 legs Q (both directions) — a frozen StH descriptor rebuilds with the StH natural title + source + its own URL; a frozen DO descriptor rebuilds with the DO natural title. On the pre-fix code the StH leg returns the standing side's values.

### §3.3 Build (as prescribed, §2.4)

- `extNaturalTitle695(rawTitle, y, mo, d)` (index.ts:2371): strips the Divine Office leading `<Month> <D><ordinal>, <YYYY> – ` segment (regex built from `EXT_MONTHS_FULL[mo-1]`, the day, and the year) or the Sing the Hours `M.D.YY` token (built exactly as `extMatchSth` builds it) with its orphaned separator spacing collapsed; anything else returns the raw title trimmed; empty result → null. One deviation in form, not in rule: the DO regex also accepts the date segment at end-of-string (a title that is only the date segment cleans to null instead of standing raw) — harness leg 1 covers it.
- DO leg `titleFor`: present match stores `extNaturalTitle695(it.title, …) ?? <today's composed/standing form>`; missing row keeps the bare slot title. The v626 `source` stamp does not move.
- No-row courier path: same rule from the matched item; `mkMissing` entries keep the bare slot title.
- StH fill: stores `extNaturalTitle695(it.title, …) ?? \`${slotTitle} - Sing the Hours\``.
- Migration `app/migrations/0052_ext_backup_title.sql`: `ALTER TABLE ext_resolutions ADD COLUMN backup_title TEXT;` (0051 shape). `ExtResolutionRow` gains `backup_title: string | null`. `extResolutionWrite` gains a trailing `backupTitle` param carried in INSERT + ON CONFLICT (a whole-row write with no backup carriage nulls it with the other backup columns — never stale: the feed leg's whole-row write over a standing StH fill nulls the whole backup pointer family, and the backup-pointer write re-stands it with its natural title in the same pass discipline as before). `extResolutionBackupWrite` gains the `backupTitle` param; its call site passes the matched StH item's cleaned natural title. The synthesis + scrape displacement writes pass the displaced fill's stored row title (`cur.title`) as `backup_title`. Payload builder serves `res.backup_title ?? \`${sd.title} - ${res.backup_source ?? ""}\`` (legacy composed fallback, by design).
- Client: no title logic change on the main flow; the one queueLiveDesc fix (§3.2).
- Pin: `ora-pro-nobis-v694-1` → `ora-pro-nobis-v695-1` at its one seat (`ui.ts:1214`).

### §3.4 Harness tallies

- **harness-v695: 24 ok, 0 bad.** Leg by leg: F fixtures (1) · S extraction (1) · leg 1 server writes (9: cleaning DO form · cleaning StH form · cleaning edges · DO titleFor all-8 · DO fallbacks · extResolutionWrite backup carriage · extResolutionBackupWrite · call-site seats · migration · matcher/helper-seat count — counted as the leg-1 block) · C client machinery (1) · leg 2 paint (4: Morning do · Morning sth · Evening pair · invitatory) · leg 3 missing-side fallback (1) · leg 4 title-less fallback (1) · Q queueLiveDesc (2) · R lohOffice676 arm (c) (1) · leg 5 non-office byte-identity (1) · P pin (1).
- **harness-v690: 33 ok, 0 bad** (prescribed tally).
- **harness-v677: 18 ok, 0 bad** (prescribed tally).
- **harness-v670: observed 17 ok, 5 FAIL, then a crash at harness line 396** (`salRecA.contents` on an undefined profile) — **identical on the pristine base tree 97c7c47** (same 17 ok, same 5 FAIL lines, same crash): the v670 harness's validator-extraction shape, its v684 pin expectation, and its (b) migration fixture were all superseded by later releases (v684–v694). No v695 effect: every v670 check that runs behaves byte-identically before and after this release's changes.
- Worker bundle builds clean (esbuild, index.ts → CJS, no errors).

### §3.5 Deviations from the Plan (named)

1. **queueLiveDesc fixed** (§3.2) — the Plan's flagged check, resolved as "fix that seat minimally" per §2.10.
2. **Helper end-of-string edge** (§3.3): the DO date-segment regex accepts the segment at end-of-string so a date-only title cleans to null (the §2.5 fallback then stands) instead of standing as a raw date stamp. Form only; the §2.2 rule (remove exactly the date segment) is unchanged for every real title.
3. Nothing else. No merge, no deploy, no remote migration application, no DevOps Board writes — Review, migration application, merge, and Ship stand with the coordinator.
