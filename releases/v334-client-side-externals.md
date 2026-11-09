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
