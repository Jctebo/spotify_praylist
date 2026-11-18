// harness-v520.mjs — v520 evidence: the Now Playing
// progress bar tracks PODCAST tracks (the v513 field
// leg, FAILED by John in the Ora Pro Nobis thread,
// 2026-11-17 20:12 CT, "Still broke", with his
// screenshot): playing "Office of Readings" — a
// Divine Office podcast episode standing in the
// Evening block — the bar stands FULL at elapsed
// 2:09 with remaining -0:00.
//   The proven cause (doc §2, production evidence):
//   the episode's true duration stands everywhere
//   except the read npDuration() settles on. The
//   feed publishes itunes:duration 18:50 (1130 s);
//   the descriptor carries 1130; the Android engine
//   publishes 1130 and the phone's own day-position
//   writeback stored duration_s 1130 for this track.
//   But npDuration() reads audioEl.duration FIRST —
//   ahead of v513's mirror read and the descriptor —
//   and in native mode the page element is not the
//   engine (a native start never loads it; it holds
//   at most a paused restore stand or a fallback
//   load), so the element's finite stand length
//   outranks both true reads and paints the bar
//   full: min(pos, dur)/dur = 1, remaining clamped
//   to -0:00.
//   The build: npDuration() reordered — the one
//   position read's duration (playPos().dur) first,
//   the descriptor second, the element last. Web
//   mode is unchanged: there playPos().dur IS the
//   element's own duration.
//   S statics: client.ts differs from the base by
//     exactly the npDuration reorder (normalized
//     diff) · data/route files byte-identical ·
//     ui.ts identical outside the pin
//   P1: cooked parse (the v439 gate)
//   PREMISE (the base, native mode): the podcast
//     descriptor (durationS 1130) current + the
//     element stand at 107 (production's own value)
//     + a native event (positionS 129 · durationS
//     1130) → elapsed '2:09' · bar 1000 (full) ·
//     remaining '-0:00' — John's field state — while
//     the dock fill tracks at ~11.4%
//   BUILD legs (the same drive): elapsed '2:09' ·
//     remaining '-16:41' · bar 114 · a tick to the
//     production position 777 → '12:57' · '-5:53' ·
//     bar 688 · a scrub to halfway previews
//     '9:25'/'-9:25' and commits one native seekTo
//     at ~565 s
//   NOVENA regression (v513's legs on the build):
//     a zero-duration event stays honestly blank ·
//     the measured event tracks (104 of 248.333 →
//     '1:44' · '-2:24' · 419) · a tick advances it
//   X legs (web mode): the descriptor route stands ·
//     the element route stands (through the position
//     read, the same value) · no duration anywhere
//     stays blank
//   I legs: the dock's outerHTML with the same
//     current is byte-identical base vs build · the
//     Pray tab's paint is byte-identical
//   Chromium boot clean (no page errors)
// Fixtures (Improvement D): the podcast descriptor
// is shaped as trackDesc stamps the external slot
// track for the field case itself — the Divine
// Office "Office of Readings" item of Nov 17, 2026
// from the live feed fetched 2026-11-17 (the real
// enclosure URL · durationS 1130 from the item's
// itunes:duration "18:50" through the app's own
// extParseDuration); the element stand is
// production's own value — 107 s, the length the
// phone's day-position writeback stored tonight
// for the prayer stand that held the element
// (2026-11-17 / prayer:te-deum:en, duration_s 107);
// the native state events are shaped field-for-field
// from OraLibraryService.publishNativeState
// (Android main @ 9be7c28, read firsthand) and the
// podcast positions are the field case's own
// numbers (129 from John's screenshot · 777 from
// tonight's production writeback for this track);
// the novena descriptor + true duration carry
// v513's fixtures unchanged (the live own feed item
// fetched 2026-11-17, durationS 0 · 248.333 s from
// the Spotify playlist record pulled the same day);
// the day + Mass + readings payloads are the
// standing production-shaped set the v501–v519
// harnesses boot, the book payload the standing
// live capture. The base tree is read through env
// H520_BASE (default: the v519 ship — the build
// base; at ship compose it points at the v519 ship
// tree again).
// Run: node app/tests/harness-v520.mjs [--probe]
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
const BASE = process.env.H520_BASE
  ? path.resolve(process.env.H520_BASE)
  : path.resolve(process.cwd(), '../../.worktrees/v519-ship/app/worker/src');
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
  const OLD = 'function npDuration() {\n'
    + '  var d = audioEl.duration;\n'
    + '  if (isFinite(d) && d > 0) return d;\n'
    + "  var pd = playPos().dur; // v513: the native mirror's duration — the engine's measured length, the read the dock progress already tracks with; in web mode it is the element's own duration, already answered above\n"
    + '  if (pd > 0) return pd;\n'
    + '  var cur = state.current;\n'
    + '  if (cur && cur.durationS > 0) return cur.durationS;\n'
    + '  return 0;\n'
    + '}';
  const NEW = 'function npDuration() {\n'
    + "  var pd = playPos().dur; // v520: the one position read stands first — in native mode the engine's published duration (the contract's, else its measured length; v513's mirror read); in web mode it is the element's own duration. The page element's own duration stands last: in native mode the element is not the engine (it holds a paused restore stand or a fallback load), and its finite length outranked the true reads and painted the bar full on podcast tracks (the v513 field leg)\n"
    + '  if (pd > 0) return pd;\n'
    + '  var cur = state.current;\n'
    + '  if (cur && cur.durationS > 0) return cur.durationS;\n'
    + '  var d = audioEl.duration;\n'
    + '  if (isFinite(d) && d > 0) return d;\n'
    + '  return 0;\n'
    + '}';
  const count = (s, sub) => s.split(sub).length - 1;
  ok(count(C_BASE, OLD) === 1, 'S1: the base npDuration block stands exactly once (element read first, as shipped in v519)');
  ok(C_BASE.replace(OLD, NEW) === C_SRC,
    'S2: client.ts differs from the base by exactly the npDuration reorder — the base with the block swapped equals the build byte-for-byte');
  ok(count(C_SRC, NEW) === 1 && count(C_SRC, 'function npDuration()') === 1,
    'S3: the reordered npDuration stands once in the build');
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

const ENC = 'https://audio.orapronobis.media/2026-11-17-st_catherine_of_alexandria-day-2.mp3';
const DAY = {
  ok: true, date: '2026-11-17', presentedDay: '2026-11-17',
  dateLabel: 'Tuesday, November 17, 2026',
  liturgicalDay: { name: 'Memorial of Saint Elizabeth of Hungary, Religious', color: 'white' },
  introTexts: {},
  blocks: [
    { block: 'Novenas', label: 'Novenas', tracks: [
      { episodeId: 'novena-st-catherine-of-alexandria', title: 'Traditional Novena to St Catherine of Alexandria Day 2', durationS: 0, available: true, streamUrl: ENC, enclosureUrl: ENC },
    ] },
    { block: 'Morning', label: 'Morning', tracks: [
      { episodeId: '9001', title: 'Invitatory', durationS: 240, available: true, streamUrl: 'https://audio.example/9001.mp3' },
      { episodeId: '9002', title: 'Morning Prayer', durationS: 720, available: true, streamUrl: 'https://audio.example/9002.mp3' },
    ] },
  ],
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

/* The descriptors the legs drive, shaped as trackDesc
   stamps them. DO_DESC: the field case itself — the
   Divine Office podcast episode, its durationS from
   the feed's itunes:duration. NP_DESC: the own
   novena descriptor (v513's fixture) — durationS 0,
   as the own feed yields it. EXT_DESC: an external
   descriptor whose duration rode its feed's
   itunes:duration (v513's web fixture). */
const DO_URL = 'https://media.blubrry.com/divineoffice/traffic.libsyn.com/divineoffice/divine-1117-or.2026.mp3?prayer=OfficeOfReadings&date=20261117&episode=202611174';
const DO_DESC = { episodeId: 'ext-office-of-readings', title: 'Office of Readings', url: DO_URL, enclosureUrl: DO_URL, available: true, block: 'Evening', source: 'Divine Office', durationS: 1130, imageUrl: '/logo.png', descText: null, spotifyUrl: null };
const NP_DESC = { episodeId: 'novena-st-catherine-of-alexandria', title: 'Traditional Novena to St Catherine of Alexandria Day 2', url: ENC, enclosureUrl: ENC, available: true, block: 'Novenas', source: '', durationS: 0, imageUrl: '/logo.png', descText: null, spotifyUrl: null };
const EXT_DESC = { episodeId: 'ext-evening-prayer', title: 'Evening Prayer', url: 'https://media.example/evening-prayer.mp3', enclosureUrl: null, available: true, block: 'Evening', source: 'Divine Office', durationS: 1500, imageUrl: null, descText: null, spotifyUrl: null };
const DO_DUR = 1130;      // the episode's true length: the feed's itunes:duration 18:50
const STAND_DUR = 107;    // the element stand's length: production's prayer stand (te-deum, duration_s 107)
const TRUE_DUR = 248.333; // the novena's true length: Spotify playlist record, 248333 ms

const BRIDGE_STUB = `
window.__contracts = [];
window.__commands = [];
window.__pushes = [];
window.__listeners = {};
window.__installBridge = function () {
  var bridge = {
    setNativeQueue: function (call) { window.__contracts.push(JSON.parse(call.queue)); return Promise.resolve(); },
    nativeTransport: function (call) { window.__commands.push(JSON.parse(call.command)); return Promise.resolve(); },
    setPlaybackState: function (call) { window.__pushes.push(JSON.parse(call.state)); return Promise.resolve(); },
    setDaySnapshot: function () { return Promise.resolve(); },
    armSleepDeadline: function () { return Promise.resolve(); },
    clearSleepDeadline: function () { return Promise.resolve(); },
    takeNativeCompletions: function () { return Promise.resolve({ records: [] }); },
    downloadPodcast: function () { return Promise.resolve({ standing: true, sizeBytes: 4321 }); },
    deletePodcastDownload: function () { return Promise.resolve({ standing: false }); },
    getPodcastDownloads: function () { return Promise.resolve({ standing: [] }); },
    addListener: function (name, fn) { (window.__listeners[name] = window.__listeners[name] || []).push(fn); },
    oneEngine: function () { return Promise.resolve({ oneEngine: true }); },
  };
  window.Capacitor = { Plugins: { OraDayBridge: bridge } };
};
window.__installBridge();
window.__emitNative = function (obj) {
  var hs = window.__listeners.nativeState || [];
  hs.forEach(function (f) { f({ state: JSON.stringify(obj) }); });
};
`;

function buildPage(cooked, css, native) {
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
  const ans = function (status, body) { return Promise.resolve({ ok: status < 400, status: status, json: function () { return Promise.resolve(body); }, text: function () { return Promise.resolve(''); } }); };
  if (p.indexOf('/api/player/day') === 0) return ans(200, ${JSON.stringify(DAY)});
  if (p.indexOf('/api/prayer/mass?') === 0) return ans(200, ${JSON.stringify(MASS_PAYLOAD)});
  if (p.indexOf('/api/prayer/mass-readings') === 0) return ans(200, ${JSON.stringify(MASS_FEED)});
  if (p.indexOf('/api/prayer/book') === 0) return ans(200, BOOK_STUB || { ok: true, groups: [] });
  if (p.indexOf('/api/prayer/mass-personal-prayer') === 0) return ans(200, { ok: true, before: [], after: [], afterMass: [], preMass: [] });
  if (p.indexOf('/api/pin/state') === 0) return ans(200, { ok: true, pinSet: false });
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
${native ? '<script>' + BRIDGE_STUB + '</' + 'script>' : ''}
<script>
${cooked}
</` + `script>
</body></html>`;
}

const PAGES = {
  '/v520-native': buildPage(COOKED, APP_CSS, true),
  '/base-native': buildPage(COOKED_BASE, APP_CSS_BASE, true),
  '/v520-web': buildPage(COOKED, APP_CSS, false),
  '/base-web': buildPage(COOKED_BASE, APP_CSS_BASE, false),
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

/* Drive Now Playing in native mode: the descriptor
   stands current, the sheet opens, and native state
   events land in publishNativeState's shape. */
async function npOpen(page, desc) {
  await page.evaluate((d) => {
    state.queue = [d]; state.queueIdx = 0; state.current = d;
    nativeContractDescs = [d];
    openNowPlaying();
    window.__npEvent = function (positionS, durationS, playing) {
      window.__emitNative({ engine: 'native', trackId: d.episodeId, kind: 'episode', title: d.title, subtitle: '',
        block: d.block, dateLabel: state.dateLabel, playing: playing, stopped: false, positionS: positionS,
        durationS: durationS, estimated: false, queueIndex: 0, queueCount: 1, queueIds: [d.episodeId], rate: 1, ts: Date.now() });
    };
    window.__npRead = function () {
      var s = document.querySelector('.np-sheet');
      var f = document.getElementById('dock-progress-fill');
      return { title: s.querySelector('#np-title').textContent,
        elapsed: s.querySelector('#np-elapsed').textContent, remain: s.querySelector('#np-remain').textContent,
        barVal: s.querySelector('#np-seek').value, barDisabled: s.querySelector('#np-seek').disabled,
        dockFill: f ? f.style.width : null };
    };
  }, desc);
}
const npEvent = (page, pos, dur, playing) => page.evaluate(([p, d, pl]) => window.__npEvent(p, d, pl), [pos, dur, playing]);
const npRead = (page) => page.evaluate(() => window.__npRead());
/* The page element's stand: in native mode the
   element is not the engine — it holds a paused
   restore stand's metadata. Install its length. */
const standElement = (page, dur) => page.evaluate((d) => {
  var el = document.getElementById('audio');
  Object.defineProperty(el, 'duration', { get: function () { return d; }, configurable: true });
}, dur);

/* ---- PREMISE: the base, native mode, the podcast drive ---- */
{
  const b = await boot('/base-native', 'base-native');
  await standElement(b.page, STAND_DUR);
  await npOpen(b.page, DO_DESC);
  await npEvent(b.page, 129, DO_DUR, false);
  const bi = await npRead(b.page);
  ok(bi.title === DO_DESC.title && bi.elapsed === '2:09' && bi.remain === '-0:00' && bi.barVal === '1000' && bi.barDisabled === false,
    'PREMISE: the base reproduces John\'s field state — elapsed 2:09 runs, the bar stands FULL at 1000, remaining -0:00 (the element stand\'s 107 s outranks the mirror\'s and the descriptor\'s 1130)',
    JSON.stringify(bi));
  ok(parseFloat(bi.dockFill) > 10 && parseFloat(bi.dockFill) < 13,
    'PREMISE-b: on the same base the dock fill tracks (~11.4%) — the true duration reached the page through the mirror; only Now Playing\'s first read is wrong',
    String(bi.dockFill));
  await b.ctx.close();
}

/* ---- BUILD legs: the podcast drive on the build ---- */
{
  const v = await boot('/v520-native', 'v520-native');
  await standElement(v.page, STAND_DUR);
  await npOpen(v.page, DO_DESC);
  await npEvent(v.page, 129, DO_DUR, false);
  const vi = await npRead(v.page);
  ok(vi.title === DO_DESC.title && vi.elapsed === '2:09' && vi.remain === '-16:41' && vi.barVal === '114' && vi.barDisabled === false,
    'BUILD-1: the podcast track tracks — elapsed 2:09 · remaining -16:41 (of 1130 s) · the bar at 114, the elapsed/duration fraction',
    JSON.stringify(vi));
  await npEvent(v.page, 777, DO_DUR, false);
  const vt = await npRead(v.page);
  ok(vt.elapsed === '12:57' && vt.remain === '-5:53' && vt.barVal === '688',
    'BUILD-2: a tick to the production writeback position advances the bar with the track — elapsed 12:57 · remaining -5:53 · bar 688',
    JSON.stringify(vt));
  const seek = await v.page.evaluate(() => {
    var bar = document.querySelector('.np-sheet #np-seek');
    bar.value = '500';
    bar.dispatchEvent(new Event('input'));
    var s = document.querySelector('.np-sheet');
    var preview = { elapsed: s.querySelector('#np-elapsed').textContent, remain: s.querySelector('#np-remain').textContent };
    bar.dispatchEvent(new Event('change'));
    return { preview: preview, commands: window.__commands.slice() };
  });
  const seekTos = seek.commands.filter((c) => c && c.command === 'seekTo');
  ok(seek.preview.elapsed === '9:25' && seek.preview.remain === '-9:25',
    'BUILD-3: the scrub preview reads against the true duration — elapsed 9:25 · remaining -9:25 at the halfway point',
    JSON.stringify(seek.preview));
  ok(seekTos.length === 1 && Math.abs(seekTos[0].positionS - DO_DUR / 2) < 0.5,
    'BUILD-4: the commit sends exactly one native seekTo at the tapped fraction of the true duration (~565 s)',
    JSON.stringify(seekTos));
  await v.ctx.close();
}

/* ---- NOVENA regression: v513's legs on the build ---- */
{
  const v = await boot('/v520-native', 'v520-novena');
  await npOpen(v.page, NP_DESC);
  await npEvent(v.page, 104, 0, false);
  const z = await npRead(v.page);
  ok(z.elapsed === '1:44' && z.remain === '--:--' && z.barDisabled === true,
    'NOVENA-1: before the engine measures (a zero-duration event) the bar stays honestly blank — the reorder invents no duration',
    JSON.stringify(z));
  await npEvent(v.page, 104, TRUE_DUR, false);
  const vi = await npRead(v.page);
  ok(vi.title === NP_DESC.title && vi.elapsed === '1:44' && vi.remain === '-2:24' && vi.barVal === '419' && vi.barDisabled === false,
    'NOVENA-2: v513\'s leg stands — elapsed 1:44 · remaining -2:24 · the bar enabled at 419',
    JSON.stringify(vi));
  await npEvent(v.page, 200, TRUE_DUR, false);
  const vt = await npRead(v.page);
  ok(vt.elapsed === '3:20' && vt.remain === '-0:48' && vt.barVal === '805',
    'NOVENA-3: a position tick advances the knob with the track — elapsed 3:20 · remaining -0:48 · bar 805',
    JSON.stringify(vt));
  await v.ctx.close();
}

/* ---- X legs: the web-mode routes (unchanged) ---- */
async function webDrive(page, desc, t, d) {
  return page.evaluate(([dc, tt, dd]) => {
    var el = document.getElementById('audio');
    window.__pos = { t: tt, d: dd };
    Object.defineProperty(el, 'currentTime', { get: function () { return window.__pos.t; }, set: function (v) { window.__pos.t = v; }, configurable: true });
    Object.defineProperty(el, 'duration', { get: function () { return window.__pos.d; }, configurable: true });
    state.queue = [dc]; state.queueIdx = 0; state.current = dc;
    openNowPlaying();
    updateNpSeek();
    var s = document.querySelector('.np-sheet');
    return { elapsed: s.querySelector('#np-elapsed').textContent, remain: s.querySelector('#np-remain').textContent,
      barVal: s.querySelector('#np-seek').value, barDisabled: s.querySelector('#np-seek').disabled };
  }, [desc, t, d]);
}
{
  const v = await boot('/v520-web', 'v520-web');
  const x1 = await webDrive(v.page, EXT_DESC, 300, NaN);
  ok(x1.elapsed === '5:00' && x1.remain === '-20:00' && x1.barVal === '200' && x1.barDisabled === false,
    'X1: the descriptor route stands — an external episode (durationS 1500 from its feed) tracks from the descriptor in web mode',
    JSON.stringify(x1));
  const x2 = await webDrive(v.page, NP_DESC, 104, TRUE_DUR);
  ok(x2.elapsed === '1:44' && x2.remain === '-2:24' && x2.barVal === '419' && x2.barDisabled === false,
    'X2: the element route stands, as before — the own descriptor in web mode tracks from the element\'s own duration (now reached through the position read, the same value)',
    JSON.stringify(x2));
  const x3 = await webDrive(v.page, NP_DESC, 104, NaN);
  ok(x3.elapsed === '1:44' && x3.remain === '--:--' && x3.barDisabled === true,
    'X3: no duration anywhere stays blank in web mode — the reorder invents nothing there either',
    JSON.stringify(x3));
  await v.ctx.close();
}

/* ---- I legs: untouched surfaces ---- */
{
  const dockOf = async (which, tag) => {
    const s = await boot(which, tag);
    const html = await s.page.evaluate((dc) => {
      state.queue = [dc]; state.queueIdx = 0; state.current = dc;
      updateDock();
      return document.getElementById('dock').outerHTML;
    }, EXT_DESC);
    await s.ctx.close();
    return html;
  };
  const bd = await dockOf('/base-web', 'base-dock');
  const vd = await dockOf('/v520-web', 'v520-dock');
  ok(vd === bd, 'I1: the dock (mini player) paint with the same current is byte-identical to the base ship\'s');
  const tabPaint = async (which, tag) => {
    const s = await boot(which, tag);
    await s.page.click('#tabbar .tab[data-tab="prayers"]');
    await s.page.waitForSelector('#sidehost', { timeout: 20000 }).catch(() => console.log('note -', tag, 'pray slow'));
    await sleep(900);
    const html = await s.page.evaluate(() => document.getElementById('view').innerHTML);
    await s.ctx.close();
    return html;
  };
  const bp = await tabPaint('/base-web', 'base-pray');
  const vp2 = await tabPaint('/v520-web', 'v520-pray');
  ok(vp2 === bp, 'I2: the Pray tab\'s paint (the block pages) is byte-identical to the base ship\'s');
}

ok(allErrs.length === 0, 'B1: Chromium boot clean — no page errors on any boot', allErrs.join(' | ').slice(0, 200));

await browser.close();
server.close();
console.log('harness-v520: ' + pass + ' passed / ' + fail + ' failed');
if (failures.length) { console.log('failures:', failures.join(' · ')); process.exit(1); }
