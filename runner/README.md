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
```

The scripts re-exec into the repo venv automatically when the system python
lacks the repo dependencies (override with `ORA_RUNNER_VENV`). All scratch
lives under `~/workspace` — never `/tmp` (512 MB tmpfs).

## Cache

- Fragment cache: `~/workspace/ora-runner-cache/fragcache`
  (override per run with `--cache-dir`). Key:
  `sha1("<full voice>|<normalized text>")`, file `<key>.mp3`; TTS text is
  normalized first with the repo's normalize-prayer-tts skill code. The
  synthesized sacred bell (`bell.wav`, 392/784/1176 Hz, 4.8 s) lives there too.
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
- **No-saint days (John, 2026-11-05).** When the liturgical context names
  no saint for the target date, nobody picks one: no traditional-calendar
  substitute, no novena-completion pick, no invented saint. The Daily
  Reflection — and any seam text that needs a focus or witness — takes the
  day's Gospel from the offline lectionary (plan.json context carries
  `gospel_citation` and `gospel_text`) as its source and focus, and names
  no saint. The reflection's episode description is rewritten to the Gospel
  focus where it is rendered (`jobs/publish/contracts.py`, with a safety
  net in `runner/pass1_collect.py`), so the empty saint slot never ships.
  Days with a named saint are unchanged; novena contracts and feast dates
  are untouched by this rule.

## Repo-venv note

The hand runs used `~/workspace/scratch-daybuild/nv-venv` (built from the
fork `requirements.txt`). The bootstrap in `runner/_common.py` finds it (or
`ORA_RUNNER_VENV`, or `fork/.venv`) automatically.
