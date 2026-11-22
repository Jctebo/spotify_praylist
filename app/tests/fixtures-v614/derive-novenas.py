# derive-novenas.py — builds tests/fixtures-v614/novenas-catalog.json from the
# PRODUCTION own feed https://orapronobis.media/podcast.xml (captured
# 2026-11-22), grouped by the server's own rule (podNovenaBuild in
# worker/src/index.ts): stem = enclosure URL basename minus .mp3;
# stem = <date>-<slug>-day-<n> (LAST '-day-' at index > 0); episode
# {key: stem, guid, title, date, dayN, label, url, durationS}; name =
# most-carried novenaNameOfTitle; saint = novenaSaintOfName; novenas
# sorted by saint; episodes newest date first. Payload shape =
# podNovenasIndexPayload's grouped lens MINUS its index-only fields,
# i.e. {ok, kind:'novenas', series:'novenas', title, available,
# novenas:[{slug, name, saint, episodes:[...]}]} — the shape the
# /api/player/podcasts?series=novenas route serves the client.
# (tests/fixtures-v603/novenas.json carries NO episodes arrays, so
# this derived catalog is the Plan §2.8 fallback.)
# Usage: python3 derive-novenas.py <podcast.xml> <out.json>
import re, json, html, email.utils, datetime, sys
src = open(sys.argv[1]).read()
def txt(m): return html.unescape(re.sub(r'<!\[CDATA\[(.*?)\]\]>', r'\1', m.group(1), flags=re.S)).strip() if m else None
def dur_s(s):
    if not s: return 0
    s = s.strip()
    if s.isdigit(): return int(s)
    p = [int(x) for x in s.split(':')]
    while len(p) < 3: p.insert(0, 0)
    return p[0]*3600 + p[1]*60 + p[2]
def stem_of(url):
    base = url.split('?')[0].split('#')[0].rsplit('/', 1)[-1]
    return base[:-4] if base.endswith('.mp3') else base
def ep_of_stem(stem):
    m = re.match(r'^(\d{4}-\d{2}-\d{2})-(.*)$', stem)
    if not m: return None
    rest = m.group(2); at = rest.rfind('-day-')
    if at <= 0: return None
    dm = re.match(r'^(\d+)', rest[at+5:])
    return {"slug": rest[:at], "date": m.group(1), "dayN": int(dm.group(1)) if dm else None}
def name_of_title(t):
    m = re.match(r'^(.*?)\s+Day\s+\d+\s+-\s+(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}\s*$', t)
    if m and m.group(1).strip(): return m.group(1).strip()
    m2 = re.match(r'^Day\s+\d+:\s+(.*?)\s*$', t)
    return m2.group(1).strip() if m2 and m2.group(1).strip() else None
def saint_of(name):
    for p in ["Traditional Novena to ", "Short-Form Novena to ", "Novena to ", "Novena for ", "Traditional ", "Short-Form "]:
        if name.startswith(p): return name[len(p):]
    return name
by = {}
for body in re.findall(r'<item>(.*?)</item>', src, re.S):
    enc_tag = re.search(r'<enclosure\b[^>]*>', body)
    enc = re.search(r'url="([^"]+)"', enc_tag.group(0)) if enc_tag else None
    if not enc: continue
    url = html.unescape(enc.group(1))
    stem = stem_of(url); ep = ep_of_stem(stem)
    if not ep: continue
    guid = txt(re.search(r'<guid[^>]*>(.*?)</guid>', body, re.S))
    title = txt(re.search(r'<title>(.*?)</title>', body, re.S)) or ''
    pub = txt(re.search(r'<pubDate>(.*?)</pubDate>', body, re.S))
    ms = int(email.utils.parsedate_to_datetime(pub).timestamp() * 1000) if pub else None
    dur = dur_s(txt(re.search(r'<itunes:duration>(.*?)</itunes:duration>', body, re.S)))
    label = datetime.datetime.fromtimestamp(ms/1000, datetime.timezone.utc).astimezone(
        datetime.timezone(datetime.timedelta(hours=-6))).strftime('%b %-d, %Y') if ms else ''
    s = by.setdefault(ep["slug"], {"slug": ep["slug"], "episodes": [], "votes": {}})
    s["episodes"].append({"key": stem, "guid": guid, "title": title, "date": ep["date"],
                          "dayN": ep["dayN"], "label": label, "url": url, "durationS": dur})
    nm = name_of_title(title)
    if nm: s["votes"][nm] = s["votes"].get(nm, 0) + 1
out_novenas = []
for s in by.values():
    name = max(s["votes"].items(), key=lambda kv: kv[1])[0] if s["votes"] else s["slug"].replace('_', ' ')
    s["episodes"].sort(key=lambda e: (e["date"], -(e["dayN"] or 0)), reverse=True)
    out_novenas.append({"slug": s["slug"], "name": name, "saint": saint_of(name), "episodes": s["episodes"]})
out_novenas.sort(key=lambda n: (n["saint"].lower(), n["name"]))
out = {"ok": True, "kind": "novenas", "series": "novenas", "title": "Novenas",
       "available": True, "novenas": out_novenas}
json.dump(out, open(sys.argv[2], 'w'), indent=2)
print(json.dumps([{"slug": n["slug"], "eps": len(n["episodes"]), "first": n["episodes"][0]["key"]} for n in out_novenas[:8]], indent=1))
