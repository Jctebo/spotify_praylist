# v315 — Freshness monitor for the public RSS feed

- **Project:** Ora Pro Nobis
- **Slug:** v315-rss-feed-freshness-monitor
- **Registry:** DevOps Board app, project ora-pro-nobis, row id 574, version "v315", status Backlog, Run Directive "Scope only"
- **Branch:** release/v315 in the fork (~/workspace/projects/spotify_praylist-fork)
- **Run Directive:** Scope only — the Scope Gate holds this release at Scope. This document is the scope package for John (with the HTML package at ~/workspace/your_files/v315-scope-package.html); Plan does not open until John approves and sets the level.

## 1 · Scope

- **Agent:** Scope Agent (v315) — Scope claim record 1065, claimed 2026-11-08 23:49 UTC (17:49 CT)
- **Inputs read:** the v315 registry row (id 574) · John's approval of grooming-review recommendation #3 (main chat, 2026-11-08) and the analyst document (~/workspace/your_files/grooming-review-2026-11-08.md, item #3) · the live public feed fetched first-hand during this pass (both addresses) · the ora-pro-nobis-nightly-run job sheet (the publish step and its cadence) · the publish-audio-watchdog job sheet (05:40 CT, the standing morning feed check) · the spotify-playlist-refresh-watchdog job sheets (02:30 CT and the v303 5:00 AM pass) · the v312 Scope section (the diagnosis of record for the stale feed)

### John's decision (settled — not re-opened by this section)

John approved grooming-review recommendation #3 in the main chat on 2026-11-08: a **read-only freshness check on the public RSS feed file itself**, riding the existing watchdog/report pattern. Endpoints are frozen. Quality axis, size S, risk LOW (the row's own sizing).

### Diagnosis of record — the gap this release closes

Verified 2026-11-08 (the v312 player diagnosis): the public feed at `orapronobis.media/podcast.xml` silently went stale in the days before that diagnosis — its newest item stood at **Nov 5, 2026** while production continued. Nothing whose only subject is the feed file caught it: the prayer app masked the gap (it read the same stale feed), and the Spotify watchdogs verify playlists, never the feed.

The checks that DO exist today, verified from their job sheets in this pass:

1. **At publish, inside the nightly run** (00:00 CT, target = run date + 2): pass 2 verifies the live feed after grafting the day's items. This proves the feed at one instant, inside the run whose own failure is one of the things a monitor exists to catch.
2. **publish-audio-watchdog (05:40 CT):** fetches `jctebo.github.io/spotify_praylist/podcast.xml` and compares its newest pubDate against the expected date — but only as a cross-check of **last night's drop against the published-drops ledger**. Its verdict is about the drop ("Publish audio: succeeded / failed — expected <date>"), it inherits the ledger's state, and it reads the pre-redirect address. If the ledger and the feed disagree for any other reason — or the feed stalls on a morning the ledger reads fine — there is no verdict whose subject is the feed itself.
3. **Spotify playlist watchdogs (02:30 CT + v303's 05:00 CT pass):** verify playlist items and their rendering. They never fetch the feed file.

**The residual gap:** no independent, feed-file-only freshness verdict — a check that reads the public feed at its canonical address, applies a named stale threshold, and reports its own one-line verdict, owing nothing to the ledger or to production's self-report.

### Discovery findings (verified this pass)

1. **The public chain:** `https://jctebo.github.io/spotify_praylist/podcast.xml` answers **301 → https://orapronobis.media/podcast.xml** (fetched first-hand, 2026-11-08 17:49 CT). The canonical address returned 200 with the full feed.
2. **The feed today:** 2,070,275 bytes · **2,804 items** · newest pubDate **Tue, 10 Nov 2026 00:00:00 -0600** — fresh at this pass. This monitor guards a recurrence; there is no live fault to fix.
3. **The cadence the threshold keys on:** production publishes the target date (run date + 2) as one drop at 00:00 CT, and feed items carry that date at 00:00 -0600. On any morning, the feed's expected newest date is therefore **check date + 2** (America/Chicago) — the same expected date the 05:40 watchdog already computes for its ledger check.
4. **The watchdog report pattern:** every standing watchdog reports **always, one short line**, evidence/link only on failure (John's delivery rule, 2026-10-11), and appends a one-line result to the daily log. The 05:40 job delivers to the main chat. This release's check speaks in exactly that shape.
5. **No repair path belongs to a monitor:** a stale feed's remedy is the production reconcile path (v299, ledger flip last). The monitor names the state; it never publishes, never edits the feed or the ledger, never re-runs production.

### Scope Record

- **Outcome:** every morning, an independent read-only check states the public feed's freshness in one line — a stale feed is caught the same morning it goes stale, never days later by accident.
- **In scope:**
  1. **The check.** Fetch the feed at its canonical public address, `https://orapronobis.media/podcast.xml` (GET only), and read: the HTTP status, the newest item's pubDate, and the count of items carrying that newest date. The fetch also confirms the pre-redirect address (`jctebo.github.io/spotify_praylist/podcast.xml`) still lands on the canonical address — the redirect is part of the public chain listeners traverse.
  2. **The threshold (named).** The expected newest date is **check date + 2** (America/Chicago), the production cadence's standing target. **FRESH** = the canonical address returns 200 and its newest item date equals the expected date. **STALE** = the newest item date is older than expected, OR the fetch fails, OR the address does not return 200, OR the redirect no longer lands on the canonical address. A newest date *newer* than expected cannot occur under the cadence and is reported as an anomaly line, not as fresh. The threshold is one full production cycle: a feed behind by even one day is stale.
  3. **The ride.** The check rides the existing morning watchdog pattern as an **independent second verdict inside the publish-audio-watchdog job (05:40 CT)** — that job already fetches this same file for its ledger check, so one fetch carries two verdicts — with one binding difference: **this verdict never reads the published-drops ledger.** It judges the feed file alone. (Plan may instead seat it as a sibling job at the same hour if the job-sheet edit reads cleaner; the independence rule and the report shape are the scope, the seat is Plan's detail.)
  4. **The report surface (named).** The job's standing delivery (the main chat), one line, always reported: `RSS feed: fresh — newest <date> (<N> items)` or `RSS feed: STALE — newest <date>, expected <date>` with the canonical feed link on the STALE line only; plus the standing one-line append to the daily log (~/memory/YYYY-MM-DD.md), matching the sibling watchdogs.
  5. **Read-only, exactly.** GET requests against the two public addresses. No write to the feed, the ledger, R2, GitHub, or any endpoint; no re-run of any job; no repair action of any kind.
- **Out of scope:** feed production and publish (the nightly run, unchanged) · the ledger and its reconcile path (v299, unchanged) · Spotify playlists and their watchdogs (v303, unchanged) · the prayer app (v312 removes its feed dependence separately) · any endpoint, redirect, or hosting change (**endpoints frozen**) · auto-repair of a stale feed · checking episode audio reachability (enclosure URLs) — the subject is the feed file's freshness, not the audio hosts.
- **Affected surfaces:** one cron job sheet (publish-audio-watchdog) and its morning report — one added line. No fork code, no Worker, no D1, no public surface changes.
- **Review placement:** at the job-sheet diff plus the first live morning run's read-back (the fresh line with the correct expected date); no phone check — there is no UI.

### Acceptance criteria

1. On a fresh morning, the morning report carries `RSS feed: fresh — newest <today+2> (<N> items)` with N equal to the items the nightly run published for that date.
2. With the feed's newest date one day behind expected (the recorded Nov 5–8 incident is the shape), the report carries the STALE line naming both dates and the canonical link.
3. The verdict is computed without reading the published-drops ledger — the job-sheet text shows the independence, and the two verdicts (drop vs feed) can disagree without either suppressing the other.
4. The check performs GETs only: after a run, the feed file, the ledger, and every endpoint stand byte-unchanged.
5. The existing `Publish audio:` verdict line and the job's board check-off behave exactly as before.

### Concerns and Information Needs

- **Facts:** the redirect chain, feed size, item count, and newest date are as fetched first-hand above · the 05:40 watchdog already fetches the pre-redirect address daily, so the added fetch cost is one ~2 MB GET (or zero, if Plan shares the job's existing fetch) · production has no skip days — the cadence is daily, so check date + 2 is always the right expectation.
- **Assumptions:** the canonical public address is the right subject (podcast apps resolve the submitted URL through the same redirect) · "always report, one line" remains John's wanted shape for a watchdog verdict, as with its siblings.
- **Uncertainties:** whether the Nov 5 staleness sat at the canonical address, the pre-redirect address, or both was never isolated (by the v312 live fetch the target already carried items through Nov 10) — the check therefore reads the canonical address AND verifies the redirect, covering both seats of the fault. A morning where production itself is delayed past 05:40 would read STALE for the feed and failed for the drop together; that is a true report, not a false alarm, and the two lines name their own subjects.
- **Decision impact:** none open for John inside his approval — the threshold, the report line, and the independence rule are stated above for his eye at approval; Plan settles only the seat (step inside the 05:40 job vs sibling job).
- **First source to check:** the publish-audio-watchdog job sheet (the fetch and report pattern this rides) and the live feed itself.

### Recommended approval level

- **Recommendation: To Ship (level 6 — Autonomous to Ship).**
- **Reason:** the change is one read-only verdict inside an existing watchdog's job sheet — no code, no endpoint, no production behavior, fully reversible by removing the step. The evidence is a document diff and one morning's read-back; a separate Ship word from John would add a round trip without adding a check. Plain "approve" sets this level.

## 2 · Plan

- **Agent:** Plan Agent (v315) — Plan claim record 1075, claimed 2026-11-08 23:59 UTC (17:59 CT)
- **Level in force: Autonomous to Ship (level 6)** — John approved the package 2026-11-08 ~17:57 CT at §1's recommended level (registry run_directive verified). The chain runs Scope · Plan · Implement · Review · Ship without stopping; this Plan's Ship-step draft (P7) is written for that run.
- **Amendment — approval (dated 2026-11-08, at Plan seating):** §1 above stands unrewritten. John's approval sets the level at **Autonomous to Ship**; the seat choice §1 left to Plan is settled in P1 (step inside the 05:40 job).
- **Inputs read:** §1 in full · WF-2-PLAN skill · the live `publish-audio-watchdog` job sheet (cron.view, 2026-11-08 — the exact body P7 revises: ledger step 1 · feed fetch step 2 · decide step 3 · report-only step 4 · daily-log step 5 · board check-off of task 148) · §1's first-hand feed facts (canonical 200 · 2,804 items · newest Tue, 10 Nov 2026 00:00:00 -0600).
- **Plan writes NO production code and does NOT edit any live job sheet.** The job-sheet edit is a Ship step (P7), drafted in full below (the v306/v312 precedent).

### P1 — The seat: a step inside the publish-audio-watchdog job (settled)

§1 left Plan one choice — a step inside the 05:40 job vs a sibling job at the same hour. **Settled: inside, as a new step 2B** in `publish-audio-watchdog` (daily 05:40 CT). Reasons: the job already fetches this feed every morning and delivers to the same chat under the same always-report rule, so the verdict lands beside its sibling with no new schedule, no new delivery surface, and no second 05:40 report; a sibling job would duplicate the fetch and split one morning's picture across two reports. The independence §1 binds is **logical, not physical**: step 2B never reads the published-drops ledger (the job's step 1 data is off-limits to it), never reads step 3's verdict, and performs its own fetches (P2) — the two verdicts can disagree without either suppressing the other (§1 criterion 3).

### P2 — The fetch pair and the pubDate parse rule (exact)

Step 2B performs two GETs of its own, in order:

1. **Redirect check.** GET `https://jctebo.github.io/spotify_praylist/podcast.xml` **without following redirects**. Expected: HTTP 301 (any 3xx in 301/302/307/308 is accepted) whose `Location` is exactly `https://orapronobis.media/podcast.xml`. Any other outcome — a direct 200, a redirect to a different address, a non-3xx error, or a fetch failure — is a **redirect break** (a STALE-class fault, P3; a transport failure here is a check failure, P3's distinction applies: if the request itself cannot complete, the verdict is CHECK FAILED, not STALE).
2. **Canonical fetch.** GET `https://orapronobis.media/podcast.xml`, redirects followed (none expected). Expected: HTTP 200 with the feed body (~2 MB — the standing size; no size pin, the parse rule below is the guard).

**Parse rule (the date read).** From the canonical body: split out every `<item>…</item>` block in document order; from each block take the first `<pubDate>` value; parse it as RFC 822 (the feed's standing form, e.g. `Tue, 10 Nov 2026 00:00:00 -0600`); convert the instant to its **America/Chicago calendar date**. **Newest** = the maximum of those dates; **N** = the count of items whose Chicago date equals newest. Items with a missing or unparseable pubDate are ignored for the newest computation. If the body yields **zero** parseable pubDates, or the body does not contain `<item` at all, the read has failed — that is a **check failure** (P3), never a stale verdict: the monitor could not read its subject, and it says so.

**Expected date.** Check date (America/Chicago, the morning the job runs) **+ 2 days** — the production cadence's standing target, the same expected date the job's step 1 already computes for the ledger check. Step 2B computes it independently from the calendar, not from the ledger entry.

### P3 — The verdict rules (exact, exhaustive)

| Inputs | Verdict |
|---|---|
| Redirect intact · canonical 200 · newest = expected | **FRESH** |
| Redirect intact · canonical 200 · newest older than expected (by one day or more) | **STALE** — content behind the cadence |
| Redirect broken (wrong target, direct 200, non-3xx) with the canonical fetch otherwise readable | **STALE** — the public chain listeners traverse is broken |
| Canonical fetch returns non-200 · canonical body unparseable / zero parseable pubDates | **CHECK FAILED** — the check could not read the feed; this names a failure of the read, not stale content |
| Either request cannot complete at all (network error, timeout, DNS) | **CHECK FAILED** — named with the failing address |
| Newest **newer** than expected (cannot occur under the cadence) | **ANOMALY** — reported as its own line, never as fresh (§1) |

The distinction §1 requires is the middle band: **STALE is a statement about the feed's content or its public chain; CHECK FAILED is a statement about the monitor's own read.** A morning where production itself ran late reads STALE (content) beside the drop verdict's failure — a true report on both lines, each naming its own subject (§1).

### P4 — The report lines (exact strings)

The job's standing delivery (the main chat) gains one line, **always reported**, immediately after the `Publish audio:` line:

- Fresh: `RSS feed: fresh — newest <YYYY-MM-DD> (<N> items)`
- Stale: `RSS feed: STALE — newest <YYYY-MM-DD>, expected <YYYY-MM-DD>` followed by the canonical link `https://orapronobis.media/podcast.xml`
- Check failed: `RSS feed: CHECK FAILED — <cause: the failing address + what failed>` followed by the canonical link
- Anomaly: `RSS feed: ANOMALY — newest <YYYY-MM-DD> is ahead of expected <YYYY-MM-DD>` followed by the canonical link

Rules: the link stands on the STALE, CHECK FAILED, and ANOMALY lines only — never on the fresh line (the standing watchdog delivery rule: evidence/link on failure only). Dates are Chicago calendar dates. The standing one-line append to the daily log (~/memory/YYYY-MM-DD.md) carries the same line. The `Publish audio:` line, the ledger read, and the board check-off of task 148 behave exactly as before (§1 criterion 5) — the job now reports two lines, each its own subject.

### P5 — Read-only and independence pins

- Step 2B issues **GET requests only**, against the two public addresses in P2. No write to the feed, the ledger, R2, GitHub, or any endpoint; no re-run of any job; no repair action (§1 item 5). After a run, the feed file, the ledger, and every endpoint stand byte-unchanged (§1 criterion 4).
- Step 2B does not read `published-drops.json`, does not reuse step 2's fetched body for its verdict (its own fetch pair, P2), and does not read or alter step 3's decision. Step 3 does not read step 2B's verdict.
- **Endpoints frozen:** neither address changes; the redirect itself is verified, never edited.

### P6 — Proof: fixture rehearsal (Implement's harness)

There is no code artifact in this release — the check is a job-sheet step executed by the watchdog run — so the proof is a **rehearsal of step 2B's procedure** against fixtures, run by Implement and recorded verbatim in §3. Fixtures stand in the release folder (`releases/fixtures/v315/`, committed on the branch):

1. **feed-fresh.xml** — a minimal valid feed (3 items) whose newest pubDate is a fixed date D; the rehearsal runs with "check date" = D − 2, so expected = D. Required output: the FRESH line with the correct date and N = the items dated D.
2. **feed-stale.xml** — the same fixture with every pubDate shifted −3 days; same stated check date. Required output: the STALE line naming both dates.
3. **feed-unreachable** — no file: the rehearsal points the canonical fetch at a reserved unroutable address. Required output: the CHECK FAILED line naming the address — and expressly **not** a STALE line (P3's distinction, proven).
4. **Redirect case** — rehearsed against the live chain at Review (P7), not by fixture: the rehearsal records the live pre-redirect response (status + Location) once, proving the redirect leg of P2 against the real public chain.

The rehearsal substitutes the fixture body/address for the canonical fetch and states its check date openly; everything else follows P2–P4 word for word. §3 records the four produced lines verbatim beside the required outputs. Any mismatch is a §1-text defect (return to Scope) or a draft defect (fix the P7 draft and re-rehearse) — Implement names which.

### P7 — The Ship step: the live job-sheet edit, drafted in full

The edit is applied at Ship (never at Plan or Implement) by `cron.update` on job **`publish-audio-watchdog`**, passing the job's existing body with exactly these changes, then read back with `cron.view` before anything else proceeds:

1. **Insert as new step 2B**, immediately after the existing step 2 (the feed fetch) and before the existing step 3 (Decide):

> 2B. RSS FEED FRESHNESS (v315) — an independent verdict on the feed file itself. This step NEVER reads the ledger from step 1 and never reads step 3's verdict. (i) GET https://jctebo.github.io/spotify_praylist/podcast.xml WITHOUT following redirects: the redirect is intact only if the response is a 3xx whose Location is exactly https://orapronobis.media/podcast.xml. (ii) GET https://orapronobis.media/podcast.xml: read every item's pubDate, convert each to its America/Chicago calendar date; newest = the maximum; N = the items dated newest. Expected = today (America/Chicago) + 2 days. (iii) Decide: newest = expected and redirect intact → "RSS feed: fresh — newest <date> (<N> items)". Newest older than expected, or the redirect broken → "RSS feed: STALE — newest <date>, expected <date>" plus the link https://orapronobis.media/podcast.xml. A fetch that cannot complete, a non-200 on the canonical address, or a body with no parseable pubDate → "RSS feed: CHECK FAILED — <the failing address and what failed>" plus the link (a failed read is not stale content). Newest newer than expected → "RSS feed: ANOMALY — newest <date> is ahead of expected <date>" plus the link. GETs only — never edit the feed, the ledger, or any endpoint; never re-run anything; the remedy for a stale feed is the production reconcile path, never this job.

2. **Amend step 5 (Bookkeeping)** so the daily-log append carries **both** result lines (the `Publish audio:` line and the `RSS feed:` line).
3. **Amend the Delivery rule line** to read: "ALWAYS report every check, one short line per verdict (Publish audio · RSS feed); include the link only on failure."
4. Nothing else in the body changes — the ledger steps, the Decide step, the report-only rule (extended by 2B's own text), and the BOARD CHECK-OFF section stand word-for-word.

**Sequence at Ship (level 6, the chain runs through):** (a) apply the `cron.update` above and read the body back with `cron.view` — the read-back diff against this draft is the Ship evidence for the edit; (b) the next live 05:40 run is the first live morning: **Review placement for this release stands here** (§1) — the Review pass reads the job-sheet diff and that first run's delivered `RSS feed:` line (fresh, with the expected date = run date + 2, or a true STALE/CHECK FAILED line judged on its own facts); (c) on Review pass, the standard flip: registry row Live + shipped record + What's New + document republication with §5. A first live line that is wrong in shape (wrong expected date, link on a fresh line, a ledger-derived verdict) returns the release to Implement/Ship to fix the sheet forward — the edit is one step's text, fully reversible by removing step 2B.

### Sequence for Implement

1. Build the three fixtures (P6) in the release folder and commit them on `release/v315`.
2. Rehearse step 2B's procedure against the fixtures + the live redirect leg; record the produced lines verbatim in §3 beside P6's required outputs.
3. Write §3 (fixtures, rehearsal lines, any draft defect found and fixed in the P7 text by dated amendment to this section — §1 and this §2's passed text stand; a rehearsal-driven wording change to P7's draft is recorded as a Plan amendment, not a silent edit).
4. Review + Ship run per P7's sequence (Review at the sheet diff + first live morning; Ship applies the edit — under level 6 the Implement agent does **not** touch the live sheet; the Ship seat does).

### Concerns and Information Needs

- **Facts:** the current job body is as quoted from `cron.view` in this pass (steps 1–5 + check-off) · the job already fetches the pre-redirect address daily; step 2B adds one redirect probe (headers only in effect) + one canonical GET (~2 MB) — cost is trivial and named · the feed's pubDates carry `-0600` offsets and the date rule is the Chicago calendar date, so an item stamped 00:00 -0600 on the target date reads as that date, matching the cadence.
- **Assumptions:** the watchdog run can issue a redirect-non-following GET (a standard fetch option; if the run's fetch tool always follows redirects, Implement's rehearsal names it and the Ship draft's step text adapts to read the final landed address + response chain — the verdict rules do not change) · "today + 2" inside the job is computed in America/Chicago as the standing body already does for its expected date.
- **Uncertainties:** the Nov 5 fault's seat (canonical vs pre-redirect) was never isolated — P2 covers both seats, as §1 directs · a morning where the nightly run is merely late (publishes after 05:40) reads STALE for one morning and fresh the next; that is the monitor working as §1 specifies (the threshold is one full cycle), not a false alarm to soften.
- **Decision impact:** none open for John — the level is set (Autonomous to Ship), the seat is settled (P1), and every line shape is pinned above.
- **First source to check:** the revised job body read back at Ship (`cron.view publish-audio-watchdog`) against P7, and the first live morning's delivered line.
