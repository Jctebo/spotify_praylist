// harness-v412.mjs — v412 §2.13 evidence, per-fix legs.
//   F2  stall watchdog (stamp · 8 s bound · one recovery cycle ·
//       pass over · progress clears)
//   F3  rejected start (startFailed fact · one re-resolve retry ·
//       pass over / single-play stop)
//   F7  error wait bound 4 + the retrying line (card + dock) +
//       pass-over line
//   F8  previousWithRule on every surface (restart rule · queue
//       head · single-play inert · NP enabled at head)
//   F9  podcast queue snapshot form + restore (resolve · drop ·
//       clear · day form untouched)
//   F10 day positions (client save seams + pendingResume fold ·
//       Worker route round-trip on a fixture D1 through 0020 +
//       the payload's dayPositions fold)
//   F11 blob URL ownership (mint/revoke at all five sites)
//   F12 seekBy (the one implementation · NP ±10 buttons)
//   F13 dock rate cycler (SPEED_SET order · setRate seam · label)
//   F14 page-side sleep deadline (arm/clear ride the bridge)
// Molds: client extraction = harness-v411 (v388/v410 mold);
// Worker round-trip = harness-v395 (local wrangler + fixture D1).
// Run: node app/tests/harness-v412.mjs   (from the worktree root)
import { readFileSync, readdirSync, existsSync, rmSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';

const ROOT = process.cwd();
const APP = ROOT + '/app';
const CLIENT = APP + '/worker/src/client.ts';
const UI = APP + '/worker/src/ui.ts';
const INDEX = APP + '/worker/src/index.ts';
const C_SRC = readFileSync(CLIENT, 'utf8');
const U_SRC = readFileSync(UI, 'utf8');
const I_SRC = readFileSync(INDEX, 'utf8');

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- statics ---------------- */
{
  // F11: exactly the mint's own two createObjectURL calls stand
  // in the client (inside mintBlobUrl); every former site routes
  // through mintBlobUrl.
  const creates = (C_SRC.match(/URL\.createObjectURL/g) || []).length;
  ok(creates === 2, 'F11 statics: createObjectURL stands only inside mintBlobUrl (2 calls)', 'count=' + creates);
  ok((C_SRC.match(/mintBlobUrl\(/g) || []).length >= 6, 'F11 statics: mintBlobUrl serves the definition + all five sites');
  ok(/revokeObjectURL/.test(C_SRC), 'F11 statics: revokeObjectURL stands in the client');
  // F7: the bound is 4 and the line's wording is exact.
  ok(/tries <= 4/.test(C_SRC), 'F7 statics: the error wait bound is 4 tries');
  ok(!/tries <= 20/.test(C_SRC), 'F7 statics: the 20-try bound is gone');
  ok(C_SRC.includes('Trouble playing \\u2014 retrying'), 'F7 statics: the retrying line wording stands exact (the \u2014 escape, as the client source writes it)');
  // F2: the 8 s bound + the element signals.
  ok(/< 8000/.test(C_SRC) && /addEventListener\('waiting'/.test(C_SRC) && /addEventListener\('stalled'/.test(C_SRC), 'F2 statics: 8 s bound + waiting/stalled stamps');
  // F3: the fact + the twin.
  ok(/payload\.startFailed = true/.test(C_SRC) && /function noteStartFailed/.test(C_SRC) && /function onStartRejected/.test(C_SRC), 'F3 statics: startFailed fact + noteStartFailed + onStartRejected stand');
  // the error window is gone; the intent guard stands.
  ok(!/lastStartAt > 4000|Date\.now\(\) - state\.lastStartAt > 4000/.test(C_SRC), 'F2/F3 statics: the 4 s error window is removed');
  ok(/!playIntent\) return;/.test(C_SRC), 'F2/F3 statics: the standing-intent guard reads the error listener');
  // F8: one rule, four surfaces.
  ok(/function previousWithRule/.test(C_SRC), 'F8 statics: previousWithRule stands');
  ok(/previoustrack: function \(\) \{ previousWithRule\(\); \}/.test(C_SRC), 'F8 statics: the web session handler reads the rule');
  ok(/function bridgePrevious\(\) \{\n  \/\/ B3 previous — v412 Fix 8: the bridge reads the one rule\.\n  previousWithRule\(\);/.test(C_SRC), 'F8 statics: the bridge command reads the rule');
  ok(/getElementById\('dock-prev'\)\.addEventListener\('click', function \(\) \{ previousWithRule\(\); \}\)/.test(C_SRC), 'F8 statics: the dock Previous reads the rule');
  ok(/np-prev'\)\.disabled = !state\.queue\.length;/.test(C_SRC), 'F8 statics: Now Playing Previous enabled at the queue head');
  ok(U_SRC.includes('id="dock-prev"'), 'F8 statics: the dock carries the Previous button');
  // F12: seekBy + the buttons.
  ok(/function seekBy\(/.test(C_SRC) && /seekforward: function \(details\) \{ seekBy\(/.test(C_SRC) && /seekbackward: function \(details\) \{ seekBy\(/.test(C_SRC), 'F12 statics: seekBy stands and both system handlers call it');
  ok(C_SRC.includes('id="np-back10"') && C_SRC.includes('id="np-fwd10"'), 'F12 statics: the Now Playing sheet carries the ±10 s buttons');
  // F13: the cycler + the dock button.
  ok(/function cycleRate/.test(C_SRC) && U_SRC.includes('id="dock-rate"'), 'F13 statics: cycleRate + the dock rate button stand');
  // F14 page side.
  ok(/p\.armSleepDeadline\(\{ epochMs: epochMs \}\)/.test(C_SRC) && /p\.clearSleepDeadline\(\{\}\)/.test(C_SRC), 'F14 statics: the page arms/clears the native deadline through the bridge');
  // F9/F10 client seams.
  ok(/form: 'podcast'/.test(C_SRC) && /function tryStandPodcastRestore/.test(C_SRC), 'F9 statics: the podcast snapshot form + restore stand');
  ok(/post\('\/api\/player\/day-position'/.test(C_SRC) && /dayPositions\[desc\.episodeId\]/.test(C_SRC), 'F10 statics: the day-position post + the payload fold read stand');
  // F10 Worker: the route + the fold + migration 0020.
  ok(/seg\[2\] === "day-position" && request\.method === "POST"/.test(I_SRC), 'F10 statics: the day-position route stands in the Worker');
  ok(/dayPositions/.test(I_SRC) && /FROM day_positions WHERE date=\?/.test(I_SRC), 'F10 statics: the payload fold reads day_positions');
  const mig = APP + '/migrations/0020_day_positions.sql';
  ok(existsSync(mig) && /CREATE TABLE IF NOT EXISTS day_positions/.test(readFileSync(mig, 'utf8')) && /PRIMARY KEY \(date, episode_id\)/.test(readFileSync(mig, 'utf8')), 'F10 statics: migration 0020 creates day_positions keyed (date, episode_id)');
}

/* ---------------- client extraction (v388/v410 mold) ---------------- */
function scanDecls(src) {
  const out = []; const lines = src.split('\n'); let li = 0;
  while (li < lines.length) {
    const line = lines[li];
    let m = line.match(/^function ([A-Za-z_$][\w$]*)\s*\(/);
    if (m) { out.push({ kind: 'fn', name: m[1], startLine: li }); li++; continue; }
    m = line.match(/^var ([A-Za-z_$][\w$]*)\s*=/);
    if (m) { out.push({ kind: 'var', name: m[1], startLine: li }); li++; continue; }
    li++;
  }
  return { out, lines };
}
function countBraces(s) { let n = 0; for (const ch of s) { if (ch === '{') n++; else if (ch === '}') n--; } return n; }
function unit(lines, startLine, kind) {
  if (kind === 'var') {
    let depth = 0, started = false; const buf = [];
    for (let i = startLine; i < lines.length; i++) {
      buf.push(lines[i]);
      for (const ch of lines[i]) { if (ch === '{' || ch === '[' || ch === '(') { depth++; started = true; } else if (ch === '}' || ch === ']' || ch === ')') depth--; }
      if (started && depth <= 0 && /;\s*$/.test(lines[i])) break;
      if (!started && /;\s*$/.test(lines[i])) break;
    }
    return buf.join('\n');
  }
  let depth = 0, opened = false; const buf = [];
  for (let i = startLine; i < lines.length; i++) {
    buf.push(lines[i]); depth += countBraces(lines[i]); if (lines[i].includes('{')) opened = true;
    if (opened && depth <= 0) break;
  }
  return buf.join('\n');
}
const EXCLUDE = new Set(['refreshPlayedChrome', 'extFetchText']);
const { out: decls, lines } = scanDecls(C_SRC);
const pieces = [], dropped = [];
for (const d of decls) {
  if (d.name === 'state') continue;
  if (EXCLUDE.has(d.name)) continue;
  const u = unit(lines, d.startLine, d.kind);
  try { if (d.kind === 'fn') new Function('return (' + u + ')'); else new Function(u); pieces.push(u); }
  catch (e) { dropped.push(d.name); }
}
console.log('note - extraction dropped:', dropped.join(', ') || 'none');
const APP_CSS = U_SRC.slice(U_SRC.indexOf('APP_CSS = `') + 11, U_SRC.indexOf('`;', U_SRC.indexOf('APP_CSS = `')));

const PAGE_HEAD = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>CSSHERE</style></head>
<body data-lit="">
<audio id="audio"></audio>
<div id="alert"></div><main id="view"></main>
<div id="dock" class="dock hidden"><img class="dockthumb" src="/logo.png" alt=""><div class="docktext"><div class="docktitle" id="dock-title"></div><div class="dockmeta" id="dock-meta"></div></div><button id="dock-play" class="playbtn" aria-label="Play or pause"></button><button id="dock-autoplay" class="docknext dockauto" aria-label="Autoplay">Autoplay On</button><button id="dock-intentions" class="docknext dockauto" aria-label="Intentions" aria-pressed="true">Intentions On</button><button id="dock-prev" class="docknext" aria-label="Previous track">&#9198;</button><button id="dock-next" class="docknext" aria-label="Next track">&#9197;</button><button id="dock-rate" class="docknext dockauto" aria-label="Playback speed">1&times;</button><div class="dockprogress"><i id="dock-progress-fill"></i></div></div>
<div id="cards"><div data-card="ep1"></div><div data-card="ep2"></div></div>
<script>
window.__fetchLog = [];
window.fetch = function (path, opts) {
  var method = (opts && opts.method) || 'GET';
  var body = null;
  try { body = opts && opts.body ? JSON.parse(opts.body) : null; } catch (e) {}
  window.__fetchLog.push({ path: String(path), method: method, body: body });
  if (String(path).indexOf('/api/player/feed-audio') === 0) {
    return Promise.resolve(new Response(new Blob(['mp3'], { type: 'audio/mpeg' }), { status: 200 }));
  }
  return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({}); } });
};
function extFetchText(url) { return Promise.reject(new Error('offline')); }
function refreshPlayedChrome() {}
window.__urlN = 0; window.__revoked = [];
URL.createObjectURL = function () { return 'blob:fake-' + (++window.__urlN); };
URL.revokeObjectURL = function (u) { window.__revoked.push(u); };
</` + `script>
<script>
var state = { tab: 'prayers', block: null, playingKey: null, playingUrl: null, queue: [], queueIdx: -1, current: null,
  storedDay: '2026-11-14', presentedDay: '2026-11-14', dateLabel: 'Saturday, November 14', liturgical: null,
  pendingResume: null, sleep: { mode: 'off' }, readTracks: {}, dayDescs: [], dayPayload: null, playedCache: null,
  repeatIds: {}, previewQueue: null, queuePreviewIdx: -1, restoredQueue: false, restoreProbe: null, podRestoreProbe: null,
  prayersView: { kind: 'home' }, searchQuery: '', podcasts: null, podcastsIndex: null, podcastsReturn: null,
  rate: 1, errWaitKey: null, errWaitN: 0, startRetryKey: null, lastStartAt: 0 };
</` + `script>`;
const PAGE = PAGE_HEAD.replace('CSSHERE', () => APP_CSS) + '<script>\n' + pieces.join('\n') + '\n</' + 'script>';

const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(PAGE); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 400, height: 800 } });
page.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:' + PORT + '/');
await page.evaluate(() => {
  window.__mkFakeAudio = function () {
    var a = { paused: true, currentTime: 0, duration: 100, src: '', currentSrc: '', playbackRate: 1, volume: 1,
      ended: false, error: null, playCalls: 0, pauseCalls: 0, loadCalls: 0, playMode: 'resolve',
      play: function () { a.playCalls++; if (a.playMode === 'reject') return Promise.reject(new Error('reject')); a.paused = false; return Promise.resolve(); },
      pause: function () { a.pauseCalls++; a.paused = true; },
      load: function () { a.loadCalls++; },
      addEventListener: function () {}, removeEventListener: function () {} };
    return a;
  };
  window.__fake = window.__mkFakeAudio();
  window.audioEl = window.__fake;
  window.__desc = function (id, extra) {
    return Object.assign({ episodeId: id, kind: 'episode', title: 'Track ' + id, block: 'Morning', url: 'https://x/' + id + '.mp3', available: true, durationS: 100 }, extra || {});
  };
  window.__reset = function () {
    state.queue = []; state.queueIdx = -1; state.current = null; state.dayDescs = []; state.dayPayload = null;
    state.podcasts = null; state.pendingResume = null; state.errWaitKey = null; state.errWaitN = 0;
    state.startRetryKey = null; state.podRestoreProbe = null; playIntent = false; stallClear();
    window.__fake = window.__mkFakeAudio(); window.audioEl = window.__fake;
    window.__fetchLog.length = 0;
  };
});
const ev = (fn) => page.evaluate(fn);

/* ---------------- F2: stall watchdog ---------------- */
{
  await ev(() => {
    __reset();
    var d1 = __desc('ep1'), d2 = __desc('ep2');
    state.dayDescs = [d1, d2];
    startQueue([d1, d2], true);
    __fake.currentTime = 10;
    stallNote();
    window.__f2a = state.stallKey;
    __fake.currentTime = 10.5;
    stallTick();
    window.__f2b = state.stallKey;
    stallNote();
    window.__f2key = state.stallKey;
    state.stallAt = Date.now() - 9000;
    window.__f2pc = __fake.playCalls;
    stallTick();
    window.__f2c = { playCalls: __fake.playCalls, cycles: state.stallCycles, cur: state.current.episodeId };
    state.stallAt = Date.now() - 9000;
    stallTick();
    window.__f2d = { cur: state.current ? state.current.episodeId : null, passline: !!document.querySelector('[data-card="ep1"] .passline') };
  });
  const r = await ev(() => ({ a: window.__f2a, b: window.__f2b, key: window.__f2key, pc: window.__f2pc, c: window.__f2c, d: window.__f2d }));
  ok(r.a === 'ep1@0', 'F2: waiting/stalled stamps the standing track', JSON.stringify(r));
  ok(r.b === null, 'F2: position progress (+0.5 s) clears the stamp');
  ok(r.c.playCalls === r.pc + 1 && r.c.cycles === 1 && r.c.cur === 'ep1', 'F2: at the 8 s bound, ONE recovery cycle re-drives the track', JSON.stringify(r.c));
  ok(r.d.cur === 'ep2' && r.d.passline, 'F2: a second failed cycle passes over (queue advances, card shows why)', JSON.stringify(r.d));
}

/* ---------------- F3: rejected start ---------------- */
{
  await ev(() => {
    __reset();
    var d1 = __desc('ep1');
    state.dayDescs = [d1];
    state.dayPayload = { presentedDay: '2026-11-14', dayPositions: {}, blocks: [] };
    __fake.playMode = 'reject';
    playTrack(d1);
  });
  await sleep(80);
  const r = await ev(() => ({ playCalls: __fake.playCalls, retryKey: state.startRetryKey,
    fact: (function () { var p = nativeStatePayload(false); return p ? p.startFailed : null; })(),
    paused: __fake.paused, passline: !!document.querySelector('[data-card="ep1"] .passline') }));
  ok(r.playCalls === 2, 'F3: a rejected start retries exactly once through the re-resolution seam', JSON.stringify(r));
  ok(r.fact === true, 'F3: the startFailed fact stands on the native payload (the v397 channel twin)');
  ok(r.retryKey === null && r.paused && r.passline, 'F3: the second rejection stops the single play, paused, card showing why', JSON.stringify(r));
}

/* ---------------- F7: bounded error wait + lines ---------------- */
{
  await ev(() => {
    __reset();
    var d1 = __desc('ep1');
    state.dayDescs = [d1];
    state.queue = [d1]; state.queueIdx = 0; state.current = d1;
    __fake.error = { code: 4 };
    handleAudioError();
    window.__f7a = { n: state.errWaitN,
      card: (document.querySelector('[data-card="ep1"] .waitline') || {}).textContent || null,
      dock: !!document.querySelector('.docktext .waitline') };
    state.errWaitN = 3;
    handleAudioError();
    window.__f7b = { n: state.errWaitN, cur: state.current ? state.current.episodeId : null };
    handleAudioError();
    window.__f7c = { cur: state.current, queue: state.queue.length,
      passline: !!document.querySelector('[data-card="ep1"] .passline'),
      waitline: !!document.querySelector('[data-card="ep1"] .waitline') };
    // restart branch: a landed URL substitutes and restarts at once
    __reset();
    var e1 = __desc('ep1');
    var e1b = __desc('ep1', { url: 'https://x/ep1-v2.mp3' });
    state.dayDescs = [e1b];
    state.queue = [e1]; state.queueIdx = 0; state.current = e1;
    __fake.error = { code: 4 };
    handleAudioError();
    window.__f7d = { url: state.current ? state.current.url : null, n: state.errWaitN };
  });
  const r = await ev(() => ({ a: window.__f7a, b: window.__f7b, c: window.__f7c, d: window.__f7d }));
  ok(r.a.n === 1 && r.a.card === 'Trouble playing \u2014 retrying' && r.a.dock, 'F7: the standing wait paints the retrying line on the card and the dock', JSON.stringify(r.a));
  ok(r.b.n === 4 && r.b.cur === 'ep1', 'F7: the fourth try still waits (bound not yet reached)', JSON.stringify(r.b));
  ok(r.c.cur === null && r.c.queue === 0 && r.c.passline && !r.c.waitline, 'F7: the fifth failure passes over — line swaps to the passed-over reason', JSON.stringify(r.c));
  ok(r.d.url === 'https://x/ep1-v2.mp3' && r.d.n === 0, 'F7: a landed URL restarts the entry at once and clears the wait', JSON.stringify(r.d));
}

/* ---------------- F8: the one Previous rule ---------------- */
{
  await ev(() => {
    __reset();
    var d1 = __desc('ep1'), d2 = __desc('ep2');
    state.dayDescs = [d1, d2];
    startQueue([d1, d2], true);
    advanceQueue(1);
    __fake.currentTime = 10;
    previousWithRule();
    window.__f8a = { t: __fake.currentTime, idx: state.queueIdx, cur: state.current.episodeId };
    __fake.currentTime = 2;
    previousWithRule();
    window.__f8b = { idx: state.queueIdx, cur: state.current.episodeId };
    // bridge surface, same setup
    advanceQueue(1);
    __fake.currentTime = 2;
    bridgePrevious();
    window.__f8c = { idx: state.queueIdx, cur: state.current.episodeId };
    // web session surface, same setup
    advanceQueue(1);
    __fake.currentTime = 2;
    mediaHandlers.previoustrack();
    window.__f8d = { idx: state.queueIdx, cur: state.current.episodeId };
    // single play: inert
    __reset();
    var s1 = __desc('ep1');
    state.dayDescs = [s1];
    playTrack(s1);
    __fake.currentTime = 10;
    previousWithRule();
    window.__f8e = { t: __fake.currentTime, cur: state.current.episodeId };
  });
  const r = await ev(() => ({ a: window.__f8a, b: window.__f8b, c: window.__f8c, d: window.__f8d, e: window.__f8e }));
  ok(r.a.t === 0 && r.a.idx === 1 && r.a.cur === 'ep2', 'F8: > 3 s in, Previous restarts the track', JSON.stringify(r.a));
  ok(r.b.idx === 0 && r.b.cur === 'ep1', 'F8: under 3 s, Previous goes to the previous queue entry', JSON.stringify(r.b));
  ok(r.c.idx === 0 && r.c.cur === 'ep1', 'F8: the bridge command reads the same rule', JSON.stringify(r.c));
  ok(r.d.idx === 0 && r.d.cur === 'ep1', 'F8: the web session handler reads the same rule', JSON.stringify(r.d));
  ok(r.e.t === 10 && r.e.cur === 'ep1', 'F8: a single play — Previous is inert (no restart, no move)', JSON.stringify(r.e));
}

/* ---------------- F9: podcast queue snapshot + restore ---------------- */
{
  await ev(() => {
    __reset();
    localStorage.removeItem('opn-queue-v355');
    var mk = function (k) { return { episodeId: k, kind: 'podcast', seriesKey: k, podSeries: 'bible', title: k, url: 'https://x/' + k + '.mp3', available: true, durationS: 100, block: 'Podcasts' }; };
    var p1 = mk('biy:day-2'), p2 = mk('biy:day-3'), p3 = mk('biy:day-4');
    state.queue = [p1, p2, p3]; state.queueIdx = 1; state.current = p2;
    saveQueueSnapshot(42);
    window.__f9a = JSON.parse(localStorage.getItem('opn-queue-v355'));
    // the day form stands byte-shaped as before
    __reset();
    var d1 = __desc('ep1'), d2 = __desc('ep2');
    state.queue = [d1, d2]; state.queueIdx = 0; state.current = d1;
    saveQueueSnapshot(7);
    window.__f9b = JSON.parse(localStorage.getItem('opn-queue-v355'));
    // boot reads the podcast form into the probe, no date check
    localStorage.setItem('opn-queue-v355', JSON.stringify({ v: 2, form: 'podcast', series: 'bible', seqKeys: ['biy:day-2', 'biy:day-9', 'biy:day-3'], idx: 2, currentKey: 'biy:day-3', positionS: 42, savedAt: 'x' }));
    state.current = null; state.queue = []; state.queueIdx = -1; state.podRestoreProbe = null; state.restoredQueue = false;
    bootQueueSnapshot();
    window.__f9c = { probe: state.podRestoreProbe ? state.podRestoreProbe.series : null, restoredQueue: state.restoredQueue };
    state.podcasts = { series: 'bible', entries: [
      { key: 'biy:day-2', label: 'Day 2', title: 'T2', url: 'https://x/2.mp3', durationS: 100, listened: false, positionS: null },
      { key: 'biy:day-3', label: 'Day 3', title: 'T3', url: 'https://x/3.mp3', durationS: 100, listened: false, positionS: null } ] };
    tryStandPodcastRestore();
    window.__f9d = { q: state.queue.length, cur: state.current ? state.current.episodeId : null,
      resume: state.pendingResume ? state.pendingResume.positionS : null, src: __fake.src, paused: __fake.paused };
    // nothing resolves — the record clears
    localStorage.setItem('opn-queue-v355', JSON.stringify({ v: 2, form: 'podcast', series: 'bible', seqKeys: ['biy:day-9'], idx: 0, positionS: 5, savedAt: 'x' }));
    state.current = null; state.queue = []; state.queueIdx = -1;
    bootQueueSnapshot();
    state.podcasts = { series: 'bible', entries: [] };
    tryStandPodcastRestore();
    window.__f9e = { rec: localStorage.getItem('opn-queue-v355'), probe: state.podRestoreProbe };
  });
  const r = await ev(() => ({ a: window.__f9a, b: window.__f9b, c: window.__f9c, d: window.__f9d, e: window.__f9e }));
  ok(r.a.form === 'podcast' && r.a.series === 'bible' && r.a.seqKeys.join() === 'biy:day-2,biy:day-3,biy:day-4' && r.a.idx === 1 && r.a.positionS === 42 && !('date' in r.a),
    'F9: a podcast queue snapshots in the podcast form (series + seqKeys, no date)', JSON.stringify(r.a));
  ok(!r.b.form && r.b.date === '2026-11-14' && r.b.ids.join() === 'ep1,ep2', 'F9: the day form stands unchanged for day queues', JSON.stringify(r.b));
  ok(r.c.probe === 'bible' && !r.c.restoredQueue, 'F9: boot reads the podcast record into the probe (Continue flag untouched)', JSON.stringify(r.c));
  ok(r.d.q === 2 && r.d.cur === 'biy:day-3' && r.d.resume === 42 && r.d.src === 'https://x/3.mp3' && r.d.paused === true,
    'F9: the restore resolves keys against the payload, drops the missing, stands paused at the record index + position', JSON.stringify(r.d));
  ok(r.e.rec === null && r.e.probe === null, 'F9: a record whose entries all vanished clears', JSON.stringify(r.e));
}

/* ---------------- F10 (client): day positions ---------------- */
{
  await ev(() => {
    __reset();
    var d1 = __desc('ep1');
    state.dayDescs = [d1];
    state.dayPayload = { presentedDay: '2026-11-14', dayPositions: { ep1: 125 }, blocks: [] };
    startDesc(d1);
    window.__f10a = state.pendingResume ? { id: state.pendingResume.episodeId, pos: state.pendingResume.positionS } : null;
    __fake.currentTime = 33.7; __fake.ended = false;
    __fetchLog.length = 0;
    dayPositionSaveCurrent();
    window.__f10b = __fetchLog.filter(function (l) { return l.path === '/api/player/day-position'; });
    __fetchLog.length = 0;
    writeDayPositionQuiet('ep1', 0, 0);
    window.__f10c = __fetchLog.filter(function (l) { return l.path === '/api/player/day-position'; });
    __reset();
    state.current = { episodeId: 'biy:day-2', kind: 'podcast', seriesKey: 'biy:day-2', podSeries: 'bible' };
    __fetchLog.length = 0;
    dayPositionSaveCurrent();
    window.__f10d = __fetchLog.filter(function (l) { return l.path === '/api/player/day-position'; }).length;
  });
  const r = await ev(() => ({ a: window.__f10a, b: window.__f10b, c: window.__f10c, d: window.__f10d }));
  ok(r.a && r.a.id === 'ep1' && r.a.pos === 125, 'F10: the payload fold hands the saved position to the pendingResume seam at start', JSON.stringify(r.a));
  ok(r.b.length === 1 && r.b[0].body.positionS === 33 && r.b[0].body.episodeId === 'ep1' && r.b[0].body.date === '2026-11-14',
    'F10: the pause save posts the day position (floored, dated)', JSON.stringify(r.b));
  ok(r.c.length === 1 && r.c[0].body.positionS === 0, 'F10: the ended clear posts position 0 (the route deletes the row)', JSON.stringify(r.c));
  ok(r.d === 0, 'F10: a podcast track never writes a day position', JSON.stringify(r.d));
}

/* ---------------- F11 (behavioral): blob ownership ---------------- */
{
  const r1 = await ev(() => {
    __reset();
    var owner = {};
    var u1 = mintBlobUrl(owner, new Blob(['a']));
    var u2 = mintBlobUrl(owner, new Blob(['b']));
    return { u1: u1, u2: u2, revoked: window.__revoked.slice(), held: owner.blobUrl };
  });
  ok(r1.u1 !== r1.u2 && r1.revoked.includes(r1.u1) && r1.held === r1.u2, 'F11: a re-mint revokes the owner\u2019s standing URL', JSON.stringify(r1));
  const r2 = await ev(() => {
    __reset();
    var dA = __desc('ep1'); dA.blobUrl = 'blob:fake-keep';
    state.current = dA;
    var dB = __desc('ep2');
    state.dayDescs = [dB];
    startDesc(dB);
    return { revoked: window.__revoked.slice(), aUrl: dA.blobUrl };
  });
  ok(r2.revoked.includes('blob:fake-keep') && r2.aUrl === null, 'F11: a replaced descriptor\u2019s URL is revoked at the moment of replacement', JSON.stringify(r2));
  const r3 = await ev(async () => {
    __reset();
    const u = await new Promise((res) => { ownFetchAudio('epx', 'https://enc/x', (url) => res(url)); });
    return { u: u, held: ownBlobOwners['epx'] ? ownBlobOwners['epx'].blobUrl : null };
  });
  ok(typeof r3.u === 'string' && r3.u.indexOf('blob:fake-') === 0 && r3.held === r3.u, 'F11: the own-audio download mints through its cache-key owner', JSON.stringify(r3));
}

/* ---------------- F12: seekBy ---------------- */
{
  const r = await ev(() => {
    __reset();
    __fake.duration = 100; __fake.currentTime = 50;
    var out = [];
    seekBy(10); out.push(__fake.currentTime);
    seekBy(-10); out.push(__fake.currentTime);
    seekBy(1000); out.push(__fake.currentTime);
    seekBy(-1000); out.push(__fake.currentTime);
    __fake.currentTime = 50;
    mediaHandlers.seekforward({ seekOffset: 10 }); out.push(__fake.currentTime);
    mediaHandlers.seekbackward({}); out.push(__fake.currentTime);
    return out;
  });
  ok(JSON.stringify(r) === JSON.stringify([60, 50, 100, 0, 60, 50]), 'F12: seekBy moves ±10 with the standing clamps; the system handlers read the same step', JSON.stringify(r));
}

/* ---------------- F13: dock rate cycler ---------------- */
{
  const r = await ev(() => {
    __reset();
    state.rate = 1;
    cycleRate();
    var a = { rate: state.rate, stored: localStorage.getItem('opn-speed-v336'), label: document.getElementById('dock-rate').textContent };
    state.rate = 2;
    cycleRate();
    var b = { rate: state.rate };
    return { a: a, b: b };
  });
  ok(r.a.rate === 1.25 && r.a.stored === '1.25' && r.a.label === '1.25\u00d7', 'F13: the cycler steps SPEED_SET through setRate (persisted, labelled)', JSON.stringify(r.a));
  ok(r.b.rate === 0.5, 'F13: the cycler wraps the set (2 -> 0.5)', JSON.stringify(r.b));
}

/* ---------------- F14 (page side): sleep deadline ---------------- */
{
  await ev(() => {
    window.Capacitor = { Plugins: { OraDayBridge: {
      armSleepDeadline: function (o) { window.__sleepArm = o; return Promise.resolve(); },
      clearSleepDeadline: function () { window.__sleepClear = true; return Promise.resolve(); } } } };
    window.__t0 = Date.now();
    armSleepMinutes(15);
    disarmSleep();
  });
  const r = await ev(() => ({ arm: window.__sleepArm, clear: window.__sleepClear, t0: window.__t0 }));
  ok(r.arm && Math.abs(r.arm.epochMs - (r.t0 + 900000)) < 3000, 'F14: a minutes arm stands the same deadline natively', JSON.stringify(r.arm));
  ok(r.clear === true, 'F14: disarm clears the native deadline');
  await ev(() => { delete window.Capacitor; });
}
await browser.close();
server.close();

/* ---------------- F10 (Worker): route round-trip on a fixture D1 ---------------- */
const WRANGLER = '/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler';
const WPORT = 9000 + (process.pid % 400); // unique per run: an orphaned workerd can never alias a later run's port
const WBASE = 'http://127.0.0.1:' + WPORT;
const TOKEN = 'harness-token';
const PERSIST = path.join(APP, '.wrangler-test-v412');
const TMPD = mkdtempSync(path.join(os.tmpdir(), 'opn-v412-'));
function wranglerD1(appDir, persist, args) {
  return execFileSync(WRANGLER, ['d1', 'execute', 'ora-pro-nobis-app', '--local', '--config', path.join(appDir, 'wrangler.toml'), '--persist-to', persist, ...args],
    { cwd: appDir, stdio: 'pipe', env: { ...process.env, CLOUDFLARE_API_TOKEN: '' } }).toString();
}
function wranglerD1File(appDir, persist, file) { wranglerD1(appDir, persist, ['--file', file]); }
function d1q(appDir, persist, sql) {
  const out = wranglerD1(appDir, persist, ['--json', '--command', sql]);
  const parsed = JSON.parse(out.slice(out.indexOf('[')));
  return parsed[0].results || [];
}
const procs = [];
function startApp(appDir, port, persist) {
  const args = ['dev', '--config', path.join(appDir, 'wrangler.toml'), '--local', '--port', String(port), '--persist-to', persist,
    '--var', 'LOCAL_DEV:1', '--var', 'AGENT_TOKEN:' + TOKEN];
  const child = spawn(WRANGLER, args, { cwd: appDir, stdio: ['ignore', 'pipe', 'pipe'], detached: true, env: { ...process.env, CLOUDFLARE_API_TOKEN: '' } });
  child.stdout.on('data', () => {}); child.stderr.on('data', () => {});
  procs.push(child);
  return child;
}
async function waitUp(base) {
  for (let i = 0; i < 90; i++) { try { const r = await fetch(base + '/'); if (r.status) return true; } catch { /* not up */ } await sleep(1000); }
  return false;
}
const wget = async (p, headers = {}) => { const r = await fetch(WBASE + p, { headers }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const wpost = async (p, jsonBody, headers = {}) => {
  const r = await fetch(WBASE + p, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(jsonBody || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const chicagoToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
try {
  const migDir = path.join(APP, 'migrations');
  const files = readdirSync(migDir).filter((x) => x.endsWith('.sql')).sort().map((f) => path.join(migDir, f));
  rmSync(PERSIST, { recursive: true, force: true });
  const joined = path.join(TMPD, 'all-migrations.sql');
  writeFileSync(joined, files.map((x) => readFileSync(x, 'utf8')).join('\n'));
  wranglerD1File(APP, PERSIST, joined);
  const cols = d1q(APP, PERSIST, 'PRAGMA table_info(day_positions)');
  ok(cols.map((c) => c.name).join(',') === 'date,episode_id,position_s,duration_s,updated_at'
    && cols.find((c) => c.name === 'date').pk === 1 && cols.find((c) => c.name === 'episode_id').pk === 2,
    'F10 Worker: 0020 creates day_positions with the pinned columns and the (date, episode_id) primary key', JSON.stringify(cols.map((c) => [c.name, c.pk])));
  startApp(APP, WPORT, PERSIST);
  const up = await waitUp(WBASE);
  ok(up, 'F10 Worker: the fixture Worker boots (LOCAL_DEV)');
  const today = chicagoToday();
  const dayPosRows = () => d1q(APP, PERSIST, "SELECT date, episode_id, position_s, duration_s FROM day_positions ORDER BY episode_id");
  const s1 = await wpost('/api/player/day-position', { episodeId: 'ep-f10', date: today, positionS: 125, durationS: 300 });
  let rows = dayPosRows();
  ok(s1.status === 200 && rows.length === 1 && rows[0].position_s === 125 && rows[0].duration_s === 300 && rows[0].date === today,
    'F10 Worker: a save lands the row keyed (date, episode_id)', JSON.stringify(rows));
  const s2 = await wpost('/api/player/day-position', { episodeId: 'ep-f10', date: today, positionS: 9999, durationS: 300 });
  rows = dayPosRows();
  ok(s2.status === 200 && rows.length === 1 && rows[0].position_s === 300, 'F10 Worker: a position past the saved duration clamps to it', JSON.stringify(rows));
  const s3 = await wpost('/api/player/day-position', { episodeId: 'ep-f10', date: today, positionS: 0, durationS: 300 });
  rows = dayPosRows();
  ok(s3.status === 200 && rows.length === 0, 'F10 Worker: a zero position deletes the row', JSON.stringify(rows));
  const s4 = await wpost('/api/player/day-position', { positionS: 10, durationS: 10 });
  ok(s4.status === 400, 'F10 Worker: a save with no episodeId answers 400', 'status=' + s4.status);
  const s5 = await wpost('/api/player/day-position', { episodeId: 'ep-f10', date: today, positionS: 77, durationS: 300 });
  const fold = await wget('/api/agent/player/day', { authorization: 'Bearer ' + TOKEN });
  ok(s5.status === 200 && fold.status === 200 && fold.body.dayPositions && fold.body.dayPositions['ep-f10'] === 77,
    'F10 Worker: the day payload fold carries the saved position', JSON.stringify(fold.body.dayPositions || fold.status));
  const door = await wpost('/api/agent/player/day-position', { episodeId: 'ep-f10', date: today, positionS: 5, durationS: 300 }, { authorization: 'Bearer ' + TOKEN });
  ok(door.status === 404, 'F10 Worker: no agent-door day-position surface exists', 'status=' + door.status);
} finally {
  for (const p of procs) { try { process.kill(-p.pid, 'SIGKILL'); } catch { try { p.kill('SIGKILL'); } catch { /* gone */ } } }
  rmSync(PERSIST, { recursive: true, force: true });
}

console.log('---');
console.log('harness-v412: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) console.log('failures: ' + failures.join(' | '));
process.exit(fail ? 1 : 0);
