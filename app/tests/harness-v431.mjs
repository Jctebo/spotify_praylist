// harness-v431 — the Prayers home's top box compresses
// further (§1/§2 of the v431 release document; John's words,
// 2026-11-14 22:09–22:11 CT: "Further compression of prayer
// screen into this part of the box. Shorten all text" · "Get
// rid of play everything instead" · "Shorten date" · "Simple
// continue button and a sort button with an icon instead of
// the word sort to save space"). Client-only delta: client.ts
// (paintListenHome's .headrow + the shortHomeDate derivation ·
// paintContinue's settled emission + the #continue-all
// retirement · the Sort icon button) + ui.ts APP_CSS (the two
// scoped .headrow rules). index.ts byte-untouched (F-431-1:
// the date shortens home-only, client-side; prayerDateLabel
// and every other surface keep the long form).
// Legs per Plan §2.8 = 25: S statics (5) · L1 heights (3) ·
// L2 the date (3) · L3 Continue (5) · L4 Sort (3) · L5 search
// + chips (3) · L6 nothing else moved (3). Behavior legs run
// in headless Chromium on the v413/v425 extraction mold (real
// SHELL_HTML + APP_CSS, class="view" page, the v413 fixture
// day with the TRUE long dateLabel), at 412px and 690px.
// Seams stubbed, named: the fetch seam (the mold's standing
// stub) · startQueue, the playback sink only, for L3's tap
// leg (buildContinueQueue + the merge/carry run real) · the
// api() seam for L6's Examination paint (the v428 mold
// practice — renderExaminationContent runs verbatim).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const APP = path.resolve(process.cwd(), 'app');
const WT = path.resolve(APP, '..');
if (!WT.includes('.worktrees')) { console.error('HARD GUARD: harness-v431 runs only inside a release worktree'); process.exit(2); }
const SRC = path.join(APP, 'worker/src');
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const I_SRC = readFileSync(SRC + '/index.ts', 'utf8');
const BASE = '2051a6a916798fcd7782cdde83f6458de01bcb59';
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

/* ---------------- S: statics (5) ---------------- */
{
  const plh = seg(C_SRC, 'function paintListenHome', 'function homeBodyHtml');
  ok(plh.includes('class="row headrow"><h1 class="screen grow">Prayers</h1><p class="sub">')
    && plh.includes('esc(shortHomeDate(day))')
    && (plh.match(/class="row headrow"/g) || []).length === 1
    && !plh.includes('day.dateLabel'),
    'S1: paintListenHome emits ONE .row.headrow holding h1.screen then p.sub (the short date via shortHomeDate) — it no longer emits day.dateLabel');

  const idxDiff = execFileSync('git', ['-C', WT, 'diff', '--name-only', BASE, '--', 'app/worker/src/index.ts'], { encoding: 'utf8' }).trim();
  const helper = seg(C_SRC, 'function shortHomeDate', 'function paintListenHome');
  ok(idxDiff === ''
    && (I_SRC.match(/dateLabel: prayerDateLabel\(/g) || []).length === 3
    && helper.includes("timeZone: 'UTC'") && helper.includes("weekday: 'short'") && helper.includes("month: 'short'")
    && helper.includes('day.dateLabel'),
    'S2 (F-431-1): index.ts byte-untouched, prayerDateLabel stands at all three payload seats; the client derivation stands (UTC-noon Intl, short components) with its day.dateLabel fallback');

  const frag = (src) => { const a = src.indexOf('<span class="meta grow" id="sort-name">'); return src.slice(a, src.indexOf('</span>', a) + 7); };
  ok(C_SRC.includes('id="sort-btn" aria-label="Sort">\u2191\u2193</button>')
    && !C_SRC.includes('id="sort-btn">Sort</button>')
    && frag(C_SRC) === frag(B_SRC) && frag(C_SRC).includes('Day order') && frag(C_SRC).includes('Manual order'),
    'S3: #sort-btn carries \u2191\u2193 + aria-label="Sort" and no word text; the #sort-name emission is byte-identical to base');

  const pc = (src) => seg(src, 'function paintContinue()', 'function ownFetchAudio');
  const gate = (src) => src.slice(src.indexOf('function paintContinue()'), src.indexOf('slot.innerHTML'));
  const listener = (src, id, nextAnchor) => { const a = src.indexOf("document.getElementById('" + id + "')"); return src.slice(a, src.indexOf(nextAnchor, a)); };
  const pcBuild = pc(C_SRC);
  ok(!C_SRC.includes('continue-all')
    && !pcBuild.includes('<h3>')
    && pcBuild.includes("'<div class=\"meta\">' + esc(blockLabel) + ' \u00b7 ' + esc(named.title) + '</div>'")
    && pcBuild.includes("' heard today \u00b7 <a href=\"#\" id=\"continue-queue\">See queue</a></div></div>'")
    && gate(C_SRC) === gate(B_SRC)
    && listener(C_SRC, 'continue-btn', "document.getElementById('continue-queue')") === listener(B_SRC, 'continue-btn', "document.getElementById('continue-all')")
    && listener(C_SRC, 'continue-queue', 'if (resumeDesc') === listener(B_SRC, 'continue-queue', 'if (resumeDesc'),
    'S4: paintContinue — no #continue-all emission or listener anywhere; the settled two-meta form stands; the gate/merge/restoredQueue code and the #continue-btn + #continue-queue listeners are byte-identical to base');

  const uiDiff = execFileSync('git', ['-C', WT, 'diff', BASE, '--', 'app/worker/src/ui.ts'], { encoding: 'utf8' });
  const added = uiDiff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
  const removed = uiDiff.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---'));
  ok(U_SRC.includes('ora-pro-nobis-v428-1') && !U_SRC.includes('ora-pro-nobis-v431-1')
    && !/#1DB954|#1ed760/i.test(C_SRC + U_SRC)
    && JSON.stringify(added) === JSON.stringify(['.headrow { margin:2px 0 12px; }', '.headrow h1.screen, .headrow .sub { margin:0; }'])
    && removed.length === 0,
    'S5: limits — the pin stands at ora-pro-nobis-v428-1 (Ship moves it); no Spotify green; the ui.ts delta is the two .headrow rules only');
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
  if (String(path).indexOf('/api/player/feed-audio') === 0) {
    return Promise.resolve(new Response(new Blob(['mp3'], { type: 'audio/mpeg' }), { status: 200 }));
  }
  return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true }); } });
};
function extFetchText(url) { return Promise.reject(new Error('offline')); }
URL.createObjectURL = function () { return 'blob:fake'; };
URL.revokeObjectURL = function () {};
</` + `script>
<script>
var state = { tab: 'prayers', block: null, playingKey: null, playingUrl: null, queue: [], queueIdx: -1, current: null,
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

/* ---------------- fixture: the v413 fixture day, TRUE long dateLabel ---------------- */
await ev(() => {
  localStorage.clear();
  window.__fixture = {
    date: '2026-11-14', dateLabel: 'Saturday, November 14, 2026', intentionsLine: '',
    blocks: [
      { block: 'Morning', label: 'Morning Prayers', caption: 'Praylists', spotifyUrl: 'https://open.spotify.com/playlist/morning', tracks: [
        { episodeId: 'seg-int-morning', title: 'Intentions', kind: 'segment', available: true, url: 'https://x/int.mp3', durationS: 60 },
        { episodeId: 'm1', title: 'Invitatory', kind: 'episode', available: true, url: '/api/player/feed-audio?m1', durationS: 300 },
        { episodeId: 'm2', title: 'Daily Verse', kind: 'external', source: 'VerseCast', available: true, url: '/api/player/feed-audio?m2', streamUrl: 'https://x/m2.mp3', durationS: 120, imageUrl: 'https://img.example/m2.jpg', descText: 'A short reflection on the day\u2019s verse.', spotifyUrl: 'https://open.spotify.com/episode/m2' }
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
    episodes: [{ episodeId: 'pod-ep-1', title: 'Podcast Episode', kind: 'episode', available: true, url: 'https://x/p1.mp3', durationS: 600 }]
  };
  window.__descs = [
    { episodeId: 'seg-int-morning', kind: 'segment', title: 'Intentions', block: 'Morning', url: 'https://x/int.mp3', available: true, durationS: 60 },
    { episodeId: 'm1', kind: 'episode', title: 'Invitatory', block: 'Morning', url: '/api/player/feed-audio?m1', available: true, durationS: 300 },
    { episodeId: 'm2', kind: 'episode', title: 'Daily Verse', block: 'Morning', url: '/api/player/feed-audio?m2', available: true, durationS: 120, source: 'VerseCast', imageUrl: 'https://img.example/m2.jpg', descText: 'A short reflection.', spotifyUrl: 'https://open.spotify.com/episode/m2' },
    { episodeId: 'n1', kind: 'episode', title: 'Night Prayer', block: 'Night', url: '/api/player/feed-audio?n1', available: true, durationS: 0 }
  ];
  state.dayPayload = window.__fixture;
  state.dayDescs = window.__descs;
  state.prayersView = { kind: 'home' };
  paintListenHome(window.__fixture);
});

const headGeom = () => ev(() => {
  var vt = view.getBoundingClientRect().top + window.scrollY;
  var hr = document.querySelector('.headrow');
  return {
    headH: hr ? hr.offsetHeight : -1,
    bodyTop: Math.round(document.getElementById('home-body').getBoundingClientRect().top + window.scrollY - vt),
    sub: (document.querySelector('.headrow .sub') || {}).textContent || '',
    h1: (document.querySelector('.headrow h1.screen') || {}).textContent || ''
  };
});
const cards = () => ev(() => [...document.querySelectorAll('#home-body .blockcard')].map((c) => c.getAttribute('data-openblock')));

/* ---------------- L1: heights (3) ---------------- */
{
  const g412 = await headGeom();
  await page.setViewportSize({ width: 690, height: 915 });
  await sleep(120);
  const g690 = await headGeom();
  await page.setViewportSize({ width: 412, height: 915 });
  await sleep(120);
  ok(g412.headH === 26 && g690.headH === 26,
    'L1 (leg 1): the merged headrow measures 26px at 412 and at 690 (one line at every width)', JSON.stringify({ h412: g412.headH, h690: g690.headH }));
  ok(g412.bodyTop === 164,
    'L1 (leg 1): #home-body\u2019s top stands at 164 from the view\u2019s top \u2014 exactly 19px above the standing 183', 'bodyTop=' + g412.bodyTop);

  // The Continue card standing (§1.4's own long example target).
  await ev(() => {
    window.__fixtureC = {
      date: '2026-11-14', dateLabel: 'Saturday, November 14, 2026', intentionsLine: '',
      blocks: [
        { block: 'Morning', label: 'Morning', caption: 'Praylists', tracks: [
          { episodeId: 'seg-int-morning', title: 'Intentions', kind: 'segment', available: true, url: 'https://x/int.mp3', durationS: 60 },
          { episodeId: 'm1', title: 'Invitatory', kind: 'episode', available: true, url: '/api/player/feed-audio?m1', durationS: 300 },
          { episodeId: 'm2', title: 'Marian Antiphon - Angelus', kind: 'episode', available: true, url: '/api/player/feed-audio?m2', durationS: 120 }
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
    window.__descsC = [
      { episodeId: 'seg-int-morning', kind: 'segment', title: 'Intentions', block: 'Morning', url: 'https://x/int.mp3', available: true, durationS: 60 },
      { episodeId: 'm1', kind: 'episode', title: 'Invitatory', block: 'Morning', url: '/api/player/feed-audio?m1', available: true, durationS: 300 },
      { episodeId: 'm2', kind: 'episode', title: 'Marian Antiphon - Angelus', block: 'Morning', url: '/api/player/feed-audio?m2', available: true, durationS: 120 },
      { episodeId: 'n1', kind: 'episode', title: 'Night Prayer', block: 'Night', url: '/api/player/feed-audio?n1', available: true, durationS: 0 }
    ];
    state.dayPayload = window.__fixtureC;
    state.dayDescs = window.__descsC;
    state.playedCache = { 'seg-int-morning': { '2026-11-14': true }, 'm1': { '2026-11-14': true } };
    state.restoredQueue = false;
    paintListenHome(window.__fixtureC);
    paintContinue();
  });
  const cg = await ev(() => {
    var vt = view.getBoundingClientRect().top + window.scrollY;
    var card = document.querySelector('#continue-slot .card');
    var grid = document.querySelector('#home-body .blockgrid');
    return {
      cardH: card ? card.offsetHeight : -1,
      gridTop: grid ? Math.round(grid.getBoundingClientRect().top + window.scrollY - vt) : -1
    };
  });
  ok(cg.cardH === 70 && cg.gridTop === 244,
    'L1 (leg 1): with the Continue card standing (the long target unwrapped), the card measures 70 and the grid\u2019s top stands at 244 \u2014 exactly 73px above the standing 317', JSON.stringify(cg));
}

/* ---------------- L2: the date (3) ---------------- */
{
  await ev(() => { state.dayPayload = window.__fixture; state.dayDescs = window.__descs; state.playedCache = {}; paintListenHome(window.__fixture); });
  const g = await headGeom();
  ok(g.sub === 'Sat, Nov 14, 2026' && g.h1 === 'Prayers',
    'L2 (leg 2): the home paints the short date "Sat, Nov 14, 2026" beside the standing title', JSON.stringify(g));

  const expected = {};
  for (const ds of ['2026-11-14', '2026-11-15', '2026-03-08', '2026-01-01', '2026-12-31']) {
    const [y, m, d] = ds.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12));
    const parts = {};
    for (const p of new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).formatToParts(dt)) parts[p.type] = p.value;
    expected[ds] = parts.weekday.slice(0, 3) + ', ' + parts.month.slice(0, 3) + ' ' + parts.day + ', ' + parts.year;
  }
  const derived = await ev((exp) => {
    const out = {};
    for (const ds of Object.keys(exp)) out[ds] = shortHomeDate({ date: ds, dateLabel: 'LONG-FORM-STANDIN' });
    return out;
  }, expected);
  ok(JSON.stringify(derived) === JSON.stringify(expected),
    'L2 (leg 2): the UTC-noon derivation returns the server\u2019s America/Chicago calendar fields in short form across the date set (a Sunday \u00b7 the 2026-03-08 DST day \u00b7 year boundaries)', JSON.stringify({ derived, expected }));

  const fb = await ev(() => {
    var f = JSON.parse(JSON.stringify(window.__fixture));
    delete f.date;
    paintListenHome(f);
    return (document.querySelector('.headrow .sub') || {}).textContent || '';
  });
  ok(fb === 'Saturday, November 14, 2026',
    'L2 (leg 2): with no `date` in the payload, the home falls back to the standing long dateLabel \u2014 never a blank', fb);
  await ev(() => { paintListenHome(window.__fixture); });
}

/* ---------------- L3: Continue (5) ---------------- */
{
  await ev(() => {
    state.dayPayload = window.__fixtureC;
    state.dayDescs = window.__descsC;
    state.playedCache = { 'seg-int-morning': { '2026-11-14': true }, 'm1': { '2026-11-14': true } };
    state.restoredQueue = false;
    localStorage.setItem('opn-resume-v312', JSON.stringify({ date: '2026-11-14', episodeId: 'm2', positionS: 42 }));
    window.__started = null; window.__pendingAtStart = null;
    startQueue = function (q) {
      window.__started = q.map(function (d) { return d.episodeId; });
      window.__pendingAtStart = state.pendingResume ? { episodeId: state.pendingResume.episodeId, positionS: state.pendingResume.positionS } : null;
    };
    paintListenHome(window.__fixtureC);
    paintContinue();
  });
  const form = await ev(() => {
    var slot = document.getElementById('continue-slot');
    return {
      card: !!slot.querySelector('.card'),
      metas: slot.querySelectorAll('.meta').length,
      h3: !!slot.querySelector('h3'),
      all: !!document.getElementById('continue-all'),
      btn: !!document.getElementById('continue-btn'),
      queue: !!document.getElementById('continue-queue')
    };
  });
  ok(form.card && form.metas === 2 && !form.h3 && !form.all && form.btn && form.queue,
    'L3 (leg 3): the card stands in the settled form \u2014 two meta lines, no h3, no #continue-all in the DOM, the Continue button + See queue standing', JSON.stringify(form));

  const texts = await ev(() => {
    var metas = document.querySelectorAll('#continue-slot .meta');
    return { l1: metas[0].textContent, l2: metas[1].textContent, link: (document.getElementById('continue-queue') || {}).textContent || '' };
  });
  ok(texts.l1 === 'Morning \u00b7 Marian Antiphon - Angelus' && texts.l2.indexOf('2 of 4 heard today') === 0 && texts.link === 'See queue',
    'L3 (legs 3\u20135): line 1 names the resume target whole; line 2 reads "2 of 4 heard today" verbatim with See queue seated at its end', JSON.stringify(texts));

  await page.click('#continue-btn');
  await sleep(120);
  const started = await ev(() => ({ started: window.__started, pending: window.__pendingAtStart }));
  ok(JSON.stringify(started.started) === JSON.stringify(['m2', 'n1'])
    && started.pending && started.pending.episodeId === 'm2' && started.pending.positionS === 42,
    'L3 (leg 3): a Continue tap starts the continue build with the position carry intact \u2014 the resume record (at the first unplayed track) rides state.pendingResume into the start', JSON.stringify(started));

  await page.click('#continue-queue');
  await sleep(150);
  const prev = await ev(() => ({
    ids: (state.previewQueue || []).map(function (d) { return d.episodeId; }),
    sheet: !!document.querySelector('.np-sheet.np-preview'),
    rows: document.querySelectorAll('#np-queue .librow, #np-queue > *').length
  }));
  ok(JSON.stringify(prev.ids) === JSON.stringify(['m2', 'n1']) && prev.sheet && prev.rows >= 2,
    'L3 (leg 5): See queue opens the queue preview of the same continue build', JSON.stringify(prev));
  await ev(() => { document.querySelectorAll('.np-sheet').forEach((x) => x.remove()); state.previewQueue = null; state.queuePreviewIdx = -1; });

  const gates = await ev(() => {
    var slot = document.getElementById('continue-slot');
    var out = {};
    localStorage.removeItem('opn-resume-v312');
    state.playedCache = {};
    paintContinue();
    out.nothingPlayed = slot.innerHTML === '';
    state.playedCache = { 'seg-int-morning': { '2026-11-14': true }, 'm1': { '2026-11-14': true }, 'm2': { '2026-11-14': true }, 'n1': { '2026-11-14': true } };
    paintContinue();
    out.fullyPlayed = slot.innerHTML === '';
    state.playedCache = { 'seg-int-morning': { '2026-11-14': true }, 'm1': { '2026-11-14': true } };
    state.restoredQueue = true;
    paintContinue();
    out.restored = slot.innerHTML === '';
    state.restoredQueue = false;
    paintContinue();
    return out;
  });
  ok(gates.nothingPlayed && gates.fullyPlayed && gates.restored,
    'L3 (leg 3): the gate stands \u2014 nothing played (no record) \u2192 no card \u00b7 fully played \u2192 no card \u00b7 a restored queue standing \u2192 the slot stands empty', JSON.stringify(gates));
}

/* ---------------- L4: Sort (3) ---------------- */
{
  await ev(() => { state.dayPayload = window.__fixture; state.dayDescs = window.__descs; state.playedCache = {}; paintListenHome(window.__fixture); });
  const dayLabel = await ev(() => (document.getElementById('sort-name') || {}).textContent || '');
  await ev(() => {
    window.__fixture2 = JSON.parse(JSON.stringify(window.__fixture));
    window.__fixture2.blockOrder = ['Night', 'Morning'];
    state.dayPayload = window.__fixture2;
    paintListenHome(window.__fixture2);
  });
  const manualLabel = await ev(() => (document.getElementById('sort-name') || {}).textContent || '');
  ok(dayLabel === 'Day order' && manualLabel === 'Manual order',
    'L4 (leg 6): the order label still names the standing order truthfully \u2014 "Day order" plain, "Manual order" with a stored order', dayLabel + ' / ' + manualLabel);

  await ev(() => { state.dayPayload = window.__fixture; paintListenHome(window.__fixture); });
  const btn = await ev(() => {
    var b = document.getElementById('sort-btn');
    var r = b.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), text: b.textContent, aria: b.getAttribute('aria-label'), cls: b.className };
  });
  ok(btn.w === 44 && btn.h === 44 && btn.text === '\u2191\u2193' && btn.aria === 'Sort' && btn.cls === 'btn ghost small',
    'L4 (leg 6): the Sort button measures 44 \u00d7 44, icon-only (\u2191\u2193) in its standing dress, aria-label="Sort" keeping the word', JSON.stringify(btn));

  await page.click('#sort-btn');
  await sleep(200);
  const opened = await ev(() => ({ sheet: !!document.querySelector('.ordersheet'), moves: document.querySelectorAll('.ordersheet [data-ordup]').length + document.querySelectorAll('.ordersheet [data-orddown]').length }));
  await page.click('.ordersheet [data-orddown="0"]');
  await sleep(250);
  const afterMove = await cards();
  ok(opened.sheet && opened.moves === 18 && afterMove[0] === 'Midmorning' && afterMove[1] === 'Morning',
    'L4 (leg 6): the icon opens the standing order editor, and a move in the editor repaints the grid in the new order', JSON.stringify({ opened, first: afterMove.slice(0, 2) }));
  await ev(() => { document.querySelectorAll('.sheet').forEach((x) => x.remove()); localStorage.removeItem('opn-block-order-v413'); delete window.__fixture.blockOrder; state.dayPayload = window.__fixture; paintListenHome(window.__fixture); });
}

/* ---------------- L5: search + chips (3) ---------------- */
{
  await ev(() => { window.__node = document.getElementById('day-search'); window.__node.focus(); });
  await page.keyboard.type('Invitatory');
  await sleep(150);
  const typed = await ev(() => ({
    hit: (document.getElementById('home-body').textContent || '').includes('Invitatory'),
    results: !!document.querySelector('#home-body .sectionhead')
  }));
  ok(typed.hit && typed.results,
    'L5 (leg 7): typing filters the body in place (the Invitatory hit stands in the results paint)', JSON.stringify(typed));

  const surviveTap = await ev(() => {
    document.querySelector('[data-homefilter="novenas"]').click();
    return {
      sameNode: window.__node === document.getElementById('day-search'),
      focused: document.activeElement === window.__node,
      value: document.getElementById('day-search').value,
      filter: state.homeFilter
    };
  });
  await sleep(120);
  ok(surviveTap.sameNode && surviveTap.focused && surviveTap.value === 'Invitatory' && surviveTap.filter === 'novenas',
    'L5 (leg 7): the input node, focus, and value survive a chip tap with text standing (v425\u2019s discipline, under the settled head)', JSON.stringify(surviveTap));
  await ev(() => { document.querySelector('[data-homefilter="novenas"]').click(); });
  await sleep(120);

  await page.click('#day-search');
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await sleep(150);
  const restored = await ev(() => ({
    grid: !!document.querySelector('#home-body .blockgrid'),
    headrow: !!document.querySelector('.headrow'),
    cont: !!document.getElementById('continue-slot'),
    cards: document.querySelectorAll('#home-body .blockcard').length,
    value: document.getElementById('day-search').value
  }));
  ok(restored.grid && restored.headrow && restored.cont && restored.cards === 10 && restored.value === '',
    'L5 (leg 7): clearing the query restores the standing body under the settled head (grid + Continue slot + headrow)', JSON.stringify(restored));
}

/* ---------------- L6: nothing else moved (3) ---------------- */
{
  const cs = await cards();
  ok(cs.join(',') === 'Morning,Midmorning,Midday,Afternoon,Evening,Night,Mass and Homilies,Novenas,The AI Signal,__episodes',
    'L6 (leg 8): the grid\u2019s cards and their order stand unchanged (nine blocks in contract order, the episodes card last)', cs.join(','));

  const below = await ev(() => {
    var pa = document.getElementById('play-all');
    var off = document.getElementById('offline-dl-btn');
    var body = document.getElementById('home-body');
    var order = pa && off && body
      ? (body.compareDocumentPosition(pa) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 && (pa.compareDocumentPosition(off) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      : false;
    var offCard = off ? off.closest('.card') : null;
    return { pa: !!pa, off: !!off, order, offText: offCard ? offCard.textContent.includes('Download for offline') : false };
  });
  ok(below.pa && below.off && below.order && below.offText,
    'L6 (leg 8): Play All and the offline line stand in their standing dress below the region, untouched (v432 owns the Podcasts seat, not this one)', JSON.stringify(below));

  const exam = await ev(async () => {
    window.__realApi = api;
    api = function (p) {
      if (p === '/api/exam/today') return Promise.resolve({
        ok: true, date: '2026-11-14', dateLabel: 'Saturday, November 14, 2026',
        run: { state: 'open' },
        categories: ['Commandment X'], focusCategory: 'Commandment X',
        prompts: [{ id: 1, category: 'Commandment X', text: 'Have I kept holy the feasts of the Church?' }],
        entries: []
      });
      return Promise.reject(new Error('no seam: ' + p));
    };
    state.deepIdx = 0;
    renderExaminationContent();
    await new Promise((r) => setTimeout(r, 200));
    var head = document.querySelector('.row .sub');
    var r = { sub: head ? head.textContent : '', h1: (document.querySelector('h1.screen') || {}).textContent || '' };
    api = window.__realApi;
    return r;
  });
  ok(exam.sub === 'Saturday, November 14, 2026' && exam.h1 === 'Tonight\u2019s examination',
    'L6 (leg 8, F-431-1\u2019s consequence): the Examination head still paints the LONG date from the exam payload \u2014 only the home shortened', JSON.stringify(exam));
}

console.log('note - pageerrors: ' + pageErrors.length);
console.log('harness-v431: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) console.log('failures: ' + failures.join(' | '));
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
