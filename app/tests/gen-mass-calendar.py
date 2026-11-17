#!/usr/bin/env python3
"""v486: generate app/worker/src/mass-calendar.ts from the estate's
corrected devotional calendar ICS (the same calendar the nightly
devotional job stands on). One entry per date: the day's display
name + its Mass versions (principal · optional memorials · ferial),
each version carrying its formulary pointer:
  { kind: 'season', season, week, part: 'sunday'|'weekday' }
  { kind: 'saint', slug, name }
  { kind: 'common', common: 'dedication', name }   (Nov 18 form)
Roster/private-devotion events ([P2]/[P3]) and superseded
memorials are NOT versions. Dates outside the ICS range are absent
from the dataset; the Worker falls back to its temporal math.
"""
import re, json, sys, datetime

ICS = '/home/hatch/workspace/goals/saint-of-the-day-picture-rotation/files/devotional-calendar-2026-11-06-to-2027-12-31.ics'
OUT = '/home/hatch/workspace/.worktrees/v486/app/worker/src/mass-calendar.ts'

raw = open(ICS, encoding='utf-8').read().replace('\r\n ', '').replace('\n ', '')
events = re.findall(r'BEGIN:VEVENT(.*?)END:VEVENT', raw, re.S)

ORD = {'first':1,'second':2,'third':3,'fourth':4,'fifth':5,'sixth':6,'seventh':7,
       'eighth':8,'ninth':9,'tenth':10,'eleventh':11,'twelfth':12,'thirteenth':13,
       'fourteenth':14,'fifteenth':15,'sixteenth':16,'seventeenth':17,'eighteenth':18,
       'nineteenth':19,'twentieth':20,'twenty-first':21,'twenty-second':22,
       'twenty-third':23,'twenty-fourth':24,'twenty-fifth':25,'twenty-sixth':26,
       'twenty-seventh':27,'twenty-eighth':28,'twenty-ninth':29,'thirtieth':30,
       'thirty-first':31,'thirty-second':32,'thirty-third':33,'thirty-fourth':34}
SEASONS = ['Ordinary Time', 'Advent', 'Lent', 'Easter', 'Christmas']

def parse_season_week(name):
    """(season, week) from a ferial/temporal day name, else (season, None)."""
    season = None
    for s in SEASONS:
        if s in name: season = s
    if 'Advent' in name: season = 'Advent'
    if 'Lent' in name: season = 'Lent'
    if 'Easter' in name: season = 'Easter'
    if 'Christmas' in name or 'Epiphany' in name: season = 'Christmas'
    week = None
    m = re.search(r'(\d+)[ˢᵗʰʳᵈⁿᵈ]*\s*Week', name)
    if m: week = int(m.group(1))
    if week is None:
        m = re.search(r'Week\s+(\d+)', name)
        if m: week = int(m.group(1))
    if week is None:
        low = name.lower()
        m = re.search(r'\b(' + '|'.join(sorted(ORD, key=len, reverse=True)) + r')\s+(?:week|sunday)', low)
        if m: week = ORD[m.group(1)]
    return season, week

TEMPORAL_KEYS = ['Sunday of Advent', 'Sunday of Lent', 'Sunday of Easter',
                 'Sunday in Ordinary Time', 'Sunday after', 'Nativity',
                 'Epiphany', 'Baptism of the Lord', 'Ascension', 'Pentecost',
                 'Trinity', 'Corpus Christi', 'King of the Universe',
                 'Holy Family', 'Ash Wednesday', 'Palm Sunday', 'Holy Thursday',
                 'Good Friday', 'Holy Saturday', 'Easter Sunday', 'Divine Mercy',
                 'Mary, the Holy Mother of God', 'Mother of God']

def saint_slug(name):
    base = name.split(',')[0].strip()
    base = re.sub(r'^(Saints|Saint|Sts\.|St\.)\s+', '', base)
    base = base.replace('the ', '').replace('The ', '')
    slug = re.sub(r'[^a-z]', '', base.lower())
    return slug

def slug_candidates(name):
    """Full slug, then progressively trimmed word forms — the
    source's saint-page slugs are not uniform (elizabethofhungary
    is full-form; sevenholyfounders is trimmed)."""
    base = name.split(',')[0].strip()
    base = re.sub(r'^(Saints|Saint|Sts\.|St\.)\s+', '', base)
    words = [re.sub(r'[^a-z]', '', w.lower()) for w in base.split()]
    words = [w for w in words if w and w != 'the']
    out = []
    for n in range(len(words), 0, -1):
        s = ''.join(words[:n])
        if s and s not in out: out.append(s)
    return out[:4]

bydate = {}
for e in events:
    m = re.search(r'DTSTART[^:\n]*:(\d{8})', e)
    s = re.search(r'SUMMARY:(.*)', e)
    if not m or not s: continue
    d = m.group(1)
    title = s.group(1).strip().replace('\\,', ',')
    bydate.setdefault(d, []).append(title)

def classify(title):
    """-> (rank, clean_name) rank in S/F/M/m/ferial/roster"""
    if title.startswith('[P2]') or title.startswith('[P3]'):
        return ('roster', title)
    m = re.match(r'\[(S|s|F|M|m)\]\s*', title)
    rank = m.group(1) if m else 'ferial'
    name = title[m.end():] if m else title
    name = re.sub(r'^[^\w\[]+', '', name)  # strip emoji/color markers
    name = re.sub(r'\s+', ' ', name).strip()
    # rank word tails: ", Memorial" / ", Solemnity" / ", Feast" / ", Optional Memorial"
    name = re.sub(r',\s*(Optional Memorial|Memorial|Solemnity|Feast)\s*$', '', name)
    return (rank, name)

# First pass: per-date classified events + ferial season/week (with
# week-neighborhood fill for dates whose own ferial line is absent).
parsed = {}
for d, titles in bydate.items():
    evs = [classify(t) for t in titles]
    evs = [e for e in evs if e[0] != 'roster' and 'Superseded by' not in e[1]]
    ferial = next((e for e in evs if e[0] == 'ferial'), None)
    sw = parse_season_week(ferial[1]) if ferial else (None, None)
    parsed[d] = {'events': evs, 'season': sw[0], 'week': sw[1]}

def fill_sw(d):
    if parsed[d]['week'] is not None: return
    base = datetime.date(int(d[:4]), int(d[4:6]), int(d[6:8]))
    if base.weekday() == 6:
        # A Sunday OPENS its week: its number stands on the
        # following days, not on the Mon-Sat before it.
        for off in range(1, 8):
            dd = (base + datetime.timedelta(days=off)).strftime('%Y%m%d')
            if dd in parsed and parsed[dd]['week'] is not None:
                parsed[d]['season'], parsed[d]['week'] = parsed[dd]['season'], parsed[dd]['week']
                return
    monday = base - datetime.timedelta(days=base.weekday())
    for off in range(7):
        dd = (monday + datetime.timedelta(days=off)).strftime('%Y%m%d')
        if dd in parsed and parsed[dd]['week'] is not None:
            parsed[d]['season'], parsed[d]['week'] = parsed[dd]['season'], parsed[dd]['week']
            return
for d in parsed: fill_sw(d)

out = {}
for d in sorted(parsed):
    evs = parsed[d]['events']
    if not evs: continue
    season, week = parsed[d]['season'], parsed[d]['week']
    ferial = next((e for e in evs if e[0] == 'ferial'), None)
    saints = [e for e in evs if e[0] in ('S', 's', 'F', 'M', 'm')]
    is_sunday = datetime.date(int(d[:4]), int(d[4:6]), int(d[6:8])).weekday() == 6
    versions = []
    default_key = None
    # Saint / feast versions first (rank order S,F,M,m as listed).
    for rank, name in saints:
        if any(k in name for k in TEMPORAL_KEYS):
            versions.append({'key': 'temporal', 'label': name, 'kind': 'season',
                             'season': season, 'week': week, 'part': 'sunday'})
        elif name.startswith('Dedication of the Basilicas'):
            versions.append({'key': 'saint-' + saint_slug(name), 'label': name,
                             'kind': 'common', 'common': 'dedication'})
        else:
            versions.append({'key': 'saint-' + saint_slug(name), 'label': name,
                             'kind': 'saint', 'slug': saint_slug(name),
                             'slugs': slug_candidates(name)})
    # Ferial version on weekdays that carry any other version, and as
    # the sole version on plain ferial days.
    if ferial is not None:
        versions.append({'key': 'ferial', 'label': ferial[1], 'kind': 'season',
                         'season': season, 'week': week,
                         'part': 'sunday' if is_sunday else 'weekday'})
    elif not is_sunday and saints and all(r in ('M', 'm') for r, _ in saints):
        # A weekday under a memorial / optional memorial also
        # carries the ferial form; under a solemnity or feast it
        # does not.
        versions.append({'key': 'ferial', 'label': 'Weekday Mass', 'kind': 'season',
                         'season': season, 'week': week, 'part': 'weekday'})
    if not versions: continue
    # Default: first optional memorial when one stands (Q2 A), else
    # the first version (the principal).
    first_opt = next((v for v, (rank, _) in zip(
        [v for v in versions if v['key'].startswith('saint-') or v['kind'] in ('saint', 'common')],
        saints) if rank == 'm'), None)
    opt_keys = [v['key'] for v, (rank, _) in zip(
        [v for v in versions if v['kind'] in ('saint', 'common')], saints) if rank == 'm']
    default_key = opt_keys[0] if opt_keys else versions[0]['key']
    principal = saints[0][1] if saints and not ferial else (ferial[1] if ferial else saints[0][1])
    if saints and ferial is None: principal = saints[0][1]
    iso = f'{d[:4]}-{d[4:6]}-{d[6:8]}'
    out[iso] = {'name': principal, 'default': default_key, 'versions': versions}

ts = ('// v486: generated by app/tests/gen-mass-calendar.py from the\n'
      '// estate devotional calendar ICS (2026-11-06..2027-12-31).\n'
      '// Do not hand-edit; regenerate when the calendar is rebuilt.\n'
      'export const MASS_CALENDAR: Record<string, { name: string; default: string; versions: unknown[] }> = '
      + json.dumps(out, ensure_ascii=False, indent=0) + ';\n')
open(OUT, 'w', encoding='utf-8').write(ts)
print('dates:', len(out))
for d in ['2026-11-17', '2026-11-18', '2026-11-22', '2026-11-16', '2026-12-25', '2027-02-17']:
    print(d, json.dumps(out.get(d), ensure_ascii=False)[:300])
