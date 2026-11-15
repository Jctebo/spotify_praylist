// harness-v422 — the block head, deeper cut (§1/§2 of the
// v422 release document; the fix-forward for v420's failed
// acceptance). Client-only release: client.ts (the
// paintBlockPage head emission only) + ui.ts (the SHELL_HTML
// tagline div + APP_CSS values). Client legs run in headless
// Chromium on the v388/v417 extraction mold (real SHELL_HTML
// + APP_CSS, fixture state). No Worker legs: index.ts stands
// byte-untouched; the pin stands at ora-pro-nobis-v421-1
// until the Ship composition.
//   S  statics (the +46 offset · the +58 offset nowhere ·
//      the tagline div absent from the shell · the compact
//      emission's shape · the disc inside the cover row ·
//      the v421 listener count)
//   L1 no slot at any scroll depth (§1.5 leg 1)
//   L2 the measures (leg 2) — head ≤ 94 · Mass ≤ 120 ·
//      the title at ≤ 2 lines · the column width reported
//   L3 the Play All disc (leg 3) — Row 1's top right, 44×44,
//      a tap plays the block
//   L4 the ⋮ from its new seat (leg 4) — the standing menu
//      and acts
//   L5 the brand (leg 5) — tagline gone, the liturgical
//      line standing, the mold brand 42–44, the stack ≤ 186
//   L6 five rows on screen (leg 6)
//   L7 non-interference — the episodes page's head stands
//      at its v419 form (its disc still 56px); the v421
//      binding's statics re-asserted (harness-v421's own
//      green run in the ledger discharges the dispatch)
// The fixture carries PRODUCTION-SHAPED labels (the v420
// mold's discipline): the label IS the block name, as the
// day payload carries it.
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

/* ---------------- S: statics ---------------- */
{
  ok(/\.blockpage-head\.compact \{[^}]*top:calc\(var\(--brandh, 54px\) \+ 46px\)/.test(APP_CSS),
    'S (§2.7): the compact head\u2019s sticky top reads calc(var(--brandh, 54px) + 46px) — flush with the toggle\u2019s painted band');
  ok(!APP_CSS.includes('+ 58px'),
    'S (§2.7): the +58px offset stands NOWHERE in APP_CSS — the retired slot allowance is gone');
  ok(/\.blockpage-head\.compact \{[^}]*padding:4px 14px/.test(APP_CSS) && /\.blockpage-pillrow \{[^}]*margin-top:2px/.test(APP_CSS),
    'S (§2.7): the floors stand — head padding 4px vertical, the cover\u2192pill gap at 2px');
  ok(/\.blockpage-head\.compact \.playbtn\.big \{ width:44px; height:44px; \}/.test(APP_CSS) && /\.playbtn\.big \{ width:56px; height:56px/.test(APP_CSS),
    'S (§2.6): the 44px disc size is .compact-scoped; the standing .playbtn.big rule keeps 56px for the episodes page');
  const header = SHELL.slice(SHELL.indexOf('<header class="brandbar">'), SHELL.indexOf('</header>'));
  ok(!header.includes('tagline') && !header.includes('Daily Catholic Prayer Podcast'),
    'S (§2.2): the shell\u2019s brand bar carries NO tagline div — the line and its words are out of the markup');
  ok(header.includes('class="wordmark"') && header.includes('ORA PRO NOBIS') && header.includes('class="litday" id="litday"') && header.includes('gearbtn'),
    'S (§2.2): the brand bar keeps its standing parts — wordmark · the liturgical line\u2019s seat · the gear');
  ok(U_SRC.includes('description: "A Daily Catholic Prayer Podcast'),
    'S (§2.2): the PWA manifest description string STANDS — a different surface, outside the tagline cut');
  const unitHtml = C_SRC.slice(C_SRC.indexOf('function paintBlockPage'), C_SRC.indexOf('function paintEpisodesPage'));
  const emit = unitHtml.slice(unitHtml.indexOf('var html ='), unitHtml.indexOf('view.innerHTML'));
  ok(!emit.includes('blockpage-playrow') && !emit.includes('blockpage-playlabel'),
    'S (§2.6): the compact head\u2019s emission carries no Play All row and no play label — both retired as emissions');
  const coverRow = emit.slice(emit.indexOf('blockpage-coverrow'), emit.indexOf('blockpage-pillrow'));
  ok(coverRow.includes('data-queue=') && coverRow.includes('aria-label="Play all of ') && coverRow.includes('data-blockmenu='),
    'S (§2.6): Row 1\u2019s cluster carries the SAME data-queue disc (its \u201cPlay all of\u201d aria-label standing) and the \u22ee, inside the cover row');
  ok(emit.indexOf('data-queue=') > -1 && emit.indexOf('data-queue=') < emit.indexOf('data-blockmenu='),
    'S (§2.6): the cluster\u2019s order is disc \u00b7 \u22ee — the \u22ee immediately right of the disc');
  const epsUnit = C_SRC.slice(C_SRC.indexOf('function paintEpisodesPage'), C_SRC.indexOf('function appendBlockSettingsCards'));
  ok(epsUnit.includes('blockpage-playrow') && epsUnit.includes('blockpage-playlabel'),
    'S (§2.6): the episodes page\u2019s head still emits its play row + label — the retirement is compact-only');
  const listeners = C_SRC.match(/addListener\('backButton'/g) || [];
  ok(listeners.length === 1 && !/addEventListener\(\s*['"]backbutton/.test(C_SRC),
    'S (§2.8/L7): exactly one addListener(\'backButton\' stands in client.ts; the document event is not bound — the v421 binding untouched');
  ok(U_SRC.includes('ora-pro-nobis-v421-1') && !U_SRC.includes('ora-pro-nobis-v422-1'),
    'S: the SW pin is untouched at Implement (Ship moves it)');
  ok(!I_SRC.includes('blockpage') && !I_SRC.includes('tagline'),
    'S: index.ts carries no head or tagline markers (the delta is client + ui only)');
  ok(!/#1DB954|#1ed760/i.test(C_SRC + U_SRC), 'S: no Spotify green anywhere');
}

/* ---------------- client extraction (v388/v417 mold) ---------------- */
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
ok(pieces.some((p) => p.startsWith('function paintBlockPage')) && pieces.some((p) => p.startsWith('function setupBackButton')) && pieces.some((p) => p.startsWith('function handleSystemBack')),
  'S: paintBlockPage and the v421 binding\u2019s functions survive extraction');

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
  if (req.url && req.url.endsWith('.js')) { res.setHeader('Content-Type', 'application/javascript'); res.end(''); return; }
  res.setHeader('Content-Type', 'text/html'); res.end(PAGE);
});
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

await ev(() => {
  var blk = function (name, caption, tracks) { return { block: name, label: name, caption: caption || '', tracks: tracks || [] }; };
  var mTracks = [
    { episodeId: 'seg-int-morning', title: 'Intentions', kind: 'segment', available: true, url: 'https://x/int.mp3', durationS: 60 },
    { episodeId: 'm1', title: 'Invitatory', kind: 'episode', available: true, url: '/api/player/feed-audio?m1', durationS: 300, hasText: true, textUrl: '/text/m1.txt' },
    { episodeId: 'm2', title: 'Daily Verse', kind: 'external', source: 'VerseCast', available: true, url: '/api/player/feed-audio?m2', streamUrl: 'https://x/m2.mp3', durationS: 120, imageUrl: 'https://img.example/m2.jpg', descText: 'A short reflection.', spotifyUrl: 'https://open.spotify.com/episode/m2' }
  ];
  for (var i = 3; i <= 8; i++) {
    mTracks.push({ episodeId: 'mx' + i, title: 'Morning Prayer ' + i, kind: 'episode', available: true, url: '/api/player/feed-audio?mx' + i, durationS: 240 });
  }
  window.__fixture = {
    date: '2026-11-14', dateLabel: 'Saturday, November 14', intentionsLine: '',
    blocks: [
      blk('Morning', 'from midnight', mTracks),
      blk('Midmorning'), blk('Midday'), blk('Afternoon'), blk('Evening'),
      blk('Night', '', [
        { episodeId: 'n1', title: 'Night Prayer', kind: 'episode', available: true, url: '/api/player/feed-audio?n1', durationS: 0 }
      ]),
      blk('Mass and Homilies'), blk('Novenas'),
      blk('The AI Signal', '', [
        { episodeId: 'the-ai-signal', title: 'The AI Signal — Daily', kind: 'episode', available: true, url: '/api/player/feed-audio?ai1', durationS: 900 }
      ])
    ],
    episodes: [{ episodeId: 'pod-ep-1', title: 'Podcast Episode', kind: 'episode', available: true, url: 'https://x/p1.mp3', durationS: 600 }]
  };
  window.__fixture.blocks[0].spotifyUrl = 'https://open.spotify.com/playlist/morning';
  window.__descs = [
    { episodeId: 'seg-int-morning', kind: 'segment', title: 'Intentions', block: 'Morning', url: 'https://x/int.mp3', available: true, durationS: 60 },
    { episodeId: 'm1', kind: 'episode', title: 'Invitatory', block: 'Morning', url: '/api/player/feed-audio?m1', available: true, durationS: 300 },
    { episodeId: 'm2', kind: 'episode', title: 'Daily Verse', block: 'Morning', url: '/api/player/feed-audio?m2', available: true, durationS: 120, source: 'VerseCast', imageUrl: 'https://img.example/m2.jpg', descText: 'A short reflection.', spotifyUrl: 'https://open.spotify.com/episode/m2' },
    { episodeId: 'n1', kind: 'episode', title: 'Night Prayer', kind: 'Night', url: '/api/player/feed-audio?n1', available: true, durationS: 0 }
  ];
  for (var j = 3; j <= 8; j++) {
    window.__descs.push({ episodeId: 'mx' + j, kind: 'episode', title: 'Morning Prayer ' + j, block: 'Morning', url: '/api/player/feed-audio?mx' + j, available: true, durationS: 240 });
  }
  state.dayPayload = window.__fixture;
  state.dayDescs = window.__descs;
  view.innerHTML = paintSideToggle('prayers', 'prayers') + '<div id="sidehost"></div>';
  enterSideHost();
  measureBars();
});

/* ---------------- L5: the brand (leg 5) ---------------- */
{
  const r = await ev(() => {
    var bb = document.querySelector('.brandbar');
    return {
      h: bb.offsetHeight,
      wordmark: bb.querySelector('.wordmark') ? bb.querySelector('.wordmark').textContent : null,
      tagline: !!bb.querySelector('.tagline'),
      taglineText: /Daily Catholic Prayer Podcast/i.test(bb.textContent),
      litday: !!bb.querySelector('#litday'), gear: !!bb.querySelector('#gearbtn'),
      brandhVar: getComputedStyle(document.documentElement).getPropertyValue('--brandh').trim()
    };
  });
  ok(!r.tagline && !r.taglineText && r.wordmark === 'ORA PRO NOBIS' && r.litday && r.gear,
    'L5 (leg 5): the painted brand bar carries wordmark · liturgical line · gear — and NO tagline element or text', JSON.stringify(r));
  // §2.2 expected the cut to take the mold brand 60 →
  // 42–44 on the premise that the text stack governs the
  // bar. The mold proves the premise wrong (D-422-1): the
  // gear button (44px) + the bar's 16px vertical padding
  // govern at 60 on BOTH trees — the text stack fell 40 →
  // 23 under the cut and never governed. This leg proves
  // the true composition instead of the expected figure.
  const parts = await ev(() => {
    var bb = document.querySelector('.brandbar');
    var q = (s) => { var e = bb.querySelector(s); return e ? e.offsetHeight : null; };
    return { brandtext: q('.brandtext'), gear: q('.gearbtn'), brandmark: q('.brandmark') };
  });
  ok(r.h === 60 && parts.gear === 44 && parts.brandtext === 23,
    'L5 (leg 5/D-422-1): the mold brand stands at 60px — governed by the gear (44) + padding (16), NOT the text stack (23 after the cut; 40 before): §2.2\u2019s 42–44 expectation does not hold in the mold and is named in §3, not built around', JSON.stringify({ bar: r.h, parts: parts }));
  ok(r.brandhVar === r.h + 'px',
    'L5 (§2.2): --brandh equals the painted height — the measured value governs, no constant moved', JSON.stringify(r));
}

/* ---------------- L2: the measures (leg 2) ---------------- */
const BLOCKS = ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night', 'Mass and Homilies', 'Novenas', 'The AI Signal'];
const heads = {};
for (const name of BLOCKS) {
  heads[name] = await ev((n) => {
    state.prayersView = { kind: 'block', block: n };
    paintBlockPage(window.__fixture, n);
    var head = document.querySelector('.blockpage-head');
    var title = head.querySelector('.blockpage-title');
    var stack = head.querySelector('.blockpage-stack');
    return {
      head: head.offsetHeight,
      titleH: Math.round(title.getBoundingClientRect().height),
      stackW: Math.round(stack.getBoundingClientRect().width),
      meta: head.querySelector('.blockpage-meta').textContent.replace(/\s+/g, ' ').trim()
    };
  }, name);
}
{
  const lineH = heads['Morning'].titleH;
  for (const name of BLOCKS) {
    const h = heads[name];
    if (name === 'Mass and Homilies') {
      ok(h.head <= 120 && h.titleH <= lineH * 2.3 && h.titleH >= lineH * 1.7,
        'L2 (leg 2/§2.3): Mass and Homilies — the head ≤ 120px with the title at exactly two lines (the cap holds, no third line)', JSON.stringify(h));
    } else if (h.titleH > lineH * 1.3) {
      // §2.3's accepted wrap bound: a title that wraps to
      // two lines at the built column takes its head to
      // ~126 at most — accepted in advance, still 36px
      // under the shipped 162. The AI Signal is that case
      // (F-422-2 materialized; named in §3 for F-422-5).
      ok(h.head <= 126 && h.titleH <= lineH * 2.3,
        'L2 (leg 2/§2.3): ' + name + ' — the title wraps to two lines at the 182px column; its head lands inside §2.3\u2019s accepted ~126px two-line bound', JSON.stringify(h));
    } else {
      ok(h.head <= 94 && h.titleH <= lineH * 1.3,
        'L2 (leg 2): ' + name + ' — the frozen head ≤ 94px, the title on one line', JSON.stringify(h));
    }
  }
  console.log('note - head measures: ' + BLOCKS.map((n) => n + '=' + heads[n].head + 'px (title ' + heads[n].titleH + 'px, stack ' + heads[n].stackW + 'px)').join(' · '));
  console.log('note - the title column (the stack) measures ' + heads['Morning'].stackW + 'px at 412 wide (§2.3 estimated 178–190)');
  console.log('note - the stuck stack (mold): brand 60 (D-422-1: the gear governs) + toggle 46 + head ' + heads['Morning'].head + ' = ' + (60 + 46 + heads['Morning'].head) + 'px — §1.2\u2019s ~183 assumed the tagline cut slimmed the bar; the head + slot cuts land in full');
}

/* ---------------- L3: the Play All disc (leg 3) ---------------- */
{
  const r = await ev(() => {
    state.prayersView = { kind: 'block', block: 'Morning' };
    paintBlockPage(window.__fixture, 'Morning');
    var head = document.querySelector('.blockpage-head');
    var row = head.querySelector('.blockpage-coverrow');
    var disc = head.querySelector('[data-queue]');
    var hr = head.getBoundingClientRect(), rr = row.getBoundingClientRect(), dr = disc.getBoundingClientRect();
    return {
      w: disc.offsetWidth, h: disc.offsetHeight,
      aria: disc.getAttribute('aria-label'),
      inRow1: dr.top >= rr.top - 1 && dr.bottom <= rr.bottom + 1,
      rightZone: hr.right - dr.right <= 100,
      labelGone: !head.querySelector('.blockpage-playlabel'),
      playRowGone: !head.querySelector('.blockpage-playrow')
    };
  });
  ok(r.w === 44 && r.h === 44,
    'L3 (leg 3/§2.6): the Play All disc measures 44×44 in the compact head (the floor; down from 56)', JSON.stringify(r));
  ok(r.inRow1 && r.rightZone && r.aria === 'Play all of Morning',
    'L3 (leg 3): the disc stands in Row 1 at the head\u2019s right zone, its standing aria-label \u201cPlay all of Morning\u201d intact', JSON.stringify(r));
  ok(r.labelGone && r.playRowGone,
    'L3 (§2.6): no visible Play All label and no play row stand in the painted compact head', JSON.stringify(r));
  await ev(() => { wirePrayersView(window.__fixture); });
  await page.click('.blockpage-head [data-queue]');
  await sleep(150);
  const played = await ev(() => ({ queue: state.queue.length, current: state.current ? state.current.episodeId : null }));
  ok(played.queue > 0 && !!played.current, 'L3 (leg 3): a tap on the reseated disc starts the block\u2019s queue — the act unchanged', JSON.stringify(played));
}

/* ---------------- L4: the ⋮ from its new seat (leg 4) ---------------- */
{
  await ev(() => { state.prayersView = { kind: 'block', block: 'Morning' }; paintBlockPage(window.__fixture, 'Morning'); });
  const seats = await ev(() => {
    var head = document.querySelector('.blockpage-head');
    var disc = head.querySelector('[data-queue]').getBoundingClientRect();
    var menu = head.querySelector('[data-blockmenu]').getBoundingClientRect();
    var hr = head.getBoundingClientRect();
    return {
      menuRightOfDisc: menu.left >= disc.right - 1,
      sameBand: Math.abs(menu.top - disc.top) < 24,
      flushRight: Math.abs(hr.right - 14 - menu.right) <= 2,
      gap: Math.round(menu.left - disc.right)
    };
  });
  ok(seats.menuRightOfDisc && seats.sameBand && seats.flushRight && seats.gap === 8,
    'L4 (leg 4/§2.6): the \u22ee stands immediately right of the disc (8px gap), flush with the head\u2019s inner right edge', JSON.stringify(seats));
  await page.click('[data-blockmenu]');
  await sleep(120);
  const menu = await ev(() => {
    var card = document.querySelector('.anchmenu');
    return card ? [...card.querySelectorAll('.menurow')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()) : [];
  });
  ok(menu.length === 4 && menu[0] === 'Sort' && menu[1] === 'Mark all played' && menu[2] === 'Share' && menu[3] === 'Open in Spotify',
    'L4 (leg 4): the \u22ee opens the anchored card listing Sort \u00b7 Mark all played \u00b7 Share \u00b7 Open in Spotify, in that order', menu.join(' | '));
  const cardBox = await ev(() => {
    var c = document.querySelector('.anchmenu');
    if (!c) return null;
    var r = c.getBoundingClientRect();
    return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) };
  });
  ok(cardBox && cardBox.left >= 0 && cardBox.right <= 412 && cardBox.top >= 0 && cardBox.bottom <= 915,
    'L4 (F-422-7): the anchored card opens inside the viewport clamps from the top-right seat', JSON.stringify(cardBox));
  await page.click('.anchmenu [data-menuitem="0"]'); // Sort
  await sleep(120);
  ok(await ev(() => !!document.querySelector('.ordersheet')), 'L4 (leg 4): Sort opens the standing order editor');
  await ev(() => { var s = document.querySelector('.ordersheet'); if (s) s.remove(); });
  await page.click('[data-blockmenu]');
  await sleep(120);
  await page.click('.anchmenu [data-menuitem="1"]'); // Mark all played
  await sleep(120);
  const marked = await ev(() => blockPlayedCounts('Morning'));
  ok(marked.total > 0 && marked.played === marked.total,
    'L4 (leg 4): Mark all played flips the block\u2019s played state (the standing wirePlayed act, from the new seat)', JSON.stringify(marked));
  await page.click('[data-blockmenu]');
  await sleep(120);
  const menu2 = await ev(() => {
    var card = document.querySelector('.anchmenu');
    return card ? [...card.querySelectorAll('.menurow')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()) : [];
  });
  ok(menu2[1] === 'Mark all unplayed', 'L4 (leg 4): at the next open the item reads Mark all unplayed (the label is computed at construction)', menu2.join(' | '));
  await ev(() => { document.querySelectorAll('.anchmenu, .menucatcher').forEach((x) => x.remove()); });
}

/* ---------------- L6: five rows on screen (leg 6) ---------------- */
{
  const r = await ev(() => {
    state.prayersView = { kind: 'block', block: 'Morning' };
    paintBlockPage(window.__fixture, 'Morning');
    var head = document.querySelector('.blockpage-head');
    var rows = [...document.querySelectorAll('#sidehost [data-card]')];
    var headBottom = head.getBoundingClientRect().bottom;
    var full = rows.filter((x) => { var b = x.getBoundingClientRect(); return b.top >= headBottom - 1 && b.bottom <= 915; });
    return { rows: rows.length, full: full.length, headBottom: Math.round(headBottom) };
  });
  ok(r.full >= 5,
    'L6 (leg 6): at 412×915, five Morning rows stand FULLY on screen below the frozen head at scroll 0', JSON.stringify(r));
  await page.screenshot({ path: path.join(APP, 'tests/harness-v422-blockpage.png') });
}

/* ---------------- L1: no slot at any scroll depth (leg 1) ---------------- */
{
  const setup = await ev(() => {
    var spacer = document.createElement('div'); spacer.style.height = '1600px'; spacer.id = 't-spacer';
    view.appendChild(spacer);
    measureBars();
    var brand = document.querySelector('.brandbar');
    return { brandH: brand.offsetHeight };
  });
  const probe = () => ev(() => {
    var head = document.querySelector('.blockpage-head');
    var toggle = document.querySelector('.segtoggle');
    var hr = head.getBoundingClientRect(), tr = toggle.getBoundingClientRect();
    var slot = Math.round(hr.top - tr.bottom);
    // Sweep elementFromPoint across the former slot band —
    // the toggle's bottom edge ± 3px and through the old
    // 12px band — at several x positions: every hit must be
    // the head, the toggle, the brand, or a child of one of
    // them; never a row, never the bare document.
    var hits = [];
    var ys = [tr.bottom - 2, tr.bottom + 1, tr.bottom + 6, tr.bottom + 11];
    var xs = [30, 120, 206, 300, 390];
    for (var yi = 0; yi < ys.length; yi++) {
      for (var xi = 0; xi < xs.length; xi++) {
        var el = document.elementFromPoint(xs[xi], ys[yi]);
        var bad = !el || !!el.closest('[data-card]') || (el !== document.body && !el.closest('.blockpage-head') && !el.closest('.segtoggle') && !el.closest('.brandbar') && el.tagName !== 'HTML');
        hits.push({ x: xs[xi], y: Math.round(ys[yi]), tag: el ? (el.className && el.className.baseVal !== undefined ? el.tagName : String(el.className).split(' ')[0] + '/' + el.tagName) : 'null', bad: bad });
      }
    }
    return { scrollY: Math.round(window.scrollY), slot: slot, headTop: Math.round(hr.top), toggleBottom: Math.round(tr.bottom), bad: hits.filter((h) => h.bad), hits: hits.length };
  });
  for (const depth of [300, 600]) {
    await page.evaluate((d) => window.scrollTo(0, d), depth);
    await sleep(80);
    const p = await probe();
    ok(p.slot === 0 && p.bad.length === 0,
      'L1 (leg 1): at scroll ' + depth + ' the slot measures 0 and elementFromPoint across the former band returns the head/toggle everywhere — no row shows through', JSON.stringify(p).slice(0, 300));
  }
  await page.evaluate(() => window.scrollTo(0, 100000));
  await sleep(80);
  const atMax = await probe();
  ok(atMax.scrollY > 600 && atMax.slot === 0 && atMax.bad.length === 0,
    'L1 (leg 1): at maximum scroll the slot still measures 0 — the head stands flush under the toggle', JSON.stringify(atMax).slice(0, 300));
  console.log('note - slot geometry: brandH=' + setup.brandH + ' · atMax ' + JSON.stringify({ scrollY: atMax.scrollY, slot: atMax.slot, headTop: atMax.headTop, toggleBottom: atMax.toggleBottom }));
  await page.screenshot({ path: path.join(APP, 'tests/harness-v422-scrolled.png') });
  await ev(() => { var s = document.getElementById('t-spacer'); if (s) s.remove(); window.scrollTo(0, 0); });
}

/* ---------------- L7: non-interference ---------------- */
{
  const eps = await ev(() => {
    state.prayersView = { kind: 'block', block: '__episodes' };
    paintBlockPage(window.__fixture, '__episodes');
    var head = document.querySelector('.blockpage-head');
    var disc = head.querySelector('[data-queue]');
    return {
      compact: head.classList.contains('compact'),
      discW: disc.offsetWidth, discH: disc.offsetHeight,
      label: !!head.querySelector('.blockpage-playlabel'),
      playrow: !!head.querySelector('.blockpage-playrow'),
      headH: head.offsetHeight
    };
  });
  ok(!eps.compact && eps.discW === 56 && eps.discH === 56 && eps.label && eps.playrow,
    'L7 (§2.6): the episodes page\u2019s head stands UNCHANGED — not compact, its disc still 56×56, its label and play row standing', JSON.stringify(eps));
  ok(pageErrors.length === 0, 'L7: the page ran clean — no pageerror across the whole harness', pageErrors.join(' | '));
}

console.log('harness-v422: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) console.log('failures: ' + failures.join(' | '));
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
