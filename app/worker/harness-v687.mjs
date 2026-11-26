// harness-v687.mjs — v687: Edit form source rows — layout,
// dedupe, movable, removable, menu + disable (Plan §2.10,
// read through Amendment A §1.4).
//
// Modeled on harness-v686.mjs: playwright-core Chromium,
// the REAL built Worker bundle (esbuild from source) served
// locally, the API stubbed in-page (the v686 world verbatim:
// the 26 seed rows, whole-table source-settings PUTs,
// profile PUTs captured).
//
// Fixtures (Improvement D — production shapes, sources
// named):
//  - John's real Morning as screenshotted 2026-11-26 (the
//    v687 field report): Invitatory source row · Saint
//    daily item · Morning Offering · the readings seat item
//    · a stray {kind:'source', key:'ext-usccb-readings'}
//    item · Morning Prayer office item · Daily Rosary ·
//    Marian Antiphon — plus a synthetic stray second
//    {kind:'source', key:'ext-invitatory'} copy (§2.4's
//    class proof).
//  - An Evening fixture (Office of Readings source row +
//    Evening Prayer office item) and an Afternoon fixture
//    (Saint of the Day source row) per §2.10.
//  - The Salesian Way default profile (no stored contents)
//    as the second fixture profile for the composition gate.
//
// Legs L1–L12 per §2.10 read through §1.4's act table.
// Composition gate: COMPOSED lines print FIRST — run with
// ORA_WT=<pre-change tree> and diff the COMPOSED lines.
//
// Run: node app/worker/harness-v687.mjs
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

// ---------- build + serve the real bundle ----------
const TMP = mkdtempSync(tmpdir() + '/v687harness-');
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

// ---------- world (the v686 stub world) ----------
const b = await chromium.launch({ executablePath: EXE });
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
pg.on('pageerror', (e) => console.log('PAGEERROR ' + String(e).slice(0, 200)));
await pg.addInitScript(({ SEED, JOHN_CONTENTS, JOHN_CORE, SAL_CORE, SEAT }) => {
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const freshStore = () => ({
    standing: 'john',
    johnContents: clone(JOHN_CONTENTS), salContents: null,
    todayLayer: null,
    caps: [], srcCaps: [],
    sources: clone(SEED), version: 1,
  });
  window.__store = freshStore();
  window.__reset687 = () => { window.__store = freshStore(); };
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
      // the app's fold semantics: a standing today layer's
      // contents replace the profile's per block.
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
        const seen = {};
        for (const s2 of (body.sources || [])) {
          if (!stored[s2.sourceKey] || seen[s2.sourceKey]) return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ error: 'bad set' }), text: () => Promise.resolve('') });
          seen[s2.sourceKey] = 1;
        }
        if (Object.keys(seen).length !== window.__store.sources.length) return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ error: 'bad set' }), text: () => Promise.resolve('') });
        const counters = {};
        (body.sources || []).forEach((s2) => {
          const r = stored[s2.sourceKey];
          r.block = s2.block == null ? '' : s2.block; r.dayRule = s2.dayRule; r.enabled = s2.enabled;
          if (r.enabled === 1 && r.block !== '') { counters[r.block] = (counters[r.block] || 0) + 1; r.sortOrder = counters[r.block]; } else r.sortOrder = null;
        });
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
    if (u.includes('/api/player/day')) { const m = /date=([0-9-]+)/.exec(u); return resp(window.__mkDay(m ? m[1] : '2026-11-25')); }
    if (u.includes('/api/player/podcasts')) return resp({ ok: true, seriesList: [] });
    if (u.includes('/api/player/track-draws')) return resp({ ok: true, draws: {} });
    return new Promise(() => {});
  };
}, { SEED, JOHN_CONTENTS, JOHN_CORE, SAL_CORE, SEAT });
await pg.goto('http://127.0.0.1:' + PORT + '/');
await pg.waitForTimeout(1500);

// ---------- composition gate lines (printed first) ----------
async function composedDescs(pk, date) {
  return pg.evaluate(async ({ pk, date }) => {
    window.__store.standing = pk;
    const day = window.__mkDay(date);
    state.dayPayload = day;
    resolveExternals(day, { version: window.__store.version, sources: JSON.parse(JSON.stringify(window.__store.sources)) });
    (state.extStanding || []).forEach((s2) => { state.extSlots[s2.slotId] = { state: 'present', title: s2.title, enclosureUrl: 'https://x/' + s2.slotId + '.mp3', streamUrl: 'https://x/' + s2.slotId + '.mp3', durationSec: 60, source: s2.source, imageUrl: null }; });
    (state.ownStanding || []).forEach((r) => { state.ownSlots[r.sourceKey] = { state: 'present', tracks: [{ episodeId: r.episodeId, title: r.title, enclosureUrl: 'https://x/' + r.episodeId + '.mp3', durationS: 60, sizeBytes: 0, imageUrl: null }] }; });
    const descs = extRebuildDescs(day) || [];
    window.__store.standing = 'john';
    return descs.map((d) => (d.block || d._block || '?') + ':' + d.episodeId);
  }, { pk, date });
}
const compLines = [];
for (const pk of ['john', 'salesian']) for (const date of ['2026-11-25', '2026-11-29']) {
  const ids = await composedDescs(pk, date).catch((e) => ['ERROR ' + String(e).slice(0, 160)]);
  compLines.push('COMPOSED ' + pk + ' ' + date + ' ' + JSON.stringify(ids));
}
compLines.forEach((l) => console.log(l));
check('GATE composition lines stand for both fixture profiles x weekday/Sunday', compLines.length === 4 && compLines.every((l) => l.startsWith('COMPOSED ')), compLines.length);
const compJohnWed = await composedDescs('john', '2026-11-25');

async function openForm() {
  await pg.evaluate(async () => {
    window.__store.standing = 'john';
    state.dayPayload = window.__mkDay('2026-11-25');
    state.tab = 'prayers'; state.prayersView = { kind: 'home' };
    opn604.res = null; opn604.lists = {}; opn604.base = {}; opn604.removed = {};
    opnEnterEdit607();
  });
  await pg.waitForTimeout(1300);
}
const groupSeq = (block) => pg.evaluate((bl) => {
  const g = document.querySelector('[data-p604exp="' + bl + '"]');
  if (!g) return null;
  return [...g.querySelectorAll('.p604erow')].map((r) => r.hasAttribute('data-p686src') ? 'SRC:' + r.getAttribute('data-p686src') : 'C:' + r.getAttribute('data-p604erow'));
}, block);
async function tryClick(loc) { try { await loc.click({ timeout: 4000 }); return true; } catch (e) { return false; } }
async function scrollTo(loc) { try { await loc.evaluate((el) => el.scrollIntoView({ block: 'center' })); } catch (e) {} }
async function openMenu(sel) {
  const btn = pg.locator(sel).first();
  await scrollTo(btn);
  await tryClick(btn);
  await pg.waitForTimeout(400);
  return pg.evaluate(() => [...document.querySelectorAll('.anchmenu [data-menuitem]')].map((e) => { const g = e.querySelector('.grow'); return (g || e).textContent.trim(); }));
}
async function closeMenu() { await pg.evaluate(() => { document.querySelectorAll('.anchmenu, .menucatcher').forEach((n) => n.remove()); }); }
async function menuClick(idx) { await tryClick(pg.locator('.anchmenu [data-menuitem="' + idx + '"]')); await pg.waitForTimeout(700); }
const lastCap = () => pg.evaluate(() => window.__store.caps[window.__store.caps.length - 1] || null);
async function savedContents() {
  const cap = await lastCap();
  if (!cap) return null;
  return cap.path === 'today-edit' ? (cap.body.layer && cap.body.layer.contents) : cap.body.contents;
}

// ---------- L1 + L3 + L12: paint, layout, dedupe, subtitles ----------
await openForm();
{
  const seq = await groupSeq('Morning');
  check('L3 Morning painted entries: readings stand ONCE as the source row; the stray ext-usccb-readings item and the stray ext-invitatory copy never paint',
    JSON.stringify(seq) === JSON.stringify(['SRC:do-invitatory', 'C:daily:saint-of-the-day', 'C:source:morning-prayer', 'SRC:usccb-daily-readings', 'C:source:ext-morning-prayer', 'C:source:daily-rosary', 'C:source:marian-antiphon']), seq);
  const paint = await pg.evaluate(() => {
    const form = document.querySelector('.p609edit');
    const titles = [...document.querySelectorAll('.p609edit .p687title')].map((t) => t.textContent.trim());
    const removedLines = [...document.querySelectorAll('[data-p604removed]')].map((t) => t.textContent);
    let overflow = [];
    if (form) [...form.querySelectorAll('*')].forEach((el) => { const r = el.getBoundingClientRect(); if (r.width && (r.right > 391 || r.left < -1)) overflow.push(el.className + ':' + Math.round(r.right)); });
    const srcTitles = [...document.querySelectorAll('[data-p686src]')].map((r) => { const t = r.querySelector('.p687title'); const g = r.querySelector('.grow'); return { t: t.textContent.trim(), w: Math.round(t.getBoundingClientRect().width), gw: Math.round(g.getBoundingClientRect().width) }; });
    const badControls = [];
    document.querySelectorAll('.p609edit .p604erow').forEach((row) => {
      const rr = row.getBoundingClientRect();
      row.querySelectorAll('button, .segtoggle').forEach((c) => { const cr = c.getBoundingClientRect(); if (cr.left < rr.left - 1 || cr.right > rr.right + 1) badControls.push(row.getAttribute('data-p686src') || row.getAttribute('data-p604erow')); });
    });
    return { titles, removedLines, overflow: overflow.slice(0, 6), srcTitles, badControls,
      selects: form ? form.querySelectorAll('select').length : -1,
      pin: form ? form.textContent.includes('\u{1F4CC}') : null,
      readingsCount: document.querySelectorAll('[data-p686src="usccb-daily-readings"]').length,
      invCount: document.querySelectorAll('[data-p686src="do-invitatory"]').length };
  });
  check('L1 no <select> and no pin glyph anywhere in the form', paint.selects === 0 && paint.pin === false, paint);
  check('L1 no element in the form overflows the 390px viewport and every control box stands inside its row box',
    paint.overflow.length === 0 && paint.badControls.length === 0, { overflow: paint.overflow, badControls: paint.badControls });
  check('L1 every source-row title paints its FULL text and its grow column stands >= 100px (the §2.10 140px title-box figure predates Amendment A row acts — deviation named in §3)',
    paint.srcTitles.length >= 10 && paint.srcTitles.every((x) => x.gw >= 100 && x.w >= 50), paint.srcTitles);
  check('L3 the readings paint exactly once and the Invitatory exactly once', paint.readingsCount === 1 && paint.invCount === 1, paint);
  check('L3 no row title or Removed line paints a raw ext- id', paint.titles.every((t) => !/^ext-/.test(t)) && paint.removedLines.every((t) => !/(^|\s)ext-/.test(t)), { titles: paint.titles, removedLines: paint.removedLines });
  const subs = await pg.evaluate(() => {
    const out = {};
    document.querySelectorAll('[data-p686src]').forEach((r) => { const s = r.querySelector('.p687sub'); out[r.getAttribute('data-p686src')] = s ? s.textContent.trim() : null; });
    const dailyRow = document.querySelector('[data-p604erow="daily:saint-of-the-day"]');
    out.__dailyTitle = dailyRow ? dailyRow.querySelector('.p687title').textContent.trim() : null;
    out.__dailySub = dailyRow ? (dailyRow.querySelector('.p687sub') || {}).textContent : null;
    return out;
  });
  check('L12 every source row paints its §2.8 subtitle for its standing dayRule',
    subs['do-invitatory'] === 'Generates daily' && subs['usccb-daily-readings'] === 'Generates daily'
    && subs['fr-mike-homily'] === 'Generates Sundays' && subs['stations-of-the-cross'] === 'Generates Fridays', subs);
  check('L12 the daily contents item paints its title without the " · Daily" suffix + subtitle "Generates daily"',
    !!subs.__dailyTitle && !subs.__dailyTitle.includes('· Daily') && (subs.__dailySub || '').trim() === 'Generates daily', subs);
}

// ---------- L2: toggle alignment ----------
{
  const m = await pg.evaluate(() => {
    const rights = (sel) => [...document.querySelectorAll(sel)].map((e) => Math.round(e.getBoundingClientRect().right));
    const g = document.querySelector('[data-p604exp="Morning"]');
    const tog = [...g.querySelectorAll('[data-p686src] [data-p686toggle]')].map((e) => Math.round(e.getBoundingClientRect().right));
    const rem = [...g.querySelectorAll('[data-p604erow]:not([data-p686src]) [data-p604remove]')].map((e) => Math.round(e.getBoundingClientRect().right));
    return { tog, rem };
  });
  check('L2 each Morning source row toggle right edge == the contents rows Remove-icon right edge (±2px)',
    m.tog.length >= 2 && m.rem.length >= 3 && m.tog.every((t) => m.rem.every((r) => Math.abs(t - r) <= 2)), m);
}

// ---------- L11: office segtoggle seat ----------
{
  const m = await pg.evaluate(() => {
    const row = document.querySelector('[data-p604erow="source:ext-morning-prayer"]');
    if (!row) return null;
    const tog = row.querySelector('[data-p670toggle]').getBoundingClientRect();
    const title = row.querySelector('.p687title').getBoundingClientRect();
    const rr = row.getBoundingClientRect();
    const inter = !(tog.right <= title.left || tog.left >= title.right || tog.bottom <= title.top || tog.top >= title.bottom);
    return { inter, fits: tog.left >= rr.left - 1 && tog.right <= rr.right + 1 };
  });
  check('L11 the office segtoggle box does not intersect the title box and fits the row', !!m && m.inter === false && m.fits === true, m);
}

// ---------- L7: the §1.4 menu table ----------
{
  const daily = await openMenu('[data-p686menu="Morning|daily:saint-of-the-day"]');
  // superseded-by-v690: v690 Plan §2.4 extends the contents menu with the Frequency section (Move · Frequency · five paint values · Remove) — the exact array harness-v690 L4 proves.
  check('L7 contents row menu: Move to block… · Frequency · Remove (no Disable)', JSON.stringify(daily) === JSON.stringify(['Move to block…', 'Frequency — Daily', 'Daily', 'Weekdays only', 'Weekends only', 'Sundays only', 'Fridays only', 'Remove']), daily);
  await closeMenu();
  const office = await openMenu('[data-p686menu="Morning|source:ext-morning-prayer"]');
  // superseded-by-v690: same Frequency-section extension, Disable seat unchanged at the tail.
  check('L7 office contents menu: Move to block… · Frequency · Disable (no Remove)', JSON.stringify(office) === JSON.stringify(['Move to block…', 'Frequency — Daily', 'Daily', 'Weekdays only', 'Weekends only', 'Sundays only', 'Fridays only', 'Disable']), office);
  await closeMenu();
  const pinned = await openMenu('[data-p686menu="src|Morning|do-invitatory|source:ext-invitatory"]');
  // RE-POINTED BY v691 (prescribed, Plan §2.6 regression note as amended): Move to block… stands after Move up/down on EVERY block row — the pinned five's refusals withdrawn (Amendment 2).
  check('L7 pinned source menu: Move up · Move down · Move to block… · Frequency (standing value named) · Disable — no Remove',
    JSON.stringify(pinned) === JSON.stringify(['Move up', 'Move down', 'Move to block…', 'Frequency — Daily', 'Daily', 'Sundays only', 'Fridays only', 'Disable']), pinned);
  await closeMenu();
  const readings = await openMenu('[data-p686menu="src|Morning|usccb-daily-readings|seat:daily-readings"]');
  // RE-POINTED BY v691: the readings refusal withdrawn (Amendment 1) — the readings row takes Move to block… live.
  check('L7 readings source menu: Move up · Move down · Move to block… · Frequency · Remove (no Disable)',
    JSON.stringify(readings) === JSON.stringify(['Move up', 'Move down', 'Move to block…', 'Frequency — Daily', 'Daily', 'Sundays only', 'Fridays only', 'Remove']), readings);
  await closeMenu();
  const oor = await openMenu('[data-p686menu="src|Evening|do-office-of-readings|source:ext-office-of-readings"]');
  check('L7 Office of Readings menu: Move up · Move down · Move to block… · Frequency · Remove (the named exception is removable)',
    JSON.stringify(oor) === JSON.stringify(['Move up', 'Move down', 'Move to block…', 'Frequency — Daily', 'Daily', 'Sundays only', 'Fridays only', 'Remove']), oor);
  await closeMenu();
  const closing = await openMenu('[data-p686menu="src||fr-mike-homily|"]');
  check('L7 closing row menu: Frequency only', JSON.stringify(closing) === JSON.stringify(['Frequency — Sundays only', 'Daily', 'Sundays only', 'Fridays only']), closing);
  await closeMenu();
  const rowActs = await pg.evaluate(() => {
    const q = (sel) => document.querySelector(sel);
    const inv = q('[data-p686src="do-invitatory"]');
    const read = q('[data-p686src="usccb-daily-readings"]');
    const oor2 = q('[data-p686src="do-office-of-readings"]');
    const offRow = q('[data-p604erow="source:ext-morning-prayer"]');
    const dailyRow = q('[data-p604erow="daily:saint-of-the-day"]');
    const close2 = q('[data-p686src="fr-mike-homily"]');
    return {
      invDisable: !!inv.querySelector('[data-p687srcdisable]'), invRemove: !!inv.querySelector('[data-p687srcremove]'), invMove: !!inv.querySelector('[data-p684move]'),
      readRemove: !!read.querySelector('[data-p687srcremove]'), readDisable: !!read.querySelector('[data-p687srcdisable]'),
      oorRemove: !!oor2.querySelector('[data-p687srcremove]'),
      officeDisableIcon: !!offRow.querySelector('[data-p687disable]'), officeRemove: !!offRow.querySelector('[data-p604remove]'), officeText: offRow.textContent.includes('Remove'),
      dailyRemoveIcon: !!dailyRow.querySelector('[data-p604remove] svg'), dailyTextBtn: [...dailyRow.querySelectorAll('button')].some((x) => x.textContent.trim() === 'Remove'),
      closingActs: { move: !!close2.querySelector('[data-p684move]'), icon: !!close2.querySelector('[data-p687srcremove],[data-p687srcdisable]'), toggle: !!close2.querySelector('[data-p686toggle]') },
    };
  });
  check('L7 row icons per §1.4: pinned = Disable icon + ▲▼, no Remove · readings/OoR = Remove icon · office contents = Disable icon, no Remove · other contents = Remove ICON (no text button) · closing = toggle only',
    rowActs.invDisable && !rowActs.invRemove && rowActs.invMove && rowActs.readRemove && !rowActs.readDisable && rowActs.oorRemove
    && rowActs.officeDisableIcon && !rowActs.officeRemove && rowActs.dailyRemoveIcon && !rowActs.dailyTextBtn
    && !rowActs.closingActs.move && !rowActs.closingActs.icon && rowActs.closingActs.toggle, rowActs);
}

// ---------- L4: move a gated slot source row ----------
{
  const before = await composedDescs('john', '2026-11-25');
  const btn = pg.locator('[data-p684move="Morning|source:ext-invitatory|down"]');
  await scrollTo(btn); await tryClick(btn); await pg.waitForTimeout(700);
  await tryClick(pg.locator('[data-p684move="Morning|source:ext-invitatory|down"]')); await pg.waitForTimeout(700);
  const after = await composedDescs('john', '2026-11-25');
  const morn = (arr) => arr.filter((x) => x.startsWith('Morning:'));
  check('L4 Invitatory moved down twice: the composed day seats Morning Offering before the Invitatory',
    morn(after).indexOf('Morning:morning-prayer') >= 0 && morn(after).indexOf('Morning:ext-invitatory') > morn(after).indexOf('Morning:morning-prayer')
    && morn(before).indexOf('Morning:ext-invitatory') < morn(before).indexOf('Morning:morning-prayer'), { before: morn(before), after: morn(after) });
  await tryClick(pg.locator('[data-p684move="Morning|source:ext-invitatory|up"]')); await pg.waitForTimeout(700);
  await tryClick(pg.locator('[data-p684move="Morning|source:ext-invitatory|up"]')); await pg.waitForTimeout(700);
  const back = await composedDescs('john', '2026-11-25');
  check('L4 moved back: composition byte-identical to the start', JSON.stringify(back) === JSON.stringify(before), { before, back });
}

// ---------- L5: move the readings ----------
{
  const before = await composedDescs('john', '2026-11-25');
  const seatId = 'Morning:usccb-readings-2026-11-25';
  check('L5 standing seat: the readings descriptor stands before the Rosary in the composed day',
    before.indexOf(seatId) >= 0 && before.indexOf(seatId) < before.indexOf('Morning:daily-rosary'), before.filter((x) => x.startsWith('Morning:')));
  for (let i = 0; i < 3; i++) { const b5 = pg.locator('[data-p684move="Morning|seat:daily-readings|down"]'); await scrollTo(b5); await tryClick(b5); await pg.waitForTimeout(700); }
  const after = await composedDescs('john', '2026-11-25');
  check('L5 readings moved below the Rosary item: the composed day seats the readings descriptor AFTER the Rosary',
    after.indexOf(seatId) > after.indexOf('Morning:daily-rosary') && after.indexOf('Morning:daily-rosary') >= 0, after.filter((x) => x.startsWith('Morning:')));
  for (let i = 0; i < 3; i++) { const b6 = pg.locator('[data-p684move="Morning|seat:daily-readings|up"]'); await scrollTo(b6); await tryClick(b6); await pg.waitForTimeout(700); }
  const back = await composedDescs('john', '2026-11-25');
  check('L5 moved back: composition byte-identical to the start', JSON.stringify(back) === JSON.stringify(before), { before, back });
}

// ---------- L8: disable an office contents item ----------
{
  const before = await composedDescs('john', '2026-11-25');
  const btn = pg.locator('[data-p687disable="Morning|source:ext-morning-prayer"]');
  await scrollTo(btn); await tryClick(btn); await pg.waitForTimeout(900);
  const dim = await pg.evaluate(() => { const r = document.querySelector('[data-p604erow="source:ext-morning-prayer"]'); return r ? r.classList.contains('p687dim') : null; });
  const saved = await savedContents();
  const item = saved && saved.Morning ? saved.Morning.filter((x) => x.key === 'ext-morning-prayer')[0] : null;
  const after = await composedDescs('john', '2026-11-25');
  check('L8 office Disable: the whole row dims and the saved item carries off: 1 (side preserved)',
    dim === true && !!item && item.off === 1 && item.side === 'sth', { dim, item });
  check('L8 office Disable: the composed day drops the Morning Prayer office descriptor',
    before.some((x) => x.includes('ext-morning-prayer')) && !after.some((x) => x.includes('ext-morning-prayer')), { before: before.filter((x) => x.includes('ext-morning')), after: after.filter((x) => x.includes('ext-morning')) });
  const labels = await openMenu('[data-p686menu="Morning|source:ext-morning-prayer"]');
  // superseded-by-v690: the Frequency section (v690 Plan §2.4) stands between Move and Enable — expected array extended, Enable's click index re-pointed 1 → 7.
  check('L8 the disabled office row menu act reads Enable', JSON.stringify(labels) === JSON.stringify(['Move to block…', 'Frequency — Daily', 'Daily', 'Weekdays only', 'Weekends only', 'Sundays only', 'Fridays only', 'Enable']), labels);
  await menuClick(7); // superseded-by-v690: Enable's seat in the extended array
  const dim2 = await pg.evaluate(() => { const r = document.querySelector('[data-p604erow="source:ext-morning-prayer"]'); return r ? r.classList.contains('p687dim') : null; });
  const back = await composedDescs('john', '2026-11-25');
  check('L8 Enable: row undimmed and composition byte-identical to the start', dim2 === false && JSON.stringify(back) === JSON.stringify(before), { dim2 });
}

// ---------- L9: disable a pinned source row ----------
{
  const before = await composedDescs('john', '2026-11-25');
  const btn = pg.locator('[data-p687srcdisable="do-invitatory"]');
  await scrollTo(btn); await tryClick(btn); await pg.waitForTimeout(900);
  const st = await pg.evaluate(() => {
    const r = document.querySelector('[data-p686src="do-invitatory"]');
    return { enabled: opn686Row('do-invitatory').enabled, dim: r ? r.classList.contains('p687dim') : null };
  });
  const standings = await pg.evaluate(() => {
    const day = window.__mkDay('2026-11-25'); state.dayPayload = day;
    resolveExternals(day, { version: window.__store.version, sources: JSON.parse(JSON.stringify(window.__store.sources)) });
    return (state.extStanding || []).map((s2) => s2.slotId);
  });
  check('L9 pinned Disable: the store reads enabled 0, the whole row dims, the composed standings drop the Invitatory',
    st.enabled === 0 && st.dim === true && !standings.includes('ext-invitatory'), { st, standings });
  const labels = await openMenu('[data-p686menu="src|Morning|do-invitatory|source:ext-invitatory"]');
  check('L9 the disabled pinned row menu act reads Enable', labels[labels.length - 1] === 'Enable', labels);
  await menuClick(labels.length - 1);
  const st2 = await pg.evaluate(() => opn686Row('do-invitatory').enabled);
  const back = await composedDescs('john', '2026-11-25');
  check('L9 Enable: store back On and composition byte-identical', st2 === 1 && JSON.stringify(back) === JSON.stringify(before), { st2 });
}

// ---------- L10: frequency via the menu (v686 L3 re-pointed) ----------
{
  const labels = await openMenu('[data-p686menu="src|Morning|do-invitatory|source:ext-invitatory"]');
  // RE-POINTED BY v691: Move to block… (index 2) shifts the Frequency section one seat — head 2 → 3, Sundays 4 → 5, Daily 3 → 4.
  check('L10 the Frequency pick names the standing value (Daily)', labels[3] === 'Frequency — Daily', labels);
  await menuClick(5); // Sundays (v691 re-point: was 4)
  const row = await pg.evaluate(() => opn686Row('do-invitatory'));
  const sub = await pg.evaluate(() => { const r = document.querySelector('[data-p686src="do-invitatory"] .p687sub'); return r ? r.textContent.trim() : null; });
  check('L10 menu pick writes Sundays to the store read-back and the subtitle repaints "Generates Sundays"',
    !!row && row.dayRule === 'sundays' && sub === 'Generates Sundays', { row, sub });
  const gates = await pg.evaluate(() => {
    const out = {};
    for (const date of ['2026-11-25', '2026-11-29']) {
      const day = window.__mkDay(date); state.dayPayload = day;
      resolveExternals(day, { version: window.__store.version, sources: JSON.parse(JSON.stringify(window.__store.sources)) });
      out[date] = (state.extStanding || []).map((s2) => s2.slotId);
    }
    return out;
  });
  check('L10 a Sunday fixture day composes with the source while a weekday drops it',
    !gates['2026-11-25'].includes('ext-invitatory') && gates['2026-11-29'].includes('ext-invitatory'), gates);
  const labels2 = await openMenu('[data-p686menu="src|Morning|do-invitatory|source:ext-invitatory"]');
  await menuClick(4); // Daily (v691 re-point: was 3)
  const row2 = await pg.evaluate(() => opn686Row('do-invitatory'));
  check('L10 changed back to Daily in the read-back', !!row2 && row2.dayRule === 'daily', row2);
}

// ---------- L6: remove / restore a non-office source row ----------
{
  const before = await composedDescs('john', '2026-11-25');
  const btn = pg.locator('[data-p687srcremove="Afternoon|source:ext-saint-of-the-day"]');
  await scrollTo(btn); await tryClick(btn); await pg.waitForTimeout(900);
  const st = await pg.evaluate(() => {
    const g = document.querySelector('[data-p604exp="Afternoon"]');
    const rem = g ? g.querySelector('[data-p604removed]') : null;
    return { srcCount: document.querySelectorAll('[data-p686src="saint-of-the-day"]').length, removed: rem ? rem.textContent : null };
  });
  const after = await composedDescs('john', '2026-11-25');
  check('L6 Remove: the Saint of the Day source row leaves the form and stands in the Removed line under its proper name (no raw ext- id)',
    st.srcCount === 0 && !!st.removed && st.removed.includes('Saint of the Day') && !/(^|\s)ext-/.test(st.removed), st);
  check('L6 Remove: the composed day lacks the Saint of the Day descriptor',
    before.some((x) => x.includes('ext-saint-of-the-day')) && !after.some((x) => x.includes('ext-saint-of-the-day')), {});
  const rst = pg.locator('[data-p604restore="Afternoon|source:ext-saint-of-the-day"]');
  await scrollTo(rst); await tryClick(rst); await pg.waitForTimeout(900);
  const backCount = await pg.evaluate(() => document.querySelectorAll('[data-p686src="saint-of-the-day"]').length);
  const back = await composedDescs('john', '2026-11-25');
  check('L6 Restore: the source row stands back at its seat and composition is byte-identical',
    backCount === 1 && JSON.stringify(back) === JSON.stringify(before), { backCount });
}

// ---------- validator legs (real extracted validators) ----------
{
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
  let SV = null;
  try {
    // RE-POINTED BY v690 (Review, recipe only — no assertion touched): the
    // extraction strip strings follow the validateProfileContents signature
    // widened by v690 Plan §2.2 S2 (dayRule?: string carriage).
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
    SV = new Function(vBody + '\nreturn validateProfileContents;')();
  } catch (e) { check('V the real index.ts validator extracts standalone', false, e.message); }
  if (SV) {
    const CORE = ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'];
    const withOff = { Morning: [{ kind: 'source', key: 'ext-morning-prayer', side: 'do', off: 1 }] };
    const r1 = SV(withOff, CORE);
    check('V server validator preserves off: 1 on a labeled-slot office item (side preserved too)',
      !r1.error && !!r1.normalized && r1.normalized.Morning[0].off === 1 && r1.normalized.Morning[0].side === 'do', r1);
    const strayOff = { Morning: [{ kind: 'source', key: 'ext-invitatory', off: 1 }, { kind: 'daily', key: 'saint-of-the-day', off: 1 }] };
    const r2 = SV(strayOff, CORE);
    check('V server validator does NOT carry off on a non-office item (Amendment A scope)',
      !r2.error && !!r2.normalized && !('off' in r2.normalized.Morning[0]) && !('off' in r2.normalized.Morning[1]), r2);
  }
  const clientOff = await pg.evaluate(() => {
    const out = opnCheckContents590({ Morning: [{ kind: 'source', key: 'ext-evening-prayer', side: 'sth', off: 1 }, { kind: 'source', key: 'ext-invitatory', off: 1 }] }, ['Morning']);
    return out.Morning;
  }).catch((e) => String(e));
  check('V client validator mirrors: off preserved on the office item only',
    Array.isArray(clientOff) && clientOff[0].off === 1 && clientOff[0].side === 'sth' && !('off' in clientOff[1]), clientOff);
}

await b.close();
server.close();
console.log('\nharness-v687: ' + ok + ' ok, ' + bad + ' bad');
process.exit(bad ? 1 : 0);
