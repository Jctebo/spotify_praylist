// harness-v496.mjs — v496 evidence: the day's liturgical
// color applies at boot on EVERY opening tab (production-
// break fix-forward; John's defect report 2026-11-17 07:43
// CT: the header shows blue at Mass first load — the
// unthemed navy default #16283f standing because data-lit
// was never set).
// Diagnosis of record (reproduced at Scope on the v494
// ship): applyLiturgical is the only seat that sets
// data-lit + pushes the status-bar color; its only callers
// were the Pray tab's paints (buildDayFromPayload from
// /api/player/day; renderPrayerBook + renderIntentions from
// /api/prayer/day). The Mass first load never fed it —
// massPayload carries no liturgicalDay and paintMassLiturgy's
// settle never applied it (true in every tree v491–v494) —
// and before v492 every boot opened the Pray tab, so the
// color stood before Mass was ever opened. v492's opening
// rule (cold start on Mass; in general the last tab opened)
// removed that incidental feed for any boot not landing on
// Pray. The fix: the boot itself reads /api/prayer/day and
// applies it beside the opening tab's paint.
// SUBJECT: a tree carrying v492's boot (the ship lineage).
// Run from that worktree's root:
//   node app/tests/harness-v496.mjs [--probe]
// Fixtures (Improvement D): the WHITE day payload's
// liturgicalDay is the live production record for
// 2026-11-17, captured through the app door
// (/api/agent/player/day) at diagnosis time — { name:
// "Memorial of Saint Elizabeth of Hungary, Religious",
// color: "white" }, dateLabel "Tuesday, November 17, 2026".
// The RED and GREEN records stand in the production shape
// (the prayer_liturgical_days record: a name + a color from
// the accepted set white/red/green/violet/rose) for real
// calendar days the nightly job derives — Saint Josaphat,
// Bishop and Martyr (red) and a Tuesday of the 33rd Week in
// Ordinary Time (green); the asserted theme values
// (#5d1616 / #173a22) are ui.ts's own production themes.
// Day payloads ride in the standing route shape (the
// harness-v494 fixture shape, from index.ts's payloads);
// the SAME body answers /api/player/day and /api/prayer/day,
// as in production both carry liturgicalDay.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const PROBE = process.argv.includes('--probe');
const APP = path.resolve(process.cwd(), 'app');
const SRC = APP + '/worker/src';
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const BASE = path.resolve(process.cwd(), '../../.worktrees/v495-ship/app/worker/src');
const C_BASE = readFileSync(BASE + '/client.ts', 'utf8');
const U_BASE = readFileSync(BASE + '/ui.ts', 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (PROBE) { console.log('probe -', label, extra ? ' :: ' + extra : ''); return; }
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}

/* ---------------- S: statics ---------------- */
{
  const boot = C_SRC.slice(C_SRC.indexOf('// v496: the day'));
  ok(boot.includes("api('/api/prayer/day?date=' + todayChicago()).then(function (day) { applyLiturgical(day || {}); })"),
    'S1: the v496 boot block reads /api/prayer/day and applies it');
  const setTabAt = C_SRC.lastIndexOf('setTab(bootTab);');
  ok(setTabAt > 0 && C_SRC.indexOf('// v496: the day') < setTabAt && C_SRC.indexOf('// v496: the day') > C_SRC.indexOf('setupBackButton();'),
    'S2: the block stands at the boot tail, beside the opening setTab(bootTab)');
  ok(C_SRC.includes("var bootTab = 'mass';") && C_SRC.includes("localStorage.getItem('opn-lasttab-v492')"),
    'S3: the v492 opening rule stands whole (cold Mass · last tab · the standing key)');
  ok(C_SRC.split('applyLiturgical(day);').length - 1 === 3,
    'S4: the three standing applyLiturgical call sites stand unchanged (buildDayFromPayload · renderPrayerBook · renderIntentions — the v496 site reads applyLiturgical(day || {}) and does not enter this count)');
  const stripFix = (s) => { const a = s.indexOf('// v496: the day'); if (a < 0) return s; const e = s.indexOf('applyLiturgical(day || {}); }).catch(function () {});', a); if (e < 0) return s; const b = s.indexOf('\n', e) + 1; return s.slice(0, a) + s.slice(b); };
  ok(stripFix(C_SRC) === C_BASE, 'S5: client.ts differs from the v495 ship only at the v496 boot block');
  const stripPin = (s) => s.replace(/var CACHE = "ora-pro-nobis-v[0-9]+-[0-9]+"/, 'var CACHE = "PIN"');
  ok(stripPin(U_SRC) === stripPin(U_BASE), 'S6: ui.ts differs from the v495 ship only at the pin line');
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

function dayPayload(lit) {
  return {
    ok: true, date: '2026-11-17', presentedDay: '2026-11-17',
    dateLabel: 'Tuesday, November 17, 2026',
    liturgicalDay: lit,
    introTexts: {},
    blocks: [{ block: 'Morning', label: 'Morning', tracks: [
      { episodeId: '9001', title: 'Invitatory', durationS: 240, available: true, streamUrl: 'https://audio.example/9001.mp3' },
      { episodeId: '9002', title: 'Morning Prayer', durationS: 720, available: true, streamUrl: 'https://audio.example/9002.mp3' },
    ] }],
    episodes: [],
  };
}
const LIT_WHITE = { name: 'Memorial of Saint Elizabeth of Hungary, Religious', color: 'white' };
const LIT_RED = { name: 'Memorial of Saint Josaphat, Bishop and Martyr', color: 'red' };
const LIT_GREEN = { name: 'Tuesday of the 33rd Week in Ordinary Time', color: 'green' };
const MASS_PAYLOAD = {
  ok: true, name: 'Memorial of Saint Elizabeth of Hungary, Religious', season: 'Ordinary',
  defaultVersion: 'elizabeth',
  versions: [{ key: 'elizabeth', label: 'St Elizabeth of Hungary', rank: 'M', formulary: {
    entranceAntiphon: { text: 'I will bless the Lord at all times.', ref: 'Ps 34' },
    collect: 'O God, who made the Memorial of Saint Elizabeth a sign of your care, grant, we pray, that we may follow her example. Through our Lord Jesus Christ, your Son.',
    prayerOverOfferings: 'Accept, O Lord, the offerings we bring in honor of Saint Elizabeth.',
    prefaceText: null, prefaceName: null,
    communionAntiphon: { text: 'Blessed are the merciful, for they shall receive mercy.', ref: 'Mt 5:7' },
    prayerAfterCommunion: 'Nourished by this sacrament, O Lord, may we imitate Saint Elizabeth in charity.',
  } }],
};
const MASS_FEED = { ok: true, found: true, parts: [
  { key: 'r1', heading: 'First Reading', source: 'Rev 3:1-6, 14-22', html: '<p>I, John, heard the Lord saying to me.</p>' },
  { key: 'ps', heading: 'Responsorial Psalm', source: 'Ps 15:2-3a, 3bc-4ab, 5', html: '<p>R. I will seat the victor beside me on my throne.</p>' },
  { key: 'ga', heading: 'Gospel Acclamation', source: '1 Jn 4:10b', html: '<p>R. Alleluia, alleluia.</p><p>God loved us, and sent his Son as expiation for our sins.</p>' },
  { key: 'g', heading: 'Gospel', source: 'Lk 19:1-10', html: '<p>At that time Jesus came to Jericho and intended to pass through the town.</p>' },
] };

function buildPage(cooked, css, lit) {
  const DAY = dayPayload(lit);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body>
<audio id="audio"></audio>
${SHELL}
<script>
window.__fetchLog = [];
window.__bridge = [];
window.Capacitor = { Plugins: { OraDayBridge: {
  setStatusBarColor: function (o) { window.__bridge.push({ m: 'setStatusBarColor', color: o && o.color }); return Promise.resolve({}); },
  setDaySnapshot: function () { return Promise.resolve({}); },
} } };
window.fetch = function (path, opts) {
  const p = String(path);
  window.__fetchLog.push(p);
  const J = (v) => Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(v); } });
  if (p.indexOf('/api/player/day') === 0) return J(${JSON.stringify(DAY)});
  if (p.indexOf('/api/prayer/day') === 0) return J(${JSON.stringify(DAY)});
  if (p.indexOf('/api/prayer/mass?') === 0) return J(${JSON.stringify(MASS_PAYLOAD)});
  if (p.indexOf('/api/prayer/mass-readings') === 0) return J(${JSON.stringify(MASS_FEED)});
  if (p.indexOf('/api/player/podcasts') === 0) return J({ ok: true, seriesList: [] });
  if (p.indexOf('/api/exam/today') === 0) return J({ ok: true, run: null, categories: [], prompts: [], focusCategory: null });
  return J({ ok: true });
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

let PAGE = '', PAGE_BASE = '', PAGE_RED = '', PAGE_GREEN = '';
const server = http.createServer((req, res) => {
  const u = (req.url || '/').split('?')[0];
  const map = { '/v496': PAGE, '/base': PAGE_BASE, '/red': PAGE_RED, '/green': PAGE_GREEN };
  if (map[u]) { res.setHeader('Content-Type', 'text/html'); res.end(map[u]); return; }
  res.statusCode = 404; res.end('not found');
});
PAGE = buildPage(COOKED, APP_CSS, LIT_WHITE);
PAGE_BASE = buildPage(COOKED_BASE, APP_CSS_BASE, LIT_WHITE);
PAGE_RED = buildPage(COOKED, APP_CSS, LIT_RED);
PAGE_GREEN = buildPage(COOKED, APP_CSS, LIT_GREEN);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });

const READ = () => {
  const de = document.documentElement;
  const active = document.querySelector('#tabbar .tab.active');
  return {
    tab: active ? active.getAttribute('data-tab') : null,
    dataLit: de.getAttribute('data-lit'),
    barSolid: getComputedStyle(de).getPropertyValue('--bar-solid').trim(),
    litdayText: (document.getElementById('litday') || {}).textContent || null,
    fetchLog: window.__fetchLog.slice(),
    bridge: window.__bridge.slice(),
    hasMassScroll: !!document.querySelector('.mass-scroll'),
    hasOpenBlock: !!document.querySelector('[data-openblock]'),
    dayPayloadSet: !!state.dayPayload,
  };
};

async function boot(which, storedTab, errs, tag) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (storedTab) await ctx.addInitScript((t) => { try { localStorage.setItem('opn-lasttab-v492', t); } catch (e) {} }, storedTab);
  const page = await ctx.newPage();
  await ctx.route('**/*', (route) => { if (route.request().url().startsWith(ORIGIN)) route.continue(); else route.abort(); });
  page.on('pageerror', (e) => { errs.push(String(e).slice(0, 160)); console.log('note -', tag, 'pageerror:', String(e).slice(0, 140)); });
  await page.goto(ORIGIN + which);
  await sleep(1600);
  return { ctx, page };
}

/* ---------------- (a) cold boot onto Mass, white day ---------------- */
let prayFlow = null;
{
  const errs = [];
  const { ctx, page } = await boot('/v496', null, errs, 'a-cold');
  const r = await page.evaluate(READ);
  console.log('COLD BOOT:', JSON.stringify(r));
  ok(r.tab === 'mass', 'A1: a cold boot opens on Mass (the v492 rule stands)', r.tab);
  ok(r.hasMassScroll, 'A2: the Mass first load paints its scroll');
  ok(r.dataLit === 'white', 'A3: data-lit carries the day color at boot onto Mass', String(r.dataLit));
  ok(r.barSolid === '#f3e9cf', 'A4: the header --bar-solid is the white theme, not the navy default', r.barSolid);
  ok(r.litdayText === LIT_WHITE.name, 'A5: the header carries the day name at first load', String(r.litdayText));
  ok(r.bridge.some((b) => b.m === 'setStatusBarColor' && b.color === '#f3e9cf'),
    'A6: the OraDayBridge receives the day color at boot (the time/status bar follows)', JSON.stringify(r.bridge));
  ok(r.fetchLog.some((p) => p.indexOf('/api/prayer/day') === 0), 'A7: the boot itself fetched the day record (the fix feed)', JSON.stringify(r.fetchLog));
  ok(errs.length === 0, 'F1: cold boot clean — no page errors', errs.join(' ; '));
  prayFlow = { ctx, page, errs };
}

/* ---------------- (d) the Pray surface after the boot ---------------- */
{
  const { page, errs } = prayFlow;
  const before = await page.evaluate(() => window.__fetchLog.length);
  await page.click('#tabbar .tab[data-tab="prayers"]');
  await page.waitForSelector('[data-openblock]', { timeout: 20000 }).catch(() => console.log('note - d: openblock slow'));
  await sleep(700);
  const r = await page.evaluate(READ);
  console.log('PRAY OPEN:', JSON.stringify(r));
  ok(r.hasOpenBlock && r.dayPayloadSet, 'D1: the Pray tab paints the day content as before (blocks stand, the day payload settles)');
  ok(r.fetchLog.slice(before).some((p) => p.indexOf('/api/player/day') === 0), 'D2: the Pray paint fetched /api/player/day at its open, as before');
  ok(r.dataLit === 'white' && r.barSolid === '#f3e9cf', 'D3: the day color still stands after the Pray paint (no regression, no flicker back)');
  ok(errs.length === 0, 'D4: no page errors across the boot + Pray flow', errs.join(' ; '));
  await prayFlow.ctx.close();
}

/* ---------------- (b) boot onto each stored tab ---------------- */
for (const stored of ['mass', 'prayers', 'conscience', 'podcasts', 'wallpaper']) {
  const errs = [];
  const { ctx, page } = await boot('/v496', stored, errs, 'b-' + stored);
  const r = await page.evaluate(READ);
  console.log('STORED BOOT', stored, ':', JSON.stringify({ tab: r.tab, dataLit: r.dataLit, barSolid: r.barSolid }));
  ok(r.tab === stored, 'B-' + stored + '1: the boot opens on the remembered tab', r.tab);
  ok(r.dataLit === 'white' && r.barSolid === '#f3e9cf', 'B-' + stored + '2: the day color applies at boot onto ' + stored, String(r.dataLit) + ' / ' + r.barSolid);
  await ctx.close();
}

/* ---------------- (c) red + green days at cold boot ---------------- */
for (const [which, lit, solid] of [['/red', LIT_RED, '#5d1616'], ['/green', LIT_GREEN, '#173a22']]) {
  const errs = [];
  const { ctx, page } = await boot(which, null, errs, 'c-' + lit.color);
  const r = await page.evaluate(READ);
  console.log('COLD BOOT', lit.color, ':', JSON.stringify({ dataLit: r.dataLit, barSolid: r.barSolid, litdayText: r.litdayText }));
  ok(r.tab === 'mass' && r.dataLit === lit.color && r.barSolid === solid,
    'C-' + lit.color + '1: a ' + lit.color + ' day applies its color at a cold boot onto Mass', String(r.dataLit) + ' / ' + r.barSolid);
  ok(r.litdayText === lit.name && r.bridge.some((b) => b.m === 'setStatusBarColor' && b.color === solid),
    'C-' + lit.color + '2: the day name stands and the bridge receives ' + solid, String(r.litdayText));
  await ctx.close();
}

/* ---------------- (e) identity outside the fix ---------------- */
{
  const errs = [];
  const a = await boot('/v496', null, errs, 'e-new');
  await a.page.waitForSelector('.mass-scroll', { timeout: 15000 }).catch(() => console.log('note - e: new scroll slow'));
  const b = await boot('/base', null, errs, 'e-base');
  // the base (v495 ship) boots under its own rule; open Mass on it
  if (!(await b.page.evaluate(() => !!document.querySelector('.mass-scroll')))) {
    await b.page.click('#tabbar .tab[data-tab="mass"]');
    await b.page.waitForSelector('.mass-scroll', { timeout: 15000 }).catch(() => console.log('note - e: base scroll slow'));
    await sleep(500);
  }
  const hNew = await a.page.evaluate(() => { const s = document.querySelector('.mass-scroll'); return s ? s.outerHTML : null; });
  const hBase = await b.page.evaluate(() => { const s = document.querySelector('.mass-scroll'); return s ? s.outerHTML : null; });
  ok(hNew && hBase && hNew === hBase, 'E1: the Mass scroll renders byte-identical to the v495 ship');
  const navNew = await a.page.evaluate(() => Array.from(document.querySelectorAll('#tabbar .tab')).map((t) => t.getAttribute('data-tab') + ':' + t.textContent.trim()).join('|'));
  const navBase = await b.page.evaluate(() => Array.from(document.querySelectorAll('#tabbar .tab')).map((t) => t.getAttribute('data-tab') + ':' + t.textContent.trim()).join('|'));
  ok(navNew === navBase, 'E2: the bottom nav (order + labels) is identical to the v495 ship', navNew);
  await a.ctx.close(); await b.ctx.close();
}

await browser.close();
server.close();
if (!PROBE) {
  console.log('harness-v496:', pass + ' ok / ' + fail + ' not-ok');
  if (failures.length) console.log('failures:', failures.join(' | '));
  process.exit(fail ? 1 : 0);
}
