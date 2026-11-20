// harness-v419 — the UI overhaul: GoalPost's design language
// (§1/§2 of the v419 release document). Client-only release:
// ui.ts (APP_CSS + the SHELL_HTML tab pill) + client.ts.
// Client legs run in headless Chromium on the v388/v417
// extraction mold (real SHELL_HTML + APP_CSS, fixture state).
// No Worker legs: index.ts stands byte-untouched (the pin
// static below is the client-side witness; Ship moves the
// pin to ora-pro-nobis-v419-1).
//   S  statics (tokens · retirements · the pin)
//   L1 foundations (button forms · the sans layer · the
//      floor audit · the pressed shade + its contrast
//      routine · the focus ring)
//   L2 Prayers (the back disc + the frozen heads · the AI
//      bolt · the home heading)
//   L3 Podcasts (F-419-3's collapse)
//   L4 player/dock (the tab pill · the held Read slot · the
//      queue's liblist form)
//   L5 sheets + menus (drawers FIT/TALL · the grab · the
//      scrim · the anchored cards · the confirm)
//   L6 forms (skeletons · the authored errors + Retry · the
//      PIN hint · the Settings unsaved count)
//   L7 conscience + wallpaper (the Cmdt. chips · the
//      liblist radius conformance)
import { readFileSync } from 'node:fs';
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
const APP_CSS = U_SRC.slice(U_SRC.indexOf('APP_CSS = `') + 11, U_SRC.indexOf('`;', U_SRC.indexOf('APP_CSS = `')));
const SHELL = U_SRC.slice(U_SRC.indexOf('SHELL_HTML = `') + 14, U_SRC.indexOf('`;', U_SRC.indexOf('SHELL_HTML = `')));

/* ---------------- S: statics ---------------- */
{
  ok(U_SRC.includes('ora-pro-nobis-v417-1') && !U_SRC.includes('ora-pro-nobis-v419-1'),
    'S: the SW pin is untouched at Implement (Ship moves it)');
  ok(/--muted:#6d6353/.test(APP_CSS) && /--danger:#8a2a2a/.test(APP_CSS) && /--sans:-apple-system/.test(APP_CSS) && /--card-2:#f3ecd9/.test(APP_CSS),
    'S (G2/G3/G5): the overhaul tokens stand in :root (--muted · --danger · --sans · --card-2)');
  ok((APP_CSS.match(/#6d6353/g) || []).length === 2 && (APP_CSS.match(/#8a2a2a/g) || []).length === 1,
    'S (G3/G5): the hex literals stand only at the token definitions (+ the one named theme value)',
    'muted=' + (APP_CSS.match(/#6d6353/g) || []).length + ' danger=' + (APP_CSS.match(/#8a2a2a/g) || []).length);
  ok(/'The AI Signal': '\\u26a1'/.test(C_SRC), 'S (G11): BLOCK_GLYPHS carries The AI Signal at the bolt');
  const cth = C_SRC.slice(C_SRC.indexOf('function coverTileHtml'), C_SRC.indexOf('function rowArtHtml'));
  const rah = C_SRC.slice(C_SRC.indexOf('function rowArtHtml'), C_SRC.indexOf('function fmtDurLong'));
  ok(!cth.includes('logo.png') && !rah.includes('logo.png'), 'S (G11): no logo tile stands in the cover/row art seams');
  ok(!C_SRC.includes('backbtn') && !/\.backbtn\s*\{/.test(APP_CSS) && !/\.backbtn\.cream/.test(APP_CSS), 'S (G10): the text back button is retired (no emit, no rule)');
  ok(!/\.modes\s*\{/.test(APP_CSS) && !/\.modes button/.test(APP_CSS) && !C_SRC.includes('class="modes"'), 'S (G9): the bespoke .modes construction is retired (no rule, no emit)');
  ok(!C_SRC.includes('confirm(') && !C_SRC.includes('alert('), 'S (G23): no native confirm/alert stands in the client');
  ok(!C_SRC.includes('Loading...') && !C_SRC.includes('Loading&hellip;'), 'S (G21): no text loading marker stands in the client');
  ok(/function openSheetMenu/.test(C_SRC) && C_SRC.includes('anchmenu') && /function mountDrawer/.test(C_SRC) && /function openConfirm/.test(C_SRC) && /function skelHtml/.test(C_SRC),
    'S: the drawer mount + the anchored menu + the confirm + the skeleton builder stand');
  ok(!C_SRC.includes('data-menuclose') && !C_SRC.includes('data-shareclose') && !C_SRC.includes('data-orderclose') && !C_SRC.includes('data-readclose') && !C_SRC.includes('np-min'),
    'S (G13/G16): the ghost Close/Done headers and the minimize buttons are retired');
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
const ev = (fn) => page.evaluate(fn);

await ev(() => {
  window.__fixture = {
    date: '2026-11-14', dateLabel: 'Saturday, November 14', intentionsLine: '',
    blocks: [
      { block: 'Morning', label: 'Morning Prayers', caption: 'Praylists', spotifyUrl: 'https://open.spotify.com/playlist/morning', tracks: [
        { episodeId: 'seg-int-morning', title: 'Intentions', kind: 'segment', available: true, url: 'https://x/int.mp3', durationS: 60 },
        { episodeId: 'm1', title: 'Invitatory', kind: 'episode', available: true, url: '/api/player/feed-audio?m1', durationS: 300, hasText: true, textUrl: '/text/m1.txt' },
        { episodeId: 'm2', title: 'Daily Verse', kind: 'external', source: 'VerseCast', available: true, url: '/api/player/feed-audio?m2', streamUrl: 'https://x/m2.mp3', durationS: 120, imageUrl: 'https://img.example/m2.jpg', descText: 'A short reflection.', spotifyUrl: 'https://open.spotify.com/episode/m2' }
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
        { episodeId: 'the-ai-signal', title: 'The AI Signal — Daily', kind: 'episode', available: true, url: '/api/player/feed-audio?ai1', durationS: 900 }
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
  // L3's series: 12 entries — 7 listened before the current
  // (index 8), 1 listened after it, the rest unlistened.
  var entries = [];
  for (var i = 1; i <= 12; i++) {
    entries.push({ key: 'e' + i, label: 'Day ' + i, title: 'Episode ' + i, url: 'https://x/e' + i + '.mp3', durationS: 600, listened: i <= 7 || i === 10, listenDate: '2026-11-10', positionS: 0, imageUrl: null, descText: null });
  }
  window.__pods = { series: 'bible', title: 'Bible in a Year', available: true, showImageUrl: null, showDesc: 'Daily readings.', listenedCount: 8, total: 12, currentKey: 'e9', entries: entries };
});

/* ---------------- L1: foundations ---------------- */
{
  const r = await ev(() => {
    var host = document.createElement('div');
    host.innerHTML = '<button class="btn" id="t-pri">Primary</button>'
      + '<button class="btn gold" id="t-gold">Commit</button>'
      + '<button class="btn ghost" id="t-ghost">Ghost</button>'
      + '<button class="btn small" id="t-small">Small</button>'
      + '<button class="btn danger" id="t-danger">Danger</button>'
      + '<button class="chip" id="t-chip">Chip</button>'
      + '<button class="chipbtn" id="t-chipbtn">Chipbtn</button>'
      + '<button class="settoggle" id="t-settoggle">Off</button>'
      + '<button class="menurow" id="t-menurow"><span class="grow">Row</span></button>'
      + '<span class="pri" id="t-label">High</span>'
      + '<div class="meta" id="t-meta">meta</div><h1 class="screen" id="t-h1">Title</h1>';
    document.getElementById('view').appendChild(host);
    var cs = function (id) { return getComputedStyle(document.getElementById(id)); };
    var out = {
      pri: { r: cs('t-pri').borderRadius, h: cs('t-pri').minHeight, bh: document.getElementById('t-pri').offsetHeight, fw: cs('t-pri').fontWeight, ff: cs('t-pri').fontFamily },
      gold: { r: cs('t-gold').borderRadius, fw: cs('t-gold').fontWeight, pad: cs('t-gold').paddingLeft },
      ghost: { r: cs('t-ghost').borderRadius, bw: cs('t-ghost').borderTopWidth, bg: cs('t-ghost').backgroundColor },
      small: { h: document.getElementById('t-small').offsetHeight, fs: cs('t-small').fontSize },
      danger: { bg: cs('t-danger').backgroundColor, fw: cs('t-danger').fontWeight },
      chip: { r: cs('t-chip').borderRadius, h: document.getElementById('t-chip').offsetHeight, ff: cs('t-chip').fontFamily },
      chipbtn: { r: cs('t-chipbtn').borderRadius, h: document.getElementById('t-chipbtn').offsetHeight },
      settoggle: { r: cs('t-settoggle').borderRadius, h: document.getElementById('t-settoggle').offsetHeight },
      menurow: { ff: cs('t-menurow').fontFamily, h: document.getElementById('t-menurow').offsetHeight },
      label: { fs: cs('t-label').fontSize, mh: cs('t-label').minHeight, ff: cs('t-label').fontFamily },
      meta: { ff: cs('t-meta').fontFamily }, h1: { ff: cs('t-h1').fontFamily },
      body: getComputedStyle(document.body).fontFamily
    };
    host.remove();
    return out;
  });
  ok(r.pri.r === '999px' && parseInt(r.pri.h) >= 44 && r.pri.bh >= 44 && r.pri.fw === '600',
    'L1 (G6): the Primary pill — radius 999, min-height 44, 600 weight', JSON.stringify(r.pri));
  ok(r.gold.r === '999px' && r.gold.fw === '700' && r.gold.pad === '22px',
    'L1 (G6): the Commit form — accent pill, 700 weight, 22px sides', JSON.stringify(r.gold));
  ok(r.ghost.r === '999px' && r.ghost.bw === '1px' && r.ghost.bg === 'rgba(0, 0, 0, 0)',
    'L1 (G6): the Ghost form — transparent, the 1px line border', JSON.stringify(r.ghost));
  ok(r.small.h === 44 && r.small.fs === '14px', 'L1 (G7): the Small form stands at chip height (44px, 14px face)', JSON.stringify(r.small));
  ok(r.danger.bg === 'rgb(138, 42, 42)' && r.danger.fw === '700', 'L1 (G6/G23): the Danger form reads var(--danger)', JSON.stringify(r.danger));
  ok(r.chip.r === '999px' && r.chip.h >= 44 && r.chipbtn.r === '999px' && r.chipbtn.h >= 44 && r.settoggle.r === '999px' && r.settoggle.h >= 44,
    'L1 (G8): the one chip construction — chip · chipbtn · settoggle share radius 999 and the 44 floor',
    JSON.stringify({ chip: r.chip, chipbtn: r.chipbtn, settoggle: r.settoggle }));
  ok(/-apple-system|Segoe UI/.test(r.meta.ff) && /-apple-system|Segoe UI/.test(r.chip.ff) && /-apple-system|Segoe UI/.test(r.menurow.ff) && /-apple-system|Segoe UI/.test(r.label.ff),
    'L1 (G2/D4): the label layer computes the system sans (meta · chip · menurow · label chip)', JSON.stringify({ meta: r.meta.ff, chip: r.chip.ff }));
  ok(/Georgia/.test(r.h1.ff) && /Georgia/.test(r.body) && r.label.fs === '12px',
    'L1 (G2/G8): display + body keep Georgia; the Label chip reads 12px sans', JSON.stringify({ h1: r.h1.ff, label: r.label }));
  // The contrast routine: for each of the six themes, the
  // pressed Commit (its accent darkened by the one 12% ink
  // overlay, F-419-4) must read at least its rest contrast
  // and at least 3:1 against its ink.
  const themes = [];
  {
    const blocks = [...U_SRC.matchAll(/\[data-lit="(\w+)"\] \{([^}]*)\}/g)];
    const root = U_SRC.slice(U_SRC.indexOf(':root {'), U_SRC.indexOf('}', U_SRC.indexOf(':root {')));
    themes.push({ name: 'base', css: root });
    blocks.forEach((b) => themes.push({ name: b[1], css: b[2] }));
  }
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16) / 255).map((v) => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const shade = (hex) => {
    const ink = [42, 38, 32];
    const c = [1, 3, 5].map((i, j) => Math.round(parseInt(hex.substr(i, 2), 16) * 0.88 + ink[j] * 0.12));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  };
  let allThemes = themes.length === 6;
  const themeReport = [];
  themes.forEach((t) => {
    let acc = (t.css.match(/--accent:(#[0-9a-f]{6})/) || [])[1];
    if (!acc && /--accent:var\(--gold\)/.test(t.css)) acc = (t.css.match(/--gold:(#[0-9a-f]{6})/) || [])[1]; // the base theme reads its gold
    const ink = (t.css.match(/--accent-ink:(#[0-9a-f]{6})/) || [])[1];
    if (!acc || !ink) { allThemes = false; themeReport.push(t.name + ':tokens-missing'); return; }
    const rest = contrast(acc, ink), pressed = contrast(shade(acc), ink);
    themeReport.push(t.name + ' ' + rest.toFixed(2) + '->' + pressed.toFixed(2));
    if (!(pressed >= rest && pressed >= 3)) allThemes = false;
  });
  ok(allThemes, 'L1 (G19/F-419-4): the pressed shade holds contrast on all six themes (pressed >= rest, >= 3:1)', themeReport.join(' · '));
  // The pressed state itself, live: hold a Commit down and
  // read the overlay in its computed shadow.
  await ev(() => {
    var b = document.createElement('button');
    b.className = 'btn gold'; b.id = 't-press'; b.textContent = 'Commit';
    document.getElementById('view').appendChild(b);
  });
  const box = await (await page.$('#t-press')).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await sleep(60);
  const pressedShadow = await ev(() => getComputedStyle(document.getElementById('t-press')).boxShadow);
  await page.mouse.up();
  ok(/inset/.test(pressedShadow) && /42, 38, 32/.test(pressedShadow),
    'L1 (G19): a pressed Commit carries the one inset ink overlay', pressedShadow);
  await ev(() => { var b = document.getElementById('t-press'); if (b) b.remove(); });
  // The focus ring, by keyboard: Tab to the first control.
  await ev(() => {
    var b = document.createElement('button');
    b.className = 'btn'; b.id = 't-focus'; b.textContent = 'Focus';
    document.body.insertBefore(b, document.body.firstChild);
    document.body.tabIndex = -1; document.body.focus();
  });
  let focusOk = false, focusInfo = '';
  for (let i = 0; i < 8 && !focusOk; i++) {
    await page.keyboard.press('Tab');
    await sleep(40);
    const f = await ev(() => {
      var a = document.activeElement;
      if (!a || a.id !== 't-focus') return null;
      var cs = getComputedStyle(a);
      return { w: cs.outlineWidth, s: cs.outlineStyle, c: cs.outlineColor };
    });
    if (f) { focusInfo = JSON.stringify(f); focusOk = f.w === '3px' && f.s === 'solid' && f.c === 'rgb(22, 40, 63)'; }
  }
  ok(focusOk, 'L1 (G20): keyboard focus computes the 3px navy ring', focusInfo);
  await ev(() => { var b = document.getElementById('t-focus'); if (b) b.remove(); });
}

/* ---------------- L2: Prayers ---------------- */
{
  const home = await ev(() => {
    state.dayPayload = window.__fixture;
    state.dayDescs = window.__descs;
    paintListenHome(window.__fixture);
    var aiCard = document.querySelector('[data-openblock="The AI Signal"]');
    var h1 = document.querySelector('#view h1.screen');
    var chips = [...document.querySelectorAll('[data-homefilter]')].map((c) => c.getAttribute('aria-pressed'));
    return {
      h1: h1 ? h1.textContent : '',
      aiGlyph: aiCard ? aiCard.querySelector('.blockcover-initial').textContent : '',
      aiImg: aiCard ? !!aiCard.querySelector('img') : null,
      chips: chips.join(',')
    };
  });
  ok(home.h1 === 'Prayers', 'L2 (G27): the home heading is the tab\u2019s name', home.h1);
  ok(home.aiGlyph === '\u26a1' && home.aiImg === false, 'L2 (G11): the AI Signal grid card is the bolt tile — no logo image', JSON.stringify(home));
  ok(home.chips === 'false,false,false', 'L2 (G8): the home filter chips carry aria-pressed at paint', home.chips);
  const row = await ev(() => {
    var html = rowArtHtml({ episodeId: 'the-ai-signal', _block: 'The AI Signal', title: 'AI', imageUrl: null });
    var host = document.createElement('div'); host.innerHTML = html;
    return { glyph: (host.querySelector('.rowart.tile > span') || {}).textContent || '', img: !!host.querySelector('img.rowart') };
  });
  ok(row.glyph === '\u26a1' && !row.img, 'L2 (G11): the AI Signal row art is the bolt tile — no logo image', JSON.stringify(row));
  const bp = await ev(() => {
    state.prayersView = { kind: 'block', block: 'Morning' };
    paintBlockPage(window.__fixture, 'Morning');
    var disc = document.querySelector('.backdisc');
    var head = document.querySelector('.blockpage-head');
    var spacer = document.createElement('div'); spacer.style.height = '1600px'; spacer.id = 't-spacer';
    document.getElementById('view').appendChild(spacer);
    measureBars();
    return {
      disc: !!disc, label: disc ? disc.getAttribute('aria-label') : '',
      w: disc ? disc.offsetWidth : 0, h: disc ? disc.offsetHeight : 0,
      radius: disc ? getComputedStyle(disc).borderRadius : '',
      bg: disc ? getComputedStyle(disc).backgroundColor : '',
      headPos: head ? getComputedStyle(head).position : ''
    };
  });
  ok(bp.disc && bp.label === 'Back to Prayers' && bp.w === 44 && bp.h === 44 && bp.radius === '50%' && bp.bg === 'rgb(22, 40, 63)',
    'L2 (G10): the block page back control is the 44px navy disc', JSON.stringify(bp));
  ok(bp.headPos === 'sticky', 'L2 (G10): the block page head is a frozen (sticky) zone', bp.headPos);
  await page.evaluate(() => window.scrollTo(0, 500));
  await sleep(80);
  const frozen = await ev(() => {
    var head = document.querySelector('.blockpage-head');
    var brand = document.querySelector('.brandbar');
    return { headTop: head.getBoundingClientRect().top, brandBottom: brand.getBoundingClientRect().bottom, scrollY: window.scrollY };
  });
  ok(frozen.scrollY > 100 && Math.abs(frozen.headTop - frozen.brandBottom) <= 30,
    'L2 (G10): scrolled, the head (with its disc) stands frozen under the brand bar', JSON.stringify(frozen));
  await page.screenshot({ path: path.join(APP, 'tests/harness-v419-blockpage.png') });
  await ev(() => { var s = document.getElementById('t-spacer'); if (s) s.remove(); window.scrollTo(0, 0); });
}

/* ---------------- L3: Podcasts — the collapse (F-419-3) ---------------- */
{
  const folded = await ev(() => {
    state.podcasts = window.__pods;
    paintPodcasts();
    var col = document.querySelector('[data-podcollapse]');
    var rows = [...document.querySelectorAll('[data-podrow]')].map((r) => r.getAttribute('data-podrow'));
    var cur = document.querySelector('[data-podrow="e9"]');
    var curRect = cur ? cur.getBoundingClientRect() : null;
    return {
      colText: col ? col.textContent.replace(/\s+/g, ' ').trim() : '',
      rows: rows.join(','),
      curInView: !!curRect && curRect.top >= 0 && curRect.top < 800
    };
  });
  ok(/7 earlier episodes listened/.test(folded.colText) && /Show/.test(folded.colText),
    'L3 (G31): the listened-before-current run folds into one disclosure row at its count', folded.colText);
  ok(folded.rows === 'e8,e9,e10,e11,e12',
    'L3 (G31): the current entry and everything after it stand as rows (the later-listened e10 included)', folded.rows);
  ok(folded.curInView, 'L3 (G31/\u00a74.2): the page opens with the current episode in view', JSON.stringify(folded.curInView));
  await page.click('[data-podcollapse]');
  await sleep(120);
  const opened = await ev(() => {
    var rows = [...document.querySelectorAll('[data-podrow]')].map((r) => r.getAttribute('data-podrow'));
    var col = document.querySelector('[data-podcollapse]');
    return { rows: rows.join(','), colText: col ? col.textContent.replace(/\s+/g, ' ').trim() : '' };
  });
  ok(opened.rows === 'e1,e2,e3,e4,e5,e6,e7,e8,e9,e10,e11,e12' && /Hide/.test(opened.colText),
    'L3 (G31): Show renders every row and the disclosure offers Hide', opened.rows + ' // ' + opened.colText);
  const remark = await ev(() => {
    // A mark while expanded repaints in place: unmark e3 in
    // the standing payload and repaint — the fold count
    // follows the standing data at once.
    state.podcasts.entries[2].listened = false;
    paintPodcasts();
    var col = document.querySelector('[data-podcollapse]');
    return { colText: col ? col.textContent.replace(/\s+/g, ' ').trim() : '', e3: !!document.querySelector('[data-podrow="e3"]') };
  });
  ok(/6 earlier episodes listened/.test(remark.colText) && remark.e3,
    'L3 (G31): a mark flip repaints in place — the fold recounts from the standing data', remark.colText);
  await page.click('[data-podcollapse]');
  await sleep(120);
  const refolded = await ev(() => [...document.querySelectorAll('[data-podrow]')].map((r) => r.getAttribute('data-podrow')).join(','));
  ok(refolded === 'e3,e8,e9,e10,e11,e12', 'L3 (G31): Hide folds the run again (the unmarked e3 now stands as a row)', refolded);
  const idx = await ev(() => {
    state.podcastsIndex = { seriesList: [{ series: 'bible', title: 'Bible in a Year', available: true, listenedCount: 8, total: 12, currentLabel: 'Day 9', showImageUrl: null }] };
    paintPodcastsIndex();
    paintPodcasts();
    var col = document.querySelector('[data-podcollapse]');
    return col ? col.textContent.replace(/\s+/g, ' ').trim() : '';
  });
  ok(/6 earlier episodes listened/.test(idx) && /Show/.test(idx),
    'L3 (G31): an index visit resets the collapse (the series reopens folded)', idx);
}

/* ---------------- L4: player + dock ---------------- */
{
  const pill = await ev(() => {
    var tab = document.querySelector('[data-tab="prayers"]');
    document.querySelectorAll('#tabbar .tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    var pillEl = tab.querySelector('.tabpill');
    var cs = getComputedStyle(pillEl);
    return { bg: cs.backgroundColor, color: cs.color, tabShadow: getComputedStyle(tab).boxShadow, pillRadius: cs.borderRadius };
  });
  ok(pill.bg === 'rgb(168, 134, 58)' && pill.color === 'rgb(255, 255, 255)' && pill.tabShadow === 'none' && pill.pillRadius === '999px',
    'L4 (G18): the active tab carries the accent pill (no inset rule)', JSON.stringify(pill));
  const np = await ev(() => {
    state.current = { episodeId: 'm1', title: 'Invitatory', block: 'Morning', url: '/api/player/feed-audio?m1', durationS: 300 };
    state.queue = [state.current]; state.queueIdx = 0;
    state.readTracks = { m1: { episodeId: 'm1', hasText: false, textUrl: null } };
    openNowPlaying();
    var sheet = document.querySelector('.np-sheet');
    var read = sheet.querySelector('#np-read');
    var before = { vis: read.style.visibility, w: read.offsetWidth, aria: read.getAttribute('aria-hidden'), grab: !!sheet.querySelector('.np-grab'), min: !!sheet.querySelector('#np-min') };
    state.readTracks = { m1: { episodeId: 'm1', hasText: true, textUrl: '/text/m1.txt' } };
    updateNowPlaying();
    var after = { vis: read.style.visibility, w: read.offsetWidth, aria: read.getAttribute('aria-hidden') };
    var q = sheet.querySelector('#np-queue');
    var rows = sheet.querySelectorAll('.npq-row');
    return { before, after, qClass: q ? q.className : '', rowH: rows.length ? rows[0].offsetHeight : 0, rowRadius: rows.length ? getComputedStyle(rows[0]).borderRadius : '' };
  });
  ok(np.before.vis === 'hidden' && np.before.aria === 'true' && np.before.w > 0,
    'L4 (G17/F-419-7): a textless track leaves the Read slot held — invisible, its box standing', JSON.stringify(np.before));
  ok(np.after.vis === '' && np.after.aria === null && np.after.w === np.before.w,
    'L4 (G17): a text track restores the Read button in the same box (the row geometry never moves)', JSON.stringify(np.after));
  ok(np.before.grab && !np.before.min, 'L4 (G16): the NP sheet carries the grab handle; the minimize button is retired', JSON.stringify(np.before));
  ok(np.qClass.includes('liblist') && np.rowH === 76 && (np.rowRadius === '0px' || np.rowRadius === '0px 0px 0px 0px'),
    'L4 (G24): the queue rows stand in a .liblist at the 76px Compact height, frameless', JSON.stringify(np));
  await page.screenshot({ path: path.join(APP, 'tests/harness-v419-np.png') });
}

/* ---------------- L5: sheets + menus ---------------- */
{
  const sp = await ev(() => {
    openSpeedSheet();
    var sheet = document.querySelector('.speedsheet');
    var inner = sheet.querySelector('.inner');
    return {
      fit: sheet.classList.contains('drawer-fit'), grab: !!sheet.querySelector('.grabstrip'),
      close: !!sheet.querySelector('#sp-close'), radius: getComputedStyle(inner).borderTopLeftRadius,
      maxH: inner.style.maxHeight
    };
  });
  ok(sp.fit && sp.grab && !sp.close && sp.radius === '16px' && sp.maxH === Math.round(800 * 0.85) + 'px',
    'L5 (G13/G14): a FIT drawer — bottom-anchored, radius-16 top, grab strip, 85dvh cap, no header Close', JSON.stringify(sp));
  await page.screenshot({ path: path.join(APP, 'tests/harness-v419-drawer.png') });
  await page.mouse.click(200, 60); // the scrim, above the panel
  await sleep(120);
  ok(await ev(() => !document.querySelector('.speedsheet')), 'L5 (G14): a tap on the scrim dismisses the drawer');
  const drag = await ev(() => { openSleepSheet(); return true; });
  await sleep(320); // the rise animation settles before the drag is measured
  const grabBox = await (await page.$('.sheet .grabstrip')).boundingBox();
  await page.mouse.move(grabBox.x + grabBox.width / 2, grabBox.y + grabBox.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) { await page.mouse.move(grabBox.x + grabBox.width / 2, grabBox.y + grabBox.height / 2 + i * 40); await sleep(20); }
  await page.mouse.up();
  await sleep(350);
  ok(await ev(() => !document.querySelector('.sheet:not(.np-sheet)')), 'L5 (G14): a grab drag past a quarter of the panel dismisses');
  await ev(() => { openSleepSheet(); });
  await sleep(320);
  const grabBox2 = await (await page.$('.sheet .grabstrip')).boundingBox();
  await page.mouse.move(grabBox2.x + grabBox2.width / 2, grabBox2.y + grabBox2.height / 2);
  await page.mouse.down();
  await page.mouse.move(grabBox2.x + grabBox2.width / 2, grabBox2.y + grabBox2.height / 2 + 18);
  await page.mouse.up();
  await sleep(200);
  ok(await ev(() => !!document.querySelector('.sheet:not(.np-sheet)')), 'L5 (G14): a short drag snaps back — the drawer stands');
  await ev(() => document.querySelectorAll('.sheet:not(.np-sheet)').forEach((x) => x.remove()));
  const tall = await ev(() => {
    openIntentionEditor({ id: 1, text: 'For my family', priority: 'M', status: 'active', created_at: '2026-11-01', drawnCount: 0, lastDrawn: null });
    var sheet = document.querySelector('.sheet:not(.np-sheet)');
    var inner = sheet.querySelector('.inner');
    return { tall: sheet.classList.contains('drawer-tall'), h: inner.offsetHeight, close: !!sheet.querySelector('#ed-close'), foot: !!sheet.querySelector('.panelfoot #ed-save') };
  });
  ok(tall.tall && tall.h >= 700 && !tall.close && tall.foot,
    'L5 (G13/G14): a TALL drawer — 92dvh, no header Close, the Save stands in the foot bar', JSON.stringify(tall));
  await ev(() => document.querySelectorAll('.sheet').forEach((x) => x.remove()));
  const cf = await ev(() => {
    window.__cfAct = 0;
    openConfirm({ line: 'Delete this intention and all its draws?', commitLabel: 'Delete', danger: true, act: function () { window.__cfAct++; } });
    var sheet = document.querySelector('.confirmsheet');
    var go = sheet.querySelector('[data-cfgo]');
    return { stands: !!sheet, danger: go.classList.contains('danger'), label: go.textContent };
  });
  ok(cf.stands && cf.danger && cf.label === 'Delete', 'L5 (G23): the confirm is a FIT drawer with the Danger commit', JSON.stringify(cf));
  await page.click('[data-cfcancel]');
  await sleep(80);
  ok(await ev(() => window.__cfAct === 0 && !document.querySelector('.confirmsheet')), 'L5 (G23): Cancel keeps the act unrun and closes');
  await ev(() => { openConfirm({ line: 'Delete this intention and all its draws?', commitLabel: 'Delete', danger: true, act: function () { window.__cfAct++; } }); });
  await page.click('[data-cfgo]');
  await sleep(80);
  ok(await ev(() => window.__cfAct === 1), 'L5 (G23): the Commit runs the act');
  // The anchored menus. (An L5 cleanup removed the L4 NP
  // sheet — reopen it in its L4 state.)
  await ev(() => {
    if (!document.querySelector('.np-sheet')) {
      state.current = { episodeId: 'm1', title: 'Invitatory', block: 'Morning', url: '/api/player/feed-audio?m1', durationS: 300 };
      state.queue = [state.current]; state.queueIdx = 0;
      state.readTracks = { m1: { episodeId: 'm1', hasText: true, textUrl: '/text/m1.txt' } };
      openNowPlaying();
    }
  });
  await sleep(150);
  await page.click('#np-menu');
  await sleep(120);
  const menu = await ev(() => {
    var card = document.querySelector('.anchmenu');
    var anchor = document.getElementById('np-menu');
    var cr = card.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
    return {
      rows: [...card.querySelectorAll('.menurow')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()),
      below: cr.top >= ar.bottom - 1, sheetRows: document.querySelectorAll('.sheet .menurow').length,
      title: card.querySelector('h1.screen').textContent
    };
  });
  ok(menu.rows.length === 3 && /^Autoplay/.test(menu.rows[0]) && /^Sleep timer/.test(menu.rows[1]) && /^Playback speed/.test(menu.rows[2]) && menu.sheetRows === 0,
    'L5 (G15): the player menu is an anchored card (3 rows, no sheet rows)', JSON.stringify(menu.rows));
  ok(menu.below, 'L5 (G15/F-419-2): the card seats below its anchor when it fits', JSON.stringify(menu.below));
  await page.screenshot({ path: path.join(APP, 'tests/harness-v419-menu.png') });
  await page.mouse.click(20, 20); // the catcher
  await sleep(100);
  ok(await ev(() => !document.querySelector('.anchmenu')), 'L5 (G15): a tap outside dismisses the anchored card');
  const dock = await ev(() => {
    document.querySelectorAll('.np-sheet').forEach((x) => x.remove());
    document.getElementById('dock').classList.remove('hidden');
    state.queue = window.__descs.slice(0, 2); state.queueIdx = 0;
    openDockMenu();
    return { rows: document.querySelectorAll('.anchmenu .menurow').length };
  });
  await sleep(260); // the card's rise animation settles before its rect is read
  const dockRect = await ev(() => {
    var card = document.querySelector('.anchmenu');
    var anchor = document.getElementById('dock-menu');
    var cr = card.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
    return { above: cr.bottom <= ar.top + 7 };
  });
  ok(dockRect.above && dock.rows === 5, 'L5 (G15/F-419-2): the dock menu seats ABOVE its foot-near anchor (5 rows with a queue standing)', JSON.stringify({ above: dockRect.above, rows: dock.rows }));
  await page.click('.anchmenu .menurow[data-menuitem="1"]'); // Intentions — a stay item
  await sleep(100);
  const stay = await ev(() => {
    var card = document.querySelector('.anchmenu');
    var st = card ? card.querySelector('[data-menustate="1"]') : null;
    return { stands: !!card, state: st ? st.textContent : '' };
  });
  ok(stay.stands && /Off|On/.test(stay.state), 'L5 (G15): a stay item flips in place — the card stands, its state line follows', JSON.stringify(stay));
  await ev(() => { document.querySelectorAll('.anchmenu, .menucatcher').forEach((x) => x.remove()); });
}

/* ---------------- L6: forms — skeletons, errors, the unsaved count ---------------- */
{
  await ev(() => {
    window.__apiLog = [];
    window.__apiMode = 'fixture';
    window.__origApi = api;
    api = function (path, opts) {
      window.__apiLog.push({ path: String(path), method: (opts && opts.method) || 'GET' });
      if (window.__apiMode === 'never') return new Promise(function () {});
      if (window.__apiMode === 'reject') return Promise.reject(new Error('boom'));
      var p = String(path);
      if (p.indexOf('/api/player/source-settings') === 0) {
        if (opts && opts.method === 'PUT') return Promise.resolve({ version: 9 });
        return Promise.resolve({ version: 7, sources: [
          { sourceKey: 'a', name: 'Alpha', family: 'own', block: 'Morning', dayRule: 'daily', enabled: 1 },
          { sourceKey: 'b', name: 'Beta', family: 'own', block: 'Morning', dayRule: 'daily', enabled: 0 },
          { sourceKey: 'c', name: 'Gamma', family: 'own', block: 'Night', dayRule: 'weekdays', enabled: 1 }
        ] });
      }
      if (p.indexOf('/api/prayer/intentions') === 0) {
        if (opts && opts.method === 'DELETE') return Promise.resolve({});
        return Promise.resolve({ intentions: [{ id: 5, text: 'For my family', priority: 'H', status: 'active', created_at: '2026-11-01', drawnCount: 2, lastDrawn: null }] });
      }
      if (p.indexOf('/api/prayer/day') === 0) return Promise.resolve({});
      if (p.indexOf('/api/exam/today') === 0) return Promise.resolve({ run: { id: 1, state: 'open' }, categories: ['First Commandment', 'Second Commandment', 'Anything else'], focusCategory: 'First Commandment', prompts: [{ id: 1, category: 'First Commandment', text: 'Prompt one' }], entries: [] });
      if (p.indexOf('/api/pin/state') === 0) return Promise.resolve({ pinSet: false, retryAfterSeconds: 0 });
      return Promise.resolve({});
    };
  });
  const skel = await ev(() => {
    window.__apiMode = 'never';
    state.tab = 'podcasts'; state.podcastsIndex = null; state.podcastsReturn = null;
    renderPodcasts();
    var pod = !!document.querySelector('#view [data-skeleton]');
    renderSettings();
    var set = !!document.querySelector('#view [data-skeleton]');
    renderIntentions();
    var int = !!document.querySelector('#view [data-skeleton]');
    renderExaminationContent();
    var exam = !!document.querySelector('#view [data-skeleton]');
    wallpaperBridge = function () { return { getWallpaperSettings: function () { return new Promise(function () {}); }, setWallpaperSettings: function () { return Promise.resolve({}); } }; };
    renderWallpaper();
    var wp = !!document.querySelector('#set-wallpaper [data-skeleton]');
    return { pod, set, int, exam, wp, anyText: document.getElementById('view').textContent.includes('Loading') };
  });
  ok(skel.pod && skel.set && skel.int && skel.exam && skel.wp && !skel.anyText,
    'L6 (G21/F-419-5): the loading paints carry the skeleton marker — Podcasts · Settings · Intentions · Examination · Wallpaper', JSON.stringify(skel));
  const errs = await ev(async () => {
    window.__apiMode = 'reject';
    state.tab = 'podcasts';
    state.podcastsReturn = null; // the cold path — the return path's silent catch is the standing v411 dress, not this leg's surface
    renderPodcasts();
    await new Promise((r) => setTimeout(r, 60));
    var pod = document.getElementById('view').textContent.includes('Podcasts did not load.') && !!document.getElementById('pod-retry');
    renderSettings();
    await new Promise((r) => setTimeout(r, 60));
    var set = document.getElementById('view').textContent.includes('Settings did not load.') && !!document.getElementById('set-retry');
    renderIntentions();
    await new Promise((r) => setTimeout(r, 60));
    var int = document.getElementById('view').textContent.includes('Intentions did not load.') && !!document.getElementById('int-retry');
    return { pod, set, int, raw: document.getElementById('view').textContent.includes('boom') };
  });
  ok(errs.pod && errs.set && errs.int && !errs.raw,
    'L6 (G22): a failed load reads as a plain sentence + a Ghost Retry — never the raw error', JSON.stringify(errs));
  const retry = await ev(async () => {
    window.__apiMode = 'fixture';
    document.getElementById('int-retry').click();
    await new Promise((r) => setTimeout(r, 80));
    return document.getElementById('view').textContent.includes('For my family');
  });
  ok(retry, 'L6 (G22): Retry repaints its own surface');
  const hint = await ev(() => {
    renderPinGate('conscience', function () {}, {});
    var h = document.getElementById('pinhint');
    return h ? h.textContent : '';
  });
  ok(hint === 'Enter your PIN to unlock \u2014 4 to 8 digits.', 'L6 (G29): the PIN gate carries the hint line under the dots', hint);
  const unsaved = await ev(async () => {
    window.__apiMode = 'fixture';
    renderSettings();
    await new Promise((r) => setTimeout(r, 80));
    var clean = document.getElementById('set-unsaved').textContent;
    var rowB = document.querySelector('[data-setkey="b"] [data-setact="toggle"]');
    rowB.click();
    var one = document.getElementById('set-unsaved').textContent;
    var pressed = rowB.getAttribute('aria-pressed');
    document.getElementById('set-reset').click();
    await new Promise((r) => setTimeout(r, 80));
    var reset = document.getElementById('set-unsaved').textContent;
    document.querySelector('[data-setkey="b"] [data-setact="toggle"]').click();
    var again = document.getElementById('set-unsaved').textContent;
    document.getElementById('set-save').click();
    await new Promise((r) => setTimeout(r, 100));
    var saved = document.getElementById('set-unsaved').textContent;
    return { clean, one, pressed, reset, again, saved };
  });
  ok(unsaved.clean === '' && unsaved.one === '1 change not saved' && unsaved.pressed === 'true',
    'L6 (G28/G8): one mapping toggle reads "1 change not saved" (and its aria-pressed flips)', JSON.stringify(unsaved));
  ok(unsaved.reset === '' && unsaved.again === '1 change not saved' && unsaved.saved === '',
    'L6 (G28): Reset restores the standing values clean; Save clears the count', JSON.stringify(unsaved));
  // The intention Delete, end to end through the confirm.
  const del = await ev(async () => {
    window.__apiLog = [];
    renderIntentions();
    await new Promise((r) => setTimeout(r, 80));
    document.querySelector('[data-act="del"][data-id="5"]').click();
    await new Promise((r) => setTimeout(r, 40));
    return { confirmStands: !!document.querySelector('.confirmsheet') };
  });
  ok(del.confirmStands, 'L6 (G23): the intention Delete opens the confirm drawer (no native dialog)');
  await page.click('.confirmsheet [data-cfcancel]');
  await sleep(60);
  const delCancel = await ev(() => window.__apiLog.filter((x) => x.method === 'DELETE').length);
  ok(delCancel === 0, 'L6 (G23): Cancel keeps the intention (no DELETE call)');
  await ev(async () => { document.querySelector('[data-act="del"][data-id="5"]').click(); await new Promise((r) => setTimeout(r, 40)); });
  await page.click('.confirmsheet [data-cfgo]');
  await sleep(80);
  const delGo = await ev(() => window.__apiLog.filter((x) => x.method === 'DELETE').length);
  ok(delGo === 1, 'L6 (G23): the Commit deletes (exactly one DELETE call)');
}

/* ---------------- L7: conscience + wallpaper ---------------- */
{
  const labels = await ev(() => [catChipLabel('First Commandment'), catChipLabel('Tenth Commandment'), catChipLabel('Anything else')].join('|'));
  ok(labels === '1st Cmdt.|10th Cmdt.|Anything else', 'L7 (G30): the category chips read the ordinal short form', labels);
  const exam = await ev(async () => {
    window.__apiMode = 'fixture';
    renderExaminationContent();
    await new Promise((r) => setTimeout(r, 80));
    var chip = document.querySelector('[data-cat="First Commandment"]');
    var seg = document.querySelector('.segtoggle.inflow');
    return {
      chipText: chip ? chip.textContent : '', modes: !!document.querySelector('.modes'),
      seg: !!seg, quick: seg ? !!seg.querySelector('#m-quick') : false, deep: seg ? !!seg.querySelector('#m-deep') : false
    };
  });
  ok(exam.chipText === '1st Cmdt.' && !exam.modes && exam.seg && exam.quick && exam.deep,
    'L7 (G30/G9): the examination chips keep the full name in data-cat under the short label; the mode control is the in-flow segtoggle', JSON.stringify(exam));
  const radii = await ev(() => {
    var host = document.createElement('div');
    host.innerHTML = '<div class="liblist" id="t-lib"><div class="setrow">y</div></div><div class="skel" id="t-skel">z</div>';
    document.getElementById('view').appendChild(host);
    var out = {
      lib: getComputedStyle(document.getElementById('t-lib')).borderRadius,
      skel: getComputedStyle(document.getElementById('t-skel')).borderRadius
    };
    host.remove();
    return out;
  });
  ok(radii.lib === '14px' && radii.skel === '14px',
    'L7 (G24 conformance): the liblist container and the skeleton blocks compute the 14px row radius', JSON.stringify(radii));
}

console.log('harness-v419: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) console.log('failures: ' + failures.join(' | '));
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
