// harness-v425 — the Prayers home head compresses by a
// row (§1/§2 of the v425 release document; John's order,
// 2026-11-14 20:57 CT). Client-only delta: client.ts
// paintListenHome (the .searchrow wrapper + the chip
// handler's in-place re-seat) + ui.ts APP_CSS (four scoped
// .searchrow rules). Legs run in headless Chromium on the
// v413/v424 extraction mold (real SHELL_HTML + APP_CSS,
// the v413 fixture day), at 412px and 690px. Per F-425-8
// the mold's main element carries class="view" (the real
// SHELL), so width legs read the phone's true inner widths
// (388 at 412 · 616 at 690); head heights are measured
// from the view's top, as §2.2's mold measured them.
// Legs map to §2.8:
//   S  statics (5) · L1 one row shorter (3) · L2 chips in
//   the line (5) · L3 search stands (4) · L4 the sort row
//   (2) · L5 nothing else moved (3) = 22 legs.
// The placeholder deviation (§2.4) is asserted as settled:
// the visible placeholder reads "Search"; the aria-label
// keeps "Search today's prayers". Review rules at F-425-7.
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
const seg = (src, a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));

/* ---------------- S: statics (5) ---------------- */
{
  const plh = seg(C_SRC, 'function paintListenHome', 'function homeBodyHtml');
  ok(plh.includes('class="searchrow"><div class="searchpill"')
    && plh.indexOf('class="searchrow"') < plh.indexOf('id="home-chips"')
    && (plh.match(/id="home-chips"/g) || []).length === 1
    && plh.includes('Downloaded</button></div></div>'),
    'S1: paintListenHome emits ONE .searchrow holding .searchpill then .chips#home-chips (closed after the chips) — no standalone chips-row emission');
  ok(plh.includes('placeholder="Search"') && !plh.includes('placeholder="Search today')
    && plh.includes('aria-label="Search today&rsquo;s prayers"'),
    'S2 (§2.4 deviation): the visible placeholder reads "Search"; the aria-label keeps "Search today\u2019s prayers"');
  ok(APP_CSS.includes('.searchrow { display:flex; gap:8px; align-items:center; margin:0 0 12px; }')
    && APP_CSS.includes('.searchrow .searchpill { flex:1 1 auto; min-width:0; margin:0; }')
    && APP_CSS.includes('.searchrow .chips { flex:0 0 auto; flex-wrap:nowrap; margin:0; }')
    && APP_CSS.includes('.searchrow .chip { padding:7px 10px; }')
    && APP_CSS.includes('.searchpill { margin:0 0 12px; position:relative; }')
    && APP_CSS.includes('.chips { display:flex; flex-wrap:wrap; gap:6px; margin:0 0 12px; }')
    && APP_CSS.includes('.chip { font-family:var(--sans); font-size:14px; padding:7px 14px; min-height:44px; border-radius:999px; border:1px solid var(--line); background:var(--card); color:var(--ink); cursor:pointer; }'),
    'S3: the four .searchrow rules stand scoped; the global .searchpill / .chips / .chip rules stand byte-identical to base');
  const handler = seg(C_SRC, "view.querySelectorAll('[data-homefilter]')", "var search = document.getElementById('day-search');");
  ok(!handler.includes('paintListenHome(day)') && handler.includes("classList.toggle('active'")
    && handler.includes("setAttribute('aria-pressed'") && handler.includes('homeBodyHtml(day)'),
    'S4 (§2.5): the chip handler carries no paintListenHome call — it toggles the dress in place and repaints #home-body only');
  ok(U_SRC.includes('ora-pro-nobis-v424-1') && !U_SRC.includes('ora-pro-nobis-v425-1')
    && !/#1DB954|#1ed760/i.test(C_SRC + U_SRC)
    && !I_SRC.includes('searchrow'),
    'S5: limits — the pin stands at ora-pro-nobis-v424-1 (Ship moves it); no Spotify green; no index.ts delta');
}

/* ---------------- client extraction (v413/v424 mold) ---------------- */
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
  rate: 1, errWaitKey: null, errWaitN: 0, startRetryKey: null, lastStartAt: 0,
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
page.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:' + PORT + '/');
const ev = (fn, arg) => page.evaluate(fn, arg);

/* ---------------- fixture: the v413 fixture day ---------------- */
await ev(() => {
  localStorage.clear();
  window.__fixture = {
    date: '2026-11-14', dateLabel: 'Saturday, November 14', intentionsLine: '',
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

const geom = () => ev(() => {
  var row = document.querySelector('.searchrow');
  var rr = row.getBoundingClientRect();
  var vt = view.getBoundingClientRect().top + window.scrollY;
  return {
    rowH: row.offsetHeight,
    pillW: Math.round(document.querySelector('.searchrow .searchpill').getBoundingClientRect().width),
    chipsW: Math.round(document.querySelector('.searchrow .chips').getBoundingClientRect().width),
    chipRects: [...document.querySelectorAll('.searchrow .chip')].map((c) => { var r = c.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), h: c.offsetHeight }; }),
    rowL: Math.round(rr.left), rowR: Math.round(rr.right),
    bodyTop: Math.round(document.getElementById('home-body').getBoundingClientRect().top + window.scrollY - vt)
  };
});
const cards = () => ev(() => [...document.querySelectorAll('#home-body .blockcard')].map((c) => c.getAttribute('data-openblock')));

/* ---------------- L1: one row shorter (3) ---------------- */
{
  const g412 = await geom();
  await page.setViewportSize({ width: 690, height: 915 });
  await sleep(120);
  const g690 = await geom();
  await page.setViewportSize({ width: 412, height: 915 });
  await sleep(120);
  ok(g412.rowH === 44 && g690.rowH === 44,
    'L1 (leg 1): the merged line measures 44px at 412 and at 690', JSON.stringify({ h412: g412.rowH, h690: g690.rowH }));
  ok(g412.bodyTop === 183,
    'L1 (leg 1): #home-body\u2019s top stands at 183 from the view\u2019s top \u2014 exactly 56px above its standing seat (239)', 'bodyTop=' + g412.bodyTop);
  const cs = await cards();
  ok(cs.join(',') === 'Morning,Midmorning,Midday,Afternoon,Evening,Night,Mass and Homilies,Novenas,The AI Signal,__episodes',
    'L1 (leg 1): the grid\u2019s cards and their order stand unchanged (nine blocks in contract order, the episodes card last)', cs.join(','));
  console.log('note - widths 412: field ' + g412.pillW + ' \u00b7 chips ' + g412.chipsW + ' | 690: field ' + g690.pillW + ' \u00b7 chips ' + g690.chipsW);
}

/* ---------------- L2: chips in the line (5) ---------------- */
{
  const g412 = await geom();
  await page.setViewportSize({ width: 690, height: 915 });
  await sleep(120);
  const g690 = await geom();
  await page.setViewportSize({ width: 412, height: 915 });
  await sleep(120);
  const inside = (g) => g.chipRects.every((c) => c.l >= g.rowL - 1 && c.r <= g.rowR + 1);
  ok(inside(g412) && inside(g690),
    'L2 (leg 2): all three chips stand fully inside the line\u2019s bounds at 412 and at 690 (no chip hidden, none clipped)',
    JSON.stringify({ c412: g412.chipRects, row412: [g412.rowL, g412.rowR], c690: g690.chipRects, row690: [g690.rowL, g690.rowR] }));

  await page.click('[data-homefilter="praylists"]');
  await sleep(120);
  const afterPlaylists = await cards();
  await page.click('[data-homefilter="novenas"]');
  await sleep(120);
  const afterNovenas = await cards();
  // The Downloaded set is seeded the app's own way: the
  // day's Morning audio standing in Cache Storage, settled
  // by refreshGridDlStates (a hand-set state.gridDl would be
  // overwritten by the settle path's recompute — the mold's
  // honest downloaded state is what the cache says).
  await ev(() => caches.open('opn-ext-audio-v1').then(function (cache) {
    return Promise.all([
      cache.put('day/2026-11-14/m1', new Response('x')),
      cache.put('day/2026-11-14/m2', new Response('x'))
    ]);
  }).then(function () { return refreshGridDlStates(); }));
  await sleep(120);
  await page.click('[data-homefilter="downloaded"]');
  await sleep(120);
  const afterDownloaded = await cards();
  ok(afterPlaylists.join(',') === 'Morning,Midmorning,Midday,Afternoon,Evening,Night,Mass and Homilies,Novenas,The AI Signal'
    && afterNovenas.join(',') === 'Novenas'
    && afterDownloaded.join(',') === 'Morning',
    'L2 (leg 2): each chip filters the grid (Playlists = the standing set \u00b7 Novenas isolates its card \u00b7 Downloaded = the downloaded blocks only)',
    JSON.stringify({ afterPlaylists, afterNovenas, afterDownloaded }));

  const dress = await ev(() => {
    var c = document.querySelector('[data-homefilter="downloaded"]');
    var cs = getComputedStyle(c);
    return { bg: cs.backgroundColor, weight: cs.fontWeight, pressed: c.getAttribute('aria-pressed'), active: c.classList.contains('active'), filter: state.homeFilter };
  });
  ok(dress.active && dress.pressed === 'true' && dress.bg === 'rgb(168, 134, 58)' && dress.weight === '600' && dress.filter === 'downloaded',
    'L2 (leg 2, F-425-4): the selected chip\u2019s dress stands unmistakable at the settled form (accent fill \u00b7 weight 600 \u00b7 aria-pressed="true")', JSON.stringify(dress));

  await page.click('[data-homefilter="downloaded"]');
  await sleep(120);
  const cleared = await ev(() => ({
    filter: state.homeFilter,
    anyActive: document.querySelectorAll('[data-homefilter].active').length,
    cards: [...document.querySelectorAll('#home-body .blockcard')].map((c) => c.getAttribute('data-openblock'))
  }));
  ok(cleared.filter === null && cleared.anyActive === 0 && cleared.cards.length === 10,
    'L2 (leg 2): a re-tap on the active chip clears the filter \u2014 no chip active, the full grid returns', JSON.stringify(cleared));

  const gEnd = await geom();
  ok(gEnd.chipRects.every((c) => c.h >= 44),
    'L2 (leg 2): every chip stands \u226544px tall (the v411 floor)', JSON.stringify(gEnd.chipRects));
}

/* ---------------- L3: search stands (4) ---------------- */
{
  await ev(() => { window.__node = document.getElementById('day-search'); window.__node.focus(); });
  await page.keyboard.type('Invitatory');
  await sleep(150);
  const typed = await ev(() => ({
    hit: (document.getElementById('home-body').textContent || '').includes('Invitatory'),
    results: !!document.querySelector('#home-body .sectionhead')
  }));
  ok(typed.hit && typed.results,
    'L3 (leg 3): typing filters the body in place (the Invitatory hit stands in the results paint)', JSON.stringify(typed));
  const surviveType = await ev(() => ({
    sameNode: window.__node === document.getElementById('day-search'),
    focused: document.activeElement === window.__node,
    value: document.getElementById('day-search').value
  }));
  ok(surviveType.sameNode && surviveType.focused && surviveType.value === 'Invitatory',
    'L3 (leg 3): the input node, focus, and value survive typing', JSON.stringify(surviveType));

  const surviveTap = await ev(() => {
    document.querySelector('[data-homefilter="novenas"]').click();
    return {
      sameNode: window.__node === document.getElementById('day-search'),
      focused: document.activeElement === window.__node,
      value: document.getElementById('day-search').value,
      filter: state.homeFilter,
      pressed: document.querySelector('[data-homefilter="novenas"]').getAttribute('aria-pressed'),
      active: document.querySelector('[data-homefilter="novenas"]').classList.contains('active')
    };
  });
  await sleep(120);
  await page.click('[data-homefilter="praylists"]');
  await sleep(120);
  const surviveRealClick = await ev(() => ({
    sameNode: window.__node === document.getElementById('day-search'),
    value: document.getElementById('day-search').value
  }));
  await ev(() => { document.querySelector('[data-homefilter="praylists"]').click(); });
  await sleep(120);
  ok(surviveTap.sameNode && surviveTap.focused && surviveTap.value === 'Invitatory'
    && surviveTap.filter === 'novenas' && surviveTap.pressed === 'true' && surviveTap.active
    && surviveRealClick.sameNode && surviveRealClick.value === 'Invitatory',
    'L3 (leg 3, F-425-3): the input node, focus, and value survive a chip tap with text standing \u2014 the chip toggles in place, #day-search is never rebuilt (a real tap also keeps node + value; focus moves to the tapped chip, the platform\u2019s act)',
    JSON.stringify({ surviveTap, surviveRealClick }));

  await page.click('#day-search');
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await sleep(150);
  const restored = await ev(() => ({
    grid: !!document.querySelector('#home-body .blockgrid'),
    cont: !!document.getElementById('continue-slot'),
    cards: document.querySelectorAll('#home-body .blockcard').length,
    value: document.getElementById('day-search').value
  }));
  ok(restored.grid && restored.cont && restored.cards === 10 && restored.value === '',
    'L3 (leg 3): clearing the query restores the standing home body (the grid + the Continue slot)', JSON.stringify(restored));
}

/* ---------------- L4: the sort row (2) ---------------- */
{
  await ev(() => { state.dayPayload = window.__fixture; paintListenHome(window.__fixture); });
  const dayLabel = await ev(() => (document.getElementById('sort-name') || {}).textContent || '');
  await ev(() => {
    window.__fixture2 = JSON.parse(JSON.stringify(window.__fixture));
    window.__fixture2.blockOrder = ['Night', 'Morning'];
    state.dayPayload = window.__fixture2;
    paintListenHome(window.__fixture2);
  });
  const manualLabel = await ev(() => (document.getElementById('sort-name') || {}).textContent || '');
  ok(dayLabel === 'Day order' && manualLabel === 'Manual order',
    'L4 (leg 4): the order label stands \u2014 "Day order" plain, "Manual order" with a stored order', dayLabel + ' / ' + manualLabel);
  await page.click('#sort-btn');
  await sleep(200);
  const editor = await ev(() => ({
    sheet: !!document.querySelector('.ordersheet'),
    moves: document.querySelectorAll('.ordersheet [data-ordup]').length + document.querySelectorAll('.ordersheet [data-orddown]').length
  }));
  ok(editor.sheet && editor.moves === 18,
    'L4 (leg 4): the Sort button opens the standing order editor (nine blocks, up/down on each)', JSON.stringify(editor));
  await ev(() => { document.querySelectorAll('.sheet').forEach((x) => x.remove()); state.dayPayload = window.__fixture; paintListenHome(window.__fixture); });
}

/* ---------------- L5: nothing else moved (3) ---------------- */
{
  const head = await ev(() => ({
    h1: (document.querySelector('h1.screen') || {}).textContent || '',
    sub: (document.querySelector('p.sub') || {}).textContent || '',
    playAll: !!document.getElementById('play-all'),
    offline: !!document.getElementById('offline-dl-btn')
  }));
  ok(head.h1 === 'Prayers' && head.sub === 'Saturday, November 14',
    'L5 (leg 5): the title + date line stand', JSON.stringify(head));
  ok(head.playAll && head.offline,
    'L5 (leg 5): Play All and the offline line stand below the grid', JSON.stringify(head));
  const scoped = await ev(() => {
    var host = document.createElement('div');
    host.innerHTML = '<div class="chips"><button class="chip">Commandment I</button></div>';
    view.appendChild(host);
    var outside = getComputedStyle(host.querySelector('.chip'));
    var inside = getComputedStyle(document.querySelector('.searchrow .chip'));
    var r = { outPadL: outside.paddingLeft, outPadR: outside.paddingRight, inPadL: inside.paddingLeft, inPadR: inside.paddingRight };
    host.remove();
    return r;
  });
  ok(scoped.outPadL === '14px' && scoped.outPadR === '14px' && scoped.inPadL === '10px' && scoped.inPadR === '10px',
    'L5 (leg 5): the shared .chip dress outside the home (the Examination construction) keeps the standing 14px side padding \u2014 the 10px slimming lives only inside .searchrow',
    JSON.stringify(scoped));
}

console.log('harness-v425: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) console.log('failures: ' + failures.join(' | '));
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
