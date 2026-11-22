# derive-v611.py — builds app/tests/fixtures-v611/dge-payload.json from the
# production feed fixture app/tests/fixtures-v536/feeds-dge-2026-11-18.xml,
# shaped as the server's RSS series payload (podRssPayload in index.ts):
# entries newest-first, key = feed GUID, label = videoDateLabel(publishedMs)
# (America/Chicago, "Mon D, YYYY"), descText = extItemDesc (tags stripped,
# 240-char cap), imageUrl = item art else channel art, showImageUrl =
# channel art. Takes the THREE newest weekday episodes (pubDates
# Nov 17/16/15 2026 17:00 GMT = the episodes OF Nov 18/17/16 under the
# day-ahead rule).
import re, json, html, email.utils, datetime, sys
src = open(sys.argv[1]).read()
head = src[:src.index('<item')]
ch_img = re.search(r'<itunes:image[^>]*href="([^"]+)"', head).group(1)
def txt(m): return html.unescape(m.group(1)).strip() if m else None
def strip_desc(raw):
    t = html.unescape(re.sub(r'<[^>]*>', ' ', raw))
    t = re.sub(r'\s+', ' ', t).strip()
    return t[:240] if t else None
def dur_s(s):
    p = [int(x) for x in s.split(':')]
    while len(p) < 3: p.insert(0, 0)
    return p[0]*3600 + p[1]*60 + p[2]
entries = []
for body in re.findall(r'<item>(.*?)</item>', src, re.S)[:3]:
    guid = txt(re.search(r'<guid[^>]*>(.*?)</guid>', body, re.S))
    title = txt(re.search(r'<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>', body, re.S))
    pub = txt(re.search(r'<pubDate>(.*?)</pubDate>', body, re.S))
    ms = int(email.utils.parsedate_to_datetime(pub).timestamp() * 1000)
    url = re.search(r'<enclosure url="([^"]+)"', body).group(1)
    dur = dur_s(txt(re.search(r'<itunes:duration>(.*?)</itunes:duration>', body, re.S)))
    img = re.search(r'<itunes:image[^>]*href="([^"]+)"', body)
    desc_m = re.search(r'<itunes:summary>([\s\S]*?)</itunes:summary>', body) or re.search(r'<description>([\s\S]*?)</description>', body)
    desc = strip_desc(desc_m.group(1)) if desc_m else None
    label = datetime.datetime.fromtimestamp(ms/1000, datetime.timezone.utc).astimezone(
        datetime.timezone(datetime.timedelta(hours=-6))).strftime('%b %-d, %Y')  # Nov = CST (UTC-6)
    entries.append({"key": guid, "title": title, "url": url, "publishedMs": ms,
                    "durationS": dur, "imageUrl": img.group(1) if img else ch_img,
                    "descText": desc, "label": label, "listened": False, "positionS": None})
out = {"ok": True, "kind": "rss", "series": "daily-gospel-exegesis", "title": "Daily Gospel Exegesis",
       "available": True, "entries": entries, "currentKey": entries[0]["key"],
       "currentLabel": entries[0]["label"], "showImageUrl": ch_img}
json.dump(out, open(sys.argv[2], 'w'), indent=2)
print(json.dumps([{ "key": e["key"][:8], "pub": e["publishedMs"], "dur": e["durationS"], "label": e["label"]} for e in entries], indent=1))
