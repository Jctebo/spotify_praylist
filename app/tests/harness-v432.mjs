// harness-v432 — the Podcasts offline box retires and the
// Download for offline button moves to the index head row
// (§1/§2 of the v432 release document; John's words,
// 2026-11-14 22:25 CT: "Move download offline button up and
// get rid of that entire box"). Client-only delta: client.ts
// (paintPodcastsIndex's .headrow emission · paintPodcasts'
// retired box call + wiring pair). The builder, the text
// function, paint/wire helpers, the Prayers-home seat, and
// the offline engine stand byte-untouched. ui.ts and
// index.ts byte-untouched.
// Legs per Plan §2.8 = 18: S statics (5) · L1 heights (3) ·
// L2 the act (3) · L3 the box gone (2) · L4 nothing else
// moved (3) · L5 the home untouched (2). Behavior legs run
// in headless Chromium on the v413/v425 extraction mold
// (real SHELL_HTML + APP_CSS, class="view" page), at 412px
// and 690px. Seams stubbed, named: the fetch seam (the
// mold's standing stub, extended to serve enclosure URLs a
// real audio Response) · the api() seam (the v428/v431 mold
// practice — the podcasts index + series payloads come from
// fixtures; every call is logged) · the native bridge stands
// absent, as on the web (oraBridgePlugin reads null).
// Extraction runs on the EVALUATED APP_JS (the served
// string itself), not the raw source: in the raw template
// literal, offlineEvict's date regex stands backslash-
// escaped and the raw extraction drops the function — the
// pass cannot run without it. The evaluated string is the
// code production serves; the statics still read the raw
// source at git level.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const APP = path.resolve(process.cwd(), 'app');
const WT = path.resolve(APP, '..');
if (!WT.includes('.worktrees')) { console.error('HARD GUARD: harness-v432 runs only inside a release worktree'); process.exit(2); }
const SRC = path.join(APP, 'worker/src');
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const I_SRC = readFileSync(SRC + '/index.ts', 'utf8');
const BASE = '3ec84c7c8e1a191724cf57789df28c5876fef2d3';
const B_SRC = execFileSync('git', ['-C', WT, 'show', BASE + ':app/worker/src/client.ts'], { encoding: 'utf8' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('ok   - ' + name); }
  else { fail++; failures.push(name); console.log('FAIL - ' + name + (extra ? ' :: ' + String(extra).slice(0, 300) : '')); }
}
const APP_CSS = U_SRC.slice(U_SRC.indexOf('APP_CSS = `') + 11, U_SRC.indexOf('`;', U_SRC.indexOf('APP_CSS = `')));
const SHELL = U_SRC.slice(U_SRC.indexOf('SHELL_HTML = `') + 14, U_SRC.indexOf('`;', U_SRC.indexOf('SHELL_HTML = `')));
const seg = (src, a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));
const bodyOf = (src, name) => { const a = src.indexOf('function ' + name); const b = src.indexOf('\nfunction ', a + 1); return src.slice(a, b < 0 ? src.length : b); };
const fnSpan = (src, name) => {
  const lines = src.split('\n'); let start = -1;
  for (let i = 0; i < lines.length; i++) { if (lines[i].startsWith('function ' + name)) { start = i; break; } }
  if (start < 0) return null;
  let end = lines.length - 1;
  for (let i = start + 1; i < lines.length; i++) { if (lines[i].startsWith('function ')) { end = i - 1; break; } }
  return { start: start + 1, end: end + 1 }; // 1-based inclusive
};

/* ---------------- S: statics (5) ---------------- */
{
  const idx = bodyOf(C_SRC, 'paintPodcastsIndex()');
  const ser = bodyOf(C_SRC, 'paintPodcasts()');
  const calls = C_SRC.match(/offlineLineHtml\('/g) || [];
  ok(idx.includes('class="row headrow"><h1 class="screen grow">Formation</h1><button class="btn ghost small" id="pod-offline-btn">Download for offline</button></div>')
    && !idx.includes('offlineLineHtml') && !ser.includes('offlineLineHtml')
    && calls.length === 1 && C_SRC.includes("offlineLineHtml('offline-dl-btn')"),
    'S1: paintPodcastsIndex emits ONE .row.headrow holding h1.screen.grow "Formation" then #pod-offline-btn, and no offlineLineHtml call; paintPodcasts emits none; client.ts carries exactly ONE offlineLineHtml call site (the home\u2019s)');

  const names = execFileSync('git', ['-C', WT, 'diff', '--name-only', BASE], { encoding: 'utf8' });
  const fnsSame = ['offlineLineHtml', 'offlineLineText', 'paintOfflineLine', 'wireOfflineButtons', 'paintListenHome']
    .every((n) => bodyOf(C_SRC, n) === bodyOf(B_SRC, n));
  const diff = execFileSync('git', ['-C', WT, 'diff', '-U0', BASE, '--', 'app/worker/src/client.ts'], { encoding: 'utf8' });
  const spans = [fnSpan(C_SRC, 'paintPodcastsIndex()'), fnSpan(C_SRC, 'paintPodcasts()')];
  let confined = true, hunks = 0;
  for (const line of diff.split('\n')) {
    const m = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (!m) continue;
    hunks++;
    const from = Number(m[1]), to = from + (m[2] ? Number(m[2]) - 1 : 0);
    if (!spans.some((s) => s && from >= s.start && to <= s.end)) confined = false;
  }
  ok(!names.includes('app/worker/src/index.ts') && !names.includes('app/worker/src/ui.ts')
    && fnsSame && hunks > 0 && confined,
    'S2: index.ts + ui.ts byte-untouched; offlineLineHtml / offlineLineText / paintOfflineLine / wireOfflineButtons / paintListenHome bodies byte-identical to base; every client.ts diff hunk stands inside the two Podcasts paints');

  const baseBtn = "<button class=\"btn ghost small\" id=\"' + btnId + '\">Download for offline</button>";
  const skelIdx = "if (!res || !res.seriesList) { view.innerHTML = '<h1 class=\"screen\">Formation</h1>' + skelHtml('podindex'); return; }";
  const skelSer = "if (!res) { view.innerHTML = '<h1 class=\"screen\">Formation</h1>' + skelHtml('podseries'); return; }";
  ok(bodyOf(B_SRC, 'offlineLineHtml').includes(baseBtn)
    && idx.includes('<button class="btn ghost small" id="pod-offline-btn">Download for offline</button>')
    && idx.includes(skelIdx) && bodyOf(B_SRC, 'paintPodcastsIndex()').includes(skelIdx)
    && ser.includes(skelSer) && bodyOf(B_SRC, 'paintPodcasts()').includes(skelSer),
    'S3: the head button\u2019s emission is byte-identical to the box\u2019s button (the base builder\u2019s fragment with btnId=pod-offline-btn: id \u00b7 .btn.ghost.small \u00b7 "Download for offline"); both skeleton paints are byte-identical to base');

  const passBodySame = bodyOf(C_SRC, 'offlineCompleteness') === bodyOf(B_SRC, 'offlineCompleteness');
  ok(passBodySame
    && !ser.includes('wireOfflineButtons') && !ser.includes('paintOfflineLine')
    && idx.includes('wireOfflineButtons();') && idx.includes('paintOfflineLine();'),
    'S4: offlineCompleteness (incl. the offlinePassRunning guard) is byte-identical to base; paintPodcasts carries no wireOfflineButtons / paintOfflineLine call; paintPodcastsIndex keeps its wiring pair');

  ok(U_SRC.includes('ora-pro-nobis-v431-1') && !U_SRC.includes('ora-pro-nobis-v432-1')
    && !/#1DB954|#1ed760/i.test(C_SRC + U_SRC),
    'S5: limits — the pin stands at ora-pro-nobis-v431-1 (Ship moves it); no Spotify green; the client.ts delta is confined to the two Podcasts paints (S2)');
}

/* ---------------- client extraction (v413/v425 mold) ---------------- */
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
const EXCLUDE = new Set(['extFetchText']);
const APP_JS = new Function('return ' + C_SRC.slice(
  C_SRC.indexOf('export const APP_JS = `') + 'export const APP_JS = '.length,
  C_SRC.indexOf('`;', C_SRC.indexOf('export const APP_JS = `')) + 1))();
const { out: decls, lines } = scanDecls(APP_JS);
const pieces = [], dropped = [];
for (const d of decls) {
  if (d.name === 'state') continue;
  if (EXCLUDE.has(d.name)) continue;
  const u = unit(lines, d.startLine, d.kind);
  try { if (d.kind === 'fn') new Function('return (' + u + ')'); else new Function(u); pieces.push(u); }
  catch (e) { dropped.push(d.name); }
}
console.log('note - extraction dropped:', dropped.join(', ') || 'none');

const PAGE_HEAD = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>CSSHERE</style></head>
<body data-lit="">
<audio id="audio"></audio>
SHELLHERE
<script>
window.__fetchLog = [];
window.fetch = function (path, opts) {
  var method = (opts && opts.method) || 'GET';
  var body = null;
  try { body = opts && opts.body ? JSON.parse(opts.body) : null; } catch (e) {}
  window.__fetchLog.push({ path: String(path), method: method, body: body });
  if (String(path).indexOf('/api/player/feed-audio') === 0 || String(path).indexOf('audio.example') >= 0) {
    return Promise.resolve(new Response(new Blob(['mp3'], { type: 'audio/mpeg' }), { status: 200 }));
  }
  return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true }); } });
};
function extFetchText(url) { return Promise.reject(new Error('offline')); }
URL.createObjectURL = function () { return 'blob:fake'; };
URL.revokeObjectURL = function () {};
</` + `script>
<script>
var state = { tab: 'podcasts', block: null, playingKey: null, playingUrl: null, queue: [], queueIdx: -1, current: null,
  storedDay: '2026-11-14', presentedDay: '2026-11-14', dateLabel: 'Saturday, November 14', liturgical: null,
  pendingResume: null, sleep: { mode: 'off' }, readTracks: {}, dayDescs: [], dayPayload: null, playedCache: {},
  repeatIds: {}, previewQueue: null, queuePreviewIdx: -1, restoredQueue: false, restoreProbe: null, podRestoreProbe: null,
  prayersView: { kind: 'home' }, searchQuery: '', podcasts: null, podcastsIndex: null, podcastsReturn: null,
  rate: 1, errWaitKey: null, errWaitN: 0, startRetryKey: null, lastStartAt: 0, deepIdx: 0,
  ownStanding: [], extStanding: [], extSlots: {}, ownSlots: {}, daySegments: {}, homeFilter: '', gridDl: {}, aiClaimed: false };
</` + `script>`;
const PAGE = PAGE_HEAD.replace('CSSHERE', () => APP_CSS).replace('SHELLHERE', () => SHELL)
  + '<script>\n' + pieces.join('\n') + '\n</' + 'script>';

const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(PAGE); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
const pageErrors = [];
page.on('pageerror', (e) => { pageErrors.push(String(e).slice(0, 200)); console.log('pageerror:', String(e).slice(0, 200)); });
await page.goto('http://127.0.0.1:' + PORT + '/');
const ev = (fn, arg) => page.evaluate(fn, arg);

/* ---------------- fixtures: the index, the series payloads, the day ---------------- */
await ev(() => {
  localStorage.clear();
  var mkEntries = function (series, titles) {
    return titles.map(function (t, i) {
      return { key: series + ':day-' + (i + 1), kind: 'day', title: 'Day ' + (i + 1) + ': ' + t, label: 'Day ' + (i + 1),
        durationS: 900, url: 'https://audio.example/' + series + '-day' + (i + 1) + '.mp3', listened: false, positionS: 0, descText: t + ' description' };
    });
  };
  var mkPayload = function (series, title, titles, img) {
    var entries = mkEntries(series, titles);
    return { series: series, title: title, available: true, showDesc: title + ' — the fixture show.', showImageUrl: img,
      listenedCount: 0, total: entries.length, currentKey: entries[0].key, entries: entries };
  };
  window.__podSeries = {
    'catechism-in-a-year': mkPayload('catechism-in-a-year', 'Catechism in a Year', ['The Creation', 'The Fall', 'The Flood'], 'https://img.example/ciy-show.jpg'),
    'bible-in-a-year': mkPayload('bible-in-a-year', 'Bible in a Year', ['In the Beginning', 'The Patriarchs'], 'https://img.example/biy-show.jpg'),
    'rosary-in-a-year': mkPayload('rosary-in-a-year', 'Rosary in a Year', ['The Joyful Mysteries'], 'https://img.example/riy-show.jpg'),
    'catholictv': { kind: 'video', title: 'CatholicTV', available: true, videos: [
      { id: 'vidAlpha111', title: 'Catholic Mass Today', dateLabel: 'Nov 15, 2026', imageUrl: 'https://i.ytimg.com/vi/vidAlpha111/hqdefault.jpg', url: 'https://www.youtube.com/watch?v=vidAlpha111' },
      { id: 'vidBravo22', title: 'La Santa Misa', dateLabel: 'Nov 14, 2026', imageUrl: 'https://i.ytimg.com/vi/vidBravo22/hqdefault.jpg', url: 'https://www.youtube.com/watch?v=vidBravo22' }
    ] }
  };
  window.__podIndex = { seriesList: [
    { series: 'catechism-in-a-year', title: 'Catechism in a Year', available: true, listenedCount: 0, total: 3, currentLabel: 'Day 1', showImageUrl: 'https://img.example/ciy-show.jpg' },
    { series: 'bible-in-a-year', title: 'Bible in a Year', available: true, listenedCount: 0, total: 2, currentLabel: 'Day 1', showImageUrl: 'https://img.example/biy-show.jpg' },
    { series: 'rosary-in-a-year', title: 'Rosary in a Year', available: true, listenedCount: 0, total: 1, currentLabel: 'Day 1', showImageUrl: 'https://img.example/riy-show.jpg' },
    { series: 'catholictv', kind: 'video', title: 'CatholicTV', available: true, latestLabel: 'Nov 15, 2026', showImageUrl: 'https://i.ytimg.com/vi/vidAlpha111/hqdefault.jpg' }
  ] };
  // The api seam (named): the podcasts payloads come from the
  // fixtures; every call is logged; an optional delay serves
  // the guard leg.
  window.__apiLog = [];
  window.__apiDelay = 0;
  api = function (p) {
    window.__apiLog.push(String(p));
    var answer = function () {
      if (p === '/api/player/podcasts') return window.__podIndex;
      if (String(p).indexOf('/api/player/podcasts?series=') === 0) return window.__podSeries[decodeURIComponent(String(p).split('series=')[1])];
      return {};
    };
    if (window.__apiDelay && p === '/api/player/podcasts') return new Promise(function (res) { setTimeout(function () { res(answer()); }, window.__apiDelay); });
    return Promise.resolve(answer());
  };
  // The screenshot's counts, seeded as the standing index.
  var t = todayChicago(), tm = offlineShiftDate(t, 1);
  var seed = { days: {}, pods: { autoHave: 1, autoTotal: 9 } };
  seed.days[t] = { have: 33, total: 33 };
  seed.days[tm] = { have: 20, total: 20 };
  localStorage.setItem('opn-offline-index-v1', JSON.stringify(seed));
  // The v431 fixture day, for the Prayers-home paints.
  window.__fixture = {
    date: '2026-11-14', dateLabel: 'Saturday, November 14, 2026', intentionsLine: '',
    blocks: [
      { block: 'Morning', label: 'Morning Prayers', caption: 'Praylists', spotifyUrl: 'https://open.spotify.com/playlist/morning', tracks: [
        { episodeId: 'seg-int-morning', title: 'Intentions', kind: 'segment', available: true, url: 'https://x/int.mp3', durationS: 60 },
        { episodeId: 'm1', title: 'Invitatory', kind: 'episode', available: true, url: '/api/player/feed-audio?m1', durationS: 300 }
      ] },
      { block: 'Midmorning', label: 'Midmorning Prayers', caption: 'Praylists', tracks: [] },
      { block: 'Midday', label: 'Midday Prayers', caption: 'Praylists', tracks: [] },
      { block: 'Afternoon', label: 'Afternoon Prayers', caption: 'Praylists', tracks: [] },
      { block: 'Evening', label: 'Evening Prayers', caption: 'Praylists', tracks: [] },
      { block: 'Night', label: 'Night Prayers', caption: 'Praylists', tracks: [
        { episodeId: 'n1', title: 'Night Prayer', kind: 'episode', available: true, url: '/api/player/feed-audio?n1', durationS: 0 }
      ] },
      { block: 'Mass and Homilies', label: 'Mass and Homilies', caption: 'Praylists', tracks: [] },
      { block: 'Novenas', label: 'Novenas', caption: 'Praylists', tracks: [] },
      { block: 'The AI Signal', label: 'The AI Signal', caption: 'Praylists', tracks: [] }
    ],
    episodes: []
  };
  window.__descs = [
    { episodeId: 'seg-int-morning', kind: 'segment', title: 'Intentions', block: 'Morning', url: 'https://x/int.mp3', available: true, durationS: 60 },
    { episodeId: 'm1', kind: 'episode', title: 'Invitatory', block: 'Morning', url: '/api/player/feed-audio?m1', available: true, durationS: 300 },
    { episodeId: 'n1', kind: 'episode', title: 'Night Prayer', block: 'Night', url: '/api/player/feed-audio?n1', available: true, durationS: 0 }
  ];
});
const topOf = (sel) => ev((s) => {
  var el = document.querySelector(s);
  if (!el) return -1;
  var vt = view.getBoundingClientRect().top + window.scrollY;
  return Math.round(el.getBoundingClientRect().top + window.scrollY - vt);
}, sel);
const waitPassDone = async () => {
  await page.waitForFunction(() => {
    try { var idx = JSON.parse(localStorage.getItem('opn-offline-index-v1') || '{}'); return !!idx.pods && !window.offlinePassRunning; }
    catch (e) { return false; }
  }, null, { timeout: 30000 });
  await sleep(150);
};

/* ---------------- L1: heights (3) ---------------- */
{
  await ev(() => { state.podcastsIndex = window.__podIndex; paintPodcastsIndex(); });
  const g412 = { card: await topOf('[data-podseries]') };
  g412.head = await ev(() => {
    var hr = document.querySelector('.headrow');
    var b = document.getElementById('pod-offline-btn');
    var h = document.querySelector('.headrow h1.screen');
    var br = b.getBoundingClientRect(), hr2 = h.getBoundingClientRect();
    return { headH: hr ? hr.offsetHeight : -1, btnW: Math.round(br.width), btnH: Math.round(br.height),
      titleLeft: Math.round(hr2.left), btnLeft: Math.round(br.left),
      sameLine: Math.abs((br.top + br.height / 2) - (hr2.top + hr2.height / 2)) <= 2 };
  });
  await page.setViewportSize({ width: 690, height: 915 });
  await sleep(120);
  const g690 = { card: await topOf('[data-podseries]') };
  await page.setViewportSize({ width: 412, height: 915 });
  await sleep(120);
  ok(g412.card === 72 && g690.card === 72,
    'L1 (leg 5): the first series card\u2019s top stands at 72 at 412 and at 690 (from 164 / 148) \u2014 net lift 92px / 76px', JSON.stringify({ c412: g412.card, c690: g690.card }));
  ok(g412.head.headH === 44 && g412.head.btnW === 153 && g412.head.btnH === 44 && g412.head.btnLeft > g412.head.titleLeft && g412.head.sameLine,
    'L1 (leg 2): the headrow stands 44 tall; the button measures 153 \u00d7 44 at its right, the title at its left, one line', JSON.stringify(g412.head));

  await ev(() => { state.podcasts = window.__podSeries['catechism-in-a-year']; paintPodcasts(); });
  const s412 = await topOf('.podpage-head');
  await page.setViewportSize({ width: 690, height: 915 });
  await sleep(120);
  const s690 = await topOf('.podpage-head');
  await page.setViewportSize({ width: 412, height: 915 });
  await sleep(120);
  ok(s412 === 94 && s690 === 94,
    'L1 (leg 5): the audio series page\u2019s podpage-head top stands at 94 at 412 and at 690 (from 214 / 198) \u2014 the full box stack lifts', JSON.stringify({ s412, s690 }));
}

/* ---------------- L3: the box gone (2) ---------------- */
{
  await ev(() => { state.podcastsIndex = window.__podIndex; paintPodcastsIndex(); });
  const idxDom = await ev(() => ({
    line: !!document.getElementById('offline-line-text'),
    counts: view.textContent.includes('On this phone:')
  }));
  await ev(() => { state.podcasts = window.__podSeries['catechism-in-a-year']; paintPodcasts(); });
  const serDom = await ev(() => ({
    line: !!document.getElementById('offline-line-text'),
    counts: view.textContent.includes('On this phone:'),
    btn: !!document.getElementById('pod-offline-btn')
  }));
  ok(!idxDom.line && !idxDom.counts && !serDom.line && !serDom.counts && !serDom.btn,
    'L3 (legs 1/5): neither the index nor the audio series page carries #offline-line-text, the counts text, or (series page) a download button \u2014 the box is gone from both paints', JSON.stringify({ idxDom, serDom }));

  const inSettings = await ev(() => {
    paintSettings();
    var el = document.getElementById('set-offline-counts');
    return el ? el.textContent : null;
  });
  const inHome = await ev(() => {
    state.dayPayload = window.__fixture;
    state.dayDescs = window.__descs;
    state.prayersView = { kind: 'home' };
    paintListenHome(window.__fixture);
    var el = document.getElementById('offline-line-text');
    return { text: el ? el.textContent : null, fn: offlineLineText() };
  });
  ok(inSettings === inHome.fn && inHome.text === inHome.fn && inHome.fn.includes('33/33') && inHome.fn.includes('podcasts 1/9'),
    'L3 (legs 4/7): the counts text stands verbatim in Settings (#set-offline-counts) and on the Prayers home box \u2014 the same offlineLineText string', JSON.stringify({ inSettings, home: inHome.text }));
}

/* ---------------- L4: nothing else moved (3) ---------------- */
{
  await ev(() => { state.podcastsIndex = window.__podIndex; paintPodcastsIndex(); });
  const cards = await ev(() => [...document.querySelectorAll('[data-podseries]')].map((c) => ({
    key: c.getAttribute('data-podseries'),
    title: c.querySelector('h3') ? c.querySelector('h3').textContent : '',
    meta: c.querySelector('.meta') ? c.querySelector('.meta').textContent : ''
  })));
  ok(cards.length === 4 && cards.map((c) => c.key).join(',') === 'catechism-in-a-year,bible-in-a-year,rosary-in-a-year,catholictv'
    && cards[0].meta === '0 of 3 listened \u00b7 Current: Day 1' && cards[3].meta === 'Video \u00b7 Latest: Nov 15, 2026',
    'L4 (leg 6): the index series cards paint in standing form and order \u2014 counts, current lines, and the video card\u2019s meta form included', JSON.stringify(cards.map((c) => c.key + '|' + c.meta)));

  await ev(() => { state.podcasts = window.__podSeries['catechism-in-a-year']; paintPodcasts(); });
  const furn = await ev(() => ({
    back: !!document.querySelector('[data-podback]'),
    headTitle: (document.querySelector('.podpage-head h1.screen') || {}).textContent || '',
    headMeta: (document.querySelector('.podpage-head .meta') || {}).textContent || '',
    rows: document.querySelectorAll('[data-podrow]').length,
    marks: document.querySelectorAll('[data-podmark]').length,
    menus: document.querySelectorAll('[data-podmenu]').length,
    dl: document.querySelectorAll('[data-poddlstate]').length,
    current: view.textContent.includes('Current episode')
  }));
  ok(furn.back && furn.headTitle === 'Catechism in a Year' && furn.headMeta.indexOf('0 of 3 listened') === 0
    && furn.rows === 3 && furn.marks === 3 && furn.menus === 3 && furn.dl === 3 && furn.current,
    'L4 (leg 5): the audio series page\u2019s furniture stands as base \u2014 back row, page head, rows, marks, menus, download states, the current-episode card', JSON.stringify(furn));

  await ev(() => { state.podcasts = window.__podSeries['catholictv']; paintPodSeriesPage(); });
  const vid = await ev(() => ({
    rows: document.querySelectorAll('[data-podvideo]').length,
    line: !!document.getElementById('offline-line-text'),
    btn: !!document.getElementById('pod-offline-btn'),
    headMeta: (document.querySelector('.podpage-head .meta') || {}).textContent || ''
  }));
  ok(vid.rows === 2 && !vid.line && !vid.btn && vid.headMeta === 'Video series \u00b7 Updated Nov 15, 2026',
    'L4 (leg 5): the video series page stands as base \u2014 no box before, none now; its rows and head stand; v434/v436\u2019s surface is untouched', JSON.stringify(vid));
}

/* ---------------- L5: the home untouched (2) ---------------- */
{
  await ev(() => {
    state.dayPayload = window.__fixture;
    state.dayDescs = window.__descs;
    state.prayersView = { kind: 'home' };
    paintListenHome(window.__fixture);
    wirePrayersView(window.__fixture); // the standing paint sequence: the home wiring pair lives in wirePrayersView
  });
  const home = await ev(() => {
    var pa = document.getElementById('play-all');
    var off = document.getElementById('offline-dl-btn');
    var body = document.getElementById('home-body');
    var order = pa && off && body
      ? (body.compareDocumentPosition(pa) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 && (pa.compareDocumentPosition(off) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      : false;
    var card = off ? off.closest('.card') : null;
    var line = document.getElementById('offline-line-text');
    return { pa: !!pa, off: !!off, order, inCard: !!card, line: line ? line.textContent : null };
  });
  ok(home.pa && home.off && home.order && home.inCard && home.line && home.line.includes('33/33'),
    'L5 (leg 7): the Prayers home paints its offline box below Play All, in its card, with #offline-dl-btn and the standing counts line', JSON.stringify(home));

  await ev(() => {
    localStorage.removeItem('opn-offline-index-v1');
    document.getElementById('offline-line-text').textContent = 'STALE';
  });
  await page.click('#offline-dl-btn');
  await waitPassDone();
  const after = await ev(() => {
    var idx = JSON.parse(localStorage.getItem('opn-offline-index-v1') || '{}');
    var line = document.getElementById('offline-line-text');
    return { pods: idx.pods || null, days: Object.keys(idx.days || {}).length, line: line ? line.textContent : null, fn: offlineLineText() };
  });
  ok(after.pods && after.pods.autoTotal === 6 && after.days >= 1 && after.line === after.fn && after.line !== 'STALE',
    'L5 (leg 7): a tap on #offline-dl-btn runs the same manual pass (the index writes land: today\u2019s day entry + the podcast set 6) and the home line repaints in place', JSON.stringify(after));
}

/* ---------------- L2: the act (3) ---------------- */
{
  const errBase = pageErrors.length;
  await ev(() => {
    localStorage.removeItem('opn-offline-index-v1');
    state.podcastsIndex = window.__podIndex;
    paintPodcastsIndex();
  });
  await page.click('#pod-offline-btn');
  await waitPassDone();
  const tap = await ev(() => {
    var idx = JSON.parse(localStorage.getItem('opn-offline-index-v1') || '{}');
    var t = todayChicago();
    return { pods: idx.pods || null, today: idx.days ? idx.days[t] : null, running: window.offlinePassRunning };
  });
  ok(tap.pods && tap.pods.autoTotal === 6 && tap.pods.autoHave === 6 && tap.today && tap.today.total === 0 && tap.running === false,
    'L2 (leg 3): a tap on #pod-offline-btn at the head seat runs the manual pass \u2014 the pass\u2019s index writes land (today\u2019s entry + the podcast automatic set, 6 fetched of 6) and the pass closes', JSON.stringify(tap));

  await ev(() => {
    localStorage.removeItem('opn-offline-index-v1');
    window.__apiLog = [];
    window.__apiDelay = 900;
    document.getElementById('pod-offline-btn').click();
  });
  await sleep(250);
  const midState = await ev(() => ({ running: window.offlinePassRunning }));
  await ev(() => { document.getElementById('pod-offline-btn').click(); });
  await waitPassDone();
  const guard = await ev(() => ({
    indexCalls: window.__apiLog.filter((p) => p === '/api/player/podcasts').length,
    pods: (JSON.parse(localStorage.getItem('opn-offline-index-v1') || '{}').pods) || null
  }));
  await ev(() => { window.__apiDelay = 0; });
  ok(midState.running === true && guard.indexCalls === 1 && guard.pods && guard.pods.autoTotal === 6,
    'L2 (leg 3): a second tap during a running pass starts no second pass \u2014 the guard holds (one index enumeration across both taps)', JSON.stringify({ midState, guard }));

  await ev(() => {
    state.dayPayload = window.__fixture;
    state.dayDescs = window.__descs;
    state.prayersView = { kind: 'home' };
    paintListenHome(window.__fixture);
    wirePrayersView(window.__fixture);
    document.getElementById('offline-line-text').textContent = 'STALE';
    localStorage.removeItem('opn-offline-index-v1');
    offlineOnOnlineOpen(null);
  });
  await waitPassDone();
  const auto = await ev(() => {
    var line = document.getElementById('offline-line-text');
    return { line: line ? line.textContent : null, fn: offlineLineText() };
  });
  await ev(() => { state.podcastsIndex = window.__podIndex; paintPodcastsIndex(); });
  const offTab = await ev(() => ({ line: !!document.getElementById('offline-line-text') }));
  ok(auto.line === auto.fn && auto.line !== 'STALE' && !offTab.line && pageErrors.length === errBase,
    'L2 (legs 3/4): the automatic pass still runs on an online open; its stage repaints land on the home line (in place) with zero page errors on the Podcasts paints, where no line element stands', JSON.stringify({ auto, offTab, errs: pageErrors.length - errBase }));
}

console.log('note - pageerrors: ' + pageErrors.length);
console.log('harness-v432: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) console.log('failures: ' + failures.join(' | '));
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
