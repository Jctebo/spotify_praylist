// harness-v679.mjs — v679: played state stands everywhere
// at once (Plan §2.4).
//
// Modeled on harness-v677.mjs / harness-v673.mjs:
// playwright-core Chromium, the REAL built Worker bundle
// (esbuild from source) served locally, the API stubbed
// in-page (the stub's mark/unmark endpoints flip its
// server-side payload store, as the production routes flip
// podcast_listens, and every fetch serves a fresh JSON copy,
// as the network does), ORA_WT selecting the tree.
//
// Fixtures (Improvement D — production shapes, sources named):
//  - Bible in a Year: app/tests/fixtures-v603/bible-folded.json
//    — the production folded sequence (372 entries keyed
//    biy:day-N): Day 329 "The Ethiopian Eunuch" (presented
//    2026-11-25) and Day 330 "Saul's Conversion" stand in the
//    one list. The stub enriches the served copy with the
//    podPayload fields the capture omits (available · total ·
//    listenedCount · title — index.ts podPayload stamps them).
//  - Catholic Saints (video): app/worker/v666-fixtures/
//    production-heads.json `catholicsaints` capture — real
//    video ids/titles/publishedMs; the Nov 25, 2026 entry is
//    "November 25: St. Catherine of Alexandria, Virgin &
//    Martyr" (id v9MO_5NAZWQ).
//  - Day payload: presented 2026-11-25 (Chicago), Afternoon
//    contents carry a FIXED episode pin
//    (episode: bible-in-a-year|biy:day-329), a second pin
//    (biy:day-330, the unrelated control), and the daily
//    dynamic item (daily: bible-in-a-year) — three standing
//    Praylist copies, two of one episode, one of another.
//
// Legs (Plan §2.4):
//  1 play from the series page (web 'ended' seam,
//    markCompleted on the queue's current) → every Praylist
//    copy of biy:day-329 read at once (state copies + the
//    Afternoon head count), no reload.
//  1v the video arm: a catholicsaints video watched to its
//    natural end on its series page (markPodVideoEnded663)
//    → the Praylist daily video copy stands read.
//  2 play from the Praylist (markCompleted on the day copy)
//    → the series payload entry stands read (regression).
//  3 daily-dynamic episode completed → the settled daily
//    row stands read after a full rebuild (v677 regression).
//  4 the unrelated episode's copies (biy:day-330) do not
//    flip in legs 1–3.
//  5 Mark as read from the episodes-page row menu, real
//    taps: (a) Catechesis hosting (tab 'podcasts') — row
//    paint + reopened menu label flip; (b) Pray-homed
//    hosting (podOrigin 'prayers', tab 'prayers') — the
//    same assertions; (c) Mark as unread reverses (b).
//    The Praylist copy stands read after the act in both
//    hostings (podSyncQueueListened).
//  6 the same mark act on a Favorites row: (a) the series
//    standing open (openFavRowMenu → openPodRowMenu →
//    podToggleMark) — the Favorites podmark face flips;
//    (b) the mirror menu (series not open → favPodToggle)
//    — the face flips.
//
// Run: node app/worker/harness-v679.mjs
//      ORA_WT=/path/to/other-tree node /path/to/harness-v679.mjs
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

let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok   ' + name); }
  else { bad++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 400) : '')); }
}

// ---------- fixtures ----------
const BIBLE = JSON.parse(readFileSync(path.join(APP, 'tests', 'fixtures-v603', 'bible-folded.json'), 'utf8'));
const HEADS = JSON.parse(readFileSync(path.join(HERE, 'v666-fixtures', 'production-heads.json'), 'utf8'));
const E329 = BIBLE.entries.find((e) => e.key === 'biy:day-329');
const E330 = BIBLE.entries.find((e) => e.key === 'biy:day-330');
const SAINT25 = (HEADS.catholicsaints || []).filter((v) => v.title.indexOf('November 25:') === 0)[0];
check('F BIAY folded fixture: Day 329 + Day 330 stand, unlistened', !!E329 && !!E330 && E329.title === 'The Ethiopian Eunuch' && E330.title === "Saul's Conversion" && !E329.listened && !E330.listened,
  { d329: E329 && E329.title, d330: E330 && E330.title });
check('F catholicsaints capture: the November 25 video stands (id + title + publishedMs)', !!SAINT25 && !!SAINT25.id && typeof SAINT25.publishedMs === 'number',
  SAINT25 && { id: SAINT25.id, title: SAINT25.title });

// ---------- build + serve the real bundle ----------
const TMP = mkdtempSync(tmpdir() + '/v679harness-');
execFileSync(process.env.HOME + '/workspace/.tools/wrangler-env/node_modules/.bin/esbuild',
  [path.join(W, 'src/index.ts'), '--bundle', '--format=cjs', '--platform=node', '--outfile=' + TMP + '/index.cjs'], { stdio: 'pipe' });
const _mod = await import(TMP + '/index.cjs');
const WORKER = _mod.default?.default || _mod.default;
const ENV = { DB: { prepare: () => ({ bind: function () { return this; }, first: async () => null, all: async () => ({ results: [] }), run: async () => ({}) }), batch: async () => [] }, AGENT_TOKEN: 't', LOCAL_DEV: '1' };
const SHELL = await (await WORKER.fetch(new Request('https://app.local/'), ENV)).text();
const APPJS = await (await WORKER.fetch(new Request('https://app.local/app.js'), ENV)).text();
const CSS = await (await WORKER.fetch(new Request('https://app.local/styles.css'), ENV)).text();
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/app.js')) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(APPJS); }
  if (req.url.startsWith('/styles.css')) { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(CSS); }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(SHELL);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

// ---------- world ----------
const b = await chromium.launch({ executablePath: EXE });
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
pg.on('pageerror', (e) => console.log('PAGEERROR ' + String(e).slice(0, 200)));
await pg.addInitScript(({ BIBLE, SAINTS }) => {
  window.__srv = { biay: JSON.parse(JSON.stringify(BIBLE)) };
  window.__srv.biay.available = true; window.__srv.biay.title = 'Bible in a Year';
  window.__srv.biay.total = window.__srv.biay.entries.length;
  window.__srv.biay.listenedCount = window.__srv.biay.entries.filter((e) => e.listened).length;
  window.__srv.saints = { ok: true, kind: 'video', series: 'catholicsaints', title: 'Catholic Saints', available: true, marks: true,
    videos: SAINTS.map((v) => ({ id: v.id, title: v.title, publishedMs: v.publishedMs, dateLabel: '', imageUrl: null, listened: false })) };
  window.__mkDay = (date) => ({
    ok: true, date, presentedDay: date, dateLabel: date,
    blocks: ['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'].map((bl) => ({ block: bl, label: bl, caption: '', spotifyUrl: null, tracks: [], trackCount: 0 })),
    additions: [], readingsSeat: null, episodes: [], intros: {}, introTexts: {},
    profile: { key: 'harness679', contents: { Afternoon: [
      { kind: 'episode', key: 'bible-in-a-year|biy:day-329' },
      { kind: 'episode', key: 'bible-in-a-year|biy:day-330' },
      { kind: 'daily', key: 'bible-in-a-year' },
      { kind: 'daily', key: 'catholicsaints' },
    ] } },
  });
  const resp = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(body))), text: () => Promise.resolve('') });
  window.fetch = (url, opts) => {
    const u = String(url);
    if (u.includes('/api/player/podcasts?series=bible-in-a-year')) return resp(window.__srv.biay);
    if (u.includes('/api/player/podcasts?series=catholicsaints')) return resp(window.__srv.saints);
    if (u.includes('/api/player/podcasts/mark') || u.includes('/api/player/podcasts/unmark')) {
      let body = {}; try { body = JSON.parse((opts && opts.body) || '{}'); } catch (e) {}
      const on = u.includes('/mark') && !u.includes('/unmark');
      window.__srv.biay.entries.forEach((e) => { if (e.key === body.seqKey) e.listened = on; });
      window.__srv.saints.videos.forEach((v) => { if ('yt:' + v.id === body.seqKey) v.listened = on; });
      return resp({ ok: true });
    }
    if (u.includes('/api/player/track-draws')) {
      let body = {}; try { body = JSON.parse((opts && opts.body) || '{}'); } catch (e) {}
      const draws = {}; (body.keys || []).forEach((k) => { draws[k] = { text: 'INT-' + k }; });
      return resp({ ok: true, date: body.date, draws });
    }
    if (u.includes('/api/player/podcasts')) return resp({ ok: true });
    return new Promise(() => {});
  };
}, { BIBLE, SAINTS: HEADS.catholicsaints });
await pg.goto('http://127.0.0.1:' + PORT + '/');
await pg.waitForTimeout(1500);

async function buildDay() {
  await pg.evaluate(() => { const day = window.__mkDay('2026-11-25'); state.dayPayload = day; buildDayFromPayload(day); });
  await pg.waitForTimeout(1100);
  await pg.evaluate(() => { state.rebuildGuard642 = false; extRebuildDescs(state.dayPayload); });
}
async function copies(key) {
  return pg.evaluate((k) => (state.dayDescs || []).filter((d) => d && d.episodeId === k).map((d) => ({ block: d.block, listened: !!d.listened, ep614: !!d.episode614, daily666: !!d.daily666, kind: d.kind })), key);
}
async function afternoonCount() {
  return pg.evaluate(() => {
    state.tab = 'prayers'; state.prayersView = { kind: 'home' };
    paintPrayersView(state.dayPayload);
    const s = document.querySelector('[data-p615count="Afternoon"]');
    return s ? s.textContent : 'NO COUNT';
  });
}

await buildDay();
let c329 = await copies('biy:day-329');
check('setup: biy:day-329 stands twice on the Praylist (fixed pin + daily), both unlistened', c329.length === 2 && c329.every((d) => !d.listened), c329);
let c330 = await copies('biy:day-330');
check('setup: biy:day-330 stands once (the fixed pin), unlistened', c330.length === 1 && !c330[0].listened, c330);
const count0 = await afternoonCount();

// ---------- Leg 1: play from the series page to completion (web 'ended' seam) ----------
await pg.evaluate(() => { state.tab = 'podcasts'; return openPodSeries('bible-in-a-year'); });
await pg.waitForTimeout(700);
await pg.evaluate(() => { playPodFrom('biy:day-329'); });
await pg.waitForTimeout(300);
const curOk = await pg.evaluate(() => !!state.current && state.current.episodeId === 'biy:day-329' && state.current.kind === 'podcast' && state.current.seriesKey === 'biy:day-329' && state.current.podSeries === 'bible-in-a-year');
check('L1 the series-page play stands a podcast queue whose current carries (podSeries bible-in-a-year, seriesKey biy:day-329)', curOk);
await pg.evaluate(() => { markCompleted(state.current); });
await pg.waitForTimeout(300);
c329 = await copies('biy:day-329');
check('L1 after completion: EVERY Praylist copy of biy:day-329 stands read in state (pin + daily), no reload', c329.length === 2 && c329.every((d) => d.listened), c329);
const count1 = await afternoonCount();
check('L1 the Afternoon head count drops by the two flipped copies at once (' + count0 + ' -> ' + count1 + ')', Number(count1) === Number(count0) - 2, { count0, count1 });
c330 = await copies('biy:day-330');
check('L4 the unrelated episode biy:day-330 did NOT flip', c330.length === 1 && !c330[0].listened, c330);

// ---------- Leg 2: play from the Praylist -> the series page stands read ----------
await pg.evaluate(() => { writePodMarkQuiet; podSyncQueueListened('bible-in-a-year', 'biy:day-329', false); state.podcasts.entries.forEach((e) => { if (e.key === 'biy:day-329') e.listened = false; }); });
await pg.evaluate(() => { state.rebuildGuard642 = false; extRebuildDescs(state.dayPayload); });
c329 = await copies('biy:day-329');
check('L2 setup: the Praylist copies stand unlistened again (sync unmark)', c329.length === 2 && c329.every((d) => !d.listened), c329);
await pg.evaluate(() => {
  const d = (state.dayDescs || []).filter((x) => x.episodeId === 'biy:day-329')[0];
  markCompleted(d);
});
await pg.waitForTimeout(300);
const payloadAfterPraylistPlay = await pg.evaluate(() => state.podcasts.entries.filter((e) => e.key === 'biy:day-329').map((e) => !!e.listened));
check('L2 completion on the Praylist copy flips the open series payload entry (the series page reads read)', payloadAfterPraylistPlay.length === 1 && payloadAfterPraylistPlay[0] === true, payloadAfterPraylistPlay);

// ---------- Leg 3: daily-dynamic settled row after a full rebuild (v677 regression) ----------
await buildDay();
c329 = await copies('biy:day-329');
const dailyCopy = c329.filter((d) => d.daily666);
check('L3 after a full rebuild the daily copy of biy:day-329 still stands, read (settled identity + fresh mark)', dailyCopy.length === 1 && dailyCopy[0].listened === true, c329);

// ---------- Leg 1v: the video arm — natural end on the series page ----------
const saintCopiesBefore = await copies('yt:' + SAINT25.id);
check('L1v setup: the catholicsaints daily video copy stands on the Praylist, unlistened', saintCopiesBefore.length === 1 && !saintCopiesBefore[0].listened, saintCopiesBefore);
await pg.evaluate((vid) => {
  state.podcasts = JSON.parse(JSON.stringify(window.__srv.saints));
  podWatch = { video: state.podcasts.videos.filter((v) => v.id === vid)[0], scroll: 0 };
  markPodVideoEnded663();
}, SAINT25.id);
await pg.waitForTimeout(300);
const vidAfter = await pg.evaluate((vid) => ({
  payload: state.podcasts.videos.filter((v) => v.id === vid).map((v) => !!v.listened),
  dailyRes: state.dailyRes666 && state.dailyRes666['Afternoon:catholicsaints'] ? !!state.dailyRes666['Afternoon:catholicsaints'].listened : 'NO DAILYRES',
}), SAINT25.id);
const saintCopiesAfter = await copies('yt:' + SAINT25.id);
check('L1v the series payload video stands read after its natural end', vidAfter.payload.length === 1 && vidAfter.payload[0] === true, vidAfter);
check('L1v the Praylist daily video copy stands read at once (dailyRes666 + day copy)', vidAfter.dailyRes === true && saintCopiesAfter.length === 1 && saintCopiesAfter[0].listened === true,
  { dailyRes: vidAfter.dailyRes, copies: saintCopiesAfter });

// ---------- Leg 5: the episodes-page row menu, real taps, both hostings ----------
async function menuMarkLeg(tag, setupFn, keepOpen) {
  await pg.evaluate(() => document.querySelectorAll('.anchmenu, .menucatcher').forEach((n) => n.remove()));
  await pg.evaluate(setupFn);
  await pg.waitForTimeout(700);
  await pg.evaluate(() => { // stand biy:day-330 unlistened on the open payload + Praylist
    state.podcasts.entries.forEach((e) => { if (e.key === 'biy:day-330') e.listened = false; });
    podSyncQueueListened('bible-in-a-year', 'biy:day-330', false);
  });
  const btn = pg.locator('[data-podmenu="biy:day-330"]');
  check(tag + ' setup: the episodes-page row for biy:day-330 stands with its menu', (await btn.count()) >= 1);
  await btn.first().click();
  await pg.waitForTimeout(300);
  const items0 = await pg.evaluate(() => [...document.querySelectorAll('.anchmenu .menurow')].map((x) => x.textContent.trim()));
  check(tag + ' the menu opens carrying "Mark as listened"', items0.includes('Mark as listened'), items0);
  await pg.locator('.anchmenu .menurow', { hasText: 'Mark as listened' }).first().click();
  await pg.waitForTimeout(400);
  const after = await pg.evaluate(() => {
    const row = document.querySelector('[data-podrow="biy:day-330"]');
    const pm = row ? row.querySelector('.podmark') : null;
    return { entry: state.podcasts.entries.filter((e) => e.key === 'biy:day-330').map((e) => !!e.listened),
      podmarkOn: pm ? pm.classList.contains('on') : null, podmarkLabel: pm ? pm.getAttribute('aria-label') : null };
  });
  check(tag + ' after the tap: the entry stands read in the payload', after.entry.length === 1 && after.entry[0] === true, after);
  check(tag + ' after the tap: the ROW paints read at once (podmark on, no reopen/reload)', after.podmarkOn === true, after);
  const c330b = await copies('biy:day-330');
  check(tag + ' after the tap: the Praylist copy of biy:day-330 stands read', c330b.length === 1 && c330b[0].listened === true, c330b);
  await pg.locator('[data-podmenu="biy:day-330"]').first().click();
  await pg.waitForTimeout(300);
  const items1 = await pg.evaluate(() => [...document.querySelectorAll('.anchmenu .menurow')].map((x) => x.textContent.trim()));
  check(tag + ' the reopened menu reads "Mark as not listened" (the menu state follows the write)', items1.includes('Mark as not listened'), items1);
  if (!keepOpen) await pg.evaluate(() => document.querySelectorAll('.anchmenu, .menucatcher').forEach((n) => n.remove()));
  return items1;
}
await menuMarkLeg('L5a Catechesis-homed episodes page:', () => { state.tab = 'podcasts'; return openPodSeries('bible-in-a-year'); });
await menuMarkLeg('L5b Pray-homed episodes page:', () => { state.tab = 'prayers'; podOrigin = null; goSeries('bible-in-a-year'); }, true);
// L5c: unmark reverses in the Pray-homed hosting (the menu from L5b stands open)
await pg.locator('.anchmenu .menurow', { hasText: 'Mark as not listened' }).first().click();
await pg.waitForTimeout(400);
const unmarkAfter = await pg.evaluate(() => {
  const row = document.querySelector('[data-podrow="biy:day-330"]');
  const pm = row ? row.querySelector('.podmark') : null;
  return { entry: state.podcasts.entries.filter((e) => e.key === 'biy:day-330').map((e) => !!e.listened), podmarkOn: pm ? pm.classList.contains('on') : null };
});
check('L5c Mark as unread in the Pray-homed hosting: the entry stands unread', unmarkAfter.entry.length === 1 && unmarkAfter.entry[0] === false, unmarkAfter);
check('L5c Mark as unread in the Pray-homed hosting: the ROW paints unread at once', unmarkAfter.podmarkOn === false, unmarkAfter);
const c330c = await copies('biy:day-330');
check('L5c Mark as unread: the Praylist copy reverses too', c330c.length === 1 && c330c[0].listened === false, c330c);

// ---------- Leg 6: the Favorites row menu ----------
await pg.evaluate(() => {
  state.tab = 'prayers'; state.prayersView = { kind: 'favorites' };
  state.podcasts = JSON.parse(JSON.stringify(window.__srv.biay)); state.podcasts.series = 'bible-in-a-year'; state.podcasts.kind = 'sequence';
  state.podcasts.entries.forEach((e) => { if (e.key === 'biy:day-330') e.listened = false; });
  state.starred = [{ k: 'podcast', id: 'biy:day-330', series: 'bible-in-a-year', title: "Day 330: Saul's Conversion", durationS: 1259, url: 'https://example.invalid/d330.mp3' }];
  paintFavoritesPage(state.dayPayload);
});
await pg.waitForTimeout(300);
check('L6a setup: the Favorites podcast row stands with its menu', (await pg.locator('[data-favmenu]').count()) >= 1);
await pg.locator('[data-favmenu]').first().click();
await pg.waitForTimeout(400);
const favItems = await pg.evaluate(() => [...document.querySelectorAll('.anchmenu .menurow')].map((x) => x.textContent.trim()));
check('L6a the Favorites menu (series open -> openPodRowMenu) carries "Mark as listened"', favItems.includes('Mark as listened'), favItems);
await pg.locator('.anchmenu .menurow', { hasText: 'Mark as listened' }).first().click();
await pg.waitForTimeout(400);
const favAfter = await pg.evaluate(() => {
  const pm = document.querySelector('[data-favpodmark]');
  return { entry: state.podcasts.entries.filter((e) => e.key === 'biy:day-330').map((e) => !!e.listened), favPodmarkOn: pm ? pm.classList.contains('on') : null };
});
check('L6a after the tap: the entry stands read', favAfter.entry.length === 1 && favAfter.entry[0] === true, favAfter);
check('L6a after the tap: the FAVORITES row face paints read at once (podmark on)', favAfter.favPodmarkOn === true, favAfter);

await pg.evaluate(() => {
  state.podcasts = null; favPodWarmed = {}; favPodListened = {};
  state.starred = [{ k: 'podcast', id: 'biy:day-331', series: 'bible-in-a-year', title: 'Day 331: Peter and Cornelius', durationS: 1200, url: 'https://example.invalid/d331.mp3' }];
  paintFavoritesPage(state.dayPayload);
});
await pg.waitForTimeout(300);
await pg.locator('[data-favmenu]').first().click();
await pg.waitForTimeout(400);
const favItems2 = await pg.evaluate(() => [...document.querySelectorAll('.anchmenu .menurow')].map((x) => x.textContent.trim()));
check('L6b the Favorites mirror menu (series not open) carries "Mark as listened"', favItems2.includes('Mark as listened'), favItems2);
await pg.locator('.anchmenu .menurow', { hasText: 'Mark as listened' }).first().click();
await pg.waitForTimeout(400);
const favMirrorAfter = await pg.evaluate(() => {
  const pm = document.querySelector('[data-favpodmark]');
  return { favPodmarkOn: pm ? pm.classList.contains('on') : null };
});
check('L6b after the tap: the Favorites row face paints read at once (mirror route)', favMirrorAfter.favPodmarkOn === true, favMirrorAfter);

await b.close();
server.close();
console.log('harness-v679: ' + ok + ' ok, ' + bad + ' bad');
process.exit(bad ? 1 : 0);
