#!/usr/bin/env node
// harness-v430 — the v430 gate (§2.6 of the v430 release
// document): the AI Signal takes the own family's swap —
// when the v392 offline copy stands under the day key, the
// shell-resolved slot plays the device-local copy (Trigger A
// at resolveAiSignal's present tail; Trigger B when the pass
// lands the presented day's ai item), the stream stands as
// the pre-download fallback, and the kind-'ai' size check
// (server-measured sizeBytes, byte equality) guards the copy
// at the pass and at the settle. Delta confined to
// client.ts; index.ts byte-untouched (the F-430-1 probe
// cleared the route — §1.8 leg 6 discharged at Plan).
// Mold: the v413/v424/v425 extraction mold (real SHELL_HTML
// + APP_CSS + the client's own functions, extracted) PLUS
// the client's top-level audio listeners + its 1 s ticks, so
// the ended handler and the v412 stall watchdog stand in the
// mold as shipped. Real Cache Storage, a real audio element,
// a real tone MP3: the stream route and the local copy serve
// the same bytes — the finish is proven against both.
// Legs map to §2.6:
//   S statics (4) · L1 local play source (3) · L2 the finish
//   from the local copy (3) · L3 the stream fallback (3) ·
//   L4 the size check (3) · L5 unregressed finishes (2)
//   = 18 legs.
import { readFileSync } from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';

const APP = path.resolve(process.cwd(), 'app');
const WT = path.resolve(APP, '..');
const SRC = path.join(APP, 'worker/src');
const C_SRC = readFileSync(SRC + '/client.ts', 'utf8');
const U_SRC = readFileSync(SRC + '/ui.ts', 'utf8');
const I_SRC = readFileSync(SRC + '/index.ts', 'utf8');
const BASE = '9813a525';
const BASE_C = execSync('git show ' + BASE + ':app/worker/src/client.ts', { cwd: WT, encoding: 'utf8' });
const BASE_I = execSync('git show ' + BASE + ':app/worker/src/index.ts', { cwd: WT, encoding: 'utf8' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('ok   - ' + name); }
  else { fail++; failures.push(name); console.log('FAIL - ' + name + (extra ? ' :: ' + String(extra).slice(0, 300) : '')); }
}
const seg = (src, a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));

/* ---------------- the tone fixture ---------------- */
const TMPD = fs.mkdtempSync(path.join(os.tmpdir(), 'opn-v430-'));
const tonePath = path.join(TMPD, 'tone.mp3');
{
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-codec:a', 'libmp3lame', '-b:a', '32k', tonePath], { encoding: 'utf8' });
  if (r.status !== 0) { console.error('ffmpeg failed: ' + r.stderr); process.exit(2); }
}
const TONE = fs.readFileSync(tonePath);
const AI_LEN = TONE.length;
const SHORT = TONE.subarray(0, Math.floor(AI_LEN / 2));

/* ---------------- S: statics (4) ---------------- */
{
  const resolveSeg = seg(C_SRC, 'function resolveAiSignal', 'function aiSettleSwap');
  const swapSeg = seg(C_SRC, 'function aiSettleSwap', 'function resolveExternals');
  ok(resolveSeg.includes("state: 'present', tracks: [{ episodeId: 'the-ai-signal'")
    && resolveSeg.includes('aiSettleSwap(day);')
    && resolveSeg.indexOf('aiSettleSwap(day);') > resolveSeg.indexOf("state: 'present', tracks:"),
    'S1a: Trigger A stands at resolveAiSignal\u2019s present tail (the swap call follows the present-slot assignment)');
  ok(swapSeg.includes("offlineDayKey(date, 'the-ai-signal')")
    && swapSeg.includes('var owner = ownBlobOwner(key);')
    && swapSeg.includes('mintBlobUrl(owner, blob)')
    && swapSeg.includes('track.streamUrl === owner.blobUrl')
    && swapSeg.includes('t2.streamUrl = objUrl')
    && swapSeg.includes('ownSwapRow(r2, day)')
    && swapSeg.includes('ownRegisterReadTracks();')
    && swapSeg.includes('extRebuildDescs(day)')
    && swapSeg.includes('blob.size !== track.sizeBytes'),
    'S1b: aiSettleSwap reads the pass\u2019s own day key, mints under ownBlobOwner (Fix 11), once-guards on the standing mint, size-gates the settle, and lands via ownSwapRow + ownRegisterReadTracks + extRebuildDescs');
  const dlSeg = seg(C_SRC, 'function offlineDownloadItems', 'function offlineEvict');
  const putBase = seg(BASE_C, 'function offlinePutBlob', 'function offlineFetchBlob');
  const putCur = seg(C_SRC, 'function offlinePutBlob', 'function offlineFetchBlob');
  const aiPushes = (C_SRC.match(/kind: 'ai'[^}]*sizeBytes: t\.sizeBytes \|\| 0/g) || []).length;
  ok(dlSeg.includes("it.kind === 'ai' && it.sizeBytes > 0")
    && dlSeg.includes('cache.delete(it.key)')
    && dlSeg.includes('blob.size !== it.sizeBytes')
    && dlSeg.includes('fireAiSwap(it)')
    && putCur === putBase && aiPushes === 2,
    'S2: the size check stands in offlineDownloadItems scoped to kind \u2018ai\u2019 (standing mismatch deletes + refetches; a short fetch is never stored; Trigger B fires on a stored ai item); offlinePutBlob is byte-identical to base; both ai item producers carry sizeBytes');
  ok(I_SRC === BASE_I
    && U_SRC.includes('ora-pro-nobis-v429-1') && !U_SRC.includes('ora-pro-nobis-v430-1')
    && !/#1DB954|#1ed760/i.test(C_SRC + U_SRC),
    'S3: limits — index.ts byte-identical to base (the probe cleared the route; no rider joins); the pin stands at ora-pro-nobis-v429-1 (Ship moves it); no Spotify green');
  const mintBase = seg(BASE_C, 'function mintBlobUrl', 'var ownBlobOwners');
  const mintCur = seg(C_SRC, 'function mintBlobUrl', 'var ownBlobOwners');
  const ownBase = seg(BASE_C, 'function ownBlobOwner', 'var extBlobOwners');
  const ownCur = seg(C_SRC, 'function ownBlobOwner', 'var extBlobOwners');
  ok(mintCur === mintBase && ownCur === ownBase,
    'S4: mintBlobUrl + ownBlobOwner stand byte-identical to base (the swap rides the standing Fix 11 helpers)');
}

/* ---------------- client extraction (v425 mold + the top-level audio wiring) ---------------- */
function scanDecls(src) {
  const out = []; const lines = src.split('\n'); let li = 0;
  while (li < lines.length) {
    const line = lines[li];
    let m = line.match(/^function ([A-Za-z_$][\w$]*)\s*\(/);
    if (m) { out.push({ kind: 'fn', name: m[1], startLine: li }); li++; continue; }
    m = line.match(/^var ([A-Za-z_$][\w$]*)\s*=/);
    if (m) { out.push({ kind: 'var', name: m[1], startLine: li }); li++; continue; }
    if (/^audioEl\.addEventListener\(/.test(line)) { out.push({ kind: 'fn', name: '__listener@' + li, startLine: li }); li++; continue; }
    if (/^setInterval\((sleepTick|stallTick), 1000\);/.test(line)) { out.push({ kind: 'var', name: '__tick@' + li, startLine: li }); li++; continue; }
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
  try { if (d.kind === 'fn' && !d.name.startsWith('__')) new Function('return (' + u + ')'); else new Function(u); pieces.push(u); }
  catch (e) { dropped.push(d.name); }
}
console.log('note - extraction dropped:', dropped.join(', ') || 'none');

const APP_CSS = U_SRC.slice(U_SRC.indexOf('APP_CSS = `') + 11, U_SRC.indexOf('`;', U_SRC.indexOf('APP_CSS = `')));
const SHELL = U_SRC.slice(U_SRC.indexOf('SHELL_HTML = `') + 14, U_SRC.indexOf('`;', U_SRC.indexOf('SHELL_HTML = `')));
const DATE = '2026-11-14';
const ROUTE = '/api/player/audio/' + DATE + '/the-ai-signal';
const PAGE_HEAD = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>CSSHERE</style></head>
<body data-lit="">
<audio id="audio"></audio>
SHELLHERE
<script>
function extFetchText(url) { return Promise.reject(new Error('offline')); }
</` + `script>
<script>
var state = { tab: 'prayers', block: null, playingKey: null, playingUrl: null, queue: [], queueIdx: -1, current: null,
  storedDay: '${DATE}', presentedDay: '${DATE}', dateLabel: 'Saturday, November 14', liturgical: null,
  pendingResume: null, sleep: { mode: 'off' }, readTracks: {}, dayDescs: [], dayPayload: null, playedCache: {},
  repeatIds: {}, previewQueue: null, queuePreviewIdx: -1, restoredQueue: false, restoreProbe: null, podRestoreProbe: null,
  prayersView: { kind: 'home' }, searchQuery: '', podcasts: null, podcastsIndex: null, podcastsReturn: null,
  rate: 1, errWaitKey: null, errWaitN: 0, startRetryKey: null, lastStartAt: 0,
  stallKey: null, stallAt: 0, stallPos: 0, stallCycles: 0,
  ownStanding: [], extStanding: [], extSlots: {}, ownSlots: {}, daySegments: {}, homeFilter: '', gridDl: {}, aiClaimed: false };
window.__AI_LEN = ${AI_LEN};
window.__ROUTE = '${ROUTE}';
window.__DATE = '${DATE}';
window.__mkDay = function () {
  return { date: window.__DATE, presentedDay: window.__DATE, dateLabel: 'Saturday, November 14', introTexts: {}, intros: {},
    blocks: [
      { block: 'Morning', label: 'Morning', caption: '', tracks: [] },
      { block: 'The AI Signal', label: 'The AI Signal', caption: 'the day\u2019s episode', tracks: [
        { episodeId: 'the-ai-signal', title: 'The AI Signal', kind: 'episode', streamUrl: window.__ROUTE, durationS: 2, sizeBytes: window.__AI_LEN } ] }
    ], episodes: [] };
};
window.__settings = { version: 6, sources: [
  { sourceKey: 'the-ai-signal', name: 'The AI Signal', family: 'own', block: 'The AI Signal', sortOrder: 1, enabled: 1 },
  { sourceKey: 'morning-prayer', name: 'Morning Prayer', family: 'own', block: 'Morning', sortOrder: 2, enabled: 1 }
] };
window.__build = function () {
  var day = window.__mkDay();
  state.dayPayload = day; state.storedDay = window.__DATE; state.presentedDay = window.__DATE;
  state.ownStanding = []; state.ownSlots = {}; state.extStanding = []; state.extSlots = {}; state.dayDescs = [];
  var shell = claimAiSignalShell(day);
  resolveAiSignal(day, window.__settings, shell);
  extRebuildDescs(day); // the real build's tail: descriptors stand from what stands resolved
  return day;
};
window.__reset = function () {
  try { audioEl.pause(); } catch (e) {}
  state.queue = []; state.queueIdx = -1; state.current = null;
  state.playedCache = {};
  try { localStorage.removeItem('opn-played-v344'); localStorage.setItem('opn-autoplay', 'off'); } catch (e) {}
  view.innerHTML = '';
  return caches.delete('opn-ext-audio-v1');
};
window.__seed = function (bytes) {
  return caches.open('opn-ext-audio-v1').then(function (cache) {
    return cache.put('day/' + window.__DATE + '/the-ai-signal', new Response(bytes, { headers: { 'Content-Type': 'audio/mpeg' } }));
  });
};
window.__aiDesc = function () { return (state.dayDescs || []).filter(function (d) { return d.episodeId === 'the-ai-signal'; })[0] || null; };
window.__aiTrack = function () { var st = state.ownSlots['the-ai-signal']; return st && st.tracks ? st.tracks[0] : null; };
window.__mark = function (id) { var m = state.playedCache || {}; return m[id] && m[id][window.__DATE] ? m[id][window.__DATE] : null; };
</` + `script>`;
const PAGE = PAGE_HEAD.replace('CSSHERE', () => APP_CSS).replace('SHELLHERE', () => SHELL)
  + '<script>\n' + pieces.join('\n') + '\n</' + 'script>';

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  if (u.pathname === ROUTE || u.pathname === '/tone.mp3') { res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': TONE.length }); return res.end(TONE); }
  if (u.pathname === '/short.mp3') { res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': SHORT.length }); return res.end(SHORT); }
  if (u.pathname.startsWith('/api/')) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"ok":true}'); }
  if (u.pathname === '/' || u.pathname === '') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(PAGE); }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const requirePw = createRequire('/home/hatch/workspace/.tools/pwtest/package.json');
const { chromium } = requirePw('playwright-core');
const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
page.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:' + PORT + '/');
const ev = (fn, arg) => page.evaluate(fn, arg);
const waitFor = async (fn, arg, timeout = 9000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { if (await ev(fn, arg)) return true; await sleep(150); }
  return false;
};
await ev(() => { localStorage.clear(); localStorage.setItem('opn-autoplay', 'off'); });

/* ---------------- L1: the local copy stands → the play source is local (3) ---------------- */
{
  await ev(() => window.__reset());
  await ev((len) => {
    const bytes = new Uint8Array(len);
    return fetch(window.__ROUTE).then((r) => r.arrayBuffer()).then((ab) => window.__seed(new Uint8Array(ab)));
  }, AI_LEN);
  const day = await ev(() => { window.__day = window.__build(); return true; });
  const swapped = await waitFor(() => { const t = window.__aiTrack(); return !!t && typeof t.streamUrl === 'string' && t.streamUrl.indexOf('blob:') === 0; });
  const read1 = await ev(() => {
    const t = window.__aiTrack();
    const d = window.__aiDesc();
    const key = offlineDayKey(window.__DATE, 'the-ai-signal');
    return { trackUrl: t ? t.streamUrl : null, descUrl: d ? d.url : null, mint: ownBlobOwner(key).blobUrl || null };
  });
  ok(swapped && read1.descUrl && read1.descUrl === read1.mint && read1.trackUrl === read1.mint,
    'L1a: the copy pre-seeded under the day key → the built AI descriptor\u2019s url is the owner\u2019s blob mint, not the route', JSON.stringify(read1));

  const dot = await ev(() => {
    view.innerHTML = '<span data-rowdl="the-ai-signal" style="display:none">dl</span>';
    return refreshGridDlStates().then(() => {
      const el = view.querySelector('[data-rowdl="the-ai-signal"]');
      return { display: el.style.display, descUrl: (window.__aiDesc() || {}).url || null };
    });
  });
  ok(dot.display !== 'none' && dot.descUrl && dot.descUrl.indexOf('blob:') === 0,
    'L1b: the downloaded dot stands AND the descriptor\u2019s url is the blob (the mark and the play path agree)', JSON.stringify(dot));

  await ev(() => window.__reset());
  const day2 = await ev(() => {
    window.__day = window.__build();
    const row = state.ownStanding.filter((r) => r.sourceKey === 'the-ai-signal')[0];
    const meta = state.ownSlots['the-ai-signal'].tracks[0];
    view.innerHTML = '<div data-own-row="the-ai-signal">' + trackCard(ownSlotTrack(row, meta, window.__DATE)) + '</div>';
    return fetch(window.__ROUTE).then((r) => r.arrayBuffer()).then((ab) => window.__seed(new Uint8Array(ab))).then(() => aiSettleSwap(window.__day));
  });
  await sleep(500);
  const card = await ev(() => ({
    btn: !!view.querySelector('[data-playkey="the-ai-signal"]'),
    descUrl: (window.__aiDesc() || {}).url || null
  }));
  await ev(() => { const b = view.querySelector('[data-playkey="the-ai-signal"]'); if (b) b.click(); });
  await sleep(400);
  const played = await ev(() => ({ cur: state.current ? state.current.episodeId : null, curUrl: state.current ? state.current.url : null, src: audioEl.src || '' }));
  ok(card.btn && card.descUrl && card.descUrl.indexOf('blob:') === 0
    && played.cur === 'the-ai-signal' && played.curUrl && played.curUrl.indexOf('blob:') === 0 && played.src.indexOf('blob:') === 0,
    'L1c: the swap re-paints the standing card (ownSwapRow) — its play control resolves the blob descriptor without a reload', JSON.stringify({ card, played }));
}

/* ---------------- L2: the finish from the local copy (3) ---------------- */
{
  await ev(() => window.__reset());
  await ev(() => fetch(window.__ROUTE).then((r) => r.arrayBuffer()).then((ab) => window.__seed(new Uint8Array(ab))).then(() => { window.__day = window.__build(); }));
  await waitFor(() => { const d = window.__aiDesc(); return !!d && typeof d.url === 'string' && d.url.indexOf('blob:') === 0; });
  const started = await ev(() => { const d = window.__aiDesc(); playTrack(d); return { src: audioEl.src || '' }; });
  const marked = await waitFor(() => !!window.__mark('the-ai-signal'), null, 9000);
  const read2 = await ev(() => ({ mark: window.__mark('the-ai-signal'), cycles: state.stallCycles || 0, stallKey: state.stallKey || null }));
  ok(started.src.indexOf('blob:') === 0 && marked && read2.mark && read2.mark.via === 'played',
    'L2a: the AI track played from the local copy reaches the fixture\u2019s end → ended fires → the played mark writes (via \u2018played\u2019)', JSON.stringify({ started, read2 }));
  ok(read2.cycles === 0 && !read2.stallKey,
    'L2c: no watchdog pass-over engages on the local play (no stall stamp, no recovery cycle; the mark came through the ended path, which a pass-over never writes)', JSON.stringify(read2));

  await ev(() => window.__reset());
  await ev(() => fetch(window.__ROUTE).then((r) => r.arrayBuffer()).then((ab) => window.__seed(new Uint8Array(ab))).then(() => {
    window.__day = window.__build();
    state.ownStanding.push({ sourceKey: 'morning-prayer', episodeId: 'morning-prayer', block: 'Morning', sortOrder: 2, title: 'Morning Prayer', enabled: 1 });
    state.ownSlots['morning-prayer'] = { state: 'present', tracks: [{ episodeId: 'morning-prayer', title: 'Morning Prayer', state: 'present', enclosureUrl: '/tone.mp3', streamUrl: '/tone.mp3', durationS: 2, sizeBytes: window.__AI_LEN, hasText: true }] };
  }));
  await waitFor(() => { const d = window.__aiDesc(); return !!d && typeof d.url === 'string' && d.url.indexOf('blob:') === 0; });
  const queued = await ev(() => {
    const descs = extRebuildDescs(window.__day);
    const ai = descs.filter((d) => d.episodeId === 'the-ai-signal')[0];
    const own = descs.filter((d) => d.episodeId === 'morning-prayer')[0];
    startQueue([ai, own], true);
    return { cur: state.current ? state.current.episodeId : null, qlen: state.queue.length };
  });
  const advanced = await waitFor(() => state.current && state.current.episodeId === 'morning-prayer', null, 9000);
  const readQ = await ev(() => ({ mark: window.__mark('the-ai-signal'), cur: state.current ? state.current.episodeId : null }));
  ok(queued.cur === 'the-ai-signal' && advanced && readQ.mark && readQ.mark.via === 'played',
    'L2b: a queue containing the AI track advances past it after the finish — the mark stands BEFORE the advance (the ended handler\u2019s order)', JSON.stringify({ queued, readQ }));
}

/* ---------------- L3: the stream fallback (3) ---------------- */
{
  await ev(() => window.__reset());
  await ev(() => { window.__day = window.__build(); });
  await sleep(500);
  const read3 = await ev(() => {
    const d = window.__aiDesc();
    return { descUrl: d ? d.url : null, trackUrl: (window.__aiTrack() || {}).streamUrl || null };
  });
  const startedS = await ev(() => { const d = window.__aiDesc(); playTrack(d); return { src: audioEl.src || '', paused: audioEl.paused }; });
  ok(read3.descUrl === ROUTE && read3.trackUrl === ROUTE && startedS.src.endsWith(ROUTE) && startedS.paused === false,
    'L3a: cache empty at build → the descriptor\u2019s url is the store route and a tap starts the stream', JSON.stringify({ read3, startedS }));

  await ev(() => window.__reset());
  await ev(() => { window.__day = window.__build(); });
  await sleep(300);
  const passRun = await ev(() => {
    const items = offlineEnumerateToday(window.__DATE);
    window.__items = items;
    return offlineDownloadItems(items, null).then((r) => ({ n: items.length, kind: items.length ? items[0].kind : null, sizeBytes: items.length ? items[0].sizeBytes : null, have: r.have, total: r.total }));
  });
  const swappedB = await waitFor(() => { const d = window.__aiDesc(); return !!d && typeof d.url === 'string' && d.url.indexOf('blob:') === 0; });
  ok(passRun.n === 1 && passRun.kind === 'ai' && passRun.sizeBytes === AI_LEN && passRun.have === 1 && swappedB,
    'L3b: the pass landing the copy mid-session swaps the descriptor to the blob without a reload (Trigger B; the enumerated ai item carries the server-measured sizeBytes)', JSON.stringify(passRun));

  await ev(() => window.__reset());
  await ev(() => { window.__day = window.__build(); });
  await sleep(300);
  const playStream = await ev(() => { const d = window.__aiDesc(); playTrack(d); return { src: audioEl.src || '' }; });
  await sleep(300);
  const midSwap = await ev(() => fetch(window.__ROUTE).then((r) => r.arrayBuffer()).then((ab) => window.__seed(new Uint8Array(ab))).then(() => aiSettleSwap(window.__day)).then(() => ({
    src: audioEl.src || '', descUrl: (window.__aiDesc() || {}).url || null, curUrl: state.current ? state.current.url : null
  })));
  ok(playStream.src.endsWith(ROUTE) && midSwap.src.endsWith(ROUTE) && midSwap.curUrl === ROUTE
    && midSwap.descUrl && midSwap.descUrl.indexOf('blob:') === 0,
    'L3c: a swap landing while the AI track plays from the stream leaves the playing element\u2019s src untouched; the next descriptor read takes the blob', JSON.stringify({ playStream, midSwap }));
}

/* ---------------- L4: the size check (3) ---------------- */
{
  await ev(() => window.__reset());
  const l4a = await ev(() => {
    const item = { kind: 'ai', date: window.__DATE, id: 'the-ai-signal', enclosureUrl: '/short.mp3', sizeBytes: window.__AI_LEN, key: offlineDayKey(window.__DATE, 'the-ai-signal') };
    return offlineDownloadItems([item], null).then((r) => caches.open('opn-ext-audio-v1').then((c) => c.match(item.key)).then((resp) => ({ have: r.have, total: r.total, stored: !!resp })));
  });
  ok(l4a.have === 0 && l4a.total === 1 && l4a.stored === false,
    'L4a: a fetched ai blob short of sizeBytes is not stored and counts missing', JSON.stringify(l4a));

  await ev(() => window.__reset());
  const l4b = await ev(() => fetch('/short.mp3').then((r) => r.arrayBuffer()).then((ab) => window.__seed(new Uint8Array(ab))).then(() => {
    const item = { kind: 'ai', date: window.__DATE, id: 'the-ai-signal', enclosureUrl: window.__ROUTE, sizeBytes: window.__AI_LEN, key: offlineDayKey(window.__DATE, 'the-ai-signal') };
    return offlineDownloadItems([item], null).then((r) => caches.open('opn-ext-audio-v1').then((c) => c.match(item.key)).then((resp) => resp ? resp.blob() : null).then((blob) => ({ have: r.have, size: blob ? blob.size : null })));
  }));
  ok(l4b.have === 1 && l4b.size === AI_LEN,
    'L4b: a standing short copy is deleted at the pass, re-fetched, and the whole copy stands', JSON.stringify(l4b));

  await ev(() => window.__reset());
  await ev(() => fetch('/short.mp3').then((r) => r.arrayBuffer()).then((ab) => window.__seed(new Uint8Array(ab))).then(() => { window.__day = window.__build(); }));
  await sleep(600);
  const read4 = await ev(() => ({ trackUrl: (window.__aiTrack() || {}).streamUrl || null, descUrl: (window.__aiDesc() || {}).url || null }));
  ok(read4.trackUrl === ROUTE && read4.descUrl === ROUTE,
    'L4c: the settle refuses a short standing copy (no swap; the stream stands)', JSON.stringify(read4));
}

/* ---------------- L5: unregressed finishes (2) ---------------- */
{
  await ev(() => window.__reset());
  await ev(() => {
    window.__day = window.__mkDay();
    state.dayPayload = window.__day;
    state.ownStanding = [{ sourceKey: 'morning-prayer', episodeId: 'morning-prayer', block: 'Morning', sortOrder: 2, title: 'Morning Prayer', enabled: 1 }];
    state.ownSlots = { 'morning-prayer': { state: 'present', tracks: [{ episodeId: 'morning-prayer', title: 'Morning Prayer', state: 'present', enclosureUrl: '/tone.mp3', streamUrl: '/tone.mp3', durationS: 2, sizeBytes: window.__AI_LEN, hasText: true }] } };
    state.extStanding = []; state.extSlots = {};
    extRebuildDescs(window.__day);
    const d = (state.dayDescs || []).filter((x) => x.episodeId === 'morning-prayer')[0];
    playTrack(d);
  });
  const ownMarked = await waitFor(() => !!window.__mark('morning-prayer'), null, 9000);
  ok(ownMarked, 'L5a: an own episode finishes + marks as on base');

  await ev(() => window.__reset());
  await ev(() => {
    window.__day = window.__mkDay();
    state.dayPayload = window.__day;
    state.ownStanding = []; state.ownSlots = {};
    state.extStanding = [{ slotId: 'ext-fixture', block: 'Morning', sortOrder: 3 }];
    state.extSlots = { 'ext-fixture': { state: 'present', title: 'Fixture External', source: 'Fixture', streamUrl: '/tone.mp3', durationSec: 2, sizeBytes: window.__AI_LEN } };
    extRebuildDescs(window.__day);
    const d = (state.dayDescs || []).filter((x) => x.episodeId === 'ext-fixture')[0];
    playTrack(d);
  });
  const extMarked = await waitFor(() => !!window.__mark('ext-fixture'), null, 9000);
  ok(extMarked, 'L5b: an external slot finishes + marks as on base');
}

console.log('harness-v430: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) console.log('failures: ' + failures.join(' | '));
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
