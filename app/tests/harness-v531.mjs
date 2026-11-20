// harness-v531.mjs — v531 evidence: the v529 field
// failure ("I see those chips but it doesn't change
// readings", John, 2026-11-18) and its fix. The
// diagnosis (release doc §1): v529's serve-time
// memorial pull is rate-blocked in production —
// bible.usccb.org answers bursts of server-side
// fetches with 403 block pages, v529 fanned its pulls
// out concurrently, the memorial rode empty (parts [],
// note null), and the client rendered the ferial set
// under the memorial pick by its own failure posture.
// The harness therefore exercises the LIVE PULL SHAPE,
// not only pre-fetched fixtures — the fixture class
// whose absence let v529 through. The fix: (server)
// sequential, spaced, retried memorial pulls; a
// nothing-parse (no lectionary, no note, no parts —
// the block page's signature) is never cached and
// never merged; (client) a SEPARATE READINGS CHIP
// (John's amendment, 2026-11-18: "I want a seperate
// reading chip") standing with the readings, switching
// the day's sets — Weekday · each memorial — moving
// the readings only, defaulting to the picked
// version's set.
// SUBJECT: a tree carrying the v531 build on the v530
// ship lineage. Run from that worktree's root:
//   node app/tests/harness-v531.mjs [--probe]
// Fixtures (Improvement D — from production, captured
// live 2026-11-18, in app/tests/fixtures-v531):
// - usccb-feed.xml: the REAL USCCB Daily Readings RSS
//   feed, fetched the morning of the build (2026-11-18
//   with both memorial mentions; 2026-11-15 mention-
//   free stands in the window).
// - memorial-dedication.html: the REAL page at the
//   feed's own Dedication link (Lectionary 679).
// - memorial-rose.html: the REAL page at the feed's
//   own Duchesne link (Lectionary 679A, no set).
// - memorial-elizabeth.html: the REAL 2026-11-17 page,
//   drawn live the same morning by the v529 seat.
import { readFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const PROBE = process.argv.includes('--probe');
const ROOT = process.cwd();
const APP = path.resolve(ROOT, 'app');
const SRC = APP + '/worker/src';
const FIX = APP + '/tests/fixtures-v531';
const BASE = path.resolve(ROOT, '../../.worktrees/v530-ship/app/worker/src');
const ESBUILD = '/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild';
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const MR_SRC = readFileSync(SRC + '/mass-readings.ts', 'utf8');
const C_BASE = readFileSync(BASE + '/client.ts', 'utf8');
const U_BASE = readFileSync(BASE + '/ui.ts', 'utf8');
const MR_BASE = readFileSync(BASE + '/mass-readings.ts', 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (PROBE) { console.log('probe -', label, extra ? ' :: ' + extra : ''); return; }
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}

function extractFn(src, name) {
  const at = src.indexOf('function ' + name + '(');
  if (at < 0) return null;
  const open = src.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (!depth) return src.slice(at, i + 1); }
  }
  return null;
}
function bundle(file, tag) {
  const tmp = mkdtempSync(path.join(tmpdir(), tag + '-'));
  execFileSync(ESBUILD, [file, '--bundle', '--format=cjs', '--platform=node', '--outfile=' + tmp + '/b.cjs'], { stdio: 'pipe' });
  return createRequire(tmp + '/x.js')(tmp + '/b.cjs');
}

/* ---------------- S: statics ---------------- */
{
  for (const f of ['index.ts', 'mass.ts', 'mass-calendar.ts', 'mass-order.ts']) {
    ok(readFileSync(SRC + '/' + f, 'utf8') === readFileSync(BASE + '/' + f, 'utf8'),
      'S1-' + f + ': byte-identical to the v530 ship');
  }
  const stripPin = (s) => s.replace(/var CACHE = "ora-pro-nobis-v[0-9]+-[0-9]+"/, 'var CACHE = "PIN"');
  ok(stripPin(U_SRC) === stripPin(U_BASE), 'S2: ui.ts differs from the v530 ship only at the SW pin');
  const migs = readdirSync(APP + '/migrations').filter((f) => f.endsWith('.sql')).sort();
  ok(migs[migs.length - 1] === '0039_mass_universal_prayer.sql', 'S3: no migration past 0039', migs.slice(-2).join(','));
  // The change surface, named: in client.ts only
  // massReadingsHtml and wireMassChips change among the
  // standing mass functions; the v529 helpers stand.
  const standing = ['massLinesHtml', 'massFeedLinesHtml', 'massBackupPartHtml', 'massPartHtml',
    'massAcksHtml', 'paintMassScroll', 'paintMassReadings', 'loadMassFeed', 'massPickedMemorial',
    'massMemorialNameKey', 'massMemorialPartsHtml', 'massPersonalListHtml', 'massFormulary',
    'massDayFlags', 'paintMassLiturgy', 'massOptionLabel', 'massCiteParts', 'massFeedPartHtml'];
  const drift = standing.filter((n) => extractFn(C_SRC, n) !== extractFn(C_BASE, n));
  ok(drift.length === 0, 'S4: every standing mass function except the two named v531 touches is byte-identical to the v530 ship', drift.join(','));
  ok(C_SRC.includes('function massReadingsChipsHtml(') && C_SRC.includes('function massStandingSetKey(')
    && C_SRC.includes('function massMemorialChipLabel(') && C_SRC.includes("querySelectorAll('[data-rset]')")
    && C_SRC.includes('>Weekday</button>'),
    'S5: the v531 client pieces stand (the chip row · the standing-set rule · the chip label · the tap binding)');
  ok(extractFn(C_SRC, 'massReadingsHtml') !== extractFn(C_BASE, 'massReadingsHtml')
    && extractFn(C_SRC, 'wireMassChips') !== extractFn(C_BASE, 'wireMassChips'),
    'S6: massReadingsHtml and wireMassChips are the changed pair (the chip render · the tap binding)');
  // Server: the parsers are byte-identical to the v530
  // ship; only the pull changed.
  ok(extractFn(MR_SRC, 'parseUsccbFeed') === extractFn(MR_BASE, 'parseUsccbFeed')
    && extractFn(MR_SRC, 'parseMemorialPage') === extractFn(MR_BASE, 'parseMemorialPage')
    && extractFn(MR_SRC, 'groupFeedParts') === extractFn(MR_BASE, 'groupFeedParts'),
    'S7: the feed parser, the memorial page parser, and the grouping are byte-identical to the v530 ship');
  ok(MR_SRC.includes('MEMORIAL_RETRY_WAITS_MS') && MR_SRC.includes('function memorialParseIsReal(')
    && MR_SRC.includes('for (const mem of payload.memorials)')
    && !MR_SRC.includes('Promise.all(payload.memorials'),
    'S8: the v531 pull stands (sequential loop · spaced retries · the nothing-parse gate; the concurrent fan-out is gone)');
}

/* ---------------- P: cooked parse (the v439 gate) ---------------- */
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

/* ---------------- W: the parsers over the real fixtures ---------------- */
const FEED_XML = readFileSync(FIX + '/usccb-feed.xml', 'utf8');
const PAGE_DED = readFileSync(FIX + '/memorial-dedication.html', 'utf8');
const PAGE_ROSE = readFileSync(FIX + '/memorial-rose.html', 'utf8');
const PAGE_ELIZ = readFileSync(FIX + '/memorial-elizabeth.html', 'utf8');
// The block page's SHAPE, as the wall serves it to
// server-side fetches (403, no Lectionary line, no
// readings content) — a stub for the pull legs, not a
// content fixture.
const BLOCK_HTML = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><title>Access Denied</title></head><body><h1>Access Denied</h1><p>Reference #00.00000000.0000000000</p></body></html>';
let mr = null, cal = null;
try {
  mr = bundle(SRC + '/mass-readings.ts', 'mr531');
  ok(typeof mr.parseUsccbFeed === 'function' && typeof mr.parseMemorialPage === 'function' && typeof mr.massReadingsPayload === 'function',
    'W0: mass-readings.ts bundles and exports the parsers + the payload pull');
} catch (e) { ok(false, 'W0: mass-readings.ts bundles', String(e).slice(0, 200)); }
try { cal = bundle(SRC + '/mass-calendar.ts', 'cal531'); } catch (e) { console.log('note - calendar bundle failed:', String(e).slice(0, 120)); }

const PAGE_BY_FILE = {
  '1118-memorial-dedication-basilica-sts-peter-paul.cfm': PAGE_DED,
  '1118-memorial-rose-philippine-duchesne.cfm': PAGE_ROSE,
  '1117-memorial-elizabeth-hungary.cfm': PAGE_ELIZ,
};
function routePayload(date) {
  const p = mr.parseUsccbFeed(FEED_XML, date);
  const out = { ok: true, date: p.date, found: p.found, title: p.title, parts: p.parts, copyright: p.copyright };
  if (p.memorials) {
    out.memorials = p.memorials.map((mem) => {
      const page = PAGE_BY_FILE[mem.url.split('/').pop()];
      if (!page) return mem;
      const parsed = mr.parseMemorialPage(page);
      return { ...mem, lectionary: parsed.lectionary, note: parsed.note, parts: parsed.parts };
    });
  }
  return out;
}

let P18 = null, P15 = null;
if (mr) {
  P18 = routePayload('2026-11-18');
  ok(P18.found && Array.isArray(P18.memorials) && P18.memorials.length === 2
    && P18.memorials[0].name === 'Optional Memorial of Dedication of the Basilicas of Saints Peter and Paul, Apostles'
    && P18.memorials[1].name === 'Optional Memorial of Saint Rose Philippine Duchesne, Virgin [In the Dioceses of the United States]',
    'W1: the fresh live feed carries today\'s two mentions, names as printed');
  const ded = mr.parseMemorialPage(PAGE_DED);
  ok(ded.lectionary === '679' && ded.parts.map((p) => p.source).join('|') === 'Acts 28:11-16, 30-31|Psalm 98:1, 2-3ab, 3cd-4, 5-6|See Te Deum|Matthew 14:22-33',
    'W2: the fresh Dedication page parses whole — Lectionary 679, Acts 28 · Psalm 98 · Matthew 14');
  const rose = mr.parseMemorialPage(PAGE_ROSE);
  ok(rose.lectionary === '679A' && rose.parts.length === 0
    && rose.note === 'Readings for the Memorial may be taken from the Common of Virgins, #731-736, or the Common of Holy Men and Women: For Religious, #737-742.',
    'W3: the fresh Duchesne page — Lectionary 679A, no parts, the Commons direction verbatim');
  ok(P18.parts.map((p) => p.source).join('|') === 'Revelation 4:1-11|Psalm 150:1b-2, 3-4, 5-6|See John 15:16|Luke 19:11-28',
    'W4: today\'s ferial parts stand as the feed prints them');
  P15 = routePayload('2026-11-15');
  ok(P15.found && !P15.memorials, 'W5: the mention-free Sunday stands in the fresh feed with no memorials');
}

/* ---------------- PL: the pull, against the wall's shape ---------------- */
const realFetch = globalThis.fetch;
function stubFetch(handler) {
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes('/bible/readings/rss/')) return { ok: true, status: 200, text: async () => FEED_XML };
    const file = u.split('/').pop();
    return handler(u, file);
  };
}
const servePage = (html) => ({ ok: true, status: 200, text: async () => html });
const serve403 = () => ({ ok: false, status: 403, text: async () => BLOCK_HTML });
if (mr) {
  // PL1 (premise): the BASE pull (the v530 ship's
  // mass-readings.ts) under a walled fetch — the
  // memorials ride empty. This is the field failure's
  // shape, reproduced end-to-end.
  try {
    const mrBase = bundle(BASE + '/mass-readings.ts', 'mr531base');
    stubFetch(async () => serve403());
    const p = await mrBase.massReadingsPayload('2026-11-18');
    const ded = (p.memorials || [])[0] || {};
    ok(p.found && (p.memorials || []).length === 2 && !ded.lectionary && ded.note === null && ded.parts.length === 0,
      'PL1 (premise): the base pull under the wall leaves the Dedication memorial EMPTY — no lectionary, no note, no parts — the exact payload shape behind "the readings do not change"');
  } catch (e) { ok(false, 'PL1 (premise): the base pull under the wall', String(e).slice(0, 160)); }
  // PL2: the build pull — the wall blocks the first
  // Dedication attempt, then opens. The retry lands
  // the set; both memorials stand whole.
  try {
    const mrB = bundle(SRC + '/mass-readings.ts', 'mr531b');
    const attempts = {};
    stubFetch(async (u, file) => {
      attempts[file] = (attempts[file] || 0) + 1;
      if (file.startsWith('1118-memorial-dedication') && attempts[file] === 1) return serve403();
      return servePage(PAGE_BY_FILE[file]);
    });
    const p = await mrB.massReadingsPayload('2026-11-18');
    const ded = (p.memorials || [])[0] || {};
    const rose = (p.memorials || [])[1] || {};
    ok(ded.lectionary === '679' && ded.parts.some((x) => x.source === 'Acts 28:11-16, 30-31') && ded.parts.some((x) => x.source === 'Matthew 14:22-33'),
      'PL2: a first-attempt block is retried and the Dedication set lands whole (679 · Acts 28 · Matthew 14)');
    ok(rose.lectionary === '679A' && !!rose.note && rose.parts.length === 0,
      'PL3: the Duchesne memorial lands with its 679A direction in the same sequential pull');
  } catch (e) { ok(false, 'PL2/PL3: the build pull retries past a block', String(e).slice(0, 160)); }
  // PL4: a nothing-parse (a 200 block page) is never
  // merged and never cached — a later payload call
  // re-fetches, and lands the set when the wall opens.
  try {
    const mrC = bundle(SRC + '/mass-readings.ts', 'mr531c');
    let dedFetches = 0, wallUp = true;
    stubFetch(async (u, file) => {
      if (file.startsWith('1118-memorial-dedication')) { dedFetches++; return wallUp ? servePage(BLOCK_HTML) : servePage(PAGE_DED); }
      return servePage(PAGE_BY_FILE[file]);
    });
    const p1 = await mrC.massReadingsPayload('2026-11-18');
    const ded1 = (p1.memorials || [])[0] || {};
    ok(!ded1.lectionary && ded1.note === null && ded1.parts.length === 0 && dedFetches === 5,
      'PL4a: a 200 block page parses to nothing and is treated as a failed pull (5 spaced attempts), the memorial riding empty for that request', 'dedFetches=' + dedFetches);
    wallUp = false;
    const p2 = await mrC.massReadingsPayload('2026-11-18');
    const ded2 = (p2.memorials || [])[0] || {};
    ok(ded2.lectionary === '679' && dedFetches === 6,
      'PL4b: the nothing-parse was never cached — the next payload call re-fetches and the Dedication set lands', 'dedFetches=' + dedFetches);
  } catch (e) { ok(false, 'PL4: nothing-parse handling', String(e).slice(0, 160)); }
  globalThis.fetch = realFetch;
  // PL5 (LIVE): the built payload pull over the live
  // network — the serve-path proof v529 never ran.
  try {
    const mrL = bundle(SRC + '/mass-readings.ts', 'mr531live');
    const p = await mrL.massReadingsPayload('2026-11-18');
    const ded = (p.memorials || [])[0] || {};
    const rose = (p.memorials || [])[1] || {};
    ok(p.found && ded.lectionary === '679' && ded.parts.some((x) => x.source === 'Acts 28:11-16, 30-31')
      && ded.parts.some((x) => x.source === 'Psalm 98:1, 2-3ab, 3cd-4, 5-6') && ded.parts.some((x) => x.source === 'Matthew 14:22-33'),
      'PL5 (LIVE): the built pull over the live network lands the Dedication set whole — Acts 28 · Psalm 98 · Matthew 14');
    ok(rose.lectionary === '679A' && !!rose.note && rose.note.includes('Common of Virgins'),
      'PL5b (LIVE): the Duchesne memorial lands live with its 679A Commons direction');
  } catch (e) { ok(false, 'PL5 (LIVE): the built pull over the live network', String(e).slice(0, 200)); }
}

/* ---------------- G439: the standing gate, as-is ---------------- */
{
  let out = '';
  try { out = execFileSync('node', [APP + '/tests/harness-v439.mjs'], { cwd: ROOT, timeout: 300000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { out = String(e.stdout || ''); }
  const m = out.match(/harness-v439: (\d+) ok \/ (\d+) not-ok/);
  ok(!!m && m[1] === '13' && m[2] === '2',
    'G439 (recorded as-is, not a v531 pass): the standing v439 boot gate reads its standing 13 ok / 2 not-ok on this tree',
    m ? m[0] : 'no tally line');
}

/* ---------------- C: Chromium — the readings chip ---------------- */
function stubFormulary(label) {
  return {
    entranceAntiphon: { text: 'I will bless the Lord at all times.', ref: 'Ps 34' },
    collect: 'O God, who in ' + label + ' have given us a sign of your care, grant, we pray, that we may follow where you lead. Through our Lord Jesus Christ, your Son.',
    prayerOverOfferings: 'Accept, O Lord, the offerings we bring on this day.',
    prefaceText: null, prefaceName: null,
    communionAntiphon: { text: 'Blessed are the merciful, for they shall receive mercy.', ref: 'Mt 5:7' },
    prayerAfterCommunion: 'Nourished by this sacrament, O Lord, keep us in your service.',
  };
}
function massPayloadFor(date) {
  const e = cal.MASS_CALENDAR[date];
  return {
    ok: true, name: e.name, season: 'Ordinary Time', defaultVersion: e.default,
    versions: e.versions.map((v) => ({ key: v.key, label: v.label, rank: v.rank, formulary: stubFormulary(v.label) })),
  };
}
function dayStub(date) {
  return {
    ok: true, date, presentedDay: date, dateLabel: date,
    liturgicalDay: { name: 'Day', color: 'green' }, introTexts: {},
    blocks: [{ block: 'Morning', label: 'Morning', tracks: [
      { episodeId: '9001', title: 'Invitatory', durationS: 240, available: true, streamUrl: 'https://audio.example/9001.mp3' },
    ] }],
    episodes: [],
  };
}
function buildPage(cooked, css, scenario) {
  const DAY = dayStub(scenario.date);
  const MASS = massPayloadFor(scenario.date);
  const FEED = scenario.feed;
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
  if (p.indexOf('/api/prayer/mass-readings') === 0) return J(${JSON.stringify(FEED)});
  if (p.indexOf('/api/prayer/mass-personal-prayer') === 0) return J({ ok: true, before: [], after: [], afterMass: [], preMass: [] });
  if (p.indexOf('/api/prayer/mass-universal-prayer') === 0) return J({ ok: true, date: ${JSON.stringify(scenario.date)}, intentions: [] });
  if (p.indexOf('/api/prayer/mass?') === 0) return J(${JSON.stringify(MASS)});
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

const FAIL18 = P18 ? { ...P18, memorials: P18.memorials.map((m) => ({ ...m, note: null, parts: [] })) } : null;
const PAGES = {
  '/d18': () => buildPage(COOKED, APP_CSS, { date: '2026-11-18', feed: P18 }),
  '/d18fail': () => buildPage(COOKED, APP_CSS, { date: '2026-11-18', feed: FAIL18 }),
  '/d15': () => buildPage(COOKED, APP_CSS, { date: '2026-11-15', feed: P15 }),
  '/d15base': () => buildPage(COOKED_BASE, APP_CSS_BASE, { date: '2026-11-15', feed: P15 }),
};
const server = http.createServer((req, res) => {
  const u = (req.url || '/').split('?')[0];
  if (PAGES[u]) { res.setHeader('Content-Type', 'text/html'); res.end(PAGES[u]()); return; }
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
  await ctx.route('**/*', (route) => { if (route.request().url().startsWith(ORIGIN)) route.continue(); else route.abort(); });
  page.on('pageerror', (e) => { errs.push(String(e).slice(0, 160)); console.log('note -', tag, 'pageerror:', String(e).slice(0, 140)); });
  await page.goto(ORIGIN + which);
  await page.waitForSelector('.mass-scroll', { timeout: 15000 }).catch(() => console.log('note -', tag, ': mass scroll slow'));
  await sleep(900);
  return { ctx, page };
}
const readingsText = (page) => page.evaluate(() => {
  const h = document.getElementById('mass-readings');
  return h ? h.textContent : '';
});
const scrollOutsideReadings = (page) => page.evaluate(() => {
  const s = document.querySelector('.mass-scroll');
  if (!s) return '';
  const clone = s.cloneNode(true);
  const h = clone.querySelector('#mass-readings');
  if (h) h.remove();
  return clone.textContent;
});
const chipStates = (page) => page.evaluate(() => {
  const host = document.getElementById('mass-readings');
  if (!host) return null;
  return [...host.querySelectorAll('[data-rset]')].map((b) => ({ set: b.getAttribute('data-rset'), on: b.classList.contains('on'), label: b.textContent.trim() }));
});
const DED_KEY = 'saint-dedicationofbasilicasofsaintspeterandpaul';

/* ---- C1–C8: today — the chip stands, defaults, and moves the readings only ---- */
{
  const errs = [];
  const { ctx, page } = await boot('/d18', errs, 'c18');
  const chips = await chipStates(page);
  ok(!!chips && chips.length === 3 && chips[0].set === 'ferial' && chips[1].set === 'mem:0' && chips[2].set === 'mem:1'
    && chips[1].on && !chips[0].on && chips[1].label.includes('Dedication of the Basilicas') && chips[2].label.includes('Rose Philippine Duchesne'),
    'C1: the readings chip row stands WITH the readings — Weekday · Dedication · Duchesne — standing on the Dedication chip (the default version\'s set)',
    JSON.stringify(chips));
  let t = await readingsText(page);
  ok(t.includes('Acts 28:11-16, 30-31') && t.includes('Psalm 98:1, 2-3ab, 3cd-4, 5-6') && t.includes('Matthew 14:22-33') && !t.includes('Revelation 4:1-11'),
    'C2 (the exact case): the fresh page stands the Dedication set in the readings place — Acts 28 · Psalm 98 · Matthew 14');
  const outsideBefore = await scrollOutsideReadings(page);
  await page.click('button[data-rset="ferial"]');
  await sleep(400);
  t = await readingsText(page);
  const outsideAfter = await scrollOutsideReadings(page);
  ok(t.includes('Revelation 4:1-11') && t.includes('Luke 19:11-28') && !t.includes('Acts 28:11-16'),
    'C3: tapping the Weekday chip swaps the readings place to the ferial set');
  ok(outsideBefore === outsideAfter && outsideAfter.includes('Dedication of the Basilicas'),
    'C4: moving the chip moved the READINGS ONLY — everything outside the readings place (the picked Dedication version, its propers, the whole scroll) stands byte-unchanged');
  const chipsAfterWeekday = await chipStates(page);
  ok(!!chipsAfterWeekday && chipsAfterWeekday[0].on && !chipsAfterWeekday[1].on,
    'C5: the Weekday chip carries the standing mark after the tap');
  await page.click('button[data-rset="mem:0"]');
  await sleep(400);
  t = await readingsText(page);
  ok(t.includes('Acts 28:11-16, 30-31') && t.includes('Matthew 14:22-33'),
    'C6: tapping the Dedication chip restores her set');
  await page.click('button[data-rset="mem:1"]');
  await sleep(400);
  t = await readingsText(page);
  ok(t.includes('Lectionary 679A') && t.includes('Readings for the Memorial may be taken from the Common of Virgins, #731-736')
    && t.includes('Revelation 4:1-11') && t.includes('Luke 19:11-28'),
    'C7: the Duchesne chip stands her Lectionary direction verbatim over the ferial readings (her page publishes no set)');
  await page.click('button[data-version="ferial"]');
  await sleep(500);
  t = await readingsText(page);
  const chipsFerial = await chipStates(page);
  ok(t.includes('Revelation 4:1-11') && !!chipsFerial && chipsFerial[0].on,
    'C8: picking the ferial VERSION re-defaults the readings chip to Weekday — the chip follows the version pick as a default, not as a lock');
  await page.click('button[data-version="' + DED_KEY + '"]');
  await sleep(500);
  t = await readingsText(page);
  const chipsDed = await chipStates(page);
  ok(t.includes('Acts 28:11-16, 30-31') && !!chipsDed && chipsDed[1].on,
    'C9: picking the Dedication version again re-defaults the chip to her set');
  const acks = await page.evaluate(() => {
    const a = document.getElementById('mass-acks');
    return a ? a.textContent : '';
  });
  ok((acks.match(/Confraternity of Christian Doctrine/g) || []).length === 1,
    'C10: the tail acknowledgments carry the CCD line exactly once');
  ok(errs.length === 0, 'C11: no page errors on the 2026-11-18 chip walk', errs.join(' | '));
  await ctx.close();
}
/* ---- C12: the failure posture under the chip ---- */
{
  const errs = [];
  const { ctx, page } = await boot('/d18fail', errs, 'c18fail');
  const chips = await chipStates(page);
  let t = await readingsText(page);
  ok(!!chips && chips.length === 3 && t.includes('Revelation 4:1-11') && t.includes('Luke 19:11-28') && !t.includes('Acts 28:11-16'),
    'C12: with both memorial pulls failed, the chip row still stands and the readings fall back to the ferial set — the day never breaks');
  await page.click('button[data-rset="mem:0"]');
  await sleep(400);
  t = await readingsText(page);
  ok(t.includes('Revelation 4:1-11') && errs.length === 0,
    'C13: the failed memorial\'s chip renders the ferial fallback, no errors', errs.join(' | '));
  await ctx.close();
}
/* ---- C14: the mention-free day — no chip, byte-identical ---- */
{
  const errs = [];
  const a = await boot('/d15', errs, 'c15build');
  const buildHtml = await a.page.evaluate(() => document.getElementById('mass-readings').innerHTML);
  const buildChips = await a.page.evaluate(() => document.querySelectorAll('[data-rset]').length);
  await a.ctx.close();
  const b = await boot('/d15base', errs, 'c15base');
  const baseHtml = await b.page.evaluate(() => document.getElementById('mass-readings').innerHTML);
  await b.ctx.close();
  ok(buildChips === 0 && buildHtml === baseHtml,
    'C14: on the mention-free Sunday NO chip row stands and the readings place is byte-identical to the v530 client\'s');
}

await browser.close();
server.close();
console.log('harness-v531: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) console.log('FAILURES: ' + failures.join(' ;; '));
process.exit(fail ? 1 : 0);
