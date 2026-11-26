// harness-v691.mjs — v691: daily-source rows gain
// "Move to block…" (dual write), as amended by John
// 2026-11-26 08:37–08:39 CT (DevOps Board row 1669):
// Amendment 1 — the readings row TAKES the act (the fold
// anchor stands down out of Morning); Amendment 2 — the
// pinned five TAKE the act (no disabled Move item, no
// refusal reason on any block row); Amendment 3 — the
// duplicate refusal keys on the HOUR, never office-ness.
//
// Modeled on harness-v687.mjs: playwright-core Chromium,
// the REAL built Worker bundle served locally, the API
// stubbed in-page (the v686/v687 world: the 26 seed rows,
// whole-table source-settings PUTs, profile PUTs
// captured). Fixtures from production shapes — John's
// real lists as harness-v687 carries them (Improvement D).
//
// Legs: M1 field leg · M2 settings travel · M3 (re-pointed)
// no disabled Move / no refusal on block rows, closing
// rows carry no Move item · M4 move-back byte-identical ·
// M5 already-stands refusal · M6 off-block envelope at
// both server seats (real extracted validators, the
// v686 L4c recipe) · A1 readings out compose there ·
// A2 readings back before the Rosary = byte-identical day ·
// A3 a pinned office row moves + composes · A4 two
// DIFFERENT offices in one block compose · A5 the SAME
// office twice refused by name, no writes.
// Composition gate: COMPOSED lines print FIRST — run with
// ORA_WT=<pre-change tree> and diff the COMPOSED lines.
//
// Run: node app/worker/harness-v691.mjs
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
const TMP = mkdtempSync(tmpdir() + '/v691harness-');
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

// ---------- world (the v687 stub world, verbatim shape) ----------
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
  window.__reset691 = () => { window.__store = freshStore(); };
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

// ---------- helpers ----------
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
async function resetForm() { await pg.evaluate(() => { window.__reset691(); document.querySelectorAll('.p686picker, .anchmenu, .menucatcher').forEach((n) => n.remove()); }); await openForm(); }
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
  return pg.evaluate(() => [...document.querySelectorAll('.anchmenu [data-menuitem]')].map((e) => { const g = e.querySelector('.grow'); return { label: (g || e).textContent.trim(), disabled: !!e.disabled, head: e.classList.contains('menuhead') }; }));
}
async function closeMenu() { await pg.evaluate(() => { document.querySelectorAll('.anchmenu, .menucatcher').forEach((n) => n.remove()); }); }
async function menuClick(idx) { await tryClick(pg.locator('.anchmenu [data-menuitem="' + idx + '"]')); await pg.waitForTimeout(700); }
const lastCap = () => pg.evaluate(() => window.__store.caps[window.__store.caps.length - 1] || null);
async function savedContents() {
  const cap = await lastCap();
  if (!cap) return null;
  return cap.path === 'today-edit' ? (cap.body.layer && cap.body.layer.contents) : cap.body.contents;
}
const srcRow = (key) => pg.evaluate((k) => { const r = opn686Row(k); return r ? { sourceKey: r.sourceKey, block: r.block, dayRule: r.dayRule, enabled: r.enabled } : null; }, key);
const settingsTable = () => pg.evaluate(() => window.__store.sources.map((r) => ({ sourceKey: r.sourceKey, block: r.block, dayRule: r.dayRule, enabled: r.enabled })));
async function moveViaMenu(sel, toBlock) {
  const items = await openMenu(sel);
  const idx = items.findIndex((x) => x.label === 'Move to block…');
  if (idx < 0) return { items, picker: null };
  await menuClick(idx);
  await pg.waitForTimeout(500);
  const picker = await pg.evaluate(() => {
    const sh = document.querySelector('.p686picker');
    if (!sh) return null;
    return { rows: [...sh.querySelectorAll('[data-p686pick]')].map((e) => e.getAttribute('data-p686pick')),
      reason: (sh.querySelector('[data-p686reason]') || {}).textContent || '', sub: (sh.querySelector('[data-p686sub]') || {}).textContent || '' };
  });
  if (picker && picker.rows.includes(toBlock)) {
    await tryClick(pg.locator('[data-p686pick="' + toBlock + '"]'));
    await pg.waitForTimeout(1100);
  }
  const after = await pg.evaluate(() => {
    const sh = document.querySelector('.p686picker');
    if (!sh) return { open: false, reason: '', sub: '' };
    return { open: true, reason: (sh.querySelector('[data-p686reason]') || {}).textContent || '', sub: (sh.querySelector('[data-p686sub]') || {}).textContent || '' };
  });
  return { items, picker, after };
}
const blk = (arr, b) => arr.filter((x) => x.startsWith(b + ':'));

// ---------- M3 (re-pointed): no disabled Move, no refusal reasons ----------
await resetForm();
{
  const rows9 = [
    ['src|Morning|do-invitatory|source:ext-invitatory', 'Invitatory (pinned)'],
    ['src|Morning|usccb-daily-readings|seat:daily-readings', 'readings'],
    ['src|Midmorning|daily-gospel-exegesis|source:ext-gospel-exegesis', 'exegesis'],
    ['src|Midmorning|do-midmorning-prayer|source:ext-midmorning-prayer', 'Midmorning Prayer (pinned)'],
    ['src|Midday|do-midday-prayer|source:ext-midday-prayer', 'Midday Prayer (pinned)'],
    ['src|Afternoon|saint-of-the-day|source:ext-saint-of-the-day', 'Saint of the Day'],
    ['src|Afternoon|do-midafternoon-prayer|source:ext-midafternoon-prayer', 'Midafternoon Prayer (pinned)'],
    ['src|Evening|do-office-of-readings|source:ext-office-of-readings', 'Office of Readings'],
    ['src|Night|do-night-prayer|source:ext-night-prayer', 'Night Prayer (pinned)'],
  ];
  const seen = [];
  for (const [sel, name] of rows9) {
    const items = await openMenu('[data-p686menu="' + sel + '"]');
    const mv = items.filter((x) => x.label === 'Move to block…');
    seen.push({ name, count: mv.length, disabled: mv.some((x) => x.disabled), labels: items.map((x) => x.label) });
    await closeMenu();
  }
  // §2.3 qualification: the act stands only when the row carries a
  // repRid. In this fixture eight rows do; the Midday Prayer row's
  // representation does NOT stand in John's Midday list (prayer only),
  // so its row is spliced in with no repRid and — like Move up/down —
  // the act simply does not stand there. Its live form is proven in
  // A4, where the Midday Prayer row moves with its representation
  // standing (the Salesian-shaped list).
  check('M3 no block-row menu carries a DISABLED Move item or a refusal-reason line; every row with a standing representation (8 of 9 in this fixture) carries a LIVE Move to block…; the spliced-in Midday row (no repRid, §2.3 qualification) carries none',
    seen.every((s) => !s.disabled && !s.labels.some((l) => /already stands|stands in|stands before|is the .* hour/.test(l)))
    && seen.filter((s) => s.name !== 'Midday Prayer (pinned)').every((s) => s.count === 1)
    && seen.filter((s) => s.name === 'Midday Prayer (pinned)')[0].count === 0, seen);
  const closing = await openMenu('[data-p686menu="src||fr-mike-homily|"]');
  check('M3 the closing rows menus carry NO Move item at all (Frequency only, as standing)',
    !closing.some((x) => x.label === 'Move to block…') && closing[0].label.startsWith('Frequency'), closing.map((x) => x.label));
  await closeMenu();
}

// ---------- M1: the field leg — exegesis Midmorning → Evening ----------
let m1Cap = null;
await resetForm();
{
  const before = await composedDescs('john', '2026-11-25');
  const mv = await moveViaMenu('[data-p686menu="src|Midmorning|daily-gospel-exegesis|source:ext-gospel-exegesis"]', 'Evening');
  check('M1 the source picker lists the six hour blocks only (Novenas never listed)',
    !!mv.picker && JSON.stringify(mv.picker.rows) === JSON.stringify(['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night']), mv.picker);
  check('M1 the picker closed on a saved move (no refusal painted)', !!mv.after && mv.after.open === false, mv.after);
  m1Cap = await lastCap();
  const row = await srcRow('daily-gospel-exegesis');
  check('M1 dual write stands: the settings read-back carries the exegesis row in Evening, dayRule + enabled untouched',
    !!row && row.block === 'Evening' && row.dayRule === 'daily' && row.enabled === 1, row);
  const saved = await savedContents();
  check('M1 the contents write stands: the item left Midmorning and stands at the END of Evening, envelope move686 {Midmorning→Evening} on the write',
    !!saved && !saved.Midmorning.some((x) => x.key === 'ext-gospel-exegesis')
    && saved.Evening[saved.Evening.length - 1].key === 'ext-gospel-exegesis'
    && !!m1Cap && JSON.stringify(m1Cap.body.move686) === JSON.stringify({ from: 'Midmorning', to: 'Evening' }), { saved, move: m1Cap && m1Cap.body.move686 });
  const after = await composedDescs('john', '2026-11-25');
  const ev = blk(after, 'Evening'), mm = blk(after, 'Midmorning');
  check('M1 the composed day seats Daily Gospel Exegesis at the END of Evening and Midmorning composes without it',
    ev.length > 0 && ev[ev.length - 1] === 'Evening:ext-gospel-exegesis' && !mm.some((x) => x.includes('exegesis'))
    && blk(before, 'Midmorning').some((x) => x.includes('exegesis')), { ev, mm });
  const seqE = await groupSeq('Evening'), seqM = await groupSeq('Midmorning');
  check('M1 the row repaints in Evening as the SOURCE row (Daily-source dress) and paints nowhere in Midmorning',
    !!seqE && seqE[seqE.length - 1] === 'SRC:daily-gospel-exegesis' && !!seqM && !seqM.some((x) => x.includes('exegesis')), { seqE, seqM });
}

// ---------- M4: move back is byte-identical ----------
{
  const startComp = compLines[0].slice(('COMPOSED john 2026-11-25 ').length);
  const startSettings = JSON.stringify((await settingsTable()).map((r) => r.sourceKey + '|' + r.block + '|' + r.dayRule + '|' + r.enabled).sort());
  // settings at the START of this leg = post-M1 state; capture the
  // pre-M1 state instead from a fresh reset for the true round trip:
  await resetForm();
  const baseComp = await composedDescs('john', '2026-11-25');
  const baseSettings = JSON.stringify((await settingsTable()).map((r) => r.sourceKey + '|' + r.block + '|' + r.dayRule + '|' + r.enabled).sort());
  const baseContents = JSON.stringify(await pg.evaluate(() => window.__store.johnContents));
  await moveViaMenu('[data-p686menu="src|Midmorning|daily-gospel-exegesis|source:ext-gospel-exegesis"]', 'Evening');
  // back to Midmorning (lands at the list end), then ▲▼ home within
  // the block (the standing act — the fixture's standing seat is first)
  await moveViaMenu('[data-p686menu="src|Evening|daily-gospel-exegesis|source:ext-gospel-exegesis"]', 'Midmorning');
  const btn = pg.locator('[data-p684move="Midmorning|source:ext-gospel-exegesis|up"]');
  await scrollTo(btn); await tryClick(btn); await pg.waitForTimeout(800);
  const backComp = await composedDescs('john', '2026-11-25');
  const backSettings = JSON.stringify((await settingsTable()).map((r) => r.sourceKey + '|' + r.block + '|' + r.dayRule + '|' + r.enabled).sort());
  const backContents = JSON.stringify(await pg.evaluate(() => window.__store.johnContents));
  check('M4 move-back: the composed day is byte-identical to the start state', JSON.stringify(backComp) === JSON.stringify(baseComp), { baseComp, backComp });
  check('M4 move-back: both stored lists byte-identical and the settings table (block · dayRule · enabled per row) byte-identical — sortOrder excluded: it is server-renumbered on EVERY whole-table PUT (standing v686 behavior, Frequency picks included)',
    backContents === baseContents && backSettings === baseSettings, { backSettings, baseSettings, contentsSame: backContents === baseContents });
  check('M4 sanity: the round trip really moved (the start composition differs from the gate line only by fixture identity)',
    typeof startComp === 'string' && startSettings.length > 0, startComp && startComp.slice(0, 60));
}

// ---------- M2: settings travel (frequency Sundays-only) ----------
await resetForm();
{
  // set Frequency Sundays-only FIRST through the source menu
  const items = await openMenu('[data-p686menu="src|Midmorning|daily-gospel-exegesis|source:ext-gospel-exegesis"]');
  const sunIdx = items.findIndex((x) => x.label === 'Sundays only');
  await menuClick(sunIdx);
  const pre = await srcRow('daily-gospel-exegesis');
  check('M2 setup: the Frequency pick wrote dayRule sundays to the store', !!pre && pre.dayRule === 'sundays', pre);
  await moveViaMenu('[data-p686menu="src|Midmorning|daily-gospel-exegesis|source:ext-gospel-exegesis"]', 'Evening');
  const row = await srcRow('daily-gospel-exegesis');
  check('M2 the store read-back after the move carries dayRule sundays + the new block + enabled unchanged',
    !!row && row.block === 'Evening' && row.dayRule === 'sundays' && row.enabled === 1, row);
  const sun = await composedDescs('john', '2026-11-29'); // Sunday
  const wed = await composedDescs('john', '2026-11-25'); // Wednesday
  check('M2 a Sunday fixture composes the moved exegesis in Evening; a weekday drops it (the store gate travels)',
    blk(sun, 'Evening').some((x) => x.includes('exegesis')) && !wed.some((x) => x.includes('exegesis')), { sun: blk(sun, 'Evening'), wed: blk(wed, 'Evening') });
  // v690 leg: the ITEM's own dayRule travels whole through the move —
  // set Fridays-only on the moved item via opnSetItemDay690, move it
  // back, and read the stored item.
  await pg.evaluate(() => { opnSetItemDay690('Evening', 'source:ext-gospel-exegesis', 'fridays'); });
  await pg.waitForTimeout(800);
  await moveViaMenu('[data-p686menu="src|Evening|daily-gospel-exegesis|source:ext-gospel-exegesis"]', 'Midmorning');
  const saved = await savedContents();
  const itBack = saved && saved.Midmorning ? saved.Midmorning.filter((x) => x.key === 'ext-gospel-exegesis')[0] : null;
  check('M2 the contents item moves WHOLE: its v690 dayRule (fridays) stands on the item after the move back',
    !!itBack && itBack.dayRule === 'fridays', itBack);
}

// ---------- M5: already-stands refusal ----------
await resetForm();
{
  await pg.evaluate(() => { window.__store.johnContents.Evening.push({ kind: 'source', key: 'ext-gospel-exegesis' }); });
  await openForm();
  const counts0 = await pg.evaluate(() => ({ caps: window.__store.caps.length, srcCaps: window.__store.srcCaps.length, contents: JSON.stringify(window.__store.johnContents) }));
  const mv = await moveViaMenu('[data-p686menu="src|Midmorning|daily-gospel-exegesis|source:ext-gospel-exegesis"]', 'Evening');
  const counts1 = await pg.evaluate(() => ({ caps: window.__store.caps.length, srcCaps: window.__store.srcCaps.length, contents: JSON.stringify(window.__store.johnContents) }));
  const row = await srcRow('daily-gospel-exegesis');
  check('M5 the picker refuses by name: "Daily Gospel Exegesis already stands in Evening." and the picker stays open',
    !!mv.after && mv.after.open === true && mv.after.reason === 'Daily Gospel Exegesis already stands in Evening.' && /stands once in a block/.test(mv.after.sub), mv.after);
  check('M5 no writes at all: contents + settings captures unchanged, the store row still stands in Midmorning',
    counts1.caps === counts0.caps && counts1.srcCaps === counts0.srcCaps && counts1.contents === counts0.contents && !!row && row.block === 'Midmorning', { counts0, counts1, row });
  await pg.evaluate(() => { const sh = document.querySelector('.p686picker'); if (sh) sh.remove(); });
}

// ---------- A1 + A2: the readings (Amendment 1) ----------
await resetForm();
{
  const before = await composedDescs('john', '2026-11-25');
  const seatId = 'usccb-readings-2026-11-25';
  const mv = await moveViaMenu('[data-p686menu="src|Morning|usccb-daily-readings|seat:daily-readings"]', 'Evening');
  check('A1 the readings move saves (picker closed, no refusal)', !!mv.after && mv.after.open === false, mv.after);
  const row = await srcRow('usccb-daily-readings');
  const saved = await savedContents();
  check('A1 dual write stands for the seat item: the store row block is Evening and the seat item stands at the END of Evening list, gone from Morning',
    !!row && row.block === 'Evening' && !!saved && saved.Evening[saved.Evening.length - 1].kind === 'seat'
    && !saved.Morning.some((x) => x.kind === 'seat'), { row, saved });
  const after = await composedDescs('john', '2026-11-25');
  const hits = after.filter((x) => x.includes(seatId));
  check('A1 the readings compose AT their new seat (last in Evening) and do NOT compose in Morning — exactly one readings descriptor in the day',
    hits.length === 1 && hits[0] === 'Evening:' + seatId && blk(after, 'Evening')[blk(after, 'Evening').length - 1] === 'Evening:' + seatId, { hits, ev: blk(after, 'Evening') });
  const seqE = await groupSeq('Evening'), seqM = await groupSeq('Morning');
  check('A1 the readings row repaints as the source row in Evening and stands as NO source row in Morning (the stray ext-usccb-readings item left behind paints as an ordinary contents row — the Plan §2.4/R4 standing shape; it composes nothing)',
    !!seqE && seqE[seqE.length - 1] === 'SRC:usccb-daily-readings' && !!seqM && !seqM.some((x) => x === 'SRC:usccb-daily-readings'), { seqE, seqM });
  // A2: move back to Morning, then ▲▼ the seat item back above the
  // Rosary item — the composed day must be byte-identical.
  await moveViaMenu('[data-p686menu="src|Evening|usccb-daily-readings|seat:daily-readings"]', 'Morning');
  const rowBack = await srcRow('usccb-daily-readings');
  check('A2 the move back writes the readings store row to its standing value ("Mass and Homilies") — the settings row restores byte-for-byte',
    !!rowBack && rowBack.block === 'Mass and Homilies', rowBack);
  for (let i = 0; i < 4; i++) {
    const pos = await pg.evaluate(() => {
      const m = opnMaterialize604('Morning');
      const si = m.findIndex((x) => x.kind === 'seat');
      const ri = m.findIndex((x) => x.kind === 'source' && x.key === 'daily-rosary');
      return { si, ri };
    });
    if (pos.si < pos.ri) break;
    const up = pg.locator('[data-p684move="Morning|seat:daily-readings|up"]');
    await scrollTo(up); await tryClick(up); await pg.waitForTimeout(700);
  }
  const back = await composedDescs('john', '2026-11-25');
  check('A2 readings back before the Rosary: the composed day is byte-identical to the start',
    JSON.stringify(back) === JSON.stringify(before), { before: blk(before, 'Morning'), back: blk(back, 'Morning') });
}

// ---------- A3: a pinned office row moves (Amendment 2) ----------
await resetForm();
{
  const before = await composedDescs('john', '2026-11-25');
  const mv = await moveViaMenu('[data-p686menu="src|Night|do-night-prayer|source:ext-night-prayer"]', 'Morning');
  const row = await srcRow('do-night-prayer');
  const after = await composedDescs('john', '2026-11-25');
  check('A3 Night Prayer (pinned) moves Night → Morning on the dual write and composes at the END of Morning; Night composes without it',
    !!mv.after && mv.after.open === false && !!row && row.block === 'Morning'
    && blk(after, 'Morning')[blk(after, 'Morning').length - 1] === 'Morning:ext-night-prayer'
    && !blk(after, 'Night').some((x) => x.includes('night-prayer'))
    && blk(before, 'Night').some((x) => x.includes('night-prayer')), { row, morn: blk(after, 'Morning') });
  const seqM = await groupSeq('Morning');
  check('A3 the Night Prayer row repaints as the source row in Morning', !!seqM && seqM[seqM.length - 1] === 'SRC:do-night-prayer', seqM);
}

// ---------- A4 + A5: the duplicate key is the HOUR (Amendment 3) ----------
await resetForm();
{
  // A4: move the Midday Prayer SOURCE row (a pinned office hour, its
  // representation standing via a Salesian-shaped Midday list) into
  // Evening, which already holds the Office of Readings + Evening
  // Prayer — DIFFERENT hours, so no refusal may stand, and both
  // office hours compose in the one block. (The labeled Morning /
  // Evening Prayer CONTENTS items are the v670 model — out of this
  // release per Plan §2.3 — so the compose leg rides two source rows,
  // the machinery this release builds.)
  await pg.evaluate(() => { window.__store.johnContents.Midday = [{ kind: 'source', key: 'ext-midday-prayer' }, { kind: 'prayer', key: 'angelus-midday' }]; });
  await openForm();
  const mv4 = await moveViaMenu('[data-p686menu="src|Midday|do-midday-prayer|source:ext-midday-prayer"]', 'Evening');
  check('A4 the Midday Prayer row (representation standing) carries the live act and the move into office-holding Evening saves — no any-office refusal',
    mv4.items.some((x) => x.label === 'Move to block…' && !x.disabled) && !!mv4.after && mv4.after.open === false, { items: mv4.items.map((x) => x.label), after: mv4.after });
  const after = await composedDescs('john', '2026-11-25');
  const ev = blk(after, 'Evening');
  check('A4 two DIFFERENT offices compose in one block: Evening carries Office of Readings + Midday Prayer (plus the Evening Prayer contents item)',
    ev.some((x) => x.includes('ext-office-of-readings')) && ev.some((x) => x.includes('ext-midday-prayer')) && ev.some((x) => x.includes('ext-evening-prayer')), ev);
  // The standing opnMove686 contents refusal also keys on the hour:
  // a different-hour contents move into the same block is accepted.
  const resDiff = await pg.evaluate(async () => {
    const m = opnMaterialize604('Morning'); let seen = 0, rid = null;
    for (const x of m) { const id = opnTodayItemId594(x); if (id === 'source:ext-morning-prayer' && !rid) rid = opnRowId610(x, seen); seen += (id === 'source:ext-morning-prayer' ? 1 : 0); }
    const r = await opnMove686('Morning', rid, 'Midday');
    return { rid, r };
  });
  check('A4 opnMove686 (contents path) accepts a DIFFERENT office hour into a block holding another office hour (Midday Prayer now stands in Midday)',
    !!resDiff.r && resDiff.r.ok === true, resDiff);
  // A5: the SAME hour twice — a second ext-evening-prayer copy into
  // Evening (which already holds one) refuses by name, no writes.
  const res5 = await pg.evaluate(async () => {
    const before = JSON.stringify(window.__store.johnContents);
    const caps0 = window.__store.caps.length;
    // stand a copy of the Evening Prayer item in Morning first
    opnMaterialize604('Morning').push({ kind: 'source', key: 'ext-evening-prayer', side: 'sth' });
    const m = opnMaterialize604('Morning'); let seen = 0, rid = null;
    for (const x of m) { const id = opnTodayItemId594(x); if (id === 'source:ext-evening-prayer') rid = opnRowId610(x, seen); seen += (id === 'source:ext-evening-prayer' ? 1 : 0); }
    const r = await opnMove686('Morning', rid, 'Evening');
    return { r, capsDelta: window.__store.caps.length - caps0, listsUnchanged: JSON.stringify(opnMaterialize604('Evening').filter((x) => x.key === 'ext-evening-prayer').length) };
  });
  check('A5 the SAME office hour twice refuses BY NAME ("Evening Prayer already stands in Evening.") with the once-in-a-block sub',
    !!res5.r && res5.r.ok === false && res5.r.reason === 'Evening Prayer already stands in Evening.' && /stands once in a block/.test(res5.r.sub || ''), res5);
  check('A5 the refusal writes nothing (no profile write captured for the refused move)', res5.capsDelta === 0, res5);
  // A5 (wrapper seat): the SAME hour through the source-row act —
  // a Night Prayer copy already stands in Evening, so moving the
  // Night Prayer source row there refuses by name before any write.
  await resetForm();
  await pg.evaluate(() => { window.__store.johnContents.Evening.push({ kind: 'source', key: 'ext-night-prayer' }); });
  await openForm();
  const counts0 = await pg.evaluate(() => ({ caps: window.__store.caps.length, srcCaps: window.__store.srcCaps.length }));
  const mv5 = await moveViaMenu('[data-p686menu="src|Night|do-night-prayer|source:ext-night-prayer"]', 'Evening');
  const counts1 = await pg.evaluate(() => ({ caps: window.__store.caps.length, srcCaps: window.__store.srcCaps.length }));
  check('A5 the source-row act refuses the SAME office hour by name: "Night Prayer already stands in Evening." (picker stays open)',
    !!mv5.after && mv5.after.open === true && mv5.after.reason === 'Night Prayer already stands in Evening.' && /stands once in a block/.test(mv5.after.sub), mv5.after);
  check('A5 the wrapper refusal writes nothing (no contents write, no settings write)',
    counts1.caps === counts0.caps && counts1.srcCaps === counts0.srcCaps, { counts0, counts1 });
  await pg.evaluate(() => { const sh = document.querySelector('.p686picker'); if (sh) sh.remove(); });
}

// ---------- M6: off-block envelope at both server seats ----------
// The in-page stub applies profile PUTs with NO server validator,
// so this leg extracts validateProfileContents +
// parseMoveEnvelope686 + validateProfileContents686 VERBATIM from
// this tree's index.ts (the v686 L4c / v690 recipe) and drives the
// exact calls the two routes make, on M1's REAL captured write,
// against a Little-Way-shaped core that lacks Evening.
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
    const pBody = stripNamed(indexSrc, 'parseMoveEnvelope686', [
      ['function parseMoveEnvelope686(raw: unknown): { move?: { from: string; to: string } } | { error: string } {', 'function parseMoveEnvelope686(raw) {'],
      ['const m = raw as { from?: unknown; to?: unknown };', 'const m = raw;'],
    ]);
    const wBody = stripNamed(indexSrc, 'validateProfileContents686', [
      ['function validateProfileContents686(contents: unknown, coreBlocks: string[], extraBlocks?: string[]): { normalized?: Record<string, { kind: string; key?: string; side?: string; off?: number; dayRule?: string }[]> } | { error: string } {', 'function validateProfileContents686(contents, coreBlocks, extraBlocks) {'],
      ['const core: string[] = coreBlocks.slice();', 'const core = coreBlocks.slice();'],
    ]);
    SV = new Function(vBody + '\n' + pBody + '\n' + wBody + '\nreturn { v: validateProfileContents, parse: parseMoveEnvelope686, v686: validateProfileContents686 };')();
  } catch (e) { check('M6 the real index.ts validator + envelope seats extract standalone', false, e.message); }
  if (SV && m1Cap) {
    const LW_CORE = ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Night']; // Little-Way shape: Evening does not stand
    const contents = m1Cap.path === 'today-edit' ? (m1Cap.body.layer && m1Cap.body.layer.contents) : m1Cap.body.contents;
    const env = SV.parse(m1Cap.body.move686);
    check('M6 M1\'s captured write carries a parseable Move envelope {Midmorning→Evening}',
      !!env.move && env.move.from === 'Midmorning' && env.move.to === 'Evening', env);
    const noEnv = SV.v686(contents, LW_CORE, undefined);
    check('M6 without the envelope the real validator refuses the off-block (Evening) list whole at the save seat',
      !!noEnv.error && noEnv.error.includes('does not stand'), noEnv);
    const withEnv = SV.v686(contents, LW_CORE, env.move ? [env.move.from, env.move.to] : undefined);
    check('M6 save seat WITH the envelope: the off-block source move persists — Evening stands with the exegesis item at its end',
      !withEnv.error && !!withEnv.normalized && withEnv.normalized.Evening[withEnv.normalized.Evening.length - 1].key === 'ext-gospel-exegesis'
      && !withEnv.normalized.Midmorning.some((x) => x.key === 'ext-gospel-exegesis'), withEnv);
    const twin = SV.v686(contents, LW_CORE, env.move ? [env.move.from, env.move.to] : undefined);
    check('M6 today-edit twin seat: the same real validator call with the envelope stands the move (the route twins share the wrapper)',
      !twin.error && !!twin.normalized && twin.normalized.Evening[twin.normalized.Evening.length - 1].key === 'ext-gospel-exegesis', twin);
    const storedExtra = Object.keys(withEnv.normalized || {}).filter((x) => !LW_CORE.includes(x));
    const readBack = SV.v686(withEnv.normalized, LW_CORE, storedExtra);
    check('M6 read seat (prayerProfileStore re-validation shape): stored off-block contents validate back whole — the persisted move is not dropped on re-read',
      !readBack.error && !!readBack.normalized && readBack.normalized.Evening[readBack.normalized.Evening.length - 1].key === 'ext-gospel-exegesis', readBack);
    // Amendment 3 at the validator seat: the dedupe exception keys
    // on the item's own id — two DIFFERENT office hours both stand;
    // office duplicates are the standing v610 shape (never deduped),
    // and the same-hour refusal lives in the Move act (A5), not here.
    const twoOffices = SV.v({ Evening: [{ kind: 'source', key: 'ext-morning-prayer', side: 'do' }, { kind: 'source', key: 'ext-evening-prayer', side: 'sth' }] }, ['Evening']);
    check('M6/A3-key validator seat: two DIFFERENT office hours in one block both validate and stand (dedupe keys on the item id, never office-ness)',
      !twoOffices.error && !!twoOffices.normalized && twoOffices.normalized.Evening.length === 2, twoOffices);
  } else if (SV && !m1Cap) {
    check('M6 M1 produced a captured move write for the server-seat legs', false, 'm1Cap missing');
  }
}

await b.close();
server.close();
console.log('\nharness-v691: ' + ok + ' ok, ' + bad + ' bad');
process.exit(bad ? 1 : 0);
