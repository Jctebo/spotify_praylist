# v587 — Vault unlock screen: the large PIN pad stands here too

## §1 Scope

John's field report (Ora thread, 2026-11-21 11:40 CT, with screenshot): "This screen is still here."
Approved (Ora thread, 2026-11-21 11:43 CT; Scope package 78; no formal Space record — the pasted picks govern):

- **Q1 A** — the large PIN pad stands on the v578 VAULT UNLOCK screen ("Your data on this phone is
  locked — Unlock with your PIN"); the typed PIN field retires on that screen.
- **Q2 A** — the pad also stands on the PIN set/change forms: one PIN entry form everywhere.
  The recovery-code entry STAYS TYPED (a recovery code is not digits).
- **Run level: To Ship** — streamlined small-release path.

Grounding: v584 (shipped 2026-11-21) dressed the one pad component to full large (keys 88px ·
digits 30px · dots 18px · hint 19px + the narrow-phone scaling rule), but its ship finding named
the gap this release closes: the vault unlock and the PIN set/change forms take a TYPED PIN in a
password field — no pad stands there to dress. This release puts the standing pad component on
those forms in place of the typed field, wired to the same verify/set seams. PIN behavior, the
vault machinery (AES-GCM envelope, PIN + recovery wraps), and where a PIN is required do not
change. John's on-device vault is NOT migrated or reset — the same PIN must unlock it after the
ship.

## §2 Plan (compressed, streamlined path)

Base: 934781f — the standing clone's local main (v585 ship 7e38528 + v583 doc §5 1a9277e +
the v580 merge), worktree on release/v587. origin/main is re-read fresh immediately before the
merge at Ship; the branch rebases if main moved.

### Seam findings — how the pad wires to the unlock + set/change flows

- **The gate pad is not directly reusable.** `renderPinGate` (client.ts) is the one pad painter,
  but its entry state lives in the module-level `pinGateCtx`, and `paintPinDots` / `startPinWait` /
  `submitPinVerify` bind to fixed global element IDs (`pindots`, `pinpad`, `pinmsg`, `pin-unlock`,
  `pingate-card`) and paint into the whole-tab `view`. A second pad on a page would collide on
  IDs and on the shared context. So the wiring is a **per-instance pad factory**: the gate's exact
  dots + pad markup and classes (`.pindots` / `.pindot` / `.pinpad`, `[data-pinkey]` keys) emitted
  under an id prefix, with its own entry state and the gate's entry discipline (digits only, at
  most 8, dots painted from 4, an optional submit button enabled at ≥4 digits). `renderPinGate`
  itself stands **untouched** — its gate-only behavior (wrong-PIN shake, lockout countdown) stays
  gate-only.
- **The typed PIN surfaces** (every PIN `type="password"` field in the client; none in index.ts
  or ui.ts):
  1. **Vault unlock card** — `opnUnlockCardHtml` / `opnBindUnlockCard`: `#opn-unlock-pin` posts
     `/api/pin/verify`; the success handler sets `pinToken`, shows the fresh recovery code once
     on a first-unlock migration, and re-renders the surface. Its recovery sub-form holds
     `#opn-rec-code` (typed — stays) and `#opn-rec-pin` (new PIN), posting `/api/pin/recover`.
  2. **Gate recovery form** — `renderPinRecoveryForm`: `#rec-code` (typed — stays) and
     `#rec-pin1` / `#rec-pin2`, posting `/api/pin/recover`.
  3. **PIN set/change sheet** — `openPinSetSheet`: `#ps-pin1` / `#ps-pin2`, posting
     `/api/pin/set` or `/api/pin/change`; success shows the recovery sheet once.
- **Per surface, the pad wiring** (each form's standing submit handler reads the pad's entry and
  posts to the SAME route with the SAME body and the SAME success/error handling — no route,
  body, or handler changes):
  - Unlock card: the typed field retires; a pad (prefix `opn-unlock`) stands over the standing
    Unlock button (enabled at ≥4 digits — the gate's discipline). A wrong PIN clears the pad
    entry and shows the standing message texts (attempts remaining; the 429 wait text).
    Biometric, passkey, and recovery-open buttons stand unchanged. In the recovery sub-form the
    code stays typed and the new PIN takes a pad (prefix `opn-rec`); "Set new PIN and unlock"
    reads the pad.
  - Gate recovery form: the code stays typed; the two new-PIN fields become two pads (prefixes
    `rec1` / `rec2`); the standing match + format validations read the pad entries; messages
    unchanged.
  - Set/change sheet: the two typed fields become two pads (prefixes `ps1` / `ps2`); Save reads
    the pad entries; the same match + format validation, the same routes, the same one showing
    of the new recovery code.
- **Behavior invariance:** verify / set / change / recover routes and bodies byte-identical;
  the vault machinery untouched (no `opnVault*` / `opnPin*` function changes); `index.ts`
  untouched; `ui.ts` untouched (the v584 dress already covers `.pinpad` / `.pindots` wherever
  they stand). The diff is confined to `app/worker/src/client.ts`, `app/harness-v587.mjs`, and
  this doc.

### Proof (harness-v587, rendered client, clean checkout of the committed tree)

- **S-legs:** diff confined to client.ts + harness + doc; migrations unchanged; SW pin unmoved
  pre-Ship; index.ts and ui.ts byte-identical to base; no typed PIN field remains on the unlock,
  recovery-new-PIN, or set/change forms; the recovery-code inputs stay `type="text"`.
- **R-legs:** the rendered client (APP_JS) parses whole; the unlock card's HTML carries the pad
  and no typed PIN field; the served stylesheet dress stands as v584 built it.
- **L-legs** (vm worlds over slices of the rendered client, fake DOM, the v585 pattern): the
  unlock pad's entry unlocks through the standing verify route (the posted body carries the
  entered PIN; success re-renders); a wrong PIN fails with the standing message and clears the
  entry; the unlock recovery form posts code (typed) + new PIN (pad) to the recover route; the
  set sheet's two pads drive the match validation and post to the set route, showing the
  recovery sheet; the gate recovery form's pads + typed code post to the recover route.
- Sibling regression: harness-v584's functional legs on the clean tree.

## §3 Implement

On release/v587 (base 934781f). The change is confined to `app/worker/src/client.ts`,
exactly as planned in §2:

- **The pad factory** (`opnPinPadHtml` / `opnPinPadBind`, before the unlock card): the gate's
  dots + pad markup and classes under an id prefix, per-instance entry state, the gate's entry
  discipline (digits only, at most 8, dots from 4, optional submit enable at ≥4).
- **Vault unlock card:** the typed `#opn-unlock-pin` field retires; the pad (prefix `opn-unlock`,
  with the gate's hint line) stands over the standing Unlock button, which now starts disabled
  and enables at 4 digits. `opnBindUnlockCard` reads the pad entry at the standing verify
  handler and clears the entry on a failed verify; routes, bodies, messages, the biometric /
  passkey buttons, and the success handling are unchanged. The recovery sub-form's new PIN
  takes a pad (prefix `opn-rec`); the recovery code stays a typed text field.
- **Gate recovery form:** `#rec-pin1` / `#rec-pin2` retire for two pads (prefixes `rec1` /
  `rec2`); the standing match + format validations read the pad entries; the code stays typed.
- **PIN set/change sheet:** `#ps-pin1` / `#ps-pin2` retire for two pads (prefixes `ps1` /
  `ps2`); Save reads the pad entries; routes and the recovery-code showing are unchanged.
- `renderPinGate` and the whole gate slice stand byte-identical; no vault or PIN machinery
  line moved (harness S6/S7); index.ts and ui.ts stand byte-identical.

Harness (harness-v587.mjs): **39 ok / 0 not ok** on the working tree — S-legs (confinement,
migrations, pin unmoved, index/ui byte-identical, gate slice byte-identical, no machinery line
touched, no typed PIN field left, recovery codes stay typed), R-legs (rendered client parses
whole; the v584 dress stands), and L-legs driving the real rendered code in fake-DOM vm worlds:
the unlock pad unlocks through the standing verify route with the entered PIN; a wrong PIN
fails with the standing message and clears the entry; the pad discipline (cap 8, back key,
submit gating); the unlock recovery form posts typed code + pad PIN to the recover route; the
gate recovery form and the set sheet drive their match validations and post to the recover /
set routes, each showing the fresh recovery code once.

## §4 Review (light, streamlined path)

The whole diff re-read (client.ts: 75 insertions / 18 deletions in 5 hunks — the factory, the
unlock card's HTML + bind, the gate recovery form, the set sheet — plus harness-v587.mjs and
this doc). Findings:

- **Against the approval:** Q1 A stands — the pad is the unlock screen's PIN entry and the
  typed field is gone from that screen. Q2 A stands — the pad also stands on the unlock
  recovery new-PIN, the gate recovery form, and the set/change sheet; the recovery-code inputs
  stay typed on both recovery forms. Nothing beyond the picks was built: no route, body,
  message, or success/error path changed anywhere.
- **Behavior invariance, proven not just inspected:** the gate slice (renderPinGate through
  submitPinVerify) is byte-identical to base (S6); no added/removed line touches a vault or
  PIN-machinery symbol (S7); index.ts and ui.ts are byte-identical (S4/S5). The same PIN
  verifies through the same route — John's vault is neither migrated nor reset by this change.
- **Harness on the committed tree:** harness-v587 **39 ok / 0 not ok** on a clean checkout of
  50ffeb8 (and on the working tree before commit). Sibling regressions on the same tree:
  harness-v585 **41 ok / 1 not ok** — the one failure is its own S1 confinement leg reading
  this release's file set; every functional leg (fold, card, Q3 rule) passes. harness-v584
  **14 ok / 3 not ok** — its S1/S3 confinement legs reading this release's deliberate client.ts
  change, and its R11, which asserted the pre-v587 fact ("the vault unlock paints no pad")
  that Q1 A deliberately reverses; all of v584's dress legs (R1–R10) pass, so the large dress
  the pads wear stands exactly as v584 built it.
- **Noted, not defects:** the recovery submit buttons now enable at ≥4 pad digits (the gate's
  standing discipline) where the typed forms validated on click; the entry clears after a
  failed unlock verify, as the gate's does. Both are the pad component's own behavior, carried
  with it as approved.
- Historical browser tests under app/tests (v353/v354/v356/v373) still reference the retired
  typed-field ids; they are per-release artifacts of their own shapes and are not gates for
  this tree — named here rather than silently left.

Verdict: **pass** — ready to ship.
