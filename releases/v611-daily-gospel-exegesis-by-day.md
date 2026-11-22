# v611 — Daily Gospel Exegesis addable to a block, resolved by the day

## §1 Scope

John (Ora thread, 2026-11-21 22:55 CT): "Daily Bible exegesis should be available to be added to a day block based on the day" · confirmed the gap 22:56 CT ("i don't see it in the ad[d]") · approved To Ship 22:57 CT ("I approve to ship"). Serialized behind v610.

## §2 Grounding

- The series stands in the podcast catalog as an RSS series (`daily-gospel-exegesis`, the Anchor feed the day build's exegesis leg reads). Its payload entries carry `key` (feed GUID), `title`, `url`, `publishedMs`, `durationS` — there is NO progress pointer to resolve by; the resolver dates each entry from its `publishedMs`.
- THE DATE RULE (production fixture, Improvement D): `app/tests/fixtures-v536/feeds-dge-2026-11-18.xml` — the episode FOR 2026-11-18 carries pubDate Tue, 17 Nov 2026 17:00:00 GMT. The feed releases each day's episode the day BEFORE: the resolver picks the episode whose Chicago release date = presented date − 1. No latest/nearest fallback.
- GAP RULE: no episode released the day before → no track stands, no placeholder, no substitution (harness leg R11).

## §3 Plan

New contents selector kind `day` with one standing key (`daily-gospel-exegesis`) in both validators (client `opnCheckContents590` · server `validateProfileContents`) + the read seam (`opnContentsOf590`); a fourth "Daily" door in the Add ladder; the resolver stands in the fold's resolver pass beside the course resolver. Defaults and Reset stay day-free by construction (the contents universe offers no day item — harness leg S6).

## §4 Implement

- `5e5e086` — day selector kind: validators, read seam, labels, ladder Daily door, resolver by the day (client.ts · index.ts · fixtures-v611 incl. the derivation script).
- `5ab261e` — harness-v611 (28 legs) + renders-v611 + fixture derivation script.
- Fail-on-old recorded at Implement: 8 ok / 20 not ok against a clean e450a3b checkout — every new leg fails there; the 8 passes are guards that stand on both trees by design.

## §5 Review

Review passed at the parked state: harness-v611 28/0 on the branch (a re-run read 27/1 — the 1 was the pin-vs-moved-main leg, resolved at merge). Renders driven (`v611-review-renders/`: the ladder's Daily rung · the composed 2026-11-18 day carrying the day's own episode). Ship held behind v610 per the serialization order; hold lifted when v610 shipped (pin `ora-pro-nobis-v610-1` · main ec4cfa8).

## §6 Ship — SHIPPED LIVE 2026-11-22

Ship seat verified the parked state firsthand: branch `release/v611` at 5ab261e, worktree clean.

- MERGE: main ec4cfa8 merged into `release/v611` (210338f). Two conflicts, both the same grounded union: v611's `day` branch vs main's v609-repair-2 generalized `course` rule (any podcast series key) — in the client validator, the client read seam, and the server validator. Resolution keeps BOTH: the generalized course rule stands AND the day branch stands beside it in all three seats. Whole-tree marker check on the merged tree: v611 markers (OPN_DAY_KEY_611 · the Daily ladder door) AND the standing markers (opnBindLockGate609 · opnMigrateProfiles609 · mig609 · opnRowId610 · playedKeyOcc) ALL stand; zero conflict markers remain.
- GATES on the merged committed tree: harness-v611 **28/0** · harness-v603 **49/1** (the 1 is R2, the door set gaining "Daily" — by design, recorded at Implement) · harness-v610 **18/0** · harness-v609 **29/0** · harness-v609fix **10/0** · harness-v609vault **34/0** · harness-v601 **7/1** (the pre-existing T1, at base state) · harness-v607/v597/v604 outputs BYTE-IDENTICAL on the merged tree and on pristine main (broken-at-base, left as found).
- One harness-scaffolding repair at ship, assertions untouched: harness-v611's `stripServerValidate` lost its `.includes(key as string)` strip anchor — main's v609 repair 2 generalized the server course check and the cast no longer stands in `validateProfileContents`; the dead anchor was dropped (adc2667) — the same driver class as v610's ship repair.
- SHIP: merge to main fast-forward (adc2667) · SW pin bump `ora-pro-nobis-v611-1` (e9c6a54) · deploy via the connector-surrogate driver from the standing clone at head e9c6a54 — **Worker version fc5b8beb-3307-405a-a245-048ee5eb2aff** · served proof: https://app.orapronobis.media/sw.js reads `ora-pro-nobis-v611-1`, home 200 · push via the GitHub Git Data API (byte-identical replication, SHA-asserted, 5 commits): main pushed · remote in sync.
- Rollback target: Worker 1f2147c6 (pin `ora-pro-nobis-v610-1`).
- FIELD LEGS (John's): add Daily Gospel Exegesis to a block from the Add list's Daily door — the day's episode stands · a gap day stands none.
