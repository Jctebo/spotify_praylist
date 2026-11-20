// harness-v423 — the slim brand bar (§1/§2 of the v423
// release document; the v422 remainder, D-422-1's named
// item, ordered by John 2026-11-14 20:37 CT). Client-only
// delta: ui.ts APP_CSS only (.brandbar padding · .gearbtn
// box + ::after hit layer); SHELL_HTML, client.ts and
// index.ts stand byte-untouched. Legs run in headless
// Chromium on the v388/v417 extraction mold (real
// SHELL_HTML + APP_CSS, fixture state).
//   S  statics (the settled CSS values · the compact
//      head's offset untouched · the v421 listener count ·
//      the shipped gear wiring the fixture attaches)
//   L1 the measure (leg 1) — bar 46 · brandmark governs ·
//      --brandh 46px · the stuck stack 186 on a block page
//   L2 the gear (leg 2) — box 36×36 · ::after inset −4px
//      (hit layer 44×44) · glyph 20px · a center tap opens
//      Settings · a tap inside the hit layer but outside
//      the visual box opens Settings
//   L3 the contents (leg 3) — brandmark 38×38 · wordmark ·
//      the liturgical line · no tagline
//   L4 the frozen geometry (leg 4) — slot 0 at scroll
//      300/600/max at the new --brandh · the toggle stuck
//      at 46 · toggle 46 · head 94 (Mass 120)
//   L5 non-interference (leg 5's client half) — the v421
//      binding's statics re-asserted; harness-v421's own
//      green run on this tree (the ledger) discharges the
//      dispatch. The APK half is the Actions proof.
// Fixture honesty: the gear's click wiring is a top-level
// statement in client.ts (line 4027) that the extraction
// mold does not carry; the fixture attaches the IDENTICAL
// line, and static S proves the shipped line stands.
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
  ok(/\.brandbar \{[^}]*padding:4px 14px/.test(APP_CSS),
    'S (§2.2): .brandbar reads padding:4px 14px — the vertical padding settled at 4px, the horizontal 14px stands');
  ok(/\.gearbtn \{[^}]*width:36px; height:36px/.test(APP_CSS) && /\.gearbtn \{[^}]*position:relative/.test(APP_CSS),
    'S (§2.2): .gearbtn reads width:36px;height:36px and takes position:relative (the hit layer\u2019s anchor)');
  ok(/\.gearbtn::after \{ content:''; position:absolute; inset:-4px; \}/.test(APP_CSS),
    'S (§2.2): the .gearbtn::after rule stands — content:\'\' · position:absolute · inset:-4px (the back-disc construction, verbatim)');
  ok(/\.gearbtn \{[^}]*font-size:20px/.test(APP_CSS),
    'S (§2.2): the gear glyph stands at font-size:20px — no text resized');
  ok(/\.blockpage-head\.compact \{[^}]*top:calc\(var\(--brandh, 54px\) \+ 46px\)/.test(APP_CSS),
    'S (§2.4): the compact head\u2019s sticky top still reads calc(var(--brandh, 54px) + 46px) — the offset rule untouched; the measured value moves');
  ok(/\.segtoggle \{[^}]*top:\s*var\(--brandh, 54px\)/.test(APP_CSS),
    'S (§2.4): the segtoggle still sticks at var(--brandh, 54px) — no consumer re-pointed, none left behind');
  const listeners = C_SRC.match(/addListener\('backButton'/g) || [];
  ok(listeners.length === 1 && !/addEventListener\(\s*['"]backbutton/.test(C_SRC),
    'S (L5): exactly one addListener(\'backButton\' stands in client.ts; the document event is not bound — the v421 binding untouched');
  ok(/document\.getElementById\('gearbtn'\)\.addEventListener\('click', renderSettings\)/.test(C_SRC),
    'S (L2): the shipped gear wiring stands in client.ts — getElementById(\'gearbtn\').addEventListener(\'click\', renderSettings); the fixture attaches this identical line');
  ok(U_SRC.includes('ora-pro-nobis-v422-1') && !U_SRC.includes('ora-pro-nobis-v423-1'),
    'S: the SW pin is untouched at Implement (Ship moves it)');
  ok(!I_SRC.includes('brandbar') && !I_SRC.includes('gearbtn'),
    'S: index.ts carries no brand markers (the delta is ui.ts CSS only)');
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
ok(pieces.some((p) => p.startsWith('function paintBlockPage')) && pieces.some((p) => p.startsWith('function renderSettings')) && pieces.some((p) => p.startsWith('function setupBackButton')),
  'S: paintBlockPage, renderSettings and the v421 binding\u2019s function survive extraction');

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
  // Fixture-attached: the shipped gear wiring (client.ts:4027),
  // a top-level statement the extraction mold does not carry.
  document.getElementById('gearbtn').addEventListener('click', renderSettings);
});

/* ---------------- L1 + L3: the measure and the contents ---------------- */
{
  const r = await ev(() => {
    var bb = document.querySelector('.brandbar');
    var q = (s) => { var e = bb.querySelector(s); return e ? { w: e.offsetWidth, h: e.offsetHeight } : null; };
    return {
      barH: bb.offsetHeight,
      brandmark: q('.brandmark'), gear: q('.gearbtn'), brandtext: q('.brandtext'),
      wordmark: bb.querySelector('.wordmark') ? bb.querySelector('.wordmark').textContent : null,
      litday: !!bb.querySelector('#litday'),
      tagline: !!bb.querySelector('.tagline'),
      taglineText: /Daily Catholic Prayer Podcast/i.test(bb.textContent),
      brandhVar: getComputedStyle(document.documentElement).getPropertyValue('--brandh').trim()
    };
  });
  ok(r.barH === 46,
    'L1 (leg 1/§2.2): the painted brand bar measures 46px — 60 → 46, the settled cut in full', JSON.stringify(r));
  ok(r.brandmark.h === 38 && r.gear.h === 36 && r.brandtext.h === 23 && r.brandmark.h > r.gear.h,
    'L1 (§2.3/F-423-2): the component probe reads brandmark 38 · gear 36 · brandtext 23 — the brandmark is the governing child; the bar lands on its floor (38 + 8 padding)', JSON.stringify({ brandmark: r.brandmark, gear: r.gear, brandtext: r.brandtext }));
  ok(r.brandhVar === '46px',
    'L1 (§2.4): --brandh reads back \u201946px\u2019 — measureBars wrote the new painted height; every sticky consumer follows it', JSON.stringify(r));
  ok(r.brandmark.w === 38 && r.brandmark.h === 38 && r.wordmark === 'ORA PRO NOBIS' && r.litday && !r.tagline && !r.taglineText,
    'L3 (leg 3): the brandmark stands at 38×38 · the wordmark reads ORA PRO NOBIS · the liturgical line\u2019s seat stands · NO tagline element or text (v422\u2019s cut stands)', JSON.stringify(r));
}

/* ---------------- L4: the frozen geometry at the new --brandh ---------------- */
{
  const mass = await ev(() => {
    state.prayersView = { kind: 'block', block: 'Mass and Homilies' };
    paintBlockPage(window.__fixture, 'Mass and Homilies');
    return document.querySelector('.blockpage-head').offsetHeight;
  });
  ok(mass === 120, 'L4 (leg 4): the Mass and Homilies head still measures 120px — the head stands as shipped in v422', JSON.stringify({ mass: mass }));
  const setup = await ev(() => {
    state.prayersView = { kind: 'block', block: 'Morning' };
    paintBlockPage(window.__fixture, 'Morning');
    var spacer = document.createElement('div'); spacer.style.height = '1600px'; spacer.id = 't-spacer';
    view.appendChild(spacer);
    measureBars();
    return { headH: document.querySelector('.blockpage-head').offsetHeight, toggleH: document.querySelector('.segtoggle').offsetHeight };
  });
  ok(setup.headH === 94 && setup.toggleH === 46,
    'L4 (leg 4): the Morning head still measures 94px and the toggle band 46px — neither moved', JSON.stringify(setup));
  const probe = () => ev(() => {
    var head = document.querySelector('.blockpage-head');
    var toggle = document.querySelector('.segtoggle');
    var hr = head.getBoundingClientRect(), tr = toggle.getBoundingClientRect();
    return { scrollY: Math.round(window.scrollY), slot: Math.round(hr.top - tr.bottom), headTop: Math.round(hr.top), toggleTop: Math.round(tr.top), toggleBottom: Math.round(tr.bottom) };
  });
  for (const depth of [300, 600]) {
    await page.evaluate((d) => window.scrollTo(0, d), depth);
    await sleep(80);
    const p = await probe();
    ok(p.slot === 0 && p.toggleTop === 46 && p.headTop === 92,
      'L4 (leg 4): at scroll ' + depth + ' the slot measures 0 · the toggle sticks at the new brand bottom (46) · the stuck head\u2019s top is 92 = 46 + 46 — the stuck stack measures 186 (46 brand + 46 toggle + 94 head)', JSON.stringify(p));
  }
  await page.evaluate(() => window.scrollTo(0, 100000));
  await sleep(80);
  const atMax = await probe();
  ok(atMax.scrollY > 600 && atMax.slot === 0 && atMax.toggleTop === 46 && atMax.headTop === 92,
    'L4 (leg 4): at maximum scroll the geometry holds — slot 0, every consumer on the new --brandh', JSON.stringify(atMax));
  console.log('note - the stuck stack (mold): brand 46 + toggle 46 + head 94 = 186px (was 200 at v422)');
  await page.screenshot({ path: path.join(APP, 'tests/harness-v423-scrolled.png') });
  await ev(() => { var s = document.getElementById('t-spacer'); if (s) s.remove(); window.scrollTo(0, 0); });
}

/* ---------------- L2: the gear ---------------- */
{
  const g = await ev(() => {
    var gear = document.getElementById('gearbtn');
    var cs = getComputedStyle(gear);
    var aft = getComputedStyle(gear, '::after');
    var r = gear.getBoundingClientRect();
    return {
      w: gear.offsetWidth, h: gear.offsetHeight,
      fontSize: cs.fontSize,
      afterTop: aft.top, afterRight: aft.right, afterBottom: aft.bottom, afterLeft: aft.left,
      rect: { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom) }
    };
  });
  ok(g.w === 36 && g.h === 36,
    'L2 (leg 2/§2.2): the gear\u2019s visual box measures 36×36 (down from 44×44)', JSON.stringify(g));
  ok(g.afterTop === '-4px' && g.afterRight === '-4px' && g.afterBottom === '-4px' && g.afterLeft === '-4px',
    'L2 (leg 2): the ::after\u2019s computed inset is −4px on all four sides — the hit layer measures 44×44, the 44px floor restored around the smaller box', JSON.stringify(g));
  ok(g.fontSize === '20px',
    'L2 (§2.2): the gear glyph\u2019s computed font-size is 20px — the glyph John sees is unchanged', JSON.stringify(g));
  const hit = await ev((pt) => {
    var el = document.elementFromPoint(pt.x, pt.y);
    return { hit: !!el, gear: !!el && (el.id === 'gearbtn' || !!el.closest('#gearbtn')) };
  }, { x: Math.round((g.rect.left + g.rect.right) / 2), y: g.rect.top - 3 });
  ok(hit.gear,
    'L2 (leg 2): elementFromPoint 3px above the visual box (inside the hit layer, inside the bar) returns the gear — the layer is live geometry, not only computed style', JSON.stringify(hit));
  await page.click('#gearbtn');
  await sleep(150);
  const opened1 = await ev(() => {
    var h = document.querySelector('h1.screen');
    return { settings: !!h && h.textContent === 'Settings', tab: state.tab };
  });
  ok(opened1.settings && opened1.tab === 'settings',
    'L2 (leg 2): a tap at the box\u2019s center opens Settings (renderSettings painted, state.tab = settings)', JSON.stringify(opened1));
  await ev(() => { view.innerHTML = ''; state.tab = 'prayers'; window.scrollTo(0, 0); });
  await page.mouse.click(Math.round((g.rect.left + g.rect.right) / 2), g.rect.top - 3);
  await sleep(150);
  const opened2 = await ev(() => {
    var h = document.querySelector('h1.screen');
    return { settings: !!h && h.textContent === 'Settings', tab: state.tab };
  });
  ok(opened2.settings && opened2.tab === 'settings',
    'L2 (leg 2): a tap 3px above the visual box — outside the box, inside the 44px hit layer — opens Settings: the hit layer proven live by act, not only by measure', JSON.stringify(opened2));
  ok(pageErrors.length === 0, 'L2/L5: the page ran clean — no pageerror across the whole harness', pageErrors.join(' | '));
}

console.log('harness-v423: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) console.log('failures: ' + failures.join(' | '));
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
