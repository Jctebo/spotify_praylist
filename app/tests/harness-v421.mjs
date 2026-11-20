// harness-v421 — the Android system back binding (§1/§2
// of the v421 release document). Client half: client.ts
// only (index.ts byte-untouched; the pin stands at
// ora-pro-nobis-v420-1 until the Ship composition).
// The mold (the v388/v417/v420 extraction mold: real
// SHELL_HTML + APP_CSS, fixture state) has no App plugin,
// so the harness proves the DISPATCH — registration under
// a stub window.Capacitor.Plugins.App, and the handler's
// arms against the standing view state. The physical
// button is John's field check (§1.8).
//   S1 statics (one listener · the document route NOT
//      bound · no history machinery · the disc's own
//      handlers · the boot seam · the pin)
//   L1 guarded registration (no plugin → no-op; stub
//      plugin → exactly one 'backButton' registration)
//   L2 block dispatch = disc identity (leg 1)
//   L3 the episodes page rides the block arm
//   L4 series dispatch (D-421-1)
//   L5 root → exitApp, exactly once
//   L6 overlay first (sheet, then menu)
//   L7 single fire at every arm (one press, one level)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const APP = path.resolve(process.cwd(), 'app');
const SRC = path.join(APP, 'worker/src');
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const I_SRC = readFileSync(SRC + '/index.ts', 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('ok   - ' + name); }
  else { fail++; failures.push(name); console.log('FAIL - ' + name + (extra ? ' :: ' + String(extra).slice(0, 300) : '')); }
}
const APP_CSS = U_SRC.slice(U_SRC.indexOf('APP_CSS = `') + 11, U_SRC.indexOf('`;', U_SRC.indexOf('APP_CSS = `')));
const SHELL = U_SRC.slice(U_SRC.indexOf('SHELL_HTML = `') + 14, U_SRC.indexOf('`;', U_SRC.indexOf('SHELL_HTML = `')));

/* ---------------- S1: statics ---------------- */
{
  const listeners = C_SRC.match(/addListener\('backButton'/g) || [];
  ok(listeners.length === 1, 'S1 (§2.5/F-421-4): exactly one addListener(\'backButton\' stands in client.ts', 'count=' + listeners.length);
  ok(!/addEventListener\(\s*['"]backbutton/.test(C_SRC),
    'S1 (§2.5/F-421-4): the \'backbutton\' document event is NOT bound (one press fires both routes — binding both goes back two levels)');
  ok(!/pushState|popstate|history\.back\s*\(|history\.go\s*\(|history\.forward\s*\(/.test(C_SRC),
    'S1 (§2.5/F-421-3): no history machinery anywhere — no pushState, no popstate, no history navigation calls');
  const handler = C_SRC.slice(C_SRC.indexOf('function handleSystemBack'), C_SRC.indexOf('function setupBackButton'));
  ok(handler.includes('goListenHome(state.prayersView.block)'),
    'S1 (§2.5): the block arm calls the disc\u2019s own handler with the view state\u2019s block — goListenHome(state.prayersView.block)');
  ok(handler.includes('goPodcastsIndex()') && handler.includes('exitApp()'),
    'S1 (§2.4/§2.3): the series arm calls goPodcastsIndex; the root rule calls exitApp');
  ok(C_SRC.includes("b.addEventListener('click', goPodcastsIndex)"),
    'S1 (§2.5): wirePodBack binds the SAME named act (goPodcastsIndex) the dispatch calls — one act, two triggers');
  ok(/setupBridgeCommands\(\);[^\n]*\nsetupBackButton\(\);/.test(C_SRC),
    'S1 (§2.5): the boot seam stands — setupBackButton() invoked beside setupBridgeCommands()');
  ok(U_SRC.includes('ora-pro-nobis-v420-1') && !U_SRC.includes('ora-pro-nobis-v421-1'),
    'S1: the SW pin is untouched at Implement (Ship moves it)');
  ok(!I_SRC.includes('backButton') && !I_SRC.includes('handleSystemBack'),
    'S1: index.ts carries no binding markers (the delta is client.ts only)');
  ok(!/#1DB954|#1ed760/i.test(C_SRC + U_SRC), 'S1: no Spotify green anywhere');
}

/* ---------------- client extraction (the standing mold) ---------------- */
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
ok(pieces.some((p) => p.startsWith('function setupBackButton')) && pieces.some((p) => p.startsWith('function handleSystemBack')) && pieces.some((p) => p.startsWith('function goPodcastsIndex')),
  'S1: the binding\u2019s three functions survive extraction (setupBackButton · handleSystemBack · goPodcastsIndex)');

const PAGE_HEAD = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>CSSHERE</style></head>
<body data-lit="">
<audio id="audio"></audio>
SHELLHERE
<script>
window.__fetchLog = [];
window.__podIndex = { seriesList: [{ series: 'bible', title: 'Bible in a Year', available: true, listenedCount: 8, total: 12, currentLabel: 'Day 9', showImageUrl: null }] };
window.fetch = function (path, opts) {
  var method = (opts && opts.method) || 'GET';
  var body = null;
  try { body = opts && opts.body ? JSON.parse(opts.body) : null; } catch (e) {}
  window.__fetchLog.push({ path: String(path), method: method, body: body });
  if (String(path).indexOf('/api/player/feed-audio') === 0) {
    return Promise.resolve(new Response(new Blob(['mp3'], { type: 'audio/mpeg' }), { status: 200 }));
  }
  if (String(path) === '/api/player/podcasts') {
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(window.__podIndex); } });
  }
  return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true }); } });
};
function extFetchText(url) { return Promise.reject(new Error('offline')); }
function refreshPlayedChrome() {}
URL.createObjectURL = function () { return 'blob:fake'; };
URL.revokeObjectURL = function () {};
</` + `script>
<script>
var state = { tab: 'prayers', examMode: 'quick', examCat: null, deepIdx: 0, block: null, playingKey: null, playingUrl: null, queue: [], queueIdx: -1, current: null,
  storedDay: '2026-11-14', presentedDay: '2026-11-14', dateLabel: 'Saturday, November 14', liturgical: null,
  pendingResume: null, sleep: { mode: 'off' }, readTracks: {}, dayDescs: [], dayPayload: null, playedCache: {},
  repeatIds: {}, previewQueue: null, queuePreviewIdx: -1, restoredQueue: false, restoreProbe: null, podRestoreProbe: null,
  prayersView: { kind: 'home' }, searchQuery: '', podcasts: null, podcastsIndex: null, podcastsReturn: null,
  rate: 1, errWaitKey: null, errWaitN: 0, startRetryKey: null, lastStartAt: 0,
  ownStanding: [], extStanding: [], extSlots: {}, ownSlots: {}, daySegments: {}, homeFilter: '', gridDl: {}, aiClaimed: false };
</` + `script>`;
const PAGE = PAGE_HEAD.replace('CSSHERE', () => APP_CSS).replace('SHELLHERE', () => SHELL)
  + '<script>\n' + pieces.join('\n') + '\n</' + 'script>';

const server = http.createServer((req, res) => {
  // The shell's own <script src="/app.js"> tag stands in
  // SHELL_HTML; the mold's client rides THIS page's inline
  // scripts, so any .js path is served empty rather than
  // answering the page HTML into a script slot (the
  // fixture artifact the v417 seat recorded).
  if (req.url && req.url.endsWith('.js')) { res.setHeader('Content-Type', 'application/javascript'); res.end(''); return; }
  res.setHeader('Content-Type', 'text/html'); res.end(PAGE);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 400, height: 800 } });
const pageErrors = [];
page.on('pageerror', (e) => { pageErrors.push(String(e).slice(0, 200)); console.log('pageerror:', String(e).slice(0, 200)); });
await page.goto('http://127.0.0.1:' + PORT + '/');
const ev = (fn, arg) => page.evaluate(fn, arg);

/* Fixture: the v420 mold's production-shaped day + podcasts. */
await ev(() => {
  var blk = function (name, caption, tracks) { return { block: name, label: name, caption: caption || '', tracks: tracks || [] }; };
  window.__fixture = {
    date: '2026-11-14', dateLabel: 'Saturday, November 14', intentionsLine: '',
    blocks: [
      blk('Morning', 'from midnight', [
        { episodeId: 'm1', title: 'Invitatory', kind: 'episode', available: true, url: '/api/player/feed-audio?m1', durationS: 300, hasText: true, textUrl: '/text/m1.txt' }
      ]),
      blk('Midmorning'), blk('Midday'), blk('Afternoon'), blk('Evening'), blk('Night'),
      blk('Mass and Homilies'), blk('Novenas'), blk('The AI Signal')
    ],
    episodes: [{ episodeId: 'pod-ep-1', title: 'Podcast Episode', kind: 'episode', available: true, url: 'https://x/p1.mp3', durationS: 600 }]
  };
  window.__descs = [
    { episodeId: 'm1', kind: 'episode', title: 'Invitatory', block: 'Morning', url: '/api/player/feed-audio?m1', available: true, durationS: 300 }
  ];
  var entries = [];
  for (var i = 1; i <= 12; i++) {
    entries.push({ key: 'e' + i, label: 'Day ' + i, title: 'Episode ' + i, url: 'https://x/e' + i + '.mp3', durationS: 600, listened: i <= 7 || i === 10, listenDate: '2026-11-10', positionS: 0, imageUrl: null, descText: null });
  }
  window.__pods = { series: 'bible', title: 'Bible in a Year', available: true, showImageUrl: null, showDesc: 'Daily readings.', listenedCount: 8, total: 12, currentKey: 'e9', entries: entries };
  state.dayPayload = window.__fixture;
  state.dayDescs = window.__descs;
});

/* ---------------- L1: guarded registration ---------------- */
{
  const noPlugin = await ev(() => {
    var threw = false;
    try { setupBackButton(); } catch (e) { threw = true; }
    return { threw: threw, capType: typeof window.Capacitor };
  });
  ok(!noPlugin.threw && noPlugin.capType === 'undefined',
    'L1 (§2.5): with no Capacitor present, setupBackButton() is a clean no-op — boot completes, nothing registers', JSON.stringify(noPlugin));
  const stubbed = await ev(() => {
    window.__regs = []; window.__exitCalls = 0;
    window.Capacitor = { Plugins: { App: {
      addListener: function (name, fn) { window.__regs.push({ name: name, fn: fn }); return Promise.resolve({ remove: function () {} }); },
      exitApp: function () { window.__exitCalls++; return Promise.resolve(); }
    } } };
    setupBackButton();
    return { regs: window.__regs.map((r) => r.name), fnType: typeof (window.__regs[0] && window.__regs[0].fn) };
  });
  ok(stubbed.regs.length === 1 && stubbed.regs[0] === 'backButton' && stubbed.fnType === 'function',
    'L1 (§2.5): with the stub App plugin injected, exactly one registration is recorded at boot — the \'backButton\' listener', JSON.stringify(stubbed));
}
/* The captured handler, invoked as the plugin invokes it.
   canGoBack rides TRUE throughout: the design ignores it
   (F-421-3) — every leg below proves the view state, not
   the history flag, governs. */
const pressBack = () => ev(() => { window.__regs[0].fn({ canGoBack: true }); });

/* ---------------- L2: block dispatch = disc identity ---------------- */
{
  await ev(() => {
    view = document.getElementById('view');
    state.tab = 'prayers';
    state.prayersView = { kind: 'block', block: 'Morning' };
    paintBlockPage(window.__fixture, 'Morning');
  });
  await pressBack();
  const viaBack = await ev(() => ({
    kind: state.prayersView.kind,
    cards: document.querySelectorAll('[data-openblock]').length,
    head: !!document.querySelector('.blockpage-head'),
    exits: window.__exitCalls
  }));
  // The home grid paints ten [data-openblock] cards: the
  // nine blocks + the From Today's Podcast card.
  ok(viaBack.kind === 'home' && viaBack.cards === 10 && !viaBack.head && viaBack.exits === 0,
    'L2 (leg 1): on the Morning block page, system back lands home — the grid stands (nine blocks + the episodes card), the block head is gone, no exit', JSON.stringify(viaBack));
  /* The disc tap on the same fixture, for identity: */
  await ev(() => {
    state.prayersView = { kind: 'block', block: 'Morning' };
    paintBlockPage(window.__fixture, 'Morning');
    wirePrayersView(window.__fixture);
  });
  await page.click('.blockpage-head [data-back]');
  await sleep(80);
  const viaDisc = await ev(() => ({
    kind: state.prayersView.kind,
    cards: document.querySelectorAll('[data-openblock]').length,
    head: !!document.querySelector('.blockpage-head'),
    exits: window.__exitCalls
  }));
  ok(JSON.stringify(viaBack) === JSON.stringify(viaDisc),
    'L2 (leg 1): the back-press outcome EQUALS the disc tap\u2019s on the same fixture — same destination, same painted home', JSON.stringify({ back: viaBack, disc: viaDisc }));
}

/* ---------------- L3: the episodes page rides the block arm ---------------- */
{
  await ev(() => {
    state.tab = 'prayers';
    state.prayersView = { kind: 'block', block: '__episodes' };
    paintBlockPage(window.__fixture, '__episodes');
  });
  await pressBack();
  const r = await ev(() => ({ kind: state.prayersView.kind, cards: document.querySelectorAll('[data-openblock]').length, exits: window.__exitCalls }));
  ok(r.kind === 'home' && r.cards === 10 && r.exits === 0,
    'L3 (§2.4/F-421-7): from From Today\u2019s Podcast (\'__episodes\', the same block-view state), system back goes home through the same arm', JSON.stringify(r));
}

/* ---------------- L4: series dispatch (D-421-1) ---------------- */
{
  await ev(() => {
    view = document.getElementById('view');
    state.tab = 'podcasts';
    state.podcasts = window.__pods;
    state.podcastsIndex = window.__podIndex;
    state.podcastsReturn = { level: 'series', series: 'bible', scroll: 0 };
    paintPodcasts();
  });
  const before = await ev(() => ({ level: podLevel, back: !!document.querySelector('[data-podback]') }));
  await pressBack();
  await sleep(150);
  const after = await ev(() => ({
    level: podLevel,
    ret: state.podcastsReturn,
    seriesCards: document.querySelectorAll('[data-podseries]').length,
    exits: window.__exitCalls
  }));
  ok(before.level === 'series' && before.back,
    'L4 (D-421-1): the series page stands (podLevel series, its disc painted) before the press', JSON.stringify(before));
  ok(after.level === 'index' && after.ret === null && after.seriesCards === 1 && after.exits === 0,
    'L4 (D-421-1): system back on the series page runs the wirePodBack act — the return record clears, the index paints, no exit', JSON.stringify(after));
}

/* ---------------- L5: root → exitApp ---------------- */
{
  await ev(() => {
    state.tab = 'prayers';
    state.prayersView = { kind: 'home' };
    paintPrayersView(window.__fixture);
  });
  const before = await ev(() => window.__exitCalls);
  await pressBack();
  const r = await ev(() => ({ exits: window.__exitCalls, kind: state.prayersView.kind, tab: state.tab }));
  ok(r.exits === before + 1 && r.kind === 'home' && r.tab === 'prayers',
    'L5 (§2.3/F-421-1): at a top-level page, system back calls exitApp exactly once and changes no view state — the standing default, reproduced by the handler', JSON.stringify(r));
}

/* ---------------- L6: overlay first ---------------- */
{
  await ev(() => {
    state.tab = 'prayers';
    state.prayersView = { kind: 'block', block: 'Morning' };
    paintBlockPage(window.__fixture, 'Morning');
    var sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.innerHTML = '<div class="inner"><div class="row"><h1 class="screen grow">Test sheet</h1></div><p class="meta">standing</p></div>';
    document.body.appendChild(sheet);
    mountDrawer(sheet, false);
  });
  /* __exitCalls is cumulative across the page (L5's root
     press already counted one) — these legs assert the
     count does not MOVE, not that it reads zero. */
  const exitsBefore = await ev(() => window.__exitCalls);
  await pressBack();
  const afterSheet = await ev(() => ({
    sheet: !!document.querySelector('.sheet'),
    kind: state.prayersView.kind, exits: window.__exitCalls
  }));
  ok(!afterSheet.sheet && afterSheet.kind === 'block' && afterSheet.exits === exitsBefore,
    'L6 (F-421-5): with a sheet standing over a block page, back dismisses the SHEET (its own close path) and the block page still stands', JSON.stringify(afterSheet));
  await pressBack();
  const afterSecond = await ev(() => ({ kind: state.prayersView.kind, exits: window.__exitCalls }));
  ok(afterSecond.kind === 'home' && afterSecond.exits === exitsBefore,
    'L6 (F-421-5): the next press fires the block arm — home, still no exit', JSON.stringify(afterSecond));
  /* The anchored menu variant of the same rule: */
  await ev(() => {
    state.prayersView = { kind: 'block', block: 'Morning' };
    paintBlockPage(window.__fixture, 'Morning');
    openSheetMenu('Test menu', [{ label: 'Nothing', act: function () {} }], null);
  });
  await pressBack();
  const afterMenu = await ev(() => ({
    menu: !!document.querySelector('.anchmenu'), catcher: !!document.querySelector('.menucatcher'),
    kind: state.prayersView.kind, exits: window.__exitCalls
  }));
  ok(!afterMenu.menu && !afterMenu.catcher && afterMenu.kind === 'block' && afterMenu.exits === exitsBefore,
    'L6 (F-421-5): with an anchored menu standing, back closes the menu (card + catcher) and the block page still stands', JSON.stringify(afterMenu));
  await ev(() => { state.prayersView = { kind: 'home' }; paintPrayersView(window.__fixture); });
}

/* ---------------- L7: single fire ---------------- */
{
  // One invocation per arm, counted exactly: block (L2)
  // moved one level (block → home, exits 0); series (L4)
  // moved one level (series → index, exits 0); root (L5)
  // exited exactly once. A double fire would show as an
  // exit on L2/L4 or two levels on any arm — none stands.
  const r = await ev(() => ({ exits: window.__exitCalls }));
  ok(r.exits === 1,
    'L7 (§2.5): across every arm exercised above, exitApp fired exactly once in total (the root press) — no press ever moved two levels', JSON.stringify(r));
  ok(pageErrors.length === 0, 'L7: the page ran clean — no pageerror across the whole harness', pageErrors.join(' | '));
}

console.log('harness-v421: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) console.log('failures: ' + failures.join(' | '));
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
