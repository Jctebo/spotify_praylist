# v689 — Wallpaper stock DELETE path (slug: wallpaper-stock-delete-path)

## §1 Scope

**Registration:** DevOps Board row 1667, run level **To Ship**. Streamlined release: this document's §1+§2 are the combined Scope+Plan pass. Holder: chain-v689-plan. Time contract 1178 (DevOps Board agent door). Base: standing clone `main` at `7dad181` (the v686 ship tree). Branch `release/v689`, worktree `~/workspace/.worktrees/v689` off the one standing clone (`~/workspace/projects/ora-pro-nobis/standing-clone`).

**Origin.** v685 left two garbled entries — `p2-st-sylvester-abbot-1962-calendar__2026-11-26.jpg`, phone + watch variants — standing in the append-only wallpaper stock stores. No delete path exists anywhere in the shipped code: the stock route only upserts, the fork stock tool only posts, and the local ledger only records what was posted. The clean entries `st-sylvester-abbot-1962-calendar__2026-11-26.jpg` (phone + watch) stand beside them and are correct.

**What ships.**

1. An agent-door **delete route** in the app Worker, beside the standing stock route, removing one named entry (variant + exact name) from the backend stock store: its entry in the served R2 manifest and its R2 image object.
2. A **delete mode** in the fork tool `runner/wallpaper_stock.py`: dry-run by default naming exactly what would be removed per store; `--apply` removes only the dry-run's named set; the local ledger records each deletion (as a tombstone — §2.5, Deviation D1).

**Guards (registered, binding).**

- Exact-name match only — no patterns, no prefixes, no wildcards.
- A name standing in Google Drive **current** or a Drive **queue** is REFUSED.
- Every removal is verified by remote read-back (served manifest GET + store reads).
- Google Drive **current** is clean and OUT of reach: this release never writes Drive — no folder, no file, no manifest (see §2.4 for what that leaves standing and why it is safe).

**First use (Implement/Ship, after the check plan passes).** Delete the two garbled entries: `p2-st-sylvester-abbot-1962-calendar__2026-11-26.jpg` for variant `phone` and variant `watch`. The clean `st-sylvester-abbot-1962-calendar__2026-11-26.jpg` entries stand untouched, verified by read-back.

**OUT.** Any Drive write of any kind · any change to the stock-post flow's behaviour for non-deleted entries · any D1/KV store (none exists for wallpapers — §2.1) · any client/UI change · any change to the rotation (`wallpaper_rotate.py`) · re-stocking or renaming the garbled entries under a corrected name (the clean entries already stand).

## §2 Plan

All citations are the standing clone tree at base `7dad181` (`app/worker/src/index.ts`, `app/wrangler.toml`) or the fork tree (`runner/wallpaper_stock.py`, `runner/wallpaper_rotate.py`) unless named otherwise. Live reads were taken 2026-11-26 ~13:55 UTC.

### §2.1 The store map — every store, its seat, what delete touches

| # | Store | Seat (grounded) | Shape | Delete touches it? |
|---|-------|-----------------|-------|--------------------|
| S1 | Backend manifest (the stock store of record) | R2 object `wallpaper/manifest.json` in bucket `ora-pro-nobis-audio` — binding `AUDIO` (`app/wrangler.toml:29-30`, `Env.AUDIO: R2Bucket` index.ts:16). Key constant `WALLPAPER_MANIFEST_KEY` index.ts:4573; read `wallpaperManifestRead` index.ts:4598; write `wallpaperManifestWrite` index.ts:4606 | One JSON object `{version:1, updated, entries:[{name, slug, date, variant, kind, sha256, bytes}]}`, identity `(name, variant)`, sorted by `variant/name` on write | **YES — route removes the entry** |
| S2 | Backend image objects | R2 object per entry at `wallpaper/<variant>/<name>` in the same bucket — `wallpaperKey()` index.ts:4576-4578; written by the stock route `env.AUDIO.put(wallpaperKey(...))` index.ts:4887 | Raw JPEG bytes, `image/jpeg` | **YES — route deletes the object** |
| S3 | Served manifest | `GET /api/wallpaper/manifest` (session surface) index.ts:6264-6272 returns `wallpaperManifestRead(env)` directly | **Derived read of S1 — there is no second stored copy.** The served manifest IS S1 | Self-heals from S1: removing the S1 entry removes it from the served manifest in the same write |
| S4 | Served image file | `GET /api/wallpaper/file/<variant>/<name>` index.ts:6274-6286: looks the entry up in S1 first (404 if absent), only then `env.AUDIO.get(wallpaperKey(...))` | Read path, no store | Self-protecting: once S1's entry is gone the file route 404s even if S2's object somehow remained — which is why §2.2 orders the manifest write before the object delete |
| S5 | Drive shuffle manifest | Google Drive file `shuffle-manifest.json` in the Drive `manifests` folder (`FOLDERS["manifests"]`, wallpaper_rotate.py:83). Read/written ONLY by the fork: `read_drive_manifest` / `write_drive_manifest` / `stock_drive` in wallpaper_stock.py | Same `{version, updated, entries}` shape as S1 (§2.2 P2 shape) | **NO — Drive is never touched.** It does NOT self-heal (see §2.4) |
| S6 | Drive shuffle copies | Drive folders `phone-shuffle` / `watch-shuffle` (`SHUFFLE_FOLDERS`, wallpaper_stock.py); copies filed by `stock_drive` | One Drive file per stocked entry | **NO — Drive is never touched** (see §2.4) |
| S7 | Local ledger | `~/workspace/goals/saint-of-the-day-picture-rotation/hidden_files/wallpaper-stock-ledger.json`, written ONLY by `stock_backend` in wallpaper_stock.py (on `--apply`) | Flat JSON object `{"<variant>/<name>": "<sha256>"}` — verified live: 98 keys, including both garbled keys (phone sha `139bc37d…`, watch sha `14151bfc…`) and both clean keys | **YES — fork delete mode records the deletion here** (tombstone, §2.5 / D1) |
| S8 | Drive current + queues | Drive folders `phone-current` / `watch-current` / `phone-queue` / `watch-queue` (`FOLDERS`, wallpaper_rotate.py:77-80) | The rotation's live + incoming sets | **NEVER — read-only guard input only** (§2.3) |

**No D1 table, no KV namespace holds wallpaper stock.** The header comment at index.ts:4555-4567 states the design plainly: image files + one manifest under the R2 prefix `wallpaper/` in the standing AUDIO bucket, "no new bucket, no new binding, no D1 migration". This release adds no store and no migration.

**The stock route (the seat the delete route stands beside).** `POST /api/agent/wallpaper/stock`, index.ts:4861-4900. Query fields `name&variant&kind&sha256` name the image; the body's SHA-256 and length must match or nothing is stored; on a match it `AUDIO.put`s the S2 object, then upserts the S1 entry (filter + push + sort, `updated = nowISO()`, manifest write) in the same request. A repeat of the same `(name, variant, sha256)` is an idempotent no-op (`unchanged: true`). Stocking DOES upload one R2 object per entry — so each garbled entry has an S2 object standing, and a delete that removed only the manifest entry would orphan it.

**Live confirmation (remote read governs).** `GET https://app.orapronobis.media/api/wallpaper/manifest` on 2026-11-26 ~13:55 UTC (`updated: 2026-11-26T13:50:16.580Z`) carries the garbled phone entry `p2-st-sylvester-abbot-1962-calendar__2026-11-26.jpg` (sha256 `139bc37d2410c93601bf730c466b732e8d1e0d4f4e94e1f7fd448ca7b969a84b`, 497943 bytes, kind `saint`) standing beside the clean phone entry (sha256 `ef1aa1e6…`). The ledger (S7) holds the garbled name for BOTH variants (watch sha256 `14151bfcce2374f97912a92bc45e56fd5633dffdbc16bc32342485a18656958f`), which proves the watch variant was stocked through the same route; Implement re-confirms the watch entry on the live manifest at first use before deleting.

### §2.2 The delete route (app side)

**Seat.** Inside the standing agent-door block (index.ts:4626-4627, gate at §2.6), immediately beside the stock route (index.ts:4861): a new branch on the same path with the DELETE method —

```
DELETE /api/agent/wallpaper/stock?name=<exact name>&variant=<phone|watch>
```

**Behaviour, in order.**

1. Validate: `variant` must be `phone` or `watch`; `name` must parse under the standing naming contract — reuse `wallpaperParse` (index.ts:4586) by trying `kind=saint` then `kind=monthly` (the date segment's length decides the kind, so exactly one can parse). An unparseable name is refused 400 and never reaches a storage key — the standing B3 rule, applied on the delete side too. Exact string equality is the only matching: the name is compared with `===` against manifest entries; no pattern, prefix, or slug matching exists anywhere in the shape.
2. Read S1 (`wallpaperManifestRead`). Find the entry with `e.name === name && e.variant === variant`.
   - **No entry, and no S2 object:** 404 `{ok:false, error:"not stocked"}` — nothing changes. A delete of an absent entry is a refusal, not a silent success.
   - **No entry, but an S2 object stands** (orphan): delete the object, return `{ok:true, removed:null, objectOnly:true}` — the route cleans the one orphan shape the append-only era could leave.
3. **Entry stands:** remove it from `manifest.entries`, set `updated = nowISO()`, write S1 (`wallpaperManifestWrite`) FIRST; then `env.AUDIO.delete(wallpaperKey(variant, name))`. Manifest-first ordering means the served surface (S3/S4) is consistent the moment the manifest write lands; a failure between the two steps leaves an unreachable orphan object, never a served-but-deleted entry. Read the object back (`AUDIO.get` → null) inside the route is NOT required — read-back verification is the fork tool's job (§2.5) against the remote served surface.
4. Return `{ok:true, removed:<the entry as it stood>, manifestEntries:<new count>}`.

No other route changes. The session surface (S3/S4) stands exactly as shipped.

### §2.3 The Drive-current / queue refusal guard — the read seat

The guard is a **read-only Drive listing**, built entirely from machinery the fork already ships — no new Drive code, no Drive write:

- Source: `runner/wallpaper_rotate.py` — `FOLDERS` (folder ids for `phone-current`, `watch-current`, `phone-queue`, `watch-queue`), `list_children(folder_id)` (paged `files.list`, `trashed=false`), and `list_queue(variant)` (handles BOTH queue layouts: files directly in `<variant>-queue` and dated subfolders `queue/<YYYY-MM-DD>/`).
- `wallpaper_stock.py` already imports `FOLDERS, VARIANTS, drive, list_children` from `wallpaper_rotate` (its import line at the top of the file). Implement adds `list_queue` to that same import — the only new import.
- Guard procedure (per requested variant, run BEFORE any removal, in dry-run and `--apply` alike): the exact name is compared (`==`) against every file name in `list_children(FOLDERS[f"{variant}-current"])` and every file name in `list_queue(variant)`. A hit in either refuses THAT variant with the folder named (`REFUSED <variant>/<name> — stands in phone-current` / `… in watch-queue/2026-11-27`). If ANY requested variant is refused, `--apply` aborts the whole run (exit non-zero) and removes nothing — a partial delete of a refused set is never landed.
- The guard reads only the variant(s) requested, but note the first-use fact: the garbled name is a `p2-` prefixed duplicate, NOT the name standing in current (current holds the clean `st-sylvester-…` name — Drive current is clean per the registration), so the guard passes it while still protecting the clean name: a delete request for the CLEAN name for 2026-11-26 would be refused while it stands in current. That asymmetry is the guard working as designed, and the check plan proves it (§2.7 C3).

### §2.4 The shuffle manifest does NOT self-heal — and why that is safe here

Grounded finding: nothing ever removes an entry from S5/S6. `stock_drive` only adds or replaces entries for its current candidates; `stock_backend` only posts S5 entries whose `(name, variant, sha256)` the ledger does not already hold. The garbled entries therefore REMAIN in the Drive shuffle manifest and as Drive shuffle copies after this release — Drive is never touched (§1).

That residue is safe for exactly two reasons, and Implement must not break either:

1. **Nothing served reads S5/S6.** The phone reads S3 (the R2 manifest). The Drive shuffle shelf is a production-side library, not a served store.
2. **Re-posting is blocked by the ledger tombstone (§2.5 / D1).** `stock_backend` decides what to post by comparing S5 entries against the ledger. If delete mode simply REMOVED the garbled keys from the flat ledger, the next nightly `stock_backend --apply` run would see the S5 garbled entries as unstocked and **re-post them to the backend** — resurrecting exactly what v689 deletes, within a day. The tombstone in §2.5 exists to close this, and `stock_backend` must be taught to honour it in this same release.

### §2.5 The fork delete mode (tool side) + the ledger tombstone

**CLI shape** (fits the standing argparse shape — flags only, dry-run default, `--apply` executes):

```
python3 runner/wallpaper_stock.py --delete <exact-name> [--variant phone|watch|both] [--apply] [--ledger PATH]
```

- `--delete NAME` selects delete mode; `--variant` defaults to `both` (the garbled case stands in both). `--date` becomes optional: exactly one of `--date` (stock mode) or `--delete` (delete mode) must be given, else argparse errors. Stock mode's flags (`--monthly-only`, `--drive-only`, `--backend-only`) are rejected in delete mode.
- The name is validated against the tool's own `NAME_RE` / `parse_name` (wallpaper_stock.py) before anything is read or called — an unparseable name is refused locally.

**Flow.**

1. **Guard (§2.3)** for each requested variant. Any refusal prints and aborts (no removals, exit non-zero) — in dry-run the refusal is the output; in `--apply` nothing is removed.
2. **Name the set (dry-run output, per store, per variant):** read the served manifest remotely (GET `https://app.orapronobis.media/api/wallpaper/manifest` — the remote read of record; the Plan took it live, §2.1) and the local ledger. For each variant print exactly:
   - `S1 manifest entry: REMOVE <variant>/<name> sha256=<…> bytes=<…>` (or `absent`),
   - `S2 R2 object: REMOVE wallpaper/<variant>/<name>` (or `absent` / `orphan — object only`),
   - `S7 ledger: TOMBSTONE <variant>/<name> (was sha256=<…>)`,
   - `S5/S6 Drive shuffle: NOT TOUCHED (entry stands; tombstone blocks re-post)`,
   - `S8 Drive current/queue: clear (guard passed)`.
   Dry-run changes nothing: no route call, no ledger write.
3. **`--apply` removes only the dry-run's named set**, in this order per variant: call the delete route (§2.2) with the standing `_app_headers()` auth (§2.6) → verify remotely (§2.5 step 4) → only then write the ledger tombstone for that variant. A variant whose verification fails gets NO tombstone and the run reports the failure — the tombstone must never claim a removal the remote read does not prove.
4. **Remote read-back verification (every removal):** GET the served manifest — the `(name, variant)` entry is absent; GET `https://app.orapronobis.media/api/wallpaper/file/<variant>/<name>` — 404. Both must hold before the tombstone is written. (The manifest GET is the store read of S1/S3; the file GET proves S4 closed. S2's object deletion is proven transitively: the route reports it and the file route's manifest gate makes a surviving object unservable — Review may additionally spot-check the object with a direct R2 read if it wants belt-and-braces.)

**The ledger tombstone (Deviation D1's shape).** The ledger file gains a versioned shape, read and written through ONE new helper in wallpaper_stock.py (`load_ledger` / `save_ledger`) used by BOTH `stock_backend` and delete mode:

```json
{ "version": 2,
  "stocked": { "<variant>/<name>": "<sha256>", … },
  "deletions": [ { "key": "<variant>/<name>", "name": …, "variant": …,
                   "sha256": "<sha as stocked>", "deleted_at": "<ISO>",
                   "stores": ["S1-manifest", "S2-r2-object"] } ] }
```

- Backward compatibility is mandatory: a flat v1 ledger (the live file today) loads as `{stocked: <the flat map>, deletions: []}`; the first write under v689 migrates it. No stocked key is lost in migration — the check plan proves the key count.
- `stock_backend` change (the ONLY change to the post flow): an S5 entry whose `(name, variant)` stands in `deletions` is skipped with the action line `skip backend <key> (ledger: deleted — tombstone)` and is never posted, whatever its sha. Everything else about the post flow stands byte-for-byte.
- A deletion record is appended per (variant, name) actually removed and verified. Deleting a name that was never stocked (no S1 entry, no ledger key) is refused by the route's 404 and records nothing.

### §2.6 Auth — the delete route inherits the standing door auth

No new auth is built. The whole agent-door block is gated once at its head: index.ts:4626-4627 — `if (seg[0]==="api" && seg[1]==="agent") { if (!isAgent(request, env)) return err(403, "agent token required"); … }`. `isAgent` (index.ts:122-126) takes the `Authorization: Bearer <token>` header and compares it with `timingSafeEqual` against the Worker's `AGENT_TOKEN` secret. The delete branch sits inside that block beside stock (index.ts:4861), so it is covered by the same gate with zero new code. On the fork side, delete mode reuses `_app_headers()` (wallpaper_stock.py) unchanged: `Authorization: Bearer <AGENT_TOKEN>` read from `~/workspace/.tools/prayer-app.dev.vars`, plus the Cloudflare Access service-token headers (`CF-Access-Client-Id` / `CF-Access-Client-Secret` from the Cloudflare connector's `service-token.json`) — the same headers the stock post uses today, against the same `APP_BASE` host. The served-manifest read-back (§2.5) is the public/session GET the Plan itself took live; it needs no token.

### §2.7 Check plan (Implement builds, Review runs)

Worker harness: a new `app/worker/harness-v689.mjs` in the standing harness pattern (local Worker, `LOCAL_DEV`, fixture R2) — no wallpaper harness exists today, so this one is built fresh. Fork checks: a new `runner/test_wallpaper_stock_delete.py` in the standing `test_wallpaper_*.py` pattern, with the Drive listing and the app HTTP calls stubbed at the module boundary (`list_children` / `list_queue` / the curl seam) — no live Drive or live backend is touched by the test.

Fixture discipline (production-sourced, per the standing rule): the fixture image bytes are a REAL stocked file's bytes pulled from the live served file route (the clean phone `st-sylvester-abbot-1962-calendar__2026-11-26.jpg`), posted under the fixture name `fixture-saint__2099-01-01.jpg` (parses as kind `saint`; a name that stands in no store, no current, no queue). The refusal fixture is the REAL clean name standing in Drive current for 2026-11-26.

- **C1 — Dry-run lists, removes nothing.** Delete-mode dry-run on the fixture name (after C4 stocks it) prints the per-store REMOVE/TOMBSTONE lines of §2.5; served manifest + ledger are byte-identical before and after.
- **C2 — Apply removes from every in-scope store, with read-back.** `--apply` on the fixture entry: route returns `ok` with the removed entry; served manifest GET shows the entry absent; file GET 404s; the ledger holds a `deletions` record for the key and no `stocked` key; a second `--apply` is refused (route 404 `not stocked`) and records nothing new.
- **C3 — Refusal case.** Delete (dry-run AND `--apply`) on the clean name `st-sylvester-abbot-1962-calendar__2026-11-26.jpg` is REFUSED naming the Drive folder it stands in (current), and nothing is removed. A pattern/prefix attempt (`--delete st-sylvester-*` or the bare slug) is refused locally as unparseable / not an exact stocked name.
- **C4 — The standing stock-post flow still works.** Post the fixture via the standing stock route (or stock mode against the stub) → read back present in the served manifest + ledger `stocked` → delete it (§C2) → read back gone. Plus the tombstone leg: run `stock_backend` (stubbed S5 containing the deleted fixture entry) after the delete — the fixture is skipped as tombstoned, NOT re-posted. Plus ledger migration: loading the live v1 ledger shape yields all 98 stocked keys under `stocked`, zero lost.
- **C5 — First use (Ship, live).** Dry-run the garbled name (both variants) → apply → remote read-back: served manifest carries NO `p2-st-sylvester-abbot-1962-calendar__2026-11-26.jpg` for either variant, and the clean `st-sylvester-abbot-1962-calendar__2026-11-26.jpg` entries (phone + watch) still stand with their live shas (`ef1aa1e6…` phone; watch as read at first use). Ledger holds both garbled tombstones.

### §2.8 Deviations from the registered shape — named

- **D1 — The ledger records a deletion as a tombstone in a versioned (v2) ledger, and `stock_backend` learns to skip tombstoned entries.** The registration said only "the ledger records each deletion". The flat v1 ledger has no place to record a deletion except removing the key — and §2.4 proves key-removal alone resurrects the entry on the next nightly stock run, because the Drive shuffle manifest (untouchable in this release) still lists it. The tombstone is the smallest shape that makes the deletion durable. No other post-flow behaviour changes.
- **D2 — "Every store" in the check plan means every IN-SCOPE store (S1, S2, S7).** The Drive shuffle stores (S5, S6) keep the garbled entries standing, per the registration's own "Drive is never touched" line; §2.4 names why that residue cannot reach the phone and cannot re-post. If John wants the Drive shuffle shelf cleaned too, that is a separate word and a separate release — it is NOT silently absorbed here.
- No other deviation: route seat, exact-name guard, current/queue refusal, dry-run/apply split, and remote read-back all stand as registered.

### §2.9 Implement care list

- The fork repo (`~/workspace/projects/spotify_praylist-fork`) has pre-existing unrelated dirty/untracked files — commit ONLY `runner/wallpaper_stock.py` and the new test file there; check in per repo with the standing read-back (working tree clean for the touched files · branch pushed · remote in sync).
- The ledger migration touches a live production file: Implement backs up the v1 ledger before the first v2 write and proves the 98-key count across the migration (C4).
- Manifest-first ordering in the route (§2.2 step 3) is load-bearing — do not reorder.
- The delete route must reuse `wallpaperParse` / `wallpaperKey` / `wallpaperManifestRead` / `wallpaperManifestWrite` — no parallel helpers, no string-built R2 keys from unvalidated input.
- First use deletes by the EXACT garbled name for both variants; the clean name is the C3 refusal fixture, never a delete target.

## §3 Implement record

**Holder:** chain-v689-implement · **Time contract:** 1179 (DevOps Board agent door) · **Date:** 2026-11-26.

### App side (this repo, branch `release/v689`)

- **Delete route** in `app/worker/src/index.ts`, inside the agent-door block immediately after the stock POST route: `DELETE /api/agent/wallpaper/stock?name=<exact>&variant=<phone|watch>`. Reuses `wallpaperParse` (tries `saint` then `monthly`), `wallpaperKey`, `wallpaperManifestRead`, `wallpaperManifestWrite` — no parallel helpers. Exact `===` match on `(name, variant)`; absent entry + absent object → 404 `not stocked`; absent entry + standing object → object deleted, `{ok:true, removed:null, objectOnly:true}`. **Manifest-first order as planned:** entry removed + manifest written, then `AUDIO.delete`. Success returns `{ok:true, removed:<entry>, manifestEntries:<count>}`. Error bodies use the standing `err()` helper shape (`{error: …}`), as every other door route does.
- **Pin:** `app/worker/src/ui.ts` SW `CACHE` → `ora-pro-nobis-v689-1` (the one standing seat, same as v686's bump).
- **Harness:** `app/worker/harness-v689.mjs` — real Worker bundle (esbuild), stub R2/D1, `LOCAL_DEV`. Fixture bytes are the REAL clean phone Sylvester file pulled live from the served file route at harness start, sha asserted equal to the Plan §2.1 live sha `ef1aa1e65ea0ab771595e6ce10ae6662b4758450216a76dc48556c8bf3dd35c4`, posted under `fixture-saint__2099-01-01.jpg`. **Result: 19 ok, 0 bad** (stock-post + read-back, delete + read-back gone, second delete 404, orphan `objectOnly:true`, pattern/bare-slug/bad-variant 400, no-token 403, monthly-shaped name parses).

### Fork side (`spotify_praylist-fork`, branch `muse-draft-week`, local-only)

- `runner/wallpaper_stock.py` gains delete mode exactly per §2.5: `--delete <exact-name> [--variant phone|watch|both] [--apply] [--ledger PATH]`; `--date` no longer required — exactly one of `--date`/`--delete` (argparse error otherwise); stock-mode flags refused in delete mode. Name validated by the tool's own `parse_name` before any read/call.
- **Guard (§2.3):** `list_queue` added to the standing `wallpaper_rotate` import. Per requested variant, exact `==` against `list_children(FOLDERS["<variant>-current"])` and `list_queue(variant)` (dated subfolders named via `_parent_name`, e.g. `watch-queue/2026-11-27`). Any refusal prints `REFUSED <variant>/<name> — stands in <folder>` and aborts the whole run (exit 2) before any removal, in dry-run and `--apply` alike.
- **Apply order per variant:** route call (`app_delete`, standing `_app_headers()` auth against `APP_BASE`) → remote read-back (served manifest GET on `https://app.orapronobis.media` shows the entry absent AND served file GET 404) → only then the ledger tombstone. A failed verification writes NO tombstone. All app HTTP goes through one `_run_curl` seam (the stock POST now uses it too — behaviour unchanged), which is the stub boundary for the tests.
- **Ledger D1:** `load_ledger`/`save_ledger` are the one helper pair used by both `stock_backend` and delete mode. v2 shape `{version:2, stocked:{…}, deletions:[…]}`; v1 flat loads as `{stocked:<flat map>, deletions:[]}`. `save_ledger` copies a v1 file to `<name>.v1-backup` (once) before the first v2 write. `stock_backend`'s only change: a tombstoned S5 entry is skipped with `skip backend <key> (ledger: deleted — tombstone)` and never posted.
- **Test:** `runner/test_wallpaper_stock_delete.py` — Drive + HTTP stubbed at the module boundary. **Result: 33 ok, 0 bad** (C1 dry-run byte-identical stores · C2 apply + read-back + second-apply refusal · C3 current/queue/pattern refusals · C4 post flow, tombstone blocks re-post, 98-key v1→v2 migration fixture).

### Ledger backup + key-count proof (live file)

- Backup taken BEFORE any v2 write: `~/workspace/goals/saint-of-the-day-picture-rotation/hidden_files/wallpaper-stock-ledger.v1-backup-2026-11-26.json` — byte-identical copy of the live v1 ledger (verified `a == b`).
- **COUNT DISCREPANCY (Review/Ship must note):** the Plan (§2.1/§2.9) says the live ledger holds 98 keys. The live file as read at Implement holds **97 keys** (49 phone + 48 watch), including both garbled keys and both clean keys. `load_ledger` on the live file yields all **97/97** stocked keys, identical map, zero deletions; the live file itself was NOT migrated or written by Implement (still v1 flat — migration happens on the first real `--apply` write, i.e. at Ship's C5, with the in-code `.v1-backup` as a second net). The C4 migration proof at the full 98-key count stands on the test's 98-key v1 fixture (33 ok above). No key known to the Plan is missing beyond this count difference: both garbled + both clean Sylvester keys are present.

### Not done here (by design)

- **C5 first use is Ship's**, after deploy: dry-run + apply the garbled `p2-st-sylvester-abbot-1962-calendar__2026-11-26.jpg` for phone + watch, read back, confirm the clean entries stand. No production delete was run by Implement; no Drive write of any kind.
- Fork branch is local-only per the brief (not pushed); app branch `release/v689` merges to main at Ship under the standing push-to-main rule.

### Watch items for Review/Ship

- The served read-back host (`app.orapronobis.media`) answers the manifest/file GETs without a token (the Plan took them live); if a future Access change gates them, delete `--apply` will fail read-back and write no tombstone — safe failure, but C5 would block.
- First real `--apply` (C5) performs the live ledger's v1→v2 migration; verify the tombstones for both garbled keys and the 97-key stocked count (minus the 2 garbled keys = 95 stocked) after it.
