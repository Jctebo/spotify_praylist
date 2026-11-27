# v700 — Wallpaper Title Garble, Second Path — Plan

- **Release:** v700 · Ora Pro Nobis line · Plan seat: chain-v700-plan (contract 1243 · Plan phase record 2919)
- **Date:** 2026-11-27
- **Defect, in John's evidence:** today's home-screen wallpaper title reads `P3] □ STS. BASILEUS, AUXILIUS AND SATURNINUS — ROMAN MARTYROLOGY` (screenshot `~/workspace/user/files/6321_11_wabb.jpg`). John received today's wallpaper images in two states: one clean, one garbled.
- **Predecessor:** v685 (shipped 2026-11-26) cleaned title derivation in the fork (`jobs/novena/devotional_calendar.py`: `_strip_calendar_prefix` at the head of `_title_from_event` + the sequence path in `_event_spec`; fork commit `068b4a5bc`) and added the permanent check `runner/test_wallpaper_title_prefix.py` (18/18). Its §5 record states the 2026-11-27 set "stands repaired on every surface". Today proves that record wrong for the delivered surfaces: the repair healed the derivation and one staged copy; the delivery path re-seeded the garble from a pre-fix build and three further seats carried it without ever passing through the cleaned derivation.
- **Ship shape (verdict up front):** FORK-ONLY. No part of the garble's seat is inside the app build (§2.4). No app Worker deploy, no pin.

## §1 Scope

### 1.1 The production fixture (Improvement D — drawn from production, verbatim)

Canonical ICS `~/workspace/goals/saint-of-the-day-picture-rotation/files/devotional-calendar-2026-11-06-to-2027-12-31.ics`, the one event for the date (all-day: DTSTART 20261127, DTEND = next day 20261128):

- UID: `fcdd16f35d4aceda@devotional-calendar.local`
- SUMMARY: `[P3] 🔵 Sts. Basileus, Auxilius and Saturninus, martyrs — Roman Martyrology (private devotion)`
- Clean title (v685 derivation, expected): `STS. BASILEUS, AUXILIUS AND SATURNINUS — ROMAN MARTYROLOGY`
- Garbled title (pre-v685 derivation, as delivered): `P3] 🔵 STS. BASILEUS, AUXILIUS AND SATURNINUS — ROMAN MARTYROLOGY` (the leading `[` is eaten by a later `.strip(" -–—,;[]")` step in the old `_title_from_event`; `P3]`, the 🔵, and the suffix cleaning — `, martyrs` and `(private devotion)` removed — are the fingerprint of the OLD derivation, reproduced exactly by the pre-fix code).

### 1.2 Per-file garble map — today's delivered files (evidence firsthand, 2026-11-27)

| # | File | Store / surface | State | Evidence |
|---|---|---|---|---|
| 1 | `p3-sts-basileus-auxilius-and-saturninus-roman-martyrology__2026-11-27.jpg` (phone, 541,670 B, sha256 `89e832de…`) | `~/workspace/ora-runner-runs/2026-11-27/wallpapers-final/2026-11-27/phone/` | **GARBLED** — painted title `P3] □ STS. BASILEUS, AUXILIUS AND SATURNINUS — ROMAN MARTYROLOGY` | Image opened and read by this seat; file mtime 2026-11-25 06:04:02 UTC — built BEFORE v685 existed (fix commit 2026-11-26 06:52 UTC) |
| 2 | Same name (watch, 389,964 B, sha256 `f43b79ab…`) | `…/wallpapers-final/2026-11-27/watch/` | **GARBLED** — same painted title | Image opened and read; mtime 2026-11-25 06:04:32 UTC |
| 3 | `sts-basileus-auxilius-and-saturninus-roman-martyrology__2026-11-27.jpg` (phone, 539,635 B, sha256 `3ccb1fd0…`) | `~/workspace/ora-runner-runs/2026-11-27-repair-v685/wallpapers-final/2026-11-27/phone/` | CLEAN — painted title `STS. BASILEUS, AUXILIUS AND SATURNINUS — ROMAN MARTYROLOGY` | Image opened and read; built 2026-11-26 06:56 UTC by the v685 repair |
| 4 | Same clean name (watch, 394,996 B) | repair rundir `…/watch/` | CLEAN | Repair manifest `built[]` entry; bytes match the Drive-current clean watch file |
| 5 | `the-fig-tree-and-the-enduring-word__2026-11-27.jpg` (phone 615,072 B · watch 448,484 B) | both rundirs, both variants | CLEAN — `THE FIG TREE AND THE ENDURING WORD` | Both set manifests; Gospel title is caller-supplied, never calendar-derived |
| 6 | Garbled name (#1/#2 names) | Drive `phone-current` `1_hnPWfMMzmiKA69iMsGYGsviKI1N8nrF` + `watch-current` `18jAoBLxH_ZfHn-Kz0kd0zalgFrF34Od-` | **GARBLED, LIVE** | Drive listing 2026-11-27 (this seat): both currents hold the garbled name, modified 2026-11-27T05:58:44Z (phone) / 05:58:46Z (watch). **This phone-current copy is the file standing as John's home-screen wallpaper** — its painted title is byte-for-byte the screenshot's title, and the screenshot's clock widget reads the same `PRIVATE DEVOTION` subtitle |
| 7 | Clean name (#3/#4 names) | Drive `phone-current` + `watch-current` | CLEAN, ALSO LIVE | Same listings: clean files stand BESIDE the garbled ones in both currents (modified 2026-11-26T06:57:11Z / 06:57:14Z — the v685 repair's queue copies, promoted today). Two states in one folder is exactly the two states John received |
| 8 | Garbled name, phone + watch | App-backend stock — GET `https://app.orapronobis.media/api/wallpaper/manifest` (updated 2026-11-27T07:06:28Z) | **GARBLED, SERVED** | Entry `p3-sts-…__2026-11-27.jpg`, phone, sha256 `89e832de…`, 541,670 B — identical to file #1. (v685's 2026-11-26 stock inventory found NO `p3-` residue; this entry was stocked TODAY, from current, by `runner/wallpaper_stock.py`) |
| 9 | Clean name, phone (+ watch) | App-backend stock, same GET | CLEAN, SERVED | Entry `sts-basileus-…__2026-11-27.jpg`, phone, sha256 `3ccb1fd0…`, 539,635 B — identical to file #3 |
| 10 | `desktop-wallpaper-2026-11-27.jpg` (361,715 B) — the site/desktop PICK | rundir root + published site assets | **GARBLED (second form)** — name band reads `P3 Sts Basileus Auxilius and Saturninus Roman Martyrology` | Image opened and read; built 2026-11-27 07:08 UTC by `runner/site_desktop.py` from the garbled pick name |
| 11 | `desktop-wallpaper-the-fig-tree-and-the-enduring-word-2026-11-27.jpg` (473,512 B) | rundir root + site assets | CLEAN — band `The Fig Tree and the Enduring Word` | Image opened and read |
| 12 | `desktop-wallpaper-monthly-2026-11.jpg` (275,650 B) — Holy Souls monthly | rundir root + site assets | CLEAN (no calendar-derived title; standing monthly name) | Rundir listing + rotation manifest monthly entry `holy-souls-in-purgatory__2026-11.jpg`, action `already_current` both variants |
| 13 | Set manifest `wallpaper-set-2026-11-27.json` | standing rundir (the night run's spec source) | **GARBLED** — member title `P3] 🔵 STS. …`, slug `p3-sts-…`, `pick` = the garbled filename | Read by this seat; mtime 2026-11-25 06:04:41 UTC (pre-v685). The rotation record (§1.3) consumed THIS manifest: its `spec_subjects` are the garbled slugs |
| 14 | Set manifest, repair rundir | `2026-11-27-repair-v685/` | CLEAN — title `STS. …`, pick = clean filename | Read by this seat |

### 1.3 The delivery record (how the garble reached the phone today)

`runner/.rotation-manifests/rotation-2026-11-27.json` (Drive manifests copy id `13aT08o6_pA1Pt0j1hrEVTEsTS9Xupv06`, rotated 2026-11-27T05:59:58Z, status ROTATED):

- `moved_to_current` promotes SIX files: for each variant the garbled saint file, the clean saint file, and the Gospel file — the queue held BOTH saint names and the rotator promoted every file stamped `__2026-11-27`.
- The garbled queue copies are NEW Drive objects (phone id `1dS64hsBYCKK46T2APLO3PjRdSjlsSS2f`), not the copies v685 trashed on 2026-11-26 (phone `1PAfnFnTDgK8oOvlRWtvmiNcs0bk-ulnM`): after the v685 queue cleanup, the night run re-staged the standing rundir's pre-fix finals into the queues.
- `spec_subjects` in the rotation record = `["p3-sts-basileus-…", "the-fig-tree-…"]`, `spec_source` = the standing (garbled) set manifest — the spec gate validated the garbled queue against the garbled spec.
- The clean queue copies (v685 repair, ids in the v685 doc §3) were promoted in the same run — so current holds both, and the phone's folder-sync stands the garbled one as the wallpaper (John's screenshot).

### 1.4 In scope

1. One cleaned derivation for every title/name seat in the wallpaper pipeline (fork): the rotator's promotion + spec gate, the site-desktop name band, and the stock name guard (§2.2). No second hand-rolled strip.
2. The permanent check widened to the seats that shipped today's garble (§2.3), fixture from §1.1's production event.
3. Heal today's delivered files in the same chain (§2.5): Drive current (both variants), app-backend stock (both variants), the site/desktop pick — with read-backs from the delivered stores (the remote store governs).

### 1.5 Out of scope

- The wallpaper spec classifier gap (2026-11-28 ferial Saturday · 2026-11-29 solemnity Sunday) — a different defect; do not touch it in this chain.
- The 2026-11-26 `p2-` stock residue named in v685 §3 — still standing in the append-only stores; v689's delete path now exists, but clearing it is not this chain's word. (Implement names it in §3 if the heal route touches the same machinery; it does not delete it.)
- No raw art is re-generated; no filename-contract change (`<slug>__<YYYY-MM-DD>.jpg` stands).

## §2 Plan

### 2.1 The uncleaned seats — enumeration and proof

Every seat that derives, carries, or stamps a wallpaper title/name, and its state:

| Seat | File · function | Passes through v685's cleaned derivation? | Proof |
|---|---|---|---|
| Calendar derivation (the v685 seat) | fork `jobs/novena/devotional_calendar.py` · `_title_from_event` + `_event_spec` sequence path | YES — this is the cleaned seat | At fork HEAD (`muse-draft-week`, fix `068b4a5bc`) the v685 test re-run by this seat passes 18/18 and `set_manifest(2026-11-27)` yields the clean title. The derivation is NOT today's problem |
| Set spec + build | fork `runner/wallpaper_set.py` · `set_manifest` / `build_set` → `_spec_of` → `devotional_wallpaper_render.overlay_wallpaper_text` (paints `spec.title`) | Consumes the resolver when spec'ing FRESH; `build` re-stamps titles from the STANDING manifest verbatim, with no re-derivation | Today's garbled finals were built 2026-11-25 (pre-fix) and never rebuilt in the standing rundir; the manifest they were built from (#13) still carries the garbled title. A build from a stale manifest re-stamps garble under fixed code |
| **Rotation / delivery (PRIMARY uncleaned seat)** | fork `runner/wallpaper_rotate.py` · `plan_rotation` / `build_manifest` | **NO.** Promotes by filename date-stamp only; no cleaned-subject dedupe; the v621 spec gate takes `daily_subjects` from the standing set manifest as-is, and the v646 `_satisfies` token-subsequence match lets a garbled queued subject satisfy even a clean spec subject | Rotation record §1.3: both saint names promoted; garbled spec self-validated. Two files for one subject stand in current |
| **Site desktop name band** | fork `runner/site_desktop.py` · `display_name(subject_of(source_name))` | **NO.** Hand-rolled slug→title-case derivation (`subject.split("-")` + capitalize); never calls the calendar derivation or any shared cleaner. Brackets/emoji die in `slugify`, but the layer tag survives as a word: `p3-…` → `P3 Sts Basileus …` | File #10's band, read firsthand. Compounding fact: `pick_site_wallpaper` prefers `saint-`/`st-`-prefixed names — neither `sts-…` nor `p3-…` qualifies — so the pick fell to sorted-first = the garbled name |
| **Stock naming** | fork `runner/wallpaper_stock.py` · `parse_name` + stock post; app stock route (name passthrough, §2.4) | **NO.** Names are carried verbatim; identity is `(name, variant)` append-only; `parse_name` checks shape only, never a tag-fragment slug | Served manifest entries #8 (garbled, stocked today from current) beside #9 (clean) |
| Standing generator | fork `jobs/novena/generate_devotional_wallpapers.py` | Consumes `resolve_calendar` specs (same cleaned resolver) | No independent title derivation found; not a garble source |
| Launcher / Termux-side stamp | — | None exists: no title-stamping code outside the fork seats above was found in the runner tree | Enumeration by grep over `runner/` + `jobs/novena/` for title/name derivation |

**Root cause, one sentence:** v685 fixed the derivation and healed the staged copies, but the delivered set for 2026-11-27 had already been built by the pre-fix code (2026-11-25), the night run re-staged those stale finals into the queues, and the rotator — which never re-derives or cleans a name — promoted them alongside the clean copies, after which the stock and desktop seats each carried the garbled name onward in their own hand-rolled way.

### 2.2 The fix — one derivation, every seat consumes it

Fork-only changes, all in `~/workspace/projects/spotify_praylist-fork` (branch `muse-draft-week`):

1. **One shared helper.** Export a single canonical cleaner from the derivation's home: in `jobs/novena/devotional_calendar.py` (or `devotional_image_contract.py` beside `slugify` — Implement picks the home, one only), expose e.g. `cleaned_subject_slug(name_or_title) -> str` built ON the existing `_strip_calendar_prefix` machinery: reduce a title OR an existing production slug to the cleaned subject slug (leading bracket tag / decoration / tag-token — `[P3]`, `P3]`, leading `p3-`/`p2-`/`s-` slug token — shed; the remainder slugified). Every seat below calls this helper. No seat grows its own strip logic.
2. **Rotator (`runner/wallpaper_rotate.py`).** (a) Clean the incoming `spec_subjects` through the helper before the gate, so a garbled standing manifest can no longer self-validate. (b) Cleaned-subject dedupe at plan time: when a variant's queue (or the promote set) holds two names for the date whose cleaned subject slugs collide, promote ONLY the file whose name already equals the cleaned name; the garbled-named duplicate is NOT promoted (it stays in queue, named in the plan + manifest as `excluded_garbled_duplicates`, mirroring the v416 `excluded_monthly_duplicates` shape). If neither name is the cleaned name, fail closed: status `MISSING_QUEUE`-class refusal naming both, no moves. (c) The same collision check applies to files already standing in current for the date on a fix-up plan.
3. **Desktop (`runner/site_desktop.py`).** `display_name` derives from the CLEANED subject: `display_name(cleaned_subject_slug(...))` at the call seats (`phone_set_members` consumers + `main`), so a tag token can never reach the band even when a garbled name still stands somewhere upstream. The pick rule is unchanged.
4. **Stock (`runner/wallpaper_stock.py`).** `parse_name` refuses a slug carrying a leading layer-tag token (the v685 §3 inventory pattern: slug starts `s-` / `p1-` / `p2-` / `p3-` where the token is a tag fragment, i.e. the name's cleaned subject differs from its slug): a garbled name can no longer be stocked. Refusal is named in the run output, never silent.
5. **`wallpaper_set.py build` guard.** Before stamping, `build_set` re-derives each calendar member's title through `resolve_calendar` for the manifest date (or, minimally, asserts each member title equals its cleaned form via the helper and refuses to build on mismatch, naming the member). A stale pre-fix manifest can no longer re-stamp garble under fixed code.

### 2.3 Why the v685 check missed it — and the widened check

`runner/test_wallpaper_title_prefix.py` exercises exactly one path: it calls `wallpaper_set.set_manifest(date, gospel)` FRESH at current code over the canonical ICS for fixture days (2026-11-22/23/26/27 + controls 24/25) and asserts the derived titles/slugs are clean. It re-derives — it never reads a delivered artifact. Specifically it does NOT read: the standing rundir's own set manifest or finals (the Nov 27 control it could have caught is re-derived instead of read), Drive queue/current contents, any rotation manifest, the stocked/served manifest, or `site_desktop.display_name`. Re-run by this seat today it passes 18/18 while the garble stands live on the phone — derivation was fixed; delivery, staleness, and the three passthrough seats were outside the check.

Widen `runner/test_wallpaper_title_prefix.py` (keep legs A–C untouched; add legs D–G; fixture = §1.1's production event and today's real production names, Improvement D):

- **D — standing-artifact leg.** For 2026-11-27, read the STANDING rundir manifest (`~/workspace/ora-runner-runs/2026-11-27/wallpaper-set-2026-11-27.json`) and assert every member title is clean and every slug equals the cleaned subject slug. (Fails on today's standing manifest; passes after the §2.5 in-place rebuild.)
- **E — rotator dedupe leg.** Drive `plan_rotation`'s selection logic over a fixture queue holding BOTH real names (`p3-sts-basileus-auxilius-and-saturninus-roman-martyrology__2026-11-27.jpg` + `sts-basileus-auxilius-and-saturninus-roman-martyrology__2026-11-27.jpg`) plus the Gospel name, with the GARBLED standing manifest as `--spec-manifest`: the plan must promote the clean saint name only and name the garbled one excluded. Fail-on-old: the pre-fix rotator promotes both.
- **F — desktop band leg.** `site_desktop.display_name(site_desktop.wr.subject_of("p3-sts-basileus-auxilius-and-saturninus-roman-martyrology__2026-11-27.jpg"))` must equal `Sts Basileus Auxilius and Saturninus Roman Martyrology` (no `P3`). Fail-on-old: returns `P3 Sts Basileus …`.
- **G — stock guard leg.** `wallpaper_stock.parse_name("p3-sts-basileus-auxilius-and-saturninus-roman-martyrology__2026-11-27.jpg")` must refuse (None / named refusal per the §2.2.4 shape); the clean name must parse.
- Fail-on-old is proven for E–G by running the widened test against the pre-fix fork tree (stash the fix files), exactly as v685 proved A–C.

### 2.4 App-side verdict — FORK-ONLY

- Searched the standing clone (`~/workspace/projects/ora-pro-nobis/standing-clone`) `app/worker/src`: the only wallpaper code is the stock routes in `app/worker/src/index.ts` — `wallpaperParse` (line 4818: name-shape validation against `WALLPAPER_NAME_RE`, returns slug/date verbatim) and the stock POST (line ~5093: name + sha256 verified, bytes stored, entry upserted under the GIVEN name) plus the manifest/file GETs that serve stored names verbatim. There is no title derivation, no slug cleaning, and no name band in the app build; the client does not stamp wallpaper titles.
- The garbled served entry (#8) is bad DATA stocked through a correct-shape route, not an app defect. It is healed by deletion (§2.5), not by an app change.
- **Verdict: the chain is fork-only. No app build, no pin `ora-pro-nobis-v700-1`.**

### 2.5 Heal path — today's files, same chain (remote store governs; read-back after every leg)

The clean finals already exist and are byte-proven (phone sha256 `3ccb1fd0…` · watch 394,996 B, repair rundir). No rebuild of art is needed for the heal; the garble is removed around them:

1. **Drive current (both variants).** Move ONLY the garbled saint file (`p3-sts-…__2026-11-27.jpg`) from `phone-current` and `watch-current` to the archive, through the rotator's own move code (`wallpaper_rotate.move_file` / `archived_name`, the v685 r3 swap route). The clean saint file, the Gospel file, and the November monthly extra do not move. Read-back: Drive listings of both currents show exactly the clean saint name + Gospel + monthly for 2026-11-27; no `p3-` name stands in either current. (Do NOT re-run the full rotation — its idempotency and the standing rotation manifest make it the wrong tool; the v685 §3 r2/r3 record is the precedent for the archive-move route.)
2. **App-backend stock (both variants).** With the name clear of current and queue (verify queue listings first — the rotation emptied today's queue), run the v689 delete path: `runner/wallpaper_stock.py --delete p3-sts-basileus-auxilius-and-saturninus-roman-martyrology__2026-11-27.jpg --apply` (both variants per its standing shape). Read-back: GET `https://app.orapronobis.media/api/wallpaper/manifest` carries NO `p3-` entry for 2026-11-27 on either variant, the clean `sts-…` entries stand, and the served file route for the garbled name returns 404.
3. **Site/desktop pick.** Re-run `runner/site_desktop.py --date 2026-11-27 --apply` AFTER legs 1 + the §2.2.3 fix: the pick is now the clean saint file and the band derives from the cleaned subject. Read-back: open the composed `desktop-wallpaper-2026-11-27.jpg` and READ its band (`Sts Basileus Auxilius and Saturninus Roman Martyrology`, no `P3`); confirm the published asset matches. Also read back the site background (`pass2_build.py --site-wallpaper-only` re-run if today's background carries the garbled pick; name the result either way).
4. **Standing rundir made safe.** Rebuild the 2026-11-27 set IN the standing rundir through the fixed path (v685 repair method: copy the `p3-`-stem raws to the clean stems, `wallpaper_set.py spec` + `build`), so the standing manifest + finals are clean and no future queue staging can re-seed the garble. Read-back: the standing manifest's titles/slugs are clean (test leg D passes against it) and the rebuilt phone final's painted title is read clean.
5. **Phone field leg.** John's home-screen wallpaper re-syncs from Drive current; the field verdict is John's (the screenshot route) — the chain claims the heal on the store read-backs above and names the field leg as standing until John confirms.

### 2.6 Review gates

- Widened test run firsthand in both directions: ALL PASS on the fixed tree (A–G); E–G (and A–C per v685) fail on the pre-fix tree for the affected family only.
- Standing wallpaper suite green beside it: `test_wallpaper_set.py` · `test_wallpaper_rotate_spec.py` · `test_wallpaper_rotate_monthly.py` · `test_wallpaper_stock_delete.py`.
- Heal read-backs quoted in §3 from the REMOTE stores (Drive listings · served manifest GET · composed desktop image read), not from local files.
- Fork diff confined to: the shared-helper home file, `runner/wallpaper_rotate.py`, `runner/site_desktop.py`, `runner/wallpaper_stock.py`, `runner/wallpaper_set.py`, `runner/test_wallpaper_title_prefix.py`, and this doc. Standing-clone diff: this doc only.
- Out-of-scope guard: no change touches the Nov 28/29 spec classifier path.

### 2.7 Risks / non-goals

- The rotator dedupe changes promotion for any future date where a repaired (renamed) set is staged beside an original — intended: that is exactly today's failure shape, and the clean name is the one that promotes.
- `parse_name` refusal must not reject a legitimate saint slug that merely begins with a tag-shaped token; the §2.2.4 test is "cleaned subject ≠ slug", not a bare prefix ban — Implement proves it against the standing stock inventory names (leg G + a sweep of the served manifest's existing clean names through the guard, all must parse).
- Deleting the garbled stock entries is irreversible in the append-only store's terms — accepted: the garbled files themselves stand preserved in the Drive archive (leg 1) and the standing rundir history.

## §3 Implement — chain-v700-impl (contract 1244 · phase record 2920)

- **Date:** 2026-11-27 · Fork: `~/workspace/projects/spotify_praylist-fork`, branch `muse-draft-week`, local-only commits (standing practice). Fork diff confined to the §2.6 file list. No app build, no pin (fork-only per §2.4). The Nov 28/29 spec classifier path was not touched.

### 3.1 The fix — one shared helper, every seat consumes it

- **Shared helper (fork commit `58ff26870`):** `cleaned_subject_slug(name_or_title)` in `jobs/novena/devotional_image_contract.py` (the Plan's second named home, beside `slugify` — the one home chosen). Built on the calendar prefix-strip machinery (bracket tag + decoration run, either order, until stable, plus the bare-tag form `P3]` the old derivation left behind): reduces a title OR an existing production slug/name to the cleaned subject slug — `[P3]`, `P3]`, leading `p3-`/`p2-`/`s-` slug token shed; remainder slugified. A clean name is its own cleaned form. Verified against the §1.1 production shapes: garbled title `P3] 🔵 STS. BASILEUS, AUXILIUS AND SATURNINUS — ROMAN MARTYROLOGY` → `sts-basileus-auxilius-and-saturninus-roman-martyrology`; garbled filename → same; clean names (`sts-…`, `st-sylvester-abbot-1962-calendar`, `saint-andrew-…`, `holy-souls-in-purgatory`, `the-fig-tree-…`) unchanged.
- **Rotator (fork commit `24ae9d1d4`):** `runner/wallpaper_rotate.py` — (a) incoming `spec_subjects` cleaned through the helper before the gate (a garbled standing manifest can no longer self-validate); (b) cleaned-subject dedupe at plan time over each variant's queue: on a cleaned collision, ONLY the file whose subject already equals the cleaned name promotes; garbled duplicates are named in plan + rotation manifest as `excluded_garbled_duplicates` and left in queue; if NEITHER name is the cleaned name, fail closed — status `MISSING_QUEUE` naming both names, no moves; (c) the same collision check over files already standing in current produces a fix-up plan that archives the garbled duplicate (`garbled_fixup: true` in the manifest).
- **Desktop (in fork commit `f93cdb03b`):** `runner/site_desktop.py` — `display_name()` derives from `cleaned_subject_slug(subject)`; `main` also resolves each member's subject through the helper before the wide-raw lookup, so the band and the composition source both use the cleaned subject.
- **Stock (in fork commit `f93cdb03b`):** `runner/wallpaper_stock.py` — `parse_name` refuses a tag-fragment slug by the §2.2.4 test (`cleaned_subject_slug(slug) != slug`, not a bare prefix ban); refusal is printed, never silent. Delete mode parses SHAPE only (`_parse_name_shape`) — the guard would otherwise refuse exactly the garbled names the v689 delete path exists to remove.
- **Set build guard (in fork commit `f93cdb03b`):** `runner/wallpaper_set.py` — `build_set` asserts every buildable member's title is its cleaned form (cleaned subject slug == member slug, and no leading bracket/bare-tag/decoration garble), refusing with the member named. A stale pre-fix manifest can no longer re-stamp garble under fixed code.

### 3.2 The widened check — `runner/test_wallpaper_title_prefix.py` (fork commit `53593dd52`)

- **Tally: 27/27 ALL PASS on the fixed tree** — the pre-existing 18 legs (A–C) stay green; 9 new legs (D×2 · E×3 · F×1 · G×3). Fixture = §1.1's production event and today's real production names, per the Plan.
- **Fail-on-old (pre-fix tree at fork `12bff6603`, widened test copied in):** 22 PASS / 5 FAIL — the failing legs are exactly the new delivery legs: `E promote set is the clean saint name + Gospel only` (old plan promoted all three names, garbled included), `E garbled name named as excluded_garbled_duplicates` (old: `[]`), `F desktop band from garbled name is clean` (old: `P3 Sts Basileus Auxilius and Saturninus Roman Martyrology`), `G parse_name refuses the garbled p3- name` (old: parsed), and `D standing manifest every member title clean` (the still-garbled standing manifest, pre-heal — D passes after the §3.3 leg-4 rebuild).
- **Guard sweep (§2.7):** all 50 distinct names in the served manifest (read-back below) pass the stock guard — none refused.
- **Standing suite beside it, all green:** `test_wallpaper_set.py` ALL PASS · `test_wallpaper_rotate_spec.py` ALL CHECKS PASSED · `test_wallpaper_rotate_monthly.py` ALL CHECKS PASSED · `test_wallpaper_stock_delete.py` 33 ok, 0 bad.

### 3.3 Heal — today's delivered files, remote read-backs (values, not summaries)

**Leg 1 — Drive current (both variants).** Archive-moved ONLY the garbled file through the rotator's own machinery (`wallpaper_rotate.move_file` / `archived_name`, the v685 r3 route): phone copy id `1dS64hsBYCKK46T2APLO3PjRdSjlsSS2f` (541,670 B) → archive under its own name; watch copy id `1iwnfDqDUs9u9dMCwI_lMoedBx00iIFGQ` (389,964 B) → archive as `p3-sts-basileus-auxilius-and-saturninus-roman-martyrology__2026-11-27-rotated-2026-11-27.jpg` (archive name collision with the phone copy, suffix per `archived_name`). Pre-move queue read: both queues hold NO 2026-11-27 files. **Read-back — Drive listings of both currents after the move, identical per variant:** `holy-souls-in-purgatory__2026-11.jpg` · `sts-basileus-auxilius-and-saturninus-roman-martyrology__2026-11-27.jpg` · `the-fig-tree-and-the-enduring-word__2026-11-27.jpg` — no `p3-` name stands in either current; the clean saint file, the Gospel file, and the monthly extra did not move.

**Leg 2 — App-backend stock (both variants).** `runner/wallpaper_stock.py --delete p3-sts-basileus-auxilius-and-saturninus-roman-martyrology__2026-11-27.jpg --apply` (dry-run first: guard passed — name clear of current and queue; entries named phone sha256 `89e832de…` 541,670 B, watch sha256 `f43b79ab…` 389,964 B). The delete path's own read-back verified per variant: manifest entry absent, file GET 404; ledger tombstones recorded for both variants. **Independent read-back — GET `https://app.orapronobis.media/api/wallpaper/manifest`:** HTTP 200, `updated: 2026-11-27T16:04:22.128Z`, 99 entries; the 2026-11-27 entries are exactly phone `sts-basileus-…` sha256 `3ccb1fd0d5b6…` 539,635 B · phone `the-fig-tree-…` `5cb7dbe403a6…` 615,072 B · watch `sts-basileus-…` `a9a7bcac74bf…` 394,996 B · watch `the-fig-tree-…` `8d8963c0876f…` 448,484 B; NO `p3-` entry for 2026-11-27 on either variant. **File routes:** garbled name HTTP 404 (phone and watch); clean name HTTP 200 (phone and watch).

**Leg 3 — Site/desktop pick.** Standing rundir rebuilt first (leg 4 below) so the clean wide raw stood under the cleaned stem; then `runner/site_desktop.py --date 2026-11-27 --apply` through the fixed path: pick = the CLEAN saint file `sts-basileus-auxilius-and-saturninus-roman-martyrology__2026-11-27.jpg`, composed from `wide-sts-basileus-auxilius-and-saturninus-roman-martyrology.webp` → `desktop-wallpaper-2026-11-27.jpg` (362,650 B, 1920×1080); Gospel member 473,512 B and monthly member 275,650 B composed beside it; the stale extra `assets/daily-wallpaper-desktop-the-fig-tree-and-the-enduring-word.jpg` was deleted in the same commit. Publish commit on `Jctebo/spotify_praylist` main: `2bdf6592cb4a2813d902da01882f89fda27ed740` (2026-11-27T16:05:59Z). The first deploy run (46030686072) concluded failure at the Deploy GitHub Pages step; the run was re-run once and concluded **success**. **Read-back:** the composed pick's band, read from the image, is `Sts Basileus Auxilius and Saturninus Roman Martyrology` — no `P3`; the served asset `https://orapronobis.media/assets/daily-wallpaper-desktop.jpg` is HTTP 200, 362,650 B, sha256 `9f7f3b83db5a035655a9ee6ae01a5a8d276101f9d00bf389a9a5919433fc0e8b` — byte-identical to the local composition (before the heal it served 361,715 B, the garbled composition of Plan file #10). **Site background:** the served `images/daily-wallpaper.jpg` DID carry the garble (painted title read firsthand: `P3] □ STS. BASILEUS, AUXILIUS AND SATURNINUS — ROMAN MARTYROLOGY`, 134,864 B), so `runner/pass2_build.py --site-wallpaper-only` was re-run: pick `sts-basileus-…__2026-11-27.jpg` (134,207 B, composited square), commit `a7a99ba46670d77aff1ca00a8197e3c11e79b410`, deploy run 46031092812. **Read-back:** served `images/daily-wallpaper.jpg` HTTP 200, 134,207 B, sha256 `25ee21d73b9c9016640a9ef3c603119b45ea90fc56fe96b22c1f1b0635422d1e`, painted title read clean: `STS. BASILEUS, AUXILIUS AND SATURNINUS — ROMAN MARTYROLOGY`.

**Leg 4 — Standing rundir made safe.** In `~/workspace/ora-runner-runs/2026-11-27/`: the `p3-`-stem raws were copied to the clean stems (phone raw sha256 `025a85fc…`, watch raw `0730553c…`, wide raw `5f60ef6c…` — clean-stem copies byte-identical), then `wallpaper_set.py spec` + `build` through the fixed path: manifest subjects `[STS. BASILEUS, AUXILIUS AND SATURNINUS — ROMAN MARTYROLOGY · THE FIG TREE AND THE ENDURING WORD · HOLY SOULS IN PURGATORY]`, pick = the clean saint filename; built phone `sts-…` 539,635 B + watch `sts-…` 394,996 B + Gospel 615,072 / 448,484 B. The two garbled finals were removed from the standing rundir's `wallpapers-final/` (they stand preserved in the Drive archive per leg 1); each variant's finals dir now holds exactly the clean saint file + the Gospel file. **Read-back:** standing manifest titles/slugs clean — test leg D passes against it (full run 27/27 after the heal); the rebuilt phone final's sha256 is `3ccb1fd0d5b6696f6f2b0ea21660c4d5f5ed95314d2e6ad0ce961c8a674f3475` (byte-identical to the proven clean Drive/served copy) and its painted title was read from the image: `STS. BASILEUS, AUXILIUS AND SATURNINUS — ROMAN MARTYROLOGY` / `PRIVATE DEVOTION`.

**Leg 5 — Phone field leg.** Standing until John confirms: Drive current is healed (leg 1 read-back), so the phone's folder-sync should stand the clean file; the chain claims the heal on the store read-backs above, not on a field verdict.

### 3.4 Deviations from the Plan — named

1. **Heal order swapped (legs 3 ↔ 4):** the standing rundir was rebuilt BEFORE the site_desktop re-run, because the fixed desktop path resolves the wide raw by the CLEANED subject (`wide-sts-…webp`), which only the leg-4 raw copy stands up. Leg 3's own preconditions (leg 1 done + the §2.2.3 fix) were met; no leg's content changed.
2. **Desktop deploy needed one re-run:** the first Pages deploy run for the leg-3 publish commit failed at the Deploy GitHub Pages step; the commit had already landed. One re-run of the same run concluded success and the served asset read back byte-identical — no second publish commit was made.
3. **Out-of-scope residue named, not deleted (§1.5):** the 2026-11-26 `p2-` stock residue was NOT deleted by this chain. Note: the served manifest read for §3.2/§3.3 carries NO tag-fragment entry of any date (the residue does not stand on the served surface read here); the Drive shuffle copies and ledger are untouched by the guard, per the v689 tombstone shape.

### 3.5 Closeout

- Fork commits (local, `muse-draft-week`): `58ff26870` helper · `24ae9d1d4` rotator · `f93cdb03b` desktop + stock + set guard · `53593dd52` widened test.
- Publish commits (site repo main): `2bdf6592cb4a2813d902da01882f89fda27ed740` desktop set · `a7a99ba46670d77aff1ca00a8197e3c11e79b410` site wallpaper refresh.

## §4 Review — chain-v700-review (contract 1248 · phase record 2924)

- **Verdict: PASS.** Date: 2026-11-27. All §3 claims re-run or read back independently by this seat; nothing taken on trust.

### 4.1 Fix seats — diff read firsthand (fork `12bff6603..53593dd52`)

- Diff confined to the §2.6 file list exactly: `jobs/novena/devotional_image_contract.py` · `runner/wallpaper_rotate.py` · `runner/site_desktop.py` · `runner/wallpaper_stock.py` · `runner/wallpaper_set.py` · `runner/test_wallpaper_title_prefix.py`. No classifier seat appears in the diff (Nov 28/29 spec classifier untouched); no app-build change (fork-only stands).
- ONE shared helper confirmed: `cleaned_subject_slug` defined once in `devotional_image_contract.py` (commit `58ff26870`); consumed by rotator (spec clean + dedupe, `24ae9d1d4`), `site_desktop.display_name` + main, `wallpaper_stock.parse_name`, `wallpaper_set.build_set` guard (all `f93cdb03b`). No second hand-rolled strip in any changed seat (diff grep clean).
- Delete path: `delete_stock` parses via `_parse_name_shape` (shape-only) — garbled names remain deletable; the guarded `parse_name` is used only on the stocking path. Confirmed in the `f93cdb03b` diff.

### 4.2 Checks — re-run by this seat

- Widened check on the fixed tree (`53593dd52`): **27/27 ALL PASS** (A×12 · B×4 · C×2 · D×2 · E×3 · F×1 · G×3), including the stock-guard sweep leg.
- Standing suite beside it, all green: `test_wallpaper_set` ALL PASS · `test_wallpaper_rotate_spec` ALL CHECKS PASSED · `test_wallpaper_rotate_monthly` ALL CHECKS PASSED · `test_wallpaper_stock_delete` 33 ok, 0 bad.
- Fail-on-old reproduced by this seat in a scratch worktree at pre-fix `12bff6603` (widened test + untracked `runner/_common.py` copied in; scratch removed, `muse-draft-week` restored at `53593dd52` untouched): **23 PASS / 4 FAIL** — failures exactly `E promote set is the clean saint name + Gospel only` (old promoted all three names), `E garbled name named as excluded_garbled_duplicates` (old: `[]`), `F desktop band from garbled name is clean` (old: `P3 Sts Basileus Auxilius and Saturninus Roman Martyrology`), `G parse_name refuses the garbled p3- name` (old: parsed). A–C pass on old. §3 reported 22/5 with D also failing — D passes in this seat's run because the standing rundir was already healed (leg 4) before either fail-on-old run's D leg could read a garbled manifest; the difference is the heal's own effect, not a discrepancy in the fix.

### 4.3 Heal read-backs — remote, firsthand by this seat

- **Served manifest** GET `https://app.orapronobis.media/api/wallpaper/manifest`: HTTP 200, `updated: 2026-11-27T16:04:22.128Z`, 99 entries. 2026-11-27 entries exactly: phone `sts-basileus-…` sha256 `3ccb1fd0d5b6696f6f2b0ea21660c4d5f5ed95314d2e6ad0ce961c8a674f3475` 539,635 B · watch `sts-basileus-…` sha256 `a9a7bcac74bfe5ad771a61119044aff91d06edb259369537b9a9144397711bb4` 394,996 B · phone/watch Gospel entries as §3. **No `p3-` entry for 2026-11-27; no `p3-` or `p2-` entry of any date stands in the served manifest.**
- **File routes:** garbled name HTTP 404 (phone and watch); clean name HTTP 200 (phone 539,635 B · watch 394,996 B).
- **Drive currents** (fork standing tooling, `list_children` on `phone-current` / `watch-current`): both list exactly `holy-souls-in-purgatory__2026-11.jpg` · `sts-basileus-auxilius-and-saturninus-roman-martyrology__2026-11-27.jpg` · `the-fig-tree-and-the-enduring-word__2026-11-27.jpg` — no `p3-` name stands in either current.
- **Desktop pick:** served `https://orapronobis.media/assets/daily-wallpaper-desktop.jpg` HTTP 200, 362,650 B, sha256 `9f7f3b83db5a035655a9ee6ae01a5a8d276101f9d00bf389a9a5919433fc0e8b` — matches §3 (publish commit `2bdf6592`). The image was opened and read by this seat: band reads `Sts Basileus Auxilius and Saturninus Roman Martyrology` — no `P3`.
- **Site background:** served `images/daily-wallpaper.jpg` HTTP 200, 134,207 B, sha256 `25ee21d73b9c9016640a9ef3c603119b45ea90fc56fe96b22c1f1b0635422d1e` — matches §3 (re-run commit `a7a99ba4`).
- **Nov 26 `p2-` stock residue:** NOT deleted — confirmed standing instruction kept (§1.5 out of scope); the served manifest carries no `p2-` entry, consistent with §3.4.3.
- **Phone field leg:** still John's verdict, as §3.5 states; the chain's heal claim rests on the store read-backs above.

### 4.4 Deviations (§3.4) — judged

1. **Heal leg order swap 3↔4 — SOUND.** The fixed desktop path resolves the wide raw by the cleaned subject, which only the leg-4 raw copy stands up; leg 3's own preconditions were met and no leg's content changed.
2. **One failed Pages deploy re-run — SOUND.** Same publish commit re-run once to success; the served asset read back byte-identical (sha256 above) — no second publish, no content drift.
3. **`p2-` residue left — SOUND.** Expressly out of scope in §1.5; deleting it without the chain's word would itself be a scope breach, and the served surface carries no residue.

### 4.5 Closeout

- Review seat: chain-v700-review · contract 1248 judged met · phase record 2924 passed.
- Next: Ship seat closes the chain (fork-only; no app deploy, no pin per §2.4).

## §5 Ship — chain-v700-ship (contract 1249 · phase record 2925)

- **Date:** 2026-11-27 · **Ship shape: FORK-ONLY** — this record merged to the standing clone's main + board closeout is the ship. No app deploy, no pin.
- **Fork fix (local-only, `muse-draft-week`, not pushed anywhere — standing practice):** `58ff26870` shared helper `cleaned_subject_slug` · `24ae9d1d4` rotator spec-clean + cleaned-subject dedupe · `f93cdb03b` desktop band + stock guard + set-build guard · `53593dd52` widened check.
- **Checks:** widened `runner/test_wallpaper_title_prefix.py` **27/27 ALL PASS** on the fixed tree; fail-on-old reproduced at Review — legs E/F/G fail on the pre-fix tree (old rotator promoted the garbled name, old desktop band read `P3 Sts Basileus …`, old stock `parse_name` accepted the garbled name), and leg D failed against the pre-heal garbled standing manifest. Standing wallpaper suite green beside it (set · rotate spec · rotate monthly · stock delete 33 ok).
- **Heal read-backs (verified at Review, §4.3, remote stores govern):** Drive `phone-current` + `watch-current` list exactly the clean saint file + Gospel + monthly — no `p3-` name in either current; served wallpaper manifest (99 entries, updated 2026-11-27T16:04:22Z) carries no `p3-` entry for 2026-11-27 on either variant, garbled file routes 404, clean routes 200; served desktop pick (362,650 B, sha256 `9f7f3b83…`) band reads `Sts Basileus Auxilius and Saturninus Roman Martyrology` — no `P3`; served site background (134,207 B, sha256 `25ee21d7…`) painted title clean; standing rundir rebuilt clean (leg D passes against it).
- **Review:** PASS (§4, commit `8e9bf4a`).
- **Why no app pin:** the chain ships fork-only with no app deploy and no pin BECAUSE the garble's seats all stand in the fork pipeline — the Plan §1/§2.4 verdict, Review-confirmed (§4.1): the app build carries no title derivation, no slug cleaning, and no name band; the one garbled served entry was bad data stocked through a correct-shape route, healed by deletion, not by an app change.
- **Standing field leg:** John's phone confirmation that his home-screen wallpaper title reads clean. Drive current is healed (read-backs above), so the phone's folder-sync should stand the clean file; the field verdict remains John's and this chain does not claim it.
