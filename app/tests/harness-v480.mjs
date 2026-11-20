// harness-v480.mjs — v480 media player artwork evidence (mold: harness-v475).
//   S1–S4  statics: artUriFor stands and reads the descriptor's
//       imageUrl · oraSnapshotTrack's four arms all carry it ·
//       nativeContractItem's podcast arm carries it and its day
//       arm rides the snapshot track's field · setMediaSessionFor
//       names the descriptor's art with the logo pair only as
//       the no-art fallback
//   A  artUriFor: a relative path rides the origin (the own
//       feed's '/logo.png' among them) · an absolute URL passes
//       · no art stands as ''
//   B  oraSnapshotTrack per kind: own episode → <origin>/logo.png
//       (the logo THROUGH the path) · the AI Signal → its channel
//       art · a day external (standing slot + passthrough slot)
//       → its own art · a descriptor with no art → ''
//   C  nativeContractItem: a feed podcast episode → its show
//       art · a standing-series episode → its show art · a day
//       item → the snapshot track's artUri rides through
//   D  oraDaySnapshot: the tracks carry the same artUris
//   E  setMediaSessionFor (browser form): a descriptor with
//       art names that art · a descriptor without art names
//       the logo pair
// Run: node app/tests/harness-v480.mjs   (from the worktree root)
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import http from 'node:http';

const ROOT = process.cwd();
const APP = ROOT + '/app';
const CLIENT = APP + '/worker/src/client.ts';
const UI = APP + '/worker/src/ui.ts';
const C_SRC = readFileSync(CLIENT, 'utf8');
const U_SRC = readFileSync(UI, 'utf8');

let pass = 0, fail = 0; const failures = [];
function ok(c, label, extra) {
  if (c) { pass++; console.log('ok -', label); }
  else { fail++; failures.push(label); console.log('not ok -', label, extra ? ' :: ' + extra : ''); }
}

/* ---------------- statics ---------------- */
{
  const auf = C_SRC.slice(C_SRC.indexOf('function artUriFor'), C_SRC.indexOf('function oraSnapshotTrack'));
  ok(auf.includes('desc.imageUrl') && auf.includes('location.origin'),
    'S1 statics: artUriFor reads the descriptor\u2019s imageUrl and absolutizes a relative path on the origin');
  const ost = C_SRC.slice(C_SRC.indexOf('function oraSnapshotTrack'), C_SRC.indexOf('function oraDaySnapshot'));
  const arms = (ost.match(/artUri: artUriFor\(d\)/g) || []).length;
  ok(arms >= 4, 'S2 statics: oraSnapshotTrack carries artUri in all four arms (passthrough · slot external · own · own fallback)', 'arms=' + arms);
  const nci = C_SRC.slice(C_SRC.indexOf('function nativeContractItem'), C_SRC.indexOf('function nativeContractFor'));
  ok(nci.includes("artUri: artUriFor(d)"), 'S3 statics: nativeContractItem\u2019s podcast arm carries artUri from the descriptor');
  ok(nci.includes('artUri: t.artUri'), 'S3 statics: nativeContractItem\u2019s day arm rides the snapshot track\u2019s artUri');
  const sms = C_SRC.slice(C_SRC.indexOf('function setMediaSessionFor'), C_SRC.indexOf('Media session focus'));
  ok(sms.includes('artUriFor(desc)') && sms.includes("'/logo.png'"),
    'S4 statics: setMediaSessionFor names the descriptor\u2019s art, the logo pair standing only as the no-art fallback');
}

/* ---------------- client extraction (v412 mold) ---------------- */
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
<div id="dock" class="dock hidden"><img class="dockthumb" src="/logo.png" alt=""><div class="docktext"><div class="docktitle" id="dock-title"></div><div class="dockmeta" id="dock-meta"></div></div><button id="dock-play" class="playbtn" aria-label="Play or pause"></button><button id="dock-autoplay" class="docknext dockauto" aria-label="Autoplay">Autoplay On</button><button id="dock-intentions" class="docknext dockauto" aria-label="Intentions" aria-pressed="true">Intentions On</button><button id="dock-prev" class="docknext" aria-label="Previous track">&#9198;</button><button id="dock-next" class="docknext" aria-label="Next track">&#9197;</button><button id="dock-rate" class="docknext dockauto" aria-label="Playback speed">1&times;</button><div class="dockprogress"><i id="dock-progress-fill"></i></div></div>
<div id="cards"></div>
<div id="rows"></div>
<script>
window.__fetchLog = [];
window.fetch = function (path, opts) {
  window.__fetchLog.push({ path: String(path) });
  return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({}); } });
};
function extFetchText(url) { return Promise.reject(new Error('offline')); }
function refreshPlayedChrome() {}
window.__urlN = 0; window.__revoked = [];
URL.createObjectURL = function () { return 'blob:fake-' + (++window.__urlN); };
URL.revokeObjectURL = function (u) { window.__revoked.push(u); };
</` + `script>
<script>
var state = { tab: 'prayers', block: null, playingKey: null, playingUrl: null, queue: [], queueIdx: -1, current: null, pendingStart: null,
  storedDay: '2026-11-16', presentedDay: '2026-11-16', dateLabel: 'Monday, November 16', liturgical: null,
  pendingResume: null, sleep: { mode: 'off' }, readTracks: {}, dayDescs: [], dayPayload: null, playedCache: null,
  repeatIds: {}, previewQueue: null, queuePreviewIdx: -1, restoredQueue: false, restoreProbe: null, podRestoreProbe: null,
  prayersView: { kind: 'home' }, searchQuery: '', podcasts: null, podcastsIndex: null, podcastsReturn: null,
  extSlots: {}, extStanding: [], rate: 1, errWaitKey: null, errWaitN: 0, startRetryKey: null, lastStartAt: 0 };
try { localStorage.setItem('opn-intentions-v384', 'off'); } catch (e) {}
</` + `script>`;
const PAGE = PAGE_HEAD.replace('CSSHERE', () => APP_CSS) + '<script>\n' + pieces.join('\n') + '\n</' + 'script>';

const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(PAGE); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const ORIGIN = 'http://127.0.0.1:' + PORT;
const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 400, height: 800 } });
page.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 200)));
await page.goto(ORIGIN + '/');

/* ---------------- A: artUriFor ---------------- */
{
  const r = await page.evaluate(() => ({
    rel: artUriFor({ imageUrl: '/logo.png' }),
    abs: artUriFor({ imageUrl: 'https://art19.example/cover.jpg' }),
    none: artUriFor({}),
    nul: artUriFor({ imageUrl: null }),
    origin: location.origin,
  }));
  ok(r.rel === r.origin + '/logo.png', 'A1 artUriFor: a relative path rides the origin — the own feed\u2019s logo through the path', JSON.stringify(r));
  ok(r.abs === 'https://art19.example/cover.jpg', 'A2 artUriFor: an absolute URL passes unchanged');
  ok(r.none === '' && r.nul === '', 'A3 artUriFor: no art stands as an empty string');
}

/* ---------------- B: oraSnapshotTrack per kind ---------------- */
{
  const r = await page.evaluate(() => {
    const out = {};
    out.own = oraSnapshotTrack({ episodeId: 'marian-antiphon', enclosureUrl: 'https://own.example/antiphon.mp3', imageUrl: '/logo.png', block: 'Morning', title: 'Marian Antiphon', durationS: 125 }, '2026-11-16');
    out.ai = oraSnapshotTrack({ episodeId: 'the-ai-signal', url: '/api/player/audio/2026-11-16/the-ai-signal', imageUrl: 'https://ai.example/signal.jpg', block: 'News', title: 'The AI Signal', durationS: 600 }, '2026-11-16');
    state.extSlots = { 'ext-biy': { enclosureUrl: 'https://cdn.example/biy-day318.mp3', streamUrl: 'https://cdn.example/biy-day318.mp3' } };
    state.extStanding = [{ slotId: 'ext-biy', download: 'keep' }];
    out.ext = oraSnapshotTrack({ episodeId: 'ext-biy', imageUrl: 'https://cdn.example/biy-cover.jpg', block: 'Midmorning', title: 'Bible in a Year', durationS: 1500 }, '2026-11-16');
    state.extStanding = [{ slotId: 'ext-biy', download: 'passthrough' }];
    out.pass = oraSnapshotTrack({ episodeId: 'ext-biy', imageUrl: 'https://cdn.example/biy-cover.jpg', block: 'Midmorning', title: 'Bible in a Year', durationS: 1500 }, '2026-11-16');
    state.extSlots = {}; state.extStanding = [];
    out.noart = oraSnapshotTrack({ episodeId: 'rosary', enclosureUrl: 'https://own.example/rosary.mp3', block: 'Morning', title: 'Daily Rosary', durationS: 900 }, '2026-11-16');
    out.origin = location.origin;
    return out;
  });
  ok(r.own && r.own.kind === 'episode' && r.own.artUri === r.origin + '/logo.png',
    'B1 snapshot: an own episode\u2019s artUri is the logo ON THE ORIGIN — through the path, not a shell stamp', JSON.stringify(r.own));
  ok(r.ai && r.ai.artUri === 'https://ai.example/signal.jpg', 'B2 snapshot: the AI Signal carries its channel art', JSON.stringify(r.ai));
  ok(r.ext && r.ext.kind === 'external' && r.ext.artUri === 'https://cdn.example/biy-cover.jpg',
    'B3 snapshot: a day external carries its own art', JSON.stringify(r.ext));
  ok(r.pass && r.pass.artUri === 'https://cdn.example/biy-cover.jpg',
    'B4 snapshot: the passthrough external carries its own art', JSON.stringify(r.pass));
  ok(r.noart && r.noart.artUri === '', 'B5 snapshot: a descriptor with no art carries an empty artUri', JSON.stringify(r.noart));
}

/* ---------------- C: nativeContractItem ---------------- */
{
  const r = await page.evaluate(() => {
    const out = {};
    out.feed = nativeContractItem({ kind: 'podcast', episodeId: 'gid://art19-ep/1', url: 'https://rss.art19.com/ep.mp3', imageUrl: 'https://art19.example/exorcist.jpg', title: 'S3 Case #24', seriesKey: 'gid://art19-ep/1', podSeries: 'exorcist-files', durationS: 3420, block: 'Podcasts' });
    out.series = nativeContractItem({ kind: 'podcast', episodeId: 'ciy:day-2', url: 'https://cdn.example/ciy2.mp3', imageUrl: 'https://cdn.example/ciy-show.jpg', title: 'Day 2', seriesKey: 'ciy:day-2', podSeries: 'catechism-in-a-year', durationS: 1200, block: 'Podcasts' });
    out.day = nativeContractItem({ episodeId: 'marian-antiphon', enclosureUrl: 'https://own.example/antiphon.mp3', imageUrl: '/logo.png', block: 'Morning', title: 'Marian Antiphon', durationS: 125 });
    out.origin = location.origin;
    return out;
  });
  ok(r.feed && r.feed.kind === 'podcast' && r.feed.artUri === 'https://art19.example/exorcist.jpg',
    'C1 contract: a feed episode carries its show art — the Exorcist Files case', JSON.stringify(r.feed));
  ok(r.series && r.series.artUri === 'https://cdn.example/ciy-show.jpg',
    'C2 contract: a standing-series episode carries its show art', JSON.stringify(r.series));
  ok(r.day && r.day.artUri === r.origin + '/logo.png',
    'C3 contract: a day item rides the snapshot track\u2019s artUri (the own episode\u2019s logo)', JSON.stringify(r.day));
}

/* ---------------- D: oraDaySnapshot ---------------- */
{
  const r = await page.evaluate(() => {
    state.dayDescs = [
      { episodeId: 'marian-antiphon', enclosureUrl: 'https://own.example/antiphon.mp3', imageUrl: '/logo.png', block: 'Morning', title: 'Marian Antiphon', durationS: 125, available: true },
      { episodeId: 'the-ai-signal', url: '/api/player/audio/2026-11-16/the-ai-signal', imageUrl: 'https://ai.example/signal.jpg', block: 'News', title: 'The AI Signal', durationS: 600, available: true },
    ];
    const snap = oraDaySnapshot();
    return { tracks: snap ? snap.tracks : null, origin: location.origin };
  });
  ok(r.tracks && r.tracks.length === 2 && r.tracks[0].artUri === r.origin + '/logo.png' && r.tracks[1].artUri === 'https://ai.example/signal.jpg',
    'D1 day snapshot: every track carries its artUri', JSON.stringify(r.tracks));
}

/* ---------------- E: setMediaSessionFor (browser form) ---------------- */
{
  const r = await page.evaluate(() => {
    const out = { supported: ('mediaSession' in navigator) && typeof MediaMetadata === 'function' };
    if (!out.supported) return out;
    setMediaSessionFor({ title: 'S3 Case #24', imageUrl: 'https://art19.example/exorcist.jpg' });
    const md1 = navigator.mediaSession.metadata;
    out.withArt = md1 && md1.artwork && md1.artwork.length ? md1.artwork[0].src : null;
    setMediaSessionFor({ title: 'A prayer' });
    const md2 = navigator.mediaSession.metadata;
    out.noArt = md2 && md2.artwork && md2.artwork.length ? md2.artwork[0].src : null;
    return out;
  });
  if (r.supported) {
    ok(r.withArt === 'https://art19.example/exorcist.jpg', 'E1 media session: a descriptor with art names that art', JSON.stringify(r));
    ok(r.noArt === '/logo.png' || (r.noArt && r.noArt.endsWith('/logo.png')),
      'E2 media session: a descriptor without art names the logo pair (Chromium reads the src back absolutized)', JSON.stringify(r));
  } else {
    console.log('note - mediaSession/MediaMetadata unsupported in this Chromium; E legs read from statics S4 only');
    ok(true, 'E0 media session: unsupported in harness Chromium — covered by statics S4 (named, not a functional pass)');
  }
}

await browser.close();
server.close();
console.log(`\n# harness-v480: ${pass} passed / ${fail} failed`);
if (failures.length) { console.log('# failing:', failures.join(' · ')); process.exit(1); }
