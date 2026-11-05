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
| `phone-current` | The live phone wallpapers (one set, flat) |
| `watch-current` | The live watch wallpapers (one set, flat) |
| `phone-queue` | Upcoming phone sets, rolling 7-day queue |
| `watch-queue` | Upcoming watch sets, rolling 7-day queue |
| `archive` | Displaced current sets, names preserved |
| `manifests` | One `rotation-<YYYY-MM-DD>.json` per completed rotation |

Queue files sit directly in the queue folder, or in a dated subfolder
`queue/<YYYY-MM-DD>/`; the rotator reads both layouts.

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
   - Every file currently in `phone-current` / `watch-current` moves to
     `archive`, name preserved; on a name collision the archived copy is
     suffixed with the rotation date (`-rotated-<D>` before the extension).
   - `D`'s files move queue → matching current folder.
   - A manifest `rotation-<D>.json` (date, rotated_at, files moved in/out
     with Drive IDs, source folders) is uploaded to `manifests`, with a
     local copy in `--rundir`.
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

## Queue discipline

- Keep a rolling 7-day queue: generate/upload sets for the coming week,
  rotate one date per day.
- Never upload a set under non-production names, and never place files for
  a date in `current` directly — `current` changes only through the
  rotator, so the manifest always matches reality.
- A subject set is complete only when phone and watch queues carry the
  same subjects for the date; the rotator refuses partial sets.
