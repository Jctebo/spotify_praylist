// harness-v708.mjs — v708: arrows on everything · Saint of
// the Day removable · prayer title pull-through · Stations
// must play (Plan §2.5 legs A · S · O · T · P).
//
// Modeled on harness-v687.mjs: playwright-core Chromium,
// the REAL built Worker bundle served locally, the API
// stubbed in-page (the v686/v687 world: the 26 seed rows,
// whole-table source-settings PUTs, profile PUTs captured).
// The book-audio route is served by the REAL Worker fetch
// handler with a fake AUDIO (R2) binding carrying the real
// v699 render bytes, so leg P's 200/206 proof runs against
// the shipped route code.
//
// Fixtures (Improvement D — production sources named):
//  - F1: harness-v687's JOHN_CONTENTS (John's real profile
//    as screenshotted 2026-11-26, harness-v687.mjs) with the
//    Afternoon block REPLACED by the v708 screenshot variant
//    (John, 2026-11-27 19:12 CT): Afternoon contents standing
//    WITHOUT source:ext-saint-of-the-day and WITHOUT
//    source:ext-midafternoon-prayer (the spliced state); its
//    contents rows are Auxilium Christianorum · Catholic
//    Saints & Feasts (daily:catholicsaints) · Bible in a
//    Year (daily:bible-in-a-year). Live-capture note: the
//    production D1 prayer_profiles read at Implement
//    (2026-11-27, Cloudflare connector) carries only the
//    three starter profiles with NO contents — John's
//    contents are device-local (the v590+ personal-data
//    model) and no door read of the device store exists —
//    so the Plan's screenshot variant stands, per §2.5 F1's
//    fallback ("the screenshot variant stands if the live
//    read differs in shape only, never in the two
//    absences"). Named in v708 §3.
//  - F1b: a forced-spliced variant — the representations of
//    the remaining six source keys removed, so every one of
//    the nine source rows stands spliced somewhere in the
//    two fixtures.
//  - F2: the real Prayer Book row — slug
//    stations-of-the-cross · title "Stations of the Cross"
//    · category "The Raccolta" · PRAYER_AUDIO duration
//    1011.8 (migration 0053; D1 id 78; the v699 renders
//    record — asserted below against index.ts + the local
//    render file where it stands).
//  - F3: the 26-row seed store extracted from this tree.
//
// Run: node app/worker/harness-v708.mjs
let chromium;
try { ({ chromium } = await import('playwright-core')); }
catch (e) { ({ chromium } = await import(process.env.HOME + '/workspace/.tools/pwtest/node_modules/playwright-core/index.mjs')); }
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = process.env.ORA_WT ? path.resolve(process.env.ORA_WT) : path.resolve(HERE, '..', '..');
const W = path.join(WT, 'app/worker');
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';

let ok = 0, bad = 0;
const groups = {};
function check(name, cond, extra) {
  const g = name.split(' ')[0];
  groups[g] = groups[g] || { ok: 0, bad: 0 };
  if (cond) { ok++; groups[g].ok++; console.log('ok   ' + name); }
  else { bad++; groups[g].bad++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 400) : '')); }
}

// ---------- fixtures ----------
const clientSrc = readFileSync(path.join(W, 'src/client.ts'), 'utf8');
const indexSrc = readFileSync(path.join(W, 'src/index.ts'), 'utf8');
const SEED = JSON.parse(clientSrc.match(/var OPN_SEED_SOURCES = (\[[\s\S]*?\]);/)[1]);
check('F3 fixture: the seed extracted from this tree carries exactly 26 source rows', SEED.length === 26, SEED.length);
const AUDIO_M = indexSrc.match(/"stations-of-the-cross": \{ en: ([0-9.]+) \}/);
check('F2 fixture: index.ts PRAYER_AUDIO carries stations-of-the-cross en 1011.8 (migration 0053)', !!AUDIO_M && Number(AUDIO_M[1]) === 1011.8, AUDIO_M && AUDIO_M[1]);
const MP3_PATH = process.env.HOME + '/workspace/projects/ora-pro-nobis/v699-prayer-audio/stations-of-the-cross.en.mp3';
const MP3 = existsSync(MP3_PATH) ? readFileSync(MP3_PATH) : Buffer.from('x'.repeat(2000));
const BOOK708 = { ok: true, groups: [{ category: 'The Raccolta', prayers: [{ slug: 'stations-of-the-cross', title: 'Stations of the Cross', body: 'STATION 1', bodyLatin: null, source: 'St. Alphonsus Liguori, The Way of the Cross (public domain)', audio: { en: 1011.8 } }] }] };

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
  // F1 Afternoon = the 2026-11-27 19:12 screenshot variant:
  // NO saint representation, NO midafternoon representation.
  Afternoon: [
    { kind: 'source', key: 'auxilium-christianorum' },
    { kind: 'daily', key: 'catholicsaints' },
    { kind: 'daily', key: 'bible-in-a-year' },
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
// F1b: every remaining source key forced spliced.
const JOHN_CONTENTS_B = JSON.parse(JSON.stringify(JOHN_CONTENTS));
JOHN_CONTENTS_B.Morning = JOHN_CONTENTS_B.Morning.filter((x) => !['ext-invitatory', 'ext-usccb-readings'].includes(x.key) && x.kind !== 'seat');
JOHN_CONTENTS_B.Midmorning = [];
JOHN_CONTENTS_B.Evening = JOHN_CONTENTS_B.Evening.filter((x) => x.key !== 'ext-office-of-readings');
JOHN_CONTENTS_B.Night = JOHN_CONTENTS_B.Night.filter((x) => x.key !== 'ext-night-prayer');
const JOHN_CORE = ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'];
const SEAT = { seqKey: 'usccb-readings-2026-11-25', title: 'Daily Reading', url: 'https://x/readings.mp3', durationS: 60, listened: false, positionS: 0, imageUrl: null };

// ---------- build + serve the real bundle ----------
const TMP = mkdtempSync(tmpdir() + '/v708harness-');
execFileSync(process.env.HOME + '/workspace/.tools/wrangler-env/node_modules/.bin/esbuild',
  [path.join(W, 'src/index.ts'), '--bundle', '--format=cjs', '--platform=node', '--outfile=' + TMP + '/index.cjs'], { stdio: 'pipe' });
const _mod = await import(TMP + '/index.cjs');
const WORKER = _mod.default?.default || _mod.default;
const AUDIO = { get: async (key, opts) => {
  if (key !== 'prayer-audio/stations-of-the-cross.en.mp3') return null;
  if (opts && opts.range) { const off = opts.range.offset || 0; const len = opts.range.length || (MP3.length - off); return { body: MP3.subarray(off, off + len), size: MP3.length, range: { offset: off, length: len } }; }
  return { body: MP3, size: MP3.length, range: undefined };
} };
const ENV = { DB: { prepare: () => ({ bind: function () { return this; }, first: async () => null, all: async () => ({ results: [] }), run: async () => ({}) }), batch: async () => [] }, AGENT_TOKEN: 't', LOCAL_DEV: '1', AUDIO };
const SHELL = await (await WORKER.fetch(new Request('https://app.local/'), ENV)).text();
const APPJS = await (await WORKER.fetch(new Request('https://app.local/app.js'), ENV)).text();
const CSS = await (await WORKER.fetch(new Request('https://app.local/styles.css'), ENV)).text();
check('F the served bundle builds and paints a shell', APPJS.length > 0 && SHELL.length > 0, { appJs: APPJS.length });
const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/prayer/book/audio/')) {
    const r = await WORKER.fetch(new Request('https://app.local' + req.url, { headers: req.headers.range ? { range: req.headers.range } : {} }), ENV);
    const hdrs = {}; r.headers.forEach((v, k) => { hdrs[k] = v; });
    res.writeHead(r.status, hdrs); res.end(Buffer.from(await r.arrayBuffer())); return;
  }
  if (req.url.startsWith('/app.js')) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(APPJS); }
  if (req.url.startsWith('/styles.css')) { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(CSS); }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(SHELL);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

// ---------- world (the v687 stub world + the book route) ----------
const b = await chromium.launch({ executablePath: EXE });
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
pg.on('pageerror', (e) => console.log('PAGEERROR ' + String(e).slice(0, 200)));
await pg.addInitScript(({ SEED, JOHN_CONTENTS, JOHN_CORE, SEAT, BOOK708 }) => {
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const freshStore = () => ({ standing: 'john', johnContents: clone(JOHN_CONTENTS), todayLayer: null, caps: [], srcCaps: [], sources: clone(SEED), version: 1 });
  window.__store = freshStore();
  window.__reset708 = () => { window.__store = freshStore(); };
  window.__profilesRes = () => {
    const layers = { novenas: { on: false }, podcasts: { on: false, series: [] } };
    const john = { key: 'john', name: "John's way", honorLine: '', kind: 'custom', coreBlocks: JOHN_CORE.slice(), layers: clone(layers), contents: clone(window.__store.johnContents) };
    return { ok: true, profiles: [john], state: { standingKey: 'john', version: 1 },
      todayEdit: window.__store.todayLayer ? clone(window.__store.todayLayer) : null,
      effective: { key: 'john', name: john.name, honorLine: '', resolvedBy: 'standing', dayKind: 'weekday', coreBlocks: JOHN_CORE.slice(), layers: [{ key: 'novenas', on: false }, { key: 'podcasts', on: false, series: [] }], contents: clone(window.__store.johnContents), version: 1 } };
  };
  window.__mkDay = (date) => ({ ok: true, date, presentedDay: date, dateLabel: date,
    blocks: ['Novenas', 'Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'].map((bl) => ({ block: bl, label: bl, caption: '', spotifyUrl: null, tracks: [], trackCount: 0 })),
    additions: [], readingsSeat: clone(SEAT), episodes: [], intros: {}, introTexts: {},
    profile: { key: 'john', contents: (() => { let c = clone(window.__store.johnContents); const tl = window.__store.todayLayer; if (tl && tl.contents) Object.keys(tl.contents).forEach((bl) => { c[bl] = clone(tl.contents[bl]); }); return c; })() } });
  const resp = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(clone(body)), text: () => Promise.resolve('') });
  window.fetch = (url, opts) => {
    const u = String(url); const method = (opts && opts.method) || 'GET';
    if (u.includes('/api/player/source-settings')) {
      if (method === 'PUT') {
        let body = {}; try { body = JSON.parse((opts && opts.body) || '{}'); } catch (e) {}
        window.__store.srcCaps.push(clone(body));
        const stored = {}; window.__store.sources.forEach((r) => { stored[r.sourceKey] = r; });
        const seen = {};
        for (const s2 of (body.sources || [])) { if (!stored[s2.sourceKey] || seen[s2.sourceKey]) return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ error: 'bad set' }), text: () => Promise.resolve('') }); seen[s2.sourceKey] = 1; }
        if (Object.keys(seen).length !== window.__store.sources.length) return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ error: 'bad set' }), text: () => Promise.resolve('') });
        const counters = {};
        (body.sources || []).forEach((s2) => { const r = stored[s2.sourceKey]; r.block = s2.block == null ? '' : s2.block; r.dayRule = s2.dayRule; r.enabled = s2.enabled; if (r.enabled === 1 && r.block !== '') { counters[r.block] = (counters[r.block] || 0) + 1; r.sortOrder = counters[r.block]; } else r.sortOrder = null; });
        window.__store.version++;
        return resp({ ok: true, version: window.__store.version });
      }
      return resp({ ok: true, version: window.__store.version, sources: window.__store.sources });
    }
    if (u.includes('/api/prayer/book')) return resp(BOOK708);
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
      return resp(window.__profilesRes());
    }
    if (u.includes('/api/prayer/profiles')) return resp(window.__profilesRes());
    if (u.includes('/api/player/day')) { const m = /date=([0-9-]+)/.exec(u); return resp(window.__mkDay(m ? m[1] : '2026-11-27')); }
    if (u.includes('/api/player/podcasts')) return resp({ ok: true, seriesList: [] });
    if (u.includes('/api/player/track-draws')) return resp({ ok: true, draws: {} });
    return new Promise(() => {});
  };
}, { SEED, JOHN_CONTENTS, JOHN_CORE, SEAT, BOOK708 });
await pg.goto('http://127.0.0.1:' + PORT + '/');
await pg.waitForTimeout(1500);

// ---------- helpers ----------
async function composedDescs(date) {
  return pg.evaluate(async ({ date }) => {
    const day = window.__mkDay(date);
    state.dayPayload = day;
    resolveExternals(day, { version: window.__store.version, sources: JSON.parse(JSON.stringify(window.__store.sources)) });
    (state.extStanding || []).forEach((s2) => { state.extSlots[s2.slotId] = { state: 'present', title: s2.title, enclosureUrl: 'https://x/' + s2.slotId + '.mp3', streamUrl: 'https://x/' + s2.slotId + '.mp3', durationSec: 60, source: s2.source, imageUrl: null }; });
    (state.ownStanding || []).forEach((r) => { state.ownSlots[r.sourceKey] = { state: 'present', tracks: [{ episodeId: r.episodeId, title: r.title, enclosureUrl: 'https://x/' + r.episodeId + '.mp3', durationS: 60, sizeBytes: 0, imageUrl: null }] }; });
    const descs = extRebuildDescs(day) || [];
    return descs.map((d) => (d.block || d._block || '?') + ':' + d.episodeId);
  }, { date });
}

// Standing-emission composition: the day payload's profile
// carries NO Afternoon contents entry, so the block's
// settings rows emit by standing (the path a spliced saint
// plays through — the contents-gated path gates a spliced
// row out by construction, Plan §1.3b).
async function composedDescsStanding(date) {
  return pg.evaluate(async ({ date }) => {
    const day = window.__mkDay(date);
    if (day.profile && day.profile.contents) delete day.profile.contents.Afternoon;
    state.dayPayload = day;
    resolveExternals(day, { version: window.__store.version, sources: JSON.parse(JSON.stringify(window.__store.sources)) });
    (state.extStanding || []).forEach((s2) => { state.extSlots[s2.slotId] = { state: 'present', title: s2.title, enclosureUrl: 'https://x/' + s2.slotId + '.mp3', streamUrl: 'https://x/' + s2.slotId + '.mp3', durationSec: 60, source: s2.source, imageUrl: null }; });
    (state.ownStanding || []).forEach((r) => { state.ownSlots[r.sourceKey] = { state: 'present', tracks: [{ episodeId: r.episodeId, title: r.title, enclosureUrl: 'https://x/' + r.episodeId + '.mp3', durationS: 60, sizeBytes: 0, imageUrl: null }] }; });
    const descs = extRebuildDescs(day) || [];
    return descs.map((d) => (d.block || d._block || '?') + ':' + d.episodeId);
  }, { date });
}
async function openForm() {
  await pg.evaluate(async () => {
    state.dayPayload = window.__mkDay('2026-11-27');
    state.tab = 'prayers'; state.prayersView = { kind: 'home' };
    opn604.res = null; opn604.lists = {}; opn604.base = {}; opn604.removed = {};
    opnEnterEdit607();
  });
  await pg.waitForTimeout(1300);
}
async function resetForm(contents) {
  await pg.evaluate(async ({ contents }) => {
    window.__reset708();
    if (contents) window.__store.johnContents = JSON.parse(JSON.stringify(contents));
    try { localStorage.removeItem('opn-book-v462'); } catch (e) {}
  }, { contents });
  await openForm();
}
const groupRows = (block) => pg.evaluate((bl) => {
  const g = document.querySelector('[data-p604exp="' + bl + '"]');
  if (!g) return null;
  return [...g.querySelectorAll('.p604erow')].map((r) => {
    const mv = [...r.querySelectorAll('[data-p684move], [data-p708srcmove]')];
    return { name: r.hasAttribute('data-p686src') ? 'SRC:' + r.getAttribute('data-p686src') : 'C:' + r.getAttribute('data-p604erow'),
      src: r.getAttribute('data-p686src') || null,
      up: mv.some((x) => (x.getAttribute('data-p684move') || x.getAttribute('data-p708srcmove')).endsWith('|up')),
      down: mv.some((x) => (x.getAttribute('data-p684move') || x.getAttribute('data-p708srcmove')).endsWith('|down')),
      spliced: mv.length > 0 && !!r.querySelector('[data-p708srcmove]'),
      remove: !!r.querySelector('[data-p687srcremove], [data-p708saintremove], [data-p604remove]'),
      disable: !!r.querySelector('[data-p687srcdisable], [data-p687disable]') };
  });
}, block);
async function tryClick(loc) { try { await loc.click({ timeout: 4000 }); return true; } catch (e) { return false; } }
async function scrollTo(loc) { try { await loc.evaluate((el) => el.scrollIntoView({ block: 'center' })); } catch (e) {} }
async function openMenu(sel) {
  const btn = pg.locator(sel).first();
  await scrollTo(btn); await tryClick(btn); await pg.waitForTimeout(400);
  return pg.evaluate(() => [...document.querySelectorAll('.anchmenu [data-menuitem]')].map((e) => { const g = e.querySelector('.grow'); return { label: (g || e).textContent.trim(), disabled: e.classList.contains('disabled') || e.getAttribute('aria-disabled') === 'true' }; }));
}
async function closeMenu() { await pg.evaluate(() => { document.querySelectorAll('.anchmenu, .menucatcher').forEach((n) => n.remove()); }); }
async function menuClickLabel(label) {
  const idx = await pg.evaluate((lb) => { const items = [...document.querySelectorAll('.anchmenu [data-menuitem]')]; return items.findIndex((e) => { const g = e.querySelector('.grow'); return (g || e).textContent.trim() === lb; }); }, label);
  if (idx < 0) return false;
  await tryClick(pg.locator('.anchmenu [data-menuitem="' + idx + '"]')); await pg.waitForTimeout(800); return true;
}
const lastSrcCap = () => pg.evaluate(() => window.__store.srcCaps[window.__store.srcCaps.length - 1] || null);
const lastCap = () => pg.evaluate(() => window.__store.caps[window.__store.caps.length - 1] || null);
async function savedContents() { const cap = await lastCap(); if (!cap) return null; return cap.path === 'today-edit' ? (cap.body.layer && cap.body.layer.contents) : cap.body.contents; }

// ---------- Leg A: arrows everywhere (both fixtures, both builders' groups) ----------
await resetForm(null);
{
  const blocks = ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'];
  const allRows = [];
  for (const bl of blocks) { const rows = await groupRows(bl); (rows || []).forEach((r) => allRows.push({ block: bl, ...r })); }
  allRows.forEach((r) => console.log('  A row ' + r.block + ' ' + r.name + (r.src ? (r.spliced ? ' [spliced]' : ' [converted]') : '') + ' up=' + r.up + ' down=' + r.down));
  check('A every painted item row in F1 carries a ▲ and a ▼ control, named row by row above', allRows.length >= 20 && allRows.every((r) => r.up && r.down), allRows.filter((r) => !(r.up && r.down)));
  const spliced1 = allRows.filter((r) => r.spliced).map((r) => r.src).sort();
  check('A F1 spliced rows (saint-of-the-day · do-midafternoon-prayer · do-midday-prayer) carry the spliced-row arrows', JSON.stringify(spliced1) === JSON.stringify(['do-midafternoon-prayer', 'do-midday-prayer', 'saint-of-the-day']), spliced1);
}
await resetForm(JOHN_CONTENTS_B);
{
  const blocks = ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'];
  const allRows = [];
  for (const bl of blocks) { const rows = await groupRows(bl); (rows || []).forEach((r) => allRows.push({ block: bl, ...r })); }
  allRows.forEach((r) => console.log('  A row(F1b) ' + r.block + ' ' + r.name + (r.src ? (r.spliced ? ' [spliced]' : ' [converted]') : '') + ' up=' + r.up + ' down=' + r.down));
  check('A every painted item row in F1b carries a ▲ and a ▼ control', allRows.length >= 12 && allRows.every((r) => r.up && r.down), allRows.filter((r) => !(r.up && r.down)));
  const splicedB = allRows.filter((r) => r.spliced).map((r) => r.src).sort();
  check('A F1b forces the remaining source keys spliced — all nine source rows stand spliced across F1+F1b and every one is arrowed',
    ['do-invitatory', 'usccb-daily-readings', 'daily-gospel-exegesis', 'do-midmorning-prayer', 'do-office-of-readings', 'do-night-prayer'].every((k) => splicedB.includes(k)), splicedB);
}
// A act: a spliced arrow act moves the row (saint down in Afternoon)
await resetForm(null);
{
  const beforeRows = await groupRows('Afternoon');
  const beforeComp = await composedDescs('2026-11-27');
  const btn = pg.locator('[data-p708srcmove="Afternoon|saint-of-the-day|down"]');
  await scrollTo(btn); await tryClick(btn); await pg.waitForTimeout(900);
  const afterRows = await groupRows('Afternoon');
  const saved = await savedContents();
  const repAt = saved && saved.Afternoon ? saved.Afternoon.findIndex((x) => x.key === 'ext-saint-of-the-day') : -1;
  const afterComp = await composedDescs('2026-11-27');
  const aft = (arr) => arr.filter((x) => x.startsWith('Afternoon:'));
  check('A spliced arrow act: the saint row moves down in the painted order and the materialized list gains source:ext-saint-of-the-day at the moved position',
    JSON.stringify(beforeRows.map((r) => r.name)) !== JSON.stringify(afterRows.map((r) => r.name)) && repAt === 1, { before: beforeRows.map((r) => r.name), after: afterRows.map((r) => r.name), repAt, saved: saved && saved.Afternoon });
  check('A spliced arrow act: the composed day order follows (saint descriptor after the Auxilium descriptor)',
    aft(afterComp).indexOf('Afternoon:ext-saint-of-the-day') > aft(afterComp).indexOf('Afternoon:auxilium-christianorum') && aft(afterComp).indexOf('Afternoon:auxilium-christianorum') >= 0, { before: aft(beforeComp), after: aft(afterComp) });
  const srcCapCount = await pg.evaluate(() => window.__store.srcCaps.length);
  check('A spliced arrow act: NO store write rides the arrow act (no dual write for within-block arrows)', srcCapCount === 0, srcCapCount);
  // menu parity: a spliced row's menu carries live Move up / Move down
  const items = await openMenu('[data-p686menu="src|Afternoon|do-midafternoon-prayer|"]');
  check('A menu parity: the spliced Midafternoon menu carries Move up + Move down and NO Move to block… (not an arrow act)',
    items.some((x) => x.label === 'Move up') && items.some((x) => x.label === 'Move down') && !items.some((x) => x.label === 'Move to block…'), items);
  await closeMenu();
}

// ---------- Leg O: office discipline (the act law) ----------
{
  const pinned = ['do-invitatory', 'do-midmorning-prayer', 'do-midday-prayer', 'do-midafternoon-prayer', 'do-night-prayer'];
  const paint = await pg.evaluate((pinned) => {
    const out = {};
    document.querySelectorAll('[data-p686src]').forEach((r) => { const k = r.getAttribute('data-p686src'); out[k] = { disable: !!r.querySelector('[data-p687srcdisable]'), remove: !!r.querySelector('[data-p687srcremove], [data-p708saintremove]') }; });
    const contents = {};
    document.querySelectorAll('.p604erow:not([data-p686src])').forEach((r) => { const k = r.getAttribute('data-p604erow'); contents[k] = { disable: !!r.querySelector('[data-p687disable]'), remove: !!r.querySelector('[data-p604remove]') }; });
    return { out, contents };
  }, pinned);
  check('O the five pinned office rows paint Disable and NO Remove icon (both states — F1 spliced + converted seats)',
    pinned.every((k) => !paint.out[k] || (paint.out[k].disable && !paint.out[k].remove)), paint.out);
  check('O every non-LOH source row (saint · readings · exegesis · Office of Readings) carries Remove; no non-office row paints a Disable icon',
    ['saint-of-the-day', 'usccb-daily-readings', 'daily-gospel-exegesis', 'do-office-of-readings'].every((k) => !paint.out[k] || paint.out[k].remove)
    && Object.keys(paint.out).every((k) => pinned.includes(k) || !paint.out[k].disable), paint.out);
  check('O contents rows: every non-LOH contents row carries Remove and NO Disable; labeled-office contents items keep Disable (no Remove)',
    Object.keys(paint.contents).every((k) => { const c = paint.contents[k]; const office = k === 'source:ext-morning-prayer' || k === 'source:ext-evening-prayer'; return office ? (c.disable && !c.remove) : (c.remove && !c.disable); }), paint.contents);
  const items = await openMenu('[data-p686menu="src|Afternoon|do-midafternoon-prayer|"]');
  check('O the pinned spliced row menu carries Disable and NO Remove', items.some((x) => x.label === 'Disable') && !items.some((x) => x.label === 'Remove'), items);
  await closeMenu();
  const items2 = await openMenu('[data-p686menu="src|Morning|usccb-daily-readings|seat:daily-readings"]');
  check('O the readings menu carries Remove and NO Disable', items2.some((x) => x.label === 'Remove') && !items2.some((x) => x.label === 'Disable'), items2);
  await closeMenu();
}

// ---------- Leg S: saint Remove + Restore (spliced, today scope) ----------
await resetForm(null);
{
  await pg.evaluate(() => opnSaveSourceSettings686());
  await pg.waitForTimeout(600);
  const baseline = await lastSrcCap();
  const beforeComp = await composedDescsStanding('2026-11-27');
  const btn = pg.locator('[data-p708saintremove="Afternoon"]');
  await scrollTo(btn); await tryClick(btn); await pg.waitForTimeout(1200);
  const cap = await lastSrcCap();
  const saintRow = cap && cap.sources.find((r) => r.sourceKey === 'saint-of-the-day');
  const othersSame = !!cap && !!baseline && cap.sources.every((r) => { const br = baseline.sources.find((x) => x.sourceKey === r.sourceKey); return r.sourceKey === 'saint-of-the-day' || JSON.stringify(r) === JSON.stringify(br); });
  check('S spliced saint Remove (today): the whole-table PUT carries all 26 rows, the saint at {enabled:0, block:\'\', dayRule:\'daily\'}, every other row byte-identical',
    !!cap && cap.sources.length === 26 && !!saintRow && saintRow.enabled === 0 && saintRow.block === '' && saintRow.dayRule === 'daily' && othersSame, saintRow);
  const st = await pg.evaluate(() => ({ row: opn686Row('saint-of-the-day'), srcCount: document.querySelectorAll('[data-p686src="saint-of-the-day"]').length,
    removed: (() => { const g = document.querySelector('[data-p604exp="Afternoon"]'); const rem = g ? g.querySelector('[data-p604removed]') : null; return rem ? rem.textContent : null; })() }));
  check('S read-back stands at {enabled:0, block:\'\'}; the saint row paints in NO block; the Removed line names "Saint of the Day"',
    !!st.row && st.row.enabled === 0 && st.row.block === '' && st.srcCount === 0 && !!st.removed && st.removed.includes('Saint of the Day'), st);
  const afterComp = await composedDescsStanding('2026-11-27');
  check('S the composed day (Friday fixture, standing emission) carries no saint descriptor after Remove',
    beforeComp.some((x) => x.includes('ext-saint-of-the-day')) && !afterComp.some((x) => x.includes('ext-saint-of-the-day')), { before: beforeComp.filter((x) => x.includes('saint')), after: afterComp.filter((x) => x.includes('saint')) });
  const rst = pg.locator('[data-p708saintrestore="Afternoon|source:ext-saint-of-the-day"]');
  await scrollTo(rst); await tryClick(rst); await pg.waitForTimeout(1200);
  const st2 = await pg.evaluate(() => ({ row: opn686Row('saint-of-the-day'), srcCount: document.querySelectorAll('[data-p686src="saint-of-the-day"]').length }));
  const backComp = await composedDescsStanding('2026-11-27');

  check('S Restore (today): the store read-back stands at its captured values {block:\'Afternoon\', enabled:1}, the row repaints in Afternoon, the composed day is byte-identical to pre-Remove',
    !!st2.row && st2.row.block === 'Afternoon' && st2.row.enabled === 1 && st2.srcCount === 1 && JSON.stringify(backComp) === JSON.stringify(beforeComp), st2);
}
// ---------- Leg S: saint Remove + Restore (converted, today scope) ----------
{
  const conv = JSON.parse(JSON.stringify(JOHN_CONTENTS));
  conv.Afternoon = [{ kind: 'source', key: 'ext-saint-of-the-day' }, ...conv.Afternoon];
  await resetForm(conv);
  const beforeComp = await composedDescs('2026-11-27');
  const btn = pg.locator('[data-p708saintremove="Afternoon"]');
  await scrollTo(btn); await tryClick(btn); await pg.waitForTimeout(1200);
  const cap = await lastSrcCap();
  const saintRow = cap && cap.sources.find((r) => r.sourceKey === 'saint-of-the-day');
  const saved = await savedContents();
  const st = await pg.evaluate(() => ({ srcCount: document.querySelectorAll('[data-p686src="saint-of-the-day"]').length }));
  check('S converted saint Remove: BOTH writes land — store unplaced {enabled:0, block:\'\'} AND the representation in the removed set (saved contents carry no ext-saint-of-the-day)',
    !!saintRow && saintRow.enabled === 0 && saintRow.block === '' && !!saved && !saved.Afternoon.some((x) => x.key === 'ext-saint-of-the-day') && st.srcCount === 0, { saintRow, saved: saved && saved.Afternoon });
  const rst = pg.locator('[data-p708saintrestore="Afternoon|source:ext-saint-of-the-day"]');
  await scrollTo(rst); await tryClick(rst); await pg.waitForTimeout(1200);
  const st2 = await pg.evaluate(() => ({ row: opn686Row('saint-of-the-day'), srcCount: document.querySelectorAll('[data-p686src="saint-of-the-day"]').length }));
  const backComp = await composedDescs('2026-11-27');
  check('S converted Restore: store back at captured values, the row repaints, composition byte-identical',
    !!st2.row && st2.row.block === 'Afternoon' && st2.row.enabled === 1 && st2.srcCount === 1 && JSON.stringify(backComp) === JSON.stringify(beforeComp), st2);
}
// ---------- Leg S: saint Remove + Restore (spliced, standing scope) ----------
{
  await resetForm(null);
  await pg.evaluate(() => { opnFlipScope609(); });
  await pg.waitForTimeout(1000);
  const scopeNow = await pg.evaluate(() => opn604.scope);
  const btn = pg.locator('[data-p708saintremove="Afternoon"]');
  await scrollTo(btn); await tryClick(btn); await pg.waitForTimeout(1200);
  const cap = await lastSrcCap(); const profCap = await lastCap();
  const saintRow = cap && cap.sources.find((r) => r.sourceKey === 'saint-of-the-day');
  check('S spliced saint Remove (standing scope): the store unplaces AND the contents write rides the profiles/save path',
    scopeNow === 'standing' && !!saintRow && saintRow.enabled === 0 && saintRow.block === '' && !!profCap && profCap.path === 'save', { scopeNow, saintRow, profCap: profCap && profCap.path });
  const rst = pg.locator('[data-p708saintrestore="Afternoon|source:ext-saint-of-the-day"]');
  await scrollTo(rst); await tryClick(rst); await pg.waitForTimeout(1200);
  const st2 = await pg.evaluate(() => ({ row: opn686Row('saint-of-the-day'), srcCount: document.querySelectorAll('[data-p686src="saint-of-the-day"]').length }));
  check('S Restore (standing scope): store back at captured values and the row repaints',
    !!st2.row && st2.row.block === 'Afternoon' && st2.row.enabled === 1 && st2.srcCount === 1, st2);
  // The Add ladder's saint Daily card still paints addable after a Remove (the cross-session presence leg, §1.3c)
  await pg.evaluate(() => { opnRemoveSaint708('Afternoon'); });
  await pg.waitForTimeout(1200);
  const ladder = await pg.evaluate(() => { opnOpenAdd604('Afternoon'); return true; }).catch(() => false);
  await pg.waitForTimeout(900);
  const ladderHtml = await pg.evaluate(() => document.body.innerHTML.includes('saint-of-the-day') || document.body.textContent.includes('Saint of the Day'));
  check('S after a Remove, the Add ladder still paints (the saint Daily presence leg stands addable by its own seat)', ladder && ladderHtml, { ladder, ladderHtml });
  await pg.evaluate(() => { document.querySelectorAll('.sheet').forEach((n) => n.remove()); });
}

// ---------- Legs T + P: title pull-through + play drive ----------
{
  const tp = await pg.evaluate(async () => {
    const out = {};
    // The contents fixture for T/P: John's Afternoon + the v699 Stations item.
    window.__store.johnContents = JSON.parse(JSON.stringify(window.__store.johnContents));
    window.__store.johnContents.Afternoon = [...window.__store.johnContents.Afternoon, { kind: 'prayer', key: 'stations-of-the-cross', dayRule: 'fridays' }];
    const day = window.__mkDay('2026-11-27'); // Friday
    state.dayPayload = day; state.presentedDay = '2026-11-27'; state.storedDay = '2026-11-27';
    // Hostile order: the book NOT pre-loaded — no state.book, no device copy.
    state.book = null; try { localStorage.removeItem('opn-book-v462'); } catch (e) {}
    resolveExternals(day, { version: window.__store.version, sources: JSON.parse(JSON.stringify(window.__store.sources)) });
    (state.extStanding || []).forEach((s2) => { state.extSlots[s2.slotId] = { state: 'present', title: s2.title, enclosureUrl: 'https://x/' + s2.slotId + '.mp3', streamUrl: 'https://x/' + s2.slotId + '.mp3', durationSec: 60, source: s2.source, imageUrl: null }; });
    (state.ownStanding || []).forEach((r) => { state.ownSlots[r.sourceKey] = { state: 'present', tracks: [{ episodeId: r.episodeId, title: r.title, enclosureUrl: 'https://x/' + r.episodeId + '.mp3', durationS: 60, sizeBytes: 0, imageUrl: null }] }; });
    let descs = extRebuildDescs(day) || [];
    out.firstDesc = (() => { const d = descs.filter((x) => x.episodeId === 'prayer:stations-of-the-cross:en')[0]; return d ? { title: d.title, durationS: d.durationS } : null; })();
    // Wait for the kicked book load to settle, then re-compose (the standing re-compose runs on the settle itself).
    await new Promise((r) => setTimeout(r, 900));
    out.bookInHand = !!(state.book && state.book.groups);
    descs = extRebuildDescs(day) || [];
    state.dayDescs = descs;
    const d = descs.filter((x) => x.episodeId === 'prayer:stations-of-the-cross:en')[0] || null;
    out.desc = d ? { episodeId: d.episodeId, kind: d.kind, title: d.title, durationS: d.durationS, url: d.url, available: d.available, block: d.block } : null;
    if (!d) return out;
    // Device-copy path: book NOT in state, copy in localStorage — composition resolves synchronously.
    state.book = null;
    try { localStorage.setItem('opn-book-v462', JSON.stringify({ fetchedAt: new Date().toISOString(), groups: [{ category: 'The Raccolta', prayers: [{ slug: 'stations-of-the-cross', title: 'Stations of the Cross', body: 'S1', audio: { en: 1011.8 } }] }] })); } catch (e) {}
    const descs2 = extRebuildDescs(day) || [];
    const d2 = descs2.filter((x) => x.episodeId === 'prayer:stations-of-the-cross:en')[0] || null;
    out.copyDesc = d2 ? { title: d2.title, durationS: d2.durationS } : null;
    state.book = { groups: [{ category: 'The Raccolta', prayers: [{ slug: 'stations-of-the-cross', title: 'Stations of the Cross', body: 'S1', audio: { en: 1011.8 } }] }] };
    // Readers: Praylist row · dock · Now Playing (the track page's paint seat).
    out.card = trackCard(d);
    state.current = d; updateDock();
    const dock = document.getElementById('dock');
    out.dock = dock ? dock.textContent : '';
    openNowPlaying(); await new Promise((r) => setTimeout(r, 300));
    out.nowPlaying = document.body.textContent.includes('Stations of the Cross');
    out.nowPlayingSlug = document.body.textContent.includes('stations-of-the-cross');
    // Play drive:
    const live = queueLiveDesc(d);
    out.queueLive = live ? { title: live.title, durationS: live.durationS } : null;
    const nc = nativeContractItem(d);
    out.contract = nc ? { id: nc.id, kind: nc.kind, mediaUri: nc.mediaUri, durationS: nc.durationS } : null;
    playTrack(d);
    return out;
  });
  check('T the contents-prayer descriptor, composed with the book NOT pre-loaded, settles to title "Stations of the Cross" + durationS 1011.8 (the kicked load lands the book in hand)',
    !!tp.desc && tp.desc.title === 'Stations of the Cross' && tp.desc.durationS === 1011.8 && tp.bookInHand === true, tp.desc);
  check('T the device-copy path resolves synchronously: title "Stations of the Cross" + durationS 1011.8 with state.book null',
    !!tp.copyDesc && tp.copyDesc.title === 'Stations of the Cross' && tp.copyDesc.durationS === 1011.8, tp.copyDesc);
  check('T the Praylist row, the dock, and Now Playing each paint "Stations of the Cross" and none paints the slug as a title',
    !!tp.card && tp.card.includes('Stations of the Cross') && !tp.card.includes('>stations-of-the-cross<') && tp.dock.includes('Stations of the Cross') && !tp.dock.includes('stations-of-the-cross') && tp.nowPlaying === true && tp.nowPlayingSlug === false,
    { card: tp.card && tp.card.slice(0, 200), dock: tp.dock.slice(0, 200), np: tp.nowPlaying, npSlug: tp.nowPlayingSlug });
  check('P queueLiveDesc stands the Stations descriptor as itself (title + duration carried)',
    !!tp.queueLive && tp.queueLive.title === 'Stations of the Cross' && tp.queueLive.durationS === 1011.8, tp.queueLive);
  check('P nativeContractItem is non-null, kind \'prayer\' (its own kind, not the own-episode fallback), mediaUri = origin + the book-audio URL, durationS 1011.8',
    !!tp.contract && tp.contract.kind === 'prayer' && tp.contract.mediaUri.endsWith('/api/prayer/book/audio/stations-of-the-cross/en') && tp.contract.durationS === 1011.8, tp.contract);
  await pg.waitForTimeout(2500);
  const el = await pg.evaluate(() => { const a = document.querySelector('audio'); return a ? { src: a.src, readyState: a.readyState, paused: a.paused, currentTime: a.currentTime, error: a.error ? a.error.code : null } : null; });
  check('P startDesc ran without a pass-over: the element loads the book-audio URL and plays (readyState >= 2, time advancing, no error)',
    !!el && el.src.endsWith('/api/prayer/book/audio/stations-of-the-cross/en') && el.readyState >= 2 && el.paused === false && el.currentTime > 0 && el.error === null, el);
  // Served-route proof against the harness's real Worker:
  const r1 = await WORKER.fetch(new Request('https://app.local/api/prayer/book/audio/stations-of-the-cross/en'), ENV);
  const r2 = await WORKER.fetch(new Request('https://app.local/api/prayer/book/audio/stations-of-the-cross/en', { headers: { range: 'bytes=0-99' } }), ENV);
  check('P the descriptor URL against the real Worker answers 200 audio/mpeg with a non-zero content-length, and a Range GET answers 206 with a content-range',
    r1.status === 200 && r1.headers.get('content-type') === 'audio/mpeg' && Number(r1.headers.get('content-length')) > 0 && r2.status === 206 && !!r2.headers.get('content-range'),
    { s1: r1.status, len: r1.headers.get('content-length'), s2: r2.status, cr: r2.headers.get('content-range') });
}

await b.close();
server.close();
console.log('\nharness-v708 groups: ' + Object.entries(groups).map(([g, v]) => g + ' ' + v.ok + '/' + (v.ok + v.bad)).join(' · '));
console.log('harness-v708: ' + ok + ' ok, ' + bad + ' bad');
process.exit(bad ? 1 : 0);
