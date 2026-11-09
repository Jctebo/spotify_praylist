# v333 — Fix the episode text route (bad X-Episode-Id on underscore ids)

- **Project:** Ora Pro Nobis
- **Slug:** v333-episode-text-route-underscore-fix
- **Registry:** DevOps Board app, project ora-pro-nobis, row id 610, version "v333"
- **Branch:** release/v333 in the fork (~/workspace/projects/spotify_praylist-fork), worktree ~/workspace/.worktrees/v333, cut from muse-draft-week @ 9f91183
- **Run Directive:** Emergency To Ship under the production-break exception (John's blanket word 2026-11-08 23:00 CT)
- **Chain:** combined Scope+Plan · Implement · Review BEFORE the trunk landing · Ship — one emergency chain agent, compressed

## 1 · Scope

- **Agent:** Emergency Chain Agent (v333, 2026-11-08) — Scope claim record 1154, claimed 2026-11-09T05:10:26Z
- **Exception basis:** production break of the v327 class. The v318 episode texts never land in the app: the app push aborts at text staging, before its replace-day commit, so no text state is written at all. Unrepaired, tonight's midnight step-4B push (2026-11-09 00:00 CT, target Nov 11) aborts identically and the whole Nov 11 app commit never lands. Scope and Plan run combined under the production-break exception; Review still runs before the trunk landing.

### Defect evidence (verified first-hand this pass)

- Live failure, main seat 2026-11-08 ~23:08 CT: `jobs/push_episodes_to_app.py --report ~/workspace/ora-runner-runs/2026-11-08/report.json --rundir ~/workspace/ora-runner-runs/2026-11-08/out` (the sheet's exact invocation, script files staged into out/) → `text staging failed for novena-dedication_of_the_lateran_basilica: {'error': 'bad X-Episode-Id'}`. The helper raises at the first failed staging and never reaches the replace-day commit.
- Production D1 read-back after that failure: all 17 episodes stored for 2026-11-08 stand `text_state = "missing"` — no text has ever landed, for any episode.
- The 2026-11-08 manifest carries 17 episodes, 12 with underscore ids (every novena); `novena-dedication_of_the_lateran_basilica` is simply the first underscore id the helper reaches.

### Root cause — the exact line

- `app/worker/src/index.ts` **line 479**, inside the text staging route (`POST /api/agent/player/episodes/text`, the `seg[4] === "text"` branch):
  `if (!/^[A-Za-z0-9][A-Za-z0-9\-]*$/.test(episodeId)) return err(400, "bad X-Episode-Id");`
  The character class carries letters, digits, and hyphen — no underscore.
- Its two siblings already carry the underscore since v327: line 465 (audio staging route, `A-Za-z0-9\-_`) and line 498 (replace-day commit manifest check, `A-Za-z0-9\-_`). A complete sweep of the episode-id validations in `app/worker/src/index.ts` finds exactly these three shape-enforcement sites; line 479 is the only one still missing the underscore. v327 fixed the two sites that stood in its failure path (audio staging + commit); the text route — v318's twin of the audio route, added after the v327 sweep's failure evidence — kept the old class.
- The failure is total, not per-episode: the helper stages every text and audio object first and commits once at the end, so one 400 aborts the push before any commit — audio for a re-pushed day would also fail to refresh, and a first push of a new day (tonight's Nov 11) lands nothing at all.

### The fix (all of it)

- Line 479: `/^[A-Za-z0-9][A-Za-z0-9\-]*$/` → `/^[A-Za-z0-9][A-Za-z0-9\-_]*$/` — the underscore joins the allowed set, identical to the v327 change at lines 465/498. Nothing else changes: no id, manifest, helper, route shape, schema, or client change. Underscores are URL-safe; the read route already `decodeURIComponent`s ids; R2 keys (`texts/<date>/<episode_id>.txt`) accept underscores unchanged.

### Acceptance criteria

1. Against a local instance on the fixed tree, a text staging POST for `novena-dedication_of_the_lateran_basilica` returns 200 with the byte size (on the unfixed tree it returns 400 "bad X-Episode-Id").
2. The standing push helper, unmodified, pushes the REAL 2026-11-08 manifest into that local instance and exits 0; every stored row reads `text_state = "present"` (17/17) and the text read route serves one underscore novena's exact script bytes.
3. harness-v312 and harness-v327 stay green on the fixed tree (regressions).
4. Review verifies the production diff is ONLY the line-479 pattern widening.
5. Ship proof is the production re-push itself: the 2026-11-08 push (sheet invocation, scripts staged into out/) exits 0; production D1 reads `text_state = "present"` on the day's episodes (17/17 expected; any exception named).

### Concerns and Information Needs

- The fix is deliberately minimal, same as v327: any id character beyond underscore stays rejected, and a future manifest introducing another character class fails loudly again by design — a new Scope item, not a silent widening here.
- Sequencing: this fix lands BEFORE the v324 Ship deploy (v324 rebases onto it), so the prayer Worker deploys once with both changes in their own order. Trunk head is checked at merge time; the v324 merge may land first — the merge here takes whatever head stands and the diff stays one line either way.
- Rollback is a pure redeploy of the prior production Worker — no migration, no data change rides with this release.
- The helper's one-rundir shape (audio in `out/`, scripts in the run root) is NOT changed here; the sheet's staging copy (step 4B, main-seat fix 2026-11-08 23:10 CT) carries it.

## 2 · Plan

- **Agent:** Emergency Chain Agent (v333, 2026-11-08) — combined pass under the emergency exception.

### 2.1 — Build steps (pinned)

1. On branch release/v333 (worktree ~/workspace/.worktrees/v333, base muse-draft-week @ 9f91183): change the regex literal at `app/worker/src/index.ts` line 479 from `/^[A-Za-z0-9][A-Za-z0-9\-]*$/` to `/^[A-Za-z0-9][A-Za-z0-9\-_]*$/`. No other line changes. No client change → no SW cache rename.
2. Commit the build; append §3 with the diff and harness evidence.

### 2.2 — Harness plan (pinned)

- New `app/tests/harness-v333.mjs`, modeled on harness-v327 (scratch wrangler instance inside this worktree, HARD GUARD against the shared checkout, v312-mold seed, port 8944): (a) the worker bundles clean; (b) a direct text staging POST for `novena-dedication_of_the_lateran_basilica` with synthetic bytes returns 200 and the exact size — the defect leg; (c) the REAL push helper (via the standing push leg, unmodified) pushes the real 2026-11-08 manifest (report + rundir out/, scripts already staged there) and exits 0, its "App push (v312)" field reading 17 present / 0 missing with stored date 2026-11-08; (d) D1 read-back: all 17 stored rows read `text_state = "present"`; (e) GET `/api/player/text/2026-11-08/novena-st_martin_of_tours` serves bytes exactly equal to the run's `script-novena-st_martin_of_tours.txt`.
- Regressions on the fixed tree: harness-v327 (its push leg now also exercises text staging end to end) and harness-v312, read from their COMPLETE logs.
- Tallies are read from complete log files, never truncated output.

### 2.3 — Review plan (pinned)

- Fresh second pass by the same chain agent before the landing: `git diff` of the branch against its base shows exactly one changed line in one file; the harness-v333 log stands complete and green; the regression logs stand green. Any extra change returns the item to Implement.

### 2.4 — Ship plan (pinned)

1. Merge release/v333 into muse-draft-week (check the trunk head first — v324's Ship merge may have landed; merge onto the standing head).
2. Deploy the production Worker `ora-pro-nobis-app` from the merged trunk via the connector-surrogate wrangler route (standalone wrangler at ~/workspace/.tools/wrangler-env, API token fetched inside the driver via the dynamic-credential surrogate — never printed, logged, or filed). NEVER deploy-board.py (that is the Goals Board's script).
3. Re-run the 2026-11-08 push exactly as the sheet runs it: `cp ~/workspace/ora-runner-runs/2026-11-08/script-*.txt ~/workspace/ora-runner-runs/2026-11-08/out/` then `python3 jobs/push_episodes_to_app.py --report ~/workspace/ora-runner-runs/2026-11-08/report.json --rundir ~/workspace/ora-runner-runs/2026-11-08/out` from the fork on the merged trunk. Verify from production D1 (Cloudflare connector): `text_state` counts for date 2026-11-08.
4. Flip, four pieces, each read back: pass the Ship record · POST the shipped record (title required; camelCase shippedAt + whatsNewId) · What's New id = live max + 1, READ FIRST (v330 took 45; v324/v332 ships are racing) · release row Live (full-field upsert if the shipped POST alone does not flip it).
5. §5 appended + published; Curator note `ship-v333-2026-11-08` via POST /api/agent/notes {noteKey, body}.
6. Time contract 77 (ora-pro-nobis): "Fix committed on release/v333" ASAP, hard deadline 23:32 CT · "Production Worker deployed with the text route fixed" ASAP, hard deadline 23:45 CT · "Re-push verified + Ship flip complete" ASAP, hard deadline 23:55 CT — each closed met as it lands.

## 3 · Implement

- **Agent:** Emergency Chain Agent (v333, 2026-11-08) — Implement claim record 1156, claimed 2026-11-09T05:11:34Z

### The change (all of it)

- `app/worker/src/index.ts`, line 479 (text staging route, `POST /api/agent/player/episodes/text`): the `X-Episode-Id` pattern `/^[A-Za-z0-9][A-Za-z0-9\-]*$/` → `/^[A-Za-z0-9][A-Za-z0-9\-_]*$/`. `git diff` against the branch base: 1 file changed, 1 insertion, 1 deletion. No other product line changes; no client change, no SW cache rename.

### Harness evidence (complete logs in app/tests/)

- **harness-v333** (`harness-v333.log`): **13 ok / 0 FAIL**. The defect leg stands first-hand: a direct text staging POST for `novena-dedication_of_the_lateran_basilica` returns 200 with the exact byte size (35) — the same request returns 400 "bad X-Episode-Id" against production today. The REAL push helper, unmodified, pushes the real 2026-11-08 manifest into the local instance and exits 0; its field reads verbatim: `App push (v312): date pushed 2026-11-08 · episodes 17 (17 present / 0 missing) · per-track audio verified 17 · stored date after push 2026-11-08 · texts 17 / 0`. D1 read-back: all 17 stored rows read `text_state = "present"`; GET `/api/player/text/2026-11-08/novena-st_martin_of_tours` serves bytes exactly equal to the run's script file.
- **Regressions on the fixed tree:** harness-v327 **10 ok / 0 FAIL** (`harness-v327-on-v333.log`) · harness-v312 **59 ok / 0 FAIL** (`harness-v312-on-v333.log`).
- Pre-run check: none of the 17 real scripts trips the helper's T1 withholding guard (no `[`/`{`/`<` markup, all valid UTF-8), so 17/17 texts is the correct expectation, not an assumption.
- Two harness-side defects were found and fixed during this pass, both in the new push leg, neither in product code: the token assignment landed redacted in the written file (SyntaxError), then `_app_token` proved to be a callable in the door module and takes a lambda. The harness was re-run in full after each fix; the green log above is the final complete run.

### Concerns and Information Needs

- The v327 regression instance reads texts 0/17 in its own stored-day line: its push leg loads the helper from the v327 worktree, whose helper predates the v318 text leg. Its own assertions (audio/commit) all pass; the text path is proven by harness-v333 against THIS trunk's helper. Named here so the tally is never misread as a v333 regression.
- The defect class is now fully swept for episode ids: all three shape-enforcement sites in `app/worker/src/index.ts` (lines 465, 479, 498) carry the identical `\-_` class.

## 4 · Review

- **Agent:** Emergency Chain Agent (v333, 2026-11-08) — Review claim record 1157, claimed 2026-11-09T05:15:21Z (second pass, fresh read, before the trunk landing)

### Verdict: PASS

- **Diff boundary:** `git diff 9f91183 -- app/worker/src/index.ts` on the final branch tree shows exactly ONE changed line — line 479's pattern gains the underscore, inside the text staging route and nowhere else. The rest of the branch diff is the release document, the new harness + push leg, and their logs. §2's pin holds byte-for-byte.
- **Harness evidence re-read from the complete logs:** harness-v333 13 ok / 0 FAIL (defect leg 200 + size on the exact production-failing id · real push exits 0 with "texts 17 / 0" · text_state 17/17 · byte-exact text read-back) · harness-v327 10 ok / 0 FAIL · harness-v312 59 ok / 0 FAIL. No tally is taken from truncated output.
- **Criteria (§1):** 1 MET (defect leg) · 2 MET (harness-v333 checks 6–13) · 3 MET (regressions) · 4 MET (this diff read) · 5 stands as the Ship proof, executed in §5.
- **Deviations:** none in product code. The two harness-side defects found at Implement (redacted token literal · `_app_token` callable) are recorded in §3 and touch no product line.

### Concerns and Information Needs

- Ship sequencing against v324 stands as §1 records: this merge takes the standing trunk head, and v324's Ship rebases onto it for the prayer Worker deploy order (v333 first).
- The one-rundir helper shape stays a sheet-level concern (the step-4B staging copy), unchanged by this release; a helper-side two-root resolution is a follow-on candidate for the Curator, not part of this fix.
