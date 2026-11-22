# v607 — One Edit at the top · tap plays (v604 field fix)

## §1 Scope

John's field verdict on v604 (Ora thread, 2026-11-21 22:01 CT, verbatim): "No. I expected one edit at the top to put the home page in edit form old edit sources see still there" · "It's a weird thing to click a playlist and it notnolay" [not play]. Third limb by John's pick (22:02 CT): "Retire Edit today and Edit profiles — the top Edit is the only editor."

Grounding (from the shipped v604 client on main, not the release doc):
- Edit entry points post-v604: a PER-BLOCK Edit act in each expanded block's prayer head (`opnEnterEdit604(block)` → vault gate → one question → per-block posture, `opn604.block` = ONE block), a "Block page" door per block, the plan row's Edit (the standing-pick sheet, not contents), and the Configure ladder's Edit today / Edit profiles doors. No top-of-page Edit existed.
- Tap post-v604: a collapsed block row toggles expansion (navigation). An expanded prayer-posture row body tap opened the v585 title card for episode rows and did NOTHING for non-episode prayer rows — no row played on tap, against the v576 standing rule (tap plays) and the v604 design (rows inert only IN edit posture).
- The fix: (1) ONE Edit at the top puts the WHOLE page in edit form; per-block Edit entries retire; Done at the top leaves the form. (2) A track-row tap outside edit posture PLAYS; the v585 card re-homes to the row ⋮ menu's Details item. (3) The Configure Edit today / Edit profiles doors retire; the in-place editor reaches contents + block/layer switches for both scopes; orphaned acts (Reset to Default · Delete profile) re-home in the edit bar's overflow; no profile rename act exists in the shipped code (name is given only at the Save New mint), so nothing is dropped there. Stores untouched.

Run level: TO SHIP under the fix-forward discipline (John's field verdict is the order). Streamlined path: diagnosis + Plan in one pass · Implement · light Review · Ship. Row 1581 · intake 1128.

## §2 Plan

- One top Edit (`data-p607edit`) on the plan row (the pick relabeled "Pick"): vault gate → standings → the ONE QUESTION once per session (wording and named targets unchanged) → whole-page edit form: frozen scope banner, frozen edit bar (Save New · overflow · Done), every block expanded with drag handles · remove + restore line · Add (v603 ladder, in-place host); Done (`data-p607done`) leaves the form in one act.
- Shape strip in the form: block switches (the six HOURS) · layer switches (Novenas · Podcasts) · series switches — written AT ONCE through the standing routes (today scope → today-edit route; standing scope → profiles/save), the v594 vault gate's duty passing wholly to this entry.
- Tap plays: the `wirePrayersView` [data-card] handler plays an available descriptor (`tapPlay`); the v585 card call leaves that wiring; `wireRowActs` appends "Details" for episode rows on the home surface.
- Doors retire: `openConfigureLadder593` keeps its head + a word line + Close; the two screen functions stand as unreachable dead code (codebase precedent) because harness-v603/v604 drive them directly for baseline.
- Proof: harness-v607 fail-on-old legs for all three limbs · v604/v603 suites at baseline or superseded-by-design (named) · driven renders of the page in edit form.

## §3 Implement

Worktree `v607-wt`, branch `release/v607` off main 6736a73; build log `projects/ora-pro-nobis/v607-build-log.md`. Commits: ad1f3be (Implement) · 7a6513b (merge of main — v606 shipped mid-chain) · c2ea712 (pin bump + renders driver).

- `opnEnterEdit607` / `opnStartEdit607` + `opn604.editing`; `opnExpanded604` true for every block while editing; expansion head loses the per-block Edit + Block page buttons (Play All stands); `opnEditPostureHtml604` materializes its own block; drag wiring reads the row's block; `opnWrite604`'s today branch writes all materialized lists.
- Shape strip: `opnShapeHtml607` / `opnInitShape607` / `opnToggleShape607` / `opnWriteShape607`. Two write bugs found by the harness C legs and fixed in-chain: (a) the today-layer checker takes boolean `on` (the storage form is 1/0); (b) the contents validators refuse an entry for a block that does not stand — every write path now drops contents entries for blocks outside the effective core (Novenas excepted).
- Tap: [data-card] handler plays; "Details" appended in `wireRowActs` (home surface, episode rows).
- Doors: ladder loses both door cards + wiring; `opnProfileMenu607` in the edit bar overflow carries Reset to Default / Delete profile, two-tap armed as the retired door armed them, on the standing routes, acting on the profile in force.
- Gates: harness-v607 25 ok / 0 not ok (incl. fail-on-old OA1–OA3, tap-plays B1/B4, Details→card B5/B6, shape writes C1–C3, doors D1, Reset re-home D3–D5) on the branch and on the merged tree; harness-v606 17/0 on the merged tree; harness-v603 49/1 (T11 pin check vs a main that moved mid-chain; resolved at the pin bump); harness-v604 stops at its first per-block-Edit driver leg — superseded by design (limb 1), and its 7 fail-on-old legs are stale-anchored on the moved main — both named in the build log, not silently skipped. v600/v599 suites not run: their surfaces retire by name with the Edit today door.
- Renders: `app/renders-v607.mjs` → `projects/ora-pro-nobis/v607-review-renders/` 01–04.

## §4 Review

Light Review (build log, Review section): R1 the one question's wording/targets unchanged · R2 stores untouched (standing routes + validators only) · R3 fold option + memory untouched · R4 retired screens unreachable (live-DOM proof, harness D1) · R5 the mid-chain v606 merge verified whole-tree (marker grep + both harnesses green). Verdict: SHIP. Review contract 868 met.

## §5 Ship (2026-11-21, fix coordinator, contract 869 — run level TO SHIP)

- Merge: release/v607 fast-forwarded to main at c2ea7124be1dacbb21513467980042862775703d (branch contained main 9e5d220 after the mid-chain merge).
- GitHub: Git Data API replication, byte-identical — main pushed · remote in sync (remote main == c2ea712).
- Committed-tree verification: harness-v607 forward legs 23/23 on the exact merged HEAD in the standing clone (the 2 fail-on-old legs read "old" as git-show-main and are post-merge artifacts; their pre-merge evidence stands at 25/0 twice against the true old build).
- Deploy: Worker **3625ed7d-88ca-417d-b9ac-20411cade557** at 2026-11-22T04:23:50Z from the standing clone at EXPECTED_HEAD c2ea712 (rollback: 25ec1df9, the v606 deployment).
- Served proofs: sw.js carries pin **ora-pro-nobis-v607-1** · served app.js (1,242,344 B) parses whole · v607 markers stand (data-p607edit · opnStartEdit607 · opnShapeHtml607 · data-p607ladderword); the single `data-p604edit` string in the served file is a comment.
- Board closeout: What's New **422** · row **1581 Live** (shipped_at 2026-11-22T04:25:02Z) · shipped_records **796** · phase records 2450–2457 all passed · contracts 863/864/868/869 met · intake **1128 Done**.
- Web deploy only — no new APK (the installed shell loads the served app).

Field legs (John's, open):
- Praylist → tap **Edit** at the top: the one question stands once, then the WHOLE page stands in edit form — every block open with drag handles, remove, Add, and the Blocks & layers switches at the top.
- In the form: flip a block switch off and on — the change writes at once under the scope you picked; **Done** at the top leaves the form.
- Outside the form: tap any prayer or episode row — it plays. The title card stands behind the row's ⋮ menu → **Details**.
- Configure plan → Configure: both doors are gone; Reset to Default / Delete profile stand in the edit form's ⋮ menu.
