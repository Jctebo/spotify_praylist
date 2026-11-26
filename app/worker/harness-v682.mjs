// harness-v682.mjs — v682: the section card count changes
// on expansion (Plan §2.5).
//
// Modeled on harness-v678.mjs: playwright-core Chromium,
// the real Worker bundle built with esbuild from source
// and served locally, the API stubbed in-page, ORA_WT
// selecting the tree for the fail-on-old run (base = the
// Plan commit 3951246, the pre-fix tree).
//
// Fixture (Improvement D — Plan §2.3, production shapes):
// presented day 2026-11-26 (a Thursday), Morning block:
//  1 Invitatory — ext slot ext-invitatory via the courier
//    leg (settleMeta → extDownload), present before paint.
//  2 Morning Offering (Extended) — own row morning-prayer
//    as a day-payload track, present, unplayed.
//  3 Morning Prayer — Divine Office — ext LABELED slot
//    ext-morning-prayer via settleMetaLabeled650; its
//    Divine Office side's bytes are HELD BACK by the stub
//    until the leg releases them, so at first head paint
//    the slot stands downloading ⇒ its descriptor stands
//    available:false ⇒ NOT counted (the Plan's differing
//    row). The Sing the Hours side's routes hang whole.
//  4 Daily Mass Reading Podcast for November 26, 2026 —
//    readings-shape podcast descriptor, listened:false.
//  5 Daily Rosary — Luminous Mysteries (Thursday) — own
//    row daily-rosary as a payload track, unplayed.
//  6 Marian Antiphon — Angelus — own row
//    marian-antiphon-angelus as a payload track, PLAYED
//    in the played store on the presented date.
// Plus a one-track Midday block (Angelus) for the L4
// accordion leg. The day is driven through the REAL
// resolveExternals(day, settingsOverride) with the seed
// settings rows for the two ext slots (OPN_SEED_SOURCES,
// client.ts:2771) — the settle under test is the
// production settle closure, not a reproduction.
// The track-draws read hangs in the stub: in production
// every standing descriptor's draw key (the unavailable
// Morning Prayer descriptor's included) is asked at the
// first build, so no draw response lands at the settle
// moment to repaint the view and mask the defect.
//
// Legs (Plan §2.5):
//  L1 closed == expanded at paint, no expansion — the ext
//     settle is released after the head paint; the closed
//     [data-p615count="Morning"] must read 5 at once.
//     MUST FAIL on the pre-fix tree (reads 4 there).
//  L2 a mark landing while the card stands closed updates
//     the closed count at once (5→4, unmark→5) through the
//     standing writePlayed seam.
//  L3 a late-settling readings-shape row joins the closed
//     count without expansion (+1), through that settler's
//     own statements (extRebuildDescs + paintPrayersView,
//     client.ts:20913/21024), and stands at its seat
//     (before the Rosary) on expansion.
//  L4 regressions: (i) the v659 accordion on the Praylist
//     heads; (ii) v678 Favorites — folder counts/disc
//     classes byte-identical across an ext settle, and a
//     Favorites mark still live.
//
// Run: node app/worker/harness-v682.mjs
//      ORA_WT=/path/to/pre-fix-tree node /path/to/harness-v682.mjs
let chromium;
try { ({ chromium } = await import('playwright-core')); }
catch (e) { ({ chromium } = await import(process.env.HOME + '/workspace/.tools/pwtest/node_modules/playwright-core/index.mjs')); }
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = process.env.ORA_WT ? path.resolve(process.env.ORA_WT) : path.resolve(HERE, '..', '..');
const W = path.join(WT, 'app/worker');
const APP = path.join(WT, 'app');
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const DATE = '2026-11-26';

let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok   ' + name); }
  else { bad++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 400) : '')); }
}

// ---------- fixtures ----------
const BIBLE = JSON.parse(readFileSync(path.join(APP, 'tests', 'fixtures-v603', 'bible-folded.json'), 'utf8'));
const byDay = (n) => BIBLE.entries.find((e) => e.day === n);
const E329 = byDay(329), E330 = byDay(330);
check('F bible-folded fixture: Day 329 + Day 330 stand (the v678 Favorites fixture source)', !!E329 && !!E330, { d329: E329 && E329.title, d330: E330 && E330.title });
const BIAY_PAYLOAD = { ok: true, series: 'bible-in-a-year', kind: 'rss', title: 'Bible in a Year', showImageUrl: null, currentKey: E330.key,
  entries: [Object.assign({}, E329, { listened: true }), Object.assign({}, E330, { listened: false })] };
const BOOK_GROUPS = [{ category: 'Harness Prayers', prayers: [1, 2, 3].map((n) => ({ slug: 'hp' + n, title: 'Harness Prayer ' + n, body: 'Body ' + n, audio: { en: 300 } })) }];
const FAV_STARRED = [
  { k: 'podcast', id: E329.key, series: 'bible-in-a-year', title: (E329.label + ': ' + E329.title), durationS: E329.durationS, url: E329.url, date: '', imageUrl: '' },
  { k: 'podcast', id: E330.key, series: 'bible-in-a-year', title: (E330.label + ': ' + E330.title), durationS: E330.durationS, url: E330.url, date: '', imageUrl: '' },
  { k: 'episode', id: 'fav-ep-nov', title: 'Novena Episode Track', block: 'Novenas', durationS: 240, url: 'https://example.invalid/nov.mp3', date: DATE },
];
const EP_DESC = { episodeId: 'fav-ep-nov', kind: 'episode', title: 'Novena Episode Track', url: 'https://example.invalid/nov.mp3', streamUrl: 'https://example.invalid/nov.mp3', available: true, block: 'Novenas', durationS: 240 };
const COURIER_SLOTS = [
  { slotId: 'ext-invitatory', state: 'present', title: 'Invitatory', streamUrl: 'https://fixture.local/invitatory.mp3', durationSec: 200, sizeBytes: 10, source: 'Divine Office' },
  { slotId: 'ext-morning-prayer', state: 'present', title: 'Morning Prayer', streamUrl: 'https://fixture.local/do-mp.mp3', durationSec: 1500, sizeBytes: 10, source: 'Divine Office', backup: { title: 'Morning Prayer - Sing the Hours', streamUrl: 'https://fixture.local/sth-mp.mp3', source: 'Sing the Hours', durationSec: 1400 } },
];
const SETTINGS = { version: 99, sources: [
  { sourceKey: 'do-invitatory', family: 'external', slotId: 'ext-invitatory', role: 'primary', enabled: 1, block: 'Morning', sortOrder: 1, dayRule: 'daily' },
  { sourceKey: 'do-morning-prayer', family: 'external', slotId: 'ext-morning-prayer', role: 'primary', enabled: 1, block: 'Morning', sortOrder: 3, dayRule: 'daily' },
  { sourceKey: 'sth-lauds', family: 'external', slotId: 'ext-morning-prayer', role: 'fallback', enabled: 1, block: 'Morning', sortOrder: 3, dayRule: 'fallback-only' },
] };
const READINGS_TRACK = { episodeId: 'readings-2026-11-26', title: 'Daily Mass Reading Podcast for November 26, 2026', kind: 'podcast', podSeries: 'daily-readings', seriesKey: 'readings-2026-11-26', listened: false, available: true, streamUrl: 'https://fixture.local/readings.mp3', url: 'https://fixture.local/readings.mp3', durationS: 600 };

// ---------- build + serve the real bundle ----------
const TMP = mkdtempSync(tmpdir() + '/v682harness-');
execFileSync(process.env.HOME + '/workspace/.tools/wrangler-env/node_modules/.bin/esbuild',
  [path.join(W, 'src/index.ts'), '--bundle', '--format=cjs', '--platform=node', '--outfile=' + TMP + '/index.cjs'], { stdio: 'pipe' });
const _mod = await import(TMP + '/index.cjs');
const WORKER = _mod.default?.default || _mod.default;
const ENV = { DB: { prepare: () => ({ bind: function () { return this; }, first: async () => null, all: async () => ({ results: [] }), run: async () => ({}) }), batch: async () => [] }, AGENT_TOKEN: 't', LOCAL_DEV: '1' };
const SHELL = await (await WORKER.fetch(new Request('https://app.local/'), ENV)).text();
const APPJS = await (await WORKER.fetch(new Request('https://app.local/app.js'), ENV)).text();
const CSS = await (await WORKER.fetch(new Request('https://app.local/styles.css'), ENV)).text();
const SWJS = await (await WORKER.fetch(new Request('https://app.local/sw.js'), ENV)).text();
check('F the served service worker carries a pin', /ora-pro-nobis-v68[0-9]-1/.test(SWJS), 'pin not in served /sw.js');
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/app.js')) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(APPJS); }
  if (req.url.startsWith('/styles.css')) { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(CSS); }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(SHELL);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

// ---------- world ----------
const b = await chromium.launch({ executablePath: EXE });
async function newWorld() {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => console.log('PAGEERROR ' + String(e).slice(0, 300)));
  await pg.addInitScript(({ biay, groups }) => {
    window.__biay = biay; window.__groups = groups;
    const resp = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)), blob: () => Promise.resolve(new Blob(['x'], { type: 'audio/mpeg' })) });
    window.__releaseCourier = null; window.__releaseMP = null;
    window.__courierP = new Promise((res) => { window.__releaseCourier = (payload) => res(resp(payload)); });
    window.__mpP = new Promise((res) => { window.__releaseMP = () => res(resp({})); });
    window.fetch = (url, opts) => {
      const u = String(url);
      if (u.includes('/api/prayer/starred') && opts && opts.method === 'PUT') { let sent = []; try { sent = JSON.parse(opts.body || '{}').starred || []; } catch (e) {} return resp({ ok: true, starred: sent }); }
      if (u.includes('/api/player/externals/live')) return window.__courierP;
      if (u.includes('fixture.local/do-mp.mp3')) return window.__mpP;
      if (u.includes('fixture.local/invitatory.mp3')) return resp({});
      if (u.includes('fixture.local/')) return new Promise(() => {});
      if (u.includes('/api/player/externals/audio')) return new Promise(() => {});
      if (u.includes('intentions.xml')) return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('<rss></rss>'), json: () => Promise.resolve({}), blob: () => Promise.resolve(new Blob([''])) });
      if (u.includes('/api/prayer/starred')) return resp({ ok: true, starred: [] });
      if (u.includes('/api/player/track-draws')) return new Promise(() => {});
      const m = u.match(/\/api\/player\/podcasts\?series=([^&]+)/);
      if (m) { const sk = decodeURIComponent(m[1]); if (sk === 'bible-in-a-year') return resp(window.__biay); return resp({ ok: true, series: sk, kind: 'rss', title: sk, showImageUrl: null, entries: [], currentKey: null }); }
      if (u.includes('/api/prayer/book/favorites')) return resp({ ok: true, favorites: ['hp1', 'hp2', 'hp3'] });
      if (u.includes('/api/prayer/book')) return resp({ ok: true, groups: window.__groups });
      if (u.includes('/api/')) return resp({ ok: true });
      return new Promise(() => {});
    };
  }, { biay: BIAY_PAYLOAD, groups: BOOK_GROUPS });
  await pg.goto('http://127.0.0.1:' + PORT + '/');
  await pg.waitForTimeout(1500);
  return pg;
}
async function setupDay(pg, withReadings) {
  await pg.evaluate(({ DATE, SETTINGS, READINGS_TRACK, withReadings }) => {
    const pt = (episodeId, title) => ({ episodeId, title, available: true, streamUrl: 'https://fixture.local/' + episodeId + '.mp3', url: 'https://fixture.local/' + episodeId + '.mp3', durationS: 300 });
    const tracks = [pt('morning-prayer', 'Morning Offering (Extended)')];
    if (withReadings) tracks.push(READINGS_TRACK);
    tracks.push(pt('daily-rosary', 'Daily Rosary — Luminous Mysteries'));
    tracks.push(pt('marian-antiphon-angelus', 'Marian Antiphon — Angelus'));
    const day = {
      date: DATE, presentedDay: DATE, dateLabel: DATE, readingsSeat: null, additions: [], episodes: [], intros: {}, introTexts: {}, profile: null,
      blocks: [
        { block: 'Morning', label: 'Morning', tracks },
        { block: 'Midday', label: 'Midday', tracks: [{ episodeId: 'midday-angelus', title: 'Angelus', available: true, streamUrl: 'https://fixture.local/midday-angelus.mp3', url: 'https://fixture.local/midday-angelus.mp3', durationS: 180 }] },
      ],
    };
    state.tab = 'prayers';
    state.prayersView = { kind: 'home' };
    state.presentedDay = DATE;
    state.dayPayload = day;
    state.playedCache = {}; state.starred = []; state.bookFavs = []; state.trackDraws = {}; state.readTracks = {};
    state.queue = []; state.current = null;
    writePlayedQuiet('marian-antiphon-angelus', DATE, 'marked', 'Morning', 0, null);
    window.__day682 = day;
    resolveExternals(day, SETTINGS);
  }, { DATE, SETTINGS, READINGS_TRACK, withReadings });
}
const closedCount = (pg) => pg.evaluate(() => { const el = document.querySelector('[data-p615count="Morning"]'); return el ? el.textContent : null; });
const slotStates = (pg) => pg.evaluate(() => { const o = {}; for (const k in state.extSlots) o[k] = state.extSlots[k].state; return o; });
async function tapHead(pg, block) {
  const done = await pg.evaluate((bl) => { const el = document.querySelector('[data-p609sethead="' + bl + '"]'); if (!el) return false; el.click(); return true; }, block);
  await pg.waitForTimeout(350);
  return done;
}
const headState = (pg, block) => pg.evaluate((bl) => {
  const head = document.querySelector('[data-p609sethead="' + bl + '"]');
  const card = document.querySelector('[data-p659card="' + bl + '"]');
  return { toggle: head && head.querySelector('.p659toggle') ? head.querySelector('.p659toggle').textContent : null, open: !!(card && card.querySelector('.p659body')) };
}, block);

// ---------- World A: L1 + L2 + L4(i) ----------
const pgA = await newWorld();
await setupDay(pgA, true);
await pgA.evaluate((slots) => window.__releaseCourier({ ok: true, slots }), COURIER_SLOTS);
await pgA.waitForFunction(() => state.extSlots['ext-invitatory'] && state.extSlots['ext-invitatory'].state === 'present', null, { timeout: 8000 }).catch(() => {});
await pgA.waitForTimeout(400);
{
  const st = await slotStates(pgA);
  check('L1 fixture: invitatory settled present, Morning Prayer still downloading at first paint', st['ext-invitatory'] === 'present' && st['ext-morning-prayer'] === 'downloading', st);
}
await pgA.evaluate(() => { opnFoldSession604 = {}; paintPrayersView(state.dayPayload); });
await pgA.waitForTimeout(300);
check('L1 fixture: the closed head paints 4 (Morning Prayer unavailable ⇒ uncounted)', (await closedCount(pgA)) === '4', await closedCount(pgA));
check('L1 fixture: the Morning card stands closed at paint', (await headState(pgA, 'Morning')).open === false, await headState(pgA, 'Morning'));
await pgA.evaluate(() => window.__releaseMP());
await pgA.waitForFunction(() => state.extSlots['ext-morning-prayer'] && state.extSlots['ext-morning-prayer'].state === 'present', null, { timeout: 8000 }).catch(() => {});
await pgA.waitForTimeout(400);
check('L1 the ext settle lands (slot present, descriptor available in state.dayDescs)', await pgA.evaluate(() => { const d = (state.dayDescs || []).find((x) => x.episodeId === 'ext-morning-prayer'); return !!d && d.available === true; }));
check('L1 closed count == 5 at once, with NO expansion tap (MUST FAIL on the pre-fix tree)', (await closedCount(pgA)) === '5', await closedCount(pgA));
check('L1 the Morning card still stands closed after the settle', (await headState(pgA, 'Morning')).open === false, await headState(pgA, 'Morning'));
check('L1 head tap opens Morning', await tapHead(pgA, 'Morning'));
{
  const exp = await pgA.evaluate(() => {
    const cnt = document.querySelector('[data-p615count="Morning"]');
    const body = document.querySelector('[data-p659card="Morning"] .p659body');
    const cards = body ? [...body.querySelectorAll('[data-card]')].map((c) => c.getAttribute('data-card')) : [];
    return { count: cnt ? cnt.textContent : null, cards, text: body ? body.textContent : '' };
  });
  check('L1 expanded head still reads 5 — closed == expanded', exp.count === '5', exp);
  check('L1 the expansion stands 6 rows, Morning Prayer among them', exp.cards.length === 6 && exp.cards.includes('ext-morning-prayer') && exp.text.includes('Daily Rosary') && exp.text.includes('Daily Mass Reading Podcast for November 26, 2026'), exp.cards);
}
// L4(i) accordion, on this world's heads.
{
  check('L4(i) opening Midday closes Morning (accordion)', await tapHead(pgA, 'Midday'));
  const a = await headState(pgA, 'Morning'), mid = await headState(pgA, 'Midday');
  check('L4(i) Morning closed (+), Midday open (−)', a.open === false && a.toggle === '+' && mid.open === true && mid.toggle === '−', { a, mid });
  check('L4(i) tapping the open Midday head closes it (none open)', await tapHead(pgA, 'Midday'));
  const mid2 = await headState(pgA, 'Midday');
  check('L4(i) Midday closed, toggle +', mid2.open === false && mid2.toggle === '+', mid2);
}
// L2 — marks while closed.
{
  await pgA.evaluate((DATE) => writePlayed('daily-rosary', DATE, 'marked', 'Morning', 0, null), DATE);
  await pgA.waitForTimeout(300);
  check('L2 a mark landing while Morning stands closed drops the closed count 5 → 4 at once', (await closedCount(pgA)) === '4', await closedCount(pgA));
  await pgA.evaluate((DATE) => writePlayed('daily-rosary', DATE, null, 'Morning', 0, null), DATE);
  await pgA.waitForTimeout(300);
  check('L2 the unmark restores the closed count to 5 at once', (await closedCount(pgA)) === '5', await closedCount(pgA));
}
await pgA.context().close();

// ---------- World B: L3 (readings-shape late settle) ----------
const pgB = await newWorld();
await setupDay(pgB, false);
await pgB.evaluate((slots) => window.__releaseCourier({ ok: true, slots }), COURIER_SLOTS);
await pgB.evaluate(() => window.__releaseMP());
await pgB.waitForFunction(() => state.extSlots['ext-morning-prayer'] && state.extSlots['ext-morning-prayer'].state === 'present', null, { timeout: 8000 }).catch(() => {});
await pgB.waitForTimeout(400);
await pgB.evaluate(() => { opnFoldSession604 = {}; paintPrayersView(state.dayPayload); });
await pgB.waitForTimeout(300);
check('L3 fixture: with the readings row held back, the closed count reads 4', (await closedCount(pgB)) === '4', await closedCount(pgB));
await pgB.evaluate(({ READINGS_TRACK }) => {
  // The readings settler's own settle statements (client.ts:20913/21024):
  // the seat's descriptor joins the payload fold, then a whole rebuild + repaint.
  const day = window.__day682;
  day.blocks[0].tracks.splice(1, 0, READINGS_TRACK);
  extRebuildDescs(day);
  paintPrayersView(day);
}, { READINGS_TRACK });
await pgB.waitForTimeout(300);
check('L3 the late-settling readings row joins the closed count (+1 → 5) with no expansion', (await closedCount(pgB)) === '5', await closedCount(pgB));
check('L3 head tap opens Morning', await tapHead(pgB, 'Morning'));
{
  const order = await pgB.evaluate(() => {
    const body = document.querySelector('[data-p659card="Morning"] .p659body');
    return body ? [...body.querySelectorAll('[data-card]')].map((c) => c.getAttribute('data-card')) : [];
  });
  check('L3 on expansion the readings row stands at its seat, before the Rosary', order.includes('readings-2026-11-26') && order.indexOf('readings-2026-11-26') < order.indexOf('daily-rosary'), order);
}
await pgB.context().close();

// ---------- World C: L4(ii) Favorites across an ext settle ----------
const pgC = await newWorld();
await pgC.evaluate(({ starred, bookFavs, epDesc, date, groups }) => {
  localStorage.removeItem('opn-favcollapse-v576');
  state.tab = 'prayers';
  state.prayersView = { kind: 'favorites' };
  state.presentedDay = date;
  state.dayPayload = { date, presentedDay: date, blocks: [], additions: [], episodes: [], intros: {}, introTexts: {}, profile: null };
  state.dayDescs = [epDesc];
  state.starred = starred;
  state.bookFavs = bookFavs;
  state.book = { groups };
  state.playedCache = {}; state.readTracks = {}; state.trackDraws = {};
  state.queue = []; state.queueIdx = -1; state.current = null; state.queueFrom = null;
  paintFavoritesPage(state.dayPayload);
}, { starred: FAV_STARRED, bookFavs: ['hp1', 'hp2', 'hp3'], epDesc: EP_DESC, date: DATE, groups: BOOK_GROUPS });
await pgC.waitForTimeout(900); // the favPodWarm settle repaints
const favSnap = (pg) => pg.evaluate(() => {
  const grab = (fid) => {
    const cnt = document.querySelector('[data-favcount678="' + fid + '"]');
    const head = cnt ? cnt.closest('[data-favhead678]') : null;
    const disc = head ? head.querySelector('[data-favdisc678]') : null;
    return { count: cnt ? cnt.textContent : null, discAll: disc ? disc.classList.contains('all') : null };
  };
  return { catechesis: grab('catechesis'), prayers: grab('prayers') };
});
{
  const s0 = await favSnap(pgC);
  check('L4(ii) fixture: Favorites heads stand — Catechesis 2 (listened Day 329 excluded), Prayers 3', s0.catechesis.count === '2' && s0.prayers.count === '3', s0);
  // A Favorites mark still updates its folder count at once (the v678 L5 seam).
  const tapped = await pgC.evaluate(() => {
    const head = document.querySelector('[data-favhead678="catechesis"]');
    if (head) { const card = head.closest('[data-favcard678]'); if (card && !card.querySelector('.p659body')) head.click(); }
    const btn = document.querySelector('[data-markplayed="fav-ep-nov"]');
    if (!btn) return false; btn.click(); return true;
  });
  await pgC.waitForTimeout(400);
  const sMark = await favSnap(pgC);
  check('L4(ii) a Favorites mark tap stands and its folder count drops 2 → 1 at once', tapped && sMark.catechesis.count === '1', sMark);
  await pgC.evaluate(() => { const btn = document.querySelector('[data-markplayed="fav-ep-nov"]'); if (btn) btn.click(); });
  await pgC.waitForTimeout(400);
  const sBack = await favSnap(pgC);
  check('L4(ii) the unmark restores the folder count to 2', sBack.catechesis.count === '2', sBack);
  const before = JSON.stringify(await favSnap(pgC));
  // Fire a real ext settle (invitatory, Morning) through resolveExternals
  // while the Favorites page stands — the v682 refreshPlayedChrome call
  // recomputes the Favorites heads from their own store in the same pass.
  // This setup preserves the Favorites store (setupDay resets it) and
  // carries fav-ep-nov in the settle day's episodes, so its descriptor
  // re-stands through extRebuildDescs exactly as it stood.
  await pgC.evaluate(({ DATE, SETTINGS, EP_DESC }) => {
    const day = {
      date: DATE, presentedDay: DATE, dateLabel: DATE, readingsSeat: null, additions: [], intros: {}, introTexts: {}, profile: null,
      episodes: [Object.assign({}, EP_DESC)],
      blocks: [{ block: 'Morning', label: 'Morning', tracks: [{ episodeId: 'morning-prayer', title: 'Morning Offering (Extended)', available: true, streamUrl: 'https://fixture.local/morning-prayer.mp3', url: 'https://fixture.local/morning-prayer.mp3', durationS: 300 }] }],
    };
    state.dayPayload = day;
    window.__day682 = day;
    resolveExternals(day, SETTINGS);
  }, { DATE, SETTINGS, EP_DESC });
  await pgC.evaluate((slots) => window.__releaseCourier({ ok: true, slots }), COURIER_SLOTS);
  await pgC.waitForFunction(() => state.extSlots['ext-invitatory'] && state.extSlots['ext-invitatory'].state === 'present', null, { timeout: 8000 }).catch(() => {});
  await pgC.waitForTimeout(500);
  const after = JSON.stringify(await favSnap(pgC));
  check('L4(ii) Favorites counts/disc classes byte-identical across the ext settle (idempotent recompute)', before === after, { before, after });
}
await pgC.context().close();

await b.close();
server.close();
console.log('harness-v682: ' + ok + ' ok, ' + bad + ' bad');
process.exit(bad ? 1 : 0);
