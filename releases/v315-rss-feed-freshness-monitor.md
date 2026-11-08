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
