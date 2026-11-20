# v554 — Wide daily image set: every phone-set image gets a wide version

- **Line:** Ora Pro Nobis
- **Status:** Plan — approved TO SHIP (John, Ora thread, 2026-11-20 11:39 CT; run level raised by his amendment the same minute), chain running Plan → Implement → Review → Ship
- **Registry:** DevOps Board row 1496 · Scope record 2209 passed · Scope contract 621 closed
- **Relay intake:** Goals Board task 1055
- **Time contracts:** 621 (Scope, closed) · 622 (Plan, holder v554-chain)

## 1 · Scope

DEFECT (John, Ora thread, 2026-11-20 10:55 CT, verbatim): "The wife daily image does not come with the gospel image or the monthly devotion" — decoded: the WIDE (desktop) daily image. The desktop step (runner/site_desktop.py, v526; composition v535) composes ONE wide image from the day's single pick and publishes it as assets/daily-wallpaper-desktop.jpg. The day's Gospel image and the monthly devotion image have no wide versions; no wide Gospel image and no wide monthly-devotion image stand in its output.

Verified from code at Scope: pick_site_wallpaper() takes ONE date-stamped phone file (saint-first) from Drive phone-queue + phone-current; composite_desktop() builds the single 1920×1080 frame (v535: full-bleed ground of the art itself at full brightness, no gradient, no darkening — the wide rule: paint more of the background, never dark space); publish_desktop() commits assets/daily-wallpaper-desktop.jpg to Jctebo/spotify_praylist main and dispatches the Pages deploy. The full phone/watch set is assembled by runner/wallpaper_rotate.py (Gospel + saint into phone-current/watch-current; monthly extra <slug>__YYYY-MM.jpg in current). The wide step never reads the Gospel file or the monthly extra.

APPROVED (John, 2026-11-20 11:39 CT, scope package 54): Q1 A — delivery shape = separate wide files, each named and standing (NOT one rotating single). Q2 B (John's pick, against recommendation A) — EVERY image in the day's phone set gets a wide version, not only the Gospel image and the monthly devotion. Q3 A — fixed role names for the wide files (assets/daily-wallpaper-desktop-gospel.jpg · assets/daily-wallpaper-desktop-monthly.jpg; the pick file assets/daily-wallpaper-desktop.jpg stands unchanged). Q4 A. Run level: TO SHIP (John's amendment, verbatim: "Actually ship all the way" — supersedes the package's Stop before Ship).

## 2 · Plan

### The day's phone set, enumerated from runner/wallpaper_rotate.py

The set the rotator assembles for a date D, read from the phone variant (the desktop step's standing source):

- **Daily members** — every file stamped `<slug>__<YYYY-MM-DD>.<ext>` that stands for D. The rotator promotes the whole stamped set from queue to current and refuses partial sets (phone and watch subjects must match). In generation (README-wallpapers.md) the set is: exactly ONE Gospel-scene subject (every day, `gospel_scene=True`) + the day's saint/devotion subject(s) — one calendar saint on a normal day, TWO saints on a multi-memorial day (e.g. 2026-11-16: saint-gertrude + saint-margaret-of-scotland), a feast subject on a feast day (e.g. 2026-11-18: dedication-of-the-basilicas-of-saints-peter-and-paul beside the Gospel scene the-parable-of-the-pounds), and on a saintless day the Gospel scene alone (e.g. 2026-11-15).
- **Monthly member** — ONE extra stamped `<slug>__<YYYY-MM>.<ext>` standing in phone-current (promoted from monthly-devotions/phone staging by the rotator; state-based, never blocks the daily set).
- **Exclusion (v416 one-picture-per-subject, standing production rule)** — a daily-stamped file whose subject equals the monthly extra's subject is the private-devotion duplicate: it is NOT a separate set member; the monthly file is the set's one picture for that subject (the 2026-11-20 rotation record carries exactly this: holy-souls-in-purgatory__2026-11-20.jpg excluded on phone and watch).

The desktop step enumerates the set from the pick's own candidate pool — Drive phone-queue + phone-current, date-stamped, deduped by name — applies the v416 exclusion, and reads the monthly member from phone-current (fallback: monthly-phone staging).

### Fixed role names (Q3 A pattern, extended to every member under Q2 B)

| Member | Asset path (served) | Local run output |
|---|---|---|
| The pick (standing rule: saint subject first, else first alphabetically — UNCHANGED) | `assets/daily-wallpaper-desktop.jpg` (UNCHANGED) | `desktop-wallpaper-<date>.jpg` (unchanged) |
| The Gospel member — the day's non-saint daily member, when exactly one non-saint daily member stands (the package's Q2 definition) | `assets/daily-wallpaper-desktop-gospel.jpg` | `desktop-wallpaper-gospel-<date>.jpg` |
| The monthly member | `assets/daily-wallpaper-desktop-monthly.jpg` | `desktop-wallpaper-monthly-<YYYY-MM>.jpg` |
| Every further member (an additional saint; an additional non-saint subject) | `assets/daily-wallpaper-desktop-<subject-slug>.jpg` | `desktop-wallpaper-<subject-slug>-<date>.jpg` |

Rules at the edges, decided at Plan: (a) on a saintless day the Gospel member IS the pick — its one composition publishes to BOTH the pick asset and the gospel asset, so the gospel address always carries the day's Gospel image; (b) on a day with more than one non-saint daily member (a feast image beside the Gospel scene), no filename signal separates the Gospel scene from the feast subject, so each takes its subject-slug name and the gospel role name is not used that day — the run output WARNs the ambiguity, never silent; (c) a missing monthly member WARNs and is skipped — it never blocks the daily members (the rotator's standing posture).

### Implement shape (runner/site_desktop.py only)

- New set enumeration beside the standing pick: `phone_set_members(date_iso)` returns the ordered member list (role, source name, Drive item) — pick first, then gospel, then monthly, then further members alphabetically. `pick_site_wallpaper` itself is untouched: the pick member IS its result, so the pick's file, name, rule, and composition cannot drift.
- Each member downloads through the same Drive route the pick uses, composes through the standing `composite_desktop()` (v535 composition, unchanged), and writes its local output file.
- `--apply` publishes ALL composed members in ONE commit on main through the standing git blob/tree route (publish_desktop generalized to a file list; the pick's asset path and commit shape stand), then dispatches the deploy once.
- Failure posture (the step's standing rule, extended): a miss on any one member WARNs and never blocks the others or the pick publish; a miss on the PICK keeps the standing behavior — WARN, exit 1, nothing published.

### Harness

- `runner/test_site_desktop_set.py` — simulation tests over the enumeration + role assignment with the Drive reads stubbed: standard day (pick + gospel + monthly) · two-saint day (both saints get wide versions, Q2 B) · saintless day (gospel member is the pick, both assets) · monthly-duplicate exclusion (v416) · feast day with two non-saint subjects (subject names, gospel-role WARN) · missing monthly (skipped, daily members stand).
- Live local run for the known complete date 2026-11-20 (pick saint-felix-de-valois · Gospel jesus-cleanses-the-temple · monthly holy-souls-in-purgatory): every member produces a 1920×1080 wide file, and the pick output is unchanged in shape (same asset name, same local name, 1920×1080, composed by the standing function).

### Ship

Commit runner/site_desktop.py + the harness + this document on a local branch, merge to main, push (read-back: main pushed · remote in sync). Then run the extended step with `--apply` for the current production wallpaper date — the production run state stands at run dir 2026-11-22 (episodes, date+2); its rotation record (rotation-2026-11-20.json) stands the phone set for **2026-11-20**, which is the desktop step's date — and verify each wide asset serves at orapronobis.media/assets/<role name> byte-equal to the local composition. Registry: pass Ship, flip row 1496 Live, What's New entry per the runner-release precedent (v526/v535 carried What's New entries).

Expectations (wanted ASAP + hard deadlines, Fri 2026-11-20 America/Chicago): Plan section published by 12:10 CT · Plan passed by 12:20 CT · Implement + harness green by 13:00 CT · Review passed by 13:20 CT · Ship + production verification by 14:00 CT.

## 3 · Implement

Landed in runner/site_desktop.py (the only production file touched), built in a clean checkout of GitHub main (86c8989):

- `phone_set_members(date_iso, pick_name)` — enumerates the day's phone set from the pick's own candidate pool (phone-queue + phone-current, date-stamped, deduped by name), applies the v416 monthly-duplicate exclusion, finds the monthly member in phone-current (fallback: monthly-phone staging), and assigns the fixed roles exactly as planned: pick → `assets/daily-wallpaper-desktop.jpg`; the single non-saint daily member → `assets/daily-wallpaper-desktop-gospel.jpg`; the monthly member → `assets/daily-wallpaper-desktop-monthly.jpg`; every further member → `assets/daily-wallpaper-desktop-<subject-slug>.jpg`. The saintless-day pick takes both the pick and gospel assets; a multi-non-saint day sets the ambiguity flag instead of guessing.
- `_download_drive_file(item, name)` — the pick's Drive download route, shared by the non-pick members.
- `publish_desktop_set(files, date_iso)` — one blob per member, ONE tree, ONE commit on main, one deploy dispatch. The standing single-file `publish_desktop` stands untouched for its existing callers.
- `main()` — composes every member through the standing `composite_desktop()`, writes each local output (pick's name unchanged), and on `--apply` publishes all composed members in the one commit. A member miss WARNs and the others proceed; an enumeration failure falls back to the pick alone; a pick miss keeps the standing WARN + exit 1.
- `pick_site_wallpaper` and `composite_desktop` are byte-unchanged — the pick's rule, file, name, and composition cannot drift.

Harness: `runner/test_site_desktop_set.py` (new) — **22 ok / 0 not-ok**: standard day · two-saint day (Q2 B) · saintless day (pick carries both assets) · v416 exclusion · feast day (ambiguity flagged, subject names, gospel asset unused) · missing monthly.

Live local run, 2026-11-20 (the known complete date), no --apply: pick saint-felix-de-valois__2026-11-20.jpg → desktop-wallpaper-2026-11-20.jpg (131,695 bytes, 1920×1080) — **byte-identical to the nightly production file the old code wrote**; Gospel jesus-cleanses-the-temple__2026-11-20.jpg → desktop-wallpaper-gospel-2026-11-20.jpg (149,703 bytes, 1920×1080); monthly holy-souls-in-purgatory__2026-11.jpg → desktop-wallpaper-monthly-2026-11.jpg (134,459 bytes, 1920×1080). Every member of the set produced a wide file.

## 4 · Review

Light review (streamlined path) of commit 7e1026e on release/v554. Diff against main: exactly three files — runner/site_desktop.py, runner/test_site_desktop_set.py (new), this document. runner/wallpaper_rotate.py and every phone/watch step are untouched.

Function-level read: `pick_site_wallpaper` and `composite_desktop` are byte-identical to main; `publish_desktop`'s code is identical (docstring only, noting it stands for single-file callers). The new code is additive beside them: the set enumeration, the shared download helper, the one-commit set publish, and the set loop in main(). Q2 B holds in the code as written — every enumerated member composes and publishes; nothing narrows the set back to Gospel + monthly (the two-saint harness case carries the second saint as a full member). The pick's file, name, rule, and composition stand unchanged.

Verification on a clean checkout of the committed HEAD (7e1026e), per the committed-tree rule: harness re-run **22 ok / 0 not-ok**; live local run for 2026-11-20 reproduced all three wide files at the same byte counts (131,695 · 149,703 · 134,459, each 1920×1080), and the pick output is again byte-identical to the nightly production file. PASS.

## 5 · Ship

SHIPPED LIVE 2026-11-20 ~12:15 CT — ahead of the 14:00 CT hard deadline. Registry row 1496 Live · What's New 372.

Code: Implement 7e1026e + Review 4892a9b merged to main (merge 7f09ac5) and replicated to GitHub with byte-identical SHAs — read-back: **main pushed · remote in sync** (GitHub main = 7f09ac5 at the push read-back).

Production run: the extended step ran with `--apply` for the current production wallpaper date **2026-11-20** (the production run state stands at run dir 2026-11-22, episodes date+2; its rotation record rotation-2026-11-20.json stands the 2026-11-20 phone set). All three members composed and published in ONE commit (ed0c7b0e) with one deploy dispatch (run 44787249230): pick saint-felix-de-valois → assets/daily-wallpaper-desktop.jpg (131,695 bytes) · Gospel jesus-cleanses-the-temple → assets/daily-wallpaper-desktop-gospel.jpg (149,703 bytes) · monthly holy-souls-in-purgatory → assets/daily-wallpaper-desktop-monthly.jpg (134,459 bytes).

SHIP-STAGE DISCOVERY AND FIX, recorded plainly: the first verification fetch showed the two new addresses at 404 — scripts/build_pages_artifact.py staged the desktop asset under a v526 glob (`daily-wallpaper-desktop.*`) that matches only the pick's filename, so the hyphenated role files could never enter the Pages artifact. Fix landed on main as commit 5d7e31bb (child of the asset commit, via the standing API publish route): the builder now globs `daily-wallpaper-desktop*` and stages EVERY committed desktop file at its own name, the pick's staging unchanged; proven locally first (a builder run stages all three files byte-equal). One more deploy dispatch (run 44788275020) carried it live. The publish_audio workflow rides the same builder, so the nightly publish stages the set too. This widened the shipped diff by the one builder file beyond the Plan's confinement note — the fix is inside the release's own publish path and was required for the approved outcome (the wide files serving at their addresses).

Verification at the public addresses, after the fix deploy: all three serve byte-equal to the local compositions —
- https://orapronobis.media/assets/daily-wallpaper-desktop.jpg — sha256 bb65c18c…
- https://orapronobis.media/assets/daily-wallpaper-desktop-gospel.jpg — sha256 1f92d764…
- https://orapronobis.media/assets/daily-wallpaper-desktop-monthly.jpg — sha256 6932e904…

The two new served images were also read visually: the Gospel frame carries "JESUS CLEANSES THE TEMPLE / TODAY'S GOSPEL" and the monthly frame "HOLY SOULS IN PURGATORY / NOVEMBER DEVOTION", each composed under the standing v535 shape (the art's own ground at full brightness, the portrait panel right-of-center). GitHub main stands at 5d7e31bb plus this document's Ship-section commit; the nightly job's step W(d) entry point and report field are unchanged, so no job-body change — from tonight forward the nightly production composes and publishes the whole wide set.

## Post-ship note — 2026-11-20 12:21 CT

John's report (Ora Pro Nobis thread, 2026-11-20 12:21 CT, verbatim): "Running the sync and only getting 1"

His PC folder sync (daily-desktop-images-sync.ps1, run by the .cmd) still pulled only the pick file after this ship — the v554 ship covered the publishing side only; the PC-side pull list stood unchanged. Fixed in the Ora thread: the script now pulls all three standing addresses into the same folder as daily-desktop-<date>.jpg · daily-desktop-gospel-<date>.jpg · daily-desktop-monthly-<date>.jpg, with the same temp-download, JPEG check, and hash-skip per file. The updated script was delivered to John in the Ora thread to drop beside his .cmd.

SUPERSEDED (2026-11-20 12:26 CT): the three-fixed-addresses version above stands as history only. Per John's word in the Ora thread, the PC script was simplified: it now clears his Ora Daily Desktop folder, lists the repo's published assets through the GitHub API, and downloads every daily-wallpaper-desktop*.jpg under its own name. Delivered in the Ora thread as daily_images_download.txt.

Field leg: OPEN — John's re-run of the simplified sync script is the verdict.

## Known gap — found 2026-11-20 12:26 CT

The wide set is not a fixed three: extra saints publish as assets/daily-wallpaper-desktop-<subject-slug>.jpg (runner/site_desktop.py, verified on main). Gap in the shipped code: publish_desktop_set builds its tree from the head tree plus the day's blobs and never deletes prior days' extra slug files — after a multi-saint day, the extra files keep standing and serving stale.

John's word (Ora thread, 2026-11-20 12:26 CT): a small fix-forward on the runner side — delete desktop-* assets not in the day's set, in the same commit — when the seat next works this line. NOT registered: no registry row, no intake task.
