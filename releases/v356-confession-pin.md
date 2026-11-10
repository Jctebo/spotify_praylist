## 1 · Scope

- **Direction (John, voice call 2026-11-10 05:39 CT):** a password for the Confession tab — a user-defined PIN — so that if someone picks up his phone and opens Confession, they must enter the PIN before any confession content shows. The threat named is the casual holder of his unlocked phone, inside his signed-in app session.
- **Sequencing (John, same call):** among the pre-Android work the queue-resume fix (v355) is first; this PIN also lands BEFORE the native Android test, which comes after the UI overhaul program (v352–v354) — the whole set is "stabilizing" the app before the Android test.
- **Approval (John, Ora thread, 2026-11-10 05:52 CT, via the interactive package's copied prompt; all Scope recommendations standing): TO SHIP**, with the six decisions §2 builds on:
  1. **Server-verified PIN:** the server withholds the Confession/Examination content (the confession entries API + the examination read) until a verification token stands (short-lived, ~30 min); hashes in D1 — PIN hash (salted, slow hash available in Workers), recovery-code hash; hashed only; compare server-side; attempts counted server-side.
  2. **Coverage:** Confession AND Examination of Conscience both gated — one unlock opens both.
  3. **Unlock persistence:** session — until the app is closed; the token may outlive it server-side, never stored beyond the session (no localStorage persistence).
  4. **Forgotten PIN:** a one-time recovery code shown ONCE at set; entering it allows setting a new PIN and KEEPS the content.
  5. **Wrong attempts:** after 5, a short wait (exponential-ish, seconds-to-minutes) — no lockout, no wipe.
  6. **First set:** offered, not forced — with no PIN set, the content stays open (standalone Settings section; no first-open modal).
- **Scope's discovery, verified first-hand by Plan against the shipped tree (trunk 4f0b1bf, production Worker 1bcbf6d0):** the gated content lives behind exactly two session route families in `app/worker/src/index.ts` — `/api/exam/*` (GET today · POST entries · DELETE entries/:id · POST runs/:id/close · PUT prompts) and `/api/confession/*` (GET payload · POST made · POST penance · POST penance/done · PUT guide). The examination read (`examToday`) returns the Lasance-seeded prompts (migration 0004/0006, John-editable via the prompts PUT) PLUS John's own entries for today's run; the confession payload returns the guide, the last confession, the penance, the open preparation entries (his exam entries flowing in), and history. Both payloads are therefore personal content end to end, and the two families gate as units (§2.3). Nothing is client-held: with the API refused, no content bytes reach the device at all.

## 2 · Plan

- **Agent:** Plan agent (v356 Plan, 2026-11-10) — Plan claim record 1262, claimed 2026-11-10T11:53:41Z · time contract 170 (expectation: Plan passed — §2 published, ASAP, hard deadline 07:15 CT 2026-11-10).
- **Inputs read first-hand at Plan:** the registry row 672 + Scope record passed · fork trunk muse-draft-week @ 4f0b1bf (v351 §5 head; production Worker 1bcbf6d0) · `app/worker/src/index.ts` (routing head :882–941, exam/confession payloads :437–496, the exam routes :1328–1375, the confession routes :1377–1419, `johnOnly`/`isAgent`/`timingSafeEqual` :68–80) · `app/worker/src/client.ts` (`api()`/`post()` :57–65, `setTab` :817–827, `renderSettings` :872, `renderExamination` :2840, `renderConfession` :2941) · `app/worker/src/ui.ts` (CSS tokens :42, SW pin :196) · migrations 0001–0013 (0013 is the last — **0014 is this release's**) · a repo-wide search for every caller of the two route families (§2.4).
- **Shape in one line:** one D1 singleton holds the PIN + recovery hashes and the attempt counter (migration 0014); six small session routes under `/api/pin/*` set, verify, change, remove, and recover; a single dispatch check in front of the `/api/exam/*` and `/api/confession/*` families refuses them 403 `pin_required` until the request carries a live verification token (32 random bytes, SHA-256-hashed server-side, 30-minute fixed life); the client keeps the token in one memory-only variable, gates the two tabs behind a numeric PIN pad in the current chrome, and carries a standalone PIN section in Settings — with no PIN set, every surface behaves byte-identically to today.

### 2.0 Code verification — the package's discovery against trunk 4f0b1bf

Every load-bearing claim was re-read in the shipped code. **No contradiction found.** The particulars Plan pins:

1. **The content is server data, wholly.** `examToday` (:439) reads `exam_prompts` + today's `exam_entries`; `confessionPayload` (:463) reads `confession_guide`, `confessions`, and the open `exam_entries`. The client renders only what these payloads carry (client.ts :2842, :2941 area). Refusing the routes withholds the content itself, not a view of it — decision 1's design is available exactly as Scope described.
2. **The route families are closed sets.** Exam: GET `/api/exam/today`, POST `/api/exam/entries`, DELETE `/api/exam/entries/:id`, POST `/api/exam/runs/:id/close`, PUT `/api/exam/prompts`. Confession: GET `/api/confession`, POST `/api/confession/made`, POST `/api/confession/penance`, POST `/api/confession/penance/done`, PUT `/api/confession/guide`. No other route serves exam or confession data (the player/day and prayer/day payloads carry neither).
3. **One dispatch seam exists.** All session traffic passes the `johnOnly` gate (:936–941) and then the `seg[0] === "api"` blocks in order. The PIN check hangs on that same seam, in front of the two family blocks (§2.3) — no route-by-route patching.
4. **The agent door's scope is already disjoint** — §2.4 gives the full machine-flow finding.
5. **The client has one fetch seam.** Every API call flows through `api(path, opts)` (client.ts :57), with `post()` on top of it — the token header merges there, once (§2.6.1). Tab taps flow through `setTab` (:817) into `renderExamination()` / `renderConfession()`, each of which fetches before it renders — the gate stands in those two renders (§2.6.2).
6. **Hashing primitives available:** the Worker runtime's WebCrypto offers PBKDF2 (`crypto.subtle.deriveBits`) — the slow hash available in Workers; no bcrypt/Argon2 exists in the runtime. `timingSafeEqual` already stands in the Worker (:62) and is reused for every credential compare.
7. **Migrations:** 0013 (v349) is the last applied; the player_settings_meta version is NOT touched by this release (no settings rows change — the PIN is not a source-mapping row, and bumping the version would needlessly invalidate the v334 device day-cache).

### 2.1 Credential storage — migration 0014

One new migration, `app/migrations/0014_confession_pin.sql`, in the estate's commented style (header naming the release + §, what it does NOT do). It creates exactly two tables and nothing else — no seed rows (the absence of a `pin_state` row IS the no-PIN-set state; the first Set inserts it), no changes to existing tables, no meta increment:

```sql
CREATE TABLE pin_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  pin_hash TEXT NOT NULL, pin_salt TEXT NOT NULL, pin_iterations INTEGER NOT NULL,
  recovery_hash TEXT NOT NULL, recovery_salt TEXT NOT NULL, recovery_iterations INTEGER NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  next_allowed_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE pin_tokens (
  token_hash TEXT PRIMARY KEY,
  issued_at TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE INDEX idx_pin_tokens_expires ON pin_tokens (expires_at);
```

- **Hashing (PIN and recovery code alike):** PBKDF2-HMAC-SHA-256, **100,000 iterations**, a fresh 16-byte `crypto.getRandomValues` salt per credential, a 32-byte derived key, salt + hash stored hex, the iteration count stored per credential so the cost can rise later without a flag day. Implement verifies 100,000 against the runtime's WebCrypto ceiling in the harness environment and records the landed value in §3; if the runtime refuses it, Implement lowers to the highest accepted value and names the substitution in §3 — it does not silently pick a different cost.
- **Compare:** derive with the stored salt + iterations, then `timingSafeEqual` on the hex — the codebase's standing constant-time compare.
- **The token is hashed differently, on purpose:** tokens are 32 bytes of `crypto.getRandomValues` (256-bit entropy), so `pin_tokens` stores a plain SHA-256 hex of the token — a fast hash is correct for a high-entropy bearer secret, and it keeps the per-request lookup a single indexed read. The asymmetry (slow hash for the 4–8 digit PIN, fast hash for the token) is the design, stated so Review does not read it as an inconsistency.
- **Revocation is deletion:** any set / change / remove / recover replaces or deletes `pin_state` AND deletes every `pin_tokens` row in the same write set — an old unlock never survives a credential change.

### 2.2 The API surface — `/api/pin/*` (session routes, `johnOnly`, never on the agent door)

All six routes are John's session surface only. The agent door gains NO pin route of any kind (§2.4). Bodies are JSON in the codebase's idiom; errors are `err(status, message)` in the standing `{ error }` shape.

| Route | Rule |
|---|---|
| GET `/api/pin/state` | → `{ pinSet, retryAfterSeconds }`. The only unauthenticated-by-PIN read: the client needs it to render the gate and the Settings section. It reveals nothing but whether a PIN stands and whether a wait is running. Never gated. |
| POST `/api/pin/set` `{ pin }` | Only when NO `pin_state` row stands; else 409 `pin already set`. Validates the PIN format (§2.2.1). Inserts the row (PIN hash + a freshly generated recovery code's hash, counter zeroed). → 201 `{ recoveryCode, token, expiresAt }` — the recovery code appears in this response and nowhere else, ever (§2.5); a token is issued with it, so John walks straight into the tabs. |
| POST `/api/pin/verify` `{ pin }` | The unlock. If no PIN stands → 409 `no pin set`. If a wait is running (§2.2.2) → 429 `{ error: "wait", retryAfterSeconds }` and the PIN is NOT evaluated at all — a correct PIN during a wait still waits; that is what makes the delay real. Otherwise derive + compare: wrong → the counter advances (§2.2.2) and 401 `{ error: "wrong pin", attemptsRemaining }` (attempts left before the wait engages; 0 on the failure that engages it, with `retryAfterSeconds` added); right → counter reset to 0, wait cleared, token issued → 200 `{ token, expiresAt }`. |
| POST `/api/pin/change` `{ pin }` | Requires a valid token (the `x-pin-token` header, §2.3) — change is an unlocked act; a forgotten PIN goes through recover, never change. Replaces the PIN hash AND the recovery hash together (one credential generation = one PIN + one code), revokes all tokens, issues a fresh token → 200 `{ recoveryCode, token, expiresAt }` — the NEW recovery code shown once, here. |
| POST `/api/pin/remove` | Requires a valid token. Deletes the `pin_state` row and every token → 200 `{ ok: true }`. The content is untouched and stands open again, exactly as before any PIN was set. |
| POST `/api/pin/recover` `{ code, newPin }` | One call, no grant state. The code is normalized (§2.5) and compared against the recovery hash, on the SAME attempt counter + wait schedule as verify (the recovery route is never the unthrottled back door — §2.2.2). Wrong code → the counter advances exactly as a wrong PIN. Right code → the PIN hash is replaced with `newPin`'s, a NEW recovery code is generated and hashed (the used code dies with the generation it belonged to), the counter resets, all tokens are revoked, a fresh token is issued → 200 `{ recoveryCode, token, expiresAt }`. **No exam or confession row is read, written, or deleted by this route — the content is kept by construction (decision 4).** If no PIN stands → 409 `no pin set`. |

#### 2.2.1 Formats

- **PIN:** 4–8 digits, `/^\d{4,8}$/`, validated server-side on set / change / recover (400 `pin must be 4-8 digits`). The client pad enforces digits-only entry; the server rule is the record.
- **Recovery code:** 12 characters from the Crockford base32 alphabet (digits + uppercase letters minus I, L, O, U), drawn from `crypto.getRandomValues` with rejection sampling (no modulo bias), displayed grouped `XXXX-XXXX-XXXX`. Compare-normalized: strip dashes and spaces, uppercase. ~60 bits of entropy behind a slow hash + the shared throttle — sized for a code John writes down once, not a password.

#### 2.2.2 The attempt counter + wait schedule (decision 5, exact numbers)

One counter on the `pin_state` row serves BOTH credential routes (`failed_attempts` consecutive failures + `next_allowed_at`):

- Failures **1–4**: no wait; verify answers 401 with `attemptsRemaining` = 5 − failures.
- Failure **5** engages the schedule; the wait before the NEXT evaluated attempt: failure 5 → **30 s** · 6 → **60 s** · 7 → **120 s** · 8 → **240 s** · 9 and beyond → **300 s cap**. (Seconds-to-minutes, roughly doubling, capped — decision 5's shape, with no lockout and no wipe at any count.)
- An attempt that arrives while `next_allowed_at` stands in the future is refused 429 **without being evaluated and without incrementing the counter** (an attacker — or a fumbling holder — cannot extend the wait by hammering; the wait simply runs out).
- A successful verify or recover resets `failed_attempts` to 0 and clears `next_allowed_at`. Set / change / remove do not touch the counter (change and remove ride on an already-proven unlock; set exists only when no credential stands).
- The counter is global to the app, not per-device or per-IP: the app has exactly one user and one credential — per-anything keying would be machinery without a threat. Stated so Review does not ask for it.

### 2.3 Withheld-content enforcement

- **The check:** in `fetch`, immediately after the `johnOnly` gate and before the exam/confession route blocks: when `seg[0] === "api"` and `seg[1]` is `"exam"` or `"confession"`, load the `pin_state` row. **No row → the request proceeds exactly as today** (decision 6: no PIN set, content open — and no token lookup cost on any other route family). Row stands → the request must carry header **`x-pin-token`** whose SHA-256 hex matches a `pin_tokens` row with `expires_at` in the future; anything else (missing, unknown, expired) → **403 `{ error: "pin_required" }`** — a body token distinct from Access's `forbidden` / `access sign-in required`, so the client never confuses a PIN refusal with a sign-in failure. An expired token row is deleted opportunistically on lookup.
- **Reads AND writes gated — the ruling and its reason:** every route in both families (§2.0.2) sits behind the check, writes included. The threat is a casual holder inside a signed-in session: read-gating alone would still let that holder add a fabricated exam entry, delete tonight's entries, close the run, record a confession that sweeps every open entry under it (POST `/api/confession/made` links ALL unlinked entries), overwrite the penance, or vandalize the prompt and guide texts. Content protection that leaves the writes open protects the reading and abandons the record. One rule for both families, no per-route exceptions — including the two seed-text PUTs (prompts, guide), which are John's own editable data.
- **Refusal happens before the handler:** a refused GET `/api/exam/today` creates no `exam_runs` row (the handler's create-on-read side effect never runs); a refused write changes nothing. The gate check itself writes nothing except the opportunistic expired-token delete.
- **Token lifetime:** fixed **30 minutes** from issuance (`expires_at` = issued + 30 min), no sliding renewal. The client consequence is named in §2.6.4: if the token expires while John is working in a gated tab, the next call answers `pin_required`, the client clears the gated DOM and shows the gate again — one PIN entry restores him; nothing he already saved is affected (writes are per-call and were accepted under the then-live token).
- **Why a server-side token record, not a signed token:** revocation. PIN change / remove / recover must kill every outstanding unlock the moment they land (§2.1) — a signed (HMAC) token cannot be revoked without a server-side denylist, which is a server record wearing a second hat; and a signed design needs a new Worker signing secret to manage. The record design is one indexed D1 read per gated request in a single-user app — the cost is negligible and the revocation is a DELETE. 

### 2.4 The machine-flow finding (verified, not assumed)

**No machine flow touches the gated families, and none needs a path.** Evidence, all first-hand:

1. The agent door (`/api/agent/*`, index.ts :889–935) serves exactly four things: `prayer/day` GET + POST (the midnight job's draw/addendum), `prayer/intros` GET (read-back), `player/settings` GET, `player/day` GET. There is no exam or confession route on the door, and §2.2 adds none.
2. The Worker's own standing rule, in the file header (:12–14): *"Examination entry text is never read by the agent door and never leaves this app's surfaces."* This release keeps that rule untouched — the PIN design neither needs nor creates an exception to it.
3. A repo-wide search for `api/exam` / `api/confession` outside `app/worker/src` finds ONLY `app/tests/harness-v305.mjs` (the app's own gate). No job, runner script, nightly sheet step, or publish helper calls either family: the Ora nightly run composes from the prayer module and the intentions feed; the devotional sheet's step 7a/9 reads are prayer-module reads through the door. **The nightly flows do not read confession or examination data — confirmed in code, so the gate cannot break a night's run.**
4. The one non-door machine read, GET `/api/prayer/day` with the agent token (:936), is a prayer route — outside both gated families, unaffected.

### 2.5 The recovery code's one showing

The code is generated server-side at set / change / recover, hashed in the same write, and returned in that response only. It is never stored in plaintext, never readable back (no route returns it — `/api/pin/state` carries only `pinSet` + `retryAfterSeconds`), and never logged. The client shows it in a dedicated sheet (§2.6.5) with the standing copy — *"Store it safely. It is shown once. If you forget your PIN, this code lets you set a new one — your examination and confession content is kept."* — and a Copy button. Losing both the PIN and the code leaves exactly one path, named honestly here: John's own direct D1 access removes the `pin_state` row (content untouched — the credential is one singleton row precisely so that this last resort is a one-row delete, not surgery on his data). That path is John's infrastructure access, not an app feature, and no route implements it.

### 2.6 The client

#### 2.6.1 The token's residence — memory only (decision 3, with the examined alternative)

- The token lives in ONE module-scope variable in client.ts (beside `state`), set by verify / set / change / recover, cleared on a `pin_required` refusal's expiry path and never written anywhere else. `api()` merges the header `x-pin-token: <token>` into every `/api/` call while the variable stands (the server ignores it outside the gated families and the pin routes that require it).
- **sessionStorage was examined and rejected.** It would survive an in-tab reload, but in iOS standalone (home-screen) web apps the session store can outlive what a user experiences as closing the app — the token would then be *stored beyond the session* on exactly the platform where the distinction is invisible. Decision 3's words are the record: the token *"may outlive it server-side, never stored beyond the session (no localStorage persistence)"*. A memory-only variable is the one residence that satisfies that sentence on every platform: app close, webview death, or a full page reload all end it.
- **The named trade:** a full page reload re-locks the two tabs (one PIN entry restores the session; the server-side token from before the reload simply goes unused and expires). Reloads inside a session are rare on his phone (per-release service-worker updates are the standing cause, and a release ship is exactly when re-entry costs least). Plan records the trade as accepted by the decision's own wording — if John later wants reload-survival, sessionStorage is a one-line follow-on with the iOS caveat attached, not a silent swap.

#### 2.6.2 The gate in the tab flow

- `setTab` is untouched. `renderExamination()` and `renderConfession()` each open with the pin check: the client holds the last `/api/pin/state` read (fetched lazily at the first gated-tab tap or Settings open — §2.7's boot rule). If `pinSet` and no token stands → the view renders the **PIN gate screen** (§2.6.3) and NO gated fetch is issued at all. If a token stands (or no PIN is set) → the render proceeds exactly as today.
- The gate is per-tab in presentation, one unlock in fact (decision 2): unlocking from the Examination gate opens Confession too, and vice versa — the token is global, the gate screen is just where the missing unlock is asked for.
- A gated fetch that still answers `pin_required` (the token expired between the state read and the call, §2.3) drops the view back to the gate: the render's error path checks the error string, clears any gated DOM already in the view (content protection — expired means cleared, not left on screen), and renders the gate with the line *"Session expired — enter your PIN."* when a token had stood.

#### 2.6.3 The PIN pad (the Scope mockup, in the CURRENT chrome)

Built with the standing CSS custom properties (`--navy` / `--gold` / `--cream` / `--ink` / `--line` / `--card`, ui.ts :42) and the app's standing sheet/card language — no new theme machinery (§2.8). Shape: the gated tab's title, a lock line naming what is protected ("Examination of Conscience is protected by your PIN" / "Confession is protected by your PIN"), a dots row (one dot per entered digit, 4–8), a numeric pad (1–9, blank, 0, ⌫), and — once at least one failure stands — a *"Forgot PIN? Use your recovery code"* line under the pad that swaps the pad for the recovery form (code field + new-PIN entry, §2.6.5). Entry auto-submits at the set length's first valid digit count the client knows: the pad submits when the entered length reaches the length John set — the client does NOT know the length (the server never discloses it), so the pad submits on an explicit **Unlock** button under the dots, enabled from 4 digits. (Auto-submit was considered and rejected for exactly that reason; the button is one tap.) Behavior:

- **Wrong PIN:** the dots row shakes (the mockup's error shake — a CSS keyframe on the gate card), the dots clear, and the line under the pad reads *"Wrong PIN — N attempts before a short wait"* from the response's `attemptsRemaining` (or the wait line, below).
- **Wait running:** the pad disables, the Unlock button disables, and the line reads *"Too many attempts — try again in M:SS"*, counting down per second from the response's `retryAfterSeconds`; at zero the pad re-enables. The countdown is presentation only — the server's `next_allowed_at` is the record, and a verify sent early answers 429 with a fresh count.
- **Right PIN:** the gate is replaced by the tab's normal render (the fetch that was withheld now runs). Nothing about the gate persists into the content view.

#### 2.6.4 Settings — the PIN section (decision 6)

`renderSettings()` gains one standalone section, **"Confession PIN"**, standing apart from the source-mapping rows, at the end of the screen:

- **No PIN set:** one line — *"No PIN is set. Confession and Examination open without a PIN."* — and a **Set a PIN** button → the set flow: enter a new PIN (pad or digit field in the sheet idiom), enter it again to confirm (a mismatch keeps the sheet open with *"The two entries do not match"* — a client-side check; the server receives one PIN), then the recovery sheet (§2.6.5) shows the code once, and the token returned by set means the tabs stand unlocked for this session.
- **PIN set + unlocked (token stands):** **Change PIN** (new PIN + confirm → the change call → the recovery sheet shows the NEW code once) and **Remove PIN** (a confirm step in the sheet — *"Remove the PIN? Confession and Examination will open without it."* — then the remove call; the section re-renders to the no-PIN state).
- **PIN set + locked (no token this session):** the section shows *"A PIN is set"* with **Enter PIN** (the same gate screen, returning to Settings on unlock) — change and remove are not offered locked, because both ride on the token (§2.2). The recovery path stands on the gate itself (§2.6.3), so a forgotten PIN never needs Settings to reach it.
- No first-open modal, no prompt anywhere else: with no PIN set, nothing in the app mentions the PIN outside this section (decision 6).

#### 2.6.5 The recovery sheet + the recovery form

- **At set / change / recover:** a sheet in the standing idiom shows the code large, grouped `XXXX-XXXX-XXXX`, with the §2.5 copy, a **Copy** button (`navigator.clipboard.writeText`, falling back to selecting the code text when the clipboard refuses), and a single **Done** that closes it. Done is not gated on any "I have stored it" checkbox — offered plainly, once (decision 6's posture: offered, not forced, applies to the whole feature).
- **The recovery form** (from the gate's Forgot line): a code field (text input, uppercase transform, dashes tolerated), a new-PIN entry + confirm (same mismatch rule as set), and **Set new PIN** → POST `/api/pin/recover`. A wrong code answers through the same wrong-attempt language as the pad (counter shared, §2.2.2) and the form stays open with the count/wait line. Success closes the form, lands the fresh token, and shows the NEW recovery code sheet (the generation rolled, §2.2) before the tab's content renders.

### 2.7 Interaction with v355 (queue persistence) — the boot-path note

v356 Plans against the shipped tree (4f0b1bf); v355's Plan is being written concurrently and its Implement lands first in John's order. The touchpoints, named so Implement sequences cleanly:

- **Shared surface:** both releases edit `client.ts`. v355's ground is the playback/boot state (queue restore at load); v356's is `api()`'s header merge, the two gated renders, the Settings screen, and new gate/pad code. The only true overlap is the boot sequence itself: **v356 adds NO boot work** — the `/api/pin/state` read is lazy (first gated-tab tap or Settings open), so the player boot order v355 establishes is untouched, and a reloaded app simply has no token (memory-only, §2.6.1), which is v356's designed state, not a restore case. v355's persisted queue and v356's deliberately unpersisted token are the two halves of John's order working as specified: playback resumes; the lock does not.
- **Implement rule:** v356 Implement rebases onto the landed v355 tree, re-reads `api()` and the two renders as they stand there, and re-verifies the §2.0.5 seams before building; if v355's landing changed a seam this Plan names, §3 records the adjustment — the design does not depend on v355's internals beyond those seams.
- The SW pin: v355 takes its own pin at its Ship; v356 bumps from whatever pin then stands to `ora-pro-nobis-v356-1`.

### 2.8 Interaction with the overhaul (v352–v354)

v356 ships BEFORE the overhaul releases, in the CURRENT chrome, per John's stabilization order. The PIN surfaces — the gate screen, the pad, the recovery sheet/form, the Settings PIN section — are built on the standing CSS custom properties and the app's current component idioms, so (a) v352's liturgical theme tokens recolor them through the token layer without code change (the pad's accent is `var(--gold)` on `var(--navy)` today; whatever the foundation release binds those tokens to, the pad follows), and (b) v353's structure work inherits the PIN rows as named surfaces to restyle — gate, pad, recovery sheet, Settings section — with their behavior (this §2) unchanged. The overhaul Plans must carry that inheritance; it is stated here so they do. **No checklist interaction:** the gate adds no counts, marks, or completion state anywhere (the v305 NO CHECKLIST rule) — the attempt count is a server-side security counter shown only as a wait line, never as progress. **Same-day consumption:** none — the PIN reads no day state and changes no payload shape outside the two gated families' refusal.

### 2.9 Harness plan — harness-v356 (app/tests/harness-v356.mjs)

Modeled on the standing family shape (local wrangler + headless Chromium, `LOCAL_DEV:1`, worktree-only hard guard, the test D1 fresh per run — PIN values in the harness are fixtures on that test D1 only, per the guard; no real credential appears anywhere in the harness or this document). Migration 0014 applies to the test D1 as part of setup. Tallies read from COMPLETE log files. Legs:

- **L1 — no-PIN-set is today:** with no `pin_state` row, the full standing exam + confession flows run open (entry add/delete, run close, prompts PUT, confession made/penance/guide) and `/api/pin/state` answers `pinSet: false` — the regression floor, asserted before any PIN leg runs.
- **L2 — set:** POST `/api/pin/set` (fixture PIN) → 201, a recovery code in the grouped format, `pin_state` holds hashes only (the row's text contains neither the PIN nor the code in plaintext — asserted by direct D1 read), a second set → 409.
- **L3 — the gate withholds bytes:** with the PIN set and no token, GET `/api/exam/today` and GET `/api/confession` → 403 `pin_required` whose bodies contain NONE of the fixture entry/confession strings seeded pre-set (absent, not hidden); the refused GET created no `exam_runs` row (D1 count unchanged); POST entries / confession made / prompts PUT / guide PUT without a token → 403 and D1 unchanged.
- **L4 — wrong attempts + the wait:** 4 wrong verifies → 401 with `attemptsRemaining` 4·3·2·1; the 5th → 401 with `retryAfterSeconds` 30 (±2 s); a 6th attempt during the wait — even with the CORRECT fixture PIN → 429, counter not incremented (D1 read: `failed_attempts` still 5); after the wait is time-shifted past (the harness updates `next_allowed_at` on the test D1 — server-time travel, not a client sleep), the correct PIN verifies.
- **L5 — unlock opens both:** the verify token rides `x-pin-token` → exam today + entries POST + confession GET + penance POST all pass; the token also opens the OTHER tab's family without a second verify (one unlock, decision 2).
- **L6 — token expiry:** a token row with `expires_at` in the past (test-D1 time shift) → 403 `pin_required`; the expired row is deleted on lookup.
- **L7 — session residence (client):** in Chromium — unlock, reload the page → the gated tab shows the gate again (memory-only token gone); the token string appears in NEITHER localStorage nor sessionStorage at any point (asserted by storage reads after unlock); within one uninterrupted session, tab switches Examination ↔ Confession keep both open.
- **L8 — recovery:** wrong code → 401 and the shared counter advanced (a subsequent wrong PIN continues the same count, proving one counter); correct code + new PIN → 200 with a NEW recovery code; the OLD PIN now fails verify, the NEW PIN passes; the old recovery code is dead; the pre-set fixture entries + confession stand intact in D1 (content kept, decision 4).
- **L9 — change + remove:** change without a token → 403 `pin_required`; with a token → 200 + new code, all prior tokens revoked (the pre-change token now 403s), new PIN verifies. Remove with a token → `pin_state` + `pin_tokens` empty, both families open with no header (back to L1's world).
- **L10 — the pad UX (Chromium):** wrong entry → shake class on the gate card + the attempts line with the right count; wait state → pad + Unlock disabled with a counting-down line; Forgot → the recovery form renders; Set flow in Settings → the recovery sheet shows the grouped code with a Copy button; the gate names the day's standing accent tokens (the pad's computed accent = `--gold`).
- **L11 — machine-flow leg:** with a PIN set and locked, the agent door's four reads (prayer/day, prayer/intros, player/settings, player/day with the harness agent token) all answer exactly as with no PIN — the gate never reaches the door (§2.4, proven in the gate, not just in code reading).
- **Regression families on the candidate:** harness-v305 (its exam/confession legs run in the no-PIN world of L1 — byte-identical behavior), and the player families as applicable to a client+Worker change: harness-v344 / v346 / v347 / v349 / v350 / v351 — complete runs, tallies from complete logs; their SW pin legs read `ora-pro-nobis-v356-1` succession as the standing pattern dispositions them (each family's own superseded pin leg is the known failure shape, proven against its own tree per the estate rule).
- **Pristine comparison:** harness-v356 against the pristine trunk (4f0b1bf) fails the new-behavior legs (L2–L6, L8, L9's gate assertions, L11's state route) in order — on pristine there are no pin routes and nothing refuses — while L1 (the no-PIN world) passes there too, since it describes standing behavior.

### 2.10 Ship shape

- **The standard five-phase shape** (this release's own approval is To Ship under the standing flow; the overhaul's straight-to-production Decision 5 belongs to v352–v354 and does not reach v356): Implement builds on the landed v355 tree in its clean release worktree and lands ff-only; Review verifies (data/auth-adjacent change — a credential store and a new refusal on two route families — so Review runs BEFORE the production migration is applied, on the harness's test D1); Ship applies **migration 0014 to the production D1** with read-backs (tables stand, zero rows — no PIN exists until John sets one), deploys the Worker from a clean ship worktree (dry-run first, version read back, rollback = the then-current production version), and completes the four-piece flip with What's New read live at Ship time.
- **SW pin:** `ora-pro-nobis-v356-1`.
- **First-run truth:** the ship changes nothing John can see until he chooses to set a PIN in Settings (decision 6) — §5 records that plainly, plus the migration read-backs and the door proofs (the agent door's four reads healthy; the gated families answering open with no PIN set, exactly as before).
- **Phone posture, recorded honestly:** no pre-ship phone verdict stands; John's phone verdict on the shipped build — set a PIN, lock, unlock, recover — is the real-world test and is recorded in §5 as his, pending — never as passed.
- **Concerns and Information Needs:** none open. The two judgment calls Plan made inside the decisions' wording — memory-only token residence over sessionStorage (§2.6.1, the reload trade named), and the exact wait ladder 30·60·120·240·300 (§2.2.2, inside decision 5's "exponential-ish, seconds-to-minutes") — are recorded in place for Review's eye; both sit inside John's chosen options, neither changes a decision.
