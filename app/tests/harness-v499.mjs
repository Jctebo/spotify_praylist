// harness-v499.mjs — v499 evidence: deprecate the Mass and
// Homilies block (John, main chat 2026-11-17 08:57 CT):
// the block leaves the Praylist and the day build; the Daily
// TV Mass (YouTube version) and the Springfield Mass join the
// Mass tab's Virtual Mass entries list; the Novenas block
// stands FIRST in the Praylist; the bottom Play All on the
// Pray home is removed.
// SUBJECT: a tree carrying the v499 build on the v498 ship
// lineage. Run from that worktree's root:
//   node app/tests/harness-v499.mjs [--probe]
// Fixtures (Improvement D — from production, captured
// 2026-11-17, app/tests/fixtures-v499):
//   day-payload-2026-11-17.json — the live door day payload
//     for 2026-11-17 (the BEFORE-state block order +
//     captions; source: the prayer door, production).
//   yt-feed-dailytvmass-2026-11-17.xml — the Daily TV Mass
//     YouTube channel's uploads Atom feed as captured that
//     morning (channel_id UCi6JtCVy4XKu4BSG-AE2chg, the
//     National Catholic Broadcasting Council) — the exact
//     document ytParseFeed consumes in production.
//   yt-feed-springfield-2026-11-17.xml — the St. Thomas the
//     Apostle West Springfield channel's uploads Atom feed
//     (channel_id UCP7JPwhCx2UBbnRk_TjLrHg), same capture.
// The Mass payload + readings feed shapes for leg (d) stand
// in the v498 harness's production shape for 2026-11-17.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const PROBE = process.argv.includes('--probe');
const APP = path.resolve(process.cwd(), 'app');
const SRC = APP + '/worker/src';
const FIX = APP + '/tests/fixtures-v499';
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const I_SRC = readFileSync(SRC + '/index.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const BASE = path.resolve(process.cwd(), '../../.worktrees/v498-ship/app/worker/src');
const C_BASE = readFileSync(BASE + '/client.ts', 'utf8');
const I_BASE = readFileSync(BASE + '/index.ts', 'utf8');
const U_BASE = readFileSync(BASE + '/ui.ts', 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (PROBE) { console.log('probe -', label, extra ? ' :: ' + extra : ''); return; }
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}

/* ---------------- extraction helpers ---------------- */
function extractFn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) return null;
  let i = src.indexOf('{', start), depth = 0, j = i;
  for (; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) { j++; break; } }
  }
  return src.slice(start, j);
}
function extractConst(src, name) {
  const start = src.indexOf('const ' + name);
  if (start < 0) return null;
  const end = src.indexOf(';', start);
  return src.slice(start, end + 1);
}
// Comment prose in this tree NAMES the things it retires —
// assertions judge code, so slices get their comments stripped
// before shape checks (never for byte-equality legs).
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

/* ---------------- S: statics ---------------- */
{
  // (a) the block list itself
  const pb = extractConst(I_SRC, 'PRAYER_BLOCKS');
  const names = [...pb.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  ok(JSON.stringify(names) === JSON.stringify(['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night']),
    'S1: PRAYER_BLOCKS — Novenas first, Mass and Homilies gone, the six hour blocks in standing order', names.join(' · '));
  const fixture = JSON.parse(readFileSync(FIX + '/day-payload-2026-11-17.json', 'utf8'));
  const beforeNames = fixture.blocks.map((b) => b.block);
  ok(JSON.stringify(beforeNames) === JSON.stringify(['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night', 'Mass and Homilies', 'Novenas']),
    'S2: the production fixture carries the BEFORE order (Mass and Homilies 7th, Novenas last)');
  const transformed = ['Novenas', ...beforeNames.filter((b) => b !== 'Mass and Homilies' && b !== 'Novenas')];
  ok(JSON.stringify(transformed) === JSON.stringify(names),
    'S3: the new list is exactly the fixture order with the block retired and Novenas moved first');
  ok(fixture.blockOrder === null, 'S4: the live stored manual order is null — the contract order governs (door payload, 2026-11-17)');

  // the courier class stands empty; the four slots leave the client table
  const courier = extractConst(I_SRC, 'EXT_COURIER_SLOTS');
  ok(courier && !courier.includes('slotId: "ext-'), 'S5: EXT_COURIER_SLOTS stands empty — no courier slot is served');
  const extSlotsStart = C_SRC.indexOf('var EXT_SLOTS = [');
  const extSlots = stripComments(C_SRC.slice(extSlotsStart, C_SRC.indexOf('];', extSlotsStart)));
  const extSlotsBase = stripComments(C_BASE.slice(C_BASE.indexOf('var EXT_SLOTS = ['), C_BASE.indexOf('];', C_BASE.indexOf('var EXT_SLOTS = ['))));
  ok(!/slotId: '(ext-usccb-readings|ext-daily-tv-mass|ext-fr-mike-homily|ext-barron-sermon)'/.test(extSlots),
    'S6: the client EXT_SLOTS table carries no entry for any of the four retired slots');
  ok((extSlots.match(/slotId: '/g) || []).length === (extSlotsBase.match(/slotId: '/g) || []).length - 4,
    'S6b: the client table loses exactly the four entries — every other slot stands',
    (extSlots.match(/slotId: '/g) || []).length + ' vs base ' + (extSlotsBase.match(/slotId: '/g) || []).length);
  ok(extSlots.includes("ext-saint-of-the-day") && extSlots.includes("ext-night-prayer"),
    'S7: the standing slots stand untouched in the client table');

  // (b) the Virtual entries + the video series defs
  const ve = C_SRC.slice(C_SRC.indexOf('var MASS_VIRTUAL_ENTRIES = ['), C_SRC.indexOf('];', C_SRC.indexOf('var MASS_VIRTUAL_ENTRIES = [')));
  const entries = [...ve.matchAll(/key: '([^']+)', title: '([^']+)', meta: '([^']+)', series: '([^']+)'/g)]
    .map((m) => ({ key: m[1], title: m[2], meta: m[3], series: m[4] }));
  ok(JSON.stringify(entries.map((e) => e.title)) === JSON.stringify(['Catholic TV Mass', 'Daily TV Mass', 'Springfield Mass']),
    'S8: the Virtual Mass entries stand in order — Catholic TV Mass · Daily TV Mass · Springfield Mass', entries.map((e) => e.title).join(' · '));
  ok(entries[1] && entries[1].series === 'dailytvmass' && entries[2] && entries[2].series === 'springfieldmass'
    && entries[2].meta === 'St. Thomas the Apostle · West Springfield',
    'S9: the new entries carry their series keys and the Springfield meta names its parish');
  ok(I_SRC.includes('const YT_DAILYTV_FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id=UCi6JtCVy4XKu4BSG-AE2chg";')
    && I_SRC.includes('const YT_SPRINGFIELD_FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id=UCP7JPwhCx2UBbnRk_TjLrHg";'),
    'S10: the pinned feed URLs carry the two identified channel ids (Daily TV Mass NCBC · St. Thomas West Springfield)');
  ok(I_SRC.includes('{ key: "dailytvmass", title: "Daily TV Mass", feedUrl: (env) => env.EXT_YT_DAILYTV_FEED_URL || YT_DAILYTV_FEED_URL }')
    && I_SRC.includes('{ key: "springfieldmass", title: "Springfield Mass", feedUrl: (env) => env.EXT_YT_SPRINGFIELD_FEED_URL || YT_SPRINGFIELD_FEED_URL }'),
    'S11: POD_VIDEO_SERIES_LIST gains the two defs on their env seams');
  const idxBody = stripComments(I_SRC.slice(I_SRC.indexOf('async function podIndexPayload'), I_SRC.indexOf('---- Podcasts VIDEO series')));
  ok(idxBody.includes('POD_SERIES_LIST') && idxBody.includes('POD_RSS_SERIES_LIST')
    && !idxBody.includes('POD_VIDEO_SERIES_LIST') && !idxBody.includes('podVideoIndexEntry'),
    'S12: the Catechesis index build (comments stripped) loops the audio + RSS defs only — the video defs cannot leak into the index');
  ok((I_SRC.match(/podVideoIndexEntry\(/g) || []).length === 1,
    'S13: podVideoIndexEntry stands defined and uncalled (the v493 retirement stands)');

  // (c) the bottom Play All is gone from the client
  ok(!C_SRC.includes('id="play-all"') && !C_SRC.includes("getElementById('play-all')"),
    'S14: no #play-all element and no play-all wiring stand in the client');

  // the settings census carve-out
  ok(I_SRC.includes('["usccb-daily-readings", "daily-tv-mass", "fr-mike-homily", "barron-sermon"].includes(key) && s.block === "Mass and Homilies"'),
    'S15: the settings PUT census accepts the retired block name for its own four rows only (the v451 pattern)');

  // ui.ts untouched (pin aside — the build tree still carries the base pin)
  const stripPin = (s) => s.replace(/var CACHE = "ora-pro-nobis-v[0-9]+-[0-9]+"/, 'var CACHE = "PIN"');
  ok(stripPin(U_SRC) === stripPin(U_BASE), 'S16: ui.ts is identical to the v498 ship (pin aside) — no CSS or shell seat moved');
}

/* ---------------- (f): the current-block derivation ---------------- */
{
  const evalList = (src, constName) => {
    const c = extractConst(src, constName);
    return [...c.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  };
  const evalStarts = (src) => {
    const start = src.indexOf('const PRAYER_BLOCK_START');
    const open = src.indexOf('= {', start);
    const body = stripComments(src.slice(open, src.indexOf('};', start)));
    const out = {};
    for (const m of body.matchAll(/(?:"([^"]+)"|([A-Za-z][A-Za-z ]*?)): (\d+)/g)) out[m[1] || m[2]] = Number(m[3]);
    return out;
  };
  const derive = (list, starts, hour) => list.reduce((cur, b) => {
    const s = starts[b] ?? 0, cs = starts[cur] ?? 0;
    return hour >= s && s > cs ? b : cur;
  }, 'Morning');
  const baseList = evalList(I_BASE, 'PRAYER_BLOCKS');
  const baseStarts = evalStarts(I_BASE);
  const newList = evalList(I_SRC, 'PRAYER_BLOCK_DERIVATION');
  const newStarts = evalStarts(I_SRC);
  let same = true; const diffs = [];
  for (let h = 0; h < 24; h++) {
    const a = derive(baseList, baseStarts, h), b = derive(newList, newStarts, h);
    if (a !== b) { same = false; diffs.push(h + ':' + a + '!=' + b); }
  }
  ok(same, 'F1: the current-block derivation returns the base build\u2019s block at every hour 0–23', diffs.join(' '));
  ok(derive(newList, newStarts, 9) === 'Midmorning', 'F2: the 09:00 tie still breaks to Midmorning (Novenas never hijacks current)');
}

/* ---------------- the video series builds (production parser, production feeds) ---------------- */
// The Worker source is TypeScript; the production parser is
// exercised on its esbuild transpile (the same transform the
// deploy bundle applies), extracted by name.
const I_JS_FILE = path.join(os.tmpdir(), 'harness-v499-index.js');
execFileSync('/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/esbuild',
  [SRC + '/index.ts', '--format=esm', '--outfile=' + I_JS_FILE], { stdio: 'pipe' });
const I_JS = readFileSync(I_JS_FILE, 'utf8');
function buildSeriesPayload(feedFile, key, title) {
  const fns = ['extXmlText', 'extStripDesc', 'ytParseFeed', 'videoDateLabel']
    .map((n) => extractFn(I_JS, n)).filter(Boolean).join('\n');
  const factory = new Function(fns + '\nreturn { ytParseFeed, videoDateLabel };');
  const { ytParseFeed, videoDateLabel } = factory();
  const xml = readFileSync(FIX + '/' + feedFile, 'utf8');
  const videos = ytParseFeed(xml);
  return {
    payload: {
      ok: true, kind: 'video', series: key, title, available: true, stale: false,
      builtAt: '2026-11-17T12:00:00Z',
      videos: videos.map((v) => ({ id: v.id, title: v.title, url: v.url, publishedMs: v.publishedMs, dateLabel: videoDateLabel(v.publishedMs), imageUrl: v.imageUrl, descText: v.descText })),
    },
    raw: videos,
  };
}
const DTM = buildSeriesPayload('yt-feed-dailytvmass-2026-11-17.xml', 'dailytvmass', 'Daily TV Mass');
const SPR = buildSeriesPayload('yt-feed-springfield-2026-11-17.xml', 'springfieldmass', 'Springfield Mass');
{
  ok(DTM.raw.length >= 10, 'V1: the Daily TV Mass feed parses on the production parser', DTM.raw.length + ' videos');
  const sorted = DTM.raw.every((v, i, a) => i === 0 || a[i - 1].publishedMs >= v.publishedMs);
  ok(sorted, 'V2: the Daily TV Mass videos stand newest first');
  const firstMass = DTM.raw.find((v) => /Daily TV Mass/.test(v.title));
  ok(firstMass && firstMass.title === 'Catholic Mass Today | Daily TV Mass, Tuesday November 17, 2026',
    'V3: the head Mass video of the Daily TV Mass series is TODAY\u2019S Mass (Tue Nov 17, 2026)', firstMass && firstMass.title);
  ok(SPR.raw.length >= 7, 'V4: the Springfield feed parses on the production parser', SPR.raw.length + ' videos');
  ok(SPR.raw[0] && SPR.raw[0].title === 'Daily Mass Tuesday, November 17, 2026',
    'V5: the Springfield series opens on TODAY\u2019S daily Mass', SPR.raw[0] && SPR.raw[0].title);
  const days = SPR.raw.slice(0, 7).map((v) => v.title);
  ok(days.filter((t) => /^(Daily Mass|Sunday Mass)/.test(t)).length === 7,
    'V6: the Springfield feed\u2019s newest seven entries are an unbroken daily Mass run', days.join(' | '));
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

const LIT_WHITE = { name: 'Memorial of Saint Elizabeth of Hungary, Religious', color: 'white' };
// The AFTER day payload: the production fixture's block set
// (Novenas first, the retired block gone) in the standing
// harness stub shape (the v498 pattern — blocks carry their
// tracks directly).
function dayPayload() {
  return {
    ok: true, date: '2026-11-17', presentedDay: '2026-11-17',
    dateLabel: 'Tuesday, November 17, 2026',
    liturgicalDay: LIT_WHITE,
    introTexts: {},
    blocks: [
      { block: 'Novenas', label: 'Novenas', tracks: [
        { episodeId: 'n1', title: 'Novena to Christ the King', durationS: 600, available: true, streamUrl: 'https://audio.example/n1.mp3' },
      ] },
      { block: 'Morning', label: 'Morning', tracks: [
        { episodeId: '9001', title: 'Invitatory', durationS: 240, available: true, streamUrl: 'https://audio.example/9001.mp3' },
        { episodeId: '9002', title: 'Morning Prayer', durationS: 720, available: true, streamUrl: 'https://audio.example/9002.mp3' },
      ] },
      { block: 'Midmorning', label: 'Midmorning', tracks: [
        { episodeId: '9003', title: 'Daily Gospel Exegesis', durationS: 480, available: true, streamUrl: 'https://audio.example/9003.mp3' },
      ] },
    ],
    episodes: [],
  };
}
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
const POD_INDEX = { ok: true, seriesList: [
  { series: 'catechism-in-a-year', title: 'Catechism in a Year', available: true, listenedCount: 5, total: 369, currentKey: 'd6', currentLabel: 'Day 6', showImageUrl: '', category: 'courses' },
  { series: 'counsel-of-trent', title: 'Counsel of Trent', kind: 'rss', category: 'podcasts', available: true, listenedCount: 0, total: 12, latestLabel: 'Nov 13', showImageUrl: '' },
] };
const POD_CATHOLICTV = { ok: true, kind: 'video', series: 'catholictv', title: 'CatholicTV', available: true, stale: false, builtAt: '2026-11-17T12:00:00Z',
  videos: [
    { id: 'vid001', title: 'Catholic Mass Today | November 17, 2026 | CatholicTV Daily Mass', url: 'https://www.youtube.com/watch?v=vid001', publishedMs: 1763400000000, dateLabel: 'Nov 17, 2026', imageUrl: '', descText: null },
  ] };

function buildPage(cooked, css) {
  const DAY = dayPayload();
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
  if (p.indexOf('/api/player/podcasts?series=dailytvmass') === 0) return J(${JSON.stringify(DTM.payload)});
  if (p.indexOf('/api/player/podcasts?series=springfieldmass') === 0) return J(${JSON.stringify(SPR.payload)});
  if (p.indexOf('/api/player/podcasts?series=catholictv') === 0) return J(${JSON.stringify(POD_CATHOLICTV)});
  if (p.indexOf('/api/player/podcasts') === 0) return J(${JSON.stringify(POD_INDEX)});
  if (p.indexOf('/api/player/day') === 0) return J(${JSON.stringify(DAY)});
  if (p.indexOf('/api/prayer/day') === 0) return J(${JSON.stringify(DAY)});
  if (p.indexOf('/api/prayer/mass?') === 0) return J(${JSON.stringify(MASS_PAYLOAD)});
  if (p.indexOf('/api/prayer/mass-readings') === 0) return J(${JSON.stringify(MASS_FEED)});
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

const server = http.createServer((req, res) => {
  const u = (req.url || '/').split('?')[0];
  const map = { '/v499': buildPage(COOKED, APP_CSS), '/base': buildPage(COOKED_BASE, APP_CSS_BASE) };
  if (map[u]) { res.setHeader('Content-Type', 'text/html'); res.end(map[u]); return; }
  res.statusCode = 404; res.end('not found');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });

async function boot(which, preset, errs, tag) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (preset) await ctx.addInitScript((kv) => { for (const k in kv) { try { localStorage.setItem(k, kv[k]); } catch (e) {} } }, preset);
  const page = await ctx.newPage();
  await ctx.route('**/*', (route) => { if (route.request().url().startsWith(ORIGIN)) route.continue(); else route.abort(); });
  page.on('pageerror', (e) => { errs.push(String(e).slice(0, 160)); console.log('note -', tag, 'pageerror:', String(e).slice(0, 140)); });
  await page.goto(ORIGIN + which);
  await sleep(1600);
  return { ctx, page };
}

/* ---------------- runtime: the Pray home ---------------- */
const errs = [];
{
  const { ctx, page } = await boot('/v499', null, errs, 'v499-home');
  await page.evaluate(() => { const t = document.querySelector('#tabbar .tab[data-tab="prayers"]'); if (t) t.click(); });
  await sleep(1200);
  const home = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#home-body [data-openblock]')).map((c) => c.getAttribute('data-openblock'));
    return {
      rows,
      playAll: !!document.getElementById('play-all'),
      playAllText: Array.from(document.querySelectorAll('#view button')).some((b) => b.textContent.trim() === 'Play All'),
      offline: !!document.querySelector('#offline-line, .offline-line, [id*="offline"]'),
      viewText: (document.getElementById('view') || {}).textContent || '',
      dock: !!document.getElementById('dock'),
    };
  });
  ok(JSON.stringify(home.rows) === JSON.stringify(['Novenas', 'Morning', 'Midmorning']),
    'R1: the Pray home paints the blocks in the new order — Novenas first, no Mass and Homilies row', home.rows.join(' · '));
  ok(!home.playAll && !home.playAllText, 'R2: no Play All control stands at the bottom of the Praylist (by id, and by label)');
  ok(home.offline || /offline/i.test(home.viewText), 'R3: the offline line still stands below the rows');
  ok(home.dock, 'R4: the mini player dock stands in the shell');

  // the block page keeps its own Play All (the [data-queue] bar button)
  await page.evaluate(() => { const c = document.querySelector('#home-body [data-openblock="Novenas"]'); if (c) c.click(); });
  await sleep(1200);
  const blockPage = await page.evaluate(() => ({
    queueBtn: !!document.querySelector('#hdrrow2 [data-queue], #view [data-queue]'),
    queueBlock: (document.querySelector('#hdrrow2 [data-queue]') || {}).getAttribute ? document.querySelector('#hdrrow2 [data-queue]').getAttribute('data-queue') : null,
    title: (document.getElementById('hdr2-title') || {}).textContent || null,
  }));
  ok(blockPage.queueBtn, 'R5: the block page\u2019s own Play All (the bar\u2019s queue button) still stands', JSON.stringify(blockPage));
  await ctx.close();
}

/* ---------------- runtime: Virtual Mass ---------------- */
{
  const { ctx, page } = await boot('/v499', null, errs, 'v499-virtual');
  await page.evaluate(() => { const t = document.querySelector('#tabbar .tab[data-tab="mass"]'); if (t) t.click(); });
  await sleep(1000);
  await page.evaluate(() => { const b = document.querySelector('#sidetoggle [data-side="virtual"]'); if (b) b.click(); });
  await sleep(1000);
  const list = await page.evaluate(() => Array.from(document.querySelectorAll('[data-massventry]')).map((c) => ({
    key: c.getAttribute('data-massventry'),
    title: (c.querySelector('h3') || {}).textContent || null,
    meta: (c.querySelector('.meta') || {}).textContent || null,
  })));
  ok(JSON.stringify(list.map((e) => e.title)) === JSON.stringify(['Catholic TV Mass', 'Daily TV Mass', 'Springfield Mass']),
    'R6: Virtual Mass lists Catholic TV Mass · Daily TV Mass · Springfield Mass in order', list.map((e) => e.title).join(' · '));
  ok(list[2] && list[2].meta === 'St. Thomas the Apostle · West Springfield',
    'R7: the Springfield entry\u2019s meta names its parish', list[2] && list[2].meta);

  await page.click('[data-massventry="dailytv-mass"]');
  await sleep(1400);
  const dtm = await page.evaluate(() => ({
    fetched: window.__fetchLog.some((f) => f.indexOf('/api/player/podcasts?series=dailytvmass') === 0),
    title: (document.getElementById('hdr2-title') || {}).textContent || null,
    rows: Array.from(document.querySelectorAll('#view [data-watch], #view .card h3')).map((h) => h.textContent).slice(0, 20),
    viewText: ((document.getElementById('view') || {}).textContent || '').slice(0, 4000),
  }));
  ok(dtm.fetched && dtm.title === 'Daily TV Mass', 'R8: the Daily TV Mass entry opens its series page (route fetched, page titled)', JSON.stringify({ f: dtm.fetched, t: dtm.title }));
  ok(dtm.viewText.includes('Catholic Mass Today | Daily TV Mass, Tuesday November 17, 2026'),
    'R9: the Daily TV Mass series page carries today\u2019s Mass video from the real channel feed');
  await page.evaluate(() => { const b = document.querySelector('[data-podback]'); if (b) b.click(); });
  await sleep(1000);

  await page.click('[data-massventry="springfield-mass"]');
  await sleep(1400);
  const spr = await page.evaluate(() => ({
    fetched: window.__fetchLog.some((f) => f.indexOf('/api/player/podcasts?series=springfieldmass') === 0),
    title: (document.getElementById('hdr2-title') || {}).textContent || null,
    viewText: ((document.getElementById('view') || {}).textContent || '').slice(0, 4000),
  }));
  ok(spr.fetched && spr.title === 'Springfield Mass', 'R10: the Springfield Mass entry opens its series page (route fetched, page titled)', JSON.stringify({ f: spr.fetched, t: spr.title }));
  ok(spr.viewText.includes('Daily Mass Tuesday, November 17, 2026'),
    'R11: the Springfield series page carries today\u2019s daily Mass at its head');
  await ctx.close();
}

/* ---------------- runtime: the Lectionary scroll is byte-identical ---------------- */
{
  const errsB = [];
  const a = await boot('/v499', null, errs, 'v499-mass');
  await a.page.evaluate(() => { const t = document.querySelector('#tabbar .tab[data-tab="mass"]'); if (t) t.click(); });
  await sleep(1400);
  const scrollA = await a.page.evaluate(() => { const el = document.querySelector('.mass-scroll'); return el ? el.outerHTML : null; });
  await a.ctx.close();
  const b = await boot('/base', null, errsB, 'base-mass');
  await b.page.evaluate(() => { const t = document.querySelector('#tabbar .tab[data-tab="mass"]'); if (t) t.click(); });
  await sleep(1400);
  const scrollB = await b.page.evaluate(() => { const el = document.querySelector('.mass-scroll'); return el ? el.outerHTML : null; });
  await b.ctx.close();
  ok(!!scrollA && scrollA === scrollB, 'R12: the Mass Lectionary scroll renders byte-identical to the v498 ship',
    scrollA == null ? 'no .mass-scroll on the v499 page' : (scrollB == null ? 'no .mass-scroll on the base page' : 'len ' + scrollA.length + ' vs ' + scrollB.length));
}

ok(errs.length === 0, 'R13: no page errors across the v499 boots', errs.slice(0, 2).join(' | '));

await browser.close();
server.close();
console.log('\nharness-v499: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) console.log('failures: ' + failures.join(' · '));
process.exit(fail ? 1 : 0);
