# v327 — Fix-forward: player push rejects novena episode ids (underscore)

- **Project:** Ora Pro Nobis
- **Slug:** v327-player-push-episode-id-fix
- **Registry:** DevOps Board app, project ora-pro-nobis, row id 599, version "v327"
- **Branch:** release/v327 in the fork (~/workspace/projects/spotify_praylist-fork), worktree ~/workspace/.worktrees/v327, cut from muse-draft-week @ c59a32b
- **Run Directive:** Autonomous to Ship — emergency production-break fix-forward (Scope Gate exception, 2026-11-08); same-day notice to John stands in the Ora thread and the main chat
- **Chain:** combined Scope+Plan (v321 precedent) · Implement · Review BEFORE the trunk landing · Ship

## 1 · Scope

- **Agent:** Scope+Plan Agent (v327) — Scope claim record 1121, claimed 2026-11-09T03:01:35Z
- **Exception basis:** production break. The player stands empty in production and tonight's first scheduled push (2026-11-09 00:00 CT, target Nov 11) would fail identically. Scope and Plan run combined under the Scope Gate production-break exception; Review still runs before the trunk landing.

### Defect evidence (verified first-hand this pass)

- Production `GET /api/agent/player/stored-day` reads `{"ok": true, "storedDate": null, "episodeCount": 0, "tracksPresent": 0, "tracksMissing": 0, "segmentBlocks": []}` — no day was ever stored, so the Prayers page shows no Intentions cards (John's sighting, Ora thread 2026-11-08 20:58 CT). The Intentions tab works (the v305-era segment store is separate and unaffected).
- The standing push fails now: `python3 jobs/push_episodes_to_app.py --report ~/workspace/ora-runner-runs/2026-11-08/report.json` → replace-day commit failed (400): "bad episode_id in manifest".
- Manifests read first-hand: `~/workspace/ora-runner-runs/2026-11-08/report.json` carries 17 episodes, 12 with underscore ids (`novena-dedication_of_the_lateran_basilica`, `novena-st_martin_of_tours`, `novena-st_andrew_avellino`, …); `2026-11-10/report.json` carries 16 episodes, 11 with underscore ids. Both standing manifests fail the same way.

### Root cause

- `app/worker/src/index.ts` enforces the episode-id shape `/^[A-Za-z0-9][A-Za-z0-9\-]*$/` — letters, digits, hyphens; no underscore. The novena ids carry underscores, so every push whose manifest contains a novena episode is rejected whole (the commit validates every episode before writing anything, so one bad id blocks the entire day).

### Enforcement sites (complete sweep of the app/ tree this pass)

A grep for the pattern class and for every `.test(` / id check across `app/worker/src/{index,client,ui,logo}.ts` and the app tests finds exactly TWO shape-enforcement sites, both in `app/worker/src/index.ts`:

1. **Line 452** — episode audio staging route (`POST /api/agent/player/episodes/audio`): the `X-Episode-Id` header check → 400 "bad X-Episode-Id".
2. **Line 471** — replace-day commit (`POST /api/agent/player/day`): the manifest `episode_id` check → 400 "bad episode_id in manifest".

Not enforcement: line 621 checks only that an episode id is present on the audio read path (no shape test). The client (`client.ts`, `ui.ts`) validates nothing about episode ids — it consumes them as opaque keys and URL-encodes them. No other file in `app/` carries an episode-id pattern.

### The fix (all of it)

- Widen the pattern at both sites to `/^[A-Za-z0-9][A-Za-z0-9\-_]*$/` — identical except the underscore joins the allowed set. Nothing else changes: no id, manifest, helper, route, schema, or client change. Underscores are URL-safe; the payload already `encodeURIComponent`s ids; R2 keys (`episodes/<date>/<episode_id>.mp3`) accept underscores unchanged.

### Acceptance criteria

1. The push of the REAL 2026-11-08 manifest commits against a local instance: all 17 episodes, the 12 underscore novena ids included; stored-day reads back date 2026-11-08 with the manifest's counts.
2. harness-v312 stays green on the changed tree (its check-11 SW cache-name pin exception stands as previously ruled — this release does not rename the cache; the diff touches no client code).
3. Review verifies the production diff is ONLY the pattern widening at the two enumerated sites.
4. Ship proof is the production push itself: the Nov 8 push prints its "App push (v312)" field with all episodes present (or names any missing); production stored-day reads 2026-11-08 with the manifest's counts; the session payload shows each block's Intentions card at its actual position (v312's splice position until v325 lands — v325 owns the reordering, not this fix).

### Concerns and Information Needs

- The fix is deliberately minimal: any id character beyond underscore stays rejected. If a future manifest introduces another character class, the push fails loudly again by design — that is a new Scope item, not a silent widening here.
- The Nov 10 push is NOT run by this release (Nov 8 only). Tonight's scheduled 00:00 CT run pushes Nov 11's day under the fixed code.
- Rollback is a pure redeploy of the current production Worker 92a258ef — no migration, no data change rides with this release.

## 2 · Plan

- **Agent:** Scope+Plan Agent (v327) — combined pass under the emergency exception.

### 2.1 — Build steps (pinned)

1. On branch release/v327 (worktree ~/workspace/.worktrees/v327, base muse-draft-week @ c59a32b): change the regex literal at `app/worker/src/index.ts` line 452 and line 471 from `/^[A-Za-z0-9][A-Za-z0-9\-]*$/` to `/^[A-Za-z0-9][A-Za-z0-9\-_]*$/`. No other line changes. No client change → no SW cache rename.
2. Commit the build; append §3 with the diff and harness evidence.

### 2.2 — Harness plan (pinned)

- **Push leg:** run `jobs/push_episodes_to_app.py` against a local app instance (the v312 harness pattern: local Worker + D1/R2 seeded like production) with the REAL `~/workspace/ora-runner-runs/2026-11-08/report.json` manifest and its built MP3s. Pass = the commit returns ok, all 17 episodes commit (12 underscore ids among them), and `GET /api/agent/player/stored-day` on the local instance reads date 2026-11-08 with episodeCount 17 and the manifest's present/missing counts.
- **Regression leg:** harness-v312 on the changed tree, complete log committed; expected green except the standing check-11 cache-pin exception class (the cache name is NOT changed by this release, so check 11 is expected to pass as-is on this base — any FAIL is reported by name and judged against the §1 criteria, never silently waived).
- Complete logs are read in full for tallies, never truncated output.

### 2.3 — Review (before the trunk landing, pinned)

- Verify `git diff` of the release branch against muse-draft-week is exactly the two regex literals (plus the release document and harness logs).
- Re-run the push leg and the harness-v312 leg from a detached guard worktree; rule pass/fail in §4.

### 2.4 — Ship steps (pinned)

1. Merge release/v327 into muse-draft-week with `--no-ff`.
2. Deploy the app Worker via the connector-surrogate wrangler route used by the v312/v320 ships (dry-run first). NEVER deploy-board.py — that script belongs to the Goals Board.
3. Production push: `python3 jobs/push_episodes_to_app.py --report ~/workspace/ora-runner-runs/2026-11-08/report.json` — capture the "App push (v312)" field verbatim for §5.
4. Verify production: `GET /api/agent/player/stored-day` reads 2026-11-08 with the manifest's counts; the session payload (`GET /api/player/day` or the door equivalent) shows an Intentions card in every block that holds one, reporting the ACTUAL per-block positions (v312 splice position until v325 lands).
5. Flip all four pieces: release row Live (camelCase `shippedAt`/`whatsNewId`, next What's New id read at flip time), shipped record (POST requires `title`), phase records passed, document republished. Curator note `ship-v327-2026-11-08`.

### 2.5 — Rollback

- Pure redeploy of Worker 92a258ef (v320's production build). No migration to unwind; the pushed Nov 8 day stays valid under either build (the widened pattern only admits ids the old build rejected at push time; reads never enforced the shape).

### Concerns and Information Needs

- Thin-scope discipline: the Ship agent stops and reports on any snag rather than widening the fix (a second defect in the push path would be named, not folded in).
- The harness instance must be production-shaped (the real manifest, real MP3 bytes) — a fixture manifest without underscore ids would prove nothing.

## 3 · Implement

- **Agent:** Implement Agent (v327) — Implement claim record 1123, claimed 2026-11-09T03:02:39Z; time contract 45
- **Build commit:** 1a3891b on release/v327 · **Harness commit:** ab35bf5

### 3.1 — The change (complete diff against muse-draft-week @ c59a32b, production code)

Exactly two lines in `app/worker/src/index.ts`, each the pinned widening `\-` → `\-_` inside the character class:

- Line 452 (episode audio staging, `X-Episode-Id` header check): `/^[A-Za-z0-9][A-Za-z0-9\-]*$/` → `/^[A-Za-z0-9][A-Za-z0-9\-_]*$/`
- Line 471 (replace-day commit, manifest `episode_id` check): same literal change

No other production line changes. No client change → no SW cache rename (the cache stays `ora-pro-nobis-v320-1` from v320's landing). No migration, no manifest change, no helper change.

### 3.2 — Push leg (Plan §2.2) — PASS

`app/tests/harness-v327.mjs` (driver `app/tests/push-leg-v327.py`): a scratch local instance inside this worktree (port 8943, schema from all migrations, seeded with the v312 mold — 35 prayer items + the 11-intention pool), then the REAL standing helper `jobs/push_episodes_to_app.py`, unmodified, run with the REAL `~/workspace/ora-runner-runs/2026-11-08/report.json` and `--rundir` pointing at the run's built MP3s in `out/`. The driver rebinds only the helper's door target (local base + harness token); the helper code is untouched.

- Helper output, verbatim: `App push (v312): date pushed 2026-11-08 · episodes 17 (17 present / 0 missing) · per-track audio verified 17 · stored date after push 2026-11-08`
- Stored episode ids read back from D1 are exactly the manifest's 17 ids; all 12 underscore novena ids stored; every row `audio_state = present` (the commit's staged-size verification passed for all 17 real MP3s).
- Stored-day read-back: `{"storedDate":"2026-11-08","episodeCount":17,"tracksPresent":17,"tracksMissing":0}`.
- Tally (complete log `app/tests/harness-v327.log`): **10 ok / 0 FAIL**.

### 3.3 — Regression leg (Plan §2.2) — PASS with one named, pre-ruled exception

harness-v312 on this tree (complete log `app/tests/harness-v312-on-v327.log`): **58 ok / 1 FAIL**. The single FAIL is check 11, the literal SW cache-name pin `ora-pro-nobis-v312-1` — superseded by v320's own §2.12 rename to `ora-pro-nobis-v320-1` on this trunk, the identical single FAIL recorded at v320's Implement/Ship and v318's app-half runs. §2.2 of this release expected check 11 to pass as-is on this base; that expectation was wrong (the base is post-v320) and is corrected here — the FAIL is the standing superseded-pin class, not a v327 effect: this diff touches no client code and no cache name. Every other check, including the full door push end-to-end and commit read-backs, is green.

### 3.4 — Named observation for the record (NOT folded into this fix)

The helper resolves an episode's audio file as `<rundir>/<file>`, and the standing run reports carry `rundir` = the run root while the built MP3s stand in `<rundir>/out/`. A push invoked with `--report` alone therefore finds no files and would commit every episode as `missing` (the commit still validates ids first — which is why today's failure surfaced as the 400). The push leg above used the helper's own `--rundir` flag to point at the built files; the Ship pass must do the same for the production push so the day lands with its audio, and §5 will report both facts plainly. Fixing the runner's report `rundir` value or the helper's resolution is a separate item — named here, not changed (the brief forbids helper changes in v327).

### Concerns and Information Needs

- Review: judge the diff by `git diff c59a32b..HEAD -- app/worker/src/` — it must show exactly the two regex lines. The harness tallies above are reproducible from the committed logs.
- Ship: the production push needs `--rundir ~/workspace/ora-runner-runs/2026-11-08/out` alongside the pinned `--report` (see §3.4); report the "App push (v312)" field verbatim in §5 either way.

## 4 · Review

- **Agent:** Review Agent (v327) — Review claim record 1124, claimed 2026-11-09T03:06:29Z; time contract 46
- **Verdict: PASS** — the release lands on this verdict; Ship proceeds under the Autonomous-to-Ship directive.

### 4.1 — Criterion verdicts

1. **Diff is ONLY the pattern widening at the enumerated sites — MET.** `git diff c59a32b..release/v327 -- app/worker/src/` shows exactly two changed lines in `app/worker/src/index.ts` (line 452 staging header check, line 471 commit manifest check), each `\-` → `\-_` and nothing else. The full-branch diff adds only the release document and the harness files/logs. No client change, no cache rename, no migration, no helper or manifest change.
2. **Push leg — MET, independently re-run.** From a detached guard worktree at the Implement head (ae5aae8): harness-v327 **10 ok / 0 FAIL** (log `app/tests/harness-v327-review.log`), tally-identical to Implement. The real helper (byte-identical in both trees, md5 0758fb27…) committed the real Nov 8 manifest: 17 episodes, 17 present / 0 missing, all 12 underscore ids stored, stored-day 2026-11-08 with the manifest's counts.
3. **Regression — MET with the named exception.** Guard re-run of harness-v312: **58 ok / 1 FAIL** (log `app/tests/harness-v312-review-on-v327.log`), tally-identical to Implement. The single FAIL is check 11's SW cache-name pin, superseded by v320's §2.12 rename — §3.3's ruling stands: a pre-ruled pin exception, not an effect of this diff.
4. **§3.4 rundir observation — CONFIRMED as reported.** The helper's `<rundir>/<file>` resolution vs the reports' run-root `rundir` and the `out/` file location are as §3.4 states, verified against both standing reports (2026-11-08, 2026-11-10). It is correctly NOT folded into this fix; Ship runs the production push with the helper's own `--rundir` flag and §5 reports the field verbatim.

### Concerns and Information Needs

- Ship proof stands as pinned in §2.4: the production push's "App push (v312)" field, the stored-day read-back, and the per-block Intentions positions in the session payload (v312 splice positions — the reordering remains v325's).
- The standing follow-on from §3.4 (runner report `rundir` vs `out/`) goes to the Curator note so it is scoped separately, not lost.

## 5 · Ship

- **Agent:** Ship Agent (v327) — Ship claim record 1125, claimed 2026-11-09T03:07:47Z; time contract 47, all expectations met
- **Result: SHIPPED LIVE** — flip 2026-11-09T03:10:20Z

### 5.1 — Landing + deploy

- Merge **53dc63f** (--no-ff, release/v327 → muse-draft-week @ c59a32b). The shared tree's standing unrelated modifications were verified byte-identical before and after the merge (path-disjoint).
- Deploy via the connector-surrogate wrangler route (dry-run first): Worker **514e133f-5999-4a3f-8013-1fb1b0d8ce57** at 100%. No migration. Rollback stands as a pure redeploy of Worker 92a258ef.

### 5.2 — Production push (the ship proof)

Command (helper unmodified; `--rundir` added per §3.4 so the built MP3s resolve): `python3 jobs/push_episodes_to_app.py --report ~/workspace/ora-runner-runs/2026-11-08/report.json --rundir ~/workspace/ora-runner-runs/2026-11-08/out`

- Output field, verbatim: **App push (v312): date pushed 2026-11-08 · episodes 17 (17 present / 0 missing) · per-track audio verified 17 · stored date after push 2026-11-08**
- Stored-day read-back (production, after the push): `{"storedDate":"2026-11-08","episodeCount":17,"tracksPresent":17,"tracksMissing":0,"segmentBlocks":["Afternoon","Evening","Midday","Midmorning","Morning","Night"]}` — all six blocks hold their Intentions segment.
- Session payload: `GET /api/player/day` refuses the agent door (403, Access session required — John's session is the live read). Positions below are the door-equivalent read: the committed block assignment (the helper's own push-time resolution against production data) + the deployed payload builder's splice rule + the stored-day segment proof.
  - Morning: Intentions card at index 1 of 3 tracks, available · Afternoon: index 1 of 2, available · Night: index 1 of 2, available · Midmorning, Midday, Evening: no episodes resolved to the block, card at index 0 of 1, available.
  - 13 episodes (the 12 novenas + Daily Reflection) resolved to the unblocked group under the helper's standing title-head rule (their titles do not head-match a prayer-item name for the date) — standing helper behavior, unchanged by this fix, named here for the record; the Intentions cards John's sighting concerned stand in every block.
- Pre-v325 order stands as expected: the card sits at the v312 splice position (index 1 where a block has episodes). The Intentions-first reordering remains v325's.

### 5.3 — Flip (all four pieces, read back)

- Release row 599: **Live**, shipped_at 2026-11-09T03:10:20Z, whats_new_id **41**, derivedStatus Live.
- Shipped record **401** (title carried, shipped_at + whats_new_id 41).
- What's New **41** — "Player fix: the daily episodes load again" (id read at flip time; 40 was v323's).
- Phase records: Scope 1121 · Plan 1122 · Implement 1123 · Review 1124 · Ship 1125 — all passed. Time contracts 43–47 judged as they closed.
- Curator note `ship-v327-2026-11-08` filed (carries the §3.4 rundir follow-on + the unblocked-resolution observation).

### Concerns and Information Needs

- Tonight's scheduled 00:00 CT run pushes Nov 11's day under the fixed build; its "App push (v312)" field is the standing confirmation that the fix holds in the unattended flow. Note the nightly job sheet's step 4B invokes the helper with `--report` only — under §3.4's finding that push would land its episodes as missing unless the run's report `rundir` points at the built files by then; the follow-on item owns that fix.
- John's phone remains the human acceptance check for the player (cards visible, audio plays).
