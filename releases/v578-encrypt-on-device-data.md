# v578 — Encrypt the on-device personal data — the PIN becomes the vault key

## 1 · Scope

Source: John's direction, main chat 2026-11-21 09:29 CT (intake 1092): "Can we improve security in both platforms?" → "Alright. Let's add something for that as well." Scope Management Space package 68.

THE MATTER: the v568 layer holds personal data (intentions · Conscience · profiles · settings · favorites) on the device in plain text; the PIN today is a lock screen only — it gates the Conscience tab's door and encrypts nothing. Anyone holding the phone's storage can read the file. This release makes storage hold ciphertext: a key derived from the PIN (WebCrypto AES-GCM) encrypts the file; the recovery code wraps the same key, so a forgotten PIN is not data loss; the PIN becomes the vault key, not only a lock.

APPROVED (John, Ora thread, 2026-11-21 09:37 CT — picks pasted from package 68's prompt; no formal Space record stands for package 68 — the chat approval is the record, the v567 route). RUN LEVEL: TO SHIP.
- Q1 A — An installed PWA IS a device, under the same encryption; its stronger unlock is the passkey path. The v571 web rule changes for installed PWAs only; a plain browser tab still points to the app.
- Q2 B — BOTH STEPS IN ONE RELEASE: (1) PIN-derived AES-GCM encryption of the on-device file + recovery-code wrap, AND (2) hardware-backed keys (Android Keystore / biometric) in the shell AND the WebAuthn passkey path for the PWA form — a single build. John's comment: "I could add touch id? Is that what this is?" — answered yes: biometric unlock is the device's own biometric (Touch ID / Face ID on Apple hardware, fingerprint / face on Android), hardware-backed.
- Q3 A — The PIN is the key; the recovery code covers a forgotten PIN.
- Q4 A — Existing plain-text stores migrate in place on first unlock after the update (read plain once, write encrypted, wipe the plain copy; nothing leaves the device).

HONEST LIMITS (stated to John; they stand): no protection while the app stands open and unlocked · a short PIN can be brute-forced offline against a stolen file (derivation cost is the mitigation; step 2's hardware keys are the stronger answer on Android) · PIN + recovery code both lost = the data is gone, by design — nobody, including the operator, holds a copy or a key.

## 2 · Plan

### 2.1 The vault format (client.ts, the v568 layer)

The personal-data store stands under the standing key `opn-personal-data-v1` and holds ONE of two shapes:
- PLAIN (legacy / no-PIN): the standing v568/v570 document `{format:'orapronobis-personal-data', formatVersion:1, sections, seq}` — unchanged bytes for stores that carry no PIN.
- VAULT ENVELOPE: `{format:'orapronobis-personal-data-encrypted', formatVersion:1, wraps:{…}, iv, ct}` where `ct` is AES-GCM ciphertext of the plain document JSON under a random 256-bit VAULT KEY. The vault key is generated at vault creation and is never stored in the clear. Each wrap slot holds the vault key encrypted under one key-encrypting key (KEK): `{salt, iterations, iv, ct}`.
  - `pin` slot — KEK = PBKDF2-HMAC-SHA-256(PIN, salt, 100 000) via the standing `opnPbkdf2` machinery, imported as an AES-GCM key.
  - `recovery` slot — KEK = PBKDF2(normalized recovery code, salt, 100 000), same construction.
  - `passkey` slot (optional) — `{credId, prfSalt, iv, ct}`; KEK = the WebAuthn PRF output imported raw as an AES-GCM key (§2.4).
- The PIN store (`opn-pin-local-v1`) keeps its standing shape (hash pairs, backoff) and gains only non-secret flags: `vault:true`, `biometricEnrolled:true|false`. No key material ever stands in the PIN store, the data file's plain form, or any export (the v570 rule stands: an export is the person's own readable copy, produced from the unlocked in-memory document only).

### 2.2 Locked / unlocked behavior

- `opnDoc()`: envelope shape + no in-memory document → the layer is LOCKED: it returns the ephemeral default document (the proven web-mode read path — reads answer empty-but-valid) and sets the vault state to locked. `opnSave()` is a no-op while locked, so the ciphertext can never be overwritten by the ephemeral document. Personal-data WRITE routes in the local emulator throw `423 vault_locked` while locked (the PIN and vault routes excepted).
- Unlock = obtain the vault key by any standing path (§2.3, §2.4, §2.5), decrypt the envelope into `opnDocCache`, mark unlocked. `opnSave()` from then on encrypts: it serializes the document, AES-GCM-encrypts under the in-memory vault key with a fresh IV, and writes the envelope (the write is async; saves serialize through a small promise chain so rapid successive saves cannot interleave).
- Personal surfaces (Intentions, Conscience, Favorites, Profiles, the Settings "My data on this phone" card) render an UNLOCK CARD while locked: the standing PIN pad, plus a biometric button when the shell reports an enrolment, plus a passkey button when a passkey wrap slot stands. A successful unlock re-renders the surface. The day and all public content never need the vault.
- Locking again: the standing PIN token expiry (30 min) governs the Conscience gate as today; the vault key is dropped when the page unloads. No new auto-lock surface is built.

### 2.3 PIN paths (existing routes, extended)

- `/api/pin/set`: after the standing PIN record is written, CREATE the vault in the same action — generate the vault key, write the `pin` and `recovery` wraps (the recovery code issued by the set flow wraps in the same pass), encrypt the standing document, replace the store. From that moment storage is ciphertext.
- `/api/pin/verify`: after the hash check passes (standing backoff untouched), derive the PIN KEK and unwrap. Unwrap failure after a hash pass = a corrupt vault: refuse with a named error, never fall back to plain. On success the token issues as today and the document stands decrypted in memory.
- `/api/pin/recover`: after the code check passes, derive the recovery KEK from the normalized code, unwrap, decrypt; then the standing re-set flow runs (new PIN) and re-wraps BOTH slots under the new PIN and the NEW recovery code it issues — the vault key itself never changes.
- `/api/pin/change` (token-gated = unlocked, key in memory): re-wrap the `pin` slot under the new PIN and the `recovery` slot under the new recovery code the change flow issues; vault key unchanged.
- `/api/pin/remove` (token-gated): DISSOLVE the vault — write the document back in plain form, clear the passkey slot, clear any biometric enrolment through the bridge. Named plainly in the Settings copy path it rides: removing the PIN removes the encryption, because the PIN is the key.

### 2.4 Migration of existing plain stores (Q4 A)

- Plain store + PIN record stands: the store stays readable-plain until the FIRST successful PIN verify after the update — that verify is the migration moment: create the vault, encrypt the document in place, wipe the plain copy (the store key is overwritten by the envelope; nothing leaves the device). The recovery wrap needs the recovery CODE, which only its hash survives from the old record — so migration issues a NEW recovery code at that moment (the PIN record's recovery pair is re-issued for the same PIN, exactly as a change does) and the unlock result carries it for one-time display: "Your data is now encrypted — here is your new recovery code."
- Plain store + NO PIN record: standing behavior, untouched (the decided path) — the layer runs plain until the user sets a PIN; the set action creates the vault and encrypts in the same pass (§2.3).
- The pre-restore snapshot (`opn-personal-data-snapshot-v1`) is personal data: while a vault stands, the snapshot is written encrypted under the same vault key (`{vaultSnapshot:true, iv, ct}`), and Undo decrypts it back. With no vault it keeps its standing plain form.

### 2.5 Installed PWA as a device (Q1 A)

- `opnMode()`: public shape → `device` when `oraInShell()` OR `opnInstalledPwa()`; else `web`. `opnInstalledPwa()` = `matchMedia('(display-mode: standalone)').matches || navigator.standalone === true` (the iOS form). A plain browser tab keeps the standing pointer behavior byte-for-byte.
- Everything else follows from the mode: the local emulator answers, the PIN/vault machinery runs, storage is the browser's storage for that installed app. iPhone users gain intentions + Conscience through this leg (no native iOS shell exists or is promised).

### 2.6 Step 2a — shell biometric (Android Keystore), APK 1.0.51

- Android repo `Jctebo/ora-pro-nobis-android`: the standing Capacitor bridge plugin gains a vault group:
  - `vaultBiometricStatus()` → `{available, enrolled}` (BiometricManager check + stored blob presence).
  - `vaultBiometricEnroll({keyB64})` → creates/loads the Keystore AES key `ora_vault_key` (user-authentication required per use, invalidated by biometric enrolment change), encrypts the vault-key bytes, stores `{iv, ct}` in app-private storage, returns `{ok:true}`.
  - `vaultBiometricUnlock()` → BiometricPrompt with a decrypt CryptoObject; on success returns `{keyB64}`; on cancel/failure returns a named error the client surfaces plainly.
  - `vaultBiometricClear()` → deletes the blob and the Keystore key.
- Client: enrolment is offered in Settings (public/device shapes) once a vault stands and the shell reports biometric available, and offered once at the first PIN unlock after a vault exists. The unlock card's biometric button calls the bridge, takes the returned key, decrypts the envelope. The raw key crosses the bridge only inside these two calls; it is never written to web storage.
- Version 1.0.51 / versionCode 51; built through the standing GitHub Actions path; delivered at https://orapronobis.media/ora-pro-nobis.apk with SHA-256 + size in the ship report; the v575 backup rules stand unchanged (the WebView store they cover now holds ciphertext).

### 2.7 Step 2b — WebAuthn passkey unlock (PWA form)

- Enrolment (Settings, device-mode PWA): `navigator.credentials.create` with a PRF extension eval over a stored 32-byte salt; when the result carries a PRF value, import it raw as the passkey KEK and write the `passkey` wrap slot (credential id + salt stored in the envelope, both public). When PRF is absent (platform without PRF), enrolment refuses plainly — "This device's passkey cannot unlock the vault; your PIN stands" — and nothing is written.
- Unlock: `navigator.credentials.get` with the same PRF eval → KEK → unwrap → decrypt. Where the platform offers Face ID / Touch ID / fingerprint for passkeys, that biometric IS the unlock (John's Q2 question) — the web platform carries it; no native iOS shell is built or promised.
- The PIN path always stands beside the passkey path; a lost passkey never locks the person out (PIN + recovery code remain).

### 2.8 Files and surfaces touched

- `app/worker/src/client.ts` — the v568 layer: vault envelope + wrap/unwrap, locked state, PIN-route extensions, migration, snapshot encryption, PWA detection, unlock card, Settings enrolment rows (biometric + passkey).
- `app/worker/src/ui.ts` — SW pin only, at Ship (`ora-pro-nobis-v578-1`).
- Android repo — bridge vault-biometric group + version 1.0.51/51.
- `harness-v578.mjs` — new harness (legs in §2.9). `index.ts` untouched: the server shape gate and the public write-refusal stand as built; the local layer's mode change is client-side.
- No migration. No server change. John's private shape never runs the layer (standing rule) — the vault exists only in the public build's device mode.

### 2.9 Harness legs (harness-v578.mjs — Node vm worlds over the RENDERED client, the v570/v576 pattern)

- S statics: diff confined to the named files; SW pin unmoved before Ship; envelope format + PWA detection + wrap slots stand in the layer; the layer holds no network call; migrations end at 0042.
- C1 ciphertext at rest: device world → set PIN → the stored value at `opn-personal-data-v1` is the envelope; a planted distinctive intention text does NOT appear anywhere in the raw stored string; the PIN store holds no key material.
- C2 unlock round-trip: reload the world over the same store → locked (intentions read empty, a write route refuses 423) → verify PIN → the planted intention reads back.
- C3 wrong PIN: refusal + the standing attempts countdown; the store stays ciphertext and locked.
- C4 recovery restore: recover with the issued code → set a new PIN → reload → unlock with the NEW PIN → data intact; the OLD PIN now fails.
- C5 migration (Q4 A): seed a plain store + a legacy PIN record (standing set flow on the pre-vault code path simulated by a plain doc + PIN record) → boot reads plain → first verify migrates: store becomes the envelope, the plain needle is gone from storage, a NEW recovery code is issued by the unlock result → reload → locked → unlock → data intact.
- C6 no-PIN store: plain store, no PIN → layer round-trips plain (standing behavior) → set PIN → the store is ciphertext in the same action.
- C7 export after unlock: `opnExportText()` returns the readable v570 envelope JSON with correct counts; the export text contains no PIN hash, no wrap material, no vault key.
- C8 PWA worlds: public shape, not shell — standalone=true → mode `device` (personal writes persist; with a PIN they persist encrypted); standalone=false → mode `web` (nothing is ever written to storage — the standing W4 discipline).
- C9 passkey wrap: a world with a stubbed `navigator.credentials` carrying a fixed PRF output → enrol writes the passkey slot → reload → passkey unlock restores the data; a PRF-absent stub → enrolment refused, PIN path intact. The shell biometric leg is stubbed at the bridge seam the same way (in-memory wrap) to prove the client leg; the native leg is proven by the APK build + code read and named as such in §3.
- Served legs (Ship): wrangler dev --remote on the public shape — the served app.js parses whole (vm.Script) on both shapes; the shell marker stands; a personal route answers the standing refusal on the server leg.

### 2.10 Sequencing

Three To Ship chains share one client.ts. v576 stands in Ship on main 5a99028 (its grouped-Favorites layer shape is the base this plan builds on — favorites ride inside the same document the vault encrypts; no shape change to the document itself). v577 stands in Implement. This chain builds on a fresh clone of main, rebases onto whatever main stands at merge, never force-pushes, and re-reads both rows' phase records before merging and before deploying; if another chain deploys mid-flight, the tree is re-verified against the new main before this chain's deploy.

## 3 · Implement

### 3.1 Landing

- Sequencing as planned (§2.10): both sibling chains shipped Live while this chain built — v576 (row 1544) and v577 (row 1545). The client work was built on v576's shipped tree (5a99028) and rebased onto v577's head **a16bd7e**; the merged tree carries v576's grouped-Favorites layer shape and v577's catalog standings, with the vault built over the same personal-data document — no document shape change. Commits on release/v578: **e5046b5** (client) · **1a9332e** (harness). The rendered client of the merged tree parses whole (1,056,409 bytes).
- Client — `app/worker/src/client.ts` only; `index.ts` untouched; no migration; `ui.ts` untouched until Ship:
  - The vault envelope exactly as §2.1: `{format:'orapronobis-personal-data-encrypted', formatVersion:1, wraps:{pin, recovery, passkey?}, iv, ct}`; wrap slots `{salt, iterations, iv, ct}` struck through the standing `opnPbkdf2` machinery (hex salts, 100 000 iterations); the vault key is random 256-bit, stands only in memory, and persists through a serialized write chain (`opnVaultPersist`) so successive saves cannot interleave.
  - Locked state as §2.2: `opnDoc()` stands the ephemeral empty document over an envelope; `opnSave()` never overwrites ciphertext; personal write routes refuse **423 vault_locked** while locked (PIN routes excepted); the unlock card stands on Intentions, Favorites, Conscience (the standing PIN pad — verify now also decrypts), and the Settings "My data on this phone" card (export/import controls stand behind the unlock card while locked, so an empty ephemeral document can never be exported as if it were the data).
  - PIN routes as §2.3: set creates the vault in the same action; verify unlocks, and on a plain store under a standing PIN record performs the Q4 A migration (fresh recovery pair re-issued for the same PIN, the new code riding the verify result for its one showing — `migrated:true`); change re-strikes both wraps under the new PIN + the fresh recovery code the change flow issues; recover unwraps with the verified code first (a corrupt envelope refuses, never strands), then re-sets and re-wraps; remove dissolves the vault back to the plain document and clears the shell biometric enrolment through the bridge.
  - The pre-restore snapshot encrypts under the vault key while a vault stands (§2.4); Undo decrypts it back. Export is produced from the unlocked in-memory document only (§2.1) — C7 proves the copy carries no wrap, hash, or key material.
  - PWA-as-device as §2.5: `opnInstalledPwa()` (standalone display-mode or the iOS `navigator.standalone` form) makes `opnMode()` answer `device`; a plain tab's web behavior is byte-for-byte the standing one (C8).
  - Passkey as §2.7: PRF eval at create, with the create-then-get fallback for platforms that only answer PRF at assertion; a PRF-absent platform refuses enrolment plainly and nothing is written. The slot stores `{credId, prfSalt, iv, ct}` in the envelope.
  - Biometric seam as §2.6 (client half): enrolment rows in the Settings PIN section (fingerprint/face in the shell; passkey on an installed PWA); the unlock card's biometric button stands when the bridge reports an enrolment.
- Android — repo `Jctebo/ora-pro-nobis-android`, main **06d1ffed** (Git Data API fast-forward from c43dc3cb, read back): `OraDayBridgePlugin` gains `vaultBiometricStatus` / `vaultBiometricEnroll` / `vaultBiometricUnlock` / `vaultBiometricClear` — an AndroidKeyStore AES-GCM key under the alias **`ora_vault_key`**, user authentication required per use, invalidated by biometric enrolment change (an invalidated key rejects `key-invalidated` at unlock; the PIN/recovery path stands and re-enrolment starts clean); the wrapped copy stands in the shell's standing `opn_shell` SharedPreferences; `BiometricPrompt` carries the cipher as its CryptoObject (BIOMETRIC_STRONG on API 30+, the negative-button form below). `androidx.biometric:biometric:1.1.0` added; version **51 / "1.0.51"**. The v575 backup rules stand unchanged — the WebView store they cover now holds ciphertext.
- Harness — `harness-v578.mjs`, worlds over the RENDERED client: **43 ok / 0 not-ok** on the committed tree (S1–S8 statics + C1 ciphertext at rest · C2 unlock round-trip with the 423 refusal · C3 wrong PIN · C4 recovery restore · C5 migration · C6 no-PIN store · C7 export · C8 PWA worlds · C9 passkey + biometric seams).

### 3.2 Named deviations and limits

- §2.6 offered biometric enrolment "once at the first PIN unlock after a vault exists" as well as in Settings. Built: the Settings enrolment rows only — no interruptive prompt at unlock. The unlock card offers the biometric button whenever an enrolment stands. Named here rather than silently dropped.
- The native biometric leg is proven by the GitHub Actions build + the code read above; the client leg is proven at the bridge seam in C9 — Plan §2.9's own terms. The on-device proof (enrol, lock, unlock by fingerprint on John's phone) is a field leg after ship.
- `opnPinSet` re-strikes the PIN record whole, so the advisory `biometricEnrolled` flag (§2.1) resets at PIN change/recover. Enrolment truth is read from the bridge at every surface, so the reset costs nothing; the flag is a cache, never the record of truth.
- The honest limits of §1 stand unchanged: no protection while the app stands open and unlocked · a short PIN can be brute-forced offline against a stolen file (the derivation cost is the mitigation; the Keystore wrap is the stronger answer on Android) · PIN + recovery code both lost = the data is gone, by design.

## 4 · Review

- Clean-checkout proof: `harness-v578` re-run on a fresh worktree of the exact committed HEAD (1a9332e) — **43 ok / 0 not-ok**, identical to the build tree. The S1 static in the harness confines the branch diff (against the rebase base a16bd7e) to `client.ts` + the harness itself; `index.ts` untouched; migrations end at 0042; the SW pin stands at v577's until the Ship bump.
- Sibling regression: `harness-v577` on this tree — **38 ok / 0 not-ok** (the catalog standings and the v576 favorites interface ride the same document the vault now encrypts; C1–C9 cover the favorites-bearing document's round-trips). `harness-v568` cannot run on any current tree: its statics are pinned to its own base (S1/S3 read NOT-OK against v577's pin by construction) and its worlds slice the RAW client source — the pattern the v570 rendered-client discipline retired; it dies on the seed-guide escapes (`Unexpected identifier 'through'`) before any v578 code is reached. That failure predates and is independent of this change; it is recorded here rather than left as a silent gap.
- Code read (the Review pass over the committed diff): the PIN verify route's failure path registers the standing backoff before any vault work; unlock failure after a hash pass refuses (401 from the unwrap) without touching the stored envelope; recover unwraps BEFORE the re-set, so a corrupt envelope can never strand the vault behind a new PIN whose wrap was never struck; `opnSave()`'s locked guard and the 423 write refusal are two separate belts on the same rule (the ephemeral document can neither overwrite nor mutate against the ciphertext); the passkey slot survives PIN change/recover rewraps; PIN removal dissolves to the plain document and clears the bridge enrolment in the same action. The Android bridge group was read against the client's seam: method names, the `{keyB64}` crossing, and the `key-invalidated` rejection all match the client legs C9 proves.
- Fixtures from production (Improvement D): the harness worlds seed from the layer's own production seed literals (the 3 profile defaults, 26 source settings, 23 exam prompts, 5 guide steps — the v568 Plan census, drawn from the production migrations) and the v570 envelope shape; no fixture was invented to a wished-for shape.
- Open legs carried to Ship/field, none of them Review blockers: the live write-refusal POST proof on app.orapronobis.media (the standing v568 open leg — an approval-gated call, unrelated to this change; the 423/locked behavior is proven in C2 and the server's 403 `personal-in-app` gate is untouched) · the on-device biometric proof (John's phone, after the APK lands) · the passkey PRF behavior of real platforms (stubbed at the seam in C9 per §2.9; the refusal path for PRF-absent platforms is proven).

## 5 · Ship

- Merge + push: release/v578 fast-forwarded to main (a16bd7e → e5046b5 → 1a9332e → 32565a0, the last being the SW pin bump) and replicated to GitHub byte-identically through the Git Data API — **main pushed · remote in sync** (remote main read back 32565a067f833884f03149db2a1ab8604579ff2d). The local branch is deleted after the merge per the push-to-main rule.
- Harness on the exact ship tree (32565a0): 41 ok / 2 not-ok — both not-oks are the Ship pin bump itself reading against the harness's pre-ship statics (S1 sees ui.ts in the diff; S2 asserts the v577 pin stands until Ship), the v573 precedent shape, disclosed here. Every functional leg (C1–C9 + the remaining statics) passes on the deployed tree.
- Deploy: Worker **be60f487-e609-44af-931b-1a7d47cf2e2d** from a clean checkout of main 32565a0, SW pin **ora-pro-nobis-v578-1**. Rollback target stands at the v577 Worker 63effb22-d4d8-44a2-b937-3ab7c3fedd18.
- Served-leg proofs (the v568 lesson, applied): the public host's served app.js was fetched plain and **parses whole** (1,056,409 script bytes; the vault code stands in the served file); the shell stamps `__OPN_SHAPE__="public"`; sw.js carries the v578 pin; a personal read answers the standing empty public shape (`{"ok":true,"intentions":[]}`). The private host answers its standing Access 302 to a plain GET; the same Worker version serves both hosts, so its parse leg stands proven-by-identity, recorded that way.
- APK **1.0.51 / versionCode 51**: Android main 06d1ffed; Actions run 44922064610 completed success (unit tests + signed build + the workflow's badging/signature verification). Verified from the built file: SHA-256 **ebe37e64f1673ea15e809f6dab4cb53f14803c8f6895f42ac7f8526d0b9bf4dc** (matches the build's own SHA256.txt) · **6,839,869 bytes** · the compiled DEX carries the vault bridge (`vaultBiometricEnroll`/`vaultBiometricUnlock`, the `ora_vault_key` alias, BiometricPrompt). Delivered at **https://orapronobis.media/ora-pro-nobis.apk** (publish commit 53328fa on main, pushed · remote in sync; Pages deploy dispatched and the served file fetched back byte-identical). Record copy: ~/workspace/projects/ora-pro-nobis/ora-pro-nobis-1.0.51.apk.
- Registry: What's New **393** · shipped record posted · row 1546 **Live** (shipped_at 2026-11-21T16:13:07Z, read back). Intake 1092 closed with this outcome.
- Field legs for John (the gates his devices alone can pass): install APK 1.0.51 → set or verify the PIN → the store is ciphertext from that action (an existing plain store under a standing PIN migrates at the first verify, with a fresh recovery code shown once — save it) → enrol fingerprint/face in Settings under the PIN card and unlock with it · on an installed web app (PWA), add a passkey unlock where the platform offers PRF. The standing v568 write-refusal live POST proof remains open (approval-gated, unchanged by this release).
