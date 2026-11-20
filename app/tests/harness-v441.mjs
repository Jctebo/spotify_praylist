// harness-v441 — Prayers home: the Day order row retires,
// the sort icon moves up (v441 release document §§1–2;
// John's words, Ora thread, 2026-11-15 08:03 CT: "Further
// compression of the layers needed. Get rid of for with
// order been and move the sort icon up"). Client-only delta:
// client.ts paintListenHome — the .sortrow emission retires;
// the #sort-btn button (byte-identical) moves into the
// .searchrow after #home-chips; the standing id wiring
// (getElementById('sort-btn') -> openBlockOrderEditor)
// stands byte-untouched. The .sortrow CSS rule in ui.ts
// stands unused (v428 precedent).
// Mold: the v439 whole-cooked-script Chromium mold (real
// SHELL_HTML + APP_CSS + the whole cooked APP_JS, the v431
// fixture day), run on BOTH trees — the fixed tree (this
// worktree) and the base tree (release/v440-ship, via git
// show) — so the measure legs read the banked height as a
// delta on identical pages.
//   S  statics: the segment shape, the button markup and
//      the listener line byte-identical to base
//   E  emission: no .sortrow / no #sort-name / no order
//      name on the fixed home; exactly one #sort-btn,
//      inside .searchrow, after #home-chips; base sanity
//   A  act: the button's tap opens the order editor
//      (.ordersheet, "Playlist order") via the standing
//      wiring
//   M  measures at 412px: #home-body top and (Continue
//      standing) the grid top — base minus fixed = 54
//      (the 44px row + its 10px bottom margin)
//   W  widths at 360px + 412px on the fixed tree: pill +
//      chips + button on one line, no overflow, no chip
//      clipped, the pill still usable
import { readFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const APP = path.resolve(process.cwd(), 'app');
const WT = path.resolve(APP, '..');
if (!WT.includes('.worktrees')) { console.error('HARD GUARD: harness-v441 runs only inside a release worktree'); process.exit(2); }
const SRC = path.join(APP, 'worker/src');
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const BASE = '9f266eee059707fac0f3cf8bec4be6afb77b98db';
const B_CSRC = execFileSync('git', ['-C', WT, 'show', BASE + ':app/worker/src/client.ts'], { encoding: 'utf8' });
const B_USRC = execFileSync('git', ['-C', WT, 'show', BASE + ':app/worker/src/ui.ts'], { encoding: 'utf8' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('ok   - ' + name); }
  else { fail++; failures.push(name); console.log('FAIL - ' + name + (extra ? ' :: ' + String(extra).slice(0, 300) : '')); }
}

function parts(cSrc, uSrc) {
  const tplA = cSrc.indexOf('APP_JS = `') + 10;
  const tplB = cSrc.indexOf('`;', tplA);
  const raw = cSrc.slice(tplA, tplB);
  const cooked = new Function('return `' + raw + '`')();
  const css = uSrc.slice(uSrc.indexOf('APP_CSS = `') + 11, uSrc.indexOf('`;', uSrc.indexOf('APP_CSS = `')));
  const shell = uSrc.slice(uSrc.indexOf('SHELL_HTML = `') + 14, uSrc.indexOf('`;', uSrc.indexOf('SHELL_HTML = `')));
  return { cooked, css, shell };
}
const FIXED = parts(C_SRC, U_SRC);
const BASEP = parts(B_CSRC, B_USRC);
const seg = (src, a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));

/* ---------------- S: statics ---------------- */
{
  const plhF = seg(C_SRC, 'function paintListenHome', 'function homeBodyHtml');
  const plhB = seg(B_CSRC, 'function paintListenHome', 'function homeBodyHtml');
  ok(!plhF.includes('class="row sortrow"') && !plhF.includes('id="sort-name"') && !plhF.includes("'Manual order' : 'Day order'"),
    'S1: the fixed paintListenHome carries no sortrow emission, no #sort-name, no order-name emission (the words stand only in the v441 comment)');
  ok((plhF.match(/id="sort-btn"/g) || []).length === 1 && (plhB.match(/id="sort-btn"/g) || []).length === 1,
    'S2: exactly one #sort-btn emission stands in paintListenHome on each tree');
  const btn = (src) => { const a = src.indexOf('<button class="btn ghost small" id="sort-btn"'); return src.slice(a, src.indexOf('</button>', a) + 9); };
  ok(btn(C_SRC) === btn(B_CSRC) && btn(C_SRC).includes('aria-label="Sort"') && btn(C_SRC).includes('↑↓'),
    'S3: the #sort-btn markup is byte-identical to base (id · classes · aria-label="Sort" · ↑↓ glyph)');
  const lis = (src) => { const a = src.indexOf("document.getElementById('sort-btn')"); return src.slice(a, src.indexOf(';', a) + 1); };
  ok(lis(C_SRC) === lis(B_CSRC) && lis(C_SRC).includes('openBlockOrderEditor'),
    'S4: the sort-btn listener line is byte-identical to base — the standing id wiring stands untouched');
  ok(plhB.includes('class="row sortrow"') && plhB.includes('id="sort-name"'),
    'S5: base sanity — the base paintListenHome emits the .sortrow with #sort-name (the mold reads the right base)');
}

/* ---------------- fixture: the v431 fixture day ---------------- */
const FIXTURE = {
  date: '2026-11-14', presentedDay: '2026-11-14', dateLabel: 'Saturday, November 14, 2026', intentionsLine: '',
  liturgicalDay: { name: 'Saturday of the 32nd Week in Ordinary Time', color: 'green' }, introTexts: {},
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
const DESCS = [
  { episodeId: 'seg-int-morning', kind: 'segment', title: 'Intentions', block: 'Morning', url: 'https://x/int.mp3', available: true, durationS: 60 },
  { episodeId: 'm1', kind: 'episode', title: 'Invitatory', block: 'Morning', url: '/api/player/feed-audio?m1', available: true, durationS: 300 },
  { episodeId: 'm2', kind: 'episode', title: 'Daily Verse', block: 'Morning', url: '/api/player/feed-audio?m2', available: true, durationS: 120, source: 'VerseCast', imageUrl: 'https://img.example/m2.jpg', descText: 'A short reflection.', spotifyUrl: 'https://open.spotify.com/episode/m2' },
  { episodeId: 'n1', kind: 'episode', title: 'Night Prayer', block: 'Night', url: '/api/player/feed-audio?n1', available: true, durationS: 0 }
];

function pageHtml(p) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${p.css}</style></head>
<body data-lit="">
<audio id="audio"></audio>
${p.shell}
<script>
window.__fixture = ${JSON.stringify(FIXTURE)};
window.__descs = ${JSON.stringify(DESCS)};
window.__fetchLog = [];
window.fetch = function (path, opts) {
  window.__fetchLog.push(String(path));
  if (String(path).indexOf('/api/player/day') === 0) {
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(window.__fixture); } });
  }
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
${p.cooked}
</` + `script>
</body></html>`;
}

const server = http.createServer((req, res) => {
  const pth = (req.url || '/').split('?')[0];
  if (pth === '/' || pth === '/fixed') { res.setHeader('Content-Type', 'text/html'); res.end(pageHtml(FIXED)); return; }
  if (pth === '/base') { res.setHeader('Content-Type', 'text/html'); res.end(pageHtml(BASEP)); return; }
  if (pth === '/fixedx') { // the unapplied compaction probe (see the W notes)
    const px = { ...FIXED, css: FIXED.css + '\n@media (max-width: 400px) { .searchrow { gap:6px; } .searchrow .chip { padding:7px 5px; } .searchrow #sort-btn { padding:0 9px; } }' };
    res.setHeader('Content-Type', 'text/html'); res.end(pageHtml(px)); return;
  }
  res.statusCode = 404; res.end('not found');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));

async function loadTree(which) {
  pageErrors.length = 0;
  await page.goto(ORIGIN + '/' + which);
  await sleep(2500);
  // Deterministic home paint (the v431 mold practice): the
  // fixture stands in state, paintListenHome runs verbatim.
  await page.evaluate(() => {
    state.dayPayload = window.__fixture;
    state.dayDescs = window.__descs;
    state.playedCache = {};
    state.restoredQueue = false;
    state.prayersView = { kind: 'home' };
    paintListenHome(window.__fixture);
  });
  await sleep(150);
}
const snapshot = () => page.evaluate(() => {
  const view = document.getElementById('view');
  const btn = document.getElementById('sort-btn');
  const chips = document.getElementById('home-chips');
  let inSearchrow = false, afterChips = false;
  if (btn) {
    let n = btn.parentElement;
    while (n) { if (n.classList && n.classList.contains('searchrow')) { inSearchrow = true; break; } n = n.parentElement; }
    if (chips) afterChips = !!(chips.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING);
  }
  return {
    sortrows: document.querySelectorAll('#view .sortrow').length,
    sortNames: document.querySelectorAll('#sort-name').length,
    sortBtns: document.querySelectorAll('#sort-btn').length,
    inSearchrow, afterChips,
    viewText: view ? view.textContent : '',
    bodyTop: (() => { const vt = view.getBoundingClientRect().top + window.scrollY; const b = document.getElementById('home-body'); return b ? Math.round(b.getBoundingClientRect().top + window.scrollY - vt) : -1; })(),
  };
});
async function gridTopWithContinue() {
  await page.evaluate(() => {
    state.playedCache = { 'seg-int-morning': { '2026-11-14': true }, 'm1': { '2026-11-14': true } };
    state.restoredQueue = false;
    paintListenHome(window.__fixture);
    paintContinue();
  });
  await sleep(150);
  return page.evaluate(() => {
    const view = document.getElementById('view');
    const vt = view.getBoundingClientRect().top + window.scrollY;
    const grid = document.querySelector('#home-body .blockgrid');
    const card = document.querySelector('#continue-slot .card');
    return { gridTop: grid ? Math.round(grid.getBoundingClientRect().top + window.scrollY - vt) : -1, cardH: card ? card.offsetHeight : -1 };
  });
}

/* ---------------- base tree: sanity + measures ---------------- */
await loadTree('base');
const baseSnap = await snapshot();
ok(pageErrors.length === 0, 'E0c: base tree — no pageerror through boot + home paint', pageErrors.join(' | '));
ok(baseSnap.sortrows === 1 && baseSnap.sortBtns === 1 && !baseSnap.inSearchrow && baseSnap.viewText.includes('Day order'),
  'E0: base sanity — the base home carries the .sortrow, its #sort-btn inside it, and the "Day order" name', JSON.stringify({ sortrows: baseSnap.sortrows, sortBtns: baseSnap.sortBtns }));
const baseGrid = await gridTopWithContinue();
console.log('note - base measures @412: bodyTop=' + baseSnap.bodyTop + ' gridTop=' + baseGrid.gridTop + ' continueCardH=' + baseGrid.cardH);

/* ---------------- fixed tree: emission ---------------- */
await loadTree('fixed');
const fixSnap = await snapshot();
ok(pageErrors.length === 0, 'E0b: fixed tree — no pageerror through boot + home paint', pageErrors.join(' | '));
ok(fixSnap.sortrows === 0 && fixSnap.sortNames === 0,
  'E1: the fixed home paint carries NO .sortrow and NO #sort-name', JSON.stringify({ sortrows: fixSnap.sortrows, sortNames: fixSnap.sortNames }));
ok(!fixSnap.viewText.includes('Day order') && !fixSnap.viewText.includes('Manual order'),
  'E2: no "Day order" / "Manual order" text stands on the fixed home');
ok(fixSnap.sortBtns === 1 && fixSnap.inSearchrow && fixSnap.afterChips,
  'E3: exactly one #sort-btn stands on the fixed home, inside .searchrow, after #home-chips',
  JSON.stringify({ n: fixSnap.sortBtns, inSearchrow: fixSnap.inSearchrow, afterChips: fixSnap.afterChips }));

/* ---------------- M: measures ---------------- */
const fixGrid = await gridTopWithContinue();
console.log('note - fixed measures @412: bodyTop=' + fixSnap.bodyTop + ' gridTop=' + fixGrid.gridTop + ' continueCardH=' + fixGrid.cardH);
ok(baseSnap.bodyTop - fixSnap.bodyTop === 54,
  'M1: #home-body top — base minus fixed = 54px banked (the 44px row + its 10px margin)', 'base=' + baseSnap.bodyTop + ' fixed=' + fixSnap.bodyTop);
ok(baseGrid.gridTop - fixGrid.gridTop === 54 && baseGrid.cardH === fixGrid.cardH,
  'M2: grid top (Continue standing, card height unchanged) — base minus fixed = 54px banked', 'base=' + baseGrid.gridTop + ' fixed=' + fixGrid.gridTop + ' cardH=' + fixGrid.cardH);

/* ---------------- A: the act ---------------- */
{
  await page.evaluate(() => { state.playedCache = {}; paintListenHome(window.__fixture); });
  await sleep(100);
  let actOk = false, actErr = null;
  try {
    await page.click('#sort-btn', { timeout: 3000 });
    await sleep(700);
    actOk = await page.evaluate(() => {
      const sheet = document.querySelector('.ordersheet');
      return !!sheet && sheet.textContent.includes('Playlist order') && !!sheet.querySelector('[data-orderlist]');
    });
  } catch (e) { actErr = e; }
  ok(actOk, 'A1: tapping #sort-btn opens the order editor (.ordersheet, "Playlist order", the order list) via the standing wiring', actErr && actErr.message);
  await page.evaluate(() => { const s = document.querySelector('.ordersheet'); if (s) s.remove(); });
}

/* ---------------- W: widths ---------------- */
async function widthGeom(width) {
  await page.setViewportSize({ width, height: 915 });
  await sleep(150);
  await page.evaluate(() => { state.playedCache = {}; paintListenHome(window.__fixture); });
  await sleep(100);
  return page.evaluate((w) => {
    const row = document.querySelector('.searchrow');
    const pill = document.querySelector('.searchrow .searchpill');
    const chips = [...document.querySelectorAll('#home-chips .chip')];
    const btn = document.getElementById('sort-btn');
    const rr = row.getBoundingClientRect();
    const pr = pill.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    const chipRects = chips.map((c) => { const r = c.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top }; });
    return {
      scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth,
      rowTop: rr.top, pillTop: pr.top, btnTop: br.top, pillW: Math.round(pr.width),
      btnW: Math.round(br.width), btnRight: Math.round(br.right),
      chipsInside: chipRects.every((r) => r.right <= rr.right + 1 && r.left >= rr.left - 1),
      chipsTop: chipRects.length ? chipRects[0].top : -1,
    };
  }, width);
}
for (const w of [360, 412]) {
  const g = await widthGeom(w);
  ok(g.scrollW <= g.innerW && g.chipsInside && g.btnRight <= w,
    'W' + w + 'a: no horizontal overflow at ' + w + 'px; every chip stands inside the searchrow; the button stands inside the viewport', JSON.stringify(g));
  ok(Math.abs(g.pillTop - g.btnTop) <= 2 && Math.abs(g.chipsTop - g.btnTop) <= 2,
    'W' + w + 'b: pill, chips and button share one line at ' + w + 'px', JSON.stringify(g));
  console.log('note - width ' + w + ' (fixed): pillW=' + g.pillW + ' btnW=' + g.btnW + ' btnRight=' + g.btnRight + ' scrollW=' + g.scrollW);
}
{
  // The pill floor at the design's standing legged width:
  // the input's own horizontal padding is 38 + 16 = 54px,
  // so pill >= 54 is the floor for a non-zero text area.
  const g = await widthGeom(412);
  ok(g.pillW >= 54, 'W412c: the pill keeps a non-zero text area at 412px (pill >= 54, the input\u2019s own padding)', 'pillW=' + g.pillW);
  // Notes for the §3 finding — the 360px squeeze, quantified
  // on both trees, plus the unapplied compaction probe.
  await loadTree('base');
  const gb = await widthGeom(360);
  console.log('note - width 360 (base): pillW=' + gb.pillW + ' — the standing design\u2019s own pill at 360 in this mold');
  await loadTree('fixed');
  const gf = await widthGeom(360);
  console.log('note - width 360 (fixed): pillW=' + gf.pillW + ' — the button (44) + one gap (8) come out of the pill, the row\u2019s only flexible member');
  pageErrors.length = 0;
  await page.goto(ORIGIN + '/fixedx');
  await sleep(2500);
  const gx = await widthGeom(360);
  console.log('note - width 360 (probe, UNAPPLIED narrow-width compaction: gap 6 · chip padding 7px 5px · button padding 0 9px under 400px): pillW=' + gx.pillW);
}

await browser.close();
server.close();
console.log('\nharness-v441: ' + pass + ' ok / ' + fail + ' not-ok');
if (failures.length) { console.log('failures: ' + failures.join(' · ')); process.exit(1); }
