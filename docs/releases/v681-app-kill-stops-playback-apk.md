# v681 — Killing the app stops playback (APK 1.0.57)

## §1 Scope (as registered)

- **Board:** DevOps Board row **1659** · slug `app-kill-stops-playback-apk` · run level **To Ship** · holder chain-v681. Streamlined Scope+Plan pass (this doc's §§1–2 are the Scope+Plan record).
- **John's direction (2026-11-25 22:13 CT, verbatim):** "I also want if the app is killed. The playback stops".
- **Behavior required:** the app task is removed (Recents swipe / task kill) → playback stops, the media notification clears, the media service stops. No orphan audio, no zombie notification.
- **Surface:** Android shell ONLY (repo `Jctebo/ora-pro-nobis-android`). NO web client change, NO Worker deploy, NO new pin. Deliverable APK: **1.0.57**, signer unchanged (CN=Ora Pro Nobis Test — the phone updates in place).
- **No-regress list (hard boundaries):**
  1. A kill must NOT produce a completion record — the completion drain (v661) is untouched; the shell's mark rule stays natural-end only.
  2. The v680 position record stands as last periodically saved — a kill writes NOTHING (no position write-back on the kill path, including indirect ones; see §2.4).
  3. The v651 offline store is untouched.
  4. Normal pause / stop / background behavior is unchanged — background playback while the task STANDS is a feature; only task REMOVAL stops it.
- **Relation to prior releases, named plainly:** this release REVERSES the v467 swipe-away fix ("task removal never stops a playing native contract", build.gradle comment at 1.0.39) as carried into the current shell form by v469 Step 4 / v472 Step 4. That behavior was deliberate then; John's 2026-11-25 direction supersedes it. v680 §2.6 named a shell-side periodic position write-back as a follow-up needing an APK — this release does NOT take that leg; v680's client-side 5 s writes are exactly what "the position record stands as last periodically saved" rests on.
- **Field leg is John's** (text in §2.7). The chain never claims it.

## §2 Plan (grounded from the shell code, 2026-11-25)

Grounding base: the local shell checkout at `~/workspace/android-apk` (see the drift note in §2.6 — its tree predates v661; every seat cited below is in code v661 did not touch, and Implement re-verifies each citation against the refreshed 1.0.56 base before editing). All citations are `android/app/src/main/java/com/thibeaux/orapronobis/auto/OraLibraryService.kt` unless named otherwise.

### 2.1 Which service holds playback, and how

- **The service is `OraLibraryService`** (OraLibraryService.kt:66) — a Media3 `MediaLibraryService`, declared in `android/app/src/main/AndroidManifest.xml` as `.auto.OraLibraryService`, `exported=true`, `foregroundServiceType="mediaPlayback"`, with the `androidx.media3.session.MediaSession` / `MediaLibraryService` intent filters.
- **Playback is driven by the service's own ExoPlayer** (Media3 1.11.1, pinned in `android/app/build.gradle`): built in `onCreate` (OraLibraryService.kt:294, `ExoPlayer.Builder(this)` with the app's media-source factory, built-in audio-focus / becoming-noisy handling, `WAKE_MODE_LOCAL`), and the session is built ON that player — `MediaLibrarySession.Builder(this, exo, SessionCallback())` (line 341). There is no second engine: the WebView page is a remote; the element never plays on the phone (v466 Fork B, standing).
- **The media notification has two cooperating posters at ONE notification id:**
  1. Media3's notification manager over `DefaultMediaNotificationProvider` (line 354, `setMediaNotificationProvider(...)`, bound to the app's `NOTIFICATION_ID` / `CHANNEL_ID`) — it posts, updates, and cancels the session notification with the service's foreground state.
  2. The promotion bridge: `promote()` (line ~1387) posts synchronously via `ServiceCompat.startForeground(..., FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)` on a phone start (from `onStartCommand`, line 488); its removal seat is `stopPromotion()` (line 1394) — `ServiceCompat.stopForeground(this, STOP_FOREGROUND_REMOVE)`, already called from `onDestroy` (line 594).

### 2.2 What happens TODAY on task removal — playback SURVIVES, by design

- **`Service.onTaskRemoved` IS already overridden** — OraLibraryService.kt:541. Its current form (v472 Step 4, per its own comment block at lines 542–556):
  1. It runs the standing stop evaluation: `stopSelf()` only if `FaceServicePolicy.decideStop(contractStanding(), playerHoldsItems(), carBound)` returns STOP (`auto/FaceServicePolicy.kt` — STOP exactly when NO queue contract stands, the player holds NO items, and NO car client is bound).
  2. It then calls `super.onTaskRemoved(rootIntent)` UNCONDITIONALLY — the Media3 library default, whose rule is pause-all-players-and-stop-self UNLESS playback is ongoing.
- **Net effect today:** with a contract standing and the player loaded (any real playback, playing or paused), `decideStop` returns NO_STOP, and the library default spares an ongoing player — **the engine plays on after a Recents swipe, notification standing.** That is v467's fix working as built, re-derived at v472. A swipe stops the service today only when nothing stands at all.
- **Activity / WebView teardown plays no part:** `MainActivity.java` has no `onDestroy` override affecting playback (its WebView work is insets / freshness only); the page is a remote, so task teardown of the Activity does not touch the service's player. Audio survives task removal because the FOREGROUND SERVICE survives it — the service is started, not bound to the task, and both stop gates above spare it while playback stands.

### 2.3 The exact stop seat — `onTaskRemoved`, rewritten to stop unconditionally

The seat is the existing override at OraLibraryService.kt:541 — it is the one callback the platform delivers exactly on task removal (Recents swipe / task kill) while the service still lives to act. No other seat fits: `onDestroy` is a consequence, not a trigger (and today it is never reached on a swipe), and no Activity callback reaches the service's player.

**Implement rewrites the body to the standing "stop" arm's own chain** — the page-bridge `stop` transport arm (OraLibraryService.kt:~1207–1224) already composes exactly the required end state, and the kill path mirrors it, in this order:

1. `publishNativeStopped()` (line 1297) — the stopped publish to the page mirror, if the page still stands to hear it.
2. `queueStore.clear()` + `faceStore.clear()` — the persisted contract / face records go, exactly as the bridge-stop arm and `onEngineEnded` (line 771ff) clear them, so no cold read resurrects a killed queue as a standing contract.
3. `stopEngineQueue()` (line ~675) — `exo.stop()` + `nativeContractStanding = null` + `stopAtTrackEnd = false`. Playback stops; the engine goes IDLE (never ENDED — see §2.4).
4. `stopPromotion()` (line 1394) — the promotion bridge's foreground notification is removed immediately (`STOP_FOREGROUND_REMOVE`); Media3's manager cancels its session notification as the service stops (its standing behavior — the manager owns cancellation with the foreground state, §2.1).
5. `stopSelf()` — the service stops; `onDestroy` (line 567) then runs its standing teardown: watchdog / sleep callbacks removed, `stopPromotion()` again (idempotent — it early-returns when not promoted), session + player released (`exo.release()`, line ~605).
6. `super.onTaskRemoved(rootIntent)` LAST, unconditional, as today — with the player stopped and idle, the library default's own stop-self is consistent and harmless.

**What the rewrite removes:** the `decideStop` evaluation AT THIS SEAT ONLY. `decideStop` itself, `FaceServicePolicy`, and the evaluation's other seats (the watchdog, `evaluateStop()` at line ~1230, `onEngineEnded`) are NOT touched — idle/background stopping behavior elsewhere stands byte-identical. The car-bound spare also leaves this seat: a bound Android Auto client no longer keeps a task-removed service alive (named decision: John's rule is task removal stops playback; the car session's own task is not the phone task, and a car-bound service with the phone task standing is unaffected).

### 2.4 Interaction proofs — why the kill path writes nothing it must not

1. **No completion record (v661 drain untouched).** `markItemPlayed(contract, item)` (line 833) has exactly two callers: `onEngineTransition` (line 731) on a NATURAL auto-advance only (`reasonAuto`), and `onEngineEnded` (line 756) from `Player.STATE_ENDED`. The kill chain calls `exo.stop()`, which drives the player to STATE_IDLE — no transition event, no ENDED — so neither caller can fire. `NativeCompletionsStore` is never added to; the podcast mark route (`NativeWriteback.postPodcastMark`) is never called. The drain, the store's shape, and the client fold are not touched (no client change at all).
2. **No position write (v680 record stands as last saved).** Two indirect write seats stand on the stop path and the chain's ORDER disarms both — Implement must preserve this order and Review must check it:
   - `onDestroy`'s v479 flush (lines ~578–590): on teardown it posts the standing podcast item's live position — but it reads `nativeContractStanding`, and step 3 (`stopEngineQueue`) has already nulled it, so the flush reads null and writes nothing.
   - The pause write-back: `onEnginePlayWhenReady` (line ~784) writes the current item's position on any playWhenReady → false flip. `exo.stop()` does not change `playWhenReady` (stop ≠ pause), so this arm does not fire from the kill chain; Implement must NOT substitute `exo.playWhenReady = false` / `exo.pause()` for `exo.stop()` anywhere in the chain — that substitution would fire the pause write-back and break this boundary. If Implement's build evidence shows any position post on the kill path, the repair is a guard flag at that arm, named here in advance, not a different stop call.
   - `writebackPosition` (line ~866) is otherwise called only from transitions / skip / pause arms — none reached.
   Net: the last position standing after a kill is the v680 client-side periodic write (≤ ~5 s stale), exactly the registered boundary.
3. **Offline store untouched (v651).** `OfflineAudioStore` is used at `onCreate` eviction (line 287) and at media-item resolution (lines 1023 / 1038 / 1590). The kill chain calls none of these; no file in the offline store is read, written, or evicted by it.
4. **Normal behavior unchanged.** Pause (notification transport / page remote), the bridge `stop` arm, background playback with the task standing, the sleep deadline, the watchdog, and Android Auto browsing all run through seats this release does not touch. The ONLY behavior change is the `onTaskRemoved` body's outcome when a contract / playback stands.

### 2.5 Android version / API considerations

- **SDK range (from `android/variables.gradle`):** minSdk **23**, targetSdk **35**, compileSdk **36**. `Service.onTaskRemoved` exists across the whole range; the Media3 1.11.1 library default it defers to is version-pinned, so no per-API branch is needed or added.
- **Force-stop is NOT task removal — named limitation:** Android's force-stop (Settings → Apps → Force stop, or an OEM task-killer that force-stops) kills the process with NO callback — no app code can intercept it, and none is claimed. Playback still ends there (the process is gone), which satisfies John's rule in effect; the notification is removed by the system. The callback path this release builds covers the Recents swipe / task removal John described.
- **Samsung / Galaxy (John's phone class):** One UI's Recents swipe (and "Close all") removes the task and delivers `onTaskRemoved` normally — the seat fires. Two Galaxy notes: (a) One UI battery "optimization" / Device care auto-restrict can force-stop background apps — that is the no-callback case above, outcome-equivalent; (b) swiping away the media NOTIFICATION (not the task) does not remove the task and must not stop playback — it does not reach this seat, unchanged.
- **API 34/35 foreground-service rules** govern STARTING a media-playback FGS, not stopping one; the kill path starts nothing.

### 2.6 Base drift note — Implement's first act (surprise, named at Plan)

The local checkout at `~/workspace/android-apk` is STALE: its `android/app/build.gradle` reads versionCode **49** / versionName **"1.0.49"**, and its `markItemPlayed` still writes the pre-v661 3-field completion record — it predates the v661 shell leg. The shipped shell of record is **1.0.56**, android-repo main at **89fbb78f** (v661 §8: remote main fast-forwarded to the v661 branch commit, tree read back). Every seat cited in §§2.1–2.4 stands in code the v661 android diff did not touch (v661 §7(f): the android diff was exactly FaceStateStore.kt, OraLibraryService's `markItemPlayed` signature, OraDayBridgePlugin's emit lines, build.gradle, and one test), so the grounding holds — but Implement does NOT edit the stale checkout. Implement's first act, per the v661 precedent: refresh the android base from remote main 89fbb78f (Git Data API / tarball route, as v661 Implement did), verify versionCode **56** / versionName **"1.0.56"** in the refreshed tree and re-verify the §2 citations against it, and only then branch `release/v681`.

### 2.7 Build + verify route (Implement / Ship)

- **Version bump (one file, `android/app/build.gradle`):** versionCode **56 → 57**, versionName **"1.0.56" → "1.0.57"** — the repo's standing discipline (previous shipped code + 1; versionName = 1.0.\<versionCode\>), applied to the REFRESHED base (§2.6), not the stale local values.
- **Build route: the standing CI route is PRIMARY** (the v661 precedent, §6/§8 of docs/releases/v661.md): branch `release/v681` pushed to `Jctebo/ora-pro-nobis-android` via the Git Data API → workflow **"Build signed APK (v359)"** (`.github/workflows/build-apk.yml`, workflow_dispatch on the branch) → the run executes `:app:testReleaseUnitTest` + `:app:assembleRelease` + `:app:bundleRelease` with the repo-secret keystore → artifact downloaded and re-verified LOCALLY: aapt badging reads package `com.thibeaux.orapronobis`, versionCode 57 / versionName 1.0.57, and apksigner cert SHA-256 equals the standing signer (1.0.56's cert: `13cfc44f3e34a2f048a51b40db1b5a69e975f8e9737a8b876edb10d4a5851dc0`). The local route (`tools/build-apk.sh`) is the FALLBACK only: at v661 it failed three times at Gradle dependency resolution (this VM's egress proxy resets Gradle's HTTP client) while the CI route succeeded — the plan does not spend the chain's time re-proving that.
- **Unit verification (the harness allows a real one):** the repo's JVM test source set (`android/app/src/test/java/com/thibeaux/orapronobis/auto/`) runs under `:app:testReleaseUnitTest` in the CI build. The shell's standing pattern is pure decisions in `FaceServicePolicy` pinned by unit legs (the Android calls happen only at the edges). Implement therefore:
  1. Adds ONE pure decision to `FaceServicePolicy` for this seat — task removal stops the service, unconditionally (STOP for every input combination: contract standing / player holds items / car bound, playing or paused) — and a new test file in the mold of `FaceServicePolicyTaskRemovedTest.kt` pinning all combinations, including the two that reverse today (playing + contract standing → STOP; car bound → STOP at this seat).
  2. Updates `FaceServicePolicyTaskRemovedTest.kt`'s header record to name the v681 reversal at the `onTaskRemoved` seat (its TR6 leg pins `decideStop` itself, which does NOT change, and must stay green unmodified in substance).
  3. Keeps the service-side body a thin edge over the decision + the §2.3 chain, so the unit legs pin every decision the edge acts on — the repo's own stated discipline (FaceServicePolicy.kt header).
  Fail-on-old: the new legs fail against the pre-v681 policy form (no such decision / the evaluation sparing playback) — Implement records the equivalent demonstration the harness allows (the new test compiled against the old policy shape cannot produce STOP for the playing case).
- **Publish route (Ship), exactly as the v661 chain used it:** the built APK replaces `config/site/ora-pro-nobis.apk` in the web repo's ship tree → web main pushed (tree-exact, Git Data API; read-back "main pushed · remote in sync") → the **Deploy GitHub Pages (deploy-only)** workflow (`.github/workflows/deploy_pages.yml`, manual dispatch on main) stages + uploads the Pages artifact and deploys → verification is a LIVE FETCH of **https://orapronobis.media/ora-pro-nobis.apk** whose SHA-256 equals the CI artifact's hash byte-for-byte. (v661 needed one re-dispatch after a first deploy-step failure post-upload; a single re-dispatch on the same head is the standing remedy, not a new plan.) The android repo's main is fast-forwarded onto the release branch via the Git Data API at Ship, as at v661 §8. NO Worker deploy, NO pin bump — the web repo changes only by the APK swap + this doc's Ship record.
- **Field check (John's, verbatim for the Ship report):** "Play a track in the app, then swipe the app away from Recents — playback stops, the media notification is gone, and reopening the app starts quiet. A partly played episode still resumes where it stopped (v680)." The DEVICE leg is John's field check, never claimed by the chain.

### 2.8 Implement task list

1. Refresh the android base from remote main 89fbb78f; verify 56 / "1.0.56" + the §2 citations on the refreshed tree; branch `release/v681` (android repo).
2. `FaceServicePolicy`: add the task-removal stop decision (unconditional STOP); new unit test file pinning all input combinations; header note in `FaceServicePolicyTaskRemovedTest.kt` naming the v681 reversal (TR6 / `decideStop` legs unchanged).
3. `OraLibraryService.onTaskRemoved`: rewrite the body to the §2.3 chain (stopped publish → stores clear → `stopEngineQueue()` → `stopPromotion()` → `stopSelf()` → unconditional super), gated on the new decision; update the v472 comment block to record the reversal and its reason (John's 2026-11-25 direction). No other service method changes; `exo.stop()` only — no `playWhenReady = false` / `pause()` substitution (§2.4.2).
4. `android/app/build.gradle`: versionCode 57, versionName "1.0.57" (+ the standing one-line version comment in the file's own form).
5. CI build on `release/v681` (workflow "Build signed APK (v359)"): `:app:testReleaseUnitTest` green incl. the new legs; download the artifact; local badging + signer verification (§2.7).
6. Record §3 (Implement) in this doc on `release/v681` (web repo): files changed, test counts, APK hash + badging + signer read-backs, any deviation named. Stop at BRANCH READY for Review.

### 2.9 Verification plan (Review judges)

(a) The kill chain stands as §2.3 orders it, in the committed android diff — and the diff touches ONLY `onTaskRemoved`, the new policy decision + tests, the test header note, and build.gradle's version lines. (b) No completion path is reachable from the chain: diff + call-site read-back (`markItemPlayed` callers unchanged; no ENDED reachable from `exo.stop()`). (c) No position write on the kill path: the onDestroy flush reads the already-nulled contract; no pause-arm trigger stands in the chain (§2.4.2). (d) Offline store: no `OfflineAudioStore` call in the diff. (e) `decideStop` and its other seats (watchdog · `evaluateStop` · `onEngineEnded`) byte-identical. (f) New unit legs green in the CI run; TR6 and the standing `FaceServicePolicy` suites green. (g) APK badging 57 / 1.0.57, signer byte-identical to 1.0.56, hash recorded. (h) Committed-tree verification at Ship; live-fetch hash equality for the published APK (§2.7). Field leg: John's, not claimed.

## §3 Implement record (chain-v681, contract 1145, 2026-11-25)

### Base refresh

- The stale local checkout (1.0.49) was NOT edited. The working base was refreshed from android-repo remote main **89fbb78f4602c522ce2e2dcf8816313f66ec6145** (verified live: `refs/heads/main` = 89fbb78f). The tarball route failed (private repo: the API tarball redirect to codeload answers 404 without the credential), so the tree was reconstructed blob-by-blob via the Git Data API (Trees + Blobs, 199 entries, not truncated) into `~/workspace/.worktrees/v681-android`, committed locally as the base, and branched `release/v681`.
- Refreshed tree SHA **2f2aec7b890d57d351cbcb5f0e29c801d2144c9e** — identical to the v661 §8 read-back tree for 89fbb78f. `android/app/build.gradle` on the refreshed base: versionCode **56** / versionName **"1.0.56"** (lines 87–88).

### Citation re-verification (Plan §2 vs refreshed base)

All seats in `OraLibraryService.kt` unless named otherwise:

- `onTaskRemoved` override: **:541 — exact.**
- Bridge "stop" arm: **:1216** (Plan ~1207–1224) — chain at :1224–1228: `publishNativeStopped()` → `queueStore.clear()` → `faceStore.clear()` → `stopEngineQueue()` → `evaluateStop()`. Content exact.
- `stopEngineQueue()`: **:672** (Plan ~675) — `exo.stop()` + `nativeContractStanding = null` + `stopAtTrackEnd = false`. Exact.
- `publishNativeStopped()`: **:1305** (Plan 1297 — drift +8).
- `stopPromotion()`: **:1402** (Plan 1394 — drift +8).
- `evaluateStop()`: **:1237** (Plan ~1230). Exact in substance.
- `onEngineEnded()`: **:756**; its store clears at :774–775 (Plan cited 771ff for the clear seat).
- `markItemPlayed`: **:834** (Plan 833); exactly two callers — `onEngineTransition` :745 and `onEngineEnded` :770. Exact.
- `decideStop` seats: `evaluateStop` (:1237) and `onEngineEnded` (via `evaluateStop`); the watchdog (:194–208) runs `decideWatchdog`, the sibling guard. All three seats untouched by the diff.
- Version seat: `android/app/build.gradle` :87–88 (above).

No contradiction with the Plan; the drift is line-number only (+8 below the v661 `markItemPlayed` widening).

### The diff (android commit 21c9d071 on remote branch release/v681; local commit 454e343, tree-identical 9efd08a9)

Exactly five files:

- `auto/FaceServicePolicy.kt` — ONE addition: `decideTaskRemoved(contractStanding, playerHoldsItems, carBound)` returning `StopDecision.STOP` unconditionally, with its v681 header comment. `decideStop` and every other decision byte-identical.
- `auto/OraLibraryService.kt` — `onTaskRemoved` body rewritten per §2.3, gated on `decideTaskRemoved`: `publishNativeStopped()` → `queueStore.clear()` + `faceStore.clear()` → `stopEngineQueue()` → `stopPromotion()` → `stopSelf()`, then the unconditional `super.onTaskRemoved(rootIntent)` last. The v472 comment block is replaced by a v681 block recording the reversal and its reason (John's 2026-11-25 direction). `exo.stop()` only — no `pause()` / `playWhenReady = false` substitution anywhere in the chain, and no position post was observed on the kill path, so the §2.4 guard-flag repair was NOT needed. No other service method changed; no `OfflineAudioStore` call in the diff.
- `android/app/build.gradle` — versionCode 56 → **57**, versionName "1.0.56" → **"1.0.57"**, with the standing one-line version comment in the file's own form.
- `auto/FaceServicePolicyTaskRemovedV681Test.kt` — NEW: 8 legs pinning `decideTaskRemoved` = STOP for every combination of (contractStanding × playerHoldsItems × carBound), including the two reversals (playing + contract standing → STOP; car bound → STOP). Fail-on-old: the decision did not exist pre-v681, and the seat's prior evaluation (`decideStop`) returns NO_STOP for exactly those two shapes.
- `auto/FaceServicePolicyTaskRemovedTest.kt` — header note only, naming the v681 reversal at the `onTaskRemoved` seat; TR6 / `decideStop` legs unmodified in substance.

### Build + test (CI route, Plan §2.7 PRIMARY)

- Branch `release/v681` pushed to `Jctebo/ora-pro-nobis-android` via the Git Data API (main untouched): commit **21c9d071a306ff3fa659dbc34df633ab90f1a744**, tree 9efd08a9 — asserted equal to the local branch tree.
- Workflow "Build signed APK (v359)" dispatched on the branch — **run 45754697334, completed success**. Every step green, including "Unit tests + signed release build" (`:app:testReleaseUnitTest` + `:app:assembleRelease` + `:app:bundleRelease` per the workflow file) and the workflow's own "Verify the APK (package, version, signature)" step. The new v681 legs and the standing TR6 / FaceServicePolicy suites run inside that test task — all green (a red test task would have failed the step).
- Artifact `ora-pro-nobis-apk` (id 15087680304) downloaded; its SHA256.txt matches the local hash.

### APK verification (local, standing toolchain)

- Badging (aapt2): package `com.thibeaux.orapronobis`, **versionCode 57 / versionName 1.0.57**.
- APK SHA-256: **57f7d8387f7059788ec5e83a01dbd746875f23fb5e7f545773d66c7b96a6ef2c**.
- Signer (apksigner): cert SHA-256 **13cfc44f3e34a2f048a51b40db1b5a69e975f8e9737a8b876edb10d4a5851dc0** — byte-identical to the standing 1.0.56 APK's cert, re-verified from both files. The phone updates in place.
- Staged copies: `~/workspace/projects/ora-pro-nobis/ora-pro-nobis-1.0.57.apk` and the release worktree root (for Ship).

### Publish verification

- Recorded at publish time below (§3 addendum in the same commit series on release/v681): web main push + Pages deploy + live-fetch hash equality.

### Deviations

- Base-refresh route: Git Data API blob reconstruction instead of the tarball (tarball redirect 404 on the private repo) — same source commit, tree SHA asserted against the v661 §8 read-back. No other deviation from Plan.
- The DEVICE leg is John's field check (§2.7) — not claimed.
