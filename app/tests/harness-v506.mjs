// harness-v506.mjs — v506 evidence: the Pre-Mass Prayers
// section + ONE card system at all four Mass prayer
// sections (John, 2026-11-17 14:50 CT, on the v505 ship):
//   (1) a "Pre-Mass Prayers" section stands at the very
//       top of the Mass scroll, above the Order of Mass,
//       in the big-section-title dress, DEFAULT COLLAPSED
//       on every view; its list is seeded by migration
//       0035 with the traditional prayers before Mass
//   (2) the two private Communion seats convert from
//       v501's single picks to card lists on v505's
//       shipped system (same .mass-panel card · one-tap
//       Remove · v413 move buttons · the library popup +
//       duplicate guard · the whole-list server store),
//       standing in their v505 places under their exact
//       labels; the standing picks carry (after:
//       prayer-after-communion; before: empty)
//   (3) the Post-Mass section already runs the system —
//       it stands as v505 shipped it
//   S statics: the Mass sources byte-identical to the
//     v505 ship · index.ts differs only inside the
//     mass-personal read/write region · client.ts
//     carries the Pre-Mass paint + collapse, the one
//     list paint, the four-seat config; the single
//     paints are gone · ui.ts differs only in the pin
//     and the three collapse rules · migration 0035's
//     shape · the extended book fixture (77 rows)
//   M the migration proof: python3's sqlite3 applies the
//     real book chain (0026 + 0029 + 0030), the real
//     0032, a seeded v495 row, the real 0033, the
//     production afterMass picks, the real 0034, then
//     the real 0035 — premass reads the seed set in
//     order, the standing rows carry whole, the book
//     reads 77 with the two new rows word-equal to the
//     v506 fixture, and the four-seat CHECK refuses a
//     fifth seat
//   (a) the Pre-Mass place + the collapsed default +
//       expand/collapse + collapsed again on a fresh load
//   (b) the seeded cards word-equal to their book rows;
//       the Latin switch stands only where the row
//       carries Latin
//   (c) the before-Communion list system (add via the
//       popup · the duplicate guard · one-tap remove)
//   (d) the after-Communion list system + the standing
//       pick's carry (add · re-order persists · remove)
//   (e) the Pre-Mass list system (one-tap remove ·
//       re-order persists across a fresh load)
//   (f) the Post-Mass section stands on the system
//       (the standing mark · one-tap remove)
//   (g) the Communion order + headings + the tail order
//   (h) per-card Latin at the Pre-Mass section
//   (i) the personal GET failing leaves the scroll whole
//   (k) byte-identity vs the v505 ship outside the
//       Pre-Mass block and the two Communion seat hosts
//   (l) cooked parse + Chromium boot clean (the v439
//       gate)
// Fixtures (Improvement D): the book is the LIVE payload
// captured through the prayer door on 2026-11-17
// (tests/fixtures/book-live-2026-11-17.json — 9 groups,
// 75 prayers) extended by the two new rows from the
// v506 fixture (tests/fixtures-v506/
// blessed-be-god-premass.txt — the Blessed Be God texts
// verified word-for-word against the edition), standing
// at the head of the Mass & Communion group as migration
// 0035's sorts place them. The Mass day + readings
// fixtures are the harness-v494 set (production payload
// shapes). The store stub mirrors the generalized
// session PUT route: GET answers the four lists; PUT
// validates seat + slugs against the book, refuses a
// duplicate, and answers the re-read. The main flow's
// store is seeded as migration 0035 leaves production:
// before [] · after [prayer-after-communion] · afterMass
// the 0034 set · preMass the 0035 seed. Run: node
// app/tests/harness-v506.mjs [--probe] (from the
// worktree root). --probe only prints.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const PROBE = process.argv.includes('--probe');
const APP = path.resolve(process.cwd(), 'app');
const SRC = APP + '/worker/src';
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const I_SRC = readFileSync(SRC + '/index.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const MIGS = {};
for (const f of ['0026_prayer_book.sql', '0029_prayer_book_additions.sql', '0030_raccolta_prayer_source.sql', '0032_mass_personal_prayer.sql', '0033_mass_personal_prayer_seats.sql', '0034_post_mass_list_seed.sql', '0035_premass_seat_and_book_rows.sql']) {
  MIGS[f] = readFileSync(APP + '/migrations/' + f, 'utf8');
}
const MIG35 = MIGS['0035_premass_seat_and_book_rows.sql'];
const BASE = path.resolve(process.cwd(), '../../.worktrees/v505-ship/app/worker/src');
const C_BASE = readFileSync(BASE + '/client.ts', 'utf8');
const I_BASE = readFileSync(BASE + '/index.ts', 'utf8');
const U_BASE = readFileSync(BASE + '/ui.ts', 'utf8');
const BOOK = JSON.parse(readFileSync(APP + '/tests/fixtures/book-live-2026-11-17.json', 'utf8'));
const PREMASS_FIXTURE = readFileSync(APP + '/tests/fixtures-v506/blessed-be-god-premass.txt', 'utf8');
const premassBodies = {};
for (const m of PREMASS_FIXTURE.matchAll(/=== (\S+)\n([\s\S]*?)(?=\n=== |$)/g)) premassBodies[m[1]] = m[2].trim();
const NEW_ROWS = [
  { slug: 'prayer-of-st-ambrose-before-mass', title: 'Prayer of St. Ambrose before Mass', body: premassBodies['prayer-of-st-ambrose-before-mass'], bodyLatin: null, source: 'Blessed Be God (Callan & McHugh, 1925), Preparation for Communion' },
  { slug: 'prayer-of-st-thomas-aquinas-before-mass', title: 'Prayer of St. Thomas Aquinas before Mass', body: premassBodies['prayer-of-st-thomas-aquinas-before-mass'], bodyLatin: null, source: 'Blessed Be God (Callan & McHugh, 1925), Preparation for Communion' },
];
{
  const mc = BOOK.groups.find((g) => g.category === 'Mass & Communion');
  mc.prayers = [...NEW_ROWS, ...mc.prayers];
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SET = ['anima-christi', 'act-of-faith', 'act-of-hope', 'act-of-charity', 'hail-mary', 'hail-holy-queen', 'st-michael'];
const SEED_PM = ['prayer-of-st-ambrose-before-mass', 'prayer-of-st-thomas-aquinas-before-mass', 'prayer-before-mass', 'prayer-before-a-crucifix'];
const ICEL = 'The English translation of The Roman Missal \u00a9 2010, International Commission on English in the Liturgy Corporation. All rights reserved.';

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (PROBE) { console.log('probe -', label, extra ? ' :: ' + extra : ''); return; }
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}
const words = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const bookRow = (slug) => {
  for (const g of BOOK.groups) for (const p of g.prayers) if (p.slug === slug) return { p, category: g.category };
  return null;
};
const BOOK_COUNT = BOOK.groups.reduce((a, g) => a + g.prayers.length, 0);

/* ---------------- S: statics ---------------- */
{
  for (const f of ['mass.ts', 'mass-order.ts', 'mass-readings.ts']) {
    ok(readFileSync(SRC + '/' + f, 'utf8') === readFileSync(BASE + '/' + f, 'utf8'),
      'S1-' + f + ': the Mass source stands byte-identical to the v505 ship');
  }
  const iMark = '// v495 \u00a72, generalized by v501';
  const iTail = 'if (seg[2] === "intentions"';
  ok(I_SRC.slice(0, I_SRC.indexOf(iMark)) === I_BASE.slice(0, I_BASE.indexOf(iMark))
    && I_SRC.slice(I_SRC.indexOf(iTail)) === I_BASE.slice(I_BASE.indexOf(iTail)),
    'S2: index.ts stands byte-identical to the v505 ship outside the mass-personal read/write region (the read function through the PUT handler)');
  ok(I_SRC.includes('preMass: string[]') && I_SRC.includes('seat must be before, after, aftermass, or premass')
    && I_SRC.includes('premass: "preMass"') && !I_SRC.includes('slugs[0] ?? null'),
    'S3: index.ts carries the four-list read (preMass in the body, the seat map, no element-0 reads left) and the four-seat PUT');
  const paint = C_SRC.slice(C_SRC.indexOf('function paintMassScroll()'), C_SRC.indexOf('view.innerHTML = h', C_SRC.indexOf('function paintMassScroll()')));
  const iCtl = paint.indexOf('mass-controls');
  const iPreH = paint.indexOf('id="mass-premass-head"', iCtl);
  const iPre = paint.indexOf('id="mass-personal-premass"', iPreH);
  const iIntro = paint.indexOf("massSectionHtml('Introductory Rites')", iPre);
  ok(iCtl > 0 && iPreH > iCtl && iPre > iPreH && iIntro > iPre
    && paint.includes('mass-collapsible') && paint.includes('Pre-Mass Prayers'),
    'S4: paintMassScroll order at the head — the controls · the Pre-Mass Prayers collapsible title · the premass host · Introductory Rites');
  const iAnt = paint.indexOf("massAntiphonHtml('Communion Antiphon'");
  const iBef = paint.indexOf('id="mass-personal-before"', iAnt);
  const iAft = paint.indexOf('id="mass-personal-after"', iBef);
  const iPac = paint.indexOf("massPrayerHtml('Prayer after Communion'", iAft);
  const iCR = paint.indexOf("massSectionHtml('Concluding Rites')", iPac);
  const iPM = paint.indexOf("massSectionHtml('Post-Mass Prayers')", iCR);
  const iAM = paint.indexOf('id="mass-personal-aftermass"', iPM);
  const iAck = paint.indexOf('id="mass-acks"', iAM);
  const iNot = paint.indexOf('class="mass-notice"', iAck);
  ok(iAnt > 0 && iBef > iAnt && iAft > iBef && iPac > iAft && iCR > iPac && iPM > iCR && iAM > iPM && iAck > iAM && iNot > iAck
    && paint.split('mass-notice').length - 1 === 1,
    'S5: paintMassScroll order stands — Antiphon · before list · after list · Prayer after Communion · Concluding Rites · Post-Mass Prayers · the after-Mass list · the acks · ONE notice, last');
  ok(C_SRC.includes('function massPersonalListHtml(seat)')
    && !C_SRC.includes('massPersonalSingleHtml') && !C_SRC.includes('massPostMassHtml')
    && C_SRC.includes("premass: { host: 'mass-personal-premass'")
    && C_SRC.includes("key: 'preMass'") && C_SRC.includes("key: 'afterMass'")
    && C_SRC.includes("label: 'Private Pre-Communion Prayer'") && C_SRC.includes("label: 'Private Post-Communion Prayer'")
    && C_SRC.includes("add: 'Add a prayer before Mass'")
    && C_SRC.includes('state.mass.preMassOpen = false'),
    'S6: client.ts carries the one list paint (the single paints retired), the four-seat config with the premass seat and the exact labels, and the preMassOpen reset at paintMassLiturgy');
  const pin = (s) => s.replace(/ora-pro-nobis-v\d+-\d+/g, 'PIN');
  const stripNew = (s) => s.split('\n').filter((l) => !l.startsWith('.mass-collapsible') && !l.startsWith('.mass-collmark') && !l.startsWith('.mass-personal-hidden')).join('\n');
  ok(pin(stripNew(U_SRC)) === pin(U_BASE),
    'S7: ui.ts is byte-identical to the v505 ship outside the pin line and the three collapse rules');
  ok(U_SRC.includes('.mass-collapsible { cursor: pointer; }') && U_SRC.includes('.mass-collmark { float: right; }')
    && U_SRC.includes('.mass-personal-hidden { display: none; }'),
    'S8: the collapse rules stand — the tappable title, the marker at the right, the hidden host');
  ok(MIG35.includes("CHECK (seat IN ('before','after','aftermass','premass'))")
    && MIG35.includes('["prayer-of-st-ambrose-before-mass","prayer-of-st-thomas-aquinas-before-mass","prayer-before-mass","prayer-before-a-crucifix"]')
    && MIG35.includes("'prayer-of-st-ambrose-before-mass'") && MIG35.includes("'prayer-of-st-thomas-aquinas-before-mass'")
    && MIG35.includes('SELECT seat, slugs, updated_at FROM mass_personal_prayer'),
    'S9: migration 0035 carries the four-seat CHECK, the premass seed in order, the two new book rows, and the whole-row copy of the standing seats');
  ok(BOOK_COUNT === 77 && BOOK.groups.length === 9 && SEED_PM.every((s) => !!bookRow(s))
    && words(bookRow('prayer-of-st-ambrose-before-mass').p.body) === words(premassBodies['prayer-of-st-ambrose-before-mass'])
    && words(bookRow('prayer-of-st-thomas-aquinas-before-mass').p.body) === words(premassBodies['prayer-of-st-thomas-aquinas-before-mass'])
    && !!bookRow('prayer-before-a-crucifix').p.bodyLatin,
    'S10: the extended book fixture stands (9 groups, 77 prayers); the two new rows are word-equal to the v506 fixture; the crucifix row carries its Latin', 'count ' + BOOK_COUNT);
}

/* ---------------- M: the migration proof ---------------- */
{
  const py = [
    'import sqlite3, sys, json, re',
    'def rd(p): return open(p).read()',
    'db = sqlite3.connect(":memory:")',
    'for f in sys.argv[1:4]: db.executescript(rd(f))',
    'db.executescript(rd(sys.argv[4]))',
    'db.execute("INSERT INTO mass_personal_prayer (id, slug, updated_at) VALUES (1, \'prayer-after-communion\', \'2026-11-17T00:00:00.000Z\')")',
    'db.executescript(rd(sys.argv[5]))',
    'db.execute("UPDATE mass_personal_prayer SET slugs = \'[\\"st-michael\\",\\"act-of-faith\\",\\"act-of-charity\\"]\' WHERE seat = \'aftermass\'")',
    'db.executescript(rd(sys.argv[6]))',
    'db.executescript(rd(sys.argv[7]))',
    'rows = {r[0]: json.loads(r[1]) for r in db.execute("SELECT seat, slugs FROM mass_personal_prayer")}',
    'assert rows["premass"] == ["prayer-of-st-ambrose-before-mass","prayer-of-st-thomas-aquinas-before-mass","prayer-before-mass","prayer-before-a-crucifix"], rows',
    'assert rows["after"] == ["prayer-after-communion"], rows',
    'assert rows["before"] == [], rows',
    'assert rows["aftermass"] == ["anima-christi","act-of-faith","act-of-hope","act-of-charity","hail-mary","hail-holy-queen","st-michael"], rows',
    'n = db.execute("SELECT COUNT(*) FROM prayer_book").fetchone()[0]',
    'assert n == 77, n',
    'fx = open(sys.argv[8]).read()',
    'blocks = {m.group(1): m.group(2).strip() for m in re.finditer(r"=== (\\S+)\\n(.*?)(?=\\n=== |\\Z)", fx, re.S)}',
    'norm = lambda s: " ".join(s.split())',
    'for slug in ["prayer-of-st-ambrose-before-mass", "prayer-of-st-thomas-aquinas-before-mass"]:',
    '    t, cat, b, bl, so = db.execute("SELECT title, category, body, body_latin, sort FROM prayer_book WHERE slug = ?", (slug,)).fetchone()',
    '    assert norm(b) == norm(blocks[slug]), slug',
    '    assert bl is None and cat == "Mass & Communion", slug',
    'order = [r[0] for r in db.execute("SELECT slug FROM prayer_book WHERE category = \'Mass & Communion\' ORDER BY sort")]',
    'assert order[:3] == ["prayer-of-st-ambrose-before-mass", "prayer-of-st-thomas-aquinas-before-mass", "prayer-before-mass"], order[:3]',
    'try:',
    '    db.execute("INSERT INTO mass_personal_prayer (seat, slugs, updated_at) VALUES (\'fifth\', \'[]\', \'x\')")',
    '    raise SystemExit("CHECK FAILED")',
    'except sqlite3.IntegrityError:',
    '    pass',
    'print("MIGRATION_OK")',
  ].join('\n');
  const tmp = path.join(os.tmpdir(), 'harness-v506-mig.py');
  writeFileSync(tmp, py);
  const f = (n, c) => { const p = path.join(os.tmpdir(), n); writeFileSync(p, c); return p; };
  const names = ['0026_prayer_book.sql', '0029_prayer_book_additions.sql', '0030_raccolta_prayer_source.sql', '0032_mass_personal_prayer.sql', '0033_mass_personal_prayer_seats.sql', '0034_post_mass_list_seed.sql', '0035_premass_seat_and_book_rows.sql'];
  let migOut = '';
  try {
    migOut = execFileSync('python3', [tmp, ...names.map((n) => f('harness-v506-' + n, MIGS[n])), APP + '/tests/fixtures-v506/blessed-be-god-premass.txt'], { encoding: 'utf8' });
  } catch (e) { migOut = 'ERR ' + String((e.stdout || '') + (e.stderr || e.message)).slice(0, 240); }
  ok(migOut.includes('MIGRATION_OK'),
    'M1: the real chain (book 0026+0029+0030 · 0032 + the v495 row · 0033 · the production picks · 0034 · 0035) — premass reads the seed in order, the standing rows carry whole, the book reads 77 with the new rows word-equal to the fixture at the head of their group, and the CHECK refuses a fifth seat',
    migOut.trim().slice(0, 200));
}

/* ---------------- fixtures + pages ---------------- */
function cook(src) {
  const t = src.indexOf('APP_JS = `') + 10;
  return new Function('return `' + src.slice(t, src.indexOf('`;', t)) + '`')();
}
let COOKED = null, COOKED_BASE = null;
try { COOKED = cook(C_SRC); ok(true, 'P1: the cooked APP_JS parses (the v439 gate)'); }
catch (e) { ok(false, 'P1: the cooked APP_JS parses (the v439 gate)', String(e).slice(0, 160)); }
try { COOKED_BASE = cook(C_BASE); } catch (e) { console.log('note - base cook failed:', String(e).slice(0, 120)); }
const APP_CSS = U_SRC.slice(U_SRC.indexOf('APP_CSS = `') + 11, U_SRC.indexOf('`;', U_SRC.indexOf('APP_CSS = `')));
const APP_CSS_BASE = U_BASE.slice(U_BASE.indexOf('APP_CSS = `') + 11, U_BASE.indexOf('`;', U_BASE.indexOf('APP_CSS = `')));
const SHELL = U_SRC.slice(U_SRC.indexOf('SHELL_HTML = `') + 14, U_SRC.indexOf('`;', U_SRC.indexOf('SHELL_HTML = `')));

const DAY = {
  ok: true, date: '2026-11-15', presentedDay: '2026-11-15',
  dateLabel: 'Sunday, November 15, 2026',
  liturgicalDay: { name: '33rd Sunday in Ordinary Time', color: 'green' },
  introTexts: {},
  blocks: [{ block: 'Morning', label: 'Morning', tracks: [
    { episodeId: '9001', title: 'Invitatory', durationS: 240, available: true, streamUrl: 'https://audio.example/9001.mp3' },
    { episodeId: '9002', title: 'Morning Prayer', durationS: 720, available: true, streamUrl: 'https://audio.example/9002.mp3' },
  ] }],
  episodes: [],
};
const FORMULARY_A = {
  entranceAntiphon: { text: 'I will bless the Lord at all times.', ref: 'Ps 34' },
  collect: 'O God, who made the Memorial of Saint Elizabeth a sign of your care, grant, we pray, that we may follow her example. Through our Lord Jesus Christ, your Son.',
  prayerOverOfferings: 'Accept, O Lord, the offerings we bring in honor of Saint Elizabeth.',
  prefaceText: null, prefaceName: null,
  communionAntiphon: { text: 'Blessed are the merciful, for they shall receive mercy.', ref: 'Mt 5:7' },
  prayerAfterCommunion: 'Nourished by this sacrament, O Lord, may we imitate Saint Elizabeth in charity.',
};
const FORMULARY_B = {
  entranceAntiphon: { text: 'The Lord speaks of peace to his people.', ref: 'Ps 85' },
  collect: 'Grant us, Lord our God, that we may honor you with all our mind. Through our Lord Jesus Christ, your Son.',
  prayerOverOfferings: 'Look with favor, O Lord, on the offerings of your people.',
  prefaceText: null, prefaceName: null,
  communionAntiphon: { text: 'Whoever eats this bread will live for ever.', ref: 'Jn 6' },
  prayerAfterCommunion: 'May the working of your mercy, O Lord, guide our hearts.',
};
const MASS_PAYLOAD = {
  ok: true, name: 'Memorial of Saint Elizabeth of Hungary, Religious', season: 'Ordinary',
  defaultVersion: 'elizabeth',
  versions: [
    { key: 'elizabeth', label: 'St Elizabeth of Hungary', rank: 'M', formulary: FORMULARY_A },
    { key: 'feria', label: 'Tuesday of the 33rd Week', rank: null, formulary: FORMULARY_B },
  ],
};
const MASS_FEED = { ok: true, found: true, parts: [
  { key: 'r1', heading: 'First Reading', source: 'Rev 3:1-6, 14-22', html: '<p>I, John, heard the Lord saying to me: Because you are lukewarm, I will spit you out of my mouth.</p>' },
  { key: 'ps', heading: 'Responsorial Psalm', source: 'Ps 15:2-3a, 3bc-4ab, 5', html: '<p>R. (Rev. 3: 21) I will seat the victor beside me on my throne.</p><p>He who walks blamelessly and does justice; who thinks the truth in his heart and slanders not with his tongue.</p>' },
  { key: 'ga', heading: 'Gospel Acclamation', source: '1 Jn 4:10b', html: '<p>R. Alleluia, alleluia.</p><p>God loved us, and sent his Son as expiation for our sins.</p><p>R. Alleluia, alleluia.</p>' },
  { key: 'g', heading: 'Gospel', source: 'Lk 19:1-10', html: '<p>At that time Jesus came to Jericho and intended to pass through the town. Now a man there named Zacchaeus, who was a chief tax collector and also a wealthy man, was seeking to see who Jesus was.</p>' },
] };

function buildPage(cooked, css) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body data-lit="">
<audio id="audio"></audio>
${SHELL}
<script>
window.__fetchLog = [];
var BOOK_STUB = ${JSON.stringify(BOOK)};
window.fetch = function (path, opts) {
  const p = String(path);
  window.__fetchLog.push({ path: p });
  const ans = function (status, body) { return Promise.resolve({ ok: status < 400, status: status, json: function () { return Promise.resolve(body); } }); };
  if (p.indexOf('/api/player/day') === 0) return ans(200, ${JSON.stringify(DAY)});
  if (p.indexOf('/api/prayer/mass?') === 0) return ans(200, ${JSON.stringify(MASS_PAYLOAD)});
  if (p.indexOf('/api/prayer/mass-readings') === 0) return ans(200, ${JSON.stringify(MASS_FEED)});
  if (p.indexOf('/api/prayer/book') === 0) return ans(200, BOOK_STUB || { ok: true, groups: [] });
  if (p.indexOf('/api/prayer/mass-personal-prayer') === 0) {
    const empty = function () { return { before: [], after: [], afterMass: [], preMass: [] }; };
    const readStore = function () {
      try { return JSON.parse(localStorage.getItem('mp-store-v506') || 'null') || empty(); }
      catch (e) { return empty(); }
    };
    const bookHas = function (slug) {
      let found = false;
      (BOOK_STUB ? BOOK_STUB.groups : []).forEach(function (g) { g.prayers.forEach(function (x) { if (x.slug === slug) found = true; }); });
      return found;
    };
    if (opts && opts.method === 'PUT') {
      let body = {};
      try { body = JSON.parse(opts.body || '{}'); } catch (e) {}
      const seat = body.seat;
      const keyOf = { before: 'before', after: 'after', aftermass: 'afterMass', premass: 'preMass' };
      if (!keyOf[seat]) return ans(400, { error: 'seat must be before, after, aftermass, or premass' });
      if (!Array.isArray(body.slugs)) return ans(400, { error: 'slugs must be an array' });
      const seen = [];
      for (const s of body.slugs) {
        if (typeof s !== 'string') return ans(400, { error: 'slugs must be strings' });
        if (seen.indexOf(s) >= 0) return ans(400, { error: 'duplicate slug ' + s });
        if (!bookHas(s)) return ans(400, { error: 'bad slug ' + s });
        seen.push(s);
      }
      const store = readStore();
      store[keyOf[seat]] = body.slugs.slice();
      try { localStorage.setItem('mp-store-v506', JSON.stringify(store)); } catch (e) {}
      return ans(200, { ok: true, before: store.before, after: store.after, afterMass: store.afterMass, preMass: store.preMass });
    }
    if (window.__mpFailGet) return ans(500, { error: 'boom' });
    const cur = readStore();
    return ans(200, { ok: true, before: cur.before, after: cur.after, afterMass: cur.afterMass, preMass: cur.preMass });
  }
  return ans(200, { ok: true });
};
function extFetchText(url) { return Promise.reject(new Error('offline')); }
URL.createObjectURL = function () { return 'blob:fake'; };
URL.revokeObjectURL = function () {};
HTMLMediaElement.prototype.play = function () { const el = this; setTimeout(function(){ el.dispatchEvent(new Event('play')); }, 10); return Promise.resolve(); };
HTMLMediaElement.prototype.pause = function () { this.dispatchEvent(new Event('pause')); };
HTMLMediaElement.prototype.load = function () {};
</` + `script>
<script>
${cooked}
</` + `script>
</body></html>`;
}

let PAGE = '', PAGE_BASE = '';
const server = http.createServer((req, res) => {
  const u = (req.url || '/').split('?')[0];
  if (u === '/v506') { res.setHeader('Content-Type', 'text/html'); res.end(PAGE); return; }
  if (u === '/base') { res.setHeader('Content-Type', 'text/html'); res.end(PAGE_BASE); return; }
  res.statusCode = 404; res.end('not found');
});
PAGE = buildPage(COOKED, APP_CSS);
PAGE_BASE = buildPage(COOKED_BASE, APP_CSS_BASE);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });

const SEED_STORE = { before: [], after: ['prayer-after-communion'], afterMass: SET.slice(), preMass: SEED_PM.slice() };
const SEED_INIT = () => {
  if (!localStorage.getItem('mp-seeded-v506')) {
    localStorage.setItem('mp-store-v506', JSON.stringify({ before: [], after: ['prayer-after-communion'], afterMass: ['anima-christi', 'act-of-faith', 'act-of-hope', 'act-of-charity', 'hail-mary', 'hail-holy-queen', 'st-michael'], preMass: ['prayer-of-st-ambrose-before-mass', 'prayer-of-st-thomas-aquinas-before-mass', 'prayer-before-mass', 'prayer-before-a-crucifix'] }));
    localStorage.setItem('mp-seeded-v506', '1');
  }
};

async function boot(which, errs, tag, initScript) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (initScript) await ctx.addInitScript(initScript);
  const page = await ctx.newPage();
  await ctx.route('**/*', (route) => {
    if (route.request().url().startsWith(ORIGIN)) route.continue(); else route.abort();
  });
  page.on('pageerror', (e) => { errs.push(String(e).slice(0, 160)); console.log('note -', tag, 'pageerror:', String(e).slice(0, 140)); });
  await page.goto(ORIGIN + which);
  await page.waitForSelector('[data-openblock]', { timeout: 25000 }).catch(() => console.log('note -', tag, 'openblock slow'));
  await sleep(400);
  await page.click('#tabbar .tab[data-tab="mass"]');
  await page.waitForSelector('.mass-scroll', { timeout: 15000 }).catch(() => console.log('note -', tag, 'mass scroll slow'));
  await page.waitForSelector('#mass-personal-aftermass', { timeout: 15000 }).catch(() => console.log('note -', tag, 'seat slow'));
  await sleep(800);
  return { ctx, page };
}
const store = (page) => page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('mp-store-v506') || 'null'); } catch (e) { return null; }
});
const panelHeads = (page, hostId) => page.evaluate((id) =>
  Array.from(document.querySelectorAll('#' + id + ' .mass-panel')).map((pn) => (pn.querySelector('.mass-h') || {}).textContent || null), hostId);
const pmState = (page) => page.evaluate(() => {
  const head = document.getElementById('mass-premass-head');
  const host = document.getElementById('mass-personal-premass');
  const scroll = document.querySelector('.mass-scroll');
  const kids = scroll ? Array.from(scroll.children) : [];
  return {
    headText: head ? head.textContent.replace(/\s+/g, ' ').trim() : null,
    headIsSection: head ? head.classList.contains('mass-section') : false,
    headIdx: kids.indexOf(head),
    introIdx: kids.findIndex((k) => k.classList && k.classList.contains('mass-section') && k.textContent === 'Introductory Rites'),
    hostIdx: kids.indexOf(host),
    hidden: host ? host.classList.contains('mass-personal-hidden') : null,
    display: host ? getComputedStyle(host).display : null,
    panels: host ? host.querySelectorAll('.mass-panel').length : 0,
  };
});

/* ---------------- the main flow ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot('/v506', errs, 'main', SEED_INIT);
  await page.waitForSelector('#mass-personal-aftermass .mass-panel', { timeout: 15000 }).catch(() => console.log('note - main panels slow'));
  await page.waitForSelector('#mass-personal-premass .mass-panel', { state: 'attached', timeout: 15000 }).catch(() => console.log('note - main premass panels slow'));
  await sleep(500);

  /* (a) the Pre-Mass place + the collapsed default */
  const a1 = await pmState(page);
  ok(a1.headIsSection && a1.headText.startsWith('Pre-Mass Prayers') && a1.headIdx >= 0 && a1.hostIdx === a1.headIdx + 1
    && a1.introIdx === a1.hostIdx + 1 && a1.hidden === true && a1.display === 'none' && a1.panels === 4,
    'A1: the Pre-Mass Prayers title stands in the big-section dress immediately above its host and immediately above Introductory Rites; on a fresh open the host stands hidden (display none) with its four seeded cards inside, unshown',
    JSON.stringify(a1));
  await page.click('#mass-premass-head');
  await sleep(400);
  const a2 = await pmState(page);
  ok(a2.hidden === false && a2.display !== 'none' && a2.panels === 4,
    'A2: tapping the title expands the section — the host stands shown with its four cards', JSON.stringify(a2));

  /* (b) the seeded cards word-equal + the Latin stands where the row carries it */
  const pmHeads = await panelHeads(page, 'mass-personal-premass');
  const bInfo = await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll('#mass-personal-premass .mass-panel'));
    return panels.map((pn) => ({
      lines: Array.from(pn.querySelectorAll('.mass-line')).map((l) => l.textContent).join('\n'),
      lang: !!pn.querySelector('.langswitch'),
      rm: !!pn.querySelector('[data-mpremove]'), up: !!pn.querySelector('[data-mpup]'), down: !!pn.querySelector('[data-mpdown]'),
    }));
  });
  ok(JSON.stringify(pmHeads) === JSON.stringify(SEED_PM.map((s) => bookRow(s).p.title))
    && bInfo.every((b, i) => words(b.lines) === words(bookRow(SEED_PM[i]).p.body) && b.rm && b.up && b.down),
    'B1: the Pre-Mass list paints the seed set in seed order, each card word-equal to its book row, each carrying Remove + the move buttons',
    JSON.stringify(pmHeads));
  ok(bInfo[3].lang === true && bInfo[0].lang === false && bInfo[1].lang === false,
    'B2: the Latin switch stands on the crucifix card (its row carries Latin) and on neither new row (the edition prints English only)');

  /* (h) per-card Latin at the Pre-Mass section */
  await page.click('#mass-personal-premass .mass-panel:nth-child(4) [data-mplang="la"]');
  await sleep(500);
  const hInfo = await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll('#mass-personal-premass .mass-panel'));
    return {
      crucifix: Array.from(panels[3].querySelectorAll('.mass-line')).map((l) => l.textContent).join('\n'),
      ambrose: Array.from(panels[0].querySelectorAll('.mass-line')).map((l) => l.textContent).join('\n'),
    };
  });
  ok(words(hInfo.crucifix) === words(bookRow('prayer-before-a-crucifix').p.bodyLatin)
    && words(hInfo.ambrose) === words(bookRow('prayer-of-st-ambrose-before-mass').p.body),
    'H1: the crucifix card\'s Latin switch turns its own body to the book row\'s Latin only — the Ambrose card stands in English');
  await page.click('#mass-personal-premass .mass-panel:nth-child(4) [data-mplang="en"]');
  await sleep(400);

  /* (g) the Communion order + headings + the tail */
  const gInfo = await page.evaluate(() => {
    const scroll = document.querySelector('.mass-scroll');
    const tokens = [];
    Array.from(scroll.children).forEach((el) => {
      if (el.id === 'mass-personal-before') tokens.push('SEAT-BEFORE');
      else if (el.id === 'mass-personal-after') tokens.push('SEAT-AFTER');
      else if (el.classList && el.classList.contains('mass-h')) tokens.push('H:' + el.textContent);
    });
    const marks = [];
    scroll.querySelectorAll('.mass-section, #mass-personal-aftermass, #mass-acks, .mass-notice').forEach((el) => {
      marks.push(el.classList.contains('mass-section') ? 'SEC:' + el.textContent.replace(/\s+/g, ' ').trim() : (el.id ? '#' + el.id : '.mass-notice'));
    });
    return {
      tokens, marks,
      beforeLabel: (document.querySelector('#mass-personal-before .mass-h') || {}).textContent || null,
      afterLabel: (document.querySelector('#mass-personal-after .mass-h') || {}).textContent || null,
      notices: scroll.querySelectorAll('.mass-notice').length,
      lastCls: scroll.lastElementChild ? scroll.lastElementChild.className : null,
    };
  });
  const ti = (t) => gInfo.tokens.indexOf(t);
  ok(ti('H:Communion Antiphon') >= 0 && ti('SEAT-BEFORE') > ti('H:Communion Antiphon')
    && ti('SEAT-AFTER') > ti('SEAT-BEFORE') && ti('H:Prayer after Communion') > ti('SEAT-AFTER')
    && gInfo.beforeLabel === 'Private Pre-Communion Prayer' && gInfo.afterLabel === 'Private Post-Communion Prayer',
    'G1: the Communion order — Antiphon · the Pre-Communion list · the Post-Communion list · Prayer after Communion, the lists headed by their exact labels; no private list stands before the antiphon',
    JSON.stringify(gInfo.tokens));
  const tail = gInfo.marks.slice(-5);
  ok(JSON.stringify(tail) === JSON.stringify(['SEC:Concluding Rites', 'SEC:Post-Mass Prayers', '#mass-personal-aftermass', '#mass-acks', '.mass-notice'])
    && gInfo.marks[0].startsWith('SEC:Pre-Mass Prayers') && gInfo.notices === 1 && gInfo.lastCls === 'mass-notice',
    'G2: the scroll opens on the Pre-Mass Prayers section and ends Concluding Rites · Post-Mass Prayers · the list · the acks · the ICEL notice once, last',
    JSON.stringify(gInfo.marks));

  /* (d) the after-Communion carry, first sight */
  const afterHeads0 = await panelHeads(page, 'mass-personal-after');
  const d0 = await page.evaluate(() => {
    const pn = document.querySelector('#mass-personal-after .mass-panel');
    return pn ? Array.from(pn.querySelectorAll('.mass-line')).map((l) => l.textContent).join('\n') : null;
  });
  ok(JSON.stringify(afterHeads0) === JSON.stringify([bookRow('prayer-after-communion').p.title])
    && words(d0) === words(bookRow('prayer-after-communion').p.body),
    'D1: the standing after-Communion pick stands in the after list as its card, word-equal to its book row — the v501 pick carried whole',
    JSON.stringify(afterHeads0));

  /* (c) the before-Communion list system */
  const c0 = await page.evaluate(() => ({
    label: (document.querySelector('#mass-personal-before .mass-h') || {}).textContent || null,
    btn: (document.getElementById('mass-personal-before-btn') || {}).textContent || null,
    panels: document.querySelectorAll('#mass-personal-before .mass-panel').length,
  }));
  ok(c0.label === 'Private Pre-Communion Prayer' && c0.btn === 'Add a Private Pre-Communion Prayer' && c0.panels === 0,
    'C1: the before list starts empty under its label, its derived add button standing', JSON.stringify(c0));
  await page.click('#mass-personal-before-btn');
  await page.waitForSelector('.mpsheet', { timeout: 10000 }).catch(() => console.log('note - before sheet slow'));
  await sleep(500);
  await page.fill('#mp-search', 'anima');
  await sleep(400);
  await page.click('.mpsheet [data-mppick="anima-christi"]');
  await sleep(800);
  const stC = await store(page);
  const beforeHeads1 = await panelHeads(page, 'mass-personal-before');
  ok(stC && JSON.stringify(stC.before) === JSON.stringify(['anima-christi'])
    && JSON.stringify(beforeHeads1) === JSON.stringify([bookRow('anima-christi').p.title]),
    'C2: a popup pick appends the prayer to the before list in the paint and in the store', JSON.stringify(stC && stC.before));
  await page.click('#mass-personal-before-btn');
  await page.waitForSelector('.mpsheet', { timeout: 10000 }).catch(() => console.log('note - before sheet 2 slow'));
  await sleep(500);
  const cDup = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.mpsheet .bookrow'));
    const anima = rows.find((r) => r.textContent.includes('Anima Christi'));
    return { animaPickable: anima ? anima.hasAttribute('data-mppick') : null, animaText: anima ? anima.textContent.replace(/\s+/g, ' ').trim() : null };
  });
  ok(cDup.animaPickable === false && cDup.animaText !== null && cDup.animaText.includes('Standing \u2014 Private Pre-Communion Prayer'),
    'C3: in the popup the standing prayer carries the seat\'s standing mark and no pick act — the duplicate guard', JSON.stringify(cDup));
  await page.click('.mpsheet', { position: { x: 4, y: 4 } }); // the scrim tap — the app's own dismiss
  await sleep(400);
  const sheetGone = await page.evaluate(() => !document.querySelector('.mpsheet'));
  ok(sheetGone, 'C3b: a tap on the sheet\'s scrim dismisses the popup (the standing close path)');
  await page.click('#mass-personal-before [data-mpremove="0"]');
  await sleep(800);
  const stC2 = await store(page);
  const beforePanels2 = await page.evaluate(() => document.querySelectorAll('#mass-personal-before .mass-panel').length);
  const sheetAfterRemove = await page.evaluate(() => !!document.querySelector('.mpsheet'));
  ok(stC2 && JSON.stringify(stC2.before) === JSON.stringify([]) && beforePanels2 === 0 && !sheetAfterRemove,
    'C4: one tap on the card\'s Remove drops the prayer from the paint and the store at once, no intermediate step',
    JSON.stringify(stC2 && stC2.before));

  /* (d) the after-Communion list system: add · re-order · remove */
  await page.click('#mass-personal-after-btn');
  await page.waitForSelector('.mpsheet', { timeout: 10000 }).catch(() => console.log('note - after sheet slow'));
  await sleep(500);
  await page.fill('#mp-search', 'memorare');
  await sleep(400);
  await page.click('.mpsheet [data-mppick="memorare"]');
  await sleep(800);
  const stD = await store(page);
  ok(stD && JSON.stringify(stD.after) === JSON.stringify(['prayer-after-communion', 'memorare']),
    'D2: a popup pick appends after the standing pick in the after list', JSON.stringify(stD && stD.after));
  await page.click('#mass-personal-after [data-mpup="1"]');
  await sleep(800);
  const stD2 = await store(page);
  const afterHeads2 = await panelHeads(page, 'mass-personal-after');
  ok(stD2 && JSON.stringify(stD2.after) === JSON.stringify(['memorare', 'prayer-after-communion'])
    && JSON.stringify(afterHeads2) === JSON.stringify([bookRow('memorare').p.title, bookRow('prayer-after-communion').p.title]),
    'D3: the second card\'s up-move swaps the pair in the paint and in the store at once', JSON.stringify(stD2 && stD2.after));
  await page.click('#mass-personal-after [data-mpremove="0"]');
  await sleep(800);
  const stD3 = await store(page);
  ok(stD3 && JSON.stringify(stD3.after) === JSON.stringify(['prayer-after-communion']),
    'D4: one-tap Remove restores the after list to the standing pick alone', JSON.stringify(stD3 && stD3.after));

  /* (f) the Post-Mass section on the system */
  const amHeads = await panelHeads(page, 'mass-personal-aftermass');
  await page.click('#mass-personal-aftermass [data-mpremove="0"]');
  await sleep(800);
  const stF = await store(page);
  const amHeads2 = await panelHeads(page, 'mass-personal-aftermass');
  ok(JSON.stringify(amHeads) === JSON.stringify(SET.map((s) => bookRow(s).p.title))
    && stF && JSON.stringify(stF.afterMass) === JSON.stringify(SET.slice(1)) && amHeads2.length === 6,
    'F1: the Post-Mass list stands as v505 shipped it (the seven set prayers in order) and its one-tap Remove writes the list whole',
    JSON.stringify(stF && stF.afterMass));

  /* (e) the Pre-Mass list system: remove · re-order · persistence + the collapse across a fresh load */
  await page.click('#mass-personal-premass [data-mpremove="3"]');
  await sleep(800);
  const stE = await store(page);
  ok(stE && JSON.stringify(stE.preMass) === JSON.stringify(SEED_PM.slice(0, 3)),
    'E1: one tap on the crucifix card\'s Remove drops it from the Pre-Mass paint and store', JSON.stringify(stE && stE.preMass));
  await page.click('#mass-personal-premass [data-mpdown="0"]');
  await sleep(800);
  const expectPM = ['prayer-of-st-thomas-aquinas-before-mass', 'prayer-of-st-ambrose-before-mass', 'prayer-before-mass'];
  const stE2 = await store(page);
  ok(stE2 && JSON.stringify(stE2.preMass) === JSON.stringify(expectPM),
    'E2: the first card\'s down-move swaps it with the next prayer in the stored Pre-Mass list', JSON.stringify(stE2 && stE2.preMass));
  await page.reload();
  await page.waitForSelector('[data-openblock]', { timeout: 25000 }).catch(() => console.log('note - reload openblock slow'));
  await sleep(400);
  await page.click('#tabbar .tab[data-tab="mass"]');
  await page.waitForSelector('#mass-personal-premass .mass-panel', { state: 'attached', timeout: 15000 }).catch(() => console.log('note - reload premass slow'));
  await sleep(600);
  const a3 = await pmState(page);
  ok(a3.hidden === true && a3.display === 'none',
    'A3: after a fresh load the Pre-Mass section stands COLLAPSED again — the default holds on every view', JSON.stringify(a3));
  await page.click('#mass-premass-head');
  await sleep(400);
  const pmHeads3 = await panelHeads(page, 'mass-personal-premass');
  ok(JSON.stringify(pmHeads3) === JSON.stringify(expectPM.map((s) => bookRow(s).p.title)),
    'E3: expanded after the fresh load, the moved Pre-Mass order stands — the stored order governs', JSON.stringify(pmHeads3));
  await page.click('#mass-premass-head');
  await sleep(300);
  const a4 = await pmState(page);
  ok(a4.hidden === true && a4.display === 'none',
    'A4: tapping the title again shuts the section in place', JSON.stringify(a4));
  ok(errs.length === 0, 'L1: Chromium boot + the whole flow clean (no page errors)', errs.join(' ; '));
  await ctx.close();
}

/* ---------------- (i) the personal GET failing ---------------- */
{
  const errs = [];
  const f1 = await boot('/v506', errs, 'failget', () => { window.__mpFailGet = true; });
  const failInfo = await f1.page.evaluate(() => ({
    scroll: !!document.querySelector('.mass-scroll'),
    premassHead: !!document.getElementById('mass-premass-head'),
    premassHidden: document.getElementById('mass-personal-premass') ? document.getElementById('mass-personal-premass').classList.contains('mass-personal-hidden') : null,
    section: Array.from(document.querySelectorAll('.mass-section')).some((s) => s.textContent === 'Post-Mass Prayers'),
    btnP: (document.getElementById('mass-personal-premass-btn') || {}).textContent || null,
    btnB: (document.getElementById('mass-personal-before-btn') || {}).textContent || null,
    btnA: (document.getElementById('mass-personal-after-btn') || {}).textContent || null,
    btnM: (document.getElementById('mass-personal-aftermass-btn') || {}).textContent || null,
    notice: document.querySelectorAll('.mass-notice').length,
  }));
  ok(failInfo.scroll && failInfo.premassHead && failInfo.premassHidden === true && failInfo.section
    && failInfo.btnP === 'Add a prayer before Mass' && failInfo.btnB === 'Add a Private Pre-Communion Prayer'
    && failInfo.btnA === 'Add a Private Post-Communion Prayer' && failInfo.btnM === 'Add a prayer after Mass' && failInfo.notice === 1,
    'I1: the personal GET failing leaves the scroll whole — the Pre-Mass title stands with its section shut, all four sections keep their add buttons, the single notice stands last',
    JSON.stringify(failInfo));
  ok(errs.length === 0, 'L2: the failure boot runs clean (no page errors)', errs.join(' ; '));
  await f1.ctx.close();
}

/* ---------------- (k) byte-identity vs the v505 ship ---------------- */
{
  const errs = [];
  const a = await boot('/v506', errs, 'k506', SEED_INIT);
  const b = await boot('/base', errs, 'kBase', SEED_INIT);
  await a.page.waitForSelector('#mass-personal-aftermass .mass-panel', { timeout: 15000 }).catch(() => console.log('note - k506 panels slow'));
  await sleep(600);
  const stripScroll = () => {
    const s = document.querySelector('.mass-scroll');
    if (!s) return null;
    const c = s.cloneNode(true);
    ['mass-premass-head', 'mass-personal-premass', 'mass-personal-before', 'mass-personal-after'].forEach((id) => { const d = c.querySelector('#' + id); if (d) d.remove(); });
    return c.outerHTML;
  };
  const hNew = await a.page.evaluate(stripScroll);
  const hBase = await b.page.evaluate(stripScroll);
  ok(hNew && hBase && hNew === hBase,
    'K1: the Mass scroll renders byte-identical to the v505 ship outside (i) the Pre-Mass block (title + host) and (ii) the two Communion seat hosts (converted to lists, removed whole for the compare)');
  ok(errs.length === 0, 'L3: the byte-identity boots run clean (no page errors)', errs.join(' ; '));
  await a.ctx.close(); await b.ctx.close();
}

await browser.close();
server.close();
if (!PROBE) {
  console.log('harness-v506:', pass + ' ok / ' + fail + ' not-ok');
  if (failures.length) console.log('failures:', failures.join(' | '));
  process.exit(fail ? 1 : 0);
}
