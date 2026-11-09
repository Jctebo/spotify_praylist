#!/usr/bin/env python3
"""v315 — RSS feed freshness check: step 2B of publish-audio-watchdog, as a runnable script.

This is the rehearsal form of the procedure §2 (P2–P4) pins for the job-sheet step.
The Ship step carries the same procedure into the live job sheet as prose; the rules
here and there are identical:

  Fetch pair (GETs only; the check NEVER reads the published-drops ledger):
    1. Redirect probe — GET the pre-redirect address WITHOUT following redirects.
       Intact only if the response is a 3xx (301/302/307/308) whose Location is
       exactly the canonical address.
    2. Canonical GET — the feed body at the canonical address.
  Parse rule: every <item>'s first <pubDate>, parsed as RFC 822, converted to its
  America/Chicago calendar date; newest = max; N = items dated newest.
  Expected date = check date (America/Chicago) + 2 days.
  Verdicts (exhaustive): FRESH · STALE · CHECK FAILED · ANOMALY — per §2 P3.
  Report lines: §2 P4 exact strings; the canonical link follows the line on
  STALE / CHECK FAILED / ANOMALY only, never on FRESH.

Usage:
  Live:       check_feed_freshness.py [--check-date YYYY-MM-DD]
  Fixture:    check_feed_freshness.py --check-date YYYY-MM-DD --canonical-file feed.xml
              (the fixture body stands in for the canonical GET, status 200; the
              redirect leg is rehearsed separately against the live chain)
  Unreachable: check_feed_freshness.py --check-date YYYY-MM-DD --canonical-url URL
              (a real GET against URL; a transport failure is CHECK FAILED, never STALE)
"""

import argparse
import re
import sys
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta
from email.utils import parsedate_to_datetime
from zoneinfo import ZoneInfo

PRE_REDIRECT_URL = "https://jctebo.github.io/spotify_praylist/podcast.xml"
CANONICAL_URL = "https://orapronobis.media/podcast.xml"
CHICAGO = ZoneInfo("America/Chicago")
REDIRECT_STATUSES = {301, 302, 307, 308}
TIMEOUT_S = 30


class TransportFailure(Exception):
    """A request that cannot complete at all (network error, timeout, DNS)."""

    def __init__(self, url, cause):
        super().__init__(f"{url}: {cause}")
        self.url = url
        self.cause = cause


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # do not follow; urllib then raises HTTPError carrying the 3xx


def _get(url, follow_redirects):
    """Return (status, headers, body-bytes). HTTP error statuses are returned, not
    raised; only a request that cannot complete raises TransportFailure."""
    opener = urllib.request.build_opener() if follow_redirects else urllib.request.build_opener(_NoRedirect())
    req = urllib.request.Request(url, headers={"User-Agent": "v315-feed-freshness-check"})
    try:
        with opener.open(req, timeout=TIMEOUT_S) as resp:
            return resp.status, resp.headers, resp.read()
    except urllib.error.HTTPError as e:
        try:
            body = e.read()
        except Exception:
            body = b""
        return e.code, e.headers, body
    except Exception as e:  # URLError, timeout, DNS, TLS — the request cannot complete
        raise TransportFailure(url, f"{type(e).__name__}: {e}") from e


def redirect_probe(pre_url, canonical_url):
    """Return 'intact' or 'broken'. Raises TransportFailure if the probe cannot complete."""
    status, headers, _ = _get(pre_url, follow_redirects=False)
    if status in REDIRECT_STATUSES and headers.get("Location") == canonical_url:
        return "intact"
    return "broken"


def parse_dates(body_text):
    """Chicago calendar dates of every parseable item pubDate, in document order."""
    dates = []
    for block in re.findall(r"<item\b.*?</item>", body_text, flags=re.S):
        m = re.search(r"<pubDate>(.*?)</pubDate>", block, flags=re.S)
        if not m:
            continue
        try:
            instant = parsedate_to_datetime(m.group(1).strip())
        except (TypeError, ValueError):
            continue
        if instant is None:
            continue
        if instant.tzinfo is None:
            instant = instant.replace(tzinfo=CHICAGO)
        dates.append(instant.astimezone(CHICAGO).date())
    return dates


def check(check_date, pre_url=PRE_REDIRECT_URL, canonical_url=CANONICAL_URL,
          canonical_file=None, skip_redirect_probe=False):
    """Run the §2 procedure. Returns the verdict line(s) to print."""
    expected = check_date + timedelta(days=2)
    link = CANONICAL_URL  # §2 P4: the link is the standing canonical address, even when a rehearsal substitutes the fetch target

    # Leg 1 — redirect probe (skipped only in fixture mode, where the fixture body
    # substitutes for the canonical fetch and the redirect leg is rehearsed live).
    redirect = "intact"
    if not skip_redirect_probe:
        try:
            redirect = redirect_probe(pre_url, canonical_url)
        except TransportFailure as f:
            return [f"RSS feed: CHECK FAILED — {f.url} — the redirect probe could not complete ({f.cause})", link]

    # Leg 2 — canonical fetch (or the fixture body standing in for it).
    if canonical_file is not None:
        status, body = 200, open(canonical_file, "rb").read()
    else:
        try:
            status, _headers, body = _get(canonical_url, follow_redirects=True)
        except TransportFailure as f:
            return [f"RSS feed: CHECK FAILED — {f.url} — the fetch could not complete ({f.cause})", link]
    if status != 200:
        return [f"RSS feed: CHECK FAILED — {canonical_url} — the canonical fetch returned HTTP {status}", link]

    text = body.decode("utf-8", errors="replace")
    dates = parse_dates(text) if "<item" in text else []
    if not dates:
        return [f"RSS feed: CHECK FAILED — {canonical_url} — the body carried no parseable pubDate", link]

    newest = max(dates)
    n = sum(1 for d in dates if d == newest)

    if redirect == "broken":
        return [f"RSS feed: STALE — newest {newest.isoformat()}, expected {expected.isoformat()}", link]
    if newest == expected:
        return [f"RSS feed: fresh — newest {newest.isoformat()} ({n} items)"]
    if newest < expected:
        return [f"RSS feed: STALE — newest {newest.isoformat()}, expected {expected.isoformat()}", link]
    return [f"RSS feed: ANOMALY — newest {newest.isoformat()} is ahead of expected {expected.isoformat()}", link]


def main(argv=None):
    ap = argparse.ArgumentParser(description="v315 RSS feed freshness check (step 2B rehearsal)")
    ap.add_argument("--check-date", help="YYYY-MM-DD (America/Chicago); default: today in Chicago")
    ap.add_argument("--pre-url", default=PRE_REDIRECT_URL)
    ap.add_argument("--canonical-url", default=CANONICAL_URL)
    ap.add_argument("--canonical-file", help="fixture body standing in for the canonical GET (implies --skip-redirect-probe)")
    args = ap.parse_args(argv)

    check_date = (datetime.strptime(args.check_date, "%Y-%m-%d").date()
                  if args.check_date else datetime.now(CHICAGO).date())
    for line in check(check_date,
                      pre_url=args.pre_url,
                      canonical_url=args.canonical_url,
                      canonical_file=args.canonical_file,
                      skip_redirect_probe=args.canonical_file is not None):
        print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
