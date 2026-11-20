#!/usr/bin/env python3
"""resolver-leg-v324.py — harness-v324 checks 1-15 (the Python leg).

Drives jobs/externals_resolver.py against the frozen fixture feeds
(app/tests/fixtures/v324/, trimmed from the live feeds 2026-11-09,
target date 2026-11-08 — every §1 trap retained) and asserts the
§2.11 resolver checks. Check 15 (live-feed smoke) is NON-GATING: it
prints its outcome and never fails the leg.

Run: python3 app/tests/resolver-leg-v324.py
Exit 0 iff checks 1-14 all pass.
"""
import ast
import datetime
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "jobs"))
import externals_resolver as R  # noqa: E402

FIX = Path(__file__).resolve().parent / "fixtures" / "v324"
TARGET = datetime.date(2026, 11, 8)
DO_BYTES = (FIX / "divine-office.xml").read_bytes()
BIAY_BYTES = (FIX / "bible-in-a-year.xml").read_bytes()
STH_BYTES = (FIX / "sing-the-hours.xml").read_bytes()
URLS = R.FEED_URLS


def fetcher(mapping):
    def _f(url):
        v = mapping[url]
        if isinstance(v, Exception):
            raise v
        return v
    return _f


FULL = fetcher({URLS["Divine Office"]: DO_BYTES, URLS["Bible in a Year"]: BIAY_BYTES,
                URLS["Sing the Hours"]: STH_BYTES})


def drop_items(xml_bytes, pred):
    """Serialize a feed variant with items whose (normalized) title
    satisfies pred removed."""
    root = ET.fromstring(xml_bytes)
    chan = root.find("channel")
    for item in list(chan.findall("item")):
        t = re.sub(r"\s+", " ", item.findtext("title") or "").strip()
        if pred(t):
            chan.remove(item)
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def enclosure_of(xml_bytes, needle):
    for it in R.parse_feed(xml_bytes):
        if needle in it["title"]:
            return it["url"]
    return None


results = []


def check(n, name, ok, detail=""):
    results.append((n, ok))
    print(f"{'ok' if ok else 'FAIL'} {n} - {name}" + (f" :: {detail}" if detail and not ok else ""))


entries, err, failed = R.resolve_externals_detailed(TARGET, fetch=FULL)
by_id = {e["episode_id"]: e for e in entries}

# 1 — DO invitatory match (Nov 8 item, enclosure URL verbatim).
check(1, "Divine Office invitatory match",
      by_id["ext-invitatory"]["audio_state"] == "present"
      and by_id["ext-invitatory"]["stream_url"] == enclosure_of(DO_BYTES, "Invitatory"))

# 2 — DO morning match.
check(2, "Divine Office morning match",
      by_id["ext-morning-prayer"]["audio_state"] == "present"
      and by_id["ext-morning-prayer"]["source"] == "Divine Office"
      and by_id["ext-morning-prayer"]["stream_url"] == enclosure_of(DO_BYTES, "– Morning Prayer –"))

# 3 — Announcement trap: the full feed with every <enclosure>
# stripped — every title still matches its hour and date (the Nov 7/8
# announcement items are in the fixture too), yet no Divine Office
# slot may resolve from it: an enclosure is part of the match. The
# two fallback slots may still fill — from Sing the Hours only.
def strip_enclosures(xml_bytes):
    root = ET.fromstring(xml_bytes)
    for item in root.iter("item"):
        enc = item.find("enclosure")
        if enc is not None:
            item.remove(enc)
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


no_enc = strip_enclosures(DO_BYTES)
e3 = {x["episode_id"]: x for x in R.resolve_externals_detailed(TARGET, fetch=fetcher(
    {URLS["Divine Office"]: no_enc, URLS["Bible in a Year"]: BIAY_BYTES,
     URLS["Sing the Hours"]: STH_BYTES}))[0]}
do_slots = [s[0] for s in R.SLOTS if s[3] == "Divine Office"]
do_no_fallback = [s[0] for s in R.SLOTS if s[3] == "Divine Office" and not s[5]]
check(3, "no-enclosure items never match (announcement trap)",
      all(e3[s]["audio_state"] == "missing" for s in do_no_fallback)
      and all(e3[s]["source"] == "Sing the Hours" for s in ("ext-morning-prayer", "ext-evening-prayer")))

# 4 — Evening Prayer I (Nov 7) vs II (Nov 8): the resolver takes
# today's II; yesterday's I never displaces it (the date== pin).
check(4, "Evening Prayer II (today) wins; Evening Prayer I (yesterday) never selected",
      by_id["ext-evening-prayer"]["audio_state"] == "present"
      and by_id["ext-evening-prayer"]["stream_url"] == enclosure_of(DO_BYTES, "Evening Prayer II")
      and by_id["ext-evening-prayer"]["stream_url"] != enclosure_of(DO_BYTES, "Evening Prayer I"))

# 5 — Full DO day: every DO-primary slot in the §2.2 table stands
# present. NOTE (§3): §2.11's text says "7 DO-primary slots"; the
# §2.2 table carries EIGHT (all but Bible in a Year) — this check
# asserts the table's count.
check(5, "full Divine Office day — all DO-primary slots present",
      all(by_id[s]["audio_state"] == "present" for s in do_slots) and len(do_slots) == 8,
      f"DO-primary slots: {len(do_slots)}")

# 6 — Bible in a Year 2026 Day 312 match + title render + duration.
b = by_id["ext-bible-in-a-year"]
check(6, "Bible in a Year Day 312 (2026) match + rendered title",
      b["audio_state"] == "present"
      and b["title"] == "Bible in a Year — Day 312: Conclusion to the Old Testament"
      and b["stream_url"] == enclosure_of(BIAY_BYTES, "Day 312: Conclusion to the Old Testament (2026)")
      and b["duration_s"] == 917)

# 7 — Current-year rule: with the 2026 Day 312 item removed, the
# slot stands missing — the 2025/2024/2023/2022 Day 312 items in the
# fixture are never selected.
no_2026 = drop_items(BIAY_BYTES, lambda t: "Day 312" in t and "(2026)" in t)
e7, _, _ = R.resolve_externals_detailed(TARGET, fetch=fetcher(
    {URLS["Divine Office"]: DO_BYTES, URLS["Bible in a Year"]: no_2026,
     URLS["Sing the Hours"]: STH_BYTES}))
check(7, "Bible current-year rule — last year's Day N never selected",
      {x["episode_id"]: x for x in e7}["ext-bible-in-a-year"]["audio_state"] == "missing")

# 8 — Day pattern against a zero-padded form ("Day 0312").
synthetic = (
    '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" '
    'xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>x</title>'
    '<item><title>Day 0312: Zero Pad Test (2026)</title>'
    '<enclosure url="https://example.invalid/day0312.mp3" length="123" type="audio/mpeg"/>'
    '<pubDate>Sun, 08 Nov 2026 08:15:00 GMT</pubDate><itunes:duration>10:00</itunes:duration></item>'
    '</channel></rss>').encode()
e8, _, _ = R.resolve_externals_detailed(TARGET, fetch=fetcher(
    {URLS["Divine Office"]: DO_BYTES, URLS["Bible in a Year"]: synthetic,
     URLS["Sing the Hours"]: STH_BYTES}))
check(8, "Bible Day pattern matches the zero-padded form",
      {x["episode_id"]: x for x in e8}["ext-bible-in-a-year"]["stream_url"] == "https://example.invalid/day0312.mp3")

# 9 — Sing the Hours fallback fills Morning when the DO Morning item
# is gone.
no_do_morning = drop_items(DO_BYTES, lambda t: "– Morning Prayer –" in t and "November 8th" in t)
e9, _, _ = R.resolve_externals_detailed(TARGET, fetch=fetcher(
    {URLS["Divine Office"]: no_do_morning, URLS["Bible in a Year"]: BIAY_BYTES,
     URLS["Sing the Hours"]: STH_BYTES}))
m9 = {x["episode_id"]: x for x in e9}["ext-morning-prayer"]
check(9, "Sing the Hours fallback fills Morning on a Divine Office miss",
      m9["audio_state"] == "present" and m9["source"] == "Sing the Hours"
      and m9["stream_url"] == enclosure_of(STH_BYTES, "11.8.26 | Sunday Morning Prayer | Lauds"))

# 10 — Fallback order: with the DO Morning item present, Sing the
# Hours is not used for the slot.
check(10, "fallback order — Divine Office present means Sing the Hours unused",
      by_id["ext-morning-prayer"]["source"] == "Divine Office")

# 11 — The STH 11.7.26 prefix trap: relabel today's Lauds with
# YESTERDAY's date prefix (and drop the DO Morning item) — the
# fallback must not take it; the slot stands missing.
sth_trap = STH_BYTES.replace("11.8.26 | Sunday Morning Prayer | Lauds".encode(),
                             "11.7.26 | Sunday Morning Prayer | Lauds".encode())
e11, _, _ = R.resolve_externals_detailed(TARGET, fetch=fetcher(
    {URLS["Divine Office"]: no_do_morning, URLS["Bible in a Year"]: BIAY_BYTES,
     URLS["Sing the Hours"]: sth_trap}))
check(11, "Sing the Hours yesterday-prefix trap never matches",
      {x["episode_id"]: x for x in e11}["ext-morning-prayer"]["audio_state"] == "missing")

# 12 — Per-feed isolation: a failed feed degrades only its own slots.
e12a, _, f12a = R.resolve_externals_detailed(TARGET, fetch=fetcher(
    {URLS["Divine Office"]: ConnectionError("down"), URLS["Bible in a Year"]: BIAY_BYTES,
     URLS["Sing the Hours"]: STH_BYTES}))
b12a = {x["episode_id"]: x for x in e12a}
e12b, _, f12b = R.resolve_externals_detailed(TARGET, fetch=fetcher(
    {URLS["Divine Office"]: DO_BYTES, URLS["Bible in a Year"]: TimeoutError("slow"),
     URLS["Sing the Hours"]: STH_BYTES}))
b12b = {x["episode_id"]: x for x in e12b}
# NOTE (§3): with the Divine Office feed down, the two fallback
# slots still fill from Sing the Hours — that IS the isolation
# outcome D2 designs (a miss is a miss, whatever its cause); the
# six non-fallback DO slots are the ones that stand missing.
check(12, "per-feed failure isolation",
      all(b12a[s]["audio_state"] == "missing" for s in do_no_fallback)
      and b12a["ext-morning-prayer"]["source"] == "Sing the Hours"
      and b12a["ext-evening-prayer"]["source"] == "Sing the Hours"
      and b12a["ext-bible-in-a-year"]["audio_state"] == "present"
      and b12b["ext-bible-in-a-year"]["audio_state"] == "missing"
      and all(b12b[s]["audio_state"] == "present" for s in do_slots)
      and f12a == {"Divine Office"} and f12b == {"Bible in a Year"})

# 13 — Slot-set shape under total failure: exactly the nine entries,
# pinned ids/blocks/sorts, missing carries stream_url '' + the
# primary source + no r2_key (externals never name an R2 object).
e13, err13, _ = R.resolve_externals_detailed(TARGET, fetch=fetcher(
    {URLS["Divine Office"]: ConnectionError("x"), URLS["Bible in a Year"]: ConnectionError("x"),
     URLS["Sing the Hours"]: ConnectionError("x")}))
shape_ok = (
    [x["episode_id"] for x in e13] == R.SLOT_IDS
    and [x["sort"] for x in e13] == list(range(901, 910))
    and all(x["block"] == s[1] and x["source"] == s[3] and x["stream_url"] == ""
            and x["audio_state"] == "missing" and x["kind"] == "external" and "r2_key" not in x
            for x, s in zip(e13, R.SLOTS))
)
check(13, "slot-set shape — nine pinned entries, missing carries primary source, no r2_key",
      shape_ok)

# 14 — Tokens parity: the resolver's literal term table equals the
# DEFAULT_TOKENS values in the Spotify contract file.
src = (ROOT / "jobs" / "playlist" / "refresh_playlist.py").read_text(encoding="utf-8")
m = re.search(r"DEFAULT_TOKENS[^=\n]*=\s*(\{.*?\n\})", src, re.DOTALL)
contract = ast.literal_eval(m.group(1)) if m else {}
check(14, "tokens parity with the Spotify contracts (DEFAULT_TOKENS)",
      all(contract.get(k) == v for k, v in R.TOKEN_TABLE.items()),
      f"contract keys present: {sorted(contract)[:3]}...")

# 15 — Live-feed smoke (NON-GATING): resolve the real feeds for the
# current Chicago date and print the per-slot outcome.
try:
    import zoneinfo
    today = datetime.datetime.now(zoneinfo.ZoneInfo("America/Chicago")).date()
    live, lerr, lfailed = R.resolve_externals_detailed(today)
    lp = [e["episode_id"] for e in live if e["audio_state"] == "present"]
    lm = [e["episode_id"] for e in live if e["audio_state"] == "missing"]
    print(f"LIVE SMOKE (check 15, non-gating): date {today} · present {len(lp)}/9 {lp} · "
          f"missing {lm} · resolver error: {lerr} · failed feeds: {sorted(lfailed)}")
except Exception as exc:  # noqa: BLE001 — non-gating by pin
    print(f"LIVE SMOKE (check 15, non-gating): FAILED to run — {type(exc).__name__}: {exc}")
results.append((15, True))  # non-gating: never fails the leg

fails = [n for n, ok in results if not ok]
print(f"RESULT harness-v324-resolver {sum(1 for _, ok in results if ok)}/{len(results)} ok"
      + (f" FAIL {fails}" if fails else ""))
sys.exit(1 if fails else 0)
