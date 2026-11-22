# Ora Pro Nobis — Muse-run runner

Production machinery for the Muse-run cutover (John, 2026-11-03). The runner
builds one full day of Ora Pro Nobis episodes with the repo's own code for
everything deterministic, and the agent (Muse) only at the text seam and at
cache-miss TTS renders. Voices: `avocado_v2:MAI_03` (main) and
`avocado_v2:MAI_01` (Auxilium Christianorum versicle/response role only).
ElevenLabs is excluded — there is no fallback provider anywhere in this code.

## Pipeline

```
pass1_collect.py  --date YYYY-MM-DD --out RUNDIR
        |  repo builders, offline/deterministic:
        |  publish jobs (build_audio_jobs), novena set (resolver + engine),
        |  rosary mystery set from the contract weekday map, offline
        |  lectionary, liturgical context + music season from repo code.
        v
RUNDIR/plan.json + texts/*.json + novenas/*.json + script-*.txt
RUNDIR/texts-needed.json      <- the stub bridge (file-boundary form):
        |                        every model-seam block, with its context and
        |                        its deterministic fallback text (if any).
        v
AGENT writes RUNDIR/texts-provided.json   {"blocks": {"<block id>": "<text>"}}
        v
pass1b_merge.py   --rundir RUNDIR
        |  provided text replaces the seam segments; missing + fallback
        |  exists -> fallback stays, flagged in plan.json; missing + NO
        |  fallback -> FAILS LOUDLY (exit 2, nothing written).
        v
pass2_build.py    --rundir RUNDIR [--publish]
           render (cache-first) -> assemble -> brand (repo _mix_audio)
           -> loudnorm (repo targets -16 LUFS / -1.5 dBTP / LRA 11, after
              branding, measured two-pass linear — the hand-run method; the
              repo's single-pass dynamic loudnorm pumps the branded
              music-only head and fails the head-check)
           -> settled verification -> sidecars + report.json + report.md
           [--publish: R2 + manifest reconcile + feed graft + commit
            + deploy dispatch + live verify + ledger flip]
```

## Exact nightly commands (cron agent)

Target date is **today + 2** (the pipelines' own default after the cutover
fix; the runner always passes the date explicitly):

```bash
cd ~/workspace/projects/spotify_praylist-fork
DATE=$(date -d "+2 days" +%F)
RUNDIR=~/workspace/ora-runner-runs/$DATE
python3 runner/pass1_collect.py --date "$DATE" --out "$RUNDIR"
# agent: read $RUNDIR/texts-needed.json, write $RUNDIR/texts-provided.json
python3 runner/pass1b_merge.py --rundir "$RUNDIR"
python3 runner/pass2_build.py --rundir "$RUNDIR" --publish
# v608: the readings grab runs every night (also on ledger-skip nights). It
# grabs RUN_DATE's readings — the USCCB feed carries no future days, so the
# grab is for the current day, not TARGET — and stores them server-side for
# the Mass tab. Its one line is carried into the closing report; a FAILED
# line never blocks the run.
python3 runner/grab_readings.py
```

The scripts re-exec into the repo venv automatically when the system python
lacks the repo dependencies (override with `ORA_RUNNER_VENV`). All scratch
lives under `~/workspace` — never `/tmp` (512 MB tmpfs).

## Cache

- Fragment cache: `~/workspace/ora-runner-cache/fragcache`
  (override per run with `--cache-dir`). Key:
  `sha1("<full voice>|<normalized text>")`, file `<key>.mp3`; TTS text is
  normalized first with the repo's normalize-prayer-tts skill code. The
  synthesized church bell (`bell-v3.wav`, jobs.publish.bell v3 — inharmonic
  partial stack with per-partial exponential decays and a strike transient,
  4.8 s, RMS-matched to the retired 392/784/1176 Hz sine bell) lives there too.
- Per-run scratch: `RUNDIR/work/`, `RUNDIR/branding-cache/`.

## Failure rules

- **TTS failure stops the episode, and blocks the day.** A fragment render
  whose JSON result does not read back the exact requested voice is retried
  once; a second failure marks the episode `TTS_FAILED` in the report. Other
  episodes still build, but `--publish` aborts before any external write —
  a partial day is never published, and no other provider is ever substituted.
- **Ledger skip (idempotency).** `--publish` first reads
  `~/workspace/goals/ora-pro-nobis-tts-migration-gpt-4o-mini-tts-shutdown/hidden_files/published-drops.json`;
  if the target date is already `published`, it exits with `SKIP` and does
  nothing else.
- **Reconcile (tail finisher).** `python3 runner/pass2_build.py --rundir RUNDIR --reconcile`
  finishes a publish whose tail was interrupted (the 2026-11-07 case: the
  Nov 9 publish completed R2 + graft + commit + deploy, then the 1700 s
  wrapper timeout killed the run during live-feed verification polling,
  before the ledger flip). It checks, in order, the local set (report.json
  settled pass + `out/` files), the R2 manifest/bucket, the live feed
  (items matched by GUID/enclosure identity), and the ledger — then
  completes only the missing steps with the publish path's own functions:
  R2 upload of the missing objects + manifest reconciliation, graft of the
  missing items only, commit + deploy, live verify, ledger flip LAST
  (feed commit + deploy run recorded; `--ledger PATH` overrides the ledger
  for tests). A partial/unverified local set aborts before any external
  write; a fully published date prints `already complete — no changes`
  and touches nothing. On a wrapper timeout, run `--reconcile` once, then
  report.
- **Manifest rule.** The R2 `.audio-sync-manifest.json` is never rewritten
  from the local plan (that is what `scripts/sync_r2_audio.py` would do, and
  it would drop every older episode's entry). The publish path GETs the
  bucket's current manifest, merges the new objects into it in the same
  schema (`{"version": 1, "objects": {key: {"size", "sha256"}}}`), and PUTs
  the merged manifest back **last**, after the audio/sidecar uploads, then
  verifies by listing the bucket.
- **Feed rule.** New RSS items are built with the repo RSS code from the new
  sidecars and grafted onto the **current live feed**
  (`https://jctebo.github.io/spotify_praylist/podcast.xml`) at the top, in
  repo sort order (pubDate desc, episode_id desc). Existing live items are
  left byte-identical — the fork's committed `docs/podcast.xml` is stale
  (May 2026) and must never be committed wholesale. The first time a new date
  is published, a backup of the pre-drop live feed is kept next to the ledger
  (`podcast-feed-backup-<rundate>-before-<targetdate>.xml`).
- **Publish set.** Uploads are exactly the plan's episode files
  (`RUNDIR/out/<episode_id>.mp3` + `.json`, keys = filenames at the bucket
  root) — never a bare `out/*.mp3` glob, because `out/` also holds the
  hand-run-name copies (`<file_base>.mp3`) and `-script.txt` files.

## Settled rules baked in

- Fragment gap 350 ms (Daily Reflection: 15000 ms from its contract
  `silence_ms`); contract pauses are segment items and suppress the gap at
  their boundaries; rosary intention pause 750 ms per decade (repo contract).
- Novena bell + 5000 ms personal-intention pause come from the traditional
  contracts through the repo engine; short-form contracts carry neither.
- Branding on ALL episodes including Daily Reflection
  (`daily-reflection` was removed from `exclude_entry_ids` at cutover);
  seasonal bed from the EPISODE date's Romcal season via repo code; welcome =
  the branding config welcome text rendered as the first segment in the main
  voice; 3.5 s lead-in; bed −30 dB; 6 s outro; loudnorm AFTER branding.
- Date+2 lives in the pipelines themselves
  (`jobs/publish/run_audio_pipeline.py`, `jobs/novena_contracts/pipeline.py`)
  with the cutover comment; the two-date catch-up lists shifted by the same +1.
- Verification numbers always come from the settled pass — this VM has
  write-visibility lag, so build-time probes read short.
- **Calendar-only saint + daily Gospel (John, 2026-11-05; supersedes the
  witness ladder approved the same morning).** The Daily Reflection saint
  is read from ONE source: John's devotional calendar — the ICS at
  `~/workspace/goals/saint-of-the-day-picture-rotation/files/devotional-calendar-2026-11-06-to-2027-12-31.ics`
  (the same file imported to his Outlook Devotion calendar) — via
  `jobs/publish/devotional_calendar_saint.py`. No runtime resolution from
  romcal, the Martyrology dataset, or the ladder. Selection, for the
  target date: SUNDAY → no saint, ever — the reflection is the day's
  Gospel message only; liturgical entries name saint(s) → those saints,
  all of them, never trimmed (entries the calendar marks superseded do
  not count); no liturgical saint + a `🔵 Roman Martyrology (private
  devotion)` roster entry → the entry's `Principal:` saint, framed as the
  calendar frames it (a private devotion from the Roman Martyrology);
  any other saintless day (solemnities/feasts of the Lord, Ash Wednesday,
  Holy Week, the Easter octave…) → Gospel only. Gospel-only days carry the
  explicit state `witness_state`/`witness_source` = `gospel_only` (with
  `gospel_reason` `sunday` or `no_saint_named`) — never a silently empty
  saint. plan.json context carries `witness_name`, `witness_source`
  (`calendar`/`roster`/`gospel_only`), `witness_state`, `gospel_reason`,
  and `saint_of_day`/`saint_witness` set to the same calendar saint.
  Nobody picks any other saint: no novena-completion pick, no invented
  saint. WORDING: a named saint is carried by the plain calendar form — a
  "The Church celebrates …" sentence; there is NO "Today's saint is …"
  sentence and NO backup-attribution sentence (both retired with the
  ladder). GOSPEL EVERY DAY: the Daily Reflection joins a reflection on
  the day's Gospel (`gospel_citation` / `gospel_text` in plan context)
  with the saint — daily, not a fallback. The episode description is
  filled from the same calendar lookup where it is rendered
  (`jobs/publish/contracts.py`, with a safety net in
  `runner/pass1_collect.py`): the saint slot takes the calendar saint, or
  the roster Principal with the Roman Martyrology (private devotion)
  named; gospel_only days keep the Gospel wording and the empty slot
  never ships. FALLBACK: for target dates outside the calendar file's
  range (2026-11-06 → 2027-12-31), the resolver keeps the previous
  behavior — the witness ladder in `jobs/publish/saint_witness_ladder.py`
  (kept in place for history) over the repo liturgical context — until a
  new calendar file supersedes this one. Novena contracts and feast dates
  are untouched by this rule.

## Repo-venv note

The hand runs used `~/workspace/scratch-daybuild/nv-venv` (built from the
fork `requirements.txt`). The bootstrap in `runner/_common.py` finds it (or
`ORA_RUNNER_VENV`, or `fork/.venv`) automatically.
