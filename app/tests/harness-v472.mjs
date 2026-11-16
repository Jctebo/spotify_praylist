// harness-v472.mjs — v472 client evidence (Steps 1·2·3·5).
//   C0  statics: the oneEngine capability read; the resolve
//       branch at startDesc's tail; the refusal surface
//   C1  Step 1 (H1a): a restored podcast queue whose series
//       was never opened — the start loads the series
//       payload through the standing route and the contract
//       sends; the element is never touched
//   C2  Step 2 (H1b): a null-resolving day external at tap —
//       the start awaits the slot's standing resolution and
//       the contract sends when the URL lands
//   C3  Step 5: the named refusal in the new pair — a
//       'missing' slot refuses by name (state.nativeRefusal,
//       the card's passline), the pending start clears, the
//       element is never touched
//   C4  Step 5: the same start in an OLD pair (no oneEngine
//       on the plugin) runs the legacy element tail
//       byte-for-byte — no refusal stands
//   C5  the oneEngine read: on with the method standing,
//       off without it, off with no shell at all
//   C6  Step 3: the podcast download acts re-point to the
//       native store in the new pair — download records the
//       manual registry from the plugin's answer, the state
//       refresh reads the native store, a second tap removes
//       (file + registry in one act)
//   C7  Step 5: the render mirror's freshness — a mirror
//       gone two ticks without an event reads neutral
//       (not playing), its position frozen at the last event
// Mold: harness-v466 (client extraction + Chromium + the
// fake audio + the mock OraDayBridge), extended: the mock
// carries the oneEngine advertisement and the native
// podcast store, and the fetch stub serves a series payload.
// Run: node app/tests/harness-v472.mjs   (from the worktree root)
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
  ok(/function oraOneEngineMode\(\) \{[\s\S]{0,600}?var p = oraBridgePlugin\(\);\n  return !!\(p && p\.oneEngine\);\n\}/.test(C_SRC),
    'C0 statics: the oneEngine mode is a capability read on the plugin, in oraNativeMode\'s shape');
  const sd = C_SRC.slice(C_SRC.indexOf('function startDesc'), C_SRC.indexOf('function playTrack'));
  ok(sd.indexOf('if (oraNativeMode()) { nativeResolveStart(desc); return; }') > sd.indexOf('if (oraNativeMode() && nativeSendContract(desc)) return;')
    && sd.indexOf('if (oraNativeMode()) { nativeResolveStart(desc); return; }') < sd.indexOf('elementStartTail(desc);'),
    'C0 statics: the resolve branch stands at the funnel tail — after the contract send, ahead of the element tail');
  ok(/function elementStartTail\(desc\) \{/.test(C_SRC) && /function nativeResolveStart\(desc\) \{/.test(C_SRC)
    && /function refuseNativeStart\(desc, reason\) \{/.test(C_SRC),
    'C0 statics: the extracted legacy tail, the resolver, and the refusal surface all stand');
  ok(C_SRC.indexOf("state.nativeRefusal = { episodeId: desc.episodeId, reason: reason, atMs: Date.now() };") > -1,
    'C0 statics: the refusal stands readable in state (episodeId · reason · atMs)');
  ok(/p\.downloadPodcast && p\.getPodcastDownloads/.test(C_SRC) === false && /function podNativeCall\(name, args\) \{/.test(C_SRC),
    'C0 statics: the native podcast store is reached through the one guarded call (podNativeCall)');
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
  rate: 1, errWaitKey: null, errWaitN: 0, startRetryKey: null, lastStartAt: 0,
  extSlots: {}, extStanding: [], nativeRefusal: null };
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
    state.extSlots = {}; state.extStanding = []; state.nativeRefusal = null;
    if (window.__cachesStubbed) { delete window.caches; window.__cachesStubbed = false; window.__cacheReads = []; }
    document.getElementById('cards').innerHTML = '<div data-card="ep1"></div><div data-card="ep2"></div>';
    document.getElementById('rows').innerHTML = '';
    window.__fake = window.__mkFakeAudio(); window.audioEl = window.__fake;
    window.__fetchLog.length = 0;
  };
});
const ev = (fn) => page.evaluate(fn);


/* ---------------- the mock shell (the new pair) ---------------- */
await ev(() => {
  window.__contracts = [];
  window.__commands = [];
  window.__pushes = [];
  window.__listeners = {};
  window.__completions = [];
  window.__podCalls = [];
  window.__podStanding = {}; // series + '/' + episodeId -> true
  window.__seriesPayload = { series: 'Series A', entries: [{ key: 'pe1', url: 'https://feed/pe1.mp3', title: 'Ep 1', durationS: 60 }] };
  var baseFetch = window.fetch;
  window.fetch = function (path, opts) {
    if (String(path).indexOf('/api/player/podcasts?series=') === 0) {
      window.__fetchLog.push({ path: String(path), method: 'GET', body: null });
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(window.__seriesPayload); } });
    }
    return baseFetch(path, opts);
  };
  window.__installBridge = function (oneEngine) {
    var bridge = {
      setNativeQueue: function (call) { window.__contracts.push(JSON.parse(call.queue)); return Promise.resolve(); },
      nativeTransport: function (call) { window.__commands.push(JSON.parse(call.command)); return Promise.resolve(); },
      setPlaybackState: function (call) { window.__pushes.push(JSON.parse(call.state)); return Promise.resolve(); },
      setDaySnapshot: function () { return Promise.resolve(); },
      armSleepDeadline: function () { return Promise.resolve(); },
      clearSleepDeadline: function () { return Promise.resolve(); },
      takeNativeCompletions: function () { var r = window.__completions; window.__completions = []; return Promise.resolve({ records: r }); },
      downloadPodcast: function (call) { window.__podCalls.push({ m: 'downloadPodcast', series: call.series, episodeId: call.episodeId, url: call.url });
        window.__podStanding[call.series + '/' + call.episodeId] = true; return Promise.resolve({ standing: true, sizeBytes: 4321 }); },
      deletePodcastDownload: function (call) { window.__podCalls.push({ m: 'deletePodcastDownload', series: call.series, episodeId: call.episodeId });
        delete window.__podStanding[call.series + '/' + call.episodeId]; return Promise.resolve({ standing: false }); },
      getPodcastDownloads: function (call) { window.__podCalls.push({ m: 'getPodcastDownloads', series: call.series });
        var st = (call.keys || []).filter(function (k) { return window.__podStanding[call.series + '/' + k]; });
        return Promise.resolve({ standing: st }); },
      addListener: function (name, fn) { (window.__listeners[name] = window.__listeners[name] || []).push(fn); },
    };
    if (oneEngine) bridge.oneEngine = function () { return Promise.resolve({ oneEngine: true }); };
    window.Capacitor = { Plugins: { OraDayBridge: bridge } };
  };
  window.__installBridge(true);
  window.__emitNative = function (obj) {
    var hs = window.__listeners.nativeState || [];
    hs.forEach(function (f) { f({ state: JSON.stringify(obj) }); });
  };
  window.__nativeEvt = function (over) {
    return Object.assign({ engine: 'native', trackId: 'ep1', kind: 'episode', title: 'Track ep1', subtitle: '',
      block: 'Morning', dateLabel: state.dateLabel, playing: true, stopped: false, positionS: 0, durationS: 100,
      estimated: false, queueIndex: 0, queueCount: 3, queueIds: ['ep1', 'ep2', 'ep3'], rate: 1, ts: Date.now() }, over || {});
  };
  window.__reset472 = function () {
    window.__reset();
    window.__contracts = []; window.__commands = []; window.__pushes = []; window.__completions = []; window.__podCalls = [];
    nativeMirror = null; nativeContractDescs = []; nativePendingWatch = null;
    try { localStorage.removeItem('opn-autoplay-v358'); localStorage.removeItem('opn-pod-manual-v1'); } catch (e) {}
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

/* ---------------- C5: the oneEngine read ---------------- */
{
  await ev(() => {
    window.__c5 = { full: oraOneEngineMode() };
    window.__installBridge(false);
    window.__c5.noMethod = oraOneEngineMode();
    window.__c5.nativeStill = oraNativeMode();
    delete window.Capacitor;
    window.__c5.noShell = oraOneEngineMode();
    window.__installBridge(true);
    window.__c5.restored = oraOneEngineMode();
  });
  const c5 = await ev(() => window.__c5);
  ok(c5.full === true && c5.noMethod === false && c5.nativeStill === true && c5.noShell === false && c5.restored === true,
    'C5: the oneEngine read — on with the method, off without it (the native read still on), off with no shell', JSON.stringify(c5));
}

/* ---------------- C1: Step 1 — the cold podcast resume ---------------- */
{
  await ev(() => {
    window.__reset472();
    state.podcasts = null;
    var desc = { episodeId: 'pe1', kind: 'podcast', title: 'Ep 1', block: '', url: '', available: true, durationS: 60, podSeries: 'Series A', seriesKey: 'sa' };
    startQueue([desc]);
    window.__c1 = { contractsAtTap: window.__contracts.length, pend: state.pendingStart && state.pendingStart.episodeId };
  });
  await sleep(250);
  const c1 = await ev(() => ({ atTap: window.__c1, contracts: window.__contracts, fetch: window.__fetchLog.map(function (f) { return f.path; }),
    playCalls: window.__fake.playCalls, src: window.__fake.src, refusal: state.nativeRefusal }));
  const cc = c1.contracts[0] || {};
  ok(c1.atTap.contractsAtTap === 0 && c1.atTap.pend === 'pe1',
    'C1: at the tap no contract can send (the series was never opened) and the start pends', JSON.stringify(c1.atTap));
  ok(c1.fetch.some(function (p) { return p.indexOf('/api/player/podcasts?series=Series%20A') === 0; }),
    'C1: the start loads the series payload through the standing route', JSON.stringify(c1.fetch));
  ok(c1.contracts.length === 1 && cc.form === 'podcast' && cc.items && cc.items[0].mediaUri === 'https://feed/pe1.mp3',
    'C1: after the payload lands the contract sends — the start item resolved from the series entries', JSON.stringify(cc).slice(0, 250));
  ok(c1.playCalls === 0 && c1.src === '' && c1.refusal === null,
    'C1: the element is never touched and no refusal stands', JSON.stringify({ p: c1.playCalls, s: c1.src, r: c1.refusal }));
}

/* ---------------- C2: Step 2 — the null-at-tap day external ---------------- */
{
  await ev(() => {
    window.__reset472();
    var d = window.__desc('ext1', { kind: 'external', url: 'https://x/ext1.mp3' });
    state.dayDescs = [d];
    state.dayPayload = { presentedDay: '2026-11-14', dayPositions: {}, blocks: [] };
    state.extSlots = { ext1: { state: 'loading' } };
    startQueue([d]);
    window.__c2 = { contractsAtTap: window.__contracts.length };
    setTimeout(function () { state.extSlots.ext1 = { state: 'downloading', enclosureUrl: 'https://feed/ext1.mp3' }; }, 120);
  });
  await sleep(900);
  const c2 = await ev(() => ({ atTap: window.__c2, contracts: window.__contracts, playCalls: window.__fake.playCalls, refusal: state.nativeRefusal }));
  const cc2 = c2.contracts[0] || {};
  ok(c2.atTap.contractsAtTap === 0, 'C2: at the tap the external resolves null — no contract sends', JSON.stringify(c2.atTap));
  ok(c2.contracts.length === 1 && cc2.items && cc2.items[0].mediaUri === 'https://feed/ext1.mp3' && cc2.items[0].kind === 'external',
    'C2: when the slot settles with its enclosure URL the start re-resolves and the contract sends', JSON.stringify(cc2).slice(0, 250));
  ok(c2.playCalls === 0 && c2.refusal === null, 'C2: the element is never touched and no refusal stands', JSON.stringify({ p: c2.playCalls, r: c2.refusal }));
}

/* ---------------- C3: Step 5 — the named refusal (new pair) ---------------- */
{
  await ev(() => {
    window.__reset472();
    document.getElementById('cards').innerHTML = '<div data-card="ext1"></div>';
    var d = window.__desc('ext1', { kind: 'external', url: 'https://x/ext1.mp3' });
    state.dayDescs = [d];
    state.dayPayload = { presentedDay: '2026-11-14', dayPositions: {}, blocks: [] };
    state.extSlots = { ext1: { state: 'missing' } };
    startQueue([d]);
  });
  await sleep(200);
  const c3 = await ev(() => ({ refusal: state.nativeRefusal, pend: state.pendingStart, contracts: window.__contracts.length,
    playCalls: window.__fake.playCalls, src: window.__fake.src,
    line: (document.querySelector('[data-card="ext1"] .passline') || {}).textContent || '' }));
  ok(c3.refusal && c3.refusal.episodeId === 'ext1' && c3.refusal.reason === 'unresolved-slot' && c3.pend === null,
    'C3: a standing null refuses by name — the refusal stands in state, the pending start clears', JSON.stringify(c3.refusal));
  ok(c3.line.indexOf('Couldn\u2019t play \u2014 unresolved-slot') === 0,
    'C3: the refusal paints on the entry\'s own card (.passline)', JSON.stringify(c3.line));
  ok(c3.contracts === 0 && c3.playCalls === 0 && c3.src === '',
    'C3: no contract, no element load — the start is refused, never silently dual-engined', JSON.stringify(c3));
}

/* ---------------- C4: Step 5 — the legacy tail (old pair) ---------------- */
{
  await ev(() => {
    window.__installBridge(false); // an old shell: native stands, oneEngine does not
    window.__reset472();
    var d = window.__desc('ext1', { kind: 'external', url: 'https://x/ext1.mp3' });
    state.dayDescs = [d];
    state.dayPayload = { presentedDay: '2026-11-14', dayPositions: {}, blocks: [] };
    state.extSlots = { ext1: { state: 'missing' } };
    startQueue([d]);
  });
  await sleep(250);
  const c4 = await ev(() => ({ refusal: state.nativeRefusal, playCalls: window.__fake.playCalls, src: window.__fake.src, loadCalls: window.__fake.loadCalls }));
  ok(c4.refusal === null && (c4.src !== '' || c4.playCalls > 0 || c4.loadCalls > 0),
    'C4: the same start in an old pair runs the legacy element tail — no refusal stands, the element loads', JSON.stringify(c4));
  await ev(() => { window.__installBridge(true); });
}

/* ---------------- C6: Step 3 — the native podcast store ---------------- */
{
  await ev(() => {
    window.__reset472();
    state.podcasts = { series: 'Series A', entries: [{ key: 'pe1', url: 'https://feed/pe1.mp3', title: 'Ep 1', durationS: 60 }] };
    document.getElementById('view').innerHTML = '<span data-poddlstate="pe1" style="display:none"></span>';
    podDlTap('pe1');
  });
  await sleep(200);
  const c6a = await ev(() => ({ calls: window.__podCalls, registry: JSON.parse(localStorage.getItem('opn-pod-manual-v1') || '{}'),
    map: podDlStateMap.pe1, icon: (document.querySelector('[data-poddlstate="pe1"]') || { style: {} }).style.display }));
  ok(c6a.calls.some(function (c) { return c.m === 'downloadPodcast' && c.series === 'Series A' && c.episodeId === 'pe1' && c.url === 'https://feed/pe1.mp3'; }),
    'C6: the download tap fetches through the plugin store with the entry\'s stream URL', JSON.stringify(c6a.calls));
  ok(c6a.registry['pod/Series A/pe1'] && c6a.registry['pod/Series A/pe1'].sizeBytes === 4321,
    'C6: the manual registry records the entry from the plugin\'s standing answer', JSON.stringify(c6a.registry));
  ok(c6a.map && c6a.map.standing === true && c6a.map.manual === true && c6a.icon === '',
    'C6: the state refresh reads the native store — the map stands and the icon paints', JSON.stringify({ map: c6a.map, icon: c6a.icon }));
  await ev(() => { podDlTap('pe1'); });
  await sleep(200);
  const c6b = await ev(() => ({ calls: window.__podCalls, registry: JSON.parse(localStorage.getItem('opn-pod-manual-v1') || '{}'), map: podDlStateMap.pe1 }));
  ok(c6b.calls.some(function (c) { return c.m === 'deletePodcastDownload' && c.episodeId === 'pe1'; }) && !c6b.registry['pod/Series A/pe1']
    && c6b.map && c6b.map.standing === false,
    'C6: a second tap on a standing manual download removes it — plugin delete + registry in one act', JSON.stringify(c6b).slice(0, 250));
}

/* ---------------- C7: Step 5 — the mirror's neutral state ---------------- */
{
  await ev(() => {
    window.__reset472();
    var descs = window.__dayFixture(['ep1', 'ep2', 'ep3']);
    startQueue(descs.slice());
    window.__emitNative(window.__nativeEvt({ playing: true, positionS: 30 }));
    window.__c7 = { playingBefore: transportPlaying() };
    nativeMirror.atMs = Date.now() - 11000; // two ticks pass with no event
    nativeMirrorTick();
    window.__c7.after = { playing: transportPlaying(), stale: nativeMirror.staleNeutral === true, posFrozen: Math.floor(playPos().pos) };
  });
  await sleep(30);
  const c7 = await ev(() => window.__c7);
  ok(c7.playingBefore === true && c7.after.playing === false && c7.after.stale === true,
    'C7: a mirror gone two ticks without an event drops its playing assertion (neutral), in the new pair', JSON.stringify(c7));
  ok(c7.after.posFrozen >= 30 && c7.after.posFrozen < 35,
    'C7: the neutral mirror\'s position freezes at the last event (no extrapolation into silence)', JSON.stringify(c7.after));
}

await browser.close();
server.close();
console.log('---');
console.log('harness-v472: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) console.log('failures: ' + failures.join(' | '));
process.exit(fail ? 1 : 0);
