// harness-v706.mjs — v706: a SEQUENCE daily-set series
// (Bible in a Year) settles by the PROGRESS pick, not the
// calendar matcher, and a standing settle AHEAD of
// progress is invalid and corrected at compose
// (Plan §2.3).
//
// Modeled on harness-v705.mjs: playwright-core Chromium,
// the REAL built Worker bundle (esbuild from source)
// served locally, the API stubbed in-page, ORA_WT
// selecting the tree for the fail-on-old run (base =
// the shipped v705 tree, 06cd4de).
//
// Fixture (Improvement D — JOHN'S EXACT REAL CASE):
//  - v706-fixtures/bible-progress-window.json: the Bible
//    in a Year sequence window frozen from production
//    (GET https://app.orapronobis.media/api/player/
//    podcasts?series=bible-in-a-year, captured
//    2026-11-27) — the two bonus entries at the list
//    head as captured, plus the REAL day entries for
//    Days 325–333. Overlapping entries (the bonuses +
//    Days 330–333) agree with v705's bible-window.json
//    on key/title/url; Day 325's title reads
//    "Boldness in Faith" (John's 17:26 screenshot).
//  - State: listens seeded through Day 324 (the stub
//    seeds `listened` on every fixture day entry ≤ 324
//    standing in its fold — the fixture window starts
//    at 325, so the fold's first unlistened day entry
//    IS Day 325); Day 325 UNLISTENED; presented date
//    2026-11-27 (doy 331). Over ONE payload the progress
//    pick is biy:day-325 while the calendar matcher
//    returns biy:day-331 — that divergence is the
//    fixture's whole point.
//  - The profile fixture carries the item in the kind
//    PROVEN from John's production profile (v705 §3.1):
//    { kind: 'course', key: 'bible-in-a-year' } in Night.
//
// THE STUB RULE (Plan §2.3, harness-v705's rule verbatim):
// the in-page series stub recomputes currentKey on EVERY
// read exactly as the server does (podPayload, index:3798:
// the first unlistened non-bonus entry over the listen
// fold, else the first unlistened). The mark stub flips
// the named entry's listened in that fold. A stub serving
// a frozen currentKey proves nothing.
//
// Legs (Plan §2.3):
//  (a) first compose settles 325, NOT 331.
//  (b) finish 325 via writePodMarkQuiet(..., 'auto') +
//      recompose → the row holds 325, played in place
//      (the settle now stands BEHIND the advanced
//      progress pick 326 and must NOT be corrected).
//  (c) next-day compose (2026-11-28) settles 326
//      (not calendar 332).
//  (d) a fresh world pre-seeded with John's live record
//      shape — (2026-11-27, Night:bible-in-a-year) →
//      biy:day-331, unplayed, unlistened entries before
//      it — is corrected to the progress pick 325 at
//      compose, the store overwritten. (On John's phone
//      the same compose reads progress pick 326 — his
//      Day 325 stands finished — and lands on 326; the
//      fixture fold differs by exactly that one finish.)
//  (e) fail-on-old: run with ORA_WT at the v705 tree
//      (06cd4de) — leg (a) reads 331 there and leg (d)
//      stands uncorrected.
//
// Run: node app/worker/harness-v706.mjs
//      ORA_WT=/path/to/v705-tree node /path/to/harness-v706.mjs
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

// ---------- fixture ----------
const FIX = JSON.parse(readFileSync(path.join(HERE, 'v706-fixtures', 'bible-progress-window.json'), 'utf8'));
const byDay = (n) => FIX.entries.find((e) => e.day === n);
check("F John's exact case: Days 325–333 stand with real keys; Day 325 title = 'Boldness in Faith'; presented 2026-11-27 (doy 331) stands in the window",
  FIX.presented === '2026-11-27' && FIX.doy === 331
  && [325, 326, 327, 328, 329, 330, 331, 332, 333].every((n) => byDay(n) && byDay(n).key === 'biy:day-' + n)
  && byDay(325).title === 'Boldness in Faith' && byDay(331).title === 'Peter Preaches to the Gentiles',
  FIX.entries.map((e) => e.key));
check('F two bonus entries stand at the list head as captured',
  FIX.entries[0].kind === 'bonus' && FIX.entries[1].kind === 'bonus' && FIX.entries.filter((e) => e.kind === 'bonus').length === 2,
  FIX.entries.slice(0, 2).map((e) => e.key));

// ---------- build + serve the real bundle ----------
const TMP = mkdtempSync(tmpdir() + '/v706harness-');
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
async function newWorld(preseed331) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => console.log('PAGEERROR ' + String(e).slice(0, 300)));
  await pg.addInitScript(({ fix }) => {
    window.__fix = fix;
    window.__listens = {}; // series|key -> true (the stub's listen fold)
    // John's real progress: listens seeded through
    // Day 324 — the stub seeds `listened` on every
    // fixture day entry ≤ 324 standing in its fold.
    // The fixture window starts at Day 325, so no
    // window entry is seeded; Day 325 stands
    // UNLISTENED and is the progress pick.
    fix.entries.forEach((e) => {
      if (typeof e.day === 'number' && e.day <= 324) window.__listens['bible-in-a-year|' + e.key] = true;
    });
    // The stub payload builder: entries folded with the
    // listen state, currentKey RECOMPUTED on every read
    // by the server's own rule (see header). podPayload
    // stamps no `kind` on its payload — neither does
    // this stub.
    window.__seriesPayload = () => {
      const entries = window.__fix.entries.map((e) => Object.assign({}, e, {
        listened: !!window.__listens['bible-in-a-year|' + e.key], positionS: 0,
      }));
      const c = entries.find((e) => !e.listened && e.kind !== 'bonus') || entries.find((e) => !e.listened);
      return { ok: true, series: 'bible-in-a-year', title: window.__fix.title, available: true,
        showImageUrl: window.__fix.showImageUrl, entries, currentKey: c ? c.key : null,
        listenedCount: entries.filter((e) => e.listened).length, total: entries.length };
    };
    window.__mkDay = (date) => ({
      ok: true, date, presentedDay: date, dateLabel: date,
      blocks: ['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'].map((bl) => ({ block: bl, label: bl, caption: '', spotifyUrl: null, tracks: [], trackCount: 0 })),
      additions: [], readingsSeat: null, episodes: [], intros: {}, introTexts: {},
      // The PROVEN kind (v705 §3.1): the row stands as a
      // course item in Night.
      profile: { key: 'harness706', contents: { Night: [{ kind: 'course', key: 'bible-in-a-year' }] } },
    });
    const resp = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
    window.fetch = (url, opts) => {
      const u = String(url);
      if (u.includes('/api/player/podcasts?series=bible-in-a-year')) return resp(window.__seriesPayload());
      if (u.includes('/api/player/podcasts/mark')) {
        let body = {};
        try { body = JSON.parse((opts && opts.body) || '{}'); } catch (e) {}
        if (body.series && body.seqKey) window.__listens[body.series + '|' + body.seqKey] = true;
        return resp({ ok: true });
      }
      if (u.includes('/api/player/podcasts/position')) return resp({ ok: true });
      return new Promise(() => {});
    };
  }, { fix: FIX });
  await pg.goto('http://127.0.0.1:' + PORT + '/');
  await pg.waitForTimeout(1500);
  if (preseed331) {
    // Leg (d): John's live record shape, pre-seeded
    // before the first compose — (2026-11-27,
    // Night:bible-in-a-year) → biy:day-331, unplayed,
    // desc in the arm's standing settle shape.
    const e331 = byDay(331);
    await pg.evaluate((e) => {
      const desc = {
        episodeId: e.key, kind: 'podcast', seriesKey: e.key, podSeries: 'bible-in-a-year',
        title: (e.label ? e.label + ': ' : '') + (e.title || ''), url: e.url || null, enclosureUrl: null,
        available: !!e.url, block: 'Night', source: 'Bible in a Year', durationS: e.durationS || 0, listened: false,
        podPositionS: null, imageUrl: e.imageUrl || null, descText: e.descText || null, spotifyUrl: null,
        stale: false, daily666: true, dailySeries: 'bible-in-a-year', course590: true,
      };
      const store = { '2026-11-27': { 'Night:bible-in-a-year': { episodeId: 'biy:day-331', stale: false, desc } } };
      try { localStorage.setItem('opn-daily-settled-v1', JSON.stringify(store)); } catch (err) {}
      try { state.dailySettled677 = JSON.parse(JSON.stringify(store)); } catch (err) {}
    }, e331);
  }
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
async function waitRow(pg) {
  let r = await rows(pg);
  for (let i = 0; i < 20 && !r['bible-in-a-year']; i++) { await pg.waitForTimeout(300); r = await rows(pg); }
  return r;
}

// ---------- legs (a)–(c): one world, one day that turns ----------
const pg = await newWorld(false);

// Leg (a) — first compose settles the progress pick.
await build(pg, '2026-11-27');
let r = await waitRow(pg);
check('La first compose: row stands biy:day-325 (the progress pick), not stale, unplayed',
  r['bible-in-a-year'] && r['bible-in-a-year'].episodeId === 'biy:day-325' && r['bible-in-a-year'].stale === false && r['bible-in-a-year'].listened === false,
  r['bible-in-a-year']);
let st = await settled(pg);
check('La a settle record for (2026-11-27, Night:bible-in-a-year) stands naming biy:day-325',
  !!(st['2026-11-27'] && st['2026-11-27']['Night:bible-in-a-year'] && st['2026-11-27']['Night:bible-in-a-year'].episodeId === 'biy:day-325'),
  st['2026-11-27']);
check('La the calendar episode biy:day-331 stands nowhere in the row or the store',
  (!r['bible-in-a-year'] || r['bible-in-a-year'].episodeId !== 'biy:day-331')
  && JSON.stringify(st).indexOf('biy:day-331') < 0,
  { row: r['bible-in-a-year'], store: st });

// Leg (b) — finish 325 through the standing completion
// path + full recompose. The stub's currentKey now
// derives to biy:day-326; the settle stands BEHIND it.
await pg.evaluate(() => { writePodMarkQuiet('biy:day-325', 'bible-in-a-year', 'auto'); });
await pg.waitForTimeout(300);
await build(pg, '2026-11-27');
r = await rows(pg);
check('Lb after the finish + full recompose: row still stands biy:day-325, played in place (listened:true)',
  r['bible-in-a-year'] && r['bible-in-a-year'].episodeId === 'biy:day-325' && r['bible-in-a-year'].listened === true,
  r['bible-in-a-year']);
st = await settled(pg);
check('Lb the store record still names biy:day-325 (the behind-progress settle is NOT corrected)',
  !!(st['2026-11-27'] && st['2026-11-27']['Night:bible-in-a-year'] && st['2026-11-27']['Night:bible-in-a-year'].episodeId === 'biy:day-325'),
  st['2026-11-27']);

// Leg (c) — the date turns: the fresh day settles its
// own progress pick, 326 — not the calendar 332.
await build(pg, '2026-11-28');
r = await rows(pg);
check('Lc date turn: row settles and stands biy:day-326 (the progress pick), unplayed — NOT calendar biy:day-332',
  r['bible-in-a-year'] && r['bible-in-a-year'].episodeId === 'biy:day-326' && r['bible-in-a-year'].stale === false && r['bible-in-a-year'].listened === false,
  r['bible-in-a-year']);
st = await settled(pg);
check('Lc a settle record for (2026-11-28, Night:bible-in-a-year) stands naming biy:day-326',
  !!(st['2026-11-28'] && st['2026-11-28']['Night:bible-in-a-year'] && st['2026-11-28']['Night:bible-in-a-year'].episodeId === 'biy:day-326'),
  st['2026-11-28']);
await pg.context().close();

// ---------- leg (d): a fresh world, John's standing bad record ----------
const pgd = await newWorld(true);
await build(pgd, '2026-11-27');
r = await waitRow(pgd);
check('Ld the pre-seeded ahead settle (biy:day-331, unplayed, unlistened 325–330 before it) is corrected: row stands the progress pick biy:day-325',
  r['bible-in-a-year'] && r['bible-in-a-year'].episodeId === 'biy:day-325' && r['bible-in-a-year'].listened === false,
  r['bible-in-a-year']);
st = await settled(pgd);
check('Ld the store record for (2026-11-27, Night:bible-in-a-year) is overwritten to biy:day-325 by the re-settle',
  !!(st['2026-11-27'] && st['2026-11-27']['Night:bible-in-a-year'] && st['2026-11-27']['Night:bible-in-a-year'].episodeId === 'biy:day-325'),
  st['2026-11-27']);
await pgd.context().close();

await b.close();
server.close();
console.log('harness-v706: ' + ok + ' ok, ' + bad + ' bad');
process.exit(bad ? 1 : 0);
