// harness-v544.mjs — v544 evidence: the Mass tab renames
// to WORSHIP (label only) and a third side, Adoration,
// joins it with five perpetual adoration live streams
// (John's approval of scope package 47, Ora thread
// 2026-11-19 20:48 CT, decisions all A; Lourdes Grotto
// struck at approval — its id stands nowhere in the tree).
//   S statics: index.ts / mass.ts / mass-calendar.ts /
//     mass-order.ts / mass-readings.ts / logo.ts /
//     logo512.ts byte-identical to the v543-ship
//     production base · ui.ts differs from the base on
//     exactly one line (the mass nav button: monstrance
//     SVG + Worship) and the SW pin stands unmoved on the
//     build tree · the MASS_VIRTUAL_ENTRIES table stands
//     byte-identical · the struck id dAlpZ6pE9F0 is absent
//     from every source · each kept stream id stands
//     exactly once · no migration past 0040
//   C client (the v523 Chromium mold, stubbed fetch):
//     N1 the nav's first button reads Worship under an
//     inline SVG and a cold open stands on it · P1 the
//     side pill reads Lectionary · Virtual Mass ·
//     Adoration with Lectionary standing · L1 the
//     Lectionary scroll paints the base's section
//     sequence · V1 the Virtual side stands as on the
//     base (the three recorded-Mass entries) · A1 the
//     Adoration side paints the five entries in the
//     approved order · A2 a tap on Shalom opens its
//     stream page (Worship back bar, the entry's title,
//     the embed frame) and the back act returns to the
//     list with the frame destroyed · A3 each entry
//     opens its own verified embed id · M1 the universal
//     menu names the section Worship and its standing
//     group lists the three sides in order · B1
//     podSeriesDest reads Worship while a series stands
//     homed under the tab (Catechesis in its own home)
//   G439 (recorded as-is, NEVER a v544 pass): the
//     standing v439 boot gate at its standing reading
// Fixtures (Improvement D), from production: the
// MASS_CALENDAR entry for 2026-11-17 in the standing
// fixtures-v523 capture (verbatim from the production
// mass-calendar.ts) and the standing live day fixture
// tests/fixtures-v522/day-live-2026-11-17.json (drawn
// from production through the prayer door). The stream
// ids are the live oEmbed resolutions recorded in the
// release document §1 (re-verified at build, 2026-11-19
// ~20:56 CT). The base for byte comparisons and the
// comparison page is the production ship tree,
// release/v543-ship @ 3894e70 (Worker 0c8381da, pin
// ora-pro-nobis-v543-1; H544_BASE overrides).
// Run: node app/tests/harness-v544.mjs [--probe] (from
// the worktree root). --probe only prints.
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const PROBE = process.argv.includes('--probe');
const ROOT = process.cwd();
const APP = path.resolve(ROOT, 'app');
const SRC = APP + '/worker/src';
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const I_SRC = readFileSync(SRC + '/index.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const BASE = process.env.H544_BASE || path.resolve(ROOT, '../../.worktrees/v543-ship/app/worker/src');
const C_BASE = readFileSync(BASE + '/client.ts', 'utf8');
const U_BASE = readFileSync(BASE + '/ui.ts', 'utf8');
const FX = APP + '/tests/fixtures-v523';
const SHORT = JSON.parse(readFileSync(FX + '/mass-calendar-2026-11-17.json', 'utf8'));
const DAY = JSON.parse(readFileSync(APP + '/tests/fixtures-v522/day-live-2026-11-17.json', 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (PROBE) { console.log('probe -', label, extra ? ' :: ' + extra : ''); return; }
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}

const STREAMS = [
  { key: 'shalom', title: 'Shalom World Prayer Chapel', meta: 'Shalom World', video: 'GlGkFWPKomU' },
  { key: 'ewtn', title: 'EWTN Adoration', meta: 'Irondale & Niepokalan\u00f3w', video: 'GBns1m4S1Xk' },
  { key: 'birmingham', title: 'Our Lady of Sorrows', meta: 'Birmingham \u00b7 Adorecast', video: 'am72_e-h9d8' },
  { key: 'vilnius', title: 'Shrine of Divine Mercy', meta: 'Vilnius', video: 'Upqned9fiMg' },
  { key: 'tyburn', title: 'Tyburn Convent', meta: 'London', video: 'S3CU6rSx1aE' },
];

/* ---------------- S: statics ---------------- */
{
  for (const f of ['index.ts', 'mass.ts', 'mass-calendar.ts', 'mass-order.ts', 'mass-readings.ts', 'logo.ts', 'logo512.ts']) {
    ok(readFileSync(SRC + '/' + f, 'utf8') === readFileSync(BASE + '/' + f, 'utf8'),
      'S1-' + f + ': byte-identical to the v543-ship production base');
  }
  const uLines = U_SRC.split('\n'), bLines = U_BASE.split('\n');
  ok(uLines.length === bLines.length, 'S2a: ui.ts carries the base\'s line count (one line changed, none added)');
  const diffIdx = [];
  for (let i = 0; i < uLines.length; i++) if (uLines[i] !== bLines[i]) diffIdx.push(i);
  ok(diffIdx.length === 1 && uLines[diffIdx[0]].includes('data-tab="mass"'),
    'S2b: ui.ts differs from the base on exactly one line — the mass nav button', 'diff lines: ' + diffIdx.join(','));
  ok(diffIdx.length === 1 && uLines[diffIdx[0]].includes('<svg') && uLines[diffIdx[0]].includes('<span>Worship</span>') && !uLines[diffIdx[0]].includes('&#10016;'),
    'S2c: the changed line carries the monstrance inline SVG and the Worship label, the old glyph gone');
  ok(U_SRC.includes('ora-pro-nobis-v543-1') && !U_SRC.includes('ora-pro-nobis-v544-1'),
    'S2d: the SW pin stands at v543-1 on the build tree (it moves only at Ship)');
  const vent = (src) => src.slice(src.indexOf('var MASS_VIRTUAL_ENTRIES'), src.indexOf('];', src.indexOf('var MASS_VIRTUAL_ENTRIES')) + 2);
  ok(vent(C_SRC) === vent(C_BASE), 'S3a: the MASS_VIRTUAL_ENTRIES table stands byte-identical to the base (the Virtual side untouched)');
  for (const f of ['client.ts', 'ui.ts', 'index.ts']) {
    ok(!readFileSync(SRC + '/' + f, 'utf8').includes('dAlpZ6pE9F0'),
      'S3b-' + f + ': the struck Lourdes Grotto id (dAlpZ6pE9F0) stands nowhere in ' + f);
  }
  for (const s of STREAMS) {
    ok((C_SRC.match(new RegExp(s.video, 'g')) || []).length === 1,
      'S3c-' + s.key + ': the stream id ' + s.video + ' stands exactly once in client.ts');
  }
  ok(C_SRC.includes("[['liturgy', 'Lectionary'], ['virtual', 'Virtual Mass'], ['adoration', 'Adoration']]"),
    'S3d: the tab sides read Lectionary · Virtual Mass · Adoration in the side config and the menu group');
  ok(C_SRC.includes("if (massPodReturn) return 'Worship';") && C_SRC.includes("mass: 'Worship'") && C_SRC.includes("{ key: 'mass', tab: 'mass', name: 'Worship' }"),
    'S3e: the tab name follows the rename at podSeriesDest, the Settings origin map, and the menu section list');
  const migs = readdirSync(APP + '/migrations').filter((f) => /^\d{4}/.test(f)).sort();
  ok(migs[migs.length - 1].startsWith('0040'), 'S4: no migration past 0040 stands', migs[migs.length - 1]);
}

/* ---------------- fixtures + pages ---------------- */
function cook(src) {
  const t = src.indexOf('APP_JS = `') + 10;
  return new Function('return `' + src.slice(t, src.indexOf('`;', t)) + '`')();
}
let COOKED = null, COOKED_BASE = null;
try { COOKED = cook(C_SRC); ok(true, 'P0: the cooked APP_JS parses (the template-literal gate)'); }
catch (e) { ok(false, 'P0: the cooked APP_JS parses (the template-literal gate)', String(e).slice(0, 160)); }
try { COOKED_BASE = cook(C_BASE); } catch (e) { console.log('note - base cook failed:', String(e).slice(0, 120)); }
const APP_CSS = U_SRC.slice(U_SRC.indexOf('APP_CSS = `') + 11, U_SRC.indexOf('`;', U_SRC.indexOf('APP_CSS = `')));
const APP_CSS_BASE = U_BASE.slice(U_BASE.indexOf('APP_CSS = `') + 11, U_BASE.indexOf('`;', U_BASE.indexOf('APP_CSS = `')));
const SHELL = U_SRC.slice(U_SRC.indexOf('SHELL_HTML = `') + 14, U_SRC.indexOf('`;', U_SRC.indexOf('SHELL_HTML = `')));
const SHELL_BASE = U_BASE.slice(U_BASE.indexOf('SHELL_HTML = `') + 14, U_BASE.indexOf('`;', U_BASE.indexOf('SHELL_HTML = `')));

function formulary(key) {
  return {
    entranceAntiphon: { text: 'Antiphon for ' + key + '.', ref: 'Ps 1' },
    collect: 'Collect of the ' + key + ' formulary, granted for this harness day.',
    prayerOverOfferings: 'Offerings of the ' + key + ' formulary.',
    prefaceText: null, prefaceName: null,
    communionAntiphon: { text: 'Communion antiphon for ' + key + '.', ref: 'Mt 5' },
    prayerAfterCommunion: 'After Communion of the ' + key + ' formulary.',
  };
}
const PAYLOAD = {
  ok: true, name: SHORT.name, season: 'Ordinary Time',
  defaultVersion: SHORT.defaultVersion,
  versions: SHORT.versions.map((v) => ({ key: v.key, label: v.label, rank: v.rank, formulary: formulary(v.key) })),
};
const MASS_FEED = { ok: true, found: true, parts: [
  { key: 'r1', heading: 'First Reading', source: 'Rev 3:1-6, 14-22', html: '<p>I, John, heard the Lord saying to me.</p>' },
  { key: 'ps', heading: 'Responsorial Psalm', source: 'Ps 15:2-3a, 3bc-4ab, 5', html: '<p>R. I will seat the victor beside me on my throne.</p><p>He who walks blamelessly and does justice.</p>' },
  { key: 'ga', heading: 'Gospel Acclamation', source: '1 Jn 4:10b', html: '<p>R. Alleluia, alleluia.</p><p>God loved us, and sent his Son as expiation for our sins.</p><p>R. Alleluia, alleluia.</p>' },
  { key: 'g', heading: 'Gospel', source: 'Lk 19:1-10', html: '<p>At that time Jesus came to Jericho and intended to pass through the town.</p>' },
] };

function buildPage(cooked, css, shell) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body data-lit="">
<audio id="audio"></audio>
${shell}
<script>
window.fetch = function (path, opts) {
  const p = String(path);
  const ans = function (status, body) { return Promise.resolve({ ok: status < 400, status: status, json: function () { return Promise.resolve(body); } }); };
  if (p.indexOf('/api/player/day') === 0) return ans(200, ${JSON.stringify(DAY)});
  if (p.indexOf('/api/prayer/mass?') === 0) return ans(200, ${JSON.stringify(PAYLOAD)});
  if (p.indexOf('/api/prayer/mass-readings') === 0) return ans(200, ${JSON.stringify(MASS_FEED)});
  if (p.indexOf('/api/prayer/book') === 0) return ans(200, { ok: true, groups: [] });
  if (p.indexOf('/api/prayer/mass-personal-prayer') === 0) return ans(200, { ok: true, before: [], after: [], afterMass: [], preMass: [] });
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
  '/build': buildPage(COOKED, APP_CSS, SHELL),
  '/base': buildPage(COOKED_BASE, APP_CSS_BASE, SHELL_BASE),
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
  await sleep(300);
  return { ctx, page };
}

const massFacts = (page) => page.evaluate(() => {
  const navBtn = document.querySelector('#tabbar .tab[data-tab="mass"]');
  const pill = Array.from(document.querySelectorAll('#sidetoggle [data-side]')).map((b) => ({ side: b.getAttribute('data-side'), text: b.textContent.trim(), active: b.classList.contains('active') }));
  const scroll = document.querySelector('.mass-scroll');
  return {
    navText: navBtn ? navBtn.textContent.trim() : null,
    navActive: navBtn ? navBtn.classList.contains('active') : false,
    navSvg: navBtn ? !!navBtn.querySelector('.tabicon svg') : false,
    navFirst: document.querySelector('#tabbar .tab') === navBtn,
    pill,
    hdr2: (document.getElementById('hdr2-title') || {}).textContent || null,
    sections: scroll ? Array.from(scroll.querySelectorAll('.mass-section')).map((s) => s.textContent.trim()) : null,
  };
});

/* ---------------- base comparison facts ---------------- */
let baseFacts = null, baseVirtual = null;
{
  const errs = [];
  const { ctx, page } = await boot('/base', errs, 'base');
  baseFacts = await massFacts(page);
  await page.click('#sidetoggle [data-side="virtual"]');
  await sleep(400);
  baseVirtual = await page.evaluate(() => Array.from(document.querySelectorAll('[data-massventry]')).map((c) => ({
    key: c.getAttribute('data-massventry'),
    title: (c.querySelector('h3') || {}).textContent || null,
  })));
  ok(errs.length === 0, 'P6: the base boot carries no page errors', errs.join(' · '));
  await ctx.close();
}

/* ---------------- C: the build ---------------- */
{
  const errs = [];
  const { ctx, page } = await boot('/build', errs, 'build');
  ok(errs.length === 0, 'C0: boot clean — no page errors on the build page', errs.join(' · '));
  const f = await massFacts(page);
  ok(f.navFirst && f.navText === 'Worship' && f.navSvg,
    'N1: the nav\'s first button reads Worship under an inline SVG icon (the monstrance)', 'nav: ' + f.navText + ' · svg ' + f.navSvg);
  ok(f.navActive, 'N1b: a cold open stands on the Worship tab');
  ok(JSON.stringify(f.pill.map((p) => p.text)) === JSON.stringify(['Lectionary', 'Virtual Mass', 'Adoration'])
    && JSON.stringify(f.pill.map((p) => p.side)) === JSON.stringify(['liturgy', 'virtual', 'adoration'])
    && f.pill[0].active && f.hdr2 === 'Lectionary',
    'P1: the side pill reads Lectionary · Virtual Mass · Adoration in order, Lectionary standing, the row-2 title Lectionary',
    JSON.stringify(f.pill));
  ok(!!f.sections && JSON.stringify(f.sections) === JSON.stringify(baseFacts.sections),
    'L1: the Lectionary side paints the day\'s scroll with the base\'s section sequence', (f.sections || []).join(' · '));

  /* V1: the Virtual side as on the base */
  await page.click('#sidetoggle [data-side="virtual"]');
  await sleep(400);
  const virt = await page.evaluate(() => ({
    hdr2: (document.getElementById('hdr2-title') || {}).textContent || null,
    entries: Array.from(document.querySelectorAll('[data-massventry]')).map((c) => ({
      key: c.getAttribute('data-massventry'),
      title: (c.querySelector('h3') || {}).textContent || null,
    })),
  }));
  ok(virt.hdr2 === 'Virtual Mass' && JSON.stringify(virt.entries) === JSON.stringify(baseVirtual),
    'V1: the Virtual side stands as on the base — the three recorded-Mass entries, the side name unchanged', JSON.stringify(virt.entries));

  /* A1: the Adoration side */
  await page.click('#sidetoggle [data-side="adoration"]');
  await sleep(400);
  const ad = await page.evaluate(() => ({
    hdr2: (document.getElementById('hdr2-title') || {}).textContent || null,
    entries: Array.from(document.querySelectorAll('[data-massadentry]')).map((c) => ({
      key: c.getAttribute('data-massadentry'),
      title: (c.querySelector('h3') || {}).textContent || null,
      meta: (c.querySelector('.meta') || {}).textContent || null,
    })),
  }));
  ok(ad.hdr2 === 'Adoration' && JSON.stringify(ad.entries) === JSON.stringify(STREAMS.map((s) => ({ key: s.key, title: s.title, meta: s.meta }))),
    'A1: the Adoration side paints the five entries in the approved order with their titles and metas', JSON.stringify(ad.entries));

  /* A2 + A3: each entry opens its own stream page; the back act returns */
  for (const s of STREAMS) {
    await page.click('[data-massadentry="' + s.key + '"]');
    await sleep(400);
    const w = await page.evaluate(() => {
      const fr = document.querySelector('#view iframe.podwatch-frame') || document.querySelector('iframe.podwatch-frame');
      const back = document.querySelector('[data-adorationback]');
      return {
        src: fr ? fr.getAttribute('src') : null,
        dest: back ? (back.querySelector('.hdr2-name') || {}).textContent || null : null,
        title: (document.getElementById('hdr2-title') || {}).textContent || null,
      };
    });
    ok(w.src === 'https://www.youtube.com/embed/' + s.video + '?autoplay=1&rel=0' && w.dest === 'Worship' && w.title === s.title,
      'A-' + s.key + ': the stream page stands — the Worship back bar, the entry\'s title, the frame on embed/' + s.video,
      JSON.stringify(w));
    await page.click('[data-adorationback]');
    await sleep(400);
    const back = await page.evaluate(() => ({
      frames: document.querySelectorAll('iframe.podwatch-frame').length,
      entries: document.querySelectorAll('[data-massadentry]').length,
      hdr2: (document.getElementById('hdr2-title') || {}).textContent || null,
    }));
    ok(back.frames === 0 && back.entries === 5 && back.hdr2 === 'Adoration',
      'A-back-' + s.key + ': the back act returns to the Adoration list with the frame destroyed', JSON.stringify(back));
  }

  /* M1: the universal menu */
  await page.click('#hdr-menu');
  await sleep(500);
  const menu = await page.evaluate(() => {
    const card = document.querySelector('.anchmenu');
    return card ? card.textContent.replace(/\s+/g, ' ') : null;
  });
  ok(!!menu && menu.includes('Worship'), 'M1a: the universal menu names the section Worship', (menu || '').slice(0, 120));
  ok(!!menu && menu.indexOf('Lectionary') > -1 && menu.indexOf('Lectionary') < menu.indexOf('Virtual Mass') && menu.indexOf('Virtual Mass') < menu.indexOf('Adoration'),
    'M1b: the standing group lists Lectionary · Virtual Mass · Adoration in order');
  await page.keyboard.press('Escape').catch(() => {});
  await page.evaluate(() => { document.querySelectorAll('.anchmenu, .menucatcher').forEach((n) => n.remove()); });

  /* B1: podSeriesDest follows the label */
  const dest = await page.evaluate(() => {
    const keep = massPodReturn;
    massPodReturn = true;
    const homed = podSeriesDest();
    massPodReturn = false;
    const own = podSeriesDest();
    massPodReturn = keep;
    return { homed, own };
  });
  ok(dest.homed === 'Worship' && dest.own === 'Catechesis',
    'B1: a series page homed under the tab reads its back dest as Worship (its Catechesis home unchanged)', JSON.stringify(dest));

  ok(errs.length === 0, 'C4: the build page carries no page errors after the side switches and stream opens', errs.join(' · '));
  await ctx.close();
}

/* ---------------- G439: the standing gate, as-is ---------------- */
{
  let out = '';
  try {
    out = execFileSync('node', [APP + '/tests/harness-v439.mjs'], { cwd: ROOT, timeout: 300000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { out = String(e.stdout || '') + String(e.stderr || ''); }
  const mm = out.match(/harness-v439: (\d+) ok \/ (\d+) not-ok/);
  ok(!!mm && +mm[1] === 13 && +mm[2] === 2,
    'G439 (recorded as-is, not a v544 pass): the standing v439 boot gate reads its standing 13 ok / 2 not-ok on this tree',
    mm ? mm[0] : 'no summary line in the gate output');
}

await browser.close();
server.close();
console.log('\nharness-v544: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) { console.log('failures: ' + failures.join(' · ')); process.exit(1); }
