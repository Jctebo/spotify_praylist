// harness-v501.mjs — v501 evidence: personal prayers at
// THREE seats in the Mass scroll (John, 2026-11-17
// 08:59–09:01 CT): a single-prayer seat before the
// Communion Antiphon, the v495 seat after it (renamed
// button, standing pick preserved through migration
// 0033), and a multiple-prayer seat after Mass whose
// panels stand side by side in one sideways-scrolling
// row.
//   S statics: migration 0033's shape · the three-seat
//     routes + validation in index.ts · the three seat
//     divs' source places in client.ts · ui.ts identical
//     to the base ship outside the pin line and the
//     .mass-panels block · the Mass sources untouched
//   M the migration proof: python3's sqlite3 applies the
//     real 0032, a seeded row carrying a real book slug,
//     then the real 0033 — 'after' reads [that slug],
//     'before' and 'aftermass' read []; the null-slug
//     and no-row cases read empty; the production pick
//     (prayer-after-communion, read through the door at
//     build) carries the same way
//   (a) seat order: before div immediately before the
//     Communion Antiphon, after div immediately after
//     it and before the Prayer after Communion, the
//     aftermass div the last element of .mass-scroll
//   (b) the three unset buttons read exactly 'Add a
//     prayer before Communion' · 'Add a prayer after
//     Communion' · 'Add a prayer after Mass'; the popup
//     carries search + the full library
//   (c) a Latin-carrying pick at the before seat renders
//     title + text + the Latin switch at that seat only
//     and saves under 'before'; the mirror at the after
//     seat; the other seats untouched throughout
//   (d) Change and Remove act per single seat
//   (e) aftermass: three picks stand side by side in ONE
//     row in add order, each panel word-stream-equal to
//     its book row; at a narrow viewport the row scrolls
//     sideways inside its line while the page does not;
//     a Latin panel's switch turns its own body only
//   (f) a per-panel Remove leaves the other panels
//     standing in order
//   (g) a standing prayer is marked in the aftermass
//     popup ('Standing after Mass', no pick act) and
//     cannot be picked again — the list stands unchanged
//   (h) persistence: a fresh load shows all three seats
//     as saved (the store is date-independent — the
//     seats load fresh on every day's first paint, so
//     the reload stands in for the next day)
//   (i) per-seat failure: the personal GET failing
//     leaves the scroll whole with all three buttons
//     standing; a saved slug missing from the book
//     paints that seat's button only
//   (j) the v488 stepper scales the single-seat and
//     panel texts
//   (k) the rest of the Mass scroll byte-identical to
//     the v500 ship's render of the same fixture day,
//     the seat divs excepted
//   (l) cooked parse + Chromium boot clean (the v439
//     gate)
// Fixtures (Improvement D): the book is the LIVE payload
// captured through the prayer door on 2026-11-17
// (tests/fixtures/book-live-2026-11-17.json — 9 groups,
// 75 prayers; the picks are its real rows: Anima Christi
// and Sub Tuum Praesidium — body + bodyLatin — and Act
// of Contrition — body, no Latin). The Mass day +
// readings fixtures are the harness-v494 set (production
// payload shapes). The save route is stood against a
// localStorage-backed store in the fetch stub — the
// route's shape (GET answers the three seats; PUT
// validates seat + slugs against the book, refuses a
// duplicate, and answers the re-read) mirrors the
// shipped route; the store's persistence across a
// reload stands in for the server's. Run: node
// app/tests/harness-v501.mjs [--probe] (from the
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
const MIG32 = readFileSync(APP + '/migrations/0032_mass_personal_prayer.sql', 'utf8');
const MIG33 = readFileSync(APP + '/migrations/0033_mass_personal_prayer_seats.sql', 'utf8');
const BASE = path.resolve(process.cwd(), '../../.worktrees/v500-ship/app/worker/src');
const C_BASE = readFileSync(BASE + '/client.ts', 'utf8');
const U_BASE = readFileSync(BASE + '/ui.ts', 'utf8');
const BOOK = JSON.parse(readFileSync(APP + '/tests/fixtures/book-live-2026-11-17.json', 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
const CONTRITION = bookRow('act-of-contrition');
const ANIMA = bookRow('anima-christi');
const SUBTUUM = bookRow('sub-tuum-praesidium');
const PAC = bookRow('prayer-after-communion');

/* ---------------- S: statics ---------------- */
{
  ok(MIG33.includes('CREATE TABLE mass_personal_prayer_seats')
    && MIG33.includes("CHECK (seat IN ('before','after','aftermass'))")
    && MIG33.includes('json_array(slug)')
    && MIG33.includes('DROP TABLE mass_personal_prayer')
    && MIG33.includes('RENAME TO mass_personal_prayer'),
    'S1: migration 0033 rebuilds the table seat-keyed, carries the standing slug into after via json_array, drops + renames');
  ok(I_SRC.includes('async function massPersonalPrayers(env: Env)')
    && !I_SRC.includes('Promise<string | null>'),
    'S2: index.ts carries the three-seat read; the v495 one-slug read is gone');
  ok(I_SRC.includes('seg[2] === "mass-personal-prayer" && !seg[3] && request.method === "GET"')
    && I_SRC.includes('seg[2] === "mass-personal-prayer" && !seg[3] && request.method === "PUT"'),
    'S3: the session GET/PUT pair stands at /api/prayer/mass-personal-prayer');
  ok(I_SRC.includes('seg[2] === "prayer" && seg[3] === "mass-personal-prayer" && request.method === "GET"'),
    'S4: the agent-door GET mirror stands (read-only)');
  const putSeat = I_SRC.slice(I_SRC.indexOf('seg[2] === "mass-personal-prayer" && !seg[3] && request.method === "PUT"'));
  ok(putSeat.includes('seat must be before, after, or aftermass')
    && putSeat.includes('SELECT slug FROM prayer_book WHERE slug = ?')
    && putSeat.includes('bad slug') && putSeat.includes('duplicate slug'),
    'S5: the PUT validates the seat, every slug against prayer_book, and refuses a duplicate (named 400s write nothing)');
  const iB = C_SRC.indexOf('id="mass-personal-before"');
  const iAnt = C_SRC.indexOf("massAntiphonHtml('Communion Antiphon'", iB);
  const iA = C_SRC.indexOf('id="mass-personal-after"', iAnt);
  const iPac = C_SRC.indexOf("massPrayerHtml('Prayer after Communion'", iA);
  ok(iB > 0 && iAnt > iB && iA > iAnt && iPac > iA,
    'S6: the before div stands immediately before the Communion Antiphon line, the after div immediately after it, before the Prayer after Communion');
  const iNotice = C_SRC.lastIndexOf("'<div class=\"mass-notice\">'");
  const iAM = C_SRC.indexOf('id="mass-personal-aftermass"');
  ok(iAM > iNotice && iNotice > 0,
    'S7: the aftermass div stands after the foot ICEL notice line in paintMassScroll');
  ok(C_SRC.includes("'Add a prayer before Communion'") && C_SRC.includes("'Add a prayer after Communion'")
    && C_SRC.includes("'Add a prayer after Mass'") && C_SRC.includes('Add another prayer')
    && C_SRC.includes('Standing after Mass'),
    'S8: the three seats\' button labels, the append label, and the popup standing mark stand in client.ts');
  const pin = (s) => s.replace(/ora-pro-nobis-v\d+-\d+/g, 'PIN');
  const stripPanels = (s) => s.split('\n').filter((l) => !l.startsWith('.mass-panels') && !l.startsWith('.mass-panel ')).join('\n');
  ok(pin(stripPanels(U_SRC)) === pin(U_BASE),
    'S9: ui.ts is byte-identical to the v500 ship outside the pin line and the .mass-panels block');
  for (const f of ['mass.ts', 'mass-order.ts', 'mass-readings.ts']) {
    ok(readFileSync(SRC + '/' + f, 'utf8') === readFileSync(BASE + '/' + f, 'utf8'),
      'S10-' + f + ': the Mass source stands byte-identical to the v500 ship');
  }
  ok(!!CONTRITION && !CONTRITION.p.bodyLatin && !!ANIMA && !!ANIMA.p.bodyLatin
    && !!SUBTUUM && !!SUBTUUM.p.bodyLatin && !!PAC && BOOK_COUNT === 75 && BOOK.groups.length === 9,
    'S11: the live-book fixture stands (9 groups, 75 prayers; Contrition has no Latin, Anima Christi + Sub Tuum carry Latin, the production pick stands in the book)',
    'count ' + BOOK_COUNT);
}

/* ---------------- M: the migration proof ---------------- */
{
  const py = [
    'import sqlite3, sys, json',
    'mig32 = open(sys.argv[1]).read()',
    'mig33 = open(sys.argv[2]).read()',
    'def build(seed):',
    '    db = sqlite3.connect(":memory:")',
    '    db.executescript(mig32)',
    '    if seed: db.execute(seed)',
    '    db.executescript(mig33)',
    '    rows = db.execute("SELECT seat, slugs FROM mass_personal_prayer ORDER BY seat").fetchall()',
    '    return {r[0]: json.loads(r[1]) for r in rows}',
    'a = build("INSERT INTO mass_personal_prayer (id, slug, updated_at) VALUES (1, \'anima-christi\', \'2026-11-17T00:00:00.000Z\')")',
    'assert a == {"after": ["anima-christi"], "aftermass": [], "before": []}, a',
    'b = build("INSERT INTO mass_personal_prayer (id, slug, updated_at) VALUES (1, NULL, \'2026-11-17T00:00:00.000Z\')")',
    'assert b == {"after": [], "aftermass": [], "before": []}, b',
    'c = build(None)',
    'assert c == {"after": [], "aftermass": [], "before": []}, c',
    'd = build("INSERT INTO mass_personal_prayer (id, slug, updated_at) VALUES (1, \'prayer-after-communion\', \'2026-11-17T00:00:00.000Z\')")',
    'assert d["after"] == ["prayer-after-communion"], d',
    'print("MIGRATION_OK")',
  ].join('\n');
  const tmp = path.join(os.tmpdir(), 'harness-v501-mig.py');
  writeFileSync(tmp, py);
  const f32 = path.join(os.tmpdir(), 'harness-v501-0032.sql');
  const f33 = path.join(os.tmpdir(), 'harness-v501-0033.sql');
  writeFileSync(f32, MIG32); writeFileSync(f33, MIG33);
  let migOut = '';
  try { migOut = execFileSync('python3', [tmp, f32, f33], { encoding: 'utf8' }); } catch (e) { migOut = 'ERR ' + String(e.stdout || e.message).slice(0, 200); }
  ok(migOut.includes('MIGRATION_OK'),
    'M1: the real 0032 + a seeded Anima Christi row + the real 0033 — after carries the seed; before/aftermass empty; null-slug and no-row cases read empty; the production pick carries',
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
      try { return JSON.parse(localStorage.getItem('mp-store-v501') || 'null') || { before: null, after: null, afterMass: [] }; }
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
      try { localStorage.setItem('mp-store-v501', JSON.stringify(store)); } catch (e) {}
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
  if (u === '/v501') { res.setHeader('Content-Type', 'text/html'); res.end(PAGE); return; }
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
  await page.waitForSelector('#mass-personal-aftermass, #mass-personal', { timeout: 15000 }).catch(() => console.log('note -', tag, 'seat slow'));
  await sleep(800);
  return { ctx, page };
}
const store = (page) => page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('mp-store-v501') || 'null'); } catch (e) { return null; }
});
async function pickFromSheet(page, search, slug) {
  await page.waitForSelector('.mpsheet', { timeout: 10000 }).catch(() => console.log('note - sheet slow'));
  await sleep(500);
  if (search) { await page.fill('#mp-search', search); await sleep(400); }
  await page.click('.mpsheet [data-mppick="' + slug + '"]');
  await sleep(700);
}

/* ---------------- the main flow ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot('/v501', errs, 'main');

  /* (a) seat order + (b) the unset buttons */
  const seatInfo = await page.evaluate(() => {
    const scroll = document.querySelector('.mass-scroll');
    const kids = Array.from(scroll.querySelectorAll('.mass-h, #mass-personal-before, #mass-personal-after'));
    const idxB = kids.findIndex((k) => k.id === 'mass-personal-before');
    const idxAnt = kids.findIndex((k) => k.textContent === 'Communion Antiphon');
    const idxA = kids.findIndex((k) => k.id === 'mass-personal-after');
    const idxPac = kids.findIndex((k) => k.textContent === 'Prayer after Communion');
    return {
      idxB, idxAnt, idxA, idxPac,
      lastIsAftermass: scroll.lastElementChild && scroll.lastElementChild.id === 'mass-personal-aftermass',
      btnB: (document.getElementById('mass-personal-before-btn') || {}).textContent || null,
      btnA: (document.getElementById('mass-personal-after-btn') || {}).textContent || null,
      btnM: (document.getElementById('mass-personal-aftermass-btn') || {}).textContent || null,
      counts: ['mass-personal-before', 'mass-personal-after', 'mass-personal-aftermass']
        .map((id) => document.querySelectorAll('#' + id).length),
    };
  });
  ok(seatInfo.counts.every((n) => n === 1) && seatInfo.idxB >= 0 && seatInfo.idxAnt === seatInfo.idxB + 1
    && seatInfo.idxA === seatInfo.idxAnt + 1 && seatInfo.idxPac === seatInfo.idxA + 1 && seatInfo.lastIsAftermass,
    'A1: each seat stands once — before div immediately before the Communion Antiphon, after div immediately after it and before the Prayer after Communion, aftermass div the last element of the scroll',
    JSON.stringify(seatInfo));
  ok(seatInfo.btnB === 'Add a prayer before Communion' && seatInfo.btnA === 'Add a prayer after Communion'
    && seatInfo.btnM === 'Add a prayer after Mass',
    'B1: with nothing saved, the three buttons read exactly as named', JSON.stringify(seatInfo));

  /* (b) the popup at the before seat: full library */
  await page.click('#mass-personal-before-btn');
  await page.waitForSelector('.mpsheet', { timeout: 10000 }).catch(() => console.log('note - sheet slow'));
  await sleep(600);
  const popInfo = await page.evaluate(() => ({
    rows: document.querySelectorAll('.mpsheet [data-mppick]').length,
    heads: document.querySelectorAll('.mpsheet .sectionhead').length,
    search: !!document.getElementById('mp-search'),
    remove: !!document.querySelector('.mpsheet [data-mpremove]'),
    head: (document.querySelector('.mpsheet h1') || {}).textContent || null,
  }));
  ok(popInfo.rows === BOOK_COUNT && popInfo.heads === BOOK.groups.length && popInfo.search && !popInfo.remove
    && popInfo.head === 'Add a prayer before Communion',
    'B2: the before-seat popup is headed for its seat and carries search + the full library (75 rows under 9 group heads); no Remove row while nothing is set',
    JSON.stringify(popInfo));

  /* (c) pick Anima Christi at the before seat */
  await pickFromSheet(page, 'anima', 'anima-christi');
  const cBefore = await page.evaluate(() => {
    const seat = document.getElementById('mass-personal-before');
    return {
      sheetGone: !document.querySelector('.mpsheet'),
      head: (seat.querySelector('.mass-h') || {}).textContent || null,
      lines: Array.from(seat.querySelectorAll('.mass-line')).map((l) => l.textContent).join('\n'),
      btn: (document.getElementById('mass-personal-before-btn') || {}).textContent || null,
      lang: !!seat.querySelector('.langswitch'),
      langEn: (seat.querySelector('[data-mplang="en"]') || {}).className || '',
      afterBtn: (document.getElementById('mass-personal-after-btn') || {}).textContent || null,
      massBtn: (document.getElementById('mass-personal-aftermass-btn') || {}).textContent || null,
    };
  });
  const st1 = await store(page);
  ok(cBefore.sheetGone && cBefore.head === ANIMA.p.title && words(cBefore.lines) === words(ANIMA.p.body)
    && cBefore.btn === 'Change prayer' && st1 && st1.before === 'anima-christi' && st1.after === null
    && Array.isArray(st1.afterMass) && st1.afterMass.length === 0,
    'C1: the pick stands at the before seat (title + full body word-stream-equal to the book row) and saves under before; the other seats untouched',
    JSON.stringify(st1));
  ok(cBefore.lang && cBefore.langEn.includes('active') && cBefore.afterBtn === 'Add a prayer after Communion'
    && cBefore.massBtn === 'Add a prayer after Mass',
    'C2: the Latin switch stands at the before seat only, English standing; the other seats keep their unset buttons');
  await page.click('#mass-personal-before [data-mplang="la"]');
  await sleep(400);
  const latB = await page.evaluate(() => Array.from(document.querySelectorAll('#mass-personal-before .mass-line')).map((l) => l.textContent).join('\n'));
  ok(words(latB) === words(ANIMA.p.bodyLatin), 'C3: the before seat\'s switch turns its body to the book row\'s Latin');
  await page.click('#mass-personal-before [data-mplang="en"]');
  await sleep(400);

  /* (c, mirror) pick Sub Tuum Praesidium at the after seat */
  await page.click('#mass-personal-after-btn');
  await pickFromSheet(page, 'sub tuum', 'sub-tuum-praesidium');
  const cAfter = await page.evaluate(() => {
    const seat = document.getElementById('mass-personal-after');
    return {
      head: (seat.querySelector('.mass-h') || {}).textContent || null,
      lines: Array.from(seat.querySelectorAll('.mass-line')).map((l) => l.textContent).join('\n'),
      lang: !!seat.querySelector('.langswitch'),
      beforeHead: (document.querySelector('#mass-personal-before .mass-h') || {}).textContent || null,
    };
  });
  const st2 = await store(page);
  ok(cAfter.head === SUBTUUM.p.title && words(cAfter.lines) === words(SUBTUUM.p.body) && cAfter.lang
    && cAfter.beforeHead === ANIMA.p.title && st2 && st2.after === 'sub-tuum-praesidium' && st2.before === 'anima-christi',
    'C4: the mirror at the after seat — its pick stands with its switch, saves under after, the before seat untouched',
    JSON.stringify(st2));

  /* (d) Change at before; Remove at after */
  await page.click('#mass-personal-before-btn');
  await page.waitForSelector('.mpsheet', { timeout: 10000 }).catch(() => console.log('note - sheet2 slow'));
  await sleep(500);
  const rmStands = await page.evaluate(() => !!document.querySelector('.mpsheet [data-mpremove]'));
  ok(rmStands, 'D1: with a prayer set, the single-seat popup carries the Remove act');
  await pickFromSheet(page, 'contrition', 'act-of-contrition');
  const dBefore = await page.evaluate(() => {
    const seat = document.getElementById('mass-personal-before');
    return {
      head: (seat.querySelector('.mass-h') || {}).textContent || null,
      lines: Array.from(seat.querySelectorAll('.mass-line')).map((l) => l.textContent).join('\n'),
      lang: !!seat.querySelector('.langswitch'),
    };
  });
  ok(dBefore.head === CONTRITION.p.title && words(dBefore.lines) === words(CONTRITION.p.body) && !dBefore.lang,
    'D2: Change + a second pick replaces the before seat\'s prayer (a Latin-less pick carries no switch)');
  await page.click('#mass-personal-after-btn');
  await page.waitForSelector('.mpsheet', { timeout: 10000 }).catch(() => console.log('note - sheet3 slow'));
  await sleep(500);
  await page.click('.mpsheet [data-mpremove]');
  await sleep(700);
  const dAfter = await page.evaluate(() => ({
    btn: (document.getElementById('mass-personal-after-btn') || {}).textContent || null,
    head: (document.querySelector('#mass-personal-after .mass-h') || {}).textContent || null,
    beforeHead: (document.querySelector('#mass-personal-before .mass-h') || {}).textContent || null,
  }));
  const st3 = await store(page);
  ok(dAfter.btn === 'Add a prayer after Communion' && !dAfter.head && dAfter.beforeHead === CONTRITION.p.title
    && st3 && st3.after === null && st3.before === 'act-of-contrition',
    'D3: Remove clears only the after seat back to its button; the save clears under after alone', JSON.stringify(st3));

  /* (e) aftermass: three picks side by side */
  await page.click('#mass-personal-aftermass-btn');
  await pickFromSheet(page, 'anima', 'anima-christi');
  await page.click('#mass-personal-aftermass-btn');
  await pickFromSheet(page, 'contrition', 'act-of-contrition');
  await page.click('#mass-personal-aftermass-btn');
  await pickFromSheet(page, 'sub tuum', 'sub-tuum-praesidium');
  const eInfo = await page.evaluate(() => {
    const host = document.getElementById('mass-personal-aftermass');
    const row = host.querySelector('.mass-panels');
    const panels = Array.from(host.querySelectorAll('.mass-panel'));
    return {
      panelHeads: panels.map((pn) => (pn.querySelector('.mass-h') || {}).textContent || null),
      panelLines: panels.map((pn) => Array.from(pn.querySelectorAll('.mass-line')).map((l) => l.textContent).join('\n')),
      addBtn: (document.getElementById('mass-personal-aftermass-btn') || {}).textContent || null,
      rowScrolls: row ? row.scrollWidth > row.clientWidth : false,
      pageSide: document.documentElement.scrollWidth <= window.innerWidth + 1,
      oneRow: row ? panels.every((pn) => Math.abs(pn.offsetTop - panels[0].offsetTop) < 2) : false,
    };
  });
  const st4 = await store(page);
  ok(eInfo.panelHeads.length === 3 && eInfo.panelHeads[0] === ANIMA.p.title && eInfo.panelHeads[1] === CONTRITION.p.title
    && eInfo.panelHeads[2] === SUBTUUM.p.title && eInfo.oneRow && eInfo.addBtn === 'Add another prayer',
    'E1: three picks stand side by side in ONE row in add order, with the Add another prayer button under the row',
    JSON.stringify(eInfo.panelHeads));
  ok(words(eInfo.panelLines[0]) === words(ANIMA.p.body) && words(eInfo.panelLines[1]) === words(CONTRITION.p.body)
    && words(eInfo.panelLines[2]) === words(SUBTUUM.p.body)
    && st4 && JSON.stringify(st4.afterMass) === JSON.stringify(['anima-christi', 'act-of-contrition', 'sub-tuum-praesidium']),
    'E2: each panel\'s text is word-stream-equal to its book row; the save holds the ordered list');
  ok(eInfo.rowScrolls && eInfo.pageSide,
    'E3: at the narrow viewport the row scrolls sideways inside its line while the page itself does not scroll sideways',
    JSON.stringify({ rowScrolls: eInfo.rowScrolls, pageSide: eInfo.pageSide }));
  await page.click('#mass-personal-aftermass .mass-panel:nth-child(1) [data-mplang="la"]');
  await sleep(400);
  const eLat = await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll('#mass-personal-aftermass .mass-panel'));
    return panels.map((pn) => Array.from(pn.querySelectorAll('.mass-line')).map((l) => l.textContent).join('\n'));
  });
  ok(words(eLat[0]) === words(ANIMA.p.bodyLatin) && words(eLat[2]) === words(SUBTUUM.p.body),
    'E4: a Latin panel\'s switch turns its own body only — the other Latin panel stands in English');
  await page.click('#mass-personal-aftermass .mass-panel:nth-child(1) [data-mplang="en"]');
  await sleep(400);

  /* (g) the duplicate guard in the aftermass popup */
  await page.click('#mass-personal-aftermass-btn');
  await page.waitForSelector('.mpsheet', { timeout: 10000 }).catch(() => console.log('note - sheet4 slow'));
  await sleep(600);
  const gInfo = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.mpsheet .bookrow'));
    const standing = rows.filter((r) => !r.hasAttribute('data-mppick'));
    return {
      pickable: document.querySelectorAll('.mpsheet [data-mppick]').length,
      standingMarks: standing.map((r) => r.textContent.replace(/\s+/g, ' ').trim()),
    };
  });
  ok(gInfo.pickable === BOOK_COUNT - 3 && gInfo.standingMarks.length === 3
    && gInfo.standingMarks.every((t) => t.includes('Standing after Mass')),
    'G1: in the aftermass popup the three standing prayers carry the Standing after Mass mark and no pick act; the other 72 rows stay pickable',
    JSON.stringify(gInfo));
  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.mpsheet .bookrow'));
    const row = rows.find((r) => !r.hasAttribute('data-mppick') && r.textContent.includes('Anima Christi'));
    if (row) row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await sleep(500);
  const st5 = await store(page);
  ok(st5 && JSON.stringify(st5.afterMass) === JSON.stringify(['anima-christi', 'act-of-contrition', 'sub-tuum-praesidium']),
    'G2: a tap on a standing row changes nothing — the list stands unchanged', JSON.stringify(st5));
  await page.evaluate(() => { const s = document.querySelector('.mpsheet'); if (s) s.remove(); });
  await sleep(300);

  /* (f) per-panel Remove */
  await page.click('#mass-personal-aftermass [data-mpremove="1"]');
  await sleep(700);
  const fInfo = await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll('#mass-personal-aftermass .mass-panel'));
    return { heads: panels.map((pn) => (pn.querySelector('.mass-h') || {}).textContent || null) };
  });
  const st6 = await store(page);
  ok(fInfo.heads.length === 2 && fInfo.heads[0] === ANIMA.p.title && fInfo.heads[1] === SUBTUUM.p.title
    && st6 && JSON.stringify(st6.afterMass) === JSON.stringify(['anima-christi', 'sub-tuum-praesidium']),
    'F1: removing the middle panel leaves the other two standing in order, in the paint and in the save',
    JSON.stringify(fInfo.heads));

  /* (j) the stepper governs single-seat + panel texts */
  const fs0 = await page.evaluate(() => {
    const a = document.querySelector('#mass-personal-before .mass-line');
    const b = document.querySelector('#mass-personal-aftermass .mass-panel .mass-line');
    return { a: a ? parseFloat(getComputedStyle(a).fontSize) : null, b: b ? parseFloat(getComputedStyle(b).fontSize) : null };
  });
  await page.click('.mass-controls [data-tsize="1"]'); await sleep(350);
  await page.click('.mass-controls [data-tsize="1"]'); await sleep(500);
  const fs3 = await page.evaluate(() => {
    const a = document.querySelector('#mass-personal-before .mass-line');
    const b = document.querySelector('#mass-personal-aftermass .mass-panel .mass-line');
    return { a: a ? parseFloat(getComputedStyle(a).fontSize) : null, b: b ? parseFloat(getComputedStyle(b).fontSize) : null };
  });
  ok(fs0.a && fs0.b && fs3.a > fs0.a && fs3.b > fs0.b,
    'J1: the v488 stepper scales the single-seat text and the panel texts', JSON.stringify({ fs0, fs3 }));
  await page.click('.mass-controls [data-tsize="-1"]'); await sleep(300);
  await page.click('.mass-controls [data-tsize="-1"]'); await sleep(300);

  /* (h) persistence across a fresh load */
  await page.reload();
  await page.waitForSelector('[data-openblock]', { timeout: 25000 }).catch(() => console.log('note - reload openblock slow'));
  await sleep(400);
  await page.click('#tabbar .tab[data-tab="mass"]');
  await page.waitForFunction(() => {
    const h = document.querySelector('#mass-personal-before .mass-h');
    return h && h.textContent === 'Act of Contrition';
  }, { timeout: 15000 }).catch(() => console.log('note - reload seat slow'));
  await sleep(500);
  const hInfo = await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll('#mass-personal-aftermass .mass-panel'));
    return {
      beforeHead: (document.querySelector('#mass-personal-before .mass-h') || {}).textContent || null,
      afterBtn: (document.getElementById('mass-personal-after-btn') || {}).textContent || null,
      panelHeads: panels.map((pn) => (pn.querySelector('.mass-h') || {}).textContent || null),
    };
  });
  ok(hInfo.beforeHead === CONTRITION.p.title && hInfo.afterBtn === 'Add a prayer after Communion'
    && hInfo.panelHeads.length === 2 && hInfo.panelHeads[0] === ANIMA.p.title && hInfo.panelHeads[1] === SUBTUUM.p.title,
    'H1: a fresh load shows all three seats as saved — before set, after cleared, the after-Mass panels in order',
    JSON.stringify(hInfo));
  ok(errs.length === 0, 'L1: Chromium boot + the whole flow clean (no page errors)', errs.join(' ; '));
  await ctx.close();
}

/* ---------------- (i) per-seat failure ---------------- */
{
  const errs = [];
  const f1 = await boot('/v501', errs, 'failget', () => { window.__mpFailGet = true; });
  const failInfo = await f1.page.evaluate(() => ({
    scroll: !!document.querySelector('.mass-scroll'),
    ant: Array.from(document.querySelectorAll('.mass-h')).some((hh) => hh.textContent === 'Communion Antiphon'),
    btnB: (document.getElementById('mass-personal-before-btn') || {}).textContent || null,
    btnA: (document.getElementById('mass-personal-after-btn') || {}).textContent || null,
    btnM: (document.getElementById('mass-personal-aftermass-btn') || {}).textContent || null,
  }));
  ok(failInfo.scroll && failInfo.ant && failInfo.btnB === 'Add a prayer before Communion'
    && failInfo.btnA === 'Add a prayer after Communion' && failInfo.btnM === 'Add a prayer after Mass',
    'I1: the personal GET failing leaves the scroll whole with all three buttons standing', JSON.stringify(failInfo));
  await f1.ctx.close();

  const f2 = await boot('/v501', errs, 'badslug', () => {
    localStorage.setItem('mp-store-v501', JSON.stringify({ before: 'no-such-slug', after: null, afterMass: [] }));
  });
  const badInfo = await f2.page.evaluate(() => ({
    scroll: !!document.querySelector('.mass-scroll'),
    btnB: (document.getElementById('mass-personal-before-btn') || {}).textContent || null,
    headB: (document.querySelector('#mass-personal-before .mass-h') || {}).textContent || null,
  }));
  ok(badInfo.scroll && badInfo.btnB === 'Change prayer' && !badInfo.headB,
    'I2: a saved slug missing from the book paints that seat\'s button state only (the v495 degraded rule — the set-state button, no prayer standing) — the scroll stands whole', JSON.stringify(badInfo));
  ok(errs.length === 0, 'L2: the failure boots run clean (no page errors)', errs.join(' ; '));
  await f2.ctx.close();
}

/* ---------------- (k) byte-identity vs the v500 ship ---------------- */
{
  const errs = [];
  const a = await boot('/v501', errs, 'k501');
  const b = await boot('/base', errs, 'kBase');
  const stripNew = (html) => html
    ? html.replace(/<div id="mass-personal-before">[\s\S]*?<\/div>/, '')
      .replace(/<div id="mass-personal-after">[\s\S]*?<\/div>/, '')
      .replace(/<div id="mass-personal-aftermass">[\s\S]*?<\/div>/, '')
    : html;
  const stripBase = (html) => html ? html.replace(/<div id="mass-personal">[\s\S]*?<\/div>/, '') : html;
  const hNew = await a.page.evaluate(() => { const s = document.querySelector('.mass-scroll'); return s ? s.outerHTML : null; });
  const hBase = await b.page.evaluate(() => { const s = document.querySelector('.mass-scroll'); return s ? s.outerHTML : null; });
  ok(hNew && hBase && stripNew(hNew) === stripBase(hBase),
    'K1: the Mass scroll renders byte-identical to the v500 ship, the seat divs excepted');
  ok(errs.length === 0, 'L3: the byte-identity boots run clean (no page errors)', errs.join(' ; '));
  await a.ctx.close(); await b.ctx.close();
}

await browser.close();
server.close();
if (!PROBE) {
  console.log('harness-v501:', pass + ' ok / ' + fail + ' not-ok');
  if (failures.length) console.log('failures:', failures.join(' | '));
  process.exit(fail ? 1 : 0);
}
