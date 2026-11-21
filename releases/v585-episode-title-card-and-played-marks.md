# v585 — Podcast episodes: title card on tap + played marks isolated per episode

## 1 · Scope

Field report (John, Ora thread, 2026-11-21 11:05 CT, verbatim): "Sonerhinf is off. My podcast read items don't appear to be working they a few rhere, but not isolated. Also clicking through from episodes to podcasts doesn't make sense. Clicking an episode should bring up a title card"

TWO MATTERS: (1) podcast played ("read") marks — a few stand, but they are not isolated per episode; (2) episode tap brings up a TITLE CARD instead of the standing tap-to-play / click-through. Matter 2 reverses John's v576 Q5 C pick (tap plays, no click-through) — his new word governs; the reversal is recorded at Scope.

APPROVED (John, Ora thread, 2026-11-21 11:15 CT — picks pasted from package 75's prompt; no formal Space record stands — listapprovals tops at record 39 (v551); the chat approval is the record). RUN LEVEL: STOP BEFORE SHIP.
- Q1 A — the title card stands everywhere episodes list (Praylist rows, series pages, Favorites lists); Play lives on the card.
- Q2 A — the full card: title · series · date + description · its Intention line · Play · star · played state (mark played / mark unplayed).
- Q3 A — existing played marks under the fixed keying: keep marks that map one-to-one; drop ones that cannot be isolated.
- Q4 — Stop before Ship: the diagnosis and the card design come back before anything lands.

## 2 · Plan

### 2.1 Working tree (John's standing-clone ruling, applied)

- Standing clone `~/workspace/projects/ora-pro-nobis/standing-clone`: its local main stood at 7330bd5 (v579), an ancestor of origin/main; fast-forwarded to origin/main c0407d5 (post-v581), verified. Worktree `~/workspace/.worktrees/v585/wt` on branch `release/v585` off c0407d5, clean before any edit. No fresh clone. The branch merges back to main only at Ship — not in this run.

### 2.2 THE DIAGNOSIS — why the played marks are not isolated (production fixtures, read 2026-11-21)

The WRITE keying is sound; the READ fold in the public shape is dead. Three facts, each verified:

1. **Writes key per episode, on both stores.** Server mode: `podcast_listens (series, seq_key)` — the audio courses key `prefix:day-N` (one canonical entry per day number, editions collapse by design), the RSS kind keys the feed GUID (enclosure URL fallback), the own series keys `the-ai-signal-<date>` (one episode per date). Public/device shape: the same writes land in the on-device playback store under the composite key `series|seqKey` (client.ts, the local `/api/player/podcasts/mark` route). Production read-back (app D1, 2026-11-21): 331 listen rows (bible-in-a-year 322 · exorcist-files 3 · daily-gospel-exegesis 2 · barron-sunday-sermons 1 · catechism-in-a-year 1 · counsel-of-trent 1 · daily-readings 1); **every row's seq_key matches exactly one entry in its series' current production snapshot; no snapshot carries a duplicate key.** The server-side fold (podPayload / podRssPayload) is a per-(series, seq_key) map — isolated by construction.

2. **The public shape strips the very field its re-fold tests for.** On the public host the podcasts routes pass every payload through `stripListenState` (index.ts), which removes `listened` / `listenDate` / `listenedAt` / `positionS` from every entry, recursively — by design (the server never serves personal state publicly). The client's one re-fold, `opnFoldPlaybackIntoPodcasts` (client.ts), applies a device-stored listen to an entry **only when the entry still carries a `listened` property** (`'listened' in o`). The strip removed that property from every entry, so the fold can never fire. It is dead in every mode: skipped whole in server mode (the server fold serves there), starved of its gate field in device/web mode.

3. **What John sees follows exactly.** A mark made in the public build writes correctly to the device store — and shows for the rest of that session only, because `writePodMarkQuiet` / `podToggleMark` also flip the in-memory payload copy directly. On the next open the payload arrives stripped, the fold cannot apply the stored mark, and every episode stands unmarked. "A few there" = the in-session flips; "not isolated" = no mark durably belongs to its episode across opens. Positions (resume bars) share the same dead gate and the same fate.

**Secondary keying weakness (same class, latent — no live collision in production today):** audio-course BONUS entries key by a title-derived slug — the Catechism shortcut table (`ciy:bonus-cozzens` / `-cavins` / `-pray`) or the generic first-four-words slug (`podBuildSequence`'s `bonusBySlug` keeps ONE supplier per slug). Two distinct bonus episodes deriving the same slug collapse into one entry under one key: a mark on that key is not isolated to either episode, and the losing episode does not stand at all. Production snapshots today carry no collision (bible-in-a-year: 6 bonuses, distinct slugs; catechism-in-a-year: 3 bonuses, one per shortcut) — the weakness is in the keying rule, not in today's data.

### 2.3 The fix — marks (both halves)

- **Read fold (primary):** `opnFoldPlaybackIntoPodcasts` keys on the entry's identity, not on the stripped field: an object with a string `key`, a string series context, and an episode shape (`url` or `streamUrl` standing) IS a markable entry. It gains `listened: true` + the stored listen fields when a device listen stands under `series|key`; a standing device position sets `positionS` (and `listened: false`) exactly as the fold's standing branches do; otherwise it gains `listened: false` so painters and `podDesc` read a definite state. Series/index card objects carry no `url`/`streamUrl` and stay untouched. Server mode is unchanged (the fold never runs there; the server fold serves).
- **Bonus keying (secondary):** in `podBuildSequence`, when two DISTINCT bonus contents derive the same slug, the first (the standing supplier rule's winner) keeps the bare slug key; each further distinct content keys `prefix:bonus-<slug>-<h>` where `<h>` is a short deterministic hash of its feed GUID/enclosure URL — its own key, its own entry, both stand. No collision → no key changes: every standing bonus key (and every mark on it) is byte-untouched.
- **Q3 migration rule, as it will run:** no store is rewritten in this run. At read time (the fold) and at snapshot build (the bonus rule), a mark KEEPS when its key names exactly one standing entry; a mark whose key names no standing entry is simply never applied (it cannot be isolated to an episode) — nothing is guessed onto another episode. Verified against production: all 331 server rows map one-to-one today, so all keep; the device store validates by the same rule at fold time. The harness proves the rule against a COPY of the production listen set + snapshots; no production D1 write stands in this run.

### 2.4 The fix — episode tap opens the title card (Q1 A · Q2 A)

- **Surfaces (episode rows only):** series pages (audio · RSS · own · novena episode rows), the Praylist's episode rows (podcast inserts and episode-form tracks — novena episodes, own episodes, homily takes), and Favorites' episode rows (starred episodes in Favorite Catechesis, episode rows inside favorite doors' lists). Prayer/book rows are not episodes and keep tap-to-play — John's complaint and the package's mockup are episode-shaped; this boundary stands stated here for his word at the Ship gate.
- **The act change:** tapping an episode ROW opens the card; the row's play disc keeps its standing direct-play act (a deliberate tap on ▶ plays at once, as today). Play on the CARD runs the surface's standing play act for that episode (series page: queue from that episode forward; Praylist: the row's standing queue act; Favorites: play the episode). This is the v576 Q5 C reversal, built as approved.
- **The card (Q2 A, full):** a sheet over the standing page carrying — episode **title** · **series** name · **date + description** (the entry's label/date line and its description text where one stands) · its **Intention line** (the standing per-track draw for that episode key, where a draw stands — the same `state.trackDraws` read the rows already use) · **Play** · the standing **star** (the row's own star act) · **played state** with **Mark played / Mark unplayed** (podcast kind: the standing mark routes via the descriptor's own series + key; day-form episodes: the day-store toggle the completion seam writes — Praylist rows read by the standing presented-date rule, series/Favorites rows read as any standing date under the episode's key).
- **One builder:** a single card builder + opener in client.ts, fed by each surface's standing descriptor (podDesc / podOwnDesc / podNovenaDesc / the Praylist track descriptor / the Favorites episode descriptor) — no per-surface card variants (the one-canonical-element rule).

### 2.5 Harness (rendered client — the v568 lesson)

- `app/harness-v585.mjs`, modeled on harness-v581: it renders the client from the committed tree (the template-literal render the server serves), parses the rendered script whole, and drives it in a DOM with mocked `api()` answers built from PRODUCTION fixtures: the production snapshot entry sets (bible-in-a-year + ora-pro-nobis, trimmed) and the production listen rows read in §2.2.
- Legs: (a) device-mode fold — a stored listen lands on its own episode and no other; an unmarked episode reads `listened: false`; a stored position lands likewise; a listen key naming no standing entry is dropped, never guessed; (b) bonus collision — a synthetic two-contents-one-slug feed build (production-shaped items) yields two entries with distinct keys, and the standing slug key is unchanged when no collision stands; (c) the card — a tap on an episode row on each surface opens the card with all Q2 fields; Play on the card starts the standing act; the mark toggle flips the episode's own mark and no other; the play disc still plays directly; a prayer row still plays on tap; (d) regression — the v581/v579/v577 harness legs that touch these surfaces stay green.
- Review verifies on a clean checkout of the committed tree (the ship-compose rule). No production D1 writes; the marks migration runs against copies only.

## 3 · Implement

Built on branch `release/v585` off the standing clone (main c0407d5), commit 6035a03. Diff confined to `app/worker/src/client.ts`, `app/worker/src/index.ts`, `app/worker/src/ui.ts`, `app/harness-v585.mjs`, and this doc. No migration (newest stays 0042); the SW pin is unmoved (it moves only at Ship).

### 3.1 The fold fix (client.ts)

`opnFoldPlaybackIntoPodcasts` now gates on the entry's identity — a string `key`, a string series context, and an episode shape (`url` or `streamUrl` standing) — exactly the discriminator Plan §2.3 specified. A device listen under `series|key` lands on that entry alone (with its listenDate/listenedAt/source); a standing position lands likewise; every other markable entry gains a definite `listened: false`. Series/index card objects carry neither url nor streamUrl and stay untouched. Server mode is unchanged — the fold never runs there.

### 3.2 The bonus keying fix (index.ts)

`podBuildSequence` groups bonus contents by slug, then by enclosure URL (one content, however many editions carry it). Suppliers sort by the standing rule (newest edition, then latest pubDate): the first keeps the bare `prefix:bonus-<slug>` key byte-untouched; each further distinct content keys `prefix:bonus-<slug>-<hash8>` (a deterministic FNV-style hash of its URL — the build is synchronous, so no async digest stands in it) and stands as its own entry with its own anchor. No collision → no key changes at all.

### 3.3 The title card (client.ts + ui.ts)

- One builder, `openEpisodeCard(model, anchorEl)` — an anchored card in the standing sheet dress (`.menusheet .anchmenu` + the `.epcard` rules in ui.ts), seated by openSheetMenu's anchor math, dismissed by the standing tap-catcher. The body carries the full Q2 set: title · series · date + duration · description · the Intention line (the standing `trackDrawTextFor` seam, where a draw stands) · Play (gold disc + label) · the standing star (`starBtnHtml`, served by the one delegated star handler) · the played state line with a mark toggle (`Mark as played` / `Mark as not played`).
- The mark toggle rides the standing seams only: on the open series page, `podToggleMark` whole; off it, `writePodMarkQuiet` for a mark and the unmark route + `podSyncQueueListened` for an unmark (a failed post enqueues through the standing pod-mark queue); in Favorites, `favPodToggle`; for a homily take, `homilySetPlayed`; for day-form episodes, `writePlayed` under the presented date (the completion seam's own store).
- Played state reads: podcast kind from the entry/descriptor (Favorites: `favPodListenedOf`); homily from its index flag; day-form from the day store — the presented-date read on the Praylist surface, the any-standing-date read on series/Favorites surfaces.
- Wirings (a body tap on the row; any tap on a button inside the row keeps the button's act): the audio series page, the RSS series page, the own (AI Signal) series page, the novena series page — each fed by its standing descriptor builder (`podDesc` / `podOwnDesc` / `podNovenaDesc`) with Play = the page's standing play act (queue from that episode forward); the Praylist's block/episodes pages via `wirePrayersView`'s `[data-card]` pass, gated by `epCardIsEpisode` on the descriptor resolved from `state.dayDescs`, Play = `tapPlay`; Favorites' episode rows (`starredRowHtml` rows), gated to the episode/podcast kinds, Play = `playTrack`.
- `epCardIsEpisode`: kind podcast / homily / external · the AI Signal track · a day-form novena track (`novenaInfo`) · a catalog novena stem (the v577 canon, matched by a BS_CH-built pattern — the template-literal construction rule). Prayer/book rows never pass the gate and keep tap-to-play; series doors and the Podcasts-layer series cards keep their click-through (they are doors, not episodes).
- The row's play disc keeps its standing direct-play act everywhere — the card is the row body's act, not a replacement for the disc.

### 3.4 Harness (working tree)

`app/harness-v585.mjs` against the working tree, BASE c0407d5: **42 ok / 0 not ok** — S-legs (diff confinement · migrations · pin · the fold gate's form · the bonus rule's form · the card's standing · the rendered client parses whole) and L-legs (the fold over production-shaped stripped payloads + production listen rows · the bonus build over production-shaped feed items, incl. the byte-identical no-collision keys · the card's gate, Q2 contents, Play act, and mark toggles through every seam · the Q3 rule over the production listen set: all keep, orphans dropped). Sibling regression on the working tree: harness-v581 30 ok / 1 not ok and harness-v579 34 ok / 1 not ok — the single failure in each is its own S1 diff-confinement leg reading this release's files (structural, expected); every functional leg green. harness-v577's run reads the live feeds; its result stands in the Review record.

### 3.5 Named unrun / open

- No production D1 writes stood in this run; the marks migration ran against copies only (harness L1/L4). The device-side store on John's phone validates by the same fold rule at first open after Ship.
- The v568-class served-leg proof (the served client script parsed whole from the deployed Worker) runs at Ship; here the rendered client parses whole in the harness (S6).
- Field legs after Ship are John's: a mark made in the public build still stands after closing and reopening the app; an episode tap opens the card on each surface.

## 4 · Review

Verified on a CLEAN CHECKOUT of the committed tree (430dbb5 — the ship-compose rule; the worktree stood clean at that HEAD):

- **harness-v585: 42 ok / 0 not ok** on the clean tree, BASE c0407d5 — identical to the working-tree run. The rendered client parses whole (S6).
- **Sibling regression, clean tree:** harness-v581 30 ok / 1 not ok · harness-v579 34 ok / 1 not ok · harness-v576 44 ok / 1 not ok. In each, the single failure is that harness's own S1 diff-confinement leg reading this release's file set against its own release's allowed set — structural and expected; every functional leg is green. harness-v577 ran on the working tree (37 ok / 1 not ok, the same structural S1; its legs read the live feeds) — the clean checkout's code files are byte-identical to the working tree's at this commit, so its result carries.
- **The diagnosis, restated for the Ship gate:** the marks were never mis-keyed at write time — server `podcast_listens (series, seq_key)` and the device store's `series|seqKey` both key per episode, and all 331 production rows map one-to-one onto standing snapshot entries (all keep under Q3 A; nothing is dropped, nothing migrates). What failed was the public shape's READ: the server strips `listened` from every podcasts payload, and the client's re-fold gated on that very field, so a stored mark could never be applied on a fresh open — only the writing session's in-memory flip showed ("a few there"), and it died at the next open. The fold now gates on the entry's identity. The bonus-slug collision fix is latent protection: no production snapshot carries a collision today, and with no collision every standing key is byte-untouched.
- **The card, as built vs Q2 A:** title · series · date + description · Intention line (where a draw stands) · Play · star · played state with mark played/unplayed — one builder, every episode surface. The boundary stands as built in §3.3: prayer/book rows keep tap-to-play; series doors keep their click-through; the row's play disc keeps direct play.
- **Unrun, named:** no production D1 write stood anywhere in this run; the served-leg parse of the DEPLOYED Worker and the pin bump belong to Ship; the device-store validation on John's phone happens at first open after Ship (the fold rule itself is harness-proven against production copies).
- **HELD AT THE SHIP GATE** per the approved run level (Stop before Ship). No ship, no deploy, no merge to main in this run. The branch `release/v585` stands at 430dbb5 (+ this section's doc commit) off the standing clone, ready for John's word.

## 5 · Ship

John's word (Ora thread, 2026-11-21 11:32 CT): "Ship.585" — the Ship gate lifts.

- Main had moved since the build: origin/main stood at 6307094 (v586 merged). `release/v585` was rebased onto it — clean, no conflicts (rebased head 1adcffa).
- **harness-v585 on a clean checkout of the rebased tree (BASE origin/main): 42 ok / 0 not ok** — identical to the Review run; the rendered client parses whole.
- Before the merge, main moved again under concurrent ships (v584, then v583 merged; the first v585 merge into the clone's main was superseded when those seats moved the main ref). `release/v585` was rebased a second time onto the standing main (the v583/v584 line); the only conflict was the SW pin line, resolved to `ora-pro-nobis-v585-1`. The harness re-ran on a clean checkout of the final tree before the merge (its S3 leg reads the pin move itself — the Ship step — as the single named exception).
- SW pin bumped to `ora-pro-nobis-v585-1` in this Ship commit.
- Merge to main, push, Worker deploy, What's New, and the row flip are recorded in the Ship phase record (DevOps Board row 1559).
