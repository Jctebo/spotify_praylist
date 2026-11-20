// harness-v491.mjs — v491 evidence: the Exit player act.
// John's defect (Ora thread, 2026-11-17 06:22 CT): no standing
// act stops playback AND unloads the queue AND dismisses the
// dock. v491 adds exitPlayer() + an 'Exit player' item in both
// Playback overflow menus (the dock menu of John's screenshot
// and the Now Playing player menu).
// Legs (the real SHELL_HTML + APP_CSS + the whole cooked client
// in Chromium — the v439/v478 mold; a fake Capacitor bridge for
// the native legs; fetch stubbed with a POST log):
//   X   statics — the act's shape and order · both menus carry
//       the item · the Mass render path byte-identical to the
//       v490 ship tree · mass sources + ui.ts untouched
//   P   cooked parse + Chromium boot clean
//   W   web engine — queue stands · menu carries Exit player ·
//       exit saves the day position first (42s), cancels an
//       armed sleep timer, writes NO played mark, clears the
//       queue/current/snapshot, hides the dock · a row play
//       after exit starts fresh and the dock returns · a
//       pending start is cancelled by exit and never lands ·
//       a podcast exit saves the podcast position (77s)
//   N   native engine — exit from Now Playing's menu: exactly
//       one stop transport (a pause lands before it, the
//       service's position writeback seat), page state cleared,
//       dock hidden, Now Playing closed, contract descs gone ·
//       the shell's stopped echo resurrects nothing · a media
//       play press after exit starts nothing
// Fixtures: the day/podcast payloads stand in the v478 mold's
// shape, drawn from the real production payload structure
// (Improvement D).
// Run: node app/tests/harness-v491.mjs   (from the worktree root)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const APP = path.resolve(process.cwd(), 'app');
const SRC = APP + '/worker/src';
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const SHIP = path.resolve(process.cwd(), '../../.worktrees/v490-ship/app/worker/src');
const C490 = readFileSync(SHIP + '/client.ts', 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}

/* ---------------- X: statics ---------------- */
{
  const xp = C_SRC.slice(C_SRC.indexOf('function exitPlayer()'), C_SRC.indexOf('function handleTransportCommand'));
  ok(xp.length > 200, 'X1: exitPlayer() stands in the client');
  const iSave = Math.min(xp.indexOf('podPositionSaveCurrent();'), xp.indexOf('dayPositionSaveCurrent();'));
  const iClear = xp.indexOf('state.queue = [];');
  ok(iSave >= 0 && iClear > iSave, 'X2: exit saves the standing position BEFORE the clear');
  ok((xp.match(/command: 'stop'/g) || []).length === 1 && xp.includes("nativeTransportSend({ command: 'stop' })"),
    'X3: the native clear (stop transport) fires from exactly one seat in the act');
  ok(xp.includes('disarmSleep()') && xp.includes('cancelPendingStart()') && xp.includes('saveQueueSnapshot()') && xp.includes('clearRestoredQueue()'),
    'X4: exit carries the pending-start cancel, the sleep disarm, and the snapshot/restore clears');
  ok(!/markPlayed|writePlayed|podToggleMark|writePodMark/.test(xp), 'X5: exit writes no played mark');
  const dockMenu = C_SRC.slice(C_SRC.indexOf('function openDockMenu'), C_SRC.indexOf('/* FD6'));
  const npMenu = C_SRC.slice(C_SRC.indexOf('function openPlayerMenu'), C_SRC.indexOf('function openDockMenu'));
  ok(dockMenu.includes("{ label: 'Exit player', act: function () { exitPlayer(); } }"), 'X6: the dock overflow menu carries Exit player');
  ok(npMenu.includes("{ label: 'Exit player', act: function () { exitPlayer(); } }"), 'X7: the Now Playing player menu carries Exit player');
  const mStart = C_SRC.indexOf('v486: the Mass tab');
  const mEnd = C_SRC.indexOf("document.querySelectorAll('#tabbar .tab')", mStart);
  const mStart490 = C490.indexOf('v486: the Mass tab');
  const mEnd490 = C490.indexOf("document.querySelectorAll('#tabbar .tab')", mStart490);
  ok(mStart > 0 && C_SRC.slice(mStart, mEnd) === C490.slice(mStart490, mEnd490),
    'X8: the Mass render path is byte-identical to the v490 ship tree');
  let same = true;
  for (const f of ['mass.ts', 'mass-order.ts', 'mass-readings.ts', 'mass-calendar.ts', 'ui.ts']) {
    if (readFileSync(SRC + '/' + f, 'utf8') !== readFileSync(SHIP + '/' + f, 'utf8')) same = false;
  }
  ok(same, 'X9: mass.ts / mass-order.ts / mass-readings.ts / mass-calendar.ts / ui.ts byte-identical to v490 ship');
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
const POD_SERIES = { ok: true, series: 'catechism', title: 'Catechism in a Year', available: true,
  currentKey: 'ep1', listenedCount: 0, total: 2, showImageUrl: '', showDesc: '',
  entries: [
    { key: 'ep1', label: 'Day 1', title: 'In the Beginning', url: 'https://audio.example/ep1.mp3', durationS: 900, listened: false, positionS: 0, kind: 'day' },
    { key: 'ep2', label: 'Day 2', title: 'The Creation', url: 'https://audio.example/ep2.mp3', durationS: 900, listened: false, positionS: 0, kind: 'day' },
  ] };

const FAKE_PLUGIN = `
window.__contracts = []; window.__transports = []; window.__listeners = {};
window.Capacitor = { Plugins: { OraDayBridge: new Proxy({
  oneEngine: true,
  setNativeQueue: function (a) { try { window.__contracts.push(JSON.parse(a.queue)); } catch (e) {} return Promise.resolve({}); },
  nativeTransport: function (c) { try { window.__transports.push(JSON.parse(c.command)); } catch (e) { window.__transports.push(c); } return Promise.resolve({}); },
  setPlaybackState: function () { return Promise.resolve({}); },
  addListener: function (name, fn) { window.__listeners[name] = fn; return Promise.resolve({ remove: function () {} }); },
  takeNativeCompletions: function () { return Promise.resolve({ records: [] }); },
}, { get: function (t, k) { if (k in t) return t[k]; return function () { return Promise.resolve({}); }; } }) } };
`;

function buildPage(native) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${APP_CSS}</style></head>
<body data-lit="">
<audio id="audio"></audio>
${SHELL}
<script>
${native ? FAKE_PLUGIN : ''}
window.__fetchLog = [];
window.fetch = function (path, opts) {
  const p = String(path);
  const method = (opts && opts.method) || 'GET';
  let body = null;
  try { body = opts && opts.body ? JSON.parse(opts.body) : null; } catch (e) {}
  window.__fetchLog.push({ path: p, method: method, body: body });
  if (p.indexOf('/api/player/day') === 0) return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(${JSON.stringify(DAY)}); } });
  if (p.indexOf('/api/player/podcasts?series=') === 0) return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(${JSON.stringify(POD_SERIES)}); } });
  if (p.indexOf('/api/player/podcasts') === 0) return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(${JSON.stringify(POD_INDEX)}); } });
  if (p.indexOf('/api/player/feed-audio') === 0) return Promise.resolve(new Response(new Blob(['mp3'], { type: 'audio/mpeg' }), { status: 200 }));
  return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true }); } });
};
function extFetchText(url) { return Promise.reject(new Error('offline')); }
URL.createObjectURL = function () { return 'blob:fake'; };
URL.revokeObjectURL = function () {};
HTMLMediaElement.prototype.play = function () { const el = this; setTimeout(function(){ el.dispatchEvent(new Event('play')); }, 10); return Promise.resolve(); };
HTMLMediaElement.prototype.pause = function () { this.dispatchEvent(new Event('pause')); };
HTMLMediaElement.prototype.load = function () {};
window.__pos = { t: 0, d: 720 };
window.__armPos = function () {
  const el = document.getElementById('audio');
  Object.defineProperty(el, 'currentTime', { get: function () { return window.__pos.t; }, set: function (v) { window.__pos.t = v; }, configurable: true });
  Object.defineProperty(el, 'duration', { get: function () { return window.__pos.d; }, configurable: true });
};
</` + `script>
<script>
${COOKED}
</` + `script>
</body></html>`;
}

let PAGE_NATIVE = '', PAGE_WEB = '';
const server = http.createServer((req, res) => {
  const u = (req.url || '/').split('?')[0];
  if (u === '/n') { res.setHeader('Content-Type', 'text/html'); res.end(PAGE_NATIVE); return; }
  if (u === '/w') { res.setHeader('Content-Type', 'text/html'); res.end(PAGE_WEB); return; }
  res.statusCode = 404; res.end('not found');
});
PAGE_NATIVE = buildPage(true);
PAGE_WEB = buildPage(false);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });

async function boot(ctx, mode, tag, errs) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { errs.push(String(e).slice(0, 160)); console.log('note -', tag, 'pageerror:', String(e).slice(0, 140)); });
  await page.goto(ORIGIN + (mode === 'native' ? '/n' : '/w'));
  await page.waitForSelector('[data-openblock]', { timeout: 25000 }).catch(() => console.log('note -', tag, 'openblock slow'));
  await sleep(500);
  return page;
}
const dockHidden = (page) => page.evaluate(() => document.getElementById('dock').classList.contains('hidden'));

/* ---------------- W: web engine ---------------- */
{
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page = await boot(ctx, 'web', 'W', errs);
  ok(errs.length === 0, 'P2: Chromium boot clean, no page errors (web)', errs.join(' · '));
  ok(await dockHidden(page), 'W0: nothing loaded — the dock stands hidden');

  await page.click('[data-openblock="Morning"]');
  await sleep(700);
  await page.evaluate(() => { window.__armPos(); startQueue(state.dayDescs.filter(function (d) { return d.block === 'Morning'; })); });
  await sleep(700);
  let s = await page.evaluate(() => ({ q: state.queue.length, cur: state.current && state.current.episodeId, hidden: document.getElementById('dock').classList.contains('hidden'), snap: !!localStorage.getItem('opn-queue-v355') }));
  ok(s.q === 2 && s.cur === '9001' && !s.hidden && s.snap, 'W1: the day queue stands (2 tracks, current 9001, dock shown, snapshot written)', JSON.stringify(s));

  await page.evaluate(() => { window.__pos.t = 42; armSleepMinutes(15); openDockMenu(); });
  await sleep(400);
  const labels = await page.evaluate(() => Array.from(document.querySelectorAll('.anchmenu .menurow .grow')).map((n) => n.textContent));
  ok(labels.join('|') === 'Previous track|Intentions|Autoplay|Sleep timer|Playback speed|Exit player',
    'W2: the dock menu carries the standing five + Exit player, last', labels.join('|'));

  const rows = await page.$$('.anchmenu .menurow');
  await rows[rows.length - 1].click();
  await sleep(600);
  s = await page.evaluate(() => ({ q: state.queue.length, idx: state.queueIdx, cur: state.current, hidden: document.getElementById('dock').classList.contains('hidden'),
    snap: localStorage.getItem('opn-queue-v355'), sleepMode: state.sleep.mode,
    dayPos: window.__fetchLog.filter((f) => f.path.indexOf('/api/player/day-position') === 0).map((f) => f.body),
    marks: window.__fetchLog.filter((f) => /mark|played/.test(f.path)).length }));
  ok(s.q === 0 && s.idx === -1 && s.cur === null && s.hidden, 'W3: exit unloads — queue empty, current cleared, dock hidden', JSON.stringify(s));
  ok(s.snap === null, 'W4: exit clears the queue snapshot (no restore stands)');
  ok(s.dayPos.length >= 1 && s.dayPos[s.dayPos.length - 1].episodeId === '9001' && s.dayPos[s.dayPos.length - 1].positionS === 42,
    'W5: exit saved the standing position first (day-position 9001 @ 42s)', JSON.stringify(s.dayPos));
  ok(s.sleepMode === 'off', 'W6: exit cancelled the armed sleep timer');
  ok(s.marks === 0, 'W7: exit wrote no played mark');

  // replay after exit starts fresh, the dock returns
  await page.click('[data-playkey="9002"]');
  await sleep(700);
  s = await page.evaluate(() => ({ cur: state.current && state.current.episodeId, hidden: document.getElementById('dock').classList.contains('hidden') }));
  ok(s.cur === '9002' && !s.hidden, 'W8: a play press after exit starts fresh and the dock returns', JSON.stringify(s));

  // pending start cancelled by exit, never lands
  await page.evaluate(() => {
    window.__playCalls = 0;
    HTMLMediaElement.prototype.play = function () { window.__playCalls++; return new Promise(function () {}); };
  });
  await page.click('[data-playkey="9001"]');
  await sleep(500);
  const pend = await page.evaluate(() => ({ pend: !!state.pendingStart, cur: state.current && state.current.episodeId }));
  ok(pend.pend && pend.cur === '9001', 'W9 precondition: a start stands pending', JSON.stringify(pend));
  await page.evaluate(() => { exitPlayer(); });
  await sleep(500);
  s = await page.evaluate(() => ({ pend: state.pendingStart, cur: state.current, q: state.queue.length, hidden: document.getElementById('dock').classList.contains('hidden'), playCalls: window.__playCalls }));
  ok(s.pend === null && s.cur === null && s.q === 0 && s.hidden && s.playCalls === 1,
    'W10: exit cancels the pending start — nothing starts after', JSON.stringify(s));
  await ctx.close();
}

/* ---------------- W-pod: podcast position (web) ---------------- */
{
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page = await boot(ctx, 'web', 'W-pod', errs);
  await page.click('#tabbar .tab[data-tab="podcasts"]');
  await sleep(800);
  await page.evaluate(() => { if (typeof switchPodSide === 'function') switchPodSide('podcasts'); });
  await sleep(600);
  await page.click('[data-podseries="catechism"]');
  await sleep(800);
  await page.evaluate(() => { window.__armPos(); });
  await page.click('[data-podplay="ep1"]');
  await sleep(900);
  let s = await page.evaluate(() => ({ cur: state.current && state.current.episodeId, kind: state.current && state.current.kind }));
  ok(s.cur === 'ep1' && s.kind === 'podcast', 'W11 precondition: the podcast episode stands current', JSON.stringify(s));
  await page.evaluate(() => { window.__pos.t = 77; exitPlayer(); });
  await sleep(600);
  s = await page.evaluate(() => ({ cur: state.current, q: state.queue.length, hidden: document.getElementById('dock').classList.contains('hidden'),
    pos: window.__fetchLog.filter((f) => f.path.indexOf('/api/player/podcasts/position') === 0).map((f) => f.body) }));
  ok(s.pos.length >= 1 && s.pos[s.pos.length - 1].series === 'catechism' && s.pos[s.pos.length - 1].seqKey === 'ep1' && s.pos[s.pos.length - 1].positionS === 77,
    'W12: exit saved the podcast position first (catechism/ep1 @ 77s)', JSON.stringify(s.pos));
  ok(s.cur === null && s.q === 0 && s.hidden, 'W13: the podcast exit clears and hides the dock', JSON.stringify(s));
  await ctx.close();
}

/* ---------------- N: native engine ---------------- */
{
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page = await boot(ctx, 'native', 'N', errs);
  await page.click('#tabbar .tab[data-tab="podcasts"]');
  await sleep(800);
  await page.evaluate(() => { if (typeof switchPodSide === 'function') switchPodSide('podcasts'); });
  await sleep(600);
  await page.click('[data-podseries="catechism"]');
  await sleep(800);
  await page.click('[data-podplay="ep1"]');
  await sleep(900);
  await page.evaluate(() => {
    const fn = window.__listeners && window.__listeners['nativeState'];
    if (fn) fn({ state: JSON.stringify({ engine: 'native', playing: true, positionS: 30, durationS: 900, rate: 1, trackId: 'ep1', queueIndex: 0, ts: Date.now() }) });
  });
  await sleep(500);
  let s = await page.evaluate(() => ({ cur: state.current && state.current.episodeId, hidden: document.getElementById('dock').classList.contains('hidden'), contracts: window.__contracts.length }));
  ok(s.cur === 'ep1' && !s.hidden && s.contracts >= 1, 'N1 precondition: native playback stands (contract sent, dock shown)', JSON.stringify(s));

  await page.click('#dock');
  await sleep(700);
  const npOpen = await page.evaluate(() => !!document.querySelector('.np-sheet'));
  ok(npOpen, 'N2 precondition: Now Playing stands open');
  await page.click('#np-menu');
  await sleep(400);
  const labels = await page.evaluate(() => Array.from(document.querySelectorAll('.anchmenu .menurow .grow')).map((n) => n.textContent));
  ok(labels.includes('Exit player'), 'N3: the Now Playing Playback menu carries Exit player', labels.join('|'));
  const rows = await page.$$('.anchmenu .menurow');
  await rows[labels.indexOf('Exit player')].click();
  await sleep(700);
  s = await page.evaluate(() => ({ cur: state.current, q: state.queue.length, hidden: document.getElementById('dock').classList.contains('hidden'),
    np: !!document.querySelector('.np-sheet'), descs: window.nativeContractDescs ? nativeContractDescs.length : -1,
    cmds: window.__transports.map((c) => c && c.command) }));
  const stopCount = s.cmds.filter((c) => c === 'stop').length;
  const pauseIdx = s.cmds.indexOf('pause'), stopIdx = s.cmds.indexOf('stop');
  ok(stopCount === 1, 'N4: the native clear fires exactly once (one stop transport)', s.cmds.join(','));
  ok(pauseIdx >= 0 && stopIdx > pauseIdx, 'N5: a pause lands before the stop (the service position-writeback seat)', s.cmds.join(','));
  ok(s.cur === null && s.q === 0 && s.hidden && !s.np && s.descs === 0,
    'N6: exit clears the page — current/queue empty, dock hidden, Now Playing closed, contract descs gone', JSON.stringify(s));

  // the shell's stopped echo resurrects nothing
  await page.evaluate(() => {
    const fn = window.__listeners && window.__listeners['nativeState'];
    if (fn) fn({ state: JSON.stringify({ engine: 'native', stopped: true, playing: false, positionS: 0, durationS: 0, rate: 1, trackId: '', queueIndex: 0, ts: Date.now() }) });
  });
  await sleep(500);
  s = await page.evaluate(() => ({ cur: state.current, hidden: document.getElementById('dock').classList.contains('hidden'), contracts: window.__contracts.length }));
  ok(s.cur === null && s.hidden, 'N7: the stopped echo resurrects nothing — no current, dock stays hidden', JSON.stringify(s));

  // a media play press after exit starts nothing
  const contractsBefore = s.contracts;
  await page.evaluate(() => {
    const fn = window.__listeners && window.__listeners['transportCommand'];
    if (fn) fn({ command: 'play' });
  });
  await sleep(500);
  s = await page.evaluate(() => ({ cur: state.current, contracts: window.__contracts.length, hidden: document.getElementById('dock').classList.contains('hidden') }));
  ok(s.cur === null && s.contracts === contractsBefore && s.hidden,
    'N8: a media play press after exit starts nothing (no queue to resume)', JSON.stringify(s));
  ok(errs.length === 0, 'N9: no page errors across the native exit flow', errs.join(' · '));
  await ctx.close();
}

await browser.close();
server.close();
console.log('\nharness-v491: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) { console.log('failures: ' + failures.join(' · ')); process.exit(1); }
