// harness-v686.mjs — v686: Edit-screen merge (Design 2).
// Source rows interleaved at composed seats in the Edit form,
// the closing Mass and Homilies section, the Settings
// source-editor deletion, the whole-table write path, and the
// Move act (Plan §2.7, release doc v686).
//
// Modeled on harness-v684.mjs: playwright-core Chromium, the
// REAL built Worker bundle (esbuild from source) served
// locally, the API stubbed in-page. The source-settings stub
// serves the 26 seed rows (extracted from this tree's
// OPN_SEED_SOURCES — the production seed shape) in
// sourceSettingsPayload shape and applies PUTs as the
// production route does (whole-set validation + gapless
// per-block renumber in body order, version bump).
//
// Fixtures (Improvement D — production shapes, sources named):
//  - John's real Morning block (the v683 fixture shape):
//    invitatory · Saint daily · Morning Offering · readings
//    seat · Morning Prayer · Daily Rosary · Marian Antiphon,
//    plus his other blocks' standing contents; Midday stands
//    OFF (not in coreBlocks) with one stored contents item;
//    Afternoon also holds a second Morning Prayer office copy
//    (the v610 duplicate shape) for the L5 refusal.
//  - The Salesian Way default profile (the v670 harness's
//    profile document shape: standing pick, NO stored
//    contents) as the second fixture profile.
//
// Legs (Plan §2.7): L1 paint · L2 toggle gate · L2b USCCB
// paint+write+read-back (C2) · L3 day pick · L4 Move ·
// L4b Move from a disabled block (C3) · L5 Move refusal ·
// L6 Settings · L7 source-row inertness.
// Composition gate: COMPOSED lines (descriptor lists from
// extRebuildDescs over resolveExternals standings, both
// fixture profiles x weekday/Sunday) print FIRST, before any
// leg — run this harness with ORA_WT=<pre-change tree> and
// diff the COMPOSED lines against this tree's run.
//
// Run: node app/worker/harness-v686.mjs
//      ORA_WT=/path/to/other-tree node /path/to/harness-v686.mjs
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
    { kind: 'source', key: 'ext-morning-prayer', side: 'sth' },
    { kind: 'source', key: 'daily-rosary' },
    { kind: 'source', key: 'marian-antiphon' },
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
    { kind: 'source', key: 'ext-morning-prayer', side: 'do' },
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
const JOHN_CORE = ['Morning', 'Midmorning', 'Afternoon', 'Evening', 'Night']; // Midday OFF
const SAL_CORE = ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'];

// ---------- build + serve the real bundle ----------
const TMP = mkdtempSync(tmpdir() + '/v686harness-');
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

// ---------- world ----------
const b = await chromium.launch({ executablePath: EXE });
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
pg.on('pageerror', (e) => console.log('PAGEERROR ' + String(e).slice(0, 200)));
await pg.addInitScript(({ SEED, JOHN_CONTENTS, JOHN_CORE, SAL_CORE }) => {
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const freshStore = () => ({
    standing: 'john',
    johnContents: clone(JOHN_CONTENTS), salContents: null,
    todayLayer: null,
    caps: [], srcCaps: [],
    sources: clone(SEED), version: 1,
  });
  window.__store = freshStore();
  window.__reset686 = () => { window.__store = freshStore(); };
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
    additions: [], readingsSeat: null, episodes: [], intros: {}, introTexts: {},
    profile: { key: window.__store.standing, contents: window.__store.standing === 'salesian' ? (window.__store.salContents ? clone(window.__store.salContents) : null) : clone(window.__store.johnContents) },
  });
  const resp = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(clone(body)), text: () => Promise.resolve('') });
  window.fetch = (url, opts) => {
    const u = String(url);
    const method = (opts && opts.method) || 'GET';
    if (u.includes('/api/player/source-settings')) {
      if (method === 'PUT') {
        let body = {}; try { body = JSON.parse((opts && opts.body) || '{}'); } catch (e) {}
        window.__store.srcCaps.push(clone(body));
        // production route shape: whole-set validation + renumber
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
      if (window.__store.failPut) { window.__store.failPut = false; return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ error: 'contents for a block that does not stand: Midday' }), text: () => Promise.resolve('') }); }
      window.__store.todayLayer = body.layer || null;
      return resp(window.__profilesRes());
    }
    if (u.includes('/api/prayer/profiles/save') && method === 'PUT') {
      let body = {}; try { body = JSON.parse((opts && opts.body) || '{}'); } catch (e) {}
      window.__store.caps.push({ path: 'save', body: clone(body) });
      if (window.__store.failPut) { window.__store.failPut = false; return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ error: 'contents for a block that does not stand: Midday' }), text: () => Promise.resolve('') }); }
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
}, { SEED, JOHN_CONTENTS, JOHN_CORE, SAL_CORE });
await pg.goto('http://127.0.0.1:' + PORT + '/');
await pg.waitForTimeout(1500);

// ---------- composition gate lines (printed first) ----------
async function composedLines() {
  return pg.evaluate(async () => {
    const out = [];
    const dates = ['2026-11-25', '2026-11-29']; // Wednesday · Sunday
    for (const pk of ['john', 'salesian']) {
      window.__store.standing = pk;
      for (const date of dates) {
        const day = window.__mkDay(date);
        state.dayPayload = day;
        resolveExternals(day, { version: window.__store.version, sources: JSON.parse(JSON.stringify(window.__store.sources)) });
        (state.extStanding || []).forEach((s2) => { state.extSlots[s2.slotId] = { state: 'present', title: s2.title, enclosureUrl: 'https://x/' + s2.slotId + '.mp3', streamUrl: 'https://x/' + s2.slotId + '.mp3', durationSec: 60, source: s2.source, imageUrl: null }; });
        (state.ownStanding || []).forEach((r) => { state.ownSlots[r.sourceKey] = { state: 'present', tracks: [{ episodeId: r.episodeId, title: r.title, enclosureUrl: 'https://x/' + r.episodeId + '.mp3', durationS: 60, sizeBytes: 0, imageUrl: null }] }; });
        const descs = extRebuildDescs(day) || [];
        out.push('COMPOSED ' + pk + ' ' + date + ' ' + JSON.stringify(descs.map((d) => (d.block || d._block || '?') + ':' + d.episodeId)));
      }
    }
    window.__store.standing = 'john';
    return out;
  });
}
const comp = await composedLines().catch((e) => ['COMPOSED-ERROR ' + String(e).slice(0, 200)]);
comp.forEach((l) => console.log(l));
check('GATE composition lines stand for both fixture profiles x weekday/Sunday', comp.length === 4 && comp.every((l) => l.startsWith('COMPOSED ')), comp.length);

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
const srcRow = (key) => pg.evaluate((k) => {
  const r = document.querySelector('[data-p686src="' + k + '"]');
  if (!r) return null;
  const t = r.querySelector('[data-p686toggle]'), d = r.querySelector('[data-p686day]');
  return { tag: (r.querySelector('.p686tag') || {}).textContent || '', on: t ? t.getAttribute('aria-checked') : null, day: d ? d.value : null, tDisabled: t ? t.disabled : null, dDisabled: d ? d.disabled : null,
    remove: !!r.querySelector('[data-p604remove]'), move: !!r.querySelector('[data-p684move]'), menu: !!r.querySelector('[data-p686menu]') };
}, key);
const lastSrcCap = () => pg.evaluate(() => window.__store.srcCaps[window.__store.srcCaps.length - 1] || null);
const lastCap = () => pg.evaluate(() => window.__store.caps[window.__store.caps.length - 1] || null);
async function tryClick(loc) { try { await loc.click({ timeout: 4000 }); return true; } catch (e) { return false; } }

// ---------- L1: paint ----------
await openForm();
{
  const seq = await groupSeq('Morning');
  check('L1 Morning list reads exactly the §2.1 worked order (Invitatory SRC · Saint daily · Morning Offering · USCCB SRC · Morning Prayer · Daily Rosary · Marian Antiphon)',
    JSON.stringify(seq) === JSON.stringify(['SRC:do-invitatory', 'C:daily:saint-of-the-day', 'C:source:morning-prayer', 'SRC:usccb-daily-readings', 'C:source:ext-morning-prayer', 'C:source:daily-rosary', 'C:source:marian-antiphon']), seq);
  const inv = await srcRow('do-invitatory');
  check('L1 Invitatory source row: tag "Daily source", switch On, day pick Daily, controls live in an on block',
    !!inv && inv.tag === 'Daily source' && inv.on === 'true' && inv.day === 'daily' && inv.tDisabled === false, inv);
  const mid = await groupSeq('Midmorning');
  check('L1 Midmorning source rows stand at their seats (Gospel Exegesis · Midmorning Prayer)',
    JSON.stringify(mid) === JSON.stringify(['SRC:daily-gospel-exegesis', 'SRC:do-midmorning-prayer']), mid);
  const aft = await groupSeq('Afternoon');
  check('L1 Afternoon: Saint of the Day + Midafternoon Prayer source rows; the duplicate Morning Prayer office copy stands as a contents row',
    JSON.stringify(aft) === JSON.stringify(['SRC:saint-of-the-day', 'C:source:auxilium-christianorum', 'SRC:do-midafternoon-prayer', 'C:source:ext-morning-prayer']), aft);
  const eve = await groupSeq('Evening');
  check('L1 Evening: Office of Readings source row; Evening Prayer stays a contents row with its segtoggle',
    JSON.stringify(eve) === JSON.stringify(['SRC:do-office-of-readings', 'C:source:marian-antiphon-evening', 'C:source:ext-evening-prayer']), eve);
  const night = await groupSeq('Night');
  check('L1 Night: Night Prayer source row after Daily Reflection',
    JSON.stringify(night) === JSON.stringify(['C:source:daily-reflection', 'SRC:do-night-prayer']), night);
  const mass = await pg.evaluate(() => {
    const sec = document.querySelector('[data-p686mass]');
    if (!sec) return null;
    const groups = [...document.querySelectorAll('.p609edit [data-p604exp]')].map((g) => g.getAttribute('data-p604exp'));
    return { keys: [...sec.querySelectorAll('[data-p686src]')].map((r) => r.getAttribute('data-p686src')), afterLast: sec.previousElementSibling && sec.previousElementSibling.getAttribute('data-p604exp') === groups[groups.length - 1] };
  });
  check('L1 closing Mass and Homilies section stands after the last block group, four rows in order',
    !!mass && JSON.stringify(mass.keys) === JSON.stringify(['daily-tv-mass', 'fr-mike-homily', 'barron-sermon', 'stations-of-the-cross']) && mass.afterLast === true, mass);
  const st = await srcRow('stations-of-the-cross');
  check('L1 Stations row: tag "Not placed", switch Off, day pick Fridays, standing last',
    !!st && st.tag === 'Not placed' && st.on === 'false' && st.day === 'fridays', st);
  const hom = await srcRow('fr-mike-homily');
  check('L1 Fr. Mike homily row: On · Sundays', !!hom && hom.on === 'true' && hom.day === 'sundays', hom);
  const midday = await srcRow('do-midday-prayer');
  check('L1/L2-inert: the OFF Midday block source row stands spliced with INERT (disabled) controls, values as stored',
    !!midday && midday.tDisabled === true && midday.dDisabled === true && midday.on === 'true' && midday.day === 'daily', midday);
  const middaySeq = await groupSeq('Midday');
  check('L1 Midday sequence (§4.4 Finding 1): the missing-representation Midday Prayer source row splices by standing rank AFTER the Angelus contents item (standing sort 1 < Midday Prayer sort 2) — [C:prayer:angelus-midday, SRC:do-midday-prayer]',
    JSON.stringify(middaySeq) === JSON.stringify(['C:prayer:angelus-midday', 'SRC:do-midday-prayer']), middaySeq);
}

// ---------- L2: toggle gate ----------
{
  await tryClick(pg.locator('[data-p686toggle="do-invitatory"]'));
  await pg.waitForTimeout(800);
  const cap = await lastSrcCap();
  const byKey = {}; (cap ? cap.sources : []).forEach((r) => { byKey[r.sourceKey] = r; });
  const seedByKey = {}; SEED.forEach((r) => { seedByKey[r.sourceKey] = r; });
  const diffs = Object.keys(byKey).filter((k) => { const a = byKey[k], s2 = seedByKey[k]; return a.enabled !== s2.enabled || a.dayRule !== s2.dayRule || a.block !== s2.block; });
  check('L2 toggle PUT carries all 26 rows with exactly one row changed (Invitatory Off)',
    !!cap && cap.sources.length === 26 && JSON.stringify(diffs) === JSON.stringify(['do-invitatory']) && byKey['do-invitatory'].enabled === 0, { n: cap && cap.sources.length, diffs });
  const compOff = await pg.evaluate(() => {
    const day = window.__mkDay('2026-11-25'); state.dayPayload = day;
    resolveExternals(day, { version: window.__store.version, sources: JSON.parse(JSON.stringify(window.__store.sources)) });
    return (state.extStanding || []).map((s2) => s2.slotId);
  });
  check('L2 composed standings drop the Invitatory while Off', !compOff.includes('ext-invitatory'), compOff);
  await tryClick(pg.locator('[data-p686toggle="do-invitatory"]'));
  await pg.waitForTimeout(800);
  const compOn = await pg.evaluate(() => {
    const day = window.__mkDay('2026-11-25'); state.dayPayload = day;
    resolveExternals(day, { version: window.__store.version, sources: JSON.parse(JSON.stringify(window.__store.sources)) });
    return (state.extStanding || []).map((s2) => s2.slotId);
  });
  check('L2 flip back On: the Invitatory returns to the composed standings', compOn.includes('ext-invitatory'), compOn);
}

// ---------- L2b: USCCB (C2 — paint + write + read-back only) ----------
{
  await tryClick(pg.locator('[data-p686toggle="usccb-daily-readings"]'));
  await pg.waitForTimeout(800);
  const cap = await lastSrcCap();
  const row = cap ? cap.sources.filter((r) => r.sourceKey === 'usccb-daily-readings')[0] : null;
  const back = await pg.evaluate(() => opn686Row('usccb-daily-readings'));
  check('L2b USCCB toggle writes the store value (Off) and the read-back stands in opn686.rows',
    !!row && row.enabled === 0 && !!back && back.enabled === 0, { row, back });
  await tryClick(pg.locator('[data-p686toggle="usccb-daily-readings"]'));
  await pg.waitForTimeout(800);
  const back2 = await pg.evaluate(() => opn686Row('usccb-daily-readings'));
  check('L2b USCCB flip back On reads back On (no composed-day claim — C2)', !!back2 && back2.enabled === 1, back2);
}

// ---------- L3: day pick ----------
{
  await pg.selectOption('[data-p686day="saint-of-the-day"]', 'sundays');
  await pg.waitForTimeout(800);
  const cap = await lastSrcCap();
  const row = cap ? cap.sources.filter((r) => r.sourceKey === 'saint-of-the-day')[0] : null;
  check('L3 day-pick change writes Sundays for Saint of the Day (whole-table PUT)', !!row && row.dayRule === 'sundays' && cap.sources.length === 26, row);
  const gates = await pg.evaluate(() => {
    const out = {};
    for (const date of ['2026-11-25', '2026-11-29']) {
      const day = window.__mkDay(date); state.dayPayload = day;
      resolveExternals(day, { version: window.__store.version, sources: JSON.parse(JSON.stringify(window.__store.sources)) });
      out[date] = (state.extStanding || []).map((s2) => s2.slotId);
    }
    return out;
  });
  check('L3 the composed weekday drops Saint of the Day and the composed Sunday stands it',
    !gates['2026-11-25'].includes('ext-saint-of-the-day') && gates['2026-11-29'].includes('ext-saint-of-the-day'), gates);
  await pg.selectOption('[data-p686day="saint-of-the-day"]', 'daily');
  await pg.waitForTimeout(800);
}

// ---------- L4: Move ----------
async function driveMove(fromBlock, rid, toBlock) {
  const menuBtn = pg.locator('[data-p686menu="' + fromBlock + '|' + rid + '"]');
  await menuBtn.evaluate((el) => el.scrollIntoView({ block: 'center' })).catch(() => null);
  await tryClick(menuBtn);
  await pg.waitForTimeout(400);
  await tryClick(pg.locator('.anchmenu [data-menuitem="0"]'));
  await pg.waitForTimeout(400);
  const pick = pg.locator('[data-p686pick="' + toBlock + '"]');
  await pick.evaluate((el) => el.scrollIntoView({ block: 'center' })).catch(() => null);
  await tryClick(pick);
  await pg.waitForTimeout(800);
}
{
  await driveMove('Morning', 'source:morning-prayer', 'Night');
  const cap = await lastCap();
  const c = cap ? (cap.path === 'today-edit' ? (cap.body.layer && cap.body.layer.contents) : cap.body.contents) : null;
  const night = c && c.Night ? c.Night : null;
  check('L4 Move: Morning Offering lands at the END of Night in the saved payload, fields whole',
    !!night && night.length > 0 && night[night.length - 1].kind === 'source' && night[night.length - 1].key === 'morning-prayer' && Object.keys(night[night.length - 1]).length === 2, night);
  const seq = await groupSeq('Night');
  check('L4 Move: the form paints it at the end of Night', !!seq && seq[seq.length - 1] === 'C:source:morning-prayer', seq);
  await driveMove('Morning', 'source:ext-morning-prayer', 'Evening');
  const cap2 = await lastCap();
  const c2 = cap2 ? (cap2.path === 'today-edit' ? (cap2.body.layer && cap2.body.layer.contents) : cap2.body.contents) : null;
  const eve = c2 && c2.Evening ? c2.Evening.filter((it) => it.key === 'ext-morning-prayer')[0] : null;
  check('L4 Move: an office item moved keeps its side stamp (sth) in the saved payload', !!eve && eve.side === 'sth', eve);
  const tog = await pg.evaluate(() => {
    const g = document.querySelector('[data-p604exp="Evening"]');
    const rows = g ? [...g.querySelectorAll('[data-p604erow="source:ext-morning-prayer"]')] : [];
    const act = rows.length ? rows[0].querySelector('[data-p670side].active') : null;
    return act ? act.getAttribute('data-p670side') : null;
  });
  check('L4 Move: the segtoggle in the new block reads the same pick (sth)', tog === 'sth', tog);
}

// ---------- L5: Move refusal ----------
{
  const capsBefore = await pg.evaluate(() => window.__store.caps.length);
  const menuBtn = pg.locator('[data-p686menu="Afternoon|source:ext-morning-prayer"]');
  await menuBtn.evaluate((el) => el.scrollIntoView({ block: 'center' })).catch(() => null);
  await tryClick(menuBtn);
  await pg.waitForTimeout(400);
  await tryClick(pg.locator('.anchmenu [data-menuitem="0"]'));
  await pg.waitForTimeout(400);
  // Afternoon already holds ext-morning-prayer; move Morning's copy there is
  // impossible from Afternoon itself — drive from Morning's remaining copy:
  // Morning's copy moved in L4, so use the Afternoon copy toward Morning is
  // free; the refusal pair is Afternoon copy -> Evening (holds it after L4).
  const pick = pg.locator('[data-p686pick="Evening"]');
  await pick.evaluate((el) => el.scrollIntoView({ block: 'center' })).catch(() => null);
  await tryClick(pick);
  await pg.waitForTimeout(600);
  const reason = await pg.evaluate(() => { const r = document.querySelector('[data-p686reason]'); const s2 = document.querySelector('[data-p686sub]'); return { r: r ? r.textContent : null, s: s2 ? s2.textContent : null, open: !!document.querySelector('.p686picker') }; });
  const capsAfter = await pg.evaluate(() => window.__store.caps.length);
  check('L5 refusal: no write captured and the picker stays open', capsAfter === capsBefore && reason.open === true, { capsBefore, capsAfter, reason });
  check('L5 refusal reason lines read exactly as §2.6 names them',
    reason.r === 'Morning Prayer already stands in Evening.' && reason.s === 'An office hour stands once in a block — remove it there first, or pick another block.', reason);
  await pg.evaluate(() => { const s2 = document.querySelector('.p686picker'); if (s2) s2.remove(); });
}

// ---------- L4b: Move from a disabled block (C3) ----------
{
  await driveMove('Midday', 'prayer:angelus-midday', 'Morning');
  const cap = await lastCap();
  const c = cap ? (cap.path === 'today-edit' ? (cap.body.layer && cap.body.layer.contents) : cap.body.contents) : null;
  check('L4b the Move-written Midday list persists as written (empty) in the saved payload — the C3 client exception',
    !!c && Array.isArray(c.Midday) && c.Midday.length === 0, c && c.Midday);
  check('L4b the item lands at the end of Morning in the saved payload',
    !!c && Array.isArray(c.Morning) && c.Morning[c.Morning.length - 1].kind === 'prayer' && c.Morning[c.Morning.length - 1].key === 'angelus-midday', c && c.Morning);
  check('L4b the write carries the Move envelope naming the from/to blocks (Review repair — the server exception rides the envelope)',
    !!cap && !!cap.body.move686 && cap.body.move686.from === 'Midday' && cap.body.move686.to === 'Morning', cap && cap.body.move686);
  await pg.evaluate(() => { opnExitEdit607(); });
  await pg.waitForTimeout(300);
  await openForm();
  const mid = await groupSeq('Midday');
  const morn = await groupSeq('Morning');
  check('L4b on re-entry the item is gone from the disabled source block and stands in the target',
    !!mid && !mid.includes('C:prayer:angelus-midday') && !!morn && morn[morn.length - 1] === 'C:prayer:angelus-midday', { mid, morn });
}

// ---------- L4d: a refused Move persist is NOT silent (Review repair) ----------
{
  await pg.evaluate(() => { window.__store.failPut = true; });
  await driveMove('Morning', 'source:daily-rosary', 'Night');
  const st = await pg.evaluate(() => {
    const r = document.querySelector('[data-p686reason]');
    return { open: !!document.querySelector('.p686picker'), reason: r ? r.textContent : null, err: (document.querySelector('[data-p686err]') || {}).textContent || '' };
  });
  check('L4d refused Move persist: the picker stays open, its reason line names the failure, and the form error line stands (no silent close)',
    st.open === true && st.reason === 'That move did not save.' && st.err.includes('That move did not save'), st);
  const morn = await groupSeq('Morning');
  const night = await groupSeq('Night');
  check('L4d the standing lists restore whole: Daily Rosary still stands in Morning and never landed in Night (no optimistic residue)',
    !!morn && morn.includes('C:source:daily-rosary') && !!night && !night.includes('C:source:daily-rosary'), { morn, night });
  await pg.evaluate(() => { const s2 = document.querySelector('.p686picker'); if (s2) s2.remove(); });
}

// ---------- L7: source-row inertness + sort around ----------
{
  const rows = await pg.evaluate(() => [...document.querySelectorAll('[data-p686src]')].map((r) => ({
    k: r.getAttribute('data-p686src'), remove: !!r.querySelector('[data-p604remove]'), move: !!r.querySelector('[data-p684move]'), menu: !!r.querySelector('[data-p686menu]'), handle: !!r.querySelector('[data-p604handle]'),
  })));
  check('L7 no source row carries Remove, data-p684move buttons, a Move menu, or a drag handle',
    rows.length >= 10 && rows.every((r) => !r.remove && !r.move && !r.menu && !r.handle), rows.filter((r) => r.remove || r.move || r.menu || r.handle));
  const before = await groupSeq('Morning');
  // Morning Offering (source:morning-prayer) moved to Night in L4; the
  // standing Morning contents pair to sort is Saint daily over the
  // USCCB seat's neighbour: move the Daily Rosary up is blocked by
  // seats; instead move Saint daily DOWN one (swaps with the next
  // contents item below it that still stands in Morning).
  const rid = before.filter((x) => x.startsWith('C:'))[0];
  const ridRaw = rid.slice(2);
  await tryClick(pg.locator('[data-p684move="Morning|' + ridRaw + '|down"]'));
  await pg.waitForTimeout(800);
  const after = await groupSeq('Morning');
  const srcBefore = before.filter((x) => x.startsWith('SRC:'));
  const srcAfter = after.filter((x) => x.startsWith('SRC:'));
  check('L7 contents rows sort around source rows: the source-row sequence is unchanged by a contents move',
    JSON.stringify(srcBefore) === JSON.stringify(srcAfter) && JSON.stringify(before) !== JSON.stringify(after), { before, after });
}

// ---------- L6: Settings ----------
{
  await pg.evaluate(() => { renderSettings(); });
  await pg.waitForTimeout(600);
  const st = await pg.evaluate(() => ({
    heads: [...document.querySelectorAll('.sectionhead')].map((h) => h.textContent.trim()),
    setrows: document.querySelectorAll('[data-setkey]').length,
    save: !!document.getElementById('set-save'),
    reset: !!document.getElementById('set-reset'),
    back: !!document.getElementById('set-back'),
    mapping: document.body.textContent.includes('Source mapping'),
  }));
  check('L6 Settings paints with NO source-editor section (no mapping rows, no Save mapping, no Reset, no "Source mapping" line)',
    st.setrows === 0 && st.save === false && st.reset === false && st.mapping === false, st);
  check('L6 DISPLAY stands first and the other standing sections stand (PRAYER PLAN · PLAYBACK · OFFLINE · SACRED ART); the slim Back row stands',
    st.heads[0] === 'DISPLAY' && ['PRAYER PLAN', 'PLAYBACK', 'OFFLINE', 'SACRED ART'].every((h) => st.heads.includes(h)) && st.back === true, st.heads);
}

// ---------- L4c: the REAL Worker validator (Review repair gate) ----------
// The in-page stub above applies profile PUTs with NO server
// validator, so L4b proves the client only. This leg extracts
// validateProfileContents + parseMoveEnvelope686 +
// validateProfileContents686 VERBATIM from this tree's
// index.ts (the v603/v670 standalone-extraction recipe — the
// validator is written to be extracted standalone) and drives
// the exact calls the two routes make: profiles/save
// (contents vs the save coreBlocks) and today-edit (contents
// vs entry.coreBlocks || base.coreBlocks). It proves the
// validator/wrapper/envelope code the Worker runs; it does
// NOT prove the HTTP route plumbing or D1 (the route call
// sites are read in the diff — Review §4 states this limit).
{
  const indexSrc = readFileSync(path.join(W, 'src/index.ts'), 'utf8');
  function extractServerFn(src, name) {
    const start = src.indexOf('function ' + name + '(');
    if (start < 0) throw new Error('server fn not found: ' + name);
    const nl = src.indexOf('\n', start);
    let i = src.lastIndexOf('{', nl);
    let depth = 0, j = i;
    for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}') { depth--; if (!depth) break; } }
    return src.slice(start, j + 1);
  }
  function stripNamed(src, name, reps) {
    let f = extractServerFn(src, name);
    for (const [a, b2] of reps) { if (!f.includes(a)) throw new Error(name + ' shape moved: ' + a.slice(0, 60)); f = f.split(a).join(b2); }
    return f;
  }
  let SV = null;
  try {
    const vBody = stripNamed(indexSrc, 'validateProfileContents', [
      ['function validateProfileContents(contents: unknown, coreBlocks: string[]): { normalized?: Record<string, { kind: string; key?: string; side?: string }[]> } | { error: string } {', 'function validateProfileContents(contents, coreBlocks) {'],
      ['const out: Record<string, { kind: string; key?: string; side?: string }[]> = {};', 'const out = {};'],
      ['Object.entries(contents as Record<string, unknown>)', 'Object.entries(contents)'],
      ['const seen = new Set<string>();', 'const seen = new Set();'],
      ['const list: { kind: string; key?: string; side?: string }[] = [];', 'const list = [];'],
      ['const it = (raw && typeof raw === "object" ? raw : {}) as { kind?: unknown; key?: unknown; side?: unknown };', 'const it = (raw && typeof raw === "object" ? raw : {});'],
      ['let side670: string | undefined;', 'let side670;'],
      ['list.push(side670 ? { kind: kind as string, key: key as string, side: side670 } : { kind: kind as string, key: key as string });', 'list.push(side670 ? { kind: kind, key: key, side: side670 } : { kind: kind, key: key });'],
    ]);
    const pBody = stripNamed(indexSrc, 'parseMoveEnvelope686', [
      ['function parseMoveEnvelope686(raw: unknown): { move?: { from: string; to: string } } | { error: string } {', 'function parseMoveEnvelope686(raw) {'],
      ['const m = raw as { from?: unknown; to?: unknown };', 'const m = raw;'],
    ]);
    const wBody = stripNamed(indexSrc, 'validateProfileContents686', [
      ['function validateProfileContents686(contents: unknown, coreBlocks: string[], extraBlocks?: string[]): { normalized?: Record<string, { kind: string; key?: string; side?: string }[]> } | { error: string } {', 'function validateProfileContents686(contents, coreBlocks, extraBlocks) {'],
      ['const core: string[] = coreBlocks.slice();', 'const core = coreBlocks.slice();'],
    ]);
    SV = new Function(vBody + '\n' + pBody + '\n' + wBody + '\nreturn { v: validateProfileContents, parse: parseMoveEnvelope686, v686: validateProfileContents686 };')();
  } catch (e) { check('L4c the real index.ts validator + envelope seats extract standalone', false, e.message); }
  if (SV) {
    const CORE = ['Morning', 'Midmorning', 'Afternoon', 'Evening', 'Night']; // Midday OFF (the L4b shape)
    const moved = { Morning: [{ kind: 'source', key: 'morning-prayer' }, { kind: 'prayer', key: 'angelus-midday', bogus: 1 }], Midday: [] };
    const noEnv = SV.v686(moved, CORE, undefined);
    check('L4c save shape WITHOUT the envelope: the real validator still refuses the off-block (Midday) list whole',
      !!noEnv.error && noEnv.error.includes('does not stand'), noEnv);
    const env = SV.parse({ from: 'Midday', to: 'Morning' });
    const withEnv = SV.v686(moved, CORE, env.move ? [env.move.from, env.move.to] : undefined);
    check('L4c save shape WITH the Move envelope: the off-block Move persists — Midday stands (empty) and the item lands in Morning',
      !withEnv.error && !!withEnv.normalized && Array.isArray(withEnv.normalized.Midday) && withEnv.normalized.Midday.length === 0
      && withEnv.normalized.Morning.length === 2 && withEnv.normalized.Morning[1].key === 'angelus-midday', withEnv);
    check('L4c the stored item rebuild stands under the envelope: {kind, key} only — no envelope marker or extra field persists',
      !!withEnv.normalized && JSON.stringify(withEnv.normalized.Morning[1]) === JSON.stringify({ kind: 'prayer', key: 'angelus-midday' }), withEnv.normalized && withEnv.normalized.Morning[1]);
    const stray = { Morning: [{ kind: 'prayer', key: 'angelus-midday' }], Evening: [{ kind: 'source', key: 'ext-evening-prayer', side: 'sth' }] };
    const strayRes = SV.v686(stray, ['Morning', 'Night'], ['Midday', 'Morning']);
    check('L4c the envelope names ONLY its two blocks: a third off block (Evening) in the same write is still refused',
      !!strayRes.error && strayRes.error.includes('Evening'), strayRes);
    const badEnvs = [{ from: 'Midday' }, { from: 'Midday', to: 'Midday' }, { from: 'Bogus', to: 'Morning' }, 'x', null];
    check('L4c malformed envelopes are named errors; an absent envelope is no error and no move',
      badEnvs.every((x) => !!SV.parse(x).error) && !SV.parse(undefined).error && !SV.parse(undefined).move, badEnvs.map((x) => SV.parse(x)));
    const layerCore = ['Morning', 'Night']; // today-edit: entry.coreBlocks stands in for the base core
    const twinNo = SV.v686(moved, layerCore, undefined);
    const twinYes = SV.v686(moved, layerCore, ['Midday', 'Morning']);
    check('L4c today-edit twin shape: refused without the envelope, stands with it (same real validator call)',
      !!twinNo.error && !twinYes.error && !!twinYes.normalized && twinYes.normalized.Morning.length === 2, { twinNo, twinYes });
    const coreOnly = { Morning: [{ kind: 'source', key: 'ext-morning-prayer', side: 'do' }], Night: [{ kind: 'source', key: 'daily-reflection' }] };
    check('L4c non-Move parity: the wrapper with no extra blocks decides byte-identically to the standing validator, and an office side survives the rebuild',
      JSON.stringify(SV.v686(coreOnly, CORE, undefined)) === JSON.stringify(SV.v(coreOnly, CORE))
      && !!SV.v(coreOnly, CORE).normalized && SV.v(coreOnly, CORE).normalized.Morning[0].side === 'do', SV.v(coreOnly, CORE));
    const readBack = SV.v686(moved, CORE, Object.keys(moved).filter((b2) => !CORE.includes(b2)));
    check('L4c read seat: stored Move-written contents validate back whole (the store re-read does not drop the Move)',
      !readBack.error && !!readBack.normalized && Array.isArray(readBack.normalized.Midday) && readBack.normalized.Morning.length === 2, readBack);
  }
}

await b.close();
server.close();
console.log('\nharness-v686: ' + ok + ' ok, ' + bad + ' bad');
process.exit(bad ? 1 : 0);
