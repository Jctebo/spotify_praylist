// harness-v475.mjs \u2014 v475 cold-unpause fix-forward evidence (mold: harness-v473).
//   S1\u2013S3  statics: trackDesc carries enclosureUrl \u00b7 oraSnapshotTrack
//       prefers the descriptor\u2019s own address \u00b7 tomorrow\u2019s offline
//       own arm rides the enclosure
//   P1  a fresh tap on the Marian Antiphon (the real descriptor
//       chain: own feed meta \u2192 ownSlotTrack \u2192 trackDesc) sends a
//       contract whose item carries the feed enclosure URL \u2014
//       never the retired /api/player/audio/ route, which 404s
//       for every own episode (player_episodes has carried only
//       the-ai-signal since 2026-11-12; \u00a71 branch 7)
//   P2  the field sequence (John, 2026-11-16 15:30\u201315:34): the
//       restored Morning queue stands at the antiphon; the
//       persisted contract (written by the shipped builder \u2014
//       its antiphon item holds the dead route) cold-reads onto
//       the engine; unpause \u2192 the load errors, the paused
//       publish repaints (~2 s of glyph), the no-ack watch
//       re-sends. Shipped: the re-send holds the same dead
//       address and the start never lands. Fixed: the re-send
//       carries the enclosure and the start lands.
//   P3  guards: the AI Signal keeps its Range-route address \u00b7
//       an external direct item keeps its enclosure form \u00b7 a
//       blob-url own descriptor falls back to its enclosureUrl
//       \u00b7 an own descriptor with no address keeps the
//       Range-route fallback
// The serving model the legs apply (\u00a71, proven from the route
// handler + the table\u2019s contents): /api/player/audio/<date>/<id>
// serves ONLY the-ai-signal on current days; every other address
// (the public enclosure host) serves.
// Run: node app/tests/harness-v475.mjs   (from the worktree root)
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
  const td = C_SRC.slice(C_SRC.indexOf('function trackDesc'), C_SRC.indexOf('function buildIntroMap'));
  ok(/enclosureUrl: t\.enclosureUrl \|\| null/.test(td),
    'S1 statics: trackDesc carries enclosureUrl additively \u2014 the one seam both queue builds flow through (v475 \u00a72 seat 1)');
  const ost = C_SRC.slice(C_SRC.indexOf('function oraSnapshotTrack'), C_SRC.indexOf('function oraDaySnapshot'));
  ok(ost.indexOf('d.enclosureUrl') > ost.indexOf('Own episode') && ost.indexOf('d.enclosureUrl') < ost.indexOf('/api/player/audio/'),
    'S2 statics: oraSnapshotTrack\u2019s own-episode branch reads the descriptor\u2019s own address ahead of the Range-route synthesis (v475 \u00a72 seat 2)');
  ok(ost.indexOf('/api/player/audio/') > -1,
    'S2 statics: the Range-route synthesis still stands in the branch \u2014 the no-address fallback and the AI Signal\u2019s form');
  const tom = C_SRC.slice(C_SRC.indexOf('offlineTomorrowOwn'), C_SRC.indexOf('function offlinePodcastAutoSet'));
  ok(/it\.kind === 'own'\) return \{[^}]*it\.enclosureUrl/.test(tom),
    'S3 statics: tomorrow\u2019s offline snapshot own arm rides the item\u2019s enclosureUrl, not the retired route (v475 \u00a72 seat 3)');
}

/* __STATICS_SPLIT__ */
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
    oneEngine: function () { return Promise.resolve({ oneEngine: true }); },
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


/* ---------------- v475 page-side fixtures ---------------- */
await ev(() => {
  // The real descriptor chain for an own episode: the own
  // feed's meta (ownResolveFeed's shape) -> ownSlotTrack ->
  // trackDesc (the seam both queue builds flow through). The
  // antiphon's facts are the field facts (§1): the feed item
  // for 2026-11-16, its enclosure on the public media host,
  // length 1709229, NO itunes:duration anywhere in the feed
  // (durationS 0).
  window.__ENC_ANTH = 'https://audio.orapronobis.media/marian-antiphon-angelus-2026-11-16.mp3';
  window.__ownDesc475 = function () {
    var meta = { episodeId: 'marian-antiphon-angelus', title: 'Marian Antiphon - Angelus', state: 'present',
      enclosureUrl: window.__ENC_ANTH, streamUrl: null, durationS: 0, sizeBytes: 1709229 };
    var row = { sourceKey: 'marian-antiphon', block: 'Morning', episodeId: 'marian-antiphon-angelus', title: 'Marian Antiphon' };
    return trackDesc(ownSlotTrack(row, meta, '2026-11-16'), null);
  };
  // The external that stands ahead of the antiphon in the
  // Morning queue (Divine Office Morning Prayer — a direct
  // class external; its enclosure form is the standing one).
  window.__EXT_ID = 'ext-morning-prayer';
  window.__EXT_URL = 'https://feeds.example/divine-office-morning-prayer.mp3';
  window.__extDesc475 = function () {
    state.extSlots = {}; state.extStanding = [];
    state.extSlots[window.__EXT_ID] = { state: 'present', enclosureUrl: window.__EXT_URL, streamUrl: null };
    state.extStanding = [{ slotId: window.__EXT_ID, download: 'direct-first', block: 'Morning' }];
    return { episodeId: window.__EXT_ID, kind: 'external', title: 'Divine Office Morning Prayer', block: 'Morning',
      url: window.__EXT_URL, available: true, durationS: 939 };
  };
  window.__standDay475 = function () {
    var ext = window.__extDesc475();
    var anth = window.__ownDesc475();
    state.dayDescs = [ext, anth];
    state.dayPayload = { presentedDay: '2026-11-16', dayPositions: {}, blocks: [] };
    state.presentedDay = '2026-11-16'; state.storedDay = '2026-11-16';
    state.dateLabel = 'Monday, November 16';
    return [ext, anth];
  };
  // The serving model (§1 branch 7, proven): the Range route
  // serves only the-ai-signal on current days; any other
  // address serves.
  window.__serves = function (uri) {
    var m = /\/api\/player\/audio\/\d{4}-\d{2}-\d{2}\/([^/?]+)/.exec(String(uri || ''));
    if (m) return decodeURIComponent(m[1]) === 'the-ai-signal';
    return true;
  };
  window.__evt475 = function (over) {
    return Object.assign({ engine: 'native', trackId: 'marian-antiphon-angelus', kind: 'episode',
      title: 'Marian Antiphon - Angelus', subtitle: '', block: 'Morning', dateLabel: state.dateLabel,
      playing: false, stopped: false, positionS: 0, durationS: 124, estimated: false,
      queueIndex: 1, queueCount: 2, queueIds: [window.__EXT_ID, 'marian-antiphon-angelus'], rate: 1, ts: Date.now() }, over || {});
  };
});

/* ============ P1: a fresh tap's contract carries the enclosure ============ */
{
  await ev(() => {
    window.__reset466();
    var descs = window.__standDay475();
    startQueue(descs.slice());
    window.__p1 = { contract: window.__contracts[0] || null };
    // The single-play form (the row tap's own start):
    window.__contracts = [];
    playTrack(descs[1]);
    window.__p1.single = window.__contracts[0] || null;
  });
  await sleep(30);
  const p1 = await ev(() => window.__p1);
  const anth = p1.contract && p1.contract.items.filter(function (i) { return i.id === 'marian-antiphon-angelus'; })[0];
  ok(!!anth && anth.mediaUri === 'https://audio.orapronobis.media/marian-antiphon-angelus-2026-11-16.mp3' && anth.needsAuth === false,
    'P1: the fresh queue contract\u2019s antiphon item carries the feed enclosure URL, needsAuth false \u2014 the address the page engine plays', JSON.stringify(anth));
  ok(!!p1.contract && p1.contract.items.every(function (i) { return String(i.mediaUri).indexOf('/api/player/audio/') === -1; }),
    'P1: no item in the day contract carries the retired Range route', JSON.stringify(p1.contract && p1.contract.items.map(function (i) { return i.mediaUri; })));
  const santh = p1.single && p1.single.items[p1.single.startIndex];
  ok(!!santh && santh.mediaUri === 'https://audio.orapronobis.media/marian-antiphon-angelus-2026-11-16.mp3',
    'P1: the single-play (row tap) contract\u2019s start item carries the enclosure URL', JSON.stringify(santh));
}

/* ============ P2: the field sequence \u2014 the persisted contract holds the dead address ============
   The double's engine stands as the field service stands: the
   persisted contract (written by the shipped builder in the
   earlier session) cold-read onto it, paused at the antiphon.
   Its antiphon item holds the Range route \u2014 the serving model
   answers it 404, as the route + table prove. The press sends
   the transport play; the load errors; the paused publish
   repaints; the watch re-sends through the page's builder.
   Shipped: the re-send holds the same dead address \u2014 the
   start never lands (the field symptom). Fixed: the re-send
   carries the enclosure \u2014 the start lands and acks. */
{
  await ev(() => {
    window.__reset466();
    var descs = window.__standDay475();
    // The restored queue standing AT the antiphon (the field
    // shape): queue whole, current = the last item, no
    // contract sent this session.
    state.queue = descs.slice(); state.queueIdx = 1; state.current = descs[1];
    nativeContractDescs = []; nativeMirror = null; state.pendingStart = null;
    window.__contracts = []; window.__commands = [];
    // The double's standing (persisted) items \u2014 the field
    // fact: the shipped builder wrote the Range route for the
    // antiphon; the external ahead of it carries its enclosure.
    window.__persisted = [
      { id: window.__EXT_ID, mediaUri: window.__EXT_URL },
      { id: 'marian-antiphon-angelus', mediaUri: location.origin + '/api/player/audio/2026-11-16/marian-antiphon-angelus' },
    ];
    // The service's standing paused publish (the cold read's).
    window.__emitNative(window.__evt475({ playing: false, positionS: 0 }));
    resumeCurrent();
    window.__p2 = { cmds: window.__commands.map(function (c) { return c.command; }),
      pendAtPress: state.pendingStart && state.pendingStart.episodeId };
    // The double answers the play: its standing item's address
    // does not serve \u2014 the load errors and the paused publish
    // repaints (the ~2 s of glyph in the field).
    window.__p2.standingServed = window.__serves(window.__persisted[1].mediaUri);
    window.__emitNative(window.__evt475({ playing: false, positionS: 0 }));
    window.__p2.pendAfterError = state.pendingStart && state.pendingStart.episodeId;
    nativeMirrorTick(); // the watch stamps the standing start
    if (nativePendingWatch) nativePendingWatch.atMs -= 7000;
    nativeMirrorTick(); // the bound passes \u2014 the re-send fires
    window.__p2.resent = window.__contracts[0] || null;
    // The double adopts the re-send: it loads the start item
    // from the NEW contract and answers with its truth.
    if (window.__p2.resent) {
      var item = window.__p2.resent.items[window.__p2.resent.startIndex];
      window.__p2.resentServed = window.__serves(item.mediaUri);
      window.__emitNative(window.__evt475({ playing: window.__p2.resentServed, positionS: window.__p2.resentServed ? 1 : 0 }));
    }
    window.__p2.playing = transportPlaying();
    window.__p2.pendFinal = state.pendingStart;
  });
  await sleep(30);
  const p2 = await ev(() => window.__p2);
  ok(p2.cmds.join(',') === 'play' && p2.pendAtPress === 'marian-antiphon-angelus',
    'P2: the unpause press sends only the play command and the start pends on the antiphon', JSON.stringify(p2).slice(0, 200));
  ok(p2.standingServed === false && p2.pendAfterError === 'marian-antiphon-angelus',
    'P2: the persisted contract\u2019s antiphon address does not serve (the route 404s) \u2014 the error answer leaves the start pended and the recovery armed', JSON.stringify(p2).slice(0, 200));
  ok(!!p2.resent && p2.resentServed === true && p2.playing === true && p2.pendFinal === null,
    'P2: the watch\u2019s re-send carries a serving address \u2014 the start lands, the playing ack closes the window, the queue sounds', JSON.stringify(p2).slice(0, 300));
}

/* ============ P3: guards \u2014 the forms that must not move ============ */
{
  await ev(() => {
    window.__reset466();
    window.__standDay475();
    var ai = { episodeId: 'the-ai-signal', kind: 'episode', title: 'The AI Signal', block: 'The AI Signal',
      url: '/api/player/audio/2026-11-16/the-ai-signal', available: true, durationS: 508 };
    window.__p3 = {};
    window.__p3.ai = oraSnapshotTrack(ai, '2026-11-16');
    var ext = window.__extDesc475();
    window.__p3.ext = oraSnapshotTrack(ext, '2026-11-16');
    var anth = window.__ownDesc475();
    anth.url = 'blob:fake-1'; // the background download swap has minted the blob \u2014 the native side cannot read it
    window.__p3.blob = oraSnapshotTrack(anth, '2026-11-16');
    var bare = { episodeId: 'morning-prayer-elevenlabs', kind: 'episode', title: 'Morning Prayer', block: 'Morning',
      url: null, available: true, durationS: 0 };
    window.__p3.bare = oraSnapshotTrack(bare, '2026-11-16');
    window.__p3.origin = location.origin;
  });
  await sleep(30);
  const p3 = await ev(() => window.__p3);
  ok(!!p3.ai && p3.ai.mediaUri === p3.origin + '/api/player/audio/2026-11-16/the-ai-signal' && p3.ai.needsAuth === true,
    'P3: the AI Signal keeps its Range-route address, absolutized, needsAuth true \u2014 its player_episodes row stands', JSON.stringify(p3.ai));
  ok(!!p3.ext && p3.ext.mediaUri === 'https://feeds.example/divine-office-morning-prayer.mp3' && p3.ext.needsAuth === false,
    'P3: an external direct item keeps its enclosure form', JSON.stringify(p3.ext));
  ok(!!p3.blob && p3.blob.mediaUri === 'https://audio.orapronobis.media/marian-antiphon-angelus-2026-11-16.mp3' && p3.blob.needsAuth === false,
    'P3: a blob-url own descriptor falls back to its enclosureUrl \u2014 the native side never receives a WebView-local address', JSON.stringify(p3.blob));
  ok(!!p3.bare && p3.bare.mediaUri === p3.origin + '/api/player/audio/2026-11-16/morning-prayer-elevenlabs' && p3.bare.needsAuth === true,
    'P3: an own descriptor with no address standing keeps the Range-route fallback', JSON.stringify(p3.bare));
}

await browser.close();
server.close();
console.log('---');
console.log('harness-v475: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) console.log('failures: ' + failures.join(' | '));
process.exit(fail ? 1 : 0);
