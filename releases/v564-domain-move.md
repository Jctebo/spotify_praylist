# v564 — Domain move: the app served on orapronobis.media

## 1. Scope

Member 4 of 5 of the v567 redesign set (approved TO SHIP by John, 2026-11-20 23:01 CT; formal Scope record 60 all-A To Ship). The app gains its public home: the Worker attaches to **app.orapronobis.media** and serves the free build there openly — **no sign-in anywhere on the new hostname** (the package's Q4 "branded sign-in as only door" answer stands SUPERSEDED by the v567 redesign and John's word: "Why sign in. I thought I didn't need it." — the door is Start Praying, carried by the v571 landing page; no sign-in was built).

The redesign's rule, in John's words (2026-11-20 22:28 CT): there is NO account service — a person's own data lives in the app on their phone; the web app carries the free prayers for everyone. This release builds the server half of that rule:

- On the public host, the free tier serves whole: the day, the day-set manifest (v569), Mass + readings, the prayer book + its audio, episode audio + texts, the podcast series, sources/settings, wallpapers.
- Personal data never serves on the public host: the day builders' personal folds (drawn intention texts, completions, the day's addendum, profile fold, day positions, block order, day additions, intro texts) read empty; personal reads answer their empty shapes; **every write is refused** with the pointer to the app on the person's phone.
- The private host (ora-pro-nobis-app.john-thibeaux.workers.dev) keeps its standing posture byte-for-byte: Cloudflare Access + johnOnly, the agent door first, all payloads whole. FROZEN surfaces untouched: the apex publish site, the RSS feed, the audio host (audio.orapronobis.media), the nightly publish.

Client changes: none in this release except the service-worker pin at Ship. The client copy that points personal surfaces at the native app is v568's surface (Track 1); the seam is named in §5.

## 2. Plan

- **Hostname split at the standing gate point.** `isPublicHost` (the request hostname is app.orapronobis.media; under LOCAL_DEV only, an `x-opn-host-probe: public` header probes the posture for the served-leg proof — production ignores the header). Where the session gate ran johnOnly, the public host runs `publicGate` instead; the agent door stands before the gate, unchanged, on both hosts.
- **The public gate.** Non-API paths proceed (the shell is the public face). Any non-GET under /api/ → 403 with the pointer body (`code: "personal-in-app"`). Personal GETs answer canned empties in the builders' own no-data shapes: intentions `[]`, starred `[]`, book favorites `[]`, the day's Universal Prayer intentions `[]`, Mass personal prayers (four empty seats), profiles (`profiles: [], state: null, effective: null` — the builder's own no-store shape), block order `null`, the examination read (run null, no prompts/entries — the real builder CREATES a run on read, so it never runs on the public host), reflections (empty groups), the confession read (empty guide/history), PIN state (not set). Public GETs proceed to their handlers. Any other /api/ GET → 403 fail-closed with the pointer.
- **Sanitization in the builders** (a `pub` flag threaded from the gate): `prayerDayPayload` — no draw is taken (the draw writes standing rows), no completions read, no addendum read; `playerDayPayload` — no profile store, no day positions, contract block order, no day additions, `introTexts` empty (that map is the drawn intention texts' home in the shell, and the episode draw behind it writes rows — neither runs); `dayManifestPayload` passes `pub` through. The podcasts route strips every entry's listen state (`listened`, `listenDate`, `listenedAt`, `positionS`) recursively under `pub` — the client's fresh state.
- **Domain attach** via the Workers Domains API (the connector token holds Workers + the zone's DNS Edit, verified 2026-11-21): `PUT /accounts/<id>/workers/domains {hostname: app.orapronobis.media, service: ora-pro-nobis-app, environment: production}` — creates the DNS record + certificate; verified by read-back and by live fetches of the public host after deploy. The gate ships BEFORE the domain attaches, so the hostname never serves a pre-gate build.
- **Gates:** harness-v564 (static confinement + posture) on the build tree and a clean checkout of the committed tree; PRAYER_AUDIO byte-identical vs main; served-leg proof under `wrangler dev --remote` with LOCAL_DEV (public posture via the probe header against production D1 + the live feed, private posture without it); after deploy + attach, live proof on the real hostname (shell 200, day + manifest sanitized, a personal read empty, a write refused, the private host's door read whole).

## 3. Implementation

Branch `release/v564` from main b9ce143 (post-v569); Implement commit `46cf8d7`; Implement phase record 2282 (holder v564-chain-track2, contract 693).

Worker (`app/worker/src/index.ts`, the only source file touched):

- `PUBLIC_HOST`, `isPublicHost`, `PUBLIC_POINTER`, `publicGate`, `stripListenState` added beside `johnOnly`.
- The session gate: `const pub = isPublicHost(request, env)`; on the public host `publicGate` answers or passes; on every other host `johnOnly` runs exactly as before. The agent-day-read exemption stands in front, unchanged.
- `prayerDayPayload(env, date, pub)`, `playerDayPayload(env, dateOverride, pub)`, `dayManifestPayload(env, date, pub)`; the day, day-manifest, and player-day routes pass `pub`; the five podcasts payload returns at the session route wrap with `stripListenState` under `pub` (the door's podcasts route is untouched).

No client source change in Implement (the pin moves at Ship); no migration; no change to the apex site, the feed, or the audio host.

## 4. Review

Light review under the set's To-Ship approval (fresh seat; the streamlined path):

- **harness-v564: 12 ok / 0 not-ok** on the build tree AND on a clean checkout of Implement HEAD `46cf8d7` (git archive). Checks: the gate's presence + placement (door precedes gate), write refusal with the pointer, the canned empties, both builders' pub folds, pub threading at every route, the five podcasts strip sites, the exam read canned (the creating builder never runs publicly), no sign-in surface built, PRAYER_AUDIO present.
- **PRAYER_AUDIO byte-identical** vs origin/main, verified from the clean checkout.
- **Served-leg proof** (`wrangler dev --remote`, LOCAL_DEV, production D1 + live feed, from the clean tree):
  - Private posture (no probe): the day for 2026-11-21 carries its drawn intention texts and addendum — the standing payload whole.
  - Public posture (probe): day 200 with **zero** intention texts across all 7 blocks, addendum empty, doneCount 0; day-manifest (settled 2026-11-20) 200, zero intention texts, 14 assets; player day 200 with `introTexts {}`, `profile null`, `dayPositions {}`, `additions []`, 7 blocks; intentions read → `{ok: true, intentions: []}`; examination read → 200, run null, 0 entries; a POST (day-position) → **403 `personal-in-app`**; podcasts index carries no `listened`/`positionS` keys (the series payloads strip through the same five wrapped returns, harness S8).
- **Fixture provenance:** every leg ran against the production database and the live feed — no invented fixtures.

## 5. Ship

(Pending — written at Ship.)
