// harness-v477.mjs — v477 evidence: the Now Playing queue's
// played dot for podcast episodes (the v464 §6 GAP fix).
//   S   statics: the renderQueueList kind branch; podDesc
//       carrying the entry's listened flag; the queue sync
//       (podSyncQueueListened) seated beside BOTH mark writers;
//       markCompleted's podcast branch still returns before
//       the day write (the boundary the fix respects)
//   Q1  a feed episode (RSS payload, Counsel form) marked by
//       hand — podToggleMark, the series page's mark act —
//       lights its queue dot at the next render, the payload
//       entry and the queue descriptor in agreement
//   Q2  the same episode played to the end — markCompleted,
//       the ended seam's writer — lights the dot through the
//       auto-mark's own path, and the day store gains NO entry
//       for the episode (a podcast writes no day record)
//   Q3  an unmark (podToggleMark again) clears the dot
//   Q4  after a queue restore (the podcast snapshot form,
//       rebuilt by tryStandPodcastRestore from a fresh
//       store-folded payload) the marked episode's dot stands
//       ON and its unmarked neighbour's OFF
//   Q5  a standing audio-series episode (the non-RSS payload
//       form, canonical seq_keys) behaves identically — the
//       fix is kind-wide, not RSS-only
//   Q6  day regression: a day row's dot still reads the day
//       store (writePlayed lights it), and a podcast row does
//       NOT light from a day-store entry under its own id —
//       the branch is pinned in both directions
// The series-page button → podToggleMark wiring is the v464
// gate's standing coverage; these legs drive the act functions
// the buttons call, per the mold.
// Mold: harness-v473 (client extraction + Chromium + the fake
// audio). The fetch stub answers the mark routes ok and logs
// every call, so the legs can see the (series, seqKey) posts.
// Run: node app/tests/harness-v477.mjs   (from the worktree root)
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
  const rql = C_SRC.slice(C_SRC.indexOf('function renderQueueList'), C_SRC.indexOf('function previewQueueTap'));
  ok(rql.indexOf("var on = desc.kind === 'podcast' ? !!desc.listened : (dstr ? isPlayed(desc.episodeId, dstr, desc.block) : false);") > -1,
    'S statics: renderQueueList branches on kind — a podcast row reads the descriptor listened flag, a day row keeps the isPlayed read');
  const pd = C_SRC.slice(C_SRC.indexOf('function podDesc'), C_SRC.indexOf('function podCurrentKey'));
  ok(pd.indexOf('listened: !!e.listened') > -1,
    'S statics: podDesc carries the entry listened flag onto the descriptor');
  ok(/function podSyncQueueListened\(series, seqKey, on\)/.test(C_SRC)
    && (C_SRC.match(/podSyncQueueListened\(/g) || []).length === 3,
    'S statics: podSyncQueueListened stands defined with exactly two call seats (the definition + writePodMarkQuiet + podToggleMark)');
  const wpmq = C_SRC.slice(C_SRC.indexOf('function writePodMarkQuiet'), C_SRC.indexOf('function renderPodcasts'));
  ok(wpmq.indexOf('podSyncQueueListened(seriesKey, seqKey, true);') > wpmq.indexOf('state.podcasts.entries.forEach'),
    'S statics: the auto-mark sync stands in writePodMarkQuiet, after the payload mutation it rides');
  const mc = C_SRC.slice(C_SRC.indexOf('function markCompleted'), C_SRC.indexOf('function setMediaSessionFor'));
  ok(mc.indexOf("if (desc.kind === 'podcast' && desc.seriesKey) { writePodMarkQuiet(desc.seriesKey, desc.podSeries, 'auto'); return; }") > -1
    && mc.indexOf("if (desc.kind === 'podcast' && desc.seriesKey)") < mc.indexOf('writePlayed(desc.episodeId'),
    'S statics: markCompleted still returns at the podcast branch — a podcast completion writes no day record (the boundary stands)');
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


/* ---------------- the mock shell ---------------- */
await ev(() => {
  window.__contracts = [];
  window.__commands = [];
  window.__pushes = [];
  window.__listeners = {};
  window.__completions = [];
  var bridge = {
    setNativeQueue: function (call) { window.__contracts.push(JSON.parse(call.queue)); return Promise.resolve(); },
    nativeTransport: function (call) { window.__commands.push(JSON.parse(call.command)); return Promise.resolve(); },
    setPlaybackState: function (call) { window.__pushes.push(JSON.parse(call.state)); return Promise.resolve(); },
    setDaySnapshot: function () { return Promise.resolve(); },
    armSleepDeadline: function () { return Promise.resolve(); },
    clearSleepDeadline: function () { return Promise.resolve(); },
    takeNativeCompletions: function () { var r = window.__completions; window.__completions = []; return Promise.resolve({ records: r }); },
    addListener: function (name, fn) { (window.__listeners[name] = window.__listeners[name] || []).push(fn); },
  };
  window.Capacitor = { Plugins: { OraDayBridge: bridge } };
  window.__emitNative = function (obj) {
    var hs = window.__listeners.nativeState || [];
    hs.forEach(function (f) { f({ state: JSON.stringify(obj) }); });
  };
  window.__nativeEvt = function (over) {
    return Object.assign({ engine: 'native', trackId: 'ep1', kind: 'episode', title: 'Track ep1', subtitle: '',
      block: 'Morning', dateLabel: state.dateLabel, playing: true, stopped: false, positionS: 0, durationS: 100,
      estimated: false, queueIndex: 0, queueCount: 3, queueIds: ['ep1', 'ep2', 'ep3'], rate: 1, ts: Date.now() }, over || {});
  };
  window.__reset466 = function () {
    window.__reset();
    window.__contracts = []; window.__commands = []; window.__pushes = []; window.__completions = [];
    nativeMirror = null; nativeContractDescs = []; nativePendingWatch = null;
    try { localStorage.removeItem('opn-autoplay-v358'); } catch (e) {}
  };
  window.__dayFixture = function (ids) {
    var descs = ids.map(function (id) { return window.__desc(id); });
    state.dayDescs = descs;
    state.dayPayload = { presentedDay: '2026-11-14', dayPositions: {}, blocks: [] };
    return descs;
  };
  setupBridgeCommands();
  setupNativeState();
});


/* ---------------- v477 in-page fixtures ---------------- */
await ev(() => {
  // The extraction drops the native-mirror vars (their units
  // fail the mold's naive parse, as in harness-v473) — seed
  // them as page globals at their declared initial values, the
  // v473 __reset466 posture, before any leg reads them.
  window.nativeMirror = null; window.nativePendingWatch = null; window.nativeContractDescs = [];

  window.__openSheet = function () {
    // The sheet markup mirrors openNowPlaying's own (the legs
    // drive the act functions directly, so no wiring rides) —
    // updateNowPlaying, which the restore calls through
    // updateDock, touches its elements unguarded.
    var old = document.querySelector('.np-sheet'); if (old) old.remove();
    var sheet = document.createElement('div'); sheet.className = 'sheet np-sheet';
    sheet.innerHTML = '<div class="inner">'
      + '<div class="np-hero">'
      + '<div class="np-grab"><span class="grabpill"></span></div>'
      + '<div class="np-art" id="np-art"></div>'
      + '<h1 class="screen np-title" id="np-title"></h1>'
      + '<p class="sub np-meta" id="np-meta"></p>'
      + '<div class="np-intention" id="np-intention" style="display:none"></div>'
      + '</div>'
      + '<div class="np-seekrow"><span id="np-elapsed">0:00</span><input type="range" id="np-seek" min="0" max="1000" value="0" aria-label="Seek"><span id="np-remain">--:--</span></div>'
      + '<div class="np-transport"><button class="np-tbtn" id="np-back10" aria-label="Back 10 seconds">-10</button><button class="np-tbtn" id="np-prev" aria-label="Previous track">&#9198;</button><button class="playbtn np-play" id="np-play" aria-label="Play or pause">&#9654;</button><button class="np-tbtn" id="np-next" aria-label="Next track">&#9197;</button><button class="np-tbtn" id="np-fwd10" aria-label="Forward 10 seconds">+10</button></div>'
      + '<div class="row np-controls"><button class="btn ghost" id="np-intentions">Intentions On</button><button class="btn ghost" id="np-read">Read</button><button class="btn ghost" id="np-menu" aria-label="Playback options">\\u22ee</button></div>'
      + '<div class="npq-head"><span class="npq-heading">Queue</span><span class="meta" id="np-queue-pos"></span></div>'
      + '<div id="np-queue" class="liblist"></div>'
      + '</div>';
    document.body.appendChild(sheet);
  };
  window.__dots = function () {
    return Array.prototype.map.call(document.querySelectorAll('#np-queue .npq-row'), function (row) {
      var dot = row.querySelector('.npq-dot');
      return { id: row.getAttribute('data-npq-id'), on: !!(dot && dot.className.indexOf(' on') >= 0) };
    });
  };
  window.__rssPayload = function (l1, l2) {
    return { series: 'counsel-of-trent', kind: 'rss', seriesTitle: 'The Counsel of Trent', showImageUrl: null,
      entries: [
        { key: 'ct-guid-001', label: '#1226', title: 'Feed Episode One', url: 'https://x/ct1.mp3', durationS: 1800, listened: !!l1, positionS: null, imageUrl: null, descText: null },
        { key: 'ct-guid-002', label: '#1225', title: 'Feed Episode Two', url: 'https://x/ct2.mp3', durationS: 1700, listened: !!l2, positionS: null, imageUrl: null, descText: null } ],
      listenedCount: (l1 ? 1 : 0) + (l2 ? 1 : 0), currentKey: 'ct-guid-001', total: 2 };
  };
  window.__seriesPayload = function (l1, l2) {
    return { series: 'bible-in-a-year', kind: 'series', seriesTitle: 'The Bible in a Year', showImageUrl: null,
      entries: [
        { key: 'biy:day-320', label: 'Day 320', title: 'Series Episode One', url: 'https://x/biy320.mp3', durationS: 1500, listened: !!l1, positionS: null, imageUrl: null, descText: null, kind: 'day' },
        { key: 'biy:day-319', label: 'Day 319', title: 'Series Episode Two', url: 'https://x/biy319.mp3', durationS: 1500, listened: !!l2, positionS: null, imageUrl: null, descText: null, kind: 'day' } ],
      listenedCount: (l1 ? 1 : 0) + (l2 ? 1 : 0), currentKey: 'biy:day-320', total: 2 };
  };
  window.__standQueue = function () {
    state.queue = state.podcasts.entries.map(function (e) { return podDesc(e); });
    state.queueIdx = 0; state.current = state.queue[0];
    window.__openSheet(); renderQueueList();
  };
  window.__reset477 = function () {
    window.__reset();
    state.playedCache = null;
    try { localStorage.removeItem('opn-played-v344'); localStorage.removeItem('opn-queue-v355'); } catch (e) {}
    var sheet = document.querySelector('.np-sheet'); if (sheet) sheet.remove();
  };
});

/* ============ Q1: a hand mark lights the queue dot ============ */
{
  await ev(() => {
    window.__reset477();
    state.podcasts = window.__rssPayload(false, false);
    window.__standQueue();
    window.__q1before = window.__dots();
    podToggleMark('ct-guid-001'); // the series page's mark act
    renderQueueList();
    window.__q1 = { dots: window.__dots(), entry: state.podcasts.entries[0].listened,
      descFlag: state.queue[0].listened,
      markPost: window.__fetchLog.some(function (f) { return f.path === '/api/player/podcasts/mark' && f.body && f.body.series === 'counsel-of-trent' && f.body.seqKey === 'ct-guid-001' && f.body.source === 'manual'; }) };
  });
  await sleep(30);
  const q1 = await ev(() => ({ before: window.__q1before, q: window.__q1 }));
  ok(q1.before.length === 2 && q1.before.every(function (d) { return !d.on; }),
    'Q1: an unmarked feed episode stands in the queue with its dot OFF', JSON.stringify(q1.before));
  ok(q1.q.dots[0].on === true && q1.q.dots[1].on === false && q1.q.entry === true && q1.q.descFlag === true,
    'Q1: the hand mark lights the queue dot at the next render — payload entry, descriptor flag, and dot in agreement', JSON.stringify(q1.q));
  ok(q1.q.markPost === true, 'Q1: the mark posted the (series, seqKey) pair with source manual — the one server store', JSON.stringify(q1.q));

  /* ---- Q3: the unmark clears it (same standing queue) ---- */
  await ev(() => {
    podToggleMark('ct-guid-001');
    renderQueueList();
    window.__q3 = { dots: window.__dots(), entry: state.podcasts.entries[0].listened,
      unmarkPost: window.__fetchLog.some(function (f) { return f.path === '/api/player/podcasts/unmark' && f.body && f.body.seqKey === 'ct-guid-001'; }) };
  });
  await sleep(30);
  const q3 = await ev(() => window.__q3);
  ok(q3.dots[0].on === false && q3.entry === false,
    'Q3: the unmark clears the queue dot in the same act', JSON.stringify(q3));
  ok(q3.unmarkPost === true, 'Q3: the unmark posted to the same store', JSON.stringify(q3));
}

/* ============ Q2: play-to-end lights the dot (the auto-mark) ============ */
{
  await ev(() => {
    window.__reset477();
    state.podcasts = window.__rssPayload(false, false);
    window.__standQueue();
    markCompleted(state.queue[0]); // the ended seam's writer, on the playing descriptor
    renderQueueList();
    var dayStore = {};
    try { dayStore = JSON.parse(localStorage.getItem('opn-played-v344') || '{}'); } catch (e) {}
    window.__q2 = { dots: window.__dots(), entry: state.podcasts.entries[0].listened,
      autoPost: window.__fetchLog.some(function (f) { return f.path === '/api/player/podcasts/mark' && f.body && f.body.seqKey === 'ct-guid-001' && f.body.source === 'auto'; }),
      dayStoreHasEp: Object.prototype.hasOwnProperty.call(dayStore, 'ct-guid-001') };
  });
  await sleep(30);
  const q2 = await ev(() => window.__q2);
  ok(q2.dots[0].on === true && q2.dots[1].on === false && q2.entry === true,
    'Q2: playing the episode to the end lights its queue dot through the auto-mark path — no hand act', JSON.stringify(q2));
  ok(q2.autoPost === true, 'Q2: the auto-mark posted (series, seqKey) with source auto', JSON.stringify(q2));
  ok(q2.dayStoreHasEp === false, 'Q2: the day store gained NO entry for the podcast episode — the podcasts store is its record', JSON.stringify(q2));
}

/* ============ Q4: the restore reads the store ============ */
{
  await ev(() => {
    window.__reset477();
    state.podcasts = window.__rssPayload(false, false);
    window.__standQueue();
    podToggleMark('ct-guid-001');       // the mark stands in the server store
    saveQueueSnapshot(0);               // the page closes on the standing queue
    // a fresh session: the session state clears, the boot reads
    // the record, the series payload re-stands with the store's
    // mark folded in (as the server returns it)
    state.queue = []; state.queueIdx = -1; state.current = null; state.podcasts = null; state.podRestoreProbe = null;
    bootQueueSnapshot();
    state.podcasts = window.__rssPayload(true, false);
    window.__openSheet();
    tryStandPodcastRestore();
    window.__q4 = { dots: window.__dots(), qlen: state.queue.length,
      probeLeft: state.podRestoreProbe, flag0: state.queue[0] && state.queue[0].listened, flag1: state.queue[1] && state.queue[1].listened };
  });
  await sleep(30);
  const q4 = await ev(() => window.__q4);
  ok(q4.qlen === 2 && q4.probeLeft === null,
    'Q4: the podcast queue restored whole from its snapshot record', JSON.stringify(q4));
  ok(q4.dots[0].on === true && q4.flag0 === true,
    'Q4: the restored queue paints the marked episode dot ON — podDesc carried the store-folded flag', JSON.stringify(q4));
  ok(q4.dots[1].on === false && q4.flag1 === false,
    'Q4: the unmarked neighbour restores OFF — the read is per-episode, not per-series', JSON.stringify(q4));
}

/* ============ Q5: a standing audio-series episode behaves the same ============ */
{
  await ev(() => {
    window.__reset477();
    state.podcasts = window.__seriesPayload(false, false);
    window.__standQueue();
    markCompleted(state.queue[0]);
    renderQueueList();
    window.__q5a = window.__dots();
    podToggleMark('biy:day-319');
    renderQueueList();
    window.__q5b = window.__dots();
    podToggleMark('biy:day-319');
    renderQueueList();
    window.__q5 = { a: window.__q5a, b: window.__q5b, c: window.__dots() };
  });
  await sleep(30);
  const q5 = await ev(() => window.__q5);
  ok(q5.a[0].on === true && q5.a[1].on === false,
    'Q5: a standing audio-series episode played to the end lights its queue dot (non-RSS form)', JSON.stringify(q5.a));
  ok(q5.b[1].on === true, 'Q5: a hand mark lights it the same way — the fix is kind-wide', JSON.stringify(q5.b));
  ok(q5.c[1].on === false, 'Q5: and the unmark clears it', JSON.stringify(q5.c));
}

/* ============ Q6: the day rows are untouched (regression) ============ */
{
  await ev(() => {
    window.__reset477();
    state.podcasts = window.__rssPayload(true, false);
    var dayDesc = window.__desc('ep1');
    state.queue = [dayDesc, podDesc(state.podcasts.entries[0])];
    state.queueIdx = 0; state.current = dayDesc;
    window.__openSheet(); renderQueueList();
    window.__q6a = window.__dots();
    writePlayed('ep1', state.presentedDay, 'played', 'Morning');
    renderQueueList();
    window.__q6b = window.__dots();
    // the negative direction: a day-store entry under the
    // podcast episode's own id must NOT light its dot
    writePlayed('ct-guid-001', state.presentedDay, 'played', 'Podcasts');
    state.podcasts = window.__rssPayload(false, false);
    state.queue[1] = podDesc(state.podcasts.entries[0]);
    renderQueueList();
    window.__q6 = { a: window.__q6a, b: window.__q6b, c: window.__dots() };
  });
  await sleep(30);
  const q6 = await ev(() => window.__q6);
  ok(q6.a[0].on === false && q6.a[1].on === true,
    'Q6: standing side by side — the unmarked day row is dark while the marked podcast row reads its own mark (a presented date stands)', JSON.stringify(q6.a));
  ok(q6.b[0].on === true && q6.b[1].on === true,
    'Q6: the day write lights the day row from the day store, exactly as before', JSON.stringify(q6.b));
  ok(q6.c[1].on === false && q6.c[0].on === true,
    'Q6: a day-store entry under the podcast episode id does NOT light its dot — the podcast read never consults the day store', JSON.stringify(q6.c));
}

await browser.close();
server.close();
console.log('---');
console.log('harness-v477: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) console.log('failures: ' + failures.join(' | '));
process.exit(fail ? 1 : 0);

