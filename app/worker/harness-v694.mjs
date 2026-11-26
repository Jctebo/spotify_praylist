// harness-v694.mjs — v694: daily rows stand NOT AVAILABLE
// until the day's own episode lands (no fallback).
//
// Modeled on harness-v677.mjs: playwright-core Chromium,
// the REAL built Worker bundle served locally, the API
// stubbed in-page, ORA_WT fail-on-old support (base = the
// v693 tree). Legs A, B, F MUST FAIL on the pre-v694 tree.
//
// Fixtures (Improvement D — production shapes, sources
// named in Plan §2.6):
//  - Saint series: app/worker/v666-fixtures/
//    production-heads.json `saint` capture (live capture
//    2026-11-25; entries {key, title, publishedMs, url} in
//    the form "11/25 - St. Catherine of Alexandria"). The
//    morning list is that capture as-is (headed by 11/25);
//    the landed list adds ONE entry in the capture's exact
//    shape, title "11/26 - St. John Berchmans" (the real
//    2026-11-26 episode title, from the 13:34Z snapshot
//    rebuild named in Plan §1), publishedMs on 2026-11-26
//    Chicago (the capture's own 08:00Z pattern + 1 day).
//  - Mass leg: app/tests/fixtures-v656/catholictv.json
//    (the standing production capture), trimmed by title
//    date — real entries only.
//  - Day payload in harness-v677's __mkDay shape: the
//    saint item {kind:'daily', key:'saint-of-the-day'} and
//    a {kind:'massdaily', key:'catholictv'} item standing
//    in Morning.
// Presented dates: 2026-11-26 (legs A–C, G) · 2026-11-25
// (legs D–E) · 2026-11-24 (leg F).
//
// Run: node app/worker/harness-v694.mjs
//      ORA_WT=/path/to/old-tree node /path/to/harness-v694.mjs
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
const HEADS = JSON.parse(readFileSync(path.join(HERE, 'v666-fixtures', 'production-heads.json'), 'utf8'));
const SAINT_CAPTURE = HEADS.saint;
const BERCHMANS = { key: '7f1c6940-26a0-4e26-b694-000000000026', title: '11/26 - St. John Berchmans', publishedMs: 1795680000000, url: 'https://www.buzzsprout.com/2216056/episodes/13179879-11-26-st-john-berchmans.mp3' };
function saintPayload(entries) {
  return { ok: true, kind: 'rss', series: 'saint-of-the-day', title: 'The Saint of The Day Podcast', available: true, showImageUrl: 'https://example.invalid/saint-show.jpg',
    entries: entries.map((e) => ({ key: e.key, title: e.title, publishedMs: e.publishedMs, url: e.url, durationS: 900, listened: false, positionS: 0 })) };
}
const SAINT_MORNING = saintPayload(SAINT_CAPTURE);
const SAINT_LANDED = saintPayload([BERCHMANS].concat(SAINT_CAPTURE));
check('F saint fixture: the capture is headed by "11/25 - St. Catherine of Alexandria"; the landed list adds the real "11/26 - St. John Berchmans" entry in the capture shape',
  SAINT_CAPTURE[0].title === '11/25 - St. Catherine of Alexandria' && SAINT_LANDED.entries[0].title === '11/26 - St. John Berchmans',
  { head: SAINT_CAPTURE[0].title, landed: SAINT_LANDED.entries[0].title });
const CTV0 = JSON.parse(readFileSync(path.join(APP, 'tests', 'fixtures-v656', 'catholictv.json'), 'utf8'));
const CTV_BEFORE24 = JSON.parse(JSON.stringify(CTV0));
CTV_BEFORE24.videos = CTV0.videos.filter((v) => !String(v.title).includes('November 24, 2026'));
check('F catholictv trim: entries title-dated before 2026-11-24 stand; the Nov 24 Mass (yt:D-CPXkxCLRM) stands in the full capture',
  CTV_BEFORE24.videos.length > 0 && !CTV_BEFORE24.videos.some((v) => v.id === 'D-CPXkxCLRM') && CTV0.videos.some((v) => v.id === 'D-CPXkxCLRM'),
  { trimmed: CTV_BEFORE24.videos.length, full: CTV0.videos.length });

// ---------- build + serve the real bundle ----------
const TMP = mkdtempSync(tmpdir() + '/v694harness-');
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
async function newWorld() {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => console.log('PAGEERROR ' + String(e).slice(0, 300)));
  await pg.addInitScript(({ saint, ctv }) => {
    window.__pod = { saint, ctv };
    window.__draws = {};
    window.__mkDay = (date) => ({
      ok: true, date, presentedDay: date, dateLabel: date,
      blocks: ['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'].map((bl) => ({ block: bl, label: bl, caption: '', spotifyUrl: null, tracks: [], trackCount: 0 })),
      additions: [], readingsSeat: null, episodes: [], intros: {}, introTexts: {},
      profile: { key: 'harness694', contents: { Morning: [{ kind: 'daily', key: 'saint-of-the-day' }, { kind: 'massdaily', key: 'catholictv' }] } },
    });
    const resp = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
    window.fetch = (url, opts) => {
      const u = String(url);
      if (u.includes('/api/player/podcasts?series=saint-of-the-day')) return resp(window.__pod.saint);
      if (u.includes('/api/player/podcasts?series=catholictv')) return resp(window.__pod.ctv);
      if (u.includes('/api/player/track-draws')) {
        let body = {};
        try { body = JSON.parse((opts && opts.body) || '{}'); } catch (e) {}
        const draws = {};
        (body.keys || []).forEach((k) => { if (!window.__draws[k]) window.__draws[k] = 'INTENTION·' + k; draws[k] = { text: window.__draws[k] }; });
        return resp({ ok: true, date: body.date, draws });
      }
      if (u.includes('/api/player/podcasts/mark')) return resp({ ok: true });
      if (u.includes('/api/player/podcasts/position')) return resp({ ok: true });
      return new Promise(() => {});
    };
  }, { saint: SAINT_MORNING, ctv: CTV0 });
  await pg.goto('http://127.0.0.1:' + PORT + '/');
  await pg.waitForTimeout(1500);
  return pg;
}
async function build(pg, date) {
  await pg.evaluate((d) => {
    const day = window.__mkDay(d);
    state.dayPayload = day;
    buildDayFromPayload(day);
  }, date);
  await pg.waitForTimeout(800);
}
async function rows(pg) {
  return pg.evaluate(() => {
    const day = state.dayPayload;
    state.rebuildGuard642 = false;
    const descs = extRebuildDescs(day) || state.dayDescs || [];
    const out = { all: [], morningCount: 0 };
    descs.forEach((d) => {
      if (!d) return;
      if ((d.block || d._block) === 'Morning') out.morningCount++;
      if (d.daily666) out[d.dailySeries] = { episodeId: d.episodeId, available: !!d.available, listened: !!d.listened, stale: !!d.stale, title: d.title, url: d.url || null, html: trackCard(d) };
      if (d.mass688) out['mass:' + d.massSeries] = { episodeId: d.episodeId, available: !!d.available, listened: !!d.listened, stale: !!d.stale, title: d.title, url: d.url || null, html: trackCard(d) };
    });
    out.all = descs.map((d) => ({ episodeId: d.episodeId, title: d.title }));
    return out;
  });
}
const settledStore = (pg, key) => pg.evaluate((k) => localStorage.getItem(k), key);

// ---------- legs A–C: the morning, the landing, the counts ----------
const pg = await newWorld();
await pg.evaluate((ctv) => { window.__pod.ctv = ctv; }, CTV_BEFORE24);
await build(pg, '2026-11-26');
let r = await rows(pg);
const saintA = r['saint-of-the-day'];
check('A(i) morning, no 11/26 entry: the composed saint descriptor stands available:false, daily666, title = the series title',
  !!saintA && saintA.available === false && saintA.title === 'The Saint of The Day Podcast', saintA);
check('A(ii) its trackCard paints "Not available today" and contains NO "11/25", NO "St. Catherine of Alexandria", NO warning text',
  !!saintA && saintA.html.includes('Not available today') && !saintA.html.includes('11/25') && !saintA.html.includes('St. Catherine of Alexandria') && !saintA.html.includes('has not updated yet'), saintA && saintA.html.slice(0, 300));
check('A(ii) the not-available card carries nothing tappable (no data-playkey, no data-rowmenu)',
  !!saintA && !saintA.html.includes('data-playkey') && !saintA.html.includes('data-rowmenu'), saintA && saintA.html.slice(0, 300));
const storeA = await settledStore(pg, 'opn-daily-settled-v1');
check('A(iii) the settle store holds NO record for (2026-11-26, saint job) — nothing settled',
  !storeA || !storeA.includes('2026-11-26'), storeA);
check('A(iv) the row stands in the composed list at its contents position (Morning holds the saint placeholder + the catholictv placeholder, saint first)',
  r.morningCount === 2 && !!saintA && r.all.length >= 2, { morningCount: r.morningCount, all: r.all });

// Leg C — count + Play in the not-available state.
const legC = await pg.evaluate(() => {
  const day = state.dayPayload;
  state.rebuildGuard642 = false;
  const descs = extRebuildDescs(day) || [];
  const ph = descs.find((d) => d.daily666 && d.dailySeries === 'saint-of-the-day');
  const ordinary = { episodeId: 'ord-694', kind: 'podcast', seriesKey: 'ord-694', podSeries: 'ord', title: 'Ordinary Row', url: 'https://example.invalid/ord.mp3', available: true, block: 'Morning', durationS: 60, listened: false };
  const counts = opnCounts615([ph, ordinary]);
  const queue = discQueue618([ph, ordinary]);
  const fromPh = sectionQueueFrom([ph, ordinary], descCardKey(ph));
  const onlyQueue = discQueue618([ph]);
  state.queue = []; state.current = null;
  startQueue([]);
  return { counts, queueIds: queue.map((d) => d.episodeId), fromPh, onlyQueueLen: onlyQueue.length, queueLen: state.queue.length, current: state.current };
});
check('C(i) opnCounts615 counts the placeholder in NEITHER total nor unplayed (the ordinary row alone tallies)',
  legC.counts.total === 1 && legC.counts.unplayed === 1, legC.counts);
check('C(ii) discQueue618 for the block returns only the ordinary row', JSON.stringify(legC.queueIds) === JSON.stringify(['ord-694']), legC.queueIds);
check('C(iii) sectionQueueFrom on the placeholder card key returns []', Array.isArray(legC.fromPh) && legC.fromPh.length === 0, legC.fromPh);
check('C(iv) a block whose ONLY row is the placeholder: discQueue618 returns [] and startQueue([]) leaves state.queue empty and state.current null',
  legC.onlyQueueLen === 0 && legC.queueLen === 0 && legC.current === null, legC);

// Leg B — the landing.
await pg.evaluate((landed) => { window.__pod.saint = landed; }, SAINT_LANDED);
await build(pg, '2026-11-26');
r = await rows(pg);
const saintB = r['saint-of-the-day'];
check('B(i) after the landing compose: the row = the 11/26 episode (fixture key, stale:false, available with its url)',
  !!saintB && saintB.episodeId === BERCHMANS.key && saintB.stale === false && saintB.available === true && saintB.url === BERCHMANS.url, saintB);
const storeB = await settledStore(pg, 'opn-daily-settled-v1');
check('B(ii) the settle store now holds the (2026-11-26, saint job) record with stale:false and the 11/26 episodeId',
  !!storeB && storeB.includes('2026-11-26') && storeB.includes(BERCHMANS.key) && storeB.includes('"stale":false'), storeB);
check('B(iii) the landed row paints the episode title and no not-available line',
  !!saintB && saintB.html.includes('11/26 - St. John Berchmans') && !saintB.html.includes('Not available today'), saintB && saintB.html.slice(0, 300));
await pg.context().close();

// ---------- legs D–E: a real settle is final; marks stay on their own day ----------
const pg2 = await newWorld();
await build(pg2, '2026-11-25');
r = await rows(pg2);
const saintD = r['saint-of-the-day'];
const key25 = SAINT_CAPTURE[0].key;
check('D(i) presented 2026-11-25 with the 11/25 episode present: it settles stale:false',
  !!saintD && saintD.episodeId === key25 && saintD.stale === false && saintD.available === true, saintD);
const titleD = saintD && saintD.title, urlD = saintD && saintD.url;
await pg2.evaluate((alt) => { window.__pod.saint = alt; }, saintPayload(SAINT_CAPTURE.map((e) => e.key === key25 ? Object.assign({}, e, { title: '11/25 - St. Catherine of Alexandria (Alt Edition)', url: 'https://example.invalid/alt-1125.mp3' }) : e)));
await build(pg2, '2026-11-25');
r = await rows(pg2);
check('D(ii) after the dress swap + rebuild: the row still = the settled 11/25 episode with its settled dress (title + url unmoved)',
  !!r['saint-of-the-day'] && r['saint-of-the-day'].episodeId === key25 && r['saint-of-the-day'].title === titleD && r['saint-of-the-day'].url === urlD,
  { settled: { titleD, urlD }, now: r['saint-of-the-day'] });
await pg2.evaluate((orig) => { window.__pod.saint = orig; }, SAINT_MORNING);
await pg2.evaluate((k) => { writePodMarkQuiet(k, 'saint-of-the-day', 'harness-v694'); }, key25);
await pg2.waitForTimeout(200);
await build(pg2, '2026-11-25');
r = await rows(pg2);
check('E(i) the completion mark + rebuild: the 11/25 row stands listened:true',
  !!r['saint-of-the-day'] && r['saint-of-the-day'].episodeId === key25 && r['saint-of-the-day'].listened === true, r['saint-of-the-day']);
await build(pg2, '2026-11-26');
r = await rows(pg2);
check('E(ii) the date turns to 2026-11-26 (11/25-headed payload): the not-available row carries listened:false and no played dot',
  !!r['saint-of-the-day'] && r['saint-of-the-day'].available === false && r['saint-of-the-day'].listened === false && !r['saint-of-the-day'].html.includes('played-dot on'), r['saint-of-the-day']);
await pg2.evaluate((landed) => { window.__pod.saint = landed; }, SAINT_LANDED);
await build(pg2, '2026-11-26');
r = await rows(pg2);
check('E(iii) after the landed swap + compose: the 11/26 row stands listened:false (the 11/25 mark never paints on it)',
  !!r['saint-of-the-day'] && r['saint-of-the-day'].episodeId === BERCHMANS.key && r['saint-of-the-day'].listened === false, r['saint-of-the-day']);
await build(pg2, '2026-11-25');
r = await rows(pg2);
check('E(iv) a rebuild of presented 2026-11-25 still shows the 11/25 row marked',
  !!r['saint-of-the-day'] && r['saint-of-the-day'].episodeId === key25 && r['saint-of-the-day'].listened === true, r['saint-of-the-day']);
await pg2.context().close();

// ---------- leg F: the Mass leg ----------
const pg3 = await newWorld();
await pg3.evaluate((ctv) => { window.__pod.ctv = ctv; }, CTV_BEFORE24);
await build(pg3, '2026-11-24');
r = await rows(pg3);
const massF = r['mass:catholictv'];
check('F(i) catholictv trimmed to before 2026-11-24, presented 2026-11-24: the composed descriptor stands available:false with the series title',
  !!massF && massF.available === false && massF.title === 'Catholic TV Mass', massF);
check('F(i) its HTML paints "Not available today" (video branch form), contains NO earlier video id/title and NO warning text',
  !!massF && massF.html.includes('Not available today') && !massF.html.includes('wpOyueDj_eY') && !massF.html.includes('November 23, 2026') && !massF.html.includes('has not updated yet'), massF && massF.html.slice(0, 300));
const mStoreF = await settledStore(pg3, 'opn-mass-settled-v1');
check('F(ii) opn-mass-settled-v1 holds no record for 2026-11-24', !mStoreF || !mStoreF.includes('2026-11-24'), mStoreF);
await pg3.evaluate((ctv) => { window.__pod.ctv = ctv; }, CTV0);
await build(pg3, '2026-11-24');
r = await rows(pg3);
const mStoreF2 = await settledStore(pg3, 'opn-mass-settled-v1');
check('F(iii) the payload gains the real Nov 24 Mass + recompose: the row resolves yt:D-CPXkxCLRM stale:false and the mass settle is written',
  !!r['mass:catholictv'] && r['mass:catholictv'].episodeId === 'yt:D-CPXkxCLRM' && r['mass:catholictv'].stale === false && !!mStoreF2 && mStoreF2.includes('2026-11-24') && mStoreF2.includes('yt:D-CPXkxCLRM'),
  { row: r['mass:catholictv'], store: mStoreF2 });
await pg3.context().close();

// ---------- leg G: the migration ----------
async function seededWorld() {
  const pgx = await newWorld();
  await pgx.evaluate(({ key, url }) => {
    const desc = { episodeId: key, kind: 'podcast', seriesKey: key, podSeries: 'saint-of-the-day', title: '11/25 - St. Catherine of Alexandria', url, available: true, block: 'Morning', source: 'The Saint of The Day Podcast', durationS: 900, listened: false, podPositionS: null, imageUrl: null, descText: null, spotifyUrl: null, stale: true, daily666: true, dailySeries: 'saint-of-the-day' };
    const store = { '2026-11-26': { 'Morning:saint-of-the-day': { episodeId: key, stale: true, desc } } };
    localStorage.setItem('opn-daily-settled-v1', JSON.stringify(store));
    state.dailySettled677 = null; // the next read re-parses the seeded store
  }, { key: SAINT_CAPTURE[0].key, url: SAINT_CAPTURE[0].url });
  return pgx;
}
const pg4 = await seededWorld();
await pg4.evaluate((landed) => { window.__pod.saint = landed; }, SAINT_LANDED);
await build(pg4, '2026-11-26');
r = await rows(pg4);
const storeG = await settledStore(pg4, 'opn-daily-settled-v1');
check('G(i) seeded stale:true record + landed payload: the compose paints the 11/26 episode (the seeded record ignored) and the store record reads stale:false with the 11/26 episodeId',
  !!r['saint-of-the-day'] && r['saint-of-the-day'].episodeId === BERCHMANS.key && !!storeG && storeG.includes(BERCHMANS.key) && storeG.includes('"stale":false') && !storeG.includes('"stale":true'),
  { row: r['saint-of-the-day'], store: storeG });
await pg4.context().close();
const pg5 = await seededWorld();
await build(pg5, '2026-11-26');
r = await rows(pg5);
check('G(ii) seeded stale:true record + 11/25-headed payload only: the row stands not-available — the seeded yesterday desc paints NOWHERE in the composed list or its HTML',
  !!r['saint-of-the-day'] && r['saint-of-the-day'].available === false && !r.all.some((d) => String(d.title).includes('St. Catherine of Alexandria')) && !r['saint-of-the-day'].html.includes('St. Catherine'),
  { row: r['saint-of-the-day'], all: r.all });
await pg5.context().close();

await b.close();
server.close();
console.log('harness-v694: ' + ok + ' ok, ' + bad + ' bad');
process.exit(bad ? 1 : 0);
