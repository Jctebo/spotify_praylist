# v606 — Biometric enrolment fix (fingerprint prompt never built on API 30+)

## §1 Scope

- Field defect (John, Ora thread, 2026-11-21 21:47 CT): "Also, touch id
  doesn't work." Evidence (his screenshot, 21:53 CT): Settings →
  CONFESSION PIN, session unlocked — the button "Use fingerprint / face
  unlock" stands AND the line "Biometric enrolment did not complete.
  Your PIN stands." Enrolment was offered and tapped; the native enrol
  call failed; the client discarded the error code.
- Diagnosis (Scope phase, contract 859): the bridge stands in the shipped
  APK 1.0.51 (DEX-verified), the handshake shape is correct, the native
  leg never ran on a real device, and every native error is swallowed by
  the client. Full diagnosis: v606-touch-id-diagnosis.md.
- Run level: To Ship under the fix-forward discipline (John reported the
  defect and supplied the evidence). Streamlined small-release path:
  Scope+Plan in one pass · Implement · light Review · Ship.
- No data change: the PIN, the vault, and the enrolment blob discipline
  stand; a failed enrol leaves the PIN standing.

## §2 Plan

- The failing step, identified from source: `vaultBioPrompt()` in
  `OraDayBridgePlugin.kt` (Android main blob 590eed78, the code inside
  APK 1.0.51) —
  ```kotlin
  if (Build.VERSION.SDK_INT >= 30) {
      infoBuilder.setAllowedAuthenticators(BIOMETRIC_STRONG)
  } else {
      infoBuilder.setNegativeButtonText("Use PIN")
  }
  ```
  AndroidX `androidx.biometric:biometric:1.1.0` —
  `PromptInfo.Builder.build()` throws `IllegalArgumentException`
  ("Negative text must be set and non-empty.") when the negative button
  text is empty AND device credential is not among the allowed
  authenticators. With BIOMETRIC_STRONG only, device credential is never
  allowed, so the negative text is required on API 30+ exactly as below
  it: **the API split is backwards**. On John's Galaxy SM-F971U1
  (API 35/36) `build()` throws deterministically, before any prompt can
  appear; the throw is caught in `vaultBioPrompt` →
  reject("biometric-unavailable") → the client catch discards it → the
  generic line in the screenshot. Enrol and unlock share
  `vaultBioPrompt`, so both paths were dead on every API 30+ device.
- Steps traced and cleared: the status gate (canAuthenticate
  BIOMETRIC_STRONG == SUCCESS — the button rendered in the field) · key
  generation (AES/GCM/NoPadding, user-auth-required per-use,
  invalidated-by-enrolment by design, no StrongBox — the
  documented-standard set) · cipher init (does not consume the auth) ·
  the activity (MainActivity → Capacitor BridgeActivity →
  FragmentActivity; the prompt constructor is satisfied) ·
  confirmation-required (default true, fine).
- Fix shape: (native) negative button text on all API levels + reject
  messages carrying the native detail · (client) the named native error
  surfaced on both paths, clear-on-key-invalidated, a Settings re-enrol
  offer · APK 1.0.52 + the Worker client, one release.

## §3 Implement

- Native (Android repo main 06d1ffed → 8e3204cd, Git Data API,
  fast-forward, read back):
  - `vaultBioPrompt`: `.setNegativeButtonText("Use PIN")` stands in the
    builder chain for every API level (with the v606 comment naming the
    rule); `setAllowedAuthenticators(BIOMETRIC_STRONG)` kept on API 30+.
  - Reject detail appended after the stable code token
    (`: <ExClass>: <message>`): `biometric-unavailable` ·
    `vault-op-failed` (the key-invalidated branch untouched) ·
    `enroll-failed` · `unlock-failed`.
  - versionCode 52 · versionName "1.0.52".
  - Actions run 44983152628 (Build signed APK): success — unit tests +
    signed release. APK verified from the built file: versionName
    1.0.52 / versionCode 52 · SHA-256
    2830d2644ba60a31f62e7c30f336574e8de5411ee14b1906192c056267a5744e
    (matches the build's own SHA256.txt) · signer cert identical to
    1.0.51 (CN=Ora Pro Nobis Test, O=Thibeaux, C=US; cert SHA-256
    13cfc44f3e34a2f048a51b40db1b5a69e975f8e9737a8b876edb10d4a5851dc0).
    Record copy: ~/workspace/projects/ora-pro-nobis/ora-pro-nobis-1.0.52.apk.
- Client (release/v606, commit 6b258ef; SW pin 6b913fe):
  - `opnBioErr(e)` — the native error text out of a bridge rejection ·
    `opnBiometricClear()` — bridge clear + local flag clear.
  - Enrol failure (Settings card): the note reads "Biometric enrolment
    did not complete (<code>). Your PIN stands." + a console line.
  - Unlock failure (unlock card): the message names the code + a console
    line; on `key-invalidated` the client clears the enrolment through
    the bridge, hides the fingerprint button, and the message directs
    him to enrol again in Settings.
  - Settings, when enrolled: a "Re-enrol fingerprint / face unlock"
    button stands beside the "is on" note (native enrol deletes +
    regenerates the key and overwrites the blob).
- Harness (harness-v606.mjs, jsdom over a stubbed bridge): 17 ok /
  0 not-ok on the new client; on the unmodified client 9 ok / 8 not-ok —
  the error-surfacing legs (L1, L2), the key-invalidated leg (L3), and
  the re-enrol-offer leg (L4) fail on the old build as required; the
  success regressions (L5, L6) pass on both.

## §4 Review

- Light review, firsthand: the client diff read whole (49 lines, the
  specified change only; `opnVaultDissolve` untouched) · harness-v606
  re-run on the committed tree: 17 ok / 0 not-ok · the native hunk read
  back from Android main at the built SHA 8e3204cd (negative text in the
  chain, STRONG kept on API 30+, four reject-detail sites).
- Verdict: PASS. The native leg has no device proof in this environment
  — not claimed; the field leg stands below.

## §5 Ship (2026-11-21, fix coordinator, contract 866 — run level TO SHIP)

- Merge: release/v606 merged to main as 0affae9 (--no-ff) over
  6736a73; APK publish commit 3d67c15 (config/site/ora-pro-nobis.apk =
  the verified 1.0.52 binary). Harness on the merged tree: 17 ok /
  0 not-ok. Tracked tree clean.
- Push: 4 commits replicated byte-identical via the GitHub Git Data API
  with SHA assertions — main pushed · remote in sync at
  3d67c1597b748f874576c4166b3f98be3b7f1f01.
- Deploy (connector-surrogate driver, from the standing clone at
  3d67c15): Worker 25ec1df9-b8a4-437a-a49e-3638afeddb24 at 100% ·
  rollback target 8b3316b6.
- APK delivery: Pages deploy run 44983839321 (deploy_pages, head
  3d67c15) success; the served https://orapronobis.media/ora-pro-nobis.apk
  fetched back with SHA-256
  2830d2644ba60a31f62e7c30f336574e8de5411ee14b1906192c056267a5744e —
  byte-identical to the verified build.
- Served proofs (https://app.orapronobis.media): served sw.js pin reads
  `ora-pro-nobis-v606-1` · served app.js parses whole (1,231,032 chars,
  node --check OK) and carries `pin-bio-reenrol`, the enrol/unlock
  console lines, and the `key-invalidated` handling.
- Board closeout: What's New 421 · row 1580 Live · shipped_records
  795 inserted and read back · Ship phase record 2454 passed · intake
  1127 Done.
- FIELD LEG (John's, open): install APK 1.0.52, then Settings →
  CONFESSION PIN → "Use fingerprint / face unlock" — it either enrols
  (the fingerprint prompt appears and completes), or the screen now
  names the exact native error for the targeted follow-up. The defect
  is claimed as: the failing step repaired as identified + the error
  now visible — not as field-proven.
