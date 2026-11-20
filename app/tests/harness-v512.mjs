// harness-v512.mjs — v512 evidence: the Conscience
// duplicate heading removal (John, Ora Pro Nobis
// thread, 2026-11-17 17:03 CT, with his screenshot
// of the Conscience tab's PIN screen): "Let's get
// rid of the exta conscience" — the Conscience page
// names itself TWICE: the header carries
// "Conscience" as the page title (paintRow2Plain,
// the standing v457 pattern), and the body opens
// with a second large "Conscience" heading above
// the PIN card.
//   The build: in the PIN gate flow's three paints
//   — renderPinGate (the PIN card + keypad),
//   renderPinSetupPrompt (the no-PIN-set card),
//   renderPinRecoveryForm (the recovery card) —
//   the html accumulator starts empty instead of
//   with '<h1 class="screen">' + the screen title.
//   Three one-line changes in client.ts; the card
//   markup after each is untouched. The gate flow
//   serves the Conscience tab alone (gatedTabRender
//   has exactly one caller, renderConscience), and
//   the paint is NOT shared with the unlocked view
//   (renderConscienceContent → paintMergedContainer
//   → the sides' own titles).
//   S statics: client.ts differs from the base by
//     exactly the three heading lines (normalized
//     diff) · index/mass files byte-identical ·
//     ui.ts identical outside the pin
//   P1: cooked parse (the v439 gate)
//   G legs (PIN set): no h1 in the view · the
//     header title reads "Conscience" · the PIN
//     card is the view's first element and its
//     outerHTML is byte-identical to the base's ·
//     the keypad stands (11 keys)
//   P legs (no PIN set): the setup prompt paints
//     with no body heading · its card byte-identical
//   R legs: the recovery form paints with no body
//     heading · its card byte-identical
//   U legs: after a stub verify, the unlocked
//     Examination paint's view HTML is
//     byte-identical to the base's
//   T legs: the Pray and Mass paints are
//     byte-identical to the base's
//   Chromium boot clean (no page errors)
// Fixtures (Improvement D): the day + Mass +
// readings payloads are the standing
// production-shaped set the v501–v511 harnesses
// boot; the book payload is the standing live
// capture; the PIN-state and exam payloads are
// shaped from the live routes' standing shapes
// (/api/pin/state · /api/exam/today). The base
// tree is read through env H512_BASE (default:
// the v509 ship — the build base; at ship compose
// it points at the v509 ship tree again).
// Run: node app/tests/harness-v512.mjs [--probe]
// (from the worktree root). --probe only prints.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const PROBE = process.argv.includes('--probe');
const APP = path.resolve(process.cwd(), 'app');
const SRC = APP + '/worker/src';
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const BASE = process.env.H512_BASE
  ? path.resolve(process.env.H512_BASE)
  : path.resolve(process.cwd(), '../../.worktrees/v509-ship/app/worker/src');
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

/* ---------------- S: statics ---------------- */
{
  const H1A = "var html = '<h1 class=\"screen\">' + titles.screen + '</h1>';";
  const H1B = "var html = '<h1 class=\"screen\">' + pinGateTitles(tab).screen + '</h1>';";
  const count = (s, sub) => s.split(sub).length - 1;
  ok(count(C_BASE, H1A) === 2 && count(C_BASE, H1B) === 1,
    'S1: the base paints the body heading at exactly three gate sites (gate · setup prompt · recovery)');
  const norm = C_BASE.split(H1A).join("var html = '';").split(H1B).join("var html = '';");
  ok(norm === C_SRC,
    'S2: client.ts differs from the base by exactly the three heading lines — the base with those lines emptied equals the build byte-for-byte');
  ok(!C_SRC.includes("'<h1 class=\"screen\">' + titles.screen") && !C_SRC.includes("'<h1 class=\"screen\">' + pinGateTitles(tab).screen"),
    'S3: no gate paint in the build opens the body with the screen-title heading');
  for (const f of ['mass.ts', 'mass-order.ts', 'mass-readings.ts', 'index.ts']) {
    ok(readFileSync(SRC + '/' + f, 'utf8') === readFileSync(BASE + '/' + f, 'utf8'),
      'S4-' + f + ': byte-identical to the base ship');
  }
  const pin = (s) => s.replace(/ora-pro-nobis-v\d+-\d+/g, 'PIN');
  ok(pin(U_SRC) === pin(U_BASE), 'S5: ui.ts is byte-identical to the base ship outside the pin line');
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
  ok: true, date: '2026-11-17', presentedDay: '2026-11-17',
  dateLabel: 'Tuesday, November 17, 2026',
  liturgicalDay: { name: 'Memorial of Saint Elizabeth of Hungary, Religious', color: 'white' },
  introTexts: {},
  blocks: [{ block: 'Morning', label: 'Morning', tracks: [
    { episodeId: '9001', title: 'Invitatory', durationS: 240, available: true, streamUrl: 'https://audio.example/9001.mp3' },
    { episodeId: '9002', title: 'Morning Prayer', durationS: 720, available: true, streamUrl: 'https://audio.example/9002.mp3' },
  ] }],
  episodes: [],
};
const FORMULARY = {
  entranceAntiphon: { text: 'I will bless the Lord at all times.', ref: 'Ps 34' },
  collect: 'O God, who made the Memorial of Saint Elizabeth a sign of your care, grant, we pray, that we may follow her example. Through our Lord Jesus Christ, your Son.',
  prayerOverOfferings: 'Accept, O Lord, the offerings we bring in honor of Saint Elizabeth.',
  prefaceText: null, prefaceName: null,
  communionAntiphon: { text: 'Blessed are the merciful, for they shall receive mercy.', ref: 'Mt 5:7' },
  prayerAfterCommunion: 'Nourished by this sacrament, O Lord, may we imitate Saint Elizabeth in charity.',
};
const MASS_PAYLOAD = {
  ok: true, name: 'Memorial of Saint Elizabeth of Hungary, Religious', season: 'Ordinary Time',
  defaultVersion: 'elizabeth',
  versions: [{ key: 'elizabeth', label: 'St Elizabeth of Hungary', rank: 'M', formulary: FORMULARY }],
};
const MASS_FEED = { ok: true, found: true, parts: [
  { key: 'r1', heading: 'First Reading', source: 'Rev 3:1-6, 14-22', html: '<p>I, John, heard the Lord saying to me: Because you are lukewarm, I will spit you out of my mouth.</p>' },
  { key: 'ps', heading: 'Responsorial Psalm', source: 'Ps 15:2-3a, 3bc-4ab, 5', html: '<p>R. (Rev. 3: 21) I will seat the victor beside me on my throne.</p><p>He who walks blamelessly and does justice; who thinks the truth in his heart and slanders not with his tongue.</p>' },
  { key: 'ga', heading: 'Gospel Acclamation', source: '1 Jn 4:10b', html: '<p>R. Alleluia, alleluia.</p><p>God loved us, and sent his Son as expiation for our sins.</p><p>R. Alleluia, alleluia.</p>' },
  { key: 'g', heading: 'Gospel', source: 'Lk 19:1-10', html: '<p>At that time Jesus came to Jericho and intended to pass through the town. Now a man there named Zacchaeus, who was a chief tax collector and also a wealthy man, was seeking to see who Jesus was.</p>' },
] };
const EXAM = {
  ok: true, date: '2026-11-17', dateLabel: 'Tuesday, November 17, 2026',
  run: { state: 'open' },
  categories: ['First Commandment', 'Second Commandment'],
  focusCategory: 'First Commandment',
  prompts: [
    { id: 11, category: 'First Commandment', text: 'Have I prayed every day?' },
    { id: 12, category: 'Second Commandment', text: 'Have I used God\'s name with reverence?' },
  ],
  entries: [],
};

function buildPage(cooked, css, pinSet) {
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
  if (p.indexOf('/api/prayer/mass-personal-prayer') === 0) return ans(200, { ok: true, before: [], after: [], afterMass: [], preMass: [] });
  if (p.indexOf('/api/pin/state') === 0) return ans(200, { ok: true, pinSet: ${pinSet ? 'true' : 'false'} });
  if (p.indexOf('/api/pin/verify') === 0) return ans(200, { ok: true, token: 'stub-token' });
  if (p.indexOf('/api/exam/today') === 0) return ans(200, ${JSON.stringify(EXAM)});
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

const PAGES = {
  '/v512-gate': buildPage(COOKED, APP_CSS, true),
  '/base-gate': buildPage(COOKED_BASE, APP_CSS_BASE, true),
  '/v512-setup': buildPage(COOKED, APP_CSS, false),
  '/base-setup': buildPage(COOKED_BASE, APP_CSS_BASE, false),
};
const server = http.createServer((req, res) => {
  const u = (req.url || '/').split('?')[0];
  if (PAGES[u]) { res.setHeader('Content-Type', 'text/html'); res.end(PAGES[u]); return; }
  res.statusCode = 404; res.end('not found');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });

const allErrs = [];
async function boot(which, tag) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await ctx.route('**/*', (route) => {
    if (route.request().url().startsWith(ORIGIN)) route.continue(); else route.abort();
  });
  page.on('pageerror', (e) => { allErrs.push(tag + ': ' + String(e).slice(0, 140)); console.log('note -', tag, 'pageerror:', String(e).slice(0, 140)); });
  await page.goto(ORIGIN + which);
  await page.waitForSelector('#tabbar .tab', { timeout: 25000 }).catch(() => console.log('note -', tag, 'tabbar slow'));
  await sleep(500);
  return { ctx, page };
}
const viewInfo = (page) => page.evaluate(() => {
  const view = document.getElementById('view');
  const first = view.firstElementChild;
  const card = view.querySelector('.card');
  return {
    h1s: Array.from(view.querySelectorAll('h1')).map((h) => h.textContent),
    hdrTitle: (document.getElementById('hdr2-title') || {}).textContent || null,
    firstTag: first ? first.tagName + '.' + first.className : null,
    firstId: first ? first.id : null,
    cardHtml: card ? card.outerHTML : null,
    pinKeys: view.querySelectorAll('[data-pinkey]').length,
    html: view.innerHTML,
  };
});

/* ---- G + R legs: the gate (PIN set), base first ---- */
{
  const b = await boot('/base-gate', 'base-gate');
  await b.page.click('#tabbar .tab[data-tab="conscience"]');
  await b.page.waitForSelector('#pinpad', { timeout: 15000 }).catch(() => console.log('note - base gate slow'));
  await sleep(400);
  const bi = await viewInfo(b.page);
  ok(bi.h1s.length === 1 && bi.h1s[0] === 'Conscience' && bi.firstTag === 'H1.screen',
    'G0 (premise): the base gate opens the body with the large "Conscience" heading — the duplicate stands in the base',
    JSON.stringify(bi.h1s) + ' :: ' + bi.firstTag);
  await b.page.click('#pin-forgot');
  await b.page.waitForSelector('#rec-code', { timeout: 10000 }).catch(() => console.log('note - base recovery slow'));
  await sleep(300);
  const br = await viewInfo(b.page);
  ok(br.h1s.length === 1 && br.h1s[0] === 'Conscience',
    'R0 (premise): the base recovery form also opens with the body heading', JSON.stringify(br.h1s));
  await b.ctx.close();

  const v = await boot('/v512-gate', 'v512-gate');
  await v.page.click('#tabbar .tab[data-tab="conscience"]');
  await v.page.waitForSelector('#pinpad', { timeout: 15000 }).catch(() => console.log('note - v512 gate slow'));
  await sleep(400);
  const vi = await viewInfo(v.page);
  ok(vi.h1s.length === 0, 'G1: the PIN screen paints NO body heading — no h1 stands in the view', JSON.stringify(vi.h1s));
  ok(vi.hdrTitle === 'Conscience', 'G2: the name stands once, in the header — the row-2 title reads "Conscience"', String(vi.hdrTitle));
  ok(vi.firstId === 'pingate-card', 'G3: the PIN card stands directly under the header — it is the view\'s first element', String(vi.firstTag) + '#' + String(vi.firstId));
  ok(vi.cardHtml === bi.cardHtml, 'G4: the PIN card\'s outerHTML is byte-identical to the base ship\'s card');
  ok(vi.pinKeys === 11, 'G5: the keypad stands whole — 11 keys', String(vi.pinKeys));
  await v.page.click('#pin-forgot');
  await v.page.waitForSelector('#rec-code', { timeout: 10000 }).catch(() => console.log('note - v512 recovery slow'));
  await sleep(300);
  const vr = await viewInfo(v.page);
  ok(vr.h1s.length === 0, 'R1: the recovery form paints NO body heading', JSON.stringify(vr.h1s));
  ok(vr.cardHtml === br.cardHtml, 'R2: the recovery card\'s outerHTML is byte-identical to the base ship\'s card');
  await v.ctx.close();
}

/* ---- P legs: the setup prompt (no PIN set) ---- */
{
  const b = await boot('/base-setup', 'base-setup');
  await b.page.click('#tabbar .tab[data-tab="conscience"]');
  await b.page.waitForSelector('#pin-setup-open', { timeout: 15000 }).catch(() => console.log('note - base setup slow'));
  await sleep(400);
  const bi = await viewInfo(b.page);
  ok(bi.h1s.length === 1 && bi.h1s[0] === 'Conscience',
    'P0 (premise): the base setup prompt opens with the body heading', JSON.stringify(bi.h1s));
  await b.ctx.close();

  const v = await boot('/v512-setup', 'v512-setup');
  await v.page.click('#tabbar .tab[data-tab="conscience"]');
  await v.page.waitForSelector('#pin-setup-open', { timeout: 15000 }).catch(() => console.log('note - v512 setup slow'));
  await sleep(400);
  const vi = await viewInfo(v.page);
  ok(vi.h1s.length === 0, 'P1: the setup prompt paints NO body heading', JSON.stringify(vi.h1s));
  ok(vi.hdrTitle === 'Conscience', 'P2: the header title stands on the setup prompt', String(vi.hdrTitle));
  ok(vi.firstTag === 'DIV.card pingate' && vi.cardHtml === bi.cardHtml,
    'P3: the setup card stands first in the view and is byte-identical to the base ship\'s card', String(vi.firstTag));
  await v.ctx.close();
}

/* ---- U legs: the unlocked view ---- */
async function unlocked(which, tag) {
  const s = await boot(which, tag);
  await s.page.click('#tabbar .tab[data-tab="conscience"]');
  await s.page.waitForSelector('#pinpad', { timeout: 15000 }).catch(() => console.log('note -', tag, 'gate slow'));
  for (const d of ['1', '2', '3', '4']) await s.page.click('[data-pinkey="' + d + '"]');
  await sleep(200);
  await s.page.click('#pin-unlock');
  await s.page.waitForSelector('#ex-gear', { timeout: 15000 }).catch(() => console.log('note -', tag, 'exam slow'));
  await sleep(500);
  const info = await s.page.evaluate(() => ({
    html: document.getElementById('view').innerHTML,
    h1: (document.querySelector('#view h1') || {}).textContent || null,
  }));
  await s.ctx.close();
  return info;
}
{
  const bu = await unlocked('/base-gate', 'base-unlocked');
  const vu = await unlocked('/v512-gate', 'v512-unlocked');
  ok(vu.h1 === 'Tonight’s examination', 'U1: the unlocked view opens on the Examination side, as the base does', String(vu.h1));
  ok(vu.html === bu.html, 'U2: the unlocked view\'s whole paint is byte-identical to the base ship\'s render of the same fixture');
}

/* ---- T legs: the other tabs ---- */
async function tabPaint(which, tab, marker, tag) {
  const s = await boot(which, tag);
  await s.page.click('#tabbar .tab[data-tab="' + tab + '"]');
  await s.page.waitForSelector(marker, { timeout: 20000 }).catch(() => console.log('note -', tag, tab, 'slow'));
  await sleep(900);
  const html = await s.page.evaluate(() => document.getElementById('view').innerHTML);
  await s.ctx.close();
  return html;
}
{
  const bm = await tabPaint('/base-gate', 'mass', '.mass-scroll', 'base-mass');
  const vm = await tabPaint('/v512-gate', 'mass', '.mass-scroll', 'v512-mass');
  ok(vm === bm, 'T1: the Mass tab\'s paint is byte-identical to the base ship\'s');
  const bp = await tabPaint('/base-gate', 'prayers', '#sidehost', 'base-pray');
  const vp = await tabPaint('/v512-gate', 'prayers', '#sidehost', 'v512-pray');
  ok(vp === bp, 'T2: the Pray tab\'s paint is byte-identical to the base ship\'s');
}

ok(allErrs.length === 0, 'B1: Chromium boot clean — no page errors on any boot', allErrs.join(' | ').slice(0, 200));

await browser.close();
server.close();
console.log('harness-v512: ' + pass + ' passed / ' + fail + ' failed');
if (failures.length) { console.log('failures:', failures.join(' · ')); process.exit(1); }
