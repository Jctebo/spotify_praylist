// harness-v424 — the player card's controls move into the
// box (§1/§2 of the v424 release document; John's order,
// 2026-11-14 20:48/20:54 CT). Client-only delta: client.ts
// trackCard emission + ui.ts scoped CSS (.titlerow ·
// .prow-cluster · .metarow). Legs run in headless Chromium
// on the v388/v417 extraction mold (real SHELL_HTML +
// APP_CSS, fixture state), 412px. Legs map to §2.6:
//   S  statics (6) · L1 one box (3) · L2 disc + ⋮ in the
//   box (5) · L3 every act reachable (5) · L4 the variable
//   populations (5) · L5 nothing else moved (4) · L6 the
//   podcast boundary, FD7 (2) · L7 the playing state (2).
// Fixture honesty: refreshPlayedChrome stands EXTRACTED
// here (not stubbed) so the dot's .on + the title's .heard
// dress after a tap is the shipped function's own work;
// its tail (paintContinue/renderQueueList) reads the
// fixture state, which carries the fields they read.
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

/* ---------------- S: statics (6) ---------------- */
{
  const tc = seg(C_SRC, 'function trackCard', 'function openRead');
  ok(!tc.includes('class="prow-ctl"'),
    'S1: trackCard emits no .prow-ctl on any branch (the controls line retires by emission)');
  const pr = seg(C_SRC, 'podRowString = function', 'podCollapseEmitted');
  ok(pr.includes('class="prow-ctl"') && pr.includes('data-podmark') && pr.includes('podbar'),
    'S2 (FD7): podRowString still emits its .prow-ctl line + podmark + podbar — the podcast construction untouched');
  const cl = seg(tc, 'var cluster = function', 'var titleRow = function');
  ok(cl.indexOf('playedDotHtml(t)') > -1 && cl.indexOf('playedDotHtml(t)') < cl.indexOf('data-playkey') && cl.indexOf('data-playkey') < cl.indexOf('data-rowmenu'),
    'S3: the cluster\u2019s emission order in the title line = played dot \u00b7 play disc \u00b7 \u22ee (data-markplayed \u00b7 data-playkey \u00b7 data-rowmenu)');
  const odm = seg(C_SRC, 'function openDayRowMenu', 'function dayRowDownload');
  ok(!tc.includes('data-rowshare')
    && odm.indexOf("label: 'Share'") > -1 && odm.indexOf("label: 'Share'") < odm.indexOf("label: 'Download'") && odm.indexOf("label: 'Download'") < odm.indexOf("label: 'Open in Spotify'"),
    'S4 (FD4): trackCard emits no data-rowshare; openDayRowMenu\u2019s contents stand (Share first \u00b7 Download state-matched \u00b7 Open in Spotify)');
  ok(/data-rowdl[\s\S]{0,60}display:none/.test(tc),
    'S5 (FD5): the \u2913 span in trackCard keeps data-rowdl + its display:none start (refreshGridDlStates untouched)');
  ok(U_SRC.includes('ora-pro-nobis-v423-1') && !U_SRC.includes('ora-pro-nobis-v424-1')
    && !/#1DB954|#1ed760/i.test(C_SRC + U_SRC)
    && !I_SRC.includes('titlerow') && !I_SRC.includes('prow-cluster') && !I_SRC.includes('metarow'),
    'S6: limits — the pin stands at ora-pro-nobis-v423-1 (Ship moves it); no Spotify green; no index.ts delta');
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
console.log('note - refreshPlayedChrome extracted:', pieces.some((p) => p.indexOf('function refreshPlayedChrome') === 0));

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

/* ---------------- fixture: the full variable set (§2.6) ---------------- */
await ev(() => {
  localStorage.clear();
  var blk = function (name, caption, tracks) { return { block: name, label: name, caption: caption || '', tracks: tracks || [] }; };
  var mTracks = [
    { episodeId: 'seg-int-morning', title: 'Intentions', kind: 'segment', available: true, url: 'https://x/int.mp3', durationS: 60 },
    { episodeId: 'o1', title: 'Morning Prayer', kind: 'episode', available: true, url: '/api/player/feed-audio?o1', durationS: 300, hasText: true, textUrl: '/text/o1.txt' },
    { episodeId: 'o3', title: 'Lauds', kind: 'episode', available: true, url: '/api/player/feed-audio?o3', durationS: 240, hasText: true, textUrl: '/text/o3.txt' },
    { episodeId: 'o2', title: 'Canticle', kind: 'episode', available: true, url: '/api/player/feed-audio?o2', durationS: 180 },
    { episodeId: 'e1', title: 'Invitatory', kind: 'external', source: 'Divine Office', available: true, streamUrl: 'https://x/e1.mp3', durationS: 163, spotifyUrl: 'https://open.spotify.com/episode/e1' },
    { episodeId: 'e2', title: 'Daily Verse', kind: 'external', source: 'VerseCast', available: true, streamUrl: 'https://x/e2.mp3', durationS: 120 },
    { episodeId: 'e3', title: 'Verse Reflection', kind: 'external', source: 'VerseCast', available: true, streamUrl: 'https://x/e3.mp3', durationS: 120, descText: 'A short reflection on the day\u2019s verse, read slowly and prayed with the Church this morning.' },
    { episodeId: 'u1', title: 'Unread Text', kind: 'episode', available: false, url: null, durationS: 200, hasText: true, textUrl: '/text/u1.txt' },
    { episodeId: 'u2', title: 'Silent Track', kind: 'episode', available: false, url: null, durationS: 100 }
  ];
  window.__fixture = {
    date: '2026-11-14', dateLabel: 'Saturday, November 14', intentionsLine: '',
    intros: {
      o1: { text: 'Pamela to repair relationships with all of her cousins and restore peace in the family' },
      e1: { text: 'Andy\u2019s daughter, that her crisis of faith lead her closer to the fullness of truth' }
    },
    blocks: [
      blk('Morning', 'from midnight', mTracks),
      blk('Midmorning'), blk('Midday'), blk('Afternoon'), blk('Evening'),
      blk('Night', '', [{ episodeId: 'n1', title: 'Night Prayer', kind: 'episode', available: true, url: '/api/player/feed-audio?n1', durationS: 0 }]),
      blk('Mass and Homilies'), blk('Novenas'),
      blk('The AI Signal', '', [{ episodeId: 'the-ai-signal', title: 'The AI Signal \u2014 Daily', kind: 'episode', available: true, url: '/api/player/feed-audio?ai1', durationS: 900 }])
    ],
    episodes: [{ episodeId: 'pod-ep-1', title: 'Podcast Episode', kind: 'episode', available: true, url: 'https://x/p1.mp3', durationS: 600 }]
  };
  window.__fixture.blocks[0].spotifyUrl = 'https://open.spotify.com/playlist/morning';
  window.__descs = [
    { episodeId: 'seg-int-morning', kind: 'segment', title: 'Intentions', block: 'Morning', url: 'https://x/int.mp3', available: true, durationS: 60 },
    { episodeId: 'o1', kind: 'episode', title: 'Morning Prayer', block: 'Morning', url: '/api/player/feed-audio?o1', available: true, durationS: 300 },
    { episodeId: 'o3', kind: 'episode', title: 'Lauds', block: 'Morning', url: '/api/player/feed-audio?o3', available: true, durationS: 240 },
    { episodeId: 'o2', kind: 'episode', title: 'Canticle', block: 'Morning', url: '/api/player/feed-audio?o2', available: true, durationS: 180 },
    { episodeId: 'e1', kind: 'episode', title: 'Invitatory', block: 'Morning', url: '/api/player/feed-audio?e1', available: true, durationS: 163, source: 'Divine Office', spotifyUrl: 'https://open.spotify.com/episode/e1' },
    { episodeId: 'e2', kind: 'episode', title: 'Daily Verse', block: 'Morning', url: '/api/player/feed-audio?e2', available: true, durationS: 120, source: 'VerseCast' },
    { episodeId: 'e3', kind: 'episode', title: 'Verse Reflection', block: 'Morning', url: '/api/player/feed-audio?e3', available: true, durationS: 120, source: 'VerseCast', descText: 'A short reflection.' },
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
  state.dayPayload = window.__fixture;
  state.dayDescs = window.__descs;
  state.presentedDay = '2026-11-14';
  view.innerHTML = paintSideToggle('prayers', 'prayers') + '<div id="sidehost"></div>';
  enterSideHost();
  measureBars();
  state.prayersView = { kind: 'block', block: 'Morning' };
  paintBlockPage(window.__fixture, 'Morning');
  var tr = window.__fixture.blocks[0].tracks;
  state.readTracks = { o1: tr[1], u1: tr[7] };
  wirePrayersView(window.__fixture);
});

/* ---------------- L1: one box (3) ---------------- */
{
  const r = await ev(() => {
    var ids = ['o1', 'o3', 'o2', 'e1', 'e2', 'e3', 'u1', 'u2'];
    var out = { ctl: {}, divBorder: {}, h: {} };
    ids.forEach(function (id) {
      var card = document.querySelector('[data-card="' + id + '"]');
      out.ctl[id] = card ? card.querySelectorAll('.prow-ctl').length : -1;
      out.divBorder[id] = card ? [...card.querySelectorAll('.row div')].every(function (d) { return getComputedStyle(d).borderTopWidth === '0px'; }) : false;
      out.h[id] = card ? card.offsetHeight : -1;
    });
    return out;
  });
  ok(['o1', 'o3', 'o2', 'e1', 'e2', 'e3', 'u1', 'u2'].every((id) => r.ctl[id] === 0),
    'L1 (leg 1): every fixture card carries zero .prow-ctl descendants \u2014 the card stands as one box', JSON.stringify(r.ctl));
  ok(['o1', 'o3', 'o2', 'e1', 'e2', 'e3', 'u1', 'u2'].every((id) => r.divBorder[id]),
    'L1 (leg 1): no border-top line stands under any card\u2019s words (no divider under the words line, the title line, or the meta line)', JSON.stringify(r.divBorder));
  const settled = { o1: 160, o3: 106, e1: 133, e2: 79, e3: 121, u1: 87 };
  ok(Object.keys(settled).every((id) => r.h[id] > 0 && r.h[id] <= settled[id] + 2),
    'L1 (leg 1): the fixture cards\u2019 heights bank against \u00a72.4 (each population at or under its settled figure +2)',
    JSON.stringify({ measured: r.h, settled }));
  console.log('note - card heights (mold): ' + JSON.stringify(r.h) + ' vs settled ' + JSON.stringify(settled));
}

/* ---------------- L4: the variable populations (5) ---------------- */
{
  const r = await ev(() => {
    var q = (id, sel) => document.querySelector('[data-card="' + id + '"] ' + sel);
    var qa = (id, sel) => document.querySelectorAll('[data-card="' + id + '"] ' + sel).length;
    return {
      extRead: qa('e1', '[data-read]') + qa('e2', '[data-read]') + qa('e3', '[data-read]'),
      o2Read: qa('o2', '[data-read]'),
      o2Meta: (q('o2', '.meta') || {}).textContent || '',
      u1ReadInMeta: !!q('u1', '.metarow [data-read]'),
      u1Ctl: qa('u1', '.prow-ctl'),
      u2Read: qa('u2', '[data-read]'), u2Cluster: qa('u2', '.prow-cluster'),
      unavailActs: ['u1', 'u2'].reduce(function (n, id) { var c = document.querySelector('[data-card="' + id + '"]'); return n + (c ? c.querySelectorAll('[data-playkey],[data-rowmenu],[data-markplayed]').length : 99); }, 0),
      segRead: qa('seg-int-morning', '[data-read]')
    };
  });
  ok(r.extRead === 0, 'L4 (leg 5): the external cards carry no [data-read] \u2014 no dead Read stands', JSON.stringify(r.extRead));
  ok(r.o2Read === 0 && /Not available in the app yet/.test(r.o2Meta),
    'L4 (leg 5): the own no-text card carries no [data-read] and folds its not-available segment in the meta', r.o2Meta);
  ok(r.u1ReadInMeta && r.u1Ctl === 0,
    'L4 (leg 5, FD8): the unavailable-with-text card carries Read in its meta row and no .prow-ctl');
  ok(r.u2Read === 0 && r.u2Cluster === 0,
    'L4 (leg 5, FD8): the unavailable-without-text card carries no Read and no cluster');
  ok(r.unavailActs === 0 && r.segRead === 0,
    'L4 (leg 5): no fixture card gains a control its population never carried (unavailable cards carry no play/\u22ee/dot; the segment card carries no Read)', JSON.stringify({ unavailActs: r.unavailActs, segRead: r.segRead }));
}

/* ---------------- L5: nothing else moved (4) ---------------- */
{
  const setup = await ev(() => {
    var spacer = document.createElement('div'); spacer.style.height = '1600px'; spacer.id = 't-spacer';
    view.appendChild(spacer);
    measureBars();
    var card = document.querySelector('[data-card="o1"]');
    var cs = getComputedStyle(card);
    var intEl = card.querySelector('.intention-text');
    var grow = card.querySelector('.grow');
    return {
      headH: document.querySelector('.blockpage-head').offsetHeight,
      padT: cs.paddingTop, padL: cs.paddingLeft,
      tileW: getComputedStyle(card.querySelector('.rowartwrap')).width,
      h3Fs: getComputedStyle(card.querySelector('h3')).fontSize,
      metaFs: getComputedStyle(card.querySelector('.meta')).fontSize,
      intW: intEl ? intEl.offsetWidth : -1,
      growW: grow ? grow.offsetWidth : -1,
      intClamp: intEl ? getComputedStyle(intEl).webkitLineClamp : ''
    };
  });
  ok(setup.padT === '8px' && setup.padL === '10px' && setup.tileW === '44px',
    'L5 (leg 6): the card padding + art tile stand (8px/10px \u00b7 44px)', JSON.stringify({ padT: setup.padT, padL: setup.padL, tileW: setup.tileW }));
  ok(setup.h3Fs === '17px' && setup.metaFs === '14px',
    'L5 (leg 6): computed type sizes stand (title 17 \u00b7 meta 14)', setup.h3Fs + '/' + setup.metaFs);
  ok(setup.intW > 0 && Math.abs(setup.intW - setup.growW) <= 1 && setup.intClamp === '2',
    'L5 (leg 6): the intention line stands inside the card at its standing width (the .grow width, \u00b11px of base) with its clamp 2',
    JSON.stringify({ intW: setup.intW, growW: setup.growW, clamp: setup.intClamp }));
  const probe = () => ev(() => {
    var head = document.querySelector('.blockpage-head');
    var toggle = document.querySelector('.segtoggle');
    var hr = head.getBoundingClientRect(), tr = toggle.getBoundingClientRect();
    return { scrollY: Math.round(window.scrollY), slot: Math.round(hr.top - tr.bottom), headTop: Math.round(hr.top), toggleTop: Math.round(tr.top) };
  });
  await page.evaluate(() => window.scrollTo(0, 300));
  await sleep(80);
  const p = await probe();
  ok(setup.headH === 94 && p.slot === 0 && p.toggleTop === 46 && p.headTop === 92,
    'L5 (leg 6): the block head measures as v423 left it (head 94 \u00b7 stack 186 = 46 brand + 46 toggle + 94 head \u00b7 slot 0 at scroll)',
    JSON.stringify({ headH: setup.headH, ...p }));
  await ev(() => { var s = document.getElementById('t-spacer'); if (s) s.remove(); window.scrollTo(0, 0); });
}

/* ---------------- L2 geometry: cluster seat + boxes (2 of 5) ---------------- */
{
  const r = await ev(() => {
    var card = document.querySelector('[data-card="e1"]');
    var tr = card.querySelector('.titlerow');
    var kids = [...tr.querySelectorAll('[data-markplayed],[data-playkey],[data-rowmenu]')]
      .map((el) => ['data-markplayed', 'data-playkey', 'data-rowmenu'].filter((a) => el.hasAttribute(a))[0]);
    var grow = card.querySelector('.grow');
    var menu = tr.querySelector('[data-rowmenu]');
    var box = (el) => { var b = el.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; };
    return {
      order: kids,
      flush: Math.abs(grow.getBoundingClientRect().right - menu.getBoundingClientRect().right),
      dot: box(tr.querySelector('[data-markplayed]')),
      disc: box(tr.querySelector('[data-playkey]')),
      menu: box(menu)
    };
  });
  ok(r.order.join(',') === 'data-markplayed,data-playkey,data-rowmenu' && r.flush <= 1,
    'L2 (legs 2+3): dot \u00b7 disc \u00b7 \u22ee stand inside the title line in that order, the \u22ee\u2019s right edge flush with the card\u2019s inner right edge (\u00b11px)',
    JSON.stringify({ order: r.order, flush: r.flush }));
  ok([r.dot, r.disc, r.menu].every((b) => b.w === 44 && b.h === 44),
    'L2 (leg 2, FD2): all three cluster boxes measure 44\u00d744', JSON.stringify({ dot: r.dot, disc: r.disc, menu: r.menu }));
}

/* ---------------- L3: every act reachable (5) ---------------- */
{
  await page.click('[data-card="o1"] [data-read]');
  await sleep(150);
  const rd = await ev(() => !!document.querySelector('.readsheet'));
  ok(rd, 'L3 (leg 4): Read (trailing the meta line) opens the reading view');
  await ev(() => { document.querySelectorAll('.readsheet').forEach((x) => x.remove()); });

  await page.click('[data-card="e2"] [data-rowmenu]');
  await sleep(250);
  await page.click('.menusheet [data-menuitem="0"]');
  await sleep(150);
  const sh = await ev(() => !!document.querySelector('.sharesheet'));
  ok(sh, 'L3 (leg 4): Share via the \u22ee opens the share sheet (the retired standalone button\u2019s act stands in the menu, FD4)');
  await ev(() => { document.querySelectorAll('.sharesheet,.menusheet,.menucatcher').forEach((x) => x.remove()); });

  await page.click('[data-card="o2"] [data-rowmenu]');
  await sleep(250);
  const menuLabels = await ev(() => [...document.querySelectorAll('.menusheet [data-menuitem]')].map((b) => b.querySelector('span').textContent));
  await ev(() => { document.querySelectorAll('.menusheet,.menucatcher').forEach((x) => x.remove()); });
  const dl = await ev(() => {
    return caches.open('opn-ext-audio-v1').then(function (cache) {
      return cache.put('day/2026-11-14/o1', new Response('x'));
    }).then(function () { return refreshGridDlStates(); }).then(function () {
      var card = document.querySelector('[data-card="o1"]');
      var ico = card.querySelector('[data-rowdl]');
      var kids = [...card.querySelector('.metarow').children].map((el) => el.hasAttribute('data-rowdl') ? 'dl' : (el.hasAttribute('data-read') ? 'read' : 'span'));
      return { disp: ico ? ico.style.display : 'missing', kids };
    });
  });
  ok(menuLabels[0] === 'Share' && menuLabels[1] === 'Download' && dl.disp !== 'none' && dl.kids.join(',') === 'span,dl,read',
    'L3 (leg 4): Download stands in the \u22ee while not on device; once downloaded the \u2913 stands visible trailing the meta, before Read',
    JSON.stringify({ menuLabels, dl }));

  await page.click('[data-card="o1"] [data-markplayed]');
  await sleep(250);
  const marked = await ev(() => {
    var card = document.querySelector('[data-card="o1"]');
    return { on: card.querySelector('[data-markplayed]').classList.contains('on'), heard: card.querySelector('h3').classList.contains('heard'), played: isPlayed('o1', presentedDateStr(), 'Morning') };
  });
  ok(marked.on && marked.heard && marked.played,
    'L3 (leg 4): the dot tap marks played \u2014 dot .on + title .heard + the store written', JSON.stringify(marked));
  await page.click('[data-card="o1"] [data-markplayed]');
  await sleep(250);
  const cleared = await ev(() => {
    var card = document.querySelector('[data-card="o1"]');
    return { on: card.querySelector('[data-markplayed]').classList.contains('on'), heard: card.querySelector('h3').classList.contains('heard'), played: isPlayed('o1', presentedDateStr(), 'Morning') };
  });
  ok(!cleared.on && !cleared.heard && !cleared.played,
    'L3 (leg 4): a second dot tap clears both (dot .on off \u00b7 title .heard off \u00b7 store cleared)', JSON.stringify(cleared));
}

/* ---------------- L2 taps: disc play/pause + the \u22ee menu (3 of 5) ---------------- */
{
  await ev(() => {
    window.__pauseCalls = 0;
    audioEl.pause = function () { window.__pauseCalls++; };
    audioEl.play = function () { return Promise.resolve(); };
  });
  await page.click('[data-card="o1"] [data-playkey]');
  await sleep(400);
  const playing = await ev(() => {
    var card = document.querySelector('[data-card="o1"]');
    var disc = card.querySelector('[data-playkey]');
    return { cur: state.current ? state.current.episodeId : '', cls: disc.classList.contains('playing'), glyph: disc.textContent, bars: card.classList.contains('barsrow') };
  });
  ok(playing.cur === 'o1' && playing.cls && playing.glyph.indexOf('\u2759') > -1 && playing.bars,
    'L2 (leg 2): a disc tap plays \u2014 the tapped track stands current, the disc takes the playing dress, the bars tile stands on the card',
    JSON.stringify(playing));
  await ev(() => { Object.defineProperty(audioEl, 'paused', { configurable: true, get: function () { return false; } }); });
  await page.click('[data-card="o1"] [data-playkey]');
  await sleep(250);
  const paused = await ev(() => ({ pauseCalls: window.__pauseCalls, cur: state.current ? state.current.episodeId : '' }));
  ok(paused.pauseCalls >= 1 && paused.cur === 'o1',
    'L2 (leg 2): a second disc tap pauses (the standing toggle \u2014 pauseTransport runs, the current stands)', JSON.stringify(paused));
  await ev(() => { Object.defineProperty(audioEl, 'paused', { configurable: true, get: function () { return true; } }); });

  await page.click('[data-card="e1"] [data-rowmenu]');
  await sleep(250);
  const items = await ev(() => [...document.querySelectorAll('.menusheet [data-menuitem]')].map((b) => b.querySelector('span').textContent));
  ok(items.join('|') === 'Share|Download|Open in Spotify',
    'L2 (leg 3): the \u22ee in the box opens its standing menu with its items in standing order (Share \u00b7 Download while not on device \u00b7 Open in Spotify)', items.join('|'));
  await ev(() => { document.querySelectorAll('.menusheet,.menucatcher').forEach((x) => x.remove()); });
}

/* ---------------- L7: the playing state (2) ---------------- */
{
  const r = await ev(() => {
    state.current = { episodeId: 'o3', title: 'Lauds', block: 'Morning', url: '/api/player/feed-audio?o3' };
    Object.defineProperty(audioEl, 'paused', { configurable: true, get: function () { return false; } });
    markPlaying('o3');
    var row = document.querySelector('[data-card="o3"]');
    var tile = row.querySelector('.barstile');
    var playing = { row: row.classList.contains('barsrow'), pausedCls: row.classList.contains('barspaused'),
      disp: tile ? getComputedStyle(tile).display : '', inWrap: !!row.querySelector('.rowartwrap .barstile'),
      btn: row.querySelector('[data-playkey]').textContent, btnCls: row.querySelector('[data-playkey]').classList.contains('playing') };
    Object.defineProperty(audioEl, 'paused', { configurable: true, get: function () { return true; } });
    syncBarsPaused();
    var paused = { pausedCls: row.classList.contains('barspaused'), anim: tile ? getComputedStyle(tile.querySelector('i')).animationPlayState : '' };
    return { playing, paused };
  });
  ok(r.playing.row && !r.playing.pausedCls && r.playing.disp === 'flex' && r.playing.inWrap && r.playing.btnCls && r.playing.btn.indexOf('\u2759') > -1,
    'L7 (leg 2): the playing card shows the bars tile in the art wrap with the disc\u2019s playing dress', JSON.stringify(r.playing));
  ok(r.paused.pausedCls && r.paused.anim === 'paused',
    'L7 (leg 2): paused, the bars stand frozen on the same card', JSON.stringify(r.paused));
}

/* ---------------- L6: the podcast boundary, FD7 (2) ---------------- */
{
  const r = await ev(() => {
    state.podcasts = window.__pods;
    paintPodcasts();
    var p2 = document.querySelector('[data-podrow="p2"]');
    var order = [...p2.querySelectorAll('.prow-ctl [data-podmenu], .prow-ctl [data-podshare], .prow-ctl [data-poddlstate], .prow-ctl [data-podplay], .prow-ctl [data-podmark]')]
      .map((el) => ['data-podmenu', 'data-podshare', 'data-poddlstate', 'data-podplay', 'data-podmark'].filter((a) => el.hasAttribute(a))[0]);
    var bar = p2.querySelector('.podbar');
    var rowR = p2.getBoundingClientRect(), barR = bar ? bar.getBoundingClientRect() : null;
    return { order, barGap: barR ? Math.abs(rowR.bottom - barR.bottom) : -1, clusterInPod: p2.querySelectorAll('.prow-cluster').length };
  });
  ok(r.order.join(',') === 'data-podmenu,data-podshare,data-poddlstate,data-podplay,data-podmark' && r.clusterInPod === 0,
    'L6 (FD7): a podcast episode row keeps its .prow-ctl line with the standing order (\u22ee \u00b7 share \u00b7 \u2913 \u00b7 play \u00b7 podmark) and gains no in-box cluster', r.order.join(','));
  ok(r.barGap >= 0 && r.barGap <= 2,
    'L6 (FD7): the podcast row\u2019s partway bar stands at the row\u2019s bottom edge', 'gap=' + r.barGap);
}

console.log('harness-v424: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) console.log('failures: ' + failures.join(' | '));
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
