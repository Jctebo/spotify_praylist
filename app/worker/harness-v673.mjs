// harness-v673.mjs — v673: a played-state change repaints
// the row and the card head at once.
//
// Chromium (playwright-core) harness, modeled on
// harness-v668.mjs: the REAL built Worker bundle (esbuild
// from source) served locally, the API stubbed, the day
// painted by the standing v659 paint (opnSetHtml609 over
// state.dayDescs), real taps on the row ⋮ menu, and DOM
// assertions in the same tick as the act — no collapse /
// reload anywhere.
//
// Fixture (Improvement D — production shape, mirroring
// John's 2026-11-25 video, pin ora-pro-nobis-v672-1):
//  - the daily-dynamic descriptor is resolveDailyDynamic666's
//    own shape for the Bible in a Year entry that stands in
//    app/tests/fixtures-v603/bible-folded.json (the captured
//    production payload): key 'biy:day-322', label 'Day 322',
//    title 'The Ascension', listened false, currentKey
//    'biy:day-322' — resolved descriptor: episodeId =
//    seriesKey = 'biy:day-322', podSeries 'bible-in-a-year',
//    title 'Day 322: The Ascension', block 'Afternoon',
//    daily666 true.
//  - the SAME episode stands a second time in state.dayDescs
//    as the day-episodes expansion copy (block '' → the
//    'Episodes' run), appended after the blocks walk — the
//    duplicate standing extRebuildDescs produces
//    (client.ts: the (day.episodes||[]) pass after the block
//    walk).
//  - two sibling rows stand in the Afternoon card, already
//    played through the day store — so the Afternoon head
//    count starts at 1 (the dynamic row alone unplayed),
//    exactly the video's count-to-0 shape.
//
// Legs (Plan §3, with the 16:12 CT addendum — the count is a
// first-class symptom, §2.4): L1–L4 each carry THREE
// SEPARATE assertions, named separately in the tally:
//  (i) the row dot · (ii) the Afternoon head
//  [data-p615count] text · (iii) the disc state.
//  L1 menu mark · L2 menu unmark · L3 completion
//  (markCompleted, the 'ended' seam) · L4 drain
//  (drainNativeCompletions with a stub bridge record) ·
//  L5 no regression (day-track · non-dynamic podcast ·
//  homily menu marks).
// Fail-on-old: run against a pre-fix checkout (base a189ef0)
// — L1's dot and L3/L4's dot + count + disc lag until a full
// repaint (gate b). The harness takes the tree from
// ORA_WT (default: this worktree) so the same file runs on
// both trees.
//
// Run: node app/worker/harness-v673.mjs
//      ORA_WT=/tmp/v673-old node /path/to/harness-v673.mjs
let chromium;
try { ({ chromium } = await import('playwright-core')); }
catch (e) { ({ chromium } = await import(process.env.HOME + '/workspace/.tools/pwtest/node_modules/playwright-core/index.mjs')); }
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = process.env.ORA_WT ? path.resolve(process.env.ORA_WT) : path.resolve(HERE, '..', '..');
const W = path.join(WT, 'app/worker');
const APP = path.join(WT, 'app');
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';

let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok   ' + name); }
  else { bad++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 400) : '')); }
}

// ---------- fixture grounding (Improvement D) ----------
const BIBLE = JSON.parse(readFileSync(path.join(APP, 'tests/fixtures-v603/bible-folded.json'), 'utf8'));
const E322 = BIBLE.entries.filter((e) => e.key === 'biy:day-322')[0];
check('F bible-folded fixture carries the real Day 322 entry (The Ascension, unlistened, currentKey)', !!E322 && E322.title === 'The Ascension' && E322.listened === false && BIBLE.currentKey === 'biy:day-322', E322 && { key: E322.key, title: E322.title, listened: E322.listened });

// ---------- build + serve the real bundle ----------
const TMP = mkdtempSync(tmpdir() + '/v673harness-');
execFileSync(process.env.HOME + '/workspace/.tools/wrangler-env/node_modules/.bin/esbuild',
  [path.join(W, 'src/index.ts'), '--bundle', '--format=cjs', '--platform=node', '--outfile=' + TMP + '/index.cjs'], { stdio: 'pipe' });
const _mod = await import(TMP + '/index.cjs');
const WORKER = _mod.default?.default || _mod.default;
const ENV = { DB: { prepare: () => ({ bind: function () { return this; }, first: async () => null, all: async () => ({ results: [] }), run: async () => ({}) }), batch: async () => [] }, AGENT_TOKEN: 't', LOCAL_DEV: '1' };
const SHELL = await (await WORKER.fetch(new Request('https://app.local/'), ENV)).text();
const APPJS = await (await WORKER.fetch(new Request('https://app.local/app.js'), ENV)).text();
const CSS = await (await WORKER.fetch(new Request('https://app.local/styles.css'), ENV)).text();
const SWJS = await (await WORKER.fetch(new Request('https://app.local/sw.js'), ENV)).text();
check('F the served service worker carries this tree\u2019s pin', SWJS.includes('ora-pro-nobis-v679-1') || SWJS.includes('ora-pro-nobis-v673-1') || SWJS.includes('ora-pro-nobis-v672-1'), 'pin not in served /sw.js');
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/app.js')) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(APPJS); }
  if (req.url.startsWith('/styles.css')) { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(CSS); }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(SHELL);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const b = await chromium.launch({ executablePath: EXE });
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
await pg.addInitScript(({ BIBLE }) => {
  const resp = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });
  window.fetch = (url) => {
    const u = String(url);
    const m = u.match(/\/api\/player\/podcasts\?series=([^&]+)/);
    if (m) { const sk = decodeURIComponent(m[1]); if (sk === 'bible-in-a-year') return resp(BIBLE); return resp({ series: sk, kind: 'rss', entries: [], currentKey: null }); }
    if (u.includes('/api/player/podcasts')) return resp({ ok: true });
    return new Promise(() => {});
  };
}, { BIBLE });
await pg.goto('http://127.0.0.1:' + PORT + '/');
await pg.waitForTimeout(1500);

// ---------- the composed-day fixture, painted by opnSetHtml609 ----------
async function setupDay() {
  await pg.evaluate((e322) => {
    const DATE = '2026-11-18';
    localStorage.setItem('opn-homilies-v551', JSON.stringify([{ id: 'homily-1', played: false, state: 'ready', chunkCount: 1 }]));
    localStorage.removeItem('opn-played-v344');
    const dyn = {
      episodeId: e322.key, kind: 'podcast', seriesKey: e322.key, podSeries: 'bible-in-a-year',
      title: (e322.label ? e322.label + ': ' : '') + e322.title, url: e322.url, streamUrl: e322.url,
      available: true, block: 'Afternoon', source: 'Bible in a Year', durationS: e322.durationS || 0,
      listened: !!e322.listened, podPositionS: null, imageUrl: null, descText: null,
      stale: false, daily666: true, dailySeries: 'bible-in-a-year',
    };
    const sib1 = { episodeId: 'aft-prayer-1', title: 'Afternoon Prayer One', url: 'https://example.invalid/a1.mp3', streamUrl: 'https://example.invalid/a1.mp3', available: true, block: 'Afternoon', durationS: 300 };
    const sib2 = { episodeId: 'aft-prayer-2', title: 'Afternoon Prayer Two', url: 'https://example.invalid/a2.mp3', streamUrl: 'https://example.invalid/a2.mp3', available: true, block: 'Afternoon', durationS: 300 };
    const exp = Object.assign({}, dyn, { block: '' }); // the day-episodes expansion copy — same episode, second standing
    const dayTrack = { episodeId: 'morning-track-1', title: 'Morning Track', url: 'https://example.invalid/m1.mp3', streamUrl: 'https://example.invalid/m1.mp3', available: true, block: 'Morning', durationS: 300 };
    const ndPod = { episodeId: 'reads-ep-1', kind: 'podcast', seriesKey: 'reads-ep-1', podSeries: 'daily-readings', title: 'Daily Readings Episode', url: 'https://example.invalid/r1.mp3', streamUrl: 'https://example.invalid/r1.mp3', available: true, block: 'Morning', durationS: 300, listened: false, podPositionS: null };
    const hom = { episodeId: 'homily-1', kind: 'homily', homilyId: 'homily-1', title: 'Homily One', url: 'https://example.invalid/h1.mp3', streamUrl: 'https://example.invalid/h1.mp3', available: true, block: 'Morning', durationS: 300 };
    state.dayDescs = [dayTrack, ndPod, hom, dyn, sib1, sib2, exp];
    state.composed642 = state.dayDescs;
    state.composedDate642 = DATE;
    state.presentedDay = DATE;
    state.dayPayload = { date: DATE, presentedDay: DATE, dayPositions: { 'biy:day-322': 42 }, blocks: [{ block: 'Morning' }, { block: 'Afternoon' }] };
    state.prayersView = { kind: 'home' };
    state.queue = []; state.current = null; state.previewQueue = null;
    state.playedCache = {}; state.starred = []; state.trackDraws = {}; state.readTracks = {};
    refreshRepeatIds();
    // the two Afternoon siblings stand already played (the day store) — the dynamic row is the card's one unplayed track
    writePlayedQuiet('aft-prayer-1', DATE, 'marked', 'Afternoon', 0, null);
    writePlayedQuiet('aft-prayer-2', DATE, 'marked', 'Afternoon', 0, null);
    opnFoldSession604 = { Morning: true, Afternoon: true, Episodes: true };
    view.innerHTML = opnSetHtml609(state.dayPayload);
    wireRowActs(view);
    wirePlayed(view);
  }, E322);
  await pg.waitForTimeout(300);
}
function chromeState() {
  return pg.evaluate(() => {
    const dots = [...document.querySelectorAll('[data-poddot="biy:day-322"]')];
    const cnt = document.querySelector('[data-p615count="Afternoon"]');
    const disc = document.querySelector('[data-p615disc="Afternoon"]');
    return {
      dotSpans: dots.length,
      dotsOn: dots.filter((s) => s.classList.contains('on')).length,
      count: cnt ? cnt.textContent : null,
      discAll: disc ? disc.classList.contains('all') : null,
      copiesListened: (state.dayDescs || []).filter((d) => d.episodeId === 'biy:day-322').map((d) => !!d.listened),
    };
  });
}
async function tapRowMenu(cardKey) {
  const handle = await pg.evaluateHandle((key) => document.querySelector('[data-rowmenu="' + key + '"]'), cardKey);
  const el = handle.asElement();
  if (!el) return false;
  await el.click();
  await pg.waitForTimeout(700); // openDayRowMenu's cache read lands, then the menu builds
  return true;
}
async function tapMenuItem(label) {
  const handle = await pg.evaluateHandle((lab) => {
    const rows = [...document.querySelectorAll('.anchmenu .menurow')];
    return rows.find((r) => r.textContent.trim() === lab) || null;
  }, label);
  const el = handle.asElement();
  if (!el) return false;
  await el.click();
  await pg.waitForTimeout(300);
  return true;
}

// ---------- L1 menu mark · L2 menu unmark ----------
await setupDay();
{
  const s0 = await chromeState();
  check('L0 fixture paints: 2 dot spans for the duplicated episode, both off · Afternoon count 1 · disc not all', s0.dotSpans === 2 && s0.dotsOn === 0 && s0.count === '1' && s0.discAll === false, s0);
  check('L1 ⋮ tap opens the Day 322 row menu', await tapRowMenu('biy:day-322'));
  check('L1 "Mark as read" item tapped', await tapMenuItem('Mark as read'));
  const s = await chromeState();
  check('L1 (i) dot: every standing dot span for the episode carries on, immediately', s.dotSpans === 2 && s.dotsOn === 2, s);
  check('L1 (ii) count: Afternoon head [data-p615count] reads 0, immediately (its own assertion, §2.4)', s.count === '0', s);
  check('L1 (iii) disc: the Afternoon head disc carries all, immediately', s.discAll === true, s);
  check('L2 ⋮ tap reopens the Day 322 row menu', await tapRowMenu('biy:day-322'));
  check('L2 "Mark as unread" item tapped (the label flipped — the write landed)', await tapMenuItem('Mark as unread'));
  const s2 = await chromeState();
  check('L2 (i) dot: every dot span loses on, immediately', s2.dotsOn === 0, s2);
  check('L2 (ii) count: Afternoon head [data-p615count] reads 1 again, immediately (its own assertion, §2.4)', s2.count === '1', s2);
  check('L2 (iii) disc: the Afternoon head disc loses all, immediately', s2.discAll === false, s2);
}

// ---------- L3 completion (the 'ended' seam) ----------
await setupDay();
{
  await pg.evaluate(() => { markCompleted(state.dayDescs.filter((d) => d.daily666)[0]); });
  await pg.waitForTimeout(300);
  const s = await chromeState();
  check('L3 (i) dot: completion paints every dot span on, immediately', s.dotSpans === 2 && s.dotsOn === 2, s);
  check('L3 (ii) count: Afternoon head [data-p615count] reads 0 after completion, immediately (its own assertion, §2.4)', s.count === '0', s);
  check('L3 (iii) disc: the Afternoon head disc carries all after completion, immediately', s.discAll === true, s);
}

// ---------- L4 drain (drainNativeCompletions, stub bridge) ----------
await setupDay();
{
  await pg.evaluate(() => {
    window.Capacitor = { Plugins: { OraDayBridge: { takeNativeCompletions: () => Promise.resolve({ records: [{ episodeId: 'biy:day-322', block: 'Afternoon', date: '2026-11-18' }] }) } } };
    drainNativeCompletions();
  });
  await pg.waitForTimeout(600);
  const s = await chromeState();
  check('L4 (0) drain flips listened on EVERY day copy of the episode', s.copiesListened.length === 2 && s.copiesListened.every(Boolean), s);
  check('L4 (i) dot: the drain paints every dot span on, immediately', s.dotSpans === 2 && s.dotsOn === 2, s);
  check('L4 (ii) count: Afternoon head [data-p615count] reads 0 after the drain, immediately (its own assertion, §2.4)', s.count === '0', s);
  check('L4 (iii) disc: the Afternoon head disc carries all after the drain, immediately', s.discAll === true, s);
  const dp = await pg.evaluate(() => !!(state.dayPayload && state.dayPayload.dayPositions && 'biy:day-322' in state.dayPayload.dayPositions));
  check('L4 (iv) dayPositions ruling: the delete stands down for the podcast kind (the fold entry remains; podPosSlotDrop owns the podcast position slot)', dp === true, dp);
}

// ---------- L5 no regression ----------
await setupDay();
{
  check('L5 day-track ⋮ tap opens its menu', await tapRowMenu('morning-track-1'));
  check('L5 day-track "Mark as read" tapped', await tapMenuItem('Mark as read'));
  const dt = await pg.evaluate(() => { const btn = document.querySelector('[data-markplayed="morning-track-1"]'); return btn ? btn.classList.contains('on') : null; });
  check('L5 day-track row mark paints its dot on immediately (standing day-store paint)', dt === true, dt);
  check('L5 non-dynamic podcast ⋮ tap opens its menu', await tapRowMenu('reads-ep-1'));
  check('L5 non-dynamic podcast "Mark as read" tapped', await tapMenuItem('Mark as read'));
  const np = await pg.evaluate(() => { const sp = document.querySelector('[data-poddot="reads-ep-1"]'); return sp ? sp.classList.contains('on') : null; });
  check('L5 non-dynamic podcast row mark paints its dot on immediately', np === true, np);
  check('L5 homily ⋮ tap opens its menu', await tapRowMenu('homily-1'));
  check('L5 homily "Mark as read" tapped', await tapMenuItem('Mark as read'));
  const hm = await pg.evaluate(() => { const e = homilyEntry('homily-1'); return e ? !!e.played : null; });
  check('L5 homily row mark stands as before (the homily-store played flag set by the menu act)', hm === true, hm);
}

await b.close();
server.close();
console.log('harness-v673: ' + ok + ' ok, ' + bad + ' bad');
process.exit(bad ? 1 : 0);
