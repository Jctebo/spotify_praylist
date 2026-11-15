// harness-v435 — Now Playing: wrong big thumbnail (§1/§2 of
// the v435 release document; John's report 2026-11-15 00:16 CT,
// "Wrong big thumbnail"). Client-only delta: client.ts (the
// hero driven from the playing descriptor in updateNowPlaying)
// + ui.ts (the .np-art hero rules). Legs run in headless
// Chromium on the v388/v417 extraction mold (real SHELL_HTML +
// APP_CSS, fixture state), 412px. Legs map to §2.6/§2.8:
//   S1/S2 statics · H1–H11 behavior · I1 box parity ·
//   I3 the key guard · I5 the show-art chain (the real
//   podDesc) · I6 external tracks.
// F-435-1 AS RULED (John, main chat, 2026-11-15 00:39 CT:
// "Use the ora pro Nobis logo for things that come from this
// podcast"): own-podcast tracks carry the LOGO as their big
// thumbnail — the glyph-tile no-art branch does NOT build.
// The Plan's tile-expecting legs are adjusted to logo
// expectations BY NAME: H1, H2, H8 (named in the seating
// brief) and, by the same ruling, the no-art ends of H4/H5,
// H11, and F-435-I6's no-art half. H3, H6, H7, H9, H10 stand
// as planned (H7's tile is the real-art branch's underlay,
// which the ruling does not touch). The logo URL strings in
// H1/H2 are copied from the live feed read at this seat
// (orapronobis.media/podcast.xml, 2,184,217 bytes: the logo
// file stands 85 times — 83 lowercase host, 2 capital host —
// and no other image stands anywhere in the feed).
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

/* ---------------- S: statics ---------------- */
{
  const onp = seg(C_SRC, 'function openNowPlaying', 'function updateNowPlaying');
  ok(onp.includes('\'<div class="np-art" id="np-art"></div>\'') && !onp.includes('/logo.png'),
    'S1: openNowPlaying builds .np-art empty (id=np-art) and fills it through the one resolver — no unconditional logo img stands');
  const unp = seg(C_SRC, 'function updateNowPlaying', 'function updateNpSeek');
  ok(unp.indexOf('npArtRender(sheet, cur)') > unp.indexOf('np-preview') && unp.indexOf('np-preview') > -1,
    'S2: updateNowPlaying carries the art drive (npArtRender) after the .np-preview early return — the queue-preview sheet gains no hero');
  ok(C_SRC.includes("  if (dt) { var dts = cur.imageUrl || '/logo.png'; if (dt.getAttribute('src') !== dts) dt.setAttribute('src', dts); }"),
    'S2: the dock thumb line stands byte-unchanged (the fix is sheet-local)');
  ok(U_SRC.includes('ora-pro-nobis-v436-1') && !U_SRC.includes('ora-pro-nobis-v435-1') && !I_SRC.includes('npArtRender') && !I_SRC.includes('np-art'),
    'S3 (housekeeping): the SW pin stands at ora-pro-nobis-v436-1 (Ship moves it); no index.ts delta (client-only)');
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
  storedDay: '2026-11-15', presentedDay: '2026-11-15', dateLabel: 'Sunday, November 15', liturgical: null,
  pendingResume: null, sleep: { mode: 'off' }, readTracks: {}, dayDescs: [], dayPayload: null, playedCache: {},
  repeatIds: {}, previewQueue: null, queuePreviewIdx: -1, restoredQueue: false, restoreProbe: null, podRestoreProbe: null,
  prayersView: { kind: 'home' }, searchQuery: '', podcasts: null, podcastsIndex: null, podcastsReturn: null,
  rate: 1, errWaitKey: null, errWaitN: 0, startRetryKey: null, lastStartAt: 0,
  ownStanding: [], extStanding: [], extSlots: {}, ownSlots: {}, daySegments: {}, homeFilter: '', gridDl: {}, aiClaimed: false };
</` + `script>`;
const PAGE = PAGE_HEAD.replace('CSSHERE', () => APP_CSS).replace('SHELLHERE', () => SHELL)
  + '<script>\n' + pieces.join('\n') + '\n</' + 'script>';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const server = http.createServer((req, res) => {
  const p = (req.url || '/').split('?')[0];
  if (p === '/art-ep.png' || p === '/art-show.png' || p === '/art-ext.png' || p === '/logo.png') {
    res.setHeader('Content-Type', 'image/png'); res.end(PNG); return;
  }
  if (p === '/') { res.setHeader('Content-Type', 'text/html'); res.end(PAGE); return; }
  res.statusCode = 404; res.end('not found');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const ORIGIN = 'http://127.0.0.1:' + PORT;
const ART_EP = ORIGIN + '/art-ep.png';
const ART_SHOW = ORIGIN + '/art-show.png';
const ART_EXT = ORIGIN + '/art-ext.png';
const ART_BROKEN = ORIGIN + '/art-broken.png'; // the server 404s it

const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
page.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 200)));
await page.goto(ORIGIN + '/');
const ev = (fn, arg) => page.evaluate(fn, arg);

/* ---------------- fixture descriptors ---------------- */
await ev(({ ART_EXT }) => {
  window.__d = {
    // The Invitatory, as the own feed builds it: per-item
    // itunes:image else the channel image — the logo file,
    // under BOTH host casings standing in the live feed.
    ownLow: { episodeId: 'm1', kind: 'episode', title: 'Invitatory', block: 'Morning', url: '/api/player/feed-audio?m1', available: true, durationS: 300, imageUrl: 'https://jctebo.github.io/spotify_praylist/images/logo_ora_pro_nobis.png' },
    ownCap: { episodeId: 'm1', kind: 'episode', title: 'Invitatory', block: 'Morning', url: '/api/player/feed-audio?m1', available: true, durationS: 300, imageUrl: 'https://Jctebo.github.io/spotify_praylist/images/logo_ora_pro_nobis.png' },
    // The AI Signal's standing descriptor shape: no imageUrl
    // field stands on it at all (index.ts's store descriptor).
    ai: { episodeId: 'the-ai-signal', kind: 'episode', title: 'The AI Signal — Daily', block: 'The AI Signal', url: '/api/player/feed-audio?ai1', available: true, durationS: 900 },
    // No block, no art: the final-fallback shape.
    bare: { episodeId: 'x1', title: 'Unknown', url: 'https://x/x.mp3', available: true, durationS: 60 },
    // External tracks (the trackCard seam's descriptor shape).
    extArt: { episodeId: 'ext-daily-tv-mass', title: 'Daily TV Mass', block: 'Mass and Homilies', source: 'Daily TV Mass', url: 'https://x/mass.mp3', available: true, durationS: 1800, imageUrl: null },
    extNone: { episodeId: 'ext-daily-tv-mass', title: 'Daily TV Mass', block: 'Mass and Homilies', source: 'Daily TV Mass', url: 'https://x/mass.mp3', available: true, durationS: 1800, imageUrl: null }
  };
  window.__d.extArt.imageUrl = ART_EXT;
  window.__setCur = function (d) {
    state.current = d;
    state.queue = d ? [d] : [];
    state.queueIdx = d ? 0 : -1;
    state.readTracks = {};
  };
  window.__hero = function () {
    var a = document.querySelector('#np-art');
    if (!a) return null;
    var img = a.querySelector('img.np-art-img');
    var tile = a.querySelector('.blockcover.hero');
    return {
      key: a.getAttribute('data-artkey'),
      imgSrc: img ? img.getAttribute('src') : null,
      imgAlt: img ? img.getAttribute('alt') : null,
      tile: !!tile,
      tileGlyph: tile ? tile.textContent : null,
      html: a.innerHTML
    };
  };
}, { ART_EXT });

ok(await ev(() => typeof openNowPlaying === 'function' && typeof npArtRender === 'function' && typeof realArtUrl === 'function' && typeof podDesc === 'function'),
  'boot: the extracted client stands (openNowPlaying · npArtRender · realArtUrl · podDesc)');

/* ---------------- H1/H2: own tracks land on the logo (the ruling) ---------------- */
{
  const h1 = await ev(() => { __setCur(__d.ownLow); openNowPlaying(); return __hero(); });
  ok(h1 && h1.imgSrc === '/logo.png' && h1.imgAlt === 'Ora Pro Nobis logo' && !h1.tile && h1.key === 'logo',
    'H1 (adjusted — the ruling): open on the Invitatory (own, lowercase-casing logo URL) → the hero is the logo img, no tile stands', JSON.stringify(h1));
  const h2 = await ev(() => { __setCur(__d.ownCap); openNowPlaying(); return __hero(); });
  ok(h2 && h2.imgSrc === '/logo.png' && !h2.tile && h2.key === 'logo',
    'H2 (adjusted — the ruling): the same under the capital-casing logo URL → the logo, not art (F-435-2, both casings)', JSON.stringify(h2));
}

/* ---------------- H3 + I5: Podcasts art, episode then show ---------------- */
{
  const h3 = await ev(({ ART_EP, ART_SHOW }) => {
    state.podcasts = { series: 'bible', showImageUrl: ART_SHOW };
    var d = podDesc({ key: 'e1', label: 'Day 316', title: 'Episode One', url: 'https://x/e1.mp3', durationS: 600, listened: false, positionS: 0, imageUrl: ART_EP, descText: null });
    __setCur(d);
    openNowPlaying();
    var h = __hero();
    h.descImg = d.imageUrl;
    return h;
  }, { ART_EP, ART_SHOW });
  ok(h3 && h3.descImg === ART_EP && h3.imgSrc === ART_EP && h3.tile && h3.key === 'img:' + ART_EP,
    'H3: open on a Podcasts episode carrying real art → the hero img is the episode art, standing over the tile', JSON.stringify(h3));
  await page.waitForFunction(() => { var i = document.querySelector('#np-art img.np-art-img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 4000 }).catch(() => {});
  const loaded = await ev(() => { var i = document.querySelector('#np-art img.np-art-img'); return i ? { complete: i.complete, nw: i.naturalWidth } : null; });
  ok(loaded && loaded.complete && loaded.nw > 0, 'H3: the hero art img actually loads (no broken-image state)', JSON.stringify(loaded));
  await page.screenshot({ path: path.join(APP, 'tests/harness-v435-np-art.png') });

  const i5 = await ev(({ ART_SHOW }) => {
    state.podcasts = { series: 'bible', showImageUrl: ART_SHOW };
    var d = podDesc({ key: 'e2', label: 'Day 317', title: 'Episode Two', url: 'https://x/e2.mp3', durationS: 600, listened: false, positionS: 0, imageUrl: null, descText: null });
    __setCur(d);
    openNowPlaying();
    var h = __hero();
    h.descImg = d.imageUrl;
    return h;
  }, { ART_SHOW });
  ok(i5 && i5.descImg === ART_SHOW && i5.imgSrc === ART_SHOW,
    'F-435-I5: an episode with no art of its own takes the show art through the real podDesc chain (episode → show), and the hero shows it', JSON.stringify(i5));
}

/* ---------------- H4/H5: the mid-queue swap, sheet standing open ---------------- */
{
  const swap = await ev(({ ART_EP, ART_SHOW }) => {
    __setCur(__d.ownLow);
    openNowPlaying();
    var sheetEl = document.querySelector('.np-sheet');
    var before = __hero();
    state.podcasts = { series: 'bible', showImageUrl: ART_SHOW };
    var d = podDesc({ key: 'e1', label: 'Day 316', title: 'Episode One', url: 'https://x/e1.mp3', durationS: 600, listened: false, positionS: 0, imageUrl: ART_EP, descText: null });
    state.current = d; state.queue = [__d.ownLow, d]; state.queueIdx = 1;
    updateNowPlaying(); // the sync every advance path converges on (updateDock → updateNowPlaying)
    var mid = __hero();
    state.current = __d.ownLow; state.queueIdx = 0;
    updateNowPlaying();
    var back = __hero();
    return { sameSheet: document.querySelector('.np-sheet') === sheetEl, before, mid, back };
  }, { ART_EP, ART_SHOW });
  ok(swap.before.imgSrc === '/logo.png' && swap.mid.imgSrc === ART_EP && swap.sameSheet,
    'H4: sheet open on an own track → advance to a Podcasts episode → the hero swaps logo → episode art without the sheet reopening', JSON.stringify(swap.mid));
  ok(swap.back.imgSrc === '/logo.png' && !swap.back.tile && swap.back.key === 'logo',
    'H5 (adjusted — the ruling): back to the own track → the hero swaps art → logo; no stale art img stands', JSON.stringify(swap.back));
}

/* ---------------- H6: Play All across a mixed queue ---------------- */
{
  const h6 = await ev(({ ART_EP, ART_SHOW, ART_EXT }) => {
    state.podcasts = { series: 'bible', showImageUrl: ART_SHOW };
    var pod = podDesc({ key: 'e1', label: 'Day 316', title: 'Episode One', url: 'https://x/e1.mp3', durationS: 600, listened: false, positionS: 0, imageUrl: ART_EP, descText: null });
    var seq = [__d.ownLow, pod, __d.extArt];
    __setCur(seq[0]); state.queue = seq; state.queueIdx = 0;
    openNowPlaying();
    var seen = [__hero().imgSrc];
    for (var i = 1; i < seq.length; i++) { state.current = seq[i]; state.queueIdx = i; updateNowPlaying(); seen.push(__hero().imgSrc); }
    return seen;
  }, { ART_EP, ART_SHOW, ART_EXT });
  ok(h6[0] === '/logo.png' && h6[1] === ART_EP && h6[2] === ART_EXT,
    'H6: Play All across a mixed queue (own → Podcasts → external) → the hero follows each advance', h6.join(' | '));
}

/* ---------------- H7: broken art falls to the tile ---------------- */
{
  const h7 = await ev(({ ART_SHOW, ART_BROKEN }) => {
    state.podcasts = { series: 'bible', showImageUrl: ART_SHOW };
    var d = podDesc({ key: 'e9', label: 'Day 1', title: 'Broken Art', url: 'https://x/e9.mp3', durationS: 600, listened: false, positionS: 0, imageUrl: ART_BROKEN, descText: null });
    __setCur(d);
    openNowPlaying();
    return __hero();
  }, { ART_SHOW, ART_BROKEN });
  ok(h7 && h7.imgSrc === ART_BROKEN && h7.tile, 'H7 (setup): the broken-art hero starts as the art img over the tile', JSON.stringify(h7));
  await page.waitForFunction(() => !document.querySelector('#np-art img.np-art-img'), null, { timeout: 5000 }).catch(() => {});
  const h7b = await ev(() => __hero());
  ok(h7b && !h7b.imgSrc && h7b.tile,
    'H7: the art URL fails to load → the img removes itself; the glyph tile beneath stands; no broken-image glyph', JSON.stringify(h7b));
}

/* ---------------- H8/H9: the AI Signal + the final fallback (the ruling) ---------------- */
{
  const h8 = await ev(() => { __setCur(__d.ai); openNowPlaying(); return __hero(); });
  ok(h8 && h8.imgSrc === '/logo.png' && !h8.tile && h8.key === 'logo',
    'H8 (adjusted — the ruling): The AI Signal (no imageUrl stands on its descriptor) → the hero is the logo', JSON.stringify(h8));
  const h9 = await ev(() => { __setCur(__d.bare); openNowPlaying(); return __hero(); });
  ok(h9 && h9.imgSrc === '/logo.png' && h9.key === 'logo',
    'H9: a descriptor with no block and no art → the logo img stands, and only there', JSON.stringify(h9));
}

/* ---------------- H10: the dock is untouched ---------------- */
{
  const h10 = await ev(() => {
    __setCur(__d.ownLow);
    updateDock();
    var dt = document.getElementById('dock-thumb');
    return { src: dt ? dt.getAttribute('src') : null, dockShown: !document.getElementById('dock').classList.contains('hidden') };
  });
  ok(h10.src === 'https://jctebo.github.io/spotify_praylist/images/logo_ora_pro_nobis.png' && h10.dockShown,
    'H10: for an own track the dock thumb still resolves cur.imageUrl exactly as today (the full logo URL) — the fix is sheet-local', JSON.stringify(h10));
}

/* ---------------- H11: the offline-swapped own track ---------------- */
{
  const h11 = await ev(() => {
    // The v392/v430 swap changes the playing SOURCE (the
    // element takes the offline copy); the descriptor — and
    // its imageUrl — stands unchanged. Modelled exactly so:
    // the same own descriptor, its url the offline copy's.
    var d = Object.assign({}, __d.ownLow, { url: 'blob:fake' });
    __setCur(d);
    openNowPlaying();
    return __hero();
  });
  ok(h11 && h11.imgSrc === '/logo.png' && h11.key === 'logo',
    'H11 (adjusted — the ruling): an own track playing from its offline copy → the hero follows the descriptor: the logo', JSON.stringify(h11));
}

/* ---------------- F-435-I6: external tracks ---------------- */
{
  const i6a = await ev(() => { __setCur(__d.extArt); openNowPlaying(); return __hero(); });
  ok(i6a && i6a.imgSrc === ART_EXT && i6a.tile,
    'F-435-I6: an external track with real art (Daily TV Mass) shows its art on the hero', JSON.stringify(i6a));
  const i6b = await ev(() => { __setCur(__d.extNone); openNowPlaying(); return __hero(); });
  ok(i6b && i6b.imgSrc === '/logo.png' && i6b.key === 'logo',
    'F-435-I6 (adjusted — the ruling): an external track with no art → the logo (no glyph-tile branch stands)', JSON.stringify(i6b));
}

/* ---------------- F-435-I3: the key guard ---------------- */
{
  const i3 = await ev(() => {
    __setCur(__d.ownLow);
    openNowPlaying();
    var a = document.querySelector('#np-art');
    var img1 = a.querySelector('img');
    var html1 = a.innerHTML;
    updateNowPlaying();
    updateNowPlaying();
    var img2 = a.querySelector('img');
    return { sameNode: img1 === img2, sameHtml: a.innerHTML === html1 };
  });
  ok(i3.sameNode && i3.sameHtml,
    'F-435-I3: repeated updateNowPlaying calls on an unchanged track leave the hero DOM identical (no rebuild, no img reload)', JSON.stringify(i3));
}

/* ---------------- F-435-I1: hero box parity at 412px ---------------- */
{
  const i1 = await ev(({ ART_EP, ART_SHOW }) => {
    __setCur(__d.ownLow);
    openNowPlaying();
    var a = document.querySelector('#np-art');
    var t = document.querySelector('#np-title');
    var r1 = a.getBoundingClientRect();
    var logoForm = { w: r1.width, h: r1.height, titleTop: t.getBoundingClientRect().top };
    state.podcasts = { series: 'bible', showImageUrl: ART_SHOW };
    var d = podDesc({ key: 'e1', label: 'Day 316', title: 'Episode One', url: 'https://x/e1.mp3', durationS: 600, listened: false, positionS: 0, imageUrl: ART_EP, descText: null });
    state.current = d;
    updateNowPlaying();
    var r2 = a.getBoundingClientRect();
    var artForm = { w: r2.width, h: r2.height, titleTop: t.getBoundingClientRect().top };
    return { logoForm, artForm };
  }, { ART_EP, ART_SHOW });
  ok(Math.abs(i1.logoForm.w - i1.logoForm.h) < 1 && Math.abs(i1.logoForm.w - i1.artForm.w) < 1 && Math.abs(i1.logoForm.h - i1.artForm.h) < 1,
    'F-435-I1: the hero box is the same square in the logo form and the art form (min(72vw, 340px) at 412px)', JSON.stringify(i1));
  ok(Math.abs(i1.logoForm.titleTop - i1.artForm.titleTop) < 1,
    'F-435-I1: the title\u2019s top does not move between the logo form and the art form', JSON.stringify(i1));
}

await browser.close();
server.close();
console.log(`\nharness-v435: ${pass} ok / ${fail} not-ok`);
if (failures.length) { console.log('failures:\n - ' + failures.join('\n - ')); process.exit(1); }
