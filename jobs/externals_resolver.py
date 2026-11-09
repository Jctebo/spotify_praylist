#!/usr/bin/env python3
"""externals_resolver.py — v324 §2.6: resolve the day's nine external
RSS slots for the Ora Pro Nobis app player.

Ports the standing Spotify contract matchers from
jobs/playlist/refresh_playlist.py (cited per function) to the shows'
RSS feeds, with the two RSS pins §1's feed evidence forced:
  (a) a Divine Office title-date must EQUAL the target date — the
      Spotify today-else-yesterday acceptance does not carry
      (yesterday's Evening Prayer I must never displace today's
      Evening Prayer II);
  (b) an enclosure is part of the match — a title match without an
      <enclosure> is not a candidate (the announcement trap).
Bible in a Year carries §1's third pin: current-year only — last
year's Day N is never presented as today's.

resolve_externals(target_date) always returns exactly nine manifest
entries, in slot order, present or missing (the honesty rule: a miss
is a named row, never an absent one). Each feed fetch is isolated:
a failed feed degrades only its own slots. Nothing here touches the
app store — the push helper (§2.7) carries the entries into the
standing replace-day commit, and the morning re-resolve (§2.8)
carries them into the externals-only route. No external audio is
ever copied anywhere; a present entry's stream_url is the feed's
enclosure URL verbatim.
"""
import datetime
import re
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

FEED_URLS = {
    "Divine Office": "https://divineoffice.org/feed/podcast/",
    "Bible in a Year": "https://feeds.fireside.fm/bibleinayear/rss",
    "Sing the Hours": "https://feeds.castos.com/x8g54",
}

ITUNES_NS = "{http://www.itunes.com/dtds/podcast-1.0.dtd}"

# The term table is a LITERAL COPY of the DEFAULT_TOKENS values in
# jobs/playlist/refresh_playlist.py that the ported matchers use —
# harness-v324 check 14 asserts equality against that file at test
# time, so a contract-token change fails a gate instead of silently
# diverging (§2.6 drift guard).
TOKEN_TABLE = {
    "DO_INVITATORY": ["Invitatory", "Invitatory Psalm"],
    "DO_MORNING": "Morning Prayer",
    "DO_OFFICE": "Office of Readings",
    "DO_MIDMORNING": "Midmorning Prayer",
    "DO_MIDDAY": "Midday Prayer",
    "DO_MIDAFTERNOON": "Midafternoon Prayer",
    "DO_EVENING": ["Evening Prayer", "Vespers"],
    "DO_NIGHT_ANY": ["Night Prayer", "Compline"],
    "STH_LAUDS": "Lauds",
    "STH_VESPERS": "Vespers",
}

# §2.2's slot table: (episode_id, block, display title, primary
# source, token key, Sing the Hours fallback token or None). Slot
# order is the manifest order; sort = 900 + slot number.
SLOTS = [
    ("ext-invitatory", "Morning", "Invitatory", "Divine Office", "DO_INVITATORY", None),
    ("ext-morning-prayer", "Morning", "Morning Prayer", "Divine Office", "DO_MORNING", "STH_LAUDS"),
    ("ext-bible-in-a-year", "Morning", None, "Bible in a Year", None, None),
    ("ext-midmorning-prayer", "Midmorning", "Midmorning Prayer", "Divine Office", "DO_MIDMORNING", None),
    ("ext-midday-prayer", "Midday", "Midday Prayer", "Divine Office", "DO_MIDDAY", None),
    ("ext-midafternoon-prayer", "Afternoon", "Midafternoon Prayer", "Divine Office", "DO_MIDAFTERNOON", None),
    ("ext-office-of-readings", "Evening", "Office of Readings", "Divine Office", "DO_OFFICE", None),
    ("ext-evening-prayer", "Evening", "Evening Prayer", "Divine Office", "DO_EVENING", "STH_VESPERS"),
    ("ext-night-prayer", "Night", "Night Prayer", "Divine Office", "DO_NIGHT_ANY", None),
]
SLOT_IDS = [s[0] for s in SLOTS]


def _terms(key):
    v = TOKEN_TABLE[key]
    return v if isinstance(v, list) else [v]


# ---- ports of the contract date machinery (refresh_playlist.py
# L336-346, ported verbatim in behavior) ----
def _date_regex(month_str: str, day: int) -> str:
    return rf"(?:^|[^A-Za-z]){re.escape(month_str)}\s*[-,]*\s*0?{day}(?:st|nd|rd|th)?(?:\s*,?\s*\d{{4}})?(?!\w)"


def matches_month_day(title: str, dt: datetime.date) -> bool:
    full, abbr = dt.strftime("%B"), dt.strftime("%b")
    return bool(
        re.search(_date_regex(full, dt.day), title, re.IGNORECASE)
        or re.search(_date_regex(abbr, dt.day), title, re.IGNORECASE)
    )


def sth_date_prefix(dt: datetime.date) -> str:
    # Port of sth_date_prefix (L308): M.D.YY, unpadded.
    return f"{dt.month}.{dt.day}.{dt.strftime('%y')}"


def day_of_year_1_to_365(d: datetime.date) -> int:
    # Port of day_of_year_1_to_365 (L561).
    doy = int(d.timetuple().tm_yday)
    return 365 if doy > 365 else doy


# ---- feed parsing ----
def _parse_duration(raw):
    """itunes:duration in HH:MM:SS | MM:SS | bare-seconds form -> int
    seconds; anything else -> 0 (the client omits a zero duration)."""
    if not raw:
        return 0
    raw = raw.strip()
    try:
        if ":" in raw:
            parts = [float(p) for p in raw.split(":")]
            secs = 0.0
            for p in parts:
                secs = secs * 60 + p
            return int(secs)
        return int(float(raw))
    except (ValueError, TypeError):
        return 0


def parse_feed(data: bytes):
    """RSS bytes -> [{title, url, length, pubdate, duration_s}] in
    feed order. Titles are whitespace-collapsed (the Sing the Hours
    feed pads its titles with newlines; the contracts' containment
    tests are indifferent to it, and display never uses feed titles
    except Bible in a Year's subtitle)."""
    root = ET.fromstring(data)
    items = []
    for it in root.iter("item"):
        title = re.sub(r"\s+", " ", it.findtext("title") or "").strip()
        enc = it.find("enclosure")
        pub = None
        raw_pub = it.findtext("pubDate")
        if raw_pub:
            try:
                pub = parsedate_to_datetime(raw_pub.strip())
            except (TypeError, ValueError):
                pub = None
        items.append({
            "title": title,
            "url": (enc.get("url") or "") if enc is not None else "",
            "length": int(enc.get("length") or 0) if enc is not None and (enc.get("length") or "").isdigit() else 0,
            "pubdate": pub,
            "duration_s": _parse_duration(it.findtext(f"{ITUNES_NS}duration")),
        })
    return items


def _fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "ora-pro-nobis-externals-resolver/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def _load_feed(source: str, fetch, failed: set):
    """One feed, isolated: any failure returns None and degrades only
    this source's slots (§2.6 failure isolation). The failed set lets
    the morning leg (§2.8) refuse to post a resolution built on a
    down feed — a missing entry there would erase a row the midnight
    push had landed present."""
    try:
        return parse_feed(fetch(FEED_URLS[source]))
    except Exception:
        failed.add(source)
        return None


# ---- the matchers ----
def _match_divine_office(items, target: datetime.date):
    """Port of do_date_aware (L348) with the two RSS pins: title-date
    == target date (never yesterday), enclosure required. Among
    candidates for a slot the first in feed order wins; an item
    consumed by an earlier slot is not reused — the contracts resolve
    one episode per hour, and consumption is what keeps the
    'Morning Prayer' substring inside a 'Midmorning Prayer' title
    from double-filling (feed order puts the day's own Morning
    Prayer first in any case, §1's evidence)."""
    if items is None:
        return {}
    out = {}
    consumed = set()
    for slot_id, _block, _title, _src, key, _fb in SLOTS:
        if key is None or _src != "Divine Office":
            continue
        # A term matches only at a non-letter boundary: the
        # contracts' plain containment would let "Morning Prayer"
        # match inside "Midmorning Prayer" and take the wrong hour
        # when the day's own Morning Prayer item is absent (the RSS
        # titles compound the hour names; the Spotify track names the
        # contracts were written against do not).
        pats = [re.compile(r"(?<![A-Za-z])" + re.escape(t), re.IGNORECASE) for t in _terms(key)]
        for idx, it in enumerate(items):
            if idx in consumed or not it["url"]:
                continue
            if any(p.search(it["title"]) for p in pats) and matches_month_day(it["title"], target):
                out[slot_id] = it
                consumed.add(idx)
                break
    return out


def _match_bible(items, target: datetime.date):
    r"""Port of bible_in_a_year_for_today (L566) with the current-year
    pin: candidates match \bDay\s*0*N\b and carry an enclosure; a
    candidate's year (max 20\d\d in the title, else its pubDate year
    — the contract's episode_year rule) must equal the target year.
    Among survivors the newest pubDate wins."""
    if items is None:
        return None
    n = day_of_year_1_to_365(target)
    pattern = re.compile(rf"\bDay\s*0*{n}\b", re.IGNORECASE)
    best = None
    for it in items:
        if not it["url"] or not pattern.search(it["title"]):
            continue
        years = [int(y) for y in re.findall(r"\b(20\d{2})\b", it["title"])]
        year = max(years) if years else (it["pubdate"].year if it["pubdate"] else None)
        if year != target.year:
            continue
        if best is None or (it["pubdate"] or datetime.datetime.min.replace(tzinfo=datetime.timezone.utc)) > (best["pubdate"] or datetime.datetime.min.replace(tzinfo=datetime.timezone.utc)):
            best = it
    return best


def _match_sing_the_hours(items, target: datetime.date, token: str):
    """Port of sth_match_today (L312): the title carries the target
    date's M.D.YY prefix and the token; enclosure required (RSS pin).
    Consulted only as a fallback (D2)."""
    if items is None:
        return None
    prefix = sth_date_prefix(target)
    for it in items:
        if it["url"] and prefix in it["title"] and token.lower() in it["title"].lower():
            return it
    return None


def _bible_title(item, target: datetime.date) -> str:
    n = day_of_year_1_to_365(target)
    base = f"Bible in a Year — Day {n}"
    if item is None:
        return base
    sub = re.sub(r"^Day\s*\d+\s*:\s*", "", item["title"])
    sub = re.sub(r"\s*\(\d{4}\)\s*$", "", sub).strip()
    return f"{base}: {sub}" if sub else base


def resolve_externals_detailed(target: datetime.date, fetch=None):
    """-> (entries, error, failed_feeds). entries is always the nine
    manifest entries in slot order; error is None unless a
    resolver-level exception degraded all nine (named for §2.7's
    report field); failed_feeds names the feeds whose fetch/parse
    failed (their slots stand missing by isolation)."""
    fetch = fetch or _fetch
    failed = set()
    try:
        do_items = _load_feed("Divine Office", fetch, failed)
        biay_items = _load_feed("Bible in a Year", fetch, failed)
        do_matches = _match_divine_office(do_items, target)
        bible_item = _match_bible(biay_items, target)
        # Sing the Hours is fetched only when a fallback slot actually
        # missed — on a normal day its feed is never touched (D2).
        need_fallback = [s for s in SLOTS if s[5] and s[0] not in do_matches]
        sth_items = _load_feed("Sing the Hours", fetch, failed) if need_fallback else None

        entries = []
        for i, (slot_id, block, title, primary, _key, fb) in enumerate(SLOTS, start=1):
            entry = {
                "episode_id": slot_id, "title": title or "", "block": block,
                "sort": 900 + i, "duration_s": 0, "size_bytes": 0,
                "audio_state": "missing", "kind": "external",
                "source": primary, "stream_url": "",
            }
            item = None
            source = primary
            if slot_id == "ext-bible-in-a-year":
                item = bible_item
                entry["title"] = _bible_title(item, target)
            elif slot_id in do_matches:
                item = do_matches[slot_id]
            elif fb:
                item = _match_sing_the_hours(sth_items, target, TOKEN_TABLE[fb])
                if item is not None:
                    source = "Sing the Hours"
            if item is not None:
                entry.update({
                    "audio_state": "present", "source": source,
                    "stream_url": item["url"], "size_bytes": item["length"],
                    "duration_s": item["duration_s"],
                })
            entries.append(entry)
        return entries, None, failed
    except Exception as exc:  # resolver-level: all nine stand missing, named
        entries = []
        for i, (slot_id, block, title, primary, _key, _fb) in enumerate(SLOTS, start=1):
            entries.append({
                "episode_id": slot_id,
                "title": _bible_title(None, target) if slot_id == "ext-bible-in-a-year" else (title or ""),
                "block": block, "sort": 900 + i, "duration_s": 0, "size_bytes": 0,
                "audio_state": "missing", "kind": "external",
                "source": primary, "stream_url": "",
            })
        return entries, f"{type(exc).__name__}: {exc}", failed


def resolve_externals(target: datetime.date, fetch=None):
    """§2.6's signature: the nine manifest entries, present or
    missing, in slot order."""
    entries, _err, _failed = resolve_externals_detailed(target, fetch)
    return entries
