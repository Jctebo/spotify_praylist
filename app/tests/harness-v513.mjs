// harness-v513.mjs — v513 evidence: the Now Playing
// progress bar does not track the playing track
// (John, Ora Pro Nobis thread, 2026-11-17 17:34 CT,
// with his Now Playing screenshot): "This page
// player file thing is not tracking with the actual
// track" — on the Now Playing page (Traditional
// Novena to St Catherine of Alexandria, Day 2 ·
// Novenas block), the elapsed time reads 1:44 while
// the progress knob still sits at the start of the
// bar, and the remaining time reads "--:--".
//   The trace (Plan §2, firsthand): the position
//   comes from playPos() — in native mode the
//   mirror's extrapolation — but updateNpSeek takes
//   its duration from npDuration(), which reads only
//   audioEl.duration (NaN in native mode; the page
//   element is not the engine) and the descriptor's
//   durationS (0 for own episodes: the own feed
//   publishes no itunes:duration, so extParseFeed
//   yields 0 and trackDesc stamps 0). The engine
//   DOES publish the true duration in every state
//   event (OraLibraryService.publishNativeState:
//   the contract duration when > 0, else the
//   ExoPlayer's measured length) and the mirror
//   holds it — playPos().dur — the read the dock's
//   progress fill already tracks with.
//   The build: npDuration() consults playPos().dur
//   between the element read and the descriptor
//   fallback — two lines in client.ts, on the Now
//   Playing surface alone (npDuration's only callers
//   are the NP seek paint and its scrub/seek
//   handlers).
//   S statics: client.ts differs from the base by
//     exactly the two inserted lines (normalized
//     diff) · data/route files byte-identical ·
//     ui.ts identical outside the pin
//   P1: cooked parse (the v439 gate)
//   N premise (the base, native mode): the St
//     Catherine descriptor (durationS 0) current +
//     a native event (positionS 104 · durationS
//     248.333) → elapsed '1:44' · bar '0' + disabled
//     · remaining '--:--' (John's screenshot), while
//     the dock fill stands at ~41.9% — the duration
//     reached the page; only Now Playing is blind
//   N legs (the build, the same drive): the bar
//     enabled at 419 · remaining '-2:24' · a tick to
//     200 advances it to 805 · a playing event tracks
//     live · a zero-duration event (the engine not
//     yet measured) stays honestly blank, then the
//     measured event lands and it tracks
//   N seek: the bar at 500 previews '2:04'/'-2:04'
//     and the commit sends ONE native seekTo at half
//     the true duration
//   X legs (the other routes): a descriptor-carried
//     duration (an external episode, durationS 1500)
//     in web mode tracks from the descriptor · the
//     own descriptor in web mode tracks from the
//     element's own duration, the first read as
//     before
//   I legs: the dock's outerHTML with the same
//     current is byte-identical base vs build · the
//     Pray tab's paint is byte-identical
//   Chromium boot clean (no page errors)
// Fixtures (Improvement D): the St Catherine
// descriptor is drawn from the LIVE own feed item
// fetched 2026-11-17 (title as ownFeedTitle yields
// it · the real enclosure URL · durationS 0 because
// the item carries no itunes:duration element) with
// the true duration 248.333 s from the Spotify
// playlist record pulled the same day (248333 ms);
// the native state event is shaped field-for-field
// from OraLibraryService.publishNativeState
// (Android main @ 9be7c28, read firsthand); the
// external descriptor follows extParseFeed's output
// shape for an itunes:duration-carrying item; the
// day + Mass + readings payloads are the standing
// production-shaped set the v501–v512 harnesses
// boot, the book payload the standing live capture.
// The base tree is read through env H513_BASE
// (default: the v512 ship — the build base; at ship
// compose it points at the v512 ship tree again).
// Run: node app/tests/harness-v513.mjs [--probe]
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
const BASE = process.env.H513_BASE
  ? path.resolve(process.env.H513_BASE)
  : path.resolve(process.cwd(), '../../.worktrees/v512-ship/app/worker/src');
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
  const ANCHOR = '  var d = audioEl.duration;\n  if (isFinite(d) && d > 0) return d;\n  var cur = state.current;';
  const INSERTED = '  var d = audioEl.duration;\n  if (isFinite(d) && d > 0) return d;\n'
    + "  var pd = playPos().dur; // v513: the native mirror's duration — the engine's measured length, the read the dock progress already tracks with; in web mode it is the element's own duration, already answered above\n"
    + '  if (pd > 0) return pd;\n  var cur = state.current;';
  const count = (s, sub) => s.split(sub).length - 1;
  ok(count(C_BASE, ANCHOR) === 1, 'S1: the base npDuration anchor stands exactly once');
  ok(C_BASE.replace(ANCHOR, INSERTED) === C_SRC,
    'S2: client.ts differs from the base by exactly the two mirror lines in npDuration — the base with those lines inserted equals the build byte-for-byte');
  ok(count(C_SRC, 'var pd = playPos().dur;') === 1 && count(C_BASE, 'playPos().dur') === 0,
    'S3: the mirror read stands once in the build and nowhere in the base npDuration');
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
   stamps them. NP_DESC: the own novena descriptor —
   durationS 0, as the live feed yields it. EXT_DESC:
   an external descriptor whose duration rode its
   feed's itunes:duration through extParseFeed. */
const NP_DESC = { episodeId: 'novena-st-catherine-of-alexandria', title: 'Traditional Novena to St Catherine of Alexandria Day 2', url: ENC, enclosureUrl: ENC, available: true, block: 'Novenas', source: '', durationS: 0, imageUrl: '/logo.png', descText: null, spotifyUrl: null };
const EXT_DESC = { episodeId: 'ext-evening-prayer', title: 'Evening Prayer', url: 'https://media.example/evening-prayer.mp3', enclosureUrl: null, available: true, block: 'Evening', source: 'Divine Office', durationS: 1500, imageUrl: null, descText: null, spotifyUrl: null };
const TRUE_DUR = 248.333; // the episode's true length: Spotify playlist record, 248333 ms

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
  '/v513-native': buildPage(COOKED, APP_CSS, true),
  '/base-native': buildPage(COOKED_BASE, APP_CSS_BASE, true),
  '/v513-web': buildPage(COOKED, APP_CSS, false),
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

/* ---- N premise: the base, native mode ---- */
{
  const b = await boot('/base-native', 'base-native');
  await npOpen(b.page, NP_DESC);
  await npEvent(b.page, 104, TRUE_DUR, false);
  const bi = await npRead(b.page);
  ok(bi.title === NP_DESC.title && bi.elapsed === '1:44' && bi.remain === '--:--' && bi.barVal === '0' && bi.barDisabled === true,
    'N0 (premise): the base reproduces John\'s screenshot — elapsed 1:44 runs, the knob sits at 0 on a disabled bar, remaining --:--',
    JSON.stringify(bi));
  ok(parseFloat(bi.dockFill) > 40,
    'N0b (premise): on the same base the dock fill tracks (~41.9%) — the duration reached the page through the mirror; only Now Playing is blind to it',
    String(bi.dockFill));
  await b.ctx.close();
}

/* ---- N legs: the build, native mode ---- */
{
  const v = await boot('/v513-native', 'v513-native');
  await npOpen(v.page, NP_DESC);
  await npEvent(v.page, 104, 0, false);
  const z = await npRead(v.page);
  ok(z.elapsed === '1:44' && z.remain === '--:--' && z.barDisabled === true,
    'N1: before the engine measures (a zero-duration event) the bar stays honestly blank — the fix invents no duration',
    JSON.stringify(z));
  await npEvent(v.page, 104, TRUE_DUR, false);
  const vi = await npRead(v.page);
  ok(vi.title === NP_DESC.title && vi.elapsed === '1:44' && vi.remain === '-2:24' && vi.barVal === '419' && vi.barDisabled === false,
    'N2: the measured duration lands — elapsed 1:44 · remaining -2:24 · the bar enabled at 419 (the elapsed/duration fraction)',
    JSON.stringify(vi));
  await npEvent(v.page, 200, TRUE_DUR, false);
  const vt = await npRead(v.page);
  ok(vt.elapsed === '3:20' && vt.remain === '-0:48' && vt.barVal === '805',
    'N3: a position tick advances the knob with the track — elapsed 3:20 · remaining -0:48 · bar 805',
    JSON.stringify(vt));
  await npEvent(v.page, 104, TRUE_DUR, true);
  await sleep(200);
  const vp = await npRead(v.page);
  ok(vp.remain === '-2:24' && vp.barDisabled === false && Number(vp.barVal) >= 415 && Number(vp.barVal) <= 425,
    'N4: a playing event tracks live — the mirror extrapolation paints the bar and the countdown',
    JSON.stringify(vp));
  /* N seek: drive the bar to the halfway point */
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
  ok(seek.preview.elapsed === '2:04' && seek.preview.remain === '-2:04',
    'N5: the scrub preview reads against the true duration — elapsed 2:04 · remaining -2:04 at the halfway point',
    JSON.stringify(seek.preview));
  ok(seekTos.length === 1 && Math.abs(seekTos[0].positionS - TRUE_DUR / 2) < 0.5,
    'N6: the commit sends exactly one native seekTo at the tapped fraction of the true duration (~124.17 s)',
    JSON.stringify(seekTos));
  await v.ctx.close();
}

/* ---- X legs: the other duration routes (web mode) ---- */
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
  const v = await boot('/v513-web', 'v513-web');
  const x1 = await webDrive(v.page, EXT_DESC, 300, NaN);
  ok(x1.elapsed === '5:00' && x1.remain === '-20:00' && x1.barVal === '200' && x1.barDisabled === false,
    'X1: the descriptor route stands — an external episode (durationS 1500 from its feed) tracks from the descriptor in web mode',
    JSON.stringify(x1));
  const x2 = await webDrive(v.page, NP_DESC, 104, TRUE_DUR);
  ok(x2.elapsed === '1:44' && x2.remain === '-2:24' && x2.barVal === '419' && x2.barDisabled === false,
    'X2: the element route stands first, as before — the own descriptor in web mode tracks from the element\'s own duration',
    JSON.stringify(x2));
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
  const vd = await dockOf('/v513-web', 'v513-dock');
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
  const vp2 = await tabPaint('/v513-web', 'v513-pray');
  ok(vp2 === bp, 'I2: the Pray tab\'s paint (the block pages) is byte-identical to the base ship\'s');
}

ok(allErrs.length === 0, 'B1: Chromium boot clean — no page errors on any boot', allErrs.join(' | ').slice(0, 200));

await browser.close();
server.close();
console.log('harness-v513: ' + pass + ' passed / ' + fail + ' failed');
if (failures.length) { console.log('failures:', failures.join(' · ')); process.exit(1); }
