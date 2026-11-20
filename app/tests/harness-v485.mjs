// harness-v485 — v485: Praylist row thumbnails (own episodes carry the
// Ora logo on their rows). Fix-forward for the v480/v483 artwork line.
//
// The field failure (John, 2026-11-16 23:03 CT, production after v483):
// Praylist -> Novenas rows show the block glyph tile alone; the dock
// shows the logo. Proven seat: the day-cache re-materialization
// (resolveExternals' buildWithSettings) rebuilds own metas from the
// STORED record as imageUrl: m.imageUrl || null — a record written
// before v483 carries no imageUrl field, so the meta is born null,
// ownSlotTrack forwards null, rowArtHtml falls to the glyph, and the
// cache write-back copies the null forward on every open (a cache-hit
// row never re-resolves against the live feed, so it never heals).
//
// The fixture is REAL (Improvement D): the pre-v483-shape day-cache
// own records for the presented day 2026-11-16, built from the live
// own feed read at Scope (episodeIds, titles, enclosureUrls,
// sizeBytes exactly as published; the record shape exactly as the
// pre-v483 client wrote it — no imageUrl field anywhere).
//
// Legs:
//   S  statics — ownSlotTrack's fallback names '/logo.png'; both
//      re-materialization forms default '/logo.png'; the live settle
//      meta literal stands untouched.
//   A  the field chain — the stale novenas cache record through the
//      REAL re-materialization expression -> the real ownSlotTrack ->
//      the real trackCard: every row carries the logo img.
//   B  the single-family chain — the stale Daily Rosary record
//      through the same real chain: the logo img stands.
//   C  the missing-state row — ownSlotTrack on a {state:'missing'}
//      meta: trackCard's unavailable branch carries the logo img.
//   D  neighbors unchanged — podcast art, external art, and a live
//      meta's art pass through byte-identical; isOwnLogoUrl stands.
//   E  the heal — the real write-back map over re-materialized metas
//      stores imageUrl '/logo.png' in the record.

import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';

const C_SRC = fs.readFileSync(new URL('../worker/src/client.ts', import.meta.url), 'utf8');
const U_SRC = fs.readFileSync(new URL('../worker/src/ui.ts', import.meta.url), 'utf8');

let pass = 0, fail = 0;
function ok(cond, name, detail) {
  if (cond) { pass++; console.log('ok -', name); }
  else { fail++; console.log('not ok -', name, detail ? ':: ' + String(detail).slice(0, 300) : ''); }
}

/* ---------------- the real fixture (live own feed, 2026-11-16) ---------------- */
const NOVENAS_ITEMS = [
  { episodeId: 'novena-st_rose_philippine_duchesne', title: 'Traditional Novena to St Rose Philippine Duchesne Day 8', enclosureUrl: 'https://audio.orapronobis.media/2026-11-16-st_rose_philippine_duchesne-day-8.mp3', durationSec: 0, sizeBytes: 2070741 },
  { episodeId: 'novena-st_elizabeth_of_hungary', title: 'Traditional Novena to St. Elizabeth of Hungary Day 9', enclosureUrl: 'https://audio.orapronobis.media/2026-11-16-st_elizabeth_of_hungary-day-9.mp3', durationSec: 0, sizeBytes: 3036501 },
  { episodeId: 'novena-st_cecilia', title: 'Traditional Novena to St. Cecilia Day 4', enclosureUrl: 'https://audio.orapronobis.media/2026-11-16-st_cecilia-day-4.mp3', durationSec: 0, sizeBytes: 3067557 },
  { episodeId: 'novena-st_catherine_of_alexandria', title: 'Traditional Novena to St Catherine of Alexandria Day 1', enclosureUrl: 'https://audio.orapronobis.media/2026-11-16-st_catherine_of_alexandria-day-1.mp3', durationSec: 0, sizeBytes: 3490581 },
  { episodeId: 'novena-presentation_of_the_blessed_virgin_mary', title: 'Traditional Novena to Presentation of the Blessed Virgin Mary Day 5', enclosureUrl: 'https://audio.orapronobis.media/2026-11-16-presentation_of_the_blessed_virgin_mary-day-5.mp3', durationSec: 0, sizeBytes: 1726965 },
  { episodeId: 'novena-dedication_of_the_basilicas_of_saints_peter_and_paul_apostles', title: 'Short-Form Novena to The Dedication of the Basilicas of Saints Peter and Paul, Apostles Day 8', enclosureUrl: 'https://audio.orapronobis.media/2026-11-16-dedication_of_the_basilicas_of_saints_peter_and_paul_apostles-day-8.mp3', durationSec: 0, sizeBytes: 767421 },
  { episodeId: 'novena-columban_of_luxeuil_abbot', title: 'Short-Form Novena to Saint Columban, Abbot Day 3', enclosureUrl: 'https://audio.orapronobis.media/2026-11-16-columban_of_luxeuil_abbot-day-3.mp3', durationSec: 0, sizeBytes: 794757 },
  { episodeId: 'novena-clement_i_pope', title: 'Short-Form Novena to Saint Clement I, Pope and Martyr Day 3', enclosureUrl: 'https://audio.orapronobis.media/2026-11-16-clement_i_pope-day-3.mp3', durationSec: 0, sizeBytes: 770757 },
  { episodeId: 'novena-christ_the_king', title: 'Traditional Novena to Christ the King Day 4', enclosureUrl: 'https://audio.orapronobis.media/2026-11-16-christ_the_king-day-4.mp3', durationSec: 0, sizeBytes: 2363253 },
  { episodeId: 'novena-bl_miguel_agustin_pro', title: 'Traditional Novena to Bl Miguel Agustin Pro Day 3', enclosureUrl: 'https://audio.orapronobis.media/2026-11-16-bl_miguel_agustin_pro-day-3.mp3', durationSec: 0, sizeBytes: 3656685 },
  { episodeId: 'novena-andrew_dung_lac_priest_and_companions_martyrs', title: 'Short-Form Novena to Saint Andrew Dũng-Lạc, Priest, and Companions, Martyrs Day 2', enclosureUrl: 'https://audio.orapronobis.media/2026-11-16-andrew_dung_lac_priest_and_companions_martyrs-day-2.mp3', durationSec: 0, sizeBytes: 902013 },
];
const ROSARY_REC = { episodeId: 'daily-rosary', title: "Daily Rosary - Joyful Mysteries - Today's Gospel, Luke 18:35-43", enclosureUrl: 'https://audio.orapronobis.media/daily-rosary-2026-11-16.mp3', durationSec: 0, sizeBytes: 19772589 };

/* ---------------- source expressions under test (extracted verbatim) ---------------- */
const lines = C_SRC.split('\n');
const novLine = lines.find((l) => l.includes('tracks: c.items.map(function (m)')) || '';
const singleLine = lines.find((l) => l.includes('tracks: [{ episodeId: c.episodeId')) || '';
const wbLine = lines.find((l) => l.includes('ownRec[row.sourceKey] = { items: st.tracks.map(')) || '';
const novExpr = novLine.slice(novLine.indexOf('c.items.map('), novLine.lastIndexOf('})') + 2);
const singleExpr = singleLine.slice(singleLine.indexOf('{', singleLine.indexOf('tracks: [')), singleLine.indexOf('}]') + 1);
const wbExpr = wbLine.slice(wbLine.indexOf('st.tracks.map('), wbLine.lastIndexOf('})') + 2);

/* ---------------- S: statics ---------------- */
{
  const ost = C_SRC.slice(C_SRC.indexOf('function ownSlotTrack'), C_SRC.indexOf('function ownPlaceholderCard'));
  ok(ost.includes("meta.imageUrl ? meta.imageUrl : '/logo.png'") || ost.includes(": '/logo.png'"),
    'S1 statics: ownSlotTrack defaults an own track\u2019s art to the standing logo path', ost.slice(ost.indexOf('imageUrl'), ost.indexOf('imageUrl') + 90));
  ok(novLine.includes("imageUrl: m.imageUrl || '/logo.png'"),
    'S2 statics: the novenas re-materialization defaults imageUrl to the logo', novLine.slice(0, 160));
  ok(singleLine.includes("imageUrl: c.imageUrl || '/logo.png'"),
    'S2 statics: the single re-materialization defaults imageUrl to the logo', singleLine.slice(0, 160));
  const orf = C_SRC.slice(C_SRC.indexOf('function ownResolveFeed'), C_SRC.indexOf('function ownSettlePresent'));
  const mi = orf.indexOf('var meta = {');
  const metaLit = mi >= 0 ? orf.slice(mi, orf.indexOf('};', mi) + 2) : '';
  ok(metaLit.includes("imageUrl: '/logo.png'"),
    'S3 statics: the live settle meta still names imageUrl: \'/logo.png\' (the live seat untouched)');
  ok(!!novExpr && !!singleExpr && !!wbExpr, 'S0 statics: the three expressions under test were extracted from the tree',
    JSON.stringify({ nov: !!novExpr, single: !!singleExpr, wb: !!wbExpr }));
}

/* ---------------- client extraction (v483/v412 mold) ---------------- */
function scanDecls(src) {
  const out = []; const ls = src.split('\n'); let li = 0;
  while (li < ls.length) {
    const line = ls[li];
    let m = line.match(/^function ([A-Za-z_$][\w$]*)\s*\(/);
    if (m) { out.push({ kind: 'fn', name: m[1], startLine: li }); li++; continue; }
    m = line.match(/^var ([A-Za-z_$][\w$]*)\s*=/);
    if (m) { out.push({ kind: 'var', name: m[1], startLine: li }); li++; continue; }
    li++;
  }
  return { out, lines: ls };
}
function countBraces(s) { let n = 0; for (const ch of s) { if (ch === '{') n++; else if (ch === '}') n--; } return n; }
function unit(ls, startLine, kind) {
  if (kind === 'var') {
    let depth = 0, started = false; const buf = [];
    for (let i = startLine; i < ls.length; i++) {
      buf.push(ls[i]);
      for (const ch of ls[i]) { if (ch === '{' || ch === '[' || ch === '(') { depth++; started = true; } else if (ch === '}' || ch === ']' || ch === ')') depth--; }
      if (started && depth <= 0 && /;\s*$/.test(ls[i])) break;
      if (!started && /;\s*$/.test(ls[i])) break;
    }
    return buf.join('\n');
  }
  let depth = 0, opened = false; const buf = [];
  for (let i = startLine; i < ls.length; i++) {
    buf.push(ls[i]); depth += countBraces(ls[i]); if (ls[i].includes('{')) opened = true;
    if (opened && depth <= 0) break;
  }
  return buf.join('\n');
}
const EXCLUDE = new Set(['refreshPlayedChrome', 'extFetchText']);
const { out: decls, lines: dlines } = scanDecls(C_SRC);
const pieces = [], dropped = [];
for (const d of decls) {
  if (d.name === 'state') continue;
  if (EXCLUDE.has(d.name)) continue;
  const u = unit(dlines, d.startLine, d.kind);
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

const LOGO_IMG = '<img class="rowart" src="/logo.png"';

/* ---------------- A: the field chain (stale novenas cache record) ---------------- */
{
  const r = await page.evaluate(({ expr, items }) => {
    try {
      const c = { items };
      const metas = eval('(' + 'c.' + expr.slice(expr.indexOf('items.map(')) + ')');
      const row = { episodeId: 'novenas', block: 'Novenas', sourceKey: 'novenas' };
      const tracks = metas.map((m) => ownSlotTrack(row, m, '2026-11-16'));
      const cards = tracks.map((t) => trackCard(t));
      return { n: tracks.length, imgs: tracks.map((t) => t.imageUrl),
        withImg: cards.filter((h) => h.includes('<img class="rowart" src="/logo.png"')).length,
        glyphOnly: cards.filter((h) => !h.includes('<img class="rowart"')).length,
        sample: cards[4] ? cards[4].slice(0, 220) : '' };
    } catch (e) { return { err: String(e) }; }
  }, { expr: novExpr, items: NOVENAS_ITEMS });
  ok(!r.err, 'A0 field chain: the stale-cache chain runs', r.err);
  ok(r.n === 11, 'A1 field chain: all 11 real novena items re-materialize', 'n=' + r.n);
  ok(Array.isArray(r.imgs) && r.imgs.every((x) => x === '/logo.png'),
    'A2 field chain: every re-materialized own track carries imageUrl \'/logo.png\'', JSON.stringify(r.imgs));
  ok(r.withImg === 11 && r.glyphOnly === 0,
    'A3 field chain: every Novenas row paints the logo img (none glyph-only)', JSON.stringify({ withImg: r.withImg, glyphOnly: r.glyphOnly, sample: r.sample }));
}

/* ---------------- B: the single-family chain (stale Daily Rosary record) ---------------- */
{
  const r = await page.evaluate(({ expr, rec }) => {
    try {
      const c = rec;
      const meta = eval('(' + expr + ')');
      const row = { episodeId: 'daily-rosary', block: 'Midday', sourceKey: 'daily-rosary' };
      const track = ownSlotTrack(row, meta, '2026-11-16');
      const card = trackCard(track);
      return { img: track.imageUrl, has: card.includes('<img class="rowart" src="/logo.png"'), sample: card.slice(0, 200) };
    } catch (e) { return { err: String(e) }; }
  }, { expr: singleExpr, rec: ROSARY_REC });
  ok(!r.err, 'B0 single chain: runs', r.err);
  ok(r.img === '/logo.png' && r.has === true,
    'B1 single chain: the Daily Rosary row carries the logo img', JSON.stringify(r).slice(0, 260));
}

/* ---------------- C: the missing-state row ---------------- */
{
  const r = await page.evaluate(() => {
    try {
      const row = { episodeId: 'morning-prayer', block: 'Morning', sourceKey: 'morning-prayer' };
      const track = ownSlotTrack(row, { episodeId: 'morning-prayer', title: 'Morning Prayer', state: 'missing' }, '2026-11-16');
      const card = trackCard(track);
      return { img: track.imageUrl, has: card.includes('<img class="rowart" src="/logo.png"'), unavail: !card.includes('data-playkey'), sample: card.slice(0, 200) };
    } catch (e) { return { err: String(e) }; }
  });
  ok(!r.err, 'C0 missing chain: runs', r.err);
  ok(r.img === '/logo.png' && r.has === true && r.unavail === true,
    'C1 missing chain: an unavailable own row carries the logo img', JSON.stringify(r).slice(0, 260));
}

/* ---------------- D: neighbors unchanged ---------------- */
{
  const r = await page.evaluate(() => {
    try {
      const pod = { episodeId: 'pod-x', title: 'A Podcast Episode', kind: 'podcast', _block: 'Formation', available: true, imageUrl: 'https://cdn.example.com/ep-art.jpg', streamUrl: 'https://cdn.example.com/ep.mp3', durationSec: 600 };
      const podCard = trackCard(pod);
      const slot = { id: 's1', block: 'Midday', title: 'External Show', provider: 'x' };
      const ext = extSlotTrack(slot, { state: 'present', title: 'External Ep', enclosureUrl: 'https://ext.example.com/e.mp3', imageUrl: 'https://ext.example.com/art.jpg', durationS: 300 });
      const extCard = trackCard(ext);
      const row = { episodeId: 'morning-prayer', block: 'Morning', sourceKey: 'morning-prayer' };
      const live = ownSlotTrack(row, { episodeId: 'morning-prayer', title: 'Morning Prayer', state: 'present', enclosureUrl: 'https://audio.orapronobis.media/m.mp3', streamUrl: null, durationS: 300, sizeBytes: 123, imageUrl: '/logo.png' }, '2026-11-16');
      return { podHas: podCard.includes('src="https://cdn.example.com/ep-art.jpg"'), podLogo: podCard.includes('src="/logo.png"'),
        extImg: ext.imageUrl, extHas: extCard.includes('src="https://ext.example.com/art.jpg"'),
        liveImg: live.imageUrl, ownLogo: isOwnLogoUrl('/logo.png') };
    } catch (e) { return { err: String(e) }; }
  });
  ok(!r.err, 'D0 neighbors: runs', r.err);
  ok(r.podHas === true && r.podLogo === false, 'D1 neighbors: a podcast row keeps its own art', JSON.stringify(r).slice(0, 200));
  ok(r.extImg === 'https://ext.example.com/art.jpg' && r.extHas === true, 'D2 neighbors: an external row keeps its provider art', JSON.stringify(r).slice(0, 200));
  ok(r.liveImg === '/logo.png', 'D3 neighbors: a live meta\u2019s art passes through unchanged', JSON.stringify(r.liveImg));
  ok(r.ownLogo === true, 'D4 neighbors: isOwnLogoUrl(\'/logo.png\') stands true');
}

/* ---------------- E: the heal (write-back stores the logo) ---------------- */
{
  const r = await page.evaluate(({ expr, novExpr2, items }) => {
    try {
      const c = { items };
      const remat = eval('(' + 'c.' + novExpr2.slice(novExpr2.indexOf('items.map(')) + ')');
      const row = { episodeId: 'novenas', block: 'Novenas', sourceKey: 'novenas' };
      const st = { tracks: remat.map((m) => ownSlotTrack(row, m, '2026-11-16')) };
      const stored = eval('(' + expr + ')');
      return { n: stored.length, all: stored.every((x) => x.imageUrl === '/logo.png'), sample: stored[0] };
    } catch (e) { return { err: String(e) }; }
  }, { expr: wbExpr, novExpr2: novExpr, items: NOVENAS_ITEMS });
  ok(!r.err, 'E0 heal: runs', r.err);
  ok(r.n === 11 && r.all === true,
    'E1 heal: the write-back stores imageUrl \'/logo.png\' for every novena item (the record heals on the same open)', JSON.stringify(r.sample));
}

await browser.close();
server.close();
console.log(`\n${pass} ok / ${fail} not-ok`);
process.exit(fail ? 1 : 0);
