# Devotional wallpapers — Google Drive delivery and rotation

Muse-run replacement for the old rclone → OneDrive wallpaper path
(cutover plan 2026-11-03, §2 step 4 + §4 item 5). Pictures live in Google
Drive under `.devotional_wallpapers`; John's phone-side folder-sync app
carries Drive → device. The rotation program only moves files — it never
renders. Generation is a separate step (below).

## Drive folder tree

Root: `.devotional_wallpapers` — folder IDs are constants in
`runner/wallpaper_rotate.py` (`FOLDERS`).

| Folder | Holds |
| --- | --- |
| `phone-current` | The live phone wallpapers (one daily set + the monthly extra, flat) |
| `watch-current` | The live watch wallpapers (one daily set + the monthly extra, flat) |
| `phone-queue` | Upcoming phone sets, rolling 7-day queue |
| `watch-queue` | Upcoming watch sets, rolling 7-day queue |
| `archive` | Displaced current sets, names preserved |
| `manifests` | One `rotation-<YYYY-MM-DD>.json` per completed rotation |
| `monthly-devotions/phone` | Staged monthly-devotion extras for the phone (one file per month) |
| `monthly-devotions/watch` | Staged monthly-devotion extras for the watch (one file per month) |

Queue files sit directly in the queue folder, or in a dated subfolder
`queue/<YYYY-MM-DD>/`; the rotator reads both layouts.

Staging folder IDs: `monthly-devotions` root
`1JgGt63u8ny4bY3wt47rnSVmBTN4nJd-X`, its `phone` subfolder
`1_xCNj4HfKiU9CyPbSoYobjkpCHbXCbmr`, its `watch` subfolder
`1OrOog7pvNkIos8-3GfTy1tjJeI1_Z6AQ` (constants `monthly-root` /
`monthly-phone` / `monthly-watch` in `wallpaper_rotate.py`).

## Production filename — the only allowed shape

```
<slug>__<YYYY-MM-DD>.jpg
```

- Built ONLY by `build_filename(spec, variant)` in
  `jobs/novena/devotional_image_contract.py` (slug = `slugify(spec.title)`).
- The `__<date>` stamp is the contract: the Pages steps in
  `publish_audio.yml` / `deploy_pages.yml` grep `phone-current` for
  `__${today}.(jpg|jpeg|png|webp)$`, and the inventory parser in
  `sync/devotional_onedrive.py` keys on the same stamp.
- The variant is carried by the folder, never by the filename. Phone and
  watch copies of one subject share one filename and live in different
  folders.
- Hand-built names are forbidden. Example of the broken pattern fixed on
  2026-11-03 (hand-run `wallpapers.py`): `st-elizabeth-2026-11-05-phone.jpg`
  matched nothing downstream. `devotional_image_contract` now exposes
  `PRODUCTION_FILENAME_RE` / `require_production_filename()` and
  `build_filename()` self-checks its output.

Nov 5 worked example — before → after:

| Before (hand-run, wrong) | After (production) |
| --- | --- |
| `st-elizabeth-2026-11-05-phone.jpg` | `phone-queue/saint-elizabeth__2026-11-05.jpg` |
| `st-elizabeth-2026-11-05-watch.jpg` | `watch-queue/saint-elizabeth__2026-11-05.jpg` |
| `holy-souls-2026-11-05-phone.jpg` | `phone-queue/holy-souls-in-purgatory__2026-11-05.jpg` |
| `holy-souls-2026-11-05-watch.jpg` | `watch-queue/holy-souls-in-purgatory__2026-11-05.jpg` |

Note the slug also changes: the full spec title is slugified
(`SAINT ELIZABETH` → `saint-elizabeth`, `HOLY SOULS IN PURGATORY` →
`holy-souls-in-purgatory`), not a hand-shortened form.

## Monthly-devotion extra — filename and model

Since 2026-11-05, each current folder carries, **in addition to** the
daily set, ONE monthly-devotion image: the month's traditional devotion
(November — Holy Souls in Purgatory; December — Divine Infancy of
Christ; January — Holy Name of Jesus; February — Holy Family; March —
Saint Joseph; April — Holy Eucharist; May — Blessed Virgin Mary; June —
Sacred Heart of Jesus; July — Precious Blood of Jesus; August —
Immaculate Heart of Mary; September — Our Lady of Sorrows; October —
Holy Rosary). It is an extra, never a replacement: both daily rotations
run exactly as before. The extra stays in `current` all month and is
swapped only when the served month changes — first changeover is the
rotation serving 2026-11-08 (Holy Souls), then 2026-12-01 (Divine
Infancy), and so on.

Monthly filename — the only allowed shape:

```
<slug>__<YYYY-MM>.jpg
```

- Built ONLY by `build_monthly_filename(title, month)` in
  `jobs/novena/devotional_image_contract.py`
  (`MONTHLY_FILENAME_RE` / `require_monthly_filename()` sit beside the
  daily pattern). Phone and watch copies of a month share one filename;
  the variant is carried by the folder, exactly as for daily files.
- The `.` right after the two month digits is what separates a monthly
  name from a daily one — a daily name has `-DD` there, so the daily
  `__<YYYY-MM-DD>` greps (Pages steps, site-wallpaper pick, inventory
  parser) never match a monthly extra, and the rotator's monthly pattern
  never matches a daily file.
- Artwork is rendered per variant with the same contracts as daily
  images (phone: 1080×1920 vertical layout; watch: 1024×1024 with the
  clock-zone rule), titled with the devotion name and subtitled
  `<MONTH> DEVOTION` (the contract's monthly-fallback spec shape).
- Local library + Drive staging: the finished set lives locally at
  `~/workspace/goals/saint-of-the-day-picture-rotation/files/monthly-devotion-wallpapers/`
  (`phone/`, `watch/`, raw art in `art/`, IDs in `library.json`) and is
  staged on Drive in `monthly-devotions/phone` and
  `monthly-devotions/watch` — all months staged ahead (Nov 2026 –
  Dec 2027), so the rotator always finds the next month waiting.

How the rotator handles the extra (state-based, in
`runner/wallpaper_rotate.py`):

- Every plan reads the target date's month and each current folder's
  monthly state: `current` (the folder already holds a file stamped
  `__<YYYY-MM>` for the target month), `would_promote` (staging holds
  it), or `missing` (not staged).
- On a normal daily rotation, displaced-file archiving skips the target
  month's extra (it stays); a previous month's extra is archived like
  any displaced file; a promotable extra moves
  `monthly-devotions/<variant>` → `<variant>-current` in the same run.
- A `missing` extra never blocks or alters the daily rotation: the
  manifest records `monthly_extras.<variant>.action: "missing"` and the
  run's JSON summary carries the monthly states. Stage the month image
  and re-run the same date: the plan becomes a monthly-only fix-up
  (`WOULD_ROTATE` with only monthly moves; the rewritten manifest is
  flagged `"monthly_fixup": true`).
- Manifests record the extras under `monthly_extras` (per variant:
  month, action `promoted` / `already_current` / `missing`, name, Drive
  ID), and monthly moves are tagged `"monthly": true` in the
  moved-to-archive / moved-to-current lists.

## Generate-then-rotate sequence (what the cron agent does)

For target date `D` (= run date + 2 for the picture side's rolling queue):

1. **Try the rotation, dry-run first:**
   `python3 runner/wallpaper_rotate.py --date <D>`
2. **If it exits nonzero with `MISSING_QUEUE`** (it lists exactly which
   variant/subject is missing, and has made no moves):
   a. Build the day's specs from the devotional calendar (fork code:
      `jobs/novena/generate_devotional_wallpapers.py` resolution path).
   b. Render each subject with Muse Image, then overlay text with the
      fork render code (`devotional_wallpaper_render.overlay_wallpaper_text`).
      Watch layout rule: the clock occupies the top ~30–35% — keep that
      zone dark/empty, face at ~50% height, title at bottom. If a watch
      render sits high, apply the shift/reflow step (as in the hand-run
      `wallpapers.py` `shift_down`) before overlay. Phone and watch are
      rendered independently.
   c. Name every output with `build_filename(spec, variant)` — never by
      hand — and verify each name with `require_production_filename()`.
   d. Upload each file to its queue folder with the Drive connector CLI:
      ```
      /opt/hatch/bin/hatch_gws_cli drive +upload <ABS_LOCAL_PATH> --parent <phone-queue|watch-queue folder id> --name <production name>
      ```
      (Folder IDs: the `FOLDERS` constants in `wallpaper_rotate.py`.)
   e. Re-run step 1; it must now report `WOULD_ROTATE`.
3. **Rotate for real:**
   `python3 runner/wallpaper_rotate.py --date <D> --apply --rundir <run dir>`
   - Every daily file currently in `phone-current` / `watch-current`
     moves to `archive`, name preserved; on a name collision the
     archived copy is suffixed with the rotation date (`-rotated-<D>`
     before the extension). The target month's monthly extra is NOT a
     daily file: it stays in `current` untouched (see the monthly-extra
     section above for its own moves).
   - `D`'s files move queue → matching current folder.
   - A manifest `rotation-<D>.json` (date, rotated_at, files moved in/out
     with Drive IDs, source folders, `monthly_extras` summary) is
     uploaded to `manifests`, with a local copy in `--rundir`.
4. **Idempotency:** re-running for an already-rotated date reports
   `ALREADY_ROTATED` and exits 0 with no moves (current holds `D`'s files
   and the manifest exists). If current holds `D`'s files but no manifest
   exists, the rotator reports `ALREADY_IN_CURRENT_MANIFEST_MISSING` and
   still makes no moves — investigate before trusting that date.

## Gospel-scene subject — every day (John, approved 2026-11-05)

Every day's wallpaper set includes a subject depicting the day's Gospel
scene, alongside the saint/devotion subjects (the saint follows the same
ladder as the podcast: calendar saint, Our Lady on Saturdays, the
Martyrology/1962 lead on other saintless days). It stands alongside the
standing data-driven devotions (e.g. BVM on Saturdays, Holy Souls in
November), which are unchanged. Name the file with `build_filename()` like
any other subject.

Build the Gospel spec with `gospel_scene=True` in `DailyImageSpec`. Its
overlaid subheading reads "Today's Gospel" — the contract returns
`TODAY'S GOSPEL` as its subtitle, whatever its classification or subtitle
fields hold. The Gospel spec must not borrow the saint's classification
for its text: its `classification` field is only an ordering artifact
(it sets the spec's sort position in the day's set), never wording.

## Queue discipline

- Keep a rolling 7-day queue: generate/upload sets for the coming week,
  rotate one date per day.
- Never upload a set under non-production names, and never place files for
  a date in `current` directly — `current` changes only through the
  rotator, so the manifest always matches reality.
- A subject set is complete only when phone and watch queues carry the
  same subjects for the date; the rotator refuses partial sets.
- Monthly extras: exactly one file per month per variant in
  `monthly-devotions/<variant>`, named with `build_monthly_filename()`.
  Stage a month before its first rotation; if a month was missed, stage
  it late and re-run any date in that month — the fix-up converges
  `current` to the right extra without touching the daily set.
