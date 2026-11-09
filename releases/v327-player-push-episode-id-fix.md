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
