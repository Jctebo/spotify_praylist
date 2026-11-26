// harness-v675.mjs — v675: the Divine Office widget on LOH
// track pages (Plan §3, Stop before Ship).
//
// Chromium (playwright-core) harness, modeled on
// harness-v673.mjs: the REAL built Worker bundle (esbuild
// from source) served locally, the API stubbed, real acts,
// same-tick DOM assertions; ORA_WT selects the tree for the
// fail-on-old run.
//
// Fixtures (Improvement D — production shapes, sources named
// in Plan §3):
//  - Morning/Evening Prayer × Divine Office / Sing the Hours,
//    as extSlotTrack (client.ts) builds them from the standing
//    EXT_SLOTS defs over a present record: episodeId = the slot
//    id, kind 'external', source standing, hasText false,
//    textUrl null, a provider-shaped descText blurb.
//  - Controls: an own text-carrying episode descriptor, and a
//    non-office external (ext-saint-of-the-day).
// The R1/R2/P1 probe clones the Morning/Divine Office fixture
// with a sentinel textUrl so "no textUrl fetch" is provable.
//
// Legs: T1–T4 track-page widget paint (4 office fixtures) ·
// T5 failure path (loading line, then the fallback row past
// the 6s bound) · R1 openRead office → widget, no fetch ·
// R2 openRead office + plainText675 → plain path · R3
// openRead control → standing text path · P1 Now Playing
// #np-read → PLAIN Read view, no iframe · C1 non-office ext
// track page unchanged (descText stands, no frame).
// Fail-on-old: base 88b28a3 — T1–T5, R1 fail; R3, C1 pass.
//
// Run: node app/worker/harness-v675.mjs
//      ORA_WT=/tmp/v675-old node /path/to/harness-v675.mjs
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
const DATE = '2026-11-18'; // a Wednesday
const DATE_LONG = 'Wednesday, November 18, 2026';
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
  mornDO: officeFx('ext-morning-prayer', 'Morning Prayer', 'Divine Office'),
  mornSH: officeFx('ext-morning-prayer', 'Morning Prayer', 'Sing the Hours'),
  eveDO: officeFx('ext-evening-prayer', 'Evening Prayer', 'Divine Office'),
  eveSH: officeFx('ext-evening-prayer', 'Evening Prayer', 'Sing the Hours'),
  saint: officeFx('ext-saint-of-the-day', 'Saint of the Day', 'Good Catholic'),
};
const OWN = { episodeId: 'own-ep-1', title: 'Own Episode', kind: 'podcast', available: true, streamUrl: 'https://example.invalid/own.mp3', url: 'https://example.invalid/own.mp3', durationS: 300, hasText: true, textUrl: 'https://example.invalid/own-text.txt', descText: null };
check('F fixtures carry the production extSlotTrack shape (slot episodeId, kind external, hasText false, textUrl null, provider descText)', Object.values(FIX).every((f) => f.kind === 'external' && f.hasText === false && f.textUrl === null && !!f.descText));

// ---------- build + serve the real bundle ----------
const TMP = mkdtempSync(tmpdir() + '/v675harness-');
execFileSync(process.env.HOME + '/workspace/.tools/wrangler-env/node_modules/.bin/esbuild',
  [path.join(W, 'src/index.ts'), '--bundle', '--format=cjs', '--platform=node', '--outfile=' + TMP + '/index.cjs'], { stdio: 'pipe' });
const _mod = await import(TMP + '/index.cjs');
const WORKER = _mod.default?.default || _mod.default;
const ENV = { DB: { prepare: () => ({ bind: function () { return this; }, first: async () => null, all: async () => ({ results: [] }), run: async () => ({}) }), batch: async () => [] }, AGENT_TOKEN: 't', LOCAL_DEV: '1' };
const SHELL = await (await WORKER.fetch(new Request('https://app.local/'), ENV)).text();
const APPJS = await (await WORKER.fetch(new Request('https://app.local/app.js'), ENV)).text();
const CSS = await (await WORKER.fetch(new Request('https://app.local/styles.css'), ENV)).text();
const SWJS = await (await WORKER.fetch(new Request('https://app.local/sw.js'), ENV)).text();
check('F the served service worker carries a release pin (v675 tree or base v673)', /ora-pro-nobis-v(675|673)-1/.test(SWJS), 'pin not in served /sw.js');
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
async function paintLanding(fx) {
  // The standing openTrackPage643 re-present timers (400/1200/
  // 2500ms) re-paint a previous page whose key differs — let a
  // prior paint's timers expire before painting the next page.
  await pg.waitForTimeout(2700);
  await pg.evaluate(({ fx, DATE }) => {
    state.dayDescs = [fx];
    state.presentedDay = DATE;
    state.dayPayload = { date: DATE, presentedDay: DATE, dateLabel: '', blocks: [] };
    state.tab = 'prayers';
    shareLanding = { s: 'day', id: fx.episodeId, date: DATE, src: fx.source, b: null, o: null };
    shareLandingLandDay();
  }, { fx, DATE });
  await pg.waitForTimeout(150);
}
function pageState() {
  return pg.evaluate(() => {
    const pgEl = document.getElementById('track-page-643');
    const txt = document.getElementById('track-text-643');
    const ifr = txt ? txt.querySelector('iframe') : null;
    return {
      page: !!pgEl,
      text: pgEl ? pgEl.textContent : '',
      iframeSrc: ifr ? ifr.getAttribute('src') : null,
      iframeSandbox: ifr ? ifr.getAttribute('sandbox') : null,
      loading: !!(txt && txt.querySelector('.lohloading675')),
      failLink: (() => { const f = txt && txt.querySelector('.lohfail675'); if (!f || f.hidden) return null; const a = f.querySelector('a'); return a ? { href: a.getAttribute('href'), text: a.textContent, target: a.getAttribute('target'), rel: a.getAttribute('rel') } : null; })(),
    };
  });
}
function checkOfficePage(tag, s, fx) {
  check(tag + ' track page paints', s.page, s);
  check(tag + ' header: heading "Liturgy of the Hours"', s.text.includes('Liturgy of the Hours'), s.text.slice(0, 300));
  check(tag + ' header: the hour "' + fx.title + '"', s.text.includes(fx.title), s.text.slice(0, 300));
  check(tag + ' header: the track\'s own date "' + DATE_LONG + '"', s.text.includes(DATE_LONG), s.text.slice(0, 300));
  check(tag + ' header: Q3 A line "Text: Divine Office — the widget always shows today\’s Hours"', s.text.includes("Text: Divine Office — the widget always shows today’s Hours"), s.text.slice(0, 400));
  check(tag + ' header: Q5 A note "Playing inside the frame is separate from the app player."', s.text.includes('Playing inside the frame is separate from the app player.'), s.text.slice(0, 400));
  if (fx.source === 'Sing the Hours') check(tag + ' header: Q4 A line "Audio: Sing the Hours · Text: Divine Office (today)"', s.text.includes('Audio: Sing the Hours · Text: Divine Office (today)'), s.text.slice(0, 400));
  else check(tag + ' header: no Sing the Hours audio line on a Divine Office page', !s.text.includes('Audio: Sing the Hours'), s.text.slice(0, 400));
  check(tag + ' #track-text-643 iframe src is exactly https://divineoffice.org/widget, no sandbox', s.iframeSrc === 'https://divineoffice.org/widget' && s.iframeSandbox === null, s);
  check(tag + ' provider descText does NOT paint', !s.text.includes(fx.descText), s.text.slice(0, 400));
}

// ---------- T1–T4 ----------
await paintLanding(FIX.mornDO); checkOfficePage('T1 Morning/DivineOffice', await pageState(), FIX.mornDO);
await paintLanding(FIX.mornSH); checkOfficePage('T2 Morning/SingTheHours', await pageState(), FIX.mornSH);
await paintLanding(FIX.eveDO); checkOfficePage('T3 Evening/DivineOffice', await pageState(), FIX.eveDO);
await paintLanding(FIX.eveSH); checkOfficePage('T4 Evening/SingTheHours', await pageState(), FIX.eveSH);
// Drop the live frame between legs — its sandbox network
// attempts otherwise burn the throttled renderer for later legs.
await pg.evaluate(() => { document.querySelectorAll('#track-text-643 iframe').forEach((f) => f.remove()); });

// ---------- T5 failure path ----------
await paintLanding(FIX.mornDO);
{
  const s0 = await pageState();
  check('T5 before the bound: the loading line stands', s0.loading === true, s0);
  // Past the 6s bound the fallback row must stand; the frame
  // cannot load from this sandbox. Poll (bounded at 40s) —
  // the sandbox renderer is CPU-throttled, so the 6s timer's
  // wall-clock landing varies; the bound asserted is that the
  // fallback DOES land and the loading line precedes it.
  let s = s0;
  for (let i = 0; i < 40 && !s.failLink; i++) { await pg.waitForTimeout(1000); s = await pageState(); }
  check('T5 past the bound: the fallback row stands ("Text unavailable — open Divine Office" → https://divineoffice.org, _blank, noopener)', !!s.failLink && s.failLink.text.includes('Text unavailable — open Divine Office') && s.failLink.href === 'https://divineoffice.org' && s.failLink.target === '_blank' && (s.failLink.rel || '').includes('noopener'), s);
  check('T5 past the bound: no blank frame block remains (iframe gone)', s.iframeSrc === null, s);
}

// ---------- R1–R3 ----------
const PROBE = { ...FIX.mornDO, hasText: true, textUrl: 'https://example.invalid/office-text.txt' };
function sheetState() {
  return pg.evaluate(() => {
    const sh = document.querySelector('.readsheet');
    const ifr = sh ? sh.querySelector('iframe') : null;
    return {
      sheet: !!sh,
      text: sh ? sh.textContent : '',
      iframeSrc: ifr ? ifr.getAttribute('src') : null,
      fetches: (window.__fetches || []).slice(),
    };
  });
}
await pg.evaluate(() => { const o = document.querySelector('.readsheet'); if (o) o.remove(); window.__fetches = []; });
await pg.evaluate((t) => { openRead(t); }, PROBE);
await pg.waitForTimeout(200);
{
  const s = await sheetState();
  check('R1 openRead(office) paints the widget branch (iframe src exact, header lines in the sheet)', s.sheet && s.iframeSrc === 'https://divineoffice.org/widget' && s.text.includes('Liturgy of the Hours') && s.text.includes("Text: Divine Office — the widget always shows today’s Hours"), s);
  check('R1 openRead(office) issues NO textUrl fetch', !s.fetches.some((u) => u.includes('office-text.txt')), s.fetches);
}
await pg.evaluate(() => { const o = document.querySelector('.readsheet'); if (o) o.remove(); window.__fetches = []; });
await pg.evaluate((t) => { openRead(t, { plainText675: true }); }, PROBE);
await pg.waitForTimeout(400);
{
  const s = await sheetState();
  check('R2 openRead(office, {plainText675:true}) takes the plain path (no iframe, fetched text paints)', s.sheet && s.iframeSrc === null && s.text.includes('OFFICE PLAIN TEXT BODY'), s);
}
await pg.evaluate(() => { const o = document.querySelector('.readsheet'); if (o) o.remove(); window.__fetches = []; });
await pg.evaluate((t) => { openRead(t); }, OWN);
await pg.waitForTimeout(400);
{
  const s = await sheetState();
  check('R3 openRead(own control) takes the standing plain-text path (text painted from its fetch, no iframe)', s.sheet && s.iframeSrc === null && s.text.includes('OWN PLAIN TEXT BODY'), s);
}

// ---------- P1 player opt-out, driven ----------
await pg.evaluate(({ cur, probe }) => {
  const o = document.querySelector('.readsheet'); if (o) o.remove();
  window.__fetches = [];
  state.current = cur;
  state.queue = [cur]; state.queueIdx = 0;
  state.readTracks = { 'ext-morning-prayer': probe };
  openNowPlaying();
  const btn = document.querySelector('#np-read');
  if (btn) btn.click();
}, { cur: FIX.mornDO, probe: PROBE });
await pg.waitForTimeout(500);
{
  const s = await sheetState();
  check('P1 Now Playing #np-read on a text-carrying office entry paints the PLAIN Read view (no iframe, fetched text paints — the §3.4 opt-out, driven)', s.sheet && s.iframeSrc === null && s.text.includes('OFFICE PLAIN TEXT BODY'), s);
  await pg.evaluate(() => { const o = document.querySelector('.np-sheet'); if (o) o.remove(); const r = document.querySelector('.readsheet'); if (r) r.remove(); state.current = null; state.queue = []; });
}

// ---------- C1 non-office control ----------
await paintLanding(FIX.saint);
{
  const s = await pageState();
  check('C1 non-office ext track page unchanged: descText stands, no iframe, no widget header', s.page && s.text.includes(FIX.saint.descText) && s.iframeSrc === null && !s.text.includes('Liturgy of the Hours'), s);
}

await b.close();
server.close();
console.log('harness-v675: ' + ok + ' ok, ' + bad + ' bad');
process.exit(bad ? 1 : 0);
