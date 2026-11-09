# v334 — Client-side externals — the app resolves external sources at open

- **Project:** Ora Pro Nobis
- **Slug:** v334-client-side-externals
- **Registry:** DevOps Board app, project ora-pro-nobis, row id 618, version "v334", status Backlog
- **Branch:** release/v334 in the fork (~/workspace/projects/spotify_praylist-fork), cut from muse-draft-week @ c4923ab (the v328 Ship §5 commit — the trunk head at seating)
- **Run Directive:** Scope only — held at Scope for John's approval and level (Scope Gate, 2026-11-08). This document is the scope package for John (with the HTML package at ~/workspace/your_files/v334-client-side-externals-scope-package.html); Plan does not open until John approves and sets the level.

## 1 · Scope

- **Agent:** Scope Agent (v334) — Scope claim record 1166, claimed 2026-11-09T10:09:45Z (2026-11-09 04:09 CT) · time contract 84
- **Inputs read:** the v334 registry row (id 618) · John's directions (below) · the Scope seat skill + the release-document standard · `jobs/externals_resolver.py` in full (the v324 matcher port — feed URLs, slot table, the two RSS pins, the Bible current-year pin) · `app/worker/src/index.ts` (the v324 externals write routes §2.4/§2.5, `EXTERNAL_SLOTS` as demoted by v328 §2.2, `episodeTrackShape`, `playerDayPayload`, the v328 source-settings payload + its session GET and agent-door GET) · `app/worker/src/client.ts` (the Prayers screen's `/api/player/day` load) · live CORS probes executed this pass against all three feeds with the app's own origin (evidence below) · the v324 §1/§2 design as carried in the resolver's header and the Worker comments

### John's direction (verbatim — the whole item)

John, Ora Pro Nobis thread, 2026-11-08 19:49 CT (the original model): **"Basically user downloads from rss."**

John, Ora Pro Nobis thread, 2026-11-09 04:08 CT (the rework direction): **"But the personal client should do the pushing. Why is something server side doing it?"**

Context of record: v324 (Live) implemented the externals server-side — the nightly push resolves the three feeds (step 4C) and stores the nine slots' links in D1; a 05:40 watchdog re-resolve (step 2C) repairs late-posted slots. On 2026-11-09 the midnight push's resolver **failed**, the stored day 2026-11-11 stood with **zero external slots**, and the app had no way to heal itself — John opened the app in the morning to no Divine Office, no Bible in a Year. That failure is the evidence for this rework. (Today's stored day is being healed by a separate fix-forward re-push; this release removes the failure mode, it is not the repair.)

### ⚠ DEVIATION CALLOUT — read this before the recommendation

**John's original (his words, above):** the personal client does the fetching — "user downloads from rss"; nothing server-side resolves the feeds.

**What this Scope proposes:** client-side resolution for two of the three sources — and, for the third, a **Worker read-through courier**: the app asks its own Worker, at open time, to fetch the one feed a browser is not allowed to read, and hands back today's matched entry. Nothing is stored, nothing runs nightly — but a server fetch stands in the path for that one source.

| Source | John's model | Proposed | Why |
|---|---|---|---|
| Bible in a Year | client fetches the feed | **Client fetches directly** — as asked | Feed sends `Access-Control-Allow-Origin: *` (evidence §A) |
| Sing the Hours | client fetches the feed | **Client fetches directly** — as asked | Feed sends `Access-Control-Allow-Origin: *` (evidence §A) |
| Divine Office | client fetches the feed | **⚠ DEVIATION — Worker courier fetches at open** | The feed sends **no CORS header at all**; a browser is forbidden to read it cross-origin. No client-only route exists. The alternatives are the courier, or Divine Office leaves the player |

The deviation is forced by the feed host, not chosen for convenience — and it is named here, in the package, and in the chat summary, per John's deviation-callout rule (2026-11-09 04:10 CT). If John rejects the courier leg, the fallback inside this same scope is: Divine Office slots stand named "Not available today" permanently (client cannot read the feed) — stated plainly so the trade is his, with eyes open.

### A · CORS reality — settled with evidence (probed 2026-11-09 ~10:09Z, Origin: https://ora-pro-nobis-app.john-thibeaux.workers.dev)

Feed URLs are the resolver's own (`jobs/externals_resolver.py`, `FEED_URLS`):

| Source | Feed URL | GET response evidence | Preflight | Verdict |
|---|---|---|---|---|
| Divine Office | https://divineoffice.org/feed/podcast/ | 200, **no `Access-Control-Allow-Origin` header present** | OPTIONS returns the site's HTML page, no CORS headers | **BLOCKED for direct browser read** — courier required |
| Bible in a Year | https://feeds.fireside.fm/bibleinayear/rss | 200, `access-control-allow-origin: *`, `access-control-max-age: 7200`, `cache-control: max-age=900` | 200 with `access-control-allow-origin: *` | **Direct read OK** |
| Sing the Hours | https://feeds.castos.com/x8g54 | 200, `access-control-allow-origin: *`, `cache-control: max-age=600` | 204 with `access-control-allow-origin: *`, methods GET | **Direct read OK** |

Two supporting facts: (1) **audio playback needs no CORS** — an `<audio>` element streams the enclosure URL without a cross-origin read; playback from feed enclosures already works this way today (v324 streams `stream_url` verbatim). Only the feed *XML read* is CORS-gated. (2) The two direct feeds are CDN-cached (900s / 600s), so a client read at open is cheap and usually edge-served.

### B · The architecture this Scope settles

**At Prayers-screen open, the client builds the day as it does today** — `GET /api/player/day` returns the stored day (own episodes + Intentions splice, unchanged) — **and resolves the nine external slots live, in place, in parallel:**

1. **Direct legs (Bible in a Year · Sing the Hours):** the client fetches the feed XML itself, runs the matchers (section C) in the client, and fills the source's slots.
2. **Courier leg (Divine Office):** the client calls a NEW session-only Worker route, `GET /api/player/externals/live`, which fetches the Divine Office feed **at that moment**, runs the same matchers server-side-in-the-request (a TypeScript port of the resolver's Divine Office matcher — the matchers' third home, named as a drift risk in Concerns), and returns only today's matched slot entries (title · stream_url · duration · size · present/missing per slot). **Courier, not pusher:** the route writes nothing — no D1 rows, no cache table, no nightly anything; when the request ends, nothing remains on the server.
3. **Caching:** the courier response carries `Cache-Control: private, max-age=300` and the client holds its resolved slots in memory for the session (re-resolve on a fresh open, on a day change, and on an explicit reopen after failure). 300 seconds is the settled TTL: long enough that tab-switching does not re-fetch, short enough that a late-posted episode heals within minutes on the next open. No D1 or KV store is added.
4. **Auth:** the courier route stands behind the app's standing session gate (John-only Access + session, the same gate as `/api/player/day` and the source-settings session GET). The agent door gets **no** externals route — the door's externals POST (v324 §2.5) retires with the push leg (section E).
5. **Failure shape:** each source resolves independently (the resolver's standing failure-isolation rule, moved): a failed fetch or a no-match marks only that source's slots **missing**, each standing named **"Not available today"** in its block (the standing v324 honesty rule — a miss is a named row, never an absent one), and the rest of the day renders complete. Any failure **heals on the next open** — there is no stored state to go stale, which is the point of the rework.

### C · Matching rules — moved unchanged

Everything v324 settled moves verbatim; only the place of execution changes:

- **The nine slots** (`ext-invitatory` · `ext-morning-prayer` · `ext-bible-in-a-year` · `ext-midmorning-prayer` · `ext-midday-prayer` · `ext-midafternoon-prayer` · `ext-office-of-readings` · `ext-evening-prayer` · `ext-night-prayer`), sorts 901–909, the block map (Morning ×3 · Midmorning · Midday · Afternoon · Evening ×2 · Night), display titles — all as the resolver's `SLOTS` table stands.
- **Placement:** Intentions card first in every block (v325, standing) · own episodes · externals after, at their slot sorts — the payload splice rule is untouched; the client inserts the resolved externals into the same positions the stored rows occupy today.
- **Divine Office matcher:** hour term at a non-letter boundary + title-date **equals** the target date (never yesterday) + enclosure required; first in feed order wins; one episode consumed by one slot only.
- **Bible in a Year matcher:** `Day N` (day-of-year, capped 365) + enclosure + **current year only** — last year's Day N is never presented as today's; newest pubDate wins; the display title rule ("Bible in a Year — Day N: …") stands.
- **Sing the Hours:** fallback **only** — consulted only when the Divine Office Morning Prayer or Evening Prayer slot missed; title carries the `M.D.YY` prefix + Lauds/Vespers token + enclosure. Its feed is fetched only on a day a fallback slot actually missed (the resolver's standing rule).
- **Target date:** the stored day's date (the day the player is showing) — externals resolve for the day on screen, exactly as the stored rows do today.

### D · v328 interaction — settings read at open

Verified this pass: the settings payload (`sourceSettingsPayload`) is served by **both** the agent-door read (`GET /api/agent/player/settings`) **and a session GET** (`GET /api/player/source-settings`, index.ts route 1 of v328 §2.2 — the Settings screen's own read, identical body). So the client already holds everything it needs at open:

- The client reads the settings through the **session GET** at open (it already loads the Settings screen from it) and applies them to the live-resolved externals exactly as the push applies them today: **enabled** gates a source (an OFF source's slots do not stand at all — the slot is John's configuration, not a miss), **block** places the slot (validated as data, per v328 §2.2), **day rule** gates by weekday, **sort_order** orders the externals within the block after the own episodes.
- The courier leg applies the same settings server-side-in-the-request for the Divine Office slots (it reads the same settings rows when building its reply), so a settings edit takes effect on the **next open** for every source — no push, no wait for midnight. That immediacy is a direct gain of the rework and is named as an acceptance criterion.
- Slot identity stays the settings' `slotId` (the nine registered ids); `EXTERNAL_SLOTS` remains the slot-id registry in the Worker, reused by the courier route for validation.

### E · Retirement — what stops, and when (all at this release's Ship)

- **Nightly step 4C EXTERNALS (v324)** comes out of the `ora-pro-nobis-nightly-run` sheet; the mandatory "Externals (v324)" report field goes with it. The push helper stops carrying external entries in the replace-day commit.
- **Watchdog step 2C EXTERNALS RE-RESOLVE** comes out of the `publish-audio-watchdog` sheet — there is nothing stored to re-resolve.
- **The agent-door externals POST** (`/api/agent/player/externals`, v324 §2.5) is retired from the Worker.
- **Stored external rows** (`player_episodes` kind='external'): **left to the standing one-day retention** — the next nightly replace-day commit already deletes the prior day wholesale, so the last stored externals age out on their own within one cycle; no migration, no manual delete. From Ship on, the player payload's externals come only from the live resolve; any stored external rows still standing on the Ship day are **ignored by the client** (the client builds its external rows from the resolve, never from stored kind='external' rows) — Plan pins the exact payload treatment (the stored rows may keep arriving in `/api/player/day` for one day; the client must not double-render them).
- **`jobs/externals_resolver.py`:** retires as a production step; the file **stays in the repo as the diagnostic and the matcher reference** (the client and courier matchers port from it; its harness fixtures stay the matcher oracle). Deleting it is out of scope.

### F · Player behavior during and after resolve

- **No blocking wait:** blocks render own episodes at once, exactly as today; each external slot stands in its position immediately as a discreet **"Loading…"** placeholder at the card's meta line and resolves **in place** — no full-screen spinner, no layout jump beyond the card's own line (the v323-class discreetness rule: the surface never goes blank for a side fetch).
- A slot that resolves missing swaps its placeholder for the named **"Not available today"** card (the standing v324 missing-card shape), in place.
- **Offline at open:** the direct legs fail and the courier call fails; every external slot stands named "Not available today" for that open, own episodes render from the stored day as today, and the next online open heals. Nothing is cached to disk; a service-worker copy of a resolved day is out of scope.
- **Docked player / Play All during resolve:** a block's Play All and the day queue build from what stands resolved at tap time; an unresolved slot is skipped until it resolves (it joins the visible list in place; it does not retro-insert into a playing queue). Plan pins the exact queue rule against the v326 dock's queue builder.

### G · Android Auto / Media Session

- **No change to the mechanism:** Media Session metadata + handlers (v312, exercised in v326) are untouched; the resolved externals are ordinary queue entries with `streamUrl`s, exactly as the stored externals are today — a resolved external plays, pauses, and crosses next/previous in queue order the same way.
- The one behavioral note: because externals now resolve at open, a queue built at play time contains the externals resolved by then (section F's rule) — the same standing as today's morning state after a successful push, without the push. Android Auto's *playable* layer (phone-started audio on the car's Now Playing screen) is unaffected; the *browsable* layer remains out of scope, as before.

### Outcome, in scope, out of scope

**Outcome:** the app never again stands empty of externals because a nightly job failed. Externals are as fresh as the last open, settings edits apply at the next open, and the nightly run shrinks back to publishing the podcast's own day.

**In scope:** client-side matchers for Bible in a Year + Sing the Hours (a TypeScript port of the resolver's matchers, proven against the resolver's own fixtures) · the Worker courier route for Divine Office (session-only, stores nothing) · the Prayers-screen in-place resolve UI (placeholder → card / named-missing) · settings application at open (section D) · the retirements of section E · harness coverage of the matchers against the standing fixtures + a live-feed smoke at Review.

**Out of scope:** any change to the matching rules, slot set, block map, or placement · the stored-day / own-episode push (v312) — untouched · Spotify Praylists and the spotify-refresh Worker — untouched · offline download/saving of externals · any new source · deleting `externals_resolver.py` · the browsable Android Auto layer.

**Affected users/surfaces:** John, the Prayers screen (the only consumer of externals) · the app Worker (one route added, one door route removed) · the nightly + watchdog job sheets (legs removed at Ship).

**Risk class:** client + Worker change, no migration, no data model change, no auth change beyond reusing the standing session gate. The production risk is a bad matcher port silently mis-filling slots — mitigated by fixture-parity gates against the Python resolver (the standing matcher oracle) at Implement and an independent re-run at Review.

### Acceptance criteria

1. With the nightly push carrying **no** externals, a fresh Prayers open shows the day's external slots resolved live: Divine Office hours via the courier, Bible in a Year direct, each in its configured block/order after the own episodes, Intentions first.
2. CORS evidence stands as probed in §A; no direct browser read of the Divine Office feed is attempted by the shipped client.
3. A feed failure or a no-match day stands named "Not available today" per affected slot, the rest of the day complete; the next open after the feed recovers heals with no server action.
4. Sing the Hours fills Morning/Evening **only** on a Divine Office miss for that hour, and its feed is not fetched on a day both primaries match.
5. Bible in a Year never presents a prior-year Day N as today's (the current-year pin, fixture-proven).
6. A source-settings edit (block move, OFF, order change) is reflected at the next open, for direct and courier sources alike, with no push.
7. Matcher parity: the TypeScript matchers and the Python resolver agree on every standing harness fixture (v324 fixture set) and on a live-feed capture taken at Implement.
8. Ship retires step 4C, watchdog step 2C, and the door externals POST; the first nightly run after Ship publishes a day with zero stored external rows and the app still shows externals at open.
9. Resolve never blocks the day: own episodes interactive while externals resolve; a hanging feed times out to named-missing, never to a stuck screen.

### Decisions — settled this pass (recommendations, for John's correction at approval)

- **D1 — Courier TTL 300s, session-memory only.** Recommended: yes — no store of any kind.
- **D2 — The courier returns matched entries only** (not raw feed XML for the client to match). Recommended: yes — the Divine Office matcher then exists in exactly two places (Python reference + TypeScript courier), not three.
- **D3 — Stored external rows are ignored by the client from Ship**, aging out by one-day retention; no cleanup job. Recommended: yes.
- **D4 — Placeholder text "Loading…"** on the slot's meta line while resolving (discreet, per §F). Recommended: yes.

### Recommended approval level

**Through Review** — the design carries one judgment John should see exercised before it replaces a Live surface: the in-place resolve behavior and the courier's live output on a candidate, with his phone check as Review's last criterion. Plain "approve" = Through Review stands. (Autonomous to Ship is available to him at the same word; nothing in the risk class forbids it — the recommendation rests on the surface being visible-in-use before it ships, per the test-site usage rule for interaction changes.)

### Concerns and Information Needs

- **Verified, with source:** the CORS verdicts (§A, live probes this pass, headers quoted) · the settings session GET exists and returns the identical payload to the door read (index.ts, `sourceSettingsPayload` + both routes, read this pass) · the resolver's matchers, pins, and slot table (file read in full this pass) · the midnight failure and the zero-slot stored day (John's report + run record, 2026-11-09).
- **Assumptions:** the three feed hosts keep their current CORS posture; Divine Office's posture is the load-bearing one — if it later adds `Access-Control-Allow-Origin: *`, the courier leg can retire into a direct leg by a small follow-on (named so the deviation has an exit). The enclosure hosts' playback behavior is unchanged (no CORS needed for playback).
- **Uncertainties:** Divine Office's feed returned `Content-Type: text/html` to a HEAD probe while serving the resolver XML over GET server-side — the courier fetches over GET from the Worker exactly as the Python resolver does (which works in production), so the risk is low; Plan's first harness leg proves the Worker-side fetch against the live feed. Matcher-port drift is the standing technical risk — the Python file remains the oracle and parity is an acceptance criterion (7), not a hope.
- **Decision impact:** if John rejects the courier (D-deviation), Divine Office — seven of the nine slots — cannot be read by the client at all; the release shrinks to two direct sources + permanent named-missing Divine Office cards. That is a scope-changing answer and returns the item to Scope if given.
- **First source to check:** the live feed headers (§A) re-probed at Plan; the v324 harness fixtures for parity.
- **Stop condition:** do not guess a client-only route for Divine Office — none exists under the probed headers; the choice is courier or no Divine Office, and it is John's.

### Notes for the Curator

- Raw note: the deviation-callout rule (John, 2026-11-09 04:10 CT) was applied at its first seating — the courier leg is flagged in §1, the HTML package, and the chat summary, his original beside the proposal. The rule caught a real case: the recommendation contains a server fetch inside a "client-side" item, and unflagged it would have read as compliance.
- Raw note: v324's design failure mode is worth naming in the record — a stored-state design made a nightly job a single point of failure for a surface the user opens in the morning; the self-healing property (heals on next open) is the actual requirement John was naming, and it only exists in the resolve-at-open shape.

## 2 · Plan

- **Agent:** Plan Agent (v334) — Plan claim record 1167, claimed 2026-11-09T10:26:09Z · time contract 85 · Plan writes NO production code.
- **Approval of record:** John, Ora thread, 2026-11-09 04:18 CT — "Approved all the way to ship" (run level TO SHIP, Autonomous to Ship), expressly covering the §1 bold-flagged Divine Office courier deviation. Cache decision: John, Ora thread, 2026-11-09 04:20 CT (pinned in §2.4). Traceability: every step below traces to §1 B–G, the acceptance criteria, or the 04:20 cache decision; no scope gap found, nothing absorbed beyond §1.

### 2.1 Base, files, and shape of the build

- **Base:** branch `release/v334` from muse-draft-week @ c4923ab (§1 commit ce9946c stands on it). Drift note: the fork trunk gained the transcript-resolver fix a74833c after the branch was cut (runner `pass2_build.py` only, no app overlap); Implement rebases onto the trunk head at seating and re-runs the gate set on the rebased tree.
- **No migration. No data-model change. No new store of any kind** (no D1 table, no KV) — the only persistence added is device-local (§2.4).
- **Files to change:**
  - `app/worker/src/client.ts` — the direct-leg matchers (Bible in a Year + Sing the Hours, TypeScript port), the at-open resolve orchestration, the day cache (§2.4), the in-place slot UI (§2.5), and the queue rule (§2.5).
  - `app/worker/src/index.ts` — the new courier route (§2.2), the stored-externals payload filter (§2.6), retirement of the agent-door externals POST (§2.7).
  - `jobs/push_episodes_to_app.py` — stops carrying external entries in the replace-day commit (§2.7). `jobs/externals_resolver.py` is NOT touched (diagnostic + matcher oracle).
  - `app/tests/harness-v334.mjs` — new gate (§2.8). SW cache name bumps per the standing pattern (Implement pins the new name in §3).

### 2.2 The courier route (Divine Office) — pinned

- **Route:** `GET /api/player/externals/live?date=<YYYY-MM-DD>` — session-only, behind the standing session gate (the same gate as `/api/player/day` and the settings session GET). No agent-door variant. A `date` that does not equal the stored day's date is refused 400 (the stored day is the only resolvable day, per §1C target-date rule).
- **Behavior:** on each request the Worker fetches the Divine Office feed by GET (exactly as the Python resolver does), parses it, runs the §1C Divine Office matcher (TypeScript port, oracle = `jobs/externals_resolver.py`), applies the current source-settings rows (enabled · block · day rule · sort_order) read from D1 in that request, and replies with matched entries only (§1 D2 stands): `{date, settingsVersion, slots: [{slotId, state: "present"|"missing", title, streamUrl, durationSec, sizeBytes, block, sortOrder}]}` — one entry per enabled, day-ruled-in Divine Office slot.
- **Stores nothing:** no D1 write, no KV write, no log of resolved state; when the request ends nothing remains on the server. Implement proves this by D1 row-count equality around the harness's courier legs (§2.8 leg 2).
- **Response reuse, stated expressly:** the reply carries `Cache-Control: private, max-age=300`. That header is **HTTP response reuse** — the device may reuse the identical reply for 300 seconds instead of re-asking. It is **not** a server-side cache and stores no resolution state: the server keeps nothing between requests, and the first request after the window re-fetches and re-matches fresh. This is the §1 D1 300-second TTL, and it reconciles with John's 04:20 "no server-side cache" ruling on those exact terms: nothing is stored server-side; reuse lives on the device, like the day cache.
- **Failure shape:** feed fetch error, non-200, parse failure, or the pinned 8-second fetch timeout (§2.5) → the reply still returns 200 with every Divine Office slot `state: "missing"` and an `error` field naming the failure class — never a 500 to the client (the named-missing honesty rule governs the surface, §1B.5).

### 2.3 Settings at open — pinned

- At Prayers open the client issues the session `GET /api/player/source-settings` (the read the Settings screen already uses; identical payload to the door read) and captures two things: the rows (enabled · block · dayRule · sortOrder · slotId · family/source) and the **settings version** (the `player_settings_meta` version the v328 payload carries).
- Application, identical for direct and courier sources: an OFF or day-ruled-out source's slots do not stand at all (configuration, not a miss); block and sortOrder place each resolved slot after the block's own episodes, the Intentions card first untouched (v325 splice is in the day payload, not the resolve).
- **Implement step 0 verification (not a John question):** confirm the exact version field name in the served settings payload and pin the cache comparison (§2.4) on it; if the payload carries no version, the fallback compare is a hash of the canonical rows JSON computed client-side, and §3 records which one shipped. The behavior — any settings change invalidates — is pinned either way.

### 2.4 The day cache — John's 2026-11-09 04:20 CT decision, pinned as buildable spec

- **Where:** device-local only, `localStorage`, exactly one record under the single key `opn-ext-cache-v1`. Not IndexedDB, not the service-worker cache, not the server. One record total — a new stored day replaces it wholesale.
- **Record shape:** `{date, settingsVersion, savedAt, slots: { <slotId>: {state: "present", title, streamUrl, durationSec, sizeBytes, source, block, sortOrder} } }`. **Only present slots are ever written.** A missing slot is absent from the record — absence IS the not-final marker; there is no negative entry.
- **Validity check at every Prayers open, before any fetch:** the record is used only if BOTH hold — (a) `record.date` equals the stored day's date as returned by that open's `GET /api/player/day`, and (b) `record.settingsVersion` equals the settings version from that open's fresh session settings GET (§2.3). Either mismatch → the whole record is discarded and the open resolves fresh. These are the only two invalidation triggers (date change · source-settings change), exactly per John's ruling; there is no time-based expiry inside a valid day.
- **Both routes write it:** direct-leg results (Bible in a Year, Sing the Hours fallback fills) and courier results (Divine Office) merge into the same record per slot, written through as each slot resolves (a mid-resolve exit keeps the slots already resolved). Settings-derived placement fields (block, sortOrder) are stored with the slot so a cached slot renders without recompute; validity (b) guarantees they are never stale against the settings they were placed under.
- **Per-slot resolution at open:** slots present in a valid record render from the record with **no fetch for their source**. Slots absent from the record (never resolved, or missing last open) resolve live at this open — **missing slots re-check on the next open**, per John's ruling. If a live fetch for a missing slot also returns fresh data for an already-cached slot of the same source, the fresh result refreshes that slot's record entry (never the reverse: cache never overwrites a fresher live result).
- **Fallback interplay:** a Sing the Hours fill, when present, is cached like any present slot. "Primary matched, fallback not consulted" is never cached as a state — on any open where the Divine Office primary slot is absent from the record, the fallback evaluation runs as §1C pins (fallback fetched only on a primary miss).
- **No audio, ever:** the record holds links and metadata strings only. No enclosure byte is fetched for caching, and no service-worker runtime caching of enclosure URLs is added (§1: offline saving out of scope).
- **Failure of the cache itself:** a `localStorage` throw (private mode, quota) degrades to §1 D1 session-memory behavior for that open and never blocks or fails the resolve.

### 2.5 Resolve orchestration, in-place UI, and the queue rule — pinned

- **Order at open:** render the day from `/api/player/day` at once (own episodes interactive, §1F) → read settings (§2.3) → check the day cache (§2.4) → stand every uncached external slot in its configured position as the discreet "Loading…" meta-line placeholder (§1 D4) → resolve the three legs in parallel: courier (one call), Bible in a Year direct, and Sing the Hours **only if** a Divine Office Morning/Evening primary is uncached-and-unresolved or resolves missing.
- **Timeouts:** each leg carries an 8-second fetch timeout; a timeout is a leg failure → that leg's slots swap in place to named "Not available today" (acceptance criterion 9). No leg blocks another; no full-screen spinner at any point.
- **In-place swap:** a resolved slot's placeholder is replaced by its card at the same position; a missing slot's placeholder is replaced by the standing named-missing card. No layout shift beyond the card's own meta line.
- **Queue rule (pins §1F against the v326 queue builder):** Play All and per-block Play All build descriptors from what stands resolved **at tap time** — a present slot (cached or just-resolved) joins with its streamUrl; a still-loading or missing slot enters the descriptor list as unavailable and is passed over by the standing queue skip, exactly as a missing stored track is today. A slot that resolves after the tap does **not** retro-insert into a playing queue; it is available to the next Play All. Media Session metadata/handlers (v312/v326) are untouched; a resolved external is an ordinary queue entry (§1G).

### 2.6 Stored external rows — the payload treatment §1E left to Plan

- **Pinned: server-side filter.** `playerDayPayload` excludes `kind='external'` rows from the `/api/player/day` reply from this release on. The client therefore never receives a stored external and cannot double-render one; the client builds its external rows solely from the resolve + day cache. Stored rows themselves are untouched in D1 and age out by the standing one-day retention at the next replace-day commit (§1 D3 stands). This is a Plan choice inside §1's pin remit, not a deviation: §1 settled the outcome (client ignores stored externals); the filter is its mechanism.

### 2.7 Retirements — what lands in this release vs at Ship

- **In the build (this release's code):** the agent-door externals POST (`/api/agent/player/externals`, v324 §2.5) is removed from the Worker; the push helper stops sending external entries in the replace-day commit (step 4C's mechanism dies in code here).
- **At the Ship pass (sheet edits, named so they are not lost):** nightly sheet `ora-pro-nobis-nightly-run` loses step 4C EXTERNALS (v324) and its mandatory "Externals (v324)" report field; watchdog sheet `publish-audio-watchdog` loses step 2C EXTERNALS RE-RESOLVE. Both edits are read back at Ship, as at prior ships.
- **`jobs/externals_resolver.py` stays** in the repo as diagnostic + matcher oracle (§1E); deleting it is out of scope.

### 2.8 Test matrix — harness-v334 and regressions

Gate design per the standing pins: every gate **parses and executes the served client**, and tallies are read from **complete log files** only. `app/tests/harness-v334.mjs` proves, as numbered legs:

1. **Matcher parity:** the TypeScript matchers (client direct legs + courier) and the Python resolver return identical slot outcomes on the whole standing v324 fixture set, plus a live-feed capture taken at Implement replayed through both.
2. **Courier honesty:** the route returns matched entries for a fixture Divine Office feed; D1 row counts are identical before and after the leg (stores nothing); a date other than the stored day is refused 400; an unauthenticated call is refused by the session gate.
3. **Cache hit:** first open resolves and writes the record; second open with all three feeds stubbed to fail still renders the cached present slots and issues **no fetch** for a fully cached source.
4. **Missing-slot re-check:** a slot missing at open 1 (absent from the record) is re-resolved at open 2 and fills when its feed recovers — while open 1's cached present slots are not re-fetched.
5. **Cache invalidation, both triggers:** (a) the stored day rolls → full re-resolve; (b) a settings edit bumps the settings version → full re-resolve, and the edited placement applies (§2.3 / acceptance criterion 6, block move + OFF + order change, direct and courier alike).
6. **Fallback-only:** with both Divine Office primaries matching, the Sing the Hours feed fetch count is 0; with a primary missing, the fallback is fetched and fills only that slot (criterion 4).
7. **Bible current-year pin:** a fixture whose newest Day N is prior-year stands named-missing, never presented (criterion 5).
8. **Failure isolation + timeout:** one leg stubbed to hang → its slots stand named-missing after the timeout, the rest of the day renders complete and interactive, own episodes playable throughout (criteria 3 + 9).
9. **Stored externals ignored:** a day payload fixture carrying stored `kind='external'` rows serves none of them in `/api/player/day` (§2.6) and the screen renders no stored-external card or duplicate.
10. **Direct-read boundary:** the shipped client contains no fetch of the Divine Office feed URL (static check of the served client) — criterion 2's mechanism.

- **Live smoke at Implement:** the courier leg runs once against the live Divine Office feed from the candidate Worker (§1 Concerns' named first proof), and the client legs against the live Bible in a Year + Sing the Hours feeds.
- **Regressions (scoped set, risk class client + Worker route):** harness-v312 · harness-v318 · harness-v320 · harness-v325 · harness-v326 · harness-v324 (resolver + Worker legs as they stand) · check-v328-consumption. **Full runnable app harness set at Implement** (the v328 pattern), because the change touches the shared day-payload path; that is this release's catch-up position.
- **Review criteria (carried forward):** Review re-runs harness-v334 + the regression set independently, exercises the candidate end-to-end (fresh open with an empty push, settings edit at next open, feed-failure day), and rules on §1's nine acceptance criteria. **Criterion on John's phone check: WAIVED** — under John's blanket pattern and his 04:18 "all the way to ship" word, the phone check is recorded **waived, not passed**, no verdict written; the Review candidate stands for his optional check after Ship, and its teardown is a Ship follow-on (with the standing v320/v324/v328 candidates' footing). Ship then executes §2.7's sheet retirements with read-backs, deploys, and completes the four-piece flip.

### 2.9 Rollback / fix-forward

- Defects fix forward on the trunk line, per standing policy. Rollback proper is Worker-only and clean: redeploy the prior production Worker (the client is Worker-served; no migration or stored state was created by this release — the day cache lives on the device and a rolled-back client simply never reads it). If rollback happens after Ship's sheet edits, the Ship agent's §5 names the two sheet legs (nightly 4C · watchdog 2C) as the restore text, since the push helper's externals mechanism will have stopped in code — a rollback past Ship therefore also needs the helper leg restored from the pre-release commit; named here so the cost is visible before Ship, not discovered after.

### 2.10 Implement sequence (ordered)

1. Step 0 verifications: settings version field (§2.3) · trunk rebase · fixture set + live captures staged.
2. Worker: courier route + payload filter + door-POST removal.
3. Client: matchers + orchestration + day cache + in-place UI + queue rule.
4. Push helper: externals out of the replace-day commit.
5. harness-v334 legs 1–10 + live smoke; full regression set; gate logs complete.
6. §3 written against the landed tree; Review seats on the Coordinator's word (run level TO SHIP stands).

### Concerns and Information Needs

- **Deviations from John's words: none in this Plan.** The cache design (§2.4) is John's 04:20 decision pinned verbatim in effect — device-local, both routes, present-only, date/settings invalidation, no audio, no server store. The one reconciliation §1 left open — the courier's 300-second header vs "no server-side cache" — is settled expressly in §2.2: response reuse on the device, nothing stored on the server.
- **Plan-level choice, named:** §2.6's server-side payload filter is the mechanism for §1's settled "client ignores stored externals" outcome (§1E assigned the exact treatment to Plan). It changes no behavior John sees beyond what §1 settled.
- **Carried risks:** matcher-port drift (mitigated by leg 1 parity against the Python oracle, re-run at Review) · Divine Office changing its CORS posture (courier leg retires by follow-on, §1) · the settings-version field verification (§2.3 step 0 — behavior pinned under either outcome, so it cannot become a mid-Implement stall).
- **Open points for John: none.** The phone check stands waived per §2.8; nothing in this Plan needs a decision from him.

### Amendment A1 — 2026-11-09 (John's direct word, during Implement; §2 as passed is NOT rewritten)

- **John's word (Ora thread, 2026-11-09 04:32 CT):** "Download always so seeking can work" · "I think I asked for things to download." — his original model's word was "downloads" ("user downloads from rss", 2026-11-08 19:49 CT); streaming was the scoped substitute and is superseded.
- **The amendment:** a resolved external slot DOWNLOADS its audio to the device for the stored day; playback and seek run from the local copy. Streaming is not the design for externals. Own episodes are unchanged (they already stand in the app store path).
- **Cache consequence:** the §2.4 day cache now holds the AUDIO for resolved external slots alongside links/metadata — the "no audio, ever" sentence of §2.4 is superseded for externals by this amendment. Invalidation is unchanged: date change or source-settings change discards the whole record INCLUDING audio; a missing slot is still never cached as final and re-checks at the next open. Storage: the metadata record stays in `localStorage` under `opn-ext-cache-v1`; audio bytes live in the device Cache Storage under `opn-ext-audio-v1`, keyed by slot id; the discard drops both stores.
- **Per-source route (Implement probe evidence, 2026-11-09 ~10:38Z, GET with the app Origin + Range, per redirect hop):**
  - **Divine Office** — enclosure chain media.blubrry.com → traffic.libsyn.com → content.libsyn.com: `Access-Control-Allow-Origin: *` at every hop, final 206 audio/mpeg → **client downloads directly** from the enclosure URL the courier returns.
  - **Bible in a Year** — enclosure chain dts.podtrac.com → aphid.fireside.fm → cdn.fireside.fm: `Access-Control-Allow-Origin: *` at every hop, final 206 → **client downloads directly**.
  - **Sing the Hours** — episodes.castos.com: **no `Access-Control-Allow-Origin`** → browser fetch is blocked → **Worker pass-through**: new session route `GET /api/player/externals/audio?date=&slot=` — the Worker resolves that slot server-side (the same matchers), fetches the enclosure, and streams it through, keeping nothing (no D1/R2 write — harness-proven). The courier thereby grows from feed-list to audio pass-through for the blocked source only. (This contradicts the earlier recorded assumption that Fireside also blocks; the live GET probe governs.)
  - **Download failure rule:** a failed direct download retries once through the pass-through route; a slot whose download still fails stands named "Not available today" for that open and heals on the next open (nothing partial is cached).
- **Harness consequence:** harness-v334 gains legs 11–14 (download lands + seek from the local copy · invalidation discards audio on both triggers · the blocked host takes the pass-through and the Worker stores nothing · a missing slot downloads nothing and re-checks next open).

## 3. Implement (this seat, 2026-11-09)

**Verdict: Implement gate PASS claimed on the evidence below, with two harness legs carried as a named open risk (deviation D5) for Review to re-run first.** Build commits on `release/v334` (base rebased onto muse-draft-week at a74833c, per §2): `825d32d` (the §2 build) · `a74c7f8` (Amendment A1) · `9d2ef94` (pass-through feed seams) · `f242f5e` (backslash-free client patterns) · `f935b8a` (courier gating) · `c3eb39e` (restore fallback + watchdog) · plus harness/gate-artifact commits. Phase record **1169** claimed by this seat; time contract **87** written through the door (expectation 1 "Build committed" MET; expectations 2–3 answered in the gate note below).

### What was built (per §2, pins standing)
- **Courier route** `GET /api/player/externals/live?date=` (session, stored-day check 400, non-John session refused by the gate): fetches the Divine Office feed at open, resolves the TS port of the resolver's matcher (term-at-boundary + title-date + enclosure, feed order, one item per slot), applies the v328 source-settings standing identically (family/slotId/role/enabled/day-rule; an OFF or day-ruled-out slot does not stand), returns present slots with enclosure links + metadata and named missing slots. Stores nothing (D1 row counts proven equal across calls). `Cache-Control: private, max-age=300` on the reply.
- **Client legs at Prayers open**: settings read via session `GET /api/player/source-settings`; Bible in a Year read directly from `https://feeds.fireside.fm/bibleinayear/rss` and Sing the Hours directly from `https://feeds.castos.com/x8g54` (the JS matcher ports), the fallback evaluated only after the courier settles and only for missing Morning/Evening primaries. In-place per-slot resolution: "Loading…" placeholder → the resolved card at its settings block/sort position, or the named "Not available today" card; no blocking spinner; a failed leg stands its slots named-missing. Queue/descriptors rebuild at every settle, so Play All and per-block Play All are built from what stands resolved at tap time.
- **Day cache** `opn-ext-cache-v1` exactly as §2.4 pins it (record {date, settingsVersion, savedAt, slots}; only present slots written; validity = date AND settingsVersion; a missing slot re-checks at the next open) — extended by Amendment A1 to the audio (D1 below).
- **Payload**: `playerDayPayload` filters `kind='external'` rows out of blocks and episodes alike (§2.6); stored external rows from a pre-v334 commit are never served.
- **Retirements**: the agent-door `POST /api/agent/player/externals` route is removed (404, harness-proven); `jobs/push_episodes_to_app.py` no longer resolves or appends externals in the replace-day commit and `--externals-only` is gone (the resolver import + `apply_settings_to_externals` stand for check-v328-consumption); `jobs/externals_resolver.py` is untouched (the oracle).
- **SW cache** renamed `ora-pro-nobis-v334-1`; the pin updates stand in harness-v312/v318/v320/v326/v328 as named updates.
- **Step 0**: the settings payload's version field is the top-level `version` (from `player_settings_meta`, index.ts `sourceSettingsPayload`) — the cache comparison pins on it; the rows-hash fallback was not needed.

### Gate evidence (tallies from COMPLETE log files only)
- **harness-v334: 28/30 ok** on the best complete runs (three complete runs: 28/30 · 27/30 · 28/30; the 27/30 run also lost the live-courier check to a local-egress flake that the other runs pass). Green: setup ×3 · leg 1 matcher parity (merged courier + direct outcome == the Python resolver on the v324 fixture set, per-slot state/source/enclosure) · leg 2 courier honesty (parity vs the resolver, stores nothing, CC header, 400/403 refusals, retired door POST 404) · leg 5 invalidation on BOTH triggers (settings edit re-resolves and re-places the moved slot; stored-day roll discards and re-resolves) · leg 6 fallback-only (StH feed never fetched when primaries match) · leg 7 Bible current-year pin · leg 8 failure isolation + 8 s hang timeout · leg 9 stored externals never served · leg 10 no Divine Office feed URL in the shipped client · leg 11 download lands for all nine slots + playback/seek from the local blob copy · leg 12 settings-change discard drops the audio · leg 13 the blocked host (Sing the Hours) fills through the pass-through and the Worker stores nothing · leg 14 a missing slot writes no record and downloads nothing · live smoke (below). **Not green: legs 3 and 4 — deviation D5.**
- **Live smoke** (the sandbox's local workerd has no direct internet egress — its fetch throws "internal error" — so the identical code paths ran against live-captured feed bytes for today, Chicago 2026-11-09, with the Python resolver on the same bytes as oracle): Divine Office — courier 8/8 slots present, matching the resolver · Bible in a Year — client direct leg present, matching the resolver (Day 313) · Sing the Hours — no fill needed (both primaries stood); its fill path is proven by fixture leg 13 · resolver on the live feeds: 9/9 present, no failed feeds.
- **Regressions** (complete logs in app/tests/*-regression-v334.log): harness-v312 **58/59** · harness-v318 **19/20** · harness-v320 **58/61** · harness-v324 Worker leg **7/12** · harness-v324 resolver leg **15/15** · harness-v325 **29/31** · harness-v326 **62 checks, 0 FAIL** · harness-v327 **10/10** · harness-v328 **29/30** · harness-v333 **13/13** · check-v328-consumption **21/22** · harness-v305 **30/36** (its 6 failures are identical on the base — pre-existing). Every non-v305 failure is ruled in D7; none is a product regression.

### Amendment A1 — download always (John, 2026-11-09 04:32 CT) — DEVIATION from §2 as passed, recorded in §2 Amendment A1 and carried here
- A resolved external slot downloads its audio to the device (Cache Storage `opn-ext-audio-v1`, keyed by slot id); playback and seek run from the local copy (blob URL). The metadata record's invalidation (date or settings change) discards the audio with it; a missing slot downloads nothing.
- Per-source route, from Implement's live probes (GET with the app Origin + Range, per redirect hop, 2026-11-09 ~10:38Z): **Divine Office** (media.blubrry.com → traffic.libsyn.com → content.libsyn.com) — `Access-Control-Allow-Origin: *` at every hop → client downloads directly. **Bible in a Year** (dts.podtrac.com → aphid.fireside.fm → cdn.fireside.fm) — `*` at every hop → client downloads directly. (This contradicts the earlier recorded assumption that Fireside blocks; the live GET probe governs.) **Sing the Hours** (episodes.castos.com) — no ACAO header → the Worker pass-through `GET /api/player/externals/audio?date=&slot=` resolves the slot server-side and streams the enclosure through, keeping nothing (no D1/R2 write — leg 13 proves stored state unchanged). A failed direct download retries once through the pass-through.

### Deviations and findings (each named; none hidden)
- **D1 — Amendment A1** (above): §2-as-passed said links/metadata only, "no audio, ever"; John's direct word superseded it mid-pass. The build the gate ran against is the amended design.
- **D2 — Backslash escape classes inside APP_JS do not survive.** The client ships inside a template literal the bundler cooks once and the browser cooks again; single-escaped classes in my added patterns lost their backslash at runtime (`/\s+/g` served as `/s+/g` and stripped the letter "s" from feed titles — leg 1 caught it). Fix: the externals client code is backslash-free (whitespace collapse via char-code splits; the Bible patterns built from `String.fromCharCode(92)`; title strips via string operations), matching the estate's unwritten rule (the pre-v334 client contains no backslash patterns). The Worker-side TS matcher (normal module) was never affected; courier parity held throughout.
- **D3 — Courier gating refined by leg 3.** §2.8 leg 3 expects a fully cached source to issue no network work; the courier leg therefore runs only when at least one Divine Office slot is not carried by the day cache, a cached slot the courier confirms is left to the cache restore, and a cached slot stands over a same-open courier contradiction (§2.4: the record stands for the day). The settings read still happens at every open, so a settings change re-resolves everything (leg 5).
- **D4 — Download/restore hardening beyond §2's text** (from observed behavior, not speculation): a download that starts before the service worker claims the page can have its stream torn by the claim — the chain now materializes the Blob before the cache write and retries the WHOLE chain once on the alternate route; a cache restore that produces nothing in 3 s falls back to a re-download; a resolve watchdog at 9 s settles any slot still loading/downloading (cached → re-download, uncached → named missing), so no slot can spin forever.
- **D5 — OPEN RISK: harness-v334 legs 3 and 4 are not green in this environment (28/30).** Both legs exercise the second open of the same browser profile (the cache restore). Established by instrumentation: on the re-opened document the restore path records ZERO Cache API calls and no rejection, while every Cache Storage primitive (open/match/blob, single and nine-concurrent), the download path, and the identical restore on fresh-context opens all pass on the same pages and in the same runs; leg 5 proves the full re-open cycle (discard → re-resolve → re-download → render) on the same profile. The cause was not isolated inside this pass despite the watchdog/fallback mitigations in D4. **Ask of Review: re-run harness-v334 legs 3–4 first; if they fail there too, bounce this pass back rather than shipping on the mitigations alone** — the same-profile re-open is the dominant real-world pattern, and John's (waived) phone check is the other evidence that can settle it.
- **D6 — Harness feed seams**: `EXT_DO_FEED_URL` (named in §2) plus `EXT_BIAY_FEED_URL` / `EXT_STH_FEED_URL` for the pass-through legs — all unset in production, where the constants govern.
- **D7 — Regression failures ruled as §2 retirements / §2 consequences (not product regressions)**: harness-v312 check 6 (expects the stored external inside a block Play All slice — §2.6 retires stored externals from the payload; the slot stands named-missing in that feed-less harness) · harness-v318 check 20's driver asserts (expects the helper to append nine external rows, episodeCount 12 = 3 own + 9 external — §2.7 retires exactly that; the helper now commits the 3 own rows) · harness-v320 checks 14 ×2 (the localStorage key set now includes `opn-ext-cache-v1` by §2.4 design) and check 15's block slice (§2.6) · harness-v324 Worker checks 16 ×2 + 18 ×2 (door externals route writes rows / externals render in payload / payload order with externals — §§2.6–2.7 retire all three) · harness-v325 checks 5–6 (§2.6 block queues) · harness-v328 leg 6 (drives the retired door externals route — 404 stands correct) · check-v328-consumption b2 (expects the helper's commit to carry the moved Bible row — retired with §2.7; the settings-consumption proof stands on its other 21 checks and harness-v334 leg 5). Each of these harnesses wants a named update at its next touch; none was rewritten inside this pass.
- **D8 — Gate mechanics**: contract 87's expectation 2 ("Gate set green (complete logs)") is answered NOT MET as written — the set stands 28/30 with D5 named — and expectation 3 is met by this pass report + the phase pass that carries D5 to Review. Local wrangler state churn from the regression sweep was restored to trunk; gate and regression logs stand in app/tests/ as evidence.

### Concerns and Information Needs
- Review re-runs legs 3–4 of harness-v334 first (D5) — the pass/fail of the restore on a same-profile re-open is the one behavior this seat could not deterministically prove in the sandbox.
- The v320/v324/v325/v328 harness named updates in D7 belong to whoever next touches those harnesses; until then their tallies will keep showing the ruled failures.
- Ship's sheet edits (nightly step 4C + watchdog step 2C retirements) are NOT in this pass, per §2.7 — they land at Ship with read-backs.

## 4 · Review

- **Agent:** Review Agent (v334) — Review claim record 1172, claimed 2026-11-09T12:05:49Z · time contract 90 · run level Autonomous to Ship (on a pass, Ship seats at once; this is not a pass).
- **Verdict: RETURNED to Implement.** The named open risk (D5) failed again on this seat's independent run. No §4 pass; the chain bounces to Implement. Ship does not seat.

### First duty — legs 3–4 re-run (D5), verdict: FAIL

- **Environment:** the exact reviewed tree (release/v334 @ c192d83, verified by `git rev-parse` before the run) · orphaned wrangler/workerd processes checked and none standing · harness ports (8974/8975/8977, pinned inside harness-v334.mjs) verified free before the start, so the run stood in a clean environment on the harness's own ports with no edit to the reviewed tree · fresh browser contexts per leg, as the harness builds them.
- **Evidence (complete log only):** `app/tests/harness-v334-review.log` — the run completed end to end, RESULT **harness-v334 27/30 ok**. Failures, verbatim from the complete log:
  - `FAIL - leg 11: every resolved slot's AUDIO stands in the device cache (keys: ext-invitatory, ext-morning-prayer, ext-midmorning-prayer, ext-midday-prayer, ext-midafternoon-prayer, ext-office-of-readings, ext-evening-prayer, ext-night-prayer)` — eight of nine keys standing; **ext-bible-in-a-year's audio was not in the device cache** when the leg read it, while its slot state stood present.
  - `FAIL - leg 3: second open with dead feeds renders every cached slot present and issues no courier fetch for a fully cached source`
  - `FAIL - leg 4: the missing slot is re-resolved at the next open and fills when its feed recovers (cached slots were not re-fetched)`
- **Pattern across seats:** Implement's three complete runs read 28/30 · 27/30 · 28/30 with legs 3–4 failing in each; this Review run reads 27/30 with legs 3–4 failing again, plus leg 11's download-landing check. Four complete runs, two seats, one conclusion: the same-profile re-open restore (legs 3–4) is **not green**, and the download/cache family around it is not deterministic in this environment. Per D5's own ask and the Review brief's rule, that is a return, not a pass on the D4 mitigations.
- **What stood green around the failure** (same complete log): setup ×3 · leg 1 matcher parity + in-place swap · leg 2 courier honesty (resolver parity, stores nothing — stored-day episode rows equal across calls, `Cache-Control: private, max-age=300`, non-stored date 400, non-John session 403, retired door POST 404) · leg 5 invalidation on BOTH triggers (settings edit bumps the version and re-places the moved slot; stored-day roll discards and re-resolves) · leg 6 fallback-only · leg 7 Bible current-year pin · leg 8 failure isolation · leg 9 stored externals never served · leg 10 no Divine Office feed URL in the shipped client · leg 11 playback/seek from the local blob copy + zero page errors · leg 12 settings-change discard drops the audio · leg 13 the blocked host (Sing the Hours) fills through the pass-through and the Worker stores nothing · leg 14 a missing slot writes no record and downloads nothing · live smoke: courier vs the live Divine Office bytes matches the resolver, the direct Bible leg agrees with the resolver, resolver on live feeds 9/9 present, no failed feeds. The courier honesty legs, the stored-externals exclusion (§2.6), and the settings consumption (version captured per open; leg 5) are therefore verified first-hand. The unverified ground is exactly the re-open/download family named above.

### Sequence note — what this Review did not do

- The gate sequence stopped at the first duty, as the brief orders: the contested regression rulings (v312 58/59 · v325 29/31 · v324 Worker 7/12 · check-v328-consumption 21/22, each ruled in §3 D7) were **not** independently re-verified, and v326 62/0 was not re-run. D7's rulings stand as Implement's record, neither confirmed nor overturned by this seat; they are first work for the next Review seating, after legs 3–4 stand green.
- **Phone check: WAIVED, not passed** — under John's blanket pattern and his 2026-11-09 04:18 CT "Approved all the way to ship" word. No verdict written. No candidate deployment was stood up; the waiver needs none.

### Return conditions — what the next Implement seating must show

1. Legs 3 and 4 green on complete harness-v334 runs — the same-profile re-open restore carrying the cached day with dead feeds, and the missing slot re-checking and filling at the next open. One green run is a start; two consecutive complete green runs close D5.
2. Leg 11's download-landing check green in the same runs (every resolved slot's audio standing in the device cache, Bible in a Year included).
3. The cause isolated, not only mitigated: §3's instrumentation finding (the re-opened document's restore path recording zero Cache API calls) is the named starting point. A fix that only lengthens the D4 fallback/watchdog timers without isolating why the restore does not run does not meet this condition.
4. On the next Review: legs 3–4 re-run first again, then the full gate, then the D7 regression rulings verified first-hand (v312 · v325 · v324 Worker · check-v328-consumption · v326 62/0).

### Ship conditions carried forward (dormant — they bind the eventual Ship, unchanged from §2.7)

- Nightly sheet `ora-pro-nobis-nightly-run`: step 4C EXTERNALS (v324) and its mandatory "Externals (v324)" report field come OUT at Ship, with read-backs.
- Watchdog sheet `publish-audio-watchdog`: step 2C EXTERNALS RE-RESOLVE comes OUT at Ship, with read-backs.
- Four-piece flip + production proofs as §2.8 carries them; the Review candidate for John's optional phone check and its teardown remain Ship follow-ons.

### Concerns and Information Needs

- **The failure may be environment-shaped, and that does not clear it.** §3's evidence says every Cache Storage primitive passes on the re-opened page itself, and fresh-context opens restore cleanly; the failing shape is specifically the same-tab reload — which is also the dominant real-world phone pattern (re-open = reload of the standing tab). Until a run proves the restore in that shape, the release's core promise ("the day cache carries the day") is unproven where it matters most. John's waived phone check is the other evidence that can settle it; it stands available to him, not required.
- Leg 8's pass in this run recorded a 17 ms timeout settle, which reads as the slot already standing missing rather than the hang path being exercised; noted for the next Review's log read, not treated as a failure of the leg as written.
- Contract 90 expectation 2 ("Full gate complete") is recorded BLOCKED, not met: the complete harness-v334 run stands, but the gate sequence stopped at the D5 return rule before the regression re-verification. Expectation 1 (legs 3–4 verdict) met at ~12:13Z, ahead of its 12:35Z deadline; expectation 3 (verdict recorded) met by this section and the phase return.
