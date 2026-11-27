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
