// harness-v413 — the Spotify-playlist Prayers experience (§1/§2).
// Client legs run in headless Chromium on the v388 extraction
// mold (harness-v412's page); Worker legs run on the
// harness-v395 mold (local wrangler + a fixture D1 through
// migration 0021). Legs map to §1.8's ten acceptance legs:
//   L1 grid · L2 manual order · L3 no computed sort · L4 block
//   head + FD4 meta · L5 row form + fallback · L6 overflow ·
//   L7 Podcasts · L8 menus/share · L9 theme · L10 FD8 +
//   download-all · W the block-order round-trip (FD2/FD9).
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { createRequire } from 'node:module';

const APP = path.resolve(process.cwd(), 'app');
const SRC = path.join(APP, 'worker/src');
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const I_SRC = readFileSync(SRC + '/index.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('ok   - ' + name); }
  else { fail++; failures.push(name); console.log('FAIL - ' + name + (extra ? ' :: ' + String(extra).slice(0, 300) : '')); }
}

/* ---------------- statics ---------------- */
{
  const mig = APP + '/migrations/0021_block_order.sql';
  ok(existsSync(mig) && /CREATE TABLE IF NOT EXISTS player_block_order/.test(readFileSync(mig, 'utf8'))
    && /block TEXT PRIMARY KEY/.test(readFileSync(mig, 'utf8')) && /sort_order INTEGER NOT NULL/.test(readFileSync(mig, 'utf8')),
    'W statics: migration 0021 creates player_block_order (block PK, sort_order)');
  ok(/seg\[2\] === "block-order" && request\.method === "GET"/.test(I_SRC)
    && /seg\[2\] === "block-order" && request\.method === "PUT"/.test(I_SRC),
    'W statics: the session GET + PUT block-order routes stand');
  ok(/seg\[2\] === "player" && seg\[3\] === "block-order"/.test(I_SRC), 'W statics: the door block-order read stands');
  ok(/blockOrder/.test(I_SRC) && /playerBlockOrder\(env\)/.test(I_SRC), 'W statics: the day payload folds the stored order');
  ok(/imageUrl: it\.imageUrl \|\| doChannelImage/.test(I_SRC) && /showImageUrl/.test(I_SRC) && /descText/.test(I_SRC),
    'W statics (§2.3): the Worker parser carries item/channel art + description into slots, externals and podcasts');
  ok(/POD_SNAPSHOT_MAX_AGE_MS/.test(I_SRC) && /podSequence/.test(I_SRC),
    'F-413-2 statics: the stored-payload refresh is podSequence\u2019s staleness rebuild (named in \u00a73)');
  ok(U_SRC.includes('ora-pro-nobis-v412-1') && !U_SRC.includes('ora-pro-nobis-v413-1'),
    'statics: the SW pin is untouched at Implement (Ship moves it)');
  ok(U_SRC.includes('id="dock-menu"') && !U_SRC.includes('id="dock-rate"') && !U_SRC.includes('id="dock-autoplay"'),
    'L6 statics: the dock carries the menu button and neither retired control');
  ok(U_SRC.includes('id="dock-play"') && U_SRC.includes('id="dock-prev"') && U_SRC.includes('id="dock-next"'),
    'L6 statics: dock transport stands');
  ok(!/#1DB954|#1ed760/i.test(C_SRC + U_SRC),
    'L9 statics: no Spotify green anywhere in the new surfaces');
  const tabs = [...U_SRC.matchAll(/data-tab="(\w+)"/g)].map((m) => m[1]);
  ok(tabs.join(',') === 'prayers,conscience,podcasts,wallpaper', 'L9 statics: the four tabs stand in order', tabs.join(','));
  ok(/\.tone-navy/.test(U_SRC) && /\.tone-gold/.test(U_SRC) && /\.tone-plum/.test(U_SRC) && /\.tone-teal/.test(U_SRC),
    'L9 statics: the four theme tones stand in the stylesheet');
  ok(!/Alphabetical|Recently added|Sort by date/.test(C_SRC), 'L3 statics: no computed sort is offered anywhere in the client');
  ok(/'\/api\/player\/block-order'/.test(C_SRC) && /opn-block-order-v413/.test(C_SRC),
    'L2 statics: the client PUTs the order and mirrors it under opn-block-order-v413');
  ok(/function openSheetMenu/.test(C_SRC) && /function openPlayerMenu/.test(C_SRC) && /function openBlockOrderEditor/.test(C_SRC) && /function openShareSheet/.test(C_SRC),
    'statics: the one menu component + the player menu + the order editor + the share sheet stand');
}

/* ---------------- client extraction (v388/v410 mold) ---------------- */
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

const PAGE_HEAD = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>CSSHERE</style></head>
<body data-lit="">
<audio id="audio"></audio>
<div id="alert"></div><main id="view"></main>
<div id="dock" class="dock hidden"><img id="dock-thumb" class="dockthumb" src="/logo.png" alt=""><div class="docktext"><div class="docktitle" id="dock-title"></div><div class="dockmeta" id="dock-meta"></div></div><button id="dock-play" class="playbtn" aria-label="Play or pause"></button><button id="dock-intentions" class="docknext dockauto" aria-label="Intentions" aria-pressed="true">Intentions On</button><button id="dock-prev" class="docknext" aria-label="Previous track">&#9198;</button><button id="dock-next" class="docknext" aria-label="Next track">&#9197;</button><button id="dock-menu" class="docknext" aria-label="More options">&#8943;</button><div class="dockprogress"><i id="dock-progress-fill"></i></div></div>
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
const PAGE = PAGE_HEAD.replace('CSSHERE', () => APP_CSS) + '<script>\n' + pieces.join('\n') + '\n</' + 'script>';

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
});

/* ---------------- L1: the grid ---------------- */
{
  const r = await ev(() => {
    localStorage.clear();
    state.dayPayload = window.__fixture;
    state.dayDescs = window.__descs; state.prayersView = { kind: 'home' };
    paintListenHome(window.__fixture);
    var cards = [...document.querySelectorAll('#home-body .blockcard')].map((c) => c.getAttribute('data-openblock'));
    return {
      cards,
      chips: [...document.querySelectorAll('[data-homefilter]')].map((c) => c.textContent.trim()),
      covers: document.querySelectorAll('#home-body .blockcard .blockcover').length,
      names: document.querySelectorAll('#home-body .blockcard-name2').length,
      cardPlays: document.querySelectorAll('#home-body .blockcard [data-queue]').length,
      cardDl: document.querySelectorAll('#home-body [data-carddl]').length,
      sortName: (document.getElementById('sort-name') || {}).textContent || '',
      episodesAfter: (() => { var cs = [...document.querySelectorAll('#home-body .blockcard')]; return cs.length === 10 && cs[9].getAttribute('data-openblock') === '__episodes'; })(),
      playAll: !!document.getElementById('play-all'),
      sleepBtn: !!document.getElementById('sleep-btn')
    };
  });
  ok(r.cards.slice(0, 9).join(',') === 'Morning,Midmorning,Midday,Afternoon,Evening,Night,Mass and Homilies,Novenas,The AI Signal' && r.cards[9] === '__episodes',
    'L1: the grid paints all nine blocks in contract order with no stored order, the episodes card last', r.cards.join(','));
  ok(r.chips.join('|') === 'Praylists|Novenas|Downloaded', 'L1/FD8: the three filter chips stand', r.chips.join('|'));
  ok(r.covers === 10 && r.names === 10 && r.cardPlays === 10 && r.cardDl === 9,
    'L1: every card carries a cover tile, the name line, and the play button; the nine block cards carry the downloaded icon slot', JSON.stringify(r));
  ok(r.sortName === 'Day order' && r.episodesAfter && r.playAll && !r.sleepBtn,
    'L1/R2/R3: the sort row reads Day order, the episodes card stands after the grid, Play All stands, the home sleep button is retired', JSON.stringify(r));
}

/* ---------------- L2/L3: manual order ---------------- */
{
  const r = await ev(() => {
    window.__fixture2 = JSON.parse(JSON.stringify(window.__fixture));
    window.__fixture2.blockOrder = ['Night', 'Morning'];
    state.dayPayload = window.__fixture2;
    paintListenHome(window.__fixture2);
    var cards = [...document.querySelectorAll('#home-body .blockcard')].map((c) => c.getAttribute('data-openblock'));
    var q = queueBuild(extRebuildDescs(window.__fixture2));
    var qBlocks = []; q.forEach((d) => { if (d.block && !qBlocks.includes(d.block)) qBlocks.push(d.block); });
    return { cards, qBlocks, sortName: (document.getElementById('sort-name') || {}).textContent || '' };
  });
  ok(r.cards[0] === 'Night' && r.cards[1] === 'Morning' && r.cards[2] === 'Midmorning',
    'L2/FD1: the stored order leads the grid; absent blocks follow in contract order', r.cards.join(','));
  ok(r.qBlocks.join(',') === 'Morning,Night', 'L2/FD1: Play All / queue order is untouched by the stored order', r.qBlocks.join(','));
  ok(r.sortName === 'Manual order', 'L2: the sort row reads Manual order while a stored order stands');
  await ev(() => { window.__fetchLog.length = 0; openBlockOrderEditor(); });
  const e1 = await ev(() => document.querySelectorAll('.ordersheet [data-ordup]').length + document.querySelectorAll('.ordersheet [data-orddown]').length);
  const e2 = await ev(() => [...document.querySelectorAll('.ordersheet h1')].map((h) => h.textContent));
  ok(e1 === 18 && /Playlist order/.test(e2.join(' ')), 'L2/FD5: the editor lists all nine blocks with up/down buttons', 'mv=' + e1);
  await page.click('.ordersheet [data-ordup="1"]');
  await sleep(150);
  const e3 = await ev(() => ({
    puts: window.__fetchLog.filter((f) => f.method === 'PUT' && f.path === '/api/player/block-order').map((f) => f.body),
    mirror: JSON.parse(localStorage.getItem('opn-block-order-v413') || 'null'),
    first: (document.querySelector('.ordersheet .setname') || {}).textContent || ''
  }));
  ok(e3.puts.length === 1 && JSON.stringify(e3.puts[0].order.slice(0, 2)) === '["Morning","Night"]',
    'L2/FD5: a move PUTs the full new order at once', JSON.stringify(e3.puts));
  ok(e3.mirror && e3.mirror[0] === 'Morning' && e3.mirror[1] === 'Night' && /Morning/.test(e3.first),
    'L2/FD5: the mirror writes through and the editor repaints in the new order', JSON.stringify(e3));
  const e4 = await ev(() => document.querySelector('.ordersheet').textContent);
  ok(!/A\u2013Z|Alphabetical|By date/.test(e4), 'L3: the editor offers no computed sort');
  await ev(() => { document.querySelectorAll('.sheet').forEach(function (x) { x.remove(); }); state.dayPayload = window.__fixture; localStorage.removeItem('opn-block-order-v413'); });
}

/* ---------------- L4: block page head + FD4 meta ---------------- */
{
  const r = await ev(() => {
    state.dayDescs = window.__descs;
    paintBlockPage(window.__fixture, 'Morning');
    var head = document.querySelector('.blockpage-head');
    var order = [...head.children].map((c) => c.className);
    var firstRow = document.querySelector('.blockpage-head + .card, .blockpage-head ~ .card');
    return {
      order,
      title: (head.querySelector('.blockpage-title') || {}).textContent || '',
      desc: (head.querySelector('.blockpage-desc') || {}).textContent || '',
      owner: (head.querySelector('.blockpage-owner') || {}).textContent || '',
      meta: (head.querySelector('[data-bmeta]') || {}).textContent || '',
      dlBtn: !!head.querySelector('[data-blockdl]'),
      firstCard: firstRow ? firstRow.getAttribute('data-card') : null,
      intentionsFirst: firstRow ? /Intentions/.test(firstRow.textContent) : false
    };
  });
  const seq = ['backrow', 'blockcover', 'blockpage-title', 'blockpage-desc', 'blockpage-owner', 'blockpage-meta', 'blockpage-dlrow', 'blockpage-dlnote', 'blockpage-playrow'];
  ok(seq.every((c, i) => (r.order[i] || '').includes(c)), 'L4: the head composes in \u00a71.3\u2019s order (back \u00b7 cover \u00b7 title \u00b7 description \u00b7 owner \u00b7 meta \u00b7 download \u00b7 play)', r.order.join(' | '));
  ok(r.desc === 'Praylists' && r.owner === 'Ora Pro Nobis', 'L4: description (the standing caption) + owner lines stand', r.desc + ' / ' + r.owner);
  ok(r.meta === '3 episodes \u00b7 8min', 'L4/FD4: the meta line is count + the summed standing durations', r.meta);
  ok(r.dlBtn && r.intentionsFirst, 'L4: the download-all toggle stands and the Intentions card still opens the block', JSON.stringify(r));
  const r2 = await ev(() => { paintBlockPage(window.__fixture, 'Night'); return (document.querySelector('[data-bmeta]') || {}).textContent || ''; });
  ok(r2 === '1 episodes', 'L4/FD4: a block with no standing duration shows the count only', r2);
}

/* ---------------- L5: row form + fallback ---------------- */
{
  const r = await ev(() => {
    var ext = trackCard({ episodeId: 'm2', title: 'Daily Verse', kind: 'external', source: 'VerseCast', available: true, url: 'https://x/m2.mp3', streamUrl: 'https://x/m2.mp3', durationS: 120, imageUrl: 'https://img.example/m2.jpg', descText: 'A short reflection on the verse.', spotifyUrl: 'https://open.spotify.com/episode/m2', _block: 'Morning' });
    var own = trackCard({ episodeId: 'm1', title: 'Invitatory', kind: 'episode', available: true, url: 'https://x/m1.mp3', durationS: 300, _block: 'Morning' });
    var host = document.createElement('div'); host.innerHTML = ext + own; document.getElementById('view').appendChild(host);
    var extRow = host.children[0], ownRow = host.children[1];
    return {
      img: (extRow.querySelector('img.rowart') || {}).getAttribute ? extRow.querySelector('img.rowart').getAttribute('src') : null,
      tile: !!extRow.querySelector('.rowart.tile'),
      snippet: (extRow.querySelector('.snippet') || {}).textContent || '',
      meta: (extRow.querySelector('.meta') || {}).textContent || '',
      cluster: ['data-rowmenu', 'data-rowshare', 'data-rowdl', 'data-playkey'].map((a) => !!extRow.querySelector('[' + a + ']')).join(','),
      ownSnippet: !!ownRow.querySelector('.snippet'),
      ownTile: !!ownRow.querySelector('.rowart.tile'),
      ownSpotifyLink: !!ownRow.querySelector('a[href*="open.spotify.com"]')
    };
  });
  ok(r.img === 'https://img.example/m2.jpg' && r.tile, 'L5/\u00a72.3: the row art is the item image over the fallback tile', JSON.stringify(r));
  ok(r.snippet.includes('short reflection') && /Today \u00b7 2:00 \u00b7 VerseCast/.test(r.meta),
    'L5: the snippet line + the Today \u00b7 duration \u00b7 source meta stand', r.snippet + ' // ' + r.meta);
  ok(r.cluster === 'true,true,true,true', 'L5: the row cluster is \u22ee \u00b7 share \u00b7 downloaded \u00b7 play, in order');
  ok(!r.ownSnippet && r.ownTile && !r.ownSpotifyLink,
    'L5/F-413-1/R4: own Ora rows carry no snippet (no description data exists), the tile stands, and the Spotify link moved into the menu', JSON.stringify(r));
  const fb = await ev(() => {
    var bad = trackCard({ episodeId: 'bad1', title: 'Bad Art', kind: 'external', source: 'VerseCast', available: true, url: 'https://x/b.mp3', streamUrl: 'https://x/b.mp3', durationS: 60, imageUrl: 'http://127.0.0.1:9/nope.jpg', descText: 'x', _block: 'Morning' });
    var host = document.createElement('div'); host.id = 'fbhost'; host.innerHTML = bad; document.getElementById('view').appendChild(host);
    return true;
  });
  await page.waitForFunction(() => { var h = document.getElementById('fbhost'); return h && !h.querySelector('img.rowart') && !!h.querySelector('.rowart.tile'); }, null, { timeout: 5000 }).catch(() => {});
  const fb2 = await ev(() => { var h = document.getElementById('fbhost'); return { img: !!h.querySelector('img.rowart'), tile: !!h.querySelector('.rowart.tile') }; });
  ok(!fb2.img && fb2.tile, 'L5/\u00a72.3: a failed image falls back to the tile (onerror swap)', JSON.stringify(fb2));
}

/* ---------------- L6: the overflow menu ---------------- */
{
  await ev(() => { localStorage.removeItem('opn-autoplay-v358'); openPlayerMenu(); });
  const m1 = await ev(() => [...document.querySelectorAll('.sheet .menurow')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()));
  ok(m1.length === 3 && /^Autoplay/.test(m1[0]) && /^Sleep timer/.test(m1[1]) && /^Playback speed/.test(m1[2]),
    'L6/FD3: the player menu holds exactly Autoplay \u00b7 Sleep timer \u00b7 Playback speed', m1.join(' | '));
  ok(/On/.test(m1[0]) && /1\u00d7/.test(m1[2]), 'L6/FD3: the items carry live state lines (Autoplay stands On by the app\u2019s default)', m1.join(' | '));
  await page.click('.sheet .menurow');
  await sleep(100);
  const m2 = await ev(() => ({ stored: localStorage.getItem('opn-autoplay-v358'), line: (document.querySelector('.sheet .menurow') || {}).textContent || '' }));
  ok(m2.stored === 'off' && /Off/.test(m2.line), 'L6/FD3: the Autoplay row toggles in place and its state line follows', JSON.stringify(m2));
  await ev(() => {
    document.querySelectorAll('.sheet').forEach(function (x) { x.remove(); });
    state.current = { episodeId: 'm1', title: 'Invitatory', block: 'Morning', url: 'https://x/m1.mp3', durationS: 300 };
    state.queue = [state.current]; state.queueIdx = 0;
    openNowPlaying();
  });
  await sleep(100);
  const np = await ev(() => ({
    menu: !!document.getElementById('np-menu'), intentions: !!document.getElementById('np-intentions'),
    gone: ['np-autoplay', 'np-sleep', 'np-speed'].map((id) => !document.getElementById(id)).join(','),
    transport: ['np-play', 'np-prev', 'np-next'].map((id) => !!document.getElementById(id)).join(',')
  }));
  ok(np.menu && np.intentions && np.gone === 'true,true,true' && np.transport === 'true,true,true',
    'L6/FD3/R1: the Now Playing row carries \u22ee + the intentions toggle (unmoved); the three retired buttons are gone; transport stands', JSON.stringify(np));
  await ev(() => document.querySelectorAll('.sheet').forEach(function (x) { x.remove(); }));
}

/* ---------------- L7: Podcasts ---------------- */
{
  const idx = await ev(() => {
    state.podcastsIndex = { seriesList: [{ series: 'bible', title: 'Bible in a Year', available: true, listenedCount: 316, total: 372, currentLabel: 'Day 316', showImageUrl: 'https://img.example/bible.jpg' }] };
    paintPodcastsIndex();
    var card = document.querySelector('[data-podseries="bible"]');
    return { img: (card.querySelector('img.rowart') || {}).getAttribute ? card.querySelector('img.rowart').getAttribute('src') : null, meta: card.textContent.includes('316 of 372 listened') };
  });
  ok(idx.img === 'https://img.example/bible.jpg' && idx.meta, 'L7/\u00a72.7: series entries carry the show artwork + the standing progress meta', JSON.stringify(idx));
  const pg = await ev(() => {
    var payload = { series: 'bible', title: 'Bible in a Year', available: true, showImageUrl: 'https://img.example/bible.jpg', showDesc: 'The whole Bible, one day at a time.',
      listenedCount: 1, total: 2, currentKey: 'b2',
      entries: [
        { key: 'b1', label: 'Day 1', title: 'Genesis', url: 'https://x/b1.mp3', durationS: 900, listened: true, listenDate: 'Nov 1', imageUrl: 'https://img.example/b1.jpg', descText: 'In the beginning.' },
        { key: 'b2', label: 'Day 2', title: 'Exodus', url: 'https://x/b2.mp3', durationS: 800, listened: false, imageUrl: null, descText: null }
      ] };
    state.podcasts = payload;
    paintPodcasts();
    var head = document.querySelector('.podpage-head');
    var row1 = document.querySelector('[data-podrow="b1"]');
    return {
      cover: (head.querySelector('img.coverimg') || {}).getAttribute ? head.querySelector('img.coverimg').getAttribute('src') : null,
      desc: head.textContent.includes('one day at a time'),
      meta: head.textContent.includes('1 of 2 listened') && head.textContent.includes('28min'),
      rowImg: (row1.querySelector('img.rowart') || {}).getAttribute ? row1.querySelector('img.rowart').getAttribute('src') : null,
      snippet: (row1.querySelector('.snippet') || {}).textContent || '',
      cluster: ['data-podmenu', 'data-podshare', 'data-podplay', 'data-podmark'].map((a) => !!row1.querySelector('[' + a + ']')).join(','),
      getBtn: !!document.querySelector('[data-poddl]'),
      currentKey: state.podcasts.currentKey
    };
  });
  ok(pg.cover === 'https://img.example/bible.jpg' && pg.desc && pg.meta,
    'L7/\u00a72.7: the episode page head is cover \u00b7 title \u00b7 description \u00b7 progress + total-duration meta', JSON.stringify(pg));
  ok(pg.rowImg === 'https://img.example/b1.jpg' && pg.snippet.includes('beginning') && pg.cluster === 'true,true,true,true' && !pg.getBtn && pg.currentKey === 'b2',
    'L7: episode rows take the \u00a72.6 form (art \u00b7 snippet \u00b7 cluster \u00b7 mark); the Get button retires; the current rule is untouched by the paint', JSON.stringify(pg));
}

/* ---------------- L8: menus + share ---------------- */
{
  await ev(() => { state.dayDescs = window.__descs; openDayRowMenu(window.__descs[2]); });
  await sleep(200);
  const r = await ev(() => {
    var day = [...document.querySelectorAll('.sheet .menurow')].map((b) => b.textContent.trim());
    document.querySelectorAll('.sheet').forEach(function (x) { x.remove(); });
    podDlStateMap = {};
    openPodRowMenu('b1');
    var pod = [...document.querySelectorAll('.sheet .menurow')].map((b) => b.textContent.trim());
    document.querySelectorAll('.sheet').forEach(function (x) { x.remove(); });
    return { day, pod };
  });
  ok(r.day.join('|') === 'Share|Download|Open in Spotify', 'L8/FD7: the day-row menu is Share \u00b7 Download \u00b7 Open in Spotify (nothing the app cannot honor)', r.day.join('|'));
  ok(r.pod.join('|') === 'Share|Download|Mark as not listened', 'L8/FD7: the podcast-row menu is Share \u00b7 Download \u00b7 the state-matched mark', r.pod.join('|'));
  const s = await ev(() => {
    openShareSheet({ artHtml: coverTileHtml('Morning', 'sm'), title: 'Daily Verse', line: 'Episode \u00b7 2:00', url: 'https://open.spotify.com/episode/m2' });
    var sh = document.querySelector('.sheet');
    var hasShare = [...sh.querySelectorAll('button')].some((b) => /Share\u2026/.test(b.textContent));
    var copy = [...sh.querySelectorAll('button')].some((b) => /Copy link/.test(b.textContent));
    document.querySelectorAll('.sheet').forEach(function (x) { x.remove(); });
    return { hasShare, copy, navShare: typeof navigator.share === 'function',
      precedence: shareUrlFor({ spotifyUrl: 'https://open.spotify.com/episode/m2', streamUrl: 'https://x/s.mp3', url: 'https://x/u.mp3' }),
      stream: shareUrlFor({ streamUrl: 'https://x/s.mp3', url: 'https://x/u.mp3' }) };
  });
  ok(s.copy && s.hasShare === s.navShare, 'L8/FD6: Copy link always stands; Share\u2026 stands exactly where navigator.share does', JSON.stringify(s));
  ok(s.precedence === 'https://open.spotify.com/episode/m2' && s.stream === 'https://x/s.mp3',
    'L8/FD6: the share payload URL follows the \u00a72.8 precedence (Spotify \u00b7 stream \u00b7 enclosure)', JSON.stringify(s));
}

/* ---------------- L10: FD8 + download-all ---------------- */
{
  const n = await ev(() => {
    state.dayPayload = window.__fixture; state.prayersView = { kind: 'home' };
    state.homeFilter = 'novenas'; paintListenHome(window.__fixture);
    var cards = [...document.querySelectorAll('#home-body .blockcard')].map((c) => c.getAttribute('data-openblock'));
    state.homeFilter = ''; return cards;
  });
  ok(n.join(',') === 'Novenas', 'L10/FD8: the Novenas chip isolates the Novenas card', n.join(','));
  await ev(async () => {
    var cache = await caches.open('opn-ext-audio-v1');
    await cache.put(new Request('/day/2026-11-14/m1'), new Response('x'));
    await cache.put(new Request('/day/2026-11-14/m2'), new Response('x'));
    window.__dlKeys = (await cache.keys()).map((rq) => rq.url);
  });
  await ev(() => { state.dayDescs = window.__descs; paintListenHome(window.__fixture); return refreshGridDlStates(); });
  await sleep(200);
  const d = await ev(() => {
    state.homeFilter = 'downloaded'; paintListenHome(window.__fixture);
    var cards = [...document.querySelectorAll('#home-body .blockcard')].map((c) => c.getAttribute('data-openblock'));
    state.homeFilter = '';
    var icon = document.querySelector('[data-carddl="Morning"]');
    return { cards, gridDl: state.gridDl, iconShown: icon ? icon.style.display !== 'none' : false };
  });
  ok(d.gridDl && d.gridDl.Morning === true && d.cards.join(',') === 'Morning',
    'L10/FD8: the Downloaded chip reads the client\u2019s own cached set (web included)', JSON.stringify(d));
  await ev(() => { state.dayDescs = window.__descs; paintBlockPage(window.__fixture, 'Morning'); return refreshGridDlStates(); });
  await sleep(200);
  const b1 = await ev(() => { var b = document.querySelector('[data-blockdl]'); return b ? b.textContent : null; });
  ok(b1 === 'On this device', 'L10/\u00a72.11: a fully downloaded block reads On this device on its page', String(b1));
  const b2 = await ev(() => (document.querySelector('[data-blockdlnote]') || {}).textContent || '');
  ok(/Clear offline downloads in Settings/.test(b2), 'L10/F-413-3: the toggle\u2019s OFF direction is the named Settings-clear sub-line', b2);
}
await browser.close();
server.close();

/* ---------------- W: block-order round-trip on a fixture D1 ---------------- */
const WRANGLER = '/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler';
const WPORT = 9000 + (process.pid % 400);
const WBASE = 'http://127.0.0.1:' + WPORT;
const TOKEN = 'harness-token';
const PERSIST = path.join(APP, '.wrangler-test-v413');
const TMPD = mkdtempSync(path.join(os.tmpdir(), 'opn-v413-'));
function wranglerD1(appDir, persist, args) {
  return execFileSync(WRANGLER, ['d1', 'execute', 'ora-pro-nobis-app', '--local', '--config', path.join(appDir, 'wrangler.toml'), '--persist-to', persist, ...args],
    { cwd: appDir, stdio: 'pipe', env: { ...process.env, CLOUDFLARE_API_TOKEN: '' } }).toString();
}
function wranglerD1File(appDir, persist, file) { wranglerD1(appDir, persist, ['--file', file]); }
function d1q(appDir, persist, sql) {
  const out = wranglerD1(appDir, persist, ['--json', '--command', sql]);
  const parsed = JSON.parse(out.slice(out.indexOf('[')));
  return parsed[0].results || [];
}
const procs = [];
function startApp(appDir, port, persist) {
  const args = ['dev', '--config', path.join(appDir, 'wrangler.toml'), '--local', '--port', String(port), '--persist-to', persist,
    '--var', 'LOCAL_DEV:1', '--var', 'AGENT_TOKEN:' + TOKEN];
  const child = spawn(WRANGLER, args, { cwd: appDir, stdio: ['ignore', 'pipe', 'pipe'], detached: true, env: { ...process.env, CLOUDFLARE_API_TOKEN: '' } });
  child.stdout.on('data', () => {}); child.stderr.on('data', () => {});
  procs.push(child);
  return child;
}
async function waitUp(base) {
  for (let i = 0; i < 90; i++) { try { const r = await fetch(base + '/'); if (r.status) return true; } catch { /* not up */ } await sleep(1000); }
  return false;
}
const wget = async (p, headers = {}) => { const r = await fetch(WBASE + p, { headers }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const wput = async (p, jsonBody) => {
  const r = await fetch(WBASE + p, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(jsonBody || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
try {
  const migDir = path.join(APP, 'migrations');
  const files = readdirSync(migDir).filter((x) => x.endsWith('.sql')).sort().map((f) => path.join(migDir, f));
  rmSync(PERSIST, { recursive: true, force: true });
  const joined = path.join(TMPD, 'all-migrations.sql');
  writeFileSync(joined, files.map((x) => readFileSync(x, 'utf8')).join('\n'));
  wranglerD1File(APP, PERSIST, joined);
  const cols = d1q(APP, PERSIST, 'PRAGMA table_info(player_block_order)');
  ok(cols.map((c) => c.name).join(',') === 'block,sort_order,updated_at' && cols.find((c) => c.name === 'block').pk === 1,
    'W: 0021 creates player_block_order keyed by block', JSON.stringify(cols.map((c) => [c.name, c.pk])));
  startApp(APP, WPORT, PERSIST);
  const up = await waitUp(WBASE);
  ok(up, 'W: the fixture Worker boots (LOCAL_DEV)');
  const p1 = await wput('/api/player/block-order', { order: ['Night', 'Morning', 'Novenas'] });
  const rows = d1q(APP, PERSIST, 'SELECT block, sort_order FROM player_block_order ORDER BY sort_order');
  ok(p1.status === 200 && rows.length === 3 && rows[0].block === 'Night' && rows[1].block === 'Morning' && rows[2].block === 'Novenas',
    'W/FD2: a PUT stores the arrangement with positions', JSON.stringify(rows));
  const g1 = await wget('/api/player/block-order');
  ok(g1.status === 200 && JSON.stringify(g1.body.order) === '["Night","Morning","Novenas"]',
    'W/FD2: the session GET reads the stored order back', JSON.stringify(g1.body));
  const p2 = await wput('/api/player/block-order', { order: ['Morning', 'NotABlock'] });
  ok(p2.status === 400, 'W: a PUT naming a non-block answers 400 and stores nothing new', 'status=' + p2.status);
  const door = await wget('/api/agent/player/block-order', { authorization: 'Bearer ' + TOKEN });
  ok(door.status === 200 && JSON.stringify(door.body.order) === '["Night","Morning","Novenas"]',
    'W: the door read carries the stored order (the audit surface)', JSON.stringify(door.body));
  const fold = await wget('/api/agent/player/day', { authorization: 'Bearer ' + TOKEN });
  ok(fold.status === 200 && JSON.stringify(fold.body.blockOrder) === '["Night","Morning","Novenas"]',
    'W/FD2: the day payload folds the stored order', JSON.stringify(fold.body.blockOrder || fold.status));
  const p3 = await wput('/api/player/block-order', { order: [] });
  const g2 = await wget('/api/player/block-order');
  ok(p3.status === 200 && g2.status === 200 && (g2.body.order == null || (Array.isArray(g2.body.order) && g2.body.order.length === 0)),
    'W/FD1: an empty PUT clears the arrangement (absence = contract order)', JSON.stringify(g2.body));
} finally {
  for (const p of procs) { try { process.kill(-p.pid, 'SIGKILL'); } catch { try { p.kill('SIGKILL'); } catch { /* gone */ } } }
  rmSync(PERSIST, { recursive: true, force: true });
}

console.log('---');
console.log('harness-v413: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) console.log('failures: ' + failures.join(' | '));
process.exit(fail ? 1 : 0);
