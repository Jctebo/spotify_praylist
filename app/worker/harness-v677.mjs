// harness-v677.mjs — v677: the daily row settles at the
// start of the day (Plan §2.4).
//
// Modeled on harness-v676.mjs: playwright-core Chromium,
// the REAL built Worker bundle (esbuild from source)
// served locally, the API stubbed in-page, ORA_WT
// selecting the tree for the fail-on-old run (base =
// the v676 tree at 71a489a).
//
// Fixtures (Improvement D — production shapes, sources
// named in Plan §2.4):
//  - Bible in a Year: app/tests/fixtures-v603/bible-folded.json
//    — the production folded sequence (372 entries keyed
//    biy:day-N carrying `day`): Day 329 "The Ethiopian
//    Eunuch" (presented 2026-11-25, doy 329) AND Day 330
//    "Saul's Conversion" (tomorrow) stand in the same
//    list from leg 1, plus Day 323 "Pentecost" (the field
//    screenshot's identity) as a standing control entry.
//  - Daily Readings: the RSS payload built from
//    app/worker/v666-fixtures/production-heads.json
//    `readings` capture — "Daily Mass Reading Podcast for
//    November 25, 2026" standing in a list whose FIRST
//    entry is the batch-ahead "December 31, 2026"
//    episode, with November 24 / 23 behind it.
//  - Day payload: a presented day of 2026-11-25 (Chicago)
//    whose Afternoon contents carry daily:bible-in-a-year
//    and daily:daily-readings, in the standing day-payload
//    shape (harness-v676's stub pattern).
//  - Track draws: the in-page stub is a first-draw-wins
//    store (the migration-0040 rule) — a key's text is
//    minted once and never re-minted, so an intention
//    change can only mean the row's identity changed.
//
// Legs (Plan §2.4):
//  1 morning resolve → Day 329 / Nov 25 readings stand,
//    not stale.
//  2 play to completion (the writePodMarkQuiet seam) +
//    full rebuild → SAME episode, marked played,
//    intention unchanged. MUST FAIL on the v676 tree.
//  3 mid-day snapshot refresh (Day 330 supplier swap,
//    Day 331 added, Day 329 listened in payload, Day 329
//    dress drifted under its stable key) + rebuild →
//    still today's settled episodes, standing dress.
//    MUST FAIL on the v676 tree.
//  4 date turns → Day 330 stands.
//  5 today absent → Day 328 / Nov 24 readings with
//    stale:true; restoring today's entries does NOT
//    upgrade mid-day (second half v677-only, MUST FAIL
//    on the v676 tree).
//
// Run: node app/worker/harness-v677.mjs
//      ORA_WT=/path/to/old-tree node /path/to/harness-v677.mjs
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
function readingsPayload(entries) {
  return { ok: true, kind: 'rss', series: 'daily-readings', title: 'USCCB Daily Readings Podcast', available: true, showImageUrl: null,
    entries: entries.map((e) => ({ key: e.key, title: e.title, publishedMs: e.publishedMs, url: e.url, durationS: 600, listened: false, positionS: 0 })) };
}
const READINGS = readingsPayload(HEADS.readings);
const byDay = (n) => BIBLE.entries.find((e) => e.day === n);
check('F BIAY folded fixture: 372 entries; Day 329 (today) + Day 330 (tomorrow) + Day 323 (control) all stand in the one list',
  BIBLE.entries.length === 372 && byDay(329).key === 'biy:day-329' && byDay(329).title === 'The Ethiopian Eunuch'
  && byDay(330).key === 'biy:day-330' && byDay(330).title === "Saul's Conversion" && byDay(323).title === 'Pentecost',
  { n: BIBLE.entries.length, d329: byDay(329) && byDay(329).title, d330: byDay(330) && byDay(330).title });
check('F readings fixture: the batch-ahead December 31, 2026 entry heads the list; the November 25, 2026 entry stands in it',
  HEADS.readings[0].title === 'Daily Mass Reading Podcast for December 31, 2026'
  && HEADS.readings.some((e) => e.title === 'Daily Mass Reading Podcast for November 25, 2026'),
  HEADS.readings.map((e) => e.title));

// Leg 3's refreshed snapshot: Day 330's supplier edition
// swapped (new title dress + url under the same key), a
// Day 331 entry added, Day 329 carrying listened:true
// from the server fold — and Day 329's own dress drifted
// under its stable key (the §2.5 supplier-edition drift
// the settled store must absorb).
const BIAY_REFRESHED = JSON.parse(JSON.stringify(BIBLE));
{
  const e329 = BIAY_REFRESHED.entries.find((e) => e.day === 329);
  e329.listened = true;
  e329.title = 'The Ethiopian Eunuch (Alt Edition)';
  e329.url = 'https://example.invalid/alt-edition-day329.mp3';
  const e330 = BIAY_REFRESHED.entries.find((e) => e.day === 330);
  e330.title = "Saul's Conversion (Alt Edition)";
  e330.url = 'https://example.invalid/alt-edition-day330.mp3';
  BIAY_REFRESHED.entries.push({ key: 'biy:day-331', kind: 'day', day: 331, label: 'Day 331', title: 'Peter and Cornelius', url: 'https://example.invalid/day331.mp3', durationS: 1200, edition: 2026, guid: null, date: null, streamUrl: null, listened: false });
}
// Leg 5's payloads: today's entries absent.
const BIAY_NO329 = JSON.parse(JSON.stringify(BIBLE));
BIAY_NO329.entries = BIAY_NO329.entries.filter((e) => e.day !== 329);
const READINGS_NO25 = readingsPayload(HEADS.readings.filter((e) => e.title !== 'Daily Mass Reading Podcast for November 25, 2026'));

// ---------- build + serve the real bundle ----------
const TMP = mkdtempSync(tmpdir() + '/v677harness-');
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
  await pg.addInitScript(({ biay, readings }) => {
    window.__pod = { biay, readings };
    window.__draws = {};
    window.__mkDay = (date) => ({
      ok: true, date, presentedDay: date, dateLabel: date,
      blocks: ['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'].map((bl) => ({ block: bl, label: bl, caption: '', spotifyUrl: null, tracks: [], trackCount: 0 })),
      additions: [], readingsSeat: null, episodes: [], intros: {}, introTexts: {},
      profile: { key: 'harness677', contents: { Afternoon: [{ kind: 'daily', key: 'bible-in-a-year' }, { kind: 'daily', key: 'daily-readings' }] } },
    });
    const resp = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
    window.fetch = (url, opts) => {
      const u = String(url);
      if (u.includes('/api/player/podcasts?series=bible-in-a-year')) return resp(window.__pod.biay);
      if (u.includes('/api/player/podcasts?series=daily-readings')) return resp(window.__pod.readings);
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
  }, { biay: BIBLE, readings: READINGS });
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
    const out = {};
    descs.filter((d) => d && d.daily666).forEach((d) => {
      out[d.dailySeries] = { episodeId: d.episodeId, listened: !!d.listened, stale: !!d.stale, title: d.title, url: d.url || null, draw: (typeof trackDrawTextFor === 'function') ? trackDrawTextFor(d) : null };
    });
    return out;
  });
}

// ---------- legs 1–4: one world, one day that turns ----------
const pg = await newWorld();

// Leg 1 — morning resolve.
await build(pg, '2026-11-25');
let r = await rows(pg);
for (let i = 0; i < 20 && !(r['bible-in-a-year'] && r['bible-in-a-year'].draw); i++) { await pg.waitForTimeout(300); r = await rows(pg); }
check('L1 BIAY row = biy:day-329, not stale', r['bible-in-a-year'] && r['bible-in-a-year'].episodeId === 'biy:day-329' && r['bible-in-a-year'].stale === false, r['bible-in-a-year']);
check('L1 readings row = the November 25, 2026 entry (not the December 31 head), not stale',
  r['daily-readings'] && r['daily-readings'].title === 'Daily Mass Reading Podcast for November 25, 2026' && r['daily-readings'].stale === false, r['daily-readings']);
const leg1Draw = r['bible-in-a-year'] && r['bible-in-a-year'].draw;
const leg1Title = r['bible-in-a-year'] && r['bible-in-a-year'].title;
const leg1Url = r['bible-in-a-year'] && r['bible-in-a-year'].url;
check('L1 BIAY row carries an intention draw', !!leg1Draw, r['bible-in-a-year']);

// Leg 2 — play to completion + full rebuild.
await pg.evaluate(() => { writePodMarkQuiet('biy:day-329', 'bible-in-a-year', 'harness-v677'); });
await pg.waitForTimeout(200);
r = await rows(pg);
check('L2 after the completion mark + extRebuildDescs rebuild: row still = biy:day-329', r['bible-in-a-year'] && r['bible-in-a-year'].episodeId === 'biy:day-329', r['bible-in-a-year']);
check('L2 rebuilt row stands played (listened:true — the mark is not re-copied hollow)', r['bible-in-a-year'] && r['bible-in-a-year'].listened === true, r['bible-in-a-year']);
check('L2 intention unchanged after the rebuild', !!leg1Draw && r['bible-in-a-year'] && r['bible-in-a-year'].draw === leg1Draw, { leg1Draw, now: r['bible-in-a-year'] && r['bible-in-a-year'].draw });
await build(pg, '2026-11-25');
r = await rows(pg);
check('L2 after a full buildDayFromPayload re-run: row still = biy:day-329, played, same intention',
  r['bible-in-a-year'] && r['bible-in-a-year'].episodeId === 'biy:day-329' && r['bible-in-a-year'].listened === true && r['bible-in-a-year'].draw === leg1Draw, r['bible-in-a-year']);

// Leg 3 — mid-day snapshot refresh + rebuild.
await pg.evaluate((refreshed) => { window.__pod.biay = refreshed; }, BIAY_REFRESHED);
await build(pg, '2026-11-25');
r = await rows(pg);
check('L3 after the snapshot refresh + rebuild: BIAY row still = biy:day-329 (no advance to Day 330/331)', r['bible-in-a-year'] && r['bible-in-a-year'].episodeId === 'biy:day-329', r['bible-in-a-year']);
check('L3 BIAY row stands played (the refreshed payload fold carries the listen)', r['bible-in-a-year'] && r['bible-in-a-year'].listened === true, r['bible-in-a-year']);
check('L3 BIAY row keeps its settled dress (title + url from the morning settle, not the drifted Alt Edition)',
  r['bible-in-a-year'] && r['bible-in-a-year'].title === leg1Title && r['bible-in-a-year'].url === leg1Url, { leg1Title, leg1Url, now: r['bible-in-a-year'] });
check('L3 readings row still = the November 25, 2026 entry', r['daily-readings'] && r['daily-readings'].title === 'Daily Mass Reading Podcast for November 25, 2026' && r['daily-readings'].stale === false, r['daily-readings']);

// Leg 4 — the date turns.
await build(pg, '2026-11-26');
r = await rows(pg);
check('L4 date turn: BIAY row = biy:day-330 (standing in the fixture since leg 1 — it stands only now)', r['bible-in-a-year'] && r['bible-in-a-year'].episodeId === 'biy:day-330' && r['bible-in-a-year'].stale === false, r['bible-in-a-year']);
await pg.context().close();

// ---------- leg 5: a fresh world where today is absent ----------
const pg5 = await newWorld();
await pg5.evaluate(({ noBiay, noReadings }) => { window.__pod.biay = noBiay; window.__pod.readings = noReadings; }, { noBiay: BIAY_NO329, noReadings: READINGS_NO25 });
await build(pg5, '2026-11-25');
r = await rows(pg5);
check('L5 today absent: BIAY row = biy:day-328 with stale:true (NOT-UPDATED)', r['bible-in-a-year'] && r['bible-in-a-year'].episodeId === 'biy:day-328' && r['bible-in-a-year'].stale === true, r['bible-in-a-year']);
check('L5 today absent: readings row = the November 24, 2026 entry with stale:true (NOT-UPDATED)',
  r['daily-readings'] && r['daily-readings'].title === 'Daily Mass Reading Podcast for November 24, 2026' && r['daily-readings'].stale === true, r['daily-readings']);
await pg5.evaluate(({ biay, readings }) => { window.__pod.biay = biay; window.__pod.readings = readings; }, { biay: BIBLE, readings: READINGS });
await build(pg5, '2026-11-25');
r = await rows(pg5);
check('L5 today restored mid-day: the stale settled BIAY row STANDS (biy:day-328, stale:true — no mid-day upgrade)', r['bible-in-a-year'] && r['bible-in-a-year'].episodeId === 'biy:day-328' && r['bible-in-a-year'].stale === true, r['bible-in-a-year']);
check('L5 today restored mid-day: the stale settled readings row STANDS (November 24, stale:true — no mid-day upgrade)',
  r['daily-readings'] && r['daily-readings'].title === 'Daily Mass Reading Podcast for November 24, 2026' && r['daily-readings'].stale === true, r['daily-readings']);
await pg5.context().close();

await b.close();
server.close();
console.log('harness-v677: ' + ok + ' ok, ' + bad + ' bad');
process.exit(bad ? 1 : 0);
