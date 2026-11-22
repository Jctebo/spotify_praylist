# derive-readings.py — builds tests/fixtures-v614/readings-payload.json from the
# PRODUCTION USCCB Daily Readings feed (RSS_USCCB_READINGS_FEED_URL in
# worker/src/index.ts: https://feeds.soundcloud.com/users/soundcloud:users:838970026/sounds.rss),
# captured 2026-11-22. Shaped as the server's RSS series payload (podRssPayload):
# entries newest-first by pubDate, key = feed GUID else enclosure URL
# (podRssBuild), label = videoDateLabel(publishedMs) (America/Chicago
# "Mon D, YYYY"), window: the 12 newest entries. At capture the feed's
# newest batch (published Nov 16, 2026) carries TITLE dates
# December 23-31, 2026 (the feed publishes ahead; the seat rule
# matches by title date, §2.5) — the fixture carries those days, and
# the harness legs present a date the fixture carries (Dec 29) and
# pin an earlier title day (Dec 28), asserting against the titles.
# Usage: python3 derive-readings.py <readings.xml> <out.json>
import re, json, html, email.utils, datetime, sys
src = open(sys.argv[1]).read()
head = src[:src.index('<item')]
m_img = re.search(r'<itunes:image[^>]*href="([^"]+)"', head)
ch_img = m_img.group(1) if m_img else None
def txt(m): return html.unescape(re.sub(r'<!\[CDATA\[(.*?)\]\]>', r'\1', m.group(1), flags=re.S)).strip() if m else None
def strip_desc(raw):
    t = html.unescape(re.sub(r'<[^>]*>', ' ', raw))
    t = re.sub(r'\s+', ' ', t).strip()
    return t[:240] if t else None
def dur_s(s):
    if not s: return 0
    s = s.strip()
    if s.isdigit(): return int(s)
    p = [int(x) for x in s.split(':')]
    while len(p) < 3: p.insert(0, 0)
    return p[0]*3600 + p[1]*60 + p[2]
items = []
for body in re.findall(r'<item>(.*?)</item>', src, re.S):
    guid = txt(re.search(r'<guid[^>]*>(.*?)</guid>', body, re.S))
    title = txt(re.search(r'<title>(.*?)</title>', body, re.S))
    pub = txt(re.search(r'<pubDate>(.*?)</pubDate>', body, re.S))
    ms = int(email.utils.parsedate_to_datetime(pub).timestamp() * 1000) if pub else None
    enc_tag = re.search(r'<enclosure\b[^>]*>', body)
    enc = re.search(r'url="([^"]+)"', enc_tag.group(0)) if enc_tag else None
    if not enc: continue
    url = html.unescape(enc.group(1))
    dur = dur_s(txt(re.search(r'<itunes:duration>(.*?)</itunes:duration>', body, re.S)))
    img = re.search(r'<itunes:image[^>]*href="([^"]+)"', body)
    desc_m = re.search(r'<description>([\s\S]*?)</description>', body)
    desc = strip_desc(desc_m.group(1)) if desc_m else None
    label = datetime.datetime.fromtimestamp(ms/1000, datetime.timezone.utc).astimezone(
        datetime.timezone(datetime.timedelta(hours=-6))).strftime('%b %-d, %Y') if ms else ''
    items.append({"key": guid or url, "title": title, "url": url, "publishedMs": ms,
                  "durationS": dur, "imageUrl": img.group(1) if img else ch_img,
                  "descText": desc, "label": label, "listened": False, "positionS": None})
items.sort(key=lambda e: -(e["publishedMs"] or 0))
seen = set(); entries = []
for e in items:
    if e["key"] in seen: continue
    seen.add(e["key"]); entries.append(e)
    if len(entries) >= 12: break
out = {"ok": True, "kind": "rss", "series": "daily-readings", "title": "USCCB Daily Readings Podcast",
       "available": True, "entries": entries, "currentKey": entries[0]["key"],
       "currentLabel": entries[0]["label"], "showImageUrl": ch_img}
json.dump(out, open(sys.argv[2], 'w'), indent=2)
print(json.dumps([{"key": e["key"][:40], "title": e["title"], "label": e["label"]} for e in entries], indent=1))
