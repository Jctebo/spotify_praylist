// harness-v690.mjs — v690: item frequency — the day rule
// on every contents item (Plan §2.6).
//
// Modeled on harness-v687.mjs: playwright-core Chromium,
// the REAL built Worker bundle (esbuild from source)
// served locally, the API stubbed in-page (the v686/v687
// world: the 26 seed rows, whole-table source-settings
// PUTs, profile PUTs captured).
//
// Fixtures (Improvement D — production shapes, sources
// named):
//  - John's real Morning/Midday lists (the v687 fixture
//    family: the field-reported Morning list of
//    2026-11-26 + the standing Midday list), carried
//    verbatim below as JOHN_CONTENTS.
//  - A Stations-shaped prayer item ({kind:'prayer',
//    key:'stations-of-the-cross'}, the seed row's own key)
//    carrying 'fridays', added to a Midday copy.
//  - A homily-shaped episode item ({kind:'episode',
//    key:'homily-series|ep-1'}) carrying 'sundays'.
//  - Daily Readings: the RSS payload built from
//    app/worker/v666-fixtures/production-heads.json
//    `readings` capture (the v677 fixture source).
// Presented days: Thu 2026-11-26 (wd 3) · Fri 2026-11-27
// (wd 4) · Sat 2026-11-28 (wd 5) · Sun 2026-11-29 (wd 6).
//
// Legs (Plan §2.6): L1 paint by rule · L2 count + queue
// exclusion · L3 Edit form stands whole · L4 menu
// write-through + repaint · L5 seat gate · L6 storage
// round-trip · L7 Move carriage · L8 byte-identical
// untouched lists (COMPOSED lines print FIRST — run with
// ORA_WT=<pre-change tree> and diff them) · L9 daily-kind
// under a non-daily rule · L10 office AND.
//
// Run: node app/worker/harness-v690.mjs
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
const clientSrc = readFileSync(path.join(W, 'src/client.ts'), 'utf8');
const seedMatch = clientSrc.match(/var OPN_SEED_SOURCES = (\[[\s\S]*?\]);/);
const SEED = JSON.parse(seedMatch[1]);
check('F fixture: the seed extracted from this tree carries exactly 26 source rows', SEED.length === 26, SEED.length);

const JOHN_CONTENTS = {
  Morning: [
    { kind: 'source', key: 'ext-invitatory' },
    { kind: 'daily', key: 'saint-of-the-day' },
    { kind: 'source', key: 'morning-prayer' },
    { kind: 'seat', key: 'daily-readings' },
    { kind: 'source', key: 'ext-usccb-readings' },
    { kind: 'source', key: 'ext-morning-prayer', side: 'sth' },
    { kind: 'source', key: 'daily-rosary' },
    { kind: 'source', key: 'marian-antiphon' },
    { kind: 'source', key: 'ext-invitatory' },
  ],
  Midmorning: [
    { kind: 'source', key: 'ext-gospel-exegesis' },
    { kind: 'source', key: 'ext-midmorning-prayer' },
  ],
  Midday: [{ kind: 'prayer', key: 'angelus-midday' }],
  Afternoon: [
    { kind: 'source', key: 'ext-saint-of-the-day' },
    { kind: 'source', key: 'auxilium-christianorum' },
    { kind: 'source', key: 'ext-midafternoon-prayer' },
  ],
  Evening: [
    { kind: 'source', key: 'ext-office-of-readings' },
    { kind: 'source', key: 'marian-antiphon-evening' },
    { kind: 'source', key: 'ext-evening-prayer', side: 'sth' },
  ],
  Night: [
    { kind: 'source', key: 'daily-reflection' },
    { kind: 'source', key: 'ext-night-prayer' },
  ],
  Novenas: [{ kind: 'all-novenas' }],
};
const JOHN_CORE = ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'];
const SAL_CORE = ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'];
const SEAT = { seqKey: 'usccb-readings-2026-11-25', title: 'Daily Reading', url: 'https://x/readings.mp3', durationS: 60, listened: false, positionS: 0, imageUrl: null };

const HEADS = JSON.parse(readFileSync(path.join(HERE, 'v666-fixtures', 'production-heads.json'), 'utf8'));
const READINGS = { ok: true, kind: 'rss', series: 'daily-readings', title: 'USCCB Daily Readings Podcast', available: true, showImageUrl: null,
  entries: HEADS.readings.map((e) => ({ key: e.key, title: e.title, publishedMs: e.publishedMs, url: e.url, durationS: 600, listened: false, positionS: 0 })) };
check('F readings fixture: the November 25, 2026 entry stands in the production capture', READINGS.entries.some((e) => e.title === 'Daily Mass Reading Podcast for November 25, 2026'));
const HOMILY = { ok: true, kind: 'rss', series: 'homily-series', title: 'Homily Series', available: true, showImageUrl: null,
  entries: [{ key: 'ep-1', title: 'Homily for the Feast', url: 'https://x/homily-ep1.mp3', durationS: 600, listened: false, positionS: 0 }], currentKey: 'ep-1' };

// ---------- build + serve the real bundle ----------
const TMP = mkdtempSync(tmpdir() + '/v690harness-');
execFileSync(process.env.HOME + '/workspace/.tools/wrangler-env/node_modules/.bin/esbuild',
  [path.join(W, 'src/index.ts'), '--bundle', '--format=cjs', '--platform=node', '--outfile=' + TMP + '/index.cjs'], { stdio: 'pipe' });
const _mod = await import(TMP + '/index.cjs');
const WORKER = _mod.default?.default || _mod.default;
const ENV = { DB: { prepare: () => ({ bind: function () { return this; }, first: async () => null, all: async () => ({ results: [] }), run: async () => ({}) }), batch: async () => [] }, AGENT_TOKEN: 't', LOCAL_DEV: '1' };
const SHELL = await (await WORKER.fetch(new Request('https://app.local/'), ENV)).text();
const APPJS = await (await WORKER.fetch(new Request('https://app.local/app.js'), ENV)).text();
const CSS = await (await WORKER.fetch(new Request('https://app.local/styles.css'), ENV)).text();
check('F the served bundle builds and paints a shell', APPJS.length > 0 && SHELL.length > 0, { appJs: APPJS.length });
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/app.js')) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(APPJS); }
  if (req.url.startsWith('/styles.css')) { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(CSS); }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(SHELL);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

// ---------- world (the v687 stub world + the two series) ----------
const b = await chromium.launch({ executablePath: EXE });
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
pg.on('pageerror', (e) => console.log('PAGEERROR ' + String(e).slice(0, 200)));
await pg.addInitScript(({ SEED, JOHN_CONTENTS, JOHN_CORE, SAL_CORE, SEAT, READINGS, HOMILY }) => {
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const freshStore = () => ({
    standing: 'john',
    johnContents: clone(JOHN_CONTENTS), salContents: null,
    todayLayer: null,
    caps: [], srcCaps: [],
    sources: clone(SEED), version: 1,
  });
  window.__store = freshStore();
  window.__reset690 = () => { window.__store = freshStore(); };
  window.__profilesRes = () => {
    const layers = { novenas: { on: false }, podcasts: { on: false, series: [] } };
    const john = { key: 'john', name: "John's way", honorLine: '', kind: 'custom', coreBlocks: JOHN_CORE.slice(), layers: clone(layers), contents: clone(window.__store.johnContents) };
    const sal = { key: 'salesian', name: 'The Salesian Way', honorLine: '', kind: 'default', coreBlocks: SAL_CORE.slice(), layers: clone(layers), contents: window.__store.salContents ? clone(window.__store.salContents) : null };
    const eff = window.__store.standing === 'salesian' ? sal : john;
    return { ok: true, profiles: [john, sal],
      state: { standingKey: window.__store.standing, version: 1 },
      todayEdit: window.__store.todayLayer ? clone(window.__store.todayLayer) : null,
      effective: { key: eff.key, name: eff.name, honorLine: '', resolvedBy: 'standing', dayKind: 'weekday',
        coreBlocks: eff.coreBlocks.slice(),
        layers: [{ key: 'novenas', on: false }, { key: 'podcasts', on: false, series: [] }],
        contents: eff.contents ? clone(eff.contents) : null, version: 1 } };
  };
  window.__mkDay = (date) => ({
    ok: true, date, presentedDay: date, dateLabel: date,
    blocks: ['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'].map((bl) => ({ block: bl, label: bl, caption: '', spotifyUrl: null, tracks: [], trackCount: 0 })),
    additions: [], readingsSeat: clone(SEAT), episodes: [], intros: {}, introTexts: {},
    profile: { key: window.__store.standing, contents: (() => {
      let c = window.__store.standing === 'salesian' ? (window.__store.salContents ? clone(window.__store.salContents) : null) : clone(window.__store.johnContents);
      const tl = window.__store.todayLayer;
      if (tl && tl.contents) { c = c || {}; Object.keys(tl.contents).forEach((bl) => { c[bl] = clone(tl.contents[bl]); }); }
      return c;
    })() },
  });
  const resp = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(clone(body)), text: () => Promise.resolve('') });
  window.fetch = (url, opts) => {
    const u = String(url);
    const method = (opts && opts.method) || 'GET';
    if (u.includes('/api/player/source-settings')) {
      if (method === 'PUT') {
        let body = {}; try { body = JSON.parse((opts && opts.body) || '{}'); } catch (e) {}
        window.__store.srcCaps.push(clone(body));
        const stored = {}; window.__store.sources.forEach((r) => { stored[r.sourceKey] = r; });
        (body.sources || []).forEach((s2) => { const r = stored[s2.sourceKey]; if (r) { r.block = s2.block == null ? '' : s2.block; r.dayRule = s2.dayRule; r.enabled = s2.enabled; } });
        window.__store.version++;
        return resp({ ok: true, version: window.__store.version });
      }
      return resp({ ok: true, version: window.__store.version, sources: window.__store.sources });
    }
    if (u.includes('/api/prayer/profiles/today-edit') && method === 'PUT') {
      let body = {}; try { body = JSON.parse((opts && opts.body) || '{}'); } catch (e) {}
      window.__store.caps.push({ path: 'today-edit', body: clone(body) });
      window.__store.todayLayer = body.layer || null;
      return resp(window.__profilesRes());
    }
    if (u.includes('/api/prayer/profiles/save') && method === 'PUT') {
      let body = {}; try { body = JSON.parse((opts && opts.body) || '{}'); } catch (e) {}
      window.__store.caps.push({ path: 'save', body: clone(body) });
      if (body.contents && body.key === 'john') window.__store.johnContents = clone(body.contents);
      if (body.contents && body.key === 'salesian') window.__store.salContents = clone(body.contents);
      return resp(window.__profilesRes());
    }
    if (u.includes('/api/prayer/profiles')) return resp(window.__profilesRes());
    if (u.includes('/api/player/day')) { const m = /date=([0-9-]+)/.exec(u); return resp(window.__mkDay(m ? m[1] : '2026-11-26')); }
    if (u.includes('/api/player/podcasts?series=daily-readings')) return resp(READINGS);
    if (u.includes('/api/player/podcasts?series=homily-series')) return resp(HOMILY);
    if (u.includes('/api/player/podcasts')) return resp({ ok: true, seriesList: [] });
    if (u.includes('/api/player/track-draws')) return resp({ ok: true, draws: {} });
    return new Promise(() => {});
  };
}, { SEED, JOHN_CONTENTS, JOHN_CORE, SAL_CORE, SEAT, READINGS, HOMILY });
await pg.goto('http://127.0.0.1:' + PORT + '/');
await pg.waitForTimeout(1500);

// ---------- composition helpers ----------
async function composedDescs(pk, date) {
  return pg.evaluate(async ({ pk, date }) => {
    window.__store.standing = pk;
    const day = window.__mkDay(date);
    state.dayPayload = day;
    state.dayAdditions = []; state.dayAdditionsDate = date;
    resolveExternals(day, { version: window.__store.version, sources: JSON.parse(JSON.stringify(window.__store.sources)) });
    (state.extStanding || []).forEach((s2) => { state.extSlots[s2.slotId] = { state: 'present', title: s2.title, enclosureUrl: 'https://x/' + s2.slotId + '.mp3', streamUrl: 'https://x/' + s2.slotId + '.mp3', durationSec: 60, source: s2.source, imageUrl: null }; });
    (state.ownStanding || []).forEach((r) => { state.ownSlots[r.sourceKey] = { state: 'present', tracks: [{ episodeId: r.episodeId, title: r.title, enclosureUrl: 'https://x/' + r.episodeId + '.mp3', durationS: 60, sizeBytes: 0, imageUrl: null }] }; });
    const descs = extRebuildDescs(day) || [];
    window.__store.standing = 'john';
    return descs.map((d) => (d.block || d._block || '?') + ':' + d.episodeId);
  }, { pk, date });
}
// Full compose over a scenario contents list, with the
// named resolvers run first (episode / daily legs).
async function compose690(date, contents, opts) {
  opts = opts || {};
  return pg.evaluate(async ({ date, contents, opts }) => {
    const clone = (x) => JSON.parse(JSON.stringify(x));
    window.__store.johnContents = clone(contents);
    window.__store.standing = 'john'; window.__store.todayLayer = null;
    const day = window.__mkDay(date);
    state.dayPayload = day;
    state.dayAdditions = []; state.dayAdditionsDate = date;
    resolveExternals(day, { version: window.__store.version, sources: clone(window.__store.sources) });
    (state.extStanding || []).forEach((s2) => { state.extSlots[s2.slotId] = { state: 'present', title: s2.title, enclosureUrl: 'https://x/' + s2.slotId + '.mp3', streamUrl: 'https://x/' + s2.slotId + '.mp3', durationSec: 60, source: s2.source, imageUrl: null }; });
    (state.ownStanding || []).forEach((r) => { state.ownSlots[r.sourceKey] = { state: 'present', tracks: [{ episodeId: r.episodeId, title: r.title, enclosureUrl: 'https://x/' + r.episodeId + '.mp3', durationS: 60, sizeBytes: 0, imageUrl: null }] }; });
    if (opts.episodes) resolveProfileEpisodes614(day);
    if (opts.daily) resolveDailyDynamic666(day);
    await new Promise((r) => setTimeout(r, 900));
    state.rebuildGuard642 = false;
    const descs = extRebuildDescs(day) || [];
    const out = { list: descs.map((d) => ({ b: d.block || d._block || '?', id: String(d.episodeId || ''), kind: d.kind || '', title: d.title || '', src: d.source || '', daily: d.dailySeries || '', raw: JSON.stringify(d) })),
      res666: JSON.parse(JSON.stringify(state.dailyRes666 || {})),
      settled: localStorage.getItem('opn-daily-settled-v1') };
    if (opts.queueBlock) {
      const bd = descs.filter((d) => (d.block || d._block) === opts.queueBlock);
      out.queue = queueBuild(bd).map((d) => String(d.episodeId || '') + '|' + JSON.stringify(d).includes('stations-of-the-cross'));
      out.blockCount = bd.length;
    }
    return out;
  }, { date, contents, opts });
}
const hasRaw = (list, needle) => list.some((d) => d.raw.includes(needle));

// ---------- L8 gate lines (printed first) ----------
const compLines = [];
for (const pk of ['john', 'salesian']) for (const date of ['2026-11-26', '2026-11-29']) {
  const ids = await composedDescs(pk, date).catch((e) => ['ERROR ' + String(e).slice(0, 160)]);
  compLines.push('COMPOSED ' + pk + ' ' + date + ' ' + JSON.stringify(ids));
}
compLines.forEach((l) => console.log(l));
check('L8 GATE composition lines stand for both untouched fixture profiles x Thu/Sunday', compLines.length === 4 && compLines.every((l) => l.startsWith('COMPOSED ')), compLines.length);

// ---------- L1 + L2: paint by rule, count + queue ----------
const L1_CONTENTS = {
  Morning: [{ kind: 'episode', key: 'homily-series|ep-1', dayRule: 'sundays' }],
  Midday: [{ kind: 'prayer', key: 'angelus-midday' }, { kind: 'prayer', key: 'stations-of-the-cross', dayRule: 'fridays' }],
};
{
  const thu = await compose690('2026-11-26', L1_CONTENTS, { episodes: true, queueBlock: 'Midday' });
  const fri = await compose690('2026-11-27', L1_CONTENTS, { episodes: true, queueBlock: 'Midday' });
  const sun = await compose690('2026-11-29', L1_CONTENTS, { episodes: true, queueBlock: 'Midday' });
  check('L1 Stations (fridays) paints Friday, not Thursday or Sunday',
    hasRaw(fri.list, 'stations-of-the-cross') && !hasRaw(thu.list, 'stations-of-the-cross') && !hasRaw(sun.list, 'stations-of-the-cross'),
    { thu: thu.list.map((d) => d.id), fri: fri.list.map((d) => d.id), sun: sun.list.map((d) => d.id) });
  check('L1 homily episode (sundays) paints Sunday, not Friday or Thursday (the reverse pair)',
    hasRaw(sun.list, 'ep-1') && !hasRaw(fri.list, 'ep-1') && !hasRaw(thu.list, 'ep-1'),
    { fri: fri.list.map((d) => d.id), sun: sun.list.map((d) => d.id) });
  check('L2 Thursday: the Midday composed tally excludes the Stations item; Friday includes it',
    thu.blockCount === 1 && fri.blockCount === 2, { thu: thu.blockCount, fri: fri.blockCount });
  check('L2 Thursday: the Midday block-Play queue build excludes the Stations item; Friday includes it',
    !thu.queue.some((q) => q.endsWith('|true')) && fri.queue.some((q) => q.endsWith('|true')), { thu: thu.queue, fri: fri.queue });
}

// ---------- L5: seat gate ----------
{
  const seatContents = JSON.parse(JSON.stringify(JOHN_CONTENTS));
  seatContents.Morning = seatContents.Morning.map((it) => it.kind === 'seat' ? { kind: 'seat', key: 'daily-readings', dayRule: 'fridays' } : it);
  const thu = await compose690('2026-11-26', seatContents, {});
  const fri = await compose690('2026-11-27', seatContents, {});
  const seatId = 'Morning:usccb-readings-2026-11-25';
  const thuIds = thu.list.map((d) => d.b + ':' + d.id), friIds = fri.list.map((d) => d.b + ':' + d.id);
  check('L5 seat item (fridays): Friday Morning stands the readings seat', friIds.includes(seatId), friIds.filter((x) => x.startsWith('Morning:')));
  check('L5 seat item (fridays): Thursday Morning stands NO seat — the foldReadingsSeat fallback does not resurrect the gated seat',
    !thuIds.includes(seatId) && thuIds.includes('Morning:daily-rosary'), thuIds.filter((x) => x.startsWith('Morning:')));
}

// ---------- L9: daily-kind under a non-daily rule ----------
{
  await pg.evaluate(() => { localStorage.removeItem('opn-daily-settled-v1'); state.dailySettled677 = null; state.dailyRes666 = {}; });
  const L9 = { Afternoon: [{ kind: 'daily', key: 'daily-readings', dayRule: 'fridays' }] };
  const thu = await compose690('2026-11-26', L9, { daily: true });
  check('L9 Thursday: the gated daily item paints nothing and state.dailyRes666 holds no entry for its block+key',
    !thu.list.some((d) => d.daily === 'daily-readings') && !('Afternoon:daily-readings' in thu.res666), { res: Object.keys(thu.res666), list: thu.list.map((d) => d.id) });
  check('L9 Thursday: NO v677 settled pick is written for the gated day',
    !thu.settled || !thu.settled.includes('2026-11-26'), thu.settled);
  const fri = await compose690('2026-11-27', L9, { daily: true });
  check('L9 Friday: the daily item resolves and paints (the production Nov 25 entry as the not-updated fallback)',
    fri.list.some((d) => d.daily === 'daily-readings') && 'Afternoon:daily-readings' in fri.res666, { res: Object.keys(fri.res666), list: fri.list.map((d) => d.id + '/' + d.daily) });
  check('L9 Friday: the settled pick IS written for the painting day', !!fri.settled && fri.settled.includes('2026-11-27'), fri.settled);
}

// ---------- L10: office AND (dayRule x side x off) ----------
{
  const L10 = { Morning: [{ kind: 'source', key: 'ext-morning-prayer', side: 'do', dayRule: 'weekends' }] };
  const sat = await compose690('2026-11-28', L10, {});
  const thu = await compose690('2026-11-26', L10, {});
  const satMp = sat.list.filter((d) => d.b === 'Morning' && d.id === 'ext-morning-prayer');
  check('L10 Saturday: the weekends office item paints (side do stands)', satMp.length === 1, sat.list.map((d) => d.b + ':' + d.id + ':' + d.src));
  check('L10 Saturday: the painting side is the Divine Office side (the item side, ANDed — not overridden)',
    satMp.length === 1 && /Divine Office/i.test(satMp[0].src || satMp[0].raw), satMp);
  check('L10 Thursday: the weekends office item paints nothing', !thu.list.some((d) => d.id === 'ext-morning-prayer'), thu.list.map((d) => d.b + ':' + d.id));
  const L10off = { Morning: [{ kind: 'source', key: 'ext-morning-prayer', side: 'do', dayRule: 'weekends', off: 1 }] };
  const satOff = await compose690('2026-11-28', L10off, {});
  check('L10 Saturday + off:1: nothing paints — off and a failing/passing rule are independent suppressions',
    !satOff.list.some((d) => d.id === 'ext-morning-prayer'), satOff.list.map((d) => d.b + ':' + d.id));
}

// ---------- form helpers (the v687 pattern) ----------
async function tryClick(loc) { try { await loc.click({ timeout: 4000 }); return true; } catch (e) { return false; } }
async function scrollTo(loc) { try { await loc.evaluate((el) => el.scrollIntoView({ block: 'center' })); } catch (e) {} }
async function openForm690(contents, date) {
  await pg.evaluate(async ({ contents, date }) => {
    window.__reset690();
    window.__store.johnContents = JSON.parse(JSON.stringify(contents));
    window.__store.standing = 'john';
    state.dayPayload = window.__mkDay(date || '2026-11-26');
    state.tab = 'prayers'; state.prayersView = { kind: 'home' };
    opn604.res = null; opn604.lists = {}; opn604.base = {}; opn604.removed = {};
    opnEnterEdit607();
  }, { contents, date });
  await pg.waitForTimeout(1300);
}
async function formRows(block) {
  return pg.evaluate((bl) => {
    const g = document.querySelector('[data-p604exp="' + bl + '"]');
    if (!g) return null;
    return [...g.querySelectorAll('.p604erow')].map((r) => ({ rid: r.getAttribute('data-p604erow') || ('SRC:' + r.getAttribute('data-p686src')), sub: (r.querySelector('.p687sub') || {}).textContent || '', text: r.textContent }));
  }, block);
}
async function openMenu690(sel) {
  const btn = pg.locator(sel).first();
  await scrollTo(btn);
  await tryClick(btn);
  await pg.waitForTimeout(400);
  return pg.evaluate(() => [...document.querySelectorAll('.anchmenu [data-menuitem]')].map((e) => e.textContent.trim().replace(/\s+/g, ' ')));
}
async function menuClick690(idx) { await tryClick(pg.locator('.anchmenu [data-menuitem="' + idx + '"]')); await pg.waitForTimeout(800); }
async function closeMenu690() { await pg.evaluate(() => { document.querySelectorAll('.anchmenu, .menucatcher').forEach((n) => n.remove()); }); }
const lastCap690 = () => pg.evaluate(() => window.__store.caps[window.__store.caps.length - 1] || null);
async function savedContents690() {
  const cap = await lastCap690();
  if (!cap) return null;
  return cap.path === 'today-edit' ? (cap.body.layer && cap.body.layer.contents) : cap.body.contents;
}

// ---------- L3: the Edit form stands whole on a non-painting day ----------
{
  const FORM = {
    Morning: [{ kind: 'episode', key: 'homily-series|ep-1', dayRule: 'sundays' }, { kind: 'daily', key: 'saint-of-the-day' }],
    Midday: [{ kind: 'prayer', key: 'angelus-midday' }, { kind: 'prayer', key: 'stations-of-the-cross', dayRule: 'fridays' }],
  };
  await openForm690(FORM, '2026-11-26'); // Thursday: neither gated item paints today
  const mid = await formRows('Midday');
  const mor = await formRows('Morning');
  const stRow = mid && mid.find((r) => r.rid === 'prayer:stations-of-the-cross');
  const homRow = mor && mor.find((r) => r.rid === 'episode:homily-series|ep-1');
  const dailyRow = mor && mor.find((r) => r.rid === 'daily:saint-of-the-day');
  check('L3 Thursday Edit form still lists the Fridays Stations item, subtitle exactly "Generates Fridays"',
    !!stRow && stRow.sub === 'Generates Fridays', { mid, stRow });
  check('L3 Thursday Edit form still lists the Sundays homily item, subtitle exactly "Generates Sundays"',
    !!homRow && homRow.sub === 'Generates Sundays', { mor, homRow });
  check('L3 an untouched item paints subtitle "Generates daily" in the same form',
    !!dailyRow && dailyRow.sub === 'Generates daily', dailyRow);
}

// ---------- L4: menu write-through + repaint ----------
{
  const FORM = {
    Morning: [{ kind: 'episode', key: 'homily-series|ep-1' }],
    Midday: [{ kind: 'prayer', key: 'angelus-midday' }, { kind: 'prayer', key: 'stations-of-the-cross', dayRule: 'fridays' }],
  };
  await openForm690(FORM, '2026-11-26');
  const labels = await openMenu690('button[data-p686menu="Midday|prayer:stations-of-the-cross"]');
  check('L4 the Stations item menu shows the Frequency section: header "Frequency — Fridays only", the five paint values, Fridays marked Current, after Move and before Remove',
    labels.length === 8 && labels[0] === 'Move to block…' && labels[1] === 'Frequency — Fridays only'
    && labels[2] === 'Daily' && labels[3].startsWith('Weekdays only') && labels[4].startsWith('Weekends only')
    && labels[5].startsWith('Sundays only') && labels[6].startsWith('Fridays only') && labels[6].includes('Current')
    && labels[7] === 'Remove', labels);
  await menuClick690(2); // Daily
  const saved1 = await savedContents690();
  const stSaved = saved1 && (saved1.Midday || []).find((it) => it.key === 'stations-of-the-cross');
  check('L4 choosing Daily writes through: the stored Stations item carries NO dayRule field (absent = daily)',
    !!stSaved && !('dayRule' in stSaved), stSaved);
  await closeMenu690();
  const thuAfter = await compose690('2026-11-26', saved1, {});
  check('L4 repaint: the recomposed Thursday now paints the Stations item',
    hasRaw(thuAfter.list, 'stations-of-the-cross'), thuAfter.list.map((d) => d.id));
  // Sundays on the homily item round-trips the value.
  await openForm690(FORM, '2026-11-26');
  const hLabels = await openMenu690('button[data-p686menu="Morning|episode:homily-series|ep-1"]');
  check('L4 the homily item menu header reads "Frequency — Daily" while unset', !!hLabels && hLabels[1] === 'Frequency — Daily', hLabels);
  await menuClick690(5); // Sundays only
  const saved2 = await savedContents690();
  const homSaved = saved2 && (saved2.Morning || []).find((it) => it.kind === 'episode');
  check('L4 choosing Sundays on the homily item round-trips the stored field value "sundays"',
    !!homSaved && homSaved.dayRule === 'sundays', homSaved);
  await closeMenu690();
}

// ---------- L7: Move carriage ----------
{
  const FORM = {
    Morning: [{ kind: 'prayer', key: 'stations-of-the-cross', dayRule: 'fridays' }],
    Midday: [{ kind: 'prayer', key: 'angelus-midday' }],
  };
  await openForm690(FORM, '2026-11-26');
  const mv = await pg.evaluate(async () => {
    const r = await opnMove686('Morning', 'prayer:stations-of-the-cross', 'Midday');
    return r;
  });
  check('L7 the Move act reports ok', !!mv && mv.ok !== false, mv);
  const saved = await savedContents690();
  const moved = saved && (saved.Midday || []).find((it) => it.key === 'stations-of-the-cross');
  check('L7 the moved Stations item keeps dayRule "fridays" in the target block stored list (client write path)',
    !!moved && moved.dayRule === 'fridays' && !(saved.Morning || []).some((it) => it.key === 'stations-of-the-cross'), saved);
}

// ---------- L6: storage round-trip (both real validators) ----------
{
  const clientRes = await pg.evaluate(() => {
    const out = {};
    const vals = ['daily', 'weekdays', 'weekends', 'sundays', 'fridays', 'fallback-only'];
    try {
      vals.forEach((v) => {
        const c = opnCheckContents590({ Midday: [{ kind: 'prayer', key: 'stations-of-the-cross', dayRule: v }] }, ['Midday']);
        out[v] = c.Midday[0].dayRule;
      });
      const nv = opnCheckContents590({ Novenas: [{ kind: 'novena', key: 'st-jude', dayRule: 'fridays' }, { kind: 'all-novenas', dayRule: 'sundays' }] }, ['Morning']);
      out.novena = nv.Novenas[0].dayRule; out.allNovenas = nv.Novenas[1].dayRule;
      const absent = opnCheckContents590({ Midday: [{ kind: 'prayer', key: 'angelus-midday' }] }, ['Midday']);
      out.absentStaysAbsent = !('dayRule' in absent.Midday[0]);
    } catch (e) { out.error = String((e && e.message) || e); }
    try { opnCheckContents590({ Midday: [{ kind: 'prayer', key: 'stations-of-the-cross', dayRule: 'saturdays' }] }, ['Midday']); out.badAccepted = true; }
    catch (e) { out.badError = String((e && e.message) || e); }
    return out;
  });
  check('L6 client validator round-trips every offered value + fallback-only verbatim, incl. the Novenas arm and all-novenas',
    ['daily', 'weekdays', 'weekends', 'sundays', 'fridays', 'fallback-only'].every((v) => clientRes[v] === v) && clientRes.novena === 'fridays' && clientRes.allNovenas === 'sundays' && clientRes.absentStaysAbsent === true, clientRes);
  check('L6 client validator refuses "saturdays" with the named error (bad dayRule for prayer:stations-of-the-cross)',
    !clientRes.badAccepted && !!clientRes.badError && clientRes.badError.includes('bad dayRule for prayer:stations-of-the-cross'), clientRes);

  const indexSrc = readFileSync(path.join(W, 'src/index.ts'), 'utf8');
  function extractServerFn(s2, name) {
    const start = s2.indexOf('function ' + name + '(');
    if (start < 0) throw new Error('server fn not found: ' + name);
    const nl = s2.indexOf('\n', start);
    let i = s2.lastIndexOf('{', nl);
    let depth = 0, j = i;
    for (; j < s2.length; j++) { if (s2[j] === '{') depth++; else if (s2[j] === '}') { depth--; if (!depth) break; } }
    return s2.slice(start, j + 1);
  }
  function stripNamed(s2, name, reps) {
    let f = extractServerFn(s2, name);
    for (const [a, b2] of reps) { if (!f.includes(a)) throw new Error(name + ' shape moved: ' + a.slice(0, 60)); f = f.split(a).join(b2); }
    return f;
  }
  let SV = null, SV686 = null;
  try {
    const vBody = stripNamed(indexSrc, 'validateProfileContents', [
      ['function validateProfileContents(contents: unknown, coreBlocks: string[]): { normalized?: Record<string, { kind: string; key?: string; side?: string; off?: number; dayRule?: string }[]> } | { error: string } {', 'function validateProfileContents(contents, coreBlocks) {'],
      ['const out: Record<string, { kind: string; key?: string; side?: string; off?: number; dayRule?: string }[]> = {};', 'const out = {};'],
      ['Object.entries(contents as Record<string, unknown>)', 'Object.entries(contents)'],
      ['const seen = new Set<string>();', 'const seen = new Set();'],
      ['const list: { kind: string; key?: string; side?: string; off?: number; dayRule?: string }[] = [];', 'const list = [];'],
      ['const it = (raw && typeof raw === "object" ? raw : {}) as { kind?: unknown; key?: unknown; side?: unknown; off?: unknown; dayRule?: unknown };', 'const it = (raw && typeof raw === "object" ? raw : {});'],
      ['let side670: string | undefined;', 'let side670;'],
      ['let off687: number | undefined;', 'let off687;'],
      ['let dayRule690: string | undefined;', 'let dayRule690;'],
      ['const an690: { kind: string; dayRule?: string } = { kind: "all-novenas" };', 'const an690 = { kind: "all-novenas" };'],
      ['if (side670 || off687 || dayRule690) { const built687: { kind: string; key?: string; side?: string; off?: number; dayRule?: string } = { kind: kind as string, key: key as string }; if (side670) built687.side = side670; if (off687) built687.off = 1; if (dayRule690) built687.dayRule = dayRule690; list.push(built687); }', 'if (side670 || off687 || dayRule690) { const built687 = { kind: kind, key: key }; if (side670) built687.side = side670; if (off687) built687.off = 1; if (dayRule690) built687.dayRule = dayRule690; list.push(built687); }'],
      ['else list.push({ kind: kind as string, key: key as string });', 'else list.push({ kind: kind, key: key });'],
    ]);
    const wBody = stripNamed(indexSrc, 'validateProfileContents686', [
      ['function validateProfileContents686(contents: unknown, coreBlocks: string[], extraBlocks?: string[]): { normalized?: Record<string, { kind: string; key?: string; side?: string; off?: number; dayRule?: string }[]> } | { error: string } {', 'function validateProfileContents686(contents, coreBlocks, extraBlocks) {'],
      ['const core: string[] = coreBlocks.slice();', 'const core = coreBlocks.slice();'],
    ]);
    SV = new Function(vBody + '\nreturn validateProfileContents;')();
    SV686 = new Function(vBody + '\n' + wBody + '\nreturn validateProfileContents686;')();
  } catch (e) { check('L6 the real index.ts validators extract standalone', false, e.message); }
  if (SV) {
    const CORE = ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'];
    const vals = ['daily', 'weekdays', 'weekends', 'sundays', 'fridays', 'fallback-only'];
    const allOk = vals.every((v) => { const r = SV({ Midday: [{ kind: 'prayer', key: 'stations-of-the-cross', dayRule: v }] }, CORE); return !r.error && r.normalized.Midday[0].dayRule === v; });
    const nv = SV({ Novenas: [{ kind: 'novena', key: 'st-jude', dayRule: 'fridays' }, { kind: 'all-novenas', dayRule: 'sundays' }] }, CORE);
    const absent = SV({ Midday: [{ kind: 'prayer', key: 'angelus-midday' }] }, CORE);
    check('L6 server validator round-trips every offered value + fallback-only verbatim, incl. the Novenas arm and all-novenas; absent stays absent',
      allOk && !nv.error && nv.normalized.Novenas[0].dayRule === 'fridays' && nv.normalized.Novenas[1].dayRule === 'sundays' && !('dayRule' in absent.normalized.Midday[0]), { nv, absent });
    const badR = SV({ Midday: [{ kind: 'prayer', key: 'stations-of-the-cross', dayRule: 'saturdays' }] }, CORE);
    check('L6 server validator refuses "saturdays" with the named error', !!badR.error && badR.error.includes('bad dayRule for prayer:stations-of-the-cross'), badR);
    if (SV686) {
      const mvR = SV686({ Morning: [], Midday: [{ kind: 'prayer', key: 'angelus-midday' }, { kind: 'prayer', key: 'stations-of-the-cross', dayRule: 'fridays' }] }, ['Morning'], ['Midday']);
      check('L7 server Move-envelope path (validateProfileContents686) keeps dayRule "fridays" on the moved item',
        !mvR.error && mvR.normalized.Midday[1].dayRule === 'fridays', mvR);
    }
  }
}

await b.close();
server.close();
console.log('\nharness-v690: ' + ok + ' ok, ' + bad + ' bad');
process.exit(bad ? 1 : 0);
