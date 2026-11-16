// harness-v466.mjs — v466 §2.8 (Fork B) client evidence.
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

/* ---------------- B1: a start sends the contract ---------------- */
{
  await ev(() => {
    window.__reset466();
    var descs = window.__dayFixture(['ep1', 'ep2', 'ep3']);
    startQueue(descs.slice());
    window.__b1 = { contracts: window.__contracts, playCalls: window.__fake.playCalls, src: window.__fake.src,
      pend: state.pendingStart && state.pendingStart.episodeId, cur: state.current && state.current.episodeId,
      mode: oraNativeMode() };
  });
  await sleep(30);
  const b1 = await ev(() => window.__b1);
  const c = b1.contracts[0] || {};
  ok(b1.mode === true && b1.contracts.length === 1, 'B1: the mode reads on with the contract shell standing, and one start sends exactly one contract', JSON.stringify(b1).slice(0, 200));
  ok(c.form === 'day' && c.day === '2026-11-14' && c.items && c.items.length === 3 && c.queueEnd === 3 && c.startIndex === 0,
    'B1: the contract carries the day form — 3 items, queueEnd 3, startIndex 0', JSON.stringify(c).slice(0, 300));
  ok(c.items && c.items[0].mediaUri.indexOf('/api/player/audio/2026-11-14/ep1') > -1 && c.items[0].needsAuth === true && c.items[0].kind === 'episode',
    'B1: items resolve through the standing snapshot resolution (the session route, needsAuth)', JSON.stringify(c.items && c.items[0]).slice(0, 200));
  ok(b1.playCalls === 0 && b1.src === '', 'B1: the element is never touched — no load, no play', JSON.stringify(b1));
  ok(b1.pend === 'ep1' && b1.cur === 'ep1', 'B1: the v461 bookkeeping stands — current set, the start pends on the one seat', JSON.stringify(b1));
}

/* ---------------- B2: the autoplay window ---------------- */
{
  await ev(() => {
    window.__reset466();
    var descs = window.__dayFixture(['ep1', 'ep2', 'ep3']);
    startQueue([descs[0]], true);
    window.__b2a = window.__contracts[0];
    window.__reset466();
    var descs2 = window.__dayFixture(['ep1', 'ep2', 'ep3']);
    try { localStorage.setItem('opn-autoplay-v358', 'off'); } catch (e) {}
    startQueue([descs2[0]], true);
    window.__b2b = window.__contracts[0];
  });
  await sleep(30);
  const b2 = await ev(() => ({ a: window.__b2a, b: window.__b2b }));
  ok(b2.a && b2.a.items.length === 3 && b2.a.queueEnd === 1 && b2.a.autoplay === true,
    'B2: autoplay ON — the chain tail rides (3 items, queueEnd 1)', JSON.stringify(b2.a).slice(0, 200));
  ok(b2.b && b2.b.items.length === 1 && b2.b.queueEnd === 1 && b2.b.autoplay === false,
    'B2: autoplay OFF — the user queue alone (1 item)', JSON.stringify(b2.b).slice(0, 200));
}

/* ---------------- B3: transport surfaces send commands ---------------- */
{
  await ev(() => {
    window.__reset466();
    var descs = window.__dayFixture(['ep1', 'ep2', 'ep3']);
    startQueue(descs.slice());
    window.__b3 = { cmds: null };
    pauseTransport();                       // the cancel: clears the pending start, sends pause
    window.__b3.afterPause = { pend: state.pendingStart, cmds: window.__commands.slice() };
    resumeCurrent();                        // a play command; the start pends again
    window.__b3.afterResume = { pend: state.pendingStart && state.pendingStart.episodeId, cmds: window.__commands.slice() };
    advanceQueue(1); advanceQueue(-1);      // next · previous
    jumpQueueTo(2);                         // a fresh contract at index 2
    window.__b3.afterJump = { contracts: window.__contracts.length, last: window.__contracts[window.__contracts.length - 1],
      cmds: window.__commands.slice(), playCalls: window.__fake.playCalls };
    setRate(1.5);
    window.__b3.afterRate = window.__commands.slice();
    window.__emitNative(window.__nativeEvt({ playing: true, positionS: 5 }));
    window.__b3.stopBase = window.__commands.length;
    fireTimedStop();
    window.__b3.afterStop = window.__commands.slice();
  });
  await sleep(30);
  const b3 = await ev(() => window.__b3);
  ok(b3.afterPause.pend === null && b3.afterPause.cmds.length === 1 && b3.afterPause.cmds[0].command === 'pause',
    'B3: a pause in the window cancels the pending native start and sends the pause command', JSON.stringify(b3.afterPause));
  ok(b3.afterResume.pend === 'ep1' && b3.afterResume.cmds[1].command === 'play',
    'B3: a resume sends play and the start pends on it', JSON.stringify(b3.afterResume));
  ok(b3.afterJump.cmds[2].command === 'next' && b3.afterJump.cmds[3].command === 'previous',
    'B3: next/previous are commands to the engine', JSON.stringify(b3.afterJump.cmds));
  ok(b3.afterJump.contracts === 2 && b3.afterJump.last.startIndex === 2 && b3.afterJump.playCalls === 0,
    'B3: a jump re-sends the contract at the new index — the element still untouched', JSON.stringify(b3.afterJump).slice(0, 250));
  ok(b3.afterRate[b3.afterRate.length - 1].command === 'setRate' && b3.afterRate[b3.afterRate.length - 1].rate === 1.5,
    'B3: the rate rides a command', JSON.stringify(b3.afterRate));
  ok(b3.afterStop[b3.stopBase].command === 'pause' && b3.afterStop[b3.stopBase + 1].command === 'sleepTrackEnd' && b3.afterStop[b3.stopBase + 1].on === false,
    'B3: the timed stop pauses the engine by command, then the disarm follows', JSON.stringify(b3.afterStop));
}

/* ---------------- B4: nativeState drives the mirror ---------------- */
{
  await ev(() => {
    window.__reset466();
    var descs = window.__dayFixture(['ep1', 'ep2', 'ep3']);
    startQueue(descs.slice());
    window.__b4 = {};
    window.__emitNative(window.__nativeEvt({ playing: true, positionS: 12 }));
    window.__b4.ack = { pend: state.pendingStart, playing: transportPlaying(), pos: Math.floor(playPos().pos), engaged: transportEngaged() };
    window.__emitNative(window.__nativeEvt({ trackId: 'ep2', queueIndex: 1, playing: true, positionS: 0 }));
    window.__b4.adv = { cur: state.current && state.current.episodeId, idx: state.queueIdx };
    window.__emitNative(window.__nativeEvt({ stopped: true, playing: false, trackId: '', queueIndex: 0, queueCount: 0, queueIds: [] }));
    window.__b4.stop = { cur: state.current, q: state.queue.length, mirror: nativeMirror };
  });
  await sleep(30);
  const b4 = await ev(() => window.__b4);
  ok(b4.ack.pend === null && b4.ack.playing === true && b4.ack.pos >= 12 && b4.ack.engaged === true,
    'B4: the playing event acks the pending start, the mirror reads playing, the position extrapolates', JSON.stringify(b4.ack));
  ok(b4.adv.cur === 'ep2' && b4.adv.idx === 1, 'B4: an advance event moves the current and the queue index', JSON.stringify(b4.adv));
  ok(b4.stop.cur === null && b4.stop.q === 0 && b4.stop.mirror === null,
    'B4: the stopped event runs the terminal clear', JSON.stringify(b4.stop));
}

/* ---------------- B5: no web pushes while native stands ---------------- */
{
  await ev(() => {
    window.__reset466();
    var descs = window.__dayFixture(['ep1', 'ep2']);
    startQueue(descs.slice());
    pauseTransport(); resumeCurrent(); pushNativeState(false); noteResumeFailed();
    window.__b5 = { pushes: window.__pushes.length };
  });
  await sleep(30);
  const b5 = await ev(() => window.__b5);
  ok(b5.pushes === 0, 'B5: no engine-web push leaves the page while the native engine stands', JSON.stringify(b5));
}

/* ---------------- B6: the completions drain ---------------- */
{
  await ev(() => {
    window.__reset466();
    var descs = window.__dayFixture(['ep1', 'ep2']);
    window.__completions = [{ episodeId: 'ep1', date: '2026-11-14', block: 'Morning' }];
    startQueue(descs.slice());
    // The drain's seam is the advance: the service marks ep1
    // as the engine leaves it, and the ep2 event (a track
    // change) drains the store.
    window.__emitNative(window.__nativeEvt({ trackId: 'ep2', queueIndex: 1, playing: true, positionS: 0 }));
  });
  await sleep(60);
  const b6 = await ev(() => ({ played: isPlayed('ep1', '2026-11-14', 'Morning') }));
  ok(b6.played === true, 'B6: a native day completion lands in the played map through the drain', JSON.stringify(b6));
}

/* ---------------- B7: an old shell — the page engine stands ---------------- */
{
  await ev(() => {
    window.__reset466();
    delete window.Capacitor;
    window.__b7 = { mode: oraNativeMode() };
    var descs = window.__dayFixture(['ep1', 'ep2']);
    startQueue(descs.slice());
    window.__b7.playCalls = window.__fake.playCalls;
    window.__b7.src = window.__fake.src;
  });
  await sleep(30);
  const b7 = await ev(() => window.__b7);
  ok(b7.mode === false && b7.playCalls === 1 && b7.src !== '',
    'B7: no contract method on the plugin — the mode reads off and the element starts as before', JSON.stringify(b7));
}

/* ---------------- B8: the arbitration stop (D-466-R1) ---------------- */
{
  await ev(() => {
    // B7 deleted window.Capacitor (its old-shell premise), so
    // this leg first re-installs the mock shell in the setup
    // block's own shape and re-registers the listeners on a
    // fresh registry.
    window.__listeners = {};
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
    setupBridgeCommands();
    setupNativeState();
    window.__reset466();
    var descs = window.__dayFixture(['ep1', 'ep2', 'ep3']);
    startQueue(descs.slice());
    // The shell's side of the defect sequence: a WEB face
    // stands in the service (a stale client's pushes on the
    // upgrade path, or the cold-restored WEB record), and the
    // contract this start just sent makes loadNativeContract
    // arbitrate engines — its act is a bridge 'stop' emitted
    // against the WEB face, delivered to this page's
    // transportCommand listener, the door every bridge
    // command lands on.
    window.__b8 = { snapBefore: localStorage.getItem('opn-queue-v355') };
    var hs = window.__listeners.transportCommand || [];
    hs.forEach(function (f) { f({ command: 'stop' }); });
    window.__b8.after = {
      q: state.queue.map(function (d) { return d.episodeId; }),
      idx: state.queueIdx,
      cur: state.current && state.current.episodeId,
      pend: state.pendingStart && state.pendingStart.episodeId,
      snap: localStorage.getItem('opn-queue-v355'),
    };
    // The engine's own word still governs the start: its
    // playing event acks the pending start on the standing
    // seat, over the queue the stop would have wiped.
    window.__emitNative(window.__nativeEvt({ playing: true, positionS: 3 }));
    window.__b8.ack = { pend: state.pendingStart, cur: state.current && state.current.episodeId, q: state.queue.length };
  });
  await sleep(30);
  const b8 = await ev(() => window.__b8);
  const snapIds = b8.after.snap ? JSON.parse(b8.after.snap).ids : null;
  ok(b8.after.q.length === 3 && b8.after.idx === 0 && b8.after.cur === 'ep1' && b8.after.pend === 'ep1',
    'B8: a contract load with a WEB face standing — the arbitration stop leaves the queue, the index, the current, and the pending start intact', JSON.stringify(b8.after).slice(0, 250));
  ok(!!b8.snapBefore && b8.after.snap === b8.snapBefore && JSON.stringify(snapIds) === JSON.stringify(['ep1', 'ep2', 'ep3']),
    'B8: the saved queue snapshot stands byte-for-byte after the arbitration stop', JSON.stringify({ before: !!b8.snapBefore, ids: snapIds }));
  ok(b8.ack.pend === null && b8.ack.cur === 'ep1' && b8.ack.q === 3,
    'B8: the engine state event still acks the start over the standing queue', JSON.stringify(b8.ack));
}

/* ---------------- B9: the no-ack recovery + the row paint (v468) ---------------- */
{
  await ev(() => {
    window.__reset466();
    var descs = window.__dayFixture(['ep1', 'ep2', 'ep3']);
    document.getElementById('rows').innerHTML = '<button class="playbtn" data-playkey="ep1" aria-label="Play"></button>';
    startQueue(descs.slice());
    // The engine acks the start, then the queue stands PAUSED
    // at 0:46 — the field shape exactly.
    window.__emitNative(window.__nativeEvt({ playing: true, positionS: 3 }));
    var glyphPlaying = document.querySelector('[data-playkey="ep1"]').innerHTML;
    window.__emitNative(window.__nativeEvt({ playing: false, positionS: 46 }));
    var glyphPaused = document.querySelector('[data-playkey="ep1"]').innerHTML;
    // The resume press: a pending start stands, the transport
    // command goes out — and NO ack ever comes (the dead
    // service / wedged player of the field failure).
    resumeCurrent();
    window.__b9 = {
      glyphPlaying: glyphPlaying, glyphPaused: glyphPaused,
      contractsAtResume: window.__contracts.length,
      commands: window.__commands.map(function (c) { return c.command; }),
      pend: state.pendingStart && state.pendingStart.episodeId,
    };
    nativeMirrorTick(); // the watch stamps this start
    window.__b9.contractsAfterFirstTick = window.__contracts.length;
    nativePendingWatch.atMs -= 7000; // the bound passes with no ack
    nativeMirrorTick(); // the recovery fires
    window.__b9.contractsAfterBound = window.__contracts.length;
    window.__b9.resent = window.__contracts[1] || null;
    nativeMirrorTick(); // and does not fire twice for one start
    window.__b9.contractsAfterThirdTick = window.__contracts.length;
    window.__b9.pendAfter = state.pendingStart && state.pendingStart.episodeId;
  });
  await sleep(30);
  const b9 = await ev(() => window.__b9);
  ok(b9.glyphPlaying.charCodeAt(0) === 10073 && b9.glyphPaused.charCodeAt(0) === 9654,
    'B9: the row disc follows the mirror — ❚❚ while playing, ▶ after the pause lands with the current unchanged (the recording disagreement, closed)', JSON.stringify(b9).slice(0, 200));
  ok(b9.contractsAtResume === 1 && b9.commands.join(',') === 'play' && b9.pend === 'ep1',
    'B9: the resume sends only the play command and the pending start stands — the field shape before the failure', JSON.stringify(b9).slice(0, 200));
  ok(b9.contractsAfterFirstTick === 1 && b9.contractsAfterBound === 2,
    'B9: an unacked native pending start re-sends the standing contract once past the bound — the resurrection start', JSON.stringify(b9).slice(0, 200));
  ok(b9.resent && b9.resent.startIndex === 0 && b9.resent.startPositionS === 46 && b9.resent.items.length === 3,
    'B9: the re-sent contract stands at the standing index and the mirror position (0:46), the queue whole', JSON.stringify(b9.resent).slice(0, 250));
  ok(b9.contractsAfterThirdTick === 2 && b9.pendAfter === 'ep1',
    'B9: the recovery fires once per pending start, and the start still pends on the engine ack', JSON.stringify(b9).slice(0, 200));
}

await browser.close();
server.close();
console.log('---');
console.log('harness-v466: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) console.log('failures: ' + failures.join(' | '));
process.exit(fail ? 1 : 0);
