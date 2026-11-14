// harness-v417 — the playlist UI polish (§1/§2). Client-only
// release: the legs run in headless Chromium on the v388/v413
// extraction mold, against the REAL shell (SHELL_HTML from
// ui.ts — the dock face under test is the shipped one, not a
// fixture copy) and the real client units. Legs map one-to-one
// to §1.5's five acceptance legs (§2.10):
//   S1/S2 statics (the §2.8 wiring + pin + glyph table proofs)
//   L1 compression (D1/FD8) · L2 short date (D2/FD6) ·
//   L3 iconography + the bars tile (D3/FD3/FD7) ·
//   L4 the mini player (D4/FD4) · L5 the row layout (D5/FD5).
// Screenshots of the grid + a block page are saved beside this
// file as the F-417-6 glyph-rendering evidence.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const APP = path.resolve(process.cwd(), 'app');
const SRC = path.join(APP, 'worker/src');
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('ok   - ' + name); }
  else { fail++; failures.push(name); console.log('FAIL - ' + name + (extra ? ' :: ' + String(extra).slice(0, 300) : '')); }
}

/* ---------------- S1/S2 statics ---------------- */
{
  ok(U_SRC.includes('id="dock-play"') && U_SRC.includes('id="dock-next"') && U_SRC.includes('id="dock-menu"')
    && !U_SRC.includes('id="dock-prev"') && !U_SRC.includes('id="dock-intentions"'),
    'S1: SHELL_HTML dock face = thumb · text · play · next · menu (+ progress); Previous + Intentions buttons retired');
  ok(/getElementById\('dock-menu'\)\.addEventListener\('click', function \(\) \{ openDockMenu\(\)/.test(C_SRC)
    && !C_SRC.includes("getElementById('dock-prev')")
    && (C_SRC.match(/dock-intentions/g) || []).length === 1,
    'S1: the dock menu button wires openDockMenu; no dock-prev read stands; the one dock-intentions read is syncIntentionsToggles\u2019 null-guarded leg (§2.8)');
  ok(U_SRC.includes('ora-pro-nobis-v415-1') && !U_SRC.includes('ora-pro-nobis-v417-1'),
    'S1: the SW pin is untouched at Implement (Ship moves it)');
  ok(!/#1DB954|#1ed760/i.test(C_SRC + U_SRC), 'S1: no Spotify green anywhere');
  const tabs = [...U_SRC.matchAll(/data-tab="(\w+)"/g)].map((m) => m[1]);
  ok(tabs.join(',') === 'prayers,conscience,podcasts,wallpaper', 'S1: the four tabs stand in order (frozen toggles untouched)', tabs.join(','));

  const odm = C_SRC.slice(C_SRC.indexOf('function openDockMenu'), C_SRC.indexOf('function openDockMenu') + 1600);
  ok(/function openDockMenu/.test(C_SRC) && odm.includes('Previous track') && odm.includes('previousWithRule')
    && odm.includes('setIntentions') && odm.includes('openSheetMenu'),
    'S2: openDockMenu stands on the one menu component, naming the standing acts (previousWithRule · setIntentions)');
  const opm = C_SRC.slice(C_SRC.indexOf('function openPlayerMenu'), C_SRC.indexOf('function openPlayerMenu') + 900);
  ok(opm.includes('Autoplay') && opm.includes('Sleep timer') && opm.includes('Playback speed')
    && !opm.includes('Previous') && !opm.includes('Intentions'),
    'S2 (§1.3): openPlayerMenu stands as built — exactly its three items, no transport, no intentions');
  ok(/var BLOCK_GLYPHS/.test(C_SRC)
    && ['\\u2600', '\\u2726', '\\u2756', '\\u2605', '\\u2727', '\\u263e', '\\u2020', '\\u271a', '\\u266b'].every((g) => C_SRC.includes(g)),
    'S2 (FD3): the glyph table stands with the nine named glyphs');
  ok(!C_SRC.includes('artLetter') && !/blockcover-initial">' \+ esc\(/.test(C_SRC)
    && !/\(s\.title \|\| 'P'\)\.charAt/.test(C_SRC) && !/var letter =/.test(C_SRC),
    'S2 (FD3): no tile builder emits a letter initial anywhere');
  ok(/function syncBarsRow/.test(C_SRC) && /querySelectorAll\('\[data-card\], \[data-podrow\]'\)/.test(C_SRC),
    'S2 (FD7): the bars seam extends markPlaying to [data-card] + [data-podrow]');
}

/* ---------------- client extraction (v388/v413 mold) ---------------- */
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
const APP_CSS = U_SRC.slice(U_SRC.indexOf('APP_CSS = `') + 11, U_SRC.indexOf('`;', U_SRC.indexOf('APP_CSS = `')));
const SHELL = U_SRC.slice(U_SRC.indexOf('SHELL_HTML = `') + 14, U_SRC.indexOf('`;', U_SRC.indexOf('SHELL_HTML = `')));

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
var state = { tab: 'prayers', block: null, playingKey: null, playingUrl: null, queue: [], queueIdx: -1, current: null,
  storedDay: '2026-11-14', presentedDay: '2026-11-14', dateLabel: 'Saturday, November 14', liturgical: null,
  pendingResume: null, sleep: { mode: 'off' }, readTracks: {}, dayDescs: [], dayPayload: null, playedCache: {},
  repeatIds: {}, previewQueue: null, queuePreviewIdx: -1, restoredQueue: false, restoreProbe: null, podRestoreProbe: null,
  prayersView: { kind: 'home' }, searchQuery: '', podcasts: null, podcastsIndex: null, podcastsReturn: null,
  rate: 1, errWaitKey: null, errWaitN: 0, startRetryKey: null, lastStartAt: 0,
  ownStanding: [], extStanding: [], extSlots: {}, ownSlots: {}, daySegments: {}, homeFilter: '', gridDl: {}, aiClaimed: false };
</` + `script>`;
const PAGE = PAGE_HEAD.replace('CSSHERE', () => APP_CSS).replace('SHELLHERE', () => SHELL)
  + '<script>\n' + pieces.join('\n') + '\n</' + 'script>'
  // The dock wiring the source carries (proven by S1 statics),
  // attached here because the extraction lifts declarations,
  // not the client's top-level listener statements.
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
const ev = (fn) => page.evaluate(fn);

await ev(() => {
  window.__fixture = {
    date: '2026-11-14', dateLabel: 'Saturday, November 14', intentionsLine: '',
    blocks: [
      { block: 'Morning', label: 'Morning Prayers', caption: 'Praylists', spotifyUrl: 'https://open.spotify.com/playlist/morning', tracks: [
        { episodeId: 'seg-int-morning', title: 'Intentions', kind: 'segment', available: true, url: 'https://x/int.mp3', durationS: 60 },
        { episodeId: 'm1', title: 'Invitatory', kind: 'episode', available: true, url: '/api/player/feed-audio?m1', durationS: 300, hasText: true, textUrl: '/text/m1.txt' },
        { episodeId: 'm2', title: 'Daily Verse', kind: 'external', source: 'VerseCast', available: true, url: '/api/player/feed-audio?m2', streamUrl: 'https://x/m2.mp3', durationS: 120, imageUrl: 'https://img.example/m2.jpg', descText: 'A short reflection on the day\u2019s verse.', spotifyUrl: 'https://open.spotify.com/episode/m2' },
        { episodeId: 'm3', title: 'Unread Text', kind: 'episode', available: false, url: null, durationS: 200, hasText: true, textUrl: '/text/m3.txt' },
        { episodeId: 'm4', title: 'Silent Track', kind: 'episode', available: false, url: null, durationS: 100 }
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
      { block: 'The AI Signal', label: 'The AI Signal', caption: 'Praylists', tracks: [
        { episodeId: 'the-ai-signal', title: 'The AI Signal \u2014 Daily', kind: 'episode', available: true, url: '/api/player/feed-audio?ai1', durationS: 900 }
      ] }
    ],
    episodes: [{ episodeId: 'pod-ep-1', title: 'Podcast Episode', kind: 'episode', available: true, url: 'https://x/p1.mp3', durationS: 600 }]
  };
  window.__descs = [
    { episodeId: 'seg-int-morning', kind: 'segment', title: 'Intentions', block: 'Morning', url: 'https://x/int.mp3', available: true, durationS: 60 },
    { episodeId: 'm1', kind: 'episode', title: 'Invitatory', block: 'Morning', url: '/api/player/feed-audio?m1', available: true, durationS: 300 },
    { episodeId: 'm2', kind: 'episode', title: 'Daily Verse', block: 'Morning', url: '/api/player/feed-audio?m2', available: true, durationS: 120, source: 'VerseCast', imageUrl: 'https://img.example/m2.jpg', descText: 'A short reflection.', spotifyUrl: 'https://open.spotify.com/episode/m2' },
    { episodeId: 'n1', kind: 'episode', title: 'Night Prayer', block: 'Night', url: '/api/player/feed-audio?n1', available: true, durationS: 0 }
  ];
  window.__pods = {
    title: 'Bible in a Year', showDesc: 'Daily readings with Fr. Mike.', showImageUrl: null,
    available: true, listenedCount: 1, total: 2, currentKey: 'p2',
    entries: [
      { key: 'p1', title: 'Day 315 \u2014 Genesis', label: 'Day 315', durationS: 1500, descText: 'The readings.', listened: true, listenDate: '2026-11-12', positionS: 0, imageUrl: null },
      { key: 'p2', title: 'Day 316 \u2014 Exodus', label: 'Day 316', durationS: 1400, descText: 'More readings.', listened: false, listenDate: null, positionS: 300, imageUrl: null }
    ]
  };
  window.__podsIndex = { seriesList: [
    { series: 'bible', title: 'Bible in a Year', showImageUrl: null, available: true, listenedCount: 315, total: 372, currentLabel: 'Day 316' }
  ] };
});

/* ---------------- L1: compression (D1/FD8) + L3 grid ---------------- */
{
  const r = await ev(() => {
    localStorage.clear();
    state.presentedDay = todayChicago();
    state.dayPayload = window.__fixture;
    state.dayDescs = window.__descs; state.prayersView = { kind: 'home' };
    paintListenHome(window.__fixture);
    var cards = [...document.querySelectorAll('#home-body .blockcard')];
    var cover = document.querySelector('#home-body .blockcard .blockcover');
    return {
      n: cards.length,
      coverH: cover ? getComputedStyle(cover).height : '',
      fourthTop: cards[3] ? cards[3].getBoundingClientRect().top : -1,
      viewPadL: getComputedStyle(document.getElementById('view')).paddingLeft,
      nameFs: getComputedStyle(document.querySelector('#home-body .blockcard-name2')).fontSize,
      morningGlyph: (document.querySelector('.blockcard[data-openblock="Morning"] .blockcover-initial') || {}).textContent || '',
      aiCoverImg: !!document.querySelector('.blockcard[data-openblock="The AI Signal"] .blockcover img.coverimg'),
      epGlyph: (document.querySelector('.blockcard[data-openblock="__episodes"] .blockcover-initial') || {}).textContent || '',
      stateLine: (document.querySelector('.blockcard[data-openblock="Morning"] [data-bcount]') || {}).textContent || ''
    };
  });
  ok(r.coverH === '64px', 'L1/FD8: the grid cover stands at 64px (aspect-1 retired)', r.coverH);
  ok(r.n === 10 && r.fourthTop > 0 && r.fourthTop < 800, 'L1: more stands in the first screenful \u2014 the fourth card stands inside the 800px viewport', 'n=' + r.n + ' top=' + r.fourthTop);
  ok(r.viewPadL === '12px', 'L1/FD8: the view side padding is 12px', r.viewPadL);
  ok(r.nameFs === '16px', 'L1/FD8: text sizes unchanged \u2014 the grid card name stands at 16px', r.nameFs);
  ok(r.stateLine === '5 tracks', 'L2/FD6: the grid state line reads N tracks \u2014 no clock, no caption segment', r.stateLine);
  ok(r.morningGlyph === '\u2600' && r.epGlyph === '\u266b' && r.aiCoverImg,
    'L3/FD3: grid covers carry glyphs (Morning \u2600 \u00b7 episodes \u266b); The AI Signal\u2019s cover is its logo image',
    JSON.stringify({ m: r.morningGlyph, e: r.epGlyph, ai: r.aiCoverImg }));
  await page.screenshot({ path: path.join(APP, 'tests/harness-v417-grid.png') });
}

/* ---------------- L1 rows + L2 dates + L5 layout (block page) ---------------- */
{
  const r = await ev(() => {
    state.presentedDay = '2026-11-10';
    state.dayDescs = window.__descs;
    paintBlockPage(window.__fixture, 'Morning');
    var row = document.querySelector('[data-card="m1"]');
    var cs = getComputedStyle(row);
    var extMeta = (document.querySelector('[data-card="m2"] .meta') || {}).textContent || '';
    var allMetas = [...document.querySelectorAll('.card.trow .meta')].map((m) => m.textContent);
    var grow = row.querySelector('.grow'); var card = row.getBoundingClientRect(); var gr = grow.getBoundingClientRect();
    var ctl = row.querySelector('.prow-ctl');
    var order = [...ctl.querySelectorAll('[data-read],[data-rowmenu],[data-rowshare],[data-rowdl],[data-playkey],[data-markplayed]')]
      .map((el) => ['data-read', 'data-rowmenu', 'data-rowshare', 'data-rowdl', 'data-playkey', 'data-markplayed'].filter((a) => el.hasAttribute(a))[0]);
    var m3ctl = document.querySelector('[data-card="m3"] .prow-ctl');
    return {
      padT: cs.paddingTop, padL: cs.paddingLeft,
      h3Fs: getComputedStyle(row.querySelector('h3')).fontSize,
      metaFs: getComputedStyle(row.querySelector('.meta')).fontSize,
      wrapW: getComputedStyle(row.querySelector('.rowartwrap')).width,
      extMeta,
      clockAnywhere: allMetas.some((t) => /\bAM\b|\bPM\b/.test(t)),
      isoAnywhere: allMetas.some((t) => /2026-11-10/.test(t)),
      growRightGap: Math.abs((card.right - 10) - gr.right),
      ctlSecond: ctl && ctl.getBoundingClientRect().top >= row.querySelector('.row').getBoundingClientRect().bottom - 1,
      justify: getComputedStyle(ctl).justifyContent,
      order,
      dotLast: ctl.lastElementChild && ctl.lastElementChild.hasAttribute('data-markplayed'),
      m3Order: m3ctl ? [...m3ctl.children].map((el) => el.tagName + ':' + (el.getAttribute('data-read') ? 'read' : '?')) : null,
      m4Ctl: !!document.querySelector('[data-card="m4"] .prow-ctl'),
      tileText: (row.querySelector('.rowart.tile > span') || {}).textContent || ''
    };
  });
  ok(r.padT === '8px' && r.padL === '10px', 'L1/FD8: the prow row padding is 8px/10px', r.padT + '/' + r.padL);
  ok(r.h3Fs === '17px' && r.metaFs === '14px', 'L1/FD8: text sizes unchanged \u2014 row title 17px, meta 14px', r.h3Fs + '/' + r.metaFs);
  ok(r.wrapW === '44px', 'L1/FD8: the row tile stands at 44px', r.wrapW);
  ok(r.extMeta.indexOf('Nov 10') === 0 && /VerseCast/.test(r.extMeta) && !r.clockAnywhere && !r.isoAnywhere,
    'L2/D2: a non-today presented day reads the short form; the source stands; no time-of-day (AM/PM) or ISO date stands in any row meta \u2014 the \u20182:00\u2019 in the meta is the standing duration form (v413 L5\u2019s own assertion)', r.extMeta);
  ok(r.growRightGap <= 2, 'L5/D5: the words spread the full row width \u2014 .grow reaches the card\u2019s inner right edge', 'gap=' + r.growRightGap);
  ok(r.ctlSecond && r.justify === 'flex-end', 'L5/D5: the controls stand on their own line under the words, right-aligned');
  ok(r.order.join(',') === 'data-read,data-rowmenu,data-rowshare,data-rowdl,data-playkey,data-markplayed' && r.dotLast,
    'L5/FD5: controls order = Read \u00b7 \u22ee \u00b7 share \u00b7 downloaded \u00b7 play \u00b7 played dot LAST', r.order.join(','));
  ok(r.m3Order && r.m3Order.length === 1 && /read/.test(r.m3Order[0]), 'L5/FD5: an unavailable row with text carries Read alone on its controls line', JSON.stringify(r.m3Order));
  ok(!r.m4Ctl, 'L5/FD5: an unavailable row without text carries no controls line');
  ok(r.tileText === '\u2600', 'L3/FD3: the Morning row tile carries its glyph, not a letter', r.tileText);
  const t2 = await ev(() => {
    state.presentedDay = todayChicago();
    paintBlockPage(window.__fixture, 'Morning');
    return (document.querySelector('[data-card="m2"] .meta') || {}).textContent || '';
  });
  ok(t2.indexOf('Today') === 0, 'L2/D2: the presented day IS today \u2192 the meta reads \u2018Today\u2019', t2);
  await ev(() => {
    // The day-load path fills readTracks in production; the
    // fixture fills it the same way so the wired Read tap
    // finds its track. wirePrayersView is the router's
    // standing wiring pass after every Prayers paint — the
    // fixture runs it as production does.
    var tr = window.__fixture.blocks[0].tracks;
    state.readTracks = { m1: tr[1], m3: tr[3] };
    wirePrayersView(window.__fixture);
  });
  await page.click('[data-card="m1"] [data-read]');
  await sleep(120);
  const rd = await ev(() => !!document.querySelector('.readsheet'));
  ok(rd, 'L5: the Read chip opens the reading view');
  await ev(() => { document.querySelectorAll('.readsheet').forEach((x) => x.remove()); });
  await page.click('[data-card="m1"] [data-markplayed]');
  await sleep(200);
  const dt = await ev(() => isPlayed('m1', presentedDateStr(), 'Morning'));
  ok(dt === true, 'L5: the played dot (LAST in the line) writes the played state \u2014 its \u2018on\u2019 dress follows via refreshPlayedChrome, stubbed on this mold as on v413\u2019s');
}

/* ---------------- L3: bars tile + letter scan + Podcasts ---------------- */
{
  const ai = await ev(() => {
    paintBlockPage(window.__fixture, 'The AI Signal');
    var img = document.querySelector('[data-card="the-ai-signal"] img.rowart');
    return { src: img ? img.getAttribute('src') : '', letters: [...document.querySelectorAll('.blockcover-initial, .rowart.tile > span')].map((s) => s.textContent) };
  });
  ok(ai.src === '/logo.png', 'L3/FD3: The AI Signal\u2019s rows carry its real logo', ai.src);
  const bars = await ev(() => {
    state.presentedDay = todayChicago();
    paintBlockPage(window.__fixture, 'Morning');
    state.current = { episodeId: 'm1', title: 'Invitatory', block: 'Morning', url: '/api/player/feed-audio?m1' };
    Object.defineProperty(audioEl, 'paused', { configurable: true, get: function () { return false; } });
    markPlaying('m1');
    var row = document.querySelector('[data-card="m1"]');
    var tile = row.querySelector('.barstile');
    var playing = { row: row.classList.contains('barsrow'), pausedCls: row.classList.contains('barspaused'),
      disp: tile ? getComputedStyle(tile).display : '', btn: row.querySelector('[data-playkey]').textContent };
    Object.defineProperty(audioEl, 'paused', { configurable: true, get: function () { return true; } });
    syncBarsPaused();
    var paused = { pausedCls: row.classList.contains('barspaused'),
      anim: tile ? getComputedStyle(tile.querySelector('i')).animationPlayState : '' };
    return { playing, paused };
  });
  ok(bars.playing.row && !bars.playing.pausedCls && bars.playing.disp === 'flex' && bars.playing.btn === '\u2759\u2759',
    'L3/FD7: the playing row\u2019s tile becomes the bars tile (shown, animating) and its play button keeps the \u275a\u275a dress', JSON.stringify(bars.playing));
  ok(bars.paused.pausedCls && bars.paused.anim === 'paused',
    'L3/FD7: paused \u2192 the bars stand frozen on the same row (animation-play-state: paused)', JSON.stringify(bars.paused));
  await page.screenshot({ path: path.join(APP, 'tests/harness-v417-rows.png') });
  const pods = await ev(() => {
    state.podcastsIndex = window.__podsIndex;
    paintPodcastsIndex();
    var idxTile = (document.querySelector('[data-podseries] .rowart.tile > span') || {}).textContent || '';
    var idxLetters = [...document.querySelectorAll('.rowart.tile > span')].map((s) => s.textContent);
    state.podcasts = window.__pods;
    paintPodcasts();
    var headGlyph = (document.querySelector('.podpage-head .blockcover-initial') || {}).textContent || '';
    var p1 = document.querySelector('[data-podrow="p1"]');
    var p2 = document.querySelector('[data-podrow="p2"]');
    var ctlOrder = [...p2.querySelectorAll('.prow-ctl [data-podmenu], .prow-ctl [data-podshare], .prow-ctl [data-poddlstate], .prow-ctl [data-podplay], .prow-ctl [data-podmark]')]
      .map((el) => ['data-podmenu', 'data-podshare', 'data-poddlstate', 'data-podplay', 'data-podmark'].filter((a) => el.hasAttribute(a))[0]);
    return {
      idxTile, idxLetters, headGlyph,
      p1Meta: (p1.querySelector('.meta') || {}).textContent || '',
      ctlOrder,
      podbar: !!p2.querySelector('.podbar'),
      rowLetters: [...document.querySelectorAll('.rowart.tile > span')].map((s) => s.textContent)
    };
  });
  ok(pods.idxTile === '\u266b' && pods.headGlyph === '\u266b',
    'L3/FD3: the Podcasts index tile and the series head cover carry \u266b, never a letter', pods.idxTile + '/' + pods.headGlyph);
  ok(/Listened Nov 12/.test(pods.p1Meta), 'L2/D2: the listened date stands in the meta line in short form (\u00b7 Listened Nov 12)', pods.p1Meta);
  ok(pods.ctlOrder.join(',') === 'data-podmenu,data-podshare,data-poddlstate,data-podplay,data-podmark',
    'L5/FD5: the podcast controls line = \u22ee \u00b7 share \u00b7 downloaded \u00b7 play \u00b7 podmark (after play)', pods.ctlOrder.join(','));
  ok(pods.podbar, 'L5: the partway bar stands at the podcast row\u2019s bottom edge, unmoved');
  const allTiles = ai.letters.concat(pods.idxLetters, pods.rowLetters);
  ok(allTiles.length > 0 && allTiles.every((t) => !/^[A-Za-z]$/.test(t)),
    'L3/FD3: no single-letter tile text stands on any painted surface', JSON.stringify(allTiles));
}

/* ---------------- L4: the mini player (D4/FD4) ---------------- */
{
  const face = await ev(() => [...document.querySelectorAll('#dock button')].map((b) => b.id));
  ok(face.join(',') === 'dock-play,dock-next,dock-menu',
    'L4/D4: the dock face carries play + next + \u22ee only (thumb · text · progress stand)', face.join(','));
  const withQ = await ev(() => {
    previousWithRule = function () { window.__prev = (window.__prev || 0) + 1; };
    state.queue = window.__descs.slice(1, 3); state.queueIdx = 0;
    state.current = window.__descs[1];
    updateDock(); // the dock shows while a current stands
    document.getElementById('dock-menu').click();
    return true;
  });
  await sleep(120);
  const menu1 = await ev(() => ({
    title: (document.querySelector('.menusheet h1') || {}).textContent || '',
    labels: [...document.querySelectorAll('.menusheet [data-menuitem]')].map((b) => b.querySelector('span').textContent)
  }));
  ok(menu1.title === 'Playback' && menu1.labels.join('|') === 'Previous track|Intentions|Autoplay|Sleep timer|Playback speed',
    'L4/FD4: the dock \u22ee opens the dock menu \u2014 Previous (queue standing) \u00b7 Intentions \u00b7 Autoplay \u00b7 Sleep timer \u00b7 Playback speed', JSON.stringify(menu1));
  await page.click('.menusheet [data-menuitem="0"]');
  await sleep(120);
  const prev = await ev(() => ({ n: window.__prev || 0, sheet: !!document.querySelector('.menusheet') }));
  ok(prev.n === 1 && !prev.sheet, 'L4/FD4: Previous track acts the one standing rule (previousWithRule) and the menu closes', JSON.stringify(prev));
  const noQ = await ev(() => { state.queue = []; openDockMenu();
    return [...document.querySelectorAll('.menusheet [data-menuitem]')].map((b) => b.querySelector('span').textContent); });
  ok(noQ.join('|') === 'Intentions|Autoplay|Sleep timer|Playback speed',
    'L4/FD4: no queue \u2192 no Previous item stands (no dead items)', noQ.join('|'));
  const before = await ev(() => localStorage.getItem('opn-intentions-v384'));
  await page.click('.menusheet [data-menuitem="0"]');
  await sleep(150);
  const intFlip = await ev(() => ({
    after: localStorage.getItem('opn-intentions-v384'),
    state: (document.querySelector('.menusheet [data-menustate="0"]') || {}).textContent || '',
    open: !!document.querySelector('.menusheet')
  }));
  ok(intFlip.after !== before && intFlip.open && /On|Off/.test(intFlip.state),
    'L4/FD4: Intentions flips the store in place (stay item; the retired dock button\u2019s identical act \u2014 and syncIntentionsToggles runs clean with no dock button)', JSON.stringify({ before, ...intFlip }));
  const np = await ev(() => { document.querySelectorAll('.menusheet').forEach((x) => x.remove()); openPlayerMenu();
    return [...document.querySelectorAll('.menusheet [data-menuitem]')].map((b) => b.querySelector('span').textContent); });
  ok(np.join('|') === 'Autoplay|Sleep timer|Playback speed',
    'L4 (§1.3): the Now Playing sheet\u2019s \u22ee still opens exactly the three standing items', np.join('|'));
  await ev(() => { document.querySelectorAll('.menusheet').forEach((x) => x.remove()); });
}

console.log('harness-v417: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) console.log('failures: ' + failures.join(' | '));
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
