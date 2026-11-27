// harness-v705.mjs — v705: the daily row carried as a
// COURSE item must not advance to tomorrow's episode on
// finish (Plan §2.3).
//
// Modeled on harness-v677.mjs: playwright-core Chromium,
// the REAL built Worker bundle (esbuild from source)
// served locally, the API stubbed in-page, ORA_WT
// selecting the tree for the fail-on-old run (base =
// origin/main at 2ae8e28).
//
// Fixtures (Improvement D — production captures, frozen
// in app/worker/v705-fixtures/, captured 2026-11-27 from
// GET https://app.orapronobis.media/api/player/podcasts):
//  - bible-window.json: the Bible in a Year sequence
//    window — the two bonus entries standing at the list
//    head as captured, Day 330 (yesterday), Day 331
//    (presented 2026-11-27, doy 331), Day 332 (tomorrow),
//    Day 333 — real keys, titles, urls.
//  - exegesis-head.json: the Daily Gospel Exegesis RSS
//    head — Nov 27, 2026 entry at the head (the latest;
//    the old course pick's currentKey), Nov 26 (the
//    presented−1 matcher hit), Nov 25, Nov 24.
//  - The profile fixture carries BOTH items in the kind
//    PROVEN from John's production profile (§3): the
//    standing Salesian record's Podcasts layer (D1
//    prayer_profiles: series bible-in-a-year +
//    daily-gospel-exegesis, on) converts under mig609 to
//    { kind: 'course', key } items in Night —
//    bible-in-a-year has no source-settings row;
//    daily-gospel-exegesis stands in the fixture at the
//    course seat per Plan §2.3 leg 3 (its course-eligible
//    shape), keyed as the migration's course arm keys it.
//
// THE STUB RULE the whole harness turns on (Plan §2.3):
// the in-page series stub recomputes currentKey on EVERY
// read exactly as the server does — for the sequence
// series, podPayload's derivation (index:3798: the first
// unlistened non-bonus entry over the listen fold, else
// the first unlistened); for the RSS series, the latest
// entry (podRssPayload). The mark stub flips the named
// entry's listened in that fold. A stub serving a frozen
// currentKey would prove nothing: on the old tree leg 2
// must read biy:day-332 after the finish.
//
// Legs (Plan §2.3):
//  1 settle a day at the course seat → today's entry
//    stands + a record stands in opn-daily-settled-v1.
//  2 finish via writePodMarkQuiet(..., 'auto') + full
//    recompose → row still today's, played in place.
//    MUST FAIL on the pre-v705 tree.
//  3 same leg for Daily Gospel Exegesis at the course
//    seat: settle stands the presented−1 entry (NOT the
//    list head); finish + recompose holds it, played.
//    The settle half also fails on old.
//  4 fresh day (presented +1) settles its own episode.
//  5 v694 not-available at the new seat: no presented-day
//    entry → the placeholder stands, NOTHING settled;
//    the entry lands → the next compose settles it.
//
// Run: node app/worker/harness-v705.mjs
//      ORA_WT=/path/to/old-tree node /path/to/harness-v705.mjs
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
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';

let ok = 0, bad = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('ok   ' + name); }
  else { bad++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 400) : '')); }
}

// ---------- fixtures ----------
const BIBLE_FIX = JSON.parse(readFileSync(path.join(HERE, 'v705-fixtures', 'bible-window.json'), 'utf8'));
const EXEG_FIX = JSON.parse(readFileSync(path.join(HERE, 'v705-fixtures', 'exegesis-head.json'), 'utf8'));
const byDay = (n) => BIBLE_FIX.entries.find((e) => e.day === n);
check('F BIAY production window: Day 331 (presented 2026-11-27) + Day 332 (tomorrow) + Day 330 stand with real keys/titles; two bonus entries stand at the head',
  BIBLE_FIX.presented === '2026-11-27' && BIBLE_FIX.doy === 331
  && byDay(331).key === 'biy:day-331' && byDay(331).title === 'Peter Preaches to the Gentiles'
  && byDay(332).key === 'biy:day-332' && byDay(330).key === 'biy:day-330'
  && BIBLE_FIX.entries.filter((e) => e.kind === 'bonus').length === 2,
  BIBLE_FIX.entries.map((e) => e.key));
check('F exegesis production head: Nov 27, 2026 entry heads the list; the Nov 26 (presented-1) entry stands second',
  EXEG_FIX.entries[0].label === 'Nov 27, 2026' && EXEG_FIX.entries[1].label === 'Nov 26, 2026' && EXEG_FIX.entries.length === 4,
  EXEG_FIX.entries.map((e) => e.label));
const EXEG_HIT = EXEG_FIX.entries[1];   // presented 2026-11-27 -> presented-1 hit
const EXEG_HEAD = EXEG_FIX.entries[0];  // the latest — the old course pick

// ---------- build + serve the real bundle ----------
const TMP = mkdtempSync(tmpdir() + '/v705harness-');
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
  await pg.addInitScript(({ biay, exeg }) => {
    window.__fix = { biay, exeg };
    window.__listens = {}; // series|key -> true (the stub's listen fold)
    // Production truth at capture: yesterday's episode
    // (Day 330) already stands listened in John's fold —
    // the morning's first-unlistened IS Day 331, so on the
    // old tree leg 2's finish advances the pick to Day 332
    // exactly as the field defect did.
    window.__listens['bible-in-a-year|biy:day-330'] = true;
    window.__omitDay = null; // leg 5: a bible day number to withhold
    // The stub payload builder: entries folded with the
    // listen state, currentKey RECOMPUTED on every read
    // by the server's own rules (see header).
    window.__seriesPayload = (series) => {
      const fix = series === 'bible-in-a-year' ? window.__fix.biay : window.__fix.exeg;
      let entries = fix.entries.map((e) => Object.assign({}, e, {
        listened: !!window.__listens[series + '|' + e.key], positionS: 0,
      }));
      if (series === 'bible-in-a-year' && window.__omitDay) entries = entries.filter((e) => e.day !== window.__omitDay);
      let currentKey = null;
      if (series === 'bible-in-a-year') {
        const c = entries.find((e) => !e.listened && e.kind !== 'bonus') || entries.find((e) => !e.listened);
        currentKey = c ? c.key : null;
      } else {
        currentKey = entries.length ? entries[0].key : null; // RSS: the latest, marks never move it
      }
      return { ok: true, kind: series === 'bible-in-a-year' ? 'sequence' : 'rss', series, title: fix.title, available: true,
        showImageUrl: fix.showImageUrl, entries, currentKey,
        listenedCount: entries.filter((e) => e.listened).length, total: entries.length };
    };
    window.__mkDay = (date) => ({
      ok: true, date, presentedDay: date, dateLabel: date,
      blocks: ['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'].map((bl) => ({ block: bl, label: bl, caption: '', spotifyUrl: null, tracks: [], trackCount: 0 })),
      additions: [], readingsSeat: null, episodes: [], intros: {}, introTexts: {},
      // The PROVEN kind (§3): both rows stand as course
      // items in Night, as mig609 births them from the
      // Salesian Podcasts layer.
      profile: { key: 'harness705', contents: { Night: [{ kind: 'course', key: 'bible-in-a-year' }, { kind: 'course', key: 'daily-gospel-exegesis' }] } },
    });
    const resp = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
    window.fetch = (url, opts) => {
      const u = String(url);
      if (u.includes('/api/player/podcasts?series=bible-in-a-year')) return resp(window.__seriesPayload('bible-in-a-year'));
      if (u.includes('/api/player/podcasts?series=daily-gospel-exegesis')) return resp(window.__seriesPayload('daily-gospel-exegesis'));
      if (u.includes('/api/player/podcasts/mark')) {
        let body = {};
        try { body = JSON.parse((opts && opts.body) || '{}'); } catch (e) {}
        if (body.series && body.seqKey) window.__listens[body.series + '|' + body.seqKey] = true;
        return resp({ ok: true });
      }
      if (u.includes('/api/player/podcasts/position')) return resp({ ok: true });
      return new Promise(() => {});
    };
  }, { biay: BIBLE_FIX, exeg: EXEG_FIX });
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
    descs.filter((d) => d && (d.daily666 || d.course590)).forEach((d) => {
      const series = d.dailySeries || d.podSeries;
      if (series) out[series] = { episodeId: d.episodeId, available: !!d.available, listened: !!d.listened, stale: !!d.stale, title: d.title, url: d.url || null };
    });
    return out;
  });
}
async function settled(pg) {
  return pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('opn-daily-settled-v1') || '{}'); } catch (e) { return {}; } });
}

// ---------- legs 1–4: one world, one day that turns ----------
const pg = await newWorld();

// Leg 1 — settle a day at the course seat.
await build(pg, '2026-11-27');
let r = await rows(pg);
for (let i = 0; i < 20 && !r['bible-in-a-year']; i++) { await pg.waitForTimeout(300); r = await rows(pg); }
check('L1 BIAY course row = biy:day-331 (today), not stale', r['bible-in-a-year'] && r['bible-in-a-year'].episodeId === 'biy:day-331' && r['bible-in-a-year'].stale === false, r['bible-in-a-year']);
let st = await settled(pg);
check('L1 a settle record for (2026-11-27, Night:bible-in-a-year) stands in opn-daily-settled-v1',
  !!(st['2026-11-27'] && st['2026-11-27']['Night:bible-in-a-year'] && st['2026-11-27']['Night:bible-in-a-year'].episodeId === 'biy:day-331'),
  st['2026-11-27']);
const leg1Title = r['bible-in-a-year'] && r['bible-in-a-year'].title;
const leg1Url = r['bible-in-a-year'] && r['bible-in-a-year'].url;

// Leg 3 settle half — exegesis at the course seat stands
// the presented-1 entry, NOT the list head.
check('L3 settle: exegesis course row = the Nov 26 (presented-1) entry, NOT the Nov 27 list head the progress pick takes',
  r['daily-gospel-exegesis'] && r['daily-gospel-exegesis'].episodeId === EXEG_HIT.key && r['daily-gospel-exegesis'].episodeId !== EXEG_HEAD.key,
  r['daily-gospel-exegesis']);
st = await settled(pg);
check('L3 settle: a settle record for (2026-11-27, Night:daily-gospel-exegesis) stands in opn-daily-settled-v1',
  !!(st['2026-11-27'] && st['2026-11-27']['Night:daily-gospel-exegesis'] && st['2026-11-27']['Night:daily-gospel-exegesis'].episodeId === EXEG_HIT.key),
  st['2026-11-27']);

// Leg 2 — finish BIAY through the standing completion
// seam + full recompose. The stub's currentKey now
// derives to biy:day-332 (first unlistened).
await pg.evaluate(() => { writePodMarkQuiet('biy:day-331', 'bible-in-a-year', 'auto'); });
await pg.waitForTimeout(300);
await build(pg, '2026-11-27');
r = await rows(pg);
check('L2 after the finish + full recompose: BIAY row still = biy:day-331 (never biy:day-332)', r['bible-in-a-year'] && r['bible-in-a-year'].episodeId === 'biy:day-331', r['bible-in-a-year']);
check('L2 BIAY row stands played in place (listened:true)', r['bible-in-a-year'] && r['bible-in-a-year'].listened === true, r['bible-in-a-year']);
check('L2 BIAY row keeps its settled dress (title + url from the morning settle)', r['bible-in-a-year'] && r['bible-in-a-year'].title === leg1Title && r['bible-in-a-year'].url === leg1Url, { leg1Title, leg1Url, now: r['bible-in-a-year'] });

// Leg 3 finish half — exegesis finish + recompose holds.
await pg.evaluate((k) => { writePodMarkQuiet(k, 'daily-gospel-exegesis', 'auto'); }, EXEG_HIT.key);
await pg.waitForTimeout(300);
await build(pg, '2026-11-27');
r = await rows(pg);
check('L3 after the finish + full recompose: exegesis row still = the Nov 26 entry, played', r['daily-gospel-exegesis'] && r['daily-gospel-exegesis'].episodeId === EXEG_HIT.key && r['daily-gospel-exegesis'].listened === true, r['daily-gospel-exegesis']);

// Leg 4 — the date turns: the fresh day settles its own.
await build(pg, '2026-11-28');
r = await rows(pg);
check('L4 date turn: BIAY row settles and stands biy:day-332 under the new date (it first stands HERE)', r['bible-in-a-year'] && r['bible-in-a-year'].episodeId === 'biy:day-332' && r['bible-in-a-year'].stale === false && r['bible-in-a-year'].listened === false, r['bible-in-a-year']);
check('L4 date turn: exegesis row settles and stands the Nov 27 entry (the new presented-1)', r['daily-gospel-exegesis'] && r['daily-gospel-exegesis'].episodeId === EXEG_HEAD.key && r['daily-gospel-exegesis'].stale === false, r['daily-gospel-exegesis']);
st = await settled(pg);
check('L4 settle records for 2026-11-28 stand for both series', !!(st['2026-11-28'] && st['2026-11-28']['Night:bible-in-a-year'] && st['2026-11-28']['Night:daily-gospel-exegesis']), st['2026-11-28']);
await pg.context().close();

// ---------- leg 5: a fresh world, today absent ----------
const pg5 = await newWorld();
await pg5.evaluate(() => { window.__omitDay = 331; });
await build(pg5, '2026-11-27');
r = await rows(pg5);
check('L5 today absent: BIAY course row stands NOT AVAILABLE (the v694 placeholder, stale:false — biy:day-330 never paints)',
  r['bible-in-a-year'] && r['bible-in-a-year'].episodeId === 'seg:unavailable-v694-bible-in-a-year' && r['bible-in-a-year'].available === false && r['bible-in-a-year'].stale === false && r['bible-in-a-year'].title === 'Bible in a Year',
  r['bible-in-a-year']);
st = await settled(pg5);
check('L5 today absent: NO settle record stands for 2026-11-27', !(st['2026-11-27'] && st['2026-11-27']['Night:bible-in-a-year']), st);
await pg5.evaluate(() => { window.__omitDay = null; });
await build(pg5, '2026-11-27');
r = await rows(pg5);
check('L5 today lands: the next compose settles and stands biy:day-331', r['bible-in-a-year'] && r['bible-in-a-year'].episodeId === 'biy:day-331' && r['bible-in-a-year'].stale === false, r['bible-in-a-year']);
await pg5.context().close();

await b.close();
server.close();
console.log('harness-v705: ' + ok + ' ok, ' + bad + ' bad');
process.exit(bad ? 1 : 0);
