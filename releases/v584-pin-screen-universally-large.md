# v584 — PIN screen universally large

## §1 Scope

John's direction (main chat, 2026-11-21 10:53 CT): "Make the pin screen universally large."
Approved (Ora thread, 2026-11-21 11:31 CT; Scope package 74, Q1 A · Q2 To Ship):

- The PIN pad renders FULL LARGE everywhere it stands: keys 88px · digits 30px · PIN dots 18px · hint text 19px.
- On narrow phones the pad scales to the row width and keeps its proportions.
- PRESENTATION ONLY — PIN behavior, the v578 vault machinery, and where a PIN is required do not change.

Grounding at Scope (served stylesheet, 2026-11-21): keys 64px circles · digits 20px · dots 14px · hint 17px.

## §2 Plan (compressed, streamlined path)

### Component finding — ONE shared pad, ONE dress

- **One painter:** `renderPinGate` (client.ts) emits the only `.pinpad` / `.pindots`
  markup in the app. Its callers: the Conscience gate, the Settings-section gate
  (the gate flow, Settings "enter PIN", the expired-session re-gate, and Back
  from the recovery form). No other surface paints a pad.
- **One dress:** `APP_CSS` in ui.ts, served at `/styles.css` — `.pingate .lockline`
  (the hint, 17px), `.pindot` (14px), `.pinpad` grid (3 × 76px columns),
  `.pinpad button` (64px keys, 20px digits). A repo-wide search finds no second
  pinpad/pindot definition in any .ts/.css/.html/.js file.
- **The v578 vault unlock paints no pad:** `opnUnlockCardHtml` takes a typed PIN
  in a password field; the recovery form and the PIN set/change sheet are typed
  fields too. There is no per-surface pad to dress separately — the one dress
  change reaches every pad surface, in the phone app and the installed PWA,
  which share the same served client and stylesheet.

### The change (ui.ts, APP_CSS only — no JS, no behavior)

- `.pinpad button`: width/height 64px → **88px**; font-size 20px → **30px** (digits).
- `.pinpad`: grid columns 76px → **88px**.
- `.pindot`: 14px → **18px**; `.pindots` min-height 16px → 20px so the row holds the larger dots.
- `.pingate .lockline` (hint): 17px → **19px**.
- Narrow phones: `@media (max-width:340px)` — `.pinpad` columns become `1fr`
  across the full row width; buttons take `width:100%; height:auto; aspect-ratio:1`,
  so the pad scales to the row and keeps its proportions.

### Proof (harness-v584, rendered client, clean checkout)

- The rendered stylesheet carries each large value (88px keys, 30px digits,
  18px dots, 19px hint) and the narrow-phone scaling rule; the old values are gone.
- The rendered client parses whole.
- The PIN still verifies: the gate's verify path and the vault unlock path run
  in the harness against the rendered client (the dress touched no behavior).
- Sibling regression: a standing sibling harness passes its functional legs.
