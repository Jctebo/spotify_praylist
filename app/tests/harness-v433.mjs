// harness-v433 — the Podcasts series page takes the slim
// treatment (§1/§2 of the v433 release document; John's
// words, 2026-11-14 22:27 CT: "Podcasts need same slim
// editor"). Client-only delta: client.ts (paintPodcasts +
// its podRowString closure). The episode rows take v424's
// slim form: the .prow-ctl controls line retires, the
// controls move into the title line as a .prow-cluster
// reading mark · play · ⋮, the standalone share retires
// (Share stands first in the ⋮ menu), the downloaded
// indicator trails the meta line, the Current episode card
// retires into its row (the row's meta leads "Current
// episode · "), the description stands at the two-line
// clamp, the page head stands entire. ui.ts and index.ts
// byte-untouched; no new CSS.
// Legs per Plan §2.6 = 26: S statics (6) · L1 heights (4) ·
// L2 the form (3) · L3 the acts (5) · L4 display rules (3)
// · L5 nothing else moved (4) · L6 density (1). Behavior
// legs run in headless Chromium on the v413/v425 extraction
// mold (real SHELL_HTML + APP_CSS, class="view" page), at
// 412px and 690px, on the §2.2 Bible-shaped fixture (372
// entries · 316 listened · current Day 317 · the four card
// forms · a downloaded entry seeded in the cache). Seams
// stubbed, named: the fetch seam (the mold's standing stub)
// · the api() seam stands as the client's own default in
// the mold (post() rides the fetch stub, which answers ok).
// Extraction runs on the EVALUATED APP_JS (the served
// string itself), not the raw source (the v432 mold note);
// the statics still read the raw source at git level.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const APP = path.resolve(process.cwd(), 'app');
const WT = path.resolve(APP, '..');
if (!WT.includes('.worktrees')) { console.error('HARD GUARD: harness-v433 runs only inside a release worktree'); process.exit(2); }
const SRC = path.join(APP, 'worker/src');
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const BASE = '67a27dc773b09b63803ee2f3eee50efd64889862';
const B_SRC = execFileSync('git', ['-C', WT, 'show', BASE + ':app/worker/src/client.ts'], { encoding: 'utf8' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('ok   - ' + name); }
  else { fail++; failures.push(name); console.log('FAIL - ' + name + (extra ? ' :: ' + String(extra).slice(0, 300) : '')); }
}
const APP_CSS = U_SRC.slice(U_SRC.indexOf('APP_CSS = `') + 11, U_SRC.indexOf('`;', U_SRC.indexOf('APP_CSS = `')));
const SHELL = U_SRC.slice(U_SRC.indexOf('SHELL_HTML = `') + 14, U_SRC.indexOf('`;', U_SRC.indexOf('SHELL_HTML = `')));
const bodyOf = (src, name) => { const a = src.indexOf('function ' + name); const b = src.indexOf('\nfunction ', a + 1); return src.slice(a, b < 0 ? src.length : b); };
const segOf = (src, a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));
const fnSpan = (src, name) => {
  const lines = src.split('\n'); let start = -1;
  for (let i = 0; i < lines.length; i++) { if (lines[i].startsWith('function ' + name)) { start = i; break; } }
  if (start < 0) return null;
  let end = lines.length - 1;
  for (let i = start + 1; i < lines.length; i++) { if (lines[i].startsWith('function ')) { end = i - 1; break; } }
  return { start: start + 1, end: end + 1 }; // 1-based inclusive
};

/* ---------------- S: statics (6) ---------------- */
{
  const rowSeg = segOf(C_SRC, 'var podRowString', 'var podCollapseEmitted');
  const serSeg = bodyOf(C_SRC, 'paintPodcasts()');
  const iMark = rowSeg.indexOf('data-podmark'), iPlay = rowSeg.indexOf('data-podplay'), iMenu = rowSeg.indexOf('data-podmenu');
  ok(!rowSeg.includes('class="prow-ctl"') && !rowSeg.includes('data-podshare')
    && rowSeg.includes('class="titlerow"') && rowSeg.includes('class="prow-cluster"')
    && iMark >= 0 && iMark < iPlay && iPlay < iMenu,
    'S1: podRowString emits no .prow-ctl and no data-podshare; the cluster emission order inside .titlerow .prow-cluster = podmark · podplay · podmenu');

  ok(!serSeg.includes('>Current episode</div>') && !serSeg.includes('class="meta">Current episode')
    && rowSeg.includes('Current episode'),
    'S2: paintPodcasts emits no Current-episode card (the card\u2019s meta emission is gone); the naming stands in podRowString\u2019s meta lead');

  const iDl = rowSeg.indexOf('data-poddlstate');
  ok(rowSeg.includes('class="meta metarow"') && iDl > rowSeg.indexOf('class="meta metarow"')
    && rowSeg.slice(iDl, iDl + 120).includes('display:none')
    && bodyOf(C_SRC, 'refreshPodDlStates') === bodyOf(B_SRC, 'refreshPodDlStates'),
    'S3: the \u2913 span keeps data-poddlstate + its display:none start, seated in the .meta.metarow after the text span; refreshPodDlStates\u2019 body is byte-identical to base');

  ok(['playPodFrom', 'podToggleMark', 'podDlTap', 'openPodRowMenu', 'podDesc']
    .every((n) => bodyOf(C_SRC, n) === bodyOf(B_SRC, n)),
    'S4: the act bodies are byte-identical to base (playPodFrom · podToggleMark · podDlTap · openPodRowMenu · podDesc)');

  const idxDiff = execFileSync('git', ['-C', WT, 'diff', BASE, '--', 'app/worker/src/index.ts'], { encoding: 'utf8' });
  ok(['paintPodcastsIndex', 'paintPodcastVideos', 'paintPodWatch', 'trackCard']
    .every((n) => bodyOf(C_SRC, n) === bodyOf(B_SRC, n)) && idxDiff === '',
    'S5: paintPodcastsIndex · paintPodcastVideos · paintPodWatch · trackCard bodies byte-identical to base; the index.ts diff is 0');

  const uiDiff = execFileSync('git', ['-C', WT, 'diff', BASE, '--', 'app/worker/src/ui.ts'], { encoding: 'utf8' });
  const diff = execFileSync('git', ['-C', WT, 'diff', '-U0', BASE, '--', 'app/worker/src/client.ts'], { encoding: 'utf8' });
  const span = fnSpan(C_SRC, 'paintPodcasts()');
  let confined = true, hunks = 0;
  for (const line of diff.split('\n')) {
    const m = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (!m) continue;
    hunks++;
    const from = Number(m[1]), to = from + (m[2] ? Number(m[2]) - 1 : 0);
    if (!span || from < span.start || to > span.end) confined = false;
  }
  ok(uiDiff === '' && U_SRC.includes('ora-pro-nobis-v432-1') && !U_SRC.includes('ora-pro-nobis-v433-1')
    && !/#1DB954|#1ed760/i.test(C_SRC + U_SRC) && hunks > 0 && confined,
    'S6: limits — the ui.ts delta is 0 lines (the pin stands at ora-pro-nobis-v432-1; Ship moves it); no Spotify green; the client.ts delta is confined to paintPodcasts + podRowString');
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

/* ---------------- fixtures: the §2.2 Bible-shaped series, the index, the video series, the day ---------------- */
await ev(() => {
  localStorage.clear();
  var DESC = 'Today we hear the readings for this day of the journey through Scripture, with the patriarchs and the promises made to them long ago in the land.';
  window.__mkBible = function () {
    var entries = [];
    var push = function (n, over) {
      var e = { key: 'bible-in-a-year:day-' + n, kind: 'day',
        title: 'Day ' + n + ': Episode title ' + n, label: 'Day ' + n,
        durationS: 1609, url: 'https://audio.example/biy-day' + n + '.mp3',
        listened: false, listenDate: null, positionS: 0, descText: DESC };
      for (var k in (over || {})) e[k] = over[k];
      entries.push(e);
    };
    for (var n = 1; n <= 316; n++) push(n, { listened: true, listenDate: '2026-11-01', positionS: null, descText: 'Folded reading ' + n + '.' });
    push(317, {});                                    // the current entry — standard form
    push(318, { positionS: 400 });                    // partway — standard form + the bar; the downloaded entry (cache-seeded in L2)
    push(319, { descText: '' });                      // no description
    push(320, { title: 'Day 320: The Long Wanderings Through the Wilderness and the Numbering of the Tribes' }); // long title
    push(321, { durationS: 0, positionS: 100 });      // partway with no duration — no bar (v395's named case)
    for (var n = 322; n <= 372; n++) push(n, {});
    return { series: 'bible-in-a-year', title: 'Bible in a Year', available: true,
      showDesc: 'Fr. Mike Schmitz walks you through the entire Bible in 365 episodes, using the Great Adventure Bible Timeline to provide an easier way to understand salvation history.',
      showImageUrl: 'https://img.example/biy-show.jpg',
      listenedCount: 316, total: 372, currentKey: 'bible-in-a-year:day-317', entries: entries };
  };
  window.__podSeries = { 'catholictv': { kind: 'video', title: 'CatholicTV', available: true, videos: [
    { id: 'vidAlpha111', title: 'Catholic Mass Today', dateLabel: 'Nov 15, 2026', imageUrl: 'https://i.ytimg.com/vi/vidAlpha111/hqdefault.jpg', url: 'https://www.youtube.com/watch?v=vidAlpha111' },
    { id: 'vidBravo22', title: 'La Santa Misa', dateLabel: 'Nov 14, 2026', imageUrl: 'https://i.ytimg.com/vi/vidBravo22/hqdefault.jpg', url: 'https://www.youtube.com/watch?v=vidBravo22' }
  ] } };
  window.__podIndex = { seriesList: [
    { series: 'bible-in-a-year', title: 'Bible in a Year', available: true, listenedCount: 316, total: 372, currentLabel: 'Day 317', showImageUrl: 'https://img.example/biy-show.jpg' },
    { series: 'catholictv', kind: 'video', title: 'CatholicTV', available: true, latestLabel: 'Nov 15, 2026', showImageUrl: 'https://i.ytimg.com/vi/vidAlpha111/hqdefault.jpg' }
  ] };
  // The v431 fixture day, for the L5 day-card paint.
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
const paintBible = async () => {
  await ev(() => { podCollapse = { series: null, open: false }; state.podcasts = window.__mkBible(); paintPodcasts(); });
  await sleep(150);
};
const rowH = (key) => ev((k) => {
  var el = document.querySelector('[data-podrow="' + k + '"]');
  return el ? Math.round(el.getBoundingClientRect().height) : -1;
}, key);
const stackTop = () => ev(() => {
  var el = document.querySelector('[data-podrow]');
  if (!el) return -1;
  var vt = view.getBoundingClientRect().top + window.scrollY;
  return Math.round(el.getBoundingClientRect().top + window.scrollY - vt);
});

/* ---------------- L1: heights (4) ---------------- */
{
  await paintBible();
  const s412 = await stackTop();
  const std = await rowH('bible-in-a-year:day-317');
  const nodesc = await rowH('bible-in-a-year:day-319');
  const long = await rowH('bible-in-a-year:day-320');
  await page.setViewportSize({ width: 690, height: 915 });
  await sleep(150);
  const s690 = await stackTop();
  await page.setViewportSize({ width: 412, height: 915 });
  await sleep(120);
  ok(s412 === 399 && s690 === 382,
    'L1: the first episode card\u2019s top stands at 399 @412 / 382 @690 (from 495 / 478 — the Current card\u2019s 96 banked)', JSON.stringify({ s412, s690 }));
  ok(std === 120, 'L1: the standard card measures 120 @412 (from 155 — bank 35)', 'std=' + std);
  ok(nodesc === 78, 'L1: the no-description card measures 78 @412 (from 119 — bank 41)', 'nodesc=' + nodesc);
  ok(long > 0 && long <= 176, 'L1: the long-title card measures \u2264176 @412 (from 175 — it never grows past today\u2019s form)', 'long=' + long);
}

/* ---------------- L2: the form (3) ---------------- */
{
  await paintBible();
  const form = await ev(() => ({
    ctl: document.querySelectorAll('.prow-ctl').length,
    share: document.querySelectorAll('[data-podshare]').length,
    rows: document.querySelectorAll('[data-podrow]').length
  }));
  ok(form.ctl === 0 && form.share === 0 && form.rows === 56,
    'L2: no .prow-ctl and no [data-podshare] stand anywhere in the series DOM (56 rows painted)', JSON.stringify(form));

  const boxes = await ev(() => {
    var row = document.querySelector('[data-podrow="bible-in-a-year:day-317"]');
    var card = row.getBoundingClientRect();
    var q = function (sel) { var el = row.querySelector(sel); if (!el) return null; var r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }; };
    return { cardRight: Math.round(card.right), mark: q('[data-podmark]'), play: q('[data-podplay]'), menu: q('[data-podmenu]') };
  });
  await page.setViewportSize({ width: 690, height: 915 });
  await sleep(150);
  const boxes690 = await ev(() => {
    var row = document.querySelector('[data-podrow="bible-in-a-year:day-317"]');
    var card = row.getBoundingClientRect();
    var q = function (sel) { var el = row.querySelector(sel); if (!el) return null; var r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }; };
    return { cardRight: Math.round(card.right), mark: q('[data-podmark]'), play: q('[data-podplay]'), menu: q('[data-podmenu]') };
  });
  await page.setViewportSize({ width: 412, height: 915 });
  await sleep(120);
  const boxOk = (b) => b.mark && b.play && b.menu
    && b.mark.w === 44 && b.mark.h === 44 && b.play.w === 44 && b.play.h === 44 && b.menu.w === 44 && b.menu.h === 44
    && Math.abs(b.menu.right - (b.cardRight - 10)) <= 1;
  ok(boxOk(boxes) && boxOk(boxes690),
    'L2: the cluster\u2019s three boxes each measure 44\u00d744 with the \u22ee flush at the card\u2019s inner right edge (\u00b11px), at 412 and at 690', JSON.stringify({ boxes, boxes690 }));

  const dlBefore = await ev(() => {
    var el = document.querySelector('[data-podrow="bible-in-a-year:day-318"] [data-poddlstate]');
    return el ? el.style.display : 'missing';
  });
  await ev(async () => {
    var cache = await caches.open('opn-ext-audio-v1');
    await cache.put(offlinePodKey('bible-in-a-year', 'bible-in-a-year:day-318'), new Response('mp3'));
    refreshPodDlStates();
  });
  await sleep(400);
  const dl = await ev(() => {
    var row = document.querySelector('[data-podrow="bible-in-a-year:day-318"]');
    var el = row.querySelector('[data-poddlstate]');
    var meta = row.querySelector('.meta.metarow');
    var txt = meta.querySelector('span');
    var er = el.getBoundingClientRect(), tr = txt.getBoundingClientRect();
    var other = document.querySelector('[data-podrow="bible-in-a-year:day-317"] [data-poddlstate]');
    return { disp: el.style.display, inMeta: el.parentElement === meta, afterText: (txt.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      sameLine: Math.abs((er.top + er.height / 2) - (tr.top + tr.height / 2)) <= 3, otherDisp: other.style.display };
  });
  ok(dlBefore === 'none' && dl.disp !== 'none' && dl.inMeta && dl.afterText && dl.sameLine && dl.otherDisp === 'none',
    'L2: the \u2913 stands hidden at paint and visible after the cache seed + refreshPodDlStates, trailing the meta line in the metarow; an uncached row\u2019s stays hidden', JSON.stringify({ dlBefore, dl }));
}

/* ---------------- L3: the acts (5) ---------------- */
{
  await paintBible();
  await page.click('[data-podrow="bible-in-a-year:day-318"] [data-podplay]');
  await sleep(300);
  const q = await ev(() => ({ len: state.queue.length, first: state.queue.length ? state.queue[0].episodeId : null, idx: state.queueIdx }));
  ok(q.len === 55 && q.first === 'bible-in-a-year:day-318' && q.idx === 0,
    'L3: a row\u2019s disc tap queues the sequence from the tapped entry (55 entries from Day 318 forward, the tapped entry first)', JSON.stringify(q));

  await page.click('[data-podrow="bible-in-a-year:day-317"] [data-podmenu]');
  await sleep(200);
  const menu = await ev(() => [...document.querySelectorAll('.anchmenu .menurow .grow')].map((s) => s.textContent));
  ok(menu.join('|') === 'Share|Download|Mark as listened',
    'L3: the \u22ee opens the menu in standing order (Share · Download, state-matched · Mark as listened)', JSON.stringify(menu));

  await page.click('.anchmenu [data-menuitem="0"]');
  await sleep(200);
  const sheet = await ev(() => {
    var s = document.querySelector('.sharesheet');
    return s ? (s.querySelector('h3') || {}).textContent || '' : '';
  });
  ok(sheet === 'Day 317: Episode title 317',
    'L3: the menu\u2019s Share opens the share sheet for the episode', 'sheet=' + sheet);
  await ev(() => { var s = document.querySelector('.sharesheet'); if (s) s.remove(); });

  await page.click('[data-podrow="bible-in-a-year:day-320"] [data-podmark]');
  await sleep(250);
  const marked = await ev(() => {
    var e = state.podcasts.entries.filter(function (x) { return x.key === 'bible-in-a-year:day-320'; })[0];
    var b = document.querySelector('[data-podrow="bible-in-a-year:day-320"] [data-podmark]');
    var meta = document.querySelector('[data-podrow="bible-in-a-year:day-320"] .meta.metarow > span');
    return { listened: e.listened, on: b.classList.contains('on'), glyph: b.textContent, meta: meta.textContent };
  });
  await page.click('[data-podrow="bible-in-a-year:day-320"] [data-podmark]');
  await sleep(250);
  const unmarked = await ev(() => {
    var e = state.podcasts.entries.filter(function (x) { return x.key === 'bible-in-a-year:day-320'; })[0];
    var b = document.querySelector('[data-podrow="bible-in-a-year:day-320"] [data-podmark]');
    var meta = document.querySelector('[data-podrow="bible-in-a-year:day-320"] .meta.metarow > span');
    return { listened: e.listened, on: b.classList.contains('on'), glyph: b.textContent, meta: meta.textContent };
  });
  ok(marked.listened === true && marked.on && marked.glyph === '\u2713' && marked.meta.includes('Listened ')
    && unmarked.listened === false && !unmarked.on && unmarked.glyph === '\u25cb' && !unmarked.meta.includes('Listened'),
    'L3: the mark toggles both ways (\u25cb \u2192 \u2713 with the listened state and the meta\u2019s Listened date; \u2713 \u2192 \u25cb back) through the standing routes', JSON.stringify({ marked, unmarked }));

  await paintBible();
  await page.click('[data-podcollapse]');
  await sleep(250);
  const open = await ev(() => ({
    rows: document.querySelectorAll('[data-podrow]').length,
    btns: document.querySelectorAll('[data-podcollapse]').length,
    label: (document.querySelector('[data-podcollapse] .meta') || {}).textContent || ''
  }));
  await page.click('[data-podcollapse]');
  await sleep(250);
  const closed = await ev(() => ({
    rows: document.querySelectorAll('[data-podrow]').length,
    label: (document.querySelector('[data-podcollapse] .meta') || {}).textContent || ''
  }));
  ok(open.rows === 372 && open.btns === 1 && open.label === 'Hide' && closed.rows === 56 && closed.label === 'Show',
    'L3: the expander\u2019s Show paints every folded row (372) with Hide at the run\u2019s end, and Hide folds them back (56)', JSON.stringify({ open, closed }));
}

/* ---------------- L4: display rules (3) ---------------- */
{
  await paintBible();
  const bars = await ev(() => {
    var probe = function (k) {
      var row = document.querySelector('[data-podrow="' + k + '"]');
      if (!row) return 'norow';
      var bar = row.querySelector('.podbar');
      if (!bar) return null;
      var fill = bar.querySelector('i');
      return { w: fill ? fill.style.width : '', bottom: Math.round(row.getBoundingClientRect().bottom - bar.getBoundingClientRect().bottom) };
    };
    return { cur: probe('bible-in-a-year:day-317'), part: probe('bible-in-a-year:day-318'),
      nodesc: probe('bible-in-a-year:day-319'), nodur: probe('bible-in-a-year:day-321') };
  });
  ok(bars.cur === null && bars.nodesc === null && bars.nodur === null
    && bars.part && bars.part.w === '24.9%' && bars.part.bottom === 0,
    'L4: the partway bar renders on the unlistened partway entry only (never on the current entry at zero position, a no-position entry, or the no-duration entry — v395\u2019s rule) at the card\u2019s bottom edge', JSON.stringify(bars));

  const cur4 = await ev(() => {
    var stray = [...document.querySelectorAll('.card:not(.trow) .meta')].some((m) => m.textContent === 'Current episode');
    var meta = document.querySelector('[data-podrow="bible-in-a-year:day-317"] .meta.metarow > span');
    return { stray, lead: meta ? meta.textContent : '' };
  });
  ok(!cur4.stray && cur4.lead.indexOf('Current episode \u00b7 Day 317 \u00b7 26:49') === 0,
    'L4: the current row carries its "Current episode \u00b7 " meta lead and no separate Current card stands in the DOM', JSON.stringify(cur4));

  const col = await ev(() => {
    var b = document.querySelector('.podcollapse');
    return { h: b ? Math.round(b.getBoundingClientRect().height) : -1, text: b ? b.textContent : '' };
  });
  ok(col.h === 46 && col.text.includes('316 earlier episodes listened') && col.text.includes('Show'),
    'L4: the collapse row stands at 46 with its standing text', JSON.stringify(col));
}

/* ---------------- L5: nothing else moved (4) ---------------- */
{
  await paintBible();
  const head = await ev(() => {
    var hd = document.querySelector('.podpage-head');
    var cover = document.querySelector('.podpage-head .blockcover');
    var desc = document.querySelector('.podpage-head p.sub');
    return { h: Math.round(hd.getBoundingClientRect().height), coverH: Math.round(cover.getBoundingClientRect().height),
      desc: desc ? desc.textContent : '', showDesc: state.podcasts.showDesc };
  });
  await page.setViewportSize({ width: 690, height: 915 });
  await sleep(150);
  const head690 = await ev(() => Math.round(document.querySelector('.podpage-head').getBoundingClientRect().height));
  await page.setViewportSize({ width: 412, height: 915 });
  await sleep(120);
  ok(head.h === 237 && head690 === 220 && head.coverH === 120 && head.desc === head.showDesc,
    'L5: the page head measures 237 @412 / 220 @690 with the 120 cover and the full show description standing (F-433-4)', JSON.stringify({ h: head.h, head690, coverH: head.coverH }));

  await ev(() => { state.podcastsIndex = window.__podIndex; paintPodcastsIndex(); });
  const idx = await ev(() => {
    var c = document.querySelector('[data-podseries="bible-in-a-year"]');
    return { h: c ? Math.round(c.getBoundingClientRect().height) : -1,
      meta: c && c.querySelector('.meta') ? c.querySelector('.meta').textContent : '' };
  });
  ok(idx.h === 70 && idx.meta === '316 of 372 listened \u00b7 Current: Day 317',
    'L5: the index rows measure 70 in their base form', JSON.stringify(idx));

  await ev(() => { state.podcasts = window.__podSeries['catholictv']; paintPodSeriesPage(); });
  await sleep(150);
  const vid = await ev(() => {
    var vt = view.getBoundingClientRect().top + window.scrollY;
    var first = document.querySelector('[data-podvideo]');
    var act = document.querySelector('[data-podfullpage]');
    return { headH: Math.round(document.querySelector('.podpage-head').getBoundingClientRect().height),
      firstTop: first ? Math.round(first.getBoundingClientRect().top + window.scrollY - vt) : -1,
      cardH: first ? Math.round(first.getBoundingClientRect().height) : -1,
      rows: document.querySelectorAll('[data-podvideo]').length,
      act: act ? act.textContent : '' };
  });
  const watch = await ev(() => {
    var v = window.__podSeries['catholictv'].videos[0];
    paintPodWatch(v);
    return { title: view.textContent.includes('Catholic Mass Today'), frame: !!view.querySelector('iframe, .watchframe, video, img') || view.innerHTML.length > 200 };
  });
  ok(vid.headH === 174 && vid.firstTop === 346 && vid.cardH === 70 && vid.rows === 2 && vid.act === 'Full page on YouTube' && watch.title,
    'L5: the video page stands as base (head 174 · the v436 full-page act standing · first card top 346 · cards 70) and the watch page paints as base', JSON.stringify({ vid, watch }));

  await ev(() => {
    state.dayPayload = window.__fixture;
    state.dayDescs = window.__descs;
    state.prayersView = { kind: 'home' };
    paintListenHome(window.__fixture);
    wirePrayersView(window.__fixture);
  });
  await sleep(150);
  const day = await ev(() => {
    var card = document.querySelector('[data-card="m1"]');
    return { ctl: document.querySelectorAll('#home-body .prow-ctl, .card .prow-ctl').length,
      cluster: card ? !!card.querySelector('.titlerow .prow-cluster') : false };
  });
  ok(day.ctl === 0 && day.cluster,
    'L5: a day-card fixture stands in v424\u2019s settled form (its cluster in its title line; no .prow-ctl returns on either surface)', JSON.stringify(day));
}

/* ---------------- L6: density (1) ---------------- */
{
  await paintBible();
  const dens = await ev(() => {
    var vt = view.getBoundingClientRect().top + window.scrollY;
    var rows = [...document.querySelectorAll('[data-podrow]')];
    if (!rows.length) return -1;
    var ft = rows[0].getBoundingClientRect().top + window.scrollY - vt;
    var n = 0;
    rows.forEach(function (r) {
      var b = r.getBoundingClientRect();
      if (Math.round(b.top + window.scrollY - vt) + Math.round(b.height) - ft <= 915) n++;
    });
    return n;
  });
  ok(dens === 7, 'L6: 7 episode cards stand fully in 915px from the first card\u2019s top @412, against today\u2019s measured 5', 'density=' + dens);
}

console.log('note - pageerrors: ' + pageErrors.length);
console.log('harness-v433: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) console.log('failures: ' + failures.join(' | '));
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
