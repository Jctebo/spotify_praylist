# v331 — Novenas land in Midmorning: emergency placement fix

- **Project:** Ora Pro Nobis
- **Slug:** v331-novena-placement-fix
- **Registry:** DevOps Board app, project ora-pro-nobis, row id 606, version "v331"
- **Branch:** release/v331 in the fork (~/workspace/projects/spotify_praylist-fork), worktree ~/workspace/.worktrees/v331, cut from muse-draft-week @ 7f938f3
- **Run Directive:** Emergency To Ship — production-break fix-forward under the Scope Gate exception (v321/v327 pattern); John's defect report 2026-11-08 22:39 CT; same-day notice stands in the Ora thread. v328 later makes placement settings-driven.
- **Chain:** combined Scope+Plan (exception) · Implement · Review BEFORE the trunk landing (the change touches the nightly push path) · Ship

## 1 · Scope

- **Agent:** Scope+Plan Agent (v331) — Scope claim record 1138, claimed 2026-11-09T04:41:09Z
- **Exception basis:** production break. The Novenas — the center of John's prayer day — do not appear in the app's block structure today, and tonight's midnight run (2026-11-09 00:00 CT, target Nov 11) would store its day the same broken way. Scope and Plan run combined under the Scope Gate production-break exception; Review still runs before the trunk landing.

### Defect evidence (verified first-hand this pass)

- John's report (2026-11-08 22:39 CT, with screenshot): "Novenas still not showing in app." The screenshot shows the unblocked episodes rendered at the bottom of the Listen screen under "FROM TODAY'S PODCAST", below all six blocks.
- Production D1 read (prayer app database, stored date 2026-11-08, 17 episodes): 13 rows carry block = "unblocked" — all 12 novena episodes (sorts 6–17) plus marian-antiphon-angelus (sort 3). Only 4 episodes stand placed: morning-prayer → Morning (sort 1), daily-rosary → Morning (sort 2), auxilium-christianorum → Afternoon (sort 4), daily-reflection → Night (sort 5).
- All 17 rows stand audio_state = "present" with r2_key set (example: novena-st_martin_of_tours, size_bytes 2,678,637) — the audio plays. The "Not available in the app yet" line on the cards is the v318 text line (text_state = "missing" on all 17); episode texts first attach with tonight's midnight run. That is NOT part of this release and needs no re-push.
- Root cause: the push helper's resolver (`jobs/push_episodes_to_app.py`, `resolve_blocks`) places an episode only when a mapped player_sources title or a prayer-item name from the app's day payload matches the episode title's head. No prayer item is named for the novenas or the Marian Antiphon, so both fall to 'unblocked'. v328's Scope found the same gap from the other side: the helper's resolver against the 2026-11-10 manifest resolves only 4 of 16 episodes to a block.

### The seed placement (all of it)

Placement is expressed as DATA in the push path — a small seed table the resolver consults — carrying exactly the v328 seed rows for the producers the name-match cannot place:

| Episode | Block |
|---|---|
| every episode whose id starts `novena-` | Midmorning |
| `marian-antiphon-angelus` | Morning |

- Sort stays manifest order: the Antiphon stands at manifest position 3, which is exactly its v328 order-table position in Morning (Intentions 0 · Morning Prayer 1 · Daily Rosary 2 · Marian Antiphon 3); the novenas follow in manifest order inside Midmorning, behind the Intentions card the player splices at index 0 (v325, Live).
- The four already-placed producers are untouched: the seed table names none of them, and their name-match resolution is re-verified unchanged by the harness leg.
- **Minimal-change boundary:** no app Worker change, no migration, no settings, no screens. If discovery had shown the Worker also needs a change, this chain would have stopped and reported — discovery shows it does not: the Worker stores and renders whatever block the push sends.
- **Forward compatibility with v328:** the seed table is a named, isolated mapping in the push path; v328's settings read supersedes it when v328 lands (v328 stands approved Through Review, last in the player line). Nothing here builds any part of v328.

### Acceptance criteria

1. The push of the REAL 2026-11-08 manifest under the fixed resolver places all 17 episodes: 12 novenas → Midmorning, the Antiphon → Morning at sort 3, the four standing placements unchanged, zero 'unblocked'.
2. A placement check in the v312/v327 harness family proves the mapping on a manifest fixture (novena ids including underscores); harness-v312 and harness-v327 re-run green, tallies read from complete logs (the known check-11 cache-pin class is pre-ruled).
3. Review verifies the production diff is ONLY the seed table plus its resolver hook, and dry-proves placement on the fixture before the landing.
4. Ship proof is the production re-push itself (the v327 invocation shape, `--rundir` leg included): the push prints its "App push (v312)" field with 17 episodes, all present; the production read-back shows the 12 novenas at block = Midmorning, the Antiphon at Morning, audio_state = "present" preserved on all 17, text_state untouched by this release, and the stored Intentions splice positions correct (Intentions first in Midmorning per v325).
5. Tonight's midnight run inherits the fix with NO job-sheet change: the sheet's step 4B already invokes this helper. §5 states this expressly after verification.

- **Concerns and Information Needs:** The seed covers exactly two producer families. Any future producer the name-match cannot place still falls to 'unblocked' and renders under "FROM TODAY'S PODCAST" — visible, never silent, and v328's settings are the standing cure. The re-push replaces the stored day 2026-11-08 wholesale through the helper's own replace-day commit (the v312 design: staging first, one D1 batch swap, prior day intact on any failure). Rollback is a revert of the landing commit on muse-draft-week; the stored day's blocks would return to 'unblocked' only on a further re-push, which no rollback step performs.

## 2 · Plan

- **Agent:** Scope+Plan Agent (v331) — combined pass under the emergency exception.

### 2.1 — Build steps (pinned)

1. On branch release/v331 (worktree ~/workspace/.worktrees/v331, base muse-draft-week @ 7f938f3): in `jobs/push_episodes_to_app.py`, add the seed placement as data — a module-level `SEED_PLACEMENT` list of (episode-id prefix or exact id, block) rows carrying exactly the §1 table — and consult it in `resolve_blocks`: an episode the seed names takes its seed block; every other episode resolves exactly as today (player_sources titles, then day-payload names, longest head match, else 'unblocked'). No other behavior changes: staging, text resolution, the replace-day commit, and the read-back asserts stand untouched.
2. Extend the harness family with a placement check (app/tests, v312/v327 pattern): run the resolver against a manifest fixture carrying the real 2026-11-08 episode set (novena ids with underscores included) with the door stubbed to today's production answers, and assert all 17 placements from criterion 1.
3. Commit the build; append §3 with the diff and harness evidence.

### 2.2 — Harness plan (pinned)

- New placement check green on the changed tree and red on the base tree (the base resolver leaves 13 unblocked — the defect itself is the red proof).
- harness-v312 full re-run: green, with the standing check-11 cache-pin class ruled as before (this release touches no client code and renames no cache).
- harness-v327 full re-run: green (10 ok / 0 FAIL at its Ship).

### 2.3 — Review and Ship plan (pinned)

- Review BEFORE the trunk landing: independent diff inspection against §1's boundary, an independent harness re-run, and a dry placement proof on the fixture.
- Ship: merge release/v331 to muse-draft-week; re-push the 2026-11-08 set with the v327 invocation (`--report ~/workspace/ora-runner-runs/2026-11-08/report.json --rundir ~/workspace/ora-runner-runs/2026-11-08/out`); production read-back per criterion 4; verify the nightly job sheet needs no change (the fix lives in the helper step 4B already invokes) and state it expressly; four-piece flip (release row Live · shipped record · What's New 44 · Ship phase pass); Curator note `ship-v331-2026-11-08`.

- **Concerns and Information Needs:** The landing must complete before 00:00 CT so the midnight run executes the fixed helper from muse-draft-week. The push's own read-back asserts (stored date, counts, per-track verification) stand as the failure gate: any mismatch exits non-zero and the re-push is re-run, never hand-patched in D1.
