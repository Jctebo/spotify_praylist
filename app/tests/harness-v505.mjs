// harness-v505.mjs — v505 evidence: the Mass scroll tail
// restructured (John, 2026-11-17 14:43 + 14:44 CT):
//   (1) the before/after-Communion single seats take the
//       Post-Mass panel dress (.mass-panel card)
//   (2) a "Post-Mass Prayers" big section stands directly
//       after the Concluding Rites, carrying the after-Mass
//       seat as ONE ordered list in one column — the list's
//       initial state is migration 0034's merged seed (the
//       traditional post-Mass set + the standing picks,
//       folded)
//   (3) one-tap Remove on each prayer + re-order by the
//       v413 move buttons; every change writes the stored
//       list at once; the Add popup + duplicate guard stand
//   (4) the copyright material stands beneath the prayers:
//       no notice at the top (the day header opens the
//       scroll), the readings' lines, then the ICEL notice
//       once, as the scroll's last element
//   S statics: index.ts + the Mass sources byte-identical
//     to the v504 ship · the tail order + panel wrap + the
//     list paint in client.ts · ui.ts differs only in the
//     .mass-panels / .mass-panel rules (pin excepted) ·
//     migration 0034's merge shape · the book fixture
//   M the migration proof: python3's sqlite3 applies the
//     real 0032, a seeded v495 row, the real 0033, the
//     production picks, then the real 0034 — afterMass
//     reads the named set in order, after keeps its pick;
//     an outside-set pick appends after the set; the empty
//     and missing-row cases read the set
//   (a) the single seats' panel dress, buttons, switches
//   (b) the tail order + the single final notice
//   (c) the seeded list paints the seven set prayers in
//       order, word-equal to the book, controls standing
//   (d) one-tap remove: paint + store, no sheet between
//   (e) re-order: move buttons swap paint + store; the
//       moved order stands after a fresh load
//   (f) add + the duplicate guard in the popup
//   (g) per-panel Latin + the v488 stepper on the cards
//   (h) the personal GET failing leaves the scroll whole
//   (k) byte-identity vs the v504 ship outside the top
//       notice, the two seat divs, and the tail from the
//       Concluding Rites title onward
//   (l) cooked parse + Chromium boot clean (the v439 gate)
// Fixtures (Improvement D): the book is the LIVE payload
// captured through the prayer door on 2026-11-17
// (tests/fixtures/book-live-2026-11-17.json — 9 groups,
// 75 prayers; the picks are its real rows). The Mass day +
// readings fixtures are the harness-v494 set (production
// payload shapes). The store stub mirrors the standing
// session PUT route (unchanged by v505): GET answers the
// three seats; PUT validates seat + slugs against the
// book, refuses a duplicate, and answers the re-read. The
// main flow's store is seeded as migration 0034 leaves
// production: before anima-christi (a dress probe), after
// prayer-after-communion (the standing production pick),
// afterMass the merged set. Run: node
// app/tests/harness-v505.mjs [--probe] (from the worktree
// root). --probe only prints.
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
const MIG32 = readFileSync(APP + '/migrations/0032_mass_personal_prayer.sql', 'utf8');
const MIG33 = readFileSync(APP + '/migrations/0033_mass_personal_prayer_seats.sql', 'utf8');
const MIG34 = readFileSync(APP + '/migrations/0034_post_mass_list_seed.sql', 'utf8');
const BASE = path.resolve(process.cwd(), '../../.worktrees/v504-ship/app/worker/src');
const C_BASE = readFileSync(BASE + '/client.ts', 'utf8');
const I_BASE = readFileSync(BASE + '/index.ts', 'utf8');
const U_BASE = readFileSync(BASE + '/ui.ts', 'utf8');
const BOOK = JSON.parse(readFileSync(APP + '/tests/fixtures/book-live-2026-11-17.json', 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SET = ['anima-christi', 'act-of-faith', 'act-of-hope', 'act-of-charity', 'hail-mary', 'hail-holy-queen', 'st-michael'];
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
  ok(I_SRC === I_BASE, 'S1: index.ts stands byte-identical to the v504 ship (routes and store shape untouched)');
  for (const f of ['mass.ts', 'mass-order.ts', 'mass-readings.ts']) {
    ok(readFileSync(SRC + '/' + f, 'utf8') === readFileSync(BASE + '/' + f, 'utf8'),
      'S2-' + f + ': the Mass source stands byte-identical to the v504 ship');
  }
  const paint = C_SRC.slice(C_SRC.indexOf('function paintMassScroll()'), C_SRC.indexOf('view.innerHTML = h', C_SRC.indexOf('function paintMassScroll()')));
  const iCR = paint.indexOf("massSectionHtml('Concluding Rites')");
  const iPM = paint.indexOf("massSectionHtml('Post-Mass Prayers')", iCR);
  const iAM = paint.indexOf('id="mass-personal-aftermass"', iPM);
  const iAck = paint.indexOf('id="mass-acks"', iAM);
  const iNot = paint.indexOf('class="mass-notice"', iAck);
  ok(iCR > 0 && iPM > iCR && iAM > iPM && iAck > iAM && iNot > iAck
    && paint.split('mass-notice').length - 1 === 1,
    'S3: paintMassScroll tail order — Concluding Rites · Post-Mass Prayers · the after-Mass list · the acks · ONE notice line in the whole paint (the final element)');
  const head = paint.slice(0, paint.indexOf('mass-day'));
  ok(!head.includes('mass-notice') && head.includes('mass-scroll'),
    'S4: no notice stands at the head of the scroll — it opens on the day header');
  ok(C_SRC.includes("return '<div class=\"mass-panel\">' + body + '</div>' + btn;")
    && C_SRC.includes('function massPostMassHtml(')
    && C_SRC.includes('function massPersonalMovePanel(')
    && C_SRC.includes('data-mpup') && C_SRC.includes('data-mpdown') && C_SRC.includes('setcontrols')
    && !C_SRC.includes('massPersonalAfterMassHtml'),
    'S5: client.ts carries the single seats\' panel wrap, massPostMassHtml with the v413 move controls, massPersonalMovePanel; the row paint is gone');
  const pin = (s) => s.replace(/ora-pro-nobis-v\d+-\d+/g, 'PIN');
  const stripPanels = (s) => s.split('\n').filter((l) => !l.startsWith('.mass-panels') && !l.startsWith('.mass-panel ')).join('\n');
  ok(pin(stripPanels(U_SRC)) === pin(stripPanels(U_BASE)),
    'S6: ui.ts is byte-identical to the v504 ship outside the pin line and the .mass-panels / .mass-panel rules');
  ok(U_SRC.includes('.mass-panels { display: flex; flex-direction: column;')
    && U_SRC.includes('.mass-panel { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }'),
    'S7: the .mass-panels stack stands in one column; the .mass-panel card dress stands without the row sizing');
  ok(SET.every((s) => MIG34.includes('"' + s + '"')) && MIG34.includes('1000 + key')
    && MIG34.includes('GROUP BY slug') && MIG34.includes('WHERE NOT EXISTS')
    && MIG34.includes("seat = 'aftermass'") && !MIG34.includes('CREATE TABLE') && !MIG34.includes('ALTER TABLE'),
    'S8: migration 0034 carries the merge (the seven set slugs · the 1000+ ordinals · the fold · the missing-row insert) and no schema change');
  ok(BOOK_COUNT === 75 && BOOK.groups.length === 9 && SET.every((s) => !!bookRow(s)),
    'S9: the live-book fixture stands (9 groups, 75 prayers) and every set slug is a book row', 'count ' + BOOK_COUNT);
}

/* ---------------- M: the migration proof ---------------- */
{
  const py = [
    'import sqlite3, sys, json',
    'mig32 = open(sys.argv[1]).read()',
    'mig33 = open(sys.argv[2]).read()',
    'mig34 = open(sys.argv[3]).read()',
    'SET = ' + JSON.stringify(SET),
    'def build(seed32, aftermass):',
    '    db = sqlite3.connect(":memory:")',
    '    db.executescript(mig32)',
    '    if seed32: db.execute(seed32)',
    '    db.executescript(mig33)',
    '    if aftermass is not None:',
    '        db.execute("UPDATE mass_personal_prayer SET slugs = ? WHERE seat = \'aftermass\'", [aftermass])',
    '    db.executescript(mig34)',
    '    rows = db.execute("SELECT seat, slugs FROM mass_personal_prayer ORDER BY seat").fetchall()',
    '    return {r[0]: json.loads(r[1]) for r in rows}',
    'a = build("INSERT INTO mass_personal_prayer (id, slug, updated_at) VALUES (1, \'prayer-after-communion\', \'2026-11-17T00:00:00.000Z\')", \'["st-michael","act-of-faith","act-of-charity"]\')',
    'assert a["aftermass"] == SET, a',
    'assert a["after"] == ["prayer-after-communion"], a',
    'assert a["before"] == [], a',
    'b = build(None, \'["eternal-rest","st-michael"]\')',
    'assert b["aftermass"] == SET + ["eternal-rest"], b',
    'c = build(None, \'[]\')',
    'assert c["aftermass"] == SET, c',
    'db = sqlite3.connect(":memory:")',
    'db.executescript(mig32); db.executescript(mig33)',
    'db.execute("DELETE FROM mass_personal_prayer WHERE seat = \'aftermass\'")',
    'db.executescript(mig34)',
    'd = {r[0]: json.loads(r[1]) for r in db.execute("SELECT seat, slugs FROM mass_personal_prayer").fetchall()}',
    'assert d["aftermass"] == SET, d',
    'print("MIGRATION_OK")',
  ].join('\n');
  const tmp = path.join(os.tmpdir(), 'harness-v505-mig.py');
  writeFileSync(tmp, py);
  const f = (n, c) => { const p = path.join(os.tmpdir(), n); writeFileSync(p, c); return p; };
  let migOut = '';
  try { migOut = execFileSync('python3', [tmp, f('harness-v505-0032.sql', MIG32), f('harness-v505-0033.sql', MIG33), f('harness-v505-0034.sql', MIG34)], { encoding: 'utf8' }); }
  catch (e) { migOut = 'ERR ' + String(e.stdout || e.message).slice(0, 200); }
  ok(migOut.includes('MIGRATION_OK'),
    'M1: the real 0032 + the production v495 row + the real 0033 + the production picks + the real 0034 — afterMass reads the named set in order, the after pick preserved; an outside-set pick appends; empty and missing-row read the set',
    migOut.trim().slice(0, 160));
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
    const readStore = function () {
      try { return JSON.parse(localStorage.getItem('mp-store-v505') || 'null') || { before: null, after: null, afterMass: [] }; }
      catch (e) { return { before: null, after: null, afterMass: [] }; }
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
      if (seat !== 'before' && seat !== 'after' && seat !== 'aftermass') return ans(400, { error: 'seat must be before, after, or aftermass' });
      const store = readStore();
      if (seat === 'aftermass') {
        if (!Array.isArray(body.slugs)) return ans(400, { error: 'slugs must be an array' });
        const seen = [];
        for (const s of body.slugs) {
          if (seen.indexOf(s) >= 0) return ans(400, { error: 'duplicate slug ' + s });
          if (!bookHas(s)) return ans(400, { error: 'bad slug ' + s });
          seen.push(s);
        }
        store.afterMass = body.slugs.slice();
      } else {
        const slug = body.slug == null ? null : String(body.slug);
        if (slug !== null && !bookHas(slug)) return ans(400, { error: 'bad slug ' + slug });
        store[seat] = slug;
      }
      try { localStorage.setItem('mp-store-v505', JSON.stringify(store)); } catch (e) {}
      return ans(200, { ok: true, before: store.before, after: store.after, afterMass: store.afterMass });
    }
    if (window.__mpFailGet) return ans(500, { error: 'boom' });
    const cur = readStore();
    return ans(200, { ok: true, before: cur.before, after: cur.after, afterMass: cur.afterMass });
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
  if (u === '/v505') { res.setHeader('Content-Type', 'text/html'); res.end(PAGE); return; }
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

const SEED = { before: 'anima-christi', after: 'prayer-after-communion', afterMass: SET.slice() };
const SEED_INIT = () => {
  if (!localStorage.getItem('mp-seeded-v505')) {
    localStorage.setItem('mp-store-v505', JSON.stringify({ before: 'anima-christi', after: 'prayer-after-communion', afterMass: ['anima-christi', 'act-of-faith', 'act-of-hope', 'act-of-charity', 'hail-mary', 'hail-holy-queen', 'st-michael'] }));
    localStorage.setItem('mp-seeded-v505', '1');
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
  try { return JSON.parse(localStorage.getItem('mp-store-v505') || 'null'); } catch (e) { return null; }
});
const panelHeads = (page) => page.evaluate(() =>
  Array.from(document.querySelectorAll('#mass-personal-aftermass .mass-panel')).map((pn) => (pn.querySelector('.mass-h') || {}).textContent || null));

/* ---------------- the main flow ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot('/v505', errs, 'main', SEED_INIT);
  await page.waitForSelector('#mass-personal-aftermass .mass-panel', { timeout: 15000 }).catch(() => console.log('note - main panels slow'));
  await sleep(500);

  /* (a) the single seats' panel dress */
  const aInfo = await page.evaluate(() => {
    const seatInfo = (id) => {
      const host = document.getElementById(id);
      const panel = host.querySelector('.mass-panel');
      return {
        panel: !!panel,
        panelInSeat: panel ? panel.parentElement === host : false,
        head: panel ? (panel.querySelector('.mass-h') || {}).textContent || null : null,
        lines: panel ? Array.from(panel.querySelectorAll('.mass-line')).map((l) => l.textContent).join('\n') : null,
        lang: panel ? !!panel.querySelector('.langswitch') : false,
        btn: (host.querySelector('button[id$="-btn"]') || {}).textContent || null,
      };
    };
    return { before: seatInfo('mass-personal-before'), after: seatInfo('mass-personal-after') };
  });
  const ANIMA = bookRow('anima-christi'), PAC = bookRow('prayer-after-communion');
  ok(aInfo.before.panel && aInfo.before.panelInSeat && aInfo.before.head === ANIMA.p.title
    && words(aInfo.before.lines) === words(ANIMA.p.body) && aInfo.before.lang && aInfo.before.btn === 'Change prayer',
    'A1: the before seat\'s prayer stands inside a .mass-panel card in the seat (title · Latin switch · body word-equal to the book row), its Change button below the card',
    JSON.stringify(aInfo.before));
  ok(aInfo.after.panel && aInfo.after.panelInSeat && aInfo.after.head === PAC.p.title
    && words(aInfo.after.lines) === words(PAC.p.body) && aInfo.after.btn === 'Change prayer',
    'A2: the after seat\'s mirror — the standing pick (Prayer After Communion) stands in the panel dress at its seat',
    JSON.stringify(aInfo.after));

  /* (b) the tail order + the single final notice */
  const bInfo = await page.evaluate(() => {
    const scroll = document.querySelector('.mass-scroll');
    const marks = [];
    scroll.querySelectorAll('.mass-section, #mass-personal-aftermass, #mass-acks, .mass-notice').forEach((el) => {
      marks.push(el.classList.contains('mass-section') ? 'SEC:' + el.textContent : (el.id ? '#' + el.id : '.mass-notice'));
    });
    return {
      marks,
      firstCls: scroll.firstElementChild ? scroll.firstElementChild.className : null,
      lastCls: scroll.lastElementChild ? scroll.lastElementChild.className : null,
      notices: scroll.querySelectorAll('.mass-notice').length,
      noticeText: (scroll.querySelector('.mass-notice') || {}).textContent || null,
    };
  });
  const tail = bInfo.marks.slice(-5);
  ok(JSON.stringify(tail) === JSON.stringify(['SEC:Concluding Rites', 'SEC:Post-Mass Prayers', '#mass-personal-aftermass', '#mass-acks', '.mass-notice'])
    && bInfo.firstCls === 'mass-day' && bInfo.lastCls === 'mass-notice' && bInfo.notices === 1 && bInfo.noticeText === ICEL,
    'B1: the scroll ends Concluding Rites · Post-Mass Prayers · the list · the acks · the ICEL notice ONCE as the last element; the day header opens the scroll; the notice text is v504\'s, byte-identical',
    JSON.stringify(bInfo));

  /* (c) the seeded list */
  const heads0 = await panelHeads(page);
  const cInfo = await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll('#mass-personal-aftermass .mass-panel'));
    return {
      firstLines: panels.length ? Array.from(panels[0].querySelectorAll('.mass-line')).map((l) => l.textContent).join('\n') : null,
      controls: panels.map((pn) => ({
        rm: !!pn.querySelector('[data-mpremove]'),
        up: !!pn.querySelector('[data-mpup]'), down: !!pn.querySelector('[data-mpdown]'),
        upDis: pn.querySelector('[data-mpup]') ? pn.querySelector('[data-mpup]').disabled : null,
        downDis: pn.querySelector('[data-mpdown]') ? pn.querySelector('[data-mpdown]').disabled : null,
      })),
      oneCol: panels.length > 1 ? Math.abs(panels[1].offsetLeft - panels[0].offsetLeft) < 2 && panels[1].offsetTop > panels[0].offsetTop : false,
    };
  });
  ok(JSON.stringify(heads0) === JSON.stringify(SET.map((s) => bookRow(s).p.title)) && words(cInfo.firstLines) === words(ANIMA.p.body),
    'C1: the section paints the seven set prayers in the set order, the first panel\'s text word-stream-equal to its book row',
    JSON.stringify(heads0));
  ok(cInfo.controls.length === 7 && cInfo.controls.every((c) => c.rm && c.up && c.down)
    && cInfo.controls[0].upDis === true && cInfo.controls[0].downDis === false
    && cInfo.controls[6].downDis === true && cInfo.controls[6].upDis === false && cInfo.oneCol,
    'C2: every panel carries Remove + the move buttons (the ends disabled at the list\'s ends), stacked in one column',
    JSON.stringify(cInfo.controls));

  /* (d) one-tap remove */
  await page.click('#mass-personal-aftermass [data-mpremove="1"]');
  await sleep(800);
  const st1 = await store(page);
  const heads1 = await panelHeads(page);
  ok(st1 && JSON.stringify(st1.afterMass) === JSON.stringify(SET.filter((s) => s !== 'act-of-faith'))
    && heads1.length === 6 && heads1[1] === bookRow('act-of-hope').p.title,
    'D1: one tap on a panel\'s Remove drops the prayer (Act of Faith) from the paint and from the stored list at once, the order otherwise standing',
    JSON.stringify(st1 && st1.afterMass));
  const sheetAfterRemove = await page.evaluate(() => !!document.querySelector('.mpsheet'));
  ok(!sheetAfterRemove, 'D2: the removal took no intermediate step — no popup or sheet stands after the tap');

  /* (e) re-order */
  await page.click('#mass-personal-aftermass [data-mpdown="0"]');
  await sleep(800);
  const expectE = ['act-of-hope', 'anima-christi', 'act-of-charity', 'hail-mary', 'hail-holy-queen', 'st-michael'];
  const st2 = await store(page);
  const heads2 = await panelHeads(page);
  ok(st2 && JSON.stringify(st2.afterMass) === JSON.stringify(expectE)
    && JSON.stringify(heads2) === JSON.stringify(expectE.map((s) => bookRow(s).p.title)),
    'E1: the first panel\'s down-move swaps it with the next prayer in the paint and in the stored list at once',
    JSON.stringify(st2 && st2.afterMass));
  await page.reload();
  await page.waitForSelector('[data-openblock]', { timeout: 25000 }).catch(() => console.log('note - reload openblock slow'));
  await sleep(400);
  await page.click('#tabbar .tab[data-tab="mass"]');
  await page.waitForSelector('#mass-personal-aftermass .mass-panel', { timeout: 15000 }).catch(() => console.log('note - reload panels slow'));
  await sleep(600);
  const heads3 = await panelHeads(page);
  ok(JSON.stringify(heads3) === JSON.stringify(expectE.map((s) => bookRow(s).p.title)),
    'E2: after a fresh load the moved order stands — the stored order governs', JSON.stringify(heads3));

  /* (f) add + the duplicate guard */
  await page.click('#mass-personal-aftermass-btn');
  await page.waitForSelector('.mpsheet', { timeout: 10000 }).catch(() => console.log('note - sheet slow'));
  await sleep(600);
  const fInfo = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.mpsheet .bookrow'));
    const standing = rows.filter((r) => !r.hasAttribute('data-mppick'));
    return {
      pickable: document.querySelectorAll('.mpsheet [data-mppick]').length,
      standingMarks: standing.map((r) => r.textContent.replace(/\s+/g, ' ').trim()),
    };
  });
  ok(fInfo.pickable === BOOK_COUNT - 6 && fInfo.standingMarks.length === 6
    && fInfo.standingMarks.every((t) => t.includes('Standing after Mass')),
    'F1: in the popup the six standing prayers carry the Standing after Mass mark and no pick act; the other rows stay pickable',
    JSON.stringify(fInfo));
  await page.fill('#mp-search', 'memorare');
  await sleep(400);
  await page.click('.mpsheet [data-mppick="memorare"]');
  await sleep(800);
  const st3 = await store(page);
  const heads4 = await panelHeads(page);
  ok(st3 && st3.afterMass.length === 7 && st3.afterMass[6] === 'memorare'
    && heads4.length === 7 && heads4[6] === bookRow('memorare').p.title,
    'F2: a new pick appends to the list\'s end in the paint and in the store', JSON.stringify(st3 && st3.afterMass));

  /* (g) per-panel Latin + the stepper on the cards */
  const hmIdx = heads4.indexOf(bookRow('hail-mary').p.title);
  await page.click('#mass-personal-aftermass .mass-panel:nth-child(' + (hmIdx + 1) + ') [data-mplang="la"]');
  await sleep(500);
  const gInfo = await page.evaluate((idx) => {
    const panels = Array.from(document.querySelectorAll('#mass-personal-aftermass .mass-panel'));
    return {
      hm: Array.from(panels[idx].querySelectorAll('.mass-line')).map((l) => l.textContent).join('\n'),
      first: Array.from(panels[0].querySelectorAll('.mass-line')).map((l) => l.textContent).join('\n'),
    };
  }, hmIdx);
  ok(words(gInfo.hm) === words(bookRow('hail-mary').p.bodyLatin) && words(gInfo.first) === words(bookRow('act-of-hope').p.body),
    'G1: a panel\'s Latin switch turns its own body to the book row\'s Latin only — the neighboring panel stands in English');
  const fs0 = await page.evaluate(() => {
    const a = document.querySelector('#mass-personal-aftermass .mass-panel .mass-line');
    const b = document.querySelector('#mass-personal-before .mass-panel .mass-line');
    return { a: a ? parseFloat(getComputedStyle(a).fontSize) : null, b: b ? parseFloat(getComputedStyle(b).fontSize) : null };
  });
  await page.click('.mass-controls [data-tsize="1"]'); await sleep(400);
  await page.click('.mass-controls [data-tsize="1"]'); await sleep(600);
  const fs3 = await page.evaluate(() => {
    const a = document.querySelector('#mass-personal-aftermass .mass-panel .mass-line');
    const b = document.querySelector('#mass-personal-before .mass-panel .mass-line');
    return { a: a ? parseFloat(getComputedStyle(a).fontSize) : null, b: b ? parseFloat(getComputedStyle(b).fontSize) : null };
  });
  ok(fs0.a && fs0.b && fs3.a > fs0.a && fs3.b > fs0.b,
    'G2: the v488 stepper scales the section panels\' texts and the Communion seat cards\' texts', JSON.stringify({ fs0, fs3 }));
  ok(errs.length === 0, 'L1: Chromium boot + the whole flow clean (no page errors)', errs.join(' ; '));
  await ctx.close();
}

/* ---------------- (h) per-seat failure ---------------- */
{
  const errs = [];
  const f1 = await boot('/v505', errs, 'failget', () => { window.__mpFailGet = true; });
  const failInfo = await f1.page.evaluate(() => ({
    scroll: !!document.querySelector('.mass-scroll'),
    section: Array.from(document.querySelectorAll('.mass-section')).some((s) => s.textContent === 'Post-Mass Prayers'),
    btnB: (document.getElementById('mass-personal-before-btn') || {}).textContent || null,
    btnA: (document.getElementById('mass-personal-after-btn') || {}).textContent || null,
    btnM: (document.getElementById('mass-personal-aftermass-btn') || {}).textContent || null,
    notice: document.querySelectorAll('.mass-notice').length,
  }));
  ok(failInfo.scroll && failInfo.section && failInfo.btnB === 'Add a prayer before Communion'
    && failInfo.btnA === 'Add a prayer after Communion' && failInfo.btnM === 'Add a prayer after Mass' && failInfo.notice === 1,
    'H1: the personal GET failing leaves the scroll whole — the Post-Mass Prayers title stands, all three seats keep their buttons, the single notice stands last',
    JSON.stringify(failInfo));
  ok(errs.length === 0, 'L2: the failure boot runs clean (no page errors)', errs.join(' ; '));
  await f1.ctx.close();
}

/* ---------------- (k) byte-identity vs the v504 ship ---------------- */
{
  const errs = [];
  const a = await boot('/v505', errs, 'k505', SEED_INIT);
  const b = await boot('/base', errs, 'kBase', SEED_INIT);
  await a.page.waitForSelector('#mass-personal-aftermass .mass-panel', { timeout: 15000 }).catch(() => console.log('note - k505 panels slow'));
  await b.page.waitForSelector('#mass-personal-aftermass .mass-panel', { timeout: 15000 }).catch(() => console.log('note - kBase panels slow'));
  await sleep(600);
  const stripScroll = () => {
    const s = document.querySelector('.mass-scroll');
    if (!s) return null;
    const c = s.cloneNode(true);
    ['mass-personal-before', 'mass-personal-after'].forEach((id) => { const d = c.querySelector('#' + id); if (d) d.innerHTML = ''; });
    c.querySelectorAll('.mass-notice').forEach((n) => n.remove());
    const kids = Array.from(c.children);
    const idx = kids.findIndex((k) => k.classList && k.classList.contains('mass-section') && k.textContent === 'Concluding Rites');
    if (idx >= 0) kids.slice(idx).forEach((k) => k.remove());
    return c.outerHTML;
  };
  const hNew = await a.page.evaluate(stripScroll);
  const hBase = await b.page.evaluate(stripScroll);
  ok(hNew && hBase && hNew === hBase,
    'K1: the Mass scroll renders byte-identical to the v504 ship outside the top notice, the two seat divs (their dress), and the tail from the Concluding Rites title onward');
  ok(errs.length === 0, 'L3: the byte-identity boots run clean (no page errors)', errs.join(' ; '));
  await a.ctx.close(); await b.ctx.close();
}

await browser.close();
server.close();
if (!PROBE) {
  console.log('harness-v505:', pass + ' ok / ' + fail + ' not-ok');
  if (failures.length) console.log('failures:', failures.join(' | '));
  process.exit(fail ? 1 : 0);
}
