// harness-v495.mjs — v495 evidence: a personal prayer
// after the Communion Antiphon, picked from the written-
// prayer library through a search popup, its text standing
// in the scroll at the seat, the choice kept saved
// (John, 2026-11-17 07:13 CT).
//   (a) the button stands immediately after the Communion
//       Antiphon lines and nowhere else new; with no saved
//       prayer, no prayer text stands at the seat
//   (b) the popup opens with search + the full library
//       list (row count = the book's count), search
//       filters by title (the book's standing match)
//   (c) picking a prayer puts its full text at the seat,
//       word-stream-equal to the book row's body, and the
//       choice is saved — a fresh page load still shows it
//   (d) Change reopens the popup; a second pick replaces
//       the text; Remove clears the seat to button-only
//   (e) the saved prayer follows the v488 text-size stepper
//   (f) a Latin-carrying pick carries the book page's own
//       English | Latin switch at the seat
//   (g) the rest of the Mass scroll is byte-identical to
//       the v494 ship's rendering, the seat div excepted;
//       player/nav untouched
//   (h) cooked parse + Chromium boot clean (the v439 gate)
// Fixtures (Improvement D): the book is the LIVE payload
// captured through the prayer door on 2026-11-17
// (tests/fixtures/book-live-2026-11-17.json — 9 groups,
// 75 prayers; the picks are its real Act of Contrition row
// — body, no Latin — and its real Anima Christi row — body
// + bodyLatin). The Mass day + readings fixtures are the
// harness-v494 set (production payload shapes). The save
// route is stood against a localStorage-backed store in
// the fetch stub — the route's shape (GET answers the
// stored slug; PUT validates against the book's slugs and
// answers the re-read) mirrors the shipped route; the
// store's persistence across a reload stands in for the
// server's. Run: node app/tests/harness-v495.mjs [--probe]
// (from the worktree root). --probe only prints.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const PROBE = process.argv.includes('--probe');
const APP = path.resolve(process.cwd(), 'app');
const SRC = APP + '/worker/src';
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const I_SRC = readFileSync(SRC + '/index.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const MIG = readFileSync(APP + '/migrations/0032_mass_personal_prayer.sql', 'utf8');
const BASE = path.resolve(process.cwd(), '../../.worktrees/v494-ship/app/worker/src');
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

/* ---------------- S: statics ---------------- */
{
  ok(MIG.includes('CREATE TABLE IF NOT EXISTS mass_personal_prayer') && MIG.includes('CHECK (id = 1)'),
    'S1: migration 0032 creates the one-row mass_personal_prayer table');
  ok(I_SRC.includes('async function massPersonalPrayer(env: Env)'),
    'S2: index.ts carries the massPersonalPrayer read (missing table reads as unset)');
  ok(I_SRC.includes('seg[2] === "mass-personal-prayer" && !seg[3] && request.method === "GET"')
    && I_SRC.includes('seg[2] === "mass-personal-prayer" && !seg[3] && request.method === "PUT"'),
    'S3: the session GET/PUT pair stands at /api/prayer/mass-personal-prayer');
  ok(I_SRC.includes('seg[2] === "prayer" && seg[3] === "mass-personal-prayer" && request.method === "GET"'),
    'S4: the agent-door GET mirror stands (read-only)');
  const putSeat = I_SRC.slice(I_SRC.indexOf('seg[2] === "mass-personal-prayer" && !seg[3] && request.method === "PUT"'));
  ok(putSeat.includes('SELECT slug FROM prayer_book WHERE slug = ?') && putSeat.includes('bad slug'),
    'S5: the PUT validates the slug against prayer_book (a named 400 writes nothing)');
  const ant = C_SRC.indexOf("massAntiphonHtml('Communion Antiphon'");
  const seat = C_SRC.indexOf('id="mass-personal"', ant);
  const pac = C_SRC.indexOf("massPrayerHtml('Prayer after Communion'", ant);
  ok(ant > 0 && seat > ant && pac > seat,
    'S6: the seat div stands in paintMassScroll between the Communion Antiphon and the Prayer after Communion');
  const pin = (s) => s.replace(/ora-pro-nobis-v\d+-\d+/g, 'PIN');
  ok(pin(U_SRC) === pin(U_BASE), 'S7: ui.ts is byte-identical to the v494 ship (the pin line normalized)');
  for (const f of ['mass.ts', 'mass-order.ts', 'mass-readings.ts']) {
    ok(readFileSync(SRC + '/' + f, 'utf8') === readFileSync(BASE + '/' + f, 'utf8'),
      'S8-' + f + ': the Mass source stands byte-identical to the v494 ship');
  }
  ok(!!CONTRITION && !CONTRITION.p.bodyLatin && !!ANIMA && !!ANIMA.p.bodyLatin && BOOK_COUNT === 75 && BOOK.groups.length === 9,
    'S9: the live-book fixture stands (9 groups, 75 prayers; Contrition has no Latin, Anima Christi carries Latin)',
    'count ' + BOOK_COUNT);
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

function buildPage(cooked, css, withBook) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body data-lit="">
<audio id="audio"></audio>
${SHELL}
<script>
window.__fetchLog = [];
var BOOK_STUB = ${withBook ? JSON.stringify(BOOK) : 'null'};
window.fetch = function (path, opts) {
  const p = String(path);
  window.__fetchLog.push({ path: p });
  const ans = function (status, body) { return Promise.resolve({ ok: status < 400, status: status, json: function () { return Promise.resolve(body); } }); };
  if (p.indexOf('/api/player/day') === 0) return ans(200, ${JSON.stringify(DAY)});
  if (p.indexOf('/api/prayer/mass?') === 0) return ans(200, ${JSON.stringify(MASS_PAYLOAD)});
  if (p.indexOf('/api/prayer/mass-readings') === 0) return ans(200, ${JSON.stringify(MASS_FEED)});
  if (p.indexOf('/api/prayer/book') === 0) return ans(200, BOOK_STUB || { ok: true, groups: [] });
  if (p.indexOf('/api/prayer/mass-personal-prayer') === 0) {
    if (opts && opts.method === 'PUT') {
      let slug = null;
      try { slug = JSON.parse(opts.body || '{}').slug; } catch (e) {}
      if (slug !== null) {
        let found = false;
        (BOOK_STUB ? BOOK_STUB.groups : []).forEach(function (g) { g.prayers.forEach(function (x) { if (x.slug === slug) found = true; }); });
        if (!found) return ans(400, { error: 'bad slug ' + slug });
      }
      try { localStorage.setItem('mp-store-v495', JSON.stringify(slug)); } catch (e) {}
      return ans(200, { ok: true, slug: slug });
    }
    let cur = null;
    try { cur = JSON.parse(localStorage.getItem('mp-store-v495') || 'null'); } catch (e) {}
    return ans(200, { ok: true, slug: cur });
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
  if (u === '/v495') { res.setHeader('Content-Type', 'text/html'); res.end(PAGE); return; }
  if (u === '/base') { res.setHeader('Content-Type', 'text/html'); res.end(PAGE_BASE); return; }
  res.statusCode = 404; res.end('not found');
});
PAGE = buildPage(COOKED, APP_CSS, true);
PAGE_BASE = buildPage(COOKED_BASE, APP_CSS_BASE, false);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });

async function boot(which, errs, tag) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
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
  await page.waitForSelector('#mass-personal', { timeout: 15000 }).catch(() => console.log('note -', tag, 'seat slow'));
  await sleep(800);
  return { ctx, page };
}

/* ---------------- the main flow ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot('/v495', errs, 'main');

  /* (a) the seat's place + the empty state */
  const seatInfo = await page.evaluate(() => {
    const scroll = document.querySelector('.mass-scroll');
    const seat = document.getElementById('mass-personal');
    const kids = Array.from(scroll.querySelectorAll('.mass-h, .mass-line, .mass-ref, #mass-personal'));
    const idxAnt = kids.findIndex((k) => k.textContent.includes('Blessed are the merciful'));
    const idxSeat = kids.indexOf(seat);
    const idxPac = kids.findIndex((k) => k.textContent === 'Prayer after Communion');
    return {
      seats: document.querySelectorAll('#mass-personal').length,
      idxAnt, idxSeat, idxPac,
      btn: (document.getElementById('mass-personal-btn') || {}).textContent || null,
      seatText: seat ? seat.textContent : '',
    };
  });
  ok(seatInfo.seats === 1 && seatInfo.idxAnt >= 0 && seatInfo.idxSeat === seatInfo.idxAnt + 1 && seatInfo.idxPac > seatInfo.idxSeat,
    'A1: the seat stands once, immediately after the Communion Antiphon lines, before the Prayer after Communion',
    JSON.stringify(seatInfo));
  ok(seatInfo.btn === 'Add your own prayer' && !seatInfo.seatText.includes('Anima Christi') && !seatInfo.seatText.includes('Act of Contrition'),
    'A2: with no saved prayer the seat is the button alone — no prayer text stands', seatInfo.btn);

  /* (b) the popup: full list + search */
  await page.click('#mass-personal-btn');
  await page.waitForSelector('.mpsheet', { timeout: 10000 }).catch(() => console.log('note - sheet slow'));
  await sleep(600);
  const popInfo = await page.evaluate(() => ({
    rows: document.querySelectorAll('.mpsheet [data-mppick]').length,
    heads: document.querySelectorAll('.mpsheet .sectionhead').length,
    search: !!document.getElementById('mp-search'),
    remove: !!document.querySelector('.mpsheet [data-mpremove]'),
  }));
  ok(popInfo.rows === BOOK_COUNT && popInfo.heads === BOOK.groups.length && popInfo.search && !popInfo.remove,
    'B1: the popup carries search + the full library (75 rows under 9 group heads); no Remove row while nothing is set',
    JSON.stringify(popInfo));
  await page.fill('#mp-search', 'anima');
  await sleep(400);
  const filt = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.mpsheet [data-mppick]'));
    const hit = rows.filter((r) => r.getAttribute('data-mppick') === 'anima-christi');
    return { n: rows.length, hit: hit.length, meta: hit.length ? (hit[0].querySelector('.meta') || {}).textContent : null };
  });
  ok(filt.n >= 1 && filt.n < BOOK_COUNT && filt.hit === 1 && filt.meta === ANIMA.category,
    'B2: search filters the list (title match); the hit carries its group as the meta', JSON.stringify(filt));

  /* (c) + (f) pick Anima Christi (Latin-carrying) */
  await page.click('.mpsheet [data-mppick="anima-christi"]');
  await sleep(700);
  const seatAfter = await page.evaluate(() => {
    const seat = document.getElementById('mass-personal');
    const lines = Array.from(seat.querySelectorAll('.mass-line')).map((l) => l.textContent).join('\n');
    return {
      sheetGone: !document.querySelector('.mpsheet'),
      head: (seat.querySelector('.mass-h') || {}).textContent || null,
      lines,
      btn: (document.getElementById('mass-personal-btn') || {}).textContent || null,
      store: localStorage.getItem('mp-store-v495'),
      lang: !!document.getElementById('mass-personal-lang'),
      langActive: (document.querySelector('#mass-personal-lang [data-mplang="en"]') || {}).className || '',
    };
  });
  ok(seatAfter.sheetGone && seatAfter.head === ANIMA.p.title && words(seatAfter.lines) === words(ANIMA.p.body),
    'C1: the pick stands at the seat — its title as the heading, its full body word-stream-equal to the book row');
  ok(seatAfter.store === JSON.stringify('anima-christi') && seatAfter.btn === 'Change prayer',
    'C2: the choice is saved through the route (the store holds the slug); the button reads Change prayer', seatAfter.store);
  ok(seatAfter.lang && seatAfter.langActive.includes('active'),
    'F1: a Latin-carrying pick carries the English | Latin switch at the seat, English standing');
  await page.click('#mass-personal-lang [data-mplang="la"]');
  await sleep(400);
  const latLines = await page.evaluate(() => Array.from(document.querySelectorAll('#mass-personal .mass-line')).map((l) => l.textContent).join('\n'));
  ok(words(latLines) === words(ANIMA.p.bodyLatin),
    'F2: the switch turns the seat\'s body to the book row\'s Latin, word-stream-equal');
  await page.click('#mass-personal-lang [data-mplang="en"]');
  await sleep(400);

  /* (e) the stepper governs the seat */
  const fs0 = await page.evaluate(() => {
    const l = document.querySelector('#mass-personal .mass-line');
    return l ? parseFloat(getComputedStyle(l).fontSize) : null;
  });
  await page.click('.mass-controls [data-tsize="1"]'); await sleep(350);
  await page.click('.mass-controls [data-tsize="1"]'); await sleep(500);
  const fs3 = await page.evaluate(() => {
    const l = document.querySelector('#mass-personal .mass-line');
    return l ? parseFloat(getComputedStyle(l).fontSize) : null;
  });
  ok(fs0 && fs3 && fs3 > fs0, 'E1: the seat\'s lines scale with the v488 text-size stepper', fs0 + ' -> ' + fs3);
  await page.click('.mass-controls [data-tsize="-1"]'); await sleep(300);
  await page.click('.mass-controls [data-tsize="-1"]'); await sleep(300);

  /* (c, fresh load) the saved prayer survives a reload */
  await page.reload();
  await page.waitForSelector('[data-openblock]', { timeout: 25000 }).catch(() => console.log('note - reload openblock slow'));
  await sleep(400);
  await page.click('#tabbar .tab[data-tab="mass"]');
  await page.waitForFunction(() => {
    const h = document.querySelector('#mass-personal .mass-h');
    return h && h.textContent === 'Anima Christi';
  }, { timeout: 15000 }).catch(() => console.log('note - reload seat slow'));
  const reloadHead = await page.evaluate(() => (document.querySelector('#mass-personal .mass-h') || {}).textContent || null);
  ok(reloadHead === 'Anima Christi', 'C3: a fresh page load still shows the saved prayer at the seat', reloadHead);

  /* (d) Change -> replace -> Remove */
  await page.click('#mass-personal-btn');
  await page.waitForSelector('.mpsheet', { timeout: 10000 }).catch(() => console.log('note - sheet2 slow'));
  await sleep(500);
  const rmStands = await page.evaluate(() => !!document.querySelector('.mpsheet [data-mpremove]'));
  ok(rmStands, 'D1: with a prayer set, the popup carries the Remove act');
  await page.fill('#mp-search', 'contrition');
  await sleep(400);
  await page.click('.mpsheet [data-mppick="act-of-contrition"]');
  await sleep(700);
  const replaced = await page.evaluate(() => {
    const seat = document.getElementById('mass-personal');
    const lines = Array.from(seat.querySelectorAll('.mass-line')).map((l) => l.textContent).join('\n');
    return {
      head: (seat.querySelector('.mass-h') || {}).textContent || null,
      lines, lang: !!document.getElementById('mass-personal-lang'),
      store: localStorage.getItem('mp-store-v495'),
    };
  });
  ok(replaced.head === CONTRITION.p.title && words(replaced.lines) === words(CONTRITION.p.body) && !replaced.lang
    && replaced.store === JSON.stringify('act-of-contrition'),
    'D2: Change + a second pick replaces the seat\'s prayer (a Latin-less pick carries no switch)');
  await page.click('#mass-personal-btn');
  await page.waitForSelector('.mpsheet', { timeout: 10000 }).catch(() => console.log('note - sheet3 slow'));
  await sleep(500);
  await page.click('.mpsheet [data-mpremove]');
  await sleep(700);
  const cleared = await page.evaluate(() => {
    const seat = document.getElementById('mass-personal');
    return {
      btn: (document.getElementById('mass-personal-btn') || {}).textContent || null,
      head: (seat.querySelector('.mass-h') || {}).textContent || null,
      store: localStorage.getItem('mp-store-v495'),
    };
  });
  ok(cleared.btn === 'Add your own prayer' && !cleared.head && cleared.store === 'null',
    'D3: Remove clears the seat back to the button-only state and clears the save', JSON.stringify(cleared));
  ok(errs.length === 0, 'H1: Chromium boot + the whole flow clean (no page errors)', errs.join(' ; '));
  await ctx.close();
}

/* ---------------- (g) byte-identity vs the v494 ship ---------------- */
{
  const errs = [];
  const a = await boot('/v495', errs, 'g495');
  const b = await boot('/base', errs, 'gBase');
  const strip = (html) => html ? html.replace(/<div id="mass-personal">[\s\S]*?<\/div>/, '') : html;
  const hNew = await a.page.evaluate(() => { const s = document.querySelector('.mass-scroll'); return s ? s.outerHTML : null; });
  const hBase = await b.page.evaluate(() => { const s = document.querySelector('.mass-scroll'); return s ? s.outerHTML : null; });
  ok(hNew && hBase && strip(hNew) === hBase,
    'G1: the Mass scroll renders byte-identical to the v494 ship, the seat div excepted');
  ok(errs.length === 0, 'H2: the byte-identity boots run clean (no page errors)', errs.join(' ; '));
  await a.ctx.close(); await b.ctx.close();
}

await browser.close();
server.close();
if (!PROBE) {
  console.log('harness-v495:', pass + ' ok / ' + fail + ' not-ok');
  if (failures.length) console.log('failures:', failures.join(' | '));
  process.exit(fail ? 1 : 0);
}
