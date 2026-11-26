# v692 — Starter profiles + today/standing edit toggle

- **Status:** Implement complete (§3 written; harness-v692 64/0 at Implement, 72/0 after the Light Review repair in §3.1/§3.4; NOT merged or deployed — Review next; the ship merge waits for v691)
- **Base:** remote main `19cc5c2` = production pin `ora-pro-nobis-v688-1`
- **Implement rebase note:** v692 Implement rebases on post-v691 main (§2.8 re-diff list)
- **Implement base (as built):** rebased onto `origin/main` `7e85dea` (v693 ship; v690 + v693 stand on it). v691 has NOT landed — it builds in parallel; no v691 seat stood in the rebased tree to re-diff (its source-menu seats are absent from this tree), and no v692 seat depends on one. Every §2.8 seat was re-diffed at its post-v690/v693 shape before building; the v690 frequency fields (`opnItemPaints690`/`opnSetItemDay690` — in this tree the dayRule carriage in `opnCheckContents590` / `validateProfileContents` + the row menu) and the Move envelope (`opn686MoveWrite` / `parseMoveEnvelope686`) are untouched.

## §1 Scope

### 1.1 Direction (John, 2026-11-26 08:50 CT, verbatim)

> "Change the 3 default profiles as starter profiles that can be used at station or to reset your profile or anytime a profile is added. Take them off as normal methods. Also use a toggle for today or standing edit vs. the button"

### 1.2 Clarification (John, 2026-11-26 08:51 CT, verbatim)

> "Startup meaning new profile"

### 1.3 Settled reading (not re-litigated)

- The three honor-named defaults — The Little Way · The Salesian Way · The Benedictine Way — stop being ordinary selectable profiles.
- They leave the Edit form's pick chips and every normal profile list.
- They become STARTER templates at three seats:
  - (a) starting a NEW profile (startup — including first run's first profile; add flow and startup flow are one shape: pick a starter)
  - (b) RESETTING a profile (reset replaces the current profile's shape with a chosen starter's)
  - (c) ADDING a profile (starts from a chosen starter)
- A starter used becomes the person's OWN profile: a copy under their control. Defaults stay pristine; edits save as the user's own copy with required rename on save (standing discipline).
- The starters themselves never change and never stand as the standing pick as themselves.
- Honor-naming stands: starters must NOT claim they are those groups' own routines. Grounded honor line: `client.ts:2770` — every seed record carries `honorLine: "named in honor of the tradition, not the order's own routine"`.
- The today/standing edit switch becomes a two-state TOGGLE (Today | Standing) replacing the "Edit standing instead" / "Edit today instead" button in the Edit form head.

### 1.4 Boundaries

- No app code in Plan. This doc only.
- No change to contents validators' item rules, the today-layer fold (`opnApplyTodayLayer594`, `client.ts:3421`-area), or day composition, except where §2 names a seat.
- No change to John's own profile "Daily" (§2.3 — untouched by construction and by migration keying).
- Web mode stands as-is: personal data lives on device; the server store seats in `index.ts` get the mirror prescriptions named in §2.1/§2.3.

## §2 Plan

### 2.1 Starter store + enumeration seats

#### 2.1.1 Where the three Ways stand today

- **Client seed (the designed defaults):** `OPN_SEED_PROFILES`, `app/worker/src/client.ts:2770`. One-line records, `kind: "default"`, NO `contents` field (the designed defaults store no contents):
  - `little-way` — "The Little Way" — coreBlocks `[Morning, Night]` — layers: novenas `on:false`; podcasts `on:false, series:[]`
  - `salesian` — "The Salesian Way" — coreBlocks `[Morning, Midday, Evening, Night]` — layers: novenas `on:true`; podcasts `on:true, series:[bible-in-a-year, exorcist-files, daily-gospel-exegesis, daily-readings]`
  - `benedictine` — "The Benedictine Way" — coreBlocks `[Morning, Midmorning, Midday, Afternoon, Evening, Night]` — layers: novenas `on:true`; podcasts `on:true, series:[daily-readings]`
- **Server mirror (Reset fixtures):** `DESIGNED_PROFILES_591`, `app/worker/src/index.ts:1488-1492` — same keys/names/coreBlocks, layers in stored form (`on: 0|1`).
- **Layer caveat (grounded):** the Podcasts layer shape in the seed is pre-v609. `opnMigrateProfiles609` (`client.ts:2935`) / `opnMigrateProfileRecord609` (`client.ts:2967`) force `layers.podcasts.on=false, series=[]` on every record and move a standing series into CONTENTS (readings seat → Morning seat item; other series → `course` items in Night). A starter's effective shape is therefore: seed record + `opnMigrateProfileRecord609` applied — exactly the transform the standing Reset route already applies after restoring a designed record (client reset route, `client.ts:3792`-area; §2.4). Novena layer stands as seeded: off in Little Way, on in Salesian/Benedictine (all-or-nothing, one boolean — `opnCheckLayers`, `client.ts:3270`-area).
- **Prescription:** `OPN_SEED_PROFILES` (client) and `DESIGNED_PROFILES_591` (server) REMAIN the starter definitions, unchanged. They stop being store records; they become the template source read by the three starter seats (§2.2 startup, §2.4 reset, §2.5 add). No new store is created.

#### 2.1.2 Every enumeration seat that offers the Ways as profiles today

| # | Seat | Citation | Change |
|---|------|----------|--------|
| 1 | Edit-form pick chips (the screenshot's chips row) — `opnPickHead609` iterates `res.profiles` whole | `client.ts:27383` (paint), wiring `data-p609pick` → `opnPickInForm609` `client.ts:27402` | Chips iterate OWN profiles only. Ways never appear: they leave the payload list (§2.1.3), so no chip-side filter is needed; Implement must not add a kind filter as a substitute for the store change. |
| 2 | Standing-pick sheet — `opnOpenPickEdit604` chips over `res.profiles` | `client.ts:25086` | Same: own profiles only, by payload. |
| 3 | Edit-today screen chips — `data-p594tchip` over `res.profiles` in `openEditTodayScreen594` | `client.ts:25271`-area (screen), paint in its `paint()` | Same payload consequence. NOTE: this screen is UNREACHABLE since v607 (its Configure-ladder doors retired — `openConfigureLadder593`, `client.ts:25223`, carries the retirement comment). No separate work; the payload change covers it. |
| 4 | Client payload — `opnProfilesPayload` maps `P.list` whole into `profiles[]` | `client.ts:3242` | Payload lists own profiles only, because the store list holds own profiles only (§2.1.3). |
| 5 | Server payload — `profilesPayload` maps `store.profiles` whole | `index.ts:1584` | Mirror of #4. |
| 6 | Resolution fallback — `opnResolveProfile590` falls back to `P.list[0]`; server `profileResolve` falls back to `store.profiles[0]` | `client.ts:3008`-area; `index.ts:1492`-area | Fallback now lands on the first OWN profile. With an empty own list the client payload already reads `{profiles: [], state: null, effective: null}` (`client.ts:3243`). §2.2 governs that state. |
| 7 | Delete fallback — deleting the standing custom re-points `standingKey = 'salesian'` | client delete route `client.ts:3818`-area; server delete route `index.ts:5507`-area | MUST CHANGE: `'salesian'` will name no store record. New fallback: first remaining own profile; if none remains, the §2.2 startup state (no pick). |
| 8 | Default seeding at first run — `opnDefaultDoc` | `client.ts:1629` | §2.2. |
| 9 | Configure ladder — `openConfigureLadder593` | `client.ts:25223` | NO enumeration today: the ladder carries only a head line ("Today follows <name>") and the v607 word; its Edit doors retired in v607. No change. |
| 10 | Reset/Delete menu gating — `opnProfileMenu607` shows Reset only for `kind === 'default'`, Delete only for `kind === 'custom'` | `client.ts:25053` | §2.4 (Reset re-gates to own profiles). |

#### 2.1.3 The store change (prescription)

- On migration (§2.3) and at first run (§2.2), the profiles store list (`sections.profiles.list` on device — `opnDoc`, `client.ts:1644`-area; `prayer_profiles` rows via `prayerProfileStore`, `index.ts:1266`, on the server) holds OWN profiles only (`kind: "custom"` records).
- The three designed records leave the list. Their definitions survive only in the two constants (§2.1.1).
- Standing-pick validation seats keep their shape and now refuse a default key by construction: client state route requires `findP(body.standingKey)` (`client.ts:3708`); server state route requires `store.profiles.some(p => p.key === body.standingKey)` (`index.ts:5271`). No validator change needed.
- Contents validators are untouched by the store change: client `opnCheckContents590` (`client.ts:3035`); server `validateProfileContents` (`index.ts:1357`) + `validateProfileContents686` (`index.ts:1476`); `prayerProfileStore` re-validates stored contents through `validateProfileContents686` at `index.ts:1307`.

### 2.2 First run / startup

#### 2.2.1 What stands today (grounded boot path)

- `opnDoc()` (`client.ts:1644`-area): no stored document → `opnDefaultDoc()` → `opnMigrateProfiles609(...)` → `opnSave()`.
- `opnDefaultDoc` (`client.ts:1622`): `profiles: { list: opnClone(OPN_SEED_PROFILES), standingKey: 'salesian', version: 1, mig590: true, mig604: true, todayEdits: {} }`.
- Consequence today: a fresh install composes the Praylist from The Salesian Way at once. No offer, no pick, no own profile exists. The Salesian seed IS the standing pick (`standingKey: 'salesian'`).

#### 2.2.2 Prescribed new flow

- **Salesian seed: RETIRED as a standing pick; RE-EXPRESSED as the pre-highlighted starter** in the startup offer. No store is ever born with `standingKey` naming a default key.
- `opnDefaultDoc` is born with `list: []`, no standing pick (`standingKey: null`), `mig692: true` (§2.3 key), `todayEdits: {}`. (Payload with an empty list already reads `state: null, effective: null` — `client.ts:3243`.)
- **Before any pick, the startup offer stands first:** on first paint with an empty own list, the Praylist home stands the starter offer (the three starters, Salesian pre-highlighted, each with its honor line) in place of the set — not an empty Praylist behind a dismissible sheet. The offer is the first-run surface; there is no profile to compose until a starter is picked.
- **The pick becomes the first OWN profile:**
  - Mint through the standing save-new machinery (no-key branch of the save route: client `client.ts:3745`-area; server `index.ts:5455`-area): record built from the starter template (seed shape + `opnMigrateProfileRecord609`), `kind: 'custom'`, contents as migrated (the designed defaults themselves store no contents — §2.1.1 — so the mint carries contents only where mig609 lands them).
  - Name: the rename discipline governs — `openRenameCopySheet590` (`client.ts:25160`) requires a non-empty name; an empty name completes nothing. Prescription: the starter pick opens that sheet PRE-FILLED with the Way's name (the sheet already takes a `suggested` name parameter), editable; the given name is the profile's name; its key is the standing slug mint (name slugified, `-2`, `-3`… on collision — save route, both sides). A name left as the Way's name is valid: its slug (`the-salesian-way`) is not a default key, so the record is an own profile, never the template.
  - After the mint: `standingKey` := the new key (the state route, `client.ts:3705`-area / `index.ts:5269`-area), and the Praylist composes from it.
- **OPEN-1 (name prompt at startup):** the direction does not name whether startup asks a name. Default recommended: YES — the pre-filled rename sheet above (one extra tap; consistent with the standing rename-on-save discipline; a skipped prompt would mint a profile named exactly as a Way, inviting confusion with the template). Implement follows the default unless John rules otherwise before Implement.

### 2.3 Migration

#### 2.3.1 John's "Daily" — untouched

- "Daily" is John's own profile: `kind: 'custom'`, its key is a save-mint slug, NOT one of `little-way | salesian | benedictine`.
- The standing pick names that key. Every migration leg below keys ONLY on `kind === 'default'` / key ∈ the designed set. "Daily" matches neither, and its record and the pick stand byte-identical. (Harness leg §2.9 proves it.)

#### 2.3.2 A device whose standing pick IS one of the three Ways

- **Landing (prescribed): an own-profile copy is minted from that Way AS IT STANDS on the device** (its current coreBlocks/layers/contents — including any edits John made to the Way under the v591 direct-edit model), and the pick re-points at the copy. No shape is lost; no pick is left pointing at a template.
- Mint shape (precedent: mig590's preserved copy, `opnMigrateProfiles590`, `client.ts:2884`-area — a differing default was preserved whole as a custom `"<Name> — as found"` with a slug key deduped against taken keys):
  - `kind: 'custom'`; record cloned whole from the standing Way record.
  - Name: the Way record's current name (unchanged — the template leaves the list, so no name collision stands).
  - Key: slug of the name + `-own`, deduped `-2`, `-3`… against taken keys (e.g. `the-salesian-way-own`). Never a default key.
  - `standingKey` := the new key.
  - `todayEdits` entries whose `baseProfileKey` names the old default key are re-pointed to the new key (grounded need: `opnCheckTodayLayer594`, `client.ts:3515`-area, refuses a layer whose `baseProfileKey` finds no profile; the payload carries `todayEdit` per date from the same map).
- **Non-picked Ways:** a default record that is NOT the standing pick is simply removed from the list. Its definition survives in the starter constants (§2.1.1); nothing of the user's is lost — a non-picked default's edits, if any, are NOT preserved. **OPEN-2:** default recommended: remove without a copy (the direction takes the Ways off as profiles; preserving every edited-but-unpicked Way would re-list them as own profiles unasked). Flagged for John's word at Review if he wants as-found copies for edited non-picked Ways (mig590 precedent exists).
- **Key discipline (one-time, silent):** a `mig692` flag on the profiles section, run in the `opnDoc()` load chain beside the standing flags (`client.ts:1660`-area runs mig590 → mig604 → mig609, each persisting via `opnSave()` when it fires). Same family as `mig590`/`mig604`/`mig609` doc flags; the `opnOfficeMig670` localStorage key (`OPN_OFFICE_MIG_KEY670 = 'opn-office-mig-v670'`, `client.ts:2214`) is the other standing one-time precedent. Server mirror: the same transform at the `prayerProfileStore` seat (`index.ts:1266`) guarded by a one-time state flag — **OPEN-3:** server D1 has no mig-flag column today (`prayer_profile_state` carries `standing_key, day_rule, version, today_edits` per `index.ts:1319`-area reads); default recommended: run the server transform keyed on presence of any `kind='default'` row (idempotent by construction — after one run no default rows stand), no schema change.
- After migration, ALL default records leave the list (picked Way replaced by its copy; others removed).

#### 2.3.3 A saved own profile originally copied from a Way — unaffected

- Such a profile already stands as `kind: 'custom'` under a slug key minted by Save New (save route no-key branch). The migration keys on default kind/keys only. It is not the template, is not re-based, and its contents stand. Confirmed unaffected.


### 2.4 Reset

#### 2.4.1 What Reset does today (grounded)

- Seat: the Edit form's profile ⋮ overflow — `opnProfileMenu607` (`client.ts:25053`). Items: "Configure plan" (all profiles) · "Reset to Default" ONLY when `rec.kind === 'default'` · "Delete profile" ONLY when `rec.kind === 'custom'`. So today Reset does not exist for an own profile at all.
- Arm: two-tap — first tap sets `opn604.arm607 = 'reset'` and re-paints the menu as "Tap again to reset"; second tap fires (same pattern for delete, `arm607 = 'delete'`).
- Route: client reset route (`client.ts:3792`): refuses unless `rp.kind === 'default'` and the key names a seed record ("only the named ways carry a designed default"); restores `name`, `honorLine`, `coreBlocks`, `layers` from `OPN_SEED_PROFILES`, DELETES `rp.contents`, then runs `opnMigrateProfileRecord609` so the restored record lands in the migrated (contents) shape. Server mirror: reset route `index.ts:5472`-area against `DESIGNED_PROFILES_591`, same refusal.
- Net today: Reset = "return THIS Way to its designed shape; saved and draft edits alike discarded" (route comment). The profile's key and the standing pick (by key) do not move.

#### 2.4.2 Prescribed new flow

- Reset stands in `opnProfileMenu607` for OWN profiles (the only profiles that exist post-§2.1) — the `kind === 'default'` gate retires; Delete's `kind === 'custom'` gate becomes unconditional.
- Flow: Reset (armed, §2.4.3) → STARTER PICK (the three starters from `OPN_SEED_PROFILES`, each with honor line) → the current profile's shape is replaced by the chosen starter's shape.
- Route change: the reset route takes `{profileKey, starterKey}`; `starterKey` must name a seed record; the target may be any standing (own) profile. Server mirror identical against `DESIGNED_PROFILES_591`.
- **REPLACES:** `coreBlocks` ← starter's; `layers` ← starter's; `contents` ← deleted, then `opnMigrateProfileRecord609` applied to the restored record (the exact standing reset transform, `client.ts:3792`-area) so the starter's series land as contents.
- **PRESERVES:** the profile's `key` (identity — the standing pick points by key, so the pick is preserved by construction and never re-pointed); the profile's `name`; the profile's `honorLine` (own-profile identity fields — the starter's honor line belongs to the template, not to John's profile); `todayEdits` (their `baseProfileKey` still finds the profile, by the preserved key); every other profile in the list.
- Session bookkeeping after the write: the standing menu act already resets `opn604.lists/base/removed` and re-seeds the shape (`opnInitShape607`) on reset (`client.ts:25072`) — keep.

#### 2.4.3 Two-tap arm: KEEP

- The two-tap arm stands, unchanged in shape: first tap arms (`arm607 = 'reset'`, "Tap again to reset"), second tap opens the starter pick; the pick itself is the confirming act. No third confirmation.

### 2.5 Add a profile

#### 2.5.1 Save New / add today (grounded)

- There is NO add-a-profile act today other than Save New. `opnSaveNew604` (`client.ts:24890`): enabled only after a write in the form (`opn604.wrote`; the Save New button in `opnEditBarHtml604`, `client.ts:24789`, paints `disabled` until then); opens `openRenameCopySheet590` (name REQUIRED — empty name completes nothing, `client.ts:25160`); mints the COMPOSED DAY (resolved profile + today layer folded via `opnApplyTodayLayer594`, `client.ts:3421`) through the save route's no-key branch (client `client.ts:3745`; server `index.ts:5391`-area — slug key from the given name, `kind: 'custom'`, opened profile byte-identical); then clears today's layer and switches the standing pick to the mint.
- **Empty start: NONE exists.** No route, menu act, or sheet mints a profile from nothing; every mint copies a standing shape (Save New ← composed day; mig590 copies ← as-found records). Searched seats: save / reset / delete / state / layers / today-edit routes, both sides — no blank mint stands.

#### 2.5.2 Prescribed new flow

- NEW Add act (seat: `opnProfileMenu607`, beside Configure plan — the form's standing profile-acts menu): "Add profile" → STARTER PICK (the three starters) → rename sheet pre-filled per §2.2.2 → mint from the starter template (seed shape + `opnMigrateProfileRecord609`, `kind: 'custom'`, slug key from the given name) through the save route's no-key branch with the template as the payload's shape (no `basedOn` default record — the payload carries the starter's coreBlocks/layers/contents directly).
- After the mint, normal editing: the new profile opens in the Edit form. **OPEN-4:** whether Add also switches the STANDING PICK to the mint — Save New precedent switches (`opnSaveNew604` writes `standingKey: mint.key`). Default recommended: YES, switch (one precedent, one behavior; the form then edits the profile it just made, in standing scope after the §2.6 toggle is set to Standing).
- **Empty start fate: does not survive — it never existed, and none is created.** John's word names starters as the base whenever a profile is added; no blank-start seat is prescribed anywhere (startup, add, reset all start from a starter).
- Save New stands unchanged: it is a copy-of-current act, not an add-from-base act. **OPEN-5:** if John reads "anytime a profile is added" to cover Save New too, Save New would gate on a starter pick and lose its copy semantics. Default recommended: Save New exempt (named here so the reading is John's to overrule, not Implement's to guess).

### 2.6 The today/standing toggle

#### 2.6.1 The band + button today (grounded)

- Builder: `opnBannerHtml604` (`client.ts:24774`), painted in the Praylist assembly directly under the plan row (`paintPrayersView`: `profPlanRowHtml(day) + opnBannerHtml604() + opnEditBarHtml604()`, `client.ts:27326`).
- Paint per scope: today → line `Editing today only — <opnDateLabel604(date)>`; standing → `Editing standing — in <effective.name>, your every-day profile`. Button (`data-p604change`, wired `client.ts:23940`-area) names the scope it flips TO: "Edit standing instead" / "Edit today instead".
- Flip: `opnFlipScope609` (`client.ts:24796`) — sets `scopeSwitched = true`, RESETS the session (`opn604.lists = {}; base = {}; removed = {}`), toggles `opn604.scope`, `wrote = false`, re-seeds the shape (`opnInitShape607`, `client.ts:24928` — standing shape from the profile record; today shape from the profile + `res.todayEdit` layer), repaints.
- Entry: `opnEnterEdit607` (`client.ts:24948`) opens the form on TODAY scope at every entry (v609 repair 2 — no remembered scope, no entry question).
- **Write timing (the load-bearing fact): the live Edit form writes AT ONCE.** Contents acts write through `opnWrite604` (`client.ts:24247`) and shape switches through `opnWriteShape607` (`client.ts:24977`) at the act, to the today layer (today-edit route) or the profile (save route) by scope. There is NO pending draft in the live form. The banner itself says so after a flip: when `scopeSwitched`, its second line reads "Acts already written stand where they were written." (`opnBannerHtml604`).
- **The draft-until-Save-today discipline stands in a different, unreachable seat:** `openEditTodayScreen594` (v600 draft {pick, td, cleared}; frozen Save today bar `data-p600savetoday`, `client.ts:25303`-area; close prompt Save today · Discard · Stay) — its doors retired in v607 (`openConfigureLadder593` retirement comment, `client.ts:25223`). It is not the form the screenshot shows and the toggle does not resurrect it.

#### 2.6.2 Prescribed toggle

- Replace the `data-p604change` BUTTON in `opnBannerHtml604` with a two-state segmented toggle (Today | Standing), same seat in the banner row, active state = `opn604.scope`. A tap on the inactive state calls the standing flip (`opnFlipScope609` semantics, unchanged); a tap on the active state does nothing.
- Repaints per state (the banner line, unchanged words): Today → `Editing today only — <date>`; Standing → `Editing standing — in <name>, your every-day profile`. The `scopeSwitched` second line stands as today.
- **Dirty-draft rule: KEEP the grounded behavior, verbatim.** Flipping carries NO unmaterialized session state across (lists/base/removed reset, shape re-seeds from the target scope's stored shape) and loses NOTHING written — because the live form writes at once, there is no unsaved draft to discard or carry, in either scope, in either direction. No change is prescribed; naming one would invent a draft the form does not hold.
- **Save today seat — confirmed:** no Save today button stands in the live Edit form in either toggle state, and none is added. The form's bar is `opnEditBarHtml604` (Save New · ⋯ · Done, `client.ts:24789`) in both states. The frozen Save today button stands only in the retired Edit-today screen (§2.6.1). **OPEN-6:** if John expects a Save today act in the live form, that is a scope change beyond this direction (it would reverse the v607/v609 at-once form) — default recommended: NO Save today in the live form; the toggle is a pure scope switch.

### 2.7 Head line + notes

- Plan-row head builder: `profPlanRowHtml` (`client.ts:25122`) — `<h3><fold.name></h3>` + meta `Your every-day profile` + ` · today has its own edits` when `fold.todayEdits`. The fold's name IS the standing pick's profile (`profileFoldOf`, `index.ts:1549`-area; client fold in the day payload).
- Chips-row note builder: `opnPickHead609` (`client.ts:27383`) — under the chips, when `res.todayEdit`: `today has its own edits — changing the profile clears them`. The same words stand in the pick sheet (`opnOpenPickEdit604`, `data-p604pickwarn`, `client.ts:25098`) and the block today-mark reads the same fact (`opnBlockTodayMark604`, `client.ts:24171`).
- The clearing rule behind the note is real in code: a chip tap (`opnPickInForm609`, `client.ts:27402`) and the pick sheet's Save both write `today-edit {layer: null}` BEFORE writing the new `standingKey`.
- **Prescription:** wording UNCHANGED in all three seats. What changes is only what the words range over: the chips carry own profiles only (§2.1.2 #1), so "changing the profile" now always names an own→own switch; the plan-row head always names an own profile (post-migration the pick cannot name a template). No builder edit beyond the payload change.

### 2.8 Re-diff list for Implement (rebase on post-v691 main)

Implement must re-diff each seat below at its post-v691 shape before building — v690 (per-item frequency in contents) and v691 (source-row Move-to-block) both touch the Edit form, and v692 touches the same form:

- Chips builder: `opnPickHead609` (`client.ts:27383`) + its wiring (`data-p609pick`, `client.ts:23928`-area) + `opnPickInForm609` (`client.ts:27402`).
- Band/banner builder: `opnBannerHtml604` (`client.ts:24774`) + flip `opnFlipScope609` (`client.ts:24796`) + entry `opnEnterEdit607` (`client.ts:24948`) + shape seed `opnInitShape607` (`client.ts:24928`).
- Edit bar + menu: `opnEditBarHtml604` (`client.ts:24789`), `opnProfileMenu607` (`client.ts:25053`), `opnSaveNew604` (`client.ts:24890`), `openRenameCopySheet590` (`client.ts:25160`).
- Contents-row seats v690/v691 land on: `opnContentsRowHtml687`, `opnSpliceSourceRows686`, `opnOpenSourceMenu687`, `opnMove686` / `opnMove684` and the `opn686MoveWrite` envelope in `opnWrite604` (`client.ts:24247`) — the toggle/reset/add work must not disturb the Move envelope or the frequency fields.
- Contents validators: client `opnCheckContents590` (`client.ts:3035`); server `validateProfileContents` (`index.ts:1357`) + `validateProfileContents686` (`index.ts:1476`) + `parseMoveEnvelope686` (`index.ts:1460`-area).
- Profile store seats: client `opnDoc`/`opnDefaultDoc` (`client.ts:1644`/`1622`), migration chain (mig590 `client.ts:2881` · mig604 `client.ts:2919` · mig609 `client.ts:2935`), `opnProfilesPayload` (`client.ts:3242`), `opnResolveProfile590` (`client.ts:3008`), profile routes in `opnLocalApi` (state `client.ts:3705` · save `client.ts:3745` · reset `client.ts:3792` · delete `client.ts:3810`-area · today-edit `client.ts:3725`-area); server `prayerProfileStore` (`index.ts:1266`), `profilesPayload` (`index.ts:1584`), `profileResolve` (`index.ts:1492`), `DESIGNED_PROFILES_591` (`index.ts:1488`), profile routes (state `index.ts:5264` · save `index.ts:5391` · reset `index.ts:5472` · delete `index.ts:5496`).

### 2.9 Harness prescription — `app/worker/harness-v692.mjs` (for Implement)

- Fixtures from production shapes ONLY: (F1) John's "Daily" profile as the own-profile fixture (custom kind, slug key, his standing pick, with a today layer standing); (F2) a fresh-install state (no stored document); (F3) a Ways-pick device state (standing pick = `salesian`, the default records standing in the list, one today layer based on `salesian`); (F4) a copied-from-a-Way own profile standing beside the defaults.
- Legs:
  1. Chips/list carry no Ways: after migration, `profiles[]` in both payloads (client `opnProfilesPayload` shape + server `profilesPayload` shape) contains no `kind: 'default'` record and no default key; `opnPickHead609` output names no Way.
  2. Startup: F2 offers exactly the three starters (names + honor lines, Salesian pre-highlighted); the pick mints an own profile — `kind: 'custom'`, key NOT in {`little-way`, `salesian`, `benedictine`} — and `standingKey` names the mint; the Praylist resolves to it.
  3. Reset: on F1, Reset → starter pick (Benedictine) replaces coreBlocks/layers/contents with the starter's (post-mig609) shape and PRESERVES key, name, honorLine, the standing pick, and the today layer.
  4. Add: Add → starter pick (Little Way) mints an own profile of the starter's shape under the given name; no default key is created; no empty-start mint exists (the add flow cannot complete without a starter).
  5. Ways-pick migration: F3 migrates once (`mig692`) — the picked Way's AS-STANDING shape (coreBlocks/layers/contents) is preserved whole on the minted copy, `standingKey` re-points at the copy, the today layer's `baseProfileKey` re-points at the copy, the other defaults leave the list, a second load changes nothing (one-time).
  6. F4 unaffected: the copied-from-a-Way own profile stands byte-identical after migration.
  7. Toggle: in the Edit form, the toggle flips the edit target both ways (banner line + write route change: today → today-edit route, standing → save route); flipping after a written act keeps that act where it was written (the grounded §2.6.2 rule — written acts stand, session lists reset, no draft is carried or lost); no Save today button paints in either state.
  8. John's untouched Daily: on F1 with NO migration trigger (pick already own), the day composition for a weekday and a Sunday is byte-identical before/after the v692 build.
- Regression harnesses to re-run at their shipped tallies, on the post-v691 base: harness-v687 (42/0) · harness-v688 (65/0) · harness-v690 (its shipped tally) · harness-v691 (its shipped tally).

### 2.10 Open points index

- OPEN-1 (§2.2.2): startup name prompt — default: pre-filled rename sheet, name required.
- OPEN-2 (§2.3.2): edited non-picked Ways removed without a copy — default: remove.
- OPEN-3 (§2.3.2): server migration guard — default: idempotent transform keyed on any default row standing; no schema change.
- OPEN-4 (§2.5.2): Add switches the standing pick to the mint — default: yes (Save New precedent).
- OPEN-5 (§2.5.2): Save New exempt from the starter base — default: exempt.
- OPEN-6 (§2.6.2): no Save today in the live form — default: none added; toggle is a pure scope switch.

## §3 Implement (2026-11-26)

Built on `release/v692` over `7e85dea`. Approval of record (John, 2026-11-26 09:20–09:21 CT): Q1–Q10 all at option A, run level To Ship, plus the W correction (detailed Benedictine for web users only). Where the Plan and the design document differ, the document governed; every such difference is named in §3.2.

### 3.1 Seats changed (citations at the built tree)

**Starter store + first run (§2.1, §2.2; item A/B of the brief)**
- `OPN_SEED_PROFILES` (client.ts:2770) and `DESIGNED_PROFILES_591` (index.ts:1607) stand unchanged as the template constants. No kind filter was added at any enumeration seat — the Ways leave by payload, because the store list holds own profiles only.
- `opnDefaultDoc` (client.ts:1622): born with `list: []`, `standingKey: null`, `mig692: true`, `todayEdits: {}`. No store is born with a pick naming a default key.
- `opnStarterRecord692` (client.ts:3015): a starter's effective shape — seed clone + `opnMigrateProfileRecord609` — read by all three starter seats and the web display.
- `opnProfilesPayload` (client.ts, payload builder): profiles map + effective now carry `startedFrom` when it stands. Server mirror: `profilesPayload` (index.ts:1708) and `profileFoldOf` (index.ts:1651) carry `startedFrom` the same way (it rides the layers JSON beside contents — no schema change).
- Resolution fallbacks (`opnResolveProfile590` · `profileResolve`) are unchanged in shape and now land on the first OWN profile by construction; the empty-list payload already read `{profiles: [], state: null, effective: null}`.

**Migration (§2.3; item C)**
- Client: `opnMigrateProfiles692` (client.ts:3027), run in the `opnDoc()` load chain after mig609, one-time on the `mig692` flag. Keyed ONLY on `kind === 'default'` records naming a seed key. The standing Way is preserved whole as an own copy (clone, `kind: 'custom'`, name unchanged, key = slug + `-own` deduped, `startedFrom: '<way-key>'`), standing in the Way's list position; `standingKey` re-points; `todayEdits` entries with `baseProfileKey` = the Way re-point to the copy. Non-picked Ways are removed without a copy (OPEN-2 default — §3.2). A standing key naming nothing after the pass falls to the first own profile, else null. John's "Daily" and any copied-from-a-Way own profile are untouched by construction (harness legs L1/L5/L6).
- Server: `migrateStore692` (index.ts:1299, a pure transform over the store shape) applied and persisted inside `prayerProfileStore` (index.ts:1342, application at :1418) — idempotent, keyed on any designed default row standing (OPEN-3 default; no schema change). The copy INSERT takes the Way's `sort_order`; contents + `startedFrom` ride its layers JSON.

**Delete fallback (§2.1.2 #7)**
- Client delete route (opnLocalApi): the `kind === 'default'` refusal is gone (gate unconditional); deleting the standing profile re-points `standingKey` to the first remaining own profile, else `null` (the no-pick startup state). `'salesian'` is never written. Server delete route: same fallback (first remaining key, else the empty key — the store then reads as no store once no rows stand).

**Reset (§2.4; item D)**
- Client reset route + server reset route: take `{profileKey, starterKey}`; `starterKey` must name a seed/DESIGNED record (a missing starterKey falls back to the profile's own designed record for a default — the pre-v692 callers' shape — and refuses for an own profile). REPLACES `coreBlocks`/`layers`; contents are deleted and `opnMigrateProfileRecord609` is applied (the standing reset transform). PRESERVES key, name, honorLine, the standing pick (by key), todayEdits, and every other profile. **Server parity (Light Review repair, 2026-11-26): the server reset now lands the MIGRATED shape — there is no client/server asymmetry in this release.** As first built, the server route replaced `coreBlocks` and the layers JSON whole from `DESIGNED_PROFILES_591` with no mig609 equivalent: in server mode a reset record's Podcasts layer stood on with its four series (the v609-retired Podcasts block reappeared in the server day build), its series stood nowhere as contents (the Salesian bible-in-a-year + exorcist-files course items silently vanished), and `profilesPayload` showed `layers.podcasts {on: true, series: [4 series]}` with no contents field where the client reset shows contents with podcasts off/empty. The fix seat is the SERVER RESET ROUTE itself (the direct mirror of the client route): the new `migratedStarterShape609` (index.ts, beside `DESIGNED_PROFILES_591`) ports `opnMigrateProfileRecord609` line for line against the standing source-settings rows (`sourceSettingsPayload`) — a series that already stands by a source row (daily-gospel-exegesis) moves nowhere; `daily-readings` lands as a seat item in a Morning contents list that first gains the block's full standing list; every other series lands as a course item in Night the same way; the Podcasts layer is stored off with its series emptied; the Novenas layer stands as seeded — and the route stores that shape (contents riding the layers JSON), so the STORED record itself converges. A load/payload-time transform was not chosen: the client mirror transforms at its reset route, and a stored record that converges at write needs no transform re-run on every later read. Harness: the SR legs in harness-v692 (§3.4).
- Menu seat: `opnProfileMenu607` (client.ts:25449) — "Reset this profile…" stands for every profile (the `kind === 'default'` gate retired); the two-tap arm stands (`arm607 = 'reset'`, "Tap again to reset"); the second tap opens the starter pick; the pick confirms. Session bookkeeping after the write stands as prescribed (lists/base/removed reset, `opnInitShape607` re-seed).
- Configure seat (Q9 A): `openProfilesScreen`'s zone row — "Reset this profile…" for every profile, same arm + shared starter pick; Delete stands for every profile there too (the menu's unconditional gate, mirrored). Seat named: the profiles editor screen (`openProfilesScreen`, the Configure-plan surface listing and editing one profile) — NOT `opnOpenPickEdit604`, which is the standing-pick sheet (a pick surface, not a per-profile Configure surface; its acts remain pick + Save).

**Add (§2.5; item E)**
- `opnProfileMenu607` gains "Add profile" → `opnOpenStarterPick692` (client.ts:25190) with `includeEmpty: true` → `opnMintStarter692` (client.ts:25216): the mint goes through the save route's no-key branch with the template as the payload's shape; the mint is found by key-diff against the pre-mint payload (not by name — a second mint from the same starter shares the name). After the mint the standing pick stands switched (inside the mint) and the new profile opens in the Edit form on standing scope (OPEN-4 default — §3.2).
- "Start empty" (`opnMintEmpty692`, client.ts:25241): mints a blank own profile (no blocks on, no contents) under a name taken by `openRenameCopySheet590` (name required — no starter name exists to inherit). See §3.3 for the validator door this required.
- Save New stands unchanged and exempt (OPEN-5).

**Rename act (item F — new, document over Plan)**
- `opnProfileMenu607` gains "Rename profile…" → `openRenameCopySheet590` pre-filled with the current name (name required) → the save route's key branch renames in place; the KEY does not change, so identity and the standing pick stand. No new route was needed — the key branch already writes `name` (client opnLocalApi save · server save route). `openRenameCopySheet590` (client.ts:25595) gained an optional `{title, sub}` wording parameter for this caller and the Start-empty caller; Save New callers pass nothing and keep the standing words.

**Toggle (§2.6; item G)**
- `opnBannerHtml604` (client.ts:24992): the `data-p604change` button is replaced by a two-state segtoggle (`data-p692scope="today"|"standing"`, active state = `opn604.scope`, gold/ghost dress) in the same banner seat. Band copy per state is unchanged, word for word; the `scopeSwitched` second line stands. Wiring (wirePrayersView): a tap on the inactive state calls `opnFlipScope609`; a tap on the active state does nothing. `opnEditBarHtml604` stands as-is in both states — no Save today / Save button added (see the OPEN-6 reconciliation, §3.2).
- `opnFlipScope609` (client.ts:25019): per-scope session preservation — the scope left behind stores `{lists, base, removed, wrote, shape}` in `opn604.sessions692[<scope>]` and flip-back restores it whole; a scope never visited starts fresh (lists reset, `opnInitShape607` re-seed). Sessions are created at `opnEnterEdit607` (client.ts:25338 — entry still opens on Today scope every entry, and now also stands down when no profile stands: no effective profile, no form) and dropped at `opnExitEdit607` (client.ts:25366). At-once writes stand: `opnWrite604` / `opnWriteShape607` are unchanged — the write target follows the toggle.

**Phantom-edits fix (item H)**
- Mechanism, grounded in the built tree: the note is a LIVE DIFF on every surface — the day fold (`opnFoldDay590`, client.ts:4310-area; server `profileFoldOf` via `todayLayerDiverges594`) sets `todayEdits` when a today entry stands for the date AND `opnTodayDivergence594(standing profile, entry)` is non-empty; `opnBlockTodayMark604` reads the same diff per block; the ladder head reads it too. The chips note (`opnPickHead609`) and the pick-sheet warning (`opnOpenPickEdit604`) painted on the entry's mere PRESENCE. A standing entry with NO today act behind it is seeded by the today-scope SHAPE write: `opnWriteShape607`'s today branch writes a layer carrying `coreBlocks` + `layers` unconditionally (`has` is true by construction), so any shape switch in today scope stores an entry whose fields may exactly equal the profile — divergence empty, note dark. A later STANDING edit (save route — which never touches `todayEdits`) moves the profile side of the live diff, the divergence becomes non-empty, and the note lights with no today edit made; symmetrically, a standing edit could move the profile onto a real layer and swallow its note. `opnInitShape607`'s today seeding (shape read from `res.todayEdit`) and the flip's session reset are readers, not writers — the seed is the shape write, and the amplifier is the live-diff read.
- Fix, three seats, one rule — a layer stands only when it is a REAL today-edits set (written by a today-scope act AND divergent from its base profile at write time); a standing edit creates, seeds, and marks no today layer, and leaves an existing real layer exactly as it was:
  1. Write guard: the today-edit routes (client opnLocalApi, client.ts:3833-area · server today-edit route) compute divergence of the normalized layer against its base profile after `opnCheckTodayLayer594` / the server validation; a non-divergent layer stores nothing (the date's entry is deleted / never set).
  2. Migration scrub: `opnMigrateProfiles692` + `migrateStore692` delete any standing today entry whose divergence against its (re-pointed) base profile is empty, and any entry whose base no longer stands — this clears the phantom layers already standing on devices (John's case) at the same one-time pass. A divergent (real) entry stands byte-identical.
  3. One fact at every surface: the chips note (`opnPickHead609`, client.ts:27847) and the pick-sheet warning (`opnOpenPickEdit604`, client.ts:25517) now read the same fact as the fold — an entry stands AND its divergence is non-empty — instead of mere presence. The fold, the block today-mark, and the ladder head already read the diff and are unchanged.
- Harness PHANTOM legs (John's exact case as fixture): shape-seeded equal layer → scrubbed, no layer stands, head line carries no note · non-divergent today-edit write stores nothing · standing-only edit after scope entry/flips → no mark · real today edit → note paints · standing edit after a real today edit → note still paints and today's composed block is unchanged.

**Provenance sub-line (Q6 A)**
- The migrated copy carries `startedFrom: '<way-key>'` (client record field · server layers JSON). It paints "Your profile — started from The Salesian Way" at two meta seats: `profPlanRowHtml` (client.ts:25558, a second meta line under "Your every-day profile", reading `fold.startedFrom` — the client fold's effective and the server `profileFoldOf` both carry it) and `openProfilesScreen`'s paint (under the honor line, reading the draft's carried `startedFrom`; `draftOf` now carries the field).

**First-run offer (§2.2; item B)**
- `opnStarterOfferStands692` (client.ts:25260) + `opnStarterOfferHtml692`: on the Praylist home (`paintListenHome`), with an empty own list the offer stands in place of the set — "Begin with a way of prayer", the three starter cards (name · blocks · time fact · Q8 guidance line verbatim · honor line · "Becomes your own profile — change anything afterwards"; Salesian pre-highlighted with a "Start here" marker), and the foot line "You can change everything later — nothing here is a grade." A card tap runs `opnMintStarter692` and the Praylist composes from the mint. Card dress is shared with the pick sheet (`opnStarterCardHtml692`).
- The gate is DEVICE MODE ONLY — see §3.3 (a build decision the regression sweep forced, now part of the record).

**Web Benedictine (item W)**
- Seat: `opnWebBenedictineHtml692` (client.ts:25279), painted by `paintListenHome` directly under the plan row when `opnMode() === 'web'` — the Praylist home is the web surface where the profile story stands (the plan row is its profile seat, and Mode 3's personal surfaces point to the app from here). Shape source: `opnStarterRecord692('benedictine', …)` — the seed + `opnMigrateProfileRecord609` effective shape — with each block's contents read through `opnStandingContents597` (the standing-contents function: the record's contents where they stand — Morning carries the readings seat — else the block's standing list). Read-only: no buttons, no pick, nothing stored; the honor line stands. Native + installed-PWA surfaces never paint it (mode gate), and their starter picks keep the summary cards exactly as the document prescribes.

### 3.2 Document-vs-Plan differences (the document governed)

- **Q2 A over OPEN-1:** NO name step at the startup pick or the Add starter pick. The mint takes the starter's name as its own (key = the save route's slug mint from that name, deduped — a second mint from the same starter dedupes the key and keeps the name). The Plan's pre-filled rename sheet at startup does not stand. The rename discipline survives as the new Rename act (§3.1) and at Save New (unchanged).
- **Q4 A over §2.5.2:** §2.5.2 prescribed no empty start anywhere. As built, the starter pick opened FROM THE ADD SEAT ONLY carries a fourth quiet row, "Start empty" — never at startup, never at Reset (harness-verified at all three seats). The empty mint asks a name on the rename sheet (required), there being no starter name to inherit.
- **Q5 A reconciliation + OPEN-6:** the document's Q5 A speaks of per-scope drafts and a "Save act that follows the toggle (Save today in Today, Save in Standing)". The grounded §2.6.1 code fact is that the live form writes AT ONCE and holds no draft — there is no Save today act to move, and resurrecting the retired v600 draft screen was out of scope. As built: Q5 A's operative promise ("each scope keeps its own draft: flipping loses nothing") is delivered as per-scope SESSION preservation in `opnFlipScope609` (un-written session state — materialized lists, restore bases, removed sets, the wrote flag, the shape — survives a flip both ways), and the "Save act follows the toggle" is honored by the write-target-follows-toggle behavior of the at-once form (acts write at once to the scope the toggle names; written acts stand where they were written). No Save today / Save button was added to the live form's bar in either state (OPEN-6 default stands).
- **Q9 A second seat:** Reset stands at two seats — the Edit form's profile menu (Plan §2.4) AND the profile's Configure surface (`openProfilesScreen`) — same two-tap arm, same starter pick.
- **Q6 A sub-line:** the migration copy carries provenance and paints "Your profile — started from <Way>" at the profile's meta seats (§3.1). The Plan named no provenance field.
- **OPEN-2 retained (document silent):** non-picked Ways are removed without a copy.
- **OPEN-4 retained (document silent):** Add switches the standing pick to the mint (Save New precedent) and opens it in the Edit form.
- **OPEN-3 retained:** the server migration is keyed idempotently on any designed default row standing; no schema change.
- **OPEN-5 retained:** Save New is exempt from the starter base and stands unchanged.

### 3.3 Decisions neither the Plan nor the document names

- **The starter offer is gated to device mode.** As first built, the gate read "not web" — harness-v682 (a server-mode world with no local document) caught the offer masking a standing server day: in server mode the server store is the record and the local document is a sync copy, so an absent local document must never stand the offer. The gate is now `opnMode() === 'device'` (the on-device store is the record there). Web keeps the Benedictine display; server mode is untouched by the offer.
- **The Start-empty mint needed a named validator door.** Both save routes refuse a profile with no core blocks ("a profile needs at least one core block") — a blank mint cannot pass. The routes now accept `coreBlocks: []` only when the payload names `startEmpty692: true` (the empty mint's payload, both sides); every other empty-core save still refuses (harness-verified). No other validator rule moved.
- **Provenance stands only on migration copies.** Starter mints (startup/Add) do NOT carry `startedFrom`: their name already names the starter, and Q6 A's sub-line is the migration's mitigation for a change the user did not choose. A starter mint is a choice the user made under that name.
- **The reset route keeps a legacy fallback.** A reset payload with no `starterKey` resolves the starter from the target's own designed record when the target is a default (the pre-v692 callers' shape) and refuses for an own profile. Both in-app callers now always send `starterKey`.

### 3.4 Harness

- `app/worker/harness-v692.mjs` — **64 ok, 0 bad at Implement; 72 ok, 0 bad after the Light Review repair.** The repair adds the SR legs: the REAL Worker bundle driven through the REAL server reset route (`PUT /api/prayer/profiles/reset`, Salesian starter) over a fake D1 store, asserting the stored layers JSON and the payload record equal the client reset shape (contents standing — Morning standing list + the readings seat, Night standing list + bible-in-a-year/exorcist-files as course items; layers.podcasts off/empty; payload-level contents at the standing read normalization, which stamps `side:'sth'` on the labeled office slots) AND the server-composed day (`playerDayPayload`) carries no Podcasts layer block and carries the two course items in its fold's Night contents. Fail-on-old evidence: with `index.ts` restored to the pre-repair commit the same harness runs **66 ok, 6 bad — every failure an SR leg** (podcasts on with 4 series, contents null, Podcasts block in the day); after the fix, **72/0**. Regressions re-run after the repair: harness-v687 **42/0** · harness-v688 **65/0** · harness-v690 **33/0**. Fixtures from production shapes only: F1 John's "Daily" (the v690 harness's JOHN_CONTENTS verbatim) + a real today layer + the Ways standing · F2 fresh install (no stored document) · F3 Ways-pick device (the Way records built by the production mig609 transform, the Salesian carrying an in-place edit) · F4 a copied-from-a-Way own profile beside the defaults · the PHANTOM fixture (F1 with the shape-seeded equal layer — John's exact case). Legs: Plan §2.9 legs 1–8 (leg 8's COMPOSED lines for the untouched Daily × Thu/Sunday verified byte-identical against the pre-change tree `7e85dea` via ORA_WT) extended with the Q2 A legs (no name step; key dedupe; rename in place) · Q4 A legs (Start empty at the Add seat only; blank mint; the named-door refusal) · Q5 A legs (session survives flips both ways; written acts stand in their scope's store; no Save today paints) · Q6 A legs (copy provenance + the sub-line at the plan-row meta) · Q9 A leg (Configure-surface Reset, arm + pick, shape replaced, name stands) · PHANTOM legs (§3.1) · WEB legs (Mode 3 paint carries every Benedictine block with its contents, the Morning readings seat among them; no pick offered; nothing stored) · server legs (the real `migrateStore692` + `todayLayerDiverges594` extracted standalone: copy mint, re-points, idempotence, phantom scrub).
- Regressions on the rebased tree: harness-v687 **42/0** · harness-v688 **65/0** · harness-v690 **33/0** · harness-v693 **25/1** — the one v693 failure is its own SW-pin check (it asserts the v690 pin; the tree has carried the v693 pin since v693's ship commit) and fails identically on the unmodified base tree; it is not a v692 regression. harness-v691 does not stand in this tree (v691 not landed). Extra sweep, all at their base tallies: v682 24/1 (the 1 is the same stale-pin class, pre-existing) · v683 25/0 · v684 20/0 · v686 37/1 (pre-existing extraction drift, identical on base) · v689 19/0.
- One regression re-point, marked in-code: harness-v688's M2 leg read the saved profile by the key `"salesian"` — the seat the release retires. It now finds the standing profile by the payload's effective key (on the pre-v692 tree that IS "salesian"; here it is the migrated own copy the editor actually opened). The assertion — the added massdaily item stands in the saved standing profile's Morning contents — is unchanged, and the leg passes 65/0.
- v691 seats: none stood in the rebased tree (v691 builds in parallel and has not landed), so no v691 harness tally stands to re-run; when v691 lands, its seats (the source-menu family) share the Edit form with this release's toggle/menu work and its harness should be re-run against the merged tree at Review/Ship.

## §4 Review record — light re-check of the Review repair (2026-11-26)

**Verdict: PASS.** The first Review returned the build on one finding — the server reset route stored the DESIGNED starter shape whole, with no mig609 transform, so a server-mode Reset diverged observably from a client Reset. This re-check verifies that finding is closed and the whole build still stands. Light review — independent re-runs and diff read only; no rebuild. The first Review's other checks (governed decisions Q2/Q4/Q5/Q6/Q9/W, phantom fix, migration safety, diff audit, §3 honesty, v693 stale-pin class) stand as passed and were not re-opened; the repair diff touches none of their seats. Not merged, not deployed — Ship is seated by the coordinator on this PASS (the ship merge waits for v691).

**The finding's closure evidence:**
- Repair commits read firsthand: `6ff7cce` (the transform + route), `8d32ebf` (the SR harness legs), `4fa469d` (the §3 rewrite). Branch diff since the pre-repair commit `42ec05b` is exactly three files — `app/worker/src/index.ts` (the transform + the reset route's bind values), `app/worker/harness-v692.mjs` (the SR legs), and this release doc. `client.ts` is untouched; the `{profileKey, starterKey}` contract stands unchanged on both reset routes.
- Transform parity, read side by side: `migratedStarterShape609` (index.ts, beside `DESIGNED_PROFILES_591`) against `opnMigrateProfileRecord609` (client.ts). Same semantics at every step — a series that already stands by a source row (`daily-gospel-exegesis`) moves nowhere (the row set is built from ALL rows on both sides); `daily-readings` lands as a seat item appended to a Morning contents list that first gains the block's FULL standing list (own enabled rows, then external enabled non-fallback rows with a slotId, sortOrder-merged with nulls last — identical loops, identical comparator); every other series lands as a course item in Night the same way, appended only when missing; the Podcasts layer then stands off with its series emptied on both sides; the Novenas layer stands as seeded (server: `on` carried as the stored 0/1; client: untouched from the seed clone — the same value in each side's store form). Two apparent differences are not drift in the reset seat: (1) the client transform preserves pre-existing contents while the port starts from none — the client reset route deletes contents before migrating and the server route replaces the layers JSON whole, so both transforms run on a record with no contents; (2) the server consumes `sourceSettingsPayload` rows (pre-sorted by block/sortOrder/name) where the client consumes document order — a standing-list tie could in theory order differently, but in the production 26-row seed the only same-block/same-sortOrder duplicates are the fallback rows the standing list excludes, so no effective difference stands. No semantic drift found.
- Preservation rules stand: the SR legs assert key, name, and the standing pick stand and `coreBlocks` are the starter's. honorLine and todayEdits are preserved by route construction, verified by reading the repaired route — its UPDATE still writes only `core_blocks`, `layers`, `updated_at` for the target key, and the state row takes only the version bump; the repair changed only the values bound into that UPDATE (the migrated shape in place of the designed shape). No write touches `name`, `honor_line`, `standing_key`, or `today_edits` on either side.

**Independent harness re-runs (firsthand, this seat):**
- `harness-v692.mjs` fresh on the branch tree: **72 ok, 0 bad** — all 8 SR legs green (route answers with the reset profile standing · payload contents = Morning standing list + the readings seat, Night standing list + bible-in-a-year/exorcist-files course items · payload podcasts {on:false, series:[]} with novenas on · the STORED layers JSON itself carries the migrated shape · preservation + starter coreBlocks · the effective fold converges · the server-composed day carries NO Podcasts block and carries the Novenas block · the day's fold carries the two course items in Night).
- **Fail-on-old, independently reproduced:** in a scratch worktree (detached at the branch head, since removed; the branch worktree's committed state was never disturbed) with `index.ts` restored to `42ec05b`, the same harness runs **66 ok, 6 bad** — every failure an SR leg (payload contents absent · podcasts on with the 4 series in payload, store, and fold · Podcasts block standing in the composed day · Night course items null). The two SR legs that pass on the old tree are the route-answers leg and the preservation/coreBlocks leg, which assert nothing about the migrated shape. The repair legs discriminate exactly the finding.
- Regressions re-run on the branch tree: harness-v687 **42 ok, 0 bad** · harness-v688 **65 ok / 0 not-ok** · harness-v690 **33 ok, 0 bad** — all at their claimed tallies.

**§3 rewrite accuracy (re-check 5):** the rewritten Reset entry's convergence claim is accurate against the code as repaired. The stored record itself converges (asserted raw by the SR stored-JSON leg, not only at payload level); the payload-level contents stand at the standing read normalization exactly as §3.4 names it — verified in code: the store read passes stored contents through `validateProfileContents686` → `validateProfileContents`, which stamps `side:'sth'` on the `ext-morning-prayer`/`ext-evening-prayer` source items, and the SR payload expectation carries exactly that stamp while the stored-JSON expectation carries none. The convergence holds for all three starters by the same code path (Little Way: podcasts already off/empty, no contents on either side · Benedictine: readings seat only · Salesian: the SR-driven case).

**Residual notes for Ship (none blocks this PASS):**
- The v691 harness re-check is still owed on the merged tree (v691 not landed in this tree; its source-menu seats share the Edit form with this release's toggle/menu work) — §3.4 carries the same note.
- harness-v693's stale-pin leg F keeps failing **25/1** until its pin expectation is updated; pre-existing, identical on the base tree, not a v692 regression.
- The field check stands as the final gate: on the installed app, a server-mode Reset to a starter should show no Podcasts block, the readings seat in Morning, and the two course items in Night.
- One observation outside the returned finding, named for the coordinator's awareness, not as a defect in the repair: `startedFrom` provenance rides differently at Reset — on the client it is a record field the reset route never deletes, so it survives a client Reset; on the server it rides the layers JSON, which the reset route replaces whole (as it did before this repair), so it drops on a server Reset. The mig609 shape — the returned finding's whole scope — converges; only the provenance sub-line's survival differs. If John wants that converged too, it is a small follow-up, not part of this finding's closure.

**Commits on `release/v692` at this verdict:** … `42ec05b` (§3) · repair `6ff7cce` · `8d32ebf` · `4fa469d` · this record.
