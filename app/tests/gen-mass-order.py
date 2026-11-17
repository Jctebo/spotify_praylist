#!/usr/bin/env python3
"""v486: generate app/worker/src/mass-order.ts — the fixed Order of
Mass segments + Common Preface I, cut from the proven source pages
(the Order of Mass page and the Prefaces page at liturgies.net,
Roman Missal 2011 / ICEL 2010 text). Every cut is anchor-asserted;
a failed anchor yields an EMPTY segment (absent, never invented)
and prints a FAIL line the build must not ship over.
"""
import re, html as H, json

FIX = '/home/hatch/workspace/.worktrees/v488/app/tests/fixtures-v486/'
OUT = '/home/hatch/workspace/.worktrees/v488/app/worker/src/mass-order.ts'

def norm(h):
    def font_repl(m):
        inner = re.sub(r'<[^>]+>', '', m.group(1))
        return inner if len(inner) <= 14 else ' '
    h = re.sub(r'<font size="-1">(.*?)</font>', font_repl, h, flags=re.S)
    h = re.sub(r'<font size="\+2">(.*?)</font>', r'\1', h, flags=re.S)
    h = re.sub(r'<br\s*/?>', '\n', h, flags=re.I)
    h = re.sub(r'</p>|</div>|</tr>', '\n', h, flags=re.I)
    h = re.sub(r'<[^>]+>', '', h)
    h = H.unescape(h)
    return [re.sub(r'\s+', ' ', ln).strip() for ln in h.split('\n')
            if re.sub(r'\s+', ' ', ln).strip()]

o = norm(open(FIX + 'src-order-of-mass.htm', encoding='utf-8', errors='replace').read())

def find(sub, start=0, required=True, nth=0):
    hits = [n for n in range(start, len(o)) if sub in o[n]]
    if len(hits) <= nth:
        if required: print('FAIL anchor:', sub)
        return -1
    return hits[nth]

segs = {}
# Introductory Rites: from its heading to the Liturgy of the Word.
a = find('The Introductory Rites'); b = find('The Liturgy of the Word')
segs['intro'] = o[a:b] if a >= 0 and b > a else []
# Creed + Universal Prayer line: 'I believe in one God' to the
# Liturgy of the Eucharist heading.
a = find('I believe in one God'); b = find('The Liturgy of the Eucharist')
segs['creed'] = o[a:b] if a >= 0 and b > a else []
# Offertory: from the Liturgy of the Eucharist heading to the
# 'Pray, brethren' invitation (the day's Prayer over the Offerings
# follows it in the scroll).
a = find('The Liturgy of the Eucharist'); b = find('Pray, brethren')
segs['offertory'] = o[a:b] if a >= 0 and b > a else []
# Preface dialogue: the exchange that opens the Eucharistic Prayer
# ('The Lord be with you' ... 'It is right and just.') — the first
# standing occurrence after the offertory.
a = find('It is right and just')
if a >= 0:
    start = a
    for n in range(a, max(0, a - 14), -1):
        if o[n] == 'The Lord be with you.': start = n; break
    segs['prefaceDialogue'] = o[start:a + 1]
else:
    segs['prefaceDialogue'] = []
# The four Eucharistic Prayers (John, 2026-11-16 23:50 CT: the
# scroll carries an in-page toggle among them). Each body is cut
# from its head line through its own doxology Amen. EP IV's block
# is self-contained — its own dialogue, invariable Preface and
# Sanctus stand inside its segment (the page's rubric at its head:
# its Preface may not be changed), so choosing IV replaces the
# Preface block whole. The standing Sanctus (for I/II/III) is the
# block printed before EP II.
def ep_body(head_pred, tag):
    head = -1
    for n, ln in enumerate(o):
        if head_pred(ln): head = n; break
    if head < 0: print('FAIL anchor: EP head', tag); return []
    dox = find('Through him, and with him', start=head)
    if dox < 0: print('FAIL anchor: EP doxology', tag); return []
    for n in range(dox, min(len(o), dox + 8)):
        if o[n] == 'Amen.': return o[head:n + 1]
    print('FAIL anchor: EP Amen', tag); return []
segs['epI'] = ep_body(lambda ln: ln.startswith('To you, therefore, most merciful Father'), 'I')
segs['epII'] = ep_body(lambda ln: ln.startswith('You are indeed Holy, O Lord,') and 'fount of all holiness' in o[o.index(ln) + 1] if False else ln.startswith('You are indeed Holy, O Lord,'), 'II')
# EP II and EP III open with the same words; EP III's second line
# names it ('all you have created rightly gives you praise').
ep3 = -1
for n, ln in enumerate(o):
    if ln.startswith('You are indeed Holy, O Lord,') and n + 1 < len(o) and 'rightly gives you praise' in o[n + 1]:
        ep3 = n; break
if ep3 >= 0:
    dox = find('Through him, and with him', start=ep3)
    amen = -1
    for n in range(dox, min(len(o), dox + 8)):
        if o[n] == 'Amen.': amen = n; break
    segs['epIII'] = o[ep3:amen + 1] if amen > ep3 else []
    if not segs['epIII']: print('FAIL anchor: EP III')
else:
    print('FAIL anchor: EP III head'); segs['epIII'] = []
# EP II re-cut precisely (its head is the FIRST 'You are indeed
# Holy, O Lord,' whose next line carries 'fount of all holiness').
ep2h = -1
for n, ln in enumerate(o):
    if ln.startswith('You are indeed Holy, O Lord,') and n + 1 < len(o) and 'fount of all holiness' in o[n + 1]:
        ep2h = n; break
if ep2h >= 0:
    dox = find('Through him, and with him', start=ep2h)
    amen = -1
    for n in range(dox, min(len(o), dox + 8)):
        if o[n] == 'Amen.': amen = n; break
    segs['epII'] = o[ep2h:amen + 1] if amen > ep2h else []
    if not segs['epII']: print('FAIL anchor: EP II')
else:
    print('FAIL anchor: EP II head'); segs['epII'] = []
# EP IV whole block: from its dialogue ('V/. The Lord be with
# you.' after the invariable-Preface rubric) through its doxology.
ep4 = -1
for n, ln in enumerate(o):
    if 'not permitted to change the Preface of this Eucharistic Prayer' in ln:
        for j in range(n, min(len(o), n + 4)):
            if o[j].startswith('V/. The Lord be with you'): ep4 = j; break
        break
if ep4 >= 0:
    dox = find('Through him, and with him', start=ep4)
    amen = -1
    for n in range(dox, min(len(o), dox + 8)):
        if o[n] == 'Amen.': amen = n; break
    segs['epIV'] = o[ep4:amen + 1] if amen > ep4 else []
    if not segs['epIV']: print('FAIL anchor: EP IV')
else:
    print('FAIL anchor: EP IV head'); segs['epIV'] = []
# Standing Sanctus for I/II/III: the block before EP II's head.
if ep2h > 0:
    s = -1
    for n in range(ep2h, max(0, ep2h - 12), -1):
        if o[n].startswith('Holy, Holy, Holy'): s = n; break
    segs['sanctus'] = o[s:ep2h] if s >= 0 else []
    # trim trailing rubric lines from the Sanctus block
    while segs['sanctus'] and re.match(r'^\d+\.', segs['sanctus'][-1]): segs['sanctus'].pop()
else:
    segs['sanctus'] = []
# Communion Rite: from the Lord's Prayer introduction through the
# 'Blessed are those called' response.
a = find('Our Father, who art in heaven')
start = a
for n in range(a, max(0, a - 8), -1):
    if 'dare to say' in o[n]: start = n; break
b = find('Blessed are those called to the supper of the Lamb', start=a)
end = -1
if b >= 0:
    for n in range(b, min(len(o), b + 10)):
        if 'healing remedy' in o[n] or 'soul' in o[n] and 'healed' in o[n]: end = n; break
    if end < 0: end = b + 3
segs['communion'] = o[start:end + 1] if a >= 0 and end > a else []
# Concluding Rites: heading through the dismissal response.
a = find('The Concluding Rites'); b = find('Thanks be to God', start=a)
segs['concluding'] = o[a:b + 1] if a >= 0 and b > a else []

# Common Preface I from the Prefaces page.
p = norm(open(FIX + 'src-prefaces.htm', encoding='utf-8', errors='replace').read())
cp = []
for n, ln in enumerate(p):
    if re.match(r'COMMON PREFACE I\b', ln):
        j = n + 1
        while j < len(p) and not re.match(r'(COMMON PREFACE|PREFACE)', p[j]):
            cp.append(p[j]); j += 1
        break
if cp and cp[0].startswith('The following Preface is said'):
    cp = cp[1:]
if not cp: print('FAIL anchor: COMMON PREFACE I')
segs['commonPreface1'] = cp

# ---------- Part pre-cuts + Latin toggles (John, 2026-11-16
# 23:51 CT) ----------
# The Ordinary parts commonly said in Latin are pre-cut from
# their English segments so the client can wrap each in its own
# English | Latin toggle: Gloria · Creed · Sanctus · Pater
# Noster · Agnus Dei (+ Kyrie in its printed Greek form, and the
# Confiteor — each only where the Latin is proven below).
def cut(lines, start_pred, end_pred, tag):
    a = -1
    for n, ln in enumerate(lines):
        if start_pred(ln): a = n; break
    if a < 0: print('FAIL anchor: part start', tag); return [], lines, []
    b = -1
    for n in range(a, len(lines)):
        if end_pred(lines[n]): b = n; break
    if b < 0: print('FAIL anchor: part end', tag); return [], lines, []
    return lines[:a], lines[a:b + 1], lines[b + 1:]

intro = segs.pop('intro')
pre, segs['confiteorEn'], rest = cut(intro,
    lambda ln: ln.startswith('I confess to almighty God'),
    lambda ln: 'pray for me to the Lord our God' in ln, 'confiteor')
segs['introPre'] = pre
pre2, segs['kyrieEn'], rest2 = cut(rest,
    lambda ln: ln == 'Lord, have mercy.',
    lambda ln: ln == 'Lord, have mercy.' and False, 'kyrie') if False else (None, None, None)
# Kyrie: collect the six response lines from the first 'Lord,
# have mercy.' — with any rubric lines standing between them.
# Kyrie: the page prints the six invocations as three V/. R/.
# lines ('V/. Lord, have mercy. R/. Lord, have mercy.' …).
ky_a = next((n for n, ln in enumerate(rest) if ln.startswith('V/. Lord, have mercy.')), -1)
if ky_a >= 0 and ky_a + 2 < len(rest):
    segs['introMid'] = rest[:ky_a]
    segs['kyrieEn'] = rest[ky_a:ky_a + 3]
    rest = rest[ky_a + 3:]
else:
    print('FAIL anchor: kyrie'); segs['introMid'] = rest; segs['kyrieEn'] = []; rest = []
pre3, segs['gloriaEn'], rest3 = cut(rest,
    lambda ln: ln.startswith('Glory to God in the highest'),
    lambda ln: 'glory of God the Father' in ln, 'gloria')
segs['introPost'] = pre3
# the Gloria's closing Amen stands on the next line
if rest3 and rest3[0] == 'Amen.':
    segs['gloriaEn'] = segs['gloriaEn'] + ['Amen.']; rest3 = rest3[1:]
segs['introTail'] = rest3

creed = segs.pop('creed')
c_end = next((n for n, ln in enumerate(creed) if 'life everlasting. Amen.' in ln), -1)
if c_end >= 0:
    segs['creedEn'] = creed[:c_end + 1]; segs['creedOutro'] = creed[c_end + 1:]
else:
    print('FAIL anchor: creed end'); segs['creedEn'] = creed; segs['creedOutro'] = []

comm = segs.pop('communion')
p_a = next((n for n, ln in enumerate(comm) if ln.startswith('Our Father, who art in heaven')), -1)
p_b = next((n for n in range(p_a, len(comm)) if 'but deliver us from evil' in comm[n]), -1) if p_a >= 0 else -1
if p_a >= 0 and p_b >= 0:
    segs['communionPre'] = comm[:p_a]; segs['paterEn'] = comm[p_a:p_b + 1]; comm = comm[p_b + 1:]
else:
    print('FAIL anchor: pater'); segs['communionPre'] = comm; segs['paterEn'] = []
a_a = next((n for n, ln in enumerate(comm) if ln.startswith('Lamb of God, you take away')), -1)
a_b = next((n for n in range(a_a, len(comm)) if 'grant us peace' in comm[n]), -1) if a_a >= 0 else -1
if a_a >= 0 and a_b >= 0:
    segs['communionMid'] = comm[:a_a]; segs['agnusEn'] = comm[a_a:a_b + 1]; segs['communionPost'] = comm[a_b + 1:]
else:
    print('FAIL anchor: agnus'); segs['communionMid'] = comm; segs['agnusEn'] = []; segs['communionPost'] = []

# ---------- Latin: two-witness proof ----------
# Witness 1 (extraction): the Latin Liturgy Association's Order
# of Mass for the Ordinary Form — Latin from the Missale
# Romanum, editio typica tertia emendata (2008) — two-column
# PDF, pdftotext -layout text committed as the fixture.
# Witness 2 (check): the cross-referenced Ordo Missae
# (ipsissima-verba, same typical edition). A part is offered
# only if its full word sequence stands contiguously in BOTH.
import subprocess, unicodedata
subprocess.run(['pdftotext', '-layout', FIX + 'src-ordinary-form-latin.pdf',
                FIX + 'ordinary-form-latin.txt'], check=True)
pdf_lines = open(FIX + 'ordinary-form-latin.txt', encoding='utf-8', errors='replace').read().split('\n')

def fold(s):
    s = s.replace('æ', 'ae').replace('Æ', 'ae').replace('œ', 'oe').replace('Œ', 'oe')
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    # I/J are one letter in Latin editions (Iesum/Jesum); the
    # check folds them together. The offered text keeps the
    # extraction witness's own spelling.
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z ]', ' ', s.lower())).strip().replace('j', 'i')

def left_col(ln):
    # The layout text is two columns with a ragged gutter: the
    # Latin column's own text carries single spaces only, so the
    # first run of 2+ spaces IS the gutter. A line with no such
    # run is Latin-only or a full-width rubric (the caller skips
    # '(' lines and English-gloss leaks, see latin_part).
    m = re.search(r'\S\s{2,}', ln)
    t = ln[:m.start() + 1] if m else ln
    t = re.sub(r'^\s*(P:|All:|S:|C:|D:|A:)\s*', '', t)
    return t.strip()

EN_GLOSS = {'the', 'of', 'and', 'thy', 'thou', 'thee', 'your', 'our', 'we', 'you',
            'is', 'are', 'on', 'earth', 'heaven', 'maker', 'come', 'will', 'be',
            'done', 'as', 'it', 'they', 'say', 'almighty', 'all', 'things',
            'visible', 'invisible', 'bread', 'forgive', 'give', 'this', 'day',
            'trespasses', 'debts', 'debtors',
            'daily', 'those', 'against', 'lead', 'into', 'temptation', 'but',
            'deliver', 'from', 'evil', 'one', 'only', 'begotten', 'born',
            'before', 'ages', 'true', 'were', 'men', 'salvation', 'came',
            'down', 'by', 'holy', 'was', 'incarnate', 'virgin', 'became',
            'man', 'crucified', 'under', 'suffered', 'died', 'buried', 'rose',
            'third', 'ascended', 'seated', 'right', 'hand', 'again', 'glory',
            'judge', 'living', 'dead', 'kingdom', 'end', 'church', 'baptism',
            'forgiveness', 'sins', 'resurrection', 'life', 'world', 'lord',
            'god', 'son', 'father', 'spirit', 'jesus', 'christ', 'him', 'his',
            'who', 'whom', 'with', 'without', 'over', 'out', 'has', 'have',
            'had', 'shall', 'would', 'there', 'here', 'when', 'then', 'than',
            'because', 'through', 'about', 'peace', 'people', 'good', 'praise',
            'bless', 'adore', 'glorify', 'thanks', 'great', 'heavenly', 'king',
            'take', 'away', 'mercy', 'grant', 'us', 'now', 'ever', 'let', 'not'}
def strip_gloss_runs(t):
    # pdftotext -layout sometimes merges a wrapped English
    # gloss INTO a Latin line (before, after, or between Latin
    # words). A run of 3+ consecutive English gloss words is
    # removed; the Latin around it stands. No Latin word of
    # these prayers stands in the gloss set.
    spans = [(m.group(0), m.start(), m.end()) for m in re.finditer(r"[A-Za-zÀ-ÿ']+", t)]
    kill = [False] * len(spans)
    run = []
    def flush(run):
        if len(run) >= 3:
            for i in run: kill[i] = True
    for i, (w, _, _) in enumerate(spans):
        if re.sub(r"[^a-z]", '', w.lower()) in EN_GLOSS and not re.search(r'[áéíóúæœǽ]', w):
            run.append(i)
        else:
            flush(run); run = []
    flush(run)
    if not any(kill): return t
    out, last = [], 0
    for i, (w, s, e) in enumerate(spans):
        if kill[i]:
            out.append(t[last:s]); last = e
    out.append(t[last:])
    cleaned = re.sub(r'\s+', ' ', ''.join(out)).strip()
    # Second pass: any gloss word still standing alone on the
    # line (a run broken by punctuation) is also gloss — the
    # set holds no Latin word of these prayers.
    cleaned = ' '.join(w for w in cleaned.split(' ')
                       if re.sub(r"[^a-z]", '', w.lower()) not in EN_GLOSS or re.search(r'[áéíóúæœǽ]', w))
    return cleaned
def is_english_gloss(t):
    # A wrapped English gloss line that leaked into the left
    # column: many English function words and no accented vowel
    # (the Latin of this edition is accent-marked throughout).
    if re.search(r'[áéíóúæœǽ]', t): return False
    words = re.findall(r"[a-z']+", t.lower())
    return sum(1 for w in words if w in EN_GLOSS) >= 3

def latin_part(start_key, end_marker, max_lines=60):
    a = -1
    for n, ln in enumerate(pdf_lines):
        if start_key in fold(left_col(ln)): a = n; break
    if a < 0: return []
    out = []
    for n in range(a, min(len(pdf_lines), a + max_lines)):
        t = left_col(pdf_lines[n])
        if t.startswith('(') or is_english_gloss(t): continue
        t = strip_gloss_runs(t)
        # A gloss merge can leave a one-letter column fragment
        # at a line's head ('i unum Dominum…') that is no Latin
        # word of these prayers.
        t = re.sub(r'^i (?=unum|in )', '', t)
        if t: out.append(t)
        if end_marker and end_marker in fold(' '.join(out)):
            break
    # Truncate trailing junk past the end marker: drop whole
    # trailing lines while the marker still stands without them.
    if end_marker:
        while len(out) > 1 and end_marker in fold(' '.join(out[:-1])):
            out.pop()
    return out

LATIN_SPEC = {
    'gloria': ('gloria in excelsis deo', 'in gloria dei patris amen'),
    'creed': ('credo in unum deum', 'vitam venturi saeculi amen'),
    'sanctus': ('sanctus sanctus sanctus', 'in nomine domini hosanna in excelsis'),
    'pater': ('pater noster qui es in', 'nos a malo'),
    'agnus': ('agnus dei qui tollis peccata', 'dona nobis pacem'),
    'kyrie': ('kyrie eleison', None),
    # 'confiteor' is NOT offered: witness 2 interleaves a rubric
    # ('et percutientes sibi pectus dicunt') inside the prayer,
    # so a clean two-witness word-for-word proof does not stand.
}
latin = {}
for key, (start_key, end_marker) in LATIN_SPEC.items():
    lines = latin_part(start_key, end_marker)
    if key == 'kyrie' and lines:
        keep = []
        for t in lines:
            if re.match(r'^(Kyrie|Christe|Kýrie|Chríste)', t): keep.append(t)
            if len(keep) == 6: break
        lines = keep
    latin[key] = lines

ordo_raw = open(FIX + 'src-ordo-latin.htm', encoding='utf-8', errors='replace').read()
ordo_text = fold(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', ordo_raw)))
# Witness 3, used only where witness 1's printing carries a
# defect: catholiclectionary's Ordo Missae in Latin.
ordo2_raw = open(FIX + 'src-ordo-latin-2.htm', encoding='utf-8', errors='replace').read()
ordo2_text = fold(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', ordo2_raw)))
MASS_LATIN = {}
for key, lines in latin.items():
    if not lines:
        print('LATIN MISSING (not offered):', key); continue
    seq = re.sub(r'\s+', ' ', fold(' '.join(lines))).strip()
    if seq and seq in ordo_text:
        MASS_LATIN[key] = lines
        print('LATIN PROVEN (witnesses 1+2):', key, len(lines), 'lines')
    elif key == 'sanctus' and 'benedixit' in seq:
        # Three-witness majority proof for the Sanctus: witness
        # 1 misprints 'Benedixit', witness 3 misprints 'santus'
        # for the second 'sanctus'; witness 2 is clean. The
        # offered text must stand in witness 2 whole, and in
        # witness 3 with only its own one-word misprint
        # corrected — every word is then carried by at least
        # two independent witnesses.
        w2seq = seq.replace('benedixit', 'benedictus')
        w3fixed = ordo2_text.replace(' santus ', ' sanctus ')
        if w2seq in ordo_text and w2seq in w3fixed:
            MASS_LATIN[key] = [t.replace('Benedíxit', 'Benedíctus') for t in lines]
            print('LATIN PROVEN (three-witness majority; W1 and W3 each misprint one word): sanctus', len(lines), 'lines')
        else:
            print('LATIN UNPROVEN (not offered): sanctus')
    else:
        print('LATIN UNPROVEN in witness 2 (not offered):', key)

for k, v in segs.items():
    print(k, len(v), 'lines', ('| ' + v[0][:60]) if v else '| EMPTY')

# ---------- v488: role classification (people / priest /
# rubric / heading / dialogue / excluded) ----------
# The Order page prints its rubrics in RED (<font
# color="#ff0000">) and the spoken text in black — the
# source's own typography decides commentary vs spoken.
# Mark the red spans, run the standing normalization over
# the marked text, and carry a per-line red flag out (a
# line is red when at least half its characters stand in a
# red span; the Missal's black instruction numbers prefix
# red rubric lines). The texts must come out identical to
# the standing normalization — asserted here.
def norm_flagged(path):
    raw = open(path, encoding='utf-8', errors='replace').read()
    marked = re.sub(r'<font color="#ff0000">(.*?)</font>', '\x02\\1\x03', raw, flags=re.S)
    out = []
    state = False
    for ln in norm(marked):
        red_chars = 0; total = 0; cur = state
        for ch in ln:
            if ch == '\x02': cur = True; continue
            if ch == '\x03': cur = False; continue
            total += 1
            if cur: red_chars += 1
        state = cur
        text = re.sub(r'\s+', ' ', ln.replace('\x02', '').replace('\x03', '')).strip()
        # A span holding only whitespace leaves a marker-only
        # line, which the standing normalization drops as
        # empty — drop it here too so the lists stay aligned.
        if text:
            out.append((text, total > 0 and red_chars * 2 >= total))
    return out

flagged_o = norm_flagged(FIX + 'src-order-of-mass.htm')
flagged_p = norm_flagged(FIX + 'src-prefaces.htm')
assert [t for t, _ in flagged_o] == o, 'flagged Order lines differ from the standing normalization'
assert [t for t, _ in flagged_p] == p, 'flagged Preface lines differ from the standing normalization'
FLAGMAP = {}
FLAG_CONFLICTS = []
for _t, _r in flagged_o + flagged_p:
    if _t in FLAGMAP and FLAGMAP[_t] != _r and _t not in FLAG_CONFLICTS:
        FLAG_CONFLICTS.append(_t)
    FLAGMAP[_t] = _r
print('red-flag conflicts:', FLAG_CONFLICTS)
def is_red(ln): return FLAGMAP.get(ln, False)

HEADING_LINES = {'The Introductory Rites', 'The Liturgy of the Eucharist',
                 'The Concluding Rites', 'Penitential Act*'}
SANCTUS_SET = set(segs['sanctus'])
ACCLAMATION_LINES = {
    'We proclaim your Death, O Lord,', 'and profess your Resurrection',
    'until you come again.', 'When we eat this Bread and drink this Cup,',
    'we proclaim your Death, O Lord,', 'Save us, Savior of the world,',
    'for by your Cross and Resurrection', 'you have set us free.'}
PEOPLE_LINES = ACCLAMATION_LINES | SANCTUS_SET | {
    'Amen.', 'And with your spirit.', 'Blessed be God for ever.',
    'Thanks be to God.'}
CUE_EXACT = {'The people:', 'The Priest:', 'All:', 'All reply:', 'The people reply:'}
CUE_VERB_RE = re.compile(r'\b(says|saying|continues|adds|reply|acclaim|acclaiming|follows|invites)\b')
def is_cue(ln):
    if ln in CUE_EXACT: return True
    return (ln.endswith(':') and (ln[:1].isupper() or ln[:1].isdigit())
            and CUE_VERB_RE.search(ln) is not None)
def cue_subject(ln):
    if ln in ('The people:', 'The people reply:'): return 'P'
    if ln == 'The Priest:': return 'p'
    # A line the Missal introduces as said TOGETHER with the
    # people ('Lord, I am not worthy…') is the people's line
    # too — it stands bold as their response. (The Pater
    # Noster introduction's 'together with the people'
    # continues into its own segment, which defaults to the
    # people's part on its own.)
    if 'together with the people' in ln: return 'P'
    if 'people' in ln and re.search(r'\b(reply|acclaim|acclaims|acclaiming|continue|continues|conclude|concludes)\b', ln):
        return 'P'
    if ln.startswith('All'): return 'P'
    if 'they say' in ln or 'they continue' in ln: return 'P'
    if 'Priest' in ln or 'celebrant' in ln or 'Deacon' in ln or 'Bishop' in ln: return 'p'
    return None

def _idx(lines, pred, start=0):
    for i in range(start, len(lines)):
        if pred(lines[i]): return i
    return -1
def build_xregions(seg, lines):
    regs = []
    if seg == 'creedEn':
        a = _idx(lines, lambda l: l.startswith('19. Instead of'))
        if a >= 0: regs.append((a + 1, len(lines) - 1))
    if seg == 'introPost':
        hits = [i for i, l in enumerate(lines)
                if l.startswith('V/. Kyrie') or l.startswith('V/. Christe')]
        if hits: regs.append((min(hits), max(hits)))
    if seg == 'epI':
        a = _idx(lines, lambda l: l == 'PROPER FORMS OF THE COMMUNICANTES')
        b = _idx(lines, lambda l: l.startswith('87. With hands extended'))
        if a >= 0 and b > a: regs.append((a, b - 1))
        t = _idx(lines, lambda l: l.startswith('From the Mass of the Paschal Vigil'), start=95)
        e = _idx(lines, lambda l: l == '(Through Christ our Lord. Amen.)', start=t) if t >= 0 else -1
        if t >= 0 and e >= t: regs.append((t, e))
    if seg == 'epII':
        a = _idx(lines, lambda l: l.startswith('In Masses for the Dead'))
        e = _idx(lines, lambda l: l == 'may also be one with him in his Resurrection.', start=a) if a >= 0 else -1
        if a >= 0 and e > a: regs.append((a + 1, e))
    if seg == 'concluding':
        a = _idx(lines, lambda l: l.startswith('143. In a Pontifical Mass'))
        d = _idx(lines, lambda l: l.startswith('the Father, X and the Son'), start=a) if a >= 0 else -1
        e = _idx(lines, lambda l: l == 'Amen.', start=d) if d >= 0 else -1
        if a >= 0 and e > a: regs.append((a + 1, e))
    return regs

SEG_DEFAULT = {'introPre': 'p', 'confiteorEn': 'P', 'introMid': 'p',
               'kyrieEn': 'p', 'introPost': 'p', 'gloriaEn': 'P',
               'introTail': 'p', 'creedEn': 'P', 'creedOutro': 'p',
               'offertory': 'p', 'prefaceDialogue': 'p',
               'commonPreface1': 'p', 'sanctus': 'P', 'epI': 'p',
               'epII': 'p', 'epIII': 'p', 'epIV': 'p',
               'communionPre': 'p', 'paterEn': 'P', 'communionMid': 'p',
               'agnusEn': 'P', 'communionPost': 'p', 'concluding': 'p'}
def classify(seg, lines):
    regs = build_xregions(seg, lines)
    pending = SEG_DEFAULT.get(seg, 'p')
    roles = []
    for i, ln in enumerate(lines):
        if any(a <= i <= b for a, b in regs):
            roles.append('x'); continue
        if ln in HEADING_LINES:
            roles.append('h'); continue
        if is_cue(ln):
            pending = cue_subject(ln) or pending
            roles.append('r'); continue
        m = re.match(r'^\d+\.\s+(.*)$', ln)
        if m and len(m.group(1).split()) <= 6:
            roles.append('h'); continue
        if ln.startswith('*'):
            roles.append('r'); continue
        if is_red(ln):
            roles.append('r'); continue
        if ln.startswith('V/.') and ' R/. ' in ln:
            roles.append('d'); continue
        if ln.startswith('V/.'):
            roles.append('p'); continue
        if ln.startswith('R/.'):
            roles.append('P'); continue
        if ln in PEOPLE_LINES:
            roles.append('P'); continue
        roles.append(pending)
    return ''.join(roles)

ROLES = {k: classify(k, v) for k, v in segs.items()}
LATIN_ROLES = {k: 'P' * len(v) for k, v in MASS_LATIN.items()}
for k, v in segs.items():
    assert len(ROLES[k]) == len(v), ('roles length', k)
with open('/tmp/v488-classification-dump.txt', 'w', encoding='utf-8') as df:
    for k, v in segs.items():
        df.write(f"\n===== {k}\n")
        for i, ln in enumerate(v):
            df.write(f"{ROLES[k][i]} {'RED' if is_red(ln) else '   '} {i}\t{ln}\n")
print('classification dump: /tmp/v488-classification-dump.txt')

ts = ('// v486: generated by app/tests/gen-mass-order.py from the\n'
      '// proven source pages (Order of Mass + Prefaces, Roman\n'
      '// Missal 2011). Fixed ICEL texts; do not hand-edit.\n'
      'export const MASS_ORDER: Record<string, string[]> = '
      + json.dumps(segs, ensure_ascii=False, indent=0) + ';\n'
      '// Latin of the Ordinary parts, proven word-for-word by\n'
      '// two witnesses of the Missale Romanum, editio typica\n'
      '// tertia emendata (see gen-mass-order.py). A part absent\n'
      '// here carries no toggle.\n'
      'export const MASS_LATIN: Record<string, string[]> = '
      + json.dumps(MASS_LATIN, ensure_ascii=False, indent=0) + ';\n'
      '// v488: one role code per line above, index-aligned.\n'
      '// P people (bold) · p priest (regular) · r rubric /\n'
      '// commentary (never rendered) · h heading · d dialogue\n'
      '// (a combined V/. R/. line) · x excluded (another Mass\n'
      '// form, season, or alternative text — see the release\n'
      '// document, section 2, Control 4 audit). The rubric\n'
      '// split follows the source pages own typography (red\n'
      '// print); the people/priest split follows the Missals\n'
      '// own speaker cues. See gen-mass-order.py.\n'
      'export const MASS_ROLES: Record<string, string> = '
      + json.dumps(ROLES, ensure_ascii=False, indent=0) + ';\n'
      'export const MASS_LATIN_ROLES: Record<string, string> = '
      + json.dumps(LATIN_ROLES, ensure_ascii=False, indent=0) + ';\n')
open(OUT, 'w', encoding='utf-8').write(ts)
print('wrote', OUT)
