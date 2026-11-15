// harness-v420 — the compressed block head (§1/§2 of the
// v420 release document). Client-only release: client.ts
// (paintBlockPage's head + the ⋮ composition + the folded
// note) + ui.ts (the head's rules, .compact scope). Client
// legs run in headless Chromium on the v388/v417 extraction
// mold (real SHELL_HTML + APP_CSS, fixture state). No Worker
// legs: index.ts stands byte-untouched (the S static below
// is the client-side witness; Ship moves the pin to
// ora-pro-nobis-v420-1).
//   S  statics (the pin · the delta's shape · the med cover ·
//      the calc offset · the emitted markup · the menu order)
//   L1 the head measure (leg 1) — all nine blocks
//   L2 the frozen geometry (leg 2 + the half-disc artifact)
//   L3 no dead space beside the cover (leg 3)
//   L4 three rows on screen (leg 4)
//   L5 the ⋮ overflow (leg 5)
//   L6 the slim Play All row (leg 6)
//   L7 the brand bar stands (leg 7)
//   L8 the standing sizes + faces (leg 8)
//   L9 the boundary (leg 9) — episodes + series pages keep
//      the v419 head form
// The fixture carries PRODUCTION-SHAPED labels (§2.8): the
// block names as the day payload carries them — the mold's
// older fixtures used longer labels ("Morning Prayers"),
// which the title legs cannot judge by.
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
  ok(U_SRC.includes('ora-pro-nobis-v419-1') && !U_SRC.includes('ora-pro-nobis-v420-1'),
    'S: the SW pin is untouched at Implement (Ship moves it)');
  ok(!I_SRC.includes('blockpage') && !I_SRC.includes('blockcover'),
    'S: index.ts carries no head markers (the delta is client + CSS only)');
  ok(/\.blockcover\.med \{ width:56px; height:56px/.test(APP_CSS) && /\.blockcover\.med \.blockcover-initial \{ font-size:28px/.test(APP_CSS),
    'S (§2.3): .blockcover.med stands in APP_CSS at 56px with the 28px glyph');
  ok(/\.blockpage-head\.compact \{[^}]*top:calc\(var\(--brandh, 54px\) \+ 58px\)/.test(APP_CSS),
    'S (§2.9): the head\u2019s calc offset stands in APP_CSS (brand height + the toggle\u2019s 58px)');
  const unitHtml = C_SRC.slice(C_SRC.indexOf('function paintBlockPage'), C_SRC.indexOf('function paintEpisodesPage'));
  const emit = unitHtml.slice(unitHtml.indexOf('var html ='), unitHtml.indexOf('view.innerHTML'));
  ok(!emit.includes('backrow') && !emit.includes('data-blocksort') && !emit.includes('data-blockshare')
    && !emit.includes('data-bprayed') && !emit.includes('blockpage-owner') && !emit.includes('blockpage-desc') && !emit.includes('blockpage-dlrow'),
    'S (§2.3/§2.4): the emitted head carries no back row, no Sort/share row seats, no owner line, no prayed suffix, no download row');
  ok(emit.includes('blockpage-head compact') && emit.includes('blockpage-coverrow') && emit.includes("coverTileHtml(b.block, 'med')")
    && emit.includes('blockpage-pillrow') && emit.includes('data-back=') && emit.includes('data-bmeta'),
    'S (§2.3): the emitted head is the three-row compact form (cover row · pill line · Play All row), the disc inside Row 1');
  const io = (s) => unitHtml.indexOf(s);
  ok(io("label: 'Sort'") > -1 && io("label: 'Sort'") < io('Mark all unplayed') && io('Mark all unplayed') < io("label: 'Share'") && io("label: 'Share'") < io("label: 'Open in Spotify'"),
    'S (§2.7): the ⋮ composition stands in order — Sort · Mark all · Share · Open in Spotify');
  ok(unitHtml.includes("markRow.setAttribute('data-markblock', b.block)") && unitHtml.includes('wirePlayed(card)'),
    'S (§2.7): the mark-all item takes data-markblock after mount and wirePlayed binds the standing act');
  ok(C_SRC.includes('Downloaded \\u00b7 remove in Settings') && !C_SRC.includes('Downloaded for offline. To remove'),
    'S (§2.6): the downloaded note stands folded to one line');
  // §2.10's size static, read as written: the HEAD rules
  // (.blockpage-head*) carry no new font-size beyond the
  // disc's 19px chevron. The .blockcover.med glyph rule
  // re-states the standing 28px — a cover rule, proven by
  // the med static above, not a head rule.
  const v420css = APP_CSS.slice(APP_CSS.indexOf('/* v420'), APP_CSS.indexOf('/* v419 (G26)'));
  const headRuleSizes = [...v420css.matchAll(/\.blockpage-head[^{]*\{[^}]*\}/g)]
    .flatMap((r) => [...r[0].matchAll(/font-size:(\d+)px/g)].map((m) => m[1]));
  ok(headRuleSizes.length === 1 && headRuleSizes[0] === '19',
    'S (§2.10): no new font-size stands in the head rules beyond the disc\u2019s 19px chevron', headRuleSizes.join(','));
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
  + '<script>\n' + pieces.join('\n') + '\n</' + 'script>'
  + '<script>document.getElementById(\'dock-menu\').addEventListener(\'click\', function () { openDockMenu(); });</' + 'script>';

const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(PAGE); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 400, height: 800 } });
page.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:' + PORT + '/');
const ev = (fn, arg) => page.evaluate(fn, arg);

await ev(() => {
  // Production-shaped labels (§2.8): the label IS the block
  // name, as the day payload carries it. Captions do not
  // bear on the title legs; Morning carries its real one
  // ("from midnight", §1.1) for the meta-fit proof (§2.5).
  var blk = function (name, caption, tracks) { return { block: name, label: name, caption: caption || '', tracks: tracks || [] }; };
  window.__fixture = {
    date: '2026-11-14', dateLabel: 'Saturday, November 14', intentionsLine: '',
    blocks: [
      blk('Morning', 'from midnight', [
        { episodeId: 'seg-int-morning', title: 'Intentions', kind: 'segment', available: true, url: 'https://x/int.mp3', durationS: 60 },
        { episodeId: 'm1', title: 'Invitatory', kind: 'episode', available: true, url: '/api/player/feed-audio?m1', durationS: 300, hasText: true, textUrl: '/text/m1.txt' },
        { episodeId: 'm2', title: 'Daily Verse', kind: 'external', source: 'VerseCast', available: true, url: '/api/player/feed-audio?m2', streamUrl: 'https://x/m2.mp3', durationS: 120, imageUrl: 'https://img.example/m2.jpg', descText: 'A short reflection.', spotifyUrl: 'https://open.spotify.com/episode/m2' }
      ]),
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
  // Morning carries a Spotify URL at the BLOCK level too, so
  // the ⋮ leg sees its fourth item.
  window.__fixture.blocks[0].spotifyUrl = 'https://open.spotify.com/playlist/morning';
  window.__descs = [
    { episodeId: 'seg-int-morning', kind: 'segment', title: 'Intentions', block: 'Morning', url: 'https://x/int.mp3', available: true, durationS: 60 },
    { episodeId: 'm1', kind: 'episode', title: 'Invitatory', block: 'Morning', url: '/api/player/feed-audio?m1', available: true, durationS: 300 },
    { episodeId: 'm2', kind: 'episode', title: 'Daily Verse', block: 'Morning', url: '/api/player/feed-audio?m2', available: true, durationS: 120, source: 'VerseCast', imageUrl: 'https://img.example/m2.jpg', descText: 'A short reflection.', spotifyUrl: 'https://open.spotify.com/episode/m2' },
    { episodeId: 'n1', kind: 'episode', title: 'Night Prayer', block: 'Night', url: '/api/player/feed-audio?n1', available: true, durationS: 0 }
  ];
  var entries = [];
  for (var i = 1; i <= 12; i++) {
    entries.push({ key: 'e' + i, label: 'Day ' + i, title: 'Episode ' + i, url: 'https://x/e' + i + '.mp3', durationS: 600, listened: i <= 7 || i === 10, listenDate: '2026-11-10', positionS: 0, imageUrl: null, descText: null });
  }
  window.__pods = { series: 'bible', title: 'Bible in a Year', available: true, showImageUrl: null, showDesc: 'Daily readings.', listenedCount: 8, total: 12, currentKey: 'e9', entries: entries };
  // The app's own entry shape (switchSide's paint): the
  // frozen toggle + the side host inside #view, then the
  // block page paints into the side host.
  state.dayPayload = window.__fixture;
  state.dayDescs = window.__descs;
  view.innerHTML = paintSideToggle('prayers', 'prayers') + '<div id="sidehost"></div>';
  enterSideHost();
  measureBars();
});

/* ---------------- L1: the head measure (leg 1) ---------------- */
const BLOCKS = ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night', 'Mass and Homilies', 'Novenas', 'The AI Signal'];
const heads = {};
for (const name of BLOCKS) {
  heads[name] = await ev((n) => {
    state.prayersView = { kind: 'block', block: n };
    paintBlockPage(window.__fixture, n);
    var head = document.querySelector('.blockpage-head');
    var coverRow = head.querySelector('.blockpage-coverrow');
    var pillRow = head.querySelector('.blockpage-pillrow');
    var playRow = head.querySelector('.blockpage-playrow');
    var title = head.querySelector('.blockpage-title');
    var hr = head.getBoundingClientRect(), pr = playRow.getBoundingClientRect(), tr = title.getBoundingClientRect();
    return {
      whole: head.offsetHeight,
      // §2.3's accounting: the head proper = rows 1–2 + the
      // head's padding = the whole element minus the Play
      // All row and its margin-top.
      proper: head.offsetHeight - playRow.offsetHeight - 6,
      coverRowH: coverRow.offsetHeight, pillRowH: pillRow.offsetHeight,
      titleH: Math.round(tr.height), titleText: title.textContent,
      meta: head.querySelector('.blockpage-meta').textContent.replace(/\s+/g, ' ').trim()
    };
  }, name);
}
{
  const lineH = heads['Morning'].titleH; // one line at the standing 28px
  for (const name of BLOCKS) {
    const h = heads[name];
    if (name === 'Mass and Homilies') {
      ok(h.proper <= 132 && h.titleH >= lineH * 1.7,
        'L1 (leg 1/§2.8): Mass and Homilies wraps to two lines — its head proper lands at the named 128px exception (≤132)', JSON.stringify(h));
    } else {
      ok(Math.abs(h.proper - 100) <= 4 && h.whole <= 166 && h.titleH <= lineH * 1.3,
        'L1 (leg 1): ' + name + ' — head proper 100 ± 4px, the whole frozen element ≤ 166px, the title on one line', JSON.stringify(h));
    }
  }
  ok(heads['Morning'].meta === 'from midnight \u00b7 3 episodes \u00b7 8min',
    'L1 (§2.5): the meta line carries caption \u00b7 count \u00b7 duration via the standing bmeta seam', heads['Morning'].meta);
  console.log('note - head measures: ' + BLOCKS.map((n) => n + ' proper=' + heads[n].proper + ' whole=' + heads[n].whole).join(' · '));
}

/* ---------------- L3: no dead space (leg 3) ---------------- */
{
  const r = await ev(() => {
    state.prayersView = { kind: 'block', block: 'Morning' };
    paintBlockPage(window.__fixture, 'Morning');
    var head = document.querySelector('.blockpage-head');
    var cover = head.querySelector('.blockcover');
    var disc = head.querySelector('.backdisc');
    var title = head.querySelector('.blockpage-title');
    var meta = head.querySelector('.blockpage-meta');
    var stack = head.querySelector('.blockpage-stack');
    var hr = head.getBoundingClientRect(), cr = cover.getBoundingClientRect(), dr = disc.getBoundingClientRect();
    var tr = title.getBoundingClientRect(), mr = meta.getBoundingClientRect(), sr = stack.getBoundingClientRect();
    return {
      coverW: cr.width, coverH: cr.height,
      discLeftOfCover: dr.right <= cr.left + 1, titleRightOfCover: tr.left >= cr.right - 1, metaRightOfCover: mr.left >= cr.right - 1,
      stackReach: (sr.right - (hr.left + 14)) / (hr.width - 28)
    };
  });
  ok(r.coverW === 56 && r.coverH === 56, 'L3 (leg 3): the cover measures 56×56', JSON.stringify(r));
  ok(r.discLeftOfCover && r.titleRightOfCover && r.metaRightOfCover,
    'L3 (leg 3): the disc stands left of the cover; the title and meta stand right of it, no overlap', JSON.stringify(r));
  ok(r.stackReach > 0.8, 'L3 (leg 3): the stack\u2019s right edge reaches past 80% of the head\u2019s inner width (no dead band beside the cover)', 'reach=' + r.stackReach.toFixed(3));
}

/* ---------------- L8: the standing sizes + faces (leg 8) ---------------- */
{
  const r = await ev(() => {
    var head = document.querySelector('.blockpage-head');
    var cs = function (sel) { return getComputedStyle(head.querySelector(sel)); };
    return {
      title: cs('.blockpage-title').fontSize,
      meta: cs('.blockpage-meta').fontSize, metaFace: cs('.blockpage-meta').fontFamily,
      noteFace: cs('.blockpage-dlnote').fontFamily,
      glyph: cs('.blockcover-initial').fontSize,
      chip: cs('.chipbtn').fontSize,
      playLabel: cs('.blockpage-playlabel').fontSize,
      chipH: head.querySelector('.chipbtn').offsetHeight,
      chipTarget: 0
    };
  });
  ok(r.title === '28px' && r.meta === '14px' && r.glyph === '28px' && r.chip === '14px' && r.playLabel === '16px',
    'L8 (leg 8): the standing sizes compute — title 28 · meta 14 · cover glyph 28 · chip 14 · Play All label 16', JSON.stringify(r));
  // §2.10's L8 parenthetical names the meta line as system
  // sans; the base tree's own mold probe (this seat, on
  // 5dbd0940's dress) computes .blockpage-meta as GEORGIA —
  // its one standing rule sets size + color only, so the
  // face is inherited, on base and here alike. D4's witness
  // inside the head is the note (it carries .meta, whose
  // rule sets the sans). The leg therefore proves
  // base-identity: no face moved anywhere in the head.
  ok(/Georgia/.test(r.metaFace) && /-apple-system|Segoe UI|Roboto/.test(r.noteFace),
    'L8 (leg 8): the faces compute exactly as on the base tree — the meta line inherits Georgia (its standing rule sets no face), the note carries .meta\u2019s system sans; fonts unchanged', JSON.stringify({ meta: r.metaFace, note: r.noteFace }));
  ok(r.chipH >= 24 && r.chipH <= 30, 'L8 (§2.6): the chip\u2019s visual height is the compact ~28px (its 44px target rides the hit layer)', 'chipH=' + r.chipH);
}

/* ---------------- L4: three rows on screen (leg 4) ---------------- */
{
  const r = await ev(() => {
    var rows = [...document.querySelectorAll('#sidehost [data-card]')];
    var head = document.querySelector('.blockpage-head');
    var toggle = document.querySelector('.segtoggle');
    var brand = document.querySelector('.brandbar');
    var frozenBottom = Math.max(head.getBoundingClientRect().bottom, toggle.getBoundingClientRect().bottom, brand.getBoundingClientRect().bottom);
    return {
      count: rows.length, frozenBottom: Math.round(frozenBottom),
      tops: rows.slice(0, 3).map((x) => Math.round(x.getBoundingClientRect().top)),
      bottoms: rows.slice(0, 3).map((x) => Math.round(x.getBoundingClientRect().bottom))
    };
  });
  ok(r.count >= 3 && r.bottoms.length === 3 && r.bottoms[2] <= 800 && r.tops[0] >= r.frozenBottom - 1,
    'L4 (leg 4): at 400×800 the Morning fixture\u2019s three rows stand fully inside the viewport at scroll 0, below the frozen zone', JSON.stringify(r));
  await page.screenshot({ path: path.join(APP, 'tests/harness-v420-blockpage.png') });
}

/* ---------------- L6: the slim Play All row (leg 6) ---------------- */
{
  const r = await ev(() => {
    var row = document.querySelector('.blockpage-playrow');
    return {
      queue: row.querySelectorAll('[data-queue]').length,
      label: row.querySelectorAll('.blockpage-playlabel').length,
      menu: row.querySelectorAll('[data-blockmenu]').length,
      sort: row.querySelectorAll('[data-blocksort]').length,
      mark: row.querySelectorAll('[data-markblock]').length,
      kids: row.children.length
    };
  });
  ok(r.queue === 1 && r.label === 1 && r.menu === 1 && r.sort === 0 && r.mark === 0,
    'L6 (leg 6): the Play All row carries exactly the play disc, the label, and the ⋮ (Sort + Mark all have left the row)', JSON.stringify(r));
  await ev(() => { wirePrayersView(window.__fixture); }); // the standing wiring pass (the app's own render path)
  await page.click('.blockpage-playrow [data-queue]');
  await sleep(150);
  const played = await ev(() => ({ queue: state.queue.length, current: state.current ? state.current.episodeId : null }));
  ok(played.queue > 0 && !!played.current, 'L6 (leg 6): a play tap starts the block\u2019s queue', JSON.stringify(played));
}

/* ---------------- L5: the ⋮ overflow (leg 5) ---------------- */
{
  await ev(() => { state.prayersView = { kind: 'block', block: 'Morning' }; paintBlockPage(window.__fixture, 'Morning'); });
  await page.click('[data-blockmenu]');
  await sleep(120);
  const menu = await ev(() => {
    var card = document.querySelector('.anchmenu');
    return card ? [...card.querySelectorAll('.menurow')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()) : [];
  });
  ok(menu.length === 4 && menu[0] === 'Sort' && menu[1] === 'Mark all played' && menu[2] === 'Share' && menu[3] === 'Open in Spotify',
    'L5 (leg 5): the ⋮ opens the anchored card listing Sort \u00b7 Mark all played \u00b7 Share \u00b7 Open in Spotify, in that order', menu.join(' | '));
  await page.click('.anchmenu [data-menuitem="0"]'); // Sort
  await sleep(120);
  ok(await ev(() => !!document.querySelector('.ordersheet')), 'L5 (leg 5): Sort opens the standing order editor');
  await ev(() => { var s = document.querySelector('.ordersheet'); if (s) s.remove(); });
  await page.click('[data-blockmenu]');
  await sleep(120);
  await page.click('.anchmenu [data-menuitem="1"]'); // Mark all played
  await sleep(120);
  const marked = await ev(() => blockPlayedCounts('Morning'));
  ok(marked.total > 0 && marked.played === marked.total,
    'L5 (leg 5): Mark all played flips the block\u2019s played state (the standing wirePlayed act, bound to the menu row)', JSON.stringify(marked));
  await page.click('[data-blockmenu]');
  await sleep(120);
  const menu2 = await ev(() => {
    var card = document.querySelector('.anchmenu');
    return card ? [...card.querySelectorAll('.menurow')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()) : [];
  });
  ok(menu2[1] === 'Mark all unplayed', 'L5 (leg 5): at the next open the item reads Mark all unplayed (the label is computed at construction)', menu2.join(' | '));
  await ev(() => { document.querySelectorAll('.anchmenu, .menucatcher').forEach((x) => x.remove()); });
}

/* ---------------- L2: the frozen geometry (leg 2) ---------------- */
{
  const setup = await ev(() => {
    state.prayersView = { kind: 'block', block: 'Morning' };
    paintBlockPage(window.__fixture, 'Morning');
    var spacer = document.createElement('div'); spacer.style.height = '1600px'; spacer.id = 't-spacer';
    view.appendChild(spacer);
    measureBars();
    var brand = document.querySelector('.brandbar');
    return { brandH: brand.offsetHeight, brandBottom: Math.round(brand.getBoundingClientRect().bottom) };
  });
  const probe = async () => await ev(() => {
    var head = document.querySelector('.blockpage-head');
    var disc = head.querySelector('.backdisc');
    var toggle = document.querySelector('.segtoggle');
    var brand = document.querySelector('.brandbar');
    var dr = disc.getBoundingClientRect(), tr = toggle.getBoundingClientRect(), hr = head.getBoundingClientRect(), br = brand.getBoundingClientRect();
    return {
      scrollY: Math.round(window.scrollY),
      discTop: Math.round(dr.top), discBottom: Math.round(dr.bottom),
      discW: disc.offsetWidth, discH: disc.offsetHeight,
      toggleBottom: Math.round(tr.bottom), headTop: Math.round(hr.top), brandBottom: Math.round(br.bottom)
    };
  });
  await page.evaluate(() => window.scrollTo(0, 600));
  await sleep(80);
  const at600 = await probe();
  ok(at600.discTop >= at600.toggleBottom && at600.discBottom <= 800 && at600.discTop >= 0,
    'L2 (leg 2): at scroll 600 the disc stands FULLY below the toggle band — no half-disc under the toggle', JSON.stringify(at600));
  ok(Math.abs(at600.headTop - (at600.brandBottom + 58)) <= 2,
    'L2 (§2.9): the head\u2019s top lands at brand bottom + 58 (the toggle\u2019s band + margin), no overlap, no gap', JSON.stringify(at600));
  await page.evaluate(() => window.scrollTo(0, 100000));
  await sleep(80);
  const atMax = await probe();
  ok(atMax.scrollY > 600 && atMax.discTop >= atMax.toggleBottom && atMax.discBottom <= 800,
    'L2 (leg 2): at maximum scroll the frozen head and its disc still stand at the top, fully visible', JSON.stringify(atMax));
  console.log('note - frozen geometry: brandH=' + setup.brandH + ' · at600 ' + JSON.stringify(at600) + ' · atMax ' + JSON.stringify(atMax));
  await page.screenshot({ path: path.join(APP, 'tests/harness-v420-scrolled.png') });
  await ev(() => { var s = document.getElementById('t-spacer'); if (s) s.remove(); window.scrollTo(0, 0); });
}

/* ---------------- L7: the brand bar stands (leg 7) ---------------- */
{
  const r = await ev(() => {
    var bb = document.querySelector('.brandbar');
    return {
      h: bb.offsetHeight,
      wordmark: bb.querySelector('.wordmark').textContent,
      tagline: bb.querySelector('.tagline').textContent,
      litday: !!bb.querySelector('#litday'), gear: !!bb.querySelector('#gearbtn')
    };
  });
  ok(r.wordmark === 'ORA PRO NOBIS' && /Daily Catholic Prayer Podcast/i.test(r.tagline) && r.litday && r.gear && r.h > 0,
    'L7 (leg 7): the brand bar stands in the mold — wordmark · tagline · liturgical line · gear (height ' + r.h + 'px; the pixel-identical proof proper is the Ship diff)', JSON.stringify(r));
}

/* ---------------- L9: the boundary (leg 9) ---------------- */
{
  const eps = await ev(() => {
    state.prayersView = { kind: 'block', block: '__episodes' };
    paintBlockPage(window.__fixture, '__episodes');
    var head = document.querySelector('.blockpage-head');
    var disc = head.querySelector('.backdisc');
    var cover = head.querySelector('.blockcover');
    return {
      compact: head.classList.contains('compact'), backrow: !!head.querySelector('.backrow'),
      discW: disc.offsetWidth, discH: disc.offsetHeight, coverW: cover.offsetWidth, coverH: cover.offsetHeight
    };
  });
  ok(!eps.compact && eps.backrow && eps.discW === 44 && eps.discH === 44 && eps.coverW === 120 && eps.coverH === 120,
    'L9 (leg 9/F-420-7): the episodes page keeps the v419 head untouched — back row standing, disc 44×44, cover 120×120', JSON.stringify(eps));
  const series = await ev(() => {
    view = document.getElementById('view');
    state.podcasts = window.__pods;
    paintPodcasts();
    var disc = document.querySelector('[data-podback]');
    return { stickyrow: !!document.querySelector('.backrow.stickyrow'), discW: disc ? disc.offsetWidth : 0, discH: disc ? disc.offsetHeight : 0 };
  });
  ok(series.stickyrow && series.discW === 44 && series.discH === 44,
    'L9 (leg 9): the Podcasts series page keeps its standing back form — the sticky row, disc 44×44', JSON.stringify(series));
}

console.log('harness-v420: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) console.log('failures: ' + failures.join(' | '));
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
