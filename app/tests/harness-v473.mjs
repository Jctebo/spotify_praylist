// harness-v473.mjs — v473 resume-start fix-forward evidence (mold: harness-v466).
//   B0  statics: the mode is a capability read on the plugin
//       (setNativeQueue + nativeTransport); the push gate; the
//       contract send stands at startDesc's tail behind the
//       one pendingStart seat; the v461 model untouched
//   B1  a start sends the CONTRACT (items · queueEnd ·
//       startIndex · startPositionS · autoplay · the chain
//       tail) and never touches the element
//   B2  the autoplay window: OFF sends the user queue alone
//   B3  transport surfaces send COMMANDS (pause cancels a
//       pending native start · resume plays · next/previous ·
//       a jump re-sends the contract · setRate · the timed
//       stop) and never touch the element
//   B4  nativeState events drive the mirror, the current, the
//       dock read, and the pending-start ack; a stopped event
//       runs the terminal clear
//   B5  no engine-'web' push leaves the page while native
//       stands
//   B6  the completions drain applies a native day mark with
//       the in-memory legs
//   B7  with no contract method on the plugin (an old APK),
//       the mode reads off and the page engine starts as
//       before — mixed-version safety
//   B8  D-466-R1 (the Review return): a contract load with a
//       WEB face standing — the shell's arbitration 'stop'
//       lands on the page and the page's queue, current, and
//       saved snapshot stand intact
//   B9  v468 (the paused-standing field failure): a native
//       pending start the engine never acks — the standing
//       contract is re-sent ONCE past the bound, at the
//       mirror's position; and the row disc's glyph follows
//       the mirror's playing flips with the current standing
//       (the recording's disc/dock disagreement)
// Mold: harness-v461 (client extraction + Chromium + the fake
// audio), plus a mock OraDayBridge standing on window.Capacitor
// — the mock IS the shell for these legs: it records contracts
// and commands, spies pushes, serves the completions drain,
// and delivers nativeState events on the leg's word.
// Run: node app/tests/harness-v466.mjs   (from the worktree root)
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
  ok(/function oraNativeMode\(\) \{\n  var p = oraBridgePlugin\(\);\n  return !!\(p && p\.setNativeQueue && p\.nativeTransport\);\n\}/.test(C_SRC),
    'B0 statics: the mode is a capability read — the plugin stands AND carries both contract methods');
  ok((C_SRC.match(/state\.pendingStart = desc;/g) || []).length === 1,
    'B0 statics: still exactly ONE pendingStart set seat (startDesc) — the native start re-seats on the v461 model, never beside it');
  const sd = C_SRC.slice(C_SRC.indexOf('function startDesc'), C_SRC.indexOf('function playTrack'));
  ok(sd.indexOf('if (oraNativeMode() && nativeSendContract(desc)) return;') > sd.indexOf('saveQueueSnapshot(queueStartPos(desc))')
    && sd.indexOf('if (oraNativeMode() && nativeSendContract(desc)) return;') < sd.indexOf('loadDescAudio(desc);'),
    'B0 statics: the contract send stands at the funnel tail — after the bookkeeping, ahead of the element load and the cache chain');
  const pns = C_SRC.slice(C_SRC.indexOf('function pushNativeState'), C_SRC.indexOf('var resumeFailedPending'));
  ok(pns.indexOf('if (oraNativeMode()) return;') > -1 && pns.indexOf('if (oraNativeMode()) return;') < pns.indexOf('oraBridgePlugin()'),
    'B0 statics: the push gate stands at pushNativeState\u2019s head — no engine-web push while native stands');
  ok(/function nativeContractFor\(desc\)/.test(C_SRC) && /queueEnd/.test(C_SRC) && /unplayedOnly\(all\.slice\(li \+ 1\)\)/.test(C_SRC),
    'B0 statics: the contract builder carries queueEnd and the send-time chain tail');
  ok(/p\.addListener\('nativeState'/.test(C_SRC), 'B0 statics: the native state listener registers beside the bridge commands');
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


/* ============ R1: the defect — a resume answered by a paused publish ============
   The field sequence (John, 2026-11-16 14:14): the queue stands
   restored on a reopened page (no contract sent this session —
   nativeContractDescs empty), the mirror stands at the service's
   paused publish, the resume press sends only the transport play,
   and the service's standing paused publish answers inside the
   window (its transport-tail and 5 s tick publishes carry it).
   v469 amendment (i) acks on ANY same-track event: the window
   closes, the no-ack watch is disarmed, no contract is ever
   re-sent — the press is consumed and every later press
   re-enters the same dead path. The fix: a non-playing event
   does not ack; the watch fires and re-sends the contract. */
{
  await ev(() => {
    window.__reset466();
    var descs = window.__dayFixture(['ep1', 'ep2', 'ep3']);
    startQueue(descs.slice());
    window.__emitNative(window.__nativeEvt({ playing: true, positionS: 3 }));
    window.__emitNative(window.__nativeEvt({ playing: false, positionS: 46 }));
    // The reopened page: session-side client state resets — no
    // contract has been sent this session, the mirror starts
    // from the service's standing publish.
    nativeContractDescs = []; window.__contracts = []; window.__commands = [];
    nativeMirror = null; state.pendingStart = null;
    window.__emitNative(window.__nativeEvt({ playing: false, positionS: 46 }));
    resumeCurrent();
    window.__r1 = { cmds: window.__commands.map(function (c) { return c.command; }),
      pendAtPress: state.pendingStart && state.pendingStart.episodeId };
    // The not-landed answer: the standing paused publish again.
    window.__emitNative(window.__nativeEvt({ playing: false, positionS: 46 }));
    window.__r1.pendAfterAnswer = state.pendingStart && state.pendingStart.episodeId;
    nativeMirrorTick(); // the watch stamps the standing start
    if (nativePendingWatch) nativePendingWatch.atMs -= 7000;
    nativeMirrorTick(); // the bound passes
    window.__r1.contracts = window.__contracts.length;
    window.__r1.resent = window.__contracts[0] || null;
    window.__r1.pendAfterWatch = state.pendingStart && state.pendingStart.episodeId;
  });
  await sleep(30);
  const r1 = await ev(() => window.__r1);
  ok(r1.cmds.join(',') === 'play' && r1.pendAtPress === 'ep1',
    'R1: the resume press sends only the play command and the start pends', JSON.stringify(r1).slice(0, 200));
  ok(r1.pendAfterAnswer === 'ep1',
    'R1: a PAUSED publish for the pending track does NOT ack the pending start — the not-landed answer leaves the recovery armed', JSON.stringify(r1).slice(0, 200));
  ok(r1.contracts === 1 && r1.resent && r1.resent.startIndex === 0 && r1.resent.startPositionS === 46 && r1.resent.items.length === 3,
    'R1: past the bound the watch re-sends the standing contract (index 0, the mirror position 0:46, the queue whole) — the recovery the fresh pick proves healthy', JSON.stringify(r1).slice(0, 250));
  ok(r1.pendAfterWatch === 'ep1', 'R1: after the re-send the start still pends on the engine\u2019s playing ack', JSON.stringify(r1).slice(0, 200));

  /* ---- R2: the re-send's answer closes the window ---- */
  await ev(() => {
    window.__emitNative(window.__nativeEvt({ playing: false, positionS: 46 }));
    window.__r2 = { pend: state.pendingStart };
    nativeMirrorTick();
    if (nativePendingWatch) nativePendingWatch.atMs -= 7000;
    nativeMirrorTick();
    window.__r2.contracts = window.__contracts.length;
  });
  await sleep(30);
  const r2 = await ev(() => window.__r2);
  ok(r2.pend === null && r2.contracts === 1,
    'R2: once the watch\u2019s re-send stands fired, a non-playing answer resolves the start — the window closes and no second recovery fires', JSON.stringify(r2));
}

/* ============ R3: a landed start is never reloaded (guard) ============ */
{
  await ev(() => {
    window.__reset466();
    var descs = window.__dayFixture(['ep1', 'ep2', 'ep3']);
    startQueue(descs.slice());
    window.__emitNative(window.__nativeEvt({ playing: true, positionS: 3 }));
    window.__emitNative(window.__nativeEvt({ playing: false, positionS: 46 }));
    resumeCurrent();
    window.__emitNative(window.__nativeEvt({ playing: true, positionS: 47 }));
    window.__r3 = { pend: state.pendingStart };
    nativeMirrorTick();
    if (nativePendingWatch) nativePendingWatch.atMs -= 7000;
    nativeMirrorTick();
    window.__r3.contracts = window.__contracts.length;
  });
  await sleep(30);
  const r3 = await ev(() => window.__r3);
  ok(r3.pend === null && r3.contracts === 1,
    'R3: a PLAYING publish acks the start at once, and the watch never re-sends over a landed start', JSON.stringify(r3));
}

/* ============ R4: a pause inside the window still lands (the won't-stop guard) ============ */
{
  await ev(() => {
    window.__reset466();
    var descs = window.__dayFixture(['ep1', 'ep2', 'ep3']);
    startQueue(descs.slice());
    window.__emitNative(window.__nativeEvt({ playing: true, positionS: 3 }));
    window.__emitNative(window.__nativeEvt({ playing: false, positionS: 46 }));
    resumeCurrent();
    document.getElementById('dock-play').click(); // the toggle inside the window: a cancel
    window.__emitNative(window.__nativeEvt({ playing: false, positionS: 46 }));
    nativeMirrorTick();
    if (nativePendingWatch) nativePendingWatch.atMs -= 7000;
    nativeMirrorTick();
    window.__r4 = { cmds: window.__commands.map(function (c) { return c.command; }),
      pend: state.pendingStart, contracts: window.__contracts.length };
  });
  await sleep(30);
  const r4 = await ev(() => window.__r4);
  ok(r4.cmds.join(',') === 'play,pause' && r4.pend === null && r4.contracts === 1,
    'R4: a pause press inside the window sends the transport pause (never swallowed), and no play reload follows it — the 1.0.40 override stays closed', JSON.stringify(r4));
}

/* ============ R5: the resume gate reads a STALE playing mirror ============ */
{
  await ev(() => {
    window.__reset466();
    var descs = window.__dayFixture(['ep1', 'ep2', 'ep3']);
    startQueue(descs.slice());
    window.__emitNative(window.__nativeEvt({ playing: true, positionS: 3 }));
    nativeMirror.atMs -= 60000; // the playing report goes stale — the service silent since
    window.__commands = [];
    resumeCurrent();
    window.__r5a = { cmds: window.__commands.map(function (c) { return c.command; }),
      pend: state.pendingStart && state.pendingStart.episodeId };
    // The fresh form: a live playing report still gates the resume.
    window.__reset466();
    var descs2 = window.__dayFixture(['ep1', 'ep2', 'ep3']);
    startQueue(descs2.slice());
    window.__emitNative(window.__nativeEvt({ playing: true, positionS: 3 }));
    window.__commands = [];
    resumeCurrent();
    window.__r5b = { cmds: window.__commands.map(function (c) { return c.command; }), pend: state.pendingStart };
  });
  await sleep(30);
  const r5 = await ev(() => ({ a: window.__r5a, b: window.__r5b }));
  ok(r5.a.cmds.join(',') === 'play' && r5.a.pend === 'ep1',
    'R5: a STALE playing report does not consume the resume — the press proceeds and the start pends', JSON.stringify(r5.a));
  ok(r5.b.cmds.length === 0 && r5.b.pend === null,
    'R5: a FRESH playing report still gates the resume — an engine already playing is not re-commanded', JSON.stringify(r5.b));
}

/* ============ R6: the watch clear reads a STALE playing mirror ============ */
{
  await ev(() => {
    window.__reset466();
    var descs = window.__dayFixture(['ep1', 'ep2', 'ep3']);
    startQueue(descs.slice());
    window.__emitNative(window.__nativeEvt({ playing: true, positionS: 3 }));
    window.__emitNative(window.__nativeEvt({ playing: false, positionS: 46 }));
    nativeContractDescs = []; window.__contracts = []; window.__commands = [];
    resumeCurrent();
    // A stale restored publish stands in the mirror (set
    // directly — no event, so no ack can fire on it): the
    // watch must not read it as the start having landed.
    nativeMirror = { playing: true, positionS: 46, durationS: 100, rate: 1, atMs: Date.now() - 60000, trackId: 'ep1', queueIndex: 0 };
    nativeMirrorTick(); // the watch stamps the standing start
    if (nativePendingWatch) nativePendingWatch.atMs -= 7000;
    nativeMirrorTick(); // the bound passes
    window.__r6 = { contracts: window.__contracts.length, pend: state.pendingStart && state.pendingStart.episodeId };
  });
  await sleep(30);
  const r6 = await ev(() => window.__r6);
  ok(r6.contracts === 1 && r6.pend === 'ep1',
    'R6: at the bound, a STALE playing report does not clear the start — the watch re-sends the contract instead', JSON.stringify(r6));
}

await browser.close();
server.close();
console.log('---');
console.log('harness-v473: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) console.log('failures: ' + failures.join(' | '));
process.exit(fail ? 1 : 0);
