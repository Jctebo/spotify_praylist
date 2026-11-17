// harness-v492.mjs — v492 evidence: bottom nav reorder + renames.
// John's order (Ora thread, 2026-11-17 07:00 CT): the bottom nav
// becomes Mass · Pray · Conscience · Catechesis · Sacred Art —
// Pray renamed from Praylist, Catechesis renamed from Formation.
// Visible labels and order only (the v438 precedent): tab ids,
// routes, storage keys, and data do not move.
// Legs (real SHELL_HTML + APP_CSS + cooked client in Chromium,
// the v439/v478 mold; fetch stubbed):
//   S   statics — the bar's order + labels in the shell · the
//       settled rename seats stand and the old seat strings are
//       gone · the Mass render path byte-identical to the
//       v491 ship tree · mass sources + index.ts untouched ·
//       ui.ts differs from v491-ship only in the tab bar ·
//       internal keys (data-tab, tab-side storage keys, the
//       block value 'Podcasts') unchanged
//   P   cooked parse + Chromium boot clean
//   R   runtime — the bar renders five tabs in order with the
//       new labels · the opening tab is EXPECTED_OPEN · the
//       in-tab pill's first side reads EXPECTED_PILL (the two
//       constants below are set from John's answers to the two
//       open details, recorded in the release doc) · every tab
//       still opens its standing surface · a persisted tab-side
//       value from before the rename lands on the same surface
//       · the header Go to menu names the places by their new
//       names · the dock menu still carries Exit player last
//       and exit still hides the dock · blockDisplayName maps
//       'Podcasts' to 'Catechesis' and passes others through
// Run: node app/tests/harness-v492.mjs   (from the worktree root)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

/* John's answers to the two open details (main chat, 2026-11-17
   07:18 CT, verbatim): "Open on Mass, pill.keeps.praylist. In
   general open to last user opened"
   (a) the pill keeps Praylist — EXPECTED_PILL (the standing value)
   (b) a cold start opens on Mass — EXPECTED_OPEN — and in general
       the app opens on the last tab the user opened
       (opn-lasttab-v492, written by setTab; R15/R16 prove the
       remembered value wins and a foreign value falls back) */
const EXPECTED_PILL = 'Praylist';
const EXPECTED_OPEN = 'mass';

const APP = path.resolve(process.cwd(), 'app');
const SRC = APP + '/worker/src';
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const SHIP = path.resolve(process.cwd(), '../../.worktrees/v491-ship/app/worker/src');
const C491 = readFileSync(SHIP + '/client.ts', 'utf8');
const U491 = readFileSync(SHIP + '/ui.ts', 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}

/* ---------------- S: statics ---------------- */
{
  const nav = U_SRC.slice(U_SRC.indexOf('<nav class="tabbar"'), U_SRC.indexOf('</nav>'));
  const tabs = [...nav.matchAll(/data-tab="(\w+)"[^>]*>.*?<span>([^<]+)<\/span>/g)].map((m) => [m[1], m[2]]);
  ok(JSON.stringify(tabs.map((t) => t[0])) === JSON.stringify(['mass', 'prayers', 'conscience', 'podcasts', 'wallpaper']),
    'S1: the shell tab bar order is mass · prayers · conscience · podcasts · wallpaper (ids unchanged)', JSON.stringify(tabs));
  ok(JSON.stringify(tabs.map((t) => t[1])) === JSON.stringify(['Mass', 'Pray', 'Conscience', 'Catechesis', 'Sacred Art']),
    'S2: the shell tab bar labels are Mass · Pray · Conscience · Catechesis · Sacred Art', JSON.stringify(tabs));

  const stands = [
    "title = 'Catechesis';", "Catechesis did not load.", "dest: 'Catechesis'",
    "var BLOCK_DISPLAY_NAMES = { 'Podcasts': 'Catechesis' };",
    "items.push({ head: true, label: 'Catechesis' });",
    "{ key: 'podcasts', tab: 'podcasts', name: 'Catechesis' }",
    "dest: 'Pray', title: 'Settings'", "items.push({ head: true, label: 'Pray' });",
    "{ key: 'prayers', tab: 'prayers', name: 'Pray' }",
    '<h1 class="screen">Pray</h1>', "hdrBarHtml({ dest: 'Pray', title: p.title",
    "hdrBarHtml({ dest: 'Pray', title: b.label || b.block",
  ];
  ok(stands.every((s) => C_SRC.includes(s)), 'S3: every settled rename seat carries the new name');
  const gone = [
    "dest: 'Formation'", "name: 'Formation'", "label: 'Formation'", "title = 'Formation'",
    'Formation did not load', "{ 'Podcasts': 'Formation' }",
    "dest: 'Praylist'", "name: 'Praylist'", "label: 'Praylist'", '<h1 class="screen">Praylist</h1>',
  ];
  ok(gone.every((s) => !C_SRC.includes(s)), 'S4: no settled seat still carries an old place name');

  const mStart = C_SRC.indexOf('v486: the Mass tab');
  const mEnd = C_SRC.indexOf("document.querySelectorAll('#tabbar .tab')", mStart);
  const mStart491 = C491.indexOf('v486: the Mass tab');
  const mEnd491 = C491.indexOf("document.querySelectorAll('#tabbar .tab')", mStart491);
  ok(mStart > 0 && C_SRC.slice(mStart, mEnd) === C491.slice(mStart491, mEnd491),
    'S5: the Mass render path is byte-identical to the v491 ship tree');
  let same = true;
  for (const f of ['mass.ts', 'mass-order.ts', 'mass-readings.ts', 'mass-calendar.ts', 'index.ts']) {
    if (readFileSync(SRC + '/' + f, 'utf8') !== readFileSync(SHIP + '/' + f, 'utf8')) same = false;
  }
  ok(same, 'S6: mass.ts / mass-order.ts / mass-readings.ts / mass-calendar.ts / index.ts byte-identical to v491 ship');
  const a = U_SRC.split('\n'), b = U491.split('\n');
  let diffLines = 0, diffOutsideNav = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) { diffLines++; if (!/data-tab|tabpill/.test(a[i] || '') && !/data-tab|tabpill/.test(b[i] || '')) diffOutsideNav++; }
  }
  ok(diffLines > 0 && diffOutsideNav === 0, 'S7: ui.ts differs from v491 ship only in the tab bar lines', 'diffLines=' + diffLines + ' outside=' + diffOutsideNav);
  ok(C_SRC.includes("var TAB_SIDE_PRAYERS_KEY = 'opn-tabside-prayers-v410';")
    && C_SRC.includes("var TAB_SIDE_PODCASTS_KEY = 'opn-tabside-podcasts-v464';")
    && C_SRC.includes("var TAB_SIDE_WALLPAPER_KEY = 'opn-tabside-wallpaper-v414';"),
    'S8: the tab-side storage keys are unchanged (persisted sides land by construction)');
}

/* ---------------- fixtures + page ---------------- */
const TPL_A = C_SRC.indexOf('APP_JS = `') + 10;
let COOKED = null;
try { COOKED = new Function('return `' + C_SRC.slice(TPL_A, C_SRC.indexOf('`;', TPL_A)) + '`')(); ok(true, 'P1: the cooked APP_JS parses (the v439 gate)'); }
catch (e) { ok(false, 'P1: the cooked APP_JS parses (the v439 gate)', String(e).slice(0, 160)); }
const APP_CSS = U_SRC.slice(U_SRC.indexOf('APP_CSS = `') + 11, U_SRC.indexOf('`;', U_SRC.indexOf('APP_CSS = `')));
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
const POD_INDEX = { ok: true, seriesList: [
  { series: 'catechism', title: 'Catechism in a Year', kind: 'spotify', category: 'podcasts', available: true, listenedCount: 0, total: 2, currentLabel: 'Day 1', showImageUrl: '' },
]};
const MASS = { ok: true, name: 'Memorial of Saint Elizabeth of Hungary, Religious', season: 'Ordinary Time',
  versions: [{ key: 'memorial', label: 'Saint Elizabeth of Hungary', rank: 'M', formulary: {} }], defaultVersion: 'memorial' };

function buildPage() {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${APP_CSS}</style></head>
<body data-lit="">
<audio id="audio"></audio>
${SHELL}
<script>
window.__fetchLog = [];
window.fetch = function (path, opts) {
  const p = String(path);
  const method = (opts && opts.method) || 'GET';
  let body = null;
  try { body = opts && opts.body ? JSON.parse(opts.body) : null; } catch (e) {}
  window.__fetchLog.push({ path: p, method: method, body: body });
  if (p.indexOf('/api/player/day') === 0) return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(${JSON.stringify(DAY)}); } });
  if (p.indexOf('/api/prayer/mass-readings') === 0) return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true, parts: {}, acks: [] }); } });
  if (p.indexOf('/api/prayer/mass') === 0) return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(${JSON.stringify(MASS)}); } });
  if (p.indexOf('/api/player/podcasts') === 0) return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(${JSON.stringify(POD_INDEX)}); } });
  return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true }); } });
};
function extFetchText(url) { return Promise.reject(new Error('offline')); }
URL.createObjectURL = function () { return 'blob:fake'; };
URL.revokeObjectURL = function () {};
HTMLMediaElement.prototype.play = function () { const el = this; setTimeout(function(){ el.dispatchEvent(new Event('play')); }, 10); return Promise.resolve(); };
HTMLMediaElement.prototype.pause = function () { this.dispatchEvent(new Event('pause')); };
HTMLMediaElement.prototype.load = function () {};
</` + `script>
<script>
${COOKED}
</` + `script>
</body></html>`;
}

const PAGE = buildPage();
const server = http.createServer((req, res) => {
  const u = (req.url || '/').split('?')[0];
  if (u === '/') { res.setHeader('Content-Type', 'text/html'); res.end(PAGE); return; }
  res.statusCode = 404; res.end('not found');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });

async function boot(ctx, tag, errs) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { errs.push(String(e).slice(0, 160)); console.log('note -', tag, 'pageerror:', String(e).slice(0, 140)); });
  await page.goto(ORIGIN + '/');
  await page.waitForSelector('#tabbar .tab[data-tab="mass"]', { timeout: 25000 }).catch(() => console.log('note -', tag, 'tabbar slow'));
  await sleep(700);
  return page;
}

/* ---------------- R: runtime ---------------- */
{
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page = await boot(ctx, 'R', errs);
  ok(errs.length === 0, 'P2: Chromium boot clean, no page errors', errs.join(' · '));

  const bar = await page.evaluate(() => Array.from(document.querySelectorAll('#tabbar .tab')).map((b) => { const sp = b.querySelectorAll('span'); return [b.getAttribute('data-tab'), sp[sp.length - 1].textContent.trim()]; }));
  ok(JSON.stringify(bar) === JSON.stringify([['mass', 'Mass'], ['prayers', 'Pray'], ['conscience', 'Conscience'], ['podcasts', 'Catechesis'], ['wallpaper', 'Sacred Art']]),
    'R1: the rendered bar is Mass · Pray · Conscience · Catechesis · Sacred Art, ids in order', JSON.stringify(bar));

  const open = await page.evaluate(() => state.tab);
  ok(open === EXPECTED_OPEN, 'R2: a cold start opens on the chosen tab (' + EXPECTED_OPEN + ')', String(open));

  await page.click('#tabbar .tab[data-tab="prayers"]');
  await sleep(900);
  const pill = await page.evaluate(() => {
    const b = document.querySelector('#sidetoggle [data-side="prayers"]');
    return b ? b.textContent.trim() : null;
  });
  ok(pill === EXPECTED_PILL, 'R3: the in-tab pill first side reads ' + EXPECTED_PILL, String(pill));

  ok(await page.evaluate(() => blockDisplayName('Podcasts') === 'Catechesis' && blockDisplayName('Morning') === 'Morning'),
    'R4: blockDisplayName maps Podcasts → Catechesis and passes other values through');

  // every tab opens its standing surface
  await page.click('#tabbar .tab[data-tab="mass"]');
  await sleep(900);
  let s = await page.evaluate(() => ({ tab: state.tab, mass: !!document.querySelector('.mass-scroll'), row2: (document.getElementById('hdrrow2') || {}).textContent || '' }));
  ok(s.tab === 'mass' && s.mass, 'R5: the Mass tab opens the Mass scroll (first seat, same surface)', JSON.stringify(s));

  await page.click('#tabbar .tab[data-tab="conscience"]');
  await sleep(900);
  s = await page.evaluate(() => ({ tab: state.tab, row2: (document.getElementById('hdrrow2') || {}).textContent || '' }));
  ok(s.tab === 'conscience' && /Conscience/.test(s.row2), 'R6: the Conscience tab opens its surface under its standing name', JSON.stringify(s));
  ok(await page.evaluate(() => localStorage.getItem('opn-lasttab-v492')) === 'conscience',
    'R6b: a tab switch writes the last-opened tab (opn-lasttab-v492)');

  await page.click('#tabbar .tab[data-tab="podcasts"]');
  await sleep(800);
  await page.evaluate(() => { if (typeof switchPodSide === 'function') switchPodSide('podcasts'); });
  await page.waitForSelector('[data-podseries]', { timeout: 10000 }).catch(() => console.log('note - R podseries slow'));
  await sleep(400);
  s = await page.evaluate(() => ({ tab: state.tab, row2: (document.getElementById('hdrrow2') || {}).textContent || '', series: !!document.querySelector('[data-podseries]') }));
  ok(s.tab === 'podcasts' && /Catechesis/.test(s.row2) && s.series, 'R7: the podcasts tab opens its surface, headed Catechesis', JSON.stringify(s));

  await page.click('#tabbar .tab[data-tab="wallpaper"]');
  await sleep(900);
  s = await page.evaluate(() => ({ tab: state.tab, text: (document.getElementById('view') || {}).textContent || '' }));
  ok(s.tab === 'wallpaper' && /Sacred Art/.test(s.text), 'R8: the wallpaper tab opens its surface, named Sacred Art', '');

  await page.click('#tabbar .tab[data-tab="prayers"]');
  await sleep(900);
  s = await page.evaluate(() => ({ tab: state.tab, blocks: !!document.querySelector('[data-openblock]') }));
  ok(s.tab === 'prayers' && s.blocks, 'R9: the Pray tab opens the standing day surface', JSON.stringify(s));

  // header Go to menu names the places by their new names
  await page.click('#hdr-menu');
  await sleep(500);
  const menuText = await page.evaluate(() => (document.querySelector('.anchmenu, .sheetmenu, .menu-sheet') || document.body).textContent);
  ok(/Catechesis/.test(menuText) && !/Praylist|Formation/.test(menuText),
    'R10: the Go to menu carries the new place names and no old ones', menuText.slice(0, 120).replace(/\s+/g, ' '));
  await page.evaluate(() => { const c = document.querySelector('.menucatcher'); if (c) c.click(); });
  await sleep(300);

  // the player + Exit player stand (v491 carry)
  await page.click('[data-openblock="Morning"]');
  await sleep(700);
  await page.evaluate(() => { startQueue(state.dayDescs.filter(function (d) { return d.block === 'Morning'; })); });
  await sleep(700);
  await page.evaluate(() => { openDockMenu(); });
  await sleep(400);
  const labels = await page.evaluate(() => Array.from(document.querySelectorAll('.anchmenu .menurow .grow')).map((n) => n.textContent));
  ok(labels[labels.length - 1] === 'Exit player', 'R11: the dock menu still carries Exit player, last (v491 stands)', labels.join('|'));
  const rows = await page.$$('.anchmenu .menurow');
  await rows[rows.length - 1].click();
  await sleep(600);
  s = await page.evaluate(() => ({ q: state.queue.length, cur: state.current, hidden: document.getElementById('dock').classList.contains('hidden') }));
  ok(s.q === 0 && s.cur === null && s.hidden, 'R12: Exit player still unloads and hides the dock', JSON.stringify(s));
  ok(errs.length === 0, 'R13: no page errors across the tab tour + exit flow', errs.join(' · '));
  await ctx.close();
}

/* ---------------- R-side: a persisted pre-rename side value ---------------- */
{
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('opn-tabside-prayers-v410', 'book'); } catch (e) {} });
  const page = await boot(ctx, 'R-side', errs);
  await page.click('#tabbar .tab[data-tab="prayers"]');
  await sleep(900);
  const s = await page.evaluate(() => ({ tab: state.tab, row2: (document.getElementById('hdrrow2') || {}).textContent || '' }));
  ok(/Prayers/.test(s.row2), 'R14: a pre-rename persisted side value (book) lands on the same written-prayers surface', JSON.stringify(s));
  await ctx.close();
}

/* ---------------- R-open: the remembered last tab wins ---------------- */
{
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('opn-lasttab-v492', 'wallpaper'); } catch (e) {} });
  const page = await boot(ctx, 'R-open', errs);
  const s = await page.evaluate(() => state.tab);
  ok(s === 'wallpaper', 'R15: a remembered last tab (wallpaper) wins over the Mass cold-start default', String(s));
  await ctx.close();
}
{
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('opn-lasttab-v492', 'bogus'); } catch (e) {} });
  const page = await boot(ctx, 'R-open-bad', errs);
  const s = await page.evaluate(() => state.tab);
  ok(s === 'mass', 'R16: a foreign remembered value falls back to the Mass tab', String(s));
  await ctx.close();
}

await browser.close();
server.close();
console.log('\nharness-v492: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) { console.log('failures: ' + failures.join(' · ')); process.exit(1); }
