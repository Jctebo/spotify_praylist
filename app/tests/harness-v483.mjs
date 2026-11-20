// harness-v483.mjs — v483 own prayers' artwork evidence (mold: harness-v480).
//   The defect: v480's path stamps the art the descriptor names, but
//   an own prayer's descriptor names none — the art is dropped at
//   the day build's own-track seats. This harness exercises the
//   REAL producer chain (the lesson of v480's B1, which hand-fed a
//   descriptor with imageUrl already set and so could not fail):
//   S1–S4  statics: the settle meta literal names '/logo.png' ·
//       ownSlotTrack forwards meta.imageUrl · offlineTomorrowOwn's
//       matches + out items carry imageUrl · the offline snapshot
//       map's own arm gains artUri while the ai/ext arms gain none
//   A  the live chain, functionally: the settle meta literal is
//       evaluated as written and run through ownSlotTrack →
//       trackDesc → artUriFor → oraSnapshotTrack /
//       nativeContractItem — every leg must carry the logo
//   B  the offline chain, functionally: offlineTomorrowOwn runs
//       against a canned own feed — its own item carries
//       imageUrl '/logo.png' and artUriFor names it on the origin
//   C  neighbors unchanged: a podcast episode keeps its own art ·
//       a day external keeps its own art · isOwnLogoUrl('/logo.png')
//       stands true (the no-in-app-paint-change premise)
// Run: node app/tests/harness-v483.mjs   (from the worktree root)
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
  const orf = C_SRC.slice(C_SRC.indexOf('function ownResolveFeed'), C_SRC.indexOf('function ownSettlePresent'));
  const mi = orf.indexOf('var meta = {');
  const metaLit = mi >= 0 ? orf.slice(mi, orf.indexOf('};', mi) + 2) : '';
  ok(metaLit.includes("imageUrl: '/logo.png'"),
    'S1 statics: the own settle meta names the standing own-content logo — imageUrl: \'/logo.png\'', metaLit.slice(0, 200));
  const ost = C_SRC.slice(C_SRC.indexOf('function ownSlotTrack'), C_SRC.indexOf('function ownPlaceholderCard'));
  ok(ost.includes('meta.imageUrl'),
    'S2 statics: ownSlotTrack forwards the meta\u2019s imageUrl onto the track record (the adapter seat)');
  const oto = C_SRC.slice(C_SRC.indexOf('function offlineTomorrowOwn'), C_SRC.indexOf('function offlineTomorrowBuild'));
  ok(oto.includes("imageUrl: '/logo.png'"),
    'S3 statics: offlineTomorrowOwn\u2019s matches carry imageUrl: \'/logo.png\'');
  const pushLine = oto.split('\n').find((l) => l.includes("out.push({ kind: 'own'")) || '';
  ok(pushLine.includes('imageUrl: m.imageUrl'),
    'S3 statics: offlineTomorrowOwn\u2019s pushed own items carry the match\u2019s imageUrl', pushLine.slice(0, 120));
  const wc = C_SRC.slice(C_SRC.indexOf('var ownRec = {};'), C_SRC.indexOf('rec.own = ownRec;'));
  ok((wc.match(/imageUrl: m0?\.imageUrl \|\| null/g) || []).length >= 2,
    'S5 statics: the day cache\u2019s own records (novenas items + single) carry the track\u2019s imageUrl');
  const rb = C_SRC.slice(C_SRC.indexOf('var ownCache = '), C_SRC.indexOf('var intP = ownBuildIntentions'));
  ok(rb.includes('imageUrl: m.imageUrl || null') && rb.includes('imageUrl: c.imageUrl || null'),
    'S5 statics: the cache read-back re-materializes own metas with their imageUrl (novenas map + single)');
  const eo = C_SRC.slice(C_SRC.indexOf("if (epId === 'novenas')", C_SRC.indexOf('function offlineTomorrowOwn')), C_SRC.indexOf('matches.forEach(function (m) { out.push'));
  ok((eo.match(/imageUrl: m0?\.imageUrl \|\| null/g) || []).length >= 2,
    'S5 statics: offlineTomorrowOwn\u2019s stored own records (novenas items + single) carry the match\u2019s imageUrl');
  const map = C_SRC.slice(C_SRC.indexOf('var tracks = items.map'), C_SRC.indexOf('var snap = { presentedDay: tomorrow'));
  const ownArm = map.split('\n').find((l) => l.includes("it.kind === 'own'")) || '';
  const aiArm = map.split('\n').find((l) => l.includes("it.kind === 'ai'")) || '';
  const extArm = map.split('\n').find((l) => l.includes("kind: 'external'")) || '';
  ok(ownArm.includes('artUri: artUriFor(it)'),
    'S4 statics: the offline snapshot map\u2019s own arm names artUri from the item', ownArm.slice(0, 120));
  ok(!aiArm.includes('artUri') && !extArm.includes('artUri'),
    'S4 statics: the snapshot map\u2019s ai and ext arms still carry no artUri (the v480 bound stands)');
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

/* ---------------- A: the live own chain, from the producer literal ---------------- */
{
  const orf = C_SRC.slice(C_SRC.indexOf('function ownResolveFeed'), C_SRC.indexOf('function ownSettlePresent'));
  const mi = orf.indexOf('var meta = {');
  const metaLit = orf.slice(mi + 'var meta = '.length, orf.indexOf('};', mi) + 1);
  const r = await page.evaluate((lit) => {
    const fam = { episodeId: 'morning-prayer' };
    const it = { title: 'Morning Prayer - November 17, 2026', url: 'https://audio.orapronobis.media/morning-prayer-elevenlabs-2026-11-17.mp3', durationS: 305, length: 4567890 };
    const meta = eval('(' + lit + ')');
    const row = { episodeId: 'morning-prayer', block: 'Morning', sourceKey: 'morning-prayer' };
    const track = ownSlotTrack(row, meta, '2026-11-17');
    const desc = trackDesc(track, null);
    const snap = oraSnapshotTrack(desc, '2026-11-17');
    const contract = nativeContractItem(desc);
    return { meta, trackImg: track.imageUrl, descImg: desc.imageUrl, art: artUriFor(desc),
      snapArt: snap ? snap.artUri : null, contractArt: contract ? contract.artUri : null, origin: location.origin };
  }, metaLit);
  ok(r.meta && r.meta.imageUrl === '/logo.png', 'A1 live chain: the settle meta, as written in the tree, names imageUrl \'/logo.png\'', JSON.stringify(r.meta));
  ok(r.trackImg === '/logo.png', 'A2 live chain: ownSlotTrack carries the logo onto the track record', JSON.stringify(r.trackImg));
  ok(r.descImg === '/logo.png', 'A3 live chain: the descriptor carries the logo', JSON.stringify(r.descImg));
  ok(r.art === r.origin + '/logo.png', 'A4 live chain: artUriFor names the logo on the origin', JSON.stringify(r.art));
  ok(r.snapArt === r.origin + '/logo.png', 'A5 live chain: oraSnapshotTrack\u2019s own arm carries the logo artUri', JSON.stringify(r.snapArt));
  ok(r.contractArt === r.origin + '/logo.png', 'A6 live chain: the contract day arm carries the logo artUri', JSON.stringify(r.contractArt));
}

/* ---------------- B: the offline-tomorrow own chain ---------------- */
{
  const FEED = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>'
    + '<title>Ora Pro Nobis</title>'
    + '<item><title>Morning Prayer - November 18, 2026</title>'
    + '<enclosure url="https://audio.orapronobis.media/morning-prayer-elevenlabs-2026-11-18.mp3" length="4567890" type="audio/mpeg"/>'
    + '<pubDate>Wed, 18 Nov 2026 00:00:00 -0600</pubDate><itunes:duration>305</itunes:duration></item>'
    + '</channel></rss>';
  const r = await page.evaluate(async (feedXml) => {
    extFetchText = function (url) { return Promise.resolve(feedXml); };
    const settings = { sources: [{ family: 'own', sourceKey: 'morning-prayer', enabled: 1, block: 'Morning' }] };
    const extRec = { own: {}, slots: {} };
    const items = await offlineTomorrowOwn(settings, '2026-11-18', extRec);
    const own = items.filter((x) => x.kind === 'own');
    return { n: own.length, item: own[0] || null, art: own[0] ? artUriFor(own[0]) : null, origin: location.origin };
  }, FEED);
  ok(r.n === 1, 'B1 offline chain: offlineTomorrowOwn resolves the canned own item', JSON.stringify(r.n));
  ok(r.item && r.item.imageUrl === '/logo.png', 'B2 offline chain: the own item carries imageUrl \'/logo.png\'', JSON.stringify(r.item));
  ok(r.art === r.origin + '/logo.png', 'B3 offline chain: artUriFor names the item\u2019s logo on the origin — the snapshot map arm\u2019s input', JSON.stringify(r.art));
}

/* ---------------- D: the cache round trip ---------------- */
{
  // The read-back single-track meta literal, as written in the
  // tree, evaluated against a cache record of the NEW written
  // shape (carrying imageUrl) — the whole leg must carry the logo
  // through ownSlotTrack -> trackDesc -> artUriFor. A cache record
  // of the OLD shape (no imageUrl) reads as today's behavior:
  // no art named, nothing stamped — the self-healing bound.
  const rbStart = C_SRC.indexOf("tracks: [{ episodeId: c.episodeId");
  const rbLit = C_SRC.slice(rbStart + 'tracks: ['.length, C_SRC.indexOf('}] };', rbStart) + 1);
  const r = await page.evaluate((lit) => {
    const row = { episodeId: 'morning-prayer', block: 'Morning', sourceKey: 'morning-prayer' };
    const build = function (c) { return eval('(' + lit + ')'); };
    const metaNew = build({ episodeId: 'morning-prayer', title: 'Morning Prayer', enclosureUrl: 'https://audio.orapronobis.media/morning-prayer-elevenlabs-2026-11-17.mp3', durationSec: 305, sizeBytes: 4567890, imageUrl: '/logo.png' });
    const descNew = trackDesc(ownSlotTrack(row, metaNew, '2026-11-17'), null);
    const metaOld = build({ episodeId: 'morning-prayer', title: 'Morning Prayer', enclosureUrl: 'https://audio.orapronobis.media/morning-prayer-elevenlabs-2026-11-17.mp3', durationSec: 305, sizeBytes: 4567890 });
    const descOld = trackDesc(ownSlotTrack(row, metaOld, '2026-11-17'), null);
    return { newImg: metaNew.imageUrl, newArt: artUriFor(descNew), oldImg: metaOld.imageUrl || null, oldArt: artUriFor(descOld), origin: location.origin };
  }, rbLit);
  ok(r.newImg === '/logo.png', 'D1 cache trip: the read-back meta, as written in the tree, carries the cached imageUrl', JSON.stringify(r.newImg));
  ok(r.newArt === r.origin + '/logo.png', 'D2 cache trip: a cache-stood own prayer names the logo artUri end to end', JSON.stringify(r.newArt));
  ok(r.oldImg === null && r.oldArt === '', 'D3 cache trip: a pre-fix cache record (no imageUrl) reads as no art — self-heals at its first re-write, never a wrong stamp', JSON.stringify(r.oldArt));
}

/* ---------------- C: neighbors unchanged ---------------- */
{
  const r = await page.evaluate(() => {
    const out = {};
    out.feed = nativeContractItem({ kind: 'podcast', episodeId: 'gid://art19-ep/1', url: 'https://rss.art19.com/ep.mp3', imageUrl: 'https://art19.example/exorcist.jpg', title: 'S3 Case #24', seriesKey: 'gid://art19-ep/1', podSeries: 'exorcist-files', durationS: 3420, block: 'Podcasts' });
    state.extSlots = { 'ext-biy': { enclosureUrl: 'https://cdn.example/biy-day318.mp3', streamUrl: 'https://cdn.example/biy-day318.mp3' } };
    state.extStanding = [{ slotId: 'ext-biy', download: 'keep' }];
    out.ext = oraSnapshotTrack({ episodeId: 'ext-biy', imageUrl: 'https://cdn.example/biy-cover.jpg', block: 'Midmorning', title: 'Bible in a Year', durationS: 1500 }, '2026-11-16');
    state.extSlots = {}; state.extStanding = [];
    out.ownLogo = isOwnLogoUrl('/logo.png');
    return out;
  });
  ok(r.feed && r.feed.artUri === 'https://art19.example/exorcist.jpg', 'C1 neighbors: a podcast episode still carries its own show art', JSON.stringify(r.feed));
  ok(r.ext && r.ext.artUri === 'https://cdn.example/biy-cover.jpg', 'C2 neighbors: a day external still carries its own art', JSON.stringify(r.ext));
  ok(r.ownLogo === true, 'C3 premise: isOwnLogoUrl(\'/logo.png\') stands true — naming it as the own imageUrl changes no in-app paint');
}

await browser.close();
server.close();
console.log(`\n# harness-v483: ${pass} passed / ${fail} failed`);
if (failures.length) { console.log('# failing:', failures.join(' · ')); process.exit(1); }
