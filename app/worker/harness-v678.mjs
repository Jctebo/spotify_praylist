// harness-v678.mjs — v678: Favorites in Praylist dress
// (Plan §2.10).
//
// Modeled on harness-v677.mjs: playwright-core Chromium,
// the real Worker bundle built with esbuild from source
// and served locally, the API stubbed in-page, ORA_WT
// selecting the tree for the fail-on-old run (base =
// the v677 tree at 7f72a5f).
//
// Fixtures (Improvement D — production shapes, sources
// named in Plan §2.10):
//  - Favorite Podcasts: John's real four doors as
//    k:'series' entries — The AI Signal · The Counsel of
//    Trent · The Exorcist Files · Bible in a Year (titles
//    from John's 2026-11-25 screenshot + the scope report).
//  - Favorite Catechesis: podcast episode entries from
//    app/tests/fixtures-v603/bible-folded.json (Day 329
//    "The Ethiopian Eunuch" + Day 330 "Saul's Conversion"),
//    ONE standing listened:true in the series payload
//    (Day 329), plus one Novenas-block episode track whose
//    live descriptor stands in state.dayDescs (the day
//    payload for 2026-11-25, Chicago).
//  - Favorite Prayers: 3 book favorites, each prayer
//    carrying audio.en (the v573/v574 shape).
//  - One EMPTY custom folder ("Empty Shelf"); no novena
//    doors (Favorite Novenas empty by absence).
//
// Legs (Plan §2.10): L1 cards stand · L2 empty stands
// nowhere + the all-empty line verbatim · L3 accordion ·
// L4 group Play / menu acts queue exactly the group ·
// L5 played mark repaints in place · L6 head per Q4 ·
// L7 door folders under reading (i) (§2.9 amendment) ·
// L8 fail-on-old: L1, L3, L4, L6 must fail on the v677
// tree; L5's row-face half passes there, its count half
// fails; L2's line-text half fails there.
//
// F1 repair (§4 addendum): the L4 legs whose act STARTS
// playback (the Prayers disc; Catechesis Play next, whose
// playNextSet falls back to startQueue when nothing
// stands) read the queue SYNCHRONOUSLY in the same JS
// evaluation that performs the click — the fixture audio
// cannot play, so the engine auto-advances and the
// terminal clear empties the queue within ~250 ms, and
// any fixed-delay post-click read races that clear. The
// Catechesis Add to queue leg carries no such hazard
// (addToQueueSet never starts playback) and keeps its
// standing read.
//
// Run: node app/worker/harness-v678.mjs
//      ORA_WT=/path/to/v677-tree node /path/to/harness-v678.mjs
let chromium;
try { ({ chromium } = await import('playwright-core')); }
catch (e) { ({ chromium } = await import(process.env.HOME + '/workspace/.tools/pwtest/node_modules/playwright-core/index.mjs')); }
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
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
const SHOTDIR = path.join(WT, 'docs', 'releases', 'v678-screenshots');
mkdirSync(SHOTDIR, { recursive: true });

let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok   ' + name); }
  else { bad++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 400) : '')); }
}

// ---------- fixtures ----------
const BIBLE = JSON.parse(readFileSync(path.join(APP, 'tests', 'fixtures-v603', 'bible-folded.json'), 'utf8'));
const byDay = (n) => BIBLE.entries.find((e) => e.day === n);
const E329 = byDay(329), E330 = byDay(330);
check('F bible-folded fixture: Day 329 + Day 330 stand in the folded list', !!E329 && !!E330 && E329.title === 'The Ethiopian Eunuch' && E330.title === "Saul's Conversion", { d329: E329 && E329.title, d330: E330 && E330.title });
// The series payload the warm read lands: Day 329 listened, Day 330 not.
const BIAY_PAYLOAD = { ok: true, series: 'bible-in-a-year', kind: 'rss', title: 'Bible in a Year', showImageUrl: null, currentKey: E330.key,
  entries: [Object.assign({}, E329, { listened: true }), Object.assign({}, E330, { listened: false })] };
const DOORS = [
  { k: 'series', id: 'the-ai-signal', title: 'The AI Signal', sub: '', durationS: 0, imageUrl: '', block: '', url: null, date: '' },
  { k: 'series', id: 'the-counsel-of-trent', title: 'The Counsel of Trent', sub: '', durationS: 0, imageUrl: '', block: '', url: null, date: '' },
  { k: 'series', id: 'the-exorcist-files', title: 'The Exorcist Files', sub: '', durationS: 0, imageUrl: '', block: '', url: null, date: '' },
  { k: 'series', id: 'bible-in-a-year', title: 'Bible in a Year', sub: '', durationS: 0, imageUrl: '', block: '', url: null, date: '' },
];
const BOOK_GROUPS = [{ category: 'Harness Prayers', prayers: [1, 2, 3].map((n) => ({ slug: 'hp' + n, title: 'Harness Prayer ' + n, body: 'Body ' + n, audio: { en: 300 } })) }];
const DATE = '2026-11-25';
function fixtureStarred() {
  return [
    ...DOORS,
    { k: 'podcast', id: E329.key, series: 'bible-in-a-year', title: (E329.label + ': ' + E329.title), durationS: E329.durationS, url: E329.url, date: '', imageUrl: '' },
    { k: 'podcast', id: E330.key, series: 'bible-in-a-year', title: (E330.label + ': ' + E330.title), durationS: E330.durationS, url: E330.url, date: '', imageUrl: '' },
    { k: 'episode', id: 'fav-ep-nov', title: 'Novena Episode Track', block: 'Novenas', durationS: 240, url: 'https://example.invalid/nov.mp3', date: DATE },
    { k: 'folder', id: 'empty-shelf', title: 'Empty Shelf', sub: '', durationS: 0, imageUrl: '', block: '', url: null, date: '' },
  ];
}
const EP_DESC = { episodeId: 'fav-ep-nov', kind: 'episode', title: 'Novena Episode Track', url: 'https://example.invalid/nov.mp3', streamUrl: 'https://example.invalid/nov.mp3', available: true, block: 'Novenas', durationS: 240 };

// ---------- build + serve the real bundle ----------
const TMP = mkdtempSync(tmpdir() + '/v678harness-');
execFileSync(process.env.HOME + '/workspace/.tools/wrangler-env/node_modules/.bin/esbuild',
  [path.join(W, 'src/index.ts'), '--bundle', '--format=cjs', '--platform=node', '--outfile=' + TMP + '/index.cjs'], { stdio: 'pipe' });
const _mod = await import(TMP + '/index.cjs');
const WORKER = _mod.default?.default || _mod.default;
const ENV = { DB: { prepare: () => ({ bind: function () { return this; }, first: async () => null, all: async () => ({ results: [] }), run: async () => ({}) }), batch: async () => [] }, AGENT_TOKEN: 't', LOCAL_DEV: '1' };
const SHELL = await (await WORKER.fetch(new Request('https://app.local/'), ENV)).text();
const APPJS = await (await WORKER.fetch(new Request('https://app.local/app.js'), ENV)).text();
const CSS = await (await WORKER.fetch(new Request('https://app.local/styles.css'), ENV)).text();
const SWJS = await (await WORKER.fetch(new Request('https://app.local/sw.js'), ENV)).text();
check('F the served service worker carries a v677/v678 pin', /ora-pro-nobis-v67[78]-1/.test(SWJS), 'pin not in served /sw.js');
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
    const resp = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });
    window.fetch = (url) => {
      const u = String(url);
      const m = u.match(/\/api\/player\/podcasts\?series=([^&]+)/);
      if (m) {
        const sk = decodeURIComponent(m[1]);
        if (sk === 'bible-in-a-year' && !u.includes('novenas')) return resp(window.__biay);
        return resp({ ok: true, series: sk, kind: 'rss', title: sk, showImageUrl: null, entries: [], currentKey: null });
      }
      if (u.includes('/api/prayer/book/favorites')) return resp({ ok: true, favorites: ['hp1', 'hp2', 'hp3'] });
      if (u.includes('/api/prayer/book')) return resp({ ok: true, groups: window.__groups });
      if (u.includes('/api/player/podcasts')) return resp({ ok: true });
      return new Promise(() => {});
    };
  }, { biay: BIAY_PAYLOAD, groups: BOOK_GROUPS });
  await pg.goto('http://127.0.0.1:' + PORT + '/');
  await pg.waitForTimeout(1500);
  return pg;
}
async function setup(pg, starred, bookFavs) {
  await pg.evaluate(({ starred, bookFavs, epDesc, date }) => {
    localStorage.removeItem('opn-favcollapse-v576');
    state.tab = 'prayers';
    state.prayersView = { kind: 'favorites' };
    state.presentedDay = date;
    state.dayPayload = { date, presentedDay: date, blocks: [], additions: [], episodes: [], intros: {}, introTexts: {}, profile: null };
    state.dayDescs = [epDesc];
    state.starred = starred;
    state.bookFavs = bookFavs;
    state.book = { groups: window.__groups };
    state.playedCache = {}; state.readTracks = {}; state.trackDraws = {};
    state.queue = []; state.queueIdx = -1; state.current = null; state.queueFrom = null;
    paintFavoritesPage(state.dayPayload);
  }, { starred, bookFavs, epDesc: EP_DESC, date: DATE });
  await pg.waitForTimeout(900); // the favPodWarm settle repaints
}
const headInfo = (pg, fid) => pg.evaluate((fid) => {
  const head = document.querySelector('[data-favhead678="' + fid + '"]');
  if (!head) return null;
  const card = head.closest('[data-favcard678]');
  return {
    mark: !!head.querySelector('.blockcover.sm svg.p659mark'),
    name: (head.querySelector('h2.sectionhead') || {}).textContent || null,
    count: head.querySelector('[data-favcount678]') ? head.querySelector('[data-favcount678]').textContent : null,
    disc: !!head.querySelector('[data-favdisc678]'),
    menu: !!head.querySelector('[data-favsecmenu678]'),
    toggle: head.querySelector('.p659toggle') ? head.querySelector('.p659toggle').textContent : null,
    open: !!(card && card.querySelector('.p659body')),
    badAttrs: ['data-p609sethead', 'data-p645secmenu', 'data-p615count', 'data-p615disc'].filter((a) => head.hasAttribute(a)),
  };
}, fid);
async function clickSel(pg, sel) {
  const done = await pg.evaluate((s) => { const el = document.querySelector(s); if (!el) return false; el.click(); return true; }, sel);
  await pg.waitForTimeout(350);
  return done;
}
async function clickMenuItem(pg, label) {
  const done = await pg.evaluate((lab) => {
    const row = [...document.querySelectorAll('.anchmenu .menurow')].find((r) => r.textContent.trim() === lab);
    if (!row) return false; row.click(); return true;
  }, label);
  await pg.waitForTimeout(350);
  return done;
}
const queueIds = (pg) => pg.evaluate(() => ({ ids: (state.queue || []).map((d) => d.episodeId), from: state.queueFrom }));
// F1 repair: click + queue capture in ONE evaluation — the queue is
// read synchronously with the click, before any engine advance can
// clear it. Returns { clicked, ids, from }.
async function clickAndCaptureQueue(pg, sel) {
  return pg.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return { clicked: false, ids: [], from: null };
    el.click();
    return { clicked: true, ids: (state.queue || []).map((d) => d.episodeId), from: state.queueFrom };
  }, sel);
}
async function clickMenuItemAndCaptureQueue(pg, label) {
  return pg.evaluate((lab) => {
    const row = [...document.querySelectorAll('.anchmenu .menurow')].find((r) => r.textContent.trim() === lab);
    if (!row) return { clicked: false, ids: [], from: null };
    row.click();
    return { clicked: true, ids: (state.queue || []).map((d) => d.episodeId), from: state.queueFrom };
  }, label);
}

// ---------- main world ----------
const pg = await newWorld();
await setup(pg, fixtureStarred(), ['hp1', 'hp2', 'hp3']);

// L1 — cards stand.
{
  const cat = await headInfo(pg, 'catechesis');
  const pra = await headInfo(pg, 'prayers');
  check('L1 Catechesis stands as a .p659card: mark · name · live count 2 (listened entry excluded) · disc · menu · toggle', !!cat && cat.mark && cat.name === 'Favorite Catechesis' && cat.count === '2' && cat.disc && cat.menu && !!cat.toggle, cat);
  check('L1 Prayers stands as a .p659card: mark · name · live count 3 · disc · menu · toggle', !!pra && pra.mark && pra.name === 'Favorite Prayers' && pra.count === '3' && pra.disc && pra.menu && !!pra.toggle, pra);
  check('L1 no folder head carries a Praylist data-p609/p645/p615 attribute', !!cat && !!pra && cat.badAttrs.length === 0 && pra.badAttrs.length === 0, { cat: cat && cat.badAttrs, pra: pra && pra.badAttrs });
  const rows = await pg.evaluate(() => {
    const body = document.querySelector('[data-favcard678="catechesis"] .p659body');
    return body ? body.textContent : null;
  });
  check('L1 the expanded Catechesis card carries the standing rows (both podcast episodes + the episode track)', !!rows && rows.includes('The Ethiopian Eunuch') && rows.includes("Saul's Conversion") && rows.includes('Novena Episode Track'), rows && rows.slice(0, 200));
}

// L2 (absence half) — empty groups stand nowhere.
{
  const absent = await pg.evaluate(() => ({
    shelf: !!document.querySelector('[data-favcard678="empty-shelf"]'),
    novenas: !!document.querySelector('[data-favcard678="novenas"]'),
    shelfText: (document.getElementById('favorites-list') || {}).textContent?.includes('Empty Shelf') || false,
  }));
  check('L2 no card/head stands for Empty Shelf or Favorite Novenas', !absent.shelf && !absent.novenas && !absent.shelfText, absent);
}

// L6 — head per Q4.
{
  const bar = await pg.evaluate(() => ({
    playall: !!document.getElementById('starred-playall'),
    barText: (document.getElementById('hdrrow2') || document.body).textContent,
    barPlaybtn: !!((document.getElementById('hdrrow2') || document.createElement('div')).querySelector('.playbtn')),
  }));
  check('L6 the bar carries Favorites and NO #starred-playall / no .playbtn in the bar host', !bar.playall && !bar.barPlaybtn && bar.barText.includes('Favorites'), { playall: bar.playall, barPlaybtn: bar.barPlaybtn });
}

await pg.screenshot({ path: path.join(SHOTDIR, '01-favorites-one-group-open.png') });

// L3 — accordion + first paint.
{
  const first = await pg.evaluate(() => [...document.querySelectorAll('[data-favcard678]')].filter((c) => c.querySelector('.p659body')).map((c) => c.getAttribute('data-favcard678')));
  check('L3 first paint: exactly one card open — the first visible (catechesis)', JSON.stringify(first) === JSON.stringify(['catechesis']), first);
  await clickSel(pg, '[data-favhead678="prayers"]');
  let opens = await pg.evaluate(() => [...document.querySelectorAll('[data-favcard678]')].filter((c) => c.querySelector('.p659body')).map((c) => c.getAttribute('data-favcard678')));
  check('L3 open Prayers → Catechesis closes', JSON.stringify(opens) === JSON.stringify(['prayers']), opens);
  await clickSel(pg, '[data-favhead678="catechesis"]');
  opens = await pg.evaluate(() => [...document.querySelectorAll('[data-favcard678]')].filter((c) => c.querySelector('.p659body')).map((c) => c.getAttribute('data-favcard678')));
  check('L3 open Catechesis → Prayers closes', JSON.stringify(opens) === JSON.stringify(['catechesis']), opens);
  await clickSel(pg, '[data-favhead678="catechesis"]');
  opens = await pg.evaluate(() => [...document.querySelectorAll('[data-favcard678]')].filter((c) => c.querySelector('.p659body')).map((c) => c.getAttribute('data-favcard678')));
  check('L3 tap the open card head → none open', opens.length === 0, opens);
  await clickSel(pg, '[data-favhead678="prayers"]');
  await pg.screenshot({ path: path.join(SHOTDIR, '02-favorites-empty-group-absent.png') });
  await clickSel(pg, '[data-favhead678="catechesis"]');
}

// L4 — group Play + menu acts.
{
  await pg.evaluate(() => { state.queue = []; state.queueIdx = -1; state.current = null; state.queueFrom = null; });
  const discCap = await clickAndCaptureQueue(pg, '[data-favdisc678="prayers"]');
  check('L4 Prayers disc tap stands', discCap.clicked);
  check('L4 Prayers disc queues exactly the Prayers unplayed set, queueFrom starred', JSON.stringify(discCap.ids) === JSON.stringify(['prayer:hp1:en', 'prayer:hp2:en', 'prayer:hp3:en']) && discCap.from === 'starred', discCap);
  let q;
  await pg.evaluate(() => { state.queue = []; state.queueIdx = -1; state.current = null; state.queueFrom = null; });
  check('L4 Catechesis menu button tap stands', await clickSel(pg, '[data-favsecmenu678="catechesis"]'));
  const labels = await pg.evaluate(() => [...document.querySelectorAll('.anchmenu .menurow')].map((r) => r.textContent.trim()));
  check('L4 Catechesis menu offers Play · Play next · Add to queue', labels.includes('Play') && labels.includes('Play next') && labels.includes('Add to queue'), labels);
  check('L4 Add to queue item tap stands', await clickMenuItem(pg, 'Add to queue'));
  q = await queueIds(pg);
  check('L4 Add to queue lands exactly the Catechesis unplayed set (listened Day 329 excluded)', JSON.stringify(q.ids.slice().sort()) === JSON.stringify([E330.key, 'fav-ep-nov'].sort()), q);
  await pg.evaluate(() => { state.queue = []; state.queueIdx = -1; state.current = null; state.queueFrom = null; });
  await clickSel(pg, '[data-favsecmenu678="catechesis"]');
  const pnCap = await clickMenuItemAndCaptureQueue(pg, 'Play next');
  check('L4 Play next item tap stands', pnCap.clicked);
  check('L4 Play next lands exactly the Catechesis unplayed set', JSON.stringify(pnCap.ids.slice().sort()) === JSON.stringify([E330.key, 'fav-ep-nov'].sort()), pnCap);
  await pg.evaluate(() => { state.queue = []; state.queueIdx = -1; state.current = null; state.queueFrom = null; });
}

// L5 — played mark repaints in place.
{
  const before = await pg.evaluate(() => {
    const card = document.querySelector('[data-card="episode:fav-ep-nov"]');
    window.__l5node = card || null;
    const cnt = document.querySelector('[data-favcount678="catechesis"]');
    return { hasCard: !!card, count: cnt ? cnt.textContent : null, open: !!document.querySelector('[data-favcard678="catechesis"] .p659body') };
  });
  check('L5 fixture: Catechesis open, episode row stands, count 2', before.hasCard && before.count === '2' && before.open, before);
  const tapped = await clickSel(pg, '[data-markplayed="fav-ep-nov"]');
  check('L5 the episode row mark tap stands', tapped);
  const after = await pg.evaluate(() => {
    const card = document.querySelector('[data-card="episode:fav-ep-nov"]');
    const btn = document.querySelector('[data-markplayed="fav-ep-nov"]');
    const cnt = document.querySelector('[data-favcount678="catechesis"]');
    return { faceOn: !!(btn && btn.classList.contains('on')), count: cnt ? cnt.textContent : null, open: !!document.querySelector('[data-favcard678="catechesis"] .p659body'), sameNode: !!card && card === window.__l5node };
  });
  check('L5 (row-face half) the row face flips on in place', after.faceOn, after);
  check('L5 (count half) the head count decrements 2 → 1 in place', after.count === '1', after);
  check('L5 the card stands open throughout and the row DOM node is the same node', after.open && after.sameNode, after);
  // Podcast leg: favPodToggle seam flips the unlistened podcast row; its face + the count follow.
  await pg.evaluate(() => { const e = (state.starred || []).find((x) => x.k === 'podcast' && x.id === 'biy:day-330'); if (e) favPodToggle(e); });
  await pg.waitForTimeout(500);
  const podAfter = await pg.evaluate(() => {
    const cnt = document.querySelector('[data-favcount678="catechesis"]');
    return { count: cnt ? cnt.textContent : null, open: !!document.querySelector('[data-favcard678="catechesis"] .p659body') };
  });
  check('L5 podcast toggle: the head count decrements 1 → 0 (favPodListenedOf seat)', podAfter.count === '0' && podAfter.open, podAfter);
}

// L7 — door folders under reading (i).
{
  const pod = await headInfo(pg, 'podcasts');
  check('L7 Favorite Podcasts head stands mark · name · toggle ONLY (no count/disc/menu attributes)', !!pod && pod.mark && pod.name === 'Favorite Podcasts' && pod.count === null && !pod.disc && !pod.menu && !!pod.toggle, pod);
  await clickSel(pg, '[data-favhead678="podcasts"]');
  const doors = await pg.evaluate(() => [...document.querySelectorAll('[data-favcard678="podcasts"] [data-favdoor]')].map((d) => d.getAttribute('data-favdoor')));
  check('L7 the four doors stand as rows in the Podcasts card', JSON.stringify(doors) === JSON.stringify(['the-ai-signal', 'the-counsel-of-trent', 'the-exorcist-files', 'bible-in-a-year']), doors);
  await pg.screenshot({ path: path.join(SHOTDIR, '03-favorites-door-card.png') });
  await clickSel(pg, '[data-favdoor="the-ai-signal"]');
  await pg.waitForTimeout(600);
  const landed = await pg.evaluate(() => ({ series: state.podcasts && state.podcasts.series, origin: typeof podOrigin !== 'undefined' ? podOrigin : null }));
  check('L7 a door tap lands on the door series page (state.podcasts.series = the-ai-signal)', landed.series === 'the-ai-signal', landed);
}
await pg.context().close();

// L2 (line half) — a second world, the store emptied whole.
const pg2 = await newWorld();
await setup(pg2, [], []);
{
  const line = await pg2.evaluate(() => (document.getElementById('favorites-list') || {}).textContent || '');
  check('L2 every group empty paints the one line verbatim', line.includes('No favorites yet — star any track to keep it here.'), line.slice(0, 200));
}
await pg2.context().close();

await b.close();
server.close();
console.log('harness-v678: ' + ok + ' ok, ' + bad + ' bad');
process.exit(bad ? 1 : 0);
