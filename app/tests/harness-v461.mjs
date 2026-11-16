// harness-v461.mjs — v461 §2.8 evidence, per-finding legs.
//   F1  the pending-start model (cancel on disc tap · cancel on
//       dock tap · glyph agreement in the window · cancel then
//       resume with no rebuild)
//   F2  onStartRejected's name discrimination (AbortError is a
//       non-event · NotAllowedError keeps Fix 3's recovery ·
//       a second refusal passes over)
//   F3  the disc as unpause (resumeCurrent routing, queue
//       intact) + the day fold's in-memory leg (set · delete)
//   F4  the podcast cache chain's currency guard (a superseded
//       read drops · the standing read loads)
//   F6  the sleep deadline retires a pending start (the pause
//       rejects it · a late resolve cannot unpause) + the
//       standing playing stop unchanged
//   N   neighbor spot-checks (the one Previous rule · seekBy
//       clamps · sleepTrackEnd's hold)
//   A   field addendum 2026-11-16 00:04 CT: the media-session
//       and bridge transport routes in-page (pending no-op /
//       cancel · bridge play lands on resumeCurrent)
// Mold: harness-v412 (client extraction + Chromium + the fake
// audio). The v461 fake extends the mold in the two named ways
// of §2.8: a PENDING play mode (the leg settles the promise on
// demand; a pause landing on it rejects it as AbortError, as
// the element does) and NAMED rejections. The caches stub
// gains a deferred match the leg resolves by hand (F4).
// Run: node app/tests/harness-v461.mjs   (from the worktree root)
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import http from 'node:http';

const ROOT = process.cwd();
const APP = ROOT + '/app';
const CLIENT = APP + '/worker/src/client.ts';
const UI = APP + '/worker/src/ui.ts';
const C_SRC = readFileSync(CLIENT, 'utf8');
const U_SRC = readFileSync(UI, 'utf8');

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- statics ---------------- */
{
  ok(/current: null, pendingStart: null,/.test(C_SRC), 'F1 statics: state.pendingStart declared in the state literal, null at birth');
  ok((C_SRC.match(/state\.pendingStart = desc;/g) || []).length === 1, 'F1 statics: exactly ONE set seat (startDesc)');
  ok(/function transportEngaged\(\) \{\n  return transportPlaying\(\) \|\| !!state\.pendingStart;\n\}/.test(C_SRC), 'F1 statics: transportEngaged reads playing OR pending');
  ok(/function cancelPendingStart\(\) \{\n  state\.pendingStart = null;\n  pauseTransport\(\);\n\}/.test(C_SRC), 'F1 statics: cancelPendingStart clears first, then pauses');
  ok(/onStartRejected\(desc, e\)/.test(C_SRC), 'F2 statics: loadDescAudio passes the rejection through');
  const osr = C_SRC.slice(C_SRC.indexOf('function onStartRejected'));
  ok(osr.indexOf("err.name === 'AbortError'") > -1 && osr.indexOf("err.name === 'AbortError'") < osr.indexOf('noteStartFailed()'),
    'F2 statics: the AbortError return stands ahead of the currency check and the fact report');
  ok(/dayPositions\[episodeId\] = pos/.test(C_SRC) && /delete state\.dayPayload\.dayPositions\[episodeId\]/.test(C_SRC),
    'F3 statics: writeDayPositionQuiet carries the in-memory fold leg (set + delete)');
  const tp = C_SRC.slice(C_SRC.indexOf('function tapPlay'), C_SRC.indexOf('function resumeCurrent'));
  ok(tp.indexOf('cancelPendingStart()') > -1 && tp.indexOf('cancelPendingStart()') < tp.indexOf('transportPlaying()')
    && tp.indexOf('resumeCurrent(); return; }') > tp.indexOf('transportPlaying()')
    && tp.indexOf('resumeCurrent(); return; }') < tp.indexOf('sectionQueueFrom'),
    'F3 statics: tapPlay branch order — pending cancel, playing toggle, paused resume, rebuild');
  ok(/if \(state\.current !== desc\) return; if \(blob\) desc\.url = mintBlobUrl\(desc, blob\);/.test(C_SRC),
    'F4 statics: the currency check stands at the cache chain head, before the mint');
  ok(/else if \(state\.pendingStart\) cancelPendingStart\(\);/.test(C_SRC), 'F6 statics: fireTimedStop gains the pending branch through the cancel helper');
}

/* ---------------- client extraction (v412 mold) ---------------- */
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
/* The mold extracts declarations only; the one-line and
   brace-matched top-level REGISTRATIONS the legs exercise
   (the element's play/pause listener lines, the dock play
   wiring) are appended verbatim from the same source, so the
   page carries the shipped statements themselves. */
function extractStatements(src, prefix) {
  const out = []; let idx = 0;
  while (true) {
    const i = src.indexOf(prefix, idx);
    if (i < 0) break;
    if (i > 0 && src[i - 1] !== '\n') { idx = i + 1; continue; }
    let depth = 0, opened = false, j = i, end = -1;
    while (j < src.length) {
      const ch = src[j];
      if (ch === '{') { depth++; opened = true; }
      else if (ch === '}') depth--;
      else if (ch === ';' && opened && depth <= 0) { end = j + 1; break; }
      j++;
    }
    if (end < 0) break;
    out.push(src.slice(i, end));
    idx = end;
  }
  return out;
}
const REG_STMTS = [
  ...extractStatements(C_SRC, "audioEl.addEventListener('play'"),
  ...extractStatements(C_SRC, "audioEl.addEventListener('pause'"),
  ...extractStatements(C_SRC, "document.getElementById('dock-play').addEventListener"),
];
console.log('note - registrations appended verbatim:', REG_STMTS.length, '(1 play + 7 pause + 1 dock-play)');
const APP_CSS = U_SRC.slice(U_SRC.indexOf('APP_CSS = `') + 11, U_SRC.indexOf('`;', U_SRC.indexOf('APP_CSS = `')));

const PAGE_HEAD = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>CSSHERE</style></head>
<body data-lit="">
<audio id="audio"></audio>
<div id="alert"></div><main id="view"></main>
<div id="dock" class="dock hidden"><img class="dockthumb" src="/logo.png" alt=""><div class="docktext"><div class="docktitle" id="dock-title"></div><div class="dockmeta" id="dock-meta"></div></div><button id="dock-play" class="playbtn" aria-label="Play or pause"></button><button id="dock-autoplay" class="docknext dockauto" aria-label="Autoplay">Autoplay On</button><button id="dock-intentions" class="docknext dockauto" aria-label="Intentions" aria-pressed="true">Intentions On</button><button id="dock-prev" class="docknext" aria-label="Previous track">&#9198;</button><button id="dock-next" class="docknext" aria-label="Next track">&#9197;</button><button id="dock-rate" class="docknext dockauto" aria-label="Playback speed">1&times;</button><div class="dockprogress"><i id="dock-progress-fill"></i></div></div>
<div id="cards"><div data-card="ep1"></div><div data-card="ep2"></div></div>
<div id="rows"></div>
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
var state = { tab: 'prayers', block: null, playingKey: null, playingUrl: null, queue: [], queueIdx: -1, current: null, pendingStart: null,
  storedDay: '2026-11-14', presentedDay: '2026-11-14', dateLabel: 'Saturday, November 14', liturgical: null,
  pendingResume: null, sleep: { mode: 'off' }, readTracks: {}, dayDescs: [], dayPayload: null, playedCache: null,
  repeatIds: {}, previewQueue: null, queuePreviewIdx: -1, restoredQueue: false, restoreProbe: null, podRestoreProbe: null,
  prayersView: { kind: 'home' }, searchQuery: '', podcasts: null, podcastsIndex: null, podcastsReturn: null,
  rate: 1, errWaitKey: null, errWaitN: 0, startRetryKey: null, lastStartAt: 0 };
</` + `script>`;
const PAGE = PAGE_HEAD.replace('CSSHERE', () => APP_CSS) + '<script>\n' + pieces.join('\n') + '\n' + REG_STMTS.join('\n') + '\n</' + 'script>';

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
      ended: false, error: null, playCalls: 0, pauseCalls: 0, loadCalls: 0,
      playMode: 'resolve', rejectName: 'NotAllowedError', pend: null, pauseRejectsPend: true,
      play: function () {
        a.playCalls++;
        if (a.playMode === 'pend' || (a.playMode === 'reject-first-pend' && a.playCalls > 1)) {
          var pc = a.pauseCalls;
          return new Promise(function (res, rej) { a.pend = { resolve: res, reject: rej, pauseAtCall: pc }; });
        }
        if (a.playMode === 'reject' || a.playMode === 'reject-first-pend') {
          var e = new Error('rejected'); e.name = a.rejectName; return Promise.reject(e);
        }
        a.paused = false; return Promise.resolve();
      },
      pause: function () {
        a.pauseCalls++; a.paused = true;
        // element truth: a pause landing on a pending play()
        // rejects that promise as AbortError.
        if (a.pend && a.pauseRejectsPend) {
          var p = a.pend; a.pend = null;
          var e2 = new Error('interrupted'); e2.name = 'AbortError'; p.reject(e2);
        }
      },
      load: function () { a.loadCalls++; },
      addEventListener: function () {}, removeEventListener: function () {} };
    return a;
  };
  window.__settlePend = function (how, name) {
    var a = window.__fake; if (!a.pend) return false;
    var p = a.pend; a.pend = null;
    if (how === 'resolve') { if (a.pauseCalls === p.pauseAtCall) a.paused = false; p.resolve(); }
    else { var e = new Error('settled'); e.name = name || 'AbortError'; p.reject(e); }
    return true;
  };
  window.__firePlay = function () { document.getElementById('audio').dispatchEvent(new Event('play')); };
  window.__firePause = function () { document.getElementById('audio').dispatchEvent(new Event('pause')); };
  // window.caches is a read-only native accessor — plain
  // assignment silently fails, so the stub installs by
  // defineProperty (configurable; __reset's delete restores
  // the native). Each match() is a deferred the leg resolves.
  window.__stubCaches = function () {
    window.__cacheReads = [];
    var stub = { open: function () { return Promise.resolve({ match: function (key) {
      var d = { key: key }; d.promise = new Promise(function (res) { d.resolve = res; });
      window.__cacheReads.push(d); return d.promise; } }); } };
    Object.defineProperty(window, 'caches', { value: stub, configurable: true, writable: true });
    window.__cachesStubbed = true;
  };
  window.__fake = window.__mkFakeAudio();
  window.audioEl = window.__fake;
  window.__desc = function (id, extra) {
    return Object.assign({ episodeId: id, kind: 'episode', title: 'Track ' + id, block: 'Morning', url: 'https://x/' + id + '.mp3', available: true, durationS: 100 }, extra || {});
  };
  window.__reset = function () {
    state.queue = []; state.queueIdx = -1; state.current = null; state.pendingStart = null; state.dayDescs = []; state.dayPayload = null;
    state.podcasts = null; state.pendingResume = null; state.errWaitKey = null; state.errWaitN = 0;
    state.sleep = { mode: 'off' };
    state.startRetryKey = null; state.podRestoreProbe = null; playIntent = false; startFailedPending = false; stallClear();
    if (window.__cachesStubbed) { delete window.caches; window.__cachesStubbed = false; window.__cacheReads = []; }
    document.getElementById('cards').innerHTML = '<div data-card="ep1"></div><div data-card="ep2"></div>';
    document.getElementById('rows').innerHTML = '';
    window.__fake = window.__mkFakeAudio(); window.audioEl = window.__fake;
    window.__fetchLog.length = 0;
  };
});
const ev = (fn) => page.evaluate(fn);

/* ---------------- F1: the pending-start model ---------------- */
{
  // Leg 1: a start pends -> a disc tap cancels (no second start).
  await ev(() => {
    __reset();
    var d1 = __desc('ep1');
    state.dayDescs = [d1];
    __fake.playMode = 'pend';
    playTrack(d1);
    window.__f1a0 = { playCalls: __fake.playCalls, src: __fake.src, pend: state.pendingStart === state.current };
    tapPlay(d1);
  });
  await sleep(60);
  const a = await ev(() => ({ pre: window.__f1a0, playCalls: __fake.playCalls, pend: state.pendingStart,
    src: __fake.src, paused: __fake.paused, engaged: transportEngaged(),
    glyph: (updateDock(), document.getElementById('dock-play').innerHTML) }));
  ok(a.pre.playCalls === 1 && a.pre.pend, 'F1 leg 1: the start stands pending (one play(), the flag names the current)', JSON.stringify(a.pre));
  ok(a.playCalls === 1 && a.pend === null && a.src === a.pre.src && a.paused && !a.engaged && a.glyph === '▶',
    'F1 leg 1: a disc tap in the window CANCELS — no second start, src untouched, the faces read paused', JSON.stringify(a));

  // Leg 2: a start pends -> a dock tap cancels the same way.
  await ev(() => {
    __reset();
    var d1 = __desc('ep1');
    state.dayDescs = [d1];
    __fake.playMode = 'pend';
    playTrack(d1);
    document.getElementById('dock-play').click();
  });
  await sleep(60);
  const b = await ev(() => ({ playCalls: __fake.playCalls, pend: state.pendingStart, paused: __fake.paused }));
  ok(b.playCalls === 1 && b.pend === null && b.paused, 'F1 leg 2: a dock tap in the window cancels the same way', JSON.stringify(b));

  // Leg 3: in the window the dock glyph and the row disc agree.
  await ev(() => {
    __reset();
    var d1 = __desc('ep1');
    state.dayDescs = [d1];
    document.getElementById('rows').innerHTML = '<button class="playbtn" data-playkey="ep1">&#9654;</button>';
    __fake.playMode = 'pend';
    playTrack(d1);
    window.__f1c = { dock: document.getElementById('dock-play').innerHTML,
      disc: document.querySelector('[data-playkey="ep1"]').innerHTML,
      playing: transportPlaying(), engaged: transportEngaged() };
  });
  const c = await ev(() => window.__f1c);
  ok(c.playing === false && c.engaged === true && c.dock === c.disc && c.dock !== '▶' && c.dock.length > 0,
    'F1 leg 3: during the window the element reads paused, the engaged read stands, and the dock glyph and the row disc AGREE (both ❚❚)', JSON.stringify(c));

  // Leg 4: after a cancel, a fresh tap on the paused current
  // resumes through resumeCurrent with no rebuild.
  await ev(() => {
    __reset();
    var d1 = __desc('ep1'), d2 = __desc('ep2');
    state.dayDescs = [d1, d2];
    __fake.playMode = 'pend';
    startQueue([d1, d2], true);
    tapPlay(d1); // the cancel
    window.__f1d0 = { queue: state.queue, idx: state.queueIdx, src: __fake.src, playCalls: __fake.playCalls };
    __fake.playMode = 'resolve';
    __fake.currentSrc = __fake.src;
    tapPlay(d1); // the fresh tap — an unpause now
  });
  await sleep(60);
  const d = await ev(() => ({ pre: window.__f1d0, queueSame: state.queue === window.__f1d0.queue,
    idx: state.queueIdx, src: __fake.src, playCalls: __fake.playCalls, pend: state.pendingStart, paused: __fake.paused }));
  ok(d.queueSame && d.idx === d.pre.idx && d.src === d.pre.src && d.playCalls === d.pre.playCalls + 1 && d.pend === null && d.paused === false,
    'F1 leg 4: after a cancel, a fresh tap resumes the standing current — queue array, index, and src untouched, exactly one resume play()', JSON.stringify(d));
}

/* ---------------- F2: name discrimination ---------------- */
{
  // Leg 1: an AbortError rejection is a non-event.
  await ev(() => {
    __reset();
    var d1 = __desc('ep1');
    state.dayDescs = [d1];
    state.dayPayload = { presentedDay: '2026-11-14', dayPositions: {}, blocks: [] };
    __fake.playMode = 'reject'; __fake.rejectName = 'AbortError';
    playTrack(d1);
  });
  await sleep(80);
  const a = await ev(() => ({ playCalls: __fake.playCalls, key: state.startRetryKey, fact: startFailedPending,
    cur: state.current ? state.current.episodeId : null, pendStands: state.pendingStart === state.current,
    passline: !!document.querySelector('[data-card="ep1"] .passline') }));
  ok(a.playCalls === 1 && a.key === null && a.fact === false && a.cur === 'ep1' && a.pendStands && !a.passline,
    'F2 leg 1: AbortError — no retry, no key, no fact, no pass-over, no state touched', JSON.stringify(a));

  // Leg 2: a NotAllowedError keeps the standing recovery —
  // the fact, the key, exactly one retry (left pending here
  // so the intermediate state can be read).
  await ev(() => {
    __reset();
    var d1 = __desc('ep1');
    state.dayDescs = [d1];
    state.dayPayload = { presentedDay: '2026-11-14', dayPositions: {}, blocks: [] };
    __fake.playMode = 'reject-first-pend'; __fake.rejectName = 'NotAllowedError';
    playTrack(d1);
  });
  await sleep(80);
  const b = await ev(() => ({ playCalls: __fake.playCalls, key: state.startRetryKey, fact: startFailedPending,
    pendStands: state.pendingStart === state.current && !!state.pendingStart }));
  ok(b.playCalls === 2 && b.key === 'ep1@single' && b.fact === true && b.pendStands,
    'F2 leg 2: NotAllowedError — the fact stands, the retry key is set, exactly one retry start pends', JSON.stringify(b));

  // Leg 3: a second refusal passes over — in a queue the
  // queue advances (both entries burn their two attempts and
  // the queue exhausts); a single play stops paused with the
  // pass line showing.
  await ev(() => {
    __reset();
    var d1 = __desc('ep1'), d2 = __desc('ep2');
    state.dayDescs = [d1, d2];
    state.dayPayload = { presentedDay: '2026-11-14', dayPositions: {}, blocks: [] };
    __fake.playMode = 'reject'; __fake.rejectName = 'NotAllowedError';
    startQueue([d1, d2], true);
  });
  await sleep(120);
  const c1 = await ev(() => ({ playCalls: __fake.playCalls, cur: state.current, q: state.queue.length,
    p1: !!document.querySelector('[data-card="ep1"] .passline'), p2: !!document.querySelector('[data-card="ep2"] .passline') }));
  ok(c1.playCalls === 4 && c1.cur === null && c1.q === 0 && c1.p1 && c1.p2,
    'F2 leg 3 (queue form): the second refusal passes over — the queue ADVANCES to the next entry (its own two attempts follow), then exhausts', JSON.stringify(c1));
  await ev(() => {
    __reset();
    var d1 = __desc('ep1');
    state.dayDescs = [d1];
    state.dayPayload = { presentedDay: '2026-11-14', dayPositions: {}, blocks: [] };
    __fake.playMode = 'reject'; __fake.rejectName = 'NotAllowedError';
    playTrack(d1);
  });
  await sleep(120);
  const c2 = await ev(() => ({ playCalls: __fake.playCalls, key: state.startRetryKey, paused: __fake.paused,
    pend: state.pendingStart, passline: !!document.querySelector('[data-card="ep1"] .passline') }));
  ok(c2.playCalls === 2 && c2.key === null && c2.paused && c2.pend === null && c2.passline,
    'F2 leg 3 (single form): the second refusal stops the single play, paused, its card showing why', JSON.stringify(c2));
}

/* ---------------- F3: the disc unpause + the fold leg ---------------- */
{
  // Leg 1: a paused current mid-queue, disc-tapped -> the
  // resume path (queue and position stand, no startDesc).
  await ev(() => {
    __reset();
    var d1 = __desc('ep1'), d2 = __desc('ep2'), d3 = __desc('ep3');
    state.dayDescs = [d1, d2, d3];
    state.dayPayload = { presentedDay: '2026-11-14', dayPositions: {}, blocks: [] };
    startQueue([d1, d2, d3], true);
    __firePlay();
    advanceQueue(1);
    __firePlay();
    __fake.duration = 600;
    __fake.currentTime = 180;
    __fake.paused = true;
    __firePause(); // the pause save rides the standing listeners
    window.__f3a0 = { queue: state.queue, idx: state.queueIdx, src: __fake.src, playCalls: __fake.playCalls, fold: state.dayPayload.dayPositions.ep2 };
    __fake.currentSrc = __fake.src;
    tapPlay(d2);
  });
  await sleep(60);
  const a = await ev(() => ({ pre: window.__f3a0, queueSame: state.queue === window.__f3a0.queue,
    idx: state.queueIdx, src: __fake.src, playCalls: __fake.playCalls, pend: state.pendingStart, paused: __fake.paused }));
  ok(a.pre.fold === 180, 'F3 leg 1 (setup): the pause at 3:00 saved into the in-memory fold', JSON.stringify(a.pre));
  ok(a.queueSame && a.idx === a.pre.idx && a.src === a.pre.src && a.playCalls === a.pre.playCalls + 1 && a.pend === null && a.paused === false,
    'F3 leg 1: the disc on the paused current RESUMES — queue array, index, src untouched; one resume play(); no startDesc', JSON.stringify(a));

  // Leg 2: the fold hands the saved position to a restart.
  await ev(() => {
    __reset();
    var d1 = __desc('ep1');
    state.dayDescs = [d1];
    state.dayPayload = { presentedDay: '2026-11-14', dayPositions: {}, blocks: [] };
    var payloadRef = state.dayPayload;
    writeDayPositionQuiet('ep1', 180, 300);
    window.__f3b0 = { fold: state.dayPayload.dayPositions.ep1,
      posts: __fetchLog.filter(function (l) { return l.path === '/api/player/day-position'; }).length };
    startDesc(d1);
    window.__f3b1 = { resume: state.pendingResume, samePayload: state.dayPayload === payloadRef };
  });
  const b = await ev(() => ({ a: window.__f3b0, b: window.__f3b1 }));
  ok(b.a.fold === 180 && b.a.posts === 1, 'F3 leg 2: the save writes the fold in memory as it posts', JSON.stringify(b.a));
  ok(b.b.resume && b.b.resume.episodeId === 'ep1' && b.b.resume.positionS === 180 && b.b.samePayload,
    'F3 leg 2: a startDesc restart reads 180 from the fold — no refetch', JSON.stringify(b.b));

  // Leg 3: a zero save deletes the fold entry.
  await ev(() => {
    __reset();
    var d1 = __desc('ep1');
    state.dayDescs = [d1];
    state.dayPayload = { presentedDay: '2026-11-14', dayPositions: {}, blocks: [] };
    writeDayPositionQuiet('ep1', 180, 300);
    writeDayPositionQuiet('ep1', 0, 0);
    window.__f3c0 = { has: 'ep1' in state.dayPayload.dayPositions };
    startDesc(d1);
    window.__f3c1 = { resume: state.pendingResume };
  });
  const c = await ev(() => ({ a: window.__f3c0, b: window.__f3c1 }));
  ok(!c.a.has && !c.b.resume, 'F3 leg 3: position 0 deletes the fold entry — a finished prayer restarts at 0', JSON.stringify(c));
}

/* ---------------- F4: the cache currency guard ---------------- */
{
  // Leg 1: a superseded read drops silently. (The evaluates
  // are async: the cache chain's match() calls land in
  // microtasks after startDesc returns, so each leg awaits a
  // tick before touching __cacheReads.)
  await ev(async () => {
    __reset();
    __stubCaches();
    var p1 = { episodeId: 'biy:day-2', kind: 'podcast', podSeries: 'bible', seriesKey: 'biy:day-2', title: 'Day 2', url: 'https://x/2.mp3', available: true, durationS: 100, block: 'Podcasts', podPositionS: null };
    var p2 = { episodeId: 'biy:day-3', kind: 'podcast', podSeries: 'bible', seriesKey: 'biy:day-3', title: 'Day 3', url: 'https://x/3.mp3', available: true, durationS: 100, block: 'Podcasts', podPositionS: null };
    window.__p1 = p1; window.__p2 = p2;
    startDesc(p1);
    startDesc(p2);
    await new Promise((r) => setTimeout(r, 30));
    window.__f4a0 = { reads: window.__cacheReads.length, cur: state.current.episodeId };
    window.__cacheReads[1].resolve(null); // the standing start's read lands first (a miss — the stream)
  });
  await sleep(60);
  await ev(() => { window.__urlN0 = window.__urlN; window.__cacheReads[0].resolve(new Response(new Blob(['mp3']), { status: 200 })); });
  await sleep(60);
  const a = await ev(() => ({ pre: window.__f4a0, src: __fake.src, playCalls: __fake.playCalls,
    p1url: window.__p1.url, p1blob: window.__p1.blobUrl || null, minted: window.__urlN - window.__urlN0,
    cur: state.current.episodeId }));
  ok(a.pre.reads === 2 && a.pre.cur === 'biy:day-3', 'F4 leg 1 (setup): two cache reads stand, the second start is current', JSON.stringify(a.pre));
  ok(a.src === 'https://x/3.mp3' && a.playCalls === 1 && a.p1url === 'https://x/2.mp3' && a.p1blob === null && a.minted === 0,
    'F4 leg 1: the superseded read resolves late and DROPS — no load, no play, no mint against the dead start', JSON.stringify(a));

  // Leg 2: the standing start's own read loads and plays.
  await ev(async () => {
    __reset();
    __stubCaches();
    var p1 = { episodeId: 'biy:day-2', kind: 'podcast', podSeries: 'bible', seriesKey: 'biy:day-2', title: 'Day 2', url: 'https://x/2.mp3', available: true, durationS: 100, block: 'Podcasts', podPositionS: null };
    window.__p1 = p1;
    startDesc(p1);
    await new Promise((r) => setTimeout(r, 30));
    window.__cacheReads[0].resolve(new Response(new Blob(['mp3']), { status: 200 })); // the chain reads resp.blob() — a Response, as the real cache hands back
  });
  await sleep(60);
  const b = await ev(() => ({ src: __fake.src, playCalls: __fake.playCalls,
    pendStands: state.pendingStart === window.__p1, blob: window.__p1.blobUrl }));
  ok(b.src.indexOf('blob:fake-') === 0 && b.playCalls === 1 && b.pendStands && b.blob === b.src,
    'F4 leg 2: the standing start\u2019s own read passes the guard — it mints, loads, and plays', JSON.stringify(b));
  await ev(() => { delete window.caches; window.__cachesStubbed = false; });
}

/* ---------------- F6: the sleep deadline vs a pending start ---------------- */
{
  // Leg 1a: the deadline fires in the window; the cancel's
  // pause rejects the pending play (AbortError — ignored).
  await ev(() => {
    __reset();
    var d1 = __desc('ep1');
    state.dayDescs = [d1];
    armSleepMinutes(5);
    __fake.playMode = 'pend';
    playTrack(d1);
    window.__f6a0 = { pend: !!state.pendingStart, mode: state.sleep.mode };
    fireTimedStop();
  });
  await sleep(60);
  const a = await ev(() => ({ pre: window.__f6a0, pend: state.pendingStart, mode: state.sleep.mode,
    paused: __fake.paused, playCalls: __fake.playCalls }));
  ok(a.pre.pend && a.pre.mode === 'minutes' && a.pend === null && a.mode === 'off' && a.paused && a.playCalls === 1,
    'F6 leg 1: a deadline in the load window retires the pending start — disarmed, paused, no completion into playback', JSON.stringify(a));

  // Leg 1b: the other settle — the promise resolves AFTER the
  // cancel (the pause did not auto-reject it): the pause
  // still won; nothing unpauses.
  await ev(() => {
    __reset();
    var d1 = __desc('ep1');
    state.dayDescs = [d1];
    armSleepMinutes(5);
    __fake.playMode = 'pend'; __fake.pauseRejectsPend = false;
    playTrack(d1);
    fireTimedStop();
    window.__f6b0 = { settled: __settlePend('resolve'), pend: state.pendingStart };
  });
  await sleep(60);
  const b = await ev(() => ({ pre: window.__f6b0, paused: __fake.paused, pend: state.pendingStart, mode: state.sleep.mode }));
  ok(b.pre.settled && b.pre.pend === null && b.paused && b.pend === null && b.mode === 'off',
    'F6 leg 1 (late resolve): a pending play resolving after the deadline still leaves the player paused and disarmed', JSON.stringify(b));

  // Leg 2: a minutes arm + ordinary playing -> the standing
  // stop, unchanged.
  await ev(() => {
    __reset();
    var d1 = __desc('ep1');
    state.dayDescs = [d1];
    playTrack(d1);
    __firePlay();
    armSleepMinutes(5);
    window.__f6c0 = { pauseCalls: __fake.pauseCalls, paused: __fake.paused };
    fireTimedStop();
  });
  const c = await ev(() => ({ pre: window.__f6c0, pauseCalls: __fake.pauseCalls, paused: __fake.paused, mode: state.sleep.mode }));
  ok(!c.pre.paused && c.pauseCalls === c.pre.pauseCalls + 1 && c.paused && c.mode === 'off',
    'F6 leg 2: a deadline over ordinary playing pauses exactly as before', JSON.stringify(c));
}

/* ---------------- N: neighbor spot-checks ---------------- */
{
  const r = await ev(() => {
    __reset();
    var d1 = __desc('ep1'), d2 = __desc('ep2');
    state.dayDescs = [d1, d2];
    startQueue([d1, d2], true);
    __firePlay();
    advanceQueue(1);
    __firePlay();
    __fake.currentTime = 10;
    previousWithRule();
    var n1a = { t: __fake.currentTime, idx: state.queueIdx };
    __fake.currentTime = 2;
    previousWithRule();
    var n1b = { idx: state.queueIdx, cur: state.current.episodeId };
    __fake.duration = 100; __fake.currentTime = 50;
    var n2 = [];
    seekBy(10); n2.push(__fake.currentTime);
    seekBy(-1000); n2.push(__fake.currentTime);
    seekBy(1000); n2.push(__fake.currentTime);
    return { n1a: n1a, n1b: n1b, n2: n2 };
  });
  ok(r.n1a.t === 0 && r.n1a.idx === 1 && r.n1b.idx === 0 && r.n1b.cur === 'ep1',
    'N1: the one Previous rule stands — > 3 s restarts the track, under steps back', JSON.stringify(r));
  ok(JSON.stringify(r.n2) === JSON.stringify([60, 0, 100]), 'N2: seekBy clamps at both ends, as built', JSON.stringify(r.n2));
  await ev(() => {
    __reset();
    var d1 = __desc('ep1'), d2 = __desc('ep2');
    state.dayDescs = [d1, d2];
    startQueue([d1, d2], true);
    __firePlay();
    armSleepTrack();
    __fake.paused = true; // the ended track's element stands stopped
    var pc0 = __fake.playCalls;
    sleepTrackEnd();
    window.__n3 = { cur: state.current ? state.current.episodeId : null, idx: state.queueIdx,
      playCalls: __fake.playCalls, pc0: pc0, paused: __fake.paused, src: __fake.src, mode: state.sleep.mode, loadCalls: __fake.loadCalls };
  });
  const n3 = await ev(() => window.__n3);
  ok(n3.cur === 'ep2' && n3.idx === 1 && n3.playCalls === n3.pc0 && n3.paused && n3.src === 'https://x/ep2.mp3' && n3.mode === 'off',
    'N3: sleepTrackEnd holds the next head paused and UNSTARTED (src loaded, no play call), the arm disarmed', JSON.stringify(n3));
}

/* ---------------- A: field addendum — the outside-the-app routes, in-page ---------------- */
{
  // The media-session table: play while pending is a no-op,
  // pause while pending cancels — the same functions the
  // in-app surfaces land on.
  await ev(() => {
    __reset();
    var d1 = __desc('ep1');
    state.dayDescs = [d1];
    __fake.playMode = 'pend';
    playTrack(d1);
    mediaHandlers.play();
    window.__aa0 = { playCalls: __fake.playCalls, pend: !!state.pendingStart };
    mediaHandlers.pause();
    window.__aa1 = { playCalls: __fake.playCalls, pend: state.pendingStart, paused: __fake.paused };
  });
  await sleep(60);
  const a = await ev(() => ({ a: window.__aa0, b: window.__aa1 }));
  ok(a.a.playCalls === 1 && a.a.pend, 'A1: the media-session play handler in the window is a no-op — no stacked play()', JSON.stringify(a.a));
  ok(a.b.playCalls === 1 && a.b.pend === null && a.b.paused, 'A1: the media-session pause handler in the window cancels the pending start', JSON.stringify(a.b));

  // The bridge command path: play/pause land on the same
  // transport — and a bridge play on a PAUSED standing
  // current resumes through resumeCurrent (the route John's
  // 2026-11-16 00:04 field report exercises from the lock
  // screen / headset while the page stands alive).
  await ev(() => {
    __reset();
    var d1 = __desc('ep1');
    state.dayDescs = [d1];
    __fake.playMode = 'pend';
    playTrack(d1);
    handleTransportCommand({ command: 'play' });
    window.__ab0 = { playCalls: __fake.playCalls, pend: !!state.pendingStart };
    handleTransportCommand({ command: 'pause' });
    window.__ab1 = { pend: state.pendingStart };
    __fake.playMode = 'resolve';
    playTrack(d1);
    __firePlay();
    __fake.paused = true;
    __firePause();
    __fake.currentSrc = __fake.src;
    window.__ab2 = { playCalls: __fake.playCalls };
    handleTransportCommand({ command: 'play' });
  });
  await sleep(60);
  const b2 = await ev(() => ({ a: window.__ab0, b: window.__ab1, pre: window.__ab2,
    playCalls: __fake.playCalls, paused: __fake.paused, pend: state.pendingStart }));
  ok(b2.a.playCalls === 1 && b2.a.pend && b2.b.pend === null,
    'A2: the bridge play in the window is a no-op and the bridge pause cancels — the tail ack push stands', JSON.stringify(b2));
  ok(b2.playCalls === b2.pre.playCalls + 1 && b2.paused === false && b2.pend === null,
    'A2: a bridge play on a paused standing current RESUMES through resumeCurrent (no reload, no rebuild)', JSON.stringify(b2));
}

await browser.close();
server.close();
console.log('---');
console.log('harness-v461: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) console.log('failures: ' + failures.join(' | '));
process.exit(fail ? 1 : 0);
