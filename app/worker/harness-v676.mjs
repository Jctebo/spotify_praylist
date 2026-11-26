// harness-v676.mjs — v676: the LOH widget for every Divine
// Office prayer — the player's Read stands for office tracks
// (Plan §3).
//
// Chromium (playwright-core) harness, modeled on
// harness-v675.mjs: the REAL built Worker bundle (esbuild
// from source) served locally, the API stubbed, real acts,
// same-tick DOM assertions; ORA_WT selects the tree for the
// fail-on-old run.
//
// Fixtures (Improvement D — production shapes, sources named
// in Plan §3):
//  - Morning/Evening Prayer × Divine Office / Sing the Hours,
//    shaped exactly as harness-v675's officeFx (the
//    extSlotTrack shape: episodeId = slot id, kind 'external',
//    source standing, hasText false, textUrl null, provider
//    descText). Morning × Sing the Hours is the field
//    screenshot case and runs FIRST.
//  - One episode-shaped Divine Office Office of Readings
//    descriptor: episodeId NOT a slot id (a feed-shaped id),
//    kind 'podcast', source 'Divine Office', title naming the
//    hour, hasText false, textUrl null.
//  - Controls: a non-office external (ext-saint-of-the-day,
//    source 'Good Catholic') and an own podcast episode with
//    hasText/textUrl (harness-v675's OWN shape).
// Player legs set state.current + state.queue = [fixture] and
// state.readTracks = {} — the real composed-track shape: no
// readTracks entry stands for a playing office track.
//
// Legs: P1–P4 player widget paint (4 office slot fixtures) ·
// P5 episode-shaped office descriptor in the player · P6
// failure path in the player-opened sheet · P7 openRead with
// { plainText675: true } paints the widget anyway (the v675
// opt-out retired) · C1 non-office external: #np-read stays
// hidden · C2 own podcast episode: standing plain-text path.
// Fail-on-old: base 98262df — P1–P5, P7 fail; C1, C2 pass.
//
// Run: node app/worker/harness-v676.mjs
//      ORA_WT=/path/to/old-tree node /path/to/harness-v676.mjs
let chromium;
try { ({ chromium } = await import('playwright-core')); }
catch (e) { ({ chromium } = await import(process.env.HOME + '/workspace/.tools/pwtest/node_modules/playwright-core/index.mjs')); }
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = process.env.ORA_WT ? path.resolve(process.env.ORA_WT) : path.resolve(HERE, '..', '..');
const W = path.join(WT, 'app/worker');
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';

let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok   ' + name); }
  else { bad++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 400) : '')); }
}

// ---------- fixtures (extSlotTrack's exact shape) ----------
function officeFx(slotId, title, source) {
  return {
    episodeId: slotId, title, kind: 'external', source,
    available: true, streamUrl: 'https://example.invalid/' + slotId + '-' + source.replace(/\W+/g, '') + '.mp3',
    durationS: 600, sizeBytes: 0, hasText: false, textUrl: null, _block: 'Morning',
    imageUrl: null, descText: 'PROVIDER BLURB ' + slotId + ' via ' + source,
    stale: false, unresolved: false, resolvedAt: null,
  };
}
const FIX = {
  mornSH: officeFx('ext-morning-prayer', 'Morning Prayer', 'Sing the Hours'),
  mornDO: officeFx('ext-morning-prayer', 'Morning Prayer', 'Divine Office'),
  eveSH: officeFx('ext-evening-prayer', 'Evening Prayer', 'Sing the Hours'),
  eveDO: officeFx('ext-evening-prayer', 'Evening Prayer', 'Divine Office'),
  saint: officeFx('ext-saint-of-the-day', 'Saint of the Day', 'Good Catholic'),
};
// Episode-shaped Divine Office descriptor (Plan §3): the
// episodeId is a feed-shaped id, NOT one of the eight slot
// ids; only source + title carry the office identity.
const EP_OOR = {
  episodeId: 'divineoffice-ep-oor-20261118', title: 'Office of Readings', kind: 'podcast', source: 'Divine Office',
  available: true, streamUrl: 'https://example.invalid/divineoffice-oor.mp3', url: 'https://example.invalid/divineoffice-oor.mp3',
  durationS: 900, sizeBytes: 0, hasText: false, textUrl: null, imageUrl: null, descText: null,
  stale: false, unresolved: false, resolvedAt: null,
};
const OWN = { episodeId: 'own-ep-1', title: 'Own Episode', kind: 'podcast', available: true, streamUrl: 'https://example.invalid/own.mp3', url: 'https://example.invalid/own.mp3', durationS: 300, hasText: true, textUrl: 'https://example.invalid/own-text.txt', descText: null };
check('F fixtures carry the production extSlotTrack shape (slot episodeId, kind external, hasText false, textUrl null, provider descText)', Object.values(FIX).every((f) => f.kind === 'external' && f.hasText === false && f.textUrl === null && !!f.descText));
check('F episode fixture is episode-shaped (episodeId not a slot id, source Divine Office, title names the hour, hasText false, textUrl null)', !['ext-invitatory', 'ext-morning-prayer', 'ext-midmorning-prayer', 'ext-midday-prayer', 'ext-midafternoon-prayer', 'ext-office-of-readings', 'ext-evening-prayer', 'ext-night-prayer'].includes(EP_OOR.episodeId) && EP_OOR.source === 'Divine Office' && EP_OOR.hasText === false && EP_OOR.textUrl === null);

// ---------- build + serve the real bundle ----------
const TMP = mkdtempSync(tmpdir() + '/v676harness-');
execFileSync(process.env.HOME + '/workspace/.tools/wrangler-env/node_modules/.bin/esbuild',
  [path.join(W, 'src/index.ts'), '--bundle', '--format=cjs', '--platform=node', '--outfile=' + TMP + '/index.cjs'], { stdio: 'pipe' });
const _mod = await import(TMP + '/index.cjs');
const WORKER = _mod.default?.default || _mod.default;
const ENV = { DB: { prepare: () => ({ bind: function () { return this; }, first: async () => null, all: async () => ({ results: [] }), run: async () => ({}) }), batch: async () => [] }, AGENT_TOKEN: 't', LOCAL_DEV: '1' };
const SHELL = await (await WORKER.fetch(new Request('https://app.local/'), ENV)).text();
const APPJS = await (await WORKER.fetch(new Request('https://app.local/app.js'), ENV)).text();
const CSS = await (await WORKER.fetch(new Request('https://app.local/styles.css'), ENV)).text();
const SWJS = await (await WORKER.fetch(new Request('https://app.local/sw.js'), ENV)).text();
check('F the served service worker carries the v676 release pin ora-pro-nobis-v676-1', /ora-pro-nobis-v676-1/.test(SWJS), 'pin not in served /sw.js');
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/app.js')) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(APPJS); }
  if (req.url.startsWith('/styles.css')) { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(CSS); }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(SHELL);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const b = await chromium.launch({ executablePath: EXE });
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
await pg.addInitScript(() => {
  window.__fetches = [];
  const respText = (txt) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve(txt) });
  window.fetch = (url) => {
    const u = String(url);
    window.__fetches.push(u);
    if (u.includes('own-text.txt')) return respText('OWN PLAIN TEXT BODY');
    if (u.includes('office-text.txt')) return respText('OFFICE PLAIN TEXT BODY');
    return new Promise(() => {});
  };
});
await pg.goto('http://127.0.0.1:' + PORT + '/');
await pg.waitForTimeout(1500);

// ---------- drivers ----------
async function cleanupPlayer() {
  await pg.evaluate(() => {
    const np = document.querySelector('.np-sheet'); if (np) np.remove();
    const r = document.querySelector('.readsheet'); if (r) r.remove();
    state.current = null; state.queue = []; state.queueIdx = 0; state.readTracks = {};
    window.__fetches = [];
  });
}
async function openPlayer(fx, readTracks) {
  await cleanupPlayer();
  await pg.evaluate(({ fx, readTracks }) => {
    state.current = fx;
    state.queue = [fx]; state.queueIdx = 0;
    state.readTracks = readTracks || {};
    openNowPlaying();
  }, { fx, readTracks });
  await pg.waitForTimeout(200);
}
function npReadState() {
  return pg.evaluate(() => {
    const btn = document.querySelector('#np-read');
    if (!btn) return { btn: false };
    return { btn: true, visibility: btn.style.visibility, ariaHidden: btn.getAttribute('aria-hidden') };
  });
}
function sheetState() {
  return pg.evaluate(() => {
    const sh = document.querySelector('.readsheet');
    const ifr = sh ? sh.querySelector('iframe') : null;
    const fail = sh ? sh.querySelector('.lohfail675') : null;
    // The widget body carries a HIDDEN fallback row from the
    // start; the failure row stands only when it is not hidden
    // (the wire's fail path replaces the block with an unhidden
    // row — harness-v675's pageState makes the same test).
    const failA = (fail && !fail.hidden) ? fail.querySelector('a') : null;
    return {
      sheet: !!sh,
      text: sh ? sh.textContent : '',
      iframeSrc: ifr ? ifr.getAttribute('src') : null,
      iframeSandbox: ifr ? ifr.getAttribute('sandbox') : null,
      failText: failA ? failA.textContent : null,
      failHref: failA ? failA.getAttribute('href') : null,
      fetches: (window.__fetches || []).slice(),
    };
  });
}
async function clickNpRead() {
  await pg.evaluate(() => { const btn = document.querySelector('#np-read'); if (btn) btn.click(); });
  await pg.waitForTimeout(400);
}
function checkPlayerOffice(tag, np, s, fx) {
  check(tag + ' #np-read stands in the player (visibility cleared, no aria-hidden)', np.btn && np.visibility !== 'hidden' && np.ariaHidden === null, np);
  check(tag + ' click paints the Read sheet', s.sheet, s);
  check(tag + ' sheet iframe src is exactly https://divineoffice.org/widget, no sandbox', s.iframeSrc === 'https://divineoffice.org/widget' && s.iframeSandbox === null, s);
  check(tag + ' header: heading "Liturgy of the Hours"', s.text.includes('Liturgy of the Hours'), s.text.slice(0, 300));
  check(tag + ' header: the hour "' + fx.title + '"', s.text.includes(fx.title), s.text.slice(0, 300));
  check(tag + ' header: Q3 line "Text: Divine Office — the widget always shows today’s Hours"', s.text.includes('Text: Divine Office — the widget always shows today’s Hours'), s.text.slice(0, 400));
  check(tag + ' header: Q5 note "Playing inside the frame is separate from the app player."', s.text.includes('Playing inside the frame is separate from the app player.'), s.text.slice(0, 400));
  if (fx.source === 'Sing the Hours') check(tag + ' header: Q4 line "Audio: Sing the Hours · Text: Divine Office (today)"', s.text.includes('Audio: Sing the Hours · Text: Divine Office (today)'), s.text.slice(0, 400));
  else check(tag + ' header: no Sing the Hours audio line on a Divine Office track', !s.text.includes('Audio: Sing the Hours'), s.text.slice(0, 400));
}

// ---------- P1–P4 (P1 = the field screenshot case, first) ----------
await openPlayer(FIX.mornSH); await clickNpRead(); checkPlayerOffice('P1 Morning/SingTheHours (screenshot case)', await npReadState(), await sheetState(), FIX.mornSH);
await openPlayer(FIX.mornDO); await clickNpRead(); checkPlayerOffice('P2 Morning/DivineOffice', await npReadState(), await sheetState(), FIX.mornDO);
await openPlayer(FIX.eveSH); await clickNpRead(); checkPlayerOffice('P3 Evening/SingTheHours', await npReadState(), await sheetState(), FIX.eveSH);
await openPlayer(FIX.eveDO); await clickNpRead(); checkPlayerOffice('P4 Evening/DivineOffice', await npReadState(), await sheetState(), FIX.eveDO);

// ---------- P5 episode-shaped office descriptor ----------
await openPlayer(EP_OOR); await clickNpRead(); checkPlayerOffice('P5 OfficeOfReadings episode/DivineOffice', await npReadState(), await sheetState(), EP_OOR);

// ---------- P6 failure path (screenshot fixture) ----------
await openPlayer(FIX.mornSH);
await clickNpRead();
{
  // Past the wire's 6s bound the fallback row must stand; the
  // frame cannot load from this sandbox. Poll (bounded at
  // 40s) — the sandbox renderer is CPU-throttled, as in
  // harness-v675's T5.
  let s = await sheetState();
  for (let i = 0; i < 40 && !s.failText; i++) { await pg.waitForTimeout(1000); s = await sheetState(); }
  check('P6 past the bound: the "Text unavailable — open Divine Office" row stands in the Read sheet (link https://divineoffice.org)', !!s.failText && s.failText.includes('Text unavailable — open Divine Office') && s.failHref === 'https://divineoffice.org', s);
  check('P6 past the bound: no iframe remains (never a blank box)', s.iframeSrc === null, s);
}

// ---------- P7 opt-out retired ----------
await cleanupPlayer();
await pg.evaluate((t) => { openRead(t, { plainText675: true }); }, FIX.mornDO);
await pg.waitForTimeout(400);
{
  const s = await sheetState();
  check('P7 openRead(office, {plainText675:true}) paints the widget branch anyway (iframe stands — the v675 opt-out is retired)', s.sheet && s.iframeSrc === 'https://divineoffice.org/widget', s);
}

// ---------- C1 non-office external in the player ----------
await openPlayer(FIX.saint);
{
  const np = await npReadState();
  check('C1 non-office external: #np-read stays hidden (visibility hidden + aria-hidden true)', np.btn && np.visibility === 'hidden' && np.ariaHidden === 'true', np);
  await clickNpRead();
  const s = await sheetState();
  check('C1 non-office external: click attempt opens no Read sheet (no widget reached)', !s.sheet, s);
}

// ---------- C2 own podcast episode with text in the player ----------
await openPlayer(OWN, { 'own-ep-1': OWN });
{
  const np = await npReadState();
  check('C2 own episode: #np-read stands via the standing text test', np.btn && np.visibility !== 'hidden' && np.ariaHidden === null, np);
  await clickNpRead();
  const s = await sheetState();
  check('C2 own episode: click paints the PLAIN fetched text, no iframe', s.sheet && s.iframeSrc === null && s.text.includes('OWN PLAIN TEXT BODY'), s);
}

await cleanupPlayer();
await b.close();
server.close();
console.log('harness-v676: ' + ok + ' ok, ' + bad + ' bad');
process.exit(bad ? 1 : 0);
