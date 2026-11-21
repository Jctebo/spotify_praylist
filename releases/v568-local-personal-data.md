# v568 — Local personal data — intentions, Conscience, profiles, config live on-device in the public build

Registry row 1522 · Line: Ora Pro Nobis · Set: member 1 of 5 of the v567 public-build redesign (parent row 1521; Plan record 2263 PASSED) · Approval: John, Ora thread, 2026-11-20 22:48 CT (package 63, Q1–Q6 A) and 23:01 CT — the full set approved TO SHIP. Seat: track1-v568-r2 (fresh seat, clean house 2026-11-21 01:55 CT; adopted phase record 2276 + contract 689).

## 1 · Scope

- The public build's personal-data classes — intentions, Conscience (examinations, confessions, PIN state), prayer profiles and day picks, config (player source settings, block order, Mass prayer seats, per-date Universal Prayer intentions, prayer addenda), prayer requests, favorites and starred tracks — move from per-user server records to an on-device personal-data file held in platform-backed-up app storage (Android Auto Backup / iCloud include it by default; the build sets NO exclusion flags on that file and verifies backup inclusion on both platforms).
- Homily audio stays OUTSIDE the Android cloud backup set (John, settled 2026-11-20 21:53 CT) so recordings never crowd the small data out of the 25 MB cap.
- The Conscience PIN stays on-device, on the Conscience tab only.
- Every account assumption comes out of the public build: no sign-in UI, no gated tier, no per-user server records.
- Web behavior: the web build carries the free tier only — a personal-data surface on web (an intention screen, the Conscience screen) points the person to the native app; it never dead-ends and never asks for an account.
- John's private app untouched.

## 2 · Plan

Per the v567 Plan (record 2263), §4 build notes for v568:

- One personal-data file (JSON) in app-private storage, written only through a single local data layer; no network path carries personal data, and the public build calls no per-user server endpoint. The file IS the on-device data file that v570's export/import carries.
- Mode shape: John's private serving (Access session) keeps the standing server records untouched. The public shape splits by client: the native shell (bridge present) reads/writes the local file through the data layer; the web build renders the app-pointer card on personal surfaces — never browser storage for personal data, never a dead end.
- Android: the file lives in the Auto Backup set (fullBackupContent includes it; dataExtractionRules cloud-backup excludes ONLY the homily-audio directory — device-transfer still carries the audio). iOS: Application Support, isExcludedFromBackup = false. Review verifies the rule files themselves in the Android repo, not the intention.
- Expected size: kilobytes to low megabytes — far under the 25 MB Android cloud cap, kept reserved for this file by the homily-audio exclusion.
- Classes carried: intentions · Conscience (exam runs, exam entries, confessions) · profiles + standing pick + day picks · config (player source settings, block order, Mass prayer seats, per-date Universal Prayer intentions, prayer addenda) · prayer requests · favorites + starred tracks. PIN material stays on-device and never enters any export path (v570 rule, honored here: the local layer keeps PIN state outside the carried sections).
- Harness (fixtures from production, Improvement D): class shapes drawn from the standing server records' real payloads (the v570 Plan-verified counts are the census baseline: intentions 19 · exam runs 13 · entries 2 · confessions 0 · profiles 3 · settings 26 · addenda 17 · favorites 3 · Universal Prayer dates 2). Harness proves: every class round-trips through the local layer; public mode issues NO per-user server call (route census over the client); web-public personal surfaces render the pointer card; private mode behavior unchanged (standing harness estate green).
- Review: backup rule files read in the Android repo; personal-surface census (the v534 pattern) so no web surface is missed; served-leg proof on the public shape before Ship.
## 3 · Implement

- Client data layer spliced into client.ts on release/v568: on-device personal-data file (`opn-personal-data-v1`, envelope format `orapronobis-personal-data`, formatVersion 1 — the v570 envelope) covering intentions, Conscience (exam runs/entries, confessions), profiles (seed defaults + fold + picks), config (26 source-setting seed rows, block order, Mass seats, Universal Prayer, addenda), favorites/starred, per-track draws from the local pool, and local playback state. Seeds drawn from production migrations (Improvement D): 26 source-setting rows, 3 profile defaults, 23 exam prompts, 5 confession guide steps — census counts match the Plan exactly.
- PIN lives in a separate on-device store (PBKDF2 100k, recovery code, server-mirrored backoff) and never enters the carried file. Web mode: reads answer empty-but-valid locally, writes refused with the app pointer, nothing stored; Conscience / Intentions / Settings / Favorites surfaces carry the app-pointer card. Private shape: the layer never runs — John's app behaves exactly as before (harness W5).
- Reconciliation with Track 2 (material, disclosed): Track 2 shipped v569 and v564 while this build ran. v564's shipped public gate already governs the Worker leg (personal reads → empty shapes; public writes → 403 `personal data lives on your device in the app`, gate at index.ts shape check before the session gate). The blanket 403 planned here duplicated it and collided on `PUBLIC_HOST`; reconciled at merge — v564's gate governs, v568 stamps the serving shape into the shell from the same `pub` signal.
- Harness: harness-v568 **64 ok / 0 not-ok** on a clean checkout of the composed, committed tree (statics + 5 vm worlds over the real layer + wrangler served legs for both shapes).
- Expectation 1 on contract 689 landed ~6 minutes late (harness green ~03:21 CT against a 03:15 CT due time; two runs lost to port collisions with the seat's own orphaned dev servers) — judged **missed** on the clock with the note standing on the contract.

## 4 · Review

- Reviewed by successor seat track1-v568-r3 (Review record 2288) against the deployed tree (GitHub main 260c4473, pin ora-pro-nobis-v568-1, Worker b76f38a8-dfb8-4685-b9d7-de28151420c4).
- Gate code read first-hand: `shapeOf` returns public only for host app.orapronobis.media; the public shape refuses every personal route (prefix + exact sets) with 403 before the session gate and before any D1 touch — the write-refusal behavior is structural, not handler-level.
- Served-leg read proofs (production, public host, from the Implement seat and standing): shell carries `window.__OPN_SHAPE__="public"` · personal read answers the empty shape `{"ok":true,"intentions":[]}`.
- FINDING 1 (carried to Ship, open): the write-refusal served proof — a POST to a personal route on app.orapronobis.media expecting the 403 — is NOT yet verified. The outgoing seat's batch carrying it died on an approval-card timeout (curl 000, never landed); the successor seat's single small POST call hit the same approval card, which timed out unanswered (John asleep; his 01:59 CT ruling clears scope approvals, not tool-approval cards). The write did not land in either attempt — the gate fires before any D1 write by construction, and no intention row was created. This leg must run and pass before the row flips Live.
- FINDING 2 (Android backup, requirement out): the v568 store is WebView localStorage (`opn-personal-data-v1`). The Android shell at the 1.0.49 base (repo main 43634b34) stands `allowBackup="true"` with NO `fullBackupContent` and NO `dataExtractionRules` and no rules XML — the platform default Auto Backup set (files/, shared_prefs/, databases/) does NOT cover the WebView `app_webview` store, so backup inclusion for the personal-data file is NOT verified on Android. Requirement passed to the main seat for Track 2's APK 1.0.49 build (the last build of the night): add backup rules covering the WebView storage for the personal-data store AND keep homily audio OUTSIDE the cloud backup set (John, settled 2026-11-20 21:53 CT). iCloud leg: no exclusion flags set by the build (verified in code); platform-default inclusion stands as designed.
- Review verdict: Implement's code is correct and deployed; the two findings are named, owned, and carried into Ship — neither is hidden in this pass.

## 5 · Ship

- Merged to main and pushed via the Git Data API — **main pushed · remote in sync** at the v568 head 260c4473131992dc44e7fed113d0aff13f7dc6d9 (byte-identical). Current main has since advanced with Track 2's v571 merge (b295270); the v568 commit stands in its history.
- Deployed: Worker **b76f38a8-dfb8-4685-b9d7-de28151420c4** live from the v568 head; SW pin ora-pro-nobis-v568-1.
- OUTSTANDING at this writing (named, not silent): (1) the write-refusal served proof (Finding 1) — blocked on a tool-approval card for the single POST call; (2) What's New entry; (3) row 1522 Live flip with read-back; (4) Ship phase record pass. These close in order the moment the proof leg runs green; the code in production is already the shipped build, and the private shape is untouched throughout.
